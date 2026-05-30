// ═══════════════════════════════════════════
//  CARD EFFECT: "Smug Coin"
//  Artifact (Equipment, 10 Gold) — Equip to
//  a Hero. When lethal damage from an opponent's
//  source or a status effect (Burn, Poison)
//  would drop the equipped Hero to 0 HP, cap
//  at 1 HP instead. Then delete this card.
//
//  Only 1 Smug Coin can be played per game.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  oncePerGame: true,

  // Generic lethal-damage protection. The engine's damage pipeline
  // (`actionDealDamage`) scans every support-zone instance attached
  // to the target Hero whose script exports `lethalProtection`,
  // BEFORE the pre-damage hand reaction window. Higher `priority`
  // resolves first; the loop stops as soon as damage drops below
  // lethal.
  //
  // Contract:
  //   • `appliesTo(engine, { target, source, type, amount,
  //      targetOwner, heroIdx })` — predicate. Return falsy to skip.
  //   • `onTrigger(engine, inst, params)` — returns null OR
  //     { newAmount?: number, consumeSelf?: bool }. `newAmount`
  //     overrides hookCtx.amount in-place; `consumeSelf` deletes
  //     this protector to the original-owner's deleted pile.
  lethalProtection: {
    priority: 0,
    appliesTo(engine, { target, source, type, amount, targetOwner }) {
      if (amount < target.hp) return false;
      const dmgSrcOwner = source?.owner ?? source?.controller ?? -1;
      const isOpponentDamage = dmgSrcOwner >= 0 && dmgSrcOwner !== targetOwner;
      const isStatusDamage = dmgSrcOwner < 0 && (
        type === 'fire' || type === 'poison'
        || source?.name === 'Burn' || source?.name === 'Poison'
      );
      return isOpponentDamage || isStatusDamage;
    },
    onTrigger(engine, inst, { target, targetOwner, heroIdx }) {
      engine.log('smug_coin_save', {
        target: engine._heroLabel(target),
        player: engine.gs.players[targetOwner]?.username,
      });
      engine._broadcastEvent('smug_coin_save', { owner: targetOwner, heroIdx });
      return {
        newAmount: Math.max(0, target.hp - 1),
        consumeSelf: true,
      };
    },
  },
};
