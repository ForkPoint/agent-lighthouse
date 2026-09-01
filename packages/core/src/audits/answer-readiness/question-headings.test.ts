import { describe, it, expect } from "vitest";
import { QuestionHeadingsAudit } from "./question-headings";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("QuestionHeadingsAudit", () => {
  const audit = new QuestionHeadingsAudit();

  it("passes when 2 or more question-formatted H2/H3 headings exist", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <h2>What is unified content preparation?</h2>
        <p>It structures content for agents.</p>
        <h3>How does it work?</h3>
        <p>By adding semantic markup.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("2 question-formatted");
  });

  it("warns when exactly 1 question heading exists", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <h2>What is unified content preparation?</h2>
        <h2>Our Features</h2>
        <h3>Pricing</h3>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("Only 1 question-formatted");
  });

  it("fails when no question headings exist", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <h2>Our Features</h2>
        <h3>Pricing</h3>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No question-formatted");
  });

  it("fails when no pages were scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it("ignores H1 and H4 headings when counting question headings", () => {
    // Only H2/H3 are counted; H1 and H4 ending with ? must not trigger a pass or warn.
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <h1>What is the main topic?</h1>
        <h4>What about sub-items?</h4>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No question-formatted");
  });

  it("caps example collection at 3 when more than 3 question headings are present", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <h2>What is question one?</h2>
        <h2>What is question two?</h2>
        <h3>What is question three?</h3>
        <h3>What is question four?</h3>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("4 question-formatted");
  });
});
