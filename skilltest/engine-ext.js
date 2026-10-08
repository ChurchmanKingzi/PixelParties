'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — ENGINE-ERWEITERUNGEN (auf der INSTANZ, nicht in der Klasse)
//
//  Alles, was nur im Modus gilt, hängt hier an der einen Engine-Instanz
//  des Skill-Test-Raums. Die Engine-Klasse bleibt (bis auf wenige, im
//  2-Spieler-Spiel wirkungsgleiche Stellen) unberührt.
// ═══════════════════════════════════════════════════════════════════
const rounds = require('./rounds');
const { loadCardEffect } = require('../cards/effects/_loader');

/**
 * Eliminierung statt Spielende: Wer alle Heroes verloren hat, scheidet aus (seine Creatures
 * handeln weiter). Das Spiel endet, wenn höchstens ein Spieler übrig ist.
 * Die Prüfung der „ausgelöschten Seite" ist dieselbe wie in der Engine (Kontrolle, Elixir, Teleport).
 */
function installElimination(engine) {
  engine.checkAllHeroesDead = async function () {
    const gs = this.gs, st = gs.skillTest;
    if (gs.result || gs._endGameLaeuft) return;
    if (gs._deferGameOverCheck > 0) { gs._gameOverCheckPending = true; return; }
    gs._gameOverCheckPending = false;

    const newly = [];
    for (let pi = 0; pi < gs.players.length; pi++) {
      if (st.eliminated.includes(pi)) continue;
      const ps = gs.players[pi];
      const controlled = this.heroesControlledBy(pi, { permanentOnly: true });
      const hatSpalte = (ps.heroes || []).length > 0;
      const allDead = (hatSpalte || controlled.length > 0) && controlled.every(({ hero }) => hero.hp <= 0);
      if (!allDead) continue;
      const hasSuspender = (ps.permanents || []).some(p => { const s = loadCardEffect(p.name); return s && s.preventsAllHeroesDeadLoss; });
      const teleported = (ps._teleportedAway || 0) > 0;
      if (!hasSuspender && !teleported) newly.push(pi);
    }
    // Quetzahuitl: Wessen Quetzahuitl gefallen ist, scheidet in jedem Fall ZUERST aus (unabhängig von Schutz-Permanents/Teleport);
    // wer gleichzeitig mit ihm fällt, scheidet danach gemeinsam aus (teilt sich den Platz). Siehe quetzahuitl-receiver-of-sacrifices.js.
    const firstOut = (gs._quetzaLosers || []).filter(pi => !st.eliminated.includes(pi));
    gs._quetzaLosers = [];
    const rest = newly.filter(pi => !firstOut.includes(pi));
    if (!firstOut.length && !rest.length) return;

    const eliminate = (group) => {
      for (const pi of group) {
        st.eliminated.push(pi);
        st.eliminatedRound[pi] = st.round;
        st.eliminatedWith[pi] = group.length;     // gleichzeitig Ausgeschiedene teilen sich den Platz
        this.log('skilltest_eliminated', { seat: pi, name: gs.players[pi].username, round: st.round });
      }
    };
    eliminate(firstOut);
    eliminate(rest);
    const alive = gs.players.map((_, i) => i).filter(i => !st.eliminated.includes(i));
    if (alive.length <= 1) {
      // Letzter Überlebender gewinnt; fallen die letzten gleichzeitig, entscheidet ein Hinweis (Bunny Bombs) oder der Zufall.
      let winner = alive[0];
      if (winner == null) {
        const pool = rest.length ? rest : firstOut;
        const hint = gs._drawLoserIdx;
        const cands = pool.filter(i => i !== hint);
        winner = (cands.length ? cands : pool)[Math.floor(Math.random() * (cands.length || pool.length))];
      }
      if (this.onGameOver) this.onGameOver(this.room, winner, 'last_standing');
      return;
    }
    this.sync();
  };
}

/** Meter für die Zugerkennung: sieht Aktions-Hooks vorbeigehen. */
function installMeter(engine) {
  const orig = engine.runHooks.bind(engine);
  engine.runHooks = async function (hookName, hookCtx = {}) {
    const m = engine._stMeter;
    if (m && m.active && rounds.METER_HOOKS.has(hookName)) m.events.push({ name: hookName, data: hookCtx });
    return orig(hookName, hookCtx);
  };
}

