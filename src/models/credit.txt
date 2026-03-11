import { clamp } from "./utils";
import { boundedProbabilityBand, uncertaintyBandFromData } from "./bayes";

export type CreditInputs = {
  riskIndex: number;
  yieldDrag: number;
  capitalExposureUsd: number;
  creditExposureUsd: number;
  insuredCoverageRatio: number;

  dscrProxy?: number;
  leverageProxy?: number;
};

export type CreditResult = {
  score: number;
  tier: "A" | "B" | "C" | "D";

  pd: number;
  pdBand: {
    mean: number;
    low: number;
    high: number;
    relativeHalfWidth: number;
  };

  lgd: number;
  ecl: number;
  eclBand: {
    mean: number;
    low: number;
    high: number;
    relativeHalfWidth: number;
  };

  dscrProxy: number;
  leverageProxy: number;
  insuredCoverageRatio: number;
};

export function classifyCredit(score:number): "A" | "B" | "C" | "D" {
  if(score >= 80) return "A";
  if(score >= 65) return "B";
  if(score >= 50) return "C";
  return "D";
}

export function dscrProxyFromYieldDrag(
  capitalExposureUsd:number,
  yieldDrag:number
){
  return (
    (capitalExposureUsd - capitalExposureUsd * yieldDrag) /
    Math.max(capitalExposureUsd * 0.32, 1)
  );
}

export function leverageProxyFromYieldDrag(
  capitalExposureUsd:number,
  yieldDrag:number
){
  return capitalExposureUsd /
    Math.max(capitalExposureUsd - capitalExposureUsd * yieldDrag, 1);
}

export function scoreModel(
  risk:number,
  drag:number,
  dscr:number,
  leverage:number
){
  let score =
    100
    - risk * 40
    - drag * 30
    - Math.max(0, 1.2 - dscr) * 20
    - leverage * 10;

  return clamp(score, 0, 100);
}

export function pdFromScore(score:number){
  return clamp(
    1 / (1 + Math.exp((score - 60) / 8)),
    0.01,
    0.40
  );
}

export function lgdFromCoverage(insuredCoverageRatio:number){
  return Math.max(
    0.20,
    0.70 - insuredCoverageRatio * 0.50
  );
}

export function expectedCreditLoss(
  exposure:number,
  pd:number,
  lgd:number
){
  return exposure * pd * lgd;
}

export function buildCreditModel(inputs: CreditInputs): CreditResult {
  const dscr =
    inputs.dscrProxy ??
    dscrProxyFromYieldDrag(inputs.capitalExposureUsd, inputs.yieldDrag);

  const leverage =
    inputs.leverageProxy ??
    leverageProxyFromYieldDrag(inputs.capitalExposureUsd, inputs.yieldDrag);

  const score = scoreModel(
    inputs.riskIndex,
    inputs.yieldDrag,
    dscr,
    leverage
  );

  const tier = classifyCredit(score);

  const pd = pdFromScore(score);
  const pdBand = boundedProbabilityBand(pd, 12);

  const lgd = lgdFromCoverage(inputs.insuredCoverageRatio);

  const ecl = expectedCreditLoss(
    inputs.creditExposureUsd,
    pd,
    lgd
  );

  const eclBand = uncertaintyBandFromData(ecl, 12);

  return {
    score,
    tier,
    pd,
    pdBand,
    lgd,
    ecl,
    eclBand,
    dscrProxy: dscr,
    leverageProxy: leverage,
    insuredCoverageRatio: inputs.insuredCoverageRatio
  };
}