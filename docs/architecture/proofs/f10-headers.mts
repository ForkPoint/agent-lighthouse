/** Finding proof: a lowercase caller header survives beside the capitalised
 * one the fetcher sets, so both reach undici. */
// The spreads are the point: this mirrors the merge at fetcher.ts:265
// literally, so the proof breaks if that merge changes shape.
const fetcherOptionsHeaders = { "user-agent": "CallerBot/1.0" };
const extraHeaders = {};
const reqHeaders: Record<string, string> = {
  ...fetcherOptionsHeaders,
  ...extraHeaders,
  "User-Agent": "AgentLighthouse/1.0", // fetcher.ts:268
  Accept: "*/*",
};
console.log("merged object keys :", Object.keys(reqHeaders));
const h = new Headers(reqHeaders);
console.log("what undici sends  : user-agent =", h.get("user-agent"));
console.log(
  Object.keys(reqHeaders).length === 3 &&
    "user-agent" in reqHeaders &&
    "User-Agent" in reqHeaders
    ? "CONFIRMED: both keys survive the object merge"
    : "NOT CONFIRMED",
);
