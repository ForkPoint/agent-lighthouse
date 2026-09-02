/**
 * What of an evidence dossier the site publishes.
 *
 * The dossiers are an internal working record. They carry the evidence a reader
 * needs — the mechanism, the sources, the limits — interleaved with material
 * that exists to serve the build: code-review verdicts, task numbers, merge
 * narratives, review chronology. The published page answers one question, "why
 * does this audit exist, and who says so?", so the rest has to come off.
 *
 * The split is a **whitelist**, and that is the whole design. A whitelist fails
 * closed: a heading nobody anticipated stays unpublished until someone decides
 * otherwise. A blacklist fails open, and with ~50 one-off narrative headings
 * across the corpus the next new heading would leak.
 *
 * Two things the heading level alone cannot do, and this module also does:
 *
 * 1. **Labelled blocks.** `Why it matters` and `Limits` are not headings in most
 *    dossiers. They are `**Mechanism claim:**` and `**Counter-evidence:**` lines
 *    inside `## Evidence`. Both levels are addressed.
 * 2. **Supersede.** 56 dossiers carry both `## Evidence` and
 *    `## Evidence (2026-08-21)`, where the first is a placeholder sentence and
 *    the second is the research. Publishing both would put a disclaimer above
 *    the evidence that replaced it.
 */

/**
 * A fenced code block's opening or closing run. Same rule as `markdown-slice`:
 * three or more backticks or tildes, indented by at most three spaces.
 *
 * Every scan below is fence-aware. A `## ` line inside a fence is a shell
 * comment or a nested markdown example, and treating it as a section boundary
 * would silently truncate a page — the slice stays non-empty, so nothing
 * downstream could tell.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** The public name of each section, in the order the page prints them. */
export const PAGE_ORDER = [
  "What it checks",
  "Why it matters",
  "Evidence",
  "Limits",
  "How it scores",
  "Example failure",
  // Built from the registry rather than from the body: the dossier names ids,
  // and `docs/evidence/sources.json` holds the title, publisher, type and the
  // date the URL was last resolved.
  "Sources",
] as const;

export type PublicName = (typeof PAGE_ORDER)[number];

/**
 * Raw heading → public name.
 *
 * The corpus was normalised onto this vocabulary first (one rename pass across
 * 62 files), so this is a fixed list rather than a growing set of synonyms. A
 * heading absent from it is withheld unless the dossier's `public_extra` names
 * it.
 */
const PUBLIC_SECTIONS = new Map<string, PublicName>([
  ["What it checks", "What it checks"],
  ["Claimed mechanism (falsifiable)", "Why it matters"],
  ["Evidence", "Evidence"],
  ["Scoring", "How it scores"],
  ["Example failure", "Example failure"],
  // `ai-bot-directives` is the one merged dossier that names its evidence and
  // its limits after the merge rather than after the contract. The content is
  // the reader's either way, so it is mapped rather than left to `public_extra`.
  ["Per-bot evidence", "Evidence"],
  ["Counter-evidence for the merged audit", "Limits"],
]);

