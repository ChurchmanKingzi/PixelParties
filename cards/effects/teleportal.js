// ═══════════════════════════════════════════
//  CARD EFFECT: „Teleportal"
//  Spell (Normal, Magic Arts Lv1)
//
//  "Search your deck for a card and place it openly in front of you. At
//   the beginning of your next turn, add it to your hand. If this is
//   the first Spell you use this turn, this counts as an additional
//   Action."
//
//  ── „OPENLY IN FRONT OF YOU" ──────────────────────────────────────
//  ★ Al 14.9.: dieselbe offene Zone wie „Elixir of Immortality". Das
//  ist `ps.permanents` plus eine getrackte Instanz in der Zone
//  'permanent' — die Karte liegt damit sichtbar vor dem Spieler und
//  gehoert weder zur Hand noch zum Brett.
//
//  ★ ABER: die hier abgelegte Karte ist nicht Teleportal selbst,
//  sondern die GESUCHTE. Der Eintrag traegt deshalb einen Stempel
//  (`counters._teleportalUntil`), damit
//    • der Rueckholer sie am Rundenbeginn wiederfindet,
//    • der Client ein Abzeichen zeigen kann („kommt gleich auf die
//      Hand", Als Vorgabe) — ohne den Stempel waere sie optisch ein
//      gewoehnliches Permanent.
//
//  ── „AT THE BEGINNING OF YOUR NEXT TURN" ─────────────────────────
//  Gestempelt wird die ZIELRUNDE, nicht ein Countdown: `gs.turn + 1`.
//  Ein Countdown muesste bei jedem Rundenwechsel heruntergezaehlt
//  werden und geht verloren, wenn ein Effekt Runden ueberspringt.
//
//  ── „IF THIS IS THE FIRST SPELL YOU USE THIS TURN" ───────────────
//  `inherentAction` in Funktionsform. Der Zaehler
//  `ps.spellsPlayedThisTurn` wird vom Server ERHOEHT, BEVOR der Effekt
//  laeuft — zum Zeitpunkt der Pruefung steht er also noch auf 0, wenn
//  Teleportal der erste Zauber ist.
//
//  ── SUCH-SPERRE ──────────────────────────────────────────────────
//  Die Karte sucht im DECK und legt die Karte (verzoegert) auf die
//  Hand. Sie faellt damit unter die Deck-Such-Sperre — die Erkennung
//  greift automatisch, weil `actionAddCardFromDeckToHand` … NICHT
//  benutzt wird. Siehe Kommentar am Ende der Datei.
// ═══════════════════════════════════════════

const CARD_NAME = 'Teleportal';

/**
 * ★★ v1160 — WER HOLT DIE KARTE AB?
 *
 * Die offen liegende Karte ist eine Instanz MIT IHREM EIGENEN NAMEN
 * (z.B. „Fireball") — ihr Skript ist Fireball, nicht Teleportal. Die
 * Rundenhaken von Teleportal liefen deshalb nie an ihr entlang: sie
 * lauschten an `ctx.card`, also an der TELEPORTAL-Instanz. Die liegt
 * nach dem Guss in der Ablage, und `activeIn` kannte die gar nicht —
 * die Karte kam also NIE auf die Hand.
 *
 * Jetzt lauscht Teleportal aus Hand, Ablage und offener Zone und holt
 * beim Rundenhaken ALLE faelligen eigenen Ablagen ab; mehrere Kopien
 * stoeren sich nicht, die zweite findet nichts mehr.
 *
 * @returns {number} wie viele Karten zugestellt wurden
 */
async function zustellenAlleFaelligen(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || !Array.isArray(ps.permanents)) return 0;
  const faellig = ps.permanents.filter(e =>
    typeof e?.teleportalUntil === 'number' && gs.turn >= e.teleportalUntil);
  if (faellig.length === 0) return 0;

  // ★ v1161 (Al 17.9.): Auftritt beim Abholen — dieselbe Bauart wie bei
  // „Sas'Za": das Kartenbild wird gestreamt, wenn der Effekt wirklich
  // ausloest.
  await engine.announceHookActivation(CARD_NAME, pi);

  let zugestellt = 0;
  for (const eintrag of faellig) {
    const idx = ps.permanents.findIndex(p => p.id === eintrag.id);
    if (idx < 0) continue;
    // ★ v1161: Der Flug startet in der OFFENEN ZONE, nicht in der Hand.
    // Ohne diesen Broadcast rate der Client die Herkunft aus dem
    // Handzuwachs — und liess die Karte aus der GEGNER-Hand starten.
    // `fromPermId` ist die Id des Permanent-Eintrags (`data-perm-id`).
    // ★ v1162 (Al 17.9.: „endet in der Mitte der Hand"): OHNE Zielplatz
    // faellt der Client auf den Handkasten zurueck und landet in dessen
    // Mitte. `toHandIdx` ist der Platz, auf den die Karte gleich gelegt
    // wird (ans Ende), `finalHandSize` die Handgroesse DANACH — die
    // Hand ist zentriert, der Zielpunkt haengt also an beiden Zahlen.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: eintrag.name,
      from: 'permanent', to: 'hand',
      fromPermId: eintrag.id,
      toHandIdx: ps.hand.length,
      finalHandSize: ps.hand.length + 1,
    });
    ps.permanents.splice(idx, 1);
    const inst = engine.cardInstances.find(c =>
      c.zone === 'permanent' && c.owner === pi && c.counters?.permId === eintrag.id);
    if (inst) {
      delete inst.counters._teleportalUntil;
      inst.zone = 'hand';
    }
    // ★ Ueber den kanonischen Weg auf die Hand — er traegt die
    // Handsperren und den Flug mit.
    const ok = engine.actionAddCardToHand(pi, eintrag.name, CARD_NAME);
    engine.log('teleportal_return', {
      player: ps.username, card: eintrag.name, blocked: ok === false,
    });
    zugestellt++;
  }
  if (zugestellt) engine.sync();
  return zugestellt;
}


