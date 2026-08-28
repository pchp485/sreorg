import { handleTrack } from "@sreorg/core";
export const runtime = "nodejs";
export const POST = (request: Request) => handleTrack(request, "invoicing");
