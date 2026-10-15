// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Mirror"
//  Spell (Magic Arts Lv3, Surprise)
//  Pollution archetype.
//
//  Activate when the user would be hit by a Spell.
//  Negate that Spell. Then the user immediately
//  performs a copy of it as an additional Action,
//  ignoring its level requirement. Place Pollution
//  Tokens equal to the negated Spell's level into
//  your free Support Zones.
//
//  The copy-cast bypasses level/school requirements
//  per the card text. It runs through the standard
//  onPlay flow of the reflected Spell, so nested
//  reaction chains still work.
// ═══════════════════════════════════════════

const { placePollutionTokens } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

// ★ Welle 9 (Al, 15.10.2026, A01-pollution-16): Die Kopie ist ein vollwertiges Wirken des Spiegel-Besitzers, nur die STUFE
// wird ignoriert. (a) Sie zahlt die „… to use this Spell"-Kosten des gespiegelten Zaubers (`payActivationCost`). (b) Ein
// „once per game"-Zauber verbraucht das EIGENE Limit des Spiegel-Besitzers (nicht das des Originalbesitzers — dessen
// Stempel gibt die Ganz-Negierung zurück); ist es schon verbraucht, ist die Kopie nicht nutzbar → der Spiegel wird nicht angeboten.
function eigenesLimitVerbraucht(gs, ownerIdx, script, cardName) {
  if (!script || !(script.oncePerGame || script.oncePerGameKey)) return false;
  return !!gs.players[ownerIdx]?._oncePerGameUsed?.has(script.oncePerGameKey || cardName);
}

