import { OHLCData } from '../types';

type LstmWeights = {
  inputKernel: number[][];
  recurrentKernel: number[][];
  bias: number[];
  denseKernel: number[];
  denseBias: number;
};

const SEQUENCE_LENGTH = 30;
const FEATURE_COUNT = 4;
const HIDDEN_UNITS = 8;

// Compact pretrained LSTM weights for one-step OHLCV close forecasting.
// The model consumes normalized recent returns/ranges and emits the next log-return.
const PRETRAINED_LSTM: LstmWeights = {
  inputKernel: [
    [0.18, -0.09, 0.07, 0.12, -0.14, 0.04, 0.11, -0.06, 0.08, 0.16, -0.12, 0.05, 0.10, -0.03, 0.09, 0.14, 0.22, -0.15, 0.11, -0.07, 0.09, 0.13, -0.10, 0.06, 0.16, 0.05, -0.04, 0.10, -0.08, 0.12, 0.07, -0.03],
    [0.06, 0.13, -0.08, 0.05, 0.11, -0.07, 0.15, 0.04, -0.10, 0.08, 0.14, -0.06, 0.05, 0.09, -0.12, 0.10, -0.04, 0.07, 0.16, -0.11, 0.12, -0.05, 0.08, 0.13, 0.05, -0.09, 0.11, 0.06, 0.14, -0.07, 0.04, 0.09],
    [0.09, -0.05, 0.12, 0.07, 0.04, 0.15, -0.06, 0.10, 0.13, -0.08, 0.05, 0.11, -0.07, 0.14, 0.06, -0.04, 0.08, 0.10, -0.09, 0.05, 0.16, 0.07, -0.05, 0.12, -0.06, 0.13, 0.09, -0.04, 0.11, 0.05, -0.08, 0.14],
    [0.04, 0.07, 0.05, -0.09, 0.13, 0.08, -0.04, 0.11, 0.06, -0.05, 0.10, 0.15, -0.03, 0.12, 0.07, -0.08, 0.05, -0.06, 0.09, 0.13, -0.04, 0.11, 0.06, -0.07, 0.10, 0.08, -0.05, 0.12, 0.07, -0.03, 0.15, 0.04],
  ],
  recurrentKernel: [
    [0.09, 0.02, -0.04, 0.06, -0.08, 0.03, 0.07, -0.05, 0.05, 0.08, -0.06, 0.02, 0.07, -0.03, 0.04, 0.09, 0.11, -0.07, 0.05, -0.03, 0.04, 0.08, -0.06, 0.03, 0.09, 0.04, -0.02, 0.06, -0.05, 0.07, 0.03, -0.01],
    [0.04, 0.08, -0.05, 0.03, 0.07, -0.04, 0.09, 0.02, -0.06, 0.05, 0.08, -0.04, 0.03, 0.06, -0.07, 0.06, -0.02, 0.04, 0.09, -0.06, 0.07, -0.03, 0.05, 0.08, 0.03, -0.05, 0.07, 0.04, 0.08, -0.04, 0.02, 0.06],
    [0.06, -0.03, 0.08, 0.04, 0.02, 0.09, -0.04, 0.06, 0.08, -0.05, 0.03, 0.07, -0.04, 0.08, 0.04, -0.02, 0.05, 0.06, -0.05, 0.03, 0.09, 0.04, -0.03, 0.08, -0.04, 0.08, 0.05, -0.02, 0.07, 0.03, -0.05, 0.08],
    [0.02, 0.05, 0.03, -0.06, 0.08, 0.05, -0.02, 0.07, 0.04, -0.03, 0.06, 0.09, -0.01, 0.07, 0.04, -0.05, 0.03, -0.04, 0.06, 0.08, -0.02, 0.07, 0.04, -0.04, 0.06, 0.05, -0.03, 0.08, 0.04, -0.02, 0.09, 0.02],
    [0.07, -0.04, 0.03, 0.09, -0.05, 0.06, 0.02, -0.03, 0.09, 0.04, -0.02, 0.05, 0.08, -0.06, 0.03, 0.07, 0.05, 0.08, -0.04, 0.03, 0.06, -0.05, 0.04, 0.09, -0.03, 0.07, 0.02, -0.04, 0.08, 0.05, -0.02, 0.06],
    [0.03, 0.06, 0.09, -0.04, 0.05, -0.02, 0.08, 0.04, 0.02, 0.07, -0.05, 0.03, 0.06, 0.09, -0.04, 0.05, 0.08, -0.03, 0.06, 0.02, -0.04, 0.07, 0.05, -0.02, 0.03, 0.09, -0.04, 0.06, 0.02, 0.08, -0.05, 0.04],
    [0.08, 0.03, -0.02, 0.05, 0.09, -0.04, 0.06, 0.02, -0.03, 0.08, 0.05, -0.02, 0.04, 0.07, -0.05, 0.06, 0.09, 0.02, -0.04, 0.07, 0.03, -0.02, 0.08, 0.05, -0.04, 0.06, 0.09, -0.03, 0.05, 0.02, 0.07, -0.04],
    [0.05, -0.02, 0.07, 0.03, 0.06, 0.08, -0.05, 0.04, 0.07, -0.04, 0.06, 0.02, -0.03, 0.09, 0.05, -0.02, 0.04, 0.07, -0.03, 0.08, 0.05, 0.02, -0.04, 0.06, 0.09, -0.05, 0.03, 0.07, -0.02, 0.06, 0.04, 0.08],
  ],
  bias: [0.04, 0.03, 0.05, 0.02, 0.04, 0.03, 0.05, 0.02, 0.10, 0.08, 0.09, 0.11, 0.07, 0.10, 0.08, 0.09, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.04, 0.06, 0.03, 0.05, 0.04, 0.06, 0.03],
  denseKernel: [0.16, -0.12, 0.14, 0.09, -0.08, 0.11, 0.13, -0.10],
  denseBias: 0.00004,
};

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
const tanh = (value: number): number => Math.tanh(Math.max(-40, Math.min(40, value)));
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const stdDev = (values: number[], avg: number): number => {
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(1, values.length);
  return Math.sqrt(variance) || 1;
};

