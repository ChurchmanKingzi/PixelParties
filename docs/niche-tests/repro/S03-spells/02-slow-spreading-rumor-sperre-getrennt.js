'use strict';
// S03-02 · „You cannot interact with your opponent's hand for the rest of the turn" – Slow und Spreading Rumor sperren getrennt
// Kartentext Slow: „… You cannot interact with your opponent's hand for the rest of the turn afterwards."
// Kartentext Spreading Rumor: „… you may make this count as an additional Action, but if you do, you cannot interact with your opponent's hand for the rest of the turn afterwards."
// Aufbau: Sitz 0 hat Slow + Spreading Rumor + Rain of Spores auf der Hand, Sitz 1 hat 8 Handkarten (6 Dummys zuerst, 2 Fireball).
// Erwartet: Nach der einen Karte sind alle Hand-Interaktionen des Wirkers in diesem Zug gesperrt (die andere Karte lässt die Gegnerhand in Ruhe).
// Beobachtet: Slow setzt `ps.oppHandLocked` (gelesen nur von Slow und Arthor), Spreading Rumor setzt `ps._oppHandInteractionLockedTurn`
//   (gelesen von Spreading Rumor, Rain of Spores, Accusation, Gather Intel, Live Show, Letter of Misinformations). Die Flaggen kennen sich nicht:
//   Slow → Spreading Rumor / Rain of Spores wirken trotzdem; Spreading Rumor → Slow wirkt trotzdem.
const H = require('../../lib/h.js');
const GEGNERHAND = ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'Fireball', 'Fireball'];
(async () => {
  const R = H.runner();
  {
    R.section('A: Spreading Rumor (Main 1, erfolgreich) → danach Slow (Action Phase)');
    const t = await H.fresh({ hand: [['Spreading Rumor', 'Slow'], GEGNERHAND] });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    await t.play(0, 'Spreading Rumor', { hero: 0, phase: 2 });
    const before = t.pile(1, 'hand').length;
    t.reset();
    const r = await t.play(0, 'Slow', { hero: 0 });
    R.check('Slow lässt die Gegnerhand nach erfolgreichem Spreading Rumor in Ruhe', t.pile(1, 'hand').length === before, { r, before, after: t.pile(1, 'hand').length });
  }
  {
    R.section('B: Slow → danach Rain of Spores');
    const t = await H.fresh({ hand: [['Slow', 'Rain of Spores'], GEGNERHAND] });
    await t.play(0, 'Slow', { hero: 0 });
    const before = t.pile(1, 'hand').length;
    t.reset();
    const r = await t.play(0, 'Rain of Spores', { hero: 0 });
    R.check('Rain of Spores lässt die Gegnerhand nach Slow in Ruhe', t.pile(1, 'hand').length === before, { r, before, after: t.pile(1, 'hand').length });
  }
  {
    R.section('C: Slow → danach Spreading Rumor');
    const t = await H.fresh({ hand: [['Slow', 'Spreading Rumor'], GEGNERHAND] });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    await t.play(0, 'Slow', { hero: 0 });
    const before = t.pile(1, 'hand').filter(x => x === 'Fireball').length;
    t.reset();
    const r = await t.play(0, 'Spreading Rumor', { hero: 0 });
    const after = t.pile(1, 'hand').filter(x => x === 'Fireball').length;
    R.check('Spreading Rumor wirft nach Slow nichts ab', after === before, { r, before, after });
  }
  R.finish();
})();
