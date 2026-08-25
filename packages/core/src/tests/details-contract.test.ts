import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { AuditResultSchema } from '../schemas';
import { mockCheckContext, mockPageContext } from '../__tests__/test-utils';
import type { CheckContext } from '../check-context';
import type { AuditResult } from '../types';

/**
 * Every audit's `details` must survive `AuditResultSchema`.
 *
 * The runner validates each result and turns a rejection into a `scan-error`
 * stub, so an audit that attaches its own finding objects reports nothing —
 * and only on the pages where it found the most to say. That is invisible to a
 * per-audit test built on a three-element fixture: four audits shipped this way
 * and were caught by scanning real storefronts, not by the suite.
 *
 * The fixture below is deliberately hostile: enough elements to outrun the
 * 100-entry array cap, and strings long enough to outrun the 1000-character
 * entry cap.
 */

/** More sections, rows and controls than any `details` array may hold. */
const OVER_CAP = 150;

/** Longer than the schema's per-entry limit. */
const LONG_TEXT = 'agent readiness '.repeat(120);

function repeat(build: (i: number) => string): string {
  return Array.from({ length: OVER_CAP }, (_v, i) => build(i)).join('\n');
}

/**
 * A page that trips every list-shaped audit at once: unnamed click targets,
 * unlabelled inputs, a headerless table, a long section run, and text long
 * enough that any quoted excerpt overflows on its own.
 */
const TORTURE_BODY = [
  `<h1>${LONG_TEXT}</h1>`,
  repeat((i) => `<div onclick="go(${i})" class="btn-primary">${LONG_TEXT}</div>`),
  repeat((i) => `<a class="link-${i}">${LONG_TEXT}</a>`),
  repeat((i) => `<div role="switch" class="toggle-${i}">Option ${i}</div>`),
  repeat((i) => `<input type="text" id="f${i}" autocomplete="not-a-term">`),
  repeat((i) => `<h2>Section ${i}</h2><p>${LONG_TEXT}</p>`),
  `<table>${repeat((i) => `<tr><td>${i}</td><td>${LONG_TEXT}</td></tr>`)}</table>`,
  repeat((i) => `<img src="/i${i}.png">`),
  repeat((i) => `<iframe src="/f${i}"></iframe>`),
  repeat(() => `<button></button>`),
].join('');

function tortureContext(): CheckContext {
  const html = `<html lang="en"><head><title>${LONG_TEXT}</title></head><body>${TORTURE_BODY}</body></html>`;
  return mockCheckContext([
    mockPageContext('https://example.com/', html),
    mockPageContext('https://example.com/products/hat', html, 1),
    mockPageContext('https://example.com/collections/all', html, 2),
  ]);
}

const registrations = Object.values(defaultConfig.audits).flat();

describe('details contract', () => {
  it('registers audits to check', () => {
    expect(registrations.length).toBeGreaterThan(200);
  });

  // One shared context: building the torture DOM per audit costs more than the
  // whole rest of the file, and no audit mutates it.
  const ctx = tortureContext();

  for (const registration of registrations) {
    const { id } = registration.meta;

    it(`${id}: emits details the schema accepts`, async () => {
      let result: AuditResult;
      try {
        result = await registration.create().audit(ctx);
      } catch (err) {
        // An audit that throws is a separate defect; the runner already stubs
        // it, and the per-audit suites cover behaviour. Only shape is in scope.
        expect.fail(`threw instead of returning a result: ${String(err)}`);
      }

      const parsed = AuditResultSchema.safeParse(result);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .slice(0, 5)
          .join('; ');
        expect.fail(`result rejected by AuditResultSchema — ${issues}`);
      }
    });
  }
});
