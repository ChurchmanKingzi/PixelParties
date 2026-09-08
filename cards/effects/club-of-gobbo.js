// ═══════════════════════════════════════════
//  CARD EFFECT: „Club of Gobbo"
//  Artifact (Equipment, 4 Gold)
//
//  „The equipped Hero's Attack stat is increased by 30. Additionally,
//   damage it deals with Attacks cannot be reduced or negated by your
//   opponent's cards and effects."
//
//  Zwei Teile, beide mit fertigem Weg im Haus:
//
//  1) +30 ATK ueber `grantAtk` / `revokeAtk` — dieselbe Bauform wie
//     „Sacred Hammer of the Volcano" (gleiche Zahlen, gleiche Kosten).
//     Der `onGameStart`-Zweig ist Pflicht: vorab ausgeruestete
//     Artefakte (Bill, Puzzle-Aufbauten) sehen kein `onPlay`.
//
//  2) Durchschlag ueber `ctx.lockReduction()` + `cannotBeNegated` —
//     dieselbe Bauform wie bei Ida, der Adept of Destruction, nur fuer
//     `type === 'attack'` statt `destruction_spell`. Helden- und
//     Kreaturziele laufen ueber verschiedene Pfade und brauchen
//     deshalb beide Hooks.
//
//  ── „by your OPPONENT'S cards and effects" ─────────────────────────
//  Die Engine-Sperre kennt keine Seiten: `lockReduction` blockt jede
//  Minderung. Das Haus liest den Zusatz deshalb ueber das ZIEL —
//  gestempelt wird nur gegen Ziele der Gegenseite (so macht es Ida
//  seit v640). Das ist hier genau richtig: trifft ein Angriff die
//  eigene Seite, ist das Rueckstoss, und der bleibt ganz normal
//  reduzierbar.
//
//  Massgeblich ist der KONTROLLEUR, nicht der Besitzer — eine Kreatur,
//  die dir gehoert, aber beim Gegner steht, ist sein Ziel. Laesst sich
//  die Seite nicht bestimmen, wird NICHT gestempelt: der Text ist eine
//  Erlaubnis, keine Grundregel.
// ═══════════════════════════════════════════

const CARD_NAME = 'Club of Gobbo';
const ATK_BONUS = 30;

/** Stammt dieser Angriff vom ausgeruesteten Helden? */
function vomEigenenHelden(ctx, sourceOwner, sourceHeroIdx) {
  if (sourceHeroIdx < 0 || sourceHeroIdx !== ctx.cardHeroIdx) return false;
  return sourceOwner === ctx.cardOwner;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /** Ausgeruestet: +30 ATK. */
    onPlay: async (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    /** Vorab ausgeruestet (Bill, Puzzle-Aufbau): Bonus nachtragen. */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;
      if (ctx.card.counters.atkGranted > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    /** Abgelegt, zerstoert, umgehaengt: Bonus zurueck. */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner
        || ctx.fromHeroIdx !== ctx.card.heroIdx
        || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },

    /**
     * Durchschlag gegen HELDENziele.
     *
     * `lockReduction()` und `setFlag()` schreiben in den darunter
     * liegenden hookCtx. Ein direktes `ctx.cannotBeReduced = true`
     * bringt nichts — `_createContext` breitet den hookCtx in ein
     * frisches Objekt aus, die Zuweisung ginge also verloren (bei Ida
     * bemerkt und dort dokumentiert).
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (!vomEigenenHelden(ctx, srcOwner, ctx.sourceHeroIdx)) return;

      const zielSeite = ctx._engine?._findHeroOwner?.(ctx.target);
      if (typeof zielSeite !== 'number' || zielSeite < 0) return;
      if (zielSeite === ctx.cardOwner) return;   // eigener Rueckstoss bleibt minderbar

      ctx.lockReduction();
      ctx.setFlag('cannotBeNegated', true);
    },

    /** Durchschlag gegen KREATURziele — eigener Pfad, eigener Hook. */
    beforeCreatureDamageBatch: (ctx) => {
      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (e.type !== 'attack') continue;
        if (!vomEigenenHelden(ctx, e.sourceOwner, e.sourceHeroIdx)) continue;
        if (!e.inst) continue;
        if ((e.inst.controller ?? e.inst.owner) === ctx.cardOwner) continue;

        e.cannotBeReduced = true;
        e.canBeNegated = false;
      }
    },
  },
};
