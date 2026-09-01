import { describe, it, expect } from "vitest";
import {
  normalizeText,
  shingles,
  jaccard,
  sentences,
  wordCount,
} from "./text-metrics";

describe("text-metrics", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeText("  Hello,   WORLD!  ")).toBe("hello world");
  });

  it("counts words of the normalized text", () => {
    expect(wordCount("Hello, world!")).toBe(2);
    expect(wordCount("   ")).toBe(0);
  });

  // A short paragraph must still be able to match itself across two pages.
  it("returns one shingle for text shorter than the window", () => {
    expect([...shingles("two words")]).toEqual(["two words"]);
  });

  it("returns overlapping shingles for longer text", () => {
    const set = shingles("one two three four five six", 5);
    expect(set.size).toBe(2);
    expect(set.has("one two three four five")).toBe(true);
    expect(set.has("two three four five six")).toBe(true);
  });

  it("treats two empty sets as identical and disjoint sets as unrelated", () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("splits sentences without splitting an abbreviation or a decimal", () => {
    expect(sentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
    expect(sentences("Use a tool, e.g. this one. Then stop.")).toEqual([
      "Use a tool, e.g. this one.",
      "Then stop.",
    ]);
    expect(sentences("It costs 3.50 today.")).toEqual(["It costs 3.50 today."]);
  });
});
