import { describe, expect, it } from 'vitest';
import { applyFilters, applySort, buildStatusClause } from '../../src/lib/api/missions';
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
  const NOW = new Date(2026, 5, 15, 14, 30).getTime(); // 15 Jun 2026, 14:30 local

  it('applies only the default doing status when everything else is empty', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, EMPTY_MISSION_FILTERS, NOW);
    expect(calls).toEqual([{ method: 'or', args: ['status.eq.DOING'] }]);
  });

  it('combines multiple filters acumulativamente (AND, in call order)', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(
      proxy,
      { ...EMPTY_MISSION_FILTERS, statuses: [], areaId: 'area-1', difficulty: 'HARD', xpMin: 100 },
      NOW
    );

    expect(calls).toContainEqual({ method: 'eq', args: ['area_id', 'area-1'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['difficulty', 'HARD'] });
    expect(calls).toContainEqual({ method: 'gte', args: ['xp_reward', 100] });
    // No status selected: no status filter at all.
    expect(calls.some((c) => c.method === 'or')).toBe(false);
  });

  it('ORs several selected stored statuses together', () => {
    expect(buildStatusClause(['TODO', 'DOING', 'DONE'], NOW)).toBe(
      'status.eq.TODO,status.eq.DOING,status.eq.DONE'
    );
  });

  it('builds the derived "vencida" clause: not completed, exact deadlines vs date-only deadlines', () => {
    const clause = buildStatusClause(['OVERDUE'], NOW);
    const nowIso = new Date(NOW).toISOString();
    const todayStartIso = new Date(2026, 5, 15).toISOString();
    expect(clause).toBe(
      'and(completed_at.is.null,or(' +
        `and(due_has_time.eq.true,due_at.lt.${nowIso}),` +
        `and(due_has_time.eq.false,due_at.lt.${todayStartIso})` +
        '))'
    );
  });

  it('lets "vencida" be combined with a stored status', () => {
    const clause = buildStatusClause(['DOING', 'OVERDUE'], NOW);
    expect(clause.startsWith('status.eq.DOING,and(completed_at.is.null')).toBe(true);
  });

  it('trims search text and skips the filter when blank', () => {
    const { proxy, calls } = createFakeQuery();
    applyFilters(proxy, { ...EMPTY_MISSION_FILTERS, statuses: [], search: '   ' }, NOW);
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
