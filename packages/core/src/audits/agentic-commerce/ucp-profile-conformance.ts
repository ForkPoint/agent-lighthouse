import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { AuditMeta, AuditResult } from "#core/types";
import type { CheckContext } from "#core/check-context";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { NO_UCP_PROFILE, readUcpProfile, UCP_PATH } from "./_ucp";
import { validUcpConstraints } from "./_ucp-constraints";

const SUPPORTED_VERSIONS = ["2026-01-11", "2026-04-08", "2026-08-25"] as const;
const LEGACY_VERSION = "2026-01-11";
const DATE_VERSION = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_REVERSE_DOMAIN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/;
const CURRENT_REVERSE_DOMAIN =
  /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9_])?)+$/;
let uriValidator: import("ajv").ValidateFunction | undefined;

/** JSON Schema URI syntax differs from WHATWG URL parsing and normalization. */
function isUri(value: string): boolean {
  if (!uriValidator) {
    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv, ["uri"]);
    uriValidator = ajv.compile({ type: "string", format: "uri" });
  }
  return uriValidator(value);
}
const MAX_ISSUES = 40;
const EXPECTED =
  "Declared UCP capabilities and payment handlers match their published business-profile declaration schema for the selected protocol version";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A local declaration check, never a fetch of a merchant-provided schema. */
class DeclarationCheck {
  private readonly reverseDomain: RegExp;

  constructor(version: string) {
    this.reverseDomain =
      version === "2026-08-25" ? CURRENT_REVERSE_DOMAIN : LEGACY_REVERSE_DOMAIN;
  }

  readonly issues: string[] = [];
  issueCount = 0;
  capabilityCount = 0;
  handlerCount = 0;
  validCapabilities = 0;
  validHandlers = 0;
  constraintValidationLimited = false;
  readonly constraintValidationLimits: string[] = [];

  problem(path: string, rule: string): void {
    this.issueCount++;
    if (this.issues.length < MAX_ISSUES) {
      this.issues.push(`${path.slice(0, 220)}: ${rule}`);
    }
  }

  string(
    object: Record<string, unknown>,
    key: string,
    path: string,
    required = false,
  ): void {
    if (!(key in object) && !required) return;
    if (typeof object[key] !== "string") {
      this.problem(`${path}.${key}`, "must be a string");
    }
  }

  uri(
    object: Record<string, unknown>,
    key: string,
    path: string,
    required = false,
  ): void {
    if (!(key in object) && !required) return;
    const value = object[key];
    if (typeof value === "string" && isUri(value)) return;
    this.problem(`${path}.${key}`, "must be an absolute URI");
  }

  version(object: Record<string, unknown>, path: string): void {
    if (
      typeof object["version"] !== "string" ||
      !DATE_VERSION.test(object["version"])
    ) {
      this.problem(`${path}.version`, "must use YYYY-MM-DD format");
    }
  }

  config(
    object: Record<string, unknown>,
    path: string,
    required = false,
  ): void {
    if ((required || "config" in object) && !isObject(object["config"])) {
      this.problem(`${path}.config`, "must be an object");
    }
  }

  entity(object: Record<string, unknown>, path: string): void {
    this.version(object, path);
    this.uri(object, "spec", path);
    this.uri(object, "schema", path);
    this.string(object, "id", path);
    this.config(object, path);
  }

  name(value: unknown, path: string): void {
    if (typeof value !== "string" || !this.reverseDomain.test(value)) {
      this.problem(path, "must be a reverse-domain name");
    }
  }

  capability(value: unknown, path: string, version: string): void {
    this.capabilityCount++;
    const before = this.issueCount;
    if (!isObject(value)) {
      this.problem(path, "must be an object");
      return;
    }
    if (version === LEGACY_VERSION) {
      this.version(value, path);
      this.name(value["name"], `${path}.name`);
      this.uri(value, "spec", path, true);
      this.uri(value, "schema", path, true);
      this.config(value, path);
    } else {
      this.entity(value, path);
      if (version === "2026-08-25" && !("schema" in value)) {
        this.problem(
          `${path}.schema`,
          "is required for this business-profile version",
        );
      }
    }
    if ("extends" in value) {
      const parent = value["extends"];
      if (version !== LEGACY_VERSION && Array.isArray(parent)) {
        if (parent.length === 0) {
          this.problem(`${path}.extends`, "must contain at least one parent");
        }
        parent.forEach((item, index) =>
          this.name(item, `${path}.extends[${index}]`),
        );
      } else {
        this.name(parent, `${path}.extends`);
      }
    }
    if (before === this.issueCount) this.validCapabilities++;
  }

