import { handleSubscribe } from "@sreorg/core";
export const runtime = "nodejs";
export const POST = (request: Request) => handleSubscribe(request);
