'use strict';
// N2-05 · Divine Gift of the Guardian: Schutz gilt nur für die Kreaturen, die zum Zeitpunkt des Ausspielens auf dem Brett stehen
// Kartentext (seit Q151, 16.10.2026): „Play this card immediately when 1 or more Creatures you control would take damage. Negate any damage Creatures you control would take until the beginning of your next turn."
// Beobachtet (Skript `divine-gift-of-the-guardian.js` Z. ~139-175: einmaliger Stempel `counters._guardianImmune` auf jede Kreatur, die beim Ausspielen dem Spieler gehört):
//   (a) eine Kreatur, die der Spieler NACH dem Ausspielen (im selben Zug, vor „the beginning of your next turn") beschwört, bleibt verwundbar,
//   (b) eine Kreatur, die der Gegner dem Spieler danach stiehlt, behält den Schutz (obwohl er sie nicht mehr kontrolliert),
//   (c) eine Kreatur, die der Spieler nach dem Ausspielen stiehlt, ist ungeschützt.
// ★ W25b (Al, Welle 25: „genau, alle, die zum Zeitpunkt eines möglichen Effekts gerade kontrolliert werden"): Lesart A gilt — der Schutz ist eine Zeitraum-Marke am Spieler
// (`ps._guardianShield`, bis zum Beginn seines nächsten Zuges): (a) und (c) geschützt, (b) nicht; danach (d) Ablauf zum nächsten eigenen Zugbeginn. Exit 0 = Regel erfüllt.
// (Lesart B = Momentaufnahme beim Ausspielen war der Stand bis Welle 24.)
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
    R.section(`(d) Ablauf zum Beginn des nächsten Zuges des Halters (Sitz ${me})`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === me ? ['Divine Gift of the Guardian'] : ['Fireball', 'Fireball', 'Fireball']) });
      t.grantFor(me, 0, 'Divine Gift of the Guardian');
      const a = t.put(me, 0, 0, H.INERT.creature);
      t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === me && x.heroIdx === 0).id];
      await t.play(op, 'Fireball', { hero: 0 });
      const c = t.put(me, 1, 0, H.INERT.creature);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: op, heroIdx: 0 }, c, 100, 'destruction_spell', { sourceOwner: op }));
      R.check('(d) vor dem nächsten Zug des Halters geschützt', (c.counters.currentHp ?? 200) === 200, c.counters.currentHp);
      await t.endTurn(); await t.endTurn();   // Zug des Gegners, dann Zugbeginn des Halters
      R.check('(d) nach dem Zugbeginn des Halters ist der Schutz vorbei (Spieler-Marke weg)', !t.gs.players[me]._guardianShield, !!t.gs.players[me]._guardianShield);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: op, heroIdx: 0 }, c, 100, 'destruction_spell', { sourceOwner: op }));
      R.check('(d) danach nimmt die Kreatur wieder Schaden', (c.counters.currentHp ?? 200) === 100, c.counters.currentHp);
      R.check('keine Engine-Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
