/**
 * Shared reader for the A2A Agent Card at `/.well-known/agent-card.json`.
 *
 * A2A 1.0 §8.2 names that path, and IANA registered it permanently on
 * 2025-08-01. The reference client (a2a-python) reads only that path: its
 * `AGENT_CARD_WELL_KNOWN_PATH` constant has no fallback to the pre-0.3
 * `/.well-known/agent.json`, which the A2A 0.3.0 changelog renamed.
 *
 * The absent / broken / readable split lives here, beside the read, so no
 * caller has to guess it:
 *
 * - **Absent.** No 200 at either path, an HTML stand-in, or an empty body. A
 *   site that runs no A2A agent has withheld nothing, so callers decline with
 *   {@link NO_AGENT_CARD}.
 * - **Broken.** A 200 at `agent-card.json` whose body is not a JSON object.
 *   The SDK raises `AgentCardResolutionError` on it, so a client gets no card.
 * - **Readable.** A JSON object that carries at least one key only an A2A
 *   card uses, handed back for the caller to judge.
 *
 * Only a body that looks like an A2A card counts, at either path. Some servers
 * answer every `/.well-known/*` path with the same unrelated JSON document; a
 * JSON object with none of the card's keys is somebody else's file, so it
 * reads as absent rather than as a card missing every field. The legacy path
 * is read only when the current path has nothing. `/.well-known/agents.json`
 * (plural) is a different, dead format.
 */

import type { CheckContext } from "#core/check-context";
import { isRootArtifact, rootArtifactMiss } from "#core/gatherers/root-files";

/** A2A 1.0 §8.2 discovery path, IANA permanent. */
export const AGENT_CARD_PATH = "/.well-known/agent-card.json";

/** The pre-0.3 path. A2A 0.3.0 renamed it to {@link AGENT_CARD_PATH}. */
export const LEGACY_AGENT_CARD_PATH = "/.well-known/agent.json";

/**
 * The shared precondition. An audit that reads it judges the card's contents,
 * so `absent-artifact-contract.test.ts` holds it to `notApplicable` on a site
 * that publishes no card.
 */
export const NO_AGENT_CARD = {
  message: `No A2A Agent Card at ${AGENT_CARD_PATH}, so there is nothing to check.`,
  found: "No Agent Card published",
} as const;

/**
 * Keys only an A2A card carries. One of them on an object is enough to read it
 * as a card; a bare `name` or `url` is not.
 */
const A2A_KEYS = [
  "skills",
  "capabilities",
  "protocolVersion",
  "supportedInterfaces",
  "defaultInputModes",
  "defaultOutputModes",
  "preferredTransport",
] as const;

export type AgentCardRead =
  | { kind: "absent"; found: string }
  | { kind: "broken"; path: string; found: string }
  | {
      kind: "card";
      path: string;
      /** True when the card was found only at the pre-0.3 path. */
      legacy: boolean;
      card: Record<string, unknown>;
    };

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** True when an object carries at least one key only an A2A card uses. */
function looksLikeA2aCard(val: Record<string, unknown>): boolean {
  return A2A_KEYS.some((key) => key in val);
}

/** Read the site's Agent Card, current path first. */
export function readAgentCard(
  ctx: Pick<CheckContext, "rootFiles">,
): AgentCardRead {
  const current = ctx.rootFiles[AGENT_CARD_PATH];
  if (isRootArtifact(current) && current.body.trim()) {
    const parsed = tryParseJson(current.body);
    if (!isObject(parsed)) {
      return {
        kind: "broken",
        path: AGENT_CARD_PATH,
        found:
          parsed === undefined
            ? "HTTP 200, but the body does not parse as JSON"
            : "HTTP 200, but the JSON is not an object",
      };
    }
    if (looksLikeA2aCard(parsed)) {
      return {
        kind: "card",
        path: AGENT_CARD_PATH,
        legacy: false,
        card: parsed,
      };
    }
  }

  // Either path proves an A2A agent only when its body is shaped like one.
  // Anything else there is somebody else's file, so it reads as absent.
  const legacy = ctx.rootFiles[LEGACY_AGENT_CARD_PATH];
  if (isRootArtifact(legacy) && legacy.body.trim()) {
    const parsed = tryParseJson(legacy.body);
    if (isObject(parsed) && looksLikeA2aCard(parsed)) {
      return {
        kind: "card",
        path: LEGACY_AGENT_CARD_PATH,
        legacy: true,
        card: parsed,
      };
    }
  }

  return {
    kind: "absent",
    found: !current
      ? NO_AGENT_CARD.found
      : isRootArtifact(current) && current.body.trim()
        ? `${AGENT_CARD_PATH}: JSON with none of the Agent Card's keys, so not a card`
        : `${AGENT_CARD_PATH}: ${rootArtifactMiss(current)}`,
  };
}
