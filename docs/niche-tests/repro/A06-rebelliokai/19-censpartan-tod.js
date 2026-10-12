'use strict';
// A06-rebelliokai-19 · Censpartan War Counselor verlässt das Feld: der Schutzschirm der anderen Ratgeber bleibt dauerhaft
// Kartentext: „Other "War Counselor" Creatures you control cannot be chosen by your opponent's cards and effects." (gilt nur, solange Censpartan da ist)
// Beobachtung: `resyncShield` (censpartan-war-counselor.js) läuft nur über Censpartans eigene Hooks. Beim Verlassen (`onCardLeaveZone`) rechnet die
//   Funktion "alle ANDEREN Ratgeber unter meiner Kontrolle sollen den Schirm haben" – das sind weiterhin die übrigen → Schirm bleibt;
//   `onCreatureDeath` wird wegen `inst.zone !== 'support'` verworfen. Danach existiert kein Zuhörer mehr, der den Schirm abräumt.
// Erwartung: nach Censpartans Tod (Zerstörung/Bounce) trägt kein Ratgeber mehr den Schirm (`_censpartanShield`), Gegner kann ihn wählen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const wie of ['Zerstörung', 'Bounce auf die Hand']) {
    const t = await H.fresh({ hand: [[], []] });
    t.setHand(0, ['Censpartan War Counselor', 'Gorinthian War Counselor']);
    await t.play(0, 'Censpartan War Counselor', { hero: 0, slot: 0 });
    await t.play(0, 'Gorinthian War Counselor', { hero: 0, slot: 1 });
    const cen = t.find('Censpartan War Counselor', 'support'), gor = t.find('Gorinthian War Counselor', 'support');
    R.check(`[${wie}] Aufbau: Gorinthian trägt den Schirm`, !!gor.counters.untargetable_by_opponent, gor.counters);
    if (wie === 'Zerstörung') await t.run(() => t.engine.actionDestroyCard({ name: 'Opp Destroy', owner: 1, heroIdx: 0 }, cen));
    else await t.run(() => t.engine.actionMoveCard(cen, 'hand', -1, -1, { source: 'Opp Bounce' }));
    R.check(`[${wie}] Censpartan ist weg`, !t.find('Censpartan War Counselor', 'support'));
    R.check(`[${wie}] Gorinthian trägt den Schirm nicht mehr`, !gor.counters.untargetable_by_opponent, gor.counters);
    await t.endTurn(); await t.endTurn();
    R.check(`[${wie}] auch nach einem Zugumlauf kein Schirm`, !gor.counters.untargetable_by_opponent, gor.counters);
    R.check(`[${wie}] keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
