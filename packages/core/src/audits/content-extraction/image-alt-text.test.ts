import { describe, it, expect } from "vitest";
import { ImageAltTextAudit } from "./image-alt-text";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("ImageAltTextAudit", () => {
  const audit = new ImageAltTextAudit();

  // The old rule returned a scored 1.0 here, handing a free full mark to every
  // image-free page and to every client-rendered site whose served HTML carries
  // no <img> at all.
  it("reports na when there are no images that need a text alternative", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="bg.png" alt="" role="presentation"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("na");
    expect(result.message).toContain("No images that need a text alternative");
  });

  it("reports na when the page carries no images at all", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>Text</p></body></html>",
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe("na");
  });

  it("passes when 100% of non-decorative images have alt text", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="a.jpg" alt="A blue shoe"><img src="b.jpg" alt="A red hat"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("2/2");
  });

  it("warns when coverage is at least 80% but below 100%", () => {
    const imgs =
      Array.from(
        { length: 4 },
        (_, i) => `<img src="${i}.jpg" alt="desc ${i}">`,
      ).join("") + '<img src="x.jpg" alt=" ">'; // whitespace-only alt counts as missing
    const page = mockPageContext(
      "https://example.com",
      `<html><body>${imgs}</body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("warn");
    expect(result.found).toContain("4/5");
  });

  it("fails when coverage is below 80%", () => {
    // Images with no alt attribute at all are real failures and count against coverage.
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="a.jpg"><img src="b.jpg"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("0/2");
  });

  it('excludes explicitly decorative alt="" images from coverage', () => {
    // Three decorative `alt=""` images plus one informative image. The decorative
    // images must be excluded from the denominator, leaving 1/1 = 100% coverage
    // rather than 1/4 = 25%.
    const page = mockPageContext(
      "https://example.com",
      "<html><body>" +
        '<img src="d1.png" alt=""><img src="d2.png" alt=""><img src="d3.png" alt="">' +
        '<img src="hero.jpg" alt="A blue running shoe">' +
        "</body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  it('reports na when every image is decorative alt=""', () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="d1.png" alt=""><img src="d2.png" alt=""></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("na");
    expect(result.message).toContain("No images that need a text alternative");
  });

  // The dossier grades this A on the accessible-name computation, and accname
  // ranks aria-labelledby and aria-label ABOVE alt. Failing an image that
  // carries one contradicts the standard the grade rests on.
  it("counts aria-label as a text alternative", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="a.jpg" aria-label="A blue shoe"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  it("counts aria-labelledby when the referenced id resolves", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><p id="cap">A blue shoe</p><img src="a.jpg" aria-labelledby="cap"></body></html>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe("pass");
  });

  it("does not count an aria-labelledby whose ids resolve to nothing", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="a.jpg" aria-labelledby="missing"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("0/1");
  });

  it("counts title as a text alternative, the HTML-AAM fallback below alt", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="a.jpg" title="A blue shoe"></body></html>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe("pass");
  });

  // Not in the accessibility tree, so no snapshot consumer can see it. The
  // dossier's required fix asks for this exclusion by name.
  it("excludes aria-hidden images from the denominator", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="icon.svg" aria-hidden="true"><img src="a.jpg" alt="A blue shoe"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  // ARIA presentational-role conflict resolution: a global ARIA name on the
  // element defeats the presentational mapping, so the image is a named node.
  it("treats a global ARIA name as defeating a decorative marker", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="chart.png" alt="" aria-label="Sales by quarter"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  // title is not a global ARIA name, so it names an image that already counts
  // but does not pull a decorative one back into the denominator.
  it("does not let title un-decorate an empty alt", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="bg.png" alt="" title="Background"></body></html>',
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe("na");
  });

  it("names the worst offending pages in found", () => {
    const clean = mockPageContext(
      "https://example.com/good",
      '<html><body><img src="a.jpg" alt="A blue shoe"></body></html>',
    );
    const bad = mockPageContext(
      "https://example.com/gallery",
      '<html><body><img src="a.jpg"><img src="b.jpg"></body></html>',
      1,
    );
    const result = audit.audit(mockCheckContext([clean, bad]));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("https://example.com/gallery (0/2)");
    expect(result.found).not.toContain("/good");
    expect(result.pageUrl).toBe("https://example.com/gallery");
  });

  it("keeps the grade-A scored registration", () => {
    const { meta } = ImageAltTextAudit;
    expect(meta.evidenceGrade).toBe("A");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(1);
    expect(meta.scoreDisplayMode).toBe("ternary");
  });

  it('still counts images with a missing alt attribute alongside decorative alt=""', () => {
    // alt="" is decorative (excluded); a missing alt attribute is a real failure (counted).
    const page = mockPageContext(
      "https://example.com",
      '<html><body><img src="dec.png" alt=""><img src="broken.jpg"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("0/1");
  });
});
