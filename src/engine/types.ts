// All rates are expressed in percent (3.2 = 3.2%) to match the input fields.

export type Regime = 'pfu' | 'livret' | 'pee' | 'untaxed';

export interface Bucket {
  id: string;
  name: string;
  balance: number;
  rate: number; // annual yield, %
  regime: Regime;
  eligible: boolean; // can be used for the apport
}

export type ApportMode = 'fees' | 'percent' | 'amount' | 'max';

export interface ScenarioDef {
  id: string;
  name: string;
  mode: ApportMode;
  value: number; // % of price for 'percent', € for 'amount', ignored otherwise
}

export interface Inputs {
  // Property
  price: number;
  agencyFees: number;
  renovation: number;
  dmtoRate: number;
  notaryDisbursements: number;
  propertyChargesYearly: number;
  appreciation: number;

  // Fees & guarantee
  brokerFee: number;
  bankFee: number;
  guaranteeType: 'caution' | 'hypotheque';
  cautionCommission: number; // % of loan, non-refundable
  cautionFmg: number; // % of loan, mutual guarantee fund
  cautionFmgRefund: number; // % of FMG refunded at the end
  hypothequeRate: number; // % of loan

  // Loan
  loanRate: number;
  loanYears: number;
  insRate1: number; // % of initial capital per year
  insRate2: number;
  quotite1: number; // %
  quotite2: number;
  prepayMonthly: number;

  // Household
  gross1: number;
  gross2: number;
  netFactor: number; // gross -> net before income tax
  taxJointly: boolean;
  salaryGrowth: number;
  livingCosts: number; // monthly
  vacation: number; // monthly

  // Savings
  buckets: Bucket[];
  emergencyFund: number;
  reinvestLeftover: boolean;

  // Market & tax
  etfReturn: number;
  etfVol: number;
  envelope: 'pea' | 'cto';
  peaCap: number;
  socialRate: number;
  pfuRate: number;
  inflation: number;
  horizonYears: number; // used only when horizonFollowsLoan is false
  horizonFollowsLoan: boolean;

  // Early retirement
  currentAge: number;
  endAge: number; // money must last until this age
  pensionAge: number;
  pensionMonthly: number; // net state pension, today's euros
  fireStep: number; // % of expenses added per spending level

  scenarios: ScenarioDef[];
  mcEnabled: boolean;
  mcRuns: number;
}
