import { describe, it, expect } from "vitest";
import { LlmsTxtStructureAudit } from "./llms-txt-structure";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

describe("LlmsTxtStructureAudit", () => {
  const audit = new LlmsTxtStructureAudit();

  const ctxWith = (body: string) =>
    mockCheckContext([], { "/llms.txt": mockFetchResult(body, 200) });

  it("passes when a blockquote follows the H1 and H2 sections exist", () => {
    const result = audit.audit(
      ctxWith(
        "# My Site\n\n> A concise summary of the site.\n\n## Docs\n- item\n\n## Company\n- item",
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.message).toContain("blockquote");
    expect(result.message).toContain("2 H2 section");
  });

  // Ported from llms-txt-blockquote: the summary half of the merged signal.
  it("warns when the blockquote summary is missing but sections exist", () => {
    const result = audit.audit(
      ctxWith("# My Site\n\nSome intro text.\n\n## Docs\n- item"),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no blockquote summary");
  });

  // Ported from llms-txt-sections: the section-shape half of the merged signal.
  it("warns when H2 sections are missing but the blockquote is present", () => {
    const result = audit.audit(
      ctxWith("# Site\n\n> Summary\n\n- [Home](https://example.com/)"),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no H2 sections");
  });

  it("fails when neither the blockquote nor any H2 section is present", () => {
    const result = audit.audit(
      ctxWith("# Site\n\n- [Home](https://example.com/)"),
    );
    expect(result.status).toBe("fail");
    expect(result.message).toContain("no blockquote summary");
    expect(result.message).toContain("no H2 sections");
  });

  // Both source audits returned a critical fail for an absent file, asserting a
  // malformed llms.txt where there is none. That is llms-txt-exists's signal.
  it("is not applicable when llms.txt is missing", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.message).toContain("llms.txt not found");
  });

  it("is not applicable when llms.txt is a 404 body served with 200", () => {
    const result = audit.audit(
      ctxWith(
        "<!doctype html><html><body><h1>Page not found</h1></body></html>",
      ),
    );
    expect(result.status).toBe("na");
    expect(result.message).toContain("no markdown heading");
  });

  // Review finding (1.2): a literal '> ' with a trailing space rejected the
  // extremely common '>Summary', which is valid CommonMark.
  it("accepts a blockquote written without a space after the marker", () => {
    const result = audit.audit(
      ctxWith("# Site\n\n>Summary\n\n## Docs\n- item"),
    );
    expect(result.status).toBe("pass");
  });

  // Review finding (1.2): audit 1.1 accepts a bare '#Site' H1 while 1.2 required
  // '# ', so one file passed 1.1 and failed 1.2 with "No H1 heading found".
  it("accepts an H1 written without a space after the hash", () => {
    const result = audit.audit(
      ctxWith("#Site\n\n> Summary\n\n## Docs\n- item"),
    );
    expect(result.status).toBe("pass");
  });

  // Review finding (1.2): the blockquote search scanned the whole remainder of
  // the file, so a footnote at the bottom counted as the summary.
  it("does not count a blockquote far below the H1 as the summary", () => {
    const body =
      "# Site\n\n## Docs\n- item\n\nlots of text\n\nmore text\n\n> footnote at the bottom";
    const result = audit.audit(ctxWith(body));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no blockquote summary");
  });

  // Review finding (1.3): '##' lines inside a fenced block were counted, so a
  // file documenting llms.txt syntax scored its own examples as real sections.
  it("ignores H2 headings inside fenced code blocks", () => {
    const body =
      "# Site\n\n> Summary\n\n```\n## Not a section\n```\n\n- [Home](/)";
    const result = audit.audit(ctxWith(body));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no H2 sections");
  });

  // Review finding (1.3): '###' is not an H2.
  it("does not count H3 headings as sections", () => {
    const result = audit.audit(
      ctxWith("# Site\n\n> Summary\n\n### Subsection\n- item"),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no H2 sections");
  });

  it("reports both halves in the details", () => {
    const result = audit.audit(
      ctxWith("# Site\n\n> Summary\n\n## Docs\n- item"),
    );
    expect(result.found).toContain("blockquote");
    expect(result.found).toContain("1 H2");
  });
});
