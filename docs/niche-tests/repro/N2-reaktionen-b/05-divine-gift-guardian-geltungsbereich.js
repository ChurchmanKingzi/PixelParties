'use strict';
// N2-05 · Divine Gift of the Guardian: Schutz gilt nur für die Kreaturen, die zum Zeitpunkt des Ausspielens auf dem Brett stehen
// Kartentext (seit Q151, 16.10.2026): „Play this card immediately when 1 or more Creatures you control would take damage. Negate any damage Creatures you control would take until the beginning of your next turn."
// Beobachtet (Skript `divine-gift-of-the-guardian.js` Z. ~139-175: einmaliger Stempel `counters._guardianImmune` auf jede Kreatur, die beim Ausspielen dem Spieler gehört):
//   (a) eine Kreatur, die der Spieler NACH dem Ausspielen (im selben Zug, vor „the beginning of your next turn") beschwört, bleibt verwundbar,
//   (b) eine Kreatur, die der Gegner dem Spieler danach stiehlt, behält den Schutz (obwohl er sie nicht mehr kontrolliert),
//   (c) eine Kreatur, die der Spieler nach dem Ausspielen stiehlt, ist ungeschützt.
// Lesart A (Text als Zeitraum-Regel: „Creatures you control would take" gilt laufend bis zu deinem nächsten Zug): (a) und (c) geschützt, (b) nicht.
// Lesart B (heute): Momentaufnahme beim Ausspielen. Stufe C — Frage an Al.
const H = require('../../lib/h.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  for (const [me, op] of [[1, 0], [0, 1]]) {
    // me = Halter von Divine Gift of the Guardian (reagiert), op = Wirker der Fireballs
    R.section(`Sitz ${me} hält Divine Gift of the Guardian, Sitz ${op} wirkt Fireball`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Divine Gift of the Guardian'] : ['Fireball', 'Fireball', 'Fireball']) });
      t.grantFor(me, 0, 'Divine Gift of the Guardian');
      const a = t.put(me, 0, 0, H.INERT.creature);
      t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === me && x.heroIdx === 0).id];
      await t.play(op, 'Fireball', { hero: 0 });
      R.check('Aufbau: DGotG hat reagiert (Kreatur a unversehrt, Karte in der Ablage)', a.counters._guardianImmune === true && t.pile(me, 'discardPile').includes('Divine Gift of the Guardian'), [a.counters, t.pile(me, 'discardPile')]);
      // (a) neue Kreatur nach dem Ausspielen
      const b = t.put(me, 1, 0, H.INERT.creature);
      t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === me && x.heroIdx === 1).id];
      await t.play(op, 'Fireball', { hero: 0 });
      R.check('(a) nach dem Ausspielen beschworene Kreatur ist ebenfalls geschützt („Creatures you control would take" bis zum nächsten eigenen Zug)', (b.counters.currentHp ?? 200) === 200, b.counters.currentHp);
    }
    R.section(`(b)/(c) Kontrollwechsel nach dem Ausspielen, Halter = Sitz ${me}`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Divine Gift of the Guardian'] : ['Fireball', 'Fireball']) });
      t.grantFor(me, 0, 'Divine Gift of the Guardian');
      const a = t.put(me, 0, 0, H.INERT.creature);
      const gestohlen = t.put(me, 1, 0, H.INERT.creature);
      const fremd = t.put(op, 2, 0, H.INERT.creature);
      t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === me && x.heroIdx === 0).id];
      await t.play(op, 'Fireball', { hero: 0 });
      await t.engine.actionStealCreature(op, gestohlen); await sleep(300);     // (b) der Gegner stiehlt eine geschützte Kreatur
      await t.engine.actionStealCreature(me, fremd); await sleep(300);          // (c) der Halter stiehlt eine fremde Kreatur
      R.check('Aufbau: Kontrolle gewechselt', (gestohlen.controller ?? gestohlen.owner) === op && (fremd.controller ?? fremd.owner) === me, [gestohlen.controller, fremd.controller]);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: op, heroIdx: 0 }, gestohlen, 100, 'destruction_spell', { sourceOwner: op }));
      R.check('(b) die gestohlene Kreatur (Kontrolle jetzt beim Gegner) ist NICHT mehr „Creature you control" → nimmt Schaden', (gestohlen.counters.currentHp ?? 200) === 100, gestohlen.counters.currentHp);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: op, heroIdx: 0 }, fremd, 100, 'destruction_spell', { sourceOwner: op }));
      R.check('(c) die erbeutete Kreatur (Kontrolle beim Halter) ist geschützt', (fremd.counters.currentHp ?? 200) === 200, fremd.counters.currentHp);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
