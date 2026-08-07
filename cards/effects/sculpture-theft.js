// ═══════════════════════════════════════════
//  CARD EFFECT: "Sculpture Theft"
//  Spell (Reaction) — Magic Arts Lv1
//
//  Activate immediately when one or more
//  Creatures are Frozen on the board. Choose
//  one Frozen Creature and return it to its
//  original owner's hand.
//
//  Wiring — uses the standard chain-reaction
//  system. The trigger predicate is broad
//  ("≥1 Frozen Creature on the board"); the
//  Reaction subtype + `canActivate: () => false`
//  prevents proactive Main-Phase casts. The
//  player accepts the prompt during any open
//  reaction window where a Frozen Creature
//  exists.
//
//  Return-to-hand uses the same pattern Noble
//  Mummy Guards uses for ability bouncing:
//  splice the support slot, fire
//  `onCardLeaveZone`, then push the card name
//  onto the originalOwner's hand and untrack
//  the instance.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sculpture Theft';

module.exports = {
  // BORIS-EINSCHRAENKUNG (Klausel 1, Als Praezisierung 5.8.): nimmt eine beliebige gefrorene Creature auf die eigene Hand.
  // Trifft jede gefrorene Creature, beide Seiten — deshalb NICHT sperren, sondern bei
  // wirksamem Boris beim Gegner nur dessen Seite ausblenden. Solange
  // es eigene legale Ziele gibt, bleibt der Effekt nutzbar.
  stealsFromEitherSide: true,

  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    // Strictly chainable to "a Creature was just Frozen" — not to any
    // ambient world state. The trigger window opens via the engine's
    // generic reaction check fired off `ON_STATUS_APPLIED`; we gate
    // on the specific hook name + payload so unrelated reaction
    // windows (card plays, damage, hero KO, …) don't let Sculpture
    // Theft sneak in.
    if (chainCtx?.hookName !== 'onStatusApplied') return false;
    const hc = chainCtx.hookCtx || {};
    const statusName = hc.statusName || hc.status;
    if (statusName !== 'frozen') return false;
    if (!hc._onCreature) return false;
    // Verify the freshly-Frozen Creature is still around to bounce —
    // a subsequent same-tick effect might have already removed it.
    const justFrozen = hc.target;
    if (!justFrozen || justFrozen.zone !== 'support') return false;
    if (!justFrozen.counters?.frozen) return false;

    // At least one Hero on pi's side must be able to cast Sculpture
    // Theft (Magic Arts Lv1). Mirrors Cure's gate.
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()[CARD_NAME];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) return true;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)
          && (ps.heroes[hi]?.hp > 0)
          && !ps.heroes[hi].statuses?.frozen
          && !ps.heroes[hi].statuses?.stunned
          && !ps.heroes[hi].statuses?.negated) return true;
    }
    return false;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, _chain, _myIdx) => {
    const candidates = [];
    // BORIS-EINSCHRAENKUNG (Als Praezisierung 5.8.): hat der Gegner
    // einen wirksamen Boris, faellt SEINE Seite als Quelle weg — die
    // eigene bleibt waehlbar.
    const nurEigene = engine.borisHidesOpponentSide?.(pi) === true;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (!inst.counters?.frozen) continue;
      if (nurEigene && inst.owner !== pi) continue;
      candidates.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
    if (candidates.length === 0) return false;

    // Auto-target when there's only one candidate — skip the picker.
    let target;
    if (candidates.length === 1) {
      target = candidates[0];
    } else {
      const picked = await engine.promptEffectTarget(pi, candidates, {
        title: CARD_NAME,
        description: 'Add a Frozen Creature to your hand.',
        confirmLabel: '🎁 Steal!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) return false;
      target = candidates.find(t => t.id === picked[0]);
      if (!target) return false;
    }

    const inst = target.cardInstance;
    if (!inst || inst.zone !== 'support') return false;

    // Capture the source slot's coordinates BEFORE we mutate the
    // board, and broadcast the pile-transfer flight so the client
    // animates the Creature from its actual board position to its
    // landing slot in the caster's hand. The broadcast must fire
    // BEFORE the splice — the client takes its source bounding rect
    // from the still-rendered support slot. Pairs with the
    // pre-registered hand-arrival counter inside the pile-transfer
    // handler, so the hand-grow auto-animator doesn't fire a
    // duplicate flight from opp's hand container.
    // PHYSICAL side is where the supportZones array actually contains
    // this Creature. Stays equal to `inst.owner` for normal creatures
    // and for temporary steals (Deepsea Succubus); flips to controller
    // for permanent cross-side placements (Chilly Wizard given to opp).
    // Without this, the splice silently failed and left a stale
    // creature name on opp's slot while still pushing a fresh copy
    // into the caster's hand.
    const physicalSide = (inst.stolenBy != null)
      ? inst.owner
      : (inst.controller ?? inst.owner);
    const casterPs = engine.gs.players[pi];
    const incomingHandIdx = casterPs ? casterPs.hand.length : 0;
    engine._broadcastEvent('play_pile_transfer', {
      fromOwner: physicalSide, toOwner: pi,
      cardName: inst.name,
      from: 'support', to: 'hand',
      fromHeroIdx: inst.heroIdx, fromSlotIdx: inst.zoneSlot,
      toHandIdx: incomingHandIdx,
    });

    const sourcePs = engine.gs.players[physicalSide];
    const supSlot = sourcePs?.supportZones?.[inst.heroIdx];
    if (supSlot && Array.isArray(supSlot[inst.zoneSlot])) {
      const arr = supSlot[inst.zoneSlot];
      const idx = arr.indexOf(inst.name);
      if (idx >= 0) arr.splice(idx, 1);
    }

    // Fire onCardLeaveZone so listeners (Tempeste / Big Gwen / etc.) see
    // the Creature leave normally. `fromOwner` reports the physical side
    // — listeners that gate on "from MY side" should see opp's side for
    // a cross-side-given Chilly Wizard being stolen back.
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst, leavingCard: inst,
      fromZone: 'support', fromHeroIdx: inst.heroIdx,
      fromZoneSlot: inst.zoneSlot,
      fromOwner: physicalSide,
      toZone: 'hand',
      _skipReactionCheck: true,
    });

    // Hand-add to the SCULPTURE THEFT CASTER's pile, regardless of who
    // originally owned the Creature — per updated card text the Theft
    // always adds the Creature to the user's hand.
    if (casterPs) {
      casterPs.hand.push(inst.name);
    }
    engine._untrackCard(inst.id);
    engine.log('sculpture_theft', {
      player: engine.gs.players[pi]?.username,
      card: inst.name, stolenFrom: inst.owner,
    });
    engine.sync();
    return true;
  },
};
