// ═══════════════════════════════════════════
//  CARD EFFECT: "Potion Juggler"
//  Creature (Summoning Magic Lv1, Normal) — 50 HP
//
//  „You may delete a Potion from your hand or discard pile to summon this Creature as an additional Action. You may once per turn
//   delete the top 2 cards from your Potion Deck to draw a card from your Potion Deck."
//
//  ── ① BESCHWÖRUNG ALS ZUSATZAKTION (Bauform Big Gwen Guard) ─────────────────
//  Kosten: eine Potion aus Hand ODER Ablage wird GELÖSCHT (Galerie mit beiden Quellen, wie Mass Multiplication). Die Stufenvoraus-
//  setzung bleibt: der Held braucht Summoning Magic Lv1 — der Text hebt sie nicht auf (kein `canBypassLevelReq`).
//    • Main Phase ODER Action Phase ohne freie Aktion → die Zusatzaktion ist der EINZIGE Weg: `inherentAction` ist wahr, die Potion
//      wird verlangt (Abbruch = die Beschwörung wird abgelehnt, nichts verbraucht).
//    • Action Phase mit freier Aktion UND Potion → beide Wege sind möglich: `inherentAction` ist falsch (die Engine zieht die Aktion
//      ein), und `beforeSummon` fragt „Special" (Potion löschen, Aktion zurück) oder „Normal" (Aktion des Helden, keine Potion).
//      „Special" stempelt `gs._summonModeUpgradedToInherent` — server.js erstattet die Aktion.
//    • Ohne Potion gibt es nur den normalen Weg (Lv1 Summoning Magic, kostet die Aktion).
//    • Effekt-Beschwörungen (Living Illusion, Wiederbelebung …) zahlen nichts: Kosten gelten nur für den Spieler-Weg
//      (`ctx._isNormalSummon`).
//
//  ── ② EINMAL PRO ZUG: OBERSTE 2 KARTEN LÖSCHEN, 1 ZIEHEN ─────────────────────
//  `onCreatureEffect` (engine-HOPT bei nicht-`false`-Rückgabe): die obersten 2 Karten des Potion Decks wandern in den Gelöscht-
//  Stapel (`deleteFromPile(pi,'potionDeck',…)`, Flug inklusive), danach `actionDrawFromPotionDeck(pi, 1)` — das Ziehen läuft wie
//  jeder Potion-Zug über die Fenster (Tuscan Mystic, Philosopher's Stone, Zieh-Sperre). Gesperrt (nicht aktivierbar), wenn das
//  Ziehen nicht möglich wäre (Hand-/Zieh-Sperre, `potionDrawBanned`) oder das Potion Deck weniger als 3 Karten hat — dann würde
//  man zwei Karten löschen, ohne zu ziehen. Im Skill Test sind die Decks im Ruhezustand leer: das Potion Deck wird für die drei
//  Karten aus dem Pool gefüllt (`stFillDeck`), die gelöschten verlassen den Pool.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `potion_juggle` (Pixelart, ANIM_REGISTRY) am Platz des Jonglierers beim Effekt: drei Flaschen kreisen in einem Bogen, bevor
//  die obersten Karten fliegen. Die Löschflüge der Potions kommen aus den Engine-Primitiven.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Potion Juggler';
const DELETE_TOP = 2;
const JUGGLE_MS = 900;

/** Löschbare Potions: Galerie-Einträge `{ name, source: 'hand'|'discard', count }`. */
function loeschbarePotions(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const zaehle = (liste, source) => {
    const map = {};
    for (const n of (liste || [])) { if (hasCardType(db[n], 'Potion')) map[n] = (map[n] || 0) + 1; }
    return Object.entries(map).map(([name, count]) => ({ name, source, count }));
  };
  return [...zaehle(ps.hand, 'hand'), ...zaehle(ps.discardPile, 'discard')]
    .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
const hatPotion = (engine, pi) => loeschbarePotions(engine, pi).length > 0;

/** Ist die Aktion des Helden noch frei? Nur die Action Phase kennt sie (Bauform Big Gwen Guard / `doPlayCreature`). */
function aktionFrei(gs, pi, heroIdx) {
  if (gs.currentPhase !== 3) return false;
  const ps = gs.players[pi];
  if (!ps) return false;
  if ((ps.heroesActedThisTurn || []).length === 0) return true;
  const bonus = (ps.bonusActions?.heroIdx === heroIdx && (ps.bonusActions.heroOwner ?? pi) === pi && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0);
  return !!bonus;
}

/** Zwang zur Zusatzaktion: Main Phase oder keine freie Aktion in der Action Phase. */
function erzwungen(gs, pi, heroIdx) {
  const main = gs.currentPhase === 2 || gs.currentPhase === 4;
  return main || !aktionFrei(gs, pi, heroIdx);
}

/** Kosten zahlen: Potion wählen und löschen. `false` = abgebrochen / nicht gezahlt. */
async function zahleKosten(engine, pi) {
  const ps = engine.gs.players[pi];
  const galerie = loeschbarePotions(engine, pi);
  if (galerie.length === 0) return false;
  const wahl = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: galerie,
    title: CARD_NAME,
    description: 'Delete a Potion from your hand or discard pile to summon Potion Juggler as an additional Action.',
    cancellable: true,
    cancelLabel: 'Cancel summon',
  });
  if (!wahl || wahl.cancelled || typeof wahl.cardName !== 'string') return false;
  const name = wahl.cardName;
  const quelle = (wahl.source === 'discard' && ps.discardPile.includes(name)) ? 'discard'
    : (wahl.source === 'hand' && ps.hand.includes(name)) ? 'hand'
    : ps.hand.includes(name) ? 'hand' : ps.discardPile.includes(name) ? 'discard' : null;
  if (!quelle || !hasCardType(engine._getCardDB()[name], 'Potion')) return false;
  // Boris darf auch Löschkosten ignorieren (`borisVerzicht`, wie bei Abwurfkosten) — der Effekt läuft dann ohne Löschen.
  if (await engine.borisVerzicht(pi, 1, { source: CARD_NAME })) return true;
  return await engine.deleteFromPile(pi, quelle, name, { source: CARD_NAME, sourceOwner: pi });
}

