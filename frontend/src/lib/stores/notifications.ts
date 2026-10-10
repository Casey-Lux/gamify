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
import type { HabitsOverview } from '$lib/types/habits';
import type { ConsumableActivation } from '$lib/types/domain';
import { habitDayInfo } from '$lib/utils/habit-adaptation';
import { toLocalDateStr } from '$lib/utils/habit-schedule';
import { onInvalidate, type DataDomain } from '$lib/utils/freshness';
import {
  deriveNotifications,
  type BonusCompletion,
  type DueMission
} from '$lib/utils/notifications-derive';

export interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationsState = { items: [], unreadCount: 0, loading: false, error: null };
/** Local re-evaluation tick (no network): reminders whose time arrives and
 * deadlines that pass while the app stays open. */
const RECOMPUTE_INTERVAL_MS = 60 * 1000;

/** Which source groups to refetch. `all` is the initial load. */
type Scope = 'all' | 'missions' | 'habits' | 'store';

/** The raw rows notifications are derived from, kept in memory. */
interface Sources {
  missions: DueMission[];
  activeEffects: ConsumableActivation[];
  bonusCompletions: BonusCompletion[];
  overview: HabitsOverview;
  readKeys: Set<string>;
}

function withCount(items: NotificationItem[]) {
  return { items, unreadCount: items.filter((i) => !i.read).length };
}

function createNotificationsStore() {
  const store = writable<NotificationsState>(initialState);
  const { subscribe, update, set } = store;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopInvalidation: (() => void) | null = null;
  let inFlight: Promise<void> | null = null;
  let sources: Sources | null = null;
  /** Scopes requested while a refresh was already running. */
  let pending = new Set<Scope>();

  /**
   * Derives the notification list from the in-memory sources at the CURRENT
   * time. Purely local: it is what makes a reminder show up when its hour
   * arrives, without querying Supabase again.
   */
  function recompute() {
    if (!sources) return;
    const now = Date.now();
    const today = toLocalDateStr(new Date(now));
    const { overview } = sources;
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
      missions: sources.missions,
      activeEffects: sources.activeEffects,
      bonusCompletions: sources.bonusCompletions,
      habits
    });
    const readKeys = sources.readKeys;
    const items = derived
      .map((n) => ({ ...n, read: readKeys.has(n.key) }))
      // unread first, then newest event first (derive already sorted by time)
      .sort((a, b) => Number(a.read) - Number(b.read));
    update((s) => ({ ...s, ...withCount(items) }));
  }

  /** Fetches only the source groups the scope needs (everything on `all`). */
  async function doRefresh(scopes: Set<Scope>) {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return;
    const all = scopes.has('all') || sources === null;
    const wants = (scope: Exclude<Scope, 'all'>) => all || scopes.has(scope);
    const now = Date.now();
    const today = toLocalDateStr(new Date(now));
    update((s) => ({ ...s, loading: true }));
    try {
      // A completion can add a "bonus obtenido" notification, so completing a
      // mission or a habit refreshes the bonus list too.
      const [missions, activeEffects, bonusCompletions, overview, readKeys] = await Promise.all([
        wants('missions') ? fetchDueMissions(session.user.id, now) : null,
        wants('store') ? fetchActiveBonusEffects() : null,
        wants('missions') || wants('habits') ? fetchBonusCompletions(now) : null,
        wants('habits') ? fetchHabitsOverview(today) : null,
        all ? fetchReadKeys() : null
      ]);
      const previous = sources;
      sources = {
        missions: missions ?? previous?.missions ?? [],
        activeEffects: activeEffects ?? previous?.activeEffects ?? [],
        bonusCompletions: bonusCompletions ?? previous?.bonusCompletions ?? [],
        overview: overview ?? previous?.overview ?? { habits: [], schedules: {}, completed: {} },
        readKeys: readKeys ?? previous?.readKeys ?? new Set<string>()
      };
      recompute();
      update((s) => ({ ...s, loading: false, error: null }));
    } catch {
      update((s) => ({ ...s, loading: false, error: 'No se pudieron cargar las notificaciones.' }));
    }
  }

  /** Coalesces concurrent refreshes: requests made while one is running are
   * merged into a single follow-up run. */
  function refresh(scope: Scope = 'all'): Promise<void> {
    pending.add(scope);
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        while (pending.size > 0) {
          const scopes = pending;
          pending = new Set();
          await doRefresh(scopes);
        }
      } finally {
        inFlight = null;
      }
    })();
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
    if (sources) for (const key of targets) sources.readKeys.add(key);
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

  const DOMAIN_SCOPE: Partial<Record<DataDomain, Scope>> = {
    missions: 'missions',
    habits: 'habits',
    store: 'store'
  };

  /**
   * Loads the notifications once and keeps them current WITHOUT polling and
   * without refetching when the window regains focus: they are refetched
   * (only the affected sources) when an action invalidates missions, habits
   * or the store, and re-evaluated locally every minute and when the tab
   * becomes visible so time-based items (reminders, deadlines, expired
   * bonuses) still appear on time. Returns a stop function.
   */
  function start(): () => void {
    void refresh();
    stopInvalidation = onInvalidate((domains) => {
      for (const domain of domains) {
        const scope = DOMAIN_SCOPE[domain];
        if (scope) void refresh(scope);
      }
    });
    timer = setInterval(recompute, RECOMPUTE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') recompute();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
      stopInvalidation?.();
      stopInvalidation = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  function reset() {
    sources = null;
    pending = new Set();
    set(initialState);
  }

  return { subscribe, refresh, recompute, markRead, markAllRead, start, reset };
}

export const notificationsStore = createNotificationsStore();
