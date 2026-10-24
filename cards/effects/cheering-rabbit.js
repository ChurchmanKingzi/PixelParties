'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Cheering Rabbit"
//  Creature (Normal, Lv 0, Summoning Magic, 30 HP)
//
//  „The corresponding Hero deals 50 additional damage with the first Attack or Spell it uses each turn."
//  „Corresponding Hero" = der Held, in dessen Support Zone das Kaninchen steht (Brettseite des Platzes).
//
//  ── „FIRST ATTACK OR SPELL IT USES EACH TURN" ───────────────────────────
//  Die Engine zählt je Held und Zug, wie viele Attacks/Spells er benutzt hat (`heldWuerfeDiesenZug`, gezählt NACH der Auflösung, in `zaehleAlsArt`). Solange das 0 ist, ist die Karte, die
//  gerade aufgelöst wird (`_currentResolvingPlayName`), der erste Wurf — auch ein ganz negierter oder abgebrochener Wurf zählt als benutzt, sobald er die Zählung erreicht.
//  Ein Wurf, den der Klon (Clone) kopiert, ist kein Gebrauch des Helden: die Kopie bekommt den Bonus nicht (die Quelle ist der Klon).
//
//  ── „50 ADDITIONAL DAMAGE" ──────────────────────────────────────────────
//  JEDER Schadensvorgang dieser Karte, dessen Quelle der Held ist (`quelleIstHeld`) und dessen Name die aufgelöste Karte ist, bekommt +50 — gegen ALLE Ziele eines Flächenschlags und für ALLE
//  aufeinanderfolgenden Treffer (Chain Lightning & Co.). Helden-Ziele über `beforeDamage` (True Damage: `beforeTrueDamage`, nur Erhöhungen), Kreaturen-Ziele über `beforeCreatureDamageBatch`; `modifyAmount(+50)` (flat, „Punkt vor Strich":
//  Verdopplungen verdoppeln den Bonus nicht, Abzüge des Ziels wirken). Nur Schaden > 0 (kein Bonus auf einen Treffer, der 0 ist), nie auf den Helden selbst (Rückstoß), nie Status-Schaden
//  (Gift/Brand), nie Schaden anderer Quellen (Surprises, Kreaturen).
//  Mehrere Kaninchen am selben Helden wirken einzeln (+50 je Kaninchen). Steht das Kaninchen still (Frost/Betäubung/Negation), ruht der Bonus (Hook-Filter).
// ═══════════════════════════════════════════

const { companionGlow } = require('./_bonded-companions-shared');

const CARD_NAME = 'Cheering Rabbit';
const BONUS = 50;
const KEIN_WURF_SCHADEN = new Set(['status', 'burn', 'poison', 'recoil', 'bleed']);

/** Das Kaninchen leuchtet einmal je Wurf auf (nicht je Treffer). */
function anzeigen(ctx) {
  const engine = ctx._engine;
  const key = `${engine.gs.turn}:${engine._currentResolvingPlayName()}`;
  if (ctx.card._cheerKey === key) return;
  ctx.card._cheerKey = key;
  companionGlow(engine, ctx.card);
}

/** Gilt der Bonus für diesen Treffer? `quelle` = Schadensquelle, `typ` = Schadenstyp. */
function bonusGilt(ctx, quelle, typ, hero) {
  const engine = ctx._engine;
  if (KEIN_WURF_SCHADEN.has(typ)) return false;
  if (!quelle) return false;
  const aufgeloest = engine._currentResolvingPlayName();
  if (!aufgeloest || (quelle.name !== aufgeloest && quelle.cardName !== aufgeloest)) return false;
  const seite = ctx.cardHeroOwner ?? ctx.card.owner;
  if (!engine.quelleIstHeld(quelle, seite, ctx.cardHeroIdx)) return false;
  return engine.heldWuerfeDiesenZug(hero) === 0;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const hero = ctx.attachedHero;
      if (!hero?.name || !(hero.hp > 0) || !(ctx.amount > 0)) return;
      if (ctx.target === hero) return;                                  // Rückstoß/Selbstschaden: kein Schaden, „den der Held austeilt"
      if (!bonusGilt(ctx, ctx.source, ctx.type, hero)) return;
      ctx.modifyAmount(BONUS);
      anzeigen(ctx);
    },

    /** True Damage (Rockfall, Piercer of Heavens, Surefire Shot …): „cannot be reduced or negated" schützt nur vor Senkungen — der Bonus ERHÖHT (Engine `beforeTrueDamage`). */
    beforeTrueDamage: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const hero = ctx.attachedHero;
      if (!hero?.name || !(hero.hp > 0) || !(ctx.amount > 0)) return;
      if (ctx.target === hero) return;
      if (!bonusGilt(ctx, ctx.source, ctx.type, hero)) return;
      ctx.modifyAmount(BONUS);
      anzeigen(ctx);
    },

    beforeCreatureDamageBatch: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const hero = ctx.attachedHero;
      if (!hero?.name || !(hero.hp > 0)) return;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled || !(e.amount > 0)) continue;
        if (!bonusGilt(ctx, e.source, e.type, hero)) continue;
        e.modifyAmount(BONUS);
        anzeigen(ctx);
      }
    },
  },
};
