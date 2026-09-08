// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Relic Hammer"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Earth-Shattering Hammer, Relic of Deri\". The first Creature each
//   player summons during each of their turns may use its active
//   effects the turn it is summoned. If the user has Summoning Magic 3,
//   summoning this counts as an additional Action.\"  (Fassung Al 5.9.)
//
//  Drei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE ueber `canPlayWithHero` — wie bei den anderen
//    Spirits, hier mit dem Hammer.
//  ② AURA: „the FIRST Creature EACH PLAYER summons during EACH OF THEIR
//    turns\" — je Spieler und je Zug genau eine. Gezaehlt wird der Zug
//    der Beschwoerung, nicht der eigene: beschwoert der Gegner in
//    seinem Zug, greift es bei ihm. Die Marke ist `counters._hasHaste`,
//    dieselbe, die Server und Client fuer die Beschwoerungsstarre
//    lesen.
//    Der Stempel `ps._relicHammerTurn` haelt fest, dass die Freikarte
//    dieses Zuges vergeben ist; er liegt auf dem SPIELERZUSTAND und
//    nicht auf dieser Instanz, damit zwei Hammer-Spirits die Zahl nicht
//    verdoppeln.
//  ③ „If the user has Summoning Magic 3\" — `inherentAction` als
//    Funktion, geprueft am beschwoerenden Helden ueber
//    `countAbilitiesForSchool`.
//
//  Die Aura wirkt, solange dieser Spirit steht. Faellt er, behaelt eine
//  bereits beschworene Kreatur ihre Haste — sie ist dann schon „nicht
//  mehr starr\", das laesst sich nicht rueckwirkend einsammeln.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Spirit of the Relic Hammer';
const HAMMER = 'Earth-Shattering Hammer, Relic of Deri';
const SM_SCHWELLE = 3;

/** Traegt dieser Held den Hammer? (Nach EFFEKTIVER Identitaet.) */
function hatHammer(engine, pi, heroIdx) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && c.owner === pi && c.heroIdx === heroIdx
    && !c.faceDown && (c.counters?._effectOverride || c.name) === HAMMER);
}

/** Steht irgendwo ein wirksamer Hammer-Spirit dieses Spielers? */
function spiritSteht(engine, pi) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && !c.faceDown && c.name === CARD_NAME
    && (c.controller ?? c.owner) === pi
    && !c.counters?.negated && !c.counters?.nulled);
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // Verschafft anderen Kreaturen Tempo, macht selbst nichts.
    dealsDamage: false,
  },

  /** ① „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hatHammer(engine, pi, heroIdx);
  },

  /** ③ „If the user has Summoning Magic 3, … additional Action.\" */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    const abZones = gs.players[pi]?.abilityZones?.[heroIdx] || [];
    return engine.countAbilitiesForSchool('Summoning Magic', abZones) >= SM_SCHWELLE;
  },

  hooks: {
    /** ② Die Freikarte je Spieler und Zug. */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const rein = ctx.enteringCard;
      if (!rein || ctx.toZone !== 'support') return;
      if (rein.faceDown) return;

      // Nur echte Kreaturen — Equipment und Attachments zaehlen nicht.
      const cd = engine.getEffectiveCardData(rein) || engine._getCardDB()[rein.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // ── Der Spirit selbst zaehlt NICHT mit (Als Ruling 5.9.) ───────
      // „In der Runde, in der er ins Spiel kommt, soll er bereits die
      // NAECHSTE eigene Creature betreffen." Er nimmt die Freikarte
      // also weder fuer sich noch verbraucht er sie — sonst waere die
      // Karte in ihrem eigenen Zug wirkungslos. Gilt fuer jede Kopie,
      // egal an welcher Stelle der Beschwoerungsreihe sie kommt.
      if (rein.name === CARD_NAME) return;

      // Nur eine BESCHWOERUNG in diesem Zug, kein Umzug einer laengst
      // stehenden Kreatur (die traegt ihr altes `turnPlayed`).
      if (rein.turnPlayed !== gs.turn) return;

      // Wer hat beschworen, und ist es SEIN Zug?
      const besitzer = rein.controller ?? rein.owner;
      if (besitzer !== gs.activePlayer) return;

      // Die Aura muss aus Sicht dieses Spielers wirken: sie kommt von
      // MEINEM Spirit. Steht bei ihm keiner, hilft ihm auch keiner.
      if (!spiritSteht(engine, besitzer)) return;

      const ps = gs.players[besitzer];
      if (!ps) return;
      if (ps._relicHammerTurn === gs.turn) return;      // Freikarte vergeben
      ps._relicHammerTurn = gs.turn;

      if (!rein.counters) rein.counters = {};
      rein.counters._hasHaste = 1;
      engine.log('relic_hammer_haste', {
        player: ps.username, creature: rein.name,
      });
      engine.sync();
    },
  },
};
