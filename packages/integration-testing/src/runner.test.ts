import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareAcpSandbox as prepare } from "./runner";
import { PrivateTransportError, TransportReason } from "./transport";
const fetch = vi.fn();
const close = vi.fn(async () => {});
const prepareAcpSandbox = (input: unknown) =>
  prepare(input, () => ({ fetch, close }));
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
const context = (provider: () => Promise<import("./runner").AcpProbeResult>) =>
  provider;
const run = (provider: () => Promise<import("./runner").AcpProbeResult>) =>
  provider();
beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockReset();
  close.mockClear();
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
    const [result, again] = await Promise.all([run(ctx), run(ctx)]);
    expect(result.outcome).toBe("passed");
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
    expect(result.completedFixtureTested).toBe(false);
  });
  it.each(["usd", "USD"])(
    "changes the currency for the changed-body replay when the config says %s",
    async (currency) => {
      successfulSequence();
      const runtime = prepareAcpSandbox({ ...config, currency });
      await run(context(runtime(new AbortController().signal)));
      const changed = JSON.parse(fetch.mock.calls[3]![0].body);
      expect(changed.currency).toBe("eur");
    },
  );
  it("runs one probe per caller signal and honours each caller's abort", async () => {
    successfulSequence();
    const runtime = prepareAcpSandbox(config);
    const first = new AbortController();
    const shared = await Promise.all([
      runtime(first.signal)(),
      runtime(first.signal)(),
    ]);
    expect(shared[1]).toBe(shared[0]);
    expect(fetch).toHaveBeenCalledTimes(6);
    const second = new AbortController();
    second.abort();
    const own = await runtime(second.signal)();
    expect(own).not.toBe(shared[0]);
    expect(own.outcome).not.toBe("passed");
    // settled() waits for every run, not only the first one.
    await expect(runtime.settled()).resolves.toBeUndefined();
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
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
    const result = await run(context(runtime(controller.signal)));
    await runtime.settled();
    expect(result.complete).toBe(false);
    expect(fetch.mock.calls.at(-1)?.[0].signal.aborted).toBe(false);
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("/cancel");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("marks unknown creation and redirects incomplete without following redirects", async () => {
    fetch.mockResolvedValueOnce(response(302, { id: "secret-token" }));
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.unknownCreationOutcome).toBe(true);
    expect(result.cleanupCertain).toBe(false);
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
    expect(fetch.mock.calls.at(-1)?.[0].url).toContain("cs_2/cancel");
    expect(result.cleanupCertain).toBe(true);
  });
  it("verifies completed fixture state before a 405 cancellation test", async () => {
    successfulSequence();
    fetch
      .mockResolvedValueOnce(response(200, body("cs_completed", "completed")))
      .mockResolvedValueOnce(response(405, err));
    const result = await run(
      context(
        prepareAcpSandbox({ ...config, completedSessionId: "cs_completed" })(
          new AbortController().signal,
        ),
      ),
    );
    expect(result.completedFixtureTested).toBe(true);
    expect(result.outcome).toBe("passed");
  });
  it("never cancels a fixture whose completed state is unverified", async () => {
    successfulSequence();
    fetch.mockResolvedValueOnce(response(200, body("cs_completed")));
    const result = await run(
      context(
        prepareAcpSandbox({ ...config, completedSessionId: "cs_completed" })(
          new AbortController().signal,
        ),
      ),
    );
    expect(result.completedFixtureTested).toBe(false);
    expect(result.complete).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(7);
  });
  it("does not include hostile thrown errors and reports cleanup uncertainty", async () => {
    fetch
      .mockResolvedValueOnce(response(201, body()))
      .mockRejectedValue(new Error("secret-token"));
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.cleanupCertain).toBe(false);
    expect(result.complete).toBe(false);
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
      const result = await run(
        context(prepareAcpSandbox(config)(new AbortController().signal)),
      );
      expect(result.outcome).toBe("contract-mismatch");
      expect(result.findings).toContain("create: response media type mismatch");
      expect(
        fetch.mock.calls.every(
          ([call]) => call.acceptHeader === "application/json",
        ),
      ).toBe(true);
      expect(result.cleanupCertain).toBe(true);
      expect(JSON.stringify(result)).not.toContain("secret-token");
    },
  );
  it.each([undefined, "secret-token", "unsafe/session"])(
    "reports unknown creation when a 201 has no safe usable ID (%s)",
    async (id) => {
      fetch.mockResolvedValueOnce(response(201, { ...body(), id }));
      const result = await run(
        context(prepareAcpSandbox(config)(new AbortController().signal)),
      );
      expect(result.unknownCreationOutcome).toBe(true);
      expect(result.cleanupCertain).toBe(false);
      expect(result.complete).toBe(false);
      expect(result.recoveryKey).toMatch(/^[a-f0-9-]{36}$/);
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
    expect(result.findings).toEqual(["replay: cached response mismatch"]);
  });
  it("accepts semantically equal replay objects with different property order", async () => {
    const replies = sequence();
    replies[2] = response(
      201,
      Object.fromEntries(Object.entries(body()).reverse()),
    );
    replies.forEach((reply) => fetch.mockResolvedValueOnce(reply));
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("passed");
  });
  it.each([
    { status: 401, reason: "unauthorized", unknown: false },
    { status: 302, reason: "redirected", unknown: true },
    { status: 0, reason: "network failure", unknown: true },
  ])("reports safe $reason at create", async ({ status, reason, unknown }) => {
    fetch.mockResolvedValueOnce(response(status, { message: "secret-token" }));
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.incompleteReason).toBe(reason);
    expect(result.incompleteOperation).toBe("create");
    expect(result.unknownCreationOutcome).toBe(unknown);
    expect(JSON.stringify(result)).not.toContain("secret-token");
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
      const result = await run(
        context(prepareAcpSandbox(config)(controller.signal)),
      );
      expect(result.complete).toBe(false);
      expect(result.cleanupCertain).toBe(false);
      expect(result.unknownCreationOutcome).toBe(true);
      expect(result.incompleteReason).toBe("aborted");
      expect(result.incompleteOperation).toBe(stage);
      expect(result.recoveryKey).toMatch(/^[a-f0-9-]{36}$/);
      if (index > 0) expect(result.cleanupReason).toBe("network failure");
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.complete).toBe(false);
    expect(result.cleanupCertain).toBe(false);
    expect(result.unknownCreationOutcome).toBe(false);
    expect(result.incompleteOperation).toBe("cancel");
    expect(result.recoveryKey).toMatch(/^[a-f0-9-]{36}$/);
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
    expect(result.findings).toContainEqual(
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
    expect(result.incompleteReason).toBe("");
    expect(result.unknownCreationOutcome).toBe(false);
    expect(result.cleanupCertain).toBe(true);
    expect(result.findings).toContain("create: unexpected HTTP status");
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.incompleteOperation).toBe("");
    expect(result.unknownCreationOutcome).toBe(false);
    expect(result.cleanupCertain).toBe(true);
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
    const result = await run(
      context(prepareAcpSandbox(config)(new AbortController().signal)),
    );
    expect(result.outcome).toBe("contract-mismatch");
    expect(result.findings).toContainEqual(
      expect.stringContaining("changed-body replay: response schema mismatch"),
    );
    expect(result.unknownCreationOutcome).toBe(false);
    expect(result.cleanupCertain).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(
      fetch.mock.calls.some(([call]) => call.url.includes("unrelated_fixture")),
    ).toBe(false);
  });
});