module.exports = {
  // v1160: auch aus der ABLAGE — dort liegt die Karte, wenn ihre
  // offene Karte abgeholt werden muss.
  activeIn: ['hand', 'permanent', 'discard'],

  /**
   * „If this is the first Spell you use this turn, this counts as an
   * additional Action."
   */
  inherentAction(gs, pi) {
    return (gs.players[pi]?.spellsPlayedThisTurn || 0) === 0;
  },

  spellPlayCondition(gs, pi) {
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps || (ps.mainDeck || []).length === 0) { gs._spellCancelled = true; return; }

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        // ★ v1118: JA, eine Hand-Suche — die Karte landet zwar erst am
        // naechsten Rundenbeginn auf der Hand, aber der Ertrag IST eine
        // Deck-Suche auf die Hand (siehe `blockedBySearchLock` oben).
        searchToHand: true,
        searchPile: 'deck',
        title: CARD_NAME,
        description: 'Choose a card from your deck. It is placed openly in front of you and joins your hand at the start of your next turn.',
        // ★ v1159: Eintraege statt roher Namen — dedupliziert mit
        // Anzahl, wie bei „Magnetic Glove". (Die Engine faengt rohe
        // Namen seit v1159 zwar ab, aber die Karte liefert das Format
        // jetzt selbst.)
        cards: (() => {
          const anzahl = new Map();
          for (const n of ps.mainDeck) anzahl.set(n, (anzahl.get(n) || 0) + 1);
          return [...anzahl.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, count]) => ({ name, source: 'deck', count }));
        })(),
        cancellable: true,
      });
      const name = wahl?.cardName;
      if (!name) { gs._spellCancelled = true; return; }

      // Stapel-Schicht (v820): nie per splice.
      const genommen = await engine.takeFromPile(pi, 'deck', name, { source: CARD_NAME });
      if (!genommen) { gs._spellCancelled = true; return; }

      // Offen ablegen — Bauform von „Elixir of Immortality".
      if (!ps.permanents) ps.permanents = [];
      const permId = 'perm-' + Date.now() + '-' + Math.random();
      const faelligIn = gs.turn + 1;   // „at the beginning of your NEXT turn"
      ps.permanents.push({ name, id: permId, teleportalUntil: faelligIn });

      const inst = engine._trackCard(name, pi, 'permanent', -1, -1);
      inst.counters.permId = permId;
      // ★ Der Stempel traegt die ZIELRUNDE, nicht einen Countdown.
      inst.counters._teleportalUntil = faelligIn;

      // Beide Seiten sehen die Karte — „openly".
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: name });
      }

      // ★ v1161 (Al 17.9.): dunkel-lilaner Portal-Wirbel AUF der frisch
      // offen gelegten Karte. Erst den Spielstand senden, damit ihr
      // Kasten im Client existiert — die Animation haengt an
      // `data-perm-id`.
      engine.sync();
      await engine._delay(120);
      engine._broadcastEvent('play_zone_animation', {
        type: 'portal_warp', zoneType: 'permanent', permId,
        owner: pi, heroIdx: -1, zoneSlot: -1, duration: 1200,
      });
      await engine._delay(700);

      engine.log('teleportal_place', {
        player: ps.username, card: name, until: faelligIn,
      });
      engine.sync();
    },

    /**
     * „At the beginning of your next turn, add it to your hand."
     * (v1163: der temporaere Testschalter fuers Zugende ist wieder raus.)
     */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (engine.gs.activePlayer !== pi) return;   // „YOUR next turn"
      await zustellenAlleFaelligen(engine, pi);
    },
  },
};

// ── SUCH-SPERRE: bewusst als eigene Flagge ───────────────────────────
// Die Autoerkennung sieht hier keinen der bekannten Hand-Add-Wege:
// Teleportal holt per `takeFromPile` OHNE `toHand` (die Karte geht ja
// zunaechst in die offene Zone, nicht auf die Hand) und legt sie erst
// eine Runde spaeter ueber `actionAddCardToHand` nach — den generischen
// Weg, der bewusst NICHT als Deck-Suche zaehlt (Gold Trap holt damit vom
// Brett, Als Gruppe D).
//
// Der Ertrag der Karte ist aber genau eine Deck-Suche auf die Hand.
// Unter der Such-Sperre waere sie wirkungslos, also ist sie dort nicht
// spielbar (Als Ruling 14.9., Gruppe A).
module.exports.blockedBySearchLock = true;
