import { readFileSync } from 'node:fs';
import type { SourceRecord, SourceRegistry } from '../islands/sources-table';
import { sourceTypes } from '../islands/sources-table';
import { repoPath } from './markdown-slice';

/**
 * What `docs/evidence/` hands the site: the policy prose and the source
 * registry it cites.
 *
 * Both are read where they live and never copied into this package — the same
 * rule the docs pages follow. `pages/sources.json.ts` republishes the registry
 * byte for byte, so the table in the browser and the file in the repository
 * cannot drift apart.
 *
 * Server-side only: this touches the filesystem. The browser gets the JSON.
 */
export const EVIDENCE_DIR = 'docs/evidence';
export const POLICY_FILE = `${EVIDENCE_DIR}/policy.md`;
export const SOURCES_FILE = `${EVIDENCE_DIR}/sources.json`;

/** The evidence policy, as the markdown it is on disk. */
export function readPolicySource(): string {
  return readFileSync(repoPath(POLICY_FILE), 'utf8');
}

/** The registry file verbatim, for the endpoint that republishes it. */
export function readSourceRegistryRaw(): string {
  return readFileSync(repoPath(SOURCES_FILE), 'utf8');
}

/** The registry parsed, for the page that renders its facets. */
export function readSourceRegistry(): SourceRegistry {
  return JSON.parse(readSourceRegistryRaw()) as SourceRegistry;
}

/** How many sources carry each type, in the order the filter shows them. */
export function sourceTypeCounts(sources: SourceRecord[]): Array<{ type: string; count: number }> {
  return sourceTypes(sources).map((type) => ({
    type,
    count: sources.filter((source) => source.type === type).length,
  }));
}
