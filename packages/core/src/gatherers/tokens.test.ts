import { describe, it, expect } from "vitest";
import { countTokens, tokenBudget } from "./tokens";

describe("tokens", () => {
  it("counts empty text as nothing", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts ordinary prose as a small positive number", () => {
    const count = countTokens("hello world");
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  // The claim the data-URI audit makes, measured rather than asserted.
  it("costs far more for a base64 run than for the URL that would replace it", () => {
    const base64 =
      "A".repeat(50) + "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=".repeat(6);
    const url = "/img/logo.png";
    expect(countTokens(base64)).toBeGreaterThan(countTokens(url) * 5);
  });

  it("reports a budget per named part", () => {
    const budget = tokenBudget({
      script: "const a = 1;",
      text: "Hello there, reader.",
    });
    expect(budget["script"]).toBeGreaterThan(0);
    expect(budget["text"]).toBeGreaterThan(0);
    expect(Object.keys(budget)).toEqual(["script", "text"]);
  });
});
