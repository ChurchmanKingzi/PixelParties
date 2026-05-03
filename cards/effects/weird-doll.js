// ═══════════════════════════════════════════
//  CARD EFFECT: "Weird Doll"
//  Artifact (Normal, Cost 0) — Choose an
//  Ability attached to a Hero you control and
//  send it to the discard pile. Delete this
//  card.
//
//  "Heroes you control" includes own heroes AND
//  opponent's heroes you're currently charming
//  (charmedBy === pi). Charmed-from-opponent
//  heroes are skipped if they're immune to all
//  effects (statuses.charmed — Charme 3's own
//  immunity flag — or statuses.immune, the
//  generic one-turn immunity). The check on
//  own heroes is just "still controlled by me"
//  — i.e. NOT charmed by the opponent.
//
//  Removal mirrors Fire Bomb's ability-zone
//  pop: top stack copy is removed, onCardLeaveZone
//  fires, and the card routes to the original
//  owner's discard pile (so a stolen ability,
//  if any, returns to its original owner's pile,
//  not the current zone host's).
//
//  deleteOnUse — Weird Doll itself goes to the
//  deleted pile after resolution per "Delete
//  this card."
// ═══════════════════════════════════════════

const CARD_NAME = 'Weird Doll';

module.exports = {
  isTargetingArtifact: true,
  deleteOnUse: true,

  // Skip the engine's default 💥 explosion on the picked target — the
  // doll-grow animation we broadcast manually below is the whole show.
  animationType: 'none',

  canActivate(gs, pi) {
    return _enumerateControlledAbilities(gs, pi).length > 0;
  },

  getValidTargets(gs, pi) {
    return _enumerateControlledAbilities(gs, pi).map(ab => ({
      id: `ability-${ab.zoneOwner}-${ab.heroIdx}-${ab.slotIdx}`,
      type: 'ability',
      owner: ab.zoneOwner,
      heroIdx: ab.heroIdx,
      slotIdx: ab.slotIdx,
      cardName: ab.cardName,
      level: ab.level,
    }));
  },

  targetingConfig: {
    description: 'Choose an Ability attached to one of your Heroes — it will be sent to the discard pile.',
    confirmLabel: '🎎 Send to Discard!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { ability: 1 },
  },

  validateSelection(selectedIds /*, validTargets */) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'ability') return { cancelled: true };

    // Re-validate at resolve time — control / immunity could have
    // shifted between target selection and resolution.
    const stillValid = _enumerateControlledAbilities(engine.gs, pi).some(ab =>
      ab.zoneOwner === target.owner &&
      ab.heroIdx   === target.heroIdx &&
      ab.slotIdx   === target.slotIdx
    );
    if (!stillValid) return { cancelled: true };

    const zonePs = engine.gs.players[target.owner];
    const zone = (zonePs?.abilityZones?.[target.heroIdx] || [])[target.slotIdx] || [];
    if (zone.length === 0) return { cancelled: true };

    // Doll-grow animation on the host hero (zoneSlot: -1 anchors to
    // the hero portrait, not the ability slot). Plays before the
    // ability vanishes so the visual reads as the doll consuming it.
    engine._broadcastEvent('play_zone_animation', {
      type:     'weird_doll_grow',
      owner:    target.owner,
      heroIdx:  target.heroIdx,
      zoneSlot: -1,
    });
    await engine._delay(700);

    // Pop the top copy off the stack — same convention as Fire Bomb /
    // Magic Amethyst: "send an Ability to discard" removes one copy,
    // not the whole stack.
    const removedName = zone.pop();

    // Locate the instance to fire onCardLeaveZone and route the discard
    // to the ability's ORIGINAL owner (handles stolen / borrowed
    // abilities — same routing Fire Bomb uses).
    const inst = engine.cardInstances.find(c =>
      c.owner    === target.owner   &&
      c.zone     === 'ability'      &&
      c.heroIdx  === target.heroIdx &&
      c.zoneSlot === target.slotIdx &&
      c.name     === removedName
    );
    if (inst) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard:   inst,
        card:        inst,
        fromZone:    'ability',
        fromHeroIdx: target.heroIdx,
      });
      engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
      const discardPs = engine.gs.players[inst.originalOwner];
      if (discardPs) discardPs.discardPile.push(removedName);
      else zonePs.discardPile.push(removedName);
    } else {
      zonePs.discardPile.push(removedName);
    }

    engine.log('weird_doll', {
      player:     engine.gs.players[pi]?.username,
      ability:    removedName,
      heroOwner:  target.owner,
      heroIdx:    target.heroIdx,
      slot:       target.slotIdx,
    });
    engine.sync();
    return true;
  },
};

// ─── Helpers ────────────────────────────────

/**
 * Enumerate every ability zone whose host hero is currently controlled
 * by `pi`. "Controlled" means:
 *   • Own hero NOT being charmed away by the opponent, OR
 *   • Opponent's hero we are currently charming (charmedBy === pi),
 *     provided that hero is not made immune to all effects
 *     (statuses.charmed from Charme 3 — or the generic
 *     statuses.immune flag).
 *
 * Dead heroes are kept in the set: abilities persist on a hero's sheet
 * after KO and remain legitimate targets, matching Fire Bomb.
 *
 * Returns: [{ zoneOwner, heroIdx, slotIdx, cardName, level }]
 */
function _enumerateControlledAbilities(gs, pi) {
  const out = [];
  const oi  = pi === 0 ? 1 : 0;

  const myPs = gs.players[pi];
  if (myPs) {
    for (let hi = 0; hi < (myPs.heroes || []).length; hi++) {
      const h = myPs.heroes[hi];
      if (!h?.name) continue;
      // Own hero charmed away by the opponent — they currently control it.
      if (h.charmedBy != null && h.charmedBy !== pi) continue;
      _pushHeroAbilities(myPs, hi, pi, out);
    }
  }

  const ops = gs.players[oi];
  if (ops) {
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (!h?.name) continue;
      if (h.charmedBy !== pi) continue;
      // Charme 3 sets statuses.charmed → "immune to all effects".
      // Skip on either the dedicated charmed-immunity flag or the
      // generic immune flag.
      if (h.statuses?.charmed) continue;
      if (h.statuses?.immune)  continue;
      _pushHeroAbilities(ops, hi, oi, out);
    }
  }

  return out;
}

function _pushHeroAbilities(playerState, heroIdx, zoneOwner, out) {
  const zones = playerState.abilityZones?.[heroIdx] || [];
  for (let zi = 0; zi < zones.length; zi++) {
    const slot = zones[zi] || [];
    if (slot.length === 0) continue;
    out.push({
      zoneOwner,
      heroIdx,
      slotIdx:  zi,
      cardName: slot[slot.length - 1],
      level:    slot.length,
    });
  }
}
