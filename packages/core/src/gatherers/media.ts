import type { FetchOptions, FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';
import { allJsonLdNodes } from '../parser';
import type { PageContext } from '../check-context';

/**
 * Image bytes and the provenance metadata inside them, once per scan.
 *
 * Three provenance audits ask the same images the same questions — is there a
 * C2PA manifest store in these bytes, what does the XMP packet say, and is
 * this URL a transformed variant of another one. Written here so they cannot
 * answer them differently, and cached per scan so three audits cost one fetch.
 *
 * Detection is structural: the functions locate a manifest store or an XMP
 * packet, they do not parse JUMBF or COSE. That is deliberate — a byte range
 * is enough to answer "did the pipeline strip it", which is the question.
 */

/** The C2PA box UUID that marks a manifest store inside a BMFF container. */
const BMFF_C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';

/** How many images one scan fetches. Each is up to 5MB. */
export const MAX_IMAGES = 6;

export type MediaContainer = 'jpeg' | 'png' | 'webp' | 'bmff' | 'unknown';

export interface ManifestLocation {
  container: MediaContainer;
  /** Offset of the manifest store within the asset. */
  start: number;
  /** Bytes the store occupies, as far as the container declares. */
  length: number;
}

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface MediaContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
  baseUrl: string;
}

/** A byte-preserving view for ASCII searching: latin1 keeps one char per byte. */
function ascii(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
}

/** Read a big-endian unsigned integer of `size` bytes at `at`. */
function beInt(bytes: Uint8Array, at: number, size: number): number {
  let value = 0;
  for (let i = 0; i < size; i += 1) value = value * 256 + (bytes[at + i] ?? 0);
  return value;
}

/** What container are these bytes, judged by their signature? */
export function containerOf(bytes: Uint8Array): MediaContainer {
  if (bytes.length < 4) return 'unknown';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes.length >= 8 && ascii(bytes.subarray(0, 8)) === '\x89PNG\r\n\x1a\n') return 'png';
  if (bytes.length >= 12 && ascii(bytes.subarray(0, 4)) === 'RIFF' && ascii(bytes.subarray(8, 12)) === 'WEBP') {
    return 'webp';
  }
  if (bytes.length >= 8 && ascii(bytes.subarray(4, 8)) === 'ftyp') return 'bmff';
  return 'unknown';
}

/** Walk a JPEG's marker segments, yielding `[marker, payloadStart, payloadLength]`. */
function* jpegSegments(bytes: Uint8Array): Generator<[number, number, number]> {
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1] ?? 0;
    // Start of scan: everything after it is entropy-coded image data.
    if (marker === 0xda || marker === 0xd9) break;
    const length = beInt(bytes, at + 2, 2);
    if (length < 2) break;
    yield [marker, at + 4, length - 2];
    at += 2 + length;
  }
}

/** Walk a PNG's chunks, yielding `[type, dataStart, dataLength]`. */
function* pngChunks(bytes: Uint8Array): Generator<[string, number, number]> {
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = beInt(bytes, at, 4);
    const type = ascii(bytes.subarray(at + 4, at + 8));
    yield [type, at + 8, length];
    at += 12 + length;
    if (type === 'IEND') break;
  }
}

/** Walk a RIFF container's chunks, yielding `[type, dataStart, dataLength]`. */
function* riffChunks(bytes: Uint8Array): Generator<[string, number, number]> {
  let at = 12;
  while (at + 8 <= bytes.length) {
    const type = ascii(bytes.subarray(at, at + 4));
    // RIFF sizes are little-endian, unlike every other container here.
    const length =
      (bytes[at + 4] ?? 0) |
      ((bytes[at + 5] ?? 0) << 8) |
      ((bytes[at + 6] ?? 0) << 16) |
      ((bytes[at + 7] ?? 0) << 24);
    yield [type, at + 8, length];
    at += 8 + length + (length % 2);
  }
}

/** Walk a BMFF container's top-level boxes, yielding `[type, dataStart, dataLength]`. */
function* bmffBoxes(bytes: Uint8Array): Generator<[string, number, number]> {
  let at = 0;
  while (at + 8 <= bytes.length) {
    let size = beInt(bytes, at, 4);
    const type = ascii(bytes.subarray(at + 4, at + 8));
    let header = 8;
    if (size === 1) {
      size = beInt(bytes, at + 8, 8);
      header = 16;
    }
    if (size === 0) size = bytes.length - at;
    if (size < header) break;
    yield [type, at + header, size - header];
    at += size;
  }
}

/**
 * Where is the C2PA manifest store in these bytes, if it is there at all?
 *
 * One arm per container, each looking for what the C2PA specification puts
 * there: a JUMBF box labelled `c2pa` inside a JPEG APP11 segment, a PNG `caBX`
 * chunk, a WebP `C2PA` chunk, or a BMFF `uuid` box carrying the C2PA UUID.
 */
