import { describe, it, expect } from 'vitest';
import { tierMarker } from './tier-marker';

describe('tierMarker', () => {
  it('marks an informative check as advisory', () => {
    expect(tierMarker('informative')).toContain('(advisory)');
  });

  it('marks an experimental check', () => {
    expect(tierMarker('experimental')).toContain('(experimental)');
  });

  it('says nothing for a scored check or an unknown tier', () => {
    expect(tierMarker('scored')).toBe('');
    expect(tierMarker(undefined)).toBe('');
  });
});
