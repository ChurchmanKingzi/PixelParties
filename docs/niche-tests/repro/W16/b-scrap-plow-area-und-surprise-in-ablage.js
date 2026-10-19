'use strict';
// W16b · A03-futuretech-16 (Erweiterung) · Debt-O-Tron Model Scrap Plow: die gewählte Area geht in die Ablage ihres Besitzers
// Kartentext: „… you may choose any card on the board that is not a Hero and send it to the discard pile."
const H = require('../../lib/h.js');
const KENT = 'Kent, the Indebted Apprentice', SP = 'Debt-O-Tron Model Scrap Plow';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Future Tech Fists'], []], gold: [0, 100] });
  t.setHero(0, 0, KENT, 400);
  t.putArea(1, 'Rioting Village');
  t.put(0, 2, 2, SP).turnPlayed = 1;
  t.targetFn = (valid) => { const a = valid.find(v => v.type === 'area'); return a ? [a.id] : null; };
  await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });
  R.check('Rioting Village ist nicht mehr in der Area-Zone des Gegners', !t.gs.areaZones[1].includes('Rioting Village'), t.gs.areaZones[1]);
  R.check('Rioting Village liegt in der Ablage des Besitzers (Sitz 1)', t.pile(1, 'discardPile').includes('Rioting Village'), t.pile(1, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
