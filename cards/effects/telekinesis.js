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
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hand'],

  // Additional Action if the hero has Magic Arts level 1+
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Centralized incapacitation gate — rejects dead / Frozen /
    // Stunned / Bound / hard-Negated Heroes. Weakening-Crystal-
    // sourced negation is the lighter "effect-only" form and does
    // NOT disqualify a Hero from acting; the helper handles the
    // distinction so we don't duplicate it here.
    if (engine?.isHeroIncapacitated?.(pi, heroIdx)) return false;
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
    // Als Vorgabe 29.9.: „a face-down Surprise you control" — Zonen nach
    // Kontrolle, auch am geliehenen Helden (`_getAllSurpriseEntries`).
    if (engine && _regulaereZonen(engine, playerIdx).some(e => {
      const script = loadCardEffect(e.cardName);
      if (!script?.isSurprise || script.canTelekinesisActivate === false) return false;
      return typeof script.canTelekinesisActivate !== 'function' || script.canTelekinesisActivate(engine, playerIdx);
    })) return true;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
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
      const seite = target.owner ?? pi;   // Als Vorgabe 29.9.: Brettseite der Zone
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

      // Eigenes Aufdecken (Als Vorgabe 26.9.): die Surprise schwebt mit
      // Schatten hoch, wackelt, dreht sich in der Luft um und landet offen
      // in ihrer Zone — erst dann laeuft ihr Effekt, ohne das uebliche
      // Aufdeck-Blitzen.
      engine._broadcastEvent('play_zone_animation', {
        type: 'telekinese', owner: seite, heroIdx,
        ...(isBakhmSlot ? { zoneSlot: bakhmZoneSlot } : { zoneSlot: -1, zoneType: 'surprise' }),
        cardName: surpriseCardName, duration: 2000,
      });
      await engine._delay(1800);

      await engine._activateSurprise(seite, heroIdx, surpriseCardName, sourceInfo, script, { ...activateOpts, ohneFlip: true });
    },
  },
};

/**
 * Als Vorgabe 29.9.: regulaere Surprise Zones, die `playerIdx` kontrolliert
 * (eigene Spalte + geliehene Helden), Traeger lebend, nicht Frozen/Stunned.
 */
function _regulaereZonen(engine, playerIdx) {
  return (engine._getAllSurpriseEntries?.(playerIdx) || []).filter(e => {
    if (e.isBakhmSlot) return false;
    const hero = engine.gs.players[e.seite ?? playerIdx]?.heroes?.[e.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return !(hero.statuses?.frozen || hero.statuses?.stunned);
  }).map(e => ({ ...e, seite: e.seite ?? playerIdx }));
}

/**
 * Find all face-down surprises the player controls that can be
 * activated by Telekinesis.
 */
function _getEligibleTelekinesisTargets(engine, playerIdx) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const targets = [];

  // Regular surprise zones — Als Vorgabe 29.9.: nach Kontrolle, `owner` = Brettseite.
  for (const { seite, heroIdx: hi, cardName } of _regulaereZonen(engine, playerIdx)) {
    const script = loadCardEffect(cardName);
    if (!script?.isSurprise) continue;
    if (script.canTelekinesisActivate === false) continue;
    if (typeof script.canTelekinesisActivate === 'function' && !script.canTelekinesisActivate(engine, playerIdx)) continue;

    // Check hero can activate (spell school/level)
    if (!engine._canHeroActivateSurprise(seite, hi, cardName, { reaktor: playerIdx })) continue;

    targets.push({
      id: `surprise-${seite}-${hi}`,
      type: 'surprise',
      owner: seite,
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
