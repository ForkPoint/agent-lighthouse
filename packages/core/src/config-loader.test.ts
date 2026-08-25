import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, loadConfigFile } from './config-loader';

/**
 * Config file discovery.
 *
 * `loadConfigFile` runs before anything else the CLI does, and it decides
 * silently: an unparsable file at a default name warns and falls through, while
 * the same file named explicitly must fail loudly. Those two paths are the ones
 * worth pinning — a scan that quietly ignored the operator's config would
 * report a score against the wrong settings.
 */

let dir: string;
let previousCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'al-config-'));
  previousCwd = process.cwd();
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(previousCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function write(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body, 'utf8');
  return path;
}

describe('defineConfig', () => {
  it('returns the config unchanged — it exists only for the type', () => {
    const config = { url: 'https://shop.test', minScore: 80 };
    expect(defineConfig(config)).toEqual(config);
  });
});

describe('loadConfigFile', () => {
  it('returns an empty config when no file exists', () => {
    expect(loadConfigFile()).toEqual({});
  });

  it('reads an explicitly named file', () => {
    const path = write('custom.json', JSON.stringify({ url: 'https://shop.test' }));
    expect(loadConfigFile(path)).toEqual({ url: 'https://shop.test' });
  });

  it('resolves a relative explicit path against the working directory', () => {
    write('custom.json', JSON.stringify({ minScore: 90 }));
    expect(loadConfigFile('custom.json')).toEqual({ minScore: 90 });
  });

  // Loudly, because the operator named this file: falling back to defaults
  // would scan with settings they never asked for.
  it('throws when the explicitly named file is absent', () => {
    expect(() => loadConfigFile('nope.json')).toThrow(/Config file not found at:/);
  });

  it('throws when the explicitly named file is not JSON', () => {
    const path = write('custom.json', '{ not json');
    expect(() => loadConfigFile(path)).toThrow();
  });

  it.each([
    'agent-lighthouse.config.json',
    '.agent-lighthouserc.json',
    '.agent-lighthouserc',
  ])('discovers %s in the working directory', (name) => {
    write(name, JSON.stringify({ preset: 'ecommerce' }));
    expect(loadConfigFile()).toEqual({ preset: 'ecommerce' });
  });

  it('prefers agent-lighthouse.config.json over the rc files', () => {
    write('agent-lighthouse.config.json', JSON.stringify({ url: 'https://first.test' }));
    write('.agent-lighthouserc.json', JSON.stringify({ url: 'https://second.test' }));
    expect(loadConfigFile().url).toBe('https://first.test');
  });

  it('warns and tries the next name when a discovered file is unparsable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    write('agent-lighthouse.config.json', '{ not json');
    write('.agent-lighthouserc.json', JSON.stringify({ url: 'https://second.test' }));

    expect(loadConfigFile().url).toBe('https://second.test');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('agent-lighthouse.config.json'),
      expect.anything(),
    );
  });

  it('returns an empty config when every discovered file is unparsable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    write('agent-lighthouse.config.json', '{ not json');
    expect(loadConfigFile()).toEqual({});
  });

  it('keeps every field the config declares', () => {
    write(
      'agent-lighthouse.config.json',
      JSON.stringify({
        url: 'https://shop.test',
        preset: 'ecommerce',
        categories: ['agent-interfaces'],
        minScore: 75,
        assertCategories: { 'agent-interfaces': 80 },
        output: ['json'],
        outputDir: './out',
        maxPages: 12,
      }),
    );
    expect(loadConfigFile()).toMatchObject({
      url: 'https://shop.test',
      preset: 'ecommerce',
      categories: ['agent-interfaces'],
      minScore: 75,
      assertCategories: { 'agent-interfaces': 80 },
      output: ['json'],
      outputDir: './out',
      maxPages: 12,
    });
  });
});
