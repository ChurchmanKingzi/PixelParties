// ═══════════════════════════════════════════
//  CARD EFFECT: „The Stormblade"
//  Artifact (Equipment, 10 Gold)
//
//  "Equip this card to a Hero you control. Once per turn, when the
//   equipped Hero performs an Action during your Action Phase, shuffle
//   any number of cards from your hand back into the deck and draw the
//   same number of cards afterwards. Whenever your opponent
//   hits the equipped Hero with a card or effect, they must shuffle
//   their entire hand back into their deck and draw the same number of
//   cards afterwards. These draw effects cannot be prevented. You can
//   only have 1 \"The Stormblade\" equipped to your Heroes at a time."
//
//  ── ★★ v1158 (Balancing, Al 17.9.) ───────────────────────────────
//  Drei neue Grenzen, alle nur am EIGENEN Effekt:
//    • EINMAL PRO RUNDE — ueber den Einheitszaehler (`_charges.js`,
//      v417-Regel). `max: 1` bekommt bewusst KEINE Ladungsanzeige.
//    • NUR IN DER EIGENEN ACTION PHASE — Phase 3 UND am Zug.
//    • NUR EINE KLINGE JE SEITE — `canEquipToHero` prueft ALLE eigenen
//      Helden (nicht nur den Zielhelden wie bei Wanted Poster).
//  Der Treffer-Effekt beim Gegner bleibt unbegrenzt und in jeder Phase.
//
//  ── VORHER: NUR EIN STUB ──────────────────────────────────────────
//  Diese Datei trug bis v1066 allein die Seitenbindung
//  (`equipOwnSideOnly`); der gesamte Effekt fehlte. Die Seitenbindung
//  bleibt — „Equip this card to a Hero you control" ist bindend.
//
//  ── „CANNOT BE PREVENTED" (Als Ruling 14.9.) ──────────────────────
//  Bezieht sich ausdruecklich AUCH auf den Spieler-Status `drawLocked`,
//  nicht nur auf abfangende Karteneffekte. Dafuer gibt es den Vertrag
//  schon: `actionDrawCards(..., { _unpreventable: true })` umgeht
//  `handLocked`, `drawLocked` UND den `BEFORE_DRAW_BATCH`-Hook, ueber
//  den Karten wie Intrude eine Ziehung abfangen. „Champion, the
//  Stormbringer" benutzt ihn fuer dieselbe Textzeile.
//
//  Die Potion-Karten kommen ohnehin per `shift()` direkt aus dem
//  Potion-Deck — dieser Weg kennt gar keine Sperre.
//
//  ── „HITS … WITH A CARD OR EFFECT" (Als Ruling 14.9.) ─────────────
//  ALLES, was den Helden trifft: Schaden, Heilung, Buffs, Debuffs.
//  Nicht nur Schaden. Umgesetzt ueber die vier Hooks, die feuern,
//  NACHDEM etwas wirklich angekommen ist:
//    afterDamage · afterHeal · onStatusApplied · afterBuff
//  Das `afterBuff`-Gegenstueck gab es nicht und ist in v1066 neu — fuer
//  Buffs existierte nur das abbrechbare `BEFORE_HERO_EFFECT`, das zu
//  frueh feuert und auch spaeter abgebrochene Buffs mitzaehlen wuerde.
//
//  ★ GRENZE, die Al kennen muss: `actionAddBuff` nimmt KEIN
//  Quellen-Argument (der Kommentar in der Kreatur-Fassung sagt das
//  ausdruecklich). Ein Buff loest den Sturm deshalb nur aus, wenn der
//  Aufrufer eine Quelle mitgibt. Bewusst so herum: lieber einmal NICHT
//  ausloesen als beim eigenen Staerkungszauber.
//
//  ── „SHUFFLE YOUR ENTIRE HAND" ────────────────────────────────────
//  Genau der Weg von „Elana, the Rocky Rebel", inklusive ihrer beiden
//  teuer gelernten Feinheiten:
//    • `shuffleBackEligibleHandCards` filtert Hatusbal-gesperrte Karten;
//      gezogen wird, was TATSAECHLICH zurueckging, nicht die alte
//      Handgroesse;
//    • Karten, die ins POTION-Deck zurueckwandern, werden auch VON DORT
//      nachgezogen — sonst verschieben sich die Deckgroessen dauerhaft.
//
//  ★ BEI LEERER HAND LOEST DIE KARTE GAR NICHT AUS (Als Ruling 14.9.) —
//  nicht „mischt nichts und zieht null".
//
//  ── ★★ v1156 (Al 17.9.) ──────────────────────────────────────────
//  • NEUER TEXT fuer den eigenen Effekt: „shuffle ANY NUMBER of cards
//    from your hand" statt der ganzen Hand — Auswahl in der eigenen Hand
//    wie bei „Horn in a Bottle" / „Lunatic Cycle - Crescent Moon"
//    (`handPick`). Pflicht-Ausloeser, aber 0 Karten sind erlaubt (kein
//    „may"): nicht abbrechbar, `minSelect: 0`. Der Treffer-Effekt beim
//    Gegner bleibt die GANZE Hand.
//  • „PERFORMS AN ACTION" ueber `onAnyActionResolved` statt
//    `onActionUsed`. Letzteres ueberspringt inhaerente Zusatzaktionen
//    (Quick Attack) — genau dort loeste die Klinge nicht aus. Derselbe
//    Haken wie Crescent Moon; Heldeneffekte zaehlen nur mit Aktions-
//    kosten (Als Ruling 4.8.).
//  • AUFTRITT: beide Effekte streamen die Karte beim Ausloesen
//    (`announceHookActivation`, wie Crescent Moon).
// ═══════════════════════════════════════════

