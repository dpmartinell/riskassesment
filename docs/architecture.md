SHRIMPL RISK PLATFORM
System Architecture & Model Documentation
Version: v1 (Core Architecture)
Author: Daniel Peñalosa
Purpose: Define the architecture and modeling framework for the Shrimpl risk platform integrating biological, environmental, insurance, credit and stochastic modeling.
________________________________________
1. System Purpose
The Shrimpl Risk Platform is a bioeconomic risk modeling system for aquaculture production systems, initially focused on shrimp farming.
The system estimates:
•	biological production risk
•	environmental stress risk
•	insurance exposure
•	credit risk
•	expected loss distributions
using a combination of:
•	water quality observations
•	climate observations
•	statistical calibration
•	Monte Carlo simulation
•	Bayesian learning between production cycles.
The platform is designed to operate at pond-level resolution.
________________________________________
2. Core Design Principles
2.1 Pond-level modeling
The base unit of analysis is:
pond_id + date
All environmental and biological observations are aggregated at pond level.
________________________________________
2.2 Modular modeling architecture
The system separates the following components:
DATA INGESTION
↓
FEATURE ENGINEERING
↓
CALIBRATION
↓
MODEL INTEGRATION
↓
STOCHASTIC SIMULATION
↓
FINANCIAL MODELS
↓
BAYESIAN LEARNING
Each module is isolated to ensure maintainability.
________________________________________
2.3 Separation of Data Pipelines and Model Engine
Heavy geospatial processing is not performed inside the application.
Instead:
external data pipeline
↓
processed pond-level tables
↓
model engine
This allows scaling to millions of ponds.
________________________________________
3. System Architecture Overview
                 +----------------------+
                 |   Satellite Imagery  |
                 |  (Sentinel / Drone)  |
                 +----------+-----------+
                            |
                            v
                   WQ Retrieval Models
                            |
                            v
                Pixel-level Water Quality
                            |
                            v
                Pond Spatial Aggregation
                            |
                            v
               pond_wq_timeseries table
Parallel climate pipeline:
        Copernicus Climate Data Store
                    |
                    v
             Climate Raster Data
                    |
                    v
        Spatial Intersection with Ponds
                    |
                    v
          pond_climate_timeseries
These feed the model engine:
pond_wq_timeseries
pond_climate_timeseries
         |
         v
     Model Engine
         |
         v
 Biological + Financial Risk
________________________________________
4. Data Architecture
4.1 Pond Master Table
pond_master
Defines the spatial universe of ponds.
Fields:
pond_id (PK)
farm_id
company_id
country
system
area_ha
geometry
centroid_lat
centroid_lon
active_from
active_to
source
Optional:
species
stocking_density
watershed
region
master_quality_flag
________________________________________
4.2 Water Quality Time Series
pond_wq_timeseries
Primary environmental dataset.
Primary key:
pond_id + date
Fields:
pond_id
date

n_pixels_total
n_pixels_valid
valid_pixel_fraction

cloud_mean
quality_score

DO_mean
DO_sd
DO_p10
DO_p50
DO_p90

TEMP_mean
TEMP_sd
TEMP_p10
TEMP_p50
TEMP_p90

SAL_mean
SAL_sd
SAL_p10
SAL_p50
SAL_p90

OM_mean
OM_sd
OM_p10
OM_p50
OM_p90

N_mean
N_sd
N_p10
N_p50
N_p90

P_mean
P_sd
P_p10
P_p50
P_p90

ALG_mean
ALG_sd
ALG_p10
ALG_p50
ALG_p90
Optional:
sensor_source
retrieval_model_version
processing_run_id
coverage_fraction
quality_flag
________________________________________
4.3 Climate Time Series
pond_climate_timeseries
Climate observations aggregated at pond level.
Primary key:
pond_id + date
Fields:
pond_id
date

