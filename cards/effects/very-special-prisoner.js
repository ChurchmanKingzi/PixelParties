// ═══════════════════════════════════════════
//  CARD EFFECT: "Very Special Prisoner"
//  Spell (Reaction, Magic Arts Lv 1)
//
//  Play immediately when you take control of an
//  opponent's target. Attach a Divinity Ability
//  from your hand or deck to a Hero you control.
//
//  Reaction-only: `canActivate: () => false` so
//  the card is never proactively playable. The
//  trigger is the engine's `onTakeControl` hook,
//  fired by every control-change primitive:
//    • `actionStealCreature` (Aligning Goals,
//      Treacherous Crystal, Deepsea Succubus —
//      temporary creature steal that auto-reverts
//      at next turn-start)
//    • `actionTransferCreature` (Dark Gear,
//      Diplomacy — permanent transfer onto own
//      side)
//    • `actionStealHero` (Charme Lv3 — temporary
//      hero steal)
//    • Controlled Attack's direct
//      `tgtHero.controlledBy = pi` write
//
//  All four paths now `runHooks('onTakeControl',
//  {...})` after committing the control change,
//  with a `kind:` discriminator. The reaction
//  condition below gates only on `controllerPi`
//  matching the playing side and the trigger
//  being the take-control event — every kind
//  qualifies per the card text.
// ═══════════════════════════════════════════

const DIVINITY = 'Divinity';
const CARD_NAME = 'Very Special Prisoner';

/**
 * Total copies of "Divinity" reachable from the player's hand or deck.
 * Returns 0 when no copies exist anywhere — used by
 * `reactionCondition` to grey the card out when the attach would
 * fizzle for lack of a Divinity to fetch.
 */
function _availableDivinitySources(ps, engine, pi) {
  if (!ps) return [];
  const out = [];
  const handCount = (ps.hand || []).filter(n => n === DIVINITY).length;
  // R02-19: das Deck ist nur Quelle, solange der Stapel-Abgang nicht gesperrt ist
  // (Knight of Kings [B]) — der Splice unten geht an der Stapel-Schicht vorbei.
  const deckGesperrt = !!engine && !engine.pileOutAllowed(pi, 'deck', { sourceOwner: pi, source: CARD_NAME });
  const deckCount = deckGesperrt ? 0 : (ps.mainDeck || []).filter(n => n === DIVINITY).length;
  if (handCount > 0) out.push({ source: 'hand', count: handCount });
  if (deckCount > 0) out.push({ source: 'deck', count: deckCount });
  return out;
}

/**
 * Helden, die `pi` KONTROLLIERT und die eine frische Divinity-Anlage aufnehmen koennen.
 * W28a (Al, 21.10.2026: „'you control' bezieht sich IMMER auf aktuelle Kontrolle, also Kontrolleur und nicht Besitzer"):
 * `heroesControlledBy` — ein von `pi` uebernommener Gegnerheld (gecharmt/gestohlen, dauerhaft oder temporaer) ist ein
 * gueltiger Wirt (Anlegen PER EFFEKT: es genuegt die Kontrolle, `byEffect`; ein Held ganz ohne Rechte — Charme Lv3 „unaffected" —
 * bleibt ausgenommen), ein an den Gegner abgegebener eigener Held nicht. Die Divinity landet in den Ability Zones der
 * BRETTSEITE `phys` des Helden.
 * @returns {Array<{phys:number, heroIdx:number}>}
 */
function _eligibleHeroes(engine, pi) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0) continue;
    // `allowRestricted: true` so Divinity's normal restrictedAttachment
    // block doesn't filter us out — same pattern Sacrifice to Divinity
    // uses (sacrifice-to-divinity.js:113).
    const opts = physOwner !== pi ? { heroOwner: physOwner, byEffect: true, allowRestricted: true } : { allowRestricted: true };
    if (engine.canAttachAbilityToHero(pi, DIVINITY, heroIdx, opts)) out.push({ phys: physOwner, heroIdx });
  }
  return out;
}

