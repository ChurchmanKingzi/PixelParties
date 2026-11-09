'use strict';
// ═══════════════════════════════════════════════════════════════
//  RARITIES — gemeinsames Modul für Server UND Browser (UMD)
//  Server:  const R = require('./rarities');
//  Browser: <script src="/rarities.js"> → window.PpRarities
//
//  Alle Karten sind von Haus aus Common und gehören jedem Spieler unbegrenzt oft. Höhere Seltenheiten sind GESAMMELTE Kopien:
//  Besitz = Anzahl je (Karte, Rarity). Hier stehen nur reine Funktionen (keine Datenbank, kein DOM): Reihenfolge und Namen,
//  Gewichtstabellen von Booster-Pack und Draft, das Würfeln, die Pack-Pools (1:1 aus scripts/booster/catalog.py) und die
//  Deck-Rechnung (Rarity je Kartenkopie, Besitzprüfung, Herabstufen).
//
//  Gewichte sind Prozent; jede Zeile ergibt 100 (test/rarities.test.js).
// ═══════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PpRarities = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /** Aufsteigend: je weiter hinten, desto seltener. */
  const ORDER = ['common', 'uncommon', 'rare', 'prismatic', 'super', 'diamond', 'spectral', 'stained', 'umbra'];
  const LABEL = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare', prismatic: 'Prismatic', super: 'Super Rare',
    diamond: 'Diamond', spectral: 'Spectral', umbra: 'Umbra', stained: 'Stained Rare',
  };
  const RANK = {};
  ORDER.forEach((id, i) => { RANK[id] = i; });

  /** Seltenheiten, die ein Motiv (Subject-Maske, data/subject-masks.json) brauchen. */
  const NEEDS_MASK = { umbra: true, stained: true };

  function isRarity(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(RANK, id); }
  /** Rang einer Rarity (common = 0); Unbekanntes zählt als Common. */
  function rank(id) { return isRarity(id) ? RANK[id] : 0; }
  function label(id) { return LABEL[isRarity(id) ? id : 'common']; }
  /** Unbekanntes oder leeres wird zu 'common'. */
  function clean(id) { return isRarity(id) ? id : 'common'; }

  // ── Gewichte (Prozent, jede Zeile = 100) ──────────────────────
  const PACK_STAGES = [
    { uncommon: 60, rare: 30, prismatic: 5, super: 3, diamond: 1, spectral: 0.5, stained: 0.35, umbra: 0.15 },   // Karten 1–3
    { uncommon: 50, rare: 30, prismatic: 10, super: 5, diamond: 3, spectral: 1, stained: 0.65, umbra: 0.35 },    // Karten 4–6
    { rare: 50, prismatic: 25, super: 10, diamond: 6, spectral: 4, stained: 3, umbra: 2 },                       // Karten 7–9
  ];
  const DRAFT_TABLE = { common: 90, uncommon: 4, rare: 2, prismatic: 1, super: 0.75, diamond: 0.75, spectral: 0.5, umbra: 0.5, stained: 0.5 };
  const PACK_SIZE = 9;
  /** Booster-Pack-Preis in SC. */
  const PACK_PRICE = 20;

  function tableSum(table) { let s = 0; for (const k of Object.keys(table)) s += table[k]; return s; }

  /**
   * Würfelt eine Rarity aus einer Gewichtstabelle { id: Gewicht }.
   * @param {Object<string,number>} table
   * @param {() => number} [rand] liefert [0,1); Standard Math.random
   */
  function rollFromTable(table, rand) {
    const r = (typeof rand === 'function' ? rand : Math.random)();
    const keys = Object.keys(table).filter(k => table[k] > 0);
    let x = r * tableSum(table), last = keys[keys.length - 1];
    for (const k of keys) { x -= table[k]; if (x < 0) return k; }
    return last;
  }

  /** Eine Tabelle ohne die Rarities, die `ok(id)` ablehnt (für „Umbra/Stained nur mit Maske“). */
  function tableWithout(table, ok) {
    const t = {};
    for (const k of Object.keys(table)) if (ok(k)) t[k] = table[k];
    return t;
  }

  /**
   * Draft-Rarity einer Karte (Tabelle DRAFT_TABLE). Umbra/Stained gibt es nur, wenn die Karte eine Motiv-Maske hat:
   * wird so etwas gewürfelt, wird neu gewürfelt.
   * @param {string} cardName
   * @param {() => number} [rand]
   * @param {boolean|((name:string)=>boolean)} [hasMask] true/false oder eine Funktion (Name → Maske vorhanden)
   */
  function rollDraftRarity(cardName, rand, hasMask) {
    const masked = typeof hasMask === 'function' ? !!hasMask(cardName) : !!hasMask;
    for (let i = 0; i < 64; i++) {
      const id = rollFromTable(DRAFT_TABLE, rand);
      if (!NEEDS_MASK[id] || masked) return id;
    }
    return rollFromTable(tableWithout(DRAFT_TABLE, k => !NEEDS_MASK[k]), rand);
  }

  /**
   * Würfelt ein Booster-Pack: PACK_SIZE (9) Karten aus dem Pool, Rarities nach Stufe (Karten 1–3, 4–6, 7–9), danach nach Rarity
   * aufsteigend sortiert (gleiche Rarity: Reihenfolge der Würfe). Karte je Platz gleichverteilt aus dem Pool, Dubletten erlaubt.
   * Ohne Motiv-Maske keine Umbra/Stained: dann wird eine ANDERE Karte des Pools mit Maske gezogen (Rarity bleibt).
   * @param {Array<string|{name:string}>} cards Pack-Pool
   * @param {{rand?:()=>number, hasMask?:(name:string)=>boolean, size?:number}} [opts]
   * @returns {Array<{name:string, rarity:string}>}
   */
  function rollPack(cards, opts) {
    opts = opts || {};
    const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;
    const hasMask = typeof opts.hasMask === 'function' ? opts.hasMask : () => true;
    const size = opts.size || PACK_SIZE;
    const names = (cards || []).map(c => (typeof c === 'string' ? c : c && c.name)).filter(Boolean);
    if (!names.length) return [];
    let masked = null;   // träge: nur Karten mit Maske
    const pickFrom = (arr) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
    const out = [];
    for (let i = 0; i < size; i++) {
      const stage = PACK_STAGES[Math.min(PACK_STAGES.length - 1, Math.floor(i / 3))];
      let rarity = rollFromTable(stage, rand);
      let name = pickFrom(names);
      if (NEEDS_MASK[rarity] && !hasMask(name)) {
        if (!masked) masked = names.filter(n => hasMask(n));
        if (masked.length) name = pickFrom(masked);
        else rarity = 'diamond';   // Pool ohne ein einziges Motiv: nächstniedrigere Stufe ohne Maske-Pflicht
      }
      out.push({ name, rarity, _i: i });
    }
    out.sort((a, b) => (rank(a.rarity) - rank(b.rarity)) || (a._i - b._i));
    return out.map(({ name, rarity }) => ({ name, rarity }));
  }

  // ── Rückkauf (Sell Back) und Auslage (Showcase) ──────────────
  /** Sell Back: Gutschrift in SC für die EINE Karte, die man aus einem frisch geöffneten Pack zurückgeben darf. */
  const SELLBACK = { uncommon: 1, rare: 2, prismatic: 4, super: 6, diamond: 8, spectral: 10, stained: 14, umbra: 18 };
  /** Auslage: Preis in SC je Rarity. Die Auslage hat genau einen Platz je Rarity in dieser Tabelle (Common gibt es nicht zu kaufen). */
  const DISPLAY_PRICE = { uncommon: 2, rare: 4, prismatic: 8, super: 20, diamond: 30, spectral: 40, stained: 70, umbra: 100 };
  /** Plätze der Auslage in Rarity-Reihenfolge (aus der Preistabelle, nicht fest verdrahtet). */
  const DISPLAY_RARITIES = ORDER.filter(id => DISPLAY_PRICE[id] > 0);
  const HOUR_MS = 3600 * 1000;

  function sellbackValue(id) { return SELLBACK[id] > 0 ? SELLBACK[id] : 0; }

  /** Stundenindex (UTC, volle Stunde seit 1.1.1970): die Auslage wechselt bei jedem :00 und ist für alle Spieler gleich. */
  function displayHourIndex(ms) { return Math.floor((typeof ms === 'number' ? ms : Date.now()) / HOUR_MS); }
  /** Millisekunden bis zur nächsten vollen Stunde (immer 1 … 3 600 000). */
  function msToNextHour(ms) { const t = typeof ms === 'number' ? ms : Date.now(); return (displayHourIndex(t) + 1) * HOUR_MS - t; }

  /** 32-Bit-Hash eines Textes (FNV-1a). */
  function hash32(str) {
    let h = 0x811C9DC5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  /** Deterministischer Zufall in [0,1) (mulberry32). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** Sonderangebot (neunter Platz): halber Preis der gewürfelten Rarity, aufgerundet (Uncommon 2 → 1, Rare 4 → 2, Umbra 70 → 35, Stained 100 → 50). */
  function specialPrice(rarity) { return Math.ceil((DISPLAY_PRICE[rarity] || 0) / 2); }

  /**
   * Auslage einer Stunde: je Rarity aus DISPLAY_PRICE genau EINE Karte (die ersten Plätze, in Rarity-Reihenfolge) und als LETZTER Platz ein
   * Sonderangebot `special: true`: eine gewürfelte Rarity zum halben Preis (aufgerundet). Keine Karte steht doppelt, auch das Sonderangebot
   * ist eine andere Karte als die übrigen (die Rarity darf doppelt vorkommen). Rein aus (Stundenindex, Pool) bestimmt: jede Rarity hat ihren
   * eigenen Zufall (mulberry32 mit Hash aus „Stunde:Rarity“), das Sonderangebot seinen eigenen („Stunde:special“). Umbra/Stained nur mit
   * Motiv-Maske; die Rarities mit Masken-Pflicht werden zuerst gezogen (kleinster Pool), damit sie nie an einer schon vergebenen Karte scheitern.
   * @param {number} hour Stundenindex (displayHourIndex)
   * @param {Array<string|{name:string}>} cards sammelbare Karten (Pool; Reihenfolge egal, wird nach Namen sortiert)
   * @param {(name:string)=>boolean} [hasMask]
   * @returns {Array<{rarity:string, name:string, price:number, special?:true, fullPrice?:number}>} Plätze ohne passende Karte entfallen
   */
  function rollDisplay(hour, cards, hasMask) {
    const mask = typeof hasMask === 'function' ? hasMask : () => true;
    const names = Array.from(new Set((cards || []).map(c => (typeof c === 'string' ? c : c && c.name)).filter(Boolean))).sort();
    const used = new Set(), got = {};
    const pick = (r, seed) => {
      const cand = names.filter(n => !used.has(n) && (!NEEDS_MASK[r] || mask(n)));
      if (!cand.length) return null;
      return cand[Math.min(cand.length - 1, Math.floor(mulberry32(hash32(seed))() * cand.length))];
    };
    const rollOrder = DISPLAY_RARITIES.filter(r => NEEDS_MASK[r]).concat(DISPLAY_RARITIES.filter(r => !NEEDS_MASK[r]));
    for (const r of rollOrder) {
      const name = pick(r, hour + ':' + r);
      if (!name) continue;
      used.add(name);
      got[r] = name;
    }
    const out = DISPLAY_RARITIES.filter(r => got[r]).map(r => ({ rarity: r, name: got[r], price: DISPLAY_PRICE[r] }));
    // Sonderangebot: Rarity aus allen Plätzen der Preistabelle (gleich verteilt); ohne passende Karte die nächste in der Reihe
    const start = Math.floor(mulberry32(hash32(hour + ':special'))() * DISPLAY_RARITIES.length);
    for (let k = 0; k < DISPLAY_RARITIES.length; k++) {
      const r = DISPLAY_RARITIES[(start + k) % DISPLAY_RARITIES.length];
      const name = pick(r, hour + ':special:' + r);
      if (name) { out.push({ rarity: r, name, price: specialPrice(r), fullPrice: DISPLAY_PRICE[r], special: true }); break; }
    }
    return out;
  }

  // ── Pack-Pools (1:1 aus scripts/booster/catalog.py) ───────────
  const PACK_IDS = ['ability', 'hero', 'clash', 'monia', 'future', 'world1', 'world2', 'community', 'trials'];
  // Set-Kennungen je Pack. Gleichwertige Schreibweisen (SET1/SET01, MS1/MS01 …) stehen mit drin.
  const PACK_SETS = {
    clash: ['COH', 'SET1', 'SET01'],
    monia: ['ROM', 'SET2', 'SET02', 'MOE', 'SOD'],
    future: ['DRF', 'SET3', 'SET03', 'GBT', 'DD'],
    world1: ['MS1', 'MS01', 'MSAZ', 'MSEG', 'MSGB'],
    world2: ['MS2', 'MS02', 'MS3', 'MS03', 'MSIN', 'MSHW', 'MSRU', 'MSJP', 'MSCH'],
    community: ['MBS', 'MBS1'],
  };
  // „Trials and Tribulations“ = alles, was in keinem anderen Set-Pack landet.
  const FUTURE_ARCHETYPES = ['Lunatic', 'Guardian Beasts', 'Cybug'];
  const FUTURE_NAMES = ['Damus, the Prophet of Apocalypse', 'Ifrit', 'Armageddon'];

  /** 'PP MS1' → 'MS1', 'PP SET01' → 'SET01' */
  function normSet(s) { return String(s || '').toUpperCase().replace('PP ', '').trim().replace(/ /g, ''); }

  function packOfSet(norm) {
    for (const k of Object.keys(PACK_SETS)) if (PACK_SETS[k].indexOf(norm) >= 0) return k;
    return 'trials';
  }
  function packOfCard(c) {
    if (FUTURE_ARCHETYPES.indexOf(c.archetype) >= 0 || FUTURE_NAMES.indexOf(c.name) >= 0) return 'future';
    return packOfSet(normSet(c.setID));
  }

  /**
   * Karten eines Packs. Tokens (Set 'PP TOKEN' / Typ mit 'Token') und Karten ohne Kartenbild (Eintrag in data/card-art/index.json)
   * sind nie im Pool.
   * @param {string} packId
   * @param {Array<object>} cards data/cards.json
   * @param {object} [artIndex] data/card-art/index.json (Name → Eintrag); fehlt er, zählt jede Karte als bebildert
   * @returns {Array<object>}
   */
  function cardsOfPack(packId, cards, artIndex) {
    const out = [];
    for (const c of cards || []) {
      const t = String(c.cardType || '');
      if (c.setID === 'PP TOKEN' || t.indexOf('Token') >= 0) continue;
      if (artIndex && !artIndex[c.name]) continue;
      let ok;
      if (packId === 'ability') ok = t === 'Ability';
      else if (packId === 'hero') ok = t === 'Hero' || t === 'Ascended Hero';
      else ok = packOfCard(c) === packId;
      if (ok) out.push(c);
    }
    return out;
  }

  // ── Decks: Rarity je Kartenkopie ──────────────────────────────
  // deck.rarities = { main: ['common', …] (gleiche Länge/Reihenfolge wie mainDeck), potion: […], side: […],
  //                   heroes: [{ hero, ability1, ability2 } × Zahl der Helden] }
  const LISTS = [['main', 'mainDeck'], ['potion', 'potionDeck'], ['side', 'sideDeck']];

  function fixList(raw, names) {
    const out = new Array(names.length);
    for (let i = 0; i < names.length; i++) out[i] = names[i] ? clean(raw && raw[i]) : 'common';
    return out;
  }

  /**
   * Bringt rohe Rarity-Angaben in die Form des Decks: gleiche Längen, nur gültige Ids, Fehlendes = common.
   * @param {{mainDeck?:string[], potionDeck?:string[], sideDeck?:string[], heroes?:Array<{hero?:string,ability1?:string,ability2?:string}>}} deck
   * @param {object} [raw] deck.rarities (beliebig kaputt erlaubt)
   */
  function normalizeDeckRarities(deck, raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const [k, f] of LISTS) out[k] = fixList(Array.isArray(raw[k]) ? raw[k] : null, (deck && deck[f]) || []);
    const heroes = (deck && deck.heroes) || [];
    out.heroes = heroes.map((h, i) => {
      const r = Array.isArray(raw.heroes) && raw.heroes[i] && typeof raw.heroes[i] === 'object' ? raw.heroes[i] : {};
      return {
        hero: h && h.hero ? clean(r.hero) : 'common',
        ability1: h && h.ability1 ? clean(r.ability1) : 'common',
        ability2: h && h.ability2 ? clean(r.ability2) : 'common',
      };
    });
    return out;
  }

  /** Alle Kopien des Decks als Liste { zone, index, key, name, rarity } (key = 'hero'/'ability1'/'ability2' bei Helden). */
  function deckCopies(deck, rarities) {
    const r = normalizeDeckRarities(deck, rarities);
    const out = [];
    for (const [k, f] of LISTS) (deck[f] || []).forEach((name, i) => { if (name) out.push({ zone: k, index: i, name, rarity: r[k][i] }); });
    (deck.heroes || []).forEach((h, i) => {
      for (const key of ['hero', 'ability1', 'ability2']) if (h && h[key]) out.push({ zone: 'heroes', index: i, key, name: h[key], rarity: r.heroes[i][key] });
    });
    return out;
  }

  /** Verbrauch je (Karte, Rarity) über ALLE Zonen — nur Nicht-Common: { name: { rarity: n } }. */
  function rarityUsage(deck, rarities) {
    const use = {};
    for (const c of deckCopies(deck, rarities)) {
      if (c.rarity === 'common') continue;
      const u = use[c.name] || (use[c.name] = {});
      u[c.rarity] = (u[c.rarity] || 0) + 1;
    }
    return use;
  }

  function haveOf(owned, name, rarity) {
    const o = owned && owned[name];
    const n = o && o[rarity];
    return n > 0 ? n : 0;
  }

  /** Erste Besitz-Verletzung des Decks oder null. owned = { name: { rarity: n } } (Common unbegrenzt). */
  function firstOwnershipViolation(deck, rarities, owned) {
    const use = rarityUsage(deck, rarities);
    for (const name of Object.keys(use)) for (const rarity of Object.keys(use[name])) {
      const have = haveOf(owned, name, rarity);
      if (use[name][rarity] > have) return { card: name, rarity, need: use[name][rarity], have };
    }
    return null;
  }

  /** Stuft jede Kopie, die über den Besitz hinausgeht, auf Common herab (die ersten Kopien in Zonenreihenfolge bleiben). */
  function downgradeToOwned(deck, rarities, owned) {
    const r = normalizeDeckRarities(deck, rarities);
    const left = {};
    const take = (name, rarity) => {
      if (rarity === 'common') return 'common';
      const k = name + '\u0000' + rarity;
      if (left[k] === undefined) left[k] = haveOf(owned, name, rarity);
      if (left[k] > 0) { left[k]--; return rarity; }
      return 'common';
    };
    for (const [k, f] of LISTS) (deck[f] || []).forEach((name, i) => { if (name) r[k][i] = take(name, r[k][i]); });
    (deck.heroes || []).forEach((h, i) => {
      for (const key of ['hero', 'ability1', 'ability2']) if (h && h[key]) r.heroes[i][key] = take(h[key], r.heroes[i][key]);
    });
    return r;
  }

  /** true, wenn irgendeine Kopie nicht Common ist. */
  function hasAnyRarity(rarities) {
    if (!rarities) return false;
    for (const k of ['main', 'potion', 'side']) if ((rarities[k] || []).some(x => x && x !== 'common')) return true;
    return (rarities.heroes || []).some(h => h && (h.hero !== 'common' && h.hero || h.ability1 !== 'common' && h.ability1 || h.ability2 !== 'common' && h.ability2));
  }

  // ── Spielzustand: Rarity je Karte auf dem Tisch ───────────────
  // Der Spielablauf kennt Karten nur als Namen. Darum führt jeder Spieler einen „Kopienvorrat“ je Kartenname
  // (ledger[name] = Nicht-Common-Rarities der Kopien im Deck, absteigend). Beim Senden des Zustands bekommt die k-te sichtbare
  // Kopie eines Namens (Reihenfolge: Helden, Fähigkeiten, Support, Surprise, Area, Hand, Erschaffungszone, Coolness-Stapel,
  // Ablage, Löschstapel) die k-te Rarity des Vorrats; der Rest ist Common.

  /** Kopienvorrat eines Decks: { name: [rarity, …] } (nur Nicht-Common, absteigend), oder null, wenn alles Common ist. */
  function deckLedger(deck, rarities) {
    const out = {};
    let any = false;
    for (const c of deckCopies(deck, rarities)) {
      if (c.rarity === 'common') continue;
      (out[c.name] || (out[c.name] = [])).push(c.rarity);
      any = true;
    }
    if (!any) return null;
    for (const n of Object.keys(out)) out[n].sort((a, b) => rank(b) - rank(a));
    return out;
  }

  /**
   * Rarity der Kopien eines Decks NACH ZONE (für die Identitätsverfolgung im Spiel, cards/effects/_rarity-track.js):
   * { main:{name:[r…]}, potion:{…}, side:{…}, heroes:[{ hero, ability1, hr, r1, ability2, r2 }] } — nur Nicht-Common; null, wenn alles Common.
   */
  function deckZoneInfo(deck, rarities) {
    if (!deck) return null;
    const r = normalizeDeckRarities(deck, rarities);
    const out = { main: {}, potion: {}, side: {}, heroes: [] };
    let any = false;
    for (const [k, f] of LISTS) {
      (deck[f] || []).forEach((name, i) => {
        const x = r[k][i];
        if (!name || x === 'common') return;
        (out[k][name] || (out[k][name] = [])).push(x);
        any = true;
      });
    }
    out.heroes = (deck.heroes || []).map((h, i) => {
      const x = r.heroes[i] || {};
      const keep = (v) => (v && v !== 'common' ? v : null);
      if (keep(x.hero) || keep(x.ability1) || keep(x.ability2)) any = true;
      return { hero: (h && h.hero) || '', hr: keep(x.hero), ability1: (h && h.ability1) || '', r1: keep(x.ability1), ability2: (h && h.ability2) || '', r2: keep(x.ability2) };
    });
    return any ? out : null;
  }

  /**
   * Rarity-Beschriftung der sichtbaren Zonen eines Spielers (Spielersicht, nach dem Verbergen verdeckter Karten).
   * Liefert null (alles Common) oder Zonen in derselben Form wie im Zustand, mit Rarity-Id oder null je Karte:
   * { heroes:[r], abilityZones:[[[r]]], supportZones:[[[r]]], surpriseZones:[[r]], area:[r], hand:[r], creationZone:[r],
   *   coolnessStack:[r], discardPile:[r], deletedPile:[r] }
   * @param {object} p Spieler-Sicht (heroes[{name}], abilityZones, …, revealedHandCards)
   * @param {object|null} ledger deckLedger
   * @param {{area?:string[]}} [extra]
   */
  function annotatePlayer(p, ledger, extra) {
    if (!ledger || !p) return null;
    const used = {};
    let any = false;
    const one = (name) => {
      if (!name || name === '?') return null;
      const list = ledger[name];
      if (!list) return null;
      const k = used[name] || 0;
      used[name] = k + 1;
      const r = list[k];
      if (!r) return null;
      any = true;
      return r;
    };
    const flat = (arr) => (arr || []).map(n => one(n));
    const out = {};
    out.heroes = (p.heroes || []).map(h => one(h && h.name));
    out.abilityZones = (p.abilityZones || []).map(z => (z || []).map(flat));
    out.supportZones = (p.supportZones || []).map(z => (z || []).map(flat));
    out.surpriseZones = (p.surpriseZones || []).map(flat);
    out.area = flat(extra && extra.area);
    out.hand = flat(p.hand);
    out.creationZone = flat(p.creationZone);
    out.coolnessStack = flat(p.coolnessStack);
    out.discardPile = flat(p.discardPile);
    out.deletedPile = flat(p.deletedPile);
    return any ? out : null;
  }

  /** Rarity für eine Namensliste ohne feste Zone (aufgedeckte Gegner-Handkarten, Auswahllisten): gleiche Zählung wie oben, bei 0 beginnend. */
  function annotateNames(names, ledger) {
    if (!ledger) return null;
    const used = {};
    let any = false;
    const out = (names || []).map(n => {
      const list = n && n !== '?' && ledger[n];
      if (!list) return null;
      const k = used[n] || 0;
      used[n] = k + 1;
      if (list[k]) any = true;
      return list[k] || null;
    });
    return any ? out : null;
  }

  return {
    ORDER, LABEL, rank, isRarity, label, clean, NEEDS_MASK,
    PACK_STAGES, DRAFT_TABLE, PACK_SIZE, PACK_PRICE, tableSum,
    SELLBACK, DISPLAY_PRICE, DISPLAY_RARITIES, HOUR_MS, sellbackValue, displayHourIndex, msToNextHour, hash32, mulberry32, specialPrice, rollDisplay,
    rollFromTable, rollPack, rollDraftRarity,
    PACK_IDS, PACK_SETS, FUTURE_ARCHETYPES, FUTURE_NAMES, normSet, packOfSet, packOfCard, cardsOfPack,
    normalizeDeckRarities, deckCopies, rarityUsage, firstOwnershipViolation, downgradeToOwned, hasAnyRarity,
    deckLedger, deckZoneInfo, annotatePlayer, annotateNames,
  };
});
