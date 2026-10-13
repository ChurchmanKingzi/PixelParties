'use strict';
// F01-artifacts-15 · Flying Island in the Sky: Kreaturen in den Inselzonen werden beim Abbau ohne Todes-Hooks entfernt – stattdessen feuert onHeroKO mit einem Phantom-„Helden"
// Kartentext: „…When this card is removed from a Hero, any Creatures in those Support Zones are defeated."
// Aufbau: Sitz 0 legt Flying Island an Held 0; Exploding Skull („When this Creature is defeated, deal 80 damage to all targets your opponent controls.") steht in der Inselzone (Slot 3).
//   Dann verlässt die Insel das Brett (a: Ablage per actionMoveCard, b: der Träger stirbt).
// Erwartung: Die Kreatur wird besiegt wie jede andere: `onCreatureDeath` feuert, der Skull verteilt 80 Schaden an alle Ziele des Gegners; kein `onHeroKO` für Nicht-Helden.
// Beobachtet: Skull liegt in der Ablage, aber 0 Schaden; mitgeschnitten wird `onHeroKO` mit `{name: 'Exploding Skull', hp: 0}` (Phantom-Held), kein onCreatureDeath.
// Ursache: `cards/effects/_engine.js` `removeIslandZones` (Z. 47790 ff., Hook-Aufruf Z. 47828): `runHooks(HOOKS.ON_HERO_KO, { hero: { name: cardName, hp: 0 }, source: null })`, danach direkt `discardPile.push` + `cardInstances` filtern –
//   statt `actionDestroyCard(…, { fireCreatureDeath: true })` (der kanonische „defeat"-Weg, vgl. Burned Contract).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FI = 'Flying Island in the Sky';
  for (const weg of ['Insel in die Ablage', 'Träger stirbt']) {
    const t = await H.fresh({ hand: [[FI], []], hp: 800 });
    await t.play(0, FI, { hero: 0 });
    t.put(0, 0, 3, 'Exploding Skull');
    const gesehen = [];
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (name, ctx) => { if (/KO|Death/i.test(name)) gesehen.push(name + (ctx && ctx.hero ? ':' + ctx.hero.name : '')); return orig(name, ctx); };
    const hp1 = t.hp(1, 0);
    if (weg === 'Insel in die Ablage') await t.engine.actionMoveCard(t.find(FI, 'support'), 'discard');
    else await t.engine.actionDealDamage({ name: 'x', owner: 1 }, t.hero(0, 0), 5000, 'other');
    R.check(weg + ': Exploding Skull löst „when defeated" aus (80 Schaden an Held 0 des Gegners)', hp1 - t.hp(1, 0) === 80, { schaden: hp1 - t.hp(1, 0), hooks: gesehen });
    R.check(weg + ': kein onHeroKO für eine Kreatur', !gesehen.includes('onHeroKO:Exploding Skull'), gesehen);
    R.check(weg + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
