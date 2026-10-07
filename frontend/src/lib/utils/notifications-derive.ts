import type { ConsumableActivation } from '$lib/types/domain';
import type { Habit } from '$lib/types/habits';
import { WEEKDAY_LABEL } from '$lib/types/habits';
import type { AppNotification } from '$lib/types/notifications';
import { isDueOverdue } from './due-date';
import { formatDueDate, EFFECT_TYPE_LABEL, formatEffectValue } from './format';
import type { HabitDayInfo } from './habit-adaptation';

export interface DueMission {
  id: string;
  title: string;
  due_at: string;
  due_has_time: boolean;
}

export interface BonusCompletion {
  id: string;
  completed_at: string;
  mission_title: string;
  xp_multiplier: number;
  xp_flat_bonus: number;
  coin_multiplier: number;
  coin_flat_bonus: number;
  xp_awarded: number;
  coins_awarded: number;
}

export interface HabitNotificationInput {
  habit: Habit;
  info: HabitDayInfo;
}

export interface NotificationSources {
  now: number;
  /** Local date `YYYY-MM-DD` of `now`. */
  today: string;
  /** Not-completed missions that have a deadline. */
  missions: DueMission[];
  activeEffects: ConsumableActivation[];
  bonusCompletions: BonusCompletion[];
  habits: HabitNotificationInput[];
}

/** A deadline is "soon" when it falls within this window. */
export const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Instant the mission actually becomes overdue: the exact due time, or the
 * end of the chosen day for a date-only deadline. */
function deadlineMs(m: DueMission): number {
  const due = new Date(m.due_at);
  if (m.due_has_time) return due.getTime();
  return new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1).getTime();
}

export function deriveDeadlineNotifications(s: NotificationSources): AppNotification[] {
  const out: AppNotification[] = [];
  for (const m of s.missions) {
    const href = `/missions/${m.id}/edit`;
    if (isDueOverdue(m.due_at, null, m.due_has_time, s.now)) {
      out.push({
        key: `overdue:${m.id}`,
        type: 'OVERDUE',
        title: 'Misión vencida',
        body: `«${m.title}» venció el ${formatDueDate(m.due_at, m.due_has_time)}.`,
        at: deadlineMs(m),
        href
      });
    } else if (deadlineMs(m) - s.now <= DUE_SOON_WINDOW_MS) {
      out.push({
        key: `due_soon:${m.id}:${m.due_at}`,
        type: 'DUE_SOON',
        title: 'Fecha límite próxima',
        body: `«${m.title}» vence ${formatDueDate(m.due_at, m.due_has_time)}.`,
        at: deadlineMs(m),
        href
      });
    }
  }
  return out;
}

export function deriveBonusNotifications(s: NotificationSources): AppNotification[] {
  const out: AppNotification[] = [];
  for (const e of s.activeEffects) {
    if (new Date(e.expires_at).getTime() <= s.now) continue;
    out.push({
      key: `bonus_active:${e.id}`,
      type: 'BONUS',
      title: 'Bonus activo',
      body: `${EFFECT_TYPE_LABEL[e.effect_type]} ${formatEffectValue(e.effect_type, e.effect_value)} disponible hasta las ${new Date(e.expires_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`,
      at: new Date(e.activated_at).getTime(),
      href: '/store'
    });
  }
  for (const c of s.bonusCompletions) {
    out.push({
      key: `bonus_earned:${c.id}`,
      type: 'BONUS',
      title: 'Bonus obtenido',
      body: `Ganaste ${c.xp_awarded} XP y ${c.coins_awarded} monedas en «${c.mission_title}» con bonus aplicados.`,
      at: new Date(c.completed_at).getTime(),
      href: null
    });
  }
  return out;
}

/** HH:MM:SS (or HH:MM) -> minutes since midnight. */
function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function deriveHabitNotifications(s: NotificationSources): AppNotification[] {
  const out: AppNotification[] = [];
  const nowDate = new Date(s.now);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const dayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();

  for (const { habit, info } of s.habits) {
    if (habit.archived_at || !info.scheduledToday || info.doneToday) continue;

    // Special reminder from the adaptive logic: the weekday has a weak
    // track record. Shown all day, independently of the habit's own reminder.
    if (habit.adaptive && info.plan === 'REMINDER') {
      const day = (WEEKDAY_LABEL[info.stat.weekday] ?? '').toLowerCase();
      out.push({
        key: `habit_pattern:${habit.id}:${s.today}`,
        type: 'HABIT_REMINDER',
        title: 'Recordatorio especial',
        body: `Los ${day} sueles saltarte «${habit.title}» (${info.stat.completed}/${info.stat.scheduled}). ¡Hoy puedes lograrlo!`,
        at: dayStart,
        href: '/habits'
      });
    }

    // Regular reminder: only once its time has been reached, and never for
    // a day the adaptive logic considers optional.
    const optional = habit.adaptive && info.plan === 'OPTIONAL';
    if (habit.reminder_time && !optional && nowMinutes >= minutesOf(habit.reminder_time)) {
      out.push({
        key: `habit_reminder:${habit.id}:${s.today}`,
        type: 'HABIT_REMINDER',
        title: 'Recordatorio de hábito',
        body: `Toca «${habit.title}» (${habit.reminder_time.slice(0, 5)}).`,
        at: dayStart + minutesOf(habit.reminder_time) * 60_000,
        href: '/habits'
      });
    }
  }
  return out;
}

/** Every derivable notification, newest event first. */
export function deriveNotifications(s: NotificationSources): AppNotification[] {
  return [
    ...deriveDeadlineNotifications(s),
    ...deriveBonusNotifications(s),
    ...deriveHabitNotifications(s)
  ].sort((a, b) => b.at - a.at);
}
