// ═══════════════════════════════════════════
//  CARD EFFECT: "Blow of the Venom Snake"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  If the target is NOT already Poisoned,
//  inflict Poison (1 stack, 2 if 2nd Attack,
//  3 if 3rd Attack this turn).
//
//  Animation (Pixelart, public/app-fx-61.jsx): Der Held DASHT mit der Ramm-Figur BIS ZUM Ziel (`play_ram_animation`, `durch: false`,
//  `trailType: 'poison'` = giftgrüne Nachbilder nur auf dem Hinweg); im Moment des Kontakts (Bild 0 der Zonen-Animation) stoßen zwei
//  Finger-Zähne ins Ziel, ein kleiner Schlangenkopf schnappt bei Bild 5 zu (= SCHADEN) und Gift-Adern kriechen über das Ziel
//  (`venom_strike`, Stufe = `stacks` 1–3, Quelle = `von`). 37 Bilder (30 Hz) ≈ 1,23 s; der Poison-Rider (`poison_splash`) folgt erst danach.
// ═══════════════════════════════════════════

// Zeiten (ms) der Zonen-Animation `venom_strike` (app-fx-61.jsx, 30 Hz). `VORLAUF`: Mount-Vorlauf der Animation im Client (ZONE_ANIM_MOUNT_DELAY_MS 100 + Aufbau,
// gemessen im Spiel) — die Engine-Wartezeiten sind Animationszeit + Vorlauf (wie `vorlauf` bei Flame Avalanche), damit HP-Zahl im Biss-Bild (5) und der Rider nach dem Ende (36) kommen.
const BILD_MS = 1000 / 30;
const VORLAUF_MS = 120;
const SCHADEN_MS = Math.round(5 * BILD_MS) + VORLAUF_MS;       // Bild 5 = Zuschnappen
const ENDE_MS = Math.round(36 * BILD_MS) + VORLAUF_MS;         // Bild 36 = leer

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
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const poisonStacks = attackNumber >= 3 ? 3 : attackNumber >= 2 ? 2 : 1;

      let desc = `Deal ${baseAtk} base ATK damage. Poison target (${poisonStacks} stack${poisonStacks > 1 ? 's' : ''} = ${poisonStacks * 30} dmg/turn).`;

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Blow of the Venom Snake',
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'poisoned',
        description: desc,
        confirmLabel: `🐍 Strike! (${baseAtk})`,
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
      const attackSource = { name: 'Blow of the Venom Snake', owner: pi, heroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi, usesHeroAtk: true };   // Als Befund 29.9.: Brettseite des Angreifers
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseAtk);

      // Ram animation: der Held rast BIS ZUM Ziel (`durch: false`), giftgrüne Nachbilder nur auf dem Hinweg. Kontakt nach 12 % der Dauer (144 ms, `rammeBisKontakt`-Anteil).
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200, durch: false, trailType: 'poison',
      });

      // Giftstoß am Ziel: EIN Ereignis, sofort nach dem Ramm-Ereignis — der Mount-Vorlauf (~150 ms) entspricht dem Weg bis zum Kontakt (144 ms), Bild 0 = Kontakt.
      // `von`: der angreifende Held (Brettseite), `stacks`: 1./2./3. Angriff der Runde = Stufe 1–3.
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      const _zoneT0 = Date.now();
      engine._broadcastEvent('play_zone_animation', {
        type: 'venom_strike', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
        von: { owner: ctx.cardHeroOwner ?? pi, heroIdx, el: true },
        stacks: poisonStacks,
      });
      await engine._delay(SCHADEN_MS);

      // Deal base ATK damage. Capture cancellation so the poison
      // rider below skips when the hit was fully negated (Idej
      // Projection discard, Spectral Armor zero-cap, Anti Magic
      // magic_immune void, Spider Silk Bridge redirect-to-nowhere,
      // etc.). The "and all associated effects" clause on full-
      // negation reactions covers riders attached to the same Attack.
      let damageCancelled = false;
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const r = await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
          damageCancelled = !!r?.cancelled;
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          const r = await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          damageCancelled = !!r?.cancelled;
        }
      }

      // Poison-Rider erst nach dem Ende der Zonen-Animation (Bild 36): Rest der Animationszeit abwarten (Schaden-Verarbeitung zählt mit).
      await engine._delay(Math.max(0, ENDE_MS - (Date.now() - _zoneT0)));

      // Skip the poison rider when the damage was fully negated by a
      // reaction — "negate that damage AND all associated effects".
      if (damageCancelled) {
        engine.log('venom_snake_rider_skipped', { reason: 'damage_cancelled' });
        engine.sync();
        return;
      }

      // Poison the target if not already Poisoned
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0 && !targetHero.statuses?.poisoned) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
            appliedBy: pi,
            stacks: poisonStacks,
            animationType: 'poison_splash',
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && !inst.counters.poisoned) {
          // Animation plays unconditionally — visible splash on
          // Cardinal-immune / shielded targets even when the status
          // application fizzles in the gate below.
          engine._broadcastEvent('play_zone_animation', {
            type: 'poison_splash', owner: tgtOwner,
            heroIdx: tgtHeroIdx, zoneSlot: target.slotIdx,
          });
          const applied = await engine.applyCreatureStatus(inst, 'poisoned', {
            stacks: poisonStacks,
            sourceOwner: pi,
            source: 'Blow of the Venom Snake',
          });
          if (applied) engine.log('poison_applied', { target: inst.name, by: 'Blow of the Venom Snake', stacks: poisonStacks });
        }
      }

      engine.log('venom_snake', { player: ps.username, target: target.cardName, baseAtk, attackNumber, poisonStacks });
      engine.sync();
    },
  },
};
