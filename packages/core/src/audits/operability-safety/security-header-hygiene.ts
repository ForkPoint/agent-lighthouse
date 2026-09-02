import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";

/**
 * One root file, one signal: does a published `/.well-known/security.txt`
 * conform to RFC 9116?
 *
 * This audit used to report four security-hygiene signals in a single table —
 * `Strict-Transport-Security` (v1 8.2), `Content-Security-Policy` (v1 8.3),
 * `X-Content-Type-Options: nosniff` (v1 8.4) and security.txt (v1 8.7). The
 * three header rows were removed on 2026-08-24: the researched signal behind
 * them grades **D** with `Consumers: none-known` and `Recommended tier: delete`,
 * and `policy.md` gives grade D exactly two destinations — experimental behind a
 * flag with a live draft-spec trajectory, or rejected. They have no trajectory.
 * The two other headers in the same researched signal (Referrer-Policy 8.5,
 * Permissions-Policy 8.6) were already removed outright in v2 for that reason,
 * so keeping three of the five was an inconsistency rather than a distinction.
 *
 * The grade is **C**, which is the grade the security.txt signal carries in its
 * own research: a real IETF document with real but small adoption (~1.25% of the
 * top 1M in 2025) and no documented AI consumer. The audit previously shipped at
 * B, but that B belongs to the HTTPS/TLS signal, which this audit never measured
 * and which already ships scored as `access-crawl-control/https-enabled`.
 *
 * The tier stays `informative` (weight 0, excluded from every score) and `fail`
 * is never returned — the approved v2 map row for 8.2 rules this signal "weight
 * 0, never fails a site".
 *
 * Detection is unchanged and deliberately parse-not-probe: the well-known
 * location with the legacy top-level path as a fallback, an SPA soft-404 guard,
 * and the two fields RFC 9116 requires (`Contact`, and an `Expires` date that
 * has not passed). A site that publishes no security.txt at all is reported as
 * not applicable, not warned: RFC 9116 is Informational and defines conformance
 * for a file that exists — it does not oblige a site to have one.
 *
 * See `docs/evidence/audits/operability-safety/security-header-hygiene.md`.
 * The check id is unchanged for now; renaming it to
 * `operability-safety/security-txt` touches the registry index, the migration
 * map and the sunset paperwork, and is handled as one central change.
 */

const EXPECTED =
  "A /.well-known/security.txt served as plain text with an RFC 9116 Contact field " +
  "and an Expires date in the future";

/** Read the first value of an RFC 9116 field, ignoring case and comment lines. */
function securityTxtField(body: string, field: string): string | undefined {
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    if (line.slice(0, sep).trim().toLowerCase() !== field) continue;
    const value = line.slice(sep + 1).trim();
    if (value) return value;
  }
  return undefined;
}

/** A 200 that is really the SPA HTML fallback, not a text file. */
function looksLikeHtml(body: string): boolean {
  const head = body.trimStart().slice(0, 200).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.includes("<html")
  );
}

export class SecurityHeaderHygieneAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/security-header-hygiene",
    category: "operability-safety",
    title: "security.txt (RFC 9116)",
    failureTitle: "security.txt does not conform to RFC 9116",
    description:
      "Reports whether a published /.well-known/security.txt conforms to RFC 9116 — plain text, a Contact field, and an Expires date in the future. RFC 9116 is an Informational document whose stated consumers are human security researchers and vulnerability-notification tooling; no AI crawler, retrieval pipeline or answer engine is documented to read it, so this audit is informative only — it carries weight 0 and never affects your score. A site that publishes no security.txt is reported as not applicable rather than warned.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier:
      "docs/evidence/audits/operability-safety/security-header-hygiene.md",
    requires: ["origin-reachable"],
    defaultPriority: "low",
    guidance: {
      impact:
        "Vulnerability-disclosure hygiene, reported for completeness. A conformant security.txt tells a security researcher who to contact; it is read by researchers and disclosure scanners, not by AI agents. Publishing one changes nothing about how an agent retrieves, parses or cites the site, which is why nothing here moves your score. If you do publish one, an expired or contactless file is worse than none: it advertises a disclosure route that no longer works.",
      fix: "Only relevant if you already publish, or want to publish, a security.txt. Serve it as plain text at /.well-known/security.txt (the legacy top-level /security.txt is still accepted as a fallback), give it a Contact field, and give it an Expires date in the future — RFC 9116 requires both, and a file that returns your SPA index.html instead of text counts as absent. Refresh the Expires date before it passes.",
      code: [
        "# /.well-known/security.txt",
        "Contact: mailto:security@example.com",
        "Expires: 2027-12-31T23:59:59.000Z",
      ].join("\n"),
      effort: "trivial",
      docsUrl: "https://www.rfc-editor.org/rfc/rfc9116.html",
      tags: ["security", "security.txt", "rfc9116"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const wellKnown = ctx.rootFiles["/.well-known/security.txt"];
    const legacy = ctx.rootFiles["/security.txt"];

    // The scanner always fetches the well-known location, so an absent key is
    // not "no file" — it is "nothing was measured", and the two must not read
    // the same in the report.
    if (wellKnown === undefined && legacy === undefined) {
      return this.notApplicable(
        "The security.txt location was never fetched, so nothing could be measured.",
        EXPECTED,
        "no response recorded for /.well-known/security.txt",
        `${ctx.baseUrl}/.well-known/security.txt`,
      );
    }

    const file =
      wellKnown?.status === 200
        ? wellKnown
        : legacy?.status === 200
          ? legacy
          : undefined;
    const usedLegacy = file !== undefined && file === legacy;
    const path = usedLegacy
      ? "/security.txt (legacy location)"
      : "/.well-known/security.txt";
    const url = `${ctx.baseUrl}${usedLegacy ? "/security.txt" : "/.well-known/security.txt"}`;

    // Publishing the file is optional: RFC 9116 is Informational and defines
    // conformance for a file that exists. Warning ~99% of the web for not doing
    // an optional thing no agent reads was a claim the evidence never made.
    if (!file) {
      const status = wellKnown?.status ?? legacy?.status;
      return this.notApplicable(
        "This site does not publish a security.txt. RFC 9116 is an Informational document — publishing the file is optional, and no AI agent is documented to read it.",
        EXPECTED,
        `/.well-known/security.txt returned ${status}`,
        url,
      );
    }

    if (looksLikeHtml(file.body)) {
      return this.warn(
        `${path} returned 200 but the body is HTML, so no security.txt is really published there.`,
        EXPECTED,
        `${path} returned 200 but the body is HTML (soft-404)`,
        { priority: "low" },
        url,
      );
    }

    const contact = securityTxtField(file.body, "contact");
    if (!contact) {
      return this.warn(
        `${path} is published but has no Contact field, which RFC 9116 requires.`,
        EXPECTED,
        `${path} has no Contact field (RFC 9116 requires it)`,
        { priority: "low" },
        url,
      );
    }

    const expires = securityTxtField(file.body, "expires");
    if (!expires) {
      return this.warn(
        `${path} is published but has no Expires field, which RFC 9116 requires.`,
        EXPECTED,
        `${path} has no Expires field (RFC 9116 requires it)`,
        { priority: "low" },
        url,
      );
    }

    const expiresAt = new Date(expires);
    if (Number.isNaN(expiresAt.getTime())) {
      return this.warn(
        `${path} has an Expires value that cannot be parsed as a date.`,
        EXPECTED,
        `${path} has an unparseable Expires value — "${expires}"`,
        { priority: "low" },
        url,
      );
    }

    if (expiresAt.getTime() <= Date.now()) {
      return this.warn(
        `${path} expired on ${expires}, so RFC 9116 treats its contents as no longer valid.`,
        EXPECTED,
        `${path} expired on ${expires}`,
        { priority: "low" },
        url,
      );
    }

    return this.pass(
      `${path} conforms to RFC 9116 — Contact present, Expires ${expires}.`,
      EXPECTED,
      `${path} with Contact and Expires ${expires}`,
      url,
    );
  }
}
