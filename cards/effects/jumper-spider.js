// ═══════════════════════════════════════════
//  CARD EFFECT: "Jumper Spider"
//  Creature (Summoning Magic Lv1, Surprise) — 50 HP
//
//  "Activate this Surprise when the user is hit by an Attack, Spell
//   or Creature effect. Draw 2 cards and place this Creature into the
//   user's free Support Zone. At the beginning of each turn, the turn
//   player takes permanent control of this Creature."
//
//  Mechanics
//  ─────────
//   • Surprise + Creature hybrid (cards.json: cardType === 'Creature',
//     subtype === 'Surprise'). The engine's `_activateSurprise`
//     auto-routes creature-typed Surprises into a free Support Zone
//     on activation (`safePlaceInSupport(cardName, playerIdx, heroIdx, -1)`)
//     — Jumper Spider just needs to draw the 2 cards inside its
//     `onSurpriseActivate` and return null. The placement is
//     automatic and uses the engine's "as if placed in theirs"
//     logic via the same heroIdx the surprise activated on.
//   • Ping-pong control: `onTurnStart` PHYSICALLY MOVES Jumper Spider
//     to a free Support Zone on the new turn player's side, then
//     transfers permanent control via `engine.actionTransferCreature`.
//     Per the CARD_API "Permanent control transfer ALWAYS moves the
//     Creature" rule — Dark Gear / Diplomacy use the same flow.
//     Unconditional by card text, so we SKIP the Defending the Gate
//     check (only opp's effortful control plays gate-check; an
//     automatic per-turn ping-pong does not).
//     If the new turn player has no free Support Zone, the transfer
//     simply skips this turn — Jumper Spider stays under the current
//     controller and tries again next turn.
//   • Telekinesis explicitly disallowed — there's no "user" to draw
//     against without a real targeting event.
// ═══════════════════════════════════════════

const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Jumper Spider';
const DRAW_COUNT = 2;

/**
 * Build the list of free Support Zones on `pi`'s side. Empty Hero slots
 * (no Hero present) are skipped — a free slot needs a living Hero (or
 * at least a placed Hero) to anchor the zone.
 */
function getFreeSupportZones(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const freeZones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!ps.heroes[hi]?.name) continue;
    const supportZones = ps.supportZones?.[hi] || [];
    for (let si = 0; si < 3; si++) {
      if (((supportZones[si] || []).length === 0)) {
        freeZones.push({ heroIdx: hi, slotIdx: si });
      }
    }
  }
  return freeZones;
}

module.exports = {
  isSurprise: true,
  // Active in 'surprise' for the trigger pre-flip and in 'support'
  // after the auto-placement. The onTurnStart hook needs to fire
  // from 'support' for the ping-pong.
  activeIn: ['surprise', 'support'],

  canTelekinesisActivate: false,

  /**
   * Trigger: host Hero is targeted by an Attack, Spell, or Creature
   * effect. Mirrors Booby Trap's gate — requires a live source.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    if (isCreatureSource(engine, sourceInfo)) {
      return !!resolveSourceCreature(engine, sourceInfo);
    }
    if (sourceInfo.heroIdx == null || sourceInfo.heroIdx < 0) return false;
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return !!(attacker && attacker.hp > 0);
  },

  /**
   * Effect: draw 2 cards. Placement into the host's free Support Zone
   * is automatic — the engine's `_activateSurprise` handles it for
   * any Creature-typed Surprise.
   */
  async onSurpriseActivate(ctx /*, sourceInfo */) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return null;

    // Web-leap visual on host Hero before the draw.
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle',
      owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
    });
    await engine._delay(300);

    const drawn = await engine.actionDrawCards(pi, DRAW_COUNT, { source: CARD_NAME });
    engine.log('jumper_spider_draw', {
      player: ps.username, drawn: drawn?.length || 0,
    });
    engine.sync();
    return null;
  },

  hooks: {
    /**
     * At the start of each turn, the turn player takes permanent
     * control of Jumper Spider — which per the CARD_API contract
     * means PHYSICALLY moving it to a free Support Zone on their
     * side. Skips when:
     *   • The new turn player already controls it (no-op).
     *   • The new turn player has no free Support Zone (Jumper
     *     Spider stays where it is; we try again next turn).
     */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      // Defensive: a face-down inst here would be Bakhm-staged, but
      // Jumper Spider's placement after activation is always face-up.
      if (inst.faceDown) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const activePlayer = gs.activePlayer;
      if (activePlayer == null || activePlayer < 0) return;
      const currentController = inst.controller ?? inst.owner;
      if (currentController === activePlayer) return;

      // Free-zone check on the NEW controller's side.
      const freeZones = getFreeSupportZones(gs, activePlayer);
      if (freeZones.length === 0) {
        engine.log('jumper_spider_transfer_skipped', {
          reason: 'no_free_zone',
          player: gs.players[activePlayer]?.username,
        });
        return;
      }

      // Prompt the NEW turn player for a destination slot. Only one
      // free zone → auto-pick (don't pester for a trivial choice).
      let chosenZone;
      if (freeZones.length === 1) {
        chosenZone = freeZones[0];
      } else {
        const picked = await engine.promptGeneric(activePlayer, {
          type: 'zonePick',
          zones: freeZones,
          title: CARD_NAME,
          description: `Take permanent control of ${CARD_NAME} — choose a free Support Zone.`,
          cancellable: false,
          previewCardName: CARD_NAME,
        });
        chosenZone = (picked && freeZones.find(z =>
          z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx
        )) || freeZones[0];
      }

      // Single chokepoint — physical move + control transfer + slide
      // animation + onCardLeaveZone / onCardEnterZone / onTakeControl
      // hooks all fire from inside actionTransferCreature. NO
      // Defending the Gate check (card text is unconditional).
      const result = await engine.actionTransferCreature(
        inst, activePlayer, chosenZone.heroIdx, chosenZone.slotIdx,
        { sourceName: CARD_NAME },
      );
      if (!result?.success) return;

      engine.log('jumper_spider_transfer', {
        from: gs.players[currentController]?.username,
        to: gs.players[activePlayer]?.username,
        heroIdx: chosenZone.heroIdx, slotIdx: chosenZone.slotIdx,
      });
      engine.sync();
    },
  },
};
