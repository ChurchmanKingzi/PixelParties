// ═══════════════════════════════════════════
//  CARD EFFECT: "Pet Snake"
//  Creature (Summoning Magic Lv0) — 10 HP
//
//  Two independent features:
//
//  [A] Alt summon from hand
//      When any of your Heroes has the Poisoned
//      status and the once-per-turn token
//      `pet-snake-alt:<pi>` is unclaimed, this
//      creature plays as an additional Action
//      (no Main/Action-Phase cost). The onPlay
//      hook prompts for which poisoned Hero to
//      cure as the payment, then claims HOPT.
//      Limited to 1 alt-summon per turn per
//      player total (across all copies of Pet
//      Snake in hand).
//
//      If Stinky Stables is in play, poison
//      removal is engine-blocked, so the alt
//      summon also fails gracefully (the Area
//      gate takes precedence).
//
//  [B] On-board active effect
//      Once per turn per copy, inflict 1 Stack
//      of Poison onto a Poisoned target (hero
//      or creature, any side). Standard creature
//      HOPT key — managed by the engine.
// ═══════════════════════════════════════════

/**
 * W16d (A09-16): ist das Gift dieses Helden HEILBAR? Unter Stinky Stables (Gift-Heilsperre), mit `unhealable`-Gift
 * oder Fluch-Sperre ist „heal a Poisoned Hero from its Poison" nicht zahlbar -> keine Zusatzbeschwörung.
 */
function giftHeilbar(engine, pi, hi, hero) {
  if (!hero?.statuses?.poisoned) return false;
  if (hero.statuses.poisoned.unhealable) return false;
  if (engine && engine._isPoisonHealLocked?.() && !engine._isDiverHelmetProtectedTarget?.(hero)) return false;
  if (engine && engine._heroStatusRemovalBlocked?.(pi, hi, 'poisoned')) return false;
  return true;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'poison_pollen_rain' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // [A] Alt summon gate.
  inherentAction: (gs, pi, _heroIdx, engine) => {
    if (gs.hoptUsed?.[`pet-snake-alt:${pi}`] === gs.turn) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    const eng = engine || gs._engineRef;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp > 0 && h.statuses?.poisoned && giftHeilbar(eng, pi, hi, h)) return true;
    }
    return false;
  },

  // [B] On-board active effect.
  creatureEffect: true,
  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    // Every Poisoned target on the board, either side.
    const targets = [];
    for (let p = 0; p < engine.playerCount(); p++) {
      const ps = gs.players[p];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (!h.statuses?.poisoned) continue;
        targets.push({
          id: `hero-${p}-${hi}`, type: 'hero',
          owner: p, heroIdx: hi, cardName: h.name,
        });
      }
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support' || inst.faceDown) continue;
      if (!inst.counters?.poisoned) continue;
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, cardInstance: inst,
      });
    }

    if (targets.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: 'Pet Snake',
      description: 'Inflict 1 Stack of Poison to a Poisoned target.',
      confirmLabel: '🐍 Poison!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;
    const chosen = targets.find(t => t.id === picked[0]);
    if (!chosen) return false;

    engine._broadcastEvent('play_zone_animation', {
      type: 'poison_pollen_rain',
      owner: chosen.owner,
      heroIdx: chosen.heroIdx,
      zoneSlot: chosen.type === 'hero' ? -1 : chosen.slotIdx,
    });
    await engine._delay(400);

    if (chosen.type === 'hero') {
      await engine.addHeroStatus(chosen.owner, chosen.heroIdx, 'poisoned', {
        addStacks: 1, appliedBy: pi,
      });
    } else if (chosen.cardInstance) {
      await engine.actionApplyCreaturePoison(
        { name: 'Pet Snake', owner: pi }, chosen.cardInstance,
      );
    }
    engine.sync();
    return true;
  },

  hooks: {
    // [A] continued — pay the poison-cleanse cost when the alt-summon fires.
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Nur die Spieler-Beschwoerung aus der Hand zahlt die Heilung ("to summon this Creature as an
      // additional Action"): per Effekt beschworen/platziert (Barker, Tamed Hell Fox, Living Illusion …)
      // kostet nichts und stempelt den Alt-Beschwoerungs-Zaehler nicht.
      if (!ctx._isNormalSummon) return;

      // Only fire the alt path on the fresh cast from hand. Skip if:
      //   • HOPT already claimed this turn.
      //   • No own hero is poisoned (could've changed mid-chain).
      if (gs.hoptUsed?.[`pet-snake-alt:${pi}`] === gs.turn) return;

      const poisonedHeroes = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (!h.statuses?.poisoned) continue;
        if (!giftHeilbar(engine, pi, hi, h)) continue;   // W16d (A09-16): nur heilbares Gift ist zahlbar
        poisonedHeroes.push({
          id: `hero-${pi}-${hi}`, type: 'hero',
          owner: pi, heroIdx: hi, cardName: h.name,
        });
      }
      if (poisonedHeroes.length === 0) return;

      const picked = await engine.promptEffectTarget(pi, poisonedHeroes, {
        title: 'Pet Snake',
        description: 'Heal a Poisoned Hero to complete this free summon.',
        confirmLabel: '🐍 Cure & Summon!',
        confirmClass: 'btn-success',
        cancellable: false,
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) return;
      const chosen = poisonedHeroes.find(t => t.id === picked[0]);
      if (!chosen) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: pi, heroIdx: chosen.heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.removeHeroStatus(pi, chosen.heroIdx, 'poisoned');
      // W16d (A09-16): nur wenn die Heilung wirklich gelang, sind die Kosten bezahlt (sonst kein Einmal-pro-Zug-Stempel).
      if (ps.heroes?.[chosen.heroIdx]?.statuses?.poisoned) { engine.sync(); return; }
      engine.claimHOPT('pet-snake-alt', pi);

      engine.log('pet_snake_alt_summon', {
        player: ps.username,
        cured: ps.heroes?.[chosen.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
