'use strict';
// H04-11 · Taio, Absorber of the Mountain's Heart: Abbruch der Zielwahl im Nachguss verbraucht die Karte (Hand ODER Deck) und die Einmal-Sperre  [Stufe C]
//
// Kartentext: „Once per turn, during your turn, when this Hero performs an Attack or Destruction Magic Spell, it may immediately perform a
//   Destruction Magic Spell or Attack (whichever it didn't use) from your deck or hand as an additional Action."
// CARD_API.md (Abschnitt „Zielwahl", ~Z. 380): „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand, die Aktion wird erstattet,
//   der Gegner hat nichts gesehen." – Ausnahme nur für „was nach dem Zusagepunkt kommt … dann steht der Grund als Kommentar daneben".
//   Yukana (gleiche Zusatzaktions-Familie, `_castSpellImmediately`): „Abbruch in Galerie ODER in der Zielwahl des Spells → nichts verbraucht."
// Skript-Kommentar (taio-absorber-of-the-mountain-s-heart.js, `_castAsAdditionalAction`): „The card is NOT pushed back to hand on cancel —
//   Mountain's Heart's prompt is the commitment point." (kein „Als Ruling"-Vermerk).
// Beobachtet: Der Spieler wählt in der Galerie „Quick Attack" (aus dem Deck, ggf. aus der Hand) und bricht dann die Zielwahl des Angriffs ab →
//   kein Schaden, ABER die Karte liegt in der Ablage (aus dem Deck gezogen, gemischt, dem Gegner per deckSearchReveal gezeigt – verloren) und die
//   Einmal-pro-Zug-Sperre (`taio-mountains-heart-followup`) ist verbraucht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TA = "Taio, Absorber of the Mountain's Heart";
  const heroes = [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']];
  async function lauf(quelle) {
    const t = await H.fresh({ heroes: [heroes[0]], hand: [quelle === 'hand' ? ['Burning Finger', 'Quick Attack'] : ['Burning Finger'], []],
      deck: [quelle === 'deck' ? ['Quick Attack', H.INERT.creature, H.INERT.creature] : [H.INERT.creature, H.INERT.creature], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setHero(0, 0, TA, 600);
    t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []]);
    let erste = true;
    t.targetFn = (valid) => { if (erste) { erste = false; const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; } return null; };   // 2. Zielwahl (Nachguss): Abbruch
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => ({ cardName: 'Quick Attack', source: quelle }) });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    return { hpOpp: t.hp(1, 0), hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck'), hopt: t.gs.hoptUsed, err: t.errors };
  }
  for (const q of ['hand', 'deck']) {
    const o = await lauf(q);
    R.check(`${q}: Nachguss abgebrochen → kein Schaden durch Quick Attack (nur Burning Finger: 800 → 560)`, o.hpOpp === 560, o);
    R.check(`${q}: Abbruch → Quick Attack nicht in der Ablage (Karte bleibt in ${q === 'hand' ? 'der Hand' : 'dem Deck'})`, !o.disc.includes('Quick Attack'), o);
    R.check(`${q}: Abbruch → Einmal-pro-Zug-Sperre nicht verbraucht`, !JSON.stringify(o.hopt || {}).includes('taio-mountains-heart'), o.hopt);
  }
  R.finish();
})();
