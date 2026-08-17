import { describe, it, expect } from 'vitest';
import { ImageAltTextAudit } from './image-alt-text';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ImageAltTextAudit', () => {
  const audit = new ImageAltTextAudit();

  it('passes (not applicable) when there are no non-decorative images', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="bg.png" alt="" role="presentation"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No non-decorative images');
  });

  it('passes when 100% of non-decorative images have alt text', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg" alt="A blue shoe"><img src="b.jpg" alt="A red hat"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2/2');
  });

  it('warns when coverage is at least 80% but below 100%', () => {
    const imgs =
      Array.from({ length: 4 }, (_, i) => `<img src="${i}.jpg" alt="desc ${i}">`).join('') +
      '<img src="x.jpg" alt=" ">'; // whitespace-only alt counts as missing
    const page = mockPageContext('https://example.com', `<html><body>${imgs}</body></html>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('4/5');
  });

  it('fails when coverage is below 80%', () => {
    // Images with no alt attribute at all are real failures and count against coverage.
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg"><img src="b.jpg"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/2');
  });

  it('excludes explicitly decorative alt="" images from coverage (deferred to 6.16)', () => {
    // Three decorative `alt=""` images plus one informative image. The decorative
    // images must be excluded from the denominator, leaving 1/1 = 100% coverage
    // rather than 1/4 = 25%.
    const page = mockPageContext(
      'https://example.com',
      '<html><body>' +
        '<img src="d1.png" alt=""><img src="d2.png" alt=""><img src="d3.png" alt="">' +
        '<img src="hero.jpg" alt="A blue running shoe">' +
        '</body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('passes (not applicable) when every image is decorative alt=""', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="d1.png" alt=""><img src="d2.png" alt=""></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No non-decorative images');
  });

  it('still counts images with a missing alt attribute alongside decorative alt=""', () => {
    // alt="" is decorative (excluded); a missing alt attribute is a real failure (counted).
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="dec.png" alt=""><img src="broken.jpg"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });
});
