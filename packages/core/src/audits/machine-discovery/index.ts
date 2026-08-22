// Machine Discovery — v2 taxonomy category (Plan 3, Task 5).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

export { LlmsTxtExistsAudit } from './llms-txt-exists';
export { LlmsTxtStructureAudit } from './llms-txt-structure';
export { LlmsTxtLinkDescriptionsAudit } from './llms-txt-link-descriptions';
export { LlmsTxtLinksValidAudit } from './llms-txt-links-valid';
export { LlmsFullTxtAudit } from './llms-full-txt';
export { SitemapExistsAudit } from './sitemap-exists';
export { DiscoveryIndexCoverageAudit } from './discovery-index-coverage';
export { SitemapAbsoluteUrlsAudit } from './sitemap-absolute-urls';
export { SitemapLastmodAudit } from './sitemap-lastmod';
export { RssFeedAudit } from './rss-feed';
export { RssFeedContentAudit } from './rss-feed-content';
export { InContentLinksAudit } from './in-content-links';
export { NoBrokenLinksAudit } from './no-broken-links';
export { CorsAiFilesAudit } from './cors-ai-files';
export { AiFileDeliveryAudit } from './ai-file-delivery';
export { NoBrokenAiEndpointsAudit } from './no-broken-ai-endpoints';
// New in v2 (Plan 5): graduated from the proposal backlog on 2026-08-22.
export { AiCrawlerSurfaceReachabilityAudit } from './ai-crawler-surface-reachability';
export { SitemapLastmodVerifiabilityAudit } from './sitemap-lastmod-verifiability';
export { AgentCommerceFeedParityAudit } from './agent-commerce-feed-parity';

import { LlmsTxtExistsAudit } from './llms-txt-exists';
import { LlmsTxtStructureAudit } from './llms-txt-structure';
import { LlmsTxtLinkDescriptionsAudit } from './llms-txt-link-descriptions';
import { LlmsTxtLinksValidAudit } from './llms-txt-links-valid';
import { LlmsFullTxtAudit } from './llms-full-txt';
import { SitemapExistsAudit } from './sitemap-exists';
import { DiscoveryIndexCoverageAudit } from './discovery-index-coverage';
import { SitemapAbsoluteUrlsAudit } from './sitemap-absolute-urls';
import { SitemapLastmodAudit } from './sitemap-lastmod';
import { RssFeedAudit } from './rss-feed';
import { RssFeedContentAudit } from './rss-feed-content';
import { InContentLinksAudit } from './in-content-links';
import { NoBrokenLinksAudit } from './no-broken-links';
import { CorsAiFilesAudit } from './cors-ai-files';
import { AiFileDeliveryAudit } from './ai-file-delivery';
import { NoBrokenAiEndpointsAudit } from './no-broken-ai-endpoints';
import { AiCrawlerSurfaceReachabilityAudit } from './ai-crawler-surface-reachability';
import { SitemapLastmodVerifiabilityAudit } from './sitemap-lastmod-verifiability';
import { AgentCommerceFeedParityAudit } from './agent-commerce-feed-parity';

/** Every audit that lives in the machine-discovery category, in map order. */
export const MACHINE_DISCOVERY_AUDITS = [
  LlmsTxtExistsAudit,
  LlmsTxtStructureAudit,
  LlmsTxtLinkDescriptionsAudit,
  LlmsTxtLinksValidAudit,
  LlmsFullTxtAudit,
  SitemapExistsAudit,
  DiscoveryIndexCoverageAudit,
  SitemapAbsoluteUrlsAudit,
  SitemapLastmodAudit,
  RssFeedAudit,
  RssFeedContentAudit,
  InContentLinksAudit,
  NoBrokenLinksAudit,
  CorsAiFilesAudit,
  AiFileDeliveryAudit,
  NoBrokenAiEndpointsAudit,
  AiCrawlerSurfaceReachabilityAudit,
  SitemapLastmodVerifiabilityAudit,
  AgentCommerceFeedParityAudit,
] as const;
