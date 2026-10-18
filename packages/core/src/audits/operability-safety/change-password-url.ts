import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import { sharedProbeUrl } from "#core/gatherers/discovery";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

const PATH = "/.well-known/change-password";

/** Redirect statuses the W3C draft names for this URL. */
const SPEC_REDIRECTS = new Set([302, 303, 307]);

/** Permanent redirects: followed by clients, but not what the draft lists. */
const PERMANENT_REDIRECTS = new Set([301, 308]);

/** Statuses that say the URL is not there. */
const ABSENT = new Set([404, 410]);

const PASSWORD_INPUT = /<input\b[^>]*\btype\s*=\s*["']?password\b/i;
const META_REFRESH = /<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh\b/i;

const EXPECTED = `${PATH} redirects with 302, 303 or 307 to the page where a signed-in user changes their password`;

const SAMPLE = `# nginx
location = /.well-known/change-password {
  return 302 /account/password;
}`;

/** True when a sampled page has a password field, so the site has accounts. */
function hasPasswordField(ctx: CheckContext): boolean {
  return ctx.pages.some(
    (page) => page.$('input[type="password" i]').length > 0,
  );
}

export class ChangePasswordUrlAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/change-password-url",
    category: "operability-safety",
    title: "Change-password URL redirects to the form",
    failureTitle: "Change-password URL is missing or broken",
    description:
      "On a site with accounts, checks that `/.well-known/change-password` redirects to the page where a user changes their password. Safari, Chrome's password manager and Chrome's automated password change open this URL for the user. Reported, not scored: none of those consumers is documented as an AI agent.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/operability-safety/change-password-url.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Password managers send a user straight to the change-password form through this URL. Chrome's automated password change goes further and completes the change for the user, and Google says the URL must redirect to the form for that to work.",
      fix: "Answer `/.well-known/change-password` with a 302, 303 or 307 redirect to your change-password page. Do not host the form at the well-known URL itself.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl: "https://w3c.github.io/webappsec-change-password-url/",
      tags: ["password", "well-known", "account", "password-manager"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    if (!hasPasswordField(ctx)) {
      return this.notApplicable(
        "No sampled page has a password field, so the site shows no sign of accounts.",
        EXPECTED,
        "No password field on the sampled pages",
      );
    }

    const url = `${ctx.baseUrl}${PATH}`;
    const probe = await sharedProbeUrl(ctx, url, { followRedirects: false });
    if (!probe || probe.status === 0) {
      return this.notApplicable(
        `${PATH} could not be fetched, so its answer is unknown.`,
        EXPECTED,
        probe?.error ?? "No response",
      );
    }

    if (ABSENT.has(probe.status)) {
      return this.warn(
        `The site has accounts, but ${PATH} answers HTTP ${probe.status}. Password managers cannot send users to the change-password form.`,
        EXPECTED,
        `HTTP ${probe.status}`,
        { priority: CheckPriority.Low, code: SAMPLE },
      );
    }

    if (probe.status === 200) {
      if (META_REFRESH.test(probe.body)) {
        return this.pass(
          `${PATH} answers with a meta refresh, which the W3C draft allows.`,
          EXPECTED,
          "HTTP 200 with a meta refresh",
        );
      }
      if (PASSWORD_INPUT.test(probe.body)) {
        return this.warn(
          `${PATH} hosts the change-password form itself. The W3C draft says servers MUST NOT host the page at the well-known URL; redirect to it instead.`,
          EXPECTED,
          "HTTP 200 with a password field at the well-known URL",
          { priority: CheckPriority.Low, code: SAMPLE },
        );
      }
      // A 200 with neither a redirect nor a form is usually the site's answer
      // for every unknown path. It proves nothing either way.
      return this.notApplicable(
        `${PATH} answers 200 with no redirect and no form, which reads as the site's catch-all page.`,
        EXPECTED,
        "HTTP 200 with no redirect and no password field",
      );
    }

    const isRedirect =
      SPEC_REDIRECTS.has(probe.status) || PERMANENT_REDIRECTS.has(probe.status);
    if (!isRedirect) {
      return this.notApplicable(
        `${PATH} answers HTTP ${probe.status}, so whether it is supported is unknown.`,
        EXPECTED,
        `HTTP ${probe.status}`,
      );
    }

    const location = probe.headers["location"];
    let target: string | undefined;
    try {
      target = location ? new URL(location, url).href : undefined;
    } catch {
      target = undefined;
    }
    if (!target) {
      return this.fail(
        `${PATH} answers HTTP ${probe.status} with no usable Location header, so it redirects nowhere.`,
        EXPECTED,
        `HTTP ${probe.status}, Location: ${location ?? "(none)"}`,
        { priority: CheckPriority.Low, code: SAMPLE },
      );
    }

    const landed = await sharedProbeUrl(ctx, target, { followRedirects: true });
    if (!landed || landed.status === 0) {
      return this.warn(
        `${PATH} redirects to ${target}, but that page could not be fetched.`,
        EXPECTED,
        landed?.error ?? `Redirect target ${target} gave no response`,
        { priority: CheckPriority.Low, code: SAMPLE },
      );
    }
    if (landed.status >= 400) {
      return this.fail(
        `${PATH} redirects to ${target}, which answers HTTP ${landed.status}. Users and password managers land on an error page.`,
        EXPECTED,
        `Redirect target answers HTTP ${landed.status}`,
        { priority: CheckPriority.Low, code: SAMPLE },
      );
    }

    if (PERMANENT_REDIRECTS.has(probe.status)) {
      return this.warn(
        `${PATH} redirects with HTTP ${probe.status}. The W3C draft lists only 302, 303 and 307.`,
        EXPECTED,
        `HTTP ${probe.status} to ${target}`,
        { priority: CheckPriority.Low, code: SAMPLE },
      );
    }

    return this.pass(
      `${PATH} redirects with HTTP ${probe.status} to ${target}, which answers HTTP ${landed.status}.`,
      EXPECTED,
      `HTTP ${probe.status} to ${target}`,
    );
  }
}
