// ═══════════════════════════════════════════
//  CARD EFFECT: "Bomblebee"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  Once per turn, when a target your opponent
//  controls is defeated, you may choose a target
//  your opponent controls and deal 150 damage
//  to it.
//
//  "May" — cancellable. HOPT keyed per inst so
//  multiple Bomblebees on the same side each get
//  their own once-per-turn trigger. Burning Fuse
//  re-fires this body via runOpponentDeathPayload
//  with bypassHopt:true, so the natural HOPT and
//  the "fire even if already triggered" pathway
//  are kept on the same code path.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isOpponentTargetDeath } = require('./_bomblebee-shared');

const CARD_NAME   = 'Bomblebee';
const DAMAGE      = 150;
const ANIM_TYPE   = 'bomblebee_blast';
const HOPT_PREFIX = 'bomblebee';

// Build the list of legal targets — every live opp Hero plus every
// face-up opp creature in a support zone. Cardinal-immune creatures stay
// in the picker (they're targetable; the damage fizzles silently at the
// engine's immunity gate, matching the convention used by Bomb Arrow).
function opponentTargets(engine, listenerOwner) {
  const gs = engine.gs;
  const oi = listenerOwner === 0 ? 1 : 0;
  const ops = gs.players[oi];
  if (!ops) return [];

  const out = [];
  // Heroes
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({
      id: `hero-${oi}-${hi}`,
      type: 'hero',
      owner: oi, heroIdx: hi,
      cardName: h.name,
    });
  }
  // Creatures — read from cardInstances so creatures on dead heroes still
  // appear (matching the convention used elsewhere in the codebase).
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const owner = inst.controller ?? inst.owner;
    if (owner !== oi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

/**
 * The shared payload body. Called both by the natural onCreatureDeath /
 * onHeroKO listener (with HOPT enforced) AND by Burning Fuse via
 * `_bomblebee-shared.triggerBomblebeeAsIfDeath` (with bypassHopt).
 */
async function runOpponentDeathPayload(engine, inst, opts = {}) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const heroIdx = inst.heroIdx;

  const hoptKey = `${HOPT_PREFIX}:${inst.id}`;
  if (!opts.bypassHopt) {
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
  }

  const targets = opponentTargets(engine, pi);
  if (targets.length === 0) return;

  // Cancellable per text ("you may"). Engine wraps the prompt; if the
  // player picks nothing, treat as a skip — neither HOPT stamp nor
  // animation should fire (no commitment without a hit).
  const picked = await engine.promptEffectTarget(pi, targets, {
    title: CARD_NAME,
    description: `An opponent target was defeated! Choose a target to deal ${DAMAGE} damage to.`,
    confirmLabel: `💥 ${DAMAGE} Damage!`,
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!picked || picked.length === 0) return;

  const target = targets.find(t => t.id === picked[0]);
  if (!target) return;

  // Stamp HOPT only after commitment — matches the engine's "stamp on
  // success" convention so a fizzle doesn't burn the slot.
  if (!opts.bypassHopt) {
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey] = gs.turn;
  }

  const source = {
    name: CARD_NAME, owner: pi,
    heroIdx, cardInstance: inst,
  };

  // Visual: explosion on the picked target zone.
  engine._broadcastEvent('play_zone_animation', {
    type: ANIM_TYPE,
    owner: target.owner,
    heroIdx: target.heroIdx,
    zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
  });
  await engine._delay(350);

  if (target.type === 'hero') {
    const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (tgtHero && tgtHero.hp > 0) {
      await engine.actionDealDamage(source, tgtHero, DAMAGE, 'creature');
    }
  } else if (target.cardInstance) {
    await engine.actionDealCreatureDamage(
      source, target.cardInstance, DAMAGE, 'creature',
      { sourceOwner: pi, canBeNegated: true },
    );
  }

  engine.log('bomblebee_strike', {
    player: gs.players[pi]?.username,
    target: target.cardName,
    damage: DAMAGE,
    bypassHopt: !!opts.bypassHopt,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  // Exposed so Burning Fuse's re-trigger path can find this body via
  // _bomblebee-shared.triggerBomblebeeAsIfDeath.
  runOpponentDeathPayload,

  hooks: {
    onCreatureDeath: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      // The dying creature might be ANOTHER Bomblebee on this side that
      // got hit by an opp effect — but isOpponentTargetDeath already
      // gates on the opp side, so a self-side death never reaches here.
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
    onHeroKO: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
  },
};
