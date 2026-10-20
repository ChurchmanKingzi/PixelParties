// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Rain"
//  Spell (Magic Arts Lv2, Post-Target Reaction)
//
//  Once per game (shared "Divine Gift" key).
//  Fires when 1+ targets the player controls
//  would be affected by an opponent's card or
//  effect. Negate any effects that card or effect
//  would have on targets YOU control.
//
//  W18a (R01-05, Al 19.10.2026: „Nur eigene Ziele
//  werden beschützt!"): Rain wirkt NUR auf die Ziele
//  des Reagierenden.
//    • Sind ALLE Ziele des Fensters eigene (einseitige
//      Ziel-/Flächenzauber), bleibt es bei der
//      Negierung der ganzen Karte (`effectNegated`,
//      unverändert) — die Wirkung der Karte besteht
//      dann ohnehin nur aus Wirkung auf eigene Ziele.
//    • Trifft die Karte AUCH fremde Ziele (Armageddon,
//      Cataclysm, Snowstorm Mischief … treffen beide
//      Seiten), wird sie NICHT negiert: jedes eigene Ziel
//      (Held, Kreatur) bekommt Effekt-Immunität gegen
//      diese Auflösung (`grantEffectImmunity` /
//      `grantCreatureEffectImmunity`: Schaden, Status,
//      Zerstörung …), die fremden Ziele werden weiter
//      getroffen.
//
//  Uses isPostTargetReaction so it fires AFTER
//  targets are known (single-target, AoE heroes,
//  AoE creatures) — not speculatively in the
//  chain window.
//
//  Triggers a full-screen rain animation
//  that persists for the rest of the turn.
// ═══════════════════════════════════════════

module.exports = {
  isPostTargetReaction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  /**
   * Condition: the source card is owned by the opponent,
   * and at least one targeted entity belongs to this player.
   */
  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard) {
    if (!targetedHeroes || targetedHeroes.length === 0) return false;

    // Source must be an opponent's card/effect
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner === pi) return false;

    // At least one target must belong to this player
    // W20c (Al 20.10.): „targets you control“ = Kontrolle (ein uebernommener Held der Gegenspalte zaehlt, ein abgegebener eigener nicht).
    const hasOwnTarget = targetedHeroes.some(t => engine.zielSeite(t) === pi);
    if (!hasOwnTarget) return false;

    return true;
  },

  /**
   * Resolve: negate the effect, play rain animation, mark Divine Gift as used.
   */
  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Mark Divine Gift as used for the game
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add('divineGift');

    // Rain animation (persists for rest of turn). Als Bugreport: der
    // Regen endete NIE (Overlay hängt am document.body, kein Stop-
    // Event existierte — er überlebte sogar bis ins Menü). Der Stop
    // läuft über den generischen queueTurnEndBroadcast-Vertrag: die
    // Engine flusht ihn in switchTurn am Ende DIESES Zugs, egal wo
    // diese Karte dann liegt.
    engine._broadcastEvent('divine_rain_start', { turn: gs.turn });
    engine.queueTurnEndBroadcast('divine_rain_stop');
    await engine._delay(600);

    engine.log('divine_gift_of_rain', {
      player: ps?.username,
      negated: sourceCard?.name || 'an effect',
    });

    engine.sync();

    // W18a: nur die Wirkung auf die EIGENEN Ziele negieren.
    const eigene = (targetedHeroes || []).filter(t => engine.zielSeite(t) === pi);   // W20c: nach Kontrolle, Adresse bleibt physisch
    const fremde = (targetedHeroes || []).filter(t => engine.zielSeite(t) !== pi);
    if (fremde.length === 0) {
      // Einseitig (nur eigene Ziele): die ganze Karte negieren wie bisher.
      return { effectNegated: true };
    }
    const quelle = (sourceCard && typeof sourceCard === 'object') ? sourceCard : { name: 'effect' };
    for (const t of eigene) {
      if (t.type === 'hero') {
        engine.grantEffectImmunity(t.owner, t.heroIdx, quelle);
      } else {
        const inst = t.cardInstance || (engine.cardInstances || []).find(c =>
          c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
          && engine.physicalSide(c) === t.owner && !c.faceDown)
          || null;
        if (inst) engine.grantCreatureEffectImmunity(inst, quelle);
      }
    }
    return {};
  },
};
