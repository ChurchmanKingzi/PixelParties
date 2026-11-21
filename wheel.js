'use strict';
// ═══════════════════════════════════════════════════════════════
//  WHEEL — Glücksrad („Kork-Board“) im Shop: Gewinntabellen und Würfeln (UMD: Server UND Browser)
//  Server:  const W = require('./wheel');
//  Browser: <script src="/wheel.js"> → window.PpWheel
//
//  Man setzt Karten EINER Rarity ein, je Karte fliegt ein Dartpfeil. Jede Rarity hat 3 Boards (A/B/C) mit anderer Gewichtung
//  (Kartenjäger / Allrounder / Schatztruhe) bei gleichem Erwartungswert – kein Board ist objektiv besser.
//  Reine Funktionen, keine Datenbank, kein DOM. Der SERVER würfelt (rollThrow), der Client zeigt nur an.
//
//  Grundsätze (test/wheel.test.js):
//   • Der Schwerpunkt ist IMMER ein Downgrade (Wert < Einsatzwert): mindestens 78 % der Pfeile. Nur die oberen ~10–22 % sind Break-even/Gewinn.
//   • Umbra hat 0 % „Nichts“. Der Jackpot liegt überall bei 0,01 %.
//   • +3-Pfeile-Felder („spin3“) sind rekursiv und unbegrenzt; sie sind so selten, dass die Kette fast sicher endet (MAX_ARROWS ist nur die Notbremse).
//   • Glücks-Boosts überdecken für die RESTLICHEN Pfeile des Wurfs einen Teil von „Nichts“ mit einem Preis.
// ═══════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rarities'));
  else root.PpWheel = factory(root.PpRarities);
})(typeof self !== 'undefined' ? self : this, function (R) {

  /** Einsatz-Rarities (Common wird nie eingesetzt) in aufsteigender Reihenfolge. */
  const INPUT_RARITIES = ['uncommon', 'rare', 'prismatic', 'super', 'storm', 'spectral', 'stained', 'umbra'];
  const BOARD_IDS = ['A', 'B', 'C'];
  /** Härtegrenzen je Wurf (Serverschutz): eingesetzte Karten und Pfeile insgesamt (inkl. Bonus-Pfeile aus +3-Feldern). */
  const MAX_STAKE = 400;
  const MAX_ARROWS = 5000;
  const SPIN_ARROWS = 3;

  // ── Preisarten ────────────────────────────────────────────────
  //  none · card:<rarity> · booster · golden · jackpot · avatar · sleeve · skin · spin3 · sc10/sc20/sc50 · ticket:<rarity> · boost:1/2/3
  //  (title / emote folgen mit dem Titel-/Emote-System.)
  const SC_AMOUNT = { sc10: 10, sc20: 20, sc50: 50 };
  const PRICE = R.DISPLAY_PRICE;
  /** Nominalwert in SC: bei Karten der Shop-Preis ihrer Rarity, Booster 20, Kosmetik 25, Spin 30, Golden-Pack 45, Jackpot 400. */
  function ticketValue(rarity) {
    const next = R.ORDER[R.rank(rarity) + 1];
    return Math.ceil(0.6 * (PRICE[next] || 0));
  }
  function valueOf(kind) {
    if (kind === 'none') return 0;
    if (kind.startsWith('card:')) return PRICE[kind.slice(5)] || 0;
    if (kind.startsWith('ticket:')) return ticketValue(kind.slice(7));
    if (SC_AMOUNT[kind]) return SC_AMOUNT[kind];
    switch (kind) {
      case 'booster': return 20;
      case 'golden': return 45;
      case 'jackpot': return 400;
      case 'avatar': case 'sleeve': case 'skin': return 25;
      case 'spin3': return 30;
      default: return 0;   // boost:* trägt seinen Wert über den Überdeckungs-Effekt
    }
  }

  /**
   * Glücks-Boost-Felder (boost:1/2/3 = klein/mittel/groß): ab dem Treffer wird für die restlichen Pfeile des Wurfs der Anteil `share` aller
   * NIEDRIGER bewerteten Felder (vor allem „Nichts“) durch den Preis `make` überdeckt. Die Größe (`share`) ist so berechnet, dass ein Boost
   * die Pfeile danach um BOOST_GAIN[tier] des Board-Erwartungswerts aufwertet: wertvollerer Preis → kleineres Feld, und seltener getroffen.
   */
  const BOOST_KINDS = ['boost:1', 'boost:2', 'boost:3'];
  const BOOST_GAIN = [0.04, 0.06, 0.08];
  const BOOST_MAKE = {
    uncommon: ['sc10', 'booster', 'skin'], rare: ['sc10', 'booster', 'skin'], prismatic: ['sc10', 'booster', 'skin'],
    super: ['sc20', 'avatar', 'golden'], storm: ['sc50', 'golden', 'card:spectral'],
    spectral: ['golden', 'card:stained', 'card:umbra'], stained: ['card:spectral', 'card:stained', 'card:umbra'], umbra: ['card:spectral', 'card:stained', 'card:umbra'],
  };
  /** Mehrere Boosts stapeln sich; höchstens so viele wirken gleichzeitig. */
  const MAX_ACTIVE_BOOSTS = 3;

  // ── Basistabellen (Prozent je Pfeil; „Nichts“ ist der Rest auf 100) ──────────────
  const C = (r) => 'card:' + r;
  const T = (r) => 'ticket:' + r;
  const BASE = {
    uncommon: {
      [C('uncommon')]: 8, [C('rare')]: 4, [C('prismatic')]: 1.2, [C('super')]: 0.25, [C('storm')]: 0.08, [C('spectral')]: 0.04, [C('stained')]: 0.02, [C('umbra')]: 0.008,
      booster: 1.3, golden: 0.05, jackpot: 0.01, avatar: 0.35, sleeve: 0.35, skin: 0.35, spin3: 0.8, sc10: 1.6, sc20: 0.3, sc50: 0.05,
      [T('uncommon')]: 0.4, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    rare: {
      [C('uncommon')]: 12, [C('rare')]: 7, [C('prismatic')]: 3.2, [C('super')]: 0.8, [C('storm')]: 0.25, [C('spectral')]: 0.1, [C('stained')]: 0.04, [C('umbra')]: 0.015,
      booster: 1.8, golden: 0.08, jackpot: 0.01, avatar: 0.5, sleeve: 0.5, skin: 0.5, spin3: 0.8, sc10: 2.2, sc20: 0.4, sc50: 0.07,
      [T('uncommon')]: 0.5, [T('rare')]: 0.45, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    prismatic: {
      [C('uncommon')]: 10, [C('rare')]: 12, [C('prismatic')]: 7, [C('super')]: 2, [C('storm')]: 0.6, [C('spectral')]: 0.25, [C('stained')]: 0.1, [C('umbra')]: 0.04,
      booster: 2.5, golden: 0.12, jackpot: 0.01, avatar: 0.7, sleeve: 0.7, skin: 0.7, spin3: 1, sc10: 2.6, sc20: 0.6, sc50: 0.1,
      [T('uncommon')]: 0.5, [T('rare')]: 0.5, [T('prismatic')]: 0.45, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    super: {
      [C('uncommon')]: 8, [C('rare')]: 12, [C('prismatic')]: 14, [C('super')]: 6, [C('storm')]: 1.5, [C('spectral')]: 0.6, [C('stained')]: 0.25, [C('umbra')]: 0.1,
      booster: 4, golden: 0.2, jackpot: 0.01, avatar: 1.1, sleeve: 1.1, skin: 1.1, spin3: 1.2, sc10: 6, sc20: 1.2, sc50: 0.25,
      [T('rare')]: 0.5, [T('prismatic')]: 0.6, [T('super')]: 0.4, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    storm: {
      [C('uncommon')]: 5, [C('rare')]: 8, [C('prismatic')]: 12, [C('super')]: 14, [C('storm')]: 6, [C('spectral')]: 2, [C('stained')]: 0.6, [C('umbra')]: 0.2,
      booster: 7, golden: 0.5, jackpot: 0.01, avatar: 2, sleeve: 2, skin: 2, spin3: 1.5, sc10: 4, sc20: 3.5, sc50: 1,
      [T('prismatic')]: 0.5, [T('super')]: 0.7, [T('storm')]: 0.5, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    spectral: {
      [C('uncommon')]: 3, [C('rare')]: 5, [C('prismatic')]: 9, [C('super')]: 14, [C('storm')]: 14, [C('spectral')]: 8, [C('stained')]: 2, [C('umbra')]: 0.6,
      booster: 9, golden: 1, jackpot: 0.01, avatar: 3, sleeve: 3, skin: 3, spin3: 2, sc10: 3, sc20: 5, sc50: 2,
      [T('super')]: 0.5, [T('storm')]: 0.6, [T('spectral')]: 0.5, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    stained: {
      [C('uncommon')]: 0.5, [C('rare')]: 2, [C('prismatic')]: 4, [C('super')]: 9, [C('storm')]: 13, [C('spectral')]: 14, [C('stained')]: 11, [C('umbra')]: 2.5,
      booster: 6, golden: 2.5, jackpot: 0.01, avatar: 3, sleeve: 3, skin: 3, spin3: 2, sc10: 1, sc20: 4, sc50: 6,
      [T('storm')]: 0.5, [T('spectral')]: 0.5, [T('stained')]: 0.4, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
    umbra: {   // KEIN „Nichts“: die Tabelle wird auf genau 100 normiert
      [C('super')]: 9, [C('storm')]: 14, [C('spectral')]: 18, [C('stained')]: 14, [C('umbra')]: 12,
      booster: 6, golden: 3, jackpot: 0.01, avatar: 3, sleeve: 3, skin: 3, spin3: 1.5, sc20: 8, sc50: 12,
      [T('spectral')]: 0.6, [T('stained')]: 0.5, 'boost:1': 0.3, 'boost:2': 0.15, 'boost:3': 0.05,
    },
  };

  /**
   * „Nichts“ ist überall um 10 % (relativ) seltener: die frei werdende Wahrscheinlichkeit geht anteilig an die billigen Preise
   * (Wert bis zum Doppelten des Einsatzwerts; Spin, Boosts und Jackpot bleiben unberührt). Umbra hat kein „Nichts“ und bleibt gleich.
   */
  const NONE_CUT = 0.10;
  for (const rar of Object.keys(BASE)) {
    const b = BASE[rar], none0 = 100 - sumOf(b);
    if (none0 <= 0.5) continue;
    const vin = PRICE[rar], cheap = Object.keys(b).filter(k => k !== 'spin3' && k !== 'jackpot' && !k.startsWith('boost:') && valueOf(k) > 0 && valueOf(k) <= 2 * vin);
    const wsum = cheap.reduce((a, k) => a + b[k], 0);
    if (!cheap.length || wsum <= 0) continue;
    const delta = none0 * NONE_CUT;
    for (const k of cheap) b[k] += delta * b[k] / wsum;
  }

  // ── Boards: drei Gewichtungen, gleicher Erwartungswert ────────────────────────
  //  Familien: cards (card:*), cur (Booster, Golden Pack, SC), cos (Avatar/Sleeve/Skin). Spin, Tickets, Boosts, Jackpot bleiben gleich.
  const PROFILES = {
    A: { cards: 1.0, cur: 1.0, cos: 1.0 },
    B: { cards: 1.2, cur: 0.8, cos: 0.85 },    // Kartenjäger: mehr Karten, weniger Währung/Kosmetik
    C: { cards: 0.8, cur: 1.0, cos: 1.5 },    // Schatztruhe: mehr Kosmetik, weniger Karten
  };
  function familyOf(kind) {
    if (kind.startsWith('card:')) return 'cards';
    if (kind === 'booster' || kind === 'golden' || SC_AMOUNT[kind]) return 'cur';
    if (kind === 'avatar' || kind === 'sleeve' || kind === 'skin') return 'cos';
    return 'fix';
  }
  /** Erwartungswert je Pfeil in SC-Nominalwert einer Gewichtstabelle (Prozent; spin3 zählt rekursiv: jeder Bonus-Pfeil ist wieder ein Pfeil). */
  function expectedValue(table) {
    let base = 0, pSpin = 0;
    for (const k of Object.keys(table)) {
      if (k === 'spin3') { pSpin = table[k] / 100; continue; }
      if (k === 'none' || k.startsWith('boost:')) continue;
      base += table[k] * valueOf(k) / 100;
    }
    return base / (1 - SPIN_ARROWS * pSpin);
  }
  function sumOf(t) { let s = 0; for (const k of Object.keys(t)) s += t[k]; return s; }
  function round4(x) { return Math.round(x * 10000) / 10000; }

  /** Baut die Tabelle eines Boards: Profil-Multiplikatoren, dann Gesamt-Skalierung so, dass der Erwartungswert dem von Board A entspricht. */
  function buildTable(rarity, boardId) {
    const base = BASE[rarity];
    const hasNone = rarity !== 'umbra';
    const prof = PROFILES[boardId];
    const refEv = expectedValue(base);
    const shaped = {};
    for (const k of Object.keys(base)) {
      const f = familyOf(k);
      shaped[k] = base[k] * (f === 'fix' ? 1 : prof[f === 'cards' ? 'cards' : f === 'cur' ? 'cur' : 'cos']);
    }
    let out;
    if (hasNone) {
      // Skalar k auf alle Nicht-„fix“-Gewichte, bis der Erwartungswert passt (Bisektion; EV ist in k monoton).
      const scaled = (k) => { const t = {}; for (const x of Object.keys(shaped)) t[x] = shaped[x] * (familyOf(x) === 'fix' ? 1 : k); return t; };
      let lo = 0.2, hi = 3;
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (expectedValue(scaled(mid)) < refEv) lo = mid; else hi = mid; }
      out = scaled((lo + hi) / 2);
      out.none = Math.max(0, 100 - sumOf(out));
    } else {
      // Umbra: kein „Nichts“ — normieren auf genau 100 (Erwartungswerte weichen leicht ab, Toleranz im Test).
      const s = sumOf(shaped);
      out = {};
      for (const k of Object.keys(shaped)) out[k] = shaped[k] * 100 / s;
    }
    for (const k of Object.keys(out)) out[k] = round4(out[k]);
    // Rundungsrest in „Nichts“ (bzw. beim Umbra im größten Eintrag), damit die Summe exakt 100 ist
    const diff = round4(100 - sumOf(out));
    if (hasNone) out.none = round4(out.none + diff);
    else { const big = Object.keys(out).sort((a, b) => out[b] - out[a])[0]; out[big] = round4(out[big] + diff); }
    return out;
  }

  const _cache = {};
  /** Gewinntabelle { kind: Prozent } von (Rarity, Board). */
  function table(rarity, boardId) {
    if (!BASE[rarity]) throw new Error('Unbekannte Einsatz-Rarity: ' + rarity);
    if (!PROFILES[boardId]) throw new Error('Unbekanntes Board: ' + boardId);
    const key = rarity + '/' + boardId;
    return _cache[key] || (_cache[key] = buildTable(rarity, boardId));
  }
  /** Kurzbeschreibung der Boards für die Auswahl (Texte/Übersetzung liegen im Client; hier nur die Schlüssel). */
  const BOARD_INFO = {
    A: { key: 'allround', profile: PROFILES.A },
    B: { key: 'cards', profile: PROFILES.B },
    C: { key: 'treasure', profile: PROFILES.C },
  };
  function boards(rarity) {
    return BOARD_IDS.map(id => ({ id, key: BOARD_INFO[id].key, table: table(rarity, id), ev: expectedValue(table(rarity, id)) }));
  }

  // ── Würfeln ───────────────────────────────────────────────────
  /** Würfelt EINEN Pfeil aus einer Tabelle { kind: Gewicht }. */
  function rollOne(tbl, rand) {
    const r = (typeof rand === 'function' ? rand : Math.random)();
    const keys = Object.keys(tbl);
    let x = r * sumOf(tbl), last = 'none';
    for (const k of keys) { if (!(tbl[k] > 0)) continue; last = k; x -= tbl[k]; if (x < 0) return k; }
    return last;
  }

  /** Boost-Feld einer Tabelle: { make, share } (nur für boost:1/2/3 definiert). */
  function boostSpec(rarity, boardId, kind) {
    const tier = BOOST_KINDS.indexOf(kind);
    if (tier < 0) return null;
    const tbl = table(rarity, boardId), make = BOOST_MAKE[rarity][tier], vm = valueOf(make);
    let room = 0;   // Σ Masse(f) · (Wert(make) − Wert(f)) über alle Felder unterhalb von make
    for (const k of Object.keys(tbl)) { if (k.startsWith('boost:') || k === 'spin3') continue; const v = valueOf(k); if (v < vm) room += tbl[k] / 100 * (vm - v); }
    const share = room > 0 ? Math.min(0.5, BOOST_GAIN[tier] * expectedValue(tbl) / room) : 0;
    return { kind, make, share };
  }

  /** Tabelle nach aktiven Boosts: je Boost wandert `share` jedes niedriger bewerteten Feldes (inkl. „Nichts“) zum Boost-Preis. */
  function applyBoosts(tbl, boosts) {
    if (!boosts.length) return tbl;
    const t = Object.assign({}, tbl);
    for (const b of boosts) {
      const vm = valueOf(b.make);
      let moved = 0;
      for (const k of Object.keys(t)) {
        if (k.startsWith('boost:') || k === 'spin3' || k === b.make) continue;
        if (valueOf(k) < vm) { const m = t[k] * b.share; t[k] -= m; moved += m; }
      }
      t[b.make] = (t[b.make] || 0) + moved;
    }
    return t;
  }

  /**
   * Würfelt einen ganzen Wurf: `stake` bezahlte Pfeile, dazu Bonus-Pfeile aus spin3 (je 3, unbegrenzt rekursiv bis MAX_ARROWS).
   * Die Pfeile werden der Reihe nach aufgelöst; ein Boost-Treffer wirkt auf alle FOLGENDEN Pfeile.
   * @returns {{ arrows: Array<{ i:number, kind:string, bonus:boolean, boosted:boolean }>, capped:boolean }}
   *   `capped`: die Notbremse MAX_ARROWS hat weitere Bonus-Pfeile verhindert (praktisch unmöglich bei den echten Quoten).
   */
  function rollThrow(rarity, boardId, stake, rand) {
    if (!Number.isInteger(stake) || stake < 1 || stake > MAX_STAKE) throw new Error('Ungültige Einsatzmenge');
    const tbl = table(rarity, boardId);
    const arrows = [];
    let queue = stake, bonusLeft = 0, capped = false;
    const boosts = [];
    while (queue + bonusLeft > 0) {
      const bonus = queue <= 0;
      if (bonus) bonusLeft--; else queue--;
      const eff = applyBoosts(tbl, boosts);
      const kind = rollOne(eff, rand);
      arrows.push({ i: arrows.length, kind, bonus, boosted: boosts.length > 0 });
      if (kind === 'spin3') {
        if (arrows.length + queue + bonusLeft + SPIN_ARROWS <= MAX_ARROWS) bonusLeft += SPIN_ARROWS; else capped = true;
      } else if (BOOST_KINDS.includes(kind) && boosts.length < MAX_ACTIVE_BOOSTS) {
        boosts.push(boostSpec(rarity, boardId, kind));
      }
    }
    return { arrows, capped };
  }

  /** Zählt die Preise eines Wurfs: { kind: Anzahl } (boost:* und spin3 sind Mechaniken, keine Gewinne, werden aber mitgezählt). */
  function tally(arrows) {
    const out = {};
    for (const a of arrows) out[a.kind] = (out[a.kind] || 0) + 1;
    return out;
  }

  return {
    INPUT_RARITIES, BOARD_IDS, MAX_STAKE, MAX_ARROWS, SPIN_ARROWS, SC_AMOUNT, BOOST_KINDS, BOOST_GAIN, BOOST_MAKE, MAX_ACTIVE_BOOSTS, BOARD_INFO,
    valueOf, ticketValue, expectedValue, table, boards, boostSpec, rollOne, applyBoosts, rollThrow, tally,
  };
});
