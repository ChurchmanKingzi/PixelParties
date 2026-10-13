'use strict';
// A04-cute-23 (A) · Non-Fungible Monkee zahlt bei Schadens-Tod eines Monkee NICHTS aus (nur bei Zerstören/Verschieben)
//
// Kartentext (Non-Fungible Monkee): "Whenever a "Monkee" Creature is placed into one of your Heroes' Support Zones or leaves the board, you gain 4 Gold."
// Erwartung: stirbt ein Monkee (eigen oder gegnerisch) durch Schaden, verlässt er das Brett -> +4 Gold.
// Beobachtet: durch Fireball getötet -> 0 Gold; durch actionDestroyCard -> +4 Gold. Grund: beim Schadens-Tod läuft `onCardLeaveZone`
//   nur für die sterbende Karte selbst (Ctx mit `_onlyCard`), Non-Fungible Monkee (`non-fungible-monkee.js` onCardLeaveZone) wird nicht gefragt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const NF = 'Non-Fungible Monkee';
  const mk = async (o = {}) => {
    const t = await H.fresh(Object.assign({ deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)], gold: [10, 10] }, o));
    t.put(0, 0, 0, NF);
    return t;
  };
  R.section('Eigener Monkee stirbt durch einen echten Fireball des Gegners');
  {
    const t = await mk({ hand: [[], ['Fireball']] });
    t.put(0, 1, 0, 'Resilient Monkee');
    const g0 = t.gs.players[0].gold;
    t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.cardName === 'Resilient Monkee').id];
    t.gs.activePlayer = 1;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Monkee ist tot (Ablage)', t.pile(0, 'discardPile').includes('Resilient Monkee'), t.pile(0, 'discardPile'));
    R.check('+4 Gold (Monkee verlässt das Brett)', t.gs.players[0].gold - g0 === 4, { delta: t.gs.players[0].gold - g0 });
  }
  R.section('Gegenprobe: derselbe Monkee wird zerstört (actionDestroyCard)');
  {
    const t = await mk();
    const m = t.put(0, 1, 0, 'Resilient Monkee');
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 }, m));
    R.check('+4 Gold bei Zerstören', t.gs.players[0].gold - g0 === 4, { delta: t.gs.players[0].gold - g0 });
  }
  R.section('Gegnerischer Monkee stirbt durch Schaden');
  {
    const t = await mk();
    const m = t.put(1, 1, 0, 'Resilient Monkee');
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'T', owner: 0 }, m, 500, 'creature', { sourceOwner: 0 }));
    R.check('+4 Gold (Kartentext: ein Monkee, nicht nur eigene)', t.gs.players[0].gold - g0 === 4, { delta: t.gs.players[0].gold - g0 });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