module.exports = {
  // ★ Z7b: „Negate that Spell/Attack/effect" = die gewirkte Karte löst NIE auf → ihre Einmal-Stempel werden zurückgegeben
  // (Engine: `_merkeGanzeNegation`). Teil-Negierungen („… on that Hero", Schaden) tragen das Flag nicht.
  negatesWholeCard: true,

  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'plague_smoke' }, impactMs: 260 },

  isSurprise: true,

  // Magic Mirror platziert als Teil SEINER EIGENEN Wirkung Pollution
  // Tokens ("equal to the negated Spell's level") — damit ist es ein
  // "Spell that places Pollution Tokens" im Sinne von Mana Mining
  // (Level-Reduktion) und Mana Beacon (Zusatz-Aktion). Das Flag fehlte,
  // wodurch Mana Minings Reduktion NIE griff: Als Befund im Deck
  // "Spell Industrialization" — Victorica trägt Mana Mining Lv3 (in
  // 374/380 Spielen), das hätte Lv3 Magic Arts auf effektiv 0 gesenkt
  // und die Karte für sie spielbar gemacht; ohne Flag blieb sie
  // strukturell uncastbar (2/380 Spiele) und pickSurprisePlacement
  // lehnte die Platzierung korrekt, aber auf falscher Grundlage ab.
  placesPollutionTokens: true,

  // Magic Mirror's whole effect depends on a triggering Spell to reflect
  // (sourceInfo.cardName / level / etc.). Telekinesis supplies no such
  // source, so the card would be a silent no-op if it were selectable.
  // Like Defending the Gate, we simply disallow Telekinesis activation.
  canTelekinesisActivate: false,

  /**
   * Trigger: fires when the user (host Hero) is being targeted by a Spell.
   * sourceInfo = { cardName, owner, heroIdx, cardInstance }.
   * We check the source card's type is Spell. Reactions / Surprises are
   * not "normal Spells" — but the card text is "when the user would be hit
   * by a Spell" so we accept all Spell subtypes and let the engine decide
   * what counts as "hitting" via the surprise window timing.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    const cardDB = engine._getCardDB();
    const sourceCard = sourceInfo?.cardName;
    if (!sourceCard) return false;
    const cd = cardDB[sourceCard];
    if (!cd) return false;
    if (!hasCardType(cd, 'Spell')) return false;
    // Welle 9: die Kopie eines „once per game"-Zaubers braucht das EIGENE Limit des Spiegel-Besitzers frei.
    if (eigenesLimitVerbraucht(gs, ownerIdx, loadCardEffect(sourceCard), sourceCard)) return false;
    return true;
  },

  /**
   * On activation: return { effectNegated: true } to negate the incoming
   * Spell. Then synthesize a fresh instance of the same Spell in the
   * user's hand-adjacent space, fire its onPlay bypassing level checks,
   * and clean up. Finally place Pollution Tokens equal to the negated
   * Spell's level.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerIdx = ctx.cardOwner;       // The player who placed the Surprise
    const hostHeroIdx = ctx.cardHeroIdx;  // The Hero hosting the Surprise
    const cardDB = engine._getCardDB();
    const sourceCard = sourceInfo?.cardName;

    if (!sourceCard) return null;
    const sourceCd = cardDB[sourceCard];
    if (!sourceCd) return null;

    const spellLevel = sourceCd.level || 0;

    // ── Animation: Magic Mirror shimmer on host Hero ──
    // No dedicated animation yet — use plague_smoke as a placeholder for the
    // negation flash, then the reflected spell's own onPlay will produce its
    // native animation.
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: ctx.cardHeroOwner ?? ownerIdx, heroIdx: hostHeroIdx, zoneSlot: -1,
    });
    await engine._delay(500);

    engine.log('magic_mirror_reflect', {
      player: gs.players[ownerIdx]?.username,
      spell: sourceCard, level: spellLevel,
    });

    // ── Place Pollution Tokens equal to the negated Spell's level ──
    if (spellLevel > 0) {
      await placePollutionTokens(engine, ownerIdx, spellLevel, 'Magic Mirror', {
        promptCtx: ctx,
      });
    }

    // ── Copy-cast the reflected Spell as an additional Action, ignoring
    //    its level requirement. We synthesize a fresh instance, fire its
    //    onPlay, then clean up. This mirrors the pattern in
    //    performImmediateAction (line 4313–4325) minus the hand bookkeeping. ──
    const script = loadCardEffect(sourceCard);
    // Welle 9: Kosten der Kopie. Die Tokens des Spiegels liegen schon; reicht der Platz/Vorrat für die Kosten des Zaubers nicht
    // mehr (`spellPlayCondition` der Kostenzahler) oder bricht der Spieler die Kostenwahl ab (`false`), gibt es keine Kopie —
    // das Original bleibt negiert.
    let kopieMoeglich = !!script?.hooks?.onPlay;
    let synthInstVorab = null;
    if (kopieMoeglich && eigenesLimitVerbraucht(gs, ownerIdx, script, sourceCard)) kopieMoeglich = false;
    if (kopieMoeglich && typeof script.payActivationCost === 'function' && script.payActivationCost.length <= 1) {
      // Nur die Zauber-Form `payActivationCost(ctx)` (Kreaturen-/Helden-Reaktionen tragen `(engine, pi, …)` und sind keine Zauber).
      try {
        if (script.spellPlayCondition && !script.spellPlayCondition(gs, ownerIdx, engine)) kopieMoeglich = false;
      } catch (err) { console.error('[Magic Mirror] spellPlayCondition', sourceCard, err.message); }
      if (kopieMoeglich) {
        synthInstVorab = engine._trackCard(sourceCard, ownerIdx, 'hand', hostHeroIdx, -1);
        if (ctx.cardHeroOwner != null && ctx.cardHeroOwner !== ownerIdx) synthInstVorab.heroOwner = ctx.cardHeroOwner;
        let bezahlt;
        try { bezahlt = await script.payActivationCost(engine._createContext(synthInstVorab, {})); }
        catch (err) { console.error('[Magic Mirror] payActivationCost', sourceCard, err.message); }
        if (bezahlt === false) {
          kopieMoeglich = false;
          engine._untrackCard(synthInstVorab.id);
          synthInstVorab = null;
        }
      }
    }
    if (kopieMoeglich) {
      // Eigenes „once per game"-Limit des Spiegel-Besitzers verbrauchen; `_surpriseStempel` schützt es vor dem Z7b-Abzug,
      // falls der Spiegel-Besitzer zugleich Wirker des negierten Zaubers ist.
      const opgKey = script.oncePerGameKey || (script.oncePerGame ? sourceCard : null);
      if (opgKey) {
        const ops = gs.players[ownerIdx];
        if (ops) {
          if (!ops._oncePerGameUsed) ops._oncePerGameUsed = new Set();
          ops._oncePerGameUsed.add(opgKey);
          (engine._surpriseStempel || (engine._surpriseStempel = new Set())).add(`${ownerIdx}|${opgKey}`);
        }
      }
    }
    if (kopieMoeglich) {
      // Synthesize the card as if it were in the user's hand attached to
      // the host hero. _trackCard returns a fresh instance object; we pass
      // zone 'hand' so downstream cost logic in the spell treats it as a
      // normal play.
      const synthInst = synthInstVorab || engine._trackCard(sourceCard, ownerIdx, 'hand', hostHeroIdx, -1);
      // Als Vorgabe 29.9.: Wirker ist der Traeger auf seiner Brettseite
      // (geliehener Held) — `cardHeroOwner` der Kopie zeigt dorthin.
      if (!synthInstVorab && ctx.cardHeroOwner != null && ctx.cardHeroOwner !== ownerIdx) synthInst.heroOwner = ctx.cardHeroOwner;

      // Mark this as an immediate/copied play so nested systems know to
      // skip certain once-per-turn restrictions that would otherwise lock
      // the original caster out.
      gs._immediateActionContext = true;
      gs._magicMirrorBypassLevel = true; // Advisory flag for future use

      try {
        // Fire the Spell's onPlay hook scoped to this instance.
        await engine.runHooks('onPlay', {
          _onlyCard: synthInst, playedCard: synthInst,
          cardName: sourceCard, zone: 'hand',
          heroIdx: hostHeroIdx,
          _skipReactionCheck: true,
        });
      } finally {
        delete gs._immediateActionContext;
        delete gs._magicMirrorBypassLevel;
        // Move the synthetic instance to the user's discard (or deleted pile,
        // depending on the card's own `_spellPlacedOnBoard` flag). Standard
        // spells get discarded; placed-on-board ones handled themselves.
        if (!gs._spellPlacedOnBoard) {
          const ps = gs.players[ownerIdx];
          if (ps) ps.discardPile.push(sourceCard);
          engine._untrackCard(synthInst.id);
        } else {
          delete gs._spellPlacedOnBoard;
        }
      }
    }

    engine.sync();
    return { effectNegated: true };
  },
};
