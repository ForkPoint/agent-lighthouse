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

// Engine-backed audits (accessibility-tree semantics that AI agents read),
// powered by the a11y rule engine. One audit = one file; the shared base class,
// the `graded()` meta helper and the A11Y_RULES accumulator live in ./_shared.
export { LandmarkUniqueAudit } from './landmark-unique';
export { LabelAudit } from './label';
// Hand-rolled too, but the map orders it here (between 7.5 and 7.7).
export { FormErrorMessagesAudit } from './form-error-messages';
export { AccessibleNamesAudit } from './accessible-names';
export { DialogNameAudit } from './dialog-name';
export { AriaHiddenBodyAudit } from './aria-hidden-body';
export { AriaRolesAudit } from './aria-roles';
export { AriaAttributesAudit } from './aria-attributes';
export { AriaRelationshipsAudit } from './aria-relationships';
export { DuplicateIdAudit } from './duplicate-id';
export { AutocompleteAudit } from './autocomplete';
export { NestedInteractiveAudit } from './nested-interactive';
export { TableHeadersAudit } from './table-headers';
export { DocumentTitleAudit } from './document-title';
export { FrameTitleAudit } from './frame-title';
export { MetaRefreshAudit } from './meta-refresh';
export { TabindexAudit } from './tabindex';
export { PresentationConflictAudit } from './presentation-conflict';

// Security headers (from v1 technical-readiness) — all four consolidate into
// operability-safety/security-header-hygiene in Plan 4.
export { HstsHeaderAudit } from './hsts-header';
export { CspHeaderAudit } from './csp-header';
export { ContentTypeOptionsAudit } from './content-type-options';
export { SecurityTxtAudit } from './security-txt';

// Not an audit: the rule-id list the orchestrator feeds to the engine. It is
// only complete once every engine-backed audit module has been evaluated — this
// barrel imports them all, so importing it is enough.
export { A11Y_RULES } from './_shared';

import { ContactFormAudit } from './contact-form';
import { NoBlockingCaptchaAudit } from './no-blocking-captcha';
import { FormsNoJsAudit } from './forms-no-js';
import { WebmcpInputQualityAudit } from './webmcp-input-quality';
import { FormActionabilityAudit } from './form-actionability';
import { AriaLandmarksAudit } from './aria-landmarks';
import { NavAriaLabelAudit } from './nav-aria-label';
import { LandmarkUniqueAudit } from './landmark-unique';
import { LabelAudit } from './label';
import { FormErrorMessagesAudit } from './form-error-messages';
import { AccessibleNamesAudit } from './accessible-names';
import { DialogNameAudit } from './dialog-name';
import { AriaHiddenBodyAudit } from './aria-hidden-body';
import { AriaRolesAudit } from './aria-roles';
import { AriaAttributesAudit } from './aria-attributes';
import { AriaRelationshipsAudit } from './aria-relationships';
import { DuplicateIdAudit } from './duplicate-id';
import { AutocompleteAudit } from './autocomplete';
import { NestedInteractiveAudit } from './nested-interactive';
import { TableHeadersAudit } from './table-headers';
import { DocumentTitleAudit } from './document-title';
import { FrameTitleAudit } from './frame-title';
import { MetaRefreshAudit } from './meta-refresh';
import { TabindexAudit } from './tabindex';
import { PresentationConflictAudit } from './presentation-conflict';
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
  LandmarkUniqueAudit,
  LabelAudit,
  FormErrorMessagesAudit,
  AccessibleNamesAudit,
  DialogNameAudit,
  AriaHiddenBodyAudit,
  AriaRolesAudit,
  AriaAttributesAudit,
  AriaRelationshipsAudit,
  DuplicateIdAudit,
  AutocompleteAudit,
  NestedInteractiveAudit,
  TableHeadersAudit,
  DocumentTitleAudit,
  FrameTitleAudit,
  MetaRefreshAudit,
  TabindexAudit,
  PresentationConflictAudit,
  HstsHeaderAudit,
  CspHeaderAudit,
  ContentTypeOptionsAudit,
  SecurityTxtAudit,
] as const;
