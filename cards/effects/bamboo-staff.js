// ═══════════════════════════════════════════
//  CARD EFFECT: "Bamboo Staff"
//  Artifact (Equipment, Cost 10)
//
//  Once per turn, when a card is added from your
//  discard pile to your hand, you may choose a
//  target and deal damage equal to the equipped
//  Hero's Base Attack stat to it. That is treated
//  as that Hero hitting the target with an Attack.
//
//  Wiring:
//    • Listens to the engine's
//      `onCardAddedFromDiscardToHand` hook —
//      universal "card recovered from graveyard"
//      signal fired by `engine.addCardFromDiscardToHand`.
//      Xiong's tutor, future graveyard-recovery
//      cards, and the Bamboo Staff itself all
//      share that single fire-point.
//    • SOFT once-per-turn: per-instance, not
//      per-player. Two equipped Staves on the
//      same Hero each fire independently, and a
//      Staff that bounces to hand and gets re-
//      equipped this turn fires again. The
//      `_bambooFiredOnTurn` counter lives on the
//      instance and is cleared every time the
//      Staff (re-)enters a Support Zone via
//      `onCardEnterZone`, which guarantees the
//      "re-equip resets" behaviour regardless of
//      whether the bounce path reuses or replaces
//      the CardInstance.
//    • Damage routing: actionDealDamage / Action-
//      DealCreatureDamage with `type: 'attack'`
//      and source `{ name: hero.name, owner, heroIdx }`
//      so Vampiric Sword heals, armed-arrow riders,
//      and Reiza-style on-hit status application
//      all chain naturally.
//    • "Treated as that Hero hitting with an
//      Attack" rules text — fire `afterSpellResolved`
//      with a fake Attack `spellCardData` after the
//      damage call so equipment / hero hooks that
//      key off "this Hero just attacked" (Reiza,
//      Legendary Sword, etc.) trigger.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bamboo Staff';

const FAKE_ATTACK_DATA = {
  name: CARD_NAME,
  cardType: 'Attack',
  subtype: 'Normal',
  level: 0,
};

/** Any valid target on the board for the Staff's strike? */
function anyValidTarget(gs) {
  for (const ps of gs.players) {
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp > 0) return true;
      const sz = ps.supportZones?.[hi] || [];
      for (const slot of sz) if ((slot || []).length > 0) return true;
    }
  }
  return false;
}


/**
 * Auftritt links am Feld beim AUSLOESEN (Als Regel 21.8.).
 * Siehe CARD_API.md, Abschnitt „Auftritt bei passiven Effekten".
 */
async function zeigeAuftritt(engine, ownerIdx) {
  engine._broadcastEvent('card_reveal', {
    cardName: CARD_NAME, playerIdx: ownerIdx, sfx: 'ability_activate',
  });
  await engine._delay(420);
}

