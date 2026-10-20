'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkt 4: Duel („Those Heroes both simultaneously perform a normal Attack, dealing damage equal to their current Attack stat"). Al: „Duel auch Fighting-Level!"
// → Jeder Schlag eines Duels zählt mit dem FIGHTING-LEVEL des schlagenden Helden (Stempel `treatedAsAttack` am Quellobjekt, `duell(…, { alsHeldenAngriff: true })`), nicht mit der gedruckten Stufe 3
// der Karte. Leser: Future Tech Jetpack („cannot be chosen or hit by Attacks of level N or lower": 0 Kopien in der Ablage → Stufe 0 wird abgeprallt, 1 Kopie → Stufe 1). Clash of Champions (noch ohne
// Skript) bleibt mit der Helfer-Option vorbereitet (W30a-02).
// Aufruf: node docs/niche-tests/repro/W32/a-04-duel-jeder-schlag-zaehlt-mit-dem-fighting-level-des-schlagenden-helden.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { duell } = require('../../../../cards/effects/_hero-duel-shared.js');
const JET = 'Future Tech Jetpack';
const fight = (n) => [Array(n).fill('Fighting'), [], []];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);

/** Szene: `me` spielt Duel (Held 0 mit Fighting 3, nötig für die Attack Lv 3); `op` wählt Held 0 mit Fighting F; Jetpack-Träger je nach Seite. */
async function szene(me, op, o = {}) {
  const t = await H.fresh({ hand: me === 0 ? [['Duel'], []] : [[], ['Duel']], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  t.grantFor(me, 0, 'Duel');                          // Fighting 3
  t.setAbilities(op, 0, fight(o.F ?? 0));
  if (o.jetpackMe != null) { t.put(me, 0, 0, JET); t.setDiscard(me, Array(o.jetpackMe).fill(JET)); }
  if (o.jetpackOp != null) { t.put(op, 0, 0, JET); t.setDiscard(op, Array(o.jetpackOp).fill(JET)); }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [(posHero(v, v[0].owner, 0) || v[0]).id];
  const rec = [];
  const orig = t.engine.dealDamageToTargets.bind(t.engine);
  t.engine.dealDamageToTargets = (quelle, ziele, oo) => { rec.push({ q: quelle }); return orig(quelle, ziele, oo); };
  t.gs._deferGameOverCheck = true;
  const hpMe = t.hp(me, 0), hpOp = t.hp(op, 0);
  const erg = await t.play(me, 'Duel', { hero: 0 });
  return { t, rec, erg, schadenMe: hpMe - t.hp(me, 0), schadenOp: hpOp - t.hp(op, 0) };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const F of [0, 1, 2, 3]) {
      R.section(`Duel, Sitz ${me}: Gegner-Duellant mit Fighting ${F}`);
      const r = await szene(me, op, { F });
      R.check('das Duell läuft (Karte gespielt, beide Schläge fallen)', r.erg === true && r.rec.length >= 2, { erg: r.erg, n: r.rec.length });
      const stufen = r.rec.map(x => r.t.engine._heldenEffektStufe(x.q.name, 'attack', x.q));
      const meine = r.rec.filter(x => x.q.owner === me).map(x => r.t.engine._heldenEffektStufe(x.q.name, 'attack', x.q));
      const seine = r.rec.filter(x => x.q.owner === op).map(x => r.t.engine._heldenEffektStufe(x.q.name, 'attack', x.q));
      R.check(`jeder eigene Schlag zählt mit dem Fighting-Level des schlagenden Helden (3), jeder gegnerische mit seinem (${F}) – nicht die gedruckte Stufe 3`,
        meine.length >= 1 && meine.every(s => s === 3) && seine.length >= 1 && seine.every(s => s === F), { meine, seine, stufen });
      R.check('die Schläge tragen den Stempel `treatedAsAttack` (Quelle zählt als Attack des Helden)', r.rec.every(x => x.q.treatedAsAttack && typeof x.q.treatedAsAttack === 'object'), r.rec.map(x => !!x.q.treatedAsAttack));
      sauber(R, r, 'Duel');
    }
    // Leser: Jetpack (0 Kopien) beim Spieler: der Schlag des Gegners (Fighting F) prallt nur für F = 0 ab
    for (const F of [0, 1]) {
      R.section(`Duel, Sitz ${me}: Jetpack (0 Kopien) am eigenen Duellanten, Gegner-Duellant Fighting ${F}`);
      const r = await szene(me, op, { F, jetpackMe: 0 });
      R.check(`der gegnerische Schlag (Stufe ${F}) ${F === 0 ? 'prallt am Jetpack ab' : 'trifft (Stufe 1 > 0)'}`, F === 0 ? r.schadenMe === 0 : r.schadenMe > 0, { s: r.schadenMe });
      R.check('der eigene Schlag (Stufe 3) trifft', r.schadenOp > 0, { s: r.schadenOp });
      sauber(R, r, 'Jetpack');
    }
    R.section(`Duel, Sitz ${me}: Jetpack (1 Kopie) am gegnerischen Duellanten`);
    {
      const r = await szene(me, op, { F: 0, jetpackOp: 1 });
      R.check('der eigene Schlag (Stufe 3) ist höher als 1 und trifft trotz Jetpack', r.schadenOp > 0, { s: r.schadenOp });
      sauber(R, r, 'Jetpack Gegner');
    }
  }
  // Clash of Champions (noch ohne Skript): die Helfer-Option bleibt wie in W30a
  R.section('Zweikampf-Helfer: alsHeldenAngriff bleibt die Option für Clash of Champions');
  {
    const t = await H.fresh({ deckSize: 30, hp: 800, active: 0 });
    t.hero(0, 0).atk = 50; t.hero(1, 0).atk = 50;
    t.setAbilities(0, 0, fight(2)); t.setAbilities(1, 0, fight(1));
    const rec = [];
    const orig = t.engine.dealDamageToTargets.bind(t.engine);
    t.engine.dealDamageToTargets = (quelle, ziele, o) => { rec.push(quelle); return orig(quelle, ziele, o); };
    t.gs._deferGameOverCheck = true;
    await t.run(() => duell(t.engine, { name: 'Clash of Champions', a: { controller: 0, side: 0, heroIdx: 0 }, b: { controller: 1, side: 1, heroIdx: 0 }, maxRunden: 1, alsHeldenAngriff: true }));
    R.check('Clash: Stufen 2 und 1 (Fighting der Schlagenden)', rec.length === 2 && t.engine._heldenEffektStufe(rec[0].name, 'attack', rec[0]) === 2 && t.engine._heldenEffektStufe(rec[1].name, 'attack', rec[1]) === 1, rec.map(q => t.engine._heldenEffektStufe(q.name, 'attack', q)));
    sauber(R, { t }, 'Clash');
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
