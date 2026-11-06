'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Crash Landing"  (W76d)
//  Artifact (Reaction, Cost 4)
//
//  „Play this card immediately when an Artifact is equipped to a Hero. Negate that Artifact and send it to the discard pile."
//
//  ── FENSTER: `isEquipPlacedReaction` (neu, 25.10.) ──────────────────────
//  Hand-Fenster im EINEN Equip-Fenster der Engine (`fireEquipGained`, gerufen vom Hand-Spiel, vom Effekt-Ausrüsten — Darion, Control Device … — und vom Umhängen): sobald ein Artifact
//  liegt und die Passiv-Lauscher gelaufen sind (`engine._checkEquipPlacedHandReactions`), bekommt jeder Spieler mit der Karte auf der Hand das Angebot — auch der Anleger selbst. Nur
//  echte Equipment-Artifacts (`engine.istEquipArtifact`), keine Anhängsel (Attachments), keine Kreaturen. Das Fenster teilt sich Wirker-/Gold-/Reaktions-Maschinerie mit allen
//  Hand-Fenstern (`_rxEreignisFenster`): 4 Gold (die Karte hat keine Schule), Reverse Trap & Co. können sie negieren.
//
//  ── WIRKUNG ─────────────────────────────────────────────────────────────
//  „Negate that Artifact and send it to the discard pile": die Ausrüstung wird sofort wirkungslos (Equip-Passiv/-Buffs fallen mit dem Verlassen der Zone, `onEquipLost`) und über
//  `actionDestroyCard` in den Ablagestapel ihres Besitzers geschickt. Steht die Karte unter einem Schutz (Board-Wächter, Immunität …), bleibt sie liegen — die Reaktion ist dann verbraucht.
//  „Negate" heißt hier nur: der Artifact-Effekt ist weg, nicht „kehrt auf die Hand zurück" (anders als Reverse Trap).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_card_throw` im Modus `crash` (Client, Pixelart): die Ausrüstungskarte wackelt kurz, löst sich, KREISELT (um die Hochachse, ganzzahlige Breitenstufen — keine Drehung des Bildes)
//  und stürzt beschleunigt in den Ablagestapel; am Stapel Staubring und Funken. Der Standardflug zum Stapel wird unterdrückt (die Animation trägt die Karte selbst).
// ═══════════════════════════════════════════

const CARD_NAME = 'Crash Landing';
const FLUG_MS = 860;       // Dauer des Sturzes (deckt sich mit `crash` im Client)
const MONTAGE_MS = 140;    // Vorlauf, bis der Client die Animation eingehängt hat

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isEquipPlacedReaction: true,

  equipPlacedCondition(gs, pi, engine, info) {
    const inst = info?.equipCard;
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (info.kind !== 'equip' || !engine.istEquipArtifact(inst)) return false;
    const cd = engine._getCardDB()[inst.name];
    return !!cd && cd.cardType === 'Artifact';                // ein als Equip angelegter Held ist kein Artifact-KARTE
  },

  async equipPlacedResolve(engine, pi, info) {
    const inst = info?.equipCard;
    if (!inst || inst.zone !== 'support') return;
    const seite = engine.physicalSide(inst);
    const heroIdx = inst.heroIdx, slot = inst.zoneSlot, name = inst.name;
    const ablageBesitzer = inst.originalOwner ?? inst.owner;
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, cardType: 'Artifact' };

    // Kettenanzeige: das Vorlauf-Glied (die ausgerüstete Karte) wird NEGIERT — Glitch + 🚫 wie bei jedem negierten Kettenglied (Index −1 = Vorlauf, siehe `executeCardWithChain({ vorlauf })`).
    if (engine._chainVorlauf) {
      engine._broadcastEvent('reaction_chain_link_negated', { linkIndex: -1, cardName: name, owner: info.equipOwner, negationStyle: null });
      engine.log('card_negated', { card: name, owner: info.equipOwner });
      await engine._delay(700);
    }
    engine._broadcastEvent('play_card_throw', {
      mode: 'crash', cardName: name, fromOwner: seite, fromHeroIdx: heroIdx, fromSlot: slot,
      discardOwner: ablageBesitzer, suppressDiscard: true, duration: FLUG_MS,
    });
    await engine._delay(MONTAGE_MS);
    await engine.actionDestroyCard(quelle, inst, { sourceOwner: pi, sourceName: CARD_NAME, skipPileTransfer: true });
    const weg = inst.zone !== 'support';
    engine.sync();
    await engine._delay(FLUG_MS - MONTAGE_MS);
    engine.log('crash_landing', { player: engine.gs.players[pi]?.username, artifact: name, host: engine.gs.players[seite]?.heroes?.[heroIdx]?.name || null, sent: weg });
    engine.sync();
  },

  /** CPU: nimmt jede Gelegenheit, wenn der GEGNER ausrüstet (eigene Ausrüstung nie opfern). */
  cpuMeta: {
    reactionHeuristic: (engine) => {
      const info = engine._rxFensterInfo;
      return !!info && info.equipOwner !== info.reactorIdx;
    },
  },
};
