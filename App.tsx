
import React, { useState, useEffect, useCallback } from 'react';
import { OHLCData, ChartConfig, StockSymbol, ModelMetric, SentimentAnalysisResult, Position, PositionType, Drawing, Timeframe, Trade, OrderType } from './types';
import { getModelMetrics, isMarketOpen, getTimeframeConfig, getSnapshotPrice } from './services/dataService';
import { streamService } from './services/streamService'; 
import { analyzeStockSentiment } from './services/aiService';
import { useAuth } from './contexts/AuthContext';
import TradingChart from './components/TradingChart';
import OrderPanel from './components/OrderPanel';
import MLPanel from './components/MLPanel';
import IndicatorSelector from './components/IndicatorSelector';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { Settings, Layers, MousePointer, PenTool, BarChart3, Binary, Eye, Brain, DollarSign, Activity, ChevronDown, LogOut, Loader2, LineChart, AreaChart, CandlestickChart, Square, Hash, Filter, Clock, Globe, TrendingUp, Bitcoin, BellRing, Percent, Minus, Trash2, GripHorizontal, GripVertical } from 'lucide-react';

type MarketCategory = 'NIFTY 50' | 'FOREX' | 'CRYPTO' | 'US MARKETS';

const MARKETS: Record<MarketCategory, StockSymbol[]> = {
  'NIFTY 50': [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.' },
    { symbol: 'INFY', name: 'Infosys Ltd.' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.' }, 
  ],
  'FOREX': [
    { symbol: 'EURUSD', name: 'Euro / US Dollar' },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar' },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen' },
  ],
  'CRYPTO': [
    { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar' },
    { symbol: 'ETHUSD', name: 'Ethereum / US Dollar' },
    { symbol: 'SOLUSD', name: 'Solana / US Dollar' },
    { symbol: 'DOGEUSD', name: 'Dogecoin / US Dollar' },
  ],
  'US MARKETS': [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
  ]
};

const App: React.FC = () => {
  const { user, loading: authLoading, logout, userData, saveUserData } = useAuth();
  const [activeMarket, setActiveMarket] = useState<MarketCategory>('NIFTY 50');
  
  const [symbol, setSymbol] = useState<StockSymbol>(
      MARKETS['NIFTY 50'].find(s => s.symbol === 'ASIANPAINT') || MARKETS['NIFTY 50'][0]
  );
  
  const [data, setData] = useState<OHLCData[]>([]);
  
  // App state initialized from userData if available, else defaults
  const [balance, setBalance] = useState<number>(100000);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  // State Synchronization with Persistent Storage
  useEffect(() => {
      if (userData) {
          setBalance(userData.balance);
          setPositions(userData.positions || []);
          setTradeHistory(userData.history || []);
          setDrawings(userData.drawings || []);
      }
  }, [userData]);

  // Persist State Changes
  const persistState = useCallback(() => {
      if (user) {
          saveUserData({
              balance,
              positions,
              history: tradeHistory,
              drawings
          });
      }
  }, [balance, positions, tradeHistory, drawings, user, saveUserData]);

  // Save when important things change
  useEffect(() => {
      const timeout = setTimeout(persistState, 1000); // Debounce saves
      return () => clearTimeout(timeout);
  }, [balance, positions, tradeHistory, drawings, persistState]);

  const [metrics, setMetrics] = useState<ModelMetric[]>([]);
  const [isTrainingModels, setIsTrainingModels] = useState(false); // Training Simulation State
  const [mobileTab, setMobileTab] = useState<'chart' | 'analysis' | 'trade'>('chart');
  const [isSymbolOpen, setIsSymbolOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState<SentimentAnalysisResult | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  
  // Theme & Settings
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Resizable Panel State
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: 'candle',
    timeframe: Timeframe.W1, 
    showVolume: true,
    showPredictions: true,
    activeTool: 'cursor',
    drawingColor: '#2962ff',
    predictionHorizon: '1D',
    activeIndicators: [
        { id: '1', type: 'SMA', period: 50, color: '#ff9800', visible: true }
    ]
  });

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // --- DATA STREAM HANDLING ---
  useEffect(() => {
    if (!user) return;
    
    setMarketStatus(isMarketOpen(activeMarket) ? 'OPEN' : 'CLOSED');
    setSentiment(null);

    // Trigger Model Retraining Simulation when Symbol or Timeframe changes
    setIsTrainingModels(true);

    const handleStreamUpdate = (candle: OHLCData, isNew: boolean) => {
        setData(prev => {
            if (isNew) {
                const newData = [...prev.slice(1), candle];
                // Only update metrics if NOT in training mode (training finishes via timeout below)
                if (!isTrainingModels) {
                    setMetrics(getModelMetrics(symbol.symbol, newData, chartConfig.timeframe));
                }
                return newData;
            } else {
                const newData = [...prev];
                newData[newData.length - 1] = candle;
                return newData;
            }
        });
    };

    const initialHistory = streamService.subscribe(
        symbol.symbol, 
        activeMarket, 
        chartConfig.timeframe, 
        handleStreamUpdate
    );

    setData(initialHistory);

    // Simulate 5-Year Retraining Delay
    const trainingTime = Math.random() * 800 + 1200; // 1.2s - 2s
    const trainingTimeout = setTimeout(() => {
        setMetrics(getModelMetrics(symbol.symbol, initialHistory, chartConfig.timeframe));
        setIsTrainingModels(false);
    }, trainingTime);

    return () => {
        streamService.unsubscribe(handleStreamUpdate);
        clearTimeout(trainingTimeout);
    };
  }, [symbol, activeMarket, chartConfig.timeframe, user]);

  useEffect(() => {
      if (positions.length === 0 || data.length === 0) return;
      const currentPrice = data[data.length - 1].close;

      positions.forEach(pos => {
          if (pos.symbol === symbol.symbol) {
              let closeReason = null;
              if (pos.type === PositionType.BUY) {
                  if (pos.stopLoss && currentPrice <= pos.stopLoss) closeReason = 'Stop Loss';
                  else if (pos.takeProfit && currentPrice >= pos.takeProfit) closeReason = 'Take Profit';
              } else {
                  if (pos.stopLoss && currentPrice >= pos.stopLoss) closeReason = 'Stop Loss';
                  else if (pos.takeProfit && currentPrice <= pos.takeProfit) closeReason = 'Take Profit';
              }

              if (closeReason) {
                  handleClosePosition(pos.id);
                  setSystemMessage(`${closeReason} Hit for ${pos.symbol} @ ${currentPrice.toFixed(2)}`);
                  setTimeout(() => setSystemMessage(null), 4000);
              }
          }
      });
  }, [data, positions]);

  // --- RESIZING LOGIC ---
  const startResizingRight = useCallback(() => setIsResizingRight(true), []);
  const startResizingBottom = useCallback(() => setIsResizingBottom(true), []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) {
        const newWidth = window.innerWidth - e.clientX;
        const maxWidth = window.innerWidth * 0.8;
        setRightPanelWidth(Math.max(250, Math.min(maxWidth, newWidth)));
      }
      if (isResizingBottom) {
        // Calculate height from bottom
        const newHeight = window.innerHeight - e.clientY;
        // Allows resizing between 40px and Window Height - 60px (leaving space for header)
        const maxHeight = window.innerHeight - 60;
        setBottomPanelHeight(Math.max(40, Math.min(maxHeight, newHeight)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      setIsResizingBottom(false);
    };

    if (isResizingRight || isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingRight ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none'; 
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingRight, isResizingBottom]);


  if (authLoading) return <div className="h-screen w-screen bg-trade-bg flex items-center justify-center"><Loader2 className="w-10 h-10 text-trade-accent animate-spin" /></div>;
  if (!user) return <LoginScreen />;

  const handlePlaceOrder = (type: 'Buy' | 'Sell', qty: number, orderType: OrderType, limitPrice?: number, sl?: number, tp?: number): { success: boolean, message: string } => {
    if (data.length === 0) return { success: false, message: "Waiting for market data..." };

    if (marketStatus === 'CLOSED' && activeMarket !== 'CRYPTO') {
        return { success: false, message: "Market is closed." };
    }

    if (qty <= 0) return { success: false, message: "Quantity must be greater than 0" };

    const currentPrice = data[data.length - 1].close;
    let executionPrice = currentPrice;

    if (orderType === OrderType.LIMIT && limitPrice && limitPrice > 0) {
        // For Buy: limit price should be <= current price (buyer waits for better price)
        // For Sell: limit price should be >= current price (seller waits for better price)
        if (type === 'Buy' && limitPrice > currentPrice) {
            return { success: false, message: `Buy limit price must be ≤ current price (₹${currentPrice.toFixed(2)})` };
        }
        if (type === 'Sell' && limitPrice < currentPrice) {
            return { success: false, message: `Sell limit price must be ≥ current price (₹${currentPrice.toFixed(2)})` };
        }
        executionPrice = limitPrice;
    } else if (orderType === OrderType.LIMIT) {
        return { success: false, message: "Invalid limit price" };
    }

    const total = executionPrice * qty;
    if (type === 'Buy' && balance < total) return { success: false, message: `Insufficient balance (Required: ₹${total.toLocaleString()})` }; 
    
    if (type === 'Buy') setBalance(prev => prev - total);
    else setBalance(prev => prev + total);
    
    const newPos: Position = {
        id: Date.now().toString(),
        symbol: symbol.symbol,
        type: type === 'Buy' ? PositionType.BUY : PositionType.SELL,
        entryPrice: executionPrice,
        quantity: qty,
        stopLoss: sl,
        takeProfit: tp,
        timestamp: Date.now()
    };
    
    setPositions(prev => [newPos, ...prev]);
    return { success: true, message: `Order executed: ${type} ${qty} ${symbol.symbol} @ ${executionPrice.toFixed(2)}` };
  };

  const handleClosePosition = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    
    let closePrice = pos.entryPrice; 
    
    if (pos.symbol === symbol.symbol && data.length > 0) {
        closePrice = data[data.length - 1].close;
    } else {
        closePrice = getSnapshotPrice(pos.symbol);
    }

    let pnl = 0;
    if (pos.type === PositionType.BUY) {
        pnl = (closePrice - pos.entryPrice) * pos.quantity;
    } else {
        pnl = (pos.entryPrice - closePrice) * pos.quantity;
    }

    // For Buy: we get back (closePrice * qty). For Sell: we already collected entry, now we pay closePrice
    if (pos.type === PositionType.BUY) {
        setBalance(prev => prev + closePrice * pos.quantity);
    } else {
        setBalance(prev => prev - closePrice * pos.quantity);
    } 
    
    const trade: Trade = {
        id: Date.now().toString(),
        symbol: pos.symbol,
        type: pos.type,
        entryPrice: pos.entryPrice,
        exitPrice: closePrice,
        quantity: pos.quantity,
        pnl: pnl,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        timestamp: Date.now()
    };
    
    setTradeHistory(prev => [trade, ...prev]);
    setPositions(prev => prev.filter(p => p.id !== id));
  };

  const handleCloseAllPositions = () => {
     const allPositions = [...positions];
     allPositions.forEach(pos => handleClosePosition(pos.id));
     setSystemMessage("All positions closed.");
     setTimeout(() => setSystemMessage(null), 3000);
  };

  const handleAnalyzeSentiment = async () => {
    if (loadingSentiment) return;
    setLoadingSentiment(true);
    const result = await analyzeStockSentiment(symbol.symbol);
    setSentiment(result);
    setLoadingSentiment(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-trade-bg text-trade-text overflow-hidden font-sans relative">
      
      <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          theme={theme}
          setTheme={setTheme}
      />

      {systemMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2962ff] text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
              <BellRing className="w-5 h-5 animate-pulse" />
              <span className="font-bold">{systemMessage}</span>
          </div>
      )}

      <header className="h-14 bg-trade-panel border-b border-trade-border flex items-center justify-between px-3 md:px-4 shrink-0 z-[100] relative">
        <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 text-trade-accent font-bold text-lg tracking-tight">
                <Binary className="w-6 h-6" />
                <span className="hidden md:inline">TradeMind AI</span>
            </div>
            <div className="h-6 w-px bg-trade-border mx-2 hidden md:block"></div>
            
            <div className="relative z-50">
                <button onClick={() => setIsSymbolOpen(!isSymbolOpen)} className="flex items-center gap-2 text-trade-text font-bold hover:bg-trade-panel-focus px-3 py-1.5 rounded transition">
                    {symbol.symbol} <ChevronDown className="w-3 h-3 text-trade-text-muted" />
                </button>
                {isSymbolOpen && (
                    <>
                        <div className="fixed inset-0" onClick={() => setIsSymbolOpen(false)}></div>
                        <div className="absolute top-full left-0 mt-1 w-96 max-h-96 bg-trade-panel border border-trade-border shadow-xl rounded py-1 flex overflow-hidden">
                            <div className="w-32 bg-trade-panel-focus border-r border-trade-border flex flex-col">
                                {Object.keys(MARKETS).map(market => {
                                    const m = market as MarketCategory;
                                    let Icon = TrendingUp;
                                    if(m === 'FOREX') Icon = Globe;
                                    if(m === 'CRYPTO') Icon = Bitcoin;
                                    if(m === 'US MARKETS') Icon = DollarSign;

                                    return (
                                        <button 
                                            key={market}
                                            onClick={() => setActiveMarket(m)}
                                            className={`px-3 py-3 text-xs font-bold text-left transition-colors flex items-center gap-2 ${activeMarket === market ? 'bg-trade-panel text-trade-accent border-l-2 border-trade-accent' : 'text-trade-text-muted hover:text-trade-text'}`}
                                        >
                                            <Icon className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{market}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-trade-panel">
                                {MARKETS[activeMarket].map(s => (
                                    <div key={s.symbol} onClick={() => { setSymbol(s); setIsSymbolOpen(false); }} className="px-4 py-2 hover:bg-trade-panel-focus cursor-pointer text-sm text-trade-text-muted hover:text-trade-text border-b border-trade-border last:border-0">
                                        <div className="font-bold text-trade-text">{s.symbol}</div>
                                        <div className="text-xs text-trade-text-muted truncate">{s.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="relative group ml-4 z-40">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-trade-bg border border-trade-border text-xs font-bold text-trade-text-muted hover:text-trade-text hover:border-trade-text-muted transition-colors">
                    {chartConfig.timeframe} <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-40 bg-trade-panel border border-trade-border rounded shadow-xl hidden group-hover:block max-h-80 overflow-y-auto custom-scrollbar">
                    {Object.values(Timeframe).map(tf => {
                         const config = getTimeframeConfig(tf);
                         return (
                            <button 
                                key={tf}
                                onClick={() => setChartConfig(p => ({...p, timeframe: tf}))}
                                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-trade-panel-focus border-l-2 ${chartConfig.timeframe === tf ? 'border-trade-accent text-trade-text bg-trade-panel-focus' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
                            >
                                <span className="font-bold mr-2">{tf}</span>
                                <span className="opacity-50 text-[10px]">{config.name}</span>
                            </button>
                         );
                    })}
                </div>
            </div>
            
            <button 
                onClick={() => setIsIndicatorsOpen(!isIndicatorsOpen)}
                className={`ml-2 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-2 ${isIndicatorsOpen ? 'bg-trade-accent text-white' : 'text-trade-text-muted hover:text-trade-text bg-trade-panel border border-trade-border'}`}
            >
                <Filter className="w-3 h-3" /> Indicators
            </button>
            {isIndicatorsOpen && (
                <IndicatorSelector config={chartConfig} onChange={(newConfig) => setChartConfig(p => ({...p, ...newConfig}))} onClose={() => setIsIndicatorsOpen(false)} />
            )}
        </div>

        <div className="flex items-center gap-3">
            <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold ${marketStatus === 'OPEN' ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'}`}>
                <Clock className="w-3 h-3" />
                <span>{marketStatus === 'OPEN' ? 'MARKET OPEN' : 'MARKET CLOSED'}</span>
            </div>

            <button 
                onClick={() => setChartConfig(p => ({...p, showPredictions: !p.showPredictions}))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition ${chartConfig.showPredictions ? 'bg-purple-900/40 text-purple-400 border border-purple-500/40' : 'text-trade-text-muted border border-trade-border'}`}
            >
                <Brain className="w-3 h-3" /> AI Predictions
            </button>
            
             <div className="flex items-center gap-2 bg-trade-panel px-3 py-1.5 rounded border border-trade-border">
                <span className="text-xs text-trade-text-muted">DEMO</span>
                <span className="text-sm font-mono text-trade-text font-bold">₹{balance.toLocaleString()}</span>
            </div>
            
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-trade-text-muted hover:text-trade-text transition-colors">
                <Settings className="w-5 h-5" />
            </button>

            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-transparent hover:ring-white transition">
                {user.name.substring(0, 2).toUpperCase()}
            </button>
             {isProfileOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                    <div className="absolute top-14 right-4 w-56 bg-trade-panel border border-trade-border rounded shadow-xl z-50">
                        <div className="p-4 border-b border-trade-border"><p className="text-trade-text font-bold truncate">{user.name}</p><p className="text-trade-text-muted text-xs truncate">{user.email}</p></div>
                        <button onClick={logout} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-trade-panel-focus flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign Out</button>
                    </div>
                </>
            )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          
          <div className="w-12 bg-trade-panel border-r border-trade-border flex flex-col items-center py-4 gap-2 shrink-0 z-10">
              <button onClick={() => setChartConfig(p => ({...p, activeTool: 'cursor'}))} className={`p-2 rounded transition ${chartConfig.activeTool === 'cursor' ? 'text-trade-accent bg-trade-panel-focus' : 'text-trade-text-muted hover:text-trade-text'}`} title="Cursor"><MousePointer className="w-5 h-5" /></button>
              <div className="w-6 h-px bg-trade-border my-1"></div>
              <button onClick={() => setChartConfig(p => ({...p, activeTool: 'line'}))} className={`p-2 rounded transition ${chartConfig.activeTool === 'line' ? 'text-trade-accent bg-trade-panel-focus' : 'text-trade-text-muted hover:text-trade-text'}`} title="Trend Line"><PenTool className="w-5 h-5" /></button>
              <button onClick={() => setChartConfig(p => ({...p, activeTool: 'horizontal'}))} className={`p-2 rounded transition ${chartConfig.activeTool === 'horizontal' ? 'text-trade-accent bg-trade-panel-focus' : 'text-trade-text-muted hover:text-trade-text'}`} title="Horizontal Line"><Minus className="w-5 h-5" /></button>
              <button onClick={() => setChartConfig(p => ({...p, activeTool: 'rect'}))} className={`p-2 rounded transition ${chartConfig.activeTool === 'rect' ? 'text-trade-accent bg-trade-panel-focus' : 'text-trade-text-muted hover:text-trade-text'}`} title="Rectangle"><Square className="w-5 h-5" /></button>
              <div className="mt-auto">
                 <button onClick={() => setDrawings([])} className="p-2 text-trade-text-muted hover:text-red-400 transition-colors" title="Clear All Drawings"><Trash2 className="w-5 h-5" /></button>
              </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
             {/* CENTER COLUMN (Chart + Analysis) */}
             <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${mobileTab === 'trade' ? 'hidden md:flex' : 'flex'}`}>
                 <div className={`relative border-b border-trade-border flex-col min-h-0 ${mobileTab === 'analysis' ? 'hidden md:flex' : 'flex'} flex-1`}>
                      <div className="flex-1 min-h-0 bg-trade-bg relative">
                         <TradingChart 
                            data={data} 
                            config={chartConfig} 
                            symbol={symbol.symbol}
                            positions={positions} 
                            drawings={drawings}
                            onAddDrawing={(d) => setDrawings(prev => [...prev, d])}
                            onRemoveDrawing={(id) => setDrawings(prev => prev.filter(d => d.id !== id))} 
                            onChartTypeChange={(type) => setChartConfig(prev => ({ ...prev, chartType: type }))}
                            theme={theme}
                         />
                      </div>
                 </div>

                 {/* Horizontal Resizer (Desktop) */}
                 <div 
                    className="hidden md:flex h-2 bg-trade-bg hover:bg-trade-accent cursor-row-resize items-center justify-center z-50 shrink-0 transition-colors border-t border-b border-trade-border"
                    onMouseDown={startResizingBottom}
                 >
                     <GripHorizontal className="w-4 h-4 text-trade-text-muted opacity-50" />
                 </div>

                 <div 
                    className={`shrink-0 bg-trade-bg ${mobileTab === 'analysis' ? 'flex-1 h-full' : 'hidden md:block'}`}
                    style={{ height: mobileTab === 'analysis' ? '100%' : `${bottomPanelHeight}px` }}
                 >
                    <MLPanel 
                        metrics={metrics} 
                        sentiment={sentiment} 
                        loadingSentiment={loadingSentiment} 
                        onAnalyzeSentiment={handleAnalyzeSentiment}
                        data={data}
                        symbol={symbol.symbol}
                        activeIndicators={chartConfig.activeIndicators}
                        isTraining={isTrainingModels} // New Prop
                        timeframe={chartConfig.timeframe} // New Prop
                    />
                 </div>
             </div>

             {/* Vertical Resizer (Desktop) */}
             <div 
                className="hidden md:flex w-2 bg-trade-bg hover:bg-trade-accent cursor-col-resize items-center justify-center z-50 shrink-0 transition-colors border-l border-r border-trade-border"
                onMouseDown={startResizingRight}
            >
                <GripVertical className="w-4 h-4 text-trade-text-muted opacity-50" />
            </div>

             {/* RIGHT COLUMN (Order Panel) */}
             <div 
                className={`bg-trade-panel shrink-0 ${mobileTab === 'trade' ? 'flex flex-1 w-full' : 'hidden md:flex'}`}
                style={{ width: mobileTab === 'trade' ? '100%' : `${rightPanelWidth}px` }}
             >
                <OrderPanel 
                    symbol={symbol.symbol}
                    currentPrice={data && data.length > 0 ? data[data.length-1].close : 0} 
                    balance={balance} 
                    positions={positions} 
                    history={tradeHistory}
                    onPlaceOrder={handlePlaceOrder} 
                    onClosePosition={handleClosePosition}
                    onCloseAllPositions={handleCloseAllPositions}
                />
             </div>
          </div>
      </div>

      <div className="md:hidden h-16 bg-trade-panel border-t border-trade-border flex justify-around items-center shrink-0 z-30 pb-safe">
          <button onClick={() => setMobileTab('chart')} className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'chart' ? 'text-trade-accent' : 'text-trade-text-muted'}`}><Activity className="w-6 h-6" /><span className="text-[10px]">Chart</span></button>
          <button onClick={() => setMobileTab('analysis')} className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'analysis' ? 'text-trade-accent' : 'text-trade-text-muted'}`}><Brain className="w-6 h-6" /><span className="text-[10px]">Analysis</span></button>
          <button onClick={() => setMobileTab('trade')} className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'trade' ? 'text-trade-accent' : 'text-trade-text-muted'}`}><DollarSign className="w-6 h-6" /><span className="text-[10px]">Trade</span></button>
      </div>
    </div>
  );
};

export default App;