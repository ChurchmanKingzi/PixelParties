// ═══════════════════════════════════════════
//  CARD EFFECT: "Paraseed Control"
//  Spell (Reaction, Lv0, Decay Magic)
//
//  „Play this card immediately when a Hero your opponent controls is
//   defeated by Poison while it has a \"Paraseed\" in its Support Zone.
//   Revive that Hero. Its current and max HP become 100 and cannot be
//   increased in any way. You take permanent control of that Hero.\"
//
//  Bauform
//  ───────
//  • Reaktionsfenster `onHeroKO` (Engine-Beschreibung „A hero was
//    knocked out\"): `gs._heroKOContext` traegt Held, Quelle, Seite
//    und Schadenstyp. Vorbild: `loot-the-leftovers.js`.
//  • „HP become 100 and cannot be increased\" ist genau
//    `actionReviveHero(..., 100, { maxHpCap: 100 })` — `maxHpCapped`
//    weist jede spaetere Erhoehung ab (`increaseMaxHp`).
//  • „permanent control\" ist die neue Engine-Primitive
//    `actionTakeHeroPermanently` (v718). Der Held bleibt physisch in
//    der Spalte seines urspruenglichen Besitzers stehen — Helden
//    haben drueben keinen freien Platz —, zaehlt aber ab sofort in
//    jeder Rechnung mir: Niederlagebedingung, Flaechenschaden,
//    Zielwahl, spielbare Karten (Als Ruling 4.9.).
//  • Die Wiederbelebung raeumt `hero.statuses` leer. Die Paraseed
//    liegt aber weiter in der Zone — also legt der Abgleich des
//    Shared-Moduls ihr Gift danach wieder auf.
// ═══════════════════════════════════════════

const { heroHasParaseed, syncParaseedPoison } = require('./_paraseed-shared');

const CARD_NAME = 'Paraseed Control';
const REVIVE_HP = 100;

/** Der KO, auf den diese Karte reagieren darf — oder null. */
function passenderKO(gs, pi, engine) {
  const ko = gs._heroKOContext;
  if (!ko?.hero) return null;
  if (ko.type !== 'poison') return null;

  // „a Hero your opponent controls\" — nach KONTROLLE, nicht nach
  // Spalte. Ein Held, den der Gegner mir schon abgenommen hat, ist
  // fuer diese Karte ein gegnerischer.
  const owner = ko.heroOwner;
  if (!Number.isInteger(owner) || owner < 0) return null;
  const seite = engine ? engine.heroSideOf(owner, ko.hero) : owner;
  if (seite === pi) return null;

  const heroIdx = (gs.players[owner]?.heroes || []).indexOf(ko.hero);
  if (heroIdx < 0) return null;
  if (ko.hero.hp > 0) return null;                    // doch nicht gefallen
  if (engine && !heroHasParaseed(engine, owner, heroIdx)) return null;
  return { owner, heroIdx, hero: ko.hero };
}

module.exports = {
  isReaction: true,
  // Uebernahme fremder Ziele — dieselbe Marke wie Loot the Leftovers
  // und Dark Gear, damit Boris & Co. die Karte sperren koennen.
  takesControlOfTargets: true,

  reactionCondition: (gs, pi, engine, _chainCtx) => {
    const treffer = passenderKO(gs, pi, engine);
    if (!treffer) return false;

    // Ein lebender, handlungsfaehiger Held von mir muss die Karte
    // wirken koennen (Decay Magic Lv0) — Regel v619.
    if (engine) {
      let kannWirken = false;
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        if (engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) { kannWirken = true; break; }
      }
      if (!kannWirken) return false;
    }
    return true;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const treffer = passenderKO(gs, pi, engine);
    if (!treffer) return;
    const { owner, heroIdx, hero } = treffer;

    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });

    // 1. Wiederbelebung mit fester Obergrenze.
    const ok = await engine.actionReviveHero(owner, heroIdx, REVIVE_HP, {
      maxHpCap: REVIVE_HP,
      source: CARD_NAME,
      animationType: 'poison_splash',
    });
    if (!ok) return;
    hero.maxHp = REVIVE_HP;
    hero.hp = Math.min(hero.hp, REVIVE_HP);

    // 2. Dauerhafte Uebernahme.
    await engine.actionTakeHeroPermanently(pi, owner, heroIdx, {
      sourceName: CARD_NAME,
    });

    // 3. Die Paraseed liegt weiter in der Zone — ihr Gift kommt zurueck.
    await syncParaseedPoison(engine, owner, heroIdx);

    engine.sync();
  },
};
