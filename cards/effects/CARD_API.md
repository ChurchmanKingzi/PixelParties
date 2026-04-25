# Pixel Parties — Card Effect API Reference

Every card with game logic gets a `.js` file in `cards/effects/`.
The filename is derived from the card name: `"Cool Repair"` → `cool-repair.js`.

This document covers **everything** a card script can export and every method
available on the `ctx` object inside hooks.

---

## Quick Start

```js
// cards/effects/my-new-card.js
module.exports = {
  // 1. Declare what kind of card this is (pick one or more flags)
  actionCost: true,

  // 2. Implement the activation handler
  onActivate: async (ctx, level) => {
    const goldGain = 10 * level;
    await ctx.gainGold(goldGain);
    ctx.log('my_card_activated', { hero: ctx.heroName(), gold: goldGain });
  },
};
```

That's it — the engine handles registration, caching, and lifecycle automatically.

---

## Module Exports — Card Type Flags

At least one of these must be present, or the loader will ignore the file.

| Flag | Type | Description |
|------|------|-------------|
| `hooks` | `object` | Map of hook names → handler functions (reactive effects) |
| `effects` | `object` | Chain-based effect definitions (advanced) |
| `actionCost` | `bool` | Ability that consumes an action when activated |
| `freeActivation` | `bool` | Ability that activates without consuming an action |
| `isPotion` | `bool` | Potion card (targeting + resolve flow) |
| `isEquip` | `bool` | Equipment artifact (placed in Support Zone) |
| `isTargetingArtifact` | `bool` | Non-equip artifact with a targeting UI |
| `isReaction` | `bool` | Reaction/Surprise card (chains onto other effects) |
| `heroEffect` | `bool` | Hero with an activatable Main Phase effect |
| `isTargetRedirect` | `bool` | Surprise that redirects incoming targeting |
| `isSurprise` | `bool` | Surprise card (face-down placement, triggered activation) |

---

## Module Exports — Behavioral Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `activeIn` | `string[]` | all zones | Zones where this card's hooks fire. Values: `'hand'`, `'deck'`, `'ability'`, `'support'`, `'surprise'`, `'area'`, `'hero'`, `'permanent'`, `'discard'`, `'deleted'` |
| `oncePerGame` | `bool` | `false` | Card can only be played once per game. Uses `_oncePerGameUsed` Set on player state. |
| `oncePerGameKey` | `string` | card name | Shared key for `oncePerGame` — cards with the same key share the restriction (e.g. all "Divine Gift" variants share `'divineGift'`). |
| `inherentAction` | `bool \| fn(gs, pi, heroIdx, engine)` | `false` | Playable during Main Phase without needing an additional action. If a function, evaluated per hero. |
| `isWildcardAbility` | `bool` | `false` | When stacked on an ability, counts as that ability's spell school for school-requirement checks. |
| `potionLockAfterN` | `number` | — | Hero flag: after the controlling player uses N potions in a turn, their potions are locked. |
| `customPlacement` | `{ canPlace(zone) → bool }` | — | Overrides standard ability placement logic. Receives the current zone array, returns whether this card can be placed there. |
| `manualGoldCost` | `bool` | `false` | Artifact handles its own gold deduction in `resolve()` instead of the engine auto-deducting. |
| `deferBroadcast` | `bool` | `false` | Don't broadcast the card reveal to the opponent before resolution (card handles it manually). |
| `noDefaultFlash` | `bool` | `false` | Skip the default activation flash animation. |
| `animationType` | `string` | `'explosion'` | Animation played on resolved potion/artifact targets. Use `'none'` to skip. |
| `cpuMeta` | `object` | — | CPU evaluation hints — see "CPU Metadata (cpuMeta)" below. |

---

## CPU Metadata (`cpuMeta`)

Per-card declarations the CPU's `evaluateState` reads to weigh boards
correctly without hand-coding card names. Add to a card's `module.exports`
as needed; omit entirely if the card has no special CPU semantics.

