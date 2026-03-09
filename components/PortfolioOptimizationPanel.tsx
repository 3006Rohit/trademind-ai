import React, { useState } from 'react';
import { Activity, Brain, PieChart, TrendingUp, ShieldAlert, Sliders } from 'lucide-react';

interface PortfolioOptimizationPanelProps {
  balance: number;
}

const PortfolioOptimizationPanel: React.FC<PortfolioOptimizationPanelProps> = ({ balance }) => {
  const [activeStrategy, setActiveStrategy] = useState<'MVO' | 'HRP' | 'BL'>('HRP');
  const [riskAversion, setRiskAversion] = useState<number>(5);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedWeights, setOptimizedWeights] = useState<{ symbol: string; weight: number }[] | null>(null);

  const handleOptimization = () => {
    setIsOptimizing(true);
    // Simulate backend optimization call
    setTimeout(() => {
      const mockResult = [
        { symbol: 'AAPL', weight: 0.25 },
        { symbol: 'MSFT', weight: 0.20 },
        { symbol: 'GOOGL', weight: 0.15 },
        { symbol: 'BTCUSD', weight: 0.10 },
        { symbol: 'RELIANCE', weight: 0.30 },
      ];
      setOptimizedWeights(mockResult);
      setIsOptimizing(false);
    }, 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full overflow-hidden text-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-slate-100">Quant Portfolio Optimization</h2>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4" /> CDaR Protected
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {/* Strategy Selector */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-medium ml-1">Optimization Engine</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'MVO', label: 'Mean-Variance', tooltip: 'Classic Markowitz Optimization' },
              { id: 'HRP', label: 'Hierarchical Risk Parity', tooltip: 'Unsupervised ML clustering' },
              { id: 'BL', label: 'Black-Litterman', tooltip: 'Bayesian views + Market Equilibrium' }
            ].map(strategy => (
              <button
                key={strategy.id}
                onClick={() => setActiveStrategy(strategy.id as any)}
                title={strategy.tooltip}
                className={`py-2 px-1 text-xs text-center rounded-md border transition-all ${
                  activeStrategy === strategy.id 
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                }`}
              >
                {strategy.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="bg-slate-800/50 p-3 rounded-md border border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5"/> Risk Aversion (λ)</span>
            <span className="text-indigo-400 font-mono">{riskAversion}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={riskAversion} 
            onChange={e => setRiskAversion(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Aggressive (Kelly)</span>
            <span>Conservative (Min Vol)</span>
          </div>
        </div>

        {/* Features Toggle */}
        <div className="grid grid-cols-2 gap-2 text-xs">
           <div className="bg-slate-800/40 p-2 rounded flex items-start gap-2 border border-slate-700/30">
             <input type="checkbox" defaultChecked className="mt-0.5" />
             <div>
               <p className="text-slate-200">Ledoit-Wolf Shrinkage</p>
               <p className="text-[10px] text-slate-500 mt-0.5">Denoise Covariance</p>
             </div>
           </div>
           <div className="bg-slate-800/40 p-2 rounded flex items-start gap-2 border border-slate-700/30">
             <input type="checkbox" defaultChecked className="mt-0.5" />
             <div>
               <p className="text-slate-200">Transaction Costs</p>
               <p className="text-[10px] text-slate-500 mt-0.5">L1 Penalty</p>
             </div>
           </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={handleOptimization}
          disabled={isOptimizing}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isOptimizing ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Synthesizing Portfolio...</>
          ) : (
            <><PieChart className="w-4 h-4" /> Generate Maximum-Profit Portfolio</>
          )}
        </button>

        {/* Results */}
        {optimizedWeights && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Optimal Allocation
            </h3>
            <div className="space-y-2">
              {optimizedWeights.map(item => (
                <div key={item.symbol} className="bg-slate-800 p-2 rounded border border-slate-700 flex items-center justify-between">
                  <span className="font-mono text-slate-200">{item.symbol}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.weight * 100}%` }} />
                    </div>
                    <span className="text-emerald-400 font-mono text-xs w-10 text-right">
                      {(item.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded text-xs text-emerald-200/80">
              Expected Annual Return: <span className="text-emerald-400 font-mono ml-1">18.4%</span> | 
              Target Volatility: <span className="text-rose-400 font-mono ml-1">12.1%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioOptimizationPanel;
