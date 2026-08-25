// ═══════════════════════════════════════════
//  PIXEL PARTIES — LEARNED DECK PROFILES (runtime side)
//  Loads ML-trained per-deck profiles produced by
//  scripts/train-deck-profile.js from data/cpu-profiles/*.json and
//  answers the CPU brain's questions:
//
//    • cardValue(name, turn)      — learned in-hand value of a card
//                                   (drives tutors, discards, the eval's
//                                   hand term, gallery ordering), with a
//                                   timing multiplier per turn bucket.
//    • pairBonus(nameA, nameB)    — learned same-turn combo synergy.
//                                   Used both as "held partner" hand
//                                   bonus and as an eval nudge.
//    • abilityPlacementBonus(ability, heroName)
//                                 — learned prior for WHERE to stack an
//                                   Ability.
//
//  A profile only activates when the CPU's lineup MATCHES the profile's
//  hero trio (order-insensitive). Human opponents never trigger a
//  profile for their side — profiles key off the deck being piloted,
//  never off who's across the table, so the learned knowledge is
//  opponent-agnostic by construction.
//
//  PP_DISABLE_PROFILES=1 turns the whole module into a no-op. Training
//  batches set this so data collection stays on the un-profiled
//  baseline policy (no feedback loop between the profile being learned
//  and the data it's learned from).
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
// ── PROFIL-VERZEICHNIS, UMLENKBAR ─────────────────────────────────
// `PP_PROFILE_DIR` zeigt die Laufzeit auf ein ANDERES Profil-Set.
// Zweck: GEPAARTES Messen. Die 42er-Grundmessung altert mit der Engine
// — mindestens ein Deck hat sich allein durch Engine-Aenderungen um
// 8.7 Punkte bewegt, der Nordstern 61.4 % ist ein historischer Wert.
// A/B-Ergebnisse ueber verschiedene Codestaende sind deshalb NICHT
// vergleichbar, und eine vollstaendige Neumessung kostet rund 61 h.
//
// Die Loesung ist, das Messwerkzeug zu aendern statt die Messung zu
// wiederholen: NEUES Profil gegen ALTES Profil, beide auf DEMSELBEN
// Code, im selben Lauf. Damit ist der Vergleich gegen Engine-Drift
// immun, weil die Drift auf beide Arme gleich wirkt.
//
// Relativ zum Projekt-Root aufgeloest, damit `--vs data/profile-alt`
// aus jedem Arbeitsverzeichnis funktioniert.
const PROFILE_ROOT = path.join(__dirname, '..', '..');
const PROFILE_DIR = process.env.PP_PROFILE_DIR
  ? path.resolve(PROFILE_ROOT, process.env.PP_PROFILE_DIR)
  : path.join(PROFILE_ROOT, 'data', 'cpu-profiles');

// Ein Satz je Verzeichnis. Fuer das gepaarte Messen (`--vs`) muessen
// ZWEI Saetze gleichzeitig im Speicher liegen — einer je Spielseite.
const _profilesByDir = new Map();   // dir -> Map<heroKey, profile>

function heroKeyOf(heroNames) {
  return (heroNames || []).filter(Boolean).slice().sort().join('||');
}

/**
 * ABLATION: einzelne Lernkanäle beim Laden abklemmen.
 *
 *   PP_PROFILE_OFF=tutorPickRules,boardPairs node server.js …
 *
 * Zweck: die Bestandsaufnahme vom 20.8. hat gezeigt, dass die Profile
 * IM MITTEL klar helfen (Spiegel 60.9 % über 42 Decks), aber KEIN
 * Merkmal des Profils sagt vorher, ob ein einzelnes hilft — weder
 * Kanalgrößen noch die Trainings-Winrate (r = −0.06) noch der Anteil
 * geklammerter Gewichte (r = −0.03). Welcher Kanal seinen Beitrag
 * leistet, lässt sich also nicht ansehen, sondern nur MESSEN: Kanal
 * abklemmen, denselben Spiegel-A/B fahren, Differenz ablesen.
 *
 * Ohne die Variable passiert nichts — kein Zweig, keine Kosten.
 * Namen sind die Profil-Felder selbst (`tutorPickRules`,
 * `abilityPriors`, `boardPairs`, …); unbekannte Namen werden gemeldet,
 * damit ein Tippfehler nicht als „Kanal wirkungslos" durchgeht.
 */
let _ablationWarned = false;
let _ablationTreffer = 0;   // wie oft wurde tatsächlich etwas abgeklemmt
function stripDisabledChannels(p, datei) {
  const roh = process.env.PP_PROFILE_OFF;
  if (!roh) return;
  const namen = roh.split(',').map(s => s.trim()).filter(Boolean);
  const entfernt = [];
  const unbekannt = [];
  for (const n of namen) {
    if (!(n in p)) { unbekannt.push(n); continue; }
    delete p[n];
    entfernt.push(n);
  }
  if (entfernt.length) {
    _ablationTreffer++;
    console.log(`[deck-profile] ABLATION "${p.deck}" (${datei}): ${entfernt.join(', ')} abgeklemmt`);
  }
  // Die Warnung nur EINMAL je Lauf — sonst 42 identische Zeilen.
  if (unbekannt.length && !_ablationWarned) {
    _ablationWarned = true;
    console.warn(`[deck-profile] ⚠️  ABLATION: ${unbekannt.join(', ')} steckt nicht in "${p.deck}" (Tippfehler? Oder der Kanal ist für dieses Deck ohnehin leer — dann misst die Ablation NICHTS)`);
  }
}

function loadAllProfiles(dir = PROFILE_DIR) {
  const zwischen = _profilesByDir.get(dir);
  if (zwischen) return zwischen;
  const _profiles = new Map();
  _profilesByDir.set(dir, _profiles);
  if (process.env.PP_DISABLE_PROFILES === '1') return _profiles;
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return _profiles; } // no profile dir → no profiles, fine
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), { encoding: 'utf-8' });
      const p = JSON.parse(raw);
      // Quarantäne (A/B-gated Deployment): Hat dieses Profil seinen
      // Spiegeltest gegen die eigene Baseline klar verloren, richtet es
      // nachweislich Schaden an (gemessen: 1000-Spiele-Butterflies-
      // Profil → 33 % im Spiegel — hochgewichtete, aber konfundierte
      // Werte sabotierten den Deck-Plan). Solche Profile werden nicht
      // geladen; die Heuristik ist dann die bessere Wahl. Override für
      // Experimente: PP_FORCE_PROFILES=1.
      const ab = p.abResult;
      if (process.env.PP_FORCE_PROFILES !== '1'
          && ab && typeof ab.winrate === 'number' && (ab.games || 0) >= 50 && ab.winrate < 0.48) {
        console.warn(`[deck-profile] ⚠️  "${p.deck}" (${f}) QUARANTÄNISIERT — A/B ${(100 * ab.winrate).toFixed(0)}% über ${ab.games} Spiegel-Spiele (${ab.date}); Heuristik bleibt aktiv`);
        continue;
      }
      if (!Array.isArray(p.heroes) || p.heroes.length === 0) continue;
      stripDisabledChannels(p, f);
      _profiles.set(heroKeyOf(p.heroes), p);
      console.log(`[deck-profile] loaded "${p.deck}" (${f}): ${Object.keys(p.cardValues || {}).length} card values, ${Object.keys(p.pairBonuses || {}).length} pairs, ${Object.keys(p.abilityPriors || {}).length} ability priors, trained on ${p.games} games (win-rate ${p.trainWinRate})`);
    } catch (err) {
      console.error(`[deck-profile] failed to load ${f}:`, err.message);
    }
  }
  // ── EICHZEILE (v574) ───────────────────────────────────────────────
  // Läuft IMMER, auch ohne Stellschraube. Sie ist die Nullprobe: ohne
  // sie ist „keine ABLATION-Zeile im Log" nicht von „Log unvollständig"
  // zu unterscheiden. Genau daran ist der Lauf vom 21.8. still
  // gescheitert — 12 Decks × 400 Spiele lang wurde das volle Profil
  // gemessen, weil PP_PROFILE_OFF nie im Prozess ankam.
  console.log(`[deck-profile] Konfiguration: ${_profiles.size} Profile geladen`
    + ` · Ablation: ${process.env.PP_PROFILE_OFF || 'keine'}`
    + ` · conf-cap: ${CONF_CAP}`
    + (process.env.PP_FORCE_PROFILES === '1' ? ' · Quarantäne übersteuert' : ''));
  if (process.env.PP_PROFILE_OFF && _ablationTreffer === 0) {
    console.error('[deck-profile] ⛔ ABLATION ANGEFORDERT, ABER NICHTS ABGEKLEMMT.');
    console.error(`[deck-profile]    Angefordert: ${process.env.PP_PROFILE_OFF}`);
    console.error('[deck-profile]    Kein einziges Profil trug einen dieser Kanäle — der Lauf misst');
    console.error('[deck-profile]    das VOLLE Profil und wäre als Ablation wertlos. Kanalnamen prüfen.');
  }
  return _profiles;
}

/**
 * Resolve the active profile for player `pi` on this engine. Cached per
 * engine per side (lineups never change mid-game). Matches on the hero
 * trio — robust against deck-name drift and independent of whether the
 * deck arrived as a sample deck, user copy, or self-play snapshot.
 */
function profileFor(engine, pi) {
  if (process.env.PP_DISABLE_PROFILES === '1') return null;
  // Seiten-Maske für Spiegel-A/B-Läufe (PP_TRAIN_AB): Im Mirror-Match
  // matcht das Helden-Trio BEIDE Seiten — die Maske beschränkt das
  // Profil auf die designierte Seite, die andere pilotiert mit dem
  // nackten Baseline-Gehirn. Vor dem Cache geprüft; die Maske wird vor
  // Spielstart gesetzt und ändert sich nie, daher bleibt der Cache
  // konsistent.
  if (engine._profileAllowedSide != null && pi !== engine._profileAllowedSide) return null;
  if (!engine._deckProfileCache) engine._deckProfileCache = [undefined, undefined];
  const cached = engine._deckProfileCache[pi];
  if (cached !== undefined) return cached;
  let prof = null;
  try {
    const heroes = engine.gs?.players?.[pi]?.heroes || [];
    // hero.name mutates on Ascension — prefer the pristine base name if
    // the engine stamped one, else current name. Matching happens on the
    // FIRST query of the game (turn 1 hand valuation), long before any
    // Ascension, so current names are reliable in practice.
    const names = heroes.map(h => h?.baseName || h?.name).filter(Boolean);
    // Gepaartes Messen: jede Seite darf aus einem EIGENEN Verzeichnis
    // laden (`engine._profileDirBySide`, gesetzt von server.js aus
    // PP_PROFILE_DIR_A/_B). Damit laufen neues und altes Profil im
    // SELBEN Spiel gegeneinander — dieselbe Engine, dieselbe Startlage,
    // dieselbe Zufallsfolge. Engine-Drift wirkt auf beide Arme gleich
    // und faellt aus dem Vergleich heraus.
    const roh = engine._profileDirBySide?.[pi];
    const dir = roh ? path.resolve(PROFILE_ROOT, roh) : PROFILE_DIR;
    prof = loadAllProfiles(dir).get(heroKeyOf(names)) || null;
  } catch { prof = null; }
  engine._deckProfileCache[pi] = prof;
  return prof;
}

function turnBucket(turn) {
  if (turn <= 4) return 'early';
  if (turn <= 9) return 'mid';
  return 'late';
}

/**
 * Confidence weight by training sample size — the shrinkage factor that
 * decides how much the learned numbers may displace the hand-tuned
 * heuristics. A 100-game profile is mostly noise-with-a-hint-of-signal
 * and gets ~0.25; convergence toward the 0.75 cap needs 1000+ games.
 * Empirically necessary: an unshrunk 107-game profile A/B-tested WORSE
 * than baseline (43.6% vs 61.7%) because inflated hand values threw off
 * evaluateState's hand-vs-board balance.
 */
// Obergrenze des Profil-Gewichts, per Env justierbar (PP_PROFILE_CONF_CAP).
// Befund aus dem 1000-Spiele-Lauf: Mehr Daten senken die VARIANZ der
// gelernten Werte, nicht ihren BIAS (Konfundierung Setup→Payoff). Dasselbe
// Butterflies-Deck maß 57 % Spiegel-Winrate bei Gewicht ~0,25 (98 Spiele)
// und 33 % bei Gewicht 0,75 (1000 Spiele). Für bias-anfällige Plan-Decks
// kann ein niedrigerer Cap (z. B. 0.4) das bessere Regime sein — der
// A/B-Spiegel ist der Schiedsrichter.
const CONF_CAP = (() => {
  const v = parseFloat(process.env.PP_PROFILE_CONF_CAP || '0.75');
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.75;
})();
function confidence(prof) {
  const g = prof?.games || 0;
  return Math.min(CONF_CAP, g / (g + 300));
}

/**
 * Learned hand value for `cardName`, timing-adjusted for the current
 * turn and pre-blended with `fallback` (the caller's heuristic value)
 * by the profile's sample-size confidence. Returns null when no
 * profile applies or the card is unknown to the profile — callers keep
 * their heuristic untouched in that case.
 */
function learnedCardValue(engine, pi, cardName, fallback = 0, gateMult = 1) {
  const prof = profileFor(engine, pi);
  if (!prof) return null;
  const vRaw = prof.cardValues?.[cardName];
  if (typeof vRaw !== 'number') return null;
  const timing = prof.timing?.[cardName];
  const mult = timing ? (timing[turnBucket(engine.gs?.turn || 1)] ?? 1) : 1;
  // Board-abhängige Korrektur (Schadens-Impact-Kanal): additiv VOR dem
  // Timing-Multiplikator, damit sie wie ein korrigierter Grundwert wirkt
  // und nicht vom Zeitfenster wegskaliert wird.
  const impactAdj = impactValueDelta(engine, pi, cardName);
  // gateMult (0..1): situatives Vertrauens-Gate des Aufrufers — z. B.
  // das Castability-Gate aus estimateHandCardValueFor. Die gelernten
  // Werte stammen ausschließlich aus Spielen, in denen die Karte
  // gespielt WURDE (sonst stünde sie nicht im Datensatz) — sie tragen
  // also implizit die Annahme "castbar". Ist die Karte im aktuellen
  // Zustand NICHT castbar (keine passende Schul-Ability auf einem
  // Helden), ist der gelernte Wert schlicht nicht anwendbar und darf
  // die Heuristik (die den Brick korrekt niedrig bewertet) nicht
  // übertönen — sonst tutort die CPU Spells, die zwei Züge lang tote
  // Handkarten sind.
  const w = confidence(prof) * Math.max(0, Math.min(1, gateMult));
  // Cluster-Delta: Hat der Gegner sich per Live-Fingerprint (gezählt in
  // _cpu.js, engine._behaviorFp) als Aggro/Swarm/Spell-Archetyp zu
  // erkennen gegeben, verschiebt das gelernte Delta den Kartenwert —
  // z. B. "Cloud Pillow +12 gegen aggro". Erst ab Zug 5 (vorher ist der
  // Fingerprint Rauschen), confidence-skaliert wie der Grundwert.
  let clusterDelta = 0;
  if (prof.cardValueDeltasByCluster && (engine.gs?.turn || 0) >= 5) {
    const fp = engine._behaviorFp?.[pi === 0 ? 1 : 0];
    const cl = clusterOfFingerprint(fp);
    const d = prof.cardValueDeltasByCluster[cl]?.[cardName];
    if (typeof d === 'number') clusterDelta = d;
  }
  // Standing-Delta (Comeback-Kanal): Verschiebt den Kartenwert nach der
  // EIGENEN Lage (behind/even/ahead). Der Bucket wird NICHT hier
  // berechnet (learnedCardValue läuft innerhalb von evaluateState —
  // eine Eval hier wäre Rekursion), sondern von _cpu.js einmal pro
  // Entscheidung als engine._standingBucket gestempelt; wir lesen nur
  // frische Stempel (gleicher Zug, gleicher Spieler). 'even' ist die
  // Basislinie ohne Versatz.
  let standingDelta = 0;
  const sb = engine._standingBucket;
  if (prof.cardValueDeltasByStanding && sb && sb.pi === pi
      && sb.turn === (engine.gs?.turn || 0) && sb.bucket !== 'even') {
    const d = prof.cardValueDeltasByStanding[sb.bucket]?.[cardName];
    if (typeof d === 'number') standingDelta = d;
    // ── Standing-Floor-Vertrag (Als Gurt zum DDG-Befund) ──
    // Karten-Skripte können cpuStandingDeltaFloor = {behind: X, ...}
    // exportieren: Design-Wissen als Untergrenze gegen fehl-gelernte
    // Lage-Deltas (DDG behind −13.5 bei realer Comeback-WR 20.0% vs
    // 7.3% ohne Cast). max(gelernt, Floor), wie beim Ability-Floor.
    try {
      const fl = require('./_loader').loadCardEffect(cardName)?.cpuStandingDeltaFloor?.[sb.bucket];
      if (typeof fl === 'number') standingDelta = Math.max(standingDelta, fl);
    } catch { /* Floor ist Zusatz, nie Blocker */ }
  }
  const v = vRaw + impactAdj;
  return (1 - w) * fallback + w * ((v + clusterDelta + standingDelta) * mult);
}

