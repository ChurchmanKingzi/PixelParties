'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Yukana, the Scholar on the Run"  (v1315, neuer Text)
//  Hero — 400 HP, 40 ATK — Learning / Wisdom — PP MSJP
//
//  "As long as this Hero does not have a Spell School Ability attached
//   to it, you may once per turn perform a level 1 or 2 Spell with it as
//   an additional Action."
//
//  ★ v1315 (Als Vorgabe 23.9.): AKTIVER Heldeneffekt — Yukana wird
//  angeklickt, dann bietet eine abbrechbare Galerie alle Spells an, die
//  sie jetzt wirken kann (Level 1 oder 2 — das AKTUELLE Level, v1316). Der
//  gewaehlte Spell laeuft als Zusatzaktion mit Yukana (`_castSpellImmediately`,
//  derselbe Weg wie jede Sofort-Zusatzaktion). v1314 machte solche
//  Spells stillschweigend gratis — das war zu viel.
//
//  • Spell School Abilities (Al 23.9.): Decay, Destruction, Magic Arts,
//    Summoning, Support Magic — `spellSchoolAbilitiesOn` aus `_hooks.js`.
//  • „once per turn": Heldeneffekt → hart, pro Spieler (Als Ruling 22.9.,
//    `_hero-hopt-shared`). Abbruch in Galerie ODER in der Zielwahl des
//    Spells → nichts verbraucht.
// ═══════════════════════════════════════════
const { spellSchoolAbilitiesOn } = require('./_hooks');
const { heldenSperreFrei, heldenSperreSetzen } = require('./_hero-hopt-shared');

const CARD_NAME = 'Yukana, the Scholar on the Run';
const SPERRE = 'yukana_spell';

/** v1316 (Als Befund 23.9.): das AKTUELLE Level zaehlt, nicht das
 *  gedruckte — mit allen Senkungen/Zuschlaegen fuer Yukana als Wirkerin
 *  und dem Offset genau dieser Handkopie (Tobi …). */
function aktuellesLevel(engine, pi, hi, cd, handIdx) {
  return engine.effectiveCardLevel(cd, pi, { heroIdx: hi, handIdx });
}
function passenderSpell(cd, stufe = cd?.level) {
  return !!cd && cd.cardType === 'Spell' && (stufe === 1 || stufe === 2);
}

/** Spells auf der Hand, die Yukana JETZT wirken koennte. */
function wirkbar(engine, pi, hi) {
  const gs = engine.gs;
  const hero = gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) return [];
  if (spellSchoolAbilitiesOn(gs.players[pi]?.abilityZones?.[hi]).length > 0) return [];
  if (engine.isHeroIncapacitated(pi, hi)) return [];
  const db = engine._getCardDB();
  const erlaubt = new Set(engine.getHeroEligibleActionCards(pi, hi));
  const hand = gs.players[pi]?.hand || [];
  const out = [];
  hand.forEach((n, i) => {
    if (!erlaubt.has(n) || out.includes(n)) return;
    if (passenderSpell(db[n], aktuellesLevel(engine, pi, hi, db[n], i))) out.push(n);
  });
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (!heldenSperreFrei(engine.gs, SPERRE, pi)) return false;
    return wirkbar(engine, pi, ctx.cardHeroIdx).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!heldenSperreFrei(gs, SPERRE, pi)) return false;
    const spells = wirkbar(engine, pi, hi);
    if (spells.length === 0) return false;

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: `Choose a level 1 or 2 Spell for ${ps.heroes[hi].name} to perform as an additional Action.`,
      cards: spells.map(name => ({ name, source: 'hand' })),
      cancellable: true,
    });
    const name = wahl?.cardName;
    if (!name || !spells.includes(name)) return false;
    const idx = ps.hand.indexOf(name);
    if (idx < 0) return false;

    const r = await engine._castSpellImmediately(pi, hi, name, {
      fromZone: 'hand', pool: ps.hand, poolIndex: idx, by: CARD_NAME,
    });
    if (!r || r.cancelled) return false;   // Zielwahl abgebrochen → nichts verbraucht
    heldenSperreSetzen(gs, SPERRE, pi);
    engine.log('yukana_free_spell', { player: ps.username, card: name });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    const best = [...(p.cards || [])].sort((a, b) => (db[b.name]?.level || 0) - (db[a.name]?.level || 0))[0];
    return best ? { cardName: best.name, source: best.source } : undefined;
  },

  _test: { passenderSpell, wirkbar },
};
