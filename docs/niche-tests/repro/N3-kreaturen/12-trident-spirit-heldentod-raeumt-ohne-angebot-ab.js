'use strict';
// N3-12 · Spirit of the Shattered Trident: Ausrüstung eines sterbenden Helden wird ohne Rückhol-Angebot in die Ablage geräumt
// Kartentext: „Whenever Artifacts equipped to Heroes you control would be moved from the board to anywhere except your hand, you may discard 1 card to add them back to your hand instead,
//   and if you do, gain Gold equal to half their Cost (rounded up)."
// Erwartet: Stirbt ein eigener Held mit Ausrüstung, wird die Ausrüstung vom Brett in die Ablage bewegt → das Angebot erscheint (wie bei einer Zerstörung, Gegenprobe).
// Beobachtet: Das Heldentod-Aufräumen (`handleHeroDeathCleanup`, _engine.js ~Z. 50715) feuert `onCardLeaveZone` mit `_onlyCard: inst` – nur der Abgänger selbst hört zu, der Spirit nie.
//   Ergebnis: kein Angebot, die Ausrüstung liegt in der Ablage (obwohl `_returnToHand` im Aufräumen sogar unterstützt wird: W16e F03-01 für die Ausrüstung selbst, The White Eye).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TR = 'Shattered Trident, Treasure of the Deepsea';
  const SP = 'Spirit of the Shattered Trident';
  async function aufbau() {
    const t = await H.fresh({ hand: [['ZZ Dummy', 'ZZ Dummy'], []], gold: [10, 10] });
    t.put(0, 0, 0, TR); t.put(0, 0, 1, SP).turnPlayed = 1;
    const e = t.put(0, 1, 0, 'Blade of the Frostbringer');       // Kosten 5 → 3 Gold
    t.script.push({ match: d => d.type === 'confirm' && d.title === SP, answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'forceDiscard' && d.title === SP, answer: () => ({ handIndex: 0, cardName: t.pile(0, 'hand')[0] }) });
    t.reset();
    return { t, e };
  }
  {
    const { t, e } = await aufbau();
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, controller: 1 }, e));
    R.check('Gegenprobe: zerstörte Ausrüstung → Angebot, Rückholung auf die Hand + 3 Gold',
      t.pile(0, 'hand').includes('Blade of the Frostbringer') && t.gs.players[0].gold === 13 && !t.pile(0, 'discardPile').includes('Blade of the Frostbringer'),
      { hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold, ablage: t.pile(0, 'discardPile') });
  }
  {
    const { t, e } = await aufbau();
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 1), 5000, 'creature'));
    R.check('Held 0/1 ist gefallen', t.hero(0, 1).hp <= 0, t.hero(0, 1).hp);
    R.check('Heldentod: dem Spirit-Besitzer wird die Rückholung angeboten', t.prompts.some(p => p.d.title === SP && p.d.type === 'confirm'), t.prompts.map(p => p.d.type + ':' + p.d.title));
    R.check('Heldentod: die Ausrüstung kommt (nach Annahme) auf die Hand statt in die Ablage', t.pile(0, 'hand').includes('Blade of the Frostbringer') && !t.pile(0, 'discardPile').includes('Blade of the Frostbringer'),
      { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
