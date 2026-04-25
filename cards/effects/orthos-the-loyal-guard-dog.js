// ═══════════════════════════════════════════
//  HERO: "Orthos, the Loyal Guard Dog"
//  HP 400 / ATK 80 / Toughness + Summoning Magic
//  Archetype: Loyals
//
//  Once per turn, if this Hero summons a "Loyal"
//  Creature, you may immediately have it summon
//  a second "Loyal" Creature from your hand as
//  an additional Action.
//
//  Wiring: passive listener on `onCardEnterZone`.
//  When any Loyal Creature enters Orthos's own
//  Support Zone (i.e. ctx.cardOwner summoned a
//  Loyal AT Orthos's heroIdx), the chain fires
//  once per turn — same shape as Loyal Pinpom's
//  on-summon chain, but driven by the hero
//  rather than by a specific creature.
//
//  HOPT key is hero-instance-scoped so two
//  Orthoses (puzzle setups, future cloning) each
//  get their own once-per-turn slot.
// ═══════════════════════════════════════════

const { isLoyalCreature, getLoyalsInHand } = require('./_loyal-shared');

const CARD_NAME = 'Orthos, the Loyal Guard Dog';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (entering.zone !== 'support') return;
      // Same side — Orthos only chains off OUR summons.
      const enteringOwner = entering.owner ?? entering.controller;
      if (enteringOwner !== ctx.cardOriginalOwner) return;
      // Orthos's hero must have summoned the Loyal — i.e. the entering
      // card landed in OUR heroIdx's support zones.
      if (entering.heroIdx !== ctx.cardHeroIdx) return;
      // Loyal-only.
      if (!isLoyalCreature(entering.name, ctx._engine)) return;
      // CRITICAL: only fire when Orthos himself summoned the Loyal —
      // i.e. the placement went through a hero-gated summon path
      // (doPlayCreature, Pinpom's chain, any future "summon from
      // hand as additional Action" effect). Card-effect placements
      // (Loyal Rottweiler's deck-tutor, Loyal Shepherd's revive,
      // Monster in a Bottle, bounce-place from the Deepsea
      // archetype, …) skip the hero-level gate and therefore don't
      // count as Orthos summoning. The `_isNormalSummon` flag is
      // stamped by doPlayCreature + Pinpom's chain — anything
      // missing it is an external place, no chain.
      if (!ctx._isNormalSummon) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOriginalOwner;
      const ps     = gs.players[pi];
      const orthos = ps?.heroes?.[ctx.cardHeroIdx];
      if (!ps || !orthos?.name || orthos.hp <= 0) return;

      // Once per turn, scoped per Orthos instance.
      const hoptKey = `orthos_chain:${pi}:${ctx.cardHeroIdx}`;
      if (!engine.claimHOPT?.(hoptKey, pi)) return;

      // Eligibility: Loyal in hand AND a free Support Zone on Orthos.
      const handLoyals = getLoyalsInHand(ps, engine);
      if (handLoyals.length === 0) {
        // Nothing to chain — refund the HOPT so we don't burn it.
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }
      const zones = ps.supportZones?.[ctx.cardHeroIdx] || [];
      let freeSlot = -1;
      for (let z = 0; z < 3; z++) {
        if ((zones[z] || []).length === 0) { freeSlot = z; break; }
      }
      if (freeSlot < 0) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // Sample-card level-req gate (all Loyals share Lv1 SM, so any
      // sample passes / fails the same way for Orthos's hero).
      const cardDB = engine._getCardDB();
      const sample = cardDB[handLoyals[0].name];
      if (!sample || !engine.heroMeetsLevelReq(pi, ctx.cardHeroIdx, sample)) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // ── Confirm prompt ──
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Have ${orthos.name} immediately summon a second Loyal Creature from your hand as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🦴 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // ── Pick which Loyal ──
      let pickedLoyal;
      if (handLoyals.length === 1) {
        pickedLoyal = handLoyals[0].name;
      } else {
        const gallery = handLoyals.map(l => ({
          name: l.name, source: 'hand', count: l.count,
        }));
        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: gallery,
          title: CARD_NAME,
          description: 'Choose a Loyal Creature from your hand to summon.',
          cancellable: true,
        });
        if (!res || res.cancelled || !res.cardName) {
          if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
          return;
        }
        pickedLoyal = res.cardName;
      }
      if (!isLoyalCreature(pickedLoyal, engine)) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // Re-pick the slot fresh — board state can shift across awaits.
      const zones2 = ps.supportZones?.[ctx.cardHeroIdx] || [];
      let destSlot = -1;
      for (let z = 0; z < 3; z++) {
        if ((zones2[z] || []).length === 0) { destSlot = z; break; }
      }
      if (destSlot < 0) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      const handIdx = ps.hand.indexOf(pickedLoyal);
      if (handIdx < 0) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }
      ps.hand.splice(handIdx, 1);

      const placed = await engine.summonCreatureWithHooks(
        pickedLoyal, pi, ctx.cardHeroIdx, destSlot,
        { source: CARD_NAME },
      );
      if (!placed) {
        ps.hand.push(pickedLoyal);
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      engine.log('orthos_chain_summon', {
        player: ps.username, hero: orthos.name,
        first: entering.name, second: pickedLoyal,
      });
      engine.sync();
    },
  },
};
