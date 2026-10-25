'use strict';
// W75 · Audit P5 · Darion × ???, the Shapeshifter — als Darion (angelegter Held, „counts as Equipment Artifact") teilt der Shapeshifter seine Equips in EINEM Platz; am Ende der Gegnerrunde faellt NUR die Darion-Karte ab.
// Kartentext: „…This Hero gains the effects and name of the Hero equipped to it this way. At the end of your opponent's turn, send all Heroes equipped this way to the discard pile. Heroes equipped this way count as Equipment Artifacts." / Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Shapeshifter (Held 0) legt Darion an (Zone 0) und nimmt den Namen an. Club / Crown / Blade landen im selben Platz wie die Darion-Karte (4 Karten, 4 Instanzen). Nach `onIdentityExpire`: Name zurueck, nur die Darion-Karte in der Ablage, die drei Equips bleiben liegen (der Stapel bleibt, wie bei jedem Darion, dessen Effekt endet), Namen und Instanzen konsistent.
// Annahme (Rueckfrage an Al): der liegende Stapel bleibt nach der Rueckverwandlung zusammen (Darion-Vertrag „ein liegender Stapel bleibt liegen").
// Aufruf: node docs/niche-tests/repro/W75/h-P5-06-shapeshifter-als-darion.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, SH = '???, the Shapeshifter';
const EQ = ['Club of Gobbo', 'Cute Crown', 'Blade of the Frostbringer'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[SH, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[D, ...EQ], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: D, source: 'hand' }) });
  const r = await t.activateHero(0, 0, { phase: 2 });
  R.check('Verwandlung geglueckt, Held heisst jetzt Darion', r === true && t.gs.players[0].heroes[0].name === D, [r, t.gs.players[0].heroes[0].name]);
  const erg = [];
  for (const n of EQ) erg.push(await t.play(0, n, { hero: 0, slot: 2 }));
  const zonen = () => t.gs.players[0].supportZones[0];
  const insts = () => t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 0);
  R.check('alle drei Equips gespielt', erg.every(x => x === true), erg);
  R.check('alle vier Karten (Darion + 3 Equips) in EINEM Platz', zonen().filter(z => z.length).length === 1 && zonen().flat().length === 4, zonen());
  R.check('vier Instanzen im selben Platz', insts().length === 4 && new Set(insts().map(i => i.zoneSlot)).size === 1, insts().map(i => i.name + '@' + i.zoneSlot));
  R.check('Sauber (als Darion)', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  const heldInst = t.inst(c => c.zone === 'hero' && c.owner === 0 && c.heroIdx === 0)[0];
  const sc = require('../../../../cards/effects/the-shapeshifter.js');
  await t.run(() => sc.onIdentityExpire({ _engine: t.engine, card: heldInst }));
  const rest = zonen().flat();
  R.note('nach Ablauf', JSON.stringify({ name: t.gs.players[0].heroes[0].name, zonen: zonen(), ablage: t.pile(0, 'discardPile') }));
  R.check('Name zurueck', t.gs.players[0].heroes[0].name === SH, t.gs.players[0].heroes[0].name);
  R.check('nur die Darion-Karte ging in die Ablage', t.pile(0, 'discardPile').filter(x => x === D).length === 1 && EQ.every(n => !t.pile(0, 'discardPile').includes(n)), t.pile(0, 'discardPile'));
  R.check('die drei Equips liegen unveraendert (Reihenfolge) im Platz', JSON.stringify(rest) === JSON.stringify(EQ), zonen());
  R.check('Instanzen = Namen im Platz (3, kein Geist, keine Doppelten)', insts().length === 3 && EQ.every(n => insts().filter(i => i.name === n).length === 1), insts().map(i => i.name));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
