import { DEFAULTS } from '../defaults';
import { breakEvenReturn } from './breakeven';
import { acquisition, feesOnlyApport, notaryFees } from './fees';
import { amortize, monthlyPayment } from './loan';
import { monteCarlo } from './montecarlo';
import { horizonYears, simulate } from './scenario';
import { incomeTax } from './tax';
import type { Inputs } from './types';

describe('loan', () => {
  it('matches the annuity formula', () => {
    expect(monthlyPayment(300000, 3.2, 240)).toBeCloseTo(1693.99, 2);
  });

  it('repays exactly the principal', () => {
    const rows = amortize(300000, 3.2, 20, 0);
    expect(rows).toHaveLength(240);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBeCloseTo(300000, 2);
    expect(rows[239].balance).toBeCloseTo(0, 2);
  });

  it('shortens the loan with prepayments and charges capped penalties', () => {
    const rows = amortize(300000, 3.2, 20, 0, 500);
    expect(rows.length).toBeLessThan(240);
    rows.forEach((r) => expect(r.penalty).toBeLessThanOrEqual(r.prepay * 0.03 + 1e-9));
  });
});

describe('fees', () => {
  it('computes notary fees for an existing property around 7.5%', () => {
    const n = notaryFees(352000, 5.80665, 1500);
    expect(n.dmto).toBeCloseTo(20439.4, 0);
    expect(n.total).toBeGreaterThan(25000);
    expect(n.total).toBeLessThan(28000);
  });

  it('fees-only apport finances exactly price + renovation', () => {
    const acq = acquisition(DEFAULTS, feesOnlyApport(DEFAULTS));
    expect(acq.loan).toBeCloseTo(DEFAULTS.price + DEFAULTS.renovation, 2);
  });
});

describe('income tax', () => {
  it('joint taxation with 2 parts', () => {
    const net = 100000 * 0.775;
    const { tmi, tax } = incomeTax([net], true);
    expect(tmi).toBe(30);
    expect(tax).toBeGreaterThan(6500);
    expect(tax).toBeLessThan(8000);
  });
});

// Frictionless world: no tax, insurance, fees, appreciation — break-even must equal the loan rate.
const frictionless: Inputs = {
  ...DEFAULTS,
  dmtoRate: 0,
  notaryDisbursements: 0,
  brokerFee: 0,
  bankFee: 0,
  cautionCommission: 0,
  cautionFmg: 0,
  insRate1: 0,
  insRate2: 0,
  socialRate: 0,
  pfuRate: 0,
  envelope: 'cto',
  appreciation: 0,
  price: 300000,
};

describe('break-even', () => {
  it('equals the effective loan rate when there is no friction', () => {
    const [low, , , max] = frictionless.scenarios;
    const r = breakEvenReturn({ ...frictionless, scenarios: [] }, { ...low, mode: 'amount', value: 50000 }, max);
    const effective = (Math.pow(1 + 0.032 / 12, 12) - 1) * 100;
    expect(r).not.toBeNull();
    expect(Math.abs(r! - effective)).toBeLessThan(0.01);
  });

  it('is higher than the loan rate once taxes and fees apply', () => {
    const [low, , , max] = DEFAULTS.scenarios;
    const r = breakEvenReturn(DEFAULTS, low, max);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(DEFAULTS.loanRate);
  });
});

describe('scenario', () => {
  it('runs the defaults without a cash shortfall', () => {
    for (const d of DEFAULTS.scenarios) {
      const res = simulate(DEFAULTS, d);
      expect(res.shortfall).toBe(false);
      expect(res.months).toHaveLength(horizonYears(DEFAULTS) * 12 + 1);
      expect(Number.isFinite(res.finalNetWorth)).toBe(true);
    }
  });
});

describe('horizon', () => {
  it('follows the loan duration by default', () => {
    const inp = { ...DEFAULTS, loanYears: 25 };
    const res = simulate(inp, inp.scenarios[0]);
    expect(res.months).toHaveLength(25 * 12 + 1);
    expect(res.years).toHaveLength(25);
    expect(res.months.at(-1)!.balance).toBeCloseTo(0, 2);
  });

  it('uses the custom horizon when set', () => {
    const inp = { ...DEFAULTS, loanYears: 25, horizonFollowsLoan: false, horizonYears: 10 };
    expect(simulate(inp, inp.scenarios[0]).months).toHaveLength(10 * 12 + 1);
  });
});

describe('monte carlo', () => {
  it('matches the deterministic result with zero volatility', () => {
    const inp = { ...DEFAULTS, etfVol: 0 };
    const mc = monteCarlo(inp, inp.scenarios, 'd', 3);
    for (const d of inp.scenarios) {
      expect(mc.finalP50[d.id]).toBeCloseTo(simulate(inp, d).finalNetWorth, 2);
    }
  });
});
