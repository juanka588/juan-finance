import type { ReactNode } from 'react';
import { eurCompact } from '../../format';
import type { Theme } from '../../theme';

export function ChartCard({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card chart-card">
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="chart-body">{children}</div>
    </section>
  );
}

export function axisProps(t: Theme) {
  return {
    stroke: t.axis,
    tick: { fill: t.muted, fontSize: 12 },
    tickLine: false,
  };
}

export const yEuro = { tickFormatter: (v: number) => eurCompact(v), width: 64 };

export function tooltipProps(t: Theme) {
  return {
    contentStyle: {
      background: t.surface,
      border: `1px solid ${t.grid}`,
      borderRadius: 8,
      color: t.text,
      fontSize: 13,
    },
    labelStyle: { color: t.text2, marginBottom: 4 },
    itemStyle: { color: t.text, padding: 0 },
  };
}

export function legendProps(t: Theme) {
  return { wrapperStyle: { color: t.text2, fontSize: 13 }, iconType: 'plainline' as const };
}
