import React, { useState, useMemo, useCallback } from 'react';
import {
  runQuantOptimization,
  computeRiskMetrics,
  simpleReturns,
  OptimizationStrategy,
  QuantOptimizationResult,
  EfficientFrontierPoint,
} from '../services/quantEngine';
import { PortfolioSuggestion, Position, Trade } from '../types';
import {
  PieChart, TrendingUp, ShieldAlert, Activity, Brain,
  BarChart3, Zap, AlertTriangle, ChevronDown, ChevronUp,
  Layers, Target, Percent, DollarSign, ArrowRight, Loader2,
  Info, Shield, TrendingDown
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────

interface PortfolioSuggestionsProps {
  symbols: string[];
  priceMatrix: number[][];         // per-symbol closing price arrays
  balance: number;
  positions: Position[];
  history: Trade[];
  loading: boolean;
  error: string | null;
  /** Legacy suggestion from App.tsx (kept for fallback) */
  legacySuggestion: PortfolioSuggestion | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  color?: string;
}

// ─── Sub-Components ────────────────────────────────────

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, icon, color = 'text-trade-text' }) => (
  <div className="bg-trade-bg border border-trade-border rounded-lg p-2.5">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] text-trade-text-muted uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    {subValue && <div className="text-[10px] text-trade-text-muted mt-0.5">{subValue}</div>}
  </div>
);

const EfficientFrontierChart: React.FC<{ frontier: EfficientFrontierPoint[]; currentRisk: number; currentRet: number }> = ({ frontier, currentRisk, currentRet }) => {
  if (frontier.length < 2) return null;

  const maxRisk = Math.max(...frontier.map(p => p.risk), currentRisk) * 1.1;
  const minRisk = Math.min(...frontier.map(p => p.risk), currentRisk) * 0.9;
  const maxRet = Math.max(...frontier.map(p => p.ret), currentRet) * 1.1;
  const minRet = Math.min(...frontier.map(p => p.ret), currentRet) * 0.9;

  const W = 260, H = 120;
  const pad = { l: 5, r: 5, t: 5, b: 5 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const toX = (risk: number) => pad.l + ((risk - minRisk) / (maxRisk - minRisk || 1)) * iw;
  const toY = (ret: number) => pad.t + ih - ((ret - minRet) / (maxRet - minRet || 1)) * ih;

  const pathD = frontier
    .sort((a, b) => a.risk - b.risk)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.risk).toFixed(1)},${toY(p.ret).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={`h${f}`} x1={pad.l} x2={W - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} stroke="var(--trade-border)" strokeWidth="0.5" strokeDasharray="3,3" />
      ))}
      {/* Frontier curve */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
      {/* Gradient fill */}
      <defs>
        <linearGradient id="frontierGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L${toX(frontier.sort((a, b) => a.risk - b.risk)[frontier.length - 1].risk).toFixed(1)},${(H - pad.b).toFixed(1)} L${toX(frontier.sort((a, b) => a.risk - b.risk)[0].risk).toFixed(1)},${(H - pad.b).toFixed(1)} Z`}
        fill="url(#frontierGrad)" />
      {/* Current portfolio point */}
      <circle cx={toX(currentRisk)} cy={toY(currentRet)} r="4" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
      {/* Labels */}
      <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-trade-text-muted" fontSize="8">Risk (σ)</text>
      <text x={2} y={H / 2} textAnchor="middle" transform={`rotate(-90,4,${H / 2})`} className="fill-trade-text-muted" fontSize="8">Return</text>
    </svg>
  );
};

// ─── Main Component ────────────────────────────────────

