import { describe, expect, it } from 'vitest';
import { buildHeatmap, heatmapStart } from '../../src/lib/utils/habit-heatmap';

const TODAY = '2026-10-06'; // martes
const DAILY = [{ effective_from: '2026-09-01', days_of_week: [1, 2, 3, 4, 5, 6, 7] }];

describe('buildHeatmap', () => {
  it('starts on a Monday and builds full weeks', () => {
    expect(heatmapStart(TODAY, 2)).toBe('2026-09-28');
    const map = buildHeatmap(TODAY, 2, DAILY, []);
    expect(map.weeks).toHaveLength(2);
    expect(map.weeks.every((w) => w.length === 7)).toBe(true);
    expect(map.weeks[0]?.[0]?.date).toBe('2026-09-28');
  });

  it('classifies done / missed / pending / future', () => {
    const map = buildHeatmap(TODAY, 2, DAILY, ['2026-10-05']);
    const byDate = Object.fromEntries(map.weeks.flat().map((c) => [c.date, c.state]));
    expect(byDate['2026-10-05']).toBe('done');
    expect(byDate['2026-10-04']).toBe('missed');
    expect(byDate['2026-10-06']).toBe('pending');
    expect(byDate['2026-10-07']).toBe('future');
  });

  it('counts scheduled days and completions', () => {
    const map = buildHeatmap(TODAY, 2, DAILY, ['2026-10-05', '2026-10-06']);
    expect(map.scheduled).toBe(9); // 28 sep .. 6 oct
    expect(map.completed).toBe(2);
  });

  it('marks unscheduled days as off and keeps extra completions as done', () => {
    const monday = [{ effective_from: '2026-09-01', days_of_week: [1] }];
    const map = buildHeatmap(TODAY, 2, monday, ['2026-10-03']);
    const byDate = Object.fromEntries(map.weeks.flat().map((c) => [c.date, c.state]));
    expect(byDate['2026-10-02']).toBe('off');
    expect(byDate['2026-10-03']).toBe('done');
    expect(byDate['2026-09-28']).toBe('missed');
    expect(map.completed).toBe(0); // the extra day is not a scheduled one
  });
});
