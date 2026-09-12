// ═══════════════════════════════════════════
//  CARD EFFECT: "???, the Shapeshifter"
//  Hero — 450 HP / 40 ATK, Infiltration ×2
//
//  "You may once per turn equip a Hero with a different name from all
//   Heroes you control from your hand, deck or discard pile to this
//   Hero. This Hero gains the effects and name of the Hero equipped to
//   it this way. At the end of your opponent's turn, send all Heroes
//   equipped this way to the discard pile. Heroes equipped this way
//   count as Equipment Artifacts. This Hero can only be equipped with
//   each Hero once per game."
//
//  ── ALS RULINGS (28.8.), BINDEND ───────────────────────────────────
//  ① NUR Name und Effekt werden ersetzt. HP, ATK und die beiden
//     Infiltration-Abilities bleiben die des Shapeshifters — er hat
//     dauerhaft Infiltration 2, in welcher Gestalt auch immer.
//  ② Sein EIGENER Effekt (anlegen und imitieren) ist waehrend der
//     Verwandlung WEG. Nur die Einschraenkung „am Ende der
//     Gegnerrunde faellt es ab" bleibt bestehen — sie ist „lingering".
//  ③ Nur BASIS-Helden (`cardType === 'Hero'`), keine Ascended Heroes.
//     Und „different name from all Heroes you control" vergleicht den
//     AKTUELLEN Namen: zwei Shapeshifter koennen nicht gleichzeitig
//     dieselbe Gestalt tragen.
//  ④ Der angelegte Held belegt eine Support Zone des Shapeshifters.
//     Sind alle drei voll, ist der Effekt nicht aktivierbar.
//  ⑤ „Once per game with each Hero" gilt pro NAME.
//
//  ── WARUM UMBENENNEN STATT OVERLAY ────────────────────────────────
//  Copy Device (v573) legt eine geliehene Identitaet als
//  `_effectOverride` auf die Traegerkarte, weil ein Umbenennen dort
//  verlangt haette, am Zugende die richtige Kopie im Namens-Stapel
//  wiederzufinden. Bei einem HELDEN gibt es dieses Problem nicht: der
//  Slot ist der Anker. Und `performAscension` benennt einen Helden
//  laengst im laufenden Spiel um (`hero.name` + `inst.name` +
//  `inst.script = null`) — das ist das Hausmuster fuer „ein Held wird
//  zu einer anderen Karte".
//
//  Der Gewinn ist gross: `loadCardEffect(hero.name)` loest von selbst
//  den fremden Effekt auf. Damit fallen Ruling ② und ③ ohne eine
//  einzige Sonderabfrage richtig aus — der eigene Effekt ist weg, weil
//  das Skript ein anderes ist, und „aktueller Name" ist schlicht
//  `hero.name`. Bei Copy Device musste JEDE namensbasierte Aufloesung
//  einzeln nachgezogen werden; hier ist es keine.
//
//  ── UND WARUM DIE RUECKNAHME TROTZDEM DRAUSSEN LIEGT ──────────────
//  Genau deshalb aber kann die Rueckverwandlung NICHT in einem eigenen
//  `onTurnEnd` dieser Karte stehen: nach dem Umbenennen laeuft das
//  Skript der FREMDEN Karte, und ein eigener Hook waere nie erreicht —
//  die Gestalt bliebe fuer immer haengen. Dieselbe Falle wie bei Copy
//  Device, nur aus anderer Richtung. Deshalb der Engine-Sweep
//  `_expireBorrowedIdentities` und der Vertrag `onIdentityExpire`.
//
//  Weil der Sweep die Rueckgabe ueber `loadCardEffect(inst.name)`
//  sucht — und der Name gerade der fremde ist —, traegt die
//  Heldeninstanz zusaetzlich `_identityCleanupCard`, das auf DIESE
//  Karte zeigt.
// ═══════════════════════════════════════════

const { hasCardType, baseCardName } = require('./_hooks');

const { loadCardEffect } = require('./_loader');

const CARD_NAME = '???, the Shapeshifter';
const ASCENDED_FORM = '???, the Throne Robber';

/**
 * Zugnummer, an deren Ende die Gestalt abfaellt.
 *
 * Kartentext: „At the end of your opponent's turn". `gs.turn` zaehlt
 * JE SPIELERZUG hoch — die naechste Nummer ist also der gegnerische.
 *
 * (Hier stand vom 28.8. bis zum Abschluss der Puzzle-Tests ein
 * Schalter `TEST_ABLAUF_AM_EIGENEN_ZUGENDE`, weil im Puzzle Mode kein
 * gegnerischer Zug zustande kommt. Al hat ihn freigegeben; er ist
 * entfernt.)
 */
