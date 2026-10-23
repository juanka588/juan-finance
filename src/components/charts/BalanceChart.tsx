import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScenarioResult } from '../../engine/scenario';
import { eur } from '../../format';
import { slotOf, type Theme } from '../../theme';
import { axisProps, ChartCard, legendProps, tooltipProps, yEuro } from './common';
import { periodLabel, timeline, type Granularity } from './timeline';

export function BalanceChart({ results, t, granularity }: { results: ScenarioResult[]; t: Theme; granularity: Granularity }) {
  const data = timeline(results, granularity, (r) => r.balance);
  return (
    <ChartCard title="Remaining principal" subtitle="What you still owe the bank">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="t" {...axisProps(t)} tickFormatter={(v) => periodLabel(v, granularity)} minTickGap={24} />
          <YAxis {...axisProps(t)} {...yEuro} />
          <Tooltip {...tooltipProps(t)} formatter={(v: number) => eur(v)} labelFormatter={(v) => periodLabel(v, granularity, true)} />
          <Legend {...legendProps(t)} />
          {results.map((r) => (
            <Line key={r.def.id} dataKey={r.def.id} name={r.def.name} stroke={t.series[slotOf(r.def.id)]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
