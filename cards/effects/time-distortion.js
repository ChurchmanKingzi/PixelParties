'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Time Distortion"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Flip the top 3 cards of your deck face-up and choose a level 3 or lower Spell among them, if possible. The user of this Spell immediately performs that Spell as an additional Action,
//   regardless of its level. Shuffle the other cards back into your deck."
//
//  ── AUFDECKEN (Muster Chaos-Diamond, nur vom Main Deck) ─────────────────
//  Die obersten 3 Karten (oder die, die noch da sind) verlassen das Deck, fliegen nacheinander in die Bildmitte und werden umgedreht (`mill_center_reveal`, beide Spieler sehen sie; Log
//  `hand_card_revealed`). Aufdecken ist keine Suche (keine Such-Sperre). Ist das Deck leer, passiert nichts („if possible").
//
//  ── „CHOOSE A LEVEL 3 OR LOWER SPELL AMONG THEM, IF POSSIBLE" ───────────
//  Wählbar ist ein aufgedeckter SPELL (Kartentyp Spell, jeder Untertyp) der Stufe 3 oder niedriger, den der Nutzer JETZT als Zusatzaktion wirken kann (`engine.kannSofortWirken`: Status des Helden —
//  Null Zone, Eraser Beam, Frozen …; Spielbedingungen des Spells — z. B. ein Ziel muss existieren; Zusatzaktions-Sperren wie Duigno/Mission; „Only 1 per game"). Die STUFE des Helden spielt
//  ausdrücklich keine Rolle („regardless of its level"). Eine Attack, Creature oder ein höherer Spell ist nicht wählbar.
//    • KEIN wählbarer Spell → die Karte FIZZELT (sichtbar, `zeigeFizzle`), alle aufgedeckten Karten werden zurückgemischt. Kein Spell geht verloren, die Aktion ist verbraucht.
//    • Genau EIN wählbarer Spell → er wird ohne Rückfrage genommen. Mehrere → Galerie mit allen aufgedeckten Karten, die nicht wählbaren abgedunkelt, NICHT abbrechbar.
//  Ist mindestens ein Spell wählbar, MUSS einer genutzt werden: die Galerie lässt sich nicht abbrechen, und auch der Guss ist Pflicht — Abbruch in der Zielwahl ist gesperrt
//  (`_forceNonCancellable`, wie Chaos-Diamond).
//
//  ── „PERFORMS THAT SPELL AS AN ADDITIONAL ACTION" ───────────────────────
//  Über `engine._castSpellImmediately` (`fromZone: 'deck'`, `pruefen` + `pruefenZusatz`): der echte Zusatzaktions-Weg — Zielwahl, Reaktionsfenster, Wisdom-Kosten, Zählung als gespielter
//  Spell. Der Nutzer ist der Held, der Time Distortion gewirkt hat (auch ein übernommener, `heroOwner`). Time Distortion selbst kostet seine Aktion wie jeder Spell. Der gewirkte Spell
//  geht danach in die Ablage (oder bleibt als Anhängsel liegen). Fällt die Prüfung im Moment des Wirkens doch durch (etwas hat sich zwischen Wahl und Guss geändert), fizzelt der Spell
//  und wird mit den übrigen zurückgemischt.
//
//  ── „SHUFFLE THE OTHER CARDS BACK" ──────────────────────────────────────
//  Die Reihenfolge des Textes zählt: ERST der gewählte Spell wird gewirkt (die übrigen aufgedeckten Karten liegen währenddessen noch neben dem Deck — Effekte des gewirkten Spells sehen
//  das Deck ohne sie), DANACH kommen sie zurück ins Deck und das Deck wird gemischt (`engine.shuffleDeck`; im Puzzle bleibt die Reihenfolge fest: die Karten liegen dann wieder oben).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `time_distortion` (Pixelart, ANIM_REGISTRY): ein Zifferblatt mit rasendem Zeiger wirbelt um den Helden, Wellen verzerren die Luft. Klänge in ZONE_ANIM_SFX; Log
//  `time_distortion`.
// ═══════════════════════════════════════════

const { REVEAL_MS } = require('./_deck-top-shared');

const CARD_NAME = 'Time Distortion';
const ANZAHL = 3;
const MAX_STUFE = 3;
const UHR_MS = 900;           // Länge der Animation (deckt sich mit `time_distortion` im Client)
const UHR_VOR_MS = 650;       // bis das Zifferblatt aufbricht, dann beginnt das Aufdecken

