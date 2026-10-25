import { describe, it, expect } from "vitest";
import { parseContentSignals } from "./content-signals";
import { directiveLines, parseRobots } from "./robots";

describe("Content Signals parser", () => {
  it("preserves multiple agents, extension boundaries, paths, comments and line endings", () => {
    const body =
      "\uFEFFUser-agent: A\r\nUser-agent: B\r\nContent-Signal: /Blog/ search=yes # note\r\nUser-agent: C\r\nContent-Signal: /blog/ ai-train=no\r\n";
    const result = parseContentSignals(body);
    expect(
      result.declarations.map(({ agent, path, line }) => [agent, path, line]),
    ).toEqual([
      ["A", "/Blog/", 3],
      ["B", "/Blog/", 3],
      ["C", "/blog/", 5],
    ]);
    expect(parseRobots(body).map((group) => group.userAgent)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
  it("retains empty values and valid neighbors with precise faults", () => {
    const result = parseContentSignals(
      "User-agent: *\nContent-Signal: search=yes, ai-input=, ai-train=no, search, ai-input=yes=no\nContent-Signal:\n",
    );
    expect(result.diagnostics).toHaveLength(4);
    expect(result.diagnostics[0]).toContain("Line 2");
    expect(
      result.declarations[0]?.entries
        .filter((entry) => entry.valid)
        .map((entry) => entry.name),
    ).toEqual(["search", "ai-train"]);
    expect(directiveLines("Content-Signal:", "content-signal")[0]?.value).toBe(
      "",
    );
  });
  it("accepts documented extensions and retains unknown vocabulary", () => {
    const result = parseContentSignals(
      "Content-Signal: use=reference, custom=unknown, ai-input=no",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.declarations[0]?.entries[0]?.known).toBe(false);
  });
  it("distinguishes redundant from conflicting exact-scope declarations", () => {
    const result = parseContentSignals(
      "Content-Signal: ai-train=no, ai-train=no, ai-train=yes\nContent-Signal: /Blog/ ai-train=no\nContent-Signal: /blog/ ai-train=yes",
    );
    expect(result.repeats).toHaveLength(2);
    expect(result.repeats[0]).toContain("Duplicate");
    expect(result.repeats[1]).toContain("Conflicting");
  });
  it("does not treat comments as declarations", () => {
    expect(
      parseContentSignals("# Content-Signal: search=yes").declarations,
    ).toEqual([]);
  });
  it("ends groups after empty extension values", () => {
    const body =
      "User-agent: A\nX-Extension:\nUser-agent: B\nContent-Signal: search=yes";
    expect(
      directiveLines(body, "content-signal").map((line) => line.group),
    ).toEqual(["B"]);
    expect(parseRobots(body).map((group) => group.userAgent)).toEqual([
      "A",
      "B",
    ]);
  });
});

it("deduplicates case-insensitive agents on each physical directive", () => {
  const parsed = parseContentSignals(
    "User-agent: Bot\nUser-agent: BOT\nContent-Signal: search=yes\nContent-Signal: search=yes",
  );
  expect(parsed.declarations).toHaveLength(2);
  expect(parsed.repeats).toHaveLength(1);
  expect(parsed.repeats[0]).toContain("Line 4");
});

it("declines oversized input before truncation can hide declarations", () => {
  const parsed = parseContentSignals(
    "#" + "x".repeat(500 * 1024) + "\nContent-Signal: search=no",
  );
  expect(parsed.complete).toBe(false);
  expect(parsed.declarations).toEqual([]);
  expect(parsed.limitation).toContain("500 KiB");
});

it("bounds agent-field expansion before materializing directives", () => {
  const body =
    Array.from({ length: 100 }, (_, i) => `User-agent: Bot${i}`).join("\n") +
    "\n" +
    "Content-Signal: search=yes\n".repeat(100);
  const parsed = parseContentSignals(body);
  expect(parsed.complete).toBe(false);
  expect(parsed.declarations).toEqual([]);
  expect(parsed.limitation).toContain("4096");
});

it("bounds expanded text even when agent-field counts fit", () => {
  const body =
    "User-agent: Bot\n".repeat(100) +
    "Content-Signal: custom=" +
    "x".repeat(100000);
  const parsed = parseContentSignals(body);
  expect(parsed.complete).toBe(false);
  expect(parsed.limitation).toContain("expanded-text");
});
