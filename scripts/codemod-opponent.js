#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — CODEMOD „Gegner-Index zentral" (N-Spieler-Umbau)
//
//  Ersetzt das hart verdrahtete Zwei-Spieler-Idiom durch die zentralen
//  Hilfen aus cards/effects/_opp.js (siehe dort):
//
//    X === 0 ? 1 : 0          →  this.opponentOf(X)            (GameEngine-Methode)
//                               engine.opponentOf(X)           (`engine` im Gültigkeitsbereich)
//                               ctx._engine.opponentOf(X)      (`ctx` mit `_engine`)
//                               opponentOfGs(gs, X)            (nur `gs` da; require('./_opp'))
//    1 - X  (X = Spielerindex) →  dasselbe
//    for (…; i < 2; …)         →  i < this.playerCount() / engine.playerCount() / gs.players.length
//                               (nur Spieler-Schleifen; Slot-/Zonen-Schleifen bleiben)
//    [0, 1] (Spielerliste)     →  <gs>.players.map((_, i) => i)
//
//  Wie es arbeitet: Babel-AST + Scope-Analyse, aber Änderungen als TEXT-
//  Ersetzungen an den Knoten-Offsets — Formatierung und Kommentare bleiben
//  unberührt, keine Datei wird neu generiert. Läuft idempotent: nach dem
//  Umbau findet es nichts mehr; mehrfaches Ausführen ändert nichts.
//
//  Zielwahl je Fundstelle, die ERSTE zutreffende Form:
//    1. in GameEngine-Methoden (nur _engine.js, `this` ist die Engine)
//    2. `engine` im Gültigkeitsbereich (deklariert VOR der Stelle, nie
//       umgeschrieben, nirgends als „darf fehlen" benutzt)
//    3. `ctx` im Gültigkeitsbereich UND `ctx._engine` (bzw. `ctx.engine`)
//       wird in derselben Funktion tatsächlich benutzt
//    4. `gs` im Gültigkeitsbereich (→ opponentOfGs, null-sicher)
//    5. server.js: `room` im Gültigkeitsbereich (→ opponentOfGs(room.gameState, …))
//    sonst: NICHT anfassen, auf die Prüfliste.
//
//  NICHT angefasst (Zwei-Spieler-Inseln): _cpu.js, _deck-profile.js,
//  _train-*.js, _demo-recorder.js, _decision-log.js, _sc-tracking.js sowie
//  in server.js alles, was nicht reines Spielgeschehen ist (Spielende,
//  Rematch, Side-Deck, Puzzle, CPU-Kampf, Training, Lobby/Sitze).
//
//  AUFRUF
//    node scripts/codemod-opponent.js --dry          # nur zählen + Prüfliste
//    node scripts/codemod-opponent.js                # umschreiben
//    node scripts/n-player-todo.js                   # (separat) docs/n-player-todo.md neu schreiben
//    node scripts/check-n-player.js                  # (separat) Lint: kein Idiom darf zurückkehren
//    node scripts/codemod-opponent.js [Dateien…]     # nur diese Dateien
//    --verbose                                       # jede Ersetzung einzeln listen
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('./vendor/babel.min.js');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const WURZEL = path.join(__dirname, '..');
const EFFECTS = path.join(WURZEL, 'cards', 'effects');

// ── Zwei-Spieler-Inseln: bleiben unangetastet ───────────────────────
const INSELN = [
  /^_cpu\.js$/, /^_deck-profile\.js$/, /^_train-.*\.js$/, /^_demo-recorder\.js$/,
  /^_decision-log\.js$/, /^_sc-tracking\.js$/,
  /^_opp\.js$/,                       // die Hilfen selbst
];
const istInsel = (rel) => rel.startsWith('cards/effects/') && INSELN.some(r => r.test(path.basename(rel)));

