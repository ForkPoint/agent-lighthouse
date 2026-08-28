import { describe, it, expect } from 'vitest';
import { ThirdPartyDomWriteBlastRadiusAudit } from './third-party-dom-write-blast-radius';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

/** A page whose CSP arrives in the response header, as most sites deliver it. */
function page(body: string, csp?: string, head = ''): CheckContext {
  const ctx = mockCheckContext([
    mockPageContext('https://example.com/', `<html><head>${head}</head><body>${body}</body></html>`),
  ]);
  if (csp) ctx.pages[0]!.fetchResult.headers = { 'content-security-policy': csp };
  return ctx;
}

/** N third-party script tags, each on its own registrable domain. */
const vendors = (n: number) =>
  Array.from({ length: n }, (_v, i) => `<script src="https://vendor${i}.example${i}.com/t.js"></script>`).join('');

describe('ThirdPartyDomWriteBlastRadiusAudit', () => {
  const audit = new ThirdPartyDomWriteBlastRadiusAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes a page that loads no third-party script', async () => {
    const result = await audit.audit(page('<script src="/app.js"></script>'));
    expect(result.status).toBe('pass');
    expect(result.details?.['origins']).toBe(0);
  });

  it('passes one third-party script under a nonce-based script-src', async () => {
    const result = await audit.audit(
      page('<script src="https://cdn.vendor.com/t.js"></script>', "script-src 'self' 'nonce-abc'"),
    );
    expect(result.status).toBe('pass');
  });

  it('fails one third-party script with no CSP and no integrity', async () => {
    const result = await audit.audit(page('<script src="https://cdn.vendor.com/t.js"></script>'));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('vendor.com');
  });

  // A scheme-wide source allows every host on the internet that speaks https.
  it('fails a script-src whose only sources are unsafe-inline and a scheme', async () => {
    const result = await audit.audit(
      page('<script src="https://cdn.vendor.com/t.js"></script>', "script-src 'unsafe-inline' https:"),
    );
    expect(result.status).toBe('fail');
  });

  it('reads a CSP delivered by meta http-equiv as well as by header', async () => {
    const result = await audit.audit(
      page(
        '<script src="https://cdn.vendor.com/t.js"></script>',
        undefined,
        `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'nonce-abc'">`,
      ),
    );
    expect(result.status).toBe('pass');
  });

  it('tiers the warning by the count of uncontrolled origins', async () => {
    const csp = "script-src 'self' https://vendor0.example0.com";
    const three = await audit.audit(page(vendors(3), csp));
    const nine = await audit.audit(page(vendors(9), csp));
    const eleven = await audit.audit(page(vendors(11), csp));
    expect(three.details?.['tier']).toBe('1-3');
    expect(nine.details?.['tier']).toBe('4-9');
    expect(eleven.details?.['tier']).toBe('10+');
  });

  it('names every registrable domain in found', async () => {
    const result = await audit.audit(
      page('<script src="https://cdn.vendor.com/t.js"></script><script src="https://tags.other.com/t.js"></script>'),
    );
    expect(result.found).toContain('vendor.com');
    expect(result.found).toContain('other.com');
  });

  // Two hosts under one company is one company that can write to the page.
  it('groups two hosts under one registrable domain as a single origin', async () => {
    const result = await audit.audit(
      page(
        '<script src="https://cdn.vendor.com/a.js"></script><script src="https://static.vendor.com/b.js"></script>',
      ),
    );
    expect(result.details?.['origins']).toBe(1);
  });

  it('reports a cross-origin iframe with no sandbox and its dimensions', async () => {
    const result = await audit.audit(
      page('<iframe src="https://widget.other.com/w" width="600" height="400"></iframe>'),
    );
    expect(result.details?.['unsandboxedFrames']).toBe(1);
    expect(result.found).toContain('600');
  });

  // The runtime count is usually larger. Saying so keeps the number honest.
  it('says in found that runtime-injected tags are not counted', async () => {
    const result = await audit.audit(page('<script src="https://cdn.vendor.com/t.js"></script>'));
    expect(result.found).toContain('runtime');
    expect(ThirdPartyDomWriteBlastRadiusAudit.meta.description).not.toContain('tag manager');
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = ThirdPartyDomWriteBlastRadiusAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.scoreDisplayMode).toBe('ternary');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ThirdPartyDomWriteBlastRadiusAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });

  // `requires` deliberately omits `rendered-body`: an origin named in the
  // served HTML is counted whether or not the body renders. An empty census is
  // the half a shell cannot support — same-origin bundles are discarded, and
  // the vendors an agent meets are injected by that bundle at runtime — so
  // that branch declines instead of certifying the page.
  it('counts the origins a shell names, and declines when it names none', async () => {
    const vendor =
      '<html lang="en"><head><title>Shop</title>' +
      '<script src="https://cdn.vendor.test/tag.js"></script></head>' +
      '<body><div id="root"></div><script src="/app.js"></script></body></html>';
    const audit = new ThirdPartyDomWriteBlastRadiusAudit();

    const named = await audit.audit(shellSiteContext(vendor));
    expect(named.status, 'an origin in the served HTML is still judged').not.toBe('na');
    expect(named.found).toContain('vendor.test');

    const empty = await audit.audit(shellSiteContext());
    expect(empty.status).toBe('na');
  });
});
