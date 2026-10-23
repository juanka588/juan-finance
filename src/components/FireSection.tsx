import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { earliestAges, fireAnalysis, firePath } from '../engine/fire';
import type { ScenarioResult } from '../engine/scenario';
import type { Inputs } from '../engine/types';
import { eur, pct } from '../format';
import { slotOf, type Theme } from '../theme';
import { axisProps, ChartCard, tooltipProps, yEuro } from './charts/common';

// Sequential blue ramp (reference palette), light → dark = easier → harder.
const RAMP = ['#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];
const INK_FROM = 5; // steps from here on take white text

interface Props {
  inp: Inputs;
  results: ScenarioResult[];
  selectedId: string;
  t: Theme;
}

export function FireSection({ inp, results, selectedId, t }: Props) {
  const selected = results.find((r) => r.def.id === selectedId) ?? results[0];
  const fa = useMemo(() => fireAnalysis(inp, selected.def), [inp, selected.def]);
  const perScenario = useMemo(() => results.map((r) => earliestAges(inp, r.def, undefined, fa.ages)), [inp, results, fa.ages]);

  const [pick, setPick] = useState<{ level: number; age: number } | null>(null);
  const levelIdx = Math.min(pick?.level ?? 0, fa.levels.length - 1);
  const age = pick && fa.ages.includes(pick.age) ? pick.age : (fa.earliestAge[levelIdx] ?? fa.ages[fa.ages.length - 1]);
  const level = fa.levels[levelIdx];
  const path = useMemo(() => (level ? firePath(inp, selected.def, level, age) : []), [inp, selected.def, level, age]);

  const finite = fa.required.flat().filter((v): v is number => v != null);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const stepOf = (v: number) => (hi === lo ? 0 : Math.round(((v - lo) / (hi - lo)) * (RAMP.length - 1)));
  const lasts = path.length > 0 && path[path.length - 1].capital >= 0;
  const requiredHere = fa.required[levelIdx]?.[fa.ages.indexOf(age)];

  return (
    <>
      <section className="card">
        <header className="card-head">
          <div>
            <h3>Early retirement</h3>
            <p className="subtitle">
              Earliest age you can stop working at your {pct(inp.etfReturn, 1)} ETF assumption. Money comes from the ETF and savings (after tax, house
              not sold) and must last until age {inp.endAge}. Spending levels exclude the loan. Each scenario's own loan payment is added on top
              until it ends.
              {inp.pensionMonthly > 0
                ? ` From ${inp.pensionAge}, a ${eur(inp.pensionMonthly)}/mo pension covers part of the spending.`
                : ' No state pension is counted. Set one in the parameters for a realistic picture.'}
            </p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th>Spending level</th>
                <th>Per month today</th>
                {results.map((r) => (
                  <th key={r.def.id}>
                    <span className="col-select">
                      <span className="swatch" style={{ background: t.series[slotOf(r.def.id)] }} />
                      {r.def.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fa.levels.map((l, k) => (
                <tr key={l.label}>
                  <th scope="row">{l.label}</th>
                  <td>{eur(l.todayMonthly)}</td>
                  {perScenario.map((ages, s) => (
                    <td key={results[s].def.id} className={results[s].def.id === selected.def.id ? 'selected' : ''}>
                      {ages[k] != null ? `age ${ages[k]}` : `after ${inp.pensionAge}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h3>Required ETF return: {selected.def.name}</h3>
            <p className="subtitle">
              Gross yearly ETF return needed to retire at each age for each spending level. ✓ = achievable at your {pct(inp.etfReturn, 1)} assumption.
              Click a cell to see its capital over time below.
            </p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th>Retire at</th>
                {fa.ages.map((a) => (
                  <th key={a}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fa.levels.map((l, k) => (
                <tr key={l.label}>
                  <th scope="row">{l.label}</th>
                  {fa.ages.map((a, j) => {
                    const v = fa.required[k][j];
                    const step = v == null ? null : stepOf(v);
                    const ok = v != null && v <= inp.etfReturn;
                    const isPick = k === levelIdx && a === age;
                    return (
                      <td key={a} className={isPick ? 'picked' : ''}>
                        <button
                          style={step == null ? undefined : { background: RAMP[step], color: step >= INK_FROM ? '#fff' : '#0b0b0b' }}
                          className={step == null ? 'na' : ''}
                          onClick={() => setPick({ level: k, age: a })}
                          aria-label={`${l.label}, retire at ${a}: ${v == null ? 'over 20%' : pct(v, 1)}${ok ? ', achievable' : ''}`}
                          title={`${l.label}, retire at ${a}: ${v == null ? '> 20 %' : pct(v, 1)}`}
                        >
                          {v == null ? '>20' : v.toFixed(1)}
                          {ok && <span aria-hidden="true"> ✓</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ramp-legend" aria-hidden="true">
          <span>{pct(lo, 1)}</span>
          <span className="ramp" style={{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }} />
          <span>{pct(hi, 1)}</span>
        </div>
      </section>

      {level && (
        <ChartCard
          title={`Liquid capital: ${level.label}, retire at ${age}`}
          subtitle={`At your ${pct(inp.etfReturn, 1)} return the money ${lasts ? `lasts until ${inp.endAge}` : `runs out before ${inp.endAge}`}${
            requiredHere != null ? `. Needed: ${pct(requiredHere, 1)}.` : '.'
          } Spending: ${eur(level.todayMonthly)}/mo in today's euros plus the loan while it runs, rising with inflation.`}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={path} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} {...axisProps(t)} />
              <YAxis {...axisProps(t)} {...yEuro} />
              <Tooltip {...tooltipProps(t)} formatter={(v: number) => [eur(v), 'Capital']} labelFormatter={(v) => `Age ${v}`} />
              <ReferenceLine y={0} stroke={t.text2} />
              <ReferenceLine x={age} stroke={t.muted} label={{ value: 'stop working', fill: t.muted, fontSize: 12, position: 'insideTopRight' }} />
              {inp.pensionMonthly > 0 && (
                <ReferenceLine x={inp.pensionAge} stroke={t.muted} label={{ value: 'pension', fill: t.muted, fontSize: 12, position: 'insideTopLeft' }} />
              )}
              <Line dataKey="capital" stroke={t.series[slotOf(selected.def.id)]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}
