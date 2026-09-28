'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Bishop of Kings [W]"  (v818)
//  Creature — Summoning Magic Lv2, 1 HP
//
//  "At the beginning of your turn, you may search your deck for a
//   "Pawn of Kings", reveal it and add it to your hand. If "Board of
//   Kings" is on the board, you may immediately place that Creature into
//   the Support Zone of an undefeated Hero you control. You can only
//   activate this effect of "Bishop of Kings" once per turn."
//
//  `onTurnStart` (eigener Zug), harte Einmal-pro-Zug-Marke je Spieler
//  (`gs.hoptUsed`, deckt mehrere Bishops). Tutor ueber
//  `actionAddCardFromDeckToHand` (Reveal, Stapel-Ausgangssperre greift
//  dort). Platzieren nur zu lebenden Helden, regardless of level, keine
//  Aktion. Auftritt beim Ja (v818-Grundregel).
// ═══════════════════════════════════════════
const { PAWN, boardOfKingsOnBoard, freeZonesOfHero, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Bishop of Kings [W]';
const key = (pi) => `bishop-of-kings-w:${pi}`;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== pi) return;
      if (gs.hoptUsed?.[key(pi)] === gs.turn) return;
      const ps = gs.players[pi];
      if (!ps || ps.handLocked) return;
      if (!engine.pileOutAllowed(pi, 'deck', { sourceOwner: pi })) return;
      const pawns = [...new Set((ps.mainDeck || []).filter(n => n.startsWith(PAWN)))];
      if (pawns.length === 0) return;

      const yes = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: 'Search your deck for a "Pawn of Kings", reveal it and add it to your hand?',
        showCard: CARD_NAME, confirmLabel: '♗ Search!', cancelLabel: 'No', cancellable: true,
      });
      if (!yes) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[key(pi)] = gs.turn;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      let name = pawns[0];
      if (pawns.length > 1) {
        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME,
          searchToHand: true,   // v1119: Suche AUF DIE HAND
          cards: pawns.map(n => ({ name: n, source: 'deck' })),
          description: 'Choose which "Pawn of Kings" to add to your hand.', cancellable: false,
        });
        if (res?.cardName) name = res.cardName;
      }
      const ok = await engine.actionAddCardFromDeckToHand(pi, name, { reveal: true, source: CARD_NAME, sourceOwner: pi });
      if (!ok) return;
      engine.log('bishop_of_kings_search', { player: ps.username, card: name });

      if (!boardOfKingsOnBoard(engine)) return;
      // Kontrolle statt Seite (Styx 28.9.): „an undefeated Hero you
      // control" — auch uebernommene Helden der Gegenspalte (`owner`).
      const zones = [];
      for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
        if (!h?.name || h.hp <= 0) continue;
        for (const z of freeZonesOfHero(engine, physOwner, hi)) zones.push({ owner: physOwner, heroIdx: hi, slotIdx: z });
      }
      if (zones.length === 0) return;
      const place = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `Place ${name} into the Support Zone of an undefeated Hero you control now?`,
        showCard: name, confirmLabel: '♟ Place!', cancelLabel: 'Keep in hand', cancellable: true,
      });
      if (!place) return;
      // Kontrolle statt Seite (Styx 28.9.): eigene Zonenwahl, damit
      // `owner` erhalten bleibt (das geteilte pickZone kennt ihn nicht).
      let zone = zones[0];
      if (zones.length > 1) {
        const pick = await engine.promptGeneric(pi, {
          type: 'zonePick', title: CARD_NAME, description: `Place ${name} into which Support Zone?`,
          zones: zones.map(z => ({
            owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx,
            label: `${gs.players[z.owner]?.heroes?.[z.heroIdx]?.name || `Column ${z.heroIdx + 1}`} — Slot ${z.slotIdx + 1}`,
          })),
          cancellable: true,
        });
        if (!pick || pick.cancelled || pick.heroIdx == null || pick.slotIdx == null) return;
        zone = zones.find(z => z.owner === (pick.owner ?? pi) && z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx)
          || zones.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx);
      }
      if (!zone) return;
      await engine.actionPlaceCreature(name, pi, zone.heroIdx, zone.slotIdx, {
        source: 'hand', sourceName: CARD_NAME,
        ...(zone.owner !== pi ? { heldSeite: zone.owner } : {}),   // Kontrolle statt Seite (Styx 28.9.)
      });
      engine.sync();
    },
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) return true;
    // Kontrolle statt Seite (Styx 28.9.): Zonenwahl mit `owner` beantworten.
    if (kind === 'generic' && payload?.type === 'zonePick' && payload?.title === CARD_NAME) {
      const z = (payload.zones || [])[0];
      return z ? { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx } : null;
    }
    return ofKingsCpuAnswer(engine, kind, payload);
  },
};
