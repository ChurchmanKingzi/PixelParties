// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti Magic"
//  Spell (Support Magic Lv2, Attachment)
//
//  Attach to any Hero. While Anti Magic is
//  attached to that Hero:
//   • The Hero becomes immune to all OTHER
//     Spells whose level is ≤ X.
//   • X = 1 / 2 / 3 depending on the caster's
//     Support Magic level when Anti Magic
//     resolved (capped at 3).
//   • Detaches all other Spells of level ≤ X
//     already attached to the Hero at resolve
//     time.
//
//  Wiring:
//   • Targeting block lives in the engine's
//     `promptDamageTarget` / `promptMultiTarget`
//     Magic-Immune filter (added alongside
//     this card). Spells gated as `cardType ===
//     'Spell'` and level ≤ buff.level are
//     filtered out of the Hero target list.
//   • `bypassesMagicImmune: true` — Anti Magic
//     itself opts out, so a NEW copy can
//     legally target an already-immune Hero
//     and overwrite the existing buff (matches
//     the "detach all other Spells of level ≤
//     X" clause — a stale Anti Magic gets
//     replaced).
//   • Buff is keyed `magic_immune` and stores
//     `{ level: X, source: 'Anti Magic' }`. The
//     `BuffColumn` tooltip is function-form and
//     reads `data.level` to render the live
//     "immune to Spells up to level X" text.
//   • On leave-zone: clear the buff IF no other
//     Anti Magic remains attached to the same
//     Hero. Multiple copies → buff stays at the
//     HIGHEST X among remaining copies.
//
//  Animation: light barrier flicker on the
//  protected Hero at resolve time.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { candidateHosts, attachmentHostsFor, pickAttachmentHost, placeAttachment } = require('./_attachment-shared');

const CARD_NAME = 'Anti Magic';
const MAX_LEVEL = 3;

/**
 * Compute the level X granted by THIS cast, based on the caster's
 * effective Support Magic level on its host Hero. Capped at MAX_LEVEL.
 */
function computeLevel(engine, pi, heroIdx) {
  const lvl = engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx);
  return Math.max(1, Math.min(MAX_LEVEL, lvl || 1));
}

/**
 * Highest `magic_immune.level` provided by any Anti Magic instance
 * currently attached to (ownerIdx, heroIdx). Returns 0 when none
 * are attached. Used on leave-zone to recompute the buff after one
 * copy departs.
 */
function highestRemainingLevel(engine, ownerIdx, heroIdx, excludeInstId) {
  let best = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== CARD_NAME) continue;
    if (inst.owner !== ownerIdx) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (excludeInstId != null && inst.id === excludeInstId) continue;
    const lvl = inst.counters?.antiMagicLevel || 0;
    if (lvl > best) best = lvl;
  }
  return best;
}