/** Jede Beendigung des Zuges (Ascension, Terror, `advanceToPhase(5)` …) läuft in den Round-Treiber. */
function installTurnEnd(engine, host) {
  // Effekte, die „den Zug beenden" (Terror, Aufstieg, Gate to the Armory …), beenden hier die ROUND des Sitzes:
  // was im Normalspiel „pro Turn" gilt, gilt im Skill Test pro Round.
  engine.switchTurn = async function () {
    const gs = this.gs;
    if (gs.result || !gs.skillTest) return;
    const seat = gs.activePlayer;
    gs.skillTest.turnsTaken[seat] = (gs.skillTest.turnsTaken[seat] || 0) + 1;
    gs.skillTest.passed[seat] = true;
    await rounds.advance(this, host, seat);
  };
  // Phasenwechsel durch den Spieler gibt es nicht: nach jeder Aktion ruft der Server `advanceToPhase(Main 2)`. Die Action
  // Phase des Sitzes dauert die ganze Round (Zusatzaktionen, Gewährungen und Zähler bleiben bis zum Rundenende stehen,
  // siehe rounds.js). Nur das Turn-Ende (Phase 5) läuft weiter durch.
  const origAdvance = engine.advanceToPhase.bind(engine);
  engine.advanceToPhase = async function (playerIdx, targetPhase, opts) {
    if (this.gs.skillTest && targetPhase !== 5) return true;
    return origAdvance(playerIdx, targetPhase, opts);
  };
}

/** Prompts für CPU-Sitze automatisch beantworten (die Engine hat dafür `isCpuPlayer`). */
function installBotSeats(engine, isBotSeat) {
  engine.isCpuPlayer = (pi) => !!isBotSeat(pi);
}

/**
 * Kartenskripte (`cpuResponse`) lesen den CPU-Sitz aus `engine._cpuPlayerIdx` (Normalspiel: genau ein CPU-Sitz).
 * Im Skill Test gibt es mehrere — für die Dauer der Antwort steht dort der gefragte Sitz, danach wieder -1.
 */
function withCpuSeat(engine, seat, fn) {
  const prev = engine._cpuPlayerIdx;
  engine._cpuPlayerIdx = seat;
  let out;
  try { out = fn(); } catch (e) { engine._cpuPlayerIdx = prev; throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => { engine._cpuPlayerIdx = prev; });
  engine._cpuPlayerIdx = prev;
  return out;
}

/** Bot-Zielwahl über die Policy (die Engine ruft sie für CPU-Sitze statt eines Prompts). */
function installBotBrain(engine) {
  const bot = require('./bot');
  const base = engine._getCpuTargetResponse.bind(engine);
  engine._getCpuTargetResponse = (validTargets, config = {}, pi) => withCpuSeat(engine, pi, () => bot.chooseTargets(engine, pi, validTargets, config, base));
}

// ── Die Anzeige folgt dem Geschehen ─────────────────────────────────
// Wählt ein Wirker Ziele bei einem anderen Spieler, zeigen die Clients dessen Brett, BEVOR die Karte wirkt (Hinweis
// `skillTest.watch`). Handelt ein Bot, wartet er kurz, damit man den Wechsel sieht; ein Mensch wartet nicht auf sich selbst.
const WATCH_PAUSE_MS = () => parseInt(process.env.PP_ST_WATCH_MS || '900', 10);

function announceWatch(engine, actor, target) {
  const st = engine.gs && engine.gs.skillTest;
  if (!st || engine._fastMode || engine._inMctsSim) return null;
  if (target == null || target === actor) return null;
  if (st.watch && st.watch.actor === actor && st.watch.target === target) return null;   // schon dort (derselbe Zug)
  rounds.setWatch(engine, actor, target);
  engine.sync();
  return (st.botSeats || []).includes(actor) ? engine._delay(WATCH_PAUSE_MS()) : null;
}

