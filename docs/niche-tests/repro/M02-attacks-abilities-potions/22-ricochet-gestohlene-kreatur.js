'use strict';
// M02-22 · Ricochet wählt Ziele nach physischer Seite statt nach Kontrolle (gestohlene Kreaturen)
// Kartentext Ricochet: „Both players take turns choosing targets their opponent controls that have not been chosen with this effect yet … You choose first.
//   The first target takes damage equal to the attacker's Attack stat. …"
// Konvention (Shattering Strike „Creature your opponent controls" ✓ in dieser Gruppe getestet; Kontrolle statt Seite, Styx 28.9.): Ziel-Seite = Kontrolleur.
// Aufbau: Sitz 1 hat eine Kreatur, die Sitz 0 gestohlen hat (liegt physisch auf Seite 1, Kontrolle Sitz 0); alle anderen Helden/Kreaturen sind weg außer Rick (Sitz 0, ATK 100).
// Erwartung: Sitz 0 kontrolliert die Kreatur ⇒ der Gegner kontrolliert kein Ziel ⇒ Ricochet kann nichts wählen/trifft die eigene Kreatur nicht (HP bleibt 1000).
//   Zusätzlich muss die Kreatur dem GEGNER als Ziel angeboten werden („targets their opponent controls" = von mir kontrolliert) – falls es überhaupt zu dessen Wahl kommt.
// Beobachtet: der Wähler (Sitz 0) bekommt seine eigene gestohlene Kreatur als wählbares Ziel angeboten und fügt ihr 100 Schaden zu (HP 900).
// Ursache: `ricochet.js` `zieleAuf(engine, seite)` (Z. 71) nutzt `engine.getHeroTargets(seite)` / `getCreatureTargets(seite)` = PHYSISCHE Seite (`_engine.js:40250`), ohne Kontrollprüfung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const { steal } = (() => ({ steal: async (t, pi, inst) => { const r = await t.engine.actionStealCreature(pi, inst); t.gs._chainResolvingLock = false; return r; } }))();
  const chp = (c) => (c.counters.currentHp ?? H.DB[c.name].hp);
  const t = await H.fresh({ hand: [[], []], hp: 800 });
  const a = t.put(1, 0, 0, H.INERT.big);
  await steal(t, 0, a);
  R.check('Voraussetzung: Sitz 0 kontrolliert die Kreatur, sie liegt auf Seite 1', (a.controller ?? a.owner) === 0 && a.owner === 1, { owner: a.owner, controller: a.controller });
  t.hero(0, 1).atk = 100;
  for (const s of [0, 1]) for (let i = 0; i < 3; i++) t.gs.players[s].heroes[i].hp = (s === 0 && i === 1) ? 800 : 0;
  const gesehen = [];
  t.targetFn = (valid) => { gesehen.push(valid.map(v => v.id)); return [valid[0].id]; };
  await t.play(0, 'Ricochet', { hero: 1 });
  R.check('Sitz 0 darf seine eigene (gestohlene) Kreatur nicht als „Ziel des Gegners" wählen: HP bleibt 1000', chp(a) === 1000, { hp: chp(a), gesehen });
  R.finish();
})();
