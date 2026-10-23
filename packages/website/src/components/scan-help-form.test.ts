import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The honeypot is markup, not behavior: the island and FormFlow only read
// what the form posts. Pin the attributes that keep people from filling it.
const source = readFileSync(
  new URL("./ScanHelpForm.astro", import.meta.url),
  "utf8",
);

describe("scan help form honeypot", () => {
  it("posts FormFlow's _ff_honey field, out of reach of people", () => {
    const input = source.match(/<input[^>]*name="_ff_honey"[^>]*>/)?.[0];
    expect(input).toBeDefined();
    expect(input).toContain('tabindex="-1"');
    expect(input).toContain('autocomplete="off"');
    const wrapper = source.slice(
      source.lastIndexOf("<div", source.indexOf('name="_ff_honey"')),
      source.indexOf('name="_ff_honey"'),
    );
    expect(wrapper).toContain('aria-hidden="true"');
    expect(wrapper).toContain("-left-[9999px]");
  });
});