/** Zielwahl abschließen: vorher die Anzeige auf den Besitzer des (ersten) gewählten Ziels stellen. */
function installTargetWatch(engine) {
  const orig = engine._zielwahlAbschliessen && engine._zielwahlAbschliessen.bind(engine);
  if (!orig) return;
  engine._zielwahlAbschliessen = async function (playerIdx, validTargets, config, picked) {
    try {
      const ids = Array.isArray(picked) ? picked : (picked && picked.selectedIds) || [];
      const first = ids.length ? (validTargets || []).find(t => t && ids.includes(t.id)) : null;
      const owner = first && Number.isInteger(first.owner) ? first.owner : null;
      const wait = owner != null ? announceWatch(this, playerIdx, owner) : null;
      if (wait) await wait;
    } catch { /* reine Anzeigehilfe */ }
    return orig(playerIdx, validTargets, config, picked);
  };
}

/**
 * Flächenschaden gegen „den Gegner": mit mehreren Gegnern wählt der Wirker EINEN Spieler,
 * dessen Ziele getroffen werden (wie bei „Divine Gift of Fire"). Die Wahl wird zum Fokus
 * des Wirkers (`gs.stFocus`), damit `opponentOf` danach denselben Spieler meint.
 */
function installPlayerChoice(engine) {
  const living = (gs, pi) => gs.players.map((_, i) => i).filter(i => i !== pi
    && (gs.players[i].heroes || []).some(h => h && h.name && h.hp > 0));
  engine._stChooseAoePlayer = async function (pi, config, cardInst) {
    const gs = this.gs;
    const cands = living(gs, pi);
    if (cands.length <= 1) { if (cands.length === 1) await this.setFocusOpponent(pi, cands[0]); return; }
    const title = (cardInst && cardInst.name) || config.sourceName || 'Choose a player';
    const res = await this.promptGeneric(pi, {
      type: 'playerPicker', title, description: 'Choose a player. All their targets are hit.',
      allowedPlayers: cands, cancellable: false,
    });
    const idx = res && Number.isInteger(res.playerIdx) && cands.includes(res.playerIdx) ? res.playerIdx : cands[0];
    await this.setFocusOpponent(pi, idx);
  };
  engine.setFocusOpponent = function (pi, idx) {
    const gs = this.gs;
    if (!gs.skillTest) return;
    (gs.stFocus || (gs.stFocus = {}))[pi] = idx;
    return announceWatch(this, pi, idx);                // die Anzeige wechselt auf diesen Spieler, bevor die Karte wirkt (Bots warten kurz)
  };
  /**
   * Karten, die „den Gegner" als Ganzes meinen (Chain Lightning, Cardinal Beast Qinglong, die Bottled-Kette …), fragen den
   * Menschen bei mehreren lebenden Gegnern, wen er treffen will; Bots entscheiden über die Policy. Der Gewählte wird zum
   * Fokus des Wirkers, `opponentOf` meint danach genau ihn. Gibt den gewählten Sitz zurück.
   */
  engine._stChooseOpponent = async function (pi, title, description) {
    const gs = this.gs;
    if (!gs.skillTest) return this.opponentOf(pi);
    const cands = living(gs, pi);
    if (cands.length <= 1) { if (cands.length === 1) await this.setFocusOpponent(pi, cands[0]); return this.opponentOf(pi); }
    const res = await this.promptGeneric(pi, {
      type: 'playerPicker', title: title || 'Choose a player',
      description: description || 'Choose the player you want to target.',
      allowedPlayers: cands, cancellable: false,
    });
    const idx = res && Number.isInteger(res.playerIdx) && cands.includes(res.playerIdx) ? res.playerIdx : cands[0];
    await this.setFocusOpponent(pi, idx);
    return idx;
  };
  // Bots beantworten die Spielerwahl über die Policy (schwächster bzw. stärkster Gegner).
  const baseGeneric = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, promptedPlayerIdx) => withCpuSeat(engine, promptedPlayerIdx, () => {
    if (promptData && promptData.type === 'playerPicker') {
      const pool = (promptData.allowedPlayers && promptData.allowedPlayers.length) ? promptData.allowedPlayers : living(engine.gs, promptedPlayerIdx);
      return { playerIdx: require('./bot').choosePlayer(engine, promptedPlayerIdx, pool, promptData) };
    }
    return baseGeneric(promptData, promptedPlayerIdx);
  });
}

/**
 * Reaktionen der Bots (Hand, Surprise, Held): Die Standard-CPU entscheidet nach Karten-Heuristik; hier kommen Persona,
 * gelernter Wert und Neugier dazu (bot.shapeReaction). Am Ende jeder Aktion werden die vorgemerkten Entscheidungen bewertet.
 */
