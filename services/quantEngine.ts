/**
 * TRADEMIND AI — Quantitative Portfolio Optimization Engine
 * ==========================================================
 * Implements the mathematical frameworks from the research paper:
 *   - Mean-Variance Optimization (MVO / Markowitz)
 *   - Black-Litterman Model (Bayesian expected returns)
 *   - Hierarchical Risk Parity (HRP — López de Prado)
 *   - Kelly Criterion / Fractional Kelly for position sizing
 *   - Ledoit-Wolf Shrinkage for covariance estimation
 *   - Risk metrics: CVaR, Sortino, Max Drawdown, CDaR
 *   - Transaction cost penalty & constraint handling
 */

// ─── Helpers ──────────────────────────────────────────────

/** Log-returns from a price series */
export function logReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push(Math.log(prices[i] / prices[i - 1]));
  }
  return r;
}

/** Simple returns from a price series */
export function simpleReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push(prices[i] / prices[i - 1] - 1);
  }
  return r;
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length || 1));
}

// ─── Matrix helpers (pure JS, no deps) ───────────────────

type Matrix = number[][];
type Vector = number[];

function zeros(n: number, m: number): Matrix {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

function eye(n: number): Matrix {
  const I = zeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function matMul(A: Matrix, B: Matrix): Matrix {
  const n = A.length, p = B[0].length, m = B.length;
  const C = zeros(n, p);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < m; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matVecMul(A: Matrix, v: Vector): Vector {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

function transpose(A: Matrix): Matrix {
  const n = A.length, m = A[0].length;
  const T = zeros(m, n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      T[j][i] = A[i][j];
  return T;
}

function matAdd(A: Matrix, B: Matrix): Matrix {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function matScale(A: Matrix, s: number): Matrix {
  return A.map(row => row.map(v => v * s));
}

/** Cholesky-based inversion for symmetric positive-definite matrices */
function invertSPD(M: Matrix): Matrix {
  const n = M.length;
  // LU decomposition fallback via Gauss-Jordan
  const aug: Matrix = M.map((row, i) => [...row, ...eye(n)[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-14) {
      // Add regularisation
      aug[col][col] += 1e-8;
    }
    const p = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= p;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

// ─── Covariance estimation ────────────────────────────────

/** Sample covariance matrix from a matrix of returns (assets × observations) */
export function sampleCovMatrix(returnMatrix: number[][]): Matrix {
  const n = returnMatrix.length;
  const T = returnMatrix[0].length;
  const means = returnMatrix.map(r => mean(r));
  const cov = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) {
        s += (returnMatrix[i][t] - means[i]) * (returnMatrix[j][t] - means[j]);
      }
      cov[i][j] = s / (T - 1);
      cov[j][i] = cov[i][j];
    }
  }
  return cov;
}

/**
 * Ledoit-Wolf Shrinkage Estimator
 * Σ_shrink = δF + (1 − δ)S
 * where F = constant-correlation target, S = sample covariance
 */
export function ledoitWolfShrinkage(returnMatrix: number[][]): { sigma: Matrix; shrinkageIntensity: number } {
  const S = sampleCovMatrix(returnMatrix);
  const n = S.length;
  const T = returnMatrix[0].length;

  // Compute constant correlation target F
  const stddevs = S.map((_, i) => Math.sqrt(Math.max(1e-12, S[i][i])));
  let sumCorr = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumCorr += S[i][j] / (stddevs[i] * stddevs[j]);
      count++;
    }
  }
  const avgCorr = count > 0 ? sumCorr / count : 0;

  const F = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      F[i][j] = i === j ? S[i][i] : avgCorr * stddevs[i] * stddevs[j];
    }
  }

  // Compute optimal shrinkage intensity δ (simplified Ledoit-Wolf)
  const means = returnMatrix.map(r => mean(r));
  let piSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) {
        const xi = (returnMatrix[i][t] - means[i]) * (returnMatrix[j][t] - means[j]) - S[i][j];
        s += xi * xi;
      }
      piSum += s / T;
    }
  }
  const pi = piSum;

  let gammaSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      gammaSum += (F[i][j] - S[i][j]) ** 2;
    }
  }

  const kappa = (pi / T) / Math.max(1e-10, gammaSum);
  const delta = Math.max(0, Math.min(1, kappa));

  const sigma = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sigma[i][j] = delta * F[i][j] + (1 - delta) * S[i][j];
    }
  }

  return { sigma, shrinkageIntensity: delta };
}

// ─── Mean-Variance Optimization (Markowitz) ──────────────

