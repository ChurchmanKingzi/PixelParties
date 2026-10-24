// ═══════════════════════════════════════════
//  CARD EFFECT: "Muscle Training"
//  Attack (Fighting Lv0, Normal)
//
//  Play condition (beyond spell school):
//  - At least 1 "Fighting" in the caster's deck
//  - Caster can receive Fighting (free ability
//    zone OR Fighting slot below Lv3)
//
//  Effect:
//  Search deck for a copy of Fighting and attach
//  it to the casting hero. Does NOT consume the
//  hero's per-turn ability attachment.
//
//  Inherent Action condition:
//  If the hero has at least 1 Equipment Artifact
//  in its Support Zones AND this specific hero has
//  not used an Attack yet this turn → card is an
//  inherent additional Action (free during Main
//  Phase, doesn't end Action Phase).
//
//  Animation: dumbbell pumps up and down twice.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Check if a specific hero can receive Fighting
 * (has a free ability zone OR an existing Fighting slot < Lv3).
 */
function heroCanAcceptFighting(ps, heroIdx, engine, side) {
  // M02-02: dieselbe Zonenwahl wie beim Anhängen (`abilityZielZone`) — sonst wird die Karte
  // bei vollem Fighting-Stapel (Lv3) plus freier Zone angeboten, aus dem Deck genommen und geht verloren.
  if (engine && side != null) return engine.abilityZielOrt(side, heroIdx, 'Fighting') != null;   // 24.10.: auch Support Zonen (Xal)
  const abZones = ps.abilityZones[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length === 0) return true;
    if (slot[0] === 'Fighting' && slot.length < 3) return true;
  }
  return false;
}

/**
 * Check if a hero has at least 1 Equipment Artifact in its Support Zones.
 */
function heroHasEquipment(ps, heroIdx, cardDB, engine) {
  for (let si = 0; si < (ps.supportZones[heroIdx] || []).length; si++) {
    const slot = (ps.supportZones[heroIdx] || [])[si] || [];
    if (slot.length === 0) continue;
    if (engine) {
      // Use centralized equip detection (handles treatAsEquip, Hero-in-support, etc.)
      const inst = engine.cardInstances.find(c => c.owner !== undefined && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === si);
      if (engine.isEquipInZone(slot[0], inst)) return true;
    } else {
      const cd = cardDB[slot[0]];
      if (cd && (cd.subtype || '').toLowerCase() === 'equipment') return true;
    }
  }
  return false;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'dumbbell_pump' }, impactMs: 260 },

  /**
   * Global play condition:
   * - At least 1 "Fighting" in the deck
   * - At least one alive hero can accept Fighting
   *   (free ability zone or existing Fighting < Lv3)
   */
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!(ps.mainDeck || []).includes('Fighting')) return false;

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

      if (heroCanAcceptFighting(ps, hi, engine, pi)) return true;
    }
    return false;
  },

  /**
   * Inherent Action:
   * Free play (Main Phase without additional action,
   * Action Phase without ending it) when:
   * 1. Hero has at least 1 Equipment Artifact
   * 2. THIS specific hero has not used an Attack yet this turn
   */
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    if ((ps.heroesAttackedThisTurn || []).includes(heroIdx)) return false;

    const cardDB = engine._getCardDB();
    return heroHasEquipment(ps, heroIdx, cardDB, engine);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hs = ctx.cardHeroOwner ?? pi;                  // Als Befund 29.9.: Brettseite des Nutzers
      const hps = gs.players[hs] || ps;                     // Zonen des Nutzers; Deck bleibt beim Kontrolleur
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      // ── Validate per-hero conditions ──
      if (!heroCanAcceptFighting(hps, heroIdx, engine, hs)) {   // Als Befund 29.9.: Brettseite des Wirkers
        gs._spellCancelled = true;
        return;
      }

      const deckIdx = (ps.mainDeck || []).indexOf('Fighting');
      if (deckIdx < 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Play dumbbell pump animation ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'dumbbell_pump', owner: hs, heroIdx, zoneSlot: -1,   // Als Befund 29.9.: Brettseite des Wirkers
      });
      await engine._delay(1600);

      // ★ W15a (Al, R3: „Ja" — Muscle Training prallt an Resistance ab): Anlegen PER EFFEKT auf den Nutzer — nach der Animation, vor jeder Kartenbewegung
      // (Fighting bleibt im Deck, kein Mischen; der Angriff ist gespielt).
      if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, hs, heroIdx, 'Muscle Training')) {
        engine.log('muscle_training_blocked', { player: ps.username, hero: hero.name });
        engine.sync();
        return;
      }

      // ── Remove Fighting from deck ──
      if (!(await engine.takeFromPile(ps, 'deck', deckIdx, { source: 'Muscle Training' }))) return;   // v820: Stapel-Schicht

      // ── Find target zone (24.10.: echte Ability Zone ODER Support Zone — Xal; hoechstens EIN Fighting-Stapel) ──
      // v1349: Zonenwahl an EINER Stelle (verwahrte Abilities, Madame Guillotine).
      const ort = engine.abilityZielOrt(hs, heroIdx, 'Fighting');   // Als Befund 29.9.: Brettseite des Wirkers

      if (!ort) return; // Shouldn't happen (spellPlayCondition guards this)

      // ── Attach Fighting + track card instance ──
      // Does NOT consume abilityGivenThisTurn (additional attachment)
      const inst = engine.abilityOrtBelegen(hs, heroIdx, 'Fighting', ort);   // Als Befund 29.9.: Brettseite des Wirkers
      engine._broadcastEvent('deck_search_add', { cardName: 'Fighting', playerIdx: pi });
      engine.log('deck_search', { player: ps.username, card: 'Fighting', by: 'Muscle Training' });

      // Fire Fighting's onPlay hook (grants ATK bonus) + zone enter hook (triggers Creativity, etc.)
      await engine.abilityOrtHooks(inst, ort, { _skipReactionCheck: true });

      // Flash the target zone
      engine._broadcastEvent('ability_activated', {
        owner: hs, heroIdx, zoneIdx: ort.slot, zoneKind: ort.art, abilityName: 'Fighting',   // Als Befund 29.9.: Brettseite des Wirkers
      });

      engine.log('muscle_training', {
        player: ps.username, hero: hero.name,
        fightingLevel: engine.abilityStapelVon(inst).length,
      });

      engine.sync();
    },
  },
};
