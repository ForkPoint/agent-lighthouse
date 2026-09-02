// Structured Data — v2 taxonomy category (Plan 3, Task 6).
// STRUCTURED_DATA_AUDITS order mirrors docs/evidence/audit-map.json so Task 11 can consume the
// list verbatim.

export { JsonLdPresentAudit } from "./json-ld-present";
export { SchemaValidationAudit } from "./schema-validation";
export { OrganizationSchemaAudit } from "./organization-schema";
export { BreadcrumbSchemaAudit } from "./breadcrumb-schema";
export { ArticleSchemaAudit } from "./article-schema";
export { FaqPageSchemaAudit } from "./faqpage-schema";
export { ServiceSchemaAudit } from "./service-schema";
export { SpeakableSchemaAudit } from "./speakable-schema";
export { HowToSchemaAudit } from "./howto-schema";
export { LocalBusinessSchemaAudit } from "./local-business-schema";
export { ReviewSchemaAudit } from "./review-schema";
export { AuthorSchemaAudit } from "./author-schema";
export { ProductDetailsAudit } from "./advanced-product-details";

// New in v2 (Plan 5): graduated from the proposal backlog on 2026-08-22.
export { ClaimreviewAdvisoryAudit } from "./claimreview-advisory";

import { JsonLdPresentAudit } from "./json-ld-present";
import { SchemaValidationAudit } from "./schema-validation";
import { OrganizationSchemaAudit } from "./organization-schema";
import { BreadcrumbSchemaAudit } from "./breadcrumb-schema";
import { ArticleSchemaAudit } from "./article-schema";
import { FaqPageSchemaAudit } from "./faqpage-schema";
import { ServiceSchemaAudit } from "./service-schema";
import { SpeakableSchemaAudit } from "./speakable-schema";
import { HowToSchemaAudit } from "./howto-schema";
import { LocalBusinessSchemaAudit } from "./local-business-schema";
import { ReviewSchemaAudit } from "./review-schema";
import { AuthorSchemaAudit } from "./author-schema";
import { ProductDetailsAudit } from "./advanced-product-details";
import { ClaimreviewAdvisoryAudit } from "./claimreview-advisory";

/** Every audit that lives in the structured-data category, in map order. */
export const STRUCTURED_DATA_AUDITS = [
  JsonLdPresentAudit,
  SchemaValidationAudit,
  OrganizationSchemaAudit,
  BreadcrumbSchemaAudit,
  ArticleSchemaAudit,
  FaqPageSchemaAudit,
  ServiceSchemaAudit,
  SpeakableSchemaAudit,
  HowToSchemaAudit,
  LocalBusinessSchemaAudit,
  ReviewSchemaAudit,
  AuthorSchemaAudit,
  ProductDetailsAudit,
  ClaimreviewAdvisoryAudit,
] as const;
