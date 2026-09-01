import { describe, it, expect, vi } from "vitest";
import {
  containerOf,
  findC2paManifest,
  extractXmp,
  originOfVariant,
  imageCandidates,
  fetchImage,
} from "./media";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../__tests__/test-utils";
import type { FetchOptions, FetchResult } from "../fetcher";

vi.mock("../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => url.startsWith("https://example.com"),
  };
});

/** Bytes from a latin1 string, so a fixture reads as what it is. */
const raw = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));

/** Concatenate byte runs. */
const join = (...parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** A JPEG carrying one marker segment with `payload`. */
function jpeg(marker: number, payload: string): Uint8Array {
  const length = payload.length + 2;
  return join(
    raw("\xff\xd8"),
    new Uint8Array([0xff, marker, (length >> 8) & 0xff, length & 0xff]),
    raw(payload),
    raw("\xff\xd9"),
  );
}

/** A PNG carrying one chunk of `type` with `payload`. */
function png(type: string, payload: string): Uint8Array {
  const size = payload.length;
  return join(
    raw("\x89PNG\r\n\x1a\n"),
    new Uint8Array([
      (size >>> 24) & 0xff,
      (size >>> 16) & 0xff,
      (size >>> 8) & 0xff,
      size & 0xff,
    ]),
    raw(type),
    raw(payload),
    raw("CRC4"),
  );
}

describe("media gatherer", () => {
  describe("containerOf", () => {
    it("names each container from its signature", () => {
      expect(containerOf(jpeg(0xeb, "JPx"))).toBe("jpeg");
      expect(containerOf(png("caBX", "store"))).toBe("png");
      expect(containerOf(join(raw("RIFF????WEBP"), raw("VP8 ")))).toBe("webp");
      expect(
        containerOf(join(raw("\x00\x00\x00\x18ftypavif"), raw("0000"))),
      ).toBe("bmff");
      expect(containerOf(raw("not an image at all"))).toBe("unknown");
    });
  });

  describe("findC2paManifest", () => {
    it("finds a JUMBF store in a JPEG APP11 segment", () => {
      const found = findC2paManifest(jpeg(0xeb, "JP\x00\x01jumbc2pa manifest"));
      expect(found?.container).toBe("jpeg");
      expect(found?.length).toBe("JP\x00\x01jumbc2pa manifest".length);
    });

    it("ignores a JPEG APP11 segment that carries no JUMBF", () => {
      expect(findC2paManifest(jpeg(0xeb, "JPsomething else"))).toBeUndefined();
    });

    it("ignores an APP1 segment, whatever it contains", () => {
      expect(findC2paManifest(jpeg(0xe1, "JPc2pa"))).toBeUndefined();
    });

    it("finds a PNG caBX chunk", () => {
      expect(findC2paManifest(png("caBX", "store"))?.container).toBe("png");
      expect(findC2paManifest(png("iTXt", "store"))).toBeUndefined();
    });

    it("finds a WebP C2PA chunk", () => {
      const webp = join(
        raw("RIFF\x20\x00\x00\x00WEBP"),
        raw("C2PA"),
        new Uint8Array([5, 0, 0, 0]),
        raw("store"),
      );
      expect(findC2paManifest(webp)?.container).toBe("webp");
    });

    it("finds a BMFF uuid box carrying the C2PA UUID", () => {
      const uuid = Buffer.from("d8fec3d61b0e483c92975828877ec481", "hex");
      const payload = raw("store");
      const size = 8 + uuid.length + payload.length;
      const box = join(
        new Uint8Array([0, 0, 0, size]),
        raw("uuid"),
        new Uint8Array(uuid),
        payload,
      );
      const asset = join(raw("\x00\x00\x00\x10ftypavif0000"), box);
      const found = findC2paManifest(asset);
      expect(found?.container).toBe("bmff");
      expect(found?.length).toBe(payload.length);
    });

    it("returns undefined for an unsigned asset", () => {
      expect(findC2paManifest(png("IDAT", "pixels"))).toBeUndefined();
    });
  });

  describe("extractXmp", () => {
    it("reads the packet out of a JPEG APP1 segment", () => {
      const packet = '<?xpacket begin="?"?><x:xmpmeta/><?xpacket end="w"?>';
      const found = extractXmp(
        jpeg(0xe1, `http://ns.adobe.com/xap/1.0/\x00${packet}`),
      );
      expect(found).toBe(packet);
    });

    it("reads the packet out of a PNG iTXt chunk", () => {
      const packet = '<?xpacket begin="?"?><x:xmpmeta/><?xpacket end="w"?>';
      const found = extractXmp(
        png("iTXt", `XML:com.adobe.xmp\x00\x00\x00\x00\x00${packet}`),
      );
      expect(found).toBe(packet);
    });

    it("falls back to the packet delimiters in any container", () => {
      const packet = '<?xpacket begin="?"?><x:xmpmeta/><?xpacket end="w"?>';
      const webp = join(raw("RIFF\x40\x00\x00\x00WEBP"), raw(packet));
      expect(extractXmp(webp)).toBe(packet);
    });

    it("returns undefined when there is no packet", () => {
      expect(extractXmp(png("IDAT", "pixels"))).toBeUndefined();
    });
  });

  describe("originOfVariant", () => {
    it("decodes a Next.js optimized image back to its origin", () => {
      expect(
        originOfVariant(
          "https://example.com/_next/image?url=%2Fhero.jpg&w=640&q=75",
        ),
      ).toBe("https://example.com/hero.jpg");
    });

    it("decodes a Cloudflare resized image back to its origin", () => {
      expect(
        originOfVariant(
          "https://example.com/cdn-cgi/image/width=800,quality=75/photos/a.jpg",
        ),
      ).toBe("https://example.com/photos/a.jpg");
    });

    it("strips a WordPress rendition suffix", () => {
      expect(
        originOfVariant(
          "https://example.com/wp-content/uploads/2026/08/a-300x200.jpg",
        ),
      ).toBe("https://example.com/wp-content/uploads/2026/08/a.jpg");
    });

    it("returns undefined for a plain asset URL", () => {
      expect(originOfVariant("https://example.com/hero.jpg")).toBeUndefined();
    });
  });

  describe("imageCandidates", () => {
    it("collects src, srcset, og:image and JSON-LD images, same host only", () => {
      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        image: [
          "https://example.com/ld.jpg",
          { url: "https://example.com/ld2.jpg" },
        ],
      });
      const page = mockPageContext(
        "https://example.com/post",
        `<html><head><meta property="og:image" content="https://example.com/og.jpg">
         <script type="application/ld+json">${jsonLd}</script></head>
         <body><img src="/a.jpg"><img srcset="/b-320.jpg 320w, https://cdn.other.test/c.jpg 640w">
         <picture><source srcset="/d.webp"></picture></body></html>`,
      );
      const found = imageCandidates(page);
      expect(found).toContain("https://example.com/a.jpg");
      expect(found).toContain("https://example.com/b-320.jpg");
      expect(found).toContain("https://example.com/d.webp");
      expect(found).toContain("https://example.com/og.jpg");
      expect(found).toContain("https://example.com/ld.jpg");
      expect(found).toContain("https://example.com/ld2.jpg");
      // Another origin's image is not this site's to audit.
      expect(found.some((url) => url.includes("other.test"))).toBe(false);
      expect(new Set(found).size).toBe(found.length);
    });
  });

  describe("fetchImage", () => {
    it("fetches bytes once per scan and gates the URL", async () => {
      const ctx = mockCheckContext([
        mockPageContext("https://example.com/", "<html></html>"),
      ]);
      const requests: FetchOptions[] = [];
      ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
        requests.push(o);
        const result = mockFetchResult("", 200, "image/jpeg");
        result.bytes = raw("\xff\xd8\xff\xd9");
        return result;
      };

      const first = await fetchImage(ctx, "https://example.com/a.jpg");
      const second = await fetchImage(ctx, "https://example.com/a.jpg");
      expect(first).toBeInstanceOf(Uint8Array);
      expect(second).toBe(first);
      expect(requests).toHaveLength(1);
      expect(requests[0]!.binary).toBe(true);

      // Off-origin URLs never reach the network in this test's gate.
      expect(await fetchImage(ctx, "https://other.test/a.jpg")).toBeUndefined();
      expect(requests).toHaveLength(1);
    });

    it("returns undefined for a non-200 answer", async () => {
      const ctx = mockCheckContext([
        mockPageContext("https://example.com/", "<html></html>"),
      ]);
      ctx.fetch = async () => mockFetchResult("", 404, "text/html");
      expect(
        await fetchImage(ctx, "https://example.com/missing.jpg"),
      ).toBeUndefined();
    });
  });

  // A chunk size with the high bit set used to read as a negative number, which
  // walked the cursor backwards for ever and hung the scan on one bad image.
  it("does not hang on a WebP chunk whose size has the high bit set", () => {
    const bytes = new Uint8Array(64);
    Buffer.from("RIFF").copy(bytes, 0);
    Buffer.from("WEBP").copy(bytes, 8);
    Buffer.from("VP8 ").copy(bytes, 12);
    bytes[19] = 0x80; // little-endian 0x80000000
    const started = Date.now();
    expect(findC2paManifest(bytes)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
