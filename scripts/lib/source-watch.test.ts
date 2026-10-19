import { describe, expect, it } from "vitest";
import {
  botRegistryWatchItems,
  ChangeKind,
  diffIana,
  diffSnapshot,
  formatReport,
  githubRepoOf,
  groupBy,
  hashBody,
  ietfDraftOf,
  keepLastGood,
  mapSourcesToAudits,
  needsReview,
  normalizeHtml,
  parseCsv,
  parseIanaRegistry,
  type SourceSnapshot,
} from "./source-watch";

const ok = (
  hash: string,
  finalUrl = "https://a.example/x",
): SourceSnapshot => ({
  url: { status: 200, finalUrl, error: null, hash },
});

describe("normalizeHtml", () => {
  it("keeps visible text and drops markup, scripts and comments", () => {
    expect(
      normalizeHtml(
        '<html><head><style>p{}</style><script>var t="abc"</script></head><body><!-- x --><p class="a">Hello&nbsp;<b>world</b> &amp; &#39;you&#x27;</p></body></html>',
      ),
    ).toBe("Hello world & 'you'");
  });

  it("gives the same hash when only markup changes", () => {
    const enc = new TextEncoder();
    const a = hashBody(
      enc.encode('<p class="v1">Same text</p><script>1</script>'),
      "text/html",
    );
    const b = hashBody(
      enc.encode('<div id="new">Same   text</div><script>2</script>'),
      "text/html; charset=utf-8",
    );
    expect(a).toBe(b);
    expect(hashBody(enc.encode("<p>Other text</p>"), "text/html")).not.toBe(a);
  });
});

describe("URL classification", () => {
  it("finds GitHub repos on github.com and raw URLs", () => {
    expect(githubRepoOf("https://github.com/a2aproject/A2A")).toBe(
      "a2aproject/A2A",
    );
    expect(githubRepoOf("https://github.com/o/r/blob/main/spec.md")).toBe(
      "o/r",
    );
    expect(
      githubRepoOf("https://raw.githubusercontent.com/o/r/main/x.md"),
    ).toBe("o/r");
    expect(githubRepoOf("https://github.com/orgs/x/discussions")).toBeNull();
    expect(githubRepoOf("https://example.com/o/r")).toBeNull();
  });

  it("finds Internet-Draft names without the revision", () => {
    expect(
      ietfDraftOf("https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/"),
    ).toBe("draft-ietf-aipref-vocab");
    expect(
      ietfDraftOf("https://www.ietf.org/archive/id/draft-foo-bar-07.html"),
    ).toBe("draft-foo-bar");
    expect(
      ietfDraftOf("https://datatracker.ietf.org/wg/aipref/about"),
    ).toBeNull();
    expect(ietfDraftOf("https://www.rfc-editor.org/rfc/rfc9309")).toBeNull();
  });
});