export interface MVOResult {
  weights: number[];
  expectedReturn: number;
  portfolioVolatility: number;
  sharpeRatio: number;
}

/**
 * Maximize: w^T μ − (λ/2) w^T Σ w
 * subject to: Σ w_i = 1, w_i ≥ 0 (long-only)
 *
 * Analytical solution (unconstrained): w* = (1/λ) Σ^{-1} μ, then normalised.
 * Long-only constraint enforced by projection + renormalisation.
 */
export function meanVarianceOptimize(
  mu: Vector,
  sigma: Matrix,
  lambda: number = 2.5,
  riskFreeRate: number = 0.04 / 252 // daily
): MVOResult {
  const n = mu.length;
  const sigmaInv = invertSPD(sigma);

  // Excess returns
  const excess = mu.map(m => m - riskFreeRate);
  let raw = matVecMul(sigmaInv, excess).map(w => w / lambda);

  // Long-only projection
  raw = raw.map(w => Math.max(0, w));
  const wSum = raw.reduce((a, b) => a + b, 0);
  const weights = wSum > 0 ? raw.map(w => w / wSum) : new Array(n).fill(1 / n);

  const expectedReturn = weights.reduce((s, w, i) => s + w * mu[i], 0);
  const wSigmaW = weights.reduce((s1, wi, i) =>
    s1 + weights.reduce((s2, wj, j) => s2 + wi * wj * sigma[i][j], 0), 0);
  const portfolioVolatility = Math.sqrt(Math.max(0, wSigmaW));
  const sharpeRatio = portfolioVolatility > 0
    ? (expectedReturn - riskFreeRate) / portfolioVolatility
    : 0;

  return { weights, expectedReturn, portfolioVolatility, sharpeRatio };
}

// ─── Black-Litterman Model ───────────────────────────────

export interface BLView {
  assetIndex: number;       // which asset this absolute view is about
  expectedReturn: number;   // Q_k — the view return
  confidence: number;       // 0→1, higher = more confident
}

export interface BLResult {
  posteriorMu: Vector;
  weights: number[];
  expectedReturn: number;
  portfolioVolatility: number;
}

/**
 * Black-Litterman posterior:
 *   Π = δ Σ w_mkt                        (implied equilibrium returns)
 *   μ_BL = [(τΣ)^{-1} + P^T Ω^{-1} P]^{-1} [(τΣ)^{-1} Π + P^T Ω^{-1} Q]
 */
export function blackLitterman(
  sigma: Matrix,
  marketWeights: Vector,
  views: BLView[],
  delta: number = 2.5,
  tau: number = 0.05
): BLResult {
  const n = sigma.length;

  // Step 1: Implied equilibrium returns Π = δ Σ w_mkt
  const Pi = matVecMul(sigma, marketWeights).map(v => v * delta);

  if (views.length === 0) {
    // No views → return market portfolio
    const mvo = meanVarianceOptimize(Pi, sigma, delta);
    return {
      posteriorMu: Pi,
      weights: marketWeights,
      expectedReturn: mvo.expectedReturn,
      portfolioVolatility: mvo.portfolioVolatility,
    };
  }

  // Step 2: Construct P (k × n), Q (k × 1), Ω (k × k)
  const k = views.length;
  const P = zeros(k, n);
  const Q: Vector = [];
  const Omega = zeros(k, k);

  views.forEach((v, idx) => {
    P[idx][v.assetIndex] = 1;
    Q.push(v.expectedReturn);
    // Ω_kk = (1/confidence − 1) × τ × σ_ii
    const uncertainty = ((1 / Math.max(0.01, v.confidence)) - 1) * tau * sigma[v.assetIndex][v.assetIndex];
    Omega[idx][idx] = Math.max(1e-10, uncertainty);
  });

  // Step 3: Compute posterior μ_BL
  const tauSigma = matScale(sigma, tau);
  const tauSigmaInv = invertSPD(tauSigma);

  const PT = transpose(P);
  const OmegaInv = invertSPD(Omega);

  // A = (τΣ)^{-1} + P^T Ω^{-1} P
  const PtOmegaInvP = matMul(matMul(PT, OmegaInv), P);
  const A = matAdd(tauSigmaInv, PtOmegaInvP);
  const AInv = invertSPD(A);

  // b = (τΣ)^{-1} Π + P^T Ω^{-1} Q
  const term1 = matVecMul(tauSigmaInv, Pi);
  const term2 = matVecMul(matMul(PT, OmegaInv), Q);
  const b = term1.map((v, i) => v + term2[i]);

  const posteriorMu = matVecMul(AInv, b);

  // Step 4: Optimise with posterior
  const mvo = meanVarianceOptimize(posteriorMu, sigma, delta);
  return {
    posteriorMu,
    weights: mvo.weights,
    expectedReturn: mvo.expectedReturn,
    portfolioVolatility: mvo.portfolioVolatility,
  };
}

