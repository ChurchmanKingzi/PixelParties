// ═══════════════════════════════════════════
//  CARD EFFECT: "500 Piranhas in a Monster Suit"
//  Creature (Summoning Magic Lv0, Normal, 50 HP)
//
//  Choose a Creature your opponent controls and
//  defeat it to play this card. Place this
//  Creature into the Support Zone the defeated
//  Creature occupied. The corresponding Hero
//  takes 80 damage at the end of each of its
//  controller's turns. Playing this card does
//  not cost an Action, but you can only play
//  1 per turn.
//
//  Implementation
//  ──────────────
//  Plays through `beforeSummon`:
//    1. Gate: 1-per-turn HOPT + an opp creature
//       must exist + the engine's standard
//       cardinal/control immunity gate excludes
//       un-defeatable creatures.
//    2. Prompt for opp Creature target.
//    3. Defeat via `actionDestroyCard` so all
//       on-death hooks (Cute Phoenix revive,
//       Loyal Terrier 50-dmg trigger, etc.) fire
//       cleanly. If the destroy gets cancelled
//       (Cool Rescuer Monia or similar saves the
//       target), the play fizzles too.
//    4. Place this Creature into the now-empty
//       slot, OWNED BY THE OPPONENT (so
//       inst.controller = opp → end-of-OPP's-
//       turn fires the 80-dmg trigger), but with
//       `inst.originalOwner` overridden back to
//       the caster so the card routes back to
//       OUR discard pile when later destroyed.
//    5. `_placementConsumedByCard` flag tells the
//       server not to also try its default
//       summon-on-our-side flow.
//
//  ANIMATION: "piranha_bites" — many small bite
//  marks chomping the host hero zone, fired both
//  on the host-takeover (placement) and on every
//  end-of-turn 80-dmg tick.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Piranhas in a Monster Suit'; // matches the partial-name search
// The full name for direct lookups. Engine grep is case-sensitive on
// the cards.json key.
const FULL_NAME = '500 Piranhas in a Monster Suit';
const HOST_DAMAGE = 80;
const HOPT_KEY = 'piranhas-suit';

function _hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn;
}
function _stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;
}

