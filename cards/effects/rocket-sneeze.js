// ═══════════════════════════════════════════
//  CARD EFFECT: "Rocket Sneeze"
//  Artifact (Reaction, Cost 4)
//
//  Play this card immediately when a target your
//  opponent controls takes 50 or less damage.
//  That damage is dealt to all targets your
//  opponent controls instead.
//
//  Implementation
//  ──────────────
//  • Two entry points — `isOppPreDamageReaction`
//    (hero target path) and `isOppCreaturePre-
//    DamageReaction` (creature target path) —
//    both walk the NON-target player's hand (the
//    activator's hand), since the trigger says "a
//    target YOUR OPPONENT controls". Engine
//    sibling helpers `_checkOppPreDamageHand-
//    Reactions` + `_checkOppCreaturePreDamageHand-
//    Reactions` exist for this side.
//  • Activator (`pi`) = opp-of-target. The
//    original damage is negated by returning
//    `{ negated: true }`; the redirect deals the
//    SAME `amount` and `type` to every target the
//    target's owner controls (heroes + face-up
//    Creatures), sourced from the SAME source so
//    on-damage hooks (Sun Sword burn, Smug Coin,
//    etc.) compose correctly.
//  • Per-source dedup via `gs._rsPromptedFor[pi]`
//    so a multi-target source doesn't re-prompt
//    per-target. Cleared at chain-resolve.
//  • Nested damage: the engine's
//    `_inPreDamageReaction` guard keeps the
//    redirected hits from re-triggering further
//    pre-damage reactions, which prevents an
//    infinite Rocket-Sneeze loop. Each redirected
//    hit still fires its own afterDamage hook
//    (status + arrow riders, etc.).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Rocket Sneeze';
const MAX_TRIGGER_DAMAGE = 50;

module.exports = {
  // Cards.json subtype 'Reaction' + engine validateActionPlay's
  // reaction-subtype filter block proactive Main-Phase casts.
  canActivate: () => false,
  neverPlayable: true,
  // Active in hand + discard so the onChainResolve cleanup hook
  // fires regardless of which zone tracked Rocket Sneeze inst sits
  // in when the chain ends.
  activeIn: ['hand', 'discard'],

  // ── Hero-target path ───────────────────────────────────────────
  isOppPreDamageReaction: true,

  oppPreDamageCondition(gs, pi, engine, target, _targetHeroIdx, _source, amount /*, type */) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!target || target.hp === undefined) return false;
    if (target.hp <= 0) return false;
    if (!(amount > 0) || amount > MAX_TRIGGER_DAMAGE) return false;
    // Trigger only on OPP targets relative to the activator. The
    // engine's helper already routes us here when pi !== targetOwner,
    // but double-check for safety in case the wiring shifts later.
    const targetOwner = engine.gs.players.findIndex(ps => (ps.heroes || []).includes(target));
    if (targetOwner === pi) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async oppPreDamageResolve(engine, pi, _target, _targetHeroIdx, source, amount, type) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const oi = pi === 0 ? 1 : 0; // target's controller side
    await _spreadDamage(engine, pi, oi, source, amount, type);
    engine.log('rocket_sneeze_redirect', {
      player: gs.players[pi]?.username, amount, type, source: source?.name,
    });
    return { negated: true };
  },

  // ── Creature-target path ────────────────────────────────────────
  isOppCreaturePreDamageReaction: true,

  oppCreaturePreDamageCondition(gs, pi, engine, creatureInst, _source, amount /*, type */) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!creatureInst || creatureInst.zone !== 'support' || creatureInst.faceDown) return false;
    if (!(amount > 0) || amount > MAX_TRIGGER_DAMAGE) return false;
    const ctrl = creatureInst.controller ?? creatureInst.owner;
    if (ctrl === pi) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async oppCreaturePreDamageResolve(engine, pi, creatureInst, source, amount, type) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const oi = creatureInst.controller ?? creatureInst.owner;
    await _spreadDamage(engine, pi, oi, source, amount, type);
    engine.log('rocket_sneeze_redirect_creature', {
      player: gs.players[pi]?.username, amount, type, source: source?.name,
    });
    return { negated: true };
  },

  hooks: {
    /**
     * Chain-resolve cleanup. The per-player prompt-dedup flag is
     * scoped to a single chain; clear it so a fresh damage source
     * next chain re-prompts.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._rsPromptedFor) delete gs._rsPromptedFor;
    },
  },
};

/** Per-player per-source dedup — cleared at chain-resolve. */
function _alreadyPrompted(gs, pi) {
  return !!gs._rsPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._rsPromptedFor) gs._rsPromptedFor = {};
  gs._rsPromptedFor[pi] = true;
}

