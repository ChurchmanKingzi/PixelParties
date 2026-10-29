'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Atta, Speaker of Desires"
//  Hero (400 HP / 30 ATK, Startabilities Magic Arts + Premonition)
//
//  „Once per turn, when you reveal exactly 1 Normal Spell from your deck or hand that this Hero can use, except by the effect of an Ability, you
//   may delete that Spell. At the end of your opponent's next turn, if this Hero is not defeated and that Spell is still deleted, this Hero
//   immediately uses it as an additional Action, regardless of its level and in spite of any negative status effects. Spells this Hero uses that
//   would be sent to the discard pile are deleted instead."
//
//  ── Bausteine ─────────────────────────────────────────────────────
//  • Aufdecken: Hook `onCardsRevealed` (`engine.meldeAufgedeckt`, gesammelt je Wirkung, EIN Aufruf am Ende der Wirkung). Aufdecken durch den Effekt einer
//    ABILITY (Premonition, Inventing, Navigation …) meldet die Engine gar nicht erst. Quellen: Such-Fenster (`deckSearchReveal`), `revealToOpponent`, Deck-Aufdecker (`_deck-top-shared`)
//    und Tutoren, die ihr Aufdecken VOR dem Verschieben melden (`engine.aufdeckEreignis`, Welle 85c; Tabelle in CARD_API.md). „Löschen STATT auf die Hand" (Al 29.10.): bei diesen Wegen löscht Atta
//    die Karte, solange sie noch im Deck liegt — sie kommt nie auf die Hand (keine Hand-Zugangs-Wirkungen), der Hook füllt dafür `ctx.geloescht`. Die übrigen Wege (Deck-Aufdecker, deren Spell
//    im Deck bleibt) werten weiter NACH der Wirkung aus. Potion Deck und Side Deck zählen als „your deck“ (W85d, `ctx.zone` 'potionDeck'/'sideDeck'). Selbst-entsorgende Aufdecker (Chaos Magic, Third Circle, Heart of Cards/Oracle bei Fehlschlag …) lösen Atta nicht aus.
//  • Verzoegertes Wirken: gemeinsamer Baustein mit Ghostly Warning (`_verzoegert-zauber-shared.js`) — Pflicht, ohne Stufen-/Status-/Wisdom-Pruefung.
//  • Loeschen statt Ablage: Hero-Flag `deletesOwnSpellsInsteadOfDiscard`, gelesen von `engine.spellGoesToDeletedInstead` (doPlaySpell, Sofort-Guesse,
//    Reaktionsketten).
//
//  ── Auslegung ─────────────────────────────────────────────────────
//  • „exactly 1 Normal Spell … that this Hero can use": unter den zusammen aufgedeckten Karten ist GENAU EINE ein Normal Spell, den Atta wirken kann
//    (Stufe/Schulen wie beim Ausspielen, auch ueber Wisdom). Andere aufgedeckte Karten (Creatures, nicht wirkbare Zauber) stoeren nicht.
//  • „Once per turn": hart, je Spieler und Karte (Ruling 22.9., `_hero-hopt-shared.js`); wird abgelehnt oder verpufft der Effekt, ist sie wieder frei.
//  • „you may delete": Ja/Nein. Geloescht wird die aufgedeckte Karte da, wo sie JETZT liegt (Hand, sonst Deck). Ist sie weg, passiert nichts.
//  • „At the end of your opponent's next turn": der Zug, in dem sie ausloest, zaehlt nicht (Ende des naechsten echten Gegnerzuges nach der Vormerkung).
//  • Das spaetere Wirken ist ein Zauber, den Atta wirkt — er wird danach also wieder geloescht statt abgelegt.
// ═══════════════════════════════════════════

