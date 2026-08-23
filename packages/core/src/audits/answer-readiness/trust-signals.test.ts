import { describe, it, expect } from 'vitest';
import { TrustSignalsAudit } from './trust-signals';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

function homepage(body: string, htmlAttrs = '') {
  return mockPageContext('https://example.com/', `<html${htmlAttrs}><body>${body}</body></html>`);
}

const CITATIONS = `
  <p>Independent benchmarks confirm the figure
    (<a href="https://www.nist.gov/report">NIST report</a>,
     <a href="https://arxiv.org/abs/2605.25517">arXiv 2605.25517</a>).</p>`;

/** Machine-readable review data — the fact `review-signals` owns. */
const REVIEW_MARKUP =
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization",' +
  '"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"1204"}}</script>';

describe('TrustSignalsAudit', () => {
  const audit = new TrustSignalsAudit();

  it('is notApplicable when the scan contains no homepage', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><p>Body.</p></body></html>',
      1,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('is notApplicable on a non-English homepage instead of failing it', () => {
    const page = homepage(
      '<p>Von über 12.000 Unternehmen genutzt. Kundenbewertungen 4,8 von 5.</p>',
      ' lang="de"',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('fails a homepage carrying none of the measured factors', () => {
    const page = homepage('<main><p>We build software.</p></main>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('ignores promotional puffery — the study found no consistent benefit', () => {
    const page = homepage(`<main>
        <p>Free shipping and secure checkout on every order.</p>
        <p>Money-back guarantee. Sustainable, organic, handcrafted and handmade.</p>
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('does not pass on ordinary site chrome (a Partners nav link plus a shipping banner)', () => {
    const page = homepage(`
      <header><nav><a href="/partners">Partners</a><a href="/clients">Clients</a></nav></header>
      <div class="banner">Free shipping over $50</div>
      <main><p>Welcome.</p></main>
      <footer><p>Certified. As seen in the press. Awards.</p></footer>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('warns when exactly one measured factor is present', () => {
    const page = homepage('<main><p>Trusted by 12,000 companies.</p></main>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
  });

  it('passes on quantified social proof plus evidence-backed claims', () => {
    const page = homepage(`<main>
        <p>Rated 4.8 out of 5 across 1,204 reviews.</p>
        ${CITATIONS}
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  // "1 / 5" is what a slider prints under its arrows. Reading it as a 1-star
  // rating credited a site for social proof it never published.
  it('does not read a carousel counter as a rating', () => {
    const page = homepage(`<main>
        <div class="carousel"><span>1 / 5</span></div>
        ${CITATIONS}
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).not.toContain('quantified social proof');
  });

  it('still counts a whole-number rating stated as a rating', () => {
    const page = homepage(`<main>
        <p>Rated 4 out of 5 stars by our customers.</p>
        ${CITATIONS}
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('counts a comparison table as comparison content', () => {
    const page = homepage(`<main>
        <p>Rated 4.8 out of 5 across 1,204 reviews.</p>
        <table><thead><tr><th>Feature</th><th>Us</th><th>Them</th></tr></thead>
          <tbody><tr><td>Price</td><td>$10</td><td>$20</td></tr></tbody></table>
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('defers the social-proof factor to review-signals when review markup is present', () => {
    const page = homepage(`<main>
        <p>Rated 4.8 out of 5 across 1,204 reviews.</p>
        ${CITATIONS}
        ${REVIEW_MARKUP}
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.found).toContain('answer-readiness/review-signals');
    // The deferral is an attribution change, not a penalty: this is the same
    // page as the "quantified social proof plus evidence" case above.
    expect(result.status).toBe('pass');
  });

  it('does not let valid AggregateRating markup score worse than its absence', () => {
    const body = `<main>
        <p>Rated 4.8 out of 5 across 1,204 reviews.</p>
        ${CITATIONS}
      </main>`;
    const without = audit.audit(mockCheckContext([homepage(body)]));
    const withMarkup = audit.audit(mockCheckContext([homepage(`${body}${REVIEW_MARKUP}`)]));
    expect(without.status).toBe('pass');
    expect(withMarkup.status).toBe('pass');
    expect(withMarkup.score).toBeGreaterThanOrEqual(without.score);
  });

  it('warns rather than fails when review markup is the only factor present', () => {
    // Boundary: the deferred factor is known-present, just scored elsewhere,
    // so a bare page carrying valid markup cannot report "none found".
    const bare = audit.audit(mockCheckContext([homepage('<main><p>We build software.</p></main>')]));
    const withMarkup = audit.audit(
      mockCheckContext([homepage(`<main><p>We build software.</p>${REVIEW_MARKUP}</main>`)]),
    );
    expect(bare.status).toBe('fail');
    expect(withMarkup.status).toBe('warn');
    expect(withMarkup.score).toBeGreaterThan(bare.score);
  });

  it('still requires a second factor alongside review markup to pass', () => {
    const page = homepage(`<main><p>Great software.</p>${REVIEW_MARKUP}</main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).not.toBe('pass');
  });

  it('does not count social or share links as evidence-backed citations', () => {
    const page = homepage(`<main>
        <p>Trusted by 12,000 companies.</p>
        <a href="https://twitter.com/example">Twitter</a>
        <a href="https://www.facebook.com/example">Facebook</a>
        <a href="https://www.linkedin.com/company/example">LinkedIn</a>
      </main>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
  });

  it('is scoped to the homepage and demoted to the "smaller gains" tier', () => {
    const meta = TrustSignalsAudit.meta;
    expect(meta.applicablePageTypes).toEqual(['homepage']);
    expect(meta.defaultPriority).toBe('low');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
  });
});
