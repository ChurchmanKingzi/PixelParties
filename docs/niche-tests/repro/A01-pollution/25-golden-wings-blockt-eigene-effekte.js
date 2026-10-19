'use strict';
// A01-pollution-25 · Golden Wings: die Immunität ist quellenblind – sie sperrt auch die EIGENEN Karten und Opfer-Kosten des Besitzers
// Kartentext: „Place 1 Pollution Token … Choose a Creature you control. That Creature is unaffected by your OPPONENT'S cards and effects until the end of this turn.“
// Buff-Tooltip (`_hooks.js` ~465): „Fully immune to all OPPONENT effects for the rest of this turn.“
// Aufbau: Sitz 0 hat eine ältere Kreatur (nicht in diesem Zug beschworen) und Golden Wings auf der Hand. (a) Wings auf die Kreatur, danach Archer of Teocuilatl (Zusatzaktion durch Opfer:
//   die geschützte Kreatur ist die einzige mögliche Opfergabe). (b) Wings auf die Kreatur, danach eigener Goldify auf dieselbe Kreatur.
// Erwartung: eigene Effekte und eigene Kosten bleiben möglich (nur der Gegner ist ausgesperrt): (a) Archer ist spielbar, die Kreatur wird geopfert; (b) Goldify besiegt die eigene Kreatur (Gold +5×Stufe).
// Beobachtet: (a) `doPlayCreature` lehnt Archer ab (kein Opfer-Kandidat); (b) Goldify zahlt den Token, die Kreatur bleibt unversehrt, kein Gold. Eigene Buffs (`actionAddCreatureBuff`), eigener Schaden und eigener
//   Freeze scheitern genauso. Golden Wings setzt `_cardinalImmune`, und die Engine liest diese Marke an allen Stellen „source-blind“ (`_engine.js` 12281, 13343, 17877, 17931, 18622, 40387 …).
// Ursache: cards/effects/golden-wings.js `applyBuff` (`inst.counters._cardinalImmune = true`) – für „nur gegnerische Karten“ bräuchte es eine quellenabhängige Marke (wie `untargetable_by_opponent`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/25-golden-wings-blockt-eigene-effekte.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickOwn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 0 && y.slotIdx === 0); return x ? [x.id] : [v[0].id]; };

  // (a) Opfer-Kosten
  let t = await H.fresh({ hand: [['Golden Wings', 'Archer of Teocuilatl'], []] });
  const alt = t.put(0, 0, 0, H.INERT.creature); alt.turnPlayed = 1;
  t.grantFor(0, 0, 'Archer of Teocuilatl');
  t.policy.confirm = true; t.targetFn = pickOwn;
  await t.play(0, 'Golden Wings', { hero: 0 });
  R.check('Aufbau: Golden Wings liegt auf der Kreatur', !!alt.counters._gwImmune, alt.counters);
  // W17b: Slot 2 (Slot 1 belegt der Pollution Token von Golden Wings – der alte Wert 1 zielte auf diesen Token)
  const r = await t.play(0, 'Archer of Teocuilatl', { hero: 0, slot: 2, keepActions: false });
  R.check('(a) Archer ist spielbar: Opfer der eigenen (geschützten) Kreatur', r === true && !!t.find('Archer of Teocuilatl', 'support') && alt.zone !== 'support', { r, hand: t.pile(0, 'hand'), altZone: alt.zone });

  // (b) eigener Goldify
  t = await H.fresh({ hand: [['Golden Wings', 'Goldify'], []] });
  const mine = t.put(0, 0, 0, 'Soul Shard Ba');
  t.policy.confirm = true; t.targetFn = pickOwn;
  await t.play(0, 'Golden Wings', { hero: 0 });
  const g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(b) eigener Goldify besiegt die eigene Kreatur und bringt Gold (+5)', !t.find('Soul Shard Ba', 'support') && t.gs.players[0].gold === g0 + 5, { da: !!t.find('Soul Shard Ba', 'support'), gold: [g0, t.gs.players[0].gold] });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
