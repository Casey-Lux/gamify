import { s as supabase } from "./client.js";
import { e as escape_html } from "./attributes.js";
import "clsx";
import { a as formatCacheAge } from "./format.js";
class StatisticsApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "StatisticsApiError";
  }
}
async function fetchCompletions(sinceIso) {
  const { data, error } = await supabase.from("mission_completions").select(
    `
      id, completed_at, xp_awarded, coins_awarded, skill_id,
      skill:skills(name),
      mission:missions(area_id, area:areas(name))
      `
  ).gte("completed_at", sinceIso).order("completed_at", { ascending: true });
  if (error) throw new StatisticsApiError(error.message, error.code);
  return (data ?? []).map((row) => ({
    id: row.id,
    completed_at: row.completed_at,
    xp_awarded: row.xp_awarded,
    coins_awarded: row.coins_awarded,
    skill_id: row.skill_id,
    skill_name: row.skill?.name ?? "Skill",
    area_id: row.mission?.area_id ?? null,
    area_name: row.mission?.area?.name ?? null
  }));
}
async function fetchWalletTransactions(sinceIso) {
  const { data, error } = await supabase.from("wallet_transactions").select("*").gte("created_at", sinceIso).order("created_at", { ascending: true });
  if (error) throw new StatisticsApiError(error.message, error.code);
  return data ?? [];
}
async function fetchSkillProgress() {
  const { data, error } = await supabase.from("player_skills").select("skill_id, level, xp, skill:skills(name)");
  if (error) throw new StatisticsApiError(error.message, error.code);
  return (data ?? []).map((row) => ({
    skill_id: row.skill_id,
    skill_name: row.skill?.name ?? "Skill",
    level: row.level,
    xp: row.xp
  }));
}
function CachedNotice($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { cachedAt } = $$props;
    $$renderer2.push(`<p class="cached-notice svelte-jb7wsd" role="note">Datos guardados ${escape_html(formatCacheAge(cachedAt))} — puede que no reflejen los cambios más recientes.</p>`);
  });
}
export {
  CachedNotice as C,
  fetchCompletions as a,
  fetchWalletTransactions as b,
  fetchSkillProgress as f
};
