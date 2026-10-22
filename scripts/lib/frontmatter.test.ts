import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.mjs";

describe("flat dossier frontmatter", () => {
  it("distinguishes missing or unclosed frontmatter from an empty block", () => {
    expect(parseFrontmatter("# Document\n")).toBeNull();
    expect(parseFrontmatter("---\nslug: example\n")).toBeNull();
    expect(parseFrontmatter("---\n---\n# Document\n")).toEqual({});
  });

  it("reads dossier and review fields with a BOM and Windows newlines", () => {
    expect(
      parseFrontmatter(
        '\uFEFF---\r\nslug: example\r\nevidence_grade: "A"\r\nreviewed: 2026-10-22\r\n---\r\nBody',
      ),
    ).toEqual({
      slug: "example",
      evidence_grade: "A",
      reviewed: "2026-10-22",
    });
  });

  it("ignores nested values, list items, comments, and the document body", () => {
    expect(
      parseFrontmatter(
        "---\n# review note\nslug: example\nsources:\n  - source-id\n\tnested: ignored\n---\nreviewed: 1900-01-01\n",
      ),
    ).toEqual({ slug: "example", sources: "" });
  });

  it("strips unquoted comments while preserving quoted hashes and colons", () => {
    expect(
      parseFrontmatter(
        '---\nevidence_grade: A # confirmed\nreviewed: 2026-10-22 # review date\nurl: https://example.com/#part\ntitle: "A: # heading"\n---\n',
      ),
    ).toEqual({
      evidence_grade: "A",
      reviewed: "2026-10-22",
      url: "https://example.com/#part",
      title: "A: # heading",
    });
  });
});
