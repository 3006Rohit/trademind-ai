
import { OHLCData, Timeframe } from '../types';
import { generateInitialData, updateCurrentCandle, getNextLiveCandle, getTimeframeConfig, getISTTime, checkMarketStatus } from './dataService';

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

  public subscribe(symbol: string, category: string, timeframe: Timeframe, callback: TickCallback) {
    this.cleanup();
    this.symbol = symbol;
    this.marketCategory = category;
    this.timeframe = timeframe;
    this.subscribers.push(callback);

    // Initialize Data
    const { interval, count } = getTimeframeConfig(timeframe);
    
    let startPrice = this.getStartPrice(category, symbol);
    this.history = generateInitialData(count, startPrice, symbol, category, interval);
    this.currentCandle = this.history[this.history.length - 1];

    // Initial Callback with full history
    callback(this.currentCandle, false);

    if (category === 'CRYPTO') {
        this.connectCryptoStream(symbol, timeframe);
    } else {
        this.startSimulationStream(interval);
    }

    return this.history;
  }

  public getHistory() {
      return this.history;
  }

  private getStartPrice(category: string, symbol: string): number {
    if (category === 'FOREX') {
        if (symbol.includes('JPY')) return 145; 
        return 1.08; 
    } else if (category === 'CRYPTO') {
        if (symbol.startsWith('BTC')) return 65000;
        if (symbol.startsWith('ETH')) return 3400;
        if (symbol.startsWith('SOL')) return 145;
        if (symbol.startsWith('XRP')) return 0.60;
        return 100;
    } else if (category === 'US MARKETS') {
        return 180;
    } 
    return 2500;
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

      console.log(`[Microservice] Connecting to Real-time Stream: ${wsUrl}`);

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
  private startSimulationStream(interval: number) {
      if (this.simulationInterval) return; // Already running
      
      console.log(`[Microservice] Starting Simulation Stream for ${this.symbol}`);
      
      this.simulationInterval = setInterval(() => {
          if (!this.currentCandle) return;

          const now = getISTTime().getTime();
          const currentBucket = Math.floor(now / interval) * interval;
          
          // Check if market is open for this symbol (skip updates during market close for stocks)
          let category = 'NIFTY 50';
          if (this.symbol.includes('USD')) category = 'FOREX';
          if (this.symbol.startsWith('BTC')) category = 'CRYPTO';
          if (['AAPL', 'MSFT', 'TSLA'].includes(this.symbol)) category = 'US MARKETS';
          
          // For non-crypto markets, don't update during market close
          if (category !== 'CRYPTO' && category !== 'FOREX' && !checkMarketStatus(now, category)) {
              return; // Market is closed, don't generate new data
          }
          
          let updatedCandle: OHLCData;
          let isNew = false;

          if (this.currentCandle.time === currentBucket) {
             updatedCandle = updateCurrentCandle(this.currentCandle, this.symbol);
          } else if (currentBucket > this.currentCandle.time) {
             this.history.push(this.currentCandle);
             if (this.history.length > 500) this.history.shift();
             
             updatedCandle = getNextLiveCandle(this.currentCandle, this.history, this.symbol, interval);
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
