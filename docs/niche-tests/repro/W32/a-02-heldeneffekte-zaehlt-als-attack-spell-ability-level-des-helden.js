'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkt 2: ALLGEMEINE REGEL „Zählt als Attack/Spell eines Helden = Ability-Level dieses Helden". Al: „Nimm hier auch das Ability-Level, dann machen wir da
// eine allgemeine Regel für alles draus." Bei „Attack" das FIGHTING-Level des Helden, bei „Spell einer Schule" das Level der genannten Schule (Alice: DESTRUCTION MAGIC). Das ersetzt für die
// Heldeneffekte Broghan, Brackle, Arthor, Heragas, Kohta (Attack) und Alice (Spell) die W26a/W27a-Festlegung „IMMER Level 0": keine Einzelfall-Level-0-Deklarationen mehr, die Quellstufe ist das
// AKTUELLE Ability-Level des wirkenden Helden (`engine._heldenEffektStufe` → `_deklStufe`; Negierung der Abilities = 0, Xalibur-Stapel zählen, nur DIESER Held zählt).
// Leser: Glass Wall („level 1 or lower"), Test Flight („lower than the Magic Arts level" [2]), Future Tech Escape Device („equal to or lower than the number of … in your discard pile" [0]), Stealth 1/2
// (Attack und Spell), Future Tech Jetpack 0/1 (nur Attacks), Anti Magic (Spell-Immunität nach Stufe, nur Alice), Anti Magic Shield (Alice: Stufe ≤ Magic Arts des Opfers).
// Gegenproben: Siphem (gewöhnlicher Heldeneffekt) hat keine Stufe; Heragas wählt nur Kreaturen (kein Held-Leser).
// Aufruf: node docs/niche-tests/repro/W32/a-02-heldeneffekte-zaehlt-als-attack-spell-ability-level-des-helden.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack', GW = 'Glass Wall', TF = 'Test Flight', ED = 'Future Tech Escape Device';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const gegner = (v, op) => { const h0 = posHero(v, op, 0), h1 = posHero(v, op, 1); return (h0 && !h0.ineligible ? h0 : (h1 || h0 || v[0])).id; };
const stufen = (schule, n) => [Array(n).fill(schule), [], []];
const HELDEN = {
  Broghan: 'Broghan, the Frozen Guardian of the North', Brackle: 'Brackle, the Catapulting Turtle', Arthor: 'Arthor, Inheritor of the Barbarian Sword',
  Heragas: 'Heragas, the Monster Slayer', Kohta: 'Kohta, Master of Super-Killing', Alice: 'Alice, the Puppeteer Girl', Siphem: 'Siphem, the Deepsea Demon',
};
const SCHULE = { Alice: 'Destruction Magic' };   // alle anderen: Fighting

