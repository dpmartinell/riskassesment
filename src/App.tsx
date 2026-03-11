import { useMemo, useState } from "react";
import { generateDummyPortfolio, generateHistoricalArchive } from "./data/generateDummyPortfolio";
import { buildInsuranceModel } from "./models/insurance";
import { buildCreditModel } from "./models/credit";
import { runMonteCarlo } from "./models/montecarlo";

export default function App() {
  const companies = useMemo(() => generateDummyPortfolio(), []);
  const historicalRows = useMemo(() => generateHistoricalArchive(), []);

  const [companyIndex, setCompanyIndex] = useState(0);
  const selectedCompany = companies[companyIndex];

  const [farmIndex, setFarmIndex] = useState(0);
  const selectedFarm = selectedCompany.farms[farmIndex] ?? selectedCompany.farms[0];

  const [pondIndex, setPondIndex] = useState(0);
  const selectedPond = selectedFarm.ponds[pondIndex] ?? selectedFarm.ponds[0];

  const biomassValue = selectedPond.expectedBiomassKg * selectedFarm.sellingPrice;

  const insurance = buildInsuranceModel({
    riskIndex: selectedPond.riskIndex,
    hotspotFraction: selectedPond.hotspotFraction,
    historicalRows,
    expectedBiomassKg: selectedPond.expectedBiomassKg,
    salePriceUsdPerKg: selectedFarm.sellingPrice,
    yieldDragWQ: selectedPond.yieldDrag,
    capitalExposureUsd: biomassValue,
    insuredAmountUsd: biomassValue * 0.5
  });

  const insuredCoverageRatio =
    insurance.coveredValueUsd / Math.max(insurance.wqAffectedValueUsd, 1);

  const credit = buildCreditModel({
    riskIndex: selectedPond.riskIndex,
    yieldDrag: selectedPond.yieldDrag,
    capitalExposureUsd: biomassValue,
    creditExposureUsd: biomassValue * 0.35,
    insuredCoverageRatio
  });

  const mc = runMonteCarlo({
    baseRiskIndex: selectedPond.riskIndex,
    baseHotspotFraction: selectedPond.hotspotFraction,
    baseBiomassKg: selectedPond.expectedBiomassKg,
    triggerRisk: insurance.triggerRisk,
    triggerHotspot: insurance.triggerHotspot,
    payoutIfTriggeredUsd: insurance.payoutIfTriggered,
    historicalRows,
    cycles: 1000
  });

  const totalFarms = selectedCompany.farms.length;
  const totalPonds = selectedCompany.farms.reduce((acc, farm) => acc + farm.ponds.length, 0);

  return (
    <div className="app">
      <div className="top">
        <div>
          <div className="h1">Shrimpl Risk Platform</div>
          <div className="sub">
            Interactive core build using the modular biological, insurance, credit and Monte Carlo engines.
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="input">
          <label>Company</label>
          <select
            value={companyIndex}
            onChange={(e) => {
              setCompanyIndex(Number(e.target.value));
              setFarmIndex(0);
              setPondIndex(0);
            }}
          >
            {companies.map((company, i) => (
              <option key={company.id} value={i}>
                {company.id}
              </option>
            ))}
          </select>
        </div>

        <div className="input">
          <label>Farm</label>
          <select
            value={farmIndex}
            onChange={(e) => {
              setFarmIndex(Number(e.target.value));
              setPondIndex(0);
            }}
          >
            {selectedCompany.farms.map((farm, i) => (
              <option key={farm.id} value={i}>
                {farm.id}
              </option>
            ))}
          </select>
        </div>

        <div className="input">
          <label>Pond</label>
          <select
            value={pondIndex}
            onChange={(e) => setPondIndex(Number(e.target.value))}
          >
            {selectedFarm.ponds.map((pond, i) => (
              <option key={pond.id} value={i}>
                {pond.id}
              </option>
            ))}
          </select>
        </div>

        <div className="input">
          <label>Country</label>
          <div>{selectedFarm.country}</div>
        </div>

        <div className="input">
          <label>System</label>
          <div>{selectedFarm.system}</div>
        </div>

        <div className="input">
          <label>Farms in company</label>
          <div>{totalFarms}</div>
        </div>

        <div className="input">
          <label>Ponds in company</label>
          <div>{totalPonds}</div>
        </div>

        <div className="input">
          <label>Selling price</label>
          <div>${selectedFarm.sellingPrice.toFixed(2)}/kg</div>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="label">Expected biomass</div>
          <div className="value">{selectedPond.expectedBiomassKg.toFixed(0)}</div>
          <div className="small">kg</div>
        </div>

        <div className="card kpi">
          <div className="label">Yield drag</div>
          <div className="value">{(selectedPond.yieldDrag * 100).toFixed(1)}%</div>
          <div className="small">WQ-attributable production drag</div>
        </div>

        <div className="card kpi">
          <div className="label">Risk index</div>
          <div className="value">{selectedPond.riskIndex.toFixed(2)}</div>
          <div className="small">Current modeled risk level</div>
        </div>

        <div className="card kpi">
          <div className="label">Covered value</div>
          <div className="value">${insurance.coveredValueUsd.toFixed(0)}</div>
          <div className="small">Insurance sum assured</div>
        </div>

        <div className="card kpi">
          <div className="label">Credit score</div>
          <div className="value">{credit.score.toFixed(0)}</div>
          <div className="small">Tier {credit.tier}</div>
        </div>

        <div className="card kpi">
          <div className="label">MC expected loss</div>
          <div className="value">${mc.expectedLoss.toFixed(0)}</div>
          <div className="small">From 1000 simulations</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card panel">
          <h3>Selected Pond</h3>
          <div className="muted">Current pond summary</div>
          <div className="tableWrap" style={{ marginTop: 12 }}>
            <table>
              <tbody>
                <tr><th>Pond</th><td>{selectedPond.id}</td></tr>
                <tr><th>Farm</th><td>{selectedFarm.id}</td></tr>
                <tr><th>Country</th><td>{selectedFarm.country}</td></tr>
                <tr><th>System</th><td>{selectedFarm.system}</td></tr>
                <tr><th>Expected biomass</th><td>{selectedPond.expectedBiomassKg.toFixed(0)} kg</td></tr>
                <tr><th>Yield drag</th><td>{(selectedPond.yieldDrag * 100).toFixed(1)}%</td></tr>
                <tr><th>Risk index</th><td>{selectedPond.riskIndex.toFixed(2)}</td></tr>
                <tr><th>Hotspot fraction</th><td>{(selectedPond.hotspotFraction * 100).toFixed(1)}%</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card panel">
          <h3>Insurance</h3>
          <div className="muted">WQ-attributable coverage model</div>
          <div className="tableWrap" style={{ marginTop: 12 }}>
            <table>
              <tbody>
                <tr><th>Biomass value</th><td>${insurance.biomassValueUsd.toFixed(0)}</td></tr>
                <tr><th>WQ-affected value</th><td>${insurance.wqAffectedValueUsd.toFixed(0)}</td></tr>
                <tr><th>Covered value</th><td>${insurance.coveredValueUsd.toFixed(0)}</td></tr>
                <tr><th>Payout rate</th><td>{(insurance.payoutRate * 100).toFixed(1)}%</td></tr>
                <tr><th>Historical P(trigger)</th><td>{(insurance.historicalTriggerProbability * 100).toFixed(1)}%</td></tr>
                <tr><th>Expected payout</th><td>${insurance.expectedPayout.toFixed(0)}</td></tr>
                <tr><th>Premium</th><td>${insurance.premiumIndicative.toFixed(0)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card panel">
          <h3>Credit</h3>
          <div className="muted">Risk-adjusted credit profile</div>
          <div className="tableWrap" style={{ marginTop: 12 }}>
            <table>
              <tbody>
                <tr><th>Score</th><td>{credit.score.toFixed(0)}</td></tr>
                <tr><th>Tier</th><td>{credit.tier}</td></tr>
                <tr><th>PD</th><td>{(credit.pd * 100).toFixed(1)}%</td></tr>
                <tr><th>LGD</th><td>{(credit.lgd * 100).toFixed(1)}%</td></tr>
                <tr><th>ECL</th><td>${credit.ecl.toFixed(0)}</td></tr>
                <tr><th>DSCR proxy</th><td>{credit.dscrProxy.toFixed(2)}</td></tr>
                <tr><th>Leverage proxy</th><td>{credit.leverageProxy.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card panel">
          <h3>Monte Carlo</h3>
          <div className="muted">Semi-empirical distribution from historical residuals</div>
          <div className="tableWrap" style={{ marginTop: 12 }}>
            <table>
              <tbody>
                <tr><th>Cycles</th><td>{mc.cycles}</td></tr>
                <tr><th>Trigger probability</th><td>{(mc.triggerProbability * 100).toFixed(1)}%</td></tr>
                <tr><th>Average payout if triggered</th><td>${mc.avgPayoutIfTriggered.toFixed(0)}</td></tr>
                <tr><th>Expected loss</th><td>${mc.expectedLoss.toFixed(0)}</td></tr>
                <tr><th>Biomass P10</th><td>{mc.biomassP10.toFixed(0)} kg</td></tr>
                <tr><th>Biomass P50</th><td>{mc.biomassP50.toFixed(0)} kg</td></tr>
                <tr><th>Biomass P90</th><td>{mc.biomassP90.toFixed(0)} kg</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card panel" style={{ marginTop: 16 }}>
        <h3>Ponds in Selected Farm</h3>
        <div className="muted">Quick comparison table</div>
        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Pond</th>
                <th>Biomass</th>
                <th>Yield drag</th>
                <th>Risk</th>
                <th>Hotspot</th>
              </tr>
            </thead>
            <tbody>
              {selectedFarm.ponds.map((pond) => (
                <tr key={pond.id}>
                  <td>{pond.id}</td>
                  <td>{pond.expectedBiomassKg.toFixed(0)} kg</td>
                  <td>{(pond.yieldDrag * 100).toFixed(1)}%</td>
                  <td>{pond.riskIndex.toFixed(2)}</td>
                  <td>{(pond.hotspotFraction * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}