// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Dragon Pilot"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 150 HP.
//
//  ① Can only be summoned by sacrificing 2+ of
//    your own Creatures that were NOT summoned
//    this turn and whose combined max HP is
//    ≥ 300.
//  ② If ALL sacrificed Creatures were Level 1
//    or lower, summoning this Creature counts
//    as an additional Action (costs no action
//    slot).
//  ③ Up to 3 times per turn, when you discard
//    1+ cards, choose a target and deal 100
//    damage to it with a massive fireball.
//
//  The "additional Action" path is implemented
//  via `inherentAction` (true whenever a valid
//  all-Lv1 sacrifice subset exists). When this
//  path is taken, `beforeSummon` restricts the
//  tribute picker to Lv1-or-lower candidates so
//  the player cannot break the card's contract
//  by picking higher-level creatures on a "free"
//  summon. On the paid path (Action Phase with
//  a main action available), any valid subset
//  works.
//
//  The sacrifice cost is defined via the engine's
//  `canSatisfySacrifice` / `resolveSacrificeCost`
//  primitives. Failed/cancelled cost payment
//  aborts the summon cleanly.
//
//  Steam Engineer bypasses the cost by passing
//  `skipBeforeSummon: true` when it calls
//  summonCreatureWithHooks (see engineer file).
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');

const CARD_NAME = 'Steam Dwarf Dragon Pilot';
const DISCHARGE_DAMAGE = 100;
const DISCHARGES_PER_TURN = 3;

// ── "not summoned this turn" (Korrektur 8.8.) ──
// Die Klausel steht seit jeher im Kartentext, wurde aber nie geprueft:
// `getSacrificableCreatures` laesst frisch beschworene Kreaturen
// ABSICHTLICH zu (Opfern ist gewollte Selbstentfernung, kein Zug der
// Kreatur — siehe Kommentar dort), und weder dieser Spec noch
// `_steam-dwarf-shared.js` filterten sie heraus. Man konnte also im
// selben Zug beschwoeren und sofort als Tribut verheizen.
//
// Weil der Filter den AKTUELLEN Zug braucht, sind die Specs jetzt
// Fabriken statt Modulkonstanten — ein Objekt auf Modulebene koennte
// `gs.turn` nicht sehen.
const notSummonedThisTurn = (engine) => {
  const turn = engine?.gs?.turn || 0;
  return (c) => c?.inst?.turnPlayed !== turn;
};

