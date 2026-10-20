'use strict';
// W27a · Entscheidung Al (21.10.2026, Punkt 3): „Und die [als Attack geltenden Gegenstandseffekte] gelten auch als Lv 0." — Crusader's Arm-Cannon/Cutlass/Flintlock/Hookshot,
// Bamboo Staff, Javelin Throw, Sacrificial Dagger, Sword in a Bottle („treated as an Attack") zählen wie die Heldeneffekte (Broghan & Co.) ÜBERALL als LEVEL 0, wo eine Karte die
// Stufe der Quelle liest: Glass Wall („level 1 or lower"), Test Flight („level lower than the Hero's Magic Arts level"), Future Tech Escape Device („level equal to or lower than
// the number of … in your discard pile"), Stealth („level 1 or lower Attacks/Spells") und Future Tech Jetpack („Attacks whose levels are lower than or equal to …").
// Je Gegenstand und Sitz: Kontrolle ohne Schutz (Treffer), dann jeder Leser (Gegner-Held 0 trägt Glass Wall / hat Test Flight bzw. Escape Device auf der Hand / Stealth Lv1 / Jetpack):
// der Effekt wird abgewehrt (Schaden 0). Gegenprobe: eine echte Attack-Karte behält ihre gedruckte Stufe (Glass Wall reagiert nicht auf Lv-2-Attacken).
// Nicht abgedeckt, weil der Engine-Weg das Fenster nicht öffnet: Sword in a Bottle löst die Hand-Reaktionen vor dem Treffer (Test Flight, Escape Device) nicht aus (Trank-Zielweg,
// unabhängig von der Stufe) — dort nur Glass Wall, Stealth, Jetpack.
// ★ W30a (Al, 21.10.2026): Bamboo Staff und Sacrificial Dagger (treated as that Hero hitting …) zählen seitdem mit dem FIGHTING-LEVEL ihres Trägers (`W30/a-01`); dieser Repro läuft mit Trägern OHNE
// Fighting (Fighting 0 = Level 0) und prüft für die beiden weiter die Untergrenze 0. Javelin Throw, Sword in a Bottle, Crusader's ×4 bleiben Level 0 (Text nennt keinen Angreifer-Helden).
// Aufruf: node docs/niche-tests/repro/W27/a-03-gegenstandseffekte-als-attack-zaehlen-als-level-0.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack', CECILIA = 'Cecilia, the Harrowing Crusader';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);

// Treiber je Gegenstand: bauen den Aufbau (nach H.fresh) und lösen den Effekt aus. `rec` sammelt, ob Gegner-Held 0 angeboten wurde.
const ITEMS = {
  'Sword in a Bottle': {
    hand: (me) => ['Sword in a Bottle'], reaktionen: false,
    async lauf(t, me, op, rec) {
      t.targetFn = (v) => {
        const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
        const own = posHero(v, me, 1), opp = rec.angeboten ? h0 : posHero(v, op, 1);
        return [own.id, opp.id];
      };
      await t.play(me, 'Sword in a Bottle', { hero: 0 });
    },
  },
  'Javelin Throw': {
    hand: () => ['Javelin Throw'], reaktionen: true,
    async lauf(t, me, op, rec) {
      t.put(me, 0, 0, H.INERT.artifact);
      t.targetFn = (v) => {
        if (!v.some(x => x.owner === op)) { const own = posHero(v, me, 0); return own ? [own.id] : [v[0].id]; }
        const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
        return [(rec.angeboten ? h0 : posHero(v, op, 1)).id];
      };
      await t.play(me, 'Javelin Throw', { hero: 0 });
    },
  },
  'Bamboo Staff': {
    discard: () => ['ZZ Filler'], reaktionen: true,
    async lauf(t, me, op, rec) {
      t.put(me, 0, 0, 'Bamboo Staff');
      t.targetFn = (v) => {
        const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
        return [(rec.angeboten ? h0 : posHero(v, op, 1)).id];
      };
      await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W27a' }));
    },
  },
  'Sacrificial Dagger': {
    reaktionen: true,
    async lauf(t, me, op, rec) {
      t.put(me, 0, 0, 'Sacrificial Dagger');
      const c = t.put(me, 1, 0, H.INERT.creature);
      t.targetFn = (v) => {
        const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
        return [(rec.angeboten ? h0 : posHero(v, op, 1)).id];
      };
      await t.run(() => t.engine.opfereKreatur(c, { name: 'Test', owner: me }));
    },
  },
};
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  ITEMS[k] = {
    reaktionen: true, held: CECILIA,
    async lauf(t, me, op, rec) {
      t.put(me, 0, 0, k);
      t.targetFn = (v) => {
        const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
        return [(rec.angeboten ? h0 : posHero(v, op, 1)).id];
      };
      await t.activateEquip(me, 0, 0);
    },
  };
}

