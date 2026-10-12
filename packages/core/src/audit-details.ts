/** Opt-in authoring types; published result interfaces keep their existing shape. */
export type AuditDetailValue = string | number | boolean | string[];
export type AuditDetails = Record<string, AuditDetailValue> & {
  expected?: string;
  found?: string;
  code?: string;
};
