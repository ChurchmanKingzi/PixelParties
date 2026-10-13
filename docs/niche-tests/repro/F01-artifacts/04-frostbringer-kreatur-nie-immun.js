'use strict';
// F01-artifacts-04 · Blade of the Frostbringer: Kreaturen werden in aufeinanderfolgenden Zügen erneut eingefroren (Helden nicht)
// Kartentext: „…if the equipped Hero hits exactly 1 target with an Attack, that target is Frozen for 1 turn. A target cannot be Frozen in 2 consecutive turns by this effect."
// Aufbau: Sitz 0 trägt die Klinge an Held 0 und hat 3x „Attack"; Ziel A = gegnerischer Held, Ziel B = gegnerische Kreatur (ZZ Dummy Big).
// Ablauf: Zug 5 Angriff (Ziel gefroren), Zug 6 Gegnerzug (Eis hält, taut am Zugende), Zug 7 gleicher Angriff.
// Erwartung: In Zug 7 wird das Ziel NICHT erneut eingefroren (Held: Auftau-Immunität, Skriptkopf ③ „handled automatically by the existing thaw-immune system").
// Beobachtet: Held ✓ (Status „immune" nach dem Auftauen, kein Einfrieren in Zug 7). Kreatur ✗: keine Auftau-Immunität – in Zug 7 gleich wieder `frozen`,
//   die Kreatur ist damit in Zug 5,6,7,8 durchgehend gefroren.
// Ursache: `cards/effects/blade-of-the-frostbringer.js` Z. ~104–126 (Kreaturenzweig) prüft nur `inst.counters.frozen`; das „thaw-immune"-System der Engine
//   (`_engine.js` ~45143: `addHeroStatus(ap, hi, 'immune')`) gibt es nur für Helden, für Kreaturen existiert kein Gegenstück.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // A) Held (Gegenprobe)
  {
    const t = await H.fresh({ hand: [['Blade of the Frostbringer', 'Attack', 'Attack'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
    await t.play(0, 'Blade of the Frostbringer', { hero: 0 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Held: Zug 5 gefroren', !!t.hero(1, 0).statuses.frozen);
    await t.endTurn(); await t.endTurn();
    t.addHand(0, 'Attack');
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Held: Zug ' + t.gs.turn + ' nicht erneut gefroren (2 Züge in Folge)', !t.hero(1, 0).statuses.frozen, Object.keys(t.hero(1, 0).statuses));
  }
  // B) Kreatur
  {
    const t = await H.fresh({ hand: [['Blade of the Frostbringer', 'Attack', 'Attack'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
    await t.play(0, 'Blade of the Frostbringer', { hero: 0 });
    const c = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0).id];
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Kreatur: Zug 5 gefroren', !!c.counters.frozen);
    await t.endTurn();
    const frozenZug6 = !!c.counters.frozen;
    await t.endTurn();
    R.note('Kreatur nach Zug 6 aufgetaut?', { gefrorenZug6: frozenZug6, gefrorenZug7Start: !!c.counters.frozen });
    t.addHand(0, 'Attack');
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Kreatur: Zug ' + t.gs.turn + ' nicht erneut gefroren (2 Züge in Folge, wie beim Helden)', !c.counters.frozen, { frozen: c.counters.frozen, appliedTurn: c.counters.frozenAppliedTurn });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
