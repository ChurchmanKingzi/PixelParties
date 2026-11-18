// ═══════════════════════════════════════════
//  CARD EFFECT: "The Eye of Ren"
//  Artifact (Normal)
//
//  „Choose a card from your deck and send it to your discard pile. You
//   cannot move cards out of your discard pile for the rest of the
//   turn unless you spend an additional 6 Gold."
//
//  ── Spielgestalter-Entscheidung 18.11.2026 ────────────────────
//  Die 6 Gold sind ZUSATZKOSTEN der Aktivierung und werden im Moment der Aktivierung bezahlt — kein Freikauf mehr bei jedem
//  späteren Zugriff auf die Ablage (die frühere Mechanik `ps._discardLockBuyout`, Einmal-Zahlung je Zug, ist entfallen). Der
//  Spieler wird gefragt: „Pay 6 extra Gold or lock your discard pile?" („Pay 6 Gold" / „Lock discard pile").
//    · bezahlt          → keine Sperre; alle Ablage-Ausgänge bleiben für den Rest des Zuges offen.
//    · Sperre gewählt   → `ps._discardLockedTurn = gs.turn`: eine ganz normale HARTE Ablage-Ausgangssperre wie die der Stäbe
//                         (alle Wege fragen `engine._discardOutAllowed` / `isDiscardOutHardLocked`); es gibt keinen späteren
//                         Freikauf, auch Rebelliokai-Kostenkarten (Tanuki Escape & Co.) bleiben gesperrt.
//    · nicht bezahlbar  → die Sperre gilt ohne Frage (der Hinweis steht schon in der Kartenwahl).
//  Jede Aktivierung fragt einzeln: eine schon gesetzte Sperre (zweites Auge, Stab) bleibt, eine bezahlte Aktivierung hebt sie
//  nicht auf — die Frage trägt dann einen Hinweis (Warnungsprinzip, die CPU zahlt dann nie). Sperre und Zahlung gelten nur für
//  den laufenden Zug (`_discardLockedTurn` ist an `gs.turn` gebunden).
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Ablauf (Muster Treasure Hunter's Backpack/Hive's Crown, `payArtifactCost`): Deck-Wahl per Galerie (Magnetic-Glove-Muster),
//    dann die Zahlungsfrage — beides VOR dem Reaktionsfenster und abbrechbar (Abbruch = die Karte bleibt auf der Hand, nichts
//    bezahlt, nichts gezeigt). Nach der Antwort ist der Punkt ohne Rückweg erreicht: `commitAppearance()`, dann wird bezahlt.
//    `resolve` schickt die Karte per `actionMillCards(pi, 1, { targetCardName })` in die Ablage (Flug, Rettungsfenster
//    (Rebelliokai-Umleitung), `onMill` kommen von dort; `selfInflicted`, sonst würde der Erstzug-Schutz das eigene Deck schützen)
//    und setzt danach die Sperre, falls nicht bezahlt wurde.
//  · Wird das Artefakt im Kettenfenster NEGIERT, bleiben bezahlte Zusatzkosten bezahlt (Regel W4b für alle Kosten, die vor dem
//    Fenster fällig werden); die Karte wirkt nicht — keine Karte in der Ablage, keine Sperre (auch nicht, wenn „Lock" gewählt war).
//  · Die Zusatzkosten sind zahlbar, wenn Grundpreis (der Server bucht ihn erst NACH der Auflösung ab) UND 6 Gold zusammen
//    aufgebracht werden können (`canAffordGold`: Kreditrahmen, Goldsperre) — wie bei Cool Cheese. Im Gratis-Scope
//    (`engine.kostenlosSpielen`, Sky Archeologist: „without paying its Cost") kostet alles 0: keine Frage, keine Sperre.
//  · CPU (`cpuResponse`): Galerie über `cpuBesteMillKarte`, Zahlungsfrage nach `cpuZahlen`; Rollouts/Simulationen bekommen immer
//    eine Antwort (kein hängender Prompt).
// ═══════════════════════════════════════════

const { getResolvingHandIndex } = require('./_hand-resolve');
const { loadCardEffect } = require('./_loader');
const { cpuBesteMillKarte } = require('./_mill-pick-shared');

const CARD_NAME = 'The Eye of Ren';
const EXTRA_COST = 6;
const CPU_GOLD_UEBRIG = 10;   // CPU: zahlt auch ohne konkreten Bedarf, wenn nach allen Kosten noch so viel Gold bleibt

