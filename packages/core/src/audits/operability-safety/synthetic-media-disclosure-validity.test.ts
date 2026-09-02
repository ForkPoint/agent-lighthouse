import { describe, it, expect, vi } from "vitest";
import {
  SyntheticMediaDisclosureValidityAudit,
  classifyDisclosure,
  digitalSourceType,
  DIGITAL_SOURCE_BASE,
} from "./synthetic-media-disclosure-validity";
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

/** An XMP packet declaring `value` as the digital source type. */
function packet(value: string): string {
  return `<?xpacket begin="?"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"><rdf:Description Iptc4xmpExt:DigitalSourceType="${value}"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

/** A JPEG carrying an XMP packet, and optionally a C2PA store. */
function jpegWith(xmp?: string, manifestPayload?: string): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  const segment = (marker: number, body: string) => {
    const length = body.length + 2;
    parts.push(
      0xff,
      marker,
      (length >> 8) & 0xff,
      length & 0xff,
      ...Buffer.from(body, "latin1"),
    );
  };
  if (xmp !== undefined)
    segment(0xe1, `http://ns.adobe.com/xap/1.0/\x00${xmp}`);
  if (manifestPayload !== undefined)
    segment(0xeb, `JP\x00\x01jumbc2pa${manifestPayload}`);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

function run(
  images: Record<string, Uint8Array>,
  html = '<html><body><img src="/a.jpg"></body></html>',
) {
  const audit = new SyntheticMediaDisclosureValidityAudit();
  const ctx = mockCheckContext([
    mockPageContext("https://example.com/post", html),
  ]);
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const bytes = images[o.url];
    if (!bytes) return mockFetchResult("", 404, "image/jpeg");
    const result = mockFetchResult("", 200, "image/jpeg");
    result.bytes = bytes;
    return result;
  };
  return audit.audit(ctx);
}

const VALID_URI = `${DIGITAL_SOURCE_BASE}trainedAlgorithmicMedia`;

describe("SyntheticMediaDisclosureValidityAudit", () => {
  const audit = new SyntheticMediaDisclosureValidityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no image declares a source type", async () => {
    const result = await run({ "https://example.com/a.jpg": jpegWith() });
    expect(result.status).toBe("na");
  });

  describe("digitalSourceType", () => {
    it("reads the attribute, element and rdf:resource forms", () => {
      expect(digitalSourceType(packet(VALID_URI))).toBe(VALID_URI);
      expect(
        digitalSourceType(
          `<Iptc4xmpExt:DigitalSourceType>${VALID_URI}</Iptc4xmpExt:DigitalSourceType>`,
        ),
      ).toBe(VALID_URI);
      expect(
        digitalSourceType(
          `<Iptc4xmpExt:DigitalSourceType rdf:resource="${VALID_URI}"/>`,
        ),
      ).toBe(VALID_URI);
      expect(digitalSourceType("<x:xmpmeta/>")).toBeUndefined();
    });
  });

  describe("classifyDisclosure", () => {
    it("grades each near-miss class of its own", () => {
      expect(classifyDisclosure(VALID_URI).kind).toBe("valid");
      expect(classifyDisclosure("trainedAlgorithmicMedia").kind).toBe(
        "bare-concept",
      );
      expect(
        classifyDisclosure(VALID_URI.replace("http://", "https://")).kind,
      ).toBe("wrong-scheme");
      expect(classifyDisclosure(`${VALID_URI}/`).kind).toBe("trailing-slash");
      expect(
        classifyDisclosure(`${DIGITAL_SOURCE_BASE}madeUpConcept`).kind,
      ).toBe("unknown-concept");
      expect(classifyDisclosure("AI-generated").kind).toBe("free-text");
    });
  });

  it("passes an exact vocabulary member", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(packet(VALID_URI)),
    });
    expect(result.status).toBe("pass");
    expect(result.details?.["declaredCoverage"]).toBe(100);
  });

  it("fails a bare concept id", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(packet("trainedAlgorithmicMedia")),
    });
    expect(result.status).toBe("fail");
    expect(strings(result, "failures").join(" ")).toContain("bare concept");
  });

  it("fails an https spelling of the http vocabulary URI", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(
        packet(VALID_URI.replace("http://", "https://")),
      ),
    });
    expect(result.status).toBe("fail");
    expect(strings(result, "failures").join(" ")).toContain(
      "https where the vocabulary uses http",
    );
  });

  it("fails a trailing slash", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(packet(`${VALID_URI}/`)),
    });
    expect(result.status).toBe("fail");
    expect(strings(result, "failures").join(" ")).toContain("trailing slash");
  });

  it("fails free text", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(packet("AI-generated")),
    });
    expect(result.status).toBe("fail");
    expect(strings(result, "failures").join(" ")).toContain("free text");
  });

  // Two provenance channels on one asset, disagreeing about who made the pixels.
  it("fails when the XMP and the C2PA manifest contradict each other", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(
        packet(`${DIGITAL_SOURCE_BASE}digitalCapture`),
        "actions trainedAlgorithmicMedia",
      ),
    });
    expect(result.status).toBe("fail");
    expect(strings(result, "failures").join(" ")).toContain(
      "contradict each other",
    );
  });

  it("accepts an XMP declaration that agrees with the manifest", async () => {
    const result = await run({
      "https://example.com/a.jpg": jpegWith(
        packet(VALID_URI),
        "actions trainedAlgorithmicMedia",
      ),
    });
    expect(result.status).toBe("pass");
  });

  // Detecting undisclosed synthetic imagery needs a classifier, which this is not.
  it("never claims to detect undisclosed synthetic imagery", () => {
    const { meta } = SyntheticMediaDisclosureValidityAudit;
    expect(`${meta.description} ${meta.guidance?.impact}`).not.toMatch(
      /detect(s|ing)? undisclosed|classif/i,
    );
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = SyntheticMediaDisclosureValidityAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
