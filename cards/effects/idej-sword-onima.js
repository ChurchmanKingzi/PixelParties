// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Sword - Onima"
//  Artifact / Equipment (Idej) — Cost 20 (0 on Idej Lord Todugawin)
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   If you equip this Artifact to "Idej Lord Todugawin", its Cost
//   becomes 0. A Hero can only be equipped with 1 "Idej Sword"
//   Artifact. When the equipped Hero hits exactly 1 Hero with an
//   Attack, your opponent must choose up to 2 Abilities attached to
//   that Hero and add them back to their hand."
//
//  • Cost-0-on-Todugawin: Idej Lord Todugawin's `equipCostReduction`.
//  • The Ability-strip: `afterSpellResolved` — when the equipped Hero
//    resolves an Attack whose damage list is exactly one Hero, the
//    struck Hero's owner is FORCED to return Abilities to hand. "Up to
//    2" means "exactly 2 — or 1 if only 1 is attached" (the maximum
//    possible), never fewer when more is possible.
//  • Each returned Ability visibly flies from its Ability Zone slot to
//    its new position in hand (`play_pile_transfer`), cascading when
//    two are returned.
// ═══════════════════════════════════════════

const { canEquipToIdejHero, heroHasIdejSword } = require('./_idej-shared');

const CARD_NAME = 'Idej Sword - Onima';

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, pi, heroIdx, engine) {
    if (!canEquipToIdejHero(gs, pi, heroIdx, engine)) return false;
    const eng = engine || gs._engineRef;
    return eng ? !heroHasIdejSword(eng, pi, heroIdx) : true;
  },

  hooks: {
    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;

      const engine = ctx._engine;
      const gs = engine.gs;

      // "hits exactly 1 Hero with an Attack" — the damage target list
      // is exactly one Hero entry.
      const dmg = Array.isArray(ctx.damageTargets) ? ctx.damageTargets : [];
      const heroHits = dmg.filter(t => t && t.type === 'hero');
      if (heroHits.length !== 1 || dmg.length !== 1) return;

      const hit = heroHits[0];
      const oppIdx = hit.owner;
      const oppPs = gs.players[oppIdx];
      const tHeroIdx = hit.heroIdx;
      if (!oppPs || oppIdx === ctx.cardOwner) return; // only an opponent's Hero

      // Collect every Ability copy attached to the struck Hero.
      const abz = oppPs.abilityZones?.[tHeroIdx] || [];
      const targets = [];
      // Support-Zonen-Karten, die dort als Ability zaehlen (Cloak of
      // Edge) — zentral ueber den Sammler (Als Ruling 5.8.).
      for (const st of (engine.collectSupportZoneAbilities?.(oppIdx, tHeroIdx) || [])) {
        targets.push({
          id: `equip-${oppIdx}-${tHeroIdx}-${st.slotIdx}`, type: 'equip',
          owner: oppIdx, heroIdx: tHeroIdx, slotIdx: st.slotIdx,
          cardName: st.cardName,
        });
      }
      for (let zi = 0; zi < abz.length; zi++) {
        const slot = abz[zi] || [];
        for (let ci = 0; ci < slot.length; ci++) {
          targets.push({
            id: `ability-${oppIdx}-${tHeroIdx}-${zi}-${ci}`,
            type: 'ability', owner: oppIdx, heroIdx: tHeroIdx,
            slotIdx: zi, cardName: slot[ci],
          });
        }
      }
      if (targets.length === 0) return;

      // "must choose up to 2" — the opponent is FORCED to return the
      // maximum possible: 2 if at least 2 are attached, otherwise 1.
      // The picker is non-cancellable and requires exactly that many.
      const requireN = Math.min(2, targets.length);
      const picked = await engine.promptEffectTarget(oppIdx, targets, {
        title: CARD_NAME,
        description: `Choose ${requireN} ${requireN === 1 ? 'Ability' : 'Abilities'} `
          + 'attached to this Hero to add back to your hand.',
        confirmLabel: '↩ Return!',
        confirmClass: 'btn-info',
        minRequired: requireN,
        maxTotal: requireN,
        alwaysConfirmable: false,
        cancellable: false,
      });
      const ids = Array.isArray(picked) ? picked.slice(0, requireN) : [];
      if (ids.length === 0) { engine.sync(); return; }

      // Return each chosen Ability copy to the opponent's hand. Resolve
      // one at a time — re-finding the slot index — so removals don't
      // invalidate later picks. Each Ability flies from its Ability
      // Zone slot to its new hand position; multiple returns cascade.
      // Hand size once every chosen Ability has been returned — both
      // flights are emitted before the single sync, so each must
      // project against this SAME final size or land half a card off.
      const finalHandSize = oppPs.hand.length + ids.length;
      let returned = 0;
      for (let k = 0; k < ids.length; k++) {
        const t = targets.find(x => x.id === ids[k]);
        if (!t) continue;
        const slot = (oppPs.abilityZones?.[tHeroIdx] || [])[t.slotIdx] || [];
        const ci = slot.indexOf(t.cardName);
        if (ci < 0) continue;
        slot.splice(ci, 1);
        const inst = engine.cardInstances.find(c =>
          c.zone === 'ability' && c.owner === oppIdx
          && c.heroIdx === tHeroIdx && c.zoneSlot === t.slotIdx && c.name === t.cardName);
        if (inst) {
          await engine.runHooks('onCardLeaveZone', {
            _onlyCard: inst, card: inst, leavingCard: inst,
            fromZone: 'ability', fromHeroIdx: tHeroIdx, fromZoneSlot: t.slotIdx,
            fromOwner: oppIdx, toZone: 'hand', _skipReactionCheck: true,
          });
          engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
        }
        oppPs.hand.push(t.cardName);
        // Authoritative flight — the Ability travels from the exact
        // Ability Zone slot it sat in to its new spot in hand. Emitted
        // before the final sync, so it starts from the still-visible
        // slot; the handler suppresses the auto hand-grew detector.
        engine._broadcastEvent('play_pile_transfer', {
          fromOwner: oppIdx, toOwner: oppIdx,
          cardName: t.cardName,
          from: 'ability', to: 'hand',
          fromHeroIdx: tHeroIdx, fromSlotIdx: t.slotIdx,
          toHandIdx: oppPs.hand.length - 1,
          finalHandSize,
        });
        returned++;
        // Cascade a second return rather than overlapping the flights.
        if (k < ids.length - 1) await engine._delay(420);
      }

      if (returned > 0) {
        engine.log('idej_onima', {
          player: gs.players[ctx.cardOwner]?.username,
          struck: hit.cardName, returned,
        });
      }
      engine.sync();
    },
  },
};
