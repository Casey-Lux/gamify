import { describe, expect, it } from 'vitest';
import { applyFilters, applySort } from '../../src/lib/api/missions';
import { EMPTY_MISSION_FILTERS } from '../../src/lib/types/mission-query';

/**
 * Records every call made on it and returns itself, mimicking the relevant
 * subset of the Supabase/PostgREST query builder's chainable API, so we can
 * assert on *which* filters were applied without needing a real database.
 */
function createFakeQuery() {
  const calls: { method: string; args: unknown[] }[] = [];
  const handler = {
    get(_target: object, prop: string) {
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    }
  };
  const proxy = new Proxy({}, handler);
  return { proxy, calls };
}

describe('applyFilters', () => {
  it('applies no filter calls for the all-empty state except the default PENDING status', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, EMPTY_MISSION_FILTERS);
    expect(calls).toEqual([{ method: 'is', args: ['completed_at', null] }]);
  });

  it('combines multiple filters acumulativamente (AND, in call order)', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, {
      ...EMPTY_MISSION_FILTERS,
      status: 'ALL',
      areaId: 'area-1',
      difficulty: 'HARD',
      xpMin: 100
    });

    expect(calls).toContainEqual({ method: 'eq', args: ['area_id', 'area-1'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['difficulty', 'HARD'] });
    expect(calls).toContainEqual({ method: 'gte', args: ['xp_reward', 100] });
    // status ALL applies neither is() nor not(): no completion filter at all.
    expect(calls.some((c) => c.args[0] === 'completed_at')).toBe(false);
  });

  it('filters completed missions with not(is null) when status is COMPLETED', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, { ...EMPTY_MISSION_FILTERS, status: 'COMPLETED' });
    expect(calls).toEqual([{ method: 'not', args: ['completed_at', 'is', null] }]);
  });

  it('trims search text and skips the filter when blank', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, { ...EMPTY_MISSION_FILTERS, status: 'ALL', search: '   ' });
    expect(calls.some((c) => c.method === 'ilike')).toBe(false);
  });
});

describe('applySort', () => {
  it('always adds a deterministic secondary order by id', () => {
    const { proxy, calls } = createFakeQuery();
    applySort(proxy, { field: 'xp_reward', direction: 'DESC' });
    expect(calls[0]).toEqual({
      method: 'order',
      args: ['xp_reward', { ascending: false, nullsFirst: undefined }]
    });
    expect(calls[1]).toEqual({ method: 'order', args: ['id', { ascending: true }] });
  });

  it('forces due_at NULLs last regardless of sort direction', () => {
    const asc = createFakeQuery();
    applySort(asc.proxy, { field: 'due_at', direction: 'ASC' });
    expect(asc.calls[0]?.args[1]).toMatchObject({ nullsFirst: false });

    const desc = createFakeQuery();
    applySort(desc.proxy, { field: 'due_at', direction: 'DESC' });
    expect(desc.calls[0]?.args[1]).toMatchObject({ nullsFirst: false });
  });
});
