// ═══════════════════════════════════════════
//  CARD EFFECT: "Forceful Revival"
//  Attack (Fighting Lv1, Normal)
//
//  Effect (level scales with the user's effective
//  Fighting count — Heal's pattern):
//    Choose a level X-or-lower Creature from your
//    discard pile (X = caster's Fighting level)
//    and place it into a free Support Zone of the
//    user. The user takes damage equal to that
//    Creature's max HP. The placed Creature may
//    activate its active effect this turn (no
//    summoning sickness on the revived copy).
//
//  Implementation notes:
//    • Per-hero gate (`canPlayWithHero`): the user
//      must have a free Support Zone AND the
//      discard pile must contain at least one
//      Creature of level ≤ user's Fighting level.
//      `spellPlayCondition` is a cheap player-level
//      pre-filter (any free zone + any candidate).
//    • Placement uses `summonCreatureWithHooks`
//      (full onPlay + onCardEnterZone), then
//      overrides `inst.turnPlayed` to bypass
//      summoning sickness for THIS instance only.
//    • Self-damage uses `actionDealDamage` with the
//      attack as source so retaliation hooks /
//      damage-trackers see a normal attack-typed
//      hit. If it kills the user, that is intended.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Forceful Revival';

function _fightingLevel(engine, ps, heroIdx) {
  const abZones = ps?.abilityZones?.[heroIdx] || [[], [], []];
  return engine.countAbilitiesForSchool('Fighting', abZones);
}

function _eligibleCreatureNames(engine, ps, maxLevel) {
  if (!ps || maxLevel <= 0) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const cn of (ps.discardPile || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    if ((cd.level || 0) > maxLevel) continue;
    seen.add(cn);
    out.push({ name: cn, source: 'discard', level: cd.level || 0 });
  }
  out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return out;
}

function _userHasFreeSupportSlot(ps, heroIdx) {
  const sup = ps?.supportZones?.[heroIdx] || [];
  return sup.some(slot => (slot || []).length === 0);
}

module.exports = {
  // Effective max-revivable-level scales with the caster's Fighting
  // count — flag for the CPU's ability-stacking scoring so a deck with
  // Forceful Revival keeps Fighting worth stacking past Lv1.
  cpuMeta: { scalesWithSchool: 'Fighting' },

  // Player-level cheap pre-filter so the card greys out in the hand
  // when no eligible target exists anywhere on the player's board.
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least one alive own hero with a free support slot AND a
    // candidate creature in discard at that hero's Fighting level.
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (!_userHasFreeSupportSlot(ps, hi)) continue;
      const lvl = _fightingLevel(engine, ps, hi);
      if (_eligibleCreatureNames(engine, ps, lvl).length > 0) return true;
    }
    return false;
  },

  // Per-hero gate: refuses heroes without a free slot or whose Fighting
  // level can't reach any creature in the discard pile.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (!_userHasFreeSupportSlot(ps, heroIdx)) return false;
    const lvl = _fightingLevel(engine, ps, heroIdx);
    return _eligibleCreatureNames(engine, ps, lvl).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine    = ctx._engine;
      const gs        = ctx.gameState;
      const pi        = ctx.cardOwner;
      const heroIdx   = ctx.cardHeroIdx;
      const ps        = gs.players[pi];
      const userHero  = ps?.heroes?.[heroIdx];
      if (!ps || !userHero?.name || userHero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      const lvl = _fightingLevel(engine, ps, heroIdx);
      const gallery = _eligibleCreatureNames(engine, ps, lvl);
      if (gallery.length === 0) { gs._spellCancelled = true; return; }
      if (!_userHasFreeSupportSlot(ps, heroIdx)) { gs._spellCancelled = true; return; }

      // ── Pick a creature from the discard gallery ─────────────────
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery.map(g => ({ name: g.name, source: 'discard' })),
        title: CARD_NAME,
        description: `Choose a Lv${lvl} or lower Creature from your discard pile to revive on ${userHero.name}.`,
        confirmLabel: '⚡ Revive!',
        confirmClass: 'btn-warning',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) {
        gs._spellCancelled = true;
        return;
      }
      const chosenName = picked.cardName;

      // Re-validate (state may have shifted during the prompt).
      const cardDB = engine._getCardDB();
      const cd = cardDB[chosenName];
      if (!cd || !hasCardType(cd, 'Creature') || (cd.level || 0) > lvl) {
        gs._spellCancelled = true;
        return;
      }
      const dpIdx = (ps.discardPile || []).indexOf(chosenName);
      if (dpIdx < 0) { gs._spellCancelled = true; return; }
      if (!_userHasFreeSupportSlot(ps, heroIdx)) { gs._spellCancelled = true; return; }

      // ── Pop from discard and summon onto the user hero ───────────
      ps.discardPile.splice(dpIdx, 1);

      const summonRes = await engine.summonCreatureWithHooks(
        chosenName, pi, heroIdx, -1,
        { source: CARD_NAME, hookExtras: { _isForcefulRevival: true } }
      );
      if (!summonRes?.inst) {
        // Summon fizzled (rare — beforeSummon refused, etc.). Refund the
        // discarded copy so the user isn't out a card AND a spell.
        ps.discardPile.push(chosenName);
        gs._spellCancelled = true;
        return;
      }

      const { inst, actualSlot } = summonRes;

      // Bypass summoning sickness for THIS instance only — the card text
      // explicitly grants "may activate its active effect this turn."
      // turnPlayed = previous turn means the standard
      // `inst.turnPlayed === gs.turn` HOPT gate evaluates false.
      inst.turnPlayed = (gs.turn || 0) - 1;

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx, zoneSlot: actualSlot, cardName: chosenName,
      });

      // ── Self-damage equal to the revived Creature's max HP ───────
      const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
      if (maxHp > 0) {
        const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
        await engine.actionDealDamage(attackSource, userHero, maxHp, 'attack');
      }

      engine.log('forceful_revival', {
        player: ps.username, hero: userHero.name,
        creature: chosenName, level: cd.level || 0,
        selfDamage: maxHp,
      });
      engine.sync();
    },
  },
};
