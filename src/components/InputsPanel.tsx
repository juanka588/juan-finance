import { DEFAULTS } from '../defaults';
import { netIncomeByYear } from '../engine/scenario';
import type { ApportMode, Bucket, Inputs, Regime, ScenarioDef } from '../engine/types';
import { eur } from '../format';
import { CheckField, NumberField, SelectField } from './Field';

interface Props {
  inp: Inputs;
  set: (patch: Partial<Inputs>) => void;
}

const REGIMES: { value: Regime; label: string }[] = [
  { value: 'pfu', label: 'Taxed (flat tax)' },
  { value: 'livret', label: 'Livret A / LDDS (tax-free)' },
  { value: 'pee', label: 'PEE (social charges only)' },
  { value: 'untaxed', label: 'Ignore tax' },
];

const MODES: { value: ApportMode; label: string }[] = [
  { value: 'fees', label: 'Fees only' },
  { value: 'percent', label: '% of price' },
  { value: 'amount', label: 'Fixed amount' },
  { value: 'max', label: 'Max available' },
];

export function InputsPanel({ inp, set }: Props) {
  const num = (key: keyof Inputs) => (v: number) => set({ [key]: v } as Partial<Inputs>);
  const inc = netIncomeByYear(inp, 0);

  const setBucket = (id: string, patch: Partial<Bucket>) =>
    set({ buckets: inp.buckets.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const setScenario = (id: string, patch: Partial<ScenarioDef>) =>
    set({ scenarios: inp.scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const freeSlot = 'abcdefgh'.split('').find((c) => !inp.scenarios.some((s) => s.id === c));

  return (
    <aside className="panel">
      <div className="panel-head">
        <h2>Parameters</h2>
        <button className="ghost" onClick={() => set(DEFAULTS)}>
          Reset to defaults
        </button>
      </div>

      <details open>
        <summary>Scenarios (apport)</summary>
        {inp.scenarios.map((s) => (
          <div className="row-card" key={s.id}>
            <input className="name" value={s.name} onChange={(e) => setScenario(s.id, { name: e.target.value })} aria-label="Scenario name" />
            <div className="grid2">
              <SelectField label="Apport" value={s.mode} options={MODES} onChange={(mode) => setScenario(s.id, { mode })} />
              {(s.mode === 'percent' || s.mode === 'amount') && (
                <NumberField
                  label={s.mode === 'percent' ? 'Share of price' : 'Amount'}
                  value={s.value}
                  suffix={s.mode === 'percent' ? '%' : '€'}
                  step={s.mode === 'percent' ? 1 : 1000}
                  onChange={(value) => setScenario(s.id, { value })}
                />
              )}
            </div>
            {inp.scenarios.length > 2 && (
              <button className="ghost small" onClick={() => set({ scenarios: inp.scenarios.filter((x) => x.id !== s.id) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        {freeSlot && inp.scenarios.length < 6 && (
          <button
            className="ghost"
            onClick={() => set({ scenarios: [...inp.scenarios, { id: freeSlot, name: 'Custom', mode: 'amount', value: 100000 }] })}
          >
            + Add scenario
          </button>
        )}
      </details>

      <details open>
        <summary>Property</summary>
        <div className="grid2">
          <NumberField label="Price" value={inp.price} onChange={num('price')} suffix="€" step={1000} />
          <NumberField label="Agency fees (if paid by buyer)" value={inp.agencyFees} onChange={num('agencyFees')} suffix="€" step={500} />
          <NumberField label="Renovation (travaux)" value={inp.renovation} onChange={num('renovation')} suffix="€" step={1000} />
          <NumberField
            label="Yearly charges"
            value={inp.propertyChargesYearly}
            onChange={num('propertyChargesYearly')}
            suffix="€/yr"
            step={100}
            hint="Copro, taxe foncière, upkeep. Rises with inflation."
          />
          <NumberField label="Property appreciation" value={inp.appreciation} onChange={num('appreciation')} suffix="%/yr" step={0.1} />
        </div>
      </details>

      <details open>
        <summary>Notary & fees (ancien)</summary>
        <div className="grid2">
          <NumberField
            label="DMTO rate"
            value={inp.dmtoRate}
            onChange={num('dmtoRate')}
            suffix="%"
            step={0.01}
            hint="5.80665% standard. 6.31% in most departments since 2025 (first-time buyers exempt)."
          />
          <NumberField label="Notary disbursements" value={inp.notaryDisbursements} onChange={num('notaryDisbursements')} suffix="€" step={100} />
          <NumberField label="Broker fee (courtier)" value={inp.brokerFee} onChange={num('brokerFee')} suffix="€" step={100} />
          <NumberField label="Bank file fee" value={inp.bankFee} onChange={num('bankFee')} suffix="€" step={100} />
          <SelectField
            label="Guarantee"
            value={inp.guaranteeType}
            options={[
              { value: 'caution', label: 'Caution (Crédit Logement)' },
              { value: 'hypotheque', label: 'Hypothèque / IPPD' },
            ]}
            onChange={(guaranteeType) => set({ guaranteeType })}
          />
          {inp.guaranteeType === 'caution' ? (
            <>
              <NumberField label="Caution commission" value={inp.cautionCommission} onChange={num('cautionCommission')} suffix="% loan" step={0.05} />
              <NumberField label="Mutual fund (FMG)" value={inp.cautionFmg} onChange={num('cautionFmg')} suffix="% loan" step={0.05} />
              <NumberField label="FMG refunded at end" value={inp.cautionFmgRefund} onChange={num('cautionFmgRefund')} suffix="%" step={5} />
            </>
          ) : (
            <NumberField label="Hypothèque cost" value={inp.hypothequeRate} onChange={num('hypothequeRate')} suffix="% loan" step={0.1} />
          )}
        </div>
      </details>

      <details open>
        <summary>Loan</summary>
        <div className="grid2">
          <NumberField label="Nominal rate" value={inp.loanRate} onChange={num('loanRate')} suffix="%" step={0.05} />
          <NumberField label="Duration" value={inp.loanYears} onChange={num('loanYears')} suffix="years" min={5} max={30} />
          <NumberField label="Insurance borrower 1" value={inp.insRate1} onChange={num('insRate1')} suffix="%/yr" step={0.01} />
          <NumberField label="Coverage borrower 1" value={inp.quotite1} onChange={num('quotite1')} suffix="%" step={10} />
          <NumberField label="Insurance borrower 2" value={inp.insRate2} onChange={num('insRate2')} suffix="%/yr" step={0.01} />
          <NumberField label="Coverage borrower 2" value={inp.quotite2} onChange={num('quotite2')} suffix="%" step={10} />
          <NumberField
            label="Extra monthly prepayment"
            value={inp.prepayMonthly}
            onChange={num('prepayMonthly')}
            suffix="€/mo"
            step={50}
            hint="Shortens the loan. Penalties (IRA) apply at the legal cap."
          />
        </div>
      </details>

      <details open>
        <summary>Household</summary>
        <div className="grid2">
          <NumberField label="Gross income borrower 1" value={inp.gross1} onChange={num('gross1')} suffix="€/yr" step={1000} />
          <NumberField label="Gross income borrower 2" value={inp.gross2} onChange={num('gross2')} suffix="€/yr" step={1000} />
          <NumberField label="Gross → net (before tax)" value={inp.netFactor} onChange={num('netFactor')} suffix="%" step={0.5} hint="About 77–78% for a cadre." />
          <NumberField label="Salary growth" value={inp.salaryGrowth} onChange={num('salaryGrowth')} suffix="%/yr" step={0.1} />
          <NumberField label="Living costs" value={inp.livingCosts} onChange={num('livingCosts')} suffix="€/mo" step={10} />
          <NumberField label="Vacation savings" value={inp.vacation} onChange={num('vacation')} suffix="€/mo" step={10} />
        </div>
        <CheckField label="Joint taxation (married / PACS, 2 parts)" checked={inp.taxJointly} onChange={(taxJointly) => set({ taxJointly })} />
        <p className="computed">
          Net before tax {eur(inc.netBeforeTax / 12)}/mo · after income tax {eur(inc.afterTax / 12)}/mo · TMI {inc.tmi}%
        </p>
      </details>

      <details open>
        <summary>Savings</summary>
        {inp.buckets.map((b) => (
          <div className="row-card" key={b.id}>
            <input className="name" value={b.name} onChange={(e) => setBucket(b.id, { name: e.target.value })} aria-label="Account name" />
            <div className="grid2">
              <NumberField label="Balance" value={b.balance} onChange={(balance) => setBucket(b.id, { balance })} suffix="€" step={1000} />
              <NumberField label="Yield" value={b.rate} onChange={(rate) => setBucket(b.id, { rate })} suffix="%/yr" step={0.1} />
              <SelectField label="Tax" value={b.regime} options={REGIMES} onChange={(regime) => setBucket(b.id, { regime })} />
              <CheckField label="Usable for apport" checked={b.eligible} onChange={(eligible) => setBucket(b.id, { eligible })} />
            </div>
            <button className="ghost small" onClick={() => set({ buckets: inp.buckets.filter((x) => x.id !== b.id) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          className="ghost"
          onClick={() =>
            set({ buckets: [...inp.buckets, { id: `b${Date.now()}`, name: 'New account', balance: 0, rate: 0, regime: 'pfu', eligible: true }] })
          }
        >
          + Add account
        </button>
        <div className="grid2">
          <NumberField label="Emergency fund (never spent)" value={inp.emergencyFund} onChange={num('emergencyFund')} suffix="€" step={1000} />
        </div>
        <CheckField
          label="Move eligible money not used as apport into the ETF"
          checked={inp.reinvestLeftover}
          onChange={(reinvestLeftover) => set({ reinvestLeftover })}
        />
      </details>

      <details open>
        <summary>Early retirement</summary>
        <div className="grid2">
          <NumberField label="Your age today" value={inp.currentAge} onChange={num('currentAge')} suffix="years" min={18} max={70} />
          <NumberField label="Money must last until" value={inp.endAge} onChange={num('endAge')} suffix="years old" min={60} max={110} />
          <NumberField label="State pension from" value={inp.pensionAge} onChange={num('pensionAge')} suffix="years old" min={55} max={70} />
          <NumberField
            label="State pension"
            value={inp.pensionMonthly}
            onChange={num('pensionMonthly')}
            suffix="€/mo"
            step={50}
            hint="Net, today's euros. Retiring early lowers it. Estimate on info-retraite.fr."
          />
          <NumberField
            label="Spending step"
            value={inp.fireStep}
            onChange={num('fireStep')}
            suffix="% of exp."
            step={5}
            min={1}
            hint="Each level adds this much above your expenses, up to your current salary."
          />
        </div>
      </details>

      <details open>
        <summary>ETF, tax & horizon</summary>
        <div className="grid2">
          <NumberField label="ETF expected return" value={inp.etfReturn} onChange={num('etfReturn')} suffix="%/yr" step={0.5} />
          <NumberField label="ETF volatility" value={inp.etfVol} onChange={num('etfVol')} suffix="%/yr" step={1} />
          <SelectField
            label="Envelope"
            value={inp.envelope}
            options={[
              { value: 'pea', label: 'PEA (overflow to CTO)' },
              { value: 'cto', label: 'CTO' },
            ]}
            onChange={(envelope) => set({ envelope })}
          />
          <NumberField label="PEA deposit cap" value={inp.peaCap} onChange={num('peaCap')} suffix="€" step={1000} />
          <NumberField label="Social charges" value={inp.socialRate} onChange={num('socialRate')} suffix="%" step={0.1} />
          <NumberField label="Flat tax (PFU)" value={inp.pfuRate} onChange={num('pfuRate')} suffix="%" step={0.1} />
          <NumberField label="Inflation" value={inp.inflation} onChange={num('inflation')} suffix="%/yr" step={0.1} />
          {!inp.horizonFollowsLoan && (
            <NumberField label="Horizon" value={inp.horizonYears} onChange={num('horizonYears')} suffix="years" min={1} max={40} />
          )}
        </div>
        <CheckField
          label={`Simulate over the loan duration (${inp.loanYears} years)`}
          checked={inp.horizonFollowsLoan}
          onChange={(horizonFollowsLoan) => set({ horizonFollowsLoan, horizonYears: inp.loanYears })}
        />
        <CheckField label="Monte Carlo (random ETF returns)" checked={inp.mcEnabled} onChange={(mcEnabled) => set({ mcEnabled })} />
        {inp.mcEnabled && <NumberField label="Runs" value={inp.mcRuns} onChange={num('mcRuns')} step={100} min={100} max={5000} />}
      </details>
    </aside>
  );
}