describe("cancellation ownership and fixture preconditions", () => {
  it("keeps ownership after a cancel with a wrong media type", async () => {
    successfulSequence();
    fetch.mockReset();
    for (const reply of [
      response(201, body()),
      response(200, body()),
      response(201, body()),
      response(422, err),
      response(404, err),
      response(200, body("cs_1", "canceled"), "text/plain"),
      response(200, body("cs_1", "canceled")),
    ])
      fetch.mockResolvedValueOnce(reply);
    const result = await prepareAcpSandbox(config)(
      new AbortController().signal,
    )();
    expect(result.outcome).toBe("contract-mismatch");
    expect(result.cleanupCertain).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(close).toHaveBeenCalledOnce();
  });
  it.each([
    { status: 200, media: "text/plain" },
    { status: 201, media: "application/json" },
  ])(
    "does not mutate an unverified fixture envelope",
    async ({ status, media }) => {
      successfulSequence();
      fetch.mockResolvedValueOnce(
        response(status, body("fixture", "completed"), media),
      );
      const result = await prepareAcpSandbox({
        ...config,
        completedSessionId: "fixture",
      })(new AbortController().signal)();
      expect(result.outcome).toBe("incomplete");
      expect(result.completedFixtureTested).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(7);
      expect(
        fetch.mock.calls.some(([call]) => call.url.endsWith("/fixture/cancel")),
      ).toBe(false);
    },
  );
  it("reports optional fixture coverage as untested", async () => {
    successfulSequence();
    const result = await prepareAcpSandbox(config)(
      new AbortController().signal,
    )();
    expect(result.operationCoverage["completed fixture"]).toBe("untested");
    expect(result.operationCoverage["completed cancellation"]).toBe("untested");
    expect(result.operationCoverage["create"]).toBe("passed");
  });
});

