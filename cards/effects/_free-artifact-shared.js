'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „play it immediately without paying its Cost" für ein Artifact, das gerade aus dem Deck kommt (Als Vorgabe 10.10.)
//
//  Sky Archeologist deckt die oberste Deckkarte auf (sie liegt in der Bildmitte, `_deck-top-shared.js`); ist sie ein Artifact, darf er es SOFORT für 0 Gold
//  spielen. „Sofort" heißt (Als Korrektur 10.10.): die Karte wird NICHT erst auf die Hand gegeben, sie wirkt auf der Stelle — mit Zielwahl, Kettenfenster
//  und allem, was dazugehört. Will der Spieler sie nicht spielen, bricht er ab oder ist sie nicht spielbar, ändert sich NICHTS: sie bleibt oben im Deck.
//
//    spielweg(engine, pi, name)                  → 'equip' | 'artifact' | null   (null = nicht spielbar; reine Abfrage, ändert nichts)
//    spieleKostenlos(engine, pi, name, { source, key })
//                                                → 'equip' | 'artifact' | false
//
//  `spieleKostenlos` setzt voraus: die Karte liegt OBEN im Deck und wird in der Bildmitte gehalten (`haltenImZentrum`, Schlüssel `key`).
//    • Rückgabe `'equip'` / `'artifact'`: die Karte wurde gespielt und ist schon weitergeflogen (Platz bzw. Ablage / Gelöscht / Hand / Deck) — der
//      Aufrufer lässt sie in Ruhe.
//    • Rückgabe `false`: nichts ist passiert (abgelehnt, abgebrochen, scheitert), die Karte liegt unverändert oben im Deck und noch in der Mitte — der
//      Aufrufer schickt sie zurück (`gibFrei(..., { dest: 'deck' })`).
//
//  ── SPIELBARE ARTIFACTS ─────────────────────────────────────────────────
//    • EQUIPMENT  → wird an einen gewählten Helden gelegt (`equipArtifactToHero`: `onPlay`/`onCardEnterZone`); die Karte fliegt aus der Mitte auf den
//                   gewählten Platz. Ohne freien Platz bei einem tauglichen Helden ist sie nicht spielbar.
//    • NORMAL     → sofort aufgelöst, derselbe Ablauf wie `doUseArtifactEffect` / `doConfirmPotion` (Server), nur ohne Handkarte:
//                   Zielwahl (`promptEffectTarget`: Zielschutz, Umleitung, Surprise-Fenster laufen dort) → Karte aus dem Deck nehmen →
//                   Kettenfenster (`executeCardWithChain`, `fromBoard`: kein Handspiel) → `script.resolve` im GRATIS-SCOPE (`engine.kostenlosSpielen`: auch
//                   Artifacts mit eigener Kostenrechnung — Book of Doom, Dark Gear, Beer … — zahlen nichts) → Ablage (`deleteOnUse`: Gelöscht; negiert:
//                   Ablage/Gelöscht/Deck/Hand des Diebs wie im Kettenfenster bestimmt; `keepInHand`: Hand) → `afterArtifactUsed`,
//                   `onAnyActionResolved`, ggf. Zugende (`_spellEndsTurn`).
//                   Bricht der Spieler die Zielwahl ab oder meldet das `resolve` `aborted`/`cancelled`, liegt die Karte wieder OBEN im Deck.
//    • NICHT spielbar (bleiben im Deck): Reaction ohne `proactivePlay`, Surprise, Area, Artifact Creatures (feste Beschwörungsbedingungen), `neverPlayable`,
//      Boomerangs Artifact-Sperre, Hand-/Zieh-/Stapel-/Beschwörungs-/Such-Sperren der Karte, das kartenseitige Spielbarkeits-Tor (`canPlayWithHero`,
//      `canActivate`), eine Zielkarte ohne gültiges Ziel, Item Lock ohne Handkarte zum Löschen.
// ═══════════════════════════════════════════

