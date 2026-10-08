import { describe, it, expect } from "vitest";
import { SectionHeadingsAudit } from "./section-headings";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { CheckStatus } from "../../types";

describe("SectionHeadingsAudit", () => {
  const audit = new SectionHeadingsAudit();

  it("passes when all sections have a heading or aria-label", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <section><h2>Pricing</h2><p>x</p></section>
        <section aria-label="Testimonials"><p>y</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2/2");
  });

  // Absence of <section> is not a defect (dossier required fix).
  it("is notApplicable when no <section> elements are present", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><div>No sections</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No <section> elements found");
  });

  it("warns when a majority but not all sections are labeled", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <section><h2>A</h2></section>
        <section><h2>B</h2></section>
        <section><p>unlabeled</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2/3");
  });

  it("fails when half or fewer sections are labeled", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <section><h2>Labeled</h2></section>
        <section><p>unlabeled</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("1/2");
  });

  // A page builder's empty row slot has nothing to label.
  it("skips empty layout sections", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <section class="row-1"> </section>
        <section class="row-2"><h2>Pricing</h2><p>x</p></section>
        <section class="row-3">
        </section>
        <section class="row-4"><script>window.slot = 4;</script></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
    expect(result.found).toContain("3 empty section(s) skipped");
  });

  it("is notApplicable when every section is an empty slot", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><section> </section><section>&nbsp;</section></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("empty layout slots");
  });

  // True positive: a section holding only an image has content and no name.
  it("still counts a media-only section as content to label", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <section><h2>Labeled</h2><p>x</p></section>
        <section><img src="/banner.jpg" alt="Summer sale"></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("1/2");
  });
});
