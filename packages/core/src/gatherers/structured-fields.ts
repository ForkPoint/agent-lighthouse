/**
 * Header field parsers shared by the licensing and AI-preference audits.
 *
 * Two grammars, both of which several Wave C audits would otherwise each
 * approximate with a regular expression: RFC 8941 structured-field
 * dictionaries, which AIPREF's `Content-Usage` is written in, and RFC 8288
 * `Link` headers, which carry both the RSL licence pointer and the WebSub hub.
 */

/** One parsed member of a structured-field dictionary. */
export type DictionaryValue = string;

export type DictionaryResult =
  | { ok: true; value: Map<string, DictionaryValue> }
  | { ok: false; error: string };

/** RFC 8941 key: lowercase alpha or `*` first, then alphanumerics and `_-.*`. */
const KEY = /^[a-z*][a-z0-9_\-.*]*$/;

/** RFC 8941 token: alpha or `*` first, then token characters. */
const TOKEN = /^[a-zA-Z*][a-zA-Z0-9!#$%&'*+\-.^_`|~:/]*$/;

/**
 * Parse the RFC 8941 dictionary subset AIPREF uses.
 *
 * Members are `key=token`, `key=?0`/`key=?1`, or a bare key, which is boolean
 * true. Parameters after a `;` are accepted and dropped — no AIPREF category
 * defines one, and silently keeping them would invite an audit to read a
 * parameter as a value. Anything outside that subset is an error with a reason,
 * never a partially parsed dictionary: a caller reporting a syntax error must
 * be able to say what was wrong with the line.
 */
export function parseDictionary(input: string): DictionaryResult {
  const value = new Map<string, DictionaryValue>();
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value };

  for (const rawMember of trimmed.split(",")) {
    const member = rawMember.split(";")[0]!.trim();
    if (member === "") return { ok: false, error: "empty dictionary member" };

    const eq = member.indexOf("=");
    const key = (eq === -1 ? member : member.slice(0, eq)).trim();
    if (!KEY.test(key))
      return { ok: false, error: `"${key}" is not a valid dictionary key` };

    if (eq === -1) {
      value.set(key, "?1");
      continue;
    }
    const raw = member.slice(eq + 1).trim();
    if (raw === "") return { ok: false, error: `"${key}" has no value` };
    if (raw === "?0" || raw === "?1") {
      value.set(key, raw);
      continue;
    }
    if (raw.startsWith('"')) {
      return {
        ok: false,
        error: `"${key}" carries a string; AIPREF values are tokens`,
      };
    }
    if (!TOKEN.test(raw))
      return { ok: false, error: `"${raw}" is not a valid token` };
    value.set(key, raw);
  }
  return { ok: true, value };
}

/** One `Link` header entry: its target and its parameters, parameter names lowercased. */
export interface LinkHeaderEntry {
  href: string;
  params: Record<string, string>;
}

/**
 * Parse an RFC 8288 `Link` header into its entries.
 *
 * Splits on commas that sit outside angle brackets and outside quoted strings,
 * which is what stops a `title="a, b"` parameter from inventing an entry.
 */
export function parseLinkHeader(header: string): LinkHeaderEntry[] {
  const entries: LinkHeaderEntry[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  const pieces: string[] = [];

  for (let i = 0; i < header.length; i += 1) {
    const ch = header[i]!;
    if (ch === '"' && header[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && ch === "<") depth += 1;
    if (!quoted && ch === ">") depth -= 1;
    if (ch === "," && depth <= 0 && !quoted) {
      pieces.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  pieces.push(current);

  for (const piece of pieces) {
    const match = /^\s*<([^>]*)>\s*(.*)$/.exec(piece);
    if (!match) continue;
    const params: Record<string, string> = {};
    for (const param of match[2]!.split(";")) {
      const eq = param.indexOf("=");
      if (eq === -1) continue;
      const name = param.slice(0, eq).trim().toLowerCase();
      const raw = param.slice(eq + 1).trim();
      if (name === "") continue;
      params[name] = raw.replace(/^"(.*)"$/, "$1");
    }
    entries.push({ href: match[1]!.trim(), params });
  }
  return entries;
}

/** An entry whose `rel` token list contains `rel`, compared case-insensitively. */
export function linksWithRel(header: string, rel: string): LinkHeaderEntry[] {
  return parseLinkHeader(header).filter((entry) =>
    (entry.params["rel"] ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes(rel.toLowerCase()),
  );
}