function ablaufZug(gs) {
  return gs.turn + 1;
}

// ─── HELPERS ─────────────────────────────

/**
 * Namen aller Helden, die der Spieler gerade kontrolliert — in ihrer
 * AKTUELLEN Gestalt (Ruling ③). Tote Helden zaehlen mit: ihr Slot ist
 * belegt und ihr Name damit vergeben.
 */
function aktuelleHeldennamen(ps) {
  const namen = new Set();
  for (const h of (ps.heroes || [])) {
    if (h?.name) namen.add(h.name);
  }
  return namen;
}

/** Freie Basis-Support-Zonen dieses Helden (keine Island-Zonen). */
function freieZonen(ps, heroIdx) {
  const zonen = [];
  const sup = ps.supportZones[heroIdx] || [];
  for (let s = 0; s < 3; s++) {
    if ((sup[s] || []).length === 0) {
      zonen.push({ heroIdx, slotIdx: s, label: `Support ${s + 1}` });
    }
  }
  return zonen;
}

/**
 * Schon benutzte Gestalten dieses Shapeshifters (Ruling ⑤, pro Name).
 * Liegt auf dem HELDENOBJEKT, nicht auf der Instanz: das Objekt
 * ueberlebt Tod und Wiederbelebung, und der Slot ist der Anker.
 *
 * Zugleich der Zaehler, den „???, the Throne Robber" spaeter braucht
 * („transformed into 3 or more different Heroes this game") — die
 * Liste ist entdoppelt, ihre Laenge IST die Zahl.
 */
function benutzteGestalten(hero) {
  if (!Array.isArray(hero._shapeshiftUsed)) hero._shapeshiftUsed = [];
  return hero._shapeshiftUsed;
}

/** Der aufgedruckte Name — waehrend der Verwandlung steht er hier. */
function grundname(hero) {
  return hero._shapeshiftBase || hero.name;
}

/**
 * Alle waehlbaren Gestalten aus Hand, Deck und Ablage.
 * Rueckgabe im Galerie-Format `{ name, source }` — die Quellen-Badges
 * HAND / DECK / DISCARD kann der Client bereits darstellen.
 */
function waehlbareGestalten(engine, pi, heroIdx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const hero = ps.heroes?.[heroIdx];
  if (!hero) return [];
  const cardDB = engine._getCardDB();
  const vergeben = aktuelleHeldennamen(ps);
  const schonBenutzt = new Set(benutzteGestalten(hero));

  const zulaessig = (name) => {
    const cd = cardDB[name];
    if (!cd) return false;
    // Ruling ③: NUR Basis-Helden. `hasCardType` wuerde bei
    // „Ascended Hero" ebenfalls auf „Hero" anschlagen, deshalb der
    // strikte Vergleich statt des Helfers.
    if (cd.cardType !== 'Hero') return false;
    if (vergeben.has(baseCardName(name))) return false;
    if (schonBenutzt.has(baseCardName(name))) return false;
    return true;
  };

  const raus = [];
  const gesehen = new Set();
  const sammle = (liste, quelle) => {
    for (const name of (liste || [])) {
      const schluessel = `${name}|${quelle}`;
      if (gesehen.has(schluessel)) continue;
      if (!zulaessig(name)) continue;
      gesehen.add(schluessel);
      raus.push({ name, source: quelle });
    }
  };
  sammle(ps.hand, 'hand');
  sammle(ps.mainDeck, 'deck');
  sammle(ps.discardPile, 'discard');
  return raus;
}

/** Die Heldeninstanz dieses Slots (Traeger der Identitaet). */
function heldeninstanz(engine, pi, heroIdx) {
  return engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx) || null;
}

/**
 * Zurueck in die eigene Gestalt. Nimmt NUR den Namen zurueck; das
 * Ablegen der angelegten Helden macht der Aufrufer, weil es je nach
 * Anlass anders aussieht.
 *
 * Bewusst tolerant: laeuft auch, wenn der Held inzwischen tot ist oder
 * der Slot geleert wurde. Ein Slot mit fremdem Namen waere der
 * schlimmere Zustand — dieselbe Haltung wie im Engine-Sweep, der seine
 * Zaehler in JEDEM Fall abraeumt.
 */
