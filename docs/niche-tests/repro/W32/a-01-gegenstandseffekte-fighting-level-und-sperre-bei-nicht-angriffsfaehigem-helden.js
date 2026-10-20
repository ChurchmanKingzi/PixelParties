'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkt 1: Javelin Throw, Sword in a Bottle, die vier Crusader's (Arm-Cannon, Cutlass, Flintlock, Hookshot), Bamboo Staff, Sacrificial Dagger und
// Infected Greatmaw („treated as … an Attack"): Al: „Sie nehmen trotzdem das Fighting-Level, und sie werden geblockt, wenn der Hero nicht angreifen kann (etwa, weil er Frozen ist)."
//  (a) Quellstufe = FIGHTING-LEVEL des Helden (Träger bzw. gewählter Held), NICHT mehr fix 0 (W27a). Leser: Glass Wall („level 1 or lower"), Test Flight („lower than the Magic Arts level" [2]),
//      Stealth 1/2, Future Tech Jetpack (0/1 Kopien), Future Tech Escape Device („equal to or lower than the number of … in your discard pile" [0]).
//  (b) ist der Held nicht angriffsfähig (Frozen, Stunned, Webbed, hart Negated, Bound, Attack-Sperre des Zuges), wird der Effekt BLOCKIERT – nicht spielbar/aktivierbar bzw. der Trigger
//      löst nicht aus (`engine.heroKannAngreifen`, dieselben Sperren wie `validateActionPlay` für eine Attack-Karte). Die leichte Negierung („nur der Effekt") sperrt nicht.
//  (c) Gegenprobe: der Quellen-Held ist der Träger/gewählte Held (ein anderer Held mit Fighting zählt nicht); Xalibur-Fighting zählt; harte Abilities-Negierung (Stowaway-Form) = Level 0.
// Aufruf: node docs/niche-tests/repro/W32/a-01-gegenstandseffekte-fighting-level-und-sperre-bei-nicht-angriffsfaehigem-helden.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack', GW = 'Glass Wall', TF = 'Test Flight', ED = 'Future Tech Escape Device';
const CECILIA = 'Cecilia, the Harrowing Crusader';
const CRUSADERS = ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"];
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];
// Gegner-Opfer: Held 0, falls wählbar (nicht ausgegraut), sonst Held 1 (der Leser-Schutz zeigt sich dann im ausbleibenden Schaden an Held 0)
const gegner = (v, op) => { const h0 = posHero(v, op, 0), h1 = posHero(v, op, 1); return (h0 && !h0.ineligible ? h0 : (h1 || h0 || v[0])).id; };

