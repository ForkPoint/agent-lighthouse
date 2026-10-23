---
audit: agentic-commerce/ucp-profile-conformance
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/ucp-profile-conformance.ts
slug: ucp-profile-conformance
evidence_grade: B
tier: informative
disposition: "new — versioned UCP capability and payment declaration checks"
reviewed: 2026-10-23
consumers:
  - Google Merchant UCP integration — business profiles declare checkout capabilities and payment configuration
sources:
  - google-merchant-ucp-profile
  - ucp-schema-2026-01-11-metadata
  - ucp-schema-2026-01-11-capability
  - ucp-schema-2026-01-11-payment-handler
  - ucp-schema-2026-04-08-metadata
  - ucp-schema-2026-04-08-capability
  - ucp-schema-2026-04-08-payment-handler
  - ucp-schema-2026-04-08-available-instrument
  - ucp-schema-2026-08-25-metadata
  - ucp-schema-2026-08-25-capability
  - ucp-schema-2026-08-25-payment-handler
  - ucp-schema-2026-08-25-constraint-expression
  - ucp-schema-2026-08-25-available-instrument
  - ucp-schema-2026-08-25-reverse-domain-name
---

# UCP capability and payment declarations conform

## What it checks

Checks declared capabilities and payment handlers in the business profile at
`/.well-known/ucp`. The selected `ucp.version` chooses the declaration rules.
Supported versions are `2026-01-11`, `2026-04-08` and `2026-08-25`.

The check covers registry or array shape, required declaration fields, their
types, date-version syntax, absolute URI syntax and extension-parent names.
Modern handler declarations also receive instrument-list type checks. August
2026 profiles additionally receive nested constraint-expression checks. Each
entry is inspected independently, so one malformed declaration does not erase
the readable entries beside it.

| Profile state                                           | Result                                                         |
| :------------------------------------------------------ | :------------------------------------------------------------- |
| No declared UCP profile                                 | `notApplicable`                                                |
| Unreadable profile                                      | `notApplicable`; `ucp-profile` reports the unreadable artifact |
| Missing protocol version                                | `notApplicable`; `ucp-profile` reports the missing version     |
| Protocol version this audit does not know               | `notApplicable`; declarations not assessed                     |
| A checked declaration field violates the selected rules | `fail`, informative only                                       |
| All checked fields conform                              | `pass`, informative only                                       |

## Why it matters

Google's Merchant UCP guide describes the business profile as the way to
discover a merchant's supported features and payment configuration. A declaration with
the wrong shape cannot describe that configuration reliably. This check
reports published declaration defects before a merchant tests checkout.

## Evidence

