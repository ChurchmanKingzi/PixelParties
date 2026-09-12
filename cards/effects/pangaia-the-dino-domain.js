// ═══════════════════════════════════════════
//  CARD EFFECT: "Pangaia, the Dino Domain"
//  Spell (Area, Lv2 Support Magic) — Gigantisaurs
//
//  While in play, every Lv3+ Creature SUMMONED
//  by either player has its current and max HP
//  increased by 200 on entry. Move/return events
//  (Slippery Skates, Dark Gear, Diplomacy) are
//  ignored — only fresh summons / placements
//  qualify, mirroring Blood Moon's `_isMove`
//  carve-out.
//
//  The buff is permanent on the affected Creature
//  even after Pangaia leaves play (it's a one-shot
//  +200 baked into `counters.{maxHp,currentHp}`).
//
//  v902: Die Karte legt sich jetzt selbst in die Area
//  Zone (onPlay -> placeArea). Vorher fehlte das —
//  sie wanderte beim Spielen direkt in die Ablage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isAreaImmuneInst } = require('./_diver-helmet-shared');

const CARD_NAME = 'Pangaia, the Dino Domain';
const LV_THRESHOLD = 3;
const HP_BONUS = 200;

module.exports = {
  // 'hand' fuer das Selbstlegen in die Area Zone, 'area' fuer den
  // passiven Buff-Hook. Bis v902 stand hier NUR 'area' — damit feuerte
  // aus der Hand gar kein Hook, die Karte legte sich nie selbst und
  // landete in JEDEM Spielpfad in der Ablage (Standard-Entsorgung).
  activeIn: ['hand', 'area'],

  hooks: {
    /**
     * Areas landen nicht von selbst im Slot — die Karte muss sich
     * selbst dorthin bringen und damit `gs._spellPlacedOnBoard`
     * stempeln. Ohne das greift die Standard-Entsorgung Hand -> Ablage
     * (Lehre aus dem Cottage-Fall, v186; identisches Muster in Dark
     * Ocean, Spider Hive, Graveyard of Limited Power).
     *
     * Beide Wachen sind noetig: sonst platziert sich die Karte erneut,
     * wenn eine FREMDE Karte gespielt wird, waehrend sie schon liegt.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('pangaia_placed', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
      });
      ctx._engine.sync();
    },

    onCardEnterZone: async (ctx) => {
      // Der Buff gilt nur, solange die Karte in der Area Zone LIEGT.
      // Ohne diese Wache wuerde er seit dem 'hand'-Eintrag oben auch
      // aus der Hand heraus feuern — jede Lv3+-Beschwoerung haette
      // ihre +200 doppelt bekommen.
      if (ctx.cardZone !== 'area') return;
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return; // skip movements (not fresh summons)

      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const cd = entering.counters?._cardDataOverride || cardDB[entering.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd) return;
      if (!hasCardType(cd, 'Creature')) return;
      if (cd.cardType === 'Token') return;
      const level = cd.level || 0;
      if (level < LV_THRESHOLD) return;
      // Diver Helmet: a Creature in the equipped Hero's Support Zones
      // is unaffected by Areas — no +200 HP buff.
      if (isAreaImmuneInst(engine, entering)) return;

      // The buff lands on the freshly-placed instance. `increaseMaxHp`
      // handles the creature path: bumps counters.maxHp and counters.currentHp
      // by the same amount, including overheal semantics (Nao-style)
      // if currentHp was already above maxHp.
      engine.increaseMaxHp(entering, HP_BONUS);

      // Faint earthen-rumble pulse on the buffed slot.
      engine._broadcastEvent('play_zone_animation', {
        type: 'green_pulse', owner: entering.owner,
        heroIdx: entering.heroIdx, zoneSlot: entering.zoneSlot,
      });

      engine.log('pangaia_buff', {
        creature: entering.name,
        owner: engine.gs.players[entering.owner]?.username,
        amount: HP_BONUS,
      });
      engine.sync();
    },
  },
};
