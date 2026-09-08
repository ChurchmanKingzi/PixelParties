// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Coolness"
//  Attack (Fighting Lv1, Attachment)
//
//  Inherent unconditional additional Action.
//  Once per game (Divine Gift restriction).
//
//  Places itself in a Hero's free Support Zone.
//  Player can click a Hero (first free zone)
//  or directly click an empty zone.
//
//  Card appears on board immediately on selection,
//  THEN the sunglasses animation plays.
//
//  The Hero becomes permanently immune to all
//  negative status effects and is cleansed.
//
//  The card is immovable — cannot be removed,
//  destroyed, bounced, or moved by any effect.
// ═══════════════════════════════════════════

const { getNegativeStatuses } = require('./_hooks');
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const CARD_NAME = 'Divine Gift of Coolness';

module.exports = {
  activeIn: ['hand', 'support'],
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine); },
  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      // v650: Anlegen ueber den geteilten Vorgang (eigene Seite, Anti-
      // Magic-Schutz — bisher hier nicht geprueft; jetzt wie ueberall).
      const res = await attachToHero(ctx, CARD_NAME, {
        description: 'Select a Hero or Support Zone to bless with Coolness.',
        confirmLabel: '😎 Be Cool!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const targetHeroIdx = host.heroIdx, targetSlot = host.slotIdx;
      const hero = ps.heroes[targetHeroIdx];
      inst.counters.immovable = true;
      engine.sync();

      // ── Play sunglasses animation AFTER card is visible (on the Hero, not the zone) ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'sunglasses_drop', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1800);

      // ── Apply negative_status_immune buff ──
      await engine.actionAddBuff(hero, pi, targetHeroIdx, 'negative_status_immune', {
        source: 'Divine Gift of Coolness',
        permanent: true,
      });

      // ── Cleanse all existing negative statuses ──
      const negKeys = getNegativeStatuses();
      engine.cleanseHeroStatuses(hero, pi, targetHeroIdx, negKeys, 'Divine Gift of Coolness');

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('divine_gift_coolness', {
        player: ps.username, hero: hero.name, slot: targetSlot,
      });
      engine.sync();
    },
  },
};
