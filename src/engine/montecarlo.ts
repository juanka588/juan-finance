import { horizonYears, simulate } from './scenario';
import type { Inputs, ScenarioDef } from './types';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monthly lognormal growth factors whose expected value matches the annual return. */
export function randomPath(months: number, annualReturn: number, annualVol: number, rand: () => number): Float64Array {
  const sigma = annualVol / 100 / Math.sqrt(12);
  const mu = Math.log(1 + annualReturn / 100) / 12 - (sigma * sigma) / 2;
  const path = new Float64Array(months);
  for (let m = 0; m < months; m++) {
    const u1 = Math.max(rand(), 1e-12);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
    path[m] = Math.exp(mu + sigma * z);
  }
  return path;
}

export interface McBand {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface McResult {
  bands: Record<string, McBand[]>; // per scenario id
  probBeatsRef: Record<string, number>; // share of runs where scenario ends above the reference
  finalP50: Record<string, number>;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/** Every scenario sees the same random market path in a given run (common random numbers). */
export function monteCarlo(inp: Inputs, defs: ScenarioDef[], refId: string, runs: number, seed = 42): McResult {
  const months = Math.round(horizonYears(inp) * 12);
  const years = Math.floor(months / 12);
  const rand = mulberry32(seed);
  const yearly: Record<string, number[][]> = {};
  const wins: Record<string, number> = {};
  defs.forEach((d) => {
    yearly[d.id] = Array.from({ length: years + 1 }, () => []);
    wins[d.id] = 0;
  });

  for (let k = 0; k < runs; k++) {
    const path = randomPath(months, inp.etfReturn, inp.etfVol, rand);
    const finals: Record<string, number> = {};
    for (const d of defs) {
      const res = simulate(inp, d, { path });
      for (let y = 0; y <= years; y++) yearly[d.id][y].push(res.months[y * 12].netWorth);
      finals[d.id] = res.finalNetWorth;
    }
    for (const d of defs) if (finals[d.id] > finals[refId]) wins[d.id]++;
  }

  const bands: McResult['bands'] = {};
  const probBeatsRef: McResult['probBeatsRef'] = {};
  const finalP50: McResult['finalP50'] = {};
  for (const d of defs) {
    bands[d.id] = yearly[d.id].map((vals, y) => {
      const s = [...vals].sort((a, b) => a - b);
      return { year: y, p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9) };
    });
    probBeatsRef[d.id] = wins[d.id] / runs;
    finalP50[d.id] = bands[d.id][years].p50;
  }
  return { bands, probBeatsRef, finalP50 };
}
