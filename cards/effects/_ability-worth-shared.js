'use strict';
// ═══════════════════════════════════════════════════════════════════
//  ABILITY-WERTIGKEIT — GEMEINSAMES MODUL (Als Auftrag 6.10.)
//
//  Auslöser: „Compulsory Body Swap" braucht für die CPU eine Antwort auf
//  die Frage 》was ist eine Ability WERT?《. Der Bestand vorher:
//
//    • evaluateState:  15 × (eigene − gegnerische Ability-KARTEN), flach,
//                      TOTE Helden mitgezählt; dazu `cpuMeta.engineValue`
//                      (Divinity 120 je Stufe).
//    • Lernen:         nur WO eine Ability liegt (`abilityPriors`), nie wie
//                      viel sie wert ist.
//    • Nutzung:        nirgends gezählt — und das `actionLog` ist in
//                      Simulationen und im Self-Play (Fast Mode) leer.
//
//  ── DAS MODELL ────────────────────────────────────────────────────
//  Wert einer Ability A in der Hand eines Spielers P, je Stufe:
//
//      (base(A) · nutzung(P, A) + engineValue(A)) · mult(A)
//
//  und über alle LEBENDEN Helden von P aufsummiert, wobei die Stufen
//  derselben Ability auf mehreren Helden nach Stufe absteigend mit
//  ρ^j gewichtet werden (ρ = 0,5: der zweite Held mit derselben Ability
//  zählt halb, der dritte ein Viertel). Das ist die Regel
//  》je mehr lebende Helden dieselbe Ability haben, desto weniger wert
//  ist sie《 — Stapel auf EINEM Helden (Stufe 1→3) sind davon unberührt.
//
//    base(A)       Standard 15 je Stufe (= der alte flache Wert, der
//                  unveränderte Bestand bleibt damit vergleichbar), plus
//                  GELERNTE Abweichung je Ability und Seite
//                  (`profile.abilityWorthRules`, Trainer Form 8).
//    nutzung(P,A)  1 + γ·(1 − e^(−r/r0)) mit r = Nutzungen / (eigene Züge+1).
//                  》Je öfter ein Spieler eine Ability nutzt, desto wertvoller
//                  ist sie.《  Gezählt wird DYNAMISCH im laufenden Spiel
//                  (`engine._abilityUse`, siehe `noteUsage`): Casts von
//                  Karten, die die Schule verlangen, und Aktivierungen
//                  aktiver Abilities. Der andere Spieler zählt zu `crossUse`
//                  (0,5) mit: Nutzung ist ein BEWEIS für den Wert der Ability,
//                  auch wenn sie gerade in anderer Hand liegt.
//    mult(A)       Divinity zählt DREIFACH (Auftrag). Gilt für den ganzen
//                  Wert inklusive engineValue.
//
//  Casting-Schulen und Support-Abilities (Alchemy, Leadership, …) stehen
//  dabei auf derselben Skala; was sie unterscheidet, ist ihre gemessene
//  Nutzung und der gelernte Wert — nicht eine von Hand gesetzte Rangfolge.
//
//  ── FIT: HILFT DIE ABILITY DEM, DER SIE BEKOMMT? ──────────────────
//  `swapGain` (Paarwahl) wertet zusätzlich, was die Abilities in der Hand
//  des neuen Besitzers TUN KÖNNEN: Karten in Hand (und Deck/Ablage), die
//  mit dem neuen Satz spielbar werden oder es nicht mehr sind
//  (`engine._testLevelReqForZones`). Das ist der Bonus (gestohlene Schule
//  passt zu MEINER Hand) und der Malus (die DEM GEGNER gegebene Schule
//  passt zu SEINER Hand besser als zu meiner) — und kann dafür sorgen,
//  dem Gegner lieber ein anderes Set zu geben. Für den Gegner zählt seine
//  echte Hand (das Eval liest sie ohnehin) und, statt seines Decks, seine
//  bekannten Stapel (Ablage + Gelöscht) als Hinweis auf die Deckzusammen-
//  setzung.
//
//  Das Eval braucht den Fit NICHT: dort sehen Handwert-Gate und Rollout
//  die geänderte Spielbarkeit ohnehin.
// ═══════════════════════════════════════════════════════════════════

