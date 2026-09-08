// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiona, the Empty Vessel of a Forgotten Sorceress"
//  Ascended Hero — Ascension bonus: Magic Arts 3
//
//  "You must play this Hero from your hand on top of a
//   'Fiona, the Princess of Blackport' you control that is
//   equipped with 'Forbidden Grimoire of a Forgotten Sorceress'
//   and one or more Heroes. Once per turn, you may choose any
//   Spell from your deck, reveal it and add it to your hand.
//   That Spell's level is reduced by 3 for the rest of the turn."
//
//  ── AUFSTIEG ───────────────────────────────────────────────────────
//  Bedingung und Bereitschaft liegen in `_fiona-shared.js`; hier wird
//  sie nur ueber `ascensionCondition` abgefragt (die Engine prueft sie
//  VOR dem Hand-Splice, ein abgelehnter Aufstieg frisst die Karte
//  nicht). Bonus wie bei Arthor ueber `performAscensionBonus` —
//  eine Schule, Magic Arts (Al 30.8.).
//
//  ── HELDENEFFEKT ───────────────────────────────────────────────────
//  Galerie ueber alle Spells im Deck (je Name ein Eintrag), Zielkarte
//  ueber `actionAddCardFromDeckToHand` — der Helfer zeigt die Karte
//  dem Gegner („reveal it"), feuert onCardAddedToHand und respektiert
//  die Hand-Sperre. Die Reduktion gilt NUR fuer die eine geholte Kopie
//  (Als Ruling 30.8.) — deshalb nicht der namensweite Divine-Gift-
//  Speicher, sondern der Handindex-Rabatt `_handLevelOffsetsTransient`
//  (wandert bei Hand-Splices mit der Kopie, faellt weg, sobald sie die
//  Hand verlaesst) plus Verfallsstempel `_handLevelOffsetsExpireTurn`,
//  den der Zugbeginn abraeumt = „for the rest of the turn".
//
//  HOPT: die Engine stempelt den Heldeneffekt, sobald onHeroEffect
//  nicht `false` liefert. Abbruch in der Galerie → `false`, kein Stempel.
//  Der Galerie-`title`/`source` ist STABIL (CARD_NAME): daran haengt
//  das Tutor-Lernen der CPU.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { fionaAscensionMet } = require('./_fiona-shared');

const CARD_NAME = 'Fiona, the Empty Vessel of a Forgotten Sorceress';
const REDUCTION = 3;

/** Alle Spell-Namen im Hauptdeck, entdoppelt und stabil sortiert. */
function spellsInDeck(ps, cardDB) {
  const seen = new Set();
  const out = [];
  for (const n of (ps.mainDeck || [])) {
    if (seen.has(n)) continue;
    const cd = cardDB[n];
    if (!cd || !hasCardType(cd, 'Spell')) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort();
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  ascensionCondition(gs, pi, heroIdx, engine) {
    return fionaAscensionMet(engine, pi, heroIdx, null);
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Magic Arts']);
  },

  // Nicht aktivierbar, wenn nichts zu holen ist oder die Hand gesperrt
  // ist — der Effekt graut dann aus statt in einen leeren Prompt zu
  // laufen. Leben/Frozen/Stunned/Negated/HOPT prueft die Engine.
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps || ps.handLocked) return false;
    return spellsInDeck(ps, engine._getCardDB()).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    const hero    = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (ps.handLocked) return false;

    const cardDB = engine._getCardDB();
    const names = spellsInDeck(ps, cardDB);
    if (names.length === 0) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: names.map(name => ({ name, source: 'deck' })),
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Choose a Spell from your deck. It is revealed and added to your hand, and its level is reduced by ${REDUCTION} for the rest of the turn.`,
      confirmLabel: '📖 Take Spell!',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return false;
    const chosen = result.cardName;
    if (!ps.mainDeck.includes(chosen)) return false;

    await engine.effectSourceGlow(pi, CARD_NAME);

    // Deck → Hand, mit Flug, Reveal an den Gegner und Tutor-Hook.
    const ok = await engine.actionAddCardFromDeckToHand(pi, chosen, { source: CARD_NAME });
    if (!ok) return false;

    // „reduced by 3 for the rest of the turn" — fuer GENAU DIESE Kopie
    // (Als Ruling 30.8.), nicht namensweit: transienter Handindex-
    // Rabatt (Sparkfly-Muster) plus Verfallsstempel auf den laufenden
    // Zug; der Zugbeginn raeumt beides ab (v654, `_handLevelOffsetsExpireTurn`).
    // `actionAddCardFromDeckToHand` haengt die Karte hinten an.
    const handIdx = ps.hand.lastIndexOf(chosen);
    if (handIdx >= 0) {
      if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
      if (!ps._handLevelOffsetsExpireTurn) ps._handLevelOffsetsExpireTurn = {};
      ps._handLevelOffsetsTransient[handIdx] = Math.min(ps._handLevelOffsetsTransient[handIdx] || 0, -REDUCTION);
      ps._handLevelOffsetsExpireTurn[handIdx] = gs.turn;
    }

    engine.log('fiona_vessel_spell', {
      player: ps.username, hero: CARD_NAME, spell: chosen, amount: REDUCTION,
    });
    engine.sync();
    return true;
  },
};