Google documents the profile's discovery role in its
[Merchant UCP guide](https://developers.google.com/merchant/ucp/guides/overview/ucp-profile)
(verified 2026-10-23).

The selected protocol schemas define different discovery contexts:

- The [2026-01-11 metadata schema](https://ucp.dev/2026-01-11/schemas/ucp.json)
  requires a capability array. Its [capability discovery schema](https://ucp.dev/2026-01-11/schemas/capability.json)
  requires `name`, `version`, `spec` and `schema`. Legacy payment declarations
  use the [handler schema](https://ucp.dev/2026-01-11/schemas/shopping/types/payment_handler.json)
  under `payment.handlers` (verified 2026-10-23).
- The [2026-04-08 metadata schema](https://ucp.dev/2026-04-08/schemas/ucp.json)
  uses registries of declaration arrays. Its business schema requires a
  `payment_handlers` registry, which may be empty. Capabilities are optional.
  A [business capability](https://ucp.dev/2026-04-08/schemas/capability.json)
  requires `version`; `spec` and `schema` remain optional. A
  [business handler](https://ucp.dev/2026-04-08/schemas/payment_handler.json)
  requires `version` and `id`. Its optional instrument list follows the
  [available-instrument schema](https://ucp.dev/2026-04-08/schemas/shopping/types/available_payment_instrument.json)
  (verified 2026-10-23).
- The [2026-08-25 metadata schema](https://ucp.dev/2026-08-25/schemas/ucp.json)
  keeps the registry shape. Its [business capability schema](https://ucp.dev/2026-08-25/schemas/capability.json)
  additionally requires `schema`. The [business handler schema](https://ucp.dev/2026-08-25/schemas/payment_handler.json)
  still requires `version` and `id`. Its
  [available-instrument schema](https://ucp.dev/2026-08-25/schemas/common/types/available_payment_instrument.json)
  names `type` as required (verified 2026-10-23).
- The [2026-08-25 reverse-domain schema](https://ucp.dev/2026-08-25/schemas/common/types/reverse_domain_name.json)
  permits interior hyphens, digit-leading later segments and punycode top-level
  segments. The earlier capability schemas use a narrower identifier pattern.
  Registry keys and `extends` use their selected version's pattern
  (verified 2026-10-23).

The [2026-08-25 constraint-expression schema](https://ucp.dev/2026-08-25/schemas/common/types/constraint_expression.json)
defines closed recursive object constraints with `required`, `properties` and
`anyOf`. Value constraints permit `enum`, `const`, or both. Nonempty and unique
item rules apply where the schema names them. An empty root object is valid,
but an empty `anyOf` branch is not. The April instrument schema instead permits
any nonempty constraint object. The profile version selects these rules, even
when a handler declares a different component version (verified 2026-10-23).

**Grade: B.** The UCP standard has a named merchant integration. This supports
checking declared protocol fields, but it does not prove how a live checkout
handles each malformed declaration. The audit remains informative.

## Limits

- This is bounded declaration-field validation, not a complete JSON Schema
  evaluation. It does not validate provider-specific `config`, compose
  capability payload schemas or establish that checkout works.
- Nested constraint checks validate expression structure for `2026-08-25`.
  They do not test submitted payment data against those expressions or verify
  provider-defined instrument fields. Earlier profiles retain their published
  open constraint-object rules.
- Each nested expression has local limits of 32 levels, 2048 JSON values and
  64 KiB of UTF-8 strings and object keys.
  A limit produces `constraintValidationLimited: true`. Up to 40 path and limit
  messages appear in `constraintValidationLimits`. With no other defects,
  the result warns instead of passing. An unassessed handler does not count as
  valid. Known defects still fail when another expression exceeds a limit.
- URI checks establish syntax only. The audit makes no new requests and does
  not fetch a merchant-supplied schema or prove its contents valid.
- Independent component versions need not equal `ucp.version`. Unknown fields
  and vendor instrument names remain open.
- A protocol version this audit does not know, such as one published after
  it, is `notApplicable` with `validationPerformed: false` and the supported
  versions in `supportedVersions`. The profile did nothing wrong; the audit
  has no rules for that version. It does not receive a false conformance
  pass either. A missing `ucp.version` is also `notApplicable` here, because
  `ucp-profile` already reports it.
- Only 40 issue strings appear in details. `issueCount` records the full count
  and `issuesTruncated` shows when that limit applies.

## How it scores

Tier: **informative**, weight 0 from `weightForGrade`. No result changes the
site score. The existing `ucp-profile` audit keeps its own readability verdict;
this audit does not add score weight for the same profile.

An absent optional artifact is `notApplicable`. For a supported adopted
profile, a required declaration field or required registry can fail. Empty
registries pass where the selected schema permits them.

## Example finding

A `2026-08-25` profile declares a checkout capability with `version` but no
`schema`. Report the missing declaration field. A `2026-04-08` business
capability with the same fields passes because that schema does not require
the URL. Neither result proves the merchant can complete checkout.

## Sources

The links in Evidence are the versioned protocol schemas and Google's merchant
guide. Each was retrieved on 2026-10-23. They distinguish business discovery
from platform discovery and response schemas; these contexts have different
required fields.

## Implementation deviations

- Uses the existing `readUcpProfile` reader and absent-artifact precondition.
  No profile fetch or merchant URL fetch is added.
- Validates a documented subset directly rather than loading remote JSON
  schemas. The public Limits state the unvalidated parts.
- URI fields use the JSON Schema `uri` format validator from `ajv-formats`.
  WHATWG URL normalization is not a substitute for that format: malformed
  percent escapes and backslashes must not pass.
- Legacy capabilities and handlers validate only fields defined by their
  respective legacy schemas. Unknown fields remain open; a legacy capability's
  numeric `id` or a legacy handler's object-valued `schema` does not inherit a
  modern entity's field constraints.
- The constraint validator pins the published August expression rules locally.
  It resolves only local references and checks size before recursive validation.
- The readable and valid entry counts survive mixed malformed declarations.
  Issue details contain only scalar values or arrays of strings.

## Review history

- 2026-10-23: an unknown or missing protocol version moved from `warn` to
  `notApplicable`. The warning blamed the site for the audit's own missing
  rules, and a missing version was reported twice beside `ucp-profile`.

## Deferred

- Provider-specific configuration and instrument-target validation need
  their own bounded schema and source review. Nested expression structure
  validation is implemented for the published August schema.
- No live checkout request, payment, capability execution or merchant
  certification forms part of this check.
