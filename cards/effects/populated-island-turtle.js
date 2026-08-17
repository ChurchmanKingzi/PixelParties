// ═══════════════════════════════════════════
//  CARD EFFECT: "Populated Island Turtle"
//  Creature (Normal, Lv3, Summoning Magic) — BANNED
//
//  ① TAKES UP 3 SUPPORT ZONES — when summoned,
//    occupies all 3 of the host Hero's Support
//    Zone slots. Cannot be summoned unless all 3
//    are free.
//
//  ② HOPT — once per turn, draw until you have
//    10 cards in hand.
//
//  Multi-zone implementation:
//   • The Creature inst itself lives in ONE slot
//     (whichever the engine picks via the
//     standard summon path — usually slot 0).
//   • The OTHER two slots get a sentinel name
//     `_ZoneBlocked` pushed into them. The
//     sentinel:
//       - Blocks future placements there because
//         `safePlaceInSupport`'s emptiness check
//         (`slot.length === 0`) sees the slot as
//         occupied.
//       - Is invisible to targeting iteration:
//         `cardDB[creatureName]` returns
//         undefined for the sentinel, so the
//         hasCardType('Creature') filter rejects
//         it. Same goes for any creature-name
//         iteration that reads the cardDB.
//   • On Turtle's removal (death, bounce, etc.),
//     `onCardLeaveZone` clears the sentinels so
//     the host Hero's slots free up cleanly.
//
//  Caveat: der Platzhalter-Ansatz zieht Einfachheit
//  der vollen Engine-Anbindung vor. Effekte, die
//  `supportZones[hi][si][0]` ROH lesen, ohne
//  cardDB-Nachschlag (selten), saehen die
//  Platzhalter-Zeichenkette — im aktuellen Stand
//  gibt es keinen solchen Leser.
//
//  ★ 17.8.: die urspruengliche Begruendung lautete
//  „this is a banned card by design". Die traegt
//  nicht mehr — nach Als Regel vom 17.8. sagt
//  `banned` nichts darueber, wie sorgfaeltig eine
//  Karte gebaut wird (siehe CARD_API.md). Die
//  Abkuerzung bleibt vorerst stehen, weil sie
//  nachweislich mit nichts kollidiert; sie ist
//  aber jetzt eine offene Schuld, keine
//  gerechtfertigte Vereinfachung. Al gemeldet.
// ═══════════════════════════════════════════

const ZONE_BLOCKED_SENTINEL = '_ZoneBlocked';
const CARD_NAME = 'Populated Island Turtle';
const HAND_TARGET = 10;

module.exports = {
  activeIn: ['support'],

  /**
   * Summon validation:
   *   • Per-Hero (cardHeroIdx >= 0) — requires ALL 3 of the host
   *     Hero's Support Zones to be free. Self-excludes the just-
   *     being-summoned dummy if it's already tracked at one of the
   *     slots (a beforeSummon-style re-check during placement).
   *   • Card-wide (cardHeroIdx === -1, fired by `getSummonBlocked`)
   *     — drives the in-hand greyout. Returns true iff at least one
   *     CAPABLE Hero (alive, not Frozen/Stunned, level-eligible)
   *     has all 3 of their Support Zones free. If no such Hero
   *     exists the card is unplayable for the rest of the turn and
   *     `getSummonBlocked` collects it for grey-out.
   */
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs?.players?.[pi];
    if (!ps) return false;
    const allZonesFree = (hi, allowSelf) => {
      const sup = ps.supportZones?.[hi] || [];
      for (let z = 0; z < 3; z++) {
        if ((sup[z] || []).length === 0) continue;
        if (!allowSelf) return false;
        // Self-exclusion: our just-being-summoned dummy may already
        // sit at one slot during the placement re-check.
        const slotName = sup[z][0];
        if (slotName === CARD_NAME) {
          const inst = engine.cardInstances.find(c =>
            c.owner === pi && c.zone === 'support'
            && c.heroIdx === hi && c.zoneSlot === z
            && c.id === ctx.card?.id,
          );
          if (inst) continue;
        }
        return false;
      }
      return true;
    };

    // ── Per-Hero check ──
    if (typeof heroIdx === 'number' && heroIdx >= 0) {
      return allZonesFree(heroIdx, /*allowSelf*/ true);
    }

    // ── Card-wide check (greyout signal) ──
    const cardData = engine._getCardDB()[ctx.cardName];
    if (!cardData) return true;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
      if (allZonesFree(hi, /*allowSelf*/ false)) return true;
    }
    return false;
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;
    return (ps.hand?.length || 0) < HAND_TARGET;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const need = Math.max(0, HAND_TARGET - (ps.hand?.length || 0));
    if (need <= 0) return false;
    await engine.actionDrawCards(pi, need);
    engine.log('island_turtle_draw', {
      player: ps.username, target: HAND_TARGET, drew: need,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * On-summon: stamp `_ZoneBlocked` sentinels into the OTHER two
     * slots of the host Hero so the Turtle visually & mechanically
     * occupies all 3 zones. Filter to THIS Turtle's own summon to
     * avoid stamping for sibling summons.
     */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      if (!ps) return;
      const heroIdx = ctx.cardHeroIdx;
      const ourSlot = ctx.card.zoneSlot;
      const sup = ps.supportZones?.[heroIdx];
      if (!sup) return;
      for (let z = 0; z < 3; z++) {
        if (z === ourSlot) continue;
        if ((sup[z] || []).length === 0) {
          sup[z] = [ZONE_BLOCKED_SENTINEL];
        }
      }
      engine.log('island_turtle_zones_claimed', {
        player: ps.username, heroIdx, anchorSlot: ourSlot,
      });
      engine.sync();
    },

    /**
     * On-removal: clear the sentinels so the host Hero's slots free
     * up. Listens via `onCardLeaveZone` so any departure path —
     * death-by-damage, bounce, opp move-to-discard, etc. — triggers
     * the cleanup.
     *
     * `fromHeroIdx` is the canonical signal but some leave-zone
     * paths don't carry it; fall through to scanning every hero
     * for an orphan-sentinel pair (a slot pair where 2/3 slots are
     * sentinels and the third is empty — i.e. the Turtle just left).
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      if (!ps) return;
      const clearSentinels = (heroIdx) => {
        const sup = ps.supportZones?.[heroIdx];
        if (!sup) return;
        for (let z = 0; z < 3; z++) {
          const slot = sup[z] || [];
          if (slot.length === 1 && slot[0] === ZONE_BLOCKED_SENTINEL) {
            sup[z] = [];
          }
        }
      };
      const explicitHeroIdx = ctx.fromHeroIdx;
      if (typeof explicitHeroIdx === 'number' && explicitHeroIdx >= 0) {
        clearSentinels(explicitHeroIdx);
      } else {
        // Defensive fallback — scan every Hero this controller owns
        // for orphan sentinels. Only orphans matter (a still-living
        // Turtle would have its name in one of the slots, so its
        // companion sentinels stay).
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const sup = ps.supportZones?.[hi] || [];
          let hasTurtle = false;
          for (let z = 0; z < 3; z++) {
            if ((sup[z] || [])[0] === CARD_NAME) { hasTurtle = true; break; }
          }
          if (!hasTurtle) clearSentinels(hi);
        }
      }
      engine.sync();
    },
  },
};
