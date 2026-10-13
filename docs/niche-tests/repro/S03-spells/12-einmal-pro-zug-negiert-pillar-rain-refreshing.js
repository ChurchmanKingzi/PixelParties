'use strict';
// S03-12 (Stufe C) · „You can only play 1 X per turn": ein NEGIERTES Exemplar zählt nicht – Pillar of Light / Rain of Arrows / Refreshing Night
// Kartentexte: „You can only play 1 "Pillar of Light" per turn." / „… 1 "Rain of Arrows" per turn." / „… 1 "Refreshing Night" per turn."
// Wie S01-02 (Big Oopsie): gestempelt wird erst im `onPlay` (`hoptUsed` bzw. `claimHOPT`), ein von Silence negierter Zauber führt `onPlay` nie aus.
// Aufbau: Sitz 0 hat zwei Kopien der Karte, Sitz 1 hat Silence (Held 0 mit Magic Arts). Erste Kopie wird negiert, danach zweite Kopie im selben Zug (Main 1).
// Lesart A „gespielt = gezählt": die zweite Kopie ist nicht spielbar.  Lesart B (Skript): die zweite Kopie wirkt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(card, vorbereiten, namePicker) {
    const t = await H.fresh({ hand: [[card, card], ['Silence']], deck: [['ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy', 'Fireball', 'ZZ Dummy']] });
    t.grantFor(1, 0, 'Silence');
    vorbereiten && vorbereiten(t);
    if (namePicker) t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero'); return [v.id]; };
    t.policy.confirm = true;                                  // Sitz 1 spielt Silence
    const r1 = await t.play(0, card, { hero: 0, phase: 2 });
    const negiert = !t.pile(1, 'hand').includes('Silence');
    t.policy.confirm = false; t.reset();
    const r2 = await t.play(0, card, { hero: 0, phase: 2 });
    return { r1, negiert, r2, fehler: t.errors.length };
  }
  let o = await lauf('Pillar of Light', null, true);
  R.check('Pillar of Light: erstes Exemplar negiert', o.negiert, o);
  R.check('Pillar of Light: zweites Exemplar im selben Zug nicht spielbar (Lesart A)', o.r2 === false, o);
  o = await lauf('Rain of Arrows', (t) => { t.put(0, 0, 0, H.INERT.creature); }, false);
  R.check('Rain of Arrows: erstes Exemplar negiert', o.negiert, o);
  R.check('Rain of Arrows: zweites Exemplar im selben Zug nicht spielbar (Lesart A)', o.r2 === false, o);
  o = await lauf('Refreshing Night', (t) => { t.gs.players[0].heroes[0].hp = 300; }, false);
  R.check('Refreshing Night: erstes Exemplar negiert', o.negiert, o);
  R.check('Refreshing Night: zweites Exemplar im selben Zug nicht spielbar (Lesart A)', o.r2 === false, o);
  R.finish();
})();
