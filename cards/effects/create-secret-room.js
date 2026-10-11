'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Create Secret Room"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Choose a card from your deck and place it into the user's Surprise Zone face-down. Whenever the user is chosen by an opponent's card or effect, you may add
//   the card you placed to your hand. If the card is a Surprise and the user can use it, you may flip it face-up and activate it instead as if its activation
//   condition was fulfilled. If the user has at least Trapping 1, this Spell's level is treated as 0 and it counts as an additional Action."
//
//  ── VORGABE 11.10. ──────────────────────────────────────────────────────
//  Neuer Text (Datenänderung in `data/cards.json`). Wichtig: „Nur aktivierbar, sofern die Surprise Zone frei ist! Auch bei Bakhm muss spezifisch die Surprise
//  Zone frei sein!" Die Aktivierung unabhängig von der Bedingung erfolgt, wenn der Hero anvisiert wird — genau wie das Auf-die-Hand-Nehmen; bei Surprises gibt
//  es dafür zwei Optionen: add to hand oder activate now.
//
//  ── PLATZ ───────────────────────────────────────────────────────────────
//  Die echte SURPRISE ZONE des Nutzers muss frei sein (`surpriseZones[heroIdx]` leer) — NICHT die Support Zones eines Bakhm (`isBakhmHero`), die sonst als
//  zusätzliche Surprise-Plätze dienen: die Karte ist ohne freie Surprise Zone gar nicht spielbar (`canPlayWithHero`/`spellPlayCondition`, je Held), und ein
//  Held mit Bakhm-Plätzen ändert daran nichts. Der Nutzer muss leben. Für einen geliehenen Held (Charme, Love Shot) liegt die Zone auf dessen Brettseite, die Karte
//  stammt aus dem Deck des Wirkenden (`place` unterscheidet beides, die Karte bleibt „seine": Hand und Ablage).
//
//  ── WAHL — OHNE REVEAL (Als Vorgabe 11.10.) ──────────────────────────────
//  „A card from your deck": JEDE Karte des Hauptdecks (auch eine, die nie eine Surprise war) — Galerie der verschiedenen Namen, abbrechbar (dann bleibt die Karte
//  auf der Hand). **Der Gegner sieht die Karte NICHT, sie wird an keiner Stelle revealed:** kein `card_reveal`, kein `deckSearchReveal`-Angebot an ihn (anders als bei
//  Trapping), kein `knownToOpponent` an der Karte, Flüge für ihn verdeckt, Logzeilen ohne Kartennamen, die Galerie ist eine private Abfrage (`_privat: true`). Alles
//  Nähere: `_secret-room-shared.js`. Danach wird das Deck gemischt.
//
//  ── AUSLÖSER ────────────────────────────────────────────────────────────
//  `_secret-room-shared.js` → `onHeroChosen`: „Whenever the user is chosen by an opponent's card or effect" (das gewöhnliche Surprise-Fenster `_checkSurpriseWindow`),
//  dann „add to hand" oder — bei einer Surprise, die der Held nutzen kann — „activate now". Details dort.
//
//  ── TRAPPING 1 ──────────────────────────────────────────────────────────
//  „If the user has at least Trapping 1, this Spell's level is treated as 0 and it counts as an additional Action":
//    • Stufe: `reduceCardLevel` senkt die Stufe der Handkopie um ihre ganze Stufe, solange der WIRKENDE Held (5. Argument) Trapping ≥ 1 hat (mit Performance-Wildcards,
//      `effectiveSchoolLevelForCaster`). Ein Held mit Trapping 1 und OHNE Magic Arts kann die Karte also wirken. Nur eine Handkopie zählt (`selbstsenkungZaehlt`).
//    • Zusatzaktion: `inherentAction` als FUNKTION je Held (Capture-Vertrag): Main Phase nur für Helden mit Trapping, Action Phase jeder Held — ohne Trapping
//      kostet der Einsatz die Aktion.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `secret_room_open` (Pixelart, ANIM_REGISTRY, auf der Surprise Zone): Ziegelwand schiebt sich zur Seite, dahinter ein dunkler Raum mit
//  goldenem Schein, schliesst sich wieder. Klänge in ZONE_ANIM_SFX; Logs `secret_room_set`, `secret_room_hand` (beide ohne Kartennamen), `secret_room_activate` (mit Namen: die Surprise wird dabei aufgedeckt).
// ═══════════════════════════════════════════

const { selbstsenkungZaehlt } = require('./_hooks');
const { place, CARD_NAME: _NAME } = require('./_secret-room-shared');