// ─── Hierarchical Risk Parity (HRP) ─────────────────────

export interface HRPResult {
  weights: number[];
  clusterOrder: number[];
}

/** Correlation distance: d_ij = sqrt(0.5(1 − ρ_ij)) */
function correlationDistance(sigma: Matrix): Matrix {
  const n = sigma.length;
  const stddevs = sigma.map((_, i) => Math.sqrt(Math.max(1e-12, sigma[i][i])));
  const dist = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const rho = sigma[i][j] / (stddevs[i] * stddevs[j]);
      dist[i][j] = Math.sqrt(0.5 * (1 - Math.min(1, Math.max(-1, rho))));
    }
  }
  return dist;
}

/** Single-linkage agglomerative clustering; returns merge order */
function hierarchicalCluster(dist: Matrix): number[] {
  const n = dist.length;
  const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const active = new Set<number>(Array.from({ length: n }, (_, i) => i));
  const order: number[] = Array.from({ length: n }, (_, i) => i);

  const d = dist.map(row => [...row]);

  while (active.size > 1) {
    let minD = Infinity, a = -1, b = -1;
    const ids = [...active];
    for (let ii = 0; ii < ids.length; ii++) {
      for (let jj = ii + 1; jj < ids.length; jj++) {
        if (d[ids[ii]][ids[jj]] < minD) {
          minD = d[ids[ii]][ids[jj]];
          a = ids[ii];
          b = ids[jj];
        }
      }
    }
    if (a < 0) break;

    // Merge b into a
    clusters[a] = [...clusters[a], ...clusters[b]];
    active.delete(b);

    // Update distances (single linkage)
    for (const c of active) {
      if (c === a) continue;
      d[a][c] = Math.min(d[a][c], d[b][c]);
      d[c][a] = d[a][c];
    }
  }

  // The final cluster order
  const remaining = [...active][0];
  return clusters[remaining];
}

/** Recursive bisection allocation */
function recursiveBisect(sigma: Matrix, sortedIdx: number[]): number[] {
  const n = sigma.length;
  const w = new Array(n).fill(1);

  const bisect = (items: number[]) => {
    if (items.length <= 1) return;
    const half = Math.floor(items.length / 2);
    const left = items.slice(0, half);
    const right = items.slice(half);

    // Cluster variance = sum of diagonal elements
    const leftVar = left.reduce((s, i) => s + sigma[i][i], 0) / Math.max(1, left.length);
    const rightVar = right.reduce((s, i) => s + sigma[i][i], 0) / Math.max(1, right.length);

    const invLeft = 1 / Math.max(1e-10, leftVar);
    const invRight = 1 / Math.max(1e-10, rightVar);
    const alpha = invLeft / (invLeft + invRight);

    left.forEach(i => (w[i] *= alpha));
    right.forEach(i => (w[i] *= (1 - alpha)));

    bisect(left);
    bisect(right);
  };

  bisect(sortedIdx);

  const wSum = w.reduce((a, b) => a + b, 0);
  return w.map(v => v / wSum);
}

export function hierarchicalRiskParity(sigma: Matrix): HRPResult {
  const dist = correlationDistance(sigma);
  const clusterOrder = hierarchicalCluster(dist);
  const weights = recursiveBisect(sigma, clusterOrder);
  return { weights, clusterOrder };
}

// ─── Kelly Criterion ─────────────────────────────────────

/**
 * Multi-asset Full Kelly: f = Σ^{-1} (μ − r·1)
 * Fractional Kelly: fraction × f
 */
export function kellyCriterion(
  mu: Vector,
  sigma: Matrix,
  riskFreeRate: number = 0.04 / 252,
  fraction: number = 0.5
): { weights: number[]; fullKellyWeights: number[] } {
  const n = mu.length;
  const sigmaInv = invertSPD(sigma);
  const excess = mu.map(m => m - riskFreeRate);
  const fullKelly = matVecMul(sigmaInv, excess);

  // Fractional Kelly
  let fractional = fullKelly.map(w => w * fraction);

  // Long-only + normalise
  fractional = fractional.map(w => Math.max(0, w));
  const wSum = fractional.reduce((a, b) => a + b, 0);
  const weights = wSum > 0 ? fractional.map(w => w / wSum) : new Array(n).fill(1 / n);

  return { weights, fullKellyWeights: fullKelly };
}

