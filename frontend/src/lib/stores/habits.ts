import { writable } from 'svelte/store';
import { fetchHabitsOverview, HabitApiError } from '$lib/api/habits';
import type { Habit, ScheduleEntry } from '$lib/types/habits';
import { toLocalDateStr } from '$lib/utils/habit-schedule';
import { versionOf } from '$lib/utils/freshness';

export interface HabitsState {
  habits: Habit[];
  schedules: Record<string, ScheduleEntry[]>;
  completed: Record<string, string[]>;
  /** Local date (YYYY-MM-DD) this snapshot was computed for. */
  today: string;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: HabitsState = {
  habits: [],
  schedules: {},
  completed: {},
  today: toLocalDateStr(),
  loading: false,
  loaded: false,
  error: null
};

function createHabitsStore() {
  const { subscribe, update, set } = writable<HabitsState>(initialState);
  /** `versionOf('habits')` the data on screen was fetched under (-1 = never). */
  let loadedVersion = -1;

  async function load() {
    const today = toLocalDateStr();
    const version = versionOf('habits');
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const overview = await fetchHabitsOverview(today);
      set({ ...overview, today, loading: false, loaded: true, error: null });
      loadedVersion = version;
    } catch (err) {
      const message =
        err instanceof HabitApiError ? err.message : 'No se pudieron cargar los hábitos.';
      update((s) => ({ ...s, loading: false, error: message }));
    }
  }

  /** Called when a Habits view opens: queries only if nothing was fetched yet
   * or a mutation invalidated the habits. */
  function ensureLoaded() {
    if (loadedVersion !== versionOf('habits')) return load();
    return Promise.resolve();
  }

  /** A tab left open past midnight must switch to the new day. This is local
   * only (no query): schedules and completions in memory already cover the
   * new date, and every action is validated by the database when it runs. */
  function syncToday() {
    const today = toLocalDateStr();
    update((s) => (s.today === today ? s : { ...s, today }));
  }

  function reset() {
    loadedVersion = -1;
    set({ ...initialState, today: toLocalDateStr() });
  }

  return { subscribe, load, ensureLoaded, syncToday, reset };
}

export const habitsStore = createHabitsStore();
