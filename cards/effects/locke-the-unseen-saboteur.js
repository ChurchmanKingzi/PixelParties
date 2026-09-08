// ═══════════════════════════════════════════
//  CARD EFFECT: "Locke, the Unseen Saboteur"
//  Hero (500 HP, 70 ATK — Fighting + Stealth)
//
//  „You may once per turn, at the beginning of your turn, choose a
//   target your opponent controls. That target's effects are negated
//   until the beginning of your next turn. This counts as a negative
//   status effect."
//
//  · `onTurnStart` im eigenen Zug (Argos-Muster): Locke muss leben und
//    handlungsfaehig sein; ein Prompt ueber Helden UND Kreaturen des
//    Gegners (`promptTarget`, abbrechbar — „you may"). Die Picker
//    filtern Untargetable, Stealth-Anti-Lock usw. generisch.
//  · Held → `addHeroStatus('negated')`: negativer Status (Immune blockt,
//    Cleanser entfernen), Ablauf ueber die Engine am Zugende des
//    Betroffenen — was hier genau „bis zum Beginn deines naechsten Zuges"
//    bedeutet. Zusaetzlich `expiresAtTurn`/`expiresForPlayer` als
//    Sicherheitsnetz.
//  · Kreatur → `actionNegateCreature` (Engine-Vertrag: Cardinal-
//    Immunitaet, Gegner-Effekt-Immunitaet, Defending the Gate, Ablauf
//    bei `expiresAtTurn` = jetziger Zug + 2 im Zug des Anwenders —
//    `gs.turn` zaehlt Spielerzuege, der eigene naechste Zug ist +2).
//    Nicht `selfInflicted`: das ist gegnerischer Zwang, die CC-Immunitaet
//    nach Ablauf gilt.
//  · „once per turn": ein Turn-Start-Trigger feuert je Zug einmal; das
//    HOPT ist trotzdem gestempelt, falls der Zugbeginn je doppelt laeuft.
// ═══════════════════════════════════════════

const CARD_NAME = 'Locke, the Unseen Saboteur';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (engine.isHeroIncapacitated(pi, heroIdx) || hero.statuses?.negated) return;
      if (!engine.claimHOPT('locke-sabotage', pi)) return;

      // Ziel-Picker mit allen Filtern (Untargetable, Stealth, Boris …);
      // `dealsDamage: false` — ein reiner Status-Effekt, keine Schadens-
      // Reaktionen.
      const target = await ctx.promptDamageTarget({
        side: 'enemy', types: ['hero', 'creature'], dealsDamage: false, damageType: 'other',
        appliesStatus: 'negated',
        title: CARD_NAME,
        description: 'You may choose a target your opponent controls — its effects are negated until the beginning of your next turn. (Negative status.)',
        confirmLabel: '🕶️ Sabotage!', confirmClass: 'btn-danger',
        cancellable: true, source: CARD_NAME,
      });
      if (!target) return;

      const oppIdx = pi === 0 ? 1 : 0;
      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!th?.name || th.hp <= 0) return;
        await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
          appliedBy: pi, source: CARD_NAME,
          expiresAtTurn: gs.turn + 2, expiresForPlayer: pi,
        });
      } else if (target.cardInstance) {
        await engine.actionNegateCreature(target.cardInstance, CARD_NAME, {
          expiresAtTurn: gs.turn + 2, expiresForPlayer: pi,
          buffKey: 'locke_negated', removeAnim: 'status_remove',
        });
      }
      engine.log('locke_sabotage', { player: gs.players[pi]?.username, target: target.cardName, side: oppIdx });
      engine.sync();
    },
  },
};