/** Skill Test: Potion Deck mit den Karten füllen, die „darin liegen" (das Normalspiel braucht das nicht). */
function fuelleImSkillTest(engine, pi, n) {
  if (!engine.gs.skillTest) return;
  try { require('../../skilltest/engine-ext').stFillDeck(engine, pi, 'potion', n); } catch { /* ohne Modus nichts zu füllen */ }
}

/** Kann die Ziehen-Hälfte laufen? (Deck ≥ 3, Ziehen nicht gesperrt) */
function ziehenMoeglich(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || ps.handLocked || ps.drawLocked || ps.potionDrawBanned) return false;
  if ((ps.potionDeck || []).length >= DELETE_TOP + 1) return true;
  if (!engine.gs.skillTest) return false;
  return !engine.deckLeer(pi, 'potion');
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /**
   * Zusatzaktion nur dort, wo sie der EINZIGE Weg ist (Main Phase / keine freie Aktion) und eine Potion zu löschen ist. Im
   * mehrdeutigen Fall (Action Phase mit freier Aktion) entscheidet `beforeSummon`.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (!hatPotion(engine, pi)) return false;
    return erzwungen(gs, pi, heroIdx);
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    // Kosten gelten nur für den Spieler-Weg aus der Hand (Effekt-Beschwörungen zahlen nichts).
    if (ctx._isNormalSummon !== true) return true;
    if (!hatPotion(engine, pi)) return true;                      // ohne Potion: normaler Weg

    if (erzwungen(gs, pi, heroIdx)) return await zahleKosten(engine, pi);

    // Action Phase mit freier Aktion und Potion: beide Wege möglich.
    const wahl = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Choose how to summon ${CARD_NAME}:`,
      showCard: CARD_NAME,
      confirmLabel: '⚡ Special (delete a Potion, free Action)',
      cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
      cancellable: true,
      gerrymanderEligible: false,
    });
    if (!wahl) return true;                                       // normal: die Engine hat die Aktion schon eingezogen
    if (!(await zahleKosten(engine, pi))) return false;
    gs._summonModeUpgradedToInherent = pi;                        // server.js erstattet die Aktion
    return true;
  },

  canActivateCreatureEffect(ctx) {
    return ziehenMoeglich(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked || ps.drawLocked || ps.potionDrawBanned) return false;
    fuelleImSkillTest(engine, pi, DELETE_TOP + 1);
    if ((ps.potionDeck || []).length < DELETE_TOP + 1) return false;

    // Die Flaschen kreisen, dann fliegen die obersten Karten in den Gelöscht-Stapel.
    engine._broadcastEvent('play_zone_animation', {
      type: 'potion_juggle', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: JUGGLE_MS + 300,
    });
    await engine._delay(JUGGLE_MS);

    const oben = (ps.potionDeck || []).slice(0, DELETE_TOP);
    for (const name of oben) {
      await engine.deleteFromPile(pi, 'potionDeck', name, { source: CARD_NAME, sourceOwner: pi });
    }
    engine.log('potion_juggler', { player: ps.username, deleted: oben });
    const gezogen = await engine.actionDrawFromPotionDeck(pi, 1);
    engine.sync();
    void gezogen;
    return true;
  },

  /** CPU: bevorzugt eine Potion aus der Ablage (kostet keine Handkarte), sonst die billigste aus der Hand; „Special" statt „Normal". */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload) return undefined;
    if (payload.type === 'cardGallery' && payload.title === CARD_NAME) {
      const karten = payload.cards || [];
      const wahl = karten.find(c => c.source === 'discard') || karten[0];
      return wahl ? { cardName: wahl.name, source: wahl.source } : undefined;
    }
    if (payload.type === 'confirm' && payload.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },

  _test: { loeschbarePotions, erzwungen, aktionFrei },
};
