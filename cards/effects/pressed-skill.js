// ═══════════════════════════════════════════
//  CARD EFFECT: "Pressed Skill"
//  Potion (Normal) — no Cost, no board target.
//
//  "Choose an Ability from your deck, hand or discard pile and attach
//   it to a Hero you control as an additional attachment."
//
//  ── Wiring ──────────────────────────────────────────────────────
//  Pure resolve-driven Potion (no `isTargetingArtifact` — the picks
//  are a card gallery + an `abilityAttachTarget` prompt, like
//  Sacrifice to Divinity, not a board-target click). Returning
//  `{ cancelled: true }` before anything is pulled keeps the Potion
//  in hand (server's `resolveResult.cancelled` contract); a truthy
//  return consumes it (Potions delete after use).
//
//  "as an additional attachment" → the attach must NOT consume the
//  Hero's once-per-turn ability-attach slot. We reuse the engine's
//  canonical `attachAbilityFromHand(... { skipAbilityGivenCheck:
//  true })`, which is customPlacement-aware (Performance etc.),
//  fires onPlay / onCardEnterZone, tracks the instance and syncs —
//  so the only thing this card hand-rolls is moving the chosen
//  Ability into hand from deck / discard first.
//
//  ── Welle 13/14: wer ist „a Hero you control"? ──────────────────
//  Nach aktueller Kontrolle (Q147): `heroesControlledBy`. Welle 14 (Al, Q9):
//  „Die Regel lautet, dass nur ein permanent kontrollierter Held normal von der
//  Hand als Standard-Spielaktion eine Ability bekommen kann - aber Attachments
//  per Effekt können alle eigenen Heroes betreffen." → Pressed Skill ist ein
//  EFFEKT: auch ein nur gecharmter Held steht zur Wahl (`byEffect: true` an
//  `canAttachAbilityToHero`, das Recht `abilities` entfällt); ausgenommen bleibt
//  ein Held ganz ohne Rechte (Charme Lv3: „unaffected"). Resistance blockt das
//  Anlegen PER EFFEKT (Q5, auch beim eigenen Helden): die Potion ist dann
//  verbraucht, die Ability bleibt, wo sie war.
//
//  Restricted Abilities (Divinity — `restrictedAttachment`) are NOT
//  selectable: this is a generic attach effect and passes no
//  `allowRestricted`, so `canAttachAbilityToHero` /
//  `attachAbilityFromHand` refuse them and they're filtered out of
//  the gallery (zero eligible Heroes). Same rule generic tutors
//  (Alex, Cute Starlet Megu) follow.
// ═══════════════════════════════════════════

const CARD_NAME = 'Pressed Skill';
const PILES = ['hand', 'deck', 'discard'];

/** Pile array for a given source key. */
function pileArr(ps, source) {
  if (source === 'hand') return ps.hand || [];
  if (source === 'deck') return ps.mainDeck || [];
  if (source === 'discard') return ps.discardPile || [];
  return [];
}

/**
 * Living Heroes `pi` CONTROLS that can receive `abilityName` as an attachment.
 * Welle 13 (Q147, Al: „Ja, nach aktueller Kontrolle"): „a Hero you control" =
 * `heroesControlledBy` — ein vom Gegner gecharmter eigener Held steht NICHT zur
 * Wahl, ein von mir gecharmter Gegnerheld schon (wenn die Uebernahme Abilities
 * erlaubt, `kontrollRechte`; die Karte landet auf seiner Brettseite `phys`).
 * @returns {Array<{phys:number, heroIdx:number}>}
 */
function eligibleHeroes(engine, pi, abilityName) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0) continue;
    // No `allowRestricted` — restricted Abilities (Divinity) are
    // refused here, which naturally drops them from the gallery.
    const opts = physOwner !== pi ? { heroOwner: physOwner, byEffect: true } : undefined;   // W14 (Q9): Anlegen per Effekt – Kontrolle genügt
    if (engine.canAttachAbilityToHero(pi, abilityName, heroIdx, opts)) out.push({ phys: physOwner, heroIdx });
  }
  return out;
}

/**
 * Deduplicated gallery of attachable Abilities across hand / deck /
 * discard, one entry per (name, source) with a copy count. Only
 * Abilities with at least one eligible Hero are listed.
 */
