import { NextResponse } from "next/server";
import { z } from "zod";
import { track, type EventName } from "@/lib/analytics";

export const runtime = "nodejs";

const Body = z.object({
  name: z.enum(["page_view", "tool_used"]),
  path: z.string().max(512).optional(),
  referrer: z.string().max(1024).optional(),
});

/** Deliberately narrow: only anonymous top-of-funnel events come from the browser. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await track({ name: parsed.data.name as EventName, path: parsed.data.path, referrer: parsed.data.referrer });
  return NextResponse.json({ ok: true });
}
