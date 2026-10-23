import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { McResult } from '../../engine/montecarlo';
import type { ScenarioResult } from '../../engine/scenario';
import { eur } from '../../format';
import { slotOf, type Theme } from '../../theme';
import { axisProps, ChartCard, legendProps, tooltipProps, yEuro } from './common';
import { periodLabel, timeline, type Granularity } from './timeline';

interface Props {
  results: ScenarioResult[];
  t: Theme;
  granularity: Granularity;
  mc: McResult | null;
  selectedId: string;
  refId: string;
}

export function NetWorthChart({ results, t, granularity, mc, selectedId, refId }: Props) {
  const [mode, setMode] = useState<'absolute' | 'gap'>('absolute');
  // Monte Carlo bands are yearly, so the chart switches to yearly when they are shown.
  const g: Granularity = mc ? 'year' : granularity;
  const data = timeline(results, g, (r) => r.netWorth);
  const ref = results.find((r) => r.def.id === refId) ?? results[0];
  const selected = results.find((r) => r.def.id === selectedId) ?? results[0];
  if (mode === 'gap') {
    for (const row of data) {
      const base = row[ref.def.id];
      for (const r of results) row[r.def.id] -= base;
    }
  } else if (mc) {
    mc.bands[selected.def.id]?.forEach((b, k) => {
      if (data[k]) (data[k] as Record<string, unknown>).band = [b.p10, b.p90];
    });
  }
  const showBand = mc && mode === 'absolute';
  const bandColor = t.series[slotOf(selected.def.id)];

  return (
    <ChartCard
      title="Net worth after tax"
      subtitle={
        mode === 'gap'
          ? `Difference vs “${ref.def.name}”. Above zero, that scenario is ahead.`
          : showBand
            ? `House value − debt + savings + ETF, net of latent tax. Shaded: 10th–90th percentile for “${selected.def.name}”.`
            : 'House value − debt + savings + ETF, net of latent tax'
      }
      actions={
        <div className="segmented small" role="group" aria-label="Net worth view">
          <button aria-pressed={mode === 'absolute'} onClick={() => setMode('absolute')}>Absolute</button>
          <button aria-pressed={mode === 'gap'} onClick={() => setMode('gap')}>Gap</button>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="t" {...axisProps(t)} tickFormatter={(v) => periodLabel(v, g)} minTickGap={24} />
          <YAxis {...axisProps(t)} {...yEuro} domain={['auto', 'auto']} />
          <Tooltip
            {...tooltipProps(t)}
            formatter={(v: number | number[], name: string) =>
              Array.isArray(v) ? [`${eur(v[0])} – ${eur(v[1])}`, name] : [eur(v), name]
            }
            labelFormatter={(v) => periodLabel(v, g, true)}
          />
          <Legend {...legendProps(t)} />
          {mode === 'gap' && <ReferenceLine y={0} stroke={t.text2} />}
          {showBand && (
            <Area
              dataKey="band"
              name={`${selected.def.name} P10–P90`}
              stroke="none"
              fill={bandColor}
              fillOpacity={0.12}
              isAnimationActive={false}
              legendType="square"
            />
          )}
          {results.map((r) => (
            <Line key={r.def.id} dataKey={r.def.id} name={r.def.name} stroke={t.series[slotOf(r.def.id)]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
