// ═══════════════════════════════════════════
//  CARD EFFECT: "Dragolfin"
//  Creature (Summoning Magic Lv3, Normal) —
//  180 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "You may once per turn choose a target and
//    deal damage equal to 10 times half the number
//    of cards in your deck (rounded up) to it."
//
//  ── Rechenweg ──
//  Das "(rounded up)" hängt am HALBIEREN, nicht am
//  Endergebnis: erst die Hälfte der Deckkarten
//  aufrunden, dann mit 10 malnehmen.
//      10 × ceil(Deckkarten / 2)
//  Bei 15 Karten also 10 × 8 = 80 (nicht 75).
//
//  Die Animation ist eine Wasserwelle (`water_wave`) — Dragolfin
//  ist ein Drachen-Delfin, kein Feuerspeier.
//
//  "Cards in your deck" ist das HAUPTDECK, das man
//  zieht — dieselbe Lesart wie bei Broghan, dem
//  einzigen anderen Kartentext mit dieser Formel
//  (`ps.mainDeck.length`). Trankdeck und Sidedeck
//  zählen nicht mit.
//
//  Der Wert sinkt also im Lauf der Partie: früh ein
//  Brecher, spät eine Restglut. Deshalb steht die
//  aktuelle Zahl auch in der Zielabfrage.
//
//  ── Rahmen ──
//  Freier Aktiv-Effekt in der Main Phase, einmal je
//  Zug — das ist alles Standardverhalten von
//  `creatureEffect` (HOPT `creature-effect:<instId>`,
//  Beschwörungs-Sperre im ersten Zug). Ein Abbruch
//  in der Zielwahl gibt die Sperre über `return
//  false` wieder frei.
// ═══════════════════════════════════════════

const CARD_NAME = 'Dragolfin';

/** 10 × aufgerundete Hälfte der verbleibenden Deckkarten. */
function computeDamage(deckSize) {
  return 10 * Math.ceil(Math.max(0, deckSize || 0) / 2);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const deckSize = gs.players[pi]?.mainDeck?.length || 0;
    const damage = computeDamage(deckSize);

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage — 10 × half of the ${deckSize} card${deckSize !== 1 ? 's' : ''} left in your deck, rounded up.`,
      confirmLabel: `🐉 Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Abbruch: `false` lässt die Einmal-pro-Zug-Sperre ungestempelt.
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'water_wave',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('dragolfin_strike', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage, deckSize,
    });
    engine.sync();
    return true;
  },
};
