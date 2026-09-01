---
"@forkpoint/agent-lighthouse-core": major
---

Four OpenAPI audits no longer fail a site for publishing no OpenAPI document.

**What was wrong.** `agent-interfaces/openapi-servers`, `openapi-endpoints`,
`openapi-schemas` and `openapi-operation-ids` are each grade B, tier `scored`,
weight 0.6 — 2.4 combined. All four are about a document's contents, and all
four returned `fail` at high or medium priority when there was no document at
all. Nothing gated them: `requires: ['origin-reachable']` and no
`applicablePageTypes`, so every site that answers a 200 and has no API — a
bakery, a blog, a law firm — took four high-priority failures telling it to add
a `servers` array to a spec it had never written. Measured `fail` on 41 of 41
corpus fixtures.

`agent-interfaces/openapi-exists` already declined the identical absence, and
`openapi-servers`' own dossier records counter-evidence arguing that an absent
`servers` array is legal under OpenAPI 3.1 and resolvable against the
document's own location. Where the dossier and the code disagree, the dossier
governs.

**What changed.** No document read means `notApplicable`, and no weight. Two of
the four also decline a document that declares no operations, which is the same
absence one level down — `openapi-endpoints` is the audit that reports an empty
document, and it now reports it once.

**Absent means absent; broken means broken.** A `paths` member that is present
and yields nothing readable — `paths` is not an object at all, or every entry
under it is defective — is a defective document, not an absent one.
`openapi-endpoints`, `openapi-schemas` and `openapi-operation-ids` fail it and
name the defect in `found`, where all three previously reported "0 operations".
A defect counts at either level: a non-object where a Path Item Object belongs
and a non-object where an Operation Object belongs are the same error. An empty
`paths` object, no `paths` key, and a path item that declares no method are
legal and declare nothing, so they still decline.

**A broken entry does not erase the operations beside it.** A document with
twenty readable operations and one `null` path item is graded on its twenty:
`openapi-endpoints` counts them, `openapi-schemas` measures coverage over them,
`openapi-operation-ids` checks their ids. The entries that could not be read are
named in the message and counted in `found`, and they do not change the verdict.

**What did not change.** Every verdict on a document that exists and is
defective. A missing `servers` array, entries with no `url`, an unreachable
server URL, low schema coverage, an unregistrable or duplicated `operationId` —
all still fail or warn exactly as before. That is the finding the grade B was
earned for. A document that declares no operations is still failed, by
`openapi-endpoints`, which is the audit whose subject it is.

**Also.** The seven byte-identical copies of `getOpenApiSpec`, and the four of
the `paths` traversal, collapse into `packages/core/src/gatherers/openapi.ts`,
which now owns the read, the traversal and the precondition.
`agent-interfaces/search-endpoint` and `operability-safety/contact-form` keep
judging a site that publishes no document — they have other evidence — and no
verdict of theirs moved. `agent-interfaces/openapi-description-quality` already
declined the absence and still does; only the wording of its decline changed,
so that it says what the rest of the family says.

The shared decline now reads "No readable OpenAPI document at /openapi.json"
rather than "No OpenAPI document is published at /openapi.json". The read also
comes back empty for a 200 whose body will not parse, and a site that publishes
a broken document has not published none.

`operability-safety/contact-form` and `agent-interfaces/search-endpoint` read
the same document without judging it, and they keep the traversal they had: a
site with a `POST /contact` and one malformed sibling entry still has a contact
endpoint. They do stop counting a `x-` specification extension as a path item,
which OpenAPI 3.1 §4.8.8 says it never was. Both are informative, so no score
moves either way.
