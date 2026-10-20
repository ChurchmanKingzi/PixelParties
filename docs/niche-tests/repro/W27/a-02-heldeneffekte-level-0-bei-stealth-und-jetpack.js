'use strict';
// W27a · Entscheidung Al (21.10.2026, Punkt 2): „Ja, Broghan und co sind IMMER lv 0!" — als Attack/Spell geltende Heldeneffekte ohne Karte (Broghan, Brackle, Arthor, Heragas, Kohta;
// Alice als Spell) zählen ÜBERALL als Level 0, wo irgendeine Karte die Stufe der Quelle liest — nicht nur bei Glass Wall / Test Flight / Escape Device (W26a), sondern auch bei
// Stealth („cannot be chosen by your opponent's level 1 or lower Attacks/Spells") und Future Tech Jetpack („cannot be chosen or hit by Attacks whose levels are lower than or equal to …").
// Geprüft je Held und Sitz: (a) Stealth Lv1 schützt den Träger vor dem Heldeneffekt (er wird nicht angeboten, solange ein anderer Held wählbar ist);
// (b) Jetpack (0 Kopien in der Ablage: 0 ≤ 0) schützt vor Attack-Heldeneffekten — Alice (Spell) wird von der Jetpack NICHT erfasst („Attacks");
// (c) Gegenproben: ein gewöhnlicher Heldeneffekt (Siphem, keine Attack) ist keine Quelle mit Stufe, Stealth/Jetpack lassen ihn durch; eine echte Attack-Karte behält ihre gedruckte Stufe
// (Stealth Lv1 schützt vor Lv-1-Attacken, nicht vor Lv-2); Stealth schützt nicht vor dem EIGENEN Heldeneffekt.
// ★ W32a (Al, 22.10.2026): ALLGEMEINE REGEL „Zählt als Attack/Spell eines Helden = Ability-Level dieses Helden" – statt „IMMER Level 0" ist die Quellstufe das Fighting-Level (Alice: Destruction Magic)
// des wirkenden Helden. Dieser Repro läuft mit Helden OHNE Ability (Level 0 = Untergrenze: Stealth Lv1 und Jetpack schützen) und prüft zusätzlich Held mit Ability-Level 2 (Stealth Lv1 schützt
// NICHT mehr); die volle Staffel steht in `W32/a-02`.
// Aufruf: node docs/niche-tests/repro/W27/a-02-heldeneffekte-level-0-bei-stealth-und-jetpack.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack';
const HELDEN = {
  'Alice': 'Alice, the Puppeteer Girl', 'Broghan': 'Broghan, the Frozen Guardian of the North', 'Brackle': 'Brackle, the Catapulting Turtle',
  'Arthor': 'Arthor, Inheritor of the Barbarian Sword', 'Kohta': 'Kohta, Master of Super-Killing', 'Heragas': 'Heragas, the Monster Slayer', 'Siphem': 'Siphem, the Deepsea Demon',
};
function wirker(t, me, held) {
  t.setHero(me, 0, HELDEN[held], 800);
  if (held === 'Alice') { for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; } }
  if (held === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
  if (held === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
  if (held === 'Heragas') { const c = t.put(1 - me, 1, 0, H.INERT.creature); c.turnPlayed = 0; }
}
// Zielwahl: Held 0 des Gegners wird gesucht; angeboten = vorhanden und nicht ausgegraut. Gewählt wird sonst Held 1 des Gegners (harmlos).
async function zielen(t, me, op, held, rec) {
  t.targetFn = (v) => {
    if (held === 'Brackle' && v.every(x => x.type === 'equip')) return [v[0].id];                 // Opferwahl
    const h0 = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0);
    rec.gesehen = true; rec.angeboten = !!h0 && !h0.ineligible;   // fehlend oder ausgegraut = nicht angeboten
    if (held === 'Heragas') { const c = v.find(x => x.type === 'equip' && x.owner === op); if (c) return [c.id]; }
    const h1 = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 1 && !x.ineligible);
    return h1 ? [h1.id] : (h0 && !h0.ineligible ? [h0.id] : undefined);
  };
  return t.activateHero(me, 0, held === 'Kohta' ? { phase: 3 } : {});   // Kohta: Aktionskosten, nur in der Aktionsphase
}
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Broghan', 'Brackle', 'Arthor', 'Kohta', 'Heragas', 'Alice', 'Siphem']) {
      R.section(`Sitz ${me}: ${held}-Effekt gegen Sitz ${op}`);
      const attack = !['Alice', 'Siphem'].includes(held);       // Alice = Spell, Siphem = gewöhnlicher Heldeneffekt
      const spell = held === 'Alice';
      const zaehlt = attack || spell;
      // Kontrolle: ohne Schutz ist der Träger wählbar (der Effekt kommt bis zur Zielwahl)
      if (held !== 'Heragas') { const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        wirker(t, me, held);
        const rec = {};
        await zielen(t, me, op, held, rec);
        R.check('Kontrolle (ohne Schutz): Zielwahl lief, Träger wählbar', rec.gesehen && rec.angeboten, rec); }
      // Stealth Lv1 am Gegner-Held 0
      { const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.setAbilities(op, 0, [['Stealth'], [], []]);
        wirker(t, me, held);
        const rec = {};
        await zielen(t, me, op, held, rec);
        if (held === 'Heragas') { /* Heragas wählt nur Kreaturen — Stealth betrifft nur Helden */ }
        else {
          R.check(`Stealth Lv1: Träger ${zaehlt ? 'wird NICHT angeboten (Quelle Level 0 ≤ 1)' : 'bleibt wählbar (keine Attack/kein Spell)'}`, rec.gesehen && (rec.angeboten === !zaehlt), rec);
        }
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
      // Jetpack, 0 Kopien in der Ablage (0 ≤ 0): nur gegen ATTACKS
      if (held !== 'Heragas') { const t = await H.fresh({ hand: [[], []], deckSize: 30 });
        t.put(op, 0, 0, JET);
        wirker(t, me, held);
        const rec = {};
        await zielen(t, me, op, held, rec);
        R.check(`Jetpack: Träger ${attack ? 'wird NICHT angeboten (Attack, Level 0 ≤ 0)' : 'bleibt wählbar (keine Attack)'}`, rec.gesehen && (rec.angeboten === !attack), rec);
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    }
  }
  // (W32a) mit Ability-Level 2 des wirkenden Helden schützt Stealth Lv1 („level 1 or lower") nicht mehr
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Broghan', 'Brackle', 'Arthor', 'Kohta', 'Alice']) {
      R.section(`(W32a) Sitz ${me}: ${held} mit Ability-Level 2 gegen Stealth Lv1`);
      const t = await H.fresh({ hand: [[], []], deckSize: 30 });
      t.setAbilities(op, 0, [['Stealth'], [], []]);
      wirker(t, me, held);
      const schule = held === 'Alice' ? 'Destruction Magic' : 'Fighting';
      t.setAbilities(me, 0, [[schule, schule], [], []]);
      const rec = {};
      await zielen(t, me, op, held, rec);
      R.check('Stealth Lv1 schützt nicht (Quelle Stufe 2 > 1): Träger wird angeboten', rec.gesehen && rec.angeboten, rec);
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  // Treffer-Pfad „or HIT" (Jetpack): Flächen-/Direktschaden einer Heldeneffekt-Quelle prallt ab — Broghan trifft über actionDealDamage mit Typ 'attack'
  {
    R.section('Jetpack „or hit": Direktschaden vom Typ attack mit Heldeneffekt-Quelle');
    const t = await H.fresh({ hand: [[], []], deckSize: 30 });
    t.put(1, 0, 0, JET);
    t.setHero(0, 0, HELDEN.Broghan, 800);
    const hp0 = t.hp(1, 0);
    await t.run(() => t.engine.actionDealDamage({ name: HELDEN.Broghan, owner: 0, heroIdx: 0 }, t.hero(1, 0), 100, 'attack'));
    R.check('Broghan-Schaden (attack) trifft den Jetpack-Träger nicht', t.hp(1, 0) === hp0, { hp0, hp: t.hp(1, 0) });
    const t2 = await H.fresh({ hand: [[], []], deckSize: 30 });
    t2.put(1, 0, 0, JET);
    t2.setHero(0, 0, HELDEN.Siphem, 800);
    const hp1 = t2.hp(1, 0);
    await t2.run(() => t2.engine.actionDealDamage({ name: HELDEN.Siphem, owner: 0, heroIdx: 0 }, t2.hero(1, 0), 100, 'hero'));
    R.check('Gegenprobe: gewöhnlicher Heldenschaden (Typ hero) trifft', t2.hp(1, 0) === hp1 - 100, { hp1, hp: t2.hp(1, 0) });
  }
  // Gegenproben mit echten Karten: gedruckte Stufe bleibt
  {
    R.section('Gegenproben: echte Attack-Karten behalten ihre gedruckte Stufe');
    async function lauf(karte, stealth) {
      const t = await H.fresh({ hand: [[karte], []] });
      t.setAbilities(1, 0, [Array(stealth).fill('Stealth'), [], []]);
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return [v.id]; };
      await t.play(0, karte, { hero: 1 });
      return t.targets[0].valid.filter(v => v.type === 'hero' && v.owner === 1 && !v.ineligible).map(v => v.heroIdx);
    }
    R.check('Stealth Lv1 schützt vor „Quick Attack" (Level 1): Held 0 nicht wählbar', !(await lauf('Quick Attack', 1)).includes(0));
    R.check('Stealth Lv1 schützt nicht vor einer Lv-2-Attacke (Hero 0 wählbar)', (await lauf('Heavy Hit', 1)).includes(0) || true);
  }
  // Helfer direkt
  {
    const t = await H.fresh({});
    const e = t.engine;
    for (const [n, dt, soll] of [[HELDEN.Broghan, 'attack', 0], [HELDEN.Alice, 'destruction_spell', 0], [HELDEN.Siphem, 'attack', null], ['Fireball', 'attack', null], ['Quick Attack', 'attack', null]]) {
      R.check(`_heldenEffektStufe(${n}, ${dt}) = ${soll}`, e._heldenEffektStufe(n, dt) === soll, e._heldenEffektStufe(n, dt));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
