import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  parseHtml,
  classifyPage,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
} from "#core/parser";
import { isSafeUrl } from "#core/fetcher";
import { permitted } from "./discover-brand-pages.mjs";

const run = promisify(execFile);
const documentedRedirects = new Set();
const shopDirectory = "packages/core/test-data/sites/shop-directory.json";
if (fs.existsSync(shopDirectory)) {
  for (const brand of JSON.parse(fs.readFileSync(shopDirectory, "utf8"))
    .brands) {
    for (const shop of brand.shops) {
      if (
        !shop.verification?.finalUrl ||
        !shop.verification?.provenance ||
        !fs.existsSync(shop.verification.provenance)
      )
        continue;
      const source = new URL(shop.url).hostname.replace(/^www\./, "");
      const recorded = JSON.parse(
        fs.readFileSync(shop.verification.provenance, "utf8"),
      );
      if (
        !recorded.requestedUrl ||
        new URL(recorded.requestedUrl).hostname.replace(/^www\./, "") !== source
      )
        continue;
      const target = new URL(recorded.url).hostname.replace(/^www\./, "");
      documentedRedirects.add(`${brand.domain}\n${source}\n${target}`);
    }
  }
}
const binary =
  "/Users/kirov/.volta/tools/image/packages/chrome-devtools-axi/bin/chrome-devtools-axi";
async function command(session, args) {
  return run("rtk", ["proxy", binary, ...args], {
    env: { ...process.env, CHROME_DEVTOOLS_AXI_SESSION: session },
    maxBuffer: 24 * 1024 * 1024,
    timeout: 45000,
  });
}
export async function captureBrowser(
  url,
  domain,
  session = "brand-corpus-pages",
) {
  if (!(await isSafeUrl(url))) throw new Error(`Unsafe browser URL: ${url}`);
  const refusal = await permitted(url);
  if (refusal) throw new Error(`Browser robots refusal: ${refusal}: ${url}`);
  const pages = await command(session, ["pages"]);
  if (!/,\s*true\s*$/m.test(pages.stdout)) {
    const firstId = pages.stdout.match(/^\s*(\d+),/m)?.[1];
    if (firstId) await command(session, ["selectpage", firstId]);
    else {
      await command(session, ["newpage", "about:blank"]);
      const fresh = await command(session, ["pages"]);
      const id = fresh.stdout.match(/^\s*(\d+),/m)?.[1];
      if (!id) throw new Error("Browser session has no page");
      await command(session, ["selectpage", id]);
    }
  }
  let navigationError;
  try {
    await command(session, ["open", url]);
  } catch (error) {
    navigationError = String(error.stderr ?? error.message).slice(0, 500);
  }
  const expression =
    "async () => { await new Promise(resolve => setTimeout(resolve, 3000)); return ({url:location.href,title:document.title.replace(/\\s+/g,' '),status:performance.getEntriesByType('navigation')[0]?.responseStatus,contentType:document.contentType,htmlBase64:btoa(unescape(encodeURIComponent(document.documentElement.outerHTML)))}); }";
  const { stdout } = await command(session, ["eval", expression, "--full"]);
  const line = stdout.match(/^result:\s*(.*)$/m)?.[1];
  if (!line) throw new Error(`Browser returned no DOM: ${url}`);
  const decoded = JSON.parse(line);
  const snapshot = typeof decoded === "string" ? JSON.parse(decoded) : decoded;
  snapshot.html = Buffer.from(snapshot.htmlBase64, "base64").toString("utf8");
  if (!(await isSafeUrl(snapshot.url)))
    throw new Error(`Unsafe browser final URL: ${snapshot.url}`);
  const requestedHost = new URL(url).hostname.replace(/^www\./, "");
  const finalHost = new URL(snapshot.url).hostname.replace(/^www\./, "");
  if (
    requestedHost !== finalHost &&
    !(finalHost === domain || finalHost.endsWith(`.${domain}`)) &&
    !documentedRedirects.has(`${domain}\n${requestedHost}\n${finalHost}`)
  )
    throw new Error(`Unconfirmed browser redirect: ${url} -> ${snapshot.url}`);
  const id = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const directory = `reports/brand-corpus/browser-captures/${domain}`;
  fs.mkdirSync(directory, { recursive: true });
  const fixture = path.join(directory, `${id}.html.gz`);
  const provenance = path.join(directory, `${id}.json`);
  const capturedAt = new Date().toISOString();
  const kind =
    snapshot.status === 200 &&
    !/access.{0,40}denied|just a moment|robot check|captcha|client challenge|^GDPR$/i.test(
      snapshot.title,
    ) &&
    !/please verify you are a human|using automation tools to browse|unable to accept your business|trying to access .{0,80} from a country in the EU/i.test(
      snapshot.html,
    )
      ? "page"
      : "wall-or-error";
  const metadata = {
    url: snapshot.url,
    requestedUrl: url,
    capturedAt,
    status: snapshot.status,
    kind,
    captureMode: "browser-rendered-dom",
    browserSession: session,
    contentType: snapshot.contentType,
    navigationError,
    sha256: createHash("sha256").update(snapshot.html).digest("hex"),
  };
  fs.writeFileSync(fixture, gzipSync(snapshot.html));
  fs.writeFileSync(provenance, JSON.stringify(metadata, null, 2) + "\n");
  const $ = parseHtml(snapshot.html);
  const classification = classifyPage(
    snapshot.url,
    $,
    [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)],
    extractMetaTags($),
  );
  const links = $("a[href]")
    .toArray()
    .flatMap((element) => {
      try {
        return [
          {
            url: new URL($(element).attr("href"), snapshot.url).href,
            text: $(element).text().replace(/\s+/g, " ").trim().slice(0, 160),
          },
        ];
      } catch {
        return [];
      }
    });
  const result = {
    url,
    finalUrl: snapshot.url,
    status: snapshot.status,
    kind,
    title: snapshot.title,
    capturedAt,
    fixture,
    provenance,
    captureMode: metadata.captureMode,
    classification,
    links,
  };
  fs.writeFileSync(
    path.join(directory, `${id}.record.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  return result;
}

if (process.argv[1]?.endsWith("capture-shop-browser.mjs")) {
  const [url, domain, session] = process.argv.slice(2);
  if (!url || !domain)
    throw new Error(
      "Usage: capture-shop-browser.mjs <url> <input-domain> [session]",
    );
  const result = await captureBrowser(url, domain, session);
  console.log(
    JSON.stringify({
      url: result.finalUrl,
      status: result.status,
      kind: result.kind,
      classification: result.classification,
      links: result.links.length,
      fixture: result.fixture,
    }),
  );
}
