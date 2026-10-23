import type { ReactNode } from 'react';
import type { McResult } from '../engine/montecarlo';
import type { ScenarioResult } from '../engine/scenario';
import { eur, pct, signedEur } from '../format';
import { slotOf, type Theme } from '../theme';

interface Props {
  results: ScenarioResult[];
  refIdx: number;
  breakEvens: Record<string, { gross: number | null; net: number | null }>;
  mc: McResult | null;
  selectedId: string;
  onSelect: (id: string) => void;
  t: Theme;
}

const years = (m: number) => `${Math.floor(m / 12)} y${m % 12 ? ` ${m % 12} m` : ''}`;

export function ScenarioTable({ results, refIdx, breakEvens, mc, selectedId, onSelect, t }: Props) {
  const ref = results[refIdx];
  const rows: [string, (r: ScenarioResult, k: number) => ReactNode][] = [
    ['Apport', (r) => eur(r.acq.apport)],
    ['Loan amount', (r) => eur(r.acq.loan)],
    ['Monthly payment incl. insurance', (r) => eur(r.monthlyPayment)],
    ['of which insurance', (r) => eur(r.insuranceMonthly)],
    ['Loan duration', (r) => (r.loanMonths ? years(r.loanMonths) : '—')],
    ['Total interest', (r) => eur(r.totalInterest)],
    ['Total insurance', (r) => eur(r.totalInsurance)],
    ['Notary + guarantee + bank + broker', (r) => eur(r.acq.feesTotal)],
    ['TAEG (estimate)', (r) => (r.acq.loan ? pct(r.taeg) : '—')],
    ['Debt ratio (HCSF ≤ 35%)', (r) => <span className={r.debtRatio > 35 ? 'bad' : ''}>{pct(r.debtRatio, 1)}</span>],
    ['Lowest monthly amount left to invest', (r) => <span className={r.minFreeCash < 0 ? 'bad' : ''}>{eur(r.minFreeCash)}</span>],
    ['Net worth at horizon', (r) => <strong>{eur(r.finalNetWorth)}</strong>],
    ['Δ vs ' + ref.def.name, (r, k) => (k === refIdx ? 'reference' : signedEur(r.finalNetWorth - ref.finalNetWorth))],
    [
      'Break-even ETF return (gross / net)',
      (r, k) => {
        if (k === refIdx) return 'reference';
        const be = breakEvens[r.def.id];
        return be?.gross != null ? `${pct(be.gross)} / ≈${pct(be.net ?? 0)}` : 'n/a';
      },
    ],
  ];
  if (mc) {
    rows.push(['Median net worth (Monte Carlo)', (r) => eur(mc.finalP50[r.def.id])]);
    rows.push([`Chance of beating ${ref.def.name}`, (r, k) => (k === refIdx ? 'reference' : pct(mc.probBeatsRef[r.def.id] * 100, 0))]);
  }

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3>Scenario comparison</h3>
          <p className="subtitle">Click a column to show it in the detailed charts and the schedule.</p>
        </div>
      </header>
      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th />
              {results.map((r) => (
                <th key={r.def.id} className={r.def.id === selectedId ? 'selected' : ''}>
                  <button className="col-select" onClick={() => onSelect(r.def.id)} aria-pressed={r.def.id === selectedId}>
                    <span className="swatch" style={{ background: t.series[slotOf(r.def.id)] }} />
                    {r.def.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {results.map((r, k) => (
                  <td key={r.def.id} className={r.def.id === selectedId ? 'selected' : ''}>
                    {cell(r, k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
