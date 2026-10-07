'use strict';
// ═══════════════════════════════════════════════════════════════════
//  HELDEN-KURZNAME (Titel abtrennen) — serverseitiger Zwilling von `heroDisplayName` in public/app-shared.jsx.
//
//  Im Skill Test tragen CPU-Sitze im laufenden Spiel Namen und Aussehen ihres mittleren Heroes (battle.js `nameBots`);
//  als Name steht nur der reine NAME („Garius"), nicht der volle Kartenname mit Titel. Die Regeln müssen mit dem Client
//  übereinstimmen — `scripts/skilltest-e2e/hero-name.test.js` vergleicht beide über alle Heroes.
// ═══════════════════════════════════════════════════════════════════

const HERO_NAME_OVERRIDES = {
  // Namen, die als GANZES der Eigenname sind (Wortspiele) — hier greift
  // Regel 3 sonst und schnitte den ersten Teil weg.
  'Mary Crestmas': 'Mary Crestmas',
  'Saint Nicolas': 'Saint Nicolas',
  'Santa Klaus': 'Santa Klaus',
  // Honorifikum vor dem Namen: Regel 1 nähme alles vor dem Komma. Bei
  // Crestina soll nur der Eigenname stehen (Als Ruling — Ziel ist ein
  // KURZES Label, das vollständig ins Namensfeld passt). "Lord Mithuru"
  // bleibt bewusst mit Honorifikum.
  'Fairy Queen Crestina, the Creation Fairy': 'Crestina',
  'True Fairy Crestina, the Primordial Goddess': 'Crestina',
};

function heroShortName(fullName) {
  if (!fullName || typeof fullName !== 'string') return fullName || '';
  const name = fullName.trim();
  if (HERO_NAME_OVERRIDES[name]) return HERO_NAME_OVERRIDES[name];
  // Regel 1 — Komma trennt Name von Titel.
  const comma = name.indexOf(',');
  if (comma > 0) return name.slice(0, comma).trim() || name;
  // Regel 2 — " the " trennt Name von nachgestelltem Titel.
  const viaThe = name.match(/^(.+?)\s+the\s+/i);
  if (viaThe) return viaThe[1].trim() || name;
  // Regel 3 — Titel vorn, Name am Ende (letztes Wort).
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

module.exports = { heroShortName, HERO_NAME_OVERRIDES };
