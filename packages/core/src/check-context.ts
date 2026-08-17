import type { CheerioAPI } from 'cheerio';
import type { CheckResult, PageType } from './types';
import type { FetchOptions, FetchResult } from './fetcher';
import type { A11yPageResult } from './audits/accessibility/runner';

export interface PageContext {
  url: string;
  pageType: PageType;
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
  wafProtection?: import('./waf-detector').WafProtection;
}

export type CheckFn = (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
