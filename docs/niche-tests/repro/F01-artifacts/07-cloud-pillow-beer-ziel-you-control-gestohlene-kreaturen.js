'use strict';
// F01-artifacts-07 · Cloud Pillow / Beer: „a target / targets you control" folgt der Brettspalte, nicht der Kontrolle (gestohlene Kreaturen)
// Kartentext: Cloud Pillow „Choose a target you control. …"; Beer „Choose any number of targets you control and heal them from any number of status effects."
// Aufbau: (1) Sitz 0 stiehlt die Kreatur von Sitz 1 (`actionStealCreature(0, inst)`: Kreatur bleibt in der Spalte von Sitz 1, `controller` = 0, `stolenBy` = 0).
//         (2) Sitz 1 stiehlt die Kreatur von Sitz 0 (steht weiter in Spalte 0, `controller` = 1). Sitz 0 spielt Cloud Pillow bzw. Beer (die Beer-Kreatur ist gefroren).
// Erwartung (CARD_API.md „Kontrolle statt Seite", Z. 18826 ff.): Angeboten wird, was ICH kontrolliere → (1) ja, (2) nein.
// Beobachtet: genau umgekehrt – (1) die von mir kontrollierte, gestohlene Kreatur fehlt in der Zielliste, (2) die mir gestohlene (vom Gegner kontrollierte) wird angeboten.
//   Dasselbe Muster bei Dark Gear („Choose a Creature your opponent controls"): `dark-gear.js` `getStealableCreatures` (Z. ~87) nimmt `engine.getCreatureTargets(oppIdx)`
//   – eine mir gestohlene, vom Gegner kontrollierte Kreatur in MEINER Spalte ist nie wählbar (Zurückholen unmöglich).
//   Dasselbe bei Explosivo's Sword (Splash auf alle weiteren Ziele, die der Gegner kontrolliert): `explosivo-s-sword.js` Z. 127 `engine.getCreatureTargets(oppIdx)` - der Splash trifft die von
//   MIR kontrollierte, gestohlene Kreatur in seiner Spalte und verfehlt die von ihm kontrollierte in meiner Spalte.
// Ursache: `cloud-pillow.js` Z. 49 / `beer.js` nutzen `engine.getCreatureTargets(pi)` (`_engine.js` Z. 40250): durchläuft nur `gs.players[pi].supportZones` (physische Spalte) –
//   der Filter `(c.owner === pi || c.controller === pi)` hilft nur innerhalb der eigenen Spalte. Die Heldenzweige beider Karten sind dagegen schon auf `heroesControlledBy` umgestellt.
//   `resolve` sucht die Instanz außerdem mit `c.owner === pi` (Cloud Pillow Z. 90) – würde die gestohlene Kreatur angeboten, fände es sie nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const card of ['Cloud Pillow', 'Beer']) {
    {   // (2) meine Kreatur, vom Gegner gestohlen
      const t = await H.fresh({ hand: [[card], []] });
      const mine = t.put(0, 0, 0, H.INERT.creature);
      await t.engine.actionStealCreature(1, mine);
      if (card === 'Beer') t.engine.applyCreatureStatus(mine, 'frozen', { sourceOwner: 0 });
      const own = t.put(0, 1, 0, H.INERT.big);
      if (card === 'Beer') await t.engine.applyCreatureStatus(own, 'frozen', { sourceOwner: 1 });
      let seen = null;
      t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'equip').map(v => v.cardName + '@' + v.owner + '/' + v.heroIdx + '/' + v.slotIdx); return null; };
      t.policy.cancelTargets = true;
      await t.play(0, card, { hero: 0 });
      R.check(card + ' (2): die mir gestohlene, vom Gegner kontrollierte Kreatur (owner 0, controller ' + mine.controller + ') wird NICHT als „target you control" angeboten', !(seen || []).some(s => s.startsWith(H.INERT.creature + '@0/0/0')), seen);
    }
    {   // (1) Gegnerkreatur von mir gestohlen
      const t = await H.fresh({ hand: [[card], []] });
      const theirs = t.put(1, 0, 0, H.INERT.big);
      await t.engine.actionStealCreature(0, theirs);
      if (card === 'Beer') await t.engine.applyCreatureStatus(theirs, 'frozen', { sourceOwner: 1 });
      let seen = null;
      t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'equip').map(v => v.cardName + '@' + v.owner + '/' + v.heroIdx + '/' + v.slotIdx); return null; };
      t.policy.cancelTargets = true;
      await t.play(0, card, { hero: 0 });
      R.check(card + ' (1): die von mir kontrollierte, gestohlene Kreatur (controller ' + theirs.controller + ') wird als „target you control" angeboten', (seen || []).some(s => s.startsWith(H.INERT.big + '@1/0/0')), seen);
    }
  }
  {   // Dark Gear: „Choose a Creature your opponent controls" – meine eigene, vom Gegner gestohlene Kreatur (steht in MEINER Spalte)
    const t = await H.fresh({ hand: [['Dark Gear'], []], gold: [100, 100] });
    const c = t.put(0, 0, 0, 'Albrecht, the Nerd');
    await t.engine.actionStealCreature(1, c);
    let seen = null;
    t.targetFn = (valid) => { seen = valid.map(v => v.cardName + '@' + v.owner); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, 'Dark Gear', { hero: 0 });
    R.check('Dark Gear: die vom Gegner kontrollierte Kreatur in meiner Spalte (owner ' + c.owner + ', controller ' + c.controller + ') ist als „Creature your opponent controls" wählbar', !!seen && seen.length > 0, seen);
  }
  {   // Explosivo's Sword: Splash auf alle weiteren Ziele des Gegners - nach Kontrolle?
    const t = await H.fresh({ hand: [["Explosivo's Sword", 'Attack'], []], hp: 800, gold: [100, 100] });
    await t.play(0, "Explosivo's Sword", { hero: 0 });
    t.hero(1, 0).hp = 30;
    const a = t.put(1, 1, 0, H.INERT.big);                       // seine Kreatur
    const b = t.put(0, 1, 0, H.INERT.big);                       // meine, von ihm gestohlen (controller 1, steht in MEINER Spalte)
    await t.engine.actionStealCreature(1, b);
    const c = t.put(1, 2, 0, H.INERT.big);                       // seine, von mir gestohlen (controller 0, steht in SEINER Spalte)
    await t.engine.actionStealCreature(0, c);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Attack', { hero: 0 });
    const dmg = (i) => 1000 - (i.counters.currentHp ?? 1000);
    R.check("Explosivo's Sword: seine Kreatur nimmt 100", dmg(a) === 100, dmg(a));
    R.check("Explosivo's Sword: die von IHM kontrollierte Kreatur in meiner Spalte nimmt 100", dmg(b) === 100, dmg(b));
    R.check("Explosivo's Sword: die von MIR kontrollierte Kreatur in seiner Spalte bleibt heil", dmg(c) === 0, dmg(c));
  }
  R.finish();
})();
