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

      // ── Resolve damage ──
      const source = { name: CARD_NAME, owner: pi, heroIdx };

      // Pre-damage post-target hand-reaction window — ONE consolidated
      // prompt per source for Sculpture Guards / Spectral Armor / etc.
      // covering the full hero + creature target list.
      const allTargets = [
        ...heroTargets.map(ht => ({
          type: 'hero', owner: ht.owner, heroIdx: ht.heroIdx,
          cardName: gs.players[ht.owner]?.heroes?.[ht.heroIdx]?.name,
        })),
        ...creatureTargets.map(inst => ({
          type: 'creature', owner: inst.controller ?? inst.owner,
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name,
        })),
      ];
      // A post-target reaction (Storm Ring / Invisibility Cloak) may
      // fully negate this Spell here. `preDamageMultiTargetWindow` now
      // returns the result + sets `_spellNegatedByEffect`; bail BEFORE
      // any damage AND before the Area wipe so the WHOLE Spell is
      // negated (no side effects) — the play handler routes the card to
      // discard as negated.
      const _negR = await engine.preDamageMultiTargetWindow(source, allTargets);
      if (_negR?.effectNegated) return;

      // ★ v1043 („Interference"): EIN Schlag auf mehrere Ziele.
      // Gezaehlt wird, was WIRKLICH getroffen wird — bei nur einem
      // lebenden Ziel greift der Schutz nicht (Als Vorgabe 12.9.).
      // ★★ v1185: `beginAoeStrike` statt `beginMultiHit` — die Klammer
      // meldet dem Anti-AoE-Fenster (Deepsea Idol) zusaetzlich die
      // Kreaturen des Schlags.
      {
        const lebendeHelden = heroTargets.filter(ht => (gs.players[ht.owner]?.heroes?.[ht.heroIdx]?.hp || 0) > 0).length;
        const lebendeKreaturen = creatureTargets.filter(i => i.zone === 'support');
        await engine.beginAoeStrike(lebendeHelden + lebendeKreaturen.length, {
          creatures: lebendeKreaturen, source,
          amount: DAMAGE, type: 'destruction_spell', sourceOwner: pi,
        });
      }
      try {
      // Heroes — sequential dealDamage so afterDamage hooks fire cleanly per target.
      for (const ht of heroTargets) {
        const live = gs.players[ht.owner]?.heroes?.[ht.heroIdx];
        if (!live || live.hp <= 0) continue;
        await ctx.dealDamage(live, DAMAGE, 'destruction_spell');
      }
      // Creatures — batch via dealCreatureDamage. Each call invokes the
      // creature-damage pipeline (immunities, batch hook, post-death cleanup).
      for (const inst of creatureTargets) {
        if (inst.zone !== 'support') continue;
        await engine.actionDealCreatureDamage(
          source, inst, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true }
        );
      }

      engine.sync();
      } finally {
        engine.endMultiHit();
      }
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
