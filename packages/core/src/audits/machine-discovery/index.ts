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
export { InternalLinkingAudit } from './in-content-links';
export { NoBrokenLinksAudit } from './no-broken-links';
export { RssFeedLinkAudit } from './rss-feed-link';
export { CorsAiFilesAudit } from './cors-ai-files';
export { CorrectContentTypesAudit } from './ai-file-delivery';
export { CacheHeadersAudit } from './cache-headers';
export { NoBrokenAiEndpointsAudit } from './no-broken-ai-endpoints';
export { InternalCrossLinkingAudit } from './internal-cross-linking';

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
import { InternalLinkingAudit } from './in-content-links';
import { NoBrokenLinksAudit } from './no-broken-links';
import { RssFeedLinkAudit } from './rss-feed-link';
import { CorsAiFilesAudit } from './cors-ai-files';
import { CorrectContentTypesAudit } from './ai-file-delivery';
import { CacheHeadersAudit } from './cache-headers';
import { NoBrokenAiEndpointsAudit } from './no-broken-ai-endpoints';
import { InternalCrossLinkingAudit } from './internal-cross-linking';

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
  InternalLinkingAudit,
  NoBrokenLinksAudit,
  RssFeedLinkAudit,
  CorsAiFilesAudit,
  CorrectContentTypesAudit,
  CacheHeadersAudit,
  NoBrokenAiEndpointsAudit,
  InternalCrossLinkingAudit,
] as const;
