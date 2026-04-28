// ═══════════════════════════════════════════
//  CARD EFFECT: "The Spawn Mother"
//  Creature (Summoning Magic Lv3, 100 HP)
//
//  Two effects, EACH ONCE PER TURN per controlling
//  player (shared across all Spawn Mother copies on
//  the same side — a second instance summoned the
//  same turn cannot re-fire the AOE, and a second
//  bounce attempt is refused):
//
//  1. AOE-ON-SUMMON (`hooks.onPlay`):
//     Fires whenever Spawn Mother enters a
//     Support Zone — hand summon, free-Action
//     summon (Trample Sounds, etc.), revive,
//     illusion, all of them. Per-player HOPT
//     ensures only the FIRST Spawn Mother that
//     lands per turn fires the AOE; later copies
//     skip silently. Player picks one of two
//     damage modes:
//       (a) 100 damage to all opponent Heroes.
//       (b) 100 damage to all targets on the
//           board (Heroes both sides, Creatures
//           both sides), excluding Spawn Mother
//           herself.
//     All damage lands in one window via
//     `processCreatureDamageBatch` for creatures
//     and per-hero `actionDealDamage` calls.
//     Once-per-turn key: `spawn-mother-aoe:${pi}`.
//
//  2. ACTION-COST SELF-BOUNCE (`creatureEffect`
//     + `creatureActionCost`):
//     Spend an Action — Action Phase or Main
//     Phase with an additional-action provider
//     for 'ability_activation' — to bounce this
//     Creature back into the controller's hand.
//     Routes through `actionMoveCard` so the
//     standard onCardLeaveZone hook fires and
//     the support→hand animation plays.
//     Once-per-turn key: `spawn-mother-bounce:${pi}`.
//     Distinct from the engine's per-instance
//     `creature-effect:${inst.id}` HOPT — that's
//     per-copy, but Spawn Mother's text shares the
//     bounce slot across ALL copies on the player's
//     side, so a second copy can't re-bounce.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Spawn Mother';
const AOE_DAMAGE = 100;
const HOPT_AOE_PREFIX    = 'spawn-mother-aoe';
const HOPT_BOUNCE_PREFIX = 'spawn-mother-bounce';

function _aoeUsedThisTurn(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_AOE_PREFIX}:${pi}`] === gs.turn;
}
function _bounceUsedThisTurn(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_BOUNCE_PREFIX}:${pi}`] === gs.turn;
}
function _stampHopt(gs, key) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[key] = gs.turn;
}

function _allOpponentHeroTargets(gs, pi) {
  const oi = pi === 0 ? 1 : 0;
  const ops = gs.players[oi];
  if (!ops) return [];
  const out = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ owner: oi, heroIdx: hi, hero: h });
  }
  return out;
}

function _allBoardCreatures(engine, excludeInstId) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.id === excludeInstId) continue; // Exclude Spawn Mother herself
    if (inst.faceDown) continue;
    out.push(inst);
  }
  return out;
}

