'use strict';
// W75 · Darion (Audit P1) — The White Eye im Equip-Stapel: „When this card is sent to your discard pile for any reason EXCEPT being discarded from your hand, it immediately returns to your hand."
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: Das Auge kehrt auf die Hand zurueck, egal ob es unten, in der Mitte oder oben im Stapel liegt (bisher nur, wenn es die UNTERSTE Karte war: der Abgang suchte „die erste Instanz am Platz").
//           Die Nachbarn bleiben liegen; Darions Tod raeumt alle Equips ab, das Auge geht auf die Hand, die anderen in die Ablage.
// Aufruf: node docs/niche-tests/repro/W75/h-P1-01-white-eye-kehrt-aus-dem-stapel-zurueck.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
const WE = 'The White Eye';
async function szene(darion, pos) {
  const t = await H.fresh({ active: 0, heroes: [[darion ? D : T, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [[WE, 'Club of Gobbo', 'Cute Crown', F], [F]], gold: 500, deckSize: 30 });
  const reihe = ['Club of Gobbo', 'Cute Crown']; reihe.splice(pos, 0, WE);
  for (let i = 0; i < reihe.length; i++) await t.play(0, reihe[i], { hero: 0, slot: darion ? 1 : i });
  return t;
}
(async () => {
  const R = H.runner();
  for (const pos of [0, 1, 2]) {
    R.section(`Auge an Stelle ${pos} des Stapels zerstoert`);
    const t = await szene(true, pos);
    const we = t.inst(c => c.name === WE && c.zone === 'support')[0];
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, we));
    R.check('Auge wieder auf der Hand', t.pile(0, 'hand').includes(WE) && !t.pile(0, 'discardPile').includes(WE), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
    R.check('Nachbarn liegen weiter im Stapel', JSON.stringify(t.gs.players[0].supportZones[0][1].slice().sort()) === JSON.stringify(['Club of Gobbo', 'Cute Crown']), t.gs.players[0].supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Darion stirbt: Auge auf die Hand, die anderen in die Ablage');
  {
    const t = await szene(true, 1);
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.gs.players[0].heroes[0], 9999, 'normal'));
    R.check('Auge auf der Hand', t.pile(0, 'hand').includes(WE), t.pile(0, 'hand'));
    R.check('Club und Crown in der Ablage', ['Club of Gobbo', 'Cute Crown'].every(n => t.pile(0, 'discardPile').includes(n)) && !t.pile(0, 'discardPile').includes(WE), t.pile(0, 'discardPile'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Kontrolle (normaler Held, getrennte Plaetze): gleiches Ergebnis');
  {
    const t = await szene(false, 1);
    const we = t.inst(c => c.name === WE && c.zone === 'support')[0];
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, we));
    R.check('Auge auf der Hand', t.pile(0, 'hand').includes(WE));
  }
  R.finish();
})();
