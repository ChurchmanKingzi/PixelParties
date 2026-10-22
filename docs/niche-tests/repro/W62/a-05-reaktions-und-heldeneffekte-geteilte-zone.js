'use strict';
// W62a-05 · Heldeneffekt „place" mit Schadenstrigger (Cute Ditz Monami) kennt die Alice-Teilung (Al, 22.10.2026)
//
// Kartentext Cute Ditz Monami: „Whenever a Hero you control takes damage from an opponent's card or effect, you may place a "Cute" Creature from your hand into that Hero's free
//   Support Zone, and if you do, draw a card."
// Kartentext Alice, the Transfer Student: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. …"
// Erwartung (Auslegung wie beim Hand-Weg): ist die Zone des getroffenen Helden von GLEICHNAMIGEN Cute-Kreaturen belegt, ist sie ein Ziel für eine weitere Kopie; ohne Alice-Teilung
//   ist die Zone nicht „free" (Gegenprobe).
// Die Opfer-Zonen-Regeln (W17a/W19/W20, Zone nach Kostenzahlung) bleiben unberührt: sie laufen in den bestehenden Repros W17/a-ersetzen-alice-stapel-gegenproben und W19/a-2 weiter.
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student', MONAMI = 'Cute Ditz Monami', BUNNY = 'Cute Bunny', BIG = H.INERT.big;

async function brett(seat, o = {}) {
  const alice = o.alice !== false;
  const eigene = [MONAMI, alice ? ALICE : 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const t = await H.fresh({ heroes, hand: seat === 0 ? [[BUNNY, BUNNY], []] : [[], [BUNNY, BUNNY]], deck: [Array(10).fill(H.INERT.creature), Array(10).fill(H.INERT.creature)] });
  const ps = t.gs.players[seat], opp = 1 - seat;
  for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) { const i = t.put(seat, h, z, BIG); i.turnPlayed = 1; }
  for (const i of t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0)) t.engine._untrackCard(i.id);
  ps.supportZones[0][0] = [];
  for (let k = 0; k < 2; k++) { ps.supportZones[0][0].push(BUNNY); const i = t.engine._trackCard(BUNNY, seat, 'support', 0, 0); i.turnPlayed = 1; }
  t.put(opp, 0, 0, BIG).turnPlayed = 1;
  t.gs.turn = 5; t.gs.activePlayer = opp;
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: BUNNY, source: 'hand' }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(q => q.heroIdx === 0 && q.slotIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  return t;
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Sitz ${seat}: Monami, Held 0 erleidet Schaden von der Gegenseite, Brett voll, Zone A = 2 × Cute Bunny (Alice-Stapel)`);
    { const t = await brett(seat);
      const handVor = t.gs.players[seat].hand.length;
      await t.run(() => t.engine.actionDealDamage({ name: 'Killer', owner: opp, controller: opp, heroIdx: 0 }, t.gs.players[seat].heroes[0], 100, 'destruction_spell'));
      const z = t.gs.players[seat].supportZones[0][0];
      R.check('Zone A hält jetzt 3 Cute Bunnys (Place in die geteilte Zone)', z.length === 3 && z.every(n => n === BUNNY), z);
      R.check('Hand: 1 Karte platziert (−1) und 1 Karte gezogen (+1)', t.gs.players[seat].hand.length === handVor, { vor: handVor, nach: t.gs.players[seat].hand.length });
      R.check('drei Bunny-Instanzen in Zone A', t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0 && c.name === BUNNY).length === 3, null);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(seat, { alice: false });
      await t.run(() => t.engine.actionDealDamage({ name: 'Killer', owner: opp, controller: opp, heroIdx: 0 }, t.gs.players[seat].heroes[0], 100, 'destruction_spell'));
      const z = t.gs.players[seat].supportZones[0][0];
      R.check('GEGENPROBE ohne Alice: die Zone ist nicht „free" — nichts wird platziert, keine Karte gezogen', z.length === 2 && t.gs.players[seat].hand.length === 2, { z, hand: t.gs.players[seat].hand.length });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
