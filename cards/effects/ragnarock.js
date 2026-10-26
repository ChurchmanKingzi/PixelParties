// ═══════════════════════════════════════════
//  SPELL (Reaction): "Ragnarock"
//  Play immediately when your opponent activates
//  the effect of an Ability by deleting the top
//  card of your Coolness Stack. Negate that
//  Ability's activation and discard the top copy
//  of that Ability from the Hero that activated
//  it.
//
//  Als Ruling (Al 26.10.): „Negate that Ability until the
//  end of the turn" gilt fuer die Ability AUF DEM AKTIVIEREN-
//  DEN HELDEN: bis zum Ende des Zuges keine erneute Aktivierung
//  (auch nicht, wenn die Kopien abgelegt wurden und eine neue
//  angelegt wird); dieselbe Ability auf ANDEREN Helden bleibt
//  nutzbar. Die oberste Kopie wird wie bisher abgelegt. Die
//  Sperre liegt als `gs.players[pi]._abilityHeroLocks` (Held +
//  Basisname -> Zug) und wird vom einen Praedikat
//  `engine._abilityNegatedOnHero` aller Aktivierungswege
//  gelesen. Annahme: negiert sind die AKTIVEN Effekte (wie bei
//  Uncool Malfunction/Charme-Negation); passive Wirkungen der
//  Ability laufen weiter.
// ═══════════════════════════════════════════

const { SPEED, baseCardName } = require('./_hooks');

const CARD_NAME = 'Ragnarock';

module.exports = {
  isReaction: true,
  speed: SPEED.COUNTER,

  /**
   * Engine signature is `(gs, pi, engine, chainCtx)`. `chainCtx.chain[0]`
   * is the initial card being reacted to. We trigger when:
   *   • the card is an Ability (chain links from Ability code paths
   *     all use `cardType: 'Ability'`),
   *   • the link was an ACTIVATION rather than an attach. Both paths
   *     share the cardType, but activation paths set `fromBoard: true`
   *     (`doActivateAbility` and `doActivateFreeAbility`). Without
   *     this gate, Ragnarock would also fire on opponent's hand-attach
   *     plays — and `doPlayAbility`'s `chainResult.negated` branch
   *     splices+discards the just-attached copy itself, so combined
   *     with our resolve that would discard the ability twice.
   *   • the activator is the opponent,
   *   • we have a Coolness Stack to pay the cost from.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    const initial = chainCtx?.chain?.[0];
    if (!initial || !initial.isInitialCard) return false;
    if (initial.cardType !== 'Ability') return false;
    if (initial.fromBoard !== true) return false;
    if (initial.owner === pi) return false;
    // Als Ruling (Al 26.10.): `hasCoolnessStack` ist bei liegender Wowhalla auch fuer einen LEEREN Stack wahr — die Kosten (oberste Karte loeschen) brauchen eine Karte.
    return engine.getCoolnessStackSize(pi) > 0;
  },

  // Reaction-only — never proactively activatable.
  canActivate: () => false,

  /**
   * Resolve runs LIFO from `_resolveReactionChain`. Negating the
   * initial link here means the engine's own resolve loop sees
   * `link.negated === true` when it reaches index 0 and skips the
   * Ability's effect entirely.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    const initialLink = chain?.[0];
    if (!initialLink) return;

    // ── Cost: delete the top of own Coolness Stack ──
    const ps = engine.gs.players[pi];
    if (ps?.coolnessStack?.length) {
      await engine.actionPopCoolnessStackTo(pi, 'delete', { source: CARD_NAME });
    }

    // ── Effect 1: negate the activated Ability ──
    engine.negateChainLink(chain, 0);

    // ── Effect 1b: „until the end of the turn" ──
    // Als Ruling (Al 26.10.): die Ability ist auf dem aktivierenden Helden bis zum Ende dieses Zuges negiert — keine erneute Aktivierung im
    // selben Zug (auch nicht nach Kopien-Verlust: die Sperre haengt an Held + Namen, nicht an der abgelegten Kopie). Dieselbe Ability auf
    // ANDEREN Helden bleibt nutzbar. Gelesen von `engine._abilityNegatedOnHero` (Listen, CPU, Server-Tore).
    if (initialLink.owner != null && initialLink.owner >= 0 && initialLink.heroIdx != null && initialLink.heroIdx >= 0 && initialLink.cardName) {
      const lockPs = engine.gs.players[initialLink.owner];
      if (lockPs) {
        if (!lockPs._abilityHeroLocks) lockPs._abilityHeroLocks = {};
        lockPs._abilityHeroLocks[`${initialLink.heroIdx}:${baseCardName(initialLink.cardName)}`] = engine.gs.turn;
      }
    }

    // ── Effect 2: discard the top copy of that Ability from the
    // Hero that activated it. Abilities stack as repeats of the same
    // name within a slot, so the "top copy" is the last entry.
    const oppPi = initialLink.owner;
    const heroIdx = initialLink.heroIdx;
    const abilityName = initialLink.cardName;
    if (oppPi != null && oppPi >= 0 && heroIdx != null && heroIdx >= 0 && abilityName) {
      const oppPs = engine.gs.players[oppPi];
      // v800: ueber die Engine-Primitive (Instanz wandert mit, Fighting
      // nimmt seinen ATK-Bonus zurueck) statt der alten Namens-Schleife.
      const eintrag = engine.getAbilityTargets(oppPi, { heroIdx, cardName: abilityName })
        .find(z => z.zoneKind === 'ability');
      if (eintrag && await engine.discardAbilityTopCopy(eintrag, { source: 'Ragnarock', sourceOwner: pi })) {
        engine.log('ragnarock_discard_ability', {
          player: oppPs.username, ability: abilityName,
        });
      }
    }
    engine.sync();
  },
};
