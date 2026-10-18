---
audit: agent-interfaces/a2a-agent-card
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/a2a-agent-card.ts
slug: a2a-agent-card
evidence_grade: B
disposition: "new 2026-10-18 — consumer-evidence review, IANA well-known gap"
reviewed: 2026-10-18
public_extra:
  - Limits
recommended_tier: scored
consumers:
  - A2A Python SDK (reference client; reads /.well-known/agent-card.json for a domain a user supplies)
  - Microsoft Copilot Studio (user-configured; reads a card relative to the agent endpoint, its doc points at /.well-known/agent.json)
sources:
  - a2a-spec
  - a2a-proto
  - a2a-agent-discovery
  - iana-well-known-uris
  - a2a-python-card-resolver
  - copilot-studio-a2a
  - a2a-changelog-030
  - apievangelist-agent-card-census-2026
---

# a2a-agent-card

> agent-interfaces · source `a2a-agent-card.ts` · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Whether the A2A Agent Card at `/.well-known/agent-card.json` can be read by an A2A client.

| State                                                                                                                                                                                                                                                                | Verdict                           |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| No card at `agent-card.json`, and nothing A2A-shaped at `agent.json`                                                                                                                                                                                                 | notApplicable                     |
| 404, or an HTML page answering for the path                                                                                                                                                                                                                          | notApplicable                     |
| JSON with none of the Agent Card's keys (for example one document served at every path)                                                                                                                                                                              | notApplicable                     |
| Body is not a JSON object                                                                                                                                                                                                                                            | fail                              |
| A known field has the wrong type (`capabilities` not an object; `skills`, `supportedInterfaces`, `defaultInputModes` or `defaultOutputModes` not an array; `name`, `description` or `version` not a string; a `skills` or `supportedInterfaces` entry not an object) | fail                              |
| A Required field is missing                                                                                                                                                                                                                                          | warn                              |
| A `supportedInterfaces` entry lacks `url`, `protocolBinding` or `protocolVersion`                                                                                                                                                                                    | warn                              |
| An interface URL is not an absolute `https://` or `wss://` URL                                                                                                                                                                                                       | warn                              |
| The card sits only at the pre-1.0 path `/.well-known/agent.json`                                                                                                                                                                                                     | warn                              |
| The card uses the 0.3 shape: a top-level `url` and no `supportedInterfaces`                                                                                                                                                                                          | not judged; `details.legacyShape` |
| Every Required field present and well-typed                                                                                                                                                                                                                          | pass                              |

The audit reads the card only. It never calls the agent's endpoint.

## Claimed mechanism (falsifiable)

The reference A2A client, given a domain, sends a GET to `/.well-known/agent-card.json`. If the body does not parse as an Agent Card, the client has no card and cannot learn the agent's skills or endpoint.

## Evidence

- A2A 1.0 §8.2 names `https://{server_domain}/.well-known/agent-card.json` as the discovery path. §4.4.1 marks `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes` and `skills` as Required — https://a2a-protocol.org/latest/specification/ (verified 2026-10-18)
- `a2a.proto` marks the same eight AgentCard fields REQUIRED, and marks `url`, `protocol_binding` and `protocol_version` REQUIRED on each `AgentInterface` — https://raw.githubusercontent.com/a2aproject/A2A/main/specification/a2a.proto (verified 2026-10-18)
- The discovery topic page: the client "performs an HTTP GET request" to that path — https://a2a-protocol.org/latest/topics/agent-discovery/ (verified 2026-10-18)
- IANA registers `agent-card.json` as permanent, change controller Linux Foundation, 2025-08-01 — https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml (verified 2026-10-18)
- The reference SDK sets `AGENT_CARD_WELL_KNOWN_PATH = '/.well-known/agent-card.json'`. Its resolver has no fallback to `agent.json`, ignores unknown fields, and raises `AgentCardResolutionError` on invalid JSON or a wrongly typed field. Its `parse_agent_card` converts a 0.3-shape card (top-level `url`) into a 1.0 interface, so such a card still loads — https://raw.githubusercontent.com/a2aproject/a2a-python/main/src/a2a/utils/constants.py (verified 2026-10-18)
- Copilot Studio: a person enters the agent's endpoint URL, and "if your agent has a valid agent card on the standard .well-known URL, Copilot Studio automatically pulls the name and description for your agent from the card". The same page's note locates the card "at your agent's endpoint + `/.well-known/agent.json`": relative to the endpoint, and at the pre-1.0 file name, not at the domain root — https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-agent-to-agent (verified 2026-10-18)
- A2A 0.3.0 (2025-07-30) changed the well-known URI from `agent.json` to `agent-card.json` as a breaking change — https://github.com/a2aproject/A2A/blob/main/CHANGELOG.md (verified 2026-10-18)
- Adoption is small. Of 20,185 hosts that answered a probe, 65 serve a card; 41 of those fail a hard structural rule and 15 sit only on the legacy path — https://raw.githubusercontent.com/api-evangelist/posts/main/_posts/2026-07-29-most-published-agent-cards-are-not-actually-a2a.md (verified 2026-10-18)

**Counter-evidence:** Both documented consumers are user-configured. A person types the agent's endpoint or domain; no AI vendor documents crawling the open web for agent cards. Copilot Studio reads the card relative to the endpoint and names the pre-1.0 `agent.json`, so it does not confirm the domain-root `agent-card.json` read this audit checks.

## Scoring

**Grade: B** — a published specification (A2A 1.0, Linux Foundation) on a permanently registered path, with real but small adoption. The reference SDK implements the domain-root read. The only vendor consumer, Copilot Studio, is configured by a person and reads the card relative to the endpoint, so the domain-root read is not documented vendor behaviour. The audit scores only sites that publish a card, so a site with no A2A agent loses nothing.

- A card a client cannot load fails at high priority.
- A card that loads but is incomplete, names an insecure interface or sits only at the old path warns.
- A 0.3-shape card is not warned: the reference SDK converts it.

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

- Either path counts as a card only when its JSON object carries an A2A-only key (`skills`, `capabilities`, `protocolVersion`, `supportedInterfaces`, `defaultInputModes`, `defaultOutputModes` or `preferredTransport`). A JSON file there from another convention, or a card that carries none of those keys, reads as absent.
- An empty 200 body reads as absent, matching the other root-file readers.
- The reader lives in `_a2a-card.ts` beside the audit and exports `NO_AGENT_CARD`, which enrols the audit in `absent-artifact-contract.test.ts`.
- 2026-10-18 review: grade A to B (see Scoring). The A2A-key test now applies at both paths: a real-site scan found a server that answers every `/.well-known/*` path with one unrelated JSON document, and the audit warned that it missed all eight Required fields. The 0.3-shape warning is gone because the reference SDK converts that shape. The legacy-path message no longer says clients have no fallback, since Copilot Studio still names `agent.json`. `AgentInterface` Required fields are now checked.