```js
cpuMeta: {
  // Creatures: value to OWNER when this Creature dies. Used to
  // discount the slot's "alive value" — own copies become attractive
  // sacrifice targets, opp copies become unattractive Attack targets
  // (don't fuel their plan). Magnitude is rough score-units.
  // Example: Hell Fox = 12 (deck-search → +20 hand value, less the
  // corpse delete and animation cost).
  onDeathBenefit: <number>,

  // Creatures: I'm a "chain source" — when an ALLY Creature dies and
  // my `triggersOn` predicate matches, my owner gets `valuePerTrigger`
  // worth of value. The eval credits this bonus to OTHER ally
  // Creatures' effective on-death value, so the CPU sacrifices them
  // to feed the chain. Chain sources themselves are NEVER discounted
  // by chain bonuses (would-kill-its-own-engine). Example: Loyal
  // Terrier and Loyal Shepherd.
  chainSource: {
    // True iff the source is currently armed (window up, HOPT
    // unfired, etc.). Returning false skips this source for the
    // duration of the eval call.
    isArmed(engine, inst) → bool,
    // True iff a death of `tributeInst` would trigger this source.
    // Use to filter by tribe / archetype / specific names.
    triggersOn(engine, tributeInst, sourceInst) → bool,
    // Score-units per chain trigger. Estimate the actual benefit
    // (50-dmg hit ≈ 50; deck-tutor ≈ 25; etc.).
    valuePerTrigger: <number>,
  },

  // Abilities: this is a deck-defining "engine" ability. The eval
  // adds `engineValue × stack_size` to the owner's score for every
  // matching ability stack on their heroes. Performance copies on
  // top of the engine inherit the base's role. Example: Divinity
  // = 120 (≈ "as valuable as a Lv4 Creature").
  engineValue: <number>,
}
```

The CPU brain reads these declarations generically — **never** hard-codes
card names. New cards opt in by exporting the relevant fields; no CPU
brain edits required.

---

## Module Exports — Lifecycle Methods

### Abilities (actionCost / freeActivation)

| Method | Signature | Description |
|--------|-----------|-------------|
| `onActivate` | `async (ctx, level) → void` | Called when an `actionCost` ability is activated. `level` = stack size. |
| `onFreeActivate` | `async (ctx, level) → void` | Called when a `freeActivation` ability is activated. |
| `canActivateAction` | `(gs, pi, heroIdx, level, engine) → bool` | Extra check beyond standard HOPT/phase/status checks. Return `false` to gray out. |
| `canFreeActivate` | `(gs, pi, heroIdx, level, engine) → bool` | Same, for free-activation abilities. |

### Potions & Targeting Artifacts

| Method | Signature | Description |
|--------|-----------|-------------|
| `canActivate` | `(gs, playerIdx) → bool` | Can this card be used right now? |
| `getValidTargets` | `(gs, playerIdx[, engine]) → target[]` | Build array of valid targets for the targeting UI. |
| `targetingConfig` | `object \| fn(gs, pi, goldCost) → object` | UI config sent to frontend (see Targeting Config below). |
| `validateSelection` | `(selectedIds, validTargets) → bool` | Validate the player's target selection before resolving. |
| `resolve` | `async (engine, playerIdx, selectedIds, validTargets) → result` | Execute the card's effect. Return `{ aborted: true }` to re-enter targeting. |

### Spells & Attacks

