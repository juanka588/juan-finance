import type { Inputs } from './types';

// Barème des émoluments proportionnels du notaire (vente), applied by bracket, + 20% VAT.
const EMOLUMENT_BRACKETS: [number, number][] = [
  [6500, 3.87],
  [17000, 1.596],
  [60000, 1.064],
  [Infinity, 0.799],
];

export interface NotaryFees {
  dmto: number;
  emoluments: number;
  csi: number;
  disbursements: number;
  total: number;
}

export function notaryFees(price: number, dmtoRate: number, disbursements: number): NotaryFees {
  let emolumentsHT = 0;
  let lower = 0;
  for (const [upper, rate] of EMOLUMENT_BRACKETS) {
    if (price <= lower) break;
    emolumentsHT += ((Math.min(price, upper) - lower) * rate) / 100;
    lower = upper;
  }
  const emoluments = emolumentsHT * 1.2;
  const dmto = (price * dmtoRate) / 100;
  const csi = Math.max(15, price * 0.001);
  return { dmto, emoluments, csi, disbursements, total: dmto + emoluments + csi + disbursements };
}

/** Upfront guarantee cost and end-of-loan refund, as fractions of the loan amount. */
export function guaranteeRates(inp: Inputs): { upfront: number; refund: number } {
  if (inp.guaranteeType === 'hypotheque') return { upfront: inp.hypothequeRate / 100, refund: 0 };
  return {
    upfront: (inp.cautionCommission + inp.cautionFmg) / 100,
    refund: ((inp.cautionFmg / 100) * inp.cautionFmgRefund) / 100,
  };
}

export interface Acquisition {
  notary: NotaryFees;
  agency: number;
  renovation: number;
  broker: number;
  bank: number;
  guarantee: number;
  guaranteeRefund: number;
  feesTotal: number; // everything that is not price or renovation
  totalCost: number;
  apport: number;
  loan: number;
}

/** Apport that covers exactly the fees, so that the loan finances price + renovation. */
export function feesOnlyApport(inp: Inputs): number {
  const notary = notaryFees(inp.price, inp.dmtoRate, inp.notaryDisbursements).total;
  const g = guaranteeRates(inp).upfront;
  return notary + inp.agencyFees + inp.brokerFee + inp.bankFee + g * (inp.price + inp.renovation);
}

export function acquisition(inp: Inputs, requestedApport: number): Acquisition {
  const notary = notaryFees(inp.price, inp.dmtoRate, inp.notaryDisbursements);
  const g = guaranteeRates(inp);
  const base = inp.price + inp.agencyFees + notary.total + inp.renovation;

  if (requestedApport >= base) {
    return {
      notary, agency: inp.agencyFees, renovation: inp.renovation,
      broker: 0, bank: 0, guarantee: 0, guaranteeRefund: 0,
      feesTotal: notary.total + inp.agencyFees,
      totalCost: base, apport: base, loan: 0,
    };
  }

  // The guarantee is a % of the loan and is itself financed: loan = (costs - apport) / (1 - g).
  const loan = (base + inp.brokerFee + inp.bankFee - requestedApport) / (1 - g.upfront);
  const guarantee = loan * g.upfront;
  const feesTotal = notary.total + inp.agencyFees + inp.brokerFee + inp.bankFee + guarantee;
  return {
    notary, agency: inp.agencyFees, renovation: inp.renovation,
    broker: inp.brokerFee, bank: inp.bankFee, guarantee, guaranteeRefund: loan * g.refund,
    feesTotal, totalCost: inp.price + inp.renovation + feesTotal,
    apport: requestedApport, loan,
  };
}
