// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Copy Device"
//  Artifact (Normal, Cost 0)
//
//  "Choose a \"Future Tech\" Artifact from your discard pile, except
//   \"Future Tech Copy Device\", and shuffle it back into your deck.
//   This Artifact's name, Cost and effect become that Artifact's
//   original name, Cost and effect for the rest of the turn. You can
//   only play 1 \"Future Tech Copy Device\" per turn."
//
//  ── Die teuerste Karte des Archetyps, gemessen an Bauteilen ─────────
//  Sie ist die einzige Karte im Spiel, die für einen Zug eine FREMDE
//  IDENTITÄT annimmt und sie danach wieder abgibt. Al hat den Ablauf
//  am 22.8. festgelegt:
//
//   1. Ziel aus der EIGENEN Ablage wählen (nur "Future Tech"-Artefakte,
//      nicht Copy Device selbst).
//   2. Das Ziel fliegt sichtbar Ablage → Deck und wird eingemischt.
//   3. Copy Devices eigenes Bild wird gezeigt.
//   4. Copy Device aktiviert sich AUTOMATISCH als die kopierte Karte.
//      Kopiert sie eine Ausrüstung, wird sie eine und will eine Support
//      Zone. Kopiert sie einen Einmal-Effekt, läuft der einmal durch.
//   5. Am Zugende fällt die Identität ab — egal wo die Karte liegt.
//      Als Ausrüstung fällt sie sofort ab und geht sichtbar in die Ablage.
//
//  ── DIE KOSTEN (Als Ruling 22.8., korrigiert meine erste Lesart) ────
//  „Copy Device kostet 0 UM EINE ANDERE IDENTITÄT ANZUNEHMEN. Dabei
//   werden ja auch die Kosten kopiert. Wenn dann der kopierte Effekt
//   resolved, sind auch die Kosten zu bezahlen!"
//
//  Daraus folgt der wichtigste Teil dieser Karte: **der Filter**. Was
//  gerade nicht bezahlbar oder nicht ausrüstbar wäre, steht gar nicht
//  erst zur Wahl; bleibt nichts übrig, ist Copy Device nicht
//  aktivierbar. Das ist die Ausnahme von der Archetyp-Regel „Zähler 0
//  darf trotzdem gespielt werden" — dort ist der Leerlauf gewollt, hier
//  wäre er eine Falle: der Spieler würde eine Aktion und den Kartenslot
//  für eine Kopie ausgeben, die er nicht bezahlen kann.
//
//  Was der Filter aussortiert:
//   • Blueprints / Mysterious Core — im Archetyp, aber ohne den NAMEN
//     "Future Tech" (Als Trennung 22.8.: es zählt der Name, wie bei
//     Arrow Slit vs. Topaz).
//   • Copy Device selbst — seit Als Textzusatz vom 22.8.
//   • Escape Device — Subtype `Reaction`: eine Reaktion kann man nicht
//     von sich aus auflösen, die Kopie wäre wirkungslos.
//   • Doomsday Bomb nach dem ersten Einsatz — `oncePerGame`.
//   • jede Ausrüstung ohne legalen Platz (kein lebender, freier,
//     nicht eingefrorener Wirt; eigene `canEquipToHero`-Grenze).
//     Control Device zählt dabei die GEGNERseite ab.
//   • alles, was gerade zu teuer ist.
//
//  ── WARUM DIE IDENTITÄT EIN OVERLAY IST UND KEINE UMBENENNUNG ───────
//  Die Karte behält ihren Namen und bekommt drei Zähler, die es alle
//  schon gab:
//   • `_effectOverride` — Soul Shard Sahs Mimik. `CardInstance.getHook`
//     liest die Hooks daraus, seit v573 auch `isActiveIn`.
//   • `_cardDataOverride` — das Biomancy-Token-Muster. Liefert Name,
//     Kosten, Typ und Effekttext über `getEffectiveCardData`.
//   • `treatAsEquip` — Initiation Ritual. Macht `isEquipInZone` wahr.
//  Eine echte Umbenennung hätte am Zugende das Zurückfinden der
//  richtigen Kopie im Stapel verlangt (mehrere gleichnamige Einträge,
//  Stapel sind Namenslisten) — das Overlay fällt einfach ab.
//
//  ── DER ABLAUF LIEGT IN DER ENGINE, NICHT IN EINEM HOOK ─────────────
//  ★ Ein eigenes `onTurnEnd` wäre hier WIRKUNGSLOS: `getHook` liest bei
//  gesetztem Override die Hooks der GELIEHENEN Karte. Kopiert man ein
//  Control Device (das selbst ein `onTurnEnd` hat), wäre die Rücknahme
//  überschattet und die Identität bliebe für immer hängen. Deshalb
//  ruft der Zugende-Sweep `_expireBorrowedIdentities` das eigene
//  Skript direkt über den Vertrag `onIdentityExpire` — dieselbe
//  Begründung, mit der `_expireTurnEndAdditionalActions` daneben steht.
// ═══════════════════════════════════════════