const PortfolioSuggestions: React.FC<PortfolioSuggestionsProps> = ({
  symbols, priceMatrix, balance, positions, history, loading, error, legacySuggestion
}) => {
  const [strategy, setStrategy] = useState<OptimizationStrategy>('HRP');
  const [riskAversion, setRiskAversion] = useState(5);
  const [kellyFraction, setKellyFraction] = useState(0.5);
  const [useLedoitWolf, setUseLedoitWolf] = useState(true);
  const [includeTC, setIncludeTC] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<QuantOptimizationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFrontier, setShowFrontier] = useState(false);
  const [showRiskDetails, setShowRiskDetails] = useState(false);

  // Portfolio summary from positions
  const portfolioSummary = useMemo(() => {
    const totalPnL = history.reduce((s, t) => s + t.pnl, 0);
    const wins = history.filter(t => t.pnl > 0).length;
    const winRate = history.length > 0 ? (wins / history.length) * 100 : 0;
    const openExposure = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
    return { totalPnL, winRate, openExposure, accountValue: balance + openExposure };
  }, [balance, positions, history]);

  const canOptimize = symbols.length >= 2 && priceMatrix.length >= 2 && priceMatrix.every(p => p.length >= 20);

  const handleOptimize = useCallback(() => {
    if (!canOptimize) return;
    setIsOptimizing(true);

    // Run async to not block UI
    setTimeout(() => {
      try {
        const investable = balance * 0.8;
        const res = runQuantOptimization({
          symbols,
          priceMatrix,
          strategy,
          riskAversion,
          kellyFraction,
          useLedoitWolf,
          includeTransactionCosts: includeTC,
          views: [],
          currentWeights: positions.length > 0
            ? symbols.map(() => 1 / symbols.length)
            : undefined,
          investableCapital: investable,
        });
        setResult(res);
      } catch (e: any) {
        console.error('Optimization failed:', e);
      }
      setIsOptimizing(false);
    }, 100);
  }, [symbols, priceMatrix, strategy, riskAversion, kellyFraction, useLedoitWolf, includeTC, balance, positions, canOptimize]);

  const strategyInfo: Record<OptimizationStrategy, { label: string; short: string; icon: React.ReactNode; desc: string }> = {
    MVO: { label: 'Mean-Variance', short: 'MVO', icon: <BarChart3 className="w-3.5 h-3.5" />, desc: 'Markowitz frontier optimization — maximize utility w^Tμ − (λ/2)w^TΣw' },
    BL: { label: 'Black-Litterman', short: 'B-L', icon: <Brain className="w-3.5 h-3.5" />, desc: 'Bayesian model combining market equilibrium with investor views' },
    HRP: { label: 'Risk Parity', short: 'HRP', icon: <Shield className="w-3.5 h-3.5" />, desc: 'Hierarchical clustering + recursive bisection — no matrix inversion needed' },
    KELLY: { label: 'Kelly Criterion', short: 'Kelly', icon: <Zap className="w-3.5 h-3.5" />, desc: 'Growth-optimal sizing via f* = Σ⁻¹(μ−r), with fractional dampening' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">

      {/* ─── Header ───────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/20 border border-indigo-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Quantitative Portfolio Suggestions</span>
        </div>
        <p className="text-[10px] text-indigo-200/60 leading-relaxed">
          Automated optimization using MVO, Black-Litterman, HRP & Kelly Criterion with Ledoit-Wolf covariance shrinkage,
          CVaR tail-risk protection, and transaction cost modelling.
        </p>
      </div>

      {/* ─── Strategy Selector ────────────── */}
      <div className="space-y-2">
        <div className="text-[10px] text-trade-text-muted uppercase font-bold tracking-wider ml-1">Optimization Engine</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(strategyInfo) as OptimizationStrategy[]).map(s => {
            const info = strategyInfo[s];
            return (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`p-2 text-left rounded-md border transition-all ${
                  strategy === s
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-trade-bg border-trade-border text-trade-text-muted hover:bg-trade-panel-focus hover:text-trade-text'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {info.icon}
                  <span className="text-[11px] font-bold">{info.short}</span>
                </div>
                <div className="text-[9px] opacity-70 leading-tight">{info.label}</div>
              </button>
            );
          })}
        </div>
        <div className="bg-trade-bg border border-trade-border rounded p-2">
          <p className="text-[10px] text-trade-text-muted leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
            {strategyInfo[strategy].desc}
          </p>
        </div>
      </div>

      {/* ─── Parameters ───────────────────── */}
      <div className="bg-trade-bg border border-trade-border rounded-lg p-3 space-y-3">
        {/* Risk Aversion λ */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-trade-text-muted font-semibold uppercase">Risk Aversion (λ)</span>
            <span className="text-indigo-400 font-mono font-bold">{riskAversion}</span>
          </div>
          <input
            type="range" min="1" max="10" value={riskAversion}
            onChange={e => setRiskAversion(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1"
          />
          <div className="flex justify-between text-[9px] text-trade-text-muted mt-0.5">
            <span>Aggressive</span><span>Conservative</span>
          </div>
        </div>

        {/* Kelly Fraction (only for KELLY strategy) */}
        {strategy === 'KELLY' && (
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-trade-text-muted font-semibold uppercase">Kelly Fraction (f*)</span>
              <span className="text-amber-400 font-mono font-bold">{(kellyFraction * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range" min="25" max="100" value={kellyFraction * 100}
              onChange={e => setKellyFraction(Number(e.target.value) / 100)}
              className="w-full accent-amber-500 h-1"
            />
            <div className="flex justify-between text-[9px] text-trade-text-muted mt-0.5">
              <span>Quarter Kelly (safe)</span><span>Full Kelly (max growth)</span>
            </div>
          </div>
        )}

        {/* Advanced toggles */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-[10px] text-trade-text-muted hover:text-trade-text py-1"
        >
          <span className="font-semibold uppercase">Advanced Parameters</span>
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showAdvanced && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="flex items-center gap-2 text-[11px] text-trade-text-muted cursor-pointer hover:text-trade-text">
              <input type="checkbox" checked={useLedoitWolf} onChange={e => setUseLedoitWolf(e.target.checked)} className="accent-indigo-500" />
              <div>
                <span className="font-semibold text-trade-text">Ledoit-Wolf Shrinkage</span>
                <p className="text-[9px] opacity-70">Σ̂ = δF + (1−δ)S — denoise covariance matrix</p>
              </div>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-trade-text-muted cursor-pointer hover:text-trade-text">
              <input type="checkbox" checked={includeTC} onChange={e => setIncludeTC(e.target.checked)} className="accent-indigo-500" />
              <div>
                <span className="font-semibold text-trade-text">Transaction Cost Penalty</span>
                <p className="text-[9px] opacity-70">L1 turnover penalty — only rebalance if net benefit &gt; cost</p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* ─── Run Button ───────────────────── */}
      <button
        onClick={handleOptimize}
        disabled={isOptimizing || loading || !canOptimize}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isOptimizing || loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Synthesizing Optimal Portfolio...</>
        ) : !canOptimize ? (
          <><AlertTriangle className="w-4 h-4" /> Need ≥ 2 assets with 20+ days data</>
        ) : (
          <><PieChart className="w-4 h-4" /> Generate Portfolio Suggestion</>
        )}
      </button>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-2 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
        </div>
      )}

      {/* ─── Results ──────────────────────── */}
      {result && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Method Badge */}
          <div className="bg-trade-bg border border-trade-border rounded p-2">
            <div className="text-[10px] text-trade-text-muted uppercase font-bold mb-1">Methodology</div>
            <div className="text-[10px] text-indigo-300 leading-relaxed font-mono">{result.methodology}</div>
            {result.shrinkageIntensity > 0 && (
              <div className="text-[9px] text-trade-text-muted mt-1">
                Shrinkage intensity δ = {result.shrinkageIntensity.toFixed(4)} | Turnover = {(result.turnover * 100).toFixed(2)}%
              </div>
            )}
          </div>

          {/* ─── Key Metrics Grid ──────────── */}
          <div className="grid grid-cols-2 gap-1.5">
            <MetricCard
              label="Expected Return"
              value={`${(result.riskMetrics.annualisedReturn * 100).toFixed(2)}%`}
              subValue="Annualised"
              icon={<TrendingUp className="w-3 h-3 text-emerald-400" />}
              color={result.riskMetrics.annualisedReturn >= 0 ? 'text-trade-up' : 'text-trade-down'}
            />
            <MetricCard
              label="Volatility (σ)"
              value={`${(result.riskMetrics.annualisedVolatility * 100).toFixed(2)}%`}
              subValue="Annualised"
              icon={<Activity className="w-3 h-3 text-amber-400" />}
              color="text-amber-400"
            />
            <MetricCard
              label="Sharpe Ratio"
              value={result.riskMetrics.sharpeRatio.toFixed(3)}
              subValue="Risk-adjusted"
              icon={<BarChart3 className="w-3 h-3 text-indigo-400" />}
              color={result.riskMetrics.sharpeRatio > 0 ? 'text-indigo-400' : 'text-trade-down'}
            />
            <MetricCard
              label="Sortino Ratio"
              value={result.riskMetrics.sortinoRatio.toFixed(3)}
              subValue="Downside only"
              icon={<ShieldAlert className="w-3 h-3 text-purple-400" />}
              color={result.riskMetrics.sortinoRatio > 0 ? 'text-purple-400' : 'text-trade-down'}
            />
          </div>

          {/* ─── Risk Metrics Expansion ─────── */}
          <button
            onClick={() => setShowRiskDetails(!showRiskDetails)}
            className="w-full flex items-center justify-between text-[10px] text-trade-text-muted hover:text-trade-text bg-trade-bg border border-trade-border rounded p-2"
          >
            <span className="font-bold uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-rose-400" /> Tail Risk & Drawdown Metrics
            </span>
            {showRiskDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showRiskDetails && (
            <div className="grid grid-cols-2 gap-1.5 animate-in fade-in duration-200">
              <MetricCard
                label="CVaR (95%)"
                value={`${(result.riskMetrics.cvar95 * 100).toFixed(3)}%`}
                subValue="Expected tail loss"
                icon={<AlertTriangle className="w-3 h-3 text-rose-400" />}
                color="text-rose-400"
              />
              <MetricCard
                label="VaR (95%)"
                value={`${(result.riskMetrics.var95 * 100).toFixed(3)}%`}
                subValue="Max daily loss @ 95%"
                icon={<TrendingDown className="w-3 h-3 text-orange-400" />}
                color="text-orange-400"
              />
              <MetricCard
                label="Max Drawdown"
                value={`${(result.riskMetrics.maxDrawdown * 100).toFixed(2)}%`}
                subValue="Worst peak-to-trough"
                icon={<TrendingDown className="w-3 h-3 text-red-500" />}
                color="text-red-500"
              />
              <MetricCard
                label="Calmar Ratio"
                value={result.riskMetrics.calmarRatio.toFixed(3)}
                subValue="Return / Max DD"
                icon={<Target className="w-3 h-3 text-cyan-400" />}
                color="text-cyan-400"
              />
            </div>
          )}

          {/* ─── Efficient Frontier ─────────── */}
          <button
            onClick={() => setShowFrontier(!showFrontier)}
            className="w-full flex items-center justify-between text-[10px] text-trade-text-muted hover:text-trade-text bg-trade-bg border border-trade-border rounded p-2"
          >
            <span className="font-bold uppercase flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-400" /> Efficient Frontier
            </span>
            {showFrontier ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showFrontier && (
            <div className="bg-trade-bg border border-trade-border rounded-lg p-2 animate-in fade-in duration-200">
              <EfficientFrontierChart
                frontier={result.efficientFrontier}
                currentRisk={result.portfolioVolatility}
                currentRet={result.expectedReturn}
              />
              <div className="flex items-center justify-center gap-4 mt-1 text-[9px] text-trade-text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Frontier</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Your Portfolio</span>
              </div>
            </div>
          )}

          {/* ─── Allocations ────────────────── */}
          <div className="bg-trade-bg border border-trade-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-trade-border">
              <div className="text-[10px] font-bold text-trade-text-muted uppercase tracking-wider">Optimal Allocation</div>
              <div className="text-[9px] text-trade-text-muted">Investable: ₹{(balance * 0.8).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (80% of balance)</div>
            </div>
            <div className="divide-y divide-trade-border">
              {result.allocations
                .filter(a => a.weight > 0.001)
                .sort((a, b) => b.weight - a.weight)
                .map(alloc => (
                  <div key={alloc.symbol} className="p-2.5 hover:bg-trade-panel-focus transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-trade-text">{alloc.symbol}</span>
                      <span className="text-xs font-mono text-indigo-400 font-bold">{(alloc.weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-trade-panel rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${Math.min(100, alloc.weight * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-trade-text-muted">
                      <span>₹{alloc.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      <span>Qty: {alloc.qty.toFixed(alloc.qty < 1 ? 6 : 2)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Transaction Cost Warning */}
          {result.transactionCostEstimate > 0 && (
            <div className="bg-amber-900/15 border border-amber-500/20 rounded p-2 text-[10px] text-amber-300/80 flex items-start gap-1.5">
              <DollarSign className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Estimated transaction cost: <span className="font-mono font-bold">{(result.transactionCostEstimate * 100).toFixed(3)}%</span> of portfolio
                (turnover {(result.turnover * 100).toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Account Overview ─────────────── */}
      <div className="grid grid-cols-2 gap-1.5">
        <MetricCard
          label="Account Value"
          value={`₹${portfolioSummary.accountValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="w-3 h-3 text-trade-accent" />}
        />
        <MetricCard
          label="Realized P&L"
          value={`${portfolioSummary.totalPnL >= 0 ? '+' : ''}₹${portfolioSummary.totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<Activity className="w-3 h-3" />}
          color={portfolioSummary.totalPnL >= 0 ? 'text-trade-up' : 'text-trade-down'}
        />
        <MetricCard
          label="Open Exposure"
          value={`₹${portfolioSummary.openExposure.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<Layers className="w-3 h-3 text-amber-400" />}
        />
        <MetricCard
          label="Win Rate"
          value={`${portfolioSummary.winRate.toFixed(1)}%`}
          subValue={`${history.length} trades`}
          icon={<Target className="w-3 h-3 text-emerald-400" />}
        />
      </div>

      {/* ─── Disclaimer ───────────────────── */}
      <div className="text-[9px] text-trade-text-muted/50 text-center py-2 border-t border-trade-border">
        Mathematical models use historical data. Past performance ≠ future results. Use fractional Kelly to reduce volatility.
      </div>
    </div>
  );
};

export default PortfolioSuggestions;
