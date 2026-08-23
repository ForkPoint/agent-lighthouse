import { describe, it, expect, vi } from 'vitest';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import {
  WebBotAuthRequestToleranceAudit,
  signatureBase,
  signatureParams,
  signedHeaders,
  jwkThumbprint,
} from './web-bot-auth-request-tolerance';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions, FetchResult } from '../../fetcher';
import type { AuditResult } from '../../types';

vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const PAGE = `<html><body><main><p>${'the full document '.repeat(50)}</p></main></body></html>`;
const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

interface RunOptions {
  baseline?: () => FetchResult;
  signed?: () => FetchResult;
}

function run(options: RunOptions = {}) {
  const audit = new WebBotAuthRequestToleranceAudit();
  const ctx = mockCheckContext([mockPageContext('https://example.com/', PAGE)]);
  const requests: FetchOptions[] = [];
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const isSigned = o.headers?.['Signature'] !== undefined;
    if (isSigned) return options.signed ? options.signed() : mockFetchResult(PAGE, 200, 'text/html');
    return options.baseline ? options.baseline() : mockFetchResult(PAGE, 200, 'text/html');
  };
  return { result: audit.audit(ctx), requests };
}

const answer = (status: number, headers: Record<string, string> = {}, body = PAGE) => () => {
  const result = mockFetchResult(body, status, 'text/html');
  Object.assign(result.headers, headers);
  return result;
};

describe('web-bot-auth signature construction', () => {
  it('builds the RFC 9421 signature base over authority, method and path', () => {
    const params = signatureParams({ created: 100, expires: 400, keyid: 'abc', nonce: 'nnn' });
    expect(signatureBase('https://example.com/docs', params)).toBe(
      [
        '"@authority": example.com',
        '"@method": GET',
        '"@path": /docs',
        `"@signature-params": ${params}`,
      ].join('\n'),
    );
  });

  it('carries the profile’s parameters, tag included', () => {
    const params = signatureParams({ created: 100, expires: 400, keyid: 'abc', nonce: 'nnn' });
    expect(params).toBe(
      '("@authority" "@method" "@path");created=100;expires=400;keyid="abc";alg="ed25519";nonce="nnn";tag="web-bot-auth"',
    );
  });

  it('signs exactly the base it emits, and names the key by its JWK thumbprint', () => {
    const headers = signedHeaders('https://example.com/', 1_700_000_000_000, 'https://agent.example');
    const params = headers['Signature-Input'].replace(/^sig1=/, '');
    expect(params).toContain('tag="web-bot-auth"');
    expect(params).toMatch(/keyid="[A-Za-z0-9_-]{43}"/);
    expect(headers['Signature']).toMatch(/^sig1=:[A-Za-z0-9+/=]+:$/);
    expect(headers['Signature-Agent']).toBe('"https://agent.example"');
    // Ed25519 signatures are 64 bytes.
    const raw = Buffer.from(headers['Signature'].slice('sig1=:'.length, -1), 'base64');
    expect(raw).toHaveLength(64);
  });

  it('computes the thumbprint over the three required JWK members', () => {
    const { publicKey } = generateKeyPairSync('ed25519');
    const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const thumbprint = jwkThumbprint(pem);
    expect(thumbprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(jwkThumbprint(createPublicKey(pem).export({ format: 'pem', type: 'spki' }).toString())).toBe(thumbprint);
  });
});

describe('WebBotAuthRequestToleranceAudit', () => {
  const audit = new WebBotAuthRequestToleranceAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('sends exactly two requests, one of them signed', async () => {
    const { result, requests } = run();
    await result;
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers).toBeUndefined();
    expect(Object.keys(requests[1]?.headers ?? {})).toEqual([
      'Signature-Input',
      'Signature',
      'Signature-Agent',
    ]);
  });

  it('passes when the signed request is answered the same way', async () => {
    const { result } = run();
    expect((await result).status).toBe('pass');
  });

  it('fails a 400, 403 or 421 answered only to the signed request', async () => {
    for (const status of [400, 403, 421]) {
      const { result } = run({ signed: answer(status, {}, '') });
      const r = await result;
      expect(r.status, `status ${status}`).toBe('fail');
      expect(r.message).toContain(`HTTP ${status}`);
    }
  });

  it('reports a 431 as its own finding', async () => {
    const { result } = run({ signed: answer(431, {}, '') });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(r.message).toContain('header-size limit');
    expect(r.remediation).toContain('header size limit');
  });

  it('fails a 200 whose body collapsed', async () => {
    const { result } = run({ signed: answer(200, {}, '<html><body>nope</body></html>') });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(r.details?.['bodyRatio']).toBeLessThan(0.4);
  });

  it('treats a 403 carrying Accept-Signature as negotiation, not rejection', async () => {
    const { result } = run({ signed: answer(403, { 'accept-signature': 'sig1=("@authority")' }, '') });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['negotiatesSignatures']).toBe(true);
  });

  it('reports behaviour varying on the signature headers without Vary naming them', async () => {
    const { result } = run({ signed: answer(204, {}, PAGE) });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'findings')[0]).toContain('shared cache');

    const declared = run({ signed: answer(204, { vary: 'Signature-Agent' }, PAGE) });
    expect((await declared.result).status).toBe('pass');
  });

  it('is notApplicable when the unsigned baseline is not 2xx', async () => {
    const { result } = run({ baseline: answer(503, {}, '') });
    expect((await result).status).toBe('na');
  });

  it('says a pass means the door is not nailed shut, not that signatures are verified', () => {
    expect(WebBotAuthRequestToleranceAudit.meta.description).not.toContain('verifies');
    expect(WebBotAuthRequestToleranceAudit.meta.guidance?.impact).toContain('identification');
  });

  it('is a scored grade B audit with an id inside the cap', () => {
    const { meta } = WebBotAuthRequestToleranceAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
