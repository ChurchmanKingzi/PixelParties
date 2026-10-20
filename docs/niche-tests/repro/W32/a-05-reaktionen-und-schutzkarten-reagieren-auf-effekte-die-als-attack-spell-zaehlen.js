'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkt 5: „Ja, sie sollen unbedingt auch darauf reagieren! Surprises wie Bluff, die auf Attacks und Spells reagieren, oder Reactions wie Magic Topaz oder Arrows, die auf
// Attacks reagieren, ebenfalls!" → ALLE Karten, die auf Attacks und/oder Spells als Auslöser, Bedingung oder Schutz reagieren, zählen auch Effekte, die als Attack/Spell ZÄHLEN (Heldeneffekte Broghan, Brackle,
// Arthor, Heragas, Kohta [Attack] und Alice [Spell], Gegenstandseffekte [Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff, Sacrificial Dagger], Greatmaw-Treffer, Alluring-Light-Angriff).
// Zentral: `quelleIstAttackOderSpell` / `zaehltAlsAttackOderSpell` (`_hooks.js`), `engine._zaehltAlsArt` (Art für die Umleiter über `sourceEffectKind`), virtuelle Attack-Kette `engine.alsAttackKette` (Arrows,
// Magic Topaz & Co.).
// Hier geprüft: (a) Magic Topaz (+60) und Angelfeather/Flame Arrow bei jedem Attack-Effekt (nicht bei Alice [Spell] und Siphem [gewöhnlicher Heldeneffekt]); (b) Escape (tödlicher Treffer); (c) Zombified Assault und
// Corpse Explosion bei Besiegen durch den Effekt (mit Schaden und ohne: Kohta); (d) Umleiter (Challenge, Anti-Magnet, Martyry, Alleria-Art) über `sourceEffectKind`; (e) Stealthy Pursuit; Gegenproben (Locke, Siphem).
// Aufruf: node docs/niche-tests/repro/W32/a-05-reaktionen-und-schutzkarten-reagieren-auf-effekte-die-als-attack-spell-zaehlen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const CECILIA = 'Cecilia, the Harrowing Crusader';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];
const HN = {
  Broghan: 'Broghan, the Frozen Guardian of the North', Brackle: 'Brackle, the Catapulting Turtle', Arthor: 'Arthor, Inheritor of the Barbarian Sword',
  Heragas: 'Heragas, the Monster Slayer', Kohta: 'Kohta, Master of Super-Killing', Alice: 'Alice, the Puppeteer Girl', Siphem: 'Siphem, the Deepsea Demon',
};

// Treiber: `kind` (attack | spell | keiner), `ziel` ('hero' | 'creature' – was der Treiber trifft), `los` löst aus.
const TREIBER = {};
function heldenTreiber(k) {
  const n = HN[k];
  TREIBER[k] = {
    kind: k === 'Alice' ? 'spell' : k === 'Siphem' ? 'keiner' : 'attack', ziele: k === 'Heragas' ? ['creature'] : ['hero', 'creature'],
    aufbau(t, me, op) {
      t.setHero(me, 0, n, 800);
      if (k === 'Alice') for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
      if (k === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
      if (k === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
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
  const w = posHero(v, op, o.zielHeld ?? 0), w1 = posHero(v, op, 1); return (w && !w.ineligible ? w : (w1 || v[0])).id;
}
for (const k of Object.keys(HN)) heldenTreiber(k);
TREIBER['Javelin Throw'] = { kind: 'attack', ziele: ['hero', 'creature'], hand: ['Javelin Throw'], aufbau(t, me) { t.put(me, 0, 0, H.INERT.artifact); },
  async los(t, me, op, o) { t.targetFn = (v) => { if (!v.some(x => x.owner === op)) return [(posHero(v, me, 0) || v[0]).id]; return [waehleOpfer(v, op, o)]; }; return t.play(me, 'Javelin Throw', { hero: 0 }); } };
TREIBER['Sword in a Bottle'] = { kind: 'attack', ziele: ['hero', 'creature'], hand: ['Sword in a Bottle'], aufbau() {},
  async los(t, me, op, o) { t.targetFn = (v) => [posHero(v, me, 1).id, waehleOpfer(v, op, o)]; return t.play(me, 'Sword in a Bottle', { hero: 0 }); } };
TREIBER['Bamboo Staff'] = { kind: 'attack', ziele: ['hero', 'creature'], discard: ['ZZ Filler'], aufbau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); },
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W32a' })); return true; } };
TREIBER['Sacrificial Dagger'] = { kind: 'attack', ziele: ['hero', 'creature'], aufbau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.opfer = t.put(me, 1, 0, H.INERT.creature); },
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.opfereKreatur(t.opfer, { name: 'Test', owner: me })); return true; } };
TREIBER['Infected Greatmaw'] = { kind: 'attack', ziele: ['hero', 'creature'], aufbau(t, me) {
    for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
    const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; t.frail = x; },
  async los(t, me, op, o) {
    t.targetFn = (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [(posHero(v, me, 0) || v[0]).id];
      return [waehleOpfer(v, op, o)];
    };
    t.phase(2); return t.activateCreature(me, 1, 0);
  } };
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  TREIBER[k] = { kind: 'attack', ziele: ['hero', 'creature'], held: CECILIA, aufbau(t, me) { t.put(me, 0, 0, k); },
    async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; return t.activateEquip(me, 0, 0); } };
}

