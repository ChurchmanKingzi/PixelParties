// ═══════════════════════════════════════════
//  CARD EFFECT: "Forbidden Grimoire of a Forgotten Sorceress"
//  Artifact (Equipment, Cost 10) — Secret Rare
//
//  "Equip this card to a Hero you control. All Spells the equipped
//   Hero casts have their levels reduced by 2. If the equipped Hero
//   casts a Spell it could not normally use with this effect, send
//   this equipped card to the discard pile. A Hero can only be
//   equipped with 1 'Forbidden Grimoire of a Forgotten Sorceress'."
//
//  (Bis v654 hiess die Karte „… of a Forgotten Sorcerer"; Al hat sie
//  am 30.8. ueberall umbenannt.)
//
//  ── −2 AUF SPELLS DES TRAEGERS ────────────────────────────────────
//  `reduceCardLevel` nach dem Taio-Muster: nur Spells, nur wenn der
//  castende Held der Traeger dieser Instanz ist (heroIdx-Gate).
//
//  ── „COULD NOT NORMALLY USE" ──────────────────────────────────────
//  Gemessen wird NICHT nach der Aufloesung — dann ist die Karte aus
//  der Hand und ihre Handindex-Rabatte (Fionas −3 auf genau diese
//  Kopie, Sparkfly Queen, Rocky Slime) sind weg. Die Engine ruft
//  deshalb `onPlayValidated` (v654) im Moment der bestandenen
//  Spielpruefung, solange die Karte noch liegt: hier wird die
//  Level-Pruefung ein zweites Mal gefahren, mit DIESER Instanz als
//  ausgeschlossener Quelle (`excludeReducerInstId`). Faellt sie dann
//  durch, war das Grimoire unentbehrlich → Merkzettel am Zaehler.
//
//  Eingeloest wird der Merkzettel in `onAnyActionResolved` (feuert
//  fuer jedes Handspiel, auch negierte — „casts" ist der Cast, nicht
//  die Aufloesung; ein ABGEBROCHENER Cast erreicht den Hook nicht, der
//  Zettel wird dann von der naechsten Pruefung ueberschrieben oder
//  am Zugbeginn geloescht). Effekt-Casts aus Deck/Ablage laufen nicht
//  ueber die Pruefung — sie zaehlen nicht („normally use" meint das
//  Handspiel gegen die Heldenstufe).
//
//  ── EINE JE HELD ──────────────────────────────────────────────────
//  `canEquipToHero` wie Wanted Poster / Vampiric Sword (zweite Kopie am
//  SELBEN Helden verboten; andere Helden duerfen eine eigene tragen).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Forbidden Grimoire of a Forgotten Sorceress';
const REDUCTION = 2;

/** Traegt der Held an `heroIdx` schon ein Grimoire (nach effektiver Identitaet)? */
function heroHasGrimoire(engine, playerIdx, heroIdx) {
  return engine.cardInstances.some(c =>
    c.owner === playerIdx && c.zone === 'support' && c.heroIdx === heroIdx
    && (c.counters?._effectOverride || c.name) === CARD_NAME);
}

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    if (engine) return !heroHasGrimoire(engine, playerIdx, heroIdx);
    for (const slot of (gs.players[playerIdx]?.supportZones?.[heroIdx] || [])) {
      if ((slot || []).includes(CARD_NAME)) return false;
    }
    return true;
  },

  reduceCardLevel(cardData, _engine, _ownerIdx, inst, heroIdx) {
    if (!cardData || !hasCardType(cardData, 'Spell')) return 0;
    if (heroIdx == null || inst?.heroIdx !== heroIdx) return 0;
    return REDUCTION;
  },

  /**
   * Merkzettel: dieser Spell dieses Helden waere OHNE das Grimoire
   * nicht spielbar gewesen. Gleicher Spieler, gleicher Held, Spell.
   */
  onPlayValidated(cardData, engine, ownerIdx, inst, heroIdx, _handIndex) {
    if (!cardData || !hasCardType(cardData, 'Spell')) return;
    if (inst.heroIdx !== heroIdx || inst.owner !== ownerIdx) return;
    const ohneGrimoire = engine.heroMeetsLevelReq(ownerIdx, heroIdx, cardData, {
      excludeReducerInstId: inst.id,
    });
    if (!inst.counters) inst.counters = {};
    if (ohneGrimoire) {
      delete inst.counters._grimoireCrutch;
    } else {
      inst.counters._grimoireCrutch = { cardName: cardData.name, turn: engine.gs.turn };
    }
  },

  hooks: {
    onTurnStart: (ctx) => {
      if (ctx.card?.counters?._grimoireCrutch) delete ctx.card.counters._grimoireCrutch;
    },

    onAnyActionResolved: async (ctx) => {
      const inst = ctx.card;
      const mark = inst?.counters?._grimoireCrutch;
      if (!mark) return;
      if (ctx.actionType !== 'spell') return;
      if (ctx.playerIdx !== inst.owner || ctx.heroIdx !== inst.heroIdx) return;
      // Nur der vermerkte Cast loest ein; alles andere verwirft den Zettel.
      const trifft = ctx.playedCardName === mark.cardName && mark.turn === ctx._engine.gs.turn;
      delete inst.counters._grimoireCrutch;
      if (!trifft) return;
      if (inst.zone !== 'support') return;

      const engine = ctx._engine;
      const ps = engine.gs.players[inst.owner];
      await engine.effectSourceGlow(inst.owner, CARD_NAME);
      engine.log('grimoire_spent', {
        player: ps?.username, card: CARD_NAME, spell: ctx.playedCardName,
        hero: ps?.heroes?.[inst.heroIdx]?.name,
      });
      await engine.actionMoveCard(inst, 'discard');
      engine.sync();
    },
  },
};
