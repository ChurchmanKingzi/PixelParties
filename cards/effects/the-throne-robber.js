// ═══════════════════════════════════════════
//  CARD EFFECT: "???, the Throne Robber"
//  Ascended Hero — 950 HP / 120 ATK
//  Ascension Bonus: "Any Ascended Hero" (aus dem Spiel heraus)
//
//  "You must play this Hero from your hand on top of a
//   '???, the Shapeshifter' you control that has transformed into 3 or
//   more different Heroes this game.
//   You may once per turn Ascend this Hero to an Ascended Hero with a
//   different name from all Heroes you currently control from your hand
//   or deck, ignoring its Ascension condition.
//   Ascending this way does not end your turn, but you don't get the
//   Ascension Bonus of the Hero you Ascend to.
//   At the end of your opponent's next turn, Descend this Hero (even if
//   it is defeated or its effects are negated)."
//
//  ── ALS RULINGS (28.8.), BINDEND ───────────────────────────────────
//  ① KEIN attach/detach wie beim Basis-Shapeshifter, sondern ECHTES
//     Ascend/Descend im Waflav-Sinne. Der neue Ascended Hero geht
//     direkt auf Throne Robber; es ist KEINE Support Zone beteiligt
//     und nichts gilt als Ausruestung.
//  ② Aufsteigen darf nur ein UNVERWANDELTER Shapeshifter — der Name
//     ist die Bedingung, nicht die Karte darunter.
//  ③ Der Aufstiegsbonus zieht aus dem KOMPLETTEN Kartenbestand, auch
//     aus Karten, von denen Kopien im Deck oder auf der Hand liegen —
//     und ausdruecklich auch einen weiteren Throne Robber.
//
//  ── WARUM DREI OPTIONEN AM AUFRUF STATT FLAGS AUF DEN KARTEN ──────
//  „ignoring its Ascension condition", „you don't get the Ascension
//  Bonus" und „does not end your turn" gelten fuer DIESEN WEG, nicht
//  fuer eine bestimmte Zielkarte. Als Kartenflags muessten sie an alle
//  28 Ascended Heroes gehaengt werden und waeren auf jedem anderen
//  Aufstiegsweg falsch. Deshalb `skipCondition` / `skipBonus` /
//  `noEndPhase` an `performAscension` (28.8. dort ergaenzt).
//
//  ── UND WARUM DER ABSTIEG WIEDER DRAUSSEN LIEGT ───────────────────
//  Nach dem Aufstieg heisst der Held wie die ZIELKARTE, und
//  `loadCardEffect(hero.name)` loest deren Skript auf. Ein eigenes
//  `onTurnEnd` dieser Datei waere also nie erreicht — dieselbe Falle
//  wie beim Basis-Shapeshifter und bei Copy Device. Der Abstieg haengt
//  daher am Engine-Sweep `_expireBorrowedIdentities` ueber den Vertrag
//  `onIdentityExpire`, und die Heldeninstanz traegt
//  `_identityCleanupCard`, damit der Sweep DIESE Karte findet und
//  nicht die geliehene.
//
//  Das traegt zugleich den Zusatz „even if it is defeated or its
//  effects are negated": der Sweep ist kein Karteneffekt, ihn kann
//  weder eine Negation noch der Tod des Helden aufhalten.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = '???, the Throne Robber';
const BASIS_FORM = '???, the Shapeshifter';
/**
 * „…that has transformed into 3 or more different Heroes this game."
 *
 * (Stand hier am 28.8. voruebergehend auf 0, weil sich der Aufstieg im
 * Puzzle Mode sonst nicht herstellen liess. Al hat den Test
 * abgeschlossen; der Wert ist zurueckgesetzt.)
 */
const NOETIGE_GESTALTEN = 3;

// ─── HELPERS ─────────────────────────────

/** Namen aller Helden, die der Spieler gerade kontrolliert. */
function aktuelleHeldennamen(ps) {
  const namen = new Set();
  for (const h of (ps.heroes || [])) if (h?.name) namen.add(h.name);
  return namen;
}

/**
 * Zulaessige Aufstiegsziele aus Hand und Deck.
 *
 * NICHT aus der Ablage — anders als beim Basis-Shapeshifter, der aus
 * Hand, Deck UND Ablage zieht. Der Text nennt hier nur zwei Quellen,
 * und das ist eine bewusste Verengung, keine Auslassung.
 */
