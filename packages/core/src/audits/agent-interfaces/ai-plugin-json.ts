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
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact } from "#core/gatherers/root-files";

/** The path the retired ChatGPT plugin manifest lived at. */
const AI_PLUGIN_PATH = "/.well-known/ai-plugin.json";

/**
 * Keys that only the ChatGPT plugin manifest defines. One of them is enough to
 * tell the manifest apart from an unrelated JSON file at the same path; the
 * audit must not tell an owner to retire a file it cannot recognise.
 */
const MANIFEST_KEYS = [
  "schema_version",
  "name_for_model",
  "description_for_model",
  "name_for_human",
] as const;

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

const NOTICE =
  "OpenAI closed ChatGPT plugins on 2024-03-19 and removed the manifest specification. No client reads /.well-known/ai-plugin.json.";

export class AiPluginJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/ai-plugin-json",
    category: "agent-interfaces",
    // An obsolete audit speaks only when the owner still publishes the thing,
    // so both titles describe the file, not a site that lacks it.
    title: "ChatGPT plugin manifest (retired)",
    failureTitle: "A retired ChatGPT plugin manifest is still published",
    description:
      "Reports a ChatGPT plugin manifest still served at `/.well-known/ai-plugin.json`. OpenAI closed the plugin store on 2024-03-19 and archived the quickstart repository, and no other vendor adopted the format, so the file reaches no agent. This check never asks a site to publish it.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice: NOTICE,
      link: "https://community.openai.com/t/plugin-store-and-new-chats-with-plugins-closed-march-19-2024/689877",
      replacement:
        "An MCP server declared through a Server Card (/.well-known/ard.json or /.well-known/ai-catalog.json), or GPT Actions with an OpenAPI document.",
    },
    dossier: "docs/evidence/audits/agent-interfaces/ai-plugin-json.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "The file costs nothing to keep, but it does nothing: ChatGPT stopped installing plugins in March 2024 and no other agent reads the manifest.",
      fix: "Remove /.well-known/ai-plugin.json when convenient. To give agents tools, publish an MCP server and declare it through a Server Card in /.well-known/ard.json or /.well-known/ai-catalog.json.",
      effort: FixEffort.Trivial,
      docsUrl:
        "https://community.openai.com/t/plugin-store-and-new-chats-with-plugins-closed-march-19-2024/689877",
      tags: ["ai-plugin", "chatgpt-plugins", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No ChatGPT plugin manifest: the format was retired in 2024 and nothing reads it";
    const file = ctx.rootFiles[AI_PLUGIN_PATH];

    // Absent artifact, absent verdict. The obsolete tier exists to tell an
    // owner about a file they still publish; a site without one has nothing
    // to hear. An HTML stand-in or an unrelated JSON file is not the manifest.
    const parsed =
      isRootArtifact(file) && file.body.trim()
        ? tryParseJson(file.body)
        : undefined;
    const manifestKeys = isObject(parsed)
      ? MANIFEST_KEYS.filter((key) => key in parsed)
      : [];
    if (manifestKeys.length === 0) {
      return this.notApplicable(
        "This site publishes no ChatGPT plugin manifest, so there is nothing to retire.",
        expected,
        file
          ? `${AI_PLUGIN_PATH} answered HTTP ${file.status} without a plugin manifest`
          : "No ai-plugin.json published",
      );
    }

    return this.warn(
      `A ChatGPT plugin manifest is still published at ${AI_PLUGIN_PATH}. ChatGPT plugins closed on 2024-03-19 and no client reads this file. It does no harm and can be removed.`,
      expected,
      `Plugin manifest with ${manifestKeys.join(", ")}`,
      CheckPriority.Low,
    );
  }
}
