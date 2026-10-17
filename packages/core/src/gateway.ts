import type { DomPageContext } from "./check-context";
import { pageRendersText } from "./scan-evidence";

/**
 * The real homepage behind a gateway page, or undefined.
 *
 * Some sites answer `/` with a splash or language gateway: a few words, a
 * meta refresh to `/en/`, and a canonical that names the same target. Read
 * alone, that page has no readable text, so the scan has nothing to judge and
 * ends unscored although the site behind it is readable. A page with readable
 * text is never a gateway, whatever its head says.
 *
 * The meta refresh wins over the canonical, because it is where a browser
 * goes. The target must be on the page's own site and differ from the page
 * itself: the same origin, or the `www` twin of its host on the same scheme
 * and port (`example.com` and `www.example.com`). Any other host is another
 * site and is not followed.
 */
export function gatewayTarget(
  page: Pick<DomPageContext, "$">,
  pageUrl: string,
): string | undefined {
  if (pageRendersText(page)) return undefined;
  const { $ } = page;

  const candidates: string[] = [];
  $("meta[http-equiv]").each((_, el) => {
    if (($(el).attr("http-equiv") ?? "").trim().toLowerCase() !== "refresh")
      return;
    const target = refreshTarget($(el).attr("content") ?? "");
    if (target) candidates.push(target);
  });
  $("link[rel][href]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) candidates.push($(el).attr("href")!);
  });

  const base = new URL(pageUrl);
  for (const raw of candidates) {
    let target: URL;
    try {
      target = new URL(raw.trim(), base);
    } catch {
      continue;
    }
    if (!sameSite(target, base)) continue;
    target.hash = "";
    if (sameDocument(target, base)) continue;
    return target.href;
  }
  return undefined;
}

/** The URL part of a refresh `content` value: `"4;url=/en/"`, `"0; URL='x'"`. */
function refreshTarget(content: string): string | undefined {
  const match = /^\s*\d*(?:\.\d*)?\s*[;,]\s*(?:url\s*=\s*)?(.+)$/i.exec(
    content,
  );
  if (!match) return undefined;
  const url = match[1]!.trim().replace(/^(['"])(.*)\1$/, "$2");
  return url || undefined;
}

/** The same origin, or the apex and `www` hosts of one site. */
function sameSite(a: URL, b: URL): boolean {
  if (a.origin === b.origin) return true;
  if (a.protocol !== b.protocol || a.port !== b.port) return false;
  const bare = (host: string): string => host.replace(/^www\./, "");
  return a.hostname !== b.hostname && bare(a.hostname) === bare(b.hostname);
}

function sameDocument(a: URL, b: URL): boolean {
  const key = (u: URL): string =>
    `${u.origin}${u.pathname.replace(/\/$/, "")}${u.search}`;
  return key(a) === key(b);
}
