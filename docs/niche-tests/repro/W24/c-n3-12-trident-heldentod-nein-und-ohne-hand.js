'use strict';
// W24 · N3-12 Ergänzung: Heldentod mit Ausrüstung – „Let it go" legt die Ausrüstung wie bisher in die Ablage; ohne Handkarte gibt es kein Angebot.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TR = 'Shattered Trident, Treasure of the Deepsea', SP = 'Spirit of the Shattered Trident', BL = 'Blade of the Frostbringer';
  async function lauf(hand, antwort) {
    const t = await H.fresh({ hand: [hand, []], gold: [10, 10] });
    t.put(0, 0, 0, TR); t.put(0, 0, 1, SP).turnPlayed = 1;
    t.put(0, 1, 0, BL);
    t.script.push({ match: d => d.type === 'confirm' && d.title === SP, answer: () => (antwort ? { confirmed: true } : null) });
    t.script.push({ match: d => d.type === 'forceDiscard' && d.title === SP, answer: () => ({ handIndex: 0, cardName: t.pile(0, 'hand')[0] }) });
    t.reset();
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 1), 5000, 'creature'));
    return { angebot: t.prompts.some(p => p.d.title === SP && p.d.type === 'confirm'), hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold, errors: t.errors };
  }
  const nein = await lauf(['ZZ Dummy'], false);
  R.check('Nein: Angebot kam, Ausrüstung in der Ablage, kein Gold', nein.angebot && nein.ablage.includes(BL) && !nein.hand.includes(BL) && nein.gold === 10, nein);
  const leer = await lauf([], true);
  R.check('Ohne Handkarte: kein Angebot, Ausrüstung in der Ablage', !leer.angebot && leer.ablage.includes(BL), leer);
  R.check('keine Engine-Fehler', nein.errors.length + leer.errors.length === 0);
  R.finish();
})();
