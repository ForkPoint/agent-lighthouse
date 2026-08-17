export { runScan } from './orchestrator';
export { createFetcher, isSafeUrl } from './fetcher';
export type { FetchResult, FetchOptions } from './fetcher';
export type { CheckContext, CheckFn, PageContext } from './check-context';
export { Audit } from './audit';
export { runAudits } from './audit-runner';
export { defaultConfig } from './audit-config';
export type { ScanConfig, CategoryConfig, AuditRegistration } from './audit-config';
export type { AuditRunResult } from './audit-runner';
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
export { logger } from './logger';