// ─── Risk Metrics ────────────────────────────────────────

export interface RiskMetrics {
  annualisedReturn: number;
  annualisedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  cvar95: number;
  var95: number;
  calmarRatio: number;
}

export function computeRiskMetrics(returns: number[], riskFreeRate: number = 0.04 / 252): RiskMetrics {
  const n = returns.length;
  if (n < 2) {
    return { annualisedReturn: 0, annualisedVolatility: 0, sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, cvar95: 0, var95: 0, calmarRatio: 0 };
  }

  const mu = mean(returns);
  const vol = stddev(returns);
  const annualisedReturn = mu * 252;
  const annualisedVolatility = vol * Math.sqrt(252);
  const sharpeRatio = vol > 0 ? (mu - riskFreeRate) / vol * Math.sqrt(252) : 0;

  // Sortino — downside deviation
  const negReturns = returns.filter(r => r < 0);
  const downsideDev = negReturns.length > 0
    ? Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length)
    : 1e-10;
  const sortinoRatio = (mu - riskFreeRate) / downsideDev * Math.sqrt(252);

  // Max Drawdown
  let peak = 1, maxDD = 0, cumulative = 1;
  for (const r of returns) {
    cumulative *= (1 + r);
    if (cumulative > peak) peak = cumulative;
    const dd = (peak - cumulative) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // VaR (95%) and CVaR (95%)
  const sorted = [...returns].sort((a, b) => a - b);
  const idx5 = Math.max(0, Math.floor(n * 0.05) - 1);
  const var95 = -sorted[idx5];
  const cvar95 = -mean(sorted.slice(0, idx5 + 1));

  const calmarRatio = maxDD > 0 ? annualisedReturn / maxDD : 0;

  return { annualisedReturn, annualisedVolatility, sharpeRatio, sortinoRatio, maxDrawdown: maxDD, cvar95, var95, calmarRatio };
}

// ─── Efficient Frontier ──────────────────────────────────

export interface EfficientFrontierPoint {
  risk: number;
  ret: number;
  weights: number[];
}

export function computeEfficientFrontier(mu: Vector, sigma: Matrix, points: number = 20): EfficientFrontierPoint[] {
  const frontier: EfficientFrontierPoint[] = [];
  for (let i = 0; i < points; i++) {
    const lambda = 0.1 + (i / (points - 1)) * 15;
    const mvo = meanVarianceOptimize(mu, sigma, lambda);
    frontier.push({
      risk: mvo.portfolioVolatility,
      ret: mvo.expectedReturn,
      weights: mvo.weights,
    });
  }
  return frontier;
}

// ─── Transaction Cost Penalty ────────────────────────────

export function applyTransactionCostPenalty(
  newWeights: number[],
  oldWeights: number[],
  costCoefficient: number = 0.001
): { adjustedWeights: number[]; turnover: number; estimatedCost: number } {
  const turnover = newWeights.reduce((s, w, i) => s + Math.abs(w - (oldWeights[i] || 0)), 0);
  const estimatedCost = turnover * costCoefficient;

  // Only rebalance if benefit exceeds cost (simplified)
  if (turnover < 0.02) {
    return { adjustedWeights: oldWeights.length === newWeights.length ? oldWeights : newWeights, turnover: 0, estimatedCost: 0 };
  }

  return { adjustedWeights: newWeights, turnover, estimatedCost };
}

// ─── Master Orchestrator ─────────────────────────────────

export type OptimizationStrategy = 'MVO' | 'HRP' | 'BL' | 'KELLY';

export interface QuantOptimizationInput {
  symbols: string[];
  priceMatrix: number[][];       // symbols.length arrays of closing prices
  strategy: OptimizationStrategy;
  riskAversion: number;          // λ (1–10 scale, converted internally)
  kellyFraction: number;         // 0.25–1.0
  useLedoitWolf: boolean;
  includeTransactionCosts: boolean;
  views?: BLView[];
  currentWeights?: number[];
  investableCapital: number;
}

export interface QuantOptimizationResult {
  strategy: OptimizationStrategy;
  weights: number[];
  symbols: string[];
  expectedReturn: number;
  portfolioVolatility: number;
  riskMetrics: RiskMetrics;
  efficientFrontier: EfficientFrontierPoint[];
  shrinkageIntensity: number;
  turnover: number;
  transactionCostEstimate: number;
  allocations: { symbol: string; weight: number; amount: number; qty: number }[];
  methodology: string;
  timestamp: number;
}

