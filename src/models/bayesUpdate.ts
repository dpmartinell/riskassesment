import { clamp } from "./utils";

export type BayesianScalarState = {
  priorMean: number;
  priorConfidence: number; // 0 to 1
  observedValue: number;
  observationWeight: number; // 0 to 1
  posteriorMean: number;
  posteriorConfidence: number; // 0 to 1
};

export type PondPosteriorUpdate = {
  pond_id: string;

  acuteFraction: BayesianScalarState;
  hotspotFraction: BayesianScalarState;
  chronicStressIndex: BayesianScalarState;
  riskIndex: BayesianScalarState;
  triggerProbability: BayesianScalarState;
};

function updateScalar(
  priorMean: number,
  priorConfidence: number,
  observedValue: number,
  observationWeight: number,
  minValue = 0,
  maxValue = 1
): BayesianScalarState {
  const priorC = clamp(priorConfidence, 0.01, 1);
  const obsW = clamp(observationWeight, 0.01, 1);

  const posteriorMean =
    (priorMean * priorC + observedValue * obsW) / (priorC + obsW);

  const posteriorConfidence = clamp(
    priorC + obsW * (1 - priorC) * 0.8,
    0,
    1
  );

  return {
    priorMean: clamp(priorMean, minValue, maxValue),
    priorConfidence: priorC,
    observedValue: clamp(observedValue, minValue, maxValue),
    observationWeight: obsW,
    posteriorMean: clamp(posteriorMean, minValue, maxValue),
    posteriorConfidence
  };
}

export type PondBayesInputs = {
  pond_id: string;

  prior: {
    acuteFraction: number;
    hotspotFraction: number;
    chronicStressIndex: number;
    riskIndex: number;
    triggerProbability: number;
    priorConfidence: number;
  };

  observed: {
    acuteFraction: number;
    hotspotFraction: number;
    chronicStressIndex: number;
    riskIndex: number;
    triggerProbability: number;
    observationWeight: number;
  };
};

export function updatePondPosterior(
  inputs: PondBayesInputs
): PondPosteriorUpdate {
  return {
    pond_id: inputs.pond_id,

    acuteFraction: updateScalar(
      inputs.prior.acuteFraction,
      inputs.prior.priorConfidence,
      inputs.observed.acuteFraction,
      inputs.observed.observationWeight
    ),

    hotspotFraction: updateScalar(
      inputs.prior.hotspotFraction,
      inputs.prior.priorConfidence,
      inputs.observed.hotspotFraction,
      inputs.observed.observationWeight
    ),

    chronicStressIndex: updateScalar(
      inputs.prior.chronicStressIndex,
      inputs.prior.priorConfidence,
      inputs.observed.chronicStressIndex,
      inputs.observed.observationWeight
    ),

    riskIndex: updateScalar(
      inputs.prior.riskIndex,
      inputs.prior.priorConfidence,
      inputs.observed.riskIndex,
      inputs.observed.observationWeight
    ),

    triggerProbability: updateScalar(
      inputs.prior.triggerProbability,
      inputs.prior.priorConfidence,
      inputs.observed.triggerProbability,
      inputs.observed.observationWeight
    )
  };
}

export type CycleLearningState = {
  pond_id: string;
  learnedRisk: number;
  learnedAcuteFraction: number;
  learnedHotspotFraction: number;
  learnedTriggerProbability: number;
  learnedConfidence: number;
};

export function posteriorToNextCycleState(
  posterior: PondPosteriorUpdate
): CycleLearningState {
  return {
    pond_id: posterior.pond_id,
    learnedRisk: posterior.riskIndex.posteriorMean,
    learnedAcuteFraction: posterior.acuteFraction.posteriorMean,
    learnedHotspotFraction: posterior.hotspotFraction.posteriorMean,
    learnedTriggerProbability: posterior.triggerProbability.posteriorMean,
    learnedConfidence: meanConfidence([
      posterior.riskIndex.posteriorConfidence,
      posterior.acuteFraction.posteriorConfidence,
      posterior.hotspotFraction.posteriorConfidence,
      posterior.triggerProbability.posteriorConfidence
    ])
  };
}

function meanConfidence(values: number[]) {
  if (!values.length) return 0;
  return clamp(
    values.reduce((a, b) => a + b, 0) / values.length,
    0,
    1
  );
}