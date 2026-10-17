import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LogLevel } from "@forkpoint/agent-lighthouse-core";

// main.ts reads process.argv and exits, so the log flags are proven on the
// built binary, as a user runs it. The scan target is a server on loopback,
// so nothing leaves the machine. `pnpm build` must have run, as it does in CI
// before the tests.
const bin = resolve(__dirname, "../dist/bin.js");

/** The environment of a user who set no log variables. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env["LOG_LEVEL"];
  delete env["LOG_FORMAT"];
  return env;
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agent-lighthouse-log-flags-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("--log-level", () => {
  it("exits 1 and lists the levels for a value that names none", () => {
    const run = spawnSync(
      process.execPath,
      [bin, "https://example.com/", "--log-level=verbose"],
      { cwd: dir, env: cleanEnv(), encoding: "utf8", timeout: 20_000 },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Unknown log level: verbose");
    expect(run.stderr).toContain(
      `Valid levels: ${Object.values(LogLevel).join(", ")}`,
    );
  });
});

// The command line itself, on the built binary. The target is a loopback
// port the scanner refuses to fetch, so each run ends in about a second.
describe("command line", () => {
  function run(args: string[]) {
    return spawnSync(process.execPath, [bin, ...args], {
      cwd: dir,
      env: cleanEnv(),
      encoding: "utf8",
      timeout: 60_000,
    });
  }

  it("prints the usage and exits 0 on --help", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("agent-lighthouse <url>");
  });

  it("still exits 1 with the usage when no URL is given", () => {
    const missing = run(["--silent"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("No target URL specified");
  });

  it("scans a URL given after its flags, and echoes it without a password", () => {
    const scan = run([
      "--timeout",
      "30",
      "-o",
      "json",
      "-d",
      dir,
      "--log-level",
      "silent",
      "http://scanner:hunter2@127.0.0.1:9/",
    ]);
    expect(scan.status).toBe(0);
    expect(scan.stdout).toContain("http://127.0.0.1:9/");
    expect(scan.stdout + scan.stderr).not.toContain("hunter2");
  });
});

describe("--log-file", () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    // A homepage, 404 for everything else, and robots.txt dropped without an
    // answer so the scan has one warning to print.
    server = createServer((req, res) => {
      if (req.url === "/robots.txt") {
        req.socket.destroy();
        return;
      }
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          "<html><head><title>Home</title></head><body><main><h1>Hello</h1><p>Some content here.</p></main></body></html>",
        );
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    origin = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });

  /** Run the CLI to completion; the server must keep answering meanwhile. */
  function cli(
    args: string[],
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((done, fail) => {
      const child = spawn(process.execPath, [bin, ...args], {
        cwd: dir,
        env: cleanEnv(),
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", fail);
      child.on("close", (code) => done({ code, stdout, stderr }));
    });
  }

  it("appends every line down to trace as JSON, while the terminal shows warnings only", async () => {
    const file = join(dir, "scan.jsonl");
    writeFileSync(file, '{"msg":"earlier run"}\n');
    const run = await cli([
      `http://scanner:hunter2@${origin}/`,
      `--log-file=${file}`,
      "--output=json",
      "-d",
      join(dir, "out"),
      "--timeout=60",
    ]);
    expect(run.code).toBe(0);

    const lines = readFileSync(file, "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    // Appended, not overwritten.
    expect(lines[0]).toEqual({ msg: "earlier run" });
    const scan = lines.slice(1);
    const levels = new Set(scan.map((l) => l["level"]));
    for (const level of [
      LogLevel.Trace,
      LogLevel.Debug,
      LogLevel.Info,
      LogLevel.Warn,
    ])
      expect(levels).toContain(level);
    expect(scan.find((l) => l["msg"] === "Scan finished")).toMatchObject({
      level: LogLevel.Info,
      site: origin,
    });
    expect(new Set(scan.map((l) => l["scan"])).size).toBe(1);

    // The terminal default is warn: the warning shows, debug and info do not.
    expect(run.stderr).toMatch(
      / WARN {2}\[.+\] orchestrator: Some requests got no answer/,
    );
    expect(run.stderr).not.toMatch(/ (TRACE|DEBUG|INFO) /);
    // bin.js turns source maps on, so caller names the source file, not the
    // bundle.
    expect(run.stderr).toMatch(/caller=orchestrator\.ts:\d+/);

    // No log line carries the password in the target URL, in the file or
    // on stderr. (The banner on stdout echoes the URL as typed.)
    expect(readFileSync(file, "utf8")).not.toContain("hunter2");
    expect(run.stderr).not.toContain("hunter2");
  });

  it("writes the file at trace even when the terminal is silent", async () => {
    const file = join(dir, "quiet.jsonl");
    const run = await cli([
      `http://${origin}/`,
      `--log-file=${file}`,
      "--log-level=silent",
      "--output=json",
      "-d",
      join(dir, "out"),
      "--timeout=60",
    ]);
    expect(run.code).toBe(0);
    expect(run.stderr).not.toMatch(/ (TRACE|DEBUG|INFO|WARN|ERROR) /);
    const msgs = readFileSync(file, "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => (JSON.parse(line) as Record<string, unknown>)["msg"]);
    expect(msgs).toContain("Request started");
    expect(msgs).toContain("Scan finished");
  });
});
