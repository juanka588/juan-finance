import { netIncomeByYear, simulate, type ScenarioResult } from './scenario';
import type { Inputs, ScenarioDef } from './types';

// Early retirement: you stop working at age A and live off liquid wealth (ETF + savings,
// after latent tax; the house is not sold) until `endAge`. The state pension reduces the
// withdrawals from `pensionAge`. While retired, the portfolio keeps earning the ETF return,
// net of the tax on gains.

export interface FireLevel {
  label: string;
  share: number | null; // extra % of expenses; null = current salary
  todayMonthly: number; // lifestyle spending in month 1 (excl. loan), today's euros
  spend: Float64Array; // lifestyle + loan for months 1..M (index 0 unused), before pension
}

const R_MIN = -5;
const R_MAX = 20;
const R_STEP = 0.1;

const totalMonths = (inp: Inputs) => Math.max(12, Math.round((inp.endAge - inp.currentAge) * 12));

export function retirementAges(inp: Inputs): number[] {
  const ages: number[] = [];
  const last = Math.min(inp.pensionAge, inp.endAge - 1, inp.currentAge + 40);
  for (let a = inp.currentAge + 1; a <= last; a++) ages.push(a);
  return ages;
}

/**
 * Lifestyle levels (living + vacation + property charges, excluding the loan): expenses,
 * then +x% steps, up to the current net salary. The levels are the same for every
 * scenario; each scenario's own loan payment is added on top while it runs.
 */
export function fireLevels(inp: Inputs, base: ScenarioResult): FireLevel[] {
  const M = totalMonths(inp);
  const salaryToday = netIncomeByYear(inp, 0).afterTax / 12;
  const lifestyle = new Float64Array(M + 1);
  const loan = new Float64Array(M + 1);
  const salary = new Float64Array(M + 1);
  for (let m = 1; m <= M; m++) {
    const row = base.months[m];
    lifestyle[m] = row.costs;
    loan[m] = row.payment + row.insurance + row.prepay + row.penalty;
    salary[m] = salaryToday * Math.pow(1 + inp.inflation / 100, Math.floor((m - 1) / 12));
  }

  const levels: FireLevel[] = [];
  const step = Math.max(1, inp.fireStep);
  for (let k = 0; k <= 200; k++) {
    const share = k * step;
    const mult = 1 + share / 100;
    if (lifestyle[1] * mult >= salaryToday) break;
    const spend = lifestyle.map((l, m) => l * mult + loan[m]);
    levels.push({ label: k === 0 ? 'Expenses' : `Expenses +${share}%`, share, todayMonthly: lifestyle[1] * mult, spend });
  }
  const spend = lifestyle.map((l, m) => Math.max(l, salary[m]) + loan[m]);
  levels.push({ label: 'Current salary', share: null, todayMonthly: Math.max(lifestyle[1], salaryToday), spend });
  return levels;
}

function monthlyNetRate(inp: Inputs, r: number) {
  const tax = (inp.envelope === 'pea' ? inp.socialRate : inp.pfuRate) / 100;
  const net = r > 0 ? r * (1 - tax) : r;
  return Math.pow(1 + net / 100, 1 / 12) - 1;
}

/** Capital needed at the end of each month to fund every later month (pension deducted). */
function requiredCapital(inp: Inputs, level: FireLevel, i: number): Float64Array {
  const M = level.spend.length - 1;
  const pensionMonth = Math.round((inp.pensionAge - inp.currentAge) * 12);
  const pv = new Float64Array(M + 1);
  for (let m = M - 1; m >= 0; m--) {
    const month = m + 1;
    const pension =
      month > pensionMonth ? inp.pensionMonthly * Math.pow(1 + inp.inflation / 100, Math.floor((month - 1) / 12)) : 0;
    const withdrawal = Math.max(0, level.spend[month] - pension);
    pv[m] = (withdrawal + pv[m + 1]) / (1 + i);
  }
  return pv;
}

const liquid = (res: ScenarioResult, m: number) => res.months[m].etf + res.months[m].savings;

export interface FireAnalysis {
  ages: number[];
  levels: FireLevel[];
  required: (number | null)[][]; // [level][age] gross ETF return in %, null = above R_MAX
  earliestAge: (number | null)[]; // per level, at inp.etfReturn
}

export function fireAnalysis(inp: Inputs, def: ScenarioDef): FireAnalysis {
  const M = totalMonths(inp);
  const ages = retirementAges(inp);
  const retireMonths = ages.map((a) => (a - inp.currentAge) * 12);
  const base = simulate(inp, def, { months: M });
  const levels = fireLevels(inp, base);

  const required: (number | null)[][] = levels.map(() => ages.map(() => null));
  let open = levels.length * ages.length;
  const accMonths = Math.max(...retireMonths, 1);
  for (let r = R_MIN; r <= R_MAX + 1e-9 && open > 0; r += R_STEP) {
    const res = simulate(inp, def, { etfReturn: r, months: accMonths });
    const i = monthlyNetRate(inp, r);
    levels.forEach((lvl, k) => {
      if (required[k].every((v) => v != null)) return;
      const pv = requiredCapital(inp, lvl, i);
      retireMonths.forEach((R, a) => {
        if (required[k][a] == null && liquid(res, R) >= pv[R]) {
          required[k][a] = Math.round(r * 10) / 10;
          open--;
        }
      });
    });
  }

  return { ages, levels, required, earliestAge: earliestAges(inp, def, levels, ages) };
}

/** Earliest retirement age per level at the assumed ETF return. */
export function earliestAges(inp: Inputs, def: ScenarioDef, levels?: FireLevel[], ages = retirementAges(inp)): (number | null)[] {
  const M = totalMonths(inp);
  const res = simulate(inp, def, { months: M });
  const lv = levels ?? fireLevels(inp, res);
  const i = monthlyNetRate(inp, inp.etfReturn);
  return lv.map((lvl) => {
    const pv = requiredCapital(inp, lvl, i);
    const age = ages.find((a) => liquid(res, (a - inp.currentAge) * 12) >= pv[(a - inp.currentAge) * 12]);
    return age ?? null;
  });
}

export interface FirePoint {
  age: number;
  capital: number;
  phase: 'working' | 'retired';
}

/** Liquid capital by year when retiring at `age` with spending level `level`, at return r. */
export function firePath(inp: Inputs, def: ScenarioDef, level: FireLevel, age: number, r = inp.etfReturn): FirePoint[] {
  const M = totalMonths(inp);
  const R = (age - inp.currentAge) * 12;
  const res = simulate(inp, def, { etfReturn: r, months: Math.max(R, 1) });
  const i = monthlyNetRate(inp, r);
  const pensionMonth = Math.round((inp.pensionAge - inp.currentAge) * 12);
  const points: FirePoint[] = [];
  let capital = liquid(res, R);
  for (let m = 0; m <= M; m++) {
    if (m <= R) {
      if (m % 12 === 0) points.push({ age: inp.currentAge + m / 12, capital: liquid(res, m), phase: 'working' });
      continue;
    }
    const pension = m > pensionMonth ? inp.pensionMonthly * Math.pow(1 + inp.inflation / 100, Math.floor((m - 1) / 12)) : 0;
    capital = capital * (1 + i) - Math.max(0, level.spend[m] - pension);
    if (m % 12 === 0) points.push({ age: inp.currentAge + m / 12, capital, phase: 'retired' });
  }
  return points;
}
