'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Pixel Parties – Nischenfall-Harness (headless, echte Engine + echte server.js-Spielwege)
//
//  Benutzung (aus einer Testdatei):
//      const H = require('<scratchpad>/lib/h.js');
//      const t = await H.fresh({ hand: [['Fireball']] });
//      await t.play(0, 'Fireball', { hero: 0 });
//
//  Alles Weitere steht im Kommentarblock bei den Funktionen. Die Harness verändert NIE Repo-Quellen.
// ═══════════════════════════════════════════════════════════════════════════
process.env.PP_ST_SIM = '1';
const path = require('path');
const REAL = { log: console.log, error: console.error, warn: console.warn };   // die echten Konsolen-Funktionen (Tests drucken IMMER darüber)
// Repo-Wurzel: docs/niche-tests/lib/ → drei Ebenen höher.
const ROOT = process.env.PP_ROOT || path.resolve(__dirname, '../../..');
// ── Testkarten in JEDE gelesene cards.json einblenden ─────────────────────────────────────────────────────────
// Es gibt drei getrennte Karten-Maps (`_card-db.js`, `engine._getCardDB()`, `server.js getCardDB()`); alle lesen `data/cards.json`.
// Statt sie einzeln zu füttern, hängt dieser Wächter die inerten Testkarten an jeden Lesevorgang der Datei an (nur im Testprozess).
const fs = require('fs');
const _readFileSync = fs.readFileSync;
const DUMMY_CARDS = [
  { name: 'ZZ Dummy', hp: 200 }, { name: 'ZZ Dummy Big', hp: 1000 }, { name: 'ZZ Dummy Frail', hp: 10 },
  { name: 'ZZ Filler', cardType: 'Spell', hp: null }, { name: 'ZZ Trinket', cardType: 'Artifact', hp: null },
].map(d => Object.assign({ cardType: 'Creature', subtype: 'Normal', level: 0, atk: 0, cost: 0, effect: '', archetype: '', setID: 'TEST', banned: false, skilltestLegal: false }, d));
fs.readFileSync = function (p, ...rest) {
  const out = _readFileSync.call(this, p, ...rest);
  if (typeof p === 'string' && /data[\\/]cards\.json$/.test(p) && typeof out === 'string') {
    const arr = JSON.parse(out);
    for (const d of DUMMY_CARDS) { if (arr.some(c => c.name === d.name)) throw new Error('Harness: Testkartenname bereits vergeben (echte Karte!): ' + d.name); arr.push(d); }
    return JSON.stringify(arr);
  }
  return out;
};

const { runGame, skeletonPlayer, mulberry32 } = require(ROOT + '/skilltest/sim');
const { GameEngine } = require(ROOT + '/cards/effects/_engine');
if (process.env.PP_ABBRUCH_WAECHTER) require('./abbruch-waechter.js').installieren(ROOT, process.env.PP_ABBRUCH_WAECHTER);   // W66b: Entdeckungswerkzeug (siehe lib/abbruch-waechter.js)
const { handlers: simHandlers } = require(ROOT + '/skilltest/sim-bridge');
const { loadCardEffect } = require(ROOT + '/cards/effects/_loader');
const DB = require(ROOT + '/cards/effects/_card-db').getCardDB();
const PHASES = { START: 0, RESOURCE: 1, MAIN1: 2, ACTION: 3, MAIN2: 4, END: 5 };

/** Heroes ohne implementierte Fähigkeit – neutrale Platzhalter, damit Hero-Passive nichts verfälschen. */
const BLANK_HEROES = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
/** Zweites neutrales Trio (für Tests mit 3+ Sitzen). */
const BLANK_HEROES_B = ['Cuberto, Supreme Lord of Edges', 'Hulijing, the Foxdemon', 'George, the Mad Tyrant King'];

/**
 * Inerte Testkarten (ohne Skript, kein Kartentext) – werden zur Laufzeit in die Karten-DB eingeschoben (die DB ist ein
 * prozessweiter Singleton, Engine und server.js sehen sie also). Als Ziele, Opfer, Füllkarten für Hand/Deck.
 *   INERT.creature  'ZZ Dummy'        Creature Normal Lv0, 200 HP, 0 ATK
 *   INERT.big       'ZZ Dummy Big'    1000 HP
 *   INERT.frail     'ZZ Dummy Frail'  10 HP (stirbt an allem)
 *   INERT.filler    'ZZ Filler'       Spell Normal Lv0 (nur als Handkarte/Deckfüllung gedacht)
 *   INERT.artifact  'ZZ Trinket'      Artifact Normal, Kosten 0, ohne Wirkung
 */
