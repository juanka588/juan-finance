import type { ScenarioResult } from '../engine/scenario';
import { eur } from '../format';

export function AcquisitionBreakdown({ result }: { result: ScenarioResult }) {
  const { acq } = result;
  const lines: [string, number][] = [
    ['Price', acq.totalCost - acq.feesTotal - acq.renovation],
    ['Renovation', acq.renovation],
    ['Transfer tax (DMTO)', acq.notary.dmto],
    ['Notary fees incl. VAT', acq.notary.emoluments],
    ['Contribution de sécurité immobilière', acq.notary.csi],
    ['Disbursements', acq.notary.disbursements],
    ['Agency fees', acq.agency],
    ['Loan guarantee', acq.guarantee],
    ['Bank file fee', acq.bank],
    ['Broker fee', acq.broker],
  ];
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3>Purchase budget: {result.def.name}</h3>
          <p className="subtitle">
            Notary total {eur(acq.notary.total)}, which is {((acq.notary.total / (acq.totalCost - acq.feesTotal - acq.renovation)) * 100).toFixed(1)}% of the price
            {acq.guaranteeRefund > 0 && `. About ${eur(acq.guaranteeRefund)} of the guarantee comes back at the end of the loan.`}
          </p>
        </div>
      </header>
      <div className="two-col">
        <table className="simple">
          <tbody>
            {lines.filter(([, v]) => v > 0).map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{eur(v)}</td>
              </tr>
            ))}
            <tr className="total">
              <th scope="row">Total cost</th>
              <td>{eur(acq.totalCost)}</td>
            </tr>
          </tbody>
        </table>
        <table className="simple">
          <tbody>
            {result.apportFrom.map((a) => (
              <tr key={a.name}>
                <th scope="row">Apport from {a.name}</th>
                <td>{eur(a.amount)}</td>
              </tr>
            ))}
            <tr className="total">
              <th scope="row">Apport</th>
              <td>{eur(acq.apport)}</td>
            </tr>
            <tr>
              <th scope="row">Loan</th>
              <td>{eur(acq.loan)}</td>
            </tr>
            {result.leftover > 0 && (
              <tr>
                <th scope="row">Spare savings (moved to ETF if enabled)</th>
                <td>{eur(result.leftover)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
