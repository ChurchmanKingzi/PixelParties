'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Amazing Finding"
//  Attack (Fighting Lv0, Normal)
//
//  „Reveal the top card of your deck until you reveal something other than an Artifact. Add all Artifacts revealed by this effect to your hand. You cannot reveal
//   more than 3 cards with this effect. Shuffle the first Non-Artifact card you reveal back into your deck. If this is the first Attack you use this turn, this
//   counts as an additional Action."
//
//  ── VORGABE 11.10. ──────────────────────────────────────────────────────
//  Neuer Effekt (vorher: bis zu 5 Karten, alle auf die Hand). Vorlage für die Zusatzaktion ist „Quick Attack" (`inherentAction` als Funktion, gleiche Zählung).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  Die oberste Karte wird aufgedeckt (beide Spieler sehen sie in der Bildmitte), höchstens 3 Mal:
//    • ARTEFAKT → auf die Hand (`actionAddCardFromDeckToHand`, wie beim Orakel: Aufdecken ist keine Suche, aber Hand-/Such-Sperren gelten), weiter mit der nächsten.
//    • KEIN Artefakt → die Schleife endet; diese Karte wird MISCHEND ins Deck zurückgelegt (`shuffleDeck`).
//  Nach 3 Artefakten in Folge gibt es kein Nicht-Artefakt: dann wird nichts gemischt.
//  „Artifact" = Karten vom Typ Artifact (auch Artefakt-Kreaturen und Ausrüstung); das Wortspiel „something other than an Artifact" gilt für JEDEN anderen Typ.
//
//  ── „ADD ALL ARTIFACTS" (Korrektur 11.10.) ─────────────────────────────
//  Der Text lautete zuerst „Add all cards revealed …"; gemeint war „Add all ARTIFACTS revealed …". Damit ist der scheinbare Widerspruch aufgelöst: nur die Artefakte
//  kommen auf die Hand, die erste Nicht-Artefakt-Karte geht ins Deck zurück. Ist das Deck leer, bevor drei Karten aufgedeckt sind, endet die Schleife.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If this is the first Attack you use this turn, this counts as an additional Action" → `inherentAction` als FUNKTION: wahr, solange der Spieler in diesem Zug
//  noch keine Attack gespielt hat (`attacksPlayedThisTurn === 0`, Quick Attack). Sonst kostet die Karte die Aktion.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `finding_glint` (Pixelart, ANIM_REGISTRY, auf dem DECK): ein Fragezeichen steigt auf und platzt in ein Funkeln; jede aufgedeckte Karte fliegt
//  über den Aufdeck-Flug der Engine (`mill_center_reveal`). Klänge in ZONE_ANIM_SFX; Log `amazing_finding`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { REVEAL_MS, oberste, decke } = require('./_deck-top-shared');

const CARD_NAME = 'Amazing Finding';
const MAX_AUFDECKEN = 3;
const GLINT_MS = 760;        // Länge des Funkelns bis zur ersten Karte (deckt sich mit `finding_glint` im Client; +100 ms Einbau-Versatz)

module.exports = {
  // „If this is the first Attack you use this turn, this counts as an additional Action."
  inherentAction: (gs, playerIdx) => {
    const ps = gs.players[playerIdx];
    return (ps?.attacksPlayedThisTurn || 0) === 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;
      if (!oberste(engine, pi)) { engine.log('amazing_finding', { player: ps.username, hero: hero.name, artifacts: [], shuffled: null }); return; }

      const db = engine._getCardDB();
      const artefakte = [];
      let gemischt = null;

      // Funkeln über dem Deck, dann die Karten.
      engine._broadcastEvent('play_zone_animation', {
        type: 'finding_glint', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: GLINT_MS + 500,
        targets: [{ owner: pi, deck: true }],
        originOwner: pi, originDeck: true,
      });
      await engine._delay(GLINT_MS);

      for (let i = 0; i < MAX_AUFDECKEN; i++) {
        const name = oberste(engine, pi);
        if (!name) break;
        const cd = db[name];
        const istArtefakt = !!cd && hasCardType(cd, 'Artifact');
        if (istArtefakt) {
          // Aufdecken (Flug Deck → Mitte → Hand), dann buchen — wie das Orakel.
          engine._broadcastEvent('mill_center_reveal', { owner: pi, cardNames: [name], dest: 'hand', revealMs: REVEAL_MS });
          engine.log('hand_card_revealed', { player: ps.username, card: name, by: CARD_NAME });
          await engine._delay(REVEAL_MS);
          const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: false, _skipFlight: true });
          engine.sync();
          if (!ok) break;                   // Hand-/Such-Sperre: die Karte blieb oben liegen — nicht endlos weiter aufdecken
          artefakte.push(name);
        } else {
          // Kein Artefakt: aufdecken, zurück ins Deck, mischen — die Schleife endet.
          await decke(engine, pi, name, { source: CARD_NAME, dest: 'deck' });
          engine.shuffleDeck(pi);
          gemischt = name;
          break;
        }
      }

      engine.log('amazing_finding', { player: ps.username, hero: hero.name, artifacts: artefakte, shuffled: gemischt });
      engine.sync();
    },
  },
};
