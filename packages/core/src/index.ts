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
export type { CheckContext, CheckFn, PageContext } from './check-context';
export { Audit } from './audit';
export { runAudits, planAudits } from './audit-runner';
export { defaultConfig } from './audit-config';
export type { ScanConfig, CategoryConfig, AuditRegistration } from './audit-config';
export type { AuditProgressEvent, AuditPlan, AuditRunResult } from './audit-runner';
export {
  parseHtml,
  extractJsonLd,
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