/** `Evidence (2026-08-21)` and friends — a public name with a date after it. */
const DATED_HEADING = /^(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/;

/**
 * Labels withheld wherever they appear.
 *
 * `Consumers` and `Recommended tier` are the project's own tier deliberation.
 * Publishing "Recommended tier: informative" beside a scored weight would read
 * as an admission rather than as evidence; the contradiction sweep exists so
 * that no such mismatch survives to be admitted.
 */
const WITHHELD_LABELS = ["Consumers", "Recommended tier"];

/** Labels promoted out of `Evidence` into their own public section. */
const PROMOTED = [
  { labels: ["Mechanism claim", "Mechanism"], into: "Why it matters" as const },
  { labels: ["Counter-evidence"], into: "Limits" as const },
];

/**
 * `**Grade: A** — this is a ratified standard …`
 *
 * The grade reasoning is the page's "how it scores", and only 70 dossiers write
 * it as a section. The other 145 write it as this label, where the grade letter
 * sits *inside* the bold run rather than before the colon, so it needs its own
 * pattern.
 */
const GRADE_LABEL = /^\*\*Grade:\s*([A-D])\*\*\s*(?:—\s*)?(.*)$/;

/** One `## ` section of a dossier. */
interface Section {
  /** The heading exactly as written, without the `## `. */
  heading: string;
  /** Its public name, or `undefined` when it is withheld. */
  publicName?: PublicName | string;
  /** The date in its heading, when it carries one — drives the supersede rule. */
  date?: string;
  /** Everything under the heading, up to the next `## `. */
  body: string;
  /** Its position in the file, the supersede tie-break. */
  index: number;
}

export interface PublicDossier {
  /** The markdown the page renders. */
  markdown: string;
  /** Public section names, in printed order. */
  published: PublicName[] | string[];
  /** Headings that did not publish, exactly as written. */
  withheld: string[];
}

/** Frontmatter overrides. Both are opt-outs from the default whitelist. */
export interface DossierOverrides {
  /** Headings to publish that the whitelist does not name. */
  publicExtra?: readonly string[];
  /** Public names to withhold on this dossier only. */
  publicOmit?: readonly string[];
  /**
   * The registry records this dossier's `sources:` ids resolve to.
   *
   * Passed in rather than read here so this module stays a pure function of its
   * markdown, which is what lets the tests run it over the corpus without a
   * registry on disk.
   */
  sources?: readonly SourceRef[];
}

/** One row of `docs/evidence/sources.json`, as the page prints it. */
export interface SourceRef {
  title: string;
  url: string;
  type: string;
  publisher: string;
  /** The date the URL was last resolved. */
  verified: string;
}

/** The `## Sources` section, one line per registry record. */
function renderSources(sources: readonly SourceRef[]): string {
  return sources
    .map(
      (source) =>
        `- [${source.title}](${source.url}) — ${source.publisher}, ${source.type} (verified ${source.verified})`,
    )
    .join("\n");
}

/** Drop a leading `---` frontmatter block, if the source still carries one. */
function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(markdown.indexOf("\n", end + 1) + 1);
}

/**
 * Split a dossier into its `## ` sections, discarding everything above the
 * first one.
 *
 * What is discarded is the `# ` working title (`agent-governance (2.28)`) and
 * the intro strip (`> crawler-permissions · source … · review verdict **fix**`).
 * Neither can be filtered as a unit — the strip mixes category and grade, which
 * belong to the reader, with review verdict and disposition, which do not — so
 * the page emits its own strip from registry metadata instead. That also fixes
 * the stale v1 category names several strips still carry.
 */
function sections(markdown: string): Section[] {
  const lines = stripFrontmatter(markdown).split("\n");
  const out: Section[] = [];
  let fence: { char: string; length: number } | null = null;
  let current: Section | null = null;
  let body: string[] = [];

  const close = () => {
    if (current) out.push({ ...current, body: body.join("\n").trim() });
    body = [];
  };

  for (const line of lines) {
    const run = FENCE.exec(line)?.[1];

    if (fence) {
      const closes =
        run !== undefined &&
        run[0] === fence.char &&
        run.length >= fence.length &&
        line.slice(line.indexOf(run) + run.length).trim() === "";
      if (closes) fence = null;
      body.push(line);
      continue;
    }

    if (run !== undefined) {
      fence = { char: run[0]!, length: run.length };
      body.push(line);
      continue;
    }

    if (line.startsWith("## ")) {
      close();
      const heading = line.slice(3).trim();
      const dated = DATED_HEADING.exec(heading);
      current = {
        heading,
        date: dated?.[2],
        publicName: PUBLIC_SECTIONS.get(dated?.[1]?.trim() ?? heading),
        index: out.length,
      } as Section;
      continue;
    }

    if (current) body.push(line);
  }

  close();
  return out;
}

/**
 * Keep one section per public name.
 *
 * The later date wins; with no dates, the later position wins. Both directions
 * matter: `## Evidence` sits *above* `## Evidence (2026-08-21)` in every file
 * that has both, and the dated one is the research.
 */
