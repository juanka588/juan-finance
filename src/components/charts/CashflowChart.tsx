import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScenarioResult } from '../../engine/scenario';
import { eur } from '../../format';
import type { Theme } from '../../theme';
import { axisProps, ChartCard, legendProps, tooltipProps, yEuro } from './common';

export function CashflowChart({ result, t }: { result: ScenarioResult; t: Theme }) {
  const data = result.years.map((y) => ({
    year: y.year,
    loan: (y.payment + y.insurance + y.prepay + y.penalty) / 12,
    costs: y.costs / 12,
    invested: Math.max(0, y.invested) / 12,
  }));
  const bar = { stackId: 'a', stroke: t.surface, strokeWidth: 2, maxBarSize: 24, isAnimationActive: false };

  return (
    <ChartCard title={`Monthly budget: ${result.def.name}`} subtitle="Average per month for each year. The full stack equals net income after tax.">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="year" {...axisProps(t)} tickFormatter={(v) => `Y${v}`} />
          <YAxis {...axisProps(t)} {...yEuro} />
          <Tooltip {...tooltipProps(t)} formatter={(v: number) => `${eur(v)}/mo`} labelFormatter={(v) => `Year ${v}`} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <Legend {...legendProps(t)} iconType="square" />
          <Bar dataKey="costs" name="Living, vacation & charges" fill={t.series[3]} {...bar} />
          <Bar dataKey="loan" name="Loan + insurance" fill={t.series[1]} {...bar} />
          <Bar dataKey="invested" name="Invested in ETF" fill={t.series[0]} radius={[4, 4, 0, 0]} {...bar} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
