'use strict';
// W34a · Punkt 3 · Al, 22.10.2026: „Ja, die zählen!" – Effekte, die als Attack zählen (Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff,
// Sacrificial Dagger, Infected Greatmaw), zählen auch für Attack-ZÄHLER und -SPERREN: Berserk-Limit (2 Attacks), Knife Throw („the only Attack you play this turn"), Rioting Village
// („no player can use more than 1 Attack per turn"), Quick Attack („first Attack"), Mirjam („never more than 1 Attack per turn") und die Zähler `attacksPlayedThisTurn` / `heroesAttackedThisTurn` /
// `hero._attacksThisTurn`. Erfasst über `engine.alsAttackKette` → `engine.zaehleAlsArt` (EIN Zählschritt je Treffer-Ereignis, kein Doppelzählen) und die Sperrprüfung `engine.heroKannAngreifen`
// (gleiches Verhalten wie bei Frozen/Stunned: der Effekt ist geblockt / nicht aktivierbar).
// Aufruf: node docs/niche-tests/repro/W34/a-03-zaehlt-als-attack-zaehler-und-sperren.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const CECILIA = 'Cecilia, the Harrowing Crusader';
const EQUIP = 'Possessed Blade of Sinister Vengeance';   // Equipment ohne Skript (Knife Throw braucht ein ausgeruestetes Artefakt)
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];
const HN = {
  Broghan: 'Broghan, the Frozen Guardian of the North', Brackle: 'Brackle, the Catapulting Turtle', Arthor: 'Arthor, Inheritor of the Barbarian Sword',
  Heragas: 'Heragas, the Monster Slayer', Kohta: 'Kohta, Master of Super-Killing',
};

