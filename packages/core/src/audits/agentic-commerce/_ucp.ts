/**
 * Shared reader for the Universal Commerce Protocol business profile at
 * `/.well-known/ucp`.
 *
 * Google's Merchant UCP guide names the path and says the profile "will
 * enable Google to efficiently negotiate capabilities with your server". The
 * documented shape is `{ "ucp": { version, services, capabilities },
 * "signing_keys": [...] }`.
 *
 * The absent / broken / readable split lives here, beside the read:
 *
 * - **Absent.** No 200, an HTML stand-in, or an empty body. Google says the
 *   file must be public without authentication, but a 401 or 403 is just as
 *   often a WAF in front of every unknown path, so it reads as absent rather
 *   than as a locked profile. Callers decline with {@link NO_UCP_PROFILE}.
 * - **Absent, too:** a JSON object with no `ucp` key. Some servers answer
 *   every `/.well-known/*` path with the same unrelated JSON document; a body
 *   that does not carry the profile's identifying key is not a profile, the
 *   same rule `agents-json` applies to its path.
 * - **Broken.** A 200 whose body is not a JSON object, or whose `ucp` key is
 *   not an object.
 * - **Readable.** A JSON object with a `ucp` object, handed back for the
 *   caller to judge.
 */

import type { CheckContext } from "#core/check-context";
import { isRootArtifact, rootArtifactMiss } from "#core/gatherers/root-files";

/** Google Merchant UCP profile path. */
export const UCP_PATH = "/.well-known/ucp";

/**
 * The shared precondition. An audit that reads it judges the profile's
 * contents, so `absent-artifact-contract.test.ts` holds it to
 * `notApplicable` on a site that publishes no profile.
 */
export const NO_UCP_PROFILE = {
  message: `No UCP business profile at ${UCP_PATH}, so there is nothing to check.`,
  found: "No UCP profile published",
} as const;

export type UcpRead =
  | { kind: "absent"; found: string }
  | { kind: "broken"; found: string }
  | {
      kind: "profile";
      profile: Record<string, unknown>;
      ucp: Record<string, unknown>;
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

/** Read the site's UCP business profile. */
export function readUcpProfile(ctx: Pick<CheckContext, "rootFiles">): UcpRead {
  const result = ctx.rootFiles[UCP_PATH];
  if (!isRootArtifact(result) || !result.body.trim()) {
    return {
      kind: "absent",
      found: result
        ? `${UCP_PATH}: ${rootArtifactMiss(result)}`
        : NO_UCP_PROFILE.found,
    };
  }
  const parsed = tryParseJson(result.body);
  if (!isObject(parsed)) {
    return {
      kind: "broken",
      found:
        parsed === undefined
          ? "HTTP 200, but the body does not parse as JSON"
          : "HTTP 200, but the JSON is not an object",
    };
  }
  if (!("ucp" in parsed)) {
    return {
      kind: "absent",
      found: `${UCP_PATH}: JSON with no \`ucp\` key (keys: ${Object.keys(parsed).slice(0, 5).join(", ") || "none"}), so not a UCP profile`,
    };
  }
  const ucp = parsed["ucp"];
  if (!isObject(ucp)) {
    return {
      kind: "broken",
      found: "HTTP 200, but the `ucp` key is not an object",
    };
  }
  return { kind: "profile", profile: parsed, ucp };
}
