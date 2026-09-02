/**
 * What each corpus domain did the last time a runner saw it.
 *
 * Pure: the runners and `scripts/corpus-status.ts` read and write the file;
 * this module only maps outcomes to states and merges observations, so a
 * test can exercise every rule without a fetch or a file.
 */

export type CorpusState = "ok" | "unscored" | "blocked" | "dead";

export interface CorpusObservation {
  state: CorpusState;
  /** The scan's own `unscoredReason`, or the robots skip reason. */
  reason?: string;
  /** `YYYY-MM-DD` of the latest import that mentioned the domain. */
  seenAt: string;
  /** How many imports have mentioned the domain. */
  runs: number;
}

export interface CorpusStatus {
  updatedAt: string;
  domains: Record<string, CorpusObservation>;
}

/** The fields both runner summaries share in `outcomes[]`. */
export interface RunnerOutcome {
  domain: string;
  skipped?: string;
  score?: number | null;
  evidence?: Partial<Record<string, boolean>>;
  unscoredReason?: string;
  violations?: string[];
}

export const EMPTY_STATUS: CorpusStatus = { updatedAt: "", domains: {} };

/**
 * The state one outcome argues for.
 *
 * `dead` is an origin the scan could not reach while nothing was refusing
 * it: no DNS, no connection, no homepage. A wall or a throttle also leaves
 * the origin unreachable, but that origin exists and is saying no, so it
 * stays `unscored`.
 */
export function stateOf(outcome: RunnerOutcome): {
  state: CorpusState;
  reason?: string;
} {
  if (outcome.skipped) return { state: "blocked", reason: outcome.skipped };
  if (typeof outcome.score === "number") return { state: "ok" };
  const reachable = outcome.evidence?.["origin-reachable"];
  const unblocked = outcome.evidence?.["unblocked-fetches"];
  const reason = outcome.unscoredReason;
  if (reachable === false && unblocked !== false)
    return { state: "dead", reason };
  return { state: "unscored", reason };
}

/**
 * Merge one import into the status.
 *
 * State is the latest observation, with one exception: `dead` is entered
 * only when the previous observation was already arguing for it on an
 * earlier day. One failed night is not death. Until then the domain reads
 * `unscored` with the reason kept.
 */
export function mergeStatus(
  previous: CorpusStatus | undefined,
  outcomes: readonly RunnerOutcome[],
  date: string,
): CorpusStatus {
  const domains: Record<string, CorpusObservation> = {
    ...previous?.domains,
  };
  for (const outcome of outcomes) {
    const prior = domains[outcome.domain];
    const next = stateOf(outcome);
    let state = next.state;
    if (state === "dead") {
      const priorArguedDead =
        prior !== undefined &&
        (prior.state === "dead" ||
          (prior.state === "unscored" && prior.reason === next.reason));
      const earlierDay = prior !== undefined && prior.seenAt < date;
      if (!(priorArguedDead && earlierDay) && prior?.state !== "dead") {
        state = "unscored";
      }
    }
    const observation: CorpusObservation = {
      state,
      seenAt: date,
      runs: (prior?.runs ?? 0) + 1,
    };
    if (next.reason) observation.reason = next.reason;
    domains[outcome.domain] = observation;
  }
  const sorted = Object.fromEntries(
    Object.entries(domains).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { updatedAt: `${date}T00:00:00.000Z`, domains: sorted };
}

/** The domains a runner leaves out unless asked to include them. */
export function excludedDomains(
  status: CorpusStatus | undefined,
  include: { dead?: boolean; blocked?: boolean },
): Set<string> {
  const out = new Set<string>();
  if (!status) return out;
  for (const [domain, observation] of Object.entries(status.domains)) {
    if (observation.state === "dead" && !include.dead) out.add(domain);
    if (observation.state === "blocked" && !include.blocked) out.add(domain);
  }
  return out;
}

const STATE_ORDER: readonly CorpusState[] = [
  "dead",
  "blocked",
  "unscored",
  "ok",
];

/** The text a person reads before editing `seeds.json`. */
export function formatReport(status: CorpusStatus): string {
  const lines: string[] = [`corpus status as of ${status.updatedAt}`, ""];
  for (const state of STATE_ORDER) {
    const inState = Object.entries(status.domains).filter(
      ([, o]) => o.state === state,
    );
    if (inState.length === 0) continue;
    lines.push(`${state} (${inState.length})`);
    const byReason = new Map<string, Array<[string, CorpusObservation]>>();
    for (const entry of inState) {
      const key = entry[1].reason ?? "";
      const list = byReason.get(key) ?? [];
      list.push(entry);
      byReason.set(key, list);
    }
    for (const [reason, entries] of [...byReason.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      if (reason) lines.push(`  ${reason} (${entries.length})`);
      for (const [domain, o] of entries) {
        lines.push(`    ${domain}  ${o.seenAt}  runs ${o.runs}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
