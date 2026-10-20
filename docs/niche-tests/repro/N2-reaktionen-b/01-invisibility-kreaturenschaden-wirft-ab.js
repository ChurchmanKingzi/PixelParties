'use strict';
// N2-01 · Invisibility wird abgeworfen, wenn eine KREATUR im Support des Trägers Schaden austeilt
// Kartentext (Invisibility): „… If the Hero chooses a target your opponent controls with an Attack or Spell, deals damage to 1 or more targets your opponent controls,
//   or if you control no other Heroes that can be chosen by Attacks or Spells, send this card to your discard pile."
// Erwartung: Nur der HELD selbst (Attack, Spell, eigener Heldeneffekt) wirft Invisibility ab. Der Effekt einer Kreatur (Mr. Jiggles: „choose up to 2 targets your opponent controls and inflict 100 damage")
//   ist der Effekt der Kreatur, nicht des Helden — auch wenn sie in dessen Support Zone steht.
// Beobachtet: Aktiviert die Kreatur im Support Zone des Invisibility-Helden ihren Schaden gegen Held oder Kreatur des Gegners, liegt Invisibility danach in der Ablage.
// Ursache: invisibility.js `afterDamage` (Z. 243-247: `engine.quelleIstHeld` vergleicht nur Brettseite + Heldenindex; das Quellobjekt einer Kreatur trägt denselben heroIdx wie ihr Wirt) und
//   `afterCreatureDamageBatch` (Z. 264-275: vergleicht `e.source.heroIdx` mit dem Träger, ohne zu prüfen, dass die Quelle ein Held ist).
// Gegenprobe: dieselbe Kreatur unter einem ANDEREN Helden (Index 1) löst nichts aus; ein Zauber des Trägers wirft weiterhin ab (Text).
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const [me, ziel] of [[0, 'Held'], [0, 'Kreatur'], [1, 'Held']]) {
    const op = 1 - me;
    R.section(`Sitz ${me}: Kreatur unter dem Invisibility-Träger (Held 0) schadet einem ${ziel} des Gegners`);
    const t = await H.fresh({ hand: me === 0 ? [['Invisibility'], []] : [[], ['Invisibility']], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
    await t.play(me, 'Invisibility', { hero: 0 });
    R.check('Aufbau: Invisibility liegt am Helden 0, Status invisible', sup(t, me, 0).includes('Invisibility') && !!t.hero(me, 0).statuses.invisible, sup(t, me, 0));
    const mj = t.put(me, 0, 1, 'Mr. Jiggles'); mj.turnPlayed = 1; t.grantFor(me, 0, 'Mr. Jiggles');
    const oc = t.put(op, 0, 0, H.INERT.creature);
    t.targetFn = (v) => v.filter(x => x.owner === op && (ziel === 'Held' ? x.type === 'hero' : x.type === 'equip')).slice(0, 1).map(x => x.id);
    t.gs.activePlayer = me; t.phase(2);
    const r = await t.activateCreature(me, 0, 1);
    R.check('Mr. Jiggles hat Schaden ausgeteilt', r === true && (ziel === 'Held' ? t.hp(op, 0) < 800 : oc.counters.currentHp < 200), [r, t.hp(op, 0), oc.counters.currentHp]);
    R.check('Invisibility bleibt liegen (der HELD hat nichts getan)', sup(t, me, 0).includes('Invisibility'), { support: sup(t, me, 0), ablage: t.pile(me, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Gegenprobe A: dieselbe Kreatur unter einem ANDEREN Helden (Index 1) — Invisibility bleibt');
  {
    const t = await H.fresh({ hand: [['Invisibility'], []], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Invisibility', { hero: 0 });
    const mj = t.put(0, 1, 0, 'Mr. Jiggles'); mj.turnPlayed = 1; t.grantFor(0, 1, 'Mr. Jiggles');
    t.targetFn = (v) => v.filter(x => x.owner === 1 && x.type === 'hero').slice(0, 1).map(x => x.id);
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 1, 0);
    R.check('Invisibility bleibt (Kreatur gehört zu Held 1)', sup(t, 0, 0).includes('Invisibility'), sup(t, 0, 0));
  }
  R.section('Gegenprobe B: ein Zauber des Trägers gegen ein gegnerisches Ziel wirft Invisibility ab (Kartentext)');
  {
    const t = await H.fresh({ hand: [['Invisibility', 'Burning Finger'], []], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Invisibility', { hero: 0 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Burning Finger', { hero: 0 });
    R.check('Invisibility liegt in der Ablage', !sup(t, 0, 0).includes('Invisibility') && t.pile(0, 'discardPile').includes('Invisibility'), sup(t, 0, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