const { hasCardType, heroCanBeEquipped } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const {
  istFutureTech, waehleAusNamen, setzeAblageAlias, loescheAblageAlias,
} = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Copy Device';

/**
 * Rusting Crystals Verdopplung — SPÄT geladen, nicht oben im Modul.
 *
 * ★ Als Fehlerbericht 22.8.: eine Destrukturierung im Modulkopf hat
 * beim Puzzle-Start `applyRustingCrystalCostMultiplier is not a
 * function` geworfen und das ganze Spiel nicht hochkommen lassen.
 * Zwei Lehren, beide hier umgesetzt:
 *
 *  ① `_engine.js` holt sich dieses Modul an ALLEN SECHS Stellen erst
 *     im Aufruf (`require('./_crystals-shared').shuffleIntoDeckBlocked(…)`).
 *     Das ist kein Zufall, sondern das Hausmuster — ich hatte es
 *     gebrochen.
 *  ② Wichtiger noch: `canActivate` läuft beim SPIELSTART über jede
 *     Handkarte (`getUnactivatableArtifacts`), und die Engine fängt
 *     dort NICHTS ab. Eine Karte, deren Gate wirft, reisst damit den
 *     Spielstart mit. Ein Kartengate darf deshalb NIE werfen — auch
 *     nicht, wenn ein Nachbarmodul fehlt oder veraltet ist.
 *
 * Fehlt der Helfer, wird der Grundpreis genommen und EINMAL gewarnt.
 * Lieber ein Preis ohne Verdopplung als ein Spiel, das nicht startet.
 */
let _rustingGewarnt = false;
function rustingVerdopplung(engine, pi, name, grundpreis) {
  try {
    const helfer = require('./_crystals-shared').applyRustingCrystalCostMultiplier;
    if (typeof helfer !== 'function') throw new Error('Helfer fehlt');
    return helfer(engine.gs, pi, name, grundpreis, engine);
  } catch (err) {
    if (!_rustingGewarnt) {
      _rustingGewarnt = true;
      console.warn(`[${CARD_NAME}] Rusting-Crystal-Verdopplung nicht verfuegbar `
        + `(${err.message}) — es wird mit dem Grundpreis gerechnet. `
        + `Deutet auf eine veraltete _crystals-shared.js hin.`);
    }
    return grundpreis;
  }
}
/** Flugdauer Ablage → Deck, bevor umgebucht wird. */
const FLUG_MS = 520;
/** Wie lange Copy Devices eigenes Bild steht, bevor die Kopie loslegt. */
const REVEAL_MS = 700;
const HOPT_KEY = 'ft-copy-device';

