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

## ★ `banned` ist KEIN Grund, eine Karte nicht zu implementieren (Als Regel 17.8.)

> „`banned` in cards.json hat keine Auswirkung darauf, ob eine Karte
> implementiert werden sollte und kann bis auf weiteres ignoriert werden."

Das Feld `banned` in `data/cards.json` ist eine Balance-Notiz, kein
Bauauftrag. Eine gebannte Karte wird **genauso vollstaendig gebaut und
getestet** wie jede andere — sie muss im Puzzle Mode und in Testaufbauten
funktionieren, und ein Bann kann jederzeit zurueckgenommen werden.

Auch nicht tun: den Bann im Kartenkopf als Sonderfall kommentieren oder
ihn in Tests zusichern. Eine Zusicherung auf `banned` misst eine
Balance-Entscheidung und wird rot, sobald Al sie aendert.

**Stand der Technik (17.8. gemessen, damit niemand ein Gate vermutet, das
es nicht gibt):** `banned` wird im ganzen Projekt an **genau einer** Stelle
gelesen — `getDailyHeroPool` in server.js schliesst gebannte Helden aus der
Tagesauswahl aus. Der Deck-Editor prueft es **nicht**; eine gebannte Karte
ist derzeit also deckbaulich voll zugelassen.

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
| `bypassStatusFilter` | `bool` | `false` | When `true`, the card's hooks fire even while the card is Frozen / Stunned / Negated. Same flag the engine has long honoured for Hero / Ability passives; extended to support-zone Creatures for "cannot be negated" passives like Chilly Wizard's status mirror. |
| `selfFreezeImmune` | `bool` | `false` | **Opt-in marker.** Set to `true` on any Creature whose `onPlay` stamps `inst.counters.freeze_immune` (or otherwise becomes freeze-immune the moment it lands). Pickers that need to filter out Creatures that can't be Frozen — currently SnowItAll's hand-summon picker; future "Freeze-as-cost" cards — read this flag to exclude them before the player can pick. Cardinal Beasts are filtered via their existing omni-immune name list, so they don't need the flag. **When adding a new Creature that stamps `freeze_immune` in `onPlay`, set this flag too.** |
| `firesOnAnyDamageTarget` | `bool` | `false` | Surprise opt-in. Routes the surprise through `_checkDamageSurpriseWindow`, which fires on incoming damage to ANY target you control (Hero or Creature). Standard `_checkSurpriseWindow` only fires for Hero targets and is unchanged. Banner Bearer is the first consumer. Surprise's `onSurpriseActivate` may return `{ damageReduced: N, effectNegated: bool }` to reduce/negate the damage event. |
| `sacrificableFromHand` | `bool` | `false` | Creature opt-in: while this card sits in HAND it is injected as a selectable tribute into every "sacrifice a Creature you control" picker (`type: 'hand'` entry). Hand substitutes are EXEMPT from the cost's own filter (e.g. "not summoned this turn") — the card REPLACES the would-be tribute. **Precondition (Al's ruling): a LEGAL TRIBUTE FOR THIS COST must exist on the controller's board**, since "when you WOULD sacrifice a Creature you control" presupposes a sacrifice that could actually happen. Not merely any Creature — it must survive the cost's own `spec.filter` and must not be the card paying the cost (`selfId`). The substitute itself stays exempt from that filter (the restriction describes the tribute being REPLACED). A gate of the form `getSacrificableCreatures(pi).some(<the same filter>)` is exactly equivalent to this precondition and stays in sync. Enforced centrally in `_collectSacrificeCandidates` — build sacrifice pickers from that (or `resolveSacrificeCost` / `canSatisfySacrifice`), NEVER from the board-only `getSacrificableCreatures` or a raw `_getHandSacrificeSubstitutes` call, or your card will not see substitutes and its gate will disagree with its payment path. Chosen Sacrifice is the only consumer so far. |

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

  // Generic per-instance eval bonus the CPU's `evaluateState` adds
  // to (or subtracts from) the owner's score. Called once per
  // tracked cardInstance in any zone; the script decides what
  // contributes value based on the inst's state. Use this for:
  //   • Game-defining bodies on the board (Gigantisaur Chimera
  //     returns +300 while alive in support — outweighs the 3-
  //     discard summon cost).
  //   • Equipment whose value isn't visible in immediate effects
  //     (The Great Wall of Deri returns +150 for the FIRST Wall on
  //     a side; duplicates contribute nothing).
  //   • Artifacts whose post-resolve grant is conditionally
  //     valuable (Giga Steroids returns +100 ONLY when its grant
  //     is alive AND the owner has a non-Spell/Attack/Creature
  //     Action ready to spend it on).
  // The function decides per-inst whether to return a bonus; dedup
  // / gating logic lives inside the function. Thrown errors are
  // swallowed (inst contributes 0).
  cpuInstBonus(engine, inst, ownerIdx) → number,

  // CPU should defer playing this card from hand until every OTHER
  // viable additional-Action play has been exhausted. Used for
  // cards whose `onPlay` force-ends the turn — Gigantisaur Chimera
  // sends the controller to phase 5 immediately, so playing it
  // first would skip every remaining Spell / Attack / Creature in
  // hand. The CPU's `fireAdditionalActions` hand-iteration runs in
  // two passes: non-deferred cards first, deferred cards only when
  // the first pass finds nothing.
  cpuDeferUntilLast: true,
}
```

The CPU brain reads these declarations generically — **never** hard-codes
card names. New cards opt in by exporting the relevant fields; no CPU
brain edits required.

---

## Turn-1 Immunity

**Rule: during turn 1, every card belonging to the non-turn player is completely immune to anything the turn player can do.** `gs.firstTurnProtectedPlayer` holds that player's index (cleared when the starting player's turn ends).

You normally do not need to handle this. Both target chokepoints strip protected-owned entries automatically:

* `engine.promptEffectTarget()` — inner prompts built inside `resolve` / hooks
* `normalizeValidTargets()` (server) — the `getValidTargets` + `targetingConfig` session

The filter is skipped when the PROMPTED player is the protected one (they may always pick their own cards). Opt out with `ignoreFirstTurnProtection: true` in the prompt config.

**What you DO have to handle: your play gate.** The filter runs at prompt time, not at gate time — so a `canActivate` / `canFreeActivate` / `inherentAction` that counts opponent cards will still report "playable", the card gets played, gold is spent and the picker then comes up empty. Gate on what the actor can actually touch:

```js
canActivate(gs, pi) {
  const prot = gs.firstTurnProtectedPlayer;
  for (let p = 0; p < 2; p++) {
    if (prot != null && p === prot && pi !== prot) continue;  // unreachable this turn
    …
  }
}
```

If EVERY mode of your card targets the opponent, gate the whole card off: `if (gs.firstTurnProtectedPlayer === oi) return false;` (Charme does this). Fizzling mid-resolution instead is worse — the activation was already offered and its once-per-turn slot already spent.

`GameEngine.isAbilityRemovalProtected(gs, ownerIdx)` is the named predicate for one-off checks.

## `onStatusApplied` — both field names

The status name arrives under **both** `ctx.statusName` and `ctx.status`; they are always identical. Historically the six fire sites disagreed — `addHeroStatus` sent only `statusName`, `actionApplyStatus` only `status`, `applyCreatureStatus` both — so a listener reading one name was blind to half the engine. All sites now send both. Either name is safe; new cards should still read `ctx.statusName || ctx.status` so they keep working against older engine copies.

**Hero targets vs Creature targets differ in STORAGE, not in the hook.** A Hero keeps statuses in `hero.statuses[name] = { duration, … }` and the duration always exists (default 1). A Creature keeps them in `inst.counters[name] = 1` with a companion `inst.counters[name + 'Duration']` that is only written when the duration exceeds 1. Reading `ctx.target.statuses?.<x>` therefore silently skips every Creature — check `ctx.target.counters` for the Creature branch (`ctx._onCreature` is set on the `applyCreatureStatus` path). Extending a plain one-turn Creature status means WRITING 2, not incrementing a missing field.

If your card should only react to Hero targets, guard on identity (`ctx.target !== <your hero>`) rather than relying on the field name.

## Ascension & Descend

Default Ascension gates on the spell-school orb path (`hero.ascensionReady` + `hero.ascensionTarget`, both set by the BASE hero's script). Cards whose own text names a different price declare it themselves, on the ASCENDED card:

| Export | Shape | Meaning |
| --- | --- | --- |
| `ascensionCondition` | `(gs, pi, heroIdx, engine) → bool` | Replaces the `ascensionReady` check. Evaluated BEFORE the hand splice, so a refusal never eats the card. |
| `payAscensionCost` | `(engine, pi, heroIdx)` | Charged immediately after the splice; the condition guarantees affordability. |
| `blockEndPhaseOnAscend` | `bool` | "Ascending this Hero does not end your turn." |
| `formsAscensionStack` | `bool` | Push the previous form onto `hero._formStack` so a later Descend pops exactly one level. |
| `evolutionAnimation` | `bool` | Fire `play_evolution_animation` and wait out its duration before resolving on. |
| `onAscensionBonus` | `async (engine, pi, heroIdx)` | Card-specific bonus fired after the Ascension hook. |

`engine.performDescend(pi, heroIdx)` is the mirror: it pops one level off `hero._formStack`, reverses the intrinsic HP delta (printed max HP of both forms, so mid-game max-HP buffs survive a round trip) with current HP FLOORED AT 1, re-points the hero instance, clears the cached script, re-runs the landed form's `onAscendSetup`, and returns the shed form to hand so cycling is repeatable.

**Multiple Ascension targets.** `hero.ascensionTargets` (array) sits alongside the legacy scalar `hero.ascensionTarget`; the client accepts either. Set both when a Hero has more than one legal form.

**Several once-per-turn effects on one Hero Effect.** The engine stamps a single shared `hero-effect:<name>:<pi>:<heroIdx>` HOPT after `onHeroEffect` returns anything but `false`. A card with independent once-per-turn options must therefore keep its OWN keys and `return false` — and drain the pending reveal itself, since the engine only drains it on the `!== false` path.

**Teaching the CPU which form to pick.** Route the choice through a `cardGallery` prompt with a STABLE `title` / `source`. That is all the wiring needed: `_logGalleryPick` records every live gallery resolution as `{src, picked, t}`, the trainer turns those into `tutorPickRules['<src>→<card>']` with Advantage labels and recency weighting, and the gallery scorer adds the learned value back when ranking. Renaming the source string silently invalidates every trained profile.

## CPU Prompt Overrides (`cpuResponse`)

A card can answer its own prompts for the CPU instead of letting the generic brain decide:

```js
cpuResponse(engine, kind, payload) { ... }   // return undefined to fall through
```

**Two rules decide whether your handler is ever reached. Get either wrong and it is silently dead code — the CPU falls back to "cancellable → decline" and your card simply never works for the CPU.**

**1. `kind` is `'generic'` or `'effectTarget'` — never `'target'`.** Those are the only two strings the engine sends (`_getCpuGenericResponse`, `_getCpuTargetResponse`) and the only one `_cpu.js` sends. A guard like `if (kind !== 'target') return undefined;` disables the whole handler.

| Prompt call | `kind` | `payload` |
| --- | --- | --- |
| `promptGeneric` | `'generic'` | the prompt data object (`type`, `options`, …) |
| `promptEffectTarget` | `'effectTarget'` | `{ validTargets, config, playerIdx }` |

**2. The dispatch key is `config.source || config.title`, and it must be the exact card name.** The engine resolves it with `loadCardEffect()`, so a decorated title does not match:

```js
// BROKEN — loadCardEffect('The Yeeting — Choose Target') returns null
await engine.promptEffectTarget(pi, targets, { title: `${CARD_NAME} — Choose Target`, … });

