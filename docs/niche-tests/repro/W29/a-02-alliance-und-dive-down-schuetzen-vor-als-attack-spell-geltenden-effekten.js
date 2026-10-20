'use strict';
// W29a · Entscheidung Al (21.10.2026, Punkt 2): „Alliance und Dive Down schützen ausdrücklich auch vor Effekten, die als Attacks/Spells *zählen*, ja."
// Alliance („That Hero and the user cannot choose each other as targets of Attacks and Spells, except Support Magic Spells, while there are other possible targets …") und
// Dive Down („the user cannot be chosen or hit by your opponent's Attacks, Spells or Creature effects while you control other targets that can be chosen or hit") lesen jetzt den
// Quellentyp wie Flooding (W26a): Heldeneffekte, die als Attack/Spell gelten (Broghan, Brackle, Arthor, Kohta; Alice als Spell), Gegenstandseffekte, die als Attack gelten
// (Crusader's ×4, Bamboo Staff, Javelin Throw, Sword in a Bottle, Sacrificial Dagger) und der Treffer von Infected Greatmaw („treated as that Hero hitting the target with an Attack").
// Heragas wählt nur Kreaturen (kein Heldenziel) – von beiden Karten nicht berührt.
// Je Quelle und Sitz: Kontrolle ohne Schutz (Gegner-Held 0 wird angeboten und getroffen), Alliance A (Alliance-Träger = Wirker-Held 0, Verbündeter = Gegner-Held 0), Alliance B
// (Träger = Gegner-Held 0, Verbündeter = Wirker-Held 0) und Dive Down (Gegner-Held 0 getaucht): Gegner-Held 0 wird nicht angeboten, die Quelle trifft den anderen Helden (anderes Ziel
// vorhanden). Gegenproben: Siphem (gewöhnlicher Heldeneffekt, weder Attack noch Spell) wird NICHT erfasst; eine echte Attack-Karte wird erfasst; ohne anderes Ziel fällt der Schutz weg.
// Aufruf: node docs/niche-tests/repro/W29/a-02-alliance-und-dive-down-schuetzen-vor-als-attack-spell-geltenden-effekten.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const HELDEN = {
  'Alice': 'Alice, the Puppeteer Girl', 'Broghan': 'Broghan, the Frozen Guardian of the North', 'Brackle': 'Brackle, the Catapulting Turtle',
  'Arthor': 'Arthor, Inheritor of the Barbarian Sword', 'Kohta': 'Kohta, Master of Super-Killing', 'Siphem': 'Siphem, the Deepsea Demon',
};
const CECILIA = 'Cecilia, the Harrowing Crusader';

// Zielwahl: Gegner-Held 0 wählen, wenn angeboten (nicht ausgegraut), sonst Gegner-Held 1; Opfer-/Eigenwahlen beantwortet `eigen`.
function waehle(rec, op, eigen) {
  return (v, cfg) => {
    if (eigen) { const e = eigen(v, cfg); if (e) return e; }
    const h0 = posHero(v, op, 0), h1 = posHero(v, op, 1);
    if (!h0 && !h1) return undefined;
    rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
    const w = rec.angeboten ? h0 : (h1 && !h1.ineligible ? h1 : (h0 || h1));
    return [w.id];
  };
}

