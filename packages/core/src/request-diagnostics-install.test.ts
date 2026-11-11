import { channel } from "node:diagnostics_channel";
import { expect, it } from "vitest";
import { createRequestDiagnostics } from "./request-diagnostics";

it("attaches no Undici listener until diagnostics are first used", () => {
  const create = channel("undici:request:create");
  expect(create.hasSubscribers).toBe(false);
  createRequestDiagnostics();
  expect(create.hasSubscribers).toBe(true);
});
