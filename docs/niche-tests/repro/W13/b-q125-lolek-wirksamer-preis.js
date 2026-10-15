'use strict';
// W13 / Q125 (H03-heroes-18) · Lolek, the Shard Knight: „equip it … by paying half its Cost" (Al: „Den aktuellen") → die Hälfte des aktuell WIRKSAMEN Preises
// (Laser Cannon: −20 je Kopie in der Ablage, die gewählte Kopie zählt nicht mit → 0–20 ⇒ 0–10 Gold), nicht des gedruckten. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const LC = 'Future Tech Laser Cannon';
(async () => {
  const R = H.runner();
  async function lauf(discard, gold) {
    const t = await H.fresh({ heroes: [['Lolek, the Shard Knight', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 600, discard: [discard, []], gold: [gold, 100] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'equip' }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Lolek/.test(d.title || ''), answer: () => ({ cardName: discard[0], source: 'discard' }) });
    const g0 = t.gs.players[0].gold;
    const r = await t.activateHero(0, 0, { effect: 'Lolek, the Shard Knight' });
    return { r, bezahlt: g0 - t.gs.players[0].gold, errors: t.errors };
  }
  let x = await lauf([LC, LC, LC], 100);
  R.check('3 Laser Cannons in der Ablage: wirksamer Preis 20 (ohne gewählte Kopie) → Lolek zahlt 10', x.r && x.bezahlt === 10, x);
  x = await lauf([LC, LC], 100);
  R.check('2 Laser Cannons: wirksamer Preis 40 → 20 Gold', x.r && x.bezahlt === 20, x);
  x = await lauf([LC], 100);
  R.check('1 Laser Cannon (kein Rabatt): gedruckter = wirksamer Preis 60 → 30 Gold', x.r && x.bezahlt === 30, x);
  x = await lauf([LC, LC, LC], 10);
  R.check('Gold genau 10 reicht für 3 Kopien (wirksam 20 → 10)', x.r && x.bezahlt === 10, x);
  x = await lauf(['Glass Sword'], 100);
  R.check('Karte ohne Preisänderung: Hälfte des Grundpreises (Glass Sword 2 → 1)', x.r && x.bezahlt === 1, x);
  R.check('keine Engine-Fehler', x.errors.length === 0, x.errors);
  R.finish();
})();
