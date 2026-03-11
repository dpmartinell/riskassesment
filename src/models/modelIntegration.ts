import { clamp } from "./utils";
import type { PondCalibration } from "./wqCalibration";
import type { PondWQFeatures } from "./wqFeatures";
import type { WeatherCalibrationRow } from "./weatherCalibration";

export type IntegratedPondModelInputs = {
  pond_id: string;
  calibration: PondCalibration;
  features: PondWQFeatures;
  weatherCalibration?: WeatherCalibrationRow;
};

export type IntegratedPondModelOutputs = {
  pond_id: string;

  biologyReplacements: {
    acuteFraction: number;
    hotspotFraction: number;
    chronicStressIndex: number;
    dataConfidenceScore: number;
  };

  insuranceReplacements: {
    triggerProbabilityProxy: number;
    hotspotFractionForInsurance: number;
    dataConfidenceScore: number;
  };

  monteCarloReplacements: {
    residualScale: number;
    acuteFraction: number;
    hotspotFraction: number;
  };

  weatherReplacements: {
    useCalibratedWeather: boolean;
    confidence: number;
    rain_to_salinity?: number;
    rain_to_om?: number;
    airtemp_to_do?: number;
    airtemp_to_wqtemp?: number;
    wind_to_do?: number;
    drought_to_salinity?: number;
  };

  bayesianObservationPackage: {
    acuteFractionObserved: number;
    hotspotFractionObserved: number;
    chronicStressObserved: number;
    riskIndexObserved: number;
    triggerProbabilityObserved: number;
    observationWeight: number;
  };

  replacementAudit: {
    replacedNow: string[];
    stillPlaceholder: string[];
  };
};

function deriveRiskIndexObserved(
  acuteFraction: number,
  hotspotFraction: number,
  chronicStressIndex: number
) {
  return clamp(
    0.45 * acuteFraction +
    0.30 * hotspotFraction +
    0.25 * chronicStressIndex,
    0,
    1
  );
}

function deriveTriggerProbabilityProxy(
  acuteFraction: number,
  hotspotFraction: number,
  chronicStressIndex: number
) {
  return clamp(
    0.40 * acuteFraction +
    0.35 * hotspotFraction +
    0.25 * chronicStressIndex,
    0,
    1
  );
}

export function integratePondModelInputs(
  inputs: IntegratedPondModelInputs
): IntegratedPondModelOutputs {
  const acuteFraction =
    inputs.calibration.placeholderReplacements.acuteFraction;

  const hotspotFraction =
    inputs.calibration.placeholderReplacements.hotspotFraction;

  const chronicStressIndex =
    inputs.calibration.placeholderReplacements.chronicStressIndex;

  const dataConfidenceScore =
    inputs.calibration.placeholderReplacements.dataConfidenceScore;

  const residualScale =
    inputs.calibration.placeholderReplacements.monteCarloResidualScale;

  const riskIndexObserved = deriveRiskIndexObserved(
    acuteFraction,
    hotspotFraction,
    chronicStressIndex
  );

  const triggerProbabilityObserved = deriveTriggerProbabilityProxy(
    acuteFraction,
    hotspotFraction,
    chronicStressIndex
  );

  const weatherReplacements = inputs.weatherCalibration
    ? {
        useCalibratedWeather: true,
        confidence: inputs.weatherCalibration.confidence,
        rain_to_salinity: inputs.weatherCalibration.rain_to_salinity,
        rain_to_om: inputs.weatherCalibration.rain_to_om,
        airtemp_to_do: inputs.weatherCalibration.airtemp_to_do,
        airtemp_to_wqtemp: inputs.weatherCalibration.airtemp_to_wqtemp,
        wind_to_do: inputs.weatherCalibration.wind_to_do,
        drought_to_salinity: inputs.weatherCalibration.drought_to_salinity
      }
    : {
        useCalibratedWeather: false,
        confidence: 0
      };

  return {
    pond_id: inputs.pond_id,

    biologyReplacements: {
      acuteFraction,
      hotspotFraction,
      chronicStressIndex,
      dataConfidenceScore
    },

    insuranceReplacements: {
      triggerProbabilityProxy: triggerProbabilityObserved,
      hotspotFractionForInsurance: hotspotFraction,
      dataConfidenceScore
    },

    monteCarloReplacements: {
      residualScale,
      acuteFraction,
      hotspotFraction
    },

    weatherReplacements,

    bayesianObservationPackage: {
      acuteFractionObserved: acuteFraction,
      hotspotFractionObserved: hotspotFraction,
      chronicStressObserved: chronicStressIndex,
      riskIndexObserved,
      triggerProbabilityObserved,
      observationWeight: inputs.calibration.observationWeight
    },

    replacementAudit: {
      replacedNow: [
        "acuteFraction",
        "hotspotFraction (partial empirical replacement)",
        "chronicStressIndex",
        "dataConfidenceScore",
        "monteCarloResidualScale",
        "weather shock hints (if weather calibration available)"
      ],
      stillPlaceholder: [
        "growth response calibration",
        "survival response calibration",
        "yield drag empirical calibration",
        "PD empirical calibration",
        "LGD empirical calibration",
        "full actuarial premium calibration"
      ]
    }
  };
}