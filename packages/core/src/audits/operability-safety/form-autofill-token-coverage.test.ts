import { describe, it, expect } from "vitest";
import { FormAutofillTokenCoverageAudit } from "./form-autofill-token-coverage";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";

const page = (body: string) => `<html><body>${body}</body></html>`;

function run(html: string, url = "https://example.test/login") {
  const audit = new FormAutofillTokenCoverageAudit();
  return audit.audit(mockCheckContext([mockPageContext(url, page(html))]));
}

const COVERED_LOGIN = `
  <form action="/login">
    <label for="u">Email or username</label>
    <input id="u" name="u" type="text" autocomplete="username">
    <label for="p">Password</label>
    <input id="p" name="p" type="password" autocomplete="current-password">
    <button type="submit">Sign in</button>
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

  it("passes a sign-in form whose fields carry username and current-password", () => {
    const result = run(COVERED_LOGIN);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2 of 2 credential field(s) covered");
  });

  // Profile tokens belong to profile-autofill-token-coverage: a checkout with
  // no credential field is not this audit's business.
  it("is notApplicable on a checkout form with only profile fields", () => {
    const result = run(
      `<form action="/checkout">
        <label for="e">Email address</label>
        <input id="e" name="f_2" type="text">
        <label for="z">Postcode *</label>
        <input id="z" name="zip" type="text">
      </form>`,
      "https://example.test/checkout",
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("expects new-password on a signup page", () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
      "https://example.test/signup",
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('autocomplete="new-password"');
  });

  it("expects current-password on a login page", () => {
    const result = run(
      `<form><label for="p">Password</label><input id="p" name="p" type="password"></form>`,
    );
    expect(result.message).toContain('autocomplete="current-password"');
  });

  // A sign-in identifier is the username token's documented case.
  it("expects username on an email-or-username sign-in field", () => {
    const result = run(
      `<form action="/login"><label for="u">Email or username</label><input id="u" name="u" type="text"></form>`,
    );
    expect(result.message).toContain('autocomplete="username"');
  });

  it("expects one-time-code on a verification code field", () => {
    const result = run(
      `<form><label for="c">Verification code</label><input id="c" name="c" type="text"></form>`,
      "https://example.test/verify",
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('autocomplete="one-time-code"');
  });

  it("warns when the password is covered and the identifier is not", () => {
    const result = run(`
      <form action="/login">
        <label for="u">Username</label>
        <input id="u" name="u" type="text">
        <label for="p">Password</label>
        <input id="p" name="p" type="password" autocomplete="current-password">
      </form>`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1 of 2");
    expect(result.message).toContain('autocomplete="username"');
  });

  // The side findings travel with the form: on a sign-in form they are here.
  it("reports asterisk-only required-ness on a sign-in form", () => {
    const result = run(`
      <form action="/login">
        <label for="u">Username *</label>
        <input id="u" name="u" type="text" autocomplete="username">
        <label for="p">Password</label>
        <input id="p" name="p" type="password" autocomplete="current-password">
      </form>`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2 of 2");
    expect(result.found).toContain("1 required by a visual asterisk only");
  });

  // The email on a sign-in form is a profile token, judged by the other audit.
  it("does not count a type=email field on a sign-in form", () => {
    const result = run(`
      <form action="/login">
        <label for="e">Email</label>
        <input id="e" name="e" type="email">
        <label for="p">Password</label>
        <input id="p" name="p" type="password" autocomplete="current-password">
      </form>`);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1 of 1");
  });

  it("is graded A and scored", () => {
    const { meta } = FormAutofillTokenCoverageAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBe(1);
  });
});
