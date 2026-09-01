import { describe, it, expect, vi } from "vitest";
import {
  C2paSignerTrustStatusAudit,
  certificatesIn,
  leafOf,
} from "./c2pa-signer-trust-status";
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
    isSafeUrl: async (url: string) => url.startsWith("https://example.com"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

// Fixtures generated with OpenSSL: a self-signed certificate, a CA-issued one
// valid until 2046, and the same CA-issued subject with a notAfter in the past.
const SELF_SIGNED =
  "MIIDPzCCAiegAwIBAgIUWMpkp4QEifXRXln6j2FJUYw+LrcwDQYJKoZIhvcNAQELBQAwLzEXMBUGA1UEAwwORXhhbXBsZSBT" +
  "aWduZXIxFDASBgNVBAoMC0V4YW1wbGUgSW5jMB4XDTI2MDgyMzE4MzcxNloXDTQ2MDgxODE4MzcxNlowLzEXMBUGA1UEAwwO" +
  "RXhhbXBsZSBTaWduZXIxFDASBgNVBAoMC0V4YW1wbGUgSW5jMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+1o" +
  "slvSk3jcwKd6bjuQH1ajlrjCEstcVPMiIlXBXbLkruHrsMPU7WsmaXOJEFPXaPwHuO81ocgNZRn2vpIWapGqJdJ93aJJcPfn" +
  "IIiOnjbSI+39dnD7FnzRO2bsl+2+ua7c3iMeeYTFOiKw+Z+LUfEVjuailR4oLa2LzAK4BkHyJt72wXXE4k9WTaeJDT82gmQL" +
  "KTLDWJpcOVOW78RvI1QYJNdygu91shq4X82uRhJ+ogusTRGs9Cizwenm20T0d/X5advqJmrTz9V7L4H3+4JfktMD1/axiT/C" +
  "MN6ZhFtXtg4LoQZ5Uk933MUnKoygdz+1hPnWK+kzZFInXLleXwIDAQABo1MwUTAdBgNVHQ4EFgQUUz1YOAoKiQwhD2C1Xz9B" +
  "vBn6iN0wHwYDVR0jBBgwFoAUUz1YOAoKiQwhD2C1Xz9BvBn6iN0wDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOC" +
  "AQEAv1eQQfE6nX4uXjXXBOlbTnG3D0ODWwqh5gxvIXHHU0S0hYKAf01TbSeU9E0TgbasQOcxpQm1V5NCOgM15CFpZJCdRGDZ" +
  "b3hm51PsbgPzmVnFxP+2ZaHOUmaKbx87Vn74NboGuIp8Tx+cOSuBKlHROiBWyxckpnkZANcg+/pcR41Tc4R5qfNdnuP6w2U4" +
  "q97eJIVYgqdoOxXMEx6rzRvECpr5FQDAFL9hjmbjYL/EvO+Cn8xIJJ3pFwWkODO0cZM/bavwjTyrFtN51ib9flV9WWPA3L2R" +
  "DMeBAKhWGf/LGQw8pZlExEUQ90EZF3iLc745k3fz2+CB55NQOIyKeEjsRw==";

const CA_ISSUED =
  "MIIC6zCCAdMCFAtflILmJjRqABnenSvzvG/DYievMA0GCSqGSIb3DQEBCwUAMDMxGDAWBgNVBAMMD0V4YW1wbGUgVGVzdCBD" +
  "QTEXMBUGA1UECgwORXhhbXBsZSBDQSBJbmMwHhcNMjYwODIzMTgzNzE2WhcNNDYwODE4MTgzNzE2WjAxMRkwFwYDVQQDDBBs" +
  "ZWFmLmV4YW1wbGUuY29tMRQwEgYDVQQKDAtFeGFtcGxlIEluYzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALm+" +
  "I179+oRPvgfy2q3IG6FECGiyladDcTYTnEgm4ACLMrBBtlpht+vrs38TC9dnLriHuQq8WxrHaVjaIuSOB0t5o3Qz0e6ks6Zf" +
  "oWvzoeXp9IgjBK5vjP8txYuWSl4ZSruvIsz8Z+FPgr/OKnLinhYvWTNvjIqRY19JiwVUNZy6s2Lgy2URv609+mVhtajwFKzw" +
  "J5qEAcIJbFYWyzA7ip9T1PAabg6ayp+HwaLo4julnrShGe5qKXl1+TA67UIUjh1q7aa7UAtTS10ONIaSUuHFWaQ2PBoh0zen" +
  "Q9xGS8xgcYqSlh/v5K7ucAuLcTT1HOH/UWU0GKU79bEVo0t6MkkCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAAHDLKJLuJO4q" +
  "AhXag2MaO65aM4nRJujvpoXJl8ByDXktCkxGkPtAewlcGGZbln+ThsnPXjEi+RXSUH10WflIfeqi/U+CXsmf/3F8oHt/CDMQ" +
  "VzjKaZiDHCyeQQHRYoWVDaYukvVtPfYKHgs0rWscm8gbT9QaG2Mb5Ihyoj38r0SYCgNhwrIQTsWjUHlj5sot9j2hDo2C7XZi" +
  "jsf7Fzkm0O88ogbGXz+x6xoRMLX9YOszntu6/dDrWGQqUdbqYtsmOK+hZmy/BuFlCurnMreIis1YB1r2M4nnnGnKx3fOaRf+" +
  "iHfP6gDinYRzXGmQfCVFWML8JIzhZHqYxnphSsaB8w==";

const EXPIRED =
  "MIIC6zCCAdMCFAtflILmJjRqABnenSvzvG/DYieuMA0GCSqGSIb3DQEBCwUAMDMxGDAWBgNVBAMMD0V4YW1wbGUgVGVzdCBD" +
  "QTEXMBUGA1UECgwORXhhbXBsZSBDQSBJbmMwHhcNMjYwODIzMTgzNzA3WhcNMjYwODIyMTgzNzA3WjAxMRkwFwYDVQQDDBBs" +
  "ZWFmLmV4YW1wbGUuY29tMRQwEgYDVQQKDAtFeGFtcGxlIEluYzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALm+" +
  "I179+oRPvgfy2q3IG6FECGiyladDcTYTnEgm4ACLMrBBtlpht+vrs38TC9dnLriHuQq8WxrHaVjaIuSOB0t5o3Qz0e6ks6Zf" +
  "oWvzoeXp9IgjBK5vjP8txYuWSl4ZSruvIsz8Z+FPgr/OKnLinhYvWTNvjIqRY19JiwVUNZy6s2Lgy2URv609+mVhtajwFKzw" +
  "J5qEAcIJbFYWyzA7ip9T1PAabg6ayp+HwaLo4julnrShGe5qKXl1+TA67UIUjh1q7aa7UAtTS10ONIaSUuHFWaQ2PBoh0zen" +
  "Q9xGS8xgcYqSlh/v5K7ucAuLcTT1HOH/UWU0GKU79bEVo0t6MkkCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAG5RLKTQqyjMZ" +
  "+RXD1CtJbfyglk39jgamc6+FxpR3npqtZcNBeKsMlMdUITqNNCbjM9lyGKj6kpH/j+o/3mv3IiyR6owHrA95HVXiekIqi8rj" +
  "Vg0OB4RKXWkMsiozpw+Rt399zxUP7YELorexFJFXkTVWT6ZkXtvMcTrMCHwnWSCmC3Piyg8mSX1aiyWt0a8zrU7Q4vuVIUFQ" +
  "OAxfO4lDkSQbWgznmB7fbWFjWN0GkZR6uE/b1y06nTvrpXdro+LS+CFIJJpi12HpfwU6w3FVxFoW1li+GyTWS9X/u5Pxxc/t" +
  "01DIUU6wT+WrFQdPSvV9l9w9WcXNiegdC3iBFzMF2g==";

/** A JPEG whose APP11 segment carries a JUMBF store holding `payload`. */
function signedJpeg(payload: string): Uint8Array {
  const body = `JP\x00\x01jumbc2pa${payload}`;
  const length = body.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xeb,
    (length >> 8) & 0xff,
    length & 0xff,
    ...Buffer.from(body, "latin1"),
    0xff,
    0xd9,
  ]);
}