/**
 * Bucketet einen evaluateState-Differenzwert in behind/even/ahead mit
 * der im Training gelernten Schwelle (standingEvalThreshold = 0.5 × sd
 * der evalCurve des Trainingsdatensatzes — dieselbe Metrik, dieselbe
 * Skala). Ohne Profil/Schwelle immer 'even' (Kanal inaktiv).
 */
function standingBucketFromEval(engine, pi, evalValue) {
  const prof = profileFor(engine, pi);
  const th = prof?.standingEvalThreshold;
  if (typeof th !== 'number' || th <= 0 || typeof evalValue !== 'number') return 'even';
  return evalValue < -th ? 'behind' : (evalValue > th ? 'ahead' : 'even');
}

/**
 * Sum of learned pair bonuses between `cardName` and every OTHER
 * distinct name in `handArr`, confidence-scaled and CAPPED. This is
 * what makes holding / tutoring the second half of a combo attractive.
 * The cap matters: with several learned partners in hand the raw sum
 * explodes (Fire Bolts with 3 partners = +60 uncapped), inflating the
 * eval's hand term past what the rest of the evaluator was tuned for.
 */
/**
 * Gelernter Held×Karte-Wertversatz (Caster-Delta-Kanal): Wie viel
 * besser/schlechter wirkt `cardName`, wenn genau `heroName` sie castet,
 * verglichen mit den übrigen beobachteten Castern? Trainiert als
 * One-vs-Rest-Kontrast über zentrierte Advantage-Labels (Ida-Befund:
 * Flame Avalanche via Ida ist Single-Target statt AoE — der pauschale
 * cardValue trägt aber den AoE-Wert aus Spielen mit anderen Castern).
 * Confidence-skaliert wie alle Profilkanäle; 0 ohne Messung.
 */
/**
 * Deckout-Guard: Gelernter Malus für Karten, deren Plays im Danger-
 * Bereich (eigenes Restdeck ≤ gelernte Schwelle) mit eigenen Deckout-
 * Losses über-korrelierten — typischerweise Draw-/Self-Mill-Engines.
 * Aktiv NUR, wenn das eigene Deck aktuell ≤ Schwelle ist; Frühspiel
 * bleibt unberührt. Rückgabe ≤ 0, confidence-skaliert.
 */
/** Gelernte Danger-Schwelle (Restdeck-Größe) des Profils, sonst null.
 *  Konsumiert vom Deck-Nähe-Term in evaluateState und vom
 *  Caster-Draw-Kontext in pickHeroForActionCard. */
function deckoutDangerSizeOf(engine, pi) {
  const th = profileFor(engine, pi)?.deckoutDangerSize;
  return typeof th === 'number' && th > 0 ? th : null;
}

function deckoutGuard(engine, pi, cardName) {
  const prof = profileFor(engine, pi);
  const g = prof?.deckoutGuard?.[cardName];
  if (typeof g !== 'number') return 0;
  const th = prof?.deckoutDangerSize;
  if (typeof th !== 'number' || th <= 0) return 0;
  const deckLen = engine.gs?.players?.[pi]?.mainDeck?.length;
  if (typeof deckLen !== 'number' || deckLen > th) return 0;
  return g * confidence(prof);
}

/** Gelernter Angebots-Wert für Menü-Quellen (Zi/Lamp/Crestina):
 *  Quelle→Karte aus menuOfferRules, confidence-skaliert. Misst das
 *  Menü-Design inklusive realem Gegnerverhalten. */
function menuOfferRule(engine, pi, source, cardName) {
  const prof = profileFor(engine, pi);
  if (!prof) return 0;
  const key = `${source}→${cardName}`;
  let v = typeof prof.menuOfferRules?.[key] === 'number' ? prof.menuOfferRules[key] : 0;
  // Situations-Deltas (Als Auftrag): Gegner-Cluster ab Zug 5 (gleiche
  // Semantik wie cardValueDeltasByCluster) + Standing-Stempel.
  if (prof.menuOfferRulesByCluster && (engine.gs?.turn || 0) >= 5) {
    const fp = engine._behaviorFp?.[pi === 0 ? 1 : 0];
    const d = prof.menuOfferRulesByCluster[clusterOfFingerprint(fp)]?.[key];
    if (typeof d === 'number') v += d;
  }
  const sb = engine._standingBucket;
  if (prof.menuOfferRulesByStanding && sb && sb.pi === pi
      && sb.turn === (engine.gs?.turn || 0) && sb.bucket !== 'even') {
    const d = prof.menuOfferRulesByStanding[sb.bucket]?.[key];
    if (typeof d === 'number') v += d;
  }
  return v * confidence(prof);
}

function casterDelta(engine, pi, cardName, heroName) {
  if (!heroName) return 0;
  const prof = profileFor(engine, pi);
  const d = prof?.casterDeltas?.[cardName]?.[heroName];
  if (typeof d !== 'number') return 0;
  return d * confidence(prof);
}

function heldPairBonus(engine, pi, cardName, handArr, gateMult = 1) {
  const prof = profileFor(engine, pi);
  if (!prof || !prof.pairBonuses) return 0;
  let bonus = 0;
  const seen = new Set();
  for (const other of (handArr || [])) {
    if (!other || other === cardName || seen.has(other)) continue;
    seen.add(other);
    const key = cardName < other ? `${cardName}|${other}` : `${other}|${cardName}`;
    const b = prof.pairBonuses[key];
    // Halve it — the full bonus split across both partners would double
    // count in hand-sum contexts (evaluateState sums per card).
    if (typeof b === 'number') bonus += b / 2;
  }
  // Discard-Kontext-Paare (Als Auftrag: "Grave Worm im Discard macht
  // Cute Cat inhärent wertvoller"): Keys mit dc:-Präfix wurden gegen
  // den FRIEDHOF gelernt — hier gegen den aktuellen discardPile des
  // Spielers matchen. VOLLER Bonus statt /2: der Partner liegt im
  // Discard und taucht in keiner Hand-Summe auf, es gibt also keine
  // zweite Hälfte, die doppelt zählen könnte. Der 15er-Cap unten
  // deckelt weiterhin alles gemeinsam.
  const seenDc = new Set();
  for (const other of (engine.gs?.players?.[pi]?.discardPile || [])) {
    if (!other || other === cardName || seenDc.has(other)) continue;
    seenDc.add(other);
    const dk = `dc:${other}`;
    const key = cardName < dk ? `${cardName}|${dk}` : `${dk}|${cardName}`;
    const b = prof.pairBonuses[key];
    if (typeof b === 'number') bonus += b;
  }
  return Math.min(15, bonus * confidence(prof) * Math.max(0, Math.min(1, gateMult)));
}

/**
 * Learned prior for attaching `abilityName` onto the hero named
 * `heroName`. Additive points on scoreAbilityPlacement's scale
 * (structural unlock scores there run ~tens to ~200).
 */
function abilityPlacementBonus(engine, pi, abilityName, heroName) {
  const prof = profileFor(engine, pi);
  // Floor-Vertrag muss auch OHNE Profil greifen (Live-Spiele vor dem
  // ersten Training) — deshalb kein früher return mehr, sondern ein
  // leerer Prior-Satz als Fallback.
  const priors = (prof && prof.abilityPriors) ? prof.abilityPriors : {};
  // Level-bewusster Lookup (Als Nao-Befund): Neue Profile exportieren
  // je Stufe ein Gewicht (X@Held = Lv≥1, X@Held≥2, X@Held≥3). Die
  // anstehende Entscheidung ist die MARGINALE ("lohnt die k-te
  // Kopie?"), also zählt der Prior der ZIEL-Stufe = aktueller Stack
  // dieses Helden + 1. Alte Profile ohne Stufen-Keys fallen auf den
  // flachen Basis-Key zurück (voll abwärtskompatibel — auch mit Als
  // handgepatchtem heal-burn.json).
  let targetLevel = 1;
  const heroes = engine.gs?.players?.[pi]?.heroes || [];
  const hi = heroes.findIndex(h => h?.name === heroName);
  if (hi >= 0) {
    for (const slot of (engine.gs.players[pi].abilityZones?.[hi] || [])) {
      if (slot && slot.length && slot[0] === abilityName) {
        targetLevel = Math.min(3, slot.length + 1);
        break;
      }
    }
  }
  // Gleiche Identitaets-Aufloesung wie die Schreibseite im Recorder:
  // Formen eines morphenden Helden teilen einen Prior-Satz, sobald ihr
  // Skript `cpuMeta.abilityIdentity` deklariert. Ohne Vertrag bleibt es
  // beim Kartennamen — kein bestehendes Deck aendert sein Verhalten.
  let priorHero = heroName;
  try {
    const { loadCardEffect } = require('./_loader');
    const id = loadCardEffect(heroName)?.cpuMeta?.abilityIdentity;
    if (typeof id === 'string' && id) priorHero = id;
  } catch { /* Kartenname bleibt */ }
  const base = `${abilityName}@${priorHero}`;
  const stepKey = targetLevel >= 2 ? `${base}≥${targetLevel}` : base;
  const v = priors[stepKey] ?? priors[base];
  const learned = (typeof v === 'number' && prof) ? v * confidence(prof) : 0;
  // ── Prior-Floor-Vertrag (Als Auftrag, Hebel a gegen Lern-Drift) ──
  // Das Voll-Training 23-30 lernte NEGATIVE Priors auf Summoning Magic
  // @Teppes (−34.3/−54.7) und drehte damit genau den Ausbau ab, der die
  // Spielbarkeits-Klemme löst (24% "Hand voll, nichts spielbar" in
  // bounce-losen Spielen): SM-Plays korrelieren mit langsamen Spielen
  // und langsame mit Niederlagen — die Korrelation bestraft Fundament,
  // weil sie es von Verschleppung nicht unterscheiden kann. Helden-
  // Skripte können deshalb cpuAbilityPriorFloor(abilityName, targetLevel)
  // exportieren: Design-Wissen als Untergrenze, Lernen darf nach oben
  // frei bleiben. Greift auch ohne Profil (Floor statt 0).
  try {
    const { loadCardEffect } = require('./_loader');
    const hf = loadCardEffect(heroName)?.cpuAbilityPriorFloor;
    if (typeof hf === 'function') {
      const floor = hf(abilityName, targetLevel);
      if (typeof floor === 'number') return Math.max(learned, floor);
    }
  } catch { /* Floor ist Zusatz, nie Blocker */ }
  return learned;
}

/**
 * Gate-Schwellen-Delta für Lock-Karten, kontextabhängig: Für jeden
 * Lock-Typ, den diese Karte laut Trainingsdaten setzt, wird der
 * AKTUELLE Hand-Bucket (wie viele Karten des gesperrten Typs noch in
 * der Hand liegen) berechnet und das gelernte Gewicht nachgeschlagen.
 * Negativ gelernt → positives Schwellen-Delta → das Gate committet die
 * Lock-Karte erst, wenn die Hand leer genug ist. Die "spiele Boomerang
 * zuletzt"-Reihenfolge entsteht emergent, ohne Karten-Regel: Früh im
 * Zug ist der Bucket hoch (Strafe aktiv), nach dem Abarbeiten der
 * anderen Artefakte fällt er auf 0-1 und die Schwelle normalisiert sich.
 */
const LOCK_TYPE_TO_CARDTYPE = { item: 'Artifact', potion: 'Potion', creature: 'Creature', hand: '*' };
function lockOrderPenalty(engine, pi, cardName) {
  const prof = profileFor(engine, pi);
  if (!prof || !prof.lockPenalties) return 0;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  let delta = 0;
  let db = null;
  for (const [k, cardType] of Object.entries(LOCK_TYPE_TO_CARDTYPE)) {
    // Existiert für diese Karte + diesen Lock-Typ überhaupt ein gelerntes
    // Gewicht? (Billiger Vorab-Check über die vier möglichen Buckets.)
    const anyKey = ['0', '1', '2', '3+'].some(b => `${cardName}|${k}@${b}` in prof.lockPenalties);
    if (!anyKey) continue;
    if (!db) db = engine._getCardDB();
    let held = 0;
    for (const n of (ps.hand || [])) {
      if (n === cardName) continue;
      if (cardType === '*' || db[n]?.cardType === cardType) held++;
    }
    const bucket = held >= 3 ? '3+' : String(held);
    const w = prof.lockPenalties[`${cardName}|${k}@${bucket}`];
    if (typeof w === 'number' && w < 0) delta += -w * confidence(prof);
  }
  return Math.min(25, delta);
}

function equipPlacementBonus(engine, pi, equipName, heroName) {
  const prof = profileFor(engine, pi);
  if (!prof || !prof.equipPriors) return 0;
  const v = prof.equipPriors[`${equipName}@${heroName}`];
  return typeof v === 'number' ? v * confidence(prof) : 0;
}

/**
 * Situativer Handwert-Bonus für Revive-Karten (Golden Ankh,
 * Reincarnation, …). Anders als cardValues ist dieser Bonus
 * ZUSTANDSBEDINGT: Er greift nur, wenn gerade ein eigener Held besiegt
 * ist, und bewertet dann, was genau DIESER Held nach der Wiederbelebung
 * beisteuern könnte — seine gelernte Identität (reviveTargets) plus
 * seine aktuell gestackten Abilities (reviveAbilities, anteilig zum
 * Level). Liegen mehrere Helden besiegt, zählt der beste Kandidat, denn
 * das Gate wird beim Ausspielen ohnehin den besten wählen. Ohne
 * besiegten Helden: 0 — die Karte ist dann totes Gewicht, und genau das
 * darf ein statischer cardValue nie ausdrücken.
 */
function reviveBonus(engine, pi, cardName) {
  const prof = profileFor(engine, pi);
  if (!prof) return 0;
  const targets = prof.reviveTargets;
  const abils = prof.reviveAbilities;
  if (!targets && !abils) return 0;
  const ps = engine.gs?.players?.[pi];
  if (!ps?.heroes) return 0;
  let best = null;
  for (let hi = 0; hi < ps.heroes.length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || (hero.hp ?? 0) > 0) continue; // nur besiegte Helden
    let w = 0;
    let matched = false;
    const tv = targets?.[`${cardName}→${hero.name}`];
    if (typeof tv === 'number') { w += tv; matched = true; }
    for (const slot of (ps.abilityZones?.[hi] || [])) {
      if (!slot || slot.length === 0) continue;
      const av = abils?.[`${cardName}→${slot[0]}`];
      // Gelerntes Gewicht wurde bei Stack-Level ≤3 trainiert — anteilig
      // zum aktuellen Level anwenden (Lv3-Stack = volles Gewicht).
      if (typeof av === 'number') { w += av * (slot.length / 3); matched = true; }
    }
    if (matched && (best == null || w > best)) best = w;
  }
  if (best == null) return 0;
  return Math.max(-10, Math.min(25, best * confidence(prof)));
}

/**
 * Gelernter Starthand-Score für die Mulligan-Entscheidung.
 * Summe der startHandValues über die Handkarten (Duplikate zählen
 * mehrfach), skaliert mit der Profil-Confidence. `covered` = wie viele
 * Handkarten überhaupt einen gelernten Wert haben — der Aufrufer nutzt
 * das als Mindestabdeckungs-Gate, damit ein Profil mit drei bekannten
 * Karten nicht über eine Achter-Hand urteilt.
 * @returns {{score:number, covered:number}|null} null ohne Profil/Kanal.
 */
function startHandScore(engine, pi, hand) {
  const prof = profileFor(engine, pi);
  const shv = prof?.startHandValues;
  if (!shv || !Array.isArray(hand) || hand.length === 0) return null;
  if (Object.keys(shv).length === 0) return null;
  let score = 0, covered = 0;
  for (const name of hand) {
    const v = shv[name];
    if (typeof v !== 'number') continue;
    covered++;
    score += v;
  }
  return { score: score * confidence(prof), covered };
}

/**
 * Gelernter Timing-Prior für die Hero-Effekt-Aktivierung: liest den
 * aktuellen Handgrößen-Bucket des Spielers und liefert das gelernte
 * Winrate-Delta für "diesen Helden JETZT aktivieren", confidence-
 * skaliert und auf ±12 begrenzt. Positiv = eher aktivieren (Gate-
 * Schwelle sinkt), negativ = warten (Schwelle steigt). Kein Verbot:
 * MCTS kann einen starken Sofort-Nutzen weiterhin durchsetzen.
 */
function heroEffectTimingPrior(engine, pi, heroName) {
  const prof = profileFor(engine, pi);
  const het = prof?.heroEffectTiming;
  if (!het || !heroName) return 0;
  const hl = engine.gs?.players?.[pi]?.hand?.length ?? 0;
  const bucket = hl <= 1 ? '0-1' : hl <= 3 ? '2-3' : '4+';
  const v = het[`${heroName}@hand:${bucket}`];
  if (typeof v !== 'number') return 0;
  return Math.max(-12, Math.min(12, v * confidence(prof)));
}