function aufstiegsziele(engine, pi, heroIdx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const vergeben = aktuelleHeldennamen(ps);

  const zulaessig = (name) => {
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Ascended Hero') return false;
    // „with a different name from all Heroes you currently control" —
    // das schliesst Throne Robber selbst mit ein, solange er den Slot
    // haelt.
    if (vergeben.has(name)) return false;
    // ★ SKRIPT-FILTER (Als Vorgabe 28.8.) — wie bei Crestina.
    // Eine Ascended-Hero-Karte ohne Skript ist ein reiner Werte-
    // Koerper; in eine solche Form aufzusteigen brächte einer Karte,
    // die vom Leihen fremder Effekte lebt, nichts als Zahlen.
    // Nachgezaehlt: 11 der 28 Ascended Heroes sind gebaut. Die
    // Auswahl schrumpft dadurch spuerbar und WAECHST von selbst mit
    // jeder neu gebauten Karte — deshalb ist die Zahl hier nirgends
    // festgeschrieben, sondern wird bei jedem Aufruf erhoben.
    if (!loadCardEffect(name)) return false;
    return true;
  };

  const raus = [];
  const gesehen = new Set();
  const sammle = (liste, quelle) => {
    for (const name of (liste || [])) {
      const schluessel = `${name}|${quelle}`;
      if (gesehen.has(schluessel) || !zulaessig(name)) continue;
      gesehen.add(schluessel);
      raus.push({ name, source: quelle });
    }
  };
  sammle(ps.hand, 'hand');
  sammle(ps.mainDeck, 'deck');
  return raus;
}