/**
 * Was kostet die kopierte Karte GERADE?
 *
 * Grundpreis minus `selfCostReduction` (Als Beispiel: Laser Cannon,
 * −20 je Kopie in der Ablage).
 *
 * ★ DER ZEITPUNKT IST DIE GANZE SCHWIERIGKEIT (zweimal aufgeflogen):
 *   bezahlt wird, NACHDEM die gewählte Kopie die Ablage verlassen hat
 *   und ins Deck gewandert ist. Wer den Preis davor rechnet, rechnet
 *   mit einer Kopie zu viel — bei Laser Cannon glatte 20 Gold. Deshalb
 *   wird die Kopie für die Rechnung kurz herausgenommen.
 *
 * ★★ **DIESE FUNKTION IST NICHT IDEMPOTENT.** Sie MUSS aufgerufen
 *   werden, SOLANGE die gewählte Kopie noch in der Ablage liegt. Ruft
 *   man sie danach noch einmal, nimmt sie eine ZWEITE Kopie heraus und
 *   liefert einen zu hohen Preis. Genau das war Als Befund vom 22.8.
 *   („2 Laser Cannons im Discard, Kosten bleiben 60 statt 40") — mein
 *   Kommentar behauptete das Gegenteil, und der Prüfstand hat es nicht
 *   gemerkt, weil alle Bezahl-Proben Karten OHNE `selfCostReduction`
 *   benutzten. `resolve` rechnet den Preis deshalb EINMAL vor dem
 *   Umbuchen und reicht die Zahl weiter.
 *
 * BEWUSST NICHT dabei:
 *  • die handindizierten Rabatte (`_handCostReductions`, Play Money) —
 *    die kopierte Karte hat keinen Handplatz, an dem sie hängen könnte;
 *  • Misfires namensweiter Nullpreis und Shu'Chakus
 *    „nächstes Artefakt" — beide sind für das SPIELEN einer Handkarte
 *    gedacht und wurden von Copy Device selbst schon verbraucht.
 *
 * DABEI ist dagegen die **Rusting-Crystal-Verdopplung** (Als Vorgabe
 * 22.8.). Sie greift VOR dem Rabatt, wie überall sonst auch. Der
 * Helfer dafür ist dafür aus `server.js` nach `_crystals-shared.js`
 * gewandert — eine Regel, eine Fundstelle.
 */
function kopierKosten(engine, pi, name) {
  const cd = engine._getCardDB()[name];
  if (!cd) return 0;
  const sk = loadCardEffect(name);
  let kosten = rustingVerdopplung(engine, pi, name, cd.cost || 0);
  if (typeof sk?.selfCostReduction !== 'function') return Math.max(0, kosten);

  const ps = engine.gs.players[pi];
  const idx = (ps?.discardPile || []).lastIndexOf(name);
  if (idx >= 0) ps.discardPile.splice(idx, 1);      // wie nach dem Umbuchen
  try {
    kosten -= (sk.selfCostReduction(engine.gs, pi, cd, engine) || 0);
  } catch { /* eine defekte Rabattrechnung darf die Karte nicht sperren */ } finally {
    if (idx >= 0) ps.discardPile.splice(idx, 0, name);
  }
  return Math.max(0, kosten);
}

/**
 * Alle Plätze, an denen die kopierte AUSRÜSTUNG gerade landen könnte.
 *
 * Liest dieselben drei Regeln wie der Server-Weg (`doPlayArtifact`,
 * Equip-Zweig): `heroCanBeEquipped` (tot / eingefroren / bezaubert),
 * ein freier Platz, und die karteneigene `canEquipToHero`-Grenze
 * (Future Tech Gear: nur EINE ausgerüstet). `placesOnOpponentBoard`
 * dreht die Seite um — Control Device sucht beim Gegner.
 */
