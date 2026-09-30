// ═══════════════════════════════════════════
//  CARD EFFECT: "Fun-Fun Circus Strongman"
//  Creature (Magic Arts / Summoning Magic Lv3, Normal, 10 HP) — PP MBS
//
//  „When this Creature is summoned, it gains current and max HP equal to
//   10 times the total number of Applause Counters on the board.
//   Whenever a target is defeated, place 1 Applause Counter on this
//   Creature. You may once per turn deal damage equal to 10 times the
//   number of Applause Counters on the board to any target on the board."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────
//  • „on the board": beide Seiten, alle Creatures (`_applause-shared`).
//  • ① onPlay (auch beim Platzieren): `increaseMaxHp` (aktuelle UND
//    maximale HP), einmalig zum Moment des Erscheinens. Der eigene Stand
//    zaehlt nicht mit — er startet mit 0.
//  • ② „Whenever a target is defeated": JEDES besiegte Ziel, beide
//    Seiten, Helden und Creatures — je Ziel ein Counter (Flaechenschlag
//    mit drei Opfern = drei Counter). Hooks `onCreatureDeath` + `onHeroKO`.
//    Ein eigener Tod zaehlt nicht (die Instanz ist weg).
//  • ③ Freier Creature-Effekt (kostet keine Aktion), einmal pro Zug
//    (Engine-HOPT). Schaden = 10 × Brett-Summe ZUM AUFLOESEN, Typ
//    `creature`. Bei Summe 0 nicht aktivierbar (0 Schaden waere
//    Leerlauf).
// ═══════════════════════════════════════════

const { boardTotal, placeApplause } = require('./_applause-shared');

const CARD_NAME = 'Fun-Fun Circus Strongman';
const HP_PRO_COUNTER = 10;
const SCHADEN_PRO_COUNTER = 10;

async function zaehlerNachTod(ctx, quelleId) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  await engine.showTriggeredEffect(CARD_NAME, {
    playerIdx: ctx.cardController ?? ctx.cardOwner, source: `strongman:${inst.id}:${quelleId}`,
  });
  await placeApplause(engine, inst, 1, { source: CARD_NAME });
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,   // Blinded-Gating (siehe _hooks.js)

  // CPU: Ziel-Prompts nimmt die generische Zielwahl.
  canActivateCreatureEffect(ctx) {
    return boardTotal(ctx._engine) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const summe = boardTotal(engine);
    if (summe <= 0) return false;
    const schaden = SCHADEN_PRO_COUNTER * summe;

    const ziel = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'normal',
      baseDamage: schaden,
      title: CARD_NAME,
      description: `Deal ${schaden} damage (10 × ${summe} Applause Counters) to a target.`,
      confirmLabel: `💪 ${schaden} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!ziel) return false;

    // Zaehler koennen sich waehrend der Wahl geaendert haben — ZUM AUFLOESEN zaehlen.
    const echt = SCHADEN_PRO_COUNTER * boardTotal(engine);
    const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
    engine._broadcastEvent('punch_impact', { owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot });
    await engine._delay(400);

    if (ziel.type === 'hero') {
      const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await ctx.dealDamage(held, echt, 'creature');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        ziel.cardInstance, echt, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
    engine.sync();
  },

  hooks: {
    // ① Beim Erscheinen: HP nach dem Brett-Stand.
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const n = boardTotal(engine);
      if (n <= 0) return;
      engine.increaseMaxHp(ctx.card, HP_PRO_COUNTER * n);
      engine.log('strongman_hp', { player: engine.gs.players[ctx.cardOwner]?.username, gained: HP_PRO_COUNTER * n });
      engine.sync();
    },

    // ② Jedes besiegte Ziel: 1 Counter.
    onCreatureDeath: async (ctx) => {
      const tot = ctx.creature;
      if (!tot || tot.instId === ctx.card.id) return;
      await zaehlerNachTod(ctx, `c${tot.instId}`);
    },
    onHeroKO: async (ctx) => {
      const held = ctx.deadHero || ctx.hero;
      await zaehlerNachTod(ctx, `h${held?.name || ''}:${ctx.heroIdx}`);
    },
  },
};
