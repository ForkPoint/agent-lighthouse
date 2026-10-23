import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { checkoutSchema as schema } from "./protocols/acp/2026-04-17/checkout-schema";
import { AcpSandboxConfigSchema } from "./config";
import {
  createPrivateTransport,
  type PrivateTransport,
  type FetchResult,
  PrivateTransportError,
} from "./transport";
const HttpMethod = { Get: "GET", Post: "POST" } as const;
type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export interface AcpProbeResult {
  complete: boolean;
  incompleteReason: string;
  incompleteOperation: string;
  cleanupReason: string;
  validationPerformed: boolean;
  recoveryKey: string;
  findings: string[];
  schemaDiagnostics: {
    operation: string;
    schemaPath: string;
    keyword: string;
  }[];
  statusDiagnostics: { operation: string; expected: number; actual: number }[];
  cleanupCertain: boolean;
  unknownCreationOutcome: boolean;
  completedFixtureTested: boolean;
  operations: string[];
  operationCoverage: Record<string, string>;
  outcome: string;
  apiVersion: string;
  environment: string;
}
// Only paths present in the bundled schema can appear in repair diagnostics.
const bundledSchemaPaths = new Set<string>();
function indexSchemaPaths(value: unknown, path = "#"): void {
  bundledSchemaPaths.add(path);
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value))
    indexSchemaPaths(
      child,
      `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
    );
}
indexSchemaPaths(schema);
// AJV resolves references with paths relative to each bundled definition.
for (const definition of Object.values(
  schema["$defs"] as Record<string, unknown>,
))
  indexSchemaPaths(definition);
const schemaKeywords = new Set([
  "type",
  "required",
  "additionalProperties",
  "enum",
  "const",
  "format",
  "pattern",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "uniqueItems",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "dependentRequired",
  "unevaluatedProperties",
  "multipleOf",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);
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
class ContractMismatch extends Error {}
class ProbeIncomplete extends Error {
  constructor(readonly reason: string) {
    super("ACP probe incomplete");
  }
}

/** Resolve secrets before any website traffic; keep copied configuration in a private closure. */
export function prepareAcpSandbox(
  input: unknown,
  transportFactory: (
    baseUrl: string,
  ) => PrivateTransport = createPrivateTransport,
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
  // One probe per caller signal: callers sharing a signal share the run, and
  // a caller with its own signal gets its own run, so its abort is honoured.
  const pending = new WeakMap<AbortSignal, Promise<AcpProbeResult>>();
  const factory = (signal: AbortSignal) => {
    return () => {
      let run = pending.get(signal);
      if (!run) {
        run = probe();
        pending.set(signal, run);
      }
      return run;
    };
    async function probe(): Promise<AcpProbeResult> {
      const { session, error } = getValidators();
      const result: AcpProbeResult = {
        operations: [],
        operationCoverage: Object.fromEntries(
          [
            "create",
            "retrieve",
            "replay",
            "changed-body replay",
            "unknown session",
            "cancel",
            "completed fixture",
            "completed cancellation",
          ].map((label) => [label, "untested"]),
        ),
        outcome: "incomplete",
        apiVersion: config.apiVersion,
        environment: "customer-acknowledged-sandbox",
        complete: true,
        incompleteReason: "",
        incompleteOperation: "",
        cleanupReason: "",
        validationPerformed: false,
        recoveryKey: "",
        findings: [],
        schemaDiagnostics: [],
        statusDiagnostics: [],
        cleanupCertain: true,
        unknownCreationOutcome: false,
        completedFixtureTested: false,
      };
      const fetcher = transportFactory(config.baseUrl);
      const ids = new Set<string>();
      const cancellationKeys = new Map<string, string>();
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
        requestKey: string = randomUUID(),
        requestSignal = signal,
      ): Promise<FetchResult> => {
        if (requestSignal.aborted) throw new ProbeIncomplete("aborted");
        const url = `${base}/checkout_sessions${path}`;
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
        } catch (failure) {
          throw new ProbeIncomplete(
            requestSignal.aborted
              ? "aborted"
              : failure instanceof PrivateTransportError
                ? failure.reason
                : "network failure",
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
          id.includes(token) ||
          id === config.completedSessionId
        )
          return undefined;
        ids.add(id);
        if (!cancellationKeys.has(id)) cancellationKeys.set(id, randomUUID());
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
        result.operations.push(label);
        checkMediaType(response, label);
        const validate = isError ? error : session;
        result.validationPerformed = true;
        if (response.status !== status) {
          result.findings.push(`${label}: unexpected HTTP status`);
          if (result.statusDiagnostics.length < 32)
            result.statusDiagnostics.push({
              operation: label,
              expected: status,
              actual: response.status,
            });
        }
        if (!validate(body)) {
          result.findings.push(`${label}: response schema mismatch`);
          for (const issue of (validate.errors ?? []).slice(0, 8)) {
            const schemaPath = issue.schemaPath.startsWith(
              String(schema["$id"]),
            )
              ? issue.schemaPath.slice(String(schema["$id"]).length)
              : issue.schemaPath;
            if (
              result.schemaDiagnostics.length < 32 &&
              schemaPath.length <= 160 &&
              bundledSchemaPaths.has(schemaPath) &&
              schemaKeywords.has(issue.keyword)
            )
              result.schemaDiagnostics.push({
                operation: label,
                schemaPath,
                keyword: issue.keyword,
              });
          }
        }
        return body;
      };
      try {
        const created = await request("", HttpMethod.Post, payload, key);
        creationInFlight = false;
        const createdBody = read(created);
        check(created, 201, "create");
        if (created.status < 200 || created.status >= 300)
          throw new ContractMismatch("create rejected");
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
          throw new ContractMismatch("create rejected");
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
            currency: config.currency.toLowerCase() === "usd" ? "eur" : "usd",
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
        const cancelResponse = await request(
          `${path}/cancel`,
          HttpMethod.Post,
          "{}",
          cancellationKeys.get(id),
        );
        const canceled = check(cancelResponse, 200, "cancel");
        if (
          cancelResponse.status === 200 &&
          cancelResponse.contentType?.split(";", 1)[0]?.trim().toLowerCase() ===
            "application/json" &&
          canceled?.["status"] === "canceled" &&
          canceled["id"] === id &&
          session(canceled)
        )
          ids.delete(id);
        else result.findings.push("cancel: session state mismatch");
        if (config.completedSessionId) {
          const fixturePath = `/${encodeURIComponent(config.completedSessionId)}`;
          operation = "completed fixture";
          const fixtureResponse = await request(fixturePath, HttpMethod.Get);
          const fixture = check(fixtureResponse, 200, "completed fixture");
          if (
            fixtureResponse.status === 200 &&
            fixtureResponse.contentType
              .split(";", 1)[0]
              ?.trim()
              .toLowerCase() === "application/json" &&
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
        result.complete = failure instanceof ContractMismatch;
        result.incompleteReason =
          failure instanceof ContractMismatch
            ? ""
            : failure instanceof ProbeIncomplete
              ? failure.reason
              : "network failure";
        result.incompleteOperation = result.complete ? "" : operation;
        if (creationInFlight) {
          result.unknownCreationOutcome = true;
          result.cleanupCertain = false;
        }
      } finally {
        // One shared bound covers all cleanup attempts and ignores the scan's canceled signal.
        const cleanupController = new AbortController();
        const cleanupTimer = setTimeout(() => cleanupController.abort(), 5000);
        cleanupTimer.unref();
        const cleanupSignal = cleanupController.signal;
        try {
          for (const id of ids) {
            if (cleanupSignal.aborted) {
              result.cleanupCertain = false;
              result.cleanupReason = "aborted";
              break;
            }
            try {
              const response = await request(
                `/${encodeURIComponent(id)}/cancel`,
                HttpMethod.Post,
                "{}",
                cancellationKeys.get(id),
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
              ) {
                result.cleanupCertain = false;
                result.cleanupReason = "cleanup response mismatch";
              }
            } catch (failure) {
              result.cleanupCertain = false;
              result.cleanupReason =
                failure instanceof ProbeIncomplete
                  ? failure.reason
                  : "network failure";
            }
          }
        } finally {
          clearTimeout(cleanupTimer);
        }
      }
      try {
        await fetcher.close();
      } catch {
        result.cleanupCertain = false;
        result.cleanupReason = "transport close failure";
      }
      if (signal.aborted && result.complete) {
        result.complete = false;
        result.incompleteReason = "aborted";
        result.incompleteOperation = operation;
      }
      if (!result.cleanupCertain) {
        if (!result.incompleteReason) {
          result.incompleteReason = "cleanup uncertain";
          result.incompleteOperation = "cleanup";
        }
        result.complete = false;
        result.recoveryKey = key;
      }
      for (const label of result.operations)
        result.operationCoverage[label] = result.findings.some((finding) =>
          finding.startsWith(`${label}:`),
        )
          ? "contract-mismatch"
          : "passed";
      if (
        result.incompleteOperation &&
        result.incompleteOperation !== "cleanup"
      )
        result.operationCoverage[result.incompleteOperation] = "incomplete";
      result.outcome = !result.complete
        ? "incomplete"
        : result.findings.length
          ? "contract-mismatch"
          : "passed";
      return result;
    }
  };
  return Object.assign(factory, {
    settled: async () => {
      await pending;
    },
  });
}
