// ═══════════════════════════════════════════
//  CARD EFFECT: "Krates, the Smartass"
//  Hero — 400 HP / 40 ATK (Premonition + Wisdom) — PP MS1
//
//  „Whenever an effect would allow your opponent to search their deck
//   for a card and add it to their hand, they must search for up to 3
//   appropriate cards with different names instead, if possible, and
//   reveal them. You pick one of them to add to your hand, then pick one
//   to add to their hand. The remaining card is deleted."
//
//  ── WIE ES EINGEHÄNGT IST ─────────────────────────────────────────
//  Vertrag `interceptsOppDeckSearch` (Engine: `_checkOppDeckSearchInterceptors`,
//  gerufen aus `actionAddCardFromDeckToHand` — dem Tor, durch das jede
//  Deck→Hand-Suche läuft; dasselbe Fenster wie Cybug BEE). Die Karte ist
//  zu diesem Zeitpunkt vom Suchenden schon gewählt und liegt noch im Deck.
//
//  ── AUSLEGUNG (Als Vorgabe) ───────────────────────────────────────
//  • Nur Tutor-Effekte für normalerweise EXAKT EINE Karte. Mehrfach-Tutoren
//    (Divine Gift of Creation, Spider Dance, Trial of Loyalty …) melden
//    `_noKrates: true` an `actionAddCardFromDeckToHand` und bleiben unberührt.
//  • Die zuerst gewählte Karte zählt als eine der bis zu 3. Der Suchende
//    wählt dazu bis zu 2 weitere „appropriate" Karten mit anderen Namen aus
//    seinem Deck — „appropriate" = die Suchvorgabe der Karte (`searchSpec`,
//    sonst die Kartenart der gewählten Karte, wie bei Koperniko). Gibt es
//    weniger passende Karten, sucht er so viele wie möglich („if possible").
//  • REIHENFOLGE ist der Effekt: die ERSTE Karte geht an den Krates-Spieler.
//      1 Karte  → sie geht direkt an den Krates-Spieler;
//      2 Karten → eine für ihn (seine Wahl), die andere an den Suchenden;
//      3 Karten → eine für ihn, eine (seine Wahl) für den Suchenden, die
//                 dritte wird gelöscht.
//  • Die Karte des Krates-Spielers stammt aus dem Deck des Suchenden
//    (`originalOwner` = Suchender: Ablage/Gelöscht-Stapel gehen zurück).
//  • Wirkt nur gegen den GEGNER des Krates-Spielers, solange Krates lebt und
//    nicht eingefroren/betäubt/negiert ist; ist die Hand des Krates-Spielers
//    gesperrt, greift er nicht ein.
//  • Der Suchende mischt danach sein Deck (macht der Aufrufer, wie sonst).
//
//  ── ANZEIGE (wie Magic Lamp) ──────────────────────────────────────
//  Die Auswahl des Krates-Spielers läuft über die `cardGallery` der
//  aufgedeckten Karten; jede Karte fliegt einzeln aus dem Deck zu ihrem
//  Empfänger (`deck_search_add`), die gelöschte in den Gelöscht-Stapel.
// ═══════════════════════════════════════════

const { hasCardType, baseCardName } = require('./_hooks');
const { HOOKS } = require('./_hooks');

const CARD_NAME = 'Krates, the Smartass';
const MAX_CARDS = 3;

/** Kartenart-Rückfall für Tutoren ohne eigene `searchSpec` (wie Koperniko). */
function artFilter(cardDB, vorbildName) {
  const art = cardDB[vorbildName]?.cardType || null;
  if (!art) return { label: 'card', filter: null };
  return { label: art, filter: (cd) => hasCardType(cd, art) };
}

/** Wert einer Karte für die CPU-Entscheidungen (höher = besser). */
function kartenWert(engine, pi, name) {
  try {
    if (typeof engine.estimateHandCardValueFor === 'function') return engine.estimateHandCardValueFor(pi, name) || 0;
  } catch { /* Rückfall unten */ }
  const cd = engine._getCardDB()?.[name];
  return (cd?.level || 0);
}

