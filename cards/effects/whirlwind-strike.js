// ═══════════════════════════════════════════
//  CARD EFFECT: "Whirlwind Strike"
//  Attack (Fighting Lv3, Normal)
//  Choose up to 2 opponent Heroes. Deal ATK
//  damage to those Heroes AND all Creatures
//  in their Support Zones.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // Negiert (Frost Rune …): der ANGREIFER wirbelt los, nicht die Ziele.
  async spellVisual(engine, info) {
    if (info.schonGezeigt?.zone?.has('whirlwind_spin')) return;   // der Effekt hat sein Bild schon gespielt
    engine._broadcastEvent('play_zone_animation', {
      type: 'whirlwind_spin', owner: info.heroOwner ?? info.owner, heroIdx: info.heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const oppIdx = pi === 0 ? 1 : 0;
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const atkDamage = hero.atk || 0;

      // Use generic targeting: up to 2 enemy heroes.
      // `_skipPostTargetReactions: true` because we run the
      // consolidated post-target window manually below with the FULL
      // target list (selected heroes + their Creatures). Letting
      // `promptMultiTarget` fire its own window with hero-only targets
      // would lock the per-source dedup flag before the Creature batch
      // is offered, hiding eligible reactions like Sculpture Guards on
      // a Frozen Creature in a hit hero's support zone.
      const selectedHeroes = await ctx.promptMultiTarget({
        types: ['hero'],
        side: 'enemy',
        max: 2,
        baseDamage: atkDamage,
        title: 'Whirlwind Strike',
        description: `Deal ${atkDamage} damage to up to 2 Heroes and all their Creatures.`,
        confirmLabel: `🌪️ Whirlwind! (${atkDamage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        _skipPostTargetReactions: true,
        // Die Helden werden NACHEINANDER getroffen (wie Chain Lightning): das Surprise-Fenster
        // (Frost Rune, Booby Trap …) öffnet erst, wenn der jeweilige Held an der Reihe ist.
        _skipSurpriseCheck: true,
      });

      if (selectedHeroes.length === 0) return;

      // Toras (and any hero with singleTargetAttack) restricts Attacks to 1 target total.
      // The engine already capped hero selection to 1, but Whirlwind's secondary creature
      // hits count as additional targets — skip them when the restriction is active.
      const heroFlag = gs.heroFlags?.[`${ctx.cardHeroOwner ?? pi}-${heroIdx}`];   // Als Befund 29.9.: Brettseite des Angreifers
      const singleTargetOnly = !!heroFlag?.singleTargetAttack;

      const attackSource = { name: 'Whirlwind Strike', owner: pi, heroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi, usesHeroAtk: true };   // Als Befund 29.9.: Brettseite des Angreifers

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) — fires AFTER multi-target pick but BEFORE
      // the spin-up animation, projectile, and damage. The whole
      // targets array is passed as `target` so listeners that need
      // to inspect specific picks can defensively handle the array
      // shape; single-card listeners that only care about the bonus
      // amount can ignore it.
      const finalAtk = await engine._fireAttackDeclare(attackSource, selectedHeroes, atkDamage);

      // ── ANIMATION: spin up on attacker ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'whirlwind_spin', owner: ctx.cardHeroOwner ?? pi, heroIdx, zoneSlot: -1,   // Als Befund 29.9.: Brettseite des Angreifers
      });
      await engine._delay(400);

      const cardDB = engine._getCardDB();

      // ── Collect ALL damage targets first, then process ──
      const heroDamageTargets = [];
      const allCreatureEntries = [];

      for (const tgt of selectedHeroes) {
        const tgtHero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          heroDamageTargets.push({ hero: tgtHero, tgt });
        }

        // Find Creatures in this hero's support zone via cardInstances
        // Skipped when singleTargetAttack is active — only the hero itself is hit.
        if (!singleTargetOnly) {
          for (const inst of engine.cardInstances) {
            if (inst.owner !== tgt.owner) continue;
            if (inst.zone !== 'support') continue;
            if (inst.heroIdx !== tgt.heroIdx) continue;
            // Check cardType from DB
            const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
            if (!cd || !hasCardType(cd, 'Creature')) continue;
            allCreatureEntries.push({
              inst, amount: finalAtk, type: 'attack',
              source: attackSource, sourceOwner: pi,
              canBeNegated: true,
              tgtHeroIdx: tgt.heroIdx,
            });
          }
        }
      }

      // Pre-damage post-target hand-reaction window — ONE consolidated
      // prompt per source covering selected Heroes + all Creatures
      // they're hitting. Built BEFORE damage flows so reactions
      // (Sculpture Guards / Spectral Armor / Bamboo Shield / Homerun!
      // / Cloud in a Bottle / Invisibility Cloak) see the full target
      // list and can choose between hero or creature protection.
      {
        const allTgts = [
          ...heroDamageTargets.map(({ tgt, hero: tgtHero }) => ({
            type: 'hero', owner: tgt.owner, heroIdx: tgt.heroIdx,
            cardName: tgtHero.name,
          })),
          ...allCreatureEntries.map(e => ({
            type: 'creature',
            owner: e.inst.controller ?? e.inst.owner,
            heroIdx: e.inst.heroIdx, slotIdx: e.inst.zoneSlot,
            cardName: e.inst.name,
          })),
        ];
        const _negR = await engine.preDamageMultiTargetWindow(attackSource, allTgts);
        if (_negR?.effectNegated) return;
      }

      // ★ v1042 („Interference"): EIN Schlag, mehrere Ziele — Helden UND
      // ihre Kreaturen. Die Klammer macht das fuer den Schadensweg
      // sichtbar; ohne sie waere Whirlwind fuer „Interference" ein
      // Haufen Einzeltreffer gewesen.
      // ★ v1392: sanktionierte Nacheinander-Form (`beginAoeStrike`) statt
      // roher Klammer — öffnet auch das Idol-Fenster für die Kreaturen.
      await engine.beginAoeStrike(heroDamageTargets.length + allCreatureEntries.length, {
        creatures: allCreatureEntries, source: attackSource, type: 'attack', sourceOwner: ctx.cardOwner,
      });
      try {
      // ── NACHEINANDER: je Held erst er selbst (Surprise-Fenster an GENAU diesem Treffer), dann ──
      // ── alle Kreaturen in seinen Support Zones. Negiert ein Surprise (Frost Rune …) den Angriff, ──
      // ── endet er sofort: spätere Helden werden nie angezielt. ──
      let abgebrochen = false;
      for (let ti = 0; ti < heroDamageTargets.length && !abgebrochen; ti++) {
        const { hero: tgtHero, tgt } = heroDamageTargets[ti];
        if (ti > 0 && (gs._spellNegatedByEffect || engine._isEffectSourceNegated?.(attackSource))) break;

        // Fast ram
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
          targetOwner: tgt.owner, targetHeroIdx: tgt.heroIdx,
          cardName: hero.name, duration: 800,
        });
        await engine._delay(100);

        // Deal damage to the hero (öffnet das Surprise-Fenster dieses Helden)
        if (tgtHero.hp > 0) {
          // Explosion nur, wenn der Treffer nicht abgefangen wird — sie liegt hinter dem Fenster
          const vorherHp = tgtHero.hp;
          const r = await engine.actionDealDamage(attackSource, tgtHero, finalAtk, 'attack');
          if (r?.surpriseNegated || r?.effectNegated) { abgebrochen = true; break; }
          if (tgtHero.hp < vorherHp || !r?.cancelled) {
            engine._broadcastEvent('play_zone_animation', {
              type: 'explosion', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: -1,
            });
          }
        }

        // Creatures in this hero's support zones (one batch per hero)
        const seine = allCreatureEntries.filter(e => e.tgtHeroIdx === tgt.heroIdx && e.inst.owner === tgt.owner && e.inst.zone === 'support');
        if (seine.length > 0) {
          for (const e of seine) {
            engine._broadcastEvent('play_zone_animation', {
              type: 'explosion', owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot,
            });
          }
          await engine.processCreatureDamageBatch(seine);
        }

        // Brief pause before second target
        if (ti < heroDamageTargets.length - 1) {
          await engine._delay(200);
        }
      }
      } finally {
        await engine.endMultiHit();
      }

      // Wait for ram return + spin down
      await engine._delay(500);

      engine.log('whirlwind_strike', {
        player: ps.username,
        targets: selectedHeroes.map(t => t.cardName),
        atkDamage: finalAtk,
        heroCount: heroDamageTargets.length,
        creatureCount: allCreatureEntries.length,
      });
      engine.sync();
    },
  },
};
