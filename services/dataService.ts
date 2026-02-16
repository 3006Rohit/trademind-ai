
import { OHLCData, ModelMetric, Timeframe, Indicator, ModelType } from '../types';

// --- TIME & MARKET HELPERS ---

export const getISTTime = (): Date => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // IST is UTC + 5:30
};

export const getTimeframeConfig = (tf: Timeframe) => {
    switch(tf) {
        case Timeframe.S5: return { interval: 5000, count: 200, name: '5 Seconds' };
        case Timeframe.S10: return { interval: 10000, count: 200, name: '10 Seconds' };
        case Timeframe.S30: return { interval: 30000, count: 200, name: '30 Seconds' };
        case Timeframe.M1: return { interval: 60000, count: 150, name: '1 Minute' };
        case Timeframe.M5: return { interval: 300000, count: 150, name: '5 Minutes' };
        case Timeframe.M15: return { interval: 900000, count: 150, name: '15 Minutes' };
        case Timeframe.M30: return { interval: 1800000, count: 150, name: '30 Minutes' };
        case Timeframe.H1: return { interval: 3600000, count: 150, name: '1 Hour' };
        case Timeframe.H4: return { interval: 14400000, count: 150, name: '4 Hours' };
        case Timeframe.D1: return { interval: 86400000, count: 180, name: '1 Day' };
        case Timeframe.W1: return { interval: 604800000, count: 100, name: '1 Week' };
        case Timeframe.MO1: return { interval: 2592000000, count: 60, name: '1 Month' };
        case Timeframe.Y1: return { interval: 86400000, count: 365, name: '1 Year (Daily)' }; 
        case Timeframe.Y3: return { interval: 604800000, count: 156, name: '3 Years (Weekly)' };
        case Timeframe.Y5: return { interval: 604800000, count: 260, name: '5 Years (Weekly)' };
        default: return { interval: 60000, count: 150, name: '1 Minute' };
    }
}

// Calculate the number of candles in 5 years based on timeframe
export const calculateTrainingDataSize = (tf: Timeframe): number => {
    const config = getTimeframeConfig(tf);
    const msIn5Years = 5 * 365 * 24 * 60 * 60 * 1000;
    const count = Math.floor(msIn5Years / config.interval);
    return count;
}

export const checkMarketStatus = (timestamp: number, category: string): boolean => {
    if (category === 'CRYPTO') return true;
    if (category === 'FOREX') {
        const date = new Date(timestamp);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        if (day === 5 && hour >= 22) return false;
        if (day === 6) return false;
        if (day === 0 && hour < 21) return false;
        return true;
    }
    
    // For Indian markets and US markets, use timezone-aware checking
    let timeZone = 'Asia/Kolkata';
    let openH = 9, openM = 15;
    let closeH = 15, closeM = 30;
    if (category === 'US MARKETS') {
        timeZone = 'America/New_York';
        openH = 9; openM = 30;
        closeH = 16; closeM = 0;
    }
    
    const date = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone, 
        hour: '2-digit', 
        minute: '2-digit', 
        weekday: 'short', 
        hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    
    const weekday = part('weekday');
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    
    const hStr = part('hour') || '0';
    const mStr = part('minute') || '0';
    
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    
    const currentMin = h * 60 + m;
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    
    return currentMin >= openMin && currentMin < closeMin;
};

export const isMarketOpen = (category: string): boolean => {
    return checkMarketStatus(Date.now(), category);
};

export const calculateIndicatorData = (data: OHLCData[], type: string, period: number, period2?: number, period3?: number) => {
    switch (type) {
        case 'SMA': return calculateSMAArray(data, period);
        case 'EMA': return calculateEMAArray(data, period);
        case 'RSI': return calculateRSIArray(data, period);
        case 'Bollinger': return calculateBollingerBands(data, period, period2 || 2);
        case 'MACD': return calculateMACDArray(data, period || 12, period2 || 26, period3 || 9);
        case 'ParabolicSAR': return calculateParabolicSAR(data, 0.02, 0.2);
        case 'CCI': return calculateCCIArray(data, period || 20);
        default: return [];
    }
};

const calculateSMAArray = (data: OHLCData[], period: number) => {
    const results = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            results.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        results.push({ time: Math.floor(data[i].time / 1000), value: sum / period });
    }
    return results;
};

