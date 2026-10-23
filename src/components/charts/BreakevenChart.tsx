import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScenarioDef } from '../../engine/types';
import { pct, signedEur } from '../../format';
import { slotOf, type Theme } from '../../theme';
import { axisProps, ChartCard, legendProps, tooltipProps, yEuro } from './common';

interface Props {
  curve: Record<string, number>[];
  defs: ScenarioDef[];
  refName: string;
  breakEvens: Record<string, number | null>;
  etfReturn: number;
  t: Theme;
}

export function BreakevenChart({ curve, defs, refName, breakEvens, etfReturn, t }: Props) {
  return (
    <ChartCard
      title="Invest or pay down?"
      subtitle={`Net-worth gap at the horizon vs “${refName}”, by ETF return. Above zero, keeping the money invested wins.`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={curve} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="r" type="number" domain={['dataMin', 'dataMax']} {...axisProps(t)} tickFormatter={(v) => `${v}%`} />
          <YAxis {...axisProps(t)} {...yEuro} />
          <Tooltip {...tooltipProps(t)} formatter={(v: number) => signedEur(v)} labelFormatter={(v) => `ETF return ${pct(Number(v), 1)}/yr`} />
          <Legend {...legendProps(t)} />
          <ReferenceLine y={0} stroke={t.text2} />
          <ReferenceLine x={etfReturn} stroke={t.muted} label={{ value: 'your assumption', fill: t.muted, fontSize: 12, position: 'insideTopRight' }} />
          {defs.map((d) => (
            <Line key={d.id} dataKey={d.id} name={d.name} stroke={t.series[slotOf(d.id)]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
          {defs.map((d) =>
            breakEvens[d.id] != null ? (
              <ReferenceDot key={`be-${d.id}`} x={breakEvens[d.id]!} y={0} r={5} fill={t.series[slotOf(d.id)]} stroke={t.surface} strokeWidth={2} />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
