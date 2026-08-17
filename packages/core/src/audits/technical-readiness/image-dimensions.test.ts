import { describe, it, expect } from 'vitest';
import { ImageDimensionsAudit } from './image-dimensions';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ImageDimensionsAudit', () => {
  const audit = new ImageDimensionsAudit();

  it('passes when all images have width and height', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg" width="100" height="80"><img src="b.jpg" width="50" height="40"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('explicit width and height');
    expect(result.found).toContain('all with dimensions');
  });

  it('passes when there are no images', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>no images</p></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('No <img> tags found');
  });

  it('warns when at least half the images have dimensions', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg" width="100" height="80"><img src="b.jpg"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1 of 2');
  });

  it('fails when most images are missing dimensions', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg" width="100" height="80"><img src="b.jpg"><img src="c.jpg"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('2 of 3');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });

  it('uses "(inline)" label for images without src when dimensions are missing', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img alt="no src or dims"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Should fail (0 of 1 have dimensions) and show "(inline)" in found
    expect(result.status).toBe('fail');
    expect(result.found).toContain('(inline)');
  });
});
