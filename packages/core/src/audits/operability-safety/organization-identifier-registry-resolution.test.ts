import { describe, it, expect, vi } from "vitest";
import {
  OrganizationIdentifierRegistryResolutionAudit,
  leiCheckDigitsValid,
  nameSimilarity,
} from "./organization-identifier-registry-resolution";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => url.startsWith("https://api.gleif.org"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

/** A real-shaped LEI whose ISO/IEC 7064 check digits are correct. */
const VALID_LEI = "5493001KJTIIGC8Y1R12";

interface Site {
  /** Organization node fields. */
  organization: Record<string, unknown>;
  /** The GLEIF record, or null for "no record". */
  gleif?: {
    entityStatus?: string;
    registrationStatus?: string;
    legalName?: string;
  } | null;
  gleifStatus?: number;
}

function run(site: Site) {
  const audit = new OrganizationIdentifierRegistryResolutionAudit();
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    ...site.organization,
  });
  const html = `<html><head><script type="application/ld+json">${jsonLd}</script></head><body><p>Home.</p></body></html>`;
  const ctx = mockCheckContext([mockPageContext("https://example.com/", html)]);
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    if (site.gleifStatus !== undefined && site.gleifStatus !== 200) {
      return mockFetchResult("", site.gleifStatus, "application/vnd.api+json");
    }
    // `undefined` means "the caller did not care": a healthy record. Only an
    // explicit null stands for "GLEIF holds nothing".
    const record = site.gleif === null ? null : (site.gleif ?? {});
    const body = JSON.stringify({
      data:
        record === null || record === undefined
          ? []
          : [
              {
                attributes: {
                  entity: {
                    legalName: {
                      name: record.legalName ?? "Example Incorporated",
                    },
                    status: record.entityStatus ?? "ACTIVE",
                  },
                  registration: {
                    status: record.registrationStatus ?? "ISSUED",
                  },
                },
              },
            ],
    });
    return mockFetchResult(body, 200, "application/vnd.api+json");
  };

  return { result: audit.audit(ctx), requests };
}

describe("OrganizationIdentifierRegistryResolutionAudit", () => {
  const audit = new OrganizationIdentifierRegistryResolutionAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no organization identifier is declared", async () => {
    const { result, requests } = run({ organization: { name: "Example Inc" } });
    expect((await result).status).toBe("na");
    expect(requests).toHaveLength(0);
  });

  describe("leiCheckDigitsValid", () => {
    it("accepts a correct LEI and rejects a one-digit typo", () => {
      expect(leiCheckDigitsValid(VALID_LEI)).toBe(true);
      expect(leiCheckDigitsValid("5493001KJTIIGC8Y1R13")).toBe(false);
      expect(leiCheckDigitsValid("TOO-SHORT")).toBe(false);
    });
  });

  describe("nameSimilarity", () => {
    it("matches across legal suffixes and punctuation", () => {
      expect(
        nameSimilarity("Example Incorporated", "Example, Inc."),
      ).toBeGreaterThan(0.6);
      expect(
        nameSimilarity("Example Incorporated", "Totally Different Holdings"),
      ).toBeLessThan(0.6);
    });
  });

  it("passes an LEI that resolves to an active, issued record with a matching name", async () => {
    const { result, requests } = run({
      organization: {
        name: "Example Inc",
        legalName: "Example Incorporated",
        iso6523Code: `0199:${VALID_LEI}`,
      },
    });
    const r = await result;
    expect(r.status).toBe("pass");
    expect(requests[0]?.url).toContain(`filter[lei]=${VALID_LEI}`);
    expect(strings(r, "resolved").join(" ")).toContain("ACTIVE/ISSUED");
  });

  it("fails an LEI whose check digits are wrong, before spending a request", async () => {
    const { result, requests } = run({
      organization: { name: "Example Inc", leiCode: "5493001KJTIIGC8Y1R13" },
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("check digits");
    expect(requests).toHaveLength(0);
  });

  it("fails an identifier GLEIF holds no record for", async () => {
    const { result } = run({
      organization: { name: "Example Inc", leiCode: VALID_LEI },
      gleif: null,
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("no record");
  });

  it("fails when the registered legal name names a different organization", async () => {
    const { result } = run({
      organization: {
        name: "Example Inc",
        legalName: "Example Incorporated",
        leiCode: VALID_LEI,
      },
      gleif: { legalName: "Unrelated Holdings SA" },
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("Unrelated Holdings");
  });

  it("warns on a lapsed registration", async () => {
    const { result } = run({
      organization: {
        name: "Example Inc",
        legalName: "Example Incorporated",
        iso6523Code: `0199:${VALID_LEI}`,
      },
      gleif: { registrationStatus: "LAPSED" },
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("LAPSED");
  });

  it("warns on a leiCode published without its 0199 twin", async () => {
    const { result } = run({
      organization: {
        name: "Example Inc",
        legalName: "Example Incorporated",
        leiCode: VALID_LEI,
      },
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "advisories").join(" ")).toContain(`0199:${VALID_LEI}`);
  });

  it("fails an iso6523Code with no issuing-agency prefix", async () => {
    const { result } = run({
      organization: { name: "Example Inc", iso6523Code: VALID_LEI },
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("issuing-agency prefix");
  });

  it("warns when the registry itself does not answer", async () => {
    const { result } = run({
      organization: {
        name: "Example Inc",
        legalName: "Example Incorporated",
        iso6523Code: `0199:${VALID_LEI}`,
      },
      gleifStatus: 503,
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("503");
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = OrganizationIdentifierRegistryResolutionAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
