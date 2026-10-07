'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — HEADLESS-SIMULATION
//
//  Spielt komplette Skill-Test-Partien (Vorbereitung + Kampf) ohne Server,
//  Sockets und Datenbank — mit denselben Modulen wie das Live-Spiel
//  (pool, prep-Regeln, battle, rounds, bot). Grundlage für Tests und das
//  Lernsystem (skilltest/learn/).
//
//    const { runGame } = require('./sim');
//    const rec = await runGame({ seats: 4 });          // 4 Bots, Standard-Profil
//    rec.winnerIdx, rec.rounds, rec.placements, rec.bases …
// ═══════════════════════════════════════════════════════════════════

const Rules = require('../public/skilltest-rules.js');
const { CardPool, dealHand } = require('./pool');
const { CONFIG } = require('./config');
const battle = require('./battle');
const bot = require('./bot');
const { GameEngine } = require('../cards/effects/_engine');
const { getCardDB } = require('../cards/effects/_card-db');

const NOOP = () => {};

/** Spielerzustand wie in server.js `setupGameState` (ohne Konto-/Profil-Felder). */
function skeletonPlayer(seat, name, heroes) {
  return {
    userId: 'cpu-sim:' + seat, username: name, socketId: null,
    color: '#888888', avatar: null, cardback: null, board: null, battleTrack: null,
    victoryMsg: '', defeatMsg: '', heroKilledMsg: '', middleHeroKilledMsg: '', greetingMsg: '', barkBounce: false,
    heroes: heroes.map(h => ({ name: h.hero, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, ability1: h.ability1 || null, ability2: h.ability2 || null, statuses: {} })),
    abilityZones: heroes.map(() => [[], [], []]),
    surpriseZones: [[], [], []], supportZones: [[[], [], []], [[], [], []], [[], [], []]],
    deckTopVisible: [], hand: [], mainDeck: [], potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
    disconnected: false, left: false, gold: 0, abilityGivenThisTurn: [false, false, false], islandZoneCount: [0, 0, 0],
    damageLocked: false, itemLocked: false, dealtDamageToOpponent: false, potionLocked: false, potionsUsedThisTurn: 0,
    permanents: [], coolnessStack: [], creationZone: [], _oncePerGameUsed: new Set(), _resolvingCard: null, deckSkins: {},
  };
}

function simHost(roomBox) {
  const io = { to: () => ({ emit: NOOP }), emit: NOOP, sockets: { sockets: new Map() } };
  return {
    io, GameEngine, activeGames: new Map(),
    db: { run: async () => {} },
    sanitizeRoom: () => ({}), getRoomList: () => [],
    sendGameState: NOOP, sendSpectatorGameState: NOOP,
    destroyRoom: NOOP,
    // Die Sim treibt die Bot-Züge selbst (kein Timer).
    scheduleBotTurn: NOOP,
    async setupGameState(room) {
      const cards = getCardDB();
      room.gameState = {
        players: room.players.map((p, i) => skeletonPlayer(i, p.username, room._currentDecks[i].heroes)),
        areaZones: [], turn: 0, activePlayer: 0, currentPhase: 0, result: null, rematchRequests: [], awaitingFirstChoice: true,
        _gameStartTime: Date.now(), _playerIPs: room.players.map(() => 'sim'),
      };
      void cards;
      room.status = 'playing';
    },
    get doPlaySpell() { return roomBox.doPlaySpell; },
    get doPlayCreature() { return roomBox.doPlayCreature; },
    get doPlayArtifact() { return roomBox.doPlayArtifact; },
    get doUseArtifactEffect() { return roomBox.doUseArtifactEffect; },
    get doPlaySurprise() { return roomBox.doPlaySurprise; },
    get doActivateCreatureEffect() { return roomBox.doActivateCreatureEffect; },
    get doActivateHeroEffect() { return roomBox.doActivateHeroEffect; },
  get doUsePotion() { return roomBox.doUsePotion; },
  get doConfirmPotion() { return roomBox.doConfirmPotion; },
  get doPlayAbility() { return roomBox.doPlayAbility; },
  get doActivateAbility() { return roomBox.doActivateAbility; },
  };
}

/**
 * Eine komplette Partie simulieren.
 * @param {object} opts  { seats = 4, weights?: Array<object|null>, maxTurns = 4000, prepOnly?: bool, quiet?: bool }
 */
async function runGame(opts = {}) {
  // Reproduzierbare Partie: `opts.seed` ersetzt `Math.random` für die Dauer EINER Partie durch einen geseedeten Generator (Austeilung, Aufbau,
  // Policy-Rauschen, Engine). Nur eine Partie gleichzeitig je Thread (die Worker des Trainings spielen nacheinander).
  if (opts.seed == null) return _runGame(opts);
  const realRandom = Math.random;
  Math.random = mulberry32(opts.seed);
  try { return await _runGame(opts); } finally { Math.random = realRandom; }
}