/** Die Heldeninstanz dieses Slots. */
function heldeninstanz(engine, pi, heroIdx) {
  return engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx) || null;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Kein `heroEffectActionCost`: „You may once per turn Ascend" nennt
  // keine Aktionskosten (anders als Champions „spend your Action").

  /**
   * ① Aufstiegsbedingung — gehoert laut Hausregel auf die ASCENDED
   * Karte, weil dort der Satz gedruckt steht.
   *
   * Ruling ②: nur ein UNVERWANDELTER Shapeshifter. Traegt er gerade
   * eine fremde Gestalt, heisst er auch so, und dann ist er kein
   * gueltiges Ziel. `_shapeshiftBase` ist dabei die zweite Probe: es
   * ist genau dann gesetzt, wenn eine Gestalt aktiv ist.
   */
  ascensionCondition(gs, pi, heroIdx, _engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.name !== BASIS_FORM) return false;
    if (hero._shapeshiftBase) return false;
    const gestalten = Array.isArray(hero._shapeshiftUsed) ? hero._shapeshiftUsed.length : 0;
    return gestalten >= NOETIGE_GESTALTEN;
  },

  /**
   * ② Aufstiegsbonus „Any Ascended Hero" — einen beliebigen Ascended
   * Hero VON AUSSERHALB DES SPIELS auf die Hand nehmen.
   *
   * Vorbild ist Crestina: Galerie ueber den kompletten `_getCardDB()`
   * mit `source: 'outside'`. Ruling ③: KEINE Filterung danach, ob
   * Kopien im Deck oder auf der Hand liegen — und ein weiterer Throne
   * Robber steht ausdruecklich mit zur Wahl.
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    // Eine gesperrte Hand kann nichts aufnehmen — der Bonus verpufft
    // still, statt halb aufzuloesen (Crestina-Linie).
    if (ps.handLocked) {
      engine.log('throne_robber_bonus_handlocked', { player: ps.username });
      return;
    }

    const cardDB = engine._getCardDB();
    const kandidaten = [];
    for (const name of Object.keys(cardDB)) {
      if (cardDB[name]?.cardType !== 'Ascended Hero') continue;
      // Ruling ③: ohne Ruecksicht darauf, wo Kopien liegen — Deck und
      // Hand filtern NICHT, und ein weiterer Throne Robber steht
      // ausdruecklich mit zur Wahl (er ist gebaut, kommt also durch
      // den Filter darunter).
      // Nicht gebaute Karten bleiben dagegen draussen (Als Vorgabe
      // 28.8.): eine Karte ohne Skript auf die Hand zu holen waere ein
      // toter Zug.
      if (!loadCardEffect(name)) continue;
      kandidaten.push(name);
    }
    if (kandidaten.length === 0) return;
    kandidaten.sort((a, b) => a.localeCompare(b));

    const gewaehlt = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      menuSource: CARD_NAME,
      cards: kandidaten.map(name => ({ name, source: 'outside' })),
      title: CARD_NAME,
      description: 'Ascension Bonus — add any Ascended Hero from outside the game to your hand.',
      confirmLabel: '👑 Take it!',
      // Der Bonus ist geschenkt; ein Abbruch ist erlaubt und kostet
      // nichts.
      cancellable: true,
      searchable: true,
      searchPlaceholder: 'Filter by name…',
    });
    if (!gewaehlt) return;

    const name = gewaehlt.cardName || gewaehlt.name;
    if (!name || !cardDB[name]) return;
    ps.hand.push(name);
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: name, from: 'outside', to: 'hand',
      toHandIdx: ps.hand.length - 1, finalHandSize: ps.hand.length,
    });
    engine.log('throne_robber_bonus', { player: ps.username, card: name });
    engine.sync();
  },

  /**
   * ③ Der eigene Effekt: einmal pro Zug zu einem beliebigen anderen
   * Ascended Hero aufsteigen.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return aufstiegsziele(engine, pi, heroIdx).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const ziele = aufstiegsziele(engine, pi, heroIdx);
    if (ziele.length === 0) return false;

    const gewaehlt = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      menuSource: CARD_NAME,
      cards: ziele,
      title: CARD_NAME,
      description: 'Choose an Ascended Hero to Ascend into (its Ascension condition is ignored).',
      confirmLabel: '👑 Ascend!',
      cancellable: true,
    });
    if (!gewaehlt) return false;

    const zielName = gewaehlt.cardName || gewaehlt.name;
    const quelle = gewaehlt.source;
    if (!zielName || !ziele.some(z => z.name === zielName && z.source === quelle)) return false;

    // ── Quelle aufloesen ──────────────────────────────────────────
    // `performAscension` prueft die HAND. Kommt die Karte aus dem
    // Deck, wandert sie vorher ans Handende und wird von dort
    // aufgestiegen — zwischen beidem liegt KEIN Zustandsversand, die
    // Karte ist also nie sichtbar auf der Hand. Das ist billiger und
    // sicherer, als den geprueften Aufstiegspfad um eine zweite
    // Quellenart zu erweitern.
    let handIndex = -1;
    if (quelle === 'hand') {
      handIndex = ps.hand.indexOf(zielName);
      if (handIndex < 0) return false;
    } else {
      const _taken_di = await engine.takeFromPile(ps, 'deck', zielName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_di) return false;
      ps.hand.push(zielName);
      handIndex = ps.hand.length - 1;
    }

    const vonForm = hero.name;
    const res = await engine.performAscension(pi, heroIdx, zielName, handIndex, {
      // „ignoring its Ascension condition"
      skipCondition: true,
      // „you don't get the Ascension Bonus of the Hero you Ascend to"
      skipBonus: true,
      // „Ascending this way does not end your turn"
      noEndPhase: true,
      // Ohne das faende der spaetere Abstieg keinen Formstapel — die
      // Zielkarten fuehren `formsAscensionStack` nicht.
      forceFormStack: true,
    });

    if (!res?.success) {
      // Aufstieg abgelehnt (Negation, Reaktionsfenster): eine aus dem
      // Deck geholte Karte gehoert zurueck, sonst haette der Versuch
      // sie stillschweigend auf die Hand befoerdert.
      if (quelle === 'deck') {
        const hi = ps.hand.lastIndexOf(zielName);
        if (hi >= 0) {
          ps.hand.splice(hi, 1);
          ps.mainDeck.push(zielName);
          if (typeof engine.shuffleDeck === 'function') engine.shuffleDeck(pi);
        }
      }
      return false;
    }
    if (quelle === 'deck' && typeof engine.shuffleDeck === 'function') engine.shuffleDeck(pi);

    // ── Abstieg vormerken ─────────────────────────────────────────
    // „At the end of your opponent's NEXT turn". `gs.turn` zaehlt je
    // Spielerzug hoch — die naechste Nummer ist der gegnerische Zug.
    const heldInst = heldeninstanz(engine, pi, heroIdx);
    if (heldInst) {
      heldInst.counters = heldInst.counters || {};
      heldInst.counters._identityExpiresTurn = gs.turn + 1;
      // Der Sweep sucht die Ruecknahme ueber `loadCardEffect(inst.name)`
      // — und der Name ist jetzt der der Zielkarte. Dieser Zeiger fuehrt
      // ihn auf DIESE Datei.
      heldInst.counters._identityCleanupCard = CARD_NAME;
    }

    engine.log('throne_robber_ascend', {
      player: ps.username, from: vonForm, into: zielName, source: quelle,
    });
    engine.sync();
    return true;
  },

  /**
   * ④ Der Abstieg am Ende der Gegnerrunde.
   *
   * Gerufen vom Engine-Sweep, NICHT als eigener `onTurnEnd` — nach dem
   * Aufstieg gehoert `hero.name` der Zielkarte, ein eigener Hook waere
   * unerreichbar. Genau daraus folgt auch der Textzusatz „even if it is
   * defeated or its effects are negated": den Sweep haelt weder Tod
   * noch Negation auf.
   */
  async onIdentityExpire(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst) return;
    const pi = inst.owner;
    const heroIdx = inst.heroIdx;
    const vonForm = inst.name;

    const res = await engine.performDescend(pi, heroIdx, {
      // „even if it is defeated"
      evenIfDefeated: true,
    });

    engine.log('throne_robber_descend', {
      player: engine.gs.players[pi]?.username,
      from: vonForm, back: res?.newName || CARD_NAME, ok: !!res?.success,
    });
    engine.sync();
  },
};
