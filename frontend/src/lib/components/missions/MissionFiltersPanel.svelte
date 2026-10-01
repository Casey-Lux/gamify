<script lang="ts">
  import type { Area, MissionDifficulty, Skill } from '$lib/types/domain';
  import {
    MISSION_STATUS_FILTER_OPTIONS,
    type MissionFilters,
    type MissionStatusFilter
  } from '$lib/types/mission-query';
  import { DIFFICULTY_LABEL, MISSION_STATUS_FILTER_LABEL } from '$lib/utils/format';

  interface Props {
    filters: MissionFilters;
    skills: Skill[];
    areas: Area[];
    onChange: (patch: Partial<MissionFilters>) => void;
    onClearAll: () => void;
    onClearOne: (key: keyof MissionFilters) => void;
  }

  let { filters, skills, areas, onChange, onClearAll, onClearOne }: Props = $props();

  const difficulties: MissionDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  function numOrNull(value: string): number | null {
    if (value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function toggleStatus(status: MissionStatusFilter, checked: boolean) {
    const next = checked
      ? [...filters.statuses, status]
      : filters.statuses.filter((s) => s !== status);
    // Keep a stable, canonical order regardless of click order.
    onChange({ statuses: MISSION_STATUS_FILTER_OPTIONS.filter((s) => next.includes(s)) });
  }

  interface ActiveChip {
    key: keyof MissionFilters;
    label: string;
  }

  const isDefaultStatuses = $derived(
    filters.statuses.length === 1 && filters.statuses[0] === 'DOING'
  );

  // Individually-removable chips for every filter that isn't at its default
  // value (spec section 21: "Permitir limpiar filtros individualmente...").
  const activeChips = $derived(
    (
      [
        !isDefaultStatuses && {
          key: 'statuses',
          label: `Estado: ${
            filters.statuses.length === 0
              ? 'todos'
              : filters.statuses.map((s) => MISSION_STATUS_FILTER_LABEL[s]).join(', ')
          }`
        },
        filters.areaId && {
          key: 'areaId',
          label: `Área: ${areas.find((a) => a.id === filters.areaId)?.name ?? ''}`
        },
        filters.skillId && {
          key: 'skillId',
          label: `Skill: ${skills.find((s) => s.id === filters.skillId)?.name ?? ''}`
        },
        filters.difficulty && {
          key: 'difficulty',
          label: `Dificultad: ${DIFFICULTY_LABEL[filters.difficulty]}`
        },
        filters.dueAfter && { key: 'dueAfter', label: `Desde: ${filters.dueAfter}` },
        filters.dueBefore && { key: 'dueBefore', label: `Hasta: ${filters.dueBefore}` },
        filters.xpMin !== null && { key: 'xpMin', label: `XP ≥ ${filters.xpMin}` },
        filters.xpMax !== null && { key: 'xpMax', label: `XP ≤ ${filters.xpMax}` },
        filters.coinsMin !== null && { key: 'coinsMin', label: `Monedas ≥ ${filters.coinsMin}` },
        filters.coinsMax !== null && { key: 'coinsMax', label: `Monedas ≤ ${filters.coinsMax}` },
        filters.search.trim() !== '' && { key: 'search', label: `"${filters.search}"` }
      ] as (ActiveChip | false)[]
    ).filter((c): c is ActiveChip => Boolean(c))
  );
</script>

<section class="filters" aria-label="Filtros de misiones">
  <div class="filters__row">
    <input
      type="search"
      placeholder="Buscar por título…"
      value={filters.search}
      oninput={(e) => onChange({ search: e.currentTarget.value })}
    />

    <select
      value={filters.areaId ?? ''}
      onchange={(e) => onChange({ areaId: e.currentTarget.value || null })}
    >
      <option value="">Todas las áreas</option>
      {#each areas as area (area.id)}
        <option value={area.id}>{area.name}</option>
      {/each}
    </select>

    <select
      value={filters.skillId ?? ''}
      onchange={(e) => onChange({ skillId: e.currentTarget.value || null })}
    >
      <option value="">Todas las skills</option>
      {#each skills as skill (skill.id)}
        <option value={skill.id}>{skill.name}</option>
      {/each}
    </select>

    <select
      value={filters.difficulty ?? ''}
      onchange={(e) =>
        onChange({ difficulty: (e.currentTarget.value || null) as MissionDifficulty | null })}
    >
      <option value="">Toda dificultad</option>
      {#each difficulties as d (d)}
        <option value={d}>{DIFFICULTY_LABEL[d]}</option>
      {/each}
    </select>
  </div>

  <fieldset class="status-filter">
    <legend>Estado</legend>
    {#each MISSION_STATUS_FILTER_OPTIONS as status (status)}
      <label class="status-option">
        <input
          type="checkbox"
          checked={filters.statuses.includes(status)}
          onchange={(e) => toggleStatus(status, e.currentTarget.checked)}
        />
        {MISSION_STATUS_FILTER_LABEL[status]}
      </label>
    {/each}
  </fieldset>

  <div class="filters__row">
    <label class="range-field">
      XP mín.
      <input
        type="number"
        min="0"
        value={filters.xpMin ?? ''}
        oninput={(e) => onChange({ xpMin: numOrNull(e.currentTarget.value) })}
      />
    </label>
    <label class="range-field">
      XP máx.
      <input
        type="number"
        min="0"
        value={filters.xpMax ?? ''}
        oninput={(e) => onChange({ xpMax: numOrNull(e.currentTarget.value) })}
      />
    </label>
    <label class="range-field">
      Monedas mín.
      <input
        type="number"
        min="0"
        value={filters.coinsMin ?? ''}
        oninput={(e) => onChange({ coinsMin: numOrNull(e.currentTarget.value) })}
      />
    </label>
    <label class="range-field">
      Monedas máx.
      <input
        type="number"
        min="0"
        value={filters.coinsMax ?? ''}
        oninput={(e) => onChange({ coinsMax: numOrNull(e.currentTarget.value) })}
      />
    </label>
    <label class="range-field">
      Vence desde
      <input
        type="date"
        value={filters.dueAfter ?? ''}
        oninput={(e) => onChange({ dueAfter: e.currentTarget.value || null })}
      />
    </label>
    <label class="range-field">
      Vence hasta
      <input
        type="date"
        value={filters.dueBefore ?? ''}
        oninput={(e) => onChange({ dueBefore: e.currentTarget.value || null })}
      />
    </label>
  </div>

  {#if activeChips.length > 0}
    <div class="filters__chips">
      {#each activeChips as chip (chip.key)}
        <button type="button" class="chip-remove" onclick={() => onClearOne(chip.key)}>
          {chip.label} ✕
        </button>
      {/each}
    </div>
  {/if}

  <div class="filters__actions">
    <button type="button" onclick={onClearAll}>Limpiar todos los filtros</button>
  </div>
</section>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .filters__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .filters__row input,
  .filters__row select {
    min-height: 40px;
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
  }
  .status-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border, #2c2c3a);
    border-radius: 0.5rem;
  }
  .status-filter legend {
    padding: 0 0.3rem;
    font-size: 0.75rem;
    color: var(--text-muted, #a0a0b0);
  }
  .status-option {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 40px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .status-option input {
    width: 1.1rem;
    height: 1.1rem;
    min-height: 0;
  }
  .range-field {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    gap: 0.15rem;
  }
  .filters__actions {
    display: flex;
    justify-content: flex-end;
  }
  .filters__actions button {
    background: transparent;
    border: 1px solid var(--border, #2c2c3a);
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    min-height: 40px;
  }
  .filters__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip-remove {
    font-size: 0.75rem;
    background: var(--chip-bg, #2c2c3a);
    border: none;
    color: inherit;
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
</style>