module.exports = {
  activeIn: ['hero'],
  interceptsOppDeckSearch: true,

  /**
   * @returns {Promise<boolean>} true = Suche vollständig erledigt
   */
  async interceptOppDeckSearch(engine, { searcher: pi, holder: k, heroIdx, firstName, opts }) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const kp = gs.players[k];
    if (!ps || !kp || gs.result) return false;
    if (engine.handZugangGesperrt(k)) return false;       // der Krates-Spieler darf keine Karten auf die Hand nehmen

    const cardDB = engine._getCardDB();
    const spec = opts?.searchSpec || artFilter(cardDB, firstName);

    // ── Kandidaten für die Zusatzkarten: anderer Name, passende Vorgabe ──
    const gesehen = new Set([baseCardName(firstName)]);
    const zaehler = {};
    for (const n of (ps.mainDeck || [])) zaehler[n] = (zaehler[n] || 0) + 1;
    const kandidaten = [];
    for (const n of Object.keys(zaehler).sort((a, b) => a.localeCompare(b))) {
      const b = baseCardName(n);
      if (gesehen.has(b)) continue;
      const cd = cardDB[n];
      if (!cd) continue;
      if (spec.filter && !spec.filter(cd, n)) continue;
      gesehen.add(b);
      kandidaten.push(n);
    }
    const extraMax = Math.min(MAX_CARDS - 1, kandidaten.length);

    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: k });

    // ── 1. Der Suchende wählt die weiteren Karten (Pflicht, so viele wie möglich) ──
    let extras = [];
    if (extraMax > 0) {
      const antwort = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        menuSource: CARD_NAME,
        role: 'krates-search',
        cards: kandidaten.map(name => ({ name, source: 'deck', count: zaehler[name] })),
        selectCount: extraMax,
        minSelect: extraMax,
        title: CARD_NAME,
        description: `${CARD_NAME} forces you to search for ${extraMax === 1 ? '1 more card' : `${extraMax} more cards`} with different names (${spec.label}) from your deck. They will be revealed to your opponent, who picks what you get.`,
        confirmLabel: '🔍 Reveal!',
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      const gewaehlt = Array.isArray(antwort?.selectedCards) ? antwort.selectedCards : [];
      const ok = [];
      const bases = new Set();
      for (const n of gewaehlt) {
        if (typeof n !== 'string' || !kandidaten.includes(n)) continue;
        const b = baseCardName(n);
        if (bases.has(b)) continue;
        bases.add(b);
        ok.push(n);
      }
      // Fehlende/ungültige Antwort: auffüllen, die Suche ist Pflicht.
      for (const n of kandidaten) {
        if (ok.length >= extraMax) break;
        if (!ok.includes(n) && !bases.has(baseCardName(n))) { ok.push(n); bases.add(baseCardName(n)); }
      }
      extras = ok.slice(0, extraMax);
    }
    const offen = [firstName, ...extras];
    for (const n of offen) {
      engine.noteKnownCard(k, n, 'deck');
    }

    // ── 2. Der Krates-Spieler wählt: erst seine Karte, dann die des Suchenden ──
    const waehle = async (liste, role, beschr) => {
      if (liste.length === 1) return liste[0];
      const antwort = await engine.promptGeneric(k, {
        type: 'cardGallery',
        role,
        cards: liste.map(name => ({ name, source: 'revealed' })),
        title: CARD_NAME,
        description: beschr,
        cancellable: false,                  // der Krates-Spieler MUSS wählen
      });
      const n = antwort?.cardName;
      return (typeof n === 'string' && liste.includes(n)) ? n : liste[0];
    };

    const fuerKrates = await waehle(offen, 'krates-take', offen.length === 1
      ? 'Add this card to your hand.'
      : `${ps.username} had to reveal ${offen.length} cards. Choose 1 to add to YOUR hand${offen.length === 3 ? ' — then you choose which of the others goes to your opponent; the last one is deleted' : '; the other goes to your opponent'}.`);
    let rest = offen.filter((n, i) => i !== offen.indexOf(fuerKrates));
    let fuerSucher = null;
    if (rest.length > 0) {
      fuerSucher = await waehle(rest, 'krates-give',
        `Choose 1 of these to add to ${ps.username}'s hand${rest.length > 1 ? '. The remaining card is deleted' : ''}.`);
      rest = rest.filter((n, i) => i !== rest.indexOf(fuerSucher));
    }
    const geloescht = rest[0] || null;

    // ── 3. Ausführen: jede Karte fliegt einzeln aus dem Deck ──
    const nimm = async (name) => !!(await engine.takeFromPile(pi, 'deck', name, { source: CARD_NAME }));

    if (await nimm(fuerKrates)) {
      engine._broadcastEvent('card_reveal', { cardName: fuerKrates });
      engine._broadcastEvent('deck_search_add', { cardName: fuerKrates, playerIdx: k });
      // Karte aus dem Deck des Gegners: weder Suche noch „from your deck" (fremdesDeck) —
      // aber „add to hand"; bei ihrem Weg in eine Ablage geht sie an den Besitzer zurück.
      engine.handZugangSync(k, fuerKrates, { source: CARD_NAME, originalOwner: pi, von: 'fremdesDeck' });
      engine.sync();
      await engine._delay(650);
    }
    if (fuerSucher && await nimm(fuerSucher)) {
      engine._broadcastEvent('card_reveal', { cardName: fuerSucher });
      engine._broadcastEvent('deck_search_add', { cardName: fuerSucher, playerIdx: pi });
      const inst = engine.handZugangSync(pi, fuerSucher, { source: CARD_NAME });
      await engine.runHooks(HOOKS.ON_CARD_ADDED_TO_HAND, {
        playerIdx: pi, card: inst, cardName: fuerSucher, addedCard: inst, addedCardName: fuerSucher,
      });
      engine.sync();
      await engine._delay(650);
    }
    if (geloescht && await nimm(geloescht)) {
      await engine.actionDeleteFromDeckAnimated(pi, [geloescht], { source: CARD_NAME });
    }
    if (opts?.shuffle) engine.shuffleDeck(pi, 'main');

    engine.log('krates_search', {
      player: ps.username, krates: kp.username, offered: offen.slice(),
      kratesTook: fuerKrates, searcherGot: fuerSucher, deleted: geloescht,
    });
    engine.sync();
    return true;
  },

  /**
   * CPU: der Krates-Spieler nimmt den besten und gibt den schlechtesten
   * weg; ein CPU-Suchender legt als Beigabe die wertlosesten Karten dazu.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload?.role?.startsWith?.('krates-')) return undefined;
    const pi = engine._cpuPlayerIdx;
    const cards = (payload.cards || []).map(c => c.name);
    if (payload.type === 'cardGallery') {
      const wert = (n) => kartenWert(engine, pi, n);
      const sortiert = cards.slice().sort((a, b) => wert(b) - wert(a));
      return { cardName: payload.role === 'krates-give' ? sortiert[sortiert.length - 1] : sortiert[0] };
    }
    if (payload.type === 'cardGalleryMulti') {
      const wert = (n) => kartenWert(engine, pi, n);
      const sortiert = cards.slice().sort((a, b) => wert(a) - wert(b));   // Beigabe: die schwächsten
      return { selectedCards: sortiert.slice(0, payload.selectCount || 1) };
    }
    return undefined;
  },
};