// Treiber je Gegenstand: `att` = Index des Angreifer-Helden (Träger bzw. gewählter Held); `aufbau` stellt den Gegenstand; `los` löst aus und gibt zurück, ob der Weg „behandelt" hat.
const TREIBER = {
  'Javelin Throw': { att: 0, hand: ['Javelin Throw'], aufbau(t, me) { t.put(me, 0, 0, H.INERT.artifact); },
    async los(t, me, op, o) {
      t.targetFn = (v) => { if (!v.some(x => x.owner === op)) { const own = posHero(v, me, o.att); return own ? [own.id] : [v[0].id]; } return [gegner(v, op)]; };
      return t.play(me, 'Javelin Throw', { hero: o.att });
    }, verbraucht: (t, me) => !t.pile(me, 'hand').includes('Javelin Throw') },
  'Sword in a Bottle': { att: 1, hand: ['Sword in a Bottle'], aufbau() {},
    async los(t, me, op, o) {
      t.targetFn = (v) => [posHero(v, me, o.att).id, gegner(v, op)];
      return t.play(me, 'Sword in a Bottle', { hero: 0 });
    }, verbraucht: (t, me) => !t.pile(me, 'hand').includes('Sword in a Bottle') },
  'Bamboo Staff': { att: 0, discard: ['ZZ Filler'], aufbau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); },
    async los(t, me, op) {
      t.targetFn = (v) => [gegner(v, op)];
      await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W32a' })); return true;
    }, verbraucht: (t, me) => t.engine.cardInstances.some(c => c.name === 'Bamboo Staff' && c.counters._bambooFiredOnTurn != null) },
  'Sacrificial Dagger': { att: 0, aufbau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.opfer = t.put(me, 1, 0, H.INERT.creature); },
    async los(t, me, op) {
      t.targetFn = (v) => [gegner(v, op)];
      await t.run(() => t.engine.opfereKreatur(t.opfer, { name: 'Test', owner: me })); return true;
    }, verbraucht: (t, me) => Object.keys(t.gs.hoptUsed || {}).some(k => k.startsWith('sacrificial_dagger:')) },
  'Infected Greatmaw': { att: 0, aufbau(t, me) {
      const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; t.greatmaw = g; t.frail = x; },
    async los(t, me, op, o) {
      t.targetFn = (v, cfg) => {
        if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
        if (v.every(z => z.owner === me)) return [(posHero(v, me, o.att) || v[0]).id];
        return [gegner(v, op)];
      };
      t.phase(2); return t.activateCreature(me, 1, 0);
    }, verbraucht: (t) => t.engine.cardInstances.every(c => c !== t.frail || c.zone !== 'support') },
};
for (const k of CRUSADERS) {
  TREIBER[k] = { att: 0, held: CECILIA, aufbau(t, me) { t.put(me, 0, 0, k); },
    async los(t, me, op) {
      t.targetFn = (v) => [gegner(v, op)];
      return t.activateEquip(me, 0, 0);
    }, verbraucht: (t, me) => Object.keys(t.gs.hoptUsed || {}).some(key => key.startsWith('equip-effect:')) };
}

