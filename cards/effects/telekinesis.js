// ═══════════════════════════════════════════
//  CARD EFFECT: "Telekinesis"
//  Spell — Activate a face-down Surprise
//
//  Choose a face-down Surprise you control and
//  activate it. If its effect normally targets
//  based on what triggered it, you choose the
//  target instead.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { ZONES } = require('./_hooks');

module.exports = {
  activeIn: ['hand'],

  // Additional Action if the hero has Magic Arts level 1+
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.negated) return false;
    const abZones = ps.abilityZones?.[heroIdx] || [];
    let magicArtsCount = 0;
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      for (const abName of slot) {
        if (abName === 'Magic Arts') magicArtsCount++;
      }
    }
    return magicArtsCount >= 1;
  },

  // Block the spell if no eligible face-down surprises exist
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      const sz = ps.surpriseZones?.[hi] || [];
      if (sz.length > 0) {
        const script = loadCardEffect(sz[0]);
        if (script?.isSurprise && script.canTelekinesisActivate !== false) {
          // Also check canTelekinesisActivate function if present
          if (typeof script.canTelekinesisActivate !== 'function' || (engine && script.canTelekinesisActivate(engine, playerIdx))) return true;
        }
      }
      // Bakhm support zones
      if (engine) {
        const heroScript = loadCardEffect(hero.name);
        if (heroScript?.isBakhmHero) {
          for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
            const slot = (ps.supportZones[hi] || [])[si] || [];
            if (slot.length === 0) continue;
            const inst = engine.cardInstances.find(c =>
              c.owner === playerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.faceDown
            );
            if (!inst) continue;
            const cScript = loadCardEffect(inst.name);
            if (cScript?.isSurprise && cScript.canTelekinesisActivate !== false) {
              if (typeof cScript.canTelekinesisActivate !== 'function' || cScript.canTelekinesisActivate(engine, playerIdx)) return true;
            }
          }
        }
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // Build list of eligible face-down surprises
      const targets = _getEligibleTelekinesisTargets(engine, pi);
      if (targets.length === 0) return;

      // Prompt player to select a surprise
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: 'Telekinesis',
        description: 'Choose a face-down Surprise to activate:',
        confirmLabel: '🔮 Activate!',
        confirmClass: 'btn-success',
        cancellable: true,
        allowNonCreatureEquips: true,
        maxTotal: 1,
      });

      if (!selectedIds || selectedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      const surpriseCardName = target.cardName;
      const heroIdx = target.heroIdx;
      const script = loadCardEffect(surpriseCardName);
      if (!script) return;

      // Activate the surprise with telekinesis sourceInfo
      const sourceInfo = {
        telekinesis: true,
        activatorIdx: pi === 0 ? 1 : 0, // "opponent" for Mummy Maker Machine compatibility
      };

      const isBakhmSlot = target.isBakhmSlot || false;
      const bakhmZoneSlot = target.bakhmZoneSlot ?? -1;
      const activateOpts = isBakhmSlot ? { isBakhmSlot: true, bakhmZoneSlot } : {};

      await engine._activateSurprise(pi, heroIdx, surpriseCardName, sourceInfo, script, activateOpts);
    },
  },
};

/**
 * Find all face-down surprises the player controls that can be
 * activated by Telekinesis.
 */
function _getEligibleTelekinesisTargets(engine, playerIdx) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const targets = [];

  // Regular surprise zones
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const sz = ps.surpriseZones?.[hi] || [];
    if (sz.length === 0) continue;

    const cardName = sz[0];
    const script = loadCardEffect(cardName);
    if (!script?.isSurprise) continue;
    if (script.canTelekinesisActivate === false) continue;
    if (typeof script.canTelekinesisActivate === 'function' && !script.canTelekinesisActivate(engine, playerIdx)) continue;

    // Check hero can activate (spell school/level)
    if (!engine._canHeroActivateSurprise(playerIdx, hi, cardName)) continue;

    targets.push({
      id: `surprise-${playerIdx}-${hi}`,
      type: 'surprise',
      owner: playerIdx,
      heroIdx: hi,
      cardName,
      isBakhmSlot: false,
    });
  }

  // Bakhm support zones (face-down surprise creatures)
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const heroScript = loadCardEffect(hero.name);
    if (!heroScript?.isBakhmHero) continue;

    for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const cardName = slot[0];
      const inst = engine.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.name === cardName
      );
      if (!inst?.faceDown) continue;

      const script = loadCardEffect(cardName);
      if (!script?.isSurprise) continue;
      if (script.canTelekinesisActivate === false) continue;
    if (typeof script.canTelekinesisActivate === 'function' && !script.canTelekinesisActivate(engine, playerIdx)) continue;

      // Check hero can activate (Bakhm bypasses this, but check anyway for consistency)
      if (!engine._canHeroActivateSurprise(playerIdx, hi, cardName, { isBakhmSlot: true })) continue;

      targets.push({
        id: `equip-${playerIdx}-${hi}-${si}`,
        type: 'equip',
        owner: playerIdx,
        heroIdx: hi,
        slotIdx: si,
        cardName,
        isBakhmSlot: true,
        bakhmZoneSlot: si,
      });
    }
  }

  return targets;
}
