import { describe, it, expect } from 'vitest';
import { registrableDomain, registrableOf } from './domains';

describe('domains gatherer', () => {
  it('reduces a host to its registrable name', () => {
    expect(registrableDomain('www.example.com')).toBe('example.com');
    expect(registrableDomain('example.com')).toBe('example.com');
    expect(registrableDomain('a.b.c.example.com')).toBe('example.com');
  });

  it('keeps the third label under a two-label public suffix', () => {
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('example.com.au')).toBe('example.com.au');
  });

  it('reads the registrable domain out of a URL', () => {
    expect(registrableOf('https://about.google/intl/en/')).toBe('about.google');
    expect(registrableOf('not a url')).toBe('');
  });
});
