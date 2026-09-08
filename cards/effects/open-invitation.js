// ═══════════════════════════════════════════
//  CARD EFFECT: "Open Invitation"
//  Artifact (Normal) — Cost 5
//
//  "You can only play this card during your Main Phase 1. Choose an
//   Ascended Hero from your hand and place it on top of an appropriate
//   Hero you control, ignoring its Ascension Conditions, ending your
//   turn. This does not count as that Hero Ascending. At the end of
//   your next turn, shuffle the Ascended Hero back to your deck."
//                                              (Text Al 31.8.)
//
//  ── ALS RULINGS (31.8.), BINDEND ──────────────────────────────────
//  ① Ascended Heroes, deren Bedingung NICHT umgangen werden kann,
//     stehen gar nicht zur Wahl. Sechs Karten sagen das gedruckt;
//     `engine.isAscensionConditionUnskippable` ist die eine Auslegung.
//  ② „Does not count as that Hero Ascending" heisst mindestens: KEIN
//     Ascension Bonus. Ich sperre darueber hinaus die on-ascend-
//     Ausloeser, weil Al fuer das Gegenstueck ausdruecklich sagt, das
//     Zurueckmischen loese keine on-descend-Effekte aus — dieselbe
//     Logik in die andere Richtung. Traeger ist `notAnAscension`.
//  ③ „Appropriate Hero" ist die gedruckte Namensbindung des Ascended
//     („on top of a 'X' you control"). Kein eigener Begriff, sondern
//     `engine.getAscendedFormsFor(heldName)`.
//  ④ Das Zurueckmischen gilt NICHT als Descending (`notADescend`).
//  ⑤ Ist der platzierte Ascended nicht mehr die Identitaet des Helden
//     (Waflav hat die Form gewechselt), FIZZELT das Zurueckmischen —
//     es passiert schlicht nichts.
//
//     ★ DAS IST KEIN LOCH, DAS IST DER PLAN (Al bestaetigt 31.8.).
//     Nachgespielt und belegt: Open Invitation legt Stormkissed Waflav
//     auf Waflav → der Spieler steigt im naechsten Zug regulaer auf
//     Deep-Drowned Waflav auf → am Zugende fizzelt der Rueckweg, und
//     der Sweep raeumt den Stempel dabei ab → beim spaeteren normalen
//     Abstieg landet der Held wieder auf Stormkissed Waflav und
//     BEHAELT ihn dauerhaft, ohne dessen Bedingung je erfuellt zu
//     haben. Die Karte ist dann weder im Deck noch in der Ablage.
//     Als Wortlaut: „Die Karte kann von Waflav-Decks sehr gezielt fuer
//     einen Push eingesetzt werden, der spaeter nicht zurueckgezahlt
//     werden muss."
//
//     Wer das hier fuer einen Fehler haelt und den Rueckweg auf die
//     neue Form mitwandern laesst, nimmt dem Archetyp seine Absicht.
//     Nicht anfassen ohne Als Wort.
//
//  ── WARUM DER RUECKWEG AUSSERHALB DER KARTE HAENGT ────────────────
//  Nach dem Platzieren heisst der Held wie der ASCENDED, und
//  `loadCardEffect(hero.name)` loest dessen Skript auf. Ein eigenes
//  `onTurnEnd` dieser Datei waere also nie erreicht — dieselbe Falle
//  wie bei Throne Robber, Shapeshifter und Copy Device. Der Rueckweg
//  haengt deshalb am Engine-Sweep `_expireBorrowedIdentities` ueber
//  `onIdentityExpire`, und die Heldeninstanz traegt
//  `_identityCleanupCard`, damit der Sweep DIESE Datei findet.
//  Nebeneffekt, der hier passt: den Sweep haelt weder eine Negation
//  noch der Tod des Helden auf.
//
//  ── ZEITRECHNUNG ─────────────────────────────────────────────────
//  `gs.turn` zaehlt je SPIELERZUG hoch. Open Invitation beendet den
//  eigenen Zug N, der Gegner spielt N+1, der eigene naechste Zug ist
//  N+2 — „at the end of your next turn" ist also `gs.turn + 2`.
//  (Throne Robber steht auf `+1`, weil er den Zug NICHT beendet und
//  auf das Ende der GEGNERrunde zielt.)
// ═══════════════════════════════════════════

const CARD_NAME = 'Open Invitation';
const MAIN1 = 2;                 // PHASES.MAIN1
const RUECKGABE_IN_ZUEGEN = 2;   // siehe „Zeitrechnung"
const FLUG_MS = 620;             // Held → Deck, wie die anderen Stapelfluege