export function runQuantOptimization(input: QuantOptimizationInput): QuantOptimizationResult {
  const {
    symbols, priceMatrix, strategy, riskAversion, kellyFraction,
    useLedoitWolf, includeTransactionCosts, views, currentWeights, investableCapital
  } = input;

  const n = symbols.length;

  // 1) Compute return matrix
  const returnMatrix = priceMatrix.map(prices => simpleReturns(prices));
  const mu = returnMatrix.map(r => mean(r));

  // 2) Covariance estimation
  let sigma: Matrix;
  let shrinkageIntensity = 0;
  if (useLedoitWolf) {
    const lw = ledoitWolfShrinkage(returnMatrix);
    sigma = lw.sigma;
    shrinkageIntensity = lw.shrinkageIntensity;
  } else {
    sigma = sampleCovMatrix(returnMatrix);
  }

  // Add small regularisation to diagonal
  for (let i = 0; i < n; i++) {
    sigma[i][i] += 1e-8;
  }

  // 3) Run chosen strategy
  const lambda = riskAversion * 1.0; // Scale 1–10
  let weights: number[];
  let methodDesc: string;

  switch (strategy) {
    case 'MVO': {
      const result = meanVarianceOptimize(mu, sigma, lambda);
      weights = result.weights;
      methodDesc = `Mean-Variance Optimization (Markowitz) | λ=${lambda.toFixed(1)} | Ledoit-Wolf=${useLedoitWolf}`;
      break;
    }
    case 'BL': {
      const mktWeights = new Array(n).fill(1 / n); // Equal-weight market proxy
      const result = blackLitterman(sigma, mktWeights, views || [], lambda, 0.05);
      weights = result.weights;
      methodDesc = `Black-Litterman Bayesian Model | δ=${lambda.toFixed(1)} | τ=0.05 | Views=${(views || []).length} | Ledoit-Wolf=${useLedoitWolf}`;
      break;
    }
    case 'HRP': {
      const result = hierarchicalRiskParity(sigma);
      weights = result.weights;
      methodDesc = `Hierarchical Risk Parity (López de Prado) | Clustering: correlation distance | Ledoit-Wolf=${useLedoitWolf}`;
      break;
    }
    case 'KELLY': {
      const result = kellyCriterion(mu, sigma, 0.04 / 252, kellyFraction);
      weights = result.weights;
      methodDesc = `Fractional Kelly Criterion | f*×${kellyFraction.toFixed(2)} | Growth-optimal sizing | Ledoit-Wolf=${useLedoitWolf}`;
      break;
    }
    default:
      weights = new Array(n).fill(1 / n);
      methodDesc = 'Equal Weight (fallback)';
  }

  // 4) Transaction cost penalty
  let turnover = 0;
  let transactionCostEstimate = 0;
  if (includeTransactionCosts && currentWeights && currentWeights.length === n) {
    const tc = applyTransactionCostPenalty(weights, currentWeights, 0.001);
    weights = tc.adjustedWeights;
    turnover = tc.turnover;
    transactionCostEstimate = tc.estimatedCost;
  }

  // 5) Portfolio-level return series for risk metrics
  const T = returnMatrix[0].length;
  const portfolioReturns: number[] = [];
  for (let t = 0; t < T; t++) {
    let pr = 0;
    for (let i = 0; i < n; i++) {
      pr += weights[i] * returnMatrix[i][t];
    }
    portfolioReturns.push(pr);
  }

  const expectedReturn = weights.reduce((s, w, i) => s + w * mu[i], 0);
  const wSigmaW = weights.reduce((s1, wi, i) =>
    s1 + weights.reduce((s2, wj, j) => s2 + wi * wj * sigma[i][j], 0), 0);
  const portfolioVolatility = Math.sqrt(Math.max(0, wSigmaW));

  const riskMetrics = computeRiskMetrics(portfolioReturns);
  const efficientFrontier = computeEfficientFrontier(mu, sigma, 25);

  // 6) Build allocations
  const lastPrices = priceMatrix.map(p => p[p.length - 1]);
  const allocations = symbols.map((sym, i) => ({
    symbol: sym,
    weight: weights[i],
    amount: investableCapital * weights[i],
    qty: lastPrices[i] > 0 ? (investableCapital * weights[i]) / lastPrices[i] : 0,
  }));

  return {
    strategy,
    weights,
    symbols,
    expectedReturn,
    portfolioVolatility,
    riskMetrics,
    efficientFrontier,
    shrinkageIntensity,
    turnover,
    transactionCostEstimate,
    allocations,
    methodology: methodDesc,
    timestamp: Date.now(),
  };
}
