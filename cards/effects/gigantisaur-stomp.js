// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Stomp"
//  Spell (Normal, Lv0 Summoning Magic) — Gigantisaurs
//
//  Cast condition: the casting Hero must have at
//  least 1 Creature with 400+ max HP in one of
//  its Support Zones.
//
//  Effect: choose any target (Hero or Creature)
//  and deal 150 damage.
//
//  `inherentAction: true` — the cast doesn't
//  consume the host Hero's action slot. The
//  per-Hero HOPT below is the real cap.
//
//  Per-Hero HOPT: each Hero can only cast Stomp
//  once per turn. Tracked via
//  `gs.hoptUsed['gigantisaur-stomp:<pi>:<heroIdx>']
//  === gs.turn`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Gigantisaur Stomp';
const HOST_MIN_MAX_HP = 400;
const DAMAGE = 150;

function _hoptKey(pi, heroIdx) {
  return `gigantisaur-stomp:${pi}:${heroIdx}`;
}

/**
 * Does the given Hero host at least one Creature with maxHp ≥ 400?
 * Walks `engine.cardInstances` (the support-zone truth) and reads
 * `counters.maxHp ?? cd.hp` — same pattern Healing Potion / Bone Dog
 * use for HP comparisons.
 */
function _heroHasBigCreature(engine, pi, heroIdx) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.heroIdx !== heroIdx) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
    if (maxHp >= HOST_MIN_MAX_HP) return true;
  }
  return false;
}

module.exports = {
  requiresTarget: true,
  inherentAction: true,

  /**
   * Per-Hero gate: caster's Hero hosts a 400+ HP Creature AND hasn't
   * already cast Stomp this turn. The engine calls this for both the
   * eligible-list filter and the pre-resolution sanity check
   * (engine.js:8554).
   */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    if (gs.hoptUsed?.[_hoptKey(pi, heroIdx)] === gs.turn) return false;
    return _heroHasBigCreature(engine, pi, heroIdx);
  },

  /**
   * Side-wide gate — at least ONE of this player's Heroes hosts a 400+
   * HP Creature AND hasn't already cast Stomp this turn. Without this,
   * `getBlockedSpells` would never grey out Stomp once a single Hero
   * had cast it, even if no other Hero on the side qualifies. (The
   * per-Hero `canPlayWithHero` still handles eligibility per slot.)
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    const ps = gs.players[pi];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (gs.hoptUsed?.[_hoptKey(pi, hi)] === gs.turn) continue;
      if (_heroHasBigCreature(engine, pi, hi)) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Re-check the cast condition at resolve-time (state can shift
      // between hand-play and resolution via interrupt chains).
      if (!_heroHasBigCreature(engine, pi, heroIdx)) {
        gs._spellCancelled = true;
        engine.log('stomp_fizzle', { reason: 'no_host_creature', player: ps.username });
        return;
      }
      if (gs.hoptUsed?.[_hoptKey(pi, heroIdx)] === gs.turn) {
        gs._spellCancelled = true;
        engine.log('stomp_fizzle', { reason: 'hopt_used', player: ps.username, heroIdx });
        return;
      }

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target.`,
        confirmLabel: `🦖 Stomp! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // Stamp the per-Hero HOPT. Done at commit time (post-target,
      // pre-damage) so a cancelled target prompt doesn't burn the
      // turn slot.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[_hoptKey(pi, heroIdx)] = gs.turn;

      // Giant dinosaur leg crashes down from above the screen onto the
      // target's slot. The client renders this as a colossal scaly
      // limb dropping from off-screen, a heavy impact bounce, a dust
      // cloud, and a brutal squash on the target's element.
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'giant_dino_stomp', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      });
      // Animation runtime is ~1.4s; hold long enough for the leg to
      // actually connect before the damage number pops.
      await engine._delay(900);

      const dmgSource = { name: CARD_NAME, owner: pi, heroIdx };
      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(dmgSource, h, DAMAGE, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('stomp_damage', {
        player: ps.username, target: target.cardName,
        targetOwner: target.owner, amount: DAMAGE,
      });
      engine.sync();
    },
  },
};
