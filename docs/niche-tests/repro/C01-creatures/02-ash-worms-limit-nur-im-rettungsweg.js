'use strict';
// C01-creatures-02 · Ash Worms: „You can only summon 1 "Ash Worms" per turn" gilt nur fuer die Rettungs-Beschwoerung
// Kartentext: „When this Creature is deleted from anywhere, you may immediately summon it as an additional Action with any Hero you control and draw 1 card.
//   You can only summon 1 "Ash Worms" per turn."
// Aufbau: Sitz 0 spielt Ash Worms regulaer aus der Hand (Summoning Magic Lv1), danach wird eine zweite Kopie aus der Ablage geloescht (Ja, erste Zone).
// Erwartung: In diesem Zug wurde schon ein Ash Worms beschworen -> die zweite Beschwoerung (auch die Rettung) darf nicht stattfinden; die Karte wird normal geloescht.
//   Zweite Frage (Teil B): zwei Ash Worms nacheinander aus der Hand im selben Zug (mit Zusatzaktion) duerfen ebenfalls nicht beide landen.
// Beobachtet: Die Rettung beschwoert die zweite Kopie trotzdem (2 Ash Worms auf dem Brett, Ablage/Geloescht leer); auch zwei Handspiele gelingen.
// Ursache: cards/effects/ash-worms.js hat nur den Stempel `gs.hoptUsed['ash-worms:<pi>']` im Rettungsweg (beforeDelete); weder `canSummon` noch `beforeSummon`
//   pruefen ihn, und der Stempel wird von der Handbeschwoerung nie gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const zp = (t) => t.script.push({ match: d => d.type === 'zonePick', answer: d => { const z = d.zones[0]; return { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
  const anzahl = (t) => t.inst(c => c.name === 'Ash Worms' && c.zone === 'support').length;
  R.section('A) Handspiel, dann Rettung einer 2. Kopie im selben Zug');
  {
    const t = await H.fresh({ hand: [['Ash Worms'], []], discard: [['Ash Worms'], []] }); zp(t);
    t.grantFor(0, 0, 'Ash Worms');
    await t.play(0, 'Ash Worms', { slot: 0 });
    await t.run(() => t.engine.deleteFromPile(0, 'discard', 'Ash Worms', { source: 'Test' }));
    R.check('nur EIN Ash Worms in diesem Zug beschworen (zweite Kopie bleibt geloescht)', anzahl(t) === 1, { aufDemBrett: anzahl(t), geloescht: t.gs.players[0].deletedPile });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('B) Zwei Handspiele im selben Zug (Zusatzaktion simuliert)');
  {
    const t = await H.fresh({ hand: [['Ash Worms', 'Ash Worms'], []] }); zp(t);
    t.grantFor(0, 0, 'Ash Worms');
    await t.play(0, 'Ash Worms', { slot: 0 });
    await t.play(0, 'Ash Worms', { slot: 1 });
    R.check('zweites Handspiel von Ash Worms im selben Zug wird abgelehnt', anzahl(t) === 1, { aufDemBrett: anzahl(t) });
  }
  R.finish();
})();
