import { describe, it, expect } from "vitest";
import { SvgBloatAudit } from "./svg-bloat";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const pathData = (bytes: number) =>
  `<path d="${"M0 0L1 1".repeat(Math.ceil(bytes / 8))}"/>`;
const bigSvg = (bytes: number, attrs = "") =>
  `<svg ${attrs} viewBox="0 0 100 100">${pathData(bytes)}</svg>`;

describe("SvgBloatAudit", () => {
  const audit = new SvgBloatAudit();

  it("is not applicable when no SVGs exist", () => {
    const html = "<html><head></head><body><h1>Hello</h1></body></html>";
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("No inline SVG");
  });

  it("passes when SVGs are small", () => {
    const html = `<html><body>${bigSvg(200)}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("unhidden");
  });

  it("passes when large SVGs are aria-hidden", () => {
    const html = `<html><body>${bigSvg(30000, 'aria-hidden="true"')}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("0 unhidden");
  });

  it('passes when large SVGs have role="presentation"', () => {
    const html = `<html><body>${bigSvg(30000, 'role="presentation"')}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("warns when an unhidden SVG exceeds 2KB", () => {
    const html = `<html><body>${bigSvg(4000)}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("exceed 2KB");
    expect(result.found).toContain("Top offenders");
  });

  it("fails when a single unhidden SVG exceeds 10KB", () => {
    const html = `<html><body>${bigSvg(12000)}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Severe SVG context bloat");
  });

  it("fails when total unhidden SVG bytes exceed 20KB across pages", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        `<html><body>${bigSvg(9000)}</body></html>`,
        0,
      ),
      mockPageContext(
        "https://example.com/about",
        `<html><body>${bigSvg(9000)}${bigSvg(6000)}</body></html>`,
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("https://example.com/about");
  });

  it("warns when many small unhidden SVGs total over 8KB", () => {
    const svgs = Array.from({ length: 6 }, () => bigSvg(1500)).join("");
    const html = `<html><body>${svgs}</body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("bloating agent context");
  });

  it("warns when total unhidden SVG bytes exceed 8KB", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        `<html><body>${bigSvg(5000)}</body></html>`,
        0,
      ),
      mockPageContext(
        "https://example.com/about",
        `<html><body>${bigSvg(5000)}</body></html>`,
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
  });
  // The data-URI fold: base64 is priced in tokens, wherever it sits.
  const base64 = (chars: number) =>
    "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=".repeat(Math.ceil(chars / 36));

  it("counts a base64 data URI and reports its token cost", () => {
    const html = `<html><body><img src="data:image/png;base64,${base64(4000)}"><svg><path d="M0 0"/></svg></body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.details?.["dataUriCount"]).toBe(1);
    expect(Number(result.details?.["dataUriTokens"])).toBeGreaterThan(500);
    expect(result.found).toContain("base64");
  });

  it("counts data URIs inside a style attribute and inside a style block", () => {
    const html = `<html><head><style>.a{background:url(data:image/png;base64,${base64(600)})}</style></head><body><div style="background:url(data:image/gif;base64,${base64(600)})"></div><svg><path d="M0 0"/></svg></body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.details?.["dataUriCount"]).toBe(2);
  });

  // A 1x1 tracking pixel is not a token problem.
  it("ignores a data URI under the 200-character floor", () => {
    const html = `<html><body><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"><svg><path d="M0 0"/></svg></body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.details?.["dataUriCount"]).toBe(0);
  });

  it("fails on inlined base64 alone once it costs 5000 tokens", () => {
    const html = `<html><body><img src="data:image/png;base64,${base64(40000)}"></body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe("fail");
    expect(result.found).toContain("alt text");
  });

  it("still counts svg path tokens and still ignores aria-hidden svgs", () => {
    const html = `<html><body>${bigSvg(3000)}${bigSvg(3000, 'aria-hidden="true"')}</body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(Number(result.details?.["svgPathTokens"])).toBeGreaterThan(0);
    expect(result.details?.["svgCount"]).toBe(2);
    expect(result.details?.["unhiddenSvgCount"]).toBe(1);
  });

  it("is notApplicable only when neither bucket has anything in it", () => {
    const html = "<html><body><p>Prose only.</p></body></html>";
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe("na");
  });
});