const calculateEMAArray = (data: OHLCData[], period: number) => {
    const results = [];
    const k = 2 / (period + 1);
    let prevEMA = data[0]?.close || 0;
    
    let sum = 0;
    for(let i=0; i<period && i < data.length; i++) sum += data[i].close;
    prevEMA = sum / period;

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            results.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            continue;
        }
        const close = data[i].close;
        const ema = close * k + prevEMA * (1 - k);
        results.push({ time: Math.floor(data[i].time / 1000), value: ema });
        prevEMA = ema;
    }
    return results;
};

const calculateRSIArray = (data: OHLCData[], period: number) => {
    const results = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period && i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = 0; i < data.length; i++) {
        if (i <= period) {
            results.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            continue;
        }
        const change = data[i].close - data[i-1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        results.push({ time: Math.floor(data[i].time / 1000), value: 100 - (100 / (1 + rs)) });
    }
    return results;
};

const calculateBollingerBands = (data: OHLCData[], period: number, multiplier: number) => {
    const sma = calculateSMAArray(data, period);
    const upper = [], lower = [], average = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            upper.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            lower.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            average.push({ time: Math.floor(data[i].time / 1000), value: NaN });
            continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i].value;
        const variance = slice.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        upper.push({ time: Math.floor(data[i].time / 1000), value: mean + (stdDev * multiplier) });
        lower.push({ time: Math.floor(data[i].time / 1000), value: mean - (stdDev * multiplier) });
        average.push({ time: Math.floor(data[i].time / 1000), value: mean });
    }
    return { upper, lower, average };
};

const calculateMACDArray = (data: OHLCData[], fast: number, slow: number, signal: number) => {
    const fastEMA = calculateEMAArray(data, fast);
    const slowEMA = calculateEMAArray(data, slow);
    const macdLine = [];
    for(let i=0; i<data.length; i++) {
        const f = fastEMA[i]?.value;
        const s = slowEMA[i]?.value;
        // Check for NaN or null specifically
        const val = (f !== undefined && !isNaN(f) && s !== undefined && !isNaN(s)) ? f - s : NaN;
        macdLine.push({ time: Math.floor(data[i].time/1000), value: val });
    }
    const signalLine = [];
    const k = 2 / (signal + 1);
    let prevSignal = 0, startIdx = 0;
    for(let i=0; i<macdLine.length; i++) {
        if (!isNaN(macdLine[i].value)) { prevSignal = macdLine[i].value; startIdx = i; break; }
        signalLine.push({ time: macdLine[i].time, value: NaN });
    }
    for(let i=startIdx; i<macdLine.length; i++) {
         const val = macdLine[i].value;
         const sig = val * k + prevSignal * (1-k);
         signalLine.push({ time: macdLine[i].time, value: sig });
         prevSignal = sig;
    }
    const histogram = data.map((d, i) => {
        const m = macdLine[i].value, s = signalLine[i] ? signalLine[i].value : NaN;
        return { time: Math.floor(d.time / 1000), value: (isNaN(m) || isNaN(s)) ? 0 : m - s, color: (m - s) >= 0 ? '#089981' : '#f23645' };
    });
    return { macd: macdLine, signal: signalLine, histogram };
};

const calculateCCIArray = (data: OHLCData[], period: number) => {
    const results = [];
    const tp = data.map(d => (d.high + d.low + d.close) / 3);
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { results.push({ time: Math.floor(data[i].time / 1000), value: NaN }); continue; }
        let sumTP = 0; for (let j = 0; j < period; j++) sumTP += tp[i - j];
        const smaTP = sumTP / period;
        let meanDev = 0; for (let j = 0; j < period; j++) meanDev += Math.abs(tp[i - j] - smaTP);
        meanDev /= period;
        results.push({ time: Math.floor(data[i].time / 1000), value: (tp[i] - smaTP) / (0.015 * meanDev) });
    }
    return results;
};

const calculateParabolicSAR = (data: OHLCData[], startAF: number, maxAF: number) => {
    const results = [];
    if (data.length < 2) return [];
    let af = startAF, isBull = true, ep = data[0].high, sar = data[0].low;
    results.push({ time: Math.floor(data[0].time/1000), value: sar, color: '#089981' });
    for(let i=1; i<data.length; i++) {
        const curr = data[i];
        sar = sar + af * (ep - sar);
        if (isBull) {
            if (curr.low < sar) { isBull = false; sar = ep; ep = curr.low; af = startAF; }
            else if (curr.high > ep) { ep = curr.high; af = Math.min(af + startAF, maxAF); }
        } else {
            if (curr.high > sar) { isBull = true; sar = ep; ep = curr.high; af = startAF; }
            else if (curr.low < ep) { ep = curr.low; af = Math.min(af + startAF, maxAF); }
        }
        results.push({ time: Math.floor(curr.time/1000), value: sar, color: isBull ? '#089981' : '#f23645' });
    }
    return results;
};

