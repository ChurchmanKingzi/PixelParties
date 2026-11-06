// ═══════════════════════════════════════════
//  CARD EFFECT: "Ferocious Jaguar Warrior"
//  Creature (Normal), Lv1, 50 HP, Summoning Magic
//
//  "You may remove 1 Doom Counter from a 'Doom Clock'
//   on the board to summon this Creature as an
//   additional Action. Whenever you sacrifice a
//   Creature you control, you may choose a target and
//   deal 50 damage to it."
//
//  Als Ruling (5.8.): "a Doom Clock" ohne
//  Spezifikation -> der Spieler WAEHLT. Deshalb der
//  Picker aus dem geteilten Modul (bei nur einer Uhr
//  ohne Rueckfrage).
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');
const T = require('./_teocuilatl-shared');   // Special/Normal-Wahl (Nr. 82)

const CARD_NAME = 'Ferocious Jaguar Warrior';
const DAMAGE = 50;

module.exports = {
  activeIn: ['hand', 'support'],
  requiresTarget: true,

  // Zusatz-Aktion nur, wenn irgendwo ein Counter liegt.
  // Als Ruling (Al 26.10.): „Ja, natürlich nur, wenn reguläre Beschwörung via Action verfügbar ist" — Special (Counter, Zusatzaktion) ODER Normal (Aktion, ohne Counter):
  // wahr nur dort, wo Special der EINZIGE Weg ist (Main Phase / keine freie Aktion); sonst wählt der Spieler in `beforeSummon` (Muster Blue-Ice Dragon).
  inherentAction(gs, pi, heroIdx, engine) {
    return T.specialErzwungen(engine, pi, heroIdx, CARD_NAME, engine ? D.clocksWithCounters(engine).length > 0 : false);
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Nur der Zusatz-Aktions-Weg kostet einen Counter; normale
    // Beschwoerungen und Effekt-Platzierungen bleiben frei.
    // Wahl Special/Normal nur im Spieler-Weg (`_isNormalSummon`) mit Counter UND freier regulärer Beschwörung; fremde „as an additional Action"-Beschwörungen (Ushabti …) fragen nicht.
    let special = !!ctx.isInherentAction;
    if (!special && ctx._isNormalSummon === true && !ctx._alsZusatzaktion && D.clocksWithCounters(engine).length > 0) {
      special = await T.frageSpecial(engine, pi, CARD_NAME, '🐆 Special (remove 1 Doom Counter, free Action)');
    }
    if (!special) return true;

    const uhr = await D.pickClock(engine, pi, D.clocksWithCounters(engine), {
      title: CARD_NAME,
      message: 'Remove 1 counter from which Doom Clock?',
      cancellable: true,
    });
    if (!uhr) return false;                 // Abbruch -> Karte bleibt in der Hand
    if (D.removeCounters(engine, uhr, 1) !== 1) return false;
    engine.log('jaguar_summon_cost', {
      player: engine.gs.players[pi]?.username,
    });
    // Special bei schon eingezogener Aktion: server.js erstattet sie (Muster Blue-Ice Dragon).
    if (!ctx.isInherentAction) engine.gs._summonModeUpgradedToInherent = pi;
    return true;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    /**
     * "Whenever YOU sacrifice a Creature YOU control" — also nur eigene
     * Opfer, und die Jaguar-Instanz muss auf dem Brett liegen.
     */
    onCreatureSacrificed: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (ctx.card?.zone !== 'support') return;
      const opferBesitzer = ctx.creature?.controller ?? ctx.creature?.owner;
      if (opferBesitzer !== pi) return;
      if (ctx.creature?.id === ctx.card?.id) return;   // sich selbst nicht

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `You sacrificed a Creature — deal ${DAMAGE} damage to a target?`,
        confirmLabel: `🐆 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) return;

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, DAMAGE, 'creature');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
          ziel.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
    },
  },
};
