import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { FakeHeadingsAudit } from "./fake-headings";
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";
import { CheckStatus } from "../../types";

describe("FakeHeadingsAudit", () => {
  const audit = new FakeHeadingsAudit();

  it("passes with a proper h1-h3 heading structure", () => {
    const html = `<html><body>
      <h1>Page Title</h1>
      <h2>Section One</h2>
      <p>Some body content that is clearly not a heading because it goes on and on.</p>
      <h3>Subsection</h3>
      <p>More content here.</p>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("No fake headings detected");
  });

  it("fails when 5 or more divs use heading-like classes", () => {
    const fake = (text: string) =>
      `<div class="text-2xl font-bold">${text}</div>`;
    const html = `<html><body>
      <h1>Real Title</h1>
      ${fake("Fake One")}${fake("Fake Two")}${fake("Fake Three")}${fake("Fake Four")}${fake("Fake Five")}
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Found 5 fake heading(s)");
  });

  it("warns when 1-4 fake headings are found", () => {
    const html = `<html><body>
      <h1>Real Title</h1>
      <div class="text-2xl font-bold">Fake One</div>
      <div class="text-3xl font-semibold">Fake Two</div>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("Found 2 fake heading(s)");
  });

  it("does not flag elements inside <nav>", () => {
    const html = `<html><body>
      <nav><div class="text-2xl font-bold">Menu Brand</div></nav>
      <h1>Real Title</h1>
      <h2>Real Section</h2>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // A bold statistic or score is an emphasised value, not a section title.
  it("does not flag numeric values such as statistics and ratings", () => {
    const html = `<html><body><h1>Title</h1>
      <div class="text-3xl font-bold">25,000+</div>
      <span class="font-bold">87%</span>
      <p class="text-2xl font-bold">4.9 / 5</p>
    </body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Hidden subtrees are not in the outline an agent reads, fake or real.
  it("does not flag text inside a hidden dialog", () => {
    const html = `<html><body><h1>Title</h1>
      <div hidden role="dialog"><span class="font-semibold">Keyboard shortcuts</span></div>
      <dialog><div class="text-xl font-bold">Settings panel</div></dialog>
    </body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The dossier flags a heading only where one is structurally missing.
  it("does not flag bold text inside a section that already has a heading", () => {
    const html = `<html><body><h1>Title</h1>
      <section><h2>Community</h2><p class="text-2xl font-bold">Rated by thousands</p><p>Body copy.</p></section>
    </body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("does not flag labels inside header, label or figcaption", () => {
    const html = `<html><body>
      <header><div class="font-bold">Acme</div></header>
      <h1>Title</h1>
      <label><span class="font-bold">Email</span><input></label>
      <figure><img src="a.png" alt=""><figcaption class="font-bold">Chart one</figcaption></figure>
    </body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("still flags a styled title introducing a section with no heading", () => {
    const html = `<html><body><h1>Title</h1>
      <section><div class="text-2xl font-bold">Pricing Plans</div><p>Three plans for every team.</p></section>
    </body></html>`;
    const result = audit.audit(
      mockCheckContext([mockPageContext("https://example.com/", html, 0)]),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("Found 1 fake heading(s)");
  });

  it("flags inline styles with large font-size or heavy font-weight", () => {
    const html = `<html><body>
      <h1>Real Title</h1>
      <p style="font-size: 24px">Looks Like Heading</p>
      <span style="font-weight: 700">Also Headingish</span>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("Found 2 fake heading(s)");
  });

  it("does not flag containers wrapping a real heading", () => {
    const html = `<html><body>
      <div class="heading"><h2>Real Heading Inside</h2></div>
      <h1>Title</h1>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("does not flag long bold paragraphs (emphasis, not headings)", () => {
    const longText =
      "This is a fairly long paragraph of body text that happens to be bold for emphasis. ".repeat(
        3,
      );
    const html = `<html><body>
      <h1>Title</h1>
      <p class="font-bold">${longText}</p>
    </body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("counts fake headings across multiple pages", () => {
    const page = (n: number) =>
      `<html><body><h1>Title ${n}</h1><div class="text-xl font-bold">Fake ${n}</div></body></html>`;
    const ctx = mockCheckContext(
      [0, 1, 2, 3, 4].map((n) =>
        mockPageContext(`https://example.com/p${n}`, page(n), n),
      ),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Found 5 fake heading(s)");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new FakeHeadingsAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      FakeHeadingsAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === FakeHeadingsAudit.meta.id)
        ?.status,
    ).toBe(CheckStatus.NotApplicable);
  });

  // Heading-like text is body text. A shell serves none, so it has neither fake
  // headings nor real ones to have got right.
  it("declines a page that served no readable text", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new FakeHeadingsAudit();
    const rendered = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(rendered.status, "the same input rendered is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const shell = await instance.audit(shellSiteContext());
    expect(shell.status).toBe(CheckStatus.NotApplicable);
  });
});