function rueckverwandeln(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  const inst = heldeninstanz(engine, pi, heroIdx);
  const basis = hero ? grundname(hero) : CARD_NAME;
  if (hero && hero._shapeshiftBase) {
    hero.name = basis;
    delete hero._shapeshiftBase;
  }
  if (inst) {
    inst.name = basis;
    // Der Cache MUSS mit — `performAscension` kommentiert genau das:
    // ohne `script = null` feuern die Hooks der alten Aufloesung
    // weiter, obwohl der Name schon ein anderer ist.
    inst.script = null;
    if (inst.counters) {
      delete inst.counters._identityExpiresTurn;
      delete inst.counters._identityCleanupCard;
      delete inst.counters._identityAnchorInst;
    }
  }
  return basis;
}

/**
 * ★ AUFSTIEGSBEREITSCHAFT MELDEN (Als Befund 28.8.: „ich kann nicht
 * ascenden").
 *
 * Der CLIENT bietet einen Aufstieg ausschliesslich dann an, wenn der
 * Held `ascensionReady` traegt UND die Handkarte in `ascensionTarget`
 * bzw. `ascensionTargets` steht. Die Engine haette den Aufstieg laengst
 * durchgelassen — `ascensionCondition` von „???, the Throne Robber" war
 * richtig —, aber es gab keinen Weg, ihn AUSZULOESEN. Fuenftes Glied
 * einer Kette, von der ich vier gebaut hatte.
 *
 * Waflav ist genau darueber schon einmal gestolpert; der Kommentar zu
 * `gameStartHook` in `_waflav-shared.js` beschreibt sogar den Puzzle-
 * Fall: ein aufgestellter Held BEWEGT beim Start nichts, also wurde die
 * Bereitschaft nie berechnet.
 *
 * Die Bedingung wird NICHT nachgebaut, sondern beim Throne Robber
 * erfragt — dort steht sie gedruckt, dort steht auch der Testwert. Zwei
 * Wahrheiten waeren genau der Fehler, den diese Sitzung schon mehrfach
 * gekostet hat.
 */
