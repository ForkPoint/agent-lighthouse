// Split landed 2026-08-22 (Plan 4, Task 9): the Product half of v1 3.8
// (service-product-schema) moved into structured-data/advanced-product-details;
// what is left here is the Service half, narrowed to Service/ProfessionalService.
// Evidence dossier: docs/evidence/audits/structured-data/service-schema.md

import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { flattenJsonLd } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Service plus the legacy ProfessionalService shape retained for compatibility. */
const SERVICE_TYPES = ["Service", "ProfessionalService"];

function matchesAnyType(
  schema: Record<string, unknown>,
  types: string[],
): boolean {
  return types.some((t) => {
    const st = schema["@type"];
    if (typeof st === "string") return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

/**
 * Coverage fields, not mandatory Schema.org properties or consumer
 * requirements. ProfessionalService is a LocalBusiness subtype: it is itself
 * the provider and defines no `provider` property, so only a Service node is
 * asked for one.
 */
const SERVICE_PROPS = ["name", "provider"] as const;
const PROFESSIONAL_SERVICE_PROPS = ["name"] as const;

function missingProps(node: Record<string, unknown>): string[] {
  const props = matchesAnyType(node, ["Service"])
    ? SERVICE_PROPS
    : PROFESSIONAL_SERVICE_PROPS;
  return props.filter((prop) => !node[prop]);
}

export class ServiceSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/service-schema",
    category: "structured-data",
    title: "Service schema",
    failureTitle: "Service schema",
    description:
      "Reports name and provider coverage in existing Service markup. No reviewed source documents an agent requirement for these fields; this check does not affect the score.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/structured-data/service-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "These optional fields describe a service and its provider. Their coverage is informational; no agent benefit is established.",
      fix: "If you publish Service markup, describe the service with name and provider where applicable. These fields are not required for an agent-readiness score.",
      code: `{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Your Service Name",
  "description": "A clear description of what this service provides.",
  "provider": {
    "@type": "Organization",
    "name": "Your Company"
  }
}`,
      effort: FixEffort.Easy,
      docsUrl: "https://schema.org/Service",
      tags: ["json-ld", "schema", "service"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const services = allSchemas(ctx).filter((s) =>
      matchesAnyType(s as Record<string, unknown>, SERVICE_TYPES),
    );

    if (services.length === 0) {
      return this.notApplicable(
        "No Service schema found; this optional markup is not required.",
        "Name and provider coverage in existing Service markup.",
        "No Service markup.",
      );
    }

    // Judge the best-covered node, not `services[0]`. A listing stub hoisted
    // ahead of the real Service node used to decide the verdict for the whole
    // scan; the site is credited for its most complete markup instead.
    const best = services
      .map((s) => missingProps(s as Record<string, unknown>))
      .reduce((a, b) => (b.length < a.length ? b : a));

    if (best.length === 0) {
      return this.pass(
        "Service schema found with name and provider.",
        "Service schema with name and provider.",
        `Complete Service schema (${services.length} total)`,
      );
    }

    return this.warn(
      `Service schema found but missing: ${best.join(", ")}.`,
      "Service schema with name and provider.",
      `Service schema missing ${best.join(", ")} (${services.length} total)`,
      {
        priority: CheckPriority.Medium,
        description: `Existing markup omits ${best.join(", ")}. Add applicable descriptive fields if useful; this informational finding does not establish an agent requirement.`,
        code: `{
  "@type": "Service",
  "name": "Service Name",
  "provider": { "@type": "Organization", "name": "Your Company" }
}`,
      },
    );
  }
}
