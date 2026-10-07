import { writable } from 'svelte/store';
import { fetchHabitsOverview, HabitApiError } from '$lib/api/habits';
import type { Habit, ScheduleEntry } from '$lib/types/habits';
import { toLocalDateStr } from '$lib/utils/habit-schedule';

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

  async function load() {
    const today = toLocalDateStr();
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const overview = await fetchHabitsOverview(today);
      set({ ...overview, today, loading: false, loaded: true, error: null });
    } catch (err) {
      const message =
        err instanceof HabitApiError ? err.message : 'No se pudieron cargar los hábitos.';
      update((s) => ({ ...s, loading: false, error: message }));
    }
  }

  function reset() {
    set({ ...initialState, today: toLocalDateStr() });
  }

  return { subscribe, load, reset };
}

export const habitsStore = createHabitsStore();
