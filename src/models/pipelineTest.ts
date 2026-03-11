import { loadPondTimeSeries } from "../data/loadPondTimeSeries";
import { loadClimateSeries } from "../data/loadClimateSeries";
import { buildPondWQFeatures } from "./wqFeatures";
import { calibrateFromWQ } from "./wqCalibration";
import { calibrateWeatherToWQ } from "./weatherCalibration";
import { integratePondModelInputs } from "./modelIntegration";
import { updatePondPosterior, posteriorToNextCycleState } from "./bayesUpdate";

export type PipelineTestResult = {
  pondTimeSeriesRows: number;
  climateRows: number;
  featureRows: number;
  calibrationRows: number;
  weatherCalibrationRows: number;
  integratedRows: number;
  posteriorRows: number;
  nextCycleRows: number;
  sample: any | null;
};

export function runPipelineTest(): PipelineTestResult {
  const pondIds = ["pond-demo-1", "pond-demo-2"];

  const pondTimeSeries = loadPondTimeSeries({
    mode: "dummy",
    pondIds,
    startDate: "2024-01-01",
    endDate: "2024-03-31"
  });

  const climateSeries = loadClimateSeries({
    mode: "dummy",
    pondIds,
    startDate: "2024-01-01",
    endDate: "2024-03-31"
  });

  const features = buildPondWQFeatures(pondTimeSeries);

  const calibrations = calibrateFromWQ(pondTimeSeries, features);

  const weatherCalibrations = calibrateWeatherToWQ(
    pondTimeSeries,
    climateSeries
  );

  const weatherMap = new Map(
    weatherCalibrations.map(row => [row.pond_id, row])
  );

  const featureMap = new Map(
    features.map(row => [row.pond_id, row])
  );

  const integrated = calibrations
    .map(calibration => {
      const feature = featureMap.get(calibration.pond_id);
      if (!feature) return null;

      const weatherCalibration = weatherMap.get(calibration.pond_id);

      return integratePondModelInputs({
        pond_id: calibration.pond_id,
        calibration,
        features: feature,
        weatherCalibration
      });
    })
    .filter(Boolean) as ReturnType<typeof integratePondModelInputs>[];

  const posterior = integrated.map(row =>
    updatePondPosterior({
      pond_id: row.pond_id,
      prior: {
        acuteFraction: 0.15,
        hotspotFraction: 0.18,
        chronicStressIndex: 0.20,
        riskIndex: 0.22,
        triggerProbability: 0.25,
        priorConfidence: 0.55
      },
      observed: {
        acuteFraction: row.bayesianObservationPackage.acuteFractionObserved,
        hotspotFraction: row.bayesianObservationPackage.hotspotFractionObserved,
        chronicStressIndex: row.bayesianObservationPackage.chronicStressObserved,
        riskIndex: row.bayesianObservationPackage.riskIndexObserved,
        triggerProbability: row.bayesianObservationPackage.triggerProbabilityObserved,
        observationWeight: row.bayesianObservationPackage.observationWeight
      }
    })
  );

  const nextCycle = posterior.map(posteriorToNextCycleState);

  return {
    pondTimeSeriesRows: pondTimeSeries.length,
    climateRows: climateSeries.length,
    featureRows: features.length,
    calibrationRows: calibrations.length,
    weatherCalibrationRows: weatherCalibrations.length,
    integratedRows: integrated.length,
    posteriorRows: posterior.length,
    nextCycleRows: nextCycle.length,
    sample: {
      pondTimeSeriesFirst: pondTimeSeries[0] ?? null,
      featureFirst: features[0] ?? null,
      calibrationFirst: calibrations[0] ?? null,
      weatherCalibrationFirst: weatherCalibrations[0] ?? null,
      integratedFirst: integrated[0] ?? null,
      posteriorFirst: posterior[0] ?? null,
      nextCycleFirst: nextCycle[0] ?? null
    }
  };
}