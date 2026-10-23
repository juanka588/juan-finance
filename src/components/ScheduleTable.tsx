import type { MonthRow, ScenarioResult } from '../engine/scenario';
import { eur } from '../format';
import type { Granularity } from './charts/timeline';

const COLUMNS: [keyof MonthRow, string][] = [
  ['payment', 'Payment'],
  ['interest', 'Interest'],
  ['principal', 'Principal'],
  ['insurance', 'Insurance'],
  ['prepay', 'Prepayment'],
  ['penalty', 'Penalty'],
  ['balance', 'Remaining'],
  ['income', 'Net income'],
  ['costs', 'Costs'],
  ['invested', 'Invested'],
  ['etf', 'ETF (net)'],
  ['savings', 'Savings (net)'],
  ['property', 'Property'],
  ['netWorth', 'Net worth'],
];

export function ScheduleTable({ result, granularity }: { result: ScenarioResult; granularity: Granularity }) {
  const rows: (MonthRow & { label: string })[] =
    granularity === 'year'
      ? result.years.map((y) => ({ ...y, label: `Year ${y.year}` }))
      : result.months.slice(1).map((m) => ({ ...m, label: `Y${Math.floor((m.month - 1) / 12) + 1} M${((m.month - 1) % 12) + 1}` }));
  const hasPrepay = result.months.some((m) => m.prepay > 0);
  const cols = COLUMNS.filter(([k]) => hasPrepay || (k !== 'prepay' && k !== 'penalty'));

  const exportCsv = () => {
    const header = ['Period', ...cols.map(([, l]) => l)].join(';');
    const body = rows.map((r) => [r.label, ...cols.map(([k]) => r[k].toFixed(2))].join(';')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schedule-${result.def.name.replace(/\W+/g, '-')}-${granularity}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3>Schedule: {result.def.name}</h3>
          <p className="subtitle">{granularity === 'year' ? 'Yearly totals; balances at year end' : 'Month by month'}</p>
        </div>
        <button className="ghost" onClick={exportCsv}>
          Export CSV
        </button>
      </header>
      <div className={granularity === 'month' ? 'table-wrap schedule' : 'table-wrap'}>
        <table className="compare num">
          <thead>
            <tr>
              <th>Period</th>
              {cols.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {cols.map(([k]) => (
                  <td key={k}>{eur(r[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
