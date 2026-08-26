import type { ScanReport } from '@forkpoint/agent-lighthouse-core';
import type { buildReportView } from '@forkpoint/agent-lighthouse-report';

/**
 * The tool contract, lifted out of `server.ts`.
 *
 * `server.ts` constructs a `Server`, registers handlers and connects a stdio
 * transport at import time, so none of it could be reached from a test. What a
 * client actually depends on is the tool's declared schema and the shape of the
 * JSON it gets back — both pure, and both pinned here.
 */

export const AUDIT_TOOL = {
  name: 'audit_website',
  description:
    'Audit a website or storefront for Agentic Readiness (WebMCP, OpenAPI, JSON-LD, robots.txt, and answer engines). Returns overall score, category breakdown, and actionable fix recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The target website or storefront URL to audit (e.g. https://example.com)',
      },
    },
    required: ['url'],
  },
} as const;

type ReportView = ReturnType<typeof buildReportView>;

export interface AuditSummary {
  url: string;
  /** Null when the scan obtained too little evidence to judge the site. */
  overallScore: number | null;
  /** Null exactly when `overallScore` is. */
  scoreTier: string | null;
  /** Present when the score was suppressed: what the scan is missing. */
  unscoredReason?: string;
  durationSeconds: string;
  vitals: ReportView['vitals'];
  categories: Array<{
    name: string;
    score: number;
    passCount: number;
    warnCount: number;
    failCount: number;
  }>;
  topOpportunities: Array<{
    id: string;
    title: string;
    priority: string | undefined;
    impact: string | undefined;
    fix: string | undefined;
  }>;
}

/** How many fixes the tool hands back. A model does not need all 215. */
export const MAX_OPPORTUNITIES = 10;

/**
 * Flatten a scan into the JSON the tool returns.
 *
 * The category list is flattened out of the view's groups because a model has
 * no use for the report's visual grouping, and the duration is pre-formatted so
 * the caller never has to divide by 1000 itself.
 */
export function buildAuditSummary(report: ScanReport, view: ReportView): AuditSummary {
  return {
    url: report.url,
    overallScore: view.overallScore,
    scoreTier: view.scoreTier,
    ...(view.unscoredReason ? { unscoredReason: view.unscoredReason } : {}),
    durationSeconds: (view.durationMs / 1000).toFixed(1),
    vitals: view.vitals,
    categories: view.groups.flatMap((g) =>
      g.categories.map((c) => ({
        name: c.name,
        score: c.score,
        passCount: c.counts.pass,
        warnCount: c.counts.warn,
        failCount: c.counts.fail,
      })),
    ),
    topOpportunities: report.topFails.slice(0, MAX_OPPORTUNITIES).map((f) => ({
      id: f.id,
      title: f.title,
      priority: f.priority,
      impact: f.impact,
      fix: f.fix,
    })),
  };
}

/**
 * The URL a `tools/call` request is asking about.
 *
 * `String(undefined)` is the string "undefined", which is truthy — the original
 * emptiness guard could never fire, so a call with no arguments scanned a URL
 * literally named "undefined" and failed deep inside the fetcher instead of at
 * the boundary.
 */
export function targetUrl(args: Record<string, unknown> | undefined): string {
  const raw = args?.['url'];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('Missing target URL');
  }
  return raw.trim();
}
