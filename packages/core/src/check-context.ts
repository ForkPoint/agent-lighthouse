import type { CheerioAPI } from "cheerio";
import type {
  CheckResult,
  PageType,
  PageClassification,
  PageAttempt,
  PageTypeSource,
} from "./types";
import type { FetchOptions, FetchResult } from "./fetcher";
import type { A11yPageResult } from "./audits/operability-safety/runner";

export interface PageContext {
  url: string;
  pageType: PageType;
  pageTypeSource?: PageTypeSource;
  classification?: PageClassification;
  fetchResult: FetchResult;
  $: CheerioAPI;
  /** Parsed JSON-LD blocks only (used by JSON-LD-specific audits). */
  jsonLd: object[];
  /**
   * Union of all structured data: JSON-LD + Microdata + RDFa, normalized to
   * schema.org-shaped objects. Product/commerce audits read this so they detect
   * data regardless of the markup format. Optional for backward compatibility;
   * audits fall back to `jsonLd` when absent.
   */
  structuredData?: object[];
  meta: Record<string, string>;
  headLinks: Array<{
    rel: string;
    type: string;
    href: string;
    title: string;
  }>;
  /**
   * Accessibility rule results for this page (ruleId → status + offending
   * nodes), populated by the orchestrator. Consumed by the accessibility
   * audits. Absent if the a11y run failed or was skipped.
   */
  a11yResults?: A11yPageResult;
}

export interface CheckContext {
  rootFiles: Record<string, FetchResult>;
  pages: PageContext[];
  /** Includes failed fetches omitted from parsed pages. */
  pageAttempts?: PageAttempt[];
  domain: string;
  baseUrl: string;
  /**
   * The URL the caller asked to scan. Audits receive it as `pages[0]` when it
   * was read, because many still judge the first page as the scan target.
   */
  targetUrl?: string;
  /** Mounted homepage root for sitemap discovery and samples; origin files stay at baseUrl. */
  siteRootUrl?: string;
  fetch: (options: FetchOptions) => Promise<FetchResult>;
  wafProtection?: import("./waf-detector").WafProtection;
  /**
   * The object per-scan gatherer caches key on.
   *
   * The runner hands each audit a scoped copy of this context, and a copy has
   * a new identity. Without this stamp every gatherer `WeakMap` would miss
   * once per audit and repeat its fetch. The runner sets it on each copy;
   * an unstamped context is its own owner. See `gatherers/cache-owner.ts`.
   */
  cacheOwner?: object;
  /**
   * What the scan actually obtained, decided once before any audit ran.
   *
   * Required, not optional. An optional field fails open, and a caller that
   * forgets is exactly the silent-nothing verdict this exists to remove. Test
   * harnesses that do not exercise the gate pass `allEvidenceMet()`.
   */
  evidence: import("./scan-evidence").ScanEvidence;
  /**
   * Origin evidence metadata and cached homepage response.
   */
  originEvidence?: {
    origin: string;
    version: string;
    readAt: string;
    cached: boolean;
    originHomepage?: FetchResult;
  };
}

export type CheckFn = (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
