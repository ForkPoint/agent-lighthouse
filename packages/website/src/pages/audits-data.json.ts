import type { APIRoute } from "astro";
import { auditDataList } from "../lib/registry";

/** Kept from the old site: anything fetching this file keeps working. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(auditDataList(), null, 2), {
    headers: { "content-type": "application/json" },
  });
