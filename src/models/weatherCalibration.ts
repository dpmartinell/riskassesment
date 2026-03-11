import { clamp } from "./utils";
import type { PondDateAggregation } from "./wqAggregation";

export type PondClimateObservation = {
  pond_id: string;
  date: string;

  rain_mm: number | null;
  air_temp_c: number | null;
  wind_speed_mps: number | null;
  drought_index: number | null;
};

export type WeatherCalibrationRow = {
  pond_id: string;

  n_matches: number;

  rain_to_salinity: number;
  rain_to_om: number;
  rain_to_n: number;
  rain_to_p: number;

  airtemp_to_do: number;
  airtemp_to_wqtemp: number;

  wind_to_do: number;
  drought_to_salinity: number;

  rain_lag1_to_salinity: number;
  rain_lag3_to_salinity: number;

  confidence: number;
};

type JoinedRow = {
  pond_id: string;
  date: string;

  rain_mm: number;
  air_temp_c: number;
  wind_speed_mps: number;
  drought_index: number;

  DO_mean: number;
  TEMP_mean: number;
  SAL_mean: number;
  OM_mean: number;
  N_mean: number;
  P_mean: number;
  quality_score: number;
};

function valid(x: number | null | undefined): x is number {
  return x !== null && x !== undefined && Number.isFinite(x);
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function covariance(x: number[], y: number[]) {
  if (x.length !== y.length || x.length <= 1) return 0;
  const mx = mean(x);
  const my = mean(y);

  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += (x[i] - mx) * (y[i] - my);
  }

  return acc / (x.length - 1);
}

function variance(x: number[]) {
  if (x.length <= 1) return 0;
  const mx = mean(x);

  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += Math.pow(x[i] - mx, 2);
  }

  return acc / (x.length - 1);
}

/**
 * Simple slope estimate:
 * y = a + b x
 * returns b
 */
function simpleSlope(x: number[], y: number[]) {
  const varX = variance(x);
  if (varX <= 0) return 0;
  return covariance(x, y) / varX;
}

function buildJoinedRows(
  wqRows: PondDateAggregation[],
  climateRows: PondClimateObservation[]
): JoinedRow[] {
  const climateMap = new Map<string, PondClimateObservation>();

  for (const c of climateRows) {
    const key = `${c.pond_id}__${c.date}`;
    climateMap.set(key, c);
  }

  const joined: JoinedRow[] = [];

  for (const wq of wqRows) {
    const key = `${wq.pond_id}__${wq.date}`;
    const climate = climateMap.get(key);
    if (!climate) continue;

    if (
      !valid(climate.rain_mm) ||
      !valid(climate.air_temp_c) ||
      !valid(climate.wind_speed_mps) ||
      !valid(climate.drought_index)
    ) {
      continue;
    }

    joined.push({
      pond_id: wq.pond_id,
      date: wq.date,

      rain_mm: climate.rain_mm,
      air_temp_c: climate.air_temp_c,
      wind_speed_mps: climate.wind_speed_mps,
      drought_index: climate.drought_index,

      DO_mean: wq.DO_mean,
      TEMP_mean: wq.TEMP_mean,
      SAL_mean: wq.SAL_mean,
      OM_mean: wq.OM_mean,
      N_mean: wq.N_mean,
      P_mean: wq.P_mean,
      quality_score: wq.quality_score
    });
  }

  return joined;
}

function lagSeries(values: number[], lag: number) {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const j = i - lag;
    out.push(j >= 0 ? values[j] : values[i]);
  }
  return out;
}

export function calibrateWeatherToWQ(
  wqRows: PondDateAggregation[],
  climateRows: PondClimateObservation[]
): WeatherCalibrationRow[] {
  const joined = buildJoinedRows(wqRows, climateRows);

  const grouped = new Map<string, JoinedRow[]>();
  for (const row of joined) {
    const arr = grouped.get(row.pond_id) ?? [];
    arr.push(row);
    grouped.set(row.pond_id, arr);
  }

  const result: WeatherCalibrationRow[] = [];

  for (const [pond_id, rows] of grouped.entries()) {
    const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));

    const rain = ordered.map(r => r.rain_mm);
    const air = ordered.map(r => r.air_temp_c);
    const wind = ordered.map(r => r.wind_speed_mps);
    const drought = ordered.map(r => r.drought_index);

    const DO = ordered.map(r => r.DO_mean);
    const TEMP = ordered.map(r => r.TEMP_mean);
    const SAL = ordered.map(r => r.SAL_mean);
    const OM = ordered.map(r => r.OM_mean);
    const N = ordered.map(r => r.N_mean);
    const P = ordered.map(r => r.P_mean);
    const Q = ordered.map(r => r.quality_score);

    const rainLag1 = lagSeries(rain, 1);
    const rainLag3 = lagSeries(rain, 3);

    const confidence = clamp(
      mean(Q) * clamp(Math.sqrt(Math.max(rows.length, 1)) / 12, 0.2, 1),
      0.05,
      1
    );

    result.push({
      pond_id,
      n_matches: rows.length,

      rain_to_salinity: simpleSlope(rain, SAL),
      rain_to_om: simpleSlope(rain, OM),
      rain_to_n: simpleSlope(rain, N),
      rain_to_p: simpleSlope(rain, P),

      airtemp_to_do: simpleSlope(air, DO),
      airtemp_to_wqtemp: simpleSlope(air, TEMP),

      wind_to_do: simpleSlope(wind, DO),
      drought_to_salinity: simpleSlope(drought, SAL),

      rain_lag1_to_salinity: simpleSlope(rainLag1, SAL),
      rain_lag3_to_salinity: simpleSlope(rainLag3, SAL),

      confidence
    });
  }

  return result.sort((a, b) => a.pond_id.localeCompare(b.pond_id));
}

/**
 * Blend calibration rows to build a single pond-specific weather response package
 * ready to feed weather.ts later.
 */
export function buildWeatherResponseHints(
  calibration: WeatherCalibrationRow
) {
  return {
    pond_id: calibration.pond_id,
    confidence: calibration.confidence,

    rain: {
      deltaSAL_per_mm: calibration.rain_to_salinity,
      deltaOM_per_mm: calibration.rain_to_om,
      deltaN_per_mm: calibration.rain_to_n,
      deltaP_per_mm: calibration.rain_to_p,
      deltaSAL_lag1_per_mm: calibration.rain_lag1_to_salinity,
      deltaSAL_lag3_per_mm: calibration.rain_lag3_to_salinity
    },

    heat: {
      deltaDO_per_airtemp_c: calibration.airtemp_to_do,
      deltaWQTemp_per_airtemp_c: calibration.airtemp_to_wqtemp
    },

    wind: {
      deltaDO_per_mps: calibration.wind_to_do
    },

    drought: {
      deltaSAL_per_index: calibration.drought_to_salinity
    }
  };
}