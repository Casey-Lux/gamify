import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import {
  fetchActiveBonusEffects,
  fetchBonusCompletions,
  fetchDueMissions,
  fetchReadKeys,
  markNotificationsRead
} from '$lib/api/notifications';
import { fetchHabitsOverview } from '$lib/api/habits';
import type { NotificationItem } from '$lib/types/notifications';
import { habitDayInfo } from '$lib/utils/habit-adaptation';
import { toLocalDateStr } from '$lib/utils/habit-schedule';
import { deriveNotifications } from '$lib/utils/notifications-derive';

export interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationsState = { items: [], unreadCount: 0, loading: false, error: null };
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

function withCount(items: NotificationItem[]) {
  return { items, unreadCount: items.filter((i) => !i.read).length };
}

function createNotificationsStore() {
  const store = writable<NotificationsState>(initialState);
  const { subscribe, update, set } = store;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;

  async function doRefresh() {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return;
    const now = Date.now();
    const today = toLocalDateStr(new Date(now));
    update((s) => ({ ...s, loading: true }));
    try {
      const [missions, activeEffects, bonusCompletions, overview, readKeys] = await Promise.all([
        fetchDueMissions(session.user.id, now),
        fetchActiveBonusEffects(),
        fetchBonusCompletions(now),
        fetchHabitsOverview(today),
        fetchReadKeys()
      ]);
      const habits = overview.habits
        .filter((h) => h.archived_at === null)
        .map((habit) => ({
          habit,
          info: habitDayInfo(
            habit,
            overview.schedules[habit.id] ?? [],
            overview.completed[habit.id] ?? [],
            today
          )
        }));
      const derived = deriveNotifications({
        now,
        today,
        missions,
        activeEffects,
        bonusCompletions,
        habits
      });
      const items = derived
        .map((n) => ({ ...n, read: readKeys.has(n.key) }))
        // unread first, then newest event first (derive already sorted by time)
        .sort((a, b) => Number(a.read) - Number(b.read));
      update((s) => ({ ...s, ...withCount(items), loading: false, error: null }));
    } catch {
      update((s) => ({ ...s, loading: false, error: 'No se pudieron cargar las notificaciones.' }));
    }
  }

  /** Coalesces concurrent refreshes into one in-flight request. */
  function refresh(): Promise<void> {
    inFlight ??= doRefresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function mark(keys: string[]) {
    const current = get(store);
    const targets = new Set(keys.filter((k) => current.items.some((i) => i.key === k && !i.read)));
    if (targets.size === 0) return;
    // Optimistic: reflect the read state immediately, persist in background.
    update((s) =>
      Object.assign(
        { ...s },
        withCount(s.items.map((i) => (targets.has(i.key) ? { ...i, read: true } : i)))
      )
    );
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) await markNotificationsRead(session.user.id, [...targets]);
    } catch {
      // Not persisted (e.g. offline): the next refresh shows the real state.
    }
  }

  function markRead(key: string) {
    return mark([key]);
  }

  function markAllRead() {
    return mark(get(store).items.map((i) => i.key));
  }

  /** Starts periodic + on-focus refreshing. Returns a stop function. */
  function start(): () => void {
    void refresh();
    timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  function reset() {
    set(initialState);
  }

  return { subscribe, refresh, markRead, markAllRead, start, reset };
}

export const notificationsStore = createNotificationsStore();
