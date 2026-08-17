import { describe, it, expect } from 'vitest';
import { DecorativeImagesAudit } from './decorative-images';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('DecorativeImagesAudit', () => {
  const audit = new DecorativeImagesAudit();

  it('passes (not applicable) when there are no decorative (empty-alt) images', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="a.jpg" alt="Described image"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No decorative images');
  });

  it('passes when all decorative images have role="presentation"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="bg.png" alt="" role="presentation"></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when a majority but not all decorative images are marked', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <img src="1.png" alt="" role="presentation">
        <img src="2.png" alt="" role="presentation">
        <img src="3.png" alt="">
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when no decorative images are marked with role="presentation"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="1.png" alt=""><img src="2.png" alt=""></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/2');
  });
});
