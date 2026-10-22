import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectPage, type FetchResult } from "@forkpoint/agent-lighthouse-core";
import { detectUrl } from "./detect";

const net = vi.hoisted(() => ({ response: {} as FetchResult }));
vi.mock("@forkpoint/agent-lighthouse-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@forkpoint/agent-lighthouse-core")>();
  return {
    ...actual,
    isSafeUrl: vi.fn(async () => true),
    detectPage: vi.fn(actual.detectPage),
    createFetcher: () => ({ fetch: async () => net.response }),
  };
});

const target = new URL("https://example.test/");
beforeEach(() => {
  vi.mocked(detectPage).mockClear();
  net.response = {
    url: target.href,
    finalUrl: target.href,
    status: 200,
    headers: {},
    contentType: "",
    body: "<html><body><h1>Hello</h1></body></html>",
    ttfbMs: 1,
    totalMs: 2,
    contentLength: 40,
  };
});

describe("URL detection response handling", () => {
  it.each([
    ["connection refused (ECONNREFUSED)", "ECONNREFUSED"],
    ["request timed out", "timeout"],
    ["request timeout", "timeout"],
    ["operation aborted", "aborted"],
    ["unrecognized transport failure", "fetch_error"],
    [undefined, "fetch_error"],
  ])("returns a short failure code for %s", async (error, message) => {
    net.response.status = 0;
    if (error !== undefined) net.response.error = error;
    await expect(detectUrl(target, target.href)).rejects.toMatchObject({
      name: "DetectError",
      status: 502,
      code: "fetch_failed",
      message,
    });
    expect(detectPage).not.toHaveBeenCalled();
  });

  it("accepts HTML declared only in the response headers", async () => {
    net.response.headers["content-type"] =
      "Application/XHTML+XML; charset=UTF-8";
    const result = await detectUrl(target, target.href);
    expect(result.payload.html).toBe(net.response.body);
    expect(result.response).toBe(net.response);
  });

  it("refuses a response with no content type", async () => {
    await expect(detectUrl(target, target.href)).rejects.toMatchObject({
      status: 422,
      code: "not_html",
      message: "not an HTML page",
    });
    expect(detectPage).not.toHaveBeenCalled();
  });

  it("preserves an unexpected detector error", async () => {
    net.response.contentType = "text/html";
    const error = new Error("detector failed");
    vi.mocked(detectPage).mockImplementationOnce(() => {
      throw error;
    });
    await expect(detectUrl(target, target.href)).rejects.toBe(error);
  });
});
