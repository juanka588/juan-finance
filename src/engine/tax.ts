import type { Inputs, Regime } from './types';

// Barème de l'impôt sur le revenu (per part). Indexed yearly — adjust if needed.
const IR_BRACKETS: [number, number][] = [
  [11497, 0],
  [29315, 11],
  [83823, 30],
  [180294, 41],
  [Infinity, 45],
];
const MAX_PRO_DEDUCTION = 14426;

function taxPerPart(income: number): { tax: number; tmi: number } {
  let tax = 0;
  let lower = 0;
  let tmi = 0;
  for (const [upper, rate] of IR_BRACKETS) {
    if (income <= lower) break;
    tax += ((Math.min(income, upper) - lower) * rate) / 100;
    tmi = rate;
    lower = upper;
  }
  return { tax, tmi };
}

/** Income tax on net-before-tax salaries, after the 10% professional deduction. */
export function incomeTax(nets: number[], jointly: boolean): { tax: number; tmi: number } {
  const taxable = nets.map((n) => n - Math.min(n * 0.1, MAX_PRO_DEDUCTION));
  if (jointly) {
    const parts = 2;
    const { tax, tmi } = taxPerPart(taxable.reduce((a, b) => a + b, 0) / parts);
    return { tax: tax * parts, tmi };
  }
  return taxable.reduce(
    (acc, t) => {
      const r = taxPerPart(t);
      return { tax: acc.tax + r.tax, tmi: Math.max(acc.tmi, r.tmi) };
    },
    { tax: 0, tmi: 0 },
  );
}

/** Tax rate (fraction) applied to gains for a given regime. */
export function gainTaxRate(regime: Regime | 'pea' | 'cto', inp: Inputs, holdingMonths: number): number {
  switch (regime) {
    case 'pfu':
    case 'cto':
      return inp.pfuRate / 100;
    case 'pee':
      return inp.socialRate / 100;
    case 'pea':
      return holdingMonths >= 60 ? inp.socialRate / 100 : inp.pfuRate / 100;
    default:
      return 0;
  }
}

export function afterTaxRate(rate: number, regime: Regime, inp: Inputs): number {
  return rate * (1 - gainTaxRate(regime, inp, 0));
}
