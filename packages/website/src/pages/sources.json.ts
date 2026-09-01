import type { APIRoute } from "astro";
import { readSourceRegistryRaw } from "../lib/evidence";

/**
 * The source registry, republished at `/sources.json` for the table on
 * `/sources/` to fetch and for anything else that wants the raw evidence.
 *
 * The file is served byte for byte rather than re-serialized: it is the same
 * document `docs/evidence/` holds, `$comment` and all, so a reader who downloads
 * it has the registry the dossiers actually cite.
 */
export const GET: APIRoute = () =>
  new Response(readSourceRegistryRaw(), {
    headers: { "content-type": "application/json" },
  });
