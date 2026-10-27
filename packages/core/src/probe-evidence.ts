/**
 * What a probe result proves about the site.
 *
 * A fetch that got an HTTP status is evidence: the site answered, and a 404
 * or a 200 without the expected content is a fact about it. A fetch without
 * one is not. The scheduler may have held it back after the site paused the
 * scan, the connection may have timed out or failed, or the URL safety gate
 * may have refused it. None of these says what the URL serves, so an audit
 * reports the probe as unassessed and names the cause instead of reading
 * status 0 as a missing page.
 */
import type { FetchResult } from "./fetcher";
import { HOST_STOPPED_MESSAGE } from "./request-scheduler";
import { RedirectFailure } from "./types";

/** True when the site answered the probe with an HTTP status. */
export function hasHttpResponse(
  result: FetchResult | undefined,
): result is FetchResult {
  return result !== undefined && result.status >= 100 && result.status <= 599;
}

/**
 * Why a probe has no HTTP response, as a predicate phrase for a report:
 * "<url> was not sent: …". Only meaningful when {@link hasHttpResponse} is
 * false.
 */
export function missingResponseCause(result: FetchResult | undefined): string {
  if (!result) return "was not fetched (refused by the URL safety gate)";
  return causeOfError(result.error);
}

/** {@link missingResponseCause} for a caller that kept only the error text. */
export function causeOfError(raw: string | undefined): string {
  const error = raw?.split(/\r?\n/)[0]?.trim() ?? "";
  if (error.startsWith(HOST_STOPPED_MESSAGE))
    return "was not sent: the scan paused this site after HTTP 403, 429 or repeated 503";
  if (error === RedirectFailure.Loop) return "is caught in a redirect loop";
  if (error === RedirectFailure.Refused)
    return "redirects out of public address space, so the scanner did not follow it";
  if (/timeout|timed out/i.test(error))
    return "timed out before any HTTP response";
  if (error) return `failed before any HTTP response (${error})`;
  return "got no HTTP response";
}