const { isEquipArtifact, equipDestinations, equipArtifactToHero } = require('./_orchestra-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { gibFrei } = require('./_deck-top-shared');

/** Zielkarte? (Skript liefert Ziele und eine Zielkonfiguration.) */
const istZielend = (script) => !!(script && typeof script.getValidTargets === 'function' && script.targetingConfig);

function zielKonfig(engine, pi, script, name) {
  const config = typeof script.targetingConfig === 'function'
    ? script.targetingConfig(engine.gs, pi, 0, engine)
    : { ...script.targetingConfig };
  // Karten mit eigener Kostenrechnung deckeln ihre Zielzahl am Budget; gratis gibt es keins.
  if (script.manualGoldCost && !config.maxTotal) config.maxTotal = 99;
  if (config.dynamicCostPerTarget != null) config.dynamicCostPerTarget = 0;
  return config;
}

function zielListe(engine, pi, script) {
  try { return script.getValidTargets(engine.gs, pi, engine) || []; }
  catch { return []; }
}

/** Welchen Weg nähme `name` als Gratis-Spiel — oder `null`, wenn die Karte jetzt nicht spielbar ist. Ändert nichts. */
function spielweg(engine, pi, name) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cd = engine._getCardDB()[name];
  if (!ps || !cd || !hasCardType(cd, 'Artifact')) return null;
  // Boomerangs „no Artifacts for the rest of this turn" sperrt jedes Spielen eines Artifacts.
  if (ps._artifactLockTurn === gs.turn) return null;
  // Item Lock: jedes Artifact kostet das Löschen einer Handkarte — ohne Handkarte kein Spiel.
  if (ps.itemLocked && (ps.hand || []).length < 1) return null;
  // Die Karte verlässt das Deck.
  if (!engine.pileOutAllowed(pi, 'deck', {})) return null;

  const script = loadCardEffect(name);
  if (script?.neverPlayable) return null;

  if (isEquipArtifact(cd)) return equipDestinations(engine, pi, name).length > 0 ? 'equip' : null;

  // Alles Weitere: Normal (auch Reaction mit `proactivePlay`).
  if (!script) return null;
  if (hasCardType(cd, 'Creature')) return null;   // Artifact Creatures: feste Beschwörungsbedingungen
  const unterarten = (cd.subtype || '').toLowerCase().split('/').map(t => t.trim());
  if (unterarten.some(t => t === 'surprise' || t === 'area' || t === 'creature')) return null;
  if (unterarten.includes('reaction') && !script.proactivePlay) return null;

  // Das kartenseitige Spielbarkeits-Tor, gegen ALLE eigenen Helden (gesperrt ist die Karte nur, wenn sie bei keinem spielbar wäre).
  if (typeof script.canPlayWithHero === 'function') {
    let irgendwo = false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (!ps.heroes[hi]?.name) continue;
      try { if (script.canPlayWithHero(gs, pi, hi, cd, engine)) { irgendwo = true; break; } }
      catch { irgendwo = true; break; }   // kaputtes Tor sperrt nicht
    }
    if (!irgendwo) return null;
  }
  if (script.blockedByDrawLock && ps.drawLocked) return null;
  if (engine._cardBlockedBySearchLock?.(script, cd, ps, pi)) return null;
  if (script.blockedByHandLock && ps.handLocked) return null;
  if (script.blockedByPileLock && engine.isPileLockedFor(pi)) return null;
  if (script.blockedBySummonLock && ps.summonLocked) return null;
  try { if (script.canActivate && !script.canActivate(gs, pi, engine)) return null; }
  catch { /* kaputtes Tor sperrt nicht */ }

  if (istZielend(script)) {
    try {
      const config = zielKonfig(engine, pi, script, name);
      if (!config.alwaysConfirmable && zielListe(engine, pi, script).filter(t => !t?.ineligible).length === 0) return null;
    } catch { return null; }   // eine Zielkonfiguration, die wirft, macht die Karte unspielbar
    return 'artifact';
  }
  return typeof script.resolve === 'function' ? 'artifact' : null;
}

