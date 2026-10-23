import { DEFAULTS } from '../defaults';
import { fireAnalysis, fireLevels, firePath } from './fire';
import { simulate } from './scenario';

const inp = { ...DEFAULTS, loanYears: 25 };
const def = inp.scenarios[0];

describe('early retirement', () => {
  const fa = fireAnalysis(inp, def);

  it('builds levels from expenses up to the current salary', () => {
    const levels = fireLevels(inp, simulate(inp, def, { months: 12 * 55 }));
    expect(levels[0].label).toBe('Expenses');
    expect(levels.at(-1)!.label).toBe('Current salary');
    for (let k = 1; k < levels.length; k++) expect(levels[k].todayMonthly).toBeGreaterThan(levels[k - 1].todayMonthly);
  });

  it('uses the same lifestyle levels for every scenario', () => {
    const counts = inp.scenarios.map((d) => fireLevels(inp, simulate(inp, d, { months: 12 * 55 })).map((l) => Math.round(l.todayMonthly)));
    counts.forEach((c) => expect(c).toEqual(counts[0]));
  });

  it('needs a lower return the later you retire and the less you spend', () => {
    fa.required.forEach((row) => {
      const vals = row.filter((v): v is number => v != null);
      for (let a = 1; a < vals.length; a++) expect(vals[a]).toBeLessThanOrEqual(vals[a - 1]);
    });
    fa.ages.forEach((_, a) => {
      for (let k = 1; k < fa.levels.length; k++) {
        const lo = fa.required[k - 1][a];
        const hi = fa.required[k][a];
        if (lo != null && hi != null) expect(hi).toBeGreaterThanOrEqual(lo);
      }
    });
  });

  it('the money lasts until the end age at the required return', () => {
    const a = fa.ages.findIndex((_, idx) => fa.required[0][idx] != null && fa.required[0][idx]! > 0);
    const r = fa.required[0][a]!;
    const ok = firePath(inp, def, fa.levels[0], fa.ages[a], r);
    expect(ok.at(-1)!.capital).toBeGreaterThanOrEqual(0);
    const short = firePath(inp, def, fa.levels[0], fa.ages[a], r - 0.2);
    expect(short.at(-1)!.capital).toBeLessThan(0);
  });

  it('earliest ages at the assumed return are consistent with the grid', () => {
    fa.earliestAge.forEach((age, k) => {
      if (age == null) return;
      const r = fa.required[k][fa.ages.indexOf(age)]!;
      expect(r).toBeLessThanOrEqual(inp.etfReturn + 0.1);
    });
  });
});
