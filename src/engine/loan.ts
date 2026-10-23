export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

export interface LoanMonth {
  month: number; // 1-based
  payment: number; // principal + interest (excl. insurance)
  interest: number;
  principal: number;
  insurance: number;
  prepay: number;
  penalty: number; // IRA
  balance: number; // remaining principal after this month
}

/**
 * Constant-payment amortization. Extra monthly prepayments shorten the duration;
 * early-repayment penalties (IRA) are the legal cap: min(6 months of interest on the
 * prepaid amount, 3% of the remaining principal).
 */
export function amortize(
  principal: number,
  annualRatePct: number,
  years: number,
  insuranceMonthly: number,
  prepayMonthly = 0,
): LoanMonth[] {
  const months = Math.round(years * 12);
  const i = annualRatePct / 100 / 12;
  const payment = monthlyPayment(principal, annualRatePct, months);
  const rows: LoanMonth[] = [];
  let balance = principal;
  for (let m = 1; m <= months && balance > 0.005; m++) {
    const interest = balance * i;
    const principalPart = Math.min(payment - interest, balance);
    balance -= principalPart;
    let prepay = 0;
    let penalty = 0;
    if (prepayMonthly > 0 && balance > 0) {
      prepay = Math.min(prepayMonthly, balance);
      penalty = Math.min(prepay * i * 6, 0.03 * balance);
      balance -= prepay;
    }
    rows.push({
      month: m,
      payment: principalPart + interest,
      interest,
      principal: principalPart,
      insurance: insuranceMonthly,
      prepay,
      penalty,
      balance: Math.max(0, balance),
    });
  }
  return rows;
}

/** Actuarial TAEG estimate: IRR of (loan - upfront costs) vs monthly payments + insurance. */
export function taeg(loan: number, upfrontCosts: number, rows: LoanMonth[], endRefund = 0): number {
  if (loan <= 0 || rows.length === 0) return 0;
  const received = loan - upfrontCosts;
  const npv = (r: number) => {
    let v = 0;
    rows.forEach((row, k) => {
      let flow = row.payment + row.insurance + row.prepay + row.penalty;
      if (k === rows.length - 1) flow -= endRefund;
      v += flow / Math.pow(1 + r, k + 1);
    });
    return v - received;
  };
  let lo = 0;
  let hi = 0.05;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100;
}
