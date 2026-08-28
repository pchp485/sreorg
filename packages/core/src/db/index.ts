import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../env";

// One pooled client per process. Serverless invocations reuse it across warm calls.
const globalForDb = globalThis as unknown as { _sql?: ReturnType<typeof postgres> };

const sql = globalForDb._sql ?? postgres(env.DATABASE_URL, { max: 1, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb._sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
