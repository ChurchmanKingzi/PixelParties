// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Encounter"
//  Spell (Decay Magic Lv2, Reaction)
//
//  Play immediately when your opponent chooses
//  a Creature in one of your Heroes' Support
//  Zones with an Attack, Spell or Creature
//  effect. Add the Creature back to your hand
//  and place a Creature with a different name
//  whose level is up to 1 higher than the
//  returned Creature's from your hand into the
//  same Support Zone. That Creature becomes
//  your opponent's new target.
//
//  Piggybacks on the engine's post-target hand
//  reaction mechanism (see anti-magic-shield.js
//  for precedent). The engine invokes:
//    • postTargetCondition(...) to gate the
//      prompt
//    • postTargetResolve(...) to execute,
//      returning { newTargets } to inform the
//      calling context about the redirect
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Encounter';

function _isCreatureTarget(t) {
  return t?.type === 'equip' && t.cardInstance;
}

module.exports = {
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard) {
    if (!targetedHeroes?.length) return false;

    // Source must belong to the opponent.
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner === pi || srcOwner < 0) return false;

    // Source type gate: Attack, Spell, or Creature effect (Creature effects
    // come from Creature instances on the board).
    const cardDB = engine._getCardDB();
    const srcData = cardDB[sourceCard?.name];
    if (!srcData) return false;
    const isAttack = hasCardType(srcData, 'Attack');
    const isSpell = hasCardType(srcData, 'Spell');
    const isCreatureEffect = hasCardType(srcData, 'Creature') && sourceCard?.zone === 'support';
    if (!isAttack && !isSpell && !isCreatureEffect) return false;

    // At least one target must be a Creature in one of OUR Support Zones.
    const ownCreatureTargets = targetedHeroes.filter(t =>
      _isCreatureTarget(t) && t.owner === pi
    );
    if (ownCreatureTargets.length === 0) return false;

    // Must have at least one eligible replacement in hand. For each eligible
    // bounced creature, find a different-named Creature in hand with
    // level ≤ bouncedLevel + 1.
    const ps = gs.players[pi];
    if (!ps) return false;
    const handNames = new Set(ps.hand || []);
    for (const tgt of ownCreatureTargets) {
      const bouncedName = tgt.cardName;
      const bouncedLevel = cardDB[bouncedName]?.level || 0;
      const maxLevel = bouncedLevel + 1;
      for (const name of handNames) {
        if (name === bouncedName) continue;
        if (name === CARD_NAME) continue;
        const cd = cardDB[name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if ((cd.level || 0) > maxLevel) continue;
        return true;
      }
    }
    return false;
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return null;
    const cardDB = engine._getCardDB();

    // Pick the first own creature-target from the list.
    const tgt = targetedHeroes.find(t => _isCreatureTarget(t) && t.owner === pi);
    if (!tgt) return null;
    const bouncedInst = tgt.cardInstance;
    const bouncedName = bouncedInst.name;
    const bouncedLevel = cardDB[bouncedName]?.level || 0;
    const maxLevel = bouncedLevel + 1;
    const bouncedHeroIdx = bouncedInst.heroIdx;
    const bouncedSlotIdx = bouncedInst.zoneSlot;

    // Pseudo-ctx for prompting the reactor.
    const promptCtx = engine._createContext(
      { id: 'encounter-pseudo', name: CARD_NAME, owner: pi, controller: pi, zone: 'hand', heroIdx: -1, zoneSlot: -1, counters: {}, faceDown: false },
      {}
    );

    // Build replacement list.
    const seen = new Set();
    const replacements = [];
    for (const n of (ps.hand || [])) {
      if (seen.has(n)) continue;
      if (n === bouncedName) continue;
      if (n === CARD_NAME) continue;
      const cd = cardDB[n];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if ((cd.level || 0) > maxLevel) continue;
      seen.add(n);
      replacements.push({ name: n, source: 'hand', cost: cd.level || 0 });
    }
    if (replacements.length === 0) return null;

    // Bounce the target.
    await returnSupportCreatureToHand(engine, bouncedInst, CARD_NAME);

    // Prompt replacement.
    const picked = await promptCtx.promptCardGallery(replacements, {
      title: CARD_NAME,
      description: `Pick a different-named Creature with level ≤ ${maxLevel} to place.`,
      cancellable: false,
    });
    if (!picked?.cardName) return null;
    const newName = picked.cardName;
    const handIdx = ps.hand.indexOf(newName);
    if (handIdx < 0) return null;
    ps.hand.splice(handIdx, 1);

    const result = await engine.actionPlaceCreature(newName, pi, bouncedHeroIdx, bouncedSlotIdx, {
      source: 'external',
      sourceName: CARD_NAME,
      animationType: 'deep_sea_bubbles',
      fireHooks: true,
    });
    if (!result) return null;

    // Redirect: new target is the replacement creature. Patch gs._spellDamageLog
    // so downstream damage/effect code refers to the new creature. The engine's
    // post-target logic (see _engine.js around line 1392) swaps selected to
    // the returned target object.
    const newTarget = {
      id: `equip-${pi}-${bouncedHeroIdx}-${bouncedSlotIdx}`,
      type: 'equip',
      owner: pi,
      heroIdx: bouncedHeroIdx,
      slotIdx: bouncedSlotIdx,
      cardName: newName,
      cardInstance: result.inst,
    };

    engine.log('deepsea_encounter_redirect', {
      player: ps.username, bounced: bouncedName, placed: newName,
    });
    engine.sync();
    return { newTargets: [newTarget] };
  },
};
