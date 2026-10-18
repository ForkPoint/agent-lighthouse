import type { AuditMeta } from "#core/types";
import { ObsoleteRobotsGroupAudit } from "./_obsolete-robots-group-audit";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

export class ChatgptUserAudit extends ObsoleteRobotsGroupAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/chatgpt-user",
    category: "access-crawl-control",
    // An obsolete audit speaks only when the owner wrote the group, so both
    // titles describe the group.
    title: "ChatGPT-User robots.txt group (may not apply)",
    failureTitle:
      "A ChatGPT-User robots.txt group that OpenAI says may not apply",
    description:
      "Reports a `User-agent: ChatGPT-User` group in robots.txt. OpenAI documents that ChatGPT-User fetches pages on a user's request, that robots.txt rules may not apply to those fetches, and that OAI-SearchBot is the token for managing search opt-outs.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "OpenAI says robots.txt rules may not apply to ChatGPT-User, because its fetches are initiated by a user. OAI-SearchBot is the token OpenAI documents for search opt-outs.",
      link: "https://developers.openai.com/api/docs/bots",
      replacement:
        "Use a User-agent: OAI-SearchBot group to manage ChatGPT search, and control user-initiated fetches at the server or CDN if needed.",
    },
    dossier: "docs/evidence/audits/access-crawl-control/chatgpt-user.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "The group may have no effect. OpenAI documents that robots.txt rules may not apply to user-initiated ChatGPT-User fetches, so it is not a reliable control.",
      fix: "Nothing is required; the group can stay. To manage ChatGPT search, write a User-agent: OAI-SearchBot group. To limit user-initiated fetches, act at the server or CDN.",
      effort: FixEffort.Trivial,
      docsUrl: "https://developers.openai.com/api/docs/bots",
      tags: ["robots-txt", "openai", "obsolete"],
    },
  };

  protected readonly token = "ChatGPT-User";
  protected readonly reason =
    'OpenAI says that because ChatGPT-User fetches are "initiated by a user, robots.txt rules may not apply", and asks sites to "use OAI-SearchBot in robots.txt for managing Search opt outs". This group may not be honoured.';
}
