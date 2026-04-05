// ═══════════════════════════════════════════
//  CARD EFFECT: "[CARD NAME]"
//  [Card Type] — [Brief description]
//
//  [Detailed rules text]
// ═══════════════════════════════════════════

// Uncomment if needed:
// const { loadCardEffect } = require('./_loader');

module.exports = {

  // ══════════════════════════════════════════
  //  STEP 1: Card Type (pick ONE primary type)
  // ══════════════════════════════════════════

  // actionCost: true,           // Ability — consumes an action when activated
  // freeActivation: true,       // Ability — free activation (no action cost)
  // isPotion: true,             // Potion card
  // isEquip: true,              // Equipment artifact (placed in Support Zone)
  // isTargetingArtifact: true,  // Non-equip artifact with targeting UI
  // isReaction: true,           // Reaction/Surprise card
  // heroEffect: true,           // Hero with activatable effect

  // ══════════════════════════════════════════
  //  STEP 2: Optional Flags
  // ══════════════════════════════════════════

  // activeIn: ['ability'],      // Zones where hooks fire (default: all)
  // oncePerGame: true,          // Can only be played once per game
  // oncePerGameKey: 'shared',   // Cards with same key share the once-per-game restriction
  // inherentAction: true,       // Playable in Main Phase without additional action
  // isWildcardAbility: true,    // Counts as any spell school when stacked on an ability
  // potionLockAfterN: 2,        // Hero flag: lock potions after N uses per turn
  // manualGoldCost: true,       // Handle own gold deduction in resolve()
  // deferBroadcast: true,       // Don't reveal card to opponent before resolution
  // animationType: 'explosion', // Post-resolve animation ('none' to skip)

  // ══════════════════════════════════════════
  //  STEP 3A: Ability Handlers
  //  (for actionCost / freeActivation)
  // ══════════════════════════════════════════

  // // Optional: extra activation condition
  // canActivateAction(gs, pi, heroIdx, level, engine) {
  //   return true;
  // },

  // onActivate: async (ctx, level) => {
  //   // level = number of cards in the ability stack
  //   // Example: gain gold based on level
  //   await ctx.gainGold(10 * level);
  //   ctx.log('my_card_activated', { hero: ctx.heroName(), level });
  // },

  // ══════════════════════════════════════════
  //  STEP 3B: Potion / Artifact Handlers
  //  (for isPotion / isTargetingArtifact)
  // ══════════════════════════════════════════

  // canActivate(gs, playerIdx) {
  //   return this.getValidTargets(gs, playerIdx).length > 0;
  // },

  // getValidTargets(gs, playerIdx) {
  //   const targets = [];
  //   // Build target objects: { id, type, owner, heroIdx, slotIdx?, cardName }
  //   // type: 'hero', 'ability', 'equip', 'surprise'
  //   return targets;
  // },

  // targetingConfig: {
  //   description: 'Select a target.',
  //   confirmLabel: '✨ Activate!',
  //   confirmClass: 'btn-danger',  // btn-danger, btn-info, btn-success
  //   cancellable: true,
  //   exclusiveTypes: true,        // Can't mix target types
  //   maxPerType: { hero: 1 },
  // },

  // validateSelection(selected, validTargets) {
  //   return selected.length === 1;
  // },

  // async resolve(engine, playerIdx, selectedIds, validTargets) {
  //   const target = validTargets.find(t => t.id === selectedIds[0]);
  //   if (!target) return;
  //   // Do effect...
  //   engine.sync();
  // },

  // ══════════════════════════════════════════
  //  STEP 3C: Hero Effect Handlers
  //  (for heroEffect)
  // ══════════════════════════════════════════

  // canActivateHeroEffect(ctx) { return true; },
  // onHeroEffect: async (ctx) => { /* ... */ },

  // ══════════════════════════════════════════
  //  STEP 4: Reactive Hooks
  //  (for any card type — fire on game events)
  // ══════════════════════════════════════════

  hooks: {
    // ── Game Flow ──
    // onGameStart: async (ctx) => {},
    // onTurnStart: async (ctx) => {},
    // onTurnEnd: async (ctx) => {},

    // ── Card Lifecycle ──
    // onPlay: async (ctx) => {},
    // onCardEnterZone: async (ctx) => {},
    // onCardLeaveZone: async (ctx) => {},

    // ── Combat ──
    // beforeDamage: async (ctx) => {
    //   // Modify damage: ctx.modifyAmount(-10), ctx.setAmount(0), ctx.cancel()
    // },
    // afterDamage: async (ctx) => {},
    // onHeroKO: async (ctx) => {},

    // ── Actions ──
    // onActionUsed: async (ctx) => {},
  },
};
