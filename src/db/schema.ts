import {
  pgTable, text, timestamp, integer, boolean, jsonb, uuid, index, uniqueIndex,
} from "drizzle-orm/pg-core";

/** A person who signed up. Auth is passwordless (email magic link). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    businessName: text("business_name"),
    gstin: text("gstin"),
    stateCode: text("state_code"), // GST state code, e.g. "29" for Karnataka
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Attribution: which pSEO page brought them in. Drives the growth loop.
    acquisitionSource: text("acquisition_source"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * Entitlement is derived from Razorpay and cached here so page renders never
 * hit Razorpay. The webhook is the only writer.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    razorpaySubscriptionId: text("razorpay_subscription_id").notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),
    planCode: text("plan_code").notNull(), // "pro_monthly" | "pro_yearly"
    status: text("status").notNull(), // created|authenticated|active|halted|cancelled|completed
    amountPaise: integer("amount_paise").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subs_rzp_idx").on(t.razorpaySubscriptionId),
    index("subs_user_idx").on(t.userId),
  ],
);

/** Idempotency ledger for Razorpay webhooks. Razorpay retries; we must not double-apply. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(), // x-razorpay-event-id
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

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

/** The thing customers actually pay us to keep running while they sleep. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    lineItems: jsonb("line_items").notNull(), // LineItem[]
    subtotalPaise: integer("subtotal_paise").notNull(),
    cgstPaise: integer("cgst_paise").notNull(),
    sgstPaise: integer("sgst_paise").notNull(),
    igstPaise: integer("igst_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    status: text("status").notNull().default("draft"), // draft|sent|paid|void
    paidAt: timestamp("paid_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    publicToken: text("public_token").notNull(), // unguessable link for the client
  },
  (t) => [
    index("invoices_user_idx").on(t.userId),
    index("invoices_due_idx").on(t.status, t.dueDate),
    uniqueIndex("invoices_number_idx").on(t.userId, t.number),
    uniqueIndex("invoices_token_idx").on(t.publicToken),
  ],
);

/** Cookie-free funnel events. Feeds the growth engine's "what converts" decision. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // page_view|tool_used|signup|checkout_started|subscription_active
    path: text("path"),
    referrer: text("referrer"),
    userId: uuid("user_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_name_time_idx").on(t.name, t.createdAt), index("events_path_idx").on(t.path)],
);

/** Programmatic-SEO pages, written by the growth engine, reviewed by a human via PR. */
export const seoPages = pgTable(
  "seo_pages",
  {
    slug: text("slug").primaryKey(),
    title: text("title").notNull(),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const magicLinks = pgTable("magic_links", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
