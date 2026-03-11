import { clamp } from "./utils";
import type { PondDateAggregation } from "./wqAggregation";

export type PondWQFeatures = {
  pond_id: string;

  n_observations: number;
  valid_observation_fraction: number;
  mean_quality_score: number;

  acute_fraction: number;
  hotspot_fraction_empirical: number;

  low_do_event_count: number;
  temp_extreme_count: number;
  salinity_shock_count: number;

  persistence_low_do: number;
  chronic_stress_index: number;

  mean_DO: number;
  mean_TEMP: number;
  mean_SAL: number;
  mean_OM: number;
  mean_N: number;
  mean_P: number;
  mean_ALG: number;
};

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function consecutiveRuns(flags: boolean[]) {
  let runs = 0;
  let inRun = false;

  for (const flag of flags) {
    if (flag && !inRun) {
      runs += 1;
      inRun = true;
    }
    if (!flag) {
      inRun = false;
    }
  }

  return runs;
}

function maxRunLength(flags: boolean[]) {
  let maxLen = 0;
  let current = 0;

  for (const flag of flags) {
    if (flag) {
      current += 1;
      if (current > maxLen) maxLen = current;
    } else {
      current = 0;
    }
  }

  return maxLen;
}

function acuteFlag(row: PondDateAggregation) {
  return (
    row.DO_p10 < 2.5 ||
    row.TEMP_p90 > 35 ||
    row.SAL_p10 < 5 ||
    row.quality_score < 0.25
  );
}

function hotspotFlag(row: PondDateAggregation) {
  let score = 0;

  if (row.DO_p10 < 3.0) score += 0.35;
  if (row.TEMP_p90 > 34) score += 0.20;
  if (row.SAL_p10 < 8) score += 0.15;
  if (row.OM_p90 > 14) score += 0.10;
  if (row.N_p90 > 2.0) score += 0.08;
  if (row.P_p90 > 0.45) score += 0.06;
  if (row.ALG_p90 > 0.75) score += 0.06;

  return clamp(score, 0, 1) >= 0.30;
}

function chronicStressRow(row: PondDateAggregation) {
  const doStress = clamp((4.5 - row.DO_mean) / 2.5, 0, 1);
  const tempStress =
    row.TEMP_mean > 32
      ? clamp((row.TEMP_mean - 32) / 4, 0, 1)
      : row.TEMP_mean < 27
      ? clamp((27 - row.TEMP_mean) / 4, 0, 1)
      : 0;

  const salStress =
    row.SAL_mean < 10
      ? clamp((10 - row.SAL_mean) / 10, 0, 1)
      : row.SAL_mean > 25
      ? clamp((row.SAL_mean - 25) / 15, 0, 1)
      : 0;

  const omStress = clamp((row.OM_mean - 10) / 10, 0, 1);
  const nStress = clamp((row.N_mean - 1.5) / 2, 0, 1);
  const pStress = clamp((row.P_mean - 0.35) / 0.5, 0, 1);
  const algStress = clamp((row.ALG_mean - 0.65) / 0.35, 0, 1);

  return clamp(
    0.30 * doStress +
    0.20 * tempStress +
    0.10 * salStress +
    0.12 * omStress +
    0.08 * nStress +
    0.08 * pStress +
    0.07 * algStress +
    0.05 * (1 - row.quality_score),
    0,
    1
  );
}

export function buildPondWQFeatures(rows: PondDateAggregation[]): PondWQFeatures[] {
  const grouped = new Map<string, PondDateAggregation[]>();

  for (const row of rows) {
    const arr = grouped.get(row.pond_id) ?? [];
    arr.push(row);
    grouped.set(row.pond_id, arr);
  }

  const results: PondWQFeatures[] = [];

  for (const [pond_id, pondRows] of grouped.entries()) {
    const ordered = [...pondRows].sort((a, b) => a.date.localeCompare(b.date));

    const acuteFlags = ordered.map(acuteFlag);
    const hotspotFlags = ordered.map(hotspotFlag);
    const lowDoFlags = ordered.map(r => r.DO_p10 < 3.0);
    const tempExtremeFlags = ordered.map(r => r.TEMP_p90 > 34);
    const salShockFlags = ordered.map(r => r.SAL_p10 < 8 || r.SAL_p90 > 30);

    const chronicStressSeries = ordered.map(chronicStressRow);

    const n_observations = ordered.length;
    const valid_observation_fraction =
      n_observations > 0
        ? mean(ordered.map(r => r.valid_pixel_fraction))
        : 0;

    const mean_quality_score = mean(ordered.map(r => r.quality_score));

    results.push({
      pond_id,

      n_observations,
      valid_observation_fraction,
      mean_quality_score,

      acute_fraction:
        n_observations > 0
          ? acuteFlags.filter(Boolean).length / n_observations
          : 0,

      hotspot_fraction_empirical:
        n_observations > 0
          ? hotspotFlags.filter(Boolean).length / n_observations
          : 0,

      low_do_event_count: consecutiveRuns(lowDoFlags),
      temp_extreme_count: consecutiveRuns(tempExtremeFlags),
      salinity_shock_count: consecutiveRuns(salShockFlags),

      persistence_low_do:
        n_observations > 0
          ? maxRunLength(lowDoFlags) / n_observations
          : 0,

      chronic_stress_index: mean(chronicStressSeries),

      mean_DO: mean(ordered.map(r => r.DO_mean)),
      mean_TEMP: mean(ordered.map(r => r.TEMP_mean)),
      mean_SAL: mean(ordered.map(r => r.SAL_mean)),
      mean_OM: mean(ordered.map(r => r.OM_mean)),
      mean_N: mean(ordered.map(r => r.N_mean)),
      mean_P: mean(ordered.map(r => r.P_mean)),
      mean_ALG: mean(ordered.map(r => r.ALG_mean))
    });
  }

  return results.sort((a, b) => a.pond_id.localeCompare(b.pond_id));
}