/** Kleiner geseedeter Zufallsgenerator (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function _runGame(opts = {}) {
  const seats = opts.seats || 4;
  const cards = getCardDB();
  const env = { cards, areaLimitOf: (n) => { try { const s = require('../cards/effects/_loader').loadCardEffect(n); return s && s.areaLimit; } catch { return undefined; } } };
  const humanSeat = opts.humanSeat;
  const room = {
    id: 'sim-' + Math.random().toString(36).slice(2, 8), host: 'sim', hostId: 'sim', type: 'unranked',
    players: Array.from({ length: seats }, (_, i) => ({ username: 'Bot ' + (i + 1), userId: 'cpu-sim:' + i, socketId: null, isBot: i !== humanSeat, deckId: null })),
    spectators: [], status: 'playing', gameState: null,
    skillTest: { phase: 'prep', prepTimerDisabled: true, turnTimerDisabled: true, turnTimerSec: 0 },
  };

  // Vorbereitung: Pool, Hände, Basisaufbau je Bot.
  const pool = new CardPool(cards);
  const prep = { pool, players: [], done: true };
  const dealt = [];
  for (let i = 0; i < seats; i++) {
    const ps = Rules.emptyPlayer();
    ps.hand = dealHand(pool, undefined, { cards, ps }).hand;
    dealt.push([...ps.hand]);
    prep.players.push(ps);
  }
  const bases = [];
  for (let i = 0; i < seats; i++) {
    prep.players[i] = bot.prepareBase({ env, ps: prep.players[i], room, idx: i, pool, prep, noProfile: !!(opts.noProfileSeats && opts.noProfileSeats.includes(i)), weights: opts.weights && opts.weights[i], record: !!opts.record });
    prep.players[i].ready = true;
    bases.push(Object.assign(JSON.parse(JSON.stringify(prep.players[i])), { dealt: dealt[i] }));
  }
  if (opts.mutatePrep) opts.mutatePrep(prep);   // Tests: Basen vor dem Kampf gezielt verändern
  if (opts.prepOnly) return { bases };

  // Kampf
  const roomBox = {};
  const host = simHost(roomBox);
  // Die do*-Handler leben in server.js; die Sim braucht sie über eine Brücke (siehe sim-bridge.js).
  Object.assign(roomBox, require('./sim-bridge').handlers());
  const t0 = Date.now();
  room.players.forEach((p, i) => { p.persona = null; });
  await battle.start(room, host, prep);
  const gs = room.gameState, engine = room.engine, st = gs.skillTest;
  if (opts.record) st.record = true;
  // Lookahead (skilltest/mcts.js): in der Simulation standardmäßig AUS (Training soll schnell sein); true | [Sitze] schaltet ihn an.
  room.skillTest.mcts = opts.mcts === undefined ? false : opts.mcts;
  if (opts.mctsCfg) room.skillTest.mctsCfg = opts.mctsCfg;
  if (opts.noProfileSeats) st.noProfile = [...opts.noProfileSeats];
  if (opts.weights) st.botWeights = Object.fromEntries(opts.weights.map((w, i) => [i, w]).filter(([, w]) => w));
  if (!opts.noFast) engine.enterFastMode();
  if (opts.setupOnly) return { room, host, engine, gs, st };       // Tests: Spiel steht, noch nichts gespielt

  let guard = 0;
  const maxTurns = opts.maxTurns || 4000;
  const wdMs = opts.watchdogMs || (opts.mcts ? 180000 : 8000);
  while (!gs.result && guard++ < maxTurns) {
    if (opts.humanSeat != null && gs.activePlayer === opts.humanSeat) {
      // Test-Mensch: passt seine Round (und beantwortet nie Prompts) — deckt hängende Fremd-Prompts auf.
      await require('./rounds').passRound(room, gs.activePlayer, host);
      continue;
    }
    const wd = setTimeout(() => {
      console.log('[sim] HÄNGT: aktiv', gs.activePlayer, 'busy', st.busy, 'pending', JSON.stringify(engine._pendingPrompt || engine._pendingGenericPrompt || null).slice(0, 400));
    }, wdMs);
    await Promise.race([bot.takeTurn(room, gs.activePlayer, host), new Promise(r => setTimeout(r, wdMs + 500))]);
    clearTimeout(wd);
    if (st.busy) break;
  }
  if (!gs.result) engine.onGameOver(room, battle.pickStarter ? 0 : 0, 'sim_turn_limit');
  return {
    winnerIdx: gs.result && gs.result.winnerIdx, reason: gs.result && gs.result.reason,
    rounds: st.round, turns: guard, placements: gs.result && gs.result.skillTest && gs.result.skillTest.placements,
    // Diagnose für verworfene Partien (ohne Platzierungen): Zustand der Sitze am Ende — Patt, hängende Aktion oder Sonstiges (siehe train.js → <profil>.discards.jsonl).
    diag: ((gs.result && gs.result.skillTest && gs.result.skillTest.placements) && !['sim_turn_limit', 'round_limit'].includes(gs.result && gs.result.reason)) ? undefined : {
      seats: gs.players.length, turns: guard, rounds: st.round, busy: !!st.busy, reason: gs.result && gs.result.reason, activePlayer: gs.activePlayer,
      eliminated: [...st.eliminated],
      board: gs.players.map((p, i) => ({
        seat: i,
        heroes: (p.heroes || []).filter(h => h && h.name && h.hp > 0).map(h => h.name + ':' + h.hp + (h.statuses && Object.keys(h.statuses).filter(k => h.statuses[k]).length ? '[' + Object.keys(h.statuses).filter(k => h.statuses[k]).join(',') + ']' : '')),
        creatures: engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === i).length,
      })),
    },
    bases, ms: Date.now() - t0, eliminated: [...st.eliminated],
    room: opts.returnRoom ? room : undefined,
    learnLog: st.learnLog || [], recycled: st.recycled, firstStarter: st.firstStarter,
  };
}

module.exports = { runGame, skeletonPlayer, mulberry32 };
