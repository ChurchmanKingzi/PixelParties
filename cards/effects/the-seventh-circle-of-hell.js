const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Seventh Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by an effect and you have not played a deleted Area yet this turn,
//   you may immediately delete all Areas you control and play this deleted Spell as an additional
//   Action. At the end of each turn, the turn player must choose a target they control and deal
//   100 damage to it. When this card on the board is sent to the discard pile or deleted, choose
//   a target and deal 150 damage to it."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Zugende (jeder Zug, beide Spieler): der Spieler AM ZUG waehlt (Pflicht) einen lebenden Helden
//    oder eine offene Creature unter SEINER Kontrolle und nimmt 100 Schaden (Typ „other"; Quelle
//    ist die Karte, Besitzer der Kreis-Besitzer). Ohne Ziel passiert nichts.
//  • Abgang vom Brett: der BESITZER der Karte waehlt (Pflicht) ein beliebiges Ziel — Helden oder
//    Creatures beider Seiten — und verursacht 150 Schaden.
// ═══════════════════════════════════════════

const {
  verlaesstBrett, loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');

const CARD_NAME = 'The Seventh Circle of Hell';
const ENDE = 100;
const ABGANG = 150;

async function schadenAuf(engine, quelle, ziel, betrag) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'lava_fountain', owner: ziel.owner, heroIdx: ziel.heroIdx,
    zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
  });
  await engine._delay(650);
  if (ziel.type === 'hero') {
    const h = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (h && h.hp > 0) await engine.actionDealDamage(quelle, h, betrag, 'other');
  } else if (ziel.cardInstance && ziel.cardInstance.zone === 'support') {
    await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, betrag, 'other',
      { sourceOwner: quelle.owner, canBeNegated: true });
  }
}

module.exports = {
  activeIn: ['hand', 'area'],
  ...cpuBejahen,

  onDeletedFromAnywhere: (engine, pi) => loeschenUndSpielen(engine, pi, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const tp = ctx.activePlayer;
      if (!isSeat(engine, tp)) return;
      const ziele = [...engine.getHeroTargets(tp), ...engine.getCreatureTargets(tp)];
      if (ziele.length === 0) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: ctx.cardOwner });
      // pflichtwahl: der Text sagt „must choose" — kein Abbruch
      const gewaehlt = await engine.promptEffectTarget(tp, ziele, {
        maxTotal: 1,
        title: CARD_NAME,
        description: `Choose a target you control. It takes ${ENDE} damage.`,
        confirmLabel: `🔥 ${ENDE} Damage`,
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });
      const ziel = ziele.find(t => t.id === gewaehlt?.[0]) || ziele[0];
      const quelle = { name: CARD_NAME, owner: ctx.cardOwner, controller: ctx.cardOwner, heroIdx: -1 };
      await schadenAuf(engine, quelle, ziel, ENDE);
      engine.log('seventh_circle_end', { player: engine.gs.players[tp]?.username, target: ziel.cardName, damage: ENDE });
      engine.sync();
    },

    onCardLeaveZone: async (ctx) => {
      if (!verlaesstBrett(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      // pflichtwahl: „choose a target and deal 150 damage" ist keine Option, sondern Pflicht
      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        baseDamage: ABGANG,
        title: CARD_NAME,
        description: `Choose a target and deal ${ABGANG} damage to it.`,
        confirmLabel: `🔥 ${ABGANG} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!ziel) return;
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: -1 };
      await schadenAuf(engine, quelle, ziel, ABGANG);
      engine.log('seventh_circle_leave', { player: engine.gs.players[pi]?.username, target: ziel.cardName, damage: ABGANG });
      engine.sync();
    },
  },
};
