'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — KARTENPOOL, HANDGENERIERUNG, RECYCLER-AUSGABE
//
//  Regel: jede Karte existiert im ganzen Spiel (über ALLE Spieler)
//  höchstens einmal. Der Pool gibt jeden Namen genau einmal aus; wer
//  ihn gezogen hat, behält ihn, und was im Recycler landet, ist für
//  immer weg und kommt nicht für andere zurück.
// ═══════════════════════════════════════════════════════════════════

const { CONFIG, HARD_EXCLUDED_TYPES } = require('./config');
const Rules = require('../public/skilltest-rules.js');
const { cardNamesWithImage } = require('../card-images');

/**
 * Nur Karten mit Bild in ./cards dürfen vorkommen (wie im Deckbuilder). Liefert ein Prädikat Name → bool;
 * ohne lesbaren Kartenordner oder mit fast keinem Bild (Testumgebung ohne Kartenkunst) filtert es nichts.
 */
function imageFilter(cardDB) {
  const set = cardNamesWithImage(Object.values(cardDB));
  if (!set || set.size < 50) return () => true;
  return (name) => set.has(name);
}

/** In welchen Typ-Topf gehört diese Karte? (null = nicht im Pool) */
function bucketOf(card) {
  if (!card || card.skilltestLegal !== true) return null;
  if (HARD_EXCLUDED_TYPES.has(card.cardType)) return null;
  switch (card.cardType) {
    case 'Hero': return 'hero';
    case 'Ability': return 'ability';
    case 'Creature': return 'creature';
    case 'Artifact': return 'artifact';
    case 'Potion': return 'potion';
    case 'Attack': case 'Spell': return 'attackSpell';
    default: return null;
  }
}

const BUCKETS = ['hero', 'ability', 'creature', 'artifact', 'potion', 'attackSpell'];

class CardPool {
  /** @param {Object<string,object>} cardDB  Name → Kartendaten  @param {() => number} [rng] */
  constructor(cardDB, rng) {
    this.rng = rng || Math.random;
    this.buckets = Object.fromEntries(BUCKETS.map(b => [b, []]));
    const hasImage = imageFilter(cardDB);
    this.names = new Set();                                  // alle Karten, die im Pool vorkommen dürfen (auch wenn schon ausgegeben)
    for (const c of Object.values(cardDB)) {
      const b = bucketOf(c);
      if (b && hasImage(c.name)) { this.buckets[b].push(c.name); this.names.add(c.name); }
    }
    // Partnerkarten von Heroes (hand-rules.js: Luna → Firewall, Mary → Cute Phoenix, Tsu'Ki → Lunatic-Ausrüstungen …) sind reserviert, solange ihr Hero im
    // Pool ist: sie kommen NUR zusammen mit ihrem Hero (`takeNamed`), nie in die Hand eines anderen Spielers und nie aus dem Recycler.
    this.reserved = new Set();
    {
      const HR = require('./hand-rules');
      for (const hero of this.buckets.hero) for (const p of HR.partnersOf(cardDB, hero)) if (this.names.has(p)) this.reserved.add(p);
      for (const b of BUCKETS) this.buckets[b] = this.buckets[b].filter(n => !this.reserved.has(n));
    }
    // Rotation: von den Cardinal Beasts ist in dieser Partie eines gesperrt (zufällig), die übrigen bleiben im Pool.
    this.banned = [];
    const cb = (CONFIG.CARDINAL_BEASTS || []).filter(n => this.buckets.creature.includes(n));
    if (cb.length >= 2) {
      const ban = cb[Math.floor(this.rng() * cb.length)];
      this.buckets.creature = this.buckets.creature.filter(n => n !== ban);
      this.banned.push(ban);
    }
  }

  /** Darf diese Karte in dieser Partie vorkommen (legal, mit Bild, nicht rotiert)? */
  has(name) { return this.names.has(name) && !this.banned.includes(name); }