rain_mm
air_temp_c
wind_speed_mps
drought_index
Optional:
air_temp_min
air_temp_max
solar_radiation
evaporation_mm
soil_moisture
relative_humidity
________________________________________
5. Core Model Engine
The modeling engine is implemented in the src/models folder.
Main modules:
wqFeatures.ts
wqCalibration.ts
weatherCalibration.ts
modelIntegration.ts
bayesUpdate.ts
montecarlo.ts
insurance.ts
credit.ts
________________________________________
6. Water Quality Feature Engineering
File:
wqFeatures.ts
Computes summary statistics per pond:
acute_fraction
hotspot_fraction_empirical
low_do_event_count
temp_extreme_count
salinity_shock_count
persistence_low_do
chronic_stress_index
Also computes mean values for:
DO
TEMP
SAL
OM
N
P
ALG
________________________________________
7. Water Quality Calibration
File:
wqCalibration.ts
Purpose:
Estimate empirical distributions of environmental parameters.
Outputs:
DO_distribution
TEMP_distribution
SAL_distribution
OM_distribution
N_distribution
P_distribution
ALG_distribution
Also estimates:
observationWeight
dataConfidenceScore
weatherShockHints
These replace model placeholders.
________________________________________
8. Climate Calibration
File:
weatherCalibration.ts
Estimates relationships between climate and WQ.
Examples:
rain → salinity
rain → OM
rain → nutrients
air temperature → dissolved oxygen
air temperature → water temperature
wind → dissolved oxygen
drought → salinity
Outputs coefficients and confidence levels.
________________________________________
9. Model Integration
File:
modelIntegration.ts
Combines outputs from:
WQ calibration
climate calibration
feature engineering
to replace model placeholders in:
biology model
insurance model
monte carlo model
Produces:
bayesianObservationPackage
which summarizes observed risk signals.
________________________________________
10. Monte Carlo Simulation
File:
montecarlo.ts
Monte Carlo simulation estimates stochastic distributions of outcomes.
Simulated variables:
biomass
trigger events
insurance payouts
production shocks
Simulation uses:
empirical residual distributions
calibrated WQ stress
risk index
trigger probabilities
________________________________________
11. Insurance Model
File:
insurance.ts
Calculates:
covered value
expected payout
trigger probability
premium estimate
Based on:
risk index
hotspot fraction
yield drag
historical shocks
________________________________________
12. Credit Model
File:
credit.ts
Calculates:
credit score
PD (probability of default)
LGD
expected credit loss
Inputs include:
risk index
yield drag
insurance coverage
capital exposure
________________________________________
13. Bayesian Learning Layer
File:
bayesUpdate.ts
Purpose:
Update model parameters between production cycles.
Key rule:
learning occurs once per cycle, not per observation.
Posterior update uses:
priorMean
priorConfidence
observedValue
observationWeight
Outputs:
posteriorMean
posteriorConfidence
Next cycle state:
learnedRisk
learnedAcuteFraction
learnedHotspotFraction
learnedTriggerProbability
learnedConfidence
________________________________________
14. Data Ingestion Layer
Files:
loadPondTimeSeries.ts
loadClimateSeries.ts
These adapters allow the system to operate in two modes:
dummy mode (for testing)
real mode (for production)
This decouples the model engine from external data sources.
________________________________________
15. Pipeline Integration Test
File:
pipelineTest.ts
Runs a full integration test:
loadPondTimeSeries
→ buildPondWQFeatures
→ calibrateFromWQ
→ loadClimateSeries
→ calibrateWeatherToWQ
→ integratePondModelInputs
→ updatePondPosterior
→ posteriorToNextCycleState
Confirms that the system components connect correctly.
________________________________________
16. External Data Pipelines
External pipelines must generate:
Water Quality
satellite imagery
→ WQ retrieval
→ pixel WQ
→ pond aggregation
→ pond_wq_timeseries
Climate
Copernicus climate data
→ raster processing
→ intersection with pond polygons
→ pond_climate_timeseries
These pipelines should be implemented separately from the frontend.
________________________________________
17. Scaling Considerations
The architecture is designed to support:
> 1 million ponds
> 10 years historical data
> daily or sub-weekly observations
By keeping heavy spatial processing outside the model engine.
________________________________________
18. Future Model Improvements
Planned improvements include:
biological calibration
growth response models
survival response models
disease pressure proxies
financial calibration
actuarial premium estimation
portfolio aggregation
insurance layer optimization
climate modeling
rainfall lag structures
seasonal regime detection
extreme weather events
________________________________________
19. Next Development Steps
Immediate priorities:
1.	Implement real data pipelines for
o	pond_wq_timeseries
o	pond_climate_timeseries
2.	Connect real datasets to the adapters.
3.	Improve biological calibration.
4.	Develop advanced UI.
________________________________________
20. Repository Structure
src/
  data/
      loadPondTimeSeries.ts
      loadClimateSeries.ts

  models/
      wqFeatures.ts
      wqCalibration.ts
      weatherCalibration.ts
      modelIntegration.ts
      montecarlo.ts
      insurance.ts
      credit.ts
      bayesUpdate.ts
      pipelineTest.ts

docs/
  architecture.md