module.exports = {
  // BORIS-SPERRE (Klausel 2): uebernimmt die Kontrolle ueber ein gegnerisches Ziel
  // Solange der Gegner einen wirksamen Boris hat, ist diese Karte
  // gar nicht erst aktivierbar. Siehe engine.borisBlockIdx.
  takesControlOfTargets: true,

  isReaction: true,
  // Reaction-only — never proactively playable.
  canActivate: () => false,

  /**
   * Triggered by the engine's `onTakeControl` hook. The chainCtx
   * forwards the originating hook name + ctx so we can pin the
   * activation strictly to the take-control event AND to the side
   * that gained control (the playing player must be the new
   * controller, never the original owner).
   *
   * Also requires at least one Divinity reachable AND a Hero that
   * can legally receive it — otherwise the reaction can't do
   * anything productive and is silently unavailable.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx) return false;
    if (chainCtx.hookName !== 'onTakeControl') return false;
    const hctx = chainCtx.hookCtx || {};
    if (hctx.controllerPi !== pi) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (_availableDivinitySources(ps, engine, pi).length === 0) return false;
    if (_eligibleHeroes(engine, pi).length === 0) return false;
    return true;
  },

  /**
   * Resolve: pick a source (hand or deck), pick a Hero, splice the
   * Divinity out of its source pile, push into the chosen ability
   * slot, fire the standard onPlay / onCardEnterZone hooks. Pattern
   * mirrors Sacrifice to Divinity's attach branch, minus the
   * discard-pile source (this card's text restricts to hand or deck).
   */
  resolve: async (engine, pi, _selectedIds, _validTargets, _chain) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    const sources = _availableDivinitySources(ps, engine, pi);
    if (sources.length === 0) return; // Defensive — reactionCondition gated this.

    // Source pick — only prompt when both hand and deck have copies.
    let pickedSource;
    if (sources.length === 1) {
      pickedSource = sources[0].source;
    } else {
      const sourceRes = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Pick a "Divinity" from where?',
        options: sources.map(s => ({
          id: s.source,
          label: `${s.source === 'hand' ? '✋' : '📚'}  From your ${s.source} (${s.count} available)`,
        })),
        cancellable: false,
      });
      pickedSource = sourceRes?.optionId || sources[0].source;
    }

    // Hero pick (W28a: alle vom Spieler KONTROLLIERTEN Helden, auch uebernommene Gegnerhelden).
    const helden = _eligibleHeroes(engine, pi);
    if (helden.length === 0) return;

    let ziel = null;           // { phys, heroIdx }
    let explicitZone = -1;
    if (helden.length === 1) {
      ziel = helden[0];
    } else if (helden.every(h => h.phys === pi)) {
      const pickRes = await engine.promptGeneric(pi, {
        type: 'abilityAttachTarget',
        cardName: DIVINITY,
        eligibleHeroIdxs: helden.map(h => h.heroIdx),
        // Reaction-cast attachment doesn't consume the per-turn
        // hand-attach budget (`abilityGivenThisTurn`). Same shortcut
        // Sacrifice to Divinity takes.
        skipAbilityGiven: true,
        title: CARD_NAME,
        description: 'Attach "Divinity" to one of your Heroes.',
        cancellable: false,
      });
      if (!pickRes || pickRes.cancelled) {
        // No graceful cancel in a reaction — the trigger has already
        // been consumed by the reaction window. Fall back to first
        // eligible hero so the card resolves productively.
        ziel = helden[0];
      } else {
        const hi = typeof pickRes.heroIdx === 'number' ? pickRes.heroIdx : helden[0].heroIdx;
        ziel = helden.find(h => h.heroIdx === hi) || helden[0];
        explicitZone = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
      }
    } else {
      // Mit uebernommenem Gegnerhelden unter den Zielen: Heldenwahl ueber Brett-Klick (die Anlege-Maske
      // `abilityAttachTarget` kennt nur die eigene Heldenreihe) — wie Pressed Skill.
      const ids = await engine.promptEffectTarget(pi, helden.map(h => ({
        id: `hero-${h.phys}-${h.heroIdx}`, type: 'hero', owner: h.phys, heroIdx: h.heroIdx,
        cardName: gs.players[h.phys]?.heroes?.[h.heroIdx]?.name || '',
      })), {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Attach "Divinity" to one of your Heroes.',
        confirmLabel: '🔧 Attach', confirmClass: 'btn-info',
        maxTotal: 1, cancellable: false, greenSelect: true,   // pflichtwahl: die Reaktion ist schon ausgeloest (kein Abbruch moeglich) - wie die Heldenwahl oben (abilityAttachTarget, cancellable: false)
        previewCardName: DIVINITY,
      });
      ziel = (Array.isArray(ids) && ids.length > 0) ? helden.find(h => `hero-${h.phys}-${h.heroIdx}` === ids[0]) : null;
      if (!ziel) ziel = helden[0];   // keine Abbruchmoeglichkeit in einer Reaktion (s. o.)
    }
    const targetHeroIdx = ziel.heroIdx;
    const feld = ziel.phys;                       // Brettseite des Helden (= Seite seiner Ability Zones)
    const fremd = feld !== pi;
    const seitenOpt = fremd ? { heroOwner: feld, byEffect: true, allowRestricted: true } : { allowRestricted: true };
    const hps = gs.players[feld];

    // Defensive re-check — state could shift through an inner prompt.
    if (!engine.canAttachAbilityToHero(pi, DIVINITY, targetHeroIdx, seitenOpt)) {
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'no_legal_zone',
      });
      engine.sync();
      return;
    }

    // ★ W15a (Al, R3: „Ja" — die Divinity-Anleger prallen an Resistance ab): Anlegen PER EFFEKT — vor jeder Kartenbewegung gefragt;
    // Divinity bleibt in Hand/Deck, die Reaktion ist gespielt.
    if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, feld, targetHeroIdx, CARD_NAME)) {
      engine.log('very_special_prisoner_blocked', { player: ps.username, hero: hps.heroes[targetHeroIdx]?.name });
      engine.sync();
      return;
    }

    // Splice the Divinity out of its source pile.
    const removeFromPile = (pile) => {
      const idx = pile.indexOf(DIVINITY);
      if (idx >= 0) { pile.splice(idx, 1); return true; }
      return false;
    };
    let pulled = false;
    if (pickedSource === 'hand') pulled = removeFromPile(ps.hand);
    if (pickedSource === 'deck') pulled = removeFromPile(ps.mainDeck);
    if (!pulled) {
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'pile_empty',
      });
      engine.sync();
      return;
    }

    // Resolve the destination zone slot. Honour the explicit drag slot
    // when given, else stack onto an existing Divinity slot (cap 3) or
    // fall back to the first free slot. Same tie-breaker the standard
    // ability-attach path uses.
    const abZones = hps.abilityZones[targetHeroIdx] || [[], [], []];
    hps.abilityZones[targetHeroIdx] = abZones;
    // v1349: gewuenschter Platz und Rueckfall an EINER Stelle
    // (`engine.abilityZielZone` — verwahrte Abilities, Madame Guillotine).
    const targetZone = engine.abilityZielZone(feld, targetHeroIdx, DIVINITY, { wunschZone: explicitZone });
    if (targetZone < 0) {
      // Race: zones filled between the canAttach check and the splice.
      // Refund the Divinity back to its source pile so it isn't lost.
      if (pickedSource === 'hand') engine.handZugangSync(ps, DIVINITY, { von: 'rueckgabe', source: CARD_NAME, ohneInstanz: true });
      if (pickedSource === 'deck') { ps.mainDeck.push(DIVINITY); engine.shuffleDeck(pi, 'main'); }
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'no_target_zone',
      });
      engine.sync();
      return;
    }

    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(DIVINITY);

    const inst = engine._trackCard(DIVINITY, feld, 'ability', targetHeroIdx, targetZone);
    if (fremd) inst.originalOwner = pi;   // W28a: die Karte gehoert dem Spieler (wie `attachAbilityFromHand` bei geliehenem Helden)

    // Deck-source etiquette — reveal to opponent and reshuffle. Mirrors
    // Sacrifice to Divinity's deck-source branch.
    if (pickedSource === 'deck') {
      engine._broadcastEvent('deck_search_add', { cardName: DIVINITY, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
      const oi = engine.opponentOf(pi);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: DIVINITY,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }

    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: DIVINITY,
      zone: 'ability', heroIdx: targetHeroIdx, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'ability', toHeroIdx: targetHeroIdx,
      _skipReactionCheck: true,
    });

    engine._broadcastEvent('ability_activated', {
      owner: feld, heroIdx: targetHeroIdx, zoneIdx: targetZone,
      abilityName: DIVINITY,
    });

    engine.log('very_special_prisoner_attach', {
      player: ps.username,
      from: pickedSource,
      to: hps.heroes[targetHeroIdx]?.name,
      zone: targetZone,
    });
    engine.sync();
  },
};
