// ═══════════════════════════════════════════
//  CARD EFFECT: "Super-Killing Knife, the Tool of Liquidation"
//  Artifact (Equipment, 10 Gold)
//
//  „Equip this card to a Hero you control. The equipped Hero's Attack
//   stat is increased by 10. Creatures that are hit by the Hero with an
//   Attack are defeated.\"
//
//  Zwei Teile
//  ──────────
//  ① +10 ATK ueber `ctx.grantAtk` beim Anlegen und beim Spielstart
//    (Vorbild Shattered Trident), zurueckgenommen beim Abgang.
//  ② „Creatures that are HIT by the Hero with an Attack are defeated\":
//    nicht „Schaden erhoeht\", sondern eine Ersetzung des Ergebnisses.
//    Umgesetzt in `afterCreatureDamageBatch` — dort steht fest, WELCHE
//    Kreaturen der Angriff tatsaechlich getroffen hat, und der Schaden
//    ist bereits verrechnet. Was den Treffer ueberlebt hat, faellt
//    anschliessend.
//
//    „hit\" heisst getroffen: ein Angriff, der abgewehrt, negiert oder
//    auf 0 reduziert wurde, hat nicht getroffen — dann passiert nichts.
//    Und nur eigene Angriffe DIESES Helden zaehlen, nicht Effekte, die
//    er wirkt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Super-Killing Knife, the Tool of Liquidation';
const ATK_BONUS = 10;

module.exports = {

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],

  cpuMeta: { dealsDamage: true },

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card.id) return;
      if (!ctx.leavingCard && (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot)) return;
      ctx.revokeAtk();
    },

    /** ② Was der Angriff dieses Helden getroffen hat, faellt. */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const pi = ctx.cardOwner;

      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (e.type !== 'attack') continue;                 // nur Angriffe
        const q = e.source;
        if (!q) continue;
        // Der Angriff muss von MEINEM Wirtshelden kommen.
        if (q.heroIdx !== inst.heroIdx) continue;
        if ((q.owner ?? q.controller) !== pi) continue;
        // „hit\" — kein Treffer, kein Tod.
        const gelandet = e.realDealt ?? e.amount ?? 0;
        if (!(gelandet > 0)) continue;

        const opfer = e.inst;
        if (!opfer || opfer.zone !== 'support') continue;   // schon gefallen
        if (engine.isOmniImmune(opfer)) continue;

        await engine.actionDestroyCard(inst, opfer, { sourceName: CARD_NAME });
      }
      engine.sync();
    },
  },
};
