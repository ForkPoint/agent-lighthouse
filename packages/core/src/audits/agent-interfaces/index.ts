// Agent Interfaces — v2 taxonomy category (Plan 3, Task 8).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

export { AiCatalogLinkAudit } from './ai-catalog-link';
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
export { McpCapabilitiesAudit } from './mcp-capabilities';
export { SearchEndpointAudit } from './search-endpoint';
export { WebmcpManifestAudit } from './webmcp-registered-tools';
export { WebmcpDeclarativeFormsAudit } from './webmcp-declarative-forms';
export { WebmcpToolNamingAudit } from './webmcp-tool-naming';
export { WebmcpToolAnnotationsAudit } from './webmcp-tool-annotations';
export { OpenApiDescriptionQualityAudit } from './openapi-description-quality';
export { CorsApiRoutesAudit } from './cors-api-routes';

import { AiCatalogLinkAudit } from './ai-catalog-link';
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
import { McpCapabilitiesAudit } from './mcp-capabilities';
import { SearchEndpointAudit } from './search-endpoint';
import { WebmcpManifestAudit } from './webmcp-registered-tools';
import { WebmcpDeclarativeFormsAudit } from './webmcp-declarative-forms';
import { WebmcpToolNamingAudit } from './webmcp-tool-naming';
import { WebmcpToolAnnotationsAudit } from './webmcp-tool-annotations';
import { OpenApiDescriptionQualityAudit } from './openapi-description-quality';
import { CorsApiRoutesAudit } from './cors-api-routes';

/** Every audit that lives in the agent-interfaces category, in map order. */
export const AGENT_INTERFACES_AUDITS = [
  AiCatalogLinkAudit,
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
  McpCapabilitiesAudit,
  SearchEndpointAudit,
  WebmcpManifestAudit,
  WebmcpDeclarativeFormsAudit,
  WebmcpToolNamingAudit,
  WebmcpToolAnnotationsAudit,
  OpenApiDescriptionQualityAudit,
  CorsApiRoutesAudit,
] as const;