export function findC2paManifest(bytes: Uint8Array): ManifestLocation | undefined {
  const container = containerOf(bytes);

  if (container === 'jpeg') {
    for (const [marker, start, length] of jpegSegments(bytes)) {
      if (marker !== 0xeb) continue; // APP11
      const payload = ascii(bytes.subarray(start, start + length));
      // APP11 payloads carrying JUMBF open with the two-byte 'JP' identifier.
      if (!payload.startsWith('JP')) continue;
      if (!payload.includes('c2pa') && !payload.includes('jumb')) continue;
      return { container, start, length };
    }
    return undefined;
  }

  if (container === 'png') {
    for (const [type, start, length] of pngChunks(bytes)) {
      if (type === 'caBX') return { container, start, length };
    }
    return undefined;
  }

  if (container === 'webp') {
    for (const [type, start, length] of riffChunks(bytes)) {
      if (type === 'C2PA') return { container, start, length };
    }
    return undefined;
  }

  if (container === 'bmff') {
    for (const [type, start, length] of bmffBoxes(bytes)) {
      if (type !== 'uuid' || length < 16) continue;
      const uuid = Buffer.from(bytes.subarray(start, start + 16)).toString('hex');
      if (uuid === BMFF_C2PA_UUID) return { container, start: start + 16, length: length - 16 };
    }
    return undefined;
  }

  return undefined;
}

/** The XMP packet inside these bytes, or undefined. */
export function extractXmp(bytes: Uint8Array): string | undefined {
  const container = containerOf(bytes);

  if (container === 'jpeg') {
    for (const [marker, start, length] of jpegSegments(bytes)) {
      if (marker !== 0xe1) continue; // APP1
      const payload = ascii(bytes.subarray(start, start + length));
      const header = 'http://ns.adobe.com/xap/1.0/\0';
      if (payload.startsWith(header)) return payload.slice(header.length);
    }
  }

  if (container === 'png') {
    for (const [type, start, length] of pngChunks(bytes)) {
      if (type !== 'iTXt') continue;
      const payload = ascii(bytes.subarray(start, start + length));
      if (!payload.startsWith('XML:com.adobe.xmp\0')) continue;
      // iTXt layout: keyword \0 compressionFlag compressionMethod languageTag
      // \0 translatedKeyword \0 text. The two flag bytes are read positionally
      // rather than by splitting, because either of them may itself be \0.
      let at = 'XML:com.adobe.xmp\0'.length + 2;
      for (let field = 0; field < 2; field += 1) {
        const end = payload.indexOf('\0', at);
        if (end === -1) return undefined;
        at = end + 1;
      }
      const text = payload.slice(at);
      if (text !== '') return text;
    }
  }

  // Any container: the packet carries its own delimiters, which is what makes
  // a raw scan safe here.
  const whole = ascii(bytes);
  const open = whole.indexOf('<?xpacket begin');
  if (open === -1) return undefined;
  const close = whole.indexOf('<?xpacket end', open);
  if (close === -1) return undefined;
  const end = whole.indexOf('?>', close);
  return whole.slice(open, end === -1 ? undefined : end + 2);
}

/**
 * The origin asset behind a transformed variant URL, or undefined.
 *
 * Three forms cover most of what sites deploy: Next.js image optimization,
 * Cloudflare Image Resizing, and WordPress's `-WxH` rendition suffix.
 */
export function originOfVariant(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }

  if (url.pathname === '/_next/image') {
    const target = url.searchParams.get('url');
    if (!target) return undefined;
    try {
      return new URL(target, url.origin).toString();
    } catch {
      return undefined;
    }
  }

  const cloudflare = /^\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(url.pathname);
  if (cloudflare) {
    try {
      return new URL(cloudflare[1]!, url.origin).toString();
    } catch {
      return undefined;
    }
  }

  const wordpress = /^(.+)-\d+x\d+(\.(?:jpe?g|png|webp|avif|gif))$/i.exec(url.pathname);
  if (wordpress) {
    const origin = new URL(url.toString());
    origin.pathname = `${wordpress[1]}${wordpress[2]}`;
    origin.search = '';
    return origin.toString();
  }

  return undefined;
}

/** Every image URL a page points at, same host, in document order. */
export function imageCandidates(page: PageContext): string[] {
  const $ = page.$;
  const out: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== 'string' || value.trim() === '') return;
    try {
      const url = new URL(value.trim(), page.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      if (url.host !== new URL(page.url).host) return;
      out.push(url.toString());
    } catch {
      // A malformed src is the page's problem, not a reason to stop reading.
    }
  };

  $('img[src]').each((_i, el) => add($(el).attr('src')));
  $('img[srcset], source[srcset]').each((_i, el) => {
    for (const candidate of ($(el).attr('srcset') ?? '').split(',')) {
      add(candidate.trim().split(/\s+/)[0]);
    }
  });
  add(page.meta['og:image']);
  add(page.meta['twitter:image']);

  for (const node of allJsonLdNodes(page.jsonLd)) {
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Record<string, unknown>;
    for (const key of ['image', 'logo', 'primaryImageOfPage']) {
      const value = record[key];
      // A schema.org image is a URL, an ImageObject, or an array of either.
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item === 'string') add(item);
        else if (typeof item === 'object' && item !== null) add((item as Record<string, unknown>)['url']);
      }
    }
  }

  return [...new Set(out)];
}

const imageCache = new WeakMap<object, Map<string, Promise<Uint8Array | undefined>>>();

/**
 * Fetch one image's bytes, at most once per scan.
 *
 * `isSafeUrl`-gated because image URLs are read out of site-controlled markup.
 * Returns undefined for anything that does not answer 200 with bytes.
 */
export function fetchImage(ctx: MediaContext, url: string): Promise<Uint8Array | undefined> {
  let cache = imageCache.get(ctx);
  if (!cache) {
    cache = new Map();
    imageCache.set(ctx, cache);
  }
  const cached = cache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    if (!(await isSafeUrl(url))) return undefined;
    const result = await ctx.fetch({ url, binary: true, followRedirects: true });
    if (result.status !== 200) return undefined;
    return result.bytes;
  })();
  cache.set(url, pending);
  return pending;
}
