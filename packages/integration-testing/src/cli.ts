import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { prepareAcpSandbox } from "./runner";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(
      "Usage: pnpm integration:acp --config path.json\nLocal ACP sandbox checks. No payment completion.\n",
    );
    return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    if (
      args.length !== 2 ||
      args[0] !== "--config" ||
      !args[1] ||
      args[1].startsWith("--")
    )
      throw new Error("Invalid ACP sandbox arguments");
    let input: unknown;
    try {
      const file = await open(
        args[1],
        constants.O_RDONLY | constants.O_NONBLOCK,
      );
      try {
        if (!(await file.stat()).isFile()) throw new Error();
        const buffer = Buffer.alloc(65537);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await file.read(
            buffer,
            length,
            buffer.length - length,
            length,
          );
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > 65536) throw new Error();
        input = JSON.parse(buffer.subarray(0, length).toString("utf8"));
      } finally {
        await file.close();
      }
    } catch {
      throw new Error("Invalid ACP sandbox configuration");
    }
    const run = prepareAcpSandbox(input);
    const result = await run(controller.signal)();
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode =
      result.outcome === "passed"
        ? 0
        : result.outcome === "contract-mismatch"
          ? 1
          : 2;
  } catch (error) {
    const allowed = [
      "Invalid ACP sandbox arguments",
      "Invalid ACP sandbox configuration",
      "ACP sandbox token is missing or invalid",
    ];
    const message =
      error instanceof Error && allowed.includes(error.message)
        ? error.message
        : "ACP sandbox test incomplete";
    process.stdout.write(
      JSON.stringify({ outcome: "incomplete", error: message }) + "\n",
    );
    process.exitCode = 2;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
void main();
