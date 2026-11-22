// ═══════════════════════════════════════════
//  CARD EFFECT: "Shard of Chaos"
//  Artifact (Normal, Cost 4)
//
//  Delete 1-3 cards from hand, then retrieve
//  the same number of cards of the same types
//  from the discard pile. Shard is deleted.
//
//  Attack/Spell/Creature count as one type
//  ("Action"). Ability, Artifact, Potion, Hero
//  are separate types.
//  Spielgestalter-Entscheidung 17.11.2026 (Karte 30): „Hero" und „Ascended Hero" bilden EINE Typgruppe (Kartentext:
//  „Hero/Ascended Hero") — ein Ascended Hero auf der Hand kann gegen einen normalen Hero aus der Ablage getauscht werden
//  und umgekehrt. Die Gruppierung steckt in `normalizeType`; Client-Obergrenzen (`cardTypes`/`typeLimits` des Prompts) kommen
//  vom Server, der Client rechnet nichts selbst.
//  Spielgestalter-Entscheidung 17.11.2026 (Karte 31): der SERVER erzwingt dieselbe Grenze wie der Client („the same number of
//  cards of the same type"): die Handwahl wird gegen die Ablage-Obergrenze je Typgruppe, gegen die angebotenen Handkarten und
//  gegen die Höchstzahl geprüft (`pruefeHandwahl`); ein Verstoß (veränderter Client) wird abgelehnt und neu gefragt, nach dem
//  dritten Versuch bricht die Karte ab (nichts gelöscht, Karte bleibt auf der Hand). CPU/Rollouts werden auf das Zulässige gekürzt.
//  Welle 12 (Q100, Al: „Ergänze Attack/Spell/Creature im Text. Ein
//  Topf."): Kreaturen bleiben im selben Topf wie Attack/Spell; der
//  Kartentext in `data/cards.json` nennt jetzt „Attack/Spell/Creature".
//  Welle 12 (Q97, Al: „Nicht spielbar."): unter der harten Ablage-
//  Ausgangssperre (Stäbe) ist die Karte nicht spielbar (`canActivate`).
//
//  Al 29.10.: Gelöscht werden BIS ZU 3 Karten — aber danach muss man EXAKT so viele Karten
//  aus der Ablage wählen, wie man gelöscht hat (je Typ; die Handwahl begrenzt die Zahl je
//  Typ auf das, was die Ablage hergibt, es gibt also immer genug). Die Rückholwahl war eine
//  Einzelwahl (`cardGallery`: ein Klick beendet sie, `selectCount` wurde nicht beachtet); jetzt
//  `cardGalleryMulti` mit `minSelect = selectCount`, jede Kopie ein eigener Eintrag.
// ═══════════════════════════════════════════

const { getCardDB } = require('./_card-db');

const ACTION_TYPES = new Set(['Attack', 'Spell', 'Creature']);
const HERO_TYPES = new Set(['Hero', 'Ascended Hero']);   // Spielgestalter-Entscheidung 17.11.2026: EINE Typgruppe

function normalizeType(cardType) {
  if (ACTION_TYPES.has(cardType)) return 'Action';
  if (HERO_TYPES.has(cardType)) return 'Hero';
  return cardType;
}

const TYP_ANZEIGE = { Action: 'Attack/Spell/Creature', Hero: 'Hero/Ascended Hero' };

/**
 * Serverseitige Prüfung der Handwahl (Spielgestalter-Entscheidung 17.11.2026, Karte 31): nur angebotene Handkarten, keine Doppelten, je Typgruppe höchstens so viele,
 * wie die Ablage hergibt (`discardTypeCounts`), insgesamt höchstens `maxSelect`. Typ und Name kommen aus dem Spielstand, nie aus der Antwort.
 * @returns {{ ok: boolean, gueltig: Array<{handIndex:number, cardName:string}> }} `gueltig` = die Wahl, auf das Zulässige gekürzt (Reihenfolge der Antwort).
 */
