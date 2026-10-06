const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "Mausoleum Worm"
//  Creature (Normal, Lv 3, 50 HP, Summoning Magic)
//
//  „When a Hero you control is defeated by an opponent's card or effect, you
//   may immediately place this Creature from your discard pile into one of the
//   defeated Hero's free Support Zones, and if you do, draw until you have 8
//   cards in your hand. You can only play 1 \"Mausoleum Worm\" per turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Lauscher aus der ABLAGE OHNE Instanz (`discardHooks`, `engine._runDiscardHooks`
//    — Puzzle-Vorgaben und Mills legen Karten ohne verfolgte Instanz ab), ausgeloest vom
//    ENDGUELTIGEN Tod (`onHeroDefeatFinal`, Engine: nach dem Aufraeumen, vor dem
//    Extra-Leben). Verhinderte Tode (Guardian Angel & Co.) loesen NICHT aus,
//    Wiederbelebungen nach dem Tod schon. „Hero you control" = jeder von mir kontrollierte Held
//    (auch geliehen). „by an opponent's card or effect": die Quelle des
//    Schadens hat einen Besitzer, und der ist NICHT ich. Statusticks (Gift, Brand …) zaehlen dem Spieler, der den Status gesetzt hat (`appliedBy`).
//  • „place": PLATZIEREN (`placeFromPile`) — keine Stufen-/Aktionspruefung, auch
//    auf den Platz eines gefallenen Helden; nur freie, nicht versiegelte/
//    gesperrte Plaetze des GEFALLENEN Helden. Freiwillig (Ja/Nein, Zonenwahl).
//  • „if you do, draw until you have 8 cards": nach gelungener Platzierung auf
//    8 Handkarten nachziehen (nichts, wenn ich schon 8+ habe).
//  • „1 per turn": je Spieler und Zug ein Mal (`gs.hoptUsed`, gestempelt bei
//    gelungener Platzierung). Mehrere Kopien in der Ablage fragen je Held-KO nur
//    ein Mal.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mausoleum Worm';
const HOPT_KEY = 'mausoleum-worm';
const ZIEL_HAND = 8;

module.exports = {
  /** CPU: Angebot annehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {},   // der Lader ignoriert Skripte ohne `hooks`

  // Ablage-Lauscher OHNE Instanz (`engine._runDiscardHooks`): Puzzle-Vorgaben, Mills & Co.
  // legen Karten ohne verfolgte Instanz in die Ablage — ein instanzgebundener Haken sah sie nie.
  discardHooks: {
    // Endgueltiger Tod (nicht Rettung, aber auch Wiederbelebung danach) — siehe Engine.
    onHeroDefeatFinal: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const gefallen = ctx.hero;
      if (!gefallen?.name || gefallen.hp > 0) return;   // gerettet? dann feuert dieser Haken gar nicht
      if ((ps.discardPile || []).indexOf(CARD_NAME) < 0) return;      // nur aus MEINER Ablage
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;

      // Physische Position des gefallenen Helden + Kontrolle.
      let seite = -1, heroIdx = -1;
      for (let p = 0; p < (gs.players || []).length && heroIdx < 0; p++) {
        const hi = (gs.players[p]?.heroes || []).indexOf(gefallen);
        if (hi >= 0) { seite = p; heroIdx = hi; }
      }
      if (heroIdx < 0) return;
      if (engine.heroSideOf(seite, gefallen) !== pi) return;           // „a Hero you control"

      // „by an opponent's card or effect": Quelle mit Besitzer ≠ ich.
      // Der Verursacher kommt von der Engine: Besitzer der Quelle, bei Statusticks der Spieler,
      // der den Status gesetzt hat.
      const quellBesitzer = ctx.killerOwner;
      if (!isSeat(gs, quellBesitzer)) return;
      if (quellBesitzer === pi) return;

      // Pro Held-KO und Zug nur EIN Angebot, egal wie viele Kopien lauschen.
      const stempel = `${gs.turn}:${seite}-${heroIdx}`;
      if (gs._mausoleumAngebot === stempel) return;

      // Freie Plaetze des gefallenen Helden.
      const zonen = [];
      for (let z = 0; z < 3; z++) {
        if (engine.supportSlotBelegt(seite, heroIdx, z)) continue;
        if (engine.isSupportZoneLocked(seite, heroIdx, { source: CARD_NAME, cardName: CARD_NAME, via: 'place' })) continue;
        zonen.push({ heroIdx, slotIdx: z, label: `${gefallen.name} — Slot ${z + 1}`, owner: seite });
      }
      if (zonen.length === 0) return;
      gs._mausoleumAngebot = stempel;

      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: `${gefallen.name} was defeated! Place ${CARD_NAME} from your discard pile into one of its free Support Zones and draw until you have ${ZIEL_HAND} cards?`,
        confirmLabel: '🪱 Place!', cancelLabel: 'No', cancellable: true,
      });
      if (!antwort || antwort.cancelled || antwort.confirmed === false) return;
      if ((ps.discardPile || []).indexOf(CARD_NAME) < 0) return;       // waehrend der Frage weg?

      let ziel = zonen[0];
      if (zonen.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'zonePick', title: CARD_NAME,
          description: `Place ${CARD_NAME} into which Support Zone?`,
          zones: zonen, cancellable: true,
        });
        if (!wahl || wahl.cancelled) return;
        ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx);
        if (!ziel) return;
      }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const inst = await engine.placeFromPile(pi, 'discard', CARD_NAME, heroIdx, ziel.slotIdx, {
        source: CARD_NAME, ...(seite !== pi ? { heldSeite: seite } : {}),
      });
      if (!inst) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

      const fehlt = Math.max(0, ZIEL_HAND - (ps.hand || []).length);
      if (fehlt > 0) await engine.actionDrawCards(pi, fehlt, { source: CARD_NAME });
      engine.log('mausoleum_worm', { player: ps.username, hero: gefallen.name, drew: fehlt });
      engine.sync();
    },
  },
};
