'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Besiegt Darion Ziele, darf er ein Equip aus Hand/Deck fuer den halben Preis (aufgerundet) anlegen: ein Angebot je Schlag, Abbruch kostet nichts, andere Quellen loesen nicht aus, Held als Opfer, negiert.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-02-darion-ausruesten-nach-besiegen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, D = 'Darion, the Blood-Crazy Groundskeeper', FRAIL = H.INERT.frail;
async function scene(o = {}) {
  const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hand: [o.hand || ['Attack', 'Club of Gobbo'], [F]], deck: [o.deck || [F, F, F], Array(10).fill(F)], gold: o.gold ?? 100 });
  t.grantFor(0, 0, 'Attack');
  for (const s of (o.victims || [0])) { const v = t.put(1, 0, s, o.victim || FRAIL); v.turnPlayed = 1; }
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === (o.victimSlot ?? 0)); return [(v || valid[0]).id]; };   // Opfer, sonst (Zonenwahl fuer das Equip) das erste
  return t;
}
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Darion besiegt Kreatur mit Attack -> Equip aus der Hand gegen halben Preis');
  t = await scene();
  t.script.push({ match: d => d.type === 'cardGallery' && /Darion/.test(d.title || ''), answer: (d) => ({ cardName: 'Club of Gobbo', source: 'hand' }) });
  let g0 = t.gs.players[0].gold;
  await t.play(0, 'Attack', { hero: 0 });
  R.note('piles', JSON.stringify({ z: t.gs.players[0].supportZones[0], gold: t.gs.players[0].gold, hand: t.pile(0, 'hand'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) }));
  R.check('Club of Gobbo liegt bei Darion', t.gs.players[0].supportZones[0].some(z => z.includes('Club of Gobbo')), t.gs.players[0].supportZones[0]);
  R.check('halber Preis (Cost 4 -> 2 Gold)', g0 - t.gs.players[0].gold === 2, g0 - t.gs.players[0].gold);
  R.check('Club nicht mehr auf der Hand', !t.pile(0, 'hand').includes('Club of Gobbo'));
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('2) Zweites Equip kommt in den Stapel, aus dem Deck, Preis aufgerundet (5 -> 3)');
  t = await scene({ hand: ['Attack'], deck: ['Blade of the Frostbringer', F, F] });
  t.put(0, 0, 2, 'Club of Gobbo').turnPlayed = 1;
  t.script.push({ match: d => d.type === 'cardGallery' && /Darion/.test(d.title || ''), answer: () => ({ cardName: 'Blade of the Frostbringer', source: 'deck' }) });
  g0 = t.gs.players[0].gold;
  await t.play(0, 'Attack', { hero: 0 });
  R.note('zones', JSON.stringify(t.gs.players[0].supportZones[0]) + ' gold ' + (g0 - t.gs.players[0].gold));
  R.check('Blade im selben Platz wie Club of Gobbo', JSON.stringify(t.gs.players[0].supportZones[0][2]) === '["Club of Gobbo","Blade of the Frostbringer"]', t.gs.players[0].supportZones[0]);
  R.check('3 Gold (Cost 5 halbiert, aufgerundet)', g0 - t.gs.players[0].gold === 3, g0 - t.gs.players[0].gold);
  R.check('Blade aus dem Deck genommen', !t.pile(0, 'mainDeck').includes('Blade of the Frostbringer'));
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  R.section('3) Kein Gold -> kein Angebot; Abbruch kostet nichts; kein Equip auf Hand/Deck -> kein Angebot');
  t = await scene({ gold: 1 });
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Gold 1 < 2: kein Angebot', !t.prompts.some(p => /Darion/.test(p.d.title || '')), t.prompts.map(p => p.d.title));
  t = await scene();
  t.script.push({ match: d => d.type === 'cardGallery' && /Darion/.test(d.title || ''), answer: () => ({ cancelled: true }) });
  g0 = t.gs.players[0].gold;
  await t.play(0, 'Attack', { hero: 0 });
  R.check('abgebrochen: nichts bezahlt, nichts equipped', t.gs.players[0].gold === g0 && t.gs.players[0].supportZones[0].every(z => z.length === 0), [t.gs.players[0].gold, t.gs.players[0].supportZones[0]]);
  t = await scene({ hand: ['Attack'] });
  await t.play(0, 'Attack', { hero: 0 });
  R.check('keine Equips: kein Angebot', !t.prompts.some(p => /Darion/.test(p.d.title || '')));

  R.section('4) Nicht Darion als Quelle: anderer Held / Kreatur toetet -> kein Trigger');
  t = await scene({ hand: ['Attack', 'Club of Gobbo'] });
  t.gs.players[0].heroes[1] = { ...t.gs.players[0].heroes[1] };
  t.grantFor(0, 1, 'Attack');
  await t.play(0, 'Attack', { hero: 1 });
  R.check('Attack von Held 1: Darion loest nicht aus', !t.prompts.some(p => /Darion/.test(p.d.title || '')), t.prompts.map(p => p.d.title));

  R.section('5) Zwei Ziele in EINEM Schlag: EIN Angebot');
  t = await scene({ hand: ['Club of Gobbo', 'Glass Sword'], victims: [0, 1] });
  t.script.push({ match: d => d.type === 'cardGallery' && /Darion/.test(d.title || ''), answer: () => ({ cardName: 'Club of Gobbo', source: 'hand' }) });
  const vics = t.inst(c => c.zone === 'support' && c.owner === 1);
  await t.run(() => t.engine.processCreatureDamageBatch(vics.map(v => ({ inst: v, amount: 500, type: 'creature', source: { name: 'Attack', owner: 0, controller: 0, heroIdx: 0, heroOwner: 0 }, sourceOwner: 0, canBeNegated: true }))));
  R.note('batch', JSON.stringify({ prompts: t.prompts.filter(p => /Darion/.test(p.d.title || '')).length, z: t.gs.players[0].supportZones[0], v: t.gs.players[1].supportZones[0] }));
  R.check('beide Opfer tot', t.gs.players[1].supportZones[0].every(z => z.length === 0), t.gs.players[1].supportZones[0]);
  R.check('genau ein Angebot', t.prompts.filter(p => /Darion/.test(p.d.title || '')).length === 1, t.prompts.filter(p => /Darion/.test(p.d.title || '')).length);

  R.section('6) Held als Opfer: Darion toetet einen Helden -> Angebot');
  t = await scene({ hand: ['Club of Gobbo'] });
  t.gs.players[1].heroes[0].hp = 5;
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
  t.script.push({ match: d => d.type === 'cardGallery' && /Darion/.test(d.title || ''), answer: () => ({ cardName: 'Club of Gobbo', source: 'hand' }) });
  t.setHand(0, ['Attack', 'Club of Gobbo']);
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Held besiegt -> Equip angeboten und angelegt', t.gs.players[0].supportZones[0].some(z => z.includes('Club of Gobbo')), [t.gs.players[0].supportZones[0], t.prompts.map(p => p.d.title)]);

  R.section('7) Darion negiert: kein Trigger');
  t = await scene();
  t.gs.players[0].heroes[0].statuses.negated = true;
  await t.play(0, 'Attack', { hero: 0 });
  R.check('negierter Darion loest nicht aus', !t.prompts.some(p => /Darion/.test(p.d.title || '')), t.prompts.map(p => p.d.title));
  R.finish();
})();
