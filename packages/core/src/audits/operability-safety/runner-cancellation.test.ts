import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getEventListeners } from "node:events";

const { constructed } = vi.hoisted(() => ({ constructed: vi.fn() }));

vi.mock("jsdom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jsdom")>();
  return {
    ...actual,
    JSDOM: class extends actual.JSDOM {
      constructor(...args: ConstructorParameters<typeof actual.JSDOM>) {
        constructed(args[1]?.url);
        super(...args);
      }
    },
  };
});

let run: typeof import("./runner").runA11yForHtml;
const HTML = "<!doctype html><title>Public page</title><body>Content</body>";
const RULES = ["document-title"];

beforeAll(async () => {
  vi.stubEnv("A11Y_CONCURRENCY", "1");
  ({ runA11yForHtml: run } =
    await import("#core/audits/operability-safety/runner"));
});

describe("accessibility cancellation with two reserved slots", () => {
  let runTwo: typeof import("./runner").runA11yForHtml;
  beforeAll(async () => {
    vi.stubEnv("A11Y_CONCURRENCY", "2");
    vi.resetModules();
    ({ runA11yForHtml: runTwo } =
      await import("#core/audits/operability-safety/runner"));
  });

  it("admits two passes and preserves later work after queued cancellation", async () => {
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const runs = controllers.map((controller, index) =>
      runTwo(HTML, `https://slot${index}.test/`, RULES, controller.signal),
    );
    // The first two own slots. Only the remaining callers wait on abort.
    expect(getEventListeners(controllers[0]!.signal, "abort")).toHaveLength(0);
    expect(getEventListeners(controllers[1]!.signal, "abort")).toHaveLength(0);
    expect(getEventListeners(controllers[2]!.signal, "abort")).toHaveLength(1);
    expect(getEventListeners(controllers[3]!.signal, "abort")).toHaveLength(1);
    controllers[2]!.abort();
    const results = await Promise.all(runs);
    expect(results[2]).toEqual({});
    for (const index of [0, 1, 3]) {
      expect(results[index]?.["document-title"]).toBeDefined();
      expect(
        getEventListeners(controllers[index]!.signal, "abort"),
      ).toHaveLength(0);
    }
    expect(constructed.mock.calls.map(([url]) => url)).not.toContain(
      "https://slot2.test/",
    );
    expect(constructed).toHaveBeenCalledTimes(3);
    expect(
      (await runTwo(HTML, "https://later.test/", RULES))["document-title"],
    ).toBeDefined();
  });
});
beforeEach(() => constructed.mockReset());
afterAll(() => vi.unstubAllEnvs());

describe("accessibility queue cancellation", () => {
  it("skips an already canceled pass before DOM construction", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await run(HTML, "https://canceled.test/", RULES, controller.signal),
    ).toEqual({});
    expect(constructed).not.toHaveBeenCalled();
  });

  it("removes a canceled waiter without blocking the next pass", async () => {
    const controller = new AbortController();
    const active = run(HTML, "https://active.test/", RULES);
    const canceled = run(
      HTML,
      "https://canceled.test/",
      RULES,
      controller.signal,
    );
    const next = run(HTML, "https://next.test/", RULES);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
    controller.abort();
    const [first, skipped, last] = await Promise.all([active, canceled, next]);
    expect(first["document-title"]).toBeDefined();
    expect(skipped).toEqual({});
    expect(last["document-title"]).toBeDefined();
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    expect(constructed.mock.calls.map(([url]) => url)).toEqual([
      "https://active.test/",
      "https://next.test/",
    ]);
    const later = await run(HTML, "https://later.test/", RULES);
    expect(later["document-title"]).toBeDefined();
  });

  it("removes the abort listener when a queued pass receives its slot", async () => {
    const controller = new AbortController();
    const first = run(HTML, "https://active.test/", RULES);
    const next = run(HTML, "https://next.test/", RULES, controller.signal);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
    await Promise.all([first, next]);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("returns a granted slot when cancellation precedes DOM construction", async () => {
    const controller = new AbortController();
    // Schedule the abort before release grants the queued caller its slot.
    constructed.mockImplementationOnce(() => {
      queueMicrotask(() => controller.abort());
    });
    const first = run(HTML, "https://active.test/", RULES);
    const canceled = run(
      HTML,
      "https://canceled.test/",
      RULES,
      controller.signal,
    );
    const last = run(HTML, "https://next.test/", RULES);
    const results = await Promise.all([first, canceled, last]);
    expect(results[1]).toEqual({});
    expect(results[2]?.["document-title"]).toBeDefined();
    expect(constructed.mock.calls.map(([url]) => url)).toEqual([
      "https://active.test/",
      "https://next.test/",
    ]);
  });

  it("lets event-loop cancellation run before the next queued DOM pass", async () => {
    const controller = new AbortController();
    let notifyAbort!: () => void;
    const aborted = new Promise<void>((resolve) => {
      notifyAbort = resolve;
    });
    constructed.mockImplementationOnce(() => {
      setImmediate(() => {
        controller.abort();
        notifyAbort();
      });
    });
    const first = run(HTML, "https://active.test/", RULES);
    const canceled = run(
      HTML,
      "https://canceled.test/",
      RULES,
      controller.signal,
    );
    const last = run(HTML, "https://next.test/", RULES);
    const [, skipped, next] = await Promise.all([first, canceled, last]);
    await aborted;
    expect(skipped).toEqual({});
    expect(next["document-title"]).toBeDefined();
    expect(constructed.mock.calls.map(([url]) => url)).toEqual([
      "https://active.test/",
      "https://next.test/",
    ]);
  });
});
