// save.js — localStorage save/load of progression.
const KEY = 'solmar-heat-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.money !== 'number' || typeof s.missionIndex !== 'number') return null;
    return s;
  } catch (_) { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.round(state.money),
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      health: state.health,
      px: state.playerPos.x, pz: state.playerPos.z,
      savedAt: Date.now(),
    }));
  } catch (_) { /* storage unavailable; game still plays */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (_) {} }
export function saveSummary() {
  const s = loadSave();
  if (!s) return null;
  return `$${s.money} · mission ${s.missionIndex + 1} of 5 · saved ${new Date(s.savedAt).toLocaleString()}`;
}