// ─── HELPERS ─────────────────────────────

/**
 * Welche Ascended Heroes auf der Hand koennen auf welche eigenen
 * Helden? Liefert `[{ name, wirte: [heroIdx] }]`.
 *
 * Die Liste wird bei JEDEM Aufruf frisch erhoben — sie ist zugleich
 * das Spielbarkeits-Gate der Karte und die Auswahl im Dialog, und
 * beide muessen dasselbe sehen.
 */
function zulaessigePaare(engine, pi) {
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const raus = [];
  const gesehen = new Set();

  for (const name of (ps.hand || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Ascended Hero') continue;
    // Ruling ①: Open Invitation umgeht die Bedingung — genau das
    // verbieten diese Karten gedruckt.
    if (engine.isAscensionConditionUnskippable(name)) continue;

    const wirte = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Nicht auf sich selbst — bei der Waflav-Familie greift die
      // Namensbindung sonst auch auf die eigene Form.
      if (hero.name === name) continue;
      // Ruling ③: die gedruckte Namensbindung, nichts sonst.
      if (!engine.getAscendedFormsFor(hero.name).includes(name)) continue;
      wirte.push(hi);
    }
    if (wirte.length > 0) raus.push({ name, wirte });
  }
  return raus;
}

/** Die Heldeninstanz dieses Slots. */
function heldeninstanz(engine, pi, heroIdx) {
  return engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx) || null;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  /**
   * „You can only play this card during your Main Phase 1."
   *
   * `canPlayWithHero` ist der Vertrag, den BEIDE Seiten lesen: der
   * Client graut die Karte darueber aus (`cardGateBlockedCards`), der
   * Server setzt ihn durch. Der `heroIdx` ist hier bedeutungslos —
   * Open Invitation gehoert keinem Helden; gefragt wird global, und
   * das Ausgrauen wertet „bei irgendeinem Helden spielbar" aus.
   */
  canPlayWithHero(gs, pi, _heroIdx, _cardData, engine) {
    if (!engine) return true;                  // ohne Engine nicht sperren
    if (pi !== gs.activePlayer) return false;
    if (gs.currentPhase !== MAIN1) return false;
    return zulaessigePaare(engine, pi).length > 0;
  },

  animationType: 'none',

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    // Zweite Probe: zwischen Klick und Aufloesung kann eine Reaktion
    // die Hand veraendert haben.
    if (gs.currentPhase !== MAIN1) return { cancelled: true };

    const paare = zulaessigePaare(engine, pi);
    if (paare.length === 0) return { cancelled: true };

    // ── ① Welchen Ascended Hero, und auf wen? ─────────────────────
    // KEINE eigene Galerie (Als Vorgabe 31.8.): die zulaessigen
    // Ascended Heroes werden IN DER HAND hervorgehoben und dort direkt
    // angeklickt — oder gleich auf den Wirt gezogen. Das ist der
    // `pickHandCard`-Picker im Drag-Modus; `hostZoneKind: 'hero'` sagt
    // dem Client, dass die Wirte HELDEN-Zonen sind und nicht Support
    // Zones (Raptoren, der andere Nutzer des Modus, zieht auf Slots).
    const eligibleIndices = [];
    const eligibleHostsByCardName = {};
    paare.forEach(pa => {
      eligibleHostsByCardName[pa.name] = pa.wirte.map(hi => ({ heroIdx: hi, slotIdx: -1 }));
    });
    (ps.hand || []).forEach((cn, i) => {
      if (eligibleHostsByCardName[cn]) eligibleIndices.push(i);
    });
    if (eligibleIndices.length === 0) return { cancelled: true };

    const pick = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: 'Place an Ascended Hero, ignoring its Ascension Conditions.',
      instruction: 'Click a highlighted Ascended Hero in your hand — or drag it onto the Hero it joins.',
      eligibleIndices,
      eligibleHostsByCardName,
      dragSummonMode: true,
      hostZoneKind: 'hero',
      cancellable: true,
    });
    if (!pick || pick.cancelled || pick.handIndex == null) return { cancelled: true };

    // ★ Der Picker antwortet `{ cardName, handIndex }` — und der NAME
    //   ist die belastbare Haelfte. Der Index stammt vom Zeitpunkt der
    //   Abfrage; dazwischen liegt eine Spielerantwort, und eine
    //   Reaktion kann in dieser Zeit eine Karte VOR dem Ascended aus
    //   der Hand genommen haben. `ps.hand[pick.handIndex]` waere dann
    //   eine andere Karte oder `undefined`. (Dieselbe Lehre wie bei
    //   Copy Device, v573.)
    const zielName = pick.cardName || ps.hand[pick.handIndex];
    const eintrag = paare.find(p => p.name === zielName);
    if (!eintrag) return { cancelled: true };
    // Und die Karte muss noch da sein.
    if (!ps.hand.includes(zielName)) return { cancelled: true };

    // ── ② Wirt aufloesen ──────────────────────────────────────────
    // Drag-Abkuerzung: hat der Spieler auf einen Helden gezogen, traegt
    // die Antwort `targetHeroIdx`. Gegengeprueft, weil sich der Zustand
    // zwischen Abfrage und Antwort verschoben haben kann.
    let heroIdx = -1;
    if (pick.targetHeroIdx != null && eintrag.wirte.includes(pick.targetHeroIdx)) {
      heroIdx = pick.targetHeroIdx;
    } else if (eintrag.wirte.length === 1) {
      heroIdx = eintrag.wirte[0];
    } else {
      // Geklickt statt gezogen, und mehrere Wirte passen — dann muss
      // der Held noch benannt werden. Ueber die normale Zielwahl auf
      // dem Brett, nicht ueber ein weiteres Menue.
      const ziele = engine.getHeroTargets(pi).filter(t => eintrag.wirte.includes(t.heroIdx));
      const ids = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME, source: CARD_NAME,
        previewCardName: zielName,
        description: `Choose the Hero ${zielName} joins.`,
        confirmLabel: '✉️ Place!',
        cancellable: true,
        maxTotal: 1,
        // Eigene Helden mit einer eigenen Karte zu benennen ist keine
        // Zielwahl, gegen die jemand reagiert — beide Fenster bleiben zu.
        _skipRedirectCheck: true,
        _skipPostTargetReactions: true,
      });
      if (!ids || ids.length === 0) return { cancelled: true };
      const t = ziele.find(z => z.id === ids[0]);
      if (!t) return { cancelled: true };
      heroIdx = t.heroIdx;
    }
    if (heroIdx < 0) return { cancelled: true };

    // Index frisch suchen: der Picker liefert den Index vom Zeitpunkt
    // der Abfrage, und dazwischen liegt eine Spielerantwort.
    const handIndex = ps.hand.indexOf(zielName);
    if (handIndex < 0) return { cancelled: true };
    const basisForm = ps.heroes?.[heroIdx]?.name || null;

    // ── ③ Platzieren ──────────────────────────────────────────────
    const res = await engine.performAscension(pi, heroIdx, zielName, handIndex, {
      // „ignoring its Ascension Conditions"
      skipCondition: true,
      // „This does not count as that Hero Ascending" — sperrt Bonus,
      // ON_ASCENSION-Fenster und Aufstiegs-Reaktionen (Ruling ②).
      // BEWUSST ohne zusaetzliches `skipBonus`: doppelt abgesichert
      // heisst hier auch, dass ein Rueckbau an einer der beiden Stellen
      // unbemerkt bliebe. Eine Zusicherung, die nichts haelt, ist
      // schlechter als keine.
      notAnAscension: true,
      // Ohne Formstapel faende der Rueckweg die Basisform nicht; die
      // Zielkarten fuehren `formsAscensionStack` nicht.
      forceFormStack: true,
    });
    if (!res?.success) return { cancelled: true };

    // ── ④ Rueckgabe vormerken ─────────────────────────────────────
    const inst = heldeninstanz(engine, pi, heroIdx);
    if (inst) {
      inst.counters = inst.counters || {};
      inst.counters._identityExpiresTurn = gs.turn + RUECKGABE_IN_ZUEGEN;
      // Der Sweep sucht die Ruecknahme ueber `loadCardEffect(inst.name)`
      // — und der Name gehoert jetzt dem Ascended. Dieser Zeiger fuehrt
      // ihn auf DIESE Datei.
      inst.counters._identityCleanupCard = CARD_NAME;
      inst.counters._openInvitationCard = zielName;
    }

    // ── ⑤ „ending your turn" ──────────────────────────────────────
    // Ueber den bestehenden Vertrag, NICHT ueber `advanceToPhase` von
    // hier aus: wir stecken noch in der Kette der eigenen Karte, und
    // ein Zugende von dort hinein ist die Deadlock-Falle, an der
    // Cooldin haengengeblieben ist. `doUseArtifactEffect` loest das
    // Flag nach der Kette ein.
    gs._spellEndsTurn = true;

    engine.log('open_invitation', {
      player: ps.username, card: zielName, hero: basisForm,
      returnsOnTurn: gs.turn + RUECKGABE_IN_ZUEGEN,
    });
    engine.sync();
    return true;
  },

  /**
   * „At the end of your next turn, shuffle the Ascended Hero back to
   * your deck." — gerufen vom Engine-Sweep (siehe Kopf).
   */
  async onIdentityExpire(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst) return;

    const pi = inst.owner;
    const heroIdx = inst.heroIdx;
    const platziert = inst.counters?._openInvitationCard || null;
    // Eigener Merker, eigenes Aufraeumen — der Sweep raeumt nur seine
    // beiden Felder ab.
    if (inst.counters) delete inst.counters._openInvitationCard;

    const ps = gs.players?.[pi];
    if (!ps || !platziert) return;
    const hero = ps.heroes?.[heroIdx];

    // Ruling ⑤: Identitaet gewechselt → der Effekt fizzelt.
    if (!hero || hero.name !== platziert) {
      engine.log('open_invitation_fizzle', {
        player: ps.username, card: platziert, hero: hero?.name || null,
      });
      return;
    }

    // Flug Held → Deck VOR der Umbuchung, damit der Client die Karte
    // noch dort findet, wo sie startet.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: platziert,
      from: 'hero', to: 'deck', fromHeroIdx: heroIdx,
    });
    await engine._delay(FLUG_MS);

    const res = await engine.performDescend(pi, heroIdx, {
      // Die Karte geht ins DECK, nicht in die Ablage.
      noDiscard: true,
      // Sonst bliebe sie an einem besiegten Helden kleben.
      evenIfDefeated: true,
      // Ruling ④.
      notADescend: true,
    });
    if (!res?.success) {
      engine.log('open_invitation_fizzle', {
        player: ps.username, card: platziert, hero: hero?.name || null,
      });
      return;
    }
    // Kein eigener Riegel gegen ein Wiederbeleben mehr: seit v674 ist
    // das die Regel von `performDescend` selbst (Als Ruling 31.8.).
    // Ein zweiter Riegel hier hiesse, dass ein Rueckbau der Regel
    // unbemerkt bliebe.

    ps.mainDeck.push(platziert);
    engine.shuffleDeck(pi, 'main');   // sendet auch die Misch-Animation

    engine.log('open_invitation_return', {
      player: ps.username, card: platziert, hero: hero.name,
    });
    engine.sync();
  },

  /**
   * CPU-Antworten auf die beiden eigenen Abfragen. Ohne sie liefe die
   * Galerie in die Ablehnungs-Default und die Karte waere fuer die CPU
   * ein toter Zug, der nur den Zug beendet.
   */
  cpuResponse(engine, promptKind, promptData) {
    if (promptKind === 'generic'
        && promptData?.type === 'pickHandCard'
        && promptData.title === CARD_NAME) {
      const gs = engine.gs;
      const pi = typeof promptData.ownerIdx === 'number' ? promptData.ownerIdx : engine._cpuPlayerIdx;
      const hand = gs?.players?.[pi]?.hand || [];
      const cardDB = engine._getCardDB();
      const idxe = (promptData.eligibleIndices || []).filter(i => hand[i]);
      if (idxe.length === 0) return null;
      // Grob, aber verteidigbar: der koerperlich staerkste Ascended.
      // Feiner zu waehlen hiesse, die Effekte zu bewerten — das kann
      // hier niemand, und ein falscher Feinschliff waere schlechter
      // als eine ehrliche Faustregel.
      const wert = i => (cardDB[hand[i]]?.hp || 0) + 3 * (cardDB[hand[i]]?.atk || 0);
      const besterIdx = idxe.slice().sort((a, b) => wert(b) - wert(a))[0];
      return { cardName: hand[besterIdx], handIndex: besterIdx };
    }

    if (promptKind === 'effectTarget'
        && (promptData?.config?.title === CARD_NAME
            || promptData?.config?.source === CARD_NAME)) {
      const ziele = promptData.validTargets || [];
      if (ziele.length === 0) return undefined;
      // Der Wirt mit den meisten verbliebenen HP — er traegt die neue
      // Form am laengsten.
      const pi = typeof promptData.playerIdx === 'number'
        ? promptData.playerIdx : engine._cpuPlayerIdx;
      const hp = t => engine.gs.players?.[pi]?.heroes?.[t.heroIdx]?.hp || 0;
      const bestes = ziele.slice().sort((a, b) => hp(b) - hp(a))[0];
      return [bestes.id];
    }

    return undefined;
  },
};