function equipPlaetze(engine, pi, name, sk) {
  const gs = engine.gs;
  const seite = sk?.placesOnOpponentBoard ? (pi === 0 ? 1 : 0) : pi;
  const ps = gs.players[seite];
  const out = [];
  if (!ps) return out;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!heroCanBeEquipped(ps.heroes[hi])) continue;
    if (typeof sk?.canEquipToHero === 'function') {
      try {
        if (!sk.canEquipToHero(gs, pi, hi, engine)) continue;
      } catch { continue; }
    }
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) {
        out.push({ owner: seite, heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return out;
}

/**
 * ★ DER FILTER. Welche Namen aus der eigenen Ablage sind kopierbar?
 * Begründung je Zeile im Kopf der Datei.
 *
 * ★ REKURSIONSRIEGEL: der Filter fragt fremde `canActivate`-Gates.
 * Käme ein solches Gate je auf diesen Filter zurück, liefe der Aufruf
 * im Kreis. Heute kann das nur Copy Device selbst — und die ist per
 * Kartentext ausgeschlossen —, aber das ist eine Zusicherung von einer
 * Textzeile. Im Prüfstand ist genau das aufgefallen: OHNE den
 * Selbstausschluss lief die Rekursion in einen Stapelüberlauf, den das
 * `try/catch` unten schluckte, und das Ergebnis war nur zufällig
 * richtig. Der Riegel macht daraus eine bewusste Antwort.
 */
let _filterLaeuft = false;
function kopierbareNamen(engine, pi) {
  if (_filterLaeuft) return [];
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const namen = [...new Set((ps.discardPile || []).filter(istFutureTech))];

  _filterLaeuft = true;
  try {
    return namen.filter((n) => pruefeKandidat(engine, gs, ps, pi, cardDB, n));
  } finally {
    _filterLaeuft = false;
  }
}

/** Eine einzelne Kandidatenprüfung — herausgezogen, damit der Riegel oben lesbar bleibt. */
function pruefeKandidat(engine, gs, ps, pi, cardDB, n) {
  {
    if (n === CARD_NAME) return false;               // Als Textzusatz 22.8.
    const cd = cardDB[n];
    if (!cd || !hasCardType(cd, 'Artifact')) return false;
    const sk = loadCardEffect(n);
    if (!sk) return false;

    // Einmal pro Spiel bereits verbraucht (Doomsday Bomb).
    if (sk.oncePerGame && ps._oncePerGameUsed?.has(sk.oncePerGameKey || n)) return false;

    // Karten, die ihren Preis selbst ausrechnen, kann der Filter nicht
    // vorab beziffern — dann lieber gar nicht anbieten, als den Spieler
    // in eine unbezahlbare Kopie laufen zu lassen. (Im Archetyp
    // derzeit keine.)
    if (sk.manualGoldCost) return false;
    if (!engine.canAffordGold(pi, kopierKosten(engine, pi, n), n)) return false;

    const sub = String(cd.subtype || '').toLowerCase();
    if (sub === 'equipment') return equipPlaetze(engine, pi, n, sk).length > 0;

    // Reaktionen lösen sich nicht von selbst aus (Escape Device).
    if (sub === 'reaction' && !sk.proactivePlay) return false;
    // Artefakte, die über den SERVER-Zielpfad laufen (`getValidTargets`
    // + `targetingConfig`), kann ein Kartenskript nicht auflösen — der
    // Weg führt über `gs.potionTargeting`. Im Archetyp derzeit keine;
    // Al vorgelegt, falls das je eine geben soll.
    if (sk.getValidTargets && sk.targetingConfig) return false;
    if (typeof sk.resolve !== 'function') return false;
    if (typeof sk.canActivate === 'function') {
      try {
        if (!sk.canActivate(gs, pi, engine)) return false;
      } catch { return false; }
    }
    return true;
  }
}

/** Die Instanz dieser Karte auf der Hand — Trägerin der Identität. */
function handInstanz(engine, pi) {
  // Wie bei Ladder to the Sky: Handkarten sind getrackt, aber ohne
  // Handindex. Bei zwei Copy Devices auf der Hand ist die Wahl beliebig
  // — die zweite ist diesen Zug ohnehin gesperrt (1 pro Zug).
  return engine.findCards({ owner: pi, zone: 'hand', name: CARD_NAME })[0] || null;
}

/** Die drei Identitäts-Zähler auf eine Instanz stempeln. */
function nimmIdentitaetAn(engine, inst, name, istEquip) {
  const cd = engine._getCardDB()[name];
  if (!inst || !cd) return;
  if (!inst.counters) inst.counters = {};
  inst.counters._effectOverride = name;        // Hooks + activeIn
  inst.counters._cardDataOverride = { ...cd }; // Name, Kosten, Typ, Effekttext
  inst.counters._ftCopyOf = name;              // Kartenbild (Client)
  inst.counters._identityExpiresTurn = engine.gs.turn;
  if (istEquip) inst.counters.treatAsEquip = true;

  // ★ Der Ablage-Alias wird HIER gesetzt, obwohl die Karte noch gar
  //   nicht in der Ablage liegt. Er zählt trotzdem erst, wenn sie dort
  //   ankommt — `setzeAblageAlias` merkt sich, wie viele Träger schon
  //   dort lagen, und `aktiveAliase` verlangt einen mehr. Damit gilt
  //   Als Vorgabe „als Equip zerstört zählt bis Rundenende weiter als
  //   die kopierte Karte" ohne einen eigenen Auslöser — und der
  //   kopierte Effekt zählt sich während seiner Auflösung trotzdem
  //   nicht selbst mit, weil die Karte da noch in der Hand liegt.
  const besitzer = inst.originalOwner ?? inst.owner;
  setzeAblageAlias(engine.gs, besitzer, CARD_NAME, name, { instId: inst.id });
}

/**
 * Die kopierte Ausrüstung anlegen. Gibt die Board-Instanz zurück oder
 * null.
 *
 * Der Platz wird über `safePlaceInSupport` belegt — also über den
 * Hausweg, der `_trackCard` und die Zonen-Buchhaltung mitmacht. Die
 * Identität wandert danach auf die NEUE Instanz; die Handinstanz
 * verschwindet mit dem Handsplice des Servers.
 */
async function legeAlsAusruestungAn(engine, pi, name, sk) {
  const gs = engine.gs;
  const plaetze = equipPlaetze(engine, pi, name, sk);
  if (plaetze.length === 0) return null;

  let ziel = plaetze[0];
  if (plaetze.length > 1) {
    // ★ NICHT abbrechbar (Als Vorgabe 22.8.). Der Zwang steht zusätzlich
    //   über `gs._forcedCommitPlayer` — hier doppelt, damit die Absicht
    //   an der Karte lesbar bleibt.
    const r = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Equip "${name}" to which Support Zone?`,
      zones: plaetze,
      cancellable: false,
    });
    if (r && !r.cancelled && r.heroIdx != null) {
      ziel = plaetze.find(z => z.heroIdx === r.heroIdx && z.slotIdx === r.slotIdx) || ziel;
    }
  }

  const platziert = engine.safePlaceInSupport(CARD_NAME, ziel.owner, ziel.heroIdx, ziel.slotIdx);
  if (!platziert?.inst) return null;
  const { inst, actualSlot } = platziert;

  // Powder-Keg-Modell für Cross-Side (Control Device): die
  // GASTGEBERSEITE besitzt die Karte, damit sie deren Hooks auslöst;
  // der Spieler steht in `originalOwner` und bekommt sie am Ende zurück.
  if (ziel.owner !== pi) inst.originalOwner = pi;

  nimmIdentitaetAn(engine, inst, name, true);

  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: actualSlot,
  });
  await engine._delay(320);

  // Die Hooks der KOPIERTEN Karte — `getHook` löst sie über das
  // Override auf, es braucht hier also keinen Sonderweg.
  await engine.runHooks('onPlay', {
    _onlyCard: inst, playedCard: inst, cardName: name,
    zone: 'support', heroIdx: ziel.heroIdx, zoneSlot: actualSlot,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: ziel.heroIdx,
  });

  // „You can only play 1 per game" der KOPIERTEN Karte mitführen —
  // sonst wäre Copy Device ein Weg, die Grenze zu umgehen.
  if (sk?.oncePerGame) {
    const ps = gs.players[pi];
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add(sk.oncePerGameKey || name);
  }
  return inst;
}

module.exports = {
  isTargetingArtifact: false,

  // Mischt aus der ABLAGE ins eigene Deck zurück — damit greift
  // Distracting Crystal (Als Ruling 16.8.: der Kristall deckt Hand und
  // Ablage ab). Vorbild `deepsea-stein.js`, das denselben Weg geht.
  // ★ Hinweis an Al: Future Tech Weathercock mischt ebenfalls eine
  //   Kopie aus der Ablage ins Deck, trägt den Vertrag aber NICHT.
  //   Entweder ist das dort vergessen worden, oder eine Reaktions-Kosten-
  //   zahlung soll bewusst nicht darunterfallen — nicht eigenmächtig
  //   angefasst.
  shufflesFromHandOrDiscardIntoDeck: true,

  canActivate(gs, pi, engine) {
    if (!engine) return true;
    // ★ NIE WERFEN: dieses Gate läuft beim Spielstart über jede
    //   Handkarte (`getUnactivatableArtifacts`), und die Engine fängt
    //   dort nichts ab — ein Fehler hier legt den ganzen Spielstart
    //   lahm (Als Puzzle-Fehlerbericht 22.8.). Im Zweifel: die Karte
    //   nicht anbieten.
    try {
      // „You can only play 1 … per turn" — harte Sperre je Spieler.
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
      // ★ Und Als Filterregel: gibt es nichts sinnvoll Kopierbares, ist
      //   die Karte nicht aktivierbar.
      return kopierbareNamen(engine, pi).length > 0;
    } catch (err) {
      console.error(`[${CARD_NAME}] canActivate:`, err.message);
      return false;
    }
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const kandidaten = kopierbareNamen(engine, pi);
    if (kandidaten.length === 0) return { cancelled: true };

    // Die Galerie zeigt die Stückzahlen aus der Ablage, aber nur für
    // taugliche Namen. Diese EINE Wahl ist abbrechbar — sie IST die
    // Aktivierung (Als Grundsatz von Control Device: „Die Wahlfreiheit
    // liegt im Aktivieren"). Alles danach ist bindend.
    const ablageEintraege = (ps.discardPile || []).filter(n => kandidaten.includes(n));
    const gewaehlt = await waehleAusNamen(engine, pi, ablageEintraege, {
      source: 'discard',
      title: CARD_NAME,
      description: 'Choose a "Future Tech" Artifact to shuffle back into your deck and copy for the rest of the turn.',
      cancellable: true,
    });
    if (!gewaehlt) return { cancelled: true };
    if (!engine.claimHOPT(HOPT_KEY, pi)) return { cancelled: true };

    const idx = (ps.discardPile || []).lastIndexOf(gewaehlt);
    if (idx < 0) return { cancelled: true };      // Zustand hat sich verschoben

    // ★ KOSTEN JETZT RECHNEN, VOR DEM UMBUCHEN (Als Fehlerbericht
    //   22.8.: „2 Laser Cannons im Discard, Kosten bleiben 60 statt
    //   40"). `kopierKosten` nimmt für seine Rechnung EINE Kopie aus
    //   der Ablage — die, die gleich ins Deck wandert. Rief man die
    //   Funktion NACH dem Umbuchen, nahm sie eine ZWEITE heraus und
    //   rechnete mit einem Rabatt zu wenig.
    //
    //   Mein Kommentar behauptete, der Aufruf sei idempotent. Das
    //   stimmt nur bei genau EINER Kopie — bei zweien nicht, und genau
    //   so hat Al es gefunden. Jetzt wird die Zahl EINMAL bestimmt und
    //   danach nur noch weitergereicht; damit zahlt der Spieler auch
    //   garantiert das, was der Filter ihm angeboten hat.
    const sk = loadCardEffect(gewaehlt);
    const cd = engine._getCardDB()[gewaehlt];
    const istEquip = String(cd?.subtype || '').toLowerCase() === 'equipment';
    const kosten = kopierKosten(engine, pi, gewaehlt);

    // ── 1) Ablage → Deck, sichtbar, dann einmischen ──
    // Flug VOR der Umbuchung, sonst startet er an einem Platz, den es
    // nicht mehr gibt (Weathercock-Lehre).
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: gewaehlt, from: 'discard', to: 'deck',
    });
    await engine._delay(FLUG_MS);
    ps.discardPile.splice(idx, 1);
    ps.mainDeck.push(gewaehlt);
    engine.shuffleDeck(pi, 'main');               // schickt die Misch-Animation mit

    // ── 2) Copy Devices eigenes Bild ──
    // Der Server hält den Auftritt dieser Karte bis nach der Auflösung
    // zurück; hier ist der richtige Moment, also selbst auslösen.
    // `_firePendingCardReveal` räumt den Merker gleich mit ab, es gibt
    // also keinen zweiten Auftritt hinterher.
    if (gs._pendingCardReveal) engine._firePendingCardReveal();
    else engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
    await engine._delay(REVEAL_MS);

    engine.log('ft_copy_device', {
      player: ps.username, copied: gewaehlt, cost: kosten,
      as: istEquip ? 'equipment' : 'normal',
    });

    // ── 3) Identität annehmen und als die Kopie auflösen ──
    // Solange das läuft, kann der Spieler nicht mehr zurück.
    const vorherigerZwang = gs._forcedCommitPlayer;
    gs._forcedCommitPlayer = pi;
    let boardInst = null;
    try {
      if (kosten > 0) await engine._payCardCost(pi, kosten, { cardName: gewaehlt });

      if (istEquip) {
        boardInst = await legeAlsAusruestungAn(engine, pi, gewaehlt, sk);
        if (boardInst) {
          // Der Server soll die Karte NICHT zusätzlich in die Ablage
          // legen — sie liegt jetzt auf dem Brett (derselbe Ausstieg,
          // den die Area-Artefakte benutzen).
          gs._spellPlacedOnBoard = true;
        }
      } else {
        await sk.resolve(engine, pi, [], []);
      }
    } finally {
      if (vorherigerZwang === 0 || vorherigerZwang === 1) gs._forcedCommitPlayer = vorherigerZwang;
      else delete gs._forcedCommitPlayer;
    }

    // ── 4) Nachlauf für den Nicht-Ausrüstungs-Fall ──
    // Die Karte geht gleich in die Ablage und liegt dort bis zum
    // Zugende als die kopierte Karte. Den Alias hat
    // `nimmIdentitaetAn` schon eingetragen; wirksam wird er in dem
    // Moment, in dem der Server den Namen in die Ablage schiebt.
    if (!boardInst) {
      const inst = handInstanz(engine, pi);
      if (inst) {
        // Wie Ladder to the Sky: der Server schiebt den Namen in die
        // Ablage, die INSTANZ muss man selbst umzonen, sonst fällt sie
        // aus dem Hook-Filter.
        inst.zone = 'discard';
        inst.heroIdx = -1;
        inst.zoneSlot = -1;
        nimmIdentitaetAn(engine, inst, gewaehlt, false);
      }
    }

    engine.sync();
    return { ok: true };
  },

  /**
   * ★ Zugende: die geliehene Identität fällt ab.
   *
   * Gerufen von `engine._expireBorrowedIdentities()`, NICHT über die
   * Hook-Kette — siehe Kopf der Datei. Das Abräumen der Zähler
   * übernimmt die Engine hinterher; hier steht nur, was darüber hinaus
   * geschehen muss.
   */
  async onIdentityExpire(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst) return;
    const besitzer = inst.originalOwner ?? inst.owner;

    const kopiertVon = inst.counters?._ftCopyOf || null;
    // Alias in der Ablage in JEDEM Fall lösen — er hängt am Namen der
    // Trägerkarte, nicht an der Zone.
    loescheAblageAlias(gs, besitzer, CARD_NAME, inst.id);

    if (inst.zone !== 'support') {
      // Liegt in der Ablage (oder sonstwo): nur die Identität geht.
      engine.log('ft_copy_device_expire', {
        player: gs.players[besitzer]?.username, copied: kopiertVon, wasEquipped: false,
      });
      return;
    }

    // ── Als Vorgabe: „War es ein Equip, fällt es sofort ab und geht
    //    zum Discard (visuell sichtbar!)" ──
    // Die Identität zuerst abnehmen, DANN ablegen: sonst liefe der
    // Abgang noch über die Hooks der kopierten Karte.
    delete inst.counters._effectOverride;
    delete inst.counters._cardDataOverride;
    delete inst.counters._ftCopyOf;
    delete inst.counters.treatAsEquip;

    engine.log('ft_copy_device_expire', {
      player: gs.players[besitzer]?.username, copied: kopiertVon, wasEquipped: true,
    });
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: besitzer, heroIdx: inst.heroIdx }, inst,
      { toOwnerDiscard: true },
    );
  },
};
