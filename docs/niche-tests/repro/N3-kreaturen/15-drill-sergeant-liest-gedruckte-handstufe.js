'use strict';
// N3-15 · Drill Sergeant: „level 1 or lower Creature from your hand" liest die gedruckte Stufe; Slave Trader und Psychic Scout lesen die Stufe in der Hand (Stufe C)
// Kartentext (Drill Sergeant): „… choose a level 1 or lower Creature from your hand and place it …" · (Slave Trader) „discard a level 3 Creature from your hand" · (Psychic Scout) „summon a level 0 Creature from your hand"
// Kartentext (Embodiment of Biseria): „This Creature's level in your hand is reduced by the combined original levels of all Creatures on the board … to a minimum of 1."
// Aufbau: Auf dem Brett liegen Stufen 3+3+2 = 8 (Field Cannon, Foresta, Duigno); Biseria (gedruckt 9) hat damit in der Hand die Stufe 1.
// Beobachtet: Der Drill Sergeant ist NICHT aktivierbar (er liest `cd.level` = 9, `drill-sergeant.js` Z. 54, Kopfkommentar „liest den gedruckten Level der Handkarte");
//   Slave Trader (`engine.effectiveCardLevel(cd, pi, { handIdx })`) akzeptiert Biseria bei effektiver Stufe 3 als Level-3-Kosten (Gegenprobe), Psychic Scout rechnet ebenso mit `effectiveCardLevel`.
// Frage an Al: siehe Bericht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const B = 'Embodiment of Biseria';
  const t = await H.fresh({ hand: [[B], []] });
  t.put(0, 0, 0, 'Drill Sergeant').turnPlayed = 1;
  t.put(0, 1, 0, 'Field Cannon'); t.put(1, 0, 0, 'Foresta, the Guard'); t.put(1, 1, 0, 'Duigno, the Flaming Phoenix');
  const eff = t.engine.effectiveCardLevel(H.DB[B], 0, { handIdx: 0 });
  R.check('Aufbau: Biseria hat in der Hand die effektive Stufe 1', eff === 1, eff);
  // Gegenprobe: Slave Trader nimmt dieselbe Karte bei effektiver Stufe 3 als „level 3 Creature" an (Main Phase → Zusatzaktion gegen Abwurf)
  {
    const u = await H.fresh({ hand: [['Slave Trader', B], []] });
    u.put(0, 1, 0, 'Field Cannon'); u.put(1, 0, 0, 'Foresta, the Guard');          // 3 + 3 = 6 → Biseria hat Stufe 3
    const e3 = u.engine.effectiveCardLevel(H.DB[B], 0, { handIdx: 1 });
    R.check('Gegenprobe: Biseria hat bei Brettstufen 6 die effektive Stufe 3', e3 === 3, e3);
    let angeboten = null;
    u.script.push({ match: d => d.type === 'forceDiscardCancellable' && d.title === 'Slave Trader', answer: d => { angeboten = (d.eligibleIndices || []).map(i => u.pile(0, 'hand')[i]); return null; } });
    await u.play(0, 'Slave Trader', { hero: 0, phase: 2 });
    R.check('Gegenprobe: Slave Trader bietet Biseria als Level-3-Abwurfkosten an', Array.isArray(angeboten) && angeboten.includes(B), angeboten);
  }
  let gesehen = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Drill Sergeant', answer: d => { gesehen = d.cards.map(c => c.name); return null; } });
  t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
  await t.activateCreature(0, 0, 0);
  R.check('Drill Sergeant bietet Biseria (Handstufe 1) an', Array.isArray(gesehen) && gesehen.includes(B), gesehen);
  R.finish();
})();
