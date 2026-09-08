// ── URL Utilities ─────────────────────────────────────────────

export function normalizeUrl(input: string): string {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }
  parsed.hostname = parsed.hostname.toLowerCase();

  let result = parsed.toString();
  if (result.endsWith("/") && parsed.pathname === "/") {
    result = result.slice(0, -1);
  }

  return result;
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

const PRIVATE_IPv4_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
];

function mappedIpv4(ip: string): string | undefined {
  const prefix = /^(?:::ffff:|(?:0{1,4}:){5}ffff:)/i;
  const suffix = ip.replace(prefix, "");
  if (suffix === ip) return undefined;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(suffix)) return suffix;

  const hexMatch = suffix.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hexMatch) return undefined;

  const high = Number.parseInt(hexMatch[1], 16);
  const low = Number.parseInt(hexMatch[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (trimmed === "::" || trimmed === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(trimmed)) return true;

  const candidate = mappedIpv4(trimmed) ?? trimmed;

  return PRIVATE_IPv4_PATTERNS.some((re) => re.test(candidate));
}

export { isSafeUrl } from "./fetcher";
