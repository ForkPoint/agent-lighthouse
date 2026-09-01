import { describe, it, expect } from "vitest";
import { ChunkBoundaryReferentIntegrityAudit } from "./chunk-boundary-referent-integrity";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

/** Forty-plus words that never name the product, so entity presence is the variable. */
const FILLER =
  "Fill the vessel to the marked line and wait for the water to reach a rolling boil. " +
  "Leave the lid closed while it heats, then pour slowly to avoid splashing the counter. " +
  "Rinse afterwards and leave it upside down to dry completely before the next use today.";

const page = (sections: string, h1 = "Copper kettle"): CheckContext =>
  mockCheckContext([
    mockPageContext(
      "https://example.com/kettles",
      `<html><head><meta property="og:title" content="${h1}"></head><body><main><h1>${h1}</h1>${sections}</main></body></html>`,
      1,
    ),
  ]);

const clean = (heading: string) =>
  `<h2>${heading}</h2><p>The copper kettle ${FILLER}</p>`;

describe("ChunkBoundaryReferentIntegrityAudit", () => {
  const audit = new ChunkBoundaryReferentIntegrityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable on a page with no h2 or h3", async () => {
    expect(
      (await audit.audit(page("<p>Just prose about the copper kettle.</p>")))
        .status,
    ).toBe("na");
  });

  it("passes a page whose every section names its subject", async () => {
    const result = await audit.audit(
      page([clean("Boiling"), clean("Descaling"), clean("Warranty")].join("")),
    );
    expect(result.status).toBe("pass");
  });

  it("flags a chunk that opens on a demonstrative with no referent", async () => {
    const result = await audit.audit(
      page(
        `${clean("Boiling")}${clean("Descaling")}${clean("Warranty")}<h2>Storage</h2><p>This means the copper kettle ${FILLER}</p>`,
      ),
    );
    expect(result.found).toContain("anaphoraOpen");
  });

  it("does not flag the same opening when the heading word follows it", async () => {
    const result = await audit.audit(
      page(
        `${clean("Boiling")}<h2>Storage</h2><p>This storage step keeps the copper kettle ${FILLER}</p>`,
      ),
    );
    expect(result.found ?? "").not.toContain("anaphoraOpen");
  });

  it("flags a forty-word chunk that never names the subject", async () => {
    const result = await audit.audit(
      page(
        `${clean("Boiling")}${clean("Descaling")}<h2>Storage</h2><p>${FILLER}</p>`,
      ),
    );
    expect(result.found).toContain("entityAbsent");
  });

  it("counts positional references but not the words that merely look like them", async () => {
    const flagged = await audit.audit(
      page(
        `${clean("Boiling")}<h2>Storage</h2><p>As described above, the copper kettle ${FILLER}</p>`,
      ),
    );
    expect(flagged.found).toContain("positionalRefs");
    const notFlagged = await audit.audit(
      page(
        `${clean("Boiling")}<h2>Storage</h2><p>Above all the copper kettle ${FILLER}</p>`,
      ),
    );
    expect(notFlagged.found ?? "").not.toContain("positionalRefs");
  });

  it("builds the entity set from h1, og:title and JSON-LD, with aliases", async () => {
    const jsonLd = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Nordic Brew Kettle",
    })}</script>`;
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/kettles",
        `<html><head>${jsonLd}</head><body><main><h1>Nordic Brew Kettle</h1><h2>Boiling</h2><p>The Nordic ${FILLER}</p></main></body></html>`,
        1,
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect((result.details?.["entities"] as string[]).length).toBeGreaterThan(
      1,
    );
  });

  it("fails below 0.8 passing chunks and passes above it", async () => {
    const broken = `<h2>Storage</h2><p>${FILLER}</p>`;
    // 4 clean of 5 -> 0.80 exactly, which is not below the floor.
    const atFloor = await audit.audit(
      page([clean("A"), clean("B"), clean("C"), clean("D"), broken].join("")),
    );
    expect(atFloor.status).not.toBe("fail");
    // 2 clean of 4 -> 0.50.
    const below = await audit.audit(
      page(
        [clean("A"), clean("B"), broken, `<h2>Care</h2><p>${FILLER}</p>`].join(
          "",
        ),
      ),
    );
    expect(below.status).toBe("fail");
  });

  it("quotes the offending sentence under its heading", async () => {
    const result = await audit.audit(
      page(`${clean("Boiling")}<h2>Storage</h2><p>${FILLER}</p>`),
    );
    expect(result.found).toContain("Storage");
    expect(result.found).toContain("Fill the vessel");
  });

  it("registers as a scored grade-B audit with high priority", () => {
    const { meta } = ChunkBoundaryReferentIntegrityAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.defaultPriority).toBe("high");
  });
});
