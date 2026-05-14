// ═══════════════════════════════════════════
//  CARD EFFECT: "Cannibalism"
//  Ability — feeds the equipped Hero on every
//  ally death.
//
//  When an ally target (own Hero OR own Creature)
//  is killed by ANY source (including the
//  Cannibalism Hero's own player), each Cannibalism
//  Hero with `hp < maxHp` AUTOMATICALLY heals
//  40 / 80 / 150 HP based on the Cannibalism stack
//  level (1/2/3+). The player has no choice —
//  the eat is mandatory whenever the hero is
//  wounded and the per-turn slot is unspent.
//
//  Hard once-per-turn per Cannibalism Hero —
//  claimed on every fire (was previously "soft":
//  claimed only on accept, but the player no
//  longer declines, so the soft/hard distinction
//  collapses to plain HOPT).
//
//  Stacking: when a Hero has multiple Cannibalism
//  copies in the same ability slot, ONLY the
//  lowest-id instance actually runs the heal
//  (sibling copies dedup to it). The heal amount
//  is read from the full stack length so a Lv2
//  Hero heals 80 even though only one inst fired.
// ═══════════════════════════════════════════

const HEAL_BY_LEVEL = [40, 80, 150]; // index = level - 1, cap at 3

/** Heal a Cannibalism Hero off the death of an ally. Shared between
 *  the onCreatureDeath and onHeroKO listeners. */
async function tryEat(ctx, deadName, deadOwnerSide) {
  if (!deadName || deadOwnerSide == null) return;
  const engine = ctx._engine;
  const gs = engine.gs;

  // The listener IS this Cannibalism Hero.
  const ourPi = ctx.cardOwner;
  const ourHi = ctx.cardHeroIdx;
  const ourHero = gs.players[ourPi]?.heroes?.[ourHi];
  if (!ourHero?.name || ourHero.hp <= 0) return;
  // Wounded gate — Cannibalism only offers when there's HP to fill.
  const maxHp = ourHero.maxHp ?? ourHero.hp;
  if (ourHero.hp >= maxHp) return;

  // Ally gate: the dying entity must have been on OUR effective side.
  // `cardOwner` already accounts for charm/steal redirects via
  // `_createContext`, so charmed Heroes feed their current charmer.
  if (deadOwnerSide !== ourPi) return;

  // Stack-aware dedup. Multiple Cannibalism copies on the same Hero
  // would each fire onHeroKO/onCreatureDeath; route the prompt
  // through the lexicographically-smallest-id instance so the player
  // never sees the same decision twice for one death. (CardInstance
  // ids are UUID strings, so we can't use Math.min — that returns
  // NaN on strings and silently bails every listener.) Stack length
  // drives the heal level.
  const stack = engine.cardInstances.filter(c =>
    (c.controller ?? c.owner) === ourPi
    && c.heroIdx === ourHi
    && c.zone === 'ability'
    && c.name === 'Cannibalism'
    && !c.faceDown);
  if (stack.length === 0) return;
  const sortedIds = stack.map(c => c.id).sort();
  if (ctx.card.id !== sortedIds[0]) return;

  // Hard once-per-turn per Cannibalism Hero. Auto-fires every eligible
  // ally death until the slot is spent — the player no longer has a
  // choice (the prior confirm prompt has been removed). Claimed
  // BEFORE the heal so any reentrant deaths fired by downstream
  // effects can't double-trigger this hero's eat.
  const hoptKey = `cannibalism_eat:${ourPi}-${ourHi}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;

  const level = Math.min(stack.length, HEAL_BY_LEVEL.length);
  const healAmount = HEAL_BY_LEVEL[level - 1];

  // Visual: meat drumstick chomp + green healing particles on the
  // eating Hero. Anchored at the hero zone (zoneSlot: -1) so it
  // paints over the portrait.
  engine._broadcastEvent('play_zone_animation', {
    type: 'cannibalism_chomp',
    owner: ourPi, heroIdx: ourHi, zoneSlot: -1,
  });
  // Short hold so the first bite "lands" before the heal numbers
  // pop — keeps the visual reading as cause-then-effect.
  await engine._delay(280);

  const source = { name: 'Cannibalism', owner: ourPi, heroIdx: ourHi };
  await engine.actionHealHero(source, ourHero, healAmount);

  engine.log('cannibalism_heal', {
    player: gs.players[ourPi]?.username,
    hero: ourHero.name,
    ate: deadName,
    level,
    healed: healAmount,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['ability'],

  hooks: {
    /** Ally Creature died — offer the prompt. Side attribution uses
     *  CONTROLLER so a Creature cross-side-placed onto opp's board
     *  (Chilly Wizard) feeds opp's Cannibalism, not the original
     *  owner's. */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;
      const ownerSide = death.controller ?? death.owner;
      await tryEat(ctx, death.name, ownerSide);
    },

    /** Ally Hero KO'd — offer the prompt, but never let a Cannibalism
     *  Hero eat ITSELF (if it died with the bypass-dead-hero filter
     *  letting this listener still fire). */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;

      // Resolve the dying hero's slot.
      let deadOwner = -1, deadHeroIdx = -1;
      for (let p = 0; p < 2; p++) {
        const heroes = gs.players[p]?.heroes || [];
        for (let h = 0; h < heroes.length; h++) {
          if (heroes[h] === dyingHero) {
            deadOwner = p; deadHeroIdx = h;
            break;
          }
        }
        if (deadOwner >= 0) break;
      }
      if (deadOwner < 0) return;
      // No self-cannibalism — a Cannibalism Hero who just died can't
      // eat themselves on the way out.
      if (deadOwner === ctx.cardOwner && deadHeroIdx === ctx.cardHeroIdx) return;
      await tryEat(ctx, dyingHero.name, deadOwner);
    },
  },
};
