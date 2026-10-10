'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Prüft die harten CPU-Deck-Regeln des Apocalypse-Decks (Damus / Ifrit /
//  Armageddon / Pseudonia) an gebauten Spielsituationen — ohne Server,
//  ohne Partie. Die Regeln selbst stehen in den Kartenskripten
//  (`cpuMeta.forcePlay`, `cpuResponse`); der Pilot (`_cpu.js`) ruft sie nur.
//
//    node scripts/check-cpu-deck-rules.js
// ═══════════════════════════════════════════════════════════════════
const { loadCardEffect } = require('../cards/effects/_loader');
const { getCardDB } = require('../cards/effects/_card-db');
const seen = require('../cards/effects/_hero-effect-seen-shared');

let fails = 0;
const check = (name, cond, info) => {
  if (cond) console.log('  ✓', name);
  else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); }
};

const DAMUS = 'Damus, the Prophet of Apocalypse';
const PSEUDONIA = 'Pseudonia, the Skill Devourer';
const IDA = 'Ida, the Adept of Destruction';
const BARTAS = 'Bomb Berserker Bartas';
const SEMI = 'Treasure Huntress Semi';

const hero = (name, hp, extra = {}) => ({ name, hp, maxHp: hp, atk: 50, statuses: {}, ...extra });
const player = (heroes, hand = []) => ({
  heroes, hand,
  supportZones: [[[], [], []], [[], [], []], [[], [], []]],
  abilityZones: [[[], [], []], [[], [], []], [[], [], []]],
});

/** Kleine Attrappe der Engine-Teile, die die Regeln lesen. */
function fakeEngine(players, { turn = 5 } = {}) {
  const e = {
    gs: { turn, players, hoptUsed: {}, skillTest: false },
    cardInstances: [],
    playerCount() { return this.gs.players.length; },
    opponentOf(pi) { return pi === 0 ? 1 : 0; },
    heroSideOf(p) { return p; },
    _getCardDB: () => getCardDB(),
    getEffectiveCardData: () => null,
    _isHeroEffectSilenced: () => false,
    heroHoptKey: (n, pi) => `hero-effect:${n}:${pi}`,
    getFreeSupportZones: () => [{ owner: 0, heroIdx: 0, slotIdx: 0 }],
    heroEffectIdentity(p, hi) { return this.gs.players[p].heroes[hi].name; },
    _deckProfileCache: [null, null],      // kein Profil (und kein Laden der echten Profile)
  };
  return e;
}
/** Eine Kreatur auf das Brett legen (Zone + Instanz). */
function addCreature(e, side, heroIdx, slot, name, extra = {}) {
  e.gs.players[side].supportZones[heroIdx][slot] = [name];
  e.cardInstances.push({ name, zone: 'support', owner: side, controller: side, heroIdx, zoneSlot: slot, faceDown: false, counters: {}, turnPlayed: 1, ...extra });
}
const helpers = { isTargetImmune: () => false };
const force = (e, pi = 0) => loadCardEffect('Armageddon').cpuMeta.forcePlay(e, pi, 0, helpers);
const setProb = (e, p) => { e._deckProfileCache = [{ ruleParams: { 'armageddon.zweiHitWahrscheinlichkeit': p } }, undefined]; };

