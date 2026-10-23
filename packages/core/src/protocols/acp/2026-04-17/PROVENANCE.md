# ACP 2026-04-17 protocol snapshot

Source: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/tree/7fdd78df677a94dce04c770644b0fbbb1401272b/spec/2026-04-17

Revision: `7fdd78df677a94dce04c770644b0fbbb1401272b`

The adjacent LICENSE is the upstream Apache-2.0 license. Schema bytes are unchanged.

SHA-256 schema.agentic_checkout.json: `d0e4290617d66bf05d002b8ace388732be2b3eb9a92a1003db7a2daa1e0436f2`

SHA-256 openapi.agentic_checkout.yaml: `2a0aa239b4aed50732461d9b7e443ad98d5c2d3431277899433ead07cbd4fc55`

`checkout-schema.ts` embeds the JSON object for code bundling. The adjacent JSON retains the original source bytes.

SHA-256 of `schema.agentic_checkout.json`: `d0e4290617d66bf05d002b8ace388732be2b3eb9a92a1003db7a2daa1e0436f2`.

`checkout-schema.ts` is the runtime mirror of that JSON. A deterministic test
checks their equality and the snapshot digest.
