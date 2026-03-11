import type { PondDateAggregation } from "../models/wqAggregation";

export type PondTimeSeriesRow = PondDateAggregation & {
  source: "dummy" | "real";
};

export type LoadPondTimeSeriesMode = "dummy" | "real";

export type LoadPondTimeSeriesParams = {
  mode: LoadPondTimeSeriesMode;
  pondIds?: string[];
  startDate?: string;
  endDate?: string;

  /**
   * For real mode, this is the place where later we will connect:
   * - a backend
   * - a processed table
   * - parquet/csv ingestion
   * - database query result
   */
  realRows?: PondDateAggregation[];
};

function inDateRange(date: string, startDate?: string, endDate?: string) {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function filterRows(
  rows: PondDateAggregation[],
  pondIds?: string[],
  startDate?: string,
  endDate?: string
) {
  return rows.filter(row => {
    const pondOk = !pondIds || pondIds.length === 0 || pondIds.includes(row.pond_id);
    const dateOk = inDateRange(row.date, startDate, endDate);
    return pondOk && dateOk;
  });
}

function generateDummySeries(
  pondIds: string[] = ["pond-demo-1"],
  startDate = "2024-01-01",
  endDate = "2024-03-31"
): PondDateAggregation[] {
  const rows: PondDateAggregation[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const pond_id of pondIds) {
    const current = new Date(start);

    while (current <= end) {
      const date = current.toISOString().slice(0, 10);
      const dayIndex = Math.floor(
        (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      const seasonal = Math.sin(dayIndex / 12) * 0.4;
      const cloud_mean = Math.max(0, Math.min(0.95, 0.15 + Math.sin(dayIndex / 10) * 0.08));

      const DO_mean = 5.5 - Math.sin(dayIndex / 9) * 0.8 + seasonal;
      const TEMP_mean = 29 + Math.sin(dayIndex / 14) * 1.8;
      const SAL_mean = 18 + Math.cos(dayIndex / 17) * 2.0;
      const OM_mean = 8 + Math.sin(dayIndex / 11) * 1.2;
      const N_mean = 1.0 + Math.cos(dayIndex / 13) * 0.25;
      const P_mean = 0.22 + Math.sin(dayIndex / 15) * 0.05;
      const ALG_mean = 0.42 + Math.cos(dayIndex / 16) * 0.07;

      const quality_score = Math.max(0.05, Math.min(1, 1 - cloud_mean * 0.8));

      rows.push({
        pond_id,
        date,

        n_pixels_total: 120,
        n_pixels_valid: Math.round(120 * quality_score),
        valid_pixel_fraction: quality_score,

        cloud_mean,
        quality_score,

        DO_mean,
        DO_sd: 0.35,
        DO_p10: DO_mean - 0.45,
        DO_p50: DO_mean,
        DO_p90: DO_mean + 0.40,

        TEMP_mean,
        TEMP_sd: 0.60,
        TEMP_p10: TEMP_mean - 0.70,
        TEMP_p50: TEMP_mean,
        TEMP_p90: TEMP_mean + 0.75,

        SAL_mean,
        SAL_sd: 0.80,
        SAL_p10: SAL_mean - 1.0,
        SAL_p50: SAL_mean,
        SAL_p90: SAL_mean + 1.0,

        OM_mean,
        OM_sd: 0.70,
        OM_p10: OM_mean - 0.8,
        OM_p50: OM_mean,
        OM_p90: OM_mean + 0.8,

        N_mean,
        N_sd: 0.12,
        N_p10: N_mean - 0.15,
        N_p50: N_mean,
        N_p90: N_mean + 0.15,

        P_mean,
        P_sd: 0.03,
        P_p10: P_mean - 0.03,
        P_p50: P_mean,
        P_p90: P_mean + 0.03,

        ALG_mean,
        ALG_sd: 0.08,
        ALG_p10: ALG_mean - 0.08,
        ALG_p50: ALG_mean,
        ALG_p90: ALG_mean + 0.08
      });

      current.setDate(current.getDate() + 3);
    }
  }

  return rows;
}

export function loadPondTimeSeries(
  params: LoadPondTimeSeriesParams
): PondTimeSeriesRow[] {
  const pondIds = params.pondIds ?? ["pond-demo-1"];
  const startDate = params.startDate ?? "2024-01-01";
  const endDate = params.endDate ?? "2024-03-31";

  if (params.mode === "dummy") {
    return filterRows(
      generateDummySeries(pondIds, startDate, endDate),
      pondIds,
      startDate,
      endDate
    ).map(row => ({
      ...row,
      source: "dummy"
    }));
  }

  const realRows = params.realRows ?? [];

  return filterRows(realRows, pondIds, startDate, endDate).map(row => ({
    ...row,
    source: "real"
  }));
}