/** Alle verschiedenen Karten des Decks mit Anzahl (Galerie). */
function deckGalerie(ps) {
  const zaehler = {};
  for (const n of (ps.mainDeck || [])) zaehler[n] = (zaehler[n] || 0) + 1;
  return Object.entries(zaehler).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'deck', count }));
}

/** Gratis-Scope (`engine.kostenlosSpielen`): alle Kosten sind 0. */
const imGratisScope = (engine, pi) => !!(engine._kostenlosScope && engine._kostenlosScope.pi === pi);

/** Grundpreis, der beim Aktivieren noch aussteht (der Server bucht ihn erst nach der Auflösung ab); aus der Hand gespielt = aktueller Preis. */
function offenerGrundpreis(engine, pi) {
  const ps = engine.gs.players[pi];
  const hi = getResolvingHandIndex(ps);
  return hi >= 0 ? engine.artifactPlayCost(pi, CARD_NAME, hi).cost : 0;
}

/** Kann `pi` die Zusatzkosten zusätzlich zum Grundpreis aufbringen (Gold, Kreditrahmen, Goldsperre)? */
const kannZusatzkostenZahlen = (engine, pi) => engine.canAffordGold(pi, offenerGrundpreis(engine, pi) + EXTRA_COST, CARD_NAME);

/**
 * Deck-Wahl (Galerie). `hinweis`: Zusatzsatz in der Beschreibung (z. B. „nicht bezahlbar"). `abbrechbar: false` nur dort, wo schon bezahlt ist.
 * @returns {Promise<string|null>} Kartenname, `null` = abgebrochen / Deck leer
 */
async function waehleKarte(engine, pi, { hinweis = '', abbrechbar = true } = {}) {
  const ps = engine.gs.players[pi];
  const cards = deckGalerie(ps);
  if (cards.length === 0) return null;
  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery', cards,
    title: CARD_NAME,
    description: 'Choose a card from your deck to send to your discard pile.' + hinweis,
    cancellable: abbrechbar,
    _fuer: pi,
  });
  if (!picked || picked.cancelled || !picked.cardName || !(ps.mainDeck || []).includes(picked.cardName)) return null;
  return picked.cardName;
}

/**
 * Deck-Wahl und Zahlungsfrage — die Kosten der Aktivierung (siehe Kopf). `null` = abgebrochen (nichts bezahlt, nichts passiert).
 * @returns {Promise<{cardName: string, bezahlt: boolean}|null>}
 */
async function waehleKarteUndZahlung(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  const gratis = imGratisScope(engine, pi);
  const kannZahlen = !gratis && kannZusatzkostenZahlen(engine, pi);

  const cardName = await waehleKarte(engine, pi, {
    hinweis: (!gratis && !kannZahlen) ? ` You cannot pay ${EXTRA_COST} extra Gold, so your discard pile will be locked for the rest of the turn.` : '',
  });
  if (!cardName) return null;

  // Zahlung: wählt der Spieler „Pay", ist die Sperre abgewendet. Gratis-Scope: Zusatzkosten 0 → gilt als bezahlt.
  let zahlen = gratis;
  if (kannZahlen) {
    const bereitsGesperrt = !!engine.isDiscardOutHardLocked?.(pi);   // eine vorhandene Sperre (Stab, anderes Auge) hebt die Zahlung nicht auf
    const antwort = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: `Pay ${EXTRA_COST} extra Gold or lock your discard pile?`
        + (bereitsGesperrt ? ' Your discard pile is already locked this turn, so paying will not lift the lock.' : ''),
      options: [
        { id: 'pay', label: `💰 Pay ${EXTRA_COST} Gold` },
        { id: 'lock', label: '🔒 Lock discard pile' },
      ],
      showCard: CARD_NAME,
      cancellable: true,
      _fuer: pi,
      _bereitsGesperrt: bereitsGesperrt,
      _cpuRest: (ps.gold || 0) - offenerGrundpreis(engine, pi) - EXTRA_COST,
    });
    if (!antwort || antwort.cancelled) return null;
    zahlen = (antwort.optionId || antwort.id) === 'pay';
  }

  // Ab hier gibt es keinen Abbruch mehr: Auftritt zeigen, dann bezahlen.
  engine.commitAppearance();
  let bezahlt = gratis;
  if (zahlen && !gratis) {
    const gezahlt = await engine._payCardCost(pi, EXTRA_COST, { cardName: CARD_NAME });
    bezahlt = gezahlt >= EXTRA_COST;
    engine.log('eye_of_ren_pay', { player: ps.username, amount: gezahlt });
  }
  return { cardName, bezahlt };
}

