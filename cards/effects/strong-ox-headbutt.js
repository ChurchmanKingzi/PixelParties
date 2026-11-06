// ═══════════════════════════════════════════
//  CARD EFFECT: "Strong Ox Headbutt"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  Forces opponent to discard 1 card (2 if 2nd
//  Attack this turn). If 3rd Attack and target
//  is a Hero with Abilities, may remove one.
//
//  Animation: ram + 𖤍 + impact particles.
// ═══════════════════════════════════════════

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'explosion' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const oppIdx = engine.opponentOf(pi);
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const is2nd = attackNumber === 2;
      const is3rd = attackNumber === 3;

      let desc = `Deal ${baseAtk} base ATK damage. Opponent discards ${is2nd ? 2 : 1}.`;
      if (is3rd) desc += '\n🌟 3rd Attack: May remove an Ability from target!';

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Strong Ox Headbutt',
        description: desc,
        confirmLabel: `𖤍 Headbutt! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === (ctx.cardHeroOwner ?? pi) && t.heroIdx === heroIdx),   // Als Befund 29.9.: Brettseite des Angreifers
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: 'Strong Ox Headbutt', owner: pi, heroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi, usesHeroAtk: true };   // Als Befund 29.9.: Brettseite des Angreifers
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseAtk);

      // Ram animation
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200,
      });
      await engine._delay(150);

      // Impact
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', { type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      engine._broadcastEvent('play_zone_animation', { type: 'ox_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      await engine._delay(200);

      // Deal base ATK damage
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Wait for ram return
      await engine._delay(500);

      // Force opponent to discard (1 normally, 2 if 2nd Attack)
      const discardCount = is2nd ? 2 : 1;
      const oppPs = gs.players[oppIdx];
      if (oppPs && (oppPs.hand || []).length > 0) {
        await engine.actionPromptForceDiscard(oppIdx, discardCount, {
          title: 'Strong Ox Headbutt',
          source: 'Strong Ox Headbutt',
        });
      }

      // 3rd Attack bonus: remove an Ability from target Hero
      // „choose an Ability attached to the target and send it to the discard pile, if possible"
      // 24.10.2026: ALLE Abilities des Helden — die in den Ability Zonen und die Stapel in seinen Support Zonen (Xal, Xalibur). Abgeworfen wird ueber die
      // zentrale Engine-Primitive (`discardAbilityTopCopy`): sie nimmt die oberste Kopie, kennt Zonenart und Stapelhoehe, und „if possible" gilt wirklich
      // (Leafagami Snake schuetzt die Karte, Resistance faengt den Effekt auf den Helden ab).
      if (is3rd && target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const sammeln = () => engine.getAbilityTargets(tgtOwner, { heroIdx: tgtHeroIdx });
          const abilityTargets = sammeln().map(e => ({
            id: e.id, type: e.type, owner: e.owner, heroIdx: e.heroIdx, slotIdx: e.slotIdx,
            cardName: e.zoneKind === 'support' ? e.cardName : (gs.players[tgtOwner].abilityZones[tgtHeroIdx]?.[e.slotIdx] || []).slice(-1)[0] || e.cardName,   // oberste Kopie
            cardInstance: e.cardInstance || undefined,
          }));

          if (abilityTargets.length > 0) {
            // Ask player if they want to remove an ability
            const wantsRemove = await engine.promptGeneric(pi, {
              type: 'confirm',
              title: 'Strong Ox Headbutt',
              message: `Remove an Ability from ${targetHero.name}?`,
              confirmLabel: '⚒️ Yes, remove!',
              cancelLabel: 'No',
              cancellable: true,
              gerrymanderEligible: true, // True "you may" — opt-in ability removal.
            });

            if (wantsRemove) {
              // Highlight abilities and let player pick one
              const picked = await engine.promptEffectTarget(pi, abilityTargets, {
                maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
                title: 'Strong Ox Headbutt',
                description: `Select an Ability on ${targetHero.name} to remove.`,
                confirmLabel: '⚒️ Remove!',
                confirmClass: 'btn-danger',
                cancellable: true,
                exclusiveTypes: false,                       // Ability Zonen (`ability`) und Support Zonen (`equip`) in einer Wahl
                maxPerType: { ability: 1, equip: 1 },
              });

              if (picked && picked.length > 0) {
                // Nach der Abfrage neu einsammeln: das Brett kann sich bewegt haben, und die Primitive arbeitet auf Slot-Indizes.
                const eintrag = sammeln().find(e => e.id === picked[0]);
                if (eintrag) {
                  const abgeworfen = await engine.discardAbilityTopCopy(eintrag, { source: 'Strong Ox Headbutt', sourceOwner: pi, effectOnHero: true });
                  if (abgeworfen) engine.log('ability_removed', { card: eintrag.cardName, by: 'Strong Ox Headbutt', from: targetHero.name });
                }
              }
            }
          }
        }
      }

      engine.log('ox_headbutt', { player: ps.username, target: target.cardName, baseAtk, attackNumber });
      engine.sync();
    },
  },
};
