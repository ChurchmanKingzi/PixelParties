// ═══════════════════════════════════════════
//  CARD EFFECT: "Null Zone"
//  Spell (Magic Arts Lv1, Normal)
//  Pollution archetype.
//
//  Place 2 Pollution Tokens into your free Support
//  Zones to use this Spell.
//  Until the end of your next turn:
//    • All Creatures on the board gain the "Nulled"
//      status — their effects are negated while the
//      status is active.
//    • All Heroes gain the "Nulled" status — they
//      can still use Attacks, Creatures, and
//      Abilities, but NOT Spells.
//  "Nulled" is a cleansable negative status: Juice,
//  Tea, Coffee, and anything else in the status-
//  cleanse family strip it via the shared negative-
//  statuses registry.
//
//  Inherent additional Action: playable from hand
//  during the Main Phases as well as the Action
//  Phase, and never consumes the turn's Action —
//  same pattern as Spontaneous Reappearance.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones, payTokenCost, kostenSchonBezahlt } = require('./_pollution-shared');
const { hasCardType, isCreatureNegated } = require('./_hooks');

module.exports = {
  // ★★ v1186 (Als Regel 18.9.): AoE OHNE SCHADEN. Die
  // Autoerkennung des Loaders haengt an der Schadensklammer —
  // diese Karte teilt keinen Schaden aus (negiert die Effekte ALLER Kreaturen), waere
  // also fuer Engine und CPU-Pilot keine AoE-Karte gewesen.
  // Deshalb von Hand deklariert (Waechter `check-aoe-text`).
  hitsMultipleTargets: true,

  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'null_zone_spiral' }, impactMs: 260,
  },

  placesPollutionTokens: true,
  // Free action in both phases — no action cost, no phase advance.
  inherentAction: true,

  spellPlayCondition(gs, pi) {
    return countFreeZones(gs, pi) >= 2;
  },

  // ★ W4b (Al, Welle 4): die Token-Kosten („… to use this Spell") werden VOR dem Reaktionsfenster bezahlt und
  // bleiben bei Ganz-Negierung bezahlt (Helfer in `_pollution-shared.js`).
  async payActivationCost(ctx) {
    await payTokenCost(ctx, 2, 'Null Zone');
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // ── Pay cost ── (Normalweg: schon in `payActivationCost` bezahlt; sonst Fallback)
      if (!kostenSchonBezahlt(ctx)) await placePollutionTokens(engine, pi, 2, 'Null Zone', { promptCtx: ctx });

      // ── ★ W15a (Al, R01-10 + Q156): Fläche ohne Schaden — „hit by"-Surprises und Hand-Reaktionen über alle Ziele des Bretts, nach der Kostenzahlung ──
      {
        const ziele = [];
        for (let p = 0; p < gs.players.length; p++) {
          (gs.players[p]?.heroes || []).forEach((h, hi) => { if (h?.name && h.hp > 0) ziele.push({ type: 'hero', owner: p, heroIdx: hi }); });
        }
        for (const inst of engine.cardInstances) {
          if (inst.zone !== 'support' || inst.faceDown) continue;
          const cd = inst.counters?._cardDataOverride || cardDB[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          ziele.push({ type: 'creature', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name });
        }
        const sr = await engine.statusHitSurpriseWindow(ctx.card, ziele.filter(z => z.type === 'hero'), 'magic_arts_spell', { ziele });
        if (sr?.effectNegated) return;
      }

      // ── Apply effects ──
      // Expiry: "end of your next turn" = Beginn des ersten Zuges NACH dem
      // naechsten eigenen Zug (T + 3, Zug des Gegners) — wie Disruption Ray;
      // der naechste eigene Zug (T + 2) steht noch voll unter Null Zone.
      const expiresAtTurn = gs.turn + 3;
      const expiresForPlayer = engine.opponentOf(pi);

      // Apply the Nulled status to every Creature on the board. We use
      // actionNegateCreature with statusKey='nulled' so the counter
      // surfaces as the "Nulled" cleansable status rather than the
      // default "Negated" (which is reserved for Dark Gear et al.).
      // Every targeted creature also gets the purple cosmic spiral.
      let creaturesNulled = 0;
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        // ★ Z2 (A01-19): nur bei bereits vorhandenem `nulled` ueberspringen. Eine anderweitig (kurz) negierte Kreatur
        // bekommt zusaetzlich `nulled` mit eigenem Buff (eigener Zaehler) — sonst liefe ihre kurze Negation zum Zugende
        // ab und Null Zone („all Creatures", bis Ende des naechsten eigenen Zuges) haette sie nicht erfasst.
        if (inst.counters?.nulled) continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'null_zone_spiral',
          owner: inst.controller ?? inst.owner,
          heroIdx: inst.heroIdx,
          zoneSlot: inst.zoneSlot,
        });
        await engine.actionNegateCreature(inst, 'Null Zone', {
          gwSourceOwner: pi,   // W17b: Golden Wings – nur der Gegner ist ausgenommen
          expiresAtTurn,
          expiresForPlayer,
          statusKey: 'nulled',
        });
        creaturesNulled++;
      }

      // Apply the Nulled status to every alive Hero on both sides.
      // The status itself carries expiresAtTurn/expiresForPlayer, and
      // _processBuffExpiry now also expires hero statuses with those
      // fields, so no extra bookkeeping is needed. Each affected hero
      // also gets the purple cosmic spiral.
      let heroesNulled = 0;
      for (let playerIdx = 0; playerIdx < gs.players.length; playerIdx++) {
        const ps = gs.players[playerIdx];
        if (!ps) continue;
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.nulled) continue; // Already nulled
          engine._broadcastEvent('play_zone_animation', {
            type: 'null_zone_spiral', owner: playerIdx, heroIdx: hi, zoneSlot: -1,
          });
          await engine.addHeroStatus(playerIdx, hi, 'nulled', {
            appliedBy: pi,
            expiresAtTurn,
            expiresForPlayer,
          });
          heroesNulled++;
        }
      }
      // Breather so the client has time to render the full swarm of spirals
      await engine._delay(900);

      engine.log('null_zone', {
        player: gs.players[pi].username,
        creaturesNulled, heroesNulled,
        expiresTurn: expiresAtTurn,
      });
      engine.sync();
    },
  },
};