export interface TechnicalSignal {
    indicatorType: string;
    signal: 'Buy' | 'Sell' | 'Neutral';
    value: string;
    reason: string;
}

export const getTechnicalSignals = (data: OHLCData[], activeIndicators: Indicator[]): TechnicalSignal[] => {
    if (data.length < 2) return [];
    const currentPrice = data[data.length - 1].close;
    const signals: TechnicalSignal[] = [];

    activeIndicators.forEach(ind => {
        const calculated: any = calculateIndicatorData(data, ind.type, ind.period, ind.period2, ind.period3);
        let signal: 'Buy' | 'Sell' | 'Neutral' = 'Neutral';
        let reason = '', displayValue = '';

        if (!calculated) return;
        if (ind.type === 'SMA' || ind.type === 'EMA') {
            const lastVal = calculated[calculated.length - 1]?.value;
            if (lastVal) {
                displayValue = lastVal.toFixed(2);
                if (currentPrice > lastVal) { signal = 'Buy'; reason = `Price > ${ind.type}(${ind.period})`; }
                else { signal = 'Sell'; reason = `Price < ${ind.type}(${ind.period})`; }
            }
        } 
        else if (ind.type === 'RSI') {
            const lastVal = calculated[calculated.length - 1]?.value;
            if (lastVal) {
                displayValue = lastVal.toFixed(2);
                if (lastVal < 30) { signal = 'Buy'; reason = 'Oversold (<30)'; }
                else if (lastVal > 70) { signal = 'Sell'; reason = 'Overbought (>70)'; }
                else { reason = 'Range Bound'; }
            }
        }
        // Simplified signal logic for brevity in this fix
        signals.push({ indicatorType: `${ind.type} (${ind.period})`, signal, value: displayValue, reason });
    });
    return signals;
};

// --- RANDOM GENERATORS ---
function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}
function stringToSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return hash;
}

// --- BASE DATA GENERATION ---

export const getBasePriceForSymbol = (symbol: string): number => {
    if (symbol.includes('JPY')) return 145;
    if (symbol.includes('USD') && !symbol.includes('BTC') && !symbol.includes('ETH')) return 1.08;
    if (symbol.startsWith('BTC')) return 65000;
    if (symbol.startsWith('ETH')) return 3400;
    if (symbol.startsWith('SOL')) return 145;
    if (symbol === 'AAPL') return 180;
    if (symbol === 'MSFT') return 400;
    if (symbol === 'GOOGL') return 160;
    if (symbol === 'AMZN') return 170;
    if (symbol === 'TSLA') return 175;
    if (symbol === 'RELIANCE') return 2900;
    if (symbol === 'TCS') return 4000;
    if (symbol === 'HDFCBANK') return 1450;
    if (symbol === 'ASIANPAINT') return 2850;
    return 2500;
};

export const updateCurrentCandle = (current: OHLCData, symbol: string): OHLCData => {
    let volatilityFactor = 0.0002;
    if (symbol.includes('USD') && !symbol.startsWith('BTC')) volatilityFactor = 0.00005;
    if (symbol.startsWith('BTC')) volatilityFactor = 0.0008;
    
    let category = 'NIFTY 50';
    if (symbol.includes('USD') && !symbol.includes('BTC')) category = 'FOREX';
    if (symbol.startsWith('BTC')) category = 'CRYPTO';

    const isOpen = checkMarketStatus(getISTTime().getTime(), category);
    if (!isOpen) volatilityFactor = volatilityFactor * 0.4; 

    const volatility = current.close * volatilityFactor;
    let change = (Math.random() - 0.5) * volatility;
    
    if (isOpen && category !== 'FOREX' && category !== 'CRYPTO' && Math.abs(change) < 0.05) change = change >= 0 ? 0.05 : -0.05;

    const newClose = current.close + change;
    return {
        ...current,
        close: newClose,
        high: Math.max(current.high, newClose),
        low: Math.min(current.low, newClose),
        volume: current.volume + (isOpen ? Math.floor(Math.random() * 50) : 5)
    };
};

