// ═══════════════════════════════════════════
//  CARD EFFECT: "Hammer Throw"
//  Attack (Fighting Lv1, Normal)
//
//  Deal damage equal to attacker's ATK stat.
//  If the attack is not negated, the target's
//  controller is Itemlocked (cannot use
//  Artifacts from hand) for the rest of their
//  next turn.
//  Does NOT apply on Turn 1.
//
//  Animation: spinning hammer projectile →
//  impact slash on target.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atk = hero.atk || 0;

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: 'Hammer Throw',
        description: `Deal ${atk} ATK damage. Locks the target's controller from using Artifacts next turn.`,
        confirmLabel: `🔨 Throw! (${atk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // projectile + impact + damage. Listeners may mutate the
      // about-to-deal damage.
      const attackSource = { name: 'Hammer Throw', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const finalAtk = await engine._fireAttackDeclare(attackSource, target, atk);

      // Spinning hammer projectile animation
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '🔨',
        emojiStyle: { animation: 'hammerSpin 300ms linear infinite', fontSize: 28 },
        duration: 500,
      });
      await engine._delay(450);

      // Impact animation
      const impactSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'quick_slash', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(150);

      // Deal ATK damage
      let negated = false;

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalAtk, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalAtk, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Apply Itemlock to target's controller (not on turn 1)
      if ((gs.turn || 1) > 1) {
        const oppIdx = tgtOwner;
        const oppPs = gs.players[oppIdx];
        if (oppPs) {
          // ── "A player can only be affected by this effect every other
          //    turn." (1.8. nachgetragen — die Klausel war nie
          //    implementiert, nur die Turn-1-Ausnahme.) ──────────────
          // Belegt in Als Mitschnitt: `item_locked` in den Zügen 3, 5
          // und 7, also in DREI aufeinanderfolgenden Zügen desselben
          // Angreifers.
          //
          // Die Züge wechseln sich ab und `gs.turn` zählt je Spielerzug
          // um 1 hoch — die Runden EINES Spielers haben also immer
          // dieselbe Parität und liegen 2 auseinander. Der Lock trifft
          // die Runde nach dem Wurf; damit das Opfer dazwischen eine
          // freie eigene Runde hat, müssen zwischen zwei Anwendungen
          // mindestens 4 gezählt werden (Wurf in Zug 3 sperrt Zug 4,
          // nächster erlaubter Wurf in Zug 7 sperrt Zug 8).
          const last = oppPs._hammerLockTurn;
          if (last != null && (gs.turn - last) < 4) {
            engine.log('item_lock_blocked', {
              player: oppPs.username, by: 'Hammer Throw',
              reason: 'every-other-turn', lastAppliedTurn: last,
            });
          } else {
            oppPs._hammerLockTurn = gs.turn;
            oppPs.itemLocked = true;
            engine.log('item_locked', {
              player: oppPs.username, by: 'Hammer Throw',
            });
          }
        }
      }

      engine.log('hammer_throw', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage: finalAtk,
      });
      engine.sync();
    },
  },
};
