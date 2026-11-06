// ═══════════════════════════════════════════
//  CARD EFFECT: "Noble Mummy Guards"
//  Creature (Surprise) — Summoning Magic Lv0
//
//  Activate when the opponent attaches an
//  Ability to a Hero that already has 1+
//  other Abilities.
//  Choose a different Ability on that Hero
//  and bounce the top card back to the
//  owner's hand.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'fan_blow' }, impactMs: 260,
  },

  isSurprise: true,
  surpriseAbilityTrigger: true,

  canTelekinesisActivate(engine, ownerIdx) {
    const oppIdx = engine.opponentOf(ownerIdx);
    const oppPs = engine.gs.players[oppIdx];
    if (!oppPs) return false;
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (engine.abilityStapelListe(oppIdx, hi).length > 0) return true;   // 24.10.: auch Support-Stapel (Xal)
    }
    return false;
  },

  /**
   * Trigger condition: opponent attaches an Ability to a Hero
   * that already has 1+ OTHER Abilities attached.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, abilityInfo, engine) => {
    // Only trigger on opponent ability attachments
    // Styx 28.9.: `attachOwner` = Anleger (Kontrolleur), `zoneOwner` =
    // Brettseite des Helden — beim Anlegen an einen uebernommenen Helden
    // verschieden.
    if (abilityInfo.attachOwner === ownerIdx) return false;
    // Check that the hero has at least 1 other ability besides the new one
    // 24.10.: echte Ability Zonen UND Support-Stapel (Xal).
    let otherAbilityCount = 0;
    for (const eintrag of engine.abilityStapelListe(abilityInfo.zoneOwner ?? abilityInfo.attachOwner, abilityInfo.attachHeroIdx)) {
      const slot = eintrag.namen;
      // Check if this slot contains the newly attached ability
      const inst = abilityInfo.cardInstance;
      if (inst && inst.zoneSlot === eintrag.slot && engine.abilityStapelArt(inst) === eintrag.art && slot.includes(abilityInfo.cardName)) {
        // This slot contains the new ability. W16d (A08-25): auch ein Stapel (dieselbe Fähigkeit eine Stufe höher) ist
        // KEINE „different Ability" – die Optionenliste in onSurpriseActivate überspringt diesen Platz ebenso.
        continue;
      }
      otherAbilityCount++;
    }
    return otherAbilityCount >= 1;
  },

  /**
   * On activation: pick a different Ability on the same Hero and
   * bounce its top card back to the owner's hand.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = engine.opponentOf(pi);

    let attachOwner, attachHeroIdx, attachedInst;

    if (sourceInfo.telekinesis) {
      // Telekinesis mode: let player pick any opponent hero with abilities
      const oppPs = gs.players[oppIdx];
      const heroTargets = [];
      for (let hi = 0; hi < (oppPs?.heroes || []).length; hi++) {
        const hero = oppPs.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const hasAbilities = engine.abilityStapelListe(oppIdx, hi).length > 0;   // 24.10.: auch Support-Stapel (Xal)
        if (!hasAbilities) continue;
        heroTargets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
      }
      if (heroTargets.length === 0) return null;

      let selectedHeroIdx;
      if (heroTargets.length === 1) {
        selectedHeroIdx = heroTargets[0].heroIdx;
      } else {
        const selectedIds = await engine.promptEffectTarget(pi, heroTargets, {
          title: 'Noble Mummy Guards',
          description: 'Choose an opponent Hero to bounce an Ability from:',
          confirmLabel: '💨 Target',
          maxTotal: 1,
          cancellable: false,
        });
        if (!selectedIds || selectedIds.length === 0) return null;
        const target = heroTargets.find(t => t.id === selectedIds[0]);
        if (!target) return null;
        selectedHeroIdx = target.heroIdx;
      }
      attachOwner = oppIdx;
      attachHeroIdx = selectedHeroIdx;
      attachedInst = null;
    } else {
      // Brettseite des Helden (Styx 28.9.), nicht der Anleger.
      attachOwner = sourceInfo.zoneOwner ?? sourceInfo.attachOwner;
      attachHeroIdx = sourceInfo.attachHeroIdx;
      attachedInst = sourceInfo.cardInstance;
    }

    const attachPs = gs.players[attachOwner];
    const attachedCardName = sourceInfo.cardName;

    // Build options: ability slots on the target hero, excluding the newly attached one
    // 24.10.: echte Ability Zonen UND Support-Stapel (Xal).
    const options = [];
    for (const eintrag of engine.abilityStapelListe(attachOwner, attachHeroIdx)) {
      const z = eintrag.slot;
      const slot = eintrag.namen;
      // Skip the stack that contains the newly attached ability (if it's the only card there, or the top card IS the new one)
      if (attachedInst && attachedInst.zoneSlot === z && engine.abilityStapelArt(attachedInst) === eintrag.art) continue;
      const topCard = slot[slot.length - 1];
      // Performance sieht aus wie die Ability darunter — so zeigt es auch
      // die Auswahl (mehrere Performance uebereinander: die naechste
      // Nicht-Performance darunter).
      let ai = slot.length - 1;
      while (ai > 0 && slot[ai] === 'Performance') ai--;
      const shown = slot[ai];
      options.push({
        id: `${eintrag.art}-${z}`,
        label: `${shown} (Lv${slot.length})`,
        description: `Return ${shown} to its owner's hand.`,
        zoneIdx: z,
        art: eintrag.art,
        topCardName: topCard,
        color: '#cc8844',
      });
    }

    if (options.length === 0) return null;

    let selectedZoneIdx;
    let selectedArt = 'ability';
    if (options.length === 1) {
      // Auto-select if only one option
      selectedZoneIdx = options[0].zoneIdx;
      selectedArt = options[0].art;
    } else {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: 'Noble Mummy Guards',
        description: 'Choose an Ability to return to hand:',
        options,
        cancellable: false,
      });

      if (!choice || choice.cancelled) return null;
      const selected = options.find(o => o.id === choice.optionId);
      if (!selected) return null;
      selectedZoneIdx = selected.zoneIdx;
      selectedArt = selected.art;
    }

    const slot = (selectedArt === 'support' ? attachPs.supportZones : attachPs.abilityZones)?.[attachHeroIdx]?.[selectedZoneIdx];
    if (!slot || slot.length === 0) return null;
    const bouncedCardName = slot[slot.length - 1];

    // Find the card instance for the top ability
    const bouncedInst = engine.cardInstances.find(c =>
      c.owner === attachOwner && c.zone === (selectedArt === 'support' ? 'support' : 'ability') &&
      c.heroIdx === attachHeroIdx && c.zoneSlot === selectedZoneIdx &&
      c.name === bouncedCardName
    );

    // Leafagami Snake: die Ability bleibt liegen, ihr Kontrolleur zieht (der Rückwurf auf die Hand ist ein Entfernen).
    if (bouncedInst && await engine.abilityEntfernungVerhindert(bouncedInst, 'hand', { source: { name: 'Noble Mummy Guards', owner: pi } })) return null;

    // Fan animation on the ability zone
    engine._broadcastEvent('play_zone_animation', {
      type: 'fan_blow', owner: attachOwner,
      heroIdx: attachHeroIdx, zoneSlot: selectedZoneIdx,
      ...(selectedArt === 'support' ? {} : { zoneType: 'ability' }),
    });
    await engine._delay(500);

    // Remove top card from ability slot
    slot.pop();

    // Fire onCardLeaveZone hook
    if (bouncedInst) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: bouncedInst, card: bouncedInst, leavingCard: bouncedInst,
        fromZone: 'ability', fromHeroIdx: attachHeroIdx,
        _skipReactionCheck: true,
      });
      engine._untrackCard(bouncedInst.id);
    }

    // Return to original owner's hand
    const originalOwner = bouncedInst?.originalOwner ?? attachOwner;
    const returnPs = gs.players[originalOwner];
    if (returnPs) {
      engine.handZugangSync(returnPs, bouncedCardName, { von: 'brett', ohneInstanz: true });
    }

    const heroName = attachPs.heroes?.[attachHeroIdx]?.name || 'Hero';
    engine.log('ability_bounced', {
      card: bouncedCardName, hero: heroName,
      by: 'Noble Mummy Guards', player: gs.players[pi]?.username,
    });

    engine.sync();
    await engine._delay(125);

    return null;
  },

  // ── Support Zone creature effect: re-set into Surprise Zone ──
  activeIn: ['support'],
  creatureEffect: true,
  // PACMAN reset — see afflicted-vermin.js for rationale. Force-
  // commit because the MCTS rollout undervalues the move (no in-turn
  // impact, value lives on future turns).
  cpuMeta: { alwaysCommit: true },

  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
