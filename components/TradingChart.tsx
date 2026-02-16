
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, ChartOptions, DeepPartial, CrosshairMode } from 'lightweight-charts';
import { CandlestickChart, BarChart3, LineChart, AreaChart, ChevronDown, Clock, Brain } from 'lucide-react';
import { ChartConfig, OHLCData, Position, Drawing, ChartType, Indicator } from '../types';
import { getTimeframeConfig, calculateIndicatorData } from '../services/dataService';

interface TradingChartProps {
  data: OHLCData[];
  config: ChartConfig;
  symbol: string;
  positions?: Position[];
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
  onRemoveDrawing?: (id: string) => void;
  onChartTypeChange?: (type: ChartType) => void;
  theme: 'dark' | 'light';
}

const TradingChart: React.FC<TradingChartProps> = ({ data, config, symbol, positions, drawings, onAddDrawing, onRemoveDrawing, onChartTypeChange, theme }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Series Refs
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<any> | any>>(new Map());
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  // Hover Tooltip State
  const [hoveredCandle, setHoveredCandle] = useState<OHLCData | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);

  // --- 1. CHART INITIALIZATION (Run Once) ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Wait for container to have dimensions
    const width = chartContainerRef.current.clientWidth;
    const height = chartContainerRef.current.clientHeight;
    
    if (width === 0 || height === 0) {
      // Schedule retry if dimensions not ready
      const timer = setTimeout(() => {}, 100);
      return () => clearTimeout(timer);
    }

    // Determine colors based on theme
    const bgColor = theme === 'dark' ? '#0f1115' : '#ffffff';
    const textColor = theme === 'dark' ? '#d1d4dc' : '#111827';
    const gridColor = theme === 'dark' ? '#2a2e39' : '#e5e7eb';

    // Initialize Chart
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      width: width,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: true, // Always allow seconds for granular data
        borderColor: gridColor,
      },
      rightPriceScale: {
        borderColor: gridColor,
        scaleMargins: {
            top: 0.1, 
            bottom: 0.2, 
        }
      },
      crosshair: { mode: CrosshairMode.Normal }
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // Create Volume Series (Always exists, just cleared if hidden)
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    // Tooltip Logic
    chart.subscribeCrosshairMove(param => {
        if (
            param.point === undefined ||
            !param.time ||
            param.point.x < 0 ||
            param.point.x > chartContainerRef.current!.clientWidth ||
            param.point.y < 0 ||
            param.point.y > chartContainerRef.current!.clientHeight
        ) {
            setHoveredCandle(null);
            setCursorPos(null);
            return;
        }

        // Store cursor position for the react tooltip
        setCursorPos({ x: param.point.x, y: param.point.y });
    });

    return () => {
      // Cleanup to prevent "Value is null" errors on remount
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRefs.current.clear();
    };
  }, []); // Empty dependency array = Runs once on mount

  // --- THEME UPDATE EFFECT ---
  useEffect(() => {
      if (!chartRef.current) return;
      const bgColor = theme === 'dark' ? '#0f1115' : '#ffffff';
      const textColor = theme === 'dark' ? '#d1d4dc' : '#111827';
      const gridColor = theme === 'dark' ? '#2a2e39' : '#e5e7eb';

      chartRef.current.applyOptions({
          layout: { background: { type: ColorType.Solid, color: bgColor }, textColor },
          grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
          timeScale: { borderColor: gridColor },
          rightPriceScale: { borderColor: gridColor }
      });
  }, [theme]);

  // --- 2. RESIZE OBSERVER ---
  useEffect(() => {
      if (!chartContainerRef.current) return;
      
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || !entries[0].target) return;
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
            chartRef.current?.applyOptions({ width, height });
        }
      });
      resizeObserver.observe(chartContainerRef.current);
      return () => resizeObserver.disconnect();
  }, []);

  // --- 3. MAIN SERIES MANAGEMENT (Handle Chart Type Switching) ---
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove old main series
    if (mainSeriesRef.current) {
        try {
            chartRef.current.removeSeries(mainSeriesRef.current);
        } catch (e) {
            console.warn("Series removal error", e);
        }
        mainSeriesRef.current = null;
    }

    // Add new series based on type
    try {
        switch (config.chartType) {
            case 'bar':
                mainSeriesRef.current = chartRef.current.addBarSeries({ upColor: '#089981', downColor: '#f23645' });
                break;
            case 'line':
                mainSeriesRef.current = chartRef.current.addLineSeries({ color: '#2962ff', lineWidth: 2 });
                break;
            case 'area':
                mainSeriesRef.current = chartRef.current.addAreaSeries({ topColor: 'rgba(41, 98, 255, 0.4)', bottomColor: 'rgba(41, 98, 255, 0)', lineColor: '#2962ff', lineWidth: 2 });
                break;
            case 'candle':
            default:
                mainSeriesRef.current = chartRef.current.addCandlestickSeries({ upColor: '#089981', downColor: '#f23645', borderVisible: false, wickUpColor: '#089981', wickDownColor: '#f23645' });
                break;
        }
        // Trigger data update immediately after switching series
        updateChartData();
    } catch (e) {
        console.error("Error adding series:", e);
    }
  }, [config.chartType]);

  // --- 4. DATA UPDATE LOGIC ---
  const updateChartData = useCallback(() => {
    if (!chartRef.current) {
      console.warn("Chart not initialized");
      return;
    }
    if (!mainSeriesRef.current || !volumeSeriesRef.current) {
      console.warn("Series not initialized", { main: !!mainSeriesRef.current, volume: !!volumeSeriesRef.current });
      return;
    }
    if (!data || data.length === 0) {
      console.warn("No data available");
      return;
    }

    try {
        // Filter valid data and sort
        const sortedData = [...data]
            .filter(d => d.time !== undefined && !isNaN(d.close))
            .sort((a, b) => a.time - b.time);

        if (sortedData.length === 0) {
          console.warn("No valid sorted data after filtering");
          return;
        }

        // Prepare data for Lightweight Charts (Time must be in seconds as integers)
        const mainData = sortedData.map((d, index) => {
            // Round to integer seconds and ensure uniqueness
            let time = Math.floor(d.time / 1000);
            // Ensure strictly ascending by adding index if needed
            if (index > 0 && time <= Math.floor(sortedData[index - 1].time / 1000)) {
                time = Math.floor(sortedData[index - 1].time / 1000) + 1;
            }
            const timeValue = time as Time;
            if (config.chartType === 'line' || config.chartType === 'area') {
                return { time: timeValue, value: d.close };
            }
            return { time: timeValue, open: d.open, high: d.high, low: d.low, close: d.close };
        });

        const volData = config.showVolume 
            ? sortedData.map((d, index) => {
                // Use same time conversion as main data for consistency
                let time = Math.floor(d.time / 1000);
                if (index > 0 && time <= Math.floor(sortedData[index - 1].time / 1000)) {
                    time = Math.floor(sortedData[index - 1].time / 1000) + 1;
                }
                return { 
                    time: time as Time, 
                    value: d.volume || 0, 
                    color: d.close >= d.open ? 'rgba(8, 153, 129, 0.3)' : 'rgba(242, 54, 69, 0.3)' 
                };
            })
            : [];

        // Update Series
        mainSeriesRef.current.setData(mainData);
        volumeSeriesRef.current.setData(volData);

        // Update Position Markers
        if (positions) {
            const activePositionsForSymbol = positions.filter(p => p.symbol === symbol);
            const posMarkers = activePositionsForSymbol
                .filter(p => p.timestamp)
                .map(p => ({
                    time: Math.floor(p.timestamp / 1000) as Time,
                    position: p.type === 'Buy' ? 'belowBar' : 'aboveBar',
                    color: p.type === 'Buy' ? '#089981' : '#f23645',
                    shape: p.type === 'Buy' ? 'arrowUp' : 'arrowDown',
                    text: `${p.type.toUpperCase()} @ ${p.entryPrice.toFixed(2)}`
                }))
                .sort((a, b) => (a.time as number) - (b.time as number));
            
            // @ts-ignore
            mainSeriesRef.current.setMarkers(posMarkers);
        }

    } catch (e) { 
        console.warn("Chart update error:", e); 
    }
  }, [data, config.chartType, config.showVolume, positions, symbol]);

  // Effect to run data update when dependencies change
  useEffect(() => {
      updateChartData();
  }, [updateChartData]);

  // --- 5. INDICATORS UPDATE ---
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;
    
    // 1. Cleanup inactive
    const activeIds = new Set(config.activeIndicators.map(i => i.id));
    for (const [id, seriesObj] of indicatorSeriesRefs.current.entries()) {
        if (!activeIds.has(id)) {
            try {
                if (seriesObj.upper) { // BB
                    chartRef.current.removeSeries(seriesObj.upper);
                    chartRef.current.removeSeries(seriesObj.lower);
                    chartRef.current.removeSeries(seriesObj.average);
                } else if (seriesObj.macd) { // MACD
                    chartRef.current.removeSeries(seriesObj.macd);
                    chartRef.current.removeSeries(seriesObj.signal);
                    chartRef.current.removeSeries(seriesObj.histogram);
                } else {
                    chartRef.current.removeSeries(seriesObj);
                }
            } catch(e) { console.warn("Indicator cleanup error", e); }
            indicatorSeriesRefs.current.delete(id);
        }
    }

    // 2. Add/Update active
    config.activeIndicators.forEach(ind => {
        let seriesObj = indicatorSeriesRefs.current.get(ind.id);

        try {
            // Create if missing
            if (!seriesObj) {
                if (ind.type === 'Bollinger') {
                    const upper = chartRef.current!.addLineSeries({ color: ind.color, lineWidth: 1, title: 'BB Upper' });
                    const lower = chartRef.current!.addLineSeries({ color: ind.color, lineWidth: 1, title: 'BB Lower' });
                    const average = chartRef.current!.addLineSeries({ color: ind.color, lineWidth: 1, lineStyle: 2, title: 'BB Avg' });
                    seriesObj = { upper, lower, average };
                } else if (ind.type === 'MACD') {
                    const macd = chartRef.current!.addLineSeries({ color: '#2962ff', lineWidth: 2, priceScaleId: 'left', title: 'MACD' });
                    const signal = chartRef.current!.addLineSeries({ color: '#ff9800', lineWidth: 2, priceScaleId: 'left', title: 'Signal' });
                    const histogram = chartRef.current!.addHistogramSeries({ color: '#26a69a', priceScaleId: 'left' });
                    chartRef.current!.priceScale('left').applyOptions({ visible: true, scaleMargins: { top: 0.7, bottom: 0 } });
                    chartRef.current!.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.35 } });
                    seriesObj = { macd, signal, histogram };
                } else if (ind.type === 'RSI' || ind.type === 'CCI') {
                    seriesObj = chartRef.current!.addLineSeries({ color: ind.color, lineWidth: 2, priceScaleId: 'left', title: ind.type });
                    chartRef.current!.priceScale('left').applyOptions({ visible: true, scaleMargins: { top: 0.7, bottom: 0 } });
                    chartRef.current!.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.35 } });
                } else {
                    seriesObj = chartRef.current!.addLineSeries({ color: ind.color, lineWidth: 2, title: ind.type });
                }
                indicatorSeriesRefs.current.set(ind.id, seriesObj);
            }

            // Calculate Data
            const calculated: any = calculateIndicatorData(data, ind.type, ind.period);
            
            // Ensure strictly ascending timestamps in indicator data
            const ensureAscending = (arr: any[]) => {
                if (!arr || arr.length === 0) return arr;
                const result = [];
                let lastTime = -1;
                for (let i = 0; i < arr.length; i++) {
                    let time = arr[i].time;
                    if (typeof time !== 'number') time = parseInt(time as string);
                    if (time <= lastTime) {
                        time = lastTime + 1;
                    }
                    lastTime = time;
                    result.push({ ...arr[i], time: time as Time });
                }
                return result;
            };
            
            // Update Series Data
            if (ind.type === 'Bollinger') {
                seriesObj.upper.setData(ensureAscending(calculated.upper));
                seriesObj.lower.setData(ensureAscending(calculated.lower));
                seriesObj.average.setData(ensureAscending(calculated.average));
            } else if (ind.type === 'MACD') {
                seriesObj.macd.setData(ensureAscending(calculated.macd));
                seriesObj.signal.setData(ensureAscending(calculated.signal));
                seriesObj.histogram.setData(ensureAscending(calculated.histogram));
            } else {
                seriesObj.setData(ensureAscending(calculated));
                seriesObj.applyOptions({ color: ind.color });
                 if (ind.type === 'ParabolicSAR') {
                    seriesObj.applyOptions({ lineWidth: 0, lineStyle: 3, crosshairMarkerVisible: false });
                }
            }
        } catch (e) {
            console.warn(`Error updating indicator ${ind.type}:`, e);
        }
    });
  }, [config.activeIndicators, data]);

    // --- CANDLE TIMER ---
  useEffect(() => {
    const updateTimer = () => {
        const now = Date.now();
        const { interval } = getTimeframeConfig(config.timeframe);
        const msLeft = interval - (now % interval);
        const seconds = Math.floor((msLeft / 1000) % 60);
        const minutes = Math.floor((msLeft / (1000 * 60)) % 60);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    const timerId = setInterval(updateTimer, 1000);
    updateTimer(); 
    return () => clearInterval(timerId);
  }, [config.timeframe]);

  // Drawing Logic Helpers
  const getChartCoordinates = (e: React.MouseEvent) => {
      if (!chartRef.current || !mainSeriesRef.current || !overlayRef.current) return null;
      const rect = overlayRef.current.getBoundingClientRect();
      const time = chartRef.current.timeScale().coordinateToTime(e.clientX - rect.left);
      const price = mainSeriesRef.current.coordinateToPrice(e.clientY - rect.top);
      return (time && price) ? { time: time as number, price: price as number, x: e.clientX - rect.left, y: e.clientY - rect.top } : null;
  };
  const getScreenCoordinates = (time: number, price: number) => {
      if (!chartRef.current || !mainSeriesRef.current) return null;
      const x = chartRef.current.timeScale().timeToCoordinate(time as Time);
      const y = mainSeriesRef.current.priceToCoordinate(price);
      return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (config.activeTool === 'cursor') return;
      const coords = getChartCoordinates(e);
      if (!coords) return;
      if (config.activeTool === 'horizontal') {
          onAddDrawing({ id: Date.now().toString(), type: 'horizontal', startTime: coords.time, startPrice: coords.price, color: config.drawingColor });
          return;
      }
      setIsDrawing(true);
      setCurrentDrawing({ id: Date.now().toString(), type: config.activeTool as any, startTime: coords.time, startPrice: coords.price, color: config.drawingColor });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (config.activeTool === 'cursor' && !isDrawing) return;
      const coords = getChartCoordinates(e);
      if (isDrawing && currentDrawing && coords) {
          setCurrentDrawing(prev => ({ ...prev, endTime: coords.time, endPrice: coords.price }));
      }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      if (!isDrawing) return;
      const coords = getChartCoordinates(e);
      if (currentDrawing?.startTime && currentDrawing?.startPrice) {
          onAddDrawing({ 
              id: currentDrawing.id!, type: currentDrawing.type!, startTime: currentDrawing.startTime, startPrice: currentDrawing.startPrice, 
              endTime: coords?.time || currentDrawing.startTime, endPrice: coords?.price || currentDrawing.startPrice, color: currentDrawing.color! 
          });
      }
      setIsDrawing(false);
      setCurrentDrawing(null);
  };

  // Synchronize hover lookup
  useEffect(() => {
    if (cursorPos && chartRef.current) {
       if (hoveredCandle) {
           const updated = data.find(d => Math.floor(d.time/1000) === (hoveredCandle.time as any)); // rough check
           if (updated) setHoveredCandle(updated);
       }
    }
  }, [data]);

  const renderDrawing = (d: Partial<Drawing>, isPreview = false) => {
      if (!d.startTime || !d.startPrice) return null;
      const start = getScreenCoordinates(d.startTime, d.startPrice);
      const end = (d.endTime && d.endPrice) ? getScreenCoordinates(d.endTime, d.endPrice) : start;
      if (!start || !start.y || (d.type !== 'horizontal' && (!end || !end.x))) return null;

      const CommonProps = { stroke: d.color, strokeWidth: "2", className: isPreview ? "opacity-50" : "cursor-pointer" };
      
      if (d.type === 'horizontal') return (
           <g key={d.id}>
               <line x1="0" y1={start.y} x2="100%" y2={start.y} {...CommonProps} strokeDasharray="4 4" />
               <line x1="0" y1={start.y} x2="100%" y2={start.y} stroke="transparent" strokeWidth="10" onDoubleClick={(e) => {e.stopPropagation(); onRemoveDrawing?.(d.id!)}} className="cursor-pointer" />
           </g>
      );
      if (d.type === 'line' && start && end) return (
          <g key={d.id}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...CommonProps} />
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="10" onDoubleClick={(e) => {e.stopPropagation(); onRemoveDrawing?.(d.id!)}} className="cursor-pointer" />
          </g>
      );
      if (d.type === 'rect' && start && end) {
          // Safety check for null coordinates
          const startX = start.x ?? 0;
          const startY = start.y ?? 0;
          const endX = end.x ?? startX;
          const endY = end.y ?? startY;

          const x = Math.min(startX, endX);
          const y = Math.min(startY, endY);
          return (
              <g key={d.id} onDoubleClick={(e) => {e.stopPropagation(); onRemoveDrawing?.(d.id!)}}>
                  <rect x={x} y={y} width={Math.abs(endX - startX)} height={Math.abs(endY - startY)} {...CommonProps} fill={d.color} fillOpacity="0.1" />
              </g>
          );
      }
      return null;
  };

  const ChartTypeIcon = () => config.chartType === 'line' ? <LineChart className="w-4 h-4" /> : config.chartType === 'bar' ? <BarChart3 className="w-4 h-4" /> : config.chartType === 'area' ? <AreaChart className="w-4 h-4" /> : <CandlestickChart className="w-4 h-4" />;

  const currentCandle = data[data.length - 1];

  return (
    <div className="h-full w-full relative group bg-trade-bg">
       <div ref={chartContainerRef} className="w-full h-full" />
       
       <div ref={overlayRef} className="absolute inset-0 z-20" style={{ pointerEvents: config.activeTool === 'cursor' ? 'none' : 'auto' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
         <svg className="w-full h-full overflow-hidden">
             {drawings.map(d => renderDrawing(d, false))}
             {isDrawing && currentDrawing && renderDrawing(currentDrawing, true)}
         </svg>
       </div>

       {/* --- HOVER TOOLTIP --- */}
       {hoveredCandle && cursorPos && (
           <div 
                className="absolute z-50 bg-trade-panel/95 border border-trade-border p-3 rounded shadow-xl backdrop-blur-sm pointer-events-none text-xs w-48 animate-in fade-in zoom-in-95 duration-75"
                style={{
                    left: Math.min(cursorPos.x + 15, (chartContainerRef.current?.clientWidth || 0) - 200),
                    top: Math.min(cursorPos.y + 15, (chartContainerRef.current?.clientHeight || 0) - 200)
                }}
           >
               <div className="text-trade-text-muted mb-1 font-mono text-[10px] border-b border-trade-border pb-1">
                   {new Date(hoveredCandle.time).toLocaleString()}
               </div>
               
               {/* OHLC */}
               <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-3 text-trade-text-muted font-mono">
                   <div className="flex justify-between"><span>O:</span> <span className={hoveredCandle.open > hoveredCandle.close ? 'text-trade-down' : 'text-trade-up'}>{hoveredCandle.open.toFixed(2)}</span></div>
                   <div className="flex justify-between"><span>H:</span> <span className="text-trade-text">{hoveredCandle.high.toFixed(2)}</span></div>
                   <div className="flex justify-between"><span>L:</span> <span className="text-trade-text">{hoveredCandle.low.toFixed(2)}</span></div>
                   <div className="flex justify-between"><span>C:</span> <span className={hoveredCandle.close >= hoveredCandle.open ? 'text-trade-up' : 'text-trade-down'}>{hoveredCandle.close.toFixed(2)}</span></div>
               </div>
               
               {/* Actual Price */}
               <div className="flex justify-between items-center mb-2 font-bold bg-trade-panel-focus p-1.5 rounded">
                    <span className="text-trade-text-muted">Actual Price</span>
                    <span className="text-trade-text font-mono">{hoveredCandle.close.toFixed(2)}</span>
               </div>

               {/* Predictions */}
               {config.showPredictions && (
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 mb-1.5">
                            <Brain className="w-3 h-3" /> AI Model Forecast
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-trade-text-muted">LSTM</span>
                                <span className="font-mono text-blue-300">{hoveredCandle.pred_lstm?.toFixed(2) || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-trade-text-muted">XGBoost</span>
                                <span className="font-mono text-indigo-300">{hoveredCandle.pred_xgboost?.toFixed(2) || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-trade-text-muted">Random Forest</span>
                                <span className="font-mono text-pink-300">{hoveredCandle.pred_rf?.toFixed(2) || '-'}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-trade-text-muted">ARIMA</span>
                                <span className="font-mono text-yellow-300">{hoveredCandle.pred_arima?.toFixed(2) || '-'}</span>
                            </div>
                        </div>
                    </div>
               )}
           </div>
       )}

       <div className="absolute top-4 left-4 z-30 font-sans text-left pointer-events-none">
          <div className="flex items-center gap-3 select-none pointer-events-auto">
              <h2 className="text-xl md:text-2xl font-bold text-trade-text tracking-tight drop-shadow-md flex items-center gap-2">
                  {symbol} <span className="text-xs font-medium text-trade-text-muted bg-trade-panel px-1.5 py-0.5 rounded border border-trade-border">{config.timeframe}</span>
              </h2>
              {onChartTypeChange && (
                  <div className="relative">
                      <button onClick={() => setIsTypeSelectorOpen(!isTypeSelectorOpen)} className="flex items-center gap-1 bg-trade-panel hover:bg-trade-panel-focus text-trade-text-muted hover:text-trade-text px-2 py-1 rounded border border-trade-border transition-colors pointer-events-auto">
                          <ChartTypeIcon /> <ChevronDown className="w-3 h-3" />
                      </button>
                      {isTypeSelectorOpen && (
                          <div className="absolute top-full left-0 mt-1 w-32 bg-trade-panel border border-trade-border rounded shadow-xl py-1 z-50 pointer-events-auto">
                              {['candle', 'bar', 'line', 'area'].map(t => (
                                  <button key={t} onClick={() => { onChartTypeChange(t as ChartType); setIsTypeSelectorOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-trade-panel-focus text-trade-text-muted capitalize">{t}</button>
                              ))}
                          </div>
                      )}
                      {isTypeSelectorOpen && <div className="fixed inset-0 z-40" onClick={() => setIsTypeSelectorOpen(false)}></div>}
                  </div>
              )}
          </div>
          
          <div className="flex items-baseline gap-3 mt-1 pointer-events-none">
             <span className={`text-3xl font-mono font-bold drop-shadow-sm ${currentCandle && currentCandle.close >= currentCandle.open ? 'text-trade-up' : 'text-trade-down'}`}>
                {currentCandle?.close?.toFixed(2) || '0.00'}
             </span>
             <div className="flex items-center gap-2">
                 <span className="text-[10px] text-white font-bold bg-red-600/90 px-1.5 py-px rounded animate-pulse shadow-sm tracking-wider">LIVE</span>
                 <div className="flex items-center gap-1 bg-trade-panel px-1.5 py-px rounded border border-trade-border">
                     <Clock className="w-3 h-3 text-trade-text-muted" />
                     <span className="text-xs font-mono text-trade-text-muted font-medium">{timeLeft}</span>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default TradingChart;