const INERT = { creature: 'ZZ Dummy', big: 'ZZ Dummy Big', frail: 'ZZ Dummy Frail', filler: 'ZZ Filler', artifact: 'ZZ Trinket' };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let _uniq = 0;
function deepFindBad(obj, path, out, seen, depth) {
  if (depth > 6 || obj == null) return;
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(path + ' = ' + obj); return; }
  if (typeof obj !== 'object') return;
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) { obj.forEach((v, i) => { if (v === undefined) out.push(path + '[' + i + '] = undefined'); else deepFindBad(v, path + '[' + i + ']', out, seen, depth + 1); }); return; }
  for (const k of Object.keys(obj)) {
    if (k === 'script' || k === 'room' || k === 'engine' || k.startsWith('__')) continue;
    deepFindBad(obj[k], path + '.' + k, out, seen, depth + 1);
  }
}

/**
 * Normalspiel OHNE Skill-Test-Erweiterungen (Zugwechsel, Eliminierung, Ziehen „von außerhalb", Bot-Hirn …):
 * eine nackte GameEngine wie im Online-Spiel, beide Sitze als „CPU" markiert, damit Zielwahl/Prompts durch die Harness laufen.
 */
function buildNormalGame(o) {
  const seats = o.seats || 2;
  const NOOP = () => {};
  const io = { to: () => ({ emit: NOOP }), emit: NOOP, sockets: { sockets: new Map() } };
  const room = {
    id: 'nt-' + Math.random().toString(36).slice(2, 8), host: 'sim', hostId: 'sim', type: 'unranked',
    players: Array.from({ length: seats }, (_, i) => ({ username: 'P' + (i + 1), userId: 'cpu-sim:' + i, socketId: null, isBot: true, deckId: null })),
    spectators: [], status: 'playing', gameState: null,
  };
  const gs = {
    players: room.players.map((p, i) => skeletonPlayer(i, p.username, [{ hero: BLANK_HEROES[0] }, { hero: BLANK_HEROES[1] }, { hero: BLANK_HEROES[2] }])),
    areaZones: [[], []], turn: 5, activePlayer: 0, currentPhase: 3, result: null, rematchRequests: [], awaitingFirstChoice: false,
    _gameStartTime: Date.now(), _playerIPs: room.players.map(() => 'sim'),
  };
  room.gameState = gs;
  const over = { winnerIdx: null, reason: null, called: false };
  const onOver = (r, winnerIdx, reason) => { over.called = true; over.winnerIdx = winnerIdx; over.reason = reason; gs.result = gs.result || { winnerIdx, reason }; };
  const engine = new GameEngine(room, io, NOOP, onOver, NOOP);
  room.engine = engine;
  engine._isSelfPlay = true;                 // beide Sitze „CPU": Prompts laufen durch die Harness, nicht durch Sockets
  engine._cpuPlayerIdx = 0;
  engine.over = over;
  const host = Object.assign({}, simHandlers());   // die ECHTEN do*-Handler aus server.js
  return { room, host, engine, gs, st: null };
}

/**
 * Frisches Spiel. Optionen (alle optional):
 *   seats: 2 (Standard) | 3 | 4         seed: 11
 *   heroes: [[h0,h1,h2],[...]]          Heldennamen je Sitz (Standard: neutrale Platzhalter-Helden)
 *   hp: 800                             Start-HP aller Helden (maxHp gleich)
 *   abilities: {seat: {hi: [[zone0...],[zone1...],[zone2...]]}}   Ability-Karten je Zone (Stapel = Stufe)
 *   hand: [[...],[...]]   deck: [[...],[...]]   discard: [[...],...]   gold: [100,100] | 100
 *   turn: 5   phase: 3 (ACTION; 2 = MAIN1, 4 = MAIN2)   active: 0
 *   confirm: true|false   Standardantwort auf „Ja/Nein"-Fragen (Standard: true → Effekte „sagen ja")
 */
