'use strict';
// A04-cute-24 (B) · Cute Bunny / Cute Dog / Cute Familiar: die Hand-Beschwörung „as an additional Action" wird nicht als Aktion gemeldet
//
// Kartentexte: Bunny „You may immediately summon this Creature as an additional Action from your hand when you discard or delete 2 or more cards …";
//   Dog „… summon this Creature as an additional Action when you discard it from your hand"; Familiar „When you discard this card, you may immediately summon it as an additional Action."
// Regel (CARD_API.md „Bleed", Tabelle ~Z. 5968): Creature-Beschwörung „auch Zusatz-, Inherent-, Freiaktionen" → `onAnyActionResolved` → Bleed (50 Schaden), Flashbang („first Action") usw.
//   Der Engine-Weg dafür ist `summonCreatureWithHooks(…, { alsZusatzaktion: true })` bzw. `engine.meldeBeschwoerungAlsAktion(...)` (Nimble/Criminal/Resilient Monkee, Hipdall, Clown tun es).
// Beobachtet: Bunny/Dog/Familiar landen auf dem Brett, `onAnyActionResolved` feuert NICHT; ein blutender Held verliert nichts. Gegenprobe Clown: gemeldet.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const spy = (t) => {
    const calls = [];
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = (name, ctx, ...r) => { if (name === 'onAnyActionResolved') calls.push({ type: ctx.actionType, card: ctx.cardName || ctx.playedCardName, add: !!ctx.isAdditional }); return orig(name, ctx, ...r); };
    return calls;
  };
  const basis = async (hand) => {
    const t = await H.fresh({ hand: [hand, []], deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
    t.hero(0, 0).statuses.bleeding = { permanent: true };
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    return t;
  };
  const auf = (t, n) => t.inst(x => x.name === n && x.zone === 'support').length;
  const melde = (c, n) => c.some(x => x.type === 'creature' && x.card === n && x.add);
  R.section('Bunny: 2 Karten abwerfen -> Bunny aus der Hand beschwören');
  { const t = await basis([H.INERT.filler, H.INERT.filler, 'Cute Bunny']); const c = spy(t);
    await t.run(() => t.engine.actionPromptForceDiscard(0, 2, { source: 'Test', selfInflicted: true }));
    R.check('Bunny steht auf dem Brett (Vorbedingung)', auf(t, 'Cute Bunny') === 1);
    R.check('als Zusatzaktion gemeldet (onAnyActionResolved)', melde(c, 'Cute Bunny'), c);
    R.check('Bleed: Held 0 verliert 50 HP', t.hp(0, 0) === 750, t.hp(0, 0)); }
  R.section('Dog: aus der Hand abwerfen -> Dog beschwören');
  { const t = await basis(['Cute Dog']); const c = spy(t); t.grantFor(0, 0, 'Cute Dog');
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Cute Dog', 0, { source: 'Test', selfInflicted: true }));
    R.check('Dog steht auf dem Brett (Vorbedingung)', auf(t, 'Cute Dog') === 1);
    R.check('als Zusatzaktion gemeldet', melde(c, 'Cute Dog'), c);
    R.check('Bleed: Held 0 verliert 50 HP', t.hp(0, 0) === 750, t.hp(0, 0)); }
  R.section('Familiar: aus der Hand abwerfen -> Familiar beschwören');
  { const t = await basis(['Cute Familiar']); const c = spy(t); t.grantFor(0, 0, 'Cute Familiar');
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Cute Familiar', 0, { source: 'Test', selfInflicted: true }));
    R.check('Familiar steht auf dem Brett (Vorbedingung)', auf(t, 'Cute Familiar') === 1);
    R.check('als Zusatzaktion gemeldet', melde(c, 'Cute Familiar'), c);
    R.check('Bleed: Held 0 verliert 50 HP', t.hp(0, 0) === 750, t.hp(0, 0)); }
  R.section('Gegenprobe Fun-Fun Circus Clown (Ende des Gegnerzugs, Applause entfernen)');
  { const t = await basis(['Fun-Fun Circus Clown']); const c = spy(t); t.grantFor(0, 0, 'Fun-Fun Circus Clown');
    const e = t.put(0, 0, 0, 'Fun-Fun Circus Strongman'); e.counters.applause = 1;
    t.gs.activePlayer = 1; t.gs.turn = 6;
    await t.endTurn();
    R.check('Clown steht auf dem Brett', auf(t, 'Fun-Fun Circus Clown') === 1);
    R.check('Clown-Beschwörung als Zusatzaktion gemeldet', melde(c, 'Fun-Fun Circus Clown'), c); }
  R.section('Cute Annoyance Mini: Tutor + 1 weiterer Abwurf -> sofort als Zusatzaktion beschwören');
  { const MI = 'Cute Annoyance Mini';
    const t = await H.fresh({ heroes: [[MI, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [['Cute Familiar', ...Array(6).fill(H.INERT.creature)], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], ['Magic Arts', 'Magic Arts'], []]);
    const c = spy(t);
    t.script.push({ match: d => d.type === 'forceDiscard', answer: (d, pi, tt) => { const h = tt.pile(0, 'hand'); const i = h.indexOf(H.INERT.filler); return { cardName: h[i], handIndex: i }; } });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === MI, answer: () => ({ cardName: 'Cute Familiar' }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    await t.activateHero(0, 0, {});
    R.check('Familiar steht auf dem Brett (Vorbedingung)', auf(t, 'Cute Familiar') === 1);
    R.check('Rider-Beschwörung als Zusatzaktion (creature) gemeldet', melde(c, 'Cute Familiar'), c); }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
