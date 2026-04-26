// ═══════════════════════════════════════════
//  CARD EFFECT: "Rafflesia, the Poison Princess"
//  Hero (400 HP, 40 ATK — Decay Magic + Support
//  Magic starting abilities)
//
//  Once per turn, during her Action Phase, when
//  Rafflesia casts a Decay OR Support Spell, she
//  may immediately cast a Spell of the OTHER
//  Spell School from her hand as an additional
//  Action. She still needs the Abilities to
//  actually cast that follow-up Spell — the
//  level relationship between the two Spells is
//  irrelevant.
//
//  Implementation: register an additional-action
//  type whose filter accepts only the OTHER
//  school AND whose `heroMeetsLevelReq` check
//  passes for Rafflesia. Grant the action on
//  Rafflesia's hero card instance. The standard
//  spell-play handler consumes the action when
//  the player plays a matching Spell.
//
//  HOPT key gates the trigger itself — once per
//  turn, regardless of whether the granted
//  follow-up was actually cast. Unconsumed
//  grants are expired on the next turn start so
//  Decay→Support carryover from turn N can't
//  resurface on turn N+1.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rafflesia, the Poison Princess';
const HOPT_KEY  = 'rafflesia_chain';

function getOtherSchool(spellData) {
  const isDecay = spellData?.spellSchool1 === 'Decay Magic'
    || spellData?.spellSchool2 === 'Decay Magic';
  const isSupport = spellData?.spellSchool1 === 'Support Magic'
    || spellData?.spellSchool2 === 'Support Magic';
  if (isDecay && !isSupport) return 'Support Magic';
  if (isSupport && !isDecay) return 'Decay Magic';
  // Multi-school cast (Sacrifice to Divinity etc. — Magic Arts + Support):
  // if it satisfies "Decay or Support" but covers both, the trigger fires
  // anyway. Pick whichever school the card-text reading prefers — Decay
  // wins (chain into Support) by convention since the spec says "the
  // other Spell School".
  if (isDecay && isSupport) return 'Support Magic';
  return null;
}

function chainTypeId(playerIdx, heroIdx, otherSchool) {
  const tag = otherSchool === 'Decay Magic' ? 'decay' : 'support';
  return `rafflesia_chain_${tag}_${playerIdx}_${heroIdx}`;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Expire any leftover chain-grant from a previous turn so the
     * additional action doesn't persist into the next turn unconsumed.
     * Also clears Rafflesia's HOPT (engine resets `gs.hoptUsed` keyed
     * on turn, but expiring the grant here is independent).
     */
    onTurnStart: (ctx) => {
      const engine = ctx._engine;
      const inst = engine.cardInstances.find(c =>
        c.zone === 'hero'
        && c.owner === ctx.cardOwner
        && c.heroIdx === ctx.cardHeroIdx
        && c.name === CARD_NAME
      );
      if (!inst?.counters) return;
      const t = inst.counters.additionalActionType;
      if (typeof t === 'string' && t.startsWith('rafflesia_chain_')) {
        engine.expireAdditionalAction(inst);
      }
    },

    /**
     * Trigger: Rafflesia herself casts a Decay or Support Spell during
     * her Action Phase. Grant a one-shot additional-action allowing her
     * to chain into the OTHER school, level/school requirements still
     * checked against her own ability slots. Only fires if she has at
     * least one matching Spell she can actually cast — no point
     * burning the HOPT on a no-op.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;
      if (gs.currentPhase !== 3) return; // Action Phase only

      const hoptKey = `${HOPT_KEY}:${pi}:${heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const spellData = ctx.spellCardData;
      const otherSchool = getOtherSchool(spellData);
      if (!otherSchool) return;

      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Confirm at least one matching Spell in hand is playable by
      // Rafflesia right now — otherwise the grant would stick around
      // unconsumed and consume the HOPT for nothing.
      const cardDB = engine._getCardDB();
      let hasMatch = false;
      for (const cn of (ps.hand || [])) {
        const cd = cardDB[cn];
        if (!cd || cd.cardType !== 'Spell') continue;
        if (cd.spellSchool1 !== otherSchool && cd.spellSchool2 !== otherSchool) continue;
        if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) continue;
        hasMatch = true; break;
      }
      if (!hasMatch) return;

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      const typeId = chainTypeId(pi, heroIdx, otherSchool);
      engine.registerAdditionalActionType(typeId, {
        label: `${hero.name} — Chain`,
        allowedCategories: ['spell'],
        heroRestricted: true,
        filter: (cardData) => {
          if (!cardData || cardData.cardType !== 'Spell') return false;
          if (cardData.spellSchool1 !== otherSchool && cardData.spellSchool2 !== otherSchool) return false;
          return engine.heroMeetsLevelReq(pi, heroIdx, cardData);
        },
      });

      const inst = engine.cardInstances.find(c =>
        c.zone === 'hero' && c.owner === pi && c.heroIdx === heroIdx && c.name === CARD_NAME
      );
      if (inst) engine.grantAdditionalAction(inst, typeId);

      // Block phase advance — without this, the engine auto-advances
      // from Action Phase to Main Phase 2 right after the triggering
      // Decay/Support Spell resolves, before the player ever has a
      // chance to use the granted chain. The flag is cleared by the
      // server's spell-play handler after each spell's resolution
      // (see `delete gs._preventPhaseAdvance`), so the chain follow-up
      // resolves naturally and only THEN does Action Phase end.
      gs._preventPhaseAdvance = true;

      engine._broadcastEvent('hero_announcement', {
        text: `${hero.name} may chain into a ${otherSchool === 'Decay Magic' ? 'Decay' : 'Support'} Spell!`,
      });

      engine.log('rafflesia_chain', {
        player: ps.username, hero: hero.name,
        otherSchool: otherSchool === 'Decay Magic' ? 'Decay' : 'Support',
      });
      engine.sync();
    },
  },
};