// CORRECT — decorated title for the player, real name for the dispatch
await engine.promptEffectTarget(pi, targets, {
  title: `${CARD_NAME} — Choose Target`, source: CARD_NAME, …
});
```

Any prompt whose `title` carries a dash, colon or interpolation needs an explicit `source`.

**Keep the play-gate and the handler on the same logic.** If `cpuResponse` will only ever pick certain targets (e.g. opponent-owned ones), gate the play itself with `cpuShouldPlay(engine, pi) → bool` using the SAME predicate. Otherwise the CPU plays the card, declines its own prompt, and the resolve aborts — repeatedly, since `{ aborted: true }` re-opens the targeting session.

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
| `onHeroEffect` | `async (ctx) → false \| any` | Called when the hero effect is activated. **Return `false` on every abort path** — see below. |

**★ RUECKGABEVERTRAG von `onHeroEffect` (Als Befund 17.8.):** die Engine
stempelt das Einmal-pro-Zug NUR, wenn der Rueckgabewert `!== false` ist
(`doActivateHeroEffect` in server.js) — und meldet den Effekt sonst als
gefeuert (`announceActiveEffect`, `noteActivationOutcome`). Ein blosses
`return;` liefert `undefined` und gilt damit als ERFOLG: der Zug ist
verbraucht, obwohl nichts geschehen ist. Genau so fiel Cecilia auf —
Abbruch der Kartenauswahl kostete die Aktivierung.

Also: **jeder** Pfad, der nichts bewirkt, gibt `false` zurueck — abgebrochene
Abfrage, fehlgeschlagene Zahlung, Ziel zwischenzeitlich verschwunden, Gate
nachtraeglich nicht mehr erfuellt. Der Erfolgspfad gibt `true` zurueck (oder
irgendetwas ausser `false`).

Sonderfall MEHRFACHNUTZUNG pro Runde (Kassaran, 3x): dort fuehrt die Karte
ihren Verbrauch selbst und setzt `ctx._skipHeroEffectHopt = true`, statt
`false` zurueckzugeben — `false` hiesse zusaetzlich "abgebrochen" und wuerde
`onAnyActionResolved` und die CPU-Erkennung mit aushebeln.
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
  damageType: 'destruction_spell',    // Optional — tag damage-targeting (see below)
  baseDamage: 100,                    // REQUIRED for damage targeting (see below)
}
```

### Damage Targeting vs Non-Damage Targeting

The engine distinguishes "damage targeting" from "non-damage targeting"
via `config.baseDamage > 0`. Cards that pick a target and DEAL damage to
it MUST set `baseDamage` to the per-target damage amount (`baseDamage:
hero.atk` for Attacks, fixed values for damage Spells / Artifacts). This
signal is consulted by several engine filters:

* **Great Wall of Deri** (and any future `isNondamageOpponentShield`
  card): protects the controller's Creatures from being chosen as
  targets by opp's cards / effects EXCEPT when the picker is tagged
  damage targeting. Set `baseDamage > 0` on every damage picker so opp
  can still legally aim damage spells / attacks at your protected
  Creatures.

* **Status-application pickers** (Freeze, Stun, Negate, Charm, Poison,
  Burn-as-status, Bind, etc.) should set `damageType: 'status'` and
  leave `baseDamage` undefined. The Wall filter treats these as
  non-damage and correctly excludes the protected opp Creatures from
  the picker.

### Adding a New Card That Targets Opp Creatures Non-Damage

If your script targets opp Creatures via a NON-damage effect (steal /
control / status apply / bounce / destroy-without-damage / etc.), the
engine's chokepoints (`promptDamageTarget`, `promptMultiTarget`,
`promptEffectTarget`, `normalizeValidTargets`) automatically filter
out protected opp Creatures — your picker will list zero opp
Creatures if all of them are Wall-protected.

For cards whose **`canActivate` / `canFreeActivate` requires opp
Creatures to be selectable** (so they can correctly gray out in hand
when zero legal targets remain — Dark Gear / Diplomacy pattern), add
an explicit short-circuit at the top of your target-eligibility
helper:

```js
const oppIdx = pi === 0 ? 1 : 0;
// Per-side non-damage shield (The Great Wall of Deri etc.). Card is
// non-damage, so opp's protected Creatures are unreachable — short-
// circuit so the card is correctly grayed out in hand instead of
// opening an empty picker.
if (engine._isSideNondamageShielded(oppIdx)) return [];
```