describe("diffSnapshot", () => {
  it("reports nothing for an unchanged source", () => {
    expect(diffSnapshot(ok("h"), ok("h"))).toEqual([]);
  });

  it("reports a break, a recovery, a move and a text change", () => {
    const broken: SourceSnapshot = {
      url: {
        status: 404,
        finalUrl: "https://a.example/x",
        error: null,
        hash: null,
      },
    };
    const tls: SourceSnapshot = {
      url: {
        status: null,
        finalUrl: null,
        error: "CERT_HAS_EXPIRED",
        hash: null,
      },
    };
    expect(diffSnapshot(ok("h"), broken)).toEqual([
      { kind: ChangeKind.Broken, detail: "HTTP 404" },
    ]);
    expect(diffSnapshot(ok("h"), tls)[0]?.detail).toBe("CERT_HAS_EXPIRED");
    expect(diffSnapshot(broken, ok("h"))[0]?.kind).toBe(ChangeKind.Recovered);
    expect(
      diffSnapshot(ok("h"), ok("h", "https://b.example/y")).map((c) => c.kind),
    ).toEqual([ChangeKind.Moved]);
    expect(diffSnapshot(ok("h", "https://a.example/x/"), ok("h"))).toEqual([]);
    expect(diffSnapshot(ok("h"), ok("i")).map((c) => c.kind)).toEqual([
      ChangeKind.ContentChanged,
    ]);
  });

  it("stays quiet while a source remains broken", () => {
    const broken: SourceSnapshot = {
      url: {
        status: 403,
        finalUrl: "https://a.example/x",
        error: null,
        hash: null,
      },
    };
    expect(diffSnapshot(broken, broken)).toEqual([]);
  });

  it("reports draft revisions and state changes", () => {
    const a = {
      ...ok("h"),
      ietf: { name: "draft-x", rev: "04", state: "Active", expires: null },
    };
    const b = {
      ...ok("h"),
      ietf: { name: "draft-x", rev: "05", state: "Expired", expires: null },
    };
    expect(diffSnapshot(a, b).map((c) => c.kind)).toEqual([
      ChangeKind.DraftRevised,
      ChangeKind.DraftStateChanged,
    ]);
    // A failed datatracker call (rev null) is not a change.
    const failed = {
      ...ok("h"),
      ietf: { name: "draft-x", rev: null, state: null, expires: null },
    };
    expect(diffSnapshot(a, failed)).toEqual([]);
  });

  it("keeps the last good draft state across a failed request", () => {
    const draft = (rev: string | null, state: string | null) => ({
      ...ok("h"),
      ietf: { name: "draft-x", rev, state, expires: null },
    });
    const first = draft("04", "Active");
    // The saved state after a failed datatracker call is still the good one.
    const saved = keepLastGood(first, draft(null, null));
    expect(saved.ietf).toEqual(first.ietf);
    expect(
      diffSnapshot(saved, draft("05", "Expired")).map((c) => c.kind),
    ).toEqual([ChangeKind.DraftRevised, ChangeKind.DraftStateChanged]);
  });

  it("keeps the last good repo state across a failed request", () => {
    const repo = (
      pushedAt: string | null,
      archived: boolean | null,
      latestRelease: string | null,
    ) => ({
      ...ok("h"),
      github: { repo: "o/r", pushedAt, archived, latestRelease },
    });
    const first = repo("2026-01-01", false, "v1");
    const saved = keepLastGood(first, repo(null, null, null));
    expect(saved.github).toEqual(first.github);
    expect(
      diffSnapshot(saved, repo("2026-02-01", true, "v2")).map((c) => c.kind),
    ).toEqual([
      ChangeKind.RepoArchived,
      ChangeKind.RepoReleased,
      ChangeKind.RepoPushed,
    ]);
    // A failed releases call beside a good repo call keeps the old tag, so
    // the next run does not report it as a new release.
    const partial = keepLastGood(first, repo("2026-01-02", false, null));
    expect(partial.github).toEqual({
      repo: "o/r",
      pushedAt: "2026-01-02",
      archived: false,
      latestRelease: "v1",
    });
  });

  it("takes the new snapshot when there is no earlier one", () => {
    const next = {
      ...ok("h"),
      ietf: { name: "draft-x", rev: null, state: null, expires: null },
    };
    expect(keepLastGood(undefined, next)).toBe(next);
  });

  it("reports archive, release and push on a repo", () => {
    const repo = (
      archived: boolean,
      release: string | null,
      pushedAt: string,
    ) => ({
      ...ok("h"),
      github: { repo: "o/r", archived, latestRelease: release, pushedAt },
    });
    const kinds = diffSnapshot(
      repo(false, "v1", "t1"),
      repo(true, "v2", "t2"),
    ).map((c) => c.kind);
    expect(kinds).toEqual([
      ChangeKind.RepoArchived,
      ChangeKind.RepoReleased,
      ChangeKind.RepoPushed,
    ]);
    expect(needsReview({ kind: ChangeKind.RepoPushed, detail: "" })).toBe(
      false,
    );
    expect(needsReview({ kind: ChangeKind.RepoArchived, detail: "" })).toBe(
      true,
    );
  });
});

