// The season so far. Each episode is an ordered list of route names (see ROUTES in main.js).
export const EPISODES = [
  {
    n: 1,
    title: 'THE POLYESTER CONNECTION',
    scenes: ['credits', 'briefing', 'chase', 'warehouse', 'verdict', 'ending'],
  },
  {
    n: 2,
    title: 'DEATH WEARS LEG WARMERS',
    scenes: ['credits2', 'briefing2', 'aerobics', 'chase2', 'gym', 'verdict2', 'ending2'],
  },
];

/** Human-readable names for the save slot / CONTINUE button. */
export const SCENE_LABELS = {
  credits: 'EP 1 · OPENING CREDITS',
  briefing: "EP 1 · THE CAPTAIN'S OFFICE",
  chase: 'EP 1 · THE RIVER CHASE',
  warehouse: "EP 1 · THE DUKE'S WAREHOUSE",
  verdict: 'EP 1 · THE VERDICT',
  credits2: 'EP 2 · OPENING CREDITS',
  briefing2: "EP 2 · THE CAPTAIN'S OFFICE",
  aerobics: 'EP 2 · UNDERCOVER AEROBICS',
  chase2: 'EP 2 · THE BOARDWALK CHASE',
  gym: 'EP 2 · THE VIGOR BODY TEMPLE',
  verdict2: 'EP 2 · THE VERDICT',
};

/** Scenes for the scene-select menu (no endings). */
export const SELECTABLE = {
  1: [['credits', 'COLD OPEN & CREDITS'], ['briefing', "THE CAPTAIN'S OFFICE"], ['chase', 'THE L.A. RIVER CHASE'], ['warehouse', "THE DUKE'S WAREHOUSE"]],
  2: [['credits2', 'COLD OPEN & CREDITS'], ['briefing2', "THE CAPTAIN'S OFFICE"], ['aerobics', 'UNDERCOVER AEROBICS'], ['chase2', 'THE BOARDWALK CHASE'], ['gym', 'THE VIGOR BODY TEMPLE']],
};

export function episodeOf(scene) {
  return EPISODES.find((e) => e.scenes.includes(scene)) || EPISODES[0];
}
export function nextScene(scene) {
  const ep = episodeOf(scene);
  const i = ep.scenes.indexOf(scene);
  return i >= 0 && i < ep.scenes.length - 1 ? ep.scenes[i + 1] : null;
}
