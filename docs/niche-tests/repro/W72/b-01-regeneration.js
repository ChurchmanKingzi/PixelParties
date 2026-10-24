'use strict';
// W72b-01 · Regeneration (Spell Attachment, Support Magic Lv1 — vorher Lv2; 50/100/150 → 60/120/180)
//
// Text: „The Hero this Spell is attached to is healed for 60/120/180 HP at the start of each of its owner's turns, depending on the user's Support Magic level when using this Spell."
// Geprüft: Anlegen (beide Seiten, Abbruch), Stufe des Wirkers beim Ausspielen festgehalten (1/2/3), Heilung nur im Zug des Kontrolleurs, Max-HP-Deckel, kein Auftritt bei vollen HP,
//   Status des Wirts (gefroren/betäubt/negiert) hindert nicht, besiegter Wirt nicht, mehrere Kopien einzeln, Stufenänderung danach ohne Wirkung, übernommener Held, Teleport, Heilsperre.
const H = require('../../lib/h.js');
const CARD = 'Regeneration';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const tragen = (t, seat, hi) => (t.gs.players[seat].supportZones[hi] || []).filter(z => (z || []).includes(CARD)).length;
const SM = (n) => [Array(n).fill('Support Magic'), [], []];

async function anlegen(t, caster, seat, hi, casterHero = 0) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  const hand = t.pile(caster, 'hand').slice(); const i0 = hand.indexOf(CARD); if (i0 >= 0) hand.splice(i0, 1);
  t.setHand(caster, [CARD]);
  const r = await t.play(caster, CARD, { hero: casterHero });
  t.setHand(caster, hand);
  t.targetFn = null;
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · Anlegen und Stufe beim Ausspielen');
  for (const sm of [1, 2, 3]) {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(sm));
    const r = await anlegen(t, 0, 0, 1);
    R.check(`SM ${sm}: gespielt, liegt an Held 1`, r === true && tragen(t, 0, 1) === 1, [r, t.gs.players[0].supportZones[1]]);
    R.check(`SM ${sm}: festgehaltene Stufe ${sm}`, t.find(CARD, 'support').counters.regenerationLevel === sm, t.find(CARD, 'support').counters);
    R.check(`SM ${sm}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 1, 2);
    R.check('auch auf einen Gegnerhelden legbar', tragen(t, 1, 2) === 1 && t.find(CARD, 'support').originalOwner === 0);
    R.check('Zielliste bot beide Seiten', t.targets[0].valid.some(v => isHero(v, 0)) && t.targets[0].valid.some(v => isHero(v, 1)));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    t.policy.cancelTargets = true;
    await t.play(0, CARD, { hero: 0 });
    R.check('Abbruch: Karte zurück auf die Hand', t.pile(0, 'hand').includes(CARD) && tragen(t, 0, 0) + tragen(t, 0, 1) + tragen(t, 0, 2) === 0);
  }
  {
    // Karte ist Lv1: mit Support Magic 1 spielbar (vorher Lv2)
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    const r = await anlegen(t, 0, 0, 0);
    R.check('Lv1: mit Support Magic 1 spielbar', r === true, r);
  }

  R.section('B · Heilung 60/120/180 zu Beginn der Züge des Kontrolleurs');
  for (const [sm, heil] of [[1, 60], [2, 120], [3, 180]]) {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(sm));
    await anlegen(t, 0, 0, 1);
    t.hero(0, 1).hp = 300;
    await t.turnStart(0);
    R.check(`SM ${sm}: +${heil} HP im eigenen Zug`, t.hp(0, 1) === 300 + heil, t.hp(0, 1));
    R.check(`SM ${sm}: Auftritt der Karte + Bild`, t.evs('play_zone_animation').some(e => e.type === 'regeneration_bloom'), t.events.map(e => e.ev));
    await t.turnStart(1);
    R.check(`SM ${sm}: im Gegnerzug keine Heilung`, t.hp(0, 1) === 300 + heil, t.hp(0, 1));
    await t.turnStart(0);
    R.check(`SM ${sm}: nächster eigener Zug wieder +${heil}`, t.hp(0, 1) === 300 + 2 * heil, t.hp(0, 1));
    R.check(`SM ${sm}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    // Gegnerheld trägt die Karte: geheilt wird im Zug DES GEGNERS
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(2));
    await anlegen(t, 0, 1, 0);
    t.hero(1, 0).hp = 400;
    await t.turnStart(0);
    R.check('Wirker-Zug: der Gegnerheld wird NICHT geheilt', t.hp(1, 0) === 400, t.hp(1, 0));
    await t.turnStart(1);
    R.check('im Zug des Gegners: +120', t.hp(1, 0) === 520, t.hp(1, 0));
  }
  {
    // Deckel bei Max-HP
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(3));
    await anlegen(t, 0, 0, 1);
    t.hero(0, 1).hp = 700;
    await t.turnStart(0);
    R.check('700 + 180 → 800 (Max-HP-Deckel)', t.hp(0, 1) === 800, t.hp(0, 1));
    t.evs('play_zone_animation').length = 0; t.reset();
    await t.turnStart(0);
    R.check('bei vollen HP: kein Auftritt, kein Bild', t.evs('play_zone_animation').filter(e => e.type === 'regeneration_bloom').length === 0 && t.hp(0, 1) === 800);
  }

  R.section('C · Zustand des Wirts');
  for (const status of ['frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 0, 1);
    t.hero(0, 1).hp = 300;
    t.heroStatus(0, 1, status);
    await t.turnStart(0);
    R.check(`${status}: wird trotzdem geheilt`, t.hp(0, 1) === 360, t.hp(0, 1));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 0, 1);
    t.hero(0, 1).hp = 0;
    await t.turnStart(0);
    R.check('besiegter Wirt: keine Heilung/Wiederbelebung', t.hp(0, 1) === 0 && t.errors.length === 0, [t.hp(0, 1), t.errors]);
  }

  R.section('D · mehrere Kopien, Stufe festgehalten');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 0, 1);
    t.setAbilities(0, 0, SM(3));
    await anlegen(t, 0, 0, 1);
    R.check('zwei Kopien (Stufe 1 und 3)', tragen(t, 0, 1) === 2, tragen(t, 0, 1));
    t.hero(0, 1).hp = 100;
    await t.turnStart(0);
    R.check('60 + 180 = 240 geheilt', t.hp(0, 1) === 340, t.hp(0, 1));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 0, 1);
    t.setAbilities(0, 0, SM(3));                      // Wirker lernt später mehr — die Karte behält Stufe 1
    t.hero(0, 1).hp = 100;
    await t.turnStart(0);
    R.check('spätere Stufenänderung ändert nichts: weiter +60', t.hp(0, 1) === 160, t.hp(0, 1));
  }

  R.section('E · Kontrolle, Teleport, Heilsperre');
  {
    // Sitz 0 übernimmt Sitz-1-Held 0 dauerhaft; Regeneration (von Sitz 1) liegt am Helden
    const t = await H.fresh({ hand: [[], [CARD]] });
    t.setAbilities(1, 0, SM(1));
    await anlegen(t, 1, 1, 0);
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'test' }));
    t.hero(1, 0).hp = 400;
    await t.turnStart(1);
    R.check('übernommener Held wird im Zug des Besitzers NICHT geheilt', t.hp(1, 0) === 400, t.hp(1, 0));
    await t.turnStart(0);
    R.check('im Zug des neuen Kontrolleurs +60', t.hp(1, 0) === 460, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'Teleport'], []] });
    t.setAbilities(0, 0, SM(1));
    await anlegen(t, 0, 0, 0);                         // Karte in Spalte 0
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 0)).id, valid.find(v => isHero(v, 0, 1)).id];
    t.setHand(0, ['Teleport']);
    await t.play(0, 'Teleport', { hero: 2 });
    t.targetFn = null;
    const h0 = t.hero(0, 0), h1 = t.hero(0, 1);
    h0.hp = 300; h1.hp = 300;
    await t.turnStart(0);
    R.check('nach Teleport heilt die Karte den Helden, der JETZT in ihrer Spalte steht', h0.hp === 360 && h1.hp === 300, [h0.hp, h1.hp]);
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'Forbidden Curse of Aging'], []] });
    t.setAbilities(0, 0, SM(1));
    t.grantFor(0, 0, 'Forbidden Curse of Aging');
    await anlegen(t, 0, 0, 1);
    t.targetFn = (valid) => { const v = valid.find(x => isHero(x, 0, 1)); return v ? [v.id] : undefined; };
    t.setHand(0, ['Forbidden Curse of Aging']);
    const r = await t.play(0, 'Forbidden Curse of Aging', { hero: 0 });
    t.targetFn = null;
    t.hero(0, 1).hp = 300;
    await t.turnStart(0);
    R.check('Forbidden Curse of Aging gelegt', r === true, r);
    R.check('Heilsperre: keine Heilung', t.hp(0, 1) === 300, t.hp(0, 1));
  }

  R.section('F · Zustand');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setAbilities(0, 0, SM(2));
    await anlegen(t, 0, 0, 1);
    t.hero(0, 1).hp = 100;
    for (let i = 0; i < 4; i++) { await t.turnStart(0); await t.turnStart(1); }
    R.check('4 Runden: 100 + 4×120 gedeckelt auf 580', t.hp(0, 1) === 580, t.hp(0, 1));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
