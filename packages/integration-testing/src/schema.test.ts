import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./protocols/acp/2026-04-17/checkout-schema";

describe("pinned ACP schema snapshot", () => {
  it("uses the same protocol schema in the runtime and upstream snapshot", () => {
    const snapshot = readFileSync(
      resolve(
        process.cwd(),
        "packages/integration-testing/src/protocols/acp/2026-04-17/schema.agentic_checkout.json",
      ),
      "utf8",
    );
    expect(checkoutSchema).toEqual(JSON.parse(snapshot));
    const provenance = readFileSync(
      resolve(
        process.cwd(),
        "packages/integration-testing/src/protocols/acp/2026-04-17/PROVENANCE.md",
      ),
      "utf8",
    );
    expect(provenance).toContain(
      createHash("sha256").update(snapshot).digest("hex"),
    );
  });
});

it("keeps the upstream OpenAPI digest and license", () => {
  const base = "packages/integration-testing/src/protocols/acp/2026-04-17/";
  const provenance = readFileSync(base + "PROVENANCE.md", "utf8");
  const openapi = readFileSync(base + "openapi.agentic_checkout.yaml");
  expect(provenance).toContain(
    createHash("sha256").update(openapi).digest("hex"),
  );
  expect(readFileSync(base + "LICENSE", "utf8")).toContain("Apache License");
});