const { vormerken } = require('./_verzoegert-zauber-shared');
const { heldenSperreFrei, heldenSperreSetzen, heldenSperreFreigeben } = require('./_hero-hopt-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Atta, Speaker of Desires';
const HOPT = 'atta_delete';

module.exports = {
  activeIn: ['hero'],

  // „Spells this Hero uses that would be sent to the discard pile are deleted instead." (`engine.spellGoesToDeletedInstead`)
  deletesOwnSpellsInsteadOfDiscard: true,

  hooks: {
    onCardsRevealed: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      if (ctx.playerIdx !== pi) return;                       // „you reveal"
      if (ctx.sourceName === 'Chaos Magic') return;           // W85c (Al): die von Chaos Magic aufgedeckten/reservierten Karten sind für Atta tabu
      const heroIdx = ctx.cardHeroIdx;
      const feld = ctx.cardHeroOwner ?? pi;                   // Brettseite des Helden
      const hero = ctx.attachedHero ?? gs.players[feld]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      const ps = gs.players[pi];
      if (!ps) return;

      // „exactly 1 Normal Spell … that this Hero can use"
      const db = engine._getCardDB();
      const kandidaten = (ctx.cardNames || []).filter(n => {
        const cd = db[n];
        if (!cd || !hasCardType(cd, 'Spell') || (cd.subtype || '').toLowerCase() !== 'normal') return false;
        try { return !!engine.heroMeetsLevelReq(feld, heroIdx, cd); } catch { return false; }
      });
      if (kandidaten.length !== 1) return;
      const name = kandidaten[0];

      // „Once per turn"
      if (!heldenSperreFrei(gs, HOPT, pi)) return;
      // Wo liegt die Karte jetzt? (Suchergebnis: auf der Hand; oberste Deckkarte: im Deck.)
      const liegt = (zone) => zone === 'hand' ? (ps.hand || []).includes(name) : zone === 'potionDeck' ? (ps.potionDeck || []).includes(name) : zone === 'sideDeck' ? (ps.sideDeck || []).includes(name) : (ps.mainDeck || []).includes(name);
      // W85d (Al): Potion Deck und Side Deck zählen als „your deck" — dort aufgedeckt, wird dort gelöscht (vor dem Hand-Zugang).
      const reihenfolge = (ctx.zone === 'potionDeck' || ctx.zone === 'sideDeck') ? [ctx.zone] : ctx.zone === 'deck' ? ['deck', 'hand'] : ['hand', 'deck'];
      const wo = reihenfolge.find(liegt) || null;
      if (!wo) return;

      heldenSperreSetzen(gs, HOPT, pi);
      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Delete ${name}? ${hero.name} will use it as an additional Action at the end of your opponent's next turn.`,
        showCard: name,
        confirmLabel: '🔮 Delete it!',
        cancelLabel: 'No',
      });
      if (!confirmed) { heldenSperreFreigeben(gs, HOPT, pi); return; }

      // Die Karte kann sich waehrend der Abfrage bewegt haben.
      const jetzt = liegt(wo) ? wo : (reihenfolge.find(liegt) || null);
      if (!jetzt) { heldenSperreFreigeben(gs, HOPT, pi); return; }
      const vorher = gs.players.map(p => (p.deletedPile || []).length);
      const ok = await engine.deleteFromPile(pi, jetzt, name, { source: CARD_NAME });
      const nachher = gs.players.map(p => (p.deletedPile || []).length);
      const pileOwnerPi = nachher.findIndex((n, i) => n > vorher[i]);
      if (!ok || pileOwnerPi < 0 || (gs.players[pileOwnerPi].deletedPile || []).slice(-1)[0] !== name) {   // gerettet (Ash Worms …) oder nicht gelungen
        heldenSperreFreigeben(gs, HOPT, pi);
        return;
      }
      if (Array.isArray(ctx.geloescht)) ctx.geloescht.push(name);   // W85c: Aufdeck-Ereignis VOR dem Verschieben — der Tutor nimmt diese Karte nicht auf die Hand
      engine._broadcastEvent('play_zone_animation', { type: 'atta_books', owner: feld, heroIdx, zoneSlot: -1, phase: 'delete' });
      await engine._delay(700);
      vormerken(engine, {
        kind: 'atta', quelle: CARD_NAME, zugspieler: engine.opponentOf(pi),
        spellName: name, pileOwnerPi, castPi: pi, wirkerSeite: feld, heroIdx,
      });
      engine.log('atta_delete', { player: ps.username, hero: hero.name, spell: name, from: jetzt });
      engine.sync();
    },
  },

  // CPU: Loeschen und spaeter wirken ist fast immer gut (kostenloser Zusatzzauber) — immer bejahen.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