// ── server.js: nur diese Funktionen/Handler sind „reines Spielgeschehen" ──
// (Namen wie `enclosingNames` sie liefert: Funktionsname oder on(<Ereignis>)).
const SERVER_OPP_ERLAUBT = new Set([
  'checkPotionLock', 'broadcastHandToBoard', 'sendGameState', 'sendGameStateErzwungen', 'sendSpectatorGameState',
  'doPlayArtifact', 'doTriggerTreacherousCrystal', 'doActivatePermanent',
  'doActivateEquipEffect', 'doConfirmPotion', 'doUsePotion',
  'on(targeting_update)', 'on(ping_card)', 'on(pending_placement)',
  'on(pending_placement_clear)', 'on(blind_pick_update)',
]);
const SERVER_SCHLEIFE_ERLAUBT = new Set([
  'sendGameState', 'sendGameStateErzwungen', 'sendSpectatorGameState',
  'doPlaySpell', 'doPlayAbility', 'doPlayAbilityFremd', 'doPlayArtifact', 'doPlayCreature',
  'doPlaySurprise', 'doPlaySurpriseFremd', 'doTriggerTreacherousCrystal',
  'doActivateAbility', 'doActivateAreaEffect', 'doActivateCreatureEffect',
  'doActivateDiscardEffect', 'doActivateEquipEffect', 'doActivateFreeAbility',
  'doActivateHeroEffect', 'doActivatePermanent', 'doConfirmPotion', 'doUsePotion',
  'doUseArtifactEffect',
  'on(activate_hand_card)', 'on(ascend_hero)', 'on(cancel_potion)',
  'on(play_from_coolness_stack)', 'on(reorder_creation)', 'on(reorder_hand)',
  'on(summon_ushabti)',
]);
// Innerhalb eines Handlers liegen manche Schleifen in Unterfunktionen, die
// nicht zum Spielgeschehen gehören (Terror-Timer ist Spielgeschehen).
const SERVER_NOTIZ = {
  endGame: 'Spielende: Sieger/Verlierer, Elo, Side-Deck-Phase — Mehrspieler-Wertung ist eine Entscheidung',
  puzzleEndGame: 'Puzzle-Ende (2 Spieler, Spieler 0 = Löser)',
  endCpuBattle: 'CPU-Kampf-Ende (2 Spieler, 0 = Mensch)',
  endCampaignBattle: 'Kampagnen-Kampf-Ende (2 Spieler)',
  createPuzzleGame: 'Puzzle-Aufbau (Puzzle-Daten sind 2-Spieler-Arrays)',
  createCpuBattle: 'CPU-Kampf-Aufbau (bleibt 2 Spieler)',
  runNetBenchmark: 'Netbench (bleibt 2 Spieler)',
  startGameEngine: 'Spielstart (Starthand ziehen, Mulligan)',
  startChallengeGame: 'Herausforderungs-Start (Lobby)',
  advanceToNextGame: 'Folgepartie im Match (Side-Deck/Lobby)',
  'on(mulligan_decision)': 'Mulligan-Phase (mulliganDecisions = [null, null])',
  'on(request_rematch)': 'Rematch (Lobby/Sitze)',
  'on(rematch_first_choice)': 'Rematch (Lobby/Sitze)',
  'on(leave_game)': 'Aufgeben/Verlassen: „Gegner gewinnt" ist im Mehrspielermodus nicht definiert',
  'on(surrender_game)': 'Aufgeben: „Gegner gewinnt" ist im Mehrspielermodus nicht definiert',
  'on(surrender_match)': 'Aufgeben: „Gegner gewinnt" ist im Mehrspielermodus nicht definiert',
  'on(side_deck_swap)': 'Side-Deck-Phase (Match-Ablauf, zwei Sitze)',
  'on(side_deck_move)': 'Side-Deck-Phase (Match-Ablauf, zwei Sitze)',
  'on(side_deck_reset)': 'Side-Deck-Phase (Match-Ablauf, zwei Sitze)',
  'on(side_deck_done)': 'Side-Deck-Phase (Match-Ablauf, zwei Sitze)',
  'on(auth)': 'Wiederverbinden/Sitz-Logik (Lobby)',
  'on(disconnect)': 'Verbindungsabbruch/Sitz-Logik (Lobby)',
  'on(tutorial_modify)': 'Tutorial (Einzelspieler)',
};

// ── Kleinkram ──────────────────────────────────────────────────────
const num = (n, v) => !!n && n.type === 'NumericLiteral' && n.value === v;
const zeile = (n) => n.loc.start.line;

/** Funktionsname bzw. on('<Ereignis>') der umschließenden Funktionen, außen→innen. */
function enclosingNames(p) {
  const names = [];
  for (let q = p; q; q = q.parentPath) {
    const n = q.node;
    if (n.type === 'FunctionDeclaration' && n.id) names.push(n.id.name);
    else if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
      && n.callee.property.name === 'on' && n.arguments[0] && n.arguments[0].type === 'StringLiteral') {
      names.push('on(' + n.arguments[0].value + ')');
    } else if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && /Function/.test(n.init.type)) {
      names.push(n.id.name);
    }
  }
  return names.reverse();
}

/** Ist `ref` ein Nullprüfungs-/Wächter-Gebrauch („darf fehlen")? */
function istWaechter(ref) {
  const par = ref.parentPath;
  const n = ref.node;
  if (!par) return false;
  if (par.isOptionalMemberExpression() && par.node.object === n) return true;
  if (par.isOptionalCallExpression() && par.node.callee === n) return true;
  if (par.isLogicalExpression() && par.node.left === n) return true;
  if (par.isUnaryExpression() && (par.node.operator === '!' || par.node.operator === 'typeof')) return true;
  if ((par.isIfStatement() || par.isConditionalExpression() || par.isWhileStatement()
    || par.isDoWhileStatement() || par.isForStatement()) && par.node.test === n) return true;
  if (par.isBinaryExpression() && ['==', '===', '!=', '!=='].includes(par.node.operator)) {
    const anderes = par.node.left === n ? par.node.right : par.node.left;
    if (anderes.type === 'NullLiteral' || (anderes.type === 'Identifier' && anderes.name === 'undefined')) return true;
  }
  return false;
}

/**
 * Gibt die Bindung zurück, wenn `name` an der Stelle sicher benutzbar ist:
 * sichtbar, vor der Stelle fertig deklariert (TDZ/hoisting), nie umgeschrieben
 * und (bei `pruefeWaechter`) nirgends als „darf fehlen" behandelt.
 */
