import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScenarioResult } from '../../engine/scenario';
import { eur } from '../../format';
import type { Theme } from '../../theme';
import { axisProps, ChartCard, legendProps, tooltipProps, yEuro } from './common';

export function AmortizationChart({ result, t }: { result: ScenarioResult; t: Theme }) {
  const data = result.years
    .filter((y) => y.payment + y.prepay > 0)
    .map((y) => ({ year: y.year, principal: y.principal + y.prepay, interest: y.interest, insurance: y.insurance + y.penalty }));
  const hasPrepay = result.years.some((y) => y.prepay > 0);
  const bar = { stackId: 'a', stroke: t.surface, strokeWidth: 2, maxBarSize: 24, isAnimationActive: false };

  return (
    <ChartCard title={`Yearly repayments: ${result.def.name}`} subtitle="Where each year's loan payments go">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="year" {...axisProps(t)} tickFormatter={(v) => `Y${v}`} />
          <YAxis {...axisProps(t)} {...yEuro} />
          <Tooltip {...tooltipProps(t)} formatter={(v: number) => eur(v)} labelFormatter={(v) => `Year ${v}`} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <Legend {...legendProps(t)} iconType="square" />
          <Bar dataKey="principal" name={hasPrepay ? 'Principal (incl. prepayments)' : 'Principal'} fill={t.series[0]} {...bar} />
          <Bar dataKey="interest" name="Interest" fill={t.series[1]} {...bar} />
          <Bar dataKey="insurance" name={hasPrepay ? 'Insurance + penalties' : 'Insurance'} fill={t.series[2]} radius={[4, 4, 0, 0]} {...bar} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