/** CPU: braucht die Hand diese Runde Zugriff auf die Ablage? (reine Ablage-Sucher; Quelltext-Erkennung im Lader: `blockedBySearchLockDiscard`) */
function handBrauchtAblage(engine, pi) {
  return (engine.gs.players[pi]?.hand || []).some(n => n !== CARD_NAME && !!loadCardEffect(n)?.blockedBySearchLockDiscard);
}

/** CPU-Heuristik der Zahlungsfrage: zahlen, wenn die Ablage diese Runde gebraucht wird oder reichlich Gold übrig bleibt — sonst die (kostenlose) Sperre hinnehmen. */
function cpuZahlen(engine, pi, p) {
  if (p?._bereitsGesperrt) return false;           // die Sperre besteht ohnehin: Zahlen brächte nichts
  const rest = Number(p?._cpuRest);
  if (!(rest >= 0)) return false;
  return handBrauchtAblage(engine, pi) || rest >= CPU_GOLD_UEBRIG;
}

module.exports = {
  isTargetingArtifact: true,
  animationType: 'none',
  cpuMeta: { evaluateThroughTurnEnd: true },

  canActivate(gs, pi) {
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },
  getValidTargets: () => [],
  targetingConfig: {
    description: `Choose a card from your deck and send it to your discard pile. Then pay ${EXTRA_COST} extra Gold or lock your discard pile for the rest of the turn.`,
    confirmLabel: '👁️ Look!',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  // Deck-Wahl und Zusatzkosten VOR dem Reaktionsfenster (Spielgestalter-Entscheidung 18.11.2026, siehe Kopf). `false` = abgebrochen: Karte bleibt auf der Hand.
  payArtifactCost: async (engine, pi) => {
    const wahl = await waehleKarteUndZahlung(engine, pi);
    return wahl ? { wahl } : false;
  },

  resolve: async (engine, pi, selectedIds, validTargets, kosten) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };

    // Normalweg: Wahl und Zahlung stehen schon (`kosten`). Ohne (Gratis-Spiel durch Sky Archeologist u. ä. rufen `resolve` direkt) wird hier gewählt.
    let wahl = kosten && kosten.wahl;
    if (!wahl) {
      wahl = await waehleKarteUndZahlung(engine, pi);
      if (!wahl) return { aborted: true };
    }
    // Hat die Karte das Deck im Kettenfenster verlassen: neu wählen (bezahlt ist bezahlt — jetzt nicht mehr abbrechbar); leeres Deck = nichts zu senden.
    let karte = wahl.cardName;
    if (!(ps.mainDeck || []).includes(karte)) karte = await waehleKarte(engine, pi, { abbrechbar: false });

    const gemillt = karte
      ? await engine.actionMillCards(pi, 1, { targetCardName: karte, source: CARD_NAME, selfInflicted: true })
      : [];

    // Nicht bezahlt: harte Ablage-Ausgangssperre für den Rest des Zuges (wie die Stäbe). `_discardLockEyeTurn` ist die Eye-Marke: Meditation unterscheidet die reine Stab-Sperre
    // (dort ist „zurückmischen" erlaubt) von einer Eye-Sperre, auch wenn beide im selben Zug liegen.
    if (!wahl.bezahlt) { ps._discardLockedTurn = gs.turn; ps._discardLockEyeTurn = gs.turn; }
    engine.log('eye_of_ren', {
      player: ps.username, sent: (gemillt && gemillt[0]) || karte, paid: !!wahl.bezahlt, locked: !wahl.bezahlt,
    });
    engine.sync();
    return true;
  },

  /** CPU: Galerie über den Mill-Auswerter, Zahlungsfrage nach `cpuZahlen`. */
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || !p || p.title !== CARD_NAME) return undefined;
    const pi = Number.isInteger(p._fuer) ? p._fuer : engine._cpuPlayerIdx;
    if (p.type === 'cardGallery') {
      const wahl = cpuBesteMillKarte(engine, p, { source: CARD_NAME });
      if (wahl) return wahl;
      // Rollouts (`_inMctsSim`) und fehlender Auswerter: erste Karte der Galerie, die nicht beim Mill gelöscht wird.
      const karten = p.cards || [];
      const k = karten.find(c => !loadCardEffect(c.name)?.selfDeleteOnExternalDiscard) || karten[0];
      return k ? { cardName: k.name, source: k.source } : undefined;
    }
    if (p.type === 'optionPicker') return { optionId: cpuZahlen(engine, pi, p) ? 'pay' : 'lock' };
    return undefined;
  },
};