function bindung(p, name, stelle, pruefeWaechter) {
  const b = p.scope.getBinding(name);
  if (!b) return null;
  if (b.constantViolations.length) return null;
  if (b.kind !== 'param' && b.kind !== 'hoisted' && b.path.node.end > stelle) return null;
  if (pruefeWaechter) {
    if (b.kind === 'param') {
      if (b.path.isAssignmentPattern() || (b.path.parentPath && b.path.parentPath.isAssignmentPattern())) return null;
    }
    for (const r of b.referencePaths) if (istWaechter(r)) return null;
  }
  return b;
}

/** Sind `gs` UND `engine` Parameter derselben Funktion, mit `engine` hinter `gs`? */
function engineHinterGs(p, engineBindung) {
  const g = p.scope.getBinding('gs');
  return !!(g && engineBindung.kind === 'param' && g.kind === 'param'
    && g.scope === engineBindung.scope && engineBindung.identifier.start > g.identifier.start);
}

/** Ist die Bindung der erste Parameter einer Funktion, die direkt unter `hooks: { … }` hängt? */
function istHookKontext(b) {
  const f = b.scope.path;                       // die Funktion, die den Parameter deklariert
  if (!f || !f.isFunction()) return false;
  const params = f.node.params;
  if (!params.length || params[0].type !== 'Identifier' || params[0].name !== b.identifier.name) return false;
  const prop = f.parentPath;                    // ObjectProperty / ObjectMethod
  const obj = f.isObjectMethod() ? f.parentPath : (prop && prop.isObjectProperty() ? prop.parentPath : null);
  const hooksProp = obj && obj.parentPath;
  return !!(obj && obj.isObjectExpression() && hooksProp && hooksProp.isObjectProperty()
    && hooksProp.node.key && (hooksProp.node.key.name === 'hooks' || hooksProp.node.key.value === 'hooks'));
}

/** Wie oft kommt `this` in der Methode (ohne verschachtelte Nicht-Pfeil-Funktionen) vor? */
function thisAnzahl(methodPath) {
  let k = 0;
  methodPath.traverse({
    ThisExpression() { k++; },
    Function(f) { if (!f.isArrowFunctionExpression()) f.skip(); },
  });
  return k;
}

/** Liegt die Stelle in einer (nicht-statischen) Methode der Klasse GameEngine, in der `this` die Engine ist? */
function inEngineMethode(p) {
  for (let q = p; q; q = q.parentPath) {
    if (!q.isFunction()) continue;
    if (q.isArrowFunctionExpression()) continue;
    if ((q.isClassMethod() || q.isClassPrivateMethod()) && !q.node.static) {
      const klasse = q.parentPath && q.parentPath.parentPath;
      if (!(klasse && klasse.isClassDeclaration() && klasse.node.id && klasse.node.id.name === 'GameEngine')) return false;
      return thisAnzahl(q) > 0 || nurAlsMethodeGerufen(q.node.key && q.node.key.name);
    }
    return false;
  }
  return false;
}

// Methoden ohne eigenes `this` dürfen `this` nur benutzen, wenn sie nirgends losgelöst (als Callback,
// ohne Objekt) verwendet werden: jedes Vorkommen im Projekt muss `<objekt>.name(` sein.
let _projektText = null;
function nurAlsMethodeGerufen(name) {
  if (!name) return false;
  if (!_projektText) {
    _projektText = [];
    const dirs = [EFFECTS, path.join(WURZEL, 'scripts')];
    for (const d of dirs) for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) _projektText.push(fs.readFileSync(path.join(d, f), 'utf8'));
    _projektText.push(fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8'));
  }
  const alle = new RegExp(`\\b${reEsc(name)}\\b`, 'g');
  const sauber = new RegExp(`\\.${reEsc(name)}\\(`, 'g');
  let gesamt = 0, sauberAnz = 0, definition = 0;
  const defRe = new RegExp(`^\\s*(?:async\\s+)?${reEsc(name)}\\s*\\(`, 'gm');
  for (const t of _projektText) {
    gesamt += (t.match(alle) || []).length;
    sauberAnz += (t.match(sauber) || []).length;
    definition += (t.match(defRe) || []).length;
  }
  return gesamt - definition === sauberAnz;
}

/**
 * Wählt die Aufruf-Form für die Stelle. Rückgabe:
 *   { art: 'this'|'engine'|'ctx'|'gs'|'room', engine: 'this'|'engine'|'ctx._engine'|'ctx.engine', gs: Ausdruck }
 * `engine` ist der Ausdruck, an dem `.opponentOf()`/`.playerCount()` hängt;
 * `gs` ist ein Ausdruck für den Spielzustand (für opponentOfGs / .players).
 */
