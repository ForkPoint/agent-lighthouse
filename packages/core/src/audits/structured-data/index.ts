// Structured Data — v2 taxonomy category (Plan 3, Task 6).
// STRUCTURED_DATA_AUDITS order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the
// list verbatim. The three audits exported below it (offer-schema, product-identifiers,
// product-transaction-certainty) still live in this folder but leave for agentic-commerce in a
// later task, so they are deliberately not on the list.

export { JsonLdPresentAudit } from './json-ld-present';
export { SchemaValidationAudit } from './schema-validation';
export { OrganizationSchemaAudit } from './organization-schema';
export { BreadcrumbSchemaAudit } from './breadcrumb-schema';
export { ArticleSchemaAudit } from './article-schema';
export { FaqPageSchemaAudit } from './faqpage-schema';
export { ServiceProductSchemaAudit } from './service-product-schema';
export { SpeakableSchemaAudit } from './speakable-schema';
export { HowToSchemaAudit } from './howto-schema';
export { LocalBusinessSchemaAudit } from './local-business-schema';
export { ReviewSchemaAudit } from './review-schema';
export { AuthorSchemaAudit } from './author-schema';
export { ProductDetailsAudit } from './advanced-product-details';
export { ProductReviewsAudit } from './product-reviews';

// Still registered here, moving to another v2 category in a later task.
export { OfferSchemaAudit } from './offer-schema';
export { ProductIdentifiersAudit } from './product-identifiers';
export { ProductTransactionCertaintyAudit } from './product-transaction-certainty';

import { JsonLdPresentAudit } from './json-ld-present';
import { SchemaValidationAudit } from './schema-validation';
import { OrganizationSchemaAudit } from './organization-schema';
import { BreadcrumbSchemaAudit } from './breadcrumb-schema';
import { ArticleSchemaAudit } from './article-schema';
import { FaqPageSchemaAudit } from './faqpage-schema';
import { ServiceProductSchemaAudit } from './service-product-schema';
import { SpeakableSchemaAudit } from './speakable-schema';
import { HowToSchemaAudit } from './howto-schema';
import { LocalBusinessSchemaAudit } from './local-business-schema';
import { ReviewSchemaAudit } from './review-schema';
import { AuthorSchemaAudit } from './author-schema';
import { ProductDetailsAudit } from './advanced-product-details';
import { ProductReviewsAudit } from './product-reviews';

/** Every audit that lives in the structured-data category, in map order. */
export const STRUCTURED_DATA_AUDITS = [
  JsonLdPresentAudit,
  SchemaValidationAudit,
  OrganizationSchemaAudit,
  BreadcrumbSchemaAudit,
  ArticleSchemaAudit,
  FaqPageSchemaAudit,
  ServiceProductSchemaAudit,
  SpeakableSchemaAudit,
  HowToSchemaAudit,
  LocalBusinessSchemaAudit,
  ReviewSchemaAudit,
  AuthorSchemaAudit,
  ProductDetailsAudit,
  ProductReviewsAudit,
] as const;