function buildGallery(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const entries = [];
  for (const source of PILES) {
    const counts = {};
    for (const name of pileArr(ps, source)) {
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Ability') continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    for (const name of Object.keys(counts)) {
      if (eligibleHeroes(engine, pi, name).length === 0) continue;
      entries.push({ name, source, count: counts[name] });
    }
  }
  return entries.sort((a, b) =>
    a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

module.exports = {
  // v826: NICHT "nur Stapel-Bewegung" (auch aus der HAND spielbar); die Auto-Erkennung
  // des Loaders wuerde sonst unter Knight of Kings [B] die ganze Karte sperren.
  blockedByPileLock: false,
  isPotion: true,
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    // Authoritative gate runs with the engine (server's doUsePotion
    // always passes it). Optimistic when engine is absent (CPU
    // pre-filter / rare paths) — consistent with other potions that
    // need the engine for their real viability check.
    if (!engine) return true;
    return buildGallery(engine, pi).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const gallery = buildGallery(engine, pi);
    if (gallery.length === 0) return { cancelled: true };

    // ── Step 1: pick an Ability (name + source) ──
    const choice = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose an Ability from your deck, hand or discard pile to attach to one of your Heroes as an additional attachment.',
      confirmLabel: '🔧 Attach',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.cardName) return { cancelled: true };

    const abilityName = choice.cardName;
    // Trust-but-verify the source: a card name can sit in multiple
    // piles; honour the one the player picked, else fall back to the
    // first pile that actually holds it.
    let source = choice.source;
    if (!source || pileArr(ps, source).indexOf(abilityName) < 0) {
      source = PILES.find(s => pileArr(ps, s).indexOf(abilityName) >= 0) || null;
    }
    if (!source) return { cancelled: true };

    // ── Step 2: pick the Hero ──
    const helden = eligibleHeroes(engine, pi, abilityName);
    if (helden.length === 0) return { cancelled: true };

    let ziel = null;           // { phys, heroIdx }
    let explicitZone = -1;
    let explicitSupport = -1;
    if (helden.length === 1) {
      ziel = helden[0];
    } else if (helden.every(h => h.phys === pi)) {
      const pickRes = await engine.promptGeneric(pi, {
        type: 'abilityAttachTarget',
        cardName: abilityName,
        eligibleHeroIdxs: helden.map(h => h.heroIdx),
        // Additional attachment — bypass the client's once-per-turn
        // ability-attach highlight gate (mirrors Sacrifice to Divinity).
        skipAbilityGiven: true,
        title: CARD_NAME,
        description: `Attach "${abilityName}" to one of your Heroes as an additional attachment.`,
        cancellable: true,
      });
      if (!pickRes || pickRes.cancelled) return { cancelled: true };
      const hi = typeof pickRes.heroIdx === 'number' ? pickRes.heroIdx : helden[0].heroIdx;
      ziel = helden.find(h => h.heroIdx === hi) || helden[0];
      explicitZone = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
      explicitSupport = typeof pickRes.supportSlot === 'number' ? pickRes.supportSlot : -1;
    } else {
      // Mit geliehenem Helden unter den Zielen: Heldenwahl ueber Brett-Klick (die
      // Anlege-Maske `abilityAttachTarget` kennt nur die eigene Heldenreihe).
      const ids = await engine.promptEffectTarget(pi, helden.map(h => ({
        id: `hero-${h.phys}-${h.heroIdx}`, type: 'hero', owner: h.phys, heroIdx: h.heroIdx,
        cardName: engine.gs.players[h.phys]?.heroes?.[h.heroIdx]?.name || '',
      })), {
        title: CARD_NAME, source: CARD_NAME,
        description: `Attach "${abilityName}" to one of your Heroes as an additional attachment.`,
        confirmLabel: '🔧 Attach', confirmClass: 'btn-info',
        maxTotal: 1, cancellable: true, greenSelect: true,
        previewCardName: abilityName,
      });
      if (!Array.isArray(ids) || ids.length === 0) return { cancelled: true };
      ziel = helden.find(h => `hero-${h.phys}-${h.heroIdx}` === ids[0]);
      if (!ziel) return { cancelled: true };
    }
    const targetHeroIdx = ziel.heroIdx;
    const zielSeite = ziel.phys;
    const seitenOpt = zielSeite !== pi ? { heroOwner: zielSeite, byEffect: true } : undefined;

    // Re-verify (state may have shifted across the async prompts).
    if (!engine.canAttachAbilityToHero(pi, abilityName, targetHeroIdx, seitenOpt)) {
      return { cancelled: true };
    }

    // ★ Welle 14 (Al, Q5): Resistance fängt das Anlegen per Effekt ab — VOR jeder Kartenbewegung (die Ability bleibt in Deck/Hand/Ablage).
    // Die Potion ist gespielt und verbraucht; die Animation läuft wie immer („Immunitäten blocken Effekte, nie Animationen").
    if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, zielSeite, targetHeroIdx, CARD_NAME)) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'pressed_skill_rain', owner: zielSeite, heroIdx: targetHeroIdx, zoneSlot: -1, duration: 1700,
      });
      engine.log('pressed_skill_blocked', { player: ps.username, ability: abilityName, hero: engine.gs.players[zielSeite]?.heroes?.[targetHeroIdx]?.name });
      engine.sync();
      return true;
    }

    // ── Step 3: route the chosen Ability into hand so the canonical
    //    customPlacement-aware attach helper can place it. ──
    if (source === 'deck') {
      const _taken_idx = await engine.takeFromPile(ps, 'deck', abilityName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_idx) return { cancelled: true };
      const idx = _taken_idx.idx;
      engine._broadcastEvent('deck_search_add', { cardName: abilityName, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
      engine.handZugangSync(ps, abilityName, { von: 'transit', source: CARD_NAME });   // v1395: Durchgang zur Anlage, keine Suche
    } else if (source === 'discard') {
      const _taken_idx = await engine.takeFromPile(ps, 'discard', abilityName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_idx) return { cancelled: true };
      engine.handZugangSync(ps, abilityName, { von: 'transit', source: CARD_NAME });   // v1395: Durchgang zur Anlage, keine Suche
    } else { // hand
      if (ps.hand.indexOf(abilityName) < 0) return { cancelled: true };
      // Already in hand — attachAbilityFromHand consumes it from there.
    }

    // ── Step 4: attach as an ADDITIONAL attachment ──
    // `skipAbilityGivenCheck: true` is what makes it "additional" —
    // the Hero's once-per-turn attach slot is not consumed.
    const res = await engine.attachAbilityFromHand(pi, abilityName, targetHeroIdx, {
      skipAbilityGivenCheck: true,
      resistanzGeprueft: true,   // W14: oben schon gefragt
      targetZoneSlot: explicitZone >= 0 ? explicitZone : undefined,
      ...(explicitSupport >= 0 ? { targetSupportSlot: explicitSupport, targetZoneArt: 'support' } : {}),
      ...(zielSeite !== pi ? { heroOwner: zielSeite } : {}),
    });

    if (!res?.success) {
      // Extremely defensive: zones filled between the check and now.
      // The Ability is non-destructively sitting in the player's hand
      // (attachAbilityFromHand never splices on failure) — log and
      // still consume the Potion (the player made their choices).
      engine.log('pressed_skill_fizzle', {
        player: ps.username, ability: abilityName, from: source,
      });
      engine.sync();
      return true;
    }

    // Signature visual — golden, glittering rain falling down upon
    // the target Hero as the skill is pressed onto it. `duration`
    // overrides onZoneAnim's 1000ms default so the rain + landing
    // shimmer play out fully (particles ≤ ~1560ms). zoneSlot:-1 with
    // no zoneType routes onZoneAnim to the hero-zone selector.
    engine._broadcastEvent('play_zone_animation', {
      type: 'pressed_skill_rain',
      owner: zielSeite, heroIdx: targetHeroIdx, zoneSlot: -1,
      duration: 1700,
    });

    // Deck-search reveal etiquette — let the opponent see what was
    // pulled from the deck (mirrors Sacrifice to Divinity / Premonition).
    if (source === 'deck') {
      const oi = engine.opponentOf(pi);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: abilityName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }

    // Placement sparkle on the new ability slot (parity with the
    // standard ability-attach visual).
    engine._broadcastEvent('ability_activated', {
      owner: zielSeite, heroIdx: targetHeroIdx, zoneIdx: res.zoneSlot, zoneKind: res.zoneKind,
      abilityName,
    });

    engine.log('pressed_skill', {
      player: ps.username,
      ability: abilityName,
      from: source,
      to: engine.gs.players[zielSeite]?.heroes?.[targetHeroIdx]?.name,
      zone: res.zoneSlot,
    });
    engine.sync();
    return true;
  },
};
