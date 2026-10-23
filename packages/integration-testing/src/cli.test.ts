import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "acp-cli-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const config = join(directory, "config.json");
writeFileSync(
  config,
  JSON.stringify({
    baseUrl: "https://sandbox.example/api",
    sandboxAcknowledged: true,
    tokenEnv: "ACP_CLI_TEST_TOKEN",
    apiVersion: "2026-04-17",
    testItems: [{ id: "item" }],
    currency: "usd",
  }),
);
const preload = join(directory, "transport.cjs");
writeFileSync(
  preload,
  `
const Module = require("node:module");
const original = Module._load;
const session = {id:"cs_cli",status:"ready_for_payment",currency:"usd",line_items:[],totals:[],fulfillment_options:[],messages:[],links:[],capabilities:{}};
let index = 0;
Module._load = function(name,...args) {
 if (name !== "undici") return original.call(this,name,...args);
 return { Agent: class { async destroy() {} }, request: async (url, options) => {
 const current = index++;
 if (url.pathname.includes("complete")) throw new Error("Unexpected completion");
 if (process.env.ACP_CLI_MODE === "abort" && current === 1) {process.kill(process.pid,"SIGTERM"); await new Promise(resolve => setImmediate(resolve)); throw new Error("private-token");}
 if (process.env.ACP_CLI_MODE === "network") throw new Error("private-token");
 const canceled = url.pathname.endsWith("/cancel");
 const status = canceled ? 200 : [201,200,201,422,404][current];
 const value = canceled ? {...session,status:"canceled"} : current < 3 ? {...session,...(process.env.ACP_CLI_MODE === "mismatch" && current === 1 ? {currency:22}: {})} : {type:"invalid_request",code:"idempotency_conflict",message:"private-token"};
 return { statusCode: status, headers:{"content-type":"application/json"},body:{async *[Symbol.asyncIterator]() {yield Buffer.from(JSON.stringify(value));},destroy(){}} };
 } };
};
`,
);
function run(mode = "pass", args = ["--config", config]) {
  return spawnSync(
    process.execPath,
    [
      "--require",
      preload,
      resolve("packages/integration-testing/dist/cli.js"),
      ...args,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ACP_CLI_TEST_TOKEN: "private-token",
        ACP_CLI_MODE: mode,
      },
      timeout: 10000,
    },
  );
}
describe("built local ACP executable", () => {
  it.each([
    ["pass", 0, "passed"],
    ["mismatch", 1, "contract-mismatch"],
    ["network", 2, "incomplete"],
    ["abort", 2, "incomplete"],
  ] as const)("returns JSON for %s", (mode, code, outcome) => {
    const result = run(mode);
    expect(result.status).toBe(code);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout).outcome).toBe(outcome);
    expect(result.stdout).not.toMatch(/private-token|sandbox\.example|cs_cli/);
  });
  it("shows executable help", () => {
    const result = run("pass", ["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--config");
  });
  it("rejects raw tokens and unknown flags", () => {
    const result = run("pass", ["--token", "private-token"]);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).error).toBe(
      "Invalid ACP sandbox arguments",
    );
    expect(result.stdout).not.toContain("private-token");
  });
});

describe("bounded config file input", () => {
  it.each(["ascii", "multibyte"])(
    "rejects oversized %s config bytes",
    (mode) => {
      const file = join(directory, `oversized-${mode}.json`);
      const original = JSON.parse(requireConfig());
      // Whitespace keeps the over-limit ASCII input otherwise valid JSON.
      const text =
        mode === "ascii"
          ? JSON.stringify(original) + " ".repeat(65537)
          : `{"testItems":"${"é".repeat(33000)}",${JSON.stringify(original).slice(1)}`;
      expect(JSON.parse(text)).toEqual(original);
      expect(Buffer.byteLength(text)).toBeGreaterThan(65536);
      if (mode === "multibyte") expect(text.length).toBeLessThan(65536);
      writeFileSync(file, text);
      const result = run("pass", ["--config", file]);
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).error).toBe(
        "Invalid ACP sandbox configuration",
      );
    },
  );
  it("rejects a non-regular file", () => {
    const result = run("pass", ["--config", directory]);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).error).toBe(
      "Invalid ACP sandbox configuration",
    );
  });
});
function requireConfig(): string {
  return JSON.stringify({
    baseUrl: "https://sandbox.example/api",
    sandboxAcknowledged: true,
    tokenEnv: "ACP_CLI_TEST_TOKEN",
    apiVersion: "2026-04-17",
    testItems: [{ id: "item" }],
    currency: "usd",
  });
}
