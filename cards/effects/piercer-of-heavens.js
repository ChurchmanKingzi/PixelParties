// ═══════════════════════════════════════════
//  CARD EFFECT: "Piercer of Heavens"
//  Spell (Destruction Magic Lv3, Normal)
//
//  „Choose a target and deal 250 damage to it. This damage cannot be
//   reduced or negated, and this Spell can always choose any target,
//   ignoring any other effects."
//
//  ── Zwei Saetze, zwei Vertraege ───────────────────────────────
//  ① „cannot be reduced or negated" → TRUE DAMAGE ueber
//     `engine.actionDealTrueDamage` (Acid-Vial-Vertrag): keine Buff-
//     Multiplikatoren, keine Charmed/Submerged/Petrify-Immunitaet, kein
//     Immortal-Cap, kein Smug Coin, keine Gate-/Guardian-Schilde.
//     Bleibt absolut: Erstzug-Schutz, Cardinal-Beast-Immunitaet.
//     Typ 'destruction_spell' (Idas Lauscher, Statistiken).
//  ② „can always choose any target, ignoring any other effects" →
//     Skript-Flag `ignoresTargetingRestrictions` (v616, NEU). Die
//     Ziel-Picker behandeln die Quelle wie unter Truth-Seeing Eye:
//     `ignoreUntargetable` (Untargetable/Invisible/Golden Wings/
//     Fake Hero …) + Taunt-Filter und Ausschlusslisten aus. NICHT
//     enthalten: Unumlenkbarkeit — „waehlen" verbietet keine
//     Umlenkung (Anti-Magnet & Co. greifen weiter; das Auge hat dafuer
//     seinen eigenen Satz).
//     Post-Target-Reaktionen (Invisibility Cloak: negiert den Spell
//     bei Zielwahl; Spectral Armor & Co.: reduzieren) werden
//     uebersprungen — Al nennt den Cloak ausdruecklich als Beispiel
//     fuer „ignoring any other effects", und Reduktionen sind bei
//     True Damage ohnehin wirkungslos.
//
//  Chain-Fenster VOR der Zielwahl (Anti Magic Shield, The Master's
//  Plan) bleibt: „cannot be negated" meint den SCHADEN, der Spell
//  selbst ist konterbar — gleiche Lesart wie bei Idas Spells.
//
//  Auftritt: `lightning_rain` (v617, eigene Klasse) — acht gezackte
//  Blitze prasseln gestaffelt vom oberen Bildrand auf das Ziel; JEDER
//  Einschlag hat seinen eigenen `elem_lightning` (aus der Komponente,
//  Als Wunsch). Der Schaden faellt, wenn die ersten Blitze eingeschlagen
//  haben; die letzten prasseln noch, waehrend die HP fallen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Piercer of Heavens';
const DAMAGE = 250;
const ANIM = 'lightning_rain';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  ignoresTargetingRestrictions: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Choose any target — ${DAMAGE} damage that cannot be reduced or negated. Nothing can hide from the Piercer.`,
        confirmLabel: `☄️ ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        _skipPostTargetReactions: true,
      });
      if (!target) return;

      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: ANIM, owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot,
        duration: 1400, // acht gestaffelte Blitze + Nachleuchten
      });
      await engine._delay(600);

      const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, controller: pi };
      let dealt = 0;
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) {
          ({ dealt } = await engine.actionDealTrueDamage(source, hero, DAMAGE, { type: 'destruction_spell' }));
        }
      } else if (target.cardInstance) {
        ({ dealt } = await engine.actionDealTrueDamage(source, target.cardInstance, DAMAGE, { type: 'destruction_spell' }));
      }
      engine.log('piercer_of_heavens', {
        player: gs.players[pi]?.username, target: target.cardName, damage: DAMAGE, dealt,
      });
      engine.sync();
    },
  },
};
