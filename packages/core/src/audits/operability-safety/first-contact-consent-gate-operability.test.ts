import { describe, it, expect } from "vitest";
import { FirstContactConsentGateOperabilityAudit } from "./first-contact-consent-gate-operability";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

/** The OneTrust loader, one of the CMP signatures the audit looks for. */
const CMP =
  '<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script>';

/** An article whose body is what an agent came for. */
const ARTICLE = `
  <main><article><h1>How resoling works</h1><p>${"Body text. ".repeat(40)}</p></article></main>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"How resoling works"}</script>`;

/** A consent dialog whose controls are named buttons in the top document. */
const DIALOG = `
  <div id="onetrust-banner-sdk" role="dialog" aria-label="Cookie preferences">
    <button id="onetrust-accept-btn-handler">Accept all cookies</button>
    <button id="onetrust-reject-all-handler">Reject all cookies</button>
  </div>`;

function page(body: string, head = CMP): CheckContext {
  return mockCheckContext([
    mockPageContext(
      "https://example.com/",
      `<html><head>${head}</head><body>${body}</body></html>`,
    ),
  ]);
}

describe("FirstContactConsentGateOperabilityAudit", () => {
  const audit = new FirstContactConsentGateOperabilityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no consent manager is detected", async () => {
    const result = await audit.audit(page(ARTICLE, ""));
    expect(result.status).toBe("na");
  });

  it("reports an action cost when the content is behind a well-built gate", async () => {
    const result = await audit.audit(page(`${DIALOG}${ARTICLE}`));
    expect(result.status).toBe("pass");
    expect(result.details?.["actionCost"]).toBe(1);
    expect(result.found).toContain("OneTrust");
  });

  it("names the missing main entity when an interstitial replaces the content", async () => {
    const result = await audit.audit(page(DIALOG));
    expect(result.message).toContain("main");
    expect(result.details?.["contentBehindGate"]).toBe(false);
  });

  it("reports a dialog whose root is a cross-origin iframe as unreachable", async () => {
    const result = await audit.audit(
      page(
        `<iframe id="onetrust-banner-sdk" src="https://consent.example.net/gate"></iframe>${ARTICLE}`,
      ),
    );
    expect(result.details?.["crossOriginDialog"]).toBe(true);
    expect(result.message).toContain("iframe");
  });

  it("reports main content hidden from the accessibility tree while the gate is open", async () => {
    const result = await audit.audit(
      page(
        `${DIALOG}<main aria-hidden="true"><article><p>Body</p></article></main>`,
      ),
    );
    expect(result.details?.["mainHidden"]).toBe(true);
  });

  // One click to reject is the cheapest gate; a preferences journey costs two.
  it("counts one click to reject, and two when reject hides behind preferences", async () => {
    const cheap = await audit.audit(page(`${DIALOG}${ARTICLE}`));
    const costly = await audit.audit(
      page(
        `<div id="onetrust-banner-sdk" role="dialog" aria-label="Cookie preferences">
           <button id="onetrust-accept-btn-handler">Accept all cookies</button>
           <button id="onetrust-pc-btn-handler">Manage preferences</button>
         </div>${ARTICLE}`,
      ),
    );
    expect(cheap.details?.["actionCost"]).toBe(1);
    expect(costly.details?.["actionCost"]).toBe(2);
  });

  // Grade C cannot sit in the scored tier: sunset.test.ts rejects it, and the
  // weight law ties a non-scored tier to weight 0.
  it("is registered as informative with weight 0", () => {
    const { meta } = FirstContactConsentGateOperabilityAudit;
    expect(meta.evidenceGrade).toBe("C");
    expect(meta.tier).toBe("informative");
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe("informative");
  });
});
