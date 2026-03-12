pipeline/climate/README.md
# Shrimpl Risk Platform
## Climate Data Pipeline (Copernicus / ERA5)

Version: 1.0  
Purpose: Extract climate variables from Copernicus datasets and transform them into pond-level daily observations usable by the Shrimpl risk modeling engine.

This pipeline produces the dataset:


pond_climate_timeseries


which is later consumed by:

- `loadClimateSeries.ts`
- `weatherCalibration.ts`
- `modelIntegration.ts`

The pipeline runs **outside the frontend/model repository** and produces processed datasets that the model engine can load.

---

# 1. Pipeline Objective

Convert global climate datasets into **pond-level daily climate observations**.

Each row represents:


pond_id + date


Output example:

| pond_id | date | rain_mm | air_temp_c | wind_speed_mps | drought_index |
|--------|------|---------|------------|----------------|---------------|

This dataset is required to calibrate climate → water quality relationships.

---

# 2. Climate Datasets Used

## ERA5-Land Hourly

Source: Copernicus Climate Data Store

Used variables:

| Variable | Description |
|--------|-------------|
| total_precipitation | precipitation accumulation |
| 2m_temperature | air temperature |
| 10m_u_component_of_wind | wind east component |
| 10m_v_component_of_wind | wind north component |

ERA5-Land provides hourly climate reanalysis at ~9km resolution.

Hourly data is aggregated to daily values.

---

## ERA5 Drought Indicators

Dataset:


derived-drought-historical-monthly


Used variable:

| Variable | Description |
|--------|-------------|
| SPEI | Standardized Precipitation Evapotranspiration Index |

Used as:


drought_index


Monthly values are expanded to daily.

---

# 3. MVP Scope

The first implementation should be limited to a manageable subset.

Recommended MVP configuration:

| Parameter | Value |
|---------|------|
| Countries | 1 |
| Ponds | 500–2000 |
| Time range | 1 year |
| Spatial method | pond centroid |
| Output format | parquet |

Purpose of MVP:

- validate pipeline
- test joins
- validate weather calibration
- measure runtime

---

# 4. Pipeline Structure

Directory structure:


pipeline/
climate/
fetch_era5_land_hourly.py
fetch_drought_monthly.py
build_pond_climate_timeseries.py
README.md

config/
climate_variables.yaml

outputs/
raw/
processed/


---

# 5. Pipeline Stages

## Stage 1: Load Pond Master

Input:


pond_master


Required fields:

| Field | Description |
|------|-------------|
| pond_id | unique pond identifier |
| centroid_lat | pond centroid latitude |
| centroid_lon | pond centroid longitude |
| country | country code |
| system | production system |

The centroid will be used to extract climate values.

---

## Stage 2: Download Climate Data

Script:


fetch_era5_land_hourly.py


Responsibilities:

1. connect to Copernicus CDS API
2. request ERA5-Land hourly variables
3. download data for specified region and date range
4. store raw files

Output location:


outputs/raw/


Example variables requested:

- precipitation
- air temperature
- wind components

---

## Stage 3: Download Drought Data

Script:


fetch_drought_monthly.py


Responsibilities:

1. request drought dataset
2. download monthly SPEI values
3. store raw files

Output location:


outputs/raw/


---

## Stage 4: Climate Spatial Extraction

Script:


build_pond_climate_timeseries.py


Responsibilities:

1. load pond centroids
2. load climate raster data
3. extract climate value for each pond centroid
4. perform daily aggregation
5. compute wind speed magnitude
6. attach drought index

Wind speed computed as:


wind_speed = sqrt(u² + v²)


---

# 6. Daily Aggregation Rules

### Rainfall

ERA5-Land precipitation is cumulative.

Daily rainfall:


rain_mm = sum(hourly precipitation)


---

### Air Temperature

Daily temperature:


air_temp_c = mean(hourly temperature)


---

### Wind Speed

Using u and v components:


wind_speed = sqrt(u² + v²)


Daily value:


mean(wind_speed)


---

### Drought Index

Monthly SPEI expanded to daily values:


drought_index(date) = SPEI(month(date))


---

# 7. Output Dataset

Output file:


outputs/processed/pond_climate_timeseries.parquet


Schema:

| Field | Type |
|------|------|
| pond_id | string |
| date | date |
| rain_mm | float |
| air_temp_c | float |
| wind_speed_mps | float |
| drought_index | float |
| climate_source | string |
| processing_run_id | string |

---

# 8. Quality Control

Basic QC checks must be applied.

### Rainfall


rain_mm >= 0


### Temperature

Expected range:


-10 < air_temp_c < 45


### Wind

Expected range:


0 < wind_speed_mps < 60


Rows outside plausible bounds should be flagged.

---

# 9. Data Volume Expectations

At full scale:


1.5 million ponds
× ~3650 days
≈ 5.4 billion rows


The pipeline should therefore:

- support partitioned outputs
- avoid full in-memory operations
- use chunked processing

---

# 10. Integration with Model Engine

The generated dataset feeds:


loadClimateSeries.ts


which passes rows to:


weatherCalibration.ts
modelIntegration.ts


The calibration step estimates relationships such as:


rain → salinity
rain → organic matter
air temperature → dissolved oxygen
wind → oxygen mixing
drought → salinity baseline


---

# 11. Future Extensions

Future improvements may include:

### spatial aggregation

replace centroid extraction with zonal statistics.

### additional variables

- solar radiation
- humidity
- evaporation
- soil moisture

### extreme event detection

identify:

- storms
- heatwaves
- flooding events

These signals will later be integrated into the weather risk model.

---

# 12. Pipeline Responsibilities

| Role | Responsibility |
|----|----|
| Data engineer | climate downloads and raster processing |
| Geospatial engineer | pond intersection logic |
| Model engineer | calibration and integration |
| Frontend engineer | dashboard and visualization |

---

# End of document