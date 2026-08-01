#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — DECK PROFILE TRAINER
//  Reads self-play game logs (JSONL produced by the PP_TRAIN mode in
//  server.js via cards/effects/_train-recorder.js) and fits an
//  L2-regularised logistic regression: game outcome (win/loss) against
//  what the pinned deck DID during the game.
//
//  Feature space (per game):
//    bias
//    first                        — went first (covariate, absorbed,
//                                   not exported)
//    turns_n                      — normalised game length (covariate)
//    play:<card>:<bucket>         — capped play counts per turn bucket
//    pair:<A|B>                   — capped same-turn co-play counts
//    ab:<Ability@Hero>            — final stack level
//
//  Why values-not-policies: the learned weights say "games where the
//  deck did X more often were won more often, holding the rest fixed".
//  We export them as VALUE adjustments (hand values, pair bonuses,
//  placement priors) that feed the existing MCTS/eval machinery — the
//  live search still reads the actual board, so nothing here encodes
//  "against deck Y do Z". Opponent identity is deliberately NOT a
//  feature.
//
//  Usage:
//    node scripts/train-deck-profile.js data/training/<file>.jsonl [more.jsonl ...]
//  Output:
//    data/cpu-profiles/<deck-slug>.json
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { clusterOfFingerprint } = require('../cards/effects/_deck-profile');
// Karten-Skripte für Designer-Verträge (cpuMeta.cardValueFloor). Defensiv:
// scheitert das Laden, bleibt der gelernte Wert unverändert.
function loadCardEffectSafe(name) {
  try { return require('../cards/effects/_loader').loadCardEffect(name); }
  catch { return null; }
}

// ── Tunables ─────────────────────────────────────────────────────────
const L2_LAMBDA = 0.02;        // ridge strength — small feature space, mild shrinkage
const LEARN_RATE = 0.08;
const EPOCHS = 4000;
const MIN_SUPPORT_FRAC = 0.03; // feature must appear in ≥3% of games…
const MIN_SUPPORT_ABS = 6;     // …and at least 6 games, else it's noise
const PLAY_CAP = 3;            // cap per-bucket play counts
// Advantage-Labels (Per-Play-Modell): Mischung aus kurzfristigem
// Eval-Delta und Endergebnis. Reines Win/Loss vergiftet die Werte bei
// niedrigen Winrates (alles im Verlustspiel wird schlecht); reines
// Delta wäre greedy — evaluateState preist zwar Recoil/Handverlust ein,
// aber der Outcome-Anteil hält die Langfrist-Perspektive im Label.
const ADV_BLEND = 0.6;         // 60% Advantage, 40% Outcome
const ADV_HORIZON = 2;         // Delta bis Zug t+2 (inkl. Gegner-Antwort)
const HOLDOUT_FRAC = 0.2;      // 20% der SPIELE als Validierung
const WINRATE_WARN = 0.40;     // Warnschwelle (kein Abbruch)
const PAIR_CAP = 2;            // cap pair counts

// Export scaling — maps regression weights (log-odds units) onto the
// CPU brain's native point scales.
const CARD_VALUE_CENTER = 25;  // matches estimateHandCardValueFor's "playable" base
const CARD_VALUE_SPREAD = 35;  // ±1 z-score of learned weight → ±35 points
const CARD_VALUE_MIN = 8, CARD_VALUE_MAX = 100;
const TIMING_SPREAD = 0.35, TIMING_MIN = 0.75, TIMING_MAX = 1.3;
const PAIR_SCALE = 45, PAIR_MAX = 40;    // positive-only export
// Zentrierte Uplifts (v2) sind ~2-3× kleiner als die alten halo-
// inflationierten Werte — eigene Export-Skala, damit statistisch
// validierte Paare nicht unter die 4-Punkte-Schwelle fallen, während
// der PAIR_MAX-Clamp die Ausnahme bleibt (typische Δ nach Dämpfung
// 0.01-0.07 → 4-28 Punkte).
const PAIR_UPLIFT_SCALE = 400;
const ABILITY_SCALE = 120, ABILITY_MIN = -60, ABILITY_MAX = 150;
// Revive context — Handwert-Dimension, daher kleinere Skala als die
// Platzierungs-Prioren (fließt additiv in estimateHandCardValueFor).
const REVIVE_SCALE = 30, REVIVE_MIN = -15, REVIVE_MAX = 30;
// Lock-Ordering: fließt als GATE-SCHWELLEN-Delta ein (Gate-Thresholds
// sind klein, 3-30) — deutlich kleinere Skala als die Eval-Prioren.
const LOCK_SCALE = 20, LOCK_MIN = -25, LOCK_MAX = 10;

function loadGames(files) {
  const games = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, { encoding: 'utf-8' });
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const g = JSON.parse(t);
        if (g.abMode) continue; // A/B-Messläufe sind NIE Trainingsdaten
        if (g.outcome === 0 || g.outcome === 1) games.push(g); // skip ties
      } catch { /* corrupt line → skip */ }
    }
  }
  return games;
}

function featurize(g, meanTurns, lenCuts) {
  const x = Object.create(null);
  x['bias'] = 1;
  x['first'] = g.wentFirst ? 1 : 0;
  x['turns_n'] = ((g.turns || meanTurns) - meanTurns) / Math.max(1, meanTurns);
  // Nichtlineare Spiellängen-Kovariaten (Als Nao-Befund): turns_n ist
  // nur LINEAR — die Länge→Loss-Beziehung hat aber bei Deckout-Decks
  // eine Klippe (Heal Burn: SM3@Nao-Spiele Ø23 Züge, 48.8% Deckout-Loss
  // vs 20.8% bei Ø20). Der nichtlineare Rest lud auf alles, was mit
  // langen Spielen korreliert — End-State-Ability-Features akkumulieren
  // mit der Spiellänge (die dritte Kopie landet Median Zug 14) und
  // fingen sich so ein "Spiel wurde lang"-Minus ein, das nichts mit der
  // Platzierung zu tun hat (Support Magic@Nao −60 trotz empirisch
  // starker SM2/FR3-Zelle). Quartils-Dummies geben dem Modell die
  // Kapazität, die Längen-Klippe DORT abzuladen; ab:/eqp:/lk:-Gewichte
  // lernen nur noch den Zusatz über die Länge hinaus. Gleiche
  // Confound-Klasse und Lösung wie die dead:-Haupteffekte im
  // Revive-Kanal. len:-Keys werden in keine Report-Sektion exportiert.
  if (Array.isArray(lenCuts) && lenCuts.length === 3) {
    const t = g.turns || meanTurns;
    const b = t <= lenCuts[0] ? 'q1' : t <= lenCuts[1] ? 'q2' : t <= lenCuts[2] ? 'q3' : 'q4';
    x[`len:${b}`] = 1;
  }
  for (const [name, buckets] of Object.entries(g.plays || {})) {
    for (const b of ['early', 'mid', 'late']) {
      const c = Math.min(PLAY_CAP, buckets[b] || 0);
      if (c > 0) x[`play:${name}:${b}`] = c;
    }
  }
  for (const [key, c] of Object.entries(g.pairs || {})) {
    x[`pair:${key}`] = Math.min(PAIR_CAP, c);
  }
  for (const [key, lvl] of Object.entries(g.abilities || {})) {
    // Level-Stufen-Dummies statt x=Level (Als Nao-Befund, Teil 2): Ein
    // einzelner Level-Slope zwingt "Lv2 stark, dritte Kopie spät =
    // Durdle" in EIN Vorzeichen — real gemessen (SM@Nao bei FR3,
    // längenstratifiziert): SM2 schlägt SM3 in jedem Band ≥19 Züge um
    // 15-25pp, das Modell clampte trotzdem auf −60 und Nao wirkte wie
    // ein schlechtes SM-Ziel. Mit ab:X (Lv≥1), ab:X≥2, ab:X≥3 lernt
    // jede Stufe ihr eigenes Gewicht; die Laufzeit schlägt beim
    // Platzieren den MARGINALEN Prior der Ziel-Stufe nach ("lohnt die
    // k-te Kopie?") — genau die Entscheidung, die ansteht.
    const L = Math.min(3, lvl);
    if (L >= 1) x[`ab:${key}`] = 1;
    if (L >= 2) x[`ab:${key}≥2`] = 1;
    if (L >= 3) x[`ab:${key}≥3`] = 1;
  }
  for (const [key, n] of Object.entries(g.equips || {})) {
    x[`eqp:${key}`] = Math.min(3, n);
  }
  for (const [key, n] of Object.entries(g.locks || {})) {
    x[`lk:${key}`] = Math.min(2, n);
  }
  for (const [key, v] of Object.entries(g.revives || {})) {
    // Identity keys carry a count, ability keys a stack level — both
    // capped at 3 so a single weird game can't dominate the weight.
    x[`rev:${key}`] = Math.min(3, v);
  }
  // Kontext-HAUPTEFFEKT "Held X wurde besiegt" (ereignisbasiert, auch
  // wenn später revived): Ohne diesen Regressor lud der stark negative
  // Held-stirbt-Effekt komplett auf die rev:-Interaktionsterme — die
  // Revive-Regeln lernten "Wiederbeleben = Niederlage" statt
  // "Helden-Tod = Niederlage" (Confounding; sichtbar als uniformes
  // −15-Clamping im Revive-Report). Mit dead:-Features lernt rev: nur
  // noch den ZUSATZ über den Kontext: "GEGEBEN der Held starb — half
  // das Revive?" dead:-Keys werden in keine Report-Sektion exportiert.
  for (const [hero, n] of Object.entries(g.deadHeroes || {})) {
    x[`dead:${hero}`] = Math.min(2, n);
  }
  return x;
}

// Seeded Shuffle → deterministischer 80/20-Split auf SPIEL-Ebene
// (Play-Ebene würde leaken: Events desselben Spiels in Train UND Test).
function splitGames(games) {
  let seed = 1337;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const idx = games.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nHold = Math.max(1, Math.floor(games.length * HOLDOUT_FRAC));
  const holdSet = new Set(idx.slice(0, nHold));
  return {
    train: games.filter((_, i) => !holdSet.has(i)),
    hold: games.filter((_, i) => holdSet.has(i)),
  };
}

// Logistische Regression mit weichen Labels y∈[0,1] (Gradient identisch:
// p − y). Wiederverwendbar für Spiel- und Play-Modell.
function fitSoftLogistic(rows, labels, keep, opts = {}) {
  const epochs = opts.epochs ?? EPOCHS;
  const lr = opts.lr ?? LEARN_RATE;
  const l2 = opts.l2 ?? L2_LAMBDA;
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  const w = Object.create(null);
  for (const k of keep) w[k] = 0;
  const n = rows.length;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = Object.create(null);
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) z += w[k] * v;
      const err = sigmoid(z) - labels[i];
      for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) grad[k] = (grad[k] || 0) + err * v;
    }
    for (const k of keep) {
      const pen = (k === 'bias') ? 0 : l2 * w[k];
      w[k] -= lr * ((grad[k] || 0) / n + pen);
    }
  }
  return w;
}

function evalLogLoss(rows, labels, w, keep) {
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  let loss = 0, correct = 0;
  for (let i = 0; i < rows.length; i++) {
    let z = 0;
    for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) z += w[k] * v;
    const p = sigmoid(z);
    loss += -(labels[i] * Math.log(p + 1e-12) + (1 - labels[i]) * Math.log(1 - p + 1e-12));
    if ((p >= 0.5 ? 1 : 0) === Math.round(labels[i])) correct++;
  }
  return { logLoss: loss / rows.length, acc: correct / rows.length };
}

// Advantage eines Plays bei Zug t aus der Eval-Kurve des Spiels:
// after(t+HORIZON) − before(t−1), mit Rand-Fallbacks auf die nächsten
// vorhandenen Kurvenpunkte.
function playAdvantage(curve, t) {
  const turns = Object.keys(curve).map(Number).sort((a, b) => a - b);
  if (turns.length < 2) return null;
  let before = null, after = null;
  for (const ct of turns) { if (ct <= t - 1) before = curve[ct]; }
  for (let i = turns.length - 1; i >= 0; i--) { if (turns[i] >= t + ADV_HORIZON) after = curve[turns[i]]; }
  if (before === null) before = curve[turns[0]];
  if (after === null) after = curve[turns[turns.length - 1]];
  return after - before;
}

