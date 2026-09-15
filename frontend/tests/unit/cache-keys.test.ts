import { describe, expect, it } from 'vitest';
import { catalogCacheKey, missionsCacheKey, statisticsCacheKey } from '../../src/lib/cache/keys';
import { DEFAULT_MISSION_SORT, EMPTY_MISSION_FILTERS } from '../../src/lib/types/mission-query';

describe('missionsCacheKey', () => {
  it('produces the same key for identical filters/sort/page', () => {
    const a = missionsCacheKey(EMPTY_MISSION_FILTERS, DEFAULT_MISSION_SORT, 0);
    const b = missionsCacheKey({ ...EMPTY_MISSION_FILTERS }, { ...DEFAULT_MISSION_SORT }, 0);
    expect(a).toBe(b);
  });

  it('produces a different key when a filter changes', () => {
    const base = missionsCacheKey(EMPTY_MISSION_FILTERS, DEFAULT_MISSION_SORT, 0);
    const withArea = missionsCacheKey(
      { ...EMPTY_MISSION_FILTERS, areaId: 'area-1' },
      DEFAULT_MISSION_SORT,
      0
    );
    expect(base).not.toBe(withArea);
  });

  it('produces a different key for a different page', () => {
    const page0 = missionsCacheKey(EMPTY_MISSION_FILTERS, DEFAULT_MISSION_SORT, 0);
    const page1 = missionsCacheKey(EMPTY_MISSION_FILTERS, DEFAULT_MISSION_SORT, 1);
    expect(page0).not.toBe(page1);
  });

  it('produces a different key for a different sort direction', () => {
    const asc = missionsCacheKey(EMPTY_MISSION_FILTERS, DEFAULT_MISSION_SORT, 0);
    const desc = missionsCacheKey(
      EMPTY_MISSION_FILTERS,
      { ...DEFAULT_MISSION_SORT, direction: 'ASC' },
      0
    );
    expect(asc).not.toBe(desc);
  });
});

describe('statisticsCacheKey', () => {
  it('is stable per granularity and distinct across granularities', () => {
    expect(statisticsCacheKey('day')).toBe(statisticsCacheKey('day'));
    expect(statisticsCacheKey('day')).not.toBe(statisticsCacheKey('week'));
    expect(statisticsCacheKey('week')).not.toBe(statisticsCacheKey('month'));
  });
});

describe('catalogCacheKey', () => {
  it('is stable per workspace and distinct across workspaces', () => {
    expect(catalogCacheKey('ws-1')).toBe(catalogCacheKey('ws-1'));
    expect(catalogCacheKey('ws-1')).not.toBe(catalogCacheKey('ws-2'));
  });
});
