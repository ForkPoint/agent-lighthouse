import { describe, expect, it } from "vitest";
import { sseFrame } from "./sse";

describe("sseFrame", () => {
  it("writes id, event and one data line", () => {
    expect(sseFrame("progress", 7, { a: 1 })).toBe(
      'id: 7\nevent: progress\ndata: {"a":1}\n\n',
    );
  });

  it("never lets a newline inside data split the frame", () => {
    expect(sseFrame("progress", 1, { s: "a\nb" })).toBe(
      'id: 1\nevent: progress\ndata: {"s":"a\\nb"}\n\n',
    );
  });
});
