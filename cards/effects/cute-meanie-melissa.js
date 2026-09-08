// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Meanie Melissa"
//  Hero (Cute) — HP 400, ATK 40, Charme / Decay Magic
//
//  „Whenever your opponent draws 1 or more cards via an effect, you
//   may draw 1 card."
//
//  • Hoert auf `onDraw` (feuert je gezogener Karte). „1 or more cards"
//    = EIN Ziehvorgang → entprellt an `ctx._drawBatch` (v815-Kennung
//    aus `actionDrawCards`), damit ein „draw 3" genau EINE Melissa-
//    Karte bringt.
//  • „via an effect": Ressourcen-Phase-Zug (`_isResourceDraw`) zaehlt
//    nicht; alles andere (Spells, Kreaturen, Artefakte, Helden, auch
//    Potion-Deck-Zuege) schon.
//  • „you may": Nachfrage; CPU und Puzzle sagen ja. Melissa muss leben.
//  • Melissas eigener Zug ist ein Zug des BESITZERS, nicht des Gegners
//    — keine Rueckkopplung. Zwei Melissas antworten beide.
// ═══════════════════════════════════════════

const deckProfile = require('./_deck-profile');

const CARD_NAME = 'Cute Meanie Melissa';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const owner = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      if (ctx.playerIdx === owner) return;                    // Gegner muss ziehen
      if (ctx._isResourceDraw) return;                        // nicht „via an effect"
      const hero = gs.players[owner]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      // Ein Ziehvorgang = eine Antwort.
      const batch = ctx._drawBatch;
      if (batch != null) {
        if (hero._melissaBatch === batch) return;
        hero._melissaBatch = batch;
      }
      const ps = gs.players[owner];
      if ((ps.mainDeck || []).length === 0) return;
      const ok = await engine.promptGeneric(owner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${gs.players[ctx.playerIdx]?.username || 'Your opponent'} drew via an effect — ${hero.name} may draw 1 card. Draw?`,
        showCard: CARD_NAME,
        confirmLabel: '🍬 Draw 1',
        cancelLabel: 'No',
        cancellable: true,
        _ownerIdx: owner,   // fuer cpuResponse (im Training sind beide Seiten CPU)
      });
      if (!ok || ok.cancelled || ok.confirmed === false) return;
      // Auftritt erst NACH dem Ja (v736-Regel: nie vor der letzten
      // Abbruchstelle) — Kartenbild an beide Spieler, dann der Zug.
      await engine.showTriggeredEffect(CARD_NAME);
      engine._broadcastEvent('play_zone_animation', {
        type: 'equip_flash', owner, heroIdx, zoneSlot: -1,
      });
      const got = await engine.actionDrawCards(owner, 1, { source: CARD_NAME });
      engine.log('melissa_draw', { player: ps.username, hero: hero.name, drawn: Array.isArray(got) ? got.length : 1 });
      engine.sync();
    },
  },

  /**
   * CPU (Al 6.9.): ausserhalb des Puzzles nur ziehen, wenn sie sich
   * damit nicht ausmillt — Zieh-Entscheidungs-Kanal `optionalDrawChoice`
   * (gelernte Regel je Karte, sonst Mill-Heuristik). Puzzle: immer ja.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if ((promptData._gerryOriginalTitle || promptData.title) !== CARD_NAME) return undefined;
    const pi = Number.isInteger(promptData._ownerIdx) ? promptData._ownerIdx : engine._cpuPlayerIdx;
    return deckProfile.optionalDrawChoice(engine, pi, CARD_NAME, 1) ? { confirmed: true } : null;
  },
};
