// ═══════════════════════════════════════════
//  CARD EFFECT: "Paraseed Zombie"
//  Spell (Reaction, Lv1, Decay Magic)
//
//  „Play this card immediately when a Hero you control would be
//   defeated by an opponent's card or effect. Place a \"Paraseed\" from
//   your hand or deck into that Hero's free Support Zone, and if you
//   do, that Hero's HP drop to 1 instead. Delete this card.\"
//
//  Bauform
//  ───────
//  • Vor-Schadens-Fenster wie `escape.js`: `isPreDamageReaction` +
//    `preDamageCondition` + `preDamageResolve`. Nur dieses Fenster
//    liegt frueh genug, um den toedlichen Treffer zu ersetzen.
//  • „HP drop to 1 instead\" ist kein Schadensdeckel, sondern eine
//    Ersetzung: der Treffer wird negiert (`{ negated: true }`) und
//    die HP werden gesetzt. Ein Held mit 500 HP, der 40 Schaden
//    genommen haette, steht danach ebenfalls auf 1 — genau das sagt
//    der Text.
//  • „and if you do\": findet sich keine Paraseed oder keine freie
//    Zone, greift die Karte gar nicht erst (Bedingung).
//  • „Delete this card\" — `deleteOnUse: true` ist die Marke, die das
//    Fenster liest; die Karte wandert in den Deleted Pile.
//
//  Reichweite (bewusst): das Fenster kennt nur SCHADEN. Ein Held,
//  der ohne Schaden entfernt wird (Zwangstod, Deckel-Effekte), faellt
//  nicht darunter — dieselbe Grenze, die Escape und Emergency Spell
//  Armor tragen.
// ═══════════════════════════════════════════

const {
  isParaseedCreature, freeSlotOnHero, syncParaseedPoison,
} = require('./_paraseed-shared');

const CARD_NAME = 'Paraseed Zombie';

/** Erste Paraseed in Hand oder Deck — Hand zuerst (Text: „hand or deck\"). */
function findeParaseed(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  const inHand = (ps.hand || []).find(n => isParaseedCreature(n, engine));
  if (inHand) return { name: inHand, from: 'hand' };
  const imDeck = (ps.mainDeck || []).find(n => isParaseedCreature(n, engine));
  if (imDeck) return { name: imDeck, from: 'deck' };
  return null;
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPreDamageReaction: true,
  // v718: Der Text sagt „would be DEFEATED" — die Karte greift damit
  // auch gegen Insta-Kills ohne Schaden (Eraser Beam, Hand of Death).
  // Reine Schadensminderer tragen dieses Flag NICHT.
  firesOnDefeat: true,
  // v800: der Caster ist der GETROFFENE Held — wie im Skript unten
  // schon geprueft; das Fenster zieht jetzt auch seine Wisdom-Kosten
  // ein (`_rxCastPlan`).
  casterIsTarget: true,

  preDamageCondition(gs, ownerIdx, engine, target, heroIdx, source, amount /*, type */) {
    if (!(amount > 0)) return false;
    if (target?.hp == null || amount < target.hp) return false;   // nicht toedlich

    // „by an opponent's card or effect\" — die Quelle muss der
    // Gegenseite gehoeren. Eigener Rueckstoss und eigenes Gift
    // zaehlen nicht.
    const quellSeite = source?.owner ?? source?.controller;
    if (!Number.isInteger(quellSeite) || quellSeite === ownerIdx) return false;

    // „a Hero you control\" — nach Kontrolle, nicht nach Spalte.
    if (engine.heroSideOf(ownerIdx, target) !== ownerIdx) return false;

    // Wirkbarkeit (Decay Magic Lv1) am betroffenen Helden.
    const cd = engine._getCardDB()[CARD_NAME];
    if (!cd || !engine.heroMeetsLevelReq(ownerIdx, heroIdx, cd)) return false;

    // „and if you do\": ohne Paraseed und ohne freie Zone kein Effekt.
    if (!findeParaseed(engine, ownerIdx)) return false;
    if (freeSlotOnHero(engine, ownerIdx, heroIdx) < 0) return false;
    return true;
  },

  async preDamageResolve(engine, ownerIdx, target, heroIdx /*, source, amount, type */) {
    const ps = engine.gs.players[ownerIdx];
    const fund = findeParaseed(engine, ownerIdx);
    const slot = freeSlotOnHero(engine, ownerIdx, heroIdx);
    if (!fund || slot < 0) return null;             // Bedingung war erfuellt, Brett hat sich gedreht

    if (fund.from === 'deck') {
      // Aus dem Deck: selbst ausbuchen und den Weg sichtbar machen —
      // `actionPlaceCreature` kennt nur 'hand' und 'discard'.
      const _taken_idx = await engine.takeFromPile(ps, 'deck', fund.name, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_idx) return null;
      engine._broadcastEvent('play_pile_transfer', {
        owner: ownerIdx, cardName: fund.name,
        from: 'deck', to: 'support',
        toHeroIdx: heroIdx, toSlotIdx: slot,
      });
      engine.sync();
      await engine._delay(520);
    }

    await engine.actionPlaceCreature(fund.name, ownerIdx, heroIdx, slot, {
      source: fund.from === 'hand' ? 'hand' : 'deck',
      sourceName: CARD_NAME,
      animationType: 'poison_splash',
    });
    if (fund.from === 'deck') engine.shuffleDeck(ownerIdx, 'main');

    // Das Gift der frisch gelegten Paraseed (der Eintritts-Hook legt
    // es bereits auf; der Abgleich ist die Sicherung fuer den Fall,
    // dass die Platzierung ohne Hooks lief).
    await syncParaseedPoison(engine, ownerIdx, heroIdx);

    // „that Hero's HP drop to 1 instead\" — Ersetzung, kein Deckel.
    target.hp = 1;
    engine.sync();
    await engine._delay(300);

    return { negated: true };
  },

  // „Delete this card.\"
  // Gelesen von `_checkPreDamageHandReactions`: die Karte wandert in
  // den Deleted Pile statt in die Ablage (dieselbe Weiche wie Potions).
  deleteOnUse: true,
};
