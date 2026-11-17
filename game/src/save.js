// Marisol City — localStorage save: missions completed, cash, best wanted
// survived, settings. All access is guarded (private mode / headless).
const KEY = 'marisol-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      missionsDone: game.missionsDone,
      cash: game.cash,
      bestWanted: game.bestWanted,
      muted: game.audio.muted,
      savedAt: game.clock,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