const DEFAULTS = {
  base: 15,            // Punkte je Stufe = der alte flache Eval-Wert
  gamma: 2.0,          // Nutzungs-Aufschlag: bis 1 + γ
  rate0: 0.6,          // Nutzungen je Zug, bei denen die Sättigung ~63 % erreicht ist
  rho: 0.5,            // Abschlag je weiterem lebenden Helden mit derselben Ability
  crossUse: 0.5,       // Beweiskraft der Nutzung des ANDEREN Spielers
  mult: { Divinity: 3 },
  fitHand: 25,         // Punkte je Kartenstufe, die in der Hand spielbar wird/bleibt
  fitPile: 12,         // dito für Deck (eigene Seite) bzw. bekannte Stapel (Gegner)
  extraAction: 35,     // Wert der Zusatz-Aktion, wenn der Nutzer im Paar ist und etwas spielen kann
  learnMin: 4, learnMax: 60,   // Klammer der gelernten Basis je Stufe
};

const lc = (s) => String(s || '').toLowerCase();

// ── Nutzung zählen (aus `engine.log`, siehe _engine.js) ────────────
/**
 * Verbucht ein Log-Ereignis als Ability-Nutzung. Aufruf aus `engine.log`
 * VOR dem Fast-Mode-Ausstieg: Self-Play läuft komplett im Fast Mode, das
 * `actionLog` bleibt dort leer — ein Zähler, der es lesen würde, sähe im
 * Training nie etwas. Rollouts (`_inMctsSim`) zählen nicht.
 *   spell_played / creature_summoned  → jede Schule der Karte (spellSchool1/2)
 *   ability_activated                 → die Ability selbst
 */
function noteUsage(engine, type, data) {
  try {
    if (!data || engine._inMctsSim) return;
    if (type !== 'spell_played' && type !== 'creature_summoned' && type !== 'ability_activated') return;
    const players = engine.gs?.players || [];
    const pi = players.findIndex(p => p && p.username === data.player);
    if (pi < 0) return;
    if (!engine._abilityUse) engine._abilityUse = [Object.create(null), Object.create(null)];
    const use = engine._abilityUse[pi];
    if (type === 'ability_activated') {
      if (data.card) use[data.card] = (use[data.card] || 0) + 1;
      return;
    }
    const cd = engine._getCardDB ? engine._getCardDB()[data.card] : null;
    if (!cd) return;
    for (const school of [cd.spellSchool1, cd.spellSchool2]) {
      if (school) use[school] = (use[school] || 0) + 1;
    }
  } catch { /* Zähler darf nie stören */ }
}

// ── Parameter: Standard ⊕ gelernt ──────────────────────────────────
function profileOf(engine, pi) {
  try { return require('./_deck-profile').__getProfile(engine, pi) || null; } catch { return null; }
}
function confidenceOf(prof) {
  try { return require('./_deck-profile').profileConfidence(prof); } catch { return 0; }
}

/**
 * Parameter aus Sicht des Profil-Inhabers `pi`. `learned` = die Regeln
 * (oder null), `conf` = Confidence des Profils.
 */
function paramsFor(engine, pi) {
  if (process.env.PP_ABILITY_WORTH_LEARNED === '0') return { ...DEFAULTS, learned: null, conf: 0 };
  const prof = profileOf(engine, pi);
  return { ...DEFAULTS, learned: prof?.abilityWorthRules || null, conf: prof ? confidenceOf(prof) : 0 };
}

/**
 * Basis je Stufe. `halter === pi` → eigene Regel; sonst die Gegner-Regel
 * (die Regel misst, wie SEHR es mir schadet, wenn der Gegner A hält — hier
 * als Wert von A in seiner Hand eingesetzt). Fehlt die eigene Regel, gilt
 * die gedämpfte Gegner-Regel: was ein Gegner hält und mir schadet, ist
 * auch in meiner Hand etwas wert.
 */
function baseFor(params, A, istEigen) {
  const L = params.learned;
  let b = params.base;
  if (L) {
    const o = L.own?.[A], p = L.opp?.[A];
    let d = 0;
    if (istEigen) d = typeof o === 'number' ? o : (typeof p === 'number' ? -0.7 * p : 0);
    else d = typeof p === 'number' ? -p : 0;
    b += d * (params.conf || 0);
  }
  return Math.max(params.learnMin, Math.min(params.learnMax, b));
}

function usageFactor(engine, params, holderPi, A) {
  const use = engine._abilityUse;
  if (!use) return 1;
  const other = holderPi === 0 ? 1 : 0;
  const u = (use[holderPi]?.[A] || 0) + params.crossUse * (use[other]?.[A] || 0);
  if (!(u > 0)) return 1;
  const turns = Math.max(1, Math.ceil((engine.gs?.turn || 1) / 2));
  const r = u / (turns + 1);
  return 1 + params.gamma * (1 - Math.exp(-r / params.rate0));
}