async function szene(item, me, op, leser) {
  const spec = ITEMS[item];
  const opHand = leser === 'Test Flight' ? ['Test Flight'] : leser === 'Escape Device' ? ['Future Tech Escape Device'] : [];
  const hands = me === 0 ? [spec.hand ? spec.hand(me) : [], opHand] : [opHand, spec.hand ? spec.hand(me) : []];
  const t = await H.fresh({ hand: hands, discard: me === 0 ? [spec.discard ? spec.discard() : [], []] : [[], spec.discard ? spec.discard() : []], deckSize: 30, hp: 800 });
  if (spec.held) t.setHero(me, 0, spec.held, 800);
  if (leser === 'Stealth') t.setAbilities(op, 0, [['Stealth'], [], []]);
  if (leser === 'Jetpack') t.put(op, 0, 0, JET);
  if (leser === 'Glass Wall') { t.putSurprise(op, 0, 'Glass Wall'); t.grantFor(op, 0, 'Glass Wall'); }
  if (leser === 'Test Flight') t.grantFor(op, 0, 'Test Flight');
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = {};
  const hp0 = t.hp(op, 0);
  // Quellobjekte der Attack-Treffer mitschneiden (Held-benannte Quellen müssen den Level-0-Stempel tragen)
  const orig = t.engine.actionDealDamage.bind(t.engine);
  rec.quellen = [];
  t.engine.actionDealDamage = (source, target, amount, type, o) => { if (type === 'attack') rec.quellen.push(source); return orig(source, target, amount, type, o); };
  await spec.lauf(t, me, op, rec);
  return { t, rec, schaden: hp0 - t.hp(op, 0) };
}