function waehleForm(p, ctx) {
  const stelle = p.node.start;
  if (ctx.istEngineDatei && inEngineMethode(p)) return { art: 'this', engine: 'this', gs: 'this.gs' };
  // `engine` als NACHGESTELLTER Parameter hinter `gs` (`spellPlayCondition(gs, pi, engine)`): Aufrufer lassen
  // ihn mitunter weg (learning.js, rubin-the-dragoneer-champion.js rufen `(gs, pi)`) — dann lieber über `gs`.
  const eb = bindung(p, 'engine', stelle, true);
  if (eb && !engineHinterGs(p, eb)) return { art: 'engine', engine: 'engine', gs: 'engine.gs' };
  const c = bindung(p, 'ctx', stelle, true);
  if (c) {
    let unterstrich = false, plain = false;
    for (const r of c.referencePaths) {
      const par = r.parentPath;
      if (!par || !(par.isMemberExpression() || par.isOptionalMemberExpression())) continue;
      if (par.node.object !== r.node || par.node.computed || par.node.property.type !== 'Identifier') continue;
      if (istWaechter(par)) continue;
      if (par.node.property.name === '_engine') unterstrich = true;
      else if (par.node.property.name === 'engine') plain = true;
    }
    if (unterstrich) return { art: 'ctx', engine: 'ctx._engine', gs: 'ctx._engine.gs' };
    if (plain) return { art: 'ctx', engine: 'ctx.engine', gs: 'ctx.engine.gs' };
    // Standard-Hook-Kontext: Funktion unter `hooks: { … }` — den baut `_createContext` bzw. jede
    // handgebaute Stelle der Engine MIT `_engine`.
    if (c.kind === 'param' && istHookKontext(c)) return { art: 'ctx', engine: 'ctx._engine', gs: 'ctx._engine.gs' };
  }
  if (bindung(p, 'gs', stelle, false)) return { art: 'gs', engine: null, gs: 'gs' };
  if (ctx.istServer && bindung(p, 'room', stelle, false)) return { art: 'room', engine: null, gs: 'room.gameState' };
  // `engine` ist da, darf aber fehlen (`engine?.gs`, `if (!engine)`): null-sicher über den Spielzustand.
  if (bindung(p, 'engine', stelle, false)) return { art: 'engine?', engine: null, gs: 'engine?.gs' };
  return null;
}

/** Quelltext von `n`, Klammern um n selbst bleiben außen (Offsets des Knotens). */
const text = (code, n) => code.slice(n.start, n.end);
const kommentarIn = (s) => /\/\/|\/\*/.test(s);

// ── Muster-Erkennung ───────────────────────────────────────────────
/** `X === 0 ? 1 : 0` → { x } sonst null. (Auch „yoda": `0 === X`.) */
function oppBedingung(n) {
  if (n.type !== 'ConditionalExpression') return null;
  if (!num(n.consequent, 1) || !num(n.alternate, 0)) return null;
  const t = n.test;
  if (t.type !== 'BinaryExpression' || t.operator !== '===') return null;
  if (num(t.right, 0)) return { x: t.left };
  if (num(t.left, 0)) return { x: t.right };
  return null;
}

/** Spielerindex-artige Operanden von `1 - X` (X selbst ist ein Spielerindex, „ich"). */
const MINUS_ICH = /^(?:pi|playerIdx|owner|ownerIdx|negatedOwner|gs\.activePlayer|gs\._naechsterEinzelschadenX2\.owner)$/;
/** … und die Gegner-Namen: `1 - oppIdx` meint „ich", nicht „Gegner von oppIdx" → Prüfliste. */
const MINUS_GEGNER = /^(?:opp\w*|oi|opponentIdx)$/;

/** Namen von Schleifenvariablen, die eindeutig Spieler sind (`i` nur mit Beleg im Rumpf). */
const SPIELER_VAR = /^(?:pi|p|pIdx|tpi|phi|owner|ownerIdx|ownerPi|seite|spi|sp|checkPlayer|pOwner|aoi|ownerPi)$/;

function istSchleife2(n) {
  if (n.type !== 'ForStatement') return null;
  const init = n.init;
  if (!init || init.type !== 'VariableDeclaration' || init.declarations.length !== 1) return null;
  const d = init.declarations[0];
  if (d.id.type !== 'Identifier' || !num(d.init, 0)) return null;
  const v = d.id.name;
  const t = n.test;
  if (!t || t.type !== 'BinaryExpression' || t.operator !== '<' || t.left.type !== 'Identifier' || t.left.name !== v || !num(t.right, 2)) return null;
  const u = n.update;
  const ok = u && ((u.type === 'UpdateExpression' && u.operator === '++' && u.argument.type === 'Identifier' && u.argument.name === v)
    || (u.type === 'AssignmentExpression' && u.operator === '+=' && num(u.right, 1) && u.left.name === v));
  if (!ok) return null;
  return { v, bound: t.right };
}

const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\$]/g, '\\$&');

/** Wird die Schleifenvariable im Rumpf erkennbar als SPIELER-Index benutzt? */
function spielerBeleg(code, rumpf, v) {
  v = reEsc(v);
  const s = code.slice(rumpf.start, rumpf.end);
  const re = new RegExp(
    `\\bplayers(?:\\?\\.)?\\[\\s*${v}\\s*\\]`
    + `|\\bareaZones(?:\\?\\.)?\\[\\s*${v}\\s*\\]`
    + `|\\bsendGameState\\w*\\([^)]*\\b${v}\\b`
    + `|\\b(?:getHeroTargets|getCreatureTargets|getAbilityTargets)(?:\\?\\.)?\\(\\s*${v}\\s*\\)`
    + `|_scanSurpriseEntriesForPlayer\\(\\s*${v}\\b`
    + `|\\bifritsOf\\(\\s*\\w+,\\s*${v}\\b`);
  return re.test(s);
}

