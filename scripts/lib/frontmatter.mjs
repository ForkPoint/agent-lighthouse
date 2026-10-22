/**
 * Extract top-level scalar keys from a Markdown YAML frontmatter block.
 * Deliberately minimal: dossier frontmatter is flat `key: value` pairs, so a
 * full YAML parser would only add a dependency for no gain.
 *
 * @param {string} source raw file contents
 * @returns {Record<string, string> | null} parsed keys, or null when the file has no frontmatter
 */
export function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, "");
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;

  const body = text.slice(text.indexOf("\n") + 1, end + 1);
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of body.split("\n")) {
    // Skip blank lines, comments, and nested/list entries.
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    if (
      rawLine.startsWith(" ") ||
      rawLine.startsWith("\t") ||
      rawLine.startsWith("-")
    )
      continue;
    const sep = rawLine.indexOf(":");
    if (sep === -1) continue;
    const key = rawLine.slice(0, sep).trim();
    let value = rawLine.slice(sep + 1).trim();
    // Strip a trailing inline comment only when the value is unquoted.
    if (!/^["']/.test(value)) value = value.replace(/\s+#.*$/, "").trim();
    value = value.replace(/^["'](.*)["']$/, "$1");
    out[key] = value;
  }
  return out;
}
