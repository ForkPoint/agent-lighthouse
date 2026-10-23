import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { checkoutSchema as schema } from "#core/protocols/acp/2026-04-17/checkout-schema";
import { AcpSandboxConfigSchema } from "#core/schemas";
import { createFetcher, isSafeUrl, type FetchResult } from "#core/fetcher";
import { HttpMethod } from "#core/types";
import type { CheckContext } from "#core/check-context";

export interface AcpProbeResult {
  complete: boolean;
  incompleteReason: string;
  incompleteOperation: string;
  cleanupReason: string;
  validationPerformed: boolean;
  recoveryKey: string;
  findings: string[];
  cleanupCertain: boolean;
  unknownCreationOutcome: boolean;
  completedFixtureTested: boolean;
}
let validators:
  | {
      session: import("ajv").ValidateFunction;
      error: import("ajv").ValidateFunction;
    }
  | undefined;
function getValidators() {
  if (validators) return validators;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  validators = {
    session: ajv.compile({
      $ref: `${String(schema["$id"])}#/$defs/CheckoutSession`,
    }),
    error: ajv.compile({ $ref: `${String(schema["$id"])}#/$defs/Error` }),
  };
  return validators;
}
class ProbeIncomplete extends Error {
  constructor(readonly reason: string) {
    super("ACP probe incomplete");
  }
}
const cache = new WeakMap<object, Promise<AcpProbeResult>>();

