import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { MAX_RESPONSE_BODY_BYTES } from "../../constants";
import {
  imageCandidates,
  fetchImage,
  findC2paManifest,
  originOfVariant,
  MAX_IMAGES,
} from "../../gatherers/media";

/** Images sampled per page, before the per-scan cap applies. */
const PER_PAGE = 3;

export class C2paManifestSurvivesDeliveryAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/c2pa-manifest-survives-delivery",
    category: "operability-safety",
    title: "Content Credentials survive the image delivery pipeline",
    failureTitle:
      "This site’s image pipeline strips Content Credentials before delivery",
    description:
      "Fetches the images a page actually serves and looks for a C2PA manifest store in the bytes. Where a served image is a transformed variant — Next.js image optimization, Cloudflare Image Resizing, a WordPress rendition — the origin asset is fetched too and the two are compared. An origin that carries a manifest whose variant does not is a pipeline stripping provenance in transit.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "medium",
    dossier:
      "docs/evidence/audits/operability-safety/c2pa-manifest-survives-delivery.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "Signing an image at creation proves nothing if the bytes a crawler downloads are unsigned. Image transformation layers discard Content Credentials by default — Cloudflare states outright that with preservation disabled, existing Content Credentials are always discarded — so the publisher sees signed assets in their library while every consumer sees stripped ones. The provenance work is done and none of it reaches the reader.",
      fix: "Turn on Content Credentials preservation in the image pipeline (Cloudflare Images has an explicit setting; Next.js image optimization and most CDN resizers need the manifest copied through or the asset served unoptimized). Verify by fetching the URL the page actually renders, not the asset in the library.",
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/c2pa-manifest-survives-delivery/",
      tags: ["c2pa", "provenance", "content-credentials", "images"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const candidates: string[] = [];
    for (const page of ctx.pages) {
      for (const url of imageCandidates(page).slice(0, PER_PAGE)) {
        if (!candidates.includes(url)) candidates.push(url);
      }
    }
    if (candidates.length === 0) {
      return this.notApplicable(
        "This site serves no image this scan could read.",
        "At least one image to check for Content Credentials",
        "No image found on any crawled page",
      );
    }

    const sample = candidates.slice(0, MAX_IMAGES);
    const signed: string[] = [];
    const unsigned: string[] = [];
    const skipped: string[] = [];
    const stripped: string[] = [];
    const preserved: string[] = [];
    let fetches = 0;

    /** Fetch one image and say whether its bytes carry a manifest. */
    const manifestOf = async (url: string): Promise<boolean | undefined> => {
      const bytes = await fetchImage(ctx, url);
      fetches += 1;
      if (!bytes) return undefined;
      // A truncated asset cannot be called unsigned: the store may sit past the
      // cap, and C2PA allows it mid-file.
      if (bytes.length >= MAX_RESPONSE_BODY_BYTES) {
        skipped.push(
          `${url} (over the ${MAX_RESPONSE_BODY_BYTES}-byte read cap)`,
        );
        return undefined;
      }
      return findC2paManifest(bytes) !== undefined;
    };

    for (const url of sample) {
      const hasManifest = await manifestOf(url);
      if (hasManifest === undefined) continue;
      (hasManifest ? signed : unsigned).push(url);

      const origin = originOfVariant(url);
      if (
        origin === undefined ||
        origin === url ||
        fetches >= MAX_IMAGES + sample.length
      )
        continue;
      const originHasManifest = await manifestOf(origin);
      if (originHasManifest === undefined) continue;
      if (originHasManifest && !hasManifest) {
        stripped.push(
          `${origin} carries a manifest; the served variant ${url} does not`,
        );
      } else if (originHasManifest && hasManifest) {
        preserved.push(`${url} keeps the manifest its origin carries`);
      }
    }

    const checked = signed.length + unsigned.length;
    if (checked === 0) {
      return this.notApplicable(
        "No image this scan sampled could be read.",
        "At least one readable image",
        `${sample.length} image(s) sampled; ${skipped.length} skipped, the rest did not answer`,
      );
    }
    if (signed.length === 0 && stripped.length === 0) {
      return this.notApplicable(
        "No image on this site carries Content Credentials, so there is nothing for the pipeline to strip.",
        "At least one signed image",
        `${checked} image(s) checked, none carrying a C2PA manifest`,
      );
    }

    const coverage = Math.round((signed.length / checked) * 100);
    const details = {
      manifestCoverage: coverage,
      imagesChecked: checked,
      signed: signed.slice(0, 20),
      strippedInTransit: stripped.slice(0, 20),
      preserved: preserved.slice(0, 20),
      skipped: skipped.slice(0, 10),
    };
    const expected =
      "Every served image variant carries the Content Credentials its origin asset carries";
    const found = `${checked} image(s) read, ${signed.length} signed (${coverage}%), ${stripped.length} stripped between origin and variant, ${skipped.length} skipped.`;
    const displayValue = `${coverage}% signed`;

    if (stripped.length > 0) {
      return {
        ...this.fail(
          `${stripped.length} image(s) lose their Content Credentials in the delivery pipeline.`,
          expected,
          found,
          "Enable Content Credentials preservation in the image pipeline, or serve the signed asset unoptimized.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${signed.length} of ${checked} sampled image(s) carry Content Credentials, and no variant loses them.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
