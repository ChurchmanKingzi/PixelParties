// ═══════════════════════════════════════════
//  CARD EFFECT: "Tarleinn the Traveler"
//  Hero (400 HP, 30 ATK)
//  Starting abilities: Destruction Magic + Support Magic
//
//  Once per turn, when a Hero THIS PLAYER controls
//  whose attached abilities cover ≥2 different
//  Spell Schools casts a Spell, Tarleinn's controller
//  may choose a target THEY control and heal it for
//  40 / 80 / 150 (per the Spell's level).
//
//  Spell-school detection mirrors Anti Magic Shield's
//  count: each ability stack contributes its base
//  ability's school, plus Performance copies whatever
//  the stack's base ability is (so a Performance
//  stacked on Magic Arts counts as Magic Arts).
//  Schools are deduplicated across the hero's three
//  ability zones — two stacks of the SAME school
//  don't count as "two different schools".
//
//  HOPT — once per turn, refunded if the user cancels
//  at the target prompt OR no legal targets exist.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Tarleinn the Traveler';
const HOPT_KEY  = 'tarleinnHealTriggeredThisTurn';

const HEAL_BY_LEVEL = { 0: 40, 1: 40, 2: 80, 3: 150 };

// The five magical Spell Schools that count toward Tarleinn's "two or
// more different Spell Schools" gate. Fighting is technically tagged
// as a Spell School in cards.json (Attack cards reference it the same
// way Spells reference Magic Arts/etc.) — but it isn't a "magical"
// school and Tarleinn's heal flavour is magic-themed, so we exclude it
// here per design.
//
// Other Abilities (Training, Diplomacy, Charme, Wisdom, Performance,
// Adventurousness, Leadership, …) are NOT Spell Schools at all and
// never count toward this gate.
const SPELL_SCHOOLS = new Set([
  'Destruction Magic',
  'Support Magic',
  'Magic Arts',
  'Decay Magic',
  'Summoning Magic',
]);

/**
 * The set of distinct Spell Schools represented by abilities attached
 * to this hero. Each ability slot's BASE ability is consulted — a
 * Performance stacked on top inherits the base's school, so it doesn't
 * contribute its own entry. Two stacks with the same base school
 * collapse to one.
 */
function distinctSchoolsOnHero(_engine, ps, heroIdx) {
  const schools = new Set();
  const abZones = ps.abilityZones?.[heroIdx] || [];
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const baseName = slot[0];
    if (SPELL_SCHOOLS.has(baseName)) schools.add(baseName);
  }
  return schools;
}

function alreadyTriggered(card) {
  return !!(card?.counters && card.counters[HOPT_KEY]);
}
function markTriggered(card) {
  if (!card.counters) card.counters = {};
  card.counters[HOPT_KEY] = true;
}
function refundTrigger(card) {
  if (card?.counters) delete card.counters[HOPT_KEY];
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onTurnStart: (ctx) => {
      refundTrigger(ctx.card);
    },

    /**
     * Fires after every spell/attack resolves. Filter to:
     *   • Spells (not Attacks)
     *   • Cast by a hero on Tarleinn's side
     *   • By a hero whose attached abilities cover ≥2 distinct schools
     *   • Tarleinn herself is alive + can act + hasn't triggered yet this turn
     */
    afterSpellResolved: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;

      // Tarleinn must be alive and not shut down.
      const tarl = ctx.attachedHero;
      if (!tarl?.name || tarl.hp <= 0) return;
      if (tarl.statuses?.frozen || tarl.statuses?.stunned || tarl.statuses?.negated) return;
      if (alreadyTriggered(ctx.card)) return;

      // Caster gate — must be Tarleinn's controller's side.
      if (ctx.casterIdx !== pi) return;
      // Must be a Spell (Attacks share this hook but don't qualify).
      const sd = ctx.spellCardData;
      if (!sd || !hasCardType(sd, 'Spell')) return;

      const ps = gs.players[pi];
      if (!ps) return;

      // Caster hero must have ≥2 distinct schools attached.
      const casterHeroIdx = ctx.heroIdx;
      if (casterHeroIdx == null || casterHeroIdx < 0) return;
      const schools = distinctSchoolsOnHero(engine, ps, casterHeroIdx);
      if (schools.size < 2) return;

      const lvl = sd.level || 0;
      const healAmt = HEAL_BY_LEVEL[Math.min(3, Math.max(0, lvl))] || HEAL_BY_LEVEL[1];

      // ── Build heal-target list (own heroes + own creatures) ──
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        // Only meaningful if the target isn't already at full HP — but the
        // card text doesn't gate on that; let the player still pick.
        targets.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== pi || inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: pi, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        });
      }
      if (targets.length === 0) return;

      // Reserve the once-per-turn slot up front so concurrent reaction
      // chains can't double-fire (refunded below if the player cancels).
      markTriggered(ctx.card);

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: `Heal a target you control by ${healAmt}.`,
        confirmLabel: `💚 Heal ${healAmt}!`,
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });
      if (!picked || picked.length === 0) {
        refundTrigger(ctx.card);
        return;
      }
      const target = targets.find(t => t.id === picked[0]);
      if (!target) {
        refundTrigger(ctx.card);
        return;
      }

      const healSource = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };

      if (target.type === 'hero') {
        const hero = gs.players[pi]?.heroes?.[target.heroIdx];
        if (!hero?.name || hero.hp <= 0) { refundTrigger(ctx.card); return; }
        engine._broadcastEvent('play_zone_animation', {
          type: 'heal_sparkle', owner: pi, heroIdx: target.heroIdx, zoneSlot: -1,
        });
        await engine._delay(200);
        await engine.actionHealHero(healSource, hero, healAmt);
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst) { refundTrigger(ctx.card); return; }
        engine._broadcastEvent('play_zone_animation', {
          type: 'heal_sparkle', owner: pi, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
        await engine._delay(200);
        await engine.actionHealCreature(healSource, inst, healAmt);
      }

      engine.log('tarleinn_heal', {
        player: ps.username,
        spell: ctx.spellName, level: lvl,
        healed: target.cardName, amount: healAmt,
      });
      engine.sync();
    },
  },
};
