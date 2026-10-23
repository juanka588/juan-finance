const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const eur = (n: number) => eurFmt.format(Math.round(n));

export function eurCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)} M€`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} k€`;
  return `${Math.round(n)} €`;
}

export const pct = (n: number, digits = 2) => `${n.toFixed(digits)} %`;

export function signedEur(n: number): string {
  return `${n >= 0 ? '+' : '−'}${eur(Math.abs(n))}`;
}
