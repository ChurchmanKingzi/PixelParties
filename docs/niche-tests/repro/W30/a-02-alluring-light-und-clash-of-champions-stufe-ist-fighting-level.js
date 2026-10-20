'use strict';
// W30a · Entscheidung Al (21.10.2026, Punkt 2): Alluring Light (Spell Lv 1: „Choose a Hero your opponent controls and a target you control. Your chosen target takes damage equal to the chosen Hero's
// Attack stat. This is treated as the chosen Hero attacking your chosen target.") und Clash of Champions (Attack Lv 3: „Each instance of the two Heroes attacking each other is treated as them performing
// an Attack against the other") – „Es zählt auch hier das Fighting-Level!" → für Effekte, die den Treffer als Attack eines (gewählten) Helden behandeln, ist die Quellstufe das FIGHTING-LEVEL dieses
// Helden, NICHT die gedruckte Stufe der Karte. Gleiche Leser wie beim Greatmaw (W29a): Stealth, Future Tech Jetpack, Glass Wall, Test Flight, Future Tech Escape Device.
// „Der gewählte Held" bei Alluring Light = der GEGNERISCHE Held, den man als Angreifer wählt (Schritt ①); das Opfer (Schritt ②) ist ein eigenes Ziel – die Leser liegen dort. Die Wahl des Angreifers
// selbst bleibt ein Spell der gedruckten Stufe. Clash of Champions hat noch kein Kartenskript: der Zweikampf-Helfer `_hero-duel-shared.js` kennt die Option `alsHeldenAngriff` (je Schlag Stempel
// mit dem Fighting-Level des SCHLAGENDEN Helden); Duel („perform a normal Attack") blieb in W30a unverändert (Frage an Al).
// ★ W32a (Al, 22.10.2026): Duel ebenfalls „auch Fighting-Level!" – `duel.js` setzt `alsHeldenAngriff: true` (Prüfung: `W32/a-04`); der Duel-Pfad-Test unten prüft nur noch den Helfer OHNE die Option.
// ★ W32a, Punkt 3: der Alluring-Light-TREFFER ist ein Attack des gezwungenen Helden (Quelle = Heldenkarte, Typ `attack`), die Karte selbst bleibt ein Spell Lv 1 (Prüfung: `W32/a-03`).
// Aufruf: node docs/niche-tests/repro/W30/a-02-alluring-light-und-clash-of-champions-stufe-ist-fighting-level.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { duell } = require('../../../../cards/effects/_hero-duel-shared.js');
const JET = 'Future Tech Jetpack', GW = 'Glass Wall', TF = 'Test Flight', ED = 'Future Tech Escape Device';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const fight = (n) => [Array(n).fill('Fighting'), [], []];