/** Opp Creature targets that can actually be defeated (no Cardinal / omni / steal-immortal). */
function _validVictims(engine, pi) {
  const oi = pi === 0 ? 1 : 0;
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.owner !== oi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (engine.isOmniImmune(inst)) continue;          // Cardinal / omni
    if (inst.counters?._damageDestroyImmune) continue; // Time Bomblebee armed
    if (inst.counters?.immovable) continue;
    if (inst.counters?._stealImmortal) continue;      // Stolen-and-immortal
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner,
      heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  // No Action cost — plays as an inherent additional Action.
  inherentAction: true,
  // Doesn't need a free zone on a hero on OUR side; the placement
  // happens on the OPP's side after the target's defeat.
  canBypassFreeZoneRequirement: () => true,
  // Lv0 already needs no spell schools but bypassing the gate is
  // belt-and-suspenders for any future hero-school check.
  canBypassLevelReq: () => true,

  // Surface in the picker only when there's at least one valid
  // opp Creature to defeat AND the per-turn HOPT is unclaimed.
  canSummon: (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    if (_hoptUsed(gs, pi)) return false;
    return _validVictims(engine, pi).length > 0;
  },

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    if (_hoptUsed(gs, pi)) return false;
    return _validVictims(engine, pi).length > 0;
  },

  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (_hoptUsed(gs, pi)) return false;

    const victims = _validVictims(engine, pi);
    if (victims.length === 0) return false;

    // ── Step 1: pick the opp Creature to defeat ────────────────
    const picked = await engine.promptEffectTarget(pi, victims, {
      title: FULL_NAME,
      description: 'Choose an opponent Creature to defeat. The Piranhas takes its slot.',
      confirmLabel: '🐟 Devour!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });
    if (!picked || picked.length === 0) return false;
    const victim = victims.find(t => t.id === picked[0]);
    if (!victim?.cardInstance) return false;

    const targetInst = victim.cardInstance;
    const oi = pi === 0 ? 1 : 0;
    const destHi = targetInst.heroIdx;
    const destSlot = targetInst.zoneSlot;
    const ops = gs.players[oi];
    if (!ops) return false;

    // ── Step 2: defeat the chosen Creature ─────────────────────
    // Use actionDestroyCard so on-death hooks fire (Phoenix revive,
    // Loyal Terrier chain, etc.). Source is the Piranhas (owned by
    // us) so reactions correctly attribute the kill.
    const dummySource = { name: FULL_NAME, owner: pi, heroIdx: -1 };
    await engine.actionDestroyCard(dummySource, targetInst, {
      fireCreatureDeath: true,
    });

    // If the target was rescued (Cool Rescuer Monia, Cosmic
    // Malfunction, …) the destroy fizzled — bail and DON'T claim the
    // HOPT (the play didn't go through).
    if (targetInst.zone === 'support') {
      engine.log('piranhas_fizzle', {
        player: ps.username, reason: 'destroy_blocked',
        target: targetInst.name,
      });
      return false;
    }

    // The destroy may have triggered an on-death effect that re-
    // occupies the slot (revives, cluster summons, etc.). If so,
    // there's no opening for the Piranhas — fizzle without claiming
    // the HOPT.
    const slotAfter = ((ops.supportZones?.[destHi] || [])[destSlot] || []);
    if (slotAfter.length > 0) {
      engine.log('piranhas_fizzle', {
        player: ps.username, reason: 'slot_reoccupied',
        target: victim.cardName,
      });
      return false;
    }

    // ── Step 3: place the Piranhas on OPP'S side ──────────────
    // Owner = opp so the creature renders on opp's row, controller
    // = opp so end-of-OPP's-turn fires our recurring damage. We
    // manually correct `originalOwner` back to us so destruction
    // routes the card to OUR discard pile (it WAS our card; opp
    // shouldn't get to recover it via their pile).
    const placeRes = engine.summonCreature(FULL_NAME, oi, destHi, destSlot, {
      source: FULL_NAME,
    });
    if (!placeRes) {
      engine.log('piranhas_fizzle', {
        player: ps.username, reason: 'place_failed',
      });
      return false;
    }
    const inst = placeRes.inst;
    inst.originalOwner = pi; // discard routes back to us, not opp
    inst.controller = oi;    // explicit — already true via owner

    // Remove the card from our hand (the standard server flow
    // would do this for a normal summon, but we're bypassing it
    // via `_placementConsumedByCard` below). Splice the FIRST
    // matching name; the server's `_resolvingCard` flag pins
    // which copy is the in-flight one.
    const handIdx = (ps.hand || []).indexOf(FULL_NAME);
    if (handIdx >= 0) {
      ps.hand.splice(handIdx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) {
        gs._scTracking[pi].cardsPlayedFromHand++;
      }
    }

    // Visual: many bites on the host hero zone.
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bites',
      owner: oi, heroIdx: destHi, zoneSlot: -1,
    });
    await engine._delay(700);

    _stampHopt(gs, pi);
    ps._placementConsumedByCard = FULL_NAME;

    engine.log('piranhas_summon', {
      player: ps.username,
      victim: victim.cardName,
      hostHero: ops.heroes?.[destHi]?.name,
    });
    engine.sync();

    // Returning false stops the server's default summonCreature
    // path (we already placed the inst manually on opp's side).
    return false;
  },

  hooks: {
    // ── End-of-controller's-turn 80 dmg to host ─────────────────
    // Fires for every card every onTurnEnd. ctx.activePlayer = the
    // turn that's ENDING. We trigger when activePlayer matches our
    // controller (opp), since the Piranhas is on opp's side.
    onTurnEnd: async (ctx) => {
      // Standard "controller's turn ending" gate. Piranhas was placed
      // under the opp's ownership in beforeSummon, so cardOwner is opp
      // and isMyTurn is true exactly at the end of opp's turn — which
      // is the spec ("end of each of its controller's turns").
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const controller = ctx.cardOwner;

      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;

      // Animation: bites land on host hero.
      engine._broadcastEvent('play_zone_animation', {
        type: 'piranha_bites',
        owner: controller, heroIdx: inst.heroIdx, zoneSlot: -1,
      });
      await engine._delay(450);

      // Damage attributed to the ORIGINAL caster, so reactions that
      // gate on "damage from an opp source" fire correctly for the
      // controller. heroIdx mirrors the host slot so attribution lines
      // up.
      const sourceOwner = inst.originalOwner ?? inst.owner;
      const source = {
        name: FULL_NAME, owner: sourceOwner, heroIdx: inst.heroIdx,
        cardInstance: inst,
      };
      await engine.actionDealDamage(source, host, HOST_DAMAGE, 'creature');

      engine.log('piranhas_tick', {
        host: host.name, dmg: HOST_DAMAGE, controller,
      });
      engine.sync();
    },
  },
};
