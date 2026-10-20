'use strict';
// W30a · Entscheidung Al (21.10.2026, Punkt 3): Bluff, Crimson Web, Tharxian Horse und Future Tech Weathercock („chosen by an Attack or Spell" / „affected by an Attack or Spell") lasen nur den KARTENTYP
// der Quelle. Al: „Ja" → sie reagieren auch auf Effekte, die als Attack/Spell ZÄHLEN (Broghan, Brackle, Arthor, Heragas, Kohta, Alice, Gegenstandseffekte [Crusader's ×4, Bamboo Staff, Javelin Throw,
// Sacrificial Dagger, Sword in a Bottle], Greatmaw-Treffer), so wie Flooding (W26a): Kennzeichen `_heldenEffektStufe(…) != null` (Helfer `zaehltAlsAttackOderSpell` in `_hooks.js`).
// Gleiche Lücke fand sich bei Dream World Switcheroo („chosen by an Attack or Spell", nur Kartentyp) – angeglichen. Future Tech Weathercock las den Schadenstyp schon (`attack`/`*_spell`): bestätigt.
// Gegenproben: gewöhnliche Heldeneffekte (Siphem) und Kreatureneffekte lösen nicht aus; echte Attack-/Spell-Karten lösen weiter aus.
// Aufruf: node docs/niche-tests/repro/W30/a-03-bluff-crimson-web-tharxian-horse-weathercock-reagieren-auf-zaehlt-als-attack-spell.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const CECILIA = 'Cecilia, the Harrowing Crusader';
const HELDEN = {
  'Alice': 'Alice, the Puppeteer Girl', 'Broghan': 'Broghan, the Frozen Guardian of the North', 'Brackle': 'Brackle, the Catapulting Turtle',
  'Arthor': 'Arthor, Inheritor of the Barbarian Sword', 'Kohta': 'Kohta, Master of Super-Killing', 'Siphem': 'Siphem, the Deepsea Demon',
};

// Quellen: `aufbau(t, me, op)` stellt den Wirker, `los(t, me, op, rec)` löst aus; `zaehlt` = zählt als Attack/Spell
const QUELLEN = {};
for (const [k, n] of Object.entries(HELDEN)) {
  QUELLEN[k] = {
    zaehlt: k !== 'Siphem',
    aufbau(t, me) {
      t.setHero(me, 0, n, 800);
      if (k === 'Alice') { for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; } }
      if (k === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
      if (k === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
    },
    async los(t, me, op) {
      let gewaehlt = false;
      t.targetFn = (v) => {
        if (k === 'Brackle' && v.every(x => x.type === 'equip')) return gewaehlt ? null : [v[0].id];   // nach einer Negierung führt Brackle „↩ Back" zur Opferwahl zurück: dann abbrechen
        const h = posHero(v, op, 0); if (h) gewaehlt = true; return h ? [h.id] : undefined;
      };
      return t.activateHero(me, 0, k === 'Kohta' ? { phase: 3 } : {});
    },
  };
}
const opfer1 = (t, me, op) => (t.targetFn = (v) => { const h = posHero(v, op, 0); return h ? [h.id] : [v[0].id]; });
QUELLEN['Sword in a Bottle'] = { zaehlt: true, hand: ['Sword in a Bottle'], aufbau() {}, async los(t, me, op) {
  t.targetFn = (v) => [posHero(v, me, 1).id, posHero(v, op, 0).id];
  await t.play(me, 'Sword in a Bottle', { hero: 0 }); } };
QUELLEN['Javelin Throw'] = { zaehlt: true, hand: ['Javelin Throw'], aufbau(t, me) { t.put(me, 0, 0, H.INERT.artifact); }, async los(t, me, op) {
  t.targetFn = (v) => { if (!v.some(x => x.owner === op)) { const own = posHero(v, me, 0); return own ? [own.id] : [v[0].id]; } return [posHero(v, op, 0).id]; };
  await t.play(me, 'Javelin Throw', { hero: 0 }); } };
QUELLEN['Bamboo Staff'] = { zaehlt: true, discard: ['ZZ Filler'], aufbau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); }, async los(t, me, op) {
  opfer1(t, me, op); await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W30a' })); } };
QUELLEN['Sacrificial Dagger'] = { zaehlt: true, aufbau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.dolch = t.put(me, 1, 0, H.INERT.creature); }, async los(t, me, op) {
  opfer1(t, me, op); await t.run(() => t.engine.opfereKreatur(t.dolch, { name: 'Test', owner: me })); } };
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  QUELLEN[k] = { zaehlt: true, held: CECILIA, aufbau(t, me) { t.put(me, 0, 0, k); }, async los(t, me, op) { opfer1(t, me, op); await t.activateEquip(me, 0, 0); } };
}
QUELLEN['Infected Greatmaw'] = { zaehlt: true, aufbau(t, me) {
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; }, async los(t, me, op) {
  t.targetFn = (v, cfg) => {
    if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
    if (v.every(z => z.owner === me)) return [posHero(v, me, 0).id];
    return [posHero(v, op, 0).id];
  };
  t.phase(2); await t.activateCreature(me, 1, 0); } };

