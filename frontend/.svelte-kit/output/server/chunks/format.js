const EFFECT_TYPE_LABEL = {
  XP_MULTIPLIER: "Multiplicador de XP",
  COIN_MULTIPLIER: "Multiplicador de monedas",
  XP_FLAT_BONUS: "Bono fijo de XP",
  COIN_FLAT_BONUS: "Bono fijo de monedas"
};
function formatEffectValue(effectType, effectValue) {
  const isMultiplier = effectType === "XP_MULTIPLIER" || effectType === "COIN_MULTIPLIER";
  return isMultiplier ? `×${effectValue}` : `+${effectValue}`;
}
function formatRemaining(expiresAt, now = Date.now()) {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
const DIFFICULTY_LABEL = {
  EASY: "Fácil",
  MEDIUM: "Media",
  HARD: "Difícil"
};
function formatDueDate(dueAt) {
  if (!dueAt) return "Sin fecha límite";
  const date = new Date(dueAt);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
function isOverdue(dueAt, completedAt) {
  if (!dueAt || completedAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}
function formatCacheAge(cachedAtIso, now = Date.now()) {
  const ageMs = Math.max(0, now - new Date(cachedAtIso).getTime());
  const minutes = Math.floor(ageMs / 6e4);
  if (minutes < 1) return "hace menos de un minuto";
  if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}
export {
  DIFFICULTY_LABEL as D,
  EFFECT_TYPE_LABEL as E,
  formatCacheAge as a,
  formatEffectValue as b,
  formatRemaining as c,
  formatDueDate as f,
  isOverdue as i
};
