import { clamp } from "./utils";

export type UncertaintyBand = {
  mean: number;
  low: number;
  high: number;
  relativeHalfWidth: number;
};

export function credibleBand(mean:number, relativeHalfWidth:number): UncertaintyBand {
  const hw = Math.abs(mean) * Math.max(0, relativeHalfWidth);

  return {
    mean,
    low: mean - hw,
    high: mean + hw,
    relativeHalfWidth
  };
}

export function uncertaintyBandFromData(
  mean:number,
  sampleSize:number,
  floor = 0.05,
  ceiling = 0.35
): UncertaintyBand {
  const rel = clamp(0.40 / Math.sqrt(Math.max(sampleSize, 1)), floor, ceiling);
  return credibleBand(mean, rel);
}

export function boundedProbabilityBand(
  mean:number,
  sampleSize:number,
  floor = 0.05,
  ceiling = 0.30
): UncertaintyBand {
  const rel = clamp(0.35 / Math.sqrt(Math.max(sampleSize, 1)), floor, ceiling);
  const hw = rel;

  return {
    mean,
    low: clamp(mean - hw, 0, 1),
    high: clamp(mean + hw, 0, 1),
    relativeHalfWidth: rel
  };
}

export function blendPriorWithObservation(
  priorMean:number,
  observedMean:number,
  observationWeight:number
){
  const w = clamp(observationWeight, 0, 1);

  return (1 - w) * priorMean + w * observedMean;
}

export function proxyObservationWeight(
  cloud:number,
  anomalyPenalty:number = 0
){
  const weight = 1 - clamp(cloud + anomalyPenalty, 0, 0.95);
  return clamp(weight, 0.05, 1);
}