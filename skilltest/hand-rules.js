'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — HAND-GARANTIEN UND RECYCLER-REGELN (Nutzer 7.10.)
//
//  1) Heldenpartner: Nennt ein Hero einen bestimmten Spell in seinem Text (Luna → „Firewall“, Sol Rym → „Chain Lightning“,
//     Damus → „Armageddon“, Natas → „The Master's Plan“), liegt dieser Spell GARANTIERT mit dem Hero auf der Hand.
//     Dazu kommen Sonderfälle aus CONFIG.HERO_PARTNERS (Cute Princess Mary → Cute Phoenix).
//  2) Spell-Schule: Hat mindestens ein Hero der Hand eine Spell School (Magic Arts, Decay, Support, Destruction — NICHT Summoning Magic) als
//     Start-Ability, liegen Spells dieser Schulen mit einem Gesamtlevel von mindestens 1–5 (zufällig) garantiert auf der Hand.
//  3) Recycler: Ein Spell aus dem Recycler gehört — falls möglich — zu einer Spell School der Heroes auf dem Brett.
//
//  Die garantierten Karten kommen aus dem Pool (jede Karte existiert nur einmal); ist ein Partner schon vergeben, erscheint er als Zusatzkarte.
//  Garantien greifen je Hero und Schule EINMAL (beim Austeilen bzw. wenn der Hero aus dem Recycler kommt) — wer die Karten recycelt, bekommt sie nicht
//  noch einmal (sonst ließe sich damit Gold farmen).
//
//  Zustand je Spieler: `ps.rules = { given: { Heldenname: 1 }, schools: { Schule: 1 } }` (JSON-sicher, bleibt beim Klonen erhalten).
// ═══════════════════════════════════════════════════════════════════
const { CONFIG } = require('./config');

/** Spell Schools, in denen es Spells gibt (cards.json: spellSchool1/2 der Karten vom Typ Spell). */
const SPELL_SCHOOLS = ['Magic Arts', 'Decay Magic', 'Support Magic', 'Destruction Magic', 'Summoning Magic'];
/** Schulen, die die Mindestlevel-Garantie auslösen (Summoning Magic nicht: Beschwörer brauchen keine Zauber). */
const GUARANTEE_SCHOOLS = SPELL_SCHOOLS.filter(s => s !== 'Summoning Magic');
/** Level der garantierten Spells: sofort wirkbar mit einer Start-Ability auf Stufe 3. */
const GUARANTEE_SPELL_LEVELS = [1, 3];

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Spell Schools eines Heroes (seine Start-Abilities). */
function heroSchools(card) {
  return [card && card.startingAbility1, card && card.startingAbility2].filter(a => a && SPELL_SCHOOLS.includes(a));
}
const spellSchools = (card) => [card && card.spellSchool1, card && card.spellSchool2].filter(Boolean);

const _partnerCache = new WeakMap();
/** Namen der Karten, die mit diesem Hero garantiert kommen: genannte Spells (Anführungszeichen im Text) + Sonderfälle aus der Config. */
function partnersOf(cards, heroName) {
  let m = _partnerCache.get(cards);
  if (!m) { m = new Map(); _partnerCache.set(cards, m); }
  if (m.has(heroName)) return m.get(heroName);
  const hero = cards[heroName];
  const out = [];
  if (hero && hero.cardType === 'Hero') {
    for (const mt of String(hero.effect || '').matchAll(/"([^"]+)"/g)) {
      const c = cards[mt[1]];
      if (c && c.name !== heroName && c.cardType === 'Spell' && !out.includes(c.name)) out.push(c.name);
    }
    for (const n of (CONFIG.HERO_PARTNERS && CONFIG.HERO_PARTNERS[heroName]) || []) if (cards[n] && !out.includes(n)) out.push(n);
  }
  m.set(heroName, out);
  return out;
}

/**
 * Garantien für die Heroes der Hand anwenden (beim Austeilen und wenn ein Hero aus dem Recycler kommt). Hängt Karten an `hand` an und gibt sie zurück.
 * `state` ist `ps.rules` (wird fortgeschrieben).
 */
