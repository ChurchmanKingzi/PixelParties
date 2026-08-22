// ═══════════════════════════════════════════
//  CARD EFFECT: "Misfire"
//  Spell (Reaction, Lv 1) — Archetyp „Future Tech"
//
//  "Play this card immediately when a player plays an Artifact. Negate
//   that Artifact. That player may then add a copy of that Artifact
//   from their deck to their hand. The next time they play an Artifact
//   with that name this turn, its Cost becomes 0."
//
//  ── Die freundlichste Negation im Spiel ──
//  Sie nimmt das Artefakt weg und gibt es zugleich zurück: eine Kopie
//  aus dem Deck auf die Hand, und der nächste Einsatz kostet nichts.
//  Im Future-Tech-Deck ist das gar kein Verlust, sondern ein Motor —
//  das negierte Artefakt landet in der Ablage und macht jede weitere
//  Kopie stärker. Gegen fremde Decks ist es ein Tempoverlust, gegen
//  das eigene ein Zug.
//
//  ── „a player" heißt: BEIDE Seiten ──
//  Anders als Rusty Touch (nur der Gegner) und The Core's Awakening
//  (nur man selbst) reagiert Misfire auf JEDES Artefakt. Der
//  Nachschub geht an den, dem das Artefakt gehörte — nicht an den
//  Wirker.
//
//  ── Der Nullpreis hängt am NAMEN, nicht an der Kopie ──
//  [Als Ruling 21.8.: „Wird per Misfire ein Artifact negiert, ist es
//   egal, *welche* Kopie dieses Artifacts als nächstes gespielt wird.
//   Das nächste Artifact mit demselben Namen diese Runde hat 0 Kosten,
//   unabhängig vom Index."]
//
//  Meine erste Fassung hängte den Rabatt an den Handindex der frisch
//  nachgezogenen Kopie — falsch. Dafür gibt es jetzt einen eigenen
//  Mechanismus: `ps._freeArtifactNames[name] = true`.
//
//   • Die beiden Kostenrechnungen in server.js ziehen bei einem
//     Treffer den VOLLEN Grundpreis ab.
//   • Verbraucht wird der Eintrag beim tatsächlichen Spielen (an allen
//     drei Zahlstellen), also gilt er genau EINMAL — „the NEXT time".
//   • Gelöscht wird er beim nächsten Zugbeginn, neben
//     `_handCostReductions` — also „this turn".
//   • Für die ANZEIGE übersetzt die Zustandsauslieferung ihn auf jeden
//     Handindex dieses Namens, damit der Spieler auf JEDER Kopie
//     sieht, dass sie gerade nichts kostet.
// ═══════════════════════════════════════════

const CARD_NAME = 'Misfire';

/** Der erste Held, der diese Reaktion wirken darf. */
function wirkenderHeld(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return -1;
  const cd = engine._getCardDB()[CARD_NAME];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
    if (engine.heroMeetsLevelReq(pi, hi, cd)) return hi;
  }
  return -1;
}

module.exports = {
  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const letzte = chainCtx.chain[chainCtx.chain.length - 1];
    // „a player" — eigene UND gegnerische Artefakte.
    if (letzte.cardType !== 'Artifact') return false;
    return wirkenderHeld(gs, pi, engine) >= 0;
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    const gs = engine.gs;
    if (!chain || myIndex === undefined) return;

    const zielIdx = myIndex - 1;
    const ziel = chain[zielIdx];
    if (!ziel || ziel.cardType !== 'Artifact') return;

    const name = ziel.cardName;
    const besitzer = ziel.owner;
    const bps = gs.players[besitzer];

    engine._broadcastEvent('play_zone_animation', {
      type: 'electric_strike', owner: besitzer, heroIdx: -1, zoneSlot: -1,
    });
    await engine._delay(420);

    engine.negateChainLink(chain, zielIdx);
    engine.log('misfire_negate', {
      player: gs.players[pi]?.username, card: name, owner: bps?.username,
    });

    // ── Der Nullpreis gilt UNABHAENGIG vom Nachschub ──
    // Der Kartentext knuepft ihn nicht an „may add a copy": auch wer
    // ablehnt oder keine Kopie im Deck hat, spielt die naechste Karte
    // dieses Namens gratis.
    if (!bps) { engine.sync(); return; }
    bps._freeArtifactNames = bps._freeArtifactNames || {};
    bps._freeArtifactNames[name] = true;

    // ── Nachschub fuer den Besitzer, wenn er will ──
    if (!(bps.mainDeck || []).includes(name)) { engine.sync(); return; }
    if (bps.handLocked) { engine.sync(); return; }

    const frage = await engine.promptGeneric(besitzer, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Your "${name}" was negated. Add a copy from your deck to your hand? Its Cost will be 0 this turn.`,
      confirmLabel: '🔁 Take it',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!frage || frage.cancelled) { engine.sync(); return; }

    await engine.actionAddCardFromDeckToHand(besitzer, name, {
      source: CARD_NAME, reveal: true,
    });

    // Nullpreis auf den NAMEN — siehe Kopf. Gilt fuer jede Kopie, die
    // der Besitzer diese Runde als naechstes davon spielt.
    if (!bps._freeArtifactNames) bps._freeArtifactNames = {};
    bps._freeArtifactNames[name] = true;
    engine.log('misfire_refund', { player: bps.username, card: name, costNow: 0 });
    engine.sync();
  },
};