// Treiber je Quelle: `bau(t, me, op)` stellt den Wirker auf, `lauf(t, me, op, rec)` löst den Effekt aus.
const QUELLEN = {};
for (const held of ['Alice', 'Broghan', 'Brackle', 'Arthor', 'Kohta', 'Siphem']) {
  QUELLEN[held] = {
    erfasst: held !== 'Siphem',
    bau(t, me) {
      t.setHero(me, 0, HELDEN[held], 800);
      if (held === 'Alice') { for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; } }
      if (held === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
      if (held === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
    },
    async lauf(t, me, op, rec) {
      t.targetFn = waehle(rec, op, held === 'Brackle' ? (v) => (v.every(x => x.type === 'equip') ? [v[0].id] : null) : null);
      return t.activateHero(me, 0, held === 'Kohta' ? { phase: 3 } : {});
    },
  };
}
QUELLEN['Infected Greatmaw'] = {
  erfasst: true,
  bau(t, me) {
    t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100;
    const g = t.put(me, 0, 0, 'Infected Greatmaw'); g.turnPlayed = 1;
    const x = t.put(me, 1, 0, H.INERT.frail); x.turnPlayed = 1;
  },
  async lauf(t, me, op, rec) {
    t.targetFn = waehle(rec, op, (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [(posHero(v, me, 0) || v[0]).id];   // Angreifer-Held 0 wählen
      return null;
    });
    t.phase(2);
    return t.activateCreature(me, 0, 0);
  },
};
QUELLEN['Sword in a Bottle'] = {
  // Angreifer und Opfer werden in EINEM Fenster gewählt: Alliance ist hier eine PAARregel (Angreifer-Held ↔ Opfer), Dive Down und Zielschutz hängen nur am Opfer.
  erfasst: true, paarweise: true, hand: () => ['Sword in a Bottle'],
  bau() {},
  async lauf(t, me, op, rec) {
    rec.versuche = 0;
    t.targetFn = (v) => {
      const h0 = posHero(v, op, 0); rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible; rec.versuche++;
      const own = posHero(v, me, rec.versuche === 1 ? 0 : 1) || posHero(v, me, 0), opp = rec.angeboten ? h0 : posHero(v, op, 1);   // 1. Versuch: Held 0 (Alliance-Nutzer/-Verbündeter)
      if (rec.versuche > 3) return null;
      return [own.id, opp.id];
    };
    const r = await t.play(me, 'Sword in a Bottle', { hero: 0 });
    // Lehnt der Server die Wahl ab, bleibt die Abfrage offen (wie beim Menschen): erneut antworten (2. Versuch: anderer Angreifer)
    for (let i = 0; i < 2 && t.gs.potionTargeting; i++) await t.resolveTargeting(me);
    return r;
  },
};
QUELLEN['Javelin Throw'] = {
  erfasst: true, hand: () => ['Javelin Throw'],
  bau(t, me) { t.put(me, 0, 0, H.INERT.artifact); },
  async lauf(t, me, op, rec) {
    t.targetFn = waehle(rec, op, (v) => (!v.some(x => x.owner === op) ? [(posHero(v, me, 0) || v[0]).id] : null));
    return t.play(me, 'Javelin Throw', { hero: 0 });
  },
};
QUELLEN['Bamboo Staff'] = {
  erfasst: true, discard: () => ['ZZ Filler'],
  bau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); },
  async lauf(t, me, op, rec) {
    t.targetFn = waehle(rec, op, null);
    return t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W29a' }));
  },
};
QUELLEN['Sacrificial Dagger'] = {
  erfasst: true,
  bau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.dummy = t.put(me, 1, 0, H.INERT.creature); },
  async lauf(t, me, op, rec) {
    t.targetFn = waehle(rec, op, null);
    return t.run(() => t.engine.opfereKreatur(t.dummy, { name: 'Test', owner: me }));
  },
};
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  QUELLEN[k] = {
    erfasst: true, held: CECILIA,
    bau(t, me) { t.put(me, 0, 0, k); },
    async lauf(t, me, op, rec) { t.targetFn = waehle(rec, op, null); return t.activateEquip(me, 0, 0); },
  };
}
QUELLEN['Attack (echte Karte)'] = {
  erfasst: true, hand: () => ['Attack'],
  bau() {},
  async lauf(t, me, op, rec) { t.targetFn = waehle(rec, op, null); return t.play(me, 'Attack', { hero: 0 }); },
};

async function szene(name, me, op, schutz, opts = {}) {
  const spec = QUELLEN[name];
  const hands = me === 0 ? [spec.hand ? spec.hand() : [], []] : [[], spec.hand ? spec.hand() : []];
  const disc = me === 0 ? [spec.discard ? spec.discard() : [], []] : [[], spec.discard ? spec.discard() : []];
  const t = await H.fresh({ hand: hands, discard: disc, deckSize: 30, hp: 800, active: me });
  if (spec.held) t.setHero(me, 0, spec.held, 800);
  spec.bau(t, me, op);
  if (opts.einzelzielGegner) for (const sitz of [me, op]) for (const hi of [1, 2]) t.hero(sitz, hi).hp = 0;   // nur Wirker-Held 0 und Gegner-Held 0 leben → kein anderes Ziel
  const g = t.gs;
  if (schutz === 'Alliance A') t.put(me, 0, 2, 'Alliance', { counters: { allyOwner: op, allyHeroIdx: 0 } });
  if (schutz === 'Alliance B') t.put(op, 0, 2, 'Alliance', { counters: { allyOwner: me, allyHeroIdx: 0 } });
  if (schutz === 'Dive Down') t.engine.addHeroTargetBlocker(op, 0, 'Dive Down', { untilTurn: g.turn });
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = {};
  const hp0 = t.hp(op, 0), hp1 = t.hp(op, 1);
  await spec.lauf(t, me, op, rec);
  return { t, rec, s0: hp0 - t.hp(op, 0), s1: hp1 - t.hp(op, 1) };
}