// ── Brett lesen ────────────────────────────────────────────────────
/**
 * Ability-Stufen je Name über die LEBENDEN Helden von `holderPi`.
 * `zonesBy` ersetzt die Zonen einzelner Helden (Was-wäre-wenn).
 * Rückgabe: { [Ability]: [Stufe je Held, absteigend] }.
 */
function levelsByAbility(engine, holderPi, zonesBy = null) {
  const out = Object.create(null);
  const ps = engine.gs?.players?.[holderPi];
  if (!ps) return out;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || (h.hp || 0) <= 0) continue;
    const zones = (zonesBy && zonesBy[hi]) || ps.abilityZones?.[hi] || [];
    const proHeld = Object.create(null);
    for (const slot of zones) {
      if (!slot || !slot.length) continue;
      proHeld[slot[0]] = (proHeld[slot[0]] || 0) + slot.length;   // Basis bestimmt die Identität (Performance erbt)
    }
    for (const [A, lv] of Object.entries(proHeld)) (out[A] = out[A] || []).push(lv);
  }
  for (const A of Object.keys(out)) out[A].sort((a, b) => b - a);
  return out;
}

function engineValueOf(A) {
  try { return require('./_loader').loadCardEffect(A)?.cpuMeta?.engineValue || 0; } catch { return 0; }
}

/**
 * Wert aller Abilities von `holderPi` aus Sicht des Profil-Inhabers `viewPi`.
 * `zonesBy` = Was-wäre-wenn für `holderPi`.
 */
function sideValue(engine, viewPi, holderPi, zonesBy = null, paramsIn = null) {
  const params = paramsIn || paramsFor(engine, viewPi);
  const lv = levelsByAbility(engine, holderPi, zonesBy);
  let total = 0;
  for (const [A, levels] of Object.entries(lv)) {
    let s = 0;
    for (let j = 0; j < levels.length; j++) s += levels[j] * Math.pow(params.rho, j);
    const perLevel = baseFor(params, A, holderPi === viewPi) * usageFactor(engine, params, holderPi, A) + engineValueOf(A);
    total += perLevel * s * (params.mult[A] || 1);
  }
  return total;
}

// ── Fit ────────────────────────────────────────────────────────────
/**
 * Wie viel Kartenstufe in Hand (und Deck bzw. bekannten Stapeln) ist mit
 * diesen Zonen spielbar? `zonesBy` = Was-wäre-wenn.
 */
function castableValue(engine, pi, viewPi, zonesBy, params) {
  const ps = engine.gs?.players?.[pi];
  if (!ps || typeof engine._testLevelReqForZones !== 'function') return 0;
  const db = engine._getCardDB();
  const heroes = (ps.heroes || []).map((h, hi) => ({ h, hi })).filter(x => x.h?.name && (x.h.hp || 0) > 0);
  const kann = (cd) => {
    const raw = cd.level || 0;
    for (const { h, hi } of heroes) {
      const zones = (zonesBy && zonesBy[hi]) || ps.abilityZones?.[hi] || [];
      try { if (engine._testLevelReqForZones(pi, hi, cd, h, raw, zones)) return true; } catch { /* weiter */ }
    }
    return false;
  };
  let total = 0;
  const scan = (arr, w) => {
    for (const n of (arr || [])) {
      const cd = db[n];
      if (!cd || !(cd.cardType === 'Spell' || cd.cardType === 'Attack' || cd.cardType === 'Creature')) continue;
      if (lc(cd.subtype) === 'surprise') continue;
      if (kann(cd)) total += w * (cd.level || 0);
    }
  };
  scan(ps.hand, params.fitHand);
  // Eigene Seite: das Deck. Gegner: bekannte Stapel (sein Deck ist verdeckt).
  if (pi === viewPi) scan(ps.mainDeck, params.fitPile);
  else { scan(ps.discardPile, params.fitPile * 0.5); scan(ps.deletedPile, params.fitPile * 0.5); }
  return total;
}

/**
 * Gewinn für `viewPi`, wenn die Abilities der Helden `a` und `b`
 * ({owner, heroIdx}) getauscht werden. Positiv = gut für `viewPi`.
 *
 *   gain = (Δ Wertigkeit ich − Δ Wertigkeit Gegner)
 *        + (Δ Fit ich − Δ Fit Gegner)
 *        + Zusatz-Aktion, wenn der Nutzer (`casterHeroIdx`) im Paar ist und etwas spielen kann
 *
 * Rückgabe { gain, parts } (parts zur Diagnose / für den Recorder).
 */
