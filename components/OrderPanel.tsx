
import React, { useState, useMemo, useEffect } from 'react';
import { Position, PositionType, Trade, OrderType, PortfolioSuggestion } from '../types';
import { Layers, History, CheckCircle, AlertCircle, Target, ShieldAlert, AlertTriangle, PieChart, X, TrendingUp, Activity, Trash2 } from 'lucide-react';
import { getSnapshotPrice } from '../services/dataService';
import PortfolioSuggestions from './PortfolioSuggestions';

interface OrderPanelProps {
  symbol: string;
  currentPrice: number;
  balance: number;
  positions: Position[];
  history: Trade[];
    portfolioSuggestion: PortfolioSuggestion | null;
    loadingPortfolioSuggestion: boolean;
    portfolioSuggestionError: string | null;
    portfolioSymbols: string[];
    portfolioPriceMatrix: number[][];
  onPlaceOrder: (type: 'Buy' | 'Sell', qty: number, orderType: OrderType, limitPrice?: number, sl?: number, tp?: number) => { success: boolean; message: string };
  onClosePosition: (id: string) => void;
    onReducePosition: (id: string, qty: number) => void;
  onCloseAllPositions: () => void;
}

interface OrderLevel {
    price: number;
    size: number;
    total: number;
}

const OrderPanel: React.FC<OrderPanelProps> = ({ symbol, currentPrice, balance, positions, history, portfolioSuggestion, loadingPortfolioSuggestion, portfolioSuggestionError, portfolioSymbols, portfolioPriceMatrix, onPlaceOrder, onClosePosition, onReducePosition, onCloseAllPositions }) => {
  const [qty, setQty] = useState<number>(1);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.MARKET);
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice);
    const [activeTab, setActiveTab] = useState<'trade' | 'positions' | 'portfolio' | 'history'>('trade');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Risk Management State
  const [isSL, setIsSL] = useState(false);
  const [isTP, setIsTP] = useState(false);
  const [riskMode, setRiskMode] = useState<'PRICE' | 'PERCENT'>('PERCENT');
  const [slValue, setSlValue] = useState<number>(2); // Default 2%
  const [tpValue, setTpValue] = useState<number>(4); // Default 4%

  // Update limit price default when symbol changes
  useEffect(() => {
    setLimitPrice(currentPrice);
  }, [symbol]);

  // Switch tab if a new position is added
  useEffect(() => {
    if (positions.length > 0 && activeTab === 'positions') {
        // Keep view on positions if already there
    }
  }, [positions.length]);

  const effectivePrice = orderType === OrderType.LIMIT ? limitPrice : currentPrice;
  const total = effectivePrice * qty;

  // Calculate projected SL/TP prices for display
  const getProjectedSL = (type: 'Buy' | 'Sell') => {
      if (!isSL) return undefined;
      if (riskMode === 'PRICE') return slValue;
      // Percent mode
      const delta = effectivePrice * (slValue / 100);
      return type === 'Buy' ? effectivePrice - delta : effectivePrice + delta;
  };

  const getProjectedTP = (type: 'Buy' | 'Sell') => {
      if (!isTP) return undefined;
      if (riskMode === 'PRICE') return tpValue;
      // Percent mode
      const delta = effectivePrice * (tpValue / 100);
      return type === 'Buy' ? effectivePrice + delta : effectivePrice - delta;
  };

  const handleOrder = (type: 'Buy' | 'Sell') => {
    // Validation
    if (orderType === OrderType.LIMIT && limitPrice <= 0) {
         setNotification({ message: 'Invalid Limit Price', type: 'error' });
         return;
    }
    
    const sl = getProjectedSL(type);
    const tp = getProjectedTP(type);

    if (sl && type === 'Buy' && sl >= effectivePrice) {
        setNotification({ message: 'Stop Loss must be below Entry for Buy', type: 'error' });
        return;
    }
    if (sl && type === 'Sell' && sl <= effectivePrice) {
        setNotification({ message: 'Stop Loss must be above Entry for Sell', type: 'error' });
        return;
    }

    const result = onPlaceOrder(type, qty, orderType, limitPrice, sl, tp);
    
    setNotification({
        message: result.message,
        type: result.success ? 'success' : 'error'
    });
    
    // Clear notification after delay
    setTimeout(() => setNotification(null), 4000);
  };

  // Generate Order Book Data
  const { asks, bids, maxTotal, spread } = useMemo(() => {
    if (!currentPrice) return { asks: [], bids: [], maxTotal: 1, spread: 0 };
    
    const spreadVal = currentPrice * 0.0005; // 0.05% spread
    const levels = 5;
    
    let rawAsks = [];
    let rawBids = [];
    
    for(let i=0; i<levels; i++) {
        // Asks: Price increases as we go up the ladder (away from spread)
        const askPrice = currentPrice + (spreadVal * (i + 1)) + (Math.random() * spreadVal * 0.2);
        // Bids: Price decreases as we go down the ladder (away from spread)
        const bidPrice = currentPrice - (spreadVal * (i + 1)) - (Math.random() * spreadVal * 0.2);
        
        rawAsks.push({ price: askPrice, size: Math.floor(Math.random() * 400) + 20 });
        rawBids.push({ price: bidPrice, size: Math.floor(Math.random() * 400) + 20 });
    }
    
    // Sort Asks Descending (Highest Price at Top, Lowest/Best at Bottom)
    rawAsks.sort((a, b) => b.price - a.price);
    
    // Sort Bids Descending (Highest/Best at Top, Lowest at Bottom)
    rawBids.sort((a, b) => b.price - a.price);

    // Calculate Cumulative Totals for Depth
    let askAccum = 0;
    const finalAsks: OrderLevel[] = [];
    for(let i = rawAsks.length - 1; i >= 0; i--) {
        askAccum += rawAsks[i].size;
        finalAsks[i] = { ...rawAsks[i], total: askAccum };
    }

    let bidAccum = 0;
    const finalBids: OrderLevel[] = rawBids.map(b => {
        bidAccum += b.size;
        return { ...b, total: bidAccum };
    });

    const maxVol = Math.max(askAccum, bidAccum);
    
    return { asks: finalAsks, bids: finalBids, maxTotal: maxVol, spread: (rawAsks[rawAsks.length-1].price - rawBids[0].price) };
  }, [currentPrice]);

  // Calculate Total Unrealized PnL for ALL active positions
  const totalPnL = useMemo(() => {
      return positions.reduce((acc, pos) => {
          const marketPrice = pos.symbol === symbol ? currentPrice : getSnapshotPrice(pos.symbol);
          
          if (!marketPrice) return acc;

          let pnl = 0;
          if (pos.type === PositionType.BUY) {
              pnl = (marketPrice - pos.entryPrice) * pos.quantity;
          } else {
              pnl = (pos.entryPrice - marketPrice) * pos.quantity;
          }
          return acc + pnl;
      }, 0);
  }, [positions, currentPrice, symbol]);

  const portfolioSummary = useMemo(() => {
      const realizedPnl = history.reduce((sum, trade) => sum + trade.pnl, 0);
      const accountValue = balance + totalPnL;
      const totalExposure = positions.reduce((sum, pos) => sum + (Math.abs(pos.entryPrice * pos.quantity)), 0);
      const winningTrades = history.filter(trade => trade.pnl > 0).length;
      const winRate = history.length > 0 ? (winningTrades / history.length) * 100 : 0;

      const symbolMap = new Map<string, { exposure: number; pnl: number; positions: number; qty: number }>();

      positions.forEach(pos => {
          const marketPrice = pos.symbol === symbol ? currentPrice : getSnapshotPrice(pos.symbol);
          const openPnl = pos.type === PositionType.BUY
              ? (marketPrice - pos.entryPrice) * pos.quantity
              : (pos.entryPrice - marketPrice) * pos.quantity;
          const exposure = Math.abs(pos.entryPrice * pos.quantity);

          const existing = symbolMap.get(pos.symbol) || { exposure: 0, pnl: 0, positions: 0, qty: 0 };
          symbolMap.set(pos.symbol, {
              exposure: existing.exposure + exposure,
              pnl: existing.pnl + openPnl,
              positions: existing.positions + 1,
              qty: existing.qty + pos.quantity,
          });
      });

      const allocations = Array.from(symbolMap.entries())
          .map(([symbolName, value]) => ({
              symbol: symbolName,
              ...value,
              allocationPct: totalExposure > 0 ? (value.exposure / totalExposure) * 100 : 0,
          }))
          .sort((a, b) => b.exposure - a.exposure);

      return {
          realizedPnl,
          accountValue,
          totalExposure,
          winRate,
          allocations,
      };
  }, [history, balance, totalPnL, positions, symbol, currentPrice]);

  // Enhanced formatting helper to show precision for small PnL
  const formatCurrency = (val: number) => {
      if (val === 0) return '0.00';
      const absVal = Math.abs(val);
      // For very small numbers (e.g. Forex/Crypto decimals), show more precision
      if (absVal < 0.001) return val.toFixed(6);
      if (absVal < 0.1) return val.toFixed(4); 
      if (absVal < 1) return val.toFixed(3);
      return val.toFixed(2);
  };

  return (
    <div className="w-full h-full bg-trade-panel border-l border-trade-border flex flex-col relative">
      {/* Tabs */}
      <div className="flex border-b border-trade-border shrink-0">
        <button 
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'trade' ? 'text-trade-accent border-b-2 border-trade-accent' : 'text-trade-text-muted hover:text-trade-text'}`}
            onClick={() => setActiveTab('trade')}
        >
            Trade
        </button>
        <button 
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'positions' ? 'text-trade-accent border-b-2 border-trade-accent' : 'text-trade-text-muted hover:text-trade-text'}`}
            onClick={() => setActiveTab('positions')}
        >
            Pos ({positions.length})
        </button>
        <button 
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'portfolio' ? 'text-trade-accent border-b-2 border-trade-accent' : 'text-trade-text-muted hover:text-trade-text'}`}
            onClick={() => setActiveTab('portfolio')}
        >
            <PieChart className="w-4 h-4" />
        </button>
        <button 
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-trade-accent border-b-2 border-trade-accent' : 'text-trade-text-muted hover:text-trade-text'}`}
            onClick={() => setActiveTab('history')}
        >
            <History className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'trade' && (
        <div className="p-4 flex flex-col gap-5 overflow-y-auto">
            {/* Balance */}
            <div>
                <label className="text-xs text-trade-text-muted mb-1 block uppercase font-bold tracking-wide">Account Balance</label>
                <div className="text-2xl font-mono text-trade-text flex items-center">
                    <span className="text-trade-text-muted mr-1">₹</span>
                    {balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
            </div>

            {/* Order Form */}
            <div className="bg-trade-bg p-3 rounded border border-trade-border space-y-3">
                
                {/* Order Type & Qty Row */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-trade-text-muted mb-1 block">Type</label>
                        <select 
                            value={orderType} 
                            onChange={(e) => setOrderType(e.target.value as OrderType)}
                            className="w-full bg-trade-panel text-trade-text border border-trade-border rounded h-9 px-2 text-sm outline-none focus:border-trade-accent"
                        >
                            <option value={OrderType.MARKET}>Market</option>
                            <option value={OrderType.LIMIT}>Limit</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-trade-text-muted mb-1 block">Qty</label>
                        <input 
                            type="number" 
                            value={qty} 
                            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-trade-panel text-trade-text border border-trade-border rounded h-9 px-2 text-sm outline-none focus:border-trade-accent"
                        />
                    </div>
                </div>

                {/* Limit Price Input */}
                {orderType === OrderType.LIMIT && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs text-trade-text-muted mb-1 block">Limit Price</label>
                        <input 
                            type="number" 
                            value={limitPrice} 
                            onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-trade-panel text-trade-text border border-trade-border rounded h-9 px-2 text-sm outline-none focus:border-trade-accent"
                        />
                    </div>
                )}

                {/* Protection Section (SL/Target) */}
                <div className="pt-2 border-t border-trade-border">
                     <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-trade-text-muted">Protection (CO/BO)</span>
                         <div className="flex bg-trade-panel-focus rounded p-0.5">
                             <button 
                                onClick={() => setRiskMode('PRICE')}
                                className={`px-2 py-0.5 text-[10px] rounded ${riskMode === 'PRICE' ? 'bg-trade-accent text-white' : 'text-trade-text-muted hover:text-white'}`}
                             >Price</button>
                             <button 
                                onClick={() => setRiskMode('PERCENT')}
                                className={`px-2 py-0.5 text-[10px] rounded ${riskMode === 'PERCENT' ? 'bg-trade-accent text-white' : 'text-trade-text-muted hover:text-white'}`}
                             >%</button>
                         </div>
                     </div>

                     <div className="flex gap-2 mb-2">
                         <div className={`flex-1 border rounded p-2 transition-colors ${isSL ? 'border-trade-down/50 bg-trade-down/5' : 'border-trade-border bg-trade-panel-focus'}`}>
                             <div className="flex items-center gap-2 mb-1">
                                 <input type="checkbox" checked={isSL} onChange={() => setIsSL(!isSL)} className="accent-trade-down" />
                                 <span className={`text-xs ${isSL ? 'text-trade-down font-bold' : 'text-trade-text-muted'}`}>Stop Loss</span>
                             </div>
                             {isSL && (
                                 <input 
                                    type="number" 
                                    value={slValue} 
                                    onChange={(e) => setSlValue(parseFloat(e.target.value))}
                                    className="w-full bg-transparent text-sm text-trade-text outline-none border-b border-trade-border focus:border-trade-down"
                                    placeholder={riskMode === 'PERCENT' ? '%' : 'Price'}
                                 />
                             )}
                         </div>
                         <div className={`flex-1 border rounded p-2 transition-colors ${isTP ? 'border-trade-up/50 bg-trade-up/5' : 'border-trade-border bg-trade-panel-focus'}`}>
                             <div className="flex items-center gap-2 mb-1">
                                 <input type="checkbox" checked={isTP} onChange={() => setIsTP(!isTP)} className="accent-trade-up" />
                                 <span className={`text-xs ${isTP ? 'text-trade-up font-bold' : 'text-trade-text-muted'}`}>Target</span>
                             </div>
                             {isTP && (
                                 <input 
                                    type="number" 
                                    value={tpValue} 
                                    onChange={(e) => setTpValue(parseFloat(e.target.value))}
                                    className="w-full bg-transparent text-sm text-trade-text outline-none border-b border-trade-border focus:border-trade-up"
                                    placeholder={riskMode === 'PERCENT' ? '%' : 'Price'}
                                 />
                             )}
                         </div>
                     </div>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t border-trade-border">
                    <span className="text-trade-text-muted">Margin Req.</span>
                    <span className="text-trade-text font-mono">₹{total.toFixed(2)}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button 
                    onClick={() => handleOrder('Buy')}
                    className="flex-1 bg-trade-up hover:bg-green-600 text-white py-3 rounded font-bold flex flex-col items-center transition-transform active:scale-95 group"
                >
                    <span className="group-hover:translate-y-px">BUY</span>
                    <div className="flex items-center gap-1 text-[10px] font-normal opacity-80">
                        {orderType === OrderType.LIMIT ? `@ ${limitPrice}` : 'MARKET'}
                    </div>
                </button>
                <button 
                     onClick={() => handleOrder('Sell')}
                    className="flex-1 bg-trade-down hover:bg-red-600 text-white py-3 rounded font-bold flex flex-col items-center transition-transform active:scale-95 group"
                >
                    <span className="group-hover:translate-y-px">SELL</span>
                    <div className="flex items-center gap-1 text-[10px] font-normal opacity-80">
                         {orderType === OrderType.LIMIT ? `@ ${limitPrice}` : 'MARKET'}
                    </div>
                </button>
            </div>

            {/* REAL-TIME ORDER BOOK SECTION */}
            <div className="border border-trade-border rounded bg-trade-bg overflow-hidden mt-1 flex-1 flex flex-col min-h-[250px]">
                <div className="bg-trade-panel-focus px-3 py-2 border-b border-trade-border flex justify-between items-center">
                    <div className="text-xs font-bold text-trade-text-muted flex items-center gap-1">
                         <Layers className="w-3 h-3" /> Market Depth (L2)
                    </div>
                    <span className="text-[10px] text-trade-text-muted font-mono">Spread: {spread.toFixed(2)}</span>
                </div>
                
                <div className="flex flex-col flex-1 text-xs font-mono">
                    {/* Header */}
                    <div className="grid grid-cols-3 text-[10px] text-trade-text-muted px-2 py-1.5 border-b border-trade-border/50">
                        <span className="text-left">Price</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Total</span>
                    </div>
                    
                    {/* Asks (Sell Orders) - Rendered from High Price to Low (Best Ask) */}
                    <div className="flex-1 flex flex-col justify-end pb-1 relative">
                        {asks.map((ask, i) => (
                            <div key={`ask-${i}`} className="grid grid-cols-3 px-2 py-0.5 relative group hover:bg-trade-panel">
                                {/* Depth Bar */}
                                <div className="absolute top-0 right-0 h-full bg-red-900/10 transition-all duration-300" style={{ width: `${(ask.total / maxTotal) * 100}%` }}></div>
                                
                                <span className="text-trade-down relative z-10 font-medium">{ask.price.toFixed(2)}</span>
                                <span className="text-trade-text-muted relative z-10 text-right">{ask.size}</span>
                                <span className="text-trade-text-muted relative z-10 text-right opacity-60">{ask.total}</span>
                            </div>
                        ))}
                    </div>

                    {/* Current Market Price Banner */}
                    <div className="text-center py-1.5 bg-trade-panel text-trade-text font-bold border-y border-trade-border text-sm flex justify-between px-4 items-center">
                        <span className="text-trade-up text-xs">{bids[0]?.price.toFixed(2) || '-'}</span>
                        <span>{currentPrice.toFixed(2)}</span>
                        <span className="text-trade-down text-xs">{asks[asks.length-1]?.price.toFixed(2) || '-'}</span>
                    </div>

                    {/* Bids (Buy Orders) - Rendered from High (Best Bid) to Low */}
                    <div className="flex-1 flex flex-col pt-1 relative">
                         {bids.map((bid, i) => (
                            <div key={`bid-${i}`} className="grid grid-cols-3 px-2 py-0.5 relative group hover:bg-trade-panel">
                                {/* Depth Bar */}
                                <div className="absolute top-0 right-0 h-full bg-green-900/10 transition-all duration-300" style={{ width: `${(bid.total / maxTotal) * 100}%` }}></div>
                                
                                <span className="text-trade-up relative z-10 font-medium">{bid.price.toFixed(2)}</span>
                                <span className="text-trade-text-muted relative z-10 text-right">{bid.size}</span>
                                <span className="text-trade-text-muted relative z-10 text-right opacity-60">{bid.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="text-xs text-trade-text-muted text-center pb-2">
                Simulated Data • L2 View
            </div>
        </div>
      )}

      {activeTab === 'positions' && (
          <div className="flex-1 overflow-y-auto">
            {/* Active PnL Summary */}
            <div className="p-3 bg-trade-panel-focus border-b border-trade-border flex justify-between items-center sticky top-0 z-10">
                <span className="text-xs font-bold text-trade-text-muted uppercase">Total Open P&L</span>
                <span className={`font-mono font-bold text-sm ${totalPnL >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                    {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                </span>
            </div>

            {/* Close All Button */}
            {positions.length > 0 && (
                <div className="p-2 border-b border-trade-border bg-trade-bg">
                    <button 
                        onClick={onCloseAllPositions}
                        className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/40 rounded py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" /> CLOSE ALL POSITIONS
                    </button>
                </div>
            )}

            {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-trade-text-muted p-4">
                    <PieChart className="w-12 h-12 mb-2 opacity-50" />
                    <p>No active positions.</p>
                    <button className="text-trade-accent text-sm mt-2 hover:underline" onClick={() => setActiveTab('trade')}>Start Trading</button>
                </div>
            ) : (
                <div className="p-3 space-y-2">
                    {positions.map(pos => {
                        const isCurrentSymbol = pos.symbol === symbol;
                        const marketPrice = isCurrentSymbol ? currentPrice : getSnapshotPrice(pos.symbol);
                        
                        let pnl = 0;
                        let pnlPercent = 0;
                        let isProfit = false;

                        if (marketPrice > 0) {
                            if (pos.type === PositionType.BUY) {
                                pnl = (marketPrice - pos.entryPrice) * pos.quantity;
                            } else {
                                pnl = (pos.entryPrice - marketPrice) * pos.quantity;
                            }
                            
                            const entryValue = pos.entryPrice * pos.quantity;
                            pnlPercent = entryValue !== 0 ? (pnl / entryValue) * 100 : 0;
                            isProfit = pnl >= 0;
                        }

                        return (
                            <div key={pos.id} className={`bg-trade-bg p-3 rounded border relative group transition-colors ${isCurrentSymbol ? 'border-trade-text-muted hover:border-trade-text' : 'border-trade-border opacity-70'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.type === PositionType.BUY ? 'bg-trade-up/20 text-trade-up' : 'bg-trade-down/20 text-trade-down'}`}>
                                                {pos.type === PositionType.BUY ? 'BUY' : 'SELL'}
                                            </span>
                                            <span className="font-bold text-trade-text text-sm">{pos.symbol}</span>
                                            <span className="text-xs text-trade-text-muted">x{pos.quantity}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-trade-text-muted">
                                             <span>Avg: <span className="text-trade-text font-mono">{pos.entryPrice.toFixed(2)}</span></span>
                                             <span>LTP: <span className="text-trade-text font-mono flex items-center gap-1">
                                                 {marketPrice.toFixed(2)}
                                                 {isCurrentSymbol && <Activity className="w-3 h-3 text-trade-accent animate-pulse" />}
                                             </span></span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right min-w-[80px]">
                                        <div className="flex flex-col items-end">
                                            <div className="text-[10px] text-trade-text-muted uppercase tracking-wider mb-0.5">P&L</div>
                                            <div className={`font-mono font-bold text-sm leading-none mb-1 ${isProfit ? 'text-trade-up' : 'text-trade-down'}`}>
                                                {isProfit ? '+' : ''}{formatCurrency(pnl)}
                                            </div>
                                            <div className={`text-[10px] font-mono ${isProfit ? 'text-trade-up' : 'text-trade-down'}`}>
                                                    ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-2 pt-2 border-t border-trade-border flex justify-between items-center">
                                    <div className="flex gap-2">
                                        {pos.stopLoss && <span className="text-[10px] bg-red-900/10 text-red-400 px-1.5 py-0.5 rounded border border-red-900/30 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> SL: {pos.stopLoss.toFixed(2)}</span>}
                                        {pos.takeProfit && <span className="text-[10px] bg-green-900/10 text-green-400 px-1.5 py-0.5 rounded border border-green-900/30 flex items-center gap-1"><Target className="w-3 h-3"/> TP: {pos.takeProfit.toFixed(2)}</span>}
                                    </div>
                                    <button 
                                        onClick={() => onClosePosition(pos.id)}
                                        className="text-[10px] px-3 py-1.5 rounded transition-colors flex items-center gap-1 bg-trade-panel hover:bg-red-900/50 hover:text-red-400 text-trade-text-muted"
                                    >
                                        <X className="w-3 h-3" /> Close
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>
      )}

      {activeTab === 'portfolio' && (
          <PortfolioSuggestions
            symbols={portfolioSymbols}
            priceMatrix={portfolioPriceMatrix}
            balance={balance}
            positions={positions}
            history={history}
            loading={loadingPortfolioSuggestion}
            error={portfolioSuggestionError}
            legacySuggestion={portfolioSuggestion}
          />
      )}

      {activeTab === 'history' && (
           <div className="flex-1 overflow-y-auto">
             {history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-trade-text-muted p-4">
                     <History className="w-12 h-12 mb-2 opacity-50" />
                     <p>No trade history.</p>
                 </div>
             ) : (
                 <div className="divide-y divide-trade-border">
                     {history.map(trade => (
                         <div key={trade.id} className="p-3 hover:bg-trade-panel-focus transition-colors group">
                             <div className="flex justify-between items-start mb-1">
                                 <div className="flex items-center gap-2">
                                     <span className={`text-[10px] font-bold px-1 py-0.5 rounded uppercase ${trade.type === PositionType.BUY ? 'bg-trade-up/10 text-trade-up' : 'bg-trade-down/10 text-trade-down'}`}>
                                         {trade.type === PositionType.BUY ? 'BUY' : 'SELL'}
                                     </span>
                                     <span className="text-sm font-bold text-trade-text">{trade.symbol}</span>
                                     <span className="text-xs text-trade-text-muted">x{trade.quantity}</span>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-[10px] text-trade-text-muted uppercase">Realized P&L</div>
                                    <div className={`font-mono font-bold text-sm ${trade.pnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                                        {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                                    </div>
                                 </div>
                             </div>
                             <div className="flex justify-between items-center text-xs text-trade-text-muted mt-1 bg-trade-panel p-1.5 rounded">
                                 <div className="flex items-center gap-2">
                                     <span className="text-trade-text-muted">Entry: <span className="font-mono text-trade-text">{trade.entryPrice.toFixed(2)}</span></span>
                                     <span className="text-trade-text-muted">→</span>
                                     <span className="text-trade-text-muted">Exit: <span className="font-mono text-trade-text">{trade.exitPrice.toFixed(2)}</span></span>
                                 </div>
                                 <div className="font-mono text-[10px] opacity-70">
                                     {new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
           </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`absolute bottom-4 left-4 right-4 p-3 rounded shadow-lg border flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 ${notification.type === 'success' ? 'bg-[#089981]/10 border-[#089981] text-[#089981]' : 'bg-[#f23645]/10 border-[#f23645] text-[#f23645]'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-semibold">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-auto hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

export default OrderPanel;