const CARD_NAME = 'Create Secret Room';
const TRAPPING = 'Trapping';
const TUER_MS = 1000;          // Länge der Animation (deckt sich mit `secret_room_open` im Client)
const OEFFNEN_MS = 520;        // bis die Tür offen steht (+ 100 ms Einbau-Versatz des Clients)

/** Trapping-Stufe des Wirkers (Brettseite `seite`), inkl. Performance-Wildcards. */
function trappingStufe(engine, pi, heroIdx, seite) {
  return engine.effectiveSchoolLevelForCaster(TRAPPING, pi, heroIdx, seite);
}

/** Kann dieser Held die Karte jetzt wirken? Lebend, freie echte Surprise Zone, Karte im Deck. */
function heldTauglich(engine, pi, heroIdx) {
  const gs = engine.gs;
  const seite = engine.heldSeiteFuer(pi, heroIdx);
  const hero = gs.players[seite]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (((gs.players[seite]?.surpriseZones || [])[heroIdx] || []).length > 0) return false;   // die Surprise Zone — auch bei Bakhm nur sie
  return (gs.players[pi]?.mainDeck || []).length > 0;
}

module.exports = {
  // Wie jede Karte mit Deck-Griff: ohne Karten im Deck gibt es nichts zu wählen (in `heldTauglich`).

  /** „Level treated as 0" bei Trapping ≥ 1 — als Senkung um die ganze Stufe, nur für die Handkopie. */
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (evalOpts?.pileSide) return 0;
    if (typeof heroIdx !== 'number' || heroIdx < 0) return 0;
    if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx, { zone: 'hand' })) return 0;
    if (trappingStufe(engine, ownerIdx, heroIdx, engine.heldSeiteFuer(ownerIdx, heroIdx)) < 1) return 0;
    return cardData.level || 0;
  },

  /** „… and it counts as an additional Action" bei Trapping ≥ 1 — je Held. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine || typeof heroIdx !== 'number' || heroIdx < 0) return false;
    return trappingStufe(engine, pi, heroIdx, engine.heldSeiteFuer(pi, heroIdx)) >= 1;
  },

  /** Grau, solange kein eigener Held eine freie Surprise Zone hat. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (heldTauglich(engine, pi, hi)) return true;
    return false;
  },

  /** Je Nutzer: freie echte Surprise Zone. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    return heldTauglich(engine, pi, heroIdx);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const seite = ctx.cardHeroOwner ?? pi;                    // Brettseite des Nutzers (geliehener Held)
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }
      if (!heldTauglich(engine, pi, heroIdx)) { gs._spellCancelled = true; return; }

      // ── Wahl: jede Karte des Hauptdecks ──
      const namen = [...new Set(ps.mainDeck || [])].sort((a, b) => a.localeCompare(b));
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: namen.map(name => ({ name, source: 'deck' })),
        title: CARD_NAME, _privat: true,        // die Galerie zeigt dein Deck NUR dir (effectPromptFuer)
        description: `Choose a card from your deck to place face-down into ${hero.name}'s Surprise Zone.`,
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName || !namen.includes(wahl.cardName)) { gs._spellCancelled = true; return; }
      const name = wahl.cardName;

      // ── Tür öffnet sich, die Karte fliegt hinein ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'secret_room_open', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: TUER_MS,
        targets: [{ owner: seite, heroIdx, zoneType: 'surprise' }],
        originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(OEFFNEN_MS);

      const inst = await place(engine, { pi, seite, heroIdx, cardName: name, source: CARD_NAME });
      if (!inst) { gs._spellCancelled = true; engine.sync(); return; }
      engine.shuffleDeck(pi);
      engine.sync();
    },
  },

  /**
   * CPU: wählt eine Surprise, die der Nutzer auch auslösen kann (sonst die erste Karte); beantwortet das Auslöse-Angebot:
   * aktivieren, wenn möglich, sonst auf die Hand.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'optionPicker') {
      const ids = (promptData.options || []).map(o => o.id);
      return { optionId: ids.includes('activate') ? 'activate' : (ids.includes('hand') ? 'hand' : 'no') };
    }
    if (promptData.type === 'cardGallery') {
      const pi = engine._cpuPlayerIdx;
      const heroes = engine.gs.players?.[pi]?.heroes || [];
      const cards = promptData.cards || [];
      const db = engine._getCardDB();
      const surprise = cards.find(c => String(db[c.name]?.subtype || '').toLowerCase() === 'surprise'
        && heroes.some((h, hi) => h?.name && h.hp > 0 && engine._canHeroActivateSurprise(engine.heldSeiteFuer(pi, hi), hi, c.name, { reaktor: pi })));
      const gewaehlt = surprise || cards[0];
      return gewaehlt ? { cardName: gewaehlt.name } : undefined;
    }
    return undefined;
  },
};
