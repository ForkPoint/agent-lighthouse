// Access & Crawl Control — v2 taxonomy category (Plan 3, Task 3).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

export { NoNofollowAudit } from './no-nofollow';
export { NoRedirectChainsAudit } from './no-redirect-chains';
// One audit in the place of the two canonical checks (v1 1.17 + 4.3).
export { CanonicalLinksAudit } from './canonical';
export { GptbotAudit } from './gptbot';
export { GoogleExtendedAudit } from './google-extended';
export { AnthropicAudit } from './anthropic-ai';
export { PerplexitybotAudit } from './perplexitybot';
export { ApplebotExtendedAudit } from './applebot-extended';
export { CcbotAudit } from './ccbot';
export { MetaExternalAgentAudit } from './meta-external-agent';
export { AmazonbotAudit } from './amazonbot';
// One audit in the place of the five low-signal per-bot checks (v1 2.9–2.13).
export { AiBotDirectivesAudit } from './ai-bot-directives';
export { ChatgptUserAudit } from './chatgpt-user';
export { ClaudeUserAudit } from './claude-user';
export { OaiSearchbotAudit } from './oai-searchbot';
export { MetaExternalFetcherAudit } from './meta-external-fetcher';
export { BravebotAudit } from './bravebot';
export { DuckassistbotAudit } from './duckassistbot';
export { MistralaiUserAudit } from './mistralai-user';
export { ClaudeSearchbotAudit } from './claude-searchbot';
export { NoBlanketBlockAudit } from './no-blanket-block';
export { SensitivePathsAudit } from './sensitive-paths';
export { CrawlDelayAudit } from './crawl-delay';
// One audit in the place of the three robots-directive checks (v1 2.25 + 1.13 + 4.20).
export { MetaRobotsNotBlockingAudit } from './robots-directives';
export { NoBotDetectionAudit } from './no-bot-detection';
export { TdmRepAudit } from './tdm-rep';
export { AgentGovernanceAudit } from './agent-governance';
export { AiContentDeclarationAudit } from './ai-content-declaration';
export { HttpsEnabledAudit } from './https-enabled';

import { NoNofollowAudit } from './no-nofollow';
import { NoRedirectChainsAudit } from './no-redirect-chains';
import { CanonicalLinksAudit } from './canonical';
import { GptbotAudit } from './gptbot';
import { GoogleExtendedAudit } from './google-extended';
import { AnthropicAudit } from './anthropic-ai';
import { PerplexitybotAudit } from './perplexitybot';
import { ApplebotExtendedAudit } from './applebot-extended';
import { CcbotAudit } from './ccbot';
import { MetaExternalAgentAudit } from './meta-external-agent';
import { AmazonbotAudit } from './amazonbot';
import { AiBotDirectivesAudit } from './ai-bot-directives';
import { ChatgptUserAudit } from './chatgpt-user';
import { ClaudeUserAudit } from './claude-user';
import { OaiSearchbotAudit } from './oai-searchbot';
import { MetaExternalFetcherAudit } from './meta-external-fetcher';
import { BravebotAudit } from './bravebot';
import { DuckassistbotAudit } from './duckassistbot';
import { MistralaiUserAudit } from './mistralai-user';
import { ClaudeSearchbotAudit } from './claude-searchbot';
import { NoBlanketBlockAudit } from './no-blanket-block';
import { SensitivePathsAudit } from './sensitive-paths';
import { CrawlDelayAudit } from './crawl-delay';
import { MetaRobotsNotBlockingAudit } from './robots-directives';
import { NoBotDetectionAudit } from './no-bot-detection';
import { TdmRepAudit } from './tdm-rep';
import { AgentGovernanceAudit } from './agent-governance';
import { AiContentDeclarationAudit } from './ai-content-declaration';
import { HttpsEnabledAudit } from './https-enabled';

/** Every audit that lives in the access-crawl-control category, in map order. */
export const ACCESS_CRAWL_CONTROL_AUDITS = [
  NoNofollowAudit,
  NoRedirectChainsAudit,
  CanonicalLinksAudit,
  GptbotAudit,
  GoogleExtendedAudit,
  AnthropicAudit,
  PerplexitybotAudit,
  ApplebotExtendedAudit,
  CcbotAudit,
  MetaExternalAgentAudit,
  AmazonbotAudit,
  AiBotDirectivesAudit,
  ChatgptUserAudit,
  ClaudeUserAudit,
  OaiSearchbotAudit,
  MetaExternalFetcherAudit,
  BravebotAudit,
  DuckassistbotAudit,
  MistralaiUserAudit,
  ClaudeSearchbotAudit,
  NoBlanketBlockAudit,
  SensitivePathsAudit,
  CrawlDelayAudit,
  MetaRobotsNotBlockingAudit,
  NoBotDetectionAudit,
  TdmRepAudit,
  AgentGovernanceAudit,
  AiContentDeclarationAudit,
  HttpsEnabledAudit,
] as const;
