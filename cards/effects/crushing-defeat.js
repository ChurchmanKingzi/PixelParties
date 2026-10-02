'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Crushing Defeat"
//  Spell (Reaction, Magic Arts Lv0)
//
//  „Play this card immediately when the last Creature you control is defeated
//   by an opponent's card or effect. Search your deck for any card, reveal it
//   and add it to your hand."
//
//  (Neuer Effekt — Als Vorgabe 2.10.; vorher: „all Creatures … at the same time (at least 2)".)
//
//  ── FENSTER ───────────────────────────────────────────────────────
//  `isCreaturesDefeatedReaction` — das Sammel-Fenster: es oeffnet sich EINMAL am
//  Ende eines Vorgangs (Flaechenschlag, Zerstoerung) mit allen Opfern und am
//  fertigen Zustand. Damit ist „the LAST Creature" pruefbar: mindestens ein Opfer
//  dieses Vorgangs ging auf eine Karte/einen Effekt des GEGNERS zurueck, und
//  der Spieler kontrolliert danach KEINE Creature mehr (bei einem Flaechenschlag
//  gilt das letzte Opfer; ein einzelner Tod der einzigen Creature genauso).
//  Statusticks ohne Verursacher zaehlen nicht.
//
//  ── WIRKUNG ───────────────────────────────────────────────────────
//  Beliebige Karte aus dem Deck waehlen (Galerie, Such-Sperren beachtet) → aufdecken →
//  auf die Hand (`searchDeckForNamedCard`: Flug, Aufdecken, danach mischen wie bei jeder Suche).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { skipIfSearchBlocked, searchBlocked, suchAbfrage } = require('./_search-shared');

const CARD_NAME = 'Crushing Defeat';

function quellSeite(src) {
  const s = src?.controller ?? src?.owner;
  return typeof s === 'number' ? s : -1;
}

/** Kontrolliert `pi` noch eine Creature auf dem Brett? */
function kontrolliertCreature(engine, pi) {
  const db = engine._getCardDB();
  return engine.cardInstances.some(inst => {
    if (inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

module.exports = {
  activeIn: ['hand'],
  isCreaturesDefeatedReaction: true,

  creaturesDefeatedCondition(gs, pi, engine, defeated) {
    if (!Array.isArray(defeated) || defeated.length === 0) return false;
    // Ein Opfer dieses Vorgangs fiel durch eine Karte/einen Effekt des Gegners (Statusticks ohne Quelle: nein).
    const durchGegner = defeated.some(d => {
      const seite = quellSeite(d.source);
      return seite >= 0 && seite !== pi;
    });
    if (!durchGegner) return false;
    if (kontrolliertCreature(engine, pi)) return false;      // „the LAST Creature"
    if ((gs.players[pi]?.mainDeck || []).length === 0) return false;
    return !searchBlocked(engine, pi, 'deck');
  },

  async creaturesDefeatedResolve(engine, pi) {
    const ps = engine.gs.players[pi];
    if (!ps || (ps.mainDeck || []).length === 0) return;
    if (skipIfSearchBlocked(engine, pi, CARD_NAME)) return;
    const karten = [...new Set(ps.mainDeck)].sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, source: 'deck', count: ps.mainDeck.filter(x => x === name).length }));
    // Die Reaktion ist bezahlt: die Auswahl ist nicht abbrechbar.
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards: karten, ...suchAbfrage('deck'),
      title: CARD_NAME, source: CARD_NAME,
      description: 'Choose any card from your deck to reveal and add to your hand.',
      confirmLabel: '🔎 Search', confirmClass: 'btn-info',
      cancellable: false,
    });
    const name = wahl?.cardName && ps.mainDeck.includes(wahl.cardName) ? wahl.cardName : karten[0]?.name;
    if (!name) return;
    await engine.searchDeckForNamedCard(pi, name, CARD_NAME);
    engine.log('crushing_defeat', { player: ps.username, card: name });
    engine.sync();
  },

  // CPU: reiner Gewinn — immer spielen, erste Karte nehmen.
  cpuResponse(engine, kind, payload) {
    if (payload?.type === 'confirm' && payload?.title === CARD_NAME) return { confirmed: true };
    if (kind === 'generic' && payload?.type === 'cardGallery' && payload?.title === CARD_NAME) {
      return { cardName: payload.cards?.[0]?.name };
    }
    return undefined;
  },
};
