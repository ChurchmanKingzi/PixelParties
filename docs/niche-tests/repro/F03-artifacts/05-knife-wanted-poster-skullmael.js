'use strict';
// F03-artifacts-05 · Super-Killing Knife: ein Knife-Kill zählt weder für Wanted Poster noch für Skullmael's Greatsword als „Held besiegt ein Ziel" (Stufe C, Regelfrage)
// Kartentexte: Knife „Creatures that are hit by the Hero with an Attack are defeated." · Wanted Poster „Whenever the Hero defeats a target, draw 2 cards."
//              Skullmael's Greatsword „Once per turn, when the equipped Hero defeats a target with an Attack, you may immediately summon a Creature from your discard pile …"
// Aufbau: Held 0 trägt Knife + (Poster | Skullmael); Gegner-Kreatur 1000 HP, Angriff 50 ⇒ nur das Knife tötet sie.
// Kontrollen (✓): derselbe Angriff auf eine 10-HP-Kreatur (normaler Kill) zieht 2 bzw. bietet die Beschwörung an.
// Beobachtet (✗): beim Knife-Kill 0 gezogene Karten / kein Beschwörungs-Angebot.
// Ursache: Das Knife tötet in `afterCreatureDamageBatch` per `actionDestroyCard(inst /* Knife-Karte */, opfer)` (knife.js ~Z. 80) – die Quelle ist die Knife-Karte
//   (zone 'support'), nicht der Held. `wanted-poster.js` `_isHeroSource` verwirft jede Quelle mit `zone === 'support'` (gedacht für Kreaturen am Helden); Skullmael's Greatsword
//   reagiert nur auf den Schadens-Batch des Angriffs, nicht auf einen Folgetod durch Zerstörung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const K = 'Super-Killing Knife, the Tool of Liquidation';
  const tgt = (o, h, s) => (valid) => { const v = valid.find(v => v.type === 'equip' && v.owner === o && v.heroIdx === h && v.slotIdx === s); return v ? [v.id] : undefined; };
  // Wanted Poster
  for (const fall of ['normal', 'knife']) {
    const t = await H.fresh({ hand: [fall === 'knife' ? [K, 'Wanted Poster', 'Attack'] : ['Wanted Poster', 'Attack'], []], deckSize: 20 });
    const opfer = fall === 'knife'
      ? t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } })
      : t.put(1, 0, 0, H.INERT.frail, { counters: { currentHp: 10, maxHp: 10 } });
    if (fall === 'knife') await t.play(0, K, { hero: 0, slot: 0 });
    await t.play(0, 'Wanted Poster', { hero: 0, slot: fall === 'knife' ? 1 : 0 });
    const d0 = t.pile(0, 'mainDeck').length;
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check(`Poster/${fall}: Kreatur ist besiegt`, !t.zone(1, 0, 0), t.zone(1, 0, 0));
    R.check(`Poster/${fall}: Wanted Poster zieht 2`, d0 - t.pile(0, 'mainDeck').length === 2, d0 - t.pile(0, 'mainDeck').length);
  }
  // Skullmael's Greatsword
  const SG = "Skullmael's Greatsword";
  for (const fall of ['normal', 'knife']) {
    const t = await H.fresh({ hand: [fall === 'knife' ? [K, SG, 'Attack'] : [SG, 'Attack'], []], discard: [[H.INERT.creature], []], deckSize: 20 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    const opfer = fall === 'knife'
      ? t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } })
      : t.put(1, 0, 0, H.INERT.frail, { counters: { currentHp: 10, maxHp: 10 } });
    if (fall === 'knife') await t.play(0, K, { hero: 0, slot: 0 });
    await t.play(0, SG, { hero: 0, slot: fall === 'knife' ? 1 : 0 });
    let angebot = 0;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SG, answer: (d) => { angebot++; return { cardName: H.INERT.creature, source: 'discard' }; }, once: false });
    t.script.push({ match: d => d.type === 'zonePick' && d.title === SG, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
    t.targetFn = tgt(1, 0, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check(`Skullmael/${fall}: Kreatur ist besiegt`, !t.zone(1, 0, 0), t.zone(1, 0, 0));
    R.check(`Skullmael/${fall}: Beschwörungs-Angebot kam`, angebot > 0, { angebot, board: [0, 1, 2].map(s => t.zone(0, 0, s)), errors: t.errors });
  }
  R.finish();
})();
