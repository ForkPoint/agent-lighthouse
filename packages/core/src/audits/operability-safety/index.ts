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
export { FormActionabilityAudit } from './form-actionability';

// Hand-rolled (cheerio) markup audits — no equivalent rule in the a11y engine.
export { AriaLandmarksAudit } from './aria-landmarks';

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

// Security headers (from v1 technical-readiness): hsts-header (8.2),
// csp-header (8.3), content-type-options (8.4) and security-txt (8.7)
// consolidated into this one informative audit in Plan 4, Task 3.
export { SecurityHeaderHygieneAudit } from './security-header-hygiene';

// New in v2 (Plan 5): graduated from the proposal backlog on 2026-08-22.
export { FormAutofillTokenCoverageAudit } from './form-autofill-token-coverage';
export { NativeControlSubstitutionAudit } from './native-control-substitution';
export { InvisibleInstructionScanAudit } from './invisible-instruction-scan';
export { AriaLayerInjectionScanAudit } from './aria-layer-injection-scan';
export { GhostClickableElementRatioAudit } from './ghost-clickable-element-ratio';
export { StatefulControlIntrospectabilityAudit } from './stateful-control-introspectability';

// Not an audit: the rule-id list the orchestrator feeds to the engine. It is
// only complete once every engine-backed audit module has been evaluated — this
// barrel imports them all, so importing it is enough.
export { A11Y_RULES } from './_shared';

import { ContactFormAudit } from './contact-form';
import { NoBlockingCaptchaAudit } from './no-blocking-captcha';
import { FormsNoJsAudit } from './forms-no-js';
import { FormActionabilityAudit } from './form-actionability';
import { AriaLandmarksAudit } from './aria-landmarks';
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
import { SecurityHeaderHygieneAudit } from './security-header-hygiene';
import { FormAutofillTokenCoverageAudit } from './form-autofill-token-coverage';
import { NativeControlSubstitutionAudit } from './native-control-substitution';
import { InvisibleInstructionScanAudit } from './invisible-instruction-scan';
import { AriaLayerInjectionScanAudit } from './aria-layer-injection-scan';
import { GhostClickableElementRatioAudit } from './ghost-clickable-element-ratio';
import { StatefulControlIntrospectabilityAudit } from './stateful-control-introspectability';

/** Every audit that lives in the operability-safety category, in map order. */
export const OPERABILITY_SAFETY_AUDITS = [
  ContactFormAudit,
  NoBlockingCaptchaAudit,
  FormsNoJsAudit,
  FormActionabilityAudit,
  AriaLandmarksAudit,
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
  SecurityHeaderHygieneAudit,
  FormAutofillTokenCoverageAudit,
  NativeControlSubstitutionAudit,
  InvisibleInstructionScanAudit,
  AriaLayerInjectionScanAudit,
  GhostClickableElementRatioAudit,
  StatefulControlIntrospectabilityAudit,
] as const;
