// ═══════════════════════════════════════════
//  CARD EFFECT: "Victory Phoenix Cannon"
//  Spell (Destruction Magic Lv3) — Deal 200
//  damage to any target (friend or foe).
//  Then, if the caster is still alive and
//  capable, may cast a Normal Lv1 or lower
//  Destruction Magic Spell from hand as an
//  additional Action. If they do, the caster
//  takes 200 recoil damage AFTER the bonus
//  spell (and all its effects, including
//  Bartas second-cast) fully resolves.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const fs = require('fs');
const path = require('path');
const { loadCardEffect } = require('./_loader');

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    projectile: { emoji: '🐦‍🔥', baseAngle: 180, duration: 520 },
    stagger: 110, flightMs: 330,
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero || ps.heroes?.[heroIdx];   // Als Befund 29.9.: Brettseite des Wirkers
      if (!hero?.name || hero.hp <= 0) return;

      // ── Phase 1: Deal 200 damage to any target ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: 200,
        title: 'Victory Phoenix Cannon',
        description: 'Deal 200 damage to any target.',
        confirmLabel: '💥 200 Damage!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      // Phoenix cannon projectile animation
      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Charge up at caster
      engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });
      await engine._delay(200);

      // Fire phoenix projectile. The bird emoji's natural orientation
      // faces LEFT on every major font/emoji set; `baseAngle: 180`
      // pre-rotates the visual so the beak ends up leading along the
      // src→tgt vector (which the renderer applies on top of the
      // base offset).
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '🐦‍🔥', duration: 500,
        baseAngle: 180,
      });
      await engine._delay(400);

      // Impact explosion on target
      engine._broadcastEvent('play_zone_animation', { type: 'flame_engulf', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot !== undefined ? tgtZoneSlot : -1 });
      await engine._delay(200);

      // Deal 200 damage
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner].heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, 200, 'destruction_spell');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Victory Phoenix Cannon', owner: pi, heroIdx, heroOwner: ctx.cardHeroOwner ?? pi },   // Als Befund 29.9.: Brettseite des Wirkers
            inst, 200, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true }
          );
        }
      }

      engine.sync();
      await engine._delay(400);

      // ── Phase 2: Bonus spell cast ──
      // Check hero is still alive and capable
      if (hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Find eligible spells in hand: Normal Destruction Magic, level ≤ 1
      // v323: NICHT je Auslösung von der Platte lesen — 0,83 MB Datei,
      // mehrere MB Müll je Hook-Auslösung, dazu synchrone E/A im Event-Loop.
      const cardDB = require('./_card-db').getCardDB();

      const eligibleSpells = [];
      const seen = new Set();
      for (let i = 0; i < (ps.hand || []).length; i++) {
        const cardName = ps.hand[i];
        if (seen.has(cardName)) continue;
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Spell')) continue;
        if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
        if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
        // Effective level (Mana Absorbing Crystal's +1 / future
        // hand-active reducers / per-slot offsets).
        const lvl = engine.effectiveCardLevel(cd, pi, { handIdx: i });
        if (lvl > 1) continue;
        // ★ v1446 (Befund: VPC bot den Folgezauber nur bei echter
        // Destruction Magic an). Die Spielbarkeit ist dieselbe wie beim
        // Spielen von der Hand: `heroMeetsLevelReq` — Divinity, Wisdom,
        // brettweite Senkungen, Helden-Bypaesse. Zusaetzlich bleibt der
        // Caster-Weg: wird VPC selbst ueber einen „as if school N"-Geber
        // gewirkt (Demon's Gate setzt `gs._castSchoolOverride` fuer die
        // Dauer von VPCs onPlay), gilt dieselbe erhoehte Stufe.
        const perOverride = (!cd.spellSchool1
            || engine.effectiveSchoolLevelForCaster(cd.spellSchool1, pi, heroIdx) >= lvl)
          && (!cd.spellSchool2
            || engine.effectiveSchoolLevelForCaster(cd.spellSchool2, pi, heroIdx) >= lvl);
        // Als Befund 29.9.: Stufen/Wisdom aus der Spalte des (geliehenen) Wirkers.
        const _hs = ctx.cardHeroOwner ?? pi;
        if (!perOverride && !engine.heroMeetsLevelReq(_hs, heroIdx, cd, _hs !== pi ? { handIdx: i, levelSourcePi: pi } : { handIdx: i })) continue;
        // Wisdom-Bezahlbarkeit wie in den anderen Zusatzaktions-Prompts:
        // reicht die Hand (ohne den Zauber selbst) nicht, faellt er weg.
        if (!perOverride) {
          const wisdomCost = engine.getWisdomDiscardCost(_hs, heroIdx, cd);
          if (wisdomCost > 0 && engine.handFodderFor(pi, cardName) < wisdomCost
              && !engine.discardCostWaived(pi)) continue;
        }
        seen.add(cardName);
        eligibleSpells.push({ name: cardName, source: 'hand' });
      }

      if (eligibleSpells.length === 0) return;

      // Prompt: "Cast another Spell with [Hero Name] (200 recoil)?"
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Victory Phoenix Cannon',
        message: `Cast another Spell with ${hero.name} (200 recoil)?`,
      });
      if (!confirmed) return;

      // Player picks a spell from hand
      const selected = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: eligibleSpells,
        title: 'Victory Phoenix Cannon',
        description: 'Choose a Normal Lv1 or lower Destruction Magic Spell to cast.',
        cancellable: true,
      });
      if (!selected || !selected.cardName) return;

      const bonusSpellName = selected.cardName;
      const bonusScript = loadCardEffect(bonusSpellName);
      if (!bonusScript?.hooks?.onPlay) return;

      // ★★ v1364 (Als Befund: VPC + Phoenix Tackle loeste Madame Guillotine
      // nur EINMAL aus). Der Folgezauber lief bisher ueber einen eigenen
      // Nachbau (Hand-Splice, eigenes onPlay, eigenes Ablegen) — ohne
      // Aktionsmeldung, ohne Flug, ohne gemeinsame Guss-Bruecke. Jetzt ueber
      // `_castSpellImmediately` mit `alsZusatzaktion`: Auftritt, Flug in die
      // Ablage, afterSpellResolved und die Meldung als ausgefuehrte Aktion
      // (Madame, Bleeding …) kommen von dort.
      const handIdx = ps.hand.indexOf(bonusSpellName);
      if (handIdx < 0) return;
      const bonusRes = await engine._castSpellImmediately(pi, heroIdx, bonusSpellName, {
        fromZone: 'hand', pool: ps.hand, poolIndex: handIdx,
        by: 'Victory Phoenix Cannon', alsZusatzaktion: true, heroOwner: ctx.cardHeroOwner ?? pi,   // Als Befund 29.9.: Brettseite des Wirkers
      });
      if (!bonusRes || bonusRes.cancelled) return;   // abgebrochen → kein Rueckstoss

      engine.sync();
      await engine._delay(300);

      // ── Phase 3: 200 recoil AFTER everything resolves ──
      if (hero.hp > 0) {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });
        await engine._delay(200);
        // `festesZiel`: Rueckstoss trifft immer den Wirker (s. Phoenix Tackle).
        await ctx.dealDamage(hero, 200, 'other', { festesZiel: true });
        engine.log('recoil', { hero: hero.name, amount: 200, by: 'Victory Phoenix Cannon' });
        engine.sync();
      }
    },
  },
};
