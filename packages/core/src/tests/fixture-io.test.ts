import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import type { FetchResult } from "../fetcher";
import {
  classifyCapture,
  listFixtures,
  readFixture,
  FIXTURE_KINDS,
} from "./fixture-io";

const response = (overrides: Partial<FetchResult> = {}): FetchResult => ({
  url: "https://example.test/",
  finalUrl: "https://example.test/",
  status: 200,
  headers: { "content-type": "text/html" },
  body: "",
  ttfbMs: 0,
  totalMs: 0,
  contentType: "text/html",
  contentLength: 0,
  ...overrides,
});

const article = `<html><body><main><h1>A page with words on it</h1><p>${"word ".repeat(
  120,
)}</p></main></body></html>`;

describe("the real-page fixtures", () => {
  it("holds fixtures to read", () => {
    expect(listFixtures().length).toBeGreaterThan(0);
  });

  it("reads back HTML matching the SHA recorded at capture", () => {
    for (const name of listFixtures()) {
      const { html, provenance } = readFixture(name);
      const sha = createHash("sha256").update(html).digest("hex");
      expect(sha, `${name} does not match its recorded SHA`).toBe(
        provenance.sha256,
      );
    }
  });

  it("records where and when each fixture came from", () => {
    for (const name of listFixtures()) {
      const { provenance } = readFixture(name);
      expect(provenance.url, name).toMatch(/^https:\/\//);
      expect(provenance.capturedAt, name).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it("records what kind of thing was captured, and the response that decided it", () => {
    for (const name of listFixtures()) {
      const { provenance } = readFixture(name);
      expect(FIXTURE_KINDS, `${name} has an unknown kind`).toContain(
        provenance.kind,
      );
      // Status 0 is the fetcher's transport failure, not a response. It must
      // never reach the corpus: an empty body under it is indistinguishable
      // from a real refusal.
      expect(provenance.status, name).toBeGreaterThanOrEqual(100);
      expect(
        Object.keys(provenance.headers).length,
        `${name} stored no headers`,
      ).toBeGreaterThan(0);
      expect(typeof provenance.contentType, name).toBe("string");
      // A real fetch never costs zero. A zero here is a synthesised default,
      // which `server-responsiveness` would go on to score as an observation.
      expect(provenance.ttfbMs, `${name} recorded no TTFB`).toBeGreaterThan(0);
      expect(provenance.totalMs, name).toBeGreaterThan(0);
      expect(typeof provenance.contentLength, name).toBe("number");
    }
  });

  // The fixture stores the whole response, headers included, so the verdict
  // is re-derivable. This is what stops a regression in the classifier from
  // quietly reading a stored bot wall as a readable page.
  it("replays to the kind it was recorded with", () => {
    for (const name of listFixtures()) {
      const { html, provenance } = readFixture(name);
      const kind = classifyCapture(
        response({
          url: provenance.url,
          finalUrl: provenance.url,
          status: provenance.status,
          headers: provenance.headers,
          contentType: provenance.contentType,
          body: html,
        }),
      );
      expect(
        kind,
        `${name} was recorded as ${provenance.kind} but replays as ${kind}`,
      ).toBe(provenance.kind);
    }
  });
});

describe("classifyCapture", () => {
  it("calls a 2xx body carrying readable text a page", () => {
    expect(classifyCapture(response({ body: article }))).toBe("page");
  });

  it("calls any non-2xx response a wall, however much text it carries", () => {
    expect(classifyCapture(response({ status: 403, body: article }))).toBe(
      "wall",
    );
    expect(classifyCapture(response({ status: 429, body: article }))).toBe(
      "wall",
    );
    expect(classifyCapture(response({ status: 503, body: article }))).toBe(
      "wall",
    );
  });

  it("calls a 2xx bot interstitial a wall, not a shell", () => {
    const interstitial = classifyCapture(
      response({
        headers: { server: "cloudflare", "cf-mitigated": "challenge" },
        body: "<html><body>Just a moment...</body></html>",
      }),
    );
    expect(interstitial).toBe("wall");
  });

  // Regression: the scanned-page count handed to the WAF detector is the
  // guard on its marker-header branches. Passing zero — "the scan obtained
  // nothing" — makes every Akamai-fronted page classify as a wall.
  it("calls an Akamai-fronted 2xx page a page, not a wall", () => {
    const akamai = response({
      headers: { server: "AkamaiGHost" },
      body: article,
    });
    expect(classifyCapture(akamai)).toBe("page");
    expect(
      classifyCapture(
        response({
          headers: { "x-akamai-transformed": "9 - 0" },
          body: article,
        }),
      ),
    ).toBe("page");
  });

  it("calls a 2xx body with almost no readable text a shell", () => {
    expect(
      classifyCapture(
        response({ body: '<html><body><div id="root"></div></body></html>' }),
      ),
    ).toBe("shell");
  });
});
