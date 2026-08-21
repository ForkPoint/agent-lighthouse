// Hand-rolled (cheerio) accessibility audits — agent-readiness checks that have
// no equivalent rule in the a11y rule engine.
export { AriaLandmarksAudit } from './aria-landmarks';
export { NavAriaLabelAudit } from './nav-aria-label';
export { FormErrorMessagesAudit } from './form-error-messages';

// Engine-backed audits (accessibility-tree semantics that AI agents read),
// powered by the a11y rule engine. The
// name/label/landmark audits (7.4/7.5/7.7/7.9) replace the former hand-rolled
// MultipleNav/FormLabels/AccessibleNames/IconLabels/ModalDialog audits.
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