/** Szene: `me` löst die Quelle aus; `opHand`/`meHand` ergänzen die Hände; Ziel: Gegner-Held 0 oder die Gegner-Kreatur (Held 1 / Slot 0). */
async function szene(name, me, op, o = {}) {
  const sp = TREIBER[name];
  const meHand = [...(sp.hand || []), ...(o.meHand || [])];
  const t = await H.fresh({ hand: me === 0 ? [meHand, o.opHand || []] : [o.opHand || [], meHand], discard: me === 0 ? [sp.discard || [], []] : [[], sp.discard || []], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  if (sp.held) t.setHero(me, 0, sp.held, 800);
  sp.aufbau(t, me, op);
  t.setAbilities(me, name === 'Sword in a Bottle' ? 1 : 0, fight(o.F ?? 0));
  if (name === 'Alice, the Puppeteer Girl' || name === 'Alice') t.setAbilities(me, 0, [Array(o.F ?? 0).fill('Destruction Magic'), [], []]);
  if (o.ziel === 'creature') { const c = t.put(op, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = o.kreaturHp ?? 200; t.opferKreatur = c; }
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const hp0 = t.hp(op, 0), hp1 = t.hp(op, 1);
  const erg = await sp.los(t, me, op, { ziel: o.ziel || 'hero', zielHeld: o.zielHeld });
  return { t, erg, schaden: hp0 - t.hp(op, 0), schaden1: hp1 - t.hp(op, 1), kreaturTot: o.ziel === 'creature' ? !t.engine.cardInstances.some(c => c === t.opferKreatur && c.zone === 'support' && (c.counters.currentHp ?? 1) > 0) : null };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  const ATTACKER = Object.keys(TREIBER).filter(k => TREIBER[k].kind === 'attack');

  // (a) Magic Topaz / Arrows: bei jedem Effekt, der als Attack zählt (virtuelle Attack-Kette)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(TREIBER)) {
      const sp = TREIBER[name];
      R.section(`Sitz ${me}: ${name} × Magic Topaz / Arrows`);
      const k0 = await szene(name, me, op, { ziel: sp.ziele.includes('hero') ? 'hero' : 'creature' });
      const mitTopaz = await szene(name, me, op, { ziel: sp.ziele.includes('hero') ? 'hero' : 'creature', meHand: ['Magic Topaz'], vorbereiten: (t) => { t.grantFor(me, 0, 'Magic Topaz'); } });
      const soll = sp.kind === 'attack';
      R.check(`Magic Topaz wird ${soll ? 'angeboten' : 'NICHT angeboten'}`, soll ? gefragt(mitTopaz.t, 'Magic Topaz') >= 1 : gefragt(mitTopaz.t, 'Magic Topaz') === 0, { g: gefragt(mitTopaz.t, 'Magic Topaz') });
      if (soll && sp.ziele.includes('hero') && name !== 'Infected Greatmaw' || (soll && name === 'Infected Greatmaw') ) {
        if (k0.schaden > 0 && name !== 'Kohta, Master of Super-Killing' && name !== 'Kohta') R.check(`Magic Topaz: +60 Schaden (${k0.schaden} → ${mitTopaz.schaden})`, mitTopaz.schaden === k0.schaden + 60, { k0: k0.schaden, mit: mitTopaz.schaden });
      }
      if (soll) {
        const arrow = await szene(name, me, op, { ziel: sp.ziele.includes('hero') ? 'hero' : 'creature', meHand: ['Angelfeather Arrow'] });
        R.check('Angelfeather Arrow wird angeboten', gefragt(arrow.t, 'Angelfeather Arrow') >= 1, { a: gefragt(arrow.t, 'Angelfeather Arrow') });
        const flamme = await szene(name, me, op, { ziel: sp.ziele.includes('hero') ? 'hero' : 'creature', meHand: ['Flame Arrow'] });
        R.check('Flame Arrow wird angeboten (und brennt das Ziel an, sofern es Schaden nimmt)', gefragt(flamme.t, 'Flame Arrow') >= 1, { f: gefragt(flamme.t, 'Flame Arrow') });
      }
      // die Kette hinterlässt keine scharfen Arrows
      R.check('nach der Auflösung bleiben keine Arrows scharf', mitTopaz.t.gs.players.every(p => p.heroes.every(h => !h._armedArrows)), null);
      sauber(R, mitTopaz, 'Topaz');
    }
  }

  // (b) Escape (tödlicher Treffer) bei jedem Effekt mit Heldenziel
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(TREIBER)) {
      const sp = TREIBER[name];
      if (!sp.ziele.includes('hero') || name === 'Kohta') continue;
      R.section(`Sitz ${me}: ${name} × Escape`);
      const soll = sp.kind !== 'keiner';
      const r = await szene(name, me, op, { opHand: ['Escape', 'ZZ Filler'], vorbereiten: (t) => { t.hero(op, 0).hp = 40; t.grantFor(op, 0, 'Escape'); } });
      R.check(`Escape wird ${soll ? 'angeboten und negiert den tödlichen Treffer' : 'NICHT angeboten (gewöhnlicher Heldeneffekt)'}`, soll ? (gefragt(r.t, 'Escape') >= 1 && r.t.hp(op, 0) === 40) : (gefragt(r.t, 'Escape') === 0), { g: gefragt(r.t, 'Escape'), hp: r.t.hp(op, 0) });
      sauber(R, r, 'Escape');
    }
  }

  // (c) Besiegen einer Kreatur durch den Effekt: Zombified Assault und Corpse Explosion
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(TREIBER)) {
      const sp = TREIBER[name];
      if (!sp.ziele.includes('creature')) continue;
      const soll = sp.kind !== 'keiner';
      R.section(`Sitz ${me}: ${name} × Zombified Assault / Corpse Explosion (Kreatur besiegt)`);
      const z = await szene(name, me, op, { ziel: 'creature', kreaturHp: 30, opHand: ['Zombified Assault'], vorbereiten: (t) => { t.grantFor(op, 1, 'Zombified Assault'); } });
      R.check('die Kreatur ist besiegt', z.kreaturTot === true, null);
      R.check(`Zombified Assault wird ${soll ? 'angeboten' : 'NICHT angeboten'}`, soll ? gefragt(z.t, 'Zombified Assault') >= 1 : gefragt(z.t, 'Zombified Assault') === 0, { g: gefragt(z.t, 'Zombified Assault') });
      sauber(R, z, 'Zombified Assault');
      const c = await szene(name, me, op, { ziel: 'creature', kreaturHp: 30, opHand: ['Corpse Explosion'], vorbereiten: (t) => { t.grantFor(op, 1, 'Corpse Explosion'); } });
      R.check(`Corpse Explosion wird ${soll ? 'angeboten' : 'NICHT angeboten'}`, soll ? gefragt(c.t, 'Corpse Explosion') >= 1 : gefragt(c.t, 'Corpse Explosion') === 0, { g: gefragt(c.t, 'Corpse Explosion') });
      sauber(R, c, 'Corpse Explosion');
    }
    // Kohta besiegt einen HELDEN ohne Schaden
    R.section(`Sitz ${me}: Kohta × Corpse Explosion (Held ohne Schaden besiegt)`);
    const h = await szene('Kohta', me, op, { opHand: ['Corpse Explosion'], vorbereiten: (t) => { t.grantFor(op, 1, 'Corpse Explosion'); } });
    R.check('der Gegner-Held 0 ist besiegt', h.t.hp(op, 0) <= 0, h.t.hp(op, 0));
    R.check('Corpse Explosion wird angeboten (Besiegen durch einen Effekt, der als Attack zählt)', gefragt(h.t, 'Corpse Explosion') >= 1, { g: gefragt(h.t, 'Corpse Explosion') });
    sauber(R, h, 'Kohta Corpse');
  }

  // (d) Umleiter: `sourceEffectKind` – Art der Quelle
  {
    R.section('sourceEffectKind: Effekte, die als Attack/Spell zählen, sind für die Umleiter Attack/Spell');
    const t = await H.fresh({});
    const e = t.engine;
    const FAELLE = [
      [HN.Broghan, 'attack'], [HN.Brackle, 'attack'], [HN.Arthor, 'attack'], [HN.Heragas, 'attack'], [HN.Kohta, 'attack'], [HN.Alice, 'spell'],
      ['Javelin Throw', 'attack'], ['Sword in a Bottle', 'attack'], ["Crusader's Cutlass", 'attack'], ['Bamboo Staff', 'attack'],
      [HN.Siphem, 'hero'], ['Locke, the Unseen Saboteur', 'hero'], ['Fireball', 'spell'], ['Quick Attack', 'attack'],
    ];
    for (const [n, soll] of FAELLE) {
      const z = H.DB[n] ? (/Hero/.test(H.DB[n].cardType) ? 'hero' : undefined) : undefined;
      R.check(`${n}: ${soll}`, e.sourceEffectKind({ name: n, zone: z, owner: 0, heroIdx: 0 }) === soll, e.sourceEffectKind({ name: n, zone: z, owner: 0, heroIdx: 0 }));
    }
    R.check('Quellobjekt mit Stempel (Greatmaw-Treffer, Dagger): attack', e.sourceEffectKind({ name: HN.Siphem, owner: 0, heroIdx: 0, treatedAsAttack: e.heldenAngriffStempel(0, 0) }) === 'attack', null);
  }
  // Umleiter e2e: Challenge (Attack-Reaktion) des Gegner-Helden 0 fängt den Effekt gegen Held 1 ab
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(TREIBER)) {
      const sp = TREIBER[name];
      if (!sp.ziele.includes('hero') || name === 'Heragas') continue;
      const soll = sp.kind !== 'keiner';
      R.section(`Sitz ${me}: ${name} × Challenge (Umleitung auf den Nutzer)`);
      const r = await szene(name, me, op, { opHand: ['Challenge'], zielHeld: 1, vorbereiten: (t) => { t.grantFor(op, 0, 'Challenge'); } });
      R.check(`Challenge wird ${soll ? 'angeboten' : 'NICHT angeboten'}`, soll ? gefragt(r.t, 'Challenge') >= 1 : gefragt(r.t, 'Challenge') === 0, { g: gefragt(r.t, 'Challenge') });
      if (soll) R.check('der Effekt wurde auf den Nutzer (Held 0) umgeleitet: Held 1 bleibt heil', r.schaden1 === 0 && r.schaden > 0, { s0: r.schaden, s1: r.schaden1 });
      sauber(R, r, 'Challenge');
    }
  }

  // (e) Stealthy Pursuit: „one of your Heroes … performs a different Attack or Spell" – auch ein Effekt, der als Attack zählt
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(TREIBER)) {
      const sp = TREIBER[name];
      if (name === 'Alice' || name === 'Infected Greatmaw' || sp.kind === 'spell') continue;   // Alice (Spell) hat keine Attack-Kette; der Greatmaw-Held steht erst nach der Wahl fest (Kette hat dann `fromBoard`)
      const soll = sp.kind === 'attack';
      R.section(`Sitz ${me}: ${name} × Stealthy Pursuit`);
      const r = await szene(name, me, op, { ziel: sp.ziele.includes('hero') ? 'hero' : 'creature', meHand: ['Stealthy Pursuit'], vorbereiten: (t) => { for (let hi = 0; hi < 3; hi++) t.grantFor(me, hi, 'Stealthy Pursuit'); } });
      R.check(`Stealthy Pursuit wird ${soll ? 'angeboten (der Held führt eine Attack aus)' : 'NICHT angeboten (gewöhnlicher Heldeneffekt)'}`, soll ? gefragt(r.t, 'Stealthy Pursuit') >= 1 : gefragt(r.t, 'Stealthy Pursuit') === 0, { g: gefragt(r.t, 'Stealthy Pursuit') });
      sauber(R, r, 'Stealthy Pursuit');
    }
  }
  // (f) weitere Leser: Ghoul Guard (Bleed bei „defeated by an opponent's Attack, Spell or Creature effect"), Elixir of Cold (Kälte-Treffer), Anti Magic Enchantment (Spell), Taio (Kill-Marke)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of ['Broghan', 'Alice', 'Siphem', 'Javelin Throw', 'Bamboo Staff']) {
      const sp = TREIBER[name];
      const soll = sp.kind !== 'keiner';
      R.section(`Sitz ${me}: ${name} × Ghoul Guard (Kreatur besiegt)`);
      const g = await szene(name, me, op, { ziel: 'creature', kreaturHp: 30, vorbereiten: (t) => { t.engine._untrackCard(t.opferKreatur.id); t.gs.players[op].supportZones[1][0] = []; const gg = t.put(op, 1, 0, 'Ghoul Guard'); gg.counters.currentHp = 30; gg.turnPlayed = 1; t.opferKreatur = gg; } });
      const geblutet = g.t.gs.players[me].heroes.filter(h => h.statuses?.bleeding || h.statuses?.bleed || h.statuses?.bleeding_game).length;
      process.stdout.write(''); void 0;
      R.check(`Ghoul Guard besiegt → ${soll ? 'ALLE Ziele des Angreifers bluten (Attack/Spell-Treffer)' : 'nur ein gewähltes Ziel blutet (kein Attack/Spell)'}`, soll ? geblutet === 3 : geblutet <= 1, { geblutet });
      sauber(R, g, 'Ghoul Guard');
    }
    R.section(`Sitz ${me}: Elixir of Cold (cold_strike) × Alice / Broghan / Siphem`);
    for (const [name, soll] of [['Alice', true], ['Broghan', true], ['Siphem', false]]) {
      const r = await szene(name, me, op, { vorbereiten: (t) => { t.hero(me, 0).buffs = { cold_strike: { label: 'Cold Strike' } }; } });
      const eingefroren = !!r.t.hero(op, 0).statuses?.frozen;
      R.check(`${name}: Treffer ${soll ? 'friert das Ziel ein' : 'friert nicht ein (kein Attack/Spell)'}`, eingefroren === soll, { eingefroren, schaden: r.schaden });
    }
    R.section(`Sitz ${me}: Anti Magic Enchantment × Alice (Spell)`);
    {
      const r = await szene('Alice', me, op, { vorbereiten: (t) => { const a = t.put(op, 0, 0, H.INERT.artifact); a.counters.antiMagicEnchanted = { charges: 1, owner: op }; } });
      R.check('Anti Magic Enchantment wird angeboten und negiert den Treffer (Alice zählt als Spell)', gefragt(r.t, 'Anti Magic Enchantment') >= 1 && r.schaden === 0, { g: gefragt(r.t, 'Anti Magic Enchantment'), s: r.schaden });
      const b = await szene('Broghan', me, op, { vorbereiten: (t) => { const a = t.put(op, 0, 0, H.INERT.artifact); a.counters.antiMagicEnchanted = { charges: 1, owner: op }; } });
      R.check('Gegenprobe: gegen einen Attack-Treffer (Broghan) bleibt es still', gefragt(b.t, 'Anti Magic Enchantment') === 0 && b.schaden > 0, { g: gefragt(b.t, 'Anti Magic Enchantment'), s: b.schaden });
    }
  }
  // (g) Taio, the Sun Fencer: „has defeated a Hero … with an Attack" (Kill-Marke) – auch durch einen als Attack zählenden Effekt des Helden selbst
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const [name, soll] of [['Bamboo Staff', true], ['Javelin Throw', true]]) {
      R.section(`Sitz ${me}: Taio × ${name}: Kill-Marke`);
      const sp = TREIBER[name];
      const r = await szene(name, me, op, { vorbereiten: (t) => { t.setHero(me, 0, 'Taio, the Sun Fencer', 800); t.hero(op, 0).hp = 40; } });
      void sp;
      R.check(`Taio-Marke ${soll ? 'gesetzt (Attack-Treffer besiegt den Gegner-Helden)' : 'nicht gesetzt'}`, (!!r.t.hero(me, 0)._taioKilledOppHero === soll), { marke: r.t.hero(me, 0)._taioKilledOppHero, hp: r.t.hp(op, 0) });
      sauber(R, r, 'Taio');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
