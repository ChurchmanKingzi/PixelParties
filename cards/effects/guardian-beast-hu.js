// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Hu" (Tiger)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.   BANNED.
//
//  EFFECT (once/turn): delete exactly 5 cards
//    from the discard piles → immediately
//    perform an additional Action with any Hero
//    you control.
//
//  IMPLEMENTATION:
//
//  • Pay the 5-card deletion cost via the standard
//    Guardian Beast picker (combined-discard
//    gallery, exact-count gating).
//  • Hand off to `engine.performImmediateActionAnyHero`
//    — opens an "Action Phase-style" prompt where
//    eligible Action cards in hand light up and
//    the player either CLICKS one then picks a
//    Hero / Support Zone, or DRAGS-and-DROPS the
//    card directly onto a target Hero / zone.
//    Same UX as a normal Action Phase action.
//
//  • ★ W34a (Al, 22.10.2026): „any Hero you control" nach AKTUELLER Kontrolle:
//    ein vom Spieler kontrollierter Gegnerheld (temporaer oder dauerhaft
//    uebernommen) wird als Aktionstraeger angeboten (Hand-Karten:
//    Attack/Spell/Kreatur), ein abgegebener eigener Held nicht
//    (`engine._zusatzaktionsHelden`).
//
//  • ★ W35a (Al, 22.10.2026, Frage 3: „Ja, sollen sie!"): fuer einen UEBERNOMMENEN Helden werden
//    AUCH Abilities und Heldeneffekte mit Aktionskosten angeboten und ausgefuehrt (nicht nur
//    Hand-Karten) — `mitUebernommenenAktionen: true` an `performImmediateActionAnyHero` /
//    `canPerformImmediateActionAnyHero`, unter denselben Voraussetzungen wie beim eigenen Helden
//    (Frozen/Stunned/Webbed/Negated, Einmal-Stempel je Spieler und Zug, Kosten, Zielregeln).
//    Nur Hu setzt das Flag: Master's Plan, Lunar Eclipse, Off Duty, Dream Dust und Shamanic Curse
//    sprechen von „a different/an additional Action" ohne „with any Hero you control" und bleiben
//    bei Hand-Karten; Spider Dance, Pavi, Traveler und Third Circle sind auf Karten eingeschraenkt.
//
//  • The `Any-Hero` variant doesn't lock the
//    activation to a specific Hero — the player
//    chooses card first, hero second (or together
//    via drag/drop), like the normal Action Phase
//    flow. The card-eligibility filter respects
//    every per-card restriction: canSummon
//    (Guardian-Beast empty-discard gate), Wisdom
//    discard cost, level / spell-school
//    requirements, sacrifice / beforeSummon
//    costs (Dragon Pilot, Steam Dwarf Engineer,
//    DDG, 500 Piranhas), once-per-game flags,
//    and any custom `spellPlayCondition`.
//    Engine fixes pushed to `getHeroEligibleActionCards`
//    (canSummon filter) and the Creature play
//    branches in `performImmediateAction(AnyHero)`
//    (now route through `summonCreatureWithHooks`
//    so beforeSummon fires) make this work
//    correctly across all card types.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  ruecklegenGeloeschteAblagekarten,
} = require('./_guardian-beasts-shared');
const { ablageLoeschKostenMoeglich } = require('./_guardian-beasts-shared');   // v1398

const CARD_NAME = 'Guardian Beast Hu';
const DELETE_COST = 5;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    // v1398 (Als Ruling 25.9.): Löschkosten aus der Ablage unter Knight-[B]-Lockdown → nicht aktivierbar.
    if (!ablageLoeschKostenMoeglich(ctx)) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < DELETE_COST) return false;
    // At least one alive Hero must exist on this side — otherwise the
    // bonus action has no possible recipient.
    // ★ W34a (Al, 22.10.2026): „any Hero you control" = AKTUELLE Kontrolle — ein uebernommener Gegnerheld zaehlt, ein abgegebener eigener nicht.
    if (engine._zusatzaktionsHelden(pi).length === 0) return false;
    // ★ W7b (A07-13, Al 14.10.): Hu ist nur aktivierbar, wenn die geschenkte Aktion auch stattfinden kann (eine Handkarte
    // spielbar, eine Ability-/Helden-Aktion moeglich) - sonst waeren die 5 Karten umsonst geloescht. Die Pruefung laeuft
    // vor der Zahlung; ein Guardian Beast auf der Hand ist erst spielbar, wenn die EIGENE Ablage leer ist (`canSummon`).
    // Reichen die Loeschkosten dafuer (hoechstens 5 Karten in der eigenen Ablage), gilt die leere Ablage als erreichbar.
    const aktion = { title: CARD_NAME, mitUebernommenenAktionen: true };   // W35a
    if (engine.canPerformImmediateActionAnyHero(pi, aktion)) return true;
    const eigene = ps.discardPile || [];
    if (eigene.length > 0 && eigene.length <= DELETE_COST) {
      ps.discardPile = [];
      try { return engine.canPerformImmediateActionAnyHero(pi, aktion); }
      finally { ps.discardPile = eigene; }
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Pay the deletion cost first. If the player cancels mid-pick, no
    // commitment is made and the bonus action doesn't fire.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: [DELETE_COST],
      title: CARD_NAME,
      description: `Pick exactly ${DELETE_COST} cards from the discard piles to delete and gain an additional Action with any Hero.`,
      sourceName: CARD_NAME,
      cancellable: true,
      // ★ W66b (Al, 23.10.2026): „Abbruch: nichts gelöscht, Einmal-Sperre nicht verbraucht, der Gegner sieht nichts." Die 5 Karten müssen schon vor der Aktionswahl aus der Ablage sein
      // (sonst wäre ein Guardian Beast gar nicht spielbar) — das geschieht im Kosten-Vorlauf der Engine: der Gegner sieht erst etwas, wenn die Aktion committed ist; ein Abbruch legt
      // sie unsichtbar und exakt zurück.
      vorlauf: true,
    });
    if (!deleted || deleted.length < DELETE_COST) return false;

    // Run the action prompt. `performImmediateActionAnyHero`:
    //   • Lights up eligible Action cards in hand (filtered to
    //     "at least one Hero could legally play this").
    //   • Player clicks a card then picks a Hero / Support Zone, OR
    //     drags the card directly onto a target. Standard Action
    //     Phase UX.
    //   • Routes the play through normal hand-play paths so all
    //     restrictions land (canSummon, beforeSummon, level/school,
    //     Wisdom, once-per-game, spellPlayCondition).
    //   • Auto-skips silently if no Hero can play anything in hand.
    const result = await engine.performImmediateActionAnyHero(pi, {
      title: CARD_NAME,
      description: 'Use an additional Action with any of your Heroes!',
      mitUebernommenenAktionen: true,   // W35a (Al, Frage 3): auch Abilities/Heldeneffekte uebernommener Helden
      cancellable: true,
    });
    // ★ W7b (A07-13, Al 14.10.): findet die Aktion nicht statt (Aktionswahl abgebrochen oder nichts spielbar), gehen die
    // 5 Karten in ihre Ablagen zurueck und der Effekt gilt als nicht benutzt (`false` gibt die Einmal-Sperre frei).
    if (!result?.played) {
      ruecklegenGeloeschteAblagekarten(engine, deleted);
      engine.log('guardian_beast_hu_refund', { player: ps.username });
      engine.sync();
      return false;
    }

    engine.log('guardian_beast_hu_grant_action', {
      player: ps.username,
      played: !!result?.played,
      cardName: result?.cardName,
      cardType: result?.cardType,
    });
    engine.sync();
    return true;
  },
};
