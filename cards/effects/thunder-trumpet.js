// ═══════════════════════════════════════════
//  CARD EFFECT: "Thunder Trumpet"
//  Artifact / Equipment (Cost 4)
//
//  „When this Artifact equipped to a Hero you control is sent to the
//   discard pile, choose a target and deal 80 damage to it. You can only
//   activate this effect of "Thunder Trumpet" once per turn."
//
//  Ausloeser, „you control" und das Einmal-pro-Zug liegen in
//  `_orchestra-shared.instrumentDiscardTrigger` (eine Auslegung fuer alle
//  drei Instrumente). Das Ziel ist beliebig (beide Seiten, Held oder
//  Kreatur); der Schaden traegt den vorher ausgeruesteten Helden als
//  Quelle, Typ 'artifact'. Auftritt: `electric_strike` (bestehend).
// ═══════════════════════════════════════════

const { instrumentDiscardTrigger } = require('./_orchestra-shared');

const CARD_NAME = 'Thunder Trumpet';
const DAMAGE = 80;

module.exports = {
  isEquip: true,
  activeIn: ['support'],
  bypassDeadHeroFilter: true,  // feuert auch beim Abbau nach Heldentod

  hooks: {
    onCardLeaveZone: async (ctx) => {
      const fired = instrumentDiscardTrigger(ctx, CARD_NAME, 'thunder-trumpet');
      if (!fired) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const { pi, heroIdx } = fired;
      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'], damageType: 'artifact', baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `${CARD_NAME} was sent to the discard pile — choose a target and deal ${DAMAGE} damage to it.`,
        confirmLabel: `🎺 ${DAMAGE} Damage!`, confirmClass: 'btn-danger', cancellable: false,
      });
      if (!target) return;
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', { type: 'electric_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot });
      await engine._delay(350);
      const source = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await engine.actionDealDamage(source, hero, DAMAGE, 'artifact');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(source, target.cardInstance, DAMAGE, 'artifact', { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('thunder_trumpet', { player: gs.players[pi]?.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
    },
  },
};
