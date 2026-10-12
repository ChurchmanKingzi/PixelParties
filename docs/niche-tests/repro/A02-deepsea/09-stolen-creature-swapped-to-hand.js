'use strict';
// A02-deepsea-09 · Shapeshift / Deepsea Castle: eine per Succubus geliehene Gegnerkreatur landet dauerhaft auf MEINER Hand
//
// Kartentext (Deepsea Castle): „Both players may once per turn add a Creature in one of THEIR Heroes' Support Zones to their hand
// and then place a Creature with the same or a lower level and a different name from their hand into the same Support Zone."
// Kartentext (Shapeshift): „Choose a Creature in one of YOUR Heroes' Support Zones and add it to your hand. …"
// Kartentext (Succubus): „… take control of it until the end of the turn …" – die Kreatur bleibt in der Zone des GEGNERISCHEN Helden.
// Konvention: CARD_API „Gestohlene Karten gehen in die Ablage ihres Besitzers"; `returnSupportCreatureToHand` schickt Rückgaben an den Besitzer.
// Erwartung: Eine geliehene Kreatur steht nicht in „meinen Helden"-Zonen → sie ist kein Ziel von Shapeshift/Castle; jedenfalls wandert die
//   Karte nie auf meine Hand.
// Beobachtet: `ownSupportCreatures` (Kontrolle statt Seite, für geliehene Helden gedacht) nimmt sie auf; `atomicSwap` schiebt ihren Namen auf MEINE
//   Hand (`ps = gs.players[pi]`), meine Handkarte landet in der Zone des Gegners. Die Gegnerkarte ist danach dauerhaft meine (Kartendiebstahl).
// Ursache: `_deepsea-shared.js` `ownSupportCreatures` (Z. ~892) / `atomicSwap` (Z. ~953–1100): kein Unterschied zwischen „Kreatur auf geliehenem Helden"
//   (Styx) und „geliehene Kreatur auf gegnerischem Helden" (`stolenBy`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const spell of ['Shapeshift', 'Deepsea Castle']) {
    R.section('Succubus-geliehene Gegnerkreatur + ' + spell);
    const t = await H.fresh({ hand: [[spell, 'Deepsea Succubus', H.INERT.creature], []] });
    const x = t.put(1, 1, 0, 'Deepsea Poltergeister'); x.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, 'Deepsea Succubus', { hero: 0, slot: 0 });
    R.check('Vorbedingung: Poltergeister gehört dem Gegner, ist mir geliehen', x.owner === 1 && x.controller === 0 && x.stolenBy === 0, [x.owner, x.controller, x.stolenBy]);
    t.targetFn = null;
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(z => /Poltergeister/.test(z.label)); return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner } : null; } });
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf(H.INERT.creature); return { cardName: H.INERT.creature, handIndex: i, selectedCards: [{ cardName: H.INERT.creature, handIndex: i }] }; } });
    if (spell === 'Shapeshift') await t.play(0, 'Shapeshift', { hero: 0 });
    else { await t.play(0, 'Deepsea Castle', { hero: 0 }); t.phase(2); await t.run(() => t.engine.activateAreaEffect(0, 0, 'Deepsea Castle')); }
    R.check('Die Gegnerkarte (Deepsea Poltergeister) liegt NICHT auf meiner Hand', !t.pile(0, 'hand').includes('Deepsea Poltergeister'), { hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') });
    R.check('Meine Handkarte wurde nicht in die Zone des Gegners gelegt', t.gs.players[1].supportZones[1][0][0] !== H.INERT.creature, t.gs.players[1].supportZones[1][0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
