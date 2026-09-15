import { describe, expect, it } from 'vitest';
import { formatEffectValue, formatRemaining } from '../../src/lib/utils/format';

describe('formatEffectValue', () => {
  it('formats multiplier effects with an ×', () => {
    expect(formatEffectValue('XP_MULTIPLIER', 1.25)).toBe('×1.25');
    expect(formatEffectValue('COIN_MULTIPLIER', 1.5)).toBe('×1.5');
  });

  it('formats flat-bonus effects with a +', () => {
    expect(formatEffectValue('XP_FLAT_BONUS', 10)).toBe('+10');
    expect(formatEffectValue('COIN_FLAT_BONUS', 5)).toBe('+5');
  });
});

describe('formatRemaining', () => {
  const now = new Date('2026-01-01T00:00:00.000Z').getTime();

  it('formats minutes and seconds, zero-padding seconds', () => {
    const expiresAt = new Date(now + 3 * 60_000 + 5_000).toISOString();
    expect(formatRemaining(expiresAt, now)).toBe('3:05');
  });

  it('clamps to 0:00 once expired, never negative', () => {
    const expiresAt = new Date(now - 60_000).toISOString();
    expect(formatRemaining(expiresAt, now)).toBe('0:00');
  });

  it('handles the exact expiry instant as 0:00', () => {
    expect(formatRemaining(new Date(now).toISOString(), now)).toBe('0:00');
  });
});
