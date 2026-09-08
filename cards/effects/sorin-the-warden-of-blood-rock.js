// ═══════════════════════════════════════════
//  CARD EFFECT: "Sorin, the Warden of Blood Rock"
//  Hero
//
//  "This Hero can use level 3 or lower Attacks
//  regardless of their level. This Hero cannot
//  affect targets with Attacks, except if they
//  are Bleeding."
//
//  Als Ruling 5 (4.9.): jedes Ziel waehlbar, der
//  Angriff verpufft aber gegen nicht-blutende.
//
//  Umsetzung (v712)
//  ────────────────
//  • Level-Freigabe: `canBypassLevelReqForCard`
//    (Helden-Vertrag) fuer Attacks bis Level 3.
//  • Verpuffen: `beforeDamage` (Heldenziel) setzt
//    den eigenen Attack-Schaden gegen ein nicht
//    blutendes Ziel auf 0; `beforeCreatureDamage-
//    Batch` streicht den Eintrag. Angriffs-Rider
//    fremder Karten (Status durch den Attack-
//    Zauber selbst) bleiben eine bekannte Luecke.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sorin, the Warden of Blood Rock';
const MAX_FREE_ATTACK_LEVEL = 3;

function isOwnAttackSource(ctx, source) {
  if (!source) return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  const srcOwner = source.heroOwner ?? source.controller ?? source.owner ?? -1;
  return srcOwner === ctx.cardOwner;
}

module.exports = {
  activeIn: ['hero'],

  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData) {
    if (!cardData || cardData.cardType !== 'Attack') return false;   // Attacks sind ein eigener cardType
    return (cardData.level || 0) <= MAX_FREE_ATTACK_LEVEL;
  },

  hooks: {
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack' || !isOwnAttackSource(ctx, ctx.source)) return;
      const t = ctx.target;
      if (!t || t.hp === undefined) return;
      if (t.statuses?.bleeding) return;
      ctx.setAmount(0);
      ctx._engine.log('sorin_attack_fizzle', { player: ctx._engine.gs.players[ctx.cardOwner]?.username, target: t.name });
    },
    beforeCreatureDamageBatch: (ctx) => {
      for (const e of (ctx.entries || [])) {
        if (e.type !== 'attack' || !isOwnAttackSource(ctx, e.source)) continue;
        if (e.inst?.counters?.bleeding) continue;
        e.amount = 0;
        e.cancelled = true;
        ctx._engine.log('sorin_attack_fizzle', { player: ctx._engine.gs.players[ctx.cardOwner]?.username, target: e.inst?.name });
      }
    },
  },
};
