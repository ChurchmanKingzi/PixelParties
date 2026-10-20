'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkte 6 und 7:
//  6) Sword in a Bottle („Choose a Hero you control and a target your opponent controls. Deal damage equal to your Hero's Attack stat …"): Al: „Ja, der gewählte eigene Hero ist der Angreifer!" → Crimson Web hängt
//     sich an ihn, Tharxian Horse trifft ihn (Rückschaden), Frost Rune friert ihn ein, Booby Trap trifft ihn; die Quellstufe ist sein Fighting-Level.
//  7) Infected Greatmaw („That is treated as that Hero hitting the target with an Attack."): Al: „Genau, der Hero soll der Angreifer sein" → beim Treffer ist der gewählte Held der Angreifer, NICHT die Kreatur
//     (bisher meldete die Engine die Kreatur als Wirker über `_creatureCasterForSource`). Gleiches für alle „treated as that Hero hitting"-Effekte (Bamboo Staff, Sacrificial Dagger, Javelin Throw, Alluring Light).
//  Normalfälle bleiben: ein echter Kreatureneffekt (Aggressive Town Guard) trifft/friert weiter die KREATUR (Gegenprobe), ein Kreaturen-Zauber (Demon's-Gate-Muster) ebenso.
// Aufruf: node docs/niche-tests/repro/W32/a-06-sword-in-a-bottle-und-greatmaw-der-gewaehlte-held-ist-der-angreifer.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];
const REAKTIONEN = ['Crimson Web', 'Tharxian Horse', 'Frost Rune', 'Booby Trap'];

