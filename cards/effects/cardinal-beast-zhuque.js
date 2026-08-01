// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Zhuque"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Choose a target and Burn it.
//  If Hero, also burn all Creatures in its
//  Support Zones.
// ═══════════════════════════════════════════

const { _checkCardinalWin, _setCardinalImmune } = require('./_cardinal-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  // ── CPU: Ziel-Intercept (Shield-of-Life-Klasse) ──────────────────
  // Cancellable Utility-Ziel ohne baseDamage fällt sonst auf den
  // Engine-Decline durch. Politik: Burn auf GEGNER-Held (brennt dessen Kreaturen mit)
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const vt = payload?.validTargets || [];
    if (vt.length === 0) return undefined;
    const pi = payload.playerIdx;
    const oi = pi === 0 ? 1 : 0;
    const enemyHeroes = vt.filter(t => String(t.id || t).startsWith('hero-' + oi));
    const pick = enemyHeroes[0] || vt[0];
    return [typeof pick === 'object' ? pick.id : pick];
  },


  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // Cardinal Beasts are signature win-condition pieces — their once-per-
  // turn actives are FREE permanent control reductions on the opponent's
  // side (burn that never expires here, instant 1HP for Xuanwu's revives,
  // Qinglong's chain, Baihu's freeze). The eval can underweight a single
  // burn against the +3 commit threshold for `mctsGatedActivation`,
  // skipping the activation when it's clearly correct to fire it. Force-
  // commit whenever `canActivateCreatureEffect` returns true (which
  // already gates "is there a non-burned target?") so the CPU always
  // uses the active when possible.
  cpuMeta: { alwaysCommit: true },

  hooks: {
    onPlay: async (ctx) => { _setCardinalImmune(ctx); },
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.name?.startsWith('Cardinal Beast')) await _checkCardinalWin(ctx);
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const ops = gs.players[oppIdx];
    if (!ops) return false;

    // Must have 1+ non-burned target
    for (const hero of (ops.heroes || [])) {
      if (hero?.name && hero.hp > 0 && !hero.statuses?.burned) return true;
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (!inst.counters.burned) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const heroIdx = ctx.cardHeroIdx;

    // Build targets: opponent's non-burned heroes and creatures
    const targets = [];
    const ops = gs.players[oppIdx];
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.burned) continue;
      targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
    }
    const cardDB = engine._getCardDB();
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (inst.counters.burned) continue;
      const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({
        id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: oppIdx, heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
      });
    }
    if (targets.length === 0) return false;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Cardinal Beast Zhuque',
      description: 'Choose a target to Burn permanently.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const picked = targets.find(t => t.id === selectedIds[0]);
    if (!picked) return false;

    // Flame animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike', owner: picked.owner,
      heroIdx: picked.heroIdx, zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
    });
    await engine._delay(400);

    if (picked.type === 'hero') {
      const hero = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
      if (hero && hero.hp > 0 && !hero.statuses?.burned) {
        await engine.addHeroStatus(picked.owner, picked.heroIdx, 'burned', { permanent: true });
      }
      // Also burn all creatures in this hero's support zones. PHYSICAL
      // side identifies which player's board the slot is on — stolen
      // creatures stay on owner's side; cross-side-placed creatures
      // (Chilly Wizard) sit on the controller's side.
      for (const inst of engine.cardInstances) {
        const physSide = inst.stolenBy != null
          ? inst.owner
          : (inst.controller ?? inst.owner);
        if (physSide !== picked.owner || inst.zone !== 'support' || inst.heroIdx !== picked.heroIdx) continue;
        if (inst.faceDown) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        const applied = await engine.applyCreatureStatus(inst, 'burned', {
          sourceOwner: pi,
          source: 'Cardinal Beast Zhuque',
        });
        if (applied) engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Cardinal Beast Zhuque' });
      }
    } else if (picked.cardInstance) {
      const applied = await engine.applyCreatureStatus(picked.cardInstance, 'burned', {
        sourceOwner: pi,
        source: 'Cardinal Beast Zhuque',
      });
      if (applied) engine.log('creature_burned', { card: picked.cardName, owner: picked.owner, by: 'Cardinal Beast Zhuque' });
    }

    engine.log('zhuque_burn', { player: gs.players[pi]?.username, target: picked.cardName });
    engine.sync();
    return true;
  },
};
