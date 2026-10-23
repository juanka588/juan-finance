import { acquisition, feesOnlyApport, type Acquisition } from './fees';
import { amortize, taeg, type LoanMonth } from './loan';
import { allocate, apportPool, EtfAccount, holdingsAfterTax } from './portfolio';
import { incomeTax } from './tax';
import type { Inputs, ScenarioDef } from './types';

export interface MonthRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  insurance: number;
  prepay: number;
  penalty: number;
  balance: number;
  income: number; // net after income tax
  costs: number; // living + vacation + property charges
  invested: number; // free cash flow put in the ETF (negative = withdrawn)
  etf: number; // after tax
  savings: number; // other buckets, after tax
  property: number;
  netWorth: number;
}

export type YearRow = MonthRow & { year: number };

export interface ScenarioResult {
  def: ScenarioDef;
  acq: Acquisition;
  requestedApport: number;
  apportCapped: boolean;
  apportFrom: { name: string; amount: number }[];
  leftover: number;
  monthlyPayment: number; // incl. insurance
  insuranceMonthly: number;
  totalInterest: number;
  totalInsurance: number;
  totalPenalty: number;
  taeg: number;
  debtRatio: number; // %
  loanMonths: number;
  netBeforeTaxMonthly: number;
  tmi: number;
  minFreeCash: number;
  shortfall: boolean;
  months: MonthRow[];
  years: YearRow[];
  finalNetWorth: number;
}

/** Simulation length in years: the loan duration unless a custom horizon is set. */
export function horizonYears(inp: Inputs): number {
  return inp.horizonFollowsLoan ? inp.loanYears : inp.horizonYears;
}

export function requestedApport(inp: Inputs, def: ScenarioDef): number {
  switch (def.mode) {
    case 'fees':
      return feesOnlyApport(inp);
    case 'percent':
      return (inp.price * def.value) / 100;
    case 'amount':
      return def.value;
    case 'max':
      return apportPool(inp);
  }
}

interface SimOptions {
  etfReturn?: number; // overrides inp.etfReturn
  path?: Float64Array; // monthly ETF growth factors (Monte Carlo)
  months?: number; // overrides the horizon (early-retirement projections)
}

export function netIncomeByYear(inp: Inputs, year: number) {
  const growth = Math.pow(1 + inp.salaryGrowth / 100, year);
  const nets = [inp.gross1, inp.gross2].filter((g) => g > 0).map((g) => g * growth * (inp.netFactor / 100));
  const { tax, tmi } = incomeTax(nets, inp.taxJointly);
  const net = nets.reduce((a, b) => a + b, 0);
  return { netBeforeTax: net, afterTax: net - tax, tmi };
}

