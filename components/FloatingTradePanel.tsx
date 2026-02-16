
import React, { useState, useEffect, useRef } from 'react';
import { GripHorizontal, Minus, Plus, Loader2 } from 'lucide-react';
import { OrderType } from '../types';

interface FloatingTradePanelProps {
  symbol: string;
  currentPrice: number;
  onOrder: (type: 'Buy' | 'Sell', qty: number) => Promise<boolean>;
}

const FloatingTradePanel: React.FC<FloatingTradePanelProps> = ({ symbol, currentPrice, onOrder }) => {
  const [qty, setQty] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 }); // Default position (top-left relative to container)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loadingState, setLoadingState] = useState<'IDLE' | 'BUYING' | 'SELLING'>('IDLE');
  
  const panelRef = useRef<HTMLDivElement>(null);

  // Spread Simulation for Bid/Ask display
  const spread = currentPrice * 0.0003; // 0.03% spread
  const bidPrice = currentPrice - (spread / 2); // Sell Price
  const askPrice = currentPrice + (spread / 2); // Buy Price

  // Draggable Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, offset]);

  const handleExecute = async (type: 'Buy' | 'Sell') => {
    if (qty <= 0) return;
    setLoadingState(type === 'Buy' ? 'BUYING' : 'SELLING');
    
    // Simulate API Network Latency
    await new Promise(resolve => setTimeout(resolve, 600));
    
    await onOrder(type, qty);
    setLoadingState('IDLE');
  };

  return (
    <div 
      ref={panelRef}
      className="absolute z-40 bg-[#1e2026] border border-gray-700 rounded-lg shadow-2xl w-64 overflow-hidden select-none animate-in fade-in zoom-in duration-200"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Drag Handle Header */}
      <div 
        className="bg-[#15171c] h-6 flex items-center justify-center cursor-grab active:cursor-grabbing border-b border-gray-800"
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal className="w-4 h-4 text-gray-600" />
      </div>

      <div className="p-3">
        {/* Symbol & Qty */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-white text-sm">{symbol}</span>
          <div className="flex items-center bg-[#0f1115] rounded border border-gray-700">
            <button 
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="p-1 hover:bg-gray-800 text-gray-400 transition"
            >
                <Minus className="w-3 h-3" />
            </button>
            <input 
              type="number" 
              value={qty} 
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-12 bg-transparent text-center text-xs text-white outline-none font-mono py-1"
            />
            <button 
                onClick={() => setQty(qty + 1)}
                className="p-1 hover:bg-gray-800 text-gray-400 transition"
            >
                <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Buy/Sell Grid */}
        <div className="flex gap-2 h-16">
            {/* SELL BUTTON */}
            <button 
                onClick={() => handleExecute('Sell')}
                disabled={loadingState !== 'IDLE'}
                className="flex-1 bg-trade-down hover:bg-red-600 rounded flex flex-col items-center justify-center transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
                {loadingState === 'SELLING' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                    <>
                        <div className="text-[10px] font-bold text-red-100 uppercase mb-0.5">Sell</div>
                        <div className="text-sm font-mono font-bold text-white">{bidPrice.toFixed(2)}</div>
                        {/* Hover Effect */}
                        <div className="absolute inset-0 bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
                    </>
                )}
            </button>

            {/* SPREAD INDICATOR */}
            <div className="flex flex-col items-center justify-center text-[9px] text-gray-500 font-mono w-8">
                <span>{(spread).toFixed(2)}</span>
            </div>

            {/* BUY BUTTON */}
            <button 
                onClick={() => handleExecute('Buy')}
                disabled={loadingState !== 'IDLE'}
                className="flex-1 bg-trade-up hover:bg-green-600 rounded flex flex-col items-center justify-center transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
                 {loadingState === 'BUYING' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                    <>
                        <div className="text-[10px] font-bold text-green-100 uppercase mb-0.5">Buy</div>
                        <div className="text-sm font-mono font-bold text-white">{askPrice.toFixed(2)}</div>
                        {/* Hover Effect */}
                        <div className="absolute inset-0 bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingTradePanel;