(async () => {
  const R = H.runner();
  for (const item of Object.keys(ITEMS)) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      R.section(`${item}: Sitz ${me} gegen Sitz ${op}`);
      const k = await szene(item, me, op, 'keiner');
      R.check('Kontrolle (ohne Schutz): Zielwahl lief, Gegner-Held 0 wurde getroffen', k.rec.gefragt && k.rec.angeboten && k.schaden > 0, { rec: k.rec, schaden: k.schaden });
      R.check('Kontrolle: jeder Attack-Treffer trägt eine Level-0-Quelle (Kartenname mit Deklaration oder Stempel am Quellobjekt)',
        k.rec.quellen.length >= 1 && k.rec.quellen.every(q => k.t.engine._heldenEffektStufe(q.name, 'attack', q) === 0), k.rec.quellen.map(q => q.name));
      R.check('Kontrolle: sauber', k.t.errors.length === 0 && k.t.audit().length === 0, { e: k.t.errors, a: k.t.audit() });
      for (const leser of ['Stealth', 'Jetpack', 'Glass Wall', 'Test Flight', 'Escape Device']) {
        if ((leser === 'Test Flight' || leser === 'Escape Device') && ITEMS[item].reaktionen === false) continue;
        const r = await szene(item, me, op, leser);
        if (leser === 'Stealth' || leser === 'Jetpack') {
          R.check(`${leser}: Gegner-Held 0 wird nicht angeboten bzw. nicht getroffen (Quelle Level 0)`, r.schaden === 0 && r.rec.gefragt && !r.rec.angeboten, { rec: r.rec, schaden: r.schaden });
        } else {
          const name = leser === 'Escape Device' ? 'Future Tech Escape Device' : leser;
          R.check(`${leser}: wird angeboten (Quelle Level 0) und wehrt den Effekt ab`, gefragt(r.t, name) >= 1 && r.schaden === 0, { gefragt: gefragt(r.t, name), schaden: r.schaden, rec: r.rec });
        }
        R.check(`${leser}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
      }
    }
  }
  // Gegenprobe: gewöhnliche Karten behalten ihre gedruckte Stufe
  {
    R.section('Gegenprobe: echte Attack-Karten behalten ihre gedruckte Stufe (Glass Wall: nur Level 1 oder niedriger)');
    for (const [karte, soll] of [['Attack', true], ['Quick Attack', true], ['Knife Throw', false]]) {
      const lv = H.DB[karte]?.level;
      const t = await H.fresh({ hand: [[karte], []], deckSize: 30 });
      t.putSurprise(1, 0, 'Glass Wall'); t.grantFor(1, 0, 'Glass Wall');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => { const h = posHero(v, 1, 0); return [h.id]; };
      await t.play(0, karte, { hero: 0 });
      R.check(`${karte} (Level ${lv}): Glass Wall ${soll ? 'öffnet sich' : 'bleibt verdeckt'}`, (gefragt(t, 'Glass Wall') >= 1) === soll, gefragt(t, 'Glass Wall'));
    }
  }
  // Treffer-Pfad „or HIT" (Jetpack): Held-benannte Quelle mit Stempel prallt ab, ohne Stempel trifft sie
  {
    R.section('Jetpack „or hit": Quelle, die den Helden nennt (Bamboo Staff / Sacrificial Dagger)');
    for (const [stempel, soll] of [[true, 0], [false, 100]]) {
      const t = await H.fresh({ hand: [[], []], deckSize: 30 });
      t.put(1, 0, 0, JET);
      const q = { name: t.hero(0, 0).name, owner: 0, heroOwner: 0, heroIdx: 0 };
      if (stempel) q.treatedAsAttack = { level: 0 };
      const hp0 = t.hp(1, 0);
      await t.run(() => t.engine.actionDealDamage(q, t.hero(1, 0), 100, 'attack'));
      R.check(`Quelle ${stempel ? 'mit' : 'ohne'} Level-0-Stempel: Jetpack-Träger nimmt ${soll} Schaden`, hp0 - t.hp(1, 0) === soll, hp0 - t.hp(1, 0));
    }
  }
  // Helfer direkt
  {
    const t = await H.fresh({});
    const e = t.engine;
    for (const [n, dt, soll] of [['Sword in a Bottle', 'attack', 0], ['Javelin Throw', 'attack', 0], ['Bamboo Staff', 'attack', 0], ['Sacrificial Dagger', 'attack', 0],
      ["Crusader's Arm-Cannon", 'attack', 0], ["Crusader's Cutlass", 'attack', 0], ["Crusader's Flintlock", 'attack', 0], ["Crusader's Hookshot", 'attack', 0],
      ['Sword in a Bottle', 'hero', null], ['Sword in a Bottle', 'spell', null], ['Future Tech Fists', 'attack', null], ['Infected Greatmaw', 'attack', null],
      ['Fireball', 'attack', null], ['Quick Attack', 'attack', null], ['Heavy Hit', 'attack', null]]) {
      R.check(`_heldenEffektStufe(${n}, ${dt}) = ${soll}`, e._heldenEffektStufe(n, dt) === soll, e._heldenEffektStufe(n, dt));
    }
    R.check('Stempel am Quellobjekt (Held-benannte Quelle) zählt als Level 0', e._heldenEffektStufe('Beliebiger Held', 'attack', { name: 'X', treatedAsAttack: { level: 0 } }) === 0, null);
    R.check('ohne Stempel keine Stufe', e._heldenEffektStufe('Beliebiger Held', 'attack', { name: 'X' }) === null, null);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
