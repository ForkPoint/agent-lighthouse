export { runScan } from './orchestrator';
export type { ScanOptions } from './orchestrator';
export { ProgressTracker, PHASE_WEIGHTS } from './progress';
export type { PhaseId, ScanEvent } from './progress';
export { createFetcher, isSafeUrl } from './fetcher';
export type { FetchResult, FetchOptions } from './fetcher';
export {
  classifyFetch,
  isRealFile,
  stripBom,
  normalizeNewlines,
} from './gatherers/fetch-classify';
export type { FetchClass, ExpectedKind } from './gatherers/fetch-classify';
export {
  parseRobots,
  parseRobotsFile,
  matchesUserAgent,
  groupsForBot,
  hasNamedGroup,
  isPathAllowed,
  isBlanketBlocked,
} from './gatherers/robots';
export type { RobotsRule, RobotsGroup, RobotsFile } from './gatherers/robots';
export { probeUaParity, classifyResponse, AI_CRAWLER_UAS, BASELINE_UA } from './gatherers/ua-parity';
export type { UaProbe, BlockClass } from './gatherers/ua-parity';
export {
  collectSitemapEntries,
  sampleEntries,
  isW3CDateTime,
} from './gatherers/sitemap';
export type { SitemapEntry, SitemapTree } from './gatherers/sitemap';
export { parseCssRules, collectPageCss } from './gatherers/css-rules';
export type { CssRule, PageCss } from './gatherers/css-rules';
export { pagesOfType, judgePages } from './gatherers/pages';
export type { PageJudgement } from './gatherers/pages';
export type { CheckContext, CheckFn, PageContext } from './check-context';
export { Audit, evidenceUrl } from './audit';
export { runAudits, planAudits } from './audit-runner';
export { defaultConfig, CATEGORY_MASS, CATEGORY_IDS, filterConfig } from './audit-config';
export type { ScanConfig, CategoryConfig, AuditRegistration } from './audit-config';
export type { AuditProgressEvent, AuditPlan, AuditRunResult } from './audit-runner';
export {
  parseHtml,
  extractJsonLd,
  topLevelJsonLd,
  allJsonLdNodes,
  flattenJsonLd,
  extractMarkdownLinks,
  extractMetaTags,
  extractHeadLinks,
  extractHeadings,
  extractImages,
  extractForms,
  extractInternalLinks,
  extractNavLinks,
  extractScripts,
  extractStylesheetUrls,
  getMainContentText,
  getWordCount,
  detectPageType,
} from './parser';
export {
  calculateCategoryScore,
  buildCategoryResult,
  calculateOverallScore,
  isInformative,
  weightForGrade,
} from './scorer';
export { extractProductFieldVerification } from './product-fields';

// Types & Schemas
export * from './types';
export * from './constants';
export * from './schemas';
export * from './url-utils';
export * from './presets';
export * from './config-loader';
export { detectWafProtection } from './waf-detector';
export { logger } from './logger';


// ACP policy-link resolution, reused by the checkout-eligibility audits.
export { resolvePolicyLinks, ACP_LINK_TYPES } from './audits/agentic-commerce/acp-policy-link-surface';
export type { AcpLinkType } from './audits/agentic-commerce/acp-policy-link-surface';
