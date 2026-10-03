// ═══════════════════════════════════════════
//  CARD EFFECT: "Cataclysm"
//  Spell (Destruction Magic Lv3, Normal)
//
//  While ANY Area is in play (own OR opponent's),
//  this Spell's effective level becomes 0.
//
//  On cast: deal 100 destruction-spell damage to
//  EVERY target on the board (heroes + creatures,
//  both sides — including the caster's own side
//  per card text). Then send all Areas on the
//  board to their respective owners' discard
//  piles.
//
//  Animation: a giant orange-red burning meteor
//  crashes from the top-right of the screen into
//  the centre of the battlefield, then radiating
//  flame impacts on every target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cataclysm';
const DAMAGE    = 100;

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'cataclysm' }, impactMs: 260,
  },

  // Active in 'hand' so the level reduction hook fires while in hand.
  activeIn: ['hand'],

  /**
   * Self-reduction: while ANY Area is in play, drop this card's level
   * from 3 → 0. The engine's `_applyCardLevelReductions` walks every
   * tracked instance the controller owns and sums their hooks, so we
   * only return the rebate when the cardData passed in is THIS card.
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (cardData?.name !== CARD_NAME) return 0;
    if (!require('./_hooks').selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx)) return 0;   // v1293
    const gs = engine?.gs;
    const hasArea = !!(
      (gs?.areaZones?.[0] || []).length > 0 ||
      (gs?.areaZones?.[1] || []).length > 0
    );
    return hasArea ? 3 : 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const cardDB = engine._getCardDB();

      // ── Collect every target on the board (both sides, all heroes + creatures) ──
      const heroTargets = [];
      const creatureTargets = [];
      for (let tpi = 0; tpi < 2; tpi++) {
        const tps = gs.players[tpi];
        if (!tps) continue;
        for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
          const h = tps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          heroTargets.push({ owner: tpi, heroIdx: hi, hero: h });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        creatureTargets.push(inst);
      }

      // ── Animation: meteor falls from top-right into centre ──
      // Anchored to the caster's hero element so playAnimation has a
      // valid DOM target — the Cataclysm React component itself ignores
      // the (x,y) position and renders to the full viewport.
      //
      // `duration: 3000` is CRITICAL: play_zone_animation defaults the
      // component lifetime to 1000ms (`onZoneAnim` → playAnimation),
      // which unmounts the component mid-fall — the meteor vanished and
      // the impact (every impact sub-animation is keyed `delay: 1300ms`)
      // never rendered at all. The full sequence is fall (1300ms) +
      // screen-engulfing explosion / shockwave / embers (~1450ms more);
      // 3000ms keeps it mounted through the whole thing with margin.
      engine._broadcastEvent('play_zone_animation', {
        type: 'cataclysm', owner: pi,
        heroIdx: Math.max(0, heroIdx), zoneSlot: -1,
        duration: 3000,
      });
      // The meteor takes ~1.3s to reach the centre; the `cataclysm`
      // component then detonates a screen-engulfing explosion at the
      // impact point. We do NOT fire per-target flame bursts anymore —
      // the one giant blast IS the impact, and the old per-target loop
      // + extra delay is exactly what made the meteor-touchdown→effect
      // gap feel so long. Wait for touchdown, give the blast a beat to
      // bloom over the whole board, then resolve damage so the
      // explosion reads as dealing it.
      await engine._delay(1300);
      await engine._delay(260);

      // ── Resolve damage — EIN Flaechenschlag (Prinzip: markieren → reagieren → wirken → Tode) ──
      // `dealDamageToTargets` markiert die Ziele (Immunitaeten inklusive), laesst die getroffenen
      // Ziele reagieren (Helden-Surprises und Hand-Reaktionen, VOR dem ersten Schaden; „is chosen by"-
      // Surprises wie Frost Rune duerfen hier mitreagieren), trifft dann ALLE Ziele und wertet
      // erst danach die Tode aus (Helden-KOs aufgeschoben, Kreaturen in EINEM Stapel). Negiert eine
      // Reaktion den Zauber, faellt der Schaden an ALLEN Zielen weg — und die Areas bleiben liegen.
      const ziele = [
        ...heroTargets.map(ht => ({ type: 'hero', owner: ht.owner, heroIdx: ht.heroIdx })),
        ...creatureTargets.map(inst => ({ type: 'creature', inst })),
      ];
      const res = await engine.dealDamageToTargets(ctx.card, ziele, {
        damage: DAMAGE, damageType: 'destruction_spell', sourceName: CARD_NAME,
        chosenSurprises: true, istFlaeche: true, hitDelay: 0,
      });
      if (res?.cancelled) return;
      engine.sync();
      await engine._delay(300);

      // ── Wipe every Area on the board ──
      const removed = await engine.removeAllAreas(-2, CARD_NAME);

      engine.log('cataclysm_resolved', {
        player: gs.players[pi]?.username,
        heroes: heroTargets.length,
        creatures: creatureTargets.length,
        areasRemoved: removed,
      });
      engine.sync();
    },
  },
};