(async () => {
  const R = H.runner();
  for (const name of Object.keys(QUELLEN)) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      R.section(`${name}: Sitz ${me} gegen Sitz ${op}`);
      const spec = QUELLEN[name];
      const k = await szene(name, me, op, 'keiner');
      R.check('Kontrolle (kein Schutz): Gegner-Held 0 wird angeboten und getroffen', k.rec.gefragt && k.rec.angeboten && k.s0 > 0, { rec: k.rec, s0: k.s0 });
      R.check('Kontrolle: sauber', k.t.errors.length === 0 && k.t.audit().length === 0, { e: k.t.errors, a: k.t.audit() });
      for (const schutz of ['Alliance A', 'Alliance B', 'Dive Down']) {
        const r = await szene(name, me, op, schutz);
        if (spec.paarweise && schutz !== 'Dive Down') {
          R.check(`${schutz}: das gesperrte Paar (Held 0 ↔ Gegner-Held 0) wird abgelehnt, Gegner-Held 0 bleibt für einen anderen Angreifer wählbar und wird dann von Held 1 getroffen`,
            r.rec.angeboten && r.rec.versuche === 2 && r.s0 > 0, { rec: r.rec, s0: r.s0 });
        } else if (spec.erfasst) {
          R.check(`${schutz}: Gegner-Held 0 wird nicht angeboten und nicht getroffen`, r.rec.gefragt && !r.rec.angeboten && r.s0 === 0, { rec: r.rec, s0: r.s0, s1: r.s1 });
        } else {
          R.check(`${schutz}: gewöhnlicher Heldeneffekt (weder Attack noch Spell) wird NICHT erfasst`, r.rec.gefragt && r.rec.angeboten && r.s0 > 0, { rec: r.rec, s0: r.s0 });
        }
        R.check(`${schutz}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
      }
    }
  }
  // Ohne anderes Ziel fällt der Schutz weg („while there are other possible targets")
  for (const name of ['Broghan', 'Infected Greatmaw', 'Bamboo Staff']) {
    for (const schutz of ['Alliance A', 'Dive Down']) {
      const r = await szene(name, 0, 1, schutz, { einzelzielGegner: true });
      R.check(`${name} / ${schutz} ohne anderes Ziel: Gegner-Held 0 bleibt wählbar und wird getroffen`, r.rec.gefragt && r.rec.angeboten && r.s0 > 0, { rec: r.rec, s0: r.s0 });
    }
  }
  // Treffer-Pfad („cannot be chosen or HIT", Dive Down): die Quelle, die den Helden nennt, trägt den Stempel `treatedAsAttack` – ohne Stempel ist sie ein gewöhnlicher Heldeneffekt
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Dive Down im Treffer-Pfad (actionDealDamage)`);
    for (const [stempel, soll] of [[true, 0], [false, 100]]) {
      const t = await H.fresh({ hand: [[], []], deckSize: 30, hp: 800, active: me });
      t.engine.addHeroTargetBlocker(op, 0, 'Dive Down', { untilTurn: t.gs.turn });
      const q = { name: t.hero(me, 0).name, owner: me, heroOwner: me, heroIdx: 0 };
      if (stempel) q.treatedAsAttack = { level: 0 };
      const hp0 = t.hp(op, 0);
      await t.run(() => t.engine.actionDealDamage(q, t.hero(op, 0), 100, 'attack'));
      R.check(`Quelle ${stempel ? 'mit' : 'ohne'} Stempel „zählt als Attack": getauchter Held nimmt ${soll} Schaden`, hp0 - t.hp(op, 0) === soll, hp0 - t.hp(op, 0));
    }
  }
  // Sword in a Bottle mit nur EINEM lebenden eigenen Helden: Alliance-Schranke 3 („If all other Heroes you control cannot be chosen …, ignore this effect") – der Schutz fällt weg
  for (const [me, op] of [[0, 1], [1, 0]]) {
    const spec = QUELLEN['Sword in a Bottle'];
    const t = await H.fresh({ hand: me === 0 ? [spec.hand(), []] : [[], spec.hand()], deckSize: 30, hp: 800, active: me });
    for (const hi of [1, 2]) t.hero(me, hi).hp = 0;
    t.put(me, 0, 2, 'Alliance', { counters: { allyOwner: op, allyHeroIdx: 0 } });
    const rec = {};
    await spec.lauf(t, me, op, rec);
    R.check(`Sword in a Bottle / Alliance, Sitz ${me}: kein anderer eigener Held → Schutz entfällt, Gegner-Held 0 wählbar und getroffen`, rec.angeboten && rec.versuche === 1 && t.hp(op, 0) < 800, { rec, hp0: t.hp(op, 0) });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