function _allBoardHeroes(gs) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      out.push({ owner: pi, heroIdx: hi, hero: h });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  // ── 1. AOE-ON-SUMMON ───────────────────────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      // Self-only — onPlay fires for any played card.
      if (ctx.playedCard?.id !== ctx.card.id) return;
      // Fires for ANY summon path — hand-play, free additional Action
      // (Trample Sounds), revive, illusion, etc. The per-player HOPT
      // below caps the AOE to once per turn, which is the only intended
      // gate. (No `_isNormalSummon` filter — summon-source distinctions
      // are not part of this card's text.)

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Per-player once-per-turn lock for the AOE — text says "Each
      // effect of 'The Spawn Mother' can only happen once per turn",
      // shared across all copies on the controller's side. A second
      // Spawn Mother summoned the same turn skips silently.
      if (_aoeUsedThisTurn(gs, pi)) return;

      // Mode picker. Cancellable: if both modes have zero targets we
      // skip the prompt entirely (nothing to do). Otherwise the player
      // commits to one of the two modes.
      const oppHeroes  = _allOpponentHeroTargets(gs, pi);
      const allHeroes  = _allBoardHeroes(gs);
      const allCreatures = _allBoardCreatures(engine, ctx.card.id);
      const mode2HasTargets = allHeroes.length > 0 || allCreatures.length > 0;
      if (oppHeroes.length === 0 && !mode2HasTargets) return;

      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose how Spawn Mother\'s emergence resolves.',
        options: [
          {
            id: 'opp',
            label: `Opponent Heroes only (${oppHeroes.length})`,
            description: `Deal ${AOE_DAMAGE} damage to every Hero your opponent controls.`,
            color: 'var(--danger)',
          },
          {
            id: 'all',
            label: `Everything (${allHeroes.length} Hero${allHeroes.length === 1 ? '' : 'es'} + ${allCreatures.length} Creature${allCreatures.length === 1 ? '' : 's'})`,
            description: `Deal ${AOE_DAMAGE} damage to every Hero and every other Creature on the board.`,
            color: 'var(--warning)',
          },
        ],
        cancellable: false,
      });
      const mode = choice?.optionId === 'all' ? 'all' : 'opp';

      // Build target sets per mode.
      const heroHits = mode === 'all' ? allHeroes : oppHeroes;
      const creatureHits = mode === 'all' ? allCreatures : [];

      // The source carries `cardInstance: ctx.card` so the engine's
      // surprise-check synthetic-source resolution lands on Spawn
      // Mother's actual inst (where we set `_isAoeCheck` below) rather
      // than constructing a fresh object that would lose the flag.
      const source = { name: CARD_NAME, owner: pi, heroIdx: -1, controller: pi, cardInstance: ctx.card };

      // Mark the AoE bracket so opt-out surprises (Mountain Tear River,
      // any future "single-target only" reaction) skip across every
      // per-hero / per-creature surprise check this AoE will fire.
      // Mirror of Heat Wave's pattern; the engine's batch path does the
      // same internally for spells that route through it.
      const sourceInst = ctx.card;
      const hadFlag = sourceInst?._isAoeCheck;
      if (sourceInst) sourceInst._isAoeCheck = true;

      // Dark water waves engulf every affected target simultaneously,
      // BEFORE the damage lands so the visual leads the HP changes.
      // Heroes use zoneSlot -1; creatures use their slot index. Brief
      // delay so the wave reads as the cause of the damage.
      for (const { owner, heroIdx: hi } of heroHits) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'dark_wave_engulf', owner, heroIdx: hi, zoneSlot: -1,
        });
      }
      for (const inst of creatureHits) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'dark_wave_engulf',
          owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
      }
      if (heroHits.length > 0 || creatureHits.length > 0) {
        await engine._delay(450);
      }

      // Hero damage — one actionDealDamage per hero (the engine's hero
      // damage path is per-target). Each fires its own afterDamage so
      // listeners (Vinepire-style trackers) see each hit.
      for (const { hero } of heroHits) {
        if (hero.hp <= 0) continue; // May have died from a previous hit this loop
        await engine.actionDealDamage(source, hero, AOE_DAMAGE, 'creature');
        engine.sync();
      }

      // Creature damage — one batched call so all hits resolve under a
      // single beforeCreatureDamageBatch / afterCreatureDamageBatch
      // window. Excludes Spawn Mother's own instance. animType is left
      // null because the dark_wave_engulf burst already played above.
      if (creatureHits.length > 0) {
        const entries = creatureHits.map(inst => ({
          inst, amount: AOE_DAMAGE, type: 'creature',
          source, sourceOwner: pi, canBeNegated: true,
        }));
        await engine.processCreatureDamageBatch(entries);
      }

      // Restore the AoE flag we set above. Defensive: only delete if
      // we set it (some future caller might have stacked the flag).
      if (sourceInst && !hadFlag) delete sourceInst._isAoeCheck;

      // Stamp the per-player HOPT only after we've committed (skipped
      // earlier on the "no targets at all" no-op so the lock isn't
      // burned for a fizzle). Mirrors the engine's standard "stamp
      // after success" pattern.
      _stampHopt(gs, `${HOPT_AOE_PREFIX}:${pi}`);

      engine.log('spawn_mother_aoe', {
        player: ps.username, mode,
        heroes: heroHits.length,
        creatures: creatureHits.length,
      });
      engine.sync();
    },
  },

  // ── 2. ACTION-COST SELF-BOUNCE ─────────────────────────────────
  // The engine treats `creatureActionCost: true` like the ability
  // `actionCost: true` flow: activatable in Action Phase OR in Main
  // Phase if the controller has an additional-action provider for
  // 'ability_activation'. Action Phase activation advances the phase;
  // Main Phase activation consumes the additional action.
  creatureEffect: true,
  creatureActionCost: true,

  canActivateCreatureEffect(ctx) {
    // Spawn Mother is in own support zone (engine already restricts
    // creature-effect activation to support-zone instances). Bouncing
    // into hand is always legal — hand-limit isn't a play-time gate
    // for support→hand bounces.
    if (!ctx.card) return false;
    // Per-player once-per-turn lock for the bounce — text says "Each
    // effect of 'The Spawn Mother' can only happen once per turn",
    // shared across all copies. The engine's per-instance HOPT
    // (`creature-effect:${inst.id}`) gates each copy individually;
    // this layer adds the cross-copy lock so a second Spawn Mother
    // can't re-bounce on the same turn.
    const ctrl = ctx.card.controller ?? ctx.card.owner;
    if (_bounceUsedThisTurn(ctx._engine.gs, ctrl)) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const inst   = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const ctrl = inst.controller ?? inst.owner;
    // Defensive re-check — canActivateCreatureEffect should already
    // have filtered this, but a Surprise / chain reaction between the
    // gate and now could theoretically fire another Spawn Mother's
    // bounce first. Idempotent.
    if (_bounceUsedThisTurn(gs, ctrl)) return false;
    // Stamp BEFORE the move so a chain that fires inside actionMoveCard
    // (onCardLeaveZone, etc.) sees the lock as already in effect.
    _stampHopt(gs, `${HOPT_BOUNCE_PREFIX}:${ctrl}`);
    // actionMoveCard handles: onCardLeaveZone hook, support→hand
    // animation broadcast, removal from support zone array, push
    // into hand array, instance zone update. The destination hand
    // is `inst.owner`'s (matching the engine's standard support→hand
    // routing — see actionMoveCard's HAND case).
    await engine.actionMoveCard(inst, 'hand', -1, -1, { source: CARD_NAME });
    engine.log('spawn_mother_bounce', {
      owner: inst.owner, hero: engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx]?.name,
    });
    engine.sync();
    return true;
  },
};
