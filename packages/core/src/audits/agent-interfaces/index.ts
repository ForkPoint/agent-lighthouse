// Agent Interfaces — v2 taxonomy category (Plan 3, Task 8).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

export { OpenApiExistsAudit } from './openapi-exists';
export { OpenApiEndpointsAudit } from './openapi-endpoints';
export { OpenApiOperationIdsAudit } from './openapi-operation-ids';
export { OpenApiServersAudit } from './openapi-servers';
export { OpenApiSchemasAudit } from './openapi-schemas';
export { AiCatalogExistsAudit } from './ai-catalog-exists';
export { AiCatalogMetadataAudit } from './ai-catalog-metadata';
export { AiCatalogUrlsAudit } from './ai-catalog-urls';
export { AgentsJsonAudit } from './agents-json';
export { McpDiscoveryAudit } from './mcp-discovery';
export { McpEndpointAudit } from './mcp-endpoint';
export { SearchEndpointAudit } from './search-endpoint';
export { WebmcpRegisteredToolsAudit } from './webmcp-registered-tools';
export { WebmcpDeclarativeFormsAudit } from './webmcp-declarative-forms';
export { OpenApiDescriptionQualityAudit } from './openapi-description-quality';
export { CorsApiRoutesAudit } from './cors-api-routes';

// New in v2 (Plan 5): graduated from the MCP proposal set on 2026-08-22.
export { McpModernEraReachabilityAudit } from './mcp-modern-era-reachability';

import { OpenApiExistsAudit } from './openapi-exists';
import { OpenApiEndpointsAudit } from './openapi-endpoints';
import { OpenApiOperationIdsAudit } from './openapi-operation-ids';
import { OpenApiServersAudit } from './openapi-servers';
import { OpenApiSchemasAudit } from './openapi-schemas';
import { AiCatalogExistsAudit } from './ai-catalog-exists';
import { AiCatalogMetadataAudit } from './ai-catalog-metadata';
import { AiCatalogUrlsAudit } from './ai-catalog-urls';
import { AgentsJsonAudit } from './agents-json';
import { McpDiscoveryAudit } from './mcp-discovery';
import { McpEndpointAudit } from './mcp-endpoint';
import { SearchEndpointAudit } from './search-endpoint';
import { WebmcpRegisteredToolsAudit } from './webmcp-registered-tools';
import { WebmcpDeclarativeFormsAudit } from './webmcp-declarative-forms';
import { OpenApiDescriptionQualityAudit } from './openapi-description-quality';
import { CorsApiRoutesAudit } from './cors-api-routes';
import { McpModernEraReachabilityAudit } from './mcp-modern-era-reachability';

/** Every audit that lives in the agent-interfaces category, in map order. */
export const AGENT_INTERFACES_AUDITS = [
  OpenApiExistsAudit,
  OpenApiEndpointsAudit,
  OpenApiOperationIdsAudit,
  OpenApiServersAudit,
  OpenApiSchemasAudit,
  AiCatalogExistsAudit,
  AiCatalogMetadataAudit,
  AiCatalogUrlsAudit,
  AgentsJsonAudit,
  McpDiscoveryAudit,
  McpEndpointAudit,
  SearchEndpointAudit,
  WebmcpRegisteredToolsAudit,
  WebmcpDeclarativeFormsAudit,
  OpenApiDescriptionQualityAudit,
  CorsApiRoutesAudit,
  McpModernEraReachabilityAudit,
] as const;
