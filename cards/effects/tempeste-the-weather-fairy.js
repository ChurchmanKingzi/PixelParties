// ═══════════════════════════════════════════
//  CARD EFFECT: "Tempeste, the Weather Fairy"
//  Hero · 350 HP · 40 ATK · Starting Abilities: Friendship, Resistance
//
//  "Any damage your other Heroes take from any source is reduced by
//   100. Damage this Hero takes cannot be reduced or negated."
//
//  ── UMSETZUNG ─────────────────────────────────────────────────────
//  • Reduktion fuer die ANDEREN eigenen Helden: `beforeDamage`, minus
//    100 ueber `ctx.modifyAmount` — das respektiert von selbst eine
//    `cannotBeReduced`-Sperre (Ida, Monia-Bot-True-Damage, eine
//    ZWEITE Tempeste …). Nie unter 0. Gilt fuer jede Quelle, die durch
//    actionDealDamage laeuft, also auch Burn/Poison. Nicht fuer sie
//    selbst.
//  • Der Hook wird von `runHooks` gefiltert: ist Tempeste Frozen /
//    Stunned / Negated / mumifiziert, laeuft er nicht — die Reduktion
//    faellt dann von selbst weg.
//  • „Damage this Hero takes cannot be reduced or negated": ZIELSEITIG
//    in der Engine ueber das Skript-Flag
//    `heroDamageCannotBeReducedOrNegated` (siehe
//    `_isHeroDamageUnstoppable`). Setzt `cannotBeNegated` +
//    `cannotBeReduced` auf jeden Treffer gegen sie — das toppt
//    Strong Shield, Smug Coin, Cloudy, Schilde, beforeDamage-Abbrueche
//    und Anti Magic (Als Ruling 1.9.: „toppt Effekte wie Strong
//    Shield"). Die Engine prueft dort selbst, ob sie stummgeschaltet
//    ist — „NUR solange sie nicht Frozen, Stunned oder Negated, in
//    welcher Form auch immer, ist" — ueber DIESELBE Regel, die den
//    Hook-Filter speist (`_isHeroEffectSilenced`).
//  • Unsterblichkeits-Deckel (immortal, capAtHPMinus1 …) bleiben:
//    „nicht verringert oder negiert" ist kein „ignoriert alles".
// ═══════════════════════════════════════════

const CARD_NAME = 'Tempeste, the Weather Fairy';
const REDUKTION = 100;

module.exports = {
  activeIn: ['hero'],

  // Zielseitige Unangreifbarkeit — die Engine gated Leben und
  // Stummschaltung selbst.
  heroDamageCannotBeReducedOrNegated: true,

  hooks: {
    beforeDamage: async (ctx) => {
      if (ctx.cancelled) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;          // nur Helden
      const ps = engine.gs.players[pi];
      const zielIdx = (ps?.heroes || []).indexOf(ziel);
      // Eigene ANDERE Helden. Der Selbst-Ausschluss ist doppelter
      // Boden: fuer Tempeste selbst setzt die Engine `cannotBeReduced`,
      // bevor dieser Hook laeuft (siehe unten).
      if (zielIdx < 0 || zielIdx === hi) return;
      if (!(ctx.amount > 0)) return;
      // Ob die Reduktion greift, entscheidet allein die Sperre.
      if (ctx.cannotBeReduced) return;                       // z.B. zweite Tempeste, Ida, True Damage
      // `ctx.amount` ist die LIVE-Projektion (Punkt vor Strich) — also
      // VOR der Aenderung lesen, danach noch einmal.
      const vorher = ctx.amount;
      ctx.modifyAmount(-Math.min(REDUKTION, vorher));
      engine.log('tempeste_reduction', {
        target: ziel.name, from: vorher, to: ctx.amount, source: ctx.source?.name,
      });
    },
  },
};
