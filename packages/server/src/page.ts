/**
 * The page served at `/`. Plain HTML and one inline script, no build step.
 * It renders the snapshot each frame carries, so it holds no reducer.
 */
export const PAGE_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Lighthouse</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7fb; --fg: #1d2433; --muted: #5b6475; --line: #d9dee8; }
  @media (prefers-color-scheme: dark) { :root { --bg: #11141a; --fg: #e6e9ef; --muted: #9aa3b2; --line: #2a303b; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 720px; margin: auto; padding: 32px 16px; }
  form { display: flex; gap: 8px; flex-wrap: wrap; }
  input { flex: 1 1 240px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; }
  button { padding: 8px 16px; border-radius: 6px; border: 0; background: #4f46e5; color: #fff; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--line); }
  .muted { color: var(--muted); }
</style>
<main>
  <h1>Agent Lighthouse</h1>
  <form id="f">
    <input id="url" type="url" required placeholder="https://example.com">
    <input id="token" type="password" placeholder="Token (if the server needs one)">
    <button>Scan</button>
  </form>
  <p id="status" class="muted">Enter a URL to start a scan.</p>
  <p id="conn" class="muted"></p>
  <table id="phases" hidden>
    <thead><tr><th>Phase</th><th>Done</th><th>Errors</th><th>Skipped</th><th>Total</th></tr></thead>
    <tbody></tbody>
  </table>
  <p id="result"></p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const LABEL = { queued: "Waiting to start.", running: "Running.", succeeded: "Finished.", failed: "Failed.", cancelled: "Cancelled." };
// One watched task at a time. A new submission stops the old stream or poll
// loop, and render drops any frame for another task that is still in flight.
let current = null;
let last = null;
let stopWatch = () => {};
let submission = 0;

function render(s) {
  if (s.taskId !== current) return;
  if (last && s.cursor < last.cursor) return;
  last = s;
  $("status").textContent = LABEL[s.status] + (s.lastWorkId ? " Last checked: " + s.lastWorkId : "");
  const rows = Object.entries(s.phases).map(([id, c]) =>
    "<tr><td>" + id + (c.finished ? "" : " …") + "</td><td>" + c.completed + "</td><td>" + c.error +
    "</td><td>" + c.skipped + "</td><td>" + c.total + "</td></tr>");
  $("phases").hidden = rows.length === 0;
  $("phases").tBodies[0].innerHTML = rows.join("");
  if (s.status === "succeeded")
    $("result").innerHTML = "Score: " + (s.score ?? "not assessed") + ' · <a href="tasks/' + s.taskId + '/result">JSON report</a>';
  if (s.status === "failed") $("result").textContent = "Reason: " + s.reasonCode;
}

function terminal(s) { return s.status === "succeeded" || s.status === "failed" || s.status === "cancelled"; }

function watch(taskId) {
  if (!("EventSource" in window)) {
    let active = true;
    stopWatch = () => { active = false; };
    return poll(taskId, () => active);
  }
  const es = new EventSource("tasks/" + taskId + "/stream");
  stopWatch = () => es.close();
  es.addEventListener("snapshot", (e) => { $("conn").textContent = ""; render(JSON.parse(e.data)); });
  es.addEventListener("progress", (e) => {
    const { snapshot } = JSON.parse(e.data);
    render(snapshot);
    if (terminal(snapshot)) es.close();
  });
  es.onerror = () => {
    if (last && terminal(last)) return es.close();
    $("conn").textContent = "Updates disconnected. Last update " + (last ? new Date(last.updatedAt).toLocaleTimeString() : "never") + ". Reconnecting.";
  };
}

async function poll(taskId, active) {
  while (active()) {
    try {
      const r = await fetch("tasks/" + taskId + "/updates?after=" + (last ? last.cursor : 0));
      const body = await r.json();
      if (!active()) return;
      render(body.snapshot);
      $("conn").textContent = "";
      if (terminal(body.snapshot)) return;
    } catch { $("conn").textContent = "Updates disconnected. Retrying."; }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  stopWatch();
  stopWatch = () => {};
  current = null;
  last = null;
  const mine = ++submission;
  $("result").textContent = "";
  $("conn").textContent = "";
  $("phases").hidden = true;
  const headers = { "content-type": "application/json" };
  if ($("token").value) headers.authorization = "Bearer " + $("token").value;
  const r = await fetch("tasks", { method: "POST", headers, body: JSON.stringify({ url: $("url").value }) });
  const body = await r.json();
  // A later submission won while this request was in flight.
  if (mine !== submission) return;
  if (!r.ok) { $("status").textContent = "Could not start: " + body.error; return; }
  current = body.taskId;
  render(body.snapshot);
  watch(body.taskId);
});
</script>
</html>`;