/**
 * Deal `amount` of `type` damage to every face-up target controlled by
 * `targetCtrlPi` (heroes + Creatures), sourced from `source`. Damage
 * is delivered through the standard `actionDealDamage` /
 * `actionDealCreatureDamage` paths so afterDamage hooks, on-hit
 * status, equipment riders, and pile routing all compose correctly.
 * Skips face-down Surprise creatures (untargetable).
 */
async function _spreadDamage(engine, pi, targetCtrlPi, source, amount, type) {
  const gs = engine.gs;
  const ops = gs.players[targetCtrlPi];
  if (!ops) return;

  // Sneeze animation broadcast on the activator's side first.
  engine._broadcastEvent('play_zone_animation', {
    type: 'rocket_sneeze',
    owner: pi, heroIdx: -1, zoneSlot: -1,
  });
  await engine._delay(200);

  // Build snapshot list BEFORE damage so on-death cascades don't
  // shorten the iteration mid-loop. Heroes by index; Creatures by
  // instance id.
  const heroHits = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (h?.name && h.hp > 0) heroHits.push({ hi });
  }

  const cardDB = engine._getCardDB();
  const creatureHitIds = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== targetCtrlPi) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    creatureHitIds.push(inst.id);
  }

  // Carry the original source through — the redirected hits keep the
  // original's identity so on-damage hooks fire as if the source had
  // hit each new target directly. Falls back to a synthetic
  // Rocket-Sneeze source when no original source was supplied.
  const carriedSource = source || { name: CARD_NAME, owner: pi };

  // Pre-damage post-target window for the redirect itself — gives SG
  // / SA / BS / HR / CIB on the OPP side a chance to consolidate. The
  // engine's `_inPreDamageReaction` guard prevents own-side per-
  // target windows from re-firing, but the post-target hub is a
  // separate path and stays open.
  {
    const tgts = [
      ...heroHits.map(({ hi }) => {
        const h = ops.heroes[hi];
        return { type: 'hero', owner: targetCtrlPi, heroIdx: hi, cardName: h?.name };
      }),
      ...creatureHitIds.map(id => {
        const inst = engine.cardInstances.find(c => c.id === id);
        if (!inst) return null;
        return {
          type: 'creature',
          owner: inst.controller ?? inst.owner,
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name,
        };
      }).filter(Boolean),
    ];
    if (tgts.length > 0) {
      await engine.preDamageMultiTargetWindow(carriedSource, tgts);
    }
  }

  // Phase 1: simultaneous explosion animations on every affected
  // target. Broadcasts are flushed synchronously to the client, so
  // every explosion event arrives before the JS yields — they mount
  // and play in the same frame. Fires for ALL targets in the redirect
  // list, including ones that will fizzle damage downstream (sculpture-
  // shielded, immune, etc.) — the visual is "everyone gets hit by the
  // sneeze", separate from whether the damage actually lands. Mirror
  // of Guardian Beast Hou's two-phase pattern (anim → delay → damage).
  for (const { hi } of heroHits) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: targetCtrlPi, heroIdx: hi, zoneSlot: -1,
    });
  }
  for (const id of creatureHitIds) {
    const inst = engine.cardInstances.find(c => c.id === id);
    if (!inst) continue;
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion',
      owner: inst.controller ?? inst.owner,
      heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
  }
  // Shared beat so the explosions play out before HP starts dropping.
  if (heroHits.length > 0 || creatureHitIds.length > 0) {
    await engine._delay(450);
  }

  // Phase 2: deliver hero damage in turn order — sequential so
  // afterDamage hooks settle per target.
  for (const { hi } of heroHits) {
    const live = ops.heroes?.[hi];
    if (!live?.name || live.hp <= 0) continue;
    await engine.actionDealDamage(carriedSource, live, amount, type);
  }

  // Deliver creature damage by id-lookup (instance might have moved /
  // died from a prior hit in the same batch).
  for (const id of creatureHitIds) {
    const inst = engine.cardInstances.find(c => c.id === id);
    if (!inst || inst.zone !== 'support') continue;
    await engine.actionDealCreatureDamage(
      carriedSource, inst, amount, type,
      { sourceOwner: pi, canBeNegated: true },
    );
  }
}
