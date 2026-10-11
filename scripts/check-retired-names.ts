/**
 * Fails when user-facing documentation still names a retired page type as
 * if it were current: `--page-type content`, `pageType: "content"`, or a
 * list such as "page types such as content, product". The type checker and
 * the input schemas refuse these names in code; prose has no such guard.
 *
 * The retired names come from `LEGACY_PAGE_TYPES`, so the next retirement is
 * covered without editing this script. Only the shapes above are matched:
 * "content" and "unknown" are ordinary English words, and the check must not
 * flag a sentence that uses them as words.
 *
 * Scope is what a reader of the product sees: the READMEs, top-level
 * `docs/*.md`, the website source and the agent plugin, without tests or
 * saved JSON reports. Design records, ledgers and dossier review notes
 * describe the old names on purpose.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { LEGACY_PAGE_TYPES } from "#core/types";

const SCOPE = [
  "README.md",
  "packages/*/README.md",
  "docs/*.md",
  "packages/website/src/**",
  "plugins/**",
];

const names = Object.keys(LEGACY_PAGE_TYPES).join("|");
const PATTERNS: Array<{ shape: string; re: RegExp }> = [
  {
    shape: "--page-type value",
    re: new RegExp(String.raw`--page-type[ =]+["'\x60]?(${names})\b`, "i"),
  },
  {
    shape: "page-type field value",
    re: new RegExp(
      String.raw`\b(pageTypes?|applicablePageTypes|page_type)["']?\s*[:=][^\n]{0,40}["'\x60](${names})["'\x60]`,
      "i",
    ),
  },
  {
    shape: "page-type list",
    re: new RegExp(
      String.raw`\bpage[- ]types?\b[^.\n]{0,60}\b(${names})\b\s*(,|\bor\b|\band\b)`,
      "i",
    ),
  },
];

const files = execFileSync("git", ["ls-files", "--", ...SCOPE], {
  encoding: "utf8",
})
  .split("\n")
  // Tests and saved JSON reports carry old names on purpose: reports written
  // before the retirement still read.
  .filter((f) => f !== "" && !/\.test\.tsx?$|\.json$/.test(f))
  // `docs/*.md` is a pathspec glob that also matches subfolders.
  .filter((f) => !f.startsWith("docs/") || f.split("/").length === 2);

const hits: string[] = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { shape, re } of PATTERNS)
      if (re.test(line))
        hits.push(`${file}:${i + 1}: ${shape}: ${line.trim()}`);
  });
}

if (hits.length > 0) {
  console.error(
    `Retired page type named in user-facing docs (${Object.keys(LEGACY_PAGE_TYPES).join(", ")}):`,
  );
  for (const hit of hits) console.error(`  ${hit}`);
  console.error(
    "\nName the current page type instead. See LEGACY_PAGE_TYPES in packages/core/src/types.ts.",
  );
  process.exit(1);
}
console.log(`check:retired-names OK (${files.length} files)`);