/**
 * Urteil über `for (…; v < 2; …)`: null = keine solche Schleife; sonst { s, spieler, grund }.
 * „Spieler" heißt: die Schleifenvariable wird im Rumpf erkennbar als Spielerindex benutzt.
 */
function bewerteSchleife(code, n) {
  const s = istSchleife2(n);
  if (!s) return null;
  const beleg = spielerBeleg(code, n.body, s.v);
  const nameOk = SPIELER_VAR.test(s.v);
  if (!beleg && !nameOk) {
    return { s, spieler: false, grund: 'Schleife bis 2 ohne Spieler-Beleg (Slot-/Zonen-/Wiederholungs-Schleife?) — belassen' };
  }
  if (!beleg && nameOk) {
    // Variablenname allein reicht nur, wenn der Rumpf die Variable überhaupt als Index/Argument nutzt.
    const body = code.slice(n.body.start, n.body.end);
    const vv = reEsc(s.v);
    if (!new RegExp(`\\[\\s*${vv}\\s*\\]|\\(\\s*(?:[\\w.]+,\\s*)?${vv}\\s*[,)]`).test(body)) {
      return { s, spieler: false, grund: 'Schleifenvariable wird im Rumpf nicht als Spielerindex benutzt — belassen' };
    }
  }
  return { s, spieler: true };
}

/** Gemeinsamer Ausdruck-Präfix `<P>.players`, den der Rumpf mit dieser Variable indiziert (rein lesend). */
function playersPraefix(code, rumpf, v) {
  v = reEsc(v);
  const s = code.slice(rumpf.start, rumpf.end);
  const m = new RegExp(`((?:this|[A-Za-z_$][\\w$]*)(?:\\.[A-Za-z_$][\\w$]*)*)\\.players\\[\\s*${v}\\s*\\]`).exec(s);
  return m ? m[1] : null;
}