function installReactions(engine) {
  const prev = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, seat) => {
    const r = prev(promptData, seat);
    try { return withCpuSeat(engine, seat, () => require('./bot').shapeReaction(engine, seat, promptData, r, prev)); }
    catch (e) { console.error('[skilltest] Reaktionslogik:', e && e.message); return r; }
  };
  engine._stFlushReactions = () => { try { require('./bot').flushReactions(engine.room); } catch { /* Lernhilfe */ } };
}

/**
 * Auswahl-Abfragen bestimmter Zauber (Karten aus der Ablage zurückholen, Kartennamen ansagen, Artifact suchen): die Standard-CPU lehnt sie ab,
 * der Zauber fiele in sich zusammen. `skilltest/prompts.js` beantwortet genau die dort gelisteten Abfragen.
 */
function installPrompts(engine) {
  const prev = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, seat) => {
    const P = require('./prompts');
    if (engine.gs && engine.gs.skillTest && P.handles(promptData)) {
      try {
        const r = withCpuSeat(engine, seat, () => P.answer(engine, seat, promptData));
        if (r !== undefined) return r;
      } catch (e) { console.error('[skilltest] Auswahl-Antwort:', e && e.stack || e); }
    }
    return prev(promptData, seat);
  };
}

/**
 * Mulligan-Prompts der Bots (Leadership, Horn in a Bottle, Staff of the Teleporter, Crescent Moon): `skilltest/mulligan.js` entscheidet,
 * welche Handkarten zurückgemischt werden — oder ob gar nicht (gelernter Kanal „Wann Mulligans?“). Die Standard-CPU lehnt abbrechbare Prompts ab.
 */
function installMulligan(engine) {
  const prev = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, seat) => {
    const M = require('./mulligan');
    if (engine.gs && engine.gs.skillTest && M.isMulliganPrompt(promptData)) {
      try { return withCpuSeat(engine, seat, () => M.respond(engine, seat, promptData)); }
      catch (e) { console.error('[skilltest] Mulligan-Logik:', e && e.stack || e); return null; }
    }
    return prev(promptData, seat);
  };
}

/**
 * `engine.restore(snap)` ersetzt `gs.skillTest` durch eine KOPIE (die Identität geht verloren, nicht aufzählbare
 * Felder wie die Timer-Handles gehen mit). Der Rundentreiber, Wächter und Timer halten aber das lebende Objekt:
 * nach jedem Restore bekommt es die Werte der Kopie, bleibt selbst aber dasselbe Objekt.
 */
function installSnapshotGuard(engine) {
  const orig = engine.restore.bind(engine);
  engine.restore = function (snap) {
    const live = this.gs.skillTest;
    const r = orig(snap);
    const restored = this.gs.skillTest;
    if (live && restored && restored !== live) {
      for (const k of Object.keys(live)) if (!(k in restored)) delete live[k];
      Object.assign(live, restored);
      this.gs.skillTest = live;
    }
    return r;
  };
}

/**
 * Schrittbudget je Aktion: Karten mit „darf erneut"-Schleifen (Skeleton Reaper …) laufen ohne Grenze, wenn der
 * Spieler nie abbricht (ein Bot bricht freiwillige Ziel-Prompts nie ab, eine Karte lässt Ziele zurückkehren …).
 * Jede Animationspause (`_delay`) zählt; über dem Budget wird die Aktion mit einem Fehler beendet.
 */