module.exports = {
  activeIn: ['hand', 'support'],
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // Engine target-filter opt-out — Anti Magic ignores its own buff so a
  // new copy can replace a stale one (the "detach all other Spells of
  // level ≤ X" clause).
  bypassesMagicImmune: true,

  // Need at least 1 Hero (any side) with a free Support Zone.
  spellPlayCondition(gs, pi, engine) {
    return candidateHosts(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }); }, // v651: beide Seiten als Drop-Ziel

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const casterHeroIdx = ctx.cardHeroIdx;
      // v650: Wirt ueber den geteilten Anlege-Vorgang (beide Seiten).
      const host = await pickAttachmentHost(ctx, CARD_NAME, {
        sides: [pi, pi === 0 ? 1 : 0],
        description: 'Attach Anti Magic to a Hero. That Hero becomes immune to other Spells up to your Support Magic level.',
        confirmLabel: '🛡️ Attach!', confirmClass: 'btn-info',
      });
      if (!host) return;
      const targetOwner = host.owner, targetHeroIdx = host.heroIdx, targetSlot = host.slotIdx;
      const tps = gs.players[targetOwner];
      const targetHero = tps.heroes[targetHeroIdx];
      if (!targetHero?.name || targetHero.hp <= 0) return;
      const X = computeLevel(engine, pi, casterHeroIdx);

      // ── Detach OTHER Spells of level ≤ X already attached ──
      // Iterate the target's Support Zones; for each face-up Spell
      // (cardType === 'Spell' on a support card) whose level ≤ X,
      // destroy it through the canonical actionDestroyCard path so its
      // onCardLeaveZone hooks fire correctly (e.g. Overheal Shock
      // clears its healReversed status). Skip any Anti Magic instance
      // sitting in the SAME slot we're about to place into (defensive
      // — shouldn't happen since target slot is empty, but safe).
      const cardDB = engine._getCardDB();
      const toDetach = [];
      const targetSupport = tps.supportZones[targetHeroIdx] || [[],[],[]];
      for (let si = 0; si < targetSupport.length; si++) {
        const slot = targetSupport[si] || [];
        if (slot.length === 0) continue;
        const slotTop = slot[slot.length - 1];
        const cd = cardDB[slotTop];
        if (!cd || cd.cardType !== 'Spell') continue;
        if ((cd.level || 0) > X) continue;
        const inst = engine.cardInstances.find(c =>
          c.zone === 'support' && c.owner === targetOwner
          && c.heroIdx === targetHeroIdx && c.zoneSlot === si
          && c.name === slotTop
        );
        if (!inst) continue;
        toDetach.push(inst);
      }
      for (const inst of toDetach) {
        await engine.actionDestroyCard(
          { name: CARD_NAME, owner: pi, heroIdx: casterHeroIdx },
          inst,
        );
      }

      // After detach, the slot we initially chose MAY have shifted —
      // re-check it's still empty (a same-slot Spell we just destroyed
      // landed in that slot). If not, pick the first remaining free
      // slot on the same hero.
      // v650: Platzierung ueber den geteilten Vorgang (Slot-Nachwahl bei
      // belegtem Wunschplatz, Instanz, `_spellPlacedOnBoard`, EnterZone).
      // Anti Magic ist selbst immun gegen den Anti-Magic-Schutz des Wirts
      // (es ERZEUGT ihn) — `skipMagicImmune`.
      const inst = await placeAttachment(ctx, CARD_NAME, { owner: targetOwner, heroIdx: targetHeroIdx, slotIdx: targetSlot }, { skipMagicImmune: true, skipEnterHook: true });
      if (!inst) { gs._spellCancelled = true; return; }
      inst.counters = inst.counters || {};
      inst.counters.antiMagicLevel = X;
      inst.counters.antiMagicCastBy = pi;
      await engine.actionAddBuff(targetHero, targetOwner, targetHeroIdx, 'magic_immune', {
        level: X,
        source: CARD_NAME,
      });

      // Barrier shimmer on the protected Hero
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: targetOwner, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      // Fire enter-zone hook so any listeners on the attached side
      // observe the new support card.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('anti_magic_attached', {
        player: ps.username,
        target: targetHero.name,
        level: X,
        detached: toDetach.map(i => i.name),
      });
      engine.sync();
    },

    // When this Anti Magic leaves the support zone (destroyed,
    // detached by a new Anti Magic, bounced, etc.), recompute the
    // host Hero's magic_immune buff. If another Anti Magic instance
    // remains attached to the same Hero, the buff stays at the
    // HIGHEST X among them; if none remain, the buff is cleared.
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return; // Self-only
      if (ctx.fromZone !== 'support') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const hostOwner = card.owner;
      const hostHeroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hero = gs.players[hostOwner]?.heroes?.[hostHeroIdx];
      if (!hero?.name) return;

      const remaining = highestRemainingLevel(engine, hostOwner, hostHeroIdx, card.id);
      if (remaining > 0) {
        // Refresh the buff to the highest remaining level.
        await engine.actionAddBuff(hero, hostOwner, hostHeroIdx, 'magic_immune', {
          level: remaining,
          source: CARD_NAME,
        });
      } else if (hero.buffs?.magic_immune) {
        await engine.actionRemoveBuff(hero, hostOwner, hostHeroIdx, 'magic_immune', {
          _skipReactionCheck: true,
        });
      }
    },
  },
};