function aufstiegsbereitschaftPruefen(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  const robber = loadCardEffect(ASCENDED_FORM);
  const bereit = typeof robber?.ascensionCondition === 'function'
    && robber.ascensionCondition(engine.gs, pi, heroIdx, engine);
  if (bereit) {
    hero.ascensionReady = true;
    hero.ascensionTarget = ASCENDED_FORM;
    hero.ascensionTargets = [ASCENDED_FORM];
  } else {
    // Verwandelt ist er kein gueltiges Ziel (Ruling ②) — dann muss die
    // Markierung auch wieder weg, sonst bliebe die Karte auf der Hand
    // hervorgehoben und der Klick liefe in eine Server-Ablehnung.
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

/** Alle als Gestalt angelegten Helden dieses Slots. */
function angelegteGestalten(engine, pi, heroIdx) {
  return engine.cardInstances.filter(c =>
    c.owner === pi && c.zone === 'support' && c.heroIdx === heroIdx
    && c.counters?._shapeshiftEquip);
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Auch dann rechnen, wenn der Held eingefroren, betaeubt oder negiert
  // startet — die Bereitschaft ist eine Anzeige, kein Effekt. Gleiche
  // Begruendung wie bei Beatos `bypassStatusFilter`.
  bypassStatusFilter: true,

  hooks: {
    // Puzzle-Fall: ein aufgestellter Shapeshifter bewegt beim Start
    // nichts, also muss die Bereitschaft hier einmal berechnet werden.
    onGameStart(ctx) {
      aufstiegsbereitschaftPruefen(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
    },
  },
  // KEIN `heroEffectActionCost`: der Kartentext sagt „once per turn",
  // nicht „spend your Action" wie bei Champion, the Stormbringer.
  // Damit ist es ein freier Main-Phase-Effekt.

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    // Ruling ④: ohne freie Support Zone geht es nicht.
    if (freieZonen(ps, heroIdx).length === 0) return false;
    return waehlbareGestalten(engine, pi, heroIdx).length > 0;
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

    const kandidaten = waehlbareGestalten(engine, pi, heroIdx);
    if (kandidaten.length === 0) return false;
    if (freieZonen(ps, heroIdx).length === 0) return false;

    // ── AUSWAHL ────────────────────────────────────────────────────
    // ★ Als Vorgabe 28.8.: KEINE Zonenwahl. Der angelegte Held geht in
    // die erste freie Support Zone — welche es ist, aendert nichts am
    // Spiel, und ein zweiter Dialog fuer eine folgenlose Entscheidung
    // ist nur ein Klick mehr.
    //
    // Damit entfaellt auch die Automaten-Sicherung, die diese Karte im
    // ersten Entwurf von Barker geerbt hatte: die brauchte es nur fuer
    // die Rueckwaertsnavigation ZWISCHEN zwei Abfragen. Bei einer
    // einzigen Abfrage bedeutet Abbrechen schlicht Abbrechen — fuer
    // Mensch und Automat dasselbe, keine Schleife, kein Sonderfall.
    const auswahl = await ctx.promptCardGallery(kandidaten, {
      title: CARD_NAME,
      description: 'Choose a Hero to equip and transform into.',
      cancellable: true,
    });
    if (!auswahl) return false;

    const frei = freieZonen(ps, heroIdx);
    if (frei.length === 0) return false;
    const zielZone = frei[0];
    const gewaehlt = auswahl;

    const gestaltName = gewaehlt.cardName;
    const quelle = gewaehlt.source;

    // ── Karte aus ihrer Quelle nehmen ─────────────────────────────
    // Der Index wird HIER frisch gesucht, nicht oben gemerkt: zwischen
    // Galerie und Zonenwahl liegen zwei Abfragen, und die koennen die
    // Hand veraendert haben.
    let entnommen = false;
    if (quelle === 'hand') {
      const i = ps.hand.indexOf(gestaltName);
      if (i >= 0) { ps.hand.splice(i, 1); entnommen = true; }
    } else if (quelle === 'deck') {
      const _taken_i = await engine.takeFromPile(ps, 'deck', gestaltName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (_taken_i) {
        const i = _taken_i.idx;
        entnommen = true;
      }
    } else if (quelle === 'discard') {
      const _taken_i = await engine.takeFromPile(ps, 'discard', gestaltName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (_taken_i) {
        entnommen = true;
      }
    }
    if (!entnommen) return false;
    if (quelle === 'deck' && typeof engine.shuffleDeck === 'function') {
      engine.shuffleDeck(pi);
    }

    // ── Anlegen ───────────────────────────────────────────────────
    const slot = zielZone.slotIdx;
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    ps.supportZones[heroIdx][slot] = [gestaltName];
    const eqInst = engine._trackCard(gestaltName, pi, 'support', heroIdx, slot);
    if (eqInst) {
      eqInst.counters = eqInst.counters || {};
      // `treatAsEquip` macht die Karte fuer die ganze Engine zur
      // Ausruestung — Kartentext: „count as Equipment Artifacts".
      // Seit dem 28.8. laesst `isActiveIn` damit auch die PASSIVEN
      // Hooks eines angelegten Helden feuern; hier ist das allerdings
      // unerwuenscht, weil die Effekte ueber die Umbenennung kommen
      // und sonst DOPPELT liefen. Deshalb die eigene Marke unten und
      // `_suppressEquipHooks`.
      eqInst.counters.treatAsEquip = true;
      eqInst.counters._shapeshiftEquip = true;
      // ★ Die Effekte gewinnt der Shapeshifter ueber seinen NAMEN,
      // nicht ueber diese Instanz. Ohne diese Marke waere die angelegte
      // Karte eine ZWEITE Quelle desselben Effekts: passive Hooks
      // liefen doppelt, und im Aktivierungsmenue stand der kopierte
      // Held zweimal — einmal als umbenannter Held, einmal als Equip
      // (Als Befund 28.8.). Die Marke sagt darum allgemein: diese
      // Ausruestung ist KEINE eigenstaendige Effektquelle.
      eqInst.counters._suppressEquipHooks = true;
    }
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: gestaltName, from: quelle, to: 'support',
      heroIdx, zoneSlot: slot,
    });

    // ── Verwandeln (Ascension-Muster) ─────────────────────────────
    const vorher = hero.name;
    if (!hero._shapeshiftBase) hero._shapeshiftBase = vorher;
    hero.name = gestaltName;
    // HP, maxHp, atk und die Ability-Zonen bleiben unberuehrt —
    // Ruling ①. `performAscension` rechnet an dieser Stelle einen
    // HP-Delta ein; das ist hier ausdruecklich NICHT gewollt.
    const heldInst = heldeninstanz(engine, pi, heroIdx);
    if (heldInst) {
      heldInst.name = gestaltName;
      heldInst.script = null;   // Cache-Reset, siehe performAscension
      heldInst.counters = heldInst.counters || {};
      // Ruling ②: die Rueckverwandlung am Ende der GEGNERRUNDE — oder,
      // solange der Testschalter oben steht, am eigenen Zugende.
      // Der Sweep greift am Stempel allein.
      heldInst.counters._identityExpiresTurn = ablaufZug(gs);
      // Der Sweep sucht die Rueckgabe ueber `loadCardEffect(inst.name)`
      // — und der Name ist jetzt der fremde. Dieser Zeiger sagt ihm,
      // wessen `onIdentityExpire` laufen soll.
      heldInst.counters._identityCleanupCard = CARD_NAME;
      // ★ Als Vorgabe 28.8.: die Gestalt haengt am TRAEGER. Faellt die
      // angelegte Karte vom Brett (Fire Bomb, Bounce …), verwandelt
      // sich der Held sofort zurueck — nicht erst am Zugende. Die
      // Engine prueft den Anker in `_checkIdentityAnchors`.
      heldInst.counters._identityAnchorInst = eqInst ? eqInst.id : null;
    }

    // Ruling ⑤: Name verbraucht, fuer den Rest des Spiels.
    const benutzt = benutzteGestalten(hero);
    if (!benutzt.includes(gestaltName)) benutzt.push(gestaltName);

    // ── Gestaltwandel sichtbar machen (Als Vorgabe 28.8.) ─────────
    // Weisses Leuchten mit Partikeln, die nach INNEN laufen — das
    // Licht verdichtet sich zur neuen Gestalt. Gegenstueck ist
    // `shapeshift_back` in der Ruecknahme.
    // `dark_control` (aus dem ersten Entwurf uebernommen) passte
    // nicht: das ist die Uebernahme-Animation von Controlled Attack
    // und Control Device, hier uebernimmt niemand etwas.
    engine._broadcastEvent('play_zone_animation', {
      // KEIN `zoneType`: der Verteiler kennt den Wert 'hero' gar nicht.
      // Ohne `zoneSlot` faellt er von selbst auf den Helden-Anker
      // `[data-hero-zone]` — das ist die etablierte Form (dark_control,
      // petrify …). Ein erfundenes Feld haette Unterstuetzung
      // vorgetaeuscht, die es nicht gibt.
      type: 'shapeshift_into', owner: pi, heroIdx,
    });
    // Verwandelt = kein Aufstiegsziel mehr; und die Gestaltenzahl ist
    // gerade gewachsen, also in beiden Richtungen neu bewerten.
    aufstiegsbereitschaftPruefen(engine, pi, heroIdx);
    engine.log('shapeshift', {
      player: ps.username, from: vorher, into: gestaltName,
      source: quelle, distinct: benutzt.length,
    });
    engine.sync();
    return true;
  },

  /**
   * Rueckverwandlung am Ende der Gegnerrunde.
   *
   * Gerufen vom Engine-Sweep `_expireBorrowedIdentities`, NICHT als
   * eigener `onTurnEnd` — die Begruendung steht im Kopf dieser Datei.
   *
   * Laeuft auch, wenn der Shapeshifter inzwischen TOT ist oder den
   * Slot verlassen hat (Als Vorgabe, Copy-Device-Muster: „am Zugende
   * faellt die Identitaet ab, egal wo sie liegt"). Ein Slot mit
   * fremdem Namen waere der schlimmere Zustand.
   */
  async onIdentityExpire(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst) return;
    const pi = inst.owner;
    const heroIdx = inst.heroIdx;

    const gestalt = inst.name;
    // Die Animation VOR dem Umbenennen: sie soll auf der Karte
    // liegen, die gerade noch die fremde Gestalt zeigt.
    engine._broadcastEvent('play_zone_animation', {
      type: 'shapeshift_back', owner: pi, heroIdx,
    });
    const basis = rueckverwandeln(engine, pi, heroIdx);

    // „send ALL Heroes equipped this way to the discard pile" —
    // Mehrzahl, deshalb ueber die Marke gesammelt statt ueber die
    // eine Zone, die gerade gemerkt ist.
    const angelegt = angelegteGestalten(engine, pi, heroIdx);
    for (const eq of angelegt) {
      // Marken ZUERST loesen, dann ablegen: sonst liefe der Abgang
      // noch ueber die Hooks der angelegten Karte (Copy-Device-Lehre).
      if (eq.counters) {
        delete eq.counters.treatAsEquip;
        delete eq.counters._shapeshiftEquip;
        delete eq.counters._suppressEquipHooks;
      }
      await engine.actionDestroyCard(
        { name: eq.name, owner: pi, heroIdx: eq.heroIdx }, eq,
        { toOwnerDiscard: true },
      );
    }

    // Zurueck in der eigenen Gestalt: jetzt kann die Bereitschaft
    // wieder greifen — mit der inzwischen groesseren Gestaltenzahl.
    aufstiegsbereitschaftPruefen(engine, pi, heroIdx);
    engine.log('shapeshift_expire', {
      player: gs.players[pi]?.username, from: gestalt, back: basis,
      released: angelegt.length,
    });
    engine.sync();
  },
};