// Normal sacrifice spec — any Creature that was not summoned this turn
// qualifies. Used on the paid Action-Phase path where Dragon Pilot
// consumes the main action slot and the "all Lv1" bonus does not apply.
//
// `showFilteredAsIneligible` zeigt die in diesem Zug beschworenen
// Kreaturen weiterhin an, nur ausgegraut — sonst verschwaenden sie
// kommentarlos aus der Auswahl.
function makeSacrificeSpec(engine) {
  return {
    minCount: 2,
    minMaxHp: 300,
    filter: notSummonedThisTurn(engine),
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: 'Sacrifice 2 or more of your Creatures (not summoned this turn) with combined max HP ≥ 300.',
    confirmLabel: '🐉 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

// Lv1-only variant — only ≤Lv1 tributes are selectable. Used when Dragon
// Pilot is taking its "additional Action" (inherent) path so the zero-
// action-cost summon cannot be resolved against higher-level tributes.
// Beide Filter greifen hier zusammen: nicht frisch UND hoechstens Lv1.
function makeLv1SacrificeSpec(engine) {
  const notFresh = notSummonedThisTurn(engine);
  return {
    ...makeSacrificeSpec(engine),
    filter: (c) => notFresh(c) && (c.level || 0) <= 1,
    description: 'Sacrifice 2 or more Level 1 or lower Creatures (not summoned this turn) with combined max HP ≥ 300.',
  };
}

/** Kann dieser Held Dragon Pilot ueberhaupt beschwoeren (lebt, erfuellt
 *  die Stufenanforderung)? */
function heroCanSummonHere(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Belegte Support-Plaetze, auf die Dragon Pilot geworfen werden darf.
 *
 * Nur bei Helden, deren Zonen KOMPLETT voll sind — nur dort schafft das
 * Opfern ueberhaupt erst den Platz, in den Dragon Pilot dann faellt.
 * Geprueft wird mit GENAU dem Spec, den `beforeSummon` anschliessend
 * benutzt (inklusive `mustIncludeFromHeroIdx`), damit Hervorhebung und
 * spaetere Bezahlung nie auseinanderlaufen.
 *
 * Welcher Spec das ist, haengt am Beschwoerungsweg: sobald ein reines
 * Lv1-Opfer moeglich ist, meldet `inherentAction` "zusaetzliche Aktion",
 * und dann gilt der strengere Lv1-Spec.
 *
 * EINE Quelle fuer drei Verbraucher: `getBouncePlacementTargets`
 * (Hervorhebung im Client), `canPlaceOnOccupiedSlot` (Annahme auf dem
 * Server) und `canBypassFreeZoneRequirement` (Handkarten-Eignung).
 */
function occupiedDropSlots(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const lv1 = makeLv1SacrificeSpec(engine);
  const spec = engine.canSatisfySacrifice(pi, lv1) ? lv1 : makeSacrificeSpec(engine);
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const zones = ps.supportZones?.[hi] || [];
    const slots = [0, 1, 2];
    if (slots.some(z => (zones[z] || []).length === 0)) continue;   // hat noch Platz
    if (!heroCanSummonHere(engine, pi, hi)) continue;
    if (!engine.canSatisfySacrifice(pi, { ...spec, mustIncludeFromHeroIdx: hi })) continue;
    for (const z of slots) if ((zones[z] || []).length > 0) out.push({ heroIdx: hi, slotIdx: z });
  }
  return out;
}

const { usesLeft, spendUse } = require('./_charges');
const USE_KEY = 'dragonPilot';
module.exports = attachSteamEngine({
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): nur LESEN,
  // niemals den Zaehler anfassen — laeuft bei jedem Zustandsversand.
  chargesPerTurn: 3,
  chargeKey: USE_KEY,
  // CPU: confirm the "unleash fireball?" prompt — the default brain declines
  // cancellable confirms outside a card-cast (onDiscard trigger), so without
  // this the fireball never fires. Free damage is beneficial. (Title == card
  // name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // Cheap gate — true whenever a valid sacrifice subset exists right now.
  // Used by the engine for hand-play gating (`getSummonBlocked`) AND by
  // summon effects (Living Illusion etc.) via `engine.isCreatureSummonable`.
  canSummon(ctx) {
    return ctx._engine.canSatisfySacrifice(ctx.cardOwner, makeSacrificeSpec(ctx._engine));
  },

  // Inherent additional Action when an all-Lv1 sacrifice subset is
  // achievable — summoning Dragon Pilot off an all-Lv1 tribute costs no
  // action slot. If this flag is true at play time, beforeSummon
  // restricts the tribute picker to ≤Lv1 creatures so the player cannot
  // claim the free summon while paying with higher-level tributes.
  inherentAction(gs, pi, heroIdx, engine) {
    return engine.canSatisfySacrifice(pi, makeLv1SacrificeSpec(engine));
  },

  // Free-zone bypass: Dragon Pilot can be summoned onto a Hero with no
  // free Support Zones ONLY IF that Hero has 1+ sacrificable Creature
  // of their OWN (sacrificing one of this Hero's Creatures is what
  // frees the slot Dragon Pilot lands in), AND the overall sacrifice
  // spec remains satisfiable.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx),

  // Drop-on-occupied: only relevant for the all-full-slots case. When
  // the summoning Hero's Support Zones are all occupied but the player
  // has 1+ sacrificable Creature on that Hero, the server accepts a
  // drop on any occupied slot of that Hero — the drop is treated as a
  // "summon from this Hero" gesture, NOT a forced-tribute gesture. The
  // player still picks their sacrifices freely in the prompt; the only
  // constraint is that ≥1 must come from THIS Hero's zones, enforced in
  // beforeSummon via mustIncludeFromHeroIdx.
  //
  // Damit der Client die belegten Plaetze auch ANZEIGT und den Wurf
  // zulaesst (Korrektur 8.8.). Der fruehere Kommentar hier sagte, ein
  // Export von `getBouncePlacementTargets` wuerde Dragon Pilot in den
  // Deepsea-"bounce mode" zwingen und den normalen Wurf auf freie Zonen
  // verdraengen. Das stimmt nicht (mehr): der Client mischt beide Modi
  // ausdruecklich — belegte bp-Plaetze UND freie Plaetze
  // beschwoerungsfaehiger Helden leuchten gemeinsam auf, und der Klick
  // auf die Handkarte bietet ebenfalls beides an (app-board.jsx
  // ~Z. 19181 ff.). Ohne diesen Export leuchten bei Kreatur-Zuegen NUR
  // leere Plaetze — ein Held mit komplett vollen Zonen war damit gar
  // nicht anwaehlbar, obwohl Server und Kartenlogik den Wurf laengst
  // akzeptiert haetten.
  getBouncePlacementTargets: (gs, pi, engine) => occupiedDropSlots(gs, pi, engine),

  // Serverseitige Annahme des Wurfs — muss exakt dieselbe Liste
  // benutzen wie die Hervorhebung.
  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine) =>
    occupiedDropSlots(gs, pi, engine)
      .some(sl => sl.heroIdx === heroIdx && sl.slotIdx === slotIdx),

  // Pre-placement resolution: prompt for sacrifices, destroy them.
  // Returning false aborts the summon (engine's summonCreatureWithHooks
  // and the server's play_creature handler both respect this — the card
  // goes back to hand and the action slot isn't consumed).
  //
  // Three paths are woven here:
  //
  //   • Inherent path (ctx.isInherentAction === true): restrict tribute
  //     candidates to ≤Lv1, matching the card text's "additional Action"
  //     clause. Lv2+ Creatures stay visible but dimmed.
  //   • Free-slot drop: the server already validated a free slot on the
  //     summoning Hero. Sacrifice spec has no Hero-specific constraint;
  //     tributes may come from any ally Hero's zones. After beforeSummon
  //     returns true, the server's normal summonCreature places Dragon
  //     Pilot into the drop slot.
  //   • All-full drop (ps._requestedBouncePlaceSlot is set): the
  //     summoning Hero had no free slots. ≥1 tribute must come from
  //     THIS Hero's zones (enforced via mustIncludeFromHeroIdx). After
  //     the sacrifice frees a slot, Dragon Pilot is placed manually
  //     into the first freed slot and we signal the server to skip its
  //     default placement by setting _placementConsumedByCard.
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;

    // `_requestedBouncePlaceSlot` is only set when the player dropped
    // on an occupied slot — which for Dragon Pilot means the summoning
    // Hero had no free slots (canPlaceOnOccupiedSlot gates on that).
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;

    const baseSpec = ctx.isInherentAction ? makeLv1SacrificeSpec(engine) : makeSacrificeSpec(engine);
    const spec = allFullDrop
      ? {
          ...baseSpec,
          mustIncludeFromHeroIdx: heroIdx,
          description: `${baseSpec.description} At least one sacrifice must come from the summoning Hero's Support Zones.`,
        }
      : baseSpec;

    const ok = await engine.resolveSacrificeCost(ctx, spec);
    if (!ok) return false;

    // All-full path: manually place into a freed slot on the summoning
    // Hero, then tell the server to skip its default summonCreature.
    if (allFullDrop) {
      const supZones = ps.supportZones[heroIdx] || [];
      const freedSlot = [0, 1, 2].find(z => (supZones[z] || []).length === 0);
      if (freedSlot == null) return false; // shouldn't happen
      await engine.actionPlaceCreature(CARD_NAME, pi, heroIdx, freedSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    return true;
  },

  hooks: {
    /**
     * On discard of 1+ cards from hand, deal 100 damage to any target.
     * Up to 3 uses per turn per instance (tracked on inst.counters).
     * Does NOT conflict with the shared STEAM ENGINE passive: that
     * one has its own HOPT key (_steamEngineTurn), while this one
     * nutzt den gemeinsamen Rundenzaehler (Schluessel `dragonPilot`).
     */
    onDiscard: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;

      // Only my discards
      if (ctx.playerIdx !== pi) return;

      // Only when this Creature is actively on the field
      if (!inst || inst.zone !== 'support') return;
      // Als Ruling (Kreaturen-Audit nach dem Sandy-Blob-Fund): der
      // Kartentext nennt KEINE Hero-Abhängigkeit, also gated nur der
      // Zustand der Kreatur SELBST — isCardEffectActive ist das
      // kanonische Gate (faceDown/negated/nulled/frozen/stunned; der
      // alte Inline-Check kannte frozen/stunned nicht). Das frühere
      // attachedHero-Gate widersprach Rulebook + Engine-Doktrin
      // (Kreaturen toter/gestunnter Heroes bleiben aktiv).
      if (!engine.isCardEffectActive(inst)) return;

      // Rundenstempel und Kappe im gemeinsamen Zaehler (v417).
      const freiDP = usesLeft(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN });
      if (freiDP <= 0) return;

      // Offer activation — this is optional, so player can decline.
      const confirm = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `A card was discarded. Unleash a fireball for ${DISCHARGE_DAMAGE} damage? (${freiDP} use(s) left this turn)`,
        confirmLabel: '🔥 Fireball!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in fireball discharge.
      });
      if (!confirm || confirm.cancelled) return;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DISCHARGE_DAMAGE,
        title: CARD_NAME,
        description: `Hurl a fireball dealing ${DISCHARGE_DAMAGE} damage to any target.`,
        confirmLabel: `🔥 Fireball! (${DISCHARGE_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      // Commit the use counter only once the player is locked in
      spendUse(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN });

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Fireball — big radial blast on the target
      engine._broadcastEvent('play_zone_animation', {
        type: 'fireball',
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(700);

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, DISCHARGE_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, DISCHARGE_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('dragon_pilot_fireball', {
        player: gs.players[pi]?.username,
        target: target.cardName,
        damage: DISCHARGE_DAMAGE,
        usesRemaining: usesLeft(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN }),
      });
      engine.sync();
    },
  },
});