describe("review regressions", () => {
  it("reuses the owned cancellation key during cleanup", async () => {
    successfulSequence();
    fetch.mockReset();
    for (const reply of [
      response(201, body()),
      response(200, body()),
      response(201, body()),
      response(422, err),
      response(404, err),
      response(200, body("cs_1", "canceled"), "text/plain"),
      response(200, body("cs_1", "canceled")),
    ])
      fetch.mockResolvedValueOnce(reply);
    const result = await prepareAcpSandbox(config)(
      new AbortController().signal,
    )();
    const cancellations = fetch.mock.calls.filter(([call]) =>
      call.url.endsWith("/cancel"),
    );
    expect(cancellations).toHaveLength(2);
    expect(cancellations[0]![0].headers["Idempotency-Key"]).toBe(
      cancellations[1]![0].headers["Idempotency-Key"],
    );
    expect(cancellations[0]![0].body).toBe(cancellations[1]![0].body);
    expect(result.cleanupCertain).toBe(true);
  });
  it("reports bounded local schema repair facts and numeric status facts without merchant text", async () => {
    const hostile = {
      ...body(),
      line_items: Array.from({ length: 100 }, () => ({
        id: "secret-token",
        item: { id: "secret-token" },
        quantity: "secret-token",
      })),
      ["hostile-secret-token-key"]: "secret-token",
    };
    for (const reply of [
      response(202, hostile),
      response(200, body()),
      response(201, hostile),
      response(409, err),
      response(404, err),
      response(200, body("cs_1", "canceled")),
    ])
      fetch.mockResolvedValueOnce(reply);
    const result = await prepareAcpSandbox(config)(
      new AbortController().signal,
    )();
    expect(result.findings).toContain("create: response schema mismatch");
    expect(result.findings).toContain("create: unexpected HTTP status");
    expect(result.schemaDiagnostics.length).toBeGreaterThan(0);
    expect(result.schemaDiagnostics.length).toBeLessThanOrEqual(32);
    expect(result.schemaDiagnostics).toContainEqual({
      operation: "create",
      schemaPath: "#/properties/quantity/type",
      keyword: "type",
    });
    expect(
      result.schemaDiagnostics.every(
        (item) =>
          item.schemaPath.length <= 160 &&
          Object.keys(item).sort().join(",") === "keyword,operation,schemaPath",
      ),
    ).toBe(true);
    expect(result.statusDiagnostics).toContainEqual({
      operation: "create",
      expected: 201,
      actual: 202,
    });
    expect(result.statusDiagnostics).toContainEqual({
      operation: "changed-body replay",
      expected: 422,
      actual: 409,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret-token|hostile-|instancePath|must be|schema invalid/,
    );
  });
  it.each(Object.values(TransportReason))(
    "preserves the typed transport reason %s",
    async (reason) => {
      fetch.mockRejectedValueOnce(new PrivateTransportError(reason));
      const result = await prepareAcpSandbox(config)(
        new AbortController().signal,
      )();
      expect(result.incompleteReason).toBe(reason);
      expect(result.outcome).toBe("incomplete");
    },
  );
  it("gives caller abort priority over a typed transport error", async () => {
    const controller = new AbortController();
    fetch.mockImplementationOnce(() => {
      controller.abort();
      throw new PrivateTransportError(TransportReason.Timeout);
    });
    const result = await prepareAcpSandbox(config)(controller.signal)();
    expect(result.incompleteReason).toBe("aborted");
  });
  it("uses one total 5 s cleanup deadline and stops starts after expiry", async () => {
    vi.useFakeTimers();
    try {
      for (const reply of [
        response(201, body()),
        response(200, body()),
        response(201, body("cs_2")),
        response(201, body("cs_3")),
        response(404, err),
      ])
        fetch.mockResolvedValueOnce(reply);
      fetch.mockRejectedValueOnce(new Error("main request failed"));
      const starts: { time: number; signal: AbortSignal; url: string }[] = [];
      fetch.mockImplementation(
        ({ signal, url }) =>
          new Promise((resolve, reject) => {
            starts.push({ time: Date.now(), signal, url });
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", abort);
              resolve(
                response(
                  200,
                  body(url.includes("cs_1") ? "cs_1" : "cs_2", "canceled"),
                ),
              );
            }, 3000);
            const abort = () => {
              clearTimeout(timer);
              reject(new Error("cleanup stopped"));
            };
            signal.addEventListener("abort", abort, { once: true });
          }),
      );
      const start = Date.now();
      const pending = prepareAcpSandbox(config)(new AbortController().signal)();
      await vi.advanceTimersByTimeAsync(0);
      expect(starts).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(starts).toHaveLength(2);
      expect(starts[1]!.time - start).toBe(3000);
      expect(starts[0]!.signal).toBe(starts[1]!.signal);
      await vi.advanceTimersByTimeAsync(2000);
      const result = await pending;
      expect(Date.now() - start).toBe(5000);
      expect(starts).toHaveLength(2);
      expect(starts.some((item) => item.url.includes("cs_3"))).toBe(false);
      expect(result.outcome).toBe("incomplete");
      expect(result.cleanupCertain).toBe(false);
      expect(result.cleanupReason).toBe("aborted");
      expect(result.recoveryKey).toMatch(/^[a-f0-9-]{36}$/);
      expect(result.incompleteReason).toBe("network failure");
    } finally {
      vi.useRealTimers();
    }
  });
});