/** Resolve secrets before any website traffic; keep copied configuration in a private closure. */
export function prepareAcpSandbox(
  input: unknown,
  transport: Pick<
    import("#core/fetcher").FetcherOptions,
    "dispatcher" | "requestScheduler"
  > = {},
) {
  const parsed = AcpSandboxConfigSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid ACP sandbox configuration");
  const config = parsed.data;
  config.testItems.forEach((item) => Object.freeze(item));
  Object.freeze(config.testItems);
  Object.freeze(config);
  const tokenInput = process.env[config.tokenEnv];
  if (!tokenInput || !/^[\x21-\x7e]+$/.test(tokenInput))
    throw new Error("ACP sandbox token is missing or invalid");
  const token = tokenInput;
  if (config.completedSessionId?.includes(token))
    throw new Error("Invalid ACP sandbox configuration");
  let pending: Promise<AcpProbeResult> | undefined;
  const factory = (signal: AbortSignal) => {
    return () => (pending ??= probe());
    async function probe(): Promise<AcpProbeResult> {
      const { session, error } = getValidators();
      const result: AcpProbeResult = {
        complete: true,
        incompleteReason: "",
        incompleteOperation: "",
        cleanupReason: "",
        validationPerformed: false,
        recoveryKey: "",
        findings: [],
        cleanupCertain: true,
        unknownCreationOutcome: false,
        completedFixtureTested: false,
      };
      const fetcher = createFetcher({ ...transport, privateProbe: true });
      const ids = new Set<string>();
      const base = config.baseUrl.replace(/\/$/, "");
      const key = randomUUID();
      const payload = JSON.stringify({
        line_items: config.testItems,
        currency: config.currency,
        capabilities: {},
      });
      let creationInFlight = false;
      let operation = "create";
      const request = async (
        path: string,
        method: HttpMethod,
        body?: string,
        requestKey = randomUUID(),
        requestSignal = signal,
      ): Promise<FetchResult> => {
        if (requestSignal.aborted) throw new ProbeIncomplete("aborted");
        const url = `${base}/checkout_sessions${path}`;
        if (
          !(await Promise.race([
            isSafeUrl(url),
            new Promise<boolean>((resolve) => {
              requestSignal.addEventListener("abort", () => resolve(false), {
                once: true,
              });
            }),
          ]))
        )
          throw new ProbeIncomplete(
            requestSignal.aborted ? "aborted" : "unsafe URL",
          );
        if (method === HttpMethod.Post && path === "") creationInFlight = true;
        let response: FetchResult;
        try {
          response = await fetcher.fetch({
            url,
            method,
            ...(body !== undefined
              ? { body, contentType: "application/json" }
              : {}),
            followRedirects: false,
            acceptHeader: "application/json",
            headers: {
              Authorization: `Bearer ${token}`,
              "API-Version": config.apiVersion,
              "Idempotency-Key": requestKey,
            },
            signal: requestSignal,
            timeout: 2000,
          });
        } catch {
          throw new ProbeIncomplete(
            requestSignal.aborted ? "aborted" : "network failure",
          );
        }
        if (response.error || response.status === 0)
          throw new ProbeIncomplete(
            requestSignal.aborted ? "aborted" : "network failure",
          );
        if (response.status === 401 || response.status === 403) {
          creationInFlight = false;
          throw new ProbeIncomplete("unauthorized");
        }
        if (response.status >= 300 && response.status < 400)
          throw new ProbeIncomplete("redirected");
        if (response.status === 429) {
          creationInFlight = false;
          throw new ProbeIncomplete("rate limited");
        }
        if (response.status >= 500)
          throw new ProbeIncomplete("server unavailable");
        return response;
      };
      const read = (
        response: FetchResult,
      ): Record<string, unknown> | undefined => {
        try {
          const value: unknown = JSON.parse(response.body);
          return typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : undefined;
        } catch {
          return undefined;
        }
      };
      const remember = (
        body: Record<string, unknown> | undefined,
      ): string | undefined => {
        const id = body?.["id"];
        if (
          typeof id !== "string" ||
          !/^[A-Za-z0-9_-]{1,256}$/.test(id) ||
          id.includes(token)
        )
          return undefined;
        ids.add(id);
        return id;
      };
      const checkMediaType = (
        response: FetchResult,
        label: string,
      ): boolean => {
        const valid =
          response.contentType?.split(";", 1)[0]?.trim().toLowerCase() ===
          "application/json";
        if (!valid)
          result.findings.push(`${label}: response media type mismatch`);
        return valid;
      };
      const check = (
        response: FetchResult,
        status: number,
        label: string,
        isError = false,
      ): Record<string, unknown> | undefined => {
        const body = read(response);
        checkMediaType(response, label);
        const validate = isError ? error : session;
        result.validationPerformed = true;
        if (response.status !== status)
          result.findings.push(`${label}: unexpected HTTP status`);
        if (!validate(body)) {
          // Schema paths derive from the bundled schema, never merchant-controlled property names.
          const paths = (validate.errors ?? [])
            .slice(0, 8)
            .map((issue) =>
              issue.schemaPath.replace(/[^A-Za-z0-9_/#~.-]/g, "").slice(0, 160),
            );
          result.findings.push(
            `${label}: response schema mismatch (${paths.join(", ")})`,
          );
        }
        return body;
      };
      try {
        const created = await request("", HttpMethod.Post, payload, key);
        creationInFlight = false;
        const createdBody = read(created);
        check(created, 201, "create");
        if (created.status < 200 || created.status >= 300)
          throw new ProbeIncomplete("create rejected");
        const id = remember(createdBody);
        if (!id) {
          result.unknownCreationOutcome = true;
          result.cleanupCertain = false;
          throw new ProbeIncomplete("unusable session identity");
        }
        const path = `/${encodeURIComponent(id)}`;
        operation = "retrieve";
        const retrieved = check(
          await request(path, HttpMethod.Get),
          200,
          "retrieve",
        );
        if (retrieved?.["id"] !== id)
          result.findings.push("retrieve: session identity mismatch");
        operation = "replay";
        const replay = await request("", HttpMethod.Post, payload, key);
        creationInFlight = false;
        const replayBody = read(replay);
        check(replay, 201, "replay");
        if (replay.status < 200 || replay.status >= 300)
          throw new ProbeIncomplete("create rejected");
        if (!remember(replayBody)) {
          result.cleanupCertain = false;
          result.unknownCreationOutcome = true;
        }
        if (replayBody?.["id"] !== id)
          result.findings.push("replay: session identity mismatch");
        if (!isDeepStrictEqual(createdBody, replayBody))
          result.findings.push("replay: cached response mismatch");
        operation = "changed-body replay";
        const conflictResponse = await request(
          "",
          HttpMethod.Post,
          JSON.stringify({
            line_items: config.testItems,
            currency: config.currency === "usd" ? "eur" : "usd",
            capabilities: {},
          }),
          key,
        );
        creationInFlight = false;
        const conflictBody = read(conflictResponse);
        if (
          conflictResponse.status >= 200 &&
          conflictResponse.status < 300 &&
          !remember(conflictBody)
        ) {
          result.cleanupCertain = false;
          result.unknownCreationOutcome = true;
        }
        const conflict = check(
          conflictResponse,
          422,
          "changed-body replay",
          true,
        );
        if (conflict?.["code"] !== "idempotency_conflict")
          result.findings.push("changed-body replay: missing conflict code");
        operation = "unknown session";
        check(
          await request(`/al_unknown_${randomUUID()}`, HttpMethod.Get),
          404,
          "unknown session",
          true,
        );
        operation = "cancel";
        const canceled = check(
          await request(`${path}/cancel`, HttpMethod.Post, "{}"),
          200,
          "cancel",
        );
        if (
          canceled?.["status"] === "canceled" &&
          canceled["id"] === id &&
          session(canceled)
        )
          ids.delete(id);
        else result.findings.push("cancel: session state mismatch");
        if (config.completedSessionId) {
          const fixturePath = `/${encodeURIComponent(config.completedSessionId)}`;
          operation = "completed fixture";
          const fixture = check(
            await request(fixturePath, HttpMethod.Get),
            200,
            "completed fixture",
          );
          if (
            fixture?.["status"] === "completed" &&
            fixture["id"] === config.completedSessionId &&
            session(fixture)
          ) {
            operation = "completed cancellation";
            check(
              await request(`${fixturePath}/cancel`, HttpMethod.Post, "{}"),
              405,
              "completed cancellation",
              true,
            );
            result.completedFixtureTested = true;
          } else {
            result.complete = false;
            result.incompleteReason = "fixture state unverified";
            result.incompleteOperation = operation;
            result.findings.push(
              "completed fixture: completed state not verified",
            );
          }
        }
      } catch (failure) {
        result.complete = false;
        result.incompleteReason =
          failure instanceof ProbeIncomplete
            ? failure.reason
            : "network failure";
        result.incompleteOperation = operation;
        if (creationInFlight) {
          result.unknownCreationOutcome = true;
          result.cleanupCertain = false;
        }
      } finally {
        // One shared bound covers all cleanup attempts and ignores the scan's canceled signal.
        const cleanupSignal = AbortSignal.timeout(5000);
        for (const id of ids) {
          try {
            const response = await request(
              `/${encodeURIComponent(id)}/cancel`,
              HttpMethod.Post,
              "{}",
              randomUUID(),
              cleanupSignal,
            );
            const body = read(response);
            const validMediaType = checkMediaType(response, "cleanup");
            if (
              !validMediaType ||
              response.status !== 200 ||
              !session(body) ||
              body?.["status"] !== "canceled" ||
              body["id"] !== id
            )
              result.cleanupCertain = false;
          } catch (failure) {
            result.cleanupCertain = false;
            result.cleanupReason =
              failure instanceof ProbeIncomplete
                ? failure.reason
                : "network failure";
          }
        }
      }
      if (!result.cleanupCertain) {
        if (!result.incompleteReason) {
          result.incompleteReason = "cleanup uncertain";
          result.incompleteOperation = "cleanup";
        }
        result.complete = false;
        result.recoveryKey = key;
      }
      return result;
    }
  };
  return Object.assign(factory, {
    settled: async () => {
      await pending;
    },
  });
}

/** Absence means no probe; scoped contexts share a once-per-scan cached promise. */
export function gatherAcpSandbox(
  ctx: CheckContext,
): Promise<AcpProbeResult> | undefined {
  if (!ctx.acpSandboxProbe) return undefined;
  const owner = ctx.cacheOwner ?? ctx;
  let pending = cache.get(owner);
  if (!pending) {
    pending = ctx.acpSandboxProbe();
    cache.set(owner, pending);
  }
  return pending;
}
