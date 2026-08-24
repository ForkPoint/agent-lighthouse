import { X509Certificate } from 'node:crypto';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { imageCandidates, fetchImage, findC2paManifest, MAX_IMAGES } from '../../gatherers/media';

/** Images sampled per page, before the per-scan cap applies. */
const PER_PAGE = 3;

/** The C2PA assertion label that carries an RFC 3161 timestamp token. */
const TIMESTAMP_LABEL = 'sigTst';

/**
 * Every DER certificate inside a manifest store.
 *
 * A COSE_Sign1 carries its certificate chain in the protected header under
 * label 33, wrapped in CBOR. Rather than decode CBOR, this scans for the DER
 * sequence header a certificate always begins with and lets
 * `X509Certificate` reject anything that is not one — the parser is the test.
 */
export function certificatesIn(store: Uint8Array): X509Certificate[] {
  const found: X509Certificate[] = [];
  const seen = new Set<string>();

  for (let at = 0; at + 4 < store.length; at += 1) {
    // 0x30 0x82 is SEQUENCE with a two-byte length: every certificate of a
    // realistic size starts this way, and the inner TBSCertificate does too.
    if (store[at] !== 0x30 || store[at + 1] !== 0x82) continue;
    const length = ((store[at + 2] ?? 0) << 8) | (store[at + 3] ?? 0);
    const end = at + 4 + length;
    if (end > store.length) continue;
    try {
      const cert = new X509Certificate(Buffer.from(store.subarray(at, end)));
      if (seen.has(cert.fingerprint256)) continue;
      seen.add(cert.fingerprint256);
      found.push(cert);
    } catch {
      // Not a certificate. The next offset may still be one.
    }
  }

  return found;
}

/** The end-entity certificate: the one that issued nothing else in the chain. */
export function leafOf(certs: X509Certificate[]): X509Certificate | undefined {
  for (const cert of certs) {
    const issuesAnother = certs.some((other) => other !== cert && other.checkIssued(cert));
    if (!issuesAnother) return cert;
  }
  return certs[0];
}

export class C2paSignerTrustStatusAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/c2pa-signer-trust-status',
    category: 'operability-safety',
    title: 'Content Credentials are signed by a certificate that can be trusted',
    failureTitle: 'This site’s Content Credentials are signed by a certificate no validator accepts',
    description:
      'Reads the signing certificate out of each Content Credential and reports what the certificate itself says: self-signed or CA-issued, inside its validity window or outside it, and whether a timestamp token is present. A self-signed or expired signer surfaces as untrusted in every conforming validator, however well-formed the manifest is.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/operability-safety/c2pa-signer-trust-status.md',
    guidance: {
      impact:
        'A manifest that exists is not a manifest that verifies. A conforming C2PA validator resolves the signing certificate against the published Trust List and shows the credential as untrusted when it cannot — which is what a self-signed certificate always produces, and what an expired one produces the day it lapses. The publisher sees Content Credentials on every asset; the consumer sees a warning, or nothing at all.',
      fix: 'Sign with a certificate from a CA on the C2PA Trust List rather than a self-signed one, renew before it expires, and include an RFC 3161 timestamp so credentials stay valid past the certificate’s own expiry.',
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/c2pa-signer-trust-status/',
      tags: ['c2pa', 'provenance', 'certificates', 'content-credentials'],
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
    const warnings: string[] = [];
    const signers: string[] = [];
    const unreadable: string[] = [];
    let manifests = 0;
    let timestamped = 0;
    const now = Date.now();

    for (const url of candidates.slice(0, MAX_IMAGES)) {
      const bytes = await fetchImage(ctx, url);
      if (!bytes) continue;
      const location = findC2paManifest(bytes);
      if (!location) continue;
      manifests += 1;

      const store = bytes.subarray(location.start, location.start + location.length);
      const hasTimestamp = Buffer.from(store).toString('latin1').includes(TIMESTAMP_LABEL);
      if (hasTimestamp) timestamped += 1;

      const certs = certificatesIn(store);
      const leaf = leafOf(certs);
      if (!leaf) {
        unreadable.push(`${url}: a manifest is present but no signing certificate could be read from it`);
        continue;
      }

      const selfSigned = leaf.subject === leaf.issuer;
      const notBefore = Date.parse(leaf.validFrom);
      const notAfter = Date.parse(leaf.validTo);
      const subject = leaf.subject.replace(/\n/g, ', ');
      signers.push(`${url}: ${subject} (issued by ${leaf.issuer.replace(/\n/g, ', ')})`);

      if (selfSigned) {
        failures.push(`${url}: signed by a self-signed certificate (${subject}); no validator trusts one`);
      } else if (Number.isFinite(notAfter) && notAfter < now) {
        failures.push(`${url}: the signing certificate expired on ${leaf.validTo}`);
      } else if (Number.isFinite(notBefore) && notBefore > now) {
        failures.push(`${url}: the signing certificate is not valid until ${leaf.validFrom}`);
      } else if (!hasTimestamp) {
        // Without a timestamp token the credential stops validating the day the
        // certificate expires, however good the certificate is today.
        warnings.push(
          `${url}: signed by ${leaf.issuer.replace(/\n/g, ', ')} but carrying no timestamp token, so the credential stops validating when the certificate expires on ${leaf.validTo}`,
        );
      }
    }

    if (manifests === 0) {
      return this.notApplicable(
        'No image on this site carries a Content Credential to check the signer of.',
        'At least one image carrying a C2PA manifest',
        `${candidates.length} image candidate(s), none carrying a manifest`,
      );
    }

    const details = {
      manifestsRead: manifests,
      timestamped,
      signers: signers.slice(0, 20),
      failures: failures.slice(0, 20),
      warnings: warnings.slice(0, 20),
      unreadable: unreadable.slice(0, 20),
    };
    const expected =
      'Every Content Credential is signed by a CA-issued certificate inside its validity window';
    const found = `${manifests} manifest(s) read, ${timestamped} carrying a timestamp; ${failures.length} unusable signer(s), ${unreadable.length} unreadable.`;
    const displayValue = `${manifests - failures.length}/${manifests} signers usable`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          found,
          'Sign with a certificate from a CA on the C2PA Trust List, and renew it before it expires.',
        ),
        displayValue,
        details,
      };
    }

    if (unreadable.length > 0 || warnings.length > 0) {
      return {
        ...this.warn(
          unreadable.length > 0 ? unreadable[0]! : warnings[0]!,
          expected,
          found,
          'Confirm the signing certificate chains to the C2PA Trust List, which this audit does not check.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${manifests} Content Credential(s) carry a readable, CA-issued signing certificate.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
