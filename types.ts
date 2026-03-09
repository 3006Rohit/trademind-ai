
export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Predictions (still hardcoded for ML demo)
  pred_lstm?: number;
  pred_xgboost?: number;
  pred_rf?: number;
  pred_rnn?: number;
  pred_adaboost?: number;
  pred_arima?: number;
}

export enum Timeframe {
  S5 = '5s',
  S10 = '10s',
  S30 = '30s',
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
  W1 = '1w',
  MO1 = '1M',
  Y1 = '1y',
  Y3 = '3y',
  Y5 = '5y',
}

export enum OrderType {
  MARKET = 'Market',
  LIMIT = 'Limit',
}

export enum PositionType {
  BUY = 'Buy',
  SELL = 'Sell',
}

export interface Position {
  id: string;
  symbol: string;
  type: PositionType;
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: PositionType;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

export type ModelType = 'Traditional' | 'Ensemble' | 'Deep Learning' | 'Statistical';

export interface ModelMetric {
  name: string;
  type: ModelType;
  r2: number;
  mae: number;
  rmse: number;
  mape: string;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  color: string;
  nextPrice?: number; 
  forecastLabel?: string; 
}

export interface StockSymbol {
  symbol: string;
  name: string;
}

export type ChartType = 'candle' | 'bar' | 'line' | 'area';

export type DrawingTool = 'cursor' | 'line' | 'horizontal' | 'rect';

export interface Drawing {
  id: string;
  type: 'line' | 'horizontal' | 'rect';
  startTime: number; 
  startPrice: number;
  endTime?: number;
  endPrice?: number;
  color: string;
}

// --- NEW INDICATOR TYPES ---

export type IndicatorType = 'SMA' | 'EMA' | 'Bollinger' | 'RSI' | 'MACD' | 'ParabolicSAR' | 'CCI';

export interface Indicator {
  id: string;
  type: IndicatorType;
  color: string;
  period: number; // For SMA, EMA, RSI, CCI
  period2?: number; // For MACD slow, BB multiplier
  period3?: number; // For MACD signal
  visible: boolean;
}

export interface ChartConfig {
  chartType: ChartType;
  timeframe: Timeframe;
  showVolume: boolean;
  showPredictions: boolean;
  activeTool: DrawingTool;
  drawingColor: string;
  predictionHorizon: '1D' | '1W' | '1M';
  // New Dynamic Indicators
  activeIndicators: Indicator[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface SentimentAnalysisResult {
  text: string;
  score?: number; 
  groundingChunks: GroundingChunk[];
  timestamp: number;
}

export interface MarketReport {
  mood: 'Bullish' | 'Bearish' | 'Neutral';
  technical_analysis: string;
  sentiment_analysis: string;
  conclusion: string;
  timestamp: number;
}

export interface FinancialMetric {
  value: string;
  yoy_change?: string;
  context: string;
}

export interface FundamentalsReport {
  symbol: string;
  fiscal_year: string;
  gross_profit: FinancialMetric;
  depreciation_amortization: FinancialMetric;
  summary: string;
  source_urls: string[];
  timestamp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  token?: string;
}

// Persistent User Data Structure
export interface UserData {
  userId: string;
  balance: number;
  positions: Position[];
  history: Trade[];
  drawings: Drawing[];
}

export interface PortfolioSuggestionItem {
  symbol: string;
  score: number;
  weight: number;
  lastPrice: number;
  recommendedAmount: number;
  recommendedQty: number;
  reason: string;
}

export interface PortfolioSuggestion {
  generatedAt: number;
  market: string;
  investableCapital: number;
  methodology: string;
  items: PortfolioSuggestionItem[];
}