
import React, { useState, useEffect } from 'react';
import { ModelMetric, SentimentAnalysisResult, OHLCData, MarketReport, FundamentalsReport, Indicator, Timeframe } from '../types';
import { generateMarketReport, generateFundamentalsReport } from '../services/aiService';
import { getTechnicalSignals, calculateTrainingDataSize } from '../services/dataService';
import { Brain, TrendingUp, Activity, ExternalLink, RefreshCw, Newspaper, Gauge, BarChart as BarChartIcon, FileText, CheckCircle, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Minus, Microscope, Sparkles, Globe, Scale, BookOpen, Zap, Database, Server, Split } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface MLPanelProps {
  metrics: ModelMetric[];
  sentiment: SentimentAnalysisResult | null;
  loadingSentiment: boolean;
  onAnalyzeSentiment: () => void;
  data: OHLCData[]; 
  symbol: string;
  activeIndicators: Indicator[];
  isTraining?: boolean;
  timeframe?: Timeframe;
}

const MLPanel: React.FC<MLPanelProps> = ({ metrics, sentiment, loadingSentiment, onAnalyzeSentiment, data, symbol, activeIndicators, isTraining = false, timeframe = Timeframe.M1 }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'news' | 'report' | 'fundamentals' | 'signals'>('overview');
  
  // State for Deep Dive Report
  const [report, setReport] = useState<MarketReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // State for Fundamentals
  const [fundamentals, setFundamentals] = useState<FundamentalsReport | null>(null);
  const [loadingFundamentals, setLoadingFundamentals] = useState(false);

  // Training Simulation State
  const [trainingStep, setTrainingStep] = useState(0);

  useEffect(() => {
    if (isTraining) {
        setTrainingStep(0);
        const interval = setInterval(() => {
            setTrainingStep(prev => (prev < 3 ? prev + 1 : 3));
        }, 400); // Progress every 400ms
        return () => clearInterval(interval);
    }
  }, [isTraining]);

  const handleGenerateReport = async () => {
      if (loadingReport) return;
      setLoadingReport(true);
      const result = await generateMarketReport(symbol, data);
      setReport(result);
      setLoadingReport(false);
  };

  const handleGetFundamentals = async () => {
    if (loadingFundamentals) return;
    setLoadingFundamentals(true);
    const result = await generateFundamentalsReport(symbol, []);
    setFundamentals(result);
    setLoadingFundamentals(false);
  };

  const bestModel = metrics.length > 0 ? metrics.reduce((prev, current) => (current.r2 > prev.r2 ? current : prev)) : null;
  const technicalSignals = getTechnicalSignals(data, activeIndicators);
  const trainingSize = timeframe ? calculateTrainingDataSize(timeframe) : 0;

  const getRecommendationStyle = (rec: string) => {
      if (rec === 'Strong Buy') return { icon: ChevronsUp, color: 'text-trade-up', bg: 'bg-trade-up/20' };
      if (rec === 'Buy') return { icon: ArrowUp, color: 'text-trade-up', bg: 'bg-trade-up/20' };
      if (rec === 'Strong Sell') return { icon: ChevronsDown, color: 'text-trade-down', bg: 'bg-trade-down/20' };
      if (rec === 'Sell') return { icon: ArrowDown, color: 'text-trade-down', bg: 'bg-trade-down/20' };
      return { icon: Minus, color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
  };

  const RecommendationBadge = ({ rec }: { rec: string }) => {
      const style = getRecommendationStyle(rec);
      const Icon = style.icon;
      return (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-bold text-[10px] justify-center w-fit mx-auto ${style.bg} ${style.color}`}>
              <Icon className="w-3 h-3" />
              <span>{rec}</span>
          </div>
      );
  };

  const SignalBadge = ({ signal }: { signal: 'Buy' | 'Sell' | 'Neutral' }) => {
      let color = 'bg-gray-700 text-gray-300';
      if (signal === 'Buy') color = 'bg-trade-up/20 text-trade-up border-trade-up/50';
      if (signal === 'Sell') color = 'bg-trade-down/20 text-trade-down border-trade-down/50';
      
      return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${color}`}>
              {signal}
          </span>
      );
  };

  // --- TRAINING OVERLAY ---
  if (isTraining) {
      const steps = [
          "Fetching 5-Year Historical Data...",
          `Splitting ${trainingSize.toLocaleString()} samples (80% Train / 20% Test)...`,
          "Retraining LSTM, RNN, XGBoost on new split...",
          "Finalizing Ensemble Weights..."
      ];

      return (
        <div className="h-full flex flex-col items-center justify-center bg-trade-panel border-t border-trade-border p-6 text-center space-y-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-trade-accent/30 border-t-trade-accent rounded-full animate-spin"></div>
                <Database className="w-6 h-6 text-trade-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-trade-text mb-2">Optimizing Models</h3>
                <div className="text-trade-text-muted text-sm font-mono bg-trade-bg px-4 py-2 rounded border border-trade-border min-w-[300px]">
                    {steps[trainingStep] || steps[3]}
                </div>
            </div>
            <div className="flex gap-4 text-xs text-trade-text-muted">
                <div className="flex items-center gap-1"><Server className="w-3 h-3"/> {timeframe} timeframe</div>
                <div className="flex items-center gap-1"><Split className="w-3 h-3"/> 5Y Depth</div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-trade-panel border-t border-trade-border">
      <div className="flex items-center justify-between px-2 border-b border-trade-border bg-trade-panel-focus shrink-0 overflow-x-auto">
        <div className="flex whitespace-nowrap">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-trade-accent text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <Brain className="w-4 h-4" /> Overview
            </button>
            <button 
                onClick={() => setActiveTab('signals')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'signals' ? 'border-trade-accent text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <Zap className="w-4 h-4" /> Signals
            </button>
            <button 
                onClick={() => setActiveTab('comparison')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'comparison' ? 'border-trade-accent text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <BarChartIcon className="w-4 h-4" /> Models
            </button>
            <button 
                onClick={() => setActiveTab('news')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'news' ? 'border-trade-accent text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <Newspaper className="w-4 h-4" /> Sentiment
            </button>
            <button 
                onClick={() => setActiveTab('fundamentals')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'fundamentals' ? 'border-trade-accent text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <Scale className="w-4 h-4" /> Fundamentals
            </button>
            <button 
                onClick={() => setActiveTab('report')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'report' ? 'border-purple-500 text-trade-text' : 'border-transparent text-trade-text-muted hover:text-trade-text'}`}
            >
                <Microscope className="w-4 h-4 text-purple-400" /> Deep Dive
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-trade-bg">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && bestModel && (
            <div className="space-y-6">
                {/* Best Model Highlight */}
                <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-trade-accent/30 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-2 text-trade-accent mb-1">
                             <CheckCircle className="w-5 h-5" />
                             <span className="font-bold uppercase tracking-wider text-xs">Recommended Strategy</span>
                         </div>
                         <h2 className="text-2xl font-bold text-trade-text">Best Model: {bestModel.name}</h2>
                         <p className="text-trade-text-muted text-sm max-w-md leading-relaxed">
                            Trained on <span className="text-trade-text font-bold">{trainingSize.toLocaleString()} samples</span> (5 Years). 
                            The {bestModel.type} model currently outperforms other models (incl. ARIMA, AdaBoost) with an R² of {bestModel.r2} and <span className="text-green-400 font-bold">{(bestModel.r2 * 100).toFixed(1)}% confidence</span>.
                         </p>
                    </div>
                    <div className="flex items-center gap-8">
                         {bestModel.nextPrice && (
                            <div className="text-center">
                                <div className="text-3xl font-bold text-trade-accent font-mono">{bestModel.nextPrice.toFixed(2)}</div>
                                <div className="text-xs text-trade-text-muted uppercase font-bold tracking-wide">{bestModel.forecastLabel || 'Next Period Forecast'}</div>
                            </div>
                        )}
                        <div className="text-center">
                            {(() => {
                                 const style = getRecommendationStyle(bestModel.recommendation);
                                 const Icon = style.icon;
                                 return (
                                     <div className={`flex items-center gap-2 text-2xl font-bold ${style.color}`}>
                                         <Icon className="w-6 h-6" />
                                         {bestModel.recommendation}
                                     </div>
                                 );
                             })()}
                            <div className="text-xs text-trade-text-muted uppercase font-bold tracking-wide">Action</div>
                        </div>
                    </div>
                </div>

                {/* Performance Grid */}
                <div>
                    <h3 className="text-trade-text font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Real-time Performance Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {metrics.slice(0, 4).map(m => (
                            <div key={m.name} className="bg-trade-panel p-4 rounded border-l-4 border-trade-border" style={{ borderLeftColor: m.color }}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-trade-text truncate" title={m.name}>{m.name.split('(')[0]}</span>
                                    <div className="scale-90 origin-top-right">
                                        <RecommendationBadge rec={m.recommendation} />
                                    </div>
                                </div>
                                <span className="text-[10px] text-trade-text-muted block mb-2">{m.type}</span>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-trade-text-muted">Forecast</span>
                                        <span className="text-trade-text font-mono">{m.nextPrice?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-trade-text-muted">Confidence</span>
                                        <span className={`font-mono ${(m.r2 * 100) >= 80 ? 'text-green-400' : 'text-blue-400'}`}>
                                            {(m.r2 * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-trade-text-muted">RMSE</span>
                                        <span className="text-trade-text-muted">${m.rmse}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* SIGNALS TAB */}
        {activeTab === 'signals' && (
            <div className="space-y-6">
                 {technicalSignals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-trade-text-muted border-2 border-dashed border-trade-border rounded-lg">
                        <Activity className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No active indicators applied to the chart.</p>
                        <p className="text-xs">Add indicators from the header to see real-time signals.</p>
                    </div>
                 ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {technicalSignals.map((sig, idx) => (
                                <div key={idx} className="bg-trade-panel p-4 rounded border border-trade-border flex items-center justify-between group hover:bg-trade-panel-focus transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-trade-text">{sig.indicatorType}</span>
                                            <span className="text-xs font-mono text-trade-text-muted">Value: {sig.value}</span>
                                        </div>
                                        <div className="text-xs text-trade-text-muted">{sig.reason}</div>
                                    </div>
                                    <SignalBadge signal={sig.signal} />
                                </div>
                            ))}
                        </div>

                        {/* Summary Widget */}
                        <div className="bg-trade-panel p-5 rounded border border-trade-border mt-4">
                            <h4 className="text-sm font-bold text-trade-text mb-4 uppercase tracking-wider">Technical Summary</h4>
                            <div className="flex items-center justify-around">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-trade-up">{technicalSignals.filter(s => s.signal === 'Buy').length}</div>
                                    <div className="text-[10px] text-trade-text-muted uppercase">Buy Signals</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-trade-text-muted">{technicalSignals.filter(s => s.signal === 'Neutral').length}</div>
                                    <div className="text-[10px] text-trade-text-muted uppercase">Neutral</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-trade-down">{technicalSignals.filter(s => s.signal === 'Sell').length}</div>
                                    <div className="text-[10px] text-trade-text-muted uppercase">Sell Signals</div>
                                </div>
                            </div>
                            
                            {/* Overall Meter */}
                            <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden flex">
                                <div className="bg-trade-up transition-all duration-500" style={{ width: `${(technicalSignals.filter(s => s.signal === 'Buy').length / technicalSignals.length) * 100}%` }}></div>
                                <div className="bg-gray-500 transition-all duration-500" style={{ width: `${(technicalSignals.filter(s => s.signal === 'Neutral').length / technicalSignals.length) * 100}%` }}></div>
                                <div className="bg-trade-down transition-all duration-500" style={{ width: `${(technicalSignals.filter(s => s.signal === 'Sell').length / technicalSignals.length) * 100}%` }}></div>
                            </div>
                        </div>
                    </>
                 )}
            </div>
        )}

        {/* COMPARISON TAB */}
        {activeTab === 'comparison' && (
            <div className="space-y-6">
                <div className="overflow-x-auto rounded-lg border border-trade-border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-trade-panel text-trade-text-muted uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3">Model Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-right">R² Score</th>
                                <th className="px-4 py-3 text-right">Confidence</th>
                                <th className="px-4 py-3 text-right">Forecast</th>
                                <th className="px-4 py-3 text-right">RMSE ($)</th>
                                <th className="px-4 py-3 text-right">MAE ($)</th>
                                <th className="px-4 py-3 text-center">Rec.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-trade-border bg-trade-bg">
                            {metrics.map(m => (
                                <tr key={m.name} className="hover:bg-trade-panel transition-colors">
                                    <td className="px-4 py-3 font-medium text-trade-text flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: m.color}}></div>
                                        {m.name}
                                    </td>
                                    <td className="px-4 py-3 text-trade-text-muted">{m.type}</td>
                                    <td className="px-4 py-3 text-right font-mono text-trade-text">{m.r2.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-300">{(m.r2 * 100).toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right font-mono text-trade-accent font-bold">{m.nextPrice?.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-trade-text-muted">{m.rmse}</td>
                                    <td className="px-4 py-3 text-right font-mono text-trade-text-muted">{m.mae}</td>
                                    <td className="px-4 py-3 text-center">
                                        <RecommendationBadge rec={m.recommendation} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="bg-trade-panel p-4 rounded border border-trade-border h-96">
                    <h4 className="text-sm font-bold text-trade-text mb-2 flex items-center gap-2">
                        <BarChartIcon className="w-4 h-4 text-trade-accent" />
                        Model Error Analysis (RMSE vs MAE)
                    </h4>
                    <p className="text-xs text-trade-text-muted mb-4">Lower values indicate better model performance. All models trained on 5 Years data.</p>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={metrics} margin={{top: 10, right: 30, left: 0, bottom: 20}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--trade-border)" vertical={false} />
                            <XAxis 
                                dataKey="name" 
                                stroke="var(--trade-text-muted)" 
                                tick={{fontSize: 9, fill: 'var(--trade-text-muted)'}} 
                                interval={0} 
                                angle={-30} 
                                textAnchor="end" 
                                height={60} 
                            />
                            <YAxis 
                                stroke="var(--trade-text-muted)" 
                                tick={{fontSize: 10, fill: 'var(--trade-text-muted)'}} 
                                label={{ value: 'Error ($)', angle: -90, position: 'insideLeft', fill: 'var(--trade-text-muted)', fontSize: 10 }}
                            />
                            <RechartsTooltip 
                                contentStyle={{backgroundColor: 'var(--trade-panel)', borderColor: 'var(--trade-border)', color: 'var(--trade-text)'}} 
                                itemStyle={{color: 'var(--trade-text-muted)'}}
                                cursor={{fill: 'var(--trade-panel-focus)', opacity: 0.5}}
                            />
                            <Legend wrapperStyle={{paddingTop: '10px'}} />
                            <Bar dataKey="rmse" name="RMSE (Root Mean Sq Error)" fill="#f23645" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="mae" name="MAE (Mean Abs Error)" fill="#ff9800" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
        
        {/* ... Rest of tabs (news, fundamentals, report) unchanged ... */}
        {activeTab === 'news' && (
             <div className="flex flex-col h-full min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-trade-text text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-trade-up" />
                        Live Market Sentiment
                    </h4>
                    <button 
                        onClick={onAnalyzeSentiment}
                        disabled={loadingSentiment}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-xs rounded border border-blue-500/30 transition-colors disabled:opacity-50"
                    >
                        {loadingSentiment ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Newspaper className="w-3 h-3" />}
                        {loadingSentiment ? 'Analyzing...' : 'Refresh Analysis'}
                    </button>
                </div>
                
                <div className="flex-1 bg-trade-panel rounded p-4 overflow-y-auto border border-trade-border">
                    {sentiment ? (
                        <>
                            {sentiment.score !== undefined && (
                                <div className="mb-6 bg-trade-bg p-4 rounded border border-trade-border">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex items-center gap-2">
                                            <Gauge className="w-5 h-5 text-trade-text-muted" />
                                            <span className="text-sm text-trade-text font-bold uppercase">Sentiment Score</span>
                                        </div>
                                        <span className={`text-2xl font-bold font-mono ${
                                            sentiment.score >= 60 ? 'text-trade-up' : 
                                            sentiment.score <= 40 ? 'text-trade-down' : 'text-yellow-500'
                                        }`}>
                                            {sentiment.score}/100
                                        </span>
                                    </div>
                                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden w-full relative">
                                        <div 
                                            className={`h-full transition-all duration-1000 absolute top-0 left-0 ${
                                                sentiment.score >= 60 ? 'bg-trade-up' : 
                                                sentiment.score <= 40 ? 'bg-trade-down' : 'bg-yellow-500'
                                            }`}
                                            style={{ width: `${sentiment.score}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <div className="prose prose-invert prose-sm max-w-none">
                                <div className="whitespace-pre-wrap text-trade-text leading-relaxed">{sentiment.text}</div>
                            </div>
                            
                            {sentiment.groundingChunks && sentiment.groundingChunks.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-trade-border">
                                    <h5 className="text-xs font-bold text-trade-text-muted uppercase mb-3">Sources (Google Search)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {sentiment.groundingChunks.map((chunk, idx) => chunk.web ? (
                                            <a 
                                                key={idx} 
                                                href={chunk.web.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 bg-trade-panel-focus rounded hover:bg-trade-border transition group border border-transparent hover:border-trade-text-muted"
                                            >
                                                <ExternalLink className="w-4 h-4 text-trade-accent shrink-0 group-hover:text-trade-text" />
                                                <div className="truncate text-xs text-trade-accent group-hover:text-trade-text group-hover:underline font-medium">
                                                    {chunk.web.title || chunk.web.uri}
                                                </div>
                                            </a>
                                        ) : null)}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-trade-text-muted gap-4">
                            <Newspaper className="w-12 h-12 opacity-20" />
                            <p className="text-center text-sm">Click "Refresh Analysis" to fetch live news and sentiment<br/>grounded by Google Search.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'fundamentals' && (
            <div className="flex flex-col h-full min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-trade-text text-sm font-bold flex items-center gap-2">
                        <Scale className="w-4 h-4 text-trade-accent" />
                        Financial Fundamentals
                    </h4>
                    <button 
                        onClick={handleGetFundamentals}
                        disabled={loadingFundamentals}
                        className="flex items-center gap-2 px-3 py-1 bg-trade-accent/30 hover:bg-trade-accent/50 text-trade-accent text-xs rounded border border-trade-accent/30 transition-colors disabled:opacity-50"
                    >
                        {loadingFundamentals ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />}
                        {loadingFundamentals ? 'Extracting Data...' : 'Analyze Reports'}
                    </button>
                </div>

                <div className="flex-1 bg-trade-panel rounded p-6 overflow-y-auto border border-trade-border">
                    {fundamentals ? (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                            {/* Header */}
                            <div className="flex items-end justify-between border-b border-trade-border pb-2">
                                <div>
                                    <h2 className="text-2xl font-bold text-trade-text tracking-tight">{fundamentals.symbol}</h2>
                                    <p className="text-xs text-trade-text-muted">Fiscal Year: <span className="text-trade-text font-medium">{fundamentals.fiscal_year}</span></p>
                                </div>
                                <div className="text-[10px] text-trade-text-muted font-mono text-right">
                                    Extracted via Gemini 3 Pro <br/>
                                    {new Date(fundamentals.timestamp).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Metrics Metrics Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Gross Profit */}
                                <div className="bg-trade-bg p-5 rounded-lg border border-trade-border hover:border-green-800/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                        <h3 className="text-sm font-bold text-trade-text uppercase tracking-wide">Gross Profit</h3>
                                    </div>
                                    <div className="text-3xl font-mono font-bold text-trade-text mb-2">{fundamentals.gross_profit.value}</div>
                                    <p className="text-xs text-trade-text-muted leading-relaxed">
                                        {fundamentals.gross_profit.context}
                                    </p>
                                </div>

                                {/* Depreciation & Amortization */}
                                <div className="bg-trade-bg p-5 rounded-lg border border-trade-border hover:border-yellow-800/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-5 h-5 text-yellow-500" />
                                        <h3 className="text-sm font-bold text-trade-text uppercase tracking-wide">Depreciation & Amortization</h3>
                                    </div>
                                    <div className="text-3xl font-mono font-bold text-trade-text mb-2">{fundamentals.depreciation_amortization.value}</div>
                                    <p className="text-xs text-trade-text-muted leading-relaxed">
                                        {fundamentals.depreciation_amortization.context}
                                    </p>
                                </div>
                            </div>

                            {/* Summary Section */}
                            <div className="bg-trade-panel-focus p-4 rounded border border-trade-border">
                                <h4 className="text-sm font-bold text-trade-text mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-trade-accent" /> AI Analysis
                                </h4>
                                <p className="text-sm text-trade-text leading-relaxed whitespace-pre-wrap">
                                    {fundamentals.summary}
                                </p>
                            </div>

                            {/* Source Links */}
                            {fundamentals.source_urls.length > 0 && (
                                <div className="pt-2">
                                    <h5 className="text-[10px] uppercase font-bold text-trade-text-muted mb-2">Sources Found</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {fundamentals.source_urls.slice(0, 3).map((url, idx) => (
                                            <a 
                                                key={idx} 
                                                href={url} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-[10px] text-trade-accent hover:underline flex items-center gap-1 bg-blue-900/10 px-2 py-1 rounded"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Source {idx + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-trade-text-muted gap-4">
                            <Scale className="w-16 h-16 opacity-20 text-trade-accent" />
                            <div className="text-center">
                                <h3 className="text-trade-text font-bold mb-1">Financial Report Extraction</h3>
                                <p className="text-sm max-w-xs mx-auto">
                                    Use Gemini 3 Pro to find the latest 10-K filings and extract key metrics like Gross Profit and Depreciation.
                                </p>
                            </div>
                            <button 
                                onClick={handleGetFundamentals}
                                disabled={loadingFundamentals}
                                className="mt-2 px-6 py-2 bg-trade-accent hover:bg-blue-600 text-white font-bold rounded-full transition-all"
                            >
                                {loadingFundamentals ? 'Searching...' : 'Analyze Fundamentals'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'report' && (
            <div className="flex flex-col h-full min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-trade-text text-sm font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Gemini 3 Pro Deep Dive
                    </h4>
                    <button 
                        onClick={handleGenerateReport}
                        disabled={loadingReport}
                        className="flex items-center gap-2 px-3 py-1 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 text-xs rounded border border-purple-500/30 transition-colors disabled:opacity-50"
                    >
                        {loadingReport ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Microscope className="w-3 h-3" />}
                        {loadingReport ? 'Generating Report...' : 'Generate New Report'}
                    </button>
                </div>

                <div className="flex-1 bg-trade-panel rounded p-6 overflow-y-auto border border-trade-border">
                    {report ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            {/* Header / Mood Badge */}
                            <div className="flex items-center justify-between border-b border-trade-border pb-4">
                                <div>
                                    <div className="text-xs text-trade-text-muted uppercase font-bold tracking-wide mb-1">Current Market Mood</div>
                                    <div className={`text-3xl font-bold flex items-center gap-3 ${
                                        report.mood === 'Bullish' ? 'text-trade-up' : 
                                        report.mood === 'Bearish' ? 'text-trade-down' : 'text-yellow-500'
                                    }`}>
                                        {report.mood}
                                        {report.mood === 'Bullish' && <ChevronsUp className="w-8 h-8" />}
                                        {report.mood === 'Bearish' && <ChevronsDown className="w-8 h-8" />}
                                        {report.mood === 'Neutral' && <Minus className="w-8 h-8" />}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-trade-text-muted font-mono">
                                        Generated via Gemini 3 Pro
                                    </div>
                                    <div className="text-[10px] text-trade-text-muted font-mono">
                                        {new Date(report.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            {/* Technical Analysis Section */}
                            <div>
                                <h5 className="text-trade-accent font-bold text-sm mb-2 flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Technical Analysis
                                </h5>
                                <div className="bg-trade-bg p-4 rounded border border-trade-border text-sm text-trade-text leading-relaxed whitespace-pre-wrap">
                                    {report.technical_analysis}
                                </div>
                            </div>

                            {/* Sentiment Analysis Section */}
                            <div>
                                <h5 className="text-purple-400 font-bold text-sm mb-2 flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> Social Sentiment (Search Grounded)
                                </h5>
                                <div className="bg-trade-bg p-4 rounded border border-trade-border text-sm text-trade-text leading-relaxed whitespace-pre-wrap">
                                    {report.sentiment_analysis}
                                </div>
                            </div>

                            {/* Conclusion */}
                            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-4 rounded border border-trade-border">
                                <h5 className="text-trade-text font-bold text-sm mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" /> Verdict
                                </h5>
                                <p className="text-sm text-trade-text italic">
                                    "{report.conclusion}"
                                </p>
                            </div>
                        </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-trade-text-muted gap-4">
                            <Sparkles className="w-16 h-16 opacity-20 text-purple-500" />
                            <div className="text-center">
                                <h3 className="text-trade-text font-bold mb-1">AI-Powered Deep Dive</h3>
                                <p className="text-sm max-w-xs mx-auto">
                                    Use Gemini 3 Pro to perform comprehensive technical pattern recognition and real-time social sentiment analysis.
                                </p>
                            </div>
                            <button 
                                onClick={handleGenerateReport}
                                disabled={loadingReport}
                                className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full transition-all"
                            >
                                {loadingReport ? 'Analyzing...' : 'Start Analysis'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default MLPanel;