async function szene(quelle, me, op, reaktion) {
  const spec = QUELLEN[quelle];
  const hands = me === 0 ? [spec.hand || [], []] : [[], spec.hand || []];
  const t = await H.fresh({ hand: hands, discard: me === 0 ? [spec.discard || [], []] : [[], spec.discard || []], deckSize: 30, hp: 800, active: me });
  if (spec.held) t.setHero(me, 0, spec.held, 800);
  t.putSurprise(op, 0, reaktion); t.grantFor(op, 0, reaktion);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  spec.aufbau(t, me, op);
  const summe = (s) => t.gs.players[s].heroes.reduce((a, h) => a + (h.hp || 0), 0);
  const hand0 = t.pile(op, 'hand').length, hpOp = t.hp(op, 0), hpMe = summe(me);
  await spec.los(t, me, op);
  return { t, ausgeloest: gefragt(t, reaktion) >= 1, hand: t.pile(op, 'hand').length - hand0, schadenOp: hpOp - t.hp(op, 0), schadenMe: hpMe - summe(me),
    genetzt: t.engine.cardInstances.some(c => c.name === 'Crimson Web' && c.zone === 'support' && c.controller === me) || t.gs.players[me].heroes.some(h => h.statuses?.webbed) };
}

(async () => {
  const R = H.runner();
  const REAKT = ['Bluff', 'Crimson Web', 'Tharxian Horse'];
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const q of Object.keys(QUELLEN)) {
      for (const re of REAKT) {
        const soll = QUELLEN[q].zaehlt;
        R.section(`Sitz ${me}: ${q} gegen ${re} auf Sitz ${op}`);
        const r = await szene(q, me, op, re);
        R.check(`${re} ${soll ? 'löst aus (der Effekt zählt als Attack/Spell)' : 'bleibt verdeckt (gewöhnlicher Heldeneffekt)'}`, r.ausgeloest === soll, { prompts: r.t.prompts.map(p => p.d.title) });
        if (soll) {
          if (re === 'Bluff') R.check('Bluff: 3 Karten gezogen, der Effekt läuft normal weiter (Gegner-Held 0 nimmt Schaden)', r.hand === 3 && r.schadenOp > 0, { hand: r.hand, s: r.schadenOp });
          // Sword in a Bottle (Trank): die Quelle nennt keinen Angreifer-Helden (`heroIdx` −1) – die Reaktion löst aus und negiert, Netz/Rückschaden entfallen (Frage an Al);
          const ohneAngreifer = q === 'Sword in a Bottle' || q === 'Infected Greatmaw';   // Greatmaw: die Engine meldet die Kreatur als Wirker (`_creatureCasterForSource`) → Rückschaden/Netz träfen die Kreatur bzw. entfallen (Bestand, nicht Teil der Entscheidung)
          if (re === 'Crimson Web') R.check(ohneAngreifer ? 'Crimson Web: Effekt negiert (kein Schaden am Träger); kein Angreifer-Held erkennbar (Sword in a Bottle / Greatmaw-Kreatur)' : 'Crimson Web: Effekt negiert (kein Schaden am Träger), Netz am Angreifer-Helden', r.schadenOp === 0 && (ohneAngreifer || r.genetzt), { s: r.schadenOp, genetzt: r.genetzt });
          if (re === 'Tharxian Horse') R.check(ohneAngreifer ? 'Tharxian Horse: Effekt negiert (kein Schaden am Träger); kein Angreifer-Held erkennbar (Sword in a Bottle / Greatmaw-Kreatur)' : 'Tharxian Horse: Effekt negiert (kein Schaden am Träger), der Angreifer nimmt Rückschaden', r.schadenOp === 0 && (ohneAngreifer || r.schadenMe > 0), { op: r.schadenOp, me: r.schadenMe });
        } else {
          R.check(`${re}: der Heldeneffekt trifft normal (Schaden am Träger)`, r.schadenOp > 0, r.schadenOp);
        }
        // Crimson Web hängt sich an den Angreifer: der Harness-Audit meldet dafür eine „Geister-Instanz" (auch bei echten Attack-/Spell-Karten, Basis d6ebba2) – hier nur die Engine-Fehler prüfen
        R.check(re === 'Crimson Web' ? 'keine Engine-Fehler' : 'sauber', r.t.errors.length === 0 && (re === 'Crimson Web' || r.t.audit().length === 0), { e: r.t.errors, a: r.t.audit() });
      }
    }
  }

  // Gegenprobe: echte Attack-/Spell-Karten lösen weiter aus, ein Kreaturen-Effekt nicht
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Karten-Gegenprobe`);
    for (const re of REAKT) {
      for (const [karte, soll] of [['Quick Attack', true], ['Fireball', true]]) {
        const t = await H.fresh({ hand: me === 0 ? [[karte], []] : [[], [karte]], deckSize: 30, hp: 800, active: me });
        t.putSurprise(op, 0, re); t.grantFor(op, 0, re);
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        t.targetFn = (v) => [posHero(v, op, 0).id];
        await t.play(me, karte, { hero: 0 });
        R.check(`${re} gegen ${karte}: löst aus`, (gefragt(t, re) >= 1) === soll, gefragt(t, re));
        R.check('keine Engine-Fehler', t.errors.length === 0 && (re === 'Crimson Web' || t.audit().length === 0), { e: t.errors, a: t.audit() });
      }
    }
  }

  // Future Tech Weathercock + Dream World Switcheroo: Bedingung direkt (post-target-Fenster mit Quellobjekt und Schadenstyp)
  R.section('Weathercock / Switcheroo: postTargetCondition je Quelle');
  {
    const t = await H.fresh({ deckSize: 30, hp: 800 });
    const e = t.engine, gs = t.gs;
    const wc = loadCardEffect('Future Tech Weathercock');
    const sw = loadCardEffect('Dream World Switcheroo');
    const wcInst = t.put(0, 0, 0, 'Future Tech Weathercock');
    t.setDiscard(0, ['Future Tech Weathercock']);
    const traeger = t.put(0, 1, 0, H.INERT.creature); traeger.counters.attachedHero = 'Gon, the Frostbringer';
    const ziele2 = [{ type: 'hero', owner: 0, heroIdx: 0, cardName: t.hero(0, 0).name }, { type: 'hero', owner: 0, heroIdx: 1, cardName: t.hero(0, 1).name }];
    const ziele1 = [ziele2[0]];
    const bamboo = t.put(1, 0, 0, 'Bamboo Staff');
    const FaelleWC = [
      ['Broghan (Attack)', { name: HELDEN.Broghan, owner: 1, heroIdx: 0 }, 'attack', true], ['Alice (Spell)', { name: HELDEN.Alice, owner: 1, heroIdx: 0 }, 'destruction_spell', true],
      ['Bamboo Staff (Instanz)', bamboo, 'attack', true], ['Fireball (Karte)', { name: 'Fireball', owner: 1, heroIdx: 0 }, 'destruction_spell', true],
      ['Quick Attack (Karte)', { name: 'Quick Attack', owner: 1, heroIdx: 0 }, 'attack', true], ['Siphem (gewöhnlicher Heldeneffekt)', { name: HELDEN.Siphem, owner: 1, heroIdx: 0 }, 'hero', false],
    ];
    for (const [n, q, dt, soll] of FaelleWC) {
      const ok = wc.postTargetCondition(gs, 0, e, ziele2, q, { damageType: dt, inst: wcInst, heroIdx: 0, heroOwner: 0 });
      R.check(`Weathercock (2 Ziele) · ${n}: ${soll ? 'bietet sich an' : 'bietet sich nicht an'}`, !!ok === soll, ok);
    }
    R.check('Weathercock · nur 1 Ziel (kein weiteres Ziel): bietet sich nicht an', !wc.postTargetCondition(gs, 0, e, ziele1, { name: HELDEN.Broghan, owner: 1, heroIdx: 0 }, { damageType: 'attack', inst: wcInst, heroIdx: 0, heroOwner: 0 }), null);
    const FaelleSW = [
      ['Broghan (Attack)', { name: HELDEN.Broghan, owner: 1, heroIdx: 0 }, 'attack', true], ['Kohta (Attack)', { name: HELDEN.Kohta, owner: 1, heroIdx: 0 }, 'attack', true],
      ['Alice (Spell)', { name: HELDEN.Alice, owner: 1, heroIdx: 0 }, 'destruction_spell', true], ['Bamboo Staff (Instanz)', bamboo, 'attack', true],
      ["Crusader's Cutlass (Name)", { name: "Crusader's Cutlass", owner: 1, heroIdx: 0 }, 'attack', true], ['Fireball (Karte)', { name: 'Fireball', owner: 1, heroIdx: 0 }, 'destruction_spell', true],
      ['Siphem (gewöhnlicher Heldeneffekt)', { name: HELDEN.Siphem, owner: 1, heroIdx: 0 }, 'hero', false], ['Broghan ohne Schadenstyp (kein Fenster-Kontext)', { name: HELDEN.Broghan, owner: 1, heroIdx: 0 }, undefined, false],
    ];
    for (const [n, q, dt, soll] of FaelleSW) {
      const ok = sw.postTargetCondition(gs, 0, e, ziele1, q, dt === undefined ? undefined : { damageType: dt });
      R.check(`Switcheroo · ${n}: ${soll ? 'bietet sich an' : 'bietet sich nicht an'}`, !!ok === soll, ok);
    }
    R.check('sauber', t.errors.length === 0, t.errors);
  }

  // Helfer direkt
  {
    R.section('zaehltAlsAttackOderSpell (Helfer in _hooks.js)');
    const t = await H.fresh({});
    const { zaehltAlsAttackOderSpell: z } = require('../../../../cards/effects/_hooks.js');
    const e = t.engine;
    for (const [n, si, soll] of [
      ['Broghan', { cardName: HELDEN.Broghan, damageType: 'attack' }, true], ['Alice', { cardName: HELDEN.Alice, damageType: 'destruction_spell' }, true],
      ['Alice als Attack (falscher Typ)', { cardName: HELDEN.Alice, damageType: 'attack' }, false], ['Siphem', { cardName: HELDEN.Siphem, damageType: 'hero' }, false],
      ["Crusader's Hookshot", { cardName: "Crusader's Hookshot", damageType: 'attack' }, true], ['Greatmaw-Treffer (Stempel)', { cardName: HELDEN.Siphem, damageType: 'attack', cardInstance: { name: HELDEN.Siphem, treatedAsAttack: { level: 1 } } }, true],
      ['Fireball (Karte, kein Zählt-als)', { cardName: 'Fireball', damageType: 'destruction_spell' }, false], ['ohne Quelle', null, false],
    ]) R.check(`${n}: ${soll}`, z(e, si) === soll, z(e, si));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
