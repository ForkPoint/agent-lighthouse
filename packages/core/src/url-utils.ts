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
  if (result.endsWith('/') && parsed.pathname === '/') {
    result = result.slice(0, -1);
  }

  return result;
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
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

export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (trimmed === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(trimmed)) return true;

  const v4MappedMatch = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const candidate = v4MappedMatch ? v4MappedMatch[1] : trimmed;

  return PRIVATE_IPv4_PATTERNS.some((re) => re.test(candidate));
}
