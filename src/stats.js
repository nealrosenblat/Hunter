export function newStats() {
  return {
    shots: 0, hits: 0, kills: 0,
    henchShots: 0, henchHits: 0,
    collateral: 0, items: {},
    carDamage: 0, repair: 0,
    wfm: 0, donuts: 0, downs: 0,
    hostage: 14,
    chaseTime: 0, warehouseTime: 0,
    dukeWrecked: false,
    kicked: 0, polite: 0, horn: 0,
    doorLost: false, hubcaps: 0,
  };
}

export function addCollateral(stats, label, amount) {
  stats.collateral += amount;
  stats.items[label] = (stats.items[label] || 0) + 1;
}

export function grade(s) {
  let score = 100;
  score -= Math.min(30, (s.collateral / 1000) * 1.2);
  score -= Math.min(10, s.carDamage * 0.1);
  score -= s.downs * 6;
  const acc = s.shots ? s.hits / s.shots : 0.5;
  score += (acc - 0.45) * 30;
  score += Math.min(12, s.wfm * 3);
  if (s.dukeWrecked) score += 5;
  if (s.warehouseTime > 360) score -= 8;
  score = Math.max(0, Math.min(100, score));
  const letter = score >= 90 ? 'A' : score >= 78 ? 'B' : score >= 64 ? 'C' : score >= 50 ? 'D' : 'F';
  return { score, letter };
}

export const GRADE_LINES = {
  A: "Get out of my office. ...Good work. Now GET OUT.",
  B: "Downtown's happy. I'm not. That's how I know you did good.",
  C: "You got him. You also got my blood pressure up to a number they don't print on the chart.",
  D: "I've got the Mayor on line one and a fruit vendor on line two. They're both crying.",
  F: "Give me your badge. ...Not really. Who else would drive that car? I just like saying it.",
};
