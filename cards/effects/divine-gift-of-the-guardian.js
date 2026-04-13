// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of the Guardian"
//  Spell (Reaction, Magic Arts Lv0)
//  Once per game (Divine Gift key).
//
//  Triggers from hand when 1+ of the player's
//  Creatures would take any damage. Negates
//  that damage and grants ALL the player's
//  Creatures complete damage immunity until
//  the start of the player's next turn
//  (after status damage processing).
//
//  Only blocks damage — other effects (stun,
//  poison, etc.) still apply normally.
//
//  Visual: red shield bubble on protected
//  creatures (like Nao's overheal barrier).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hand'],
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      // Check if any entries target this player's creatures with negatable damage
      const myEntries = entries.filter(e =>
        !e.cancelled && (e.inst.controller ?? e.inst.owner) === pi
      );
      if (myEntries.length === 0) return;

      // Only trigger if at least one entry has negatable damage
      const negatableEntries = myEntries.filter(e => e.canBeNegated !== false);
      if (negatableEntries.length === 0) return;

      // Once per game check
      if (ps._oncePerGameUsed?.has('divineGift')) return;

      // Prompt the player to play this card
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Divine Gift of the Guardian',
        message: `${myEntries.length} of your Creature${myEntries.length > 1 ? 's' : ''} would take damage! Negate it and grant all your Creatures damage immunity?`,
        confirmLabel: '🛡️ Protect!',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed || confirmed.cancelled) return;

      // Mark once per game
      if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
      ps._oncePerGameUsed.add('divineGift');

      // Remove from hand and discard
      const handIdx = ps.hand.indexOf('Divine Gift of the Guardian');
      if (handIdx >= 0) {
        ps.hand.splice(handIdx, 1);
        if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
        ps.discardPile.push('Divine Gift of the Guardian');
      }

      // Untrack hand instance
      const handInst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === 'Divine Gift of the Guardian'
      );
      if (handInst) engine._untrackCard(handInst.id);

      // Reveal card to opponent
      const oi = pi === 0 ? 1 : 0;
      engine._broadcastEvent('card_reveal', { cardName: 'Divine Gift of the Guardian', playerIdx: pi });
      engine.log('card_played', { player: ps.username, card: 'Divine Gift of the Guardian', cardType: 'Spell' });

      // Cancel all negatable damage entries targeting this player's creatures
      // True damage (canBeNegated: false) pierces guardian protection
      for (const e of myEntries) {
        if (e.canBeNegated !== false) e.cancelled = true;
      }

      // Apply guardian immunity to ALL player's creatures
      const expiresAtTurn = gs.turn + (gs.activePlayer === pi ? 2 : 1);
      const cardDB = engine._getCardDB();

      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !cd.cardType?.includes('Creature')) continue;

        // Set immunity counter
        inst.counters._guardianImmune = true;

        // Add buff with timed expiry (after status damage, like cloudy)
        if (!inst.counters.buffs) inst.counters.buffs = {};
        inst.counters.buffs.guardian = {
          expiresAtTurn,
          expiresForPlayer: pi,
          clearCountersOnExpire: ['_guardianImmune'],
          source: 'Divine Gift of the Guardian',
        };

        // Red shield animation on each creature
        engine._broadcastEvent('play_zone_animation', {
          type: 'guardian_shield',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          zoneSlot: inst.zoneSlot,
        });
      }

      engine.log('divine_gift_guardian', {
        player: ps.username,
        creaturesProtected: engine.cardInstances.filter(c =>
          c.zone === 'support' && (c.controller ?? c.owner) === pi && c.counters._guardianImmune
        ).length,
      });
      engine.sync();
    },
  },
};