async function fresh(o = {}) {
  Math.random = mulberry32(o.seed ?? 1234);   // reproduzierbar: Mischen, Zufallsziele, Zufallswahlen
  const oL = REAL.log, oE = REAL.error, oW = REAL.warn;
  const errs = [];
  console.log = () => {}; console.error = () => {}; console.warn = () => {};
  let out;
  try {
    if ((o.mode || 'normal') === 'skill') out = await runGame({ seats: o.seats || 2, setupOnly: true, noProfileSeats: [0, 1, 2, 3], seed: o.seed ?? 11 });
    else out = buildNormalGame(o);
  }
  finally { console.log = oL; console.error = oE; console.warn = oW; }
  const { room, host, engine, gs, st } = out;
  const n = gs.players.length;
  const t = {
    room, host, engine, gs, st, n, DB, PHASES, INERT,
    events: [], logs: [], prompts: [], targets: [], errors: errs, warns: [],
    script: [],            // Antwort-Skript: [{match(kind,data), answer(kind,data,ctx)}]
    policy: { confirm: o.confirm ?? true, pickIndex: 0, cancelTargets: false },
    targetFn: null,        // (valid, config, ctx) => Array<id>|undefined
  };
  // Engine-Fehlermeldungen (verschluckte Ausnahmen!) mitschneiden – der Rauchmelder Nr. 1.
  t._capture = () => {
    console.error = (...a) => { errs.push(a.map(x => (x && x.stack) ? x.stack.split('\n').slice(0, 3).join(' | ') : String(x)).join(' ').slice(0, 400)); };
    console.warn = (...a) => { t.warns.push(a.map(String).join(' ').slice(0, 300)); };
    console.log = () => {};
  };
  t._release = () => { console.log = oL; console.error = oE; console.warn = oW; };
  t.say = (...a) => REAL.log(...a);

  engine._fastMode = false; engine._delay = async () => {};   // sonst feuern Kreatur-Hooks/Sperren nicht
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { t.logs.push({ type, data }); return origLog(type, data); };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };

  // ── Prompt-Abfangen: protokollieren, Skript befragen, sonst Politik ──
  const origPG = engine.promptGeneric.bind(engine);
  const runaway = () => {
    if (++t._promptCount > (o.maxPrompts ?? 300)) {
      t.runaway = true; engine._aborted = true;
      throw new Error('RUNAWAY: mehr als ' + (o.maxPrompts ?? 300) + ' Prompts in einer Aktion (Endlosschleife?)');
    }
  };
  t._promptCount = 0;
  engine.promptGeneric = async (pi, d, ...r) => {
    runaway();
    engine._beobachtePrompt?.(pi, d);   // wie die echte promptGeneric: ein Suchergebnis-Fenster ist ein Aufdecken (Atta)
    t.prompts.push({ pi, d, sim: !!engine._inMctsSim });   // W71b: `sim` = Frage aus einem MCTS-Rollout der CPU (zählt nicht als echte Frage)
    for (const rule of t.script) {
      if (rule.used && rule.once) continue;
      if (!rule.match || rule.match(d, pi)) {
        rule.used = true;
        const a = typeof rule.answer === 'function' ? rule.answer(d, pi, t) : rule.answer;
        if (a !== undefined) return a;
      }
    }
    return defaultGenericAnswer(t, pi, d, origPG, r);
  };
  engine._getCpuTargetResponse = (valid, config, who) => {
    runaway();
    const elig = valid.filter(v => !v.ineligible);
    t.targets.push({ valid: elig.map(v => ({ id: v.id, type: v.type, owner: v.owner, heroIdx: v.heroIdx, slotIdx: v.slotIdx, cardName: v.cardName })), config, who });
    if (t.targetFn) { const a = t.targetFn(elig, config, t); if (a !== undefined) return a; }
    if (t.policy.cancelTargets) return t.policy.cancelStyle === 'empty' ? [] : null;   // Mensch: Abbruch-Knopf ⇒ null (CPU-Standard wäre [])
    const need = Math.max(1, config && config.minTargets || 1);
    return elig.slice(0, need).map(v => v.id);
  };

  // ── Grundaufbau der Szene ──
  const gold = Array.isArray(o.gold) ? o.gold : Array(n).fill(o.gold ?? 100);
  for (let s = 0; s < n; s++) {
    const ps = gs.players[s];
    const names = (o.heroes && o.heroes[s]) || (s % 2 === 0 ? BLANK_HEROES : BLANK_HEROES_B);
    ps.heroes = [0, 1, 2].map(hi => {
      const nm = names[hi]; if (!nm) return { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} };
      const cd = DB[nm] || {};
      const hp = o.hp ?? 800;
      return { name: nm, hp, maxHp: hp, atk: cd.atk || 0, baseAtk: cd.atk || 0, ability1: cd.startingAbility1 || null, ability2: cd.startingAbility2 || null, statuses: {} };
    });
    ps.abilityZones = [0, 1, 2].map(hi => [0, 1, 2].map(zi => ((o.abilities && o.abilities[s] && o.abilities[s][hi] && o.abilities[s][hi][zi]) || []).slice()));
    ps.supportZones = [0, 1, 2].map(() => [[], [], []]);
    ps.surpriseZones = [[], [], []];
    ps.hand = ((o.hand && o.hand[s]) || []).slice();
    ps.mainDeck = ((o.deck && o.deck[s]) || Array(o.deckSize ?? 20).fill(INERT.creature)).slice();
    ps.discardPile = ((o.discard && o.discard[s]) || []).slice();
    ps.deletedPile = [];
    ps.potionDeck = ((o.potionDeck && o.potionDeck[s]) || []).slice();
    ps.gold = gold[s];
    ps.permanents = []; ps.coolnessStack = []; ps.creationZone = [];
    ps.heroesActedThisTurn = []; ps._actionsThisTurn = 0;
  }
  gs.areaZones = Array.from({ length: n }, () => []);
  gs.turn = o.turn ?? 5; gs.activePlayer = o.active ?? 0; gs.currentPhase = o.phase ?? PHASES.ACTION; gs.firstTurnProtectedPlayer = null;
  delete gs._zugNr;
  engine.init();
  engine._fastMode = false; engine._delay = async () => {};
  attachHelpers(t);
  t._capture();   // ab jetzt landen Engine-Fehler (console.error) in t.errors; gedruckt wird über R.check/R.note/t.say
  if (process.env.PP_OWNER_GUARD) require('./besitzer.js').waechter(t);   // W64c: generischer Besitzer-Wächter (nur per Env-Variable)
  return t;
}

