import { expect, it } from "vitest";
import type { AuditDetails } from "./audit-details";
import { AuditResultSchema, CheckResultSchema } from "./schemas";
import { defaultConfig } from "./audit-config";
import { CheckStatus } from "./types";

const valid = {
  count: 2,
  enabled: true,
  label: "text",
  names: ["a"],
  expected: "expected",
  found: "found",
  code: "code",
} satisfies AuditDetails;
// @ts-expect-error Nested objects are not detail values.
const nested: AuditDetails = { nested: { count: 1 } };
// @ts-expect-error Number arrays are not detail values.
const numbers: AuditDetails = { numbers: [1, 2] };

// @ts-expect-error The reserved expected field requires a string.
const numericExpected: AuditDetails = { expected: 2 };
// @ts-expect-error The reserved found field requires a string.
const booleanFound: AuditDetails = { found: true };
// @ts-expect-error The reserved code field requires a string.
const arrayCode: AuditDetails = { code: ["a"] };

it("preserves allowed details through both result schemas", () => {
  const audit = Object.values(defaultConfig.audits)[0]![0]!.create();
  const result = { status: CheckStatus.Pass, score: 1, details: valid };
  expect(AuditResultSchema.parse(result).details).toEqual(valid);
  expect(
    CheckResultSchema.parse(audit.toCheckResult(result)).details,
  ).toMatchObject(valid);
});

it.each([
  nested,
  numbers,
  numericExpected,
  booleanFound,
  arrayCode,
  { list: Array(101).fill("a") },
  { list: ["a".repeat(1001)] },
  { text: "a".repeat(10001) },
])("rejects invalid detail boundaries in both schemas", (details) => {
  const audit = Object.values(defaultConfig.audits)[0]![0]!.create();
  const result = { status: CheckStatus.Pass, score: 1, details };
  expect(AuditResultSchema.safeParse(result).success).toBe(false);
  const check = audit.toCheckResult({ ...result, details: valid });
  expect(CheckResultSchema.safeParse({ ...check, details }).success).toBe(
    false,
  );
});