/** A store carrying a DER certificate, and optionally a timestamp assertion. */
function store(certBase64: string, timestamped = true): string {
  const der = Buffer.from(certBase64, "base64").toString("latin1");
  return `${timestamped ? "sigTst" : ""}${der}`;
}

function run(
  images: Record<string, Uint8Array>,
  html = '<html><body><img src="/hero.jpg"></body></html>',
) {
  const audit = new C2paSignerTrustStatusAudit();
  const ctx = mockCheckContext([
    mockPageContext("https://example.com/post", html),
  ]);
  const requests: FetchOptions[] = [];
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const bytes = images[o.url];
    if (!bytes) return mockFetchResult("", 404, "image/jpeg");
    const result = mockFetchResult("", 200, "image/jpeg");
    result.bytes = bytes;
    return result;
  };
  return { result: audit.audit(ctx), requests };
}

describe("C2paSignerTrustStatusAudit", () => {
  const audit = new C2paSignerTrustStatusAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no image carries a manifest", async () => {
    const plain = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const { result } = run({ "https://example.com/hero.jpg": plain });
    expect((await result).status).toBe("na");
  });

  describe("certificatesIn", () => {
    it("finds a DER certificate embedded in a manifest store", () => {
      const bytes = new Uint8Array(Buffer.from(store(CA_ISSUED), "latin1"));
      const certs = certificatesIn(bytes);
      expect(certs).toHaveLength(1);
      expect(certs[0]?.subject).toContain("leaf.example.com");
    });

    it("finds nothing in bytes that hold no certificate", () => {
      expect(
        certificatesIn(
          new Uint8Array(Buffer.from("no certificate here", "latin1")),
        ),
      ).toHaveLength(0);
    });

    it("picks the end-entity certificate as the leaf", () => {
      const bytes = new Uint8Array(Buffer.from(store(CA_ISSUED), "latin1"));
      const leaf = leafOf(certificatesIn(bytes));
      expect(leaf?.subject).toContain("leaf.example.com");
    });
  });

  it("fails a self-signed signing certificate", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg(store(SELF_SIGNED)),
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("self-signed");
  });

  it("fails a signing certificate outside its validity window", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg(store(EXPIRED)),
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("expired on");
  });

  it("passes a CA-issued certificate inside its window with a timestamp", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg(store(CA_ISSUED)),
    });
    const r = await result;
    expect(r.status).toBe("pass");
    expect(r.details?.["timestamped"]).toBe(1);
    expect(strings(r, "signers").join(" ")).toContain("Example Test CA");
  });

  // Without a timestamp the credential dies with the certificate.
  it("warns on a CA-issued certificate with no timestamp token", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg(store(CA_ISSUED, false)),
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("no timestamp token");
  });

  it("reports a manifest whose certificate cannot be read, and does not throw", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg("not a certificate at all"),
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "unreadable").join(" ")).toContain(
      "no signing certificate",
    );
  });

  // The reduced audit must never claim what it did not check.
  it("never claims the certificate is on the C2PA Trust List", async () => {
    const { result } = run({
      "https://example.com/hero.jpg": signedJpeg(store(CA_ISSUED)),
    });
    const r = await result;
    const text = `${r.message} ${r.found} ${r.expected} ${JSON.stringify(r.details)}`;
    expect(text).not.toMatch(/on the C2PA Trust List|is trusted|chains to/i);
    expect(C2paSignerTrustStatusAudit.meta.description).not.toMatch(
      /Trust List membership is checked/i,
    );
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = C2paSignerTrustStatusAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });

  // The store comes out of a site-controlled image. A blob of repeated DER
  // sequence headers used to buy one parse attempt per byte.
  it("bounds how many candidate offsets it hands to the DER parser", () => {
    const store = new Uint8Array(1024 * 512);
    for (let i = 0; i < store.length; i += 4) {
      store[i] = 0x30;
      store[i + 1] = 0x82;
      store[i + 3] = 0x10;
    }
    const started = Date.now();
    expect(certificatesIn(store)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