/** Equipment: Platz wählen (Karte liegt in der Mitte), Flug aus der Mitte auf den Platz, anlegen. */
async function legeAn(engine, pi, name, key, source) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const ziele = equipDestinations(engine, pi, name);
  if (ziele.length === 0) return false;
  let platz = ziele[0];
  if (ziele.length > 1) {
    const zonen = ziele.map(z => ({
      heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.side,
      label: `${gs.players[z.side]?.heroes?.[z.heroIdx]?.name || 'Hero'} · Slot ${z.slotIdx + 1}`,
    }));
    const wahl = await engine.promptGeneric(pi, {
      type: 'zonePick', title: source || name,
      description: `Equip ${name} to which Hero? (without paying its Cost)`,
      zones: zonen, cancellable: true, heroShortcut: false,
    });
    if (!wahl || wahl.cancelled) return false;
    platz = ziele.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx && (z.side ?? pi) === (wahl.owner ?? pi)) || null;
    if (!platz) return false;
  }
  if ((ps.mainDeck || [])[0] !== name) return false;
  const seite = platz.side ?? pi;
  await gibFrei(engine, pi, key, name, { dest: 'support', destHeroIdx: platz.heroIdx, destSlotIdx: platz.slotIdx, destSide: seite });
  const inst = await equipArtifactToHero(engine, pi, name, seite, platz.heroIdx, platz.slotIdx, { from: 'deck', source, animDelay: 120 });
  if (!inst) return false;
  engine.log('free_artifact_played', { player: ps.username, card: name, as: 'equipment', by: source });
  return 'equip';
}

