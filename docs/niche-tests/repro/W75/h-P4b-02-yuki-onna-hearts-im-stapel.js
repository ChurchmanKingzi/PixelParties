'use strict';
// W75 · Darion — Cold-Hearted Yuki-Onna schickt „any number of Heart of Ice" aus einem Equip-Stapel in die Ablage (Audit P4b, Klasse A).
// Kartentext: „When you summon this Creature, send any number of "Heart of Ice" Artifacts equipped to Heroes you control to your discard pile to trigger the following effects in sequence, depending on the number sent. 1+: Freeze all targets your opponent controls for 1 turn. 2+: Deal 100 damage to all targets your opponent controls. 4+: …"
// Fehler vorher: (1) die Rueckfrage „welches Equip?" bot ALLE Karten des Stapels an (auch Club of Gobbo & Co.) — eine Nicht-Heart-Karte konnte als „Heart" in die Ablage gehen;
//                (2) von mehreren gewaehlten Hearts desselben Stapels wurde nur die erste gezaehlt/abgeworfen (Stufe 2+ blieb aus).
// Erwartet: nur Hearts wahlbar; zwei gewaehlte Hearts → beide in der Ablage, 100 Schaden. Aufruf: node docs/niche-tests/repro/W75/h-P4b-02-yuki-onna-hearts-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, YUKI = 'Cold-Hearted Yuki-Onna';
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
async function szene() {
  const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], [F, null, null]], hand: [[YUKI], [F]], gold: 100 });
  const insts = stapel(t, 0, ['Heart of Ice', 'Club of Gobbo', 'Heart of Ice', 'Cute Crown']);
  return { t, insts };
}
(async () => {
  const R = H.runner();

  R.section('1) Beide Hearts des Stapels gewaehlt (Heart, dann das zweite Heart, dann Done)');
  {
    const { t, insts } = await szene();
    const angebote = [];
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { angebote.push(d.instances.map(i => i.name)); return angebote.length === 1 ? { instId: insts[2].id } : { instId: insts[0].id }; } });
    t.targetFn = (valid) => { const v = valid.find(x => x.id === 'equip-0-0-1'); return v ? [v.id] : undefined; };
    await t.play(0, YUKI, { hero: 1 });
    await t.drain();
    R.note('ergebnis', JSON.stringify({ stapel: t.gs.players[0].supportZones[0][1], ablage: t.pile(0, 'discardPile'), angebote, hp: t.hp(1, 0) }));
    R.check('erste Rueckfrage nur mit den beiden Hearts', JSON.stringify(angebote[0]) === '["Heart of Ice","Heart of Ice"]', angebote);
    R.check('beide Hearts in der Ablage, Club und Crown bleiben liegen', JSON.stringify(t.gs.players[0].supportZones[0][1]) === '["Club of Gobbo","Cute Crown"]' && t.pile(0, 'discardPile').filter(n => n === 'Heart of Ice').length === 2, [t.gs.players[0].supportZones[0][1], t.pile(0, 'discardPile')]);
    R.check('2+ greift: Gegner-Held 100 Schaden', t.hp(1, 0) === 700, t.hp(1, 0));
    R.check('Instanzen konsistent (2 im Platz)', t.inst(c => c.zone === 'support' && c.owner === 0 && c.zoneSlot === 1 && c.heroIdx === 0).length === 2);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('2) Nur ein Heart gewaehlt (dann Done) — Stufe 1: kein Schaden');
  {
    const { t, insts } = await szene();
    let k = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => (k++ === 0 ? { instId: insts[0].id } : { done: true }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.id === 'equip-0-0-1'); return v ? [v.id] : undefined; };
    await t.play(0, YUKI, { hero: 1 });
    await t.drain();
    R.check('nur das gewaehlte (erste) Heart ist weg', JSON.stringify(t.gs.players[0].supportZones[0][1]) === '["Club of Gobbo","Heart of Ice","Cute Crown"]' && t.pile(0, 'discardPile').length === 1, [t.gs.players[0].supportZones[0][1], t.pile(0, 'discardPile')]);
    R.check('kein 2+-Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
