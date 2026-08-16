// ═══════════════════════════════════════════
//  PIXEL PARTIES — CPU OPPONENT BRAIN
//  Drives the CPU player's turn in Singleplayer mode.
//  Puzzle mode does NOT use this module.
// ═══════════════════════════════════════════
//
// Sub-phase 2a: Attach Abilities only (random eligible Hero).
// Later sub-phases add Artifacts, Potions, Surprises, Creatures/Spells/Attacks,
// active effects, Ascension, and the targeting engine.

const { loadCardEffect } = require('./_loader');
const { PHASES, getCleansableStatuses } = require('./_hooks');
// Learned per-deck profiles (ML-trained via scripts/train-deck-profile.js).
// No-ops when no profile matches the piloted lineup or when
// PP_DISABLE_PROFILES=1 (training data collection).
const deckProfile = require('./_deck-profile');

// Small pauses between CPU actions / phase advances so a human spectator
// can actually follow the sequence. Kept deliberately modest — longer
// values make the CPU feel sluggish on complex decks.
const PAUSE_BETWEEN_ACTIONS = 600;
const PAUSE_BETWEEN_PHASES = 450;

// Wie oft darf DIESELBE Aktivierung innerhalb eines Schleifendurchlaufs
// wiederholt gefeuert werden? Das ist KEINE Regelgrenze — wie viele
// Nutzungen eine Karte hat, entscheidet ausschließlich sie selbst über
// ihr `canActivate…`-Gate. Diese Zahl ist nur der Riegel gegen eine
// Karte, die dauerhaft "verfügbar" meldet und trotzdem jedes Mal
// feuert; ohne ihn liefe die Schleife bis zur Zug-Deadline. Bewusst
// deutlich über dem, was echte Karten brauchen (aktuell 3).
const MAX_ACTIVATION_REPEATS = 8;
// Wie viele Aufstiege darf ein Zug höchstens enthalten? Auch das ist
// KEINE Regelgrenze — die Karten begrenzen sich über ihren Counter-Preis
// selbst. Der Riegel fängt nur den Fall ab, dass eine Form netto Counter
// zurückgibt (Stormkissed: −1 zahlen, +2 erhalten) und die Schleife
// sich dadurch bis zur Zug-Deadline weiterdrehen könnte. Drei reicht für
// jede Linie, die im Archetyp vorgesehen ist (Aufstieg → Descend →
// Wiederaufstieg).
const MAX_ASCENSIONS_PER_TURN = 3;
// Wie viele Beschwoerungen darf der Gratis-Bypass je Zug durchwinken?
//
// Reiner Livelock-Riegel gegen koerper-erzeugende Beschwoerungen, KEINE
// Wertaussage. Meine Rate-Hypothese aus v265 war falsch, und Al hat sie
// widerlegt: Morph and Kill fuehrt selbst zwoelf Karten mit inhaerenter
// Aktion (4× Aggressive Town Guard, 4× Ska Harpyformer, 4× Disgruntled
// Forest Warden), die Dichte allein unterscheidet die Decks also nicht.
// Der Unterschied war Steam Dwarf Dragon Pilot — eine OPFER-Beschwoerung,
// siehe `summonCostsMoreThanTheCard`.
const MAX_FREE_SUMMONS_PER_TURN = 3;
// Delay for each CPU prompt decision during card resolution (targeting, picks,
// confirms). Puzzle mode keeps the original 50ms via the original prompt path.
const CPU_PROMPT_DELAY = 350;
// Hard wall-clock cap on a single CPU turn. If the CPU's runCpuTurn doesn't
// finish in this much real time, all subsequent MCTS evaluations fall back
// to heuristic ordering and remaining safety-loop iterations bail out, so
// the turn force-advances to End instead of the brain stalling. 90s is
// generous — a healthy turn finishes in under 10s; this cap exists solely
// to break out of pathological infinite-loop / stuck-await scenarios that
// would otherwise hang the game indefinitely.
const MAX_CPU_TURN_MS = 90000;
// Per-rollout wall-clock cap. A single MCTS rollout that runs longer
// than this trips its safety-loop deadline gates so the rank loop can
// move on to the next candidate. Without this cap a pathological
// rollout — e.g. Heal Burn's afterHeal→Lifeforce Howitzer→actionDeal-
// Damage→afterDamage→Shield of Life→actionHealHero cascades repeated
// across a 6-turn horizon × 80 UCB1 pulls — could monopolise the rank
// budget and extend the live turn past MAX_CPU_TURN_MS, since
// cpuPastDeadline used to short-circuit inside MCTS sims.
const MAX_ROLLOUT_MS = 8000;
// Hard per-card-handling cap. Applied to a single mctsGatedActivation's
// LIVE actionFn (and the bypass-path actionFn). When a card's resolution
// involves nested MCTS — e.g. The Yeeting's two-prompt cpuResponse that
// runs mctsPickFromOptions per option per prompt — the combined budget
// can balloon well past the per-turn cap if the inner code stops yielding
// (a tight sync chain inside an engine hook, or a Promise that never
// resolves). The cap is enforced two ways: (a) `_cpuCardDeadline` makes
// `cpuPastDeadline` true after this many ms so nested mctsPickFromOptions
// / rolloutRestOfTurn loops self-cancel at their await boundaries; (b) a
// Promise.race against the same timeout guarantees the OUTER awaiter
// returns even if the inner code never yields. (b) leaves the underlying
// work running in the background — `_runWithCardHardcap` clears
// `gs.potionTargeting` as a best-effort recovery so the next CPU action
// isn't blocked by a stale resolve-state.
const CARD_HANDLING_HARDCAP_MS = (() => {
  // Env-Override für Tests/Diagnose (PP_CARD_HARDCAP_MS): erlaubt es,
  // die graziöse Degradation mit engem Budget kontrolliert zu prüfen.
  const env = parseInt(process.env.PP_CARD_HARDCAP_MS || '', 10);
  return Number.isFinite(env) && env > 0 ? env : 30000;
})();

// DEBUG: force-add "The Yeeting" to the CPU's hand at the start of its
// second LIVE turn. Used to reliably reproduce the Yeeting CPU-resolution
// path without waiting on the natural draw. Set to false for normal play.
const DEBUG_FORCE_YEETING_ON_CPU_TURN_2 = false;

// Set to false when the CPU is stable. Keep verbose while we're still shaking
// out freeze bugs — every major decision point logs so a hang can be traced.
const CPU_DEBUG = true;
// Silenced during MCTS rollouts so the rollout's MainPhase/ActionPhase chatter
// doesn't drown out the real turn's log. Toggled by mctsRunOneRollout.
let _cpuLogSilent = false;
// Externally controllable verbose toggle. DEFAULT OFF so live CPU-vs-human
// games don't spam stdout on tester builds. Console-fired test tools
// (self-play batches, A/B runs) can enable it explicitly via setCpuVerbose
// when they want per-decision traces. Currently ON for the live CPU-tuning
// pass — paired with `DEBUG_REVEAL_NPC_HAND = true` in server.js, this
// surfaces both the CPU's hand state and its per-decision reasoning so
// the tester can correlate "what was held" with "what was picked." Flip
// back to `false` for a public build.
let _cpuVerbose = true;
// Optional transcription function. When set, cpuLog calls it INSTEAD of
// console.log, regardless of _cpuVerbose. Used by self-play to capture
// detailed decision traces for a subset of games without flooding stdout.
// _cpuLogSilent (inner-rollout silencing) still applies, so transcripts
// show real-turn decisions only, not the per-rollout chatter.
let _cpuTranscribeFn = null;
function cpuLog(...args) {
  if (!CPU_DEBUG || _cpuLogSilent) return;
  if (_cpuTranscribeFn) {
    try { _cpuTranscribeFn(args.join(' ')); } catch {}
    return;
  }
  if (!_cpuVerbose) return;
  console.log('[CPU]', ...args);
}
function setCpuVerbose(v) { _cpuVerbose = !!v; }
function getCpuVerbose() { return _cpuVerbose; }
function setCpuTranscribeFn(fn) { _cpuTranscribeFn = typeof fn === 'function' ? fn : null; }

// Legacy module-level delay — kept for any stray callers. Brain functions
// should use engine._delay(ms) so MCTS fast-mode silences every pause.
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function pauseAction(engine) { return engine._delay(PAUSE_BETWEEN_ACTIONS); }
function pausePhase(engine) { return engine._delay(PAUSE_BETWEEN_PHASES); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stillCpuTurn(engine, cpuIdx) {
  return !engine.gs.result && engine.gs.activePlayer === cpuIdx;
}

/**
 * True when the live CPU turn has run past its hard wall-clock cap, OR
 * when the current MCTS rollout has run past its own per-rollout cap.
 * Used by main-phase / action-phase safety loops and the MCTS gates to
 * bail out cleanly instead of grinding through more rollouts on a
 * stuck turn.
 *
 * The HARD live-turn check fires in ALL contexts (including nested
 * MCTS rollouts). Without this, once a rollout slipped past the 90s
 * live deadline, its inner runMainPhase / rolloutRestOfTurn safety
 * checks would never trip, letting one pathological rollout extend the
 * freeze far past MAX_CPU_TURN_MS. (Field report: Heal Burn deck
 * freezing 2+ minutes on the CPU's turn.)
 *
 * The SOFT per-rollout cap (active only inside `_inMctsSim`) keeps a
 * single rollout from monopolising the rank budget. Each rollout entry
 * stamps `_mctsRolloutStartT`; the check trips after MAX_ROLLOUT_MS so
 * the rank loop can move on to the next candidate / variation.
 */
// ── ε-Exploration für Trainingsdaten (PP_TRAIN_EXPLORE) ─────────────
// Der fundamentale blinde Fleck der On-Policy-Datensammlung: Die
// Regression kann nur Linien bewerten, die der Pilot tatsächlich geht.
// Karten, die der Baseline-Pilot NIE spielt (The Cosmic Depths: 3 Plays
// in 100 Spielen; Coffee/Deepsea Idol: 0), liefern keinerlei Support —
// egal wie viele Spiele gesammelt werden. Mit PP_TRAIN_EXPLORE=ε kippt
// mit Wahrscheinlichkeit ε eine Live-Entscheidung zugunsten einer sonst
// nicht gewählten Option: die Action Phase probiert einen zufälligen
// legalen Kandidaten statt des Top-Picks, Main-Phase-Gates committen
// eine Aktivierung, die sie sonst geskippt hätten. Einzelne Spiele
// werden dadurch schwächer, aber die Regression bekommt echte
// "gespielt → Ausgang"-Daten für die unerforschten Karten.
//
// Sicherungen: greift NUR in Self-Play (engine._isSelfPlay), NIE in
// Eval-Läufen (PP_TRAIN_EVAL=1) und NIE innerhalb von MCTS-Rollouts
// (die Simulationen sollen Kandidaten weiterhin unter der normalen
// Policy bewerten — exploriert wird nur die LIVE-Entscheidung).
const EXPLORE_EPS = (() => {
  const v = parseFloat(process.env.PP_TRAIN_EXPLORE || '0');
  return Number.isFinite(v) && v > 0 ? Math.min(0.5, v) : 0;
})();
// Novelty-Zähler: kartenweise Versuchszählung über die Prozess-Laufzeit.
// Uniforme ε-Exploration hat sich als zu diffus erwiesen (25-Spiele-Test:
// The Cosmic Depths trotz ε=0.2 weiterhin 0 Plays — das Budget verpufft
// an ohnehin gut erforschten Karten). Deshalb wählt die Exploration den
// Kandidaten mit dem NIEDRIGSTEN Versuchszähler (Ties uniform) statt
// uniform über alle. Zählt Versuche, nicht Erfolge — eine Karte, deren
// Play wiederholt fehlschlägt, soll nicht endlos re-exploriert werden.
// Prozess-lokal: Wrapper-Restarts setzen die Zähler zurück, was die
// betroffenen Karten kurz erneut exploriert — unschädlich bis nützlich.
const _exploreAttempts = new Map();
/**
 * Seedet die Novelty-Zähler aus historischen Play-Daten (Batch-Runner
 * liest die Resume-JSONL und übergibt Σ Plays pro Karte). Ohne Seeding
 * starten nach jedem Prozessstart ALLE Karten bei 0 Versuchen — der
 * Novelty-Pick würfelt dann uniform zwischen "nie in 100 Spielen
 * gespielt" und "in diesem Prozess nur noch nicht dran gewesen", und
 * die ohnehin häufigen Karten fressen die ersten Explores wieder auf
 * (empirisch: The Cosmic Depths blieb trotz Novelty-Exploration bei 0,
 * weil Gatherer/Gerrymander/Adventurousness dieselbe "Novelty" hatten).
 */
function seedExploreAttempts(counts) {
  if (!counts) return;
  for (const [name, n] of Object.entries(counts)) {
    if (typeof n === 'number' && n > 0) {
      _exploreAttempts.set(name, Math.max(_exploreAttempts.get(name) || 0, n));
    }
  }
}
function noteExploreAttempt(engine, cardName) {
  if (!EXPLORE_EPS || !cardName) return;
  // NUR Live-Versuche zählen. runActionPhase läuft auch innerhalb der
  // MCTS-Rollouts — würden simulierte Tries mitgezählt, spiegelten die
  // Zähler binnen eines Spiels die Policy-Frequenz (beobachtet:
  // "Novelty"-Picks mit 8-13 Versuchen im ersten Spiel) und das
  // Neuheits-Signal wäre wertlos.
  if (engine?._inMctsSim) return;
  _exploreAttempts.set(cardName, (_exploreAttempts.get(cardName) || 0) + 1);
}
function pickNoveltyCandidate(candidates) {
  let minSeen = Infinity;
  for (const c of candidates) {
    const seen = _exploreAttempts.get(c.cardName) || 0;
    if (seen < minSeen) minSeen = seen;
  }
  const pool = candidates.filter(c => (_exploreAttempts.get(c.cardName) || 0) === minSeen);
  return pool[Math.floor(Math.random() * pool.length)];
}
function exploreRoll(engine) {
  if (!EXPLORE_EPS) return false;
  if (process.env.PP_TRAIN_EVAL === '1') return false;
  if (!engine?._isSelfPlay) return false;
  if (engine._inMctsSim) return false;
  return Math.random() < EXPLORE_EPS;
}

function cpuPastDeadline(engine) {
  const dl = engine?._cpuTurnDeadline;
  if (typeof dl === 'number' && Date.now() >= dl) return true;
  // Per-card hardcap. Set by `_runWithCardHardcap` around mctsGatedActivation's
  // actionFn calls so nested mctsPickFromOptions / rolloutRestOfTurn loops
  // self-cancel at their await boundaries when a single card's resolution
  // overruns its budget. Applies regardless of `_inMctsSim`.
  const cardDl = engine?._cpuCardDeadline;
  if (typeof cardDl === 'number' && Date.now() >= cardDl) return true;
  if (engine?._inMctsSim) {
    const startT = engine._mctsRolloutStartT;
    if (typeof startT === 'number' && (Date.now() - startT) >= MAX_ROLLOUT_MS) {
      return true;
    }
  }
  return false;
}

/**
 * Run a single CPU card-handling actionFn under a 30s hardcap. Two-layer
 * defence: (1) `_cpuCardDeadline` makes `cpuPastDeadline` true so async
 * loops inside the actionFn self-cancel, (2) Promise.race against a real
 * timer returns to the caller even if (1)'s yield points are starved
 * (sync infinite loop, never-resolving Promise). Best-effort cleanup on
 * timeout: clear `gs.potionTargeting` so the next CPU sub-phase isn't
 * stuck on the abandoned card's resolution state.
 */
async function _runWithCardHardcap(engine, label, fn) {
  const prevCardDeadline = engine._cpuCardDeadline;
  // Weiche Deadline mit HEADROOM vor dem harten Timer: Vorher waren
  // beide identisch (t0 + HARDCAP) — die Self-Cancel-Schicht wurde
  // exakt in dem Moment wahr, in dem der harte Abbruch schon feuerte,
  // und konnte ihren Job (Exploration trimmen, Play regulär zu Ende
  // bringen) nie erfüllen. Jetzt kappen die cpuPastDeadline-Guards die
  // Gate-Variationen / Options-Rollouts bei ~60% des Budgets und der
  // Play committet mit dem bis dahin besten Ergebnis; der harte Timer
  // bleibt letzte Verteidigung gegen synchrone Hänger. (Beobachtet:
  // Magnetic Glove vs Burning Inferno — Gate-Skip + Recon + bis zu 12
  // Variationen + Live-Galerie-Pick, jede mit Rest-of-Turn-Sim des
  // aktionsdichten Inferno-Zugs, überschritt gelegentlich 30s →
  // Komplett-Abbruch des Plays + Timeout-Ties.)
  engine._cpuCardDeadline = Date.now() + Math.floor(CARD_HANDLING_HARDCAP_MS * 0.6);
  let timerId;
  let abandoned = false;
  // Zustands-Snapshot für den Timer-Guard: Zug-beendende Effekte
  // (Cooldins Area-Play, Gigantisaurs Tribut-Summon) treiben den
  // FOLGEZUG im selben await-Strang — der gewrappte fn ist dann kein
  // hängender Play mehr, sondern enthält das legitim weiterlaufende
  // Spiel. Feuerte der Timer trotzdem, kehrte das Race mitten im
  // Folgezug zum ALTEN Aufrufer zurück: zwei interleavte Turn-Loops,
  // doppelte advancePhase-Übergänge, Kollaps → no-result (Slip 'n
  // Slide vs Big Stomp: reproduzierbar in 2/2 Verbose-Läufen, Doppel-
  // Logs im Trace). Der Guard bricht deshalb NUR ab, wenn das Spiel
  // seit Wrap-Start wirklich stillsteht — gleicher Zug, gleicher
  // aktiver Spieler. Ist es weitergezogen, löst der Timer still auf
  // und das Race wartet auf das reguläre fn-Ende.
  const turnAtStart = engine.gs?.turn;
  const activeAtStart = engine.gs?.activePlayer;
  const timeoutP = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const movedOn = engine.gs
        && (engine.gs.turn !== turnAtStart || engine.gs.activePlayer !== activeAtStart);
      if (movedOn) {
        cpuLog(`      (hardcap ${label}: Spiel ist weitergezogen — Timer entschärft)`);
        return; // kein Reject: fn enthält das legitim laufende Spiel
      }
      reject(new Error(`hardcap:${label}`));
    }, CARD_HANDLING_HARDCAP_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(fn), timeoutP]);
  } catch (err) {
    if (err && typeof err.message === 'string' && err.message.startsWith('hardcap:')) {
      console.error(`[CPU] ⚠️  card hardcap hit (${CARD_HANDLING_HARDCAP_MS}ms): ${label} — abandoning play`);
      // Diagnose-Dump: nennt die heißesten Hooks/Karten des Zuges, damit
      // ein Hardcap den Verursacher gleich mitliefert (statt nur das
      // Opfer — das gecappte fn ist oft eine unschuldige Karte, deren
      // Gate-Rollouts in einen fremden Effektsturm laufen).
      try {
        const topOf = (obj) => Object.entries(obj || {})
          .sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([k, v]) => `${k}:${v}`).join(', ');
        console.error(`[CPU]    hardcap-diag turn=${engine.gs?.turn} hooksFired=${engine._hooksFiredThisTurn ?? '?'} snapshots=${engine._snapshotsThisTurn ?? '?'}`);
        console.error(`[CPU]    top hooks: ${topOf(engine._hookHistogramThisTurn)}`);
        console.error(`[CPU]    top firing cards: ${topOf(engine._hookFiresByCard)}`);
      } catch { /* Diagnose darf nie den Abbruchpfad stören */ }
      cpuLog(`      !! hardcap ${label}`);
      abandoned = true;
      try { if (engine.gs?.potionTargeting) engine.gs.potionTargeting = null; } catch {}
      return false;
    }
    throw err;
  } finally {
    clearTimeout(timerId);
    // KRITISCH: Beim Hardcap-Abbruch die Deadline NICHT restaurieren.
    // Der verlassene fn (Zombie) läuft im Hintergrund weiter und cancelt
    // sich nur über cpuPastDeadline-Checks selbst — ein blindes Restore
    // hier entwaffnete genau diesen Mechanismus: Der Zombie sah wieder
    // eine gültige (oder keine) Deadline, rechnete minutenlang weiter
    // und feuerte am Ende Zustandsübergänge (Cooldins advanceToPhase →
    // Zugende!) in einen längst weitergezogenen Spielzustand → Kollaps
    // der Turn-Loop → no-result. (Slip 'n Slide: 4 no-results in 6
    // Spielen, jedes exakt nach einem hero-effect-h0-Hardcap.)
    // Stattdessen: Deadline dauerhaft abgelaufen stehen lassen — der
    // Zombie cancelt an seinem nächsten Check; das nächste Gate setzt
    // ohnehin eine frische Deadline. Preis: bis dahin brechen auch
    // reguläre Deadline-Checks früh ab (leicht degradierte CPU-Qualität
    // direkt nach einem 30s-Hänger — akzeptabel).
    if (abandoned) {
      engine._cpuCardDeadline = Date.now() - 1;
    } else {
      engine._cpuCardDeadline = prevCardDeadline;
    }
  }
}

// ── Live event-loop yield ───────────────────────────────────────────
// CRITICAL for UX. MCTS rollouts run in fast mode, where engine._delay()
// resolves as a MICROtask (Promise.resolve()). Node drains the entire
// microtask queue before servicing any macrotask (HTTP request, socket
// event, timer), so a heavy CPU planning pass — hundreds of rollouts on
// a deck like Bloody King Zi — never lets the server process I/O. The
// game then appears completely frozen: the player can't surrender, a
// refresh does nothing, "as if the server was down", for the entire
// planning budget (up to MAX_CPU_TURN_MS).
//
// The fix: between rollouts at the LIVE rank-loop level (where gs is the
// real, snapshot-restored state — NOT mid-rollout), yield a real
// macrotask via setImmediate. Node then services any queued socket
// work (a surrender, a disconnect, a state request) before the next
// rollout. This does NOT change rollout determinism or game state
// (setImmediate mutates nothing) and does NOT relax any time/hook
// budget — those are wall-clock based and still bound total planning.
// Throttled by wall-clock so the added overhead is negligible (~one
// yield per YIELD_INTERVAL_MS) while still guaranteeing the server
// responds within ~that interval even while the CPU is "thinking".
const YIELD_INTERVAL_MS = 120;
let _lastEventLoopYieldT = 0;
async function maybeYieldEventLoop(engine) {
  // Never inside a rollout/sim: nested sim must stay atomic, and the
  // mctsRankCandidates loops this is called from are already live-only
  // (they bypass to heuristic when _inMctsSim). Defensive double-guard.
  if (engine?._inMctsSim) return;
  const now = Date.now();
  if (now - _lastEventLoopYieldT < YIELD_INTERVAL_MS) return;
  _lastEventLoopYieldT = now;
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * True when the CPU's current turn is gated by Flashbang — the first
 * Action they perform will end the turn immediately.
 *
 * The brain uses this to disincentivise inherent / additional / hero-
 * effect plays in Main Phase 1, saving the one available Action for
 * Action Phase (widest card pool, highest impact, "as late as
 * possible"). The flag is set on the affected player's state by
 * Flashbang's resolve(), persists through onTurnStart, and clears
 * either when an Action consumes the trigger or when the turn ends
 * unused.
 */
function isCpuFlashbanged(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  if (cpuIdx < 0) return false;
  return !!engine.gs.players[cpuIdx]?._flashbangedDebuff;
}

function broadcast(helpers) {
  for (let p = 0; p < 2; p++) helpers.sendGameState(helpers.room, p);
  if (helpers.sendSpectatorGameState) helpers.sendSpectatorGameState(helpers.room);
}

/**
 * Entry point. Called from the engine's _cpuDriver hook after the CPU's Start
 * and Resource phases have auto-advanced us into Main Phase 1.
 *
 * Phase sequence: Main1 → Action → Main2 → End.
 * advancePhase transitions one phase at a time, so skipping the Action Phase
 * still requires two calls (Main1→Action, then Action→Main2).
 */
// ═══════════════════════════════════════════════════════════════════
// BROTKRUME FUER DEN STILLEN ZUG-ABBRUCH (v386, 14.8.)
//
// Der CPU-Pilot hat dutzende Ausstiege der Form
//   if (!stillCpuTurn(engine, cpuIdx)) return;
// Jeder davon kehrt STILL zurueck. Passiert das in `runCpuTurn`, ohne
// dass der Zug beendet wurde, endet im Self-Play die ganze Kette:
// `startGame` loest ohne Ergebnis auf, der Messstand meldet
// `ohne-spielende` — und bisher stand nirgends, WELCHER Ausstieg es war.
//
// Die Marke kostet eine String-Zuweisung auf dem Ausstiegspfad und wird
// nur LIVE gesetzt (Rollouts betreten dieselben Funktionen und wuerden
// sie sonst ueberschreiben). `makeCpuDriver` liest sie nach der
// Rueckkehr aus, wenn der Zug noch offen steht.
function marke(engine, was) {
  if (engine && !engine._inMctsSim) engine._cpuTurnMark = was;
}

async function runCpuTurn(engine, helpers) {
  if (istAbgebrochen(engine)) return marke(engine, `aus:runCpuTurn#1:abbruch@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  // ── Board-Erweiterung JE BESCHWÖRUNG (Als Definition) ─────────────
  // Al: "Ein Check nach jeder einzelnen Beschwörung. Sind nach der
  // Beschwörung mehr Kreaturen on board als vorher? Dann zählt diese
  // eine Beschwörung als 'Hat das Board erweitert'."
  // Bewusst NICHT über den ganzen Zug bilanziert — Als Einwand: DDG
  // verringert die Körperzahl beim Ausspielen (2 Opfer für 1 Körper)
  // und ist trotzdem immer spielenswert. Eine Zugbilanz würde einen
  // guten DDG-Zug als Misserfolg werten.
  // Der Wrapper sitzt EINMAL auf helpers.doPlayCreature und deckt damit
  // alle fünf Aufrufer ab (Grant-Spender, Discard-sensitiv, Surprise,
  // Gratis-Pfad, Action Phase) statt fünf Einzelstellen zu pflegen.
  if (helpers && typeof helpers.doPlayCreature === 'function' && !helpers.__bodyCountWrapped) {
    const _origPlay = helpers.doPlayCreature;
    const _countBoard = (pi) => {
      let k = 0;
      try {
        const _p = engine.gs.players[pi];
        const _db = engine._getCardDB();
        for (let hi = 0; hi < (_p.heroes || []).length; hi++) {
          for (let z = 0; z < 3; z++) {
            const nm = ((_p.supportZones?.[hi] || [])[z] || [])[0];
            if (!nm) continue;
            const cd = _db[nm];
            if (cd && cd.cardType === 'Creature') k++;
          }
        }
      } catch { /* Telemetrie */ }
      return k;
    };
    helpers.doPlayCreature = async (room, pi, spec) => {
      const before = engine._inMctsSim ? 0 : _countBoard(pi);
      const res = await _origPlay(room, pi, spec);
      if (!engine._inMctsSim) {
        const after = _countBoard(pi);
        if (after > before) {
          swapDiag(engine, 'body:beschwoerung-erweitert');
          if (pi === engine._cpuPlayerIdx) {
            engine._bodyExpandThisTurn = (engine._bodyExpandThisTurn || 0) + 1;
          }
        } else if (after === before) swapDiag(engine, 'body:beschwoerung-neutral');
        else swapDiag(engine, 'body:beschwoerung-kostet');
      }
      return res;
    };
    helpers.__bodyCountWrapped = true;
  }
  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#2:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  if (typeof engine._trailWrite === 'function') {
    // Log the full hand contents (not just the size) so post-mortem
    // analysis can diff hand_at_turn_N vs hand_at_turn_M and see
    // whether specific cards (e.g. Summoning Magic) are sitting in
    // hand for many turns instead of being attached/played. Joined
    // with " | " so the log line stays single-line readable.
    const handDump = (ps.hand || []).join(' | ') || '(empty)';
    engine._trailWrite('cpuTurnStart', {
      note: `cpu=p${cpuIdx} hand=${ps.hand.length} cards=[${handDump}]`,
    });
  }
  // Stash helpers on the engine so card-script-level MCTS picks
  // (mctsPickFromOptions, …) can reuse them for rollouts without
  // re-plumbing helper construction.
  engine._cpuHelpers = helpers;

  const turnStartT = Date.now();
  // Deadline applies to LIVE turns only — nested rollouts re-enter
  // runCpuTurn with `_inMctsSim` set; cpuPastDeadline returns false in
  // that case so the existing per-decision MCTS budget remains the only
  // cost cap inside rollouts.
  if (!engine._inMctsSim) {
    engine._cpuTurnDeadline = turnStartT + MAX_CPU_TURN_MS;
    // ── Standing-Stempel (Comeback-Kanal) ────────────────────────────
    // Einmal pro LIVE-Zug: eigene Lage per evaluateState-Differenz
    // bucketen (behind/even/ahead, Schwelle aus dem Profil — dieselbe
    // Metrik wie die evalCurve im Training). learnedCardValue liest nur
    // diesen Stempel (nie selbst evaluieren — es läuft INNERHALB von
    // evaluateState, das wäre Rekursion). Der Stempel gilt für den
    // ganzen Zug inkl. aller Rollouts: "Lage bei Entscheidungsbeginn".
    try {
      const ev = typeof engine._cpuEvaluateState === 'function'
        ? engine._cpuEvaluateState(cpuIdx) : null;
      engine._standingBucket = {
        turn: gs.turn, pi: cpuIdx,
        bucket: deckProfile.standingBucketFromEval(engine, cpuIdx, ev),
      };
    } catch { engine._standingBucket = null; }
    // DEBUG: force-add Yeeting on the CPU's 2nd LIVE turn. Live-only so
    // nested-rollout re-entries don't double-stamp. Tracked on the engine
    // (not the player state) so snapshot/restore inside MCTS doesn't
    // reset the counter and re-fire the add.
    const _forceCard = process.env.PP_DEBUG_FORCE_CARD
      || (DEBUG_FORCE_YEETING_ON_CPU_TURN_2 ? 'The Yeeting' : null);
    if (_forceCard) {
      engine._debugCpuTurnsTaken = (engine._debugCpuTurnsTaken || 0) + 1;
      if (engine._debugCpuTurnsTaken === 2 && !ps.hand.includes(_forceCard)) {
        ps.hand.push(_forceCard);
        try { engine._trackCard(_forceCard, cpuIdx, 'hand'); } catch {}
        cpuLog(`[DEBUG] force-added "${_forceCard}" to CPU hand (CPU turn #2)`);
        engine.sync();
      }
      // PP_DEBUG_SCENARIO: kommaseparierte Test-Szenarien, angewandt im
      // selben Moment wie die Force-Karte (CPU-Zug 2, live). Für Audits
      // von Karten, deren Bedingungen "natürlich" selten eintreten.
      //   summonLv3 — Held 0 bekommt Summoning Magic Lv3
      //   status    — Held 0 bekommt 2 alte Poison-Stacks (appliedTurn -2)
      //   gold      — CPU-Gold auf 30
      if (engine._debugCpuTurnsTaken === 2 && process.env.PP_DEBUG_SCENARIO) {
        const scen = process.env.PP_DEBUG_SCENARIO.split(',');
        if (scen.includes('summonLv3')) {
          ps.abilityZones = ps.abilityZones || [];
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue;
            ps.abilityZones[hi] = ps.abilityZones[hi] || [];
            ps.abilityZones[hi][0] = ['Summoning Magic', 'Summoning Magic', 'Summoning Magic'];
          }
          cpuLog('[DEBUG] Szenario summonLv3: ALLE Helden → Summoning Magic Lv3');
        }
        if (scen.includes('status')) {
          const h0 = ps.heroes?.[0];
          if (h0?.name) {
            h0.statuses = h0.statuses || {};
            h0.statuses.poisoned = { stacks: 2, appliedTurn: Math.max(1, gs.turn - 2) };
            cpuLog('[DEBUG] Szenario status: Held 0 → 2 alte Poison-Stacks');
          }
        }
        if (scen.includes('gold')) { ps.gold = 30; cpuLog('[DEBUG] Szenario gold: 30'); }
        // school:NAME:LEVEL — beliebige Schule/Ability auf allen Helden
        for (const sc of scen) {
          const m = sc.match(/^school:(.+):(\d+)$/);
          if (!m) continue;
          ps.abilityZones = ps.abilityZones || [];
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue;
            ps.abilityZones[hi] = ps.abilityZones[hi] || [];
            ps.abilityZones[hi][1] = Array(parseInt(m[2], 10)).fill(m[1]);
          }
          cpuLog(`[DEBUG] Szenario school: alle Helden → ${m[1]} Lv${m[2]}`);
        }
        engine.sync();
      }
    }
  }
  cpuLog(`===== TURN START turn=${gs.turn} phase=${gs.currentPhase} hand=${ps.hand.length} gold=${ps.gold} fast=${!!engine._fastMode} =====`);
  cpuLog('hand:', ps.hand);

  cpuLog('→ Main Phase 1');
  await runMainPhase(engine, helpers);
  cpuLog('← Main Phase 1 done');

  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#3:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  await pausePhase(engine);
  cpuLog(`advancePhase Main1→Action`);
  await engine.advancePhase(cpuIdx);
  broadcast(helpers);

  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#4:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  cpuLog(`→ Action Phase (currentPhase=${gs.currentPhase})`);
  await runActionPhase(engine, helpers);

  // Combo continuation: keep firing Action-Phase plays while the engine
  // still owes the CPU another action this phase — either a Ghuanjun-
  // style bonus action (ps.bonusActions.remaining) OR a second-action
  // grant (Giga Steroids' isSecondActionGrant additional-action
  // provider, redeemable only as action 2 on an effect activation like
  // Adventurousness). Previously only bonusActions was checked, so
  // after the CPU spent action 1 (e.g. Zi's hero effect) the Giga
  // Steroids grant was abandoned and the phase force-advanced without
  // ever using the second Action. Progress is detected via
  // runActionPhase's own return value (an effect activation claims a
  // HOPT but does NOT shrink the hand, so the old hand-shrink check
  // wrongly stopped here). Stop when a pass performs no action, the
  // phase advances, or the safety cap trips.
  let comboSafety = 8;
  while (stillCpuTurn(engine, cpuIdx)
         && engine.gs.currentPhase === 3
         && comboSafety-- > 0
         && (((gs.players[cpuIdx]?.bonusActions?.remaining || 0) > 0)
             || hasSpendableSecondActionGrant(engine, cpuIdx))) {
    const bonus = gs.players[cpuIdx]?.bonusActions?.remaining || 0;
    cpuLog(`→ Action Phase (combo follow-up) bonus=${bonus} secondActionGrant=${hasSpendableSecondActionGrant(engine, cpuIdx)}`);
    const did = await runActionPhase(engine, helpers);
    if (!did) {
      cpuLog('  (combo follow-up performed no action — stopping loop)');
      break;
    }
  }

  // ── H2 (Vergleichsanalyse): unverbrauchte Summon-Grants hart
  // ausgeben. Al bestätigt Primordiums Extra-Beschwörung in 100% der
  // Fälle (5-6×/Spiel, nie abgelehnt); die CPU ließ 26% verfallen —
  // teils weil die Combo-Schleife den Grant-Typ nicht kannte, teils
  // weil die Wert-Schwelle Floor-8-Enabler trotz Gratis-Aktion liegen
  // ließ. Der Grant verfällt am Zugende; ihn zu verschenken ist
  // praktisch nie richtig (Tempo + Siphem/Teppes-Nebenerträge + H1-
  // Swap-Präferenz im Slot-Picker greifen zusammen).
  let grantSafety = 4;
  while (stillCpuTurn(engine, cpuIdx)
         && engine.gs.currentPhase === 3
         && grantSafety-- > 0) {
    const spend = findSpendableSummonGrantPlay(engine, cpuIdx);
    // (E2) Findet der v51-Spender einen ausgebbaren Grant? Trennt
    // "kein Grant/kein Play möglich" von "gefunden, aber gescheitert".
    swapDiag(engine, spend ? 'grant:spender-findet' : 'grant:spender-leer');
    if (!spend) break;
    cpuLog(`→ Summon-Grant-Spender: ${spend.cardName} → Held ${spend.heroIdx}, Slot ${spend.zoneSlot}`);
    try {
      await helpers.doPlayCreature(helpers.room, cpuIdx, spend);
    } catch (err) {
      cpuLog(`  (Grant-Spender-Play fehlgeschlagen: ${err.message} — Abbruch)`);
      break;
    }
    broadcast(helpers);
  }

  cpuLog(`← Action Phase done (currentPhase=${engine.gs.currentPhase})`);
  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#5:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  // Force-advance if still in Action Phase (no play, or combo ended with the
  // gate held open for a fraction of a frame).
  if (engine.gs.currentPhase === 3) {
    await pausePhase(engine);
    cpuLog('advancePhase Action→Main2 (phase still open)');
    await engine.advancePhase(cpuIdx);
    broadcast(helpers);
  }

  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#6:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  cpuLog(`→ Main Phase 2 (currentPhase=${gs.currentPhase})`);
  await runMainPhase(engine, helpers);
  cpuLog('← Main Phase 2 done');

  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#7:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  // ── Ascension-Zyklus (5.8., Als Morph-and-Kill-Befund) ─────────────
  // Früher: EIN tryAscend, danach immer advancePhase → der Zug war
  // vorbei. Für Formen mit `blockEndPhaseOnAscend` ("Ascending this
  // Hero does not end your turn") war das nachweislich falsch — der
  // ganze Zweck des Aufstiegs (Karten, die einen Ascended Hero
  // VORAUSSETZEN, die Effekte der neuen Form, der Descend-Zyklus)
  // fiel damit strukturell aus. `performAscension` liefert die
  // Auskunft längst als `skipEndPhase`; server.js wertet sie aus,
  // nur der Pilot warf sie weg.
  //
  // Jetzt: aufsteigen → wenn der Zug weiterläuft, Main Phase 2 erneut
  // durchlaufen (die neu freigeschalteten Plays einsammeln) → erneut
  // prüfen. Formen OHNE den Vertrag (Beato, Arthor, Layn) verhalten
  // sich exakt wie bisher: erster Aufstieg, dann Zugende.
  let ascendedAny = false;
  let ascendEndedTurn = false;
  for (let ascPass = 0; ascPass < MAX_ASCENSIONS_PER_TURN; ascPass++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#8:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    if (engine.gs.currentPhase !== PHASES.MAIN2) break;
    cpuLog(`→ tryAscend (Durchgang ${ascPass + 1})`);
    const asc = await tryAscend(engine, helpers, { firstOfTurn: ascPass === 0 });
    cpuLog(`← tryAscend done (ascended=${asc.ascended}, endsTurn=${asc.endsTurn})`);
    if (!asc.ascended) break;
    ascendedAny = true;
    if (asc.endsTurn) { ascendEndedTurn = true; break; }
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#9:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    // Der Zug läuft weiter — genau hier liegt der Gewinn: Karten mit
    // "only while you control an Ascended Hero" / "can only be used by
    // an Ascended Hero" sind ab jetzt spielbar, die neue Form hat ihren
    // eigenen Helden-Effekt (Descend, Deep-Drowned-Overcharge), und der
    // Descend legt Counter für den nächsten Aufstieg nach.
    cpuLog('→ Main Phase 2 (nach Ascension, neu freigeschaltete Plays)');
    await runMainPhase(engine, helpers);
    cpuLog('← Main Phase 2 (nach Ascension) done');
  }
  if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:runCpuTurn#10:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  // ── Zugende-Stempel: in welcher Form endet der Zug? ────────────────
  // Als Vorgabe: "eine HOHE Belohnung dafuer, nicht in der Base-Form den
  // Zug zu beenden". Der Stempel liefert dem Trainer die Bezugsgroesse
  // dafuer — Basisform ja/nein, Zaehlerstand, und ob ein Aufstieg in
  // diesem Moment noch bezahlbar GEWESEN waere (ohne das waere "endete
  // in der Basisform" nicht von "hatte nie die Wahl" zu unterscheiden).
  // Steht VOR allen Rueckgabepfaden des Zugendes, damit auch der
  // zug-beendende Aufstieg gestempelt wird.
  try {
    if (!engine._inMctsSim) {
      const ft = deckProfile.classifyFormTurn(engine, cpuIdx);
      if (ft) {
        if (!engine._formTurnLog) engine._formTurnLog = [];
        engine._formTurnLog.push({ pi: cpuIdx, ...ft });
        swapDiag(engine, ft.asc ? 'form:zugende-ascended'
          : (ft.ca ? 'form:zugende-basis-trotz-moeglich' : 'form:zugende-basis'));
      }
    }
  } catch { /* Telemetrie */ }
  if (ascendedAny && engine.gs.currentPhase !== PHASES.MAIN2) {
    // Eine zug-beendende Form hat den Aufstieg gemacht und die Engine
    // ist schon weiter — nichts mehr zu tun.
    return marke(engine, `ok:aufstieg-beendete-zug@ph${engine.gs.currentPhase}`);
  }
  if (ascendEndedTurn) {
    // performAscension meldete skipEndPhase:true (Alt-Verhalten). Self-
    // play muss die Phase selbst weiterschalten; ohne das hängt die
    // Kette in Main Phase 2, startGame löst ohne Sieger auf und wir
    // bekommen ein no-result (der Butterflies-Unentschieden-Cluster).
    if (engine.gs.currentPhase === PHASES.MAIN2 && !engine.gs.result) {
      await engine.advancePhase(cpuIdx);
      broadcast(helpers);
    }
    return marke(engine, `ok:aufstieg-skipEndPhase@ph${engine.gs.currentPhase}`);
  }

  await pausePhase(engine);
  // ── Board-Erweiterungen des Zuges festhalten (Als Definition) ────
  // Gezählt wurde JE BESCHWÖRUNG im Wrapper unten; hier nur noch die
  // Summe des Zuges in Klassen. Al: "Pro Runde MUSS mindestens ein
  // Wert von 1 bestehen, besser 2 oder mehr."
  try {
    if (!engine._inMctsSim && typeof engine._bodyExpandThisTurn === 'number') {
      const e = engine._bodyExpandThisTurn;
      swapDiag(engine, `body:erweitert-im-zug:${e >= 3 ? '3plus' : String(e)}`);
      swapDiag(engine, e >= 1 ? 'body:zug-ok' : 'body:zug-verfehlt');
      engine._bodyExpandThisTurn = undefined;
    }
  } catch { /* Telemetrie */ }
  // PP_DECK_MONITOR=1: Ressourcen-Telemetrie am Zugende (Deck-Tuning).
  // Loggt Gold, Handgröße, Zauber in Hand und davon aktuell
  // unspielbare (kein Held erfüllt Level/Zonen-Anforderung bzw.
  // Artifact unbezahlbar).
  if (process.env.PP_DECK_MONITOR === '1' && !engine._inMctsSim) {
    try {
      const _ps = engine.gs.players[cpuIdx];
      const _db = engine._getCardDB();
      let _spells = 0, _unplayable = 0, _artifacts = 0;
      for (const n of (_ps.hand || [])) {
        const cd = _db[n];
        if (!cd) continue;
        if (cd.cardType === 'Spell' || cd.cardType === 'Attack') {
          _spells++;
          if (listEligibleHeroesForActionCard(engine, cpuIdx, cd).length === 0) _unplayable++;
        } else if (cd.cardType === 'Artifact') {
          _artifacts++;
          if ((Number(cd.cost) || 0) > (_ps.gold || 0)) _unplayable++;
        }
      }
      try {
        const _hp = (q) => (engine.gs.players[q]?.heroes || []).map(h => h ? (h.hp + (h.defeated ? '†' : '')) : '—').join(',');
        console.log(`[HPLOG] turn=${engine.gs.turn} p0=[${_hp(0)}] p1=[${_hp(1)}]`);
      } catch {}
      console.log(`[MONITOR-HAND] mid=${(_ps.heroes?.[1]?.name || "").slice(0, 4)} cards=${(_ps.hand || []).join("|")}`);
      console.log(`[MONITOR] mid=${(_ps.heroes?.[1]?.name || "").slice(0, 4)} pi=${cpuIdx} turn=${engine.gs.turn} gold=${_ps.gold} hand=${(_ps.hand || []).length} spells=${_spells} artifacts=${_artifacts} unplayable=${_unplayable}`);
    } catch {}
  }
  cpuLog(`advancePhase Main2→End`);
  await engine.advancePhase(cpuIdx);
  broadcast(helpers);
  marke(engine, `ok:zugende@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  cpuLog(`===== TURN END (${Date.now() - turnStartT}ms) =====`);
}

// ─── Action Phase ──────────────────────────────────────────────────────
// Per user spec: "the CPU will go into the Action Phase only once it cannot
// do anything in Main 1 anymore. It will then use the highest-level
// Creature > Spell > Attack in its hand that it can use (Creature has highest
// prio, Attack lowest, but higher level trumps type priority)."

// True when the engine still owes `pi` a SECOND-action grant this
// Action Phase that can be spent on an effect activation (Giga
// Steroids' owner-wide `ability_activation` grant; also any hero-
// restricted second-action grant). `findAdditionalActionForCategory`
// already applies `_isSecondActionGrantAvailable` (the grant only
// redeems as the actual 2nd action), so a truthy result means "there
// is an additional action the CPU may still take right now". Giga
// Steroids is `heroRestricted:false` → matches the heroIdx=-1 probe;
// the per-hero probes cover hero-restricted variants.
function hasSpendableSecondActionGrant(engine, pi) {
  if (typeof engine.findAdditionalActionForCategory !== 'function') return false;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;
  if (engine.findAdditionalActionForCategory(pi, 'ability_activation', -1)) return true;
  const heroes = ps.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const h = heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (engine.findAdditionalActionForCategory(pi, 'ability_activation', hi)) return true;
  }
  return false;
}

async function runActionPhase(engine, helpers) {
  if (istAbgebrochen(engine)) return marke(engine, `aus:runActionPhase#1:abbruch@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Build candidate list: every (cardName, handIdx, heroIdx) that is a legal
  // Action-Phase play right now (Spell/Attack/Creature with a hero able to
  // cast it — including for Creatures, a free Support Zone). `let` not
  // `const` because mctsRankCandidates returns a re-sorted array we assign
  // back for the subsequent try-in-order loop.
  let candidates = [];
  const typePriority = { Creature: 3, Spell: 2, Attack: 1 };
  for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
    const cardName = ps.hand[handIdx];
    const cd = cardDB[cardName];
    if (!cd || typePriority[cd.cardType] == null) continue;
    // Surprise cards (regardless of cardType) must be SET face-down in
    // surprise zones, not played as a regular Spell/Attack/Creature.
    // placeSurprises() handles them from the Main Phase. Including them
    // here would let the CPU waste-cast Booby Trap (no effect) or play
    // Pure Advantage Camel / Cactus Creature as a regular creature.
    const _trace = process.env.PP_DEBUG_FORCE_CARD === cardName && !engine._inMctsSim;
    if ((cd.subtype || '').toLowerCase() === 'surprise') { if (_trace) cpuLog(`[trace] ${cardName}: FILTER subtype=surprise`); continue; }
    // Same Reaction-only opt-out as fireAdditionalActions.
    const script = loadCardEffect(cardName);
    if (script?.cpuSkipProactive) { if (_trace) cpuLog(`[trace] ${cardName}: FILTER cpuSkipProactive`); continue; }
    if (!isFirstTurnSafe(engine, cpuIdx, cardName, cd)) { if (_trace) cpuLog(`[trace] ${cardName}: FILTER isFirstTurnSafe`); continue; }
    // Per user spec: if this is an Attack/Spell whose enemy-side targets are
    // ALL immune right now, don't even consider it — better to skip the
    // action entirely than waste a card on an immune target. Creatures are
    // exempt (the body still lands even if their onPlay fizzles).
    if (!cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cd)) { if (_trace) cpuLog(`[trace] ${cardName}: FILTER cardHasAnyViableEnemyTarget`); continue; }

    // Enumerate one candidate per eligible hero — MCTS evaluates hero
    // assignment as a decision dimension instead of collapsing to the
    // heuristic-picked hero. If no hero is eligible, skip the card.
    const eligible = listEligibleHeroesForActionCard(engine, cpuIdx, cd);
    if (!eligible.length) { if (_trace) cpuLog(`[trace] ${cardName}: FILTER keine eligible Heroes`); continue; }
    if (_trace) cpuLog(`[trace] ${cardName}: KANDIDAT (heroes=${eligible.map(e=>e.hi).join(',')})`);

    // For Creatures: always route to the hero with the LOWEST matching
    // spell-school level among eligible heroes (tightest-fit rule —
    // Lv0 creature goes on a Lv0 hero before a Lv2 hero, saving the
    // higher-level slot for a higher-level summon later). Enumerate
    // candidates only for that single hero's free zones so MCTS can't
    // drift onto a higher-level hero by accident.
    let heroPool;
    if (cd.cardType === 'Creature') {
      const lowHi = pickHeroForActionCard(engine, cpuIdx, cd, cardName);
      heroPool = (lowHi >= 0) ? eligible.filter(e => e.hi === lowHi) : eligible;
    } else if (cd.cardType === 'Attack') {
      // Sort by current atk stat DESC. Most Attack cards scale damage
      // with the caster's atk; with the rollout count this brain runs
      // on (3 per candidate), two same-card / different-caster
      // candidates routinely fall inside statistical noise of each
      // other and the input order decides via stable sort. Putting the
      // bigger stick first means a noisy tie correctly resolves toward
      // the higher-atk hero. MCTS still gets to override when a
      // lower-atk hero has a synergy that actually beats raw damage.
      heroPool = [...eligible].sort((a, b) =>
        (ps.heroes[b.hi]?.atk || 0) - (ps.heroes[a.hi]?.atk || 0));
    } else {
      heroPool = eligible;
    }

    for (const e of heroPool) {
      const heroIdx = e.hi;
      const v = engine.validateActionPlay(cpuIdx, cardName, handIdx, heroIdx, [cd.cardType]);
      if (!v) continue;
      if (!v.isActionPhase) continue;
      // Inherent additional Action cards (Divine Gift of Sacrifice, etc.)
      // are designed to be played in MAIN PHASE on top of the regular
      // Action Phase action — they're "additional" by intent. The engine
      // currently still consumes the Action-Phase action slot when one
      // is played at phase 3, so enumerating them here makes the CPU
      // burn its real action on a card that should have been free. Defer
      // them entirely to fireAdditionalActions in Main Phase.
      if (v.isInherentAction) continue;
      // ── Karten-Vertrag cpuPlayVeto ──
      // Kartenlokale "dieser Play ist gerade nutzlos"-Prüfung (z. B.
      // Heal ohne verletztes Ziel, ohne Nao-Overheal und ohne
      // healReversed-Gegner). Eval-Rauschen im MCTS lässt Nutzlos-Plays
      // sonst gelegentlich über den Pass-Vergleich rutschen — der Veto
      // nimmt sie aus der Enumeration. additional:false = regulärer
      // Action-Play (Friendships Draw-Rider zählt hier NICHT, der
      // hängt am Additional-Action-Grant).
      {
        const _vsc = loadCardEffect(cardName);
        if (typeof _vsc?.cpuPlayVeto === 'function') {
          let _veto = false;
          try { _veto = !!_vsc.cpuPlayVeto(engine, cpuIdx, heroIdx, { additional: false }); }
          catch { _veto = false; }
          if (_veto) continue;
        }
      }
      // `casterAtk` is the casting hero's CURRENT atk stat — used by the
      // candidate-ranking tiebreak so Attack candidates that score
      // similarly under MCTS deterministically resolve to the higher-
      // atk caster. Stamped on every candidate (cheap, ignored for
      // non-Attack types in the tiebreak path).
      const casterAtk = ps.heroes[heroIdx]?.atk || 0;
      // For Creatures, enumerate one candidate per free support-zone slot so
      // MCTS evaluates zone placement (adjacency effects, Slippery-Skates /
      // Cool-Fridge positioning, etc.) as a first-class decision. For Spells/
      // Attacks there's no zone choice — emit a single candidate.
      if (cd.cardType === 'Creature') {
        const ps2 = engine.gs.players[cpuIdx];
        const zones = ps2.supportZones?.[heroIdx] || [[], [], []];
        for (let z = 0; z < zones.length; z++) {
          if ((zones[z] || []).length !== 0) continue;
          candidates.push({
            cardName, handIdx, heroIdx, zoneSlot: z,
            cardType: cd.cardType,
            level: cd.level || 0,
            typeScore: typePriority[cd.cardType],
            casterAtk,
          });
        }
      } else {
        candidates.push({
          cardName, handIdx, heroIdx,
          cardType: cd.cardType,
          level: cd.level || 0,
          typeScore: typePriority[cd.cardType],
          casterAtk,
        });
      }
    }
  }

  // ── Action-costing Ability activations as first-class candidates ──
  // Adventurousness, and any other Ability with `actionCost: true +
  // onActivate`, consumes the turn's Action just like a Spell/Attack/
  // Creature play from hand. Without these in the candidate list, the
  // CPU skips its Action Phase whenever the hand has no playable card —
  // even if Adventurousness could generate 20+ gold. HOPT is per-player-
  // per-ability-name, so we emit ONE candidate per ability name, picking
  // the highest-level-hero copy (Adventurousness scales with level).
  const actionAbilityBest = new Map();
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const zones = ps.abilityZones?.[hi] || [];
    for (let zi = 0; zi < zones.length; zi++) {
      const slot = zones[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) continue;
      const hoptKey = `ability-action:${abilityName}:${cpuIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      if (script.canActivateAction && !script.canActivateAction(gs, cpuIdx, hi, slot.length, engine)) continue;
      const prev = actionAbilityBest.get(abilityName);
      if (!prev || slot.length > prev.level) {
        actionAbilityBest.set(abilityName, { heroIdx: hi, zoneIdx: zi, level: slot.length });
      }
    }
  }
  for (const [abilityName, best] of actionAbilityBest) {
    candidates.push({
      cardType: 'AbilityAction',
      cardName: abilityName,
      abilityName,
      heroIdx: best.heroIdx,
      zoneIdx: best.zoneIdx,
      level: best.level,
      typeScore: 0,
    });
  }

  // ── Hero-Effect Action activations as first-class candidates ──────
  // Heroes whose script declares `heroEffectActionCost: true`
  // (Champion, the Stormbringer, …) can be activated as the player's
  // Action — same resource budget as a Spell/Attack/Creature play.
  // Without these as candidates the CPU never fires Champion's effect
  // because nothing else proposes it during Action Phase, and the
  // free-effect path (`activateHeroEffects`) skips action-cost effects
  // entirely (those need an additional-action provider in Main Phase
  // and the CPU rarely has one).
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    if (hero._actionLockedTurn === gs.turn) continue;
    const script = loadCardEffect(hero.name);
    if (!script?.heroEffectActionCost || !script?.heroEffect || !script?.onHeroEffect) continue;
    const hoptKey = `hero-effect:${hero.name}:${cpuIdx}:${hi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
    if (script.canActivateHeroEffect) {
      try {
        const inst = engine.cardInstances.find(c =>
          c.owner === cpuIdx && c.zone === 'hero' && c.heroIdx === hi);
        if (!inst) continue;
        const ctx = engine._createContext(inst, { event: 'canHeroEffectCheck' });
        if (!script.canActivateHeroEffect(ctx)) continue;
      } catch (e) {
        continue;
      }
    }
    candidates.push({
      cardType: 'HeroEffectAction',
      cardName: hero.name,
      heroIdx:  hi,
      level:    0,
      typeScore: 0,
    });
  }

  cpuLog(`  Action Phase candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    const picked = await tryActionCostingAbility(engine, helpers);
    if (picked) return true;
    return false;
  }

  // Rank candidates. MCTS evaluates each via rollout (snapshot → apply →
  // play rest of turn → evaluate → restore, averaged over N trials) AND
  // enumerates target-prompt alternatives within each rollout. Combo
  // continuation (Ghuanjun bonus actions) skips MCTS — each re-run pays
  // its full cost and attacks are simple enough to rank by level and
  // type without rollouts.
  const inBonusAction = (ps.bonusActions?.remaining || 0) > 0;
  if (MCTS_ENABLED && candidates.length > 0 && !inBonusAction) {
    candidates = await mctsRankCandidates(engine, helpers, candidates);
  } else {
    candidates.sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
  }

  // Ascension hard-priority: if the CPU has an unfulfilled Ascended Hero
  // and any candidate would directly progress the Ascension condition
  // (Beato casting a Spell / summoning a Creature of an uncollected
  // school, etc.), float ALL such candidates to the front — even over a
  // higher-MCTS-scoring alternative. Matches the spec: "fulfilling the
  // Ascension condition should be the AI's number-one priority." Relative
  // order within each bucket preserves the MCTS ranking, so the best
  // progresser is tried first and non-progressers remain ordered as a
  // fallback chain if the progressers can't resolve for some reason.
  if (playerHasUnfulfilledAscension(engine, cpuIdx)) {
    const progressers = [];
    const others = [];
    for (const c of candidates) {
      if (candidateProgressesAscension(engine, cpuIdx, c, cardDB)) progressers.push(c);
      else others.push(c);
    }
    if (progressers.length > 0) {
      cpuLog(`  [Ascension] ${progressers.length} candidate(s) progress Ascension — floating to front`);
      candidates = [...progressers, ...others];
    }
  }

  // ε-Exploration mit Defizit-Trigger. Basis: mit Wahrscheinlichkeit ε
  // den Novelty-Kandidaten (wenigste bisherige Versuche, historisch
  // geseedet) an die Spitze ziehen. Verstärkung: Enthält die Liste
  // einen MASSIV unter-explorierten Kandidaten (≤ max(2, 5 % des
  // Maximums) bei etablierten Zählern), steigt die Wahrscheinlichkeit
  // auf min(0.5, 3ε) — sonst verpufft das ε-Budget in den vielen
  // Phasen, in denen ohnehin nur gut erforschte Karten zur Wahl stehen,
  // während die seltene Phase mit The-Cosmic-Depths-in-Hand ungenutzt
  // vorbeizieht (empirisch: 4 % Spielabdeckung ohne Boost).
  if (candidates.length > 1 && EXPLORE_EPS && !engine._inMctsSim
      && engine._isSelfPlay && process.env.PP_TRAIN_EVAL !== '1') {
    let minSeen = Infinity, maxSeen = 0;
    for (const c of candidates) {
      const seen = _exploreAttempts.get(c.cardName) || 0;
      if (seen < minSeen) minSeen = seen;
      if (seen > maxSeen) maxSeen = seen;
    }
    const deficit = maxSeen >= 20 && minSeen <= Math.max(2, Math.floor(maxSeen * 0.05));
    const p = deficit ? Math.min(0.5, EXPLORE_EPS * 3) : EXPLORE_EPS;
    if (Math.random() < p) {
      const novel = pickNoveltyCandidate(candidates);
      const ri = candidates.indexOf(novel);
      if (ri > 0) {
        candidates.splice(ri, 1);
        candidates.unshift(novel);
      }
      cpuLog(`  [explore] Action Phase: Novelty-Kandidat "${candidates[0].cardName}" (${_exploreAttempts.get(candidates[0].cardName) || 0} Versuche${deficit ? ', Defizit-Boost' : ''}) an die Spitze (ε=${EXPLORE_EPS})`);
    }
  }

  // Design-Regel (Al): Eine verfügbare Aktion soll, sofern irgendein
  // Kandidat spielbar ist, IMMER genutzt werden — sie verfallen zu
  // lassen ist praktisch nie richtig. Deshalb greift der Deadline-Bail
  // erst NACH dem ersten Play-Versuch: Wenn das (mit Profilen teurere)
  // Kandidaten-Ranking das Zug-Budget aufgefressen hat, wird der
  // Top-Kandidat trotzdem noch direkt gespielt (der Play selbst ist
  // billig — teuer war nur die Bewertung).
  let attemptedAny = false;
  for (const pick of candidates) {
    if (!stillCpuTurn(engine, cpuIdx)) return false;
    if (cpuPastDeadline(engine) && attemptedAny) {
      cpuLog(`  Action Phase: turn deadline hit — bailing (nach ${attemptedAny ? 'mind. einem' : 'keinem'} Versuch)`);
      return false;
    }
    attemptedAny = true;
    if (engine.gs.currentPhase !== 3) {
      cpuLog(`  Action Phase: currentPhase=${engine.gs.currentPhase}, early-exit`);
      return true;
    }

    const handLenBefore = ps.hand.length;
    let abilityHoptKey = null;
    if (pick.cardType === 'AbilityAction') {
      abilityHoptKey = `ability-action:${pick.abilityName}:${cpuIdx}`;
    } else if (pick.cardType === 'HeroEffectAction') {
      abilityHoptKey = `hero-effect:${pick.cardName}:${cpuIdx}:${pick.heroIdx}`;
    }
    const hoptBefore = abilityHoptKey ? gs.hoptUsed?.[abilityHoptKey] : null;
    cpuLog(`    → Action Phase try: ${pick.cardType} "${pick.cardName}" (lvl ${pick.level}) hero=${pick.heroIdx}${pick.scriptedTargetPlan ? ' [scripted targets]' : ''}`);
    noteExploreAttempt(engine, pick.cardName);
    await pausePhase(engine);
    // If MCTS found a better target plan than the heuristic, inject it so the
    // real play follows it. The promptEffectTarget override consumes entries
    // one-by-one and falls through to heuristics for null/invalid slots.
    const hadPlan = Array.isArray(pick.scriptedTargetPlan) && pick.scriptedTargetPlan.length > 0;
    if (hadPlan) engine._mctsTargetPlan = [...pick.scriptedTargetPlan];
    // Wrap the LIVE play in the per-card hardcap so a hung resolution
    // (e.g. nested mctsPickFromOptions in a card's cpuResponse that never
    // yields) can't freeze the Action Phase. Skipped inside MCTS sims —
    // those inherit the outer LIVE call's deadline.
    let skipCreatureForNoSlot = false;
    const actionFn = async () => {
      if (pick.cardType === 'AbilityAction') {
        await helpers.doActivateAbility(helpers.room, cpuIdx, {
          heroIdx: pick.heroIdx,
          zoneIdx: pick.zoneIdx,
        });
      } else if (pick.cardType === 'HeroEffectAction') {
        await helpers.doActivateHeroEffect(helpers.room, cpuIdx, {
          heroIdx: pick.heroIdx,
        });
      } else if (pick.cardType === 'Creature') {
        let zoneSlot = pick.zoneSlot;
        const ps3 = engine.gs.players[cpuIdx];
        const slotTaken = zoneSlot != null
          && (((ps3.supportZones?.[pick.heroIdx] || [])[zoneSlot] || []).length > 0);
        if (zoneSlot == null || zoneSlot < 0 || slotTaken) {
          zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, pick.heroIdx, pick.cardName);
        }
        if (zoneSlot < 0) { skipCreatureForNoSlot = true; return; }
        maybeSetCrossSideHint(engine, cpuIdx, pick.cardName);
        await helpers.doPlayCreature(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot,
        });
      } else {
        noteDamageImpact(engine, cpuIdx, pick.cardName);
        await helpers.doPlaySpell(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
        });
      }
    };
    try {
      if (engine._inMctsSim) {
        await actionFn();
      } else {
        await _runWithCardHardcap(engine, `action-phase ${pick.cardType} ${pick.cardName}`, actionFn);
      }
    } finally {
      if (hadPlan) delete engine._mctsTargetPlan;
    }
    if (skipCreatureForNoSlot) { cpuLog(`    ← no free slot for creature`); continue; }

    // The play handler fully unwound (resolution locks released) → run
    // any reaction-deferred actions (e.g. a human Lunar Eclipse that
    // negated this CPU card grants the CPU a replacement Action).
    // Self-gated, so it no-ops unless the board is actually idle.
    await engine._runPostChainActions();

    const shrank = ps.hand.length < handLenBefore;
    const phaseChanged = engine.gs.currentPhase !== 3;
    const hoptClaimed = abilityHoptKey
      && gs.hoptUsed?.[abilityHoptKey] === gs.turn
      && hoptBefore !== gs.turn;
    cpuLog(`    ← Action Phase result: shrank=${shrank} phaseChanged=${phaseChanged}${hoptClaimed ? ' hoptClaimed=true' : ''} newPhase=${engine.gs.currentPhase}`);
    if (shrank || phaseChanged || hoptClaimed) return true;
    // ── Warum ist NICHTS passiert? ────────────────────────────────────
    // Ein Versuch ohne jede Wirkung ist bisher stumm: die Kandidatenliste
    // haelt die Karte fuer spielbar, `doPlaySpell` steigt still mit
    // `return false` aus (rund ein Dutzend Stellen) oder bricht die
    // Aufloesung ab, und im Log steht nur `shrank=false`. Genau so ist
    // Overheal Shock in Als Lauf zweimal hintereinander verpufft.
    // Der Grund wird jetzt benannt — Kartenname inklusive, damit die
    // Zeile im Bericht auffindbar ist.
    cpuLog(`    ⚠ "${pick.cardName}" blieb wirkungslos — Grund: ${diagnoseFailedPlay(engine, cpuIdx, pick)}`);
  }
  return false;
}

/**
 * Nachschau nach einem Play-Versuch, der weder die Hand verkleinert
 * noch die Phase bewegt noch ein HOPT gestempelt hat.
 *
 * Prueft in der Reihenfolge, in der die echte Kette prueft, und meldet
 * die ERSTE Stelle, die jetzt nein sagt. Bewusst rein lesend — die
 * Funktion darf den Spielzustand unter keinen Umstaenden anfassen.
 *
 * `gs._cpuPlayFailReason` wird von `doPlaySpell` / `doSummonCreature`
 * gestempelt (server.js) und hat Vorrang: das ist die Auskunft der
 * Stelle, die tatsaechlich ausgestiegen ist.
 */
function diagnoseFailedPlay(engine, cpuIdx, pick) {
  try {
    const gs = engine.gs;
    const ps = gs.players[cpuIdx];
    const stamped = gs._cpuPlayFailReason;
    if (stamped) return stamped;
    if (pick.handIdx != null && ps?.hand?.[pick.handIdx] !== pick.cardName) {
      return `Hand-Index ${pick.handIdx} zeigt auf "${ps?.hand?.[pick.handIdx] ?? '—'}" statt auf die Karte`;
    }
    const script = loadCardEffect(pick.cardName);
    if (script?.spellPlayCondition && !script.spellPlayCondition(gs, cpuIdx, engine)) {
      return 'spellPlayCondition sagt nein';
    }
    if (pick.cardType === 'Spell' || pick.cardType === 'Attack') {
      const v = engine.validateActionPlay(cpuIdx, pick.cardName, pick.handIdx, pick.heroIdx,
        ['Spell', 'Attack'], {});
      if (!v) return 'validateActionPlay sagt nein (Level/Schule, Sperre oder Aktionsrecht)';
    }
    return 'unbekannt — Aufloesung lief an und brach ohne Wirkung ab';
  } catch (err) {
    return `Diagnose selbst fehlgeschlagen (${err.message})`;
  }
}

// ─── Action-costing Ability fallback ───────────────────────────────────
// Per user spec: if nothing else is available in the Action Phase, fire an
// action-costing Ability instead. HOPT-gated, canActivateAction-gated.
async function tryActionCostingAbility(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const zones = ps.abilityZones?.[hi] || [];
    for (let zi = 0; zi < zones.length; zi++) {
      const slot = zones[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) continue;
      const hoptKey = `ability-action:${abilityName}:${cpuIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      if (script.canActivateAction && !script.canActivateAction(gs, cpuIdx, hi, slot.length, engine)) continue;
      cpuLog(`    → action-costing ability "${abilityName}" hero=${hi}`);
      await helpers.doActivateAbility(helpers.room, cpuIdx, { heroIdx: hi, zoneIdx: zi });
      return true;
    }
  }
  return false;
}

// ─── Ascension ─────────────────────────────────────────────────────────
// Quelle-Name des Formwahl-Prompts. Muss STABIL bleiben: er ist der
// Schlüssel der gelernten Regeln (`tutorPickRules['Waflav Evolution→…']`)
// — eine Umbenennung entwertet jedes trainierte Profil.
const ASCENSION_CHOICE_SRC = 'Waflav Evolution';

// Als Ursprungsvorgabe: "If a CPU can Ascend, it will do so as the LAST
// game action of its turn." Das galt, solange JEDER Aufstieg den Zug
// beendete. Formen mit `blockEndPhaseOnAscend` ("Ascending this Hero
// does not end your turn") sind davon ausgenommen — für sie ist der
// Aufstieg ein Zug-MITTELPUNKT, nach dem noch gespielt wird.
//
// Rückgabe: { ascended, endsTurn }. `endsTurn` spiegelt exakt
// `performAscension`s `skipEndPhase` wider — die Auskunft war immer da,
// wurde vom Piloten aber verworfen.

async function tryAscend(engine, helpers, opts = {}) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Find ascension candidates: (handIdx, heroIdx) where handIdx holds an
  // Ascended Hero card and heroIdx points to a Hero that's ascensionReady.
  const candidates = [];
  for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
    const cardName = ps.hand[handIdx];
    const cd = cardDB[cardName];
    if (!cd || cd.cardType !== 'Ascended Hero') continue;
    const aScript = loadCardEffect(cardName);
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Cards with their own printed price (Waflav's Evolution Counters)
      // declare `ascensionCondition`; asking it here keeps the CPU from
      // burning its Ascension attempt on a form it cannot afford —
      // `performAscension` would reject it and the turn would end with
      // nothing done.
      if (typeof aScript?.ascensionCondition === 'function') {
        if (!aScript.ascensionCondition(gs, cpuIdx, hi, engine)) continue;
      } else if (!hero.ascensionReady) {
        continue;
      }
      candidates.push({ cardName, handIdx, heroIdx: hi });
    }
  }
  if (!candidates.length) return { ascended: false, endsTurn: false };

  // ── Form choice (multi-form archetypes) ──────────────────────────
  // With several affordable forms for the same Hero the choice is a real
  // decision, not a coin flip. Route it through a cardGallery prompt so
  // it rides the existing tutor-pick learning channel end to end:
  // `_logGalleryPick` records `src → picked` on every LIVE gallery
  // resolution, the trainer turns those into `tutorPickRules` with
  // Advantage labels and recency weighting, and the gallery scorer adds
  // `tutorPickRules[src→card]` back when ranking. The CPU therefore
  // learns which evolution pays off in which situation, per deck profile.
  let pick;
  const multi = candidates.filter(c => c.heroIdx === candidates[0].heroIdx);
  const distinct = [...new Set(multi.map(c => c.cardName))];
  if (distinct.length > 1) {
    const choice = await engine.promptGeneric(cpuIdx, {
      type: 'cardGallery',
      title: ASCENSION_CHOICE_SRC,
      source: ASCENSION_CHOICE_SRC,
      description: 'Which form?',
      cards: distinct.map(n => ({ name: n, source: 'hand' })),
      cancellable: false,
    });
    const chosen = choice?.cardName;
    pick = multi.find(c => c.cardName === chosen) || multi[0];
  } else {
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }
  cpuLog(`  → ascend "${pick.cardName}" onto hero ${pick.heroIdx}`);
  await pauseAction(engine);
  // Ascension is an enormous, near-always-positive boon: HP/ATK upgrade,
  // free Ascension Bonus, and unlocks the Ascended hero's effect/passive.
  // The MCTS evaluator can't always see that through the noisy short-
  // horizon rollout (esp. when the bonus prompt is interactive), so we
  // route the activation through the gate with `alwaysCommit: true` —
  // MCTS still gets to explore bonus-prompt variations to pick the best
  // one, but the gate will not refuse the ascension itself.
  //
  // NUR für den ERSTEN Aufstieg des Zuges. Seit dem Zyklus (mehrere
  // Aufstiege je Zug möglich) wäre ein Dauer-Bypass gefährlich: eine
  // Form, die netto Counter zurückgibt (Stormkissed: −1/+2), könnte
  // sich sonst durch die ganze Hand schleifen, ohne dass die Bewertung
  // je widersprechen darf. Folgeaufstiege gehen durchs normale Gate.
  let ascResult = null;
  const actionFn = async () => {
    ascResult = await engine.performAscension(cpuIdx, pick.heroIdx, pick.cardName, pick.handIdx, {});
  };
  const committed = await mctsGatedActivation(engine, helpers, `ascend ${pick.cardName}`, actionFn,
    { alwaysCommit: opts.firstOfTurn !== false });
  if (!committed) {
    cpuLog(`  ← ascension skipped by MCTS gate`);
    return { ascended: false, endsTurn: false };
  }
  // `skipEndPhase === false` heißt: die Form trägt `blockEndPhaseOnAscend`,
  // der Zug läuft weiter. Fehlt die Auskunft (Alt-Pfad, Gate-Recon ohne
  // echten Lauf), gilt die konservative Annahme "Zug endet" — genau das
  // bisherige Verhalten.
  const endsTurn = ascResult ? ascResult.skipEndPhase !== false : true;
  cpuLog(`  ← ascension done (endsTurn=${endsTurn})`);
  broadcast(helpers);
  swapDiag(engine, endsTurn ? 'asc:endet-zug' : 'asc:zug-laeuft-weiter');
  return { ascended: true, endsTurn };
}

async function runMainPhase(engine, helpers) {
  if (istAbgebrochen(engine)) return marke(engine, `aus:runMainPhase#1:abbruch@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  // Swap-Diagnose, Verfügbarkeits-Ebene: EINMAL je eigenem Zug die
  // Ausgangslage festhalten — wie viele Handkarten könnten überhaupt
  // einen Zyklus-Zug machen, und existiert ein bounce-bares Ziel?
  // Erst im Verhältnis dazu ist eine Swap-Rate interpretierbar.
  try {
    const _dpi = engine._cpuPlayerIdx;
    if (!engine._inMctsSim && typeof _dpi === 'number'
        && (engine._swapDiagTurn || {})[_dpi] !== engine.gs?.turn) {
      if (!engine._swapDiagTurn) engine._swapDiagTurn = {};
      engine._swapDiagTurn[_dpi] = engine.gs?.turn;
      const dps = engine.gs.players[engine._cpuPlayerIdx];
      const cardDB = engine._getCardDB();
      let handSwappers = 0, anyTarget = 0;
      const seen = new Set();
      for (const cn of (dps?.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const cd = cardDB[cn];
        if (!cd || cd.cardType !== 'Creature') continue;
        const sc = loadCardEffect(cn);
        if (typeof sc?.canPlaceOnOccupiedSlot !== 'function') continue;
        handSwappers++;
        for (let hi = 0; hi < (dps.heroes || []).length && !anyTarget; hi++) {
          const h = dps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          for (let z = 0; z < 3; z++) {
            if (!((dps.supportZones?.[hi] || [])[z] || []).length) continue;
            try {
              if (sc.canPlaceOnOccupiedSlot(engine.gs, engine._cpuPlayerIdx, hi, z, engine)) { anyTarget = 1; break; }
            } catch { /* Slot unklar */ }
          }
        }
      }
      // (D) Board-Füllstand: Als Ziel ist "mehr Kreaturen raus", und die
      // Bounce-Ziele stammen aus genau diesem Bestand. Ohne die Zahl
      // lässt sich nicht sagen, ob das Board wächst oder stagniert.
      let boardCreatures = 0, oldCreatures = 0;
      for (let hi = 0; hi < (dps.heroes || []).length; hi++) {
        for (let z = 0; z < 3; z++) {
          const nm = ((dps.supportZones?.[hi] || [])[z] || [])[0];
          if (!nm) continue;
          const cd2 = cardDB[nm];
          if (!cd2 || cd2.cardType !== 'Creature') continue;
          boardCreatures++;
          const inst = (engine.cardInstances || []).find(ci => ci
            && ci.zone === 'support' && ci.heroIdx === hi && ci.zoneSlot === z
            && (ci.controller ?? ci.owner) === engine._cpuPlayerIdx);
          if (inst && inst.turnPlayed < engine.gs.turn) oldCreatures++;
        }
      }
      swapDiag(engine, `turn:board:${Math.min(boardCreatures, 6)}`);
      // Zähler für Board-Erweiterungen dieses Zuges zurücksetzen.
      engine._bodyExpandThisTurn = 0;
      swapDiag(engine, `turn:board-old:${Math.min(oldCreatures, 6)}`);
      // (E) Primordium-Grants: Als "besser 2+ dank Primordium" hängt
      // daran, dass Grants überhaupt erteilt UND ausgegeben werden.
      try {
        let grants = 0;
        for (const ci of (engine.cardInstances || [])) {
          if (!ci || ci.zone !== 'support') continue;
          if ((ci.controller ?? ci.owner) !== engine._cpuPlayerIdx) continue;
          const g = ci.counters?.aaGrants || {};
          for (const k in g) if (g[k] > 0) grants += g[k];
        }
        if (grants > 0) swapDiag(engine, `turn:grants-offen:${Math.min(grants, 3)}`);
      } catch { /* Telemetrie */ }
      swapDiag(engine, `turn:hand-swappers:${Math.min(handSwappers, 4)}`);
      swapDiag(engine, anyTarget ? 'turn:target-available' : 'turn:no-target');
      swapDiag(engine, `turn:handsize:${(dps?.hand || []).length >= 7 ? '7+' : 'lt7'}`);
    }
  } catch { /* Telemetrie */ }
  for (let guard = 0; guard < 12; guard++) {
    if (cpuPastDeadline(engine)) { cpuLog('  MainPhase: turn deadline hit — bailing'); return; }
    const before = snapshotProgress(engine);
    cpuLog(`  MainPhase pass ${guard + 1} — snapshot=${before}`);

    // First pass: Creatures whose `canSummon` requires an empty discard
    // pile (Guardian Beasts archetype today; generic for any future
    // archetype with the same shape). Must run BEFORE artifacts/potions
    // — once any card lands in the discard pile, the summon window
    // closes for the rest of the turn.
    cpuLog('    → playDiscardSensitiveCreatures');
    await playDiscardSensitiveCreatures(engine, helpers);
    cpuLog('    ← playDiscardSensitiveCreatures');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    // Hand-aktivierte Effekte NACH den discard-empfindlichen Kreaturen
    // (ein Abwurf schließt deren Fenster) und VOR allem anderen — sie
    // sind kostenlos und schalten oft erst frei, was danach kommt
    // (Stormkisseds Counter ist die Eintrittskarte in den Aufstieg).
    cpuLog('    → fireHandActivations');
    await fireHandActivations(engine, helpers);
    cpuLog('    ← fireHandActivations');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → playArtifacts');
    await playArtifacts(engine, helpers);
    cpuLog('    ← playArtifacts');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → playPotions');
    await playPotions(engine, helpers);
    cpuLog('    ← playPotions');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → attachAbilities');
    await attachAbilities(engine, helpers);
    cpuLog('    ← attachAbilities');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → placeSurprises');
    await placeSurprises(engine, helpers);
    cpuLog('    ← placeSurprises');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → fireAdditionalActions');
    await fireAdditionalActions(engine, helpers);
    cpuLog('    ← fireAdditionalActions');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    cpuLog('    → activateBoardEffects');
    await activateBoardEffects(engine, helpers);
    cpuLog('    ← activateBoardEffects');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
    if (cpuPastDeadline(engine)) return;

    const after = snapshotProgress(engine);
    cpuLog(`  MainPhase pass ${guard + 1} end — before=${before} after=${after}`);
    if (after === before) { cpuLog('  MainPhase: no progress, breaking'); break; }
  }
}

// ─── 2h: Active board effects ─────────────────────────────────────────
// Per user spec: CPU activates every free active effect it can (Main Phase
// only for 2h). Covers free-activation Abilities (script.freeActivation +
// onFreeActivate). Hero effects, Creature/Equipment/Attachment actives, and
// Area effects are deferred — their socket handlers aren't extracted yet.
//
// HOPT is per-ability-name per-player, so we only fire a given name once per
// turn even if multiple Heroes stack the same Ability. The handler claims
// HOPT on successful activation; we just need to skip if gs.hoptUsed says so.

// ─── Hand-aktivierte Effekte ──────────────────────────────────────────
//
// `handActivatedEffect` ist ein Karten-Vertrag, den die Engine seit
// jeher kennt (`getHandActivatableCards` / `doHandActivate`) — aber
// AUSSCHLIESSLICH der Client löste ihn aus, über den Socket
// `activate_hand_card`. Für den Piloten existierte der Pfad nicht: der
// Effekt war für JEDE CPU jeder Karte dieser Bauart tot.
//
// Gemessen an Morph and Kill (500 Mitschnitte, 5.8.): Stormkisseds
// "Discard → 1 Evolution Counter" feuerte 0×. Es ist die einzige
// Counter-Quelle, die keinen Kill voraussetzt — ohne sie hängt der
// ganze Archetyp daran, dass die Basisform erst einmal etwas tötet,
// und in 76% der Spiele kam nie ein einziger Counter zustande.
// Betroffen sind heute außerdem Luna Kiai und Mana-Absorbing Crystal.
//
// Zwei Verträge, beide optional und beide dem `cpuShouldPlay`-Muster
// nachgebaut:
//   • `cpuShouldHandActivate(engine, pi, handIndex)` → bool
//     Soft-Gate der Karte, bevor überhaupt bewertet wird.
//   • `cpuMeta.alwaysCommit` (bool | (engine, pi) => bool)
//     Für Effekte, deren Ertrag die Sofortbewertung nicht sieht — ein
//     Abwurf gegen einen Counter liest sich als reiner Kartenverlust
//     (dieselbe Blindstelle wie bei Perfect Disguise).
async function fireHandActivations(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  if (typeof engine.getHandActivatableCards !== 'function') return;
  if (typeof engine.doHandActivate !== 'function') return;
  const tried = new Set();
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:fireHandActivations#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    if (cpuPastDeadline(engine)) return;
    let list = [];
    try { list = engine.getHandActivatableCards(cpuIdx) || []; }
    catch { return; }
    if (list.length === 0) {
      if (safety === 0) swapDiag(engine, 'handact:keine-kandidaten');
      return;
    }
    let pick = null;
    for (const cand of list) {
      if (!cand || tried.has(cand.cardName)) continue;
      const script = loadCardEffect(cand.cardName);
      if (typeof script?.cpuShouldHandActivate === 'function') {
        let ok = true;
        try { ok = !!script.cpuShouldHandActivate(engine, cpuIdx, cand.handIndex); }
        catch (err) {
          console.error(`[cpu] cpuShouldHandActivate ${cand.cardName} threw:`, err.message);
        }
        if (!ok) {
          swapDiag(engine, `handact:soft-nein:${cand.cardName}`);
          tried.add(cand.cardName);
          continue;
        }
      }
      pick = { ...cand, script };
      break;
    }
    if (!pick) return;
    tried.add(pick.cardName);
    swapDiag(engine, `handact:kandidat:${pick.cardName}`);

    const alwaysCommit = (typeof pick.script?.cpuMeta?.alwaysCommit === 'function'
      ? (() => {
          try { return !!pick.script.cpuMeta.alwaysCommit(engine, cpuIdx, CPU_META_HELPERS); }
          catch { return false; }
        })()
      : !!pick.script?.cpuMeta?.alwaysCommit);

    let fired = false;
    const actionFn = async () => {
      fired = !!(await engine.doHandActivate(cpuIdx, pick.cardName, pick.handIndex));
    };
    const committed = await mctsGatedActivation(engine, helpers,
      `hand-activate ${pick.cardName}`, actionFn, { alwaysCommit });
    swapDiag(engine, committed
      ? (fired ? `handact:ok:${pick.cardName}` : `handact:gefeuert-nein:${pick.cardName}`)
      : `handact:gate-nein:${pick.cardName}`);
    if (committed && fired) broadcast(helpers);
    await pauseAction(engine);
  }
}

async function activateBoardEffects(engine, helpers) {
  await activateFreeAbilities(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateCreatureEffects(engine, helpers);
  await activateAreaEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateHeroEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateEquipEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateAreaEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activatePermanents(engine, helpers);
}

// ─── Counter-Ausgabe-Kanal: Helfer ────────────────────────────────────

/** Aktueller Zaehlerstand eines Helden ueber den Karten-Vertrag, oder null. */
function readCounterStock(engine, pi, heroIdx) {
  try {
    if (!(heroIdx >= 0)) return null;
    const hero = engine.gs?.players?.[pi]?.heroes?.[heroIdx];
    if (!hero?.name) return null;
    const spend = loadCardEffect(hero.name)?.cpuMeta?.counterSpend;
    if (!spend || typeof spend.get !== 'function') return null;
    const v = spend.get(engine, pi, heroIdx);
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

/**
 * Eine Ausgabe-Entscheidung festhalten — HOECHSTENS EINE je Held und Zug.
 *
 * Der Helden-Effekt ist once-per-turn, es gibt also pro Zug genau eine
 * Entscheidung. Ein SKIP verbraucht die HOPT-Sperre aber nicht, also
 * bewertet jeder weitere `activateHeroEffects`-Durchlauf dieselbe
 * Gelegenheit erneut. Ohne Dedupe zaehlt der held-Arm Wiederholungen
 * statt Entscheidungen — im ersten Lauf um Faktor ~7 aufgeblasen.
 * Ein spaeteres `fired: 1` ueberschreibt ein frueheres `0` desselben
 * Zuges: dass in einem Durchlauf abgelehnt und im naechsten doch
 * ausgegeben wurde, ist EIN Vorgang, und sein Ausgang ist die Ausgabe.
 */
function noteCounterSpend(engine, pi, heroName, tags, fired) {
  try {
    if (engine._inMctsSim) return;
    if (!engine._counterSpendLog) engine._counterSpendLog = [];
    const t = engine.gs?.turn || 0;
    const prev = engine._counterSpendLog.find(e =>
      e.pi === pi && e.c === heroName && e.t === t);
    if (prev) {
      if (fired) { prev.fired = 1; prev.tags = tags; }
      return;
    }
    engine._counterSpendLog.push({ pi, c: heroName, t, tags, fired: fired ? 1 : 0 });
  } catch { /* nie stoeren */ }
}

async function activateHeroEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  // Flashbang-Sperre: siehe Als Ruling (4.8.) — ein Helden-Effekt löst
  // `onAnyActionResolved` nur noch aus, wenn er die Ressource Aktion
  // VERBRAUCHT (`heroEffectActionCost`). Kostenlose Helden-Effekte sind
  // unter Flashbang also gefahrlos und werden nicht mehr pauschal
  // gesperrt; die Sperre unten filtert nur noch die aktionskostenden.
  const flashbangedInMp1 = isCpuFlashbanged(engine) && gs.currentPhase === 2;
  const tried = new Set();
  // Livelock-Riegel, siehe MAX_ACTIVATION_REPEATS.
  const repeatCount = new Map();
  // Tags der Counter-Ausgabe-Entscheidung des GEWAEHLTEN Helden — sie
  // entstehen in der Kandidatenschleife, gebraucht werden sie erst nach
  // der Aktivierung (fired-Arm des Lernkanals).
  let pickCsTags = null;
  let pickCsHero = null;
  let pickCsEvoBefore = null;
  let pickCsHeroIdx = -1;
  // Von 6 angehoben: mit Mehrfachnutzungen (Kassaran 3×) reichten die
  // alten Durchläufe für drei Helden nicht mehr aus.
  for (let safety = 0; safety < 16; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateHeroEffects#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    let pickIdx = -1;
    pickCsTags = null;
    pickCsHero = null;
    pickCsEvoBefore = null;
    pickCsHeroIdx = -1;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (tried.has(hi)) continue;
      // Check if hero has ANY available hero-effect we haven't claimed
      // HOPT on AND whose `canActivateHeroEffect` (when defined) returns
      // true. The canActivate pre-check prevents the gate from firing on
      // heroes whose effect would self-reject inside `doActivateHeroEffect`
      // (e.g. Argos with 0 Change Counters): without it, the gate's recon
      // sees `skip == best` because the action no-ops, the heuristic gate
      // logs a misleading SKIP, and the hero gets branded `tried` for the
      // rest of the turn even though nothing was actually attempted.
      const script = loadCardEffect(hero.name);
      const hoptKey = `hero-effect:${hero.name}:${cpuIdx}:${hi}`;
      let available = (script?.heroEffect && script?.onHeroEffect && gs.hoptUsed?.[hoptKey] !== gs.turn);
      // ── Spielstart-Schutz (Als Ruling 8.8.) ──────────────────────────
      // Rein schaedliche Helden-Effekte sind nicht nutzbar, solange die
      // GEGENSEITE unter dem Schutz steht. Dieselbe Pruefung laeuft in
      // getActiveHeroEffects (Anzeige) und doActivateHeroEffect
      // (autoritativ) — hier steht sie, damit der Pilot die Gelegenheit
      // gar nicht erst bewertet: sonst faehrt er je Main-Phase-Durchlauf
      // eine Gate-Recon fuer einen Effekt, der nichts ausrichten kann.
      if (available && engine.isHeroEffectBlockedByGraceShield(script, cpuIdx)) {
        cpuLog(`      hero-effect "${hero.name}": Spielstart-Schutz — rein schaedlich, gesperrt`);
        available = false;
      }
      // Unter Flashbang in Main Phase 1: nur Effekte aufschieben, die
      // wirklich eine Aktion kosten — die würden den Zug hier sofort
      // beenden und die Action Phase mitsamt breiterem Kartenpool
      // verschenken. In MP2 bietet derselbe Pass sie regulär an.
      if (available && flashbangedInMp1 && script?.heroEffectActionCost) {
        cpuLog(`      hero-effect "${hero.name}": Aktionskosten unter Flashbang — aufgeschoben auf Main Phase 2`);
        available = false;
      }
      // Zug-beendende Hero-Effekte (heroEffectEndsTurn, z. B. Cooldin)
      // sind in Main Phase 1 GESPERRT: Ein Feuern dort verschenkt die
      // Action Phase + MP2. In MP2 (Phase 4) bietet derselbe Pass sie
      // regulär an — dort kostet das Zugende fast nichts mehr.
      if (available && script?.heroEffectEndsTurn && gs.currentPhase === 2) {
        cpuLog(`      hero-effect "${hero.name}": endsTurn — aufgeschoben auf Main Phase 2`);
        available = false;
      }
      // ── Held-Vertrag: cpuShouldUseHeroEffect ─────────────────────────
      // CPU-seitiges Soft-Gate analog zu cpuShouldPlay: side-effect-freie
      // Probe, ob die Aktivierung strategisch Sinn ergibt. Erstnutzer:
      // Kazena (Draw-to-7 überspringen, wenn der Refill das Deck leeren
      // würde — harte Suizid-Bremse; die weiche Regulierung übernimmt
      // der Deck-Nähe-Term in evaluateState über die MCTS-Arme).
      if (available && typeof script?.cpuShouldUseHeroEffect === 'function') {
        try {
          available = !!script.cpuShouldUseHeroEffect(engine, cpuIdx, hi);
        } catch (err) {
          console.error(`[cpu] cpuShouldUseHeroEffect ${hero.name} threw:`, err.message);
        }
        if (!available) cpuLog(`      hero-effect "${hero.name}": cpuShouldUseHeroEffect → skip`);
      }
      // ── Counter-Ausgabe-Kanal (Als Vorgabe 5.8.) ──────────────────
      // Helden, die fuer ihren Effekt Zaehler VERBRAUCHEN, bekommen die
      // Frage "jetzt ausgeben oder fuer den Aufstieg aufheben?" als
      // eigene, gelernte Entscheidung. Ohne Profil liefert der Kanal
      // null → exakt das bisherige Verhalten; die Regel lernt sich das
      // Deck selbst an. Getrieben vom Vertrag `cpuMeta.counterSpend`,
      // kein Archetyp-Wissen im Piloten.
      let csTags = null;
      if (available && script?.cpuMeta?.counterSpend) {
        csTags = deckProfile.classifyCounterSpendTags(engine, cpuIdx, hi);
        if (csTags && csTags.length > 0) {
          const csDec = deckProfile.counterSpendDecision(engine, cpuIdx, hero.name, csTags);
          if (csDec === 'skip') {
            // Genau EIN Eintrag je Held und Zug. Der Helden-Effekt ist
            // once-per-turn, es gibt also pro Zug genau EINE Ausgabe-
            // Entscheidung — aber ein Skip verbraucht die HOPT-Sperre
            // nicht, weshalb dieselbe Gelegenheit in jedem weiteren
            // Durchlauf von `activateHeroEffects` erneut bewertet und
            // erneut geloggt wurde. Im ersten Lauf blies das den
            // held-Arm auf ~7× seiner wahren Groesse.
            noteCounterSpend(engine, cpuIdx, hero.name, csTags, 0);
            swapDiag(engine, 'cspend:aufgehoben');
            cpuLog(`      hero-effect "${hero.name}": Counter aufgehoben (${csTags.join(',')})`);
            available = false;
            csTags = null;
          }
        }
      }
      if (available && script.canActivateHeroEffect) {
        try {
          const inst = engine.cardInstances.find(c =>
            c.owner === cpuIdx && c.zone === 'hero' && c.heroIdx === hi);
          if (!inst) { available = false; }
          else {
            const ctx = engine._createContext(inst, { event: 'canHeroEffectCheck' });
            available = !!script.canActivateHeroEffect(ctx);
          }
        } catch { available = false; }
      }
      // Also check equipped hero-effect providers (e.g. Mummy Token, treatAsEquip heroes).
      const hasEquippedEffect = engine.cardInstances.some(ci => {
        if (ci.owner !== cpuIdx || ci.zone !== 'support' || ci.heroIdx !== hi) return false;
        if (!ci.counters?.treatAsEquip) return false;
        const eq = loadCardEffect(ci.name);
        if (!eq?.heroEffect || !eq?.onHeroEffect) return false;
        const hk = `hero-effect:${ci.name}:${cpuIdx}:${hi}`;
        if (gs.hoptUsed?.[hk] === gs.turn) return false;
        if (engine.isHeroEffectBlockedByGraceShield(eq, cpuIdx)) return false;
        // Same canActivate pre-check for equipped providers.
        if (eq.canActivateHeroEffect) {
          try {
            const ctx = engine._createContext(ci, { event: 'canHeroEffectCheck' });
            return !!eq.canActivateHeroEffect(ctx);
          } catch { return false; }
        }
        return true;
      });
      if (available || hasEquippedEffect) {
        pickIdx = hi;
        if (available && csTags && csTags.length > 0) {
          pickCsTags = csTags;
          pickCsHero = hero.name;
          // Zaehlerstand VOR der Aktivierung — der einzige verlaessliche
          // Beleg dafuer, ob wirklich ausgegeben wurde (siehe unten).
          pickCsEvoBefore = readCounterStock(engine, cpuIdx, hi);
          pickCsHeroIdx = hi;
        }
        break;
      }
    }
    if (pickIdx < 0) return;
    cpuLog(`      → activate hero effect hero=${pickIdx}`);
    // Formzustand VOR der Aktivierung — siehe Fortschritts-Riegel unten.
    const formBefore = engine.gs?.players?.[cpuIdx]?.heroes?.[pickIdx]?.name || null;
    const committed = await mctsGatedActivation(engine, helpers, `hero-effect h${pickIdx}`,
      () => helpers.doActivateHeroEffect(helpers.room, cpuIdx, { heroIdx: pickIdx }));
    // Vorher wurde `JSON.stringify(gs.hoptUsed)` vor/nach verglichen —
    // ein Helden-Effekt mit MEHREREN Nutzungen pro Runde (Kassaran, 3×)
    // lässt die Sperre offen und sah damit aus wie "nicht gefeuert".
    // Der Server meldet das Ergebnis jetzt direkt.
    const fired = engine.didActivationFire(`hero-effect:${cpuIdx}:${pickIdx}`);
    // ── fired-Arm des Counter-Ausgabe-Kanals (6.8., korrigiert) ────
    // ALT: `fired: (committed && fired) ? 1 : 0` mit `fired` aus
    // `engine.didActivationFire(...)`. Zwei Fehler auf einmal:
    //
    // (a) `didActivationFire` wird nur wahr, wenn `onHeroEffect` NICHT
    //     `false` zurueckgibt. Die Waflav-Familie nutzt
    //     `finishSelfManagedHeroEffect`, das absichtlich `false`
    //     liefert, damit die Engine ihren eigenen HOPT-Stempel nicht
    //     setzt — der fired-Arm war also blind fuer genau die
    //     Heldenfamilie, fuer die der Kanal existiert.
    // (b) Gate-Ablehnungen (`committed === false`) landeten als
    //     `fired: 0` im selben Topf. Eine Gate-Ablehnung ist aber gar
    //     keine Ausgabe-Entscheidung, sondern ein Wert-Urteil — sie
    //     gehoert in keinen der beiden Arme.
    //
    // Messergebnis des ersten Laufs: 8354 Entscheidungen, davon 8353
    // "held" und 1 "fired". Keine Kontrastgruppe, also keine Regel.
    //
    // NEU: der Beleg ist der ZAEHLERSTAND. Ist er nach der Aktivierung
    // niedriger als davor, wurde ausgegeben — unabhaengig davon, wie
    // der Effekt sein Feuern meldet. Gate-Ablehnungen werden verworfen
    // und separat gezaehlt.
    try {
      if (!engine._inMctsSim && pickCsTags && pickCsHero) {
        if (!committed) {
          swapDiag(engine, 'cspend:gate-nein');
        } else {
          const after = readCounterStock(engine, cpuIdx, pickCsHeroIdx);
          const spent = (pickCsEvoBefore != null && after != null && after < pickCsEvoBefore);
          noteCounterSpend(engine, cpuIdx, pickCsHero, pickCsTags, spent ? 1 : 0);
          swapDiag(engine, spent ? 'cspend:ausgegeben' : 'cspend:aktiviert-ohne-ausgabe');
        }
      }
    } catch { /* nie stoeren */ }
    const repeats = (repeatCount.get(pickIdx) || 0) + 1;
    repeatCount.set(pickIdx, repeats);
    // ── FORTSCHRITTS-RIEGEL (Als Ruling 6.8.) ─────────────────────────
    // `fired` kommt aus `didActivationFire` und ist bei Helden-Effekten,
    // die ihre Sperre selbst verwalten, IMMER false — deren
    // `onHeroEffect` liefert bewusst `false`, damit die Engine den
    // gemeinsamen `hero-effect:<name>`-Stempel nicht setzt (sonst
    // sperrten sich zwei Effekte derselben Karte gegenseitig aus).
    // Ein ERFOLGREICHER Vorgang galt dadurch als "nicht gefeuert" und
    // sperrte den Helden fuer den Rest dieses Durchlaufs.
    //
    // Gemessen an den Waflav-Formen: Stormkissed/Thunderstruck/
    // Flamebathed/Swampborne liefern `true` und waren nie betroffen —
    // Deep-Drowned liefert `false` und blockierte nach SEINEM Abstieg
    // die Kette.
    //
    // Als Regel lautet: eine Descension je FORM je Runde, danach darf
    // sofort weiter abgestiegen werden. Die Regelseite kann das laengst
    // (die Sperre haengt am Formnamen, und `hoptKey` der CPU ebenso) —
    // es fehlte nur das Fortschritts-Signal. Ein Wechsel des Formnamens
    // IST unmissverstaendlicher Fortschritt: die naechste Aktivierung
    // trifft eine andere Karte mit eigener Sperre. Deckneutral, greift
    // fuer jeden Helden-Effekt, der den Helden umwandelt.
    const formAfter = engine.gs?.players?.[cpuIdx]?.heroes?.[pickIdx]?.name || null;
    const transformed = !!(committed && formBefore && formAfter && formBefore !== formAfter);
    if (transformed) swapDiag(engine, 'heroeff:form-gewechselt');
    if (!committed || (!fired && !transformed) || repeats >= MAX_ACTIVATION_REPEATS) {
      cpuLog(`      ← hero effect hero=${pickIdx} nicht gefeuert — als versucht markiert`);
      tried.add(pickIdx);
    } else {
      cpuLog(`      ← hero effect hero=${pickIdx} OK (${repeats}.)`);
    }
    await pauseAction(engine);
  }
}

async function activateEquipEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 12; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateEquipEffects#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    let pick = null;
    for (const inst of engine.cardInstances) {
      if (inst.owner !== cpuIdx || inst.zone !== 'support') continue;
      const key = inst.id;
      if (tried.has(key)) continue;
      const hoptKey = `equip-effect:${inst.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      const script = loadCardEffect(inst.name);
      if (!script?.equipEffect || !script?.onEquipEffect) continue;
      if (script.canActivateEquipEffect) {
        const ctx = engine._createContext(inst, { event: 'canEquipEffectCheck' });
        if (!script.canActivateEquipEffect(ctx)) continue;
      }
      pick = { instId: inst.id, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, name: inst.name };
      break;
    }
    if (!pick) return;
    // Per-card CPU activation guard: lets the card itself defer proactive
    // activation based on current board context (e.g. Skates declining to
    // clog up summoner zones during MP1 / Action Phase). Guarded with try
    // so a buggy script can't hang the turn.
    const pickScript = loadCardEffect(pick.name);
    if (typeof pickScript?.cpuCanActivateEquip === 'function') {
      let ok = true;
      try { ok = !!pickScript.cpuCanActivateEquip(engine, cpuIdx, pick.heroIdx, pick.zoneSlot); }
      catch { ok = true; }
      if (!ok) {
        cpuLog(`      ← equip effect "${pick.name}" deferred by card guard`);
        tried.add(pick.instId);
        await pauseAction(engine);
        continue;
      }
    }
    cpuLog(`      → activate equip effect "${pick.name}" hero=${pick.heroIdx}`);
    // Forward per-card cpuMeta hints to the gate. `alwaysCommit` lets
    // positional / control activations (Slippery Skates) commit despite
    // an eval-invisible delta; `evaluateThroughTurnEnd` opts the gate
    // into a rest-of-turn rollout for cards whose value only manifests
    // later this turn.
    const equipAlwaysCommit = !!pickScript?.cpuMeta?.alwaysCommit;
    const equipEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    const committed = await mctsGatedActivation(engine, helpers, `equip-effect ${pick.name}`,
      () => helpers.doActivateEquipEffect(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneSlot: pick.zoneSlot }),
      { alwaysCommit: equipAlwaysCommit, evaluateThroughTurnEnd: equipEvalThroughTurnEnd });
    const hoptKey = `equip-effect:${pick.instId}`;
    if (!committed || gs.hoptUsed?.[hoptKey] !== gs.turn) tried.add(pick.instId);
    await pauseAction(engine);
  }
}

async function activateAreaEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateAreaEffects#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    let pick = null;
    // Areas belong to a specific player but both players can activate each
    // (the rules allow Area activations from either player). Scan both sides.
    for (let owner = 0; owner < 2; owner++) {
      const areas = gs.areaZones?.[owner] || [];
      for (const areaName of areas) {
        const key = `${owner}|${areaName}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(areaName);
        if (!script?.onAreaEffect) continue;
        if (script.canActivateAreaEffect) {
          try {
            if (!script.canActivateAreaEffect(gs, cpuIdx, owner, engine)) continue;
          } catch { continue; }
        }
        pick = { owner, areaName, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;
    cpuLog(`      → activate area effect "${pick.areaName}" owner=${pick.owner}`);
    const handBefore = JSON.stringify(gs.hoptUsed || {});
    const committed = await mctsGatedActivation(engine, helpers, `area ${pick.areaName}`,
      () => helpers.doActivateAreaEffect(helpers.room, cpuIdx, { areaOwner: pick.owner, areaName: pick.areaName }));
    const handAfter = JSON.stringify(gs.hoptUsed || {});
    if (!committed || handBefore === handAfter) tried.add(pick.key);
    await pauseAction(engine);
  }
}

async function activatePermanents(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 10; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activatePermanents#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    let pick = null;
    // Permanents can belong to either player (stored in ps.permanents).
    // canActivatePermanent gates whether the CPU (pi=cpuIdx) can act.
    for (let owner = 0; owner < 2; owner++) {
      for (const perm of (gs.players[owner]?.permanents || [])) {
        const key = `${owner}|${perm.id}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(perm.name);
        if (!script?.onActivatePermanent || !script?.canActivatePermanent) continue;
        try {
          if (!script.canActivatePermanent(gs, cpuIdx, owner, engine)) continue;
        } catch { continue; }
        pick = { owner, permId: perm.id, name: perm.name, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;
    cpuLog(`      → activate permanent "${pick.name}"`);
    await mctsGatedActivation(engine, helpers, `permanent ${pick.name}`,
      () => helpers.doActivatePermanent(helpers.room, cpuIdx, { permId: pick.permId, ownerIdx: pick.owner }));
    // No simple HOPT proxy — add to tried after one attempt regardless.
    tried.add(pick.key);
    await pauseAction(engine);
  }
}

async function activateFreeAbilities(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  const tried = new Set();
  // Livelock-Riegel, siehe MAX_ACTIVATION_REPEATS.
  const repeatCount = new Map();
  for (let safety = 0; safety < 24; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateFreeAbilities#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    let pick = null;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      const zones = ps.abilityZones?.[hi] || [];
      for (let zi = 0; zi < zones.length; zi++) {
        const slot = zones[zi] || [];
        if (slot.length === 0) continue;
        const abilityName = slot[0];
        const key = `${abilityName}|${hi}|${zi}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(abilityName);
        if (!script?.freeActivation || !script.onFreeActivate) continue;
        const hoptKey = `free-ability:${abilityName}:${cpuIdx}`;
        if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
        // Harte CPU-Restriktion (Als Ruling): Draw-Aktivierungen wie
        // Alchemy NIEMALS unter Hand- oder Draw-Lock zünden — der
        // Zieh-Teil fizzlet (actionDrawFromPotionDeck liefert []), das
        // Gold ist verschwendet. Karten opten per
        // cpuSkipActivationWhenDrawLocked ein; der Engine-Pfad für
        // Menschen bleibt bewusst unangetastet.
        // Der Opt-in darf boolesch ODER eine Funktion sein: manche
        // Abilities ziehen nur auf niedrigen Stufen und SUCHEN auf der
        // höchsten (Inventing Lv3) — Suchen funktionieren unter dem
        // Zieh-Lock weiterhin und dürfen nicht mitgesperrt werden.
        if (gs.players[cpuIdx]?.handLocked || gs.players[cpuIdx]?.drawLocked) {
          const skip = script.cpuSkipActivationWhenDrawLocked;
          let sperren = false;
          try {
            sperren = typeof skip === 'function' ? !!skip(slot.length) : !!skip;
          } catch { sperren = false; }
          if (sperren) continue;
        }
        // Pre-check `canFreeActivate` so we don't fire the gate on
        // abilities whose activation would self-reject inside
        // `doActivateFreeAbility` (e.g. Alchemy with insufficient
        // gold or empty potion deck). Without this, every pass over
        // the abilities list re-tries an Alchemy that can't fire,
        // producing a stream of misleading `FORCE-COMMIT → SKIPPED/
        // FAILED` lines and burning evaluator cycles. Same fix
        // pattern as the hero-effect canActivate pre-check.
        if (script.canFreeActivate) {
          try {
            const inst = engine.cardInstances.find(c =>
              c.owner === cpuIdx && c.zone === 'ability'
              && c.heroIdx === hi && c.zoneSlot === zi);
            if (!inst) continue;
            const ctx = engine._createContext(inst, { event: 'canFreeActivateCheck' });
            if (!script.canFreeActivate(ctx, slot.length)) continue;
          } catch { continue; }
        }
        // Per-card "wait for a better state" predicate — same hook
        // shape as the creature-effect loop. Mirrors that path so
        // turn-ending free abilities (Premonition) and any future
        // free ability whose value scales with rest-of-turn state can
        // defer themselves to the right moment instead of shotgunning
        // at the first runMainPhase pass and ending the CPU's turn
        // with most actions unspent.
        if (typeof script.cpuMeta?.shouldActivateNow === 'function') {
          let shouldFire = true;
          try {
            shouldFire = !!script.cpuMeta.shouldActivateNow(engine, cpuIdx);
          } catch { shouldFire = true; }
          if (!shouldFire) {
            tried.add(key);
            continue;
          }
        }
        // ── STÄRKSTE KOPIE ZUERST (1.8., Als Report) ──────────────
        // HOPT für freie Abilities gilt je NAME und Spieler
        // (`free-ability:<Name>:<pi>`), es feuert also nur EINE Kopie
        // pro Zug. Gesammelt wurde bisher in Heldenreihenfolge, und die
        // erste passende gewann.
        //
        // Belegt im Mitschnitt: die CPU hatte Leadership DREIFACH auf
        // Layn (Held 1) und kopierte per Charme zusätzlich ein
        // Leadership Lv1 von Als Ingo auf Cute Nerd Magenta (Held 0) —
        // dann feuerte die schwache Kopie und verbrauchte damit die
        // einzige Nutzung des Zuges (`leadership_shuffle count 1
        // level 1` statt count 5 aus Lv3).
        //
        // Deshalb: Kandidaten sammeln statt beim ersten abzubrechen und
        // je Ability-Namen die HÖCHSTE Stufe nehmen. Die Reihenfolge
        // ZWISCHEN verschiedenen Abilities bleibt wie gehabt (der erste
        // gefundene Name gewinnt) — nur innerhalb desselben Namens wird
        // aufgestuft.
        const kandidat = { heroIdx: hi, zoneIdx: zi, abilityName, key, level: slot.length };
        if (!pick || (pick.abilityName === abilityName && kandidat.level > pick.level)) {
          pick = kandidat;
        }
        // Weiter suchen, solange es noch stärkere Kopien DESSELBEN
        // Namens geben kann; einen anderen Namen übernehmen wir nicht.
      }
      if (pick && pick.level >= 3) break;
    }
    if (!pick) return;
    if (pick.level > 1) {
      cpuLog(`      [free-ability] "${pick.abilityName}" Lv${pick.level} auf Held ${pick.heroIdx} gewählt (stärkste Kopie)`);
    }

    const hoptKey = `free-ability:${pick.abilityName}:${cpuIdx}`;
    cpuLog(`      → activate free ability "${pick.abilityName}" hero=${pick.heroIdx} zone=${pick.zoneIdx}`);
    const pickAbilityScript = loadCardEffect(pick.abilityName);
    // Always-commit triggers: (a) cards flagged `blockedByHandLock`
    // (draw / tutor abilities — eval systematically under-rewards
    // gold→card trades), and (b) cards opting into `cpuMeta.alwaysCommit`
    // (Luck — no immediate state delta, only a future-turn payoff that
    // the eval can't see, but functionally a free reactive draw).
    const pickAbilityAlwaysCommit = liftCommitBypassForDraws(engine, cpuIdx,
      !!pickAbilityScript?.blockedByHandLock || !!pickAbilityScript?.cpuMeta?.alwaysCommit,
      // blockedByHandLock markiert Draw-/Tutor-Abilities generisch — am
      // kleinen Deck sollen genau die durchs reguläre Gate.
      !!pickAbilityScript?.blockedByHandLock || !!pickAbilityScript?.cpuMeta?.activationDraws);
    const committed = await mctsGatedActivation(engine, helpers, `free-ability ${pick.abilityName}`,
      () => helpers.doActivateFreeAbility(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneIdx: pick.zoneIdx }),
      { alwaysCommit: pickAbilityAlwaysCommit });
    const nowClaimed = gs.hoptUsed?.[hoptKey] === gs.turn;
    // Karten, die den Engine-Schlüssel nach erfolgreicher Auflösung
    // wieder freigeben, weil sie mehrere Nutzungen pro Runde haben
    // (Lethes Necromancy, 3×), sahen über `nowClaimed` aus wie
    // "nicht gefeuert". Der Server meldet es jetzt direkt; `nowClaimed`
    // bleibt nur noch als Zusatzinfo im Log.
    const fired = engine.didActivationFire(hoptKey);
    const repeats = (repeatCount.get(pick.key) || 0) + 1;
    repeatCount.set(pick.key, repeats);
    cpuLog(`      ← free ability "${pick.abilityName}" ${committed && fired ? `OK (${repeats}.${nowClaimed ? '' : ' Sperre offen'})` : 'SKIPPED/FAILED'}`);
    if (!committed || !fired || repeats >= MAX_ACTIVATION_REPEATS) tried.add(pick.key);
    await pauseAction(engine);
  }
}

// ── Proaktive Area-Aktivierung ──
// Die Engine-Infrastruktur (areaEffect-Contract, getActivatableAreas,
// activateAreaEffect + HOPT) existierte komplett, wurde aber nur vom
// UI-Klickpfad konsumiert — KEIN CPU-Pass enumerierte Areas als
// Kandidaten. Folge: Slippery Ice (dessen onAreaEffect sogar einen
// eigenen MCTS-Multi-Move-Planner mitbringt), Deepsea Castle & Co.
// waren für Bots unsichtbar. Dieser Pass spiegelt das Muster von
// activateCreatureEffects: enumerieren → pro Area einmal pro Zug durchs
// Gate (Rollout misst den echten Wert der Aktivierung).
async function activateAreaEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const tried = new Set();
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateAreaEffects#2:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    const areas = (engine.getActivatableAreas(cpuIdx) || [])
      .filter(a => a.canActivate && !tried.has(`${a.areaName}|${a.areaOwner}`));
    const pick = areas[0];
    if (!pick) return;
    tried.add(`${pick.areaName}|${pick.areaOwner}`);
    const script = loadCardEffect(pick.areaName);
    cpuLog(`      → activate area effect "${pick.areaName}" (owner=${pick.areaOwner})`);
    // alwaysCommit-Bypass wird für draw-Aktivierungen (cpuMeta.
    // activationDraws, z.B. Divine Gift of Balance) bei gefährlich
    // kleinem Deck aufgehoben: dann entscheidet das MCTS-Gate regulär,
    // und der Deck-Nähe-Term in evaluateState sieht den Draw im
    // Commit-Arm — Aufziehen in die Deckwand wird geskippt, ein
    // sicherer Value-Draw feuert weiter.
    const commitBypass = liftCommitBypassForDraws(engine, cpuIdx,
      script?.cpuMeta?.alwaysCommit, script?.cpuMeta?.activationDraws);
    const committed = await mctsGatedActivation(engine, helpers, `area-effect ${pick.areaName}`,
      () => engine.activateAreaEffect(cpuIdx, pick.areaOwner, pick.areaName),
      { alwaysCommit: commitBypass,
        evaluateThroughTurnEnd: !!script?.cpuMeta?.evaluateThroughTurnEnd });
    cpuLog(`      ← area effect "${pick.areaName}" ${committed ? 'OK' : 'SKIPPED'}`);
  }
}

async function activateCreatureEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  const tried = new Set();
  // Wie oft hat DIESE Instanz in diesem Durchlauf schon gefeuert?
  // Nur Livelock-Riegel — die echte Grenze führt die Karte selbst.
  const repeatCount = new Map();
  // Obergrenze angehoben: mit Mehrfachnutzungen (3-Headed Giant 3×)
  // reichten 12 Durchläufe für ein volles Brett nicht mehr aus.
  for (let safety = 0; safety < 32; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:activateCreatureEffects#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    let pick = null;
    for (let hi = 0; hi < (ps.supportZones || []).length; hi++) {
      const zones = ps.supportZones[hi] || [];
      for (let zi = 0; zi < zones.length; zi++) {
        const slot = zones[zi] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const inst = engine.cardInstances.find(c =>
          c.owner === cpuIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
        );
        if (!inst) continue;
        if (inst.faceDown) continue; // face-down surprises aren't actives
        if (inst.turnPlayed === gs.turn && !inst.counters?._hasHaste) continue; // summoning sickness

        const effectName = inst.counters?._effectOverride || cardName;
        const script = loadCardEffect(effectName);
        if (!script?.creatureEffect || !script.onCreatureEffect) continue;

        // Verfügbarkeit über die ZENTRALE Engine-Prüfung: Sperre UND
        // Karten-Gate. Vorher stand hier nur die Sperre — Kreaturen,
        // deren `canActivateCreatureEffect` gerade nein sagt, liefen
        // dadurch ins Gate und wurden für den Rest der Phase auf
        // `tried` gesetzt. Jetzt sieht die CPU exakt dasselbe wie der
        // Client, also nie mehr und nie weniger als ein Mensch.
        if (!engine.creatureEffectStillAvailable(inst)) continue;

        const key = `${cardName}|${hi}|${zi}|${inst.id}`;
        if (tried.has(key)) continue;

        // Per-card "wait for a better state" predicate — Timid Tanuki
        // and any future card whose effect's value scales with a
        // turn-progressive state (Tanuki: more Rebelliokai in discard
        // = more draws) opts in via `cpuMeta.shouldActivateNow`. The
        // hook returns `false` to defer the activation; the loop adds
        // the inst to `tried` and moves on, and the `runMainPhase`
        // pass in MP2 (`tried` is re-initialized per call) re-tries
        // it once the rest-of-turn state has filled in.
        if (typeof script.cpuMeta?.shouldActivateNow === 'function') {
          let shouldFire = true;
          try {
            shouldFire = !!script.cpuMeta.shouldActivateNow(engine, cpuIdx);
          } catch { shouldFire = true; }
          if (!shouldFire) {
            tried.add(key);
            continue;
          }
        }

        pick = { heroIdx: hi, zoneSlot: zi, cardName, instId: inst.id, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;

    const hoptKey = `creature-effect:${pick.instId}`;
    cpuLog(`      → activate creature effect "${pick.cardName}" hero=${pick.heroIdx} zone=${pick.zoneSlot}`);
    const pickScript = loadCardEffect(pick.cardName);
    // alwaysCommit darf eine FUNKTION sein: (engine, cpuIdx) => bool.
    const pickAlwaysCommit = (typeof pickScript?.cpuMeta?.alwaysCommit === 'function'
      ? (() => { try { return !!pickScript.cpuMeta.alwaysCommit(engine, cpuIdx, CPU_META_HELPERS); } catch { return false; } })()
      : !!pickScript?.cpuMeta?.alwaysCommit);
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    const committed = await mctsGatedActivation(engine, helpers, `creature-effect ${pick.cardName}`,
      () => helpers.doActivateCreatureEffect(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneSlot: pick.zoneSlot }),
      { alwaysCommit: pickAlwaysCommit, evaluateThroughTurnEnd: pickEvalThroughTurnEnd });
    // Hat sie GEFEUERT? Das meldet der Server jetzt direkt, statt dass
    // wir es aus der Sperre ableiten. Karten mit mehreren Nutzungen pro
    // Runde lassen die Sperre bewusst offen — die alte Ableitung las
    // das als "nicht gefeuert" und verschenkte alle weiteren Nutzungen.
    const fired = engine.didActivationFire(hoptKey);
    const repeats = (repeatCount.get(pick.instId) || 0) + 1;
    repeatCount.set(pick.instId, repeats);
    cpuLog(`      ← creature effect "${pick.cardName}" ${committed && fired ? `OK (${repeats}.)` : 'SKIPPED/FAILED'}`);
    // Nur weiter anbieten, wenn wirklich gefeuert wurde. Ob noch eine
    // Nutzung übrig ist, entscheidet die Verfügbarkeitsprüfung oben im
    // nächsten Durchlauf — die Karte ist dafür die einzige Instanz.
    // Der Wiederholungs-Riegel ist reiner Livelock-Schutz, keine
    // Regelgrenze: er greift erst weit jenseits dessen, was eine Karte
    // legitim braucht.
    if (!committed || !fired || repeats >= MAX_ACTIVATION_REPEATS) tried.add(pick.key);
    await pauseAction(engine);
  }
}

// Coarse fingerprint of CPU progress during a Main Phase. If a full loop pass
// doesn't change this, there's nothing more to do.
function snapshotProgress(engine) {
  const ps = engine.gs.players[engine._cpuPlayerIdx];
  const supportCount = (ps.supportZones || []).reduce(
    (sum, hz) => sum + hz.reduce((s, slot) => s + (slot?.length || 0), 0), 0,
  );
  return ps.hand.length + '|' + ps.gold + '|' + supportCount + '|' + ps.abilityGivenThisTurn.filter(Boolean).length;
}

// ─── Discard-sensitive creature pre-pass ────────────────────────────────
// Some Creatures (Guardian Beasts archetype today; any future archetype
// with the same shape generically) gate their summon on "no cards in your
// discard pile". Once ANY card the player plays this turn lands in the
// discard pile (Spell, Attack, Artifact, Potion), the gate slams shut and
// no further copies can be summoned this turn — even paid ones. The
// existing Main-Phase order (artifacts → potions → … → fireAdditionalActions)
// would unconditionally lose the summon window by playing a discard-bound
// card first.
//
// This pre-pass runs BEFORE artifacts/potions and tries each
// discard-sensitive Creature in hand through the normal
// `mctsGatedActivation` path. The detection is generic — a Creature is
// "discard-sensitive" iff its `canSummon` returns true now AND would
// return false with one extra card in the discard pile. No card / archetype
// names are hard-coded.
//
// Why MCTS-friendly: each summon still goes through the gate, so the
// rollout sees the post-summon state (Guardian Beast on the board, plus
// whatever it'll do during the rest of the simulated turn). If the
// rollout shows the summon is genuinely worse than skipping (very rare —
// these creatures are specifically designed to be free or near-free),
// the gate refuses to commit, and the creature stays in hand for a
// later turn / Action Phase. The pre-pass merely ensures the option
// is EVALUATED before discard-bound plays consume the window.

function detectDiscardSensitiveSummon(script, engine, pi) {
  if (!script?.canSummon) return false;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;
  const ctx = { _engine: engine, cardOwner: pi };
  let beforeRes = false;
  try { beforeRes = !!script.canSummon(ctx); } catch { beforeRes = false; }
  if (!beforeRes) return false;
  // Probe with a placeholder name in the discard. We don't actually
  // mutate the canonical pile — push then pop so any other concurrent
  // reader sees the original state immediately after.
  const origDiscard = ps.discardPile;
  const probedDiscard = ['__cpu-probe__', ...(origDiscard || [])];
  ps.discardPile = probedDiscard;
  let afterRes = true;
  try { afterRes = !!script.canSummon(ctx); } catch { afterRes = true; }
  ps.discardPile = origDiscard;
  return beforeRes && !afterRes;
}

// ── Impact-Merkmale für den Schadens-Lernkanal ───────────────────────
// Karten mit `cpuProjectedDamage` melden Schaden + Zielliste; hier
// entstehen daraus die drei Merkmale, deren RELATIVE Gewichte das Profil
// im Training selbst ermittelt: Gesamtschaden, Hero-Kills, Creature-Kills.
// Bewusst getrennt geführt statt vorab verrechnet — welche Währung gilt,
// soll gelernt und nicht hier hart gesetzt werden.
function noteDamageImpact(engine, pi, cardName) {
  try {
    if (engine._inMctsSim || !cardName) return;
    // Eine Quelle für Logging UND Verbrauch — sonst driften Trainings-
    // Merkmale und Laufzeit-Score auseinander.
    const f = deckProfile.projectImpactFeatures(engine, pi, cardName);
    if (!f) return;
    if (!engine._damageImpactLog) engine._damageImpactLog = [];
    engine._damageImpactLog.push({ pi, c: cardName, t: engine.gs?.turn || 1, dmg: f.dmg, hk: f.hk, ck: f.ck });
  } catch { /* Telemetrie darf nie stören */ }
}

async function playDiscardSensitiveCreatures(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;
  const cardDB = engine._getCardDB();
  const tried = new Set();

  for (let safety = 0; safety < 12; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:playDiscardSensitiveCreatures#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    if (cpuPastDeadline(engine)) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Creature') continue;
      if ((cd.subtype || '').toLowerCase() === 'surprise') continue;
      const triedKey = cardName + '|' + handIdx;
      if (tried.has(triedKey)) continue;
      const script = loadCardEffect(cardName);
      if (!script) continue;
      if (script.cpuSkipProactive) continue;
      if (engine.gs?._cpuSkipProactiveNames?.has?.(cardName)) continue;
      // Discard-sensitive only — pure summons fall through to the regular
      // fireAdditionalActions / Action Phase paths.
      if (!detectDiscardSensitiveSummon(script, engine, cpuIdx)) continue;
      if (!isFirstTurnSafe(engine, cpuIdx, cardName, cd)) continue;

      const heroIdx = pickHeroForActionCard(engine, cpuIdx, cd, cardName);
      if (heroIdx < 0) continue;
      const v = engine.validateActionPlay(cpuIdx, cardName, handIdx, heroIdx, [cd.cardType]);
      if (!v) continue;
      if (!v.isMainPhase) continue;
      // Either the summon is itself an inherent additional Action (free
      // first-of-turn) OR there's an external additional-action source
      // available (Adventurousness, Friendship, etc.). If neither, the
      // summon would have to consume the Main Phase action — which we
      // don't have in MP1; defer to the regular fireAdditionalActions
      // pass so the loop's progress check doesn't infinite-spin trying
      // the same unplayable card.
      if (!v.isInherentAction) {
        const typeId = engine.findAdditionalActionForCard(cpuIdx, cardName, heroIdx);
        if (!typeId) continue;
      }
      const zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, heroIdx, cardName);
      if (zoneSlot < 0) continue;
      pick = { cardName, handIdx, heroIdx, zoneSlot };
      break;
    }
    if (!pick) return;

    // Tags der gewählten Karte VOR dem Play (nach dem Play ist sie weg
    // und das Board verändert — die Lage muss zum Zeitpunkt der
    // Entscheidung erfasst werden).
    let _pickTags = null;
    try { _pickTags = deckProfile.classifyPlayOrderTags(engine, cpuIdx, pick.cardName); } catch {}
    const handLenBefore = ps.hand.length;
    cpuLog(`      → discard-sensitive creature "${pick.cardName}" hero=${pick.heroIdx} zone=${pick.zoneSlot}`);
    const actionFn = async () => {
      maybeSetCrossSideHint(engine, cpuIdx, pick.cardName);
        await helpers.doPlayCreature(helpers.room, cpuIdx, {
        cardName: pick.cardName,
        handIndex: pick.handIdx,
        heroIdx: pick.heroIdx,
        zoneSlot: pick.zoneSlot,
      });
    };
    const pickScript = loadCardEffect(pick.cardName);
    // Always commit: by definition, if the summon doesn't happen NOW,
    // the next discard-bound play will permanently close the summon
    // window for this turn. The pre-pass exists to ensure this option
    // is taken — letting the gate refuse over a sub-1-point eval delta
    // misses the asymmetry. Card-specific cpuMeta opt-in still applies
    // for evaluateThroughTurnEnd if a card declares it.
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    const committed = await mctsGatedActivation(engine, helpers, `discard-sensitive ${pick.cardName}`, actionFn,
      { alwaysCommit: true, evaluateThroughTurnEnd: pickEvalThroughTurnEnd });
    // Gleiche Falle wie im Zusatz-Aktions-Pfad: dieser Zweig nutzt
    // denselben pickCreatureZoneSlot und kann damit ebenfalls auf einem
    // besetzten Slot landen — dann bleibt die Handlänge gleich und ein
    // geglückter Play würde als Fehlschlag in `tried` wandern. Heute
    // tragen die Discard-sensitiven Kreaturen (Guardian Beasts) den
    // Swap-Vertrag nicht, der Fall ist also vorsorglich abgedeckt.
    const shrank = ps.hand.length < handLenBefore;
    let placed = shrank;
    if (!placed) {
      try {
        placed = (ps.supportZones || []).some(hz => (hz || []).some(sl =>
          (sl || [])[0] === pick.cardName));
      } catch {}
    }
    cpuLog(`      ← discard-sensitive "${pick.cardName}" ${committed && placed ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || !placed) tried.add(pick.cardName + '|' + pick.handIdx);
    await pauseAction(engine);
  }
}

// ─── Artifacts ──────────────────────────────────────────────────────────
// Per user spec: "Artifacts are played as soon as they can be afforded, with
// Equips going on random Heroes, but any that give bonus atk will instead go
// on the highest-atk own Hero." Non-Equipment Artifacts that need targeting
// are skipped in 2b — they come back in sub-phase 2i with the targeting brain.

async function playArtifacts(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set(); // card names that look playable but failed to actually play

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:playArtifacts#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Artifact') continue;
      const plan = planArtifactPlay(engine, cpuIdx, cardName, handIdx, cd);
      if (plan) { pick = plan; break; }
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    // Count copies of the SPECIFIC artifact name in hand. Hand-size-only
    // checks misreport self-replacing artifacts as failed: Magnetic Glove
    // discards itself (-1 from hand) AND tutors a new card (+1 to hand),
    // leaving the hand size unchanged. The per-name count drops 1→0
    // when Glove resolves regardless of what tutored card was added.
    const myCardCountBefore = ps.hand.filter(n => n === pick.cardName).length;
    cpuLog(`      → play artifact "${pick.cardName}" (${pick.kind}) hero=${pick.heroIdx}`);
    const actionFn = async () => {
      if (pick.kind === 'equipment' || pick.kind === 'artifactCreature') {
        await helpers.doPlayArtifact(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot: -1,
        });
      } else {
        await helpers.doUseArtifactEffect(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
        });
        if (engine.gs.potionTargeting?.potionName === pick.cardName && engine.gs.potionTargeting.ownerIdx === cpuIdx) {
          await resolveTargetingPrompt(engine, helpers);
        }
      }
    };
    const pickScript = loadCardEffect(pick.cardName);
    const pickIsDrawOnly = !!pickScript?.blockedByHandLock;
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    // ── Status-Heilungs-Lernkanal ──
    // Karten mit cpuMeta.statusHealChannel (Coffee/Tea/Beer/Juice):
    // gelernte Kontext-Regel > Trainings-Exploration > Gate. Die
    // finale Entscheidung wird mit Kontext-Tags gestempelt, damit der
    // Trainer lernt, WANN Status-Heilung die Handkarte wert ist.
    // Verfügbarkeits-Zähler: Beantwortet für seltene Artifacts die
    // Diagnose-Frage "nie möglich oder vom Piloten abgelehnt?" ohne
    // manuelle Einzeluntersuchung (Slippery-Ice/Coffee/Ankh-Klasse).
    if (!engine._inMctsSim) {
      if (!engine._artifactPickStats) engine._artifactPickStats = [Object.create(null), Object.create(null)];
      const st = engine._artifactPickStats[cpuIdx];
      st[pick.cardName] = (st[pick.cardName] || 0) + 1;
    }
    const isStatusHeal = !!pickScript?.cpuMeta?.statusHealChannel;
    let healTags = null, healDecision = null;
    if (isStatusHeal) {
      healTags = deckProfile.classifyStatusHealContext(engine, cpuIdx);
      healDecision = deckProfile.statusHealDecision(engine, cpuIdx, pick.cardName, healTags);
      if (healDecision === 'skip') {
        try {
          if (!engine._inMctsSim) {
            if (!engine._statusHealLog) engine._statusHealLog = [];
            engine._statusHealLog.push({ pi: cpuIdx, c: pick.cardName, t: engine.gs?.turn || 0, tags: healTags, fired: 0 });
          }
        } catch { /* nie stören */ }
        tried.add(pick.cardName);
        continue;
      }
    }
    // alwaysCommit darf eine FUNKTION sein: (engine, cpuIdx) => bool.
    const pickAlwaysCommit = (typeof pickScript?.cpuMeta?.alwaysCommit === 'function'
      ? (() => { try { return !!pickScript.cpuMeta.alwaysCommit(engine, cpuIdx, CPU_META_HELPERS); } catch { return false; } })()
      : !!pickScript?.cpuMeta?.alwaysCommit);
    // Equipment / Artifact-Creature plays are long-term investments: the
    // body lands on the board and pays off over many turns. The
    // immediate-state gate sees only "−gold −1 hand card +30 slot",
    // which often nets negative — so the CPU has been refusing to
    // equip even when it has the gold and an eligible hero. Match
    // the user's intuition by always committing equipment plays once
    // planArtifactPlay has filtered for an eligible hero+zone.
    // Use-effect Artifacts (Fire Bomb, Magnetic Glove, …) still go
    // through the regular score gate.
    const pickIsEquipment = pick.kind === 'equipment' || pick.kind === 'artifactCreature';
    const committed = await mctsGatedActivation(engine, helpers, `artifact ${pick.cardName}`, actionFn,
      {
        alwaysCommit: liftCommitBypassForDraws(engine, cpuIdx, pickIsDrawOnly, true)
          || pickIsEquipment
          || liftCommitBypassForDraws(engine, cpuIdx, pickAlwaysCommit, !!pickScript?.cpuMeta?.activationDraws)
          || healDecision === 'play',
        evaluateThroughTurnEnd: pickEvalThroughTurnEnd,
      });
    const myCardCountAfter = ps.hand.filter(n => n === pick.cardName).length;
    // Magic Gems können per keepInHand in der Hand BLEIBEN (discard einer
    // anderen Karte) — der Per-Name-Zähler meldet dann fälschlich FAILED
    // und `tried` sperrte die Karte. Der HOPT-Claim ist das verlässliche
    // Erfolgssignal: Er wird in maybeKeepGemInHand unconditional gesetzt,
    // sobald der resolve lief.
    const hoptClaimedNow = engine.gs.hoptUsed?.[`${pick.cardName}:${cpuIdx}`] === engine.gs.turn;
    const consumed = (myCardCountAfter < myCardCountBefore) || hoptClaimedNow;
    cpuLog(`      ← artifact "${pick.cardName}" ${committed && consumed ? 'OK' : 'SKIPPED/FAILED'} (hand ${handLenBefore}→${ps.hand.length})`);
    // Status-Heilungs-Log: finale Entscheidung inkl. Gate-Ausgang.
    if (isStatusHeal) {
      try {
        if (!engine._inMctsSim) {
          if (!engine._statusHealLog) engine._statusHealLog = [];
          engine._statusHealLog.push({ pi: cpuIdx, c: pick.cardName, t: engine.gs?.turn || 0, tags: healTags, fired: committed && consumed ? 1 : 0 });
        }
      } catch { /* nie stören */ }
    }
    if (!committed || !consumed) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

function planArtifactPlay(engine, pi, cardName, handIdx, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  if (ps.itemLocked && (ps.hand || []).length < 2) return null;
  if (ps._creationLockedNames?.has(cardName)) return null;

  const rawCost = cardData.cost || 0;
  const costReduction = ps._nextArtifactCostReduction || 0;
  const cost = Math.max(0, rawCost - costReduction);
  if ((ps.gold || 0) < cost) return null;

  const subLower = (cardData.subtype || '').toLowerCase();
  const isEquip = subLower === 'equipment';
  const isArtifactCreature = subLower.split('/').some(t => t.trim() === 'creature');

  // Load the script up-front so the subtype dispatch can consult
  // `isTargetingArtifact`. Artifact-Creature hybrids that ALSO declare
  // `isTargetingArtifact: true` (Powder Keg etc.) skip the drag-to-own-Hero
  // path on the server (server.js doPlayArtifact rejects them), so the CPU
  // must route through the targeting/useEffect flow instead — otherwise
  // the call to `doPlayArtifact` silently fails and the card sticks in the
  // CPU's hand forever via the `tried` set in `playArtifacts`.
  const script = loadCardEffect(cardName);
  const isTargetingArtifact = !!script?.isTargetingArtifact;

  if (isEquip) {
    const heroIdx = pickHeroForEquip(engine, pi, cardName, cardData);
    if (heroIdx < 0) return null;
    return { kind: 'equipment', cardName, handIdx, heroIdx };
  }

  if (isArtifactCreature && !isTargetingArtifact) {
    const heroIdx = pickHeroForArtifactCreature(engine, pi);
    if (heroIdx < 0) return null;
    return { kind: 'artifactCreature', cardName, handIdx, heroIdx };
  }

  // Normal / Reaction / Area / targeting-creature Artifacts → doUseArtifactEffect path
  if (!script) return null;
  if (subLower === 'surprise') return null;
  if (subLower === 'reaction' && !script.proactivePlay) return null;
  // Pass `engine` as the 3rd arg — same shape as the server's
  // `doUseArtifactEffect` (server.js ~L6114/L6264). Some scripts'
  // canActivate gates need to walk `engine.cardInstances` for
  // per-instance state (e.g. Field Standard checks each Creature's
  // `creature-effect:${id}` HOPT to find "effect used this turn"
  // targets) and short-circuit to false when engine is absent. Without
  // this, those cards are invisible to the CPU planner.
  if (script.canActivate && !script.canActivate(gs, pi, engine)) return null;
  if (script.blockedByHandLock && ps.handLocked) return null;
  // Targeted artifacts (getValidTargets + targetingConfig) also go through
  // doUseArtifactEffect — the CPU brain's post-play step picks targets and
  // calls doConfirmPotion to finish resolution.
  const isTargeted = !!(script.getValidTargets && script.targetingConfig);
  if (!isTargeted && !script.resolve) return null;
  // Per-card CPU sanity gate. Cards whose value is strictly conditional
  // on board state (Golden Ankh's "only revive if I'll use the Hero
  // this turn", any future "useless without a follow-up" artifact)
  // can opt in via `cpuShouldPlay(engine, pi) → bool`. Returning false
  // makes the planner skip the play before the MCTS gate even runs —
  // saves the gold + hand card the gate's threshold sometimes lets
  // through on tiny positional deltas.
  if (typeof script.cpuShouldPlay === 'function') {
    let ok = true;
    try { ok = !!script.cpuShouldPlay(engine, pi); }
    catch (err) { console.error(`[cpu] cpuShouldPlay ${cardName} threw:`, err.message); ok = true; }
    if (!ok) return null;
  }
  return { kind: 'useEffect', cardName, handIdx, isTargeted };
}

// Re-entrancy guard for the protective-toggle equip valuation. The
// scoring it runs (mctsEnemyHeroDynamicValue → mctsEnemyHeroThreat →
// planArtifactPlay) re-invokes pickHeroForEquip for the SAME Equip,
// which would recurse forever (Bloody King Zi froze with Diver Helmet
// in hand: the swallowed stack-overflow spun the event loop, no dump).
// While true, the protective-toggle block takes a cheap, non-recursive
// pick instead of re-running the MCTS hero valuation.
let _inEquipHeroValuation = false;

function pickHeroForEquip(engine, pi, cardName, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const script = loadCardEffect(cardName);

  if (script?.oncePerGame) {
    const opgKey = script.oncePerGameKey || cardName;
    if (ps._oncePerGameUsed?.has(opgKey)) return -1;
  }

  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen) continue;
    if (hero.statuses?.charmed) continue;
    if (script?.canEquipToHero && !script.canEquipToHero(gs, pi, hi, engine)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    let hasFree = false;
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) { hasFree = true; break; }
    }
    if (hasFree) eligible.push(hi);
  }
  if (!eligible.length) return -1;

  // Protective-toggle equips (Diver Helmet): binary ON/OFF protection —
  // a 2nd copy on an already-protected Hero is pure waste. Per user
  // spec: never double-equip the same Hero, and if NO eligible Hero is
  // unprotected, don't play it at all (return -1 → planArtifactPlay
  // skips the play). Among unprotected eligible Heroes, send it to the
  // most valuable one, using the SAME hero-value criteria the MCTS
  // evaluator uses to rank the opponent's most valuable Hero
  // (`mctsEnemyHeroDynamicValue`) — applied here to our OWN side, so
  // "most valuable Hero to protect" stays consistent with the search's
  // own notion of Hero worth. Ties broken at random.
  if (script?.cpuMeta?.protectiveToggleEquip) {
    const hasNamedEquip = (hi) => (engine.cardInstances || []).some(c =>
      c && c.name === cardName && c.zone === 'support' && !c.faceDown
      && c.heroIdx === hi
      && (c.owner === pi || (c.controller ?? c.owner) === pi));
    const unprotected = eligible.filter(hi => !hasNamedEquip(hi));
    if (unprotected.length === 0) return -1;
    // Re-entrant call (we got here THROUGH the scoreOf valuation
    // below: mctsEnemyHeroDynamicValue → mctsEnemyHeroThreat →
    // planArtifactPlay → pickHeroForEquip). Do NOT recurse into the
    // MCTS valuation again — that's the infinite loop. A re-entrant
    // call only needs to answer "is there a legal Hero for this
    // Equip?" for the threat estimate, so return a cheap deterministic
    // pick (highest-HP unprotected eligible Hero).
    if (_inEquipHeroValuation) {
      let pickHi = unprotected[0];
      for (const hi of unprotected) {
        if ((ps.heroes[hi]?.hp || 0) > (ps.heroes[pickHi]?.hp || 0)) pickHi = hi;
      }
      return pickHi;
    }
    const teamMax = mctsTeamMaxSchoolLvl(gs, pi);
    const scoreOf = (hi) => {
      _inEquipHeroValuation = true;
      try { return mctsEnemyHeroDynamicValue(engine, pi, hi, teamMax); }
      catch { return 0; }
      finally { _inEquipHeroValuation = false; }
    };
    let bestV = -Infinity;
    for (const hi of unprotected) bestV = Math.max(bestV, scoreOf(hi));
    const top = unprotected.filter(hi => scoreOf(hi) === bestV);
    return top[Math.floor(Math.random() * top.length)];
  }

  // Ascension priority: if one of the eligible heroes needs this equipment
  // for their ascension (Arthor's Sword/Circle, Layn's Hammer, etc.), send
  // it there first — overrides every other selector.
  const ascHi = ascensionTargetHero(engine, pi, cardName, cardData);
  if (ascHi >= 0 && eligible.includes(ascHi)) return ascHi;
  // Ascension-Equip, aber der Ziel-Held ist nur wegen VOLLER Support-
  // Slots nicht eligible (lebt, nicht frozen/charmed): NICHT ausweichen.
  // Ein Summoning Circle auf Jenny ist eine verbrannte Ascension-
  // Ressource (1-2 Kopien im Deck!) — lieber in der Hand halten, bis
  // bei Arthor ein Slot frei wird; Kreaturen sterben ständig. Live
  // beobachtet in Shadows over Blackport: Circle@Jenny/Bill, sobald
  // Arthors Zonen belegt waren.
  if (ascHi >= 0) {
    const ascHero = ps.heroes[ascHi];
    const blockedOnlyBySlots = ascHero?.name && ascHero.hp > 0
      && !ascHero.statuses?.frozen && !ascHero.statuses?.charmed;
    if (blockedOnlyBySlots) {
      cpuLog(`      [equip] "${cardName}" ist Ascension-Equip für hero=${ascHi}, dessen Slots sind voll — halte statt auszuweichen`);
      return -1;
    }
  }

  // Card-specific preference: Slippery Skates / future equipments can export
  // `cpuPrefersEquipTarget(engine, pi, hi, cardData)` to narrow eligible to
  // the heroes that actually benefit (e.g. Skates prefers summoner heroes).
  // If ANY eligible hero matches, restrict to that subset; otherwise keep
  // the full list so a suboptimal placement still beats not playing at all.
  let pool = eligible;
  if (typeof script?.cpuPrefersEquipTarget === 'function') {
    const preferred = pool.filter(hi => {
      try { return !!script.cpuPrefersEquipTarget(engine, pi, hi, cardData); }
      catch { return false; }
    });
    if (preferred.length > 0) pool = preferred;
  }

  // Numeric ranking within the preferred pool. Skates uses this to send
  // itself to the highest-summoning-level hero (Ascended Beato = Lv9
  // virtual, beats any real-Lv1 summoner) instead of picking at random.
  if (typeof script?.cpuEquipTargetScore === 'function') {
    const scored = pool.map(hi => {
      let score = 0;
      try { score = Number(script.cpuEquipTargetScore(engine, pi, hi, cardData)) || 0; }
      catch { score = 0; }
      return { hi, score };
    });
    const maxScore = Math.max(...scored.map(s => s.score));
    if (Number.isFinite(maxScore) && maxScore > 0) {
      const top = scored.filter(s => s.score === maxScore).map(s => s.hi);
      return top[Math.floor(Math.random() * top.length)];
    }
  }

  // Gelernte Platzierungs-Priors (equipPriors, "Equip@Held"): greifen
  // NACH der Ascension-Priorität und den kartenseitigen Hooks —
  // handgeschriebenes Plan-Wissen schlägt Statistik (Butterflies-Lehre).
  // Nur ein klar positiver Prior übernimmt die Wahl; negative Priors
  // werden gemieden, indem sie im Vergleich verlieren.
  {
    let bestHi = -1, bestV = 0;
    for (const hi of pool) {
      const heroName = ps.heroes[hi]?.name;
      if (!heroName) continue;
      // Karte→Held-Prior (equipPriors) + gelernte Same-Hero-Synergie
      // (boardPairs): Howitzer zieht zum Shield-of-Life-Träger, sobald
      // das Paar in den Trainingsdaten Wirkung gezeigt hat.
      const v = deckProfile.equipPlacementBonus(engine, pi, cardName, heroName)
        + deckProfile.boardPairBonus(engine, pi, cardName, hi);
      if (v > bestV) { bestV = v; bestHi = hi; }
    }
    if (bestHi >= 0 && bestV >= 4) {
      cpuLog(`      [equip] gelernter Platzierungs-Prior: "${cardName}" → hero=${bestHi} (+${bestV.toFixed(1)})`);
      return bestHi;
    }
  }

  // Atk-boost Equipments go on the highest-atk eligible hero; ties broken at random.
  if (isAtkBoostEquip(cardData)) {
    let topAtk = -Infinity;
    for (const hi of pool) topAtk = Math.max(topAtk, ps.heroes[hi].atk || 0);
    const tied = pool.filter(hi => (ps.heroes[hi].atk || 0) === topAtk);
    return tied[Math.floor(Math.random() * tied.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickHeroForArtifactCreature(engine, pi) {
  const ps = engine.gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const zones = ps.supportZones?.[hi] || [[], [], []];
    let hasFree = false;
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) { hasFree = true; break; }
    }
    if (hasFree) eligible.push(hi);
  }
  if (!eligible.length) return -1;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ─── Potions ────────────────────────────────────────────────────────────
// Per user spec: "Potions are always used as soon as possible (be mindful of
// the 'You cannot use more Potions this turn' lock!)". Targeted Potions are
// deferred to sub-phase 2i — the targeting brain.

async function playPotions(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:playPotions#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
    if (ps.potionLocked) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Potion') continue;
      if (isPotionPlayable(engine, cpuIdx, cardName)) {
        pick = { cardName, handIdx };
        break;
      }
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    const potCountBefore = ps.hand.filter(n => n === pick.cardName).length;
    cpuLog(`      → use potion "${pick.cardName}"`);
    const actionFn = async () => {
      await helpers.doUsePotion(helpers.room, cpuIdx, {
        cardName: pick.cardName,
        handIndex: pick.handIdx,
      });
      if (engine.gs.potionTargeting?.potionName === pick.cardName && engine.gs.potionTargeting.ownerIdx === cpuIdx) {
        await resolveTargetingPrompt(engine, helpers);
      }
    };
    const pickScript = loadCardEffect(pick.cardName);
    const pickIsDrawOnly = !!pickScript?.blockedByHandLock;
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    // Future-trigger / permanent-placing potions (Elixir of Immortality,
    // any "place this card openly in front of you" effect) opt into
    // alwaysCommit so the gate doesn't refuse them just because the
    // immediate post-play eval doesn't see the multi-turn payoff.
    // alwaysCommit darf eine FUNKTION sein: (engine, cpuIdx) => bool.
    const pickAlwaysCommit = (typeof pickScript?.cpuMeta?.alwaysCommit === 'function'
      ? (() => { try { return !!pickScript.cpuMeta.alwaysCommit(engine, cpuIdx, CPU_META_HELPERS); } catch { return false; } })()
      : !!pickScript?.cpuMeta?.alwaysCommit);
    const committed = await mctsGatedActivation(engine, helpers, `potion ${pick.cardName}`, actionFn,
      {
        alwaysCommit: pickIsDrawOnly || pickAlwaysCommit,
        evaluateThroughTurnEnd: pickEvalThroughTurnEnd,
      });
    // Erfolg = diese Potion-Kopie wurde verbraucht. NICHT hand.length —
    // Draw-Potions (Elixir of Quickness: −1 Potion, +3 Karten) lassen
    // die Hand NETTO WACHSEN; das alte shrank-Kriterium loggte dann
    // fälschlich SKIPPED/FAILED und sperrte weitere Kopien via tried.
    const potCountAfter = ps.hand.filter(n => n === pick.cardName).length;
    const consumed = potCountAfter < potCountBefore;
    cpuLog(`      ← potion "${pick.cardName}" ${committed && consumed ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || !consumed) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

function isPotionPlayable(engine, pi, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (ps.potionLocked) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;

  const script = loadCardEffect(cardName);
  if (!script?.isPotion) return false;
  if (script.canActivate && !script.canActivate(gs, pi, engine)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;
  // Targeted Potions play via doUsePotion → gs.potionTargeting → resolveTargetingPrompt.
  const isTargeted = !!(script.getValidTargets && script.targetingConfig);
  if (!isTargeted && !script.resolve) return false;
  // First-turn shield: damage / debuff / forced-discard Potions (Bottled
  // Flame, Bottled Lightning, …) waste their effect under the opponent's
  // turn-1 immunity. The same gate that filters Spells/Attacks applies.
  const cd = engine._getCardDB()[cardName];
  if (cd && !isFirstTurnSafe(engine, pi, cardName, cd)) return false;
  return true;
}

// ─── Surprises ──────────────────────────────────────────────────────────
// Per user spec: "CPU will only place Surprises face-down with Heroes that
// can actually use them." Bakhm's Support Zones count as legal placements
// for Surprise Creatures.

async function placeSurprises(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:placeSurprises#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      const script = loadCardEffect(cardName);
      if (!script?.isSurprise) continue;
      const placement = pickSurprisePlacement(engine, cpuIdx, cd);
      if (!placement) continue;
      pick = { cardName, handIdx, ...placement };
      break;
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    cpuLog(`      → set surprise "${pick.cardName}" hero=${pick.heroIdx} bakhmSlot=${pick.bakhmSlot}`);
    await helpers.doPlaySurprise(helpers.room, cpuIdx, {
      cardName: pick.cardName,
      handIndex: pick.handIdx,
      heroIdx: pick.heroIdx,
      bakhmSlot: pick.bakhmSlot,
    });
    const shrank = ps.hand.length < handLenBefore;
    cpuLog(`      ← surprise "${pick.cardName}" ${shrank ? 'OK' : 'FAILED'}`);
    if (!shrank) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

// Returns { heroIdx, bakhmSlot } describing where to place the Surprise, or
// null if no Hero can both host AND activate it. bakhmSlot is -1 for a normal
// Surprise-Zone placement and 0..2 for a Bakhm Support-Zone slot.
function pickSurprisePlacement(engine, pi, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const options = [];

  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    // The rules allow preparing Surprises with Heroes that can't activate them,
    // but the user's CPU spec explicitly requires placement only on Heroes that
    // CAN — so we gate on the level-requirement check used by Attacks/Spells.
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;

    // Regular Surprise-Zone placement — one per Hero.
    if ((ps.surpriseZones?.[hi] || []).length === 0) {
      options.push({ heroIdx: hi, bakhmSlot: -1 });
    }

    // Bakhm Support-Zone placement for Surprise Creatures only. Bakhm must
    // not be Frozen / Stunned / Negated at placement time (the handler also
    // enforces this, and will reject).
    if (cardData.cardType === 'Creature'
        && !hero.statuses?.frozen
        && !hero.statuses?.stunned
        && !hero.statuses?.negated) {
      const heroScript = loadCardEffect(hero.name);
      if (heroScript?.isBakhmHero) {
        const zones = ps.supportZones?.[hi] || [[], [], []];
        for (let z = 0; z < 3; z++) {
          if ((zones[z] || []).length === 0) {
            options.push({ heroIdx: hi, bakhmSlot: z });
          }
        }
      }
    }
  }

  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

// Resolve the gs.potionTargeting picker that doUsePotion / doUseArtifactEffect
// open for targeted Artifacts and Potions. Uses the targeting brain's picker
// (same one that drives _getCpuTargetResponse) to choose, then calls
// doConfirmPotion to finish the play. Safety-cap iteration in case resolution
// triggers a re-enter-targeting flow (aborted picks).
async function resolveTargetingPrompt(engine, helpers) {
  for (let safety = 0; safety < 4; safety++) {
    const tgt = engine.gs.potionTargeting;
    if (!tgt || tgt.ownerIdx !== engine._cpuPlayerIdx) return;
    // Inject the card name as `title` so `_getCpuTargetResponse` can find
    // the per-card `cpuResponse` override (engine.js:1416 reads
    // `config.title` to identify the card). Targeting-artifact scripts
    // typically omit `title` from their static `targetingConfig` since
    // the targeting UI doesn't render it — but the CPU brain's per-card
    // dispatch needs it, so we merge `potionName` in here as the
    // canonical fallback.
    const cfg = { title: tgt.potionName, ...(tgt.config || {}) };
    const picks = engine._getCpuTargetResponse(tgt.validTargets || [], cfg);
    const selectedIds = Array.isArray(picks) ? picks : [];
    cpuLog(`      → confirm targeting "${tgt.potionName}" selectedIds=${JSON.stringify(selectedIds)}`);
    await helpers.doConfirmPotion(helpers.room, engine._cpuPlayerIdx, { selectedIds });
    // If doConfirmPotion re-opened targeting (aborted pick), loop to try again
    // with fresh targets.
    if (engine.gs.potionTargeting?.potionName !== tgt.potionName) return;
  }
  // Safety exceeded — clear stuck targeting so the turn can continue.
  if (engine.gs.potionTargeting?.ownerIdx === engine._cpuPlayerIdx) {
    cpuLog('      ← resolveTargetingPrompt safety cap hit — clearing');
    engine.gs.potionTargeting = null;
  }
}

// ─── First-turn safety ────────────────────────────────────────────────
// Per user spec: on the CPU's first turn when going FIRST, the engine's
// firstTurnProtectedPlayer shield makes any damage/debuff/enemy-targeting
// effect fizzle. Skip cards that would be wasted.
//   • Attacks → always skip (they exist to deal damage).
//   • Spells → skip if getValidTargets only returns enemy-side targets.
//     Spells without getValidTargets (draws, own-side buffs, areas) play.
//   • Creatures → always play (the body lands on the board even if the
//     onPlay effect fizzles — matches "mandatory effects still fire" from
//     the user spec; Fiery Slime summons and its burn on the opponent
//     simply no-ops under the shield).
// A script can explicitly set `firstTurnSafe: true|false` to override.
// Check whether this card has at least one non-immune viable target right
// now. For Creatures we always return true — the body lands on the board
// regardless of whether any onPlay effect would fizzle into immunity.
// For Attacks / Spells with a `getValidTargets` function, we run it and
// verify that either (a) any own-side or neutral target is present (the
// spell is a buff/heal/area — self-targeting makes it useful), or (b) at
// least one enemy-side target is not immune via isTargetImmune. Cards
// that don't export getValidTargets get a "true" fallback — we can't
// tell statically, so let the picker / MCTS handle it at runtime.
function cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cardData) {
  if (!cardData) return true;
  if (cardData.cardType === 'Creature') return true; // body always useful
  const script = loadCardEffect(cardName);
  if (!script?.getValidTargets) return true;
  let targets;
  try {
    targets = script.getValidTargets(engine.gs, cpuIdx, engine);
  } catch { return true; }
  if (!Array.isArray(targets) || targets.length === 0) return true;
  // Any own-side or ownerless target = usable (buff / heal / area).
  if (targets.some(t => t.owner === cpuIdx || t.owner == null)) return true;
  // All remaining targets are enemy-side. At least one must be non-immune.
  return targets.some(t => !isTargetImmune(engine, t));
}

// ─── Ascension / virtual-school helpers ─────────────────────────────────
// Hero card scripts may export:
//   ascensionNeedsCard(cardName, cardData, engine, pi, hi) → bool
//   ascensionProgress(engine, pi, hi) → 0..1
//   virtualSpellSchoolLevel → number or (school, engine, pi, hi) → number
//   rejectsAbility(abilityName, cardData) → bool
// The helpers below read those off the live hero's script and let the CPU
// route cards onto the hero that benefits most (Arthor's Sword, Beato's
// spells of an unclaimed school, etc.) and block wasteful attachments
// (Spell-School abilities onto Ascended Beato).

function heroNeedsCardForAscension(engine, pi, hi, cardName, cardData) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  const script = loadCardEffect(hero.name);
  if (typeof script?.ascensionNeedsCard !== 'function') return false;
  try {
    if (!script.ascensionNeedsCard(cardName, cardData, engine, pi, hi)) return false;
  } catch { return false; }
  // Spell / Creature progressers must ALSO be playable by THIS hero.
  // Beato collects orbs only when SHE casts the spell or summons the
  // creature (other heroes' plays don't tick her orbs), so a Lv5
  // Cardinal Beast that nominally matches her uncollected Summoning
  // orb is still useless to her pre-Ascension — she can't actually
  // cast it. Without this gate the gallery-tutor heuristic (Magnetic
  // Glove, Brilliant Idea) and the hand-value boost both treat
  // Cardinal Beasts as "Ascension-critical" and waste tutors on them.
  // Equipment-collection ascensions (Layn / Arthor) skip this gate
  // since their critical cards are Artifacts, not Spell / Creature.
  if (cardData?.cardType === 'Spell' || cardData?.cardType === 'Creature') {
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) return false;
  }
  return true;
}

function ascensionTargetHero(engine, pi, cardName, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return -1;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (heroNeedsCardForAscension(engine, pi, hi, cardName, cardData)) return hi;
  }
  return -1;
}

// True when the player owns at least one living, not-yet-Ascended Hero whose
// script declares an `ascensionNeedsCard` contract — i.e. the CPU has an
// active Ascension plan to work toward. Used to gate the hard-priority
// overrides (candidate pre-sort, gallery tutor preference, hand-value boost)
// so the overrides don't fire when no Ascended Hero is in play.
function playerHasUnfulfilledAscension(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.ascensionReady) continue;
    const script = loadCardEffect(hero.name);
    if (typeof script?.ascensionNeedsCard === 'function') return true;
  }
  return false;
}

// True when the given card would progress SOME hero's Ascension right now.
// Walks every hero and asks its script's `ascensionNeedsCard`. For Beato
// that matches Spells / Creatures of an uncollected school; for Layn/Arthor
// that matches the named Equip(s) they still need.
function cardIsAscensionCriticalForAnyHero(engine, pi, cardName, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (heroNeedsCardForAscension(engine, pi, hi, cardName, cardData)) return true;
  }
  return false;
}

// True when playing this Action-Phase candidate (Spell / Creature / Attack)
// would progress an Ascension. Restricted to `candidate.heroIdx` because
// Beato only ticks an orb when SHE is the caster — a spell of her missing
// school cast by a different hero does NOT progress her. Layn/Arthor's
// critical cards are equipments played in the Main Phase and don't reach
// this check, but the same per-hero rule applies.
function candidateProgressesAscension(engine, pi, candidate, cardDB) {
  if (!candidate || candidate.cardType === 'AbilityAction'
      || candidate.cardType === 'HeroEffectAction') return false;
  const hi = candidate.heroIdx;
  if (hi == null) return false;
  const cd = cardDB[candidate.cardName];
  if (!cd) return false;
  return heroNeedsCardForAscension(engine, pi, hi, candidate.cardName, cd);
}

// True when a hero is either (a) already in their Ascended form, or
// (b) in a pre-Ascension form whose script declares an `ascensionNeedsCard`
// contract. These heroes are the deck's plan pieces — losing one derails
// the whole win condition — so revive / protection / healing effects
// should treat them as the highest-priority target.
function isAscendedOrAscendableHero(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name) return false;
  const cd = engine._getCardDB()[hero.name];
  if (cd?.cardType === 'Ascended Hero') return true;
  const script = loadCardEffect(hero.name);
  return typeof script?.ascensionNeedsCard === 'function';
}

function targetIsAscendedOrAscendableHero(engine, t) {
  if (t?.type !== 'hero') return false;
  return isAscendedOrAscendableHero(engine, t.owner, t.heroIdx);
}

function heroRejectsAbility(engine, pi, hi, abilityName, cardData) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name) return false;
  const script = loadCardEffect(hero.name);
  if (typeof script?.rejectsAbility !== 'function') return false;
  try { return !!script.rejectsAbility(abilityName, cardData); }
  catch { return false; }
}

function effectiveSpellSchoolLevel(engine, pi, hi, school) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return 0;
  const abZones = ps.abilityZones?.[hi] || [];
  const real = engine.countAbilitiesForSchool(school, abZones);
  const heroScript = loadCardEffect(hero.name);
  const v = heroScript?.virtualSpellSchoolLevel;
  let floor = 0;
  if (typeof v === 'function') {
    try { const f = v(school, engine, pi, hi); if (f != null) floor = f; } catch {}
  } else if (typeof v === 'number') {
    floor = v;
  }
  return Math.max(real, floor);
}

function isFirstTurnSafe(engine, cpuIdx, cardName, cardData) {
  const gs = engine.gs;
  const oppIdx = cpuIdx === 0 ? 1 : 0;
  // Not turn 1, or opponent isn't the shielded side → all plays are fine.
  if (gs.firstTurnProtectedPlayer !== oppIdx) return true;
  // Creatures always play — only their effects might fizzle, not their presence.
  if (cardData.cardType === 'Creature') return true;
  // Abilities, Heroes, Areas, Permanents play freely; only attack-shaped
  // cards (Spells/Attacks/Potions) can waste damage/debuffs on the shield.
  if (cardData.cardType !== 'Attack' && cardData.cardType !== 'Spell' && cardData.cardType !== 'Potion') return true;

  const script = loadCardEffect(cardName);
  if (script?.firstTurnSafe === true) return true;
  if (script?.firstTurnSafe === false) return false;

  // Attacks all deal damage — always wasted under the first-turn shield.
  if (cardData.cardType === 'Attack') return false;

  // Spells with a declared `getValidTargets`: play only if at least one
  // non-enemy target is available (own-side, areas, or no-owner targets).
  if (cardData.cardType === 'Spell' && script?.getValidTargets) {
    try {
      const targets = script.getValidTargets(gs, cpuIdx, engine) || [];
      if (targets.length === 0) return true; // Nothing to hit either way; don't block on this.
      return targets.some(t => t.owner === cpuIdx || t.owner == null);
    } catch {
      return true; // If the script throws, fall back to playing.
    }
  }

  // No `getValidTargets` — does NOT imply "no targeting". A large class of
  // damage Spells (Icebolt, Eraser Beam, etc.) use inline
  // `ctx.promptDamageTarget` calls inside their onPlay hook rather than
  // declaring the target set upfront. Inspect the card's effect text for
  // verbs that describe enemy-directed effects; when any fire, treat as
  // UNSAFE so the CPU holds the spell instead of wasting it on a shielded
  // target. Generic drawn / self-buff / area Spells contain none of these
  // verbs and stay safe. Card authors can still force either side via the
  // `firstTurnSafe` flag above — that wins over this heuristic.
  const effect = (cardData.effect || '').toLowerCase();
  // "deal X damage" / "deals damage" — direct damage Spells.
  if (/\bdeal(s|ing)?\b[^.]*\bdamage\b/.test(effect)) return false;
  // "takes X damage" / "take damage" — indirect-target damage where the
  // opponent picks (Chain Lightning, Bottled Lightning), or where status
  // ticks land on a target. Either way the damage routes through someone
  // who is shielded turn 1.
  if (/\btake(s|n)?\b[^.]*\bdamage\b/.test(effect)) return false;
  // "X damage" without an explicit verb — covers "150 damage to each enemy"
  // and similar patterns where the verb is implicit.
  if (/\b\d+\s*damage\b/.test(effect)) return false;
  if (/\bdestroy(s|ed|ing)?\b/.test(effect)) return false;
  // Status / debuff / disruption verbs. "are Burned", "is Frozen" etc.
  // need the bare adjectives to match because the card text uses the
  // status as a state ("All targets that player controls are Burned").
  if (/\b(freeze|frozen|stun|stunned|burn|burned|poison|poisoned|negate|negated|silence|silenced|steal|stole|stolen|discard|mill)\b/.test(effect)) return false;
  // Cards that explicitly route effects through the opponent's choice
  // ("your opponent has to choose", "opponent chooses") almost certainly
  // resolve on opponent-controlled targets — wasted under the shield.
  if (/your opponent[^.]*\b(choose|choos|pick|select|discard|lose|take)/.test(effect)) return false;
  return true;
}

// ─── Additional-Action Attacks / Spells / Creatures in Main Phase ──────
// Per user spec: "Use additional Actions as soon as they are available; if an
// Attack/Spell/Creature summon is an inherent or conditional additional Action
// and the condition is met, the CPU should just fire it out!"
// Hero selection rules (Main-Phase firing):
//   • Spells    → highest matching Spell-School level (preferred)
//   • Creatures → lowest matching Spell-School level, tiebreak: most free
//                 Support Zones, then random
//   • Attacks   → highest atk
// Targeting is left to the engine's default CPU auto-responder until 2i.

/**
 * Kostet diese Beschwoerung mehr als die Handkarte?
 *
 * Der Gratis-Bypass darf NUR greifen, wenn "inhaerente Aktion" wirklich
 * "umsonst" heisst. Bei Opfer-Beschwoerungen ist das Gegenteil der Fall:
 * Steam Dwarf Dragon Pilots `inherentAction` liefert
 * `engine.canSatisfySacrifice(...)` — die Gratis-Aktion wird gewaehrt,
 * WEIL zwei eigene Kreaturen bezahlt werden. Ein Bypass liest das als
 * "kostenlos" und heisst in Wahrheit "opfere immer". Genau diese Karte
 * steckt 4× in Steam Dwarf Mines, dem Matchup, in dem Als Training zwei
 * Mal stehenblieb.
 *
 * Erkannt an den STRUKTURELLEN Vertraegen der Opfer-/Bounce-Familie,
 * nicht an Kartennamen: wer auf besetzte Slots legen darf oder die
 * Freie-Zone-Pflicht umgehen darf, raeumt sich den Platz mit etwas frei,
 * das schon dasteht. Dazu ein ausdrueckliches Opt-out fuer Sonderfaelle.
 */
function summonCostsMoreThanTheCard(script) {
  if (!script) return false;
  if (script.cpuMeta?.freeSummonBypass === false) return true;
  return !!(script.sacrificeSpec
    || script.canBypassFreeZoneRequirement
    || script.canPlaceOnOccupiedSlot
    || script.getBouncePlacementTargets);
}

async function fireAdditionalActions(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // ── Flashbang gate ──
  // Each inherent / additional Spell / Attack / Creature play counts
  // as an Action and would burn Flashbang's one-shot trigger here in
  // Main Phase 1 — leaving Action Phase impotent. Skip in MP1 so the
  // brain saves its action for Action Phase's full card pool. Allow
  // in Main Phase 2 as a fallback if Action Phase had no legal play
  // (otherwise the turn ends with the trigger wasted on nothing).
  if (isCpuFlashbanged(engine) && gs.currentPhase === 2) {
    cpuLog('  fireAdditionalActions: skipping in MP1 (Flashbanged — saving sole Action for Action Phase)');
    swapDiag(engine, 'summon:aus-flashbang-mp1');
    return;
  }

  // Remember which (card, hero) pairs we've already TRIED so we don't retry
  // the same pick if the play silently fails and leaves the card in hand.
  // This prevents a 20-iteration stall when a card passes eligibility but
  // the handler rejects it on a deeper check we didn't foresee.
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:fireAdditionalActions#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    let pick = null;
    // Hand iteration order: non-deferred cards first, then any cards
    // tagged `cpuMeta.cpuDeferUntilLast: true` (Gigantisaur Chimera,
    // any future "summoning me ends the turn" card). The deferred
    // pass only fires when no non-deferred pick is viable, so the
    // CPU exhausts all other plays before committing to the
    // turn-ending one.
    const handOrder = [];
    // ── Opfer-Bedingung erfüllt → Karte vorziehen (gelernt) ──────────
    // Als Ruling: sind die Voraussetzungen für eine Opfer-Beschwörung
    // gerade erfüllt (bei Deepsea "2 Lv-2-Kreaturen bounce-bar" = "DDG
    // castbar"), soll die CPU HART diese Karte priorisieren, statt die
    // Konstellation vorher durch andere Plays aufzulösen. Die Hand wurde
    // bisher schlicht in Reihenfolge durchlaufen — eine erfüllbare
    // Opfer-Karte hatte keinerlei Vorrang. Erkannt wird das generisch
    // über den `sacrificeSpec`-Vertrag; die STÄRKE des Vorrangs kommt
    // aus dem gelernten Gewicht `spec:ready` (Kanal bounceRules), ist
    // also nicht hartkodiert: ohne Profil bleibt die Reihenfolge exakt
    // wie bisher, und der Trainer kann die Regel auch widerlegen.
    const _specFirst = [];
    if (deckProfile.specReadyPrior(engine, cpuIdx) > 0) {
      for (let i = 0; i < ps.hand.length; i++) {
        try {
          if (deckProfile.sacrificeSpecReady(engine, cpuIdx, ps.hand[i])) _specFirst.push(i);
        } catch { /* defensiv */ }
      }
      if (_specFirst.length) {
        cpuLog(`  fireAdditionalActions: Opfer-Bedingung erfüllt → ${_specFirst.map(i => ps.hand[i]).join(', ')} vorgezogen`);
        handOrder.push(..._specFirst);
      }
    }
    // ── Ausspiel-Reihenfolge: gelernte Priorität statt Handposition ──
    // Als Ruling: die CPU soll lernen, WELCHE Karten jede Runde die
    // höchste Ausspiel-Priorität haben. Bisher lief dieser Block in
    // ROHER Handreihenfolge — welche der spielbaren Karten zuerst
    // drankam, hing an ihrer zufälligen Position auf der Hand. Bei
    // Gratis-Aktionen ist die Reihenfolge aber entscheidend, weil die
    // ersten Plays die späteren erst ermöglichen (Grant-Geber, Tutor,
    // Board-Material für Opfer-Beschwörungen).
    //
    // Sortiert wird nach gelerntem Kartenwert plus dem Tag-Kanal
    // `playOrderRules` — beides aus dem Profil, nichts hartkodiert.
    // Ohne Profil liefern beide 0/null → stabile Sortierung lässt die
    // Handreihenfolge exakt wie bisher. `cpuDeferUntilLast` bleibt
    // die harte Nachhut und wird von der Sortierung nicht angetastet.
    const _orderScore = (i) => {
      const nm = ps.hand[i];
      let s = 0;
      try {
        const v = deckProfile.learnedCardValue(engine, cpuIdx, nm);
        if (typeof v === 'number') s += v * 0.1;
        s += deckProfile.playOrderPrior(engine, cpuIdx,
          deckProfile.classifyPlayOrderTags(engine, cpuIdx, nm));
      } catch { /* defensiv */ }
      return s;
    };
    const _rank = (arr) => arr
      .map((i, k) => ({ i, k, s: _orderScore(i) }))
      .sort((a, b) => (b.s - a.s) || (a.k - b.k))   // stabil bei Gleichstand
      .map(o => o.i);
    // ── AUSSPIEL-VORFAHRT (31.7.) ─────────────────────────────────────
    // Spiegel des vorhandenen `cpuDeferUntilLast`: Karten mit
    // `cpuMeta.playOrderPriority` (Zahl, größer = früher) gehen VOR das
    // gelernte Ranking. Grund: bei einem Enabler ist die Reihenfolge
    // keine Wertfrage, sondern eine KAUSALE Bedingung — er muss vor den
    // Karten liegen, die er bezahlt, sonst ist sein Grant im selben Zug
    // nutzlos. Das kann der Wert-Term gar nicht ausdrücken: er geht mit
    // Faktor 0.1 in den Score ein (Spanne 0.8-10), die gelernten
    // Reihenfolge-Gewichte mit ±15. Selbst der Maximalwert 100 könnte
    // einen negativen Tag nicht überstimmen.
    // Gemessen im v111-Lauf: Werewolf 541 Plays über den Gratis-Pfad,
    // Primordium 46 — der Enabler kam 12× seltener zum Zug als die
    // Karte, die er finanziert.
    // Ohne den Vertrag ändert sich nichts (Liste bleibt leer).
    const _vanguard = [];
    for (let i = 0; i < ps.hand.length; i++) {
      if (_specFirst.includes(i)) continue;
      const pr = loadCardEffect(ps.hand[i])?.cpuMeta?.playOrderPriority;
      if (typeof pr === 'number') _vanguard.push({ i, pr });
    }
    // Gleichstand innerhalb der Vorhut entscheidet das GELERNTE Ranking,
    // erst danach die Handposition: der Designer setzt die STUFE ("diese
    // Karte muss vor die anderen"), die Reihenfolge INNERHALB der Stufe
    // bleibt lernbar. Ohne Profil ist _orderScore für alle 0 → stabile
    // Sortierung nach Handposition, also exakt das alte Verhalten.
    _vanguard.sort((a, b) => (b.pr - a.pr)
      || (_orderScore(b.i) - _orderScore(a.i))
      || (a.i - b.i));
    const _vanIdx = _vanguard.map(o => o.i);
    const _mainIdx = [], _lastIdx = [];
    for (let i = 0; i < ps.hand.length; i++) {
      if (_specFirst.includes(i) || _vanIdx.includes(i)) continue;   // schon vorgezogen
      const s = loadCardEffect(ps.hand[i]);
      (s?.cpuMeta?.cpuDeferUntilLast ? _lastIdx : _mainIdx).push(i);
    }
    handOrder.push(..._vanIdx, ..._rank(_mainIdx), ..._rank(_lastIdx));
    for (const handIdx of handOrder) {
      const cardName = ps.hand[handIdx];
      const cd = cardDB[cardName];
      if (!cd) continue;
      const ct = cd.cardType;
      if (ct !== 'Spell' && ct !== 'Attack' && ct !== 'Creature') continue;
      // Surprises must be set, not played (handled by placeSurprises).
      if ((cd.subtype || '').toLowerCase() === 'surprise') continue;

      // Per-card opt-out: card can declare itself "never proactively played"
      // (e.g. Golden Wings — Reaction-only). Also: a per-game runtime
      // skip list (`gs._cpuSkipProactiveNames`) lets self-play tests
      // and puzzle/scripted scenarios block specific cards from being
      // proactively played without modifying their scripts.
      const script = loadCardEffect(cardName);
      if (script?.cpuSkipProactive) continue;
      if (engine.gs?._cpuSkipProactiveNames?.has?.(cardName)) continue;
      // Hero-removal / sacrifice-style cards (Divine Gift of Sacrifice, etc.)
      // should fire in Main Phase 2 — AFTER the Action Phase has already
      // used the heroes they'd remove. Playing them in Main Phase 1 can
      // eliminate the CPU's only caster for an Action-Phase Spell / Attack,
      // silently forfeiting the turn's action. `currentPhase === 2` is
      // Main Phase 1; `=== 4` is Main Phase 2. Delayed cards naturally
      // fire when this loop runs again in the MP2 pass.
      if (script?.cpuDelayToMainPhase2 && engine.gs.currentPhase === 2) continue;
      // First-turn-protected-opponent check: skip damage/enemy-target plays
      // that would fizzle under the shield.
      if (!isFirstTurnSafe(engine, cpuIdx, cardName, cd)) continue;
      // Don't waste Attacks/Spells when every enemy target is immune.
      if (!cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cd)) continue;

      // ── Gedeckten Caster finden (Held-Mismatch-Fix) ──
      // pickHeroForActionCard rankt nach Schul-Level/Atk-Heuristik und
      // kennt weder Inherent-Bedingungen (Overheal Shock: SM≥2 auf dem
      // CASTER) noch heldengebundene Additional-Action-Deckung
      // (Friendship: heroRestricted, deckt nur Zauber SEINES Helden).
      // Vorher wurde nur der Heuristik-Held geprüft — lag die Deckung
      // auf einem anderen Helden, wurde die Karte komplett verworfen
      // und z. B. Friendships Frei-Zauber verfiel jede Runde. Jetzt:
      // Heuristik-Held zuerst (bester Caster gewinnt bei Deckung),
      // danach alle übrigen legalen Helden auf Deckung prüfen.
      const prefHero = pickHeroForActionCard(engine, cpuIdx, cd, cardName);
      if (prefHero < 0) { swapDiag(engine, `summon:kein-held:${cardName}`); continue; }
      const heroOrder = [prefHero];
      for (const e of listEligibleHeroesForActionCard(engine, cpuIdx, cd)) {
        if (e.hi !== prefHero) heroOrder.push(e.hi);
      }
      let heroIdx = -1;
      let _presetSlot = -1;
      let _presetInherent = false;
      for (const hi of heroOrder) {
        if (tried.has(cardName + '|' + hi)) continue;
        // ── Slot ZUERST, dann validieren (Messung 29.7. 14:01) ──────
        // Der Server lehnte 3702 von 3778 Normal-Beschwörungen ab
        // ("server-nein"), obwohl das Gate zugestimmt hatte. Ursache ist
        // eine Asymmetrie in der Legalitätsprüfung: `inherentAction` ist
        // bei den Deepseas eine FUNKTION, die `opts.zoneSlot` auswertet —
        // ist der Slot LEER, liefert sie false (kein Zyklus-Zug, also
        // keine inhärente Gratis-Aktion). Diese Prüfung lief hier bisher
        // OHNE zoneSlot: die Funktion übersprang den Slot-Test und
        // meldete true, sobald irgendeine bounce-bare Kreatur existierte.
        // Anschließend wählte pickCreatureZoneSlot einen FREIEN Slot —
        // und der Server, der MIT diesem Slot prüft, verwarf den Play
        // (Main Phase erlaubt Kreaturen nur inhärent oder per Grant).
        // Ergebnis: tausende Bewertungen für Plays, die nie zustande
        // kommen konnten. Jetzt wird der Slot vor der Validierung
        // bestimmt und mitgegeben — die CPU sieht dieselbe Legalität
        // wie der Server.
        const trySlot = (ct === 'Creature')
          ? pickCreatureZoneSlot(engine, cpuIdx, hi, cardName) : -1;
        if (ct === 'Creature' && trySlot < 0) { swapDiag(engine, `summon:kein-slot:${cardName}`); continue; }
        const v = engine.validateActionPlay(cpuIdx, cardName, handIdx, hi, [ct],
          ct === 'Creature' ? { zoneSlot: trySlot } : undefined);
        if (!v) { swapDiag(engine, `summon:illegal:${cardName}`); continue; }
        if (!v.isMainPhase) { swapDiag(engine, `summon:falsche-phase:${cardName}`); continue; }
        // Dasselbe `canSummon`-Gate wie der Server (siehe cpuCanSummonHere).
        if (ct === 'Creature' && !cpuCanSummonHere(engine, cpuIdx, cardName, hi)) {
          swapDiag(engine, 'pick:cansummon-nein');
          swapDiag(engine, `cansummon-nein:${cardName}`);
          continue;
        }
        if (!v.isInherentAction) {
          // ── Grant-Lebenszyklus, Station "Nachsehen" ────────────────
          // Messung 29.7. 21:17: die CPU spielt Primordium 2.29×/Spiel,
          // kommt aber nur auf 0.61 grant-finanzierte Beschwörungen —
          // und Ablehnungen erklären das NICHT (server-nein 85,
          // declined 16). Die Plays werden also gar nicht versucht: an
          // dieser Stelle fällt die Karte still per `continue` heraus,
          // wenn kein Grant vorliegt. Ohne Zähler war dieser häufigste
          // Ausgang unsichtbar. Al erreicht 0.86 Grants je RUNDE, die
          // CPU 0.09 je Zug — Faktor 10.
          if (!engine.findAdditionalActionForCard(cpuIdx, cardName, hi)) {
            swapDiag(engine, `grant:kein-grant-beim-check:mp${engine.gs?.currentPhase === 4 ? '2' : '1'}`);
            // Zusaetzlich unter dem `summon:`-Praefix, damit dieser Grund
            // in der Beschwoerungs-Diagnose des Trainers auftaucht — und
            // zwar MIT Kartennamen. Der alte Schluessel bleibt unveraendert
            // stehen, damit bestehende Auswertungen weiterlaufen.
            if (ct === 'Creature') swapDiag(engine, `summon:kein-grant:${cardName}`);
            continue;
          }
          swapDiag(engine, `grant:gefunden:mp${engine.gs?.currentPhase === 4 ? '2' : '1'}`);
        }
        _presetSlot = trySlot;
        _presetInherent = !!v.isInherentAction;
        // Karten-Vertrag cpuPlayVeto — additional:true, weil dieser
        // Pfad Frei-/Zusatz-Aktionen spielt (Friendships Draw-Rider
        // greift hier, Heal für 0 + 3 Draws kann sich lohnen).
        {
          const _vsc = loadCardEffect(cardName);
          if (typeof _vsc?.cpuPlayVeto === 'function') {
            let _veto = false;
            try { _veto = !!_vsc.cpuPlayVeto(engine, cpuIdx, hi, { additional: true }); }
            catch { _veto = false; }
            if (_veto) { swapDiag(engine, `summon:karten-veto:${cardName}`); continue; }
          }
        }
        heroIdx = hi;
        break;
      }
      if (heroIdx < 0) { swapDiag(engine, `summon:kein-held-uebrig:${cardName}`); continue; }
      pick = { cardName, handIdx, heroIdx, cardType: ct, presetSlot: _presetSlot, inherent: _presetInherent };
      break;
    }
    if (!pick) {
      // Kein einziger Kandidat hat den ganzen Filterpfad ueberstanden.
      // Zusammen mit den Zaehlern oben ergibt sich daraus, WORAN es lag.
      if (safety === 0) swapDiag(engine, 'summon:kein-kandidat');
      return;
    }

    const handLenBefore = ps.hand.length;
    cpuLog(`      → fire additional ${pick.cardType.toLowerCase()} "${pick.cardName}" hero=${pick.heroIdx}`);
    let zoneSlot = -1;
    if (pick.cardType === 'Creature') {
      // Den bereits VALIDIERTEN Slot übernehmen; ein zweiter Aufruf
      // könnte einen anderen liefern (die Wahl enthält Zufall) und die
      // gerade hergestellte Übereinstimmung mit dem Server wieder brechen.
      zoneSlot = (pick.presetSlot >= 0)
        ? pick.presetSlot
        : pickCreatureZoneSlot(engine, cpuIdx, pick.heroIdx, pick.cardName);
      if (zoneSlot < 0) { tried.add(pick.cardName + '|' + pick.heroIdx); continue; }
    }
    let _playReturn = null;
    const actionFn = async () => {
      if (pick.cardType === 'Creature') {
        maybeSetCrossSideHint(engine, cpuIdx, pick.cardName);
        // Rückgabewert festhalten: doPlayCreature meldet mit `false`,
        // dass der Server den Play abgelehnt hat. Unterscheidet
        // "Server sagt nein" von "Play lief, bewirkte aber nichts".
        _playReturn = await helpers.doPlayCreature(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot,
        });
      } else {
        noteDamageImpact(engine, cpuIdx, pick.cardName);
        await helpers.doPlaySpell(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
        });
      }
    };
    // Always-commit triggers, mirroring activateFreeAbilities:
    //  • `blockedByHandLock` — draw / tutor inherent-action Spells
    //    (Graveyard Gathering, Brilliant Idea, etc.). The eval's
    //    gold-vs-hand-value model systematically under-rewards
    //    "trade gold for a card" plays, but a free additional-action
    //    tutor with no resource cost is essentially always tempo-
    //    positive — especially the Ascension-critical ones.
    //  • `cpuMeta.alwaysCommit` — explicit opt-in for cards whose
    //    payoff is invisible to the eval (future-turn synergy, no
    //    immediate state delta). Same flag used by activateFreeAbilities.
    const pickScript = loadCardEffect(pick.cardName);
    const pickAlwaysCommit = !!pickScript?.blockedByHandLock
      || (typeof pickScript?.cpuMeta?.alwaysCommit === 'function'
      ? (() => { try { return !!pickScript.cpuMeta.alwaysCommit(engine, cpuIdx, CPU_META_HELPERS); } catch { return false; } })()
      : !!pickScript?.cpuMeta?.alwaysCommit);
    // Rafflesia-Chain: Ein per Chain-Grant geschenkter Folgezauber ist
    // GRATIS — das Standard-Gate bewertet ihn aber wie einen normalen
    // Play und lässt ihn bei marginal negativem Score verfallen.
    // Threshold stark senken (nicht aufheben: aktiv schädliche Casts
    // bleiben skippbar). Greift NUR, wenn der castende Held einen
    // aktiven rafflesia_chain-Grant trägt → alte Decks unberührt.
    let addlThreshold;
    try {
      const _grants = ps.heroes?.[pick.heroIdx]?.counters?.aaGrants || {};
      if (pick.cardType === 'Spell'
          && Object.keys(_grants).some(t => t.startsWith('rafflesia_chain_') && _grants[t] > 0)) {
        addlThreshold = -60;
      }
    } catch {}
    // ── Handneutrale Gratis-Plays: eigene, niedrigere Hürde ──
    // Als Vergleichsanalyse (Deepsea-Batch 1292 Spiele vs 17 Pilot-Siege):
    // Dieser ganze Pfad spielt AUSSCHLIESSLICH Gratis-Aktionen (inherent
    // oder per Grant bezahlt) — bekam aber die Standard-Schwelle +3, die
    // für Aktionen gedacht ist, die den Zug kosten. Besonders teuer beim
    // Swap-Play (Kreatur auf besetzten Slot): der Insasse kehrt auf die
    // Hand zurück, die Handgröße bleibt also GLEICH und das Board tauscht
    // nur seine Zusammensetzung — die Sofortbewertung sieht ~0 Delta,
    // während der reale Ertrag (Siphem-Counter, Teppes-Draw, erneuter
    // On-Summon-Trigger, recyceltes Material als DDG-Tribut) erst später
    // anfällt. Messbar: die CPU hatte im Median 3 swap-fähige Kreaturen
    // auf der Hand und machte 0.75 Swaps/Runde, Al 2.4. Im Datensatz
    // selbst ist der Zusammenhang der stärkste überhaupt — bei GLEICHER
    // Spiellänge (12-16 HZ): 0-2 Bounces 0% WR, 12-14 Bounces 83% WR.
    // Deshalb: kostet der Play nichts UND schrumpft die Hand nicht,
    // genügt "nicht aktiv schädlich". Generisch über den vorhandenen
    // Slot-Vertrag (canPlaceOnOccupiedSlot) — kein Deck-Wissen.
    let _pickSlotOccupied = false, _slotBefore = null;
    if (pick.cardType === 'Creature' && zoneSlot >= 0) {
      try {
        _slotBefore = ((ps.supportZones?.[pick.heroIdx] || [])[zoneSlot] || [])[0] || null;
        _pickSlotOccupied = !!_slotBefore;
      } catch {}
    }
    if (addlThreshold === undefined && pick.cardType === 'Creature' && zoneSlot >= 0) {
      try {
        const occupied = _pickSlotOccupied;
        if (occupied && typeof loadCardEffect(pick.cardName)?.canPlaceOnOccupiedSlot === 'function') {
          addlThreshold = FREE_SWAP_GATE_THRESHOLD;
        } else if (!occupied) {
          // Freie Normal-Beschwörung: ebenfalls eine Gratis-Aktion,
          // also nicht die Hürde für zugkostende Aktionen anlegen.
          addlThreshold = FREE_SUMMON_GATE_THRESHOLD;
        }
      } catch {}
    }
    // ── Ausspiel-Reihenfolge-Tags: HIER berechnen, nicht erst beim Log ──
    // Die Push-Stelle weiter unten las `_pickTags` — deklariert ist die
    // Variable aber in einer ANDEREN Funktion (Zeile ~1920). In diesem
    // Gültigkeitsbereich existiert sie nicht, der Zugriff warf einen
    // ReferenceError, und das umschließende `try/catch` schluckte ihn
    // still. Folge: `engine._playOrderLog` blieb IMMER leer, in jedem
    // Datensatz standen 0 playOrderDecisions und jedes Profil hatte
    // `playOrderRules: {}`. Der ganze Ausspiel-Reihenfolge-Kanal hat
    // seit seiner Einführung nie einen einzigen Datenpunkt erzeugt —
    // und damit auch die Motor-Rollen-Tags aus v107
    // (pord:grants-action, pord:copies-onsummon, pord:spec-strands)
    // ins Leere laufen lassen.
    let _orderTags = null;
    try {
      if (!engine._inMctsSim) {
        _orderTags = deckProfile.classifyPlayOrderTags(engine, cpuIdx, pick.cardName);
      }
    } catch { /* Tags sind optional */ }
    // ── FREIE BESCHWÖRUNGEN COMMITTEN IMMER (Als Ruling 7.8.) ────────
    // "Die inherent action Creatures sollten IMMER worth playing sein,
    // wenn man sie for free rausbekommen kann. Das sollte nie passieren!"
    //
    // Gemessen im Lauf 14-30: in 42 von 164 Spielen (25.6%) beschwört
    // die CPU die ganze Partie über nichts, und zwar ausschließlich, weil
    // das Wert-Gate ablehnt — kein einziges `fail:*` oder `refuse:*`, die
    // Plays sind alle legal. In diesen Spielen kommt KEINE Bewertung über
    // die Schwelle −12; die Masse liegt bei −50..−20 und −200..−50. Die
    // Rechnung stützt das nicht: ein Support-Slot ist +30 wert
    // (`SLOT_BASE`), eine Handkarte grob 25 — eine kostenlose Beschwörung
    // müsste netto leicht POSITIV sein. Woher die −50 wirklich kommen,
    // ist noch offen (dafür der Karten-Delta-Zähler unten).
    //
    // Der Bypass greift NUR bei `isInherentAction`, also wenn die Karte
    // ihre Aktion selbst mitbringt: dann kostet der Play keine Aktion,
    // kein Gold und keine Gelegenheit — nur die Handkarte. Deckneutral,
    // weil er am Engine-Flag hängt und nicht an Kartennamen.
    //
    // BEWUSST NICHT einbezogen: grant-finanzierte Beschwörungen. Ein
    // Grant ist eine knappe Ressource, deren Verbrauch eine echte
    // Wertfrage ist — dort entscheidet das Gate weiter.
    // ── Deckel je Zug ────────────────────────────────────────────────
    // Ohne ihn kann ein Deck, dessen Beschwoerungen NEUE beschwoerbare
    // Koerper erzeugen (Token-Generatoren), die aeussere Fortschritts-
    // Schleife von `runMainPhase` endlos weiterdrehen: jede freie
    // Beschwoerung committet jetzt garantiert, gilt also als Fortschritt.
    // Drei reicht fuer jede vorgesehene Linie und beendet den Fall.
    const freeTurnKey = `${cpuIdx}:${gs.turn || 0}`;
    if (engine._freeSummonTurnKey !== freeTurnKey) {
      engine._freeSummonTurnKey = freeTurnKey;
      engine._freeSummonCount = 0;
    }
    const costlySummon = summonCostsMoreThanTheCard(pickScript);
    if (pick.cardType === 'Creature' && pick.inherent === true && costlySummon) {
      swapDiag(engine, `summon:frei-kostenpflichtig:${pick.cardName}`);
    }
    const freeSummon = (pick.cardType === 'Creature' && pick.inherent === true
      && !costlySummon
      && (engine._freeSummonCount || 0) < MAX_FREE_SUMMONS_PER_TURN);
    if (freeSummon) {
      engine._freeSummonCount = (engine._freeSummonCount || 0) + 1;
      swapDiag(engine, `summon:frei-bypass:${pick.cardName}`);
    } else if (pick.cardType === 'Creature' && pick.inherent === true && !costlySummon) {
      swapDiag(engine, 'summon:frei-deckel');
    }
    const committed = await mctsGatedActivation(engine, helpers, `additional ${pick.cardType} ${pick.cardName}`, actionFn,
      {
        alwaysCommit: pickAlwaysCommit || freeSummon,
        // Eine freie Beschwoerung hat nichts zu bewerten: der Slot steht
        // schon fest (`presetSlot`), die Entscheidung ist getroffen. Also
        // gar nicht erst suchen — das ist strikt WENIGER Arbeit als vor
        // v263, nicht mehr.
        commitWithoutRecon: freeSummon && !pickAlwaysCommit,
        overrideThreshold: addlThreshold,
        // Delta-Diagnose: trennt Zyklus-Züge von Normal-Beschwörungen,
        // damit die Verteilung je Fall lesbar ist.
        diagKey: pick.cardType === 'Creature' && zoneSlot >= 0
          ? (_pickSlotOccupied ? 'swap' : 'normal') : undefined,
        // Zusätzlich JE KARTE — ohne das ließ sich aus `delta:normal:*`
        // nicht ablesen, WELCHE Beschwörung mit −50 bepreist wird, und
        // genau daran hing die Ursachensuche.
        diagCard: pick.cardType === 'Creature' ? pick.cardName : undefined,
        // `cpuMeta.evaluateThroughTurnEnd` wurde hier bisher NICHT
        // durchgereicht (nur in den Artefakt-, Equip- und Potion-Pfaden).
        // Genau dieser Pfad spielt aber die inhärenten Zusatz-Aktions-
        // Zauber, deren Nutzen erst im weiteren Zugverlauf entsteht —
        // Torchure schenkt eine zweite Action in der Action Phase, was
        // die Sofortbewertung nicht sehen kann. Mit dem Rest-des-Zuges-
        // Rollout wird die Bonus-Action tatsächlich ausgespielt und der
        // Gewinn sichtbar.
        evaluateThroughTurnEnd: !!pickScript?.cpuMeta?.evaluateThroughTurnEnd,
      });
    const shrank = ps.hand.length < handLenBefore;
    // ── Erfolgstest, der Zyklus-Züge nicht als Fehlschlag wertet ──────
    // `shrank` allein ist für Swaps STRUKTURELL falsch: der Tausch legt
    // eine Handkarte ab und nimmt die verdrängte Kreatur zurück auf die
    // Hand — die Handlänge bleibt also GLEICH. Jeder geglückte Swap galt
    // damit als Fehlschlag, landete in `tried` und war für den Rest des
    // Zuges gesperrt; die Kette brach nach genau einem Tausch je Karte
    // und Held ab. Genau deshalb bewegte sich die Swap-Rate trotz v83
    // nicht: das Wert-Gate hatte längst zugestimmt (Delta-Messung:
    // 1047 von 1530 Swaps über +3, Schwelle −12), der Fehlschlag entstand
    // ERST danach. Der Bug ist älter als v83.
    // Robuster Ersatz: hat der Zielslot seinen Inhalt gewechselt? Das
    // trifft normale Beschwörung (leer → Karte) und Swap (alt → neu)
    // gleichermaßen und bleibt bei echtem Fehlschlag falsch.
    let _slotFilled = false;
    if (pick.cardType === 'Creature' && zoneSlot >= 0) {
      try {
        const after = ((ps.supportZones?.[pick.heroIdx] || [])[zoneSlot] || [])[0] || null;
        _slotFilled = !!after && after !== _slotBefore;
        // Randfall: Tausch auf eine GLEICHNAMIGE Karte (bei 4 Kopien je
        // Deepsea keine Seltenheit) — der Name allein verrät den Wechsel
        // dann nicht. Die frisch platzierte Instanz trägt aber
        // turnPlayed = aktueller Zug.
        if (!_slotFilled && after) {
          const inst = (engine.cardInstances || []).find(ci => ci
            && ci.zone === 'support' && ci.heroIdx === pick.heroIdx
            && ci.zoneSlot === zoneSlot && (ci.controller ?? ci.owner) === cpuIdx);
          if (inst && inst.turnPlayed === engine.gs?.turn) _slotFilled = true;
        }
      } catch {}
    }
    const played = shrank || _slotFilled;
    if (pick.cardType === 'Creature' && zoneSlot >= 0) {
      const wasSwap = _pickSlotOccupied;
      const kind = wasSwap ? 'swap' : 'normal';
      // DREI Ausgänge statt zwei. Messung 29.7. 12:24: die Schwelle
      // kommt an (thr:normal:-12, 3667×) UND die Deltas schlagen sie
      // (3618 im Bucket −3..0) — trotzdem zählten nur 38 als Commit.
      // Der alte Zweiwege-Zähler warf "Gate hat abgelehnt" und "Gate
      // hat zugestimmt, aber der Play kam nicht zustande" in denselben
      // Topf. Genau diese Unterscheidung entscheidet, wo weitergesucht
      // wird — Bewertung oder Ausführung.
      if (!committed) swapDiag(engine, `gate:${kind}-declined`);
      else if (!played) {
        swapDiag(engine, `gate:${kind}-failed`);
        // (A) Warum? Server-Ablehnung vs. wirkungsloser Play.
        swapDiag(engine, `fail:${kind}:${_playReturn === false ? 'server-nein'
          : _playReturn === null ? 'nie-aufgerufen' : 'ohne-wirkung'}`);
        // (C) Welche Karte? Fehlschläge konzentrieren sich erfahrungs-
        // gemäß auf wenige Karten — das ist der schnellste Hinweis.
        swapDiag(engine, `failcard:${pick.cardName}`);
        // ── (F) WARUM GENAU? (30.7.) ─────────────────────────────────
        // `server-nein` war bisher eine Sackgasse: 1641 Ablehnungen je
        // Lauf ohne jeden Hinweis auf den Grund. Der Server hält ihn
        // jetzt selbst in `engine._playRefusal` fest (11 unterschiedene
        // Ausgänge in doPlayCreature). Bewusst NICHT hier nachgebaut —
        // genau dieses Nachbauen hat die v103- und v108-Asymmetrien
        // erzeugt.
        try {
          const rf = engine._playRefusal;
          if (rf && rf.cardName === pick.cardName) {
            swapDiag(engine, `refuse:${rf.label}`);
            swapDiag(engine, `refusecard:${pick.cardName}:${rf.label}`);
            if (rf.detail) swapDiag(engine, `refusewhy:${rf.label}:${rf.detail}`);
          } else if (_playReturn === false) {
            // Der Server hat abgelehnt, aber keinen Grund hinterlassen —
            // dann fehlt eine Instrumentierungsstelle.
            swapDiag(engine, 'refuse:unbekannt');
          }
        } catch { /* Telemetrie darf nie stören */ }
      }
      else swapDiag(engine, `gate:${kind}-commit`);
      // ── DOPPELZÄHLUNG BEHOBEN (30.7.) ────────────────────────────────
      // Diese Zeile sollte nur die ALTNAMEN weiterführen, stempelte im
      // Erfolgsfall aber denselben Key `gate:KIND-commit` ein ZWEITES Mal
      // (der `else`-Zweig darüber hat ihn schon gesetzt). Alle Commit-
      // Zahlen seit v101 waren dadurch exakt doppelt so hoch: gemessen
      // 2902 `gate:swap-commit` gegen 1453 echte Bounce-Place-Ereignisse
      // in der Telemetrie. Gegenprobe, die den Befund festnagelt:
      // `gate:swap-skip` 959 = declined 455 + failed 504 — der Skip-Pfad
      // stimmt exakt, weil er nur EINMAL gestempelt wird.
      // Der Altname wird jetzt nur noch im Skip-Fall gesetzt; für den
      // Commit-Fall ist `gate:KIND-commit` bereits oben gefallen.
      if (!(committed && played)) swapDiag(engine, `gate:${kind}-skip`);
    }
    cpuLog(`      ← additional "${pick.cardName}" ${committed && played ? 'OK' : 'SKIPPED/FAILED'}`);
    // Ausspiel-Reihenfolge-Kanal: nur VOLLZOGENE Plays stempeln — die
    // Tags beschreiben die Lage VOR dem Play (oben berechnet), das Label
    // liefert später der Spielverlauf.
    // `played` statt `shrank`: derselbe Grund wie beim Erfolgstest oben —
    // ein Swap lässt die Handlänge unverändert und wäre sonst nie
    // geloggt worden. v98 hat das an drei Stellen korrigiert, diese
    // vierte wurde übersehen.
    if (committed && played) {
      try {
        if (!engine._inMctsSim) {
          if (!engine._playOrderLog) engine._playOrderLog = [];
          engine._playOrderLog.push({
            pi: cpuIdx, c: pick.cardName, t: engine.gs?.turn || 0,
            tags: _orderTags || [],
          });
        }
      } catch { /* nie stören */ }
    }
    if (!committed || !played) tried.add(pick.cardName + '|' + pick.heroIdx);
    await pauseAction(engine);
  }
}

// Hero selection per spec, given a card. Returns -1 if no hero qualifies.
// Enumerate every hero that could legally play this Action-Phase card.
// Returns an array of { hi, freeZones? }. Empty array means no hero is
// eligible. Used by the MCTS candidate expander to evaluate per-hero
// variations AND by pickHeroForActionCard (the non-MCTS heuristic path).

// ── Cross-Side-Placement-Vertrag (Chilly-Wizard-Klasse) ──
// Skripte mit `cpuMeta.preferOpponentSupportZone` platzieren bevorzugt in
// eine freie GEGNERISCHE Support-Zone (Status-Mirror-Lock). Der UI-Pfad
// setzt dafür `gs._chillyWizardHint` beim Drag — die CPU setzte den Hint
// nie, wodurch der Cross-Side-Play (und damit die Hero-Lock-Combo) für
// Bots unspielbar war ("Future CPU bot reads this flag" im Kartenskript).
// Ziel-Heuristik: lebender Opp-Held mit den meisten HP und freier Zone
// (stärkster Held = wertvollster Lock). Muss vor JEDEM doPlayCreature-
// Pfad laufen (Live UND Rollout-Executor), damit Gate-Bewertung und
// echter Play identisch sind.
function maybeSetCrossSideHint(engine, cpuIdx, cardName) {
  try {
    const script = loadCardEffect(cardName);
    if (!script?.cpuMeta?.preferOpponentSupportZone) return;
    const oppIdx = cpuIdx === 0 ? 1 : 0;
    const oppPs = engine.gs.players[oppIdx];
    let best = null;
    for (let hi = 0; hi < (oppPs?.heroes || []).length; hi++) {
      const h = oppPs.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      const zones = oppPs.supportZones?.[hi] || [[], [], []];
      for (let s = 0; s < 3; s++) {
        if ((zones[s] || []).length === 0) {
          if (!best || h.hp > best.hp) best = { heroIdx: hi, slotIdx: s, hp: h.hp };
          break;
        }
      }
    }
    if (!best) return;
    if (!engine.gs._chillyWizardHint) engine.gs._chillyWizardHint = {};
    engine.gs._chillyWizardHint[cpuIdx] = { ownerIdx: oppIdx, heroIdx: best.heroIdx, slotIdx: best.slotIdx };
  } catch { /* Hint ist optional — Placement fällt auf eigene Zone zurück */ }
}

/**
 * Darf diese Karte an DIESEM Helden einen besetzten Slot einnehmen?
 *
 * ── ALS RULING (31.7.) ──────────────────────────────────────────────
 * "Deepsea Swap-Effekte funktionieren EXPLIZIT auch für Creatures von
 * toten Helden, sowie für Helden ohne die nötigen Abilities, oder
 * Helden, die Frozen oder Stunned sind. Swaps sind KOMPLETT UNABHÄNGIG
 * von Heroes."
 * Die Engine setzt das bereits um (`_bypassDeadHeroFilter` in
 * _deepsea-shared). Die CPU tat es NICHT: an drei Stellen wurden Helden
 * vorab nach `hp <= 0`, `frozen`, `stunned` und `heroMeetsLevelReq`
 * aussortiert, BEVOR die Bounce-Ausnahme überhaupt geprüft wurde.
 *
 * Gemessen: 78.5% aller Null-Züge hatten einen tauschbaren Körper, und
 * 59.7% waren "Ziel vorhanden UND Held tot". `pick:no-motor` ist mit
 * 1985 Treffern der drittgrößte Blocker in Null-Zügen.
 *
 * Antwort kommt aus dem Karten-Vertrag selbst — dieselbe Lehre wie bei
 * den Legalitäts-Asymmetrien v103/v108: die Karte kennt ihre Regel,
 * nicht der Pilot. Karten ohne den Vertrag liefern false, für sie
 * ändert sich nichts.
 */
function cardCanBouncePlaceAtHero(engine, pi, heroIdx, cardName) {
  try {
    const sc = loadCardEffect(cardName);
    if (!sc) return false;
    // ── VERALLGEMEINERT (31.7., nach dem "place"-Sweep) ─────────────
    // Erste Fassung fragte NUR `getBouncePlacementTargets` — den Vertrag
    // der Deepsea-Linie. Der Sweep über alle 408 Kreaturen fand 60
    // Selbst-Platzierer ("place this Creature into …"), davon tragen nur
    // 16 diesen Vertrag. Die übrigen Mechaniken (Surprise-Platzierung in
    // FREIE Zonen, Slippery-Zugbeginn-Bewegung, Effekt-Platzierung bei
    // Defeat/Revive) laufen nicht über den Aktionspfad und bleiben
    // unberührt — mit EINER Ausnahme: "500 Piranhas in a Monster Suit"
    // ist ein Handkarten-Play ohne Aktionskosten, das sich selbst in eine
    // BESETZTE gegnerische Zone platziert. Es trägt
    // `canBypassFreeZoneRequirement`, aber kein
    // `getBouncePlacementTargets`, und fiel deshalb durch.
    if (typeof sc.getBouncePlacementTargets === 'function') {
      const ts = sc.getBouncePlacementTargets(engine.gs, pi, engine) || [];
      if (ts.some(t => t && t.heroIdx === heroIdx)) return true;
    }
    if (sc.canBypassFreeZoneRequirement || typeof sc.canPlaceOnOccupiedSlot === 'function') return true;
    return false;
  } catch { return false; }
}

function listEligibleHeroesForActionCard(engine, pi, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    // Swap-Ausnahme (Als Ruling): ein Tausch auf den Slot dieses Helden
    // ist von seinem Zustand UNABHÄNGIG — tot, frozen, stunned oder ohne
    // die nötige Ability spielt keine Rolle. Nur wenn die Karte hier gar
    // nicht bounce-platzieren KANN, gelten die normalen Schranken.
    const _swapOk = cardCanBouncePlaceAtHero(engine, pi, hi, cardData?.name);
    if (!_swapOk) {
      if (hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      if (hero.statuses?.negated && cardData.cardType === 'Spell') continue;
      if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
    }

    if (cardData.cardType === 'Creature') {
      const zones = ps.supportZones?.[hi] || [[], [], []];
      let freeCount = 0;
      for (let z = 0; z < 3; z++) {
        if ((zones[z] || []).length === 0) freeCount++;
      }
      if (freeCount === 0) {
        // Bounce-Place-Vertrag: Karten mit canBypassFreeZoneRequirement
        // (Deepsea Bats, Horror Clown …) dürfen laut Engine auch bei
        // VOLLEN Zonen gespielt werden (Swap: Occupant → Hand, Karte in
        // dieselbe Zone). Die Brain-Enumeration ignorierte das bisher —
        // der Mensch konnte swappen, die CPU sah die Karte nie. Genau
        // in vollen Boards ist der Swap aber am wertvollsten
        // (Teppes/Siphem-Bounce-Trigger).
        let bypass = false;
        const _bsc = loadCardEffect(cardData.name);
        if (typeof _bsc?.canBypassFreeZoneRequirement === 'function') {
          try { bypass = !!_bsc.canBypassFreeZoneRequirement(engine.gs, pi, hi, cardData, engine); } catch {}
        }
        if (!bypass) continue;
      }
      eligible.push({ hi, freeZones: freeCount });
    } else {
      eligible.push({ hi });
    }
  }

  // KEIN Routing für forcesSingleTarget-Helden (Ida): Als Regel-Ruling
  // (Juli 2026) — Idas Restriktion ist rein PER-CASTER: nur AoEs, die
  // SIE castet, werden Single-Target. Sie schränkt weder das Team ein,
  // noch ist sie Default- oder Zwangs-Caster für Destruction-Spells.
  // Eine frühere Fassung filterte hier die Kandidatenliste hart auf
  // Ida, sobald sie castbar war ("Signatur-Restriktion respektieren")
  // — das ging auf eine Misskommunikation zurück und BLOCKIERTE exakt
  // die Comeback-Linie "Ankh → Bartas wiederbeleben → Avalanche als
  // echten AoE casten": der Bartas-Arm existierte für MCTS nie.
  // Jetzt bleiben alle castbaren Helden Kandidaten; die Wahl treffen
  // Caster-Deltas (gelernt), cpuCasterPriority und die echte
  // Resolution in den Rollouts (die Idas Transformation korrekt sieht).

  // ── Held-Vertrag: cpuCasterPriority ───────────────────────────────
  // Sortiert die Kandidaten-Helden für diese Karte. Helden mit
  // höherer Priorität stehen vorn — sie werden Default-Cast-Held und
  // bekommen in der MCTS-Budget-Vorsortierung die Rollouts (Rafflesia
  // will Decay/Support-Spells selbst casten, um ihren Chain-Grant zu
  // triggern). Helden ohne Export → 0, alte Decks unberührt.
  if (eligible.length > 1) {
    try {
      const prio = (e) => {
        const hn = ps.heroes?.[e.hi]?.name;
        if (!hn) return 0;
        const hs = loadCardEffect(hn);
        return typeof hs?.cpuCasterPriority === 'function'
          ? (Number(hs.cpuCasterPriority(engine, pi, e.hi, cardData)) || 0) : 0;
      };
      eligible.sort((a, b) => prio(b) - prio(a));
    } catch {}
  }
  return eligible;
}

// ── Caster-Draw-Kontext (Deckout-Prävention, Als Kontext-Regel) ──────
// "Setze die Spells weiter ein, aber achte darauf, WELCHER Held sie
// nutzt": Abilities mit cpuMeta.castTriggersDraw (Friendship Lv2/3)
// ziehen Karten, wenn ihr Held einen Spell der passenden Schule castet.
// Bei gefährlich kleinem Deck (≤ gelernte deckoutDangerSize bzw.
// Default) liefert dieser Helfer die erwarteten Draws eines Casts via
// Held `hi` — pickHeroForActionCard bestraft solche Caster dann, sodass
// Heal & Co. weiter gespielt, aber über draw-freie Helden geroutet
// werden. Erkennung über slot[0] der Ability-Stacks (Performance-Kopien
// AUF einem Friendship-Stack erhöhen slot.length und zählen damit als
// Level mit; alleinstehende Kopie-Konstruktionen bewusst ausgelassen).
function casterCastDrawCount(engine, pi, hi, cardData) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  let draws = 0;
  for (const slot of (ps.abilityZones?.[hi] || [])) {
    if (!slot || !slot.length) continue;
    const meta = loadCardEffect(slot[0])?.cpuMeta?.castTriggersDraw;
    if (!meta) continue;
    if (meta.school && cardData.spellSchool1 !== meta.school && cardData.spellSchool2 !== meta.school) continue;
    const lvl = Math.min(3, slot.length);
    draws += meta.drawsAtLevel?.[lvl] || 0;
  }
  return draws;
}

// Hebt Always-Commit-Bypässe für zieh-lastige Aktivierungen auf, sobald
// das eigene Deck gefährlich klein ist: baseCommit bleibt in sicheren
// Lagen erhalten (die Bypässe existieren, weil die Eval reine Karten-
// Trades historisch unterbewertete), aber am kleinen Deck entscheidet
// wieder das reguläre MCTS-Gate — dessen Commit-Arm den Draw real
// resolvet und über den Deck-Nähe-Term in evaluateState bepreist.
function liftCommitBypassForDraws(engine, pi, baseCommit, drawish) {
  return !!baseCommit && !(drawish && deckIsDangerouslySmall(engine, pi));
}

function deckIsDangerouslySmall(engine, pi) {
  const dl = engine.gs?.players?.[pi]?.mainDeck?.length;
  if (typeof dl !== 'number') return false;
  const th = deckProfile.deckoutDangerSizeOf(engine, pi) ?? DECKOUT_EVAL_TH_DEFAULT;
  return dl <= th;
}

function pickHeroForActionCard(engine, pi, cardData, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const eligible = listEligibleHeroesForActionCard(engine, pi, cardData);
  if (!eligible.length) return -1;

  // Ascension priority: if any eligible hero declares this card progresses
  // their ascension (e.g. Beato wants a Spell of an uncollected school),
  // route the play to that hero first. Overrides the heuristics below.
  if (cardName) {
    for (const e of eligible) {
      if (heroNeedsCardForAscension(engine, pi, e.hi, cardName, cardData)) return e.hi;
    }
  }

  if (cardData.cardType === 'Attack') {
    // Basis: höchster ATK; gelernter Caster-Delta als additiver Versatz
    // (skaliert ~ATK-Punkte-Bereich hoch, damit ein satter gelernter
    // Unterschied einen kleinen ATK-Vorsprung überstimmen kann).
    let best = [], bestScore = -Infinity;
    for (const e of eligible) {
      const hn = ps.heroes[e.hi]?.name;
      const score = (ps.heroes[e.hi].atk || 0)
        + deckProfile.casterDelta(engine, pi, cardName, hn) * 5;
      if (score > bestScore + 1e-9) { bestScore = score; best = [e]; }
      else if (Math.abs(score - bestScore) <= 1e-9) best.push(e);
    }
    return best[Math.floor(Math.random() * best.length)].hi;
  }

  if (cardData.cardType === 'Spell' || cardData.cardType === 'Creature') {
    const school1 = cardData.spellSchool1;
    const school2 = cardData.spellSchool2;
    let scored = eligible.map(e => {
      let schoolLvl = 0;
      if (school1) schoolLvl = Math.max(schoolLvl, effectiveSpellSchoolLevel(engine, pi, e.hi, school1));
      if (school2) schoolLvl = Math.max(schoolLvl, effectiveSpellSchoolLevel(engine, pi, e.hi, school2));
      return { ...e, schoolLvl };
    });

    // Card-specific summoner-hero preference hook. Cards whose effect
    // depends on the host hero having specific abilities (e.g. Cosmic
    // Skeleton needs a non-Summoning spell school attached) narrow the
    // pool here. If any hero matches, restrict to those — otherwise
    // fall back to the full pool so play isn't blocked.
    if (cardName) {
      const script = loadCardEffect(cardName);
      if (typeof script?.cpuPrefersSummonerHero === 'function') {
        const preferred = scored.filter(s => {
          try { return !!script.cpuPrefersSummonerHero(engine, pi, s.hi, cardData); }
          catch { return false; }
        });
        if (preferred.length > 0) scored = preferred;
      }
    }

    if (cardData.cardType === 'Spell') {
      // Basis: höchstes passendes Schul-Level; gelernter Caster-Delta
      // als additiver Versatz (×0.15 auf Level-Skala: ein voller ±20-
      // Delta entspricht damit ±3 Leveln — genug, um z.B. Idas
      // AoE→Single-Target-Malus gegen einen Level-Gleichstand oder
      // -Vorsprung durchzusetzen). Caster-Draw-Kontext: Bei gefährlich
      // kleinem Deck kostet jeder erwartete Draw des Casts (Friendship-
      // Rider des Helden) 1.5 Level Präferenz — der Spell wird weiter
      // gespielt, aber über den draw-freien Helden. Tie → random.
      const deckDanger = deckIsDangerouslySmall(engine, pi);
      let best = [], bestScore = -Infinity;
      for (const s of scored) {
        const hn = ps.heroes[s.hi]?.name;
        let score = s.schoolLvl + deckProfile.casterDelta(engine, pi, cardName, hn) * 0.15;
        if (deckDanger) score -= casterCastDrawCount(engine, pi, s.hi, cardData) * 1.5;
        if (score > bestScore + 1e-9) { bestScore = score; best = [s]; }
        else if (Math.abs(score - bestScore) <= 1e-9) best.push(s);
      }
      return best[Math.floor(Math.random() * best.length)].hi;
    }

    // Creatures — Placement-Lernkanal (Als Support-Zonen-Ökonomie):
    // Basis-Score reproduziert die alte Heuristik EXAKT (lowest
    // matching level ×100, dann most free zones), der gelernte
    // placementPrior (per Deck, Tags plc:slack / plc:bigwait)
    // verschiebt sie. Ohne Profil: prior=0 → Verhalten unverändert.
    const _logPlacement = (choice, tags) => {
      try {
        if (engine._inMctsSim) return;
        if (!engine._placementLog) engine._placementLog = [];
        engine._placementLog.push({ pi, c: cardData.name, t: gs.turn || 0, tags: tags || [] });
      } catch { /* nie stören */ }
    };
    // Trainings-Exploration: zufälliger eligible Held liefert die
    // Kontrast-Arme, aus denen der Trainer die Slack-Regeln lernt.
    const placeEps = parseFloat(process.env.PP_PLACE_EXPLORE || '0.25');
    if (process.env.PP_TRAIN && !engine._inMctsSim && scored.length > 1 && Math.random() < placeEps) {
      const e = scored[Math.floor(Math.random() * scored.length)];
      _logPlacement(e, deckProfile.classifyPlacementTags(engine, pi, cardData, e.schoolLvl));
      return e.hi;
    }
    let bestPick = null, bestScore = -Infinity, bestTags = null;
    for (const s of scored) {
      const tags = deckProfile.classifyPlacementTags(engine, pi, cardData, s.schoolLvl);
      const prior = deckProfile.placementPrior(engine, pi, tags);
      const score = -(s.schoolLvl || 0) * 100 + (s.freeZones || 0) + prior * 10 + Math.random() * 0.5;
      if (score > bestScore) { bestScore = score; bestPick = s; bestTags = tags; }
    }
    _logPlacement(bestPick, bestTags);
    return bestPick.hi;
  }

  return eligible[Math.floor(Math.random() * eligible.length)].hi;
}

/**
 * H2 (Vergleichsanalyse): findet eine ausgabefähige Beschwörung für
 * einen unverbrauchten Additional-Action-Grant (Primordiums
 * 'summon_deepsea_primordium' und künftige Summon-Grants). Nur aktiv,
 * wenn die reguläre Aktion verbraucht ist — solange der Planner noch
 * frei wählt, wird nichts erzwungen. Liefert {cardName, handIndex,
 * heroIdx, zoneSlot} oder null.
 */
function findSpendableSummonGrantPlay(engine, cpuIdx) {
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return null;
  // Reguläre Aktion muss weg sein, sonst würde doPlayCreature sie
  // statt des Grants verbrauchen und wir kämen dem Planner zuvor.
  if ((ps.heroesActedThisTurn || []).length === 0) return null;
  if ((ps._bonusMainActions || 0) > 0) return null;
  if ((ps.bonusActions?.remaining || 0) > 0) return null;
  const cardDB = engine._getCardDB();
  let best = null;
  const seen = new Set();
  for (let handIndex = 0; handIndex < (ps.hand || []).length; handIndex++) {
    const cardName = ps.hand[handIndex];
    if (seen.has(cardName)) continue;
    seen.add(cardName);
    const cd = cardDB[cardName];
    if (!cd || cd.cardType !== 'Creature') continue;
    for (let heroIdx = 0; heroIdx < (ps.heroes || []).length; heroIdx++) {
      const hero = ps.heroes[heroIdx];
      if (!hero || !hero.name) continue;
      // Swap-Ausnahme wie oben: ein grant-finanzierter Tausch auf den
      // Slot eines toten Helden ist legal und war hier ausgeschlossen.
      if (hero.hp <= 0 && !cardCanBouncePlaceAtHero(engine, cpuIdx, heroIdx, cardName)) continue;
      let typeId = null;
      try { typeId = engine.findAdditionalActionForCard(cpuIdx, cardName, heroIdx); } catch { }
      if (!typeId) continue;
      // ── SLOT ZUERST, dann Legalität (Messung 30.7.) ──────────────────
      // Hier stand ein STRIKTES `heroMeetsLevelReq` VOR der Slot-Wahl.
      // Das ist derselbe Klassenfehler wie die in v103 behobene
      // Legalitäts-Asymmetrie, nur an der anderen Stelle: Karten dürfen
      // die Level-Hürde per Vertrag umgehen (`canBypassLevelReq`, bei der
      // Deepsea-Linie `canBypassLevelReqIfBounceable` — der Tausch-Summon
      // ist level-UNABHÄNGIG). Der strikte Check kannte diese Bypässe
      // nicht und warf ausgerechnet die Lv2-Kerne (Werewolf, Witch,
      // Monstrosity) ohne Summoning Magic 2 raus. Messbar: der Spender
      // fand in 535 von 535 Versuchen NICHTS, während derselbe Grant in
      // Main Phase 2 vom Gratis-Pfad (der über `validateActionPlay` mit
      // Slot prüft) 138× gefunden wurde.
      // Jetzt: Slot bestimmen, dann mit genau diesem Slot validieren —
      // die CPU sieht dieselbe Legalität wie der Server. Der validierte
      // Slot wandert mit, statt später neu gewürfelt zu werden (die Wahl
      // enthält Zufall).
      const zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, heroIdx, cardName);
      if (zoneSlot == null || zoneSlot < 0) continue;
      if (!cpuCanSummonHere(engine, cpuIdx, cardName, heroIdx)) continue;
      let legal = false;
      try {
        const v = engine.validateActionPlay(cpuIdx, cardName, handIndex, heroIdx,
          ['Creature'], { zoneSlot });
        legal = !!v;
      } catch { legal = false; }
      if (!legal) {
        // Fallback auf den strikten Pfad, falls validateActionPlay in
        // dieser Stellung gar nicht greift (Phasen-Randfälle).
        let strict = false;
        try { strict = !!engine.heroMeetsLevelReq(cpuIdx, heroIdx, cd); } catch { strict = false; }
        if (!strict) continue;
      }
      let val = 0;
      try { val = learnedCardValue(engine, cpuIdx, cardName, (cd.level || 0) * 10, 1); } catch { }
      if (!best || val > best.val) best = { cardName, handIndex, heroIdx, zoneSlot, val };
    }
  }
  return best ? { cardName: best.cardName, handIndex: best.handIndex, heroIdx: best.heroIdx, zoneSlot: best.zoneSlot } : null;
}

/**
 * Swap-Diagnose (Als Auftrag nach dem ernüchternden 27.7.-Batch).
 * Zählt, WARUM ein Zyklus-Zug zustande kam oder nicht — die Swap-Rate
 * bewegte sich trotz der v83-Schwellensenkung nicht, und ohne diese
 * Zähler lässt sich nicht unterscheiden, ob ein Swap am Wert-Gate
 * scheiterte oder dort nie ankam. Reine Telemetrie, beeinflusst keine
 * Entscheidung; in MCTS-Rollouts stumm, damit nur echte Züge zählen.
 */
/**
 * Das `canSummon`-Gate der KARTE, so wie der Server es durchsetzt.
 *
 * Gemessen 30.7.: `isCreatureSummonable` kam in diesem Modul NULL Mal vor —
 * die CPU führte damit eine Legalitätsprüfung nicht aus, die der Server in
 * doPlayCreature unmittelbar nach `validateActionPlay` anwendet. Ergebnis
 * ist dieselbe Klasse von Asymmetrie wie in v103, nur an einer anderen
 * Station: die CPU committet einen Play, den der Server anschließend mit
 * `false` verwirft ("server-nein").
 *
 * Sichtbarster Fall Dark Deepsea God — 353 Fehlschläge im v107-Lauf, Platz 2
 * aller Karten. Sein Kartentext verlangt 2+ Kreaturen, die NICHT in dieser
 * Runde beschworen wurden; das prüft er in seinem eigenen `canSummon`. Die
 * CPU las stattdessen `getSacrificableCreatures`, das diesen Filter NICHT
 * anlegt. Reproduziert:
 *     Körper aus Vorrunden : CPU true  | Server true
 *     Körper diese Runde   : CPU true  | Server FALSE   ← Asymmetrie
 * Verschärft durch v107 selbst: ein Tausch stempelt die Kreatur auf die
 * laufende Runde, der Motor verbrennt also genau das Material, das DDG als
 * Tribut braucht — je besser die Kette läuft, desto öfter sieht DDG
 * spielbar aus, ohne es zu sein.
 *
 * Deckneutral: Karten ohne `canSummon` liefern true, Verhalten unverändert.
 */
function cpuCanSummonHere(engine, pi, cardName, heroIdx) {
  try {
    if (typeof engine.isCreatureSummonable !== 'function') return true;
    return !!engine.isCreatureSummonable(cardName, pi, heroIdx);
  } catch { return true; }
}

/**
 * Kanonische Zusage-Form für JEDEN confirm-Prompt.
 *
 * Es gibt im Projekt zwei Konsumenten-Formen:
 *   • `ctx.promptConfirmEffect` (43 Karten) liest `result?.confirmed === true`
 *   • schlichte Reaktions-/Trigger-Confirms lesen `if (result)`
 * `{ confirmed: true }` erfüllt BEIDE — der blanke Boolean `true` nur die
 * zweite. Eingefroren, damit ein Konsument das geteilte Objekt nicht
 * versehentlich verändert.
 */
const CONFIRM_YES = Object.freeze({ confirmed: true });

/** Beliebige Zusage-Rückgabe auf die duale Form bringen; Ablehnung bleibt null. */
function normalizeConfirm(res) {
  if (res === true) return CONFIRM_YES;
  // ── v394: EIN PROMISE IST AUCH EIN OBJEKT ─────────────────────────
  // Der Zweig darunter hat jedes Objekt ohne `confirmed` ausgespreizt
  // und als `{...res, confirmed: true}` zurueckgegeben. Bei einem
  // Promise ist `{...promise}` aber `{}` — die Antwort wurde also zu
  // einem blanken `{confirmed: true}`, und **das Promise selbst
  // verschwand**. Niemand hat es je abgewartet.
  //
  // Genau eine Karte antwortet asynchron: `ska-harpyformer.js`. Ihr
  // `cpuResponse` setzt `_inMctsSim = true`, ruft `enterFastMode()`,
  // macht `snapshot()` + Rollout und raeumt im `finally` mit
  // `restore(snap)` wieder auf. Verworfen lief diese IIFE LOSGELOEST
  // weiter: die Fahnen standen, waehrend das echte Spiel weiterlief,
  // und ihr spaetes `restore()` warf den Live-Zustand zurueck.
  //
  // Im Messstand sah das so aus: `startGame` loeste auf, waehrend
  // `fastModeTiefe=1` und `_inMctsSim=true` standen — bei
  // `rolloutTiefe=0` und leerem Simulations-Register, weil dieser
  // Pfad in einem KARTENSKRIPT sitzt und keins der fuenf
  // instrumentierten Tore benutzt. Danach sprang der Stand rueckwaerts
  // (Zug 8 → 7, Phase 5 → 2). Ska Harpyformer steckt in acht Decks,
  // darunter Gates to Hell (4x) — dem Deck, an dem sich die Abbrueche
  // gesammelt haben.
  //
  // Thenables werden deshalb DURCHGEREICHT und erst nach dem Aufloesen
  // normalisiert. Der Aufrufer (`promptGeneric`) ist async und wartet
  // sie dann korrekt ab.
  if (res && typeof res.then === 'function') return res.then(normalizeConfirm);
  if (res && typeof res === 'object') {
    // Bereits objektförmig: `confirmed` sicherstellen, Restfelder behalten
    // (manche Karten reichen Zusatzdaten über den Confirm zurück).
    if (res.confirmed === undefined) return { ...res, confirmed: true };
    return res;
  }
  return res ? CONFIRM_YES : null;
}

/**
 * Zähler für optionale "you may"-Bestätigungen (Als Auswertungs-Bedarf).
 * Trennt "das Gehirn wollte den Effekt" von "der Effekt kam zustande" —
 * genau die Lücke, in der der Rückgabeform-Bug jahrelang unsichtbar saß.
 * Reine Telemetrie.
 */
function confirmDiag(engine, promptData, said) {
  try {
    const nm = promptData?._gerryOriginalTitle || promptData?.title;
    if (!nm) return;
    swapDiag(engine, `confirm:${said ? 'ja' : 'nein'}`);
    swapDiag(engine, `confirmcard:${nm}:${said ? 'ja' : 'nein'}`);
  } catch { /* Telemetrie darf nie stören */ }
}

function swapDiag(engine, key) {
  try {
    if (!engine || engine._inMctsSim) return;
    // ── T1: ZUG-AUFLÖSUNG (31.7.) ───────────────────────────────────
    // Alle bisherigen Zähler sind SPIEL-Summen. Der offene Befund ist
    // aber ein Zug-Phänomen: die Null-Quote steigt von 0% im ersten
    // eigenen Zug auf über 70% ab Zug 11, und in 96% dieser Züge liegen
    // spielbare Kreaturen auf der Hand. Ohne Zug-Auflösung lässt sich
    // nicht sagen, WAS im achten Zug anders ist als im dritten.
    // Derselbe Schlüssel wandert deshalb zusätzlich in einen Topf, den
    // der Recorder bei jedem Zugwechsel abholt und leert.
    try {
      const _pi = engine._cpuPlayerIdx;
      if (_pi != null && _pi >= 0) {
        const b = (engine._turnBlockers = engine._turnBlockers || {});
        b[key] = (b[key] || 0) + 1;
      }
    } catch { /* nie stören */ }
    // Getrennt nach Spieler: im Training steuert die CPU BEIDE Seiten,
    // ein gemeinsamer Topf hätte die Zähler verdoppelt (im ersten Lauf
    // lagen die "eigenen Züge" dadurch 2.5× über der Spiellänge). Der
    // Recorder nimmt nur den Topf des beobachteten Spielers.
    const pi = engine._cpuPlayerIdx;
    if (typeof pi !== 'number') return;
    if (!engine._swapDiag) engine._swapDiag = [Object.create(null), Object.create(null)];
    const bucket = engine._swapDiag[pi] || (engine._swapDiag[pi] = Object.create(null));
    bucket[key] = (bucket[key] || 0) + 1;
  } catch { /* Telemetrie darf nie stören */ }
}

function pickCreatureZoneSlot(engine, pi, heroIdx, cardName) {
  const ps = engine.gs.players[pi];
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  const free = [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) free.push(z);
  }
  // Als Befund (Deepsea-Fundamentaldiagnose): Die Tausch-Beschwörung
  // funktioniert UNABHÄNGIG vom Level (canBypassLevelReqIfBounceable),
  // der reguläre Summon auf einen freien Slot dagegen nicht. Die alte
  // "freier Slot schlägt Bounce"-Regel wählte deshalb für Lv2-Deepseas
  // ohne Summoning Magic 2 den einzigen ILLEGALEN Platzierungsweg —
  // Witch/Werewolf blieben liegen (nur 23% der Lv2-Plays vor SM2, und
  // die fast nur über volle Boards), das Board erreichte kaum je
  // Summenlevel 4 und DDG kam nicht (Median-Cast Zug 20). Deshalb:
  // Erfüllt der Held den NORMALEN Level-Pfad nicht, ist der Bounce der
  // bevorzugte Slot, auch wenn Zonen frei sind. Bewusst nur der primäre
  // Schul-Zähler ohne Reduktions-/Coverage-Pfade — falls eine Reduktion
  // den Normal-Summon doch legal machte, ist der Bounce trotzdem legal
  // und kostet nur den zurückgenommenen Insassen (der als Handkarte für
  // den nächsten Swap wiederkommt und Siphem-Counter erzeugt).
  const cdForLevel = engine._getCardDB()[cardName];
  let normalLevelOk = true;
  if (cdForLevel) {
    const lvl = cdForLevel.level || 0;
    const schools = [];
    if (cdForLevel.spellSchool1) schools.push(cdForLevel.spellSchool1);
    if (cdForLevel.spellSchool2 && cdForLevel.spellSchool2 !== cdForLevel.spellSchool1) schools.push(cdForLevel.spellSchool2);
    if (schools.length > 0 && lvl > 0) {
      let combined = 0;
      try {
        for (const sc of schools) combined += engine.countAbilitiesForSchool(sc, ps.abilityZones?.[heroIdx]) || 0;
      } catch { combined = lvl; /* im Zweifel Altverhalten */ }
      const hero = ps.heroes?.[heroIdx];
      const heroBypass = hero?.bypassLevelReq && lvl <= hero.bypassLevelReq.maxLevel
        && hero.bypassLevelReq.types?.includes(cdForLevel.cardType);
      normalLevelOk = combined >= lvl || !!heroBypass;
    }
  }
  if (!normalLevelOk) {
    const viaBounce = pickBouncePlacementSlot(engine, pi, heroIdx, cardName);
    if (viaBounce >= 0) { swapDiag(engine, 'pick:bounce-lvl'); return viaBounce; }
    swapDiag(engine, 'pick:lvl-no-target');
    // kein Bounce-Ziel → Altverhalten (freier Slot; Engine-Reduktionen
    // können den Summon noch legalisieren)
  }
  // ── H1 (Vergleichsanalyse Demos 1-3): Swap als WERT-Aktion ──
  // Die alte Regel "Freier Slot schlägt Bounce: der reguläre Summon
  // liefert denselben on-play-Trigger, behält aber den Insassen" ist
  // durch Als Pilot-Spiele widerlegt: Er swappt 2.17×/ZUG bei
  // Board-Max Ø 4.7 — freie Slots waren fast immer da. Der Zyklus
  // schlägt den Insassen, WENN der Motor läuft: jeder Bounce erzeugt
  // Siphem-Counter + Teppes-Draw, und die zurückgenommene Karte ist
  // ein weiterer on-play-Trigger für später. Der Motor-Check läuft
  // generisch über den Hero-Vertrag `cpuValuesBounces` (exportiert von
  // Siphem/Teppes), damit hier kein Deck-Wissen by-name steht.
  //
  // KORREKTUR (Messung 29.7.): hier stand zusätzlich `hand.length < 7`
  // mit der Begründung, ein Bounce triebe die Karte am Zugende ins
  // Discard-Cleanup. Diese Begründung war SACHLICH FALSCH — der Swap
  // ist handneutral: `commitHandRemoval()` nimmt die gespielte Karte
  // VOR `_runBeforeSummon` von der Hand, erst danach legt
  // tryBouncePlace den Insassen zurück. Die Hand geht also 7 → 6 → 7
  // und überschreitet das Limit nie.
  // Die Bedingung war zugleich der mit Abstand größte Engpass:
  // 10065 von 13206 Slot-Entscheidungen (76%) endeten deswegen auf
  // einem freien Slot — und genau die dorthin umgeleiteten
  // Normal-Plays lehnt das Gate zu 99.8% ab (Delta −12..0 gegen
  // Schwelle +3), während Swaps zu 72% durchgehen. Der Block
  // verhinderte also ausgerechnet bei voller Hand die einzige
  // Aktion, die tatsächlich zustande kommt.
  let bounceValued = false;
  try {
    for (const h of (ps.heroes || [])) {
      // KEIN hp-Filter (Als Ruling, 31.7.): der Tausch erzeugt seinen
      // On-Summon-Trigger unabhängig davon, ob der Held lebt. Vorher
      // schaltete der Tod von Teppes/Siphem den gesamten Motor-Zweig ab
      // — messbar als `pick:no-motor`, 1985 Treffer allein in Null-Zügen,
      // und 59.7% aller Null-Züge waren "Bounce-Ziel da, Held tot".
      // Der Vertrag beschreibt die DECK-Identität, nicht den Zustand
      // eines einzelnen Helden.
      if (!h || !h.name) continue;
      if (loadCardEffect(h.name)?.cpuValuesBounces) { bounceValued = true; break; }
    }
  } catch { /* Vertrag ist optional */ }
  if (bounceValued) {
    // Volle Hand weiterhin ZÄHLEN (Diagnose), aber nicht mehr blocken.
    if ((ps.hand || []).length >= 7) swapDiag(engine, 'pick:hand-full-allowed');
    const viaBounce = pickBouncePlacementSlot(engine, pi, heroIdx, cardName);
    if (viaBounce >= 0) { swapDiag(engine, 'pick:bounce-motor'); return viaBounce; }
    swapDiag(engine, 'pick:motor-no-target');
  } else {
    swapDiag(engine, 'pick:no-motor');
  }
  // Ohne laufenden Motor gilt weiter: freier Slot schlägt Bounce (der
  // reguläre Summon liefert denselben on-play-Trigger und behält den
  // Insassen auf dem Board).
  if (free.length) {
    swapDiag(engine, 'pick:free-slot');
    return free[Math.floor(Math.random() * free.length)];
  }
  const last = pickBouncePlacementSlot(engine, pi, heroIdx, cardName);
  swapDiag(engine, last >= 0 ? 'pick:bounce-fallback' : 'pick:none');
  return last;
}

// Bounce-Platzierung als eigene Funktion, damit die level-bewusste
// Slot-Wahl oben sie auch bei FREIEN Zonen ansteuern kann.
function pickBouncePlacementSlot(engine, pi, heroIdx, cardName) {
  const ps = engine.gs?.players?.[pi];
  // ── Bounce-Place-Vertrag (Deepsea-Linie, Als Befund zu Dark Deepsea
  // God) ──
  // listEligibleHeroesForActionCard lässt Karten mit
  // `canBypassFreeZoneRequirement` auf VOLLEN Boards ausdrücklich zu
  // ("Genau in vollen Boards ist der Swap am wertvollsten"), aber diese
  // Slot-Wahl kannte nur freie Zonen und lieferte -1 — woraufhin die
  // Aufrufer die Karte still verwarfen. Der menschliche Spielpfad
  // (server.js) konsultiert an derselben Stelle `canPlaceOnOccupiedSlot`
  // und setzt `_requestedBouncePlaceSlot` für den beforeSummon-Hook; die
  // CPU sah die Option nie. Betrifft die gesamte Deepsea-Kreaturen-Linie
  // (17 Karten): jede darf als inhärente Bonus-Aktion eine ältere
  // Deepsea-Kreatur auf die Hand zurückbouncen und deren Slot einnehmen —
  // der Motor des Decks, weil so jede Runde neue on-play-Trigger
  // entstehen. Ohne diesen Zweig invertierte sich der Deckplan: je mehr
  // Kreaturen gespammt wurden, desto voller die Zonen, desto seltener war
  // überhaupt noch etwas spielbar.
  if (!cardName) return -1;
  let script = null;
  try { script = loadCardEffect(cardName); } catch { return -1; }
  if (!script) return -1;

  // Gewährt die Karte den Bypass für volle Zonen überhaupt? Das ist
  // dieselbe Prüfung, die listEligibleHeroesForActionCard fährt — hier
  // wiederholt, damit die Slot-Wahl auch allein aufgerufen korrekt ist.
  // Nötig, weil manche Karten die AGGREGAT-Regel nur hier tragen: Dark
  // Deepsea Gods canPlaceOnOccupiedSlot bejaht jeden Slot mit einem
  // Opfer-Kandidaten, die Bedingung "2+ Kreaturen, Summenlevel ≥ 4"
  // steckt dagegen in canBypassFreeZoneRequirement.
  const cardData = engine._getCardDB()[cardName];
  if (typeof script.canBypassFreeZoneRequirement === 'function') {
    try {
      if (!script.canBypassFreeZoneRequirement(engine.gs, pi, heroIdx, cardData, engine)) return -1;
    } catch { return -1; }
  }

  // Bevorzugt die vom Skript selbst gemeldeten Ziele (kennen die
  // kartenspezifische Regel, z.B. "nicht in dieser Runde beschworen").
  const cands = [];
  if (typeof script.getBouncePlacementTargets === 'function') {
    try {
      for (const t of (script.getBouncePlacementTargets(engine.gs, pi, engine) || [])) {
        if (!t || t.heroIdx !== heroIdx) continue;
        const z = t.slotIdx;
        if (z >= 0 && z < 3 && !cands.includes(z)) cands.push(z);
      }
    } catch { /* Ziel-Liste ist optional — Fallback unten */ }
  }

  // ── Opfer-Wahl: gelernter Kanal statt Münzwurf (Als Auftrag) ──────
  // Bis v83 stand hier `Math.random()` — WELCHE Kreatur auf die Hand
  // zurückgeht, war reiner Zufall, obwohl genau das die zentrale
  // Ketten-Entscheidung ist. Als Ruling: die Karten mit der höchsten
  // Ausspiel-Priorität sollen bevorzugt zurückgebounct werden (sie
  // stehen dann bereit, um erneut zu feuern); Ausnahme sind
  // Konstellationen, die gerade eine Opfer-Bedingung erfüllen. Beides
  // wird NICHT hartkodiert: `classifyBounceTags` beschreibt die Lage,
  // die Gewichte kommen aus dem gelernten Kanal `bounceRules`.
  // Ohne Profil ist der Prior 0 → die Wahl fällt wieder zufällig aus
  // (exakt das Altverhalten), das Deck lernt sie sich also selbst an.
  const _victimAt = (z) => {
    try {
      const nm = ((ps.supportZones?.[heroIdx] || [])[z] || [])[0];
      if (!nm) return null;
      return (engine.cardInstances || []).find(ci => ci
        && ci.zone === 'support' && ci.heroIdx === heroIdx
        && ci.zoneSlot === z && (ci.controller ?? ci.owner) === pi) || { name: nm };
    } catch { return null; }
  };
  const _logBounce = (tags) => {
    try {
      if (engine._inMctsSim) return;
      // EIGENER Log-Name: `_bounceLog` gehört bereits der Bounce-
      // Telemetrie im Recorder (Struktur {t, c:[Namen], by}) und wird
      // ungefiltert als Feld `bounces` ausgeliefert. In v84 schrieb
      // dieser Kanal versehentlich in dasselbe Array — die Telemetrie
      // war dadurch mit Einträgen anderer Struktur durchsetzt (der
      // Lernkanal blieb sauber, weil er auf `pi` filtert, das den
      // Original-Einträgen fehlt).
      if (!engine._bounceDecisionLog) engine._bounceDecisionLog = [];
      engine._bounceDecisionLog.push({ pi, c: cardName, t: engine.gs?.turn || 0, tags: tags || [] });
    } catch { /* nie stören */ }
  };
  const _chooseSlot = (slots) => {
    if (!slots.length) return -1;
    // Trainings-Exploration: erzeugt die Kontrast-Arme, aus denen der
    // Trainer die Regeln überhaupt erst lernen kann (gleiches Muster
    // wie PP_PLACE_EXPLORE beim Platzierungs-Kanal).
    const eps = parseFloat(process.env.PP_BOUNCE_EXPLORE || '0.25');
    if (process.env.PP_TRAIN && !engine._inMctsSim && slots.length > 1 && Math.random() < eps) {
      const z = slots[Math.floor(Math.random() * slots.length)];
      _logBounce(deckProfile.classifyBounceTags(engine, pi, _victimAt(z)));
      return z;
    }
    let best = -1, bestScore = -Infinity, bestTags = null;
    for (const z of slots) {
      const tags = deckProfile.classifyBounceTags(engine, pi, _victimAt(z));
      const score = deckProfile.bouncePrior(engine, pi, tags) + Math.random() * 0.5;
      if (score > bestScore) { bestScore = score; best = z; bestTags = tags; }
    }
    _logBounce(bestTags);
    return best;
  };

  // `canPlaceOnOccupiedSlot` ist die Autorität (dieselbe Prüfung, die der
  // Server fährt): gemeldete Ziele werden damit validiert, fehlen sie,
  // dient sie als Scan über alle Slots.
  if (typeof script.canPlaceOnOccupiedSlot === 'function') {
    const pool = cands.length ? cands : [0, 1, 2];
    const ok = [];
    for (const z of pool) {
      try {
        if (script.canPlaceOnOccupiedSlot(engine.gs, pi, heroIdx, z, engine)) ok.push(z);
      } catch { /* einzelner Slot unklar → überspringen */ }
    }
    return _chooseSlot(ok);
  }

  return _chooseSlot(cands);
}

// Heuristic detection of "this Equipment increases the equipped Hero's Attack."
// Pattern-based on the card effect text. False positives are harmless (CPU just
// equips on highest-atk Hero instead of random); false negatives mean a buff
// Equipment lands on a random Hero, which is the fallback the user accepted.
function isAtkBoostEquip(cardData) {
  const effect = (cardData.effect || '').toLowerCase();
  if (!effect) return false;
  if (/attack\s+stat\s+is\s+increased\s+by/.test(effect)) return true;
  if (/\+\s*\d+\s*(?:base\s+)?attack\b/.test(effect)) return true;
  if (/\battack\s*\+\s*\d+/.test(effect)) return true;
  if (/gains?\s+\d+\s+attack/.test(effect)) return true;
  return false;
}

// ─── Abilities ──────────────────────────────────────────────────────────
// Per user spec: max 1 Ability per Hero per turn. Attach priority is
// tiered — always keep stacking onto already-present abilities until none
// can stack further, only then spread to new heroes:
//
//   TIER 1 STACK:  living hero ALREADY has this ability at lvl < 3.
//   TIER 2 NEW:    the ability is on NO living hero yet — bring it in fresh.
//   TIER 3 SPREAD: the ability is on ≥1 living hero but at max (lvl 3)
//                  or only on dead heroes — attach to a hero who doesn't
//                  have it yet, filling an empty slot.
//
// On each attach we pick the highest available tier; within a tier we pick
// randomly so the CPU doesn't deterministically funnel every ability into
// Hero 0. Resolves around abilityGivenThisTurn (1 attach per hero per turn).

function heroHasAbility(ps, hi, cardName) {
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if ((slot || []).length > 0 && slot[0] === cardName) return true;
  }
  return false;
}

function heroHasAbilityAtMaxLevel(ps, hi, cardName) {
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if ((slot || []).length >= 3 && slot[0] === cardName) return true;
  }
  return false;
}

function anyLivingHeroHasAbility(ps, cardName) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (heroHasAbility(ps, hi, cardName)) return true;
  }
  return false;
}

// Score an (ability, hero) attachment candidate. Higher = better. The
// dominant term is "how many spells/attacks/creatures in hand (and, less
// weighted, in deck) would become legally castable on THIS hero once this
// copy is placed", level-weighted so unlocking a Lv3 card is worth more
// than unlocking a Lv1. A small current-level bias breaks ties toward
// stacks that climb higher (Zsos'Ssar at Decay 2 → 3 beats Medea at
// Decay 1 → 2 when neither unlocks a new card), and — more importantly —
// lets lv3-in-hand dominate the choice even when the lower-level stack
// would unlock a lv2 card (600+ vs 400+).
//
// Also handles non-school abilities (Leadership, Toughness, Wisdom,
// Performance): unlock term is 0, so the tie-break elects the hero
// closest to level 3.
// Credit a spell-level-reducer Ability (e.g. Mana Mining, which lowers the
// level of Pollution-placing Spells) for every Spell / Attack / Creature it
// would turn from un-castable into castable on THIS hero once placed. The
// normal `unlock` term in scoreAbilityPlacement only fires for abilities a
// card lists as spellSchool1/2 — a level reducer adds NO school level, so it
// would otherwise score 0 and the CPU would never prioritise it, leaving the
// deck's whole Spell suite locked. We simulate the placement on a copy of the
// hero's ability zones and diff the engine's side-effect-free level check
// (which already applies reduceSpellLevel) before vs after.
function scoreSpellLevelReducerUnlock(engine, pi, heroIdx, cardName, script, abZones, ps, cardDB) {
  if (typeof engine._testLevelReqForZones !== 'function') return 0;
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name) return 0;
  // Post-placement zones: stack onto an existing copy (< lvl 3), else drop
  // into the first empty slot. No room → nothing to score.
  const simZones = abZones.map(slot => (slot ? slot.slice() : []));
  let placed = false;
  for (const slot of simZones) {
    if (slot.length > 0 && slot[0] === cardName && slot.length < 3) { slot.push(cardName); placed = true; break; }
  }
  if (!placed) {
    for (const slot of simZones) {
      if (slot.length === 0) { slot.push(cardName); placed = true; break; }
    }
  }
  if (!placed) return 0;

  let unlock = 0;
  const scan = (arr, weight) => {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      const t = cd.cardType;
      if (t !== 'Spell' && t !== 'Attack' && t !== 'Creature') continue;
      const rawLevel = cd.level || 0;
      if (rawLevel <= 0) continue;
      // Cheap pre-filter: only cards this ability actually reduces.
      let red = 0;
      try { red = Number(script.reduceSpellLevel(cd, 3, engine)) || 0; } catch {}
      if (red <= 0) continue;
      // Already castable here → no unlock credit; only count newly-unlocked.
      let before = true;
      try { before = engine._testLevelReqForZones(pi, heroIdx, cd, hero, rawLevel, abZones); } catch {}
      if (before) continue;
      let after = false;
      try { after = engine._testLevelReqForZones(pi, heroIdx, cd, hero, rawLevel, simZones); } catch {}
      if (after) unlock += rawLevel * weight;
    }
  };
  scan(ps.hand, 2);
  scan(ps.mainDeck, 1);
  return unlock;
}

function scoreAbilityPlacement(engine, pi, heroIdx, cardName, _tiefe = 0) {
  // v325: Rekursionsdeckel. Der Joker-Zweig unten bewertet fremde Stapel
  // erneut; legitim ist dabei GENAU eine Ebene. Alles darueber ist ein
  // Zyklus — ohne Deckel endete er in `RangeError: Maximum call stack
  // size exceeded` und riss den ganzen CPU-Zug mit (Als Report 11.8.:
  // Spiel als TIE/no-result verbucht).
  if (_tiefe > 2) return 0;
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx];
  if (!abZones) return 0;
  const cardDB = engine._getCardDB();

  // ── JOKER-ABILITIES (1.8., Als Report "die CPU tat nichts") ───────
  // Performance zählt für die Schule des Stapels, auf dem sie liegt
  // (`isWildcardAbility`, siehe `countAbilitiesForSchool`). Die
  // Bewertung unten fragt aber `cd.spellSchool1 === cardName` — und
  // KEINE Karte nennt "Performance" als Schule. Für Joker war der
  // Freischalt-Term deshalb immer 0, die CPU legte sie nie an.
  //
  // Belegt im Mitschnitt gegen "Join our Cult!": die CPU hielt ZWEI
  // Performance und tat in zwei Zügen nichts, obwohl Klaus mit
  // Summoning Magic 1 → 2 den Haressassin (Lv2) und mit Decay Magic
  // 2 → 3 die Forbidden Zone (Lv3, gelernter Wert 93 — ihre stärkste
  // Karte) freigeschaltet hätte.
  //
  // Für einen Joker wird deshalb der BESTE erreichbare Stapel bewertet:
  // er hebt die Schule des Stapels, dem er beitritt, um eine Stufe.
  // Gewertet wird die Variante mit dem größten Freischalt-Gewinn.
  const _wildScript = (() => {
    try { return require('./_loader').loadCardEffect(cardName); }
    catch { return null; }
  })();
  if (_wildScript?.isWildcardAbility) {
    let best = 0;
    for (const slot of abZones) {
      const base = (slot || [])[0];
      if (!base || slot.length >= 3) continue;   // leerer Stapel bringt keine Schule, voller geht nicht
      // v325: Ein Stapel, dessen BASIS selbst ein Joker ist, hat GAR KEINE
      // Schule — `countAbilitiesForSchool` zaehlt einen Joker als Schule
      // der Basis, und keine Karte nennt "Performance" als Schule. So ein
      // Stapel ist also wie ein leerer zu behandeln. Ohne diese Zeile ruft
      // sich die Funktion mit DEMSELBEN Namen erneut auf: Endlosrekursion,
      // sobald die CPU eine Performance auf einen leeren Platz gelegt hat.
      if (base === cardName) continue;
      let _basisScript = null;
      try { _basisScript = require('./_loader').loadCardEffect(base); } catch { _basisScript = null; }
      if (_basisScript?.isWildcardAbility) continue;
      // Wert dieses Stapels = Bewertung, als hinge man die BASIS-Ability
      // ein weiteres Mal an (gleiche Wirkung auf die Schulstufe).
      const v = scoreAbilityPlacement(engine, pi, heroIdx, base, _tiefe + 1);
      if (v > best) best = v;
    }
    return best;
  }

  // Current level the hero has in this ability (max across zones).
  let currentLevel = 0;
  for (const slot of abZones) {
    if (!slot) continue;
    if (slot[0] === cardName) currentLevel = Math.max(currentLevel, slot.length);
  }
  const newLevel = currentLevel + 1;

  // Walk hand+deck ONCE to gather everything we need:
  //   • `unlock` — level-weighted count of cards that were NOT castable
  //     pre-stack (`lvl > currentLevel`) but ARE post-stack
  //     (`lvl <= newLevel`) AND require this specific school.
  //   • `maxNeededLevel` — highest level requirement across ALL cards in
  //     hand+deck that need this school. Drives the saturation gate
  //     below: stacking past this ceiling unlocks nothing the deck
  //     can't already cast.
  //   • `scalingValue` — generic bonus from cards that declare
  //     `cpuMeta.scalesWithSchool === cardName` in their script. These
  //     are spells/attacks whose effect strength keeps scaling with the
  //     school's level beyond the cast threshold (Heal: 150/200/300 by
  //     Support Magic count; Phoenix Tackle: 100/200/300 by Destruction
  //     Magic count). Optional numeric `cpuMeta.schoolScalingValue`
  //     overrides the default per-card weight (60).
  let unlock = 0;
  let maxNeededLevel = 0;
  let scalingValue = 0;
  const scan = (arr, weight) => {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      const t = cd.cardType;
      if (t !== 'Spell' && t !== 'Attack' && t !== 'Creature') continue;
      const lvl = cd.level || 0;
      const needsThisSchool = (cd.spellSchool1 === cardName || cd.spellSchool2 === cardName);
      if (needsThisSchool && lvl > maxNeededLevel) maxNeededLevel = lvl;
      if (needsThisSchool && lvl > currentLevel && lvl <= newLevel) {
        unlock += lvl * weight;
      }
      // School-scaling spells (declared via cpuMeta — generic, no
      // per-card hardcoding here). Each scaling card in hand/deck
      // contributes `scalingValue * weight` per level reached: stacking
      // higher = stronger Heal / bigger Phoenix Tackle / etc., even
      // when the spell was already castable at the current school
      // level. Picked up dynamically from the script — any future
      // scaling card just sets the meta field.
      const script = (() => {
        try { return require('./_loader').loadCardEffect(cn); }
        catch { return null; }
      })();
      const meta = script?.cpuMeta;
      const scalesWith = meta?.scalesWithSchool;
      if (typeof scalesWith === 'string' && scalesWith === cardName) {
        const v = typeof meta.schoolScalingValue === 'number' ? meta.schoolScalingValue : 60;
        scalingValue += v * weight;
      }
    }
  };
  scan(ps.hand, 2);      // hand cards will be played sooner — worth more
  scan(ps.mainDeck, 1);  // deck cards count too, at half weight

  // Saturation gate: if stacking past `currentLevel` unlocks nothing
  // (no card in hand/deck requires this school at level > currentLevel)
  // AND no scaling spell benefits from a higher school count, the stack
  // is dead weight. Return a tiny score so the CPU prefers ANY other
  // ability placement (or doesn't bother placing this copy at all).
  // Saturation only applies when the ability IS a school the deck
  // actually uses — non-school abilities (Leadership, Toughness,
  // Wisdom, Performance) skip the gate because `maxNeededLevel === 0`
  // would otherwise misclassify them.
  const isSchoolAbility = maxNeededLevel > 0
    || scalingValue > 0
    || (cd_anyDeckCardNeedsSchool(cardDB, ps, cardName));
  if (isSchoolAbility && newLevel > maxNeededLevel && scalingValue === 0) {
    return 0;
  }

  // ── Per-card attachment bonus ─────────────────────────────────────
  // Cards whose value depends on which Hero they're attached to
  // (because the ability's effect READS state on the host Hero — its
  // existing ability stacks, archetype-specific board state, etc.)
  // can declare:
  //
  //   cpuMeta: {
  //     attachmentBonus(engine, pi, heroIdx) → number
  //   }
  //
  // Returned points are summed straight onto the placement score so
  // the candidate-loop above prefers the genuinely-best host. The
  // function is called with `pi` and the prospective `heroIdx`; the
  // ability has NOT been attached yet, so the implementer simulates
  // the post-attach state themselves (reading existing ability stacks
  // + bumping the new level by 1 internally where relevant).
  //
  // Generic — no per-card hardcoding here. Necromancy uses this to
  // weight heroes by "Summoning Magic level on this hero × Creatures
  // currently in own discard the hero could summon"; any future
  // attachment-sensitive ability opts in the same way.
  let attachmentBonus = 0;
  const script = (() => {
    try { return require('./_loader').loadCardEffect(cardName); }
    catch { return null; }
  })();
  if (typeof script?.cpuMeta?.attachmentBonus === 'function') {
    try {
      const v = script.cpuMeta.attachmentBonus(engine, pi, heroIdx);
      if (Number.isFinite(v)) attachmentBonus = v;
    } catch (err) {
      console.error(`[CPU] ${cardName} attachmentBonus threw:`, err.message);
    }
  }

  // Spell-level-reducer abilities (Mana Mining) add no school level, so the
  // `unlock` term above is 0 for them — credit them by how many cards this
  // placement turns castable on the hero (the engine applies the reduction
  // inside its level check). Weighted like a school unlock.
  let reducerUnlock = 0;
  if (typeof script?.reduceSpellLevel === 'function') {
    reducerUnlock = scoreSpellLevelReducerUnlock(engine, pi, heroIdx, cardName, script, abZones, ps, cardDB);
  }

  // ── Learned placement prior ────────────────────────────────────────
  // ML-trained (ability → hero) prior from the deck's profile: games
  // where this ability ended up stacked on this hero correlated with
  // winning (positive) or losing (negative). Additive on the same
  // scale as the structural terms so a strong learned prior can break
  // ties and redirect stacks, but a hard structural unlock (unlock*100)
  // still dominates when it disagrees.
  let learnedPrior = 0;
  const heroName = ps?.heroes?.[heroIdx]?.name;
  if (heroName) {
    learnedPrior = deckProfile.abilityPlacementBonus(engine, pi, cardName, heroName)
      + deckProfile.boardPairBonus(engine, pi, cardName, heroIdx);
  }

  // Scaling cards add value proportional to the new level (each level
  // reached cranks Heal/Phoenix Tackle/etc. higher). Heuristically the
  // bonus is `scalingValue * newLevel`; combined with the unlock term
  // it lets a 3-Heal deck still want Support Magic Lv3 even when the
  // deck has nothing requiring Support Magic Lv2/Lv3 to cast.
  // ── Held-Vertrag: cpuAbilityAttachBonus ──────────────────────────
  // Ein HELD kann Ability-Platzierungen auf sich anziehen/abstoßen
  // (Rafflesia zieht Decay/Support Magic zu sich, damit ihr
  // Doppelzauber-Kern castbar wird). Helden ohne Export → 0, alte
  // Decks bleiben unberührt.
  let heroContractBonus = 0;
  if (heroName) {
    try {
      const heroScript = loadCardEffect(heroName);
      if (typeof heroScript?.cpuAbilityAttachBonus === 'function') {
        heroContractBonus = Number(heroScript.cpuAbilityAttachBonus(engine, pi, heroIdx, cardName)) || 0;
      }
    } catch {}
  }

  // ── Attach-Draw-Kontext (Deckout-Prävention, generischer Contract) ──
  // Abilities mit cpuMeta.attachTriggersDraw (Creativity) ziehen Karten,
  // wenn IHR Held eine weitere Ability angehängt bekommt. Bei gefährlich
  // kleinem Deck bestraft jeder erwartete Draw das Anhängen an DIESEN
  // Helden — die Ability wird weiter gespielt, nur beim draw-freien
  // Helden. Kalibrierung ×25: Lv3-Creativity = −75, redirectet Stacks
  // gegen Priors/Ties, überstimmt aber keinen strukturellen Unlock
  // (unlock×100) — wer die Schule WIRKLICH braucht, kriegt sie trotzdem.
  let attachDrawMalus = 0;
  if (deckIsDangerouslySmall(engine, pi)) {
    for (const slot of (ps.abilityZones?.[heroIdx] || [])) {
      if (!slot || !slot.length) continue;
      const meta = loadCardEffect(slot[0])?.cpuMeta?.attachTriggersDraw;
      if (!meta) continue;
      const lvl = Math.min(3, slot.length);
      attachDrawMalus += (meta.drawsAtLevel?.[lvl] || 0) * 25;
    }
  }

  return unlock * 100 + reducerUnlock * 100 + scalingValue * newLevel + currentLevel * 10 + attachmentBonus + learnedPrior + heroContractBonus - attachDrawMalus;
}

// Cheap helper: does ANY card in hand+deck require this school for its
// cast (independent of level)? Used by the saturation gate to decide
// "is this even a school-typed ability for our deck" — non-school
// abilities (Leadership, Toughness, …) shouldn't be saturation-gated.
function cd_anyDeckCardNeedsSchool(cardDB, ps, schoolName) {
  const sources = [ps?.hand, ps?.mainDeck];
  for (const arr of sources) {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      if (cd.spellSchool1 === schoolName || cd.spellSchool2 === schoolName) return true;
    }
  }
  return false;
}

// Predicate: would placing this ability copy be a useless saturated
// stack of a Spell-School ability? Used by the candidate-builder loop
// to drop these placements ENTIRELY (as opposed to scoring 0 and
// tying with other genuinely-zero placements like Toughness on a
// fresh hero). Saturation triggers when:
//   • The ability is one this deck actually uses as a school (some
//     hand/deck card lists it as spellSchool1/2 OR a scaling card
//     declares it via cpuMeta.scalesWithSchool).
//   • The would-be new level exceeds the highest level any hand/deck
//     card needs for that school.
//   • No hand/deck card declares scaling for this school (those
//     keep wanting more levels even past the cast threshold).
function isAbilityStackSaturated(engine, pi, heroIdx, cardName) {
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx];
  if (!abZones) return false;
  const cardDB = engine._getCardDB();
  let currentLevel = 0;
  for (const slot of abZones) {
    if (!slot) continue;
    if (slot[0] === cardName) currentLevel = Math.max(currentLevel, slot.length);
  }
  const newLevel = currentLevel + 1;
  // Walk hand+deck once. Same logic as scoreAbilityPlacement but only
  // computes the gate-relevant numbers (no scoring math).
  let maxNeededLevel = 0;
  let hasScaler = false;
  let isSchoolAbility = false;
  const { loadCardEffect } = require('./_loader');
  const scan = (arr) => {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      if (cd.spellSchool1 === cardName || cd.spellSchool2 === cardName) {
        isSchoolAbility = true;
        const lvl = cd.level || 0;
        if (lvl > maxNeededLevel) maxNeededLevel = lvl;
      }
      const meta = loadCardEffect(cn)?.cpuMeta;
      if (meta?.scalesWithSchool === cardName) {
        isSchoolAbility = true;
        hasScaler = true;
      }
    }
  };
  scan(ps.hand);
  scan(ps.mainDeck);
  if (!isSchoolAbility) return false; // Non-school ability — never gated.
  if (hasScaler) return false;        // Scaling spells want more levels.
  return newLevel > maxNeededLevel;
}

async function attachAbilities(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Once an ability has been attached this turn (by ANY tier — stack,
  // new, or spread), further copies in hand are barred from tier-3
  // placements for the rest of the turn. The goal is to hold remaining
  // copies until next turn, where they can stack on the holder(s) via
  // tier 1 instead of thinly spreading across more heroes now.
  const placedThisTurn = new Set();

  // Safety cap: at most 6 passes — one pass can attach one (hero, ability).
  // Each hero only gets one attach per turn, so the loop naturally terminates
  // once every hero is filled or no tiered candidate remains.
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return marke(engine, `aus:attachAbilities#1:still@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);

    // ── Per-pass placement biases (recomputed each pass since the
    // ability board state changes between attaches). Each Ability
    // opts in via `cpuMeta.cpuPlacementBias(engine, pi, helpers)`,
    // returning either null (no bias this pass) or
    //   { allowedHeroes?: Set<heroIdx>, slotByHero?: Map<heroIdx, slotIdx> }
    // When `allowedHeroes` is present, candidates whose heroIdx isn't
    // in the set are dropped from this pass. When `slotByHero` is
    // present and contains the candidate's heroIdx, it overrides the
    // planner's auto-resolved slot.
    const heroes = ps.heroes || [];
    const biasHelpers = {
      heroHasAbilityAtMaxLevel,
      heroRejectsAbility,
      resolveAbilitySlot,
    };
    const biasByCard = new Map();
    const getBias = (cardName) => {
      if (biasByCard.has(cardName)) return biasByCard.get(cardName);
      const fn = loadCardEffect(cardName)?.cpuMeta?.cpuPlacementBias;
      let bias = null;
      if (typeof fn === 'function') {
        try { bias = fn(engine, cpuIdx, biasHelpers) || null; }
        catch (err) {
          console.error(`[cpu] cpuPlacementBias ${cardName} threw:`, err.message);
          bias = null;
        }
      }
      biasByCard.set(cardName, bias);
      return bias;
    };

    const tier1 = [], tier2 = [], tier3 = [];
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Ability') continue;

      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (ps.abilityGivenThisTurn[hi]) continue;

        // Rule exception: hero already has this ability at lvl 3 — don't
        // send another copy to THIS hero (nothing to stack onto, and the
        // user explicitly excludes max-leveled heroes from stacking).
        if (heroHasAbilityAtMaxLevel(ps, hi, cardName)) continue;

        // Per-hero ability reject list (e.g. Ascended Beato refuses Spell-
        // School abilities — she's already at effective level 9 in every
        // school, so the copy is always better placed elsewhere).
        if (heroRejectsAbility(engine, cpuIdx, hi, cardName, cd)) continue;

        // ── Per-card placement biases (generic — driven by each
        //    Ability's `cpuMeta.cpuPlacementBias`) ──
        const bias = getBias(cardName);
        if (bias?.allowedHeroes && !bias.allowedHeroes.has(hi)) continue;

        let slot = resolveAbilitySlot(engine, cpuIdx, hi, cardName);
        if (slot === null) continue;

        // Spell-School saturation gate: if stacking this Ability would
        // exceed the deck's highest needed level for that school AND
        // no scaling Spell in hand/deck wants more, drop the candidate
        // entirely. Without this filter, a saturated stack with score
        // 0 still ties with genuinely-zero non-school placements
        // (Toughness etc.) and gets randomly chosen — re-introducing
        // the dead-stack behaviour the user reported. Dropping the
        // candidate keeps the copy in hand for a turn where it can
        // land somewhere useful (e.g. on a freshly-summoned hero).
        if (isAbilityStackSaturated(engine, cpuIdx, hi, cardName)) continue;

        // Bias may override the auto-resolved slot for this hero
        // (Performance lands on the hero's Divinity zone specifically).
        if (bias?.slotByHero?.has(hi)) {
          slot = bias.slotByHero.get(hi);
        }

        const entry = { handIdx, cardName, heroIdx: hi, zoneSlot: slot };
        const thisHeroHasIt = heroHasAbility(ps, hi, cardName);
        if (thisHeroHasIt) {
          // Tier 1 (stack): always allowed — stacking improves an existing
          // holder regardless of what was placed earlier this turn.
          tier1.push(entry);
        } else if (!anyLivingHeroHasAbility(ps, cardName)) {
          // Tier 2 (new): still allowed even if another copy of the same
          // name was placed earlier this turn — in practice this can't
          // happen (the earlier placement would have made a living hero
          // hold it, invalidating the tier-2 check here), but leave it
          // for robustness.
          tier2.push(entry);
        } else {
          // Tier 3 (spread to a fresh hero). Bar if this ability was
          // already placed this turn — save the copy in hand instead.
          if (placedThisTurn.has(cardName)) continue;
          tier3.push(entry);
        }
      }
    }

    let pick = null;
    let tierLabel = '';
    const pickBestByScore = (bucket) => {
      if (bucket.length === 0) return null;
      const scored = bucket.map(e => ({
        e, s: scoreAbilityPlacement(engine, cpuIdx, e.heroIdx, e.cardName),
      }));
      const maxS = Math.max(...scored.map(x => x.s));
      const top = scored.filter(x => x.s === maxS).map(x => x.e);
      return top[Math.floor(Math.random() * top.length)];
    };
    if (tier1.length) { pick = pickBestByScore(tier1); tierLabel = 'stack'; }
    else if (tier2.length) { pick = pickBestByScore(tier2); tierLabel = 'new'; }
    else if (tier3.length) { pick = pickBestByScore(tier3); tierLabel = 'spread'; }
    if (!pick) return;

    // Record every placement regardless of tier so tier 3 is blocked for
    // remaining copies of the same ability this turn.
    placedThisTurn.add(pick.cardName);

    cpuLog(`      → attach ability "${pick.cardName}" to hero ${pick.heroIdx} [${tierLabel}]`);
    if (typeof engine._trailWrite === 'function') {
      engine._trailWrite('attach', {
        cardName: pick.cardName,
        note: `p${cpuIdx}/h${pick.heroIdx} tier=${tierLabel}`,
      });
    }
    await helpers.doPlayAbility(helpers.room, cpuIdx, {
      cardName: pick.cardName,
      handIndex: pick.handIdx,
      heroIdx: pick.heroIdx,
      zoneSlot: pick.zoneSlot,
    });
    cpuLog(`      ← ability "${pick.cardName}" done`);
    await pauseAction(engine);
  }
}

/**
 * Returns a zoneSlot to use when calling doPlayAbility, or null if the Ability
 * cannot be attached to this Hero right now.
 *   >=0  : the specific zone to place into (required for customPlacement cards)
 *   -1   : let doPlayAbility auto-place (stack onto existing or first free zone)
 *   null : not attachable
 */
function resolveAbilitySlot(engine, pi, hi, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const hero = ps.heroes[hi];
  if (!hero?.name || hero.hp <= 0) return null;
  if (ps.abilityGivenThisTurn[hi]) return null;

  const script = loadCardEffect(cardName);
  if (script?.canAttachToHero && !script.canAttachToHero(gs, pi, hi, engine)) return null;

  const abZones = ps.abilityZones[hi] || [[], [], []];

  if (script?.customPlacement) {
    // Custom placement cards (e.g. Performance) dictate which zones are legal.
    const candidates = [];
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) candidates.push(z);
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Stack onto existing same-name zone (up to level 3)
  for (let z = 0; z < 3; z++) {
    const zone = abZones[z] || [];
    if (zone.length > 0 && zone[0] === cardName && zone.length < 3) return -1;
  }
  // Otherwise need a free zone
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) return -1;
  }
  return null;
}

// ═══════════════════════════════════════════
//  TARGETING & CHOICE BRAIN (2i + 2j)
// ═══════════════════════════════════════════
// Installed once per engine instance. Overrides _getCpuTargetResponse and
// _getCpuGenericResponse so ALL CPU prompts follow the user's spec instead
// of the puzzle defaults ("pick first option").

// ─── MCTS plan format ─────────────────────────────────────────────────────
// engine._mctsTargetPlan is an array of entries, each one of:
//   • null
//       → placeholder for "this slot uses heuristic" (still consumed)
//   • { kind: 'target', ids: [id, ...] }
//       → scripted promptEffectTarget pick (target IDs validated vs validTargets)
//   • { kind: 'generic:<type>', value: ... }
//       → scripted promptGeneric pick (value validated vs promptData), where
//         <type> is one of 'zonePick', 'cardGallery', 'cardGalleryMulti',
//         'playerPicker'. value is the shape the engine expects as the
//         prompt's return value.
// Each CPU-controlled prompt consumes one entry (by shifting plan[0]) IF it
// matches the prompt's kind and passes validation. On mismatch, the entry
// stays in the queue and the prompt falls through to heuristics — this keeps
// the plan resilient to unexpected extra prompts in the real play.
/**
 * Trägt eine der angebotenen Karten eine HARTE Vorfahrt für diese
 * Entscheidung? Dann ist sie keine Suchfrage mehr und der MCTS-Plan darf
 * sie nicht beantworten.
 *
 * Deckneutral über den vorhandenen Vertrag `gameStartPickPriority` — die
 * einzige Stelle im Projekt, an der eine Karte eine Auswahl hart an sich
 * zieht. Kommt ein zweiter solcher Vertrag dazu, gehört er hier ergänzt.
 * Karten ohne den Vertrag ändern nichts: dann bleibt der Plan zuständig.
 */
function promptHasPinnedAnswer(promptData) {
  try {
    if (!promptData || promptData.type !== 'cardGallery') return false;
    const cards = promptData.cards;
    if (!Array.isArray(cards) || cards.length === 0) return false;
    for (const c of cards) {
      const nm = c?.name || c?.cardName;
      if (!nm) continue;
      const v = loadCardEffect(nm)?.gameStartPickPriority;
      if (typeof v === 'number') return true;
    }
    return false;
  } catch { return false; }
}

const MCTS_BRANCHABLE_GENERIC_TYPES = ['zonePick', 'cardGallery', 'cardGalleryMulti', 'playerPicker', 'optionPicker', 'confirm'];

// ═══════════════════════════════════════════════════════════════════
// NOTBREMSE FÜR DIE MCTS-AUFZEICHNUNG (10.8., aus dem Heap-Snapshot)
//
// Der OOM-Snapshot des abgestürzten Trainingslaufs bestand zu 95 % aus
// GENAU den Einträgen, die unten gepusht werden: 2,72 Mio. Datensätze
// mit `title`/`cancellable`/`kind`/`picked`/`wasScripted`/`alternatives`,
// je 3 Alternativen aus `{ value, label }` — zusammen 1,5 GB.
//
// Ein Rollout sammelt normalerweise eine Handvoll davon. Millionen
// heißt: irgendein Aufrufer fragt DENSELBEN Prompt in einer Schleife
// endlos ab. Diese Schleife feuert dabei weder Hooks noch Snapshots —
// deshalb hat die synchrone Heap-Sonde (die genau an diesen beiden
// Stellen sitzt) nie etwas gemeldet und jeder Wächter blieb stumm.
//
// Die Bremse tut zwei Dinge:
//   1. sie BENENNT den Prompt (Titel, Typ, Spieler, Zug, Phase) — genau
//      die Angabe, die bisher gefehlt hat;
//   2. sie wirft, statt den Prozess volllaufen zu lassen. Der Wurf
//      landet im vorhandenen Rollout-catch, der Zug geht ohne diesen
//      Kandidaten weiter — aus einem toten Lauf wird ein verlorener
//      Rollout.
//
// Schwelle über PP_MCTS_RECORD_CAP (Default 50000; ein gesunder Rollout
// liegt bei einer zweistelligen Zahl, echte Ausreißer bei einigen
// hundert — 50 000 kann kein legitimer Zug erreichen).
// ═══════════════════════════════════════════════════════════════════
const MCTS_RECORD_CAP = (() => {
  const v = parseInt(process.env.PP_MCTS_RECORD_CAP || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 5000;
})();

// ═══════════════════════════════════════════════════════════════════
// ABGEBROCHENE PARTIE = SOFORT AUSSTEIGEN (11.8., aus Als Konsolenlog)
//
// `engine.abort()` setzt nur eine Fahne, die an fünf Stellen geprüft
// wird — die Zugschleife und der MCTS gehören NICHT dazu. Läuft eine
// Partie in den Trainings-Watchdog (im Log: `TIE … (2t, timeout)`),
// dann räumt der Trainer sie ab und startet die nächste, WÄHREND die
// alte Engine im Hintergrund weiterrechnet: sie beantwortet weiter
// Prompts, füllt weiter ihren `_mctsTargetRecord` und bekommt nie ein
// Spielende. Deshalb sieht die Heap-Spur der VORDERGRUND-Partie
// kerngesund aus, während der Prozess am Speicher stirbt — gemessen
// wird das falsche Spiel.
//
// Die Engine gibt bei `_aborted` in `promptGeneric`/`promptEffectTarget`
// `null` zurück. Für einen Aufrufer, der bis zu einer gültigen Wahl
// schleift, ist `null` aber kein Abbruch, sondern ein Grund, es noch
// einmal zu versuchen — endlos. Nur ein Wurf bricht so eine Schleife.
//
// Der Wurf landet im vorhandenen `startGamePromise.catch(() => {})`
// des Trainers; im Live-Spiel wird `abort()` nur beim Abräumen des
// Raums gerufen, dort ist danach ohnehin niemand mehr am Zug.
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// WIEDERHOLUNGSSPERRE (v326) — der allgemeine Riegel gegen
// nicht-fortschreitende Prompt-Schleifen
//
// Belegt am 11.8.: `cloudy-slime.js` fragte in EINEM Rollout 50 001 Mal
// dieselbe Galerie ab. Muster: `while (true)` → CPU waehlt Karte X →
// fuer X gibt es keine freie Zone → `continue` → dieselbe Liste →
// dieselbe Wahl. Elf Karten tragen dieses Schleifenmuster.
//
// Diese Sperre erkennt es unabhaengig von der Karte: WENN dieselbe Frage
// (Typ + Titel + Anzahl Optionen) hintereinander dieselbe Antwort
// bekommt, macht niemand Fortschritt. Alles, was sich aendert — andere
// Frage, andere Antwort — setzt den Zaehler zurueck. Eine gesunde
// Entscheidung wiederholt sich nie hundertfach identisch.
//
// Der Wurf laeuft in den vorhandenen Rollout-catch: der Kandidat faellt
// weg, die Partie laeuft weiter. Schwelle ueber PP_PROMPT_REPEAT_CAP.
// ═══════════════════════════════════════════════════════════════════
const PROMPT_REPEAT_CAP = (() => {
  const v = parseInt(process.env.PP_PROMPT_REPEAT_CAP || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 200;
})();

// ═══════════════════════════════════════════════════════════════════
// MEHRSCHRITT-ZYKLEN (v384) — die Luecke, durch die Barker gefallen ist
//
// Der Riegel oben vergleicht nur mit der UNMITTELBAR vorigen Frage. Er
// faengt damit einstufige Schleifen (v326, cloudy-slime) und war fuer
// die auch gebaut. Barkers Schleife ist ZWEISTUFIG:
//
//   cardGallery "Barker" → {Ska Harpyformer}   (Fortschritt? nein)
//   zonePick    "Barker" → null                (Fortschritt? nein)
//   ... und wieder von vorn
//
// Weil sich Typ und Antwort bei JEDER Umdrehung aendern, setzt der
// einstufige Zaehler jedes Mal zurueck — im Repro lief die Schleife
// ueber 256 Umdrehungen, ohne dass er ansprach. Deshalb zusaetzlich
// eine Periodenerkennung ueber einen Ringpuffer der letzten Frage-
// Antwort-Paare: bilden die letzten 2p Eintraege zwei identische
// Haelften, wiederholt sich ein Muster der Laenge p.
//
// Bewusst ab p = 2 (p = 1 deckt der Riegel oben schon ab, sonst gaebe
// es zwei Meldungen fuer denselben Fall). Obergrenze 8 — laengere
// Zyklen sind denkbar, aber der Puffer soll klein und die Pruefung
// billig bleiben (max. 8 Vergleiche je Prompt).
//
// FALSCHALARM-BETRACHTUNG: eine gesunde Mehrfach-Platzierung (Layn's
// Rally u.ae.) fragt zwar wiederholt dieselbe Zonen-Frage, bekommt
// aber ANDERE Antworten und eine schrumpfende Optionszahl — die
// Signatur aendert sich, das Muster bricht, der Zaehler faellt auf 0.
// Ausgeloest wird erst nach PROMPT_REPEAT_CAP aufeinanderfolgenden
// Prompts INNERHALB eines unveraenderten Musters — bei p = 2 also nach
// rund 100 Umdrehungen. Jeder Rollout leert den Puffer zusaetzlich
// (siehe resetPromptCycle), Muster koennen sich also nicht ueber
// Simulationsgrenzen hinweg addieren.
// ═══════════════════════════════════════════════════════════════════
const PROMPT_CYCLE_MAX_PERIOD = 8;

function noteCycle(engine, art, titel, optionen, kurz, playerIdx) {
  const fp = `${art}|${titel}|${optionen}=>${kurz}`;
  const ring = engine._promptRing || (engine._promptRing = []);
  ring.push(fp);
  if (ring.length > PROMPT_CYCLE_MAX_PERIOD * 2) ring.shift();

  let periode = 0;
  for (let p = 2; p <= PROMPT_CYCLE_MAX_PERIOD; p++) {
    if (ring.length < p * 2) break;
    let gleich = true;
    for (let i = 0; i < p; i++) {
      if (ring[ring.length - 1 - i] !== ring[ring.length - 1 - i - p]) { gleich = false; break; }
    }
    if (gleich) { periode = p; break; }
  }

  if (!periode) {
    engine._promptCyclePeriod = 0;
    engine._promptCycleCount = 0;
    return;
  }
  if (engine._promptCyclePeriod === periode) {
    engine._promptCycleCount = (engine._promptCycleCount || 1) + 1;
  } else {
    engine._promptCyclePeriod = periode;
    engine._promptCycleCount = 1;
  }
  if (engine._promptCycleCount <= PROMPT_REPEAT_CAP) return;

  const muster = ring.slice(ring.length - periode).map(x => x.slice(0, 120));
  const ort = {
    grund: 'prompt-cycle',
    periode,
    anzahl: engine._promptCycleCount,
    prompt: String(titel || '(ohne Titel)'),
    typ: String(art || '?'),
    spieler: playerIdx,
    zug: engine.gs?.turn ?? null,
    phase: engine.gs?.currentPhase ?? null,
    muster,
  };
  if (!engine._promptCycleGemeldet) {
    engine._promptCycleGemeldet = true;
    console.error('[Prompt-Zyklus] ' + JSON.stringify(ort));
    console.error('  → Ein Muster aus ' + periode + ' Fragen wiederholt sich '
      + ort.anzahl + ' Mal unveraendert. Der Aufrufer macht keinen Fortschritt.');
    for (const m of muster) console.error('     • ' + m);
    try { engine._crashTrailSink?.(ort); } catch { /* Forensik darf nie stoeren */ }
  }
  // Wie beim einstufigen Riegel NICHT zuruecksetzen — wer den Wurf
  // verschluckt, bekommt ihn beim naechsten Prompt erneut.
  const err = new Error(`Prompt-Zyklus: Muster aus ${periode} Fragen um "${ort.prompt}" `
    + `${ort.anzahl}x unveraendert wiederholt, Zug ${ort.zug} Phase ${ort.phase}`);
  err._promptRepeat = true;
  err._promptCycle = true;
  throw err;
}

// Ringpuffer an JEDER Simulationsgrenze leeren. Ohne das koennten sich
// Muster ueber viele Rollouts hinweg addieren: eine Karte mit genau zwei
// Prompts, die in 200 Rollouts identisch beantwortet wird, saehe fuer den
// Detektor aus wie eine Schleife — ist aber voellig gesund. Ein echter
// Haenger dreht IMMER innerhalb EINER Ausfuehrung; er braucht die
// Rollout-Grenze nicht.
function resetPromptCycle(engine) {
  if (!engine) return;
  if (engine._promptRing) engine._promptRing.length = 0;
  engine._promptCyclePeriod = 0;
  engine._promptCycleCount = 0;
  engine._promptRepeatSig = null;
  engine._promptRepeatAnswer = null;
  engine._promptRepeatCount = 0;
}

function noteRepeat(engine, art, titel, optionen, antwort, playerIdx) {
  const sig = `${art}|${titel}|${optionen}`;
  let kurz;
  try { kurz = JSON.stringify(antwort); } catch { kurz = String(antwort); }
  if (kurz && kurz.length > 200) kurz = kurz.slice(0, 200);
  // Mehrschritt-Zyklen zuerst pruefen: der einstufige Zweig unten kann
  // werfen, und dann fehlte dem Ringpuffer ein Eintrag.
  noteCycle(engine, art, titel, optionen, kurz, playerIdx);
  if (engine._promptRepeatSig === sig && engine._promptRepeatAnswer === kurz) {
    engine._promptRepeatCount = (engine._promptRepeatCount || 1) + 1;
    if (engine._promptRepeatCount > PROMPT_REPEAT_CAP) {
      const ort = {
        grund: 'prompt-repeat',
        anzahl: engine._promptRepeatCount,
        prompt: String(titel || '(ohne Titel)'),
        typ: String(art || '?'),
        spieler: playerIdx,
        zug: engine.gs?.turn ?? null,
        phase: engine.gs?.currentPhase ?? null,
      };
      if (!engine._promptRepeatGemeldet) {
        engine._promptRepeatGemeldet = true;
        console.error('[Prompt-Schleife] ' + JSON.stringify(ort));
        console.error('  → Dieselbe Frage bekam ' + ort.anzahl
          + ' Mal hintereinander dieselbe Antwort. Der Aufrufer macht keinen Fortschritt.');
        try { engine._crashTrailSink?.(ort); } catch { /* Forensik darf nie stoeren */ }
      }
      // NICHT zuruecksetzen: solange dieselbe Frage dieselbe Antwort
      // bekommt, wirft jeder weitere Aufruf. Sonst bekaeme ein Aufrufer,
      // der den Wurf verschluckt, alle PROMPT_REPEAT_CAP Runden erneut
      // freie Fahrt — die Schleife waere wieder unbegrenzt.
      const err = new Error(`Prompt-Schleife: "${ort.prompt}" (typ=${ort.typ}) `
        + `${ort.anzahl}x identisch beantwortet, Zug ${ort.zug} Phase ${ort.phase}`);
      err._promptRepeat = true;
      throw err;
    }
  } else {
    engine._promptRepeatSig = sig;
    engine._promptRepeatAnswer = kurz;
    engine._promptRepeatCount = 1;
  }
}

// ── STILLER AUSSTIEG STATT HUNDERTER WUERFE (v330) ─────────────────
// v321 laesst jeden Prompt nach `abort()` werfen. Das bricht zwar jede
// einzelne Schleife auf, stoppt aber nicht die KASKADE darueber: der
// Rollout faengt den Wurf, nimmt den naechsten Kandidaten, der fragt
// wieder — hunderte Zeilen je abgeraeumter Partie (Als Konsolenlog
// 11.8., Spiele 53/62/94).
//
// Deshalb steigen die CPU-Schleifen selbst aus, sobald `_aborted` steht.
// Der Wurf bleibt als Notbremse fuer alles, was diese Pruefung nicht
// passiert — er kommt dann aber hoechstens noch einmal vor.
function istAbgebrochen(engine) {
  if (!engine?._aborted) return false;
  if (!engine._abbruchGemeldet) {
    engine._abbruchGemeldet = true;
    console.log('[CPU] Partie abgebrochen — laufende Kaskade wird abgeraeumt.');
  }
  return true;
}

function throwIfAborted(engine, wo) {
  if (!engine._aborted) return;
  const err = new Error(`Partie abgebrochen — ${wo} nach abort() aufgerufen`);
  err._gameAborted = true;
  throw err;
}

// ── KUMULATIVE ZAEHLUNG (v322) ──────────────────────────────────────
// Der Deckel oben prueft EINEN Puffer. Der Heap-Snapshot zeigte aber
// 2,72 Mio. Datensaetze, OHNE dass der Deckel je ausloeste — dann
// verteilen sie sich auf viele kleine Puffer, die nach dem Rollout
// weggeworfen, aber von irgendetwas festgehalten werden. Diese Form
// kann ein Pro-Puffer-Deckel prinzipiell nicht sehen.
//
// Deshalb zusaetzlich zwei Zaehler je Engine, die NICHT zurueckgesetzt
// werden: `_mctsRecordTotal` (alle je gepushten Datensaetze) und
// `_mctsRecordMax` (laengster je erreichter Puffer). Alle
// PP_MCTS_RECORD_TICK Datensaetze geht ein Messpunkt an den
// Crash-Trail — der landet als `heapProbes` in der inflight-/crash-
// Datei, ganz ohne Konsole.
//
// LESART der beiden Zahlen im naechsten Absturz:
//   gesamt gross + max klein  → viele festgehaltene Kleinpuffer
//   gesamt gross + max gross  → ein durchlaufender Puffer (Deckel greift)
//   gesamt klein              → die Datensaetze sind NICHT der Heapfresser
const MCTS_RECORD_TICK = (() => {
  const v = parseInt(process.env.PP_MCTS_RECORD_TICK || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 250000;
})();

function mctsRecordTick(engine, promptTitel, promptTyp, playerIdx, bufLen) {
  const punkt = {
    grund: 'mcts-record-tick',
    gesamt: engine._mctsRecordTotal,
    max: engine._mctsRecordMax,
    prompt: String(promptTitel || '(ohne Titel)'),
    typ: String(promptTyp || '?'),
    spieler: playerIdx,
    puffer: bufLen,
    zug: engine.gs?.turn ?? null,
    phase: engine.gs?.currentPhase ?? null,
  };
  console.error('[MCTS-Aufzeichnung] ' + JSON.stringify(punkt));
  try { engine._crashTrailSink?.(punkt); } catch { /* Forensik darf nie stoeren */ }
}

function mctsRecordPush(engine, eintrag, promptTitel, promptTyp, playerIdx) {
  const buf = engine._mctsTargetRecord;
  if (!Array.isArray(buf)) return;
  if (engine._mctsRecordOverflowed) throw mctsRecordOverflowError(engine, promptTitel, promptTyp, playerIdx, buf.length);
  buf.push(eintrag);

  const gesamt = (engine._mctsRecordTotal = (engine._mctsRecordTotal || 0) + 1);
  if (buf.length > (engine._mctsRecordMax || 0)) engine._mctsRecordMax = buf.length;
  if (gesamt % MCTS_RECORD_TICK === 0) mctsRecordTick(engine, promptTitel, promptTyp, playerIdx, buf.length);

  if (buf.length <= MCTS_RECORD_CAP) return;
  engine._mctsRecordOverflowed = true;
  const anzahl = buf.length;
  buf.length = 0;                       // Speicher sofort wieder freigeben
  throw mctsRecordOverflowError(engine, promptTitel, promptTyp, playerIdx, anzahl);
}

function mctsRecordOverflowError(engine, promptTitel, promptTyp, playerIdx, anzahl) {
  const ort = {
    grund: 'mcts-record-overflow',
    anzahl,
    prompt: String(promptTitel || '(ohne Titel)'),
    typ: String(promptTyp || '?'),
    spieler: playerIdx,
    zug: engine.gs?.turn ?? null,
    phase: engine.gs?.currentPhase ?? null,
  };
  // Bewusst console.error und nicht cpuLog: cpuLog ist während eines
  // Rollouts stummgeschaltet, und genau dort passiert es.
  if (!engine._mctsRecordOverflowGemeldet) {
    engine._mctsRecordOverflowGemeldet = true;
    console.error('[MCTS-Aufzeichnung ÜBERGELAUFEN] ' + JSON.stringify(ort));
    console.error('  → Dieser Prompt wurde in EINEM Rollout ' + anzahl
      + ' Mal beantwortet. Das ist die Endlosschleife, die den Heap füllt.');
    try { engine._crashTrailSink?.(ort); } catch { /* Forensik darf nie stören */ }
  }
  const err = new Error(`MCTS-Aufzeichnung übergelaufen (${anzahl}) bei Prompt "${ort.prompt}" `
    + `(typ=${ort.typ}, Spieler ${playerIdx}, Zug ${ort.zug}, Phase ${ort.phase})`);
  err._mctsRecordOverflow = true;
  return err;
}


function mctsValidateTargetEntry(entry, validTargets) {
  if (!entry || entry.kind !== 'target') return false;
  if (!Array.isArray(entry.ids) || entry.ids.length === 0) return false;
  return entry.ids.every(id => validTargets.some(t => t.id === id));
}

function mctsValidateGenericEntry(entry, promptData) {
  if (!entry || typeof entry.kind !== 'string' || !entry.kind.startsWith('generic:')) return false;
  const type = entry.kind.slice('generic:'.length);
  if (type !== promptData.type) return false;
  const v = entry.value;
  if (!v) return false;
  if (type === 'zonePick') {
    const zones = promptData.zones || [];
    return zones.some(z => z.heroIdx === v.heroIdx && z.slotIdx === v.slotIdx);
  }
  if (type === 'cardGallery') {
    const cards = promptData.cards || [];
    return cards.some(c => c.name === v.cardName);
  }
  if (type === 'cardGalleryMulti') {
    if (!Array.isArray(v.selectedCards)) return false;
    const names = new Set((promptData.cards || []).map(c => c.name));
    return v.selectedCards.every(n => names.has(n));
  }
  if (type === 'playerPicker') {
    return v.playerIdx === 0 || v.playerIdx === 1;
  }
  if (type === 'optionPicker') {
    const options = promptData.options || [];
    return options.some(o => o.id === v.optionId);
  }
  if (type === 'confirm') {
    return v.confirmed === true;
  }
  return false;
}

// ── cardGalleryMulti exact-count plan (CPU sim/branch) ──────────────
// Some multi-pick prompts demand an EXACT count via `validCounts`
// (Timeless King Zi: validCounts:[3], maxBudget:6, costKey:'level').
// The old sim/branch logic only understood `selectCount`/single-pick,
// so it always returned 1 card → Zi's own 3-card validation rejected
// it in EVERY rollout → MCTS scored Zi as a wasted Action and the CPU
// never used it. These helpers compute the required count + a
// guaranteed-valid combo so Zi's rollout actually resolves.
function cpuGalleryMultiPlan(promptData) {
  const cards = promptData.cards || [];
  const n = cards.length;
  const vc = Array.isArray(promptData.validCounts) && promptData.validCounts.length
    ? promptData.validCounts.slice().sort((a, b) => a - b)
    : null;
  let need;
  if (vc) need = vc.find(c => c <= n);
  else if (promptData.selectCount) need = promptData.selectCount;
  else if (promptData.minSelect) need = promptData.minSelect;
  else need = 1;
  return {
    need: need || 0,
    hardCount: !!vc,                 // validCounts ⇒ EXACT count required
    costKey: promptData.costKey || null,
    maxBudget: (typeof promptData.maxBudget === 'number') ? promptData.maxBudget : null,
  };
}

// Cheapest `need`-card name combo (minimises Σcost). Returns null when
// no combo fits the budget — mirrors Timeless King Zi's `hasLegalTrio`
// (the N smallest costs ARE the minimum achievable sum, so if that
// exceeds the cap, no legal selection exists).
function cpuCheapestGalleryCombo(cards, need, costKey, maxBudget) {
  if (!need || need <= 0 || (cards || []).length < need) return null;
  const order = cards
    .map(c => ({ name: c.name, cost: costKey ? (Number(c[costKey]) || 0) : 0 }))
    .sort((a, b) => a.cost - b.cost);
  let sum = 0;
  const out = [];
  for (let k = 0; k < need; k++) { sum += order[k].cost; out.push(order[k].name); }
  if (maxBudget != null && sum > maxBudget) return null;
  return out;
}

// Budget-bewusster Score-Greedy für exakte Mehrfach-Picks (Zi-Menüs):
// nimmt Karten in Score-Reihenfolge, aber nur wenn nach dem Pick die
// verbleibenden Slots noch mit den BILLIGSTEN Restkarten ins Budget
// passen (Machbarkeits-Check) — im Gegensatz zum naiven Top-Loop kann
// das Ergebnis nie unter `need` Karten fallen, solange eine legale
// Auswahl existiert. scoreOf: Karte → Zahl (höher = lieber anbieten).
function cpuBestGalleryCombo(cards, need, costKey, maxBudget, scoreOf) {
  if (!need || need <= 0 || (cards || []).length < need) return null;
  const pool = cards.map(c => ({
    name: c.name,
    cost: costKey ? (Number(c[costKey]) || 0) : 0,
    score: scoreOf ? scoreOf(c) : 0,
  }));
  const byScore = pool.slice().sort((a, b) => b.score - a.score);
  const picked = [];
  let spent = 0;
  const feasible = (candidate) => {
    if (maxBudget == null) return true;
    const remainNeed = need - picked.length - 1;
    if (remainNeed <= 0) return spent + candidate.cost <= maxBudget;
    const rest = pool
      .filter(x => x !== candidate && !picked.includes(x))
      .map(x => x.cost)
      .sort((a, b) => a - b)
      .slice(0, remainNeed);
    if (rest.length < remainNeed) return false;
    return spent + candidate.cost + rest.reduce((s, v) => s + v, 0) <= maxBudget;
  };
  for (const cand of byScore) {
    if (picked.length >= need) break;
    if (picked.includes(cand)) continue;
    if (!feasible(cand)) continue;
    picked.push(cand);
    spent += cand.cost;
  }
  if (picked.length < need) return null;
  return picked.map(x => x.name);
}

// Adversariale Menü-Komposition (Als Maximin-Auftrag): Der GEGNER wählt
// aus unserem 3er-Menü — bei Zi das, was WIR casten (er nimmt unser
// Minimum), bei Magic Lamp das, was ER bekommt (uns bleibt Summe−Max).
// Score-Summen-Greedy baut daher genau die Falle "Bombe + 2 Filler"
// (Iter1-Daten: Gathering Storm 0/65 durchgelassen, Chain Lightning
// 0/266 — der Köder feuert nie). Exakte Enumeration aller 3er-Kombos
// unterm Budget mit quellenspezifischer Zielfunktion; scoreOf liefert
// den SITUATIVEN Wert (_galleryScore = learnedCardValue inkl. Cluster/
// Standing/Timing + menuOfferRule inkl. Situations-Deltas). Nur für
// kleine Galerien (C(22,3)=1540) — größere fallen auf Greedy zurück.
function cpuAdversarialMenuCombo(cards, need, costKey, maxBudget, scoreOf, objective) {
  if (!cards || need !== 3 || cards.length < 3 || cards.length > 22) return null;
  const pool = cards.map(c => ({
    n: c.name,
    cost: costKey ? (Number(c[costKey]) || 0) : 0,
    s: scoreOf ? scoreOf(c) : 0,
  }));
  let best = null, bestV = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const a = pool[i], b = pool[j], c = pool[k];
        if (maxBudget != null && a.cost + b.cost + c.cost > maxBudget) continue;
        const v = objective === 'sumMinusMax'
          ? a.s + b.s + c.s - Math.max(a.s, b.s, c.s)
          : Math.min(a.s, b.s, c.s);
        if (v > bestV) { bestV = v; best = [a.n, b.n, c.n]; }
      }
    }
  }
  return best;
}

const MENU_OBJECTIVES = {
  'Timeless King Zi': 'min',          // Gegner wählt, was wir casten → Minimum zählt
  'Magic Lamp': 'sumMinusMax',        // Gegner nimmt den Pick → uns bleiben die 2 schwächsten
  // Crestina bewusst NICHT: Pool = ganzes Spiel, Galerie zu groß (Als Scope-Entscheid)
};

// Enumerate alternative values for a branchable generic prompt. Returns an
// array of { value, label } entries usable as plan values.
function mctsEnumerateGenericAlternatives(promptData, cpuIdxForBias) {
  const type = promptData.type;
  if (type === 'zonePick') {
    let zones = (promptData.zones || []).slice();
    // Card-driven placement preference — same `cpuMeta.preferOpponent
    // SupportZone` flag the heuristic path consults. Sorts opp-side
    // zones first so MCTS explores them before own-side alternatives
    // (the rollout cap often truncates after the top N branches).
    try {
      const sourceName = promptData.title;
      const script = sourceName ? loadCardEffect(sourceName) : null;
      if (script?.cpuMeta?.preferOpponentSupportZone && cpuIdxForBias != null) {
        const oppIdx = cpuIdxForBias === 0 ? 1 : 0;
        zones.sort((a, b) => {
          const aOpp = a.ownerIdx === oppIdx ? 0 : 1;
          const bOpp = b.ownerIdx === oppIdx ? 0 : 1;
          return aOpp - bOpp;
        });
      }
    } catch { /* ignore — keep original ordering */ }
    return zones.map(z => ({
      value: { heroIdx: z.heroIdx, slotIdx: z.slotIdx },
      label: `zone=h${z.heroIdx}s${z.slotIdx}`,
    }));
  }
  if (type === 'cardGallery') {
    // ── Tutor-Pick-Lernanschluss (Als Auftrag: "wann welche Karte
    // suchen" ist fundamental) ── Die Galerie-Sortierung entscheidet,
    // WELCHE Varianten der MCTS überhaupt als Arme probiert (Cap 6).
    // Ohne gelernten Anteil fielen Profil-Lieblinge (Divine Gift of
    // Fire!) aus den Top-6, bevor der MCTS sie je bewerten konnte.
    // Der gelernte Kartenwert wird auf den Heuristik-Score addiert;
    // ohne Profil: +0 → Verhalten unverändert.
    try {
      const _pi = engine._cpuPlayerIdx;
      const _tpr = deckProfile.profileFor ? null : null; // (Regeln unten direkt via learnedTutorPick)
      const _src = promptData.title || promptData.cardName || 'unknown';
      const _rules = (function () {
        try { return require('./_deck-profile').__getProfile?.(engine, _pi)?.tutorPickRules || null; } catch { return null; }
      })();
      for (const c of cards) {
        if (c && c.name && c._galleryScore !== undefined) {
          // Revive-Karten ohne (sinnvolles) Revive-Ziel bekommen KEINE
          // Learned-Additive: der Heuristik-Score ist bereits hart
          // gedeckelt (estimateHandCardValueFor), und ein kontextfrei
          // gelernter cardValue bzw. eine tutorPickRule würde Golden
          // Ankh bei vollem Team wieder in die Top-6-Arme heben.
          const revSit = reviveCardSituation(engine, _pi, c.name);
          if (revSit && (!revSit.hasDead || !revSit.useful)) continue;
          const lv = deckProfile.learnedCardValue(engine, _pi, c.name, 0, 1) || 0;
          c._galleryScore += lv * 0.5;
          // Gelernte Quelle→Karte-Regel (tutorPickRules) direkt dazu.
          if (_rules) c._galleryScore += (_rules[`${_src}→${c.name}`] || 0);
          // Tutor-Cap gilt auch NACH den Learned-Additiven — sonst
          // hebelt genau dieser (ungegatete) Pfad den min(12)-Deckel
          // wieder aus ("Magnetic Potion sucht Magnetic Glove").
          const tSc = loadCardEffect(c.name);
          if (tSc?.blockedByHandLock && typeof tSc.resolve === 'function') {
            c._galleryScore = Math.min(c._galleryScore, 12);
          }
        }
      }
    } catch { /* defensiv */ }
    // Sort by `_galleryScore` (stamped by `pickBestGalleryCard` during
    // the heuristic recon) descending so the first MCTS_MAX_ALTS_PER_BRANCH
    // variations actually explore the highest-impact cards. Without this,
    // a 30-card-deck gallery only tested the alphabetically-first 6 and
    // routinely missed the right pick (the user-reported "Magnetic Glove
    // tutored another Magnetic Glove" case is exactly this — ascension
    // pieces and high-impact spells got dropped because they sit later
    // alphabetically). Cards without a stamped score fall to the back.
    const cards = (promptData.cards || []).slice();
    cards.sort((a, b) => (b._galleryScore || -Infinity) - (a._galleryScore || -Infinity));
    return cards.map(c => ({
      value: { cardName: c.name, source: c.source },
      label: `card=${c.name}`,
    }));
  }
  if (type === 'cardGalleryMulti') {
    const cards = (promptData.cards || []).slice();
    cards.sort((a, b) => (b._galleryScore || -Infinity) - (a._galleryScore || -Infinity));
    const plan = cpuGalleryMultiPlan(promptData);
    if (plan.hardCount && plan.need > 1) {
      // EXACT-count prompt (Timeless King Zi: 3 Spells, Σlevel ≤ 6).
      // Single-card branches are ALWAYS invalid here, so emit valid
      // `need`-card combos instead: the cheapest combo guarantees ≥1
      // resolvable branch (so Zi's rollout succeeds and MCTS can value
      // it); a highest-score combo within budget gives MCTS a "best
      // trio" alternative to compare.
      const branches = [];
      const cheap = cpuCheapestGalleryCombo(cards, plan.need, plan.costKey, plan.maxBudget);
      if (cheap) {
        branches.push({ value: { selectedCards: cheap.slice() }, label: `cheapest${plan.need}` });
      }
      // Budget-bewusster Score-Greedy statt des naiven Top-Loops (der
      // konnte unter `need` bleiben und einen invaliden Branch liefern).
      // Bei Menü-Quellen zusätzlich die adversariale Zielfunktion als
      // eigener Branch — MCTS vergleicht dann "Summen-bestes Trio" vs
      // "Maximin-Trio" per Rollout.
      const menuObj = promptData.menuSource ? MENU_OBJECTIVES[promptData.menuSource] : null;
      const adv3 = menuObj
        ? cpuAdversarialMenuCombo(cards, plan.need, plan.costKey, plan.maxBudget,
            c => (c._galleryScore || 0), menuObj)
        : null;
      if (adv3) branches.push({ value: { selectedCards: adv3.slice() }, label: `maximin${plan.need}` });
      const top = cpuBestGalleryCombo(cards, plan.need, plan.costKey, plan.maxBudget,
        c => (c._galleryScore || 0)) || [];
      if (top.length === plan.need) {
        const tKey = top.slice().sort().join('|');
        const cKey = cheap ? cheap.slice().sort().join('|') : '';
        if (tKey !== cKey) {
          branches.push({ value: { selectedCards: top.slice() }, label: `top${plan.need}` });
        }
      }
      return branches;
    }
    // Soft / single-count multi-pick — single-pick variations only
    // (combinatorial explosion otherwise). Same gallery-score ordering.
    return cards.map(c => ({
      value: { selectedCards: [c.name] },
      label: `pickOne=${c.name}`,
    }));
  }
  if (type === 'playerPicker') {
    return [
      { value: { playerIdx: 0 }, label: 'player=0' },
      { value: { playerIdx: 1 }, label: 'player=1' },
    ];
  }
  if (type === 'optionPicker') {
    return (promptData.options || []).map(opt => ({
      value: { optionId: opt.id },
      label: `opt=${opt.id}`,
    }));
  }
  if (type === 'confirm') {
    // Only cancellable confirms are interesting to branch on — non-
    // cancellable ones have no alternative. The heuristic default
    // declines (returns null) for cancellable, so the "confirm"
    // alternative is the only thing to test.
    if (!promptData.cancellable) return [];
    return [{ value: { confirmed: true }, label: 'confirm' }];
  }
  return [];
}

function installCpuBrain(engine) {
  if (engine._cpuBrainInstalled) return;
  engine._cpuBrainInstalled = true;

  // Expose the brain's evaluator so per-card `cpuResponse` hooks can
  // run "simulate-and-score" decisions (mill targets, hand-vs-discard
  // choices, etc.) using the same eval the gate uses. Same `evaluateState(engine, cpuIdx)`
  // signature; safe to call any time during the CPU's turn but
  // guarded internally against MCTS re-entry by the caller (see
  // Magenta / Soul Shard Ren).
  engine._cpuEvaluateState = (cpuIdx) => evaluateState(engine, cpuIdx);
  // Situativer Handwert für Karten-Skripte (Zi-Gegner-Pick u.ä.):
  // voller learnedCardValue-Stack (Cluster/Standing/Timing/Caster-
  // Deltas des bewerteten Spielers) statt Level-Proxys.
  engine._cpuEstimateHandValue = (pi, cardName) => estimateHandCardValueFor(engine, pi, cardName);

  const origTarget = engine._getCpuTargetResponse.bind(engine);
  const origGeneric = engine._getCpuGenericResponse.bind(engine);

  // ── Dynamic-tracking wrappers ────────────────────────────────────────
  // Captures per-hero / per-creature contribution data on the live game
  // state so the dynamic valuation has real history to reason about.
  // Wraps the engine's `runHooks` so we can observe `afterDamage`,
  // `afterCreatureDamageBatch`, `afterSpellResolved`, `onCardEnterZone`,
  // and `onTurnEnd` without each card having to opt in. The hooks fire
  // both during live play AND inside MCTS rollouts; rollout state lives
  // on the cloned snapshot, so the live hero objects never see rollout
  // mutations.
  // ── Ability-Aktivierungs-Zähler (für abilityDependencyScore) ──
  // Nicht-Spell-School-Abilities (Leadership, Alchemy, Necromancy …)
  // tragen ihren Wert über AKTIVIERUNGEN statt als Cast-Voraussetzung.
  // Die laufen als 'ability_activated' durch engine.log — hier je
  // Spieler mitgezählt (rollout-sicher), damit der Removal-Score beide
  // Dimensionen sieht.
  {
    const origLog = engine.log.bind(engine);
    engine.log = function (type, data) {
      try {
        if (type === 'ability_activated' && !engine._inMctsSim && data?.card && data?.player) {
          const pIdx = engine.gs?.players?.findIndex(p => p?.username === data.player);
          if (pIdx === 0 || pIdx === 1) {
            if (!engine._schoolUse) engine._schoolUse = [Object.create(null), Object.create(null)];
            const u = engine._schoolUse[pIdx][data.card] || (engine._schoolUse[pIdx][data.card] = { casts: 0, levels: [], activations: 0 });
            u.activations = (u.activations || 0) + 1;
          }
        }
      } catch { /* Beobachter darf nie stören */ }
      return origLog(type, data);
    };
  }

  const origRunHooks = engine.runHooks.bind(engine);
  engine.runHooks = async function (hookName, hookCtx = {}) {
    const result = await origRunHooks(hookName, hookCtx);
    // ── Verhaltens-Fingerprint beider Spieler (Cluster-Feature) ──
    // Zählt bis Zug 8: Attack-Casts, Spell-Casts, Kreaturen-Summons je
    // Spieler. Lebt auf der ENGINE (nicht in gs), damit Rollout-
    // Snapshots ihn nicht anfassen; der _inMctsSim-Guard hält
    // Simulations-Lärm draußen. Konsumiert von _deck-profile.js:
    // learnedCardValue schaltet ab Zug 5 cluster-konditionale
    // Karten-Deltas dazu (clusterOfFingerprint ist die geteilte,
    // trainer-identische Zuordnung).
    try {
      if (!engine._inMctsSim && (engine.gs?.turn || 99) <= 8) {
        // Achsen identisch zum Recorder: dmg (Helden-Schadenseinheiten
        // à 150), cre (Kreaturen-Summons), spl (Spell-/Attack-Casts).
        if (!engine._behaviorFp) engine._behaviorFp = [{ dmg: 0, cre: 0, spl: 0, _raw: 0 }, { dmg: 0, cre: 0, spl: 0, _raw: 0 }];
        if (hookName === 'afterSpellResolved' && typeof hookCtx.casterIdx === 'number' && engine._behaviorFp[hookCtx.casterIdx]) {
          const nm = hookCtx.spellName || hookCtx.spellCardData?.name;
          const cdb = nm ? engine._getCardDB()[nm] : null;
          if (cdb && (cdb.cardType === 'Attack' || cdb.cardType === 'Spell')) engine._behaviorFp[hookCtx.casterIdx].spl++;
          // Schul-Nutzung (fürs Ability-Removal-Scoring): Welche Schulen
          // hat dieser Spieler nachweislich benutzt, auf welchem Level?
          // Läuft OHNE Zug-Limit — je mehr Historie, desto besser.
          if (cdb) {
            if (!engine._schoolUse) engine._schoolUse = [Object.create(null), Object.create(null)];
            for (const sk of [cdb.spellSchool1, cdb.spellSchool2]) {
              if (!sk) continue;
              const u = engine._schoolUse[hookCtx.casterIdx][sk] || (engine._schoolUse[hookCtx.casterIdx][sk] = { casts: 0, levels: [] });
              u.casts++;
              if (u.levels.length < 30) u.levels.push(cdb.level || 0);
            }
          }
        } else if (hookName === 'afterDamage' && typeof hookCtx.amount === 'number' && hookCtx.amount > 0) {
          const side = engine._findHeroOwner?.(hookCtx.target);
          if (side === 0 || side === 1) {
            const attacker = engine._behaviorFp[side === 0 ? 1 : 0];
            attacker._raw += hookCtx.amount;
            attacker.dmg = Math.round(attacker._raw / 150);
          }
        } else if (hookName === 'onCardEnterZone') {
          const card = hookCtx.enteringCard;
          if (card && hookCtx.toZone === 'support') {
            const own = card.controller ?? card.owner;
            const cd = engine._getCardDB()[card.name];
            if (typeof own === 'number' && engine._behaviorFp[own] && cd?.cardType === 'Creature') engine._behaviorFp[own].cre++;
          }
        }
      }
    } catch { /* Beobachter darf nie stören */ }
    try {
      if (hookName === 'afterDamage') {
        // Damage to a single hero target. `hookCtx.amount` is the actual
        // dealt amount as recorded by the engine before firing the hook.
        const target = hookCtx.target;
        const targetSide = target ? engine._findHeroOwner?.(target) : -1;
        recordDamageDealt(engine, hookCtx.source, hookCtx.amount, targetSide);
        // Kill attribution — afterDamage fires post-HP-application, so
        // target.hp <= 0 here means this damage event killed the hero.
        // Credit the source so later target valuation knows who's been
        // dropping enemy heroes.
        if (target && target.hp !== undefined && target.hp <= 0
            && targetSide != null && targetSide >= 0) {
          recordKill(engine, hookCtx.source, 'hero', targetSide);
        }
      } else if (hookName === 'afterCreatureDamageBatch') {
        // Each entry already carries the actual amount (`actualAmount`)
        // after all clamps & shields. Fall back to `amount` if the
        // batch handler didn't expose it explicitly — keeps tracking
        // alive even if the engine's internal field name evolves.
        const entries = hookCtx.entries || [];
        for (const e of entries) {
          const dealt = e.actualAmount != null ? e.actualAmount : (e.amount || 0);
          if (!(dealt > 0)) continue;
          recordDamageDealt(engine, e.source, dealt, e.inst?.owner);
          // Creature kill attribution. `currentHp` already reflects
          // the post-damage value at this hook fire.
          if (e.inst && (e.inst.counters?.currentHp ?? 1) <= 0) {
            recordKill(engine, e.source, 'creature', e.inst.owner);
          }
        }
      } else if (hookName === 'afterSpellResolved') {
        recordSpellCast(engine, hookCtx.casterIdx, hookCtx.heroIdx, hookCtx.spellCardData);
      } else if (hookName === 'onCardEnterZone') {
        const enteringCard = hookCtx.enteringCard;
        const toZone = hookCtx.toZone;
        if (enteringCard && toZone === 'support') {
          const cd = engine._getCardDB()[enteringCard.name];
          if (cd && cd.cardType === 'Creature') {
            const owner = enteringCard.controller ?? enteringCard.owner;
            const hi = enteringCard.heroIdx;
            const hero = (owner != null && hi != null && hi >= 0)
              ? engine.gs?.players?.[owner]?.heroes?.[hi]
              : null;
            if (hero?.name) {
              const stats = ensureHeroCpuStats(hero);
              stats.lastSummonTurn = engine.gs.turn;
              stats.summonsThisGame++;
            }
            const cstats = ensureCreatureCpuStats(enteringCard);
            if (cstats) cstats.summonedOnTurn = engine.gs.turn;
          }
        }
      } else if (hookName === 'onTurnEnd') {
        rolloverPerTurnStats(engine);
        // Snapshot the active player's end-of-turn gold for the
        // hoarder/spender history used by mctsOpponentGoldEconomy.
        recordEndOfTurnGold(engine);
      } else if (hookName === 'onDraw') {
        // Active player got a card. We don't have per-hero attribution
        // for most draws, so credit the active player's heroes weighted
        // by their declared `supportYield.drawsPerTurn` if any. When no
        // hero declares a draw yield, skip — the draw came from a
        // generic source (Resource Phase, Trade, …) we can't attribute.
        const ap = engine.gs?.activePlayer;
        const ps = ap != null ? engine.gs.players[ap] : null;
        if (ps) attributeAggregateValue(engine, ap, 'draw', 1);
      } else if (hookName === 'onResourceGain') {
        // Gold gained — attribute proportionally to gold-yielding heroes.
        const ap = hookCtx.playerIdx;
        const amount = hookCtx.amount;
        if (ap != null && amount > 0) {
          attributeAggregateValue(engine, ap, 'gold', amount);
        }
      }
    } catch (err) {
      // Tracking must never break the hook chain — it's a side observer.
      cpuLog(`  [tracking] ${hookName} hook observer threw:`, err.message);
    }
    return result;
  };

  // Slow down CPU prompt responses so the human can see each decision. We
  // override promptGeneric / promptEffectTarget to replace the engine's
  // built-in 50ms delay (too fast to follow) with a human-pacing delay.
  // Puzzle mode is unaffected — puzzles don't install the CPU brain.
  const origPromptGeneric = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async function (playerIdx, promptData) {
    // ── Gerrymander redirect (BEFORE the CPU/human dispatch below) ──
    // The original engine.promptGeneric also runs this redirect, but
    // the wrapper short-circuits CPU prompts and would otherwise skip
    // it. Re-running here ensures the redirect fires regardless of
    // who's prompted. The `_gerryRewritten` guard inside the helper
    // prevents double-application if origPromptGeneric is reached.
    const _gerryRedirect = engine._tryGerrymanderRedirect(playerIdx, promptData);
    if (_gerryRedirect) {
      playerIdx = _gerryRedirect.targetPi;
      promptData = _gerryRedirect.rewrittenData;
    }

    throwIfAborted(engine, 'promptGeneric');

    // ── MCTS scripted plan (peek, consume only on match) ──
    let scriptedValue = null;
    if (engine.isCpuPlayer(playerIdx) && Array.isArray(engine._mctsTargetPlan) && engine._mctsTargetPlan.length > 0) {
      const head = engine._mctsTargetPlan[0];
      if (head === null) {
        engine._mctsTargetPlan.shift(); // null placeholder → consume, use heuristic
      } else if (mctsValidateGenericEntry(head, promptData)) {
        engine._mctsTargetPlan.shift();
        scriptedValue = head.value;
        // Tutor-Pick-Erhebung: Der LIVE-konsumierte Plan einer
        // Galerie-Wahl ist die vollzogene Such-Entscheidung. Quelle =
        // Prompt-Titel (Tutor-Karte/-Ability), Pick = gewählte Karte.
        try {
          if (!engine._inMctsSim && scriptedValue?.selectedCards?.length) {
            if (!engine._tutorPickLog) engine._tutorPickLog = [];
            engine._tutorPickLog.push({
              pi: playerIdx,
              src: promptData.title || promptData.cardName || 'unknown',
              picked: scriptedValue.selectedCards.slice(0, 3),
              t: engine.gs?.turn || 0,
            });
          }
        } catch { /* nie stören */ }
      }
      // else: leave in queue for a future matching prompt.
    }

    // ── HARTE KARTEN-VORFAHRT SCHLÄGT DEN PLAN (30.7.) ────────────────
    // Gemessen: Barkers Spielstart-Pick landete nur in 46 von 160
    // Spielen auf Primordium — obwohl die Karte mit
    // `gameStartPickPriority: 100` eine harte Vorfahrt exportiert und
    // `gameStartPickDecision` sie in ALLEN drei Zweigen nach vorn
    // sortiert. Der Grund liegt eine Ebene höher: `cardGallery` steht in
    // MCTS_BRANCHABLE_GENERIC_TYPES, die Recon plant den Prompt also ein
    // und die Zeile unten nimmt `scriptedValue`, bevor die Karten-
    // Antwort überhaupt aufgerufen wird. In rund 71% der Spiele hat also
    // die Suche entschieden statt der Vorfahrt.
    // Als Ruling dazu steht wörtlich im Code von gameStartPickDecision:
    // "Gilt bewusst AUCH im Training — Al will den Pick fest."
    // Wirkung in den Daten: Spiele MIT dem Pick 52.2% WR und 3.53
    // Trigger/Zug, Spiele OHNE 44.7% und 2.43.
    // Der Plan-Eintrag wurde oben bereits konsumiert und bleibt es auch
    // — sonst verschöbe sich die Zuordnung aller folgenden Einträge.
    // Nur der WERT wird verworfen, damit die Karten-Antwort greift.
    if (scriptedValue != null && promptHasPinnedAnswer(promptData)) {
      scriptedValue = null;
      swapDiag(engine, 'startpick:vorfahrt-vor-plan');
    }

    // During MCTS rollouts (fast mode), BOTH players' prompts auto-respond
    // — otherwise non-CPU reaction-window prompts would hang forever since
    // there's no socket to resolve them. Cancellable → decline, mandatory
    // → CPU brain's default pick.
    if (engine._fastMode && !engine.isCpuPlayer(playerIdx)) {
      if (promptData.cancellable) return null;
      return engine._getCpuGenericResponse(promptData, playerIdx);
    }
    if (engine.isCpuPlayer(playerIdx)) {
      if (!engine._fastMode) await engine._delay(CPU_PROMPT_DELAY);
      const picked = scriptedValue != null ? scriptedValue : engine._getCpuGenericResponse(promptData, playerIdx);
      // ── MCTS recon recording ──
      // Only record branchable types — confirms/forceDiscards don't enumerate
      // alternatives we care to explore.
      noteRepeat(engine, promptData.type, promptData.title,
        (promptData.cards || promptData.options || []).length, picked, playerIdx);
      if (Array.isArray(engine._mctsTargetRecord) && MCTS_BRANCHABLE_GENERIC_TYPES.includes(promptData.type)
        && !promptHasPinnedAnswer(promptData)) {
        mctsRecordPush(engine, {
          kind: `generic:${promptData.type}`,
          title: promptData.title,
          cancellable: !!promptData.cancellable,
          alternatives: mctsEnumerateGenericAlternatives(promptData, playerIdx),
          picked,
          wasScripted: scriptedValue != null,
        }, promptData.title, promptData.type, playerIdx);
      }
      return picked;
    }
    return origPromptGeneric(playerIdx, promptData);
  };

  const origPromptEffectTarget = engine.promptEffectTarget.bind(engine);
  engine.promptEffectTarget = async function (playerIdx, validTargets, config = {}) {
    if (!validTargets || validTargets.length === 0) return [];
    throwIfAborted(engine, 'promptEffectTarget');

    // ── MCTS scripted plan (peek, consume only on match) ──
    let scriptedPick = null;
    if (engine.isCpuPlayer(playerIdx) && Array.isArray(engine._mctsTargetPlan) && engine._mctsTargetPlan.length > 0) {
      const head = engine._mctsTargetPlan[0];
      if (head === null) {
        engine._mctsTargetPlan.shift();
      } else if (mctsValidateTargetEntry(head, validTargets)) {
        engine._mctsTargetPlan.shift();
        scriptedPick = head.ids;
      }
      // else: leave in queue.
    }

    // ── Fast-mode non-CPU: auto-respond (prevents hangs in rollouts) ──
    // Default model of opp behaviour: passive — cancellable prompts get
    // declined (Anti-Magic, Shield of Life, Cure-style reactions stay
    // dormant), mandatory prompts get the CPU picker's default. That
    // model UNDERPRICES reactive damage triggers like Skeleton Demon
    // ("when opp draws, you MAY deal 50 × cards"): the rollout wrongly
    // saw the prompt as cancellable, declined, and the CPU concluded
    // drawing was free even when it would have actually eaten 250+
    // damage from a 5-card mulligan. A rational opp ALWAYS takes a
    // free damage opportunity, so route damage-target prompts
    // (`config.baseDamage > 0`) through the CPU picker even when
    // cancellable — it picks the highest-value enemy target and the
    // damage lands during the rollout, so the evaluator sees the real
    // post-state. Generic principle, not a Demon-specific heuristic:
    // any future "opp may deal damage on your draw / search / play"
    // card opts in just by passing `baseDamage` through its prompt.
    if (engine._fastMode && !engine.isCpuPlayer(playerIdx)) {
      const isDamageOpportunity = (config.baseDamage || 0) > 0;
      if (config.cancellable && !isDamageOpportunity) return [];
      return engine._getCpuTargetResponse(validTargets, config, playerIdx);
    }

    if (engine.isCpuPlayer(playerIdx)) {
      if (!engine._fastMode) await engine._delay(CPU_PROMPT_DELAY);
      // Pass playerIdx through so the picker uses the CARD CONTROLLER's
      // own/enemy sides — critical for reactive cards fired on the
      // opponent's turn (Shield of Life, Cure, etc.).
      // ── Card cpuResponse contract beats the MCTS plan ──
      // A card module's explicit cpuResponse is a deterministic domain
      // contract (Shield of Life never heals the enemy, Fridge's move
      // priority list). The MCTS variation enumeration explores ALL
      // targets, so the scripted plan can carry a noisy rollout's pick
      // (observed live: Shield of Life healing an ENEMY hero because a
      // rollout's eval briefly preferred it). For prompts whose title
      // resolves to a module with cpuResponse, ask the card FIRST and
      // let its answer override the plan; the matched plan head was
      // already consumed above, so the queue stays in sync.
      let cardPick;
      if (config.title) {
        const _sc = loadCardEffect(config.source || config.title);
        if (_sc?.cpuResponse) {
          const _r = _sc.cpuResponse(engine, 'effectTarget', { validTargets, config, playerIdx });
          if (_r !== undefined) cardPick = _r;
        }
      }
      // ── Gelernter Target-Prior-Kanal ──
      // Greift NUR, wenn weder Karten-Contract (cpuResponse) noch
      // MCTS-Plan entschieden haben — er ersetzt also ausschließlich
      // den deterministischen Default-Picker. Im Profil gelernte
      // Zielklassen-Gewichte wählen bei klarem Signal; im Training
      // sorgt gelegentliche Exploration für Daten auf allen Armen.
      let priorPick = null;
      if (cardPick === undefined && !scriptedPick && !engine._inMctsSim) {
        const srcName = config.previewCardName || config.source || config.title;
        priorPick = deckProfile.targetPickDecision(engine, playerIdx, srcName, validTargets, config);
        // ── HEIL-SICHERUNG UEBER DEM PRIOR (13.8.) ───────────────────
        // Der gelernte Prior sitzt VOR `cpuPickTargets` — und damit vor
        // beiden bestehenden Schutzmechanismen: dem `isHealing`-Gate am
        // Kopf des Pickers und dem Heil-Zweig, der ausdruecklich nie
        // einen Gegner ohne healReversed heilt. Konkreter Fall aus dem
        // Heal-Burn-Profil: "Divine Gift of The Light" hat
        // `side:opp +6.4` und `pos:2 +8.6` gelernt, `side:own −12.3`.
        // Ein Gegnerheld auf Position 2 gewinnt damit mit 15.0 gegen
        // −12.3 — die CPU haette dem Gegner 100 HP GESCHENKT, und zwar
        // an einem Prompt, den sie nicht abbrechen kann. Gelernt wurde
        // das aus Spielen, in denen die Ziele Overheal Shock trugen
        // (siehe das `healrev`-Tag, das genau dafuer eingefuehrt wurde).
        // Der Prior darf also gern Gegner waehlen — aber nur solche,
        // bei denen Heilung zu Schaden wird. Sonst faellt die Wahl auf
        // den Picker durch, der die Reihenfolge bereits kennt.
        if (priorPick && config.isHealing) {
          const verschenkt = priorPick.some(id => {
            const t = validTargets.find(x => x && x.id === id);
            if (!t || t.owner === playerIdx) return false;
            return !heroHealReversed(engine, t);
          });
          if (verschenkt) priorPick = null;
        }
      }
      const picked = (cardPick !== undefined) ? cardPick
        : (scriptedPick || priorPick || engine._getCpuTargetResponse(validTargets, config, playerIdx));
      // Log-Stempel für den Recorder (record.targetPicks): die FINALE
      // Wahl, egal welcher Pfad sie traf — klassifiziert als Tags.
      try {
        if (!engine._inMctsSim && Array.isArray(picked) && picked.length === 1) {
          const tgt = validTargets.find(t => t && t.id === picked[0]);
          const srcName = config.previewCardName || config.source || config.title || null;
          if (tgt && srcName) {
            if (!engine._targetLog) engine._targetLog = [];
            engine._targetLog.push({ pi: playerIdx, c: srcName, t: engine.gs?.turn || 0,
              tags: deckProfile.classifyTargetTags(engine, tgt, validTargets, playerIdx, config) });
          }
        }
      } catch { /* Log darf nie stören */ }
      // ── MCTS recon recording ──
      // For damage Attacks/Spells with both own and enemy targets,
      // strip own-side targets out of the recorded `validTargets` so
      // MCTS variation enumeration never explores "Icebolt own Hero"
      // alternatives. The heuristic at `cpuPickTargets` already drops
      // them; without filtering the record too, MCTS would still try
      // each own target and a noisy rollout could pick one that
      // freezes our own Hero for the post-CC `immune` payoff — far
      // less valuable than a Spell + 120 HP.
      noteRepeat(engine, 'target', config.title, (validTargets || []).length, picked, playerIdx);
      if (Array.isArray(engine._mctsTargetRecord)) {
        const maxSel = Math.max(1, config.maxTotal || config.maxSelect || 1);
        const recCardName = config.title;
        const recCd = recCardName ? engine._getCardDB()[recCardName] : null;
        const recIsDamage = recCd?.cardType === 'Attack'
          || (recCd?.cardType === 'Spell' && inferDamage(config) > 0);
        const recHasOwn = validTargets.some(t => t.owner === playerIdx);
        const recHasEnemy = validTargets.some(t => t.owner != null && t.owner !== playerIdx);
        const recDropOwn = recIsDamage && recHasOwn && recHasEnemy
          && !config.allowOwnSide
          && !config.selfDamage
          && !config.appliesStatus
          && !looksLikeHeal(recCd, config)
          && !looksLikeBuff(recCd, config);
        const recordedTargets = (recDropOwn
          ? validTargets.filter(t => t.owner !== playerIdx)
          : validTargets).map(t => ({
            id: t.id,
            owner: t.owner,
            heroIdx: t.heroIdx,
            name: t.name,
            hp: t.hp,
            type: t.type,
          }));
        mctsRecordPush(engine, {
          kind: 'target',
          title: config.title,
          cancellable: !!config.cancellable,
          maxSelect: maxSel,
          validTargets: recordedTargets,
          picked,
          wasScripted: !!scriptedPick,
        }, config.title, 'target', playerIdx);
      }
      return picked;
    }
    return origPromptEffectTarget(playerIdx, validTargets, config);
  };

  // promptGeneric wrapper — same playerIdx passthrough guarantee. Without
  // this, reactive/generic prompts fired during the opponent's turn hit
  // the engine default's _cpuPlayerIdx fallback and flip own/enemy logic
  // (same class of bug as promptEffectTarget above).

  engine._getCpuTargetResponse = function (validTargets, config = {}, promptedPlayerIdx) {
    try {
      const picked = cpuPickTargets(engine, validTargets, config, promptedPlayerIdx);
      if (picked !== undefined) return picked;
    } catch (err) {
      console.error('[CPU brain] target picker threw:', err.message);
    }
    return origTarget(validTargets, config, promptedPlayerIdx);
  };

  engine._getCpuGenericResponse = function (promptData, promptedPlayerIdx) {
    try {
      const res = cpuGenericChoice(engine, promptData, promptedPlayerIdx);
      if (res !== undefined) return res;
    } catch (err) {
      console.error('[CPU brain] generic chooser threw:', err.message, err.stack);
    }
    return origGeneric(promptData, promptedPlayerIdx);
  };
}

// ─── Target picker ─────────────────────────────────────────────────────
// Returns an array of selected target IDs (same contract as
// _getCpuTargetResponse) or undefined to let the default handler run.

/**
 * Registry-basierter Schadens-Multiplikator eines Ziels (Als Audit-
 * Auftrag "die CPU soll ALLE Block-/Reduktions-Effekte erkennen"):
 * liest BUFF_EFFECTS aus _hooks.js — die zentrale Wahrheit, die auch
 * die Engine-Pipeline speist. Produkt aller damageMultiplier-Buffs
 * (Held: hero.buffs; Kreatur: inst.counters.buffs). 0 = Schaden
 * sinnlos (medusa_petrified, damage_immune, künftige 0er-Einträge
 * automatisch); 0.5 = Cloudy; 2 = disrupted.
 */
function targetDamageMultiplier(engine, target) {
  try {
    const { BUFF_EFFECTS } = require('./_hooks');
    const buffs = target?.type === 'hero'
      ? engine.gs?.players?.[target.owner]?.heroes?.[target.heroIdx]?.buffs
      : target?.cardInstance?.counters?.buffs;
    if (!buffs) return 1;
    let m = 1;
    for (const k of Object.keys(buffs)) {
      const def = BUFF_EFFECTS[k];
      if (def && typeof def.damageMultiplier === 'number') m *= def.damageMultiplier;
    }
    return m;
  } catch { return 1; }
}

function cpuPickTargets(engine, validTargets, config, promptedPlayerIdx) {
  // ── Damage-Gate (Als Registry-Audit) ──
  // Dealt der Prompt Schaden (gleiche Inferenz wie die Engine:
  // explizites dealsDamage:false schaltet ab, sonst baseDamage>0 oder
  // konkreter damageType), fliegen Ziele mit Multiplikator 0 raus —
  // plus der konditionale Anti-Magic-Block (magic_immune-Buff gegen
  // Spell-Schaden, wenn Buff-Level ≥ Kartenlevel und die Karte nicht
  // bypassesMagicImmune exportiert). Reduktionen (Cloudy 0.5) und
  // Verstärkungen (disrupted 2) filtern NICHT — sie fließen als
  // dmgred-/dmgamp-Tags in den Lernkanal (classifyTargetTags).
  {
    const dealsDamage = config?.dealsDamage === false ? false : (
      (typeof config?.baseDamage === 'number' && config.baseDamage > 0)
      || (!!config?.damageType && config.damageType !== 'status' && config.damageType !== 'none'));
    if (dealsDamage && Array.isArray(validTargets) && validTargets.length > 1) {
      const isSpell = /spell/.test(String(config?.damageType || ''));
      let cardLevel = null, bypassesAM = false;
      if (isSpell && config?.title) {
        try {
          cardLevel = engine._getCardDB()?.[config.title]?.level ?? null;
          bypassesAM = !!require('./_loader').loadCardEffect(config.title)?.bypassesMagicImmune;
        } catch { }
      }
      const blocked = (t) => {
        if (targetDamageMultiplier(engine, t) === 0) return true;
        if (isSpell && !bypassesAM) {
          const buffs = t?.type === 'hero'
            ? engine.gs?.players?.[t.owner]?.heroes?.[t.heroIdx]?.buffs
            : t?.cardInstance?.counters?.buffs;
          const am = buffs?.magic_immune;
          if (am && (cardLevel == null || (am.level ?? 99) >= cardLevel)) return true;
        }
        return false;
      };
      const keep = validTargets.filter(t => !blocked(t));
      if (keep.length > 0) validTargets = keep;
    }
  }
  // ── Heil-Gate (Als Heal-Burn-Befund) ──
  // Das Training lernte "gegnerische Helden heilen → gewinnen", weil
  // die Ziele im Testing Overheal Shock trugen — der Kontext fehlte im
  // Signal, und live heilte die CPU Gegner OHNE Umwandlung hoch.
  // Korrektheits-Regel vor jedem Lernen/Scoren: Bei als Heilung
  // markierten Prompts (config.isHealing) sind Gegner-Ziele nur
  // zulässig, wenn ihre Heilung zu Schaden wird (statuses.healReversed
  // — der Status, den Overheal Shock setzt). Leert das Gate die Liste
  // nicht komplett, arbeitet alles Weitere (gelernte targetPriors,
  // Default-Picker) auf der gefilterten Menge; sonst Altverhalten als
  // Softlock-Schutz.
  // ── Status-Gate (Als Demo-Befund, status_blocked reason
  // 'negative_status_immune'): wendet der Prompt einen negativen
  // Status an (config.appliesStatus), sind Ziele sinnlos, deren
  // Immunität ihn blocken würde — Helden-Buff negative_status_immune,
  // Kreaturen-Buff gleichen Namens, und der 'immune'-Status für die
  // CC-Familie (frozen/stunned/negated/bound, wie CC_STATUSES der
  // Engine). Filter nur, wenn danach Ziele übrig bleiben.
  {
    const st = typeof config?.appliesStatus === 'string' ? config.appliesStatus : null;
    // Nur REINE Status-Abfragen steuern. Traegt der Prompt auch Schaden,
    // ist der Status blosses Beiwerk — dann darf das Gate nicht filtern,
    // sonst meidet die CPU ein lohnendes Schadensziel, nur weil der
    // angehaengte Status dort nicht haftet. Fuer genau diese Karten
    // liefert `classifyTargetTags` stattdessen das Tag `stat:sticks` /
    // `stat:blocked` in den Lernkanal.
    const _statusPromptDealsDamage = (typeof config?.baseDamage === 'number' && config.baseDamage > 0)
      || (!!config?.damageType && config.damageType !== 'status' && config.damageType !== 'none');
    if (st && !_statusPromptDealsDamage
        && Array.isArray(validTargets) && validTargets.length > 1) {
      // ── KEIN Urteil mehr an dieser Stelle (Als Vorgabe 9.8.) ───────
      // Welche Seite und welches Ziel das beste ist, entscheidet der
      // LERNKANAL. Zwei harte Regeln standen hier und sind beide raus:
      //
      //  • „nie die eigene Seite" (v307) — absolut formuliert falsch, es
      //    gibt Helden, bei denen ein eigenes Ziel die beste Wahl ist
      //    (Fiona-Muster).
      //  • „nur Ziele, an denen der Status haftet" — das erzwang bei
      //    einer lebenden Johanna auf der Gegnerseite sogar das
      //    GEGENTEIL: die geschuetzten Gegner fielen raus, uebrig blieben
      //    die eigenen Helden, und die CPU traf sich selbst.
      //
      // Beide Fragen sind jetzt im Tag-Raum ausdrueckbar (`side:own` /
      // `side:opp` und `stat:sticks` / `stat:blocked`) und werden ueber
      // `targetPriors` je Karte gelernt. Ein Gate, das hier filtert,
      // wuerde genau die Arme leer halten, die der Trainer braucht.
      void st;
    }
  }
  if (config?.isHealing && Array.isArray(validTargets) && validTargets.length > 1) {
    const cpuIdx = promptedPlayerIdx != null ? promptedPlayerIdx : engine._cpuPlayerIdx;
    const healReversed = (t) => t?.type === 'hero'
      && !!engine.gs?.players?.[t.owner]?.heroes?.[t.heroIdx]?.statuses?.healReversed;
    const filtered = validTargets.filter(t => t && (t.owner === cpuIdx || healReversed(t)));
    if (filtered.length > 0) validTargets = filtered;
  }
  if (!Array.isArray(validTargets) || validTargets.length === 0) {
    return config.cancellable ? [] : undefined;
  }
  // `promptedPlayerIdx` is the CARD CONTROLLER — the player whose prompt
  // this is. Fall back to _cpuPlayerIdx only if the caller didn't pass it
  // (older call sites). Using the active player for reactive cards fired
  // on the OPPONENT's turn (Shield of Life, Cure) flipped own/enemy and
  // caused the CPU to heal the enemy.
  const cpuIdx = promptedPlayerIdx != null ? promptedPlayerIdx : engine._cpuPlayerIdx;
  // `config.source` gewinnt vor dem Titel — Titel sind für Menschen
  // geschrieben und oft keine reinen Kartennamen (z.B. "<Held> — Charme
  // Lv1"). Der Schwester-Pfad weiter oben macht das längst so; hier
  // fehlte es, wodurch Karten-Contracts an dieser Stelle unerreichbar
  // blieben.
  const cardName = config.source || config.title;
  const cd = cardName ? engine._getCardDB()[cardName] : null;

  // Per-card target override: cards can export `cpuResponse(engine, 'target',
  // { validTargets, config })` and return an array of selected IDs. Falls
  // through to the generic targeting brain if the card returns undefined.
  if (cardName) {
    const script = loadCardEffect(cardName);
    if (script?.cpuResponse) {
      try {
        const override = script.cpuResponse(engine, 'target', { validTargets, config });
        if (override !== undefined) return override;
      } catch (err) {
        console.error(`[CPU] ${cardName} cpuResponse (target) threw:`, err.message);
      }
    }
  }

  // Classify by whom the targets affect. If everything points to the opponent,
  // it's an enemy effect; all-own → ally effect; mixed → fall back to enemy
  // logic (most damage cards let you pick enemy despite "any" side flag).
  const ownTargets = validTargets.filter(t => t.owner === cpuIdx);
  const enemyTargets = validTargets.filter(t => t.owner != null && t.owner !== cpuIdx);

  // Attack cards AND damage Spells (Icebolt, Eraser Beam, …) that reach
  // this picker weren't classified as a buff/heal/self-status above —
  // they deal damage. Targeting own units normally just self-damages
  // for no gain that outweighs the cost; the only "benefit" the rollout
  // can discover is the post-CC `immune` status the engine grants at
  // end-of-turn (Frozen own hero → CC-immune next opp turn), which is
  // explicitly devalued in `evaluateState` so paths like self-Icebolt
  // score correctly negative.
  //
  // EXCEPTION — pileFuel-welcomed own targets: when the controller has
  // any active card whose `cpuMeta.pileFuel.discardFilter` matches an
  // own-side target, killing that own unit moves it to the discard
  // pile where the same pileFuel converts it into ongoing eval value
  // (Soul Shards in own discard for re-summon, future archetypes with
  // the same shape). The simulate-and-score branch below evaluates
  // every candidate (own + enemy) on the same objective scale via
  // `evaluateState` delta and lets MCTS arithmetic decide whether
  // self-targeting is genuinely better than hitting enemy. NOT a
  // heuristic — the picker pays the per-candidate eval cost only
  // when own targets are actually pileFuel-favoured, and the eval
  // numbers come from the cards' own `cpuMeta` declarations.
  const damageAmount = inferDamage(config);
  // Damage-shape detection: Attack, damage Spell (Icebolt, …), and
  // damage-shape Artifact (Book of Doom — declares baseDamage in its
  // targetingConfig). The simulate-and-score branch below works for
  // any of these so long as `damageAmount > 0`.
  const isDamageCard = cd?.cardType === 'Attack'
    || (cd?.cardType === 'Spell' && damageAmount > 0)
    || (cd?.cardType === 'Artifact' && damageAmount > 0);
  const allowSelfDestruct = isDamageCard
    && damageAmount > 0
    && ownTargets.length > 0
    && !engine._inMctsSim
    && ownTargetsAreSelfDestructWelcome(engine, ownTargets, cpuIdx);

  if (allowSelfDestruct) {
    // Simulate-and-score across the full pool. Drop fully immune
    // candidates first (sim would just return ~no delta for them),
    // then rank by eval delta, take top N for multi-select.
    const pool = [...ownTargets, ...enemyTargets].filter(t => !isTargetImmune(engine, t));
    if (pool.length > 0) {
      const scored = [];
      for (const t of pool) {
        const s = simulateDamageTargetScore(engine, t, damageAmount, cpuIdx);
        if (s == null) continue;
        scored.push({ t, s });
      }
      if (scored.length > 0) {
        scored.sort((a, b) => b.s - a.s);
        const cap = Math.min(scored.length, Math.max(1, config.maxTotal || config.maxSelect || 1));
        // Multi-select (Book of Doom): greedy top-N by eval delta.
        // Single-select: pick best with a small ε-tiebreak so the CPU
        // isn't perfectly predictable when scores tie.
        if (cap > 1) return scored.slice(0, cap).map(x => x.t.id);
        const top = scored[0].s;
        const eps = Math.max(1, Math.abs(top) * 0.03);
        const tied = scored.filter(x => x.s >= top - eps).map(x => x.t);
        return [randomOf(tied).id];
      }
    }
    // Pool was empty (everything immune) — fall through to enemy/ally
    // logic below; the enemy branch will return [] for cancellable
    // prompts, decline-friendly.
  } else if (isDamageCard && ownTargets.length > 0 && enemyTargets.length > 0
             && !config.allowOwnSide) {
    // Default: strip own targets so the existing enemy-only picker
    // doesn't accidentally rationalise self-damage. `allowOwnSide`
    // lets rare damage-shaped cards (e.g. recoil-as-cost) opt out.
    ownTargets.length = 0;
  }

  // Self-damage prompts (Fire Bolts recoil, any future "pay HP" cost):
  // the prompt asks the caster to pick an OWN target that will take
  // real damage. The generic ally-fallback below would shuffle and
  // pick a random hero — a coin flip that has been observed killing
  // the CPU's last living hero and ending the game on its own turn.
  // Route to the harm-minimizing picker instead.
  const isSelfDamage = config.selfDamage === true
    || /recoil/i.test(config.title || '')
    || /recoil/i.test(config.description || '');
  if (isSelfDamage && ownTargets.length > 0) {
    const picked = pickSelfDamageTarget(engine, ownTargets, config);
    if (picked) return [picked.id];
  }

  // Self-status cards (Sickly Cheese self-poison, Zsos'Ssar Decay-cost
  // self-poison, …). The card's `targetingConfig.appliesStatus` names the
  // status it lands, and the picker routes to status-beneficiary scoring
  // so Fiona / Stellan get preferentially hit (and Layn is avoided).
  // Runs BEFORE the heal/buff heuristics because those would otherwise
  // win ties by shuffling randomly and wash out the signal.
  const appliesStatus = typeof config.appliesStatus === 'string' ? config.appliesStatus : null;
  // ── NUR fuer echte SELBST-Status-Karten (9.8.) ────────────────────
  // Dieser Zweig war fuer Karten gedacht, deren Status per Design auf
  // die eigene Seite geht (Sickly Cheese, Zsos'Ssar-Kosten). Er feuerte
  // aber bei JEDER Abfrage mit `appliesStatus`, sobald eigene Ziele
  // dabei waren — also auch bei Icy Slime & Co., die beide Seiten
  // treffen koennen. Ergebnis: die CPU fror ihren eigenen Helden ein.
  //
  // Abgrenzung ohne Urteil: greift nur, wenn die Abfrage GAR KEINE
  // gegnerischen Ziele hat oder ausdruecklich `side: 'own'` verlangt.
  // Steht beides offen, entscheidet die normale Absichts-Logik und
  // darueber der Lernkanal (`side:own` / `side:opp`, `stat:*`) — genau
  // dort gehoert die Fiona-Frage hin.
  const _selfStatusPrompt = enemyTargets.length === 0 || config.side === 'own';
  if (appliesStatus && _selfStatusPrompt && ownTargets.length > 0) {
    const picked = pickSelfStatusTarget(engine, ownTargets, appliesStatus);
    if (picked) return [picked.id];
  }

  // Determine intent. Healing/buff cards typically have side='own' or only
  // own-targets valid. Damage cards have baseDamage or damageType, or target
  // the opponent side.
  const isHealCard = looksLikeHeal(cd, config);
  const isBuffCard = !isHealCard && looksLikeBuff(cd, config);

  // Multi-select bound: promptMultiTarget passes `maxTotal`, simpler callers
  // pass `maxSelect`. Clamp to ≥1 and to total target count so we don't try
  // to return more IDs than exist.
  const totalEligible = ownTargets.length + enemyTargets.length;
  const maxSelect = Math.min(totalEligible, Math.max(1, config.maxTotal || config.maxSelect || 1));

  if (isHealCard) {
    const picks = pickHealTargetsMulti(engine, ownTargets, enemyTargets, cardName, maxSelect);
    if (picks.length) return picks.map(p => p.id);
    // No sensible heal target (no injured own things, no Overheal-Shocked
    // enemy). DO NOT fall through to enemy-damage targeting — that would
    // heal an enemy hero for free. Decline the cancellable prompt so the
    // heal stays in hand for a better moment.
    if (config.cancellable !== false) return [];
    // Forced heal with no great target — heal the highest-HP own hero as a
    // no-op fallback. Never heal an enemy unless Overheal-Shocked.
    const fallback = ownTargets.find(t => t.type === 'hero') || ownTargets[0];
    return fallback ? [fallback.id] : [];
  }

  if (isBuffCard) {
    const picks = pickBuffTargetsMulti(engine, ownTargets, cardName, maxSelect);
    if (picks.length) return picks.map(p => p.id);
  }

  // Enemy-side damage targeting (or ambiguous — default to enemy side).
  if (enemyTargets.length > 0) {
    const damage = inferDamage(config);
    const picks = pickEnemyTargets(engine, enemyTargets, damage, maxSelect);
    if (picks.length) return picks.map(p => p.id);
    // All enemy targets are immune. If the prompt is cancellable, decline
    // to avoid wasting the Attack/Spell/effect; the card stays in hand.
    // If it's not cancellable, fall through so we still pick SOMETHING.
    const allEnemyImmune = enemyTargets.every(t => isTargetImmune(engine, t));
    if (allEnemyImmune && config.cancellable !== false) return [];
  }

  // Ally-only fallthrough (e.g. cards whose side is 'own' but don't look
  // like heal/buff by our heuristic — revive, restore, etc.). Ascended /
  // Ascendable heroes come first so Resuscitation Potion / Elixir of
  // Immortality / any own-side revive-shaped effect prefers them over a
  // generic hero.
  if (ownTargets.length > 0) {
    const ascended = shuffle(ownTargets.filter(t => targetIsAscendedOrAscendableHero(engine, t)));
    const others = shuffle(ownTargets.filter(t => !targetIsAscendedOrAscendableHero(engine, t)));
    const ordered = [...ascended, ...others];
    return ordered.slice(0, maxSelect).map(t => t.id);
  }

  return undefined; // Let default pick from the full list
}

// Multi-select version of pickHealTarget. Picks up to maxSelect own targets
// that most need healing/cleansing, plus any enemy hero with Overheal Shock
// attached (free kill). Falls back to the single-pick ordering when only
// one target is allowed.
function pickHealTargetsMulti(engine, ownTargets, enemyTargets, cardName, maxSelect) {
  if (maxSelect <= 1) {
    const single = pickHealTarget(engine, ownTargets, enemyTargets, cardName, null);
    return single ? [single] : [];
  }
  const gs = engine.gs;
  const picks = [];
  const seen = new Set();
  const add = (t) => {
    if (!t || seen.has(t.id) || picks.length >= maxSelect) return;
    seen.add(t.id);
    picks.push(t);
  };
  // 1) heal-reversed enemy heroes (Overheal Shock etc.) — lethal heal,
  //    always valuable.
  for (const t of enemyTargets) {
    if (t.type === 'hero' && heroHealReversed(engine, t)) add(t);
  }
  // 2) Own targets — skip own-hero whose heal is reversed (would kill
  //    us) and skip `cpuMeta.preferDead` creatures (Cute Cat etc. —
  //    the CPU never protects creatures that want to die).
  const safeOwn = ownTargets.filter(t => {
    if (t.type === 'hero' && heroHealReversed(engine, t)) return false;
    if (targetIsPreferDead(engine, t)) return false;
    return true;
  });
  // 3) Fresh Lifeforce Howitzer priority
  for (const t of safeOwn) {
    if (targetHasFreshLifeforceHowitzer(engine, t)) add(t);
  }
  // 4) Injured heroes — Ascended / Ascendable heroes first, then by HP
  //    missing desc. See `pickHealTarget` for the rationale.
  const ownHeroesByMissing = safeOwn
    .filter(t => t.type === 'hero')
    .map(t => {
      const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
      return { t, missing: (h?.maxHp || 0) - (h?.hp || 0) };
    })
    .filter(x => x.missing > 0)
    .sort((a, b) => {
      const aAsc = targetIsAscendedOrAscendableHero(engine, a.t) ? 1 : 0;
      const bAsc = targetIsAscendedOrAscendableHero(engine, b.t) ? 1 : 0;
      if (aAsc !== bAsc) return bAsc - aAsc;
      return b.missing - a.missing;
    });
  for (const { t } of ownHeroesByMissing) add(t);
  // 5) Own creatures by lowest HP
  const ownCreatures = safeOwn
    .filter(t => t.type === 'creature' || t.type === 'equip')
    .map(t => {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      return { t, hp: creatureCurrentHp(engine, inst, t) ?? Infinity };
    })
    .sort((a, b) => a.hp - b.hp);
  for (const { t } of ownCreatures) add(t);
  return picks;
}

// Multi-select version of pickBuffTarget. Prefers heroes without the buff
// already applied; falls back to heroes with it, then creatures. Ascended
// / Ascendable heroes float to the front of each hero bucket.
function pickBuffTargetsMulti(engine, ownTargets, cardName, maxSelect) {
  if (maxSelect <= 1) {
    const single = pickBuffTarget(engine, ownTargets, cardName);
    return single ? [single] : [];
  }
  // Drop `cpuMeta.preferDead` creatures (Cute Cat etc.) — the CPU
  // never buffs creatures that want to die. Heroes don't carry the
  // flag, so the hero buckets below are untouched.
  const filteredOwn = ownTargets.filter(t => !targetIsPreferDead(engine, t));
  const heroes = filteredOwn.filter(t => t.type === 'hero');
  const creatures = filteredOwn.filter(t => t.type !== 'hero');
  const ascFirst = (a, b) => {
    const aAsc = targetIsAscendedOrAscendableHero(engine, a) ? 1 : 0;
    const bAsc = targetIsAscendedOrAscendableHero(engine, b) ? 1 : 0;
    return bAsc - aAsc;
  };
  const heroesWithout = shuffle(heroes.filter(t => !targetHasBuff(engine, t, cardName))).sort(ascFirst);
  const heroesWith = shuffle(heroes.filter(t => targetHasBuff(engine, t, cardName))).sort(ascFirst);
  const creatureShuffled = shuffle(creatures);
  const ordered = [...heroesWithout, ...heroesWith, ...creatureShuffled];
  return ordered.slice(0, maxSelect);
}

// ─── Generic choice picker ─────────────────────────────────────────────

// Tutor-/Galerie-Pick-Erhebung: Jede LIVE vollzogene Galerie-Wahl
// (Tutor-Suche, Revive-Galerie, ...) wird mit Quelle+Pick geloggt —
// Grundlage der Tutor-Pick-Regeln im Trainer ("wann welche Karte
// suchen"). Sim-Antworten werden nicht gezählt.
function _logGalleryPick(engine, promptData, who, names) {
  try {
    if (engine._inMctsSim || !names || !names.length) return;
    if (!engine._tutorPickLog) engine._tutorPickLog = [];
    engine._tutorPickLog.push({
      pi: who,
      src: promptData.title || promptData.cardName || 'unknown',
      picked: names.slice(0, 3),
      t: engine.gs?.turn || 0,
    });
  } catch { /* nie stören */ }
}

function cpuGenericChoice(engine, promptData, promptedPlayerIdx) {
  const type = promptData.type;
  // Use the CARD CONTROLLER's pi (not the active player) so reactive
  // prompts fired during the opponent's turn answer from their OWN side.
  const cpuIdx = promptedPlayerIdx != null ? promptedPlayerIdx : engine._cpuPlayerIdx;

  // ── Gerrymander redirect handling ──
  // When `_gerryRewritten` is set, the prompt was redirected from opp
  // to us (the Gerrymander owner). We're picking FOR opp — invert the
  // intent. The card's per-card `cpuGerrymanderResponse` (looked up by
  // the ORIGINAL title before the Gerrymander prefix was added) names
  // the option that's worst for opp; if missing, fall back to safe
  // defaults below.
  if (promptData._gerryRewritten) {
    const origTitle = promptData._gerryOriginalTitle || '';
    const script = origTitle ? loadCardEffect(origTitle) : null;
    if (script?.cpuGerrymanderResponse) {
      try {
        const override = script.cpuGerrymanderResponse(engine, cpuIdx, promptData);
        if (override !== undefined) return override;
      } catch (err) {
        console.error(`[CPU] ${origTitle} cpuGerrymanderResponse threw:`, err.message);
      }
    }
    // Confirm-cancellable default: decline. Most "may" prompts give
    // the prompted player a beneficial option; declining hurts them.
    if (type === 'confirm' && promptData.cancellable) return null;
    // optionPicker default: pick the first option. Safer than picking
    // the last (which the standard heuristic does — usually "all-in").
    if (type === 'optionPicker') {
      const options = promptData.options || [];
      if (options.length > 0) return { optionId: options[0].id };
    }
    // Fall through to standard handling for other prompt types.
  }

  // Per-card override wins over the generic brain. Card authors export
  // `cpuResponse(engine, promptKind, promptData)` to customize how the CPU
  // responds to prompts their card raises (Barker hero-ability, etc.).
  const cardName = promptData._gerryOriginalTitle || promptData.title || promptData.source;
  if (cardName) {
    const script = loadCardEffect(cardName);
    if (script?.cpuResponse) {
      try {
        const override = script.cpuResponse(engine, 'generic', promptData);
        if (override !== undefined) {
          // ── ZWEITER PFAD derselben Rückgabeform-Falle (Audit 30.7.) ──
          // Die zentrale Normalisierung weiter unten wird hier
          // ÜBERSPRUNGEN: ein karteneigenes cpuResponse geht direkt
          // zurück an den Aufrufer. Karten, die auf ihr eigenes
          // "you may"-Confirm mit blankem `true` antworten, liefen
          // deshalb weiter ins Leere — im Audit blieb genau eine übrig
          // (Soul Shard Shut, `return true` für den eigenen Confirm).
          // An der Wurzel normalisiert statt auf der Karte, damit auch
          // künftige cpuResponse-Implementierungen nicht in dieselbe
          // Falle laufen: `{confirmed:true}` erfüllt beide
          // Konsumenten-Formen, `null`/`false` bleiben Ablehnung.
          if (promptData.type === 'confirm') return normalizeConfirm(override);
          return override;
        }
      } catch (err) {
        console.error(`[CPU] ${cardName} cpuResponse threw:`, err.message);
      }
    }
  }

  // ── KOSTEN-CONFIRMS SIND KEINE OPT-INS (31.7.) ────────────────────
  // Zwei nachfolgende Zweige bejahen automatisch: der Reaktions-Zweig
  // über cpuReactionDecisions "fire reactions ASAP", und das
  // Proaktiv-Cast-Gate über "wir haben uns für die Karte schon
  // entschieden". Beide sind für Prompts der Form "darfst du diesen
  // Vorteil mitnehmen?" gebaut. Ein Prompt, dessen JA eine RESSOURCE
  // AUSGIBT (Aktion, Gold, Handkarte, HP), ist die Umkehrung davon —
  // dort ist das automatische Ja der teuerste mögliche Fehler.
  //
  // BELEGT an Greatmaw Remora (Repro gegen die echte Engine): der
  // Kartentext bietet die Beschwörung als GRATIS-Zusatzaktion an, der
  // Prompt fragt "willst du stattdessen eine deiner Aktionen dafür
  // ausgeben, um den Nicht-Greatmaw-Lock zu vermeiden?"
  // (confirmLabel '✋ Spend an Action', cancelLabel '🦈 Free'). Weil der
  // Prompt `showCard` trägt, fiel er in den Reaktions-Zweig →
  // cpuReactionDecision → true → {confirmed:true} → spendAction →
  // consumeRealActionFor → heroesActedThisTurn. Die CPU verbrannte bei
  // JEDEM Remora die einzige Aktion des Zuges für eine Beschwörung, die
  // sie ohnehin gratis bekam. Und selbst wenn dieser Zweig nicht
  // gegriffen hätte, hätte das Proaktiv-Cast-Gate darunter dasselbe
  // getan (Prompt-Titel === Name der gerade resolvenden Karte).
  //
  // Karten deklarieren das über `cpuMeta.confirmCostsResource`: `true`
  // für "jeder Confirm dieser Karte kostet", oder ein Prädikat
  // (engine, pi, promptData) → boolean für Karten mit mehreren Prompts.
  // Die Antwort ist die konservative Ablehnung — dieselbe, die der
  // generische cancellable-Confirm-Default ganz unten gibt ("opting
  // into a follow-up without the CPU knowing how to execute it").
  // Wer wirklich zahlen will, exportiert `cpuResponse`; das wird oben
  // geprüft und gewinnt gegen diesen Zweig.
  if (type === 'confirm' && promptData.cancellable && cardName) {
    let costsResource = false;
    try {
      const c = loadCardEffect(cardName)?.cpuMeta?.confirmCostsResource;
      costsResource = (typeof c === 'function')
        ? c(engine, cpuIdx, promptData) === true
        : c === true;
    } catch { costsResource = false; }
    if (costsResource) {
      confirmDiag(engine, promptData, false);
      return null;
    }
  }

  // Reactions: prompt type='confirm' that surfaces a specific card via
  // `showCard` (the "this is THE card you're being asked to activate"
  // signal). Covers reaction confirmLabels beyond the original
  // "Activate" prefix — Cosmic Malfunction's "🌌 Negate!", Deepsea
  // Idol's "🌊 Negate!", Bamboo Staff's "🕸️ Redirect!", Bamboo
  // Shield's "🛡️ Defend!", etc. Any cancellable card-effect confirm
  // with `showCard` is a reaction opt-in; route through the smarter
  // decision-maker rather than the blanket-decline branch below.
  // ── statusSelect (Coffee/Tea/Beer-Familie) ──
  // Status-Auswahl-Galerie: Die CPU wählt ALLE angebotenen Status —
  // bei Heilung/Übertragung strikt korrekt (mehr entfernen ist besser).
  // Ohne diesen Zweig fiel der unbekannte cancellable Typ in den
  // generischen Decline → Coffees resolve abortete → der
  // Targeting-Resolver loopte über die Ziele bis zum Safety-Cap und
  // die Karte wurde NIE erfolgreich gespielt (0/700 trotz Kanal).
  if (type === 'statusSelect') {
    const sel = (promptData.statuses || []).map(s => (s && s.key !== undefined) ? s.key : s).filter(Boolean);
    return { selectedStatuses: sel };
  }
  if (type === 'confirm'
      && promptData.cancellable
      && (promptData.showCard
          || (promptData.confirmLabel && /activate/i.test(promptData.confirmLabel)))) {
    // ── Surprise-Fire-Lernkanal ──
    // Nur für echte Surprises (script.isSurprise) — Reactions aus der
    // Hand haben eine andere Ökonomie und bleiben bei der Heuristik.
    // Hierarchie: gelernte Regel > Trainings-Exploration > Heuristik
    // (cpuReactionDecision, bisher "fire ASAP"). Die finale
    // Entscheidung wird für den Recorder gestempelt.
    const rxName = promptData._gerryOriginalTitle || promptData.title;
    const rxScript = rxName ? loadCardEffect(rxName) : null;
    if (rxScript?.isSurprise) {
      const d = deckProfile.surpriseFireDecision(engine, cpuIdx, rxName);
      let fired;
      if (d === 'fire') fired = true;
      else if (d === 'hold') fired = false;
      else fired = cpuReactionDecision(engine, promptData) === true;
      try {
        if (!engine._inMctsSim) {
          if (!engine._surpriseLog) engine._surpriseLog = [];
          engine._surpriseLog.push({ pi: cpuIdx, c: rxName, t: engine.gs?.turn || 0, fired });
        }
      } catch { /* Log darf nie stören */ }
      return fired ? CONFIRM_YES : null;
    }

    // ── Reaktions-Fire-Lernkanal (Als Vorgabe) ──
    // Bisher entschied hier allein die Heuristik "fire ASAP". Jetzt darf
    // eine gelernte Regel ZURÜCKHALTEN — die Heuristik bleibt aber Veto,
    // weil sie Korrektheit kodiert (Juice ohne reinigbares Ziel, eigene
    // Chain). Gebucketed nach Schadenskontext, ersatzweise Zug-Phase.
    //
    // REVIEW-FIX (Deepsea-Batch 15.2% WR): Der Kanal gilt NUR für die
    // markierten Hand-Reaktionsfenster der Engine. Ohne dieses Gate
    // wanderten ALLE cardName-betitelten Confirms hindurch — auch die
    // Bounce-Platzierungs-Bestätigungen der Deepsea-Linie. Folge im
    // Training: ~40% der Platzierungen per 50/50-Exploration abgelehnt
    // (Mummy 44/90, Witch 13/27), daraus NEGATIVE Regeln gelernt, die
    // den Deck-Motor zur Laufzeit dauerhaft abwürgten (WR 17.6% in
    // Iter1 → 11.8% ab Iter2, als die Holds griffen). Alles ohne Marker
    // fällt jetzt auf die Heuristik zurück (Verhalten vor v24:
    // fire ASAP → Platzierungen werden bestätigt).
    if (promptData._handReactionWindow !== true) {
      // ── RÜCKGABEFORM (gemessen 30.7., End-to-End gegen die echte
      // Engine) ────────────────────────────────────────────────────────
      // `cpuReactionDecision` liefert den BLANKEN Boolean `true`. Das ist
      // die Form für "Plain reaction/trigger confirm: caller checks
      // `if (result)`". Der KANONISCHE "you may"-Weg der Karten ist aber
      // `ctx.promptConfirmEffect`, und der liest `result?.confirmed ===
      // true` — `true.confirmed` ist `undefined`, also FALSE. Das Gehirn
      // sagte ja, die Engine las nein: JEDER optionale On-Summon-Effekt
      // einer CPU-gespielten Karte wurde still abgelehnt. Belegt am
      // laufenden Spiel: Primordiums Grant, Witchs Tutor, Mummys Stun und
      // Bats feuerten NIE (`aaGrants=null`, keine Effekt-Logs), während
      // der Prompt `true` zurückgab. Erklärt die Trainingsdaten exakt —
      // 410 Primordium-Plays, aber `grantsExpired = 0` und praktisch
      // keine Grants: sie verfielen nicht, sie entstanden nie.
      // Der Kommentar am Plain-Confirm-Zweig weiter unten benennt die
      // Lösung bereits: "Returning `{ confirmed: true }` satisfies both."
      // Betrifft ALLE 43 Karten mit `promptConfirmEffect`, nicht nur die
      // Deepsea-Linie — deshalb hier zentral normalisiert statt je Karte.
      const _dec = cpuReactionDecision(engine, promptData);
      confirmDiag(engine, promptData, _dec === true || _dec?.confirmed === true);
      return normalizeConfirm(_dec);
    }
    const heur = cpuReactionDecision(engine, promptData) === true;
    if (!heur) return null;
    const t = engine.gs?.turn || 1;
    const rxBucket = engine._rxDamageCtx?.tag
      || (t <= 4 ? 'early' : t <= 9 ? 'mid' : 'late');
    const rxD = deckProfile.reactionFireDecision(engine, cpuIdx, rxName, rxBucket);
    const rxFired = rxD !== 'hold';
    try {
      if (!engine._inMctsSim) {
        if (!engine._reactionLog) engine._reactionLog = [];
        engine._reactionLog.push({ pi: cpuIdx, c: rxName, t, b: rxBucket, fired: rxFired });
      }
    } catch { /* Log darf nie stören */ }
    return rxFired ? CONFIRM_YES : null;
  }

  // ── Ability-attach prompts (Sacrifice to Divinity, Megu, Alex, …) ──
  // The card hands us an eligibleHeroIdxs allowlist + an ability cardName
  // and asks "which hero gets it?". Mirror the same per-card placement
  // biases the in-hand attachAbilities loop applies via each Ability's
  // `cpuMeta.cpuPlacementBias` — if a bias narrows the allowed heroes,
  // pick from the intersection.
  if (type === 'abilityAttachTarget') {
    const eligible = Array.isArray(promptData.eligibleHeroIdxs)
      ? promptData.eligibleHeroIdxs
      : null;
    const attachName = promptData.cardName;
    const pickHero = (hi) => ({ heroIdx: hi });
    const biasFn = loadCardEffect(attachName)?.cpuMeta?.cpuPlacementBias;
    if (biasFn && eligible) {
      const cpuIdx = engine._cpuPlayerIdx;
      let bias = null;
      try {
        bias = biasFn(engine, cpuIdx, {
          heroHasAbilityAtMaxLevel,
          heroRejectsAbility,
          resolveAbilitySlot,
        }) || null;
      } catch { bias = null; }
      if (bias?.allowedHeroes) {
        const preferred = eligible.find(hi => bias.allowedHeroes.has(hi));
        if (preferred != null) return pickHero(preferred);
      }
    }
    if (eligible && eligible.length > 0) {
      return pickHero(eligible[0]);
    }
    return null;
  }

  // Confirm prompts fall into two shapes:
  //   • `promptConfirmEffect` / similar: caller checks `result?.confirmed === true`
  //   • Plain reaction/trigger confirm: caller checks `if (result)`
  // Returning `{ confirmed: true }` satisfies both. Returning null declines.
  if (type === 'confirm') {
    // PROACTIVE-CAST GATE: when the CPU is mid-cast of its OWN spell/
    // creature/artifact and the prompt is from that same card (matched
    // by `ps._resolvingCard.name === promptData.title`), default to
    // CONFIRM. The CPU has already committed to the play — declining
    // here cancels its own card (Brilliant Idea's "Search your deck?"
    // gate, Magnetic Glove's tutor confirm, etc.) and silently turns
    // the play into a no-op. Opp-side reaction/trigger confirms (which
    // arrive on a DIFFERENT title) still go through the decline-default
    // below; the gerry-rewritten title is unmasked first via
    // `_gerryOriginalTitle` so a Gerrymander redirect doesn't break
    // the match.
    const ownResolving = engine.gs.players?.[promptedPlayerIdx]?._resolvingCard;
    const promptTitle = promptData._gerryOriginalTitle || promptData.title;
    if (promptData.cancellable
        && ownResolving?.name
        && promptTitle
        && ownResolving.name === promptTitle) {
      return { confirmed: true };
    }
    // Cancellable confirms = OPTIONAL actions (combo follow-ups, sacrifice
    // costs, "do you want to X" opt-ins). Default to DECLINE — opting into a
    // follow-up without the CPU knowing how to execute it leaves the turn
    // stuck (e.g. Ghuanjun combo sets _preventPhaseAdvance and expects a
    // second action). Cards that need a "yes" on the CPU's behalf should
    // export `cpuResponse` to override (checked above this branch).
    // Reactions (confirmLabel ~ "Activate!") are handled in the branch above.
    if (promptData.cancellable) return null;
    return { confirmed: true };
  }

  // Player-picker prompts (Divine Gift of Fire, etc.). Default: pick the
  // HUMAN — most player-picker effects are damage / debuff flavored. A card
  // whose intent is self-affecting can opt out via its own `cpuResponse`.
  if (type === 'playerPicker') {
    return { playerIdx: cpuIdx === 0 ? 1 : 0 };
  }

  // Option-picker prompts (Siphem "remove N counters", Reincarnation mode,
  // Wheels mode, etc.). The engine's default declines cancellable prompts;
  // that was making Siphem never fire. Default to the LAST option — for
  // ramp-style cards ("remove more for more damage") this is usually the
  // "all in" choice. MCTS variations explore other options and pick the
  // best-scoring one; this fallback is for live play without MCTS branching.
  if (type === 'optionPicker') {
    const options = promptData.options || [];
    if (!options.length) return null;
    // Gold-vs-draw auto-detection: any optionPicker offering exactly one
    // `gold` option and one `draw` option (Willy today) gets routed through
    // the multi-factor evaluator. Covers future cards with the same choice
    // for free. Cards can still override via their own `cpuResponse`
    // (checked at the top of cpuGenericChoice).
    const hasGold = options.some(o => o.id === 'gold');
    const hasDraw = options.some(o => o.id === 'draw');
    if (hasGold && hasDraw && options.length === 2) {
      const pick = mctsValueGoldVsDraw(engine, cpuIdx);
      return { optionId: pick };
    }
    return { optionId: options[options.length - 1].id };
  }

  // Blind-hand-pick prompts — Thieving Strike, Loot the Leftovers, any
  // "steal N face-down cards from your opponent's hand" effect. The
  // engine's default declines cancellable prompts (Thieving Strike's
  // post-hit prompt is cancellable, so the steal silently fizzled),
  // and falls through to a generic `return true` for non-cancellable
  // ones (Loot the Leftovers — `prompt = true` has no
  // `selectedIndices`, so the steal validates to an empty list and
  // returns `{ stolen: [] }`). Both paths drop the entire steal.
  // Always pick: random distinct indices, capped at maxSelect /
  // oppHandCount. The pick is genuinely blind by card spec — we
  // deliberately don't peek at opponent's hand.
  if (type === 'blindHandPick') {
    const oppHandCount = promptData.oppHandCount || 0;
    const maxSelect = Math.max(1, promptData.maxSelect || 1);
    if (oppHandCount === 0) return { selectedIndices: [] };
    const pool = Array.from({ length: oppHandCount }, (_, i) => i);
    const picked = [];
    const n = Math.min(maxSelect, oppHandCount);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(Math.random() * pool.length);
      picked.push(pool[r]);
      pool.splice(r, 1);
    }
    return { selectedIndices: picked };
  }

  // Card-gallery prompts (deck searches, tutors, ascension bonuses).
  // The user-reported case: Magnetic Glove tutored another Magnetic
  // Glove because the heuristic picked the gallery's first random
  // card and the variation cap (6 alts) only explored alphabetically-
  // first alternatives. Score every gallery card by
  // `estimateHandCardValueFor` (same valuation `evaluateState` uses
  // for hand-value scoring) and pick the highest-scoring — duplicates
  // of cards already in hand drop to half value, ascension-critical
  // cards floor at 80, unaffordable cards drop to 5, etc. MCTS still
  // overrides via `mctsBuildVariationsFromRecord` (which now also
  // sorts alts by this score), so the heuristic only seeds the recon
  // with a sensible pick — variations still test alternatives.
  if (type === 'cardGallery') {
    const cards = promptData.cards || [];
    if (!cards.length) return null;
    const c = pickBestGalleryCard(engine, cpuIdx, cards);
    _logGalleryPick(engine, promptData, cpuIdx, [c.name]);
    return { cardName: c.name, source: c.source };
  }
  if (type === 'cardGalleryMulti') {
    const cards = promptData.cards || [];
    if (!cards.length) return { selectedCards: [] };
    // Score every gallery option, then greedily take the top scorers
    // up to `selectCount`, respecting any `maxBudget` cost cap (some
    // prompts let you pick "as many as you can afford" — we shouldn't
    // exceed the budget). Old behaviour returned ONE card regardless
    // of the prompt's allowed count, which made Beato's Ascension
    // Bonus silently grab 1 of 2 free deck-searches and similar
    // multi-pick prompts under-deliver. Score-stamp via
    // `pickBestGalleryCard` first so MCTS's
    // `mctsBuildVariationsFromRecord` gets the same `_galleryScore`
    // order it relies on for variation exploration.
    pickBestGalleryCard(engine, cpuIdx, cards); // stamps `_galleryScore` on each
    const plan = cpuGalleryMultiPlan(promptData);
    if (plan.hardCount) {
      // EXACT-count prompt (Timeless King Zi / Magic Lamp / Crestina).
      // Früher: IMMER das billigste Trio — ein Legalitäts-Shim, keine
      // Strategie (High-Level-Spells wurden dadurch NIE angeboten; Als
      // Gathering-Storm-Befund). Jetzt: budget-bewusster Score-Greedy
      // über _galleryScore + gelernte Angebotsregel der Menü-Quelle
      // (menuOfferRules, misst Menü-Design inkl. Gegnerverhalten).
      // Cheapest bleibt Fallback-Garantie. In Trainingsspielen ersetzt
      // ε (PP_MENU_EXPLORE, default 0.15) einen Slot durch eine
      // zufällige machbare Alternative — sonst entstünde nie Evidenz
      // darüber, was Gegner mit ungewohnten Angeboten anfangen.
      const menuSrc = promptData.menuSource || null;
      const scoreOf = (c) => (c._galleryScore || 0)
        + (menuSrc ? deckProfile.menuOfferRule(engine, cpuIdx, menuSrc, c.name) : 0);
      const objective = menuSrc ? MENU_OBJECTIVES[menuSrc] : null;
      let combo = (objective
          ? cpuAdversarialMenuCombo(cards, plan.need, plan.costKey, plan.maxBudget, scoreOf, objective)
          : null)
        || cpuBestGalleryCombo(cards, plan.need, plan.costKey, plan.maxBudget, scoreOf)
        || cpuCheapestGalleryCombo(cards, plan.need, plan.costKey, plan.maxBudget);
      if (combo && process.env.PP_TRAIN && !engine._inMctsSim && cards.length > plan.need) {
        const eps = parseFloat(process.env.PP_MENU_EXPLORE || '0.15');
        if (eps > 0 && Math.random() < eps) {
          const outsiders = cards.filter(c => !combo.includes(c.name));
          if (outsiders.length) {
            const swapIn = outsiders[Math.floor(Math.random() * outsiders.length)];
            const slot = Math.floor(Math.random() * combo.length);
            const trial = combo.slice();
            trial[slot] = swapIn.name;
            // Budget-Prüfung des Tauschs (nur bei costKey nötig)
            if (plan.maxBudget == null || !plan.costKey) combo = trial;
            else {
              const cost = trial.reduce((sum, n) => {
                const card = cards.find(c => c.name === n);
                return sum + (Number(card?.[plan.costKey]) || 0);
              }, 0);
              if (cost <= plan.maxBudget) combo = trial;
            }
          }
        }
      }
      _logGalleryPick(engine, promptData, cpuIdx, (combo || []) || []);
      return { selectedCards: combo || [] };
    }
    // Typed multi-pick — "up to N of type X and up to M of type Y"
    // (the Idej Lord start-of-game attach/equip gallery). That gallery
    // deliberately lists several same-named entries (e.g. 3 "Idej
    // Projection" copies), so the name-dedup in the soft path below
    // would wrongly collapse them to a single pick. For these prompts
    // "up to" means "as many as possible": fill every type to its
    // `typeLimits` cap, bounded only by `selectCount`. Same-named
    // entries ARE allowed here — selection is by gallery slot, not name.
    if (promptData.typeLimits && typeof promptData.typeLimits === 'object') {
      const cardTypes = promptData.cardTypes || {};
      const typeLimits = promptData.typeLimits;
      const typedCap = Math.max(1, promptData.selectCount || cards.length);
      const entries = cards
        .map((c, idx) => ({
          name: c.name, type: cardTypes[idx],
          score: c._galleryScore || -Infinity,
        }))
        .sort((a, b) => b.score - a.score);
      const typeUsed = {};
      const typedPicks = [];
      for (const e of entries) {
        if (typedPicks.length >= typedCap) break;
        const limit = (e.type != null && typeLimits[e.type] != null)
          ? typeLimits[e.type] : Infinity;
        if ((typeUsed[e.type] || 0) >= limit) continue;
        typeUsed[e.type] = (typeUsed[e.type] || 0) + 1;
        typedPicks.push(e.name);
      }
      _logGalleryPick(engine, promptData, cpuIdx, (typedPicks) || []);
      return { selectedCards: typedPicks };
    }
    // Soft multi-pick ("pick up to N you can afford"): greedy top-score
    // up to the cap, respecting any budget. Unchanged behaviour.
    const cap = Math.max(1, promptData.selectCount || 1);
    const costKey = promptData.costKey || 'cost';
    let budgetRemaining = promptData.maxBudget != null
      ? promptData.maxBudget
      : Infinity;
    const sorted = [...cards].sort((a, b) =>
      (b._galleryScore || -Infinity) - (a._galleryScore || -Infinity));
    const seen = new Set();
    const picks = [];
    for (const c of sorted) {
      if (picks.length >= cap) break;
      if (seen.has(c.name)) continue; // multi-select prompts forbid duplicate names
      const cost = c[costKey] || 0;
      if (cost > budgetRemaining) continue;
      seen.add(c.name);
      picks.push(c.name);
      budgetRemaining -= cost;
    }
    _logGalleryPick(engine, promptData, cpuIdx, (picks) || []);
    return { selectedCards: picks };
  }
  // Card-name picker — the prompt Luck raises on activation. Engine default
  // declines cancellable prompts, so Luck never fired for the CPU. Free
  // activation with no downside: the right answer is always "pick the most
  // likely card the opponent will play next." User-sanctioned small cheat:
  // peek at opp.hand / mainDeck / potionDeck and weight by likelihood. Log
  // of last turn's plays adds a pattern bonus for cards opp already cast.
  if (type === 'cardNamePicker') {
    // User-spec'd Luck heuristic:
    //   1. If opp has played a particular card every / close-to-every
    //      turn so far → name that (the strongest predictor of "they'll
    //      play it again next turn").
    //   2. Else → random card in opp's hand (any one card — pure
    //      probabilistic guess at their next play).
    //   3. Else (hand empty / no playable hand cards) → random card
    //      from their main deck.
    // All picks are filtered to "playable" cards (excluding Heroes /
    // Ascended Heroes / Tokens, which can't be cast from hand and so
    // can't trigger Luck).
    const allowed = promptData.cardNames;
    if (!Array.isArray(allowed) || allowed.length === 0) return null;
    const oppIdx = cpuIdx === 0 ? 1 : 0;
    const opp = engine.gs.players[oppIdx];
    if (!opp) return null;
    const cardDB = engine._getCardDB();
    const allowedSet = new Set(allowed);
    // Area cards can only be cast while the caster's own area zone is
    // empty (engine gate at `getPlayableActionCards`). If opp already
    // controls an Area, a named Area card is dead until the existing
    // Area leaves play — almost certainly NOT during the next turn —
    // so skip Area-subtype cards entirely while opp's area zone is
    // occupied.
    const oppHasArea = ((engine.gs.areaZones?.[oppIdx]) || []).length > 0;
    const isPlayable = (name) => {
      if (!allowedSet.has(name)) return false;
      const cd = cardDB[name];
      if (!cd) return false;
      const t = cd.cardType;
      if (t === 'Hero' || t === 'Ascended Hero' || t === 'Token') return false;
      // Reaction and Surprise subtypes don't get "played on opp's own
      // turn" — Reactions fire in chain windows, Surprises trigger
      // from face-down zones — so declaring them is almost always a
      // wasted Luck. Defense-in-depth: Luck's onFreeActivate also
      // filters these out of the prompt's `cardNames` list.
      const sub = (cd.subtype || '').toLowerCase();
      if (sub === 'reaction' || sub === 'surprise') return false;
      // Areas are blocked from being cast while another Area occupies
      // the caster's area zone. If opp already has one in play, the
      // named Area can't be played next turn either.
      if (sub === 'area' && oppHasArea) return false;
      return true;
    };

    // ── 1. Pattern match across ALL opp turns ───────────────────────
    // Walk the engine action log for `card_played` / `creature_summoned`
    // events tagged with opp's username. Group by turn so a card cast
    // multiple times in one turn doesn't inflate the "appeared in N
    // distinct turns" count. Threshold: appeared in ≥80% of opp's turns
    // played so far AND ≥2 distinct turns. That excludes one-shot plays
    // and weak coincidences while catching deck-staple repeats.
    const oppName = opp.username;
    const log = engine.actionLog || [];
    const turnsByCard = new Map(); // name → Set<turnNumber>
    const oppTurnsSeen = new Set();
    // The play-log uses three event types: `spell_played` (Spells +
    // Attacks), `creature_summoned` (Creatures), and `card_played`
    // (Potions + Artifacts). All three trigger Luck's hooks, so all
    // three count toward "what does opp tend to play".
    const PLAY_TYPES = new Set(['spell_played', 'creature_summoned', 'card_played']);
    for (const e of log) {
      if (e.turn == null) continue;
      if (e.player !== oppName) continue;
      oppTurnsSeen.add(e.turn);
      if (!e.card) continue;
      if (!PLAY_TYPES.has(e.type)) continue;
      if (!isPlayable(e.card)) continue;
      let s = turnsByCard.get(e.card);
      if (!s) { s = new Set(); turnsByCard.set(e.card, s); }
      s.add(e.turn);
    }
    const oppTurnCount = oppTurnsSeen.size;
    if (oppTurnCount >= 2 && turnsByCard.size > 0) {
      const PATTERN_RATIO = 0.8; // "close to every turn"
      let bestName = null, bestCount = 0;
      for (const [name, turns] of turnsByCard) {
        if (turns.size > bestCount) { bestName = name; bestCount = turns.size; }
      }
      if (bestName && bestCount >= 2 && bestCount >= Math.ceil(oppTurnCount * PATTERN_RATIO)) {
        return { cardName: bestName };
      }
    }

    // ── 2. Random card from opp's hand ───────────────────────────────
    const handCandidates = (opp.hand || []).filter(isPlayable);
    if (handCandidates.length > 0) {
      return { cardName: randomOf(handCandidates) };
    }

    // ── 3. Random card from opp's main deck ──────────────────────────
    const deckCandidates = (opp.mainDeck || []).filter(isPlayable);
    if (deckCandidates.length > 0) {
      return { cardName: randomOf(deckCandidates) };
    }

    // ── Final fallback — declare ANY playable allowed name so Luck
    //    fires (free activation, no downside). Only reached when opp
    //    has no playable hand AND no playable deck (extremely rare —
    //    all-Hero / all-Token state).
    const fallback = allowed.find(isPlayable);
    return fallback ? { cardName: fallback } : null;
  }
  if (type === 'zonePick') {
    const zones = promptData.zones || [];
    if (!zones.length) return null;
    // Card-driven placement preference. The source card's script can
    // expose `cpuMeta.preferOpponentSupportZone: true` (Chilly Wizard
    // and any future cross-side placement Creature). When set, the
    // heuristic narrows the candidate pool to zones on the opp's side
    // — falls back to all zones if none qualify.
    let pool = zones;
    try {
      const sourceName = promptData.title;
      const script = sourceName ? loadCardEffect(sourceName) : null;
      if (script?.cpuMeta?.preferOpponentSupportZone) {
        const oppIdx = cpuIdx === 0 ? 1 : 0;
        const oppPool = zones.filter(z => z.ownerIdx === oppIdx);
        if (oppPool.length > 0) pool = oppPool;
      }
    } catch { /* ignore — fall through to uniform pick */ }
    const z = pool[Math.floor(Math.random() * pool.length)];
    return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
  }
  // Hand-pick (mulligan) prompts: Leadership, Horn in a Bottle, etc.
  // These expect `{ selectedCards: [{ cardName, handIndex }, ...] }`.
  // Use the same valuation as forced-discard: scarce cards, Ascended Heroes,
  // and evaluator-rewarded cards (Cardinal Beasts, OHS pieces) are preserved;
  // low-value filler gets mulliganed. With minSelect=0 (Horn in a Bottle)
  // we may return zero cards for a pure +1 draw; with minSelect≥1
  // (Leadership) we always return at least that many of the worst cards.
  if (type === 'handPick') {
    const ps = engine.gs.players[cpuIdx];
    if (!ps?.hand?.length) return null;
    const eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    if (!eligible.length) return null;
    const maxSelect = promptData.maxSelect || 1;
    const minSelect = promptData.minSelect != null ? promptData.minSelect : 1;
    const cardDB = engine._getCardDB();
    const baseScore = (() => {
      try { return evaluateState(engine, cpuIdx); } catch { return 0; }
    })();
    const scored = eligible.map(idx => {
      const name = ps.hand[idx];
      const cd = cardDB[name];
      let value = 0;
      const countIn = (arr) => (arr || []).filter(c => c === name).length;
      const copiesLeft = countIn(ps.hand) + countIn(ps.mainDeck) + countIn(ps.potionDeck);
      if (copiesLeft === 1) value += 100;
      else if (copiesLeft === 2) value += 25;
      if (cd?.cardType === 'Ascended Hero') value += 200;
      const removed = ps.hand[idx];
      ps.hand.splice(idx, 1);
      let scoreWithout = baseScore;
      try { scoreWithout = evaluateState(engine, cpuIdx); } catch {}
      ps.hand.splice(idx, 0, removed);
      value += Math.max(0, baseScore - scoreWithout);
      return { idx, name, value };
    });
    scored.sort((a, b) => a.value - b.value);
    // Threshold 50 ≈ "not scarce, not a tracked combo piece" — safe to return.
    // Past minSelect, stop once we'd be shuffling back something useful.
    const selected = [];
    for (const s of scored) {
      if (selected.length >= maxSelect) break;
      if (selected.length >= minSelect && s.value >= 50) break;
      selected.push({ cardName: s.name, handIndex: s.idx });
    }
    return { selectedCards: selected };
  }
  if (type === 'pickHandCard') {
    const ps = engine.gs.players[engine._cpuPlayerIdx];
    if (!ps?.hand?.length) return null;
    const eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    if (!eligible.length) return null;
    const idx = eligible[Math.floor(Math.random() * eligible.length)];
    return { cardName: ps.hand[idx], handIndex: idx };
  }
  // Forced/voluntary discards: pick the LEAST valuable card. "Value" is
  // derived from (a) the evaluator delta if the card were removed — this
  // automatically protects Cardinal Beasts, OHS/Howitzer setup pieces,
  // and any other card the evaluator already rewards as in-hand/in-deck,
  // (b) scarcity (cards with only 1 copy remaining across hand+deck are
  // preserved over plentiful copies), and (c) card type — Ascended Hero
  // cards are irreplaceable plan pieces and almost always worth keeping.
  // Avoids hard-coded per-card rules; the evaluator handles the logic.
  if (type === 'forceDiscard' || type === 'forceDiscardCancellable') {
    const ps = engine.gs.players[cpuIdx];
    if (!ps?.hand?.length) return null;

    // ── UNGEWINNBARES ABWURF-DUELL (v327, Als Report) ────────────────
    // Bottled Flame / Lightning laufen als WECHSELSEITIGE Kette. Hat der
    // Gegner einen wirksamen Boris, wirft er nie etwas ab — die Kette
    // kommt also endlos zurück, bis die CPU keine Handkarten mehr hat
    // und den Effekt DOCH nimmt. Weiter abzuwerfen kostet die ganze Hand
    // und ändert am Ausgang nichts. Also sofort annehmen.
    // Haben BEIDE einen Boris, darf keiner verzichten (Sicherung in
    // _bottled-shared.js) — dann ist es ein normales Duell.
    if (type === 'forceDiscardCancellable' && promptData.alternatingChain) {
      try {
        const boris = require('./_loader').loadCardEffect('Boris, the Guardian of Blackport');
        const gegner = cpuIdx === 0 ? 1 : 0;
        if (boris?.borisActive
            && boris.borisActive(engine, gegner)
            && !boris.borisActive(engine, cpuIdx)) {
          cpuLog(`  [Abwurf-Duell] Gegner hat einen wirksamen Boris — die Kette ist nicht zu gewinnen. `
            + `Effekt sofort annehmen statt ${ps.hand.length} Handkarten zu verschenken.`);
          return null; // "Take it!"
        }
      } catch { /* Boris nicht ladbar → normal weiterrechnen */ }
    }
    let eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    // Defensive resolving-card exclusion. When a script prompts for a
    // forced discard / delete during its own resolve and forgets to
    // pass eligibleIndices, the prompt accepts ANY hand card —
    // including the still-in-hand resolving card itself. The CPU's
    // discard scorer would then happily nominate Wheels itself as
    // a "delete 2" target. Strip the resolving card here so the
    // brain never picks the in-flight card even if the script
    // didn't filter it. Scripts should still pass eligibleIndices
    // explicitly for correctness against the human player too.
    if (ps._resolvingCard) {
      const { name: rname, nth } = ps._resolvingCard;
      let count = 0;
      let resolvingIdx = -1;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] !== rname) continue;
        count++;
        if (count === (nth || 1)) { resolvingIdx = i; break; }
      }
      if (resolvingIdx >= 0) {
        const filtered = eligible.filter(i => i !== resolvingIdx);
        if (filtered.length > 0) eligible = filtered;
      }
    }
    if (!eligible.length) return null;
    const cardDB = engine._getCardDB();
    const baseScore = (() => {
      try { return evaluateState(engine, cpuIdx); } catch { return 0; }
    })();
    const scored = eligible.map(idx => {
      const name = ps.hand[idx];
      const cd = cardDB[name];
      let value = 0;
      // Scarcity: only copy anywhere accessible = irreplaceable
      const countIn = (arr) => (arr || []).filter(c => c === name).length;
      const copiesLeft = countIn(ps.hand) + countIn(ps.mainDeck) + countIn(ps.potionDeck);
      if (copiesLeft === 1) value += 100;
      else if (copiesLeft === 2) value += 25;
      // Ascended Hero cards are critical win-condition pieces
      if (cd?.cardType === 'Ascended Hero') value += 200;
      // Evaluator delta — tentatively MOVE the card from hand to
      // discard pile and re-score. Pushing to discardPile (not just
      // splicing out of hand) lets the evaluator see post-discard
      // synergies — e.g. Cute Phoenix's HOPT damage scaling with the
      // count of Creatures in the controller's discard pile flips a
      // Creature discard from "neutral" into "actively beneficial",
      // so the brain prefers to feed Phoenix when armed instead of
      // burning Spells. Mirror the move via splice + push, then
      // restore both halves afterwards.
      const removed = ps.hand[idx];
      ps.hand.splice(idx, 1);
      ps.discardPile.push(removed);
      let scoreWithout = baseScore;
      try { scoreWithout = evaluateState(engine, cpuIdx); } catch {}
      ps.discardPile.pop();
      ps.hand.splice(idx, 0, removed);
      value += Math.max(0, baseScore - scoreWithout);
      return { idx, name, value };
    });
    scored.sort((a, b) => a.value - b.value);
    const pick = scored[0];
    // For forceDiscardCancellable ("discard a card OR take the effect"),
    // refuse the discard if the least-bad card is still too precious to
    // lose. Threshold 150 ≈ "this card is more valuable than ~150 HP
    // of damage" — roughly what Bottled Lightning's heaviest tick hits
    // for. Covers Ascended Heroes (score ~310), Cardinal Beasts (~150),
    // and any eval-tracked combo piece. Regular scarce cards (~110)
    // still get discarded; only clear win-condition pieces cancel.
    if (type === 'forceDiscardCancellable' && pick.value >= 150) {
      return null; // "Take it!" — eat the damage to save the card
    }
    return { cardName: pick.name, handIndex: pick.idx };
  }
  return undefined; // Defer to default
}

// ─── Reaction decisions ────────────────────────────────────────────────

function cpuReactionDecision(engine, promptData) {
  const cpuIdx = engine._cpuPlayerIdx;
  const reactionName = promptData.title;
  const rxCd = reactionName ? engine._getCardDB()[reactionName] : null;
  const chainInit = engine.chain?.[0];
  const chainOwnerIsCpu = chainInit && chainInit.owner === cpuIdx;

  // Juice: CPU only plays it when one of their own targets actually
  // has a cleansable negative status. The card removes statuses, NOT
  // HP — gating on HP missing (the previous behaviour) made the CPU
  // burn Juice on a full-HP own hero with no statuses for 0 effect.
  if (reactionName === 'Juice') {
    if (!hasCleansableOwnTarget(engine)) return null; // decline
    return true;
  }

  // Any other negation-style reaction: only fire against a player's card.
  if (rxCd && isLikelyNegation(rxCd)) {
    if (chainOwnerIsCpu) return null; // decline — don't negate own cards
    return true;
  }

  // Default: fire reactions ASAP.
  return true;
}

function isLikelyNegation(cd) {
  const effect = (cd.effect || '').toLowerCase();
  if (!effect) return false;
  // Exclude phrases that say "cannot be negated" / "may not be negated" —
  // those mention negation but aren't themselves negations.
  const negatedProtections = /(cannot|can ?not|may not|will not) be negated/.test(effect);
  if (negatedProtections && !/negate (the|this|that)/.test(effect)) return false;
  // Positive detection: "negate this spell", "negate the effect", "negate the activation"
  return /negate (the|this|an|its) /i.test(effect);
}

// ─── Heal / buff detection heuristics ───────────────────────────────────

function looksLikeHeal(cd, config) {
  if (!cd && !config) return false;
  if (config?.isHeal === true) return true;
  const effect = (cd?.effect || '').toLowerCase();
  // "heal", "restore N HP", "recover"
  if (/\bheal(s|ed|ing)?\b/.test(effect)) return true;
  if (/restore .* hp/.test(effect)) return true;
  if (/recover .* hp/.test(effect)) return true;
  return false;
}

function looksLikeBuff(cd, config) {
  if (!cd) return false;
  if (config?.isBuff === true) return true;
  const effect = (cd.effect || '').toLowerCase();
  if (/\bincreas(e|es|ed) (the )?(attack|hp|max hp)/.test(effect)) return true;
  if (/gain(s)? (\d+|an?) /.test(effect) && /attack|hp/.test(effect)) return true;
  return false;
}

function inferDamage(config) {
  const d = config.baseDamage ?? config.damage ?? 0;
  return Number.isFinite(d) ? d : 0;
}

/**
 * "Does the controller have any active card whose pileFuel.discardFilter
 * matches at least one of these own-side targets?" — opens the
 * simulate-and-score branch for damage-card targeting that lets the
 * CPU self-target own units when killing them is evaluator-positive
 * (e.g. Soul Shards going board → discard for re-summon fuel). Cheap
 * pre-check: walks the controller's tracked instances once, collects
 * the discard filters that are "active" (presenceWeight > 0), then
 * checks each own target's name against them. Generic via cpuMeta —
 * NO archetype names appear here.
 */
function ownTargetsAreSelfDestructWelcome(engine, ownTargets, ownerIdx) {
  if (!ownTargets?.length) return false;
  const ps = engine.gs.players?.[ownerIdx];
  if (!ps) return false;
  const filters = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
    if (inst.faceDown) continue;
    if (inst.counters?.negated || inst.counters?.nulled) continue;
    const meta = loadCardEffect(inst.name)?.cpuMeta?.pileFuel;
    if (!meta?.discardFilter) continue;
    const w = (meta.presenceWeights || { support: 1.0, hand: 0.5 })[inst.zone];
    if (!w) continue;
    filters.push(meta.discardFilter);
  }
  if (filters.length === 0) return false;
  const cardDB = engine._getCardDB();
  for (const t of ownTargets) {
    let name = null;
    if (t.type === 'hero') {
      name = ps.heroes?.[t.heroIdx]?.name;
    } else if (t.type === 'creature' || t.type === 'equip') {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      name = inst?.name;
    }
    if (!name) continue;
    const cd = cardDB[name];
    if (!cd) continue;
    if (filters.some(f => { try { return f(cd); } catch { return false; } })) return true;
  }
  return false;
}

/**
 * Simulate "this candidate takes `damage`" and return the resulting
 * `evaluateState(ownerIdx)` score, with all mutations restored before
 * returning. Used by the simulate-and-score damage picker so own
 * Soul Shards (and any future pileFuel-rewarded own target) can be
 * compared against enemy targets on a single objective scale —
 * the eval naturally accounts for HP loss, on-board value loss, AND
 * pileFuel discardValue when a creature dies into discard. No
 * heuristics inside; the eval does the arithmetic.
 *
 * Caller MUST guard against MCTS re-entry (`engine._inMctsSim`).
 * Returns null on any state we can't simulate cleanly.
 */
function simulateDamageTargetScore(engine, target, damage, ownerIdx) {
  const evalState = engine._cpuEvaluateState;
  if (typeof evalState !== 'function') return null;
  if (!target || target.owner == null) return null;
  const gs = engine.gs;
  if (target.type === 'hero') {
    const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!h || h.hp <= 0) return null;
    const before = h.hp;
    h.hp = Math.max(0, h.hp - damage);
    let score = null;
    try { score = evalState(ownerIdx); } catch {}
    h.hp = before;
    return score;
  }
  if (target.type === 'creature' || target.type === 'equip') {
    const inst = target.cardInstance || findSupportInstance(engine, target);
    if (!inst) return null;
    const cd = engine.getEffectiveCardData(inst);
    const maxHp = cd?.hp ?? 0;
    const dmgBefore = inst.counters?.damageTaken || 0;
    const hp = Math.max(0, maxHp - dmgBefore);
    if (hp <= 0) return null;
    if (damage < hp) {
      // Non-lethal — bump damageTaken, score, restore.
      const had = inst.counters?.damageTaken !== undefined;
      inst.counters.damageTaken = dmgBefore + damage;
      let score = null;
      try { score = evalState(ownerIdx); } catch {}
      if (had) inst.counters.damageTaken = dmgBefore;
      else delete inst.counters.damageTaken;
      return score;
    }
    // Lethal — move support → discard, score, restore.
    const instOwner = inst.owner;
    const heroIdx = inst.heroIdx;
    const slotIdx = inst.zoneSlot;
    const ps = gs.players[instOwner];
    if (!ps?.supportZones?.[heroIdx]) return null;
    const slotBefore = [...(ps.supportZones[heroIdx][slotIdx] || [])];
    const zoneBefore = inst.zone;
    ps.supportZones[heroIdx][slotIdx] = [];
    ps.discardPile.push(inst.name);
    inst.zone = 'discard';
    let score = null;
    try { score = evalState(ownerIdx); } catch {}
    inst.zone = zoneBefore;
    ps.discardPile.pop();
    ps.supportZones[heroIdx][slotIdx] = slotBefore;
    return score;
  }
  return null;
}

// ─── Enemy targeting ──────────────────────────────────────────────────
// Rule (user spec):
//   • If damage would defeat an enemy Hero → target that Hero (100%).
//   • Else weighted random: 60% big-damage (≥50% HP) enemy Hero,
//                           30% killable enemy Creature,
//                           10% enemy Creature that survives the damage.
// If we can't pick by those tiers (empty category), fall through to the
// next tier so the CPU always picks SOMETHING when damage targeting an
// enemy is legal.

// Check whether a target is fully immune — damage / targeting effects
// against it will fizzle entirely. Returns true for:
//   • first-turn grace shield on the target's owner
//   • hero-level generic `immune` status (CC immune)
//   • hero petrified via Baihu (stunned + _baihuPetrify)
//   • hero charmed by someone other than its owner (Charme Lv3 damage-immune)
//   • creature that's face-down (surprise), targeting_immune, control_immune,
//     _cardinalImmune, or _baihuPetrify
// Conservative: when in doubt, treat as non-immune so we don't over-skip.
function isTargetImmune(engine, target) {
  const gs = engine.gs;
  if (!target) return false;
  if (target.owner != null && gs.firstTurnProtectedPlayer === target.owner) return true;

  if (target.type === 'hero') {
    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero || hero.hp <= 0) return true;
    if (hero.statuses?.immune) return true;
    if (hero.statuses?.stunned?._baihuPetrify) return true;
    if (hero.charmedBy != null && hero.charmedBy !== target.owner) return true;
    // Submerged (Als Demo-Befund, damage_blocked reason 'submerged'):
    // die Engine blockt Schaden UND Status-Effekte auf getauchte
    // Helden, SOLANGE der Besitzer noch einen anderen lebenden,
    // nicht-getauchten Helden hat — exakt diese Bedingung hier
    // gespiegelt, damit die CPU keine Effekte an submerged verschwendet.
    if (hero.buffs?.submerged) {
      const otherAlive = (gs.players[target.owner]?.heroes || [])
        .some(h => h && h !== hero && h.name && h.hp > 0 && !h.buffs?.submerged);
      if (otherAlive) return true;
    }
    return false;
  }

  if (target.type === 'creature' || target.type === 'equip') {
    const inst = target.cardInstance
      || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
    if (!inst) return true;
    if (inst.faceDown) return true;
    if (inst.counters?.targeting_immune) return true;
    if (inst.counters?.control_immune) return true;
    if (inst.counters?._cardinalImmune) return true;
    if (inst.counters?._baihuPetrify) return true;
    // Registry-Audit (Als Auftrag): golden_wings setzt zusätzlich
    // untargetable_by_opponent — für Ziele der GEGENSEITE immun (eigene
    // Kreaturen mit dem Counter bleiben für den Besitzer wählbar).
    if (inst.counters?.untargetable_by_opponent
        && target.owner !== engine._cpuPlayerIdx) return true;
    if (inst.counters?.untargetable_by_opponent_pi != null
        && inst.counters.untargetable_by_opponent_pi === engine._cpuPlayerIdx) return true;
    return false;
  }
  return false;
}

// Helfer-Bündel, das an die per-Karte-Hooks in `cpuMeta` durchgereicht
// wird (alwaysCommit, activationScoreBonus). So können Karten-Skripte die
// Ziel-Hygiene der CPU mitbenutzen, statt die Immunitäts-Regeln zu
// duplizieren — `isTargetImmune` deckt tot, immun, Baihu-Petrify,
// gecharmt, submerged und den Erstzug-Schild ab. Bewusst ein Objekt:
// weitere Helfer lassen sich ergänzen, ohne jede Signatur anzufassen.
const CPU_META_HELPERS = { isTargetImmune };

function pickEnemyTargets(engine, enemyTargets, damage, maxSelect) {
  const gs = engine.gs;
  // Drop fully immune targets up front — hitting them does nothing useful
  // and the user explicitly wants to avoid wasting effects on them. If this
  // empties the pool, the caller (cpuPickTargets) will decline cancellable
  // prompts, which cancels the spell and leaves the card in hand.
  const viable = enemyTargets.filter(t => !isTargetImmune(engine, t));
  if (viable.length === 0) return [];

  // Score each viable target by *expected value of the hit*, combining:
  //   • the unit's dynamic value (hero: spell history, recent damage,
  //     redundancy, summoner state, atk; creature: level, recent
  //     contribution, on-death-fuel discount)
  //   • the actual damage that will land (capped by HP — we don't reward
  //     overkill on a 40 HP creature)
  //   • a kill-shot bonus that scales with the unit's value (lethal on a
  //     deadweight creature is still much less valuable than lethal on
  //     the team's main carry)
  // This replaces the old fixed-tier weighted random — the "300 damage
  // wasted on a 40 HP creature" symptom comes directly from that tier
  // system not knowing how much the creature was actually worth.
  const teamMaxSchoolLvls = {};
  const teamMax = (oppIdx) => {
    if (teamMaxSchoolLvls[oppIdx] == null) teamMaxSchoolLvls[oppIdx] = mctsTeamMaxSchoolLvl(gs, oppIdx);
    return teamMaxSchoolLvls[oppIdx];
  };
  // When the prompt's targetingConfig forgets to declare `baseDamage`,
  // `damage` lands as 0 here — every formula below would multiply by 0
  // and collapse to an all-zero score (random tiebreak). Treat
  // unknown-damage prompts as "value-only" picks: score purely by the
  // unit's dynamic value so the CPU still focuses on the highest-impact
  // target instead of rolling a coin between Jenny and Bill. Cards
  // SHOULD declare baseDamage; this is the safety net for any that
  // slip through.
  const damageKnown = damage > 0;
  const scoreTarget = (t) => {
    if (t.type === 'hero') {
      const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!h || h.hp <= 0) return -Infinity;
      const immortal = !!h.buffs?.immortal;
      if (immortal && h.hp <= 1 && damage > 0) return -Infinity; // wasted
      const value = mctsEnemyHeroDynamicValue(engine, t.owner, t.heroIdx, teamMax(t.owner));
      if (!damageKnown) {
        // Unknown damage — still prefer low-HP and high-value heroes, but
        // skip the kill-shot bonus (we don't know whether the card kills).
        const focusBonus = Math.max(0, 40 - h.hp * 0.3);
        return 100 * value + focusBonus;
      }
      const effDamage = Math.min(damage, immortal ? Math.max(0, h.hp - 1) : h.hp);
      const lethal = !immortal && damage > 0 && damage >= h.hp;
      // Kill-shot reward scales with hero value — lethal on a 1.0× hero
      // is OK, lethal on a 3.0× carry is nearly always the right pick.
      const killBonus = lethal ? 250 * value : 0;
      // Low-HP focus tiebreaker: small bonus for hitting a hero already
      // close to dying (consistent focus-fire across turns).
      const focusBonus = Math.max(0, 40 - h.hp * 0.3);
      return effDamage * value + killBonus + focusBonus;
    }
    if (t.type === 'creature' || t.type === 'equip') {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      const hp = creatureCurrentHp(engine, inst, t);
      if (hp == null) return 0;
      const immortal = !!inst?.counters?.buffs?.immortal;
      if (immortal && hp <= 1 && damage > 0) return -Infinity;
      const value = mctsEnemyCreatureValue(engine, inst);
      if (!damageKnown) {
        // Unknown damage — value-only fallback, with the same
        // hero/creature gap (creatures rank below heroes).
        return 50 * value - 30;
      }
      const effDamage = Math.min(damage, immortal ? Math.max(0, hp - 1) : hp);
      const killable = !immortal && damage > 0 && damage >= hp;
      const killBonus = killable ? 80 * value : 0;
      // Creatures generally rank below heroes — same effective damage on
      // an equally-valued creature should not beat an equally-valued
      // hero. The kill-shot multiplier is also smaller (80 vs 250).
      return effDamage * value + killBonus - 30;
    }
    return 0;
  };

  const scored = viable.map(t => ({ t, s: scoreTarget(t) }))
    .filter(x => x.s > -Infinity)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return [];

  // ── Multi-target path (maxSelect > 1) ──
  // Pyroblast-style "hit up to N targets" prompts: greedy-fill from
  // best to worst by score.
  if (maxSelect > 1) {
    return scored.slice(0, maxSelect).map(x => x.t);
  }

  // Single-target: pick the best score. Random tiebreak among targets
  // within ~3% of the top score so the CPU isn't perfectly predictable
  // and so that ties (e.g. equally valued heroes) are spread fairly.
  const top = scored[0].s;
  const epsilon = Math.max(1, Math.abs(top) * 0.03);
  const tied = scored.filter(x => x.s >= top - epsilon).map(x => x.t);
  return [randomOf(tied)];
}

// ─── Ally targeting ───────────────────────────────────────────────────
// Heal:
//   • Always heal enemy Hero with Overheal Shock (kills them).
//   • Never heal own Hero with Overheal Shock attached.
//   • Prioritize own Hero/Creature equipped with Lifeforce Howitzer (fresh).
//   • Else heal own Hero with most missing HP. If all Heroes full → heal
//     own Creature with lowest HP.
// Buff:
//   • Prefer Hero targets; de-prioritize targets that already have the buff.
//   • Random among top tier.

function pickHealTarget(engine, ownTargets, enemyTargets, cardName, _config) {
  const gs = engine.gs;
  // 1) heal-reversed enemy Hero → kill shot: always target.
  for (const t of enemyTargets) {
    if (t.type !== 'hero') continue;
    if (heroHealReversed(engine, t)) return t;
  }

  // 2) Skip own Heroes whose heal is reversed, and creatures flagged
  //    `cpuMeta.preferDead` (Cute Cat etc. — the CPU never spends a
  //    heal / cleanse on creatures that want to die).
  const safeOwn = ownTargets.filter(t => {
    if (t.type === 'hero' && heroHealReversed(engine, t)) return false;
    if (targetIsPreferDead(engine, t)) return false;
    return true;
  });

  // 3) Priority: own target equipped with Lifeforce Howitzer that hasn't used effect yet.
  const lifeforce = safeOwn.filter(t => targetHasFreshLifeforceHowitzer(engine, t));
  if (lifeforce.length) return randomOf(lifeforce);

  // 4) Status-cleansing precedence: cards like Juice that "heal from
  //    negative status effects" don't restore HP — they remove
  //    statuses. The valid-target list for those cards is already
  //    pre-filtered to "has a cleansable status," but the heal picker
  //    used to evaluate by HP-missing only, so a fully-healthy hero
  //    with a status would be rejected (missing === 0) and the heal
  //    fell through to the lowest-HP creature instead. Detect status-
  //    cleansing intent two ways:
  //      • The card script's getValidTargets pre-filtered all targets
  //        to ones with a status (every passed-in own target carries
  //        at least one cleansable status — the safest universal
  //        check).
  //      • Card text mentions "negative status" / "cleanse" / "remove
  //        status" — pattern fallback for cards that take broader
  //        target sets and let the user pick a status-bearing one.
  //    When in cleansing mode, prefer Ascended / Ascendable heroes,
  //    then any hero, then creatures (heroes are far more valuable
  //    than a 50-HP body even before considering ascension).
  const targetHasCleansableStatus = (t) => {
    if (t.type === 'hero') {
      const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!h?.statuses) return false;
      const negKeys = getCleansableStatuses();
      return negKeys.some(k => h.statuses[k]);
    }
    if (t.type === 'equip' || t.type === 'creature') {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      if (!inst?.counters) return false;
      const negKeys = getCleansableStatuses();
      return negKeys.some(k => inst.counters[k]);
    }
    return false;
  };
  const allOwnHaveStatus = safeOwn.length > 0 && safeOwn.every(targetHasCleansableStatus);
  const cardDB = engine._getCardDB();
  const cd = cardName ? cardDB[cardName] : null;
  const effect = (cd?.effect || '').toLowerCase();
  const looksLikeCleanse = /negative status|cleanse|remove .* status/i.test(effect);
  if (allOwnHaveStatus || looksLikeCleanse) {
    const statusOwn = safeOwn.filter(targetHasCleansableStatus);
    if (statusOwn.length > 0) {
      const heroes = statusOwn.filter(t => t.type === 'hero');
      if (heroes.length > 0) {
        // Ascended / Ascendable heroes carry the deck plan — keep them
        // on top. Within the same tier, sort by anticipated lethal-tick
        // first (a 30-burn on a 30-HP hero is a crisis save), then by
        // raw HP-missing as a secondary signal.
        const STATUS_DMG_PER_STACK = 30;
        const scoreHero = (t) => {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!h) return -Infinity;
          const burn = statusStacks(h, 'burned');
          const poison = statusStacks(h, 'poisoned');
          const tickDmg = STATUS_DMG_PER_STACK * (burn + poison);
          const lethal = tickDmg > 0 && tickDmg >= h.hp ? 10000 : 0;
          const ascended = targetIsAscendedOrAscendableHero(engine, t) ? 1000 : 0;
          const missing = (h.maxHp || 0) - (h.hp || 0);
          return lethal + ascended + missing;
        };
        heroes.sort((a, b) => scoreHero(b) - scoreHero(a));
        return heroes[0];
      }
      // No hero in the cleanse pool — fall back to a creature with a
      // status. Lowest-HP first so the most fragile body gets the
      // status removed (e.g. a burn that would kill it next tick).
      const creatures = statusOwn.filter(t => t.type === 'creature' || t.type === 'equip').map(t => {
        const inst = t.cardInstance || findSupportInstance(engine, t);
        return { t, hp: creatureCurrentHp(engine, inst, t) ?? Infinity };
      });
      if (creatures.length) {
        creatures.sort((a, b) => a.hp - b.hp);
        return creatures[0].t;
      }
    }
  }

  // 5) Most-missing-HP own Hero; else lowest-HP own Creature.
  const ownHeroes = safeOwn.filter(t => t.type === 'hero').map(t => {
    const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
    return { t, missing: (h?.maxHp || 0) - (h?.hp || 0) };
  }).filter(x => x.missing > 0);
  if (ownHeroes.length) {
    // Ascended / Ascendable heroes get the top tier — keeping the deck's
    // plan piece alive beats a bigger-number heal on a regular hero.
    // Within the same Ascension tier, sort by most HP missing.
    ownHeroes.sort((a, b) => {
      const aAsc = targetIsAscendedOrAscendableHero(engine, a.t) ? 1 : 0;
      const bAsc = targetIsAscendedOrAscendableHero(engine, b.t) ? 1 : 0;
      if (aAsc !== bAsc) return bAsc - aAsc;
      return b.missing - a.missing;
    });
    return ownHeroes[0].t;
  }
  const ownCreatures = safeOwn.filter(t => t.type === 'creature' || t.type === 'equip').map(t => {
    const inst = t.cardInstance || findSupportInstance(engine, t);
    return { t, hp: creatureCurrentHp(engine, inst, t) ?? Infinity };
  });
  if (ownCreatures.length) {
    ownCreatures.sort((a, b) => a.hp - b.hp);
    return ownCreatures[0].t;
  }
  return null;
}

// ─── Self-status target scoring ───────────────────────────────────────
// For cards that apply a NEGATIVE status to one of the caster's own
// targets (Sickly Cheese self-poisons, Zsos'Ssar's Decay-Spell cost
// self-poisons, …), the CPU needs to know *which* own-side target
// actually wants the status. Card scripts opt in by exporting
//   `cpuStatusSelfValue(statusName, { engine, owner, heroIdx, hero })
//     → number`
// returning a positive score when the target benefits (Fiona gains
// gold per negative status; Stellan triggers a free-summon on any
// negative status) or a negative score when it hurts (Layn loses her
// creature-HP bonus on CC).
//
// The picker walks the hero's own script + every ability attached to
// the hero and sums their scores. A self-status card's
// `targetingConfig.appliesStatus = 'poisoned' | 'frozen' | …` opts the
// prompt into this picker; otherwise the generic own-side fall-through
// at the end of cpuPickTargets picks randomly.
function scoreSelfStatusTarget(engine, target, statusName) {
  if (!target || target.type !== 'hero' || target.heroIdx == null) return 0;
  const gs = engine.gs;
  const ps = gs.players[target.owner];
  const hero = ps?.heroes?.[target.heroIdx];
  if (!hero?.name) return 0;
  let total = 0;
  // Ressourcen-Kontext für die Karten-Verträge: Gold-Bedarf vs. Bestand
  // aus demselben Demand-Modell, das auch evaluateState nutzt. Damit
  // können Karten wie Fiona ("+20 Gold pro Selbst-Status") ihren Wert
  // situativ beziffern, statt konstant zu liefern — ein Selbst-Gift bei
  // 200 Gold Vorrat ist kein Gewinn, sondern ein verschenkter Effekt
  // (live beobachtet in Venom Swamp: Gift auf die eigene Fiona statt
  // auf den Gegner, bei vollem Goldbeutel).
  let goldSurplus = 0, goldDemand = 0;
  try {
    goldDemand = computeGoldDemand(engine, target.owner) || 0;
    goldSurplus = Math.max(0, (ps?.gold || 0) - goldDemand);
  } catch { /* Kontext optional */ }
  const ctx = { engine, owner: target.owner, heroIdx: target.heroIdx, hero, goldDemand, goldSurplus };
  const applyScript = (script) => {
    if (typeof script?.cpuStatusSelfValue !== 'function') return;
    try {
      const v = Number(script.cpuStatusSelfValue(statusName, ctx)) || 0;
      total += v;
    } catch { /* ignore card errors, treat as 0 */ }
  };
  applyScript(loadCardEffect(hero.name));
  const abZones = ps.abilityZones?.[target.heroIdx] || [[], [], []];
  for (const slot of abZones) {
    for (const abName of (slot || [])) applyScript(loadCardEffect(abName));
  }
  // Also scan the target's owner's HAND for cards that value a self-status.
  // Luna Kiai, for example, wants all own Heroes Burned so she can be free-
  // summoned — her `cpuStatusSelfValueInHand` returns a positive score
  // while she's in hand. Deduplicated per card name so holding 3 copies
  // doesn't triple-count.
  const seenHandNames = new Set();
  for (const cn of (ps.hand || [])) {
    if (seenHandNames.has(cn)) continue;
    seenHandNames.add(cn);
    const script = loadCardEffect(cn);
    if (typeof script?.cpuStatusSelfValueInHand !== 'function') continue;
    try {
      const v = Number(script.cpuStatusSelfValueInHand(statusName, ctx)) || 0;
      total += v;
    } catch { /* ignore */ }
  }
  return total;
}

function pickSelfStatusTarget(engine, ownTargets, statusName) {
  if (!ownTargets || ownTargets.length === 0) return null;
  const scored = ownTargets.map(t => ({ t, s: scoreSelfStatusTarget(engine, t, statusName) }));
  let maxScore = -Infinity;
  for (const x of scored) if (x.s > maxScore) maxScore = x.s;
  const top = scored.filter(x => x.s === maxScore).map(x => x.t);
  return randomOf(top);
}

// ─── Self-damage target picker (Fire Bolts recoil etc.) ─────────────────
// Rule-based harm minimization. Lower cost = better pick.
//
//   • Lethal on the caster's ONLY remaining live hero  → Infinity (never
//     pick; doing so loses the game on our own turn).
//   • Lethal on a doomed-anyway hero (Golden Ankh's `_forceKillAtTurnEnd`)
//     → near-free: the hero would die at End Phase anyway, so taking a
//     hit there costs nothing real.
//   • Lethal on a regular hero (not the only living) → expensive, but
//     fine if the alternative is the only-hero lethal trap.
//   • Non-lethal on a hero → priced by HP lost; doomed heroes again
//     nearly free; live heroes take a hit to their post-damage HP.
//   • Creatures → cheap compared to hero loss; creatures that die from
//     the damage cost a bit more than survivors, but far less than a
//     live hero kill.
function pickSelfDamageTarget(engine, ownTargets, config) {
  if (!ownTargets || ownTargets.length === 0) return null;
  const gs = engine.gs;
  const damage = Number(config.damage ?? config.baseDamage ?? 0) || 0;
  const cardDB = engine._getCardDB();

  // Helper: living own heroes count (for game-loss detection on hero kills).
  const livingHeroCount = (pi) => {
    const ps = gs.players[pi];
    return (ps?.heroes || []).filter(h => h?.name && h.hp > 0).length;
  };

  const score = (t) => {
    if (t.type === 'hero') {
      const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero) return Infinity;
      const doomed = hero._forceKillAtTurnEnd === gs.turn;
      const lethal = damage > 0 && hero.hp > 0 && hero.hp <= damage;
      if (lethal) {
        // Would this kill leave 0 living own heroes? That's a loss
        // condition on our own turn — never pick.
        if (livingHeroCount(t.owner) <= 1) return Infinity;
        // Doomed heroes die at End Phase anyway — cheap to sacrifice now.
        if (doomed) return 10;
        // Regular hero kill: very expensive, but not game-ending.
        return 600;
      }
      // Non-lethal hit.
      if (doomed) {
        // Partial damage to a hero that's already on a death timer.
        // Almost free — the only downside is losing their End-Phase
        // Adventurousness / onTurnEnd utility. Give it a small cost.
        return 20;
      }
      // Live hero takes non-lethal damage. Prefer higher-HP heroes so
      // we keep the low-HP ones safer. Cost scales with post-hit
      // vulnerability.
      const postHp = hero.hp - damage;
      // 200 base + "how close to death are we now" bonus up to +150.
      return 200 + Math.max(0, 150 - Math.floor(postHp / 2));
    }
    // Creatures + equipment-creatures
    const inst = t.cardInstance;
    if (!inst) return 1000;
    const cd = cardDB[inst.name];
    const maxHp = inst.counters?.maxHp ?? cd?.hp ?? 0;
    const currentHp = inst.counters?.currentHp ?? maxHp;
    const lethal = damage > 0 && currentHp <= damage;
    // Creatures are far cheaper than hero kills — worst case ~120.
    return lethal ? 120 : 50;
  };

  const scored = ownTargets.map(t => ({ t, s: score(t) }));
  scored.sort((a, b) => a.s - b.s);
  // If every candidate is Infinity (every pick ends the game), there's
  // nothing we can do cleanly — fall back to `null` and let the caller
  // (or the default ally-fallback) pick something. A forced pick is a
  // forced pick; at least this path doesn't pretend the trap is safe.
  if (!scored.length || scored[0].s === Infinity) return null;
  return scored[0].t;
}

function pickBuffTarget(engine, ownTargets, cardName) {
  if (!ownTargets.length) return null;
  // Drop `cpuMeta.preferDead` creatures (Cute Cat etc.) — the CPU
  // never buffs creatures that want to die. Heroes are unaffected.
  const filtered = ownTargets.filter(t => !targetIsPreferDead(engine, t));
  if (!filtered.length) return null;
  // Prefer Hero targets; de-prioritize targets already carrying the buff
  // (naive check by card name in their counters).
  const heroes = filtered.filter(t => t.type === 'hero');
  const creatures = filtered.filter(t => t.type !== 'hero');
  const pool = heroes.length ? heroes : creatures;
  const withoutBuff = pool.filter(t => !targetHasBuff(engine, t, cardName));
  const final = withoutBuff.length ? withoutBuff : pool;
  // Ascended / Ascendable heroes get the buff / shield / protection first
  // — these are the deck's plan pieces and the most important to keep
  // alive & functional. Fall through to the regular random pick only when
  // no Ascended candidate is in the pool.
  const ascended = final.filter(t => targetIsAscendedOrAscendableHero(engine, t));
  if (ascended.length) return randomOf(ascended);
  return randomOf(final);
}

// ─── Helpers for targeting ────────────────────────────────────────────

function randomOf(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function findSupportInstance(engine, t) {
  if (!t || t.owner == null || t.heroIdx == null || t.slotIdx == null) return null;
  return engine.cardInstances.find(c =>
    c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
  ) || null;
}

function creatureCurrentHp(engine, inst, t) {
  if (inst) {
    const cd = engine.getEffectiveCardData(inst);
    if (cd?.hp != null) {
      const dmg = inst.counters?.damageTaken || 0;
      return Math.max(0, cd.hp - dmg);
    }
  }
  if (t?.cardName) {
    const cd = engine._getCardDB()[t.cardName];
    if (cd?.hp != null) return cd.hp;
  }
  return null;
}

function heroHasAttachment(engine, t, attachmentName) {
  if (t?.type !== 'hero') return false;
  const ps = engine.gs.players[t.owner];
  const zones = ps?.supportZones?.[t.heroIdx] || [];
  for (const slot of zones) {
    if ((slot || []).includes(attachmentName)) return true;
  }
  return false;
}

/**
 * Generic "any heal on this Hero is applied as damage instead" check.
 * The Overheal Shock attachment stamps the `healReversed` status on
 * its target Hero (cleared on leave-zone); any future heal-reversal
 * effect that uses the same status flows through this predicate
 * without per-card CPU code. Used by heal-target pickers to
 * (a) prefer enemy heroes (lethal heal) and (b) skip own heroes.
 */
function heroHealReversed(engine, t) {
  if (t?.type !== 'hero') return false;
  const hero = engine.gs.players?.[t.owner]?.heroes?.[t.heroIdx];
  return !!hero?.statuses?.healReversed;
}

/**
 * Creature whose card script declares `cpuMeta.preferDead: true` —
 * the CPU should NEVER spend defensive resources (heal, cleanse,
 * buff) on it. Cute Cat is the prototype: its on-summon self-discard
 * is the whole point of the card, so any "save it" play is wasted
 * tempo on a creature that wants to die. Future revival /
 * sacrifice-engine creatures opt in the same way.
 */
function targetIsPreferDead(engine, t) {
  if (!t || (t.type !== 'creature' && t.type !== 'equip')) return false;
  const inst = t.cardInstance || findSupportInstance(engine, t);
  if (!inst) return false;
  const script = loadCardEffect(inst.name);
  return script?.cpuMeta?.preferDead === true;
}

/**
 * Generic heal-target priority hint. Walks the target Hero's support
 * zones; any attached card whose script exports
 * `cpuMeta.isHealTargetFresh(engine, inst)` and returns true makes
 * this Hero a top-priority heal target — healing it will fire that
 * support card's afterHeal trigger. Canonical user: Lifeforce
 * Howitzer (its once-per-turn afterHeal still available).
 */
function targetHasFreshLifeforceHowitzer(engine, t) {
  if (t?.type !== 'hero') return false;
  const ps = engine.gs.players[t.owner];
  const zones = ps?.supportZones?.[t.heroIdx] || [];
  for (let z = 0; z < zones.length; z++) {
    for (const cardName of (zones[z] || [])) {
      const script = loadCardEffect(cardName);
      const probe = script?.cpuMeta?.isHealTargetFresh;
      if (typeof probe !== 'function') continue;
      const inst = engine.cardInstances.find(c =>
        c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx
        && c.zoneSlot === z && c.name === cardName
      );
      if (!inst) continue;
      try { if (probe(engine, inst)) return true; } catch { /* ignore */ }
    }
  }
  return false;
}

function targetHasBuff(engine, t, cardName) {
  if (!cardName) return false;
  if (t?.type === 'hero') {
    const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (h?.buffs && h.buffs[cardName]) return true;
    if (h?.counters && h.counters[cardName]) return true;
  }
  // Creature-side buffs: check instance counters.
  const inst = t.cardInstance || findSupportInstance(engine, t);
  if (inst?.counters?.buffs?.[cardName]) return true;
  return false;
}

function hasHealableOwnTarget(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  const ps = engine.gs.players[cpuIdx];
  // Any alive hero missing HP?
  for (const h of (ps?.heroes || [])) {
    if (h?.name && h.hp > 0 && h.hp < h.maxHp) return true;
  }
  // Any own creature missing HP?
  for (let hi = 0; hi < (ps?.supportZones || []).length; hi++) {
    for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
      const inst = engine.cardInstances.find(c =>
        c.owner === cpuIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
      );
      if (!inst) continue;
      const cd = engine.getEffectiveCardData(inst);
      if (cd?.hp && (inst.counters?.damageTaken || 0) > 0) return true;
    }
  }
  return false;
}

/**
 * True when the CPU controls at least one Hero or Creature with a
 * cleansable negative status (Frozen / Stunned / Burned / Poisoned /
 * Bound). Distinct from `hasHealableOwnTarget` which gates HP-healing
 * cards — Juice and friends remove STATUSES, not HP, so the HP-based
 * gate would let the CPU play Juice on a target with full HP and no
 * status (the user-reported "0 effect" misplay).
 */
function hasCleansableOwnTarget(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  const ps = engine.gs.players[cpuIdx];
  const { getCleansableStatuses } = require('./_hooks');
  const negKeys = getCleansableStatuses();
  for (const h of (ps?.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses && negKeys.some(k => h.statuses[k])) return true;
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== cpuIdx) continue;
    if (negKeys.some(k => inst.counters?.[k])) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
//  MCTS — 1-ply action evaluator
//  For each candidate action, run N rollouts (apply → play to turn end
//  → evaluate → restore). Rank candidates by average score, pick best.
//  Currently wired into the Action Phase card pick only; expandable to
//  any decision point.
// ═══════════════════════════════════════════════════════════════════════

const MCTS_ENABLED = true;
// Dropped 5 → 3 with the multi-turn rollout extension (opp's full turn is
// simulated after ours). Per-rollout cost roughly tripled; cutting rollout
// count by 40% keeps total Action-Phase budget close to pre-extension.
const MCTS_ROLLOUTS_PER_CANDIDATE = 3;
// Rollout turn horizon. Number of FULL simulated turns after our current
// turn's rest-of-play. 0 = no extension. 1 = opp's full turn. 2 = our
// next full turn too. 3 = opp again. 4 = us again. Each +1 adds ~one
// full turn of simulated play cost per rollout.
//
// Default 6 (≈ rest-of-current + 6 full turns ≈ 7 turns of look-ahead) —
// an average Pixel Parties match runs ~5 turns per side / 10 total, so
// 7-turn lookahead covers more than half the game and makes the CPU
// see end-game pressure (deck-out, ascension windows, hero death
// timing) instead of greedily optimising the next exchange.
let _rolloutHorizon = 6;
function setRolloutHorizon(h) {
  // Cap at 12 (≈ a whole long match) — going higher rarely improves
  // decisions because the rollout's policy is one-ply greedy past
  // turn 1 anyway, and snapshot pressure scales linearly per horizon.
  if (Number.isInteger(h) && h >= 0 && h <= 12) _rolloutHorizon = h;
}
function getRolloutHorizon() { return _rolloutHorizon; }

// Rollout policy: controls how the CPU picks Action-Phase candidates
// when running INSIDE a multi-turn rollout (the recursive runCpuTurn
// calls for opp's turn and our next turn).
//   'heuristic' = simple type priority (Creature > Spell > Attack) + level.
//                 Cheap, fast, but can't see synergies (casts Creature
//                 before Heal even when OHS is on the enemy).
//   'evalGreedy' = for each candidate, tentatively apply + evaluate + undo.
//                  Pick the highest-scoring. Orders of magnitude smarter —
//                  lets the rollout actually discover combos at the cost
//                  of O(candidates) extra snapshot/evaluate per decision.
// A/B validated as 'evalGreedy' (h=2 23.3% WR vs heuristic 3.3% on the
// Heal Burn / Spell Industrialization matchup).
let _rolloutBrain = 'evalGreedy';
function setRolloutBrain(b) {
  if (b === 'heuristic' || b === 'evalGreedy') _rolloutBrain = b;
}
function getRolloutBrain() { return _rolloutBrain; }

// Hard per-decision wall-clock cap. Some combos of decks (e.g. Heal Burn
// vs Butterflies) produce pathological Action-Phase turns where each
// rollout plays through long heal/ascension chains — without this cap a
// single decision could run for minutes while the watchdog sees gs.turn
// unchanged and never aborts. On timeout, mctsRankCandidates returns the
// best-scored candidates so far (or falls back to heuristic if none).
//
// Bumped 10s → 20s to absorb the deeper rollout horizon (default h=6
// triples the per-rollout cost vs h=2). Most decisions still finish
// well under this; the cap only matters on heavy-board, many-candidate
// turns where the extra wall-clock buys a noticeably better pick.
//
// PP_MCTS_BUDGET_MS / PP_MCTS_PULLS: env overrides for batch training
// (PP_TRAIN mode), where per-game throughput matters more than squeezing
// the last few points of decision quality out of each turn. Read once at
// module load; live games simply don't set them.
const MCTS_RANK_BUDGET_MS = parseInt(process.env.PP_MCTS_BUDGET_MS || '20000', 10);
// UCB1 total-pull cap per decision. Hard ceiling on how many rollouts a
// single decision can burn; typically cut short by the wall-clock budget.
const MCTS_UCB1_TOTAL_PULLS = parseInt(process.env.PP_MCTS_PULLS || '80', 10);
// UCB1 exploration constant. √2 is the textbook default. Higher = more
// exploration (visit undervisited arms), lower = more exploitation.
const MCTS_UCB1_EXPLORE_C = 1.414;
// Deck-Nähe-Eval (Deckout-Prävention): Default-Schwelle wenn kein
// Profil eine gelernte deckoutDangerSize liefert, und die quadratische
// Eskalation (Malus = (th−deck)² × K in Eval-Punkten; bei th=8 also
// −8 bei Deck=7 … −512 bei Deck=0 — im Bereich echter Board-Swings).
const DECKOUT_EVAL_TH_DEFAULT = 8;
const DECKOUT_EVAL_K = parseFloat(process.env.PP_DECKPROX_K || '8');

// ── Eigener Angriffswert (siehe evaluateState) ──────────────────────
// HP-äquivalentes Gewicht je verfügbarem ATK-Umsetzer und Deckel auf die
// Zahl der gezählten Umsetzer. Bewusst konservativ: bei 3 Umsetzern und
// 250 ATK trägt der Term 262 Punkte, bleibt also unter dem ±500-KO-Term.
// Abschalter für A/B-Läufe: PP_ATK_EVAL_K=0.
const ATK_EVAL_PER_CONVERSION = parseFloat(process.env.PP_ATK_EVAL_K || '0.35');
const ATK_EVAL_MAX_CONVERSIONS = 3;
// ── PUCT-Prior-Einfluss ──
// Profil-cardValues fließen als VERBLASSENDE Startgewichte in die
// Kandidaten-Exploration: prior×SCALE/(1+visits). Bei visits=0 lenkt
// das Profil, welche Arme zuerst gezogen werden (bei knappem Budget
// entscheidet das, was überhaupt evaluiert wird); mit jedem Pull
// übernimmt die gemessene Evidenz (Q-Term). Ein falsches Profil wird
// so vom Suchbaum ÜBERSTIMMT statt blind befolgt — der strukturelle
// Fix für die "toxische Priors"-Falle. Skala klein, weil die
// Arm-Differenzen im Q-Term typischerweise nur wenige Punkte betragen
// (vgl. MCTS_EXT_EPSILON_ABS = 3).
const MCTS_PUCT_SCALE = parseFloat(process.env.PP_PUCT_SCALE || '0.15');
// ─── Adaptive extension phase ──────────────────────────────────────────
// When the regular UCB1 phase ends with the top arms still clustered
// inside the noise band, spend up to MCTS_EXT_PULLS_MAX extra rollouts
// re-pulling ONLY those clustered arms (round-robin by lowest visits)
// so the cluster either resolves to a clear winner or gets averaged
// flat. Prevents the "noise picks the loser" failure mode where a
// genuinely-better arm is within 1-2 points of the runner-up after
// the standard pulls and stable-sort decides via input order. Capped
// so a perpetually-tied cluster doesn't bleed wall-clock on
// diminishing-returns resampling — once the cap is hit, the
// deterministic tiebreaker (e.g. casterAtk for Attack candidates)
// takes over.
const MCTS_EXT_PULLS_MAX = 60;
// Noise band for cluster detection. Same shape as the final-sort
// epsilon — max(absolute, percentage) of the top arm's avg. Arms
// within this band of the leader are considered "clustered" and
// eligible for extension pulls.
const MCTS_EXT_EPSILON_ABS = 3;
const MCTS_EXT_EPSILON_PCT = 0.01;
// Late-game bypass: past this turn count, skip MCTS and fall through to the
// heuristic sort / direct activation. A "normal" Pixel Parties match runs
// ~5 turns per side (10 total), so 51 is well past any honest decision
// horizon — the bypass exists to escape pathological attritional stalls
// (Heal Burn vs Lightning Caller, etc.) where MCTS's snapshot storm would
// outrun GC and crash the process. At 50+ turns the rollout cost vs
// marginal decision quality has long since inverted; the heuristic sort
// is the right answer. Threshold is "turn ≥ N skips" — turn 50 still uses
// MCTS, turn 51 onwards is heuristic-only.
const MCTS_LATE_GAME_TURN_THRESHOLD = 51;

// ═══════════════════════════════════════════════════════════════════════
//  DYNAMIC HERO / CREATURE TRACKING
//  Captures HOW each unit has been used so far this game (spells cast,
//  damage dealt, summon cadence, value generated last turn). Wired in
//  via `installCpuBrain` which wraps `engine.runHooks` to capture the
//  relevant signals as the engine fires its existing hook events. Lives
//  on `hero._cpuStats` and `inst.counters._cpuStats` so engine.snapshot/
//  restore preserves it across MCTS rollouts (rollouts can mutate the
//  cloned copies; the live values resume after restore).
// ═══════════════════════════════════════════════════════════════════════

function ensureHeroCpuStats(hero) {
  if (!hero) return null;
  if (!hero._cpuStats) {
    hero._cpuStats = {
      spellsCast: 0,
      spellLevelsTotal: 0,
      attackDamageThisTurn: 0,
      attackDamageLastTurn: 0,
      attackDamageTotal: 0,
      // Kill counters — incremented when this hero's damage drops a
      // target to 0. `heroKills` is the strongest carry signal we
      // track; `creatureKills` is the secondary cleaner signal. These
      // are cumulative for the whole game so a hero who killed the
      // opponent's main carry on turn 5 is still flagged as high-value
      // on turn 12 even after several quiet turns.
      heroKills: 0,
      creatureKills: 0,
      // Aggregated "value generated" per turn — damage / draws caused / gold
      // earned attributed to this hero. Used by the dynamic valuation to
      // tell apart a deadweight hero from one that produced real swing
      // on the previous turn.
      valueThisTurn: 0,
      valueLastTurn: 0,
      lastSummonTurn: -1,
      summonsThisGame: 0,
    };
  }
  return hero._cpuStats;
}

function ensureCreatureCpuStats(inst) {
  if (!inst) return null;
  if (!inst.counters) inst.counters = {};
  if (!inst.counters._cpuStats) {
    inst.counters._cpuStats = {
      damageThisTurn: 0,
      damageLastTurn: 0,
      valueThisTurn: 0,
      valueLastTurn: 0,
      summonedOnTurn: null,
    };
  }
  return inst.counters._cpuStats;
}

/**
 * Roll over current-turn deltas into "last turn" fields. Called when the
 * engine fires `onTurnEnd` so the next eval pass sees deltas for the
 * turn that just finished, not for an arbitrary mid-turn slice.
 */
function rolloverPerTurnStats(engine) {
  const gs = engine.gs;
  if (!gs?.players) return;
  for (const ps of gs.players) {
    for (const h of (ps.heroes || [])) {
      const s = h?._cpuStats;
      if (!s) continue;
      s.attackDamageLastTurn = s.attackDamageThisTurn;
      s.attackDamageThisTurn = 0;
      s.valueLastTurn = s.valueThisTurn;
      s.valueThisTurn = 0;
    }
  }
  for (const inst of (engine.cardInstances || [])) {
    const s = inst.counters?._cpuStats;
    if (!s) continue;
    s.damageLastTurn = s.damageThisTurn;
    s.damageThisTurn = 0;
    s.valueLastTurn = s.valueThisTurn;
    s.valueThisTurn = 0;
  }
}

/**
 * Attribute `dealt` damage to source's hero/creature. Source object comes
 * from actionDealDamage / actionDealCreatureDamage — fields used:
 *   • source.owner / source.controller — player index of the source
 *   • source.heroIdx — hero index when the source is hero/ability/equip
 *   • source.id + source.zone === 'support' — when source is a creature
 *     instance, attribute to the creature too
 * `targetSide` is the player index whose unit took the hit, so we can
 * skip self-damage (Fire Bolts recoil) which we don't want counted.
 */
function recordDamageDealt(engine, source, dealt, targetSide) {
  if (!dealt || dealt <= 0) return;
  if (!source) return;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner < 0) return;
  if (targetSide === srcOwner) return; // own-side damage doesn't count as offense

  // Source is a creature instance on the support zone — credit goes to the
  // creature itself (the host hero shouldn't double-collect for what its
  // creature did). Tracked instances always carry an `id` plus a zone of
  // 'support', so this check is a clean "is this a tracked CardInstance?".
  const isCreatureSource = source.id != null && source.zone === 'support';
  if (isCreatureSource) {
    const stats = ensureCreatureCpuStats(source);
    if (stats) {
      stats.damageThisTurn += dealt;
      stats.valueThisTurn += dealt * 0.5;
    }
    return;
  }

  // Hero-initiated damage (own Spell/Attack/Hero-Effect/Equip-Effect with
  // hero attribution). `srcHi` is the casting hero; credit damage there.
  const srcHi = source.heroIdx;
  const hero = (srcHi != null && srcHi >= 0)
    ? engine.gs.players[srcOwner]?.heroes?.[srcHi]
    : null;
  if (hero?.name) {
    const stats = ensureHeroCpuStats(hero);
    stats.attackDamageThisTurn += dealt;
    stats.attackDamageTotal += dealt;
    stats.valueThisTurn += dealt * 0.5;
  }
}

/**
 * Attribute a spell cast to its caster hero. Called from the wrapper
 * around `runHooks('afterSpellResolved', ctx)` — `ctx.casterIdx` and
 * `ctx.heroIdx` identify the caster, and `ctx.spellCardData.level`
 * gives the spell's level. We skip Attack-card "spells" (those use the
 * same hook path but aren't really Spells the user reasons about).
 */
/**
 * Attribute a kill to its source hero. Called from the runHooks
 * observer right after `afterDamage` / `afterCreatureDamageBatch`
 * detects that the damaged target is now at 0 HP. Mirrors the
 * `recordDamageDealt` attribution logic — credit goes to the
 * casting hero, NOT the attacking creature's host. `kind` is
 * 'hero' or 'creature'; the dynamic value formula weights hero
 * kills more heavily because they're a larger swing event.
 */
function recordKill(engine, source, kind, targetSide) {
  if (!source) return;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner < 0) return;
  if (targetSide === srcOwner) return; // own-side kill (shouldn't happen normally)
  // Creature-instance source — kills attributed to the creature, not
  // the hero hosting it. Currently no-op (creature stats don't track
  // kills); kept here so the structure mirrors recordDamageDealt and
  // can be extended later if "creature that wiped out a hero" turns
  // out to be a useful signal.
  const isCreatureSource = source.id != null && source.zone === 'support';
  if (isCreatureSource) return;
  const srcHi = source.heroIdx;
  if (srcHi == null || srcHi < 0) return;
  const hero = engine.gs.players[srcOwner]?.heroes?.[srcHi];
  if (!hero?.name) return;
  const stats = ensureHeroCpuStats(hero);
  if (kind === 'hero') stats.heroKills++;
  else if (kind === 'creature') stats.creatureKills++;
}

function recordSpellCast(engine, casterIdx, heroIdx, spellCardData) {
  if (casterIdx == null || casterIdx < 0) return;
  if (heroIdx == null || heroIdx < 0) return;
  if (!spellCardData) return;
  if (spellCardData.cardType !== 'Spell') return;
  const hero = engine.gs.players[casterIdx]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  const stats = ensureHeroCpuStats(hero);
  stats.spellsCast++;
  stats.spellLevelsTotal += (spellCardData.level || 0);
  // Casting spells generates "value" — fold the level into the per-turn
  // accumulator so a hero that just cast a Lv5 spell registers as more
  // valuable than one that just cast a Lv1.
  stats.valueThisTurn += (spellCardData.level || 0) * 8;
}

/**
 * Fold a draws/gold gain at the player level into per-hero "value
 * generated" buckets. We don't have per-hero attribution for these
 * generic sources, so the accumulator is split across the player's
 * draw/gold-yielding heroes weighted by their declared supportYield.
 * When no hero declares a yield, the value is dropped (we can't tell
 * who deserves it). `kind` is 'draw' (1 unit each) or 'gold' (per gold).
 */
function attributeAggregateValue(engine, pi, kind, amount) {
  if (!amount || amount <= 0) return;
  const ps = engine.gs.players[pi];
  if (!ps) return;
  // Weights: draw worth 15 value-units, gold worth 2 value-units each.
  // Roughly comparable to how the existing evaluator weights each
  // resource (avg card ~15 score, gold-on-demand ~2× gold).
  const valuePerUnit = kind === 'gold' ? 2 : kind === 'draw' ? 15 : 0;
  if (valuePerUnit <= 0) return;
  const totalValue = amount * valuePerUnit;

  const yields = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const ctx = { engine, pi, hi, cpuIdx: engine._cpuPlayerIdx };
    let drawWeight = 0, goldWeight = 0;
    const apply = (y) => {
      if (!y) return;
      drawWeight += (y.drawsPerTurn || 0) + (y.potionDrawsPerTurn || 0) * 3;
      goldWeight += y.goldPerTurn || 0;
    };
    const heroScript = loadCardEffect(hero.name);
    if (typeof heroScript?.supportYield === 'function') {
      try { apply(heroScript.supportYield(ctx)); } catch {}
    }
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const abScript = loadCardEffect(slot[0]);
      if (typeof abScript?.supportYield !== 'function') continue;
      try { apply(abScript.supportYield(slot.length, ctx)); } catch {}
    }
    const w = kind === 'gold' ? goldWeight : drawWeight;
    if (w > 0) yields.push({ hi, w });
  }
  if (yields.length === 0) return;
  const totalW = yields.reduce((s, y) => s + y.w, 0);
  if (!(totalW > 0)) return;
  for (const y of yields) {
    const share = (y.w / totalW) * totalValue;
    const hero = ps.heroes[y.hi];
    if (!hero) continue;
    const stats = ensureHeroCpuStats(hero);
    stats.valueThisTurn += share;
  }
}

// ─── Dynamic valuation ────────────────────────────────────────────────
// Builds on the existing static threat (atk, school level, supportYield)
// by layering in the live game history captured above. Used to weight
// enemy HP in the evaluator and to score targets when the CPU picks
// who to damage with an offensive Spell/Attack/Potion.

const SPELL_SCHOOL_ROLE_TAG_PREFIX = 'caster:';

/**
 * Tag the role(s) this hero fills for redundancy detection. A hero
 * tagged "caster:Destruction Magic" duplicates another caster of the
 * same school; "supporter" duplicates any draw/gold engine; etc.
 */
function mctsHeroRoleTags(engine, oppIdx, hi) {
  const tags = new Set();
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return tags;

  // Schools the hero can cast at level ≥ 1 — anything castable counts as
  // "caster-of-school" because the user explicitly mentioned that another
  // hero "capable of casting Spells of the same or even higher levels"
  // makes the original caster redundant.
  const abZones = ps.abilityZones?.[hi] || [];
  const schoolLevels = {};
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
      schoolLevels[slot[0]] = Math.max(schoolLevels[slot[0]] || 0, slot.length);
    }
  }
  for (const sc of Object.keys(schoolLevels)) {
    tags.add(SPELL_SCHOOL_ROLE_TAG_PREFIX + sc);
  }
  if (schoolLevels['Summoning Magic']) tags.add('summoner');

  const { supportUnits, damagePerTurn } = mctsHeroSupportDetails(engine, oppIdx, hi);
  if (supportUnits >= 1) tags.add('supporter');
  if (damagePerTurn > 0) tags.add('damage_supporter');
  if ((hero.atk || 0) >= 130) tags.add('attacker');

  // Game-history-derived tags.
  const stats = hero._cpuStats;
  if (stats && stats.spellsCast >= 2) tags.add('active_caster');
  if (stats && (stats.attackDamageLastTurn || 0) >= 60) tags.add('active_attacker');

  return tags;
}

/**
 * Schools where another LIVING hero can match or exceed this hero's
 * spell-school level. When the user's spec says "their other hero can
 * cast the same or higher Spells", picking off this hero is a softer
 * blow than killing the team's only carry of that school.
 */
function mctsCasterIsCovered(engine, oppIdx, hi) {
  const ps = engine.gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return false;
  const myAbZones = ps.abilityZones?.[hi] || [];
  const mySchoolLevels = {};
  for (const slot of myAbZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
      mySchoolLevels[slot[0]] = Math.max(mySchoolLevels[slot[0]] || 0, slot.length);
    }
  }
  if (Object.keys(mySchoolLevels).length === 0) return false;

  for (let other = 0; other < (ps.heroes || []).length; other++) {
    if (other === hi) continue;
    const oh = ps.heroes[other];
    if (!oh?.name || oh.hp <= 0) continue;
    const oZones = ps.abilityZones?.[other] || [];
    for (const slot of oZones) {
      if (!slot || slot.length === 0) continue;
      if (!SPELL_SCHOOL_ABILITIES.has(slot[0])) continue;
      // Same school + matching/higher level = full coverage of that school.
      if (mySchoolLevels[slot[0]] != null && slot.length >= mySchoolLevels[slot[0]]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Discount (in threat units) for redundancy with same-side teammates.
 * Each living teammate that shares a role tag adds up to ~0.5 of
 * discount, capped at 1.0 total. Using a per-tag overlap check rather
 * than counting tag intersections directly keeps the discount sensible
 * even when one teammate fills multiple of the same roles.
 */
function mctsRoleRedundancyDiscount(engine, oppIdx, hi) {
  const ps = engine.gs.players[oppIdx];
  if (!ps) return 0;
  const myTags = mctsHeroRoleTags(engine, oppIdx, hi);
  if (myTags.size === 0) return 0;
  let overlapCount = 0;
  for (let other = 0; other < (ps.heroes || []).length; other++) {
    if (other === hi) continue;
    const oh = ps.heroes[other];
    if (!oh?.name || oh.hp <= 0) continue;
    const otherTags = mctsHeroRoleTags(engine, oppIdx, other);
    for (const tag of myTags) {
      if (otherTags.has(tag)) {
        overlapCount++;
        break;
      }
    }
  }
  return Math.min(1.0, overlapCount * 0.5);
}

/**
 * Combined dynamic threat multiplier for enemy hero `hi`. Replaces the
 * raw mctsEnemyHeroThreat call inside the evaluator so target-selection
 * follows the same scoring as state evaluation. Returns a multiplier on
 * the hero's HP — higher means hitting them hurts the opponent more.
 *
 * The static base (school presence, supportYield, atk) lives in the
 * existing mctsEnemyHeroThreat. This function layers on:
 *   + 0.4 × avg spell level cast (heavy spellcaster signal)
 *   + 0.05 × spells cast  (frequency)
 *   + ≤ 2.0 from attackDamageLastTurn (recent damage output)
 *   + ≤ 2.0 from cumulative attackDamageTotal (sustained-attacker
 *     signal — captures a carry who's quiet THIS turn but has been
 *     hammering the CPU all game)
 *   + ≤ 2.5 from heroKills, ≤ 1.0 from creatureKills (impact —
 *     a hero who has actually KO'd one of our pieces is the priority
 *     remove regardless of last-turn activity)
 *   + ≤ 1.0 from non-creature support cards equipped on this hero
 *     (Swords, equipment artifacts, etc. — a kitted-up hero is more
 *     dangerous than a vanilla body)
 *   + ≤ 1.5 from valueLastTurn (recent broad-sense value)
 *   - up to 0.6 if a summoner has all support zones full AND didn't
 *     summon last turn (their effect is parked for now)
 *   - up to 1.0 from same-role redundancy with living teammates
 *   - up to 0.6 if another teammate already covers their highest school
 */

/**
 * Feindliches Anhaengsel? — generischer Karten-Vertrag
 * `cpuMeta.hostileAttachment: true`.
 *
 * Bedeutung: Die Karte liegt in der Support Zone eines Helden, gehoert
 * aber der GEGENSEITE und arbeitet gegen den Wirt (Overheal Shock:
 * Heilung wird zu Schaden). Fuer die Bewertung heisst das zweierlei:
 *
 *   • sie ist keine Ausruestung des Wirts (mctsEnemyHeroDynamicValue),
 *   • sie ist kein Brett-Besitz des Wirts (Slot-Term in evaluateState).
 *
 * Der EIGENE Wert der Karte gehoert nicht hierher — den meldet das
 * Kartenskript ueber `cpuMeta.cpuInstBonus`. Saubere Trennung: dieser
 * Schalter raeumt nur die falschen Vorzeichen weg, er vergibt keine
 * Punkte.
 */
function isHostileAttachment(cardName) {
  if (!cardName) return false;
  try {
    return !!loadCardEffect(cardName)?.cpuMeta?.hostileAttachment;
  } catch { return false; }
}

function mctsEnemyHeroDynamicValue(engine, oppIdx, hi, teamMaxSchoolLvl) {
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return 1.0;

  let value = mctsEnemyHeroThreat(engine, oppIdx, hi, teamMaxSchoolLvl);
  const stats = hero._cpuStats || null;

  if (stats) {
    if (stats.spellsCast > 0) {
      const avgLvl = stats.spellLevelsTotal / stats.spellsCast;
      value += 0.4 * avgLvl + 0.05 * Math.min(stats.spellsCast, 6);
    }
    const recentDmg = stats.attackDamageLastTurn || 0;
    if (recentDmg > 0) value += Math.min(2.0, recentDmg / 100);
    // Cumulative damage — sustained carry signal. A hero who's dealt
    // 700+ damage over the game stays a high-priority target even on
    // a quiet turn where they happened not to attack. Using a square-
    // root-ish ramp so the first 200 damage matters proportionally
    // more than the next 500 (diminishing returns).
    const totalDmg = stats.attackDamageTotal || 0;
    if (totalDmg > 0) value += Math.min(2.0, Math.sqrt(totalDmg) / 14);
    // Kill history. Hero kills swing the game far harder than
    // creature kills, so weighted asymmetrically.
    if ((stats.heroKills || 0) > 0) value += Math.min(2.5, stats.heroKills * 1.0);
    if ((stats.creatureKills || 0) > 0) value += Math.min(1.0, stats.creatureKills * 0.25);
    const recentValue = stats.valueLastTurn || 0;
    if (recentValue > 0) value += Math.min(1.5, recentValue * 0.005);
  }

  // Equipment / kit bonus. Counts non-Creature cards in the hero's
  // own support zones — Swords, weapon artifacts, attachments. An
  // equipped hero with even one weapon is a notably bigger threat
  // than the same hero with nothing on them. Equipment-Creatures
  // (Pollution Spewer-style hybrids) and pure Creatures don't count
  // here — they're tracked separately as board presence. Feindliche
  // Anhaengsel (`cpuMeta.hostileAttachment`) sind ausgenommen.
  const supportZones = ps.supportZones?.[hi] || [];
  let equipCount = 0;
  if (supportZones.length > 0) {
    const cardDB = engine._getCardDB();
    for (const slot of supportZones) {
      for (const cardName of (slot || [])) {
        const cd = cardDB[cardName];
        if (!cd) continue;
        // Skip Creatures (including Artifact-Creature hybrids) — they
        // contribute via creature valuation, not equipment.
        if (cd.cardType === 'Creature') continue;
        if (cd.cardType === 'Artifact' && (cd.subtype || '').toLowerCase() === 'creature') continue;
        // ── Feindliche Anhaengsel zaehlen NICHT als Ausruestung ────────
        // Gemessen an Overheal Shock: die Karte liegt zwar in der
        // Support Zone des Wirts, gehoert aber dem ANGREIFER und
        // schadet dem Wirt. Sie hier mitzuzaehlen hob die Bedrohung des
        // Wirts um 0.4 — bei 450 HP entsprach das 180 Eval-Punkten
        // GEGEN den Angreifer. Die Karte anzuhaengen kostete dadurch
        // 215 Punkte, sie abzuwerfen nur 25: die CPU warf sie
        // folgerichtig lieber ab. Generischer Vertrag statt by-name:
        // `cpuMeta.hostileAttachment` (siehe auch die Slot-Bewertung in
        // evaluateState, die dieselbe Kennzeichnung liest).
        if (isHostileAttachment(cardName)) continue;
        equipCount++;
      }
    }
  }
  if (equipCount > 0) value += Math.min(1.0, equipCount * 0.4);

  // ── Demand-weighted gold engine ──────────────────────────────────────
  // The static threat above already added a flat
  //   0.25 × SUPPORT_UNIT_WEIGHTS.gold × goldYield
  // contribution from this hero's gold supportYield (Trade, Wealth,
  // Adventurousness, Semi, Fiona, …). That assumes every gold/turn
  // is equally valuable, which is wrong: gold engines on a hoarder
  // (already saving 15+ each turn, nothing in hand to spend on) are
  // near-worthless to remove, while the same engine on an opponent
  // who spends every coin and has unplayed artifacts in hand is
  // critical. We rescale the gold portion by the demand-aware
  // multiplier — only for POSITIVE goldYield (gold makers). Gold
  // SINKS (Alchemy's −cost) leave the static math alone; their value
  // is already dominated by their potion-draw side and the user
  // spec's "gold gain valuation" is about the maker side.
  const { goldYield } = mctsHeroSupportDetails(engine, oppIdx, hi);
  if (goldYield > 0) {
    const flatStaticGold = 0.25 * SUPPORT_UNIT_WEIGHTS.gold * goldYield;
    const econMult = mctsOpponentGoldEconomy(engine, oppIdx);
    // Adjust toward the demand-aware weighting. econMult=1 → no change;
    // econMult<1 → subtract from the flat baseline (saturated opp);
    // econMult>1 → add to it (starved opp). Bounded by mctsOpponent-
    // GoldEconomy's own [0.3, 1.8] range, so the swing on this hero
    // is at most ±80% of the original gold contribution.
    value += flatStaticGold * (econMult - 1);
  }

  // Summoner-with-no-room discount. Only matters when the hero has
  // Summoning Magic AND every support zone is occupied AND the hero
  // didn't just summon last turn (a fresh chain of summons projects
  // continued threat — full zones immediately after summoning means
  // the threat is still LIVE).
  const myTags = mctsHeroRoleTags(engine, oppIdx, hi);
  if (myTags.has('summoner')) {
    const supportZones = ps.supportZones?.[hi] || [[], [], []];
    const allFull = supportZones.length > 0 && supportZones.every(z => (z || []).length > 0);
    const summonedRecently = stats && stats.lastSummonTurn === gs.turn - 1;
    if (allFull && !summonedRecently) value -= 0.6;
  }

  // Redundancy: same-role teammates dilute the loss.
  value -= mctsRoleRedundancyDiscount(engine, oppIdx, hi);

  // Caster-coverage: if another teammate can already cast same-or-higher
  // spells of this hero's main school, this hero is partially fungible.
  if (mctsCasterIsCovered(engine, oppIdx, hi)) value -= 0.6;

  // ── Spent one-shot effect ─────────────────────────────────────────────
  // Some heroes carry a single very strong turn-1 effect (Willy's Draw 5
  // / Gain 30, Barker's free Lv ≤ 1 summon, …) and once that's fired
  // they're effectively a generic body — the abilities they host still
  // matter (and feed the school/support tracks above) but the hero's own
  // contribution is mostly gone. Heavy flat discount so the CPU doesn't
  // burn 200-damage spells on a spent Willy when a live carry is also
  // available. Hero scripts opt in via `cpuMeta.oneShotEffectSpent`.
  const heroScript = loadCardEffect(hero.name);
  const oneShotSpent = heroScript?.cpuMeta?.oneShotEffectSpent;
  if (typeof oneShotSpent === 'function') {
    const heroInst = engine.cardInstances.find(c =>
      c.owner === oppIdx && c.zone === 'hero' && c.heroIdx === hi
    );
    try {
      if (oneShotSpent(engine, oppIdx, hi, hero, heroInst)) value -= 1.5;
    } catch { /* swallow — observer must not break eval */ }
  }

  return Math.max(0.5, value);
}

/**
 * Threat multiplier on an opponent's Creature/Equipment-creature target.
 * Built around level + recent damage + last-turn value, minus an
 * on-death-fuel discount so we don't gleefully kill creatures that
 * fuel the opponent's chains (Hell Fox, Loyal Bone Dog, …).
 */
function mctsEnemyCreatureValue(engine, inst) {
  if (!inst) return 1.0;
  const cd = engine._getCardDB()[inst.name];
  if (!cd) return 1.0;
  let value = 1.0;
  const lvl = cd.level || 0;
  if (lvl > 0) value += lvl * 0.4;
  const stats = inst.counters?._cpuStats;
  if (stats) {
    if ((stats.damageLastTurn || 0) > 0) value += Math.min(1.8, stats.damageLastTurn / 100);
    if ((stats.valueLastTurn || 0) > 0) value += Math.min(1.0, stats.valueLastTurn * 0.005);
  }
  // On-death fuel — discount.
  const script = loadCardEffect(inst.name);
  const onDeath = readOnDeathBenefit(script, engine, inst);
  if (onDeath > 0) value -= Math.min(0.7, onDeath / 30);
  // Chain sources should be killed eagerly when armed (denying their
  // window) — slight bump.
  if (script?.cpuMeta?.chainSource) value += 0.4;
  return Math.max(0.3, value);
}

// Cardinal Beast name lookup shared with `_cardinal-shared.js`. Used
// by `estimateHandCardValueFor`'s win-condition floor: when a viable
// summoner exists on the team, every Beast in hand becomes a top-tier
// tutor target.
const { CARDINAL_NAMES_SET: CARDINAL_BEAST_NAMES_FOR_HAND_VALUE } = require('./_cardinal-shared');

/**
 * Can ANY hero on `pi`'s team currently summon a Cardinal Beast (Lv5
 * Summoning Magic Creature)? Probes `heroMeetsLevelReq` with one of
 * the Beasts as the test creature — picks up Ascended Beato's
 * Lv1-99 Spell/Creature bypass, any hero that has stacked Lv5+
 * Summoning Magic, and any future hero with `bypassLevelReq` that
 * would let them host the summon. Returns false when no hero
 * qualifies (pre-Ascension Beato, deck without a summoner) so the
 * gallery picker doesn't tutor un-summonable Beasts.
 */
function canTeamSummonCardinalBeasts(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const probe = engine._getCardDB()['Cardinal Beast Baihu'];
  if (!probe) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    try {
      if (engine.heroMeetsLevelReq(pi, hi, probe)) return true;
    } catch {}
  }
  return false;
}

/**
 * Score for "how valuable would `cardName` be sitting in pi's hand right
 * now". Mirrors the in-eval logic in evaluateState's hand-value pass —
 * promoted to a top-level helper so deck-search prompts (Magnetic Glove,
 * Magnetic Potion, future tutors) can rank gallery options without
 * paying for a full state snapshot per candidate. Combines:
 *   • Affordability (cost vs current gold + 1–2 turn lookahead)
 *   • Type lock (Potion/Artifact/Creature locks zero out playability)
 *   • Tutor cap (`blockedByHandLock + resolve` — drawing a card to draw
 *     another card double-counts the second card otherwise)
 *   • Ascension-critical floor (Beato's missing-school spells, Layn's
 *     Hammer, Arthor's Sword — these are the carry pieces a tutor
 *     should always grab if available)
 *   • Duplicate penalty — drawing a second copy of a HOPT-locked /
 *     once-per-turn-relevant card is worth half.
 */
/**
 * Pick the highest-value gallery card for `pi` to tutor / select. Used
 * by both the cpuGenericChoice heuristic seed and by
 * mctsEnumerateGenericAlternatives' sort, so the variation cap of 6
 * alternatives lands on the most promising 6 cards instead of the
 * alphabetically-first 6. Scores via `estimateHandCardValueFor` with
 * a duplicate count derived from the player's CURRENT hand — drawing
 * a second copy of a card already in hand correctly drops to
 * half-value. Ties resolved randomly so the CPU isn't perfectly
 * predictable on equal-value gallery picks.
 */
function pickBestGalleryCard(engine, pi, cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const ps = engine.gs.players[pi];
  const handCounts = {};
  if (ps?.hand) {
    for (const name of ps.hand) handCounts[name] = (handCounts[name] || 0) + 1;
  }
  let best = -Infinity;
  for (const c of cards) {
    const seen = handCounts[c.name] || 0;
    const score = estimateHandCardValueFor(engine, pi, c.name, seen);
    c._galleryScore = score;
    if (score > best) best = score;
  }
  // ── Trainings-ε für Galerie-Picks (PP_GALLERY_EXPLORE, default 0.1) ─
  // Galerie-Picks hatten als einziger gelernter Kanal KEINE Exploration
  // — negative tutorPickRules unterdrückten damit exakt die Picks, die
  // Gegenevidenz erzeugen würden (selbstkonservierende Regeln, Als
  // DM-Fetch-Befund). Mit Wahrscheinlichkeit ε wird ein uniform
  // zufälliger Kandidat massiv geboostet: er gewinnt die Heuristik-
  // Auswahl UND die MCTS-Prior-Sortierung (PUCT darf per Evidenz
  // weiterhin überstimmen — "weiche" Exploration, die katastrophale
  // Picks nicht erzwingt). Nur in LIVE-Trainingsspielen.
  if (process.env.PP_TRAIN && !engine._inMctsSim && cards.length > 1) {
    const galleryEps = parseFloat(process.env.PP_GALLERY_EXPLORE || '0.1');
    if (galleryEps > 0 && Math.random() < galleryEps) {
      const c = cards[Math.floor(Math.random() * cards.length)];
      c._galleryScore += 1000;
      if (c._galleryScore > best) best = c._galleryScore;
      cpuLog(`  [explore] Galerie: Zufalls-Kandidat "${c.name}" geboostet (ε=${galleryEps})`);
    }
  }
  const top = cards.filter(c => c._galleryScore >= best - 0.01);
  const pick = top[Math.floor(Math.random() * top.length)] || cards[0];
  // Hard invariant: the returned pick MUST be one of the input cards
  // (checked by reference identity since the caller passes a fresh
  // object array per prompt). If somehow not — e.g., a future bug
  // mutates the cards array mid-pick — fall back to the first input
  // card so callers like Magic Lamp's `chosenNames.includes(picked)`
  // gate never sees a phantom card.
  if (!cards.includes(pick)) return cards[0];
  return pick;
}

// True when `pi` still has Kazena, the Storming Rebel's draw-up-to-7
// hero effect AVAILABLE and USABLE this turn. While that's the case,
// every card held in hand is one card Kazena WON'T draw (she draws
// UNTIL 7), so holding cards actively wastes her refill — the CPU
// should dump as many as possible (play them, trade them for gold via
// Treasure Chest, Play Money, etc.) BEFORE activating her. Cheap scan
// (≤3 heroes), no context allocation, safe to call per hand card.
const KAZENA_NAME = 'Kazena, the Storming Rebel';
function kazenaDrawAvailable(engine, pi) {
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  if (!ps || ps.handLocked) return false;          // canActivateHeroEffect: hand not locked
  if ((ps.hand || []).length >= 7) return false;   // canActivateHeroEffect: < 7 in hand
  const heroes = ps.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const h = heroes[hi];
    if (!h?.name || h.hp <= 0 || h.name !== KAZENA_NAME) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
    if (gs.hoptUsed?.[`hero-effect:${KAZENA_NAME}:${pi}:${hi}`] === gs.turn) continue;
    return true; // a usable Kazena whose effect hasn't fired this turn
  }
  return false;
}

// ── castGate-Revive-Awareness ────────────────────────────────────────
// Könnte ein TOTER eigener Held diese Karte casten, wenn er wiederbelebt
// würde — und liegt eine Revive-Quelle auf der Hand? Dann ist die Karte
// keine 0.15-Brick, sondern (wie beim Enabler-in-Hand-Fall) nur EINE
// Setup-Aktion entfernt: die Ankh-Linie "wiederbeleben → casten".
// Revive-Quellen: cpuMeta.reviveCard (Ankh, Resuscitation Potion,
// Divine Gifts) oder cpuMeta.canReviveDeadHero (Reincarnation — die
// wegen ihres Creature-Zweitmodus bewusst keinen reviveCard-Malus
// trägt). Elixir of Immortality zählt NICHT: es belebt nur ZUKÜNFTIGE
// Tode wieder, holt einen bereits toten Helden also nicht zurück.
// Eligibility-Probe im cpuShouldPlay-Muster: hp temporär positiv
// setzen, listEligibleHeroesForActionCard fragen, in `finally`
// restaurieren — side-effect-frei.
function deadHeroCouldCastWithReviveInHand(engine, pi, cd) {
  const ps = engine.gs?.players?.[pi];
  if (!ps?.heroes) return false;
  let hasRevive = false;
  for (const cn of (ps.hand || [])) {
    const meta = loadCardEffect(cn)?.cpuMeta;
    if (meta?.reviveCard || meta?.canReviveDeadHero) { hasRevive = true; break; }
  }
  if (!hasRevive) return false;
  for (let hi = 0; hi < ps.heroes.length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || (hero.hp ?? 0) > 0) continue;
    const savedHp = hero.hp;
    hero.hp = 100;
    let ok = false;
    try {
      ok = listEligibleHeroesForActionCard(engine, pi, cd).some(e => e.hi === hi);
    } catch { /* defensiv */ } finally {
      hero.hp = savedHp;
    }
    if (ok) return true;
  }
  return false;
}

// ── Revive-Karten-Situationslage ─────────────────────────────────────
// Für Karten mit `cpuMeta.reviveCard` (Golden Ankh, Resuscitation
// Potion, Divine Gift of Equality/Death): Gibt es überhaupt einen
// besiegten EIGENEN Helden — und bei temporären Revives
// (`cpuMeta.reviveTemporary`, Golden Ankh): hätte der Wiederbelebte in
// DIESER Runde etwas beizutragen? Letzteres fragt die side-effect-freie
// `cpuShouldPlay`-Probe des Kartenskripts (castbare Handkarte, aktiver
// Hero-Effekt, aktivierbare Ability/Creature — Als Spezifikation:
// "nur wiederbeleben, wenn es diese Runde einen Nutzen gibt"; ein
// Revive für eine Runde ohne Nutzen ist verbranntes Gold + Handkarte).
// Rückgabe `null` für alle Karten ohne das Flag (Verhalten unverändert).
// Reincarnation (Modal-Karte mit Creature-Zweitmodus) und Elixir of
// Immortality (proaktives Permanent) tragen das Flag bewusst NICHT —
// beide haben auch ohne toten Helden legitimen Wert.
function reviveCardSituation(engine, pi, cardName) {
  const script = loadCardEffect(cardName);
  if (!script?.cpuMeta?.reviveCard) return null;
  const heroes = engine.gs?.players?.[pi]?.heroes || [];
  let hasDead = false;
  for (const h of heroes) {
    if (h?.name && (h.hp ?? 0) <= 0) { hasDead = true; break; }
  }
  if (!hasDead) return { hasDead: false, useful: false };
  if (script.cpuMeta.reviveTemporary && typeof script.cpuShouldPlay === 'function') {
    let useful = false;
    // Fail-open: wirft die Probe, behandeln wir den Revive als nützlich —
    // ein fälschlicher Malus wäre schlimmer als ein fälschlicher Fetch.
    try { useful = !!script.cpuShouldPlay(engine, pi); } catch { useful = true; }
    return { hasDead: true, useful };
  }
  return { hasDead: true, useful: true };
}

// ── Ability-Such-Dringlichkeit (Spell-School-Unlock) ─────────────────
// Wie dringend braucht `pi` diese Ability GERADE, um Brick-Karten auf
// der Hand überhaupt einsetzen zu können? Zählt Handkarten
// (Spell/Attack/Creature), die diese Ability als spellSchool1/2 listen
// und aktuell von KEINEM lebenden Helden castbar sind:
//   +18 wenn EIN weiteres Level auf einem lebenden, nicht
//       frozen/stunned Helden die Karte SOFORT freischalten würde
//       (Simulation wie in scoreSpellLevelReducerUnlock: Zonen-Kopie,
//       Stack <3 erhöhen oder leeren Slot füllen, dann die
//       side-effect-freie Engine-Levelprüfung),
//   +6  für bloßen Fortschritt (Level reicht danach noch nicht).
// Cap 36, damit zwei Sofort-Unlocks eine Ability über generische
// Playables (25) heben, aber Ascension-Floor (60) und Beasts (100)
// weiter Vorrang behalten. Bewusst NUR Handkarten: die Dringlichkeit
// "Brick liegt JETZT auf der Hand" ist der situative Teil — deckweite
// Schul-Bedarfe deckt das statische Profil (cardValues/Timing) ab.
function abilitySearchUnlockBonus(engine, pi, abilityName) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  const cardDB = engine._getCardDB();
  let bonus = 0;
  const seen = new Set();
  // Simulation: Würde +1 Level dieser Ability Held `hi` für Karte `cd`
  // freischalten? (Zonen-Kopie, Stack <3 erhöhen oder leeren Slot
  // füllen, side-effect-freie Engine-Levelprüfung; Fallback simple
  // Max-Level-Betrachtung.) Geteilt von Unlock- UND Upgrade-Zweig.
  const plusOneUnlocks = (hi, cd) => {
    const hero = ps.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
    if (typeof engine._testLevelReqForZones === 'function') {
      const abZones = ps.abilityZones?.[hi] || [];
      const simZones = abZones.map(slot => (slot ? slot.slice() : []));
      let placed = false;
      for (const slot of simZones) {
        if (slot.length > 0 && slot[0] === abilityName && slot.length < 3) { slot.push(abilityName); placed = true; break; }
      }
      if (!placed) {
        for (const slot of simZones) {
          if (slot.length === 0) { slot.push(abilityName); placed = true; break; }
        }
      }
      if (!placed) return false;
      try { return !!engine._testLevelReqForZones(pi, hi, cd, hero, cd.level || 0, simZones); } catch { return false; }
    }
    // Fallback ohne Engine-Helfer (ignoriert Reducer/Zweitschulen).
    let lvl = 0;
    for (const slot of (ps.abilityZones?.[hi] || [])) {
      if (slot && slot[0] === abilityName) lvl = Math.max(lvl, slot.length);
    }
    return lvl + 1 >= (cd.level || 0);
  };
  for (const cn of (ps.hand || [])) {
    if (!cn || cn === abilityName || seen.has(cn)) continue;
    seen.add(cn);
    const cd = cardDB[cn];
    if (!cd) continue;
    const t = cd.cardType;
    if (t !== 'Spell' && t !== 'Attack' && t !== 'Creature') continue;
    if (cd.spellSchool1 !== abilityName && cd.spellSchool2 !== abilityName) continue;
    const eligibleNow = listEligibleHeroesForActionCard(engine, pi, cd);
    if (eligibleNow.length > 0) {
      // ── Caster-UPGRADE-Zweig (Als Ida→Bartas-Befund) ───────────────
      // Die Karte IST castbar — aber vielleicht nur SCHLECHT: der beste
      // aktuell mögliche Caster kann einen stark negativen gelernten
      // Caster-Delta tragen (Ida macht Avalanche zu Single-Target,
      // gelernt −11.7), während ein Held, der durch +1 Level dieser
      // Ability eligible WÜRDE, einen deutlich besseren Delta hat
      // (Bartas +12.2). Der alte "castbar → keine Dringlichkeit"-
      // Kurzschluss übersah genau das. Bonus = Delta-Differenz
      // (bereits confidence-skaliert aus dem Profil), Rauschboden 4,
      // Beitrag je Handkarte gedeckelt auf 20.
      let bestCur = -Infinity;
      for (const e of eligibleNow) {
        const hn = ps.heroes?.[e.hi]?.name;
        const d = hn ? deckProfile.casterDelta(engine, pi, cn, hn) : 0;
        if (d > bestCur) bestCur = d;
      }
      let bestUp = -Infinity;
      const eligSet = new Set(eligibleNow.map(e => e.hi));
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (eligSet.has(hi)) continue;
        if (!plusOneUnlocks(hi, cd)) continue;
        const hn = ps.heroes?.[hi]?.name;
        const d = hn ? deckProfile.casterDelta(engine, pi, cn, hn) : 0;
        if (d > bestUp) bestUp = d;
      }
      if (bestUp > -Infinity) {
        const gain = bestUp - bestCur;
        if (gain >= 4) bonus += Math.min(20, gain);
      }
      continue;
    }
    // ── Unlock-Zweig (unverändert): Karte ist gar nicht castbar ──────
    let unlockNow = false;
    for (let hi = 0; hi < 3 && !unlockNow; hi++) {
      if (plusOneUnlocks(hi, cd)) unlockNow = true;
    }
    bonus += unlockNow ? 18 : 6;
  }
  return Math.min(36, bonus);
}

function estimateHandCardValueFor(engine, pi, cardName, seenCount = 0) {
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return 15;
  const ps = engine.gs.players[pi];
  const gold = ps?.gold || 0;
  const cost = cd.cost || 0;
  const typeLocked =
    (cd.cardType === 'Potion' && ps?.potionLocked) ||
    (cd.cardType === 'Artifact' && ps?.itemLocked) ||
    (cd.cardType === 'Creature' && ps?.creatureLocked);
  let base;
  if (typeLocked) base = 10;
  else if (cost <= gold) base = 25;
  else if (cost <= gold + 6) base = 20;
  else if (cost <= gold + 12) base = 15;
  else base = 5;
  if (!typeLocked) {
    const script = loadCardEffect(cardName);
    if (script?.blockedByHandLock && typeof script.resolve === 'function') {
      base = Math.min(base, 12);
    }
    // Per-card override: cards whose ENTIRE on-play value is gaining a
    // fixed amount of gold (Treasure Chest's +10) should rate their hand-
    // value at the demand-aware value of that gold, NOT the generic
    // "any 0-cost playable card is worth 25" base. This keeps the
    // apply-vs-skip delta in mctsGatedActivation honest:
    //   • low gold (high demand) → gold worth ~×2 → hand-value ~20 → small
    //     positive delta to play (10 gold gained, 1 hand card lost worth 20,
    //     net ~0 to slightly positive depending on demand math).
    //   • high gold (saturated demand) → gold worth ~×0.2 → hand-value ~2
    //     → strong negative delta to play, so the gate skips.
    //   • interference (Hammer Throw +1 forced discard) → recon eval sees
    //     the extra hand cost and skips even at low gold.
    const goldGain = script?.cpuMeta?.handValueAsGoldGain;
    if (typeof goldGain === 'number' && goldGain > 0) {
      const demand = computeGoldDemand(engine, pi);
      const willMeet  = Math.max(0, Math.min(goldGain, demand - gold));
      const willSpill = goldGain - willMeet;
      base = willMeet * 2 + willSpill * 0.2;
    }
  }
  // ── Learned deck-profile blend ─────────────────────────────────────
  // When the piloted lineup has an ML-trained profile, blend the learned
  // per-card value (timing-adjusted for the current turn) with the
  // affordability heuristic. The blend weight is the profile's
  // sample-size CONFIDENCE (see _deck-profile.confidence): a 100-game
  // profile only nudges the heuristic, a 1000+-game profile mostly
  // replaces it. On top, add the held-combo bonus: learned pair
  // synergies raise a card's value while its partner is in hand — this
  // is what makes tutors fetch the second half of a combo and discards
  // spare it. Placed BEFORE the ascension / Cardinal Beast floors and
  // the Kazena override so those explicit rules keep precedence over
  // the statistics.
  if (!typeLocked) {
    // ── Castability-Gate für den Profil-Einfluss ─────────────────────
    // Gelernte Werte stammen aus Spielen, in denen die Karte gespielt
    // wurde — implizit also castbar war. Kann aktuell KEIN Held die
    // Karte casten (Schule/Level fehlt), ist der gelernte Wert nicht
    // anwendbar: Ohne Gate übertönte er die Heuristik und Tutoren
    // fetchten hochbewertete Spells als tote Bricks (live beobachtet:
    // 2 Züge Brick, bis die Ability nachkam). Stufen:
    //   castbar jetzt                          → 1.0 (volles Gewicht)
    //   Enabler-Ability liegt in der Hand      → 0.5 (eine Setup-Aktion
    //                                            entfernt — Fetch okay,
    //                                            wenn der Plan steht)
    //   weder noch                             → 0.15 (Brick: Heuristik
    //                                            dominiert)
    // Nur für level-/schulgebundene Typen; Abilities, Artefakte und
    // Potions haben keine Schul-Anforderung und bleiben ungegated.
    let castGate = 1;
    let presumptiveCasterName = null;
    if (cd.cardType === 'Spell' || cd.cardType === 'Attack' || cd.cardType === 'Creature') {
      const eligible = listEligibleHeroesForActionCard(engine, pi, cd);
      if (eligible.length) {
        // Präsumtiver Caster: der castbare Held mit dem besten gelernten
        // Caster-Delta (Basis: cpuCasterPriority-Reihenfolge aus
        // listEligibleHeroesForActionCard). Kein Ida-Routing mehr (Als
        // Ruling: forcesSingleTarget ist rein per-Caster) — die Karte
        // wird so bewertet, wie ihr BESTER verfügbarer Caster sie
        // spielen würde; existiert nur ein schwacher Caster (nur Ida
        // lebt), trägt der Handwert dessen negativen Versatz.
        let bestHi = eligible[0].hi, bestD = -Infinity;
        for (const e of eligible) {
          const hn = ps?.heroes?.[e.hi]?.name;
          const d = hn ? deckProfile.casterDelta(engine, pi, cardName, hn) : 0;
          if (d > bestD) { bestD = d; bestHi = e.hi; }
        }
        presumptiveCasterName = ps?.heroes?.[bestHi]?.name || null;
      } else {
        const schools = [cd.spellSchool1, cd.spellSchool2].filter(Boolean);
        const enablerInHand = schools.some(sc => (ps?.hand || []).includes(sc));
        // Revive-Awareness: Kann ein TOTER eigener Held die Karte casten
        // und liegt eine Revive-Quelle auf der Hand, ist die Karte
        // ebenfalls nur eine Setup-Aktion entfernt (wiederbeleben →
        // casten) — gleiche 0.5-Stufe wie der Enabler-Fall statt
        // Brick-0.15. Kurzschluss: die teurere Probe läuft nur, wenn
        // der billigere Enabler-Check nicht schon gegriffen hat.
        const reviveLine = !enablerInHand && deadHeroCouldCastWithReviveInHand(engine, pi, cd);
        castGate = (enablerInHand || reviveLine) ? 0.5 : 0.15;
      }
    }
    const blended = deckProfile.learnedCardValue(engine, pi, cardName, base, castGate);
    if (blended != null) base = blended;
    const handArrForPairs = ps?.hand;
    if (handArrForPairs && handArrForPairs.length > 1) {
      base += deckProfile.heldPairBonus(engine, pi, cardName, handArrForPairs, castGate);
    }
    // ── Caster-Delta (Held × Karte) ──────────────────────────────────
    // Der pauschale gelernte cardValue verschmiert über alle Caster —
    // fatal, wenn ein Held die Wirkung transformiert (Ida: Destruction-
    // AoE → Single-Target; ihr Avalanche-"AoE-Wert" stammt aus Spielen
    // mit anderen Castern). presumptiveCasterName ist der castbare Held
    // mit dem besten gelernten Delta — sein Versatz korrigiert Handwert,
    // Eval, Discard UND die Tutor-Galerie, bevor MCTS-Budget und
    // Rollout-Policy auf den inflationierten Prior hereinfallen. Nur
    // Spell/Attack: der Trainings-Kanal speist sich aus
    // afterSpellResolved.
    if (presumptiveCasterName && (cd.cardType === 'Spell' || cd.cardType === 'Attack')) {
      base += deckProfile.casterDelta(engine, pi, cardName, presumptiveCasterName);
    }
    // ── Deckout-Guard ────────────────────────────────────────────────
    // Gelernter Malus für Karten (Draw-/Self-Mill-Engines), deren
    // Plays im Danger-Bereich mit eigenen Deckout-Losses über-
    // korrelierten. Greift NUR, wenn das eigene Restdeck ≤ der im
    // Training gelernten Danger-Schwelle liegt — die CPU hört damit
    // auf, sich bei kleinem Deck weiter leerzuziehen, statt per
    // Deck-Out zu verlieren. Wirkt in Handwert, Eval, Discard UND
    // Tutor-Galerie (auch in den Rollouts).
    base += deckProfile.deckoutGuard(engine, pi, cardName);
    // ── Tutor-Cap NACH dem Learned-Blend (Fix "Tutor sucht Tutor") ───
    // Der min(12)-Cap weiter oben lief VOR dem Blend — ein hoher
    // gelernter cardValue (Blend-Gewicht bis 0.75; das Castability-Gate
    // greift bei Artefakten nicht) konnte ihn aushebeln und "Magnetic
    // Potion sucht Magnetic Glove" wieder attraktiv machen. Finaler
    // Clamp: Karten, deren einziger Play-Effekt "ziehe/suche eine
    // andere Karte" ist, sind als SUCHZIEL nie mehr als 12 wert — die
    // Wertschöpfung steckt in der Karte, die sie ihrerseits holen
    // würden, und die würde sonst doppelt gezählt.
    {
      const tScript = loadCardEffect(cardName);
      if (tScript?.blockedByHandLock && typeof tScript.resolve === 'function') {
        base = Math.min(base, 12);
      }
    }
    // ── Revive-Karten situativ statt statisch bewerten ───────────────
    // Für Karten mit cpuMeta.reviveCard ersetzt die Situationslage den
    // kontextfreien Lernwert-Pfad:
    //   kein toter eigener Held        → harter Deckel 4 (die Suche/das
    //     Halten lohnt schlicht nicht; neutralisiert den durch
    //     Selektionsbias inflationierten statischen cardValue — Ankh
    //     wurde im Training ja fast nur in GUTEN Spots gespielt)
    //   toter Held, aber temporärer Revive (Golden Ankh) OHNE Nutzung
    //   in dieser Runde (cpuShouldPlay-Probe)  → Deckel 8 (der Held
    //     stirbt am Rundenende wieder, ohne etwas beigetragen zu haben)
    //   sonst → gelernter situativer reviveBonus wie gehabt.
    const revSit = reviveCardSituation(engine, pi, cardName);
    if (revSit) {
      if (!revSit.hasDead) base = Math.min(base, 4);
      else if (!revSit.useful) base = Math.min(base, 8);
      else base += deckProfile.reviveBonus(engine, pi, cardName);
    } else {
      // Situativer Revive-Bonus für alle übrigen Karten: greift NUR,
      // wenn gerade ein eigener Held besiegt ist, und bewertet dessen
      // gelernte Identität plus die aktuell castbaren Abilities (siehe
      // _deck-profile.reviveBonus). Für nicht geflaggte Revive-Quellen
      // (Reincarnation, Elixir) bleibt das Verhalten unverändert.
      base += deckProfile.reviveBonus(engine, pi, cardName);
    }
    // ── Ability-Such-Dringlichkeit (Spell-School-Unlock) ─────────────
    // Bisher hatte eine Ability als Suchziel nur Affordability +
    // statischen Profilwert — "such Destruction Magic, weil Fireball
    // als Brick auf der Hand liegt" gab es nicht (die Unlock-Logik lag
    // ausschließlich in scoreAbilityPlacement, also der WOHIN-Frage).
    // abilitySearchUnlockBonus liefert den situativen OB-Anteil:
    // +18 je Handkarte, die EIN weiteres Level dieser Schule sofort
    // freischalten würde, +6 für bloßen Fortschritt, Cap 36.
    if (cd.cardType === 'Ability') {
      base += abilitySearchUnlockBonus(engine, pi, cardName);
    }
  }
  // Ascension-critical floor — applies UNIVERSALLY to any card that
  // would progress some Ascendable hero's orb / equipment count
  // (Beato's school spells, Arthor's Sword/Circle, Layn's Hammer,
  // and any future Ascendable hero that exports `ascensionNeedsCard`).
  // Floor MUST stay below the play-payoff (`SLOT_BASE + per-orb`) so
  // the eval prefers PLAYING the card to hoarding it. Calibration:
  //   per-orb-value = 400 / N  (where N = orbs/items the hero needs)
  //   play-payoff   = 30 (SLOT_BASE) + 400/N
  //   For Beato N=5 (worst case currently): payoff = 30 + 80 = 110.
  // Keeping the floor at 60 leaves +20 margin for the smallest deck
  // (Beato) while preserving a 2.4× preference over the default 25-
  // point base, which is still a strong gallery-tutor signal. Heroes
  // with fewer orbs (Arthor N=2, Layn N=1) get progressively bigger
  // play-margins automatically.
  if (cardIsAscensionCriticalForAnyHero(engine, pi, cardName, cd)) {
    base = Math.max(base, 60);
  }
  // Cardinal Beasts win-condition floor. Once at least one hero on the
  // CPU's team can ACTUALLY summon a Lv5 Summoning Magic Creature
  // (Ascended Beato bypasses the level requirement; any other hero
  // that has stacked enough Summoning Magic also qualifies), every
  // Cardinal Beast in hand is one summon-ready piece of the alt win
  // condition. Bump the hand floor to 100 so gallery tutors
  // (Magnetic Glove, Brilliant Idea, Graveyard Gathering, Divine
  // Gift of Creation, Beato's Ascension Bonus, …) prefer pulling
  // Beasts over a generic Lv1 Spell. Pre-Ascension the gate fails
  // (no hero meets the Lv5 Summoning requirement) so this boost
  // doesn't fire and the CPU isn't lured into useless Beast tutors
  // it can't yet summon — matches the same playability check
  // `cardIsAscensionCriticalForAnyHero` uses.
  if (CARDINAL_BEAST_NAMES_FOR_HAND_VALUE.has(cardName)
      && canTeamSummonCardinalBeasts(engine, pi)) {
    base = Math.max(base, 100);
  }
  // Direct-from-deck summon synergy. Cards that opt into
  // `cpuMeta.directDeckSummon` are worth more when a reactor
  // (`cpuMeta.directDeckSummonReactor`) is in hand; reactors are
  // worth more when a summon-trigger is in hand. Cosmic Manipulation
  // is the canonical reactor — any future card wearing either flag
  // gets the same +25 lift without per-card branching here.
  const script = loadCardEffect(cardName);
  const ps2 = engine.gs.players[pi];
  const isSummon = !!script?.cpuMeta?.directDeckSummon;
  const isReactor = !!script?.cpuMeta?.directDeckSummonReactor;
  if (isSummon || isReactor) {
    const hand = ps2?.hand || [];
    const partnerInHand = hand.some(cn => {
      if (cn === cardName) return false;
      const partnerScript = loadCardEffect(cn);
      if (isSummon && partnerScript?.cpuMeta?.directDeckSummonReactor) return true;
      if (isReactor && partnerScript?.cpuMeta?.directDeckSummon) return true;
      return false;
    });
    if (partnerInHand) base += 25;
  }
  // ── Kazena draw-engine override ──────────────────────────────────
  // If Kazena's "draw until 7" is still available + usable for `pi`
  // this turn, a held card is a WASTED Kazena draw. Flip the inherent
  // value of generic hand cards NEGATIVE so the evaluator pushes the
  // CPU to empty its hand (play cards, trade them for gold via
  // Treasure Chest / Play Money, …) before activating her — she then
  // refills to 7 fresh cards. The `< 50` guard means cards already
  // floored as genuinely critical (ascension pieces ≥60, Cardinal
  // Beasts ≥100) keep their high value — we never want to pitch those
  // to a random redraw, only the generic chaff the user wants dumped.
  if (base < 50 && kazenaDrawAvailable(engine, pi)) {
    base = -10;
  }
  if (seenCount >= 1) base *= 0.5;
  return base;
}

// Scalar evaluation of a game state from the CPU's perspective. Higher is
// better for the CPU. Feature weights are educated guesses — tune after
// playing games with MCTS active and observing where the brain under- or
// over-values things.
// ─── Threat weighting for enemy heroes ────────────────────────────────────
// The base evaluator treats all enemy HP uniformly, so different enemy
// targets tie whenever the damage dealt is equal. We weight enemy HP by a
// threat multiplier that combines two signals:
//   (a) Spell-school presence — hard-coded set of ability names below,
//       since being a "caster" is a structural property of ability TYPE.
//   (b) Support-kit yield — inferred dynamically from each script's
//       `supportYield(level)` (abilities) or `supportYield()` (heroes).
//       Cards self-declare the draws / potion-draws / gold they generate
//       per turn; the CPU sums them into a single "support units" score
//       with potion draw worth 3× a regular draw and gold discounted.
const SPELL_SCHOOL_ABILITIES = new Set([
  'Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic', 'Summoning Magic',
]);

// Weightings for combining a hero's declared supportYield into one number.
// Matches the user-specified rule "potion draw = 3 regular draws"; the gold
// weight approximates a typical cheap spell costing ~4 gold (so 4 gold ≈ 1
// draw worth of support). Damage is surfaced separately (see
// mctsHeroSupportDetails) because damage supporters get a dedicated threat
// bonus instead of flowing through the generic support-units weight.
const SUPPORT_UNIT_WEIGHTS = { draws: 1.0, potionDraws: 3.0, gold: 0.25 };

// Read supportYield from each stacked Ability (called with `(level, ctx)`)
// and from the hero's own card script (called with `(ctx)`). Returns the
// per-turn support breakdown: `supportUnits` for draws/potions/gold, and
// `damagePerTurn` for damage-supporter assessment (separate threat track).
// ctx gives scripts access to the engine so their yields can scale with
// current board state (creature counts, poison stacks, atk deltas, etc.).
function mctsHeroSupportDetails(engine, pi, hi) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) {
    return { supportUnits: 0, damagePerTurn: 0, goldYield: 0 };
  }
  let draws = 0, potionDraws = 0, gold = 0, damage = 0;
  const ctx = { engine, pi, hi, cpuIdx: engine._cpuPlayerIdx };
  const apply = (y) => {
    if (!y) return;
    draws += y.drawsPerTurn || 0;
    potionDraws += y.potionDrawsPerTurn || 0;
    gold += y.goldPerTurn || 0;
    damage += y.damagePerTurn || 0;
  };
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const script = loadCardEffect(slot[0]);
    if (typeof script?.supportYield !== 'function') continue;
    try { apply(script.supportYield(slot.length, ctx)); } catch {}
  }
  const heroScript = loadCardEffect(hero.name);
  if (typeof heroScript?.supportYield === 'function') {
    try { apply(heroScript.supportYield(ctx)); } catch {}
  }
  const supportUnits =
    SUPPORT_UNIT_WEIGHTS.draws * draws +
    SUPPORT_UNIT_WEIGHTS.potionDraws * potionDraws +
    SUPPORT_UNIT_WEIGHTS.gold * gold;
  // `goldYield` is the raw per-turn gold contribution surfaced
  // separately so the dynamic-value layer can re-weight it by the
  // opponent's actual gold demand instead of using the flat
  // 0.25-per-gold weight baked into supportUnits. Positive = gold
  // generator, negative = gold sink (Alchemy).
  return { supportUnits, damagePerTurn: damage, goldYield: gold };
}

// ─── Gold vs Card-Draw decision helper ────────────────────────────────
// Used whenever a card offers the CPU a binary choice between gaining
// Gold and drawing Cards (Willy today; potentially other cards later).
// Returns 'gold' or 'draw'.
//
// Factors, per the design spec:
//   1. Current gold (more → gaining Gold is worth less)
//   2. Average cost of artifacts in deck/hand/discard, multiplied by
//      on-board cost modifiers (Alchemy doubles artifact cost). Higher
//      effective cost, especially compared to gold already owned, makes
//      Gold worth more.
//   3. Hand size (more in hand → drawing is worth less — new tools may
//      not even fit comfortably)
//   4. Kit lean — abilities and heroes in play that self-declare
//      supportYield with goldPerTurn or drawsPerTurn. If the kit ALREADY
//      generates lots of gold, the OTHER resource (draws) is more
//      precious, and vice-versa (per the user's rule).
//
// Score > 0 → GOLD wins. Score < 0 → DRAW wins. Weights are first-pass
// estimates; tune after playtesting. Exported so card scripts can call
// it directly via their `cpuResponse` hook if they want the same logic
// without relying on auto-detection by option ID.
function mctsValueGoldVsDraw(engine, pi, opts = {}) {
  // Two-arm comparison: simulate each option's IMMEDIATE state change
  // and ask `evaluateState` which board reads better. evaluateState
  // already prices gold dynamically (gold demand model: each gold up
  // to demand worth 2×, excess worth 0.2×) and values each hand card
  // per its own playability via `estimateHandCardValueFor`, so this
  // delegates the gold-vs-draw call to the same scoring the rest of
  // the brain uses instead of a hand-tuned heuristic that can drift
  // out of sync with the evaluator. 1-ply only — full MCTS rollouts
  // would be more accurate but the prompt fires inside a sync prompt
  // resolver, and the immediate eval already captures the dominant
  // signal (gold demand vs deck-pricedness vs hand-card value).
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return 'gold';

  const goldAmt = opts.goldAmt != null ? opts.goldAmt : 30;
  const drawCount = opts.drawCount != null ? opts.drawCount : 5;

  // Stash the scalar fields we'll mutate and the array refs we'll
  // splice. Restore them in place so any outside reference (engine.gs
  // closures, hooks holding onto ps) keeps pointing at valid arrays.
  const origGold = ps.gold || 0;
  const origHand = ps.hand || [];
  const origDeck = ps.mainDeck || [];
  const handSnap = [...origHand];
  const deckSnap = [...origDeck];

  // ── Try GOLD ──────────────────────────────────────────────────────
  ps.gold = origGold + goldAmt;
  const goldScore = evaluateState(engine, pi);

  // ── Try DRAW ──────────────────────────────────────────────────────
  ps.gold = origGold;
  const take = Math.min(drawCount, deckSnap.length);
  origHand.length = 0;
  for (const c of handSnap) origHand.push(c);
  for (let i = 0; i < take; i++) origHand.push(deckSnap[i]);
  origDeck.length = 0;
  for (let i = take; i < deckSnap.length; i++) origDeck.push(deckSnap[i]);
  const drawScore = evaluateState(engine, pi);

  // ── Restore ───────────────────────────────────────────────────────
  ps.gold = origGold;
  origHand.length = 0;
  for (const c of handSnap) origHand.push(c);
  origDeck.length = 0;
  for (const c of deckSnap) origDeck.push(c);

  return drawScore >= goldScore ? 'draw' : 'gold';
}

// Highest Spell-School ability level on pi's live team. Used to identify
// which hero is "the team's main spellcaster" — higher threat than a
// secondary spellcaster with the same spell-school ability at the same level.
function mctsTeamMaxSchoolLvl(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return 0;
  let topLvl = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
        if (slot.length > topLvl) topLvl = slot.length;
      }
    }
  }
  return topLvl;
}

// Threat multiplier on a single enemy hero's HP. Base is 1.0. Layered:
//   +0.5   Spell-School Ability at level ≥ 2 (established caster)
//   +0.5   their top spell-school level ties the team's top (main carry)
//   +0.25 × support units (draws/potions/gold, from supportYield)
//   +1.2   flat bonus if the hero is a damage supporter (damagePerTurn > 0),
//          +0.01 per damage point (capped at +1.5) — by user spec damage
//          supporters outrank even main carries
//   +0.3 × each full 20 atk over 120 — large-stick heroes are a scaling
//          threat on their own attack actions, independent of kit
function mctsEnemyHeroThreat(engine, oppIdx, hi, teamMaxSchoolLvl) {
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return 1.0;
  const abZones = ps.abilityZones?.[hi] || [];
  let myMaxSchoolLvl = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0]) && slot.length > myMaxSchoolLvl) {
      myMaxSchoolLvl = slot.length;
    }
  }
  let threat = 1.0;
  if (myMaxSchoolLvl >= 2) threat += 0.5;
  if (myMaxSchoolLvl >= 2 && myMaxSchoolLvl === teamMaxSchoolLvl) threat += 0.5;

  const { supportUnits, damagePerTurn } = mctsHeroSupportDetails(engine, oppIdx, hi);
  threat += 0.25 * supportUnits;
  if (damagePerTurn > 0) {
    threat += 1.2 + Math.min(1.5, 0.01 * damagePerTurn);
  }

  // High-attack heroes are dangerous on their Attack cards; +0.3 per 20 atk
  // step past 120. Stepwise so atk 139 and 140 cleanly differ.
  const atk = hero.atk || 0;
  if (atk > 120) {
    threat += Math.floor((atk - 120) / 20) * 0.3;
  }
  return threat;
}

// How much gold could this player productively spend RIGHT NOW on plays
// that are otherwise ready to go? Sums:
//   • Artifact cards in hand that would be playable if gold weren't a
//     constraint (has a valid hero/slot, not locked, HOPT unclaimed, etc.).
//     Each artifact name counts once — two copies of the same card only
//     add one copy's cost (the second still sits until the first lands).
//   • On-board activations that charge gold. Cards opt in via
//     `cpuGoldCostForActivation(engine, pi, heroIdx, level, inst?)` which
//     must return the gold it would consume right now, or 0 if activation
//     isn't possible (HOPT claimed, wrong phase, missing prerequisite).
// Used by the evaluator to decide whether a gold gain is genuinely valuable
// (unmet demand) or near-worthless filler (demand already met).
function computeGoldDemand(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return 0;
  const cardDB = engine._getCardDB();
  let demand = 0;

  // (a) Artifacts in hand — playability-filtered. planArtifactPlay checks
  // gold internally, so we briefly inflate ps.gold to bypass that gate
  // while keeping every OTHER check (targets, locks, HOPT). Safe because
  // planArtifactPlay is read-only and everything runs synchronously.
  const seenArtifact = new Set();
  const origGold = ps.gold;
  ps.gold = 1e9;
  try {
    for (let handIdx = 0; handIdx < (ps.hand || []).length; handIdx++) {
      const name = ps.hand[handIdx];
      if (seenArtifact.has(name)) continue;
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Artifact') continue;
      const plan = planArtifactPlay(engine, pi, name, handIdx, cd);
      if (!plan) continue;
      seenArtifact.add(name);
      const rawCost = cd.cost || 0;
      const reduction = ps._nextArtifactCostReduction || 0;
      demand += Math.max(0, rawCost - reduction);
    }
  } finally {
    ps.gold = origGold;
  }

  // (b) On-board activatable effects that charge gold. Ability zones +
  // support-zone card instances that implement cpuGoldCostForActivation.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!Array.isArray(slot) || slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (typeof script?.cpuGoldCostForActivation !== 'function') continue;
      try {
        const c = script.cpuGoldCostForActivation(engine, pi, hi, slot.length);
        if (c > 0) demand += c;
      } catch {}
    }
  }
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support') continue;
    const script = loadCardEffect(inst.name);
    if (typeof script?.cpuGoldCostForActivation !== 'function') continue;
    try {
      const c = script.cpuGoldCostForActivation(engine, pi, inst.heroIdx, null, inst);
      if (c > 0) demand += c;
    } catch {}
  }

  return demand;
}

/**
 * Demand-aware multiplier for an opponent's gold-yielding hero. Returned
 * value scales the static gold contribution to the hero's threat:
 *   ≈ 0.3  → opponent has plenty of gold and nothing to spend it on;
 *            their gold engine is redundant, killing it doesn't sting
 *   ≈ 0.6  → mild over-supply
 *   = 1.0  → balanced
 *   ≈ 1.4  → starved, every gold counts
 *   ≈ 1.8  → severely starved, gold engine is critical to remove
 *
 * Combines two signals:
 *   • Snapshot — current gold vs computeGoldDemand. Demand is what
 *     they could productively spend RIGHT NOW (artifacts in hand,
 *     gold-cost activations on board).
 *   • Historical — average end-of-turn gold across the game so far.
 *     A hoarder ending most turns with 15+ gold doesn't actually
 *     need more; a spender at 0–2 each turn is genuinely starved.
 *     Blends in once we have ≥3 turns of data so early-game noise
 *     doesn't swing the multiplier.
 */
function mctsOpponentGoldEconomy(engine, oppIdx) {
  const opp = engine.gs.players[oppIdx];
  if (!opp) return 1.0;
  const gold = opp.gold || 0;
  const demand = computeGoldDemand(engine, oppIdx);

  let snapshotMult;
  if (demand <= 0) {
    // No measurable demand — gold engines have nothing to feed. Heavy
    // discount when there's already a stockpile; mild discount when
    // gold is low (opp may be priming for next turn).
    snapshotMult = gold > 10 ? 0.3 : 0.6;
  } else {
    const ratio = gold / demand;
    if (ratio >= 2) snapshotMult = 0.3;          // ≥2× supply: saturated
    else if (ratio >= 1) snapshotMult = 0.6 - 0.3 * Math.min(1, ratio - 1);
    else snapshotMult = 1.0 + 0.8 * Math.min(1, 1 - ratio);
  }

  const hist = opp._cpuGoldHistory;
  if (hist && hist.turnsTracked >= 3) {
    const avgEnd = hist.totalGold / hist.turnsTracked;
    let histMult;
    if (avgEnd > 15)      histMult = 0.4; // hoarder
    else if (avgEnd > 10) histMult = 0.6;
    else if (avgEnd > 5)  histMult = 1.0;
    else if (avgEnd > 2)  histMult = 1.4;
    else                  histMult = 1.7; // spends everything
    return (snapshotMult + histMult) / 2;
  }
  return snapshotMult;
}

/**
 * Snapshot the active player's gold pool when their turn ends. Builds
 * up a per-player rolling average that `mctsOpponentGoldEconomy`
 * consults to tell hoarders apart from spenders.
 */
function recordEndOfTurnGold(engine) {
  const gs = engine.gs;
  const ap = gs?.activePlayer;
  if (ap == null || ap < 0) return;
  const ps = gs.players?.[ap];
  if (!ps) return;
  if (!ps._cpuGoldHistory) ps._cpuGoldHistory = { totalGold: 0, turnsTracked: 0 };
  ps._cpuGoldHistory.totalGold += (ps.gold || 0);
  ps._cpuGoldHistory.turnsTracked++;
}

/**
 * Stack-Zähler für Tick-Status (Als Poison-Vial-Befund): Die Engine
 * speichert Status als OBJEKT unter dem STATUS_EFFECTS-Schlüssel —
 * `hero.statuses.poisoned = { stacks: 2, ... }`, analog `burned`.
 * Die CPU las jahrelang `statuses.poison` / `statuses.burn` (falscher
 * Schlüssel UND falsche Form: Zahl statt Objekt) und bekam damit
 * IMMER 0 — der gesamte Status-Antizipations-Block der Eval war toter
 * Code, Gift/Brand waren für MCTS unsichtbar. Symptom: Poison Vial
 * (freie 2 Stacks) 2% Einsatzrate, weil der Gate-Delta ≈ 0 blieb.
 * Robust gegen alle Formen: fehlt → 0, Objekt ohne stacks → 1
 * (Engine-Default, vgl. cactus-creature.js), Zahl → Zahl.
 */
function statusStacks(entity, key) {
  const s = entity?.statuses?.[key];
  if (!s) return 0;
  if (typeof s === 'number') return s;
  const n = Number(s.stacks);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function evaluateState(engine, cpuIdx) {
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const oppIdx = cpuIdx === 0 ? 1 : 0;
  const opp = gs.players[oppIdx];
  if (!ps || !opp) return 0;

  // Game end: terminal ±value.
  if (gs.result) {
    if (gs.result.winnerIdx === cpuIdx) return 100000;
    return -100000;
  }

  let score = 0;

  // ── Deck-Nähe (Deckout-Prävention) ──────────────────────────────────
  // Bisher hatte die Eval KEINEN Deck-Größen-Term: Eine Linie, die bei
  // Deck=6 per Kazena/Friendship/Wheels auf 0 zieht, evaluierte exakt
  // wie bei Deck=30 — MCTS und Rollouts KONNTEN den nahenden Deck-Out
  // nicht sehen und bestätigten Suizid-Linien (Als Heal-Burn-Befund:
  // Iter4 50% Loss(deck_out), Konsum 3.0/Zug). Eskalierender Malus
  // unterhalb der Danger-Schwelle (gelernt aus dem Profil, sonst
  // Default): quadratisch, damit "noch eine Karte ziehen" bei Deck=8
  // billig ist, bei Deck=2 aber richtig weh tut — eine Lethal-Linie
  // darf die letzten Karten trotzdem ziehen, weil die Eval abwägt
  // statt verbietet. Symmetrisch: das GEGNERISCHE Deck nahe 0 ist ein
  // Bonus (Deckout ist eine Win-Condition — Suicide Bombers deckt
  // Gegner aus). Reguliert damit JEDE Zieh-Entscheidung situativ:
  // Kazena-Aktivierungs-Arme, Wheels, Tutor-Ketten, Caster-Wahl mit
  // Friendship-Draw-Rider — überall, wo Rollouts real resolven.
  {
    const deckProx = (idx) => {
      const dl = gs.players[idx]?.mainDeck?.length;
      if (typeof dl !== 'number') return 0;
      const th = deckProfile.deckoutDangerSizeOf(engine, idx) ?? DECKOUT_EVAL_TH_DEFAULT;
      if (dl >= th) return 0;
      const d = th - dl;
      return d * d * DECKOUT_EVAL_K;
    };
    score -= deckProx(cpuIdx);
    score += deckProx(oppIdx);
  }

  // ── Doomed-hero projection ──────────────────────────────────────────
  // Heroes flagged with `_forceKillAtTurnEnd === gs.turn` (Golden Ankh,
  // any future "revive for one turn only" effect) are alive RIGHT NOW
  // but un-negatably die at this turn's End Phase. The evaluator
  // measures end-of-turn outcomes for activations gated mid-turn, so
  // treat doomed heroes as already dead in the structural HP / dead-
  // bonus terms — they shouldn't credit the +HP / -dead-penalty that
  // a real revive would. Spell/Attack/Hero-Effect contributions made
  // during their forced-life DO persist (cards drawn, gold gained,
  // damage dealt) and show up via the other eval terms.
  const isDoomed = (h) => !!h && h._forceKillAtTurnEnd === gs.turn;
  const isAliveForEval = (h) => !!h?.name && h.hp > 0 && !isDoomed(h);
  const isDeadForEval = (h) => !!h?.name && (h.hp <= 0 || isDoomed(h));

  // Hero HP deltas. Own HP counts raw; opp HP is threat-weighted so damage
  // to a carry/supporter breaks ties over damage to a plain bruiser.
  let ownHp = 0;
  for (const h of (ps.heroes || [])) if (isAliveForEval(h)) ownHp += h.hp;

  const oppTeamMaxSchoolLvl = mctsTeamMaxSchoolLvl(gs, oppIdx);
  let oppWeightedHp = 0;
  let minOppHp = Infinity;
  for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
    const h = opp.heroes[hi];
    if (!isAliveForEval(h)) continue;
    // Dynamic threat: layers spell-cast history, recent damage output,
    // role-redundancy with teammates, and summoner-no-room discount on
    // top of the static threat function. See mctsEnemyHeroDynamicValue.
    const threat = mctsEnemyHeroDynamicValue(engine, oppIdx, hi, oppTeamMaxSchoolLvl);
    oppWeightedHp += h.hp * threat;
    if (h.hp < minOppHp) minOppHp = h.hp;
  }
  score += ownHp - oppWeightedHp;

  // Final tiebreaker: focus-fire the enemy hero with the lowest current HP.
  // Reducing minOppHp raises score, so among targets that deal the same
  // weighted damage, the low-HP enemy wins — consistent focus across turns.
  // Weight kept small so it doesn't overwhelm threat or board-state terms.
  if (minOppHp !== Infinity) score -= 0.3 * minOppHp;

  // Killed-hero swing — huge, because losing a hero is close to losing.
  // Doomed-but-alive heroes count as dead here too (they will be by End
  // Phase, and that's what eval is projecting toward).
  for (const h of (ps.heroes || [])) if (isDeadForEval(h)) score -= 500;
  for (const h of (opp.heroes || [])) if (isDeadForEval(h)) score += 500;

  // ── Recurring symmetric Area payoff correction ───────────────────
  // Areas like Blood Rock deal `D` damage at the END of EVERY turn to
  // all Heroes the *turn player* controls. The rollout plays this turn
  // through End Phase but deliberately stops before the opponent's
  // turn, so it APPLIES the placer's own first self-tick (real HP loss,
  // counted in the ownHp / dead terms above) but NEVER simulates the
  // matching tick the Area deals to the OTHER side on their turn —
  // making such Areas (and the Cooldin tutor that fetches them) look
  // purely self-harmful and never get played. A card opts in with:
  //   cpuMeta: { recurringSymmetricAreaDamage: <D> }
  // We credit exactly ONE projected opponent-side tick per such Area
  // (symmetric to the single self-tick the rollout did count — bounded,
  // not extrapolated over many uncertain future turns) so the play is
  // valued on its true net symmetry, not the rollout's half view.
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.zone !== 'area') continue;
    let aScript = null;
    try { aScript = loadCardEffect(inst.name); } catch { aScript = null; }
    const D = aScript?.cpuMeta?.recurringSymmetricAreaDamage;
    if (typeof D !== 'number' || D <= 0) continue;
    const ctrl = inst.controller ?? inst.owner;
    if (ctrl == null || ctrl < 0) continue;
    const victimIdx = ctrl === 0 ? 1 : 0;        // the Area's controller's opponent
    const victims = gs.players[victimIdx];
    let projected = 0;
    for (const h of (victims?.heroes || [])) if (isAliveForEval(h)) projected += D;
    if (projected === 0) continue;
    // HP-equivalent weight 1.0 — same scale as the ownHp/oppWeightedHp
    // term that already booked the placer's own tick, so the two
    // halves cancel to the Area's true net value.
    if (ctrl === cpuIdx) score += projected;
    else score -= projected;
  }

  // ── Support zone occupancy (creatures + equips) ──────────────────
  // Per-zone base value is +30. Each card's own death may have
  // value to its owner (Hell Fox-style on-death tutors / damage /
  // gold), and other own creatures may be "chain sources" that fire
  // beneficial effects when an ally dies (Loyal Terrier window,
  // Loyal Shepherd revive, future cards with the same shape). Both
  // are read GENERICALLY off the per-card `cpuMeta` declaration:
  //
  //    cpuMeta: {
  //      onDeathBenefit: <number>,           // value to owner when this dies
  //      chainSource: {                       // declares: I react to ally deaths
  //        isArmed(engine, inst) → bool,      //   ready to fire?
  //        triggersOn(engine, tributeInst, sourceInst) → bool,
  //        valuePerTrigger: <number>,         //   chain payoff magnitude
  //      },
  //    }
  //
  // The eval combines these to compute "effective on-death value to
  // owner" per creature: own intrinsic benefit + sum of chain
  // bonuses from armed same-side sources whose `triggersOn` matches
  // this creature. The slot's "alive value" is then `30 - effective`
  // (clamped to a small floor so creatures keep some board-presence
  // value). On the OWN side this discounts sacrifice-fodder
  // creatures so MCTS prefers to feed them to chains. On the OPP
  // side it disincentivises killing opp's death-engines (we don't
  // want to fuel their plan).
  //
  // Chain sources themselves are NEVER discounted by chain bonuses —
  // killing your own Terrier ends the window, killing your own
  // Shepherd ends the revive HOPT for the rest of the turn. The
  // eval skips applying chain bonuses to any creature whose own
  // script declares `cpuMeta.chainSource`.
  const SLOT_BASE         = 30;
  const SLOT_FLOOR        = 5;
  // Pre-collect armed chain sources per side so each per-slot calc
  // doesn't re-walk cardInstances.
  const collectArmedChainSources = (ownerIdx) => {
    const sources = [];
    for (const inst of engine.cardInstances) {
      if (inst.owner !== ownerIdx) continue;
      // Support-zone Creatures (Loyal Terrier, Ruin Mourner, …) AND Area
      // cards (Temple of Sacrifice) can be chain sources — anything that
      // profits when an ally Creature dies / is sacrificed.
      // v333 zusaetzlich: HANDkarten, die sich ausdruecklich als
      // Handquelle deklarieren (Green Dragoneer). Sichtpruefung siehe
      // `chainSourceIsVisible` — die CPU rechnet nur mit Handkarten, die
      // sie kennen DARF.
      if (inst.zone !== 'support' && inst.zone !== 'area' && inst.zone !== 'hand') continue;
      if (inst.zone === 'support' && inst.faceDown) continue;
      const script = loadCardEffect(inst.name);
      const chain = script?.cpuMeta?.chainSource;
      if (!chain) continue;
      if (inst.zone === 'hand') {
        if (!chain.fromHand) continue;
        if (!chainSourceIsVisible(inst, cpuIdx)) continue;
      }
      try {
        if (chain.isArmed && !chain.isArmed(engine, inst)) continue;
      } catch { continue; }
      sources.push({ inst, chain, script });
    }
    return sources;
  };
  const ownChainSources = collectArmedChainSources(cpuIdx);
  const oppChainSources = collectArmedChainSources(oppIdx);
  /**
   * Effective "value to owner of this Creature dying" — sum of the
   * Creature's own `onDeathBenefit` plus every armed same-side
   * chain source that would fire on this death. Chain sources
   * themselves don't get chain bonuses applied (we don't want the
   * CPU killing its own engine).
   */
  const effectiveOnDeathValue = (inst, ownerIdx) => {
    if (!inst) return 0;
    const script = loadCardEffect(inst.name);
    const meta = script?.cpuMeta;
    let value = readOnDeathBenefit(script, engine, inst);
    if (meta?.chainSource) return value; // chain sources skip chain bonuses
    const eigene = ownerIdx === cpuIdx ? ownChainSources : oppChainSources;
    const fremde = ownerIdx === cpuIdx ? oppChainSources : ownChainSources;
    // v333: Quellen der eigenen Seite zaehlen wie bisher; zusaetzlich
    // Quellen der GEGENSEITE, die ausdruecklich auf Tode hier reagieren.
    const sources = [
      ...eigene.filter(q => (q.chain.side || 'own') === 'own'),
      ...fremde.filter(q => q.chain.side === 'opponent'),
    ];
    for (const { inst: srcInst, chain } of sources) {
      if (srcInst.id === inst.id) continue; // can't trigger off self
      try {
        if (chain.triggersOn && !chain.triggersOn(engine, inst, srcInst)) continue;
      } catch { continue; }
      value += chain.valuePerTrigger || 0;
    }
    return value;
  };
  // ── Feindliche Anhaengsel belegen zwar einen Slot, sind aber kein
  // Brett-Besitz ihres Wirts (Overheal Shock & Co., Vertrag
  // `cpuMeta.hostileAttachment`). Ein Slot, in dem AUSSCHLIESSLICH
  // solche Karten liegen, zaehlt fuer KEINE Seite: dem Wirt gehoert er
  // nicht, und der Angreifer bekommt hier bewusst auch nichts —
  // sein Gewinn ist der EFFEKT der Karte, den das Kartenskript ueber
  // `cpuMeta.cpuInstBonus` selbst bepreist. Sonst zaehlte derselbe
  // Vorteil zweimal.
  const slotCountsForOwner = (slot) =>
    (slot || []).some(cn => !isHostileAttachment(cn));
  let ownSupVal = 0, oppSupVal = 0;
  for (let hi = 0; hi < 3; hi++) {
    for (let z = 0; z < 3; z++) {
      const ownSlot = slotCountsForOwner(ps.supportZones?.[hi]?.[z]) ? (ps.supportZones[hi][z] || []) : [];
      const oppSlot = slotCountsForOwner(opp.supportZones?.[hi]?.[z]) ? (opp.supportZones[hi][z] || []) : [];
      if (ownSlot.length > 0) {
        const inst = engine.cardInstances.find(c =>
          c.owner === cpuIdx && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === z
        );
        const onDeath = effectiveOnDeathValue(inst, cpuIdx);
        ownSupVal += Math.max(SLOT_FLOOR, SLOT_BASE - onDeath);
      }
      if (oppSlot.length > 0) {
        const inst = engine.cardInstances.find(c =>
          c.owner === oppIdx && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === z
        );
        const onDeath = effectiveOnDeathValue(inst, oppIdx);
        oppSupVal += Math.max(SLOT_FLOOR, SLOT_BASE - onDeath);
      }
    }
  }
  score += ownSupVal - oppSupVal;

  // ── Per-instance CPU value bonus (generic) ───────────────────────
  // Card scripts can declare `cpuMeta.cpuInstBonus(engine, inst,
  // ownerIdx)` to add (or subtract) a custom number to the owner's
  // score for any state this inst contributes that the standard
  // support-slot / hand-value / counter terms miss. Used for:
  //   • Gigantisaur Chimera — high "I'm alive on the board" bonus
  //     beyond the +30 slot value (game-defining body).
  //   • The Great Wall of Deri — bonus only for the FIRST Wall on
  //     a side (duplicates contribute nothing).
  //   • Giga Steroids — bonus only when the grant is active AND
  //     the owner has a non-Spell/Attack/Creature Action ready to
  //     spend it on.
  //
  // Generic — the engine walks every tracked inst and lets each
  // card's function return its per-state bonus. Cards handle
  // dedup / gating internally. Throws inside the function are
  // swallowed; the inst contributes 0 in that case.
  for (const inst of engine.cardInstances) {
    const ctrl = inst.controller ?? inst.owner;
    if (typeof ctrl !== 'number' || ctrl < 0) continue;
    const script = loadCardEffect(inst.name);
    const fn = script?.cpuMeta?.cpuInstBonus;
    if (typeof fn !== 'function') continue;
    let v;
    try { v = fn(engine, inst, ctrl); } catch { continue; }
    if (typeof v !== 'number' || !v) continue;
    if (ctrl === cpuIdx) score += v;
    else if (ctrl === oppIdx) score -= v;
  }

  // ── Change Counters (Cosmic Depths) ──────────────────────────────
  // Generic counter resource — Analyzer / Gatherer / Argos accumulate
  // them passively from opponent draws and tutor effects. Counters
  // power downstream payoffs:
  //   • Argos hero effect: remove N → place a Lv N CD Creature.
  //   • Gatherer: remove ≤3 → draw N.
  //   • Analyzer: remove ≤6 → spawn 1 Invader Token per 2.
  //   • Cosmic Manipulation places counters on shuffle-back-this-turn.
  //   • Invader Token punishes the turn player who owns NO counters.
  //
  // Eval values each owned counter at a small flat amount, scaled UP
  // when the side has consumers on board (cards that turn counters
  // into payoff). Without consumers, counters are dead weight (worth
  // ~1 each — still > 0 so the eval prefers acquiring them, but
  // doesn't over-weight stockpiling). With consumers the per-counter
  // value rises so MCTS values both the buildup and the eventual
  // spend.
  //
  // The "consumer" detection uses the same `cpuMeta.counterConsumer`
  // declaration that future cards can opt into. Today: Argos,
  // Gatherer, Analyzer.
  const COUNTER_VALUE_BASE     = 1;
  const COUNTER_VALUE_CONSUMER = 4;
  const hasCounterConsumer = (ownerIdx) => {
    const ps2 = gs.players[ownerIdx];
    if (!ps2) return false;
    for (const h of (ps2.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (loadCardEffect(h.name)?.cpuMeta?.counterConsumer) return true;
    }
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.negated || inst.counters?.nulled) continue;
      if (loadCardEffect(inst.name)?.cpuMeta?.counterConsumer) return true;
    }
    return false;
  };
  const tallyChangeCountersForSide = (ownerIdx) => {
    let total = 0;
    const ps2 = gs.players[ownerIdx];
    if (!ps2) return 0;
    for (const h of (ps2.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      total += h._changeCounters || 0;
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      total += inst.counters?.changeCounter || 0;
    }
    return total;
  };
  const ownCounters = tallyChangeCountersForSide(cpuIdx);
  const oppCounters = tallyChangeCountersForSide(oppIdx);
  const ownPerCounter = hasCounterConsumer(cpuIdx) ? COUNTER_VALUE_CONSUMER : COUNTER_VALUE_BASE;
  const oppPerCounter = hasCounterConsumer(oppIdx) ? COUNTER_VALUE_CONSUMER : COUNTER_VALUE_BASE;
  score += ownCounters * ownPerCounter - oppCounters * oppPerCounter;

  // ── Invader Token end-of-turn pressure ───────────────────────────
  // Generic "punishes-turn-player-with-no-counters" eval term. Cards
  // can opt in via:
  //   cpuMeta.endOfTurnPunisher: {
  //     conditionFor: 'noChangeCounters',
  //     // expected damage when the punishment fires (50 for Invader
  //     // Token's damage mode); the discard branch is roughly worth
  //     // half the token's average impact, so we use the damage
  //     // amount as the projection — under-rewards discard, over-
  //     // rewards damage, but the median signal is right.
  //     expectedDamage: <number>,
  //   }
  // For the active player at eval time: if THEIR side controls 0
  // counters AND any opp-controlled punisher, project the damage
  // hit AT END OF TURN. Score deducts for own side (we'll get hit)
  // or rewards (opp will get hit).
  const punisherDamageAgainst = (sufferIdx) => {
    const ps2 = gs.players[sufferIdx];
    if (!ps2) return 0;
    if (tallyChangeCountersForSide(sufferIdx) > 0) return 0;
    let dmg = 0;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== sufferIdx) continue;
      const meta = loadCardEffect(inst.name)?.cpuMeta?.endOfTurnPunisher;
      if (!meta || meta.conditionFor !== 'noChangeCounters') continue;
      dmg += meta.expectedDamage || 0;
    }
    return dmg;
  };
  // The PROJECTED hit lands on whichever side is the active player at
  // eval time. If we're evaluating mid-CPU-turn, the CPU gets hit. Mid-
  // opp-turn, the opp gets hit. Use gs.activePlayer as the discriminator.
  const turnPi = gs.activePlayer;
  if (turnPi === cpuIdx) score -= punisherDamageAgainst(cpuIdx);
  else if (turnPi === oppIdx) score += punisherDamageAgainst(oppIdx);

  // ── Generic "pile-fuel" scaling ────────────────────────────────────
  // Cards that benefit from cards in their controller's discard pile
  // (and optionally still in the deck as latent fuel) opt in via:
  //
  //   cpuMeta: {
  //     pileFuel: {
  //       // Where this card's scaling counts FROM, with weights.
  //       // Default: support 1.0 + hand 0.5. A Phoenix-class card
  //       // that's still in hand contributes at half value because
  //       // the bonus only realises after it's summoned.
  //       presenceWeights: { support: 1.0, hand: 0.5 },
  //
  //       // True (default) → multiple copies sum their weights.
  //       // False           → uniqueness-locked cards take MAX weight
  //       //                   across copies (extras are redundant).
  //       stackable: true,
  //
  //       // What counts as fuel in the controller's discard pile.
  //       // Predicate against cards.json data.
  //       discardFilter: (cardData) => boolean,
  //       discardValue: <number per match>,
  //
  //       // Optional latent fuel — cards still in the deck that
  //       // COULD become discard fuel via mill / draw + discard.
  //       // Disabled unless all three deck* fields are set. The
  //       // deckMinSize floor makes self-mill cards (Cute Cat etc.)
  //       // look positive while decking out isn't a risk; below the
  //       // floor the deck-out penalty (further down) takes over.
  //       deckFilter: (cardData) => boolean,
  //       deckValue: <number per match>,
  //       deckMinSize: <int — deck.length must be >= this>,
  //     },
  //   }
  //
  // The brain reads this generically:
  //   • Walk active cardInstances on the controller's side; group
  //     by name; collect each instance's presenceWeight.
  //   • For unique scripts (stackable: false) take MAX weight,
  //     for stackable take SUM. (Caps at 1.0 effective for unique
  //     cards no matter how many in-hand copies sit there.)
  //   • For each name, multiply effective weight by:
  //       discardValue × (matching cards in controller's discard)
  //     plus, if deckMinSize gate passes:
  //       deckValue    × (matching cards still in deck)
  //   • Subtract the symmetric value computed for the opponent.
  //
  // Combined with the forceDiscard simulator above pushing candidates
  // into discardPile before re-scoring, every prompted discard sees
  // pileFuel-relevant cards becoming "actively beneficial to drop"
  // when the controller has a matching pile-fuel card anywhere. No
  // per-card hardcoding inside the eval — just a cpuMeta declaration
  // on the relying card.
  const computePileFuelContribution = (player, ownerIdx) => {
    // Group active sources by card name.
    const byName = new Map();
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      if (inst.faceDown) continue;
      if (inst.counters?.negated || inst.counters?.nulled) continue;
      const meta = loadCardEffect(inst.name)?.cpuMeta?.pileFuel;
      if (!meta) continue;
      const weights = meta.presenceWeights || { support: 1.0, hand: 0.5 };
      const w = weights[inst.zone];
      if (!w) continue;
      let entry = byName.get(inst.name);
      if (!entry) { entry = { meta, weights: [] }; byName.set(inst.name, entry); }
      entry.weights.push(w);
    }
    if (byName.size === 0) return 0;

    const cardDB = engine._getCardDB();
    let total = 0;
    for (const { meta, weights } of byName.values()) {
      const effective = (meta.stackable === false)
        ? Math.max(...weights)
        : weights.reduce((a, b) => a + b, 0);
      if (effective <= 0) continue;

      // Discard fuel
      if (meta.discardFilter && meta.discardValue) {
        let matches = 0;
        for (const cn of (player.discardPile || [])) {
          const cd = cardDB[cn];
          if (cd && meta.discardFilter(cd)) matches++;
        }
        total += meta.discardValue * matches * effective;
      }

      // Latent deck fuel — gated on a min deck size so the brain
      // doesn't chase mill into deck-out.
      if (meta.deckFilter && meta.deckValue && meta.deckMinSize != null) {
        if ((player.mainDeck || []).length >= meta.deckMinSize) {
          let matches = 0;
          for (const cn of (player.mainDeck || [])) {
            const cd = cardDB[cn];
            if (cd && meta.deckFilter(cd)) matches++;
          }
          total += meta.deckValue * matches * effective;
        }
      }
    }
    return total;
  };
  score += computePileFuelContribution(ps, cpuIdx);
  score -= computePileFuelContribution(opp, oppIdx);

  // ── Once-per-game spend cost ────────────────────────────────────
  // Generic "this card carries a finite, high-impact effect that's
  // gone once fired" eval term. Cards opt in via:
  //
  //   cpuMeta: {
  //     oncePerGameSpend: {
  //       spent(engine, pi) → boolean,   // has THIS player burned it?
  //       cost: <number>,                 // value lost when spent
  //     },
  //   }
  //
  // After the spend, we apply `cost` to the spender's score (negative
  // for own, positive for opp). MCTS rollouts will only commit the
  // spend when the local payoff exceeds this cost — so e.g. Guardian
  // Beast Zhu's "skip opp's turn + delete 16 cards" no longer fires
  // for marginal upside; the CPU saves it for game-deciding swings.
  // Walking each side's name set (hand + discard + deleted +
  // currently-tracked instances) catches the spend even after the
  // source card has died, since we still need to apply the cost.
  const opgSpendCostFor = (sideIdx) => {
    const ps2 = gs.players[sideIdx];
    if (!ps2) return 0;
    const seen = new Set();
    const collect = (arr) => { for (const n of (arr || [])) seen.add(n); };
    collect(ps2.hand);
    collect(ps2.discardPile);
    collect(ps2.deletedPile);
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) === sideIdx) seen.add(inst.name);
    }
    let total = 0;
    for (const name of seen) {
      const meta = loadCardEffect(name)?.cpuMeta?.oncePerGameSpend;
      if (!meta?.spent || typeof meta.cost !== 'number') continue;
      let spent = false;
      try { spent = !!meta.spent(engine, sideIdx); } catch {}
      if (spent) total += meta.cost;
    }
    return total;
  };
  score -= opgSpendCostFor(cpuIdx);
  score += opgSpendCostFor(oppIdx);

  // ── Rebelliokai archetype scoring ───────────────────────────────
  // Almost every Rebelliokai effect scales on the count of UNIQUE
  // Rebelliokai-Creature names in the controller's discard pile —
  // Tanuki Escape's bounce budget, Kirin Firebreath's strike count,
  // Kappa Sword Slash's level reduction, Oblivious Oni's gate, the
  // shared cost-pool for the Spells / Attacks. The eval treats every
  // unique name in the pile as fuel that future plays can spend.
  //
  // Scoring axes (per side, opp side scored as negative):
  //   • +25 per UNIQUE Rebelliokai Creature name in discard pile.
  //     The first copy of a name introduces archetype fuel; later
  //     copies of the same name don't add to the unique count and
  //     so contribute nothing — naturally encoding "no copies in
  //     discard yet → highest priority to land there".
  //   • +10 per Courtly Kirin in hand. Kirin's reaction-summon
  //     negate option is meaningful tempo while she sits in hand
  //     unspent; pulling her out of hand for archetype fuel costs
  //     us that defensive value, so the discard delta for Kirin
  //     comes out smaller than for non-Kirin Rebelliokai (≈+15 vs
  //     +25). Matches the user-spec'd "Kirin's discard desirability
  //     a bit lower than the others'".
  //
  // The eval delta naturally cascades: Inventing's MCTS gate sees
  // post-discard state with a Rebelliokai now in pile (+25) and
  // commits when CPU has Rebelliokai in hand. Champion's full-hand
  // refresh similarly scores positive when multiple Rebelliokai are
  // about to flip from hand → discard. No alwaysCommit override or
  // hard-coded force-discard heuristic needed — MCTS does the work.
  // Tuned so the discard delta for a fresh non-Kirin Rebelliokai (+40)
  // sits comfortably above one card's typical hand-value swing (~25),
  // letting MCTS commit Inventing / Champion when the CPU is sitting
  // on Rebelliokai pile-fuel even after factoring in opponent draws
  // and HOPT consumption. Kirin's reserve-value (+15) drops her
  // discard delta to +25 — a bit lower than the others, exactly
  // matching the user-spec'd gradient.
  const REBELLIOKAI_DISCARD_VALUE = 40;
  const cardDB = engine._getCardDB();
  const rebelScoreFor = (sidePs) => {
    if (!sidePs) return 0;
    const uniqueDiscardNames = new Set();
    for (const cn of (sidePs.discardPile || [])) {
      const cd = cardDB[cn];
      if (cd?.archetype === 'Rebelliokai' && cd?.cardType === 'Creature') {
        uniqueDiscardNames.add(cn);
      }
    }
    // Per-card hand-reserve credit — any Rebelliokai whose script
    // declares `cpuMeta.rebelliokaiHandReserveValue` contributes that
    // many points per copy in hand. Kirin opts in (15); future cards
    // can opt in without per-card branching here.
    let handReserveTotal = 0;
    for (const cn of (sidePs.hand || [])) {
      const v = loadCardEffect(cn)?.cpuMeta?.rebelliokaiHandReserveValue;
      if (typeof v === 'number') handReserveTotal += v;
    }
    return uniqueDiscardNames.size * REBELLIOKAI_DISCARD_VALUE
         + handReserveTotal;
  };
  score += rebelScoreFor(ps);
  score -= rebelScoreFor(opp);

  // ── Active-Area penalties ───────────────────────────────────────
  // Each Area script may export `cpuMeta.activeAreaPenalty(engine,
  // ownPs, oppPs)` returning a score delta to fold in while that
  // Area is on the board. The First Circle of Hell uses this to
  // penalise own odd-parity discards (loses the whole pile next
  // turn-start) and slightly credit forcing opp into the same trap.
  // Future Areas with persistent positional implications wear the
  // same hook.
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'area') continue;
    const fn = loadCardEffect(inst.name)?.cpuMeta?.activeAreaPenalty;
    if (typeof fn !== 'function') continue;
    try { score += (fn(engine, ps, opp) || 0); } catch { /* ignore */ }
  }

  // ── Per-Creature threat score ──────────────────────────────────────
  // Each owned Creature whose script exports `cpuMeta.threatScore`
  // contributes to the owner's score (positive when CPU controls it,
  // negative when opp does). The hook receives the live engine, the
  // instance, and the count of viable enemy targets against the
  // OPPOSING player — enough for Hydra-style "min(heads, targets)"
  // formulas without re-deriving target counts per card.
  const countViableTargetsAgainst = (player) => {
    let n = 0;
    for (const h of (player.heroes || [])) {
      if (h?.name && h.hp > 0) n++;
    }
    for (let hi = 0; hi < (player.heroes || []).length; hi++) {
      for (let z = 0; z < 3; z++) {
        const slot = player.supportZones?.[hi]?.[z] || [];
        if (slot.length > 0) n++;
      }
    }
    return n;
  };
  const targetsAgainstOpp = countViableTargetsAgainst(opp);
  const targetsAgainstPs  = countViableTargetsAgainst(ps);
  for (const inst of engine.cardInstances) {
    const fn = loadCardEffect(inst.name)?.cpuMeta?.threatScore;
    if (typeof fn !== 'function') continue;
    const ownerSide = (inst.controller ?? inst.owner);
    const viable = ownerSide === cpuIdx ? targetsAgainstOpp : targetsAgainstPs;
    let s = 0;
    try { s = fn(engine, inst, viable) || 0; } catch { s = 0; }
    if (!s) continue;
    if (ownerSide === cpuIdx) score += s;
    else if (ownerSide === oppIdx) score -= s;
  }

  // Ability totals — cumulative stacked abilities matter more than fresh ones.
  let ownAb = 0, oppAb = 0;
  for (let hi = 0; hi < 3; hi++) {
    for (let z = 0; z < 3; z++) {
      ownAb += (ps.abilityZones?.[hi]?.[z] || []).length;
      oppAb += (opp.abilityZones?.[hi]?.[z] || []).length;
    }
  }
  score += 15 * (ownAb - oppAb);

  // ── Engine-tier ability bonus ────────────────────────────────────
  // Some abilities are deck-defining "engines" — Divinity's free
  // level coverage, future engine abilities of similar weight. Each
  // such ability declares its magnitude on its script:
  //
  //    cpuMeta: { engineValue: 120 }
  //
  // The eval reads it generically. For each ability slot on each
  // hero we look up the BASE ability's script (zone[0]) — that
  // determines the engine identity, since Performance copies on top
  // inherit the base's school. Stack size multiplies the bonus, so
  // a Lv2 Divinity (or Divinity + Performance) is twice as valuable
  // as a Lv1.
  //
  // Symmetric: opp engine stacks count negatively, so MCTS values
  // stripping/disrupting an opp's engine ability proportionally.
  const sumEngineValue = (pl) => {
    let total = 0;
    for (let hi = 0; hi < (pl.heroes || []).length; hi++) {
      const zones = pl.abilityZones?.[hi] || [];
      for (const slot of zones) {
        if (!slot || slot.length === 0) continue;
        // zone[0] is the BASE ability — that's what governs the
        // engine identity. Performance copies stacked on top
        // inherit the base's role.
        const baseScript = loadCardEffect(slot[0]);
        const engineValue = baseScript?.cpuMeta?.engineValue || 0;
        if (engineValue > 0) total += engineValue * slot.length;
      }
    }
    return total;
  };
  score += sumEngineValue(ps) - sumEngineValue(opp);

  // ── Hero passive value ───────────────────────────────────────────
  // Heroes whose passive scales latent across many turns (Lilly's
  // draw-on-steal feeding the rest of the deck plan, future heroes
  // with similar long-tail value) opt into a flat eval bonus via:
  //
  //    cpuMeta: { heroPassiveValue: <number> }
  //
  // Each alive own hero with this meta adds the value to the score;
  // opp side subtracts. Dead heroes drop their bonus, so removing a
  // high-passive-value enemy hero (or losing one of our own) shows
  // up as a swing on TOP of the standard ±500 KO term — making MCTS
  // protect / hunt them proportionally to the magnitude their script
  // declares. Distinct from `engineValue` (which lives on Abilities
  // and scales with stack size) because Hero passives don't stack.
  const sumHeroPassiveValue = (pl) => {
    let total = 0;
    for (const h of (pl.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      const meta = loadCardEffect(h.name)?.cpuMeta;
      if (typeof meta?.heroPassiveValue === 'number') total += meta.heroPassiveValue;
    }
    return total;
  };
  score += sumHeroPassiveValue(ps) - sumHeroPassiveValue(opp);

  // Hand-value differential — weighted by card PLAYABILITY rather than
  // flat size. A card that can plausibly be played within the next ~2
  // turns is worth full value; a "dead" card (unaffordable within the
  // lookahead horizon, or locked out by current status) is worth much
  // less. This lets MCTS reward mulligans/searches/draws generically
  // based on hand QUALITY, not just card COUNT:
  //   • Mulligan: return dead cards (~5 value), draw replacements
  //     (~15 average) → positive delta, gate passes.
  //   • Search: pick the specific high-value card from deck → big delta.
  //   • Draw: expected-value new card (~15) beats gate threshold.
  // Duplicate copies beyond the first are half-value (HOPT / once-per-
  // turn cards don't benefit from multiple copies in hand).
  //
  // BOTH sides are valued PER-CARD now — the engine's snapshot already
  // exposes opp.hand and opp.mainDeck to the evaluator (no fog-of-war
  // at the engine level), so treating opp's hand as opaque was throwing
  // away signal the CPU could already see. Per-card valuation lets the
  // CPU budget defensively against a heavy opp threat (e.g. opp holds
  // a Lv4 Creature + matching ability) and offensively against a light
  // one (opp holds only blanks → bias toward tempo). The opp-side
  // valuation deliberately uses the SAME estimator with opp's pi so
  // costs/locks/synergies are scored from opp's perspective.
  //
  // Hand-value scoring — uses the shared `estimateHandCardValueFor`
  // helper so the same valuation drives both `evaluateState`'s hand
  // term and the deck-search heuristic in cpuGenericChoice (Magnetic
  // Glove / Potion picking the highest-impact card from deck instead
  // of random).
  const valueHand = (handArr, pi) => {
    let total = 0;
    const counts = {};
    for (const name of (handArr || [])) {
      const seen = counts[name] || 0;
      total += estimateHandCardValueFor(engine, pi, name, seen);
      counts[name] = seen + 1;
    }
    return total;
  };
  const ownHandValue = valueHand(ps.hand, cpuIdx);
  const oppHandValue = valueHand(opp.hand, oppIdx);
  score += ownHandValue - oppHandValue;

  // ── Coolness Stack value ──────────────────────────────────────────
  // Stack cards are future plays — they reach hand-equivalent
  // accessibility once they hit the top (or get summoned out via
  // Hipdall / Bifab / similar). Per-card valuation reuses the
  // hand-card estimator so push-from-hand is roughly net-neutral,
  // push-from-deck is net-positive, and pop-to-use loses the Stack
  // value the way a hand-play loses the hand-card value (the
  // effect's payoff lands in the other eval terms). No special pop
  // penalty — the natural Stack-value loss IS the cost of using the
  // resource, not extra punishment.
  //
  // TOP-OF-STACK BONUS: cards declaring `playableFromCoolnessStack`
  // or `summonableFromCoolnessStack` are FREE to use the moment
  // they're on top — that's strictly better than buried inventory.
  // Crediting the bonus only to the topmost card means MCTS rolls
  // the right ordering naturally: a "search and push" effect picks
  // the Stack-playable target because that pick scores higher in
  // the post-state, AND a follow-up push that buries it scores
  // worse than a follow-up that doesn't (so the rollout prefers
  // chains that leave the powerful Stack-only card uncovered when
  // possible). No hard-coded preference list — the value comes
  // from the eval delta the card's `playableFromCoolnessStack`
  // declaration already carries.
  const STACK_TOP_PLAYABLE_BONUS = 35;
  const ownStackValue = valueHand(ps.coolnessStack || [], cpuIdx);
  const oppStackValue = valueHand(opp.coolnessStack || [], oppIdx);
  score += ownStackValue - oppStackValue;
  const stackTopPlayableBonus = (stack) => {
    if (!stack?.length) return 0;
    const topName = stack[stack.length - 1];
    const topScript = loadCardEffect(topName);
    if (!topScript) return 0;
    return (topScript.playableFromCoolnessStack || topScript.summonableFromCoolnessStack)
      ? STACK_TOP_PLAYABLE_BONUS
      : 0;
  };
  score += stackTopPlayableBonus(ps.coolnessStack);
  score -= stackTopPlayableBonus(opp.coolnessStack);

  // ── Top-of-deck preview: cards the opponent will draw next turn ───
  // The CPU sees opp's deck order during MCTS rollouts (snapshot
  // includes mainDeck), so it already plays around future opp draws
  // implicitly. We surface that lookahead at evaluator level too,
  // weighted at half a hand card's value (opp has to draw and live
  // to next turn before they can play it). DECK_PREVIEW caps the
  // window so a deep deck doesn't drown the eval in noise — only
  // the next ~2 turns of draws matter for tactical planning.
  const DECK_PREVIEW = 4;
  const ownDeckPreviewValue = valueHand((ps.mainDeck || []).slice(0, DECK_PREVIEW), cpuIdx) * 0.5;
  const oppDeckPreviewValue = valueHand((opp.mainDeck || []).slice(0, DECK_PREVIEW), oppIdx) * 0.5;
  score += ownDeckPreviewValue - oppDeckPreviewValue;

  // ── Deck-out awareness ─────────────────────────────────────────────
  // When the CPU's deck is shrinking OR the opponent has shown ANY
  // mill capability this game, deck cards become a precious resource.
  // Penalty grows as the deck approaches 0, pulling MCTS away from
  // Trade / self-mill / aggressive draw plays that would hasten deck-
  // out. Symmetric bonus when the opponent's deck is thin (our own
  // mill pressure pays off).
  //
  // Tiers (stack):
  //   milled this game (sticky) → −2 per missing card below 30
  //                               (kicks in at any deck size once the
  //                                opponent has shown mill threat)
  //   deck ≤ 20                 → additional −5 per missing card below 20
  //   deck ≤ 10                 → additional −30 per missing card below 10
  //                               (drawing itself becomes net-negative:
  //                                each card pulled erodes this tier more
  //                                than the +15 average card is worth)
  //
  // At deck=0 with the mill flag the combined crisis term is ~−420, enough
  // to dominate local eval noise.
  const ownDeckSize = ps.mainDeck?.length || 0;
  const oppDeckSize = opp.mainDeck?.length || 0;
  const applyDeckOut = (deckSize, milled) => {
    let penalty = 0;
    if (milled && deckSize < 30) penalty += (30 - deckSize) * 2;
    if (deckSize <= 20) penalty += (20 - deckSize) * 5;
    if (deckSize <= 10) penalty += (10 - deckSize) * 30;
    return penalty;
  };
  score -= applyDeckOut(ownDeckSize, !!ps._oppHasMilledMe);
  score += applyDeckOut(oppDeckSize, !!opp._oppHasMilledMe);
  // Gold value depends on demand vs supply, not absolute amount. Demand =
  // gold the CPU could productively spend right now (artifacts in hand it
  // could actually play, on-board effects that charge gold to activate).
  //   • Every gold up to demand: 2× each — it unlocks a play
  //   • Every gold beyond demand: 0.2× each — hoarded, rarely useful
  // Turns Adventurousness (Action → +20 gold) from a flat +40 eval into a
  // context-dependent decision: strong when demand > supply, weak when
  // already covered. Symmetric for the opponent — draining gold from a
  // spend-ready opp is powerful, from a hoarder is nearly worthless.
  // ── Opfer-Fortschritts-Term (Als Auftrag, Deepsea-Diagnose) ──
  // Handkarten mit Opfer-Spec (Skript exportiert minCount/minSumLevel,
  // z.B. Dark Deepsea God: 2 Kreaturen, Summenlevel ≥ 4) sind für die
  // Suche unsichtbare Pläne: Ein Lv1-Body ≈ Lv2-Body in kurzfristiger
  // Bewertung, der Enabler-Wert liegt jenseits des Rollout-Horizonts —
  // gemessen: nur 29% der DDG-Festhänger-Spiele erreichten je
  // Summenlevel 4, aber 59.2% WR wenn DDG castet. Dieser Term belohnt
  // Board-Zustände proportional zum Fortschritt Richtung Spec-Erfüllung,
  // solange der Enabler auf der Hand liegt: 30 Punkte je opferbarem
  // Summenlevel (gedeckelt am Ziel) + 40 bei voller Erfüllbarkeit.
  // Generisch über den Spec-Vertrag, symmetrisch für den Gegner.
  const sacrificeProgress = (side) => {
    const sps = gs.players[side];
    let bonus = 0;
    const seenSpecs = new Set();
    for (const hn of (sps?.hand || [])) {
      if (seenSpecs.has(hn)) continue;
      seenSpecs.add(hn);
      let sc = null;
      try { sc = loadCardEffect(hn); } catch { continue; }
      const spec = sc?.sacrificeSpec
        || ((sc?.minSumLevel > 0) ? { minCount: sc.minCount, minSumLevel: sc.minSumLevel } : null);
      const msl = spec?.minSumLevel, mcnt = spec?.minCount || 0;
      if (!(msl > 0)) continue;
      let sacs = [];
      try { sacs = engine.getSacrificableCreatures ? (engine.getSacrificableCreatures(side) || []) : []; } catch {}
      const cnt = sacs.length;
      const sum = sacs.reduce((a, c) => a + (c.level || 0), 0);
      bonus += 30 * Math.min(sum, msl);
      if (cnt >= mcnt && sum >= msl) bonus += 40;
      // je Spec-Karte einmal — mehrere Kopien stapeln den Plan nicht
    }
    return bonus;
  };
  score += sacrificeProgress(cpuIdx) - sacrificeProgress(oppIdx);

  // ── Recycelbare Körper = Motor-Treibstoff (Messung 30.7.) ───────────
  // Die Zyklus-Decks (Deepsea-Linie und alles Künftige mit demselben
  // Vertrag) haben eine STRUKTURELLE Obergrenze, die die Bewertung bisher
  // nicht sah: Ein Tausch-Summon verbraucht eine Kreatur, die ÄLTER als
  // dieser Zug ist, und produziert eine frische, die im selben Zug nicht
  // mehr taugt. Die Zahl der Tausch-Züge je Runde ist damit exakt durch
  // die Zahl der ALTEN Board-Kreaturen gedeckelt — nicht durch die
  // Board-Größe. Gemessen im v106-Lauf: in 25% der eigenen Züge stand
  // KEINE einzige alte Kreatur (Bounce-Rate 1.17/Zug gegen Als 2.50),
  // und der stärkste Zusammenhang im ganzen Datensatz läuft über die
  // Bounce-Zahl. Ein reiner Kreaturen-Zähler bepreist das nicht: er
  // bewertet einen frisch getauschten Körper genauso wie einen, der
  // nächste Runde wieder Treibstoff ist.
  //
  // Generisch über `getBouncePlacementTargets` / `canPlaceOnOccupiedSlot`
  // — genau die Verträge, die die Tausch-Beschwörung überhaupt
  // definieren. Decks ohne diese Verträge bekommen 0, also exakt
  // Altverhalten. Bewusst degressiv (Wurzel): der Sprung von 0 auf 1
  // recycelbaren Körper entscheidet über "Motor läuft überhaupt", der
  // von 4 auf 5 ist Feinschliff. Symmetrisch für den Gegner.
  const recyclableFuel = (side) => {
    try {
      const sps = gs.players[side];
      if (!sps) return 0;
      // Trägt überhaupt eine Handkarte den Tausch-Vertrag? Sonst ist
      // der Treibstoff wertlos und der Term bleibt stumm.
      let hasCycler = false;
      const seen = new Set();
      for (const hn of (sps.hand || [])) {
        if (seen.has(hn)) continue;
        seen.add(hn);
        let sc = null;
        try { sc = loadCardEffect(hn); } catch { continue; }
        if (typeof sc?.canPlaceOnOccupiedSlot === 'function'
          || typeof sc?.getBouncePlacementTargets === 'function') { hasCycler = true; break; }
      }
      if (!hasCycler) return 0;
      // Alte eigene Kreaturen zählen — die Karten-Verträge kennen die
      // genaue Regel ("nicht in dieser Runde beschworen", inkl.
      // Ausnahmen wie Infected Squirrel), deshalb über sie statt über
      // eine nachgebaute turnPlayed-Prüfung.
      const slots = new Set();
      for (const hn of seen) {
        let sc = null;
        try { sc = loadCardEffect(hn); } catch { continue; }
        if (typeof sc?.getBouncePlacementTargets !== 'function') continue;
        try {
          for (const t of (sc.getBouncePlacementTargets(gs, side, engine) || [])) {
            if (t && t.heroIdx != null && t.slotIdx != null) slots.add(`${t.heroIdx}:${t.slotIdx}`);
          }
        } catch { /* einzelne Karte unklar → überspringen */ }
        if (slots.size) break;   // die Liste ist karten-unabhängig identisch
      }
      return 34 * Math.sqrt(slots.size);
    } catch { return 0; }
  };
  score += recyclableFuel(cpuIdx) - recyclableFuel(oppIdx);

  const ownGoldDemand = computeGoldDemand(engine, cpuIdx);
  const oppGoldDemand = computeGoldDemand(engine, oppIdx);
  const goldValue = (gold, demand) => {
    const met = Math.min(gold, demand);
    const excess = Math.max(0, gold - demand);
    return met * 2 + excess * 0.2;
  };
  score += goldValue(ps.gold || 0, ownGoldDemand) - goldValue(opp.gold || 0, oppGoldDemand);

  // Opponent-turn lookahead via status damage anticipation. Burn/poison
  // stacks on a living hero will tick on the respective owner's next turn;
  // bake that expected damage into the score now so MCTS sees "my 40 HP
  // hero with 2 burn stacks is effectively dead" and "their low-HP burn'd
  // hero is worth leaving alone for the poison to finish". Pending kill
  // = full kill-swing; pending non-lethal burn = ~0.5× expected HP loss.
  //
  // Own-side poison is NOT treated as a standing downside unless the tick
  // is lethal: several of our own cards deliberately poison friendly
  // targets (Zsos'Ssar's Decay-cast cost, Pet Snake's summon cure-swap,
  // Poison Pollen's AoE that also tags our creatures) because the same
  // stacks are the fuel for damage-scaling effects (Zsos'Ssar's "+40 per
  // poisoned target" single-target multiplier, etc.). Penalizing non-
  // lethal self-poison causes MCTS to shy away from the very plays those
  // decks are built around. Lethal ticks still trigger the full crisis
  // penalty — we still care about not actually LOSING the hero.
  const STATUS_DMG_PER_STACK = 30; // baseline; matches Medea's 30-per-stack doubling
  for (const h of (ps.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    const burn = statusStacks(h, 'burned');
    const poison = statusStacks(h, 'poisoned');
    const totalDmg = STATUS_DMG_PER_STACK * (burn + poison);
    if (totalDmg >= h.hp) { score -= 400; continue; } // anticipated kill — crisis
    // Burn always drains (no "good burn" synergy exists in this game).
    if (burn > 0) score -= 0.5 * STATUS_DMG_PER_STACK * burn;
    // Non-lethal own poison is intentionally ignored — see comment above.
  }
  for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
    const h = opp.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    const stacks = statusStacks(h, 'burned') + statusStacks(h, 'poisoned');
    if (stacks <= 0) continue;
    const dmg = STATUS_DMG_PER_STACK * stacks;
    if (dmg >= h.hp) score += 400; // anticipated kill
    else {
      const threat = mctsEnemyHeroDynamicValue(engine, oppIdx, hi, oppTeamMaxSchoolLvl);
      score += 0.5 * dmg * threat;
    }
  }

  // ── Angriffswert: Helden-ATK × verfügbare Umsetzer (31.7.) ────────
  // Die Eval bepreiste ATK bisher NUR beim GEGNER (Antizipations-Block
  // direkt darunter) und die EIGENE gar nicht — `atk` kam in der ganzen
  // Funktion genau einmal vor, als `oppMaxAtk`. Für jedes Deck, dessen
  // Plan darin besteht, die ATK eines Helden zu steigern (Nero Zira:
  // +30 permanent je Kreatur-Platzierung, bis 5×/Zug; ATK-Equipment;
  // Buff-Kreaturen), war der gesamte Aufbau damit unsichtbar: eine
  // Beschwörung, die "nur" ATK erzeugt, hat ein Eval-Delta von exakt 0,
  // und jedes Wert-Gate lehnt sie folgerichtig ab. Dieselbe Bauart wie
  // die Deepsea-Swap-Blindheit ("der Swap muss dem Evaluator seinen
  // Gewinn zeigen"). Gemessen im Mawstruck-Datensatz (1268 Spiele):
  // 0.50 Kreatur-Eintritte je eigenem Zug bei einem Cap von 5, 63% der
  // eigenen Züge ganz ohne Eintritt, 5er-Cap in 0.1% der Züge erreicht.
  //
  // ATK wird in diesem Spiel NICHT automatisch zu Schaden — ein Held
  // schlägt nur über Attack-Karten zu oder über Effekte, die seine ATK
  // ausschütten. Der Term skaliert deshalb mit der Zahl der real
  // vorhandenen UMSETZER, statt ATK flach zu bepreisen:
  //   (a) Attack-Karten auf der Hand — generisch, deckunabhängig
  //   (b) aktive Support-Zonen-Karten, die sich per
  //       `cpuMeta.atkConversionsPerTurn` als ATK-Umsetzer deklarieren
  //       (Infected Greatmaw, Sacrificial Dagger)
  // Ohne Umsetzer bleibt der Term 0 — genau das richtige Signal für
  // einen Helden mit hoher ATK, die er nie ausschütten kann.
  //
  // Gezählt wird die HÖCHSTE ATK unter den lebenden, nicht-CC'ten
  // eigenen Helden: Umsetzer dieser Bauart wählen ihren Helden entweder
  // frei ("deal damage equal to the Attack stat of one of your Heroes")
  // oder hängen an einem festen, und in beiden Fällen würde der Pilot
  // den stärksten nehmen. Spiegelt bewusst die `oppMaxAtk`-Logik.
  //
  // Symmetrisch, damit MCTS nicht die eigene ATK pumpt und die des
  // Gegners ignoriert. Der Antizipations-Block darunter modelliert eine
  // ANDERE Größe (die Kill-Schwelle im nächsten Zug, ±400); die
  // Überlappung ist über das kleine Gewicht bewusst klein gehalten.
  {
    const atkCardDB = engine._getCardDB();
    const atkSideValue = (idx) => {
      const pl = gs.players[idx];
      if (!pl) return 0;
      let maxAtk = 0;
      for (const h of (pl.heroes || [])) {
        if (!isAliveForEval(h)) continue;
        if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
        const a = h.atk || 0;
        if (a > maxAtk) maxAtk = a;
      }
      if (maxAtk <= 0) return 0;
      let conv = 0;
      // (a) Attack-Karten auf der Hand — der generische Umsetzer.
      // Bewusst auf EINEN Umsetzer gedeckelt, egal wie viele Attack-
      // Karten liegen: eine Attack-Karte kostet die Aktion des Zuges,
      // drei davon auf der Hand verdreifachen den Schaden also nicht.
      // Die deklarierten Umsetzer unter (b) stapeln dagegen, weil sie
      // Kreatur-/Equipment-Effekte sind und keine Aktion kosten.
      for (const nm of (pl.hand || [])) {
        const cd = atkCardDB[nm];
        if (cd && cd.cardType === 'Attack') { conv = 1; break; }
      }
      // (b) Deklarierte Umsetzer auf dem Board. Statusgeprüft wie jede
      // andere Kreatur-/Artefakt-Passive: eine negierte oder gefrorene
      // Karte setzt nichts um.
      for (const inst of (engine.cardInstances || [])) {
        if (conv >= ATK_EVAL_MAX_CONVERSIONS) break;
        if (!inst || inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== idx) continue;
        if (inst.faceDown) continue;
        const c = inst.counters || {};
        if (c.negated || c.nulled || c.frozen || c.stunned) continue;
        let n = 0;
        try { n = loadCardEffect(inst.name)?.cpuMeta?.atkConversionsPerTurn || 0; } catch { n = 0; }
        if (n > 0) conv += n;
      }
      if (conv <= 0) return 0;
      return Math.min(conv, ATK_EVAL_MAX_CONVERSIONS) * maxAtk * ATK_EVAL_PER_CONVERSION;
    };
    score += atkSideValue(cpuIdx) - atkSideValue(oppIdx);
  }

  // Opponent-turn attack anticipation. The opp's highest-atk living,
  // un-CC'd hero is a proxy for their next-turn damage output — assume one
  // of their Attack cards scales with that stat and lands on the CPU's
  // most vulnerable hero. This is the "my 40-HP hero dies next turn to
  // their 180-atk bruiser" signal that status-anticipation alone misses.
  // Deliberately conservative: we don't peek at their hand, we don't
  // try to simulate their whole turn; one atk-worth of pressure per turn.
  let oppMaxAtk = 0;
  for (const h of (opp.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
    const a = h.atk || 0;
    if (a > oppMaxAtk) oppMaxAtk = a;
  }
  if (oppMaxAtk > 0) {
    // Effective HP of our weakest hero — Immortal floors at 1 since the
    // buff expires before the opp can actually attack, but it still buys
    // a turn of survival in some corner cases.
    let weakestOwnHp = Infinity;
    for (const h of (ps.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (h.hp < weakestOwnHp) weakestOwnHp = h.hp;
    }
    if (weakestOwnHp !== Infinity) {
      if (oppMaxAtk >= weakestOwnHp) score -= 400; // anticipated kill next turn
      else score -= 0.4 * oppMaxAtk;                // expected chip damage
    }
  }

  // ── Self-CC / self-immunity disincentive ────────────────────────
  // The engine grants `statuses.immune` (one-turn CC immunity) to
  // every hero whose Frozen / Stunned / Negated / Bound status
  // expires at END phase (`processStatusExpiry`). MCTS rollouts
  // fast-forward through CPU's End phase before scoring, so a
  // self-Freeze cast (e.g. self-Icebolt) leaves the rollout's eval
  // looking at an own hero who's now `immune` — which `isTargetImmune`
  // treats as an UN-targetable safe state. Without an explicit
  // penalty, the rollout can rationalise self-CC as "I bought a
  // turn of CC-immunity" and pay an absurd HP/spell cost for the
  // privilege. The buff lasts ONE turn and protects only against
  // negative statuses, not damage — its real value is much lower
  // than any spell + 100 HP it took to gain. Penalize own immune
  // heavily; symmetric small reward for opp immune (we couldn't
  // CC them next turn anyway, but at least they used a slot up).
  for (const h of (ps.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.immune) score -= 200;
  }
  for (const h of (opp.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.immune) score += 30;
  }

  // Ascension progress. When a hero becomes ascensionReady, the next hand
  // ascension play flips them into a far stronger form — credit this both
  // at the incremental-progress level (so MCTS can see "equipping the Sword
  // moved me from 0.0 → 0.5") and as a jump when fully ready. Symmetric
  // penalty for opponent progress. Uses each hero's script-declared
  // ascensionProgress(engine, pi, hi) → 0..1 when available.
  // Per-orb reward MUST out-pay the in-hand "Ascension-critical"
  // boost (`estimateHandCardValueFor` floors qualifying cards at 60)
  // OR else "play the orb-progresser" exactly cancels "keep it in
  // hand": −60 hand-value + 30 on-board + (per-orb) orb-progress.
  // With the old 250-per-full-collection (= 50/orb at N=5), the
  // delta summed to 0 (or negative) and `mctsGatedActivation` failed
  // the +3 commit threshold — the CPU sat on its hand. Bumped to
  // 400-per-full-collection (= 80/orb at N=5) so each progress
  // step nets +50 vs the hoard (Beato's worst-case orb count). For
  // heroes with FEWER orbs the per-orb value is naturally larger
  // (Arthor N=2 → 200/orb, Layn N=1 → 400/orb), so the same fix
  // produces an even bigger play-incentive automatically — no
  // per-deck calibration needed. The `ascensionReady` snapshot
  // (450) stays a discrete jump above 4/5-progress (320) so the
  // CPU can still tell "ready" from "almost ready" — bumped in
  // lockstep with the per-orb rate to keep monotonicity.
  const scoreAscension = (ownerIdx, sign) => {
    const pss = gs.players[ownerIdx];
    if (!pss) return;
    for (let hi = 0; hi < (pss.heroes || []).length; hi++) {
      const h = pss.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.ascensionReady) { score += sign * 450; continue; }
      const script = loadCardEffect(h.name);
      if (typeof script?.ascensionProgress !== 'function') continue;
      try {
        const p = script.ascensionProgress(engine, ownerIdx, hi) || 0;
        if (p > 0) score += sign * 400 * p;
      } catch {}
    }
  };
  scoreAscension(cpuIdx, +1);
  scoreAscension(oppIdx, -1);

  // ── Cardinal Beasts alt win condition ──
  // All 4 Cardinal Beasts on your Support Zones = instant win. Reward
  // progress aggressively so MCTS rollouts + candidate scoring steer
  // decks like Dance of the Butterflies toward assembly rather than
  // playing for HP-based victories they can't actually win.
  //   - Per beast on board: +250 (comparable to ascension-ready bonus)
  //   - Bonus for having 3 on board (one more = win): +500
  //   - All 4 on board: +100000 (terminal-value equivalent to game win)
  //   - Each in-hand beast: +80 — closer to "ready to summon" than a
  //                              deck copy, so worth more once a viable
  //                              summoner exists on the team
  //   - Each in-deck beast: +30 — still part of the assembly path, but
  //                              needs to be drawn / tutored first
  //   - Can-potentially-complete bonus (all 4 reachable): +400
  // Symmetric penalty when the opponent is progressing.
  const { CARDINAL_NAMES: CARDINAL_BEAST_NAMES } = require('./_cardinal-shared');
  const scoreCardinalBeasts = (pi) => {
    const pss = gs.players[pi];
    if (!pss) return 0;
    const onBoard = new Set();
    for (let hi = 0; hi < (pss.heroes || []).length; hi++) {
      for (let zi = 0; zi < (pss.supportZones?.[hi] || []).length; zi++) {
        const slot = (pss.supportZones[hi] || [])[zi] || [];
        if (slot.length > 0 && CARDINAL_BEAST_NAMES.includes(slot[0])) {
          onBoard.add(slot[0]);
        }
      }
    }
    if (onBoard.size >= 4) return 100000;
    const inHand = new Set();
    const inDeck = new Set();
    for (const n of CARDINAL_BEAST_NAMES) {
      if (onBoard.has(n)) continue;
      if ((pss.hand || []).includes(n)) inHand.add(n);
      else if ((pss.mainDeck || []).includes(n)) inDeck.add(n);
    }
    const accessibleSize = inHand.size + inDeck.size;
    let s = onBoard.size * 250 + inHand.size * 80 + inDeck.size * 30;
    if (onBoard.size === 3) s += 500; // one away from the win
    if (onBoard.size + accessibleSize === 4) s += 400; // complete set reachable
    return s;
  };
  score += scoreCardinalBeasts(cpuIdx);
  score -= scoreCardinalBeasts(oppIdx);

  return score;
}

// Dispatches an Action-Phase candidate to the right helper. Returns true
// if the play actually shrank the CPU's hand (a real play occurred).
async function applyActionCandidate(engine, helpers, candidate) {
  if (istAbgebrochen(engine)) return false;
  const cpuIdx = engine._cpuPlayerIdx;
  const handBefore = engine.gs.players[cpuIdx].hand.length;
  const { cardName, cardType, handIdx, heroIdx } = candidate;
  if (cardType === 'AbilityAction') {
    // Ability-action activation during rollout. Track HOPT claim as the
    // "did this fire" signal since hand won't shrink.
    const hoptKey = `ability-action:${candidate.abilityName}:${cpuIdx}`;
    const hoptBefore = engine.gs.hoptUsed?.[hoptKey];
    await helpers.doActivateAbility(helpers.room, cpuIdx, {
      heroIdx, zoneIdx: candidate.zoneIdx,
    });
    return engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn && hoptBefore !== engine.gs.turn;
  }
  if (cardType === 'HeroEffectAction') {
    // Hero-effect activation during rollout (Champion, the Stormbringer,
    // …). Same HOPT-claim signal as AbilityAction above — the hand
    // doesn't shrink for hero-effect activations either, so the HOPT
    // stamp is what tells us the play actually fired vs. fizzled.
    const hoptKey = `hero-effect:${cardName}:${cpuIdx}:${heroIdx}`;
    const hoptBefore = engine.gs.hoptUsed?.[hoptKey];
    await helpers.doActivateHeroEffect(helpers.room, cpuIdx, { heroIdx });
    return engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn && hoptBefore !== engine.gs.turn;
  }
  if (cardType === 'Creature') {
    // Prefer the pre-chosen zone from candidate enumeration; fall back to
    // the heuristic picker if the candidate didn't specify one (legacy /
    // non-Action-Phase caller) or the chosen slot is no longer free.
    let zoneSlot = candidate.zoneSlot;
    const ps2 = engine.gs.players[cpuIdx];
    const slotTaken = zoneSlot != null
      && (((ps2.supportZones?.[heroIdx] || [])[zoneSlot] || []).length > 0);
    if (zoneSlot == null || zoneSlot < 0 || slotTaken) {
      zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, heroIdx, cardName);
    }
    if (zoneSlot < 0) return false;
    maybeSetCrossSideHint(engine, cpuIdx, cardName);
        await helpers.doPlayCreature(helpers.room, cpuIdx, {
      cardName, handIndex: handIdx, heroIdx, zoneSlot,
    });
  } else if (cardType === 'Spell' || cardType === 'Attack') {
    noteDamageImpact(engine, cpuIdx, cardName);
    await helpers.doPlaySpell(helpers.room, cpuIdx, {
      cardName, handIndex: handIdx, heroIdx,
    });
  } else {
    return false;
  }
  return engine.gs.players[cpuIdx].hand.length < handBefore;
}

// Plays out the rest of the CPU's turn after a candidate action. Advances
// through the End Phase so onTurnEnd hooks fire (Ghuanjun removing self-
// Immortal, timed buffs cleaning up, expiring effects, etc.) — evaluating
// before those fire systematically overvalues self-buffs that clean up
// at end-of-turn. Stops before switchTurn: the human's turn is not modeled.
async function rolloutRestOfTurn(engine, helpers) {
  if (istAbgebrochen(engine)) return marke(engine, `aus:rolloutRestOfTurn#1:abbruch@zug${engine.gs.turn}p${engine.gs.activePlayer}ph${engine.gs.currentPhase}`);
  const cpuIdx = engine._cpuPlayerIdx;
  // If phase is still Action (combo mechanics held it open), advance once.
  if (engine.gs.currentPhase === 3) {
    try { await engine.advancePhase(cpuIdx); } catch {}
  }
  // Play Main Phase 2 if we're there. runMainPhase is idempotent — it
  // stops when no further progress can be made.
  if (engine.gs.currentPhase === 4) {
    try { await runMainPhase(engine, helpers); } catch (err) {
      // Swallow — evaluator scores the partial state.
      cpuLog(`  [MCTS] rollout runMainPhase threw:`, err.message);
    }
  }
  // tryAscend runs as the last Main-2 action — include it for accurate eval.
  try { await tryAscend(engine, helpers); } catch {}
  // Advance Main2 → End so onTurnEnd hooks fire. This is the key difference
  // between "what the board looks like at end of Main 2" and "what the
  // opponent will actually see" — timed self-buffs (e.g. Ghuanjun Immortal)
  // are explicitly cleaned up here, so MCTS stops rewarding them.
  if (engine.gs.currentPhase === 4) {
    try { await engine.advancePhase(cpuIdx); } catch {}
  }
  // ── Opp-upkeep sim ─────────────────────────────────────────────────────
  // Extend rollout past End Phase into the opponent's Start + Resource
  // phases. Their status-damage ticks, onTurnStart hooks, draws, and
  // resource gain all fire now — so the evaluator sees the REAL post-turn
  // state rather than an approximation.
  if (engine.gs.currentPhase === 5 && engine.gs.activePlayer === cpuIdx && !engine.gs.result) {
    try { await engine.advancePhase(cpuIdx); } catch {}
    // After advancePhase from End, switchTurn fires and activePlayer flips.
    // Bounded loop: advance up to a handful of times until we reach opp's
    // Main 1 (phase 2) or the game ends. A couple of phases are typically
    // auto-advanced by the engine; this covers any manual steps left over.
    let guard = 6;
    while (guard-- > 0) {
      if (engine.gs.result) break;
      if (engine.gs.activePlayer === cpuIdx) break; // defensive: back to us
      if (engine.gs.currentPhase >= 2) break; // reached opp Main 1
      try { await engine.advancePhase(engine.gs.activePlayer); } catch { break; }
    }
  }

  // ── Multi-turn simulation loop (horizon 1..4) ──────────────────────────
  // Each iteration simulates ONE full turn. After each runCpuTurn, the
  // engine's End→switchTurn→auto-advance cascade parks us in the NEXT
  // player's Main 1. Flip `_cpuPlayerIdx` to the current active player
  // each iteration so the brain plays for the right side. `_inMctsSim`
  // is true throughout → nested MCTS short-circuits to heuristic/eval-
  // greedy depending on _rolloutBrain.
  const savedCpuIdx = engine._cpuPlayerIdx;
  try {
    for (let t = 1; t <= _rolloutHorizon; t++) {
      if (engine.gs.result) break;
      if (engine.gs.currentPhase !== 2) break; // not in Main 1, can't invoke
      engine._cpuPlayerIdx = engine.gs.activePlayer;
      try {
        await runCpuTurn(engine, helpers);
      } catch (err) {
        cpuLog(`  [MCTS] horizon turn ${t} (pi=${engine._cpuPlayerIdx}) sim threw:`, err.message);
        // Don't break — next turn might still run fine. Evaluator scores
        // the partial state at the end.
      }
    }
  } finally {
    engine._cpuPlayerIdx = savedCpuIdx;
  }
}

// One rollout of a candidate with an optional scripted target plan. Returns
// { score, record, completed }. Record is only populated when requested.
async function mctsRunOneRollout(engine, helpers, candidate, { plan = null, record = false } = {}) {
  if (istAbgebrochen(engine)) return { score: -Infinity, record: [], completed: false };
  const cpuIdx = engine._cpuPlayerIdx;
  const candidateName = candidate?.cardName || candidate?.abilityName || '?';
  // Trail the rollout BEFORE snapshotting — the snapshot itself can
  // trip the heap guard, and we want the trail to name this candidate.
  // Note: trail-on-rollout is the ONE kind that's recorded even when
  // _inMctsSim is true (set on the OUTER MCTS rollout for nested ones),
  // so the trail names every rollout boundary across all nesting depths.
  if (typeof engine._trailWrite === 'function') {
    engine._trailWrite('rollout', {
      cardName: candidateName,
      note: `${candidate?.cardType || ''} lvl${candidate?.level ?? '?'} hero${candidate?.heroIdx ?? '?'}`,
    });
  }
  // Periodic forced GC. Only fires when Node was launched with
  // `--expose-gc`; otherwise it's a no-op. In tight rollout loops V8's
  // incremental GC can't keep up with the per-rollout transient
  // allocation, so committed memory climbs even though everything is
  // technically reclaimable. Every 100th rollout, give V8 a chance to
  // do a full Mark-Compact pass before the heap thresholds trip. Costs
  // ~10-50ms per call, so amortized ~0.5ms per rollout. If self-play
  // is launched WITHOUT --expose-gc this is a no-op and the heap
  // pressure is managed by the per-turn snapshot cap and heap checks.
  if (typeof global.gc === 'function' && (engine._snapshotsTaken || 0) % 100 === 0) {
    try { global.gc(); } catch {}
  }
  // Per-candidate heap-delta tracking. Sample heapUsed BEFORE snapshot
  // and AFTER restore; the difference is what each rollout failed to
  // reclaim. Steady-state ~0; in a death spiral, accumulates per
  // rollout. Heap-trip diagnostics surface the top offenders so the
  // user can see "Steam Dwarf Brewer leaked 12MB/rollout × 200 calls".
  const heapBefore = process.memoryUsage().heapUsed;
  // Capture hook state PRE-rollout. Diffed against the post-rollout state
  // (read just before engine.restore() puts it back) to attribute hook
  // fires to THIS rollout — independent of who the candidate is. When
  // a rollout leaks more than LEAKY_ROLLOUT_THRESHOLD_MB, we emit a
  // `leakyRollout` trail entry naming the top hooks AND top board
  // cards that fired during it. That is what tells us the actual
  // source (Steam Dwarf Brewer-as-board-passive vs Steam Dwarf
  // Brewer-as-candidate, or some entirely different card on the board).
  const histBefore = { ...engine._hookHistogramThisTurn };
  const firesBefore = { ...engine._hookFiresByCard };
  // Snapshot can throw the heap-trip guard. Attach the in-flight
  // candidate so the post-mortem in self-play logs names the exact card
  // whose rollout pushed allocation over the cap — without this the
  // diagnosis only points at mctsRunOneRollout, which names every rollout.
  let snap;
  try {
    snap = engine.snapshot();
  } catch (err) {
    const cn = candidate?.cardName || candidate?.abilityName || 'unknown';
    const ct = candidate?.cardType ? ` ${candidate.cardType}` : '';
    const lv = candidate?.level != null ? ` lvl${candidate.level}` : '';
    const hi = candidate?.heroIdx != null && candidate.heroIdx >= 0 ? ` hero${candidate.heroIdx}` : '';
    err.message = `${err.message} [rollout candidate: "${cn}"${ct}${lv}${hi}]`;
    throw err;
  }
  // Mark "inside MCTS sim" so the engine's CPU driver (fired by switchTurn
  // during opp-upkeep advances) doesn't recurse into the opp's brain. This
  // is separate from _fastMode — self-play games run with _fastMode=true
  // end-to-end, so we can't use that flag as the "don't invoke driver"
  // signal any more.
  const prevInSim = engine._inMctsSim;
  const prevRolloutStartT = engine._mctsRolloutStartT;
  engine._inMctsSim = true;
  engine._mctsRolloutStartT = Date.now();
  engine.enterFastMode();
  engine._mctsTargetPlan = plan ? [...plan] : null;
  const recordBuf = record ? [] : null;
  if (recordBuf) { engine._mctsTargetRecord = recordBuf; engine._mctsRecordOverflowed = false; }
  // Save+restore _cpuLogSilent rather than blindly setting it to false at
  // the end — nested rollouts (e.g. a Main-Phase gate fired inside an
  // outer Action-Phase rollout) would otherwise unsilence the outer scope
  // halfway through and spam stdout for the rest of the outer rollout.
  const prevSilent = _cpuLogSilent;
  _cpuLogSilent = true;
  let score = -Infinity;
  let completed = false;
  try {
    const applied = await applyActionCandidate(engine, helpers, candidate);
    if (applied) await rolloutRestOfTurn(engine, helpers);
    score = evaluateState(engine, cpuIdx);
    completed = true;
  } catch (err) {
    _cpuLogSilent = prevSilent;
    cpuLog(`  [MCTS] rollout threw on "${candidate.cardName}":`, err.message);
    _cpuLogSilent = true;
  } finally {
    delete engine._mctsTargetPlan;
    if (recordBuf) delete engine._mctsTargetRecord;
    engine.exitFastMode();
    // Capture hook state RIGHT BEFORE restore — restore reverts these
    // counters, so this is our only chance to read what fired during
    // the rollout. The diff against histBefore / firesBefore = the
    // rollout's own hook activity, free of cross-rollout pollution.
    const histAfter = { ...engine._hookHistogramThisTurn };
    const firesAfter = { ...engine._hookFiresByCard };
    engine.restore(snap);
    resetPromptCycle(engine);
    engine._inMctsSim = prevInSim;
    engine._mctsRolloutStartT = prevRolloutStartT;
    _cpuLogSilent = prevSilent;
    // Per-candidate heap-delta tracking (post-restore). A healthy GC
    // makes this ~0 — the snapshot/restore pair should release every
    // transient. Death-spiral signature: per-rollout deltas in the MB
    // range that accumulate across hundreds of rollouts before V8
    // can keep up. Surfaced via `_describeHeapTripDiagnostics`.
    const heapAfter = process.memoryUsage().heapUsed;
    const deltaMb = (heapAfter - heapBefore) / 1024 / 1024;
    if (!engine._candidateHeapDelta) engine._candidateHeapDelta = Object.create(null);
    const cur = engine._candidateHeapDelta[candidateName] || { calls: 0, totalMb: 0 };
    cur.calls += 1;
    cur.totalMb += deltaMb;
    engine._candidateHeapDelta[candidateName] = cur;
    // ── v385: ZWEITER, NICHT ZURUECKGESETZTER TOPF ────────────────
    // `_candidateHeapDelta` wird in `snapshot()` bei JEDEM LIVE-Zug-
    // wechsel genullt — es ist ein Pro-Zug-Zaehler fuer die
    // Ueberlast-Diagnose. Wer am Partieende ausliest, sieht deshalb nur
    // den letzten Zug (im Absturz-Trail vom 14.8.: ein einziger
    // Eintrag). Fuer die Frage "welcher Kandidat kostet ueber die ganze
    // Partie wie viel, und WIE OFT wird er bewertet" braucht es einen
    // Topf, den niemand leert.
    if (!engine._candidateHeapTotal) engine._candidateHeapTotal = Object.create(null);
    const ges = engine._candidateHeapTotal[candidateName] || { calls: 0, totalMb: 0 };
    ges.calls += 1;
    ges.totalMb += deltaMb;
    engine._candidateHeapTotal[candidateName] = ges;
    // Leaky-rollout detector: when a rollout's net heap delta exceeds
    // the threshold, dump the per-rollout hook + per-card fire breakdown
    // as a trail entry. This is independent of which CANDIDATE the
    // MCTS chose — the breakdown shows which BOARD cards' hooks fired
    // and which hook NAMES dominated, so we can identify a passive on
    // the board (Steam Engine, etc.) or an opp-side reaction as the
    // actual leak source. 0.5MB is well above normal noise (transient
    // alloc cleared by restore) and well below the per-rollout deltas
    // seen in the Steam-Dwarf death spiral (~3-7MB/rollout).
    const LEAKY_ROLLOUT_THRESHOLD_MB = 0.5;
    if (deltaMb >= LEAKY_ROLLOUT_THRESHOLD_MB && typeof engine._trailWrite === 'function') {
      const diffMap = (after, before) => {
        const out = {};
        for (const k of Object.keys(after)) {
          const d = (after[k] || 0) - (before[k] || 0);
          if (d > 0) out[k] = d;
        }
        return out;
      };
      const hookDiff = diffMap(histAfter, histBefore);
      const cardDiff = diffMap(firesAfter, firesBefore);
      const top = (obj, n) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, v]) => `${k}:${v}`).join(' ');
      engine._trailWrite('leakyRollout', {
        cardName: candidateName,
        note: `+${deltaMb.toFixed(2)}MB hooks=[${top(hookDiff, 6)}] cards=[${top(cardDiff, 6)}]`,
      });
    }
  }
  return { score, record: recordBuf || [], completed };
}

// Gate a Main-Phase activation through MCTS-style evaluation. The caller
// passes an actionFn that performs the activation via helpers.doXxx. We:
//   1. Snapshot + fast-mode execute it once (recon), recording any CPU
//      prompts along the way; score the resulting state.
//   2. Compare against the "skip" score (don't do the activation at all).
//   3. If a prompt branched (≥2 alternatives), re-run the action per
//      alternative via a scripted plan, scoring each.
//   4. Pick the best-scoring variation. Commit it for real ONLY if it
//      beats the skip score by MCTS_ACTIVATION_GATE_THRESHOLD — otherwise
//      leave state untouched and return false.
//
// Returns true if the action was committed for real, false if skipped.
// Used by every Main-Phase sub-function so useless/net-negative
// activations (Cool Fridge to a random hero, artifact-with-nothing-to-do)
// get filtered out before firing.
const MCTS_ACTIVATION_GATE_THRESHOLD = 3;
// Schwelle für handneutrale GRATIS-Plays (Swap auf besetzten Slot).
// Deutlich unter der Standard-Hürde, weil der Ertrag solcher Plays
// strukturell erst nach der Sofortbewertung anfällt (siehe die
// ausführliche Begründung an der Verwendungsstelle in
// fireAdditionalActions). Bewusst NICHT so tief wie die Rafflesia-Chain
// (−60): aktiv schädliche Swaps — etwa das Zurücknehmen einer Kreatur,
// deren Board-Präsenz gerade gebraucht wird — sollen weiterhin skippbar
// bleiben. Der Wert ist die Haupt-Stellschraube dieses Hebels und
// gehört nach dem nächsten Trainingslauf gegen die Swap-Rate kalibriert.
const FREE_SWAP_GATE_THRESHOLD = -12;
// Schwelle für FREIE NORMAL-Beschwörungen im selben Pfad (Kreatur in
// einen leeren Slot). Als Ziel: "jede Runde konsistent mindestens eine
// neue Deepsea-Kreatur, besser 2+ dank Primordium."
// Messung 29.7.: dieser Pfad brachte 0.33 neue Kreaturen je SPIEL — die
// Deltas liegen zu 99% im Bucket −12..0, die Standardhürde +3 lehnt sie
// also systematisch um wenige Punkte ab. Diese +3 sind für Aktionen
// gedacht, die den ZUG kosten; hier ist jede Aktion gratis (inherent
// oder per Grant bezahlt), die Karte kostet nur einen Handplatz.
// Der Wert deckt sich mit der Swap-Schwelle, weil beide dieselbe
// Blindstelle teilen: der Ertrag einer Kreatur auf dem Board (spätere
// On-Summon-Trigger, Siphem-Material, DDG-Tribut UND — seit v99 der
// gemessene Hauptengpass — künftige Bounce-Ziele) fällt erst nach der
// Sofortbewertung an. Eigene Konstante statt Wiederverwendung, damit
// beide Hebel getrennt kalibrierbar bleiben.
const FREE_SUMMON_GATE_THRESHOLD = -12;

// How many distinct branchable prompts to explore per recon. Each branchable
// prompt contributes its own set of variations (one per alternative pick),
// additively — NOT a Cartesian product, so cost scales linearly with branch
// count rather than exponentially. 2 covers most real spells (damage spell
// with two sequential target prompts, zonePick + cardGallery, etc.).
const MCTS_MAX_BRANCHES_PER_RECON = 2;
// Cap alternatives we score at any single branch. Prevents combinatorial
// blowup on "pick a hero from 6 enemies" style prompts.
const MCTS_MAX_ALTS_PER_BRANCH = 6;

// ─── Chain-source helpers (extracted from evaluateState) ──────────────
// Module-level so the MCTS variation builder can read chain-source data
// without instantiating a full evaluator. Both `cpuMeta.chainSource` and
// `cpuMeta.onDeathBenefit` are GENERIC card-level declarations — any
// future card that opts into the same shape gets the same treatment.
// See loyal-terrier.js for the prototype.

/**
 * Liest `cpuMeta.onDeathBenefit` (v332).
 *
 * Bisher nur eine Zahl. Manche Todes-Effekte haengen aber am ZUSTAND der
 * Instanz — Bunny Bombs zuendet `Zaehler x 20` Flaechenschaden, ohne
 * Zaehler ist die Karte harmlos. Eine feste Zahl waere entweder zu
 * aengstlich (frueh) oder zu mutig (spaet). Deshalb darf die Deklaration
 * jetzt auch eine Funktion `(engine, inst) => number` sein; Zahlen
 * funktionieren unveraendert weiter.
 *
 * Massstab (siehe evaluateState): ein Support-Slot ist 30 wert, der
 * Boden liegt bei 5 — ab 25 ist das Toeten also praktisch wertlos.
 */
function readOnDeathBenefit(script, engine, inst) {
  const roh = script?.cpuMeta?.onDeathBenefit;
  if (typeof roh === 'function') {
    try {
      const v = roh(engine, inst);
      return Number.isFinite(v) ? v : 0;
    } catch { return 0; }
  }
  return roh || 0;
}

/**
 * Darf der CPU-Pilot diese Karte ueberhaupt in seine Rechnung nehmen? (v333)
 *
 * Eigene Karten immer. Karten des GEGNERS nur, wenn sie offenliegen —
 * eine Karte auf der Gegnerhand kennt die CPU erst, wenn sie ihr gezeigt
 * wurde (`inst.knownToOpponent`, gesetzt von der Engine beim Aufdecken;
 * das Flag bedeutet "die Gegenseite des Besitzers hat sie gesehen", aus
 * Sicht der CPU also genau das Richtige).
 *
 * ALS VORGABE, woertlich: die CPU soll NICHT allwissend sein und nicht
 * anders spielen, sobald der Gegner einen Green Dragoneer zieht.
 *
 * Karten im Support liegen offen und brauchen die Pruefung nicht.
 */
const ZONE_HAND = 'hand';

function chainSourceIsVisible(inst, cpuIdx) {
  if (!inst) return false;
  if ((inst.controller ?? inst.owner) === cpuIdx) return true;
  if (inst.zone !== ZONE_HAND) return true;         // offenes Brett
  return inst.knownToOpponent === true;             // Gegnerhand: nur wenn gezeigt
}

/**
 * Sammelt scharfe Chain-Quellen eines Spielers.
 *
 * v333, zwei Erweiterungen ueber das urspruengliche Support-only-Modell:
 *   • `chainSource.fromHand: true` — die Quelle wirkt aus der HAND
 *     (Green Dragoneer beschwoert sich selbst, wenn ein anderer Drago
 *     stirbt). Nur mit Sichtpruefung, siehe `chainSourceIsVisible`.
 *   • `chainSource.side: 'opponent'` — die Quelle reagiert nicht auf
 *     Tode der EIGENEN Seite, sondern auf die des Gegners (Bomblebee
 *     schiesst, wenn ein gegnerisches Ziel stirbt). Verrechnet wird sie
 *     deshalb gegen die Slots der Gegenseite; siehe die Aufrufstellen.
 *
 * @param {number} [cpuIdx] Sichtpunkt fuer die Handpruefung. Fehlt er,
 *                          werden Handquellen konservativ ausgelassen.
 */
function _mctsCollectArmedChainSources(engine, ownerIdx, cpuIdx) {
  const sources = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== ownerIdx) continue;
    if (inst.zone !== 'support' && inst.zone !== ZONE_HAND) continue;
    if (inst.zone === 'support' && inst.faceDown) continue;
    const script = loadCardEffect(inst.name);
    const chain = script?.cpuMeta?.chainSource;
    if (!chain) continue;
    if (inst.zone === ZONE_HAND) {
      if (!chain.fromHand) continue;                       // Karte will das gar nicht
      if (cpuIdx == null) continue;                        // ohne Sichtpunkt lieber nicht
      if (!chainSourceIsVisible(inst, cpuIdx)) continue;   // Gegnerhand, ungesehen
    }
    try {
      if (chain.isArmed && !chain.isArmed(engine, inst)) continue;
    } catch { continue; }
    sources.push({ inst, chain });
  }
  return sources;
}

function _mctsEffectiveOnDeathValue(engine, inst, sources, gegenQuellen = []) {
  if (!inst) return 0;
  const script = loadCardEffect(inst.name);
  const meta = script?.cpuMeta;
  let value = readOnDeathBenefit(script, engine, inst);
  // Chain sources themselves don't compound chain bonuses on their own
  // death — killing the Terrier ends the window, killing the Shepherd
  // ends the revive. Mirror evaluateState's logic exactly.
  if (meta?.chainSource) return value;
  const alle = [
    ...sources.filter(q => (q.chain.side || 'own') === 'own'),
    // v333 Gegenrichtung: Quellen der ANDEREN Seite, die auf Tode HIER
    // reagieren (Bomblebee). Ihr Ertrag macht diese Kreatur fuer ihren
    // Besitzer weniger wert — das Toeten also attraktiver.
    ...gegenQuellen.filter(q => q.chain.side === 'opponent'),
  ];
  for (const { inst: srcInst, chain } of alle) {
    if (srcInst.id === inst.id) continue;
    try {
      if (chain.triggersOn && !chain.triggersOn(engine, inst, srcInst)) continue;
    } catch { continue; }
    value += chain.valuePerTrigger || 0;
  }
  return value;
}

// Turn a recorded prompt sequence into a list of plan variations. Each
// variation is `{ plan, label }`: plan is an array consumed by the target/
// generic override (null = heuristic placeholder, entries = scripted pick).
// We walk the record finding up to `maxBranches` branchable prompts with
// ≥2 alternatives each; for each, we emit one variation per non-heuristic
// alternative at that single position (other positions get null). Because
// variations are independent (one scripted slot at a time), explored cost
// is O(sum of alternatives), not O(product).
function mctsBuildVariationsFromRecord(record, { maxBranches = MCTS_MAX_BRANCHES_PER_RECON, maxAltsPerBranch = MCTS_MAX_ALTS_PER_BRANCH } = {}, engine = null) {
  const variations = [];
  let branchesFound = 0;
  for (let i = 0; i < record.length; i++) {
    if (branchesFound >= maxBranches) break;
    const r = record[i];
    if (r.wasScripted) continue;
    const isTarget = r.kind === 'target' && (r.validTargets || []).length >= 2;
    // >= 1 (not >= 2): for confirm prompts, the heuristic default is
    // decline (null) and the only meaningful alternative is confirm.
    // The emission loop below filters out alternatives matching the
    // heuristic pick, so a 1-alt case with a mismatching alt still
    // produces one variation; a matching 1-alt case produces none.
    const isGeneric = r.kind && r.kind.startsWith('generic:') && (r.alternatives || []).length >= 1;
    if (!isTarget && !isGeneric) continue;
    branchesFound++;
    const heuristicKey = JSON.stringify(r.picked);
    const emitted = [];
    if (isTarget) {
      // ── Single-identity alternatives: pick just one different target ──
      for (const alt of r.validTargets) {
        if (emitted.length >= maxAltsPerBranch) break;
        const entry = { kind: 'target', ids: [alt.id] };
        if (JSON.stringify(entry.ids) === heuristicKey) continue;
        const plan = new Array(i).fill(null);
        plan.push(entry);
        const label = `#${i} target=${alt.name || alt.id}` + (alt.owner != null ? ` (p${alt.owner})` : '');
        variations.push({ plan, label });
        emitted.push(alt);
      }
      // ── Subset-size variations (Pyroblast / Beer-style multi-select) ──
      // When the prompt allows >1 targets and the heuristic actually picked
      // multiple, also try SMALLER subset sizes of the same ordered picks.
      // Useful when per-target costs (Beer's 4g each) make fewer picks
      // score better, or when a Pollution-placing spell would clog zones.
      const heuristicIds = Array.isArray(r.picked) ? r.picked : [];
      const maxSel = r.maxSelect || 1;
      if (maxSel > 1 && heuristicIds.length > 1) {
        for (let k = heuristicIds.length - 1; k >= 1; k--) {
          const subsetIds = heuristicIds.slice(0, k);
          const entry = { kind: 'target', ids: subsetIds };
          if (JSON.stringify(subsetIds) === heuristicKey) continue;
          const plan = new Array(i).fill(null);
          plan.push(entry);
          variations.push({ plan, label: `#${i} top-${k} of ${heuristicIds.length}` });
        }
      }

      // ── "Kill own chain-fuel" variant (Loyal Terrier + Book of
      //     Doom-style synergies) ──────────────────────────────────────
      // For multi-select damage cards, also try TARGETING OWN CREATURES
      // that have positive `effectiveOnDeathValue` — i.e., own creatures
      // whose death would trigger an armed chain source on our side.
      // This is a GENERIC variant: any card that opts into
      // `cpuMeta.chainSource` (Loyal Terrier today, future cards
      // tomorrow) feeds it. The MCTS rollout plays out the deaths +
      // chain-trigger damage; the evaluator sees the result and the
      // arm wins if the payoff exceeds the cost. For non-chain decks
      // the chain fuel set is empty and this branch is skipped.
      const ownChainFuelEligible = engine && r.maxSelect > 1 && Array.isArray(r.validTargets);
      if (ownChainFuelEligible) {
        const cpuIdx = engine._cpuPlayerIdx;
        const ownChainSources = _mctsCollectArmedChainSources(engine, cpuIdx, cpuIdx);
        if (ownChainSources.length > 0) {
          const ownChainFuel = [];
          for (const t of r.validTargets) {
            if (t.owner !== cpuIdx) continue;
            if (t.type !== 'equip' && t.type !== 'creature') continue;
            const inst = engine.cardInstances.find(c =>
              c.zone === 'support' && c.owner === t.owner
              && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
            if (!inst) continue;
            const v = _mctsEffectiveOnDeathValue(engine, inst, ownChainSources);
            if (v > 0) ownChainFuel.push({ target: t, value: v });
          }
          if (ownChainFuel.length >= 1) {
            ownChainFuel.sort((a, b) => b.value - a.value);
            const take = Math.min(r.maxSelect, ownChainFuel.length);
            const ids = ownChainFuel.slice(0, take).map(f => f.target.id);
            const idsKey = JSON.stringify(ids);
            if (idsKey !== heuristicKey) {
              const plan = new Array(i).fill(null);
              plan.push({ kind: 'target', ids });
              variations.push({ plan, label: `#${i} chain-fuel × ${take}` });
            }
          }
        }
      }
    } else {
      for (const alt of r.alternatives) {
        if (emitted.length >= maxAltsPerBranch) break;
        const entry = { kind: r.kind, value: alt.value };
        if (JSON.stringify(entry.value) === heuristicKey) continue;
        const plan = new Array(i).fill(null);
        plan.push(entry);
        variations.push({ plan, label: `#${i} ${alt.label}` });
        emitted.push(alt);
      }
    }
  }
  return variations;
}

async function mctsGatedActivation(engine, helpers, desc, actionFn, options = {}) {
  if (istAbgebrochen(engine)) return false;
  // `alwaysCommit` — run the recon + variations to pick the best target plan,
  // but commit regardless of whether the score beats skip. Intended for
  // pure-draw / tutor activations: the evaluator's gold-vs-hand-value model
  // systematically under-rewards "trade gold for a card" plays (a cost-10
  // artifact that draws a card loses ~20 gold-met value but gains at most
  // 25 hand value, so the delta often reads negative), and draws/tutors are
  // basically always tempo-positive for the caller. We still want the
  // variation loop so that, e.g., Magnetic Glove picks the best card from
  // the gallery instead of a random one.
  const alwaysCommit = !!options.alwaysCommit;
  // `evaluateThroughTurnEnd` — after the activation's actionFn, also
  // play out the REST of the CPU's turn (rolloutRestOfTurn) before
  // scoring. Required for "alive only this turn" effects like Golden
  // Ankh: without rest-of-turn projection, the immediate eval shows
  // a free +500 dead-bonus revert; with it, the End-Phase forceKill
  // fires and the eval correctly sees the hero is dead again — the
  // gate then commits IFF the revived hero actually generated value
  // during the simulated action phase (cards drawn, damage dealt,
  // …). Pricier than the default gate (full rest-of-turn rollout per
  // recon + per variation), so opt-in only.
  const evaluateThroughTurnEnd = !!options.evaluateThroughTurnEnd;

  // ── Nested-rollout / late-game / overload short-circuit ──
  // Skip the gate when we're already inside an MCTS simulation — running
  // another full recon+variation per gated activation compounds cost
  // exponentially. The signal is `_inMctsSim`, not `_fastMode`; the
  // latter also fires for whole-game self-play, which would disable the
  // gate everywhere and never invoke the evaluator's synergy terms.
  // Also bypass past MCTS_LATE_GAME_TURN_THRESHOLD — long stalls OOM
  // before the gate's marginal filter value matters. AND bypass when
  // `_mctsKilledThisTurn` is set: an earlier rollout this turn tripped
  // the heap/snapshot caps, so committing without re-rolling-out is the
  // right policy (mirrors the inMctsSim bypass).
  // `commitWithoutRecon`: die Entscheidung steht bereits fest UND es gibt
  // keinen Zielplan zu optimieren. Dann ist die Recon reine Verschwendung
  // — sie kostet einen vollen Suchbaum, dessen Ergebnis anschliessend
  // verworfen wird. Genau das hat v263 vervielfacht: jede freie
  // Beschwoerung lief mit `alwaysCommit` durch die volle Suche, und weil
  // sie danach IMMER committet, ging die Schleife zur naechsten freien
  // Kreatur weiter — statt wie vorher nach der ersten Ablehnung zu
  // stoppen. Ergebnis waren viele Suchbaeume je Zug statt einem.
  if (options.commitWithoutRecon
      || engine._inMctsSim
      || engine._mctsKilledThisTurn
      || cpuPastDeadline(engine)
      || (engine.gs?.turn || 0) >= MCTS_LATE_GAME_TURN_THRESHOLD) {
    // Skip the hardcap inside nested rollouts — those already inherit the
    // outer LIVE call's deadline and Promise.race here would needlessly
    // arm a second timer per nested activation.
    if (engine._inMctsSim) {
      try { await actionFn(); return true; }
      catch { return false; }
    }
    try { await _runWithCardHardcap(engine, desc, actionFn); return true; }
    catch { return false; }
  }

  // Wrap the entire MCTS body in an overload-catch. If any of the
  // snapshot calls below throw `_mctsOverload`, we fall through to the
  // bypass policy (commit the action without rolling out) so the live
  // turn can continue with heuristic for the remaining decisions.
  try {

  const cpuIdx = engine._cpuPlayerIdx;
  // Keep the live server responsive across this gate's rollout
  // sequence. mctsGatedActivation runs a skip-baseline rollout + a
  // recon rollout + one rest-of-turn rollout PER gallery variation;
  // for `evaluateThroughTurnEnd` cards with a big gallery (Magnetic
  // Glove = every distinct deck card) that is many seconds of fast-
  // mode (microtask-only) work that would otherwise never let Node
  // service a surrender / refresh. Yield here and at each rollout
  // boundary below (gs is the real, non-snapshot state at all these
  // points). Bounds are unchanged — cpuPastDeadline still caps it.
  await maybeYieldEventLoop(engine);
  // ── Skip baseline ──
  // Default: immediate-state score with the activation NOT played.
  // When `evaluateThroughTurnEnd` is on, the recon below ALSO plays
  // out the rest of the turn before scoring — comparing that to an
  // immediate-state skip is unfair: the rest-of-turn's natural play
  // value (Action Phase plays, MP2 activations, end-of-turn ticks)
  // would inflate the post-play score regardless of whether the
  // activation itself contributed anything. To isolate the
  // activation's incremental value, also play the rest-of-turn for
  // the skip baseline. This is the fix for "Golden Ankh revives a
  // hero who's never used in the action phase but the rollout's
  // natural value still made the gate commit" — under the new
  // baseline, both rollouts produce the same natural value and the
  // delta correctly drops to ~0 (or negative once you subtract the
  // gold + hand-card cost).
  let skipScore;
  if (evaluateThroughTurnEnd) {
    const snapSkip = engine.snapshot();
    const prevInSimSkip = engine._inMctsSim;
    const prevRolloutStartTSkip = engine._mctsRolloutStartT;
    engine._inMctsSim = true;
    engine._mctsRolloutStartT = Date.now();
    engine.enterFastMode();
    const prevSilentSkip = _cpuLogSilent;
    _cpuLogSilent = true;
    try {
      try { await rolloutRestOfTurn(engine, helpers); } catch {}
      skipScore = evaluateState(engine, cpuIdx);
    } finally {
      _cpuLogSilent = prevSilentSkip;
      engine.exitFastMode();
      engine.restore(snapSkip);
      resetPromptCycle(engine);
      engine._inMctsSim = prevInSimSkip;
      engine._mctsRolloutStartT = prevRolloutStartTSkip;
    }
  } else {
    skipScore = evaluateState(engine, cpuIdx);
  }

  // ── Recon rollout ──
  await maybeYieldEventLoop(engine); // keep server responsive (see note above)
  const snap = engine.snapshot();
  const prevInSim = engine._inMctsSim;
  const prevRolloutStartT = engine._mctsRolloutStartT;
  engine._inMctsSim = true;
  engine._mctsRolloutStartT = Date.now();
  engine.enterFastMode();
  engine._mctsTargetRecord = [];
  engine._mctsRecordOverflowed = false;
  // Save+restore the silence flag so a nested gate (this one being called
  // FROM inside an outer rollout's runMainPhase) doesn't unsilence the
  // outer scope. See mctsRunOneRollout for the same pattern.
  const prevSilent = _cpuLogSilent;
  _cpuLogSilent = true;
  let reconScore = -Infinity;
  let reconCompleted = false;
  try {
    await actionFn();
    if (evaluateThroughTurnEnd) {
      try { await rolloutRestOfTurn(engine, helpers); } catch {}
    }
    reconScore = evaluateState(engine, cpuIdx);
    reconCompleted = true;
  } catch (err) {
    // Action threw during recon — treat as unable-to-activate.
  }
  const record = engine._mctsTargetRecord || [];
  delete engine._mctsTargetRecord;
  _cpuLogSilent = prevSilent;
  engine.exitFastMode();
  engine.restore(snap);
  resetPromptCycle(engine);
  engine._inMctsSim = prevInSim;
  engine._mctsRolloutStartT = prevRolloutStartT;

  if (!reconCompleted) return false;

  const variations = [{ plan: null, label: '(heuristic)', score: reconScore }];

  // Enumerate variations across multiple branchable prompts (first
  // MCTS_MAX_BRANCHES_PER_RECON non-scripted prompts with ≥2 alternatives).
  // Pass `engine` so the chain-fuel variant (Loyal Terrier-style
  // self-kill synergy) gets enumerated when applicable.
  const extras = mctsBuildVariationsFromRecord(record, undefined, engine);
  for (const v of extras) variations.push({ plan: v.plan, label: v.label, score: -Infinity });

  if (extras.length > 0) {
    for (const variation of variations) {
      if (variation.plan === null) continue;
      // A surrender / disconnect serviced during a yield, or the
      // turn/rollout deadline, must stop the gate promptly instead of
      // grinding every remaining variation's rest-of-turn rollout.
      if (engine.gs?.result || engine._mctsKilledThisTurn || cpuPastDeadline(engine)) break;
      await maybeYieldEventLoop(engine); // keep server responsive (see note above)
      const snap2 = engine.snapshot();
      const prevInSim2 = engine._inMctsSim;
      const prevRolloutStartT2 = engine._mctsRolloutStartT;
      engine._inMctsSim = true;
      engine._mctsRolloutStartT = Date.now();
      engine.enterFastMode();
      engine._mctsTargetPlan = [...variation.plan];
      const prevSilent2 = _cpuLogSilent;
      _cpuLogSilent = true;
      try {
        await actionFn();
        if (evaluateThroughTurnEnd) {
          try { await rolloutRestOfTurn(engine, helpers); } catch {}
        }
        variation.score = evaluateState(engine, cpuIdx);
      } catch {}
      delete engine._mctsTargetPlan;
      _cpuLogSilent = prevSilent2;
      engine.exitFastMode();
      engine.restore(snap2);
      resetPromptCycle(engine);
      engine._inMctsSim = prevInSim2;
      engine._mctsRolloutStartT = prevRolloutStartT2;
    }
  }

  variations.sort((a, b) => b.score - a.score);
  const best = variations[0];
  // Threshold for COMMIT: usually MCTS_ACTIVATION_GATE_THRESHOLD = 3.
  // For `evaluateThroughTurnEnd` activations the bar is HIGHER —
  // these activations cost real resources (gold + hand card) for a
  // state mutation that only persists for the current turn (Golden
  // Ankh's revival re-dies at the End Phase forceKill). The eval's
  // gold/hand penalty for the cost is small (~20-50 score points)
  // and easily drowned out by rollout noise from the rest-of-turn
  // simulation, so the gate would otherwise green-light any tiny
  // positive delta and waste the card. The higher threshold demands
  // the temporary mutation produce SUBSTANTIAL value above the
  // natural rest-of-turn noise floor — i.e. the revived hero must
  // actually do something meaningful (Action, ability activation,
  // hero effect that gains gold / draws cards / deals damage), not
  // just exist briefly while the CPU passes.
  // Per-card override: `cpuMeta.activationGateThreshold` lets a card
  // tune this for itself (high value = strict gate, 0 = use default).
  // Card name is parsed from the gate `desc` — covers every caller in
  // _cpu.js (artifact, potion, free-ability, creature-effect, hero-
  // effect, equip-effect, area, permanent, ascend, additional X).
  // `additional` and `hero-effect h<idx>` are non-name patterns and
  // resolve to null (falling through to the default threshold).
  const cardScript = (() => {
    let m = /^(?:artifact|potion|spell|attack|free-ability|creature-effect|equip-effect|area|permanent|ascend) (.+)$/.exec(desc);
    if (!m) m = /^additional (?:Spell|Attack|Creature) (.+)$/.exec(desc);
    return m ? loadCardEffect(m[1]) : null;
  })();
  // Schwellen-Override: Aufrufer-seitig (options.overrideThreshold, für
  // situative Fälle wie die Rafflesia-Chain) VOR karten-seitig
  // (cpuMeta.activationGateThreshold). Der Aufrufer-Wert wurde bislang
  // zwar übergeben, aber nie gelesen — die Rafflesia-Absenkung auf −60
  // war damit wirkungslos.
  const overrideThreshold = (typeof options.overrideThreshold === 'number')
    ? options.overrideThreshold
    : cardScript?.cpuMeta?.activationGateThreshold;
  // Gelernte Lock-Ordering-Strafe (siehe _deck-profile.lockOrderPenalty):
  // Setzt diese Karte laut Trainingsdaten einen Lock und liegen noch
  // viele Karten des gesperrten Typs in der Hand, steigt die Schwelle —
  // das Gate committet Boomerang & Co. erst, wenn die anderen Optionen
  // abgearbeitet sind. Zentral hier statt an den Callsites: greift so
  // für JEDEN Gate-Typ (artifact, potion, equip-effect, …), dessen
  // Karte gelernte Gewichte trägt; Karten ohne Gewichte kosten nur den
  // Map-Lookup. Kartennamen liefert die desc-Extraktion oben.
  let lockDelta = 0;
  {
    const m2 = /^(?:artifact|potion|spell|attack|free-ability|creature-effect|equip-effect|area|permanent) (.+)$/.exec(desc);
    const gatePi = engine._cpuPlayerIdx ?? engine.gs?.activePlayer;
    if (m2 && typeof gatePi === 'number' && !engine._inMctsSim) {
      try { lockDelta = deckProfile.lockOrderPenalty(engine, gatePi, m2[1]); } catch { lockDelta = 0; }
    }
  }
  // Gelernter Hero-Effekt-Timing-Prior (siehe _deck-profile.
  // heroEffectTimingPrior): verschiebt die Gate-Schwelle nach dem
  // aktuellen Handgrößen-Bucket. Kazena bei 4+ Handkarten → gelernt
  // negativer Wert → Schwelle steigt → das Gate wartet, bis die Hand
  // leer gespielt ist; bei 0-1 Karten sinkt die Schwelle. Nur ein
  // Prior — ein starker Sofort-Nutzen (best.score) gewinnt weiterhin,
  // Nischen-Timings ("erst fischen, dann spielen") bleiben möglich.
  let heroFxDelta = 0;
  {
    const mh = /^hero-effect h(\d+)$/.exec(desc);
    const gatePi = engine._cpuPlayerIdx ?? engine.gs?.activePlayer;
    if (mh && typeof gatePi === 'number' && !engine._inMctsSim) {
      const h = engine.gs?.players?.[gatePi]?.heroes?.[Number(mh[1])];
      const hn = h?.baseName || h?.name;
      if (hn) {
        try { heroFxDelta = deckProfile.heroEffectTimingPrior(engine, gatePi, hn); }
        catch { heroFxDelta = 0; }
      }
    }
  }
  // Per-Karte dynamischer Score-Bonus (`cpuMeta.activationScoreBonus`,
  // Signatur (engine, cpuIdx, helpers) => Zahl). Für Karten, deren Wert
  // die Sofortbewertung strukturell nicht sieht, aber MIT DER LAGE
  // SKALIERT — Smoke Vial etwa: pro Gegner-Held, der wirklich neu
  // geblendet wird. Anders als `alwaysCommit` (alles-oder-nichts)
  // verschiebt der Bonus die Entscheidung nur graduell, das Gate darf
  // also weiter ablehnen, wenn die Stellung dagegenspricht. Technisch
  // als Senkung der Schwelle umgesetzt — entscheidungsgleich zu einem
  // Aufschlag auf best.score, lässt aber den geloggten Recon-Score
  // unverfälscht.
  let scoreBonus = 0;
  if (typeof cardScript?.cpuMeta?.activationScoreBonus === 'function') {
    const gatePi = engine._cpuPlayerIdx ?? engine.gs?.activePlayer;
    if (typeof gatePi === 'number') {
      try {
        const v = cardScript.cpuMeta.activationScoreBonus(engine, gatePi, CPU_META_HELPERS);
        scoreBonus = Number.isFinite(v) ? v : 0;
      } catch { scoreBonus = 0; }
    }
  }
  const threshold = ((typeof overrideThreshold === 'number')
    ? overrideThreshold
    : (evaluateThroughTurnEnd ? 30 : MCTS_ACTIVATION_GATE_THRESHOLD)) + lockDelta - heroFxDelta - scoreBonus;
  const beats = best.score > skipScore + threshold;
  // ε-Exploration: eine Aktivierung, die das Gate skippen würde,
  // trotzdem committen — nur im Trainings-Self-Play (siehe exploreRoll).
  // So bekommen Karten, deren Wert das Gate systematisch unterschätzt
  // (Engine-/Setup-Karten ohne Sofort-Payoff), überhaupt erst
  // Trainingsdaten.
  const exploreForce = !beats && !alwaysCommit && exploreRoll(engine);
  // Starke gelernte Lock-Strafe (≥10) setzt auch alwaysCommit aus:
  // Draw-/Tutor-Artefakte committen sonst bedingungslos — genau die
  // Kategorie, in der ein Lock-Fehlgriff (Boomerang vor der vollen
  // Artefakt-Hand) am teuersten ist.
  const lockVeto = lockDelta >= 10 && !beats;
  const commit = beats || (alwaysCommit && !lockVeto) || exploreForce;
  // ── Delta-Diagnose (Als Auftrag) ──────────────────────────────────
  // Die v95-Zähler sagen nur "committet/abgelehnt". Offen blieb, ob die
  // gesenkte Swap-Schwelle überhaupt ankommt und WIE WEIT das Delta sie
  // verfehlt — ohne das hieße jede weitere Anpassung wieder raten.
  // `options.diagKey` markiert die Aufrufer, die das wissen wollen.
  if (options.diagKey) {
    const delta = best.score - skipScore;
    // Feinere Klassen rund um die Null: dort liegt die Masse, und nur
    // mit dieser Auflösung lässt sich die Schwelle exakt kalibrieren
    // statt sie zu raten.
    const b = delta <= -200 ? '<=-200'
      : delta <= -50 ? '-200..-50'
      : delta <= -20 ? '-50..-20'
      : delta <= -12 ? '-20..-12'
      : delta <= -6 ? '-12..-6'
      : delta <= -3 ? '-6..-3'
      : delta <= 0 ? '-3..0'
      : delta <= 3 ? '0..3'
      : delta <= 20 ? '3..20' : '>20';
    swapDiag(engine, `delta:${options.diagKey}:${b}`);
    // Dieselbe Klasse zusaetzlich JE KARTE, wenn der Aufrufer den Namen
    // mitgibt. `delta:<kind>:*` sagt nur, DASS Beschwoerungen mit −50
    // bepreist werden; erst der Kartenname sagt, WELCHE — und ob es an
    // der Karte selbst haengt (Harpyformers Selbstschaden) oder an der
    // Lage.
    if (options.diagCard) swapDiag(engine, `deltacard:${options.diagCard}:${b}`);
    // Die TATSÄCHLICH benutzte Schwelle mitschreiben: bestätigt oder
    // widerlegt, dass der Aufrufer-Override das Gate erreicht.
    swapDiag(engine, `thr:${options.diagKey}:${Math.round(threshold)}`);
    // (B) Welcher Plan gewann die Recon? Heißt er 'skip' oder liegt der
    // Score exakt auf dem Skip-Wert, hatte das Gate gar keinen echten
    // Plan zu committen — dann ist die Ursache die Planfindung, nicht
    // die Bewertung.
    swapDiag(engine, `plan:${options.diagKey}:${String(best.label || '?').slice(0, 24)}`);
    if (Math.abs(delta) < 0.001) swapDiag(engine, `plan:${options.diagKey}:DELTA-EXAKT-NULL`);
  }
  if (lockVeto && alwaysCommit) cpuLog(`      [gate] ${desc}: alwaysCommit durch Lock-Strafe (+${lockDelta.toFixed(1)}) ausgesetzt`);
  cpuLog(`      [gate] ${desc}: skip=${skipScore.toFixed(1)} best=${best.score.toFixed(1)} threshold=${Number(threshold.toFixed(2))}${scoreBonus ? ` (Bonus ${scoreBonus.toFixed(1)})` : ''} via ${best.label} → ${commit ? (beats ? 'COMMIT' : (exploreForce ? 'EXPLORE-COMMIT' : 'FORCE-COMMIT')) : 'SKIP'}`);

  if (!commit) return false;

  if (best.plan) engine._mctsTargetPlan = [...best.plan];
  try {
    await _runWithCardHardcap(engine, desc, actionFn);
  } finally {
    delete engine._mctsTargetPlan;
  }
  return true;

  } catch (err) {
    if (err && err._mctsOverload) {
      // Heap/snapshot cap tripped during this gate's recon. Flag is
      // set, so all subsequent gates this turn will hit the bypass at
      // the top and commit directly. For THIS gate, mirror the bypass
      // policy: commit the action (best-effort) so the live turn
      // progresses with the heuristic action still applied.
      console.error(`[MCTS overload in gate "${desc}"] ${err.message}`);
      try { await _runWithCardHardcap(engine, desc, actionFn); return true; }
      catch { return false; }
    }
    throw err;
  }
}

// Evaluator-greedy candidate ranking, used as the in-rollout brain when
// `_rolloutBrain === 'evalGreedy'`. For each candidate:
//   snapshot → apply → evaluate → restore
// Then sort by post-apply score. This is the action-selection equivalent
// of "look one move ahead with the evaluator" — expensive (O(candidates)
// snapshots per decision), but lets recursive rollouts actually discover
// synergies (e.g. Heal triggering OHS for damage) which the pure-heuristic
// type/level sort misses. Must be called with `_inMctsSim` already true
// so nested MCTS short-circuits stay in place.
async function rankCandidatesEvalGreedy(engine, helpers, candidates) {
  const cpuIdx = engine._cpuPlayerIdx;
  const scored = [];
  for (const cand of candidates) {
    if (engine._mctsKilledThisTurn) {
      scored.push({ cand, score: -Infinity });
      continue;
    }
    let snap;
    try {
      snap = engine.snapshot();
    } catch (err) {
      if (err && err._mctsOverload) {
        // Cap tripped — score remaining candidates as -Infinity and
        // let the heuristic tiebreak below order them. The kill flag
        // is set by the throw site so all subsequent MCTS calls this
        // turn will short-circuit.
        scored.push({ cand, score: -Infinity });
        continue;
      }
      throw err;
    }
    let score = -Infinity;
    try {
      const applied = await applyActionCandidate(engine, helpers, cand);
      if (applied) score = evaluateState(engine, cpuIdx);
    } catch {
      // Throwing candidates are scored -Infinity → sorted last.
    } finally {
      engine.restore(snap);
      resetPromptCycle(engine);
    }
    scored.push({ cand, score });
  }
  // Noise-tolerant Attack tiebreak — same rationale as the main MCTS
  // ranking sort. Single-rollout evals in nested simulations are even
  // noisier than the ~3-rollout outer loop, so the epsilon band is a
  // touch wider here. Within it, prefer the higher-atk caster.
  scored.sort((a, b) => {
    const diff = b.score - a.score;
    const epsilon = Math.max(5, Math.abs(b.score) * 0.015);
    if (Math.abs(diff) <= epsilon
        && a.cand.cardType === 'Attack'
        && b.cand.cardType === 'Attack') {
      const atkDiff = (b.cand.casterAtk || 0) - (a.cand.casterAtk || 0);
      if (atkDiff !== 0) return atkDiff;
    }
    return diff;
  });
  return scored.map(s => s.cand);
}

// Rank candidates by MCTS with target enumeration. For each candidate:
//   1. Recon rollout (heuristic targeting) — records all CPU target prompts.
//   2. Identify the first non-cancellable prompt with ≥2 valid targets.
//   3. Enumerate alternative targets as variations (plus the heuristic default).
//   4. Run N rollouts per variation; average the scores.
//   5. Return candidates sorted by best variation score, each decorated with
//      a scriptedTargetPlan that the real play should follow.
async function mctsRankCandidates(engine, helpers, candidates, rollouts = MCTS_ROLLOUTS_PER_CANDIDATE) {
  if (istAbgebrochen(engine)) return candidates;
  // Auto-clear the kill-flag on LIVE turn change only. Without the
  // `!_inMctsSim` gate, a nested mctsRankCandidates call inside a
  // rollout (where gs.turn is the simulated turn, not the live turn)
  // would clear the flag and re-enable MCTS mid-spiral. Inside a sim
  // the bypass at the top of this function already short-circuits, so
  // we only need this reset to fire when the LIVE game has genuinely
  // moved to a new turn.
  const liveTurn = engine.gs?.turn || 0;
  if (!engine._inMctsSim && engine._mctsKilledTurnTag !== liveTurn) {
    engine._mctsKilledTurnTag = liveTurn;
    engine._mctsKilledThisTurn = false;
  }

  // ── Nested-MCTS / late-game / overload short-circuit ──
  // Skip MCTS inside an outer rollout (nested simulations explode the cost
  // of a single rollout exponentially). The correct signal is `_inMctsSim`,
  // set only while simulating; `_fastMode` alone also fires for whole-game
  // self-play, which would disable MCTS everywhere and defeat the point.
  // Also skip past MCTS_LATE_GAME_TURN_THRESHOLD — at that point the match
  // is stalling and snapshot pressure is the actual risk. AND skip if
  // `_mctsKilledThisTurn` is set — an earlier rollout this real turn
  // tripped the heap / snapshot cap, so further rollouts would just
  // accelerate the death spiral.
  const mctsBypass = engine._inMctsSim
    || engine._mctsKilledThisTurn
    || cpuPastDeadline(engine)
    || liveTurn >= MCTS_LATE_GAME_TURN_THRESHOLD;
  if (mctsBypass) {
    // Inside rollouts: rank candidates per the configured rollout brain.
    // evalGreedy: try each, score post-apply, pick highest (lets rollouts
    // discover synergies). Late-game / overload bypass uses heuristic
    // regardless — it's explicitly the "stop thinking" cheap path.
    if (engine._inMctsSim && _rolloutBrain === 'evalGreedy') {
      return await rankCandidatesEvalGreedy(engine, helpers, candidates);
    }
    const sorted = [...candidates].sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
    return sorted;
  }

  const t0 = Date.now();
  let totalRollouts = 0;
  let budgetExceeded = false;

  // Wrap the rollout body so MCTS_OVERLOAD throws (per-turn snapshot cap
  // / heap thresholds) gracefully fall through to heuristic instead of
  // crashing the live game. The overload handler also stamps
  // `_mctsKilledThisTurn`, which the bypass check at the top of this
  // function honors on subsequent calls in the same real turn.
  try {

  // ── Recon phase: one rollout per candidate to enumerate variations ──
  // Seeds the heuristic arm of each candidate with the recon score; opens
  // additional "arms" per target-plan variation found in the recon trace.
  // Each arm = (candidate, variation). UCB1 allocates pulls across arms.
  const arms = []; // { candidate, variation:{plan,label}, scoreSum, visits }
  // Optional GC between candidate rounds — only fires when Node was
  // launched with --expose-gc, otherwise it's a no-op. Manually
  // collecting between top-level candidates lets V8 reclaim transient
  // rollout allocation that its incremental GC otherwise lets pile up
  // until Mark-Compact thrashes. A big help on heavy-allocation decks.
  const gcBetweenCandidates = () => {
    if (typeof global.gc === 'function') {
      try { global.gc(); } catch {}
    }
  };
  for (const candidate of candidates) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS || cpuPastDeadline(engine)) {
      budgetExceeded = true;
      break;
    }
    if (engine._mctsKilledThisTurn) break;
    await maybeYieldEventLoop(engine); // keep server responsive to surrender/refresh
    gcBetweenCandidates();
    const recon = await mctsRunOneRollout(engine, helpers, candidate, { record: true });
    totalRollouts++;

    // Heuristic arm (seed score = recon's score if the rollout completed).
    arms.push({
      candidate,
      variation: { plan: null, label: '(heuristic)' },
      scoreSum: recon.completed ? recon.score : 0,
      visits: recon.completed ? 1 : 0,
    });

    // Target-plan variation arms (unseeded — will be pulled at least once
    // during the min-pulls phase below). Pass `engine` so the chain-fuel
    // variant gets enumerated for multi-select damage cards with own
    // chain-source synergies on the board.
    const extras = mctsBuildVariationsFromRecord(recon.record, undefined, engine);
    for (const v of extras) {
      arms.push({
        candidate,
        variation: { plan: v.plan, label: v.label },
        scoreSum: 0,
        visits: 0,
      });
    }
  }

  // ── PUCT-Priors: cachen + Erstziehungs-Reihenfolge ──
  // Ein learnedCardValue-Aufruf pro ARM (nicht pro Pull); die stabile
  // Sortierung nach Prior bestimmt, welche unbesuchten Arme bei
  // knappem Budget zuerst (bzw. überhaupt) gezogen werden. Ohne
  // geladenes Profil ist prior überall 0 → Verhalten unverändert.
  {
    const priorCache = new Map();
    const pi = engine._cpuPlayerIdx;
    for (const arm of arms) {
      const nm = arm.candidate?.cardName;
      if (!nm) { arm.prior = 0; continue; }
      if (!priorCache.has(nm)) {
        let p = 0;
        try { p = deckProfile.learnedCardValue(engine, pi, nm, 0, 1) || 0; } catch { p = 0; }
        priorCache.set(nm, p);
      }
      arm.prior = priorCache.get(nm);
    }
    if ([...priorCache.values()].some(v => v !== 0)) {
      arms.sort((a, b) => (a.visits > 0 ? 1 : 0) - (b.visits > 0 ? 1 : 0) || (b.prior || 0) - (a.prior || 0));
      const top = arms.find(a => a.visits === 0);
      if (top) cpuLog(`  [puct] ${arms.length} Arme prior-sortiert — Erstziehung: "${top.candidate?.cardName}" (prior ${Math.round(top.prior || 0)})`);
    }
  }

  // ── Ensure-min-pulls phase: pull each zero-visit arm once ──
  for (const arm of arms) {
    if (arm.visits > 0) continue;
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS || cpuPastDeadline(engine)) {
      budgetExceeded = true;
      break;
    }
    if (engine._mctsKilledThisTurn) break;
    await maybeYieldEventLoop(engine); // keep server responsive to surrender/refresh
    const r = await mctsRunOneRollout(engine, helpers, arm.candidate, { plan: arm.variation.plan });
    totalRollouts++;
    if (r.completed) {
      arm.scoreSum += r.score;
      arm.visits++;
    }
  }

  // ── EIN EINZIGER ARM: nichts zu vergleichen (12.8., Als Befund) ──────
  // Diese Funktion liefert ausschliesslich eine REIHENFOLGE (plus den
  // gewaehlten Zielplan je Kandidat) — der Aufrufer probiert die Liste
  // von oben nach unten durch. Es gibt keine Score-Schwelle und keinen
  // Vergleich gegen „nichts tun"; `out` enthaelt den Score gar nicht.
  // Bei genau EINEM Arm steht die Reihenfolge also fest, bevor der
  // erste Pull laeuft, und jeder weitere Rollout erzeugt exakt null
  // entscheidungsrelevante Information.
  //
  // Bis hierher hat der Arm bereits seinen Score: die Recon-Phase macht
  // einen Rollout je Kandidat, und die Mindest-Pull-Phase darueber holt
  // einen nach, falls die Recon nicht durchlief. Der Score bleibt damit
  // ROLLOUT-skaliert — es wird nichts durch eine billigere Bewertung
  // ersetzt, es entfaellt nur die Wiederholung.
  //
  // Praktischer Anlass: Zuege, in denen die Action Phase genau einen
  // Kandidaten hat (Als Log: `Action Phase candidates: 1` →
  // Adventurousness). Bisher liefen dort bis zu MCTS_UCB1_TOTAL_PULLS
  // (80) Rollouts bzw. das volle MCTS_RANK_BUDGET_MS (20 s) — reine
  // Wartezeit fuer den Menschen am anderen Ende.
  //
  // Die Erweiterungsphase weiter unten braucht keinen eigenen Riegel:
  // sie steigt bei `visited.length < 2` bzw. `cluster.length < 2` schon
  // von selbst aus.
  const ucb1Lohnt = arms.length > 1;
  if (!ucb1Lohnt && arms.length === 1) {
    // MIT ZEITANGABE (12.8., Als Steam-Dwarf-Lauf). Ohne sie las sich
    // die Zeile wie eine Ersparnis — im Log stand „1 Rollout statt bis
    // zu 80" neben einem einzelnen Rollout, der 582 SEKUNDEN gebraucht
    // hatte. Nicht die Zahl der Rollouts ist dort das Problem, sondern
    // die Dauer des einen. Die Zeit gehoert also danebengeschrieben.
    const msBisher = Date.now() - t0;
    cpuLog(`  [MCTS/UCB1] nur 1 Arm ("${arms[0].candidate?.cardName}") — `
      + `Vergleichsphase uebersprungen (${totalRollouts} Rollout${totalRollouts === 1 ? '' : 's'} `
      + `statt bis zu ${MCTS_UCB1_TOTAL_PULLS}, bisher ${msBisher} ms`
      + `${msBisher > 10000 ? ' ⚠ EIN Rollout dauert hier ungewoehnlich lange' : ''})`);
  }

  // ── UCB1 phase: pull the highest-UCB arm, repeat until budget ──
  // UCB1(arm) = avg(arm) + C * sqrt(ln(N) / visits(arm))
  // where N is the sum of visits across all arms. Unvisited arms get
  // infinite UCB (they'd have been pulled in the min-pulls phase — this
  // is defensive).
  while (ucb1Lohnt && !budgetExceeded && totalRollouts < MCTS_UCB1_TOTAL_PULLS) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS || cpuPastDeadline(engine)) {
      budgetExceeded = true;
      break;
    }
    if (engine._mctsKilledThisTurn) break;
    const visitedArms = arms.filter(a => a.visits > 0);
    if (visitedArms.length === 0) break;
    const totalVisits = visitedArms.reduce((s, a) => s + a.visits, 0);
    const lnN = Math.log(totalVisits);
    let bestArm = null, bestUCB = -Infinity;
    for (const arm of arms) {
      const ucb = arm.visits === 0
        ? Infinity
        : (arm.scoreSum / arm.visits) + MCTS_UCB1_EXPLORE_C * Math.sqrt(lnN / arm.visits)
          + (arm.prior || 0) * MCTS_PUCT_SCALE / (1 + arm.visits);
      if (ucb > bestUCB) { bestUCB = ucb; bestArm = arm; }
    }
    if (!bestArm) break;
    await maybeYieldEventLoop(engine); // keep server responsive to surrender/refresh
    const r = await mctsRunOneRollout(engine, helpers, bestArm.candidate, { plan: bestArm.variation.plan });
    totalRollouts++;
    if (r.completed) {
      bestArm.scoreSum += r.score;
      bestArm.visits++;
    } else {
      // Rollout failed — give up on further UCB exploration to avoid loops.
      break;
    }
  }

  // ── Adaptive extension phase ─────────────────────────────────────────
  // When the regular UCB1 budget ended with the top arms clustered
  // inside the noise band (avg gap small enough that variance is
  // deciding the winner instead of real differences), spend remaining
  // wall-clock on ONLY those clustered arms. Each extra pull goes to
  // the cluster arm with the fewest visits — balances precision
  // across the cluster, drives standard error down fastest where it
  // matters, and re-checks the cluster after every pull (arms that
  // drift outside the band are dropped). Stops as soon as one arm
  // wins outright OR the cluster genuinely settles. The deterministic
  // tiebreaker downstream (casterAtk for Attacks, etc.) handles the
  // truly-equal case without spending more pulls on it.
  let extensionPulls = 0;
  while (!budgetExceeded && extensionPulls < MCTS_EXT_PULLS_MAX) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS || cpuPastDeadline(engine)) {
      budgetExceeded = true;
      break;
    }
    if (engine._mctsKilledThisTurn) break;
    const visited = arms.filter(a => a.visits > 0);
    if (visited.length < 2) break;
    let topAvg = -Infinity;
    for (const a of visited) {
      const avg = a.scoreSum / a.visits;
      if (avg > topAvg) topAvg = avg;
    }
    const epsilon = Math.max(MCTS_EXT_EPSILON_ABS, Math.abs(topAvg) * MCTS_EXT_EPSILON_PCT);
    const cluster = visited.filter(a => (a.scoreSum / a.visits) >= topAvg - epsilon);
    if (cluster.length < 2) break; // only one arm in the cluster — done
    // Pick the cluster member with the fewest visits to drive its SE
    // down fastest. Ties on visits → first one (deterministic).
    cluster.sort((a, b) => a.visits - b.visits);
    const target = cluster[0];
    await maybeYieldEventLoop(engine); // keep server responsive to surrender/refresh
    const r = await mctsRunOneRollout(engine, helpers, target.candidate, { plan: target.variation.plan });
    totalRollouts++;
    extensionPulls++;
    if (r.completed) {
      target.scoreSum += r.score;
      target.visits++;
    } else {
      break; // rollout failed — bail before the loop tightens
    }
  }
  if (extensionPulls > 0) {
    cpuLog(`  [MCTS/EXT] +${extensionPulls} cluster-resolution pulls`);
  }

  // ── Build ranked results from arm stats ──
  const results = arms.map(arm => ({
    candidate: arm.candidate,
    variation: arm.variation,
    avg: arm.visits > 0 ? arm.scoreSum / arm.visits : -Infinity,
    visits: arm.visits,
    scored: arm.visits > 0,
  }));

  // If no arm ever got scored, fall back to heuristic sort so the turn
  // doesn't crash.
  if (results.every(r => !r.scored)) {
    const sorted = [...candidates].sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
    cpuLog(`  [MCTS] budget exhausted with 0 scored arms → heuristic fallback`);
    return sorted;
  }

  // Scored arms first, by avg desc. Unscored drop to the tail.
  // Within an epsilon band — accounting for the inherent noise of running
  // ~3 rollouts per candidate — Attack candidates tiebreak by the
  // caster's atk stat. Without this, a same-card-different-caster pair
  // whose avgs land within noise of each other would resolve via stable
  // sort to the lower-atk hero whenever they happened to be emitted
  // first. The emission-side sort (heroPool sorted by atk DESC) plus
  // this ranking-side tiebreak together ensure raw-atk ties go to the
  // bigger stick. MCTS still wins outright when the avg gap exceeds
  // noise — a real synergy on a low-atk hero still beats raw damage.
  results.sort((a, b) => {
    if (a.scored !== b.scored) return a.scored ? -1 : 1;
    const avgDiff = b.avg - a.avg;
    const epsilon = Math.max(3, Math.abs(b.avg) * 0.01);
    if (Math.abs(avgDiff) <= epsilon
        && a.candidate.cardType === 'Attack'
        && b.candidate.cardType === 'Attack') {
      const atkDiff = (b.candidate.casterAtk || 0) - (a.candidate.casterAtk || 0);
      if (atkDiff !== 0) return atkDiff;
    }
    return avgDiff;
  });

  const elapsed = Date.now() - t0;
  cpuLog(`  [MCTS/UCB1] ${candidates.length} cand → ${arms.length} arms, ${totalRollouts} rollouts in ${elapsed}ms${budgetExceeded ? ' [BUDGET]' : ''}:`);
  for (const r of results) {
    const vStr = r.visits > 0 ? `v=${r.visits}` : '(unscored)';
    cpuLog(`    ${r.avg.toFixed(1).padStart(8)} ${vStr.padStart(6)} — ${r.candidate.cardType} "${r.candidate.cardName}" (lvl ${r.candidate.level}) hero=${r.candidate.heroIdx} ${r.variation.label}`);
  }

  // De-dupe by candidate identity — keep the best-scoring variation per
  // candidate. Sorted-by-avg means first occurrence wins.
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (seen.has(r.candidate)) continue;
    seen.add(r.candidate);
    out.push({ ...r.candidate, scriptedTargetPlan: r.variation.plan });
  }
  // Any candidate not touched at all (budget cut off recon loop) → append
  // in heuristic order so the turn still has fallback plays.
  const unseen = candidates.filter(c => !seen.has(c));
  unseen.sort((a, b) =>
    (b.level - a.level)
    || (b.typeScore - a.typeScore)
    || ((b.casterAtk || 0) - (a.casterAtk || 0)));
  for (const c of unseen) out.push({ ...c, scriptedTargetPlan: null });
  return out;

  } catch (err) {
    if (err && err._mctsOverload) {
      // Engine tripped the per-turn snapshot cap or a heap threshold.
      // The flag `_mctsKilledThisTurn` is already set by the throw site,
      // so subsequent mctsRankCandidates calls this real turn will hit
      // the bypass at the top of the function. Surface the diagnostic
      // string to console.error AND the trail file (the throw message
      // contains topHooks / topNames / candidateAlloc / recent-trail —
      // exactly what we need to find the offending card).
      console.error(`[MCTS overload at turn ${engine.gs?.turn}] ${err.message}`);
      if (typeof engine._trailWrite === 'function') {
        engine._trailWrite('mctsOverload', { note: err.message.slice(0, 400) });
      }
      cpuLog(`  [MCTS overload] falling through to heuristic for the rest of this turn`);
      return [...candidates].sort((a, b) =>
        (b.level - a.level)
        || (b.typeScore - a.typeScore)
        || ((b.casterAtk || 0) - (a.casterAtk || 0)));
    }
    throw err;
  }
}

// ─── Turbo mode runner ─────────────────────────────────────────────────
// Runs a full CPU turn (or any async fn that drives the engine) in fast
// mode — all pacing delays, broadcasts, logs, and socket emissions are
// silenced. Exposes timing so MCTS can budget its simulations.
//
// Callers typically snapshot engine state before, run N simulations via
// this helper, then restore and pick the best action. Snapshot/restore is
// the MCTS layer's responsibility — this helper only gates perf.
async function runTurbo(engine, fn) {
  const t0 = Date.now();
  engine.enterFastMode();
  try {
    return await fn(engine);
  } finally {
    engine.exitFastMode();
    const elapsed = Date.now() - t0;
    if (CPU_DEBUG) console.log(`[CPU turbo] elapsed=${elapsed}ms`);
  }
}

// ═══════════════════════════════════════════
//  SMART MULLIGAN
//  Invoked once at game start to decide whether the CPU's opening hand is
//  worth keeping or should be shuffled back and redrawn. Conservative: we
//  only mulligan when the hand has almost nothing actionable in the first
//  couple of turns. The 5-card shuffle-and-redraw has a real variance cost
//  (you might draw worse), so bias toward keeping.
// ═══════════════════════════════════════════

/**
 * Decide whether the CPU player `pi` should mulligan its starting hand.
 * A card counts as "playable in the opening" if:
 *   • Ability — always (will attach to some hero)
 *   • Potion — always (no resource gate)
 *   • Artifact — cost fits current gold
 *   • Creature / Spell / Attack — at least one hero meets its level req
 * Mulligan when fewer than max(3, 40% of handSize) cards qualify.
 */
/**
 * T3: Mulligan-Telemetrie. Aus dem Profil: mullRate 26%, aber
 * winAfterMull 52.8% gegen winAfterKeep 49.3% — Mulligan ist im Schnitt
 * BESSER und wird trotzdem nur in einem Viertel der Spiele genutzt. Um
 * die Schwelle begründet zu verschieben statt zu raten, braucht es die
 * Entscheidung samt Hand und Bewertung.
 */
function _logMulligan(engine, pi, hand, decision, score) {
  try {
    if (engine._inMctsSim) return;
    (engine._mulliganLog = engine._mulliganLog || []).push({
      pi, hand: (hand || []).slice(), mull: !!decision,
      score: typeof score === 'number' ? Math.round(score * 100) / 100 : null,
    });
  } catch { /* nie stören */ }
}

function shouldMulliganStartingHand(engine, pi) {
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  if (!ps?.hand?.length) return false;
  const cardDB = engine._getCardDB();
  const gold = ps.gold || 0;
  let playable = 0;
  for (const cardName of ps.hand) {
    const cd = cardDB[cardName];
    if (!cd) continue;
    switch (cd.cardType) {
      case 'Ability':
      case 'Potion':
        playable++;
        break;
      case 'Artifact': {
        const cost = cd.cost || 0;
        if (cost <= gold + 4) playable++; // allow room for 1 turn of gold gain
        break;
      }
      case 'Creature':
      case 'Spell':
      case 'Attack': {
        const eligible = listEligibleHeroesForActionCard(engine, pi, cd);
        if (eligible.length > 0) playable++;
        break;
      }
      default:
        // Unknown types pessimistically don't count.
        break;
    }
  }
  const threshold = Math.max(3, Math.ceil(ps.hand.length * 0.4));
  const genericMull = playable < threshold;

  // ── Helden-Skript-Hook: cpuMulliganAdvice ──────────────────────────
  // Deck-/Helden-spezifische Mulligan-Kriterien leben im jeweiligen
  // Kartenmodul (Architektur-Regel: keine kartenspezifische Logik in
  // Core-Dateien). Ein Skript kann 'mulligan' | 'keep' | null liefern.
  // Präzedenz: 'mulligan' schlägt alles (eine für den Plan tote Hand
  // ist auch dann tot, wenn sie "spielbar" aussieht — z. B. Beato ohne
  // Schulen-Diversität), 'keep' schlägt den generischen Mulligan
  // (plan-taugliche Hände nicht wegen der Spielbarkeits-Zählung
  // wegwerfen), null → generische Regel.
  let advice = null;
  for (let hi = 0; hi < (ps.heroes?.length || 0); hi++) {
    const heroName = ps.heroes[hi]?.baseName || ps.heroes[hi]?.name;
    if (!heroName) continue;
    let script = null;
    try { script = loadCardEffect(heroName); } catch { continue; }
    if (typeof script?.cpuMulliganAdvice !== 'function') continue;
    let a = null;
    try { a = script.cpuMulliganAdvice(engine, pi, ps.hand, hi); }
    catch (err) { cpuLog(`  [mulligan] advice "${heroName}" threw: ${err.message}`); continue; }
    if (a === 'mulligan') { advice = 'mulligan'; break; }
    if (a === 'keep' && advice == null) advice = 'keep';
  }

  // ── Gelernter Kanal: Profil-Starthand-Score ────────────────────────
  // Aus startHandValues des Deck-Profils (Winrate-Delta pro Karte in
  // der finalen Starthand). Urteilt nur bei ausreichender Abdeckung
  // (≥ 50 % der Handkarten mit gelerntem Wert). Konservative Schwellen:
  // deutlich unterdurchschnittliche Hand (≤ −10) → Mulligan, deutlich
  // überdurchschnittliche (≥ +8) → Keep; dazwischen entscheidet die
  // generische Spielbarkeits-Regel. Helden-Advice behält Vorrang —
  // eine plan-tote Hand bleibt tot, egal was die Statistik sagt.
  let profMull = null;
  let profScore = null;
  const sh = deckProfile.startHandScore(engine, pi, ps.hand);
  if (sh && sh.covered >= Math.ceil(ps.hand.length / 2)) {
    profScore = Math.round(sh.score * 10) / 10;
    if (sh.score <= -10) profMull = true;
    else if (sh.score >= 8) profMull = false;
  }

  const mull = advice === 'mulligan' ? true : advice === 'keep' ? false
    : profMull != null ? profMull : genericMull;
  cpuLog(`  [mulligan] hand=${ps.hand.length} playable=${playable} threshold=${threshold} generic=${genericMull ? 'MULL' : 'KEEP'} profil=${profScore != null ? profScore : '—'} advice=${advice || '—'} → ${mull ? 'MULLIGAN' : 'KEEP'}`);
  _logMulligan(engine, pi, engine.gs?.players?.[pi]?.hand, mull, null);
  return mull;
}

/**
 * MCTS-style scoring for a card-gallery / option picker that the engine
 * exposes as a `cpuResponse` prompt. Caller passes:
 *   • `engine`    — the live engine (snapshot/restore + simulation host)
 *   • `options`   — array of { id?, ...payload }; the chosen entry is
 *                   returned verbatim. Must be a non-empty list.
 *   • `applyFn`   — async (engine, option) => boolean. The caller mutates
 *                   the engine to reflect choosing this option (e.g.
 *                   placing a creature, attaching an ability). Throw or
 *                   return false to score this option as -Infinity.
 *
 * For each option: snapshot → applyFn → rolloutRestOfTurn → evaluateState
 * → restore. The option with the highest evaluator score wins. Behaviour
 * matches the existing `rankCandidatesEvalGreedy` flow but is exposed for
 * card-script use. Recursive calls (engine already inside `_inMctsSim`)
 * fall back to the option list as-is so nested rollouts don't explode
 * exponentially — the caller should treat the first entry as the cheap
 * default in that case.
 *
 * The picker is generic: works for any cardGallery / optionPicker that
 * a card script intercepts in its `cpuResponse`. Barker, future picker
 * cards, and any "choose one" prompt with non-trivial downstream value
 * differences should route through here rather than keying off card
 * level / name heuristics.
 */
async function mctsPickFromOptions(engine, options, applyFn, opts = {}) {
  if (!Array.isArray(options) || options.length === 0) return null;
  if (options.length === 1) return options[0];
  // Inside an outer rollout — don't recurse. Return the first option;
  // the caller's heuristic ordering (if any) acts as the cheap default.
  // Same bypass for `_mctsKilledThisTurn` so post-overload pickers
  // don't take new snapshots that re-trip the cap.
  if (engine._inMctsSim || engine._mctsKilledThisTurn) return options[0];

  const cpuIdx = engine._cpuPlayerIdx;
  const prevSilent = _cpuLogSilent;
  let best = options[0];
  let bestScore = -Infinity;
  // Per-call horizon override. For one-shot decisions like Barker's
  // turn-1 placement (fires once per game), callers can pay the cost
  // of a deeper rollout so latent-value Creatures (e.g. Goff's Burn-
  // doubling at end of subsequent turns) get more turns of simulated
  // play to actually fire and show their value, instead of losing to
  // immediate-action Creatures (Harpyformers) that score deterministic
  // free-summon value within the default 2-turn window.
  const prevHorizon = _rolloutHorizon;
  const horizonOverride = Number.isInteger(opts.horizon) ? Math.max(0, opts.horizon) : null;
  if (horizonOverride !== null) _rolloutHorizon = horizonOverride;
  const prevRolloutStartT = engine._mctsRolloutStartT;
  // ── VORIGEN WERT SICHERN (12.8., Als Messlauf) ────────────────────
  // Diese Funktion war die EINZIGE von neun Stellen in dieser Datei,
  // die `_inMctsSim` am Ende hart auf `false` gesetzt hat statt den
  // vorherigen Wert wiederherzustellen (mctsRunOneRollout, die beiden
  // Skip-Bewerter und mctsEvaluate machen es alle mit `prevInSim`).
  //
  // Das Flag ist der Hauptschalter fuer „wir simulieren nur": rund 50
  // Stellen in _engine.js haengen daran — Protokollierung, Lernkanaele,
  // Trainings-Zaehler, Statistik. Steht es faelschlich auf `false`,
  // waehrend eine Simulation weiterlaeuft, halten all diese Stellen
  // simulierte Zuege fuer echte.
  //
  // Sichtbar wurde es am Startgriff-Kanal: `gameStartPickDecision`
  // protokolliert nur `if (!engine._inMctsSim)` — und im Messlauf vom
  // 12.8. standen dort **594.764 Eintraege fuer 20 Partien**, obwohl
  // Barkers Griff genau EINMAL je Partie faellt.
  const prevInSim = engine._inMctsSim;
  engine._inMctsSim = true;
  engine.enterFastMode();
  _cpuLogSilent = true;
  try {
    for (const opt of options) {
      // Honor the kill-flag mid-loop too: a previous option's rollout
      // may have tripped the cap. Bail out with whatever's best so far.
      if (engine._mctsKilledThisTurn) break;
      // Stamp a fresh per-option deadline so cpuPastDeadline's per-
      // rollout soft cap applies to each option independently.
      engine._mctsRolloutStartT = Date.now();
      if (cpuPastDeadline(engine)) break;
      let snap;
      try {
        snap = engine.snapshot();
      } catch (err) {
        if (err && err._mctsOverload) {
          // Cap tripped during this option's snapshot. Stop sampling
          // further options; return the best so far (defaults to
          // options[0] if no option scored).
          console.error(`[MCTS overload in pickFromOptions] ${err.message}`);
          break;
        }
        throw err;
      }
      let score = -Infinity;
      try {
        const ok = await applyFn(engine, opt);
        if (ok !== false) {
          // Run the rest of the turn so timed buffs / cleanups score
          // realistically. Helpers come from the engine's CPU brain
          // installation (runMainPhase / advancePhase).
          try {
            const helpers = engine._cpuHelpers || null;
            if (helpers) await rolloutRestOfTurn(engine, helpers);
          } catch { /* swallow — partial state still scores */ }
          score = evaluateState(engine, cpuIdx);
        }
      } catch { /* score stays -Infinity */ }
      finally { engine.restore(snap); resetPromptCycle(engine); }
      if (score > bestScore) { bestScore = score; best = opt; }
    }
  } finally {
    engine._inMctsSim = prevInSim;
    engine._mctsRolloutStartT = prevRolloutStartT;
    engine.exitFastMode();
    _cpuLogSilent = prevSilent;
    if (horizonOverride !== null) _rolloutHorizon = prevHorizon;
  }
  return best;
}

// `computeGoldDemand` und `mctsOpponentGoldEconomy` sind ab 16.8.
// mit exportiert: der Market-Crash-Lernkanal in `_deck-profile.js`
// verdichtet beide zu Tags und soll sie NICHT nachbauen — eine
// Gold-Bedarfsrechnung, die an zwei Stellen gepflegt wird, laeuft
// garantiert auseinander. Rein additiv, kein Aufrufer geaendert.
module.exports = { runCpuTurn, installCpuBrain, runTurbo, shouldMulliganStartingHand, setCpuVerbose, getCpuVerbose, setCpuTranscribeFn, setRolloutHorizon, getRolloutHorizon, setRolloutBrain, getRolloutBrain, mctsValueGoldVsDraw, mctsPickFromOptions, rolloutRestOfTurn, seedExploreAttempts, computeGoldDemand, mctsOpponentGoldEconomy };
