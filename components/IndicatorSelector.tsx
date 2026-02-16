
import React, { useState } from 'react';
import { ChartConfig, IndicatorType, Indicator } from '../types';
import { Activity, X, Plus, Trash2, Settings2, BarChart2, TrendingUp, Waves, Zap, Crosshair, ArrowDownUp } from 'lucide-react';

interface IndicatorSelectorProps {
  config: ChartConfig;
  onChange: (newConfig: Partial<ChartConfig>) => void;
  onClose: () => void;
}

const AVAILABLE_INDICATORS: { type: IndicatorType; name: string; icon: any; defaultPeriod: number; defaultColor: string }[] = [
    { type: 'SMA', name: 'Simple Moving Avg', icon: TrendingUp, defaultPeriod: 20, defaultColor: '#ff9800' },
    { type: 'EMA', name: 'Exponential Moving Avg', icon: Zap, defaultPeriod: 20, defaultColor: '#2962ff' },
    { type: 'Bollinger', name: 'Bollinger Bands', icon: Waves, defaultPeriod: 20, defaultColor: '#2962ff' },
    { type: 'RSI', name: 'RSI', icon: Activity, defaultPeriod: 14, defaultColor: '#800080' },
    { type: 'MACD', name: 'MACD', icon: BarChart2, defaultPeriod: 12, defaultColor: '#2962ff' },
    { type: 'ParabolicSAR', name: 'Parabolic SAR', icon: Crosshair, defaultPeriod: 0, defaultColor: '#089981' },
    { type: 'CCI', name: 'CCI', icon: ArrowDownUp, defaultPeriod: 20, defaultColor: '#e91e63' },
];

const IndicatorSelector: React.FC<IndicatorSelectorProps> = ({ config, onChange, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addIndicator = (type: IndicatorType, defaultPeriod: number, defaultColor: string) => {
      const newInd: Indicator = {
          id: Date.now().toString() + Math.random(),
          type,
          period: defaultPeriod,
          color: defaultColor,
          visible: true
      };
      onChange({ activeIndicators: [...config.activeIndicators, newInd] });
  };

  const removeIndicator = (id: string) => {
      onChange({ activeIndicators: config.activeIndicators.filter(i => i.id !== id) });
  };

  const updateIndicator = (id: string, updates: Partial<Indicator>) => {
      onChange({
          activeIndicators: config.activeIndicators.map(i => i.id === id ? { ...i, ...updates } : i)
      });
  };

  return (
    <div className="absolute top-14 left-0 md:left-[300px] z-50 bg-[#1e2026] border border-gray-700 rounded-lg shadow-xl w-80 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-trade-accent" /> Indicators
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {/* Active List */}
          {config.activeIndicators.length > 0 && (
              <div className="mb-4">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 px-1">Active on Chart</div>
                  <div className="space-y-2">
                      {config.activeIndicators.map(ind => (
                          <div key={ind.id} className="bg-[#15171c] rounded p-2 border border-gray-700">
                              <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{backgroundColor: ind.color}}></div>
                                      <span className="text-sm text-white font-medium">{ind.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <button onClick={() => setEditingId(editingId === ind.id ? null : ind.id)} className={`p-1 rounded hover:bg-gray-700 ${editingId === ind.id ? 'text-trade-accent' : 'text-gray-500'}`}>
                                          <Settings2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => removeIndicator(ind.id)} className="p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400">
                                          <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                  </div>
                              </div>
                              
                              {/* Edit Panel */}
                              {editingId === ind.id && (
                                  <div className="bg-[#0f1115] p-2 rounded grid grid-cols-2 gap-2 text-xs animate-in slide-in-from-top-1">
                                      {ind.type !== 'ParabolicSAR' && (
                                          <div>
                                              <label className="text-gray-500 block mb-1">Period</label>
                                              <input 
                                                type="number" 
                                                value={ind.period} 
                                                onChange={(e) => updateIndicator(ind.id, { period: parseInt(e.target.value) || 1 })}
                                                className="w-full bg-[#1e2026] border border-gray-700 rounded px-1 py-1 text-white"
                                              />
                                          </div>
                                      )}
                                      <div>
                                          <label className="text-gray-500 block mb-1">Color</label>
                                          <input 
                                            type="color" 
                                            value={ind.color} 
                                            onChange={(e) => updateIndicator(ind.id, { color: e.target.value })}
                                            className="w-full h-6 bg-transparent rounded cursor-pointer"
                                          />
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 px-1">Add Indicator</div>
          <div className="grid grid-cols-1 gap-1">
              {AVAILABLE_INDICATORS.map(avail => (
                  <button 
                    key={avail.type}
                    onClick={() => addIndicator(avail.type, avail.defaultPeriod, avail.defaultColor)}
                    className="flex items-center justify-between p-2 rounded hover:bg-[#2a2e39] group transition-colors text-left"
                  >
                      <div className="flex items-center gap-3">
                          <avail.icon className="w-4 h-4 text-gray-400 group-hover:text-trade-accent" />
                          <span className="text-sm text-gray-300 group-hover:text-white">{avail.name}</span>
                      </div>
                      <Plus className="w-3 h-3 text-gray-600 group-hover:text-white" />
                  </button>
              ))}
          </div>
      </div>
    </div>
  );
};

export default IndicatorSelector;
