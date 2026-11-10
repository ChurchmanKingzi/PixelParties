// ═══════════════════════════════════════════
//  CARD EFFECT: "Ferocious Tiger Kick"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  Stuns the target for 1 turn.
//
//  2nd Attack this turn: heal attacker for
//    the damage dealt = the ACTUAL HP loss of the target (Welle 13,
//    Q140: Overkill zaehlt nicht, wie bei Golden Arrow & Co.).
//  3rd Attack this turn: Stun bypasses the
//    Immune status (post-CC immunity).
//
//  Animation (Pixelart, public/app-fx-63.jsx): Der Held DASHT mit der Ramm-Figur BIS ZUM Ziel (`play_ram_animation`, `durch: false`, Standard-Nachbilder);
//  im Moment des Kontakts (Bild 0 der Zonen-Animation `tiger_kick`, Quelle = `von`) tritt er zu: Schlagstern, ein brüllender Tigerkopf über dem Ziel
//  (Maul voll auf bei Bild 2 = SCHADEN, Engine `_delay`), drei Krallenstreifen, danach kreisen drei Sterne um das Ziel (ab Bild 12 = Stun). 34 Bilder (30 Hz) ≈ 1,13 s.
//  Die Sterne ersetzen die alte Betäubungs-Optik `electric_strike` (kein Blitzbündel mehr obendrauf).
// ═══════════════════════════════════════════

