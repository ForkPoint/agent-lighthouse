import * as cheerio from "cheerio";
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { AI_CRAWLER_UAS, sharedUaProbes } from "../../gatherers/ua-parity";
import { siteSitemapTree, sampleEntries } from "../../gatherers/sitemap";
import { linksWithRel } from "../../gatherers/structured-fields";
import { directiveLines } from "../../gatherers/robots";
import { isIso4217 } from "../../gatherers/currency";

/** Sitemap URLs added to the probe set. Matches the edge-parity audit, so the cache is shared. */
const MAX_SITEMAP_PROBES = 3;

/** Cloudflare's pay-per-crawl price header: an ISO 4217 code, a space, a decimal. */
const CRAWLER_PRICE = /^[A-Z]{3}\s+\d+(\.\d+)?$/;

/** Findings named in the report. */
const REPORTED = 20;

interface PaymentChallenge {
  url: string;
  token: string;
  /** Which of the three machine-readable forms answered, if any. */
  mechanisms: string[];
  problems: string[];
  contentType: string;
  cacheControl: string;
  /** True when the browser baseline was answered 402 as well. */
  hitsBrowsers: boolean;
}

/** Read the x402 `PAYMENT-REQUIRED` header: base64 JSON with an `accepts` array. */
function readX402(raw: string): { ok: boolean; problem?: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return { ok: false, problem: "PAYMENT-REQUIRED is not base64" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, problem: "PAYMENT-REQUIRED does not decode to JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      problem: "PAYMENT-REQUIRED decodes to a value that is not an object",
    };
  }
  const doc = parsed as Record<string, unknown>;
  if (doc["x402Version"] === undefined) {
    return { ok: false, problem: "PAYMENT-REQUIRED carries no x402Version" };
  }
  const accepts = doc["accepts"];
  if (!Array.isArray(accepts) || accepts.length === 0) {
    return {
      ok: false,
      problem: "PAYMENT-REQUIRED carries no non-empty accepts array",
    };
  }
  const required = ["scheme", "network", "amount", "asset", "payTo"];
  for (const [index, item] of accepts.entries()) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, problem: `accepts[${index}] is not an object` };
    }
    const missing = required.filter(
      (key) => (item as Record<string, unknown>)[key] === undefined,
    );
    if (missing.length > 0) {
      return {
        ok: false,
        problem: `accepts[${index}] is missing ${missing.join(", ")}`,
      };
    }
  }
  return { ok: true };
}

/** Does an RSL document license a crawl payment covering `path`? */
function rslCoversCrawl(xml: string, path: string): boolean {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("content")
    .toArray()
    .some((el) => {
      const prefix = $(el).attr("url") ?? "/";
      const covers = path.startsWith(
        prefix.startsWith("http") ? new URL(prefix).pathname : prefix,
      );
      if (!covers) return false;
      return $(el)
        .find('payment[type="crawl"]')
        .toArray()
        .some((payment) => {
          const amount = $(payment).find("amount").first();
          return (
            isIso4217(amount.attr("currency") ?? "") &&
            /^\d+(\.\d+)?$/.test(amount.text().trim())
          );
        });
    });
}