For cards whose effect is **auto-triggered** rather than player-picked
(Cute Angel Molinda's afterCreatureDamageBatch steal, Treacherous
Crystal's server-side trigger, etc.), check per-creature in the
trigger handler:

```js
const tgtCtrl = inst.controller ?? inst.owner;
if (engine._isSideNondamageShielded?.(tgtCtrl)) continue;
```

The Wall's "except direct damage" exception means damage-dealing
auto-triggers (recoil damage, on-summon damage, etc.) do NOT need the
check — the damage itself bypasses the shield by definition.

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
| `onAttackDeclare` | Attack declared — **AFTER target pick, BEFORE animation + damage** (see "onAttackDeclare slot" below) | `source`, `target`, `amount` (modifiable via `modifyAmount` / `setAmount` / `addFlatBonus`) |
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
| `ctx.addStatus(target, statusName, opts)` | `Promise` | Apply a status effect. `opts`: `{ duration, permanent, stacks, bypassImmune, addStacks }`. For **heroes** only. **For creatures**, use `engine.applyCreatureStatus(inst, statusName, opts)` — see below. |
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
| `ctx.promptCardGallery(cards, config)` | `Promise<{cardName}\|null>` | Card picker. `cards`: `[{ name, source, cost, ... }]`. **Do NOT use for hand-only picks — see "Hand-only pickers" rule below.** |
| `ctx.promptCardGalleryMulti(cards, config)` | `Promise<{selectedCards[]}\|null>` | Multi-select card picker. Config adds `{ selectCount, minSelect, maxBudget, costKey }`. **Do NOT use for hand-only picks — see "Hand-only pickers" rule below.** |
| `ctx.promptZonePick(zones, config)` | `Promise<{heroIdx, slotIdx}\|null>` | Zone picker. `zones`: `[{ heroIdx, slotIdx, label }]` |
| `ctx.promptStatusSelect(targetName, statuses, config)` | `Promise<{selectedStatuses[]}\|null>` | Status effect picker for removal. |
| `ctx.chooseTarget(type, filter)` | `Promise` | Low-level target chooser |
| `ctx.chooseCards(zone, count, filter)` | `Promise` | Low-level card chooser |
| `ctx.chooseOption(options)` | `Promise` | Low-level option chooser |
| `ctx.confirm(message)` | `Promise<bool>` | Low-level confirm dialog |
| `ctx.performImmediateAction(heroIdx, config)` | `Promise<{played, cardName?, cardType?}>` | Hero-locked additional Action — see below |

### Prompts show the source card's image (automatic)

**Rule:** any prompt that asks the player to **activate an effect, choose between effects, or cancel** displays the prompting card's image, so the player always sees *which* card is asking. This is handled by the engine — you normally do **nothing**:

- **Target prompts** (`promptDamageTarget`, `promptTarget`, `executeAttack`) render a `CardMini` of the source card in the targeting panel via `previewCardName`.
- **Confirms** opened with `promptConfirmEffect` set `showCard` to the source card.
- **Zone pickers** (`promptZonePick`) preview the source card.
- **Direct `engine.promptGeneric` calls** of type `confirm` / `optionPicker` made while a card's hook (`onPlay`, `onCreatureSacrificed`, reactions, …) or activated creature effect is executing are auto-stamped with the resolving card's `showCard` — the engine tracks the active card in `_promptCardStack` and fills it in.

Overrides:
- Pass an explicit `showCard: '<Card Name>'` / `previewCardName: '<Card Name>'` to preview a *different* card (e.g. the equip a Creature is offering).
- Pass `showCard: null` to suppress the image for a prompt where it would be redundant.

Notes:
- Auto-injected images are cosmetic only: they are tagged `_autoShowCard` so they do **not** make a plain cast-confirmation gate Gerrymander-eligible. Only an **explicit** `showCard` on a cancellable confirm is the Gerrymander "you may" marker (see `gerrymander.js`).
- Galleries (`promptCardGallery` / `promptCardGalleryMulti`) already display the choosable cards, so they're exempt from this rule.

### Hand-only pickers — ALWAYS use `handPick`, NEVER a gallery

**Rule:** any prompt that picks one or more cards FROM THE PLAYER'S HAND (and only from the hand) MUST use the `handPick` prompt — `promptCardGallery` / `promptCardGalleryMulti` are reserved for picks that span deck / discard / multi-source pools where a popup is the only sensible UI.

The `handPick` prompt is rendered in-place over the player's existing hand:
- Eligible cards are highlighted via `eligibleIndices` and clickable.
- Click toggles selection; clicking a selected card deselects it.
- Ineligible cards (and dynamically-ineligible ones — name caps full, total maxed, name-locked, etc.) get dimmed automatically.
- The player never leaves the board view, never sees their hand duplicated in a gallery, and can keep dragging / interacting with the rest of the UI exactly as during a normal turn.

Galleries hide the rest of the board behind a modal overlay, force the player to re-recognise their cards in a new layout, and don't compose with hand-level highlighting / drag affordances. For any "pick N cards from hand" mechanic, that's strictly the wrong tool — Visionary Genius Heinz, Leadership, Horn in a Bottle, Mischief Invasion, and every future hand-only multi-pick must funnel through `handPick`.

Reach for `promptCardGallery` / `promptCardGalleryMulti` ONLY when the candidate pool is NOT (or not solely) the hand — Necromancy's discard-pile gallery, Sparkfly Queen's opp-deck steal preview, Saint Nicolas's Potion Deck reveal, etc.

```js
// Canonical hand-only picker. Engine: `engine.promptGeneric(pi, { ... })`.
const result = await engine.promptGeneric(pi, {
  type: 'handPick',
  title: CARD_NAME,
  description: 'Click cards in your hand to mark them. Click again to unmark.',
  eligibleIndices: [...],   // hand indices that may be picked at all
  minSelect: 0,             // 0 lets the player confirm with no picks
  maxSelect: N,             // total cap across all picks
  cancellable: true,
  confirmLabel: '✨ Confirm!',

  // Optional per-type caps. Each hand index maps to a "type" string,
  // and each type has its own cap. The picker dims further copies of a
  // type once its cap is filled (in addition to the global maxSelect).
  cardTypes: { 0: 'Creature', 2: 'Creature', 5: 'Spell' },
  typeLimits: { Creature: 2, Spell: 1 },

  // Optional Heinz-style name lock: after the first pick, only cards
  // sharing that name remain clickable. Toggling the last pick off
  // releases the lock and re-enables every eligible card.
  nameLockOnFirstSelect: true,
});

// Response shape:
//   null OR { cancelled: true }                   → player cancelled
//   { selectedCards: [{ handIndex, cardName }] }  → committed picks
//                                                   (length may be 0 if
//                                                   minSelect was 0)
```

Frontend reference: `app-board.jsx` handles `gameState.effectPrompt.type === 'handPick'` — see `isHandPickEligible`, `isHandPickSelected`, `isHandPickTypeFull`, `isHandPickMaxed`, `isHandPickNameLocked`.

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

### Applying creature statuses

`engine.applyCreatureStatus(inst, statusName, opts)` is the **single** chokepoint every creature-status applier must use. Direct `inst.counters.<status> = 1` writes are forbidden in new card scripts — they bypass `canApplyCreatureStatus` (immunity gate) and skip the `ON_STATUS_APPLIED` hook fire, which would silently break Bear Rider's hand-level recompute, Chilly Wizard's status mirror, Colored Snow's reaction trigger, and any future creature-status-aware Creature.

```js
await engine.applyCreatureStatus(inst, 'frozen', {
  duration:    2,            // optional — multi-turn statuses
  stacks:      3,            // for stack-bearing statuses (currently only `poisoned`)
  addStacks:   true,         // additive vs overwrite — true for poison stacking
  sourceOwner: pi,           // player who applied — written to `<status>AppliedBy`
  source:      'Cool Card',  // card-name string or { name } object — for logs
  animationType: 'ice_encase', // OPTIONAL — omit / 'none' if you broadcast your own animation
  logEvent:    false,        // default false — opt in for a `status_apply` log entry
});
// → true iff the status actually changed. Idempotent: re-applying an
//   already-present non-stacking status returns false.
```

Returns `true` when the status changed, `false` when blocked (immune, already present and non-stacking, etc.). The helper handles every creature-status convention: `inst.counters[status] = 1` flag, `inst.counters.poisonStacks`, `inst.counters[status + 'Duration']`, `inst.counters[status + 'AppliedBy']` (plus legacy `poisonAppliedBy` / `burnAppliedBy` aliases).

Hero-side, keep using `engine.addHeroStatus(playerIdx, heroIdx, statusName, opts)` — it already fires `ON_STATUS_APPLIED` and is the equivalent hook contract for the hero status map.

`ON_STATUS_APPLIED` and `ON_STATUS_REMOVED` fire for both Heroes and Creatures. The creature path stamps `ctx._onCreature = true` on the hook context so listeners can discriminate; `ctx.target` is the hero object for hero events and the `inst` for creature events.

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
| `gs._spellReturnToHand = true` | Spell/Attack `onPlay` | After resolution, return the card to its caster's hand instead of the discard pile (Rocket Fist). Distinct from `_spellCancelled` — the effect DID resolve. |
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

## The `onAttackDeclare` slot — "before an Attack's animation"

`onAttackDeclare` is the canonical hook for effects that need to land
**between target selection and the Attack's impact animation/damage**.
Doq's detective guess is the prototype: pick a card from the opp's hand,
declare a type, draw + boost on a hit — all *before* the swoosh, so the
modified damage and any visible UX bursts (the prompt itself, the
"correct!" sparkles) read as a single beat.

### Listening (any card)

```js
module.exports = {
  activeIn: ['hero'],
  hooks: {
    onAttackDeclare: async (ctx) => {
      // Gate to YOUR card's role. ctx.source is { name, owner, heroIdx,
      // controller, [usesHeroAtk] } — the Hero making the attack.
      if (ctx.source?.heroIdx !== ctx.card.heroIdx) return;
      if ((ctx.source?.owner ?? ctx.source?.controller) !== ctx.cardOwner) return;
      // ctx.target is the picked target (object) or array (multi-target).
      // ctx.amount is the about-to-deal damage; mutate via:
      //   ctx.modifyAmount(delta)  — add/subtract
      //   ctx.setAmount(val)       — replace
      //   ctx.addFlatBonus(delta)  — bonus that bypasses buff multipliers
      ctx.modifyAmount(50);
    },
  },
};
```

### Firing it from a new Attack card

Attack scripts that build their own resolution flow MUST call
`engine._fireAttackDeclare(source, target, baseDamage)` AFTER target
selection but BEFORE the impact animation, then use the returned amount
in their damage calls:

```js
const target = await ctx.promptDamageTarget({ /* ... */ });
if (!target) return;

const attackSource = { name: 'My Attack', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseDamage);

// (animation broadcasts go here)
engine._broadcastEvent('play_ram_animation', { /* ... */ });
await engine._delay(400);

// Damage uses finalDmg (post-listener)
await engine.actionDealDamage(attackSource, hero, finalDmg, 'attack');
```

`ctx.executeAttack` already fires the hook internally — Attacks that
delegate to it (Heavy Hit and similar generic ATK-stat hits) need no
additional plumbing.

### Auto-fire safety net

If an Attack script forgets to call `_fireAttackDeclare`, the engine
auto-fires it from inside `actionDealDamage` / `processCreatureDamageBatch`
when the source is a Hero-attributed Attack-type damage event
(`type === 'attack'`, `source.heroIdx >= 0`, `source.owner` set). In that
fallback the prompt lands *after* the script's animation but still
*before* damage applies — listeners still get their bonus applied. Per-
source dedup via `source._attackDeclareFired = true` ensures the hook
fires exactly once per attack regardless of which path triggered it.

`usesHeroAtk: true` on the source is **not required** — the slot is
formula-agnostic (fires for `atk`-based, `baseAtk`-based, fixed, or
custom-math damage equally).

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

### Ability- und Artifact-Ziele einsammeln

**Immer ueber die zentralen Sammler gehen, nie selbst `ps.abilityZones`
oder die Support-Zonen durchlaufen.** Sonst uebersieht der Effekt
Sonderfaelle wie Cloak of Edge, die in einer SUPPORT-Zone liegt, dort
aber als Ability zaehlt.

```js
// Alle Abilities, die der Spieler kontrolliert — aus Ability-Zonen UND
// aus Support-Zonen (Karten mit `countsAsAbilityInZone`).
const ziele = engine.getAbilityTargets(pi, {
  heroIdx: 2,            // optional: nur dieser Held
  livingHeroOnly: true,  // optional: nur bei lebendem Traeger
  cardName: 'Fighting',  // optional: nur dieser Name
});
// -> [{ id, type, zoneKind, owner, heroIdx, slotIdx, cardName, level, cardInstance }]
//    zoneKind: 'ability' (type 'ability') | 'support' (type 'equip')
//    `type` folgt der ZONE, damit Ziel-Picker unveraendert funktionieren.

// Gegenstueck: Artefakte in Support-Zonen, OHNE die dort als Ability
// zaehlenden Karten.
const artefakte = engine.getArtifactTargets(pi);
```

Eine neue Karte, die sich auf dem Brett als anderer Typ verhaelt, setzt
dafuer nur ein Flag am Skript — die Sammler ziehen automatisch nach:

```js
module.exports = {
  isEquip: true,
  countsAsAbilityInZone: true,   // zaehlt in der Support-Zone als Ability
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

### Gold: gain, spend — and *set* (`actionSetGold`)

Three primitives, three different meanings. Picking the wrong one is a
rules bug, not a style choice:

| Primitive | Meaning | Fires | Blocked by `goldLocked` |
|---|---|---|---|
| `actionGainGold(pi, n, opts)` | the player **gains** gold | `onResourceGain` → `afterResourceGain` | yes |
| `actionSpendGold(pi, n)` | the player **pays** gold | `onResourceSpend` → `afterResourceSpend` | yes |
| `actionSetGold(pi, n, opts)` | gold **becomes** n | `afterGoldSet` only | **no** |

`actionSetGold` exists because a wipe or a forced value is **neither a
gain nor a payment** (Al's ruling 16.8. on *Market Crash*: "Both
players' Gold becomes 0"). Consequences, all deliberate:

- Cards that trigger on a **payment** (*Criminal Monkee* — "when you
  pay exactly 4 Gold") must NOT fire on a wipe. They don't, because
  `afterResourceSpend` is not raised.
- *Golden Arrow*'s lock ("cannot gain or spend Gold") does NOT stop a
  set, for the same reason.
- **State-based** gold rules still have to work. *Logan, the Investment
  Monkee* — "If you ever have 0 Gold, remove all Invest Counters" —
  describes a standing condition, not a moment. That is what
  `afterGoldSet` is for; Logan listens to all three carriers.

`afterGoldSet` fires **even when the value did not change**: it reports
a state, not a movement, and "if you ever have X" is exactly the rule
shape that a change-only check would miss. It is deliberately **not**
in `HOOK_DESCRIPTIONS`, so it opens no reaction window.

Negative gold is not representable today (every deduction clamps at 0)
and `actionSetGold` clamps too. If the *Debt-O-Tron* archetype ("while
you have less than 0 Gold") is ever built, that clamp is the single
place to change.

---

### State-based Gold rules — use `goldStateRule`, not the movement hooks

> **The trap:** a rule phrased *"if you **ever** have 0 Gold …"* is a
> standing condition, not an event. Hanging it on
> `afterResourceGain` / `afterResourceSpend` / `afterGoldSet` misses
> every path that changes Gold some other way — most importantly
> **paying a card's Cost**, which is deducted raw at ~20 sites and
> fires none of those hooks.

Export a synchronous function from the **Hero's** module:

```js
// Called after EVERY change to this player's Gold, whatever caused it.
goldStateRule(engine, playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if ((ps.gold || 0) > 0) return;
  // … enforce the standing condition …
}
```

The engine walks it from `_checkGoldStateRules(playerIdx)`, which every
Gold path calls: `actionGainGold`, `actionSpendGold`, `actionSetGold`,
`actionStealGold` (for the victim) and `_payCardCost`.

**It must be synchronous.** Cost deductions sit inside resolution paths
that are partly synchronous; an un-awaited promise there is exactly the
class of bug that cost the v386–v394 hunt. Mutating state, logging,
broadcasting and `sync()` are all fine — awaiting is not. The walker is
re-entrancy guarded, so a rule may call `sync()` itself.

**Paying a Cost: always `await engine._payCardCost(playerIdx, cost)`**,
never `ps.gold -= cost`. What it fires, and why:

| Hook | Fired? | Why |
|---|---|---|
| `AFTER_RESOURCE_SPEND` | **yes** | Al's ruling 16.8.: a Card Cost *is* a payment, so "when you pay exactly N Gold" cards (Criminal Monkee) must see it. |
| `ON_RESOURCE_SPEND` | **no** | The pre-hook is *cancellable*. A listener could block the Cost of a card that is already resolving — played, but never paid for. Costs are not negotiable at that point. |
| `goldStateRule` | **yes, last** | Same order as `actionSpendGold`: the standing condition gets the last word, after every reaction to the payment has settled. |

It reports the amount **actually** deducted, not the amount asked
for — if the player could not cover it, they did not pay N, and
"exactly N" must not fire.

It is `async` because of the hook; every call site awaits it.
`goldStateRule` stays synchronous regardless.

**NEVER write `ps.gold` directly** — not `-=`, not `+=`, not `=`. Any
raw write is invisible to *both* rule families at once, and the card
doing it still works, so nothing looks broken:

| What you are doing | Use |
|---|---|
| Paying a card's Cost (incl. variable / `manualGoldCost` costs) | `await engine._payCardCost(pi, amount)` |
| Gaining Gold from an effect | `await engine.actionGainGold(pi, amount)` |
| Spending Gold outside a Cost | `await engine.actionSpendGold(pi, amount)` |
| Setting Gold to a fixed value (a wipe) | `await engine.actionSetGold(pi, amount)` |
| Taking Gold from the opponent | `await engine.actionStealGold(pi, amount)` |

This one keeps coming back: on 16.8. the same mistake surfaced three
times in a row — 19 raw Cost deductions in the engine, then those same
sites firing no payment hook, then **18 more inside card scripts**
(cards with `manualGoldCost` compute their own Cost, so they were
never covered by the engine-side fix). Al found the last batch on
*Book of Doom*: exactly 4 Gold for one target, down to 0, and neither
Logan nor Criminal Monkee reacted.

So it now reports itself: **`_gold-audit.js` scans every card script
at server start** and warns about raw `.gold` writes. If your card is
a real exception — Swagdri briefly inflates Gold purely to suppress a
display artefact, Tool Freezer refunds a Cost that was never paid —
add it to that file's `ALLOWLIST` **with a reason**.

Logan, the Investment Monkee is the first and so far only consumer.

---

### Negative Gold (Debt-O-Tron) — three contracts

Gold could not go below zero until v407; every deduction clamped and
every affordability gate compared against the balance. The Debt-O-Tron
archetype opens that up, but only under conditions, and only through
these contracts. **With none of them present the credit line is 0 and
everything behaves exactly as before.**

| Contract | Lives on | Shape | What it does |
|---|---|---|---|
| `goldOverdraft(engine, pi)` | a **Hero** | → number | How much *new debt* a single payment may take on. Kent returns 20, regardless of the current balance. |
| `selfGoldOverdraft` | any **card** | `true` / number / fn | Credit that applies **only when that card is the one being paid for**. `Debt-O-Tron Damage Fees` uses `true` (unlimited). Never bleeds onto other payments. |
| `blocksActions(engine, pi)` | a **Hero** | → bool | Player-wide Action lock, as a *standing* condition. Synchronous, like `goldStateRule`. |

The engine asks via `goldOverdraftLimit(pi, cardName)`,
`canAffordGold(pi, cost, cardName)` and `areActionsBlocked(pi)`.

**The measure is always "new debt", never an absolute floor.** A
payment may be at most `max(0, gold) + limit`, so from −10 with a limit
of 20 you may still pay 20 and land at −30. The same formula drives the
"for every 10 Gold you spent in excess of your current Gold" cards:
`amount − max(0, goldBefore)`.

**`areActionsBlocked` is checked wherever `hero._actionLockedTurn` is**,
which gives it the right scope for free: normal *and* additional
Actions, plus Hero effects and Abilities **only when those cost an
Action**. Free Hero effects stay usable.

Two traps worth naming:

- **Any `gold > 0` test in existing code is now suspect.** Before v407
  it was interchangeable with `!== 0`; it no longer is. Logan's "if you
  ever have 0 Gold" wiped his counters at −5 until this was caught.
- **Artifacts do not go through `validateActionPlay`.** `doPlayArtifact`
  now consults `canPlayWithHero` itself (v408) — before that, a
  card-side gate on an Artifact was display-only and a direct call went
  straight through.

---

### Conditional inherent additional Actions

`inherentAction` may be a **function** `(gs, pi, heroIdx, engine) → bool`.
Returning `true` means "this play does not consume an Action".

Read the card text carefully: a clause like *"You may use this Spell as
an additional Action while &lt;condition&gt;"* gates only the **action
economy**, not the card. Such a card stays playable without the
condition — it just costs the Action. That is `inherentAction` alone;
adding a `spellPlayCondition` would be wrong and would also grey the
card out for the human player. Models: *Quick Attack* (first Attack of
the turn), *Overheal Shock* (caster's school levels), *Market Crash*
(more Gold than the opponent). *Gate to the Armory* is the opposite
shape — there the free mode has a **cost** (it ends your turn), so its
`inherentAction` returns `false` whenever a real Action slot is free.

Two engine stamps set by `doPlaySpell` **before** `onPlay` let a card
see which route it took:

```js
const modus = gs._spellWasInherent      ? 'frei'     // inherent grant
            : gs._spellConsumedMainAction ? 'main'   // burned the Action
            :                               'zusatz'; // external grant
```

Note the CPU consequence: the enumerator **skips** inherent-action
cards in the Action Phase and defers them to `fireAdditionalActions` in
Main Phase. A card whose `inherentAction` is currently `true` is
therefore only ever considered on the free path — and `cpuPlayVeto`
receives `{ additional: true }` there and `{ additional: false }` on the
regular path, which is the clean place to hang a per-mode CPU decision.

---

### Areas — respect "Diver Helmet" (MANDATORY for every Area)

> **Diver Helmet** (Artifact / Equipment): *"The equipped Hero and all
> cards in its Support Zones are unaffected by Areas."*

Diver Helmet is **passive** — it has no behaviour of its own. The rule
is enforced *by every Area*. When you author or modify ANY Area card
(or engine-level Area rule) that **directly affects a Hero or a
Creature** — damage, status, stat changes, HP buffs, forced movement,
control changes, healing locks, being chosen/targeted by the Area's
own optional action, etc. — you **must** skip every Hero / Creature
protected by a Diver Helmet. Areas that only touch hands, decks, gold,
levels, piles, or global rules need no guard.

Use the shared helper — never re-implement the lookup:

```js
const {
  heroHasDiverHelmet,   // (engine, playerIdx, heroIdx) -> bool
  isAreaImmuneInst,     // (engine, cardInstance) -> bool  (Creature/support card)
  isAreaImmuneHeroObject, // (engine, heroObj) -> bool
} = require('./_diver-helmet-shared');

// Hero-damage Area (e.g. via ctx.aoeHit): exclude protected Heroes —
// no effect AND no animation on them.
await ctx.aoeHit({
  side, types: ['hero'], damage: 100, /* … */,
  heroFilter: (hero, hi, tpi) => !heroHasDiverHelmet(ctx._engine, tpi, hi),
});

// Creature-affecting Area: skip protected Creatures.
for (const inst of myCreatures) {
  if (isAreaImmuneInst(engine, inst)) continue;
  // … apply the Area's effect …
}

// beforeDamage-style hero modifier:
const hi = (engine.gs.players[ownerIdx]?.heroes || []).indexOf(target);
if (hi >= 0 && heroHasDiverHelmet(engine, ownerIdx, hi)) return;
```

Engine-level Area rules delegate via `this._isDiverHelmetProtectedTarget(target)`
(accepts a Hero object OR a support-zone CardInstance) — see the
Stinky Stables poison-heal-lock sites in `_engine.js` for the pattern.

---

### Targeting / redirect effects — respect "Truth-Seeing Eye" (MANDATORY)

> **Truth-Seeing Eye** (Artifact / Equipment): *"The equipped Hero can
> choose any target with Attacks and Spells, negating all effects that
> would prevent those targets from being chosen, and the equipped
> Hero's Attacks and Spells cannot be redirected."*

Like Diver Helmet, Truth-Seeing Eye is **passive** — it has no
behaviour of its own. The rule is enforced *by every effect that
restricts target selection or redirects something*. When you author or
modify ANY card or engine rule that **(a) makes a target impossible /
harder to choose** (a new untargetable-style status, a per-instance
"can't be chosen by opp" flag, a taunt / forced-targeting filter, a
target-exclusion list, a side-wide targeting shield, an
insta-fizzle-on-selection, …) **or (b) redirects an Attack / Spell /
effect** (a new `isTargetRedirect` / `isSurprise`+`isSurpriseRedirect`
/ `heroRedirect` card, a post-target reaction returning `newTargets`,
or any bespoke "the effect now hits a different target" path) — you
**must** make it a no-op when the source is an Attack / Spell cast by a
Hero wearing a Truth-Seeing Eye.

The single source of truth is the engine helper:

```js
// true iff `sourceCard` is an actual Attack OR Spell CARD being cast
// by a Hero with a live (face-up, non-negated) Truth-Seeing Eye in a
// Support Zone. Scoped to Attack/Spell ONLY — a Creature effect from
// the same Hero is NOT its "Attack or Spell" and is still
// restrictable / redirectable.
engine._sourceHasTruthSeeingEye(sourceCard) → bool
```

**You usually get this for free.** The three core pickers
(`promptDamageTarget`, `promptMultiTarget`, `promptTarget`) already
call the helper and, when it matches, set on the live `config`:

* `ignoreUntargetable: true` — the long-standing master switch every
  built-in "can't be chosen" filter is already gated on (`if
  (!config.ignoreUntargetable) { … }`: untargetable status, Golden
  Wings `untargetable_by_opponent`, Perfect Disguise soft-untargetable,
  The Great Wall of Deri non-damage shield).
* `_truthSeeingEye: true` — gates the filters that are NOT covered by
  `ignoreUntargetable`: the forced-targeting / taunt filter
  (`_applyForcesTargetingFilter`) and the `gs._spellExcludeTargets`
  exclusion list (Invisibility Cloak's post-negation lockout, Bartas
  second-cast).
* `cannotBeRedirected: true` — the existing gate the redirect call
  sites honour; `_checkTargetRedirect` *also* early-returns `null` on
  the helper directly.

So: **if your new "can't be chosen" filter is gated on
`!config.ignoreUntargetable`, and your damage/effect routes through one
of the three pickers, you are already compliant.** Anything else MUST
add an explicit guard:

```js
// (a) A NEW target-selection filter inside a picker — gate it like the
//     built-ins, OR additionally honour the dedicated flag if it isn't
//     an `ignoreUntargetable`-class restriction:
if (!config.ignoreUntargetable && !config._truthSeeingEye) {
  // …remove the now-unchooseable targets…
}

// (b) An ENGINE-LEVEL chokepoint or an AUTO-TRIGGERED restriction /
//     redirect that never sees a picker `config` (server-side
//     targeting, a reaction that swaps the target, a bespoke
//     "redirect" path) — consult the helper directly:
if (engine._sourceHasTruthSeeingEye(sourceCard)) return;          // don't restrict
if (engine._sourceHasTruthSeeingEye(sourceCard)) return null;     // don't redirect
```

Canonical redirect paths are already compliant — `_checkTargetRedirect`
guards at the top (covers `isTargetRedirect` Challenge / Martyry /
Anti-Magnet, `heroRedirect`, and the `isSurpriseRedirect` Shield of
Wisdom scan). A NEW redirect mechanism that does **not** flow through
`_checkTargetRedirect` (e.g. a post-target reaction returning
`newTargets`) must add the `engine._sourceHasTruthSeeingEye(sourceCard)`
check itself before swapping the target.

**Scope / non-goals (do NOT over-apply):**
- Attack / Spell sources **only**. A Creature effect (even from the
  same Eye Hero) is still restrictable and redirectable.
- It does **not** suppress post-target *negation* reactions
  (Invisibility Cloak fully negating, Storm Ring negating a
  multi-target Spell) — those still resolve. The Eye governs which
  targets can be *chosen* and that the cast can't be *redirected*,
  nothing else.
- `submerged` is a damage / status immunity, not a target-list filter
  — leave it alone (the Eye doesn't make submerged targets take
  damage).

Reference implementations: the helper + picker injection + filter gates
in `_engine.js`; the passive equip script `truth-seeing-eye.js`; the
redirect cards `anti-magnet.js` (`isTargetRedirect`) and
`shield-of-wisdom.js` (`isSurpriseRedirect`).

---

### Support-Zone effects — respect "Defending the Gate" (MANDATORY)

> **Defending the Gate** (Artifact / Surprise): a face-down Surprise
> that, once activated, shields **every card in the activating
> player's Support Zones** — Creatures, Equipment, and Attachments —
> from being destroyed, moved, stolen, or otherwise removed from the
> board by an opponent's card or effect for the rest of the turn.

When you author or modify ANY card or effect that **removes or
relocates a card in a Support Zone** — destroy → discard/deleted,
steal-to-hand, bounce-to-deck/hand, control transfer, an opponent's
forced sacrifice, a bespoke "pull this Creature off the board" path,
etc. — it **must** give the card's controller a chance to raise
Defending the Gate, and abort if that side is shielded.

The single source of truth is the engine pair:

```js
await engine._triggerGateCheck(side, sourceName); // async — opens the activation window
engine._isGateShielded(side) → bool                // true once that side raised it
```

**You usually get this for free.** The engine chokepoints already
trigger + honour it — `actionDestroyCard`, `actionMoveCard`
(support → anywhere), `actionTransferCreature`, the Fire Bomb /
ability-removal paths. If your card routes its Support-Zone removal
through one of those, you are already compliant.

Anything that does **raw Support-Zone manipulation** — splicing a
card out of `supportZones` directly instead of going through a
chokepoint (`_sparkfly-shared.stealBoardCardToHand`, Tengu Windstorm's
bounce, …) — MUST trigger + check the gate itself:

```js
const gateSide = targetInst.controller ?? targetInst.owner;
await engine._triggerGateCheck(gateSide, sourceName);
if (engine._isGateShielded(gateSide)) return; // shielded — abort the removal
```

Defending the Gate is a **face-down Surprise** — unknown at targeting
time — so a card CANNOT gray itself out / pre-filter gate-protected
targets. Trigger the check at **resolution** (as Fire Bomb and Capture
Net do): the effect targets normally, then fizzles cleanly if the gate
goes up. The card and its cost are still spent.

Scope: `_isGateShielded` is keyed to the side whose Support card you
are affecting — your own gate, untriggered against your own effects,
never blocks you. Damage to Support-Zone Creatures is governed by the
damage pipeline, not this rule.

Reference: `_isGateShielded` / `_triggerGateCheck` in `_engine.js`;
`fire-bomb.js`; `capture-net.js` (via `stealBoardCardToHand`).

---

### Spell-school filters — read BOTH fields, never `spellSchool1` alone (MANDATORY)

> **Al's ruling (16.8.):** a card that is *partly* a given school **counts as
> that school**. Friendship locks a Spell that is only half Support Magic;
> Holy Cheese finds it; Angry Cheese finds a half-Destruction Spell, and so on.
> A dual-school card belongs to **both** of its schools, everywhere.

Use the shared helper — never compare a field directly:

```js
const { hasSpellSchool } = require('./_hooks');

if (hasSpellSchool(cd, 'Support Magic')) { /* … */ }        // ✅
if (cd.spellSchool1 === 'Support Magic') { /* … */ }        // ❌ misses half of them
if (cd.spellSchool1 === 'X' || cd.spellSchool2 === 'X') {}  // works, but don't add new ones
```

**Why a one-sided read is not a 50/50 gamble but a systematic miss:** since the
dual-school ordering rule (Al, 11.8.) the two fields are **alphabetically
sorted**, not "main school first". So a school always lands in the same slot
relative to its partner:

| School            | Sorts | Can appear in `spellSchool2`?          |
|-------------------|-------|----------------------------------------|
| Decay Magic       | 1st   | never (always field 1)                 |
| Destruction Magic | 2nd   | only paired with Decay                 |
| Fighting          | 3rd   | —                                      |
| Magic Arts        | 4th   | paired with Decay / Destruction        |
| Summoning Magic   | 5th   | paired with any of the above           |
| Support Magic     | 6th   | **always** — it sorts behind all others |

`spellSchool1 === 'Support Magic'` therefore misses **every** dual-school
Support Spell there is. That was a live bug in ten places until v425
(Friendship, Lizbeth, Divine Gift of The Light, Thalia, the playability gate,
the hand grey-out and the "support spell used this turn" flag). The six cards
it silently exempted: Dangerous Knowledge, Energy Drain, Holy Selection,
Sacrifice to Divinity, The Light Brigade Marches, Spectral Armor.

**The one exception** is the de-duplication idiom when *collecting* a card's
schools — that one is about field identity, not membership, and stays:

```js
const schools = [];
if (cd.spellSchool1) schools.push(cd.spellSchool1);
if (cd.spellSchool2 && cd.spellSchool2 !== cd.spellSchool1) schools.push(cd.spellSchool2);
```

---

### Removing a *chosen* board card to a pile — anchor the flight by ZONE, not name (MANDATORY)

> **The bug:** the client's diff-based board→discard/deleted fly-out
> animator (`animsFromBoard` / `captureBoardRects` in `app-board.jsx`)
> resolves the flight's **source by card NAME** and takes the *first*
> captured rect. With duplicate-named cards on the board (same Creature
> in two Support slots, same Ability on two Heroes, a `?` for multiple
> face-down opp Surprises, …) it animates from the **left-most** one —
> the wrong slot.

Any card/effect that lets a player **pick a specific board card and
move it off the board** needs a zone-anchored `play_pile_transfer` for
that exact instance. **In den meisten Fällen musst du dafür NICHTS tun:**

> **`actionDestroyCard` sendet den verankerten Flug selbst** — und zwar
> ERST NACH allen Abbruchpfaden (Immunität, Cardinal Beast, First-Turn-
> Schutz, Gate Shield, Monias `beforeCreatureAffected`). Wird die
> Zerstörung abgewehrt, fliegt also korrekt nichts.

**Sende hier KEINEN eigenen `play_pile_transfer`.** Ein zusätzlicher
Broadcast erzeugt einen Doppelflug; steht er wie früher VOR dem Aufruf,
animiert er die Karte sogar dann weg, wenn die Zerstörung anschließend
abgewehrt wird (im Feld beobachtet: The Yeeting → Monias Rettung).

```js
// RICHTIG — die Engine erledigt den Flug:
await engine.actionDestroyCard(source, targetInst);

// Nur wenn die Karte eine EIGENE Leichen-Animation besitzt
// (Brackle's Katapult, Berserk):
await engine.actionDestroyCard(source, targetInst, { skipPileTransfer: true });
```

**Selbst senden musst du nur, wenn du die Karte MANUELL bewegst**, also
ohne `actionDestroyCard` — etwa per `splice` + `discardPile.push`
(Silent Water Mizune, Weird Doll). Dann gilt: Anker vorher merken,
Broadcast NACH der tatsächlichen Bewegung senden.

```js
engine._broadcastEvent('play_pile_transfer', {
  owner: inst.owner,                // oder fromOwner/toOwner cross-side
  cardName: inst.name,
  from: 'surprise', to: 'discard',  // 'support' | 'ability' | …
  fromHeroIdx: inst.heroIdx,
  fromSlotIdx: inst.zoneSlot,       // bei surprise weglassen
});
```

Scope / exclusions:
- **area** → `actionMoveCard` already broadcasts `area→discard`
  (owner-scoped, one Area per side — no name ambiguity). Don't double it.
- **coolnessStackTop** → flies via `actionPopCoolnessStackTo`.
- **permanent** → not captured by the diff animator; pass `fromPermId`
  instead of `fromSlotIdx` if you do animate it.

The frontend's `onPileTransfer` pre-suppression bucket covers
`from ∈ {hand, support, ability, surprise}` → `{discard, deleted}` so
the duplicate name-keyed diff flight is dropped and only the
zone-anchored flight plays. `to: 'hand'` / `to: 'deck'` have their own
handled paths.

Reference implementations:
- **Ralzish**, **The Yeeting**, **_spider-shared** — destroy→discard;
  sie sendeten den Broadcast früher SELBST und erzeugten damit einen
  Doppelflug. Seit 1.8. verlassen sie sich auf `actionDestroyCard`.
  NICHT als Vorlage für eigene Broadcasts nehmen.
- **Sparkfly Worker** (`_sparkfly-shared.stealBoardCardToHand`) and
  **Tengu Windstorm** (`_bounceToDeck`) — already correct: they emit a
  zone-anchored `play_pile_transfer` (`to: 'hand'` / `to: 'deck'`,
  `fromOwner`/`toOwner`, `fromPermId` for permanents).
- **Dive Bomblebee** — already correct via a different route: it plays
  a zone-anchored *impact* animation (`bomblebee_dive` keyed to
  owner/heroIdx/zoneSlot) and never resolves a source by name (the card
  just leaves on the next sync; no flight), so the bug can't occur.

When in doubt: if the player *chose* the card and it *leaves the
board*, send the zone-anchored `play_pile_transfer` yourself.

---

### Permanent control transfer — ALWAYS physically moves the Creature (MANDATORY)

> **Rule:** any card / effect that grants **permanent control** of an
> opp Creature MUST physically relocate it to a free Support Zone on
> the new controller's side. A bare `inst.controller = newOwner` flip
> WITHOUT a move is **wrong** — it leaves the Creature sitting in the
> previous controller's slot while card-text reads ("Creatures you
> control", "your Support Zone", board-position-based interactions)
> partially disagree about where it lives.

The standard engine path:

```js
// 1. Build the free-zone list on the new controller's side.
const freeZones = [];
for (let hi = 0; hi < newOwnerPs.heroes.length; hi++) {
  if (!newOwnerPs.heroes[hi]?.name) continue;     // empty hero slot
  for (let si = 0; si < 3; si++) {
    if (((newOwnerPs.supportZones[hi] || [])[si] || []).length === 0) {
      freeZones.push({ heroIdx: hi, slotIdx: si });
    }
  }
}
// 2. No free zone → effect fizzles (or stays on the previous side,
//    depending on the card's wording — most "take control" effects
//    just fail when there's no room).
if (freeZones.length === 0) return;

// 3. Pick a destination. The new controller's player picks for
//    intentional control plays (Dark Gear, Diplomacy). For automatic
//    triggers (Jumper Spider's start-of-turn ping-pong), use
//    promptZonePick so the controller still gets to choose.
const picked = await engine.promptZonePick(newOwnerPi, freeZones, {
  title: sourceCardName, description: `Move ${inst.name} where?`,
});
const dest = picked || freeZones[0];

// 4. Single chokepoint — handles source-zone splice, the
//    onCardLeaveZone hook, the slide-across transfer animation,
//    destination placement, controller/owner/zone reassignment,
//    guardian-immunity sync, onCardEnterZone (with _isMove: true),
//    and the onTakeControl hook.
await engine.actionTransferCreature(inst, newOwnerPi, dest.heroIdx, dest.slotIdx);
```

**Defending the Gate**: if the effect SHOULD be blockable by the gate
(Dark Gear / Diplomacy — opp's effortful "I want this creature" play),
the CALLER runs the gate check BEFORE `actionTransferCreature` (see
the preceding section). If the effect is unconditional (Jumper
Spider's automatic ping-pong — card text says it just happens),
skip the gate check entirely.

**Why this matters:**
- The diff-detector, status-removal targeting, ability-zone reads, and
  every "card in your Support Zone" gate look at `(inst.controller,
  inst.heroIdx, inst.zoneSlot)` together. A controller-only flip leaves
  the Creature physically in opp's column — visible to both players in
  the wrong column, and a footgun for any future card that gates on
  "in your Support Zone" semantics.
- `actionTransferCreature` is the **only** path that plays the slide-
  across animation, syncs guardian immunity, fires `onTakeControl`,
  and updates `inst.zone` / `inst.heroIdx` / `inst.zoneSlot` /
  `inst.controller` / `inst.owner` in lockstep. Hand-rolling any of
  those steps drifts from the engine contract.

Reference implementations:
- **Dark Gear**, **Diplomacy** — proactive "take control" plays. Build
  freeZones, prompt for a slot, then `actionTransferCreature`.
- **Jumper Spider** — automatic start-of-turn ping-pong. Uses the same
  flow on each turn flip; if the new turn player has no free zone, the
  transfer simply skips this turn (Jumper Spider stays under the
  current controller and tries again next turn).

---

### Immunities block effects, NEVER animations (MANDATORY)

> **Rule:** when a card's effect on a target is blocked by an immunity
> / protection / negation gate (Anti Magic Enchantment, Resistance,
> Diver Helmet, Cardinal-Beast immunity, charmed-hero damage gate,
> first-turn protection, untargetable, Wall of Deri, Truth-Seeing
> Eye's redirect block, magic_immune, …), the **gate stops the
> effect's state mutation, not its visuals**. Projectile flights,
> impact bursts, channel beams, hand→target swooshes, screen flashes —
> all of these still play.

**Why this matters.** A blocked effect with no visual reads as "the
card did nothing" or "the game lagged" — players can't tell that the
opponent's protection was the reason. Playing the animation first and
*then* fizzling the state change makes the block itself a visible
beat: the heart/fireball/beam lands, and only then does the protection
sigil / "✗" flash announce that the effect bounced. Same UX as
Anti Magic Shield (the spell still animates → then the chain shows
the negation): the player sees what they paid for, and the protection
gets credit for the save.

**Authoring contract.** In any `onPlay` / `resolve` / activated effect
where you check an immunity gate:

```js
// 1. Play the animation(s) FIRST — projectile flight, impact burst,
//    channel beam, whatever the card uses. await their duration so
//    the visual finishes landing before any state mutation OR fizzle.
engine._broadcastEvent('play_projectile_animation', { /* … */ });
await engine._delay(PROJECTILE_MS);
engine._broadcastEvent('play_zone_animation', { type: 'love_burst', /* … */ });
engine.sync();

// 2. NOW consult the immunity gate(s). On block, optionally play a
//    "protection sigil" flash (anti_magic_block / resistance_flash /
//    etc.) so the block reads clearly, log it, and return.
if (engine._isHeroSpellProtected(targetHero, CARD_NAME)) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'anti_magic_block', owner: tOwner, heroIdx: tHeroIdx, zoneSlot: -1,
  });
  engine.log('blocked', { /* … */ });
  return;
}
// Resistance / other beforeHeroEffect gates: same shape.
const effectCtx = { /* … */ cancelled: false, _skipReactionCheck: true };
await engine.runHooks('beforeHeroEffect', effectCtx);
if (effectCtx.cancelled) { engine.log('resisted', { /* … */ }); return; }