function onHeroesInHand({ pool, cards, hand, state, rng = Math.random }) {
  const added = [];
  if (!state) return added;
  state.given = state.given || {}; state.schools = state.schools || {};
  const heroes = hand.filter(n => cards[n] && cards[n].cardType === 'Hero');
  // 1) Partner der Heroes (je Hero einmal)
  for (const h of heroes) {
    if (state.given[h]) continue;
    state.given[h] = 1;
    for (const p of partnersOf(cards, h)) {
      if (hand.includes(p) || added.includes(p)) continue;
      if (!pool.has(p)) continue;                                   // nicht im Pool (gesperrt / ohne Bild)
      const got = pool.takeNamed(p) || p;                           // schon vergeben → Zusatzkarte
      hand.push(got); added.push(got);
    }
  }
  // 2) Spell-School-Mindestlevel (je Schule einmal)
  const heroSch = new Set(heroes.flatMap(h => heroSchools(cards[h])));
  const fresh = [...heroSch].filter(s => GUARANTEE_SCHOOLS.includes(s) && !state.schools[s]);
  if (fresh.length) {
    for (const s of fresh) state.schools[s] = 1;
    const target = randInt(rng, 1, 5);
    const matches = (c) => spellSchools(c).some(s => heroSch.has(s));
    const levelOf = (c) => Number.isFinite(c.level) ? c.level : 0;
    let have = hand.reduce((sum, n) => { const c = cards[n]; return sum + (c && c.cardType === 'Spell' && matches(c) ? levelOf(c) : 0); }, 0);
    for (let guard = 0; guard < 12 && have < target; guard++) {
      const name = pool.takeWhere('attackSpell', (n) => {
        const c = cards[n];
        if (!c || c.cardType !== 'Spell' || !matches(c)) return false;
        const sub = (c.subtype || '').toLowerCase();
        return (sub === '' || sub === 'normal') && levelOf(c) >= GUARANTEE_SPELL_LEVELS[0] && levelOf(c) <= GUARANTEE_SPELL_LEVELS[1];
      });
      if (!name) break;
      hand.push(name); added.push(name); have += levelOf(cards[name]);
    }
  }
  return added;
}

/** Spell Schools der Heroes auf dem Brett (Summoning Magic eingeschlossen — es geht darum, welche Spells ein Hero überhaupt wirken kann). */
function boardSchools(cards, ps) {
  const set = new Set();
  for (const h of ps.heroes || []) if (h) for (const s of heroSchools(cards[h])) set.add(s);
  return set;
}

/**
 * Eine Karte aus dem Recycler auswerfen (jede RECYCLE_EVERY-te eingeworfene). Ein Spell muss — falls möglich — zu einer Schule der Heroes auf dem
 * Brett gehören; nicht passende Spells gehen zurück in den Pool und es wird neu gezogen. Kommt ein Hero heraus, greifen seine Garantien.
 * Hängt die Karte(n) an `ps.hand` an. Rückgabe: { ejected, extras } (`ejected` null, wenn der Pool leer ist).
 */
function eject({ pool, cards, ps, weights, rng = Math.random }) {
  const schools = boardSchools(cards, ps);
  const back = [];
  let ejected = null;
  for (let tries = 0; tries < 60; tries++) {
    const n = pool.takeAny(weights);
    if (!n) break;
    const c = cards[n];
    if (schools.size && c && c.cardType === 'Spell' && !spellSchools(c).some(s => schools.has(s)) && tries < 59) { back.push(n); continue; }
    ejected = n; break;
  }
  for (const n of back) pool.give(require('./pool').bucketOf(cards[n]), n);
  if (!ejected) return { ejected: null, extras: [] };
  ps.hand.push(ejected);
  ps.rules = ps.rules || {};
  const extras = onHeroesInHand({ pool, cards, hand: ps.hand, state: ps.rules, rng });
  return { ejected, extras };
}

module.exports = { SPELL_SCHOOLS, GUARANTEE_SCHOOLS, heroSchools, spellSchools, partnersOf, onHeroesInHand, boardSchools, eject };
