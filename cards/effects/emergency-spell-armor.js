// ═══════════════════════════════════════════
//  CARD EFFECT: "Emergency Spell Armor"
//  Spell (Reaction, Lv1, Support Magic)
//
//  „Play this Spell immediately when a Hero you control that can use
//   it with more than 1 HP would be defeated by a Spell or Creature
//   effect. Your Hero's current and max HP drop to 1 instead and you
//   may draw 2 cards."
//
//  Bauform (Schwester von Paraseed Zombie)
//  ─────────────────────────────────────────
//  • Vor-Schadens-Fenster (`isPreDamageReaction`) mit `firesOnDefeat`:
//    „would be DEFEATED" greift auch gegen Insta-Kills (Eraser Beam,
//    Hand of Death), die das Fenster seit v718 mit synthetischem
//    Betrag oeffnet.
//  • „a Hero you control that can use it": der GETROFFENE Held castet
//    (`casterIsTarget`, v800) — das Fenster prueft Level und Wisdom
//    zentral, hier bleibt nur die Sachbedingung.
//  • „with more than 1 HP": auf 1 HP ist nichts mehr zu retten, die
//    Karte wird nicht angeboten.
//  • „by a Spell or Creature effect": Quelle ist eine Karte vom Typ
//    Spell oder Creature (Artifact Creatures und Tokens eingeschlossen,
//    `hasCardType`). Attacks, Helden-Effekte, Artefakte, Status-Ticks
//    und alles ohne Kartenquelle zaehlen NICHT — eigene wie fremde
//    Spells hingegen schon, der Text sagt nichts von „opponent's".
//  • „current and max HP drop to 1 instead": Ersetzung wie bei
//    Paraseed Zombie (`{ negated: true }` + HP setzen), zusaetzlich
//    faellt das Max-HP dauerhaft auf 1 — jede spaetere Heilung
//    deckelt dort.
//  • „you may draw 2 cards": Nachfrage, CPU sagt immer ja.
//  • Kein „Delete this card" → die Karte wandert normal in die Ablage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const deckProfile = require('./_deck-profile');

const CARD_NAME = 'Emergency Spell Armor';
const DRAW_COUNT = 2;

/** Kommt der Treffer von einem Spell oder einer Kreatur? */
function spellOrCreatureSource(engine, source) {
  const name = typeof source === 'string' ? source : source?.name;
  if (!name) return false;
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  return hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature');
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPreDamageReaction: true,
  firesOnDefeat: true,
  casterIsTarget: true,

  preDamageCondition(gs, ownerIdx, engine, target, heroIdx, source, amount /*, type */) {
    if (!(amount > 0)) return false;
    if (target?.hp == null || amount < target.hp) return false;   // nicht toedlich
    if (target.hp <= 1) return false;                              // „with more than 1 HP"
    if (engine.heroSideOf(ownerIdx, target) !== ownerIdx) return false;   // „a Hero you control"
    return spellOrCreatureSource(engine, source);
  },

  async preDamageResolve(engine, ownerIdx, target, heroIdx /*, source, amount, type */) {
    const ps = engine.gs.players[ownerIdx];
    // „Your Hero's current and max HP drop to 1 instead" — Ersetzung.
    target.hp = 1;
    target.maxHp = 1;
    engine._broadcastEvent('play_zone_animation', {
      type: 'emergency_spell_armor', owner: ownerIdx, heroIdx, zoneSlot: -1,
    });
    engine.log('emergency_spell_armor', {
      player: ps?.username, hero: target?.name || 'Hero',
    });
    engine.sync();
    await engine._delay(400);

    // „and you may draw 2 cards"
    const ok = await engine.promptGeneric(ownerIdx, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Draw ${DRAW_COUNT} cards?`,
      showCard: CARD_NAME,
      confirmLabel: '🃏 Draw!',
      cancelLabel: 'No',
      cancellable: true,
      _ownerIdx: ownerIdx,
    });
    if (ok) {
      const drawn = await engine.actionDrawCards(ownerIdx, DRAW_COUNT);
      engine.log('emergency_spell_armor_draw', {
        player: ps?.username, count: Array.isArray(drawn) ? drawn.length : DRAW_COUNT,
      });
      engine.sync();
    }
    return { negated: true };
  },

  /**
   * CPU: die Karte rettet einen Helden vor dem Tod — feuern ist die
   * Vorentscheidung (Standard des Reaktions-Kanals). Die Nachfrage
   * „Draw 2 cards?" bejaht die CPU immer.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    if ((promptData._gerryOriginalTitle || promptData.title) !== CARD_NAME) return undefined;
    if (promptData._handReactionWindow || promptData._preDamageContext) return undefined;   // OB feuern: Gehirn/Kanal
    if (/^Draw /.test(promptData.message || '')) {
      if (engine.isPuzzle) return { confirmed: true };
      // v816: Zieh-Kanal — 2 Karten nur, wenn das Deck sie hergibt.
      const pi = Number.isInteger(promptData._ownerIdx) ? promptData._ownerIdx : engine._cpuPlayerIdx;
      return deckProfile.optionalDrawChoice(engine, pi, CARD_NAME, DRAW_COUNT) ? { confirmed: true } : null;
    }
    return undefined;
  },
};
