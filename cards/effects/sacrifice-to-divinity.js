// ═══════════════════════════════════════════
//  CARD EFFECT: "Sacrifice to Divinity"
//  Spell (Magic Arts + Support Magic, Lv2, Normal)
//
//  Multi-school Spell — castable by any Hero whose COMBINED levels
//  in Magic Arts and Support Magic reach 2 (and Wisdom / Divinity
//  can pay any remaining gap, same as a single-school Spell).
//
//  On cast:
//    1. The user must SACRIFICE one Creature they control. This
//       fires both `onCreatureSacrificed` (the dedicated sacrifice
//       hook) and the standard `onCreatureDeath` downstream.
//    2. The player chooses a "Divinity" Ability from their hand,
//       deck, OR discard pile and attaches it to one of their
//       Heroes. The attachment is permitted by passing
//       `allowRestricted: true` to the engine's attach helpers,
//       bypassing Divinity's normal restrictedAttachment block.
//
//  Card text marks the cast as an additional Action — that's
//  handled by the `inherentAction: true` flag below; the engine's
//  spell-play flow will not consume the hero's main action slot.
//
//  ★ Z7c (Als Entscheidung, Welle 3): DAS OPFER IST EIN KOSTENPUNKT
//  („Sacrifice a Creature you control TO PLAY THIS CARD"). Es wird in
//  `payActivationCost` VOR dem Reaktionsfenster bezahlt; wird die Karte
//  danach komplett negiert, bleibt die Kreatur geopfert. Abbruch der
//  Opferwahl (`false`) nimmt den Zug zurück (Karte bleibt auf der Hand);
//  ein von Barrier of Undying gerettetes Opfer fizzelt die Karte wie
//  zuvor (gespielt, verbraucht, ohne Wirkung — `_opferGerettet`).
//  Fallback: lief `payActivationCost` nicht (anderer Spielweg), zahlt
//  `onPlay` die Kosten wie früher selbst.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sacrifice to Divinity';
const DIVINITY  = 'Divinity';

