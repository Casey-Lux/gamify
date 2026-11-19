import { describe, expect, it } from 'vitest';
import { dailyMissionSlots } from '$lib/types/daily-plan';

describe('dailyMissionSlots', () => {
  it('does not assign missions without enough time for one easy mission', () => {
    expect(dailyMissionSlots(0)).toBe(0);
    expect(dailyMissionSlots(1)).toBe(0);
    expect(dailyMissionSlots(1.9)).toBe(0);
  });

  it('assigns one mission per two free hours', () => {
    expect(dailyMissionSlots(2)).toBe(1);
    expect(dailyMissionSlots(3.9)).toBe(1);
    expect(dailyMissionSlots(4)).toBe(2);
    expect(dailyMissionSlots(5.5)).toBe(2);
  });

  it('caps the daily plan at three missions', () => {
    expect(dailyMissionSlots(6)).toBe(3);
    expect(dailyMissionSlots(12)).toBe(3);
    expect(dailyMissionSlots(24)).toBe(3);
  });

  it('treats invalid values as no available time', () => {
    expect(dailyMissionSlots(-2)).toBe(0);
    expect(dailyMissionSlots(Number.NaN)).toBe(0);
    expect(dailyMissionSlots(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