(async () => {
console.log('Armageddon — Auslöschung (Rang 3)');
{
  // Gegner: 3 Helden mit 100 HP; ich: Damus + zwei Helden mit je 400.
  const mk = () => fakeEngine([
    player([hero(DAMUS, 400), hero(IDA, 400), hero(BARTAS, 400)]),
    player([hero(IDA, 100), hero(BARTAS, 100), hero(SEMI, 100)]),
  ]);
  let e = mk();
  check('50 Schaden: kein Gegner-Held stirbt sofort → kein Rang 3 (2 × 50 ≥ 100 ergibt aber Rang 2)', (await force(e)) !== 3, (await force(e)));
  e = mk(); e.gs.players[1].heroes.forEach(h => { h.hp = 120; });
  check('50 Schaden gegen 120 HP: weder sofort noch in zwei Schlägen → keine Erzwingung', (await force(e)) === false, (await force(e)));
  e = mk(); addCreature(e, 0, 0, 0, 'Ifrit');
  check('mit 1 Ifrit (150 Schaden) stirbt die ganze Gegnerseite → Rang 3', (await force(e)) === 3, (await force(e)));
  e = mk(); addCreature(e, 1, 0, 0, 'Ifrit');
  check('Ifrit des GEGNERS zählt zum Schaden ebenfalls (beide Seiten) → Rang 3', (await force(e)) === 3, (await force(e)));
  e = mk(); addCreature(e, 0, 0, 0, 'Ifrit'); e.gs.players[1].heroes[2].hp = 400;
  check('ein überlebender Gegner-Held → keine Auslöschung', (await force(e)) !== 3, (await force(e)));
  e = mk(); addCreature(e, 0, 0, 0, 'Ifrit'); e.gs.players[1].heroes[2].hp = 0;
  check('bereits toter Gegner-Held zählt nicht mit', (await force(e)) === 3, (await force(e)));
}

console.log('Armageddon — Immunität');
{
  const e = fakeEngine([
    player([hero(DAMUS, 400), hero(IDA, 400)]),
    player([hero(DAMUS, 100), hero(IDA, 100)]),
  ]);
  addCreature(e, 0, 0, 0, 'Ifrit');
  addCreature(e, 1, 0, 0, 'Ifrit');                 // gegnerischer Damus hinter seiner Ifrit → gefeit
  check('gegnerischer Damus mit Ifrit überlebt → keine Auslöschung', (await force(e)) !== 3, (await force(e)));
  const h = { isTargetImmune: (eng, t) => t.owner === 1 && t.heroIdx === 1 };
  const e2 = fakeEngine([player([hero(DAMUS, 400)]), player([hero(IDA, 100), hero(BARTAS, 100)])]);
  addCreature(e2, 0, 0, 0, 'Ifrit');
  check('Ziel-Immunität der CPU (z. B. Erstzug-Schutz) verhindert die Erzwingung',
    (await loadCardEffect('Armageddon').cpuMeta.forcePlay(e2, 0, 0, h)) !== 3);
}

console.log('Armageddon — Selbstmord-Schutz');
{
  // Beide Seiten würden komplett ausgelöscht; ich habe keine Ifrit, der Gegner auch nicht.
  const kill = () => fakeEngine([
    player([hero(IDA, 100)]),
    player([hero(IDA, 100)]),
  ]);
  let e = kill(); addCreature(e, 0, 0, 0, 'Ifrit'); addCreature(e, 1, 0, 1, 'Ifrit');
  // Beide Ifrits überleben (immun) → 1:1 → Gleichstand → der Wirker verliert.
  check('Doppel-K.o. bei Kreaturen-Gleichstand = Niederlage → NICHT erzwingen', (await force(e)) === false, (await force(e)));
  e = kill(); addCreature(e, 0, 0, 0, 'Ifrit'); addCreature(e, 0, 0, 1, 'Ifrit'); addCreature(e, 1, 0, 0, 'Ifrit');
  check('Doppel-K.o., aber mehr Kreaturen als der Gegner = Sieg → Rang 3', (await force(e)) === 3, (await force(e)));
  e = fakeEngine([player([hero(IDA, 100)]), player([hero(IDA, 900), hero(BARTAS, 900)])]);
  addCreature(e, 0, 0, 0, 'Ifrit');
  check('nur ich würde sterben, der Gegner nicht → nie erzwingen', (await force(e)) === false, (await force(e)));
}

console.log('Armageddon — zwei Schläge (Rang 2, Wahrscheinlichkeit ersetzbar)');
{
  // 2 Ifrit → 250 Schaden. Gegnerischer Tank 400 HP: 2 × 250 ≥ 400, aber ein Schlag reicht nicht.
  const mk = () => {
    const e = fakeEngine([
      player([hero(DAMUS, 800), hero(IDA, 800)]),
      player([hero(IDA, 400), hero(BARTAS, 100)]),
    ]);
    addCreature(e, 0, 0, 0, 'Ifrit'); addCreature(e, 0, 0, 1, 'Ifrit');
    return e;
  };
  let e = mk(); setProb(e, 1);
  check('Wahrscheinlichkeit 1 → Rang 2', (await force(e)) === 2, (await force(e)));
  e = mk(); setProb(e, 0);
  check('Wahrscheinlichkeit 0 → nicht erzwungen', (await force(e)) === false, (await force(e)));
  e = mk();
  let hits = 0; for (let t = 0; t < 400; t++) { e.gs.turn = 100 + t; e._regelWuerfe = null; if ((await force(e)) === 2) hits++; }
  check('Vorgabe 0,97: in 400 Zügen ≥ 380 Treffer, aber nicht jedes Mal', hits >= 380 && hits < 400, hits);
  e = mk(); setProb(e, 1);
  const a = (await force(e)), b = (await force(e)), c = (await force(e));
  check('der Wurf wird je Zug gemerkt (gleiche Antwort bei jeder Abfrage)', a === b && b === c);
  e = mk(); setProb(e, 1); e.gs.players[1].heroes[0].hp = 600;   // 2 × 250 = 500 < 600
  check('Tank mit 600 HP braucht mehr als zwei Schläge → nicht erzwungen', (await force(e)) === false, (await force(e)));
  e = mk(); setProb(e, 1);
  addCreature(e, 1, 0, 0, 'Ifrit');                              // 300 Schaden; 2 × 300 ≥ 400, Tank überlebt einen Schlag
  check('mit 3 Ifrit (300) ist der 400-HP-Tank in zwei Schlägen tot', (await force(e)) === 2 || (await force(e)) === 3, (await force(e)));
  e = mk(); setProb(e, 1); e.gs.players[1].heroes[0] = hero(DAMUS, 400); addCreature(e, 1, 1, 0, 'Ifrit');
  check('gefeiter Tank (Damus + Ifrit) ist nie zu töten → nicht erzwungen', (await force(e)) === false, (await force(e)));
  // Damus' Ifrit-Platzierung steht noch aus → die Pflicht „jede Runde eine Ifrit" geht vor.
  e = mk(); setProb(e, 1); e.gs.players[0].hand = ['Ifrit', 'Armageddon'];
  check('Damus-Platzierung noch offen → Zwei-Schläge-Regel wartet', (await force(e)) === false, (await force(e)));
  e.gs.hoptUsed[e.heroHoptKey(DAMUS, 0)] = e.gs.turn;
  check('…und gilt wieder, sobald sie benutzt ist', (await force(e)) === 2, (await force(e)));
}

console.log('Damus / Ifrit — jede Runde mindestens eine Ifrit');
{
  const damus = loadCardEffect(DAMUS).cpuMeta.forcePlay;
  const ifrit = loadCardEffect('Ifrit').cpuMeta.forcePlay;
  const e = fakeEngine([player([hero(DAMUS, 400), hero(IDA, 400)], ['Ifrit']), player([hero(IDA, 400)])]);
  check('Damus lebt → sein Heldeneffekt wird erzwungen', damus(e, 0, 0) === true);
  check('…ein anderer Held nicht', !damus(e, 0, 1));
  e.gs.players[0].heroes[0].hp = 0;
  check('toter Damus → keine Erzwingung', !damus(e, 0, 0));
  e.gs.players[0].heroes[0].hp = 400;
  check('Ifrit-Rückfall: Damus lebt, noch keine Ifrit in diesem Zug → Rang 1', ifrit(e, 0) === true);
  addCreature(e, 0, 0, 0, 'Ifrit', { turnPlayed: e.gs.turn });
  check('…ist in diesem Zug schon eine aufs Brett gekommen → nicht mehr', ifrit(e, 0) === false);
  e.gs.turn += 2;
  check('…im nächsten Zug gilt die Pflicht wieder', ifrit(e, 0) === true);
  e.gs.players[0].heroes[0].hp = 0;
  check('…aber nicht, wenn Damus tot ist', ifrit(e, 0) === false);
  // Erbe: Pseudonia mit gewonnenem Damus-Effekt
  const e2 = fakeEngine([player([hero(PSEUDONIA, 400, { gainedEffectNames: [DAMUS] }), hero(IDA, 400)], ['Ifrit']), player([hero(IDA, 400)])]);
  check('Pseudonia mit Damus-Effekt: Effekt wird erzwungen', damus(e2, 0, 0) === true);
  check('…und der Ifrit-Rückfall kennt den Erben', ifrit(e2, 0) === true);
}

console.log('Pseudonia — eigene Helden immer, vom Gegner genau einen');
{
  const resp = (e, d) => loadCardEffect(PSEUDONIA).cpuResponse(e, 'generic', { type: 'confirm', devour: { spalte: 0, hi: 0, fragender: 0, ...d } });
  const mk = () => fakeEngine([
    player([hero(PSEUDONIA, 550), hero(IDA, 400), hero(BARTAS, 400)]),
    player([hero(DAMUS, 400), hero(SEMI, 400), hero(IDA, 400)]),
  ]);
  let e = mk();
  check('eigener Held gefallen → IMMER aufnehmen', resp(e, { effect: IDA, deadPi: 0, deadHi: 1 }).confirmed === true);
  check('Prompt ohne Kontext (Alt-Aufrufer) → wie früher: aufnehmen',
    loadCardEffect(PSEUDONIA).cpuResponse(e, 'generic', { type: 'confirm' }).confirmed === true);

  // Gegner-Held gefallen, die beiden anderen leben noch; keine Beobachtung → gleichauf → nehmen.
  e.gs.players[1].heroes[0].hp = 0;
  check('Gegner-Held gefallen, kein besserer in Sicht → nehmen', resp(e, { effect: DAMUS, deadPi: 1, deadHi: 0 }).confirmed === true);

  // Ein lebender Gegner-Held wurde 3× aktiv gesehen, der Gefallene nie → warten.
  e = mk(); e.gs.players[1].heroes[0].hp = 0;
  for (let i = 0; i < 3; i++) seen.note(e, 'hero_effect_activated', { pi: 1, effect: IDA });
  check('lebender Gegner-Held mit klar höherem gesehenem Wert → auf ihn warten', resp(e, { effect: DAMUS, deadPi: 1, deadHi: 0 }).confirmed === false,
    [seen.seenValue(e, 0, DAMUS), seen.seenValue(e, 0, IDA)]);

  // Umgekehrt: der Gefallene war der Beste.
  e = mk(); e.gs.players[1].heroes[0].hp = 0;
  for (let i = 0; i < 3; i++) seen.note(e, 'hero_effect_activated', { pi: 1, effect: DAMUS });
  check('der Gefallene hat den höchsten gesehenen Wert → nehmen', resp(e, { effect: DAMUS, deadPi: 1, deadHi: 0 }).confirmed === true);

  // Der eine Gegner-Platz ist vergeben.
  e = mk(); e.gs.players[0].heroes[0]._pseudoniaFremd = [SEMI];
  e.gs.players[1].heroes[0].hp = 0;
  check('ein Gegner-Effekt ist schon aufgenommen → kein zweiter', resp(e, { effect: DAMUS, deadPi: 1, deadHi: 0 }).confirmed === false);
  check('…eigene Helden gehen trotzdem', resp(e, { effect: IDA, deadPi: 0, deadHi: 1 }).confirmed === true);

  // Fast so gut wie der Beste (≥ 80 %) → Spatz in der Hand.
  e = mk(); e.gs.players[1].heroes[0].hp = 0;
  for (let i = 0; i < 5; i++) seen.note(e, 'hero_effect_activated', { pi: 1, effect: IDA });
  for (let i = 0; i < 4; i++) seen.note(e, 'hero_effect_activated', { pi: 1, effect: DAMUS });
  check('≥ 80 % des besten lebenden Effekts → nehmen', resp(e, { effect: DAMUS, deadPi: 1, deadHi: 0 }).confirmed === true,
    [seen.seenValue(e, 0, DAMUS), seen.seenValue(e, 0, IDA)]);
  // Rollouts zählen nicht.
  e = mk(); e._inMctsSim = true; seen.note(e, 'hero_effect_activated', { pi: 1, effect: DAMUS });
  check('Beobachtungen im MCTS-Rollout werden nicht verbucht', seen.gesehen(e, 0, DAMUS) === 0);
  e = mk(); seen.note(e, 'hero_effect_activated', { pi: 0, effect: DAMUS });
  check('eigene Aktivierungen zählen nicht als „gesehen"', seen.gesehen(e, 0, DAMUS) === 0);
}

console.log('Armageddon — sichtbare Schadensminderung (echte Engine, echte Tempeste)');
{
  // Echte Skill-Test-Engine (2 Sitze), Helden umbenannt: der Trockenlauf läuft durch die ECHTE Schadenspipeline.
  process.env.PP_ST_SIM = '1';
  const { runGame } = require('../skilltest/sim');
  const { CPU_META_HELPERS } = require('../cards/effects/_cpu');
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 5 });
  console.log = oL; console.error = oE;
  const { engine, gs } = out;
  engine._deckProfileCache = [null, null];
  gs.turn = 5;
  const TEMPESTE = 'Tempeste, the Weather Fairy';
  const setHero = (side, hi, name, hp) => {
    const h = gs.players[side].heroes[hi];
    h.name = name; h.hp = hp; h.maxHp = hp;
    const inst = engine.cardInstances.find(c => c.zone === 'hero' && c.owner === side && c.heroIdx === hi);
    inst.name = name; inst.script = loadCardEffect(name);
    engine._clearHeroScriptCache?.(h);
  };
  engine._trackCard('Ifrit', 0, 'support', 0, 0); gs.players[0].supportZones[0][0] = ['Ifrit'];   // 150 Schaden
  setHero(1, 0, TEMPESTE, 140); setHero(1, 1, IDA, 140); setHero(1, 2, BARTAS, 140);
  // Die Fähigkeiten der umbenannten Helden stammen aus der Seed-Ziehung (jede neue Karte mit Bild verschiebt den Pool). Resistance,
  // Interference & Co. würden den Schlag im Trockenlauf schlucken — die Prüfung gilt Tempeste, nicht der Ziehung.
  gs.players[1].abilityZones = gs.players[1].abilityZones.map(() => [[], [], []]);
  gs.players[1].hand = ['Heal', 'Icebolt'];
  const hps = () => gs.players.map(p => p.heroes.map(h => h.hp).join('/')).join(' | ');
  const vorher = hps();

  // Spion: was sieht der Schlag im Sandkasten von der Gegnerhand?
  let handImSchlag = null;
  const echt = engine.dealDamageToTargets.bind(engine);
  engine.dealDamageToTargets = (...a) => { handImSchlag = gs.players[1].hand.length; return echt(...a); };

  const forceReal = () => loadCardEffect('Armageddon').cpuMeta.forcePlay(engine, 0, 0, CPU_META_HELPERS);
  const modusVorher = [!!engine._inMctsSim, !!engine._fastMode, engine._fastModeDepth || 0, engine._damageCallsThisTurn || 0];
  let r = await forceReal();
  const v = engine._armageddonVorschau && engine._armageddonVorschau.v;
  check('Vorschau läuft über den Sandkasten (nicht über die Handrechnung)', v && v.quelle === 'sandkasten', v && v.quelle);
  check('MIT Tempeste: 150 Schaden töten NICHT die ganze Gegnerseite → keine Erzwingung', r !== 3, r);
  const g = v ? v.helden.filter(h => !h.eigen) : [];
  check('…Tempeste selbst nimmt den vollen Schaden (unreduzierbar) und stirbt', g[0] && g[0].tot && g[0].wirkung >= 140, g[0]);
  check('…ihre beiden anderen Helden nehmen nur 150 − 100 = 50', g[1] && g[1].wirkung === 50 && !g[1].tot && g[2] && g[2].wirkung === 50, [g[1], g[2]]);
  check('Spielzustand nach dem Trockenlauf unverändert (HP)', hps() === vorher, [hps(), vorher]);
  check('…Gegnerhand unverändert', JSON.stringify(gs.players[1].hand) === JSON.stringify(['Heal', 'Icebolt']), gs.players[1].hand);
  check('…der Sandkasten stellt Sim-/Fast-Mode und Schadenszähler wieder her',
    JSON.stringify([!!engine._inMctsSim, !!engine._fastMode, engine._fastModeDepth || 0, engine._damageCallsThisTurn || 0]) === JSON.stringify(modusVorher),
    [[!!engine._inMctsSim, !!engine._fastMode, engine._fastModeDepth || 0, engine._damageCallsThisTurn || 0], modusVorher]);
  check('VERDECKTES bleibt draußen: im Schlag hatte der Gegner keine Handkarten', handImSchlag === 0, handImSchlag);

  // Gegenprobe ohne Tempeste: derselbe Schlag tötet alle drei.
  setHero(1, 0, IDA, 140);
  engine._armageddonVorschau = null;
  r = await forceReal();
  check('OHNE Tempeste: 150 Schaden töten alle drei → Rang 3', r === 3, r);
}

console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ CPU-Deck-Regeln grün');
process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
