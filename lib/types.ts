export type Category =
  | "housing"
  | "loans"
  | "subscriptions"
  | "food"
  | "dining"
  | "transport"
  | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  housing: "السكن والإيجار",
  loans: "أقساط القروض",
  subscriptions: "الاشتراكات",
  food: "البقالة والطعام",
  dining: "الأكل خارج البيت",
  transport: "المواصلات",
  other: "أخرى",
};

export const FIXED_CATEGORIES: Category[] = ["housing", "loans", "subscriptions", "other"];
export const VARIABLE_CATEGORIES: Category[] = ["food", "dining", "transport", "other"];

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: Category;
  dueDay: number; // 1-28
}

export interface VariableExpense {
  id: string;
  name: string;
  amount: number; // typical monthly total
  category: Category;
}

export interface IncomingFund {
  id: string;
  name: string;
  amount: number;
  kind: "once" | "annual";
  inMonths: number; // for "once": months from now; for "annual": month index 0-11 of first arrival
}

export interface Profile {
  startingBalance: number;
  monthlyIncome: number;
  payday: number; // 1-28
  safetyBuffer: number; // balance below this counts as danger
  fixed: FixedExpense[];
  variable: VariableExpense[];
  incoming: IncomingFund[];
  updatedAt: string;
}

export type Scenario =
  | {
      kind: "loan";
      label: string;
      amount: number; // financed amount
      annualRatePct: number;
      months: number;
      downPayment: number;
      startInMonths: number;
    }
  | {
      kind: "income-stop";
      label: string;
      stopMonths: number;
      startInMonths: number;
      extraMonthlyCost: number; // e.g. travel budget replacing income
      severance: number;
    }
  | {
      kind: "invest";
      label: string;
      monthlyAmount: number;
      annualReturnPct: number;
    };

export interface MonthPoint {
  index: number;
  label: string;
  year: number;
  month: number; // 0-11
  income: number;
  expenses: number;
  openingBalance: number;
  closingBalance: number;
  minBalance: number;
  invested: number; // cumulative investment portfolio value (scenario)
  netWorth: number; // closingBalance + invested
  danger: boolean;
}

export interface CategoryShare {
  category: Category;
  amount: number;
  pctOfIncome: number;
}

export interface Insights {
  totalFixed: number;
  totalVariable: number;
  totalOut: number;
  netMonthly: number;
  savingsRatePct: number;
  shares: CategoryShare[];
  topShare: CategoryShare | null;
  runoutDay: number | null; // day of month money runs out in a typical month
  runwayMonths: number | null; // months until balance < buffer (null = never within horizon)
  firstDanger: MonthPoint | null;
  tightWeek: number | null; // 1-4
  weeklyMin: number[]; // min balance per week bucket of a typical month
}

export interface Warning {
  daysAhead: number;
  date: Date;
  shortfall: number; // how much will be missing
  cause: string;
}

export interface PlanSuggestion {
  title: string;
  detail: string;
  impact: number; // EGP freed or covered
}
