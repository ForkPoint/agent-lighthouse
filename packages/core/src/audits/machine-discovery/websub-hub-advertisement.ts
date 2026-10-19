import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { isSafeUrl } from "#core/url-utils";
import { sharedFeeds, probeHubHead } from "#core/gatherers/feeds";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Feeds inspected. The same cap the other Wave C feed audits use. */
const MAX_FEEDS = 2;

/** Hub statuses that prove something is listening. A hub may refuse a bare HEAD. */
const HUB_ALIVE = new Set([400, 405]);

export class WebsubHubAdvertisementAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/websub-hub-advertisement",
    category: "machine-discovery",
    title:
      "Feeds that advertise a WebSub hub carry exactly one absolute self link",
    failureTitle: "This site’s WebSub advertisement is incomplete",
    description:
      "Reads the WebSub discovery links on each feed — the `Link:` response headers first, as the specification requires, then the document — and, on each feed that advertises a hub, checks the shape the W3C Recommendation asks for: exactly one absolute `rel=self`, and every `rel=hub` over HTTPS and answering a HEAD. The self URL may differ from the URL the feed was fetched from; the Recommendation allows it. A feed with no hub is not judged. Advisory only: no AI answer engine is documented as a WebSub subscriber, so this audit never affects the score.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    tier: AuditTier.Informative,
    evidenceGrade: EvidenceGrade.C,
    weight: 0,
    defaultPriority: CheckPriority.Low,
    dossier:
      "docs/evidence/audits/machine-discovery/websub-hub-advertisement.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    guidance: {
      impact:
        "A hub subscription is verified against the feed’s own `rel=self`. When that link is missing, duplicated or relative, verification cannot complete, and the push path degrades to whatever polling cadence subscribers happen to use. The publisher sees a hub that looks configured and no error anywhere. The benefit side is unproven: WebSub is a W3C Recommendation, but no AI answer engine is documented as a subscriber, which is why this audit reports and does not score.",
      fix: "Advertise the hub and the canonical topic URL in the feed’s `Link:` response headers, which is where a subscriber looks first. Emit exactly one `rel=self` with the absolute canonical topic URL, and at least one `rel=hub` over HTTPS. If you run no hub, a hosted one (Google’s pubsubhubbub, Superfeedr, websub.rocks) needs only the two link relations.",
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/websub-hub-advertisement/",
      tags: ["websub", "feeds", "push", "advisory"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const feeds = await sharedFeeds(ctx, { max: MAX_FEEDS });
    if (feeds.length === 0) {
      return this.notApplicable(
        "This site publishes no feed, so there is no topic for a hub to push.",
        "A feed carrying WebSub discovery links",
        "No feed found at an advertised or conventional URL",
      );
    }

    // Absent artifact, absent verdict. WebSub is optional: Google documents
    // that a publisher "can use WebSub" to announce changes. Only a feed that
    // advertises a hub has a push path whose shape can be judged; the self
    // link matters only for hub verification, so a hubless feed is skipped.
    const hubbed = feeds.filter((feed) => feed.hubLinksRaw.length > 0);
    if (hubbed.length === 0) {
      return this.notApplicable(
        `${feeds.length} feed(s) found, but no WebSub hub is advertised, so there is no push path to judge.`,
        "A feed advertising a rel=hub",
        `${feeds.length} feed(s), no rel=hub`,
      );
    }

    const observations: string[] = [];
    const hubProbes: string[] = [];
    let feedsWithHub = 0;
    let feedsWithValidSelf = 0;

    for (const feed of hubbed) {
      const where = feed.url;
      const source = feed.linksFromHeader ? "Link headers" : "the document";

      if (feed.selfLinksRaw.length === 0) {
        observations.push(
          `${where}: no rel=self, so a hub cannot verify the topic URL`,
        );
      } else if (feed.selfLinksRaw.length > 1) {
        observations.push(
          `${where}: ${feed.selfLinksRaw.length} rel=self links in ${source}; WebSub allows exactly one`,
        );
      } else {
        const raw = feed.selfLinksRaw[0]!;
        const absolute = /^https?:\/\//i.test(raw);
        if (!absolute) {
          observations.push(
            `${where}: rel=self "${raw}" is relative; WebSub requires an absolute URL`,
          );
        } else {
          feedsWithValidSelf += 1;
        }
      }

      feedsWithHub += 1;

      for (const raw of feed.hubLinksRaw.slice(0, 2)) {
        if (!/^https:\/\//i.test(raw)) {
          observations.push(
            `${where}: hub "${raw}" is not an absolute HTTPS URL`,
          );
          continue;
        }
        // A HEAD, and nothing more: the audit never subscribes, and a hub is
        // the one address outside the scanned origin it is allowed to touch.
        if (!(await isSafeUrl(raw))) {
          observations.push(
            `${where}: hub ${raw} did not pass the address check, so it was not probed`,
          );
          continue;
        }
        const result = await probeHubHead(ctx, raw);
        if (!result) {
          observations.push(`${where}: hub ${raw} answered with no response`);
          continue;
        }
        const alive =
          (result.status >= 200 && result.status < 300) ||
          HUB_ALIVE.has(result.status);
        hubProbes.push(`${raw} -> HTTP ${result.status}`);
        if (!alive) {
          observations.push(
            `${where}: hub ${raw} answered HTTP ${result.status}${result.error === undefined ? "" : ` (${result.error})`}, so the push path is advertised but not reachable`,
          );
        }
      }
    }

    const details = {
      feeds: feeds.map((feed) => feed.url),
      feedsWithHub,
      feedsWithValidSelf,
      linksFromHeader: feeds.some((feed) => feed.linksFromHeader),
      hubProbes: hubProbes.slice(0, 10),
      observations: observations.slice(0, 20),
    };
    const expected =
      "On each feed with a rel=hub: exactly one absolute rel=self, and reachable HTTPS hubs";
    const found = `${feeds.length} feed(s); ${feedsWithHub} advertise a hub, ${feedsWithValidSelf} carry a valid rel=self. ${observations.length} observation(s).`;
    const displayValue = `${feedsWithHub}/${feeds.length} feeds advertise a hub`;

    // Never a failure. The conformance assertion is exact, but no AI consumer
    // is documented as a WebSub subscriber, so this reports and does not score.
    if (observations.length > 0) {
      return {
        ...this.warn(
          observations[0]!,
          expected,
          found,
          "Advertise exactly one absolute rel=self and HTTPS rel=hub links, in the Link response headers.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${feedsWithHub} feed(s) advertise a reachable hub and one absolute self link.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
