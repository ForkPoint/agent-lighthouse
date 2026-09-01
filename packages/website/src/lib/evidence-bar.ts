/**
 * The bar an audit must clear before its page ships as scored.
 *
 * `docs/evidence/policy.md` already says what counts as proof and what each
 * grade is allowed to do to a score. This is the same rule made enforceable at
 * the moment a page is generated: a scored audit whose dossier cannot show its
 * work stops the build rather than publishing a claim the reader cannot check.
 *
 * The bar applies to the **published** slice, not to the file on disk. That is
 * deliberate — the reader sees the slice, so the question is whether what they
 * see carries its own evidence, not whether something upstairs in the working
 * record did.
 *
 * Informative and experimental audits are held to the first three rules only.
 * They carry weight 0, so no site's score depends on them, and the honest thing
 * for a signal with no documented consumer is to say so rather than to be
 * suppressed.
 */

/**
 * The published page, as the loader stored it.
 *
 * Deliberately *not* `PublicDossier`: by the time a page is generated the
 * collection body is already the slice, and re-slicing it would find none of
 * its own public names in the whitelist and withhold everything. The section
 * names are read back off the markdown instead.
 */
export interface PublishedPage {
  markdown: string;
  published: string[];
}

/** The `## ` headings of already-sliced markdown — its published sections. */
export function publishedSections(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}

/**
 * A source line that names when it was last checked.
 *
 * The corpus writes the stamp two ways and both are honest: `(verified
 * 2026-08-21)` on a `**Sources:**` link, and `(vendor-doc, URL verified
 * 2026-08-20)` on a bulleted evidence entry. What matters is that a date is
 * attached to the act of checking, not which of the two spellings carries it.
 */
const VERIFIED = /\((?:[^()]*\b)?verified \d{4}-\d{2}-\d{2}\)/;

/**
 * A source a reader can open.
 *
 * Both spellings count. `**Sources:**` lines use markdown links; the evidence
 * bullets end a quote with a bare `— https://…` instead, and a reader can open
 * either.
 */
const URL_LINK = /(?:\]\(https?:\/\/|(?:^|\s)https?:\/\/\S)/;

export interface BarSubject {
  /** `<category>/<slug>`, for the error message. */
  id: string;
  /** The registry tier. Only `scored` is held to the full bar. */
  tier: string;
  /** The frontmatter grade, which must match the registry's. */
  dossierGrade: string;
  /** The registry grade. */
  registryGrade: string;
}

/**
 * Every way one dossier can fail the bar, as reader-facing sentences.
 *
 * Returned rather than thrown so the build can report all of them at once. A
 * gate that stops at the first failure turns a corpus sweep into a queue.
 */
export function barViolations(
  subject: BarSubject,
  page: PublishedPage,
): string[] {
  const problems: string[] = [];
  const has = (name: string) => page.published.includes(name);

  // Rules 1-3 apply to every audit, at any tier. A page that cannot say what it
  // looks for, why that matters, and on whose evidence, has nothing to publish.
  if (subject.dossierGrade !== subject.registryGrade) {
    problems.push(
      `frontmatter grade ${subject.dossierGrade} does not match the registry's ${subject.registryGrade}`,
    );
  }
  if (!has("What it checks"))
    problems.push('publishes no "What it checks" section');
  if (!has("Why it matters")) {
    problems.push(
      "publishes no mechanism — add a `## Claimed mechanism (falsifiable)` section or a `**Mechanism:**` line",
    );
  }
  if (!has("Evidence")) problems.push('publishes no "Evidence" section');

  if (subject.tier !== "scored") return problems;

  // Rules 4-6 are the price of taking weight off a site's score.
  if (!URL_LINK.test(page.markdown)) {
    problems.push("is scored but cites no source a reader can open");
  }
  if (!VERIFIED.test(page.markdown)) {
    problems.push(
      "is scored but no source carries a `(verified <date>)` stamp",
    );
  }
  if (!has("How it scores")) {
    problems.push(
      "is scored but publishes no grade reasoning — add a `## Scoring` section or a `**Grade: X** — …` line",
    );
  }
  return problems;
}

/**
 * Hold the whole corpus to the bar, and fail the build with every violation.
 *
 * Called from the dossier route, next to `crossCheck`, because that is the one
 * build step that turns the registry into public pages.
 */
export function enforceEvidenceBar(
  entries: Array<{ subject: BarSubject; page: PublishedPage }>,
): void {
  const failures = entries
    .map(({ subject, page }) => ({
      id: subject.id,
      problems: barViolations(subject, page),
    }))
    .filter((entry) => entry.problems.length > 0);
  if (failures.length === 0) return;

  const detail = failures
    .map((entry) => `  ${entry.id}: ${entry.problems.join("; ")}`)
    .join("\n");
  throw new Error(
    `${failures.length} dossier(s) fall short of the evidence bar in docs/evidence/policy.md:\n${detail}\n\n` +
      "Either write the missing evidence, or drop the audit to informative — which is what the policy already requires.",
  );
}
