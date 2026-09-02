// Agentic Commerce — v2 taxonomy category (Plan 3, Task 9).
// Order mirrors docs/evidence/audit-map.json so Task 11 can consume the list verbatim.
// Thin on purpose: only three v1 rows map here (the commerce halves of Product schema).
// The bulk of the category arrives with the ACP proposal set in packages/core/src/audits/proposed.

export { OfferSchemaAudit } from "./offer-schema";
export { ProductIdentifiersAudit } from "./product-identifiers";
export { ProductTransactionCertaintyAudit } from "./product-transaction-certainty";
export { BuyableVariantResolutionAudit } from "./buyable-variant-resolution";
export { CartHandoffReachabilityAudit } from "./cart-handoff-reachability";
export { OfferTruthConsistencyAudit } from "./offer-truth-consistency";

// New in v2 (Plan 5): graduated from the proposal backlog on 2026-08-22.
export { AcpPolicyLinkSurfaceAudit } from "./acp-policy-link-surface";
export { LandedCostAndReturnsAudit } from "./landed-cost-and-returns";
export { CheckoutOfferFieldMappingAudit } from "./checkout-offer-field-mapping";
export { AgentUaCommerceParityAudit } from "./agent-ua-commerce-parity";

import { OfferSchemaAudit } from "./offer-schema";
import { ProductIdentifiersAudit } from "./product-identifiers";
import { ProductTransactionCertaintyAudit } from "./product-transaction-certainty";
import { BuyableVariantResolutionAudit } from "./buyable-variant-resolution";
import { CartHandoffReachabilityAudit } from "./cart-handoff-reachability";
import { OfferTruthConsistencyAudit } from "./offer-truth-consistency";
import { AcpPolicyLinkSurfaceAudit } from "./acp-policy-link-surface";
import { LandedCostAndReturnsAudit } from "./landed-cost-and-returns";
import { CheckoutOfferFieldMappingAudit } from "./checkout-offer-field-mapping";
import { AgentUaCommerceParityAudit } from "./agent-ua-commerce-parity";

/** Every audit that lives in the agentic-commerce category, in map order. */
export const AGENTIC_COMMERCE_AUDITS = [
  OfferSchemaAudit,
  ProductIdentifiersAudit,
  ProductTransactionCertaintyAudit,
  AcpPolicyLinkSurfaceAudit,
  LandedCostAndReturnsAudit,
  CheckoutOfferFieldMappingAudit,
  AgentUaCommerceParityAudit,
  BuyableVariantResolutionAudit,
  CartHandoffReachabilityAudit,
  OfferTruthConsistencyAudit,
] as const;
