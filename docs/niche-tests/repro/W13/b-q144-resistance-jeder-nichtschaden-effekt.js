'use strict';
// W13 / Q144 (M02-11) · Resistance: „The first card or effect every turn that would affect this Hero, except damage, doesn't affect it" (Lv3: alle)
// Al: „Es soll *jeden* Nicht-Schaden-Effekt blocken!" → Status, Heilung, Max-HP-Gewinn (Life Serum, Future Tech Doping), Entfernen aus dem Spiel
// (Teleportation Powder), Ability-Abwurf durch Effekte (Memory Wipe, Cybug LADYBUG), dauerhafte Kontrolle — zentral über `engine.heroNonDamageEffectBlocked`.
// Bleibt: Schaden wirkt; Resistance ruht bei Frost/Betäubung/Abilities-Negation (Welle 7); Lv1 blockt nur den ERSTEN Effekt je Zug. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroT = (seat) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === seat && x.heroIdx === 0); return v ? [v.id] : null; };
  async function mk(lv, karte, o = {}) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Fireball', 'Fireball', 'Fireball'], []], discard: [['ZZ Dummy'], []], ...(o.fresh || {}) });
    t.setAbilities(1, 0, [Array(lv).fill('Resistance'), ['Fighting'], ['Toughness']]);
    if (o.pre) await o.pre(t);
    t.targetFn = heroT(1);
    const r = await t.play(0, karte, { hero: 1 });
    return { t, r };
  }
  for (const lv of [1, 3]) {
    const ls = await mk(lv, 'Life Serum');
    R.check(`Lv${lv}: Life Serum (Max-HP) wirkt nicht`, ls.t.hero(1, 0).maxHp === 800, { maxHp: ls.t.hero(1, 0).maxHp });
    const tp = await mk(lv, 'Teleportation Powder');
    R.check(`Lv${lv}: Teleportation Powder entfernt den Helden nicht`, !!tp.t.hero(1, 0).name && tp.t.hero(1, 0).hp > 0, { name: tp.t.hero(1, 0).name });
    const pv = await mk(lv, 'Poison Vial');
    R.check(`Lv${lv}: Poison Vial (Status) abgewehrt`, !pv.t.hero(1, 0).statuses.poisoned, pv.t.hero(1, 0).statuses);
    R.check(`Lv${lv}: keine Engine-Fehler`, ls.t.errors.length + tp.t.errors.length + pv.t.errors.length === 0, [ls.t.errors, tp.t.errors, pv.t.errors]);
  }
  // Eigene Karte auf den eigenen Resistance-Helden (Life Serum von Sitz 1 auf Sitz-1-Held 0) – "eigener/fremder Karten"
  { const t = await H.fresh({ hand: [[], ['Life Serum']], hp: 800 });
    t.setAbilities(1, 0, [['Resistance'], [], []]);
    t.targetFn = heroT(1);
    t.gs.activePlayer = 1;
    await t.play(1, 'Life Serum', { hero: 0 });
    R.check('eigenes Life Serum auf den eigenen Resistance-Helden: geblockt', t.hero(1, 0).maxHp === 800, t.hero(1, 0).maxHp); }
  // Lv1: nur der ERSTE Effekt je Zug – Life Serum (blockt) danach Life Serum (wirkt)
  { const t = await H.fresh({ hand: [['Life Serum', 'Life Serum'], []], hp: 800 });
    t.setAbilities(1, 0, [['Resistance'], [], []]);
    t.targetFn = heroT(1);
    await t.play(0, 'Life Serum', { hero: 0 });
    const nach1 = t.hero(1, 0).maxHp;
    await t.play(0, 'Life Serum', { hero: 0 });
    R.check('Lv1: erstes Life Serum geblockt (800), zweites im selben Zug wirkt (950)', nach1 === 800 && t.hero(1, 0).maxHp === 950, { nach1, nach2: t.hero(1, 0).maxHp }); }
  // Ruhe bei Frost (Welle 7): gefrorener Held → Resistance schweigt, Life Serum wirkt
  { const t = await H.fresh({ hand: [['Life Serum'], []], hp: 800 });
    t.setAbilities(1, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    t.hero(1, 0).statuses.frozen = { duration: 2, appliedBy: 0 };   // direkt gesetzt (Resistance Lv3 würde das Einfrieren selbst abwehren)
    t.targetFn = heroT(1);
    await t.play(0, 'Life Serum', { hero: 0 });
    R.check('Lv3, Held gefroren: Resistance ruht, Life Serum wirkt (950)', t.hero(1, 0).maxHp === 950, t.hero(1, 0).maxHp); }
  // Schaden wirkt weiter
  { const t = await H.fresh({ hand: [['Fireball'], []], hp: 800 });
    t.setAbilities(1, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    t.targetFn = heroT(1);
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Lv3: Schaden (Fireball) wirkt weiterhin', t.hp(1, 0) === 650, t.hp(1, 0)); }
  // Ability-Abwurf durch Memory Wipe: ohne Resistance werden Abilities abgeworfen (Kontrolle), mit Lv3 nicht
  for (const [label, zonen, erwartetAbwurf] of [['ohne Resistance (Kontrolle)', [['Fighting'], ['Toughness'], []], true], ['Resistance Lv3', [['Resistance', 'Resistance', 'Resistance'], ['Fighting'], ['Toughness']], false]]) {
    const t = await H.fresh({ hand: [['Memory Wipe'], []], hp: 800 });
    t.setAbilities(1, 0, zonen);
    t.grantFor(0, 0, 'Memory Wipe', 3);
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return h ? [h.id] : [valid[0].id]; };
    const vorher = (t.gs.players[1].abilityZones[0] || []).flat().length;
    await t.play(0, 'Memory Wipe', { hero: 0 });
    const nachher = (t.gs.players[1].abilityZones[0] || []).flat().length;
    R.check(`Memory Wipe, ${label}: Ability-Abwurf ${erwartetAbwurf ? 'findet statt' : 'wird geblockt'}`, erwartetAbwurf ? nachher < vorher : nachher === vorher, { vorher, nachher, errors: t.errors });
  }
  // Future Tech Doping (Max-HP-Gewinn des eigenen Helden)
  for (const [label, res, erwartet] of [['ohne Resistance (Kontrolle)', false, true], ['mit Resistance Lv3', true, false]]) {
    const t = await H.fresh({ hand: [['Future Tech Doping'], []], hp: 800, discard: [['Future Tech Laser Cannon', 'Future Tech Gun'], []] });
    if (res) t.setAbilities(0, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(0, 'Future Tech Doping', { hero: 0 });
    R.check(`Future Tech Doping, ${label}: Max-HP ${erwartet ? 'steigt' : 'bleibt 800'}`, erwartet ? t.hero(0, 0).maxHp > 800 : t.hero(0, 0).maxHp === 800, { maxHp: t.hero(0, 0).maxHp, errors: t.errors });
  }
  // Dauerhafte Kontrolle
  { const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(1, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    const ok = await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' }));
    R.check('Lv3: dauerhafte Übernahme prallt ab', !t.hero(1, 0).permaControlBy && !t.hero(1, 0).charmedBy, { ok, perma: t.hero(1, 0).permaControlBy }); }
  { const t = await H.fresh({ hand: [[], []], hp: 800 });
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' }));
    R.check('Kontrolle ohne Resistance: dauerhafte Übernahme klappt', t.hero(1, 0).permaControlBy === 0, t.hero(1, 0).permaControlBy); }
  R.finish();
})();
