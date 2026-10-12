'use strict';
// A04-cute-10 · „You can only control 1 …": nur das Ausspielen aus der Hand setzt es durch – Army, Glorious Rebirth, Cute Bird, Annoyance Mini, Molinda
//   legen/beschwören ein zweites Cute Phoenix / Cute Familiar
//
// Kartentexte: Cute Phoenix: "You can only control 1 'Cute Phoenix'."  Cute Familiar: "You can only control 1 'Cute Familiar'."
//   Army of the Cute: "… place them into the user's free Support Zones."  Glorious Rebirth: "Place that Creature into a free Support Zone of the user."
//   Cute Bird: "… immediately place a 'Cute Phoenix' from your deck into the same Support Zone."
//   Cute Annoyance Mini: "… discard 1 additional card to immediately summon that Creature as an additional Action with this Hero."
//   Cute Angel Molinda: "… you may take permanent control of that Creature. If you do, place it into one of this Hero's free Support Zones."
// Erwartung: Die Klausel gilt dauerhaft – wie bei der normalen Beschwörung aus der Hand (Gegenprobe ✓) darf kein zweites Exemplar unter
//   eigener Kontrolle entstehen (nicht wählbar / Kosten nicht fällig / nicht gelegt).
// Beobachtet: In allen fünf Wegen liegen danach 2 Exemplare unter eigener Kontrolle; bei Bird und Mini sind die Abwurfkosten bezahlt.
// Ursache: cards/effects/cute-phoenix.js / cute-familiar.js prüfen die Klausel nur in `canSummon`, und das ruft nur der Hand-Weg
//   (`isCreatureSummonable`). `summonCreatureWithHooks` (Bird, Mini) und die direkten Platzierungen (Army, Rebirth, Molinda) fragen es nicht;
//   cute-bird.js geht in seinem Kommentar davon aus, dass `canSummon` die Beschwörung verweigert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cnt = (t, n) => t.inst(c => c.name === n && c.zone === 'support' && (c.controller ?? c.owner) === 0).length;
  const wahl = (t) => t.script.push({ match: d => d.type === 'forceDiscard', answer: (d, pi, tt) => { const h = tt.pile(0, 'hand'); const i = h.indexOf(H.INERT.filler); return { cardName: h[i], handIndex: i }; } });
  const armee = async (karte) => {
    const t = await H.fresh({ hand: [['Army of the Cute', karte], []], deck: [[H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 1, 0, karte);
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => ({ selectedCards: [karte], selectedIndices: [d.cards.findIndex(c => c.name === karte)] }) });
    await t.play(0, 'Army of the Cute', { hero: 0, noGrant: true });
    return cnt(t, karte);
  };
  R.check('Army of the Cute: nur 1 Cute Phoenix', (await armee('Cute Phoenix')) === 1);
  R.check('Army of the Cute: nur 1 Cute Familiar', (await armee('Cute Familiar')) === 1);

  let t = await H.fresh({ hand: [['Glorious Rebirth'], []], deck: [[H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool'); t.put(0, 1, 0, 'Cute Phoenix');
  let ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Cute Phoenix']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  await t.play(0, 'Glorious Rebirth', { hero: 0 });
  R.check('Glorious Rebirth: nur 1 Cute Phoenix', cnt(t, 'Cute Phoenix') === 1, cnt(t, 'Cute Phoenix'));

  t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler], []], deck: [['Cute Phoenix', ...Array(5).fill(H.INERT.creature)], []] });
  t.put(0, 1, 0, 'Cute Phoenix'); const bird = t.put(0, 0, 0, 'Cute Bird'); wahl(t);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, bird, 999, 'creature', { sourceOwner: 1 }));
  R.check('Cute Bird (2 Abwürfe bezahlt): nur 1 Cute Phoenix', cnt(t, 'Cute Phoenix') === 1, { phoenix: cnt(t, 'Cute Phoenix'), ablage: t.pile(0, 'discardPile').slice() });

  t = await H.fresh({ heroes: [['Cute Annoyance Mini', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [['Cute Familiar', ...Array(6).fill(H.INERT.creature)], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], ['Magic Arts', 'Magic Arts'], []]);
  t.put(0, 1, 0, 'Cute Familiar'); wahl(t);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Cute Annoyance Mini', answer: () => ({ cardName: 'Cute Familiar' }) });
  await t.activateHero(0, 0, {});
  R.check('Cute Annoyance Mini (Rider „summon"): nur 1 Cute Familiar', cnt(t, 'Cute Familiar') === 1, { familiar: cnt(t, 'Cute Familiar'), ablage: t.pile(0, 'discardPile').slice() });

  t = await H.fresh({ heroes: [['Cute Angel Molinda', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [['Fireball'], []], deck: [Array(4).fill(H.INERT.creature), []] });
  t.put(0, 1, 0, 'Cute Phoenix'); t.put(1, 0, 0, 'Cute Phoenix');
  t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 1).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Cute Angel Molinda (Übernahme eines gegnerischen Phoenix): nur 1 Cute Phoenix', cnt(t, 'Cute Phoenix') === 1, cnt(t, 'Cute Phoenix'));

  t = await H.fresh({ hand: [['Cute Phoenix'], []], deck: [[H.INERT.creature], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.put(0, 1, 0, 'Cute Phoenix');
  await t.play(0, 'Cute Phoenix', { hero: 0, noGrant: true });
  R.check('Gegenprobe: normale Beschwörung eines zweiten Phoenix wird abgelehnt', cnt(t, 'Cute Phoenix') === 1, cnt(t, 'Cute Phoenix'));
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