  handler(value: unknown, path: string, version: string): void {
    this.handlerCount++;
    const before = this.issueCount;
    let constraintsComplete = true;
    if (!isObject(value)) {
      this.problem(path, "must be an object");
      return;
    }
    if (version === LEGACY_VERSION) {
      this.version(value, path);
      this.string(value, "id", path, true);
      // The legacy handler name is a string; its schema has no name pattern.
      this.string(value, "name", path, true);
      this.uri(value, "spec", path, true);
      this.uri(value, "config_schema", path, true);
      this.config(value, path, true);
      const instruments = value["instrument_schemas"];
      if (!Array.isArray(instruments)) {
        this.problem(`${path}.instrument_schemas`, "must be an array");
      } else {
        instruments.forEach((item, index) => {
          if (typeof item !== "string" || !isUri(item)) {
            this.problem(
              `${path}.instrument_schemas[${index}]`,
              "must be an absolute URI",
            );
          }
        });
      }
    } else {
      this.entity(value, path);
      if (!("id" in value)) this.string(value, "id", path, true);
      if ("available_instruments" in value) {
        const instruments = value["available_instruments"];
        if (!Array.isArray(instruments) || instruments.length === 0) {
          this.problem(
            `${path}.available_instruments`,
            "must be a nonempty array",
          );
        } else {
          instruments.forEach((instrument, index) => {
            const itemPath = `${path}.available_instruments[${index}]`;
            if (!isObject(instrument)) {
              this.problem(itemPath, "must be an object");
              return;
            }
            this.string(instrument, "type", itemPath, true);
            if (
              "constraints" in instrument &&
              (!isObject(instrument["constraints"]) ||
                (version === "2026-04-08" &&
                  Object.keys(instrument["constraints"]).length === 0))
            ) {
              this.problem(
                `${itemPath}.constraints`,
                "must be an object with the selected version's declaration shape",
              );
            } else if (
              version === "2026-08-25" &&
              "constraints" in instrument
            ) {
              const valid = validUcpConstraints(instrument["constraints"]);
              if (typeof valid === "string") {
                this.constraintValidationLimited = true;
                constraintsComplete = false;
                if (this.constraintValidationLimits.length < MAX_ISSUES) {
                  this.constraintValidationLimits.push(
                    `${itemPath.slice(0, 220)}.constraints: ${valid}`,
                  );
                }
              } else if (!valid) {
                this.problem(
                  `${itemPath}.constraints`,
                  "must match the 2026-08-25 nested constraint expression schema",
                );
              }
            }
          });
        }
      }
    }
    if (before === this.issueCount && constraintsComplete) this.validHandlers++;
  }

  registry(
    value: unknown,
    path: string,
    read: (entry: unknown, entryPath: string) => void,
  ): void {
    if (!isObject(value)) {
      this.problem(path, "must be a registry object");
      return;
    }
    for (const [name, entries] of Object.entries(value)) {
      this.name(name, `${path} registry key ${JSON.stringify(name)}`);
      if (!Array.isArray(entries)) {
        this.problem(`${path}.${name}`, "must be an array");
        continue;
      }
      entries.forEach((entry, index) => {
        const capabilitiesBefore = this.validCapabilities;
        const handlersBefore = this.validHandlers;
        read(entry, `${path}.${name}[${index}]`);
        if (!this.reverseDomain.test(name)) {
          this.validCapabilities = capabilitiesBefore;
          this.validHandlers = handlersBefore;
        }
      });
    }
  }
}