  /** Genau diese Karte aus dem Pool nehmen (null, wenn sie schon vergeben ist). */
  takeNamed(name) {
    if (this.reserved.has(name)) { this.reserved.delete(name); return name; }
    for (const b of BUCKETS) {
      const arr = this.buckets[b];
      const i = arr.indexOf(name);
      if (i >= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); return name; }
    }
    return null;
  }

  /** Eine zufällige Karte eines Topfes nehmen, die `pred(name)` erfüllt (null, wenn keine passt). */
  takeWhere(bucket, pred) {
    const arr = this.buckets[bucket] || [];
    const idx = [];
    for (let i = 0; i < arr.length; i++) if (pred(arr[i])) idx.push(i);
    if (!idx.length) return null;
    const i = idx[Math.floor(this.rng() * idx.length)];
    const name = arr[i];
    arr[i] = arr[arr.length - 1];
    arr.pop();
    return name;
  }

  /** Eine Karte zurück in ihren Topf legen (z. B. wenn die Hand-Regeln sie nicht erlauben). */
  give(bucket, name) { if (name) this.buckets[bucket].push(name); }

  remaining(bucket) {
    if (bucket) return this.buckets[bucket].length;
    return BUCKETS.reduce((n, b) => n + this.buckets[b].length, 0);
  }

  /** Eine zufällige Karte aus dem Topf entnehmen (oder null, wenn leer). */
  take(bucket) {
    const arr = this.buckets[bucket];
    if (!arr || !arr.length) return null;
    const i = Math.floor(this.rng() * arr.length);
    const name = arr[i];
    arr[i] = arr[arr.length - 1];
    arr.pop();
    return name;
  }

  /**
   * Eine zufällige Karte aus dem GANZEN restlichen Pool. Ohne Gewichte
   * ist das reiner Zufall über alle Karten (Spieler-Vorgabe für den
   * Recycler); `weights` (Topf → Gewicht) kann das später verschieben.
   */
  takeAny(weights) {
    const ws = BUCKETS.map(b => (this.buckets[b].length ? (weights ? (weights[b] || 0) * 1 : this.buckets[b].length) : 0));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = this.rng() * total;
    for (let i = 0; i < BUCKETS.length; i++) {
      if (r < ws[i]) return this.take(BUCKETS[i]);
      r -= ws[i];
    }
    return this.take(BUCKETS[BUCKETS.length - 1]);
  }
}

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Trefferzahlen je Topf für eine Startkarten-Hand (semi-fixe Raten). */
function sampleHandShape(rng = Math.random) {
  const { heroes, abilities, creatures } = CONFIG.HAND_RATES;
  let h, a, c;
  for (let tries = 0; tries < 200; tries++) {
    h = randInt(rng, heroes[0], heroes[1]);
    a = randInt(rng, abilities[0], abilities[1]);
    c = randInt(rng, creatures[0], creatures[1]);
    if (h + a + c <= CONFIG.HAND_SIZE - CONFIG.MIN_REST_CARDS) break;
    h = a = c = null;
  }
  if (h == null) { h = heroes[0]; a = abilities[0]; c = creatures[0]; }
  const rest = CONFIG.HAND_SIZE - h - a - c;
  const shape = { hero: h, ability: a, creature: c, artifact: 0, potion: 0, attackSpell: 0 };
  const w = CONFIG.REST_WEIGHTS;
  const total = w.Artifact + w.Potion + w.AttackSpell;
  for (let i = 0; i < rest; i++) {
    const r = rng() * total;
    if (r < w.Artifact) shape.artifact++;
    else if (r < w.Artifact + w.Potion) shape.potion++;
    else shape.attackSpell++;
  }
  return shape;
}

/**
 * `count` Heroes ziehen. Hand-only-Heroes (Quetzahuitl) zählen als Hero der Hand, aber das Brett braucht drei ANDERE:
 * Er darf nur in eine Hand mit mindestens vier Heroes (und höchstens einer pro Hand) — sonst geht er zurück in den Pool.
 */
function takeHeroes(pool, count) {
  const only = new Set(Rules.HAND_ONLY_HEROES);
  const names = [], parked = [];
  let hasOnly = false, missing = 0;
  while (names.length < count) {
    const name = pool.take('hero');
    if (!name) { missing = count - names.length; break; }
    if (only.has(name)) {
      if (hasOnly || count < 4) { parked.push(name); continue; }
      hasOnly = true;
    }
    names.push(name);
  }
  for (const n of parked) pool.give('hero', n);
  return { names, missing };
}

/** Eine Startkarten-Hand aus dem Pool ziehen (Karten verlassen den Pool). */
function dealHand(pool, rng = Math.random, ctx = null) {
  const shape = sampleHandShape(rng);
  const hand = [];
  let missing = 0;
  for (const b of BUCKETS) {
    if (b === 'hero') { const r = takeHeroes(pool, shape.hero); hand.push(...r.names); missing += r.missing; continue; }
    for (let i = 0; i < shape[b]; i++) {
      const name = pool.take(b);
      if (name) hand.push(name); else missing++;
    }
  }
  // Ein leerer Topf wird aus dem restlichen Pool aufgefüllt (nie Heroes/Abilities erzwingen).
  while (missing-- > 0) {
    const name = pool.takeAny({ creature: 1, artifact: 1, attackSpell: 1, potion: 1 });
    if (name) hand.push(name);
  }
  // Hand-Garantien (hand-rules.js): Heldenpartner und Spells der Schulen der Heroes — nur mit `ctx = { cards, ps }` (der Zustand landet in ps.rules).
  if (ctx && ctx.cards && ctx.ps) {
    ctx.ps.rules = ctx.ps.rules || {};
    require('./hand-rules').onHeroesInHand({ pool, cards: ctx.cards, hand, state: ctx.ps.rules, rng });
  }
  // Mischen (Fisher-Yates), damit die Hand nicht nach Typ sortiert ankommt.
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
  return { hand, shape };
}

module.exports = { CardPool, bucketOf, imageFilter, sampleHandShape, dealHand, BUCKETS };
