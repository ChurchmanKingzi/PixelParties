// ═══════════════════════════════════════════
//  CARD EFFECT: "Light Ball"
//  Spell (Support Magic Lv 2, Attachment).
//
//  "Attach this card to a Hero you control. While
//   you control a Hero with this card attached to
//   it, all other targets you control are immune
//   to all negative status effects. Heal all
//   other targets you control from all negative
//   status effects when this card is attached to
//   a Hero you control."
//
//  Implementation
//  ──────────────
//  • Same Attachment shape as Curse / Gathering
//    Storm / Invisibility — the Spell self-places
//    into a free Support Zone of the chosen own
//    Hero. The card sitting in the Support Zone
//    is the only state the engine needs; the
//    immunity gate (engine-side, in
//    `actionAddStatus` / `addHeroStatus` /
//    `canApplyCreatureStatus`) looks for any
//    "Light Ball" in any of the controller's
//    Support Zones via `_lightBallProtects`.
//  • Anti Magic gate at cast time (Lv 2 Spell —
//    Anti Magic Lv 2+ on the chosen Host covers
//    it).
//  • On attach, every OTHER own target (other
//    Heroes + every face-up Creature on the
//    caster's side) is cleansed of every
//    cleansable negative status. The host Hero is
//    NOT cleansed (own card text — "all OTHER
//    targets").
//  • No card-side hook handles the persistent
//    protection — the engine gates are
//    sufficient. When Light Ball leaves the
//    Support Zone (Fire Bomb, Cosmic
//    Manipulation, …), the gates auto-fail and
//    the protection disappears. No cleanup hook
//    needed.
//  • Visual: while Light Ball is in a Hero's
//    Support Zone, the client renders a soft
//    warm-yellow `LightBallAura` overlay on that
//    Hero (CSS-only pulse via
//    `.status-light-ball-aura`).
//
//  ── Johanna comparison ──
//  Johanna covers HEROES only and is silenced by
//  CC on Johanna herself. Light Ball covers
//  HEROES AND CREATURES, and the protection
//  persists through CC on the host — Support-
//  Zone Attachments aren't silenced by hero CC
//  the way hero/ability listeners are. This
//  matches the cards' respective sources of
//  power: Johanna's protection IS a Hero passive
//  (and so dies with her CC); Light Ball's
//  protection is the SPELL's effect (and the
//  Spell doesn't care if its host is Frozen).
// ═══════════════════════════════════════════

const { getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Light Ball';

/** First free Support Zone slot on `heroIdx` of `ps`, or -1. */
function findFreeSlot(ps, heroIdx) {
  const sz = ps.supportZones?.[heroIdx] || [];
  for (let si = 0; si < 3; si++) {
    if (((sz[si] || []).length) === 0) return si;
  }
  return -1;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — the Spell opens a Hero picker.
  activeIn: ['hand', 'support'],

  /**
   * Playable iff at least one own living Hero has a free Support
   * Zone slot to host the Attachment.
   */
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (findFreeSlot(ps, hi) >= 0) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Build target list ──
      // For each own living Hero with at least one free Support slot,
      // add BOTH the Hero card itself AND each of their empty Support
      // slots as separate clickable targets. Clicking the Hero
      // auto-attaches to that Hero's leftmost free slot
      // (`_autoSlot`); clicking a specific empty slot attaches there
      // directly. Same shape Modnir / Bill / Curse / Berserk all use.
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const slots = ps.supportZones?.[hi] || [];
        let leftmostFree = -1;
        for (let si = 0; si < 3; si++) {
          if (!slots[si] || slots[si].length === 0) {
            if (leftmostFree < 0) leftmostFree = si;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi, heroIdx: hi, slotIdx: si,
              cardName: '',
            });
          }
        }
        if (leftmostFree >= 0) {
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi, heroIdx: hi,
            cardName: hero.name,
            _autoSlot: leftmostFree,
          });
        }
      }
      if (targets.length === 0) { gs._spellCancelled = true; return; }

      let destHero;
      let destSlot;
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[casterHeroIdx] || [])[si] || [];
        if (slot.length === 0) { destHero = casterHeroIdx; destSlot = si; }
      }
      if (destHero == null) {
        let picked;
        const heroOnlyTargets = targets.filter(t => t.type === 'hero');
        const zoneOnlyTargets = targets.filter(t => t.type === 'equip');
        // Auto-resolve when there's exactly one Hero with one free
        // slot (single legal placement on either click). The picker
        // would otherwise show one Hero + one slot redundantly.
        if (heroOnlyTargets.length === 1 && zoneOnlyTargets.length === 1) {
          picked = heroOnlyTargets[0];
        } else {
          // `engine.promptEffectTarget` is the correct call —
          // `ctx.promptEffectTarget` doesn't exist (the ctx wrapper
          // only exposes `promptTarget` / `promptDamageTarget` /
          // `promptMultiTarget`). Curse / Gathering Storm / Divine
          // Zeal all use the engine path.
          const result = await engine.promptEffectTarget(pi, targets, {
            title: CARD_NAME,
            description: 'Choose one of your Heroes (auto-leftmost-free slot) or click a specific empty Support Zone.',
            confirmLabel: '✨ Attach!',
            confirmClass: 'btn-success',
            cancellable: true,
            exclusiveTypes: true,
            maxPerType: { hero: 1, equip: 1 },
            maxTotal: 1,
            greenSelect: true,
          });
          if (!result || result.length === 0) { gs._spellCancelled = true; return; }
          picked = targets.find(t => t.id === result[0]);
          if (!picked) { gs._spellCancelled = true; return; }
        }
        destHero = picked.heroIdx;
        destSlot = picked.type === 'hero' ? picked._autoSlot : picked.slotIdx;
        if (destSlot == null || destSlot < 0) { gs._spellCancelled = true; return; }
      }

      // ── Anti Magic gate ──
      // Lv 2 Spell — Anti Magic Lv 2+ on the host covers it. Bail
      // BEFORE the support-zone push so the server's standard
      // post-resolve path routes the card to the caster's discard.
      const destHeroObj = ps.heroes?.[destHero];
      if (destHeroObj && engine._isHeroSpellProtected(destHeroObj, CARD_NAME)) {
        engine.log('equip_blocked', {
          card: CARD_NAME, target: destHeroObj.name, reason: 'magic_immune',
        });
        engine._playAntiMagicBlockedAnim(destHeroObj);
        return;
      }

      // ── Attach into the chosen Support Zone ──
      if (!ps.supportZones[destHero]) ps.supportZones[destHero] = [[], [], []];
      if (!ps.supportZones[destHero][destSlot]) ps.supportZones[destHero][destSlot] = [];
      ps.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from hand → support. `originalOwner` stamping routes
      // a future discard back to the caster regardless of any control
      // flip.
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id,
      );
      if (oldInst) engine._untrackCard(oldInst.id);
      const inst = engine._trackCard(CARD_NAME, pi, 'support', destHero, destSlot);
      inst.originalOwner = pi;

      gs._spellPlacedOnBoard = true;

      // Attach burst — warm gold sparkles on the host Hero.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx: destHero, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHero,
        _skipReactionCheck: true,
      });

      // ── On-attach cleanse ──
      // "Heal all other targets you control from all negative status
      // effects" — fires once at attach. Iterates OTHER own Heroes
      // (alive) and every face-up Creature on the caster's side.
      // Uses the engine's standard `cleanseHeroStatuses` /
      // `cleanseCreatureStatuses` helpers so `_viaCleanse`-aware
      // listeners (Curse's onStatusRemoved, Berserk's destroy
      // cascade, …) fire correctly. Each cleansed slot gets a small
      // golden sparkle so the heal reads visually per-target.
      const cleansable = getCleansableStatuses();
      let anyCleansed = false;

      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (hi === destHero) continue;             // host not covered
        const ally = ps.heroes[hi];
        if (!ally?.name || ally.hp <= 0) continue;
        if (!ally.statuses) continue;
        if (!cleansable.some(k => ally.statuses[k])) continue;
        const removed = engine.cleanseHeroStatuses(
          ally, pi, hi, cleansable, CARD_NAME,
        );
        if ((removed || []).length === 0) continue;
        anyCleansed = true;
        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: pi, heroIdx: hi, zoneSlot: -1,
        });
      }

      for (const allyInst of engine.cardInstances) {
        if (allyInst.zone !== 'support') continue;
        if ((allyInst.controller ?? allyInst.owner) !== pi) continue;
        if (allyInst.faceDown) continue;
        // Light Ball itself + Bakhm-attached Surprises aren't
        // creatures — getCleansableCreatureStatusKeys filters them
        // out naturally (it reads inst.counters and the engine's
        // creature-status convention).
        const keys = engine.getCleansableCreatureStatusKeys(allyInst);
        if (keys.length === 0) continue;
        const removed = engine.cleanseCreatureStatuses(
          allyInst, keys, CARD_NAME,
        );
        if ((removed || []).length === 0) continue;
        anyCleansed = true;
        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: allyInst.owner,
          heroIdx: allyInst.heroIdx, zoneSlot: allyInst.zoneSlot,
        });
      }

      if (anyCleansed) {
        engine.log('light_ball_cleanse', { player: ps.username });
        await engine._delay(350);
      }

      engine.log('light_ball_attached', {
        player: ps.username, hero: destHeroObj.name,
      });
      engine.sync();
    },
  },
};