module.exports = {
  // Nichts Besonderes an der Spielbarkeit: ohne Deckkarten tut sie nichts („if possible"), bleibt aber spielbar.
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }
      const db = engine._getCardDB();

      // ── Der Auftritt: das Zifferblatt ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'time_distortion', owner: heroSeite, heroIdx, zoneSlot: -1, duration: UHR_MS,
      });
      await engine._delay(UHR_VOR_MS);

      // ── 1. Aufdecken: die obersten Karten verlassen das Deck (Stapel-Schicht: `takeTop`) und fliegen in die Mitte ──
      const anzahl = Math.min(ANZAHL, ps.mainDeck.length);
      if (anzahl === 0) {
        engine.log('time_distortion', { player: ps.username, revealed: [], cast: null });
        engine.sync();
        return;
      }
      const gezogen = await engine.takeTop(pi, anzahl, { source: CARD_NAME });
      if (gezogen.length === 0) {
        // Eine Stapelsperre (Knight of Kings [B] …) verbietet, Karten aus dem Deck zu nehmen: aufgedeckt werden sie trotzdem, gewirkt wird nichts.
        const sicht = engine.revealTop(pi, anzahl);
        for (const n of sicht) engine.log('hand_card_revealed', { player: ps.username, card: n, by: CARD_NAME });
        engine._broadcastEvent('mill_center_reveal', { owner: pi, cardNames: sicht, revealMs: REVEAL_MS, dest: 'deck' });
        await engine._delay(sicht.length * REVEAL_MS + 150);
        engine.log('time_distortion', { player: ps.username, revealed: sicht, cast: null, blocked: true });
        engine.sync();
        return;
      }
      const aufgedeckt = gezogen.slice();
      for (const n of gezogen) engine.log('hand_card_revealed', { player: ps.username, card: n, by: CARD_NAME });
      engine.sync();
      engine._broadcastEvent('mill_center_reveal', {
        owner: pi, cardNames: gezogen.slice(), revealMs: REVEAL_MS, dest: 'deck',
      });
      await engine._delay(gezogen.length * REVEAL_MS + 150);

      let gewirkt = null;
      try {
        // ── 2. Wählbare Spells: Stufe ≤ 3 und JETZT wirkbar ──
        const wirkbar = (n) => {
          const cd = db[n];
          if (!cd || cd.cardType !== 'Spell' || (cd.level ?? 0) > MAX_STUFE) return false;
          return engine.kannSofortWirken(pi, heroIdx, n, heroSeite, { alsZusatzaktion: true });
        };
        const kandidaten = [...new Set(gezogen)].filter(wirkbar);

        if (kandidaten.length === 0) {
          engine.log('time_distortion_fizzle', { player: ps.username, revealed: gezogen.slice() });
          await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'no_valid_spell' });
        } else {
          // ── 3. Wahl (Pflicht, nicht abbrechbar) ──
          let name = kandidaten[0];
          if (kandidaten.length > 1) {
            const wahl = await engine.promptGeneric(pi, {
              type: 'cardGallery',
              cards: gezogen.map(n => ({
                name: n, source: 'deck', label: 'REVEALED',
                selectable: kandidaten.includes(n), highlight: kandidaten.includes(n),
              })),
              title: CARD_NAME,
              description: `Choose a level ${MAX_STUFE} or lower Spell. ${hero.name} performs it immediately as an additional Action.`,
              confirmLabel: '⏳ Perform!',
              cancellable: false,
            });
            const gewaehlt = wahl && !wahl.cancelled ? wahl.cardName : null;
            if (gewaehlt && kandidaten.includes(gewaehlt)) name = gewaehlt;
          }

          // ── 4. Wirken als Zusatzaktion (Pflicht) ──
          const idx = gezogen.indexOf(name);
          engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;
          let r = null;
          try {
            r = await engine._castSpellImmediately(pi, heroIdx, name, {
              fromZone: 'deck',
              pool: gezogen,
              poolIndex: idx,
              pruefenZusatz: true,      // der Guss ist eine Zusatzaktion: Duigno, Mission … sperren ihn
              pruefen: true,            // fällt der Spell JETZT durch (Null Zone, Eraser Beam …) → fizzelt
              by: CARD_NAME,
              ...(heroSeite !== pi ? { heroOwner: heroSeite } : {}),
            });
          } finally {
            engine._forceNonCancellable--;
          }
          if (!r?.cancelled) gewirkt = name;
          else if (r?.fizzled) engine.log('time_distortion_cast_fizzled', { player: ps.username, card: name });
        }
      } finally {
        // ── 5. Die übrigen Karten zurück ins Deck, dann mischen ──
        if (gezogen.length > 0) {
          // An ihre alten Plätze (Stapel-Schicht, ohne Mischen), dann EIN Mischvorgang.
          gezogen.forEach((n, k) => engine.returnToPile(pi, 'deck', n, k));
          gezogen.length = 0;
          engine.shuffleDeck(pi, 'main');
        }
        engine.log('time_distortion', { player: ps.username, revealed: aufgedeckt, cast: gewirkt });
        engine.sync();
      }
    },
  },

  /** CPU: unter den wählbaren Spells den mit der höchsten Stufe (stärkster Effekt). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery' || promptData.title !== CARD_NAME) return undefined;
    const db = engine._getCardDB();
    const waehlbar = (promptData.cards || []).filter(c => c.selectable !== false);
    if (waehlbar.length === 0) return undefined;
    waehlbar.sort((a, b) => (db[b.name]?.level ?? 0) - (db[a.name]?.level ?? 0));
    return { cardName: waehlbar[0].name, source: waehlbar[0].source };
  },
};
