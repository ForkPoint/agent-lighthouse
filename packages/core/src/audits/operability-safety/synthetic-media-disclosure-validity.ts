import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { imageCandidates, fetchImage, findC2paManifest, extractXmp, MAX_IMAGES } from '../../gatherers/media';

/** Images sampled per page, before the per-scan cap applies. */
const PER_PAGE = 3;

/** The base the IPTC controlled vocabulary uses. Note the http scheme. */
export const DIGITAL_SOURCE_BASE = 'http://cv.iptc.org/newscodes/digitalsourcetype/';

/**
 * The ratified IPTC DigitalSourceType concepts, vendored.
 *
 * Fetching `https://cv.iptc.org/newscodes/digitalsourcetype/` at audit time
 * would put a third-party outage between a site and its own score, for a list
 * that changes a few times a decade. Refresh path: read the concept list from
 * that URL and update this constant.
 */
export const DIGITAL_SOURCE_CONCEPTS: ReadonlySet<string> = new Set([
  'digitalCapture',
  'negativeFilm',
  'positiveFilm',
  'print',
  'minorHumanEdits',
  'compositeCapture',
  'algorithmicallyEnhanced',
  'dataDrivenMedia',
  'digitalArt',
  'virtualRecording',
  'composite',
  'compositeSynthetic',
  'compositeWithTrainedAlgorithmicMedia',
  'trainedAlgorithmicMedia',
  'algorithmicMedia',
  'softwareImage',
]);

/** Concepts that say a machine made the pixels. */
const SYNTHETIC_CONCEPTS = new Set([
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'compositeSynthetic',
]);

/** Concepts that say a camera did. */
const CAPTURE_CONCEPTS = new Set(['digitalCapture', 'negativeFilm', 'positiveFilm', 'print']);

/** Read `Iptc4xmpExt:DigitalSourceType` out of an XMP packet, in any of its forms. */
export function digitalSourceType(xmp: string): string | undefined {
  const attribute = /Iptc4xmpExt:DigitalSourceType\s*=\s*["']([^"']*)["']/i.exec(xmp);
  if (attribute) return attribute[1]!.trim();
  const element = /<Iptc4xmpExt:DigitalSourceType[^>]*>([^<]*)<\/Iptc4xmpExt:DigitalSourceType>/i.exec(xmp);
  if (element) return element[1]!.trim();
  const resource = /<Iptc4xmpExt:DigitalSourceType[^>]*rdf:resource\s*=\s*["']([^"']*)["']/i.exec(xmp);
  if (resource) return resource[1]!.trim();
  return undefined;
}

export type DisclosureVerdict =
  | { kind: 'valid'; concept: string }
  | { kind: 'bare-concept'; concept: string }
  | { kind: 'wrong-scheme'; concept: string }
  | { kind: 'trailing-slash'; concept: string }
  | { kind: 'unknown-concept'; concept: string }
  | { kind: 'free-text' };

/** Grade one declared value against the controlled vocabulary. */
export function classifyDisclosure(raw: string): DisclosureVerdict {
  const value = raw.trim();
  if (value === '') return { kind: 'free-text' };

  const trimmed = value.replace(/\/+$/, '');
  const hadSlash = trimmed !== value;
  const httpsBase = DIGITAL_SOURCE_BASE.replace('http://', 'https://');

  if (trimmed.startsWith(DIGITAL_SOURCE_BASE)) {
    const concept = trimmed.slice(DIGITAL_SOURCE_BASE.length);
    if (!DIGITAL_SOURCE_CONCEPTS.has(concept)) return { kind: 'unknown-concept', concept };
    return hadSlash ? { kind: 'trailing-slash', concept } : { kind: 'valid', concept };
  }
  if (trimmed.startsWith(httpsBase)) {
    return { kind: 'wrong-scheme', concept: trimmed.slice(httpsBase.length) };
  }
  if (DIGITAL_SOURCE_CONCEPTS.has(trimmed)) return { kind: 'bare-concept', concept: trimmed };
  return { kind: 'free-text' };
}

export class SyntheticMediaDisclosureValidityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/synthetic-media-disclosure-validity',
    category: 'operability-safety',
    title: 'AI-generated-image disclosure is machine-readable and self-consistent',
    failureTitle: 'This site’s AI disclosure is written in a form no machine reads',
    description:
      'Reads `Iptc4xmpExt:DigitalSourceType` out of each image’s XMP packet and tests it against the ratified IPTC NewsCodes vocabulary. The property is typed as a URI, so a bare token, an `https` variant of the `http` vocabulary URI, a trailing slash or free text all read as nothing to a consumer. Also compares the XMP declaration against what the asset’s own C2PA manifest says.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/operability-safety/synthetic-media-disclosure-validity.md',
    guidance: {
      impact:
        'Disclosure only counts if a machine can read it. IPTC types `DigitalSourceType` as a URI from a controlled vocabulary, so a consumer matching against that vocabulary silently ignores `AI-generated`, a bare `trainedAlgorithmicMedia`, or an `https://` spelling of the `http://` vocabulary URI. The publisher believes the image is disclosed; every machine reader sees an undisclosed image. Worse is an asset whose XMP and C2PA manifest disagree about whether a human took the photo — two provenance channels, one of them wrong.',
      fix: 'Write the full vocabulary URI, exactly: `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`. Keep the `http` scheme the vocabulary itself uses, no trailing slash, no free text, and make sure the value agrees with the digital source type asserted in the asset’s C2PA manifest.',
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/operability-safety/synthetic-media-disclosure-validity.md',
      tags: ['ai-disclosure', 'iptc', 'xmp', 'provenance'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const candidates: string[] = [];
    for (const page of ctx.pages) {
      for (const url of imageCandidates(page).slice(0, PER_PAGE)) {
        if (!candidates.includes(url)) candidates.push(url);
      }
    }

    const failures: string[] = [];
    const declarations: string[] = [];
    let imagesRead = 0;
    let declared = 0;

    for (const url of candidates.slice(0, MAX_IMAGES)) {
      const bytes = await fetchImage(ctx, url);
      if (!bytes) continue;
      imagesRead += 1;

      const xmp = extractXmp(bytes);
      const raw = xmp === undefined ? undefined : digitalSourceType(xmp);
      if (raw === undefined) continue;
      declared += 1;

      const verdict = classifyDisclosure(raw);
      declarations.push(`${url}: "${raw}" (${verdict.kind})`);

      switch (verdict.kind) {
        case 'bare-concept':
          failures.push(
            `${url}: DigitalSourceType is the bare concept "${verdict.concept}"; IPTC types the property as a URI, so write ${DIGITAL_SOURCE_BASE}${verdict.concept}`,
          );
          break;
        case 'wrong-scheme':
          failures.push(
            `${url}: DigitalSourceType uses https where the vocabulary uses http; write ${DIGITAL_SOURCE_BASE}${verdict.concept}`,
          );
          break;
        case 'trailing-slash':
          failures.push(
            `${url}: DigitalSourceType carries a trailing slash, so it does not match ${DIGITAL_SOURCE_BASE}${verdict.concept}`,
          );
          break;
        case 'unknown-concept':
          failures.push(
            `${url}: "${verdict.concept}" is not a member of the IPTC DigitalSourceType vocabulary`,
          );
          break;
        case 'free-text':
          failures.push(
            `${url}: DigitalSourceType is free text ("${raw}"), which no consumer matches against the vocabulary`,
          );
          break;
        case 'valid':
          break;
      }

      // The two provenance channels on one asset must not disagree about
      // whether a human took the photo.
      const manifest = findC2paManifest(bytes);
      if (manifest && verdict.kind !== 'free-text') {
        const store = Buffer.from(
          bytes.subarray(manifest.start, manifest.start + manifest.length),
        ).toString('latin1');
        const manifestSynthetic = [...SYNTHETIC_CONCEPTS].some((concept) => store.includes(concept));
        const manifestCapture = [...CAPTURE_CONCEPTS].some((concept) => store.includes(concept));
        if (manifestSynthetic && CAPTURE_CONCEPTS.has(verdict.concept)) {
          failures.push(
            `${url}: the XMP declares "${verdict.concept}" while the C2PA manifest asserts a trained-algorithmic source — the two provenance channels contradict each other`,
          );
        } else if (manifestCapture && !manifestSynthetic && SYNTHETIC_CONCEPTS.has(verdict.concept)) {
          failures.push(
            `${url}: the XMP declares "${verdict.concept}" while the C2PA manifest asserts a camera capture — the two provenance channels contradict each other`,
          );
        }
      }
    }

    if (declared === 0) {
      return this.notApplicable(
        'No image on this site declares a digital source type, so there is no disclosure to grade.',
        'At least one image carrying Iptc4xmpExt:DigitalSourceType',
        `${imagesRead} image(s) read, none carrying an XMP disclosure`,
      );
    }

    const coverage = imagesRead === 0 ? 0 : Math.round((declared / imagesRead) * 100);
    const details = {
      declaredCoverage: coverage,
      imagesRead,
      declarations: declarations.slice(0, 20),
      failures: failures.slice(0, 20),
    };
    const expected =
      'Every DigitalSourceType is a full IPTC NewsCodes URI from the ratified vocabulary, agreeing with the asset’s C2PA manifest';
    const found = `${declared} of ${imagesRead} image(s) declare a source type (${coverage}%); ${failures.length} invalid or contradictory.`;
    const displayValue = `${declared - failures.length}/${declared} valid`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          found,
          `Write the full vocabulary URI, keeping the http scheme: ${DIGITAL_SOURCE_BASE}<concept>.`,
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${declared} image(s) declare a digital source type that a consumer can match against the vocabulary.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
