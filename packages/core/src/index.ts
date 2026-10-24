export { runScan } from "./orchestrator";
export type { ScanOptions } from "./orchestrator";
export { ProgressTracker, PHASE_WEIGHTS } from "./progress";
export { PhaseId } from "./progress";
export type { ScanEvent } from "./progress";
export { createFetcher, isSafeUrl, boundedDispatcher } from "./fetcher";
export type {
  FetchResult,
  FetchOptions,
  Fetcher,
  FetcherOptions,
  FetcherSummary,
  HttpExchange,
} from "./fetcher";
export {
  createRequestScheduler,
  HostStopReason,
  HostStoppedError,
  schedulerHostKey,
} from "./request-scheduler";
export type {
  DefaultRequestScheduler,
  HostState,
  RequestQueueSnapshot,
  RequestScheduler,
  RequestSchedulerOptions,
} from "./request-scheduler";
export { createReplay } from "./replay";
export type { Replay } from "./replay";
export { scanNow, withScanEnvironment } from "./scan-environment";
export type { HostLookup, ScanEnvironment } from "./scan-environment";
export { buildOfflineContext } from "./offline-context";
export type { OfflineContextOptions } from "./offline-context";
export { CORE_VERSION, getRegistrySummary } from "./registry-summary";
export type {
  RegistrySummary,
  RegistryCategorySummary,
} from "./registry-summary";
export {
  classifyFetch,
  isRealFile,
  stripBom,
  normalizeNewlines,
} from "./gatherers/fetch-classify";
export type { FetchClass, ExpectedKind } from "./gatherers/fetch-classify";
export {
  parseRobots,
  parseRobotsFile,
  matchesUserAgent,
  groupsForBot,
  hasNamedGroup,
  isPathAllowed,
  isBlanketBlocked,
} from "./gatherers/robots";
export type { RobotsRule, RobotsGroup, RobotsFile } from "./gatherers/robots";
export {
  probeUaParity,
  classifyResponse,
  AI_CRAWLER_UAS,
  BASELINE_UA,
} from "./gatherers/ua-parity";
export type { UaProbe, BlockClass } from "./gatherers/ua-parity";
export {
  BOT_REGISTRY,
  BotPurpose,
  BotToken,
  botEntry,
  botsByPurpose,
} from "./bot-registry";
export type { BotEntry, ProbeUserAgent } from "./bot-registry";
export {
  collectSitemapEntries,
  sampleEntries,
  isW3CDateTime,
} from "./gatherers/sitemap";
export type { SitemapEntry, SitemapTree } from "./gatherers/sitemap";
export { parseCssRules, collectPageCss } from "./gatherers/css-rules";
export type { CssRule, PageCss } from "./gatherers/css-rules";
export { pagesOfType, judgePages } from "./gatherers/pages";
export type { PageJudgement } from "./gatherers/pages";
export type { CheckContext, CheckFn, PageContext } from "./check-context";
export type { ScanEvidence } from "./scan-evidence";
export {
  buildScanEvidence,
  allEvidenceMet,
  pageRendersText,
} from "./scan-evidence";
export { Audit, evidenceUrl } from "./audit";
export { runAudits, planAudits } from "./audit-runner";
export {
  defaultConfig,
  CATEGORY_MASS,
  CATEGORY_IDS,
  filterConfig,
} from "./audit-config";
export type {
  ScanConfig,
  CategoryConfig,
  AuditRegistration,
} from "./audit-config";
export type {
  AuditProgressEvent,
  AuditPlan,
  AuditRunResult,
  AuditTraceHandler,
} from "./audit-runner";
export {
  traceFromCheck,
  outcomeOf,
  formatTrace,
  AuditOutcome,
} from "./audit-trace";
export type { AuditTrace } from "./audit-trace";
export { parsePageContext } from "./page-context";
export {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
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
  getRenderedText,
  getWordCount,
  detectPageType,
  classifyPage,
  declaredPageClassification,
} from "./parser";
export {
  calculateCategoryScore,
  buildCategoryResult,
  calculateOverallScore,
  categoryAssessedMass,
  countCategoryStatuses,
  isCategoryAssessed,
  isInformative,
  isObsolete,
  weightForGrade,
} from "./scorer";
export { extractProductFieldVerification } from "./product-fields";

// Types & Schemas
export * from "./contracts";
export * from "./types";
export * from "./constants";
export { skippedMassShare } from "./scorer";
export { generateScanSummary } from "./summary";
export { budgetReason, formatBudget } from "./audit-runner";
export * from "./schemas";
export * from "./url-utils";
export * from "./config-loader";
export * from "./origin-cache";
export { detectWafProtection, WafProvider } from "./waf-detector";
export {
  logger,
  LogLevel,
  LogFormat,
  LogField,
  withLogContext,
  formatLogRecord,
  parseLogLevel,
  parseLogFormat,
} from "./logger";
export type {
  LineLevel,
  LogFields,
  LoggerLike,
  LogRecord,
  LogSink,
} from "./logger";

// ACP policy-link resolution, reused by the checkout-eligibility audits.
export {
  resolvePolicyLinks,
  ACP_LINK_TYPES,
} from "./audits/agentic-commerce/acp-policy-link-surface";
export type { AcpLinkType } from "./audits/agentic-commerce/acp-policy-link-surface";

export {
  SNAPSHOT_AUDITS,
  SNAPSHOT_EVIDENCE_LIMITS,
} from "./snapshot-eligibility";
export type { DomPageContext } from "./check-context";
export { detectPage } from "./detect-page";
export { DomWorkLimitError } from "./dom-work";
