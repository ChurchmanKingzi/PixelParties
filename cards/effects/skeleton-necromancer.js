// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Necromancer"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn discard a card to choose a "Skeleton" Creature,
//  except "Skeleton Necromancer", from your discard pile and place it
//  into the free Support Zone of any Hero you control.
// ═══════════════════════════════════════════

const {
  isSkeletonCreature,
  findSkeletonsInDiscard,
  getFreeSupportZonesAcrossHeroes,
} = require('./_skeleton-shared');

const CARD_NAME = 'Skeleton Necromancer';

/** Discard-pile Skeletons, excluding self-name. */
function eligibleTutorTargets(ps, engine) {
  return findSkeletonsInDiscard(ps, engine).filter(c => c.name !== CARD_NAME);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'necromancy_summon' }, impactMs: 260,
  },

  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    // Must have a card to discard, an eligible Skeleton in discard,
    // and a free Support Zone on some living Hero.
    if ((ps.hand || []).length === 0) return false;
    if (eligibleTutorTargets(ps, engine).length === 0) return false;
    if (getFreeSupportZonesAcrossHeroes(engine, pi).length === 0) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Step 1: pick the Skeleton from discard (cancellable — pre-cost).
    const candidates = eligibleTutorTargets(ps, engine);
    if (candidates.length === 0) return false;
    const gallery = candidates.map(c => ({ name: c.name, source: 'discard', count: c.count }));
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Discard 1 card to revive this Skeleton from your discard pile.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const chosenName = picked.cardName;
    if (!candidates.some(c => c.name === chosenName)) return false;

    // Step 2: pick the destination free zone on any of own Heroes.
    let zones = getFreeSupportZonesAcrossHeroes(engine, pi);
    if (zones.length === 0) return false;
    let chosenZone;
    if (zones.length === 1) {
      chosenZone = zones[0];
    } else {
      const zonePick = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: `Place ${chosenName} into a free Support Zone.`,
        cancellable: true,
      });
      if (!zonePick) return false;
      chosenZone = zones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx) || zones[0];
    }

    // Step 3: pay the discard cost (player picks). The discard fly-out
    // is animated by `actionPromptForceDiscard`'s explicit
    // `play_pile_transfer` broadcast — no extra spacing needed here.
    if ((ps.hand || []).length === 0) return false;
    await engine.actionPromptForceDiscard(pi, 1, {
      costFor: CARD_NAME,          // ★ v1041: Kosten-Abwurf-Lernkanal
      title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
    });

    // Reuse the Necromancy Ability's signature dark-magic skull burst
    // on the destination zone — same visual language as the Ability's
    // discard-pile revive, since this Creature performs essentially
    // the same effect. Played on the chosen Support Zone so the
    // animation lands where the Skeleton arrives.
    engine._broadcastEvent('play_zone_animation', {
      type: 'necromancy_summon', owner: pi,
      heroIdx: chosenZone.heroIdx, zoneSlot: chosenZone.slotIdx,
    });
    await engine._delay(800);

    // Step 4: pull the chosen Skeleton from discard. Race-safe: another
    // effect could have removed it during the discard prompt.
    const discardIdx = ps.discardPile.indexOf(chosenName);
    if (discardIdx < 0) {
      engine.log('skeleton_necromancer_fizzle', {
        player: ps.username, reason: 'gone_from_discard',
      });
      engine.sync();
      return true; // cost was paid; activation counts.
    }
    // Step 5 (v1389): Platzieren aus der Ablage über die EINE Stelle
    // (summonFromDiscard → actionPlaceCreature 'discard': Sperre, Lethe,
    // Flug, Signal `_summonedFromDiscard` für Skullmael/Soul Shards).
    // Früher: eigene Entnahme + Sentinel `source: 'deck'` + Rückbuchung.
    const placeRes = await engine.summonFromDiscard(pi, pi, discardIdx, chosenZone.heroIdx, chosenZone.slotIdx, {
      mode: 'place', source: CARD_NAME,
      placeOpts: { countAsSummon: true, animationType: 'summon', fireHooks: true },
    });
    if (!placeRes?.inst) {
      engine.sync();
      return true; // Kosten bezahlt, Aktivierung zählt; Karte bleibt in der Ablage.
    }

    engine.log('skeleton_necromancer', {
      player: ps.username, placed: chosenName,
      heroIdx: chosenZone.heroIdx, zoneSlot: chosenZone.slotIdx,
    });
    engine.sync();
    return true;
  },
};
