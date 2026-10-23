import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AcquisitionBreakdown } from './components/AcquisitionBreakdown';
import { AmortizationChart } from './components/charts/AmortizationChart';
import { BalanceChart } from './components/charts/BalanceChart';
import { BreakevenChart } from './components/charts/BreakevenChart';
import { CashflowChart } from './components/charts/CashflowChart';
import { NetWorthChart } from './components/charts/NetWorthChart';
import type { Granularity } from './components/charts/timeline';
import { FireSection } from './components/FireSection';
import { InputsPanel } from './components/InputsPanel';
import { ScenarioTable } from './components/ScenarioTable';
import { ScheduleTable } from './components/ScheduleTable';
import { afterTaxAnnual, breakEvenReturn, gapCurve } from './engine/breakeven';
import { feesOnlyApport } from './engine/fees';
import { monteCarlo } from './engine/montecarlo';
import { horizonYears, referenceIndex, simulate } from './engine/scenario';
import type { Inputs } from './engine/types';
import { eur, pct, signedEur } from './format';
import { loadInputs, saveInputs } from './state';
import { useTheme } from './theme';

export default function App() {
  const [inp, setInp] = useState<Inputs>(loadInputs);
  const [selectedId, setSelectedId] = useState(inp.scenarios[0].id);
  const [granularity, setGranularity] = useState<Granularity>('year');
  const t = useTheme();
  const set = (patch: Partial<Inputs>) => setInp((prev) => ({ ...prev, ...patch }));

  useEffect(() => saveInputs(inp), [inp]);
  useEffect(() => {
    if (!inp.scenarios.some((s) => s.id === selectedId)) setSelectedId(inp.scenarios[0].id);
  }, [inp.scenarios, selectedId]);

  const deferred = useDeferredValue(inp);
  const horizon = horizonYears(deferred);

  const results = useMemo(() => deferred.scenarios.map((d) => simulate(deferred, d)), [deferred]);
  const refIdx = referenceIndex(results);
  const ref = results[refIdx];
  const others = results.filter((_, k) => k !== refIdx).map((r) => r.def);

  const breakEvens = useMemo(() => {
    const taxRate =
      deferred.envelope === 'pea' && horizon >= 5 ? deferred.socialRate / 100 : deferred.pfuRate / 100;
    const out: Record<string, { gross: number | null; net: number | null }> = {};
    for (const d of others) {
      const gross = breakEvenReturn(deferred, d, ref.def);
      out[d.id] = { gross, net: gross == null ? null : afterTaxAnnual(gross, horizon, taxRate) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, ref.def.id, horizon]);

  const curve = useMemo(() => gapCurve(deferred, others, ref.def), [deferred, ref.def.id]);

  const mc = useMemo(
    () => (deferred.mcEnabled ? monteCarlo(deferred, deferred.scenarios, ref.def.id, Math.min(5000, Math.max(50, deferred.mcRuns))) : null),
    [deferred, ref.def.id],
  );

  const selected = results.find((r) => r.def.id === selectedId) ?? results[0];

  // Hero: the smallest-apport scenario against the biggest.
  const lowest = results.reduce((a, b) => (b.acq.apport < a.acq.apport ? b : a), results[0]);
  const heroBe = breakEvens[lowest.def.id];
  const heroGap = lowest.finalNetWorth - ref.finalNetWorth;

  const warnings: string[] = [];
  const minFees = feesOnlyApport(deferred);
  for (const r of results) {
    if (r.debtRatio > 35) warnings.push(`${r.def.name}: debt ratio ${pct(r.debtRatio, 1)} is above the 35% HCSF limit.`);
    if (r.acq.apport + 1 < minFees && r.acq.loan > 0)
      warnings.push(`${r.def.name}: apport ${eur(r.acq.apport)} doesn't cover the fees (${eur(minFees)}). Most banks require it.`);
    if (r.apportCapped) warnings.push(`${r.def.name}: you asked for ${eur(r.requestedApport)}, but only ${eur(r.acq.apport)} is available.`);
    if (r.shortfall) warnings.push(`${r.def.name}: the monthly budget goes negative and the ETF can't cover it.`);
  }
  if (deferred.loanYears > 25) warnings.push(`A ${deferred.loanYears}-year loan is above the 25-year HCSF limit.`);

  return (
    <div className="app">
      <InputsPanel inp={inp} set={set} />
      <main className="results">
        <header className="page-head">
          <h1>Mortgage vs ETF simulator</h1>
          <div className="segmented" role="group" aria-label="Time granularity">
            {(['year', 'month'] as Granularity[]).map((g) => (
              <button key={g} aria-pressed={granularity === g} onClick={() => setGranularity(g)}>
                {g === 'year' ? 'Yearly' : 'Monthly'}
              </button>
            ))}
          </div>
        </header>

        <section className="card hero">
          <p className="hero-label">
            Break-even ETF return: “{lowest.def.name}” vs “{ref.def.name}” over {horizon} years
          </p>
          {heroBe?.gross != null ? (
            <>
              <p className="hero-value">{pct(heroBe.gross)} / yr</p>
              <p className="hero-sub">
                Gross, which is about {pct(heroBe.net ?? 0)} after tax. Above that, keeping the money in the ETF beats a bigger apport.
                At your {pct(deferred.etfReturn, 1)} assumption, “{lowest.def.name}” ends <strong>{signedEur(heroGap)}</strong> vs “{ref.def.name}”.
                Loan rate is {pct(deferred.loanRate)}, TAEG about {pct(lowest.taeg)}.
              </p>
            </>
          ) : (
            <p className="hero-sub">No break-even between −5% and 20%. Make the two scenarios' apports differ, or check the inputs.</p>
          )}
        </section>

        {warnings.length > 0 && (
          <section className="card warnings" role="status">
            <ul>
              {warnings.map((w) => (
                <li key={w}>
                  <span aria-hidden="true">⚠</span> {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ScenarioTable results={results} refIdx={refIdx} breakEvens={breakEvens} mc={mc} selectedId={selected.def.id} onSelect={setSelectedId} t={t} />

        <BreakevenChart
          curve={curve}
          defs={others}
          refName={ref.def.name}
          breakEvens={Object.fromEntries(Object.entries(breakEvens).map(([k, v]) => [k, v.gross]))}
          etfReturn={deferred.etfReturn}
          t={t}
        />

        <div className="chart-grid">
          <NetWorthChart results={results} t={t} granularity={granularity} mc={mc} selectedId={selected.def.id} refId={ref.def.id} />
          <BalanceChart results={results} t={t} granularity={granularity} />
          <AmortizationChart result={selected} t={t} />
          <CashflowChart result={selected} t={t} />
        </div>

        <FireSection inp={deferred} results={results} selectedId={selected.def.id} t={t} />

        <AcquisitionBreakdown result={selected} />
        <ScheduleTable result={selected} granularity={granularity} />

        <footer className="disclaimer">
          This is a simulation, not financial or tax advice. Tax rates (DMTO, social charges, PFU, income-tax brackets) change every year.
          Check them against your notary's and your bank's figures. Scenarios with a smaller apport invest the money not put down, plus
          any monthly saving from a lower payment, in the ETF, so every scenario spends the same monthly budget.
        </footer>
      </main>
    </div>
  );
}
