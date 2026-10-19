import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  CaptureSource,
  DocumentState,
  PageType,
  PageTypeSource,
  PayloadOrigin,
  ScanReportSchema,
  type FetchOptions,
  type FetchResult,
} from "@forkpoint/agent-lighthouse-core";
import { createTaskServer, type TaskServer } from "./http";
import { TaskStatus } from "./task-types";

// The real scan runs against this map. The mock replaces core's fetcher
// module, which both the scan and URL detection import, so nothing reaches
// the network and no test performs DNS.
const net = vi.hoisted(() => ({
  pages: new Map<string, string>(),
  options: [] as FetchOptions[],
}));

vi.mock("../../core/src/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/src/fetcher")>();
  const answer = (url: string): FetchResult => {
    const body = net.pages.get(url);
    return {
      url,
      finalUrl: url,
      status: body === undefined ? 404 : 200,
      headers: body === undefined ? {} : { "content-type": "text/html" },
      body: body ?? "",
      ttfbMs: 1,
      totalMs: 2,
      contentType: body === undefined ? "" : "text/html",
      contentLength: body?.length ?? 0,
    };
  };
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: () => ({
      fetch: async (options: FetchOptions) => {
        net.options.push(options);
        return answer(options.url);
      },
      summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
    }),
  };
});

// No jsdom: the flow, not the accessibility pass, is under test.
vi.mock("../../core/src/audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

const TARGET = "https://shop.test/p/mug";
const PRODUCT = `<html><head><meta property="og:type" content="product"></head><body><main><h1>Blue mug</h1><p>${"A sturdy blue mug. ".repeat(40)}</p></main></body></html>`;

/**
 * Requests for `url` sent as a page read: no probe User-Agent, Accept or
 * method. Audits such as UA parity probe the target on purpose.
 */
const pageReads = (url: string) =>
  net.options.filter(
    (o) =>
      o.url === url &&
      o.userAgent === undefined &&
      o.acceptHeader === undefined &&
      o.method === undefined,
  );

let http: Server;
let tasks: TaskServer;
let base: string;

beforeEach(async () => {
  net.pages.clear();
  net.options.length = 0;
  tasks = createTaskServer();
  http = createServer((req, res) => tasks.handle(req, res));
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  tasks.close();
  await new Promise((r) => http.close(r));
});

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function result(taskId: string) {
  await vi.waitFor(
    async () => {
      const snap = await (await fetch(`${base}/tasks/${taskId}`)).json();
      expect(snap.status).toBe(TaskStatus.Succeeded);
    },
    { timeout: 20_000, interval: 50 },
  );
  return ScanReportSchema.parse(
    await (await fetch(`${base}/tasks/${taskId}/result`)).json(),
  );
}

describe("detection then scan", () => {
  it("scans a fetched payload without reading the target again", async () => {
    net.pages.set(TARGET, PRODUCT);
    const detected = await (await post("/detect", { url: TARGET })).json();
    expect(pageReads(TARGET)).toHaveLength(1);

    const { taskId } = await (
      await post("/tasks", { detectionId: detected.detectionId })
    ).json();
    const report = await result(taskId);

    expect(pageReads(TARGET)).toHaveLength(1);
    expect(report.pageIdentity).toEqual({
      type: PageType.Product,
      source: PageTypeSource.Detected,
      detectionId: detected.detectionId,
      payloadSha256: detected.payloadSha256,
      origin: PayloadOrigin.Fetched,
    });
    expect(report.pagesScanned[0]?.classification?.source).toBe(
      PageTypeSource.Detected,
    );
  });

  it("runs a supplied payload as the scan's snapshot", async () => {
    net.pages.set(TARGET, PRODUCT);
    const snapshot = {
      requestedUrl: TARGET,
      capturedUrl: TARGET,
      html: PRODUCT,
      capturedAt: "2026-10-19T10:00:00Z",
      captureSource: CaptureSource.CurrentTab,
      collector: { name: "extension", version: "1.0" },
      documentState: DocumentState.Complete,
      truncation: { truncated: false },
      redaction: { redacted: false, fields: [] },
    };
    const detected = await (await post("/detect", { snapshot })).json();
    expect(net.options).toEqual([]);

    const { taskId } = await (
      await post("/tasks", { detectionId: detected.detectionId })
    ).json();
    const report = await result(taskId);

    expect(report.pageIdentity?.payloadSha256).toBe(detected.payloadSha256);
    expect(report.pageIdentity?.origin).toBe(PayloadOrigin.Supplied);
    expect(report.browserAssessment?.captures).toHaveLength(1);
    // The crawler's HTTP evidence still comes from HTTP, read once.
    expect(pageReads(TARGET)).toHaveLength(1);
  });
});
