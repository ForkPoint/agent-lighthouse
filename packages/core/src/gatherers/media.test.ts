import { describe, it, expect, vi } from "vitest";
import {
  containerOf,
  findC2paManifest,
  extractXmp,
  originOfVariant,
  imageCandidates,
  fetchImage,
  fetchImageHead,
} from "./media";
import { HttpMethod } from "#core/types";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import type { FetchOptions, FetchResult } from "#core/fetcher";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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

    it("names nothing from fewer than four bytes", () => {
      expect(containerOf(raw("\xff\xd8\xff"))).toBe("unknown");
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

    it("ignores an APP11 segment that does not open with the JUMBF identifier", () => {
      expect(findC2paManifest(jpeg(0xeb, "XXjumbc2pa"))).toBeUndefined();
    });

    it("stops reading a JPEG at the start of scan", () => {
      // An APP11 store after SOS is entropy-coded data, not a segment.
      const bytes = join(
        raw("\xff\xd8"),
        raw("\xff\xda\x00\x04ab"),
        jpeg(0xeb, "JP\x00\x01jumbc2pa").subarray(2),
      );
      expect(findC2paManifest(bytes)).toBeUndefined();
    });

    it("stops reading a JPEG at a byte that is not a marker or a bad length", () => {
      const stray = join(
        raw("\xff\xd8\x00\x00\x00\x00"),
        jpeg(0xeb, "JP\x00\x01jumbc2pa").subarray(2),
      );
      expect(findC2paManifest(stray)).toBeUndefined();
      const shortLength = join(
        raw("\xff\xd8\xff\xe0\x00\x01"),
        jpeg(0xeb, "JP\x00\x01jumbc2pa").subarray(2),
      );
      expect(findC2paManifest(shortLength)).toBeUndefined();
    });

    it("stops reading a PNG at IEND", () => {
      const bytes = join(
        png("IEND", ""),
        png("caBX", "store").subarray(8), // a chunk past the end of image
      );
      expect(findC2paManifest(bytes)).toBeUndefined();
    });

    it("reads a BMFF box with a 64-bit size and skips a foreign uuid", () => {
      const foreign = join(
        new Uint8Array([0, 0, 0, 1]),
        raw("uuid"),
        new Uint8Array([0, 0, 0, 0, 0, 0, 0, 16 + 16]),
        new Uint8Array(16).fill(0xaa),
      );
      const asset = join(raw("\x00\x00\x00\x10ftypavif0000"), foreign);
      expect(findC2paManifest(asset)).toBeUndefined();
    });

    it("reads a BMFF box of size 0 as running to the end of the file", () => {
      const uuid = Buffer.from("d8fec3d61b0e483c92975828877ec481", "hex");
      const box = join(
        new Uint8Array([0, 0, 0, 0]),
        raw("uuid"),
        new Uint8Array(uuid),
        raw("store"),
      );
      const asset = join(raw("\x00\x00\x00\x10ftypavif0000"), box);
      expect(findC2paManifest(asset)?.length).toBe("store".length);
    });

    it("stops reading BMFF at a box smaller than its own header", () => {
      const uuid = Buffer.from("d8fec3d61b0e483c92975828877ec481", "hex");
      const asset = join(
        raw("\x00\x00\x00\x10ftypavif0000"),
        new Uint8Array([0, 0, 0, 4]),
        raw("free"),
        new Uint8Array([0, 0, 0, 29]),
        raw("uuid"),
        new Uint8Array(uuid),
        raw("store"),
      );
      expect(findC2paManifest(asset)).toBeUndefined();
    });

    it("returns undefined for an unknown container", () => {
      expect(findC2paManifest(raw("GIF89a c2pa jumb"))).toBeUndefined();
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

    it("skips JPEG segments that are not an XMP APP1", () => {
      const packet = '<?xpacket begin="?"?><x:xmpmeta/><?xpacket end="w"?>';
      const bytes = join(
        raw("\xff\xd8"),
        raw("\xff\xe0\x00\x06JFIF"),
        jpeg(0xe1, `Exif\x00\x00${packet}`).subarray(2),
      );
      // The Exif APP1 is not XMP, so the delimiter scan finds the packet.
      expect(extractXmp(bytes)).toBe(packet);
    });

    it("skips a PNG iTXt chunk that is not XMP", () => {
      expect(
        extractXmp(png("iTXt", "Comment\x00\x00\x00\x00\x00hello")),
      ).toBeUndefined();
    });

    it("returns undefined for a truncated XMP iTXt chunk", () => {
      expect(
        extractXmp(png("iTXt", "XML:com.adobe.xmp\x00\x00\x00en")),
      ).toBeUndefined();
    });

    it("falls through an XMP iTXt chunk with empty text", () => {
      expect(
        extractXmp(png("iTXt", "XML:com.adobe.xmp\x00\x00\x00\x00\x00")),
      ).toBeUndefined();
    });

    it("needs both packet delimiters, and tolerates an unterminated end", () => {
      expect(
        extractXmp(raw('RIFF\x00\x00\x00\x00WEBP<?xpacket begin="?"?><x/>')),
      ).toBeUndefined();
      const open = '<?xpacket begin="?"?><x/><?xpacket end="w"';
      expect(extractXmp(raw(`RIFF\x00\x00\x00\x00WEBP${open}`))).toBe(open);
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

    it("returns undefined for an unparseable URL or a Next.js URL without a target", () => {
      expect(originOfVariant("not a url")).toBeUndefined();
      expect(
        originOfVariant("https://example.com/_next/image?w=640"),
      ).toBeUndefined();
      expect(
        originOfVariant("https://example.com/_next/image?url=http%3A%2F%2F%5B"),
      ).toBeUndefined();
    });

    it("drops the query string when stripping a WordPress suffix", () => {
      expect(originOfVariant("https://example.com/a-1024x768.webp?ver=2")).toBe(
        "https://example.com/a.webp",
      );
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

    it("skips non-http sources, empty values and malformed JSON-LD image values", () => {
      const jsonLd = JSON.stringify([
        "a bare string node",
        {
          "@type": "Organization",
          logo: { url: "https://example.com/logo.png" },
          image: [null, 42, { contentUrl: "https://example.com/no-url.jpg" }],
        },
      ]);
      const page = mockPageContext(
        "https://example.com/about",
        `<html><head><meta name="twitter:image" content="/tw.jpg">
         <script type="application/ld+json">${jsonLd}</script></head>
         <body><img src="data:image/png;base64,AAAA"><img src="  ">
         <img src="http://[bad"></body></html>`,
      );
      expect(imageCandidates(page)).toEqual([
        "https://example.com/tw.jpg",
        "https://example.com/logo.png",
      ]);
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

  describe("fetchImageHead", () => {
    it("sends one HEAD per URL per scan and gates the URL", async () => {
      const ctx = mockCheckContext([
        mockPageContext("https://example.com/", "<html></html>"),
      ]);
      const requests: FetchOptions[] = [];
      ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
        requests.push(o);
        return mockFetchResult("", 200, "image/jpeg");
      };
      const [a, b] = await Promise.all([
        fetchImageHead(ctx, "https://example.com/a.jpg"),
        fetchImageHead(ctx, "https://example.com/a.jpg"),
      ]);
      expect(a?.status).toBe(200);
      expect(b).toBe(a);
      expect(requests.map((r) => r.method)).toEqual([HttpMethod.Head]);
      expect(
        await fetchImageHead(ctx, "https://other.test/a.jpg"),
      ).toBeUndefined();
      expect(requests).toHaveLength(1);
    });

    it("returns undefined when the request throws", async () => {
      const ctx = mockCheckContext([
        mockPageContext("https://example.com/", "<html></html>"),
      ]);
      ctx.fetch = async () => {
        throw new Error("reset");
      };
      expect(
        await fetchImageHead(ctx, "https://example.com/a.jpg"),
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
