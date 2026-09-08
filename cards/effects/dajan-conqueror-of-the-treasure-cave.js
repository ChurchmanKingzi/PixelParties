// ═══════════════════════════════════════════
//  CARD EFFECT: "Dajan, Conqueror of the Treasure Cave"
//  Ascended Hero — 700 HP, 120 ATK — Ascension bonus:
//  "Any 2 Artifacts to your hand"
//
//  "You must play this Hero from your hand on top of a 'Legendary
//   Explorer Dajan' you control while you have 60 or more Gold.
//   You may once per turn play an Artifact with a set Cost from your
//   hand without paying its Cost."   (Text verschaerft 30.8.: Artefakte
//   mit selbstgerechneten Kosten — `manualGoldCost` — sind ausgenommen.)
//
//  ── AUFSTIEG ───────────────────────────────────────────────────────
//  `ascensionCondition`: Basis-Dajan lebt und der Spieler hat >= 60
//  Gold. Die Anzeige-Flags pflegt der Basisheld ueber
//  `refreshAscensionReadiness` (sync-getrieben, v656), weil Gold an
//  keiner Zone haengt. Bonus: zwei verschiedene Artefakte aus dem Deck
//  auf die Hand — Beato-Muster (cardGalleryMulti, Sammel-Reveal).
//
//  ── HELDENEFFEKT (Als UX-Vorgabe 30.8.) ───────────────────────────
//  Aktiv, per Klick auf Dajan: die Engine stellt den Gratis-Kauf
//  scharf (`armFreeArtifact`) — der Client graut alle Handkarten
//  ausser Artefakten aus und zeigt bei jedem Artefakt Cost 0; der
//  Server laesst nur noch Artefakte durch und zieht an den drei
//  Zahlstellen den vollen Preis ab. Beim tatsaechlichen Spielen loest
//  `consumeFreeArtifact` ein und setzt ERST DANN den HOPT-Stempel
//  dieses Heldeneffekts. Deshalb liefert `onHeroEffect` immer `false`:
//  ein Klick allein darf den Effekt nicht verbrauchen. Ein zweiter
//  Klick auf Dajan entschaerft.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Dajan, Conqueror of the Treasure Cave';
const BASE_FORM = 'Legendary Explorer Dajan';
const ASCEND_GOLD = 60;

/** Gibt es ein Artefakt auf der Hand? (Sonst ist Scharfstellen sinnlos.) */
function artifactInHand(ps, cardDB) {
  return (ps.hand || []).some(n => hasCardType(cardDB[n], 'Artifact'));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  ascensionCondition(gs, pi, heroIdx, _engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.name !== BASE_FORM) return false;
    return (gs.players[pi].gold || 0) >= ASCEND_GOLD;
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;
    if (ps.handLocked) {
      engine.log('dajan_ascension_handlocked', { player: ps.username });
      return;
    }
    const cardDB = engine._getCardDB();
    const seen = new Set();
    const galleryCards = [];
    for (const n of (ps.mainDeck || [])) {
      if (seen.has(n)) continue;
      if (!hasCardType(cardDB[n], 'Artifact')) continue;
      seen.add(n);
      galleryCards.push({ name: n, source: 'deck' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));
    if (galleryCards.length === 0) return;

    const maxPicks = Math.min(2, galleryCards.length);
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: galleryCards,
      selectCount: maxPicks,
      minSelect: 1,
      title: 'Ascension Bonus — Treasure Cave',
      source: CARD_NAME,
      description: `Choose up to ${maxPicks} different Artifact${maxPicks > 1 ? 's' : ''} from your deck to add to your hand.`,
      confirmLabel: '💎 Claim!',
      confirmClass: 'btn-success',
      cancellable: false,
    });
    const chosen = result?.selectedCards || [];
    if (chosen.length === 0) return;

    // Eine nach der anderen, mit kurzer Pause — wie die gestaffelten
    // Mehrfach-Ziehungen (Als Vorgabe 30.8.); der Sammel-Reveal folgt.
    for (const name of chosen) {
      if (ps.mainDeck.indexOf(name) < 0) continue;
      await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: false });
      await engine._delay(400);
    }
    engine.shuffleDeck(pi);
    await engine.revealSearchedCards(pi, chosen, CARD_NAME);
  },

  /**
   * CPU: NICHT ueber die Heldeneffekt-Schleife — die wuerde den Riegel
   * im naechsten Durchlauf wieder entschaerfen oder scharf liegen
   * lassen (alle Nicht-Artefakt-Zuege bis Zugende gesperrt). Statt-
   * dessen pilotiert `playArtifacts` in _cpu.js (v657) den Kauf selbst:
   * scharf stellen unmittelbar vor dem teuersten planbaren Artefakt
   * mit festem Preis, Entschaerfen an jedem Ausgang ohne Kauf. Das
   * Flag `cpuFreeArtifactPilot` meldet dort die Faehigkeit an.
   */
  cpuFreeArtifactPilot: true,
  cpuShouldUseHeroEffect() {
    return false;
  },

  // Scharfstellen nur, wenn ein Artefakt auf der Hand liegt; das
  // Entschaerfen (bereits scharf) ist immer moeglich. HOPT prueft die
  // Engine ueber den Stempel, den `consumeFreeArtifact` setzt.
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const armed = engine.freeArtifactArmed(pi);
    if (armed && armed.heroIdx === ctx.cardHeroIdx) return true;
    if (armed) return false;
    const ps = engine.gs.players[pi];
    return !!ps && artifactInHand(ps, engine._getCardDB());
  },

  /**
   * Immer `false`: der Klick verbraucht den Effekt nicht — das tut
   * erst das gespielte Artefakt (siehe Kopf).
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const armed = engine.freeArtifactArmed(pi);
    if (armed && armed.heroIdx === heroIdx) {
      engine.disarmFreeArtifact(pi);
      engine.log('free_artifact_disarmed', { player: ps.username, hero: CARD_NAME });
      engine.sync();
      return false;
    }
    if (armed) return false;
    if (!artifactInHand(ps, engine._getCardDB())) return false;

    engine.armFreeArtifact(pi, heroIdx, CARD_NAME);
    engine.log('free_artifact_armed', { player: ps.username, hero: CARD_NAME });
    // Erst syncen — die Hand soll SOFORT waehlbar sein —, dann Glow +
    // Klang ohne zu warten (der Glow wartet sonst 500 ms).
    engine.sync();
    engine.effectSourceGlow(pi, CARD_NAME, { sfx: 'shop_purchase' });
    return false;
  },
};