/** Opferwahl (Kosten) — eine Stelle für `payActivationCost` und den Fallback in `onPlay`. */
function opferSpec() {
  return {
    minCount: 1,
    title: `${CARD_NAME} — Sacrifice`,
    description: 'Sacrifice 1 of your Creatures to play Sacrifice to Divinity.',
    confirmLabel: '🗡️ Sacrifice & Cast!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

module.exports = {
  inherentAction: true,

  /**
   * Pre-condition: the player must control at least one Creature
   * that's eligible to be sacrificed (not summoned this turn). If
   * not, the card can't be cast.
   */
  spellPlayCondition(gs, playerIdx, engine) {
    if (!engine) return true; // Optimistic if engine missing.
    const candidates = engine.getSacrificableCreatures(playerIdx);
    return candidates.length > 0;
  },

  /**
   * ★ Z7c: das Opfer („to play this card") wird VOR dem Reaktionsfenster bezahlt.
   * `false` = Opferwahl abgebrochen (nichts bezahlt) → der Server nimmt den Zug zurück.
   */
  async payActivationCost(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst) return;
    const sacrificed = await engine.resolveSacrificeCost(ctx, opferSpec());
    if (sacrificed) { inst._opfer = sacrificed; return; }
    // Gerettetes Opfer (Barrier of Undying): die Karte ist gespielt und fizzelt (v1313) — `onPlay` setzt das nach.
    if (engine.nimmOpferFizzle()) { inst._opferGerettet = true; return; }
    inst._opferAbbruch = true;
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Step 1: sacrifice a Creature ──
      // Funnel through the engine's central sacrifice pipeline so the
      // ON_CREATURE_SACRIFICED hook fires and the kill goes through
      // actionDestroyCard (firing onCreatureDeath / discard routing).
      // `cancellable` lets the player back out before the cost is
      // paid — gs._spellCancelled tells the spell-play handler to
      // return the card to hand without discarding.
      // Z7c: Normalweg — die Kosten hat `payActivationCost` schon vor der Kette bezahlt.
      const _inst = ctx.card;
      if (_inst?._opferGerettet) { delete _inst._opferGerettet; gs._opferFizzle = true; gs._spellCancelled = true; return; }
      if (_inst?._opferAbbruch) { delete _inst._opferAbbruch; gs._spellCancelled = true; return; }
      let sacrificed = _inst?._opfer;
      if (_inst) delete _inst._opfer;
      if (!sacrificed) sacrificed = await engine.resolveSacrificeCost(ctx, opferSpec());
      if (!sacrificed) { gs._spellCancelled = true; return; }

      // ── Step 2: pick a Divinity from hand / deck / discard ──
      // Build a gallery of all available "Divinity" copies, tagged by
      // source so the player sees where each one is coming from.
      const sources = [];
      const handCount    = (ps.hand        || []).filter(n => n === DIVINITY).length;
      const deckCount    = (ps.mainDeck    || []).filter(n => n === DIVINITY).length;
      const discardCount = (ps.discardPile || []).filter(n => n === DIVINITY).length;
      if (handCount    > 0) sources.push({ name: DIVINITY, source: 'hand',    count: handCount });
      // Z6 (S03-03): Deck/Ablage nur, wenn die Karte sie verlassen darf (Knight of Kings [B], Stab-/Eye-Sperre).
      if (deckCount    > 0 && engine.pileOutAllowed(pi, 'deck', { sourceOwner: pi })) sources.push({ name: DIVINITY, source: 'deck',    count: deckCount });
      if (discardCount > 0 && engine.pileOutAllowed(pi, 'discard', { sourceOwner: pi }) && !engine.isDiscardOutHardLocked(pi)) sources.push({ name: DIVINITY, source: 'discard', count: discardCount });

      if (sources.length === 0) {
        // Sacrifice is paid (matches Wisdom contract — costs always
        // resolve), but no Divinity is anywhere. The card resolves
        // with no further effect.
        engine.log('sacrifice_to_divinity_no_target', { player: ps.username });
        engine.sync();
        return;
      }

      // Source pick — only prompt if more than one source has copies.
      let pickedSource = null;
      if (sources.length === 1) {
        pickedSource = sources[0].source;
      } else {
        const sourceRes = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: 'Pick a "Divinity" from where?',
          options: sources.map(s => ({
            id: s.source,
            label: `${s.source === 'hand' ? '✋' : s.source === 'deck' ? '📚' : '♻️'}  From your ${s.source} (${s.count} available)`,
          })),
          cancellable: false,
        });
        pickedSource = sourceRes?.optionId || sources[0].source;
      }

      // ── Step 3: pick which Hero to attach Divinity to ──
      const eligibleHeroIdxs = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        // Bypass Divinity's normal restrictedAttachment block — this
        // card is one of the few effects that legitimately attaches
        // it. Standard placement rules (free zone OR existing
        // Divinity stack < 3) still apply.
        if (engine.canAttachAbilityToHero(pi, DIVINITY, hi, { allowRestricted: true })) {
          eligibleHeroIdxs.push(hi);
        }
      }
      if (eligibleHeroIdxs.length === 0) {
        engine.log('sacrifice_to_divinity_no_hero', { player: ps.username });
        engine.sync();
        return;
      }

      // Skip the prompt if there's exactly one legal hero AND a
      // deterministic placement (single free zone or single legal
      // stack target) — same usability shortcut Alex uses.
      let targetHeroIdx = -1;
      let explicitZone  = -1;
      if (eligibleHeroIdxs.length === 1) {
        targetHeroIdx = eligibleHeroIdxs[0];
      } else {
        const pickRes = await engine.promptGeneric(pi, {
          type: 'abilityAttachTarget',
          cardName: DIVINITY,
          eligibleHeroIdxs,
          // Spell counts as an additional Action — the abilityGivenThisTurn
          // flag normally limits to one hand-attach per hero per turn,
          // but this is an alternate-cast attachment. Skip the gate.
          skipAbilityGiven: true,
          title: CARD_NAME,
          description: 'Attach "Divinity" to one of your Heroes.',
          cancellable: false,
        });
        if (!pickRes || pickRes.cancelled) {
          // No graceful cancel here — the sacrifice is already paid.
          // Fall back to the first eligible hero.
          targetHeroIdx = eligibleHeroIdxs[0];
        } else {
          targetHeroIdx = typeof pickRes.heroIdx === 'number' ? pickRes.heroIdx : eligibleHeroIdxs[0];
          explicitZone  = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
        }
      }

      // Re-verify the chosen hero can still receive Divinity (defensive
      // — state can shift during async prompts).
      if (!engine.canAttachAbilityToHero(pi, DIVINITY, targetHeroIdx, { allowRestricted: true })) {
        engine.log('sacrifice_to_divinity_attach_failed', { player: ps.username, reason: 'no_legal_zone' });
        engine.sync();
        return;
      }

      // ★ W15a (Al, R3: „Ja" — die Divinity-Anleger prallen an Resistance ab): Anlegen PER EFFEKT (Regel W14a Q5, nicht die Standard-Spielaktion) —
      // vor jeder Kartenbewegung gefragt: Divinity bleibt in Hand/Deck/Ablage, das Opfer (Kosten) bleibt bezahlt, der Zauber ist gewirkt.
      if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, pi, targetHeroIdx, CARD_NAME)) {
        engine.log('sacrifice_to_divinity_blocked', { player: ps.username, hero: ps.heroes[targetHeroIdx]?.name });
        engine.sync();
        return;
      }

      // ── Step 4: pull the Divinity from its source pile and attach ──
      // Z6 (S03-03): Deck/Ablage ueber die Stapel-Schicht (Stapel-, Stab- und Eye-Sperre), Hand wie bisher.
      const removeFromPile = (pile) => {
        const idx = pile.indexOf(DIVINITY);
        if (idx >= 0) { pile.splice(idx, 1); return true; }
        return false;
      };
      let pulled = false;
      if (pickedSource === 'hand')    pulled = removeFromPile(ps.hand);
      if (pickedSource === 'deck')    pulled = !!(await engine.takeFromPile(ps, 'deck', DIVINITY, { source: CARD_NAME }));
      if (pickedSource === 'discard') pulled = !!(await engine.takeFromPile(ps, 'discard', DIVINITY, { source: CARD_NAME }));
      if (!pulled) {
        engine.log('sacrifice_to_divinity_attach_failed', { player: ps.username, reason: 'pile_empty' });
        engine.sync();
        return;
      }

      // Pick a target zone: respect the player's drag slot when given,
      // otherwise auto-find a stack with Divinity (slot[0] === DIVINITY,
      // length < 3) or the first empty slot.
      const abZones = ps.abilityZones[targetHeroIdx] || [[], [], []];
      ps.abilityZones[targetHeroIdx] = abZones;
      // v1349: gewuenschter Platz und Rueckfall an EINER Stelle
      // (`engine.abilityZielZone` — verwahrte Abilities, Madame Guillotine).
      const targetZone = engine.abilityZielZone(pi, targetHeroIdx, DIVINITY, { wunschZone: explicitZone });
      if (targetZone < 0) {
        // Race: zones filled between check and now. Refund Divinity
        // back to its source so it isn't silently lost.
        if (pickedSource === 'hand')    engine.handZugangSync(ps, DIVINITY, { von: 'rueckgabe', source: CARD_NAME, ohneInstanz: true });
        if (pickedSource === 'deck')  { ps.mainDeck.push(DIVINITY); engine.shuffleDeck(pi, 'main'); }
        if (pickedSource === 'discard') ps.discardPile.push(DIVINITY);
        engine.log('sacrifice_to_divinity_attach_failed', { player: ps.username, reason: 'no_target_zone' });
        engine.sync();
        return;
      }
      if (!abZones[targetZone]) abZones[targetZone] = [];
      abZones[targetZone].push(DIVINITY);

      // Track the new card instance + fire downstream attach hooks
      // (onCardEnterZone for Alex / Megu / etc., though Alex doesn't
      // re-tutor on Divinity since restrictedAttachment blocks it).
      const inst = engine._trackCard(DIVINITY, pi, 'ability', targetHeroIdx, targetZone);
      if (pickedSource === 'deck') {
        engine._broadcastEvent('deck_search_add', { cardName: DIVINITY, playerIdx: pi });
        engine.shuffleDeck(pi, 'main');
        // Standard deck-search reveal etiquette: notify opponent.
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
        owner: pi, heroIdx: targetHeroIdx, zoneIdx: targetZone,
        abilityName: DIVINITY,
      });

      engine.log('sacrifice_to_divinity_attach', {
        player: ps.username,
        from: pickedSource,
        to: ps.heroes[targetHeroIdx]?.name,
        zone: targetZone,
        sacrificed: (sacrificed === true)
          ? null
          : (Array.isArray(sacrificed) ? sacrificed.map(s => s.cardName) : null),
      });
      engine.sync();
    },
  },
};
