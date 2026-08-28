import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { HOSTILE_STATES, NOTHING_OBTAINED, ROOT_PATHS, SHELL_STATE } from './hostile-states';
import { EVIDENCE_KEYS } from '../scan-evidence';

describe('hostile scan states', () => {
  it('offers six states, five of which hold no evidence about the site', () => {
    expect(HOSTILE_STATES).toHaveLength(6);
    expect(NOTHING_OBTAINED).toHaveLength(5);
    expect(SHELL_STATE.nothingObtained).toBe(false);
  });

  it('agrees with buildScanEvidence about which keys are unmet', () => {
    for (const state of HOSTILE_STATES) {
      const { met } = state.build().evidence;
      const unmet = EVIDENCE_KEYS.filter((key) => !met[key]);
      expect([...unmet].sort(), state.name).toEqual([...state.missing].sort());
    }
  });

  it('attaches a reason to every unmet key', () => {
    for (const state of HOSTILE_STATES) {
      const { reasons } = state.build().evidence;
      for (const key of state.missing) {
        expect(reasons[key], `${state.name}/${key}`).toBeTruthy();
      }
    }
  });

  it('leaves no nothing-obtained state judgeable, and leaves the shell judgeable', () => {
    // `judgeable` is the gate's own rule. A scan that never reached the site
    // cannot carry a verdict about it; a shell was still the site answering.
    for (const state of NOTHING_OBTAINED) {
      expect(state.build().evidence.judgeable, state.name).toBe(false);
    }
    expect(SHELL_STATE.build().evidence.judgeable).toBe(true);
  });

  it('hands over no pages when the request was refused', () => {
    for (const name of ['blocked', 'throttled']) {
      const ctx = HOSTILE_STATES.find((s) => s.name === name)!.build();
      expect(ctx.pages, name).toEqual([]);
    }
  });

  it('hands over one page that is not the site when the origin answered', () => {
    // The orchestrator filters pages on `status === 200 && body` with no
    // content-type gate, so a parking page and a PDF both reach the audits.
    // These are where a vacuous pass hides, so the states must reproduce them.
    for (const name of ['redirected-away', 'non-html']) {
      const ctx = HOSTILE_STATES.find((s) => s.name === name)!.build();
      expect(ctx.pages, name).toHaveLength(1);
      expect(ctx.evidence.met['origin-reachable'], name).toBe(false);
    }
  });

  it('lets the parked page render text the audits must still not score', () => {
    const parked = HOSTILE_STATES.find((s) => s.name === 'redirected-away')!.build();
    expect(parked.evidence.met['rendered-body']).toBe(true);
    expect(parked.evidence.met['sample-adequate']).toBe(true);
    expect(parked.evidence.judgeable).toBe(false);
  });

  it('hands the shell state one page that rendered no text', () => {
    const ctx = SHELL_STATE.build();
    expect(ctx.pages).toHaveLength(1);
    expect(Object.values(ctx.evidence.renderedByPage)).toEqual([false]);
  });

  it('reaches the requested host on the 200 challenge and is still refused', () => {
    // The state the other four cannot express: everything about the response
    // says "the site answered" — 200, text/html, the requested host, so
    // `origin-reachable` is met — and the scan was still turned away. An audit
    // whose only guard is `origin-reachable` reports the interstitial as the
    // site's own markup, which is how a challenge page's `noindex,nofollow`
    // became a critical finding against the owner's homepage.
    const ctx = HOSTILE_STATES.find((s) => s.name === 'challenged-at-200')!.build();
    expect(ctx.pages).toHaveLength(1);
    expect(ctx.pages[0]!.fetchResult.status).toBe(200);
    expect(ctx.evidence.met['origin-reachable']).toBe(true);
    expect(ctx.evidence.met['unblocked-fetches']).toBe(false);
    expect(ctx.evidence.judgeable).toBe(false);
    // The live detector, not the fixture, is what calls this a wall.
    expect(ctx.wafProtection?.isBlocked).toBe(true);
    expect(ctx.wafProtection?.provider).toBe('cloudflare');
    expect(ctx.wafProtection?.statusCode).toBe(200);
  });

  it('names a bot wall on the blocked state and a throttle on the throttled one', () => {
    const blocked = HOSTILE_STATES.find((s) => s.name === 'blocked')!.build();
    const throttled = HOSTILE_STATES.find((s) => s.name === 'throttled')!.build();

    expect(blocked.wafProtection?.isBlocked).toBe(true);
    expect(blocked.wafProtection?.isRateLimit ?? false).toBe(false);
    expect(throttled.wafProtection?.isRateLimit).toBe(true);
  });

  it('answers every root path the orchestrator asks for, on every state', () => {
    // An unpopulated path is `undefined`, which no live scan produces. An
    // audit reading one would be untestable by this suite precisely where it
    // matters: behind a wall, every path holds a challenge page.
    for (const state of HOSTILE_STATES) {
      const paths = Object.keys(state.build().rootFiles).sort();
      expect(paths, state.name).toEqual([...ROOT_PATHS].sort());
    }
  });

  it('serves the challenge body under a refusing status at every blocked root path', () => {
    const ctx = HOSTILE_STATES.find((s) => s.name === 'blocked')!.build();
    for (const path of ROOT_PATHS) {
      const file = ctx.rootFiles[path]!;
      expect(file.status, path).toBe(403);
      expect(file.body, path).toContain('Cloudflare');
      // Both carriers of the type agree, as they do on a real response.
      expect(file.headers['content-type'], path).toBe(file.contentType);
    }
  });

  it('keeps ROOT_PATHS in step with the orchestrator', () => {
    // The orchestrator declares its list inside runScan, so it cannot be
    // imported. Reading it is the only way this fixture notices a path being
    // added upstream instead of silently under-answering a scan.
    // Anchored on the repo root: vitest is only ever run from there, and the
    // read throws loudly rather than skipping if that ever stops being true.
    const source = readFileSync(
      resolve(process.cwd(), 'packages/core/src/orchestrator.ts'),
      'utf8',
    );
    const block = /const rootFilePaths = \[([\s\S]*?)\n {2}\];/.exec(source);
    expect(block, 'rootFilePaths literal not found in orchestrator.ts').toBeTruthy();

    const declared = block![1]!
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .flatMap((line) => [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]!));

    expect(declared.length).toBeGreaterThan(20);
    expect([...ROOT_PATHS].sort()).toEqual([...declared].sort());
  });
});
