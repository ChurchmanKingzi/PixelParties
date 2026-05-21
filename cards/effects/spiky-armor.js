// ═══════════════════════════════════════════
//  CARD EFFECT: "Spiky Armor"
//  Artifact (Reaction, Cost 4)
//
//  EFFECT:
//   "Play this card immediately when a target you
//    control takes damage from an Attack. The
//    attacker takes the same amount of damage as
//    recoil."
//
//  ── Reaction-only (never proactive) ──
//  Like Boots of Hermes: cards.json subtype is
//  "Reaction" and this script exports NEITHER
//  `proactivePlay` NOR `isReaction`, so
//  `validateActionPlay` refuses every attempt to
//  click it in hand ("Reaction subtype: not
//  proactively playable unless script opts in")
//  and the generic reaction-chain collector skips
//  it (`if (!script?.isReaction) continue;`). It
//  acts ONLY through the engine's after-damage
//  hand-reaction hubs below.
//
//  ── "a target you control" = Hero OR Creature ──
//  Two opt-in flags so the full wording is honored:
//   • `isAfterDamageReaction` → the shared HERO
//     hub (`_checkAfterDamageHandReactions`,
//     survival-gated, same path Fireshield uses).
//   • `isAfterCreatureDamageReaction` → the
//     additive CREATURE hub
//     (`_checkAfterCreatureDamageHandReactions`,
//     added for this card; opt-in so Fireshield /
//     Cloud in a Bottle / Punch in the Box are
//     unaffected and stay Hero-only).
//  Spiky Armor sets `firesOnLethalDamage: true`,
//  so it triggers EVEN when the Attack defeats the
//  target (unlike Fireshield, whose text requires
//  the target to survive). On a lethal hit the
//  recoil = the HP the target ACTUALLY lost (its
//  HP just before dying): both hubs pass the
//  engine's `realDealt` (= min(damage, preHitHP)),
//  so overkill is never recoiled. For a survivor
//  `realDealt === damage`, so nothing changes.
//
//  ── Recoil routing (Fireshield's shared helpers)
//   • Creature attacker → the attacking CREATURE
//     itself takes the recoil (never its host
//     Hero).
//   • Hero attacker (basic Attack / Attack card)
//     → the attacking Hero takes the recoil.
//  Recoil amount = the exact damage the target
//  took ("the same amount"). Recoil damage type
//  is 'other' (matches Fireshield) — both 'other'
//  and the synthetic `heroIdx:-1` recoil source
//  keep the recoil from opening a Surprise window
//  on the attacker (Booby Trap can't chain to
//  thorns damage).
// ═══════════════════════════════════════════

const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Spiky Armor';

/**
 * Valid trigger iff: the damage was from an Attack (`type === 'attack'`),
 * it came from the OPPONENT, and a live attacker is still around to
 * receive the recoil (the attacking Creature, or the attacking Hero).
 * Identical gate shape to Fireshield's `afterDamageCondition`.
 */
function _attackerValid(gs, ownerPi, engine, source, type) {
  if (type !== 'attack') return false;
  if (source?.owner == null || source.owner < 0) return false;
  if (source.owner === ownerPi) return false; // only the opponent's Attack
  if (!gs.players[source.owner]) return false;

  if (isCreatureSource(engine, source)) {
    // Creature attacker — only if its live instance is still on board.
    return !!resolveSourceCreature(engine, source);
  }
  // Hero source (basic Attack / Attack card): need a living attacker Hero.
  const srcHeroIdx = source.heroIdx ?? -1;
  if (srcHeroIdx < 0) return false;
  const srcHero = gs.players[source.owner].heroes?.[srcHeroIdx];
  return !!(srcHero && srcHero.hp > 0);
}

/**
 * Deal `amount` recoil to the attacker. Source is host-Hero-less
 * (`heroIdx: -1`, the Book of Doom / Explosivo pattern) so the recoil
 * itself never opens an attacker-side Surprise window.
 */
async function _recoil(engine, ownerPi, source, amount) {
  const gs = engine.gs;
  const ps = gs.players[ownerPi];
  const recoilSrc = { name: CARD_NAME, owner: ownerPi, heroIdx: -1 };

  if (isCreatureSource(engine, source)) {
    const rc = resolveSourceCreature(engine, source);
    if (rc) {
      await engine.actionDealCreatureDamage(
        recoilSrc, rc, amount, 'other',
        { sourceOwner: ownerPi, canBeNegated: false },
      );
    }
    engine.log('spiky_armor_recoil', {
      player: ps?.username, attacker: rc?.name || source?.name || '?',
      amount, vsCreature: true,
    });
  } else {
    const srcHero = gs.players[source.owner]?.heroes?.[source.heroIdx];
    if (srcHero && srcHero.hp > 0) {
      await engine.actionDealDamage(recoilSrc, srcHero, amount, 'other');
    }
    engine.log('spiky_armor_recoil', {
      player: ps?.username, attacker: srcHero?.name || '?', amount,
    });
  }
  engine.sync();
}

module.exports = {
  // Trigger even when the Attack DEFEATS the target — the engine then
  // passes `realDealt` (HP actually lost) as the recoil amount. Without
  // this flag both hubs skip the card on a lethal hit (Fireshield's
  // survival-only default).
  firesOnLethalDamage: true,

  // ── HERO target → shared hero after-damage hub ──
  isAfterDamageReaction: true,

  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    return _attackerValid(gs, pi, engine, source, type);
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    await _recoil(engine, pi, source, amount);
  },

  // ── CREATURE target → additive creature after-damage hub ──
  isAfterCreatureDamageReaction: true,

  afterCreatureDamageCondition(gs, pi, engine, inst, source, amount, type) {
    return _attackerValid(gs, pi, engine, source, type);
  },

  async afterCreatureDamageResolve(engine, pi, inst, source, amount, type) {
    await _recoil(engine, pi, source, amount);
  },
};
