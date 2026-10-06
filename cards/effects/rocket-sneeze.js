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
    // Kontrolle statt Seite (Styx 28.9.)
    if (targetOwner < 0 || engine.heroSideOf(targetOwner, target) === pi) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async oppPreDamageResolve(engine, pi, _target, _targetHeroIdx, source, amount, type) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const oi = engine.opponentOf(pi); // target's controller side
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
  // Kontrolle statt Seite (Styx 28.9.): Helden, die targetCtrlPi
  // kontrolliert, samt physischer Spalte (Ziel-IDs/Animationen).
  const heroHits = [];
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(targetCtrlPi)) {
    if (h?.name && h.hp > 0) heroHits.push({ hi, po: physOwner });
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

  // AoE-Prinzip (markieren/Immunität → reagieren → wirken → Tode): ein zentraler
  // Schlag auf alle Ziele des Gegners. Surprises/Hand-Reaktionen (SG/SA/BS/HR/CIB)
  // reagieren VOR dem ersten Schaden; Explosionen gehen auf alle Ziele gleichzeitig.
  const ziele = [
    ...heroHits.map(({ hi, po }) => ({ type: 'hero', owner: po, heroIdx: hi })),
    ...creatureHitIds
      .map(id => engine.cardInstances.find(c => c.id === id))
      .filter(Boolean)
      .map(inst => ({ type: 'creature', inst })),
  ];
  if (ziele.length === 0) return;
  await engine.dealDamageToTargets(carriedSource, ziele, {
    damage: amount, damageType: type, sourceName: CARD_NAME,
    animationType: 'explosion', animDelay: 450, hitDelay: 0, istFlaeche: true,
  });
}
