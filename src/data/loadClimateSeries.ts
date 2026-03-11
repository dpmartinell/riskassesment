import type { PondClimateObservation } from "../models/weatherCalibration";

export type ClimateSeriesRow = PondClimateObservation & {
  source: "dummy" | "real";
};

export type LoadClimateSeriesMode = "dummy" | "real";

export type LoadClimateSeriesParams = {
  mode: LoadClimateSeriesMode;
  pondIds?: string[];
  startDate?: string;
  endDate?: string;

  /**
   * Later this can come from:
   * - processed Copernicus / CDS outputs
   * - backend API
   * - parquet/csv ingestion
   * - database query result
   */
  realRows?: PondClimateObservation[];
};

function inDateRange(date: string, startDate?: string, endDate?: string) {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function filterRows(
  rows: PondClimateObservation[],
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

function generateDummyClimateSeries(
  pondIds: string[] = ["pond-demo-1"],
  startDate = "2024-01-01",
  endDate = "2024-03-31"
): PondClimateObservation[] {
  const rows: PondClimateObservation[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const pond_id of pondIds) {
    const current = new Date(start);

    while (current <= end) {
      const date = current.toISOString().slice(0, 10);
      const dayIndex = Math.floor(
        (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      const rain_mm = Math.max(0, 8 + Math.sin(dayIndex / 8) * 6 + Math.cos(dayIndex / 17) * 4);
      const air_temp_c = 29 + Math.sin(dayIndex / 14) * 2.2;
      const wind_speed_mps = Math.max(0.5, 3 + Math.cos(dayIndex / 10) * 1.2);
      const drought_index = Math.max(0, 0.6 + Math.cos(dayIndex / 20) * 0.5);

      rows.push({
        pond_id,
        date,
        rain_mm,
        air_temp_c,
        wind_speed_mps,
        drought_index
      });

      current.setDate(current.getDate() + 3);
    }
  }

  return rows;
}

export function loadClimateSeries(
  params: LoadClimateSeriesParams
): ClimateSeriesRow[] {
  const pondIds = params.pondIds ?? ["pond-demo-1"];
  const startDate = params.startDate ?? "2024-01-01";
  const endDate = params.endDate ?? "2024-03-31";

  if (params.mode === "dummy") {
    return filterRows(
      generateDummyClimateSeries(pondIds, startDate, endDate),
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