import { EvidenceKey } from "./contracts";

/** One reviewed browser-view entry. */
export interface SnapshotAuditEntry {
  requires: readonly EvidenceKey[];
  evidence: string;
  /**
   * The audit reads `PageContext.a11yResults`. When the capture's a11y rule pass
   * yields nothing, the audit would read "not applicable"; the snapshot path
   * records missing evidence instead, because a failed pass proves no absence.
   */
  a11yRules?: true;
}

const A11Y_TREE =
  "Accessibility rules over the serialized DOM, the tree browser agents read; not a computed accessibility tree, and no action is executed.";
const DOM_ONLY = [EvidenceKey.RenderedBody] as const;
const a11y = (evidence = A11Y_TREE): SnapshotAuditEntry => ({
  requires: DOM_ONLY,
  evidence,
  a11yRules: true,
});
const dom = (evidence: string): SnapshotAuditEntry => ({
  requires: DOM_ONLY,
  evidence,
});

/**
 * Reviewed individually against each source and dossier. No category implies eligibility.
 * An entry needs DOM-only evidence, a one-page verdict, and a dossier whose grade rests on
 * a browser-agent consumer (docs/superpowers/specs/2026-10-20-browser-view-audits-design.md).
 * Every entry keeps the readable-text gate its crawler path has: a consent wall,
 * error page or empty shell captured as "complete" must not prove absence.
 */
export const SNAPSHOT_AUDITS: Readonly<Record<string, SnapshotAuditEntry>> = {
  "content-extraction/image-alt-text": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Serialized image text alternatives; not a computed accessibility tree.",
  },
  "content-extraction/section-headings": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Serialized section headings and label attributes; not computed appearance.",
  },
  "content-extraction/semantic-lists": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Readable DOM list and definition markup, with the existing static hiding rules.",
  },
  "structured-data/json-ld-present": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Parsed JSON-LD in this DOM only; no crawler delivery or citation claim.",
  },
  "structured-data/schema-validation": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Existing context/type checks over parsed JSON-LD, Microdata and RDFa; not full JSON-LD conformance.",
  },
  "operability-safety/form-autofill-token-coverage": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Serialized field labels, identifiers, types, constraints and autofill tokens; no filling or submission execution.",
  },
  "operability-safety/profile-autofill-token-coverage": {
    requires: [EvidenceKey.RenderedBody],
    evidence:
      "Serialized field labels, identifiers, types, constraints and autofill tokens; no filling or submission execution.",
  },
  "operability-safety/aria-landmarks": dom(
    "Serialized landmark elements and roles; not a computed accessibility tree.",
  ),
  "operability-safety/form-actionability": dom(
    "Serialized controls, labels and autocomplete tokens; no filling or submission execution.",
  ),
  "operability-safety/native-control-substitution": dom(
    "Serialized native and custom control markup; no widget is opened or operated.",
  ),
  "operability-safety/accessible-names": a11y(),
  "operability-safety/aria-attributes": a11y(),
  "operability-safety/aria-hidden-body": a11y(),
  "operability-safety/aria-relationships": a11y(),
  "operability-safety/aria-roles": a11y(),
  "operability-safety/dialog-name": a11y(),
  "operability-safety/duplicate-id": a11y(),
  "operability-safety/label": a11y(),
  "operability-safety/landmark-unique": a11y(),
  "operability-safety/nested-interactive": a11y(),
  "operability-safety/presentation-conflict": a11y(),
};

export const SNAPSHOT_EVIDENCE_LIMITS = [
  "Client-provided HTML and capture conditions are unverified assertions, not HTTP evidence.",
  "HTML serialization cannot establish computed appearance or a complete accessibility tree. Static hidden attributes and inline styles are the only available visibility evidence.",
  "HTML serialization cannot establish event handlers, frame content, shadow roots, or live form state. Attributes may differ from current control properties.",
  "Neither current-tab nor fresh-browser metadata establishes login independence. A current tab does not prove fresh-browser access.",
  "HTML serialization cannot establish that a control works, a task succeeds, or action success. No action is executed.",
  "No page script, event handler, stylesheet, frame, image or other snapshot resource is executed or fetched.",
];

/** The one eligibility test. Callers never consult SNAPSHOT_AUDITS keys directly. */
export function isSnapshotAudit(id: string): boolean {
  return Object.hasOwn(SNAPSHOT_AUDITS, id);
}