/**
 * Gelernter Same-Hero-Synergie-Bonus für die Platzierung: Summe der
 * boardPairs-Werte zwischen `cardName` und allen Karten, die bereits
 * an Held `heroIdx` liegen (Support-Slots + Ability-Zonen).
 * Confidence-skaliert, begrenzt auf −10..+20. Positiv zieht die Karte
 * zum Partner (Howitzer zum Shield-of-Life-Träger), negativ hält
 * gelernte Anti-Synergien auseinander.
 */
function boardPairBonus(engine, pi, cardName, heroIdx) {
  const prof = profileFor(engine, pi);
  const bp = prof?.boardPairs;
  if (!bp || !cardName || heroIdx == null || heroIdx < 0) return 0;
  if (Object.keys(bp).length === 0) return 0;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  let sum = 0;
  const addFor = (other) => {
    if (!other || other === cardName) return;
    const v = bp[[cardName, other].sort().join('|')];
    if (typeof v === 'number') sum += v;
  };
  for (const slot of (ps.supportZones?.[heroIdx] || [])) {
    if (slot && slot.length > 0) addFor(slot[0]);
  }
  for (const slot of (ps.abilityZones?.[heroIdx] || [])) {
    if (slot && slot.length > 0) addFor(slot[0]);
  }
  if (sum === 0) return 0;
  return Math.max(-10, Math.min(20, sum * confidence(prof)));
}

/** Test hook / hot-reload after retraining without a server restart. */
function reloadProfiles() { _profilesByDir.clear(); loadAllProfiles(); }


/**
 * ── Protection-/Redirect-Lernkanal ────────────────────────────────────
 * Zentrale Entscheidung für "Schaden negieren/umleiten?"-Confirms
 * (Idej Projection, Gigantisaur Brachion, Prophecy of Tempeste …).
 * Statt Pauschal-Accept lernt der ML-Prozess, WANN sich der Einsatz
 * der Schutzressource lohnt.
 *
 *   meta = { d: eingehender Schaden, hp: aktuelle Ziel-HP }
 *   Feature: ratio = d / max(1, hp); lethal = d >= hp.
 *
 * Entscheidungslogik:
 *   1. Gelernte Regel im Deck-Profil (protectionRules[cardName]):
 *      confirm ⇔ lethal (wenn lethalConfirm ≠ false)
 *              oder ratio ≥ rule.ratioThreshold.
 *   2. Trainingsmodus ohne Regel: 50/50-Exploration — beide Arme
 *      erzeugen Daten, der Trainer regressiert sie gegen den Ausgang.
 *   3. Live ohne Regel: confirm (konservativer Alt-Default).
 * Jede Entscheidung wird auf engine._protLog gestempelt; der Recorder
 * übernimmt sie als record.protectionDecisions.
 */
/**
 * ── Game-Start-Pick-Lernkanal ─────────────────────────────────────────
 * Zentrale Auswahl für Start-of-Game-Sucheffekte (Bill, Barker, Sid).
 *   options: [{ name, cost?, source? }]  opts: { count=1, budget=∞ }
 * Rückgabe: Array gewählter options-Einträge oder null (= die Karte
 * nutzt ihre bestehende Default-Heuristik).
 * Hierarchie: gelerntes Ranking (profile.gameStartPicks[card].values,
 * WR-Delta je Pick) > uniforme Exploration im Training > null (live).
 * Multi-Picks werden greedy aus den MARGINALEN Werten gebaut
 * (distinct-Namen + Budget-Constraint); Kombinationen werden bewusst
 * nicht gelernt. Jede Helper-Entscheidung landet auf
 * engine._gameStartLog für den Recorder.
 */
function gameStartPickDecision(engine, pi, cardName, options, opts = {}) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const count = Math.max(1, opts.count || 1);
  const budget = typeof opts.budget === 'number' ? opts.budget : Infinity;
  const distinctBudgetPick = (order) => {
    const out = []; const seen = new Set(); let spent = 0;
    for (const o of order) {
      if (out.length >= count) break;
      if (!o || seen.has(o.name)) continue;
      const c = Number(o.cost) || 0;
      if (spent + c > budget) continue;
      out.push(o); seen.add(o.name); spent += c;
    }
    return out;
  };
  // ── Skript-Priorität schlägt Gelerntes (Als Ruling zu Barker) ──
  // Barkers Start-Pick lernte Sandy Blob (+0.202) über Primordium
  // (−0.166) — Einzelspiel-Korrelationen sehen den Motor-Wert des
  // Primordium-Openers nicht (er ist auch Removal-Magnet, was die
  // Korrelation zusätzlich drückt). Karten können deshalb per
  // `gameStartPickPriority` (Zahl) eine harte Vorfahrt exportieren:
  // geflaggte Optionen kommen zuerst (höchste Priorität vorn, Budget-
  // und Distinct-Regeln gelten weiter), der Rest folgt gelernt bzw.
  // exploriert. Gilt bewusst AUCH im Training — Al will den Pick fest.
  const prioOf = (o) => {
    try {
      const { loadCardEffect } = require('./_loader');
      const v = loadCardEffect(o.name)?.gameStartPickPriority;
      return typeof v === 'number' ? v : null;
    } catch { return null; }
  };
  const prioritized = options.filter(o => prioOf(o) !== null)
    .sort((a, b) => prioOf(b) - prioOf(a));

  const prof = profileFor(engine, pi);
  const learned = prof?.gameStartPicks?.[cardName];
  let picked; let src;
  if (learned?.values) {
    const rest = options.filter(o => prioOf(o) === null).sort((a, b) =>
      (learned.values[b.name] || 0) - (learned.values[a.name] || 0));
    picked = distinctBudgetPick([...prioritized, ...rest]);
    src = prioritized.length ? 'priority+rule' : 'rule';
  } else if (isCollecting()) {
    const shuffled = options.filter(o => prioOf(o) === null)
      .map(o => [Math.random(), o]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    picked = distinctBudgetPick([...prioritized, ...shuffled]);
    src = prioritized.length ? 'priority+explore' : 'explore';
  } else if (prioritized.length) {
    picked = distinctBudgetPick(prioritized); src = 'priority';
  } else {
    return null;
  }
  if (!picked || picked.length === 0) return null;
  if (!engine._inMctsSim) {
    (engine._gameStartLog = engine._gameStartLog || []).push({
      card: cardName, pi, picks: picked.map(o => o.name), src,
    });
  }
  return picked;
}

/**
 * Read-only-Profil-Lookup über Helden-Namen, OHNE die
 * _profileAllowedSide-Maske. Für Konsumenten wie Sid, die das Profil
 * des GEGNER-Decks lesen (welche Karten sind dort am wertvollsten),
 * ohne die eigene Baseline-Datensammlung zu verfälschen.
 */
function profileForHeroes(heroNames) {
  try {
    const all = loadAllProfiles(); // Map heroKey → Profil
    return all.get(heroKeyOf(heroNames)) || null;
  } catch { return null; }
}

/**
 * Exploration nur im DATENSAMMELMODUS — in EVAL/AB-Läufen ist
 * PP_TRAIN ebenfalls gesetzt, dort sollen aber die gelernten Regeln
 * bzw. Live-Defaults gezeigt werden, nicht der Zufalls-Arm.
 */
function isCollecting() {
  return process.env.PP_TRAIN === '1'
    && process.env.PP_TRAIN_EVAL !== '1'
    && process.env.PP_TRAIN_AB !== '1';
}

function protectionDecision(engine, pi, cardName, meta) {
  const d = Math.max(0, Number(meta?.d) || 0);
  const hp = Math.max(1, Number(meta?.hp) || 1);
  const ratio = Math.min(2, d / hp);
  const lethal = d >= hp;
  let confirmed;
  let src = 'default';
  const prof = profileFor(engine, pi);
  const rule = prof?.protectionRules?.[cardName];
  if (rule) {
    confirmed = lethal ? (rule.lethalConfirm !== false)
      : ratio >= (typeof rule.ratioThreshold === 'number' ? rule.ratioThreshold : 0);
    src = 'rule';
  } else if (isCollecting()) {
    confirmed = Math.random() < 0.5;
    src = 'explore';
  } else {
    confirmed = true;
  }
  if (!engine._inMctsSim) {
    (engine._protLog = engine._protLog || []).push({
      card: cardName, pi,
      ratio: Math.round(ratio * 100) / 100, lethal, confirmed, src,
    });
  }
  return confirmed;
}

// ── Placement-Lernkanal (Support-Zonen-Ökonomie) ────────────────────
// Als Design-Logik: "Je höher-levelige Kreaturen ein Held beschwören
// kann, desto wertvoller sind seine Support-Zonen — Low-Level-Kreaturen
// gehören zu Low-Summoning-Helden." Die statische Basis-Heuristik
// (lowest matching level) existiert; dieser Kanal lernt PER DECK die
// Feinsteuerung über Kontext-Tags:
//   plc:slack:0/1/2+  — Helden-Schullevel minus Kreaturen-Level
//                       (hoher Slack = wertvolle Zone "verschwendet")
//   plc:bigwait       — eine ANDERE Lv≥3-Kreatur wartet auf der Hand
//                       (Populated Island Turtle braucht 3 freie Zonen
//                       beim selben Helden — Slots freihalten!)
function classifyPlacementTags(engine, pi, cardData, heroSchoolLvl) {
  const tags = [];
  try {
    const slack = Math.max(0, (heroSchoolLvl || 0) - (cardData.level || 0));
    tags.push('plc:slack:' + (slack >= 2 ? '2+' : String(slack)));
    const ps = engine.gs?.players?.[pi];
    const db = engine._getCardDB ? engine._getCardDB() : null;
    if (ps && db) {
      for (const n of ps.hand || []) {
        if (n === cardData.name) continue;
        const cd = db[n];
        if (cd && cd.cardType === 'Creature' && (cd.level || 0) >= 3) { tags.push('plc:bigwait'); break; }
      }
    }
  } catch { /* defensiv */ }
  return tags;
}

function placementPrior(engine, pi, tags) {
  try {
    const rules = profileFor(engine, pi)?.placementRules;
    if (!rules) return 0;
    return (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
  } catch { return 0; }
}

// ── Status-Heilungs-Lernkanal ────────────────────────────────────────
// Coffee/Tea/Beer/Juice wurden nie gespielt: Das kurzsichtige Gate
// sieht "−Gold/−Handkarte, ein Status weniger" und lehnt ab. Statt
// eines stumpfen alwaysCommit lernt dieser Kanal, WANN sich
// Status-Heilung lohnt — über Kontext-Tags des Spielzustands:
//   st:1 / st:2 / st:3+  — akkumulierte negative Status (eigene Seite)
//   st:poison2+          — irgendwo ≥2 Poison-Stacks
//   st:frozen-hero       — eigener Held gefroren
//   st:stun-hero         — eigener Held gestunnt/negiert
//   st:hero-caster       — ein VERSTATUSTER Held trägt Abilities
//                          (er "soll etwas machen" — Als Kriterium)
// Hierarchie wie Protection/Surprise: gelernte Regel (Σ Tag-Deltas)
// > Trainings-Exploration (~40% play) > null (MCTS-Gate entscheidet).
function classifyStatusHealContext(engine, pi) {
  const tags = [];
  try {
    const { getCleansableStatuses } = require('./_hooks');
    const negKeys = getCleansableStatuses();
    const ps = engine.gs?.players?.[pi];
    if (!ps) return tags;
    let total = 0, poisonMax = 0, frozenHero = false, stunHero = false, statusedCasterHero = false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0 || !h.statuses) continue;
      let heroHas = false;
      for (const k of negKeys) {
        const s = h.statuses[k];
        if (!s) continue;
        total++; heroHas = true;
        if (k === 'poisoned') poisonMax = Math.max(poisonMax, s.stacks || s.count || 1);
        if (k === 'frozen') frozenHero = true;
        if (k === 'stunned' || k === 'negated') stunHero = true;
      }
      if (heroHas) {
        const zones = ps.abilityZones?.[hi];
        if (Array.isArray(zones) && zones.some(z => Array.isArray(z) ? z.length > 0 : !!z)) statusedCasterHero = true;
      }
    }
    for (const inst of engine.cardInstances || []) {
      if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support') continue;
      const c = inst.counters || {};
      for (const k of negKeys) {
        if (c[k]) {
          total++;
          if (k === 'poisoned') poisonMax = Math.max(poisonMax, typeof c[k] === 'number' ? c[k] : 1);
        }
      }
    }
    if (total >= 3) tags.push('st:3+');
    else if (total === 2) tags.push('st:2');
    else if (total === 1) tags.push('st:1');
    if (poisonMax >= 2) tags.push('st:poison2+');
    if (frozenHero) tags.push('st:frozen-hero');
    if (stunHero) tags.push('st:stun-hero');
    if (statusedCasterHero) tags.push('st:hero-caster');
  } catch { /* defensiv */ }
  return tags;
}

