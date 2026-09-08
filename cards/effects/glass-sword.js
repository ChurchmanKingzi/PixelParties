// ═══════════════════════════════════════════
//  CARD EFFECT: „Glass Sword"
//  Artifact (Equipment, Cost 2)
//
//  „Equip this card to a Hero you control. The next time that Hero
//   hits exactly 1 target with an Attack, send this equipped card to
//   your discard pile to increase that Attack's damage by 50."
//
//  Schwesterkarte von Shattered Trident — mit zwei Unterschieden
//  (Al, 6.9.): NICHT optional, kein Ja/Nein; und das Schwert zerbricht
//  SOFORT beim ersten Angriff auf genau ein Ziel (das Senden IST die
//  Kosten, „send … to increase"), nicht erst nach der Aufloesung.
//  Wird der Angriff danach negiert, ist das Schwert trotzdem weg —
//  dieselbe Linie wie Als Trident-Ruling (Negation verbraucht).
//
//  • `onAttackDeclare` (zwischen Zielwahl und Animation): Traeger
//    greift GENAU EIN Ziel an → `ctx.modifyAmount(50)`, Schwert ueber
//    `sendBoardCardToDiscard` in die Ablage (Leave-Hooks, Untracking,
//    `onBoardSentToDiscard`), Flug + tuerkise Scherben auf dem Ziel
//    (`glass_shatter`, mit Klang), Logzeile.
//  • Kein ATK-Bonus, keine Zettel, keine Einloese-Hooks noetig.
// ═══════════════════════════════════════════

const CARD_NAME = 'Glass Sword';
const BONUS = 50;

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    onAttackDeclare: async (ctx) => {
      const inst = ctx.card;
      const src = ctx.source;
      if (!inst || !src || inst.zone !== 'support') return;
      if (src.heroIdx !== inst.heroIdx) return;
      if ((src.owner ?? src.controller) !== ctx.cardOwner) return;
      const targets = Array.isArray(ctx.target) ? ctx.target : (ctx.target ? [ctx.target] : []);
      if (targets.length !== 1) return;                     // „exactly 1 target"
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hero = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
      const heroIdx = inst.heroIdx;
      const tgt = targets[0];

      ctx.modifyAmount(BONUS);
      engine._broadcastEvent('play_zone_animation', {
        type: 'equip_flash', owner: pi, heroIdx, zoneSlot: inst.zoneSlot,
      });
      // Das Schwert zerbricht: sofort in die Ablage.
      await engine.sendBoardCardToDiscard(inst, { source: CARD_NAME, sourceOwner: pi });
      engine.log('glass_sword_shatter', {
        player: engine.gs.players[pi]?.username, hero: hero?.name, bonus: BONUS, attack: src.name || null,
      });
      engine.sync();
      // Tuerkise Scherben auf dem Ziel — verzoegert auf den Aufprall,
      // nicht awaited (der Angriff soll nicht auf uns warten).
      if (tgt && typeof tgt.owner === 'number') {
        const zoneSlot = tgt.type === 'hero' ? -1 : (tgt.zoneSlot ?? tgt.slotIdx ?? -1);
        (async () => {
          await engine._delay(420);
          engine._broadcastEvent('play_zone_animation', {
            type: 'glass_shatter', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot,
          });
        })().catch(() => {});
      }
    },
  },
};
