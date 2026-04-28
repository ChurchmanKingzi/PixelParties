// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Coolness"
//  Spell (Summoning Magic Lv1, Normal, Trials)
//
//  Restrictions:
//    • Once per game (engine `oncePerGame`).
//    • Cannot be played if any Attack or Spell
//      has already been played this turn (the
//      lockout is symmetric — see `spellPlayCondition`).
//
//  Effect:
//    Stamp a generic "Extra Life" mark on a chosen
//    target the controller controls (any of their
//    own Heroes — including the user — or any of
//    their own Creatures). The next time that
//    target would be defeated, the mark is consumed
//    and the target is fully revived/healed. The
//    mark persists across turns until consumed.
//
//    On resolve, also stamps `_attackSpellLockedTurn`
//    so the controller cannot play any further
//    Attacks or Spells this turn (engine-side gate
//    in `validateActionPlay`).
//
//  Implementation notes:
//    • The Extra Life mark itself is a generic
//      engine mechanic — the engine checks for
//      `target._extraLife` (heroes) or
//      `inst.counters._extraLife` (creatures) and
//      handles the revive automatically. This script
//      only stamps the mark; it does not subscribe
//      to KO/death hooks.
//    • The mark stores `{ by: 'Trial of Coolness' }`
//      for log attribution.
//    • The badge UI is keyed off the same fields
//      (see app-shared.jsx `StatusBadges`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Trial of Coolness';
const ONCE_PER_GAME_KEY = 'trialOfCoolness';

// "Target" in card-text terms covers Heroes and Creatures — never
// Equipment, Attachment-Spells, or other support-zone residents.
function _hasEligibleTarget(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  // Own heroes (alive, not already marked) — the user/caster is valid.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h._extraLife) continue;
    return true;
  }
  // Own Creatures only — engine is required for the cardType lookup.
  if (!engine) return false;
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    if (inst.counters?._extraLife) continue;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    return true;
  }
  return false;
}

module.exports = {
  oncePerGame: true,
  oncePerGameKey: ONCE_PER_GAME_KEY,

  // Pre-resolution gates:
  //   • At least one eligible target must exist.
  //   • No prior Attacks or Spells this turn (mirrors the post-resolve
  //     lock — Trial demands the turn be entirely Trial-or-nothing).
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.attacksPlayedThisTurn || 0) > 0) return false;
    if ((ps.spellsPlayedThisTurn || 0) > 0) return false;
    return _hasEligibleTarget(gs, pi, engine);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine    = ctx._engine;
      const gs        = ctx.gameState;
      const pi        = ctx.cardOwner;
      const ps        = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Build target list. "Targets" in card-text terms means Heroes
      // and Creatures only — Equipment, Attachment-Spells, and any
      // other non-Creature support-zone residents are ineligible.
      // Targets already carrying _extraLife are also excluded (the
      // mark would just overwrite, wasting the spell). The casting
      // hero (the user) is itself a valid pick.
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (h._extraLife) continue;
        targets.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.faceDown) continue;
        if (inst.counters?._extraLife) continue;
        const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }

      if (targets.length === 0) { gs._spellCancelled = true; return; }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Choose any Hero or Creature you control to grant an Extra Life.',
        confirmLabel: '🌟 Bestow!',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
      });
      if (!picked || picked.length === 0) { gs._spellCancelled = true; return; }

      const target = targets.find(t => t.id === picked[0]);
      if (!target) { gs._spellCancelled = true; return; }

      // ── Stamp the Extra Life mark ─────────────────────────────────
      const lifeMark = { by: CARD_NAME };
      let stampedName, stampedOwner, stampedHeroIdx, stampedZoneSlot;
      if (target.type === 'hero') {
        const h = ps.heroes[target.heroIdx];
        if (!h?.name || h.hp <= 0 || h._extraLife) { gs._spellCancelled = true; return; }
        h._extraLife = lifeMark;
        stampedName = h.name;
        stampedOwner = pi;
        stampedHeroIdx = target.heroIdx;
        stampedZoneSlot = -1;
      } else { // 'equip' (creature)
        const inst = engine.cardInstances.find(c =>
          c.zone === 'support' && c.owner === target.owner
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst || inst.counters?._extraLife) { gs._spellCancelled = true; return; }
        if (!inst.counters) inst.counters = {};
        inst.counters._extraLife = lifeMark;
        stampedName = inst.name;
        stampedOwner = inst.owner;
        stampedHeroIdx = inst.heroIdx;
        stampedZoneSlot = inst.zoneSlot;
      }

      // ── Lock out further Attacks/Spells this turn ────────────────
      // Engine-side `validateActionPlay` consults this flag and refuses
      // any further Spell or Attack play from the player's hand.
      ps._attackSpellLockedTurn = gs.turn;

      // Visual flourish on the marked target.
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival',
        owner: stampedOwner, heroIdx: stampedHeroIdx, zoneSlot: stampedZoneSlot,
      });

      engine.log('trial_of_coolness', {
        player: ps.username, target: stampedName,
        targetType: target.type === 'hero' ? 'hero' : 'creature',
      });
      engine.sync();
    },
  },
};
