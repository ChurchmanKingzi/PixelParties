'use strict';
// A03-futuretech-19 · Future Tech Bomb / Steam Dwarf Brewer: eigene Sammler arbeiten nach Brettseite statt nach Kontrolle (gestohlene Kreaturen, übernommene Helden)
//
// Kartentexte: Bomb „Deal 20 damage to all targets **your opponent controls** times the number of different "Future Tech" cards in your discard pile. …“
//              Brewer „… set the current and max HP of **another Creature you control** equal to this Creature's max HP.“
// Regel: CARD_API.md „Kontrolle statt Seite" (~Z. 18826 ff.: „… your opponent controls" / „you control" → Kontrolle; Kreaturen: `controller ?? owner`).
// Erwartung: (Bomb) die von mir gestohlene Gegner-Kreatur A bleibt heil, meine vom Gegner gestohlene Kreatur B und der vom Gegner kontrollierte Held nehmen Schaden;
//            (Brewer) A (von mir kontrolliert) steht zur Wahl, B (vom Gegner kontrolliert) nicht.
// Beobachtet: Bomb trifft A und verfehlt B; Brewer bietet B an und A nicht.
// Ursache: future-tech-bomb.js:65 `[...getHeroTargets(oi), ...getCreatureTargets(oi)]` und steam-dwarf-brewer.js:30 `getCreatureTargets(pi)`; `_engine.js:40250` iteriert die
//   PHYSISCHEN Support Zones der Seite (gleiche Klasse wie M02-22 Ricochet, S02-01 Healing Melody).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // ── Bomb ──
  {
    const B = 'Future Tech Bomb';
    const t = await H.fresh({ potionDeck: [[B], []], discard: [['Future Tech Gun', 'Future Tech Jetpack'], []] });
    const a = t.put(1, 1, 0, H.INERT.creature);   // gehört dem Gegner, von mir gestohlen
    await t.run(() => t.engine.actionStealCreature(0, a));
    const b = t.put(0, 1, 0, H.INERT.creature);   // gehört mir, vom Gegner gestohlen
    await t.run(() => t.engine.actionStealCreature(1, b));
    const c = t.put(1, 2, 0, H.INERT.creature);   // normale Gegner-Kreatur
    const hp = (i) => i.counters.currentHp ?? 200;
    const r = await t.play(0, B);
    R.check('Bomb: normale Gegner-Kreatur nimmt 40 (Kontrolle)', hp(c) === 160, { c: hp(c), r });
    R.check('Bomb: von MIR kontrollierte (gestohlene) Kreatur bleibt heil', hp(a) === 200, { a: hp(a) });
    R.check('Bomb: vom GEGNER kontrollierte (meine gestohlene) Kreatur nimmt 40', hp(b) === 160, { b: hp(b) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // ── Brewer ──
  {
    const BR = 'Steam Dwarf Brewer';
    const t = await H.fresh({});
    const br = t.put(0, 0, 0, BR); br.turnPlayed = 1; br.counters.maxHp = 150; br.counters.currentHp = 150;
    const a = t.put(1, 1, 0, H.INERT.creature);
    await t.run(() => t.engine.actionStealCreature(0, a));        // von mir kontrolliert, steht auf Seite 1
    const b = t.put(0, 2, 0, H.INERT.creature);
    await t.run(() => t.engine.actionStealCreature(1, b));        // vom Gegner kontrolliert, steht auf Seite 0
    let offered = [];
    t.targetFn = (v) => { offered = v.map(x => `${x.cardName}@${x.owner}/${x.heroIdx}`); return null; };
    t.phase(2);
    await t.activateCreature(0, 0, 0);
    R.check('Brewer: die von mir kontrollierte gestohlene Kreatur steht zur Wahl', offered.includes(`${H.INERT.creature}@1/1`), offered);
    R.check('Brewer: die vom Gegner kontrollierte Kreatur steht NICHT zur Wahl', !offered.includes(`${H.INERT.creature}@0/2`), offered);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