// → 'play' | 'skip' | null (Gate entscheidet). tags werden vom
// Aufrufer mitgeloggt (engine._statusHealLog), damit der Trainer
// fired/unfired je Kontext vergleichen kann.
function statusHealDecision(engine, pi, cardName, tags) {
  try {
    const prof = profileFor(engine, pi);
    const rules = prof?.statusHealRules?.[cardName];
    // ε-Rest-Exploration trotz Regel — gleiche Begründung wie im
    // Surprise-Kanal: Die Iter-2-Regeln (überwiegend negativ) haben
    // Coffee in Iteration 3 KOMPLETT erstickt (0 neue Plays) → keine
    // frischen fired-Arme → Regeln lernen nur noch aus altem Bestand.
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (rules && !epsRoll) {
      const score = (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
      if (score >= 4) return 'play';
      if (score <= -4) return 'skip';
      return null;
    }
    // Explorations-Rate env-steuerbar (Debug: PP_HEAL_EXPLORE=1 erzwingt
    // jeden Pick als 'play' — deterministischer End-to-End-Test).
    const explore = parseFloat(process.env.PP_HEAL_EXPLORE || '0.4');
    if (process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < explore) return 'play';
  } catch { /* defensiv */ }
  return null;
}

// ── MARKET-CRASH-KANAL (Als Auftrag 16.8.) ───────────────────────────
//
//  "Both players' Gold becomes 0" ist die seltene Sorte Karte, deren
//  Wert fast vollstaendig am ZEITPUNKT haengt und fast gar nicht am
//  Brett. Als vier Teilfragen waren:
//    (a) braucht die CPU ihr eigenes Gold noch?
//    (b) wann im Zug geht die Karte idealerweise noch frei durch
//        (moeglichst viel selbst ausgegeben, aber gerade noch mehr als
//        der Gegner)?
//    (c) wann lohnt es sich, eine Action dafuer auszugeben?
//    (d) lohnt es sich ueberhaupt — braucht das Gegnerdeck sein Gold,
//        wieviel hat es, wieviel braucht es?
//
//  WAS HIER BEWUSST NICHT GELERNT WIRD. (a), (d) und der Kartenwert
//  selbst sind BERECHENBAR und schon gebaut — dieselbe Linie wie beim
//  Ability-Dependency-Score darunter:
//    · `computeGoldDemand(engine, pi)` (_cpu.js) = was ein Spieler
//      JETZT produktiv ausgeben koennte (Artefakte in der Hand plus
//      Aktivierungen mit `cpuGoldCostForActivation`).
//    · `mctsOpponentGoldEconomy(engine, oppIdx)` = 0,3 (Hamsterer, Gold
//      ist ihm egal) bis 1,8 (ausgehungert, jedes Gold zaehlt), aus
//      Vorrat/Bedarf plus der Zugende-Historie `_cpuGoldHistory`.
//    · Und `evaluateState` bewertet Gold bereits als
//      `min(gold,demand)*2 + Ueberschuss*0,2` — der Tauschwert des Wipes
//      ist fuer MCTS also ohne jede Aenderung sichtbar.
//  Diese Groessen werden hier zu TAGS verdichtet, nicht nachgebaut.
//
//  GELERNT wird nur der Rest, der aus ihnen nicht folgt: ob sich der
//  Tausch in dieser Lage, in dieser Phase, in diesem Modus gelohnt hat.
//  Der Trainer bildet je Tag das uebliche Delta mean(gespielt) −
//  mean(gehalten); die Laufzeit summiert die Tags der aktuellen Lage.
//
//  Die Tags kommen absichtlich in wenigen, groben Familien (Modus,
//  Phase, Vorsprung, Eigenopfer, Gegner-Hunger, Beute) — sechs Tags je
//  Entscheidung. Feiner geschnitten erreicht kein einzelner Tag mehr die
//  MIN_ARM-Schwelle des Trainers.

/** Gold-Kennzahlen beider Seiten. Lazy require gegen den Modulzyklus:
 *  `_cpu.js` laedt `_deck-profile.js` beim Start, andersherum darf das
 *  also erst zur Laufzeit passieren — dann sind beide fertig geladen. */
function goldSnapshot(engine, pi) {
  const oi = pi === 0 ? 1 : 0;
  const ps = engine?.gs?.players?.[pi];
  const ops = engine?.gs?.players?.[oi];
  if (!ps || !ops) return null;
  let demandOwn = 0, demandOpp = 0, oppEconomy = 1.0;
  try {
    const cpu = require('./_cpu');
    if (typeof cpu.computeGoldDemand === 'function') {
      demandOwn = cpu.computeGoldDemand(engine, pi) || 0;
      demandOpp = cpu.computeGoldDemand(engine, oi) || 0;
    }
    if (typeof cpu.mctsOpponentGoldEconomy === 'function') {
      oppEconomy = cpu.mctsOpponentGoldEconomy(engine, oi);
    }
  } catch { /* Kanal darf nie das Spiel stoeren */ }
  return {
    own: ps.gold || 0, opp: ops.gold || 0,
    demandOwn, demandOpp, oppEconomy,
  };
}

/**
 * Tags fuer den Market-Crash-Kanal.
 * @param {object} opts { additional } — true, wenn gerade der Frei-/
 *        Zusatzaktions-Pfad geprueft wird (Vorsprung besteht), false beim
 *        regulaeren Action-Play.
 */
function classifyMarketCrashTags(engine, pi, opts = {}) {
  const tags = [];
  try {
    const g = goldSnapshot(engine, pi);
    if (!g) return tags;

    // (1) MODUS — kostet der Play eine Action? Das ist der teuerste
    // Unterschied und deshalb ein eigener Tag, nicht nur eine Kovariate.
    tags.push(opts.additional ? 'mc:frei' : 'mc:action');

    // (2) PHASE — "wann im Zug". MP1 heisst: es koennte noch gekauft
    // werden. MP2 heisst: der Zug ist praktisch durch, was jetzt noch
    // liegt, verfaellt ohnehin bis zum naechsten Einkommen.
    const ph = engine.gs?.currentPhase;
    tags.push(ph === 4 ? 'mc:mp2' : ph === 3 ? 'mc:ap' : 'mc:mp1');

    // (3) VORSPRUNG — Als "gerade noch mehr als der Gegner". Ein knapper
    // Vorsprung ist der Idealfall: er traegt den Frei-Modus, ohne dass
    // viel eigenes Gold mitverbrennt.
    const lead = g.own - g.opp;
    if (lead <= 0) tags.push('mc:vorsprung-keiner');
    else if (lead <= 3) tags.push('mc:vorsprung-knapp');
    else if (lead <= 9) tags.push('mc:vorsprung-mittel');
    else tags.push('mc:vorsprung-gross');

    // (4) EIGENOPFER — nicht das eigene Gold zaehlt, sondern der Teil
    // davon, den die CPU JETZT noch in etwas verwandeln koennte. 20 Gold
    // ohne einen einzigen Kauf in der Hand sind kein Verlust.
    const opfer = Math.min(g.own, g.demandOwn);
    if (opfer <= 0) tags.push('mc:eigenopfer-0');
    else if (opfer <= 7) tags.push('mc:eigenopfer-klein');
    else tags.push('mc:eigenopfer-gross');

    // (5) GEGNER-HUNGER — braucht das Gegnerdeck sein Gold ueberhaupt?
    if (g.oppEconomy >= 1.3) tags.push('mc:opp-hungrig');
    else if (g.oppEconomy >= 0.7) tags.push('mc:opp-normal');
    else tags.push('mc:opp-satt');

    // (6) BEUTE — der absolute Betrag, den es dem Gegner wegnimmt.
    if (g.opp >= 18) tags.push('mc:beute-gross');
    else if (g.opp >= 8) tags.push('mc:beute-mittel');
    else tags.push('mc:beute-klein');
  } catch { /* defensiv */ }
  return tags;
}

/**
 * → 'play' | 'skip' | null. Gleiche Bauform wie `statusHealDecision`:
 * Tag-Punkte aus dem Profil summieren, Schwelle ±4, darunter entscheidet
 * MCTS weiter. Der Aufrufer protokolliert die Tags, damit der Trainer
 * gespielt/gehalten je Kontext vergleichen kann.
 */
function marketCrashDecision(engine, pi, cardName, tags) {
  try {
    const prof = profileFor(engine, pi);
    const rules = prof?.marketCrashRules?.[cardName];
    // ε-Rest-Exploration trotz Regel — gleiche Begruendung wie im
    // Surprise- und Status-Heil-Kanal: eine ueberwiegend negative
    // Iteration wuerde die Karte sonst komplett ersticken, es kaemen
    // keine frischen "gespielt"-Arme nach und die Regeln lernten nur
    // noch aus altem Bestand.
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (rules && !epsRoll) {
      const score = (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
      if (score >= 4) return 'play';
      if (score <= -4) return 'skip';
      return null;
    }
    // Ohne Regeln: in Trainingslaeufen bewusst durchlassen, damit beide
    // Arme entstehen. PP_CRASH_EXPLORE=1 erzwingt jeden Play — der
    // deterministische End-zu-End-Test.
    const explore = parseFloat(process.env.PP_CRASH_EXPLORE || '0.4');
    if (process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < explore) return 'play';
  } catch { /* defensiv */ }
  return null;
}

// ── Ability-Removal-Dependency-Score ─────────────────────────────────
// "Was kann der Gegner ohne diese Ability alles NICHT MEHR?" ist aus
// öffentlicher Information BERECHENBAR statt lernbar: Seine Casts sind
// sichtbar (engine._schoolUse, gezählt in _cpu.js), und eine Ability
// trägt eine bekannte Stufe zu ihrer Schule bei. Score = Anzahl der
// beobachteten Casts, die durch den Verlust EINER Stufe dieser Schule
// unspielbar würden (benötigtes Level > verbleibende Stufe), × 10.
// Konsumenten: Magic Amethyst (bedingtes Commit); wiederverwendbar für
// Yeeting-Klasse-Zielwahlen und künftige Target-Tags.
function abilityDependencyScore(engine, oppIdx, school, currentStackLevel) {
  try {
    const use = engine._schoolUse?.[oppIdx]?.[school];
    if (!use) return 0;
    let score = 0;
    // Dimension 1 — Cast-Enabler (Spell Schools): beobachtete Casts,
    // die durch den Stufenverlust unter ihr benötigtes Level fallen.
    if (use.levels && use.levels.length > 0) {
      const remaining = Math.max(0, (currentStackLevel || 1) - 1);
      score += use.levels.filter(L => (L || 0) > remaining).length * 10;
    }
    // Dimension 2 — eigene Aktivierungen (Leadership, Alchemy,
    // Necromancy …): Verlust der LETZTEN Stufe nimmt die Fähigkeit
    // komplett (×10 pro beobachteter Aktivierung); ein Stufenverlust
    // bei höherem Stack schwächt stufenabhängige Effekte (×3).
    if (use.activations) {
      score += use.activations * ((currentStackLevel || 1) <= 1 ? 10 : 3);
    }
    return score;
  } catch { return 0; }
}

// ── Surprise-Fire-Lernkanal ──────────────────────────────────────────
// Surprises wurden bisher beim ERSTEN Trigger gefeuert ("fire ASAP" in
// cpuReactionDecision) — ob sich Halten lohnt (besseres Timing, Bluff,
// späterer Trigger mit mehr Wert), war nie eine Entscheidung. Dieser
// Kanal lernt pro Karte und turnBucket ein fireDelta:
//   Advantage(gefeuert) − Advantage(gehalten).
// Hierarchie wie Protection Channel:
//   1. Gelernte Regel (profile.surpriseRules[card][bucket]):
//      Delta ≥ +4 → 'fire', ≤ −4 → 'hold', dazwischen → Heuristik.
//   2. Trainingsmodus ohne Regel: 50/50-Exploration — beide Arme
//      erzeugen Daten (nur live, nie in MCTS-Simulationen).
//   3. Live ohne Regel: null → bestehende Heuristik entscheidet.
// Der Aufrufer loggt die FINALE Entscheidung auf engine._surpriseLog;
// der Recorder übernimmt sie als record.surpriseDecisions.
function surpriseFireDecision(engine, pi, cardName) {
  try {
    const prof = profileFor(engine, pi);
    const bucket = turnBucket(engine.gs?.turn || 1);
    const delta = prof?.surpriseRules?.[cardName]?.[bucket];
    // ε-Rest-Exploration TROTZ Regel (Fix der Regel-Erstickung):
    // Sobald eine Regel existiert und immer befolgt wird, entstehen
    // keine kontrafaktischen Daten mehr — die Doppelarm-Statistik der
    // nächsten Iteration lernt dann nur noch aus policy-kontaminierten
    // Armen und die Regeln OSZILLIEREN (Defending the Gate drehte von
    // "mid/late fire" komplett auf "hold"). Im Training wird die Regel
    // deshalb mit p=PP_RULE_EXPLORE (default 0.15) ignoriert und
    // frisch gewürfelt.
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (typeof delta === 'number' && !epsRoll) {
      if (delta >= 4) return 'fire';
      if (delta <= -4) return 'hold';
      return null;
    }
    if (process.env.PP_TRAIN && !engine._inMctsSim) {
      return Math.random() < 0.5 ? 'fire' : 'hold';
    }
  } catch { /* defensiv */ }
  return null;
}

// ── Schadens-Impact-Lernkanal ────────────────────────────────────────
// Karten mit `cpuProjectedDamage` melden Schaden + Zielliste; daraus
// entstehen die drei Merkmale, deren relative Gewichte der Trainer
// deckweit ermittelt (impactWeights), plus die Score→Wert-Abbildung je
// Karte (impactRules). Zweck: Karten, deren Wert stark vom Board-Zustand
// abhängt, tragen sonst einen KONSTANTEN Prior — Rain of Arrows macht bei
// null eigenen Kreaturen exakt 0 Schaden und stünde trotzdem mit dem
// höchsten Prior im Deck ganz vorn in der Kandidaten-Exploration.
// Wohnt hier statt in _cpu.js, damit Trainings-Logging und Verbrauch
// dieselbe Berechnung benutzen und nicht auseinanderlaufen.
function projectImpactFeatures(engine, pi, cardName) {
  try {
    if (!cardName) return null;
    // Lazy require wie bei _hooks weiter unten: _loader zieht Kartenskripte,
    // die ihrerseits dieses Modul laden können — beim Modulstart wäre das
    // ein Zirkelbezug.
    const { loadCardEffect } = require('./_loader');
    const script = loadCardEffect(cardName);
    if (typeof script?.cpuProjectedDamage !== 'function') return null;
    const proj = script.cpuProjectedDamage(engine.gs, pi, engine);
    if (!proj || !(proj.amount >= 0) || !Array.isArray(proj.targets)) return null;
    let dmg = 0, hk = 0, ck = 0;
    for (const t of proj.targets) {
      if (!t || !(t.hp > 0)) continue;
      dmg += Math.min(proj.amount, t.hp);   // Overkill zählt nicht als Schaden
      if (proj.amount >= t.hp) { if (t.kind === 'hero') hk++; else ck++; }
    }
    return { dmg, hk, ck };
  } catch { return null; }
}

// Prior-Korrektur aus dem aktuellen Board-Zustand. 0, solange das Profil
// weder Währung noch Regel für die Karte trägt — dann bleibt der
// statische cardValue unverändert.
function impactValueDelta(engine, pi, cardName) {
  try {
    const prof = profileFor(engine, pi);
    const w = prof?.impactWeights;
    const rules = prof?.impactRules?.[cardName];
    if (!w || !rules) return 0;
    const f = projectImpactFeatures(engine, pi, cardName);
    if (!f) return 0;
    const score = (f.dmg / 100) * (w.dmg100 || 0)
      + f.hk * (w.heroKill || 0) + f.ck * (w.creatureKill || 0);
    const bucket = score <= (w.loCut ?? -Infinity) ? 'low'
      : score >= (w.hiCut ?? Infinity) ? 'high' : 'mid';
    const d = rules[bucket];
    return typeof d === 'number' ? d : 0;
  } catch { return 0; }
}

// ── Reaktions-Fire-Lernkanal ─────────────────────────────────────────
// Hand-Reaktionen liefen bisher NUR über die feste Heuristik
// cpuReactionDecision ("fire ASAP") — anders als Surprises gab es keinen
// gelernten Kanal. Als Vorgabe: ob eine Negation den Einsatz wert ist,
// hängt am Kontext, nicht an der Karte (50 Recoil nein, 50 lethal ja).
// Gebucketed wird deshalb primär über die Schadenshärte
// (lethal/heavy/light, siehe engine._rxDamageTag — bewusst OHNE
// Verursacher-Seite, Als Ruling: eigener lethal Damage zählt genauso
// viel wie gegnerischer) und nur ersatzweise über die Zug-Phase, wenn
// kein Schaden im Spiel ist (z.B. Boots of Hermes negiert eine Surprise).
//
// WICHTIG — die Heuristik bleibt Veto: der gelernte Kanal darf nur
// ZURÜCKHALTEN, nie ein Feuern erzwingen, das die Heuristik ablehnt.
// Sie kodiert Korrektheit (Juice ohne reinigbares Ziel wäre wirkungslos),
// nicht bloß Politik. Hierarchie wie beim Surprise-Kanal:
//   1. Gelernte Regel (profile.reactionRules[card][bucket]): ≤ −4 → 'hold'.
//   2. Trainingsmodus ohne Regel: 50/50-Exploration (nur live).
//   3. Live ohne Regel: null → Heuristik entscheidet allein.
function reactionFireDecision(engine, pi, cardName, bucket) {
  try {
    const prof = profileFor(engine, pi);
    const delta = prof?.reactionRules?.[cardName]?.[bucket];
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (typeof delta === 'number' && !epsRoll) {
      if (delta >= 4) return 'fire';
      if (delta <= -4) return 'hold';
      return null;
    }
    if (process.env.PP_TRAIN && !engine._inMctsSim) {
      return Math.random() < 0.5 ? 'fire' : 'hold';
    }
  } catch { /* defensiv */ }
  return null;
}

// ── Target-Prior-Lernkanal ───────────────────────────────────────────
// Zielwahlen waren bisher rein deterministisch (Default-Picker) oder
// MCTS-Plan — es gab keinen gelernten Kanal. Dieser hier arbeitet über
// abstrakte ZielKLASSEN-Tags statt Identitäten, damit das Gelernte
// generalisiert ("friere den dicksten Helden" statt "friere Ida").
//
// classifyTargetTags: leitet für ein Ziel robuste Tags ab —
//   side:opp/side:own (relativ zum Wähler), kind:hero/kind:creature,
//   hp:max/hp:min (innerhalb gleicher Seite+Art der ANGEBOTENEN Ziele),
//   frozen. Nur ableitbare Tags werden vergeben (defensiv).
// ── Haftet ein negativer Status an diesem Ziel? ──────────────────────
// EINE Definition fuer beide Verbraucher: das Ziel-Gate in `_cpu.js`
// (welche Ziele sind fuer eine REINE Status-Abfrage sinnvoll) und das
// Lern-Tag unten (bei Karten, die Schaden UND Status tragen, soll der
// Kanal lernen, wie stark das Haften die Schadens-Prioritaet
// verschiebt — Als Vorgabe 9.8.).
//
// Gespiegelt aus `actionAddStatus`: Spielstart-Schutz, negative_status_
// immune, `immune` gegen die CC-Familie, Light Ball und Johannas Schirm
// (die nur wirkt, solange sie selbst handlungsfaehig ist).
const CC_STATUSES = ['frozen', 'stunned', 'negated', 'bound'];
const NEGATIVE_STATUSES = ['frozen', 'stunned', 'negated', 'bound',
  'poisoned', 'burning', 'burned', 'cursed', 'webbed', 'silenced'];

function statusWouldStick(engine, target, statusName) {
  try {
    if (!target || !statusName) return true;
    if (!NEGATIVE_STATUSES.includes(statusName)) return true;
    const gs = engine?.gs;
    if (!gs) return true;

    if (target.type === 'hero') {
      if (gs.firstTurnProtectedPlayer === target.owner) return false;
      const h = gs.players?.[target.owner]?.heroes?.[target.heroIdx];
      if (!h) return true;
      if (h.buffs?.negative_status_immune) return false;
      if (h.statuses?.immune && CC_STATUSES.includes(statusName)) return false;
      if (h.statuses?.charmed) return false;
      try {
        if (engine._lightBallProtects
          && engine._lightBallProtects(target.owner, 'hero', target.heroIdx)) return false;
      } catch { /* defensiv */ }
      const heroes = gs.players?.[target.owner]?.heroes || [];
      const johanna = heroes.some(j => j && j !== h
        && j.name === 'Johanna, Crusader of Light' && j.hp > 0
        && !j.statuses?.frozen && !j.statuses?.stunned
        && !j.statuses?.webbed && !j.statuses?.negated);
      if (johanna) return false;
      return true;
    }

    const inst = target.cardInstance;
    if (inst?.counters?.buffs?.negative_status_immune) return false;
    if (gs.firstTurnProtectedPlayer != null
      && (inst?.controller ?? inst?.owner) === gs.firstTurnProtectedPlayer) return false;
    return true;
  } catch { return true; }
}

function classifyTargetTags(engine, target, validTargets, pickerIdx, config) {
  const tags = [];
  try {
    if (!target) return tags;
    const kind = target.type === 'hero' ? 'hero' : 'creature';
    tags.push(`kind:${kind}`);
    if (typeof target.owner === 'number') tags.push(target.owner === pickerIdx ? 'side:own' : 'side:opp');
    // ── Haftet der angehaengte Status? (Als Vorgabe 9.8.) ────────────
    // Bei Karten, die Schaden UND Status tragen, ist KEIN Ziel wertlos,
    // nur weil der Status abprallt — der Schaden landet ja. Ob er
    // haftet, kann die Rangfolge aber verschieben. Genau diese Frage
    // gehoert in den Lernkanal statt in ein Gate: der Tag-Raum ist
    // offen, `targetPriors` lernt das Gewicht je Karte aus Ergebnissen.
    const st = typeof config?.appliesStatus === 'string' ? config.appliesStatus : null;
    if (st) tags.push(statusWouldStick(engine, target, st) ? 'stat:sticks' : 'stat:blocked');
    // ── Identität statt nur Situation (Als Einwand) ──────────────────
    // Das übrige Vokabular ist rein situativ (HP-Extreme, Status,
    // Schadensmultiplikator) — damit ließ sich "schütze IMMER den
    // mittleren Helden" grundsätzlich nicht ausdrücken, egal wie klar
    // die Gewinnquote dafür spricht. Die Hero-Zone-Position schließt
    // das: innerhalb eines Decks steht die Aufstellung fest, `pos:1`
    // IST also "der mittlere Held" — und auf der Gegnerseite bedeutet
    // es dasselbe (die Mitte trägt dort das Avatar-Portrait).
    //
    // Bewusst NUR die Position und NICHT zusätzlich der Heldenname:
    // beide wären innerhalb eines Decks perfekt kollinear (der mittlere
    // Held sitzt immer auf Position 1), und da der Prior die Tag-
    // Gewichte SUMMIERT, würde dieselbe Erkenntnis doppelt zählen.
    // Position ist zudem kompakter und über Gegnerdecks hinweg
    // vergleichbar.
    //
    // Der Trainer braucht dafür KEINE Änderung: targetPriors lernt
    // pro Karte über einen offenen Tag-Raum, jedes neue Tag bekommt
    // automatisch sein Gewicht (MIN_ARM 6 sortiert zu dünne Arme aus).
    if (kind === 'hero' && typeof target.heroIdx === 'number'
        && target.heroIdx >= 0 && target.heroIdx <= 2) {
      tags.push(`pos:${target.heroIdx}`);
    }
    // ── KARTEN-DEKLARIERTE BEDROHUNG (1.8.) ──────────────────────────
    // `threatTags` gab es auf Johanna, Crusader of Light seit langem —
    // mit dem Kommentar "Mark her as a priority target so the CPU
    // prioritizes opening with attacks that hit Johanna directly". Der
    // Vertrags-Sweep zeigte: NICHTS hat es je gelesen, das Verhalten
    // trat also nie ein. Statt es im Piloten hart zu verdrahten, geht
    // es hier in den LERNBAREN Kanal: das Vokabular hat einen offenen
    // Tag-Raum, jedes neue Tag bekommt in targetPriors automatisch sein
    // Gewicht je Karte (v93-Präzedenz, dort für `pos:`). Damit
    // entscheidet die MESSUNG, ob "zuerst Johanna" wirklich gewinnt —
    // und zwar getrennt je Deck, statt global geraten.
    //
    // Absichtlich für Helden UND Kreaturen: die Marke beschreibt die
    // Karte, nicht die Zone. Skript-Ladefehler werden geschluckt, das
    // Tagging darf nie eine Zielwahl kippen.
    try {
      const nm = target.type === 'hero'
        ? engine.gs?.players?.[target.owner]?.heroes?.[target.heroIdx]?.name
        : (target.cardInstance?.name || target.cardName);
      if (nm) {
        const tt = require('./_loader').loadCardEffect(nm)?.threatTags;
        if (Array.isArray(tt)) {
          for (const t of tt.slice(0, 4)) {
            if (typeof t === 'string' && t) tags.push(`threat:${t}`);
          }
        }
      }
    } catch { /* Tagging ist Diagnose, nie Abbruchgrund */ }
    const hpOf = (t) => {
      try {
        if (t.type === 'hero') return engine.gs?.players?.[t.owner]?.heroes?.[t.heroIdx]?.hp ?? null;
        const inst = t.cardInstance;
        return inst ? (inst.counters?.currentHp ?? null) : null;
      } catch { return null; }
    };
    const myHp = hpOf(target);
    if (myHp != null) {
      const peers = (validTargets || []).filter(t =>
        t && t !== target && (t.type === 'hero' ? 'hero' : 'creature') === kind
        && t.owner === target.owner).map(hpOf).filter(v => v != null);
      if (peers.length > 0) {
        if (myHp >= Math.max(...peers)) tags.push('hp:max');
        if (myHp <= Math.min(...peers)) tags.push('hp:min');
      }
    }
    // ── REIHEN-KONTEXT (5.8., Als Powder-Keg-Vorgabe) ────────────────
    // Bisher beschrieb das Vokabular nur den Ziel-Helden SELBST (HP,
    // Position, Status). Was in seiner Support-Reihe steht, war
    // unsichtbar — und genau daran hängt jede Karte, deren Wirkung die
    // REIHE trifft statt den Helden (Powder Kegs Todes-AoE) oder die
    // dort einen Körper platzieren will.
    //
    // Als Hypothese zu Powder Keg: "der Held mit den meisten Creatures
    // oder der, der im Laufe des Spiels die meisten beschworen hat."
    // Beides bekommt hier ein Tag — als HYPOTHESE. Das Gewicht kommt
    // wie bei jedem anderen Tag aus den Daten und darf sie widerlegen.
    // Deckneutral: reine Brettfakten, kein Kartenwissen.
    if (kind === 'hero' && typeof target.heroIdx === 'number') {
      try {
        const rowPs = engine.gs?.players?.[target.owner];
        const zones = rowPs?.supportZones?.[target.heroIdx] || [];
        const cardDB = engine._getCardDB ? engine._getCardDB() : null;
        let creatures = 0, free = 0;
        for (let si = 0; si < 3; si++) {
          const slot = zones[si] || [];
          if (slot.length === 0) { free++; continue; }
          for (const cn of slot) {
            const cd = cardDB?.[cn];
            if (cd && (cd.cardType === 'Creature' || cd.subtype === 'Creature')) creatures++;
          }
        }
        tags.push(`row:creatures:${Math.min(creatures, 3)}`);
        tags.push(`row:free:${Math.min(free, 3)}`);
        // Wie viele Kreaturen hat DIESER Held über das ganze Spiel
        // beherbergt? Der Zähler wird beim Beschwören gestempelt
        // (engine._hostedSummons), zählt also auch die längst wieder
        // gestorbenen — Als zweite Hypothese, die "wer beschwört am
        // meisten nach" von "wer hat gerade viel stehen" trennt.
        const hosted = (engine._hostedSummons?.[target.owner] || [])[target.heroIdx] || 0;
        tags.push(`row:hosted:${hosted >= 5 ? '5+' : (hosted >= 3 ? '3-4' : (hosted >= 1 ? '1-2' : '0'))}`);
      } catch { /* Tagging darf nie eine Zielwahl kippen */ }
    }
    const frozen = target.type === 'hero'
      ? !!engine.gs?.players?.[target.owner]?.heroes?.[target.heroIdx]?.statuses?.frozen
      : !!target.cardInstance?.counters?.frozen;
    if (frozen) tags.push('frozen');
    // Heil-Umwandlungs-Kontext (Als Heal-Burn-Befund): ohne dieses Tag
    // lernte der Kanal "side:opp heilen ist gut" aus Spielen, in denen
    // die Ziele Overheal Shock trugen — die Bedingung war im Signal
    // unsichtbar. Nur Helden können den Status tragen.
    if (target.type === 'hero'
      && engine.gs?.players?.[target.owner]?.heroes?.[target.heroIdx]?.statuses?.healReversed) {
      tags.push('healrev');
    }
    // Registry-Audit (Als Auftrag): Schadens-Multiplikatoren als
    // Lern-Kontext — Cloudy (0.5) & Co. waren für den Kanal unsichtbar.
    // dmg0 = Schaden sinnlos, dmgred = reduziert, dmgamp = verstärkt.
    try {
      const { BUFF_EFFECTS } = require('./_hooks');
      const buffs = target.type === 'hero'
        ? engine.gs?.players?.[target.owner]?.heroes?.[target.heroIdx]?.buffs
        : target.cardInstance?.counters?.buffs;
      if (buffs) {
        let m = 1;
        for (const k of Object.keys(buffs)) {
          const def = BUFF_EFFECTS[k];
          if (def && typeof def.damageMultiplier === 'number') m *= def.damageMultiplier;
        }
        if (m === 0) tags.push('dmg0');
        else if (m < 1) tags.push('dmgred');
        else if (m > 1) tags.push('dmgamp');
      }
    } catch { }
  } catch { /* defensiv */ }
  return tags;
}

// targetPickDecision: gewählte Ziel-ID oder null (= Aufrufer-Fallback).
// Hierarchie analog Protection Channel:
//   1. Gelernte Priors (profile.targetPriors[cardName]): Score je Ziel
//      = Σ Tag-Gewichte; nur übernehmen, wenn das Signal klar ist
//      (Bestwert deutlich vor dem Zweitplatzierten) — sonst Default.
//   2. Trainingsmodus ohne Regel: gelegentliche uniforme Exploration
//      (~35%), damit alle Tag-Arme Daten bekommen.
//   3. Live ohne Regel: null (deterministischer Default-Picker).
function targetPickDecision(engine, pi, cardName, validTargets, config = {}) {
  try {
    if (!cardName || !Array.isArray(validTargets) || validTargets.length < 2) return null;
    if (config.count && config.count > 1) return null; // nur Single-Picks
    const prof = profileFor(engine, pi);
    const priors = prof?.targetPriors?.[cardName];
    // ── ε-Exploration TROTZ Regel (9.8.) ─────────────────────────────
    // Vorher hoerte die Exploration auf, sobald eine Karte IRGENDEIN
    // Gewicht hatte: der `if (priors)`-Zweig kehrte immer zurueck, der
    // 35%-Zufallsgriff darunter war fuer sie unerreichbar. Damit friert
    // das Profil ein — Arme, die bis dahin nie gewaehlt wurden (etwa
    // `side:own`), bekommen NIE Daten, und der Trainer verlangt fuer ein
    // Gewicht MIN_ARM=6 Entscheidungen in BEIDEN Armen. Genau deshalb
    // steht in den Profilen kein einziges `side:*`-Gewicht.
    // Dasselbe Mittel wie im Heil- und Counter-Kanal: mit p=ruleEps die
    // Regel bewusst ignorieren und zufaellig ziehen.
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    // FORM 2: der Absichts-Kanal traegt auch OHNE kartenspezifische
    // Prioren — 》Heilung geht auf niedrige HP《 gilt kartenuebergreifend.
    // Deshalb reicht EINE der beiden Quellen, damit gewaehlt wird.
    const hatAbsicht = !!profileFor(engine, pi)?.targetIntentRules;
    if ((priors || hatAbsicht) && !epsRoll) {
      let best = null, bestScore = -Infinity, second = -Infinity;
      for (const t of validTargets) {
        const tags = classifyTargetTags(engine, t, validTargets, pi, config);
        const s = tags.reduce((sum, g) => sum + ((priors && priors[g]) || 0), 0)
          + targetIntentBonus(engine, pi, cardName, t, config);
        if (s > bestScore) { second = bestScore; bestScore = s; best = t; }
        else if (s > second) { second = s; }
      }
      if (best && bestScore - second >= 4) return [best.id];
      return null;
    }
    if (process.env.PP_TRAIN && Math.random() < 0.35) {
      const t = validTargets[Math.floor(Math.random() * validTargets.length)];
      return t ? [t.id] : null;
    }
  } catch { /* defensiv */ }
  return null;
}

// ── Gegner-Verhaltens-Cluster ──
// Ordnet einen Verhaltens-Fingerprint {atk, cre, spl} (Zählungen bis
// ~Zug 8: gegnerische Attack-Casts, Kreaturen-Summons, Spell-Casts)
// einem groben Archetyp zu. WICHTIG: Trainer (train-deck-profile.js)
// und Laufzeit (_cpu.js) MÜSSEN identisch clustern — deshalb lebt die
// Funktion hier im geteilten Modul. Identität des Gegners ist bewusst
// KEIN Input (Als Regel: kein "gegen Deck Y tue Z"), nur beobachtetes
// Verhalten.
function clusterOfFingerprint(fp) {
  if (!fp) return 'mixed';
  // dmg = Helden-Schadenseinheiten (à 150 Schaden) bis Zug 8 — die
  // ehrliche Aggro-Achse: "Attack"-cardType wäre irreführend, weil die
  // meisten Burst-Karten (Icebolt, Phoenix Tackle …) cardType 'Spell'
  // tragen. spell-lastig OHNE Schadensdruck ≈ Stall/Combo-Verhalten.
  const dmg = fp.dmg || 0, cre = fp.cre || 0, spl = fp.spl || 0;
  const total = dmg + cre + spl;
  if (total < 4) return 'mixed'; // zu wenig Signal für eine Zuordnung
  const shares = [['aggro', dmg / total], ['swarm', cre / total], ['spell', spl / total]]
    .sort((a, b) => b[1] - a[1]);
  // Dominanz: klarer Abstand zur zweitstärksten Achse ODER absolute
  // Mehrheit. Sonst 'mixed'.
  if (shares[0][1] >= 0.5 || shares[0][1] - shares[1][1] >= 0.15) return shares[0][0];
  return 'mixed';
}

// ── Ketten-Lernkanal (Als Auftrag nach der Pilot-Vergleichsanalyse) ──
// Die Deepsea-Linie gewinnt über einen ZYKLUS: eine Kreatur von der Hand
// nimmt den Slot einer Kreatur auf dem Board ein, die dadurch auf die
// Hand zurückkehrt und dort sofort wieder spielbar ist. Bis v83 wählte
// `pickBouncePlacementSlot` das Opfer per Math.random() — es gab gar
// keine Politik dafür, WELCHE Kreatur zurückgeholt wird.
//
// Als Ruling: die Karten mit der höchsten Ausspiel-Priorität sollen auch
// mit höchster Priorität zurückgebounct werden (sie stehen dann bereit,
// um erneut zu feuern). AUSNAHME: eine Board-Konstellation, die gerade
// eine Opfer-Bedingung erfüllt (`sacrificeSpec` — bei Deepsea "2 Kreaturen,
// Summenlevel ≥ 4" für Dark Deepsea God), darf nicht beiläufig aufgelöst
// werden. Beides wird hier NICHT hartkodiert, sondern als Tags beschrieben;
// die Gewichte lernt der Trainer aus Outcomes (Kanal `bounceRules`).
//
// Tag-Vokabular (deckneutral, rein aus Verträgen abgeleitet):
//   bnc:val:hi|mid|lo   — gelernter Kartenwert des Opfers (Tertile)
//   bnc:lvl:N           — Level des Opfers (0/1/2/3+)
//   bnc:dup             — eine Kopie liegt bereits auf der Hand
//   bnc:spec-break      — dieser Bounce zerstört eine ERFÜLLTE Opfer-
//                         Bedingung einer Handkarte (die DDG-Ausnahme)
//   bnc:spec-keep       — Bedingung ist erfüllt und bleibt es
//   bnc:spec-help       — Bedingung ist NICHT erfüllt, das Opfer trägt
//                         auch nichts dazu bei (Bounce unschädlich)
function classifyBounceTags(engine, pi, victim) {
  const tags = [];
  try {
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    if (!ps || !victim) return tags;
    const db = engine._getCardDB ? engine._getCardDB() : null;
    const vName = victim.name;
    const vCd = db ? db[vName] : null;

    // (1) Wert-Tertil des Opfers — der Kanal, über den Al's Regel
    // "die wertvollsten zurückholen" gelernt werden kann.
    const val = learnedCardValue(engine, pi, vName);
    if (typeof val === 'number') {
      tags.push('bnc:val:' + (val >= 55 ? 'hi' : val >= 25 ? 'mid' : 'lo'));
    }
    // (2) Level (auch ohne Profil verfügbar)
    const lvl = vCd?.level || 0;
    tags.push('bnc:lvl:' + (lvl >= 3 ? '3+' : String(lvl)));
    // (3) Liegt schon eine Kopie auf der Hand? Dann bringt der Bounce
    // keinen neuen Trigger-Träger, sondern nur eine Dublette.
    if ((ps.hand || []).includes(vName)) tags.push('bnc:dup');

    // (4) Opfer-Bedingungen (generisch über sacrificeSpec). Erfüllt das
    // Board gerade die Bedingung einer Handkarte, und würde sie ohne
    // dieses Opfer NICHT mehr erfüllt sein?
    const { loadCardEffect } = require('./_loader');
    let sacs = [];
    try { sacs = engine.getSacrificableCreatures ? (engine.getSacrificableCreatures(pi) || []) : []; } catch {}
    const cnt = sacs.length;
    const sum = sacs.reduce((a, c) => a + (c.level || 0), 0);
    // getSacrificableCreatures liefert WRAPPER {inst, level, cardName} —
    // die Identität hängt an c.inst, nicht am Wrapper selbst.
    const inPool = sacs.some(c => {
      if (!c) return false;
      const ci = c.inst || c;
      return ci === victim || (ci?.id != null && ci.id === victim.id);
    });
    const cntAfter = inPool ? cnt - 1 : cnt;
    const sumAfter = inPool ? sum - lvl : sum;
    let satBefore = false, satAfter = false;
    const seen = new Set();
    for (const hn of (ps.hand || [])) {
      if (seen.has(hn)) continue;
      seen.add(hn);
      let sc = null;
      try { sc = loadCardEffect(hn); } catch { continue; }
      const spec = sc?.sacrificeSpec
        || ((sc?.minSumLevel > 0) ? { minCount: sc.minCount, minSumLevel: sc.minSumLevel } : null);
      const msl = spec?.minSumLevel, mcnt = spec?.minCount || 0;
      if (!(msl > 0)) continue;
      if (cnt >= mcnt && sum >= msl) satBefore = true;
      if (cntAfter >= mcnt && sumAfter >= msl) satAfter = true;
    }
    if (satBefore && !satAfter) tags.push('bnc:spec-break');
    else if (satBefore) tags.push('bnc:spec-keep');
    else tags.push('bnc:spec-help');
  } catch { /* Tags sind optional — nie den Zug stören */ }
  return tags;
}

function bouncePrior(engine, pi, tags) {
  try {
    const rules = profileFor(engine, pi)?.bounceRules;
    if (!rules) return 0;
    return (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
  } catch { return 0; }
}

/**
 * Erfüllt das Board gerade die Opfer-Bedingung einer Handkarte, und ist
 * genau DIESE Karte die zugehörige? Generisch über `sacrificeSpec` —
 * liefert die Grundlage für den gelernten Tag `spec:ready`, mit dem die
 * CPU lernen kann, eine erfüllbare Opfer-Karte vorzuziehen statt die
 * Konstellation vorher aufzulösen.
 */
function sacrificeSpecReady(engine, pi, cardName) {
  try {
    const { loadCardEffect } = require('./_loader');
    let sc = null;
    try { sc = loadCardEffect(cardName); } catch { return false; }
    const spec = sc?.sacrificeSpec
      || ((sc?.minSumLevel > 0) ? { minCount: sc.minCount, minSumLevel: sc.minSumLevel } : null);
    const msl = spec?.minSumLevel, mcnt = spec?.minCount || 0;
    if (!(msl > 0)) return false;
    let sacs = [];
    try { sacs = engine.getSacrificableCreatures ? (engine.getSacrificableCreatures(pi) || []) : []; } catch {}
    const sum = sacs.reduce((a, c) => a + (c.level || 0), 0);
    if (!(sacs.length >= mcnt && sum >= msl)) return false;
    // ── Die KARTE hat das letzte Wort (Messung 30.7.) ────────────────
    // `getSacrificableCreatures` liefert die ROHE Opfer-Menge ohne die
    // karteneigenen Zusatzregeln. Dark Deepsea God verlangt in seinem
    // `canSummon` ausdrücklich Kreaturen, die NICHT in dieser Runde
    // beschworen wurden — dieser Filter fehlte hier, also galt DDG als
    // bereit, während der Server den Play verwarf (353 "server-nein" im
    // v107-Lauf, Platz 2 aller Karten). Reproduziert: bei Körpern aus
    // der laufenden Runde sagte diese Funktion true und
    // `isCreatureSummonable` false.
    // Statt die Regel hier nachzubauen, wird die Karte selbst gefragt —
    // dieselbe Lehre wie bei der v103-Legalitäts-Asymmetrie. Karten
    // ohne `canSummon` sind unberührt.
    try {
      if (typeof engine.isCreatureSummonable === 'function'
        && !engine.isCreatureSummonable(cardName, pi)) return false;
    } catch { /* im Zweifel die bisherige Antwort behalten */ }
    return true;
  } catch { return false; }
}

function specReadyPrior(engine, pi) {
  try {
    const rules = profileFor(engine, pi)?.bounceRules;
    if (!rules) return 0;
    return rules['spec:ready'] || 0;
  } catch { return 0; }
}

// ── Ausspiel-Reihenfolge (Kanal `playOrderRules`) ───────────────────
// Schwester des Bounce-Kanals: dort geht es um "welche Kreatur hole ich
// zurück", hier um "welche Karte spiele ich als NÄCHSTES". Bis v84 lief
// die Auswahl der Gratis-/Zusatz-Plays in roher Handreihenfolge.
//
// Tag-Vokabular (deckneutral):
//   (pord:val:* entfernt — der Wert geht direkt in _orderScore ein)
//   pord:swap          — der Play würde einen besetzten Slot einnehmen
//                        (Zyklus-Zug) statt einen freien zu füllen
//   pord:spec-ready    — die Opfer-Bedingung dieser Karte ist erfüllt
//   pord:first         — es ist der erste Play dieses Zuges
// Damit kann der Trainer u.a. lernen, ob Enabler zuerst gehören
// (pord:first × Wert-Tertil) oder ob Swaps früh oder spät besser laufen.
function classifyPlayOrderTags(engine, pi, cardName) {
  const tags = [];
  try {
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    if (!ps || !cardName) return tags;
    const val = learnedCardValue(engine, pi, cardName);
    if (typeof val === 'number') {
      // ── ENTFERNT (31.7., nach dem Iter2-Einbruch) ────────────────────
      // Der gelernte Kartenwert geht in `_orderScore` BEREITS direkt ein
      // (`learnedCardValue × 0.1`). Ihn zusätzlich als Tertil-Tag zu
      // führen zählt ihn DOPPELT — und beide Wege werden unabhängig
      // kalibriert, können also gegeneinander laufen.
      // Gemessen im Iter2-Profil: `pord:val:lo` bekam −11.6 und
      // `pord:val:mid` +11.6. Deepsea Primordium trägt IMMER `val:lo`
      // UND `grants-action` (−11) → zusammen −22.6, während Werewolf mit
      // `val:mid` + `swap` + `first` auf +30.4 kommt. Über 60 Punkte
      // Abstand allein aus dem Prior: der Motor sortierte damit garantiert
      // hinter alle Nutznießer. Iter2 fiel von 53.8% auf 42.5% (z≈2.0).
      // Zusätzlich war der Tag defekt: `hi` feuerte in 1741 Einträgen
      // KEIN einziges Mal, die Tertil-Grenzen 55/25 stammen aus einer
      // alten Wertverteilung. Statt sie nachzueichen fällt der Tag ganz
      // weg — die Information ist im Score ohnehin schon vorhanden.
      // (Zeile bewusst als Kommentar dokumentiert, nicht still gelöscht.)
    }
    const { loadCardEffect } = require('./_loader');
    let sc = null;
    try { sc = loadCardEffect(cardName); } catch { sc = null; }
    // Zyklus-Zug? Die Karte trägt den Swap-Vertrag UND es gibt einen
    // besetzten Slot, den sie einnehmen dürfte.
    if (typeof sc?.canPlaceOnOccupiedSlot === 'function') {
      let swap = false;
      outer:
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        for (let z = 0; z < 3; z++) {
          if (!((ps.supportZones?.[hi] || [])[z] || []).length) continue;
          try {
            if (sc.canPlaceOnOccupiedSlot(gs, pi, hi, z, engine)) { swap = true; break outer; }
          } catch { /* einzelner Slot unklar */ }
        }
      }
      if (swap) tags.push('pord:swap');
    }
    if (sacrificeSpecReady(engine, pi, cardName)) tags.push('pord:spec-ready');
    if (!(ps.heroesActedThisTurn || []).length) tags.push('pord:first');

    // ── DECKNEUTRALE LAGE-TAGS (Messbefund 24.8.) ────────────────────
    // GEMESSEN an heal-burn (5440 Entscheidungen aus 1360 Partien):
    // im gesamten Datensatz kam GENAU EIN Tag vor — `pord:first`, und
    // das auf 94 % aller Zeilen. Alle anderen Tags oben haengen an
    // DECKSPEZIFISCHEN Vertraegen (`canPlaceOnOccupiedSlot`,
    // `sacrificeSpec`, Grant-Geber, On-Summon-Kopierer); ein Deck ohne
    // diese Vertraege hat gar keinen Tag-Raum. Genau deshalb haben nur
    // 3 von 42 Profilen `playOrderRules` — und zwei davon nur die
    // 94-%-Muenze.
    //
    // Ein Tag auf 94 % misst nicht die LAGE, sondern den Deckmittelwert,
    // und der Prior SUMMIERT ihn neben allem, was ihn erklaert. Der
    // Kanal braucht also Merkmale, die in JEDEM Deck feuern und echten
    // Kontrast erzeugen. Alles hier ist aus dem Zustand abgeleitet, kein
    // Kartenwissen, keine Namen.
    //
    // NICHT NACHHOLBAR: was hier fehlt, fehlt allen je gesammelten
    // Spielen. Deshalb lieber grosszuegig — der Praevalenzfilter und das
    // t-Gate im Trainer werfen raus, was nichts traegt.
    const stufe = (v, grenzen, namen) => {
      for (let i = 0; i < grenzen.length; i++) if (v <= grenzen[i]) return namen[i];
      return namen[namen.length - 1];
    };

    // (1) DIE EIGENTLICHE REIHENFOLGE: der wievielte freie Play dieses
    //     Zuges ist das? Genau die Information, um die es im Kanal geht —
    //     und sie fehlte bisher vollstaendig. Aus dem Log ablesbar, ohne
    //     neuen Zustand.
    let seq = 0;
    try {
      for (const e of (engine._playOrderLog || [])) {
        if (e.pi === pi && e.t === (gs.turn || 0)) seq++;
      }
    } catch { /* egal */ }
    tags.push('pord:seq:' + stufe(seq, [0, 1, 2], ['1', '2', '3', '4+']));

    // (2) Karten-Steckbrief: Typ und Level.
    let cd = null;
    try { cd = engine._getCardDB ? engine._getCardDB()[cardName] : null; } catch { cd = null; }
    if (cd) {
      if (cd.cardType) tags.push('pord:type:' + String(cd.cardType).toLowerCase());
      if (typeof cd.level === 'number') tags.push('pord:lvl:' + stufe(cd.level, [0, 1, 2], ['0', '1', '2', '3+']));
    }

    // (3) Phase — MP1, Action Phase und MP2 sind voellig verschiedene
    //     Gelegenheiten.
    if (gs.currentPhase != null) tags.push('pord:ph:' + gs.currentPhase);

    // (4) Ressourcenlage: Hand, Gold, Restdeck.
    const hand = (ps.hand || []).length;
    tags.push('pord:hand:' + stufe(hand, [2, 4, 6], ['0-2', '3-4', '5-6', '7+']));
    if (typeof ps.gold === 'number') {
      tags.push('pord:gold:' + stufe(ps.gold, [0, 3, 7], ['0', '1-3', '4-7', '8+']));
    }

    // (5) Brettfuellung: wie viele eigene Support-Slots sind belegt?
    let belegt = 0, slots = 0;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const held = ps.heroes[hi];
      if (!held || !held.name || held.hp <= 0) continue;
      for (let z = 0; z < 3; z++) {
        slots++;
        if (((ps.supportZones?.[hi] || [])[z] || []).length) belegt++;
      }
    }
    if (slots > 0) {
      const anteil = belegt / slots;
      tags.push('pord:board:' + (anteil === 0 ? 'leer' : anteil < 0.5 ? 'teil' : anteil < 1 ? 'voll' : 'dicht'));
    }

    // (6) STANDING an lebenden Helden (Als ausdrueckliche Vorgabe:
    //     》'behind' gemessen an der Anzahl lebender Heroes《). Fein
    //     abgestuft statt binaer — 》einer hinten《 und 》zwei hinten《 sind
    //     verschiedene Spiele.
    const oi = pi === 0 ? 1 : 0;
    const lebend = (q) => ((gs.players?.[q]?.heroes) || []).filter(h => h && (h.hp || 0) > 0).length;
    const hd = lebend(pi) - lebend(oi);
    tags.push('pord:hd:' + (hd <= -2 ? '-2' : hd === -1 ? '-1' : hd === 0 ? '0' : hd === 1 ? '+1' : '+2'));

    // (7) HP-Verhaeltnis — Helden koennen alle stehen und trotzdem am
    //     Rand sein.
    const hpSum = (q) => ((gs.players?.[q]?.heroes) || []).reduce((a, h) => a + Math.max(0, (h && h.hp) || 0), 0);
    const eigen = hpSum(pi), fremd = hpSum(oi);
    if (eigen + fremd > 0) {
      const q = eigen / (eigen + fremd);
      tags.push('pord:hp:' + (q < 0.35 ? 'lo' : q < 0.5 ? 'unter' : q < 0.65 ? 'ueber' : 'hi'));
    }

    // ── MOTOR-ROLLE der Karte (Messung 30.7.) ────────────────────────
    // Das bisherige Vokabular beschrieb nur WERT und LAGE, nie die
    // FUNKTION einer Karte in der Kette. Genau dort lag der blinde
    // Fleck: der Ausspiel-Rang läuft über `learnedCardValue`, und die
    // Motor-Karten stehen dort am Boden-Anschlag (Primordium 8 von 100,
    // Dark Deepsea God fehlt ganz), weil ihr Beitrag ERMÖGLICHEND ist
    // und in Einzelspiel-Korrelationen nicht auftaucht. Sie sortieren
    // deshalb hinter die Nutznießer, die sie erst bezahlen.
    // Zwei generische, aus den Karten-Verträgen abgeleitete Tags geben
    // dem Lerner erstmals die Möglichkeit, "Enabler gehören nach vorn"
    // überhaupt zu FORMULIEREN — hartkodiert wird nichts, das Gewicht
    // kommt wie bei allen anderen Tags aus den Daten und kann auch
    // widerlegt werden.
    //
    // (a) Schenkt die Karte eine Zusatz-Aktion? Erkannt an einem
    //     `registerAdditionalActionType`-Aufruf im Skript-Quelltext —
    //     das ist der einzige Weg, einen Grant zu erzeugen, und er ist
    //     deck- und namensunabhängig.
    if (scriptGrantsAdditionalAction(cardName)) tags.push('pord:grants-action');
    // (b) Löst die Karte einen FREMDEN On-Summon-Effekt erneut aus
    //     (Kopier-/Retrigger-Karten)? Ebenfalls am Vertrag erkannt.
    if (scriptCopiesOnSummon(cardName)) tags.push('pord:copies-onsummon');

    // (c) Würde dieser Play den Motor TROCKENLEGEN? Opfer-Beschwörungen
    //     nehmen Körper vom Board; bleiben danach zu wenige ALTE
    //     Kreaturen übrig, bricht die Kette in der Folgerunde ab.
    //     Gemessen: nach einem CPU-DDG folgen im nächsten eigenen Zug
    //     im Schnitt 0.46 gewichtete Trigger (75% Null-Züge), bei Al
    //     3.71 — er castet aus einem breiten Board heraus. Der Tag
    //     BLOCKT nichts, er beschreibt nur die Lage; ob "trotzdem
    //     spielen" richtig ist, entscheidet das gelernte Gewicht.
    try {
      const { loadCardEffect: _lce } = require('./_loader');
      const _sc = _lce(cardName);
      const _spec = _sc?.sacrificeSpec;
      if (_spec && typeof _spec === 'object') {
        let sacs = [];
        try { sacs = engine.getSacrificableCreatures ? (engine.getSacrificableCreatures(pi) || []) : []; } catch { }
        // Nur Körper zählen, die die Karte auch WIRKLICH als Tribut
        // akzeptiert. Ohne diesen Filter beschrieb der Tag eine Lage,
        // die es nicht gibt (siehe sacrificeSpecReady, 30.7.).
        if (typeof _spec.filter === 'function') {
          try { sacs = sacs.filter(c => _spec.filter(c)); } catch { }
        }
        const turnNow = engine.gs?.turn || 0;
        try { sacs = sacs.filter(c => (c.inst?.turnPlayed || 0) !== turnNow); } catch { }
        const need = _spec.minCount || 0;
        // Nach dem Opfer verbleibende recycelbare Körper (das Opfer
        // selbst landet auf der Hand, der neue Körper ist frisch).
        const left = Math.max(0, sacs.length - need);
        tags.push(left >= 2 ? 'pord:spec-keeps-engine' : 'pord:spec-strands');
      }
    } catch { /* optional */ }
  } catch { /* Tags sind optional */ }
  return tags;
}

// ── Vertrags-Erkennung für die Motor-Rollen-Tags ───────────────────────
// Beide Prüfungen lesen den Skript-QUELLTEXT einmalig und cachen das
// Ergebnis. Grund: ein Grant entsteht ausschließlich über
// `registerAdditionalActionType`, ein Fremd-Retrigger ausschließlich über
// `runHooks('onPlay', …)` aus einem anderen Skript heraus — beides ist im
// Quelltext eindeutig und braucht KEINE neue Deklaration auf 220 Karten.
// Falsch-Positive sind harmlos (der Lerner gewichtet den Tag dann auf 0),
// Falsch-Negative kosten nur die Lernchance.
const _roleCache = new Map();
function _scriptSource(cardName) {
  if (_roleCache.has(cardName)) return _roleCache.get(cardName);
  let src = '';
  try {
    const { loadCardEffect } = require('./_loader');
    const sc = loadCardEffect(cardName);
    if (sc) {
      // Über require.cache an den Dateipfad kommen, ohne den Loader
      // anzufassen; scheitert das, bleibt src leer → beide Tags aus.
      const fs = require('fs'), path = require('path');
      const slug = cardName.toLowerCase()
        .replace(/['’.,!?:]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const p = path.join(__dirname, slug + '.js');
      if (fs.existsSync(p)) src = fs.readFileSync(p, 'utf-8');
    }
  } catch { src = ''; }
  _roleCache.set(cardName, src);
  return src;
}
function scriptGrantsAdditionalAction(cardName) {
  const s = _scriptSource(cardName);
  return !!s && /registerAdditionalActionType\s*\(/.test(s) && /grantAdditionalAction\s*\(/.test(s);
}
function scriptCopiesOnSummon(cardName) {
  const s = _scriptSource(cardName);
  return !!s && /runHooks\s*\(\s*['"]onPlay['"]/.test(s);
}

// ─── Counter-Ausgabe-Kanal (5.8., Als Vorgabe) ────────────────────────
//
// Als Auftrag: "eine HOHE Belohnung dafuer, nicht in der Base-Form den
// Zug zu beenden — der Base-Form-Effekt ist voellig legitim, aber sie
// soll damit NICHT den letzten Counter verbrennen."
//
// Das ist eine Entscheidung, die der Sofortbewertung strukturell
// entgeht: "Draw 3" liest sich als +3 Handkarten und damit klar
// positiv, waehrend der verzichtete Aufstieg (HP/ATK-Sprung, freigesetzte
// Bombs, der ganze Descend-Zyklus) erst spaeter und ueber mehrere Zuege
// anfaellt. Gemessen kostete das den Archetyp 310 Zaehler in 500 Spielen
// — rund 28% des gesamten Aufkommens, rechnerisch ~77 nicht gemachte
// Deep-Drowned-Aufstiege.
//
// Deshalb ein eigener getaggter Kanal statt einer Verdrahtung: Das
// Vokabular beschreibt die LAGE (wie viele Zaehler, blockiert die
// Ausgabe einen bezahlbaren Aufstieg, steht der Held in der Basisform),
// die Gewichte kommen aus den Daten. Der Trainer formt dabei das Label
// mit einem starken Term dafuer, ob der Zug in einer Ascended Form
// endete — das ist Als "hohe Belohnung", und sie wirkt gerichtet:
// dieselbe Ausgabe bekommt in der Basisform mit blockiertem Aufstieg
// ein anderes Vorzeichen als an einer aufgestiegenen Form.
//
// Getrieben vom Karten-Vertrag `cpuMeta.counterSpend` — kein
// Archetyp-Wissen hier. Meldet die Karte Kosten 0 (die vier
// Descend-Formen LEGEN Zaehler nach), bleibt der Kanal stumm.

function counterSpendContext(engine, pi, heroIdx) {
  try {
    const { loadCardEffect } = require('./_loader');
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return null;
    const spend = loadCardEffect(hero.name)?.cpuMeta?.counterSpend;
    if (!spend || typeof spend.cost !== 'function' || typeof spend.get !== 'function') return null;
    const cost = spend.cost(engine, pi, heroIdx);
    if (!(cost > 0)) return null;
    const have = Number(spend.get(engine, pi, heroIdx)) || 0;
    if (have < cost) return null;
    return { spend, cost, have, hero };
  } catch { return null; }
}

/**
 * Waere nach der Ausgabe noch ein Aufstieg aus der HAND bezahlbar?
 *
 * Reversible Probe: Stand senken, jede Ascended-Hero-Karte der Hand
 * ihre eigene `ascensionCondition` fragen, Stand zuruecksetzen. Damit
 * braucht der Classifier weder die Preise der Formen noch ihre Namen —
 * er fragt genau den Vertrag, den auch `tryAscend` fragt.
 */
function ascensionAffordableAt(engine, pi, heroIdx, ctx, level) {
  const { loadCardEffect } = require('./_loader');
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  const cardDB = engine._getCardDB ? engine._getCardDB() : null;
  const before = ctx.spend.get(engine, pi, heroIdx);
  let ok = false;
  try {
    ctx.spend.set(engine, pi, heroIdx, level);
    for (const cn of (ps?.hand || [])) {
      if (cardDB?.[cn]?.cardType !== 'Ascended Hero') continue;
      const sc = loadCardEffect(cn);
      if (typeof sc?.ascensionCondition !== 'function') continue;
      try {
        if (sc.ascensionCondition(gs, pi, heroIdx, engine)) { ok = true; break; }
      } catch { /* einzelne Form unklar */ }
    }
  } finally {
    ctx.spend.set(engine, pi, heroIdx, before);
  }
  return ok;
}

function classifyCounterSpendTags(engine, pi, heroIdx) {
  const tags = [];
  try {
    const ctx = counterSpendContext(engine, pi, heroIdx);
    if (!ctx) return tags;
    const left = Math.max(0, ctx.have - ctx.cost);
    tags.push(`cs:have:${ctx.have >= 4 ? '4+' : String(ctx.have)}`);
    tags.push(`cs:left:${left >= 3 ? '3+' : String(left)}`);

    const cardDB = engine._getCardDB ? engine._getCardDB() : null;
    tags.push(cardDB?.[ctx.hero.name]?.cardType === 'Ascended Hero' ? 'cs:ascended' : 'cs:base');

    const nowOk = ascensionAffordableAt(engine, pi, heroIdx, ctx, ctx.have);
    if (!nowOk) {
      // Kein Aufstieg auf der Hand bezahlbar — die Ausgabe kostet
      // aktuell gar keine Gelegenheit. Wichtiger Kontrastarm: ohne ihn
      // lernte der Kanal "ausgeben ist schlecht" auch dort, wo nichts
      // zu verpassen war.
      tags.push('cs:no-ascend-now');
    } else if (ascensionAffordableAt(engine, pi, heroIdx, ctx, ctx.have - ctx.cost)) {
      tags.push('cs:keeps-ascend');
    } else {
      tags.push('cs:blocks-ascend');
    }
    tags.push(engine.gs?.currentPhase === 4 ? 'cs:mp2' : 'cs:mp1');
  } catch { /* Tagging ist Diagnose, nie Abbruchgrund */ }
  return tags;
}

function counterSpendPrior(engine, pi, heroName, tags) {
  try {
    const rules = profileFor(engine, pi)?.counterSpendRules?.[heroName];
    if (!rules) return 0;
    const raw = (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
    // Deckel auf der SUMME, nicht nur je Tag. Der Trainer filtert
    // universelle Tags zwar heraus, aber mehrere echte Lage-Tags koennen
    // sich weiterhin addieren; ohne Deckel waere die Schwelle von ±4
    // schon bei drei mittelstarken Tags bedeutungslos und der Kanal
    // liefe auf "immer skip" bzw. "immer play" hinaus.
    return Math.max(-20, Math.min(20, raw));
  } catch { return 0; }
}

/**
 * 'play' | 'skip' | null (= keine Meinung, regulaeres Gate entscheidet).
 *
 * Ohne Profil IMMER null → exakt das bisherige Verhalten, das Deck
 * lernt sich die Regel selbst an. Im Training sorgt Exploration fuer
 * beide Arme; die ε-Rest-Exploration trotz vorhandener Regel folgt der
 * Begruendung des Heil-Kanals (sonst erstickt eine negative Regel den
 * fired-Arm und die naechste Iteration lernt nur noch aus Altbestand).
 */
function counterSpendDecision(engine, pi, heroName, tags) {
  try {
    if (!tags || tags.length === 0) return null;
    const rules = profileFor(engine, pi)?.counterSpendRules?.[heroName];
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (rules && !epsRoll) {
      const score = counterSpendPrior(engine, pi, heroName, tags);
      if (score >= 4) return 'play';
      if (score <= -4) return 'skip';
      return null;
    }
    const explore = parseFloat(process.env.PP_COUNTER_EXPLORE || '0.3');
    if (process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < explore) {
      return Math.random() < 0.5 ? 'skip' : 'play';
    }
  } catch { /* defensiv */ }
  return null;
}

/**
 * Liegt in der Hand eine Karte, die diesen Status anlegen kann?
 *
 * Deckneutral ueber zwei Vertraege: `cpuMeta.appliesStatuses: [...]`
 * und das schon vorhandene `targetingConfig.appliesStatus`. BEWUSST
 * KEIN Textscan — "Burned"/"Poisoned" stehen auch in Karten, die nur
 * AUF den Status reagieren (die Waflav-Formen selbst sagen "Whenever a
 * target is Burned"), ein Scan wuerde also genau die Karte als Applier
 * zaehlen, deren Passung er messen soll. Preis dieser Entscheidung:
 * die Messung sieht nur DEKLARIERTE Applier und untertreibt, solange
 * nicht mehr Karten den Vertrag tragen.
 */
function handHasStatusApplier(engine, pi, status) {
  try {
    if (!status) return false;
    const { loadCardEffect } = require('./_loader');
    for (const cn of (engine.gs?.players?.[pi]?.hand || [])) {
      const sc = loadCardEffect(cn);
      if (!sc) continue;
      const list = sc.cpuMeta?.appliesStatuses;
      if (Array.isArray(list) && list.includes(status)) return true;
      const single = sc.targetingConfig?.appliesStatus;
      if (typeof single === 'string' && single === status) return true;
    }
  } catch { /* Messung darf nie stoeren */ }
  return false;
}

/**
 * Kann dieser Held gerade zuschlagen — also einen Defeat-Trigger
 * ueberhaupt ausloesen? Deckneutral: eine Attack-Karte auf der Hand,
 * die dieser Held nach seinen Abilities auch nutzen darf.
 */
function heroCanAttackNow(engine, pi, heroIdx) {
  try {
    const { loadCardEffect } = require('./_loader');
    const cardDB = engine._getCardDB ? engine._getCardDB() : null;
    for (const cn of (engine.gs?.players?.[pi]?.hand || [])) {
      const cd = cardDB?.[cn];
      if (!cd || cd.cardType !== 'Attack') continue;
      if (typeof engine.heroMeetsLevelReq === 'function') {
        try {
          if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) continue;
        } catch { /* unklar → als nutzbar werten */ }
      }
      return true;
    }
  } catch { /* Messung darf nie stoeren */ }
  return false;
}

/**
 * Zugende-Stempel: wie steht der Counter-Held am Ende des eigenen Zuges?
 *
 * Als Auftrag 6.8. — zusaetzlich zur Basis/Ascended-Frage soll messbar
 * werden, auf WELCHER Form die CPU landet und wie oft sie pro Zug
 * descendet. Bewertbar wird die Formwahl erst durch den Kontext, denn
 * die Formen ziehen ihre Zaehler aus verschiedenen Quellen:
 *   defeat  (Basis, Thunderstruck) → braucht eine nutzbare Attack
 *   status  (Flamebathed/Burn, Swampborne/Poison) → braucht einen Applier
 *   none    (Stormkissed, Deep-Drowned) → hat gar keine laufende Quelle
 * Deshalb wandert neben dem Formnamen auch `src` (die Quelle laut
 * Karten-Vertrag `cpuMeta.counterSource`) und `fit` (ist der noetige
 * Ausloeser ueberhaupt zur Hand?) in den Record. Damit laesst sich Als
 * Rangfolge nachher PRUEFEN statt sie zu unterstellen.
 *
 * Nur Helden mit `counterConsumer`-Vertrag — fuer andere Decks bleibt
 * das Feld leer und der Kanal komplett stumm.
 */
function classifyFormTurn(engine, pi) {
  try {
    const { loadCardEffect } = require('./_loader');
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    const cardDB = engine._getCardDB ? engine._getCardDB() : null;
    const turn = gs?.turn || 0;
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const sc = loadCardEffect(hero.name);
      if (!sc?.cpuMeta?.counterConsumer) continue;
      const ascended = cardDB?.[hero.name]?.cardType === 'Ascended Hero' ? 1 : 0;
      let evo = 0;
      try { evo = Number(sc.cpuMeta.counterSpend?.get?.(engine, pi, hi)) || 0; } catch { evo = 0; }
      let couldAscend = 0;
      for (const cn of (ps.hand || [])) {
        if (cardDB?.[cn]?.cardType !== 'Ascended Hero') continue;
        const asc = loadCardEffect(cn);
        if (typeof asc?.ascensionCondition !== 'function') continue;
        try {
          if (asc.ascensionCondition(gs, pi, hi, engine)) { couldAscend = 1; break; }
        } catch { /* einzelne Form unklar */ }
      }
      // Counter-Quelle der Endform und ob ihr Ausloeser zur Hand ist
      const cSrc = sc.cpuMeta.counterSource || null;
      let src = 'unknown', fit = 0;
      if (cSrc?.kind === 'defeat') {
        src = 'defeat';
        fit = heroCanAttackNow(engine, pi, hi) ? 1 : 0;
      } else if (cSrc?.kind === 'status') {
        src = cSrc.status || 'status';
        fit = handHasStatusApplier(engine, pi, cSrc.status) ? 1 : 0;
      } else if (cSrc?.kind === 'none') {
        src = 'none';
        fit = 0;   // per Definition kein Ausloeser — die Form sammelt nicht
      }
      // Wie viele Abstiege in DIESEM Zug?
      let desc = 0;
      try {
        desc = (engine._descendLog || []).filter(d => d.pi === pi && d.t === turn).length;
      } catch { /* egal */ }
      // Wie viele VERSCHIEDENE Formen liegen unter der aktuellen? Das
      // ist die Groesse des Stapels, den ein Rueckwaerts-Abbau spaeter
      // in Zaehler verwandeln kann.
      let stack = 0;
      try { stack = new Set(hero._formStack || []).size; } catch { /* egal */ }
      return { t: turn, asc: ascended, evo, ca: couldAscend,
        form: hero.name, src, fit, desc, stack };
    }
  } catch { /* defensiv */ }
  return null;
}

// ─── Descend-Kanal (Als Auftrag 6.8., "mach wie du für richtig hältst") ──
//
// Gemessen im Lauf nach v259: Ø Formstapel 1.05, und 70% aller Abstiege
// gehen von Stormkissed aus. Die CPU nutzt den Descend also als
// RUNDENPUMPE (hoch, sofort runter, +1 Zaehler, wieder hoch) statt als
// Stapel. Als Plan verlangt das Gegenteil: erst moeglichst viele
// VERSCHIEDENE Formen stapeln, dann in EINEM Zug rueckwaerts abbauen und
// mit dem Vorrat Deep-Drowned bezahlen.
//
// Bewusst als getaggter Kanal und NICHT als harte Regel: der Lerner hat
// in diesem Deck mehrfach von selbst in die richtige Richtung gezeigt,
// sobald er den Kontrast sehen konnte (casterDeltas → Thunderstruck,
// tutorPickRules → Deep-Drowned). Ihm fehlte nur das Vokabular fuer die
// Frage "jetzt abbauen oder noch weiterstapeln?". Genau das steht hier.
//
// Deckneutral ueber `cpuMeta.counterSource` und `ascensionCondition` —
// keine Formnamen.

function classifyDescendTags(engine, pi, heroIdx) {
  const tags = [];
  try {
    const { loadCardEffect } = require('./_loader');
    const gs = engine.gs;
    const ps = gs?.players?.[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name) return tags;
    const cardDB = engine._getCardDB ? engine._getCardDB() : null;
    const sc = loadCardEffect(hero.name);

    // Wie tief ist der Stapel — wie viel gaebe es ueberhaupt abzubauen?
    const stack = Array.isArray(hero._formStack) ? hero._formStack : [];
    const distinct = new Set(stack).size;
    tags.push(`ds:stack:${distinct >= 3 ? '3+' : String(distinct)}`);

    // Zaehlerstand jetzt
    let evo = 0;
    try { evo = Number(sc?.cpuMeta?.counterSpend?.get?.(engine, pi, heroIdx)) || 0; } catch { evo = 0; }
    tags.push(`ds:evo:${evo >= 3 ? '3+' : String(evo)}`);

    // Wo landet der Abstieg?
    const target = stack[stack.length - 1];
    if (target) {
      tags.push(cardDB?.[target]?.cardType === 'Ascended Hero' ? 'ds:ziel-ascended' : 'ds:ziel-basis');
      // PUMPE: die Zielform ist dieselbe, in die gerade wieder
      // aufgestiegen wuerde — der Kreisel, den die Messung gefunden hat.
      if ((ps.hand || []).includes(hero.name)) tags.push('ds:pumpe');
    }

    // Bringt der Abstieg eine TEURE Form in Reichweite, die es jetzt
    // nicht ist? Das ist die eigentliche Frage hinter Als Plan.
    let reachNow = false, reachAfter = false;
    const spend = sc?.cpuMeta?.counterSpend;
    for (const cn of (ps.hand || [])) {
      if (cardDB?.[cn]?.cardType !== 'Ascended Hero') continue;
      const asc = loadCardEffect(cn);
      if (typeof asc?.ascensionCondition !== 'function') continue;
      try { if (asc.ascensionCondition(gs, pi, heroIdx, engine)) reachNow = true; } catch { /* egal */ }
    }
    if (spend && typeof spend.set === 'function') {
      const before = spend.get(engine, pi, heroIdx);
      try {
        spend.set(engine, pi, heroIdx, before + 1);   // ein Abstieg = mind. 1 Zaehler
        for (const cn of (ps.hand || [])) {
          if (cardDB?.[cn]?.cardType !== 'Ascended Hero') continue;
          const asc = loadCardEffect(cn);
          if (typeof asc?.ascensionCondition !== 'function') continue;
          try { if (asc.ascensionCondition(gs, pi, heroIdx, engine)) { reachAfter = true; break; } } catch { /* egal */ }
        }
      } finally { spend.set(engine, pi, heroIdx, before); }
    }
    if (!reachNow && reachAfter) tags.push('ds:schaltet-frei');
    else if (reachNow) tags.push('ds:schon-erreichbar');
    else tags.push('ds:nichts-in-reichweite');

    tags.push(gs?.currentPhase === 4 ? 'ds:mp2' : 'ds:mp1');
  } catch { /* Tagging ist Diagnose, nie Abbruchgrund */ }
  return tags;
}

function descendPrior(engine, pi, heroName, tags) {
  try {
    const rules = profileFor(engine, pi)?.descendRules?.[heroName];
    if (!rules) return 0;
    const raw = (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
    return Math.max(-20, Math.min(20, raw));
  } catch { return 0; }
}

/** 'play' | 'skip' | null (= keine Meinung, der Karten-Vertrag entscheidet). */
function descendDecision(engine, pi, heroName, tags) {
  try {
    if (!tags || tags.length === 0) return null;
    const rules = profileFor(engine, pi)?.descendRules?.[heroName];
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (rules && !epsRoll) {
      const score = descendPrior(engine, pi, heroName, tags);
      if (score >= 4) return 'play';
      if (score <= -4) return 'skip';
      return null;
    }
    const explore = parseFloat(process.env.PP_DESCEND_EXPLORE || '0.3');
    if (process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < explore) {
      return Math.random() < 0.5 ? 'skip' : 'play';
    }
  } catch { /* defensiv */ }
  return null;
}

/** Entscheidung festhalten — hoechstens eine je Held und Zug. */
function noteDescend(engine, pi, heroName, tags, fired) {
  try {
    if (engine._inMctsSim) return;
    if (!engine._descendDecisionLog) engine._descendDecisionLog = [];
    const t = engine.gs?.turn || 0;
    const prev = engine._descendDecisionLog.find(e => e.pi === pi && e.c === heroName && e.t === t);
    if (prev) { if (fired) { prev.fired = 1; prev.tags = tags; } return; }
    engine._descendDecisionLog.push({ pi, c: heroName, t, tags, fired: fired ? 1 : 0 });
  } catch { /* nie stoeren */ }
}

function playOrderPrior(engine, pi, tags) {
  try {
    const rules = profileFor(engine, pi)?.playOrderRules;
    if (!rules) return 0;
    return (tags || []).reduce((s, g) => s + (rules[g] || 0), 0);
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════════
//  LAUFZEIT DER SECHS ENTSCHEIDUNGSFORMEN
//
//  Gegenstueck zu scripts/decision-channels.js. Ohne diesen Teil wuerden
//  die neuen Regelsaetze gelernt und nie benutzt.
//
//  DIE TAG-ABLEITUNG MUSS HIER UND IM TRAINER IDENTISCH SEIN — dieselbe
//  Regel wie bei `clusterOfFingerprint`. Weil der Trainer die Tags aus
//  dem ROHEN Zustand ableitet (und nicht der Recorder sie stempelt),
//  gibt es hier eine zweite Ableitung aus dem LIVE-Zustand. Beide
//  Stufungen stehen deshalb in EINER Konstante, damit sie nicht
//  auseinanderlaufen koennen.
// ═══════════════════════════════════════════════════════════════════

const D_STUFEN = {
  t:    { grenzen: [4, 9],        namen: ['early', 'mid', 'late'] },
  hand: { grenzen: [2, 4, 6],     namen: ['0-2', '3-4', '5-6', '7+'] },
  gold: { grenzen: [0, 3, 7],     namen: ['0', '1-3', '4-7', '8+'] },
  deck: { grenzen: [3, 8, 15],    namen: ['0-3', '4-8', '9-15', '16+'] },
};
function dStufe(v, art) {
  const { grenzen, namen } = D_STUFEN[art];
  for (let i = 0; i < grenzen.length; i++) if (v <= grenzen[i]) return namen[i];
  return namen[namen.length - 1];
}

/**
 * Zustands-Tags aus dem LIVE-Zustand — spiegelbildlich zu
 * `zustandsTags()` im Trainer, der sie aus dem aufgezeichneten `z`
 * ableitet. Laufen die beiden auseinander, schlaegt kein Test an und
 * das Profil wirkt nur nicht; deshalb dieselben Stufen aus D_STUFEN.
 */
function decisionStateTags(engine, pi) {
  const tags = [];
  try {
    const gs = engine.gs;
    if (!gs) return tags;
    const oi = pi === 0 ? 1 : 0;
    const ps = gs.players?.[pi], os = gs.players?.[oi];
    tags.push('st:t:' + dStufe(gs.turn || 0, 't'));
    if (gs.currentPhase != null) tags.push('st:ph:' + gs.currentPhase);
    const lebend = (q) => ((q && q.heroes) || []).filter(h => h && (h.hp || 0) > 0).length;
    const hd = lebend(ps) - lebend(os);
    tags.push('st:hd:' + (hd <= -2 ? '-2' : hd === -1 ? '-1' : hd === 0 ? '0' : hd === 1 ? '+1' : '+2'));
    const hpS = (q) => ((q && q.heroes) || []).reduce((a, h) => a + Math.max(0, (h && h.hp) || 0), 0);
    const eigen = hpS(ps), fremd = hpS(os);
    if (eigen + fremd > 0) {
      const q = eigen / (eigen + fremd);
      tags.push('st:hp:' + (q < 0.35 ? 'lo' : q < 0.5 ? 'unter' : q < 0.65 ? 'ueber' : 'hi'));
    }
    if (Array.isArray(ps?.hand)) tags.push('st:hand:' + dStufe(ps.hand.length, 'hand'));
    if (typeof ps?.gold === 'number') tags.push('st:gold:' + dStufe(ps.gold, 'gold'));
    if (Array.isArray(ps?.mainDeck)) tags.push('st:deck:' + dStufe(ps.mainDeck.length, 'deck'));
  } catch { /* defensiv */ }
  return tags;
}

/**
 * FORM 1 — 》you may《, PRO KARTE.
 * Liefert 'play' | 'skip' | null (null = kein Urteil, Altverhalten).
 *
 * Grundrate plus additive Deltas. Bewusst KEIN deckweiter Rueckfall:
 * verschiedene optionale Trigger desselben Decks haben gegenlaeufige
 * Regeln, ein gemittelter Wert waere schaedlicher als gar keiner.
 */
function optInDecision(engine, pi, cardName) {
  try {
    if (!cardName) return null;
    const regel = profileFor(engine, pi)?.optInRules?.[cardName];
    const ruleEps = parseFloat(process.env.PP_RULE_EXPLORE || '0.15');
    const epsRoll = process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < ruleEps;
    if (regel && !epsRoll) {
      let score = regel.b || 0;
      if (regel.d) {
        for (const g of decisionStateTags(engine, pi)) score += (regel.d[g] || 0);
      }
      score *= confidence(profileFor(engine, pi));
      if (score >= 3) return 'play';
      if (score <= -3) return 'skip';
      return null;
    }
    // Ohne Regel: im Training beide Arme bedienen, sonst gaebe es nie
    // eine Kontrastgruppe. Live bleibt alles beim Alten.
    const explore = parseFloat(process.env.PP_OPTIN_EXPLORE || '0.25');
    if (process.env.PP_TRAIN && !engine._inMctsSim && Math.random() < explore) {
      return Math.random() < 0.5 ? 'skip' : 'play';
    }
  } catch { /* defensiv */ }
  return null;
}

/**
 * FORM 2 — Zielwahl ueber die ABSICHT. Liefert einen Zusatzscore je
 * Ziel, den `targetPickDecision` auf die kartenspezifischen
 * `targetPriors` addiert.
 *
 * Die Absicht kommt aus der Prompt-Konfiguration — genau die Felder,
 * die der Recorder roh mitschreibt.
 */
function targetIntentBonus(engine, pi, cardName, ziel, config = {}) {
  try {
    const prof = profileFor(engine, pi);
    if (!prof || !prof.targetIntentRules) return 0;
    const absicht = (config.isHealing || config.isHeal) ? 'heal'
      : ((config.baseDamage || 0) > 0) ? 'dmg'
      : config.appliesStatus ? 'status'
      : config.isBuff ? 'buff' : 'other';
    const basis = prof.targetIntentRules[absicht];
    if (!basis) return 0;
    const abw = prof.targetCardDeltas?.[cardName] || null;
    const tags = [];
    if (ziel) {
      tags.push('tg:side:' + (ziel.owner === pi ? 'own' : 'opp'));
      if (ziel.type) tags.push('tg:kind:' + ziel.type);
      if (ziel.heroIdx != null) tags.push('tg:pos:' + ziel.heroIdx);
      if (ziel.zoneSlot != null) tags.push('tg:slot:' + ziel.zoneSlot);
    }
    let s = 0;
    for (const g of tags) s += (basis[g] || 0) + (abw ? (abw[g] || 0) : 0);
    return s * confidence(prof);
  } catch { return 0; }
}

/**
 * FORM 3 — ORDINAL (》wie viel《). Liefert den Index der Option, die der
 * gelernten Zielstufe am naechsten kommt, oder null.
 *
 * Die Optionen muessen eine Zahlenreihe sein; sonst ist die Wahl
 * kategorisch und dieser Kanal schweigt.
 */
function ordinalPick(engine, pi, cardName, options) {
  try {
    if (!cardName || !Array.isArray(options) || options.length < 3) return null;
    const regel = profileFor(engine, pi)?.ordinalRules?.[cardName];
    if (!regel || typeof regel.ziel !== 'number') return null;
    const zahlen = options.map(o => {
      const m = /(-?\d+)/.exec(String((o && (o.label || o.id || o.name)) ?? o));
      return m ? parseInt(m[1], 10) : null;
    });
    if (zahlen.some(x => x === null)) return null;
    const lo = Math.min(...zahlen), hi = Math.max(...zahlen);
    if (hi <= lo) return null;
    // Gleichstand bewusst zugunsten der HOEHEREN Option (》<=《 statt
    // 》<《): liegt die gelernte Zielstufe genau zwischen zwei Optionen,
    // bleibt das Verhalten damit auf der Seite des bisherigen Defaults
    // (》letzte Option《 = 》all in《) statt willkuerlich nach unten zu
    // kippen. Ohne explizite Regel haengt die Wahl an der Reihenfolge
    // der Optionen — das waere stiller Zufall.
    let best = -1, bestAbstand = Infinity;
    zahlen.forEach((v, i) => {
      const a = Math.abs((v - lo) / (hi - lo) - regel.ziel);
      if (a <= bestAbstand) { bestAbstand = a; best = i; }
    });
    return best >= 0 ? best : null;
  } catch { return null; }
}

/**
 * FORM 4 — ADVERSARIELLE MENGENWAHL: Angebotswert einer Karte.
 * Generischer Nachfolger von `menuOfferRule`, das nur die drei
 * hartkodierten Quellen kannte. Faellt auf die alte Regel zurueck,
 * damit vorhandene Profile weiterlaufen.
 */
function setOfferValue(engine, pi, quelle, karte) {
  try {
    const prof = profileFor(engine, pi);
    if (!prof) return 0;
    const key = `${quelle}→${karte}`;
    let v = prof.setOfferRules?.[key];
    if (typeof v !== 'number') v = prof.menuOfferRules?.[key];
    if (typeof v !== 'number') return 0;
    return v * confidence(prof);
  } catch { return 0; }
}

/**
 * FORM 5 — OFFENE POOLWAHL ueber KARTENMERKMALE.
 * Bei 1405 Kandidaten ist Identitaet nicht lernbar; gelernt wurde ueber
 * Typ, Level, Kosten, Schule, HP und Angriff. Der Lage-Zuschlag traegt
 * Omikrons Ueberlebenswette: Koerper bei bedrohtem Brett, Effekt bei
 * sicherem.
 */
function poolFeatureValue(engine, pi, quelle, karte) {
  try {
    const prof = profileFor(engine, pi);
    const regel = prof?.poolFeatureRules?.[quelle];
    if (!regel || !karte) return 0;
    const cd = engine._getCardDB ? engine._getCardDB()[karte] : null;
    if (!cd) return 0;
    const stufe2 = (v, grenzen, namen) => {
      for (let i = 0; i < grenzen.length; i++) if (v <= grenzen[i]) return namen[i];
      return namen[namen.length - 1];
    };
    const merkmale = [];
    if (cd.cardType) merkmale.push('ft:type:' + String(cd.cardType).toLowerCase().replace(/\s+/g, '-'));
    if (typeof cd.level === 'number') merkmale.push('ft:lvl:' + stufe2(cd.level, [0, 1, 2], ['0', '1', '2', '3+']));
    if (typeof cd.cost === 'number') merkmale.push('ft:cost:' + stufe2(cd.cost, [0, 2, 5], ['0', '1-2', '3-5', '6+']));
    if (cd.spellSchool1) merkmale.push('ft:school:' + String(cd.spellSchool1).toLowerCase().replace(/\s+/g, '-'));
    if (typeof cd.hp === 'number' && cd.hp > 0) merkmale.push('ft:hp:' + stufe2(cd.hp, [100, 300], ['lo', 'mid', 'hi']));
    if (typeof cd.atk === 'number' && cd.atk > 0) merkmale.push('ft:atk:' + stufe2(cd.atk, [30, 80], ['lo', 'mid', 'hi']));
    let s = 0;
    for (const f of merkmale) s += (regel.f?.[f] || 0);
    if (regel.lage) {
      const lagen = decisionStateTags(engine, pi);
      for (const l of lagen) {
        const z = regel.lage[l];
        if (!z) continue;
        for (const f of merkmale) s += (z[f] || 0);
      }
    }
    return s * confidence(prof);
  } catch { return 0; }
}

module.exports = {
  decisionStateTags,
  optInDecision,
  targetIntentBonus,
  ordinalPick,
  setOfferValue,
  poolFeatureValue,
  protectionDecision,
  isCollecting,
  heroKeyOf,
  gameStartPickDecision,
  profileForHeroes,
  profileFor,
  casterDelta,
  menuOfferRule,
  deckoutGuard,
  deckoutDangerSizeOf,
  standingBucketFromEval,
  learnedCardValue,
  heldPairBonus,
  abilityPlacementBonus,
  equipPlacementBonus,
  lockOrderPenalty,
  reviveBonus,
  startHandScore,
  heroEffectTimingPrior,
  boardPairBonus,
  reloadProfiles,
  clusterOfFingerprint,
  classifyTargetTags,
  classifyMarketCrashTags,
  marketCrashDecision,
  statusWouldStick,
  targetPickDecision,
  surpriseFireDecision,
  reactionFireDecision,
  projectImpactFeatures,
  impactValueDelta,
  abilityDependencyScore,
  classifyStatusHealContext,
  statusHealDecision,
  classifyPlacementTags,
  placementPrior,
  classifyBounceTags,
  bouncePrior,
  sacrificeSpecReady,
  specReadyPrior,
  classifyPlayOrderTags,
  playOrderPrior,
  classifyCounterSpendTags,
  counterSpendPrior,
  counterSpendDecision,
  classifyDescendTags,
  descendPrior,
  descendDecision,
  noteDescend,
  classifyFormTurn,
  __getProfile: profileFor,
};
