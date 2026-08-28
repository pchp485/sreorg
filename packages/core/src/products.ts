/**
 * The portfolio registry. Every product in this repo is declared here, and the
 * shared billing, entitlement, analytics and reporting code is driven entirely
 * off this table — adding a fourth product means adding a row, not a subsystem.
 */
export interface PlanDef {
  code: string;
  label: string;
  amountPaise: number;
  period: "monthly" | "yearly";
  /** Name of the env var holding the Razorpay plan id for this plan. */
  planIdEnv: string;
}

export interface ProductDef {
  id: ProductId;
  name: string;
  /** What the customer is actually paying to have happen without them. */
  promise: string;
  domainEnv: string;
  plans: PlanDef[];
}

export type ProductId = "invoicing" | "payroll" | "compliance";

export const PRODUCTS: Record<ProductId, ProductDef> = {
  invoicing: {
    id: "invoicing",
    name: "GST invoicing with automatic follow-up",
    promise: "Chases every overdue invoice so the freelancer never has to.",
    domainEnv: "INVOICING_URL",
    plans: [
      { code: "invoicing_monthly", label: "Pro — monthly", amountPaise: 39900, period: "monthly", planIdEnv: "RZP_PLAN_INVOICING_MONTHLY" },
      { code: "invoicing_yearly", label: "Pro — yearly", amountPaise: 399000, period: "yearly", planIdEnv: "RZP_PLAN_INVOICING_YEARLY" },
    ],
  },
  payroll: {
    id: "payroll",
    name: "Payslips and statutory deductions on autopilot",
    promise: "Issues every employee's payslip on the 1st, with PF, ESI, PT and TDS already worked out.",
    domainEnv: "PAYROLL_URL",
    plans: [
      { code: "payroll_monthly", label: "Payroll — monthly", amountPaise: 49900, period: "monthly", planIdEnv: "RZP_PLAN_PAYROLL_MONTHLY" },
      { code: "payroll_yearly", label: "Payroll — yearly", amountPaise: 499000, period: "yearly", planIdEnv: "RZP_PLAN_PAYROLL_YEARLY" },
    ],
  },
  compliance: {
    id: "compliance",
    name: "Statutory deadline reminders",
    promise: "Tells you what is due, a week before the penalty starts.",
    domainEnv: "COMPLIANCE_URL",
    plans: [
      { code: "compliance_monthly", label: "Reminders — monthly", amountPaise: 19900, period: "monthly", planIdEnv: "RZP_PLAN_COMPLIANCE_MONTHLY" },
      { code: "compliance_yearly", label: "Reminders — yearly", amountPaise: 199000, period: "yearly", planIdEnv: "RZP_PLAN_COMPLIANCE_YEARLY" },
    ],
  },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export function findPlan(planCode: string): { product: ProductDef; plan: PlanDef } | null {
  for (const product of Object.values(PRODUCTS)) {
    const plan = product.plans.find((p) => p.code === planCode);
    if (plan) return { product, plan };
  }
  return null;
}

/** Monthly-equivalent value of a plan, so yearly and monthly can be summed into one MRR. */
export function monthlyEquivalentPaise(plan: PlanDef): number {
  return plan.period === "yearly" ? Math.round(plan.amountPaise / 12) : plan.amountPaise;
}
