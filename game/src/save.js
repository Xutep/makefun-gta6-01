// Marisol City — localStorage save: missions completed, cash, best wanted
// survived, settings. Never throws (private mode, disabled storage).

const KEY = 'marisol-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(G) {
  try {
    const data = {
      missionsDone: G.missions.done,
      cash: Math.floor(G.player.cash),
      bestWanted: G.stats.bestWanted,
      muted: G.muted,
      savedAt: G.clockMinutes,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable — the game still plays fine
  }
}
