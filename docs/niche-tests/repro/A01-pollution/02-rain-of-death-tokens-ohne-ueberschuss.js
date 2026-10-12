'use strict';
// A01-pollution-02 · Rain of Death: Tokens = ALLE entfernten gegnerischen Abilities statt nur der Überschuss
// Kartentext: „Delete all Abilities on the board that aren't Starting Abilities. Place 1 Pollution Token into your free Support Zones
//   for every one of your opponent's removed Abilities IN EXCESS OF the number of your removed Abilities.“
// Erwartung: Tokens = max(0, gegnerisch entfernt − eigene entfernt).
// Beobachtet: Tokens = gegnerisch entfernt (die eigenen entfernten Abilities werden nicht abgezogen); außerdem ist die Karte
//   mit zu wenigen freien Zonen unspielbar, obwohl der Überschuss 0 wäre (spellPlayCondition vergleicht ebenfalls die rohe Zahl).
// Ursache: cards/effects/rain-of-death.js – onPlay `placePollutionTokens(engine, pi, oppRemovable.length, …)` und spellPlayCondition.
// Aufruf: node docs/niche-tests/repro/A01-pollution/02-rain-of-death-tokens-ohne-ueberschuss.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const D = 'Dante, the Wanderer of Hell';      // Startfähigkeiten: Destruction Magic + Luck (je 1 Kopie)
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
const mk = (myAb, oppAb) => H.fresh({ hand: [['Rain of Death'], []],
  heroes: [[D, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], [D, 'Atta, Speaker of Desires', 'Hulijing, the Foxdemon']],
  abilities: { 0: { 0: myAb }, 1: { 0: oppAb } } });
(async () => {
  const R = H.runner();
  const DM3 = ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], LK3 = ['Luck', 'Luck', 'Luck'];
  // Fall 1: ich entferne 2 (DM×3 → 2 überzählig), Gegner 4 (DM×3 + Luck×3) → Überschuss 2.
  let t = await mk([DM3, ['Luck'], []], [DM3, LK3, []]);
  await t.play(0, 'Rain of Death', { hero: 0, noGrant: true });
  R.check('Fall 1: Tokens = 4 − 2 = 2', tokens(t, 0) === 2, tokens(t, 0));
  // Fall 2: ich entferne 4, Gegner 1 → Überschuss 0.
  t = await mk([DM3, LK3, []], [['Destruction Magic', 'Destruction Magic'], ['Luck'], []]);
  await t.play(0, 'Rain of Death', { hero: 0, noGrant: true });
  R.check('Fall 2: gegnerisch 1, eigene 4 → 0 Tokens', tokens(t, 0) === 0, tokens(t, 0));
  // Fall 3: beide entfernen 4, ich habe nur 1 freie Zone → Überschuss 0, also spielbar.
  t = await mk([DM3, LK3, []], [DM3, LK3, []]);
  const ps = t.gs.players[0]; let kept = 0;
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) { if (!ps.heroes[hi].name || ps.supportZones[hi][z].length) continue; if (kept < 1) { kept++; continue; } t.put(0, hi, z, H.INERT.creature); }
  await t.play(0, 'Rain of Death', { hero: 0, noGrant: true });
  R.check('Fall 3: bei 1 freier Zone und Überschuss 0 spielbar (Karte aus der Hand)', !t.pile(0, 'hand').includes('Rain of Death'), t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