// 3. Effect lands — state mutation goes here.
```

**Exceptions.** Two narrow carve-outs where the engine *itself*
short-circuits before the visual can fire, by design:
- **Reaction-chain Spell negation** (Anti Magic Shield, Storm Ring,
  Invisibility Cloak's pre-effect window, etc.) runs in the chain
  window *before* the casting card's `onPlay`. The cast's `onPlay`
  simply never runs, so its visuals don't fire. The chain UI shows
  the negation itself, which is the visible beat in this case.
- **`_spellNegatedByEffect` mid-resolve** void in `_actionDealDamage`
  Impl: if a post-target reaction sets the flag, subsequent damage
  events from the same Spell silently zero. This is intentional — the
  Spell's earlier visual already played; the silent void only affects
  *further* damage events the Spell would have tried to deal.

For everything else: **animate, then gate**. Don't ever write a gate
check at the top of `onPlay` that returns before the visual fires.

Reference implementation: **Love Shot** — the heart projectile flies
+ the `love_burst` lands BEFORE the Anti Magic / Resistance check, so
a protected target visibly sees the heart hit before the block reads.

---

### Instance card-data overrides — always read them via `getEffectiveCardData` (MANDATORY)

> **The pattern:** a few cards put a card on the board under one name
> while it *is*, for game-rules purposes, something else. A **Biomancy
> Token** is the canonical case: the Potion itself is placed in the
> Support Zone and only `inst.counters._cardDataOverride` turns it into
> a `Creature/Token`.

Any code that asks *"what kind of card is this instance?"* must go
through the engine helper, never the raw database:

```js
const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];  // ✅
const cd = cardDB[inst.name];                                       // ❌
```

`getEffectiveCardData` returns the plain DB entry when no override
exists, so the swap is free for every ordinary card. Reading raw is a
silent bug: the instance answers with the *underlying* card's type, HP
and level, and rules code quietly excludes it. Two real ones, both
fixed after Al reported them: the AoE target collectors (hence the
`token-override-aware` comments scattered through `_engine.js` and the
shared modules) and `getSacrificableCreatures`, where Biomancy Tokens
were not sacrificable at all until v399.

**The one deliberate exception** is a card that asks about the
*underlying* card on purpose. Kyli, the Deceptive Sapling reads *"when
you sacrifice a Creature that is **not a Potion**"* — her anti-loop
clause exists precisely because a Biomancy Token is a Potion. That
check uses the raw DB via `_biomancy-shared.isPotionCardName`, and it
says so in a comment. If you write such a check, say why.

**Creating a Biomancy Token:** don't rebuild the counter block. Call
`placeBiomancyToken(engine, pi, heroIdx, potionName, level, opts)` from
`_biomancy-shared.js` — the single interpretation site, shared by
`biomancy.js`, `kyli-the-deceptive-sapling.js` and the puzzle loader in
`server.js`. Need only the counters (no placement)? Use
`biomancyTokenCounters(potionData, level)`.

---

### Puzzle Mode — every card must work there, and every Counter must be authorable (MANDATORY)

> **Al's rule (16.8.):** every new card is play-tested through **Puzzle
> Mode**. It must work there. And **if a card uses Counters, those
> Counters must be settable in the Puzzle Editor** — otherwise the one
> state that matters most for the card can't be reproduced in a test.

Puzzle Mode is not a reduced engine — it runs the same `GameEngine`, so
a card that works in a normal game usually works there too. The two
things that differ, and that you have to think about:

1. **No MCTS.** Reaction chains and puzzles run the heuristic CPU path
   (`cpuReactionDecision`, `_getCpuGenericResponse`), not the search.
   A card whose CPU behaviour lives only in `evaluateState` will look
   inert in a puzzle. If the CPU must do something specific, give the
   card a `cpuResponse` — that is the path a puzzle actually takes.
2. **Starting state is authored, not played into.** Anything the card
   needs in order to be interesting has to be reachable from the
   editor: HP, ATK, statuses, buffs, gold (`pz.gold`, per player),
   Areas, Surprises, hand contents — **and Counters.**

**Wiring a new Counter into the editor.** There is no generic registry;
each Counter type is declared in two places that must agree. Follow the
existing pairs (Head Counter / Change Counter / Evolution Counter /
Invest Counter / Balance / Bunny Bomb / Anti Magic level):

- **Client — `public/app-puzzle.jsx`:** one `useState` for the value
  (`editXCounter`), hydrated in `openStatEditor` and gated so the
  section stays hidden for unrelated cards. Gate by card name, by an
  explicit `Set`, or by `archetype` from the card DB — prefer the
  archetype/`Set` route so a later sibling card works without touching
  the editor (`isWaflavHeroName` is the model). Hero Counters are saved
  on the hero as `hero._xCounters`; card Counters go under
  `_creatureStatuses[<heroIdx>-<slot>].x`.
- **Server — the puzzle loader in `server.js` (`createPuzzleGame` →
  `buildPlayerState`):** one block that copies the authored value onto
  the live object — `hero._xCounters` for Heroes,
  `inst.counters.x` for support-zone cards.

If a Counter exists in the engine but in neither of those places, the
card is untestable by Al's workflow and counts as unfinished.

---

### Deferred side-effects — NEVER use `setTimeout` / `setImmediate` for animation bursts (MANDATORY)

> **Rule:** any code path that calls `engine._broadcastEvent(...)` (or
> any other side-effect with externally-visible state) MUST be reached
> via `await engine._delay(N)`, NEVER scheduled via `setTimeout(fn, N)`,
> `setImmediate(fn)`, `queueMicrotask(fn)`, or a raw
> `new Promise(r => setTimeout(r, N))`.

**Why this matters.** The CPU brain runs MCTS rollouts inside
`engine.enterFastMode()` / snapshot → action → restore boundaries. In
fast-mode, `engine._broadcastEvent` is a no-op (`_engine.js` —
`_broadcastEvent` returns early when `_fastMode === true`) AND
`engine._delay(N)` is a microtask-only `Promise.resolve()` (no real
wait). So a sequence of `flash(); await _delay(200); flash()` runs to
completion **synchronously inside the fast-mode window** and the
broadcasts are correctly dropped.

A `setTimeout(flash, 200)` is fundamentally different: the callback is
queued as a macrotask and **does not run during the rollout**. By the
time Node services the timer, the rollout has already `restore()`d its
snapshot and `exitFastMode()`d — so `_fastMode = false` and the
broadcast goes through with whatever coordinates the closure captured.
Those coordinates often reference the *simulated* board state (slots
that don't exist on the live board, or wrong-owner slots), so phantom
animations paint on random / empty zones of the live UI.

Past field bugs (both fixed):
- **Diamond Spider** — staggered triple `diamond_sparkle` burst on
  Surprise-activated draw used `setTimeout(flashEvent, 200/400)`. Every
  simulated Surprise activation across an MCTS turn (dozens per
  rollout × dozens of rollouts) leaked late-firing sparkles onto live
  client zones.
- **Great Detective Doq** — same `setTimeout`-burst pattern for the
  "correct prediction!" `gold_sparkle` flourish.

**Authoring contract.** When you need a staggered visual burst:

```js
// CORRECT — entire sequence inside the fast-mode window.
const flash = () => engine._broadcastEvent('play_zone_animation', { ... });
flash();
await engine._delay(200);
flash();
await engine._delay(200);
flash();
```

```js
// WRONG — late macrotasks leak past the rollout boundary.
const flash = () => engine._broadcastEvent('play_zone_animation', { ... });
flash();
setTimeout(flash, 200);
setTimeout(flash, 400);
```

**Logic helpers (not broadcasts).** If you must use `setTimeout(0)` /
`setImmediate` for batch deferral or async re-checks that DON'T
broadcast — Divine Gift of Time's discard-batch consolidation, Big
Gwen's hand-limit recheck — guard the queue at scheduling time:

```js
if (engine._fastMode) return; // skip during MCTS rollouts
setImmediate(() => { /* live-state recheck */ });
```

Otherwise the simulated trigger fires a deferred callback that runs
against the post-restore live state, which usually no-ops but can
surface unexpected prompts in edge cases.

## „Up to X times per turn" — EIN Verfahren (ab v417)

**Als Regel (16.8., verbindlich):** X-mal in MEINER Runde, dann
FRISCHE X-mal in der Gegnerrunde. `gs.turn` zählt jeden Spielerzug
hoch, der Rundenstempel im gemeinsamen Zähler setzt das automatisch um.

```js
const { usesLeft, spendUse, refundUse } = require('./_charges');
const USE_KEY = 'meineKarte';   // frei wählbar, pro Karte eindeutig

