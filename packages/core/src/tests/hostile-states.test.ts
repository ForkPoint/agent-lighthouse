import { describe, it, expect } from 'vitest';
import { HOSTILE_STATES, NOTHING_OBTAINED, SHELL_STATE } from './hostile-states';

describe('hostile scan states', () => {
  it('offers five states, four of which obtained nothing', () => {
    expect(HOSTILE_STATES).toHaveLength(5);
    expect(NOTHING_OBTAINED).toHaveLength(4);
    expect(SHELL_STATE.nothingObtained).toBe(false);
  });

  it('gives every nothing-obtained state an empty page list', () => {
    for (const state of NOTHING_OBTAINED) {
      expect(state.build().pages, state.name).toEqual([]);
    }
  });

  it('marks the missing evidence as unmet, and nothing else', () => {
    for (const state of HOSTILE_STATES) {
      const { met } = state.build().evidence;
      for (const key of state.missing) {
        expect(met[key], `${state.name}/${key}`).toBe(false);
      }
      const unexpected = (Object.keys(met) as Array<keyof typeof met>).filter(
        (key) => !met[key] && !state.missing.includes(key),
      );
      expect(unexpected, state.name).toEqual([]);
    }
  });

  it('hands the shell state one page that rendered no text', () => {
    const ctx = SHELL_STATE.build();
    expect(ctx.pages).toHaveLength(1);
    expect(Object.values(ctx.evidence.renderedByPage)).toEqual([false]);
  });

  it('names a bot wall on the blocked state and a throttle on the throttled one', () => {
    const blocked = HOSTILE_STATES.find((s) => s.name === 'blocked')!.build();
    const throttled = HOSTILE_STATES.find((s) => s.name === 'throttled')!.build();

    expect(blocked.wafProtection?.isBlocked).toBe(true);
    expect(blocked.wafProtection?.isRateLimit ?? false).toBe(false);
    expect(throttled.wafProtection?.isRateLimit).toBe(true);
  });
});
