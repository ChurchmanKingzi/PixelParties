// ═══════════════════════════════════════════
//  CARD EFFECT: "Toughness"
//  Ability — Grants bonus current + max HP to
//  the attached Hero based on stack level.
//  Lv1: +100, Lv2: +100, Lv3: +200 (total +400).
//  On removal, subtracts the granted HP (min 1).
//  Works for starting abilities (onGameStart).
// ═══════════════════════════════════════════

const { abgangsBetrag, kopienIndex } = require('./_stufenbonus-shared');
const HP_PER_LEVEL = [100, 100, 200]; // Index 0 = 1st copy, etc.

/** Apply HP bonus to a hero using the generic max HP system. */
function applyBonus(engine, card, hero, ownerIdx, heroIdx, copyIndex) {
  const bonus = HP_PER_LEVEL[Math.min(copyIndex, HP_PER_LEVEL.length - 1)];

  const effective = engine.increaseMaxHp(hero, bonus, { alsoHealCurrent: true });
  card.counters.hpGranted = effective;

  engine._broadcastEvent('toughness_hp_change', {
    owner: ownerIdx, heroIdx, amount: effective,
  });
  engine.log('toughness_hp_up', { hero: hero.name, amount: effective, copy: copyIndex + 1 });
  engine.sync();
}

module.exports = {
  activeIn: ['ability'],
  // W16f (M02-08): gedruckt "This Ability cannot be negated." -> `bypassStatusFilter` (Konvention Welle 8: nur mit ausdrücklichem
  // "cannot be negated"). Vergabe beim Anlegen und Rücknahme beim Abgang laufen in jedem Heldenzustand (negiert/gefroren/betäubt);
  // sonst blieb der HP-Bonus einer abgeworfenen Kopie dauerhaft stehen (Kartenbilanz der Stempel) bzw. wurde nie vergeben.
  bypassStatusFilter: true,
  // Lizbeth/Smugbeth: Toughness is explicitly excluded from ability
  // borrowing per spec — Lizbeth does NOT gain HP from opponent's
  // Toughness. `disableLizbethMirror` is honoured by the engine's
  // auto-mirror dispatch (`_fireLizbethMirrorIfApplicable`);
  // `excludeFromAbilityBorrow` is honoured by the borrow-bundle
  // filter in `_getCandidateAbilityZoneSets`, which decides what
  // counts toward Lizbeth's spell-school/level requirements.
  disableLizbethMirror: true,
  excludeFromAbilityBorrow: true,

  hooks: {
    /**
     * When played during the game, grant HP based on zone level.
     */
    onPlay: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      // Styx 28.9.: Zone und Held liegen auf der Brettseite (geliehener Held).
      const seite = ctx.cardHeroOwner ?? ctx.cardOwner;
      // 25.10.: Platz = Zahl der Kopien dieses Stapels, die ihren Bonus schon tragen (nicht „Hoehe - 1": Aufstiegsbonus und Aufwachen legen mehrere Kopien auf einmal).
      const copyIndex = kopienIndex(ctx._engine, ctx.card, 'hpGranted');

      applyBonus(ctx._engine, ctx.card, hero, seite, ctx.cardHeroIdx, copyIndex);
    },

    /**
     * At game start, apply HP bonus for starting abilities.
     * Each instance determines its position by counting already-processed
     * Toughness cards in the same zone.
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const engine = ctx._engine;
      const seite = ctx.cardHeroOwner ?? ctx.cardOwner;   // Styx 28.9.: Brettseite
      const sameZone = engine.cardInstances.filter(c =>
        c.owner === seite && c.zone === ctx.card.zone &&
        c.heroIdx === ctx.cardHeroIdx && c.zoneSlot === ctx.card.zoneSlot &&
        c.name === 'Toughness'
      );
      const processedCount = sameZone.filter(c => c.counters.hpGranted > 0).length;

      applyBonus(engine, ctx.card, hero, seite, ctx.cardHeroIdx, processedCount);
    },

    /**
     * When removed, subtract the stored HP bonus (hero HP can't drop below 1).
     * Only reacts when an ABILITY zone card leaves — ignores creature/support zone departures.
     */
    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      // Self-only: ctx.card is the LISTENING Toughness. Comparing
      // instance ids prevents this hero from losing maxHp every time
      // some OTHER ability left the board.
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card?.id) return;
      if ((ctx.card.counters.hpGranted || 0) <= 0) return;
      // v1369: der Stapel verliert die OBERSTE Stufe, egal welche Kopie geht.
      const hpGranted = abgangsBetrag(ctx._engine, ctx.card, 'hpGranted');
      ctx.card.counters.hpGranted = 0;
      if (hpGranted <= 0) return;

      // Styx 28.9.: Held auf der Brettseite (geliehener Held).
      const seite = ctx.cardHeroOwner ?? ctx.cardOwner;
      const hero = ctx.players[seite]?.heroes?.[ctx.cardHeroIdx];
      if (!hero || !hero.name) return;

      const effective = ctx._engine.decreaseMaxHp(hero, hpGranted);

      ctx._engine._broadcastEvent('toughness_hp_change', {
        owner: seite, heroIdx: ctx.cardHeroIdx, amount: -effective,
      });

      ctx.log('toughness_hp_down', { hero: hero.name, amount: effective });
      ctx._engine.sync();
    },
  },
};
