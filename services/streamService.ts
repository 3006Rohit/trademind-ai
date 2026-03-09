
import { OHLCData, Timeframe } from '../types';
import { generateInitialData, updateCurrentCandle, getNextLiveCandle, getTimeframeConfig, checkMarketStatus, fetchHistoryFromTwelveData, fetchHistoryFromYahooFinance, fetchHistoryFromBinance, fetchLatestForexPriceFromTwelveData, getMarketCategoryFromSymbol, getBasePriceForSymbol } from './dataService';
import { getApiKey } from './apiConfig';

// This service acts as the client-side gateway to our data sources.
type TickCallback = (candle: OHLCData, isNewCandle: boolean) => void;

class StreamService {
  private socket: WebSocket | null = null;
  private simulationInterval: any = null;
  private currentCandle: OHLCData | null = null;
  private subscribers: TickCallback[] = [];
  private history: OHLCData[] = [];
  
  // Configuration
  private symbol: string = '';
  private timeframe: Timeframe = Timeframe.M1;
  private marketCategory: string = '';

  constructor() {}

  public async subscribe(symbol: string, category: string, timeframe: Timeframe, callback: TickCallback): Promise<OHLCData[]> {
    this.cleanup();
    this.symbol = symbol;
    this.marketCategory = category;
    this.timeframe = timeframe;
    this.subscribers.push(callback);

    // Initialize Data (Fetch or Generate)
    const { interval, count } = getTimeframeConfig(timeframe);
    
    // Fetch from requested providers by market category, fallback to simulation
    const apiKey = getApiKey();
    let fetchedData: OHLCData[] | null = null;

    try {
        if (category === 'CRYPTO') {
            console.log(`[StreamService] Fetching crypto history from Binance for ${symbol}`);
            fetchedData = await fetchHistoryFromBinance(symbol, timeframe);
        } else if (category === 'FOREX') {
            if (!apiKey) throw new Error('Missing Twelve Data API key for FOREX');
            console.log(`[StreamService] Fetching forex history from Twelve Data for ${symbol}`);
            fetchedData = await fetchHistoryFromTwelveData(symbol, timeframe, apiKey);
        } else if (category === 'US MARKETS' || category === 'NSE' || category === 'BSE') {
            console.log(`[StreamService] Fetching stocks history from Yahoo Finance for ${symbol}`);
            fetchedData = await fetchHistoryFromYahooFinance(symbol, category, timeframe);
        }
    } catch (error) {
        console.warn('[StreamService] Provider fetch failed (using simulation fallback):', error);
    }

    if (fetchedData && fetchedData.length > 0) {
        this.history = fetchedData;
        this.currentCandle = this.history[this.history.length - 1];
    } else {
        // Fallback to simulation
        let startPrice = this.getStartPrice(category, symbol);
        this.history = generateInitialData(count, startPrice, symbol, category, interval);
        this.currentCandle = this.history[this.history.length - 1];
    }

    // Initial Callback with current candle
    if (this.currentCandle) {
        callback(this.currentCandle, false);
    }

    if (category === 'CRYPTO') {
        this.connectCryptoStream(symbol, timeframe);
    } else if (category === 'FOREX' && fetchedData && apiKey) {
        this.startForexQuoteStream(symbol, timeframe, apiKey);
    } else if (fetchedData && (category === 'US MARKETS' || category === 'NSE' || category === 'BSE')) {
        // If we have real fetched data, don't generate huge random swings. 
        // Just small micro-movements to show the chart is "live".
        // Use a smaller volatility factor.
        this.startSimulationStream(interval, true); 
    } else {
        this.startSimulationStream(interval, false);
    }

    return this.history;
  }

  private startForexQuoteStream(symbol: string, timeframe: Timeframe, apiKey: string) {
      if (this.simulationInterval) return;

      const { interval } = getTimeframeConfig(timeframe);
      const pollMs = 20000; // 3 req/min, within most free-tier limits

      this.simulationInterval = setInterval(async () => {
          if (!this.currentCandle) return;
          if (!checkMarketStatus(Date.now(), 'FOREX')) return;

          try {
              const price = await fetchLatestForexPriceFromTwelveData(symbol, apiKey);
              const now = Date.now();
              const currentBucket = Math.floor(now / interval) * interval;

              let next: OHLCData;
              let isNew = false;

              if (this.currentCandle.time === currentBucket) {
                  next = {
                      ...this.currentCandle,
                      close: price,
                      high: Math.max(this.currentCandle.high, price),
                      low: Math.min(this.currentCandle.low, price),
                      volume: (this.currentCandle.volume || 0) + 1,
                      pred_lstm: price,
                      pred_xgboost: price,
                      pred_rf: price,
                  };
              } else {
                  this.history.push(this.currentCandle);
                  if (this.history.length > 500) this.history.shift();

                  next = {
                      time: currentBucket,
                      open: this.currentCandle.close,
                      high: Math.max(this.currentCandle.close, price),
                      low: Math.min(this.currentCandle.close, price),
                      close: price,
                      volume: 1,
                      pred_lstm: price,
                      pred_xgboost: price,
                      pred_rf: price,
                  };
                  isNew = true;
              }

              this.currentCandle = next;
              this.notifySubscribers(next, isNew);
          } catch (error) {
              console.warn('[StreamService] Forex quote poll failed:', error);
          }
      }, pollMs);
  }

