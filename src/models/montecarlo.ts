import { clamp } from "./utils";

export type MonteCarloInputs = {
  baseRiskIndex: number;
  baseHotspotFraction: number;
  baseBiomassKg: number;

  triggerRisk: number;
  triggerHotspot: number;

  payoutIfTriggeredUsd: number;

  historicalRows: {
    annual_risk: number;
    acute_fraction: number;
  }[];

  cycles?: number;
};

export type MonteCarloResult = {
  cycles: number;
  triggerProbability: number;
  avgPayoutIfTriggered: number;
  expectedLoss: number;
  meanBiomassKg: number;
  biomassP10: number;
  biomassP50: number;
  biomassP90: number;
};

function percentile(sorted: number[], p: number){
  if(sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);

  if(lo === hi) return sorted[lo];

  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function runMonteCarlo(inputs: MonteCarloInputs): MonteCarloResult {
  const cycles = inputs.cycles ?? 1000;

  const historicalMean =
    inputs.historicalRows.length > 0
      ? inputs.historicalRows.reduce((acc, row) => acc + row.annual_risk, 0) /
        inputs.historicalRows.length
      : inputs.baseRiskIndex;

  const residuals =
    inputs.historicalRows.length > 0
      ? inputs.historicalRows.map(row => row.annual_risk - historicalMean)
      : [0];

  let triggerCount = 0;
  let payoutSum = 0;
  let lossSum = 0;
  const biomassSamples: number[] = [];

  for(let i = 0; i < cycles; i++){
    const residual = residuals[i % residuals.length] ?? 0;

    const pseudoRandom =
      (((i * 9301 + 49297) % 233280) / 233280) - 0.5;

    const simulatedRisk = clamp(
      inputs.baseRiskIndex + residual + pseudoRandom * 0.16,
      0.02,
      0.99
    );

    const simulatedHotspot = clamp(
      inputs.baseHotspotFraction + pseudoRandom * 0.10,
      0,
      0.95
    );

    const triggered =
      simulatedRisk >= inputs.triggerRisk ||
      simulatedHotspot >= inputs.triggerHotspot;

    const biomassShockFactor = clamp(
      1 - simulatedRisk * 0.25 - Math.max(0, simulatedHotspot - 0.2) * 0.15,
      0.5,
      1.1
    );

    const simulatedBiomass = inputs.baseBiomassKg * biomassShockFactor;
    biomassSamples.push(simulatedBiomass);

    if(triggered){
      triggerCount += 1;
      payoutSum += inputs.payoutIfTriggeredUsd;
      lossSum += inputs.payoutIfTriggeredUsd;
    }
  }

  const sortedBiomass = [...biomassSamples].sort((a, b) => a - b);

  return {
    cycles,
    triggerProbability: triggerCount / cycles,
    avgPayoutIfTriggered: payoutSum / Math.max(triggerCount, 1),
    expectedLoss: lossSum / cycles,
    meanBiomassKg:
      biomassSamples.reduce((acc, x) => acc + x, 0) / Math.max(biomassSamples.length, 1),
    biomassP10: percentile(sortedBiomass, 0.10),
    biomassP50: percentile(sortedBiomass, 0.50),
    biomassP90: percentile(sortedBiomass, 0.90)
  };
}