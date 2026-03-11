import { DEFAULT_COUNTRY_PROFILES, COUNTRY_SYSTEMS } from "./reference";

type Pond = {
  id: string;
  area_ha: number;
  expectedBiomassKg: number;
  yieldDrag: number;
  riskIndex: number;
  hotspotFraction: number;
};

type Farm = {
  id: string;
  country: keyof typeof DEFAULT_COUNTRY_PROFILES;
  system: string;
  sellingPrice: number;
  ponds: Pond[];
};

type Company = {
  id: string;
  farms: Farm[];
};

type HistoricalRow = {
  year: number;
  annual_risk: number;
  acute_fraction: number;
};

export function generateHistoricalArchive(): HistoricalRow[] {

  const rows: HistoricalRow[] = [];

  const startYear = 2015;

  for (let i = 0; i < 10; i++) {

    const base = 0.35 + Math.random() * 0.3;

    rows.push({
      year: startYear + i,
      annual_risk: Math.min(0.95, Math.max(0.05, base)),
      acute_fraction: Math.random() * 0.4
    });

  }

  return rows;
}

function generatePond(id: string): Pond {

  const area = 0.8 + Math.random() * 1.5;

  const biomass = 8000 + Math.random() * 8000;

  const yieldDrag = Math.random() * 0.25;

  const riskIndex = 0.2 + Math.random() * 0.6;

  const hotspot = Math.random() * 0.4;

  return {
    id,
    area_ha: area,
    expectedBiomassKg: biomass,
    yieldDrag,
    riskIndex,
    hotspotFraction: hotspot
  };

}

function generateFarm(id: string, country: keyof typeof DEFAULT_COUNTRY_PROFILES): Farm {

  const profile = DEFAULT_COUNTRY_PROFILES[country];

  const systems = COUNTRY_SYSTEMS[country];

  const system = systems[Math.floor(Math.random() * systems.length)];

  const ponds: Pond[] = [];

  const pondCount = 5 + Math.floor(Math.random() * 6);

  for (let i = 0; i < pondCount; i++) {

    ponds.push(generatePond(`${id}-pond-${i + 1}`));

  }

  return {
    id,
    country,
    system,
    sellingPrice: profile.price,
    ponds
  };

}

export function generateDummyPortfolio(): Company[] {

  const companies: Company[] = [];

  const countries = Object.keys(DEFAULT_COUNTRY_PROFILES) as (keyof typeof DEFAULT_COUNTRY_PROFILES)[];

  countries.forEach((country, index) => {

    const farms: Farm[] = [];

    const farmCount = 1 + Math.floor(Math.random() * 5);

    for (let i = 0; i < farmCount; i++) {

      farms.push(generateFarm(`farm-${country}-${i + 1}`, country));

    }

    companies.push({
      id: `company-${index + 1}`,
      farms
    });

  });

  return companies;

}