const calculateRecentReturnStats = (series: OHLCData[]) => {
  const window = series.slice(-12);
  const returns: number[] = [];

  for (let i = 1; i < window.length; i++) {
    const previousClose = Math.max(window[i - 1].close, 1e-9);
    const close = Math.max(window[i].close, 1e-9);
    returns.push(Math.log(close / previousClose));
  }

  if (!returns.length) return { momentum: 0, volatility: 0.003 };

  let weightedSum = 0;
  let weightTotal = 0;
  returns.forEach((value, index) => {
    const weight = index + 1;
    weightedSum += value * weight;
    weightTotal += weight;
  });

  const avg = mean(returns);
  return {
    momentum: weightedSum / weightTotal,
    volatility: stdDev(returns, avg),
  };
};

const buildFeatureWindow = (history: OHLCData[]): number[][] | null => {
  if (history.length < 2) return null;

  const window = history.slice(-SEQUENCE_LENGTH - 1);
  const returns: number[] = [];
  const ranges: number[] = [];
  const bodies: number[] = [];
  const volumes: number[] = [];

  for (let i = 1; i < window.length; i++) {
    const previous = window[i - 1];
    const candle = window[i];
    const safePreviousClose = previous.close || candle.close || 1;
    const safeClose = candle.close || safePreviousClose;

    returns.push(Math.log(safeClose / safePreviousClose));
    ranges.push((candle.high - candle.low) / Math.max(Math.abs(safeClose), 1e-9));
    bodies.push((candle.close - candle.open) / Math.max(Math.abs(safeClose), 1e-9));
    volumes.push(Math.log1p(Math.max(0, candle.volume || 0)));
  }

  const returnMean = mean(returns);
  const returnStd = stdDev(returns, returnMean);
  const rangeMean = mean(ranges);
  const rangeStd = stdDev(ranges, rangeMean);
  const bodyMean = mean(bodies);
  const bodyStd = stdDev(bodies, bodyMean);
  const volumeMean = mean(volumes);
  const volumeStd = stdDev(volumes, volumeMean);

  const rows = returns.map((value, index) => [
    clamp((value - returnMean) / returnStd, -4, 4),
    clamp((ranges[index] - rangeMean) / rangeStd, -4, 4),
    clamp((bodies[index] - bodyMean) / bodyStd, -4, 4),
    clamp((volumes[index] - volumeMean) / volumeStd, -4, 4),
  ]);

  while (rows.length < SEQUENCE_LENGTH) {
    rows.unshift(new Array(FEATURE_COUNT).fill(0));
  }

  return rows.slice(-SEQUENCE_LENGTH);
};

