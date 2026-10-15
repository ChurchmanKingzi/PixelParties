// W12b · Q101 (F03-05) · Super-Killing Knife: ein Knife-Kill zählt als „der Held besiegt das Ziel (mit einem Angriff)"
// Al: „Doch, das soll zählen." → Wanted Poster zieht 2, Skullmael's Greatsword löst sein Beschwörungs-Angebot aus.
// Erwartung: (a) Poster am Knife-Helden: ein Knife-Kill zieht genau 2; (b) Skullmael am Knife-Helden: genau EIN Angebot, die Kreatur wird beschworen; (c) Poster an einem ANDEREN Helden desselben
//   Spielers zieht nicht; (d) der Kill am normalen Weg (ohne Knife, 10-HP-Kreatur) bleibt unverändert (2 bzw. 1 Angebot). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const K = 'Super-Killing Knife, the Tool of Liquidation';
  const SG = "Skullmael's Greatsword";
  const tgt = (o, h, s) => (valid) => { const v = valid.find(v => v.type === 'equip' && v.owner === o && v.heroIdx === h && v.slotIdx === s); return v ? [v.id] : undefined; };
  { // (a)
    const t = await H.fresh({ hand: [[K, 'Wanted Poster', 'Attack'], []], deckSize: 20 });
    t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
    await t.play(0, K, { hero: 0, slot: 0 });
    await t.play(0, 'Wanted Poster', { hero: 0, slot: 1 });
    const d0 = t.pile(0, 'mainDeck').length;
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(a) Poster: Kreatur durch das Knife besiegt', !t.zone(1, 0, 0), t.zone(1, 0, 0));
    R.check('(a) Poster zieht genau 2', d0 - t.pile(0, 'mainDeck').length === 2, d0 - t.pile(0, 'mainDeck').length);
    R.check('(a) keine Engine-Fehler / sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (b)
    const t = await H.fresh({ hand: [[K, SG, 'Attack'], []], discard: [[H.INERT.creature], []], deckSize: 20 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
    await t.play(0, K, { hero: 0, slot: 0 });
    await t.play(0, SG, { hero: 0, slot: 1 });
    let angebot = 0;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SG, answer: () => { angebot++; return { cardName: H.INERT.creature, source: 'discard' }; }, once: false });
    t.script.push({ match: d => d.type === 'zonePick' && d.title === SG, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(b) Skullmael: Kreatur durch das Knife besiegt', !t.zone(1, 0, 0), t.zone(1, 0, 0));
    R.check('(b) Skullmael: genau EIN Beschwörungs-Angebot', angebot === 1, angebot);
    R.check('(b) Skullmael: die Kreatur aus der Ablage wurde beschworen', [0, 1, 2].some(s => t.zone(0, 0, s) === H.INERT.creature), [0, 1, 2].map(s => t.zone(0, 0, s)));
    R.check('(b) keine Engine-Fehler / sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (c) Poster an Held 1, Knife an Held 0
    const t = await H.fresh({ hand: [[K, 'Wanted Poster', 'Attack'], []], deckSize: 20 });
    t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
    await t.play(0, K, { hero: 0, slot: 0 });
    await t.play(0, 'Wanted Poster', { hero: 1, slot: 0 });
    const d0 = t.pile(0, 'mainDeck').length;
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(c) Poster an anderem Helden zieht nicht (Kreatur trotzdem besiegt)', !t.zone(1, 0, 0) && d0 === t.pile(0, 'mainDeck').length, { zone: t.zone(1, 0, 0), gezogen: d0 - t.pile(0, 'mainDeck').length });
  }
  { // (d) normaler Kill ohne Knife
    const t = await H.fresh({ hand: [['Wanted Poster', 'Attack'], []], deckSize: 20 });
    t.put(1, 0, 0, H.INERT.frail, { counters: { currentHp: 10, maxHp: 10 } });
    await t.play(0, 'Wanted Poster', { hero: 0, slot: 0 });
    const d0 = t.pile(0, 'mainDeck').length;
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(d) normaler Kill: Poster zieht 2', d0 - t.pile(0, 'mainDeck').length === 2, d0 - t.pile(0, 'mainDeck').length);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
