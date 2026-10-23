import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  request: vi.fn(),
  lookup: vi.fn(),
  destroy: vi.fn(async () => {}),
  connectionLookup: undefined as unknown,
}));
vi.mock("node:dns", () => ({ lookup: state.lookup }));
vi.mock("undici", () => ({
  request: state.request,
  Agent: class {
    constructor(options: { connect: { lookup: unknown } }) {
      state.connectionLookup = options.connect.lookup;
    }
    destroy = state.destroy;
  },
}));
import { createPrivateTransport } from "./transport";
const input = {
  url: "https://sandbox.example/checkout_sessions",
  method: "GET" as const,
  headers: { Authorization: "Bearer secret" },
  signal: new AbortController().signal,
  timeout: 20,
  followRedirects: false,
  acceptHeader: "application/json",
};
beforeEach(() => {
  state.request.mockReset();
  state.lookup.mockReset();
  state.destroy.mockClear();
});
describe("private connection and body bounds", () => {
  it.each(["127.0.0.1", "169.254.169.254", "::ffff:127.0.0.1"])(
    "refuses rebound DNS address %s",
    async (address) => {
      const transport = createPrivateTransport("https://sandbox.example");
      state.lookup.mockImplementation((_host, _options, callback) =>
        callback(null, [{ address, family: address.includes(":") ? 6 : 4 }]),
      );
      const callback = vi.fn();
      (
        state.connectionLookup as (
          host: string,
          options: object,
          callback: unknown,
        ) => void
      )("sandbox.example", { all: true }, callback);
      expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
      expect(callback.mock.calls[0]?.[1]).toEqual([]);
      expect(state.request).not.toHaveBeenCalled();
      await transport.close();
    },
  );
  it("validates every address and forwards a safe resolved address", async () => {
    const transport = createPrivateTransport("https://sandbox.example");
    state.lookup.mockImplementation((_host, _options, callback) =>
      callback(null, [{ address: "8.8.8.8", family: 4 }]),
    );
    const callback = vi.fn();
    (
      state.connectionLookup as (
        host: string,
        options: object,
        callback: unknown,
      ) => void
    )("sandbox.example", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    await transport.close();
  });
  it("destroys an oversized response body", async () => {
    const destroy = vi.fn();
    state.request.mockResolvedValue({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.alloc(1024 * 1024 + 1);
        },
        destroy,
      },
    });
    const transport = createPrivateTransport("https://sandbox.example");
    await expect(transport.fetch(input)).rejects.toThrow("response body limit");
    expect(destroy).toHaveBeenCalledOnce();
    await transport.close();
    expect(state.destroy).toHaveBeenCalledOnce();
  });
  it("bounds a stalled body with the total request signal", async () => {
    const destroy = vi.fn();
    state.request.mockImplementation(async (_url, options) => ({
      statusCode: 200,
      headers: {},
      body: {
        async *[Symbol.asyncIterator]() {
          await new Promise((_, reject) =>
            options.signal.addEventListener(
              "abort",
              () => reject(new Error("stopped")),
              { once: true },
            ),
          );
          yield Buffer.from("unused");
        },
        destroy,
      },
    }));
    const transport = createPrivateTransport("https://sandbox.example");
    // Keep the test alive because AbortSignal.timeout uses an unref timer.
    const keepAlive = setInterval(() => {}, 100);
    try {
      await expect(transport.fetch(input)).rejects.toThrow("request timeout");
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      clearInterval(keepAlive);
      await transport.close();
    }
  });
});

it("uses installed undici without following or forwarding credentials on redirects", async () => {
  const actual = await vi.importActual<typeof import("undici")>("undici");
  const dispatcher = new actual.MockAgent();
  dispatcher.disableNetConnect();
  vi.spyOn(dispatcher, "destroy").mockImplementation(async () => {
    await dispatcher.close();
  });
  let destinationRequests = 0;
  dispatcher
    .get("https://sandbox.example")
    .intercept({ path: "/checkout_sessions", method: "GET" })
    .reply(302, "", {
      headers: {
        location: "https://destination.example/stolen",
        "content-type": "application/json",
      },
    });
  dispatcher
    .get("https://destination.example")
    .intercept({ path: "/stolen", method: "GET" })
    .reply(() => {
      destinationRequests++;
      return { statusCode: 200, data: "destination" };
    });
  vi.resetModules();
  vi.doMock("undici", () => ({
    ...actual,
    Agent: function Agent() {
      return dispatcher;
    },
  }));
  try {
    const { createPrivateTransport: createActualRequestTransport } =
      await import("./transport.js");
    const transport = createActualRequestTransport("https://sandbox.example");
    try {
      const result = await transport.fetch({ ...input, timeout: 2000 });
      expect(result.status).toBe(302);
      expect(destinationRequests).toBe(0);
      expect(dispatcher.pendingInterceptors()).toHaveLength(1);
      expect(dispatcher.pendingInterceptors()[0]?.origin).toBe(
        "https://destination.example",
      );
    } finally {
      await transport.close();
    }
  } finally {
    vi.doUnmock("undici");
    vi.resetModules();
  }
});
