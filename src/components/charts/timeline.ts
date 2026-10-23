import type { MonthRow, ScenarioResult } from '../../engine/scenario';

export type Granularity = 'month' | 'year';

/** One row per period with a column per scenario id. Yearly = end-of-year snapshots. */
export function timeline(results: ScenarioResult[], g: Granularity, pick: (r: MonthRow) => number) {
  const n = results[0]?.months.length ?? 0;
  const step = g === 'year' ? 12 : 1;
  const out: Record<string, number>[] = [];
  for (let m = 0; m < n; m += step) {
    const row: Record<string, number> = { t: g === 'year' ? m / 12 : m };
    for (const r of results) row[r.def.id] = pick(r.months[m]);
    out.push(row);
  }
  return out;
}

export function periodLabel(v: number, g: Granularity, long = false): string {
  if (g === 'year') return long ? `Year ${v}` : `Y${v}`;
  if (!long) return v % 12 === 0 ? `Y${v / 12}` : `M${v}`;
  return `Month ${v} (year ${Math.floor(v / 12)}, month ${v % 12})`;
}