export function simulate(inp: Inputs, def: ScenarioDef, opts: SimOptions = {}): ScenarioResult {
  const months = opts.months ?? Math.round(horizonYears(inp) * 12);
  const pool = apportPool(inp);
  const wanted = requestedApport(inp, def);
  const acq = acquisition(inp, Math.min(wanted, pool));
  const alloc = allocate(inp, acq.apport);

  const insuranceMonthly =
    (acq.loan * ((inp.insRate1 * inp.quotite1) / 100 + (inp.insRate2 * inp.quotite2) / 100)) / 100 / 12;
  const loanRows: LoanMonth[] = acq.loan > 0 ? amortize(acq.loan, inp.loanRate, inp.loanYears, insuranceMonthly, inp.prepayMonthly) : [];

  const etf = new EtfAccount(inp);
  if (inp.reinvestLeftover && alloc.leftover > 0) etf.deposit(alloc.leftover);
  const holdings = alloc.holdings;
  const bucketFactors = holdings.map((h) => Math.pow(1 + h.rate / 100, 1 / 12));
  const etfFactor = Math.pow(1 + (opts.etfReturn ?? inp.etfReturn) / 100, 1 / 12);
  const propFactor = Math.pow(1 + inp.appreciation / 100, 1 / 12);

  const incomeCache: ReturnType<typeof netIncomeByYear>[] = [];
  const income = (y: number) => (incomeCache[y] ??= netIncomeByYear(inp, y));

  let property = inp.price;
  let deficit = 0; // unfunded cash need (shouldn't happen in a sane plan)
  let minFree = Infinity;
  let everShort = false;

  const snapshot = (m: number, row: LoanMonth | undefined, inc: number, costs: number, invested: number): MonthRow => {
    const balance = row ? row.balance : m === 0 ? acq.loan : 0;
    const etfNet = etf.afterTax(m);
    const savings = holdingsAfterTax(holdings, inp);
    return {
      month: m,
      payment: row ? row.payment : 0,
      interest: row?.interest ?? 0,
      principal: row?.principal ?? 0,
      insurance: row?.insurance ?? 0,
      prepay: row?.prepay ?? 0,
      penalty: row?.penalty ?? 0,
      balance,
      income: inc,
      costs,
      invested,
      etf: etfNet,
      savings,
      property,
      netWorth: property - balance + etfNet + savings - deficit,
    };
  };

  const rows: MonthRow[] = [snapshot(0, undefined, 0, 0, 0)];
  for (let m = 1; m <= months; m++) {
    const y = Math.floor((m - 1) / 12);
    etf.grow(opts.path ? opts.path[m - 1] : etfFactor);
    holdings.forEach((h, k) => (h.balance *= bucketFactors[k]));
    property *= propFactor;

    const row = loanRows[m - 1];
    const inc = income(y).afterTax / 12;
    const costs =
      (inp.livingCosts + inp.vacation + inp.propertyChargesYearly / 12) * Math.pow(1 + inp.inflation / 100, y);
    const loanOut = row ? row.payment + row.insurance + row.prepay + row.penalty : 0;
    let free = inc - costs - loanOut;
    if (row && m === loanRows.length) free += acq.guaranteeRefund;
    minFree = Math.min(minFree, free);

    if (free >= 0) {
      const repay = Math.min(deficit, free);
      deficit -= repay;
      etf.deposit(free - repay);
    } else {
      deficit += etf.withdraw(-free);
      if (deficit > 0.5) everShort = true;
    }
    rows.push(snapshot(m, row, inc, costs, free));
  }

  const years: YearRow[] = [];
  for (let y = 0; y * 12 < rows.length - 1; y++) {
    const slice = rows.slice(y * 12 + 1, y * 12 + 13);
    const sum = (k: keyof MonthRow) => slice.reduce((s, r) => s + r[k], 0);
    const last = slice[slice.length - 1];
    years.push({
      ...last,
      year: y + 1,
      payment: sum('payment'),
      interest: sum('interest'),
      principal: sum('principal'),
      insurance: sum('insurance'),
      prepay: sum('prepay'),
      penalty: sum('penalty'),
      income: sum('income'),
      costs: sum('costs'),
      invested: sum('invested'),
    });
  }

  const first = loanRows[0];
  const inc0 = income(0);
  const monthlyPaymentTotal = first ? first.payment + first.insurance : 0;
  const upfront = acq.bank + acq.broker + acq.guarantee;

  return {
    def,
    acq,
    requestedApport: wanted,
    apportCapped: wanted > pool + 0.5,
    apportFrom: alloc.apportFrom,
    leftover: alloc.leftover,
    monthlyPayment: monthlyPaymentTotal,
    insuranceMonthly,
    totalInterest: loanRows.reduce((s, r) => s + r.interest, 0),
    totalInsurance: loanRows.reduce((s, r) => s + r.insurance, 0),
    totalPenalty: loanRows.reduce((s, r) => s + r.penalty, 0),
    taeg: taeg(acq.loan, upfront, loanRows, acq.guaranteeRefund),
    debtRatio: inc0.netBeforeTax > 0 ? (monthlyPaymentTotal / (inc0.netBeforeTax / 12)) * 100 : 0,
    loanMonths: loanRows.length,
    netBeforeTaxMonthly: inc0.netBeforeTax / 12,
    tmi: inc0.tmi,
    minFreeCash: minFree,
    shortfall: everShort,
    months: rows,
    years,
    finalNetWorth: rows[rows.length - 1].netWorth,
  };
}

/** Index of the scenario with the largest effective apport — the "pay down the debt" reference. */
export function referenceIndex(results: ScenarioResult[]): number {
  let best = 0;
  results.forEach((r, k) => {
    if (r.acq.apport > results[best].acq.apport) best = k;
  });
  return best;
}