function defaultGenericAnswer(t, pi, d, origPG, rest) {
  const p = t.policy;
  const type = d && d.type;
  if (type === 'confirm') return { confirmed: p.confirm !== false };
  // Übrige Typen: Engine-Politik der CPU (nimmt jeweils den ersten Eintrag, lehnt Abbrechbares ab).
  try {
    const r = t.engine._getCpuGenericResponse(d, pi);
    if (r !== undefined) return r;
  } catch (e) { t.errors.push('[harness] _getCpuGenericResponse warf: ' + e.message); }
  return null;
}

function attachHelpers(t) {
  const { engine, gs, room, host } = t;
  const cardsOf = (seat) => gs.players[seat];

  /** Instanz-Liste (Kopie) filtern. */
  t.inst = (pred) => engine.cardInstances.filter(pred);
  t.find = (name, zone) => engine.cardInstances.find(c => c.name === name && (!zone || c.zone === zone));

  /** Karte in eine Support Zone legen (Brett) und tracken. Gibt die Instanz zurück. opts: {controller, counters, statuses, faceDown} */
  t.put = (seat, hi, slot, name, opts = {}) => {
    const ps = cardsOf(seat);
    ps.supportZones[hi][slot] = [name];
    const inst = engine._trackCard(name, seat, 'support', hi, slot);
    if (opts.counters) Object.assign(inst.counters, opts.counters);
    if (opts.statuses) Object.assign(inst.statuses, opts.statuses);
    if (opts.controller != null) { inst.controller = opts.controller; }
    if (opts.faceDown) inst.faceDown = true;
    return inst;
  };
  /** Mehrere Karten in dieselbe Zone stapeln? (Support Zones halten genau 1 Karte + evtl. Attachments) */
  /** Surprise verdeckt in die Surprise-Zone eines Helden legen. */
  t.putSurprise = (seat, hi, name) => {
    const ps = cardsOf(seat);
    ps.surpriseZones[hi] = [...(ps.surpriseZones[hi] || []), name];
    const inst = engine._trackCard(name, seat, 'surprise', hi, -1);
    inst.faceDown = true;
    return inst;
  };
  /** Area ins Feld des Sitzes legen. */
  t.putArea = (seat, name) => {
    gs.areaZones[seat] = [...(gs.areaZones[seat] || []), name];
    return engine._trackCard(name, seat, 'area', -1, -1);
  };
  /** Hand eines Sitzes ersetzen (Instanzen werden nachgeführt). */
  t.setHand = (seat, names) => {
    for (const c of t.inst(x => x.zone === 'hand' && x.owner === seat)) engine._untrackCard(c.id);
    cardsOf(seat).hand = names.slice();
    for (const nm of names) engine._trackCard(nm, seat, 'hand');
    engine._installHandRevealInterceptor(seat);
  };
  /** Karte zur Hand hinzufügen (gibt den Handindex zurück). */
  t.addHand = (seat, name) => { cardsOf(seat).hand.push(name); engine._trackCard(name, seat, 'hand'); return cardsOf(seat).hand.length - 1; };
  t.setDeck = (seat, names) => { cardsOf(seat).mainDeck = names.slice(); };
  t.setDiscard = (seat, names) => { cardsOf(seat).discardPile = names.slice(); };
  t.setGold = (seat, g) => { cardsOf(seat).gold = g; };

  /** Helden ersetzen (Name, HP) und neu tracken. */
  t.setHero = (seat, hi, name, hp) => {
    const ps = cardsOf(seat); const cd = DB[name] || {};
    ps.heroes[hi] = { name, hp: hp ?? 800, maxHp: hp ?? 800, atk: cd.atk || 0, baseAtk: cd.atk || 0, ability1: cd.startingAbility1 || null, ability2: cd.startingAbility2 || null, statuses: {} };
    for (const c of t.inst(x => x.zone === 'hero' && x.owner === seat && x.heroIdx === hi)) engine._untrackCard(c.id);
    engine._trackCard(name, seat, 'hero', hi);
  };
  /** Ability-Zonen eines Helden setzen: zones = [[...],[...],[...]] (z. B. [['Fighting','Fighting'],[],[]] = Fighting Lv2). */
  t.setAbilities = (seat, hi, zones) => {
    for (const c of t.inst(x => x.zone === 'ability' && x.owner === seat && x.heroIdx === hi)) engine._untrackCard(c.id);
    const ps = cardsOf(seat);
    ps.abilityZones[hi] = [0, 1, 2].map(zi => (zones[zi] || []).slice());
    for (let zi = 0; zi < 3; zi++) for (const nm of ps.abilityZones[hi][zi]) engine._trackCard(nm, seat, 'ability', hi, zi);
  };
  /** Dem Helden die Schulen/Stufe geben, die `cardName` (Spell/Attack/Creature) braucht. */
  t.grantFor = (seat, hi, cardName, extra = 0) => {
    const cd = DB[cardName]; if (!cd) return;
    const lvl = Math.max(1, (cd.level || 0) + extra);
    const schools = [cd.spellSchool1, cd.spellSchool2].filter(Boolean);
    const zones = [[], [], []];
    schools.slice(0, 3).forEach((s, i) => { zones[i] = Array(Math.min(lvl, 3)).fill(s); });
    // vorhandene Zonen nicht kaputtmachen: nur ergänzen, wenn die Schule fehlt
    const ps = cardsOf(seat);
    const cur = ps.abilityZones[hi];
    for (const [i, s] of schools.entries()) {
      const zi = cur.findIndex(z => z[0] === s);
      if (zi >= 0) { while (cur[zi].length < Math.min(lvl, 3)) { cur[zi].push(s); engine._trackCard(s, seat, 'ability', hi, zi); } continue; }
      const free = cur.findIndex(z => z.length === 0);
      if (free < 0) continue;
      for (let k = 0; k < Math.min(lvl, 3); k++) { cur[free].push(s); engine._trackCard(s, seat, 'ability', hi, free); }
    }
  };
  /** Held-Status setzen (frozen, stunned, burned, poisoned, negated …). */
  t.heroStatus = (seat, hi, key, v = true) => { const h = cardsOf(seat).heroes[hi]; h.statuses[key] = (v === true) ? { appliedTurn: 0 } : v; };

  /** Aktions-Zähler des Sitzes zurücksetzen (frische Aktion, als wäre ein neuer Zug angebrochen – ohne die Zugbeginn-Hooks). */
  t.resetActions = (seat) => {
    const ps = cardsOf(seat);
    ps._actionsPlayedThisPhase = 0; ps._actionsPlayedThisTurn = 0; ps.heroesActedThisTurn = []; ps._bonusMainActions = 0;
    for (const h of ps.heroes) if (h) { h._actionsThisTurn = 0; h._attacksThisTurn = 0; }
  };
  /** Phase setzen. */
  t.phase = (p) => { gs.currentPhase = typeof p === 'string' ? PHASES[p] : p; };

  // ── Spielwege: die ECHTEN server.js-Handler ──
  const isType = (n, ...types) => DB[n] && types.includes(DB[n].cardType);
  /**
   * Eine Handkarte spielen (legt sie bei Bedarf in die Hand, gibt dem Helden nötige Schulen, stellt die passende Phase ein).
   * o: { hero:0, slot:<Support-Slot>, noGrant:true, phase, handIndex, targetOwner, extra }
   * Gibt zurück: das Ergebnis des Handlers (true = gespielt) – bei Ausnahme { threw: Error }.
   */
  t.play = async (seat, name, o = {}) => {
    const cd = DB[name]; if (!cd) throw new Error('Unbekannte Karte: ' + name);
    const ps = cardsOf(seat);
    let hand = o.handIndex ?? ps.hand.indexOf(name);
    if (hand < 0) hand = t.addHand(seat, name);
    const hi = o.hero ?? 0;
    const sub = (cd.subtype || '').toLowerCase();
    if (!o.noGrant && (cd.cardType === 'Spell' || cd.cardType === 'Attack' || cd.cardType === 'Creature')) t.grantFor(seat, hi, name, o.extra || 0);
    gs.activePlayer = o.active ?? seat;
    if (!o.keepActions) t.resetActions(seat);
    let call;
    if (cd.cardType === 'Spell' || cd.cardType === 'Attack') { t.phase(o.phase ?? PHASES.ACTION); call = () => host.doPlaySpell(room, seat, { cardName: name, handIndex: hand, heroIdx: hi, charmedOwner: o.charmedOwner }); }
    else if (cd.cardType === 'Creature') {
      t.phase(o.phase ?? PHASES.ACTION);
      let slot = o.slot; if (slot == null) { slot = ps.supportZones[hi].findIndex(z => z.length === 0); if (slot < 0) slot = 0; }
      call = () => host.doPlayCreature(room, seat, { cardName: name, handIndex: hand, heroIdx: hi, zoneSlot: slot, charmedOwner: o.charmedOwner });
    }
    else if (cd.cardType === 'Artifact') {
      t.phase(o.phase ?? PHASES.MAIN1);
      if (sub === 'equipment' || (loadCardEffect(name) || {}).isEquip) {
        let slot = o.slot; if (slot == null) { slot = ps.supportZones[hi].findIndex(z => z.length === 0); if (slot < 0) slot = 0; }
        call = () => host.doPlayArtifact(room, seat, { cardName: name, handIndex: hand, heroIdx: hi, zoneSlot: slot, targetOwner: o.targetOwner });
      } else call = () => host.doUseArtifactEffect(room, seat, { cardName: name, handIndex: hand });
    }
    else if (cd.cardType === 'Potion') { t.phase(o.phase ?? PHASES.MAIN1); call = () => host.doUsePotion(room, seat, { cardName: name, handIndex: hand }); }
    else if (cd.cardType === 'Ability') { t.phase(o.phase ?? PHASES.MAIN1); call = () => host.doPlayAbility(room, seat, { cardName: name, handIndex: hand, heroIdx: hi, zoneSlot: o.zoneSlot ?? 0 }); }
    else throw new Error('play(): Kartentyp nicht unterstützt: ' + cd.cardType);
    if (sub === 'surprise') { t.phase(o.phase ?? PHASES.MAIN1); call = () => host.doPlaySurprise(room, seat, { cardName: name, handIndex: hand, heroIdx: hi }); }
    if (typeof o.vorAufruf === 'function') o.vorAufruf();   // W66b: Schnappschuss des Spielzustands unmittelbar vor dem Spielweg (Zustandsdifferenz nach Abbruch)
    const ergebnis = await t.run(call, o);
    // Ziel-Tränke/-Artefakte: der Server öffnet `gs.potionTargeting` und wartet auf `doConfirmPotion` bzw. den Abbruch-Knopf – das löst die Harness wie die Zielwahl (t.targetFn / policy.cancelTargets) auf.
    if (!o.noAutoConfirm && gs.potionTargeting && gs.potionTargeting.ownerIdx === seat) await t.resolveTargeting(seat);
    return ergebnis;
  };
  /** Offene Ziel-Session eines Tranks/Artefakts (`gs.potionTargeting`) beantworten: Auswahl per `t.targetFn(valid, config)` (Standard: erstes zulässiges Ziel), Abbruch bei `t.policy.cancelTargets`. */
  t.resolveTargeting = async (seat, ids) => {
    const pt = gs.potionTargeting; if (!pt) return null;
    const valid = (pt.validTargets || []).filter(v => !v.ineligible);
    t.targets.push({ valid: valid.map(v => ({ id: v.id, type: v.type, owner: v.owner, heroIdx: v.heroIdx, slotIdx: v.slotIdx, cardName: v.cardName })), config: pt.config, who: seat, via: 'potionTargeting' });
    let pick = ids;
    if (pick === undefined) {
      if (t.targetFn) pick = t.targetFn(valid, pt.config, t);
      if (pick === undefined) pick = t.policy.cancelTargets ? null : valid.slice(0, Math.max(1, (pt.config && pt.config.minTargets) || 1)).map(v => v.id);
    }
    if (pick === null || (Array.isArray(pick) && pick.length === 0 && t.policy.cancelTargets)) {   // Abbruch wie der Knopf: potionTargeting löschen, Prompt auflösen
      gs.potionTargeting = null;
      return t.run(async () => { try { engine.resolveEffectPrompt(null, { cancelled: true }); } catch (e) { /* kein offener Prompt */ } return 'abgebrochen'; });
    }
    return t.run(() => host.doConfirmPotion(room, seat, { selectedIds: pick }));
  };
  /** Beliebigen Aufruf mit Zeitwächter + Fehlerfang ausführen. */
  t.run = async (fn, o = {}) => {
    const limit = o.timeoutMs ?? 8000;
    t._promptCount = 0;
    let timer; const hang = new Promise(r => { timer = setTimeout(() => r({ hung: true }), limit); });
    try {
      const r = await Promise.race([fn(), hang]);
      if (r && r.hung) { t.hung = true; return { hung: true, pending: describePending(t) }; }
      if (t.runaway) return { runaway: true, value: r };
      return r;
    } catch (e) { if (t.runaway) return { runaway: true, threw: e }; t.errors.push('[THROW] ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); return { threw: e }; }
    finally { clearTimeout(timer); }
  };
  /** Nach-Ketten-Aktionen abarbeiten (der Server tut das im `.finally` jedes Socket-Handlers; die Harness nur auf Zuruf): Shamanic Curse/Celia, Lunar Eclipse … */
  t.drain = (o) => t.run(() => engine._runPostChainActions(), o);
  t.activateCreature = (seat, hi, slot, o) => t.run(() => host.doActivateCreatureEffect(room, seat, { heroIdx: hi, zoneSlot: slot, charmedOwner: o && o.charmedOwner }), o);   // `o.charmedOwner`: Kreatur auf der Gegenseite (geliehen / Spy in the Enemy's Camp)
  t.activateHero = (seat, hi, o = {}) => { gs.activePlayer = seat; t.phase(o.phase ?? PHASES.MAIN1); return t.run(() => host.doActivateHeroEffect(room, seat, { heroIdx: hi, chosenEffectName: o.effect }), o); };
  t.activateEquip = (seat, hi, slot, o = {}) => { gs.activePlayer = seat; t.phase(o.phase ?? PHASES.MAIN1); return t.run(() => host.doActivateEquipEffect(room, seat, { heroIdx: hi, zoneSlot: slot }), o); };
  t.activateAbility = (seat, hi, zoneIdx, o = {}) => { gs.activePlayer = seat; t.phase(o.phase ?? PHASES.MAIN1); return t.run(() => host.doActivateAbility(room, seat, { heroIdx: hi, zoneIdx }), o); };

  // ── Zugfluss (echte Engine-Phasenfolge) ──
  /** Hook-Batterie eines Zugbeginns (wie im Spiel: onTurnStart). */
  t.turnStart = async (seat) => { gs.activePlayer = seat; t.events.length = 0; return t.run(() => engine.runHooks('onTurnStart', { turn: gs.turn, activePlayer: seat })); };
  /** Den echten Zugwechsel auslösen: aktueller Spieler beendet seinen Zug über die End-Phase (Zugende-Hooks, Statusablauf, Zugbeginn des nächsten). */
  t.endTurn = async (o = {}) => {
    const me = gs.activePlayer;
    gs.currentPhase = PHASES.MAIN2;
    return t.run(() => engine.advanceToPhase(me, PHASES.END, { manual: true }), o);
  };

  // ── Prüfungen ──
  /** Zustandsrauchmelder: NaN/Infinity, undefined-Namen in Zonen, Instanz↔Zone-Abgleich. Gibt Liste der Auffälligkeiten. */
  t.audit = () => {
    const bad = [];
    deepFindBad(gs.players, 'players', bad, new Set(), 0);
    for (let s = 0; s < t.n; s++) {
      const ps = gs.players[s];
      for (const [k, arr] of [['hand', ps.hand], ['mainDeck', ps.mainDeck], ['discardPile', ps.discardPile], ['deletedPile', ps.deletedPile], ['potionDeck', ps.potionDeck]]) {
        (arr || []).forEach((nm, i) => { if (typeof nm !== 'string' || !nm) bad.push(`seat${s}.${k}[${i}] ungültig: ${String(nm)}`); else if (!DB[baseOf(nm)]) bad.push(`seat${s}.${k}[${i}] unbekannte Karte: ${nm}`); });
      }
      for (let hi = 0; hi < 3; hi++) for (let zi = 0; zi < 3; zi++) {
        const z = ps.supportZones[hi][zi] || [];
        // Mehrere Karten in EINEM Platz sind nur der Equip-Stapel eines Helden mit `equipsShareZone` (Darion) erlaubt (Alice-Stapel: eigene Prüfung in lib/alice-brett.js).
        const darionStapel = z.length > 1 && !!(engine.heroScript(s, hi) || {}).equipsShareZone && z.every(nm => engine.isEquipInZone(nm));
        if (z.length > 1 && !darionStapel) bad.push(`seat${s}.support[${hi}][${zi}] hält ${z.length} Karten: ${z.join(',')}`);
        for (const nm of z) {
          const insts = engine.cardInstances.filter(c => c.zone === 'support' && c.owner === s && c.heroIdx === hi && c.zoneSlot === zi && c.name === nm);
          const erwartet = darionStapel ? z.filter(x => x === nm).length : 1;
          if (insts.length !== erwartet) bad.push(`seat${s}.support[${hi}][${zi}] "${nm}": ${insts.length} Instanzen (erwartet ${erwartet})`);
        }
      }
      for (const h of ps.heroes) if (h && h.name) {
        if (!Number.isFinite(h.hp) || !Number.isFinite(h.maxHp) || !Number.isFinite(h.atk)) bad.push(`seat${s} Held ${h.name}: hp/maxHp/atk nicht endlich (${h.hp}/${h.maxHp}/${h.atk})`);
        if (h.hp > h.maxHp) bad.push(`seat${s} Held ${h.name}: hp ${h.hp} > maxHp ${h.maxHp}`);
      }
      if (!Number.isInteger(ps.gold)) bad.push(`seat${s}.gold nicht ganzzahlig: ${ps.gold}`);
    }
    // Geister: Support-Instanzen ohne Namen in der Zone
    for (const c of engine.cardInstances) if (c.zone === 'support' && c.owner != null) {
      const z = (gs.players[c.owner].supportZones[c.heroIdx] || [])[c.zoneSlot] || [];
      if (!z.includes(c.name)) bad.push(`Geister-Instanz "${c.name}" (seat${c.owner} hero${c.heroIdx} slot${c.zoneSlot}) – Zone leer/anders: [${z.join(',')}]`);
    }
    return bad;
  };
  /** Karten-Bilanz: Multimenge aller Kartennamen je Ort (Hand, Deck, Ablage, Gelöscht, Brett, Abilities, Surprises, Areas, Permanents …) gesamt. */
  t.census = () => {
    const m = new Map(); const add = (nm, k = 1) => { if (typeof nm !== 'string') return; m.set(nm, (m.get(nm) || 0) + k); };
    for (const ps of gs.players) {
      for (const k of ['hand', 'mainDeck', 'discardPile', 'deletedPile', 'potionDeck', 'creationZone', 'coolnessStack']) (ps[k] || []).forEach(x => add(typeof x === 'string' ? x : x && x.name));
      (ps.supportZones || []).forEach(h => h.forEach(z => z.forEach(x => add(x))));
      (ps.abilityZones || []).forEach(h => h.forEach(z => z.forEach(x => add(x))));
      (ps.surpriseZones || []).forEach(z => z.forEach(x => add(x)));
      (ps.heroes || []).forEach(h => h && h.name && add(h.name));
      (ps.permanents || []).forEach(p => p && p.name && add(p.name));
    }
    (gs.areaZones || []).forEach(z => z.forEach(x => add(x)));
    return m;
  };
  t.censusDiff = (before, after) => {
    const out = [];
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const k of keys) { const d = (after.get(k) || 0) - (before.get(k) || 0); if (d) out.push(`${k}: ${d > 0 ? '+' : ''}${d}`); }
    return out;
  };
  /** Prompts seit dem letzten Aufruf leeren. */
  t.reset = () => { t.events.length = 0; t.logs.length = 0; t.prompts.length = 0; t.targets.length = 0; t.errors.length = 0; t.warns.length = 0; t.hung = false; };
  t.evs = (name) => t.events.filter(e => e.ev === name).map(e => e.data);
  t.lg = (type) => t.logs.filter(l => l.type === type).map(l => l.data);
  t.hero = (seat, hi) => gs.players[seat].heroes[hi];
  t.hp = (seat, hi) => gs.players[seat].heroes[hi].hp;
  t.zone = (seat, hi, slot) => (gs.players[seat].supportZones[hi][slot] || [])[0] || null;
  t.pile = (seat, k) => gs.players[seat][k];
}

function baseOf(nm) { return String(nm).replace(/\s*\(.*\)$/, ''); }
function describePending(t) {
  const e = t.engine;
  try { return JSON.stringify({ gen: e._pendingGenericPrompt ? 'generic' : null, prompt: e.gs.effectPrompt && { type: e.gs.effectPrompt.type, title: e.gs.effectPrompt.title }, targeting: !!e.gs.potionTargeting }).slice(0, 300); } catch { return '?'; }
}

/** Mini-Testrahmen: check() zählt Fehlschläge, finish() setzt den Exitcode. */
function runner() {
  const R = { fails: 0, passes: 0, notes: [] };
  R.check = (name, cond, info) => { if (cond) { R.passes++; REAL.log('  ✓', name); } else { R.fails++; REAL.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 500) : ''); } };
  /** Beobachtung ohne Soll (für „unsicher, ob so gewollt"). */
  R.note = (name, info) => { R.notes.push({ name, info }); REAL.log('  ℹ', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 500) : ''); };
  R.section = (s) => REAL.log('\n' + s);
  R.finish = () => { REAL.log(`\n${R.passes} ok, ${R.fails} ✗, ${R.notes.length} Notizen`); process.exit(R.fails ? 1 : 0); };
  return R;
}

module.exports = { fresh, runner, DB, loadCardEffect, PHASES, INERT, BLANK_HEROES, BLANK_HEROES_B, sleep, ROOT };
