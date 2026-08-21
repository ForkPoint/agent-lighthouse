import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Unicode Covert-Channel Scan".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/unicode-covert-channel-scan.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Decode the response with the declared charset. Strip <script>/<style> bodies, then walk every
// text node plus these attribute values: alt, title, aria-label, aria-description, placeholder,
// value, content, data-*, and percent-decoded href/src. Classify: (1) any codepoint in
// U+E0000–U+E007F => FAIL, no legitimate web use exists; decode the run (codepoint - 0xE0000) to
// ASCII and print it. (2) Unbalanced U+202A–U+202E / U+2066–U+2069 pushes vs pops in a node =>
// FAIL; balanced pairs co-occurring with actual RTL script in the same node => PASS. (3)
// U+200B/200C/200D/2060/FEFF occurring mid-word and not adjacent to an emoji ZWJ sequence or
// Indic/Arabic script => WARN, and FAIL above 20 occurrences per page. (4) Runs of U+00AD or Hangul
// filler characters inside Latin words => WARN. Apply the same scanner to robots.txt, llms.txt,
// sitemap.xml, and every JSON-LD string value — those files are ingested by agents with high trust
// and are rarely visually reviewed. Output should be copy-paste-safe (escape the payload as \uXXXX
// in the report).
export class UnicodeCovertChannelScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/unicode-covert-channel-scan',
    category: 'injection-safety',
    title: "Unicode Covert-Channel Scan",
    failureTitle: "Unicode Covert-Channel Scan",
    description: "Scan all rendered text and attribute values for codepoints that carry information invisibly: the Unicode Tags block (U+E0000–U+E007F), bidirectional overrides/isolates (U+202A–U+202E, U+2066–U+2069), zero-width and filler characters (U+200B–U+200D, U+2060, U+FEFF, U+00AD, U+115F, U+1160, U+3164, U+FFA0). Decode any tag-block run back to ASCII and show the owner the invisible sentence sitting on their page.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Tag-block codepoints mirror ASCII and, per Unicode, render as nothing in tag-unaware implementations, while modern LLM tokenizers process them — so a full instruction can ride inside text that no human, and no visual QA pass, can see. Bidi controls make the rendered order differ from the logical order that a text-extracting agent reads (the Trojan Source class, CVE-2021-42574). Zero-width characters defeat naive defensive substring matching on both the site's side and the agent's side. Falsifier: if the page's DOM text and its rendered text are codepoint-identical modulo whitespace and legitimate script-shaping, no covert channel exists.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/unicode-covert-channel-scan.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/unicode-covert-channel-scan.md',
      'TODO stub',
    );
  }
}