/** Szene: Seat `me` löst den Gegenstand aus; Angreifer-Held `att` mit Fighting F; Gegner-Held 0 trägt den Leser. */
async function szene(name, me, op, leser, o = {}) {
  const sp = TREIBER[name];
  const F = o.F ?? 0, att = o.att ?? sp.att;
  const opHand = leser === TF ? [TF] : leser === ED ? [ED] : [];
  const meHand = sp.hand || [];
  const t = await H.fresh({ hand: me === 0 ? [meHand, opHand] : [opHand, meHand], discard: me === 0 ? [sp.discard || [], []] : [[], sp.discard || []], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  if (sp.held) t.setHero(me, 0, sp.held, 800);
  t.setAbilities(me, att, fight(F));
  if (o.vorbereiten) o.vorbereiten(t, me, att);
  sp.aufbau(t, me, op);
  if (leser === 'Stealth1') t.setAbilities(op, 0, [['Stealth'], [], []]);
  if (leser === 'Stealth2') t.setAbilities(op, 0, [['Stealth', 'Stealth'], [], []]);
  if (leser === 'Jetpack0') t.put(op, 0, 0, JET);
  if (leser === 'Jetpack1') { t.put(op, 0, 0, JET); t.setDiscard(op, [JET]); }
  if (leser === GW) { t.putSurprise(op, 0, GW); t.grantFor(op, 0, GW); }
  if (leser === TF) { t.grantFor(op, 0, TF); t.setAbilities(op, 0, [['Magic Arts', 'Magic Arts'], [], []]); }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [] };
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  const hp0 = t.hp(op, 0);
  const ergebnis = await sp.los(t, me, op, { att });
  return { t, rec, ergebnis, schaden: hp0 - t.hp(op, 0), sp, me, op };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  const LESER = { Stealth1: (F) => F <= 1, Stealth2: (F) => F <= 2, Jetpack0: (F) => F <= 0, Jetpack1: (F) => F <= 1, [GW]: (F) => F <= 1, [TF]: (F) => F < 2, [ED]: (F) => F <= 0 };
  const alle = Object.keys(TREIBER);

  // (a) Quellstufe = Fighting-Level des Helden
  for (const name of alle) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      for (const F of [0, 1, 2, 3]) {
        R.section(`${name}, Sitz ${me}: Held mit Fighting ${F}`);
        const k = await szene(name, me, op, 'keiner', { F });
        R.check('Kontrolle (kein Leser): der Effekt trifft den Gegner-Helden 0', k.schaden > 0, { s: k.schaden, erg: k.ergebnis });
        R.check(`Kontrolle: jeder Attack-Treffer trägt als Quellstufe das Fighting-Level des Helden (${F}), nicht 0`,
          k.rec.quellen.length >= 1 && k.rec.quellen.every(({ q, type }) => type === 'attack' && k.t.engine._heldenEffektStufe(q.name, type, q) === F), k.rec.quellen.map(x => [x.q.name, x.type, k.t.engine._heldenEffektStufe(x.q.name, x.type, x.q)]));
        sauber(R, k, 'Kontrolle');
        // Leser: je Stufe die Leser, die zwischen den Stufen unterscheiden (Glass Wall, Test Flight, Jetpack0, Stealth1) – bei F = 0 und F = 3 alle
        const lesen = (F === 0 || F === 3 || F === 1) ? Object.keys(LESER) : [GW, TF];
        for (const leser of lesen) {
          const soll = LESER[leser](F);
          const r = await szene(name, me, op, leser, { F });
          if (leser.startsWith('Stealth')) {
            // Stealth schützt das WÄHLEN – nur Wege mit Zielwahl des Gegners können es zeigen; Javelin/Crusader/Bamboo/… wählen über den Picker, Sword über das Trankfenster
            R.check(`${leser}: ${soll ? 'schützt (kein Schaden)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden });
          } else if (leser.startsWith('Jetpack')) {
            R.check(`${leser}: ${soll ? 'schützt (Treffer prallt ab)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden });
          } else {
            R.check(`${leser}: ${soll ? 'wird angeboten und wehrt ab' : 'wird nicht angeboten, Treffer landet'}`, soll ? (gefragt(r.t, leser) >= 1 && r.schaden === 0) : (gefragt(r.t, leser) === 0 && r.schaden > 0), { gefragt: gefragt(r.t, leser), s: r.schaden });
          }
          sauber(R, r, leser);
        }
      }
    }
  }

  // (c) Der Quellen-Held zählt – nicht ein anderer; Xalibur; harte Abilities-Negierung (Stowaway-Form)
  for (const name of alle) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      R.section(`${name}, Sitz ${me}: nur das Fighting-Level des Quellen-Helden zählt`);
      const sp = TREIBER[name];
      const anderer = sp.att === 0 ? 2 : 0;   // ein ANDERER Held (bei Greatmaw: nicht der gewählte)
      const r1 = await szene(name, me, op, GW, { F: 0, vorbereiten: (t) => t.setAbilities(me, anderer, fight(3)) });
      R.check('Quellen-Held Fighting 0, anderer Held Fighting 3 → Level 0 → Glass Wall wehrt ab', gefragt(r1.t, GW) >= 1 && r1.schaden === 0, { g: gefragt(r1.t, GW), s: r1.schaden });
      const r2 = await szene(name, me, op, GW, { F: 3, vorbereiten: (t) => t.setAbilities(me, anderer, fight(0)) });
      R.check('Quellen-Held Fighting 3, anderer Held Fighting 0 → Level 3 → Glass Wall bleibt verdeckt, Treffer landet', gefragt(r2.t, GW) === 0 && r2.schaden > 0, { g: gefragt(r2.t, GW), s: r2.schaden });
      for (const [n, soll] of [[1, true], [2, false]]) {
        const r = await szene(name, me, op, GW, { F: 0, vorbereiten: (t, m, a) => { t.put(m, a, 2, 'Xalibur'); t.gs.players[m].supportZones[a][3] = Array(n).fill('Fighting'); } });
        R.check(`Fighting ${n} in der Support Zone (Xalibur): Level ${n} → Glass Wall ${soll ? 'wehrt ab' : 'bleibt verdeckt, Treffer landet'}`, soll ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
        sauber(R, r, 'Xalibur');
      }
      const rn = await szene(name, me, op, GW, { F: 3, vorbereiten: (t, m, a) => { t.hero(m, a).statuses.negated = { appliedTurn: 0, _fromAttachment: 'Stowaway', abilitiesNegated: true }; } });
      R.check('Abilities hart negiert (Stowaway-Form, Held bleibt handlungsfähig): Fighting 3 zählt nicht → Level 0 → Glass Wall wehrt ab', gefragt(rn.t, GW) >= 1 && rn.schaden === 0, { g: gefragt(rn.t, GW), s: rn.schaden });
      sauber(R, rn, 'Abilities-Negierung');
      // leichte Negierung („nur der Effekt") sperrt den Angriff nicht
      const rl = await szene(name, me, op, 'keiner', { F: 2, vorbereiten: (t, m, a) => { t.hero(m, a).statuses.negated = { appliedTurn: 0, effectOnly: true }; } });
      R.check('leichte Negierung (nur der Effekt) sperrt nicht: der Effekt trifft', rl.schaden > 0, { s: rl.schaden });
    }
  }

  // (b) nicht angriffsfähiger Held → blockiert
  const SPERREN = {
    Frozen: (t, s, h) => t.heroStatus(s, h, 'frozen'),
    Stunned: (t, s, h) => t.heroStatus(s, h, 'stunned'),
    Webbed: (t, s, h) => t.heroStatus(s, h, 'webbed'),
    'hart Negated': (t, s, h) => t.heroStatus(s, h, 'negated'),
    Bound: (t, s, h) => t.heroStatus(s, h, 'bound'),
    'Attack-Sperre des Zuges': (t, s) => { t.gs.players[s]._attackSpellLockedTurn = t.gs.turn; },
  };
  for (const name of alle) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      const sp = TREIBER[name];
      const alleHelden = name === 'Infected Greatmaw' || name === 'Sword in a Bottle';   // Wahl unter mehreren eigenen Helden: erst wenn ALLE nicht angreifen können, ist der Effekt weg
      for (const [sn, sperre] of Object.entries(SPERREN)) {
        R.section(`${name}, Sitz ${me}: Held ${sn} → blockiert`);
        const vorb = (t, m) => { if (alleHelden && sn !== 'Attack-Sperre des Zuges') { for (let hi = 0; hi < 3; hi++) sperre(t, m, hi); } else sperre(t, m, sp.att); };
        const r = await szene(name, me, op, 'keiner', { F: 1, vorbereiten: vorb });
        R.check('kein Schaden – der Effekt ist blockiert', r.schaden === 0, { s: r.schaden, erg: r.ergebnis });
        R.check('der Effekt wurde nicht verbraucht (Karte bleibt auf der Hand / Stempel frei / Kreatur bleibt)', !sp.verbraucht(r.t, me), { erg: r.ergebnis });
        sauber(R, r, `${sn}`);
      }
      // ein ANDERER eigener Held kann angreifen → Wahl bleibt möglich (Sword/Greatmaw/Javelin: der gefrorene Held wird nicht angeboten)
      if (alleHelden || name === 'Javelin Throw') {
        R.section(`${name}, Sitz ${me}: Held ${sp.att} gefroren, anderer Held angriffsfähig`);
        const ander = sp.att === 0 ? 1 : 0;
        const r = await szene(name, me, op, 'keiner', { F: 1, att: ander, vorbereiten: (t, m) => {
          t.heroStatus(m, sp.att, 'frozen');
          if (name === 'Javelin Throw') t.put(m, ander, 1, H.INERT.artifact);   // der andere Held braucht ein Equip
        } });
        R.check('der gefrorene Held wird nicht als Angreifer angeboten; der angriffsfähige schlägt zu', r.schaden > 0, { s: r.schaden, erg: r.ergebnis });
        sauber(R, r, 'anderer Held');
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
