import { directiveLines } from "./robots";

export const ContentSignalName = {
  Search: "search",
  AiInput: "ai-input",
  AiTrain: "ai-train",
} as const;
export type ContentSignalName =
  (typeof ContentSignalName)[keyof typeof ContentSignalName];
export const ContentSignalValue = { Yes: "yes", No: "no" } as const;
export type ContentSignalValue =
  (typeof ContentSignalValue)[keyof typeof ContentSignalValue];
export const CONTENT_SIGNAL_NAMES = Object.values(ContentSignalName);

export interface ContentSignalEntry {
  name: string;
  value: string;
  known: boolean;
  valid: boolean;
}
export interface ContentSignalDeclaration {
  agent: string;
  path: string;
  line: number;
  raw: string;
  entries: ContentSignalEntry[];
}

/** Conservative limits apply before directiveLines expands agent groups. */
function analysisLimit(body: string): string | undefined {
  if (
    body.length > 500 * 1024 ||
    new TextEncoder().encode(body).length > 500 * 1024
  )
    return "robots.txt exceeds the 500 KiB analysis limit.";
  let agents = 0;
  let fields = 0;
  let signalCharacters = 0;
  for (const line of body.split(/\r\n?|\n/)) {
    const content = line.replace(/#.*$/, "").trim();
    if (/^user-agent\s*:/i.test(content)) agents += 1;
    if (/^content-signal\s*:/i.test(content)) {
      const fieldCount = content.split(",").length;
      fields += fieldCount;
      // Scope and source text can repeat in each field's diagnostics and keys.
      signalCharacters += content.length * fieldCount;
    }
    if (Math.max(1, agents) * signalCharacters > 4 * 1024 * 1024)
      return "robots.txt exceeds the conservative 4 Mi-character expanded-text limit.";
    if (Math.max(1, agents) * fields > 4096)
      return "robots.txt exceeds the conservative 4096 agent-field expansion limit.";
  }
  return undefined;
}

/** Parse declarations without resolving undocumented duplicate or scope precedence. */
export function parseContentSignals(body: string): {
  declarations: ContentSignalDeclaration[];
  diagnostics: string[];
  repeats: string[];
  managed: boolean;
  complete: boolean;
  limitation?: string;
} {
  const limitation = analysisLimit(body);
  if (limitation)
    return {
      declarations: [],
      diagnostics: [],
      repeats: [],
      managed: false,
      complete: false,
      limitation,
    };
  const diagnostics: string[] = [];
  const repeats: string[] = [];
  const declarations: ContentSignalDeclaration[] = [];
  const seen = new Map<string, { value: string; line: number }>();
  const physicalAgents = new Set<string>();
  for (const line of directiveLines(body, "content-signal")) {
    const identity = JSON.stringify([
      line.line,
      (line.group || "*").toLowerCase(),
    ]);
    if (physicalAgents.has(identity)) continue;
    physicalAgents.add(identity);
    let value = line.value;
    let path = "/";
    if (value.startsWith("/")) {
      const scoped = /^(\/\S*)(?:\s+(.*))?$/.exec(value);
      path = scoped?.[1] ?? value;
      value = scoped?.[2] ?? "";
    }
    const agent = line.group || "*";
    const entries: ContentSignalEntry[] = [];
    for (const piece of value.split(",")) {
      const parts = piece.split("=");
      const name = (parts[0] ?? "").trim().toLowerCase();
      const rawValue = (parts[1] ?? "").trim();
      const known = CONTENT_SIGNAL_NAMES.some((key) => key === name);
      let fault = "";
      if (parts.length !== 2) fault = "expected exactly one equals sign";
      else if (!name || !rawValue) fault = "empty name or value";
      else if (
        known &&
        rawValue !== ContentSignalValue.Yes &&
        rawValue !== ContentSignalValue.No
      )
        fault = `${name} requires yes or no`;
      else if (
        name === "use" &&
        !["immediate", "reference", "full"].includes(rawValue)
      )
        fault = "use test extension requires immediate, reference or full";
      if (fault)
        diagnostics.push(
          `Line ${line.line}, bot ${agent}, path ${path}: ${fault} (${piece.trim() || "empty declaration"})`,
        );
      const valid = !fault;
      entries.push({ name, value: rawValue, known, valid });
      if (!valid) continue;
      const key = JSON.stringify([agent.toLowerCase(), path, name]);
      const previous = seen.get(key);
      if (previous)
        repeats.push(
          `Line ${line.line}, bot ${agent}, path ${path}: ${previous.value === rawValue ? "Duplicate" : "Conflicting"} ${name} declarations (line ${previous.line}: ${previous.value}; line ${line.line}: ${rawValue}); no precedence inferred.`,
        );
      else seen.set(key, { value: rawValue, line: line.line });
    }
    declarations.push({
      agent,
      path,
      line: line.line,
      raw: line.value,
      entries,
    });
  }
  return {
    complete: true,
    declarations,
    diagnostics,
    repeats,
    managed:
      /^\s*#\s*BEGIN Cloudflare Managed content\s*$/im.test(body) &&
      /^\s*#\s*END Cloudflare Managed content\s*$/im.test(body),
  };
}
