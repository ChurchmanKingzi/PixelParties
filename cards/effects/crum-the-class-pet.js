'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Crum, the Class Pet"  (v1307, neuer Text)
//  Creature — Magic Arts / Summoning Magic Lv1
//
//  "You may once per turn swap a card from your hand with a Double Spell
//   in your discard pile, but delete it at the end of the turn if it is
//   still in your hand or discard pile. You can only control 1 "Crum,
//   the Class Pet"."
//
//  • Aktivierbarer Creature-Effekt (Einmal pro Zug: Engine-Sperre je
//    Instanz; `false` = Abbruch, Sperre zurueck).
//  • Reihenfolge: erst den Double Spell in der Ablage waehlen (Galerie),
//    dann die Handkarte (handPick) — beides abbrechbar. Erst danach wird
//    getauscht: Spell Ablage → Hand (Stapel-Schicht, Ablage-Sperren),
//    dann die Handkarte in die Ablage.
//  • Der Tausch ist KEIN Abwurf (Als Ruling 23.9.): die Handkarte wandert
//    ohne Abwurf-Hooks in die Ablage.
//  • „delete it …": `markiereZugendeLoeschung` (Engine) — gilt auch, wenn
//    Crum bis dahin weg ist.
// ═══════════════════════════════════════════
const { istDoppelSpell, kontrolliert } = require('./_double-shared');
const { searchBlocked } = require('./_search-shared');

const CARD_NAME = 'Crum, the Class Pet';

function doppelInAblage(engine, pi) {
  const db = engine._getCardDB();
  return [...new Set((engine.gs.players[pi]?.discardPile || []).filter(n => istDoppelSpell(db[n])))];
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if ((engine.gs.players[pi]?.hand || []).length === 0) return false;
    if (!engine.pileOutAllowed(pi, 'discard', {})) return false;
    // Such-Template Bauform ②: Schritt 1 holt aus der Ablage auf die Hand.
    if (searchBlocked(engine, pi, 'discard')) return false;
    return doppelInAblage(engine, pi).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    const kandidaten = doppelInAblage(engine, pi);
    if (kandidaten.length === 0 || (ps.hand || []).length === 0) return false;
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a Double Spell in your discard pile to swap into your hand.',
      cards: kandidaten.map(name => ({ name, source: 'discard' })),
      cancellable: true, searchToHand: true, searchPile: 'discard',
    });
    const spell = wahl?.cardName;
    if (!spell || !kandidaten.includes(spell)) return false;

    const hand = await engine.promptGeneric(pi, {
      type: 'handPick', title: CARD_NAME,
      description: `Choose the card from your hand that goes to the discard pile in exchange for "${spell}".`,
      eligibleIndices: (ps.hand || []).map((_, i) => i),
      minSelect: 1, maxSelect: 1, cancellable: true, confirmLabel: '🐹 Swap!',
    });
    const pick = hand?.selectedCards?.[0];
    if (!pick || ps.hand[pick.handIndex] !== pick.cardName) return false;

    // ── Tausch ──
    // ★ v1309 (Als Befund 23.9.): Bauform wie Shooting Star — ERST beide
    // Fluege GLEICHZEITIG senden (sie duerfen sich kreuzen), DANN den
    // Zustand aendern. Vorher war es umgekehrt: der Client sah die Hand
    // schon veraendert und der Rueckflug lief ins Leere; ausserdem kam
    // der Hand-Hook (Albrecht) noch VOR dem Flug. Sperren werden VOR den
    // Fluegen geprueft, damit nie eine Karte fliegt, die dann bleibt.
    if (!engine.pileOutAllowed(pi, 'discard', {})) return false;
    if (searchBlocked(engine, pi, 'discard')) return false;
    if (!(ps.discardPile || []).includes(spell)) return false;

    const handIdx = pick.handIndex;
    // ★ v1312 (Als Befund 23.9.) — die Reihenfolge, auf die der Client
    // angewiesen ist:
    //  ⓪ Spell aus der Ablage nehmen (Sperren, ggf. Freikauf-Dialog) —
    //    scheitert das, ist noch nichts geflogen;
    //  ① Anflug Ablage → Hand ansagen, SOLANGE der Client den Spell noch
    //    oben auf der Ablage sieht (er verdeckt ihn dort);
    //  ② Zustand senden: die Ablage wird KUERZER — daran hebt der Client
    //    die Verdeckung wieder auf. Vorher wurde der Stapel nie kuerzer
    //    (−1 +1), die Verdeckung hing bis zum Notnagel (1,2 s) und traf
    //    die abgelegte Karte: der spuerbare Leer-Moment;
    //  ③ Abflug Hand → Ablage ansagen, Handkarte raus, Zustand senden —
    //    die Nachbarn ruecken sofort auf, beide Karten fliegen zugleich;
    //  ④ nach der Flugzeit landet der Spell in der Hand.
    const geholt = await engine.takeFromPile(pi, 'discard', spell, { source: CARD_NAME });
    if (!geholt) { engine.sync(); return false; }
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: spell, from: 'discard', to: 'hand',
      toHandIdx: ps.hand.length - 1, finalHandSize: ps.hand.length,
    });
    engine.sync();

    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: pick.cardName, from: 'hand', to: 'discard', fromHandIdx: handIdx,
    });
    const weg = await engine.takeFromPile(pi, 'hand', handIdx, { source: CARD_NAME });
    if (!weg) { engine.returnToPile(pi, 'discard', spell); engine._trackCard(spell, pi, 'discard'); engine.sync(); return false; }
    if (!ps.discardPile) ps.discardPile = [];
    ps.discardPile.push(weg.name);
    engine._trackCard(weg.name, pi, 'discard');
    engine.sync();
    await engine._delay(650);

    ps.hand.push(spell);
    const spellInst = engine._trackCard(spell, pi, 'hand');
    const spellIdx = ps.hand.length - 1;
    // Marke VOR den Hooks setzen — ein Hook (z.B. ein Abwurf) koennte die
    // Hand umbauen; das Handfeld folgt der Kopie ab hier von selbst.
    engine.markiereZugendeLoeschung(pi, spellIdx, spell, CARD_NAME);
    engine.sync();
    await engine.runHooks('onCardAddedFromDiscardToHand', {
      playerIdx: pi, fromOwnerIdx: pi, addedCard: spellInst, addedCardName: spell,
      source: CARD_NAME, _skipReactionCheck: true,
    });
    engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `swapped ${weg?.name || 'a card'} for ${spell} (deleted at end of turn)` });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME) return undefined;
    if (p.type === 'cardGallery') {
      const db = engine._getCardDB();
      const best = [...(p.cards || [])].sort((a, b) => (db[b.name]?.level || 0) - (db[a.name]?.level || 0))[0];
      return best ? { cardName: best.name, source: best.source } : undefined;
    }
    return undefined;   // handPick: generischer CPU-Abwurf-Picker (schlechteste Karte)
  },
};
