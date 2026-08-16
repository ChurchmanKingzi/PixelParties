// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Hountriever"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  Up to 3 times per turn, when you summon a
//  "Loyal" Creature, except "Loyal Hountriever",
//  draw 1 card.
//
//  Per-instance counter (gemeinsamer Rundenzaehler, Schluessel
//  `hountriever`) — frisch in JEDEM Spielerzug (Als Regel 16.8.)
//  caps the trigger at 3 per turn per Hountriever
//  — so two Hountrievers in play can each draw up
//  to 3 cards per turn (six total). Counter resets
//  on the controller's turn start. Self-summons
//  and Hountriever copies are excluded by the card
//  text.
// ═══════════════════════════════════════════

const { isLoyalCreature } = require('./_loyal-shared');

const CARD_NAME    = 'Loyal Hountriever';
const MAX_PER_TURN = 3;

const { usesLeft, spendUse } = require('./_charges');
const USE_KEY = 'hountriever';
module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): nur LESEN,
  // niemals den Zaehler anfassen — laeuft bei jedem Zustandsversand.
  chargesPerTurn: 3,
  chargeKey: USE_KEY,
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      // Only react when a Creature lands in a Support zone — abilities
      // / equipment moving don't count.
      if (entering.zone !== 'support') return;
      // Card text triggers off summons; moves (Slippery Skates,
      // Dark Gear, Diplomacy) shuffle existing creatures around and
      // do not count as a fresh summon.
      if (ctx._isMove) return;
      // Same-side trigger — Hountriever fires off OUR summons only.
      if ((entering.owner ?? entering.controller) !== ctx.cardOriginalOwner) return;
      // Self-exclusion: the dying-into-life Hountriever doesn't trigger
      // its own draw, and other Hountrievers don't trigger each other
      // (per card text "except Loyal Hountriever").
      if (entering.name === CARD_NAME) return;
      // Loyal-only.
      if (!isLoyalCreature(entering.name, ctx._engine)) return;

      // Dreifach-HOPT je Instanz ueber den gemeinsamen Rundenzaehler
      // (v417). `spendUse` prueft und verbucht in einem — faellt es
      // aus, war nichts mehr frei.
      const gsH = ctx._engine?.gs;
      const fired = MAX_PER_TURN - usesLeft(ctx.card, gsH, { key: USE_KEY, max: MAX_PER_TURN });
      if (!spendUse(ctx.card, gsH, { key: USE_KEY, max: MAX_PER_TURN })) return;

      const engine = ctx._engine;
      const ps     = engine.gs.players[ctx.cardOriginalOwner];

      // Sparkle on Hountriever's slot — same anim Friendship / similar
      // ability-driven draws use.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner: ctx.cardOriginalOwner,
        heroIdx: ctx.cardHeroIdx,
        zoneSlot: ctx.card.zoneSlot,
      });
      await engine._delay(220);

      await engine.actionDrawCards(ctx.cardOriginalOwner, 1);
      engine.log('loyal_hountriever_draw', {
        player: ps?.username, trigger: entering.name,
        firesUsed: fired + 1, max: MAX_PER_TURN,
      });
      engine.sync();
    },

    // Ruecksetzung entfaellt (v417): der gemeinsame Zaehler stempelt
    // die Runde mit und ist damit in jedem Spielerzug wieder voll.
  },
};
