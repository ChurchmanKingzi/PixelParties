'use strict';
// A09-22 · Hydra Blood Arrow: gegen eine KREATUR als Ziel gibt es keine Giftmarken (der Schaden wird 0, die Marken fehlen)
// Kartentext Hydra Blood Arrow: „Play this card when a Hero hits 1 or more targets with an Attack. Reduce that Attack's damage to 0 and apply 1 Poison Stack to the target for every 30 full damage the Attack would have dealt instead."
// Gegenprobe: gegen einen Helden gibt es floor(Schaden/30) Marken; Poisoned Arrow vergiftet dieselbe Kreatur ohne Probleme.
// Ursache (Lesart im Code): `_engine.js` Kreaturen-Schadensstapel (processCreatureDamageBatch) bricht bei `actualAmount === 0` mit `continue` ab (Z. ~46892), BEVOR
// `applyArrowsAfterDamage` (Z. ~47019) die Reiter (Gift/Brand) anwendet. Hydra setzt den Schaden immer auf 0 – für Kreaturen läuft der Reiter also nie.
// Aufbau: Seed 1234. Sitz 0: Tushu (Fighting 1, ATK 40), Hand [Angelfeather Arrow, Hydra Blood Arrow, Attack]. Sitz 1: „ZZ Dummy Big" (1000 HP) bzw. Held 0.
// Schritte: Attack auf das Ziel, beide Pfeile ketten (40 + 60 = 100 „would have dealt").
// Erwartet: Schaden 0 und floor(100/30) = 3 Giftmarken auf dem Ziel (Held und Kreatur gleich).
// Beobachtet: Held 3 Marken (korrekt), Kreatur 0 Marken.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const ziel of ['Held', 'Kreatur']) {
    const t = await H.fresh({ hand: [['Angelfeather Arrow', 'Hydra Blood Arrow', 'Attack'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    const c = ziel === 'Kreatur' ? t.put(1, 0, 0, H.INERT.big) : null;
    t.script.push({ match: d => d.type === 'cardGallery' && /Chain a Reaction/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source, handIndex: d.cards[0].handIndex }), once: false });
    t.targetFn = (valid) => [(c ? valid.find(x => x.type === 'equip' && x.owner === 1) : valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0)).id];
    const hp0 = c ? (c.counters.currentHp ?? 1000) : t.hp(1, 0);
    await t.play(0, 'Attack', { hero: 0 });
    const dmg = hp0 - (c ? (c.counters.currentHp ?? 1000) : t.hp(1, 0));
    const stacks = c ? (c.counters.poisonStacks || 0) : (t.gs.players[1].heroes[0].statuses?.poisoned?.stacks || 0);
    R.check(ziel + ': Hydra Blood + Angelfeather: Schaden 0', dmg === 0, { dmg });
    R.check(ziel + ': 3 Giftmarken (floor(100/30))', stacks === 3, { stacks });
    R.check(ziel + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