// ── Eine Datei, ein Durchgang ──────────────────────────────────────
function einDurchgang(rel, code) {
  const ctx = { istEngineDatei: rel === 'cards/effects/_engine.js', istServer: rel === 'server.js' };
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'script', allowReturnOutsideFunction: true });
  } catch (err) {
    return { fehler: err.message, edits: [], pruefen: [], notizen: [], importe: new Set() };
  }
  const edits = [];          // { start, end, text, art, zeile }
  const pruefen = [];        // { zeile, was, warum }   → Entscheidung nötig
  const notizen = [];        // { zeile, notiz }        → bewusst belassen (Richtlinie)
  const importe = new Set(); // 'opponentOfGs' | 'playerCountGs'
  let programmScope = null;

  const serverName = (p) => {
    const ns = enclosingNames(p);
    return ns.length ? ns[ns.length - 1] : '(Modul)';
  };
  const inServerErlaubt = (p, erlaubt) => {
    // Handler-Namen von innen nach außen: der erste, der in der Tabelle bekannt ist, entscheidet.
    const ns = enclosingNames(p);
    for (let i = ns.length - 1; i >= 0; i--) {
      if (erlaubt.has(ns[i])) return { ok: true, name: ns[i] };
      if (SERVER_NOTIZ[ns[i]]) return { ok: false, name: ns[i], notiz: SERVER_NOTIZ[ns[i]] };
    }
    return { ok: false, name: ns.length ? ns[ns.length - 1] : '(Modul)', notiz: 'server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)' };
  };

  const ersetzeOpp = (p, xNode, art) => {
    const n = p.node;
    const xText = text(code, xNode);
    if (xNode.type === 'SequenceExpression' || (xNode.extra && xNode.extra.parenthesized)) {
      pruefen.push({ zeile: zeile(n), was: text(code, n), warum: 'Operand in Klammern/Sequenz — von Hand umstellen' });
      return;
    }
    const hand = (xNode.start > n.start ? code.slice(n.start, xNode.start) : '') + (xNode.end < n.end ? code.slice(xNode.end, n.end) : '');
    if (kommentarIn(hand)) {
      pruefen.push({ zeile: zeile(n), was: text(code, n).slice(0, 80), warum: 'Kommentar im Ausdruck — von Hand umstellen' });
      return;
    }
    // Sieger/Verlierer-Ableitung bleibt (Spielende, Mehrspieler-Wertung offen).
    if (/winner|loser|gewinner|verlierer/i.test(xText)) {
      notizen.push({ zeile: zeile(n), notiz: `\`${text(code, n)}\` — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer` });
      return;
    }
    const par = p.parentPath;
    if (par && par.isVariableDeclarator() && par.node.id.type === 'Identifier' && /^(winner|loser|gewinner|verlierer)/i.test(par.node.id.name)) {
      notizen.push({ zeile: zeile(n), notiz: `\`${par.node.id.name} = ${text(code, n)}\` — Sieger/Verlierer-Ableitung (Spielende)` });
      return;
    }
    if (ctx.istServer) {
      const d = inServerErlaubt(p, SERVER_OPP_ERLAUBT);
      if (!d.ok) { notizen.push({ zeile: zeile(n), notiz: `\`${text(code, n)}\` — ${d.name}: ${d.notiz}` }); return; }
    }
    const form = waehleForm(p, ctx);
    if (!form) {
      pruefen.push({ zeile: zeile(n), was: text(code, n).slice(0, 80), warum: 'weder this/engine/ctx._engine noch gs im Gültigkeitsbereich' });
      return;
    }
    let neu;
    if (form.engine) neu = `${form.engine}.opponentOf(${xText})`;
    else { neu = `opponentOfGs(${form.gs}, ${xText})`; importe.add('opponentOfGs'); }
    edits.push({ start: n.start, end: n.end, text: neu, art: `opp:${form.art}`, zeile: zeile(n), alt: text(code, n) });
  };

  traverse(ast, {
    Program(p) { programmScope = p.scope; },

    ConditionalExpression(p) {
      const m = oppBedingung(p.node);
      if (!m) return;
      ersetzeOpp(p, m.x);
    },

    BinaryExpression(p) {
      const n = p.node;
      if (n.operator !== '-' || !num(n.left, 1) || n.right.type === 'NumericLiteral') return;
      const x = text(code, n.right);
      const gegner = MINUS_GEGNER.test(x);
      if (!MINUS_ICH.test(x) && !gegner) return;
      if (gegner) {
        pruefen.push({ zeile: zeile(n), was: text(code, n), warum: `\`1 - ${x}\` leitet „ich“ aus dem Gegner ab — Gegner-von-Gegner ist im Mehrspielermodus nicht „ich“` });
        return;
      }
      if (n.right.extra && n.right.extra.parenthesized) return;
      if (ctx.istServer) {
        const d = inServerErlaubt(p, SERVER_OPP_ERLAUBT);
        if (!d.ok) { notizen.push({ zeile: zeile(n), notiz: `\`${text(code, n)}\` — ${d.name}: ${d.notiz}` }); return; }
      }
      const form = waehleForm(p, ctx);
      if (!form) { pruefen.push({ zeile: zeile(n), was: text(code, n), warum: 'weder this/engine/ctx._engine noch gs im Gültigkeitsbereich' }); return; }
      let neu;
      if (form.engine) neu = `${form.engine}.opponentOf(${x})`;
      else { neu = `opponentOfGs(${form.gs}, ${x})`; importe.add('opponentOfGs'); }
      edits.push({ start: n.start, end: n.end, text: neu, art: `minus:${form.art}`, zeile: zeile(n), alt: text(code, n) });
    },

    ForStatement(p) {
      const n = p.node;
      const b = bewerteSchleife(code, n);
      if (!b) return;
      if (!b.spieler) {
        pruefen.push({ zeile: zeile(n), was: code.slice(n.start, n.body.start).replace(/\s+/g, ' ').trim(), warum: b.grund, art: 'belassen' });
        return;
      }
      const s = b.s;
      let neu;
      if (ctx.istServer) {
        const d = inServerErlaubt(p, SERVER_SCHLEIFE_ERLAUBT);
        if (!d.ok) { notizen.push({ zeile: zeile(n), notiz: `\`${code.slice(n.start, n.body.start).replace(/\s+/g, ' ').trim()}\` — ${d.name}: ${d.notiz}` }); return; }
        // sendGameState(room, i)-Schleifen → roomPlayerCount(room); sonst über gs/room
        const m = /\bsendGameState\w*\(\s*([A-Za-z_$][\w$]*)\s*,/.exec(code.slice(n.body.start, n.body.end));
        if (m) { neu = `roomPlayerCount(${m[1]})`; importe.add('playerCountGs'); }
      }
      if (!neu) {
        const form = waehleForm(p, ctx);
        if (form && form.engine) neu = `${form.engine}.playerCount()`;
        else if (form && (form.art === 'gs' || form.art === 'room')) {
          const praefix = playersPraefix(code, n.body, s.v);
          if (praefix) neu = `${praefix}.players.length`;
          else if (form.art === 'gs') { neu = 'gs.players.length'; }
        }
      }
      if (!neu) {
        pruefen.push({ zeile: zeile(n), was: code.slice(n.start, n.body.start).replace(/\s+/g, ' ').trim(), warum: 'Spieler-Schleife, aber weder engine/this/ctx noch gs im Gültigkeitsbereich' });
        return;
      }
      edits.push({ start: s.bound.start, end: s.bound.end, text: neu, art: 'schleife:' + (/^roomPlayerCount/.test(neu) ? 'room' : /\.playerCount\(\)$/.test(neu) ? (neu.split('.')[0] === 'this' ? 'this' : 'engine') : 'gs'), zeile: zeile(n), alt: '2' });
    },

    ArrayExpression(p) {
      const n = p.node;
      if (n.elements.length !== 2 || !num(n.elements[0], 0) || !num(n.elements[1], 1)) return;
      if (ctx.istServer) {
        const d = inServerErlaubt(p, SERVER_SCHLEIFE_ERLAUBT);
        if (!d.ok) { notizen.push({ zeile: zeile(n), notiz: `\`[0, 1]\` — ${d.name}: ${d.notiz}` }); return; }
      }
      const form = waehleForm(p, ctx);
      // Bei „engine darf fehlen" (`engine?.gs`) wäre die Liste im Fehlerfall undefined statt [0, 1] → von Hand.
      if (!form || form.art === 'engine?') { pruefen.push({ zeile: zeile(n), was: '[0, 1]', warum: 'Spielerliste ohne sicher benutzbares engine/ctx/gs im Gültigkeitsbereich' }); return; }
      edits.push({ start: n.start, end: n.end, text: `${form.gs}.players.map((_, i) => i)`, art: `liste:${form.art}`, zeile: zeile(n), alt: '[0, 1]' });
    },
  });

  return { edits, pruefen, notizen, importe, programmScope, ast };
}

