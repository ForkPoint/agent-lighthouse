---
audit: agent-interfaces/a2a-agent-card
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/a2a-agent-card.ts
slug: a2a-agent-card
evidence_grade: A
disposition: "new 2026-10-18 — consumer-evidence review, IANA well-known gap"
reviewed: 2026-10-18
public_extra:
  - Limits
recommended_tier: scored
consumers:
  - A2A Python SDK (reference client)
  - Microsoft Copilot Studio
sources:
  - a2a-spec
  - a2a-agent-discovery
  - iana-well-known-uris
  - a2a-python-card-resolver
  - copilot-studio-a2a
  - a2a-changelog-030
  - apievangelist-agent-card-census-2026
---

# a2a-agent-card

> agent-interfaces · source `a2a-agent-card.ts` · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Whether the A2A Agent Card at `/.well-known/agent-card.json` can be read by an A2A client.

| State                                                                                                                                                                                                                                                                | Verdict       |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ |
| No card at `agent-card.json`, and nothing A2A-shaped at `agent.json`                                                                                                                                                                                                 | notApplicable |
| 404, or an HTML page answering for the path                                                                                                                                                                                                                          | notApplicable |
| Body is not a JSON object                                                                                                                                                                                                                                            | fail          |
| A known field has the wrong type (`capabilities` not an object; `skills`, `supportedInterfaces`, `defaultInputModes` or `defaultOutputModes` not an array; `name`, `description` or `version` not a string; a `skills` or `supportedInterfaces` entry not an object) | fail          |
| A Required field is missing                                                                                                                                                                                                                                          | warn          |
| The card uses the 0.3 shape: a top-level `url` and no `supportedInterfaces`                                                                                                                                                                                          | warn          |
| An interface URL is not an absolute `https://` or `wss://` URL                                                                                                                                                                                                       | warn          |
| The card sits only at the pre-0.3 path `/.well-known/agent.json`                                                                                                                                                                                                     | warn          |
| Every Required field present and well-typed                                                                                                                                                                                                                          | pass          |

The audit reads the card only. It never calls the agent's endpoint.

## Claimed mechanism (falsifiable)

An A2A client given a domain sends a GET to `/.well-known/agent-card.json`. If the body does not parse as an Agent Card, the client has no card and cannot learn the agent's skills or endpoint. Copilot Studio reads `name` and `description` from the card when a person adds the agent.

## Evidence

- A2A 1.0 §8.2 names `https://{server_domain}/.well-known/agent-card.json` as the discovery path. §4.4.1 marks `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes` and `skills` as Required — https://a2a-protocol.org/latest/specification/ (verified 2026-10-18)
- The discovery topic page: the client "performs an HTTP GET request" to that path — https://a2a-protocol.org/latest/topics/agent-discovery/ (verified 2026-10-18)
- IANA registers `agent-card.json` as permanent, change controller Linux Foundation, 2025-08-01 — https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml (verified 2026-10-18)
- The reference SDK sets `AGENT_CARD_WELL_KNOWN_PATH = '/.well-known/agent-card.json'`. Its resolver has no fallback to `agent.json`, ignores unknown fields, and raises `AgentCardResolutionError` on invalid JSON or a wrongly typed field — https://raw.githubusercontent.com/a2aproject/a2a-python/main/src/a2a/utils/constants.py (verified 2026-10-18)
- Copilot Studio: "if your agent has a valid agent card on the standard .well-known URL, Copilot Studio automatically pulls the name and description for your agent from the card" — https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-agent-to-agent (verified 2026-10-18)
- A2A 0.3.0 (2025-07-30) changed the well-known URI from `agent.json` to `agent-card.json` as a breaking change — https://github.com/a2aproject/A2A/blob/main/CHANGELOG.md (verified 2026-10-18)
- Adoption is small. Of 20,185 hosts that answered a probe, 65 serve a card; 41 of those fail a hard structural rule and 15 sit only on the legacy path — https://raw.githubusercontent.com/api-evangelist/posts/main/_posts/2026-07-29-most-published-agent-cards-are-not-actually-a2a.md (verified 2026-10-18)

**Counter-evidence:** Both documented consumers are user-configured. A person types the agent's endpoint; no AI vendor documents crawling the open web for agent cards. Copilot Studio's own troubleshooting note still points at `/.well-known/agent.json`.

## Scoring

**Grade: A** — documented consumer behaviour on a permanently registered path. The reference SDK implements the read, and Microsoft documents reading the card. The audit scores only sites that publish a card, so a site with no A2A agent loses nothing.

- A card a client cannot load fails at high priority.
- A card that loads but is incomplete, uses the 0.3 shape, names an insecure interface or sits at the old path warns.

## Example failure

```json
{
  "name": "Booking Agent",
  "capabilities": ["streaming"],
  "skills": { "id": "book" }
}
```

`capabilities` is an array and `skills` is an object. The reference SDK rejects the card.

## Limits

- Only root-level cards are found. Frameworks often mount cards under a sub-path, such as `/a2a/<agent>/.well-known/agent-card.json`.
- A card linked from an `ard.json` or `ai-catalog.json` entry is not followed.
- Signatures are optional in A2A 1.0, so they are not judged. `details.signed` reports whether the card carries any.
- An authenticated extended card (`capabilities.extendedAgentCard`) is not fetched.

## Implementation deviations

- The legacy path counts as a card only when its JSON object carries an A2A-only key (`skills`, `capabilities`, `protocolVersion`, `supportedInterfaces`, `defaultInputModes`, `defaultOutputModes` or `preferredTransport`). A JSON file there from another convention reads as absent.
- An empty 200 body reads as absent, matching the other root-file readers.
- The reader lives in `_a2a-card.ts` beside the audit and exports `NO_AGENT_CARD`, which enrols the audit in `absent-artifact-contract.test.ts`.
