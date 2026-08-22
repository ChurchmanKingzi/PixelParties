// ═══════════════════════════════════════════
//  CARD EFFECT: "Iterative Testing"
//  Spell (Normal, Lv 0)
//
//  "Choose a card from your hand and send up to 2 cards with the same
//   name from your deck to the discard pile. If the user has at least
//   Magic Arts 2, this counts as an additional Action. You can only
//   play 1 \"Iterative Testing\" per turn."
//
//  ── Der zweite Motor des Archetyps ──
//  Mysterious Core befördert Artefakte in die Ablage, dieser Zauber
//  jede beliebige Karte — aber nur solche, von denen man schon eine
//  auf der Hand hat. Das ist die Bremse: man entsorgt gezielt Kopien
//  dessen, was man ohnehin spielen will, und macht damit genau die
//  Karte stärker, die man in der Hand hält.
//
//  ── Drei Klauseln, drei Umsetzungen ──
//  ① „a card from your hand" — die Handkarte wird nur ALS VORLAGE
//    gewählt und bleibt liegen. Sie wird nicht abgeworfen; der Text
//    sagt „choose", nicht „discard".
//  ② „up to 2 … from your deck" — es werden so viele Kopien
//    verschoben, wie da sind, höchstens zwei. Liegt keine im Deck,
//    fizzelt die Wahl; deshalb stehen solche Handkarten gar nicht erst
//    zur Auswahl.
//  ③ „If the user has at least Magic Arts 2, this counts as an
//    additional Action" — `inherentAction` als FUNKTION, je Held
//    ausgewertet. Genau dafür ist der Vertrag da (CARD_API): der Held,
//    der den Zauber wirkt, entscheidet, ob es eine Aktion kostet.
//
//  „You can only play 1 per turn" ist die harte Rundensperre über
//  `claimHOPT` — anders als das weiche „You may once per turn" der
//  Kreatureffekte gilt sie je SPIELER, nicht je Instanz.
// ═══════════════════════════════════════════

const { schickeVonDeckInAblage, waehleAusNamen } = require('./_future-tech-shared');

const CARD_NAME = 'Iterative Testing';
const MAX_SENDS = 2;
const MA_SCHWELLE = 2;

/** Handkarten, von denen mindestens eine Kopie im Deck liegt. */
function brauchbareHandkarten(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const imDeck = new Set(ps.mainDeck || []);
  return [...new Set(ps.hand || [])].filter(n => imDeck.has(n));
}

/** Magic-Arts-Stufe des wirkenden Helden. */
function magicArts(gs, pi, heroIdx, engine) {
  const ps = gs.players[pi];
  const zonen = ps?.abilityZones?.[heroIdx];
  if (!zonen) return 0;
  return engine.countAbilitiesForSchool('Magic Arts', zonen);
}

module.exports = {
  // Ohne Handkarte mit Deck-Kopie bewirkt der Zauber nichts.
  spellPlayCondition(gs, pi) {
    return brauchbareHandkarten(gs, pi).length > 0;
  },

  // ③ Zusatzaktion ab Magic Arts 2 — je Held ausgewertet.
  inherentAction: (gs, pi, heroIdx, engine) => magicArts(gs, pi, heroIdx, engine) >= MA_SCHWELLE,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Harte Rundensperre. VOR der Auswahl geprüft, aber erst nach
      // der Zusage beansprucht — ein Abbruch soll den Zug nicht
      // verbrennen.
      if (gs.hoptUsed?.[`iterative-testing:${pi}`] === gs.turn) {
        gs._spellCancelled = true;
        return;
      }

      const kandidaten = brauchbareHandkarten(gs, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }

      const name = await waehleAusNamen(engine, pi, kandidaten, {
        source: 'hand',
        title: CARD_NAME,
        description: `Pick a card in your hand — up to ${MAX_SENDS} copies go from your deck to the discard pile.`,
        cancellable: true,
      });
      if (!name) { gs._spellCancelled = true; return; }

      // `claimHOPT` haengt den Spielerindex SELBST an — der Schluessel
      // darf ihn also nicht schon enthalten, sonst entsteht
      // `iterative-testing:0:0` und die Vorpruefung oben greift nie.
      engine.claimHOPT('iterative-testing', pi);

      // ② so viele Kopien wie vorhanden, höchstens zwei
      const wieViele = Math.min(MAX_SENDS, (ps.mainDeck || []).filter(k => k === name).length);
      const bewegt = await schickeVonDeckInAblage(engine, pi, Array(wieViele).fill(name), CARD_NAME);

      engine.log('iterative_testing', {
        player: ps.username, card: name, count: bewegt.length,
      });
      engine.sync();
    },
  },
};