// ── Import-Zeile ───────────────────────────────────────────────────
function importPfad(rel) {
  if (rel === 'server.js') return './cards/effects/_opp';
  return './_opp';
}

/** Fügt `const { … } = require('./_opp');` hinzu bzw. ergänzt eine vorhandene Zeile. Liefert Edits. */
function importEdits(rel, code, ast, importe) {
  if (!importe.size) return [];
  const edits = [];
  const pfad = importPfad(rel);
  let vorhanden = null;
  for (const st of ast.program.body) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      if (d.init && d.init.type === 'CallExpression' && d.init.callee.name === 'require'
        && d.init.arguments[0] && d.init.arguments[0].value === pfad && d.id.type === 'ObjectPattern') vorhanden = { st, d };
    }
  }
  const gebunden = (name) => ast.program.body.some(st => st.type === 'VariableDeclaration'
    && st.declarations.some(d => d.id.type === 'ObjectPattern' && d.id.properties.some(pr => pr.key && pr.key.name === name)));
  const fehlend = [...importe].filter(nm => !gebunden(nm));
  if (!fehlend.length) return [];
  if (rel === 'server.js' && importe.has('playerCountGs') && !code.includes('function roomPlayerCount(')) {
    const sg = ast.program.body.find(st => st.type === 'FunctionDeclaration' && st.id.name === 'sendGameState');
    if (sg) {
      const pos = sg.leadingComments && sg.leadingComments.length ? sg.leadingComments[0].start : sg.start;
      edits.push({
        start: pos, end: pos, art: 'import', zeile: zeile(sg),
        text: '// N-Spieler: Spielerzahl der laufenden Partie für Broadcast-Schleifen (Normalspiel: 2,\n'
          + '// auch wenn der Raum gerade keinen gameState hat).\n'
          + 'function roomPlayerCount(room) { return playerCountGs(room && room.gameState); }\n\n',
      });
    }
  }
  if (vorhanden) {
    const ob = vorhanden.d.id;
    const alt = ob.properties.map(pr => code.slice(pr.start, pr.end));
    edits.push({ start: ob.start, end: ob.end, text: `{ ${[...alt, ...fehlend].join(', ')} }`, art: 'import', zeile: zeile(ob) });
    return edits;
  }
  const zeileText = `const { ${fehlend.join(', ')} } = require('${pfad}');`;
  // Nach der letzten require-Deklaration des KOPFBLOCKS einfügen (zusammenhängende Folge oberster
  // Variablen-Deklarationen) — so läuft die Zeile beim Laden vor allem anderen Code (keine TDZ).
  // Fehlt ein Kopfblock: nach 'use strict'; sonst vor dem ersten Statement.
  const body = ast.program.body;
  const nurRequire = (st) => st.type === 'VariableDeclaration' && st.declarations.length > 0 && st.declarations.every(d => {
    let i = d.init;
    while (i && (i.type === 'MemberExpression')) i = i.object;
    return i && i.type === 'CallExpression' && i.callee.type === 'Identifier' && i.callee.name === 'require';
  });
  // Der Kopfblock beginnt bei der ersten require-Deklaration (server.js hat davor noch den .env-Lader).
  let anker = null;
  const ersterRequire = body.findIndex(nurRequire);
  if (ersterRequire >= 0) {
    for (let k = ersterRequire; k < body.length && body[k].type === 'VariableDeclaration'; k++) if (nurRequire(body[k])) anker = body[k];
  }
  if (anker) {
    edits.push({ start: anker.end, end: anker.end, text: `\n${zeileText}`, art: 'import', zeile: zeile(anker) });
  } else if (ast.program.directives && ast.program.directives.length) {
    const dir = ast.program.directives[ast.program.directives.length - 1];
    edits.push({ start: dir.end, end: dir.end, text: `\n\n${zeileText}`, art: 'import', zeile: zeile(dir) });
  } else {
    // Vor das erste Statement — aber über dessen Kommentar, wenn der unmittelbar daran klebt
    // (keine Leerzeile dazwischen), damit Kommentar und Statement zusammenbleiben.
    const first = body[0];
    let pos = first ? first.start : 0;
    const cs = (first && first.leadingComments) || [];
    for (let i = cs.length - 1; i >= 0; i--) {
      const naechster = i === cs.length - 1 ? first.start : cs[i + 1].start;
      if (/\n[ \t]*\n/.test(code.slice(cs[i].end, naechster))) break;
      pos = cs[i].start;
    }
    edits.push({ start: pos, end: pos, text: `${zeileText}\n`, art: 'import', zeile: first ? zeile(first) : 1 });
  }
  return edits;
}

