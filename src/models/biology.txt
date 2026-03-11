import { clamp } from "./utils";

export type WQState = {
  DO:number;
  TEMP:number;
  SAL:number;
  OM:number;
  N:number;
  P:number;
  ALG:number;
  cloud:number;
};

export function stressDOGrowth(DO:number){
  if(DO >= 5) return 0;
  if(DO >= 4) return 0.2;
  if(DO >= 3) return 0.5;
  return 0.9;
}

export function stressDOSurvival(DO:number){
  if(DO >= 4.5) return 0;
  if(DO >= 3.5) return 0.2;
  if(DO >= 2.5) return 0.6;
  return 1;
}

export function stressTempGrowth(T:number){
  if(T >= 27 && T <= 32) return 0;
  if(T < 27) return clamp((27 - T) / 5, 0, 1);
  return clamp((T - 32) / 5, 0, 1);
}

export function stressTempSurvival(T:number){
  if(T >= 25 && T <= 34) return 0;
  if(T < 25) return clamp((25 - T) / 7, 0, 1);
  return clamp((T - 34) / 7, 0, 1);
}

export function stressSalGrowth(S:number){
  if(S >= 10 && S <= 25) return 0;
  if(S < 10) return clamp((10 - S) / 10, 0, 1);
  return clamp((S - 25) / 15, 0, 1);
}

export function stressSalSurvival(S:number){
  if(S >= 8 && S <= 30) return 0;
  if(S < 8) return clamp((8 - S) / 8, 0, 1);
  return clamp((S - 30) / 10, 0, 1);
}

export function mortalityRate(wq:WQState){
  const sDO = stressDOSurvival(wq.DO);
  const sTEMP = stressTempSurvival(wq.TEMP);
  const sSAL = stressSalSurvival(wq.SAL);

  const base = 0.002;

  const chronic =
    0.05 * sDO +
    0.03 * sTEMP +
    0.025 * sSAL +
    0.02 * Math.max(0, wq.OM - 10) / 10 +
    0.02 * Math.max(0, wq.N - 1.5) / 2 +
    0.03 * Math.max(0, wq.P - 0.35) / 0.5 +
    0.03 * Math.max(0, wq.ALG - 0.65) / 0.35 +
    0.01 * wq.cloud;

  const acute =
    (wq.DO < 2.5 ? 0.25 : 0) +
    (wq.TEMP > 35 ? 0.15 : 0) +
    (wq.SAL < 5 ? 0.10 : 0);

  const interaction =
    0.10 * sDO * sTEMP +
    0.06 * sDO * Math.max(0, wq.OM - 10) / 10;

  return clamp(base + chronic + acute + interaction, 0, 0.8);
}

export function growthMultiplier(wq:WQState, memory:number){
  const sDO = stressDOGrowth(wq.DO);
  const sTEMP = stressTempGrowth(wq.TEMP);
  const sSAL = stressSalGrowth(wq.SAL);

  const penalty =
    0.6 * sDO +
    0.5 * sTEMP +
    0.25 * sSAL +
    0.3 * Math.max(0, wq.OM - 10) / 10 +
    0.15 * Math.max(0, wq.N - 1.5) / 2 +
    0.20 * Math.max(0, wq.P - 0.35) / 0.5 +
    0.25 * Math.max(0, wq.ALG - 0.65) / 0.35 +
    0.10 * wq.cloud +
    0.35 * memory;

  return clamp(Math.exp(-penalty), 0, 1);
}

export function summariseDrivers(wqSeries:WQState[]){
  const totals = {
    DO: 0,
    TEMP: 0,
    SAL: 0,
    OM: 0,
    N: 0,
    P: 0,
    ALG: 0,
    Cloud: 0
  };

  for(const wq of wqSeries){
    totals.DO += stressDOSurvival(wq.DO);
    totals.TEMP += stressTempSurvival(wq.TEMP);
    totals.SAL += stressSalSurvival(wq.SAL);
    totals.OM += Math.max(0, wq.OM - 10) / 10;
    totals.N += Math.max(0, wq.N - 1.5) / 2;
    totals.P += Math.max(0, wq.P - 0.35) / 0.5;
    totals.ALG += Math.max(0, wq.ALG - 0.65) / 0.35;
    totals.Cloud += wq.cloud;
  }

  return Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2))
    }))
    .sort((a, b) => b.value - a.value);
}

export function simulateBiology(
  wqSeries:WQState[],
  initialShrimp:number,
  initialWeight:number,
  potentialGrowth:number
){
  let N = initialShrimp;
  let W = initialWeight;
  let memory = 0;
  let acuteDays = 0;
  const timeline:any[] = [];

  for(let t = 0; t < wqSeries.length; t++){
    const wq = wqSeries[t];
    const m = mortalityRate(wq);

    const currentStress = Math.min(1, m * 2.5);
    memory = 0.85 * memory + 0.15 * currentStress;

    const gmult = growthMultiplier(wq, memory);

    N = N * Math.exp(-m);
    W = W + potentialGrowth * gmult;

    const biomass = N * W;
    const hotspot = clamp(m * 1.2 + wq.cloud * 0.2, 0, 0.95);

    if(wq.DO < 2.5 || wq.TEMP > 35 || hotspot > 0.30){
      acuteDays += 1;
    }

    timeline.push({
      step: t + 1,
      shrimp: N,
      weight: W,
      biomass,
      mortality_rate: m,
      growth_multiplier: gmult,
      hotspot_fraction: hotspot
    });
  }

  return {
    finalShrimp: N,
    finalWeight: W,
    finalBiomass: N * W,
    finalSurvival: N / Math.max(initialShrimp, 1),
    acuteFraction: acuteDays / Math.max(wqSeries.length, 1),
    timeline
  };
}