/** Szene: `me` löst Sword in a Bottle (Angreifer = eigener Held `att`) oder den Greatmaw (gewählter Held `att`) aus; die Reaktion liegt verdeckt beim Gegner-Helden 0. */
async function szene(quelle, me, op, reaktion, att = 1) {
  const t = await H.fresh({ hand: me === 0 ? [quelle === 'Sword' ? ['Sword in a Bottle'] : [], []] : [[], quelle === 'Sword' ? ['Sword in a Bottle'] : []], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  t.putSurprise(op, 0, reaktion); t.grantFor(op, 0, reaktion);
  t.setAbilities(me, att, fight(2));
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  let greatmaw = null;
  if (quelle === 'Greatmaw') { greatmaw = t.put(me, 1, 0, 'Infected Greatmaw'); greatmaw.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; }
  const hpMe = t.gs.players[me].heroes.map(h => h.hp), hpOp = t.hp(op, 0);
  const rec = [];
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  if (quelle === 'Sword') {
    t.targetFn = (v) => [posHero(v, me, att).id, posHero(v, op, 0).id];
    await t.play(me, 'Sword in a Bottle', { hero: 0 });
  } else {
    t.targetFn = (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [posHero(v, me, att).id];
      return [posHero(v, op, 0).id];
    };
    t.phase(2); await t.activateCreature(me, 1, 0);
  }
  const heroStatus = t.gs.players[me].heroes.map(h => Object.keys(h.statuses || {}));
  return {
    t, rec, greatmaw, schadenOp: hpOp - t.hp(op, 0), heldVerlust: t.gs.players[me].heroes.map((h, i) => hpMe[i] - h.hp), heroStatus,
    genetzt: t.gs.players[me].heroes.map(h => !!h.statuses?.webbed), eingefroren: t.gs.players[me].heroes.map(h => !!h.statuses?.frozen),
    netzAmHeld: (hi) => t.engine.cardInstances.some(c => c.name === 'Crimson Web' && c.zone === 'support' && c.heroIdx === hi && c.controller === me),
  };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && (was.includes('Crimson Web') || r.t.audit().length === 0), { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  for (const quelle of ['Sword', 'Greatmaw']) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      for (const att of (quelle === 'Sword' ? [0, 1, 2] : [0, 2])) {
        // Crimson Web: Netz am Angreifer-Helden
        R.section(`${quelle}, Sitz ${me}, Angreifer-Held ${att}: Crimson Web hängt sich an den HELDEN`);
        const cw = await szene(quelle, me, op, 'Crimson Web', att);
        R.check('Crimson Web löst aus, der Effekt ist negiert (kein Schaden am Gegner-Helden)', gefragt(cw.t, 'Crimson Web') >= 1 && cw.schadenOp === 0, { g: gefragt(cw.t, 'Crimson Web'), s: cw.schadenOp });
        R.check(`der gewählte Held ${att} ist verwebt (Status webbed), kein anderer Held`, cw.genetzt[att] && cw.genetzt.filter(Boolean).length === 1, cw.genetzt);
        R.check('das Netz liegt als Anhängsel im Support des Angreifer-Helden', cw.netzAmHeld(att), null);
        if (quelle === 'Greatmaw') R.check('die Kreatur (Infected Greatmaw) bleibt unberührt (kein Netz, keine Statuswirkung)', cw.t.engine.cardInstances.some(c => c === cw.greatmaw && c.zone === 'support') || !cw.t.engine.cardInstances.some(c => c.name === 'Crimson Web' && c.heroIdx === 1 && c.zone === 'support'), null);
        sauber(R, cw, 'Crimson Web');
        // Tharxian Horse: Rückschaden an den HELDEN
        R.section(`${quelle}, Sitz ${me}, Angreifer-Held ${att}: Tharxian Horse trifft den HELDEN`);
        const th = await szene(quelle, me, op, 'Tharxian Horse', att);
        R.check('Tharxian Horse löst aus, der Effekt ist negiert (kein Schaden am Gegner-Helden)', gefragt(th.t, 'Tharxian Horse') >= 1 && th.schadenOp === 0, { g: gefragt(th.t, 'Tharxian Horse'), s: th.schadenOp });
        R.check(`der Rückschaden trifft den Angreifer-Helden ${att} (50 × Ziele, die der Gegner kontrolliert)`, th.heldVerlust[att] > 0 && th.heldVerlust.filter((v, i) => i !== att && v > 0).length === 0, th.heldVerlust);
        if (quelle === 'Greatmaw') R.check('die Kreatur (Infected Greatmaw) nimmt keinen Rückschaden', th.t.engine.cardInstances.some(c => c === th.greatmaw && c.zone === 'support' && (c.counters.currentHp ?? 1) > 0), null);
        sauber(R, th, 'Tharxian Horse');
        // Frost Rune: der Angreifer-HELD friert ein
        R.section(`${quelle}, Sitz ${me}, Angreifer-Held ${att}: Frost Rune friert den HELDEN ein`);
        const fr = await szene(quelle, me, op, 'Frost Rune', att);
        R.check('Frost Rune löst aus, der Effekt ist negiert', gefragt(fr.t, 'Frost Rune') >= 1 && fr.schadenOp === 0, { g: gefragt(fr.t, 'Frost Rune'), s: fr.schadenOp });
        R.check(`der Angreifer-Held ${att} ist eingefroren`, fr.eingefroren[att], fr.eingefroren);
        if (quelle === 'Greatmaw') R.check('die Kreatur ist nicht eingefroren', !fr.greatmaw.counters.frozen, fr.greatmaw.counters);
        sauber(R, fr, 'Frost Rune');
        // Booby Trap: 100 Schaden an den Angreifer-HELDEN
        R.section(`${quelle}, Sitz ${me}, Angreifer-Held ${att}: Booby Trap trifft den HELDEN`);
        const bt = await szene(quelle, me, op, 'Booby Trap', att);
        R.check('Booby Trap löst aus', gefragt(bt.t, 'Booby Trap') >= 1, { g: gefragt(bt.t, 'Booby Trap') });
        R.check(`der Angreifer-Held ${att} nimmt 100 Schaden`, bt.heldVerlust[att] === 100 && bt.heldVerlust.filter((v, i) => i !== att && v > 0).length === 0, bt.heldVerlust);
        if (quelle === 'Greatmaw') R.check('die Kreatur nimmt keinen Schaden', bt.t.engine.cardInstances.some(c => c === bt.greatmaw && c.zone === 'support' && (c.counters.currentHp ?? 1) >= 1), null);
        sauber(R, bt, 'Booby Trap');
      }
    }
  }

  // Gegenprobe: ein echter Kreatureneffekt (Aggressive Town Guard: „deal 50 damage to a target") bleibt eine KREATUREN-Quelle
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Gegenprobe Aggressive Town Guard × Frost Rune (Normalfall unverändert)`);
    const t = await H.fresh({ deckSize: 30, hp: 800, active: me });
    const wache = t.put(me, 1, 0, 'Aggressive Town Guard'); wache.turnPlayed = 1;
    t.putSurprise(op, 0, 'Frost Rune'); t.grantFor(op, 0, 'Frost Rune');
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
    t.phase(2);
    await t.activateCreature(me, 1, 0);
    R.check('Frost Rune löst aus', gefragt(t, 'Frost Rune') >= 1, { g: gefragt(t, 'Frost Rune') });
    R.check('der Angreifer ist die KREATUR (eingefroren), kein Held', !!wache.counters.frozen && t.gs.players[me].heroes.every(h => !h.statuses?.frozen), { c: wache.counters.frozen, h: t.gs.players[me].heroes.map(h => !!h.statuses?.frozen) });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  // Sword in a Bottle × gewähltes KREATURENZIEL: das Surprise-Fenster der Wahl öffnet (Mountain Tear River: „the user or a Creature in one of its Support Zones is chosen" → brennt den Angreifer = den gewählten Helden)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Sword in a Bottle gegen eine Kreatur × Mountain Tear River`);
    const t = await H.fresh({ hand: me === 0 ? [['Sword in a Bottle'], []] : [[], ['Sword in a Bottle']], deckSize: 30, hp: 800, active: me });
    for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
    const k = t.put(op, 0, 1, H.INERT.creature); k.turnPlayed = 1;
    t.putSurprise(op, 0, 'Mountain Tear River'); t.grantFor(op, 0, 'Mountain Tear River');
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [posHero(v, me, 2).id, v.find(x => x.type === 'equip' && x.owner === op).id];
    await t.play(me, 'Sword in a Bottle', { hero: 0 });
    R.check('Mountain Tear River öffnet bei der Wahl der Kreatur', gefragt(t, 'Mountain Tear River') >= 1, { g: gefragt(t, 'Mountain Tear River') });
    R.check('der gewählte Angreifer-Held 2 brennt (Burn)', !!t.hero(me, 2).statuses?.burned && !t.hero(me, 0).statuses?.burned, { h2: !!t.hero(me, 2).statuses?.burned, h0: !!t.hero(me, 0).statuses?.burned });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  // Dark Ocean („neither player can react to … the effects of their opponent's Creatures"): die Greatmaw-Kette ändert daran nichts – der Gegner kann nicht reagieren, die eigenen Arrows des Besitzers schon
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Greatmaw unter Dark Ocean`);
    for (const [karte, besitzer, soll] of [['Test Flight', op, false], ['Angelfeather Arrow', me, true]]) {
      const t = await H.fresh({ hand: besitzer === 0 ? [[karte], []] : [[], [karte]], deckSize: 30, hp: 800, active: me });
      t.putArea(me, 'Dark Ocean');
      for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
      if (karte === 'Test Flight') t.grantFor(op, 0, 'Test Flight');
      const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1;
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v, cfg) => {
        if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
        if (v.every(z => z.owner === me)) return [posHero(v, me, 0).id];
        return [posHero(v, op, 0).id];
      };
      const hp0 = t.hp(op, 0);
      t.phase(2); await t.activateCreature(me, 1, 0);
      R.check(`${karte} (Besitzer: ${besitzer === me ? 'Greatmaw-Besitzer' : 'Gegner'}) wird ${soll ? 'angeboten' : 'NICHT angeboten'}`, (gefragt(t, karte) >= 1) === soll, { g: gefragt(t, karte) });
      R.check(`Schaden am Gegner-Helden: ${soll ? '160 (Arrow +60)' : '100 (keine Reaktion)'}`, hp0 - t.hp(op, 0) === (soll ? 160 : 100), hp0 - t.hp(op, 0));
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }

  // Der Sacrificial Dagger schlägt MITTEN im Greatmaw-Effekt zu (Opferung = Auslöser): auch sein Treffer gehört dem HELDEN, nicht der wirkenden Kreatur (`gs._spellCasterCreature` = Greatmaw)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Sacrificial Dagger im Greatmaw-Effekt × Frost Rune`);
    const t = await H.fresh({ deckSize: 30, hp: 800, active: me });
    for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
    t.put(me, 0, 0, 'Sacrificial Dagger');
    const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1;
    t.putSurprise(op, 0, 'Frost Rune'); t.grantFor(op, 0, 'Frost Rune');
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [posHero(v, me, 2).id];
      return [posHero(v, op, 0).id];
    };
    t.phase(2); await t.activateCreature(me, 1, 0);
    R.check('Frost Rune löst aus', gefragt(t, 'Frost Rune') >= 1, { g: gefragt(t, 'Frost Rune') });
    R.check('eingefroren wird der Träger des Daggers (Held 0) – nicht die Greatmaw-Kreatur', !!t.hero(me, 0).statuses?.frozen && !g.counters.frozen, { h0: !!t.hero(me, 0).statuses?.frozen, kreatur: !!g.counters.frozen });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  // Einheit: `_rewriteSourceForCreatureCaster` lässt Quellen mit Stempel (Held als Angreifer) in Ruhe, verbiegt aber gewöhnliche weiter auf die wirkende Kreatur
  {
    R.section('_rewriteSourceForCreatureCaster: Stempel schützt die Heldenquelle');
    const t = await H.fresh({});
    const e = t.engine;
    const g = t.put(0, 1, 0, 'Infected Greatmaw');
    t.gs._spellCasterCreature = g;
    const mitStempel = { name: 'Tushu', owner: 0, heroIdx: 0, treatedAsAttack: e.heldenAngriffStempel(0, 0) };
    const ohne = { name: 'Fireball', owner: 0, heroIdx: 0 };
    R.check('Quelle mit Stempel bleibt dieselbe Quelle (kein `_creatureCasterForSource`)', e._rewriteSourceForCreatureCaster(mitStempel) === mitStempel && !mitStempel._creatureCasterForSource, null);
    R.check('gewöhnliche Quelle (Zauber der Kreatur) wird weiter auf die wirkende Kreatur verbogen', e._rewriteSourceForCreatureCaster(ohne)._creatureCasterForSource === g, null);
    delete t.gs._spellCasterCreature;
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
