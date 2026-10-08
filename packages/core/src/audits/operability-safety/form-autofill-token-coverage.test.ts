import { describe, it, expect } from "vitest";
import { FormAutofillTokenCoverageAudit } from "./form-autofill-token-coverage";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { CheckStatus } from "#core/types";

const page = (body: string) => `<html><body>${body}</body></html>`;

function run(html: string, url = "https://example.test/checkout") {
  const audit = new FormAutofillTokenCoverageAudit();
  return audit.audit(mockCheckContext([mockPageContext(url, page(html))]));
}

const COVERED_FORM = `
  <form>
    <label for="e">Email</label>
    <input id="e" name="email" type="email" autocomplete="email">
    <label for="z">ZIP</label>
    <input id="z" name="zip" type="text" autocomplete="postal-code">
    <button type="submit">Go</button>
  </form>`;

describe("FormAutofillTokenCoverageAudit", () => {
  const audit = new FormAutofillTokenCoverageAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable on a page with no form", () => {
    const result = run("<main><p>Just prose.</p></main>");
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes a form whose every control carries the right token, a name and a matching type", () => {
    const result = run(COVERED_FORM);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2 of 2");
  });

  // The expected token is the actionable half of the finding: "add
  // autocomplete" is not guidance, "add autocomplete=\"email\"" is.
  it('fails an email field with type="text" and no autocomplete, naming the expected token', () => {
    const result = run(`
      <form>
        <label for="e">Email address</label>
        <input id="e" name="f_2" type="text">
      </form>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('autocomplete="email"');
  });

  // Inference reads the label, not the name: "ZIP" is the label a human sees
  // and the only concept signal a name="f_3" field carries.
  it('counts a field labelled ZIP with autocomplete="postal-code" as covered', () => {
    const result = run(`
      <form>
        <label for="p">ZIP</label>
        <input id="p" name="f_3" type="text" autocomplete="postal-code">
      </form>`);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1 of 1");
  });

  it("expects new-password on a signup page", () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
      "https://example.test/signup",
    );
    expect(result.message).toContain('autocomplete="new-password"');
  });

  it("expects current-password on a login page", () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
      "https://example.test/login",
    );
    expect(result.message).toContain('autocomplete="current-password"');
  });

  it("accepts a section- or billing-prefixed token", () => {
    const result = run(`
      <form>
        <label for="z">Postcode</label>
        <input id="z" name="z" type="text" autocomplete="billing postal-code">
      </form>`);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("does not count a field whose type contradicts the token", () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="e" type="text" autocomplete="email">
      </form>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('type="email"');
  });

  it("does not count a field with a token but no name and no id", () => {
    const result = run(`
      <form>
        <label>Email <input type="email" autocomplete="email"></label>
      </form>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("0 of 1");
  });

  // A visual asterisk is not in the accessibility tree, so an agent cannot see
  // that the field is mandatory. It is its own defect, not a token miss.
  it("reports asterisk-only required-ness as a separate finding", () => {
    const result = run(`
      <form>
        <label for="e">Email *</label>
        <input id="e" name="email" type="email" autocomplete="email">
      </form>`);
    expect(result.status).toBe(CheckStatus.Warn);
    // Token coverage is untouched by the asterisk finding.
    expect(result.found).toContain("1 of 1");
    expect(result.found).toContain("1 required by a visual asterisk only");
  });

  it("does not report an asterisk label when the field is really required", () => {
    const result = run(`
      <form>
        <label for="e">Email *</label>
        <input id="e" name="email" type="email" autocomplete="email" required>
      </form>`);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reports an unwired error message as a separate finding", () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email">
        <span class="error-text">Invalid</span>
      </form>`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1 of 1");
    expect(result.found).toContain("1 error message not wired");
  });

  it("does not report an error message the field points at", () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email"
               aria-invalid="true" aria-describedby="err">
        <span id="err" class="error-text">Invalid</span>
      </form>`);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("warns when some fields are covered and some are not", () => {
    const result = run(`
      <form>
        <label for="e">Email</label>
        <input id="e" name="email" type="email" autocomplete="email">
        <label for="c">City</label>
        <input id="c" name="city" type="text">
      </form>`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1 of 2");
    expect(result.message).toContain('autocomplete="address-level2"');
  });

  it("ignores hidden, submit and search controls", () => {
    const result = run(`
      <form>
        <input type="hidden" name="csrf" value="x">
        <label for="q">Search</label>
        <input id="q" name="q" type="search">
        <button type="submit">Go</button>
      </form>`);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("reads the concept off a placeholder when there is no label", () => {
    const result = run(`
      <form>
        <input name="f_7" type="text" placeholder="State">
      </form>`);
    expect(result.message).toContain('autocomplete="address-level1"');
  });

  it("reports the page the first uncovered field is on", () => {
    const result = run(
      `<form><input name="f" type="text" placeholder="City"></form>`,
    );
    expect(result.pageUrl).toBe("https://example.test/checkout");
  });

  // ── query forms take a place or a keyword, not profile data ──

  it("is notApplicable when the only matching field sits in a store-locator form", () => {
    const result = run(
      `<form action="/stores" name="storelocatorForm" method="post">
        <input type="text" name="location" autocomplete="off"
               placeholder="City or postcode" aria-label="City or postcode">
        <button type="submit" aria-label="Find a store"></button>
      </form>`,
      "https://example.test/",
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("1 search or store-locator form(s) skipped");
  });

  it("skips a role=search form built from a text input", () => {
    const result = run(
      `<form role="search" action="/search">
        <input type="text" name="q" placeholder="Search by city or zip">
      </form>`,
      "https://example.test/",
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("skips a location field whose label offers alternatives", () => {
    const result = run(`
      <form action="/contact" method="post">
        <label for="l">City or postcode</label>
        <input id="l" name="l" type="text">
      </form>`);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // True positive: a real checkout postcode field still owes its token.
  it("still fails a checkout postcode field with no autocomplete", () => {
    const result = run(`
      <form action="/checkout/shipping" method="post">
        <label for="z">Postcode</label>
        <input id="z" name="postcode" type="text">
      </form>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('autocomplete="postal-code"');
  });

  // "restore" contains "store" but is not a store locator.
  it("does not mistake a restore-password form for a store locator", () => {
    const result = run(`
      <form action="/account/restore-password" method="post">
        <label for="e">Email</label>
        <input id="e" name="e" type="text">
      </form>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('autocomplete="email"');
  });

  // Two names for one concept are not alternatives.
  it("still infers a field labelled with two names for one concept", () => {
    const result = run(`
      <form>
        <label for="s">State or province</label>
        <input id="s" name="s" type="text">
      </form>`);
    expect(result.message).toContain('autocomplete="address-level1"');
  });

  // A sign-in identifier is the username token's documented case.
  it("still expects username on an email-or-username sign-in field", () => {
    const result = run(
      `<form action="/login"><label for="u">Email or username</label><input id="u" name="u" type="text"></form>`,
      "https://example.test/login",
    );
    expect(result.message).toContain('autocomplete="username"');
  });
});
