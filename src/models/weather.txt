import { clamp } from "./utils";
import type { WQState } from "./biology";

export type WeatherEvent =
  | "Heatwave"
  | "Heavy rainfall"
  | "Drought"
  | "Storm";

export type WeatherShockResult = {
  event: WeatherEvent;
  severity: number;
  baseline: WQState;
  shocked: WQState;
  deltas: {
    DO: number;
    TEMP: number;
    SAL: number;
    OM: number;
    N: number;
    P: number;
    ALG: number;
    cloud: number;
  };
};

export function applyWeatherEvent(
  state: WQState,
  event: WeatherEvent,
  severity: number
): WeatherShockResult {
  const s = clamp(severity, 0, 1);

  const next: WQState = { ...state };

  if (event === "Heatwave") {
    next.TEMP = clamp(state.TEMP + 2.2 * s, 18, 42);
    next.DO = clamp(state.DO - 1.0 * s, -1, 12);
    next.SAL = clamp(state.SAL + 1.2 * s, -2, 50);
    next.OM = clamp(state.OM + 0.6 * s, -1, 30);
    next.N = clamp(state.N + 0.15 * s, -0.2, 5);
    next.P = clamp(state.P + 0.03 * s, -0.05, 2);
    next.ALG = clamp(state.ALG + 0.10 * s, -0.1, 1.5);
    next.cloud = clamp(state.cloud + 0.05 * s, 0, 1);
  }

  if (event === "Heavy rainfall") {
    next.TEMP = clamp(state.TEMP - 0.6 * s, 18, 42);
    next.DO = clamp(state.DO - 0.3 * s, -1, 12);
    next.SAL = clamp(state.SAL - 3.2 * s, -2, 50);
    next.OM = clamp(state.OM + 1.2 * s, -1, 30);
    next.N = clamp(state.N + 0.35 * s, -0.2, 5);
    next.P = clamp(state.P + 0.08 * s, -0.05, 2);
    next.ALG = clamp(state.ALG + 0.06 * s, -0.1, 1.5);
    next.cloud = clamp(state.cloud + 0.18 * s, 0, 1);
  }

  if (event === "Drought") {
    next.TEMP = clamp(state.TEMP + 1.0 * s, 18, 42);
    next.DO = clamp(state.DO - 0.5 * s, -1, 12);
    next.SAL = clamp(state.SAL + 2.6 * s, -2, 50);
    next.OM = clamp(state.OM + 0.8 * s, -1, 30);
    next.N = clamp(state.N + 0.12 * s, -0.2, 5);
    next.P = clamp(state.P + 0.02 * s, -0.05, 2);
    next.ALG = clamp(state.ALG + 0.08 * s, -0.1, 1.5);
    next.cloud = clamp(state.cloud + 0.02 * s, 0, 1);
  }

  if (event === "Storm") {
    next.TEMP = clamp(state.TEMP - 1.3 * s, 18, 42);
    next.DO = clamp(state.DO - 1.1 * s, -1, 12);
    next.SAL = clamp(state.SAL - 2.4 * s, -2, 50);
    next.OM = clamp(state.OM + 1.8 * s, -1, 30);
    next.N = clamp(state.N + 0.45 * s, -0.2, 5);
    next.P = clamp(state.P + 0.10 * s, -0.05, 2);
    next.ALG = clamp(state.ALG + 0.12 * s, -0.1, 1.5);
    next.cloud = clamp(state.cloud + 0.35 * s, 0, 1);
  }

  return {
    event,
    severity: s,
    baseline: state,
    shocked: next,
    deltas: {
      DO: Number((next.DO - state.DO).toFixed(3)),
      TEMP: Number((next.TEMP - state.TEMP).toFixed(3)),
      SAL: Number((next.SAL - state.SAL).toFixed(3)),
      OM: Number((next.OM - state.OM).toFixed(3)),
      N: Number((next.N - state.N).toFixed(3)),
      P: Number((next.P - state.P).toFixed(3)),
      ALG: Number((next.ALG - state.ALG).toFixed(3)),
      cloud: Number((next.cloud - state.cloud).toFixed(3)),
    },
  };
}

export function applyEventToSeries(
  series: WQState[],
  event: WeatherEvent,
  severity: number,
  startDay: number,
  durationDays: number
) {
  const output = [...series];
  const start = Math.max(0, startDay);
  const end = Math.min(series.length, start + durationDays);

  for (let i = start; i < end; i++) {
    output[i] = applyWeatherEvent(output[i], event, severity).shocked;
  }

  return output;
}