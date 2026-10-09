import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PageType } from "#core/types";

/** A fixture's page type as a reader would give it, with the shape it covers. */
export interface PageTypeLabel {
  expected: PageType;
  /** Also fetched live by the smoke test, which re-checks the type only. */
  live?: boolean;
  why: string;
}

const FILE = resolve(__dirname, "../../test-data/corpus/page-types.json");

export function readPageTypeLabels(): Record<string, PageTypeLabel> {
  const parsed = JSON.parse(readFileSync(FILE, "utf8")) as {
    fixtures: Record<string, PageTypeLabel>;
  };
  return parsed.fixtures;
}

/**
 * The URL a scan of this fixture would have requested: the first redirect
 * hop, or the fixture's URL when there was none. The orchestrator classifies
 * the requested URL, so a homepage that redirects from `/` to a locale path is
 * still read at `/`.
 */
export function requestedUrl(provenance: {
  url: string;
  redirectChain?: Array<{ from: string }>;
}): string {
  return provenance.redirectChain?.[0]?.from ?? provenance.url;
}