| Method | Signature | Description |
|--------|-----------|-------------|
| `spellPlayCondition` | `(gs, playerIdx) → bool` | Extra condition beyond spell school/level. Return `false` to block play. |
| `canPlayCard` | `(gs, pi, heroIdx, cardData, engine) → bool` | Hero-level play restriction (e.g. duplicate attack bans). Exported by hero scripts. |
| `payActivationCost` | `async (ctx) → void` | **Runs BEFORE the reaction chain window.** Use for costs that must be paid at activation and are NOT refunded by negation (e.g. Cold Coffin's Pollution placement). `ctx` is a standard card ctx built from the hand-zone instance — includes `promptZonePick`, `promptGeneric`, etc. If the spell is later negated by Anti Magic Shield / The Master's Plan / any counter-spell, the cost stays paid. Make `onPlay`'s target prompt `cancellable: false` since the cost is committed. |

### Heroes

| Method | Signature | Description |
|--------|-----------|-------------|
| `heroEffect` | `bool` | Flag indicating this hero has an activatable effect. |
| `onHeroEffect` | `async (ctx) → void` | Called when the hero effect is activated. |
| `canActivateHeroEffect` | `(ctx) → bool` | Extra activation condition (beyond alive/not-frozen/HOPT). |

### Creatures

| Method | Signature | Description |
|--------|-----------|-------------|
| `canSummon` | `(ctx) → bool` | Extra summoning condition. Return `false` to block. |

### Reactions

| Method | Signature | Description |
|--------|-----------|-------------|
| `reactionCondition` | `(ctx, chainCtx) → bool` | Can this reaction be added to the current chain? |
| `onChainAdd` | `async (ctx) → void` | Fires when the reaction is added to the chain. |

### Target Redirect

| Method | Signature | Description |
|--------|-----------|-------------|
| `canRedirect` | `(ctx, target, validTargets) → bool` | Can this card redirect the incoming targeting? |
| `onRedirect` | `async (ctx, target, validTargets) → target` | Execute the redirect, return the new target. |

### Surprises

Surprises are cards (Spell/Attack/Creature with `subtype: 'Surprise'` in cards.json) that can be placed face-down in a Hero's Surprise Zone during Main Phase. When their trigger condition is met, the owner is prompted to activate. On activation the card flips face-up, its effect resolves, and it goes to discard (or enters a Support Zone for Creatures).

| Export | Type | Description |
|--------|------|-------------|
| `isSurprise` | `bool` | **Required.** Marks this card as a Surprise. |
| `surpriseTrigger` | `(gs, ownerIdx, heroIdx, sourceInfo, engine) → bool` | Trigger condition. `sourceInfo`: `{ cardName, owner, heroIdx, cardInstance }`. Return `true` to prompt activation. |
| `onSurpriseActivate` | `async (ctx, sourceInfo) → result` | Called when the owner confirms activation. Return `{ effectNegated: true }` to fully negate the triggering effect. |

**Placement:** Any Surprise can be placed face-down by its owner during Main Phase 1 or 2 into a living Hero's empty Surprise Zone. No ability/level check is required for placement (bluffs are allowed).

**Activation check:** The engine verifies the Hero can activate (alive, not Frozen/Stunned, meets spell school & level requirements). For Creature surprises, a free Support Zone is also required.

**Timing:** The surprise window fires after a hero is confirmed as a target of a Spell, Attack, or Creature effect, after the card is revealed to the opponent, but before the effect resolves.

```js
// Example: booby-trap.js
module.exports = {
  isSurprise: true,
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const attacker = engine.gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    if (!attacker) return null;
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: sourceInfo.owner,
      heroIdx: sourceInfo.heroIdx, zoneSlot: -1,
    });
    await engine._delay(600);
    await ctx.dealDamage(attacker, 100, 'destruction_spell');
    if (attacker.hp <= 0) return { effectNegated: true };
    return null;
  },
};
```

---

## Targeting Config Object

Sent to the frontend to control the targeting UI:

```js
targetingConfig: {
  description: 'Select 1 Ability or any number of Equip Artifacts.',
  confirmLabel: '🔥 Destroy!',       // Button text
  confirmClass: 'btn-danger',         // CSS class (btn-danger, btn-info, btn-success)
  cancellable: true,                  // Show cancel button
  exclusiveTypes: true,               // Can't mix target types in selection
  maxPerType: { ability: 1, equip: Infinity },
  maxTotal: 3,                        // Max total selections
  minRequired: 1,                     // Min required before confirm enabled
  alwaysConfirmable: true,            // Confirm enabled even with 0 selections
  greenSelect: true,                  // Green highlight instead of red
}
```

---

## Hooks

Hooks are reactive — they fire when game events occur. Declare them
in the `hooks` object. Each receives a `ctx` object (see next section).

### Game Flow

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onGameStart` | Game begins | — |
| `onTurnStart` | A new turn starts (after burn/poison) | `turn`, `activePlayer` |
| `onTurnEnd` | Turn ends | `turn`, `activePlayer` |
| `onPhaseStart` | Phase changes | `phase`, `phaseIndex` |
| `onPhaseEnd` | Phase about to change | `phase`, `phaseIndex` |
| `onBeforeHandDraw` | Before starting hands are drawn | — |

### Card Movement

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `beforeDraw` | Card about to be drawn | `amount` (modifiable) |
| `onDraw` | Card was drawn | `drawnCards` |
| `beforePlay` | Card about to be played | `cardName`, `zone` |
| `onPlay` | Card was played/placed | `playedCard`, `cardName`, `zone`, `heroIdx`, `zoneSlot` |
| `onDiscard` | Card sent to discard | `cardName` |
| `onDelete` | Card sent to deleted pile | `cardName` |
| `onCardEnterZone` | Card enters a zone | `enteringCard`, `toZone`, `toHeroIdx` |
| `onCardLeaveZone` | Card leaves a zone | `card`, `fromZone`, `fromHeroIdx` |

### Combat

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onAttackDeclare` | Attack declared | `attacker`, `target` |
| `beforeDamage` | Damage about to be dealt | `amount` (modifiable), `target`, `source`, `type`, `sourceHeroIdx` |
| `afterDamage` | Damage was dealt | `amount`, `target`, `source`, `type` |
| `onHeroKO` | Hero HP reaches 0 | `deadHero`, `heroIdx` |
| `onHeroRevive` | Hero revived | `heroIdx` |
| `onCreatureDeath` | Creature removed from board | `card`, `heroIdx` |
| `beforeCreatureDamageBatch` | Batch creature damage about to apply | `entries[]` (modifiable) |
| `afterCreatureDamageBatch` | Batch creature damage applied | `entries[]` |

### Resources & Levels

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onResourceGain` | Gold gained | `amount` |
| `onResourceSpend` | Gold spent | `amount` |
| `beforeLevelChange` | Level about to change | `delta` (modifiable) |
| `afterLevelChange` | Level changed | `delta` |

### Status Effects

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onStatusApplied` | Status effect applied | `statusName`, `target` |
| `onStatusRemoved` | Status effect removed | `statusName`, `target` |

### Chain & Reactions

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onChainStart` | Chain begins | — |
| `onChainResolve` | Chain link resolves | — |
| `onEffectNegated` | An effect was negated | `negatedCard` |
| `onReactionActivated` | Reaction added to chain | `reactionCardName` |
| `onCardActivation` | Card effect about to resolve | `cardName` |
| `afterSpellResolved` | Spell/Attack fully resolved | `spellName`, `damageTargets`, `heroIdx`, `casterIdx` |

### Actions

| Hook | Fires when... | Notable ctx fields |
|------|---------------|-------------------|
| `onActionUsed` | Any action consumed | `actionType`, `playerIdx`, `heroIdx`, `playedCardName`, `isAdditional` |
| `onAdditionalActionUsed` | Additional action consumed | `actionType`, `playerIdx`, `heroIdx`, `playedCardName` |

---

## ctx Object — Full API Reference

Every hook handler receives a `ctx` object. This is the **only** interface
card scripts have to the game engine.

### Card Identity

| Field | Type | Description |
|-------|------|-------------|
| `ctx.card` | `CardInstance` | The card instance whose hook is firing |
| `ctx.cardName` | `string` | Card name |
| `ctx.cardOwner` | `number` | Player index who owns this card (0 or 1) |
| `ctx.cardController` | `number` | Player who currently controls this card |
| `ctx.cardZone` | `string` | Current zone |
| `ctx.cardHeroIdx` | `number` | Hero column index (-1 if N/A) |
| `ctx.attachedHero` | `object\|null` | The hero object this card is attached to |

### Game State (read-only)

| Field | Type | Description |
|-------|------|-------------|
| `ctx.phase` | `string` | Current phase name (`'START'`, `'RESOURCE'`, `'MAIN1'`, `'ACTION'`, `'MAIN2'`, `'END'`) |
| `ctx.phaseIndex` | `number` | Current phase index (0–5) |
| `ctx.turn` | `number` | Current turn number |
| `ctx.activePlayer` | `number` | Index of the active player |
| `ctx.isMyTurn` | `bool` | Whether this card's controller is the active player |
| `ctx.players` | `array` | Both player state objects (full access) |

### Event Modification (for "before" hooks)

| Method | Description |
|--------|-------------|
| `ctx.cancel()` | Cancel the event entirely |
| `ctx.modifyAmount(delta)` | Add/subtract from the event's `amount` |
| `ctx.setAmount(val)` | Set the event's `amount` to an exact value |
| `ctx.negate()` | Negate the triggering effect |
| `ctx.setFlag(key, value)` | Set a flag on the hook context (survives through all hooks, read by engine after) |

### Game Actions (async — each fires its own hooks)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.dealDamage(target, amount, type)` | `Promise` | Deal damage to a hero. `type`: `'destruction_spell'`, `'attack'`, `'creature'`, `'status'`, `'artifact'`, `'other'` |
| `ctx.dealTrueDamage(target, amount, type, opts)` | `Promise<{dealt}>` | **"Cannot be reduced or negated"** damage. Works on both heroes and creatures. Bypasses buff multipliers (Cloudy, medusa_petrified), Charmed/Submerged immunity, Immortal/HP-1 caps, Smug Coin, Gate Shield, Guardian. Still respects first-turn protection and absolute creature immunities (Cardinal Beast, Baihu Petrify). Sets the `_damagedOnTurn` tracker so "took damage this turn" effects (Medusa's Curse) see it. Use this for Acid Vial / Rockfall / future true-damage cards. |
| `ctx.healHero(target, amount)` | `Promise` | Heal a hero |
| `ctx.reviveHero(playerIdx, heroIdx, hp, opts)` | `Promise` | Revive a KO'd hero |
| `ctx.increaseMaxHp(target, amount, opts)` | — | Increase a hero's max HP. `opts.cap` to set upper limit. |
| `ctx.decreaseMaxHp(target, amount)` | — | Decrease a hero's max HP |
| `ctx.drawCards(playerIdx, count)` | `Promise<string[]>` | Draw cards from deck. Returns drawn card names. |
| `ctx.destroyCard(targetCard)` | `Promise` | Destroy a card instance (→ discard) |
| `ctx.moveCard(targetCard, toZone, toHeroIdx, toSlot)` | `Promise` | Move a card to a new zone |
| `ctx.discardCards(playerIdx, count)` | `Promise` | Force player to discard N cards (opens prompt) |
| `ctx.safePlaceInSupport(cardName, pi, heroIdx, slot)` | `{inst, actualSlot}\|null` | Place card in Support Zone with fallback. Does NOT fire onPlay/onCardEnterZone — caller must do that. |
| `ctx.addStatus(target, statusName, opts)` | `Promise` | Apply a status effect. `opts`: `{ duration, permanent, stacks, bypassImmune, addStacks }` |
| `ctx.removeStatus(target, statusName)` | `Promise` | Remove a status effect |
| `ctx.addBuff(hero, pi, heroIdx, buffName, opts)` | `Promise` | Add a buff to a hero. `opts`: `{ expiresAtTurn, expiresForPlayer }` |
| `ctx.addCreatureBuff(inst, buffName, opts)` | `Promise` | Add a buff to a creature |
| `ctx.removeBuff(hero, pi, heroIdx, buffName, opts)` | `Promise` | Remove a buff from a hero |
| `ctx.removeCreatureBuff(inst, buffName, opts)` | `Promise` | Remove a buff from a creature |
| `ctx.changeLevel(delta, target?)` | `Promise` | Change a card's level. Defaults to this card if no target. |
| `ctx.negateCreature(inst, source, opts)` | `Promise` | Negate a creature's effects. `opts`: `{ expiresAtTurn, expiresForPlayer }` |
| `ctx.grantAtk(amount)` | — | Grant ATK to this card's hero (tracked for auto-revocation) |
| `ctx.revokeAtk()` | — | Revoke ATK previously granted by this card |
| `ctx.gainGold(amount)` | `Promise` | Gain gold for the controller. Plays animation. |
| `ctx.lockSummons()` | — | Lock summoning for the controller this turn |
| `ctx.isSummonLocked()` | `bool` | Check if controller has summons locked |

### Player Prompts (async — pauses game until player responds)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.promptTarget(targets, config)` | `Promise<string[]\|null>` | Show targeting UI. Returns selected IDs or null. Auto-handles redirect. |
| `ctx.promptDamageTarget(config)` | `Promise<target\|null>` | Build targets + show picker. Config: `{ side, types, condition, damageType, title, description, ... }` |
| `ctx.promptMultiTarget(config)` | `Promise<target[]>` | Multi-select version. Config adds `{ min, max }`. |
| `ctx.executeAttack(config)` | `Promise<{target,damage}\|null>` | Full attack flow: target select → ATK-based damage → animations. Config: `{ damageMultiplier, flatDamage, side, types, excludeSelf, ... }` |
| `ctx.promptConfirmEffect(config)` | `Promise<bool>` | Yes/no dialog. Config: `{ title, message }` |
| `ctx.promptCardGallery(cards, config)` | `Promise<{cardName}\|null>` | Card picker. `cards`: `[{ name, source, cost, ... }]` |
| `ctx.promptCardGalleryMulti(cards, config)` | `Promise<{selectedCards[]}\|null>` | Multi-select card picker. Config adds `{ selectCount, minSelect, maxBudget, costKey }` |
| `ctx.promptZonePick(zones, config)` | `Promise<{heroIdx, slotIdx}\|null>` | Zone picker. `zones`: `[{ heroIdx, slotIdx, label }]` |
| `ctx.promptStatusSelect(targetName, statuses, config)` | `Promise<{selectedStatuses[]}\|null>` | Status effect picker for removal. |
| `ctx.chooseTarget(type, filter)` | `Promise` | Low-level target chooser |
| `ctx.chooseCards(zone, count, filter)` | `Promise` | Low-level card chooser |
| `ctx.chooseOption(options)` | `Promise` | Low-level option chooser |
| `ctx.confirm(message)` | `Promise<bool>` | Low-level confirm dialog |
| `ctx.performImmediateAction(heroIdx, config)` | `Promise<{played, cardName?, cardType?}>` | Hero-locked additional Action — see below |

### Immediate Additional Actions (hero-locked)

For "[Hero] may immediately perform an additional Action" effects
(Coffee, Trample Sounds in the Forest, Compulsory Body Swap,
Mana Beacon, Legendary Sword's combo, Invisibility Cloak's Counter-
Attack, etc.), call **`ctx.performImmediateAction(heroIdx, config)`**.
This is the canonical helper — do NOT roll your own by setting
`_spellFreeAction`, `_bonusMainActions`, or pushing into
`heroesActedThisTurn`.

```js
const heroName = engine.gs.players[pi].heroes[heroIdx]?.name || 'the user';
await ctx.performImmediateAction(heroIdx, {
  title: CARD_NAME,
  description: `You may perform an additional Action with ${heroName}!`,
});
```

What you get:
- A banner popup showing the configured title + description.
- Click / drag-drop hard-locked to that hero — Spells, Attacks, and
  Creatures clicked in hand auto-route to the locked hero (no hero
  picker), and only cards the hero can legally cast are highlighted /
  clickable. Action-cost Abilities on the same hero are clickable
  on their ability zones; effects on other heroes (e.g. another
  hero's Adventurousness) are invisible to the prompt.
- Auto-skip when the hero has nothing eligible to do — no empty popup.
- Standard `onPlay` / `afterSpellResolved` lifecycle on the picked
  card, so Wisdom, Bartas, Reiza, chain reactions, etc. all compose
  normally.
- The action does NOT count as the player's main turn-Action — it's
  truly additional.

`config` options: `title`, `description`, `allowedCardTypes` (subset
of `['Attack','Spell','Creature']`), `skipAbilities` (boolean).

### Additional Action System

| Method | Description |
|--------|-------------|
| `ctx.registerAdditionalActionType(typeId, config)` | Register a new additional action type. Config: `{ label, allowedCategories, filter }` |
| `ctx.grantAdditionalAction(typeId)` | Grant an additional action from this card |
| `ctx.expireAdditionalAction()` | Expire this card's additional action |
| `ctx.expireAllAdditionalActions(typeId)` | Expire all of a type for this controller |

### HOPT (Hard Once Per Turn)

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.hardOncePerTurn(effectId)` | `bool` | Returns `true` on first use per turn, `false` on subsequent. Auto-marks as used. |

### Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.getCards(filter)` | `CardInstance[]` | Find card instances. `filter`: object or shorthand string (`'mySupports'`, `'enemySupports'`, `'myAbilities'`, `'enemyAbilities'`, `'myHand'`, `'enemyHand'`, `'mySurprises'`, `'enemySurprises'`). |
| `ctx.getHero(playerIdx, heroIdx)` | `hero\|null` | Get a hero object |
| `ctx.getMyHeroes()` | `hero[]` | Get controller's heroes |
| `ctx.getEnemyHeroes()` | `hero[]` | Get opponent's heroes |
| `ctx.isCreatureImmune(inst, immuneType)` | `bool` | Check creature immunity (e.g. `'targeting_immune'`, `'control_immune'`) |
| `ctx.heroName()` | `string` | Get this card's hero's name |

### Utility

| Method | Description |
|--------|-------------|
| `ctx.log(event, data)` | Log a game event |

### Internal (use sparingly)

| Field | Description |
|-------|-------------|
| `ctx._engine` | Direct engine reference. Use for `engine.sync()`, `engine._broadcastEvent()`, `engine._delay(ms)`, `engine._trackCard()`, `engine._getCardDB()`, `engine.promptGeneric()`, `engine.promptEffectTarget()`, etc. |
| `ctx._triggers` | Array for registering follow-up triggers |

---

## Status Effects

Defined in `_hooks.js`. Use with `ctx.addStatus()` / `ctx.removeStatus()`.

| Name | Negative? | Icon | Immune Key |
|------|-----------|------|------------|
| `frozen` | ✅ | ❄️ | `freeze_immune` |
| `stunned` | ✅ | 💫 | `stun_immune` |
| `negated` | ✅ | ⚡ | `negate_immune` |
| `burned` | ✅ | 🔥 | `burn_immune` |
| `poisoned` | ✅ | ☠️ | `poison_immune` |
| `immune` | ❌ | 🛡️ | — |
| `shielded` | ❌ | ✨ | — |

## Buff Effects

Defined in `_hooks.js`. Use with `ctx.addBuff()` / `ctx.removeBuff()`.

| Name | Icon | Effect |
|------|------|--------|
| `cloudy` | ☁️ | Takes half damage from all sources |
| `submerged` | 🌊 | Untargetable while other targets exist |
| `negative_status_immune` | 😎 | Immune to all negative status effects |

---

## Game State Communication Flags

Card scripts can set these on `gs` (via `ctx._engine.gs`) to communicate
back to the server's play handler:

| Flag | Set by | Effect |
|------|--------|--------|
| `gs._spellCancelled = true` | Spell/Attack `onPlay` | Spell returns to hand (player cancelled target selection). Overridden by `_spellNegatedByEffect` — negated spells always go to discard. |
| `gs._spellFreeAction = true` | Spell/Attack `onPlay` | This spell didn't consume the action — grant another |
| `gs._spellPlacedOnBoard = true` | Spell/Attack `onPlay` | Don't send to discard after resolution (card placed itself) |
| `gs._preventPhaseAdvance = true` | Any hook | Keep the current phase open (e.g. bonus actions) |

---

## Speed Levels (Chain System)

| Constant | Value | Can chain onto... |
|----------|-------|-------------------|
| `SPEED.NORMAL` | 1 | Can only START a chain |
| `SPEED.QUICK` | 2 | Speed 1 or 2 |
| `SPEED.COUNTER` | 3 | Anything |

---

## Phases

| Constant | Index | Name |
|----------|-------|------|
| `PHASES.START` | 0 | START |
| `PHASES.RESOURCE` | 1 | RESOURCE |
| `PHASES.MAIN1` | 2 | MAIN1 |
| `PHASES.ACTION` | 3 | ACTION |
| `PHASES.MAIN2` | 4 | MAIN2 |
| `PHASES.END` | 5 | END |

---

## Common Patterns

### Dealing damage to a prompted target
```js
onPlay: async (ctx) => {
  const target = await ctx.promptDamageTarget({
    side: 'enemy', types: ['hero', 'creature'],
    title: 'My Card', description: 'Deal 100 damage.',
    confirmLabel: '💥 Blast! (100)', cancellable: true,
  });
  if (!target) return;
  const engine = ctx._engine;
  engine._broadcastEvent('play_zone_animation', {
    type: 'explosion', owner: target.owner,
    heroIdx: target.heroIdx, zoneSlot: target.slotIdx ?? -1,
  });
  await engine._delay(400);
  if (target.type === 'hero') {
    await ctx.dealDamage(ctx.players[target.owner].heroes[target.heroIdx], 100, 'destruction_spell');
  } else if (target.cardInstance) {
    await engine.dealCreatureDamage([{ inst: target.cardInstance, amount: 100, source: ctx.card, type: 'destruction_spell' }]);
  }
}
```

### HOPT ability with gold gain
```js
module.exports = {
  actionCost: true,
  onActivate: async (ctx, level) => {
    await ctx.gainGold(10 * level);
  },
};
```

### Once-per-game spell with shared key
```js
module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'mySharedKey', // Other cards with same key share the restriction
  hooks: {
    onPlay: async (ctx) => { /* ... */ },
  },
};
```

### Passive hero with per-turn tracking
```js
module.exports = {
  activeIn: ['hero'],
  hooks: {
    onTurnStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (hero) hero._myCardTracking = []; // Reset own tracking
    },
    onActionUsed: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      // React to actions...
    },
  },
};
```

### Equipment artifact
```js
module.exports = {
  isEquip: true,
  hooks: {
    onPlay: async (ctx) => {
      ctx.grantAtk(20); // Auto-revoked when card leaves zone
    },
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      ctx.revokeAtk();
    },
  },
};
```

### Potion with targeting
```js
module.exports = {
  isPotion: true,
  canActivate(gs, pi) { return this.getValidTargets(gs, pi).length > 0; },
  getValidTargets(gs, pi) {
    const targets = [];
    // Build targets...
    return targets;
  },
  targetingConfig: {
    description: 'Select a target.',
    confirmLabel: '✨ Use!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },
  validateSelection(selected, validTargets) {
    return selected.length === 1;
  },
  async resolve(engine, pi, selectedIds, validTargets) {
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    // Resolve effect...
  },
};
```