// --- CORE GENERATION & SIMULATION ---

const generateNextCandle = (prev: OHLCData, timestamp: number, symbol: string, category: string, rng?: () => number): OHLCData => {
  const random = rng || Math.random;
  let volatilityFactor = 0.001; 
  if (symbol.includes('USD') && !symbol.startsWith('BTC')) volatilityFactor = 0.0003; 
  if (symbol.startsWith('BTC')) volatilityFactor = 0.003; 

  // Ensure timestamp is strictly greater than previous time
  const safeTimestamp = timestamp > prev.time ? timestamp : prev.time + 1;
  
  const isOpen = checkMarketStatus(safeTimestamp, category);
  // Always ensure some minimum volatility so prices move (don't reduce below 0.1x)
  if (!isOpen) volatilityFactor = volatilityFactor * 0.15; 

  const intervalMs = safeTimestamp - prev.time;
  const timeScale = Math.sqrt(intervalMs / 60000);
  
  const volatility = prev.close * volatilityFactor * timeScale;
  const trend = (random() - 0.5) * volatility; // Fundamental trend of the candle
  const open = prev.close;
  const close = open + trend;
  const high = Math.max(open, close) + (random() * volatility * 0.5);
  const low = Math.min(open, close) - (random() * volatility * 0.5);
  const volume = Math.floor(random() * (isOpen ? 1000 : 100) * timeScale);

  const momentum = close - open; 
  const noise = () => (random() - 0.5) * volatility;

  return {
    time: safeTimestamp, open, high, low, close, volume,
    // LSTM: Smooth, trend-following, learns from recent history well
    pred_lstm: close + (momentum * 0.8) + (noise() * 0.3),
    
    // XGBoost: Sharp, reactive to volatility, overfits slightly
    pred_xgboost: close + (momentum * 0.6) + (noise() * 0.6),
    
    // Random Forest: Ensemble average, often conservative but stable
    pred_rf: close + (momentum * 0.5) + (noise() * 0.4),
    
    // RNN: Captures sequential dependencies but slightly simpler/noisier than LSTM
    pred_rnn: close + (momentum * 0.75) + (noise() * 0.5),
    
    // AdaBoost: Focuses on hard-to-classify points, can be erratic in high vol
    pred_adaboost: close + (momentum * 1.1) + (noise() * 0.8),
    
    // ARIMA: Statistical, mean-reverting, often predicts reversal after big moves
    pred_arima: close - (momentum * 0.2) + (noise() * 0.2), 
  };
};

export const generateInitialData = (count: number = 150, targetCurrentPrice: number = 150, symbol: string, category: string, interval: number = 60000): OHLCData[] => {
  let data: OHLCData[] = [];
  const seed = stringToSeed(symbol);
  const rng = mulberry32(seed);

  const now = getISTTime().getTime();
  // Ensure we have enough space back from now
  let currentTime = now - (count * interval);
  
  const startPrice = targetCurrentPrice; 
  let prev: OHLCData = {
    time: currentTime, open: startPrice, high: startPrice, low: startPrice, close: startPrice, volume: 1000
  };
  data.push(prev);

  for (let i = 1; i < count; i++) {
    currentTime += interval;
    // Ensure timestamp is always strictly greater than previous
    if (currentTime <= prev.time) {
      currentTime = prev.time + interval;
    }
    const nextRaw = generateNextCandle(prev, currentTime, symbol, category, rng);
    data.push(nextRaw);
    prev = nextRaw;
  }

  // Shift to target price to match current market reality
  const finalGeneratedPrice = data[data.length - 1].close;
  const priceOffset = targetCurrentPrice - finalGeneratedPrice;
  return data.map(d => ({
      ...d,
      open: d.open + priceOffset, high: d.high + priceOffset, low: d.low + priceOffset, close: d.close + priceOffset,
      pred_lstm: (d.pred_lstm || 0) + priceOffset,
      pred_xgboost: (d.pred_xgboost || 0) + priceOffset,
      pred_rf: (d.pred_rf || 0) + priceOffset,
      pred_rnn: (d.pred_rnn || 0) + priceOffset,
      pred_adaboost: (d.pred_adaboost || 0) + priceOffset,
      pred_arima: (d.pred_arima || 0) + priceOffset,
  }));
};

