#!/usr/bin/env node
/**
 * Installs the packed packages the way a user does and runs their commands.
 *
 * Unit tests import the TypeScript sources, so they never run what npm
 * ships. 7.3.0 published an `agent-lighthouse-mcp` whose bin had no
 * `#!/usr/bin/env node` line: the shell ran the JavaScript as a shell script
 * and every macOS and Linux user got `use strict: command not found`. No test
 * could see it. This script packs every public package with `pnpm pack`
 * (which rewrites `workspace:*` to real versions), installs the tarballs into
 * an empty project with npm, and checks:
 *
 * - each bin starts with a shebang and runs when executed directly;
 * - `agent-lighthouse --help` prints the usage;
 * - a CLI scan of an address the scanner refuses to fetch still writes a JSON
 *   report and exits 0, so the whole scan path loads from the package;
 * - the MCP server answers `initialize` and `tools/list` over stdio, and a
 *   `tools/call` returns a result;
 * - the library entries load with both `require` and `import`.
 *
 * Run after `pnpm build`. It needs the npm registry for third-party
 * dependencies, and no other network: the scan target is 127.0.0.1, which
 * the scanner's SSRF gate refuses before any request.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["core", "report", "mcp", "cli"];
const BINS = ["agent-lighthouse", "agent-lighthouse-mcp"];
const LIBRARIES = [
  "@forkpoint/agent-lighthouse-core",
  "@forkpoint/agent-lighthouse-core/contracts",
  "@forkpoint/agent-lighthouse-report",
  "@forkpoint/agent-lighthouse-mcp",
];
/** A refused target: the SSRF gate stops it, so the scan sends nothing. */
const TARGET = "http://127.0.0.1:9/";

const work = mkdtempSync(join(tmpdir(), "al-smoke-"));
const failures = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

/** Pack every package; returns the tarball paths. */
function pack() {
  const dest = join(work, "tarballs");
  mkdirSync(dest);
  for (const name of PACKAGES) {
    const result = run("pnpm", ["pack", "--pack-destination", dest], {
      cwd: join(root, "packages", name),
    });
    if (result.status !== 0) {
      throw new Error(`pnpm pack failed for ${name}:\n${result.stderr}`);
    }
  }
  return readdirSync(dest).map((file) => join(dest, file));
}

/** Install the tarballs into an empty project, as `npm install` would. */
function install(tarballs) {
  const app = join(work, "app");
  mkdirSync(app);
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify({ name: "al-smoke", private: true }),
  );
  const result = run(
    "npm",
    ["install", "--no-audit", "--no-fund", "--loglevel=error", ...tarballs],
    { cwd: app, timeout: 300_000 },
  );
  if (result.status !== 0) {
    throw new Error(`npm install failed:\n${result.stderr}`);
  }
  return app;
}

function checkBins(app) {
  for (const bin of BINS) {
    const link = join(app, "node_modules", ".bin", bin);
    check(`${bin} is installed`, existsSync(link));
    if (!existsSync(link)) continue;
    const first = readFileSync(link, "utf8").split("\n", 1)[0];
    check(
      `${bin} starts with a shebang`,
      first === "#!/usr/bin/env node",
      first,
    );
  }
}

function checkCli(app) {
  const bin = join(app, "node_modules", ".bin", "agent-lighthouse");
  // Executed directly, not through `node`, so a missing shebang fails here.
  const help = run(bin, ["--help"], { cwd: app });
  check(
    "agent-lighthouse --help prints the usage and exits 0",
    help.status === 0 && help.stdout.includes("agent-lighthouse <url>"),
    `exit ${help.status}`,
  );

  const out = join(app, "out");
  const scan = run(
    bin,
    [TARGET, "-o", "json", "-d", out, "--silent", "--log-level", "silent"],
    { cwd: app },
  );
  const reports = existsSync(out)
    ? readdirSync(out).filter((file) => file.endsWith(".json"))
    : [];
  check(
    "agent-lighthouse scans a refused target and writes a JSON report",
    scan.status === 0 && reports.length === 1,
    `exit ${scan.status}, ${reports.length} report(s)${scan.stderr ? `, stderr: ${scan.stderr.slice(0, 200)}` : ""}`,
  );
  if (reports.length === 1) {
    const report = JSON.parse(readFileSync(join(out, reports[0]), "utf8"));
    check(
      "the report names the target",
      typeof report.url === "string" && report.url.startsWith(TARGET),
      String(report.url),
    );
  }
}

/** Send JSON-RPC lines to the MCP server and collect the replies by id. */
function talkToMcp(app, messages, wantIds) {
  const bin = join(app, "node_modules", ".bin", "agent-lighthouse-mcp");
  return new Promise((resolve) => {
    const child = spawn(bin, [], {
      cwd: app,
      env: { ...process.env, LOG_LEVEL: "silent" },
    });
    const replies = new Map();
    let buffer = "";
    const done = () => {
      clearTimeout(timer);
      child.kill();
      resolve(replies);
    };
    const timer = setTimeout(done, 90_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined) replies.set(message.id, message);
        } catch {
          // Not a JSON-RPC line; the server only writes JSON-RPC to stdout.
        }
        if (wantIds.every((id) => replies.has(id))) done();
      }
    });
    child.on("exit", done);
    for (const message of messages) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
  });
}

async function checkMcp(app) {
  const replies = await talkToMcp(
    app,
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke", version: "1" },
        },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "audit_website", arguments: { url: TARGET } },
      },
    ],
    [1, 2, 3],
  );
  const init = replies.get(1);
  check(
    "agent-lighthouse-mcp answers initialize",
    init?.result?.serverInfo?.name === "agent-lighthouse-mcp",
    JSON.stringify(init?.result?.serverInfo ?? init?.error ?? "no reply"),
  );
  const tools = replies.get(2)?.result?.tools ?? [];
  check(
    "agent-lighthouse-mcp lists audit_website",
    tools.some((tool) => tool.name === "audit_website"),
  );
  const call = replies.get(3);
  check(
    "agent-lighthouse-mcp returns a tools/call result",
    call?.result?.content?.[0]?.type === "text",
    JSON.stringify(call?.error ?? "").slice(0, 200),
  );
}

function checkLibraries(app) {
  for (const name of LIBRARIES) {
    const cjs = run("node", ["-e", `require(${JSON.stringify(name)})`], {
      cwd: app,
    });
    check(`require("${name}")`, cjs.status === 0, cjs.stderr.slice(0, 200));
    const esm = run(
      "node",
      ["--input-type=module", "-e", `await import(${JSON.stringify(name)})`],
      { cwd: app },
    );
    check(`import("${name}")`, esm.status === 0, esm.stderr.slice(0, 200));
  }
}

try {
  const app = install(pack());
  checkBins(app);
  checkCli(app);
  await checkMcp(app);
  checkLibraries(app);
} catch (error) {
  check("smoke run completes", false, String(error));
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