export class MachineActionable402PaidAccessAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/machine-actionable-402-paid-access",
    category: "access-crawl-control",
    title: "A 402 tells a crawler how to pay",
    failureTitle:
      "This site charges crawlers but does not say how to pay in a form they can read",
    description:
      "Looks at every 402 the crawler-UA probes and the browser baseline received, and asks whether any machine-readable payment mechanism came with it: a `crawler-price` header, an x402 `PAYMENT-REQUIRED` challenge, or an RSL licence with a crawl payment covering the path. A 402 carrying only an HTML page is a price tag no crawler can read.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "medium",
    dossier:
      "docs/evidence/audits/access-crawl-control/machine-actionable-402-paid-access.md",
    // Gate exemption: being refused is what this category reports.
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "Charging for crawler access is a legitimate choice, and 402 is the status code for it. But a crawler is a program: it can pay only what it can parse. A 402 whose body is an HTML page explaining your licensing terms reads, to the client, as an unexplained refusal — the same outcome as a 403, after you built a paywall meant to earn revenue. A 402 that a shared cache is allowed to store is worse: the next crawler gets a stored refusal even after paying.",
      fix: 'Send one of the machine-readable forms with the 402: Cloudflare’s `crawler-price: USD 0.01`, an x402 `PAYMENT-REQUIRED` challenge listing what you accept, or a `Link: rel=license` pointing at an RSL document whose `<payment type="crawl">` covers the path. Mark the response `Cache-Control: no-store` so a proxy cannot hand your 402 to a crawler that already paid.',
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/machine-actionable-402-paid-access/",
      tags: ["402", "pay-per-crawl", "x402", "rsl", "crawlers"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const urls = [`${ctx.baseUrl}/`];
    const tree = await siteSitemapTree(ctx);
    for (const entry of sampleEntries(tree.entries, MAX_SITEMAP_PROBES)) {
      if (!urls.includes(entry.loc)) urls.push(entry.loc);
    }
    const llms = ctx.rootFiles["/llms.txt"];
    if (llms && llms.status === 200) urls.push(`${ctx.baseUrl}/llms.txt`);

    // The same arguments the edge-parity audit passes, so this costs no request:
    // the per-scan cache already holds every one of these probes.
    const probes = await sharedUaProbes(
      ctx,
      urls,
      AI_CRAWLER_UAS.map((agent) => agent.token),
    );

    // An RSL licence reached through robots.txt or a Link header. Read from what
    // the scan already fetched; the licensing audit is the one that fetches it.
    const rslDocuments: string[] = [];
    for (const page of ctx.pages) {
      page.$('script[type="application/rsl+xml"]').each((_i, el) => {
        const xml = page.$(el).text();
        if (xml.trim() !== "") rslDocuments.push(xml);
      });
    }
    const robots = ctx.rootFiles["/robots.txt"];
    const licenceAdvertised =
      directiveLines(robots?.status === 200 ? robots.body : "", "license")
        .length > 0 ||
      ctx.pages.some(
        (page) =>
          linksWithRel(page.fetchResult.headers?.["link"] ?? "", "license")
            .length > 0,
      );

    const challenges: PaymentChallenge[] = [];
    for (const probe of probes) {
      const baseline402 = probe.baselineStatus === 402;
      if (probe.probeStatus !== 402 && !baseline402) continue;
      const headers =
        probe.probeStatus === 402 ? probe.probeHeaders : probe.baselineHeaders;
      const path = (() => {
        try {
          return new URL(probe.url).pathname;
        } catch {
          return "/";
        }
      })();

      const mechanisms: string[] = [];
      const problems: string[] = [];

      const price = headers["crawler-price"];
      if (price !== undefined) {
        if (!CRAWLER_PRICE.test(price.trim())) {
          problems.push(
            `crawler-price: "${price}" is not "<ISO 4217 code> <decimal>"`,
          );
        } else if (!isIso4217(price.trim().split(/\s+/)[0]!)) {
          problems.push(
            `crawler-price: "${price}" names a currency that is not an active ISO 4217 code`,
          );
        } else {
          mechanisms.push("crawler-price header");
        }
      }

      const x402 = headers["payment-required"];
      if (x402 !== undefined) {
        const read = readX402(x402);
        if (read.ok) mechanisms.push("x402 PAYMENT-REQUIRED challenge");
        else if (read.problem) problems.push(read.problem);
      }

      if (rslDocuments.some((xml) => rslCoversCrawl(xml, path))) {
        mechanisms.push("RSL licence with a crawl payment");
      } else if (licenceAdvertised) {
        problems.push(
          'an RSL licence is advertised but this scan did not read a <payment type="crawl"> covering this path',
        );
      }

      const cacheControl = headers["cache-control"] ?? "";
      if (
        cacheControl !== "" &&
        !/no-store|private|max-age=0/i.test(cacheControl)
      ) {
        problems.push(
          `Cache-Control: ${cacheControl} lets a shared cache serve this 402 to other clients`,
        );
      }

      challenges.push({
        url: probe.url,
        token: probe.token,
        mechanisms,
        problems,
        contentType: (headers["content-type"] ?? "")
          .split(";")[0]!
          .trim()
          .toLowerCase(),
        cacheControl,
        hitsBrowsers: baseline402,
      });
    }

    if (challenges.length === 0) {
      return this.notApplicable(
        "No 402 was observed: this site does not charge for crawler access.",
        "A machine-readable payment mechanism on any 402 response",
        `${probes.length} crawler probe(s), none answered 402`,
      );
    }

    const unreadable = challenges.filter((c) => c.mechanisms.length === 0);
    const browserFacing = challenges.filter((c) => c.hitsBrowsers);
    const findings: string[] = [];
    for (const challenge of challenges) {
      const where = `${challenge.token} at ${challenge.url}`;
      if (challenge.mechanisms.length === 0) {
        findings.push(
          `${where}: 402 with ${challenge.contentType || "no content type"} and no crawler-price, x402 challenge or RSL crawl payment`,
        );
      }
      for (const problem of challenge.problems)
        findings.push(`${where}: ${problem}`);
      if (challenge.hitsBrowsers) {
        findings.push(
          `${where}: the browser baseline was answered 402 too, so the rule is hitting people`,
        );
      }
    }

    const displayValue = `${challenges.length - unreadable.length}/${challenges.length} 402s payable`;
    const expected =
      "Every 402 carries a payment mechanism a crawler can act on";
    const found = `${challenges.length} 402 response(s); ${unreadable.length} carry no machine-readable payment mechanism; ${browserFacing.length} also answered a browser.`;
    const details = {
      challenges: challenges.length,
      actionable: challenges.length - unreadable.length,
      mechanisms: [...new Set(challenges.flatMap((c) => c.mechanisms))],
      browserFacing402s: browserFacing.length,
      findings: findings.slice(0, REPORTED),
    };

    if (unreadable.length > 0) {
      return {
        ...this.fail(
          `${unreadable.length} of ${challenges.length} 402 response(s) tell a crawler nothing about how to pay.`,
          expected,
          found,
          "Send a crawler-price header, an x402 PAYMENT-REQUIRED challenge, or a Link: rel=license pointing at an RSL document with a crawl payment.",
        ),
        displayValue,
        details,
      };
    }

    if (findings.length > 0) {
      return {
        ...this.warn(
          `Every 402 is payable, but ${findings.length} problem(s) remain around them.`,
          expected,
          found,
          "Mark the 402 no-store so a shared cache cannot serve it to a crawler that already paid, and keep the rule off browser traffic.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${challenges.length} 402 response(s) carry a payment mechanism a crawler can act on.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
