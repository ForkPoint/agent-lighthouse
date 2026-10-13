import { EvidenceKey } from "./contracts";

/**
 * Reviewed individually against each source and dossier. No category implies eligibility.
 * Every entry keeps the readable-text gate its crawler path has: a consent wall,
 * error page or empty shell captured as "complete" must not prove absence.
 */
export const SNAPSHOT_AUDITS: Readonly<
  Record<string, { requires: readonly EvidenceKey[]; evidence: string }>
> = {
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
