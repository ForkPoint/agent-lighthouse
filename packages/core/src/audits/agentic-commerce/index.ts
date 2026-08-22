// Agentic Commerce — v2 taxonomy category (Plan 3, Task 9).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.
// Thin on purpose: only three v1 rows map here (the commerce halves of Product schema).
// The bulk of the category arrives with the ACP proposal set in packages/core/src/audits/proposed.

export { OfferSchemaAudit } from './offer-schema';
export { ProductIdentifiersAudit } from './product-identifiers';
export { ProductTransactionCertaintyAudit } from './product-transaction-certainty';

import { OfferSchemaAudit } from './offer-schema';
import { ProductIdentifiersAudit } from './product-identifiers';
import { ProductTransactionCertaintyAudit } from './product-transaction-certainty';

/** Every audit that lives in the agentic-commerce category, in map order. */
export const AGENTIC_COMMERCE_AUDITS = [
  OfferSchemaAudit,
  ProductIdentifiersAudit,
  ProductTransactionCertaintyAudit,
] as const;
