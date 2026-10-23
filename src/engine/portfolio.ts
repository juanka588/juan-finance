import type { Bucket, Inputs } from './types';
import { afterTaxRate, gainTaxRate } from './tax';

interface Lot {
  value: number;
  basis: number;
}

/** ETF holdings split between a PEA (deposit-capped) and a CTO for the overflow. */
export class EtfAccount {
  pea: Lot = { value: 0, basis: 0 };
  cto: Lot = { value: 0, basis: 0 };

  constructor(private inp: Inputs) {}

  deposit(amount: number) {
    let rest = amount;
    if (this.inp.envelope === 'pea') {
      const toPea = Math.min(rest, Math.max(0, this.inp.peaCap - this.pea.basis));
      this.pea.value += toPea;
      this.pea.basis += toPea;
      rest -= toPea;
    }
    this.cto.value += rest;
    this.cto.basis += rest;
  }

  /** Sells from the CTO first, then the PEA. Returns the part that could not be covered. */
  withdraw(amount: number): number {
    let rest = amount;
    for (const lot of [this.cto, this.pea]) {
      if (rest <= 0 || lot.value <= 0) continue;
      const take = Math.min(rest, lot.value);
      lot.basis *= 1 - take / lot.value;
      lot.value -= take;
      rest -= take;
    }
    return rest;
  }

  grow(factor: number) {
    this.pea.value *= factor;
    this.cto.value *= factor;
  }

  get value() {
    return this.pea.value + this.cto.value;
  }

  afterTax(month: number): number {
    const net = (lot: Lot, regime: 'pea' | 'cto') =>
      lot.value - Math.max(0, lot.value - lot.basis) * gainTaxRate(regime, this.inp, month);
    return net(this.pea, 'pea') + net(this.cto, 'cto');
  }
}

export interface Holding extends Bucket {
  basis: number;
}

const LIQUIDITY_RANK: Record<Bucket['regime'], number> = { livret: 0, pfu: 1, untaxed: 2, pee: 3 };

export interface Allocation {
  holdings: Holding[];
  apportFrom: { name: string; amount: number }[];
  leftover: number; // eligible money above the emergency fund not used as apport
  pool: number;
}

/** Usable pool for the apport: eligible balances minus the emergency fund. */
export function apportPool(inp: Inputs): number {
  const eligible = inp.buckets.filter((b) => b.eligible).reduce((s, b) => s + b.balance, 0);
  return Math.max(0, eligible - inp.emergencyFund);
}

/**
 * Keeps the emergency fund in the most liquid eligible buckets, then draws the apport
 * from the remaining money, lowest after-tax yield first.
 */
export function allocate(inp: Inputs, apport: number): Allocation {
  const holdings: Holding[] = inp.buckets.map((b) => ({ ...b, basis: b.balance }));
  const free = new Map<string, number>(holdings.map((h) => [h.id, h.eligible ? h.balance : 0]));

  let reserve = inp.emergencyFund;
  for (const h of [...holdings].filter((h) => h.eligible).sort((a, b) => LIQUIDITY_RANK[a.regime] - LIQUIDITY_RANK[b.regime])) {
    const keep = Math.min(reserve, free.get(h.id)!);
    free.set(h.id, free.get(h.id)! - keep);
    reserve -= keep;
  }

  const order = [...holdings]
    .filter((h) => h.eligible)
    .sort((a, b) => afterTaxRate(a.rate, a.regime, inp) - afterTaxRate(b.rate, b.regime, inp));

  const apportFrom: Allocation['apportFrom'] = [];
  let need = apport;
  for (const h of order) {
    const take = Math.min(need, free.get(h.id)!);
    if (take <= 0) continue;
    free.set(h.id, free.get(h.id)! - take);
    h.balance -= take;
    h.basis -= take;
    need -= take;
    apportFrom.push({ name: h.name, amount: take });
  }

  let leftover = 0;
  for (const h of order) leftover += free.get(h.id)!;
  if (inp.reinvestLeftover) {
    for (const h of order) {
      const take = free.get(h.id)!;
      h.balance -= take;
      h.basis -= take;
    }
  }
  return { holdings, apportFrom, leftover, pool: apportPool(inp) };
}

export function holdingsAfterTax(holdings: Holding[], inp: Inputs): number {
  return holdings.reduce(
    (s, h) => s + h.balance - Math.max(0, h.balance - h.basis) * gainTaxRate(h.regime, inp, 0),
    0,
  );
}
