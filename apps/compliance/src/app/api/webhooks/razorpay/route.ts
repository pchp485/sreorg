import { handleRazorpayWebhook } from "@sreorg/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleRazorpayWebhook(request);
