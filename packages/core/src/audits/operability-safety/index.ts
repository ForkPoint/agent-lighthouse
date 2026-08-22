// Operability & Safety — v2 taxonomy category (Plan 3, Task 10).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.
//
// The category absorbs all of v1 `agent-tools` (form action surfaces), all of v1
// `accessibility` (accessibility-tree semantics an agent reads before it acts) and
// the security-header rump of v1 `technical-readiness`. Those three v1 categories
// no longer exist.

// Form action surfaces (from v1 agent-tools).
export { ContactFormAudit } from './contact-form';
export { NoBlockingCaptchaAudit } from './no-blocking-captcha';
export { FormsNoJsAudit } from './forms-no-js';
export { WebmcpInputQualityAudit } from './webmcp-input-quality';
export { FormActionabilityAudit } from './form-actionability';

// Hand-rolled (cheerio) markup audits — no equivalent rule in the a11y engine.
export { AriaLandmarksAudit } from './aria-landmarks';
export { NavAriaLabelAudit } from './nav-aria-label';
export { FormErrorMessagesAudit } from './form-error-messages';

// Engine-backed audits (accessibility-tree semantics that AI agents read),
// powered by the a11y rule engine. They still share one module: the per-audit
// file split is Plan 4 work (§6 of the map), not Plan 3's.
export {
  A11Y_RULES,
  A11yLandmarkUniqueAudit,
  A11yFormLabelsAudit,
  A11yAccessibleNamesAudit,
  A11yDialogNameAudit,
  A11yAriaHiddenBodyAudit,
  A11yAriaRolesAudit,
  A11yAriaAttributesAudit,
  A11yAriaRelationshipsAudit,
  A11yDuplicateIdAudit,
  A11yAutocompleteAudit,
  A11yNestedInteractiveAudit,
  A11yTableHeadersAudit,
  A11yDocumentTitleAudit,
  A11yFrameTitleAudit,
  A11yMetaRefreshAudit,
  A11yTabindexAudit,
  A11yPresentationConflictAudit,
} from './_a11y';

// Security headers (from v1 technical-readiness) — all four consolidate into
// operability-safety/security-header-hygiene in Plan 4.
export { HstsHeaderAudit } from './hsts-header';
export { CspHeaderAudit } from './csp-header';
export { ContentTypeOptionsAudit } from './content-type-options';
export { SecurityTxtAudit } from './security-txt';

import { ContactFormAudit } from './contact-form';
import { NoBlockingCaptchaAudit } from './no-blocking-captcha';
import { FormsNoJsAudit } from './forms-no-js';
import { WebmcpInputQualityAudit } from './webmcp-input-quality';
import { FormActionabilityAudit } from './form-actionability';
import { AriaLandmarksAudit } from './aria-landmarks';
import { NavAriaLabelAudit } from './nav-aria-label';
import { FormErrorMessagesAudit } from './form-error-messages';
import {
  A11yLandmarkUniqueAudit,
  A11yFormLabelsAudit,
  A11yAccessibleNamesAudit,
  A11yDialogNameAudit,
  A11yAriaHiddenBodyAudit,
  A11yAriaRolesAudit,
  A11yAriaAttributesAudit,
  A11yAriaRelationshipsAudit,
  A11yDuplicateIdAudit,
  A11yAutocompleteAudit,
  A11yNestedInteractiveAudit,
  A11yTableHeadersAudit,
  A11yDocumentTitleAudit,
  A11yFrameTitleAudit,
  A11yMetaRefreshAudit,
  A11yTabindexAudit,
  A11yPresentationConflictAudit,
} from './_a11y';
import { HstsHeaderAudit } from './hsts-header';
import { CspHeaderAudit } from './csp-header';
import { ContentTypeOptionsAudit } from './content-type-options';
import { SecurityTxtAudit } from './security-txt';

/** Every audit that lives in the operability-safety category, in map order. */
export const OPERABILITY_SAFETY_AUDITS = [
  ContactFormAudit,
  NoBlockingCaptchaAudit,
  FormsNoJsAudit,
  WebmcpInputQualityAudit,
  FormActionabilityAudit,
  AriaLandmarksAudit,
  NavAriaLabelAudit,
  A11yLandmarkUniqueAudit,
  A11yFormLabelsAudit,
  FormErrorMessagesAudit,
  A11yAccessibleNamesAudit,
  A11yDialogNameAudit,
  A11yAriaHiddenBodyAudit,
  A11yAriaRolesAudit,
  A11yAriaAttributesAudit,
  A11yAriaRelationshipsAudit,
  A11yDuplicateIdAudit,
  A11yAutocompleteAudit,
  A11yNestedInteractiveAudit,
  A11yTableHeadersAudit,
  A11yDocumentTitleAudit,
  A11yFrameTitleAudit,
  A11yMetaRefreshAudit,
  A11yTabindexAudit,
  A11yPresentationConflictAudit,
  HstsHeaderAudit,
  CspHeaderAudit,
  ContentTypeOptionsAudit,
  SecurityTxtAudit,
] as const;
