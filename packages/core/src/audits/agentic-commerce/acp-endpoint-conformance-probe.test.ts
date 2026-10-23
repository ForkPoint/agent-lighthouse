import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcpEndpointConformanceProbeAudit } from "./acp-endpoint-conformance-probe";
import { prepareAcpSandbox } from "#core/gatherers/acp";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus } from "#core/types";
import type { CheckContext } from "#core/check-context";
const { fetch, safe } = vi.hoisted(() => ({ fetch: vi.fn(), safe: vi.fn() }));
vi.mock("#core/fetcher", () => ({
  createFetcher: () => ({ fetch }),
  isSafeUrl: safe,
}));
const config = {
  baseUrl: "https://sandbox.example/api",
  sandboxAcknowledged: true,
  tokenEnv: "ACP_TEST_TOKEN",
  apiVersion: "2026-04-17",
  testItems: [{ id: "item_1" }],
  currency: "usd",
};
const body = (id = "cs_1", status = "ready_for_payment") => ({
  id,
  status,
  currency: "usd",
  line_items: [],
  totals: [],
  fulfillment_options: [],
  messages: [],
  links: [],
  capabilities: {},
});
const err = {
  type: "invalid_request",
  code: "idempotency_conflict",
  message: "secret-token hostile merchant text",
};
const response = (
  status: number,
  value: unknown,
  contentType = "application/json; charset=utf-8",
) => ({
  status,
  contentType,
  body: JSON.stringify(value),
});
const audit = new AcpEndpointConformanceProbeAudit();
const context = (provider?: CheckContext["acpSandboxProbe"]) =>
  (provider ? { acpSandboxProbe: provider } : {}) as CheckContext;
beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockReset();
  safe.mockReset();
  safe.mockResolvedValue(true);
  process.env["ACP_TEST_TOKEN"] = "secret-token";
});
function successfulSequence() {
  fetch
    .mockResolvedValueOnce(response(201, body()))
    .mockResolvedValueOnce(response(200, body()))
    .mockResolvedValueOnce(response(201, body()))
    .mockResolvedValueOnce(response(422, err))
    .mockResolvedValueOnce(response(404, err))
    .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
}
describe("ACP sandbox conformance", () => {
  it("does not send a request without explicit opt-in", async () => {
    expect((await audit.audit(context())).status).toBe(
      CheckStatus.NotApplicable,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects invalid config and missing tokens before traffic without reflecting input", () => {
    for (const baseUrl of [
      "http://sandbox.example",
      "https://user:secret-token@sandbox.example",
      "https://sandbox.example/?secret-token",
    ])
      expect(() => prepareAcpSandbox({ ...config, baseUrl })).toThrow(
        "Invalid ACP sandbox configuration",
      );
    delete process.env["ACP_TEST_TOKEN"];
    expect(() => prepareAcpSandbox(config)).toThrow(
      "ACP sandbox token is missing or invalid",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the real isolated probe once, validates bodies, and never completes", async () => {
    successfulSequence();
    const runtime = prepareAcpSandbox(config);
    const ctx = context(runtime(new AbortController().signal));
    const [result, again] = await Promise.all([
      audit.audit(ctx),
      audit.audit(ctx),
    ]);
    expect(AuditResultSchema.parse(result).status).toBe(CheckStatus.Pass);
    expect(again).toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(6);
    const calls = fetch.mock.calls.map(([call]) => call);
    expect(calls.every((call) => call.followRedirects === false)).toBe(true);
    expect(calls.some((call) => call.url.includes("/complete"))).toBe(false);
    expect(calls[0].body).toBe(calls[2].body);
    expect(calls[0].headers["Idempotency-Key"]).toBe(
      calls[2].headers["Idempotency-Key"],
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(result.details?.["completedFixtureTested"]).toBe(false);
  });
  it("finds a wrong nested response field with no raw text", async () => {
    successfulSequence();
    fetch.mockReset();
    fetch
      .mockResolvedValueOnce(
        response(201, {
          ...body(),
          line_items: [
            { id: "line_1", item: { id: "item_1" }, quantity: "secret-token" },
          ],
        }),
      )
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(201, body()))
      .mockResolvedValueOnce(response(422, err))
      .mockResolvedValueOnce(response(404, err))
      .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(AuditResultSchema.parse(result).status).toBe(CheckStatus.Warn);
    expect(JSON.stringify(result)).toContain("response schema mismatch");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("cancels observed sessions after abort with an independent signal", async () => {
    const controller = new AbortController();
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockImplementationOnce(() => {
        controller.abort(new Error("secret-token"));
        throw new Error("secret-token");
      })
      .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
    const runtime = prepareAcpSandbox(config);
    const result = await audit.audit(context(runtime(controller.signal)));
    await runtime.settled();
    expect(result.details?.["complete"]).toBe(false);
    expect(fetch.mock.calls.at(-1)?.[0].signal.aborted).toBe(false);
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("/cancel");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("marks unknown creation and redirects incomplete without following redirects", async () => {
    fetch.mockResolvedValueOnce(response(302, { id: "secret-token" }));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["unknownCreationOutcome"]).toBe(true);
    expect(result.details?.["cleanupCertain"]).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});

describe("ACP edge evidence and cleanup", () => {
  it("cleans each session ID observed from a wrong idempotency replay", async () => {
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(201, body("cs_2")))
      .mockResolvedValueOnce(response(422, err))
      .mockResolvedValueOnce(response(404, err))
      .mockResolvedValueOnce(response(200, body("cs_1", "canceled")))
      .mockResolvedValueOnce(response(200, body("cs_2", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("cs_2/cancel");
    expect(result.details?.["cleanupCertain"]).toBe(true);
  });
  it("verifies completed fixture state before a 405 cancellation test", async () => {
    successfulSequence();
    fetch
      .mockResolvedValueOnce(response(200, body("cs_completed", "completed")))
      .mockResolvedValueOnce(response(405, err));
    const result = await audit.audit(
      context(
        prepareAcpSandbox({ ...config, completedSessionId: "cs_completed" })(
          new AbortController().signal,
        ),
      ),
    );
    expect(result.details?.["completedFixtureTested"]).toBe(true);
    expect(result.status).toBe(CheckStatus.Pass);
  });
  it("never cancels a fixture whose completed state is unverified", async () => {
    successfulSequence();
    fetch.mockResolvedValueOnce(response(200, body("cs_completed")));
    const result = await audit.audit(
      context(
        prepareAcpSandbox({ ...config, completedSessionId: "cs_completed" })(
          new AbortController().signal,
        ),
      ),
    );
    expect(result.details?.["completedFixtureTested"]).toBe(false);
    expect(result.details?.["complete"]).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(7);
  });
  it("does not include hostile thrown errors and reports cleanup uncertainty", async () => {
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockRejectedValue(new Error("secret-token"));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["cleanupCertain"]).toBe(false);
    expect(result.details?.["complete"]).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("rejects token-bearing fixture IDs before all requests", () => {
    expect(() =>
      prepareAcpSandbox({ ...config, completedSessionId: "secret-token" }),
    ).toThrow("Invalid ACP sandbox configuration");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ACP response envelope", () => {
  it.each(["text/html", "text/plain"])(
    "reports JSON served as %s with a fixed finding",
    async (contentType) => {
      fetch
        .mockResolvedValueOnce(response(201, body(), contentType))
        .mockResolvedValueOnce(response(200, body()))
        .mockResolvedValueOnce(response(201, body()))
        .mockResolvedValueOnce(response(422, err))
        .mockResolvedValueOnce(response(404, err))
        .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
      const result = await audit.audit(
        context(prepareAcpSandbox(config)(new AbortController().signal)),
      );
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.details?.["findings"]).toContain(
        "create: response media type mismatch",
      );
      expect(
        fetch.mock.calls.every(
          ([call]) => call.acceptHeader === "application/json",
        ),
      ).toBe(true);
      expect(result.details?.["cleanupCertain"]).toBe(true);
      expect(JSON.stringify(result)).not.toContain("secret-token");
    },
  );
  it.each([undefined, "secret-token", "unsafe/session"])(
    "reports unknown creation when a 201 has no safe usable ID (%s)",
    async (id) => {
      fetch.mockResolvedValueOnce(response(201, { ...body(), id }));
      const result = await audit.audit(
        context(prepareAcpSandbox(config)(new AbortController().signal)),
      );
      expect(result.details?.["unknownCreationOutcome"]).toBe(true);
      expect(result.details?.["cleanupCertain"]).toBe(false);
      expect(result.details?.["complete"]).toBe(false);
      expect(result.details?.["recoveryKey"]).toMatch(/^[a-f0-9-]{36}$/);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain("secret-token");
    },
  );
});

describe("ACP cached response and incomplete evidence", () => {
  const sequence = () => [
    response(201, body()),
    response(200, body()),
    response(201, body()),
    response(422, err),
    response(404, err),
    response(200, body("cs_1", "canceled")),
  ];
  it("rejects a schema-valid replay with the same ID but changed currency and totals", async () => {
    const replies = sequence();
    replies[2] = response(201, {
      ...body(),
      currency: "eur",
      totals: [{ type: "total", display_text: "Total", amount: 500 }],
    });
    replies.forEach((reply) => fetch.mockResolvedValueOnce(reply));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["findings"]).toEqual([
      "replay: cached response mismatch",
    ]);
  });
  it("accepts semantically equal replay objects with different property order", async () => {
    const replies = sequence();
    replies[2] = response(
      201,
      Object.fromEntries(Object.entries(body()).reverse()),
    );
    replies.forEach((reply) => fetch.mockResolvedValueOnce(reply));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });
  it.each([
    { status: 401, reason: "unauthorized", unknown: false },
    { status: 302, reason: "redirected", unknown: true },
    { status: 0, reason: "network failure", unknown: true },
  ])("reports safe $reason at create", async ({ status, reason, unknown }) => {
    fetch.mockResolvedValueOnce(response(status, { message: "secret-token" }));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["incompleteReason"]).toBe(reason);
    expect(result.details?.["incompleteOperation"]).toBe("create");
    expect(result.details?.["unknownCreationOutcome"]).toBe(unknown);
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("reports unsafe URL without claiming an unknown creation", async () => {
    safe.mockResolvedValue(false);
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["incompleteReason"]).toBe("unsafe URL");
    expect(result.details?.["unknownCreationOutcome"]).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { index: 0, stage: "create" },
    { index: 2, stage: "replay" },
    { index: 3, stage: "changed-body replay" },
  ])(
    "tracks abort during $stage and preserves its reason if cleanup fails",
    async ({ index, stage }) => {
      const controller = new AbortController();
      sequence()
        .slice(0, index)
        .forEach((reply) => fetch.mockResolvedValueOnce(reply));
      fetch.mockImplementationOnce(() => {
        controller.abort();
        throw new Error("secret-token");
      });
      fetch.mockRejectedValue(new Error("secret-token cleanup"));
      const result = await audit.audit(
        context(prepareAcpSandbox(config)(controller.signal)),
      );
      expect(result.details?.["complete"]).toBe(false);
      expect(result.details?.["cleanupCertain"]).toBe(false);
      expect(result.details?.["unknownCreationOutcome"]).toBe(true);
      expect(result.details?.["incompleteReason"]).toBe("aborted");
      expect(result.details?.["incompleteOperation"]).toBe(stage);
      expect(result.details?.["recoveryKey"]).toMatch(/^[a-f0-9-]{36}$/);
      if (index > 0)
        expect(result.details?.["cleanupReason"]).toBe("network failure");
      expect(JSON.stringify(result)).not.toContain("secret-token");
    },
  );
  it("continues cleanup after the first failure among multiple observed IDs", async () => {
    const replies = sequence();
    replies[2] = response(201, body("cs_2"));
    replies.slice(0, 5).forEach((reply) => fetch.mockResolvedValueOnce(reply));
    fetch.mockRejectedValueOnce(new Error("secret-token primary"));
    fetch.mockRejectedValueOnce(new Error("secret-token cleanup"));
    fetch.mockResolvedValueOnce(response(200, body("cs_2", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["complete"]).toBe(false);
    expect(result.details?.["cleanupCertain"]).toBe(false);
    expect(result.details?.["unknownCreationOutcome"]).toBe(false);
    expect(result.details?.["incompleteOperation"]).toBe("cancel");
    expect(result.details?.["recoveryKey"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(fetch.mock.calls.at(-2)?.[0].url).toContain("cs_1/cancel");
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("cs_2/cancel");
  });
  it.each([
    { index: 1, label: "retrieve" },
    { index: 3, label: "changed-body replay" },
    { index: 4, label: "unknown session" },
    { index: 5, label: "cancel" },
  ])("finds a malformed $label body", async ({ index, label }) => {
    const replies = sequence();
    replies[index] = response(replies[index]!.status, {
      message: "secret-token",
    });
    replies.forEach((reply) => fetch.mockResolvedValueOnce(reply));
    fetch.mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["findings"]).toContainEqual(
      expect.stringContaining(`${label}: response schema mismatch`),
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});

describe("ACP cleanup ownership", () => {
  it("does not own an ID from a rejected initial create", async () => {
    fetch.mockResolvedValueOnce(
      response(400, { ...err, id: "unrelated_fixture" }),
    );
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["incompleteReason"]).toBe("create rejected");
    expect(result.details?.["unknownCreationOutcome"]).toBe(false);
    expect(result.details?.["cleanupCertain"]).toBe(true);
    expect(result.details?.["findings"]).toContain(
      "create: unexpected HTTP status",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      fetch.mock.calls.some(([call]) => call.url.includes("unrelated_fixture")),
    ).toBe(false);
  });
  it("does not own an ID from a rejected replay", async () => {
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(400, { ...err, id: "unrelated_fixture" }))
      .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.details?.["incompleteOperation"]).toBe("replay");
    expect(result.details?.["unknownCreationOutcome"]).toBe(false);
    expect(result.details?.["cleanupCertain"]).toBe(true);
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("cs_1/cancel");
    expect(
      fetch.mock.calls.some(([call]) => call.url.includes("unrelated_fixture")),
    ).toBe(false);
  });
  it("does not own an ID from a malformed 422 conflict Error", async () => {
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(201, body()))
      .mockResolvedValueOnce(response(422, { ...err, id: "unrelated_fixture" }))
      .mockResolvedValueOnce(response(404, err))
      .mockResolvedValueOnce(response(200, body("cs_1", "canceled")));
    const result = await audit.audit(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["findings"]).toContainEqual(
      expect.stringContaining("changed-body replay: response schema mismatch"),
    );
    expect(result.details?.["unknownCreationOutcome"]).toBe(false);
    expect(result.details?.["cleanupCertain"]).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(
      fetch.mock.calls.some(([call]) => call.url.includes("unrelated_fixture")),
    ).toBe(false);
  });
});
