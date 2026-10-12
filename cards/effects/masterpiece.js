'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Masterpiece"
//  Spell (Magic Arts Lv0, Normal)
//
//  „Search your deck for a Surprise and place it face-down into the Surprise Zone of any Hero you control without showing it to your opponent. If the user has at
//   least Magic Arts 1 or Trapping 1, this counts as an additional Action."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  Ohne Änderung (Datensatz und Text bleiben). Die Karte ist neu implementiert.
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. SUCHEN: Galerie der verschiedenen SURPRISES im Hauptdeck (Untertyp „Surprise"; jeder Kartentyp, also auch Surprise-Kreaturen und -Artefakte), eine Karte wählen
//     — abbrechbar (dann bleibt die Karte auf der Hand). Unter einer Deck-Such-Sperre (`searchLocked`, Cats of the Pharaoh, Siege) ist die Karte gar nicht spielbar
//     (`blockedBySearchLock`) und fizzelt, falls die Sperre mitten in der Auflösung fällt. Liegt keine Surprise im Deck, ist die Suche leer: die Karte ist gespielt, nichts
//     wird gelegt, das Deck wird gemischt (das Deck ist privat, ein Fehlversuch ist erlaubt).
//  2. PLATZ: „the Surprise Zone of ANY Hero you control" — jeder LEBENDE Held, den der Spieler kontrolliert (auch ein geliehener; seine Zone liegt auf der Brettseite des
//     Helden), dessen echte SURPRISE ZONE frei ist (auch bei Bakhm nur sie, wie bei Create Secret Room). Der Wirker („the user") ist davon unabhängig. Ein einziger Kandidat
//     entfällt als Frage; Abbruch bringt die Karte zurück (zu diesem Zeitpunkt ist noch nichts aus dem Deck genommen). Ohne freie Zone ist die Karte grau (`spellPlayCondition`).
//  3. KEIN REVEAL: „without showing it to your opponent" — wie bei Create Secret Room (`_secret-room-shared.js`, `place`) sieht ausser dem Spieler niemand die Karte: Flüge
//     verdeckt, Logzeile ohne Kartennamen, keine Reveal-Abfrage an den Gegner, private Galerie. Die gelegte Karte ist danach eine GEWÖHNLICHE verdeckte Surprise (keine
//     Geheimraum-Marke: kein „add to hand"-Angebot, nur ihr eigener Auslöser). Das Deck wird danach gemischt.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If the user has at least Magic Arts 1 or Trapping 1": `inherentAction` als FUNKTION je Held (Capture-Vertrag): Magic Arts ODER Trapping des WIRKENDEN Helden auf Stufe 1
//  oder höher (`effectiveSchoolLevelForCaster`, mit Performance-Wildcards). Sonst kostet der Einsatz die Aktion.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `masterpiece_paint` (Pixelart, ANIM_REGISTRY, Brett-Animation auf der Surprise Zone des gewählten Helden): ein Goldrahmen erscheint, ein Pinsel
//  malt in bunten Strichen ein Bild hinein, Glitzern, das Bild wird zur verdeckten Karte. Klänge in ZONE_ANIM_SFX; Log `masterpiece_set` (ohne Kartennamen).
// ═══════════════════════════════════════════

const { place } = require('./_secret-room-shared');

const CARD_NAME = 'Masterpiece';
const SCHULEN = ['Magic Arts', 'Trapping'];
const MAL_MS = 1100;           // Länge der Animation (deckt sich mit `masterpiece_paint` im Client)
const MALEN_MS = 640;          // bis das Bild fertig gemalt ist (+ 100 ms Einbau-Versatz des Clients), dann fliegt die Karte hinein

/** Ist `name` eine Surprise (Untertyp)? */
function istSurprise(engine, name) {
  return String(engine._getCardDB()[name]?.subtype || '').toLowerCase() === 'surprise';
}

/** Alle Surprises des Hauptdecks (verschiedene Namen, alphabetisch). */
function surprisesImDeck(engine, pi) {
  return [...new Set(engine.gs.players[pi]?.mainDeck || [])].filter(n => istSurprise(engine, n)).sort((a, b) => a.localeCompare(b));
}

/** Helden, die `pi` kontrolliert, leben und eine freie (echte) Surprise Zone haben. */
function kandidaten(engine, pi) {
  const gs = engine.gs;
  return engine.heroesControlledBy(pi)
    .filter(({ physOwner, heroIdx, hero }) => hero?.name && hero.hp > 0 && ((gs.players[physOwner]?.surpriseZones || [])[heroIdx] || []).length === 0)
    .map(({ physOwner, heroIdx, hero }) => ({ seite: physOwner, heroIdx, hero }));
}

module.exports = {
  // „Search your deck …" ist der einzige Effekt: unter einer Deck-Such-Sperre wirkungslos, also gar nicht erst spielbar.
  blockedBySearchLock: true,

  /** „… counts as an additional Action" bei Magic Arts ≥ 1 ODER Trapping ≥ 1 des Nutzers — je Held. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine || typeof heroIdx !== 'number' || heroIdx < 0) return false;
    const seite = engine.heldSeiteFuer(pi, heroIdx);
    return SCHULEN.some(s => engine.effectiveSchoolLevelForCaster(s, pi, heroIdx, seite) >= 1);
  },

  /** Grau, solange kein kontrollierter Held eine freie Surprise Zone hat. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return kandidaten(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const seiteWirker = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const wirker = ctx.attachedHero || gs.players[seiteWirker]?.heroes?.[ctx.cardHeroIdx];
      if (!ps || !wirker?.name || wirker.hp <= 0) { gs._spellCancelled = true; return; }
      if (engine._isSearchBlocked(pi, { source: CARD_NAME })) { gs._spellCancelled = true; return; }     // die Sperre fiel mitten in der Auflösung
      const ziele = kandidaten(engine, pi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      // ── 1. Suchen: eine Surprise aus dem Deck (private Galerie) ──
      const namen = surprisesImDeck(engine, pi);
      if (namen.length === 0) {
        // Leere Suche: gespielt, nichts gelegt — das Deck wird trotzdem gemischt.
        engine.shuffleDeck(pi);
        engine.log('masterpiece_none', { player: ps.username });
        engine.sync();
        return;
      }
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: namen.map(name => ({ name, source: 'deck' })),
        title: CARD_NAME, _privat: true,        // die Galerie zeigt dein Deck NUR dir (effectPromptFuer)
        description: 'Search your deck for a Surprise to place face-down into the Surprise Zone of one of your Heroes.',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName || !namen.includes(wahl.cardName)) { gs._spellCancelled = true; return; }
      const name = wahl.cardName;

      // ── 2. Platz: die Surprise Zone EINES kontrollierten Helden ──
      let ziel = ziele[0];
      if (ziele.length > 1) {
        const ids = await engine.promptEffectTarget(pi, ziele.map(z => ({
          id: `hero-${z.seite}-${z.heroIdx}`, type: 'hero', owner: z.seite, heroIdx: z.heroIdx, cardName: z.hero.name,
        })), {
          maxTotal: 1, title: CARD_NAME, confirmLabel: '🖼️ Place here!', greenSelect: true, cancellable: true,
          description: 'Choose the Hero whose Surprise Zone receives the Surprise — the opponent will not see it.',
        });
        const id = Array.isArray(ids) ? ids[0] : null;
        if (!id) { gs._spellCancelled = true; return; }
        ziel = ziele.find(z => `hero-${z.seite}-${z.heroIdx}` === id) || null;
        if (!ziel) { gs._spellCancelled = true; return; }
      }

      // ── 3. Der Pinsel malt, die Karte fliegt hinein (für alle anderen verdeckt) ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'masterpiece_paint', zoneType: 'board', owner: ziel.seite, heroIdx: -1, zoneSlot: -1, duration: MAL_MS,
        targets: [{ owner: ziel.seite, heroIdx: ziel.heroIdx, zoneType: 'surprise' }],
        originOwner: seiteWirker, originHeroIdx: ctx.cardHeroIdx, originZoneSlot: -1,
      });
      await engine._delay(MALEN_MS);

      const inst = await place(engine, { pi, seite: ziel.seite, heroIdx: ziel.heroIdx, cardName: name, source: CARD_NAME, ohneMarke: true, logTyp: 'masterpiece_set' });
      engine.shuffleDeck(pi);                                           // „Search" heisst: danach mischen — auch bei einem Fehlschlag der Platzierung
      if (!inst) { engine.sync(); return; }
      engine.sync();
    },
  },

  /** CPU: wählt eine Surprise, die ein eigener Held auch auslösen kann (sonst die erste Karte). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME || promptData.type !== 'cardGallery') return undefined;
    const pi = engine._cpuPlayerIdx;
    const heroes = engine.gs.players?.[pi]?.heroes || [];
    const cards = promptData.cards || [];
    const brauchbar = cards.find(c => heroes.some((h, hi) => h?.name && h.hp > 0
      && engine._canHeroActivateSurprise(engine.heldSeiteFuer(pi, hi), hi, c.name, { reaktor: pi })));
    const gewaehlt = brauchbar || cards[0];
    return gewaehlt ? { cardName: gewaehlt.name } : undefined;
  },
};