describe("IANA registry", () => {
  const csv = [
    "URI Suffix,Reference,Status,Change Controller,Related Information,Date Registered,Date Modified",
    "agent-card.json,[A2A],permanent,LF,,2025-08-01,",
    'posh,[RFC7711],permanent,IETF,"The suffix ""posh"" is expected to be followed by\n an additional path",2015-11-01,2016-01-01',
  ].join("\n");

  it("parses quoted multi-line fields", () => {
    expect(parseCsv(csv)).toHaveLength(3);
    expect(parseIanaRegistry(csv)).toEqual({
      "agent-card.json": { status: "permanent", modified: "2025-08-01" },
      posh: { status: "permanent", modified: "2016-01-01" },
    });
  });

  it("diffs additions, status changes, modifications and removals", () => {
    const prev = {
      a: { status: "provisional", modified: "2026-01-01" },
      b: { status: "permanent", modified: "2026-01-01" },
      gone: { status: "permanent", modified: "2020-01-01" },
    };
    const next = {
      a: { status: "permanent", modified: "2026-02-01" },
      b: { status: "permanent", modified: "2026-03-01" },
      new: { status: "provisional", modified: "2026-10-01" },
    };
    expect(diffIana(prev, next)).toEqual([
      { suffix: "a", detail: "status provisional → permanent" },
      { suffix: "b", detail: "modified 2026-03-01" },
      { suffix: "gone", detail: "removed from registry" },
      { suffix: "new", detail: "registered (provisional)" },
    ]);
  });
});

describe("mapSourcesToAudits", () => {
  it("maps each source id to the audits whose dossier cites it", () => {
    const d1 = "---\naudit: cat/one\nsources:\n  - s1\n  - 's2'\n---\n# one\n";
    const d2 = "---\naudit: cat/two\nslug: two\nsources:\n  - s2\n---\n";
    const noAudit = "---\nslug: x\nsources:\n  - s1\n---\n";
    const map = mapSourcesToAudits([d1, d2, noAudit]);
    expect(map.get("s1")).toEqual(["cat/one"]);
    expect(map.get("s2")).toEqual(["cat/one", "cat/two"]);
    expect(map.has("s3")).toBe(false);
  });
});

describe("groupBy", () => {
  it("groups keys by host in first-seen order", () => {
    const host = (u: string) => new URL(u).hostname;
    expect(
      groupBy(["https://a.x/1", "https://b.x/1", "https://a.x/2"], host),
    ).toEqual([["https://a.x/1", "https://a.x/2"], ["https://b.x/1"]]);
  });
});

describe("formatReport", () => {
  const base = {
    checkedAt: "2026-10-18T00:00:00.000Z",
    baseline: false,
    sourceCount: 3,
    watchChanges: [],
    ianaChanges: [],
    ianaWatch: [
      {
        path: { suffix: "gpc.json", why: "not built" },
        row: null,
        changed: false,
      },
    ],
    unreachable: 0,
  };

  it("puts review-worthy changes first and maps them to audits", () => {
    const body = formatReport({
      ...base,
      sourceChanges: [
        {
          id: "s1",
          url: "https://a.example",
          changes: [
            { kind: ChangeKind.Broken, detail: "HTTP 404" },
            { kind: ChangeKind.ContentChanged, detail: "page text changed" },
          ],
          audits: ["cat/one"],
        },
      ],
    });
    const review = body.indexOf("## Needs review");
    const context = body.indexOf("## Changed for context");
    expect(review).toBeGreaterThan(-1);
    expect(context).toBeGreaterThan(review);
    expect(body).toContain(
      "| [s1](https://a.example) | broken: HTTP 404 | `cat/one` |",
    );
    expect(body).toContain("`/.well-known/gpc.json` | not registered");
  });

  it("says so on a baseline run and stays under the issue size limit", () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({
      id: `s${i}`,
      url: `https://example.com/${"p".repeat(40)}/${i}`,
      changes: [
        { kind: ChangeKind.ContentChanged, detail: "page text changed" },
      ],
      audits: ["cat/one"],
    }));
    const body = formatReport({ ...base, baseline: true, sourceChanges: many });
    expect(body).toContain("recorded a baseline");
    expect(body).toContain("List truncated");
    expect(body.length).toBeLessThanOrEqual(60_000);
  });
});

describe("botRegistryWatchItems", () => {
  it("watches each cited page once and skips rows with no page", () => {
    const items = botRegistryWatchItems([
      { token: "GPTBot", operator: "OpenAI", docUrl: "https://a.example/bots" },
      {
        token: "ChatGPT-User",
        operator: "OpenAI",
        docUrl: "https://a.example/bots",
      },
      { token: "Bytespider", operator: "ByteDance", docUrl: null },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "bot-registry:gptbot",
      url: "https://a.example/bots",
      title: "OpenAI crawler page (GPTBot, ChatGPT-User)",
    });
  });
});
