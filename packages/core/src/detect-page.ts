import {
  ClassificationConfidence,
  DOM_WORK_LIMITS,
  PayloadOrigin,
  type PageIdentity,
  type PagePayload,
} from "./contracts";
import { gatewayTarget } from "./gateway";
import { parsePageContext } from "./page-context";

/**
 * The page type of one payload, apart from a scan.
 *
 * It runs the parse and classifier a scan runs, under the same DOM work
 * limits: a served page gets the HTTP budget, a client capture the snapshot
 * budget. It fetches nothing and runs no audit. A gateway page reports its
 * target; following it is the scan's job.
 *
 * A partial payload (truncated, redacted or still loading) cannot prove what
 * the full page holds, so its confidence is capped below `strong`.
 *
 * Throws `DomWorkLimitError` when the page exceeds the DOM work limits.
 */
export function detectPage(
  payload: PagePayload,
  opts: { partial?: boolean } = {},
): PageIdentity {
  const page = parsePageContext(
    payload.url,
    payload.html,
    undefined,
    payload.origin === PayloadOrigin.Supplied
      ? DOM_WORK_LIMITS.snapshotAncestorSteps
      : DOM_WORK_LIMITS.httpAncestorSteps,
  );
  const partial = opts.partial ?? false;
  const { type, confidence, signals } = page.classification;
  const target = gatewayTarget(page, payload.url);
  return {
    url: payload.url,
    type,
    confidence:
      partial && confidence === ClassificationConfidence.Strong
        ? ClassificationConfidence.Hint
        : confidence,
    signals,
    payloadSha256: payload.sha256,
    origin: payload.origin,
    partial,
    ...(target !== undefined && { gatewayTarget: target }),
  };
}
