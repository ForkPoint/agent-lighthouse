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

/** Transport keys of the 2026-01-11 profile shape, one object per transport. */
const TRANSPORT_KEYS = ["rest", "mcp", "a2a", "embedded"] as const;

/**
 * The bindings a service declares, in either published shape. Current UCP
 * (2026-04-08 onward) maps each service to an array of bindings that carry
 * `transport` and `endpoint`; the 2026-01-11 shape maps it to one object with
 * a nested object per transport (`rest.endpoint`, `mcp.endpoint`, ...).
 */
function bindingsOf(service: unknown): Record<string, unknown>[] {
  if (Array.isArray(service)) return service.filter(isObject);
  if (!isObject(service)) return [];
  const nested = TRANSPORT_KEYS.map((key) => service[key]).filter(isObject);
  return nested.length > 0 ? nested : [service];
}

/**
 * Declared endpoints that are not absolute https URLs. `endpoint` is optional
 * in the UCP specification, and an `embedded` binding has none, so only an
 * endpoint that is present is judged; the spec says a present one "MUST be a
 * valid URL with scheme (https)".
 */
function badEndpoints(services: Record<string, unknown>): string[] {
  const bad: string[] = [];
  for (const [name, service] of Object.entries(services)) {
    for (const binding of bindingsOf(service)) {
      const endpoint = binding["endpoint"];
      if (endpoint === undefined) continue;
      if (typeof endpoint !== "string" || !isAbsoluteHttps(endpoint)) {
        bad.push(
          `${name} (${typeof endpoint === "string" ? endpoint : JSON.stringify(endpoint)})`,
        );
      }
    }
  }
  return bad;
}

/** Capabilities as a keyed object (current) or an array (2026-01-11). */
function countCapabilities(capabilities: unknown): number {
  if (Array.isArray(capabilities)) return capabilities.length;
  return isObject(capabilities) ? Object.keys(capabilities).length : 0;
}

/** Signing keys: `keys[]` in the current spec, `signing_keys[]` before it. */
function countSigningKeys(profile: Record<string, unknown>): number {
  for (const key of ["keys", "signing_keys"]) {
    const list = profile[key];
    if (Array.isArray(list)) return list.length;
  }
  return 0;
}

const EXPECTED = `${UCP_PATH} parses as a UCP business profile: a \`ucp\` object with a version and at least one service, and every declared endpoint absolute https`;

const SAMPLE = `// ${UCP_PATH} — Google Merchant UCP profile
{
  "ucp": {
    "version": "2026-08-25",
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
  "keys": [{ "kid": "business_2026", "kty": "EC", "crv": "P-256", "x": "…", "y": "…" }]
}`;

export class UcpProfileAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/ucp-profile",
    category: "agentic-commerce",
    title: "UCP business profile is readable",
    failureTitle: "UCP business profile cannot be read",
    description:
      "Reads the Universal Commerce Protocol business profile at `/.well-known/ucp`. Google's Merchant UCP guide says the profile will enable Google to negotiate checkout capabilities with the store. A site that publishes no profile, or answers the path with JSON that has no `ucp` key, is not applicable. A profile that does not parse or declares no services fails; a missing version or a declared endpoint that is not absolute https warns.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agentic-commerce/ucp-profile.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Google's Merchant UCP guide says the profile tells Google which checkout features the store supports, which versions it speaks and where to send requests. A profile that cannot be read gives the integration none of that.",
      fix: "Serve the profile as public JSON at `/.well-known/ucp`, with no authentication. Put `version` and `services` (and, optionally, `capabilities`) inside a `ucp` object, make every declared `endpoint` an absolute https URL, and publish the signing keys in the top-level `keys` array.",
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

    const { ucp } = read;

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

    const capabilityCount = countCapabilities(ucp["capabilities"]);
    const version =
      typeof ucp["version"] === "string" && ucp["version"].trim()
        ? ucp["version"]
        : undefined;
    const signingKeys = countSigningKeys(read.profile);
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
    const bad = badEndpoints(services);
    if (bad.length > 0) {
      problems.push(
        `these declared endpoints are not absolute https URLs: ${bad.join(", ")}`,
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
