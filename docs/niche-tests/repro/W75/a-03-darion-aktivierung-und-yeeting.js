'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Jedes Equip im Stapel ist einzeln aktivierbar (instId); The Yeeting fragt per instancePick, welches Equip gemeint ist, und zerstoert nur dieses.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-03-darion-aktivierung-und-yeeting.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const ES = require('../../../../cards/effects/_equip-stack-shared.js');
const F = H.INERT.filler, D = 'Darion, the Blood-Crazy Groundskeeper';
const NM = 'Lunatic Cycle - New Moon', HM = 'Lunatic Cycle - Half Moon';
/** Stapel bei Darion (Held 0, Platz 1) mit den genannten Equips legen. */
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat];
  ps.supportZones[hi][slot] = [];
  const out = [];
  for (const n of namen) { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; out.push(i); }
  return out;
}
async function scene(o = {}) {
  const t = await H.fresh({ active: o.active ?? 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], o.gegner || null], hand: [o.hand || [F, F], o.hand1 || [F]], deck: [o.deck || [HM, F, F], Array(10).fill(F)], gold: 100 });
  return t;
}
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Einzelne Aktivierung je Equip (instId)');
  t = await scene();
  const insts = stapel(t, 0, ['Club of Gobbo', NM, 'Club of Gobbo']);
  const act = t.engine.getActivatableEquips(0);
  t.phase(2);
  const act2 = t.engine.getActivatableEquips(0);
  R.note('act', JSON.stringify(act2));
  const nm = insts[1];
  R.check('New Moon als eigener Eintrag mit instId', act2.some(a => a.instId === nm.id && a.cardName === NM), act2);
  R.check('kein Eintrag fuer Club (keine Equip-Wirkung)', !act2.some(a => a.cardName === 'Club of Gobbo'), act2);
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: F, handIndex: 0 }), once: true });
  const ra = await t.run(() => t.host.doActivateEquipEffect(t.room, 0, { heroIdx: 0, zoneSlot: 1, instId: nm.id }));
  R.note('ra', JSON.stringify(ra) + JSON.stringify({ hand: t.pile(0, 'hand'), dis: t.pile(0, 'discardPile') }));
  R.check('New Moon wirkt (Half Moon auf der Hand)', t.pile(0, 'hand').includes(HM), t.pile(0, 'hand'));
  R.check('HOPT je Instanz gesetzt', t.gs.hoptUsed['equip-effect:' + nm.id] === t.gs.turn);
  R.check('Aktivierung mit falscher instId (anderes Equip ohne Wirkung) -> abgelehnt', (await t.run(() => t.host.doActivateEquipEffect(t.room, 0, { heroIdx: 0, zoneSlot: 1, instId: insts[0].id }))) === false);
  R.check('Aktivierung mit fremder instId -> abgelehnt', (await t.run(() => t.host.doActivateEquipEffect(t.room, 0, { heroIdx: 0, zoneSlot: 1, instId: 'nope' }))) === false);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('2) The Yeeting auf ein Equip im Stapel: nur das gewaehlte Equip wird zerstoert');
  t = await scene({ hand: ['The Yeeting'], active: 0 });
  t.grantFor(0, 1, 'The Yeeting'); t.grantFor(0, 0, 'The Yeeting');
  const ins = stapel(t, 1, ['Club of Gobbo', 'Cloak of Edge', 'Glass Sword'], 1, 0);   // Gegner-Darion? (Seite 1)
  t.gs.players[1].heroes[0] = { ...t.gs.players[1].heroes[0], name: D };
  R.note('stack opp', JSON.stringify(t.gs.players[1].supportZones[0]));
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.slotIdx === 1); if (v) return [v.id]; return [valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id]; };
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { t._pickDesc = d.instances.map(i => i.name); return { instId: ins[1].id }; } });
  await t.play(0, 'The Yeeting', { hero: 0 });
  R.note('yeet', JSON.stringify({ stack: t.gs.players[1].supportZones[0], pick: t._pickDesc, dis1: t.pile(1, 'discardPile'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) }));
  R.check('instancePick listete die drei Equips', JSON.stringify(t._pickDesc) === '["Club of Gobbo","Cloak of Edge","Glass Sword"]', t._pickDesc);
  R.check('nur Cloak of Edge zerstoert', JSON.stringify(t.gs.players[1].supportZones[0][1]) === '["Club of Gobbo","Glass Sword"]' && t.pile(1, 'discardPile').includes('Cloak of Edge'), [t.gs.players[1].supportZones[0], t.pile(1, 'discardPile')]);
  R.check('Instanzen konsistent (2 im Platz)', t.inst(c => c.zone === 'support' && c.owner === 1 && c.zoneSlot === 1).length === 2);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
