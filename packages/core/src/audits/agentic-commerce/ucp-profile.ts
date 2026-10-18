import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { NO_UCP_PROFILE, UCP_PATH, readUcpProfile } from "./_ucp";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isAbsoluteHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Service bindings whose `endpoint` is not an absolute https URL. Each
 * service maps to an array of bindings in Google's example; a binding with no
 * endpoint names nowhere to send a request.
 */
function badEndpoints(services: Record<string, unknown>): string[] {
  const bad: string[] = [];
  for (const [name, bindings] of Object.entries(services)) {
    const list = Array.isArray(bindings) ? bindings : [bindings];
    for (const binding of list) {
      const endpoint = isObject(binding) ? binding["endpoint"] : undefined;
      if (typeof endpoint !== "string" || !isAbsoluteHttps(endpoint)) {
        bad.push(
          typeof endpoint === "string"
            ? `${name} (${endpoint})`
            : `${name} (no endpoint)`,
        );
      }
    }
  }
  return bad;
}

const EXPECTED = `${UCP_PATH} parses as a UCP business profile: a \`ucp\` object with a version, at least one service with an https endpoint, and its capabilities`;

const SAMPLE = `// ${UCP_PATH} — Google Merchant UCP profile
{
  "ucp": {
    "version": "2026-04-08",
    "services": {
      "dev.ucp.shopping": [{
        "version": "2026-04-08",
        "transport": "rest",
        "endpoint": "https://yoursite.com/ucp/v1"
      }]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [{ "version": "2026-04-08" }]
    }
  },
  "signing_keys": [{ "kid": "business_2026", "kty": "EC", "crv": "P-256", "x": "…", "y": "…" }]
}`;

export class UcpProfileAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/ucp-profile",
    category: "agentic-commerce",
    title: "UCP business profile is readable",
    failureTitle: "UCP business profile cannot be read",
    description:
      "Reads the Universal Commerce Protocol business profile at `/.well-known/ucp`, which Google's Merchant UCP integration fetches to negotiate checkout capabilities with the store. A site that publishes no profile is not applicable. A profile that does not parse, has no `ucp` object or declares no services fails; a missing version, missing capabilities or a non-https service endpoint warns.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agentic-commerce/ucp-profile.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Google reads the UCP profile to learn which checkout features the store supports, which versions it speaks and where to send requests. A profile Google cannot read leaves the store out of agentic checkout even when the rest of the integration is in place.",
      fix: "Serve the profile as public JSON at `/.well-known/ucp`, with no authentication. Put `version`, `services` and `capabilities` inside a `ucp` object, give every service an absolute https `endpoint`, and publish the `signing_keys` Google uses to verify your messages.",
      code: SAMPLE,
      effort: FixEffort.Moderate,
      docsUrl:
        "https://developers.google.com/merchant/ucp/guides/overview/ucp-profile",
      tags: ["ucp", "commerce", "checkout", "well-known"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const read = readUcpProfile(ctx);

    if (read.kind === "absent") {
      return this.notApplicable(NO_UCP_PROFILE.message, EXPECTED, read.found);
    }

    if (read.kind === "broken") {
      return this.fail(
        `The UCP profile at ${UCP_PATH} is not a JSON object, so Google cannot read it.`,
        EXPECTED,
        read.found,
        { priority: CheckPriority.High, code: SAMPLE },
      );
    }

    const ucp = read.profile["ucp"];
    if (!isObject(ucp)) {
      return this.fail(
        `The UCP profile at ${UCP_PATH} has no \`ucp\` object. Google's profile format puts the version, services and capabilities inside it.`,
        EXPECTED,
        "No `ucp` object at the top level",
        { priority: CheckPriority.High, code: SAMPLE },
      );
    }

    const services = isObject(ucp["services"]) ? ucp["services"] : {};
    const serviceCount = Object.keys(services).length;
    if (serviceCount === 0) {
      return this.fail(
        `The UCP profile at ${UCP_PATH} declares no services, so it tells Google nowhere to send requests.`,
        EXPECTED,
        "`ucp.services` is missing or empty",
        { priority: CheckPriority.High, code: SAMPLE },
      );
    }

    const capabilities = isObject(ucp["capabilities"])
      ? ucp["capabilities"]
      : {};
    const capabilityCount = Object.keys(capabilities).length;
    const version =
      typeof ucp["version"] === "string" && ucp["version"].trim()
        ? ucp["version"]
        : undefined;
    const signingKeys = Array.isArray(read.profile["signing_keys"])
      ? read.profile["signing_keys"].length
      : 0;
    const details = {
      ...(version ? { version } : {}),
      services: serviceCount,
      capabilities: capabilityCount,
      signingKeys,
    };

    const problems: string[] = [];
    if (!version) {
      problems.push(
        "it names no `ucp.version`, which Google uses to pick the protocol version",
      );
    }
    if (capabilityCount === 0) {
      problems.push(
        "it declares no capabilities, so Google cannot tell which checkout features the store supports",
      );
    }
    const bad = badEndpoints(services);
    if (bad.length > 0) {
      problems.push(
        `these services have no absolute https endpoint: ${bad.join(", ")}`,
      );
    }

    if (problems.length > 0) {
      return {
        ...this.warn(
          `The UCP profile at ${UCP_PATH} parses, but ${problems.join("; ")}.`,
          EXPECTED,
          problems.join("; "),
          { priority: CheckPriority.Medium, code: SAMPLE },
        ),
        details: { code: SAMPLE, ...details },
      };
    }

    return {
      ...this.pass(
        `UCP business profile found at ${UCP_PATH}: version ${version}, ${serviceCount} service(s), ${capabilityCount} capabilit${capabilityCount === 1 ? "y" : "ies"}.`,
        EXPECTED,
        `UCP profile v${version}, ${serviceCount} service(s), ${capabilityCount} capabilities`,
      ),
      details,
    };
  }
}