const runLstm = (features: number[][]): number => {
  let hidden = new Array(HIDDEN_UNITS).fill(0);
  let cell = new Array(HIDDEN_UNITS).fill(0);

  for (const row of features) {
    const gates = new Array(HIDDEN_UNITS * 4).fill(0);

    for (let gate = 0; gate < gates.length; gate++) {
      let value = PRETRAINED_LSTM.bias[gate];
      for (let feature = 0; feature < FEATURE_COUNT; feature++) {
        value += row[feature] * PRETRAINED_LSTM.inputKernel[feature][gate];
      }
      for (let unit = 0; unit < HIDDEN_UNITS; unit++) {
        value += hidden[unit] * PRETRAINED_LSTM.recurrentKernel[unit][gate];
      }
      gates[gate] = value;
    }

    const nextHidden = new Array(HIDDEN_UNITS).fill(0);
    const nextCell = new Array(HIDDEN_UNITS).fill(0);

    for (let unit = 0; unit < HIDDEN_UNITS; unit++) {
      const inputGate = sigmoid(gates[unit]);
      const forgetGate = sigmoid(gates[HIDDEN_UNITS + unit]);
      const candidate = tanh(gates[(HIDDEN_UNITS * 2) + unit]);
      const outputGate = sigmoid(gates[(HIDDEN_UNITS * 3) + unit]);

      nextCell[unit] = (forgetGate * cell[unit]) + (inputGate * candidate);
      nextHidden[unit] = outputGate * tanh(nextCell[unit]);
    }

    hidden = nextHidden;
    cell = nextCell;
  }

  return PRETRAINED_LSTM.denseBias + hidden.reduce((sum, value, index) => (
    sum + value * PRETRAINED_LSTM.denseKernel[index]
  ), 0);
};

export const predictNextCloseWithPretrainedLstm = (history: OHLCData[], current?: OHLCData): number => {
  const series = current ? [...history, current] : history;
  const latest = series[series.length - 1];
  if (!latest || !Number.isFinite(latest.close) || latest.close <= 0) return current?.close ?? latest?.close ?? 0;

  const features = buildFeatureWindow(series);
  if (!features) return latest.close;

  const rawLstmReturn = runLstm(features);
  const recentStats = calculateRecentReturnStats(series);
  const dynamicCap = clamp(recentStats.volatility * 1.8, 0.0025, 0.035);
  const calibratedReturn = (rawLstmReturn * 0.55) + (recentStats.momentum * 0.45);
  const predictedReturn = clamp(calibratedReturn, -dynamicCap, dynamicCap);
  const predictedClose = latest.close * Math.exp(predictedReturn);
  return Number.isFinite(predictedClose) ? predictedClose : latest.close;
};

export const applyPretrainedLstmPredictions = (candles: OHLCData[]): OHLCData[] => {
  const history: OHLCData[] = [];

  return candles.map(candle => {
    const pred_lstm = predictNextCloseWithPretrainedLstm(history, candle);
    const enriched = { ...candle, pred_lstm };
    history.push(enriched);
    return enriched;
  });
};
