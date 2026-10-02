// ═══════════════════════════════════════════
//  CARD EFFECT: "The Third Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted, you may immediately reveal the top 6 cards of your deck. If you do,
//   delete all Areas on your side of the board. Then, choose an Area Spell from among the cards you
//   revealed and immediately play it as an additional Action, if possible. Delete the remaining
//   cards. You can only activate this effect once per turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Anders als die uebrigen Kreise: KEIN „by an effect", KEINE Rueckholung dieser Karte — jede
//    Loeschung (auch Kosten, auch vom Brett) loest es aus. Einmal je Zug und Spieler
//    (`ps._thirdCircleTurn`, beim Bestaetigen gesetzt).
//  • Ablauf: oberste 6 Karten vom Deck nehmen und in der Mitte zeigen (beide Seiten sehen sie);
//    alle eigenen Areas loeschen; unter den gezeigten Area-Zaubern einen waehlen (Pflicht, wenn es
//    einen gibt) und ihn ueber die echte Zusatzaktions-Abfrage spielen („if possible": bricht der
//    Spieler ab oder kann kein Held ihn wirken, entfaellt er); alle uebrigen gezeigten Karten —
//    auch ein nicht gespielter Area-Zauber — werden geloescht (mit Loesch-Rettung, Flug).
//  • Der gespielte Area-Zauber kommt aus dem DECK, nicht aus dem Geloescht-Stapel: er zaehlt nicht
//    als „played a deleted Area" der anderen Kreise.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { alleEigenenAreasLoeschen, cpuBejahen } = require('./_hell-circles-shared');

const CARD_NAME = 'The Third Circle of Hell';
const ANZAHL = 6;

function istAreaZauber(cd) {
  return !!cd && hasCardType(cd, 'Spell') && (cd.subtype || '').toLowerCase() === 'area';
}

module.exports = {
  activeIn: ['hand', 'area'],
  ...cpuBejahen,

  onDeletedFromAnywhere: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || ps._thirdCircleTurn === gs.turn) return;
    if (!(ps.mainDeck || []).length) return;
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
    const antwort = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Reveal the top ${Math.min(ANZAHL, ps.mainDeck.length)} cards of your deck, delete all your Areas, play an Area Spell from among them and delete the rest?`,
      showCard: CARD_NAME,
      confirmLabel: '🔥 Reveal!',
      cancelLabel: 'No',
      cancellable: true,
      gerrymanderEligible: true,
    });
    if (!engine._confirmSaidYes(antwort)) return;
    ps._thirdCircleTurn = gs.turn;

    // ① Oberste Karten zeigen (vom Deck genommen, bis sie gespielt/geloescht sind).
    let gezeigt = [];
    for (let i = 0; i < ANZAHL && ps.mainDeck.length > 0; i++) {
      const genommen = engine.takeFromPileSync(pi, 'deck', 0, { source: CARD_NAME });
      if (!genommen) break;
      if (ps.deckTopVisible && ps.deckTopVisible.length > 0) ps.deckTopVisible.shift();
      gezeigt = [...gezeigt, genommen.name];
    }
    if (gezeigt.length === 0) return;
    engine._broadcastEvent('mill_center_reveal', { owner: pi, cardNames: gezeigt, deleteMode: true, revealMs: 1800 });
    engine.sync();
    await engine._delay(1900);

    // ② Alle eigenen Areas loeschen.
    await alleEigenenAreasLoeschen(engine, pi, CARD_NAME);

    // ③ Area-Zauber waehlen und als Zusatzaktion spielen.
    const db = engine._getCardDB();
    const kandidaten = [...new Set(gezeigt.filter(n => istAreaZauber(db[n])))];
    let gespielt = null;
    if (kandidaten.length > 0) {
      let wahl = kandidaten[0];
      if (kandidaten.length > 1) {
        const a = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: kandidaten.map(name => ({ name, source: 'deck' })),
          title: CARD_NAME,
          description: 'Choose an Area Spell from among the revealed cards and play it as an additional Action.',
          confirmLabel: '🔥 Play it!',
          confirmClass: 'btn-warning',
          cancellable: false,
        });
        if (a?.cardName && kandidaten.includes(a.cardName)) wahl = a.cardName;
      }
      // Gewaehlte Karte kurz auf die Hand legen, damit die echte Zusatzaktions-Abfrage sie spielen kann.
      const gi = gezeigt.indexOf(wahl);
      gezeigt = gezeigt.filter((_, i) => i !== gi);
      engine.handZugangSync(pi, wahl, { source: CARD_NAME, von: 'deck' });
      const res = await engine.performImmediateActionAnyHero(pi, {
        title: CARD_NAME,
        description: `Play "${wahl}" as an additional Action (if possible). If you cancel, it is deleted.`,
        allowedCardTypes: ['Spell'],
        cardNameFilter: (n) => n === wahl,
        skipAbilities: true, skipHeroEffects: true,
        cancellable: true,
      });
      if (res?.played) {
        gespielt = wahl;
      } else {
        // Nicht gespielt → gehoert zu „the remaining cards": aus der Hand zurueck in den Rest.
        const hi = ps.hand.lastIndexOf(wahl);
        if (hi >= 0) {
          const inst = [...engine.cardInstances].reverse().find(c => c.name === wahl && c.zone === 'hand' && c.owner === pi);
          engine.takeFromPileSync(pi, 'hand', hi, { source: CARD_NAME });
          if (inst) engine._untrackCard(inst.id);
        }
        gezeigt.push(wahl);
      }
    }

    // ④ Den Rest loeschen.
    if (gezeigt.length > 0) await engine.actionDeleteFromDeckAnimated(pi, gezeigt, { source: CARD_NAME, settle: 300 });
    engine.log('third_circle', { player: ps.username, revealed: ANZAHL, played: gespielt, deleted: gezeigt.length });
    engine.sync();
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },
};