const MAX_DELAYS_PER_ACTION = 6000;
function installRunawayBreaker(engine) {
  const orig = engine._delay.bind(engine);
  engine._delay = (ms) => {
    const st = engine.gs && engine.gs.skillTest;
    if (st && st.busy && ++st._delays > MAX_DELAYS_PER_ACTION) {
      st._delays = -1e9;                                    // nur einmal werfen
      // Diagnose für die Fehlersuche (selten): welche Karte/Prompts treiben die Schleife? Aufrufkette und Prompt-Zähler der Aktion.
      try {
        const frames = (new Error().stack || '').split('\n').slice(2, 14).map(l => l.trim().replace(/^at /, '').replace(/\(?\/home\/user\/PixelParties\//, '(')).filter(l => !/node:internal/.test(l));
        console.error('[ST_RUNAWAY] Aktion von Sitz ' + engine.gs.activePlayer + ' (Round ' + st.round + '), Prompts: ' + JSON.stringify(engine._stPromptCounts || {}) + '\n   ' + frames.join('\n   '));
      } catch { /* Diagnose darf nie stören */ }
      throw new Error('ST_RUNAWAY: die Aktion überschreitet ihr Schrittbudget (Endlosschleife einer Karte?)');
    }
    return orig(ms);
  };
}

/** Kein Handlimit, keine Deck-Out-Niederlage (es gibt keine Decks). */
function relaxRules(engine) {
  for (const ps of engine.gs.players) ps._noHandLimitUntilTurn = Infinity;
}

// ── Ziehen und Mulligan: Karten „von außerhalb des Spiels“ ───────────────────────────────────────────────────────
// Der Modus hat keine Decks; Ziehen und Mulligan (Alchemy, Wheels, Haste, Leadership, Horn in a Bottle …) funktionieren trotzdem:
//  • Ziehen: vor dem Ziehen erscheinen X Karten im Deck (bzw. Potion Deck) und fliegen mit den normalen Animationen zur Hand. Es sind ZUFÄLLIGE NEUE
//    Karten aus dem Pool — nicht in Rotation (nicht in einer Hand, auf einem Brett oder in einer Ablage), Heroes ausgeschlossen. Aus dem Potion Deck
//    kommen immer Potions, aus dem Deck nie. Spell-School-Abilities kommen nicht, wenn der Spieler sie schon auf dem Brett hat; andere Abilities schon.
//  • Mulligan: die zurückgemischten Karten fliegen sichtbar zum Deck, das Deck mischt (normale Animation) — dann ersetzen X neue Zufallskarten sie
//    (die zurückgemischten gehen in den Pool zurück und können theoretisch wiederkommen), und es werden genau diese gezogen.
// Im Lookahead (_inMctsSim) wird der Pool nur gelesen, nie verändert.
const SPELL_SCHOOL_ABILITIES = ['Magic Arts', 'Decay Magic', 'Support Magic', 'Destruction Magic', 'Summoning Magic'];

function stPool(engine) { return engine.room && engine.room.skillTest && engine.room.skillTest.pool || null; }

/** Spell-School-Abilities, die dieser Spieler schon hat (Start-Abilities seiner Heroes oder angelegt). */
function schoolsOnBoard(engine, pi) {
  const cards = engine._getCardDB(), ps = engine.gs.players[pi], out = new Set();
  for (const h of (ps && ps.heroes) || []) { const c = h && h.name && cards[h.name]; if (c) for (const a of [c.startingAbility1, c.startingAbility2]) if (SPELL_SCHOOL_ABILITIES.includes(a)) out.add(a); }
  for (const col of (ps && ps.abilityZones) || []) for (const z of col || []) for (const n of (z || [])) if (SPELL_SCHOOL_ABILITIES.includes(n)) out.add(n);
  return out;
}

function stNewCard(engine, pi, kind) {
  const pool = stPool(engine);
  if (!pool) return null;
  const cards = engine._getCardDB();
  const have = kind === 'main' ? schoolsOnBoard(engine, pi) : null;
  const pred = (n, b) => {
    if (kind === 'potion') return b === 'potion';
    if (b === 'hero' || b === 'potion') return false;
    if (b === 'ability' && have && have.has(n)) return false;          // Spell-School-Abilities nur, wenn der Spieler sie noch nicht hat
    return !!cards[n];
  };
  return engine._inMctsSim ? pool.peekRandom(pred) : pool.takeRandom(pred);
}

function stGiveBack(engine, name) {
  const pool = stPool(engine);
  if (!pool || engine._inMctsSim || !name) return;
  const b = require('./pool').bucketOf(engine._getCardDB()[name]);
  if (b) pool.give(b, name);
}

/** Das Deck (Haupt- oder Potion Deck) auf mindestens `count` neue Karten bringen; liegt schon etwas darin, bleibt es. */
function stFillDeck(engine, pi, kind, count) {
  const ps = engine.gs.players[pi];
  if (!ps || !engine.gs.skillTest) return 0;
  const deck = kind === 'potion' ? (ps.potionDeck = ps.potionDeck || []) : (ps.mainDeck = ps.mainDeck || []);
  let added = 0;
  while (deck.length < count) { const n = stNewCard(engine, pi, kind); if (!n) break; deck.push(n); added++; }
  return added;
}

/** Übrige Karten aus dem Deck zurück in den Pool: im Ruhezustand sind die Decks leer. */
function stClearDeck(engine, pi, kind) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const deck = kind === 'potion' ? ps.potionDeck : ps.mainDeck;
  if (!deck || !deck.length) return;
  for (const n of deck.splice(0, deck.length)) stGiveBack(engine, n);
  if (kind !== 'potion') ps.deckTopVisible = [];
}

/**
 * Gezogene Karten zählen als Stellungsgewinn (policy.sideValue: „Ziehen ist immer etwas wert“). `ps._stDrawn` ist der Zähler je Sitz;
 * Mulligan-Karten ersetzen nur (siehe unten: das Nachziehen derselben Anzahl wird gegengerechnet), ein Bonus-Zug (Horn in a Bottle,
 * Leadership Lv3, Staff bei ganzer Hand) bleibt übrig.
 */
function tallyDraw(engine, pi, n) {
  const ps = engine.gs.players[pi];
  if (ps && n) ps._stDrawn = (ps._stDrawn || 0) + n;
}

function installDraws(engine) {
  const origDraw = engine.actionDrawCards.bind(engine);
  engine.actionDrawCards = async function (pi, count, opts = {}) {
    if (!this.gs.skillTest || opts._isResourceDraw) return origDraw(pi, count, opts);
    const added = stFillDeck(this, pi, 'main', count);
    if (added > 0 && !this._inMctsSim && !this._fastMode) { this.sync(); await this._delay(250); }       // die Karten erscheinen kurz im Deck …
    try {
      const drawn = await origDraw(pi, count, opts);                                                     // … und fliegen zur Hand
      tallyDraw(this, pi, Array.isArray(drawn) ? drawn.length : 0);
      return drawn;
    } finally { stClearDeck(this, pi, 'main'); }
  };

  const origPotion = engine.actionDrawFromPotionDeck.bind(engine);
  engine.actionDrawFromPotionDeck = async function (pi, count) {
    if (!this.gs.skillTest) return origPotion(pi, count);
    const added = stFillDeck(this, pi, 'potion', count);
    if (added > 0 && !this._inMctsSim && !this._fastMode) { this.sync(); await this._delay(250); }
    try {
      const drawn = await origPotion(pi, count);
      tallyDraw(this, pi, Array.isArray(drawn) ? drawn.length : 0);
      return drawn;
    } finally { stClearDeck(this, pi, 'potion'); }
  };

  const origMulligan = engine.actionMulliganCards.bind(engine);
  engine.actionMulliganCards = async function (pi, names, handIdx) {
    const res = await origMulligan(pi, names, handIdx);              // Karten fliegen zum Deck, das Deck mischt (normale Animation)
    // Das Nachziehen der zurückgemischten Karten (Hauptdeck: über actionDrawCards) ist kein Gewinn — Gegenrechnung; Tränke kommen am Draw vorbei zurück.
    if (this.gs.skillTest && res) tallyDraw(this, pi, -Math.max(0, (res.totalReturned || 0) - (res.potionCount || 0)));
    if (this.gs.skillTest) {
      // Neue Karten ersetzen die zurückgemischten; die alten gehen in den Pool zurück (und können wiederkommen)
      this.gs.players.forEach((p, i) => {
        for (const kind of ['main', 'potion']) {
          const deck = kind === 'potion' ? p.potionDeck : p.mainDeck;
          if (!deck || !deck.length) continue;
          const k = deck.length;
          stClearDeck(this, i, kind);
          stFillDeck(this, i, kind, k);
        }
      });
      this.sync();
    }
    return res;
  };
}

module.exports = { installPrompts, installMulligan, installReactions, installRunawayBreaker, installSnapshotGuard, installPlayerChoice, installTargetWatch, installElimination, installMeter, installTurnEnd, installBotSeats, installBotBrain, relaxRules, installDraws, stFillDeck, stClearDeck, stNewCard };
