import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MISSION_SORT,
  EMPTY_MISSION_FILTERS,
  MISSION_PAGE_SIZE
} from '../../src/lib/types/mission-query';

describe('mission query defaults', () => {
  it('defaults to showing pending missions only', () => {
    expect(EMPTY_MISSION_FILTERS.status).toBe('PENDING');
  });

  it('has no other filter applied by default (acumulativos, not restrictive)', () => {
    expect(EMPTY_MISSION_FILTERS.areaId).toBeNull();
    expect(EMPTY_MISSION_FILTERS.skillId).toBeNull();
    expect(EMPTY_MISSION_FILTERS.difficulty).toBeNull();
    expect(EMPTY_MISSION_FILTERS.xpMin).toBeNull();
    expect(EMPTY_MISSION_FILTERS.xpMax).toBeNull();
    expect(EMPTY_MISSION_FILTERS.search).toBe('');
  });

  it('defaults to newest-first by creation date', () => {
    expect(DEFAULT_MISSION_SORT).toEqual({ field: 'created_at', direction: 'DESC' });
  });

  it('caps a page at a bounded, sane size (spec: no cargar miles de filas)', () => {
    expect(MISSION_PAGE_SIZE).toBeGreaterThan(0);
    expect(MISSION_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