const TREIBER = {};
for (const [k, n] of Object.entries(HELDEN)) {
  TREIBER[k] = {
    schule: SCHULE[k] || 'Fighting',
    aufbau(t, me, op) {
      t.setHero(me, 0, n, 800);
      if (k === 'Alice') { for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; } }
      if (k === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
      if (k === 'Heragas') { const c = t.put(op, 1, 0, H.INERT.creature); c.turnPlayed = 1; }
      if (k === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
    },
    async los(t, me, op) {
      let gewaehlt = false;
      t.targetFn = (v) => {
        if (k === 'Brackle' && v.every(x => x.type === 'equip')) return gewaehlt ? null : [v[0].id];
        if (k === 'Heragas') return [v.find(x => x.owner === op)?.id ?? v[0].id];
        const id = gegner(v, op); gewaehlt = true; return [id];
      };
      return t.activateHero(me, 0, k === 'Kohta' ? { phase: 3 } : {});
    },
  };
}

/** Szene: Seat `me` aktiviert den Heldeneffekt (Held 0 mit Ability-Level L der zuständigen Schule); Gegner-Held 0 trägt den Leser. */
async function szene(k, me, op, leser, o = {}) {
  const sp = TREIBER[k];
  const L = o.L ?? 0;
  const opHand = leser === TF ? [TF] : leser === ED ? [ED] : [];
  const t = await H.fresh({ hand: me === 0 ? [[], opHand] : [opHand, []], deckSize: 30, hp: 800, active: me });
  sp.aufbau(t, me, op);
  t.setAbilities(me, 0, stufen(sp.schule, L));
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  if (leser === 'Stealth1') t.setAbilities(op, 0, [['Stealth'], [], []]);
  if (leser === 'Stealth2') t.setAbilities(op, 0, [['Stealth', 'Stealth'], [], []]);
  if (leser === 'Jetpack0') t.put(op, 0, 0, JET);
  if (leser === 'Jetpack1') { t.put(op, 0, 0, JET); t.setDiscard(op, [JET]); }
  if (leser === GW) { t.putSurprise(op, 0, GW); t.grantFor(op, 0, GW); }
  if (leser === TF) { t.grantFor(op, 0, TF); t.setAbilities(op, 0, [['Magic Arts', 'Magic Arts'], [], []]); }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [] };
  for (const fn of ['actionDealDamage', 'actionDealCreatureDamage']) {
    const orig = t.engine[fn].bind(t.engine);
    t.engine[fn] = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  }
  if (k === 'Kohta') {   // Kohta besiegt ohne Schadenseintrag: die Quelle zeigt sich im Angriffsfenster
    const orig = t.engine._fireAttackDeclare.bind(t.engine);
    t.engine._fireAttackDeclare = (source, target, amount) => { rec.quellen.push({ q: source, type: 'attack' }); return orig(source, target, amount); };
  }
  const hp0 = t.hp(op, 0);
  await sp.los(t, me, op);
  return { t, rec, schaden: hp0 - t.hp(op, 0), sp };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  const LESER_ATK = { Stealth1: (L) => L <= 1, Stealth2: (L) => L <= 2, Jetpack0: (L) => L <= 0, Jetpack1: (L) => L <= 1, [GW]: (L) => L <= 1, [TF]: (L) => L < 2, [ED]: (L) => L <= 0 };
  const LESER_SPELL = { Stealth1: (L) => L <= 1, Stealth2: (L) => L <= 2, [GW]: (L) => L <= 1, [TF]: (L) => L < 2, [ED]: (L) => L <= 0 };

  for (const k of ['Broghan', 'Brackle', 'Arthor', 'Kohta', 'Alice']) {
    const LESER = k === 'Alice' ? LESER_SPELL : LESER_ATK;
    const typ = k === 'Alice' ? 'destruction_spell' : 'attack';
    for (const [me, op] of [[0, 1], [1, 0]]) {
      for (const L of [0, 1, 2, 3]) {
        R.section(`${k}, Sitz ${me}: ${TREIBER[k].schule} ${L}`);
        const kt = await szene(k, me, op, 'keiner', { L });
        R.check('Kontrolle (kein Leser): der Heldeneffekt trifft den Gegner-Helden 0', kt.schaden > 0, { s: kt.schaden });
        R.check(`Kontrolle: die Quellstufe ist das ${TREIBER[k].schule}-Level des Helden (${L}) – nicht mehr fix 0`,
          kt.rec.quellen.length >= 1 && kt.rec.quellen.every(({ q, type }) => type === typ && kt.t.engine._heldenEffektStufe(q.name, type, q) === L), kt.rec.quellen.map(x => [x.q.name, x.type, kt.t.engine._heldenEffektStufe(x.q.name, x.type, x.q)]));
        if (k === 'Alice') R.check('Kontrolle: Spell-Stufe für Anti Magic (`_spellLevelAlsQuelle`) = Destruction-Level', kt.t.engine._spellLevelAlsQuelle(kt.rec.quellen[0].q.name, typ, kt.rec.quellen[0].q) === L, kt.t.engine._spellLevelAlsQuelle(kt.rec.quellen[0].q.name, typ, kt.rec.quellen[0].q));
        sauber(R, kt, 'Kontrolle');
        for (const leser of (L === 0 || L === 1 || L === 3 ? Object.keys(LESER) : [GW, TF])) {
          const soll = LESER[leser](L);
          const r = await szene(k, me, op, leser, { L });
          if (leser.startsWith('Stealth') || leser.startsWith('Jetpack')) {
            R.check(`${leser}: ${soll ? 'schützt (kein Schaden)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden });
          } else {
            R.check(`${leser}: ${soll ? 'wird angeboten und wehrt ab' : 'wird nicht angeboten, Treffer landet'}`, soll ? (gefragt(r.t, leser) >= 1 && r.schaden === 0) : (gefragt(r.t, leser) === 0 && r.schaden > 0), { gefragt: gefragt(r.t, leser), s: r.schaden });
          }
          sauber(R, r, leser);
        }
      }
      // nur das Level des WIRKENDEN Helden zählt; Xalibur-Stapel zählen; harte Abilities-Negierung (Stowaway-Form) = 0
      R.section(`${k}, Sitz ${me}: wirkender Held, Xalibur, Negierung`);
      const sch = TREIBER[k].schule;
      const r1 = await szene(k, me, op, GW, { L: 0, vorbereiten: (t) => t.setAbilities(me, 2, stufen(sch, 3)) });
      R.check(`Held 0 ${sch} 0, anderer Held ${sch} 3 → Stufe 0 → Glass Wall wehrt ab`, gefragt(r1.t, GW) >= 1 && r1.schaden === 0, { g: gefragt(r1.t, GW), s: r1.schaden });
      const r2 = await szene(k, me, op, GW, { L: 3, vorbereiten: (t) => t.setAbilities(me, 2, stufen(sch, 0)) });
      R.check(`Held 0 ${sch} 3, anderer Held ${sch} 0 → Stufe 3 → Glass Wall bleibt verdeckt, Treffer landet`, gefragt(r2.t, GW) === 0 && r2.schaden > 0, { g: gefragt(r2.t, GW), s: r2.schaden });
      for (const [n, soll] of [[1, true], [2, false]]) {
        const r = await szene(k, me, op, GW, { L: 0, vorbereiten: (t) => { t.put(me, 0, 2, 'Xalibur'); t.gs.players[me].supportZones[0][3] = Array(n).fill(sch); } });
        R.check(`${sch} ${n} im Stapel der Support Zone (Xalibur): Stufe ${n} → Glass Wall ${soll ? 'wehrt ab' : 'bleibt verdeckt, Treffer landet'}`, soll ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
      }
      {   // harte Abilities-Negierung (Stowaway-Form) = Stufe 0 (der Heldeneffekt selbst ruht dann; geprüft über die Stufe der Quelle)
        const t = await H.fresh({ deckSize: 30, hp: 800, active: me });
        TREIBER[k].aufbau(t, me, op);
        t.setAbilities(me, 0, stufen(sch, 3));
        const q = { name: HELDEN[k], owner: me, heroIdx: 0 };
        const vorher = t.engine._heldenEffektStufe(HELDEN[k], typ, q);
        t.hero(me, 0).statuses.negated = { appliedTurn: 0, _fromAttachment: 'Stowaway', abilitiesNegated: true };
        R.check('Abilities hart negiert (Stowaway-Form): Stufe 3 zählt nicht → 0', vorher === 3 && t.engine._heldenEffektStufe(HELDEN[k], typ, q) === 0, [vorher, t.engine._heldenEffektStufe(HELDEN[k], typ, q)]);
      }
    }
  }

  // Heragas (nur Kreaturen als Ziel): Stufe aus den Treffer-Quellen; Siphem als Gegenprobe ohne Stufe
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Heragas, Sitz ${me}: Fighting-Level in der Treffer-Quelle`);
    for (const L of [0, 1, 2, 3]) {
      const t = await szene('Heragas', me, op, 'keiner', { L });
      const q = t.rec.quellen.filter(x => x.type === 'attack');
      R.check(`Fighting ${L}: der Treffer auf die Kreatur trägt die Stufe ${L}`, q.length >= 1 && q.every(x => t.t.engine._heldenEffektStufe(x.q.name, 'attack', x.q) === L), q.map(x => [x.q.name, t.t.engine._heldenEffektStufe(x.q.name, 'attack', x.q)]));
      R.check('die Kreatur ist besiegt (Effekt lief)', !t.t.engine.cardInstances.some(c => c.name === H.INERT.creature && c.zone === 'support' && c.owner === op), null);
      sauber(R, t, 'Heragas');
    }
    R.section(`Siphem (gewöhnlicher Heldeneffekt), Sitz ${me}: keine Stufe`);
    const t = await H.fresh({});
    t.setHero(me, 0, HELDEN.Siphem, 800);
    R.check('Siphem: weder als Attack noch als Spell eine Stufe', t.engine._heldenEffektStufe(HELDEN.Siphem, 'attack', { name: HELDEN.Siphem, owner: me, heroIdx: 0 }) === null
      && t.engine._heldenEffektStufe(HELDEN.Siphem, 'destruction_spell', { name: HELDEN.Siphem, owner: me, heroIdx: 0 }) === null, null);
  }

  // Alice × Anti Magic (Spell-Immunität nach Stufe) und Anti Magic Shield (Stufe ≤ Magic Arts des Opfers)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Alice × Anti Magic / Anti Magic Shield, Sitz ${me}`);
    for (const [D, AM, blockt] of [[0, 1, true], [1, 1, true], [2, 1, false], [2, 2, true], [3, 2, false], [3, 3, true]]) {
      const t = await H.fresh({ hand: me === 0 ? [[], []] : [[], []], deckSize: 30, hp: 800, active: me });
      TREIBER.Alice.aufbau(t, me, op);
      t.setAbilities(me, 0, stufen('Destruction Magic', D));
      t.hero(op, 0).buffs = { ...(t.hero(op, 0).buffs || {}), magic_immune: { level: AM } };
      t.targetFn = (v) => [gegner(v, op)];
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      const hp0 = t.hp(op, 0);
      await t.activateHero(me, 0, {});
      R.check(`Alice Destruction ${D} gegen Anti Magic (Stufe ${AM}): ${blockt ? 'geblockt' : 'trifft'}`, blockt ? t.hp(op, 0) === hp0 : t.hp(op, 0) < hp0, { hp: t.hp(op, 0) });
      sauber(R, { t }, 'Anti Magic');
    }
    for (const [D, MA, blockt] of [[0, 1, true], [1, 1, true], [2, 1, false], [2, 2, true], [3, 2, false]]) {
      const t = await H.fresh({ hand: me === 0 ? [[], ['Anti Magic Shield']] : [['Anti Magic Shield'], []], deckSize: 30, hp: 800, active: me });
      TREIBER.Alice.aufbau(t, me, op);
      t.setAbilities(me, 0, stufen('Destruction Magic', D));
      t.setAbilities(op, 0, [Array(MA).fill('Magic Arts'), [], []]);
      t.targetFn = (v) => [gegner(v, op)];
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      const hp0 = t.hp(op, 0);
      await t.activateHero(me, 0, {});
      R.check(`Alice Destruction ${D} gegen Anti Magic Shield (Magic Arts ${MA}): ${blockt ? 'negiert' : 'trifft (Stufe zu hoch)'}`, blockt ? t.hp(op, 0) === hp0 : t.hp(op, 0) < hp0, { hp: t.hp(op, 0), gefragt: gefragt(t, 'Anti Magic Shield') });
      sauber(R, { t }, 'Anti Magic Shield');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
