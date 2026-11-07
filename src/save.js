// Remembers which scene you reached (and your case-file stats) on this device.
const KEY = 'hammer-delgado-save-v1';
export const SAVE_SCENES = {
  credits: 'OPENING CREDITS',
  briefing: "THE CAPTAIN'S OFFICE",
  chase: 'THE RIVER CHASE',
  warehouse: "THE DUKE'S WAREHOUSE",
  verdict: 'THE VERDICT',
};
export function writeSave(scene, mode, stats) {
  try { localStorage.setItem(KEY, JSON.stringify({ scene, mode, stats, at: Date.now() })); } catch (_) { /* storage unavailable */ }
}
export function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && SAVE_SCENES[s.scene] ? s : null;
  } catch (_) { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