// Zeiten (ms) der Zonen-Animation `tiger_kick` (app-fx-63.jsx, 30 Hz). `VORLAUF`: Mount-Vorlauf der Animation im Client (ZONE_ANIM_MOUNT_DELAY_MS 100 + Aufbau,
// gemessen im Spiel: Bild 0 ≈ 127 ms nach dem Ereignis) — die Engine-Wartezeiten sind Animationszeit + Vorlauf (wie bei Blow of the Venom Snake), damit die HP-Zahl im Maul-auf-Bild (2),
// die Betäubung beim Erscheinen der Sterne (12) und der Rest nach dem Ende (33) kommen.
const BILD_MS = 1000 / 30;
const VORLAUF_MS = 120;
const SCHADEN_MS = Math.round(2 * BILD_MS) + VORLAUF_MS;       // Bild 2 = Maul voll auf
const STUN_MS = Math.round(12 * BILD_MS) + VORLAUF_MS;         // Bild 12 = die Sterne erscheinen
const ENDE_MS = Math.round(33 * BILD_MS) + VORLAUF_MS;         // Bild 33 = leer

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
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1; // +1 for this attack
      const is2nd = attackNumber === 2;
      const is3rd = attackNumber === 3;

      let desc = `Deal ${baseAtk} base ATK damage and Stun.`;
      if (is2nd) desc += '\n🌟 2nd Attack: Heal for damage dealt!';
      if (is3rd) desc += '\n🌟 3rd Attack: Stun bypasses Immune!';

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Ferocious Tiger Kick',
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'stunned',
        description: desc,
        confirmLabel: `🐯 Tiger Kick! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === (ctx.cardHeroOwner ?? pi) && t.heroIdx === heroIdx),   // Als Befund 29.9.: Brettseite des Angreifers
      });

      if (!target) return; // Cancelled

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: 'Ferocious Tiger Kick', owner: pi, heroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi, usesHeroAtk: true };   // Als Befund 29.9.: Brettseite des Angreifers
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseAtk);

      // Ram animation: der Held rast BIS ZUM Ziel (`durch: false`), Standard-Nachbilder. Kontakt nach 12 % der Dauer (144 ms).
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200, durch: false,
      });

      // Tigertritt am Ziel: EIN Ereignis, sofort nach dem Ramm-Ereignis — der Mount-Vorlauf (~130 ms) entspricht dem Weg bis zum Kontakt (144 ms), Bild 0 = Kontakt.
      // `von`: der tretende Held (Brettseite).
      const impactZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      const _zoneT0 = Date.now();
      engine._broadcastEvent('play_zone_animation', {
        type: 'tiger_kick', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactZoneSlot,
        von: { owner: ctx.cardHeroOwner ?? pi, heroIdx, el: true },
      });
      await engine._delay(SCHADEN_MS);

      // Deal base ATK damage with type 'attack' (equipment hooks fire).
      // Capture cancellation so the stun + heal riders both skip when
      // the hit was fully negated (Idej Projection discard, Spectral
      // Armor zero-cap, Anti Magic void) — "negate that damage AND all
      // associated effects".
      let dealt = 0;
      let damageCancelled = false;

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const _hpVor = targetHero.hp;
          const result = await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
          // Welle 13 (Q140, Al: „Den tatsächlichen Verlust"): Overkill zählt nicht
          dealt = Math.min(result?.dealt || 0, Math.max(0, _hpVor - Math.max(0, targetHero.hp)));
          damageCancelled = !!result?.cancelled;
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          const _hpVor = engine.creatureCurrentHp(inst);   // Z5: unversehrte Kreatur hat noch kein currentHp
          const result = await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          // Q140: tatsächlicher Verlust, kein Overkill (gefallene Kreatur: auf die Vor-Treffer-HP gedeckelt)
          const _lebt = inst.zone === 'support' && engine.creatureCurrentHp(inst) > 0;
          dealt = Math.min(result?.dealt || 0, _hpVor, _lebt ? Math.max(0, _hpVor - engine.creatureCurrentHp(inst)) : Infinity);
          damageCancelled = !!result?.cancelled;
        }
      }

      if (damageCancelled) {
        engine.log('tiger_kick_rider_skipped', { reason: 'damage_cancelled' });
        engine.sync();
        return;
      }

      // 2nd Attack bonus: heal attacker for damage dealt
      if (is2nd && dealt > 0 && hero.hp > 0) {
        const healAmount = Math.min(dealt, hero.maxHp - hero.hp);
        if (healAmount > 0) {
          // ★ v1467: ueber `actionHealHero` statt direkt `hero.hp +=` — nur
          // so greifen Heilsperren (Mirjam, Curse of Aging), Heilumkehr
          // und die Heil-Hooks. Bild und Log nur, wenn wirklich geheilt.
          const vorher = hero.hp;
          await engine.actionHealHero(ctx.card, hero, healAmount);
          if (hero.hp > vorher) {
            engine._broadcastEvent('play_zone_animation', { type: 'heal_sparkle', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });
            engine.log('tiger_kick_heal', { hero: hero.name, amount: hero.hp - vorher });
          }
        }
      }

      // Betäubung erst, wenn die Sterne erscheinen (Bild 12) — die Sterne der Animation sind die Betäubungs-Optik (kein `electric_strike` mehr)
      await engine._delay(Math.max(0, STUN_MS - (Date.now() - _zoneT0)));

      // Apply Stun to target
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'stunned', {
            appliedBy: pi,
            bypassImmune: is3rd, // 3rd Attack: bypass Immune status
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          // Der Tritt samt Sternen läuft ohnehin unbedingt (auch bei Cardinal-immunen / geschützten Kreaturen, deren Stun-Zähler nicht greift).
          const applied = await engine.applyCreatureStatus(inst, 'stunned', {
            sourceOwner: ctx.cardOwner,
            source: 'Ferocious Tiger Kick',
          });
          if (applied) engine.log('stun', { target: inst.name, by: 'Ferocious Tiger Kick', type: 'creature' });
        }
      }

      // Rest der Animationszeit abwarten (Ende bei Bild 33 samt Rückfahrt des Dashs; Schaden-Verarbeitung zählt mit)
      await engine._delay(Math.max(0, ENDE_MS - (Date.now() - _zoneT0)));

      engine.log('tiger_kick', {
        player: ps.username, target: target.cardName,
        baseAtk, dealt, attackNumber, healed: is2nd, bypassedImmune: is3rd,
      });
      engine.sync();
    },
  },
};
