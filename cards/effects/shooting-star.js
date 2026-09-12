// ═══════════════════════════════════════════
//  CARD EFFECT: „Shooting Star"
//  Spell (Support Magic Lv1, Normal)
//
//  „Choose a card from your discard pile and add it to your hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · „a card" heisst JEDE Karte — kein Typfilter. Magic Sapphire ist
//    dieselbe Bauart, nur auf Spells beschraenkt; dieses Skript folgt
//    ihm, laesst die Einschraenkung aber weg.
//  · Shooting Star selbst liegt beim Aufloesen noch NICHT in der
//    Ablage (die Karte wandert erst nach der Aufloesung dorthin), kann
//    sich also nicht selbst zurueckholen. Eine ZWEITE Kopie in der
//    Ablage ist dagegen ein gueltiges Ziel — der Text verbietet nichts.
//  · Ohne Karte in der eigenen Ablage bewirkt die Karte nichts und
//    bleibt in der Hand grau (`spellPlayCondition`).
//  · `blockedByPileLock` (Stapel-Ausgangssperre, v826): Der EINZIGE
//    Effekt ist eine Entnahme aus der Ablage — unter der Sperre ist die
//    Karte damit gar nicht spielbar, nicht bloss wirkungslos. Der
//    Loader erkennt diese Bauart selbst; die Fahne steht hier
//    ausdruecklich, damit sie nicht an einer Heuristik haengt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Shooting Star';

/** Entduplizierte Galerie der eigenen Ablage, mit Stueckzahl. */
function galerie(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const zaehler = {};
  for (const name of (ps.discardPile || [])) {
    zaehler[name] = (zaehler[name] || 0) + 1;
  }
  return Object.keys(zaehler)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: 'discard', count: zaehler[name] }));
}

module.exports = {
  activeIn: ['hand'],
  blockedByPileLock: true,

  spellPlayCondition(gs, playerIdx) {
    return (gs.players[playerIdx]?.discardPile || []).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      const karten = galerie(gs, pi);
      if (karten.length === 0) return;

      // Eine einzige Karte: keine Rueckfrage, sie ist die Wahl.
      let gewaehlt = karten.length === 1 ? karten[0].name : null;
      if (!gewaehlt) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: karten,
          title: CARD_NAME,
          description: 'Choose a card from your discard pile to add to your hand.',
          confirmLabel: '🌠 Take',
          cancellable: false,
        });
        if (!wahl?.cardName) return;
        gewaehlt = wahl.cardName;
      }

      const genommen = await engine.takeFromPile(ps, 'discard', gewaehlt, { source: CARD_NAME });
      if (!genommen) return;

      // ── BEIDE FLUEGE GLEICHZEITIG (v893, Als Vorgabe) ─────────────
      // Shooting Star geht zur Ablage, die gewaehlte Karte kommt von
      // dort — die beiden sollen sich unterwegs kreuzen. Also erst
      // BEIDE Fluege losschicken, dann EINMAL warten, dann umbuchen.
      //
      // Der Zielplatz braucht Sorgfalt: Shooting Star liegt noch in der
      // Hand und raeumt ihren Platz gerade. Die Hand ist hinterher also
      // genauso gross wie jetzt (`finalHandSize`), und die neue Karte
      // haengt sich hinten an — nach dem Abgang ist das der LETZTE
      // Platz. Dass der Client den Landeplatz waehrenddessen ausblendet,
      // ist hier genau richtig: dort liegt Shooting Star, und die
      // fliegt in diesem Moment selbst als Karte heraus.
      const eigenerIdx = (ps.hand || []).indexOf(CARD_NAME);
      const endGroesse = ps.hand.length;            // Abgang + Zugang = gleich
      const zielIdx = Math.max(0, endGroesse - 1);  // hinten angehaengt

      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME,
        from: 'hand', to: 'discard', asPlay: 'sole',
        fromHandIdx: eigenerIdx >= 0 ? eigenerIdx : 0,
      });
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: gewaehlt, from: 'discard', to: 'hand',
        toHandIdx: zielIdx, finalHandSize: endGroesse,
      });
      await engine._delay(650);

      ps.hand.push(gewaehlt);
      engine._broadcastEvent('card_reveal', { cardName: gewaehlt, playerIdx: pi });
      await engine.runHooks('onCardAddedFromDiscardToHand', {
        playerIdx: pi, cardName: gewaehlt,
        addedCardName: gewaehlt,
        _skipReactionCheck: true,
      });

      engine.log('shooting_star', { player: ps.username, card: gewaehlt });
      engine.sync();
    },
  },

  // Die CPU nimmt den ersten Eintrag; ohne Antwort liefe die nicht
  // abbrechbare Galerie ins Leere.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    const erste = (promptData.cards || [])[0];
    return erste ? { cardName: erste.name, source: erste.source } : undefined;
  },
};