function supersede(kept: Section[]): Section[] {
  const winners = new Map<string, Section>();
  for (const section of kept) {
    const name = section.publicName!;
    const held = winners.get(name);
    if (!held) {
      winners.set(name, section);
      continue;
    }
    const better =
      section.date && held.date
        ? section.date > held.date
        : (section.date ?? "") !== (held.date ?? "")
          ? Boolean(section.date)
          : section.index > held.index;
    if (better) winners.set(name, section);
  }
  return [...winners.values()];
}

/** Strip the withheld labels from a section body, line by line. */
function filterLabels(body: string): string {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const label = /^\*\*([^:*]+):\*\*/.exec(line)?.[1]?.trim();
    // `**Consumers:** X · **Recommended tier:** Y` is one line carrying two
    // withheld labels, so dropping the line drops both.
    if (label && WITHHELD_LABELS.includes(label)) continue;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The short name of a `### Signal: <name> — grade X (domain)` heading. */
function signalName(heading: string): string | undefined {
  const signal = /^###\s+Signal:\s*(.+?)(?:\s+—\s+grade\b.*)?$/.exec(heading);
  return signal?.[1]?.trim();
}

/**
 * A signal name short enough to be a label.
 *
 * The research names a signal by describing it in full — the longest in the
 * corpus is 175 characters — and the page prints that name once as a heading and
 * again on every block promoted out of it, up to fifteen times on one dossier.
 * At that length it stops being a label and becomes a paragraph the reader has
 * to re-read on each appearance.
 *
 * The first clause is what tells two signals apart, so the name is cut at the
 * first parenthesis, dash or slash and capped. The full description is not lost:
 * it is the mechanism sentence, which the page prints under `Why it matters`.
 */
const CLAUSE_END = /\s+[(\u2014]|\s+\/\s+/;
const LABEL_CAP = 60;

/**
 * Words a truncated label must not end on.
 *
 * `Accessibility tree consumption by computer-use and\u2026` cuts on a word
 * boundary and still reads as a sentence that broke, because the last word
 * promises another one. Dropping the dangling word leaves a label that stops
 * where a label is allowed to stop.
 */
const DANGLING =
  /\s+(?:and|or|of|for|to|in|on|by|with|the|a|an|as|at|from|that|which|per|via)$/i;

function shortSignal(name: string): string {
  const head = name.split(CLAUSE_END)[0]!.trim() || name.trim();
  if (head.length <= LABEL_CAP) return head;
  // Cut on a word boundary rather than mid-word, and never leave a trailing
  // comma dangling in front of the ellipsis.
  const cut = head.slice(0, LABEL_CAP);
  const words = cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "");
  return `${words.replace(DANGLING, "")}\u2026`;
}

/**
 * Drop the falsifiability protocol from a mechanism.
 *
 * `FALSIFIABLE TEST: does any published spec define these relations, and does
 * any named agent parse them?` is the instruction the research followed. It
 * restates the mechanism above it as a question and addresses the researcher,
 * not the reader. 80 dossiers carry one.
 *
 * Scoped to the line it starts on, not to the rest of the body: the clause ends
 * the paragraph it belongs to, and a body-wide cut would take the paragraphs
 * after it too.
 */
function stripFalsifiable(line: string): string {
  return line.replace(/\s*\bFALSIFIABLE\s+(?:TEST|FORM)\b.*$/i, "").trim();
}

/** A source already stamped with the date it was last checked. */
const SOURCE_STAMP = /\s*\((?:[^()]*\b)?verified (\d{4}-\d{2}-\d{2})\)\s*$/;

/**
 * Turn a `**Sources:**` run into a list, and hoist the verification date.
 *
 * The corpus writes sources as one line of up to eleven markdown links joined by
 * `\u00b7`, each ending in its own `(verified 2026-08-20)`. Wrapped in a narrow
 * column that is an unscannable grey block, and the stamp — identical on every
 * entry of 67 of those lines — is most of its length.
 *
 * So: one bullet per source, and where every entry on the line carries the same
 * date it is stated once in the lead. Where the dates differ each entry keeps
 * its own, because then the date is telling the reader something.
 */
function compactSources(line: string): string {
  const body = /^\*\*Sources:\*\*\s*(.*)$/.exec(line)?.[1];
  if (body === undefined) return line;

  const entries = body
    .split(/\s+\u00b7\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return line;

  const dates = entries.map((entry) => SOURCE_STAMP.exec(entry)?.[1]);
  const shared =
    dates[0] && dates.every((date) => date === dates[0]) ? dates[0] : undefined;

  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const entry of entries) {
    const text = shared ? entry.replace(SOURCE_STAMP, "") : entry;
    // The same source is occasionally listed twice on one line.
    const url = /\]\((https?:\/\/[^)]+)\)/.exec(entry)?.[1] ?? text;
    if (seen.has(url)) continue;
    seen.add(url);
    bullets.push(`- ${text}`);
  }

  // The parentheses are load-bearing, not decorative: `evidence-bar.ts` proves a
  // scored page carries a `(verified <date>)` stamp, and hoisting the date out
  // of the entries has to keep that promise rather than relax the check.
  const lead = shared
    ? `**Sources** (all verified ${shared}):`
    : "**Sources:**";
  return [lead, "", ...bullets].join("\n");
}

