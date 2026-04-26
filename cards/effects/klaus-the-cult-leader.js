// ═══════════════════════════════════════════
//  CARD EFFECT: "Klaus, the Cult Leader"
//  Hero (400 HP, 40 ATK — Decay Magic + Summoning
//  Magic starting abilities)
//
//  When Klaus casts a Decay Spell, he may
//  immediately PLACE a Creature from his hand
//  whose level is LOWER than that Spell's onto
//  one of his free Support Zones.
//
//  Key detail (per spec): the effect PLACES the
//  Creature rather than summoning it. That means
//  Klaus does NOT need Summoning Magic levels
//  ≥ the Creature's level — `actionPlaceCreature`
//  bypasses the spell-school / level requirement
//  check, so a Lv0/1 Klaus can drop a higher-tier
//  Creature off the back of any Decay Spell.
//
//  The placement is also marked as a placement
//  (`isPlacement: 1`, `countAsSummon: false`), so
//  it doesn't tick `_creaturesSummonedThisTurn`
//  and can therefore be sacrificed by Clausss
//  (or any other "not summoned this turn" gate)
//  on a later turn — but NOT this turn, since
//  `inst.turnPlayed = gs.turn` is still set by
//  the placement helper.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Klaus, the Cult Leader';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Trigger only when Klaus himself was the caster.
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Spell must be Decay Magic. Match either school1 or school2 so
      // future multi-school Decay Spells (if any) still count.
      const spellData = ctx.spellCardData;
      if (!spellData) return;
      if (spellData.spellSchool1 !== 'Decay Magic'
          && spellData.spellSchool2 !== 'Decay Magic') return;

      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      // Frozen / Stunned / Negated Klaus can't trigger his own bonus.
      // Bound is fine — bound only blocks Actions, this is a passive
      // trigger off a Spell's resolution.
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Need a free Support Zone on Klaus.
      const supZones = ps.supportZones?.[heroIdx] || [[], [], []];
      let freeSlot = -1;
      for (let z = 0; z < 3; z++) {
        if ((supZones[z] || []).length === 0) { freeSlot = z; break; }
      }
      if (freeSlot < 0) return;

      // Eligible Creatures: in hand, type Creature, level < spell level.
      const cardDB = engine._getCardDB();
      const spellLevel = spellData.level || 0;
      if (spellLevel <= 0) return; // Lv0 spell -> nothing qualifies.
      const seen = new Set();
      const eligible = [];
      for (const cn of (ps.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const cd = cardDB[cn];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if ((cd.level || 0) >= spellLevel) continue;
        eligible.push(cn);
      }
      if (eligible.length === 0) return;

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: eligible.map(cn => ({ name: cn, source: 'hand' })),
        title: CARD_NAME,
        description: `Place a Creature from your hand (level < ${spellLevel}) onto ${hero.name}.`,
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;

      const chosenName = picked.cardName;
      // Re-verify hand presence — async prompt could have shifted state.
      if ((ps.hand || []).indexOf(chosenName) < 0) return;
      // Re-verify free slot.
      const supZones2 = ps.supportZones?.[heroIdx] || [[], [], []];
      let slotNow = -1;
      for (let z = 0; z < 3; z++) {
        if ((supZones2[z] || []).length === 0) { slotNow = z; break; }
      }
      if (slotNow < 0) return;

      // PLACE — bypasses summon level / school requirement. The helper
      // pulls the card out of hand, drops it into the slot, marks
      // `isPlacement` and stamps `turnPlayed`. `countAsSummon: false`
      // keeps the per-turn summon tally clean.
      const res = await engine.actionPlaceCreature(chosenName, pi, heroIdx, slotNow, {
        source: 'hand',
        sourceName: CARD_NAME,
        countAsSummon: false,
        animationType: 'summon',
      });
      if (!res?.inst) return;

      engine.log('klaus_place', {
        player: ps.username, hero: hero.name,
        spell: spellData.name, spellLevel,
        placed: chosenName,
      });
      engine.sync();
    },
  },
};
