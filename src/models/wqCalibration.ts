import { clamp } from "./utils";
import type { PondDateAggregation } from "./wqAggregation";
import type { PondWQFeatures } from "./wqFeatures";

export type VariableDistribution = {
  mean: number;
  sd: number;
  p05: number;
  p10: number;
  p50: number;
  p90: number;
  p95: number;
};

export type EmpiricalThresholds = {
  DO_acute: number;
  DO_warning: number;
  TEMP_high: number;
  TEMP_acute: number;
  SAL_low: number;
  SAL_high: number;
};

export type WeatherShockHints = {
  expectedDOShockScale: number;
  expectedTempShockScale: number;
  expectedSalShockScale: number;
};

export type PlaceholderReplacements = {
  acuteFraction: number;
  hotspotFraction: number;
  chronicStressIndex: number;
  dataConfidenceScore: number;
  monteCarloResidualScale: number;
};

export type PondCalibration = {
  pond_id: string;
  n_observations: number;

  observationWeight: number;
  dataConfidenceScore: number;

  thresholds: EmpiricalThresholds;

  DO_distribution: VariableDistribution;
  TEMP_distribution: VariableDistribution;
  SAL_distribution: VariableDistribution;
  OM_distribution: VariableDistribution;
  N_distribution: VariableDistribution;
  P_distribution: VariableDistribution;
  ALG_distribution: VariableDistribution;

  weatherShockHints: WeatherShockHints;
  placeholderReplacements: PlaceholderReplacements;
};

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sd(values: number[]) {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);

  if (lo === hi) return sorted[lo];

  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function describe(values: number[]): VariableDistribution {
  return {
    mean: mean(values),
    sd: sd(values),
    p05: percentile(values, 0.05),
    p10: percentile(values, 0.10),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95)
  };
}

function buildThresholds(
  DO: VariableDistribution,
  TEMP: VariableDistribution,
  SAL: VariableDistribution
): EmpiricalThresholds {
  return {
    DO_acute: Math.min(2.5, DO.p05 || 2.5),
    DO_warning: Math.min(4.0, DO.p10 || 4.0),
    TEMP_high: Math.max(32, TEMP.p90 || 32),
    TEMP_acute: Math.max(35, TEMP.p95 || 35),
    SAL_low: Math.min(8, SAL.p10 || 8),
    SAL_high: Math.max(30, SAL.p90 || 30)
  };
}

function buildObservationWeight(meanQualityScore: number, nObservations: number) {
  const sizeFactor = clamp(Math.sqrt(Math.max(nObservations, 1)) / 10, 0.2, 1);
  return clamp(meanQualityScore * sizeFactor, 0.05, 1);
}

function buildWeatherShockHints(
  DO: VariableDistribution,
  TEMP: VariableDistribution,
  SAL: VariableDistribution
): WeatherShockHints {
  return {
    expectedDOShockScale: clamp(DO.sd / Math.max(DO.mean, 0.1), 0.05, 0.80),
    expectedTempShockScale: clamp(TEMP.sd / Math.max(TEMP.mean, 0.1), 0.02, 0.40),
    expectedSalShockScale: clamp(SAL.sd / Math.max(Math.abs(SAL.mean), 0.1), 0.03, 0.60)
  };
}

function buildMonteCarloResidualScale(
  feature: PondWQFeatures,
  qualityScore: number
) {
  return clamp(
    0.05 +
      feature.acute_fraction * 0.20 +
      feature.chronic_stress_index * 0.20 +
      (1 - qualityScore) * 0.10,
    0.05,
    0.40
  );
}

export function calibrateFromWQ(
  rows: PondDateAggregation[],
  features: PondWQFeatures[]
): PondCalibration[] {
  const grouped = new Map<string, PondDateAggregation[]>();

  for (const row of rows) {
    const arr = grouped.get(row.pond_id) ?? [];
    arr.push(row);
    grouped.set(row.pond_id, arr);
  }

  const featureMap = new Map(features.map(f => [f.pond_id, f]));

  const result: PondCalibration[] = [];

  for (const [pond_id, pondRows] of grouped.entries()) {
    const feature = featureMap.get(pond_id);
    if (!feature) continue;

    const DO = pondRows.map(r => r.DO_mean);
    const TEMP = pondRows.map(r => r.TEMP_mean);
    const SAL = pondRows.map(r => r.SAL_mean);
    const OM = pondRows.map(r => r.OM_mean);
    const N = pondRows.map(r => r.N_mean);
    const P = pondRows.map(r => r.P_mean);
    const ALG = pondRows.map(r => r.ALG_mean);

    const DOdist = describe(DO);
    const TEMPdist = describe(TEMP);
    const SALdist = describe(SAL);
    const OMdist = describe(OM);
    const Ndist = describe(N);
    const Pdist = describe(P);
    const ALGdist = describe(ALG);

    const thresholds = buildThresholds(DOdist, TEMPdist, SALdist);
    const observationWeight = buildObservationWeight(
      feature.mean_quality_score,
      feature.n_observations
    );

    const weatherShockHints = buildWeatherShockHints(DOdist, TEMPdist, SALdist);

    const mcResidualScale = buildMonteCarloResidualScale(
      feature,
      feature.mean_quality_score
    );

    result.push({
      pond_id,
      n_observations: pondRows.length,

      observationWeight,
      dataConfidenceScore: feature.mean_quality_score,

      thresholds,

      DO_distribution: DOdist,
      TEMP_distribution: TEMPdist,
      SAL_distribution: SALdist,
      OM_distribution: OMdist,
      N_distribution: Ndist,
      P_distribution: Pdist,
      ALG_distribution: ALGdist,

      weatherShockHints,

      placeholderReplacements: {
        acuteFraction: feature.acute_fraction,
        hotspotFraction: feature.hotspot_fraction_empirical,
        chronicStressIndex: feature.chronic_stress_index,
        dataConfidenceScore: feature.mean_quality_score,
        monteCarloResidualScale: mcResidualScale
      }
    });
  }

  return result.sort((a, b) => a.pond_id.localeCompare(b.pond_id));
}