/** Normales Artifact: Ziel wählen, Karte nehmen, Kette, Wirkung (gratis), Ablage. */
async function spieleNormal(engine, pi, name, key, source) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const script = loadCardEffect(name);

  // ① Zielwahl — die Karte liegt dabei noch im Deck und in der Mitte; Abbruch kostet nichts.
  let selectedIds = [];
  let validTargets = [];
  const zielend = istZielend(script);
  if (zielend) {
    validTargets = zielListe(engine, pi, script);
    const config = zielKonfig(engine, pi, script, name);
    if (validTargets.length === 0 && !config.alwaysConfirmable) return false;
    config.title = config.title || name;
    config.sourceCardName = name;
    config.description = (config.description || `Play ${name}.`) + ' (without paying its Cost)';
    config.cancellable = true;
    const pick = await engine.promptEffectTarget(pi, validTargets, config);
    if (pick == null) return false;
    if (pick.length === 0 && !config.alwaysConfirmable) return false;
    if (pick.length > 0 && script.validateSelection && !script.validateSelection(pick, validTargets)) return false;
    selectedIds = pick;
  }
  if ((ps.mainDeck || [])[0] !== name) return false;

  // Item Lock: „delete 1 card from your hand to use an Artifact" — wie beim Handspiel (`doUseArtifactEffect`).
  if (ps.itemLocked && (ps.hand || []).length > 0) {
    await engine.actionPromptForceDiscard(pi, 1, {
      title: 'Item Lock Cost',
      description: 'You must delete 1 card from your hand to use an Artifact.',
      source: 'Item Lock', deleteMode: true, selfInflicted: true,
    });
  }

  // ② Die Karte verlässt das Deck (sie darf bei ihrer Wirkung nicht mehr oben liegen — ein „ziehe eine Karte" zöge sonst sie selbst).
  if (!(await engine.takeFromPile(pi, 'deck', 0, { source }))) return false;
  engine.log('free_artifact_played', { player: ps.username, card: name, as: 'artifact', by: source });
  engine._trackTerrorResolvedEffect?.(pi, name);
  const zurueck = () => { ps.mainDeck.unshift(name); engine.sync(); };

  // ③ Kettenfenster + Wirkung (Gratis-Scope erst für die Wirkung selbst: die Reaktionen des Spielers sind nicht gratis)
  let kette;
  try {
    kette = await engine.executeCardWithChain({
      fromBoard: true,   // aus dem DECK gespielt — kein Handspiel (The Master's Plan & Co.)
      cardName: name, owner: pi, cardType: 'Artifact', goldCost: 0,
      resolve: async () => engine.kostenlosSpielen(pi, async () => {
        if (zielend) await engine.gateVorZielen(pi, name, selectedIds, validTargets);
        return script.resolve ? await script.resolve(engine, pi, selectedIds, validTargets) : undefined;
      }),
    });
  } catch (err) {
    console.error('[FreeArtifact] resolve error:', err.stack || err.message);
    kette = { negated: false, chainFormed: false, resolveResult: null };
  }
  await engine._delay(100);

  const rr = kette.resolveResult;
  if (engine.nimmOpferFizzle?.() && rr) { delete rr.aborted; delete rr.cancelled; }   // gerettetes Opfer: fizzelt, ist aber gespielt
  if (!kette.negated && (rr?.aborted || rr?.cancelled)) { zurueck(); return false; }

  // ④ Wohin die Karte danach kommt
  const aufAblage = async (dest) => {
    await gibFrei(engine, pi, key, name, { dest });
    (dest === 'deleted' ? ps.deletedPile : ps.discardPile).push(name);
    engine.sync();
  };
  if (kette.negated) {
    const dieb = kette.negatedToHandOf;
    if (kette.negatedToDeck) {
      await gibFrei(engine, pi, key, name, { dest: 'deck' });
      ps.mainDeck.push(name);
      engine.shuffleDeck(pi);
    } else if (Number.isInteger(dieb) && gs.players[dieb]) {
      await gibFrei(engine, pi, key, name, { dest: 'center' });
      engine.handZugangSync(dieb, name, { source });
      engine._tagHandCardOrigin?.(dieb, name, pi);   // kehrt später zum Besitzer zurück
    } else {
      await aufAblage(kette.negatedToDeleted ? 'deleted' : 'discard');
    }
  } else if (gs._spellPlacedOnBoard) {
    delete gs._spellPlacedOnBoard;                    // die Karte hat sich selbst aufs Brett gelegt
    await gibFrei(engine, pi, key, name, { dest: 'center' });
  } else if (rr?.keepInHand === true && !engine.handZugangGesperrt(pi)) {
    await gibFrei(engine, pi, key, name, { dest: 'hand' });
    engine.handZugangSync(pi, name, { source });
  } else {
    await aufAblage(script.deleteOnUse ? 'deleted' : 'discard');
  }

  // ⑤ Nachlauf — dieselben Sammelpunkte wie beim Handspiel
  if (!kette.negated) {
    try {
      await engine.runHooks('afterArtifactUsed', { artifactName: name, playerIdx: pi, _skipReactionCheck: true });
    } catch (err) { console.error('[FreeArtifact] afterArtifactUsed:', err.message); }
  }
  await engine.runHooks('onAnyActionResolved', {
    actionType: 'artifact', playerIdx: pi, cardName: name, playedCardName: name, heroIdx: -1, _skipReactionCheck: true,
  });
  if (gs._spellEndsTurn) {                            // Open Invitation: „ending your turn"
    delete gs._spellEndsTurn;
    if (!gs.result && [2, 3, 4].includes(gs.currentPhase)) {
      await engine.advanceToPhase(pi, 5, { turnEndSource: { name, owner: pi } });
    }
  }
  engine.sync();
  return 'artifact';
}

async function spieleKostenlos(engine, pi, name, opts = {}) {
  const ps = engine.gs.players[pi];
  const weg = spielweg(engine, pi, name);
  if (!weg || !ps || (ps.mainDeck || [])[0] !== name) return false;
  const key = opts.key;
  const source = opts.source || null;
  return weg === 'equip'
    ? await legeAn(engine, pi, name, key, source)
    : await spieleNormal(engine, pi, name, key, source);
}

module.exports = { spielweg, spieleKostenlos };
