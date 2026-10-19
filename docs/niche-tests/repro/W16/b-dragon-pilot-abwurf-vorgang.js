'use strict';
// W16b · A03-futuretech-07 (Erweiterung) · Steam Dwarf Dragon Pilot: „when you discard 1 or more cards" = je Vorgang einmal
// (a) `actionDiscardCardsAnimated(0, 3)` (Mehrfach-Abwurf ohne Stapelabfrage) = EINE Rückfrage, 100 Schaden.
// (b) Zwei getrennte Abwürfe (zwei Vorgänge) = zwei Rückfragen; die dritte Ladung bleibt für den Zug.
// (c) „Nein" im Vorgang fragt für die weiteren Karten desselben Vorgangs nicht erneut.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fragen = (t) => t.prompts.filter(x => /fireball for/i.test(x.d.message || '')).length;

  R.section('(a) actionDiscardCardsAnimated 3 Karten');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
    const p = t.put(0, 0, 1, 'Steam Dwarf Dragon Pilot'); p.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.owner === 1).id];
    await t.run(() => t.engine.actionDiscardCardsAnimated(0, 3, { source: 'Test', selfInflicted: true }));
    R.check('eine Rückfrage', fragen(t) === 1, fragen(t));
    R.check('100 Schaden', t.hp(1, 0) === 700, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) zwei Vorgänge');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
    const p = t.put(0, 0, 1, 'Steam Dwarf Dragon Pilot'); p.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.owner === 1).id];
    await t.run(() => t.engine.actionPromptForceDiscard(0, 2, { source: 'Test', selfInflicted: true }));
    await t.run(() => t.engine.actionPromptForceDiscard(0, 1, { source: 'Test', selfInflicted: true }));
    R.check('zwei Rückfragen', fragen(t) === 2, fragen(t));
    R.check('200 Schaden', t.hp(1, 0) === 600, t.hp(1, 0));
  }

  R.section('(c) „Nein" im Vorgang');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
    const p = t.put(0, 0, 1, 'Steam Dwarf Dragon Pilot'); p.turnPlayed = 1;
    t.script.push({ match: d => d && d.type === 'confirm' && /fireball for/i.test(d.message || ''), answer: () => null });
    await t.run(() => t.engine.actionPromptForceDiscard(0, 3, { source: 'Test', selfInflicted: true }));
    R.check('nur EINE Rückfrage trotz „Nein"', fragen(t) === 1, fragen(t));
    R.check('kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
