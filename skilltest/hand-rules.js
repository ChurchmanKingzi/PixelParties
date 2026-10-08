'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — HAND-GARANTIEN UND RECYCLER-REGELN (Nutzer 7.10./8.10.)
//
//  1) Heldenpartner: Nennt ein Hero einen bestimmten Spell in seinem Text (Luna → „Firewall“, Sol Rym → „Chain Lightning“,
//     Damus → „Armageddon“, Natas → „The Master's Plan“), liegt dieser Spell GARANTIERT mit dem Hero auf der Hand. Dazu kommen Sonderfälle aus
//     CONFIG.HERO_PARTNERS (Mary → Cute Phoenix, Baaliel → Horned Demon, Damus → Ifrit, Arthor → The White Eye) und zufällige Partner aus
//     CONFIG.HERO_RANDOM_PARTNERS (Tsu'Ki → 1–3 verschiedene Lunatic-Ausrüstungen).
//     Partnerkarten sind für ANDERE Spieler nicht zu bekommen: sie werden beim Anlegen des Pools reserviert (`CardPool.reserved`), solange ihr
//     Held im Pool ist — es gibt weder Zusatzkarten aus dem Nichts noch Duplikate.
//  2) Spell-Schule: Hat ein Hero der Hand eine Spell School (Magic Arts, Decay, Support, Destruction — NICHT Summoning Magic) als Start-Ability,
//     liegen Spells dieser Schulen mit einem Gesamtlevel von mindestens 1–5 (zufällig) auf der Hand. Hat er ZWEI solche Schulen, liegt zusätzlich je
//     Schule ein Lv-3-Spell auf der Hand (aus drei zufälligen der wirkungsvollste nach gelerntem Kartenwert).
//  3) Recycler: Ein Spell aus dem Recycler gehört — falls möglich — zu einer Spell School der Heroes auf dem Brett.
//
//  Die Hand wächst dabei NIE über CONFIG.HAND_SIZE (18): reicht der Platz nicht, fliegen zufällige andere Karten (keine Heroes, keine garantierten)
//  zurück in den Pool. Garantien greifen je Hero und Schule EINMAL (beim Austeilen bzw. wenn der Hero aus dem Recycler kommt) — wer die Karten
//  recycelt, bekommt sie nicht noch einmal (sonst ließe sich damit Gold farmen).
//
//  Zustand je Spieler: `ps.rules = { given: { Heldenname: 1 }, schools: { Schule: 1 }, guaranteed: [Namen] }` (JSON-sicher, bleibt beim Klonen erhalten).
// ═══════════════════════════════════════════════════════════════════
const { CONFIG } = require('./config');

/** Spell Schools, in denen es Spells gibt (cards.json: spellSchool1/2 der Karten vom Typ Spell). */
const SPELL_SCHOOLS = ['Magic Arts', 'Decay Magic', 'Support Magic', 'Destruction Magic', 'Summoning Magic'];
/** Schulen, die die Garantien auslösen (Summoning Magic nicht: Beschwörer brauchen keine Zauber). */
const GUARANTEE_SCHOOLS = SPELL_SCHOOLS.filter(s => s !== 'Summoning Magic');
/** Level der garantierten Spells: sofort wirkbar mit einer Start-Ability auf Stufe 3. */
const GUARANTEE_SPELL_LEVELS = [1, 3];

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Spell Schools eines Heroes (seine Start-Abilities). */
function heroSchools(card) {
  return [card && card.startingAbility1, card && card.startingAbility2].filter(a => a && SPELL_SCHOOLS.includes(a));
}
const spellSchools = (card) => [card && card.spellSchool1, card && card.spellSchool2].filter(Boolean);
const isNormalSpell = (c) => !!c && c.cardType === 'Spell' && ['', 'normal'].includes((c.subtype || '').toLowerCase());

