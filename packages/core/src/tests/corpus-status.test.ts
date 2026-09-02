import { describe, it, expect } from "vitest";
import {
  EMPTY_STATUS,
  excludedDomains,
  formatReport,
  mergeStatus,
  stateOf,
  type CorpusStatus,
  type RunnerOutcome,
} from "./corpus-status";

const scored: RunnerOutcome = {
  domain: "ok.test",
  score: 61,
  evidence: {
    "origin-reachable": true,
    "unblocked-fetches": true,
    "rendered-body": true,
    "sample-adequate": true,
  },
};

const noHomepage: RunnerOutcome = {
  domain: "dead.test",
  score: null,
  evidence: {
    "origin-reachable": false,
    "unblocked-fetches": true,
    "rendered-body": false,
    "sample-adequate": false,
  },
  unscoredReason:
    "The homepage could not be fetched: getaddrinfo ENOTFOUND dead.test.",
};

const walled: RunnerOutcome = {
  domain: "wall.test",
  score: null,
  evidence: {
    "origin-reachable": false,
    "unblocked-fetches": false,
    "rendered-body": false,
    "sample-adequate": false,
  },
  unscoredReason: "Cloudflare Turnstile refused the scan: challenge page.",
};

const robots: RunnerOutcome = {
  domain: "robots.test",
  skipped: "robots-disallow",
};

describe("stateOf", () => {
  it("maps a score to ok", () => {
    expect(stateOf(scored)).toEqual({ state: "ok" });
  });

  it("maps an unreachable origin that was not walled to dead, keeping the reason", () => {
    expect(stateOf(noHomepage)).toEqual({
      state: "dead",
      reason: noHomepage.unscoredReason,
    });
  });

  it("maps a walled or throttled origin to unscored, not dead", () => {
    expect(stateOf(walled)).toEqual({
      state: "unscored",
      reason: walled.unscoredReason,
    });
  });

  it("maps a robots skip to blocked with the skip reason", () => {
    expect(stateOf(robots)).toEqual({
      state: "blocked",
      reason: "robots-disallow",
    });
  });

  it("maps a null score with a reachable origin to unscored", () => {
    const gated: RunnerOutcome = {
      ...scored,
      domain: "gated.test",
      score: null,
      unscoredReason:
        "The scan could not feed 57% of the registry's evidence mass.",
    };
    expect(stateOf(gated)).toEqual({
      state: "unscored",
      reason: gated.unscoredReason,
    });
  });
});

describe("mergeStatus", () => {
  it("records a first observation and stamps the date", () => {
    const status = mergeStatus(undefined, [scored], "2026-09-02");
    expect(status.domains["ok.test"]).toEqual({
      state: "ok",
      seenAt: "2026-09-02",
      runs: 1,
    });
    expect(status.updatedAt.startsWith("2026-09-02")).toBe(true);
  });

  it("holds a dead verdict at unscored until a second import on another day", () => {
    const first = mergeStatus(undefined, [noHomepage], "2026-09-02");
    expect(first.domains["dead.test"]?.state).toBe("unscored");
    const sameDay = mergeStatus(first, [noHomepage], "2026-09-02");
    expect(sameDay.domains["dead.test"]?.state).toBe("unscored");
    const nextDay = mergeStatus(sameDay, [noHomepage], "2026-09-03");
    expect(nextDay.domains["dead.test"]?.state).toBe("dead");
    expect(nextDay.domains["dead.test"]?.runs).toBe(3);
  });

  it("returns a dead domain to ok when it scores again", () => {
    const dead: CorpusStatus = {
      updatedAt: "2026-09-01T00:00:00.000Z",
      domains: {
        "dead.test": { state: "dead", seenAt: "2026-09-01", runs: 2 },
      },
    };
    const revived = mergeStatus(
      dead,
      [{ ...scored, domain: "dead.test" }],
      "2026-09-05",
    );
    expect(revived.domains["dead.test"]).toEqual({
      state: "ok",
      seenAt: "2026-09-05",
      runs: 3,
    });
  });

  it("keeps domains the import did not mention", () => {
    const first = mergeStatus(undefined, [scored], "2026-09-02");
    const second = mergeStatus(first, [robots], "2026-09-03");
    expect(Object.keys(second.domains).sort()).toEqual([
      "ok.test",
      "robots.test",
    ]);
  });

  it("sorts domains so the committed file diffs cleanly", () => {
    const status = mergeStatus(undefined, [robots, scored], "2026-09-02");
    expect(Object.keys(status.domains)).toEqual(["ok.test", "robots.test"]);
  });
});

describe("excludedDomains", () => {
  const status = mergeStatus(
    undefined,
    [scored, robots, { ...noHomepage }],
    "2026-09-02",
  );
  const withDead: CorpusStatus = {
    ...status,
    domains: {
      ...status.domains,
      "dead.test": { state: "dead", seenAt: "2026-09-03", runs: 2 },
    },
  };

  it("excludes dead and blocked by default", () => {
    expect([...excludedDomains(withDead, {})].sort()).toEqual([
      "dead.test",
      "robots.test",
    ]);
  });

  it("lets each class back in on request", () => {
    expect([...excludedDomains(withDead, { dead: true })]).toEqual([
      "robots.test",
    ]);
    expect([...excludedDomains(withDead, { blocked: true })]).toEqual([
      "dead.test",
    ]);
    expect(excludedDomains(withDead, { dead: true, blocked: true }).size).toBe(
      0,
    );
  });

  it("excludes nothing without a status file", () => {
    expect(excludedDomains(undefined, {}).size).toBe(0);
    expect(excludedDomains(EMPTY_STATUS, {}).size).toBe(0);
  });
});

describe("formatReport", () => {
  it("groups by state, then by reason, and shows date and run count", () => {
    const status: CorpusStatus = {
      updatedAt: "2026-09-03T00:00:00.000Z",
      domains: {
        "a.test": {
          state: "dead",
          reason: "The homepage could not be fetched: ENOTFOUND.",
          seenAt: "2026-09-03",
          runs: 2,
        },
        "b.test": {
          state: "dead",
          reason: "The homepage could not be fetched: ENOTFOUND.",
          seenAt: "2026-09-03",
          runs: 2,
        },
        "c.test": {
          state: "blocked",
          reason: "robots-disallow",
          seenAt: "2026-09-02",
          runs: 1,
        },
        "d.test": { state: "ok", seenAt: "2026-09-03", runs: 3 },
      },
    };
    const text = formatReport(status);
    expect(text).toContain("dead (2)");
    expect(text).toContain("The homepage could not be fetched: ENOTFOUND. (2)");
    expect(text).toContain("a.test  2026-09-03  runs 2");
    expect(text).toContain("blocked (1)");
    expect(text).toContain("ok (1)");
    expect(text.indexOf("dead (2)")).toBeLessThan(text.indexOf("ok (1)"));
  });
});
