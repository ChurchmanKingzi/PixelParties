'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Welche Discord-Rollen gehören zu einem Spieler? (reine Logik, ohne Discord)
//
//  RANG-ROLLEN: dieselben Stufen wie im Spiel (RANK_TIERS in public/app.jsx).
//  ERFOLGS-ROLLEN: aus Daten, die der Spielserver ohnehin kennt. Fehlt die Rolle auf dem Server
//  (`!setupRoles` legt sie an), wird sie einfach nicht vergeben — eine Rolle zu löschen schaltet
//  den Erfolg also ab.
// ═══════════════════════════════════════════════════════════════════

const RANK_TIERS = [
  { key: 'bronze',      name: 'Bronze',      min: 0,    color: 0xcd7f32 },
  { key: 'silver',      name: 'Silver',      min: 1200, color: 0xc0c0c0 },
  { key: 'gold',        name: 'Gold',        min: 1400, color: 0xffd700 },
  { key: 'platinum',    name: 'Platinum',    min: 1600, color: 0xa8e8f0 },
  { key: 'diamond',     name: 'Diamond',     min: 1800, color: 0xb9f2ff },
  { key: 'master',      name: 'Master',      min: 2000, color: 0xff44cc },
  { key: 'grandmaster', name: 'Grandmaster', min: 2200, color: 0xff8800 },
];

/** Erfolge: `test(user, cfg)` → true/false. user = Ansicht aus bot-api.js (+ leaderboardRank). */
function achievements(cfg) {
  return [
    { key: 'skin-collector', name: 'Skin Collector', color: 0xe91e63, test: u => u.skins >= cfg.skinCollectorMin,
      info: `${cfg.skinCollectorMin}+ Skins besitzen` },
    { key: 'veteran', name: 'Veteran', color: 0x8d6e63, test: u => (u.wins + u.losses) >= cfg.veteranGames,
      info: `${cfg.veteranGames}+ Spiele gespielt` },
    { key: 'top-10', name: 'Top 10', color: 0x26a69a, test: u => !!u.leaderboardRank && u.leaderboardRank <= 10,
      info: 'aktuell unter den 10 besten der Rangliste' },
    { key: 'champion', name: 'Champion', color: 0xffc107, test: u => u.leaderboardRank === 1,
      info: 'Platz 1 der Rangliste' },
  ];
}

function rankFor(elo) {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (elo >= t.min) tier = t;
  return tier;
}

/** @returns {string[]} Rollennamen, die der Spieler jetzt haben soll (genau eine Rang-Rolle + passende Erfolge) */
function desiredRoleNames(user, cfg) {
  const names = [rankFor(Number(user.elo) || 0).name];
  for (const a of achievements(cfg)) if (a.test(user, cfg)) names.push(a.name);
  return names;
}

/** Alle Rollen, die der Bot verwaltet (nur diese fasst er beim Abgleich an). */
function managedRoleDefs(cfg) {
  return [...RANK_TIERS.map(t => ({ name: t.name, color: t.color, kind: 'rank' })), ...achievements(cfg).map(a => ({ name: a.name, color: a.color, kind: 'achievement' }))];
}

module.exports = { RANK_TIERS, achievements, rankFor, desiredRoleNames, managedRoleDefs };