// ── Treiber (Muster W32/a-05): `held` = der als Angreifer zählende Held (Index), `ziele`, `los` löst den Effekt aus ──
const TREIBER = {};
for (const k of Object.keys(HN)) {
  TREIBER[k] = {
    held: 0, ziele: k === 'Heragas' ? ['creature'] : ['hero', 'creature'],
    aufbau(t, me) {
      t.setHero(me, 0, HN[k], 800);
      if (k === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
    },
    async los(t, me, op, o) {
      let gewaehlt = false;
      t.targetFn = (v) => {
        if (k === 'Brackle' && v.every(x => x.type === 'equip' && x.owner === me)) return gewaehlt ? null : [v[0].id];
        gewaehlt = true; return [waehleOpfer(v, op, o)];
      };
      return t.activateHero(me, 0, k === 'Kohta' ? { phase: 3 } : {});
    },
  };
}
function waehleOpfer(v, op, o) {
  if (o.ziel === 'creature') return (v.find(x => x.type === 'equip' && x.owner === op) || v[0]).id;
  const w = posHero(v, op, 0), w1 = posHero(v, op, 1); return (w && !w.ineligible ? w : (w1 || v[0])).id;
}
TREIBER['Javelin Throw'] = { held: 0, ziele: ['hero', 'creature'], hand: ['Javelin Throw'], aufbau(t, me) { t.put(me, 0, 0, H.INERT.artifact); },
  async los(t, me, op, o) { t.targetFn = (v) => { if (!v.some(x => x.owner === op)) return [(posHero(v, me, 0) || v[0]).id]; return [waehleOpfer(v, op, o)]; }; return t.play(me, 'Javelin Throw', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Sword in a Bottle'] = { held: 1, ziele: ['hero', 'creature'], hand: ['Sword in a Bottle'], aufbau() {},
  async los(t, me, op, o) { t.targetFn = (v) => [posHero(v, me, 1).id, waehleOpfer(v, op, o)]; return t.play(me, 'Sword in a Bottle', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Bamboo Staff'] = { held: 0, ziele: ['hero', 'creature'], discard: ['ZZ Filler'], aufbau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); },
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W34a' })); return true; } };
TREIBER['Sacrificial Dagger'] = { held: 0, ziele: ['hero', 'creature'], aufbau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.opfer = t.put(me, 1, 0, H.INERT.creature); },
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.opfereKreatur(t.opfer, { name: 'Test', owner: me })); return true; } };
TREIBER['Infected Greatmaw'] = { held: null, ziele: ['hero', 'creature'], aufbau(t, me) {
    const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; },
  async los(t, me, op, o) {
    t.targetFn = (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [(posHero(v, me, 0) || v[0]).id];
      return [waehleOpfer(v, op, o)];
    };
    t.phase(2); return t.activateCreature(me, 1, 0);
  } };
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  TREIBER[k] = { held: 0, ziele: ['hero', 'creature'], heldName: CECILIA, aufbau(t, me) { t.put(me, 0, 0, k); },
    async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; return t.activateEquip(me, 0, 0); } };
}
const NAMEN = Object.keys(TREIBER);

/** Szene: `me` löst den Treiber aus. `o.hand` ergänzt die Hand von `me`; `o.vorbereiten(t, me, op)` vor dem Lauf; `o.nicht` = den Treiber nicht auslösen. */
async function szene(name, me, op, o = {}) {
  const sp = TREIBER[name];
  const meHand = [...(sp.hand || []), ...(o.hand || [])];
  const t = await H.fresh({ hand: me === 0 ? [meHand, []] : [[], meHand], discard: me === 0 ? [sp.discard || [], []] : [[], sp.discard || []], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  if (sp.heldName) t.setHero(me, 0, sp.heldName, 800);
  sp.aufbau(t, me, op);
  t.setAbilities(me, name === 'Sword in a Bottle' ? 1 : 0, fight(1));
  if (o.ziel === 'creature') { const c = t.put(op, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 400; t.opferKreatur = c; }
  if (o.vorbereiten) await o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const ziel = o.ziel || 'hero';
  const hp0 = t.hp(op, 0), hp1 = t.hp(op, 1), kHp0 = t.opferKreatur ? (t.opferKreatur.counters.currentHp ?? 0) : null;
  const erg = o.nicht ? null : await sp.los(t, me, op, { ziel, keep: o.keep });
  const schaden = (hp0 - t.hp(op, 0)) + (hp1 - t.hp(op, 1)) + (kHp0 != null ? kHp0 - (t.engine.cardInstances.includes(t.opferKreatur) ? (t.opferKreatur.counters.currentHp ?? 0) : 0) : 0);
  return { t, erg, schaden };
}
const ps = (t, s) => t.gs.players[s];
const zZiel = (name) => TREIBER[name].ziele.includes('hero') ? 'hero' : 'creature';
const gesperrtBerserk = (t, s) => { for (let hi = 0; hi < 3; hi++) { t.heroStatus(s, hi, 'berserked'); t.hero(s, hi)._attacksThisTurn = 2; } };

(async () => {
  const R = H.runner();

  // ── A · jeder Effekt zählt GENAU EINMAL ──
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of NAMEN) {
      R.section(`Sitz ${me}: ${name} · Zähler`);
      const r = await szene(name, me, op, { ziel: zZiel(name) });
      const p = ps(r.t, me);
      R.check('der Effekt hat getroffen', r.schaden > 0, r.schaden);
      R.check('attacksPlayedThisTurn == 1 (EIN Zählschritt je Treffer-Ereignis, kein Doppelzählen mit der Attack-Kette)', (p.attacksPlayedThisTurn || 0) === 1, p.attacksPlayedThisTurn);
      R.check('spellsPlayedThisTurn == 0 (kein Spell)', (p.spellsPlayedThisTurn || 0) === 0, p.spellsPlayedThisTurn);
      const held = TREIBER[name].held;
      if (held != null) R.check(`der Angreifer-Held ${held} steht in heroesAttackedThisTurn, sein Zähler _attacksThisTurn == 1`, (p.heroesAttackedThisTurn || []).includes(held) && (r.t.hero(me, held)._attacksThisTurn || 0) === 1, { l: p.heroesAttackedThisTurn, n: r.t.hero(me, held)._attacksThisTurn });
      else R.check('ein Held steht in heroesAttackedThisTurn (der gewählte)', (p.heroesAttackedThisTurn || []).length === 1, p.heroesAttackedThisTurn);
      R.check('der Gegner hat nichts gezählt', (ps(r.t, op).attacksPlayedThisTurn || 0) === 0, null);
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
    }
  }
  // Gegenproben: gewöhnliche Heldeneffekte zählen nicht; eine echte Attack-Karte zählt genau einmal
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Gegenproben (Siphem/Locke zählen nicht, Quick Attack zählt einmal)`);
    for (const n of ['Siphem, the Deepsea Demon', 'Locke, the Unseen Saboteur']) {
      const t = await H.fresh({ hand: [[], []], deckSize: 30, hp: 800, active: me });
      t.setHero(me, 0, n, 800); if (/Siphem/.test(n)) t.hero(me, 0).deepseaCounters = 2;
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      await t.activateHero(me, 0, {});
      R.check(`${n}: Attack-Zähler bleibt 0`, (ps(t, me).attacksPlayedThisTurn || 0) === 0 && (t.hero(me, 0)._attacksThisTurn || 0) === 0 && (ps(t, me).spellsPlayedThisTurn || 0) === 0, { a: ps(t, me).attacksPlayedThisTurn, s: ps(t, me).spellsPlayedThisTurn });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    const t = await H.fresh({ hand: me === 0 ? [['Quick Attack'], []] : [[], ['Quick Attack']], deckSize: 30, hp: 800, active: me });
    t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
    await t.play(me, 'Quick Attack', { hero: 0 });
    R.check('Quick Attack (echte Karte): attacksPlayedThisTurn == 1, _attacksThisTurn == 1', (ps(t, me).attacksPlayedThisTurn || 0) === 1 && (t.hero(me, 0)._attacksThisTurn || 0) === 1, { a: ps(t, me).attacksPlayedThisTurn, h: t.hero(me, 0)._attacksThisTurn });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── B · Rioting Village: „no player can use more than 1 Attack per turn" ──
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of NAMEN) {
      const ziel = zZiel(name);
      R.section(`Sitz ${me}: ${name} × Rioting Village`);
      // (1) Treiber zuerst, danach Quick Attack
      for (const village of [true, false]) {
        const r = await szene(name, me, op, { ziel, hand: ['Quick Attack'], vorbereiten: (t) => { if (village) t.putArea(op, 'Rioting Village'); t.grantFor(me, 2, 'Quick Attack'); } });
        const nach = r.t.hp(op, 0) + r.t.hp(op, 1);
        r.t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
        const q = await r.t.play(me, 'Quick Attack', { hero: 2 });
        const hpNach = r.t.hp(op, 0) + r.t.hp(op, 1);
        R.check(`${village ? 'unter Rioting Village' : 'ohne Rioting Village (Gegenprobe)'}: der Effekt hat getroffen`, r.schaden > 0, r.schaden);
        R.check(`${village ? 'danach ist die nächste Attack-Karte (Quick Attack) GESPERRT' : 'danach ist Quick Attack spielbar'}`, village ? (q === false && hpNach === nach) : (q === true && hpNach < nach), { q, nach, hpNach });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
      }
      // (2) Quick Attack zuerst, danach der Treiber
      for (const village of [true, false]) {
        const r = await szene(name, me, op, { ziel, hand: ['Quick Attack'], nicht: true, vorbereiten: async (t) => {
          if (village) t.putArea(op, 'Rioting Village'); t.grantFor(me, 2, 'Quick Attack');
          t.targetFn = (v) => [(posHero(v, op, 2) || v[0]).id];
          await t.play(me, 'Quick Attack', { hero: 2 });
        } });
        const vor = r.t.hp(op, 0) + r.t.hp(op, 1) + (r.t.opferKreatur ? (r.t.opferKreatur.counters.currentHp ?? 0) : 0);
        await TREIBER[name].los(r.t, me, op, { ziel });
        const nach = r.t.hp(op, 0) + r.t.hp(op, 1) + (r.t.opferKreatur && r.t.engine.cardInstances.includes(r.t.opferKreatur) ? (r.t.opferKreatur.counters.currentHp ?? 0) : 0);
        R.check(`${village ? 'unter Rioting Village: nach einer gespielten Attack ist der als Attack zählende Effekt GEBLOCKT (kein Schaden)' : 'ohne Rioting Village (Gegenprobe): nach einer gespielten Attack trifft der Effekt'}`, village ? nach === vor : nach < vor, { vor, nach });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
      }
    }
  }

  // ── C · Berserk: „The Hero can never perform more than 2 Attacks per turn" ──
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of NAMEN) {
      const ziel = zZiel(name);
      R.section(`Sitz ${me}: ${name} × Berserk`);
      const voll = await szene(name, me, op, { ziel, keep: true, vorbereiten: (t) => gesperrtBerserk(t, me) });
      R.check('Berserker mit 2 Attacks in diesem Zug: der Effekt ist GEBLOCKT (kein Schaden, nichts gezählt)', voll.schaden === 0 && (ps(voll.t, me).attacksPlayedThisTurn || 0) === 0, { s: voll.schaden, a: ps(voll.t, me).attacksPlayedThisTurn });
      R.check('sauber', sauber(voll.t), { e: voll.t.errors, a: voll.t.audit() });
      const eins = await szene(name, me, op, { ziel, keep: true, vorbereiten: (t) => { gesperrtBerserk(t, me); for (let hi = 0; hi < 3; hi++) t.hero(me, hi)._attacksThisTurn = 1; } });
      R.check('Berserker mit 1 Attack: der Effekt trifft, der Zähler steigt auf 2', eins.schaden > 0 && TREIBER[name].held != null ? (eins.t.hero(me, TREIBER[name].held)._attacksThisTurn === 2) : eins.schaden > 0, { s: eins.schaden });
      R.check('sauber', sauber(eins.t), { e: eins.t.errors, a: eins.t.audit() });
    }
  }

  // ── D · Knife Throw: „This must be the only Attack you play this turn" (Sitz wechselt je Treiber) ──
  { const KT = H.loadCardEffect('Knife Throw');
    let i = 0;
    for (const name of NAMEN) {
      const me = i++ % 2, op = 1 - me;
      const ziel = zZiel(name);
      R.section(`Sitz ${me}: ${name} × Knife Throw`);
      // nach Knife Throw (Stempel) ist der Effekt geblockt
      const a = await szene(name, me, op, { ziel, vorbereiten: (t) => { ps(t, me)._soleAttackTurn = t.gs.turn; } });
      R.check('nach Knife Throw („only Attack"): der als Attack zählende Effekt ist GEBLOCKT', a.schaden === 0, a.schaden);
      // nach dem Effekt ist Knife Throw nicht mehr spielbar (der Effekt zählt als Attack)
      const b = await szene(name, me, op, { ziel, hand: ['Knife Throw'], vorbereiten: (t) => { t.put(me, 2, 1, EQUIP); } });
      const cd = H.DB['Knife Throw'];
      R.check('nach dem als Attack zählenden Effekt ist Knife Throw NICHT mehr spielbar (Held 2 mit Ausrüstung)', b.schaden > 0 && KT.canPlayWithHero(b.t.gs, me, 2, cd, b.t.engine) === false, { s: b.schaden });
      const c = await szene(name, me, op, { ziel, hand: ['Knife Throw'], nicht: true, vorbereiten: (t) => { t.put(me, 2, 1, EQUIP); } });
      R.check('Gegenprobe: ohne vorherigen Attack ist Knife Throw spielbar', KT.canPlayWithHero(c.t.gs, me, 2, cd, c.t.engine) === true, null);
      R.check('sauber', sauber(b.t) && sauber(a.t) && sauber(c.t), { e: [...a.t.errors, ...b.t.errors, ...c.t.errors], a: [...a.t.audit(), ...b.t.audit(), ...c.t.audit()] });
    }
  }

  // ── E · Quick Attack: „If this is the first Attack you use this turn, this counts as an additional Action" ──
  { const QA = H.loadCardEffect('Quick Attack');
    let i = 0;
    for (const name of NAMEN) {
      const me = i++ % 2, op = 1 - me;
      R.section(`Sitz ${me}: ${name} × Quick Attack („first Attack")`);
      const r = await szene(name, me, op, { ziel: zZiel(name) });
      R.check('nach dem Effekt ist Quick Attack NICHT mehr die erste Attack (keine Zusatzaktion)', QA.inherentAction(r.t.gs, me, 2, r.t.engine) === false, null);
      const g = await szene(name, me, op, { ziel: zZiel(name), nicht: true });
      R.check('Gegenprobe: ohne Effekt ist Quick Attack die erste Attack (Zusatzaktion)', QA.inherentAction(g.t.gs, me, 2, g.t.engine) === true, null);
    }
  }

  // ── F · Muscle Training / Idej Sword - Muras / Blow of the Venom Snake lesen dieselben Zähler ──
  { const [me, op] = [0, 1];
    R.section('Zähler-Leser: Blow of the Venom Snake („second Attack") nach einem als Attack zählenden Effekt');
    const r = await szene('Broghan', me, op, { hand: ['Blow of the Venom Snake'], vorbereiten: (t) => { t.grantFor(me, 2, 'Blow of the Venom Snake'); } });
    r.t.targetFn = (v) => [(posHero(v, op, 1) || v[0]).id];
    await r.t.play(me, 'Blow of the Venom Snake', { hero: 2 });
    const st = r.t.hero(op, 1).statuses && r.t.hero(op, 1).statuses.poisoned;
    R.check('Blow of the Venom Snake ist die ZWEITE Attack (Broghan zählte): 2 Stacks Gift', !!st && (st.stacks ?? st.count ?? st) >= 2, st);
    R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
  }
  R.finish();
})();
