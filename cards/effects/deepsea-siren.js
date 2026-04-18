// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Siren"
//  Creature (Summoning Magic Lv2) — 100 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: choose any target on the board.
//  • Any damage this Siren takes is also
//    applied to that target.
//  • When this Siren is defeated by an
//    opponent's card/effect, also defeat the
//    chosen target.
//
//  Implementation notes:
//    • The link is stored on the Siren's
//      counters (_sirenLinkType / _sirenLinkOwner
//      / _sirenLinkHeroIdx / _sirenLinkSlotIdx).
//      Both Siren and linked target also get
//      `sirenLinked = 1` + a partner-name counter
//      so the "Linked" StatusBadge renders on
//      both cards and its tooltip names the
//      partner.
//    • Damage forwarding runs in
//      beforeCreatureDamageBatch (NOT afterDamage
//      / afterCreatureDamageBatch) so the hook
//      fires while Siren is still tracked. For
//      creature-linked targets we push a mirror
//      entry into the same batch; for hero-linked
//      targets we deal true damage inline. If
//      this hit would kill Siren AND the source
//      is an opponent, the mirror is upgraded to
//      lethal so the linked target dies alongside
//      Siren.
//    • onCardLeaveZone fires for non-damage
//      destruction paths (Poltergeister etc.) and
//      cleans up the linked-target flags there.
//      For damage death the flags are cleared
//      inside the batch hook at the moment the
//      mirror fires. 1 per turn.
// ═══════════════════════════════════════════

const {
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  tryBouncePlace,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Siren';

function _resolveLinkedTarget(engine, inst) {
  const c = inst.counters || {};
  if (c._sirenLinkType === 'hero') {
    const hero = engine.gs.players[c._sirenLinkOwner]?.heroes?.[c._sirenLinkHeroIdx];
    if (hero?.name && hero.hp > 0) return { type: 'hero', hero, owner: c._sirenLinkOwner, heroIdx: c._sirenLinkHeroIdx };
    return null;
  }
  if (c._sirenLinkType === 'creature') {
    const linkedInst = engine.cardInstances.find(x =>
      x.owner === c._sirenLinkOwner && x.zone === 'support' &&
      x.heroIdx === c._sirenLinkHeroIdx && x.zoneSlot === c._sirenLinkSlotIdx
    );
    if (linkedInst && linkedInst.id !== inst.id) {
      return { type: 'creature', inst: linkedInst, owner: c._sirenLinkOwner };
    }
    return null;
  }
  return null;
}

function _fireMusicNotes(engine, inst) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'music_notes', owner: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
}

function _fireMusicNotesHero(engine, owner, heroIdx) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'music_notes', owner, heroIdx, zoneSlot: -1,
  });
}

function _clearLinkFlags(engine, linked) {
  if (!linked) return;
  if (linked.type === 'creature') {
    const c = linked.inst.counters;
    if (c) {
      delete c.sirenLinked;
      delete c._sirenLinkedToName;
    }
  } else if (linked.type === 'hero') {
    if (linked.hero.statuses) {
      delete linked.hero.statuses.sirenLinked;
    }
  }
}