const CARD_NAME = 'The Stormblade';

const { trefferHooks } = require('./_affected-shared');
const { usesLeft, spendUse } = require('./_charges');

// Einheitszaehler fuer „once per turn" (v417). Traeger ist die Instanz.
const ZAEHLER = { key: 'StormbladeCycle', max: 1 };
const { handlungsHooks } = require('./_action-shared');

/** Die Ausruestung, sofern sie wirklich an einem Helden haengt. */
function ausruestung(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return null;
  if (inst.heroIdx == null || inst.heroIdx < 0) return null;
  return inst;
}

/** Der ausgeruestete Held als {owner, heroIdx}. */
function traegerHeld(ctx) {
  const inst = ausruestung(ctx);
  if (!inst) return null;
  return { owner: inst.controller ?? inst.owner, heroIdx: inst.heroIdx };
}

/**
 * Karten ins Deck, gleiche Zahl nachziehen. Unabwendbar.
 * @param {number} pi         wessen Hand
 * @param {'action'|'hit'} anlass  'action' → Auswahl (any number),
 *                            'hit' → die GANZE Hand
 * @param {number} klingenSeite  Besitzer der Klinge (fuer den Auftritt)
 * @returns {boolean} ob der Zyklus wirklich lief
 */
async function sturmzyklus(engine, pi, anlass, klingenSeite) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  // ★ Leere Hand → gar kein Ausloesen (Als Ruling).
  if ((ps.hand || []).length === 0) return false;

  // Re-Entranz-Riegel: der Zyklus zieht Karten, und Ziehen kann
  // seinerseits Effekte ausloesen, die den Helden treffen. Ohne den
  // Riegel koennte sich die Klinge selbst aufschaukeln.
  if (engine._stormbladeLaeuft) return false;
  engine._stormbladeLaeuft = true;
  try {
    const waehlbar = engine.shuffleBackEligibleHandCards(pi);
    if (waehlbar.length === 0) return false;

    // ★ v1156: Auftritt beim Ausloesen — vor der Auswahl, die nicht
    // abbrechbar ist (keine Abbruchstelle, die der Auftritt ueberholt).
    await engine.announceHookActivation(CARD_NAME, klingenSeite ?? pi);

    let namen;
    if (anlass === 'action') {
      const erlaubt = new Set(waehlbar);
      const eligibleIndices = ps.hand.map((_, i) => i).filter(i => erlaubt.has(ps.hand[i]));
      const wahl = await engine.promptGeneric(pi, {
        type: 'handPick',
        title: CARD_NAME,
        description: 'Shuffle any number of cards from your hand back into your deck, then draw the same number. This draw cannot be prevented.',
        eligibleIndices,
        maxSelect: eligibleIndices.length,
        minSelect: 0,
        confirmLabel: '⚡ Shuffle & Draw',
        cancellable: false,
      });
      const gewaehlt = Array.isArray(wahl?.selectedCards) ? wahl.selectedCards : [];
      // Von hinten nach vorn, damit die Indizes stabil bleiben.
      namen = [...gewaehlt].sort((x, y) => y.handIndex - x.handIndex).map(k => k.cardName);
      if (namen.length === 0) {
        engine.log('stormblade_cycle', { player: ps.username, returned: 0, anlass });
        return true;          // 0 gewaehlt: ausgeloest, nichts zu tun
      }
    } else {
      namen = waehlbar;       // Treffer: die ganze (mischbare) Hand
    }

    const { potionCount, totalReturned } = await engine.actionMulliganCards(pi, namen);
    if (!(totalReturned > 0)) return false;

    engine.log('stormblade_cycle', {
      player: ps.username, returned: totalReturned, anlass,
    });
    engine.sync();
    await engine._delay(300);

    // „draw the same number" — gemessen an dem, was wirklich zurueckging.
    const ausHauptdeck = totalReturned - potionCount;
    if (ausHauptdeck > 0) {
      await engine.actionDrawCards(pi, ausHauptdeck, {
        source: CARD_NAME,
        _unpreventable: true,   // ★ auch gegen drawLocked (Als Ruling)
      });
    }
    for (let i = 0; i < potionCount; i++) {
      if ((ps.potionDeck || []).length === 0) break;
      engine.handZugangSync(ps, ps.potionDeck.shift(), { von: 'rueckgabe', source: CARD_NAME, ohneInstanz: true });
      engine.sync();
      await engine._delay(160);
    }
    engine.sync();
    return true;
  } finally {
    engine._stormbladeLaeuft = false;
  }
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,

  /**
   * ★ v1158: „You can only have 1 „The Stormblade" equipped to your
   * Heroes at a time." — anders als bei Wanted Poster (je Held) zaehlt
   * hier die GANZE eigene Seite.
   */
  canEquipToHero(gs, playerIdx /*, heroIdx, engine */) {
    for (const heldenZonen of (gs.players[playerIdx]?.supportZones || [])) {
      for (const slot of (heldenZonen || [])) {
        if ((slot || []).includes(CARD_NAME)) return false;
      }
    }
    return true;
  },
  activeIn: ['hand', 'support'],

  // Mischt die Hand ins Deck — dieselbe Kennzeichnung wie Elana, damit
  // „No Retreat!" und Distracting Crystal greifen koennen.
  shufflesFromHandOrDiscardIntoDeck: true,

  hooks: {
    // ── 1) Der ausgeruestete Held handelt ──────────────────────────
    // ★ v1156: `onAnyActionResolved` — feuert in JEDEM Aktionspfad, auch
    // fuer inhaerente Zusatzaktionen (Quick Attack), die `onActionUsed`
    // ueberspringt. Heldeneffekte kommen hier nur mit Aktionskosten an.
    // v1157: auch Reaktionen dieses Helden (`_action-shared.js`) — seit
    // v1158 ohnehin nur in der eigenen Action Phase und einmal pro Runde.
    ...handlungsHooks(async (ctx) => {
      const held = traegerHeld(ctx);
      if (!held) return;
      if (ctx.playerIdx !== held.owner) return;
      if (ctx.heroIdx !== held.heroIdx) return;
      const engine = ctx._engine;
      // ★ v1158: „during YOUR Action Phase" — Phase 3 UND am Zug.
      if (engine.gs.currentPhase !== 3) return;
      if (engine.gs.activePlayer !== held.owner) return;
      // ★ v1158: „once per turn" — Einheitszaehler an der Instanz. Erst
      // zaehlen, wenn der Zyklus wirklich lief (leere Hand loest nicht
      // aus, Als Ruling 14.9.).
      const inst = ctx.card;
      if (usesLeft(inst, engine.gs, ZAEHLER) <= 0) return;
      if (await sturmzyklus(engine, held.owner, 'action', held.owner)) {
        spendUse(inst, engine.gs, ZAEHLER);
      }
    }),

    // ── 2) Der Gegner trifft den ausgeruesteten Helden ─────────────
    // Alle VIER Wege auf einmal, aus dem gemeinsamen Helfer — Schaden,
    // Heilung, Status und Buff. Die Karte muss die vier Hook-Formen
    // nicht kennen.
    ...trefferHooks(traegerHeld, async (ctx, verursacher) => {
      const held = traegerHeld(ctx);
      await sturmzyklus(ctx._engine, verursacher, 'hit', held?.owner);
    }),
  },
};