  public getHistory() {
      return this.history;
  }

  private getStartPrice(category: string, symbol: string): number {
    return getBasePriceForSymbol(symbol);
  }

  // --- REAL-TIME BINANCE WEBSOCKET INTEGRATION ---
  private connectCryptoStream(symbol: string, timeframe: Timeframe) {
      const pair = symbol.toLowerCase().replace('usd', 'usdt');
      
      const binanceIntervalMap: Record<string, string> = {
          '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
          '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w'
      };
      
      const intervalStr = binanceIntervalMap[timeframe] || '1m';
      const wsUrl = `wss://stream.binance.com:9443/ws/${pair}@kline_${intervalStr}`;

      console.log(`[StreamService] Connecting to Real-time Stream: ${wsUrl}`);

      try {
          this.socket = new WebSocket(wsUrl);

          this.socket.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.e === 'kline') {
                    const k = message.k;
                    
                    // Prevent processing old packets
                    if (this.currentCandle && k.t < this.currentCandle.time) return;

                    const isNew = this.currentCandle && k.t > this.currentCandle.time;
                    
                    if (isNew && this.currentCandle) {
                        this.history.push(this.currentCandle);
                        if (this.history.length > 500) this.history.shift();
                    }

                    // Add NaN guards (|| 0) to prevent chart crashes
                    const close = parseFloat(k.c) || 0;
                    
                    const candle: OHLCData = {
                        time: k.t,
                        open: parseFloat(k.o) || 0,
                        high: parseFloat(k.h) || 0,
                        low: parseFloat(k.l) || 0,
                        close: close,
                        volume: parseFloat(k.v) || 0,
                        pred_lstm: close * (1 + (Math.random() - 0.5) * 0.005),
                        pred_xgboost: close * (1 + (Math.random() - 0.5) * 0.008),
                        pred_rf: close * (1 + (Math.random() - 0.5) * 0.006),
                    };

                    this.currentCandle = candle;
                    this.notifySubscribers(candle, isNew || false);
                }
              } catch (e) {
                  console.error("WS Parse Error", e);
              }
          };

          this.socket.onerror = (err) => {
              console.warn("Binance WS Error (Trying fallback):", err);
              // Do not immediately start simulation here, wait for onclose or manual fallback
          };

          this.socket.onclose = () => {
              console.log("Binance WS Closed. Switching to simulation mode.");
              // Only fallback if this socket was the active one and we haven't already started simulation
              if (this.marketCategory === 'CRYPTO' && !this.simulationInterval) {
                  const { interval } = getTimeframeConfig(timeframe);
                  this.startSimulationStream(interval);
              }
          };

      } catch (e) {
          console.error("Failed to create WebSocket:", e);
          const { interval } = getTimeframeConfig(timeframe);
          this.startSimulationStream(interval);
      }
  }

  // --- SIMULATION STREAM (Fallback / Stock Markets) ---
  private startSimulationStream(interval: number, isBasedOnRealData = false) {
      if (this.simulationInterval) return; // Already running
      
      console.log(`[StreamService] Starting Stream for ${this.symbol} (Real Data Mode: ${isBasedOnRealData})`);
      
      this.simulationInterval = setInterval(() => {
          if (!this.currentCandle) return;

          const now = Date.now();
          const currentBucket = Math.floor(now / interval) * interval;
          
          // Check if market is open for this symbol (skip updates during market close for stocks)
          const category = getMarketCategoryFromSymbol(this.symbol);
          
          // For non-crypto markets, don't update during market close
          if (category !== 'CRYPTO' && category !== 'FOREX' && !checkMarketStatus(now, category)) {
              return; // Market is closed, don't generate new data
          }
          
          let updatedCandle: OHLCData;
          let isNew = false;
          
          // If based on real data, force the volatility to be extremely low so it looks realistic
          // instead of random jumping.
          const volatilityModifier = isBasedOnRealData ? 0.05 : 1.0; 

          if (this.currentCandle.time === currentBucket) {
             updatedCandle = updateCurrentCandle(this.currentCandle, this.symbol, volatilityModifier);
          } else if (currentBucket > this.currentCandle.time) {
             this.history.push(this.currentCandle);
             if (this.history.length > 500) this.history.shift();
             
             updatedCandle = getNextLiveCandle(this.currentCandle, this.history, this.symbol, interval, volatilityModifier);
             updatedCandle.time = currentBucket;
             isNew = true;
          } else {
              return;
          }

          this.currentCandle = updatedCandle;
          this.notifySubscribers(updatedCandle, isNew);
      }, 1000);
  }

  private notifySubscribers(candle: OHLCData, isNewCandle: boolean) {
      this.subscribers.forEach(cb => cb(candle, isNewCandle));
  }

  public unsubscribe(callback: TickCallback) {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
      if (this.subscribers.length === 0) {
          this.cleanup();
      }
  }

  private cleanup() {
      if (this.socket) {
          // Remove listeners to prevent zombie callbacks
          this.socket.onmessage = null;
          this.socket.onerror = null;
          this.socket.onclose = null;
          this.socket.close();
          this.socket = null;
      }
      if (this.simulationInterval) {
          clearInterval(this.simulationInterval);
          this.simulationInterval = null;
      }
      this.history = [];
      this.subscribers = [];
  }
}

export const streamService = new StreamService();
