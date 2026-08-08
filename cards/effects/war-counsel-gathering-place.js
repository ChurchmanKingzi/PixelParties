// ═══════════════════════════════════════════
//  CARD EFFECT: "War Counsel Gathering Place"
//  Spell (Area, Magic Arts Lv2)
//
//  EFFECT: "Whenever a player summons a \"War
//           Counsellor\" Creature, they may pay 8 Gold
//           to immediately have it use its active
//           effect."
//
//  ── "a player" heisst BEIDE ──
//  Der Text nennt keine Seite. Die Area liegt bei
//  ihrem Besitzer, wirkt aber fuer jeden, der einen
//  Ratgeber beschwoert — auch fuer den Gegner. Bezahlt
//  wird von dem, der beschworen hat, und der Effekt
//  loest auch fuer ihn aus.
//
//  ── Zusaetzliche Nutzung, keine ersetzte ──
//  Die 8 Gold kaufen einen EXTRA-Einsatz: die
//  Einmal-pro-Zug-Sperre der Kreatur wird bewusst NICHT
//  gestempelt, sonst wuerde man Gold dafuer bezahlen,
//  seine normale Aktivierung zu verlieren. (Punkt fuer
//  Al zum Nachjustieren, falls anders gemeint.)
//
//  Die eigene Aktivierungsbedingung der Kreatur gilt
//  weiter: Gorinthian braucht seine zwei
//  verschiedenen Ratgeber, Thebinxan Karten im Deck.
//  Ist sie nicht erfuellt, gibt es kein Angebot.
//
//  ── Aufruf des fremden Effekts ──
//  Wie server.js bei einer normalen Aktivierung:
//  Skript laden, `engine._createContext(inst, {})`,
//  `onCreatureEffect(ctx)` aufrufen. Der Kartenstapel
//  fuer Prompt-Bilder wird mitgefuehrt und im finally
//  wieder abgeraeumt, damit ein Fehler ihn nicht
//  stehen laesst.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { isWarCounsellorCreatureName } = require('./_war-counsellor-shared');

const CARD_NAME = 'War Counsel Gathering Place';
const GOLD_COST = 8;

module.exports = {
  // Area-Karten liegen in gs.areaZones; nur von dort aus hoert die Karte zu.
  activeIn: ['area'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      // Die gerade beschworene Kreatur — NICHT diese Area-Karte.
      const summoned = ctx.playedCard;
      if (!summoned || summoned === ctx.card) return;
      if (summoned.zone !== 'support') return;
      if (!isWarCounsellorCreatureName(engine, summoned.name)) return;

      // Bezahlt und aktiviert der, der beschworen hat — beide Seiten.
      const pi = summoned.controller ?? summoned.owner;
      const ps = gs.players[pi];
      if (!ps) return;
      if ((ps.gold || 0) < GOLD_COST) return;

      const script = loadCardEffect(summoned.name);
      if (!script?.creatureEffect || !script?.onCreatureEffect) return;

      // Eigene Bedingung der Kreatur beachten.
      if (typeof script.canActivateCreatureEffect === 'function') {
        try {
          const probe = engine._createContext(summoned, {});
          if (!script.canActivateCreatureEffect(probe)) return;
        } catch { return; }
      }

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Pay ${GOLD_COST} Gold to have ${summoned.name} use its active effect immediately?`,
        showCard: CARD_NAME,
        confirmLabel: `💰 Pay ${GOLD_COST}`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!confirmed || confirmed.cancelled) return;

      // Gold erst jetzt abbuchen — und nur, wenn es noch da ist.
      const paid = await engine.actionSpendGold(pi, GOLD_COST);
      if (!paid) {
        engine.log('gathering_place_unpaid', { player: ps.username, card: summoned.name });
        return;
      }

      engine.log('gathering_place_trigger', {
        player: ps.username, card: summoned.name, gold: GOLD_COST,
      });

      const effCtx = engine._createContext(summoned, {});
      engine._promptCardStack.push(summoned.name);
      try {
        await script.onCreatureEffect(effCtx);
      } catch (err) {
        console.error(`[${CARD_NAME}] ${summoned.name} onCreatureEffect threw:`, err.message);
      } finally {
        engine._promptCardStack.pop();
      }
      engine.sync();
    },
  },
};
