// ═══════════════════════════════════════════
//  CARD EFFECT: "Frog Race Boat"
//  Artifact / Equipment (Race Boats, Cost 12)
//
//  „A Hero can only have 1 "Race Boat" Artifact equipped to it. The first
//   damage the equipped Hero deals in any way to a single target each turn
//   is increased by 50 times the number of Creatures in its other Support
//   Zones."
//
//  ── ALS VORGABEN (10.10., bindend) ────────────────────────────────────
//  · „Creatures in its Support Zones" = ALLE Creatures des Helden, auch die
//    in Bonus-Zonen von „Flying Island in the Sky" (`kreaturenAmHeld`). „Other"
//    meint die Zonen ausser der des Bootes selbst — das Boot ist keine Creature
//    und stoert die Zaehlung nicht.
//
//  ── Auslegung ─────────────────────────────────────────────────────────
//  · „deals in any way": jeder DIREKTE Schaden des Helden — Attack, Spell,
//    Effekt —, nicht Status-Ticks, nicht der Schaden einer Creature in seinen
//    Zonen (`schadenKommtVomTraeger`, wie „defeats a target").
//  · „to a single target": ein Schadensereignis OHNE Flaechenschlag. Laeuft der
//    Schaden in einer Mehrziel-Klammer (`beginAoeStrike`/`beginMultiHit` mit 2+
//    Zielen), ist er KEIN Einzelzielschaden — er bekommt den Bonus nicht und
//    verbraucht ihn auch nicht (die Fifth-Circle-Regel „genau 1 Ziel"). Hero- und
//    Creature-Ziele laufen ueber ZWEI Hooks (`beforeDamage` bzw.
//    `beforeCreatureDamageBatch`, nur Batch mit EINEM Eintrag), teilen sich aber
//    EINEN Zaehler.
//  · „first … each turn": der erste qualifizierende Treffer JEDER Runde (auch der
//    des Gegners, `_charges`-Einheitszaehler: frisch je Spielerzug). Der Bonus
//    wird dann verbraucht, auch wenn gerade keine Creature steht (+0).
//  · Nur Schaden > 0 zaehlt als Treffer. Der Bonus wird vor den uebrigen
//    Rechnungen aufgeschlagen (`modifyAmount`, wie Thorad).
// ═══════════════════════════════════════════

const RB = require('./_race-boat-shared');
const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Frog Race Boat';
const PRO_KREATUR = 50;
const ZAEHLER = { key: 'FrogRaceBoat', max: 1 };

/** Der Bonus dieses Treffers, falls er qualifiziert (und verbraucht ihn); sonst 0. */
function bonusFuerEinzeltreffer(ctx, t, source, type, amount) {
  const engine = ctx._engine;
  if (!(amount > 0)) return 0;
  if (RB.inFlaechenschlag(engine)) return 0;
  if (engine.gs._spellCasterOverride) return 0;               // eine Creature wirkt den Zauber, nicht der Held
  if (!RB.schadenKommtVomTraeger(engine, t, source, type)) return 0;
  if (usesLeft(t.inst, engine.gs, ZAEHLER) <= 0) return 0;
  spendUse(t.inst, engine.gs, ZAEHLER);
  const n = RB.kreaturenAmHeld(engine, t.seite, t.heroIdx);
  engine.log('frog_race_boat', { hero: t.hero.name, creatures: n, bonus: PRO_KREATUR * n });
  return PRO_KREATUR * n;
}

module.exports = {
  activeIn: ['support'],

  /** „A Hero can only have 1 "Race Boat" Artifact equipped to it." */
  canEquipToHero: RB.canEquipToHero,

  hooks: {
    /** Heldenziel: ein einzelnes Schadensereignis. */
    beforeDamage: async (ctx) => {
      const t = RB.traeger(ctx);
      if (!t) return;
      const bonus = bonusFuerEinzeltreffer(ctx, t, ctx.source, ctx.type, ctx.amount);
      if (bonus > 0) ctx.modifyAmount(bonus);
    },

    /** Creature-Ziel: nur ein Batch mit GENAU einem Eintrag ist ein Einzelziel. */
    beforeCreatureDamageBatch: async (ctx) => {
      const t = RB.traeger(ctx);
      if (!t) return;
      const entries = ctx.entries || [];
      if (entries.length !== 1) return;
      const e = entries[0];
      const bonus = bonusFuerEinzeltreffer(ctx, t, e.source, e.type, e.amount);
      if (bonus > 0) e.amount += bonus;
    },
  },

  _test: { PRO_KREATUR },
};