module.exports = {
  activeIn: ['support'],
  inherentAction: inherentActionIfBounceable,
  canBypassLevelReq: canBypassLevelReqIfBounceable,
  canBypassFreeZoneRequirement: canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlot: canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargets: getBouncePlacementTargetsList,
  beforeSummon: tryBouncePlace,
  canSummon: (ctx) => canSummonPerTurnLimit(ctx, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      markSummonedPerTurnLimit(ctx, CARD_NAME);

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'],
        title: CARD_NAME,
        description: 'Link to any target. Damage you take will hit them; their defeat follows yours.',
        confirmLabel: '🎵 Link!',
        confirmClass: 'btn-info',
        cancellable: true,
        excludeSelf: true,
      });
      if (!target) return;

      const engine = ctx._engine;
      const selfInst = ctx.card;
      const c = selfInst.counters;

      // Siren's own link flags — lets the Linked badge paint on this
      // Siren with the partner's name in the tooltip.
      c.sirenLinked = 1;
      c._sirenLinkedToName = target.cardName;

      if (target.type === 'hero') {
        c._sirenLinkType = 'hero';
        c._sirenLinkOwner = target.owner;
        c._sirenLinkHeroIdx = target.heroIdx;
        const heroObj = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (heroObj) {
          heroObj.statuses = heroObj.statuses || {};
          heroObj.statuses.sirenLinked = { partnerName: CARD_NAME };
        }
      } else if (target.cardInstance) {
        c._sirenLinkType = 'creature';
        c._sirenLinkOwner = target.cardInstance.owner;
        c._sirenLinkHeroIdx = target.cardInstance.heroIdx;
        c._sirenLinkSlotIdx = target.cardInstance.zoneSlot;
        target.cardInstance.counters = target.cardInstance.counters || {};
        target.cardInstance.counters.sirenLinked = 1;
        target.cardInstance.counters._sirenLinkedToName = CARD_NAME;
      }

      // Music notes on both sides so the linkage is visually announced.
      _fireMusicNotes(engine, selfInst);
      if (target.type === 'hero') {
        _fireMusicNotesHero(engine, target.owner, target.heroIdx);
      } else if (target.cardInstance) {
        _fireMusicNotes(engine, target.cardInstance);
      }

      engine.log('deepsea_siren_link', {
        target: target.cardName, linkedBy: engine.gs.players[ctx.cardOwner]?.username,
      });
      engine.sync();
    },

    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const selfInst = ctx.card;
      const entries = ctx.entries || [];
      if (entries.length === 0) return;

      // Iterate a snapshot so mirror entries we push don't re-trigger.
      const snapshot = [...entries];
      for (const e of snapshot) {
        if (!e.inst || e.inst.id !== selfInst.id) continue;
        if (e.cancelled) continue;
        const amount = e.amount || 0;
        if (amount <= 0) continue;

        const linked = _resolveLinkedTarget(engine, selfInst);
        if (!linked) continue;

        const sourceOwner = e.sourceOwner ?? -1;
        const isEnemy = sourceOwner >= 0 && sourceOwner !== selfInst.owner;
        const currentHp = selfInst.counters.currentHp ?? 0;
        const willDie = currentHp - amount <= 0;

        // Music-note flourish on both cards each time Siren takes a hit.
        _fireMusicNotes(engine, selfInst);
        if (linked.type === 'creature') _fireMusicNotes(engine, linked.inst);
        else _fireMusicNotesHero(engine, linked.owner, linked.heroIdx);

        // Mirror damage to the linked target.
        if (linked.type === 'creature') {
          // Initialize currentHp on the mirrored entry's inst the same way
          // the batch loop initialized the original entries, so the newly-
          // appended entry's damage math doesn't NaN.
          if (!linked.inst.counters.currentHp) {
            const cd = engine._getCardDB()[linked.inst.name];
            linked.inst.counters.currentHp = linked.inst.counters.maxHp ?? cd?.hp ?? 0;
          }
          const linkedHp = linked.inst.counters.currentHp ?? 1;
          // If the hit kills Siren AND was from an opponent, escalate the
          // mirror to a lethal amount so the linked creature dies too.
          const mirrorAmount = (willDie && isEnemy) ? Math.max(amount, linkedHp) : amount;
          entries.push({
            inst: linked.inst,
            amount: mirrorAmount,
            type: e.type || 'other',
            source: selfInst,
            sourceOwner: selfInst.owner,
            canBeNegated: false, // true damage, bypasses gate / immunity / buffs
          });
        } else if (linked.type === 'hero') {
          await ctx.dealTrueDamage(linked.hero, amount, e.type || 'other');
          if (willDie && isEnemy && linked.hero.hp > 0) {
            await ctx.dealTrueDamage(linked.hero, linked.hero.hp, 'creature');
          }
        }

        // If Siren is about to die, the linked target's "Linked" badge
        // becomes stale — clear it now since onCardLeaveZone won't fire
        // on an untracked Siren.
        if (willDie) {
          _clearLinkFlags(engine, linked);
        }

        engine.log('siren_link_mirror', {
          siren: selfInst.name, target: linked.type === 'hero' ? linked.hero.name : linked.inst.name,
          amount, willDie, isEnemy,
        });
      }
    },

    // Fires only for non-damage destruction paths (Poltergeister, Silver
    // Bell, etc.) — in the damage path Siren is untracked before
    // onCardLeaveZone runs, so we clean up there instead (above). This
    // covers the destroy-without-damage case so the linked target's
    // badge doesn't linger after Siren vanishes.
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      const selfInst = ctx.card;
      if (selfInst.id !== ctx.leavingCard?.id && selfInst.id !== ctx.card?.id) return;
      const linked = _resolveLinkedTarget(ctx._engine, selfInst);
      if (linked) _clearLinkFlags(ctx._engine, linked);
    },
  },
};
