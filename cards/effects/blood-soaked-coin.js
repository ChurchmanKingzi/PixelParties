// ═══════════════════════════════════════════
//  CARD EFFECT: "Blood-Soaked Coin"
//  Artifact (Normal, Cost 0)
//
//  Choose a target you PERMANENTLY control and
//  deal up to 300 damage to it. Gain 1 Gold per
//  10 points of damage actually dealt — UNLESS
//  the damage defeats the target, in which case
//  the gold is forfeit. Locks Artifact plays for
//  the rest of the turn (same `_artifactLockTurn`
//  flag Boomerang installs).
//
//  "Permanently control" = own + still controlled
//  by us (no charm/steal currently routing
//  control to the opponent). The filter excludes:
//    • Heroes whose `charmedBy` points at the
//      opponent (Charme Lv3 / Compulsory Body
//      Swap).
//    • Creatures we own but whose host hero is
//      charmed by the opponent (effective
//      control is theirs).
//    • Creatures we've temporarily stolen via
//      Deepsea Succubus (`stolenBy` set).
//
//  Damage amount picker uses the existing
//  `optionPicker` / `renderAs: 'dropdown'`
//  variant — 30 increments of 10 fit cleanly in
//  the dropdown without a tall button stack.
//  Each option's label spells out the gold
//  reward for instant calculation.
//
//  Gold = floor(actual-dealt / 10) where
//  "actual-dealt" comes from the dealt return
//  for hero damage and an HP-delta snapshot for
//  creature damage (creature path has no return
//  value). Defeat detection re-reads the target
//  state AFTER damage — `hp <= 0` for heroes,
//  untracked-or-currentHp-zero for creatures.
//  Reduction sites and omni-immunity (Cardinal
//  Beasts) cleanly produce 0 dealt → 0 gold,
//  matching the card text "damage dealt by this
//  effect".
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Blood-Soaked Coin';
const MAX_DAMAGE = 300;
const STEP = 10;

function permanentlyOwnedHero(hero, pi) {
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.charmedBy != null && hero.charmedBy !== pi) return false;
  return true;
}

function permanentlyOwnedCreature(engine, inst, pi) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.owner !== pi) return false;
  if (inst.stolenBy != null && inst.stolenBy !== pi) return false;
  const host = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  if (!host?.name || host.hp <= 0) return false;
  if (host.charmedBy != null && host.charmedBy !== pi) return false;
  return true;
}

function getCreatureHp(engine, inst) {
  const cd = engine._getCardDB()[inst.name];
  return inst.counters?.currentHp ?? cd?.hp ?? 0;
}

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Artifact-lock honored at the doUseArtifactEffect layer too,
    // mirrored here so the card dims in hand once another lock-
    // setting Artifact has resolved this turn.
    if (ps._artifactLockTurn === gs.turn) return false;

    for (const h of (ps.heroes || [])) {
      if (permanentlyOwnedHero(h, pi)) return true;
    }
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (!permanentlyOwnedCreature(engine, inst, pi)) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const ps = gs.players[pi];
    const targets = [];
    if (!ps) return targets;

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!permanentlyOwnedHero(h, pi)) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero', owner: pi, heroIdx: hi,
        cardName: h.name, ownSupport: true,
      });
    }
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (!permanentlyOwnedCreature(engine, inst, pi)) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst, ownSupport: true,
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a target you permanently control. You will then choose how much damage (up to 300) to deal — gain 1 Gold per 10 damage, or 0 Gold if the target is defeated. Locks Artifacts for the rest of the turn.',
    confirmLabel: '🩸 Strike!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds /*, validTargets */) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  // Default damage flash. Gold-sparkle on the player's side fires
  // separately inside `resolve` only if gold was actually gained.
  animationType: 'explosion',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { cancelled: true };

    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // ── Pick damage amount ─────────────────────────────────────────
    // 10-step increments × 30 = 300 max. Dropdown variant keeps the
    // panel compact; each option label previews the gold reward.
    const options = [];
    for (let dmg = STEP; dmg <= MAX_DAMAGE; dmg += STEP) {
      options.push({
        id: `dmg-${dmg}`,
        label: `${dmg} damage  →  ${dmg / STEP} Gold (if survives)`,
      });
    }
    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      renderAs: 'dropdown',
      title: CARD_NAME,
      description: `How much damage should ${target.cardName} take? (1 Gold per 10 damage; 0 Gold if it dies.)`,
      options,
      confirmLabel: '🩸 Strike!',
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.optionId) return { cancelled: true };
    const damage = parseInt(choice.optionId.replace('dmg-', ''), 10);
    if (!Number.isFinite(damage) || damage <= 0) return { cancelled: true };

    // ── Apply damage; track actual-dealt for the gold formula ─────
    let dealt = 0;
    let defeated = false;

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || hero.hp <= 0) return { cancelled: true };
      const result = await engine.actionDealDamage(
        { name: CARD_NAME, owner: pi },
        hero, damage, 'other',
      );
      dealt = result?.dealt || 0;
      defeated = !hero.name || hero.hp <= 0;
    } else if (target.cardInstance) {
      const inst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
      if (!inst || inst.zone !== 'support') return { cancelled: true };
      const beforeHp = getCreatureHp(engine, inst);
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi },
        inst, damage, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
      // `actionDealCreatureDamage` doesn't return — derive dealt
      // from the HP delta (or full beforeHp if the instance is no
      // longer tracked, which only happens on defeat).
      const stillThere = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
      if (stillThere) {
        const afterHp = getCreatureHp(engine, stillThere);
        dealt = Math.max(0, beforeHp - afterHp);
        defeated = afterHp <= 0;
      } else {
        dealt = beforeHp;
        defeated = true;
      }
    }

    // ── Award gold (zeroed on defeat) ─────────────────────────────
    let goldGained = 0;
    if (!defeated && dealt > 0) {
      goldGained = Math.floor(dealt / STEP);
      if (goldGained > 0) {
        await engine.actionGainGold(pi, goldGained);
        // Gold sparkle on the player's first alive hero — purely
        // cosmetic, mirrors Fiona's gain-gold flourish.
        const sparkleHi = (ps.heroes || []).findIndex(h => h?.name && h.hp > 0);
        if (sparkleHi >= 0) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'gold_sparkle', owner: pi, heroIdx: sparkleHi, zoneSlot: -1,
          });
        }
      }
    }

    // ── Artifact-lock for the rest of the turn ────────────────────
    // Same self-expiring flag Boomerang installs — checked across
    // doPlayArtifact / doUseArtifactEffect / chain reaction window /
    // pre-damage hand reaction window. Auto-clears at turn rollover.
    ps._artifactLockTurn = gs.turn;

    engine.log('blood_soaked_coin', {
      player: ps.username, target: target.cardName,
      requested: damage, dealt, defeated, gold: goldGained,
    });
    engine.sync();
    return true;
  },
};
