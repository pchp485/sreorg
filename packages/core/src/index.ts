/**
 * Server-side barrel. `auth` is deliberately NOT re-exported here: it imports
 * next/headers, and a client component pulling this barrel in for formatINR
 * would drag a server-only module into the browser bundle. Import it from
 * "@sreorg/core/auth" where it is actually needed.
 */
export * from "./money";
export * from "./products";
export * from "./env";
export * from "./email";
export * from "./analytics";
export * from "./entitlements";
export * from "./razorpay";
export * from "./handlers";
export { db, schema } from "./db";
