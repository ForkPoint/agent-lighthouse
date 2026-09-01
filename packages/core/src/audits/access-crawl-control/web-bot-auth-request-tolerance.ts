import { createHash, createPublicKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../url-utils';
import { probeSecurityUrl } from '../../gatherers/security';

/** The derived components the Web Bot Auth profile signs. */
const COVERED = ['@authority', '@method', '@path'] as const;

/** Signature lifetime, in seconds. Short, because the probe is one request. */
const LIFETIME_SECONDS = 300;

/** Statuses that mean the origin rejected the request because it was signed. */
const REJECTION_STATUSES = new Set([400, 403, 421]);

/** Below this share of the baseline body, a 200 to a signed request is a block wearing a 200. */
const COLLAPSE_RATIO = 0.4;

/** Header names whose presence in `Vary` shows the origin knows it varies on them. */
const SIGNATURE_HEADERS = ['signature', 'signature-input', 'signature-agent'];

export interface SignedRequestHeaders extends Record<string, string> {
  'Signature-Input': string;
  Signature: string;
  'Signature-Agent': string;
}

/** RFC 7638 JWK thumbprint of an Ed25519 public key, base64url. */
export function jwkThumbprint(publicKeyPem: string): string {
  const jwk = createPublicKey(publicKeyPem).export({ format: 'jwk' }) as { crv?: string; kty?: string; x?: string };
  // The thumbprint is over the required members in lexicographic order, with no
  // whitespace. Building the JSON by hand is what keeps that order guaranteed.
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}"}`;
  return createHash('sha256').update(canonical).digest('base64url');
}

/**
 * The RFC 9421 signature base for a GET of `url`.
 *
 * One line per covered component in the order they are listed, then the
 * `@signature-params` line carrying the same list and the parameters. The
 * signature is over exactly these bytes, which is why this is written out
 * rather than assembled from a template.
 */
export function signatureBase(url: string, params: string): string {
  const target = new URL(url);
  const lines = [
    `"@authority": ${target.host}`,
    `"@method": GET`,
    `"@path": ${target.pathname === '' ? '/' : target.pathname}`,
    `"@signature-params": ${params}`,
  ];
  return lines.join('\n');
}

/** The `Signature-Input` parameter string: the covered list plus the profile's parameters. */
export function signatureParams(opts: {
  created: number;
  expires: number;
  keyid: string;
  nonce: string;
}): string {
  const covered = COVERED.map((component) => `"${component}"`).join(' ');
  return `(${covered});created=${opts.created};expires=${opts.expires};keyid="${opts.keyid}";alg="ed25519";nonce="${opts.nonce}";tag="web-bot-auth"`;
}

/**
 * Build the three headers a Web Bot Auth request carries, signed with a
 * per-scan ephemeral key.
 *
 * The key is generated for this scan and thrown away. It proves nothing about
 * identity and claims nothing: the question the probe asks is whether an origin
 * rejects a request *because* it carries signature headers, and an unverifiable
 * key answers that question exactly as well as a verifiable one would.
 */
export function signedHeaders(url: string, now: number, agentDirectory: string): SignedRequestHeaders {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const created = Math.floor(now / 1000);
  const params = signatureParams({
    created,
    expires: created + LIFETIME_SECONDS,
    keyid: jwkThumbprint(publicKey.export({ format: 'pem', type: 'spki' }).toString()),
    nonce: randomBytes(16).toString('base64'),
  });
  const signature = sign(null, Buffer.from(signatureBase(url, params), 'utf8'), privateKey);
  return {
    'Signature-Input': `sig1=${params}`,
    Signature: `sig1=:${signature.toString('base64')}:`,
    'Signature-Agent': `"${agentDirectory}"`,
  };
}

export class WebBotAuthRequestToleranceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/web-bot-auth-request-tolerance',
    category: 'access-crawl-control',
    title: 'A signed agent request is not rejected for being signed',
    failureTitle: 'This site rejects requests that carry HTTP message signatures',
    description:
      'Fetches the site root twice: once plainly, and once with the RFC 9421 `Signature`, `Signature-Input` and `Signature-Agent` headers a Web Bot Auth agent sends, signed with a per-scan ephemeral Ed25519 key. Reports when the signed request is refused, truncated, or answered differently without `Vary` naming the headers that changed the answer.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/access-crawl-control/web-bot-auth-request-tolerance.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable'],
    guidance: {
      impact:
        'Web Bot Auth is how an agent says who it is in a way an origin can check, and the operators building it are the ones whose traffic you would most want to identify. An edge that answers a signed request with 400 or 403 turns that identification into a reason for refusal: the agents willing to declare themselves are the ones you turn away, and the ones that lie carry no signature headers at all and sail through. A 431 is the same outcome from a different cause — a header-size limit — and it is fixed differently.',
      fix: 'Let unknown request headers through: `Signature`, `Signature-Input` and `Signature-Agent` are additive and safe to ignore. If your edge enforces a header-size budget, raise it enough for an Ed25519 signature. If you do vary behaviour on those headers, list them in `Vary` so a shared cache cannot serve the rejected variant to everyone.',
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/web-bot-auth-request-tolerance/',
      tags: ['web-bot-auth', 'rfc9421', 'signatures', 'waf', 'crawlers'],
    },
  };

  /** Where the probe says it comes from. Not a key directory: this scan's key is ephemeral. */
  private static readonly AGENT_DIRECTORY = 'https://github.com/ForkPoint/agent-lighthouse';

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const url = `${ctx.baseUrl}/`;
    if (!(await isSafeUrl(url))) {
      return this.notApplicable(
        'The site root is not a URL this scanner will fetch.',
        'A fetchable site root',
        url,
      );
    }

    const baseline = await probeSecurityUrl(ctx, url, { followRedirects: true });
    if (!baseline || baseline.status < 200 || baseline.status >= 300) {
      return this.notApplicable(
        `The unsigned baseline answered HTTP ${baseline?.status ?? 0}, so a signed request has nothing to be compared against.`,
        'A 2xx baseline to compare the signed request against',
        `HTTP ${baseline?.status ?? 0} unsigned`,
      );
    }

    const signed = await probeSecurityUrl(ctx, url, {
      followRedirects: true,
      headers: signedHeaders(url, Date.now(), WebBotAuthRequestToleranceAudit.AGENT_DIRECTORY),
    });
    if (!signed) return this.fail('Signed probe failed', 'HTTP 200', 'No response');

    const acceptSignature = signed.headers['accept-signature'];
    const vary = (signed.headers['vary'] ?? '').toLowerCase();
    const ratio = baseline.body.length === 0 ? 1 : signed.body.length / baseline.body.length;
    const differs = signed.status !== baseline.status || ratio < COLLAPSE_RATIO;
    const varyNamesSignature = SIGNATURE_HEADERS.some((header) => vary.includes(header));

    const findings: string[] = [];
    if (differs && !varyNamesSignature) {
      findings.push(
        `the answer changed when the request was signed, and Vary${vary === '' ? ' is absent' : `: ${signed.headers['vary']}`} does not name the signature headers, so a shared cache can serve either variant to anyone`,
      );
    }

    const displayValue = `baseline ${baseline.status}, signed ${signed.status}`;
    const expected = 'A request carrying RFC 9421 signature headers is answered as the same request without them';
    const found = `Unsigned: HTTP ${baseline.status}, ${baseline.body.length} bytes. Signed: HTTP ${signed.status}, ${signed.body.length} bytes${acceptSignature ? `, Accept-Signature: ${acceptSignature}` : ''}.`;
    const details = {
      baselineStatus: baseline.status,
      signedStatus: signed.status,
      bodyRatio: Number(ratio.toFixed(3)),
      negotiatesSignatures: acceptSignature !== undefined,
      varyNamesSignatureHeaders: varyNamesSignature,
      findings,
    };

    // An origin answering 401 or 403 with Accept-Signature is not refusing the
    // signature — it is asking for one it can verify, which is the opposite of
    // the defect this audit looks for.
    if (acceptSignature !== undefined && (signed.status === 401 || signed.status === 403)) {
      return {
        ...this.pass(
          `The origin answered HTTP ${signed.status} with Accept-Signature, so it is negotiating signatures rather than rejecting them.`,
          expected,
          found,
        ),
        displayValue,
        details,
      };
    }

    if (signed.status === 431) {
      return {
        ...this.fail(
          'The signed request was answered HTTP 431: the signature headers exceed a header-size limit at the edge.',
          expected,
          found,
          'Raise the request header size limit at the edge; an Ed25519 signature and its parameters need roughly 500 bytes.',
        ),
        displayValue,
        details,
      };
    }

    if (REJECTION_STATUSES.has(signed.status)) {
      return {
        ...this.fail(
          `The unsigned request was answered HTTP ${baseline.status} and the signed one HTTP ${signed.status}: the signature headers are why it was refused.`,
          expected,
          found,
          'Let the Signature, Signature-Input and Signature-Agent request headers through; they are additive and safe to ignore.',
        ),
        displayValue,
        details,
      };
    }

    if (ratio < COLLAPSE_RATIO) {
      return {
        ...this.fail(
          `The signed request was answered HTTP ${signed.status} carrying ${Math.round(ratio * 100)}% of the unsigned body.`,
          expected,
          found,
          'Serve signed requests the same document; a shrunken body is a block wearing a 200.',
        ),
        displayValue,
        details,
      };
    }

    if (findings.length > 0) {
      return {
        ...this.warn(
          'The answer to a signed request differs from the unsigned one, and Vary does not say so.',
          expected,
          found,
          'List Signature, Signature-Input and Signature-Agent in Vary wherever they change the response.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'A request carrying RFC 9421 signature headers is answered exactly as the same request without them.',
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
