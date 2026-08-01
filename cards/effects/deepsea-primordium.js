// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Primordium"
//  Creature (Summoning Magic Lv0) — 1 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): grant an additional
//  action this turn for summoning a Deepsea
//  Creature from hand. 1 per turn.
//
//  The additional-action type is player-shared
//  (any Primordium grants into the same pool)
//  and is consumed when the controller plays
//  any Deepsea Creature. Expires at turn end
//  via the engine's `expiresAtTurnEnd` grant
//  contract (turn-rollover wipe in switchTurn).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  tryBouncePlace,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
  isDeepseaCreature,
  promptOptionalOnSummon,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Primordium';
const ADDITIONAL_TYPE = 'summon_deepsea_primordium';

module.exports = {

  // Als Ruling: Barkers Spielstart-Pick soll für dieses Deck HART auf
  // Primordium stehen — der beste Opener der Linie (Lv0-Body, der per
  // On-Summon eine weitere Deepsea aus der Hand als Zusatzaktion
  // erlaubt und ab Zug 2 Bounce-Ziel für alles ist). Das gelernte
  // Ranking bevorzugte Sandy Blob, weil Einzelspiel-Korrelationen den
  // Motor-Wert des Openers nicht abbilden.
  gameStartPickPriority: 100,
  // ── DESIGNER-VORGABEN (31.7., Als Ruling) ──────────────────────────
  // Al: "Primordium und DDG SIND die beiden wichtigsten Karten."
  // Die Regression kann Primordiums Beitrag strukturell nicht sehen —
  // er wird über die Karten realisiert, die sein Grant bezahlt, und
  // landete deshalb auf dem Wert-Boden 8 (von 100), während der von ihm
  // finanzierte Werewolf auf 95.5 stand.
  // `cardValueFloor` wirkt nur nach oben: erweist sich die Karte als
  // besser, behält sie ihren gelernten Wert.
  // `playOrderPriority` ist die eigentlich entscheidende Vorgabe — der
  // Grant nützt nur, wenn Primordium VOR den finanzierten Karten
  // gespielt wird. Beide Zahlen sind bewusst hier und nicht im Kern,
  // damit Al sie ohne Engine-Änderung justieren kann.
  cpuMeta: { cardValueFloor: 70, playOrderPriority: 100 },
  inherentAction: inherentActionIfBounceable,
  canBypassLevelReq: canBypassLevelReqIfBounceable,
  canBypassFreeZoneRequirement: canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlot: canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargets: getBouncePlacementTargetsList,
  beforeSummon: tryBouncePlace,
  canSummon: (ctx) => canSummonPerTurnLimit(ctx, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      markSummonedPerTurnLimit(ctx, CARD_NAME);

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Gain an additional action for summoning a Deepsea Creature from hand this turn?'
      ))) return;

      const engine = ctx._engine;
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        // Als Bugreport: der Bonus-Summon überlebte Zug-übergreifend —
        // es gab keinerlei Turn-Rollover für Grants. Der generische
        // `expiresAtTurnEnd`-Vertrag lässt die Engine unverbrauchte
        // Grants dieses Typs in `switchTurn` wipen (nach ON_TURN_END,
        // vor dem Spielerwechsel) — auch wenn das Primordium am
        // Zugende gestunnt/gefroren ist (Karten-Hooks wären dann
        // stumm, der Engine-Pass nicht).
        expiresAtTurnEnd: true,
        filter: (cardData) => {
          if (!cardData || !hasCardType(cardData, 'Creature')) return false;
          // Read archetype via the shared helper so Deepsea Spores (all
          // creatures treated as Deepsea) works.
          return isDeepseaCreature(cardData.name, engine);
        },
      });
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
      engine.log('deepsea_primordium_extra', {
        player: engine.gs.players[ctx.cardOwner]?.username,
      });
      engine.sync();
    },
  },
};
