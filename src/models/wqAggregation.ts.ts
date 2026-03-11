import { clamp } from "./utils";

export type PixelWQObservation = {
  pond_id: string;
  date: string;
  pixel_id: string;

  DO: number | null;
  TEMP: number | null;
  SAL: number | null;
  OM: number | null;
  N: number | null;
  P: number | null;
  ALG: number | null;

  cloud: number | null;
  quality_flag?: "good" | "bad" | "unknown";
};

export type PondDateAggregation = {
  pond_id: string;
  date: string;

  n_pixels_total: number;
  n_pixels_valid: number;
  valid_pixel_fraction: number;

  cloud_mean: number;
  quality_score: number;

  DO_mean: number;
  DO_sd: number;
  DO_p10: number;
  DO_p50: number;
  DO_p90: number;

  TEMP_mean: number;
  TEMP_sd: number;
  TEMP_p10: number;
  TEMP_p50: number;
  TEMP_p90: number;

  SAL_mean: number;
  SAL_sd: number;
  SAL_p10: number;
  SAL_p50: number;
  SAL_p90: number;

  OM_mean: number;
  OM_sd: number;
  OM_p10: number;
  OM_p50: number;
  OM_p90: number;

  N_mean: number;
  N_sd: number;
  N_p10: number;
  N_p50: number;
  N_p90: number;

  P_mean: number;
  P_sd: number;
  P_p10: number;
  P_p50: number;
  P_p90: number;

  ALG_mean: number;
  ALG_sd: number;
  ALG_p10: number;
  ALG_p50: number;
  ALG_p90: number;
};

function validNumber(x: number | null | undefined): x is number {
  return x !== null && x !== undefined && Number.isFinite(x);
}

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

function summarize(values: number[]) {
  return {
    mean: mean(values),
    sd: sd(values),
    p10: percentile(values, 0.10),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90)
  };
}

function qualityScore(validFraction: number, cloudMean: number) {
  const score = validFraction * (1 - clamp(cloudMean, 0, 1));
  return clamp(score, 0, 1);
}

export function aggregatePondDateWQ(
  observations: PixelWQObservation[]
): PondDateAggregation[] {
  const groups = new Map<string, PixelWQObservation[]>();

  for (const obs of observations) {
    const key = `${obs.pond_id}__${obs.date}`;
    const arr = groups.get(key) ?? [];
    arr.push(obs);
    groups.set(key, arr);
  }

  const result: PondDateAggregation[] = [];

  for (const [key, rows] of groups.entries()) {
    const [pond_id, date] = key.split("__");

    const validRows = rows.filter(row => {
      const goodFlag =
        row.quality_flag === undefined ||
        row.quality_flag === "good" ||
        row.quality_flag === "unknown";

      return goodFlag;
    });

    const DO = validRows.map(r => r.DO).filter(validNumber);
    const TEMP = validRows.map(r => r.TEMP).filter(validNumber);
    const SAL = validRows.map(r => r.SAL).filter(validNumber);
    const OM = validRows.map(r => r.OM).filter(validNumber);
    const N = validRows.map(r => r.N).filter(validNumber);
    const P = validRows.map(r => r.P).filter(validNumber);
    const ALG = validRows.map(r => r.ALG).filter(validNumber);
    const cloud = validRows.map(r => r.cloud).filter(validNumber);

    const n_pixels_total = rows.length;

    const n_pixels_valid = validRows.filter(r =>
      validNumber(r.DO) ||
      validNumber(r.TEMP) ||
      validNumber(r.SAL) ||
      validNumber(r.OM) ||
      validNumber(r.N) ||
      validNumber(r.P) ||
      validNumber(r.ALG)
    ).length;

    const valid_pixel_fraction =
      n_pixels_total > 0 ? n_pixels_valid / n_pixels_total : 0;

    const cloud_mean = mean(cloud);
    const qScore = qualityScore(valid_pixel_fraction, cloud_mean);

    const DOs = summarize(DO);
    const TEMPs = summarize(TEMP);
    const SALs = summarize(SAL);
    const OMs = summarize(OM);
    const Ns = summarize(N);
    const Ps = summarize(P);
    const ALGs = summarize(ALG);

    result.push({
      pond_id,
      date,

      n_pixels_total,
      n_pixels_valid,
      valid_pixel_fraction,

      cloud_mean,
      quality_score: qScore,

      DO_mean: DOs.mean,
      DO_sd: DOs.sd,
      DO_p10: DOs.p10,
      DO_p50: DOs.p50,
      DO_p90: DOs.p90,

      TEMP_mean: TEMPs.mean,
      TEMP_sd: TEMPs.sd,
      TEMP_p10: TEMPs.p10,
      TEMP_p50: TEMPs.p50,
      TEMP_p90: TEMPs.p90,

      SAL_mean: SALs.mean,
      SAL_sd: SALs.sd,
      SAL_p10: SALs.p10,
      SAL_p50: SALs.p50,
      SAL_p90: SALs.p90,

      OM_mean: OMs.mean,
      OM_sd: OMs.sd,
      OM_p10: OMs.p10,
      OM_p50: OMs.p50,
      OM_p90: OMs.p90,

      N_mean: Ns.mean,
      N_sd: Ns.sd,
      N_p10: Ns.p10,
      N_p50: Ns.p50,
      N_p90: Ns.p90,

      P_mean: Ps.mean,
      P_sd: Ps.sd,
      P_p10: Ps.p10,
      P_p50: Ps.p50,
      P_p90: Ps.p90,

      ALG_mean: ALGs.mean,
      ALG_sd: ALGs.sd,
      ALG_p10: ALGs.p10,
      ALG_p50: ALGs.p50,
      ALG_p90: ALGs.p90
    });
  }

  return result.sort((a, b) => {
    if (a.pond_id < b.pond_id) return -1;
    if (a.pond_id > b.pond_id) return 1;
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });
}