module.exports = {
  chargesPerTurn: 3,        // Anzeige oben rechts (nur bei X > 1!)
  chargeKey: USE_KEY,       // mehr braucht die Anzeige nicht

  hooks: {
    irgendeinTrigger: async (ctx) => {
      const gs = ctx._engine?.gs;
      // prüft UND verbucht in einem — false heißt „nichts mehr frei"
      if (!spendUse(ctx.card, gs, { key: USE_KEY, max: 3 })) return;
      …
    },
  },
};
```

| Funktion | Zweck |
|---|---|
| `usesLeft(inst, gs, {key, max})` | Nur lesen — z.B. für Prompt-Texte |
| `spendUse(inst, gs, {key, max})` | Prüfen + verbuchen, `false` wenn leer |
| `refundUse(inst, gs, {key})` | Reservierung zurückgeben (Abbruch) |

### Verbuchen erst NACH der Zusage

**Al-Regel (16.8.):** Bricht der Spieler ab, darf ihn das KEINE Ladung
kosten. Also `spendUse` erst rufen, wenn die Wahl steht:

```js
const frei = usesLeft(ctx.card, gs, { key: USE_KEY, max: 3 });
if (frei <= 0) return;                       // Gate: nur prüfen

const target = await ctx.promptDamageTarget({ … });
if (!target) return;                          // Abbruch — nichts verbucht

spendUse(ctx.card, gs, { key: USE_KEY, max: 3 });   // erst JETZT
```

Braucht die Karte einen Schutz gegen ihre eigene Wiedereintritts-
schleife (Antonia iteriert über eine Schadensrunde), darf sie
stattdessen vorab reservieren — muss dann aber auf JEDEM Abbruchpfad
`refundUse` rufen.

**KEIN `onTurnStart` zum Zurücksetzen schreiben.** Der Stempel erledigt
das. Genau diese vergessbare Rücksetzung war der Bug bei Archer und
Golden Vermin: ihre Hooks liefen nur beim EIGENEN Rundenbeginn, damit
galt ein Kontingent für beide Züge zusammen.

**Bei genau EINER Ladung wird nichts angezeigt** — solche Karten sind
Schalter. `chargesPerTurn: 1` ist erlaubt, die Engine filtert es raus.

Hängt die Anzeige an einer Bedingung, statt `chargeKey` eine Funktion
`remainingCharges(inst, gs)` liefern, die `null` zurückgibt, wenn
nichts angezeigt werden soll (Vorbild: Smug Mastermind Antonia zeigt
nur, solange „Cool Rescuer Monia" unter ihr liegt).