function pruefeHandwahl(ps, selectedCards, eligibleIndices, discardTypeCounts, maxSelect, cardDB) {
  const eligible = new Set(eligibleIndices);
  const gesehen = new Set();
  const frei = { ...discardTypeCounts };
  const gueltig = [];
  let ok = Array.isArray(selectedCards);
  for (const sel of (Array.isArray(selectedCards) ? selectedCards : [])) {
    const hi = sel?.handIndex;
    const cd = Number.isInteger(hi) ? cardDB[ps.hand[hi]] : null;
    const nt = cd ? normalizeType(cd.cardType) : null;
    if (!cd || !eligible.has(hi) || gesehen.has(hi) || (frei[nt] || 0) <= 0 || gueltig.length >= maxSelect) { ok = false; continue; }
    gesehen.add(hi);
    frei[nt]--;
    gueltig.push({ handIndex: hi, cardName: ps.hand[hi] });
  }
  return { ok, gueltig };
}

module.exports = {
  // W64b: kein `deferBroadcast` mehr — der Auftritt kommt zentral (Auftritts-Puffer) VOR dem ersten Effektschritt, nach der letzten abbrechbaren Wahl.
  deleteOnUse: true,

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    // Z6 (F02-13): der Ertrag kommt aus der ABLAGE - harte Stab-Sperre, Stapel-Sperre (Knight of Kings [B]) und Hand-/starke
    // Such-Sperre machen die Karte wirkungslos (die geloeschten Handkarten waeren die reinen Kosten).
    if (engine) {
      if (engine.isDiscardOutHardLocked?.(pi)) return false;
      if (!engine.pileOutAllowed?.(pi, 'discard', { sourceOwner: pi })) return false;
      if (engine._isSearchBlocked?.(pi, {}, 'discard')) return false;
    }
    // Need 2+ cards in hand (Shard + at least 1 other)
    if ((ps.hand || []).length < 2) return false;
    // At least 1 hand card (not Shard) whose normalized type exists in discard
    const discardTypes = new Set();
    for (const cn of (ps.discardPile || [])) {
      const cd = getCardDB()[cn];
      if (cd) discardTypes.add(normalizeType(cd.cardType));
    }
    if (discardTypes.size === 0) return false;
    for (let i = 0; i < ps.hand.length; i++) {
      const cn = ps.hand[i];
      if (cn === 'Shard of Chaos') continue;
      const cd = getCardDB()[cn];
      if (cd && discardTypes.has(normalizeType(cd.cardType))) return true;
    }
    return false;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const cardDB = getCardDB();

    // ── Build discard type counts ──
    const discardTypeCounts = {};
    for (const cn of (ps.discardPile || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      discardTypeCounts[nt] = (discardTypeCounts[nt] || 0) + 1;
    }

    // ── Build eligible hand indices (ALL cards whose type exists in discard) ──
    const resolveHi = ps._resolvingCard ? ps.hand.findIndex((c, i) => {
      if (c !== ps._resolvingCard.name) return false;
      const nth = ps.hand.slice(0, i + 1).filter(x => x === c).length;
      return nth === ps._resolvingCard.nth;
    }) : -1;

    const eligibleIndices = [];
    const cardTypes = {}; // handIndex → normalizedType
    for (let i = 0; i < ps.hand.length; i++) {
      if (i === resolveHi) continue; // Skip Shard itself
      const cn = ps.hand[i];
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      if ((discardTypeCounts[nt] || 0) > 0) {
        eligibleIndices.push(i);
        cardTypes[i] = nt;
      }
    }

    if (eligibleIndices.length === 0) return { cancelled: true };

    // Z6 (F02-13): Ablage-Ausgang VOR dem Loeschen klaeren (Stab-/Eye-of-Ren-Sperre, beide hart: gesperrt = sauberer
    // Abbruch, Karte bleibt in der Hand) - sonst waeren die Handkarten schon geloescht, wenn die Ablage zubleibt.
    if (!(await engine._discardOutAllowed(pi, { source: 'Shard of Chaos' }))) return { cancelled: true };

    // ── Step 1: Hand Pick prompt ──
    const maxSelect = Math.min(3, eligibleIndices.length);
    // Spielgestalter-Entscheidung 17.11.2026 (Karte 31): der Server prüft die Wahl gegen die Ablage-Obergrenze je Typgruppe (nicht nur der Client). Ein Verstoß (veränderter
    // Client) wird abgelehnt und neu gefragt (höchstens 3 Versuche, dann Abbruch ohne Wirkung); CPU/Rollouts, die nicht nachfragen können, werden auf das Zulässige gekürzt.
    const automat = !!(engine.isCpuPlayer?.(pi) || engine._fastMode || engine._inMctsSim);
    let selectedCards = null;
    for (let versuch = 0; versuch < 3 && !selectedCards; versuch++) {
      const pickResult = await engine.promptGeneric(pi, {
        type: 'handPick',
        eligibleIndices,
        cardTypes,
        typeLimits: discardTypeCounts,
        minSelect: 1,
        maxSelect,
        title: 'Shard of Chaos',
        description: versuch === 0
          ? `Select up to ${maxSelect} card(s) to delete. You'll retrieve the same types from your discard pile.`
          : `Invalid selection. Select up to ${maxSelect} card(s) to delete — no more of a type than your discard pile holds.`,
        confirmLabel: '🌀 Bring Chaos!',
      });

      if (!pickResult || pickResult.cancelled || !pickResult.selectedCards || pickResult.selectedCards.length === 0) {
        return { cancelled: true };
      }
      const pruef = pruefeHandwahl(ps, pickResult.selectedCards, eligibleIndices, discardTypeCounts, maxSelect, cardDB);
      if (pruef.ok || (automat && pruef.gueltig.length > 0)) selectedCards = pruef.gueltig;
      else engine.log('shard_pick_rejected', { player: ps.username });
    }
    if (!selectedCards || selectedCards.length === 0) return { cancelled: true };

    // ── Delete selected hand cards ──

    // Welle 12 (Q92, Al): Item-Lock-Kosten NACH dem Commit (Handwahl bestätigt, nicht mehr abbrechbar), aber VOR dem Löschen. Die Kostenlöschung
    // verschiebt die Handindizes — die gewählten Karten werden deshalb vorher als Namen gemerkt und danach neu zugeordnet (traf die Kostenwahl
    // eine gewählte Karte, ist sie schon gelöscht und fällt weg).
    if (engine.gs._itemLockOffen?.pi === pi) {
      const gewaehlteNamen = selectedCards.map(s => ps.hand[s.handIndex]);
      await engine.itemLockFordern(pi);
      const frei = new Set();
      selectedCards.forEach((sel, k) => {
        const i = ps.hand.findIndex((c, j) => c === gewaehlteNamen[k] && !frei.has(j) && !engine._istAufloesendeHandkarte(ps, j, false));
        if (i >= 0) { frei.add(i); sel.handIndex = i; } else sel.handIndex = -1;
      });
    }
    const typeNeeds = {}; // normalized type → count needed
    const deletedNames = [];

    // Sort indices descending to splice safely
    const sortedIndices = selectedCards.map(s => s.handIndex).filter(i => i >= 0).sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const cn = ps.hand[idx];
      if (!cn) continue;
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      typeNeeds[nt] = (typeNeeds[nt] || 0) + 1;
      deletedNames.push(cn);
      engine.takeFromPileSync(ps, 'hand', idx);
      engine.handKartenBesitzerPs(ps, cn).deletedPile.push(cn);   // W3/W5a: Stapel des permanenten Besitzers
    }

    engine.log('shard_delete', { player: ps.username, deleted: deletedNames });
    engine.sync();

    // ── Chaos screen animation ──
    engine._broadcastEvent('play_chaos_screen', {});
    await engine._delay(400);

    // ── Step 2: Retrieve from discard — one prompt per type ──
    const retrievedCards = [];
    const typeEntries = Object.entries(typeNeeds).sort((a, b) => b[1] - a[1]);

    for (const [normType, count] of typeEntries) {
      // Filter discard pile for this type
      const available = [];
      const seen = {};
      for (const cn of (ps.discardPile || [])) {
        const cd = cardDB[cn];
        if (!cd) continue;
        if (normalizeType(cd.cardType) !== normType) continue;
        const key = cn;
        seen[key] = (seen[key] || 0) + 1;
        available.push({ name: cn, count: 1, source: 'discard', displayLabel: `${cn} (${cd.cardType})` });
      }

      // Deduplicate for gallery display
      const deduped = [];
      const dedupSeen = {};
      for (const item of available) {
        if (!dedupSeen[item.name]) {
          dedupSeen[item.name] = { ...item, count: 1 };
          deduped.push(dedupSeen[item.name]);
        } else {
          dedupSeen[item.name].count++;
        }
      }

      const actualCount = Math.min(count, available.length);
      if (actualCount <= 0) continue;

      const typeLabel = TYP_ANZEIGE[normType] || normType;
      // Genau so viele wie gelöscht (Al 29.10.). Eine Karte: Einzelwahl (ein Klick wählt). Mehrere: Mehrfachwahl mit Mindestzahl = Zahl der
      // gelöschten Karten; jede Kopie ist ein eigener Eintrag (die Wahl läuft nach Index, gleichnamige Karten lassen sich einzeln wählen).
      const mehrfach = actualCount > 1;
      const galleryResult = await engine.promptGeneric(pi, mehrfach ? {
        type: 'cardGalleryMulti',
        searchToHand: true, searchPile: 'discard',   // v1121
        cards: available.map(({ name, source, displayLabel }) => ({ name, source, displayLabel })),
        title: `Shard of Chaos — Retrieve ${typeLabel}`,
        description: `Choose ${actualCount} ${typeLabel} card(s) from your discard pile.`,
        selectCount: actualCount,
        minSelect: actualCount,
        cancellable: false,
      } : {
        type: 'cardGallery',
        searchToHand: true, searchPile: 'discard',   // v1121
        cards: deduped,
        title: `Shard of Chaos — Retrieve ${typeLabel}`,
        description: `Choose ${actualCount} ${typeLabel} card(s) from your discard pile.`,
        selectCount: actualCount,
        cancellable: false,
      });

      // Antwort auf die verlangte Zahl bringen: nur Namen, die die Ablage (noch) hergibt, höchstens `actualCount`; fehlt etwas (Automat/CPU
      // wählt zu wenig), mit den stärksten übrigen Karten dieses Typs auffüllen — man bekommt immer genau so viele, wie man gelöscht hat.
      const frei = available.map(e => e.name);
      const nimm = (n) => { const i = frei.indexOf(n); if (i < 0) return false; frei.splice(i, 1); return true; };
      const gewaehlt = [];
      const antwort = [
        ...(Array.isArray(galleryResult?.selectedCards) ? galleryResult.selectedCards : []),
        ...(galleryResult?.cardName ? [galleryResult.cardName] : []),
      ];
      for (const cn of antwort) {
        if (gewaehlt.length >= actualCount) break;
        if (nimm(cn)) gewaehlt.push(cn);
      }
      if (gewaehlt.length < actualCount) {
        const staerke = (cn) => (cardDB[cn]?.level || 0) * 10 + (cardDB[cn]?.cost || 0);
        for (const cn of frei.slice().sort((a, b) => staerke(b) - staerke(a))) {
          if (gewaehlt.length >= actualCount) break;
          gewaehlt.push(cn);
        }
      }
      for (const cn of gewaehlt) retrievedCards.push(cn);
    }

    // ── Add retrieved cards to hand + stream to opponent ──
    const oi = engine.opponentOf(pi);
    const oppSid = gs.players[oi]?.socketId;

    for (const cn of retrievedCards) {
      // Centralised discard → hand transfer fires
      // ON_CARD_ADDED_FROM_DISCARD_TO_HAND so listeners (Bamboo Staff
      // free-attack chain, Bamboo Shield cost reveal, …) can react.
      const moved = await engine.addCardFromDiscardToHand(pi, cn, pi, {
        source: 'Shard of Chaos',
      });
      if (!moved) continue;
      // Stream to opponent
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: cn });
      }
      // Brief stagger between reveals
      await engine._delay(300);
    }

    engine.log('shard_retrieve', { player: ps.username, retrieved: retrievedCards });
    engine.sync();

    // Face-up display for 5 seconds is handled by card_reveal on the client

    return true;
  },
};