function swapGain(engine, viewPi, a, b, opts = {}) {
  const params = opts.params || paramsFor(engine, viewPi);
  const gs = engine.gs;
  const pa = gs.players[a.owner], pb = gs.players[b.owner];
  if (!pa || !pb) return null;
  const za = pa.abilityZones?.[a.heroIdx] || [[], [], []];
  const zb = pb.abilityZones?.[b.heroIdx] || [[], [], []];
  // Was-wäre-wenn je Besitzer (beide Helden können demselben Spieler gehören).
  const nach = [{}, {}];
  nach[a.owner][a.heroIdx] = zb;
  nach[b.owner][b.heroIdx] = za;
  const opp = viewPi === 0 ? 1 : 0;
  const zonenFuer = (pi) => (Object.keys(nach[pi]).length ? nach[pi] : null);

  const wertMe = sideValue(engine, viewPi, viewPi, zonenFuer(viewPi), params) - sideValue(engine, viewPi, viewPi, null, params);
  const wertOpp = sideValue(engine, viewPi, opp, zonenFuer(opp), params) - sideValue(engine, viewPi, opp, null, params);

  let fitMe = 0, fitOpp = 0;
  if (opts.fit !== false) {
    fitMe = castableValue(engine, viewPi, viewPi, zonenFuer(viewPi), params) - castableValue(engine, viewPi, viewPi, null, params);
    fitOpp = castableValue(engine, opp, viewPi, zonenFuer(opp), params) - castableValue(engine, opp, viewPi, null, params);
  }

  // Zusatz-Aktion: gilt, wenn der Nutzer einer der beiden Helden ist.
  let extra = 0;
  const ch = opts.casterHeroIdx;
  const userIn = typeof ch === 'number' && ch >= 0
    && ((a.owner === viewPi && a.heroIdx === ch) || (b.owner === viewPi && b.heroIdx === ch));
  if (userIn && typeof engine._testLevelReqForZones === 'function') {
    const ps = gs.players[viewPi];
    const hero = ps.heroes?.[ch];
    const zones = nach[viewPi][ch] || ps.abilityZones?.[ch] || [];
    const db = engine._getCardDB();
    for (const n of (ps.hand || [])) {
      const cd = db[n];
      if (!cd || n === 'Compulsory Body Swap') continue;
      if (!(cd.cardType === 'Spell' || cd.cardType === 'Attack' || cd.cardType === 'Creature')) continue;
      if (lc(cd.subtype) === 'surprise') continue;
      try {
        if (hero && engine._testLevelReqForZones(viewPi, ch, cd, hero, cd.level || 0, zones)) { extra = params.extraAction; break; }
      } catch { /* weiter */ }
    }
  }

  const gain = (wertMe - wertOpp) + (fitMe - fitOpp) + extra;
  return { gain, parts: { wertMe, wertOpp, fitMe, fitOpp, extra } };
}

/** Alle Paare lebender Helden (beider Seiten), ungeordnet. */
function livingHeroes(engine) {
  const out = [];
  for (let o = 0; o < (engine.gs?.players?.length || 0); o++) {
    const ps = engine.gs.players[o];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && (h.hp || 0) > 0) out.push({ owner: o, heroIdx: hi });
    }
  }
  return out;
}

/**
 * Bewertete Paare (absteigend nach Gewinn). `ok(hero)` filtert nicht wählbare
 * Helden (Erstrunden-Schutz, Stealth …).
 */
function rankSwaps(engine, viewPi, opts = {}) {
  const heroes = livingHeroes(engine).filter(h => !opts.ok || opts.ok(h));
  const params = opts.params || paramsFor(engine, viewPi);
  const out = [];
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const r = swapGain(engine, viewPi, heroes[i], heroes[j], { ...opts, params });
      if (r) out.push({ a: heroes[i], b: heroes[j], gain: r.gain, parts: r.parts });
    }
  }
  out.sort((x, y) => y.gain - x.gain);
  return out;
}

/** Schnappschuss für den Recorder: { Ability: [Stufen der lebenden Helden] } je Seite + Nutzungsraten. */
function snapshot(engine, pi) {
  const opp = pi === 0 ? 1 : 0;
  const rate = (holder) => {
    const out = {};
    const use = engine._abilityUse?.[holder] || {};
    const turns = Math.max(1, Math.ceil((engine.gs?.turn || 1) / 2));
    for (const [A, n] of Object.entries(use)) out[A] = Math.round(100 * n / (turns + 1)) / 100;
    return out;
  };
  return { o: levelsByAbility(engine, pi), p: levelsByAbility(engine, opp), uo: rate(pi), up: rate(opp) };
}

module.exports = {
  DEFAULTS, noteUsage, paramsFor, baseFor, usageFactor, levelsByAbility,
  sideValue, castableValue, swapGain, rankSwaps, livingHeroes, snapshot,
};