// ── Per-Play-Advantage-Modell ──
// Ein Beispiel pro PLAY statt pro Spiel. Label = Mischung aus dem
// normalisierten Eval-Delta um den Play herum (Kurzfrist-Wirkung inkl.
// Gegner-Antwort und eingepreister Kosten wie Recoil/Handverlust) und
// dem Endergebnis. Löst das Credit-Assignment-Problem der reinen
// Outcome-Labels: Ein guter Zug in einem verlorenen Spiel wird nicht
// mehr pauschal negativ verbucht.
function buildAdvantageModel(trainGames, holdGames, support0) {
  const hasData = g => Array.isArray(g.playEvents) && g.playEvents.length > 0
    && g.evalCurve && Object.keys(g.evalCurve).length >= 2;
  const coverage = trainGames.filter(hasData).length / Math.max(1, trainGames.length);
  if (coverage < 0.6) {
    console.log(`Advantage-Modell: nur ${(100 * coverage).toFixed(0)}% der Spiele haben playEvents/evalCurve — Fallback auf Spiel-Level-cardValues.`);
    return null;
  }

  // ── Terminal-Stempel-Klemme für Advantage-Fenster ──
  // Die evalCurve enthält Game-Over-Stempel (±100000; real >5% aller
  // Samples — p5 des Datensatzes IST −100000). Plays kurz vor
  // Spielende erben sie über das t+2-Fenster als "Advantage" — bei
  // typischen |adv| um ~800 dominiert ein Stempel den Arm-Mittelwert
  // jedes Kontrast-Kanals (gemessen, Suicide Bombers: 23% der
  // ahead-Plays von Phoenix Cannon/Tackle trugen einen Stempel vs
  // 4-5% der behind-Plays → der ahead-Arm bestand fast nur aus
  // Victory-Lap-Credit und drückte den behind-Kontrast künstlich
  // negativ). Der Spielausgang gehört in den Outcome-Anteil des
  // Labels (40%), NICHT nochmal in den Advantage-Anteil. Fix: Für die
  // Advantage-Berechnung werden Kurvenwerte auf ±p99 der NICHT-
  // terminalen |v| geklemmt (Train-Statistik) — echte große Swings
  // (Board-Clears) bleiben erhalten, die Sentinels verschwinden.
  // Eine Quantil-Winsorisierung der Advantages selbst wäre zu lax:
  // die Stempel-Tails sind dicker als jede vernünftige Quantilgrenze.
  // Das Standing-Bucketing nutzt weiterhin die ROHE Kurve — ein
  // −100000 IST korrekt 'behind'.
  let _advCapV = Infinity;
  {
    const nonTerminalAbs = [];
    for (const g of trainGames) {
      if (!hasData(g)) continue;
      for (const v of Object.values(g.evalCurve)) {
        if (typeof v === 'number' && Math.abs(v) < 50000) nonTerminalAbs.push(Math.abs(v));
      }
    }
    nonTerminalAbs.sort((a, b) => a - b);
    if (nonTerminalAbs.length >= 50) {
      _advCapV = nonTerminalAbs[Math.floor(0.99 * (nonTerminalAbs.length - 1))];
      console.log(`Terminal-Klemme: Kurvenwerte für Advantages auf ±${Math.round(_advCapV)} gekappt (p99 nicht-terminal)`);
    }
  }
  const clampCurveForAdv = (curve) => {
    if (!isFinite(_advCapV)) return curve;
    const out = Object.create(null);
    for (const [t, v] of Object.entries(curve)) {
      out[t] = typeof v === 'number' ? Math.max(-_advCapV, Math.min(_advCapV, v)) : v;
    }
    return out;
  };

  const collect = (games) => {
    const evs = [];
    games.forEach((g, gi) => {
      if (!hasData(g)) return;
      const perTurn = Object.create(null);
      for (const e of g.playEvents) perTurn[e.t] = (perTurn[e.t] || 0) + 1;
      const curveAdv = clampCurveForAdv(g.evalCurve);
      // ── Trigger-Ertrag je Zug (Als Hauptmetrik als Hilfs-Label) ──────
      // Summe der GEWICHTETEN On-Summon-Trigger je eigenem Zug, aus dem
      // neuen Recorder-Feld. Fehlt das Feld (Altdatensätze), bleibt der
      // Kanal komplett stumm und das Label ist bit-identisch zu vorher.
      const trigTurn = Object.create(null);
      for (const s of (g.onSummonTriggers || [])) {
        trigTurn[s.t] = (trigTurn[s.t] || 0) + (s.w || 1);
      }
      const ownTurns = [...new Set((g.onSummonTriggers || []).map(s => s.t)
        .concat(g.playEvents.map(e => e.t)))].sort((a, b) => a - b);
      const nextOwn = Object.create(null);
      for (let i = 0; i < ownTurns.length; i++) nextOwn[ownTurns[i]] = ownTurns[i + 1] ?? null;
      // Wer hat wessen Play finanziert? name → turn → Summe der Gewichte
      const enabledBy = Object.create(null);
      for (const s2 of (g.onSummonTriggers || [])) {
        if (!s2.via) continue;
        (enabledBy[s2.via] = enabledBy[s2.via] || Object.create(null));
        enabledBy[s2.via][s2.t] = (enabledBy[s2.via][s2.t] || 0) + (s2.w || 1);
      }
      for (const e of g.playEvents) {
        const adv = playAdvantage(curveAdv, e.t);
        if (adv === null) continue;
        // Credit-Teilung unter Same-Turn-Plays (sanft via sqrt). `gi` =
        // Spiel-Index für die Per-Spiel-Zentrierung der Uplift-Labels.
        // `h` = castender Held (Caster-Delta-Kanal), falls aufgezeichnet.
        // `trig` = Trigger-Ertrag DIESES Zuges plus des NÄCHSTEN eigenen
        // Zuges. Der Folgezug ist entscheidend: Enabler zahlen sich erst
        // dort aus (Primordiums Grant, ein breiteres Board für die
        // Ketten der nächsten Runde), und genau dieser Ertrag liegt
        // jenseits des Rollout-Horizonts. Gemessen ist er zugleich die
        // Bruchstelle nach DDG (CPU 0.46 Folgetrigger gegen Als 3.71).
        const nx = nextOwn[e.t];
        // ── KREDIT-WEITERGABE an den Grant-Geber (31.7.) ─────────────
        // Zusätzlich zum eigenen Zug-Ertrag bekommt eine Karte den
        // Ertrag der Plays gutgeschrieben, die sie FINANZIERT hat
        // (Recorder-Feld `via`). Ohne das erscheint der Nutzen eines
        // Enablers ausschließlich beim Nutznießer — die Signatur im
        // Deepsea-Profil war Werewolf 95.5 gegen Primordium 8, obwohl
        // Primordium die Werewolf-Plays bezahlt.
        // Bewusst ADDITIV und ungeteilt: der Nutznießer behält seinen
        // Ertrag. Ziel ist nicht die exakte Aufteilung, sondern dass
        // der Enabler überhaupt in der Rechnung auftaucht.
        const enabled = enabledBy[e.n] ? (enabledBy[e.n][e.t] || 0) : 0;
        const trig = (trigTurn[e.t] || 0) + (nx != null ? (trigTurn[nx] || 0) : 0) + enabled;
        evs.push({ name: e.n, turn: e.t, gi, h: e.h, ctx: e.ctx || null, cluster: clusterOfFingerprint(g.oppFingerprint), adv: adv / Math.sqrt(perTurn[e.t]), outcome: g.outcome, trig: (g.onSummonTriggers || []).length ? trig / Math.sqrt(perTurn[e.t]) : null });
      }
    });
    return evs;
  };
  const trainEvs = collect(trainGames);
  const holdEvs = collect(holdGames);
  if (trainEvs.length < 100) {
    console.log(`Advantage-Modell: nur ${trainEvs.length} Events — zu wenig, Fallback.`);
    return null;
  }

  // z-Normierung der Advantages (Train-Statistik, auch für Holdout).
  const advs = trainEvs.map(e => e.adv);
  const aMean = advs.reduce((a, b) => a + b, 0) / advs.length;
  const aSd = Math.sqrt(advs.reduce((a, b) => a + (b - aMean) ** 2, 0) / advs.length) || 1;
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  const bucketOf = t => (t <= 4 ? 'early' : t <= 9 ? 'mid' : 'late');

  // ── Lernsignal-Toggle (Als Auftrag nach dem Drift-Befund) ──
  // Problem der Alt-Architektur: der Outcome-Anteil (1-ADV_BLEND) gibt
  // JEDEM Play eines verlorenen Spiels dasselbe Negativ-Label. Bei ~20%
  // WR sind 80% aller Spiele Niederlagen → alles korreliert mit
  // Verlieren, und Karten, die in langen Niederlagen oft gespielt
  // werden (die Enabler), bekommen das stärkste Negativsignal. Messbar:
  // Play-Volumen sinkt über Iterationen bei JEDER Karte, Enabler-Werte
  // fallen monoton auf den Floor, Iter1 ist in jedem Lauf die beste.
  //
  // 'winlift' (neu, Default): der Outcome-Anteil wird durch den
  // WIN/LOSS-LIFT je Karte×Phase ersetzt — Spielrate in Siegen minus
  // Spielrate in Niederlagen DERSELBEN Trainingsmenge (Als Idee, mit
  // Kontrast statt reiner Sieg-Quote: "in 80% der Siege UND 80% der
  // Niederlagen" ist neutral). Vergleich innerhalb der Menge, nicht
  // zwischen Iterationen (dort konfundieren Priors/Exploration/Gegner).
  // Neutral-Fallbacks gegen Kleinzellen-Rauschen: < MIN_WINS Siege
  // gesamt oder < MIN_CELL Beobachtungen je Zelle → 0.5 (= kein
  // Outcome-Einfluss, reiner Advantage-Anteil).
  //
  // 'outcome': exakt die bisherige Architektur — Rückfahrkarte, falls
  // das neue Signal andere Decks runterzieht (PP_TRAIN_SIGNAL=outcome).
  const SIGNAL_MODE = (process.env.PP_TRAIN_SIGNAL || 'winlift').toLowerCase() === 'outcome' ? 'outcome' : 'winlift';
  // ── Intensitäts-Kanal (Als Vergleichsanalyse Deepsea) ──────────────
  // Der Lift oben zählt ANWESENHEIT je Karte×Phase (`seen` ist ein Set).
  // Für Karten, die in praktisch JEDEM Spiel vorkommen, gibt es damit
  // keine Kontrastgruppe mehr: ihr Lift ist rechnerisch ~0 und sie
  // landen auf dem Wert-Floor — obwohl gerade sie den Motor des Decks
  // bilden. Im Deepsea-Batch (1292 Spiele) betraf das exakt die vier
  // Floor-Karten: Primordium (100% Einsatzquote, Lift −0.0, Wert 8),
  // Summoning Magic (99%, +0.0, 8), Cute Cheese (86%, 8), Sacred Jewel
  // (81%, 8). Ihre WIRKLICHE Aussagekraft steckt in der HÄUFIGKEIT:
  // Primordium 1× → 20.2% WR, 4+× → 53.6%; Summoning Magic 1× → 12.3%,
  // 4+× → 47.8%. Bei konstant gehaltener Spiellänge (12-16 Halbzüge)
  // bleibt der Zusammenhang bestehen, ist also kein Längen-Artefakt.
  //
  // Deshalb: Kontrast über die MITTLERE ANZAHL je Spiel statt über die
  // Anwesenheit. Für Karten, die pro Spiel höchstens einmal vorkommen,
  // ist das identisch zum Alt-Signal; für Motor-Karten wird die
  // Intensität sichtbar. Normiert über eine feste Skala (nicht über die
  // Summe), damit SELTENE Karten nicht zusätzlich verstärkt werden —
  // eine Ratio-Normierung hätte DDG (29% Einsatzquote) noch weiter
  // hochgezogen, obwohl die CPU ohnehin zu lange darauf wartet.
  // PP_TRAIN_INTENSITY=0 schaltet zurück auf reines Anwesenheits-Lift.
  const USE_INTENSITY = (process.env.PP_TRAIN_INTENSITY || '1') !== '0';
  // SCALE 1.0 macht den Kanal zur EXAKTEN Verallgemeinerung: fällt eine
  // Karte höchstens 1× je Spiel+Phase, IST ihr Mittelwert die
  // Anwesenheitsrate — das Signal ist dann Bit für Bit das alte. Erst
  // Mehrfach-Plays erzeugen überhaupt eine Abweichung. Im Deepsea-Batch
  // erreicht damit keine einzige Zelle den Klemm-Anschlag.
  const INTENSITY_SCALE = 1.0;
  let liftPart = null;
  if (SIGNAL_MODE === 'winlift') {
    const MIN_WINS = 15, MIN_CELL = 10;
    const wins = trainGames.filter(g => hasData(g) && g.outcome === 1);
    const losses = trainGames.filter(g => hasData(g) && g.outcome === 0);
    const presence = (gs) => {
      const m = Object.create(null);
      for (const g of gs) {
        const seen = new Set();
        for (const e of g.playEvents) seen.add(`${e.n}|${bucketOf(e.t)}`);
        for (const k of seen) m[k] = (m[k] || 0) + 1;
      }
      return m;
    };
    // Summe der Plays je Karte×Phase (statt nur "kam vor").
    const totals = (gs) => {
      const m = Object.create(null);
      for (const g of gs) {
        for (const e of g.playEvents) {
          const k = `${e.n}|${bucketOf(e.t)}`;
          m[k] = (m[k] || 0) + 1;
        }
      }
      return m;
    };
    if (wins.length >= MIN_WINS && losses.length > 0) {
      const inW = presence(wins), inL = presence(losses);
      const cW = USE_INTENSITY ? totals(wins) : null;
      const cL = USE_INTENSITY ? totals(losses) : null;
      const keys = new Set([...Object.keys(inW), ...Object.keys(inL)]);
      const table = Object.create(null);
      let intensified = 0;
      for (const k of keys) {
        const w = inW[k] || 0, l = inL[k] || 0;
        if (w + l < MIN_CELL) continue;
        let lift = (w / wins.length) - (l / losses.length);   // −1..1
        if (USE_INTENSITY) {
          // Mittlere Anzahl je Spiel; identisch zum Anwesenheits-Lift,
          // solange die Karte höchstens 1× pro Spiel und Phase fällt.
          const mw = (cW[k] || 0) / wins.length;
          const ml = (cL[k] || 0) / losses.length;
          const intense = Math.max(-1, Math.min(1, (mw - ml) / INTENSITY_SCALE));
          if (Math.abs(intense - lift) > 0.02) intensified++;
          lift = intense;
        }
        table[k] = 0.5 + lift / 2;                              // 0..1
      }
      liftPart = (name, turn) => table[`${name}|${bucketOf(turn)}`] ?? 0.5;
      console.log(`Lernsignal: winlift${USE_INTENSITY ? '+intensity' : ''} — ${Object.keys(table).length} Karte×Phase-Zellen mit Lift `
        + `(${wins.length} Siege / ${losses.length} Niederlagen)`
        + (USE_INTENSITY ? `, davon ${intensified} durch Häufigkeit korrigiert` : '') + `, Rest neutral`);
    } else {
      liftPart = () => 0.5;
      console.log(`Lernsignal: winlift — nur ${wins.length} Siege (< ${MIN_WINS}) → Outcome-Anteil komplett neutral, reiner Advantage`);
    }
  } else {
    console.log('Lernsignal: outcome (Alt-Architektur, PP_TRAIN_SIGNAL=outcome)');
  }
  // ── Trigger-Ertrag als dritter Label-Anteil (Als Hauptmetrik) ────────
  // Al: "Die Anzahl On-Summon-Trigger pro Runde sollte DIE Metrik sein."
  // Im Datensatz ist sie als Sieg-Prädiktor bestätigt (Trigger/Zug <1.5
  // → ~9% WR, 2.0-3.0 → 42.5%, 3.0+ → 83.3%), und sie schließt genau die
  // Lücke, an der Outcome-Lernen scheitert: ERMÖGLICHENDE Karten. Deren
  // Beitrag ist nicht der eigene Sieg, sondern dass sie die Kette
  // finanzieren — Primordium stand im Profil bei 8 von 100 (Boden-
  // Anschlag), weil eine Karte mit ~100% Einsatzquote keine
  // Kontrastgruppe hat. Ein Trigger-Label sieht ihren Beitrag direkt.
  //
  // Bewusst als ZUSATZ, nicht als Ersatz: der Anteil ist klein genug,
  // dass Siegen weiterhin das Ziel bleibt und die Metrik nicht zum
  // Selbstzweck wird (sonst lernte die CPU, Trigger zu maximieren statt
  // zu gewinnen). PP_TRAIN_TRIGGER_BLEND=0 schaltet ihn ganz ab; ohne
  // das Recorder-Feld ist er automatisch stumm (Altdatensätze bleiben
  // bit-identisch auswertbar).
  const TRIG_BLEND = Math.max(0, Math.min(0.5,
    parseFloat(process.env.PP_TRAIN_TRIGGER_BLEND ?? '0.25')));
  let trigPart = null;
  if (TRIG_BLEND > 0) {
    const tv = trainEvs.map(e => e.trig).filter(v => typeof v === 'number');
    if (tv.length >= 100) {
      const tMean = tv.reduce((a, b) => a + b, 0) / tv.length;
      const tSd = Math.sqrt(tv.reduce((a, b) => a + (b - tMean) ** 2, 0) / tv.length) || 1;
      trigPart = (e) => (typeof e.trig === 'number' ? sigmoid((e.trig - tMean) / tSd) : null);
      console.log(`Trigger-Label: ${tv.length} Events mit On-Summon-Ertrag `
        + `(Ø ${tMean.toFixed(2)}, sd ${tSd.toFixed(2)}), Blend ${TRIG_BLEND}`);
    } else {
      console.log(`Trigger-Label: nur ${tv.length} Events mit Ertrag (<100) — Kanal stumm, `
        + `Label unverändert (Datensatz ohne onSummonTriggers?)`);
    }
  }
  const label = (e) => {
    const base = ADV_BLEND * sigmoid((e.adv - aMean) / aSd)
      + (1 - ADV_BLEND) * (liftPart ? liftPart(e.name, e.turn) : e.outcome);
    const t = trigPart ? trigPart(e) : null;
    return t === null ? base : (1 - TRIG_BLEND) * base + TRIG_BLEND * t;
  };
  const rowOf = e => ({ bias: 1, [`play:${e.name}:${bucketOf(e.turn)}`]: 1 });
  const rows = trainEvs.map(rowOf);
  const labels = trainEvs.map(label);

  const support = Object.create(null);
  for (const r of rows) for (const k of Object.keys(r)) support[k] = (support[k] || 0) + 1;
  const minSup = Math.max(8, Math.ceil(0.01 * rows.length));
  // ── LERN-DEADLOCK AUFGEBROCHEN (Messung 30.7.) ─────────────────────
  // Die Schwelle lief bisher je ZELLE (Karte × Phase). Für eine Karte,
  // die die CPU selten spielt, fällt damit JEDE Zelle durch — und die
  // Karte verschwindet komplett aus `cardValues` UND `timing`. Konkret
  // gemessen am Deepsea-Profil: "Dark Deepsea God" war gar nicht mehr
  // im Modell (27 Plays in 160 Spielen, verteilt auf drei Phasen, gegen
  // minSup ≈ 74). `learnedCardValue` liefert dann `null`, die Karte
  // zählt im Ausspiel-Ranking 0 — und wird deshalb noch seltener
  // gespielt. Ein sich selbst verstärkender Deadlock, ausgerechnet auf
  // der Wincon des Decks.
  //
  // Fix: die Schwelle greift jetzt auf KARTEN-Ebene. Eine Zelle bleibt,
  // wenn die Karte INSGESAMT genug Belege hat — die Phasen-Aufteilung
  // darf dünn sein. Das ist die richtige Granularität: die Frage "ist
  // diese Karte gut?" hat mehr Daten als "ist diese Karte früh gut?".
  // Zellen-Rauschen bleibt begrenzt, weil `timing` ohnehin nur bei ≥2
  // vorhandenen Buckets exportiert wird und die z-Normierung späterer
  // Ausreißer kappt. Der Karten-Mindestbeleg bleibt konservativ.
  const cardSupport = Object.create(null);
  for (const k of Object.keys(support)) {
    const m = /^play:(.+):(early|mid|late)$/.exec(k);
    if (m) cardSupport[m[1]] = (cardSupport[m[1]] || 0) + support[k];
  }
  const MIN_CARD_SUP = Math.max(12, Math.ceil(0.004 * rows.length));
  const keep = new Set(Object.keys(support).filter(k => {
    if (k === 'bias' || support[k] >= minSup) return true;
    const m = /^play:(.+):(early|mid|late)$/.exec(k);
    return !!m && (cardSupport[m[1]] || 0) >= MIN_CARD_SUP;
  }));
  {
    const rescued = Object.keys(support).filter(k => {
      const m = /^play:(.+):(early|mid|late)$/.exec(k);
      return !!m && support[k] < minSup && keep.has(k);
    });
    const names = [...new Set(rescued.map(k => /^play:(.+):(early|mid|late)$/.exec(k)[1]))];
    if (names.length) {
      console.log(`Karten-Support-Rettung: ${rescued.length} dünne Zellen behalten `
        + `(Zellen-Schwelle ${minSup}, Karten-Schwelle ${MIN_CARD_SUP}) — betrifft: ${names.join(', ')}`);
    }
  }

  const w = fitSoftLogistic(rows, labels, keep, { epochs: 1500, lr: 0.15 });

  const hRows = holdEvs.map(rowOf);
  const hLabels = holdEvs.map(label);
  const m = evalLogLoss(hRows, hLabels, w, keep);
  console.log(`Advantage-Modell: ${trainEvs.length} Train-Events, ${keep.size} Features, Blend ${ADV_BLEND}/${(1 - ADV_BLEND).toFixed(1)}`);
  console.log(`HOLDOUT (Play-Modell): soft-acc ${(100 * m.acc).toFixed(1)}%, logloss ${m.logLoss.toFixed(3)} über ${holdEvs.length} Events`);

  // ── Uplift-Combos v2 (entrauscht) ──
  // Echte Abhängigkeit statt Adjazenz: Wie viel besser ist ein X-Play,
  // wenn Y VERFÜGBAR war (Hand/Board-ctx), verglichen mit X ohne Y?
  // Die v1-Fassung (fixe 0.06-Schwelle) produzierte bei kleinen
  // Datensätzen Phantom-Paare (Als Befund, Cute Commando 152 Spiele:
  // uniformes +40 mit Cliquen-Struktur — Sieg-Marker-Karten paarten
  // sich mit allem). Vier Gegenmaßnahmen:
  //   1. PER-SPIEL-ZENTRIERUNG der Labels (Label minus Spiel-Mittel):
  //      In Siegen ist JEDE Karte öfter verfügbar und jedes Event trägt
  //      outcome=1 zu 40% im Label — dieser Gewinnspiel-Halo erzeugte
  //      Paare aus bloßer Ko-Präsenz. Zentriert bleibt nur der Kontrast
  //      INNERHALB der Spiele: liefen X-Plays mit Y besser als ohne?
  //   2. WELCH-t-GATE statt fixer Schwelle: Die Differenz muss
  //      t ≥ PAIR_T_MIN gegen ihren eigenen Standardfehler bestehen —
  //      skaliert automatisch mit der Datenmenge (bei ~150 Spielen
  //      überleben nur satte Effekte, bei 1000+ wird der Kanal feiner)
  //      und kompensiert das Multiple-Testing über viele Kandidaten.
  //   3. CO-PLAY-EVIDENZ: Verfügbarkeit ist keine Interaktion. Ein Paar
  //      qualifiziert nur, wenn beide Karten tatsächlich mehrfach im
  //      selben oder benachbarten Zug GESPIELT wurden (aus playEvents)
  //      — Phoenix Cannon+Tackle überlebt das locker, "lag halt oft
  //      zusammen auf der Hand" nicht.
  //   4. CLIQUEN-DÄMPFUNG: Karten, die trotz allem mit vielen Partnern
  //      paaren (Sieg-Marker-Rest), werden pro Paar herunterskaliert.
  // Zusätzlich landet die volle Statistik (roher Δ, Arm-Größen, t,
  // Co-Play-Zahlen) in `upliftStats` und im Log/Report — ein gecapptes
  // "+40" ist damit als Clamp-Artefakt sofort erkennbar.
  const uplifts = Object.create(null);
  const upliftStats = Object.create(null); // key -> {u, nW, nO, t, coOcc, coGames, damp}
  {
    const MIN_ARM = 8;
    const PAIR_T_MIN = 2.5;         // Welch-t-Mindestwert
    const COPLAY_MIN_OCC = 5;       // Co-Plays gesamt (|Δt| ≤ 1)
    const COPLAY_MIN_GAMES = 3;     // ... verteilt über ≥ N Spiele
    const CLIQUE_DEG = 4;           // ab diesem Paar-Grad wird gedämpft

    // (1) Per-Spiel-Mittel der Labels für die Zentrierung.
    const gameSum = Object.create(null), gameN = Object.create(null);
    for (const e of trainEvs) {
      const y = label(e);
      gameSum[e.gi] = (gameSum[e.gi] || 0) + y;
      gameN[e.gi] = (gameN[e.gi] || 0) + 1;
    }
    const centered = e => label(e) - (gameSum[e.gi] / gameN[e.gi]);

    // (3) Co-Play-Index aus den playEvents: "A|B" -> Vorkommen im
    // selben Zug + Zug×Folgezug, plus Anzahl beteiligter Spiele.
    const coOcc = Object.create(null), coGames = Object.create(null);
    {
      const addCo = (a, b, gi) => {
        if (a === b) return;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        coOcc[key] = (coOcc[key] || 0) + 1;
        (coGames[key] = coGames[key] || new Set()).add(gi);
      };
      trainGames.forEach((g, gi) => {
        if (!hasData(g)) return;
        const byTurn = Object.create(null);
        for (const e of g.playEvents) (byTurn[e.t] = byTurn[e.t] || []).push(e.n);
        for (const tStr of Object.keys(byTurn)) {
          const t = Number(tStr);
          const cur = byTurn[t];
          for (let i = 0; i < cur.length; i++) {
            for (let j = i + 1; j < cur.length; j++) addCo(cur[i], cur[j], gi);
          }
          const nxt = byTurn[t + 1];
          if (nxt) for (const a of cur) for (const b of nxt) addCo(a, b, gi);
        }
      });
    }

    const byCard = Object.create(null); // X -> [{y (zentriert), ctx}]
    for (const e of trainEvs) {
      if (!e.ctx) continue;
      (byCard[e.name] = byCard[e.name] || []).push({ y: centered(e), ctx: e.ctx });
    }
    // ctx-Einträge mit "dc:"-Präfix (Partner lag im DISCARD, seit dem
    // Recorder-Update) bilden eigene Hypothesen-Keys ("Cute Cat|dc:Grave
    // Worm"). Für Co-Play-Evidenz und Cliquen-Grad zählt aber die
    // KARTE, nicht die Zone — Lookup daher über den normalisierten Key
    // (Präfix strippen, neu sortieren).
    const stripDc = s => (s.startsWith('dc:') ? s.slice(3) : s);
    const normKey = key => key.split('|').map(stripDc).sort().join('|');
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const varOf = (a, m) => a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1);
    for (const [x, evs] of Object.entries(byCard)) {
      if (evs.length < MIN_ARM * 2) continue;
      const partners = new Set();
      for (const e of evs) for (const p of e.ctx) partners.add(p);
      for (const y of partners) {
        if (y === x || stripDc(y) === x) continue;
        const withY = [], withoutY = [];
        for (const e of evs) (e.ctx.includes(y) ? withY : withoutY).push(e.y);
        if (withY.length < MIN_ARM || withoutY.length < MIN_ARM) continue;
        const mW = mean(withY), mO = mean(withoutY);
        // (2) Welch-t: Differenz gegen ihren kombinierten Standardfehler.
        const se = Math.sqrt(varOf(withY, mW) / withY.length + varOf(withoutY, mO) / withoutY.length) || 1e-9;
        const u = mW - mO;
        const tval = u / se;
        const key = x < y ? `${x}|${y}` : `${y}|${x}`;
        const nk = normKey(key);
        // Symmetrischer Schlüssel: das statistisch stärkere |t| gewinnt.
        const prev = upliftStats[key];
        if (!prev || Math.abs(tval) > Math.abs(prev.t)) {
          upliftStats[key] = {
            u, nW: withY.length, nO: withoutY.length, t: tval,
            coOcc: coOcc[nk] || 0,
            coGames: coGames[nk] ? coGames[nk].size : 0,
            damp: 1,
          };
        }
      }
    }

    // Gates anwenden (Export ist positive-only wie bisher).
    let nNeg = 0, nTGate = 0, nCoGate = 0;
    const surv = [];
    for (const [key, s] of Object.entries(upliftStats)) {
      if (s.u <= 0) { nNeg++; continue; }
      if (s.t < PAIR_T_MIN) { nTGate++; continue; }
      if (s.coOcc < COPLAY_MIN_OCC || s.coGames < COPLAY_MIN_GAMES) { nCoGate++; continue; }
      surv.push(key);
    }
    // (4) Cliquen-Dämpfung über den Grad in den ÜBERLEBENDEN Paaren —
    // Grad zählt pro KARTE (dc:-Präfix gestrippt): eine Sieg-Marker-
    // Karte soll nicht via Hand- UND Discard-Hypothese doppelt so viele
    // ungedämpfte Paare bekommen.
    const deg = Object.create(null);
    for (const key of surv) for (const c of key.split('|')) {
      const n = stripDc(c);
      deg[n] = (deg[n] || 0) + 1;
    }
    for (const key of surv) {
      const [a, b] = key.split('|');
      const damp = Math.min(1, CLIQUE_DEG / Math.max(deg[stripDc(a)] || 1, deg[stripDc(b)] || 1));
      upliftStats[key].damp = damp;
      uplifts[key] = upliftStats[key].u * damp;
    }

    const total = Object.keys(upliftStats).length;
    console.log(`Uplift-Analyse v2: ${total} Kandidaten-Paare (Arme ≥${MIN_ARM}) → negativ: ${nNeg}, t-Gate (<${PAIR_T_MIN}): ${nTGate}, Co-Play-Gate (<${COPLAY_MIN_OCC} Plays / <${COPLAY_MIN_GAMES} Spiele, |Δt|≤1): ${nCoGate} — ${surv.length} behalten`);
    const list = surv.map(k => [k, upliftStats[k]]).sort((a, b) => b[1].t - a[1].t);
    for (const [k, s] of list.slice(0, 12)) {
      console.log(`  Δ=+${s.u.toFixed(3)} t=${s.t.toFixed(1)} n=${s.nW}/${s.nO} coPlay=${s.coOcc}×/${s.coGames}Sp${s.damp < 1 ? ` damp=${s.damp.toFixed(2)}` : ''}  ${k}`);
    }
  }
  // ── Cluster-konditionale Karten-Deltas ──
  // Wie verschiebt sich der Wert einer Karte, wenn der Gegner sich als
  // Aggro/Swarm/Spell-Archetyp zu erkennen gibt? Delta = mittleres
  // Label der X-Events im Cluster minus Gesamtmittel von X. Beide Arme
  // brauchen Support; 'mixed' ist die Basislinie und bekommt keine
  // Deltas. Konsumiert von der Laufzeit ab ~Zug 5 (Live-Fingerprint).
  const clusterDeltas = Object.create(null);
  {
    const MIN_ARM = 8;
    const clCount = Object.create(null);
    for (const e of trainEvs) clCount[e.cluster] = (clCount[e.cluster] || 0) + 1;
    console.log(`Cluster-Verteilung (Events): ${Object.entries(clCount).map(([c, n]) => `${c}:${n}`).join(', ')}`);
    const byCardAll = Object.create(null);
    for (const e of trainEvs) (byCardAll[e.name] = byCardAll[e.name] || []).push(e);
    for (const cl of ['aggro', 'swarm', 'spell']) {
      if ((clCount[cl] || 0) < 60) continue; // Cluster zu dünn belegt
      const deltas = Object.create(null);
      for (const [x, evs] of Object.entries(byCardAll)) {
        const inC = evs.filter(e => e.cluster === cl);
        const outC = evs.filter(e => e.cluster !== cl);
        if (inC.length < MIN_ARM || outC.length < MIN_ARM) continue;
        const mAll = evs.reduce((s, e) => s + label(e), 0) / evs.length;
        const mIn = inC.reduce((s, e) => s + label(e), 0) / inC.length;
        const d = mIn - mAll;
        if (Math.abs(d) < 0.05) continue;
        deltas[x] = Math.round(Math.max(-20, Math.min(20, d * 120)) * 10) / 10;
      }
      if (Object.keys(deltas).length > 0) clusterDeltas[cl] = deltas;
    }
    for (const [cl, ds] of Object.entries(clusterDeltas)) {
      const top = Object.entries(ds).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
      console.log(`  Cluster '${cl}': ${Object.keys(ds).length} Karten-Deltas — ${top.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
    }
  }
  // ── Caster-konditionale Karten-Deltas (Held × Karte) ──
  // Als Befund (Ida / Flame Avalanche): Derselbe Spell kann je nach
  // castendem Helden fundamental anders wirken — Idas Passiv macht
  // Destruction-AoEs zu Single-Target, wodurch der pauschal gelernte
  // cardValue (aus Spielen, in denen ANDERE Helden ihn als echten AoE
  // casteten) zur Fehlinformation wird. Dieser Kanal lernt den Versatz
  // pro (Karte, Caster-Held) als One-vs-Rest-Kontrast: mittleres
  // zentriertes Label der X-Plays via Held H minus via andere Helden.
  // Datengrundlage ist das `h`-Feld der playEvents (afterSpellResolved
  // → Spells und Attacks; nur frisch aufgezeichnete Logs tragen es).
  // Entrauschung wie im Uplift-v2-Kanal: Per-Spiel-Zentrierung gegen
  // den Gewinnspiel-Halo + Welch-t-Gate. Karten mit nur EINEM je
  // beobachteten Caster liefern keinen Kontrast und bleiben draußen.
  // NEGATIVE Deltas sind hier ausdrücklich erwünscht — "Avalanche via
  // Ida ist schlechter" ist genau das Lernziel.
  const casterDeltas = Object.create(null);
  {
    const MIN_ARM = 8;
    const CASTER_T_MIN = 2.0;   // weniger Kandidaten als bei Paaren → etwas laxer
    const CASTER_SCALE = 300;   // zentrierte Deltas → Punkteskala (±20-Clamp)
    const CASTER_CLAMP = 20;    // kompatibel zur Cluster-Delta-Punkteskala
    const gSum = Object.create(null), gN = Object.create(null);
    for (const e of trainEvs) {
      const y = label(e);
      gSum[e.gi] = (gSum[e.gi] || 0) + y;
      gN[e.gi] = (gN[e.gi] || 0) + 1;
    }
    const centeredC = e => label(e) - (gSum[e.gi] / gN[e.gi]);
    const byCardH = Object.create(null);
    for (const e of trainEvs) {
      if (!e.h) continue;
      (byCardH[e.name] = byCardH[e.name] || []).push(e);
    }
    const meanC = a => a.reduce((s, v) => s + v, 0) / a.length;
    const varC = (a, m) => a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1);
    const stats = [];
    for (const [x, evs] of Object.entries(byCardH)) {
      const heroes = [...new Set(evs.map(e => e.h))];
      if (heroes.length < 2) continue; // ein einziger Caster → kein Kontrast messbar
      for (const hn of heroes) {
        const inH = [], outH = [];
        for (const e of evs) (e.h === hn ? inH : outH).push(centeredC(e));
        if (inH.length < MIN_ARM || outH.length < MIN_ARM) continue;
        const mI = meanC(inH), mO = meanC(outH);
        const se = Math.sqrt(varC(inH, mI) / inH.length + varC(outH, mO) / outH.length) || 1e-9;
        const d = mI - mO;
        const t = d / se;
        if (Math.abs(t) < CASTER_T_MIN) continue;
        const pts = Math.round(Math.max(-CASTER_CLAMP, Math.min(CASTER_CLAMP, d * CASTER_SCALE)) * 10) / 10;
        if (Math.abs(pts) < 3) continue; // zu klein, um Verhalten zu ändern
        (casterDeltas[x] = casterDeltas[x] || Object.create(null))[hn] = pts;
        stats.push({ x, hn, d, t, nI: inH.length, nO: outH.length, pts });
      }
    }
    if (stats.length) {
      console.log(`Caster-Deltas (Held×Karte): ${stats.length} gelernt (|t| ≥ ${CASTER_T_MIN}, Arme ≥ ${MIN_ARM})`);
      for (const s of stats.sort((a, b) => Math.abs(b.t) - Math.abs(a.t)).slice(0, 8)) {
        console.log(`  ${s.pts > 0 ? '+' : ''}${s.pts}  ${s.x}@${s.hn}  (Δ=${s.d >= 0 ? '+' : ''}${s.d.toFixed(3)} t=${s.t.toFixed(1)} n=${s.nI}/${s.nO})`);
      }
    } else {
      console.log('Caster-Deltas: keine gelernt — braucht frische Logs mit h-Feld und mehrere beobachtete Caster pro Karte');
    }
  }
  // ── Rückstand-konditionale Karten-Deltas (behind/even/ahead) ──
  // Als Comeback-Befund: Karten wie Golden Ankh sind massiv LAGE-
  // abhängig — im Rückstand die Swing-Karte, in Führung mittelmäßig —
  // aber kein Kanal konditionierte bisher auf die EIGENE Lage (Cluster
  // = Gegner-Archetyp). Die Lage steckt bereits in den Altdaten: die
  // evalCurve (evaluateState(pinned), differenziell, 0 = ausgeglichen)
  // wird pro Zug mitgeschnitten. Standing eines Plays in Zug t =
  // Kurvenwert VOR dem Zug (evalCurve[t−1], Fallback bis t−3).
  // Bucketing zero-verankert mit datensatz-adaptiver Schwelle
  // TH = 0.5 × sd aller Kurvenwerte — TH wird im Profil exportiert,
  // damit die Laufzeit mit DERSELBEN Metrik (evaluateState) und
  // Schwelle bucketet. One-vs-Rest je (Bucket, Karte) über zentrierte
  // Labels + Welch-t, wie im Caster-Kanal; 'even' ist die Basislinie.
  // Läuft auf ALTEN Logs — kein neues Datensammeln nötig.
  const standingDeltas = Object.create(null);
  let standingEvalThreshold = null;
  {
    const MIN_ARM = 8;
    const STAND_T_MIN = 2.0;
    const STAND_SCALE = 300;
    const STAND_CLAMP = 20;
    const curveVals = [];
    trainGames.forEach(g => {
      if (!hasData(g)) return;
      for (const v of Object.values(g.evalCurve)) {
        if (typeof v === 'number') curveVals.push(v);
      }
    });
    if (curveVals.length >= 50) {
      // Robuste Schwelle statt sd: Die Kurve enthält Game-Over-Stempel
      // (±100000), die jede Varianz-basierte Schwelle sprengen (real
      // gemessen: 0.5×sd ≈ 14000 bei einer Spiel-Skala von |v|-Median
      // ≈ 1200 — es hätte NIE gebucketet). TH = Median der Absolutwerte
      // unter Ausschluss der Terminal-Marker: damit ist ~die Hälfte
      // aller Zustände 'even' und je ~ein Viertel behind/ahead —
      // datensatz-adaptiv, ausreißerfest. (Feinere Eskalationsstufe
      // wäre eine zugnormierte Schwelle, da |eval| über die Zuglänge
      // wächst; erst nötig, falls early-Standing zu selten anschlägt.)
      const absNonTerminal = curveVals
        .map(Math.abs)
        .filter(a => a < 50000)
        .sort((a, b) => a - b);
      const csd = absNonTerminal.length >= 50
        ? absNonTerminal[Math.floor(absNonTerminal.length / 2)] : 0;
      if (csd > 0) {
        standingEvalThreshold = Math.round(csd);
        const TH = standingEvalThreshold;
        const bucketOfEvent = (e) => {
          const curve = trainGames[e.gi]?.evalCurve;
          if (!curve) return null;
          let s = null;
          for (let tt = e.turn - 1; tt >= e.turn - 3 && s === null; tt--) {
            if (typeof curve[tt] === 'number') s = curve[tt];
          }
          if (s === null) return null; // Zug 1 ohne Vorwert → ungebucketet
          return s < -TH ? 'behind' : s > TH ? 'ahead' : 'even';
        };
        const stats = [];
        if (SIGNAL_MODE === 'winlift') {
          // ── Within-Standing-Lift (Als Auftrag nach dem DDG-Befund) ──
          // Der Alt-Kontrast lief INNERHALB der Karte (DDG-behind gegen
          // DDG-sonst) — für eine Wincon mit hoher eigener Baseline ist
          // "aus Rückstand seltener gewonnen als aus Führung" trivial
          // wahr und lernte −13.5, obwohl die Wahrheit invers ist:
          // behind MIT DDG-Cast 20.0% WR, behind OHNE 7.3% (gemessen
          // Batch 21-09-32). Die richtige Gegenprobe sind die
          // ALTERNATIVEN im selben Spielstand: SPIEL-Ebene, WR der
          // Spiele mit Play der Karte im Stand S minus WR der Spiele,
          // die S besucht haben, ohne sie dort zu spielen — dieselbe
          // Philosophie wie das zentrale winlift-Signal. Bekannter
          // Selektions-Caveat (dokumentiert, bewusst getragen): wer aus
          // dem Rückstand casten KANN, hat noch Board — ein Teil des
          // Lifts ist Zustand, nicht Karte; das z-Gate und der Clamp
          // begrenzen die Folgen.
          const LIFT_SCALE = 80;
          const visited = trainGames.map(g => {
            const set = new Set();
            if (hasData(g) && g.evalCurve) {
              for (const v of Object.values(g.evalCurve)) {
                if (typeof v !== 'number' || Math.abs(v) >= 50000) continue;
                set.add(v < -TH ? 'behind' : v > TH ? 'ahead' : 'even');
              }
            }
            return set;
          });
          const playedIn = Object.create(null);
          for (const e of trainEvs) {
            const b = bucketOfEvent(e);
            if (!b) continue;
            ((playedIn[e.name] = playedIn[e.name] || Object.create(null))[b]
              = playedIn[e.name][b] || new Set()).add(e.gi);
          }
          for (const bucket of ['behind', 'ahead']) {
            const deltas = Object.create(null);
            for (const [x, byB] of Object.entries(playedIn)) {
              const A = byB[bucket];
              if (!A || A.size < MIN_ARM) continue;
              let wA = 0;
              for (const gi of A) wA += trainGames[gi].outcome;
              let nB = 0, wB = 0;
              for (let gi = 0; gi < trainGames.length; gi++) {
                if (!visited[gi].has(bucket) || A.has(gi)) continue;
                nB++; wB += trainGames[gi].outcome;
              }
              if (nB < 2 * MIN_ARM) continue;
              const pA = wA / A.size, pB = wB / nB;
              const d = pA - pB;
              const pPool = (wA + wB) / (A.size + nB);
              const se = Math.sqrt(Math.max(1e-9, pPool * (1 - pPool)) * (1 / A.size + 1 / nB));
              const z = d / se;
              if (Math.abs(z) < STAND_T_MIN) continue;
              const pts = Math.round(Math.max(-STAND_CLAMP, Math.min(STAND_CLAMP, d * LIFT_SCALE)) * 10) / 10;
              if (Math.abs(pts) < 3) continue;
              deltas[x] = pts;
              stats.push({ x, bucket, d, t: z, nI: A.size, nO: nB, pts });
            }
            if (Object.keys(deltas).length > 0) standingDeltas[bucket] = deltas;
          }
          console.log('Standing-Deltas: Modus winlift (Within-Standing-Lift, Spiel-Ebene)');
        } else {
        const gSum2 = Object.create(null), gN2 = Object.create(null);
        for (const e of trainEvs) {
          const y = label(e);
          gSum2[e.gi] = (gSum2[e.gi] || 0) + y;
          gN2[e.gi] = (gN2[e.gi] || 0) + 1;
        }
        const centeredS = e => label(e) - (gSum2[e.gi] / gN2[e.gi]);
        const byCardS = Object.create(null);
        for (const e of trainEvs) {
          const b = bucketOfEvent(e);
          if (!b) continue;
          (byCardS[e.name] = byCardS[e.name] || []).push({ y: centeredS(e), b });
        }
        const meanS = a => a.reduce((s, v) => s + v, 0) / a.length;
        const varS = (a, m) => a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1);
        for (const bucket of ['behind', 'ahead']) {
          // Zwei Pässe: (1) rohe Kontraste aller Karten mit Arm-Support
          // sammeln, (2) den support-gewichteten Bucket-Mitteleffekt
          // abziehen und erst DANN t-gaten. Grund: Im Rückstand liefert
          // fast JEDER Play weniger Advantage (Phaseneffekt) — dieser
          // uniforme Anteil ist kein Karten-Signal und würde gemessene
          // Karten gegenüber ungemessenen (die keinen Versatz bekommen)
          // systematisch benachteiligen. Nach der Zentrierung bleibt
          // die KARTENSPEZIFISCHE Lage-Eignung: "Comeback-Karte X ist
          // im Rückstand besser als der Rückstands-Durchschnitt".
          // (Konstante Verschiebung ändert den Standardfehler nicht —
          // das t auf dem zentrierten Effekt bleibt statistisch sauber.)
          const raw = [];
          for (const [x, evs] of Object.entries(byCardS)) {
            const inB = [], outB = [];
            for (const e of evs) (e.b === bucket ? inB : outB).push(e.y);
            if (inB.length < MIN_ARM || outB.length < MIN_ARM) continue;
            const mI = meanS(inB), mO = meanS(outB);
            const se = Math.sqrt(varS(inB, mI) / inB.length + varS(outB, mO) / outB.length) || 1e-9;
            raw.push({ x, d: mI - mO, se, nI: inB.length, nO: outB.length });
          }
          if (!raw.length) continue;
          const wSum = raw.reduce((s, r) => s + r.nI, 0);
          const bucketMean = raw.reduce((s, r) => s + r.d * r.nI, 0) / Math.max(1, wSum);
          const deltas = Object.create(null);
          for (const r of raw) {
            const dAdj = r.d - bucketMean;
            const t = dAdj / r.se;
            if (Math.abs(t) < STAND_T_MIN) continue;
            const pts = Math.round(Math.max(-STAND_CLAMP, Math.min(STAND_CLAMP, dAdj * STAND_SCALE)) * 10) / 10;
            if (Math.abs(pts) < 3) continue;
            deltas[r.x] = pts;
            stats.push({ x: r.x, bucket, d: dAdj, t, nI: r.nI, nO: r.nO, pts });
          }
          if (Object.keys(deltas).length > 0) standingDeltas[bucket] = deltas;
        }
        }
        if (stats.length) {
          console.log(`Standing-Deltas (Lage×Karte, TH=±${TH}): ${stats.length} gelernt (|t| ≥ ${STAND_T_MIN}, Arme ≥ ${MIN_ARM})`);
          for (const s of stats.sort((a, b) => Math.abs(b.t) - Math.abs(a.t)).slice(0, 8)) {
            console.log(`  ${s.pts > 0 ? '+' : ''}${s.pts}  ${s.x}@${s.bucket}  (Δ=${s.d >= 0 ? '+' : ''}${s.d.toFixed(3)} t=${s.t.toFixed(1)} n=${s.nI}/${s.nO})`);
          }
        } else {
          console.log(`Standing-Deltas: keine über den Gates (TH=±${TH})`);
        }
      }
    }
  }
  // ── Deckout-Guard (Als Auftrag: aus Deckout-Losses lernen, wann ──
  // ── Draws/Self-Mill zu stoppen sind) ─────────────────────────────
  // Datengrundlage: `ds` (Restdeck-Größe beim Play, frische Logs) +
  // `reason` im Record. Eigener Deckout-Loss = outcome 0 + reason
  // 'deck_out' (der Ausdeckende verliert sofort). Zwei Schritte:
  //   1. DANGER-SCHWELLE aus den Daten: Median der ds-Werte in den
  //      letzten 3 Zügen eigener Deckout-Losses — das ist der Bereich,
  //      in dem die verhängnisvollen Draw-Entscheidungen noch fielen.
  //      (Fallback 10 bei zu wenig Deckout-Losses, Untergrenze 6.)
  //   2. Pro Karte: P(eigener Deckout-Loss | X im Danger-Bereich
  //      gespielt) minus die Danger-Baseline über ALLE Plays. Die
  //      Baseline-Subtraktion ist essentiell: bei kleinem Deck ist
  //      die Deckout-Wahrscheinlichkeit für JEDEN Play erhöht — nur
  //      der ÜBERHANG einer Karte (Draw-/Mill-Engines) ist ihr
  //      Signal; Vanilla-Karten landen bei ~0. (Baseline enthält Xs
  //      eigene Events → leicht konservativ, bewusst.)
  //      Welch-t ≥ 2, NUR Malus-Export (positive "sicher"-Deltas
  //      bringen nichts). Läuft zur Laufzeit ausschließlich, wenn
  //      das eigene Deck ≤ Schwelle ist — Frühspiel bleibt unberührt.
  const deckoutGuardMap = Object.create(null);
  let deckoutDangerSize = null;
  {
    const MIN_ARM = 8;
    const GUARD_T_MIN = 2.0;
    const GUARD_SCALE = 60;   // Risiko-Überhang (0-1) → Punkte-Malus
    const GUARD_CLAMP = 20;
    let anyDs = false;
    outer: for (const g of trainGames) {
      if (!hasData(g)) continue;
      for (const e of g.playEvents) {
        if (typeof e.ds === 'number') { anyDs = true; break outer; }
      }
    }
    if (!anyDs) {
      console.log('Deckout-Guard: keine ds-Daten — braucht frisch aufgezeichnete Logs (Recorder-Feld ds)');
    } else {
      const dangerSamples = [];
      trainGames.forEach(g => {
        if (!hasData(g)) return;
        if (!(g.outcome === 0 && g.reason === 'deck_out')) return;
        const lastTurn = g.turns || Math.max(0, ...g.playEvents.map(e => e.t || 0));
        for (const e of g.playEvents) {
          if (typeof e.ds === 'number' && e.t >= lastTurn - 2) dangerSamples.push(e.ds);
        }
      });
      dangerSamples.sort((a, b) => a - b);
      deckoutDangerSize = dangerSamples.length >= 20
        ? Math.max(6, dangerSamples[Math.floor(dangerSamples.length / 2)])
        : 10;
      // Beobachtungseinheit = SPIEL, nicht Event (Als Iter4-Befund):
      // Mehrere Danger-Plays desselben Spiels teilen exakt dasselbe
      // Outcome-Label — Event-Zählung ist reine Pseudo-Replikation,
      // macht die t-Werte überkonfident und ließ das Karten-Tagging
      // zwischen Trainings-Läufen Lotterie spielen (P3: Performance,
      // P4: plötzlich Wheels). Dedupe auf (Spiel, Karte); MIN_ARM
      // bedeutet damit ≥ 8 SPIELE mit Danger-Play der Karte.
      const byCardG = Object.create(null);
      const allY = [];
      trainGames.forEach(g => {
        if (!hasData(g) || (g.outcome !== 0 && g.outcome !== 1)) return;
        const y = (g.outcome === 0 && g.reason === 'deck_out') ? 1 : 0;
        const seenCards = new Set();
        let anyDanger = false;
        for (const e of g.playEvents) {
          if (typeof e.ds !== 'number' || e.ds > deckoutDangerSize) continue;
          anyDanger = true;
          if (seenCards.has(e.n)) continue;
          seenCards.add(e.n);
          (byCardG[e.n] = byCardG[e.n] || []).push(y);
        }
        if (anyDanger) allY.push(y);
      });
      if (allY.length < 50) {
        console.log(`Deckout-Guard: nur ${allY.length} Danger-Plays (ds ≤ ${deckoutDangerSize}) — zu wenig, Kanal bleibt leer`);
      } else {
        const meanG = a => a.reduce((s, v) => s + v, 0) / a.length;
        const varG = (a, m) => a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1);
        const baseRisk = meanG(allY);
        const stats = [];
        for (const [x, ys] of Object.entries(byCardG)) {
          if (ys.length < MIN_ARM) continue;
          const m = meanG(ys);
          const d = m - baseRisk;
          if (d <= 0) continue;
          const se = Math.sqrt(varG(ys, m) / ys.length + varG(allY, baseRisk) / allY.length) || 1e-9;
          const t = d / se;
          if (t < GUARD_T_MIN) continue;
          const pts = -Math.min(GUARD_CLAMP, Math.round(d * GUARD_SCALE * 10) / 10);
          if (Math.abs(pts) < 3) continue;
          deckoutGuardMap[x] = pts;
          stats.push({ x, d, t, n: ys.length, pts });
        }
        console.log(`Deckout-Guard: Danger-Schwelle ds ≤ ${deckoutDangerSize}, Baseline-Risiko ${(100 * baseRisk).toFixed(1)}% über ${allY.length} Danger-Plays — ${stats.length} Malus-Karten gelernt`);
        for (const s of stats.sort((a, b) => b.t - a.t).slice(0, 8)) {
          console.log(`  ${s.pts}  ${s.x}  (Risiko +${(100 * s.d).toFixed(1)}pp t=${s.t.toFixed(1)} n=${s.n})`);
        }
      }
    }
  }
  // ── Menü-Kanal (Als Auftrag, Bloody King Zi) ──
  // Quellen, bei denen WIR ein 3er-Menü komponieren und der GEGNER die
  // finale Wahl trifft (Zi: castet den Pick; Lamp: Pick geht an den
  // Gegner, Rest an uns; Crestina: Pick kommt zu uns, Rest verbannt)
  // plus Chaos Magic (Zufallsausgang, reine Statistik). Zwei Produkte:
  // (1) REPORT-Listen: je Quelle Karte → angeboten/gecastet — macht
  //     "Gegner erlaubt X nie" (offered≫cast) UND "X wird nie
  //     angeboten" (offered=0, z.B. Cheapest-Trio-Artefakt) sichtbar.
  // (2) menuOfferRules: gelernter Angebots-Wert je Quelle→Karte —
  //     Advantage-Kontrast "Menüs MIT X" vs "Menüs derselben Quelle
  //     ohne X" (zentrierte Labels wie tutorPickRules). Der Wert misst
  //     das Menü-Design INKLUSIVE realem Gegnerverhalten: eine Karte,
  //     die der Gegner nie durchlässt, aber deren Anwesenheit die
  //     Restwahl verbessert, lernt POSITIV; ein Angebot, das dem
  //     Gegner gute Picks schenkt, negativ.
  const menuOfferRules = Object.create(null);
  const menuOfferByCluster = Object.create(null);
  const menuOfferByStanding = Object.create(null);
  {
    const MIN_ARM = 5;
    const bySrc = Object.create(null);
    trainGames.forEach(g => {
      if (!hasData(g) || !Array.isArray(g.menus)) return;
      for (const m of g.menus) {
        if (!Array.isArray(m.o) || !m.o.length) continue; // Chaos: keine Angebots-Entscheidung
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), m.t);
        if (adv === null) continue;
        const y = ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome;
        (bySrc[m.s] = bySrc[m.s] || []).push({ o: m.o, y });
      }
    });
    for (const [sname, ms] of Object.entries(bySrc)) {
      const cards = new Set();
      for (const m of ms) for (const c of m.o) cards.add(c);
      for (const c of cards) {
        const withC = ms.filter(m => m.o.includes(c));
        const others = ms.filter(m => !m.o.includes(c));
        if (withC.length < MIN_ARM || others.length < MIN_ARM) continue;
        const delta = withC.reduce((s, m) => s + m.y, 0) / withC.length
          - others.reduce((s, m) => s + m.y, 0) / others.length;
        const pts = Math.round(Math.max(-20, Math.min(20, delta * 120)) * 10) / 10;
        if (Math.abs(pts) < 2) continue;
        menuOfferRules[`${sname}→${c}`] = pts;
      }
    }
    // ── Situations-Deltas (Als Auftrag: Wert je Karte IN DER LAGE) ──
    // Zwei Kontext-Achsen, beide aus Bestandsdaten rekonstruierbar:
    // Gegner-Cluster (oppFingerprint, "AoE gegen Creature-Boards") und
    // eigene Lage (evalCurve-Standing). Delta = Kontrast innerhalb der
    // Menüs MIT der Karte: Kontext-Arm vs Rest — additiv auf die
    // Basis-Regel, |pts| ≥ 3, Clamp ±15, beide Arme ≥ 5 Menüs.
    for (const [ctxName, ctxOf, store] of [
      ['Cluster', (g, m) => clusterOfFingerprint(g.oppFingerprint), menuOfferByCluster],
      ['Standing', (g, m) => {
        if (typeof standingEvalThreshold !== 'number' || !g.evalCurve) return null;
        let sv = null;
        for (let tt = m.t - 1; tt >= m.t - 3 && sv === null; tt--) {
          if (typeof g.evalCurve[tt] === 'number') sv = g.evalCurve[tt];
        }
        if (sv === null) return null;
        return sv < -standingEvalThreshold ? 'behind' : sv > standingEvalThreshold ? 'ahead' : null;
      }, menuOfferByStanding],
    ]) {
      const byKey = Object.create(null);
      trainGames.forEach(g => {
        if (!hasData(g) || !Array.isArray(g.menus)) return;
        for (const m of g.menus) {
          if (!Array.isArray(m.o) || !m.o.length) continue;
          const adv = playAdvantage(clampCurveForAdv(g.evalCurve), m.t);
          if (adv === null) continue;
          const y = ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome;
          const ctx = ctxOf(g, m);
          for (const c of m.o) {
            (byKey[`${m.s}→${c}`] = byKey[`${m.s}→${c}`] || []).push({ y, ctx });
          }
        }
      });
      for (const [key, arr] of Object.entries(byKey)) {
        const ctxs = new Set(arr.map(d => d.ctx).filter(Boolean));
        for (const ctx of ctxs) {
          const inC = arr.filter(d => d.ctx === ctx);
          const outC = arr.filter(d => d.ctx !== ctx);
          if (inC.length < 5 || outC.length < 5) continue;
          const delta = inC.reduce((s, d) => s + d.y, 0) / inC.length
            - outC.reduce((s, d) => s + d.y, 0) / outC.length;
          const pts = Math.round(Math.max(-15, Math.min(15, delta * 120)) * 10) / 10;
          if (Math.abs(pts) < 3) continue;
          (store[ctx] = store[ctx] || Object.create(null))[key] = pts;
        }
      }
    }
    const n = Object.values(bySrc).reduce((s, a) => s + a.length, 0);
    if (n > 0) {
      const nCl = Object.values(menuOfferByCluster).reduce((s, o) => s + Object.keys(o).length, 0);
      const nSt = Object.values(menuOfferByStanding).reduce((s, o) => s + Object.keys(o).length, 0);
      console.log(`Menü-Angebote: ${n} Menüs, ${Object.keys(menuOfferRules).length} Basis-Regeln + ${nCl} Cluster-Deltas + ${nSt} Standing-Deltas`);
    }
  }
  // ── Target-Priors ──
  // Welche ZielKLASSE (Tags aus classifyTargetTags) korreliert für eine
  // Karte mit gutem Advantage? Gleiche Mechanik wie die Cluster-Deltas:
  // Tag-Arm vs. Gesamtmittel der Karte, Doppelarm-Support, Export als
  // Gewichte, die targetPickDecision zur Laufzeit aufsummiert.
  const targetPriors = Object.create(null);
  {
    const MIN_ARM = 6;
    const picks = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.targetPicks)) continue;
      for (const p of g.targetPicks) {
        if (!p.tags || p.tags.length === 0) continue;
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), p.t);
        if (adv === null) continue;
        picks.push({ c: p.c, tags: p.tags, y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const byCard = Object.create(null);
    for (const p of picks) (byCard[p.c] = byCard[p.c] || []).push(p);
    for (const [c, ps] of Object.entries(byCard)) {
      if (ps.length < MIN_ARM * 2) continue;
      const mAll = ps.reduce((s, p) => s + p.y, 0) / ps.length;
      const tags = new Set();
      for (const p of ps) for (const g of p.tags) tags.add(g);
      const weights = Object.create(null);
      for (const g of tags) {
        const inT = ps.filter(p => p.tags.includes(g));
        const outT = ps.filter(p => !p.tags.includes(g));
        if (inT.length < MIN_ARM || outT.length < MIN_ARM) continue;
        const d = inT.reduce((s, p) => s + p.y, 0) / inT.length - mAll;
        if (Math.abs(d) < 0.05) continue;
        weights[g] = Math.round(Math.max(-20, Math.min(20, d * 120)) * 10) / 10;
      }
      if (Object.keys(weights).length > 0) targetPriors[c] = weights;
    }
    if (picks.length > 0) {
      console.log(`Target-Priors: ${picks.length} Zielwahlen, ${Object.keys(targetPriors).length} Karten mit gelernten Klassen-Gewichten`);
      for (const [c, ws] of Object.entries(targetPriors).slice(0, 5)) {
        console.log(`  ${c}: ${Object.entries(ws).map(([g, v]) => `${g} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
      }
    }
  }
  // ── Surprise-Fire-Regeln ──
  // Pro Karte × turnBucket: fireDelta = meanLabel(gefeuert) −
  // meanLabel(gehalten). Beide Arme brauchen Support (Surprises sind
  // selten → MIN_ARM 5). Positiv = feuern lohnt, negativ = halten.
  // ── Reaktions-Fire-Regeln (Als Vorgabe) ──
  // Wie surpriseRules, aber gebucketed nach SCHADENSHÄRTE statt nach
  // Zug-Phase: lethal/heavy/light. Genau die Unterscheidung, die Al
  // benannt hat — 50 nicht-tödlicher Schaden lohnt den Einsatz nicht,
  // 50 tödlicher sehr wohl. OHNE Verursacher-Seite (Als Ruling: eigener
  // lethal Damage zählt genauso viel wie gegnerischer). Fällt auf
  // early/mid/late zurück, wenn kein Schaden im Spiel war (z.B.
  // Surprise-Negation). MIN_ARM niedriger als bei Surprises, weil
  // Reaktionsfenster häufiger sind.
  const reactionRules = Object.create(null);
  {
    const MIN_ARM = 8;
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.reactionDecisions)) continue;
      for (const d of g.reactionDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ c: d.c, b: d.b || 'mid', fired: !!d.fired,
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const fireDelta = (ds) => {
      const fired = ds.filter(d => d.fired);
      const held = ds.filter(d => !d.fired);
      if (fired.length < MIN_ARM || held.length < MIN_ARM) return null;
      const delta = (fired.reduce((s, d) => s + d.y, 0) / fired.length)
        - (held.reduce((s, d) => s + d.y, 0) / held.length);
      const pts = Math.round(Math.max(-20, Math.min(20, delta * 120)) * 10) / 10;
      return Math.abs(pts) < 2 ? null : pts;
    };
    const byCardRx = Object.create(null);
    for (const d of decs) (byCardRx[d.c] = byCardRx[d.c] || []).push(d);
    for (const [c, ds] of Object.entries(byCardRx)) {
      const pooled = fireDelta(ds);
      const rules = Object.create(null);
      // Nur tatsächlich beobachtete Buckets — die Kreuzmenge aus
      // Seite × Härte × Phase ist zu groß, um sie blind aufzuspannen.
      for (const b of [...new Set(ds.map(d => d.b))]) {
        const fine = fireDelta(ds.filter(d => d.b === b));
        if (fine !== null) rules[b] = fine;
        else if (pooled !== null) rules[b] = pooled;
      }
      if (Object.keys(rules).length > 0) reactionRules[c] = rules;
    }
    // Iterations-Report (Als Vorgabe: nach JEDER Iteration Infos zu den
    // trainierten Reactions). Bewusst ohne slice() — alle Karten. Karten
    // ohne Regel werden MIT GRUND gelistet, damit erkennbar ist, ob mehr
    // Training hilft (Arm zu dünn) oder die Karte schlicht indifferent
    // ist (Delta unter Schwelle).
    if (decs.length > 0) {
      const nCards = Object.keys(byCardRx).length;
      const nRules = Object.keys(reactionRules).length;
      console.log(`Reaktions-Regeln: ${decs.length} Fire/Hold-Entscheidungen über ${nCards} Karte(n), ${nRules} mit gelernter Regel`);
      const fmt = (v) => `${v > 0 ? 'fire +' : 'hold '}${v}`;
      for (const [c, rs] of Object.entries(reactionRules).sort((a, b) => a[0].localeCompare(b[0]))) {
        const armInfo = byCardRx[c] || [];
        const nf = armInfo.filter(d => d.fired).length;
        console.log(`  ✓ ${c} (${nf} fire / ${armInfo.length - nf} hold): `
          + Object.entries(rs).map(([b, v]) => `${b} ${fmt(v)}`).join(', '));
      }
      for (const [c, ds] of Object.entries(byCardRx).sort((a, b) => a[0].localeCompare(b[0]))) {
        if (reactionRules[c]) continue;
        const nf = ds.filter(d => d.fired).length;
        const nh = ds.length - nf;
        const reason = (nf < MIN_ARM || nh < MIN_ARM)
          ? `Arm zu dünn (min ${MIN_ARM} je Seite)`
          : 'Delta unter Schwelle — Karte wirkt indifferent';
        console.log(`  · ${c} (${nf} fire / ${nh} hold): keine Regel — ${reason}`);
      }
    } else {
      console.log('Reaktions-Regeln: keine Fire/Hold-Entscheidungen in diesem Lauf');
    }
  }

  // ── Schadens-Impact-Kanal (Als Vorgabe) ──
  // Nicht Board-Größe ODER Kill-Potenzial, sondern beides als GELERNTER
  // Gesamtscore. Zwei Stufen, weil Als Formulierung zwei Fragen enthält:
  //   1. Die WÄHRUNG ist deckweit — wie viel ist ein Hero-Kill gegen
  //      einen Creature-Kill gegen X Schaden wert? Kleinste-Quadrate über
  //      alle Karten mit Impact-Daten, damit sich die Gewichte gegenseitig
  //      kalibrieren statt je Karte neu geraten zu werden.
  //   2. Die UMRECHNUNG Score → Wert ist je Karte — dieselbe Punktzahl
  //      kann für verschiedene Spells verschieden viel bedeuten.
  // Schaden wird auf /100 normiert, sonst dominiert seine Größenordnung
  // die Kill-Zähler und die Koeffizienten sind nicht mehr vergleichbar.
  let impactWeights = null;
  const impactRules = Object.create(null);
  {
    const MIN_FIT = 40;      // Beobachtungen für die deckweite Regression
    const MIN_BUCKET = 10;   // je Karte und Score-Bucket
    const obs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.damageImpacts)) continue;
      for (const d of g.damageImpacts) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        obs.push({
          c: d.c, dmg: (d.dmg || 0) / 100, hk: d.hk || 0, ck: d.ck || 0,
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome,
        });
      }
    }

    // Normalgleichungen für y ≈ b0 + wd·dmg + wh·hk + wc·ck, gelöst per
    // Gauß-Elimination mit Teilpivotisierung (4×4 — kein Bibliotheksbedarf).
    const solve = (A, b) => {
      const n = b.length;
      const M = A.map((row, i) => [...row, b[i]]);
      for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-9) return null;   // singulär → kein Fit
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = 0; r < n; r++) {
          if (r === col) continue;
          const f = M[r][col] / M[col][col];
          for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
        }
      }
      return M.map((row, i) => row[n] / row[i]);   // nach Gauß-Jordan ist M diagonal
    };

    if (obs.length >= MIN_FIT) {
      const feats = (o) => [1, o.dmg, o.hk, o.ck];
      const A = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      const bv = [0, 0, 0, 0];
      for (const o of obs) {
        const x = feats(o);
        for (let i = 0; i < 4; i++) { bv[i] += x[i] * o.y; for (let j = 0; j < 4; j++) A[i][j] += x[i] * x[j]; }
      }
      const w = solve(A, bv);
      if (w && w.every(v => Number.isFinite(v))) {
        impactWeights = {
          dmg100: Math.round(w[1] * 1000) / 1000,
          heroKill: Math.round(w[2] * 1000) / 1000,
          creatureKill: Math.round(w[3] * 1000) / 1000,
        };
      }
    }

    if (impactWeights) {
      const score = (o) => o.dmg * impactWeights.dmg100
        + o.hk * impactWeights.heroKill + o.ck * impactWeights.creatureKill;
      const all = obs.map(score).sort((a, b) => a - b);
      const q = (f) => all[Math.min(all.length - 1, Math.floor(all.length * f))];
      const lo = q(1 / 3), hi = q(2 / 3);
      const bucketOf = (v) => (v <= lo ? 'low' : v >= hi ? 'high' : 'mid');
      const byCard = Object.create(null);
      for (const o of obs) (byCard[o.c] = byCard[o.c] || []).push(o);
      for (const [c, ds] of Object.entries(byCard)) {
        const base = ds.reduce((s, o) => s + o.y, 0) / ds.length;
        const rules = Object.create(null);
        for (const b of ['low', 'mid', 'high']) {
          const sub = ds.filter(o => bucketOf(score(o)) === b);
          if (sub.length < MIN_BUCKET) continue;
          const mean = sub.reduce((s, o) => s + o.y, 0) / sub.length;
          const pts = Math.round(Math.max(-25, Math.min(25, (mean - base) * 120)) * 10) / 10;
          if (Math.abs(pts) >= 2) rules[b] = pts;
        }
        if (Object.keys(rules).length) impactRules[c] = rules;
      }
      impactWeights.loCut = Math.round(lo * 1000) / 1000;
      impactWeights.hiCut = Math.round(hi * 1000) / 1000;
    }

    // Iterations-Report (wie beim Reaktions-Kanal: nach JEDEM Lauf sichtbar)
    if (obs.length > 0) {
      console.log(`Schadens-Impact: ${obs.length} Plays über ${Object.keys(obs.reduce((m,o)=>(m[o.c]=1,m),{})).length} Karte(n)`);
      if (impactWeights) {
        const { dmg100, heroKill, creatureKill } = impactWeights;
        console.log(`  gelernte Währung: 100 Schaden = ${dmg100} | Hero-Kill = ${heroKill} | Creature-Kill = ${creatureKill}`);
        if (Math.abs(dmg100) > 1e-6) {
          console.log(`  → 1 Hero-Kill ≙ ${(heroKill / dmg100 * 100).toFixed(0)} Schaden, 1 Creature-Kill ≙ ${(creatureKill / dmg100 * 100).toFixed(0)} Schaden`);
        }
        for (const [c, rs] of Object.entries(impactRules).sort((a, b) => a[0].localeCompare(b[0]))) {
          console.log(`  ✓ ${c}: ` + ['low','mid','high'].filter(b => rs[b] != null)
            .map(b => `${b} ${rs[b] > 0 ? '+' : ''}${rs[b]}`).join(', '));
        }
      } else {
        console.log(`  noch kein Fit — ${MIN_FIT} Beobachtungen nötig`);
      }
    }
  }

  const surpriseRules = Object.create(null);
  {
    const MIN_ARM = 5;
    const bucketOf2 = t => (t <= 4 ? 'early' : t <= 9 ? 'mid' : 'late');
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.surpriseDecisions)) continue;
      for (const d of g.surpriseDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ c: d.c, b: bucketOf2(d.t), fired: !!d.fired,
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const fireDelta = (ds) => {
      const fired = ds.filter(d => d.fired);
      const held = ds.filter(d => !d.fired);
      if (fired.length < MIN_ARM || held.length < MIN_ARM) return null;
      const delta = (fired.reduce((s, d) => s + d.y, 0) / fired.length)
        - (held.reduce((s, d) => s + d.y, 0) / held.length);
      const pts = Math.round(Math.max(-20, Math.min(20, delta * 120)) * 10) / 10;
      return Math.abs(pts) < 2 ? null : pts;
    };
    // Zweistufig: feine Bucket-Regel wo der Doppelarm trägt, sonst
    // kartenweite Regel (alle Buckets gepoolt) als gröberer Fallback —
    // kleine Datensätze liefern so schon eine Karte-Ebene-Aussage,
    // große verfeinern automatisch auf Timing-Ebene.
    const byCard2 = Object.create(null);
    for (const d of decs) (byCard2[d.c] = byCard2[d.c] || []).push(d);
    for (const [c, ds] of Object.entries(byCard2)) {
      const pooled = fireDelta(ds);
      const rules = Object.create(null);
      for (const b of ['early', 'mid', 'late']) {
        const fine = fireDelta(ds.filter(d => d.b === b));
        if (fine !== null) rules[b] = fine;
        else if (pooled !== null) rules[b] = pooled;
      }
      if (Object.keys(rules).length > 0) surpriseRules[c] = rules;
    }
    if (decs.length > 0) {
      console.log(`Surprise-Regeln: ${decs.length} Fire/Hold-Entscheidungen, ${Object.keys(surpriseRules).length} Karten mit gelernten Regeln`);
      for (const [c, rs] of Object.entries(surpriseRules).slice(0, 5)) {
        console.log(`  ${c}: ${Object.entries(rs).map(([b, v]) => `${b} ${v > 0 ? 'fire +' : 'hold '}${v}`).join(', ')}`);
      }
    }
  }
  // ── Status-Heilungs-Regeln ──
  // Pro Karte × Kontext-Tag (st:1/2/3+, st:poison2+, st:frozen-hero,
  // st:stun-hero, st:hero-caster): Delta = meanLabel(gespielt) −
  // meanLabel(nicht gespielt) im gleichen Kontext. Die Laufzeit
  // summiert die Tag-Deltas der aktuellen Situation.
  const statusHealRules = Object.create(null);
  {
    const MIN_ARM = 5;
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.statusHealDecisions)) continue;
      for (const d of g.statusHealDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ c: d.c, tags: d.tags || [], fired: !!d.fired,
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const byCard = Object.create(null);
    for (const d of decs) (byCard[d.c] = byCard[d.c] || []).push(d);
    for (const [c, ds] of Object.entries(byCard)) {
      const tags = new Set();
      for (const d of ds) for (const g of d.tags) tags.add(g);
      const rules = Object.create(null);
      for (const g of tags) {
        const inT = ds.filter(d => d.tags.includes(g));
        const fired = inT.filter(d => d.fired);
        const held = inT.filter(d => !d.fired);
        if (fired.length < MIN_ARM || held.length < MIN_ARM) continue;
        const delta = fired.reduce((s, d) => s + d.y, 0) / fired.length
          - held.reduce((s, d) => s + d.y, 0) / held.length;
        const pts = Math.round(Math.max(-20, Math.min(20, delta * 120)) * 10) / 10;
        if (Math.abs(pts) < 2) continue;
        rules[g] = pts;
      }
      if (Object.keys(rules).length > 0) statusHealRules[c] = rules;
    }
    if (decs.length > 0) {
      console.log(`Status-Heilung: ${decs.length} Entscheidungen, ${Object.keys(statusHealRules).length} Karten mit Kontext-Regeln`);
      for (const [c, rs] of Object.entries(statusHealRules).slice(0, 4)) {
        console.log(`  ${c}: ${Object.entries(rs).map(([g, v]) => `${g} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
      }
    }
  }
  // ── Placement-Regeln (Support-Zonen-Ökonomie) ──
  // ── Ausspiel-Reihenfolge-Kanal (Als Auftrag, Schwester des Ketten-
  // Kanals): welche Karte gehört als nächstes gespielt? Gleiche
  // One-vs-Rest-Mechanik, eigener Tag-Raum (pord:*). Damit lernt das
  // Deck selbst, ob hohe Kartenwerte zuerst gehören, ob Zyklus-Züge
  // (pord:swap) früh besser laufen und ob der erste Play des Zuges
  // (pord:first) einem Enabler gehört. Bis v84 lief diese Auswahl in
  // roher Handreihenfolge.
  const playOrderRules = Object.create(null);
  {
    const MIN_ARM = 8;
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.playOrderDecisions)) continue;
      for (const d of g.playOrderDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ tags: d.tags || [],
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const tags = new Set();
    for (const d of decs) for (const g of d.tags) tags.add(g);
    for (const g of tags) {
      const withT = decs.filter(d => d.tags.includes(g));
      const without = decs.filter(d => !d.tags.includes(g));
      if (withT.length < MIN_ARM || without.length < MIN_ARM) continue;
      const delta = withT.reduce((s, d) => s + d.y, 0) / withT.length
        - without.reduce((s, d) => s + d.y, 0) / without.length;
      // ── STICHPROBEN-SCHRUMPFUNG (31.7.) ──────────────────────────
      // MIN_ARM 8 ließ ein Tag mit 41 Belegen dasselbe Gewicht ziehen
      // wie eines mit 1477. Genau das ist passiert: `pord:grants-action`
      // (41 Belege, nur Deepsea Primordium trägt es) bekam −11 und schob
      // den Motor ans Ende der Ausspiel-Reihenfolge — Iter2 fiel von
      // 53.8% auf 42.5% (z≈2.0, signifikant).
      // Dünne Arme sind zudem am stärksten KONFUNDIERT: eine
      // Enabler-Karte wird bevorzugt in ohnehin schlechten Stellungen
      // gespielt, das Tag misst dann die Lage statt der Entscheidung.
      // Standard-Schrumpfung n/(n+K) auf den KLEINEREN Arm; K=200, damit
      // 41 Belege auf ~17% Autorität kommen (−11 → −1.9) und ein Tag
      // erst ab einigen Hundert Belegen voll durchschlägt. Tags mit
      // vielen Belegen bleiben praktisch unverändert.
      const _nArm = Math.min(withT.length, without.length);
      const _shrink = _nArm / (_nArm + 200);
      const pts = Math.round(Math.max(-15, Math.min(15, delta * 120)) * _shrink * 10) / 10;
      if (Math.abs(pts) < 1.5) continue;
      playOrderRules[g] = pts;
    }
    if (decs.length > 0) {
      console.log(`Ausspiel-Reihenfolge: ${decs.length} Entscheidungen, ${Object.keys(playOrderRules).length} Tag-Regeln`
        + (Object.keys(playOrderRules).length ? ' — ' + Object.entries(playOrderRules).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') : ''));
    }
  }

  // ── Swap-Diagnose-Report (Als Auftrag) ────────────────────────────
  // KEIN Lernkanal — reine Konsolen-Ausgabe, damit nach jeder Iteration
  // sichtbar ist, wo die Zyklus-Züge verloren gehen. Drei Ebenen:
  // Verfügbarkeit (turn:*), Slot-Wahl (pick:*), Wert-Gate (gate:*).
  {
    const acc = Object.create(null);
    let games = 0;
    for (const g of trainGames) {
      if (!hasData(g) || !g.swapDiag) continue;
      games++;
      for (const [k, v] of Object.entries(g.swapDiag)) acc[k] = (acc[k] || 0) + v;
    }
    if (games > 0) {
      const p = (k) => acc[k] || 0;
      const bounces = p('pick:bounce-lvl') + p('pick:bounce-motor') + p('pick:bounce-fallback');
      const picks = bounces + p('pick:free-slot') + p('pick:none');
      const pct = (x, base) => base > 0 ? `${(100 * x / base).toFixed(0)}%` : '—';
      console.log(`\nSwap-Diagnose (${games} Spiele):`);
      console.log(`  Verfügbarkeit je Zug: swap-fähig auf der Hand 0/1/2/3/4+ = `
        + [0,1,2,3,4].map(i => p(`turn:hand-swappers:${i}`)).join('/')
        + ` | Ziel vorhanden ${p('turn:target-available')} vs kein Ziel ${p('turn:no-target')}`
        + ` | Hand ≥7 ${p('turn:handsize:7+')}`);
      console.log(`  Slot-Wahl (${picks} Entscheidungen): BOUNCE ${bounces} (${pct(bounces, picks)}) `
        + `— davon level-erzwungen ${p('pick:bounce-lvl')}, Motor ${p('pick:bounce-motor')}, volles Board ${p('pick:bounce-fallback')}`);
      console.log(`     FREIER SLOT ${p('pick:free-slot')} (${pct(p('pick:free-slot'), picks)}) `
        + `— Gründe: kein Motor ${p('pick:no-motor')}, `
        + `kein Bounce-Ziel ${p('pick:motor-no-target') + p('pick:lvl-no-target')}`
        + ` | (volle Hand blockt seit v99 NICHT mehr, kam ${p('pick:hand-full-allowed')}× vor)`);
      const sc = p('gate:swap-commit'), sk = p('gate:swap-skip');
      const nc = p('gate:normal-commit'), nk = p('gate:normal-skip');
      console.log(`  Wert-Gate: SWAPS ${sc} committet / ${sk} abgelehnt (${pct(sc, sc + sk)} Commit-Quote)`
        + ` | NORMAL ${nc} committet / ${nk} abgelehnt (${pct(nc, nc + nk)})`);
      // Delta-Verteilung: WIE WEIT verfehlen abgelehnte Plays die
      // Schwelle? Beantwortet, ob eine Schwellen-Korrektur überhaupt
      // helfen kann oder ob das Bewertungsmodell den Play strukturell
      // falsch bepreist.
      const BUCKETS = ['<=-200','-200..-50','-50..-20','-20..-12','-12..-6','-6..-3','-3..0','0..3','3..20','>20'];
      for (const kind of ['swap','normal']) {
        const row = BUCKETS.map(b => `${b}:${p(`delta:${kind}:${b}`)}`).filter(x => !x.endsWith(':0'));
        if (!row.length) continue;
        const thr = Object.keys(acc).filter(k => k.startsWith(`thr:${kind}:`))
          .map(k => `${k.split(':')[2]} (${acc[k]}×)`);
        console.log(`  Delta-Verteilung ${kind.toUpperCase()}: ${row.join('  ')}`);
        console.log(`     benutzte Schwelle: ${thr.join(', ') || '—'}`);
      }
      // Als Zielgröße direkt ausweisen: kommen konsistent neue
      // Kreaturen aufs Board? (Swaps tauschen nur, sie füllen nicht.)
      // Drei-Wege-Aufschlüsselung: trennt Bewertungs- von Ausführungsproblem
      for (const kind of ['swap','normal']) {
        const d=p(`gate:${kind}-declined`), fl=p(`gate:${kind}-failed`), ok=p(`gate:${kind}-commit`);
        if (d+fl+ok === 0) continue;
        console.log(`  ${kind.toUpperCase()} im Detail: Gate lehnt ab ${d} | Gate JA aber Play scheitert ${fl} | erfolgreich ${ok}`
          + (fl > ok ? '  ← AUSFÜHRUNG ist das Problem, nicht die Bewertung' : ''));
      }
      // Fehlschlag-Gründe + betroffene Karten (die schnellste Spur)
      const fr = Object.keys(acc).filter(k => k.startsWith('fail:'));
      if (fr.length) console.log(`  Fehlschlag-Gründe: ${fr.map(k => `${k.slice(5)} ${acc[k]}`).join(' | ')}`);
      const fc = Object.keys(acc).filter(k => k.startsWith('failcard:'))
        .sort((a2, b2) => acc[b2] - acc[a2]).slice(0, 6);
      if (fc.length) console.log(`  häufigste Fehlschlag-Karten: ${fc.map(k => `${k.slice(9)} ${acc[k]}`).join(', ')}`);
      // Welcher Recon-Plan gewann?
      for (const kind of ['swap', 'normal']) {
        const pl = Object.keys(acc).filter(k => k.startsWith(`plan:${kind}:`))
          .sort((a2, b2) => acc[b2] - acc[a2]).slice(0, 4);
        if (pl.length) console.log(`  bester Plan ${kind}: ${pl.map(k => `${k.split(':').slice(2).join(':')} ${acc[k]}`).join(', ')}`);
      }
      // Board-Füllstand und Grants
      const bd = [0,1,2,3,4,5,6].map(i => p(`turn:board:${i}`));
      const bo = [0,1,2,3,4,5,6].map(i => p(`turn:board-old:${i}`));
      if (bd.some(Boolean)) {
        console.log(`  Board-Kreaturen je Zug 0..6+: ${bd.join('/')}  |  davon BOUNCE-BAR (aus Vorrunden): ${bo.join('/')}`);
      }
      // ── Grant-Lebenszyklus (Als Kernverdacht) ──────────────────────
      // Al: "Die extrem niedrige Rate an Primordium-Grants dürfte der
      // Hauptgrund sein, warum das Deck nicht in Gang kommt." Kette:
      // Primordium gespielt → Grant erteilt → beim Nachsehen gefunden →
      // ausgegeben → sonst verfallen. Getrennt nach Main Phase 1 und 2,
      // weil ein in der Action Phase erteilter Grant nur in MP2
      // einlösbar ist.
      {
        const g1 = p('grant:gefunden:mp1'), g2 = p('grant:gefunden:mp2');
        const k1 = p('grant:kein-grant-beim-check:mp1'), k2 = p('grant:kein-grant-beim-check:mp2');
        const expired = trainGames.reduce((a2, g) => a2 + (g.grantsExpired || 0), 0);
        if (g1 + g2 + k1 + k2 > 0) {
          console.log(`  GRANT-LEBENSZYKLUS: beim Nachsehen gefunden MP1 ${g1} / MP2 ${g2}`
            + ` | kein Grant vorhanden MP1 ${k1} / MP2 ${k2}`
            + ` | ausgegeben (Beschwörung) ${nc} | UNGENUTZT VERFALLEN ${expired}`);
          if (expired > nc) console.log('     ← mehr Grants verfallen als eingelöst: die Einlösung klemmt, nicht die Erteilung');
          else if (g1 + g2 === 0) console.log('     ← beim Nachsehen war NIE ein Grant da: Erteilung oder Timing klemmt');
        }
      }
      const gr = [1,2,3].map(i => p(`turn:grants-offen:${i}`));
      if (gr.some(Boolean) || p('grant:spender-findet')) {
        console.log(`  Primordium-Grants offen (1/2/3+): ${gr.join('/')}  |  Spender findet ${p('grant:spender-findet')} / leer ${p('grant:spender-leer')}`);
      }
      const ownTurns = p('turn:handsize:7+') + p('turn:handsize:lt7');
      // Als Zielgröße in SEINER Definition: netto neue Körper je Zug,
      // also Board-Kreaturen am Zugende minus Zugbeginn. Pfadunabhängig
      // und immun gegen Swaps (die tauschen 1:1) — im Gegensatz zum
      // engen Pfad-Zähler gate:normal-commit darunter.
      const zOk = p('body:zug-ok'), zNo = p('body:zug-verfehlt');
      if (zOk + zNo > 0) {
        const bk = ['0','1','2','3plus'].map(k => `${k}:${p(`body:erweitert-im-zug:${k}`)}`);
        console.log(`  ZIEL Board-Erweiterung: in ${zOk} von ${zOk + zNo} eigenen Zügen `
          + `(${(100 * zOk / (zOk + zNo)).toFixed(0)}%) mindestens EINE Beschwörung, `
          + `die das Board vergrößert hat  (Ziel: 100%, besser 2+ je Zug)`);
        console.log(`     Erweiterungen je Zug: ${bk.join('  ')}`);
        console.log(`     Einzelbeschwörungen: erweitert ${p('body:beschwoerung-erweitert')} | `
          + `neutral/Swap ${p('body:beschwoerung-neutral')} | kostet Körper (z.B. DDG) ${p('body:beschwoerung-kostet')}`);
      }
      if (ownTurns > 0) {
        console.log(`  (enger Pfad-Zähler: ${nc} freie Beschwörungen im Gratis-Pfad `
          + `= ${(nc / ownTurns).toFixed(2)}/Zug — NUR dieser eine Pfad, nicht die Gesamtbilanz)`);
      }
      const verdict = (sc + sk) === 0
        ? 'Swaps kamen am Gate NIE an → Ursache liegt in der Slot-Wahl'
        : (sk > sc ? 'Gate lehnt Swaps mehrheitlich ab → Schwelle prüfen'
                   : 'Gate committet Swaps mehrheitlich → Ursache liegt weiter oben');
      console.log(`  → ${verdict}`);
    }
  }

  // ── HAUPTMETRIK-Report: On-Summon-Trigger je eigenem Zug ───────────
  // Als Vorgabe. KEIN Lernkanal (der läuft über den Label-Blend oben) —
  // reine Auswertung, und zwar die wichtigste: sie sagt in einer Zahl,
  // ob der Deck-Motor läuft. Referenz aus 18 Demo-Spielen (Al am
  // Steuer): 4.49 gewichtete Trigger je eigenem Zug, Median 4, nur 3.5%
  // Null-Züge, und eine RAMPE über die Züge (2.0 → 5.2 → 7.1).
  // Die CPU lag bei der Erstmessung bei 1.93 / Median 2 / 34.4%
  // Null-Zügen und einer FLACHEN Kurve, die ab Zug 8 zerfällt.
  {
    let games = 0, turnsAll = [], srcW = Object.create(null), byIdx = [], ddgAfter = [];
    let withField = 0;
    for (const g of trainGames) {
      if (!hasData(g)) continue;
      games++;
      const list = g.onSummonTriggers;
      if (!Array.isArray(list) || !list.length) continue;
      withField++;
      const per = Object.create(null);
      for (const s of list) {
        per[s.t] = (per[s.t] || 0) + (s.w || 1);
        srcW[s.k || 'summon'] = (srcW[s.k || 'summon'] || 0) + (s.w || 1);
      }
      // Eigene Züge kommen aus `turnEconomy` — das ist die EINZIGE Quelle,
      // die je eigenem Zug einen Eintrag hat, auch wenn in diesem Zug gar
      // nichts gespielt wurde. Die erste Fassung leitete sie aus Triggern
      // und Plays ab und übersah damit ausgerechnet die Null-Züge: auf
      // demselben Datensatz meldete sie 7.2% statt der tatsächlichen
      // 25.7%. Trigger- und Play-Züge kommen als Sicherheitsnetz dazu,
      // falls turnEconomy einmal fehlt.
      const ts = [...new Set(
        (g.turnEconomy || []).map(t => t.t)
          .concat(list.map(s => s.t))
          .concat((g.playEvents || []).map(e => e.t))
      )].sort((a, b) => a - b);
      ts.forEach((t, i) => {
        const v = per[t] || 0;
        turnsAll.push(v);
        (byIdx[i] || (byIdx[i] = [])).push(v);
      });
      // Folgezug-Ertrag nach einem hochgewichteten Trigger (Als Balancing-
      // Karte, z.B. DDG): bricht die Kette danach ab?
      const heavy = list.filter(s => (s.w || 1) >= 3);
      for (const h of heavy) {
        const i = ts.indexOf(h.t);
        if (i >= 0 && i + 1 < ts.length) ddgAfter.push(per[ts[i + 1]] || 0);
      }
    }
    if (withField > 0) {
      const n = turnsAll.length;
      const sum = turnsAll.reduce((a, b) => a + b, 0);
      const sorted = [...turnsAll].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const zero = turnsAll.filter(v => v === 0).length;
      const ge3 = turnsAll.filter(v => v >= 3).length;
      const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      console.log(`\n═══ HAUPTMETRIK: On-Summon-Trigger je eigenem Zug (${withField}/${games} Spiele) ═══`);
      console.log(`  Gewichtete Trigger/Zug: ${(sum / Math.max(1, n)).toFixed(2)}   Median ${med}   `
        + `(Al-Referenz 4.49 / Median 4)`);
      console.log(`  Null-Trigger-Züge: ${zero}/${n} = ${(100 * zero / Math.max(1, n)).toFixed(1)}%   `
        + `(Al 3.5%)   |   Züge mit ≥3: ${(100 * ge3 / Math.max(1, n)).toFixed(1)}%   (Al 65%)`);
      const totW = Object.values(srcW).reduce((a, b) => a + b, 0) || 1;
      console.log(`  Quellen (Gewichtsanteil): `
        + Object.entries(srcW).sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${(100 * v / totW).toFixed(0)}%`).join(' | ')
        + `   (Al: swap 36% / summon 29% / ddg 30% / copy 5%)`);
      const curve = byIdx.slice(0, 10)
        .map((arr, i) => `${i + 1}:${mean(arr).toFixed(1)}`).join('  ');
      console.log(`  KURVE je eigenem Zug-Index: ${curve}`);
      console.log(`     (Al rampt: 2.0 → 5.2 → 7.1 und gewinnt in Zug 3-4. `
        + `Eine FLACHE Kurve heißt: der Motor zündet nicht.)`);
      if (ddgAfter.length) {
        const z = ddgAfter.filter(v => v === 0).length;
        console.log(`  Nach einem schweren Trigger (Gewicht ≥3, z.B. DDG): `
          + `Folgezug-Ertrag Ø ${mean(ddgAfter).toFixed(2)}, davon `
          + `${(100 * z / ddgAfter.length).toFixed(0)}% Null-Züge  (Al: Ø 3.71)`);
        if (mean(ddgAfter) < 1.5) {
          console.log(`     ← Die Kette BRICHT nach dem schweren Trigger ab. `
            + `Nicht die Karte ist das Problem, sondern der fehlende Nachbau.`);
        }
      }
    } else if (games > 0) {
      console.log(`\n═══ HAUPTMETRIK: keine onSummonTriggers im Datensatz `
        + `(Altbatch vor v107) — Kanal stumm ═══`);
    }
  }

  // ── Confirm-Diagnose: wollte das Gehirn den optionalen Effekt? ─────
  // Entstanden aus dem v107-Kernbefund: `cpuReactionDecision` lieferte
  // den blanken Boolean `true`, `promptConfirmEffect` liest aber
  // `result?.confirmed === true` — das Gehirn sagte JA und die Engine
  // las NEIN. Jeder optionale On-Summon-Effekt einer CPU-Karte fiel
  // still aus. Diese Zähler machen die Station dauerhaft sichtbar.
  {
    const acc = Object.create(null);
    for (const g of trainGames) {
      if (!hasData(g) || !g.swapDiag) continue;
      for (const [k, v] of Object.entries(g.swapDiag)) {
        if (k.startsWith('confirm')) acc[k] = (acc[k] || 0) + v;
      }
    }
    const ja = acc['confirm:ja'] || 0, nein = acc['confirm:nein'] || 0;
    if (ja + nein > 0) {
      console.log(`\nOptionale "you may"-Effekte: ${ja} bestätigt / ${nein} abgelehnt `
        + `(${(100 * ja / (ja + nein)).toFixed(0)}% Zusage)`);
      const perCard = Object.entries(acc)
        .filter(([k]) => k.startsWith('confirmcard:'))
        .reduce((m, [k, v]) => {
          const parts = k.split(':'); const said = parts.pop(); const nm = parts.slice(1).join(':');
          (m[nm] || (m[nm] = { ja: 0, nein: 0 }))[said] += v; return m;
        }, Object.create(null));
      const worst = Object.entries(perCard)
        .filter(([, c]) => c.nein > 0)
        .sort((a, b) => b[1].nein - a[1].nein).slice(0, 6);
      if (worst.length) {
        console.log(`  Häufigste Ablehnungen: `
          + worst.map(([nm, c]) => `${nm} ${c.nein}×nein/${c.ja}×ja`).join(', '));
      }
    }
  }

  // ── ABLEHNUNGS-REPORT: warum sagt der Server nein? ────────────────
  // Entstanden aus dem v107-Lauf: 1641 `server-nein` je Batch, davon nur
  // Dark Deepsea God erklärt (canSummon-Asymmetrie, v108). Werewolf 416,
  // Pirate 272, Mummy 211 und Primordium 161 blieben offen. Der Server
  // meldet den Grund jetzt selbst; dieser Block macht ihn lesbar.
  {
    const acc = Object.create(null);
    for (const g of trainGames) {
      if (!hasData(g) || !g.swapDiag) continue;
      for (const [k, v] of Object.entries(g.swapDiag)) {
        if (k.startsWith('refuse')) acc[k] = (acc[k] || 0) + v;
      }
    }
    const gesamt = Object.entries(acc).filter(([k]) => k.startsWith('refuse:'));
    if (gesamt.length) {
      const sum = gesamt.reduce((a, [, v]) => a + v, 0);
      console.log(`\n═══ ABLEHNUNGSGRÜNDE des Servers (${sum} Ablehnungen) ═══`);
      for (const [k, v] of gesamt.sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.slice(7).padEnd(24)} ${String(v).padStart(6)}  ${(100 * v / sum).toFixed(1)}%`);
      }
      const why = Object.entries(acc).filter(([k]) => k.startsWith('refusewhy:'));
      if (why.length) {
        console.log('  Feinaufschlüsselung:');
        for (const [k, v] of why.sort((a, b) => b[1] - a[1])) {
          console.log(`    ${k.slice(10).padEnd(38)} ${v}`);
        }
      }
      // Je Karte: welcher Grund dominiert?
      const perCard = Object.create(null);
      for (const [k, v] of Object.entries(acc)) {
        if (!k.startsWith('refusecard:')) continue;
        const rest = k.slice(11);
        const cut = rest.lastIndexOf(':');
        const nm = rest.slice(0, cut), label = rest.slice(cut + 1);
        (perCard[nm] || (perCard[nm] = {}))[label] = ((perCard[nm] || {})[label] || 0) + v;
      }
      const rows = Object.entries(perCard)
        .map(([nm, m]) => [nm, m, Object.values(m).reduce((a, b) => a + b, 0)])
        .sort((a, b) => b[2] - a[2]).slice(0, 10);
      if (rows.length) {
        console.log('  Je Karte (Top 10):');
        for (const [nm, m, tot] of rows) {
          const detail = Object.entries(m).sort((a, b) => b[1] - a[1])
            .map(([l, c]) => `${l} ${c}`).join(', ');
          console.log(`    ${nm.padEnd(26)} ${String(tot).padStart(5)}   ${detail}`);
        }
      }
      if (acc['refuse:unbekannt']) {
        console.log(`  ⚠ ${acc['refuse:unbekannt']}× ohne Grund — eine Ablehnungsstelle `
          + `in doPlayCreature ist nicht instrumentiert.`);
      }
    }
  }

  // ── Ketten-Kanal (Als Auftrag): Opfer-Wahl beim Swap ──────────────
  // Gleiche One-vs-Rest-Mechanik wie beim Placement-Kanal, eigener
  // Tag-Raum (bnc:*). Damit lernt das Deck selbst, WELCHE Kreatur beim
  // Bounce-Swap zurück auf die Hand soll — bis v83 war das ein
  // Münzwurf. Erwartete, aber NICHT vorgegebene Regeln: bnc:val:hi
  // positiv (wertvolle Karten zurückholen, sie sind sofort wieder
  // spielbar) und bnc:spec-break negativ (eine erfüllte Opfer-
  // Bedingung nicht beiläufig auflösen). Der Trainer darf beides auch
  // widerlegen.
  //
  // `spec:ready` ist ein Sonderfall im selben Kanal: es misst nicht
  // eine Bounce-Wahl, sondern ob Spiele besser liefen, in denen eine
  // erfüllbare Opfer-Karte tatsächlich vorgezogen wurde. Als Gewicht
  // > 0 schaltet die Vorziehung in fireAdditionalActions scharf.
  const bounceRules = Object.create(null);
  {
    const MIN_ARM = 8;
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.bounceDecisions)) continue;
      for (const d of g.bounceDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ tags: d.tags || [],
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const tags = new Set();
    for (const d of decs) for (const g of d.tags) tags.add(g);
    for (const g of tags) {
      const withT = decs.filter(d => d.tags.includes(g));
      const without = decs.filter(d => !d.tags.includes(g));
      if (withT.length < MIN_ARM || without.length < MIN_ARM) continue;
      const delta = withT.reduce((s, d) => s + d.y, 0) / withT.length
        - without.reduce((s, d) => s + d.y, 0) / without.length;
      const pts = Math.round(Math.max(-15, Math.min(15, delta * 120)) * 10) / 10;
      if (Math.abs(pts) < 1.5) continue;
      bounceRules[g] = pts;
    }
    // spec:ready — Spiel-Ebene: lohnte sich das Vorziehen erfüllbarer
    // Opfer-Karten? Kontrast über Spiele MIT vs OHNE eine solche
    // Beschwörung, gemessen am selben Label wie oben.
    const withSpec = [], withoutSpec = [];
    for (const g of trainGames) {
      if (!hasData(g)) continue;
      const any = (g.bounceDecisions || []).some(d => (d.tags || []).includes('bnc:spec-keep'));
      (any ? withSpec : withoutSpec).push(g.outcome);
    }
    if (withSpec.length >= MIN_ARM && withoutSpec.length >= MIN_ARM) {
      const d = withSpec.reduce((s, v) => s + v, 0) / withSpec.length
        - withoutSpec.reduce((s, v) => s + v, 0) / withoutSpec.length;
      const pts = Math.round(Math.max(-15, Math.min(15, d * 120)) * 10) / 10;
      if (Math.abs(pts) >= 1.5) bounceRules['spec:ready'] = pts;
    }
    if (decs.length > 0) {
      console.log(`Ketten-Kanal: ${decs.length} Bounce-Entscheidungen, ${Object.keys(bounceRules).length} Tag-Regeln`
        + (Object.keys(bounceRules).length ? ' — ' + Object.entries(bounceRules).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') : ''));
    }
  }

  // Je Kontext-Tag (plc:slack:0/1/2+, plc:bigwait): One-vs-Rest-Delta
  // der Advantage-Labels. Positiv = Platzierungen mit diesem Tag
  // korrelieren mit besserem Spielverlauf.
  const placementRules = Object.create(null);
  {
    const MIN_ARM = 8;
    const decs = [];
    for (const g of trainGames) {
      if (!hasData(g) || !Array.isArray(g.placementDecisions)) continue;
      for (const d of g.placementDecisions) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        decs.push({ tags: d.tags || [],
          y: ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome });
      }
    }
    const tags = new Set();
    for (const d of decs) for (const g of d.tags) tags.add(g);
    for (const g of tags) {
      const withT = decs.filter(d => d.tags.includes(g));
      const without = decs.filter(d => !d.tags.includes(g));
      if (withT.length < MIN_ARM || without.length < MIN_ARM) continue;
      const delta = withT.reduce((s, d) => s + d.y, 0) / withT.length
        - without.reduce((s, d) => s + d.y, 0) / without.length;
      const pts = Math.round(Math.max(-15, Math.min(15, delta * 120)) * 10) / 10;
      if (Math.abs(pts) < 1.5) continue;
      placementRules[g] = pts;
    }
    if (decs.length > 0) {
      console.log(`Placement: ${decs.length} Entscheidungen, ${Object.keys(placementRules).length} Tag-Regeln`
        + (Object.keys(placementRules).length ? ' — ' + Object.entries(placementRules).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') : ''));
    }
  }
  // ── Tutor-Pick-Regeln ──
  // Je Quelle→gepickte Karte: One-vs-Rest-Delta der Advantage-Labels
  // gegen andere Picks DERSELBEN Quelle (within-source-Kontrast — die
  // richtige Vergleichsbasis: "was hätte dieser Tutor sonst geholt").
  const tutorPickRules = Object.create(null);
  {
    const MIN_ARM = 4;
    // ── Recency-Gewichtung (Als DM-Fetch-Befund) ─────────────────────
    // Kumulatives Training konserviert veraltete Regeln: Eine früh
    // gelernte Negativ-Regel unterdrückt die Picks, die sie widerlegen
    // würden. Neuere Spiele (spätere Position im Datensatz — die
    // Iterations-Dateien sind chronologisch) zählen daher linear
    // stärker (×0.25 ältestes → ×1.0 neuestes Spiel); zusammen mit der
    // Galerie-ε-Exploration (PP_GALLERY_EXPLORE) kann frische Evidenz
    // alte Regeln in wenigen Iterationen überschreiben. MIN_ARM bleibt
    // auf ROHEN Zählungen (Gewichte ändern die Stichprobengröße nicht).
    const NG = Math.max(1, trainGames.length - 1);
    const recencyW = gi => 0.25 + 0.75 * (gi / NG);
    const bySrc = Object.create(null);
    trainGames.forEach((g, gi) => {
      if (!hasData(g) || !Array.isArray(g.tutorPicks)) return;
      const w = recencyW(gi);
      for (const d of g.tutorPicks) {
        const adv = playAdvantage(clampCurveForAdv(g.evalCurve), d.t);
        if (adv === null) continue;
        const y = ADV_BLEND * sigmoid((adv - aMean) / aSd) + (1 - ADV_BLEND) * g.outcome;
        for (const p of d.picked || []) (bySrc[d.src] = bySrc[d.src] || []).push({ p, y, w });
      }
    });
    const wMean = a => {
      let sy = 0, sw = 0;
      for (const d of a) { sy += d.y * d.w; sw += d.w; }
      return sw > 0 ? sy / sw : 0;
    };
    for (const [sname, ds] of Object.entries(bySrc)) {
      const cards = new Set(ds.map(d => d.p));
      for (const c of cards) {
        const withC = ds.filter(d => d.p === c);
        const others = ds.filter(d => d.p !== c);
        if (withC.length < MIN_ARM || others.length < MIN_ARM) continue;
        const delta = wMean(withC) - wMean(others);
        const pts = Math.round(Math.max(-20, Math.min(20, delta * 120)) * 10) / 10;
        if (Math.abs(pts) < 2) continue;
        tutorPickRules[`${sname}→${c}`] = pts;
      }
    }
    const n = Object.values(bySrc).reduce((s, a) => s + a.length, 0);
    if (n > 0) {
      console.log(`Tutor-Picks: ${n} Entscheidungen (recency-gewichtet ×0.25→×1.0), ${Object.keys(tutorPickRules).length} Quelle→Karte-Regeln`);
      for (const [k, v] of Object.entries(tutorPickRules).slice(0, 6)) console.log(`  ${v > 0 ? '+' : ''}${v}  ${k}`);
    }
  }
  return { w, keep, support, uplifts, upliftStats, clusterDeltas, casterDeltas, standingDeltas, standingEvalThreshold, deckoutGuard: deckoutGuardMap, deckoutDangerSize, menuOfferRules, menuOfferByCluster, menuOfferByStanding, targetPriors, surpriseRules, reactionRules, impactWeights, impactRules, statusHealRules, placementRules, bounceRules, playOrderRules, tutorPickRules };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/train-deck-profile.js <training-log.jsonl> [...]');
    process.exit(1);
  }
  const games = loadGames(files);
  if (games.length < 20) {
    console.error(`Only ${games.length} decided games — too few to learn anything. Aborting.`);
    process.exit(1);
  }
  const deckName = games[0].deck;
  const wins = games.filter(g => g.outcome === 1).length;
  const meanTurns = games.reduce((s, g) => s + (g.turns || 0), 0) / games.length;
  console.log(`Loaded ${games.length} decided games for "${deckName}" — baseline win-rate ${(100 * wins / games.length).toFixed(1)}%, avg ${meanTurns.toFixed(1)} turns`);
  // Ausgangs-Aufschlüsselung nach End-Grund (Als Auftrag): worüber
  // gewinnt/verliert das Deck? Läuft auch auf Altdaten (reason ist
  // seit jeher im Record).
  {
    const byKey = Object.create(null);
    for (const g of games) {
      const r = g.reason || 'unbekannt';
      const k = `${g.outcome === 1 ? 'Win ' : 'Loss'} (${r})`;
      byKey[k] = (byKey[k] || 0) + 1;
    }
    for (const [k, v] of Object.entries(byKey).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}× ${k}`);
    }
  }
  // Reaktionsfenster-Report (Als Gold-Frage): Wie oft lag eine
  // Hand-Reaktion beim Fensteröffnen bereit, und wie oft scheiterte sie
  // am Gold-Gate? Das Gate greift VOR der Bedingungsprüfung — die
  // Gold-Misses sind also eine Obergrenze. Die erwartete Zahl
  // zusätzlicher Feuerungen wird mit der Trefferquote der Fenster
  // hochgerechnet, die Gold HATTEN (Plays / (seen − gold)).
  {
    const agg = Object.create(null);
    for (const g of games) {
      for (const [card, e] of Object.entries(g.reactionWindows || {})) {
        const a = agg[card] || (agg[card] = { seen: 0, gold: 0, plays: 0 });
        a.seen += e.seen || 0;
        a.gold += e.gold || 0;
      }
      for (const ev of (g.playEvents || [])) {
        if (agg[ev.n]) agg[ev.n].plays++;
      }
    }
    const rows = Object.entries(agg).filter(([, a]) => a.seen > 0);
    if (rows.length) {
      console.log('Hand-Reaktionsfenster — Gelegenheit vs. Gold-Gate:');
      for (const [card, a] of rows.sort((x, y) => y[1].gold - x[1].gold)) {
        const withGold = Math.max(0, a.seen - a.gold);
        const hitRate = withGold > 0 ? a.plays / withGold : 0;
        const lost = Math.round(a.gold * hitRate);
        const pct = a.seen > 0 ? (100 * a.gold / a.seen).toFixed(0) : '0';
        console.log(`  ${card}: ${a.seen} Fenster mit Karte | ${a.gold} ohne Gold (${pct}%) | ${a.plays} gefeuert`
          + (lost > 0 ? `  → ca. ${lost} Feuerungen am Gold verloren` : ''));
      }
    }
  }
  // Menü-Report (Als Auftrag): je Quelle Karte → angeboten/gecastet.
  // offered=0-Karten fehlen naturgemäß — die Quellen-Zeile nennt
  // deshalb die Gesamtzahl der Menüs, damit "nie angeboten" aus dem
  // Deck-Kontext ablesbar bleibt. Chaos Magic: reine Ausgangs-Liste.
  {
    const bySrc = Object.create(null);
    for (const g of games) {
      if (!Array.isArray(g.menus)) continue;
      for (const m of g.menus) {
        const src = (bySrc[m.s] = bySrc[m.s] || { menus: 0, offered: Object.create(null), cast: Object.create(null), fizzle: 0 });
        src.menus++;
        if (Array.isArray(m.o)) for (const c of m.o) src.offered[c] = (src.offered[c] || 0) + 1;
        if (m.c) src.cast[m.c] = (src.cast[m.c] || 0) + 1;
        else if (!Array.isArray(m.o)) src.fizzle++;
      }
    }
    for (const [sname, src] of Object.entries(bySrc)) {
      if (sname === 'Chaos Magic') {
        console.log(`Chaos Magic — geworden zu (${src.menus} Casts${src.fizzle ? `, davon ${src.fizzle} Fizzle` : ''}):`);
        for (const [c, n] of Object.entries(src.cast).sort((a, b) => b[1] - a[1])) {
          console.log(`  ${String(n).padStart(4)}× ${c}`);
        }
        continue;
      }
      console.log(`${sname} — Angebot vs. Gegnerwahl (${src.menus} Menüs):`);
      const all = new Set([...Object.keys(src.offered), ...Object.keys(src.cast)]);
      const rows = [...all].map(c => ({ c, o: src.offered[c] || 0, k: src.cast[c] || 0 }));
      for (const r of rows.sort((a, b) => b.o - a.o)) {
        const rate = r.o ? ` (${(100 * r.k / r.o).toFixed(0)}%)` : '';
        console.log(`  angeboten ${String(r.o).padStart(4)}× | gewählt ${String(r.k).padStart(4)}×${rate}  ${r.c}`);
      }
    }
  }
  if (wins / games.length < WINRATE_WARN) {
    console.warn(`\n  ⚠️  WARNUNG: Winrate unter ${Math.round(WINRATE_WARN * 100)}% — Outcome-Labels aus verlust-dominierten Daten`);
    console.warn(`     lernen erfahrungsgemäß toxische Korrelationen (Setup-Vermeidung).`);
    console.warn(`     Die Advantage-Labels dämpfen das, aber mehr/bessere Spiele helfen mehr.\n`);
  }
  const { train: trainGames, hold: holdGames } = splitGames(games);
  console.log(`Split: ${trainGames.length} Training / ${holdGames.length} Holdout (Spiel-Ebene, seeded)`);

  // Per-opponent breakdown (sanity check for pool balance).
  const byOpp = Object.create(null);
  for (const g of games) {
    const o = byOpp[g.opponent] || { n: 0, w: 0 };
    o.n++; o.w += g.outcome;
    byOpp[g.opponent] = o;
  }
  for (const [opp, o] of Object.entries(byOpp).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  vs ${opp}: ${o.w}/${o.n} (${(100 * o.w / o.n).toFixed(0)}%)`);
  }

  // ── Build feature matrix with support filtering ──
  // Quartilsgrenzen der Spiellänge (Train-Split) für die len:-Kovariaten
  const turnsSorted = trainGames.map(g => g.turns || meanTurns).sort((a, b) => a - b);
  const lq = p => turnsSorted[Math.floor(p * (turnsSorted.length - 1))];
  const lenCuts = turnsSorted.length >= 40 ? [lq(0.25), lq(0.5), lq(0.75)] : null;
  const rows = trainGames.map(g => featurize(g, meanTurns, lenCuts)); // Fit nur auf Train-Split — Holdout liefert die ehrliche Güte
  const support = Object.create(null);
  for (const x of rows) for (const k of Object.keys(x)) support[k] = (support[k] || 0) + 1;
  const minSupport = Math.max(MIN_SUPPORT_ABS, Math.ceil(MIN_SUPPORT_FRAC * trainGames.length));
  const keep = new Set(Object.keys(support).filter(k =>
    k === 'bias' || k === 'first' || k === 'turns_n' || support[k] >= minSupport));
  console.log(`Features: ${Object.keys(support).length} raw → ${keep.size} after support filter (≥${minSupport} games)`);

  // ── Logistic regression, full-batch GD with L2 (bias unpenalised) ──
  const w = Object.create(null);
  for (const k of keep) w[k] = 0;
  const y = trainGames.map(g => g.outcome);
  const n = rows.length;
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const grad = Object.create(null);
    let loss = 0;
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) z += w[k] * v;
      const p = sigmoid(z);
      const err = p - y[i];
      loss += -(y[i] * Math.log(p + 1e-12) + (1 - y[i]) * Math.log(1 - p + 1e-12));
      for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) grad[k] = (grad[k] || 0) + err * v;
    }
    for (const k of keep) {
      const l2 = (k === 'bias') ? 0 : L2_LAMBDA * w[k];
      w[k] -= LEARN_RATE * ((grad[k] || 0) / n + l2);
    }
    if (epoch % 1000 === 0 || epoch === EPOCHS - 1) {
      console.log(`  epoch ${epoch}: avg loss ${(loss / n).toFixed(4)}`);
    }
  }

  // Train accuracy (in-sample — optimistic, just a sanity signal).
  let correct = 0;
  for (let i = 0; i < n; i++) {
    let z = 0;
    for (const [k, v] of Object.entries(rows[i])) if (keep.has(k)) z += w[k] * v;
    if ((sigmoid(z) >= 0.5 ? 1 : 0) === y[i]) correct++;
  }
  console.log(`In-sample accuracy: ${(100 * correct / n).toFixed(1)}%`);
  {
    const hRows = holdGames.map(g => featurize(g, meanTurns, lenCuts));
    const hY = holdGames.map(g => g.outcome);
    const m = evalLogLoss(hRows, hY, w, keep);
    console.log(`HOLDOUT (Spiel-Modell): accuracy ${(100 * m.acc).toFixed(1)}%, logloss ${m.logLoss.toFixed(3)} über ${holdGames.length} Spiele`);
    if (m.acc < 0.55) console.warn('  ⚠️  Holdout kaum besser als Münzwurf — Profil-Exporte mit Vorsicht genießen (mehr Daten sammeln).');
  }

  // ── Extract profile ──────────────────────────────────────────────
  // Per-card aggregate weight = support-weighted mean of its bucket
  // weights. z-scored across cards, mapped to the hand-value scale.
  const advModel = buildAdvantageModel(trainGames, holdGames, support);
  const srcW = advModel ? advModel.w : w;
  const srcKeep = advModel ? advModel.keep : keep;
  const srcSupport = advModel ? advModel.support : support;
  if (advModel) console.log('cardValues/Timing werden aus dem Advantage-Modell exportiert (Spiel-Modell liefert weiterhin ab:/eqp:/rev:/lk:/pair:).');
  const cardAgg = Object.create(null); // name -> { sumW, sumSup, buckets: {b: w} }
  for (const k of srcKeep) {
    const m = /^play:(.+):(early|mid|late)$/.exec(k);
    if (!m) continue;
    const [, name, bucket] = m;
    const e = cardAgg[name] || { sumW: 0, sumSup: 0, buckets: {} };
    e.sumW += srcW[k] * srcSupport[k];
    e.sumSup += srcSupport[k];
    e.buckets[bucket] = srcW[k];
    cardAgg[name] = e;
  }
  const cardNames = Object.keys(cardAgg);
  const cardMeans = cardNames.map(nm => cardAgg[nm].sumW / Math.max(1, cardAgg[nm].sumSup));
  const mean = cardMeans.reduce((a, b) => a + b, 0) / Math.max(1, cardMeans.length);
  const sd = Math.sqrt(cardMeans.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, cardMeans.length)) || 1;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const cardValues = Object.create(null);
  const timing = Object.create(null);
  cardNames.forEach((nm, i) => {
    const z = (cardMeans[i] - mean) / sd;
    // ── C: AUFLÖSUNG AM BODEN ERHALTEN (31.7.) ─────────────────────
    // Der harte Clamp stapelte alles Schwache auf exakt CARD_VALUE_MIN —
    // im Deepsea-Profil standen fünf Karten auf 8, ihre Rangfolge
    // untereinander war damit reiner Zufall. Unterhalb von MIN+6 wird
    // jetzt exponentiell weich abgebildet: stetig an der Nahtstelle,
    // streng monoton, und nach unten weiter durch MIN begrenzt.
    const raw = CARD_VALUE_CENTER + CARD_VALUE_SPREAD * z;
    const SOFT = CARD_VALUE_MIN + 6;
    let v = raw >= SOFT
      ? Math.min(raw, CARD_VALUE_MAX)
      : CARD_VALUE_MIN + 6 * Math.exp((raw - SOFT) / 12);
    // ── B: DESIGNER-VORGABE (31.7.) ────────────────────────────────
    // Karten-Vertrag `cpuMeta.cardValueFloor`. Es gibt Karten, deren
    // Bedeutung die Regression strukturell nicht sehen KANN, weil ihr
    // Beitrag über andere Karten realisiert wird. Für die trägt der
    // Deck-Designer die Information bei. Präzedenzfälle im Projekt:
    // gameStartPickPriority, cpuStandingDeltaFloor, cpuDeferUntilLast.
    // Wirkt nur nach OBEN — eine Karte, die sich als besser erweist als
    // ihr Boden, behält ihren gelernten Wert.
    try {
      const fl = loadCardEffectSafe(nm)?.cpuMeta?.cardValueFloor;
      if (typeof fl === 'number' && fl > v) v = fl;
    } catch { /* optional */ }
    cardValues[nm] = Math.round(Math.min(v, CARD_VALUE_MAX) * 10) / 10;
    const bs = cardAgg[nm].buckets;
    const present = Object.values(bs);
    if (present.length >= 2) {
      const bMean = present.reduce((a, b) => a + b, 0) / present.length;
      const t = {};
      for (const b of ['early', 'mid', 'late']) {
        if (bs[b] == null) { t[b] = 1; continue; }
        t[b] = Math.round(clamp(1 + TIMING_SPREAD * ((bs[b] - bMean) / sd), TIMING_MIN, TIMING_MAX) * 100) / 100;
      }
      timing[nm] = t;
    }
  });

  // Pairs: positive-only (a "bad pair" usually just means both cards are
  // weak — the per-card values already carry that; exporting negative
  // pair terms would double-punish).
  const pairBonuses = Object.create(null);
  // Uplift-Paare (aus dem Advantage-Modell) übersteuern Adjazenz-Paare.
  // Seit v2 kommen sie bereits entrauscht an: per-Spiel-zentriert,
  // Welch-t-gegated, Co-Play-verifiziert und cliquen-gedämpft — die
  // Skala ×150 bleibt, aber zentrierte Uplifts sind kleiner, sodass der
  // PAIR_MAX-Clamp die Ausnahme statt der Regel ist (Als "+40 überall"-
  // Befund). Positive-only wie das bestehende Exportformat.
  if (advModel && advModel.uplifts) {
    for (const [key, u] of Object.entries(advModel.uplifts)) {
      if (u <= 0) continue;
      const v = clamp(u * PAIR_UPLIFT_SCALE, 0, PAIR_MAX);
      if (v >= 4) pairBonuses[key] = Math.round(v * 10) / 10;
    }
  }
  for (const k of keep) {
    const m = /^pair:(.+)$/.exec(k);
    if (!m) continue;
    // Gemessen schlägt Adjazenz: Konnte die Uplift-Analyse dieses Paar
    // bewerten (egal ob bestanden oder durchgefallen), ist IHR Urteil
    // maßgeblich — ein Paar, das dort am t-/Co-Play-Gate scheiterte
    // oder sogar negativ maß, darf nicht über den outcome-konfundierten
    // Adjazenz-Kanal doch noch mit +40 exportiert werden (exakt Als
    // Phantom-Paar-Liste: Fighting|Forceful Revival kam mit gemessenem
    // t=-2.9 per Adjazenz zurück). Adjazenz füllt nur noch Paare OHNE
    // Uplift-Messung (zu wenig Arm-Support für beide Arme).
    if (advModel && advModel.upliftStats && (m[1] in advModel.upliftStats)) continue;
    const v = clamp(PAIR_SCALE * (w[k] / sd), 0, PAIR_MAX);
    if (v >= 4 && !(m[1] in pairBonuses)) pairBonuses[m[1]] = Math.round(v * 10) / 10;
  }

  // Ability placement priors: signed (a placement that correlates with
  // LOSING should genuinely be avoided).
  const abilityPriors = Object.create(null);
  for (const k of keep) {
    const m = /^ab:(.+)$/.exec(k);
    if (!m) continue;
    const v = clamp(ABILITY_SCALE * (w[k] / sd), ABILITY_MIN, ABILITY_MAX);
    if (Math.abs(v) >= 8) abilityPriors[m[1]] = Math.round(v * 10) / 10;
  }

  // Revive context: "Card→Hero" (identity) und "Card→ability:X"
  // (was der Wiederbelebte casten kann). Getrennt exportiert, damit die
  // Laufzeit den Bonus situativ nur auf tatsächlich besiegte Helden mit
  // ihren tatsächlichen Ability-Stacks anwenden kann.
  // Equip-Platzierungs-Priors: (Equip @ Held), Semantik und Skala
  // identisch zu den abilityPriors — signiert, damit nachweislich
  // schlechte Platzierungen aktiv gemieden werden.
  const equipPriors = Object.create(null);
  for (const k of keep) {
    const m = /^eqp:(.+)$/.exec(k);
    if (!m) continue;
    const v = clamp(ABILITY_SCALE * (w[k] / sd), ABILITY_MIN, ABILITY_MAX);
    if (Math.abs(v) >= 8) equipPriors[m[1]] = Math.round(v * 10) / 10;
  }

  // Lock-Ordering-Gewichte: "Karte|lockTyp@heldBucket". Negativ =
  // Ausspielen in diesem Kontext korreliert mit Niederlagen (Boomerang
  // mit 3+ Artefakten auf der Hand) → Laufzeit erhöht die Gate-Schwelle.
  const lockPenalties = Object.create(null);
  for (const k of keep) {
    const m = /^lk:(.+)$/.exec(k);
    if (!m) continue;
    const v = clamp(LOCK_SCALE * (w[k] / sd), LOCK_MIN, LOCK_MAX);
    if (Math.abs(v) >= 3) lockPenalties[m[1]] = Math.round(v * 10) / 10;
  }

  const reviveTargets = Object.create(null);
  const reviveAbilities = Object.create(null);
  for (const k of keep) {
    const m = /^rev:(.+)$/.exec(k);
    if (!m) continue;
    const v = clamp(REVIVE_SCALE * (w[k] / sd), REVIVE_MIN, REVIVE_MAX);
    if (Math.abs(v) < 3) continue;
    const key = m[1];
    if (key.includes('→ability:')) reviveAbilities[key.replace('→ability:', '→')] = Math.round(v * 10) / 10;
    else reviveTargets[key] = Math.round(v * 10) / 10;
  }

  // Hero trio for runtime matching — taken from the ability keys' hero
  // side plus a heroes field the batch runner stamps on every record.
  const heroes = games[0].heroes || [];

  // ── Starthand-Werte (Mulligan-Lernkanal) ──────────────────────────
  // Pro Karte: Winrate der Spiele, in denen sie in der FINALEN Starthand
  // lag (nach Mulligan), minus Baseline — in Prozentpunkten, geclippt
  // auf ±20, Support-Filter n ≥ 15. Records ohne startHand-Stempel
  // (Alt-Sammlungen) werden übersprungen. Zusätzlich mulliganStats als
  // Diagnose: Wie oft wurde gemullt, und wie liefen Keep vs Mulligan?
  const shGames = games.filter(g => Array.isArray(g.startHand) && g.startHand.length > 0);
  const startHandValues = Object.create(null);
  let mulliganStats = null;
  if (shGames.length >= 30) {
    const shBaseline = shGames.reduce((s2, g) => s2 + g.outcome, 0) / shGames.length;
    const perCard = Object.create(null);
    for (const g of shGames) {
      for (const name of new Set(g.startHand)) {
        const e = perCard[name] || { n: 0, w: 0 };
        e.n++; e.w += g.outcome;
        perCard[name] = e;
      }
    }
    for (const [name, e] of Object.entries(perCard)) {
      if (e.n < 15) continue;
      const delta = 100 * (e.w / e.n - shBaseline);
      const clipped = Math.max(-20, Math.min(20, delta));
      if (Math.abs(clipped) >= 1) startHandValues[name] = Math.round(clipped * 10) / 10;
    }
    const mulled = shGames.filter(g => g.mulliganed === 1);
    const kept = shGames.filter(g => g.mulliganed === 0);
    mulliganStats = {
      games: shGames.length,
      mullRate: Math.round(1000 * mulled.length / shGames.length) / 10 + '%',
      winAfterMull: mulled.length ? Math.round(1000 * mulled.reduce((s2, g) => s2 + g.outcome, 0) / mulled.length) / 10 + '%' : null,
      winAfterKeep: kept.length ? Math.round(1000 * kept.reduce((s2, g) => s2 + g.outcome, 0) / kept.length) / 10 + '%' : null,
    };
    console.log(`Starthand-Kanal: ${shGames.length} Records, ${Object.keys(startHandValues).length} Kartenwerte, Mulligan-Rate ${mulliganStats.mullRate}`);
  } else {
    console.log(`Starthand-Kanal: nur ${shGames.length} Records mit startHand (< 30) — übersprungen`);
  }

  // ── Hero-Effekt-Timing ─────────────────────────────────────────────
  // Pro "Held@hand:Bucket": Winrate der Spiele mit ≥1 solcher
  // Aktivierung minus Baseline. Lehrt z. B. "Kazena bei 0-1 Handkarten
  // aktiviert korreliert mit Sieg, bei 4+ mit Niederlage" — als Prior,
  // nicht als Verbot: Nischen-Timings bleiben MCTS-entscheidbar.
  const heroEffectTiming = Object.create(null);
  {
    const perKey = Object.create(null);
    let anyHE = 0;
    for (const g of games) {
      const he = g.heroEffects;
      if (!he || typeof he !== 'object') continue;
      anyHE++;
      for (const key of Object.keys(he)) {
        const e = perKey[key] || { n: 0, w: 0 };
        e.n++; e.w += g.outcome;
        perKey[key] = e;
      }
    }
    if (anyHE >= 30) {
      const base = wins / games.length;
      for (const [key, e] of Object.entries(perKey)) {
        if (e.n < 15) continue;
        const delta = Math.max(-15, Math.min(15, 100 * (e.w / e.n - base)));
        if (Math.abs(delta) >= 2) heroEffectTiming[key] = Math.round(delta * 10) / 10;
      }
      console.log(`Hero-Effekt-Timing: ${anyHE} Records, ${Object.keys(heroEffectTiming).length} Schlüssel`);
    } else {
      console.log(`Hero-Effekt-Timing: nur ${anyHE} Records mit heroEffects (< 30) — übersprungen`);
    }
  }

  // ── Board-Paare (Same-Hero-Synergien) ──────────────────────────────
  // Kontrast: Winrate(beide auf DEMSELBEN Helden) minus Winrate(beide
  // gelegt, aber GETRENNT). Gleiche Karten, gleicher Spielkontext —
  // nur die Ko-Lokation unterscheidet sich. Das filtert "beide Karten
  // sind halt gut" heraus und lässt echte Interaktionen (Shield of
  // Life + Lifeforce Howitzer) übrig. Fallback ohne genug Split-Daten:
  // gedämpftes Delta gegen die Baseline (schwächerer Beleg).
  const boardPairs = Object.create(null);
  {
    const same = Object.create(null);
    const split = Object.create(null);
    let anyBP = 0;
    for (const g of games) {
      if (!g.boardPairsSame && !g.boardPairsSplit) continue;
      anyBP++;
      for (const key of Object.keys(g.boardPairsSame || {})) {
        const e = same[key] || { n: 0, w: 0 };
        e.n++; e.w += g.outcome; same[key] = e;
      }
      for (const key of Object.keys(g.boardPairsSplit || {})) {
        const e = split[key] || { n: 0, w: 0 };
        e.n++; e.w += g.outcome; split[key] = e;
      }
    }
    if (anyBP >= 30) {
      const base = wins / games.length;
      for (const [key, es] of Object.entries(same)) {
        const ex = split[key];
        let delta = null, se = null;
        const pv = (e) => e.w / e.n;
        const varTerm = (e) => { const q = pv(e); return (q * (1 - q)) / e.n; };
        if (es.n >= 10 && ex && ex.n >= 8) {
          delta = 100 * (pv(es) - pv(ex));
          se = 100 * Math.sqrt(varTerm(es) + varTerm(ex));
        } else if (es.n >= 20) {
          delta = 100 * (pv(es) - base) * 0.6; // gedämpfter Fallback
          se = 100 * Math.sqrt(varTerm(es)) * 0.6;
        }
        if (delta == null) continue;
        // Signifikanz-Gate statt Festschwelle: Bei kleinen Stichproben
        // ist der Same-vs-Split-Kontrast stark verrauscht (zwei kleine
        // Gruppen). Nur Paare behalten, deren Delta mindestens 1,65
        // Standardfehler groß ist (~90 %-Konfidenz) — im Synthetik-Test
        // rutschte ein reines Zufallspaar sonst mit +13,5 durch.
        if (Math.abs(delta) < Math.max(3, 1.65 * se)) continue;
        delta = Math.max(-15, Math.min(15, delta));
        boardPairs[key] = Math.round(delta * 10) / 10;
      }
      console.log(`Board-Paare: ${anyBP} Records, ${Object.keys(boardPairs).length} gelernte Paare`);
    } else {
      console.log(`Board-Paare: nur ${anyBP} Records mit Snapshot (< 30) — übersprungen`);
    }
  }

  // ── Protection-Lernkanal: WANN lohnt Negieren/Umleiten? ──────────
  // Records liefern protectionDecisions = [{card, ratio, lethal,
  // confirmed}] aus 50/50-Explorationsspielen. Pro Karte werden beide
  // Arme (confirm/decline) in Kontext-Buckets gegen den Spielausgang
  // regressiert; gelernt wird die kleinste Ratio-Schwelle, ab der
  // Confirm gewinnt, plus die Lethal-Entscheidung. Gates: n≥8 je Arm
  // pro Bucket, Δ≥3pp — sonst keine Regel (Runtime-Default: accept).
  const protectionRules = Object.create(null);
  {
    const BUCKETS = [
      { key: 'lethal', test: e => e.lethal },
      { key: 'r50', min: 0.5, test: e => !e.lethal && e.ratio >= 0.5 },
      { key: 'r25', min: 0.25, test: e => !e.lethal && e.ratio >= 0.25 && e.ratio < 0.5 },
      { key: 'r00', min: 0, test: e => !e.lethal && e.ratio < 0.25 },
    ];
    const perCard = Object.create(null);
    for (const g of games) {
      for (const e of (g.protectionDecisions || [])) {
        const pc = (perCard[e.card] = perCard[e.card] || {});
        for (const b of BUCKETS) {
          if (!b.test(e)) continue;
          const cell = (pc[b.key] = pc[b.key] || { cW: 0, cN: 0, dW: 0, dN: 0 });
          if (e.confirmed) { cell.cN++; cell.cW += g.outcome; }
          else { cell.dN++; cell.dW += g.outcome; }
        }
      }
    }
    for (const [card, pc] of Object.entries(perCard)) {
      const rule = {};
      const armWR = (cell) => ({ c: cell.cN ? cell.cW / cell.cN : null, d: cell.dN ? cell.dW / cell.dN : null });
      const L = pc.lethal;
      if (L && L.cN >= 8 && L.dN >= 8) {
        const { c, d } = armWR(L);
        if (d - c >= 0.03) rule.lethalConfirm = false; // selten, aber möglich
      }
      // kleinste Ratio-Schwelle, ab der confirm signifikant besser ist
      let threshold = null;
      for (const b of BUCKETS.filter(x => x.key !== 'lethal').sort((a, z) => a.min - z.min)) {
        const cell = pc[b.key];
        if (!cell || cell.cN < 8 || cell.dN < 8) continue;
        const { c, d } = armWR(cell);
        if (c - d >= 0.03) { threshold = b.min; break; }
        if (d - c >= 0.03) threshold = Math.max(threshold ?? 0, b.min + 0.25);
      }
      if (threshold !== null || rule.lethalConfirm === false) {
        rule.ratioThreshold = threshold !== null ? threshold : 0;
        protectionRules[card] = rule;
      }
    }
  }

  // ── Game-Start-Pick-Kanal: WR-Delta je Pick (marginal) ──────────
  // Baseline = WR aller Spiele, in denen die Quell-Karte überhaupt
  // entschied. Gates: ≥20 Spiele je Quell-Karte, n≥8 je Pick, |Δ|≥3pp.
  const gameStartPicks = Object.create(null);
  {
    const perSource = Object.create(null);
    for (const g of games) {
      const seen = new Set();
      for (const e of (g.gameStartPicks || [])) {
        const src = (perSource[e.card] = perSource[e.card] || { w: 0, n: 0, byPick: Object.create(null) });
        if (!seen.has(e.card)) { src.n++; src.w += g.outcome; seen.add(e.card); }
        for (const name of (e.picks || [])) {
          const c = (src.byPick[name] = src.byPick[name] || { w: 0, n: 0 });
          c.n++; c.w += g.outcome;
        }
      }
    }
    for (const [card, src] of Object.entries(perSource)) {
      if (src.n < 20) continue;
      const base = src.w / src.n;
      const values = Object.create(null);
      for (const [name, c] of Object.entries(src.byPick)) {
        if (c.n < 8) continue;
        const d = c.w / c.n - base;
        if (Math.abs(d) >= 0.03) values[name] = Math.round(d * 1000) / 1000;
      }
      if (Object.keys(values).length) {
        gameStartPicks[card] = { baseline: Math.round(base * 1000) / 1000, n: src.n, values };
      }
    }
  }

  const profile = {
    deck: deckName,
    heroes,
    games: games.length,
    trainWinRate: Math.round(1000 * wins / games.length) / 10 + '%',
    trainedAt: new Date().toISOString(),
    meanTurns: Math.round(meanTurns * 10) / 10,
    cardValues,
    timing,
    pairBonuses,
    // Cluster-konditionale Wert-Deltas (additiv auf cardValues, wenn
    // der Live-Fingerprint des Gegners ab ~Zug 5 einen Cluster erkennt).
    cardValueDeltasByCluster: (advModel && advModel.clusterDeltas && Object.keys(advModel.clusterDeltas).length > 0)
      ? advModel.clusterDeltas : undefined,
    // Held×Karte-Wertversätze (Ida/Avalanche-Kanal) — konsumiert von
    // _deck-profile.casterDelta über den präsumtiven Caster.
    casterDeltas: (advModel && advModel.casterDeltas && Object.keys(advModel.casterDeltas).length > 0)
      ? advModel.casterDeltas : undefined,
    // Lage-konditionale Wertversätze (Comeback-Kanal) + Bucket-Schwelle
    // in evaluateState-Punkten — die Laufzeit bucketet mit derselben
    // Metrik (siehe _deck-profile.standingBucketFromEval).
    cardValueDeltasByStanding: (advModel && advModel.standingDeltas && Object.keys(advModel.standingDeltas).length > 0)
      ? advModel.standingDeltas : undefined,
    standingEvalThreshold: (advModel && advModel.standingDeltas && Object.keys(advModel.standingDeltas).length > 0
      && typeof advModel.standingEvalThreshold === 'number')
      ? advModel.standingEvalThreshold : undefined,
    // Deckout-Guard: Malus-Karten im Danger-Bereich + gelernte
    // Danger-Schwelle (Restdeck-Größe) — konsumiert von
    // _deck-profile.deckoutGuard, nur aktiv wenn eigenes Deck ≤ Schwelle.
    deckoutGuard: (advModel && advModel.deckoutGuard && Object.keys(advModel.deckoutGuard).length > 0)
      ? advModel.deckoutGuard : undefined,
    deckoutDangerSize: (advModel && advModel.deckoutGuard && Object.keys(advModel.deckoutGuard).length > 0
      && typeof advModel.deckoutDangerSize === 'number')
      ? advModel.deckoutDangerSize : undefined,
    // Menü-Angebotsregeln (Zi/Lamp/Crestina): Quelle→Karte-Wert fürs
    // Komponieren der 3er-Menüs, konsumiert in der cardGalleryMulti-
    // Auswahl (_cpu.js) via _deck-profile.menuOfferRule.
    menuOfferRules: (advModel && advModel.menuOfferRules && Object.keys(advModel.menuOfferRules).length > 0)
      ? advModel.menuOfferRules : undefined,
    menuOfferRulesByCluster: (advModel && advModel.menuOfferByCluster && Object.keys(advModel.menuOfferByCluster).length > 0)
      ? advModel.menuOfferByCluster : undefined,
    menuOfferRulesByStanding: (advModel && advModel.menuOfferByStanding && Object.keys(advModel.menuOfferByStanding).length > 0)
      ? advModel.menuOfferByStanding : undefined,
    // Gelernte Zielklassen-Gewichte je Karte (Target-Prior-Kanal).
    targetPriors: (advModel && advModel.targetPriors && Object.keys(advModel.targetPriors).length > 0)
      ? advModel.targetPriors : undefined,
    // Gelernte Surprise-Fire/Hold-Regeln je Karte und turnBucket.
    surpriseRules: (advModel && advModel.surpriseRules && Object.keys(advModel.surpriseRules).length > 0)
      ? advModel.surpriseRules : undefined,
    reactionRules: (advModel && advModel.reactionRules && Object.keys(advModel.reactionRules).length > 0)
      ? advModel.reactionRules : undefined,
    impactWeights: (advModel && advModel.impactWeights) ? advModel.impactWeights : undefined,
    impactRules: (advModel && advModel.impactRules && Object.keys(advModel.impactRules).length > 0)
      ? advModel.impactRules : undefined,
    // Gelernte Status-Heilungs-Kontextregeln je Karte.
    statusHealRules: (advModel && advModel.statusHealRules && Object.keys(advModel.statusHealRules).length > 0)
      ? advModel.statusHealRules : undefined,
    // Gelernte Support-Zonen-Ökonomie (Placement-Kanal).
    placementRules: (advModel && advModel.placementRules && Object.keys(advModel.placementRules).length > 0)
      ? advModel.placementRules : undefined,
    // Ketten-Kanal (Opfer-Wahl beim Swap + Vorzug erfüllbarer Opfer-Karten)
    bounceRules: (advModel && advModel.bounceRules && Object.keys(advModel.bounceRules).length > 0)
      ? advModel.bounceRules : undefined,
    playOrderRules: (advModel && advModel.playOrderRules && Object.keys(advModel.playOrderRules).length > 0)
      ? advModel.playOrderRules : undefined,
    // Gelernte Tutor-/Such-Präferenzen (Quelle→Karte).
    tutorPickRules: (advModel && advModel.tutorPickRules && Object.keys(advModel.tutorPickRules).length > 0)
      ? advModel.tutorPickRules : undefined,
    abilityPriors,
    equipPriors,
    lockPenalties,
    reviveTargets,
    reviveAbilities,
    startHandValues,
    mulliganStats,
    heroEffectTiming,
    boardPairs,
    protectionRules,
    gameStartPicks,
  };

  const slug = deckName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const outDir = path.join(__dirname, '..', 'data', 'cpu-profiles');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.json`);
  // Atomares Schreiben (tmp + rename): Bei PARALLELEN Trainings-Batches
  // (mehrere Decks gleichzeitig) lädt der startende Sammelprozess von
  // Batch B alle Profile, während Batch A seines schreibt —
  // writeFileSync ist nicht atomar, ein Reader könnte halbe JSON sehen.
  // rename() ist auf demselben Volume atomar: Reader sehen entweder das
  // alte oder das fertige neue Profil, nie einen Zwischenstand.
  const tmpPath = outPath + '.tmp-' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2), { encoding: 'utf-8' });
  fs.renameSync(tmpPath, outPath);

  // ── Karten-Einsatz-Report ──
  // Welche Deck-Karten wurden über den GESAMTEN Datensatz nie oder in
  // unter 5% der Spiele eingesetzt? Tote Slots sind das direkteste
  // Deckbau-Feedback, das Trainingsdaten hergeben — und ohne die
  // Soll-Liste (deckPool aus dem Recorder) prinzipiell unsichtbar.
  {
    const poolGame = games.find(g => Array.isArray(g.deckPool) && g.deckPool.length > 0);
    if (!poolGame) {
      console.log('\nKarten-Einsatz-Report: Datensatz enthält keinen deckPool (ältere Recorder-Version) — übersprungen.');
    } else {
      const pool = poolGame.deckPool;
      const gamesWith = Object.create(null);
      for (const g of games) {
        for (const [name, b] of Object.entries(g.plays || {})) {
          if (((b.early || 0) + (b.mid || 0) + (b.late || 0)) > 0) gamesWith[name] = (gamesWith[name] || 0) + 1;
        }
      }
      const never = pool.filter(n => !gamesWith[n]);
      const rare = pool.filter(n => gamesWith[n] && gamesWith[n] / games.length < 0.05)
        .sort((a, b) => gamesWith[a] - gamesWith[b]);
      console.log(`\n═══ Karten-Einsatz-Report (${games.length} Spiele) ═══`);
      // Vollständige Nutzungsraten, absteigend — auf einen Blick: Träger
      // oben, tote Slots unten.
      const rated = pool.map(n => [n, gamesWith[n] || 0]).sort((a, b) => b[1] - a[1]);
      // Als Auftrag: hinter jeder Karte zusätzlich (a) WR der Spiele, in
      // denen sie gespielt wurde, und (b) die Häufigkeits-Verteilung
      // ("1× in 100 Spielen, 2× in 26, 3× in 12 …"). Multiplicität aus
      // playEvents (exakt); Fallback auf die plays-Buckets, wenn ein
      // Record keine playEvents trägt.
      const winsWith = Object.create(null);
      const multi = Object.create(null);   // name → {anzahl → spiele}
      for (const g of games) {
        const counts = Object.create(null);
        if (Array.isArray(g.playEvents) && g.playEvents.length) {
          for (const e of g.playEvents) if (e && e.n) counts[e.n] = (counts[e.n] || 0) + 1;
        } else {
          for (const [name, b] of Object.entries(g.plays || {})) {
            const k = (b.early || 0) + (b.mid || 0) + (b.late || 0);
            if (k > 0) counts[name] = k;
          }
        }
        for (const [name, k] of Object.entries(counts)) {
          if (g.outcome === 1) winsWith[name] = (winsWith[name] || 0) + 1;
          const m = multi[name] = multi[name] || Object.create(null);
          m[k] = (m[k] || 0) + 1;
        }
      }
      for (const [n, c] of rated) {
        const pct = (100 * c / games.length).toFixed(0).padStart(3);
        let extra = '';
        if (c > 0) {
          const wr = (100 * (winsWith[n] || 0) / c).toFixed(0);
          const dist = Object.entries(multi[n] || {})
            .sort((a, b) => (+a[0]) - (+b[0]))
            .slice(0, 6)
            .map(([k, v]) => `${k}×:${v}`)
            .join(' ');
          extra = `  | WR ${wr}%  | ${dist}`;
        }
        console.log(`  ${pct}%  ${n} (${c}/${games.length})${extra}`);
      }
      // ── Bounce-Swap-Report (Als Auftrag: "gesamte Bounce-Historie") ──
      // Speist sich aus dem bounces-Feld des Recorders (= exakt das
      // onCardsReturnedToHand-Signal, das Siphems Counter füttert).
      // "Spiele ohne einen einzigen Bounce" ist die Red-Flag-Zahl: der
      // Swap-Motor lief dort das ganze Spiel nicht.
      {
        const withField = games.filter(g => Array.isArray(g.bounces));
        if (withField.length) {
          const totals = withField.map(g => g.bounces.reduce((a, b) => a + (b.c?.length || 0), 0));
          const zero = totals.filter(t => t === 0).length;
          const sum = totals.reduce((a, b) => a + b, 0);
          const perTurn = withField.map((g, i) => totals[i] / Math.max(1, g.turns || 1));
          const avg = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
          console.log(`  — Bounce-Swaps (${withField.length} Spiele mit Historie):`);
          console.log(`    gesamt ${sum} | Ø ${avg(totals).toFixed(1)}/Spiel | Ø ${avg(perTurn).toFixed(2)}/Zug`);
          const zPct = (100 * zero / withField.length).toFixed(0);
          console.log(`    Spiele OHNE einen einzigen Bounce: ${zero} (${zPct}%)${zero / withField.length > 0.25 ? '  ⚠️ Swap-Motor läuft in vielen Spielen nie an' : ''}`);
          const byCard = Object.create(null);
          for (const g of withField) for (const b of g.bounces) for (const cn of (b.c || [])) byCard[cn] = (byCard[cn] || 0) + 1;
          const top = Object.entries(byCard).sort((a, b) => b[1] - a[1]).slice(0, 6);
          if (top.length) console.log('    meistgebounced: ' + top.map(([n, v]) => `${n} ${v}×`).join(', '));
          const wrZero = withField.filter((g, i) => totals[i] === 0);
          const wrSome = withField.filter((g, i) => totals[i] > 0);
          const wr = (arr) => arr.length ? (100 * arr.reduce((a, g) => a + g.outcome, 0) / arr.length).toFixed(0) : '—';
          console.log(`    WR mit Bounces: ${wr(wrSome)}% | ohne: ${wr(wrZero)}%`);
        }
      }
      // ── Hand-Ökonomie-Report (Als Auftrag: Gold, Handgröße,
      // Spielbarkeit, Deepsea-Kreaturen — vor allem in Swap-losen
      // Spielen; Hypothese Handkarten-Hunger) ──
      {
        const withEcon = games.filter(g => Array.isArray(g.turnEconomy) && g.turnEconomy.length);
        if (withEcon.length) {
          const bounceCnt = g => (g.bounces || []).reduce((a, b) => a + (b.c?.length || 0), 0);
          const buckets = [[1, 4, 'T1-4'], [5, 9, 'T5-9'], [10, 99, 'T10+']];
          const line = (gs, label) => {
            if (!gs.length) return;
            const cells = buckets.map(([lo, hi, name]) => {
              const snaps = [];
              for (const g of gs) for (const e of g.turnEconomy) if (e.t >= lo && e.t <= hi) snaps.push(e);
              if (!snaps.length) return `${name}: —`;
              const m = (k) => (snaps.reduce((a, e) => a + (e[k] || 0), 0) / snaps.length).toFixed(1);
              return `${name}: Hand ${m('h')} (spielbar ${m('pl')}, DS ${m('ds')}, Gold ${m('g')})`;
            });
            // Als Korrektur: Hand ≤1 ist NICHT die ganze Antwort — die
            // Hand kann voller momentan nutzloser Karten stecken (Coffee)
            // und trotzdem null RELEVANTE tragen. Deshalb drei Quoten:
            // Topdeck (leer), nichts spielbar (pl=0 trotz Karten), und
            // motor-trocken (keine Bounce-Linien-Kreatur, ds=0).
            let topdeck = 0, dead = 0, dry = 0, own = 0;
            for (const g of gs) for (const e of g.turnEconomy) {
              own++;
              if ((e.h || 0) <= 1) topdeck++;
              if ((e.pl || 0) === 0 && (e.h || 0) > 0) dead++;
              if ((e.ds || 0) === 0) dry++;
            }
            const pc = (n) => (100 * n / Math.max(1, own)).toFixed(0) + '%';
            const anyDs = gs.some(g => g.turnEconomy.some(e => (e.ds || 0) > 0));
            console.log(`    ${label} (${gs.length}): ${cells.join(' | ')}`);
            console.log(`      Züge: Topdeck (Hand ≤1) ${pc(topdeck)} | Hand voll aber nichts spielbar ${pc(dead)}${anyDs ? ` | ohne Bounce-Linien-Kreatur ${pc(dry)}` : ''}`);
          };
          console.log('  — Hand-Ökonomie (Zugbeginn, eigene Züge):');
          const hasBounceData = withEcon.some(g => Array.isArray(g.bounces));
          if (hasBounceData) {
            line(withEcon.filter(g => bounceCnt(g) === 0), 'ohne Bounces');
            line(withEcon.filter(g => bounceCnt(g) > 0), 'mit Bounces ');
          } else {
            line(withEcon, 'alle Spiele');
          }
        }
      }
      // ── T5: HANDKARTENFLUSS (31.7.) ──────────────────────────────
      // Beantwortet die nach v117 offene Frage: läuft die Hand leer,
      // weil zu WENIG hereinkommt, oder weil zu viel wieder RAUSGEHT?
      // Grundlage sind die kumulativen Zähler in turnDiag[].hf; die
      // Differenz zweier aufeinanderfolgender Einträge ist der Fluss
      // einer vollen Runde (eigener Zug + Gegnerzug).
      {
        const flowGames = games.filter(g => Array.isArray(g.turnDiag)
          && g.turnDiag.length >= 2 && g.turnDiag[0] && g.turnDiag[0].hf);
        if (flowGames.length > 0) {
          const K = ['dw', 'se', 'ah', 'st', 'di'];
          const LBL = { dw: 'gezogen', se: 'gesucht', ah: 'zugefügt', st: 'gestohlen', di: 'abgeworfen' };
          const per = [];   // je Runden-Index: Summen
          const hand = [];  // je Zug-Index: Handgröße zu Zugbeginn
          for (const g of flowGames) {
            const td = g.turnDiag;
            const playsAt = Object.create(null);
            for (const e of (g.playEvents || [])) playsAt[e.t] = (playsAt[e.t] || 0) + 1;
            for (let i = 0; i < td.length; i++) {
              (hand[i] = hand[i] || []).push(td[i].hn || 0);
              if (i + 1 >= td.length || !td[i + 1] || !td[i + 1].hf) continue;
              const d = {};
              for (const k of K) d[k] = (td[i + 1].hf[k] || 0) - (td[i].hf[k] || 0);
              d.pl = playsAt[td[i].t] || 0;
              d.dh = (td[i + 1].hn || 0) - (td[i].hn || 0);
              (per[i] = per[i] || []).push(d);
            }
          }
          const avg = (arr, f) => arr.length ? arr.reduce((a, b) => a + f(b), 0) / arr.length : 0;
          console.log(`  — Handkartenfluss je Runde (${flowGames.length} Spiele):`);
          console.log('    Zug | Hand | gezogen gesucht zugef. gestohl. | Plays Abwürfe | ΔHand | Rest');
          let sumIn = 0, sumOut = 0, sumRest = 0, rows = 0;
          for (let i = 0; i < Math.min(per.length, 8); i++) {
            const p = per[i]; if (!p || !p.length) continue;
            const g = k => avg(p, x => x[k]);
            const inflow = K.slice(0, 4).reduce((a, k) => a + g(k), 0);
            // Erwartete Handänderung = Zufluss − Plays − Abwürfe.
            // Rest = erwartet − tatsächlich; ≠0 heißt: es gibt einen
            // Handkarten-Pfad, den diese Zähler nicht sehen.
            const rest = inflow - g('pl') - g('di') - g('dh');
            sumIn += inflow; sumOut += g('pl') + g('di'); sumRest += rest; rows++;
            console.log(`    ${String(i + 1).padStart(3)} | ${avg(hand[i] || [], x => x).toFixed(2).padStart(4)} |`
              + `${g('dw').toFixed(2).padStart(8)}${g('se').toFixed(2).padStart(8)}${g('ah').toFixed(2).padStart(7)}${g('st').toFixed(2).padStart(9)} |`
              + `${g('pl').toFixed(2).padStart(6)}${g('di').toFixed(2).padStart(8)} |`
              + `${g('dh').toFixed(2).padStart(6)} |${rest.toFixed(2).padStart(6)}`);
          }
          if (rows > 0) {
            const inA = sumIn / rows, outA = sumOut / rows, restA = sumRest / rows;
            console.log(`    Ø Zufluss ${inA.toFixed(2)} vs Ø Abfluss ${outA.toFixed(2)} (Plays+Abwürfe), Rest ${restA.toFixed(2)}`);
            if (inA < outA - 0.15) console.log('    → ZUFLUSS ist die Schranke: es kommt weniger herein als hinausgeht.');
            else if (outA < inA - 0.15) console.log('    → ABFLUSS ist geringer als der Zufluss — die Hand müsste wachsen; prüfe den Rest-Term.');
            else console.log('    → Zu- und Abfluss sind im Gleichgewicht; die Hand ist stabil, aber klein.');
            if (Math.abs(restA) > 0.25) {
              console.log(`    ⚠️ Rest-Term ${restA.toFixed(2)} je Runde — ein nicht gezählter Handkarten-Pfad `
                + '(Hand-Limit am Zugende, Delete-Kosten, Doppelzählung eines Suchpfads).');
            }
          }
        }
      }
      // ── Aktiveffekt-Report ──
      // Karten mit aktivierbarem Effekt: Wie oft feuert er wirklich?
      // "Nie aktiviert trotz gespielt" ist die Slippery-Ice-Klasse —
      // toter Effekt ODER CPU-Gap, beides prüfenswert.
      {
        const actGame = games.find(g => Array.isArray(g.activatablePool) && g.activatablePool.length > 0);
        if (actGame) {
          const actWith = Object.create(null);
          for (const g of games) {
            for (const [n, c] of Object.entries(g.activations || {})) {
              if (c > 0) actWith[n] = (actWith[n] || 0) + 1;
            }
          }
          console.log(`  — Aktiveffekte (${actGame.activatablePool.length} Karten im Pool):`);
          for (const n of actGame.activatablePool) {
            const a = actWith[n] || 0;
            const p = gamesWith[n] || 0;
            const pct = (100 * a / games.length).toFixed(0).padStart(3);
            const flag = (a === 0 && p > 0) ? '  ⚠️ NIE AKTIVIERT (aber in ' + p + ' Spielen gespielt)'
              : (a === 0 ? '  (nie gespielt)' : '');
            console.log(`  ${pct}%  ${n} — aktiviert in ${a}/${games.length} Spielen${flag}`);
          }
        }
      }
      // Deepsea-Idol-Diagnose: Öffnet das ≥2-Kreaturen-Batch-Fenster real?
      {
        const bw = games.reduce((acc, g) => {
          const b = g.batchWindows;
          if (b) {
            acc.calls += b.calls || 0; acc.ge2 += b.ge2 || 0; acc.own += b.ge2ownPinned || 0; acc.n++;
            for (const [k, v] of Object.entries(b.outcomes || {})) acc.out[k] = (acc.out[k] || 0) + v;
          }
          return acc;
        }, { calls: 0, ge2: 0, own: 0, n: 0, out: {} });
        if (bw.n > 0) {
          console.log(`  Batch-Fenster (Deepsea-Idol-Bedingung): ${bw.calls} Schadens-Batches,`);
          console.log(`    davon ≥2 Kreaturen: ${bw.ge2}, davon ≥2 EIGENE (pinned): ${bw.own}`);
          if (Object.keys(bw.out).length > 0) {
            console.log(`    Fenster-Ausgänge: ${Object.entries(bw.out).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          }
          if (bw.own === 0) console.log('    → Die Idol-Bedingung trat NIE ein — die Karte ist im aktuellen Meta strukturell tot.');
        }
      }
      if (never.length === 0 && rare.length === 0) {
        console.log('  → Alle Deck-Karten wurden in ≥5% der Spiele eingesetzt.');
      } else {
        // Verfügbarkeit (Artifact-Pass-Picks): trennt "nie MÖGLICH"
        // von "möglich, aber vom Gate/Piloten abgelehnt".
        const pickGames = Object.create(null);
        for (const g of games) {
          for (const n of Object.keys(g.artifactPicks || {})) pickGames[n] = (pickGames[n] || 0) + 1;
        }
        const avail = n => pickGames[n] !== undefined
          ? ` — als Artifact-Pick verfügbar in ${pickGames[n]} Spielen`
          : '';
        if (never.length > 0) {
          console.log(`  NIE eingesetzt (${never.length}):`);
          for (const n of never) console.log(`    - ${n}${avail(n)}`);
        }
        if (rare.length > 0) {
          console.log(`  Unter 5% der Spiele (${rare.length}):`);
          for (const n of rare) console.log(`    - ${n} (${gamesWith[n]}/${games.length})${avail(n)}`);
        }
        console.log('  Hinweis: Nie/selten gespielte Karten sind entweder tote Slots ODER');
        console.log('  vom Piloten nicht verstanden (vgl. Slippery-Ice-Klasse) — beides prüfenswert.');
        console.log('  ("verfügbar in N Spielen" = kam trotz Gold-/Bedingungs-Checks als Pick an;');
        console.log('   fehlt die Angabe, war die Karte NIE spielbar — Bedingung/Ökonomie prüfen.)');
      }
    }
  }

  console.log(`\n═══ Profile written → ${outPath} ═══`);
  console.log('Top cards by learned value:');
  Object.entries(cardValues).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([nm, v]) => console.log(`  ${String(v).padStart(6)}  ${nm}  ${timing[nm] ? JSON.stringify(timing[nm]) : ''}`));
  const pairsSorted = Object.entries(pairBonuses).sort((a, b) => b[1] - a[1]);
  console.log(`Combo pairs learned (${pairsSorted.length}):`);
  // Volle Statistik pro Paar mitdrucken (Als Auftrag: Sättigung sichtbar
  // machen): roher Δ, Welch-t, Arm-Größen, Co-Play-Evidenz, Dämpfung.
  // Ein am PAIR_MAX-Clamp klebender Bonus ist damit sofort als solcher
  // erkennbar statt als "+40 überall"-Rätsel.
  pairsSorted.slice(0, 12).forEach(([k, v]) => {
    const s = advModel && advModel.upliftStats ? advModel.upliftStats[k] : null;
    const info = s
      ? `  (Δ=${s.u >= 0 ? '+' : ''}${s.u.toFixed(3)} t=${s.t.toFixed(1)} n=${s.nW}/${s.nO} coPlay=${s.coOcc}×/${s.coGames}Sp${s.damp < 1 ? ` damp=${s.damp.toFixed(2)}` : ''})`
      : '  (Adjazenz-Kanal, Spiel-Modell — keine Uplift-Messung möglich)';
    console.log(`  +${v}  ${k}${info}`);
  });
  console.log('Ability placement priors:');
  Object.entries(abilityPriors).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${v > 0 ? '+' : ''}${v}  ${k}`));
  if (Object.keys(equipPriors).length) {
    console.log('Equip placement priors:');
    Object.entries(equipPriors).sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${v > 0 ? '+' : ''}${v}  ${k}`));
  }
  if (Object.keys(lockPenalties).length) {
    console.log('Lock-Ordering (negativ = in diesem Kontext meiden):');
    Object.entries(lockPenalties).sort((a, b) => a[1] - b[1])
      .forEach(([k, v]) => console.log(`  ${v > 0 ? '+' : ''}${v}  ${k}`));
  }
  const revAll = { ...reviveTargets, ...reviveAbilities };
  if (Object.keys(revAll).length) {
    console.log('Revive context (Identität + castbare Abilities):');
    Object.entries(reviveTargets).sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${v > 0 ? '+' : ''}${v}  ${k}`));
    Object.entries(reviveAbilities).sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${v > 0 ? '+' : ''}${v}  ${k} (pro Level ×⅓)`));
  }
}

main();