/** Szene: Seat `me` spielt Alluring Light, wählt den Gegner-Helden `angreifer` (Fighting F) als Angreifer und den EIGENEN Helden 0 als Opfer; der Leser liegt beim Opfer. */
async function szene(me, op, leser, o = {}) {
  const F = o.F ?? 0, angreifer = o.angreifer ?? 0;
  const meHand = ['Alluring Light', ...(leser === TF ? [TF] : leser === ED ? [ED] : [])];
  const t = await H.fresh({ hand: me === 0 ? [meHand, []] : [[], meHand], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  t.setAbilities(op, angreifer, fight(F));
  if (o.vorbereiten) o.vorbereiten(t);
  if (leser === 'Jetpack0') t.put(me, 0, 0, JET);
  if (leser === 'Jetpack1') { t.put(me, 0, 0, JET); t.setDiscard(me, [JET]); }
  if (leser === GW) { t.putSurprise(me, 0, GW); t.grantFor(me, 0, GW); }
  if (leser === TF) { t.grantFor(me, 0, TF); t.setAbilities(me, 0, [['Magic Arts', 'Magic Arts'], [], []]); }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [] };
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  t.targetFn = o.targetFn || ((v) => {
    const a = v.find(x => x.owner === op && x.type === 'hero' && x.heroIdx === angreifer);
    if (a) return [a.id];
    return [v.find(x => x.owner === me && x.type === 'hero' && x.heroIdx === 0).id];   // Opfer: eigener Held 0
  });
  const hp0 = t.hp(me, 0);
  await t.play(me, 'Alluring Light', { hero: 1 });
  return { t, rec, schaden: hp0 - t.hp(me, 0) };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  // Soll-Tabelle: wehrt der Leser bei Fighting-Level F des gewählten Helden ab? (Alluring Light: gedruckt Lv 1 – bisher hätten Jetpack0/ED nie, Glass Wall/TF immer gewirkt)
  const LESER = { Jetpack0: (F) => F <= 0, Jetpack1: (F) => F <= 1, [GW]: (F) => F <= 1, [TF]: (F) => F < 2, [ED]: (F) => F <= 0 };
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const F of [0, 1, 2, 3]) {
      R.section(`Alluring Light, Sitz ${me}: gewählter Gegner-Held mit Fighting ${F}`);
      const k = await szene(me, op, 'keiner', { F });
      R.check('Kontrolle (kein Leser): das Opfer nimmt den Attack-Wert des gewählten Helden', k.schaden === 100, k.schaden);
      R.check(`Kontrolle: der Treffer ist ein Attack-Treffer des gegnerischen Helden mit Stufe ${F} (Stempel am Quellobjekt, nicht die gedruckte Stufe 1)`,
        k.rec.quellen.length >= 1 && k.rec.quellen.every(({ q, type }) => type === 'attack' && k.t.engine._heldenEffektStufe(q.name, type, q) === F), k.rec.quellen.map(x => [x.q.name, x.type, x.q.treatedAsAttack && x.q.treatedAsAttack.level]));
      R.check('Kontrolle: nach der Auflösung liegt kein Stempel mehr auf der Karteninstanz', k.t.engine.cardInstances.filter(c => c.name === 'Alluring Light').every(c => c.treatedAsAttack === undefined), null);
      sauber(R, k, 'Kontrolle');
      for (const leser of Object.keys(LESER)) {
        const soll = LESER[leser](F);
        const r = await szene(me, op, leser, { F });
        if (leser.startsWith('Jetpack')) {
          R.check(`${leser}: ${soll ? 'schützt (Treffer prallt ab)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden });
        } else {
          R.check(`${leser}: ${soll ? 'wird angeboten und wehrt ab' : 'wird nicht angeboten, Treffer landet'}`, soll ? (gefragt(r.t, leser) >= 1 && r.schaden === 0) : (gefragt(r.t, leser) === 0 && r.schaden > 0), { gefragt: gefragt(r.t, leser), s: r.schaden });
        }
        sauber(R, r, leser);
      }
    }
    // Heldenwahl: der GEWÄHLTE Gegner-Held zählt (Held 0: Fighting 0, Held 1: Fighting 2)
    R.section(`Alluring Light, Sitz ${me}: Heldenwahl – der gewählte Held bestimmt die Stufe`);
    for (const [angreifer, glasWallFeuert] of [[0, true], [1, false]]) {
      const r = await szene(me, op, GW, { F: angreifer === 0 ? 0 : 2, angreifer, vorbereiten: (t) => t.setAbilities(op, angreifer === 0 ? 1 : 0, fight(angreifer === 0 ? 3 : 0)) });
      R.check(`Gewählter Held ${angreifer} (Fighting ${angreifer === 0 ? 0 : 2}): Glass Wall ${glasWallFeuert ? 'wehrt ab' : 'bleibt verdeckt, Treffer landet'}`,
        glasWallFeuert ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
      sauber(R, r, 'Heldenwahl');
    }
    // harte Negierung der Abilities des gewählten Helden = Level 0
    {
      const r = await szene(me, op, GW, { F: 3, vorbereiten: (t) => t.heroStatus(op, 0, 'negated') });
      R.check('Abilities des gewählten Helden hart negiert (Fighting 3 zählt nicht) → Level 0 → Glass Wall wehrt ab', gefragt(r.t, GW) >= 1 && r.schaden === 0, { g: gefragt(r.t, GW), s: r.schaden });
    }
    // Abbruch der Opferwahl: kein Stempel bleibt hängen
    {
      const r = await szene(me, op, 'keiner', { F: 2, targetFn: (v) => { const a = v.find(x => x.owner === op && x.type === 'hero' && x.heroIdx === 0); return a ? [a.id] : null; } });
      R.check('Abbruch bei der Opferwahl: kein Stempel auf der Karteninstanz, kein Schaden', r.schaden === 0 && r.t.engine.cardInstances.filter(c => c.name === 'Alluring Light').every(c => c.treatedAsAttack === undefined), { s: r.schaden });
    }
  }

  // Stealth direkt (liest `info.treatedAsLevel`; im Treffer-Pfad steigt Stealth aus, weil es nur das WÄHLEN schützt): Quelle Alluring Light mit Stempel gegen einen Stealth-Träger
  R.section('Stealth liest die Stempel-Stufe (direkt über heroBlocksTargeting)');
  for (const [stealth, F, soll] of [[1, 0, true], [1, 1, true], [1, 2, false], [2, 2, true], [2, 3, false]]) {
    const t = await H.fresh({});
    t.setAbilities(1, 0, [Array(stealth).fill('Stealth'), [], []]);
    t.setAbilities(0, 0, fight(F));
    const quelle = { name: 'Alluring Light', owner: 0, controller: 0, heroIdx: 0, treatedAsAttack: t.engine.heldenAngriffStempel(0, 0) };
    const info = { sourceData: H.DB['Alluring Light'], cardName: 'Alluring Light', damageType: 'attack', source: quelle, chooserIdx: 0, chooserHeroIdx: 0 };
    const blockt = t.engine.heroBlocksTargeting(1, 0, info);
    // Stealth schützt nur, solange es andere wählbare Helden gibt – hier gibt es sie (Helden 1/2 der Gegenseite ohne Stealth)
    R.check(`Stealth ${stealth}, gewählter Held Fighting ${F} (gedruckte Stufe 1 zählt nicht): ${soll ? 'schützt' : 'schützt nicht'}`, blockt === soll, blockt);
  }

  // Clash of Champions: Helfer `duell` mit `alsHeldenAngriff` – Stempel je schlagendem Helden
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Clash of Champions (Zweikampf-Helfer), Sitz ${me} gegen ${op}`);
    for (const alsHeld of [true, false]) {
      const t = await H.fresh({ deckSize: 30, hp: 800, active: me });
      t.hero(me, 0).atk = 50; t.hero(op, 0).atk = 50;
      t.setAbilities(me, 0, fight(2)); t.setAbilities(op, 0, fight(0));
      t.put(me, 0, 0, JET);     // Jetpack 0 Kopien in der Ablage: blockt Attacks der Stufe 0
      const rec = [];
      const orig = t.engine.dealDamageToTargets.bind(t.engine);
      t.engine.dealDamageToTargets = (quelle, ziele, o) => { rec.push({ q: quelle, owner: quelle.owner }); return orig(quelle, ziele, o); };
      const hpMe = t.hp(me, 0), hpOp = t.hp(op, 0);
      t.gs._deferGameOverCheck = true;
      await t.run(() => duell(t.engine, { name: 'Clash of Champions', a: { controller: me, side: me, heroIdx: 0 }, b: { controller: op, side: op, heroIdx: 0 }, maxRunden: 1, alsHeldenAngriff: alsHeld }));
      const stufen = rec.map(x => t.engine._heldenEffektStufe(x.q.name, 'attack', x.q));
      if (alsHeld) {
        R.check('Clash (als Held-Angriff): Schlag des eigenen Helden hat Stufe 2 (Fighting 2), Schlag des Gegners Stufe 0 – nicht die gedruckte Stufe 3', rec.length === 2 && stufen[0] === 2 && stufen[1] === 0, stufen);
        R.check('Clash: Jetpack (Träger Held 0 des Sitzes) wehrt den Level-0-Schlag des Gegners ab, der eigene Level-2-Schlag trifft', t.hp(me, 0) === hpMe && t.hp(op, 0) < hpOp, { me: hpMe - t.hp(me, 0), op: hpOp - t.hp(op, 0) });
      } else {
        R.check('Duel-Pfad (ohne alsHeldenAngriff, unverändert): Schläge tragen keinen Stempel (gedruckte Kartenstufe zählt)', rec.length === 2 && stufen.every(s => s === null), stufen);
      }
      sauber(R, { t }, 'Clash');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