/**
 * Put bare HTML tags in code spans.
 *
 * The research writes `<link rel="alternate" type="text/markdown">` as prose, so
 * markdown escapes it and the page prints an unstyled run of angle brackets and
 * quotes mid-sentence. 55 dossiers do this. Only tags that are already outside a
 * span are touched, and only element names — `<link>`, `<th>`, `<main>` — so a
 * comparison such as `a < b` is left alone.
 */
const BARE_TAG = /<\/?[a-z][a-z0-9]*(?:\s[^<>`]*?)?\/?>/;

/**
 * A bare HTML attribute written as prose: `rel="alternate"`.
 *
 * Markdown's smart quotes turn the straight quotes into curly ones, so the page
 * prints rel=“alternate” — which is not what a reader would type, and not what
 * the audit matches on. Wrapping the pair in a span keeps the quotes literal.
 */
const BARE_ATTRIBUTE = /\b[a-z][a-z0-9-]*="[^"`\n]*"/;

/**
 * The same wound, written with single quotes.
 *
 * The research quotes source code as prose — `@itemprop='articleBody'`,
 * `UNLIKELY_ROLES = ['menu','menubar']`, XPath axes such as `'self::article'`
 * — and markdown curls those apostrophes into \u2018 and \u2019. A reader who
 * copies the result gets a string no parser accepts.
 *
 * Only forms that cannot be ordinary prose are matched: an attribute
 * assignment, a screaming-case identifier bound to an array literal, and a
 * quoted run containing an XPath `::` axis. A bare `'menu'` is left alone,
 * because that is also how English quotes a word.
 */
const SINGLE_QUOTED_CODE =
  /@?\b[a-zA-Z_][\w.:-]*='[^'\n]{1,80}'|\b[A-Z][A-Z0-9_]{2,}\s*=\s*\[[^\]\n]{1,200}\]|'[^'\n]{0,60}::[^'\n]{0,60}'/;

/**
 * One pass, not two.
 *
 * The tag alternative comes first so a whole `<link rel="alternate">` is
 * consumed as a tag; running the two patterns in sequence instead would wrap
 * the tag, then wrap the attributes *inside* the span it had just created, and
 * the nested backticks would break the span.
 */
const BARE_CODE = new RegExp(
  `${BARE_TAG.source}|${BARE_ATTRIBUTE.source}|${SINGLE_QUOTED_CODE.source}`,
  "g",
);

/**
 * A URL written as prose rather than as a link.
 *
 * 306 evidence bullets end `— https://developers.google.com/search/docs/…
 * (verified 2026-08-21)`, and 65 more carry one mid-sentence. The URL is the
 * proof, so it cannot come off; but 90 characters of path is the widest thing
 * on the page, it forces a horizontal scroll in the narrow column, and none of
 * it is what the reader is reading.
 *
 * Trailing sentence punctuation is deliberately outside the match: `…/bots.`
 * ends a sentence, and swallowing the period into the href would break the
 * link and the sentence at once.
 *
 * The lookbehinds skip only what is already a link: `](https://…` is the href
 * of a markdown link, and `[https://…` opens its label. An opening parenthesis
 * on its own is *not* skipped — `(https://…, verified 2026-08-21)` is the
 * corpus's other citation form, and it is the one the reader trips over most.
 *
 * `+https://…` is excluded because that plus sign is robots.txt's user-agent
 * comment convention — the URL inside `GPTBot/1.4; +https://openai.com/gptbot`
 * is a literal byte of the string an operator matches on, not a citation, and
 * linking it would invite the reader to click a quoted value.
 */
