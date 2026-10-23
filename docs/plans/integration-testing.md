# Private integration testing

## Local ACP foundation

The private workspace package `packages/integration-testing` supplies a local ACP sandbox test CLI. It does not add an audit, score, public CLI flag, MCP tool, server feature, website feature, billing or production mode. Public scans remain anonymous.

The tool extracts the withdrawn runner from commit `cb638ba24377926d9628543bb27ca465b6a950a0`, path `packages/core/src/gatherers/acp.ts`. That commit also holds the original tests in `audits/agentic-commerce/acp-endpoint-conformance-probe.test.ts`, the configuration in `schemas.ts`, and the schema assets in `protocols/acp/2026-04-17/`. Commit `8755672b53529c9a7bfcb65ed43d1d3961f5faab` removed the scanner integration. This package does not reverse that withdrawal.

## Run

Run `pnpm build` first. Set a sandbox token in the named environment variable. Keep the configuration file local. Then run:

```sh
pnpm integration:acp --config path.json
```

```json
{
  "baseUrl": "https://sandbox.example/api",
  "sandboxAcknowledged": true,
  "tokenEnv": "ACP_SANDBOX_TOKEN",
  "apiVersion": "2026-04-17",
  "testItems": [{ "id": "sandbox_item" }],
  "currency": "usd"
}
```

The configuration accepts 1–20 test items. Add `completedSessionId` only for a customer-supplied completed sandbox fixture. The acknowledgment supplies customer authorization. It does not independently prove that the endpoint is a sandbox. The CLI accepts no raw token flag. Invalid input or a missing token stops the run before traffic.

## Operations

1. Create a session. Expect 201 and the pinned CheckoutSession schema.
2. Retrieve that session. Expect 200 and the same ID.
3. Replay the exact create body with the same idempotency key. Expect 201, the same ID and a semantically identical full body.
4. Replay a changed body under that key. Expect 422, the Error schema and `idempotency_conflict`.
5. Retrieve a generated unknown session. Expect 404 and the Error schema.
6. Cancel the created session. Expect 200, the same ID and `canceled` state.
7. When supplied, retrieve the completed fixture. Verify status, media type, schema, ID and completed state before testing cancellation rejection. Expect 405 and the Error schema. An absent fixture remains untested.

The tool never calls `/complete`. It never updates sessions, sends payments or intentionally creates orders. It owns safe IDs only from successful create/replay responses. It also cleans unexpected new sessions from broken replays. It never owns IDs from GETs, errors or supplied fixtures.

## Result and cleanup

JSON goes to stdout. Use `pnpm --silent integration:acp --config path.json` when saving or parsing stdout. The `--silent` flag suppresses pnpm script banners. `outcome` is `passed`, `contract-mismatch` or `incomplete`. Exit codes are 0, 1 and 2 respectively. Configuration failures also exit 2 with a fixed error. Results include operation coverage, API version, acknowledged sandbox environment, fixed findings, fixture coverage, cleanup certainty and unknown-creation flags. They exclude merchant URLs, session IDs, bodies, tokens and raw errors.

Each request has a 2 s deadline and a 1 MiB response limit. The private transport binds credentials to the configured origin. It validates the resolved socket address. It uses no scanner logger, retries, cookies, cache or tally. It never follows redirects.

SIGINT and SIGTERM abort the main work. Cleanup uses a separate shared 5 s budget. Cancellation must satisfy status, JSON media type, schema, identity and canceled state. Unknown create outcomes or uncertain cleanup prevent a pass. The result supplies the generated create `recoveryKey` for manual lookup. The tool never retries an uncertain create automatically. The transport closes after cleanup.

## Evidence and limits

The package restores the official pinned Draft 2020-12 schema, TypeScript mirror, OpenAPI file, upstream license and provenance. A deterministic test checks the schema digest and mirror parity. The contract explicitly expects 422. It does not substitute the 409 behavior of another consumer.

This proves only the listed operations against the pinned historical contract. It does not prove universal current ACP support or merchant certification. Tests use deterministic mock transports. No live merchant run or customer credentials formed part of this implementation. Payment completion, webhooks, updates and merchant business rules remain outside scope. The completed-fixture test checks the rejection response; it does not re-read the fixture afterward. Abrupt process loss can prevent cleanup and the final report. This local version has no persistent recovery journal.

## Future paid feature

ACP comes first. UCP execution comes later after a separate contract and risk review. The paid product does not exist yet. Remaining work includes:

- Customer setup: endpoint ownership, sandbox confirmation, fixture creation, safe test items, token scope and an explicit run authorization flow.
- Plan entitlement: account access, usage limits and entitlement checks before each run.
- Hosted runner and secrets: tenant isolation, encrypted secret storage, rotation, egress controls, job cancellation and cleanup recovery.
- Report retention: retention periods, access control, deletion, audit history and a safe report UI.
- Costs and pricing: measured run costs, request budgets, cleanup overhead, support costs and plan pricing.
- Live validation: separately authorized sandbox runs, documented evidence and operational acceptance before any hosted launch.

## Implementation deviations

The extracted transport replaces the historical scanner fetcher. The original fetcher could log private URLs and raw errors. Normal cancellation now checks media type before releasing ownership. These changes keep the original six-operation contract.

## Deferred

All paid and hosted work above remains deferred. No live merchant verification ran. No UCP execution, payment completion, billing or production mode ships here.