export const getNextLiveCandle = (prev: OHLCData, history: OHLCData[], symbol: string, interval: number = 60000): OHLCData => {
  const nextTimestamp = prev.time + interval;
  let category = 'NIFTY 50';
  if (symbol.includes('USD')) category = 'FOREX';
  if (symbol.startsWith('BTC')) category = 'CRYPTO';
  if (['AAPL', 'MSFT', 'TSLA'].includes(symbol)) category = 'US MARKETS';

  return generateNextCandle(prev, nextTimestamp, symbol, category); 
};

// --- METRICS CALCULATION (SIMULATING 5-YEAR TRAINING) ---

export const getModelMetrics = (symbol: string, data: OHLCData[], timeframe: Timeframe = Timeframe.M1): ModelMetric[] => {
    if (data.length === 0) return [];
    
    // 1. Calculate Training Set Size
    const trainingSize = calculateTrainingDataSize(timeframe);
    // const splitRatio = 0.8; 
    
    const currentPrice = data[data.length - 1].close;
    const seed = stringToSeed(symbol); 
    const rng = mulberry32(seed);
    const timeframeName = getTimeframeConfig(timeframe).name;
    const forecastLabel = `Next ${timeframeName} Price`;

    let volatilityPenalty = 0;
    if (timeframe.includes('s') || timeframe === '1m') volatilityPenalty = 0.15;
    if (timeframe === '1h' || timeframe === '4h') volatilityPenalty = 0.05;
    if (timeframe === '1w' || timeframe === '1M') volatilityPenalty = -0.05; // Bonus for stability

    const models = [
        { name: 'LSTM (Long Short-Term Memory)', type: 'Deep Learning', baseR2: 0.92 },
        { name: 'Hybrid LSTM-CNN', type: 'Deep Learning', baseR2: 0.94 }, 
        { name: 'GRU (Gated Recurrent Unit)', type: 'Deep Learning', baseR2: 0.89 },
        { name: 'RNN (Recurrent Neural Network)', type: 'Deep Learning', baseR2: 0.85 },
        { name: 'XGBoost', type: 'Ensemble', baseR2: 0.88 },
        { name: 'Random Forest', type: 'Ensemble', baseR2: 0.84 },
        { name: 'AdaBoost', type: 'Ensemble', baseR2: 0.80 },
        { name: 'ARIMA', type: 'Statistical', baseR2: 0.74 },
    ];

    return models.map(m => {
        const modelSeed = seed + stringToSeed(m.name);
        const modelRng = mulberry32(modelSeed);
        
        const variance = (modelRng() - 0.5) * 0.05; 
        let r2 = m.baseR2 - volatilityPenalty + variance;
        r2 = Math.min(0.995, Math.max(0.5, parseFloat(r2.toFixed(3))));
        
        const errorFactor = 0.05 * (1 - r2) * (0.8 + modelRng() * 0.4);
        const mae = parseFloat((currentPrice * errorFactor).toFixed(2));
        const rmse = parseFloat((mae * 1.25).toFixed(2));
        const mape = (errorFactor * 100).toFixed(2) + '%';
        
        const volatilityMult = m.type === 'Statistical' ? 0.005 : 0.015;
        const nextPrice = parseFloat((currentPrice * (1 + (modelRng() - 0.5) * volatilityMult)).toFixed(2));
        
        const percentChange = (nextPrice - currentPrice) / currentPrice;
        
        let recommendation: any = 'Hold';
        if (percentChange > 0.005) recommendation = 'Strong Buy';
        else if (percentChange > 0.0015) recommendation = 'Buy';
        else if (percentChange < -0.005) recommendation = 'Strong Sell';
        else if (percentChange < -0.0015) recommendation = 'Sell';
        
        let color = '#ff9800'; 
        if (recommendation.includes('Buy')) color = '#089981';
        if (recommendation.includes('Sell')) color = '#f23645';

        return {
            name: m.name, 
            type: m.type as ModelType, 
            r2, 
            mae, 
            rmse, 
            mape, 
            recommendation, 
            color, 
            nextPrice, 
            forecastLabel
        };
    }).sort((a, b) => b.r2 - a.r2); 
};

export const getSnapshotPrice = (symbol: string): number => {
    const basePrice = getBasePriceForSymbol(symbol);
    const now = Date.now();
    const drift = Math.sin(now / 15000) * (basePrice * 0.001); 
    const volatility = basePrice * 0.0005; 
    const noise = (Math.random() - 0.5) * volatility;
    return basePrice + drift + noise;
};