const BARE_URL =
  /(?<!\]\()(?<![[+])\bhttps?:\/\/[^\s)<>\]]*[^\s)<>\].,;:!?'"]/g;

/**
 * What to call a URL the reader is not going to read.
 *
 * The host says who is speaking, which is the part that carries authority, and
 * the last path segment says which of their pages it is. The segments between
 * are elided rather than dropped silently — a label that reads
 * `docs.perplexity.ai/bots` for `/guides/bots` would be a path that does not
 * exist, and the reader has no way to tell.
 */
const LINK_LABEL_CAP = 52;

function urlLabel(url: string): string {
  let host: string;
  let path: string;
  try {
    const parsed = new URL(url);
    host = parsed.host.replace(/^www\./, "");
    path = parsed.pathname;
  } catch {
    return url;
  }
  const segments = path.split("/").filter(Boolean);
  const last = segments.at(-1);
  const label =
    last === undefined
      ? host
      : segments.length === 1
        ? `${host}/${last}`
        : `${host}/\u2026/${last}`;
  return label.length <= LINK_LABEL_CAP
    ? label
    : `${label.slice(0, LINK_LABEL_CAP - 1)}\u2026`;
}

function linkUrls(text: string): string {
  return text.replace(BARE_URL, (url) => `[${urlLabel(url)}](${url})`);
}

function fenceTags(text: string): string {
  // Split on code spans and fences, and rewrite only the parts between them.
  return text
    .split(/(`{1,3}[^`]*`{1,3})/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : linkUrls(part.replace(BARE_CODE, (hit) => `\`${hit}\``)),
    )
    .join("");
}

/**
 * Break a paragraph that has run too long into paragraphs a reader can hold.
 *
 * The research writes an evidence block as one unbroken run — the longest in
 * the corpus is 247 words, and 186 paragraphs across 117 dossiers pass 120. On
 * a page that is a wall, and the reader loses their place in it.
 *
 * Splitting is done here rather than in the dossiers because it changes no
 * words: the break goes at a sentence boundary that already existed. A boundary
 * is only taken outside code spans, outside brackets and outside quotes, so a
 * citation such as `(verified 2026-08-20)` or a quoted sentence is never cut.
 */
const TARGET_WORDS = 70;

function breakParagraph(line: string): string {
  const words = (text: string) =>
    text.trim().split(/\s+/).filter(Boolean).length;
  if (words(line) <= 120) return line;

  // `**Label** — ` opens a promoted block and stays with the first sentence.
  const sentences: string[] = [];
  let buffer = "";
  let depth = 0;
  let quoted = false;
  let ticks = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    buffer += ch;
    if (ch === "`") ticks = !ticks;
    if (ticks) continue;
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "“") quoted = true;
    else if (ch === "”") quoted = false;
    else if (ch === '"') quoted = !quoted;
    const next = line.slice(i + 1);
    const ends = /^[.?!]$/.test(ch) && /^ +[“"(]?[A-Z]/.test(next);
    if (ends && depth === 0 && !quoted) {
      sentences.push(buffer.trim());
      buffer = "";
      i++; // consume the space the boundary sits on
    }
  }
  if (buffer.trim()) sentences.push(buffer.trim());
  if (sentences.length < 2) return line;

  const out: string[] = [];
  let para = "";
  for (const sentence of sentences) {
    para = para ? `${para} ${sentence}` : sentence;
    if (words(para) >= TARGET_WORDS) {
      out.push(para);
      para = "";
    }
  }
  if (para) {
    // A short tail reads as an orphan; fold it back into the paragraph above.
    if (out.length > 0 && words(para) < 25) out[out.length - 1] += ` ${para}`;
    else out.push(para);
  }
  return out.join("\n\n");
}

/**
 * Every compaction that applies to a body, whatever section it ends up in.
 *
 * Fence-aware by construction: `fenceTags` skips code spans, and the callers
 * apply this per line outside fenced blocks.
 */
