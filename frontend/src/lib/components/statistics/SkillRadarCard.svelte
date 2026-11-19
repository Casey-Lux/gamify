<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import type { SkillProgress } from '$lib/types/statistics';
  import ChartCanvas from './ChartCanvas.svelte';

  interface Props {
    skills: SkillProgress[];
  }

  let { skills }: Props = $props();

  const ranked = $derived(
    [...skills].sort(
      (a, b) => b.level - a.level || b.xp - a.xp || a.skill_name.localeCompare(b.skill_name)
    )
  );
  const maxLevel = $derived(Math.max(1, ...skills.map((s) => s.level)));

  function wrap(name: string, width = 14): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of name.split(/\s+/)) {
      if (line && (line + ' ' + word).length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  const config = $derived<ChartConfiguration>({
    type: 'radar',
    data: {
      labels: skills.map((s) => wrap(s.skill_name)),
      datasets: [
        {
          label: 'Nivel',
          data: skills.map((s) => s.level),
          borderColor: '#6fa8ff',
          borderWidth: 2.5,
          backgroundColor: 'rgba(76, 110, 245, 0.28)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#4c6ef5',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 12 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => skills[items[0]?.dataIndex ?? 0]?.skill_name ?? '',
            label: (ctx) => `Nivel ${ctx.parsed.r}`
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true,

          suggestedMax: Math.max(4, maxLevel + 1),
          ticks: {
            stepSize: maxLevel > 10 ? Math.ceil(maxLevel / 5) : 1,
            precision: 0,
            showLabelBackdrop: false,
            color: '#7d7d92',
            font: { size: 11 }
          },
          grid: { color: 'rgba(160, 160, 176, 0.2)' },
          angleLines: { color: 'rgba(160, 160, 176, 0.2)' },
          pointLabels: { color: '#e6e6f0', font: { size: 13, weight: 600 } }
        }
      }
    }
  });
</script>

<section class="radar-card">
  <div class="radar-card__chart">
    {#if skills.length >= 3}
      <ChartCanvas title="Nivel por skill" {config} height={460} />
    {:else}
      <p class="note">El gráfico de araña aparece cuando tengas al menos 3 skills con progreso.</p>
    {/if}
  </div>

  <aside class="radar-card__ranking" aria-label="Skills por nivel">
    <h3>Ranking de skills</h3>
    {#if ranked.length === 0}
      <p class="note">Aún no tienes progreso en skills.</p>
    {:else}
      <ol>
        {#each ranked as skill (skill.skill_id)}
          <li>
            <div class="row">
              <span class="name">{skill.skill_name}</span>
              <span class="level">Nv. {skill.level}</span>
            </div>
            <div class="bar" aria-hidden="true">
              <span style:width={`${(skill.level / maxLevel) * 100}%`}></span>
            </div>
            <span class="xp">{skill.xp} XP</span>
          </li>
        {/each}
      </ol>
    {/if}
  </aside>
</section>

<style>
  .radar-card {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(220px, 1fr);
    gap: 1rem;
    align-items: stretch;
  }
  .radar-card__chart {
    min-width: 0;
  }
  .radar-card__ranking {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
    max-height: 560px;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted, #a0a0b0);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .name {
    overflow-wrap: anywhere;
  }
  .level {
    font-weight: 700;
    color: #6fa8ff;
    white-space: nowrap;
  }
  .bar {
    height: 6px;
    margin: 0.3rem 0 0.15rem;
    border-radius: 3px;
    background: #14141f;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #4c6ef5, #6fa8ff);
  }
  .xp {
    font-size: 0.75rem;
    color: var(--text-muted, #a0a0b0);
  }
  .note {
    margin: 0;
    color: var(--text-muted, #a0a0b0);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .radar-card {
      grid-template-columns: minmax(0, 1fr);
    }
    .radar-card__ranking {
      max-height: none;
    }
  }
</style>
