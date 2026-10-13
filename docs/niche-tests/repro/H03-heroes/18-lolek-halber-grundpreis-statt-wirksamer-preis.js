'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-18 · Lolek, the Shard Knight: „half its Cost" rechnet vom gedruckten Grundpreis, nicht vom wirksamen Preis (Future Tech Laser Cannon)
//
//  Karten: Lolek, the Shard Knight (`lolek-the-shard-knight.js` + `_lolek-shared.js: halfCost(cd) = ceil(cd.cost / 2)`); Future Tech Laser Cannon (`selfCostReduction`)
//  Kartentext Lolek: „… choose an equippable Artifact from your discard pile and equip it to a Hero you control by paying half its Cost."
//  Laser Cannon: „This card's Cost is decreased by 20 for every copy of „Future Tech Laser Cannon" in your discard pile." (Cost 60; Ruling 21.8.: sie zählt sich selbst nicht mit)
//  Engine: der wirksame Artefakt-Preis steht in `engine.artifactPlayCost(pi, name, handIdx, opts)` (Rusting-Crystal-Verdoppelung, Spieler-/Handrabatte, `selfCostReduction`,
//  Zielheld-Rabatt `equipCostReduction`); der normale Spielweg rechnet damit.
//  Aufbau: Sitz 0: Lolek, Laser Cannon ×3 in der Ablage, 100 Gold.
//  Erwartung (Lesart A, „Cost" = der aktuell wirksame Preis der Karte): die Engine selbst rechnet `artifactPlayCost` = 0 (3 Kopien in der Ablage, −60); selbst ohne die gewählte
//  Kopie wäre der Preis 60 − 2×20 = 20. Die Hälfte davon ist höchstens 10 Gold.
//  Beobachtung (✗ für Lesart A): Lolek berechnet die Hälfte vom Grundpreis 60 → 30 Gold. (Lesart B, „gedruckter Cost", wäre 30.)
//  Aufruf: node docs/niche-tests/repro/H03-heroes/18-lolek-halber-grundpreis-statt-wirksamer-preis.js
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const LC = 'Future Tech Laser Cannon';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Lolek, the Shard Knight', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 600, discard: [[LC, LC, LC], []], gold: [100, 100] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'equip' }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Lolek/.test(d.title || ''), answer: () => ({ cardName: LC, source: 'discard' }) });
  const wirksam = t.engine.artifactPlayCost(0, LC, 0, {});
  R.note('artifactPlayCost (ohne Zielheld)', wirksam);
  const g0 = t.gs.players[0].gold;
  const r = await t.activateHero(0, 0, { effect: 'Lolek, the Shard Knight' });
  const bezahlt = g0 - t.gs.players[0].gold;
  R.note('Lolek', { r, bezahlt });
  R.check('Lolek zahlt höchstens die Hälfte des wirksamen Preises (≤ 10)', bezahlt <= 10, bezahlt);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