const _partnerCache = new WeakMap();
/** Feste Partner eines Heroes: genannte Spells (Anführungszeichen im Text) + Sonderfälle aus der Config. */
function fixedPartners(cards, heroName) {
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

/** Kandidaten der zufälligen Partner eines Heroes (legale Karten mit dem Namenspräfix) — oder null. */
function randomPartnerSpec(cards, heroName) {
  const spec = CONFIG.HERO_RANDOM_PARTNERS && CONFIG.HERO_RANDOM_PARTNERS[heroName];
  if (!spec) return null;
  const from = (spec.from || Object.values(cards).filter(c => c.skilltestLegal === true && c.name.startsWith(spec.prefix)).map(c => c.name)).filter(n => cards[n]);
  return { from, count: spec.count || [1, 1] };
}

/** ALLE Karten, die dieser Hero mitbringen kann (feste und mögliche zufällige) — Grundlage der Reservierung im Pool. */
function partnersOf(cards, heroName) {
  const spec = randomPartnerSpec(cards, heroName);
  return [...fixedPartners(cards, heroName), ...(spec ? spec.from : [])];
}

/** Lernwert einer Karte aus dem Profil (Mittel der Platzierungsgüte beim Austeilen); 0 ohne Profil. */
function learnedValue(name) {
  try {
    const L = require('./learn/profile'), prof = L.get();
    const e = prof && ((prof.dealtValue && prof.dealtValue[name]) || (prof.cardValue && prof.cardValue[name]));
    return e ? L.meanOf(e) : 0;
  } catch { return 0; }
}

/** Hand auf CONFIG.HAND_SIZE zurückschneiden: zufällige Karten (nicht geschützt, keine Heroes) zurück in den Pool. */
function makeRoom({ pool, cards, hand, protectedNames, rng }) {
  const cap = CONFIG.HAND_SIZE;
  const bucketOf = require('./pool').bucketOf;
  const removed = [];
  while (hand.length > cap) {
    const idx = [];
    hand.forEach((n, i) => { const c = cards[n]; if (c && c.cardType !== 'Hero' && !protectedNames.has(n)) idx.push(i); });
    if (!idx.length) break;
    const i = idx[Math.floor(rng() * idx.length)];
    const [name] = hand.splice(i, 1);
    const b = bucketOf(cards[name]);
    if (b) pool.give(b, name);
    removed.push(name);
  }
  return removed;
}

/**
 * Garantien für die Heroes der Hand anwenden (beim Austeilen und wenn ein Hero aus dem Recycler kommt). Hängt Karten an `hand` an, schneidet die
 * Hand auf 18 zurück und gibt die zusätzlich gegebenen Karten zurück. `state` ist `ps.rules` (wird fortgeschrieben).
 */
function onHeroesInHand({ pool, cards, hand, state, rng = Math.random }) {
  const added = [];
  if (!state) return added;
  state.given = state.given || {}; state.schools = state.schools || {}; state.guaranteed = state.guaranteed || [];
  const heroes = hand.filter(n => cards[n] && cards[n].cardType === 'Hero');
  const give = (name) => { hand.push(name); added.push(name); state.guaranteed.push(name); };
  // 1) Partner der Heroes (je Hero einmal) — reserviert, also nie schon bei jemand anderem
  for (const h of heroes) {
    if (state.given[h]) continue;
    state.given[h] = 1;
    for (const p of fixedPartners(cards, h)) {
      if (hand.includes(p) || !pool.has(p)) continue;
      const got = pool.takeNamed(p);
      if (got) give(got);
    }
    const spec = randomPartnerSpec(cards, h);
    if (spec) {
      const avail = spec.from.filter(n => pool.has(n) && !hand.includes(n));
      const k = Math.min(avail.length, randInt(rng, spec.count[0], spec.count[1]));
      for (let i = 0; i < k; i++) {
        const n = avail.splice(Math.floor(rng() * avail.length), 1)[0];
        const got = pool.takeNamed(n);
        if (got) give(got);
      }
    }
  }
  // 2) Spell-School-Garantien (je Schule einmal)
  const heroSch = new Set(heroes.flatMap(h => heroSchools(cards[h])));
  const fresh = [...heroSch].filter(s => GUARANTEE_SCHOOLS.includes(s) && !state.schools[s]);
  if (fresh.length) {
    const levelOf = (c) => Number.isFinite(c.level) ? c.level : 0;
    const matches = (c) => spellSchools(c).some(s => heroSch.has(s));
    // 2a) Zwei Schulen an einem Hero: je Schule ein Lv-3-Spell (der wirkungsvollste von dreien nach gelerntem Kartenwert)
    for (const h of heroes) {
      const two = [...new Set(heroSchools(cards[h]))].filter(s => GUARANTEE_SCHOOLS.includes(s));
      if (two.length < 2 || state.given['spells:' + h]) continue;
      state.given['spells:' + h] = 1;
      for (const s of two) {
        if (hand.some(n => { const c = cards[n]; return isNormalSpell(c) && levelOf(c) === 3 && spellSchools(c).includes(s); })) continue;
        const picks = [];
        for (let i = 0; i < 3; i++) {
          const n = pool.takeWhere('attackSpell', (x) => { const c = cards[x]; return isNormalSpell(c) && levelOf(c) === 3 && spellSchools(c).includes(s) && !picks.includes(x); });
          if (n) picks.push(n);
        }
        if (!picks.length) continue;
        picks.sort((a, b) => learnedValue(b) - learnedValue(a));
        give(picks[0]);
        for (const n of picks.slice(1)) pool.give('attackSpell', n);
      }
    }
    // 2b) Mindestlevel 1–5 an Spells der Schulen der Heroes
    for (const s of fresh) state.schools[s] = 1;
    const target = randInt(rng, 1, 5);
    let have = hand.reduce((sum, n) => { const c = cards[n]; return sum + (c && c.cardType === 'Spell' && matches(c) ? levelOf(c) : 0); }, 0);
    for (let guard = 0; guard < 12 && have < target; guard++) {
      const name = pool.takeWhere('attackSpell', (n) => {
        const c = cards[n];
        return isNormalSpell(c) && matches(c) && levelOf(c) >= GUARANTEE_SPELL_LEVELS[0] && levelOf(c) <= GUARANTEE_SPELL_LEVELS[1];
      });
      if (!name) break;
      give(name); have += levelOf(cards[name]);
    }
  }
  // 3) Nie mehr als 18 Karten: Platz schaffen (garantierte und Heroes bleiben)
  if (hand.length > CONFIG.HAND_SIZE) makeRoom({ pool, cards, hand, protectedNames: new Set(state.guaranteed), rng });
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

module.exports = { SPELL_SCHOOLS, GUARANTEE_SCHOOLS, heroSchools, spellSchools, fixedPartners, partnersOf, randomPartnerSpec, onHeroesInHand, boardSchools, eject, makeRoom };
