import type { CheerioAPI } from "cheerio";
import type { CheckResult, PageType } from "./types";
import type { FetchOptions, FetchResult } from "./fetcher";
import type { A11yPageResult } from "./audits/operability-safety/runner";

export interface PageContext {
  url: string;
  pageType: PageType;
  pageTypeSource?: "declared" | "detected";
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
  domain: string;
  baseUrl: string;
  fetch: (options: FetchOptions) => Promise<FetchResult>;
  wafProtection?: import("./waf-detector").WafProtection;
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
