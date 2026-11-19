import { describe, expect, it } from 'vitest';
import { deriveNotifications } from '../../src/lib/utils/notifications-derive';
import type { Habit } from '../../src/lib/types/habits';
import type { ConsumableActivation } from '../../src/lib/types/domain';
import { habitDayInfo } from '../../src/lib/utils/habit-adaptation';
import { eachDate, addDays } from '../../src/lib/utils/habit-schedule';

const NOW = new Date(2026, 9, 6, 10, 0).getTime();
const TODAY = '2026-10-06';
const DAILY = [{ effective_from: '2026-01-01', days_of_week: [1, 2, 3, 4, 5, 6, 7] }];

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    workspace_id: 'w',
    user_id: 'u',
    skill_id: 's',
    area_id: null,
    title: 'Correr',
    description: null,
    difficulty: 'EASY',
    xp_reward: 10,
    coin_reward: 5,
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    weekly_target: null,
    schedule_effective_from: '2026-01-01',
    day_part: 'ANYTIME',
    reminder_time: null,
    adaptive: true,
    archived_at: null,
    created_at: '',
    updated_at: '',
    ...patch
  };
}

const base = {
  now: NOW,
  today: TODAY,
  missions: [],
  activeEffects: [],
  bonusCompletions: [],
  habits: []
};

describe('deriveNotifications', () => {
  it('flags overdue and soon-due missions, ignoring far deadlines', () => {
    const iso = (d: Date) => d.toISOString();
    const out = deriveNotifications({
      ...base,
      missions: [
        {
          id: 'late',
          title: 'Vencida',
          due_at: iso(new Date(2026, 9, 5, 9, 0)),
          due_has_time: true
        },
        {
          id: 'soon',
          title: 'Pronto',
          due_at: iso(new Date(2026, 9, 6, 18, 0)),
          due_has_time: true
        },
        { id: 'today', title: 'Hoy', due_at: iso(new Date(2026, 9, 6)), due_has_time: false },
        { id: 'far', title: 'Lejos', due_at: iso(new Date(2026, 9, 9, 9, 0)), due_has_time: true }
      ]
    });
    const keys = out.map((n) => n.key);
    expect(keys).toContain('overdue:late');
    expect(out.find((n) => n.key.startsWith('due_soon:soon'))).toBeTruthy();

    expect(out.find((n) => n.key.startsWith('due_soon:today'))).toBeTruthy();
    expect(keys.some((k) => k.includes('far'))).toBe(false);
  });

  it('notifies active bonuses and earned bonuses', () => {
    const effect: ConsumableActivation = {
      id: 'a1',
      user_id: 'u',
      item_id: 'i',
      effect_type: 'XP_MULTIPLIER',
      effect_value: 1.5,
      activated_at: new Date(NOW - 60_000).toISOString(),
      expires_at: new Date(NOW + 600_000).toISOString(),
      status: 'ACTIVE'
    };
    const out = deriveNotifications({
      ...base,
      activeEffects: [effect, { ...effect, id: 'a2', expires_at: new Date(NOW - 1).toISOString() }],
      bonusCompletions: [
        {
          id: 'c1',
          completed_at: new Date(NOW - 3600_000).toISOString(),
          mission_title: 'M',
          xp_multiplier: 1.5,
          xp_flat_bonus: 0,
          coin_multiplier: 1,
          coin_flat_bonus: 0,
          xp_awarded: 15,
          coins_awarded: 5
        }
      ]
    });
    expect(out.map((n) => n.key).sort()).toEqual(['bonus_active:a1', 'bonus_earned:c1']);
  });

  it('reminds a pending habit only once its reminder time has passed', () => {
    const h = habit({ reminder_time: '09:30:00', adaptive: false });
    const info = habitDayInfo(h, DAILY, [], TODAY);
    expect(
      deriveNotifications({ ...base, habits: [{ habit: h, info }] }).map((n) => n.key)
    ).toEqual(['habit_reminder:h1:2026-10-06']);

    const later = habit({ reminder_time: '18:00:00', adaptive: false });
    expect(
      deriveNotifications({
        ...base,
        habits: [{ habit: later, info: habitDayInfo(later, DAILY, [], TODAY) }]
      })
    ).toEqual([]);
  });

  it('does not remind a habit already done today', () => {
    const h = habit({ reminder_time: '09:30:00' });
    const info = habitDayInfo(h, DAILY, [TODAY], TODAY);
    expect(deriveNotifications({ ...base, habits: [{ habit: h, info }] })).toEqual([]);
  });

  it('adds a special reminder for a weak weekday and skips reminders on optional days', () => {
    const from = addDays(TODAY, -56);
    const tuesdays = eachDate(from, addDays(TODAY, -1)).filter((d) => d.endsWith('-') === false);

    const done = tuesdays.filter((d) => new Date(d + 'T00:00:00').getDay() !== 2);
    const h = habit({ reminder_time: '09:30:00' });
    const info = habitDayInfo(h, DAILY, done, TODAY);
    expect(info.plan).toBe('OPTIONAL');
    expect(deriveNotifications({ ...base, habits: [{ habit: h, info }] })).toEqual([]);

    const weak = { ...info, plan: 'REMINDER' as const };
    const out = deriveNotifications({ ...base, habits: [{ habit: h, info: weak }] });
    expect(out.map((n) => n.key).sort()).toEqual([
      'habit_pattern:h1:2026-10-06',
      'habit_reminder:h1:2026-10-06'
    ]);
  });

  it('never notifies archived habits', () => {
    const h = habit({ reminder_time: '09:30:00', archived_at: '2026-10-01T00:00:00Z' });
    expect(
      deriveNotifications({
        ...base,
        habits: [{ habit: h, info: habitDayInfo(h, DAILY, [], TODAY) }]
      })
    ).toEqual([]);
  });
});
