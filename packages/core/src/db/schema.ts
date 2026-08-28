import {
  pgTable, text, timestamp, integer, boolean, jsonb, uuid, index, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One database for the whole portfolio. A customer is one row no matter how
 * many products they buy, and portfolio MRR is a single query rather than three
 * dashboards that have to be added up by hand.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    businessName: text("business_name"),
    gstin: text("gstin"),
    stateCode: text("state_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Which product and which page first brought them in. Drives the growth loop. */
    acquisitionProduct: text("acquisition_product"),
    acquisitionSource: text("acquisition_source"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** ProductId from the registry. Entitlement is always product-scoped. */
    product: text("product").notNull(),
    razorpaySubscriptionId: text("razorpay_subscription_id").notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),
    planCode: text("plan_code").notNull(),
    status: text("status").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    /** Monthly-equivalent, so yearly and monthly plans sum into one MRR figure. */
    mrrPaise: integer("mrr_paise").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("subs_rzp_idx").on(t.razorpaySubscriptionId),
    index("subs_user_idx").on(t.userId),
    index("subs_product_status_idx").on(t.product, t.status),
  ],
);

/** Idempotency ledger. Razorpay retries for 24 hours; we must not double-apply. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    product: text("product").notNull(),
    name: text("name").notNull(),
    path: text("path"),
    referrer: text("referrer"),
    userId: uuid("user_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_product_name_time_idx").on(t.product, t.name, t.createdAt),
    index("events_path_idx").on(t.path),
  ],
);

// ---------------------------------------------------------------- invoicing

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    gstin: text("gstin"),
    stateCode: text("state_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_user_idx").on(t.userId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    lineItems: jsonb("line_items").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    cgstPaise: integer("cgst_paise").notNull(),
    sgstPaise: integer("sgst_paise").notNull(),
    igstPaise: integer("igst_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    status: text("status").notNull().default("draft"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    publicToken: text("public_token").notNull(),
  },
  (t) => [
    index("invoices_user_idx").on(t.userId),
    index("invoices_due_idx").on(t.status, t.dueDate),
    uniqueIndex("invoices_number_idx").on(t.userId, t.number),
    uniqueIndex("invoices_token_idx").on(t.publicToken),
  ],
);

// ------------------------------------------------------------------ payroll

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    pan: text("pan"),
    /** Monthly CTC in paise. The engine derives every component from this. */
    ctcPaise: integer("ctc_paise").notNull(),
    basicPercent: integer("basic_percent").notNull().default(50),
    stateCode: text("state_code").notNull().default("29"),
    regime: text("regime").notNull().default("new"), // new | old
    pfOptedIn: boolean("pf_opted_in").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("employees_user_idx").on(t.userId)],
);

export const payslips = pgTable(
  "payslips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    /** "2026-08" — the payroll month this slip covers. */
    period: text("period").notNull(),
    breakdown: jsonb("breakdown").notNull(),
    grossPaise: integer("gross_paise").notNull(),
    deductionsPaise: integer("deductions_paise").notNull(),
    netPaise: integer("net_paise").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payslips_period_idx").on(t.employeeId, t.period)],
);

// --------------------------------------------------------------- compliance

export const complianceProfiles = pgTable(
  "compliance_profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // proprietor | llp | private_limited
    gstRegistered: boolean("gst_registered").notNull().default(false),
    gstScheme: text("gst_scheme").notNull().default("monthly"), // monthly | qrmp
    deductsTds: boolean("deducts_tds").notNull().default(false),
    hasEmployees: boolean("has_employees").notNull().default(false),
    stateCode: text("state_code").notNull().default("29"),
    /** Days before the deadline to send the reminder. */
    leadDays: integer("lead_days").notNull().default(7),
  },
);

export const reminderLog = pgTable(
  "reminder_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Obligation code plus its due date — the natural idempotency key. */
    obligation: text("obligation").notNull(),
    dueDate: text("due_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reminder_once_idx").on(t.userId, t.obligation, t.dueDate)],
);

export const magicLinks = pgTable("magic_links", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
