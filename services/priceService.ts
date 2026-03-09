/**
 * Live Price Service
 * Fetches real-time prices from Yahoo Finance, Binance, and Twelve Data APIs.
 * Caches results with TTL to minimize API calls.
 * Falls back to hardcoded prices only as a last resort.
 */

import { getBasePriceFromData } from '../data/stockData';
import { getApiKey } from './apiConfig';

interface CachedPrice {
  price: number;
  timestamp: number;
}

// Cache TTL: 60 seconds for live prices
const CACHE_TTL_MS = 60_000;

// In-memory price cache
const priceCache = new Map<string, CachedPrice>();

/**
 * Get a cached price if it exists and is fresh (within TTL)
 */
export const getCachedPrice = (symbol: string): number | null => {
  const entry = priceCache.get(symbol);
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS) {
    return entry.price;
  }
  return null;
};

/**
 * Store a price in the cache
 */
const setCachedPrice = (symbol: string, price: number): void => {
  priceCache.set(symbol, { price, timestamp: Date.now() });
};

// ─── Yahoo Finance (NSE / BSE / US Stocks) ───────────────────────────────────

/**
 * Fetch current price from Yahoo Finance using the chart endpoint.
 * Works for NSE (.NS), BSE (.BO), and US stocks.
 */
const fetchYahooPrice = async (symbol: string, category: string): Promise<number> => {
  let yahooSymbol = symbol;
  if (category === 'NSE') yahooSymbol = `${symbol}.NS`;
  else if (category === 'BSE') {
    yahooSymbol = symbol.endsWith('.BO') ? symbol : `${symbol}.BO`;
  }

  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;

  // regularMarketPrice is the most accurate live price
  const price = meta?.regularMarketPrice;
  if (price && !isNaN(price)) return Number(price);

  // Fallback: last close from quote data
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close;
  if (closes && closes.length > 0) {
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null && !isNaN(closes[i])) return Number(closes[i]);
    }
  }

  throw new Error('No valid price in Yahoo response');
};

// ─── Binance (Crypto) ────────────────────────────────────────────────────────

/**
 * Fetch current price from Binance ticker endpoint.
 */
const fetchBinancePrice = async (symbol: string): Promise<number> => {
  // Convert e.g. BTCUSD → BTCUSDT
  const pair = symbol.toUpperCase().replace('USD', 'USDT');
  const url = `/api/binance/api/v3/ticker/price?symbol=${pair}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);

  const data = await response.json();
  const price = parseFloat(data?.price);
  if (isNaN(price)) throw new Error('Invalid Binance price');
  return price;
};

// ─── Twelve Data (Forex) ─────────────────────────────────────────────────────

/**
 * Fetch current price from Twelve Data price endpoint.
 */
const fetchTwelveDataPrice = async (symbol: string): Promise<number> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Missing Twelve Data API key');

  // Convert EURUSD → EUR/USD
  let apiSymbol = symbol;
  if (symbol.length === 6 && !symbol.includes('/')) {
    apiSymbol = `${symbol.substring(0, 3)}/${symbol.substring(3)}`;
  }

  const url = `https://api.twelvedata.com/price?symbol=${apiSymbol}&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TwelveData HTTP ${response.status}`);

  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message || 'TwelveData error');

  const price = parseFloat(data.price);
  if (isNaN(price)) throw new Error('Invalid TwelveData price');
  return price;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch a live price for the given symbol and category.
 * Uses cache to avoid repeated API calls.
 * Falls back to hardcoded price only as a last resort.
 */
export const fetchLivePrice = async (symbol: string, category: string): Promise<number> => {
  // 1. Check cache first
  const cached = getCachedPrice(symbol);
  if (cached !== null) {
    console.log(`[PriceService] Cache hit for ${symbol}: ${cached}`);
    return cached;
  }

  // 2. Try to fetch from the appropriate API
  try {
    let price: number;

    if (category === 'CRYPTO') {
      price = await fetchBinancePrice(symbol);
    } else if (category === 'FOREX') {
      price = await fetchTwelveDataPrice(symbol);
    } else {
      // NSE, BSE, US MARKETS
      price = await fetchYahooPrice(symbol, category);
    }

    console.log(`[PriceService] Live price for ${symbol}: ${price}`);
    setCachedPrice(symbol, price);
    return price;
  } catch (error) {
    console.warn(`[PriceService] Failed to fetch live price for ${symbol}:`, error);
  }

  // 3. Last resort: hardcoded fallback
  const fallback = getBasePriceFromData(symbol);
  console.log(`[PriceService] Using hardcoded fallback for ${symbol}: ${fallback}`);
  return fallback;
};

/**
 * Synchronous price getter: returns cached live price or hardcoded fallback.
 * Use this when you need a price synchronously (e.g., for snapshot calculations).
 */
export const getBestAvailablePrice = (symbol: string): number => {
  const cached = getCachedPrice(symbol);
  if (cached !== null) return cached;
  return getBasePriceFromData(symbol);
};

/**
 * Batch-fetch prices for multiple symbols from Yahoo Finance.
 * Yahoo supports multi-symbol queries which is much more efficient.
 */
export const fetchYahooBatchPrices = async (
  symbols: { symbol: string; category: string }[]
): Promise<Map<string, number>> => {
  const results = new Map<string, number>();
  
  // Process in batches of 5 to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    const promises = batch.map(async ({ symbol, category }) => {
      try {
        const price = await fetchLivePrice(symbol, category);
        results.set(symbol, price);
      } catch {
        // Individual failure won't break the batch
      }
    });

    await Promise.allSettled(promises);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
};

/**
 * Update the cache from externally fetched data (e.g., from chart candles).
 * Call this when you receive price data from any source to keep the cache warm.
 */
export const updatePriceCache = (symbol: string, price: number): void => {
  if (price && !isNaN(price) && price > 0) {
    setCachedPrice(symbol, price);
  }
};
