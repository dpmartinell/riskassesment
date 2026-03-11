export const DEFAULT_COUNTRY_PROFILES = {
  China: {
    price: 4.9,
    baseline_survival: 0.76,
    baseline_weight: 22
  },
  India: {
    price: 4.4,
    baseline_survival: 0.77,
    baseline_weight: 22
  },
  Ecuador: {
    price: 4.6,
    baseline_survival: 0.82,
    baseline_weight: 24
  },
  Mexico: {
    price: 4.7,
    baseline_survival: 0.80,
    baseline_weight: 24
  },
  Vietnam: {
    price: 4.5,
    baseline_survival: 0.78,
    baseline_weight: 23
  },
  Thailand: {
    price: 4.7,
    baseline_survival: 0.80,
    baseline_weight: 23
  },
  Indonesia: {
    price: 4.5,
    baseline_survival: 0.79,
    baseline_weight: 23
  }
} as const;

export const DEFAULT_SYSTEMS = {
  Extensive: {
    density: "1–10 shrimp/m²"
  },
  "Semi-Intensive": {
    density: "10–30 shrimp/m²"
  },
  Intensive: {
    density: "30–80 shrimp/m²"
  },
  "Super-Intensive": {
    density: "80–150 shrimp/m²"
  }
} as const;

export const COUNTRY_SYSTEMS = {
  China: ["Extensive", "Semi-Intensive", "Intensive"],
  India: ["Semi-Intensive"],
  Ecuador: ["Semi-Intensive", "Intensive"],
  Mexico: ["Intensive"],
  Vietnam: ["Super-Intensive"],
  Thailand: ["Super-Intensive"],
  Indonesia: ["Super-Intensive"]
} as const;

export type CountryKey = keyof typeof DEFAULT_COUNTRY_PROFILES;
export type SystemKey = keyof typeof DEFAULT_SYSTEMS;