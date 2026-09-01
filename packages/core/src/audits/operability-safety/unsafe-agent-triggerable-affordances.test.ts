import { describe, it, expect, vi } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { UnsafeAgentTriggerableAffordancesAudit } from './unsafe-agent-triggerable-affordances';
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockFetchResult,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

function page(body: string, robots?: string): CheckContext {
  return mockCheckContext(
    [mockPageContext('https://example.com/', `<html><head></head><body>${body}</body></html>`)],
    robots ? { '/robots.txt': mockFetchResult(robots, 200) } : {},
  );
}

describe('UnsafeAgentTriggerableAffordancesAudit', () => {
  const audit = new UnsafeAgentTriggerableAffordancesAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes a page with no state-verb link', async () => {
    const result = await audit.audit(page('<a href="/products">Products</a>'));
    expect(result.status).toBe('pass');
  });

  it('fails a GET link that deletes something', async () => {
    const result = await audit.audit(page('<a href="/?action=delete&id=7">Delete</a>'));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('action=delete');
  });

  it('accepts the same link behind a confirmation attribute', async () => {
    const result = await audit.audit(
      page('<a href="/?action=delete&id=7" data-turbo-confirm="Are you sure?">Delete</a>'),
    );
    expect(result.status).toBe('pass');
  });

  // rel=nofollow is the documented minimum mitigation for this exact case.
  it('accepts the same link marked rel="nofollow"', async () => {
    const result = await audit.audit(page('<a href="/?action=delete&id=7" rel="nofollow">Delete</a>'));
    expect(result.status).toBe('pass');
  });

  it('accepts the same URL when it is submitted by a POST form', async () => {
    const result = await audit.audit(
      page('<form method="post" action="/?action=delete&id=7"><button>Delete</button></form>'),
    );
    expect(result.status).toBe('pass');
  });

  it('fails a bare /logout link on the path-pattern arm', async () => {
    const result = await audit.audit(page('<a href="/logout">Sign out</a>'));
    expect(result.status).toBe('fail');
  });

  it('fails an add-to-cart GET link', async () => {
    const result = await audit.audit(page('<a href="/add-to-cart?sku=1">Add to cart</a>'));
    expect(result.status).toBe('fail');
  });

  // A GET form is replayable from the query string, but it is at least a form.
  it('warns rather than fails on a GET form with a state-verb action', async () => {
    const result = await audit.audit(
      page('<form method="get" action="/unsubscribe"><button>Unsubscribe</button></form>'),
    );
    expect(result.status).toBe('warn');
  });

  it('still reports a disallowed path and says the mitigation is partial', async () => {
    const result = await audit.audit(
      page('<a href="/logout">Sign out</a>', 'User-agent: *\nDisallow: /logout\n'),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('robots.txt');
    expect(result.details?.['disallowedPaths']).toBe(1);
  });

  // Following the link would perform the action this audit exists to report.
  it('never fetches a flagged URL', async () => {
    const ctx = page('<a href="/?action=delete&id=7">Delete</a>');
    const spy = vi.fn(async () => mockFetchResult('', 200));
    ctx.fetch = spy;
    await audit.audit(ctx);
    expect(spy).not.toHaveBeenCalled();
  });

  it('registers as a scored grade-B audit with critical priority', () => {
    const { meta } = UnsafeAgentTriggerableAffordancesAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.defaultPriority).toBe('critical');
    expect(meta.scoreDisplayMode).toBe('ternary');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new UnsafeAgentTriggerableAffordancesAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      UnsafeAgentTriggerableAffordancesAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === UnsafeAgentTriggerableAffordancesAudit.meta.id)
        ?.status,
    ).toBe('na');
  });

  // Links and GET forms live in the body. A shell exposes none, so "nothing here
  // changes state on a GET" is silence rather than safety.
  it('declines a page that served no readable text', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new UnsafeAgentTriggerableAffordancesAudit();
    const rendered = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(rendered.status, 'the same input rendered is judged').not.toBe('na');

    const shell = await instance.audit(shellSiteContext());
    expect(shell.status).toBe('na');
  });
});
