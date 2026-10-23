import { simulate } from './scenario';
import type { Inputs, ScenarioDef } from './types';

/** Net-worth gap at the horizon (scenario − reference) for a given ETF return. */
export function netWorthGap(inp: Inputs, def: ScenarioDef, ref: ScenarioDef, etfReturn: number): number {
  return simulate(inp, def, { etfReturn }).finalNetWorth - simulate(inp, ref, { etfReturn }).finalNetWorth;
}

/**
 * Gross ETF return at which `def` (less apport, more invested) ends with the same
 * net worth as `ref`. Returns null when the gap never changes sign on [lo, hi].
 */
export function breakEvenReturn(inp: Inputs, def: ScenarioDef, ref: ScenarioDef, lo = -5, hi = 20): number | null {
  let fLo = netWorthGap(inp, def, ref, lo);
  const fHi = netWorthGap(inp, def, ref, hi);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const fMid = netWorthGap(inp, def, ref, mid);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Annualised after-tax return of a lump sum held `years` at gross `r` (%) with `taxRate` on gains. */
export function afterTaxAnnual(r: number, years: number, taxRate: number): number {
  const growth = Math.pow(1 + r / 100, years);
  const net = 1 + (growth - 1) * (1 - taxRate);
  return (Math.pow(Math.max(net, 0), 1 / years) - 1) * 100;
}

export function gapCurve(inp: Inputs, defs: ScenarioDef[], ref: ScenarioDef, from = 0, to = 12, step = 0.5) {
  const points: Record<string, number>[] = [];
  for (let r = from; r <= to + 1e-9; r += step) {
    const refNw = simulate(inp, ref, { etfReturn: r }).finalNetWorth;
    const point: Record<string, number> = { r: Math.round(r * 100) / 100 };
    for (const d of defs) point[d.id] = simulate(inp, d, { etfReturn: r }).finalNetWorth - refNw;
    points.push(point);
  }
  return points;
}