module.exports = {
  // W27a (Al, 21.10.2026): „treated as an Attack" zählt als LEVEL 0 überall, wo eine Karte die Stufe der Quelle liest (Glass Wall, Test Flight, Escape Device, Stealth, Jetpack) — Engine: `_heldenEffektStufe`.
  // W30a (Al, 21.10.2026): Bamboo Staff nennt den Helden als Angreifer (treated as that Hero hitting the target with an Attack) → die Stufe ist das FIGHTING-LEVEL
  // des ausgerüsteten Helden (`fightingOfHost`: Quelle = Karteninstanz in den Zielwahl-/Reaktionsfenstern; im Treffer trägt das Quellobjekt den dynamischen Stempel). Ohne Instanz: 0.
  // W32a (Al, 22.10.2026): allgemeine Regel „Zählt als Attack eines Helden = Ability-Level dieses Helden" (hier Fighting-Level des Trägers); die Deklaration trägt keine Sonderstufe mehr.
  treatedAsAttack: { ability: 'Fighting' },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  hooks: {
    /**
     * Reset the per-instance "fired this turn" stamp every time the
     * Staff (re-)enters a Support Zone. This is what makes the
     * SOFT-once-per-turn behaviour work even if the engine reuses
     * the same CardInstance across a bounce/re-equip cycle: the
     * stamp can never carry into a fresh equip.
     */
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.enteringCard?.id !== ctx.card.id) return;
      delete ctx.card.counters._bambooFiredOnTurn;
    },

    // W40a (Al, 22.10.2026, Punkt 3): `wdh` = Wiederholung durch Idej Sword - Kunagi („perform that Attack again"): derselbe Schlag, neues Ziel; das Weich-Einmal-pro-Zug (`_bambooFiredOnTurn`)
    // wird weder geprüft noch neu gesetzt (der Auslöser — eine Karte aus der Ablage auf die Hand — ist keine Kosten des Schlags).
    // ★ W42a (Al, 22.10.2026, Punkt 3): „when a card is added from your discard pile to your hand" ist die AKTIVIERUNGSBEDINGUNG, kein Preis — die Kunagi-Wiederholung verlangt KEINE weitere Ablagekarte (W41a zurückgenommen).
    onCardAddedFromDiscardToHand: async (ctx, wdh) => {
      // Only react when the recovered card landed in OUR controller's
      // hand — opponents recovering their own cards must not fire our
      // Staff. (`cardOwner` already accounts for charm/steal.)
      if (ctx.playerIdx !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Equipped Hero must be alive (no body to swing the Staff).
      const heroIdx = ctx.card.heroIdx;
      const feld    = ctx.cardHeroOwner ?? pi;   // Styx 28.9.: Brettseite des Helden
      const hero    = gs.players[feld]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      // W32a (Al, 22.10.2026): der Schlag ist ein Attack DES TRÄGERS — kann er nicht angreifen (Frozen, Stunned, Webbed, Negated, Attack-Sperren), löst der Stab nicht aus.
      if (!engine.heroKannAngreifen(feld, heroIdx, pi)) return;

      // Per-instance soft-HOPT.
      if (!wdh && ctx.card.counters._bambooFiredOnTurn === gs.turn) return;

      // Damage scales off the Hero's BASE Attack — printed-stat value,
      // unaffected by Vampiric Sword / Fighting / any buff or debuff.
      // Card text: "damage equal to the equipped Hero's Base Attack
      // stat". The same convention Blow of the Venom Snake / Ferocious
      // Tiger Kick use.
      const atk = hero.baseAtk || 0;
      if (atk <= 0) return;

      // No targets on the board — silently skip the prompt (matches
      // the UX from Terrier's chain: don't pop a dialog you can't
      // fulfill).
      if (!anyValidTarget(gs)) return;

      // Stamp BEFORE awaiting any prompt so a long-running player
      // pick can't get re-entered by a sibling
      // onCardAddedFromDiscardToHand fire (Xiong tutoring multiple
      // cards in a single AoE wipe, for instance).
      if (!wdh) ctx.card.counters._bambooFiredOnTurn = gs.turn;

      // Track damage targets via the spell-damage log so the fake
      // afterSpellResolved fire has accurate `damageTargets`.
      gs._spellDamageLog = gs._spellDamageLog || [];

      // No "Activate?" confirmation step — the target picker IS the
      // opt-in path. Cancelling it is how the player declines, same
      // pattern Loyal Terrier's follow-up uses.
      // ★ W39a: die Quelle des Schlags ist der Held (nicht die Bamboo-Staff-Instanz in der Support Zone, die Leser für eine Kreatur-Quelle halten: Firewall/Toxic Trap/Mountain Tear River).
      const dmgSource = { name: hero.name, owner: pi, heroOwner: feld, heroIdx, treatedAsAttack: engine.heldenAngriffStempel(feld, heroIdx) };   // W30a: Stufe = Fighting-Level des Helden (war W27a: 0)
      // ★ R-12 (Al 26.10.): `heldenEffektZielwahl` trennt Negierung im Zielfenster (Surprise, Hand-Reaktion, Schutz-/Redirect-Fenster) vom Abbruch des Spielers (W36a, wie Broghan & Co.).
      const { target, negiert } = await engine.heldenEffektZielwahl(ctx, {
        attackerSourceOverride: dmgSource,
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        description: `${ctx.addedCardName || 'A card'} returned to your hand! Choose a target for ${hero.name}'s ${atk}-damage Attack.`,
        confirmLabel: `⚔️ ${atk} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (negiert) {
        // R-12: negierter Schlag = verbraucht (Weich-Einmal-pro-Zug bleibt gestempelt) und zählt als gespielte Attack des Trägers.
        delete gs._spellDamageLog;
        await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: feld, name: CARD_NAME });
        engine.sync();
        return;
      }
      if (!target) {
        if (!wdh) delete ctx.card.counters._bambooFiredOnTurn;
        delete gs._spellDamageLog;
        return;
      }

      // Punch-impact animation matches Aggressive Town Guard's pattern —
      // emitted as its own socket event so the client's onPunchImpact
      // handler renders the fist + impact ring + radiating lines. Routing
      // through play_zone_animation doesn't work here: punch_impact
      // isn't registered in the client's ANIM_REGISTRY (it's only
      // handled by the dedicated socket listener), so the animation
      // silently dropped.
      // Auftritt ZUERST — er kuendigt den Schlag an, statt ihn zu
      // kommentieren. Erst hier, nicht oben im Hook: bis zu dieser
      // Stelle kann der Ablauf noch abbrechen (kein Ziel, Held tot),
      // und ein Auftritt ohne Wirkung waere falsch.
      await zeigeAuftritt(engine, pi);

      engine._broadcastEvent('punch_impact', {
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(380);

      // W32a (Al, 22.10.2026): der Schlag zählt als Attack des Trägers — Attack-Reaktionen (Magic Topaz, Arrows …) über die virtuelle Attack-Kette.
      // W39a: dieselbe Kette meldet auch `afterSpellResolved` als Attack (vorher feuerte der Staff es selbst, ohne `heroOwner`).
      await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx, heroOwner: feld, ziele: [target], wiederhole: () => module.exports.hooks.onCardAddedFromDiscardToHand(ctx, true), resolve: async () => {
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(dmgSource, tgtHero, atk, 'attack');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, atk, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      return true;
      } });

      delete gs._spellDamageLog;   // W39a: `afterSpellResolved` (Attack) feuert die Kette `alsAttackKette` (oben), nicht mehr der Staff selbst

      engine.log('bamboo_staff_strike', {
        player: ps.username, hero: hero.name,
        target: target.cardName, dealt: atk,
      });
      engine.sync();
    },
  },
};
