'use strict';
// S03-12 · „You can only play 1 X per turn": ein GANZ NEGIERTES Exemplar zählt NICHT – Pillar of Light / Rain of Arrows / Refreshing Night (Als Entscheidung, Welle 3)
// Kartentexte: „You can only play 1 "Pillar of Light" per turn." / „… 1 "Rain of Arrows" per turn." / „… 1 "Refreshing Night" per turn."
// REGEL (CARD_API.md „★ Z7b"): ein von Silence komplett negierter Zauber hat nie aufgelöst → der Zug-Slot ist unverbraucht; die zweite Kopie im selben Zug ist spielbar.
// Aufbau: Sitz 0 hat zwei Kopien der Karte, Sitz 1 hat Silence (Held 0 mit Magic Arts). Erste Kopie wird negiert, danach zweite Kopie im selben Zug (Main 1).
// Exit 1 (Fehler tritt auf) = die zweite Kopie ist nach der Negierung nicht spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(card, vorbereiten, namePicker, opt) {
    const t = await H.fresh({ hand: [[card, card], ['Silence']], deck: [['ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy', 'Fireball', 'ZZ Dummy']] });
    t.grantFor(1, 0, 'Silence');
    vorbereiten && vorbereiten(t);
    if (namePicker) t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero'); return [v.id]; };
    t.policy.confirm = true;                                  // Sitz 1 spielt Silence
    const r1 = await t.play(0, card, Object.assign({ hero: 0 }, opt));
    const negiert = !t.pile(1, 'hand').includes('Silence');
    t.policy.confirm = false; t.reset();
    const r2 = await t.play(0, card, Object.assign({ hero: 0 }, opt));
    return { r1, negiert, r2, fehler: t.errors.length, uebrig: t.pile(0, 'hand').filter(n => n === card).length };
  }
  const ZUSATZ = { phase: 2 };                              // Pillar/Refreshing Night sind Zusatzaktionen (Main 1); Rain of Arrows ist eine normale Aktion
  let o = await lauf('Pillar of Light', null, true, ZUSATZ);
  R.check('Pillar of Light: erstes Exemplar negiert', o.negiert, o);
  R.check('Pillar of Light: zweites Exemplar im selben Zug ist spielbar', o.r2 === true && o.uebrig === 0, o);
  o = await lauf('Rain of Arrows', (t) => { t.put(0, 0, 0, H.INERT.creature); }, false, {});
  R.check('Rain of Arrows: erstes Exemplar negiert', o.negiert, o);
  R.check('Rain of Arrows: zweites Exemplar im selben Zug ist spielbar', o.r2 === true && o.uebrig === 0, o);
  o = await lauf('Refreshing Night', (t) => { t.gs.players[0].heroes[0].hp = 300; }, false, ZUSATZ);
  R.check('Refreshing Night: erstes Exemplar negiert', o.negiert, o);
  R.check('Refreshing Night: zweites Exemplar im selben Zug ist spielbar', o.r2 === true && o.uebrig === 0, o);
  R.finish();
})();