/** Überlappende Edits: der äußere gewinnt, der innere kommt im nächsten Durchgang dran. */
function anwenden(code, edits) {
  const sortiert = [...edits].sort((a, b) => a.start - b.start || b.end - a.end);
  const ok = [];
  let letzteEnde = -1;
  for (const e of sortiert) {
    if (e.start < letzteEnde) continue;
    ok.push(e);
    letzteEnde = Math.max(letzteEnde, e.end);
  }
  let out = code;
  for (const e of [...ok].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { code: out, angewandt: ok };
}

function bearbeiteDatei(rel, original) {
  let code = original;
  const alle = [];
  let letzte = { pruefen: [], notizen: [] };
  let erste = null;
  let fehler = null;
  for (let durchgang = 0; durchgang < 6; durchgang++) {
    const r = einDurchgang(rel, code);
    if (r.fehler) { fehler = r.fehler; break; }
    if (!erste) erste = r;
    letzte = r;
    if (!r.edits.length) break;
    const edits = [...r.edits, ...importEdits(rel, code, r.ast, r.importe)];
    const res = anwenden(code, edits);
    code = res.code;
    alle.push(...res.angewandt);
    if (!res.angewandt.some(e => e.art !== 'import')) break;
  }
  // Zeilennummern: `erste` bezieht sich auf die Datei VOR dem Umbau (Trockenlauf), `letzte` auf die danach.
  return { code, edits: alle, pruefen: letzte.pruefen, notizen: letzte.notizen, pruefenVorher: erste ? erste.pruefen : [], notizenVorher: erste ? erste.notizen : [], fehler };
}

// ── Dateiliste ─────────────────────────────────────────────────────
function standardDateien() {
  const dateien = fs.readdirSync(EFFECTS).filter(f => f.endsWith('.js')).sort().map(f => 'cards/effects/' + f);
  dateien.push('server.js');
  return dateien;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const verbose = args.includes('--verbose');
  const explizit = args.filter(a => !a.startsWith('--')).map(a => path.relative(WURZEL, path.resolve(a)).split(path.sep).join('/'));
  const dateien = explizit.length ? explizit : standardDateien();

  const zaehler = {};
  const berührt = new Set();
  const pruefListe = [];
  const notizListe = [];
  let uebersprungen = 0;
  let fehlerAnzahl = 0;

  for (const rel of dateien) {
    if (istInsel(rel)) { uebersprungen++; continue; }
    const abs = path.join(WURZEL, rel);
    const original = fs.readFileSync(abs, 'utf8');
    const r = bearbeiteDatei(rel, original);
    if (r.fehler) { console.error(`[codemod] ${rel}: nicht lesbar — ${r.fehler}`); fehlerAnzahl++; continue; }
    for (const e of r.edits) {
      zaehler[e.art] = (zaehler[e.art] || 0) + 1;
      if (verbose && e.art !== 'import') console.log(`${rel}:${e.zeile}  ${e.alt}  →  ${e.text}`);
    }
    if (r.edits.length) berührt.add(rel);
    for (const x of (dry ? r.pruefenVorher : r.pruefen)) pruefListe.push({ rel, ...x });
    for (const x of (dry ? r.notizenVorher : r.notizen)) notizListe.push({ rel, ...x });
    if (!dry && r.code !== original) fs.writeFileSync(abs, r.code, 'utf8');
  }

  const summe = (praefix) => Object.entries(zaehler).filter(([k]) => k.startsWith(praefix)).reduce((s, [, v]) => s + v, 0);
  console.log(`[codemod] ${dry ? 'TROCKENLAUF — ' : ''}${dateien.length} Dateien betrachtet, ${uebersprungen} Zwei-Spieler-Inseln übersprungen, ${berührt.size} Dateien ${dry ? 'würden geändert' : 'geändert'}.`);
  for (const k of Object.keys(zaehler).sort()) console.log(`    ${k.padEnd(14)} ${String(zaehler[k]).padStart(5)}`);
  console.log(`    ${'Gegner-Idiom'.padEnd(14)} ${String(summe('opp:') + summe('minus:')).padStart(5)}   Schleifen ${summe('schleife:')}   Listen ${summe('liste:')}`);
  if (pruefListe.length) {
    console.log(`\n[codemod] PRÜFLISTE — ${pruefListe.length} Stelle(n), die nicht automatisch umgestellt wurden:`);
    for (const x of pruefListe) console.log(`    ${x.rel}:${x.zeile}  ${x.was}   — ${x.warum}`);
  }
  if (notizListe.length) {
    console.log(`\n[codemod] BEWUSST BELASSEN (Richtlinie) — ${notizListe.length} Stelle(n):`);
    if (verbose) for (const x of notizListe) console.log(`    ${x.rel}:${x.zeile}  ${x.notiz}`);
  }
  return fehlerAnzahl ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  bearbeiteDatei, istInsel, oppBedingung, istSchleife2, spielerBeleg, standardDateien, INSELN,
  // für scripts/check-n-player.js (Lint):
  enclosingNames, bewerteSchleife, SERVER_OPP_ERLAUBT, SERVER_SCHLEIFE_ERLAUBT, SPIELER_VAR, MINUS_ICH, MINUS_GEGNER,
};
