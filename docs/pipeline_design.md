# Shrimpl Risk Platform
## Data Pipeline Design

Version: 1.0  
Purpose: Define the end-to-end data pipeline required to transform raw geospatial, satellite and climate data into pond-level analytical datasets usable by the Shrimpl risk modeling engine.

This document describes the external data engineering pipeline, not the frontend application.

---

# 1. Pipeline Objective

The pipeline converts raw environmental data sources into standardized pond-level datasets required by the model engine.

Main outputs:

- `pond_master`
- `pond_wq_timeseries`
- `pond_climate_timeseries`
- `pond_env_timeseries` (logical join or materialized table)
- `pond_wq_features`
- `pond_cycle_summary`
- `pond_cycle_learning_state` (generated later by model layer)

The central modeling unit is:

pond_id + date

---

# 2. High-Level Pipeline Architecture

```text
Pond geometries
    +
Satellite imagery
    +
Climate datasets
    ↓
Geospatial preprocessing
    ↓
Pixel/grid intersection with ponds
    ↓
Pond-level aggregation
    ↓
Quality control and metadata
    ↓
Derived features and summaries
    ↓
Model ingestion layer

Two main raw data branches feed the system:

Branch A: Water Quality Pipeline
Satellite / drone imagery
→ reflectance preprocessing
→ WQ retrieval models
→ pixel-level WQ estimates
→ spatial intersection with pond polygons
→ pond-level aggregation
→ pond_wq_timeseries
Branch B: Climate Pipeline
Copernicus / climate products
→ climate grid extraction
→ intersection with pond polygons or centroids
→ pond-level climate aggregation
→ pond_climate_timeseries
3. Pipeline Boundaries
Outside the frontend/model repository

The following should be handled by external batch pipelines:

geospatial raster processing

Copernicus downloads

satellite retrieval model execution

polygon-raster intersection

zonal statistics

large-scale historical backfills

parquet/csv/database materialization

Inside the model repository

The following should be handled by the application/model engine:

loading pond-level processed tables

feature engineering from pond-level time series

calibration

model integration

Bayesian updating

insurance / credit / Monte Carlo modeling

UI and reporting

4. Pipeline Stage 0: Pond Master Construction
Input

One or more geospatial files containing pond polygons, such as:

GeoJSON

Shapefile

PostGIS table

geopackage

Output

pond_master

Required responsibilities

Validate geometry

Assign stable pond_id

Attach metadata:

farm_id

company_id

country

system

Compute:

area

centroid

Store geometry in master reference dataset

Notes

pond_id must remain stable across processing runs

if polygon versions change over time, versioning may be needed later

geometry should ideally be stored in a spatial database or canonical geospatial file

5. Pipeline Stage 1: Water Quality Extraction
5.1 Raw Inputs

satellite or drone imagery

reflectance bands

cloud masks

scene metadata

5.2 Retrieval Model Execution

The WQ retrieval layer transforms reflectance into environmental estimates.

Typical outputs per pixel:

DO

TEMP

SAL

OM

N

P

ALG

cloud

quality_flag

5.3 Intermediate Dataset

Optional but strongly recommended:

pixel_wq_observations

Fields:

pond_id or spatially joinable geometry

date

pixel_id

DO

TEMP

SAL

OM

N

P

ALG

cloud

quality_flag

sensor_source

retrieval_model_version

processing_run_id

This table is useful for auditability, but may be too large for routine model serving.

6. Pipeline Stage 2: WQ Spatial Aggregation
Objective

Convert pixel-level WQ estimates into pond-level daily or sub-daily summaries.

Join logic

For each image date:

Identify all pixels intersecting each pond polygon

Filter invalid or low-quality pixels

Compute pond-level statistics

Output

pond_wq_timeseries

Statistics to compute

For each variable:

mean

standard deviation

p10

p50

p90

For observation quality:

n_pixels_total

n_pixels_valid

valid_pixel_fraction

cloud_mean

quality_score

Notes

This step corresponds conceptually to what the application expects from:

wqAggregation.ts

but the heavy spatial computation should happen outside the app.

7. Pipeline Stage 3: Climate Data Ingestion
Raw source

Climate datasets such as:

Copernicus Climate Data Store

ERA5 / ERA5-Land

drought products

rainfall grids

temperature grids

wind grids

Variables of interest

Minimum:

rain_mm

air_temp_c

wind_speed_mps

drought_index

Optional:

solar radiation

evaporation

humidity

runoff proxy

soil moisture

Storage of raw data

Recommended formats:

NetCDF

GRIB

cloud object storage

tiled parquet after preprocessing

8. Pipeline Stage 4: Climate Spatial Aggregation
Objective

Transform grid-based climate data into pond-level daily observations.

Spatial strategy

Depending on climate product resolution:

Option A: centroid-based extraction

Use pond centroid if grid is coarse and pond is small relative to grid cell.

Option B: zonal statistics over polygon

Preferred when feasible:

area-weighted mean

multi-cell intersection

better spatial accuracy

Output

pond_climate_timeseries

Notes

This is the table consumed later by:

loadClimateSeries.ts

weatherCalibration.ts

9. Pipeline Stage 5: Pond Environmental Join
Objective

Build a unified pond-date dataset for calibration and modeling.

Logical join

Join on:

pond_id

date

Result

pond_env_timeseries (can be a materialized table or logical view)

Includes:

WQ

DO_mean

TEMP_mean

SAL_mean

OM_mean

N_mean

P_mean

ALG_mean

quality_score

Climate

rain_mm

air_temp_c

wind_speed_mps

drought_index

Metadata

country

system

area_ha

This is the dataset used by:

wqFeatures.ts

wqCalibration.ts

weatherCalibration.ts

10. Pipeline Stage 6: Feature Engineering
Objective

Generate derived environmental indicators from pond-level time series.

Output

pond_wq_features

Examples:

acute_fraction

hotspot_fraction_empirical

low_do_event_count

temp_extreme_count

salinity_shock_count

persistence_low_do

chronic_stress_index

This logic is currently implemented in:

wqFeatures.ts

For large-scale production, feature generation may also be run in batch and materialized.

11. Pipeline Stage 7: Cycle Summarization
Objective

Summarize within-cycle observations into one cycle-level representation.

This is necessary because the Bayesian model should learn:

once per cycle

not:

once per daily observation

Output

pond_cycle_summary

Includes:

cycle_start

cycle_end

acute_fraction_cycle

hotspot_fraction_cycle

chronic_stress_index_cycle

risk_index_cycle

trigger_probability_proxy_cycle

observation_weight

This becomes the direct input for Bayesian updating.

12. Pipeline Stage 8: Bayesian Learning State
Objective

Store posterior learned parameters after each completed cycle.

Output

pond_cycle_learning_state

Fields:

pond_id

cycle_id

learnedRisk

learnedAcuteFraction

learnedHotspotFraction

learnedTriggerProbability

learnedConfidence

This state becomes the prior for the next cycle.

13. Batch vs Incremental Processing
Historical backfill mode

Used to process 10 years of historical data.

Characteristics:

batch execution

large raster archives

long-running jobs

parquet/database output

Incremental mode

Used for new incoming observations.

Characteristics:

process only new dates

append or upsert into pond tables

re-run feature and cycle summary only where needed

14. Recommended Storage Strategy
Raw layer

Store original climate and imagery products in object storage or archive.

Processed layer

Store pond-level processed tables in:

parquet

DuckDB

PostgreSQL/PostGIS

cloud warehouse

Serving layer

Expose compact tables for the application:

pond_wq_timeseries

pond_climate_timeseries

pond_cycle_summary

pond_cycle_learning_state

15. Quality Control

Each pipeline stage should track:

processing_run_id

source

quality_flag

coverage_fraction

retrieval_model_version

Example QC rules
WQ

reject observations with valid_pixel_fraction < 0.5

down-weight observations with quality_score < 0.6

Climate

reject rows with missing mandatory variables

mark rows with partial coverage

16. Scaling Considerations

Target scale:

~1.5 million ponds

~10 years historical coverage

daily or every-3-day observations

Implications

pixel-level tables may be extremely large

pond-level tables should be partitioned by date and/or country

joins should be optimized around pond_id + date

feature generation should run in distributed or chunked mode

UI must never consume raw pixel or raster data

17. Operational Responsibilities by Layer
Geospatial pipeline engineer

Responsible for:

pond master maintenance

raster-polygon intersection

zonal statistics

spatial QC

Climate data engineer

Responsible for:

Copernicus downloads

climate variable extraction

climate aggregation by pond

Model engineer

Responsible for:

calibration logic

feature logic

model integration

Bayesian learning

risk model consistency

Frontend engineer

Responsible for:

dashboard

reporting

filters

visualization

user interaction

18. Integration with Current Codebase

The application is already prepared to consume processed datasets through adapters:

loadPondTimeSeries.ts

loadClimateSeries.ts

These adapters should receive rows matching the processed schemas.

The following modules already expect pond-level inputs:

wqFeatures.ts

wqCalibration.ts

weatherCalibration.ts

modelIntegration.ts

bayesUpdate.ts

19. Immediate Next Technical Milestones

Finalize documentation:

architecture.md

data_schema.md

pipeline_design.md

Build external climate pipeline:

Copernicus download

pond-level aggregation

pond_climate_timeseries

Build external WQ pipeline:

reflectance → WQ retrieval

pond-level aggregation

pond_wq_timeseries

Run model engine with real sample data

Refine UI after model and data flow are validated

20. Summary

The platform should not consume raw geospatial data directly.

Instead, the system should operate on pond-level, date-indexed processed datasets generated by external pipelines.

Core contract:

pond_master
pond_wq_timeseries
pond_climate_timeseries
pond_cycle_summary
pond_cycle_learning_state

This design keeps the platform:

scalable

auditable

modular

production-ready