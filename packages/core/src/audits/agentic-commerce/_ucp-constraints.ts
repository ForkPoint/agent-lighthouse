import Ajv2020 from "ajv/dist/2020.js";

// Pinned rule subset from the 2026-08-25 constraint_expression.json schema.
// All references are local; this validator cannot load merchant schemas.
const CONSTRAINT_SCHEMA = {
  type: "object",
  properties: {
    required: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string" },
    },
    properties: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        oneOf: [{ $ref: "#" }, { $ref: "#/$defs/value_constraint" }],
      },
    },
    anyOf: {
      type: "array",
      minItems: 1,
      items: { $ref: "#", minProperties: 1 },
    },
  },
  additionalProperties: false,
  $defs: {
    value_constraint: {
      type: "object",
      anyOf: [{ required: ["enum"] }, { required: ["const"] }],
      properties: {
        enum: { type: "array", minItems: 1, uniqueItems: true },
        const: {},
      },
      additionalProperties: false,
    },
  },
} as const;

const MAX_DEPTH = 32;
const MAX_NODES = 2048;
const MAX_BYTES = 64 * 1024;
let validator: import("ajv").ValidateFunction | undefined;

/** A string names the local limit that prevented validation. */
export function validUcpConstraints(value: unknown): boolean | string {
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  let bytes = 0;
  while (pending.length > 0) {
    const entry = pending.pop()!;
    if (++nodes > MAX_NODES) return "exceeds 2048 JSON values";
    if (entry.depth > MAX_DEPTH) return "exceeds 32 levels";
    if (typeof entry.value === "string") {
      bytes += Buffer.byteLength(entry.value);
      if (bytes > MAX_BYTES) return "exceeds 64 KiB of strings and keys";
    }
    if (entry.value !== null && typeof entry.value === "object") {
      const object = entry.value as Record<string, unknown>;
      // Iterate without allocating all values of a wide untrusted object.
      for (const key in object) {
        if (!Object.hasOwn(object, key)) continue;
        if (nodes + pending.length >= MAX_NODES) {
          return "exceeds 2048 JSON values";
        }
        // Array indices are not JSON object member names.
        if (!Array.isArray(object)) bytes += Buffer.byteLength(key);
        if (bytes > MAX_BYTES) return "exceeds 64 KiB of strings and keys";
        pending.push({ value: object[key], depth: entry.depth + 1 });
      }
    }
  }
  validator ??= new Ajv2020({ strict: false }).compile(CONSTRAINT_SCHEMA);
  return validator(value);
}