function compact(body: string): string {
  const out: string[] = [];
  let fence: { char: string; length: number } | null = null;

  for (const line of body.split("\n")) {
    const run = FENCE.exec(line)?.[1];
    if (fence) {
      if (
        run !== undefined &&
        run[0] === fence.char &&
        run.length >= fence.length &&
        line.slice(line.indexOf(run) + run.length).trim() === ""
      ) {
        fence = null;
      }
      out.push(line);
      continue;
    }
    if (run !== undefined) {
      fence = { char: run[0]!, length: run.length };
      out.push(line);
      continue;
    }

    // `### Signal: <175 characters> — grade C (llms-txt)` becomes `### <label>`.
    // The grade is in the page's metadata card and the domain is an internal
    // grouping key, so both come off with the prefix.
    const signal = signalName(line);
    if (line.startsWith("### ") && signal) {
      out.push(`### ${fenceTags(shortSignal(signal))}`);
      continue;
    }

    if (line.startsWith("**Sources:**")) {
      out.push(compactSources(line));
      continue;
    }

    // `**Evidence:**` under a heading that already says Evidence, on 92 pages.
    const text = stripFalsifiable(line.replace(/^\*\*Evidence:\*\*\s*/, ""));
    // A line that was nothing but the protocol clause leaves no paragraph.
    if (line.trim() && !text) continue;
    out.push(breakParagraph(fenceTags(text)));
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Pull one family of labelled blocks out of a body into its own section.
 *
 * A dossier can carry several researched signals, each with its own mechanism
 * and its own counter-evidence. Merging them into one paragraph would lose
 * which claim belongs to which signal, so each promoted block keeps the name of
 * the `### Signal:` heading it came from — but only when there is more than
 * one, since a single-signal dossier reads better without the label.
 */
function promote(
  body: string,
  labels: readonly string[],
): { promoted: string; rest: string } {
  const lines = body.split("\n");
  const taken: Array<{ signal?: string; text: string }> = [];
  const rest: string[] = [];
  let signal: string | undefined;
  let fence: { char: string; length: number } | null = null;

  for (const line of lines) {
    const run = FENCE.exec(line)?.[1];
    if (fence) {
      if (
        run !== undefined &&
        run[0] === fence.char &&
        run.length >= fence.length &&
        line.slice(line.indexOf(run) + run.length).trim() === ""
      ) {
        fence = null;
      }
      rest.push(line);
      continue;
    }
    if (run !== undefined) {
      fence = { char: run[0]!, length: run.length };
      rest.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      signal = signalName(line);
      rest.push(line);
      continue;
    }

    const label = /^\*\*([^:*]+):\*\*\s*(.*)$/.exec(line);
    if (label && labels.includes(label[1]!.trim())) {
      taken.push({ signal, text: label[2]!.trim() });
      continue;
    }
    rest.push(line);
  }

  const named =
    taken.filter((entry) => entry.signal).length > 0 && taken.length > 1;
  const promoted = taken
    .filter((entry) => entry.text.length > 0)
    .map((entry) =>
      named && entry.signal
        ? `**${shortSignal(entry.signal)}** — ${entry.text}`
        : entry.text,
    )
    .join("\n\n");

  return {
    promoted,
    rest: rest
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

/**
 * Pull the `**Grade: X** — reasoning` lines out of a body.
 *
 * Kept separate from `promote` because the grade letter is already printed in
 * the page's own metadata strip, so republishing "Grade: A" would say it twice.
 * Only the reasoning is promoted.
 */
function promoteGrade(body: string): { promoted: string; rest: string } {
  const taken: Array<{ signal?: string; text: string }> = [];
  const rest: string[] = [];
  let signal: string | undefined;
  let fence: { char: string; length: number } | null = null;

  for (const line of body.split("\n")) {
    const run = FENCE.exec(line)?.[1];
    if (fence) {
      if (
        run !== undefined &&
        run[0] === fence.char &&
        run.length >= fence.length &&
        line.slice(line.indexOf(run) + run.length).trim() === ""
      ) {
        fence = null;
      }
      rest.push(line);
      continue;
    }
    if (run !== undefined) {
      fence = { char: run[0]!, length: run.length };
      rest.push(line);
      continue;
    }
    if (line.startsWith("### ")) {
      signal = signalName(line);
      rest.push(line);
      continue;
    }
    const grade = GRADE_LABEL.exec(line);
    if (grade && grade[2]!.trim()) {
      // The source reads `**Grade: A** — this is a ratified standard …`, so the
      // reasoning is written to continue a sentence the page no longer prints.
      const reasoning = grade[2]!.trim();
      taken.push({
        signal,
        text: reasoning[0]!.toUpperCase() + reasoning.slice(1),
      });
      continue;
    }
    rest.push(line);
  }

  const named =
    taken.filter((entry) => entry.signal).length > 0 && taken.length > 1;
  const promoted = taken
    .map((entry) =>
      named && entry.signal
        ? `**${shortSignal(entry.signal)}** — ${entry.text}`
        : entry.text,
    )
    .join("\n\n");
  return {
    promoted,
    rest: rest
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

/**
 * The public markdown of one dossier, and the accounting of what was withheld.
 *
 * The accounting is not decoration: it is what a test asserts against, so that a
 * new internal heading cannot start publishing itself and a public section
 * cannot quietly disappear.
 */
export function publicDossier(
  markdown: string,
  overrides: DossierOverrides = {},
): PublicDossier {
  const extra = new Set(overrides.publicExtra ?? []);
  const omit = new Set(overrides.publicOmit ?? []);

  const all = sections(markdown);
  const withheld: string[] = [];
  const candidates: Section[] = [];

  for (const section of all) {
    // `public_extra` names the heading as written, because the whole point is
    // that the whitelist has no public name for it.
    if (extra.has(section.heading)) {
      candidates.push({ ...section, publicName: section.heading });
      continue;
    }
    if (section.publicName && !omit.has(section.publicName)) {
      candidates.push(section);
      continue;
    }
    withheld.push(section.heading);
  }

  const winners = supersede(candidates);
  for (const section of candidates) {
    if (!winners.includes(section)) withheld.push(section.heading);
  }

  const byName = new Map(
    winners.map((section) => [section.publicName as string, section]),
  );
  const bodies = new Map<string, string>();
  for (const [name, section] of byName)
    bodies.set(name, filterLabels(section.body));

  // Promotion runs only where the dossier has no section of its own for the
  // target. 68 dossiers write the mechanism as a heading; the other 145 write
  // it as a label inside the evidence, and the reader must meet it either way.
  const evidence = bodies.get("Evidence");
  if (evidence !== undefined) {
    let rest = evidence;
    for (const { labels, into } of PROMOTED) {
      if (bodies.has(into) || omit.has(into)) continue;
      const result = promote(rest, labels);
      if (!result.promoted) continue;
      bodies.set(into, result.promoted);
      rest = result.rest;
    }
    if (!bodies.has("How it scores") && !omit.has("How it scores")) {
      const grade = promoteGrade(rest);
      if (grade.promoted) {
        bodies.set("How it scores", grade.promoted);
        rest = grade.rest;
      }
    }
    bodies.set("Evidence", rest);
  }

  // The registry's records, appended as the last contract section.
  if (overrides.sources?.length && !omit.has("Sources")) {
    bodies.set("Sources", renderSources(overrides.sources));
  }

  const order = [
    ...PAGE_ORDER.filter((name) => bodies.has(name)),
    // Anything `public_extra` added keeps its file order, after the contract.
    ...winners
      .filter((section) => extra.has(section.heading))
      .sort((a, b) => a.index - b.index)
      .map((section) => section.heading),
  ];

  const published: string[] = [];
  const parts: string[] = [];
  for (const name of order) {
    // Compaction runs last, on whatever each section ended up holding, so a
    // block promoted out of the evidence is normalised the same way as the
    // evidence it came from.
    const body = compact(bodies.get(name) ?? "");
    // A section that filtered down to nothing is not published as an empty
    // heading — that reads as a gap rather than as an omission.
    if (!body) continue;
    published.push(name);
    parts.push(`## ${name}\n\n${body}`);
  }

  return { markdown: parts.join("\n\n"), published, withheld };
}