export class UcpProfileConformanceAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/ucp-profile-conformance",
    category: "agentic-commerce",
    title: "UCP capability and payment declarations conform",
    failureTitle: "UCP capability or payment declarations are malformed",
    description:
      "Checks capability and payment-handler declaration fields against the selected supported UCP business-profile version. It does not fetch declared schemas, validate provider-specific configuration or execute checkout.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Informative,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Informative),
    defaultPriority: CheckPriority.Medium,
    dossier: "docs/evidence/audits/agentic-commerce/ucp-profile-conformance.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    guidance: {
      impact:
        "UCP integrations read the merchant's capability and payment declarations during discovery. A wrong declaration shape prevents reliable interpretation of those fields.",
      fix: "Use the business-profile declaration schema for the profile's selected UCP version. Keep optional fields optional and publish each present declaration with its required typed fields.",
      effort: FixEffort.Moderate,
      docsUrl: "https://ucp.dev/specification/overview/",
      tags: ["ucp", "commerce", "capabilities", "payments", "schema"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const read = readUcpProfile(ctx);
    if (read.kind === "absent") {
      return this.notApplicable(NO_UCP_PROFILE.message, EXPECTED, read.found);
    }
    if (read.kind === "broken") {
      return this.notApplicable(
        "The UCP profile is unreadable; ucp-profile reports that defect. No declarations can be inspected here.",
        EXPECTED,
        read.found,
      );
    }
    const version = read.ucp["version"];
    if (
      typeof version !== "string" ||
      !SUPPORTED_VERSIONS.some((supported) => supported === version)
    ) {
      // A version without rules here is the audit's gap, not the site's
      // defect, and a missing version is already ucp-profile's finding.
      return {
        ...this.notApplicable(
          typeof version === "string"
            ? `This audit has no declaration rules for UCP ${version.slice(0, 40)}, so capability and payment conformance was not assessed.`
            : "The UCP profile names no version; ucp-profile reports that defect. Capability and payment conformance was not assessed.",
          EXPECTED,
          typeof version === "string"
            ? version.slice(0, 100)
            : "No string ucp.version",
        ),
        details: {
          validationPerformed: false,
          supportedVersions: [...SUPPORTED_VERSIONS],
        },
      };
    }
    const check = new DeclarationCheck(version);
    if (version === LEGACY_VERSION) {
      const capabilities = read.ucp["capabilities"];
      if (!Array.isArray(capabilities)) {
        check.problem("ucp.capabilities", "must be an array for 2026-01-11");
      } else {
        capabilities.forEach((item, index) =>
          check.capability(item, `ucp.capabilities[${index}]`, version),
        );
      }
      if ("payment" in read.profile) {
        const payment = read.profile["payment"];
        if (!isObject(payment)) {
          check.problem("payment", "must be an object");
        } else if ("handlers" in payment) {
          if (!Array.isArray(payment["handlers"])) {
            check.problem("payment.handlers", "must be an array");
          } else {
            payment["handlers"].forEach((item, index) =>
              check.handler(item, `payment.handlers[${index}]`, version),
            );
          }
        }
      }
    } else {
      if ("capabilities" in read.ucp) {
        check.registry(
          read.ucp["capabilities"],
          "ucp.capabilities",
          (entry, path) => check.capability(entry, path, version),
        );
      }
      check.registry(
        read.ucp["payment_handlers"],
        "ucp.payment_handlers",
        (entry, path) => check.handler(entry, path, version),
      );
    }
    const details = {
      version,
      validationPerformed: true,
      capabilities: check.capabilityCount,
      validCapabilities: check.validCapabilities,
      paymentHandlers: check.handlerCount,
      validPaymentHandlers: check.validHandlers,
      issueCount: check.issueCount,
      issues: check.issues,
      issuesTruncated: check.issueCount > check.issues.length,
      providerConfigurationValidated: false,
      constraintValidationLimited: check.constraintValidationLimited,
      constraintValidationLimits: check.constraintValidationLimits,
    };
    if (check.issueCount > 0) {
      return {
        ...this.fail(
          `UCP ${version} has ${check.issueCount} declaration issue(s). Readable declarations remain counted separately.`,
          EXPECTED,
          check.issues.slice(0, 5).join("; "),
        ),
        details,
      };
    }
    if (check.constraintValidationLimited) {
      return {
        ...this.warn(
          "UCP payment constraints exceed local validation limits. Their conformance was not fully assessed.",
          EXPECTED,
          check.constraintValidationLimits.slice(0, 5).join("; "),
        ),
        details,
      };
    }
    return {
      ...this.pass(
        `The checked UCP ${version} declaration fields conform: ${check.capabilityCount} capability entry/entries and ${check.handlerCount} payment handler(s). Provider-specific configuration and checkout were not tested.`,
        EXPECTED,
        `${UCP_PATH}; declaration fields only`,
      ),
      details,
    };
  }
}
