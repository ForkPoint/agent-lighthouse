import { describe, it, expect } from 'vitest';
import { FormErrorMessagesAudit } from './form-error-messages';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

const page = (html: string, url = 'https://example.com/signup') =>
  mockPageContext(url, `<html lang="en"><body>${html}</body></html>`);

describe('FormErrorMessagesAudit', () => {
  const audit = new FormErrorMessagesAudit();

  it('returns na on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe('applicability', () => {
    it('is na when no field declares a validation constraint', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="q" type="text">
            <textarea id="notes"></textarea>
          </form>`),
        ]),
      );
      expect(result.status).toBe('na');
      expect(result.found).toContain('No required or invalid-state field');
    });

    it('is na when the page has no fields at all', () => {
      const result = audit.audit(mockCheckContext([page('<p>brochure</p>')]));
      expect(result.status).toBe('na');
    });

    it('ignores hidden, submit, button, reset and image controls', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input type="hidden" name="csrf" required>
            <input type="submit" value="Go" required>
            <input type="button" value="X" required>
            <input type="reset" value="R" required>
            <input type="image" src="/go.png" required>
          </form>`),
        ]),
      );
      expect(result.status).toBe('na');
    });
  });

  describe('invalid-state population (the direct measurement)', () => {
    it('passes when every aria-invalid field resolves an aria-errormessage', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" aria-invalid="true" aria-errormessage="email-err">
            <span id="email-err">Enter a valid email.</span>
            <input id="name" required aria-describedby="name-hint">
            <span id="name-hint">Your full name.</span>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 of 1');
      expect(result.found).toContain('invalid-state');
    });

    // The old audit warned here and told the site to add aria-describedby,
    // which is actively wrong guidance for correct ARIA 1.2 error wiring.
    it('does not warn about aria-describedby when aria-errormessage is used', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" aria-invalid="true" aria-errormessage="email-err">
            <span id="email-err" role="alert">Enter a valid email.</span>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
      expect(result.message).not.toContain('aria-describedby.');
    });

    it('fails when an invalid-state field points at nothing', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" aria-invalid="true">
          </form>`),
        ]),
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('0 of 1');
    });

    it('fails when the referenced message element does not exist', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" aria-invalid="true" aria-errormessage="nope">
          </form>`),
        ]),
      );
      expect(result.status).toBe('fail');
    });

    it('warns on partial coverage of invalid-state fields', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="a" aria-invalid="true" aria-errormessage="a-err">
            <span id="a-err">bad</span>
            <input id="b" aria-invalid="true">
          </form>`),
        ]),
      );
      expect(result.status).toBe('warn');
      expect(result.found).toContain('1 of 2');
    });

    // aria-invalid="false" is the valid state and must not enter the population.
    it('treats aria-invalid="false" as not invalid', () => {
      const result = audit.audit(
        mockCheckContext([page('<form><input id="a" aria-invalid="false"></form>')]),
      );
      expect(result.status).toBe('na');
    });

    it('prefers the invalid-state population over required fields', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="a" aria-invalid="true" aria-errormessage="a-err">
            <span id="a-err">bad</span>
            <input id="b" required>
            <input id="c" required>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 of 1');
    });
  });

  describe('required-field population (the observable proxy)', () => {
    it('passes when every required field resolves a description', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" required aria-describedby="email-help">
            <span id="email-help">We never share it.</span>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('required');
    });

    it('accepts aria-required="true" as a constraint', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="email" aria-required="true" aria-errormessage="e">
            <span id="e">msg</span>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
    });

    // The vacuous pass the code review found: 1 of 240 wired inputs used to
    // pass the whole site.
    it('warns rather than passing when only one of many required fields is wired', () => {
      const inputs = Array.from(
        { length: 9 },
        (_, i) => `<input id="f${i}" required>`,
      ).join('');
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="wired" required aria-describedby="hint"><span id="hint">help</span>
            ${inputs}
          </form>`),
        ]),
      );
      expect(result.status).toBe('warn');
      expect(result.found).toContain('1 of 10');
    });

    it('fails when no required field is wired at all', () => {
      const result = audit.audit(
        mockCheckContext([page('<form><input id="a" required><input id="b" required></form>')]),
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('0 of 2');
    });
  });

  describe('robustness fixes from the code review', () => {
    // React/modern sites render fieldsets with no <form> wrapper and submit via
    // JS; the old selector saw "no form inputs" and returned na.
    it('counts fields that are not inside a <form>', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<div class="signup">
            <input id="email" required>
            <input id="pass" required>
          </div>`),
        ]),
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('0 of 2');
    });

    // Ids are untrusted page content; the old code interpolated them into a
    // cheerio selector, which throws or silently misses on metacharacters.
    it('resolves ids containing selector metacharacters', () => {
      const result = audit.audit(
        mockCheckContext([
          page(`<form>
            <input id="a" required aria-describedby="weird]id\\x">
            <span id="weird]id\\x">help</span>
          </form>`),
        ]),
      );
      expect(result.status).toBe('pass');
    });

    it('attributes the result to the page it was measured on', () => {
      const result = audit.audit(
        mockCheckContext([
          page('<p>home</p>', 'https://example.com/'),
          page('<form><input id="a" required></form>', 'https://example.com/contact'),
        ]),
      );
      expect(result.pageUrl).toBe('https://example.com/contact');
    });

    it('aggregates every scanned page into one ratio', () => {
      const result = audit.audit(
        mockCheckContext([
          page('<form><input id="a" required aria-describedby="h"><span id="h">x</span></form>'),
          page('<form><input id="b" required></form>', 'https://example.com/contact'),
        ]),
      );
      expect(result.status).toBe('warn');
      expect(result.found).toContain('1 of 2');
    });
  });

  describe('meta contract', () => {
    const meta = FormErrorMessagesAudit.meta;

    it('keeps the id, and stays grade A / scored / weight 1.0', () => {
      expect(meta.id).toBe('operability-safety/form-error-messages');
      expect(meta.evidenceGrade).toBe('A');
      expect(meta.tier).toBe('scored');
      expect(meta.weight).toBe(1.0);
    });

    // The dossier's required fix: it must stop being titled and described as a
    // measurement of live error messages, which a GET can never observe.
    it('no longer claims to observe error messages', () => {
      const copy = [meta.title, meta.failureTitle, meta.description, meta.guidance?.impact]
        .join(' ')
        .toLowerCase();
      expect(copy).not.toContain('error messages linked');
      expect(copy).toContain('aria-errormessage');
    });
  });
});
