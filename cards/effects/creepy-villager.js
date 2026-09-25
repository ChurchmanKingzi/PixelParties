// ═══════════════════════════════════════════
//  CARD EFFECT: „Creepy Villager"
//  Creature (Summoning Magic Lv 0, 1 HP, PP DD)
//
//  „Control of this Creature cannot change. You may once per turn add
//   this Creature that was not summoned this turn from your side of the
//   board to your hand to place a \"Dark Deepsea God\" from your hand
//   into the Support Zone it occupied, ignoring its summoning
//   condition. When this Creature you control is defeated, discard 2
//   cards (or your entire hand if you have fewer cards than that)."
//
//  BAUART
//  ──────
//  • ★ „CONTROL CANNOT CHANGE" ist ein EIGENER, ENGER VERTRAG
//    (`controlCannotChange: true`, v1021) — NICHT die Omni-Immunitaet
//    der Cardinal Beasts. Der Villager bleibt angreifbar, zerstoerbar
//    und opferbar; nur der Kontrolleur steht fest. Die Engine liest
//    das an beiden Kontrollwegen (dauerhaft und temporaer).
//
//  • ★ DER AUSTAUSCH IST DIE ABKUERZUNG ZUM DDG: normalerweise kostet
//    der Gott zwei Kreaturen mit zusammen Level 4+ UND eine Aktion.
//    Hier geht EINE Kreatur zurueck auf die Hand, und der Gott nimmt
//    IHRE Zone — „ignoring its summoning condition". Der Villager
//    selbst nennt keine Aktion, also ist der Tausch aktionsfrei
//    (★-Regel 7.9.).
//
//  • ★ PLATZIEREN DURCH EINEN EFFEKT ZAEHLT ALS EFFEKT-BESCHWOERUNG und
//    loest On-Summon-Effekte aus (Als Ruling 8.9.) — DDGs
//    Flaechenschaden liegt in seinem `beforeSummon`, nicht in `onPlay`,
//    und wird deshalb ausdruecklich ueber seinen exportierten Helfer
//    gezuendet. Dessen Einmal-pro-Zug-Riegel (`ddg_aoe`) steckt im
//    Helfer, der Weg kann also nicht doppelt zuenden.
//
//  • „that was not summoned this turn" gilt fuer den VILLAGER (er ist
//    das, was zurueckgeht) — geprueft ueber `inst.turnPlayed`.
//
//  • Der Abwurf beim Tod trifft den KONTROLLEUR („this Creature YOU
//    control"), nicht den Besitzer. Weniger als zwei Karten auf der
//    Hand: dann eben alles, was da ist (`actionPromptForceDiscard`
//    nimmt die Handgroesse von selbst als Obergrenze).
// ═══════════════════════════════════════════

const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Creepy Villager';
const GOTT = 'Dark Deepsea God';
const ABWURF = 2;
const MANIFEST_HALB_MS = 1250;   // wie in dark-deepsea-god.js

/** Liegt ein „Dark Deepsea God" auf der Hand dieses Spielers? */
function gottAufDerHand(engine, pi) {
  return (engine.gs.players[pi]?.hand || []).indexOf(GOTT);
}

module.exports = {
  creatureEffect: true,

  // ★ „Control of this Creature cannot change." (s. Kopf)
  controlCannotChange: true,

  // Der Text nennt keine Aktion — also aktionsfrei (★-Regel 7.9.).

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    const pi = inst.controller ?? inst.owner;
    // „that was not summoned this turn"
    if ((inst.turnPlayed || 0) === (engine.gs.turn || 0)) return false;
    return gottAufDerHand(engine, pi) >= 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    if ((inst.turnPlayed || 0) === (gs.turn || 0)) return false;
    const handIdx = gottAufDerHand(engine, pi);
    if (handIdx < 0) return false;

    // Die Zone merken, BEVOR der Villager sie verlaesst.
    const heroIdx = inst.heroIdx;
    const slotIdx = inst.zoneSlot;

    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

    // ── ① Der Villager geht zurueck auf die Hand ────────────────
    const zurueck = await returnSupportCreatureToHand(engine, inst, CARD_NAME);
    if (!zurueck?.returned) return false;

    // ── ② Der Gott steigt aus SEINER Zone auf ───────────────────
    const idxJetzt = (ps.hand || []).indexOf(GOTT);
    if (idxJetzt < 0) return false;
    engine.takeFromPileSync(ps, 'hand', idxJetzt);
    engine.notePlayedFromHand(pi);

    engine._broadcastEvent('dark_deepsea_god_manifest', { owner: pi });
    engine._broadcastEvent('hero_announcement', { text: `${GOTT} awakens!` });
    await engine._delay(MANIFEST_HALB_MS);

    const platz = await engine.actionPlaceCreature(GOTT, pi, heroIdx, slotIdx, {
      source: 'external',
      sourceName: CARD_NAME,
      animationType: 'none',
      fireHooks: true,
    });
    await engine._delay(MANIFEST_HALB_MS);

    engine.log('creepy_villager_swap', {
      player: ps.username, heroIdx, slotIdx, placed: !!platz,
    });

    // ── ③ ★ On-Summon-Effekt des Gottes (s. Kopf) ───────────────
    if (platz?.inst) {
      const ddg = require('./dark-deepsea-god');
      if (typeof ddg.fireDdgAoE === 'function') {
        await ddg.fireDdgAoE(engine, pi, platz.inst, false);
      }
    }
    engine.sync();
    return true;
  },

  hooks: {
    /** „When this Creature you control is defeated, discard 2 cards …" */
    onCreatureDeath: async (ctx) => {
      const tod = ctx.creature;
      if (!tod || tod.instId !== ctx.card?.id) return;      // nur diese Karte
      const engine = ctx._engine;
      const inst = ctx.card;
      const pi = inst.controller ?? inst.owner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      if ((ps.hand || []).length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const vorher = ps.hand.length;
      await engine.actionPromptForceDiscard(pi, ABWURF, {
        title: CARD_NAME,
        source: CARD_NAME,
        selfInflicted: true,          // eigene Karte, kein Gegner-Zwang
      });
      engine.log('creepy_villager_toll', {
        player: ps.username, discarded: Math.min(ABWURF, vorher),
      });
      engine.sync();
    },
  },
};
