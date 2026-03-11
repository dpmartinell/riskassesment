import { clamp } from "./utils";
import { boundedProbabilityBand, uncertaintyBandFromData } from "./bayes";

export type InsuranceInputs = {
  riskIndex: number;
  hotspotFraction: number;

  historicalRows: {
    annual_risk: number;
    acute_fraction: number;
  }[];

  // Economic / biological inputs
  expectedBiomassKg: number;
  salePriceUsdPerKg: number;
  yieldDragWQ: number;

  capitalExposureUsd: number;
  insuredAmountUsd: number;

  // Contract design
  coverageFraction?: number;   // fraction of WQ-attributable value actually covered
  capitalCapFraction?: number; // hard cap relative to capital exposure
  riskLoad?: number;
  adminLoad?: number;
  margin?: number;
};

export type InsuranceResult = {
  triggerRisk: number;
  triggerHotspot: number;

  biomassValueUsd: number;
  wqAffectedValueUsd: number;
  coveredValueUsd: number;

  payoutRate: number;
  triggeredNow: boolean;

  historicalTriggerProbability: number;
  triggerProbabilityBand: {
    mean: number;
    low: number;
    high: number;
    relativeHalfWidth: number;
  };

  payoutIfTriggered: number;
  expectedPayout: number;
  premiumIndicative: number;

  payoutBand: {
    mean: number;
    low: number;
    high: number;
    relativeHalfWidth: number;
  };
};

export function triggerProbability(
  historicalRows: { annual_risk: number; acute_fraction: number }[],
  triggerRisk: number,
  triggerHotspot: number
){
  if (!historicalRows.length) return 0;

  const hits = historicalRows.filter(
    row =>
      row.annual_risk >= triggerRisk ||
      row.acute_fraction >= triggerHotspot
  ).length;

  return hits / historicalRows.length;
}

export function payoutRateFromRisk(riskIndex:number){
  return clamp(0.35 + riskIndex * 0.25, 0.30, 0.80);
}

/**
 * Full expected biomass value at sale price
 */
export function biomassValueUsd(
  expectedBiomassKg:number,
  salePriceUsdPerKg:number
){
  return expectedBiomassKg * salePriceUsdPerKg;
}

/**
 * Portion of economic value attributable to WQ-linked production drag
 */
export function wqAffectedValueUsd(
  expectedBiomassKg:number,
  salePriceUsdPerKg:number,
  yieldDragWQ:number
){
  const yd = clamp(yieldDragWQ, 0, 1);
  return biomassValueUsd(expectedBiomassKg, salePriceUsdPerKg) * yd;
}

/**
 * Final sum assured:
 * 1) start from WQ-attributable economic value
 * 2) apply coverage fraction
 * 3) cap by insured amount
 * 4) cap by capital exposure fraction
 */
export function coveredValueFromWQDrag(
  expectedBiomassKg:number,
  salePriceUsdPerKg:number,
  yieldDragWQ:number,
  coverageFraction:number,
  insuredAmountUsd:number,
  capitalExposureUsd:number,
  capitalCapFraction:number
){
  const wqValue = wqAffectedValueUsd(
    expectedBiomassKg,
    salePriceUsdPerKg,
    yieldDragWQ
  );

  const preCapCovered = wqValue * clamp(coverageFraction, 0, 1);
  const capitalCap = capitalExposureUsd * clamp(capitalCapFraction, 0, 1);

  return Math.min(
    preCapCovered,
    insuredAmountUsd,
    capitalCap
  );
}

export function payoutIfTriggered(
  coveredValueUsd:number,
  payoutRate:number
){
  return coveredValueUsd * payoutRate;
}

export function expectedPayout(
  triggerProbability:number,
  payoutIfTriggeredValue:number
){
  return triggerProbability * payoutIfTriggeredValue;
}

export function indicativePremium(
  expectedLoss:number,
  riskLoad = 0.30,
  adminLoad = 0.10,
  margin = 0.10
){
  return expectedLoss * (1 + riskLoad + adminLoad + margin);
}

export function buildInsuranceModel(inputs: InsuranceInputs): InsuranceResult {
  const triggerRisk = 0.67;
  const triggerHotspot = 0.26;

  const coverageFraction = inputs.coverageFraction ?? 0.80;
  const capitalCapFraction = inputs.capitalCapFraction ?? 0.90;

  const biomassValue = biomassValueUsd(
    inputs.expectedBiomassKg,
    inputs.salePriceUsdPerKg
  );

  const wqValue = wqAffectedValueUsd(
    inputs.expectedBiomassKg,
    inputs.salePriceUsdPerKg,
    inputs.yieldDragWQ
  );

  const coveredValueUsd = coveredValueFromWQDrag(
    inputs.expectedBiomassKg,
    inputs.salePriceUsdPerKg,
    inputs.yieldDragWQ,
    coverageFraction,
    inputs.insuredAmountUsd,
    inputs.capitalExposureUsd,
    capitalCapFraction
  );

  const payoutRate = payoutRateFromRisk(inputs.riskIndex);

  const triggeredNow =
    inputs.riskIndex >= triggerRisk ||
    inputs.hotspotFraction >= triggerHotspot;

  const historicalTriggerProbability = triggerProbability(
    inputs.historicalRows,
    triggerRisk,
    triggerHotspot
  );

  const probabilityBand = boundedProbabilityBand(
    historicalTriggerProbability,
    inputs.historicalRows.length || 1
  );

  const payoutTriggered = payoutIfTriggered(
    coveredValueUsd,
    payoutRate
  );

  const expected = expectedPayout(
    historicalTriggerProbability,
    payoutTriggered
  );

  const premium = indicativePremium(
    expected,
    inputs.riskLoad ?? 0.30,
    inputs.adminLoad ?? 0.10,
    inputs.margin ?? 0.10
  );

  const payoutBand = uncertaintyBandFromData(
    expected,
    inputs.historicalRows.length || 1
  );

  return {
    triggerRisk,
    triggerHotspot,

    biomassValueUsd: biomassValue,
    wqAffectedValueUsd: wqValue,
    coveredValueUsd,

    payoutRate,
    triggeredNow,

    historicalTriggerProbability,
    triggerProbabilityBand: probabilityBand,

    payoutIfTriggered: payoutTriggered,
    expectedPayout: expected,
    premiumIndicative: premium,

    payoutBand
  };
}