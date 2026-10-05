/**
 * The scan summary lives in core, which writes it into every report; the
 * report package re-exports it so `hydrateReport` and its callers derive the
 * same text instead of keeping a second copy that can drift.
 */
export { generateScanSummary } from "@forkpoint/agent-lighthouse-core";
