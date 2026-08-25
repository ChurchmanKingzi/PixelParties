'use strict';
// ═══════════════════════════════════════════════════════════════════
//  ENTSCHEIDUNGS-PROTOKOLL (v589, repariert in v590)
//
//  Ein generischer Aufzeichnungsvertrag für ALLE Entscheidungen, die
//  die CPU im Spiel trifft — statt wie bisher ein eigener Kanal je
//  Kartenart.
//
//  ── WARUM ─────────────────────────────────────────────────────────
//  Der bisherige Recorder verdrahtet Entscheidungen kartenweise:
//
//      menus.push({ s: 'Timeless King Zi', … });
//      menus.push({ s: 'Magic Lamp',       … });
//
//  Jede neue Karte mit einem Menü braucht also eine neue Zeile im
//  Recorder. Genau deshalb haben nur 9 von 42 Profilen Menü-Regeln —
//  nicht weil die Daten fehlen, sondern weil sie nie erfasst wurden.
//
//  Und schwerer: NICHTS im alten Recorder hält fest, wenn ein
//  Angebot ABGELEHNT wurde. Von 1404 Karten mit Effekttext sagen 612
//  „you may" — bei 44 % aller Karten sieht der Lerner also nur die
//  Zusagen und kann strukturell nicht lernen, wann man verzichtet.
//
//  ── DER VERTRAG ───────────────────────────────────────────────────
//  Alle Entscheidungen des Spiels laufen durch GENAU ZWEI Trichter auf
//  Engine-Ebene. Die ctx-Helfer sind nur Vorbau:
//
//      promptConfirmEffect ┐
//      promptCardGallery   ├─► engine.promptGeneric
//      promptZonePick      ┘
//
//      promptDamageTarget  ┐
//      promptMultiTarget   ├─► engine.promptEffectTarget
//      promptTarget        ┘
//
//  Instrumentiert werden diese zwei Methoden, nicht die 912
//  Kartenskripte — jede künftige Karte ist damit automatisch erfasst.
//
//  Eine Zeile hält fest: Karte, Art der Entscheidung, angebotene
//  Optionen, Gewähltes (null = abgelehnt) und den Spielzustand.
//
//  ── ★ WARUM DIE INSTRUMENTIERUNG HIER SITZT UND NICHT IN _engine.js ─
//  DER v589-FEHLER, teuer und lehrreich: der Hook lag als fester Block
//  IN `GameEngine.prototype.promptGeneric`. Er hat in 20 aufgezeichneten
//  Spielen NULL Zeilen erzeugt — nicht weil er falsch gefiltert hätte,
//  sondern weil die CPU diese Methode nie erreicht:
//
//      installCpuBrain(engine)   // _cpu.js ~6319
//        → engine.promptGeneric = async function (…) { …
//              if (engine.isCpuPlayer(playerIdx)) { … return picked; }
//              return origPromptGeneric(…);   // ← nur für Menschen
//          }
//
//  Das Gehirn ERSETZT die Methode auf der Instanz und beantwortet
//  CPU-Prompts selbst. `origPromptGeneric` — und damit der Hook —
//  wird ausschließlich auf dem Menschen-Pfad erreicht. In einem
//  Headless-Trainingsspiel gibt es keinen Menschen. Dasselbe gilt
//  für `promptEffectTarget` (_cpu.js ~6427).
//
//  LEHRE: eine Aufzeichnung gehört NICHT in eine Methode, die andere
//  Module überschreiben dürfen. Sie gehört ganz nach AUSSEN — als
//  Umhüllung dessen, was zum Zeitpunkt des Anhängens da ist. Der
//  Recorder hängt nach `installCpuBrain` an (server.js: erst
//  `installCpuBrain`, dann `attachTrainingRecorder`), unsere Hülle
//  sitzt damit über dem Gehirn und sieht JEDE Antwort, egal welcher
//  innere Pfad sie erzeugt hat.
//
//  Damit dieselbe Falle nicht ein zweites Mal zuschnappt, zählt
//  `diagnose()` mit, wie oft die Trichter durchlaufen wurden, und
//  meldet, wenn jemand NACH uns überschrieben hat. Ein leeres
//  `decisions`-Feld erklärt sich dann selbst, statt eine Sitzung zu
//  kosten.
//
//  ── WAS HIER BEWUSST NICHT PASSIERT ───────────────────────────────
//  Dieses Modul BEWERTET nichts und bündelt nichts. Es schreibt roh
//  mit. Ob eine Entscheidung pro Karte oder über die Absicht gelernt
//  wird, entscheidet allein der Trainer — und zwar nach der Gestalt
//  der Entscheidung:
//
//    • schmal/binär (》you may《)  → PRO KARTE schlüsseln. Eine
//      gemittelte Ja/Nein-Rate über verschiedene optionale Trigger
//      wäre nicht nur nutzlos, sondern schädlich: sie zöge einen
//      Trigger, der fast immer schlecht ist, Richtung 》meistens ja《.
//    • breit/kategorisch (Zielwahl) → über die ABSICHT bündeln,
//      Geometrie als Tags, kartenspezifische Abweichung obendrauf.
//      Pro Karte zerfasern die Beobachtungen über Seite × Art ×
//      Reihe × Position zu nichts.
//
//  Faustregel: gebündelt wird nur, wo die Absicht die Entscheidung
//  tatsächlich bestimmt. Bei Zielwahl tut sie das (》Heilung geht auf
//  niedrige HP《 gilt kartenübergreifend), bei Ob-überhaupt nicht.
//
//  Deshalb schreibt die Zielwahl die ABSICHTSFELDER ROH mit
//  (`baseDamage`, `isHealing`, `appliesStatus`, `isBuff` …) statt ein
//  Tag-Vokabular zu erfinden. Aufzeichnen ist gratis und NICHT
//  nachholbar; ein Vokabular lässt sich später aus rohen Feldern
//  ableiten, aber ein nicht erfasstes Feld ist für alle je
//  gesammelten Spiele verloren.
//
//  ── VERZÖGERTE BEWERTUNG ──────────────────────────────────────────
//  Manche Entscheidungen zahlen sich erst später aus. Omikron etwa
//  legt eine Kopie mit 1 HP und für EINE Runde negiertem Effekt —
//  ob sich das gelohnt hat, entscheidet sich erst, wenn der Gegner
//  seinen Zug hatte. 172 Karten tragen ein solches Zeitfenster
//  (》until the start of your next turn《 und Verwandte). Für sie
//  trägt `nachtragen()` das Ergebnis in die bereits geschriebene
//  Zeile nach.
//
//  ── SICHERHEIT ────────────────────────────────────────────────────
//  Kein Aufruf dieses Moduls darf je eine Partie stören. Alles läuft
//  in try/catch, und ohne aktive Aufzeichnung ist jede Funktion ein
//  No-op: der Puffer entsteht ausschließlich in `armLog()`, das der
//  Recorder beim Anhängen ruft. Läuft kein Training, existiert
//  `engine._decisionLog` nicht, die Hüllen werden gar nicht erst
//  installiert und die Engine läuft bit-identisch wie vorher.
// ═══════════════════════════════════════════════════════════════════

const MAX_ZEILEN = 4000;   // Deckel je Partie; sprengt kein jsonl
const MAX_OPTIONEN = 24;   // längere Angebote werden gezählt, nicht gelistet

// ── Zustandsmerkmale ───────────────────────────────────────────────
// Aufzeichnen ist gratis und NICHT nachholbar: jeder Faktor, der hier
// fehlt, fehlt rückwirkend für alle je gesammelten Spiele. Also
// reichlich mitnehmen. Gelernt wird davon später ohnehin nur, was die
// Datenlage trägt — additive Deltas je Faktor mit t-Gate, keine
// gekreuzten Fächer (188 Beobachtungen über 80 Fächer wären Rauschen,
// und Rauschen mit hohem Gewicht ist genau das, was ein Profil auf
// 42 % Spiegel-Winrate bringt).
function zustand(engine, pi) {
  const z = {};
  try {
    const gs = engine && engine.gs;
    if (!gs) return z;
    const oi = pi === 0 ? 1 : 0;
    const ps = gs.players && gs.players[pi];
    const os = gs.players && gs.players[oi];
    z.t = gs.turn || 0;
    if (gs.currentPhase != null) z.ph = String(gs.currentPhase);

    const lebend = (p) => ((p && p.heroes) || []).filter(h => h && (h.hp || 0) > 0).length;
    const hpSumme = (p) => ((p && p.heroes) || []).reduce((s, h) => s + Math.max(0, (h && h.hp) || 0), 0);

    z.hl = lebend(ps);            // eigene lebende Helden
    z.ho = lebend(os);            // gegnerische lebende Helden
    z.hd = z.hl - z.ho;           // Differenz — Als bevorzugter Standing-Begriff
    z.hp = hpSumme(ps);
    z.op = hpSumme(os);
    if (ps) {
      if (Array.isArray(ps.hand)) z.hh = ps.hand.length;
      if (Array.isArray(ps.deck)) z.dk = ps.deck.length;
      if (Array.isArray(ps.mainDeck)) z.dk = ps.mainDeck.length;
      if (Array.isArray(ps.discardPile)) z.dp = ps.discardPile.length;
      if (typeof ps.gold === 'number') z.g = ps.gold;
    }
    if (os) {
      if (Array.isArray(os.hand)) z.oh = os.hand.length;
      if (Array.isArray(os.mainDeck)) z.od = os.mainDeck.length;
      if (typeof os.gold === 'number') z.og = os.gold;
    }
  } catch { /* Zustand ist Beiwerk — eine Partie stirbt daran nicht */ }
  return z;
}

// ── Puffer anlegen ─────────────────────────────────────────────────
// Ruft der Recorder. Ohne diesen Aufruf bleibt alles Weitere ein
// No-op, das Modul kostet im Live-Betrieb also nichts. Die
// Instrumentierung wird gleich mit angelegt, damit sie nicht
// versehentlich vergessen werden kann — genau der Fehler, der v589
// gekostet hat, war eine Aufzeichnung ohne Anschluss.
function armLog(engine, pinnedIdx) {
  try {
    engine._decisionLog = [];
    engine._decisionPinned = pinnedIdx;
    engine._decisionSeq = 0;
    instrumentiere(engine);
  } catch { /* egal */ }
}

function aktiv(engine) {
  return !!(engine && Array.isArray(engine._decisionLog));
}

// Optionen klein halten: der Lerner braucht Namen, keine Objekte.
function kuerzeOptionen(opts) {
  if (!Array.isArray(opts)) return null;
  const namen = opts.map(o => {
    if (o == null) return null;
    if (typeof o === 'string') return o;
    if (typeof o === 'object') return o.name || o.cardName || o.label || o.text || o.id || null;
    return String(o);
  });
  if (namen.length > MAX_OPTIONEN) return { n: namen.length, o: namen.slice(0, MAX_OPTIONEN) };
  return { n: namen.length, o: namen };
}

// ── Eine Entscheidung festhalten ───────────────────────────────────
//  eintrag: { art, karte, optionen, gewaehlt, tags, zusatz }
//    art      — Bedeutungs-Tag des Trichters ('optIn', 'mode', 'gallery',
//               'discard', 'zone', 'target', 'generic:<typ>')
//    karte    — auslösende Karte; bei promptGeneric injiziert die Engine
//               sie über _promptCardStack als promptData.showCard
//    gewaehlt — null bedeutet ABGELEHNT. Das ist der Kern des Ganzen:
//               ohne die Nullen gibt es keine Grundrate, der Lerner
//               sähe nur Einsen.
//    zusatz   — rohe Zusatzfelder (Absichtsfelder der Zielwahl u.ä.),
//               unbewertet in die Zeile gemischt.
//  Rückgabe: laufende Nummer für spätere Nachträge, oder null.
function notiere(engine, pi, eintrag) {
  if (!aktiv(engine)) return null;
  try {
    // Nur der gepinnte Spieler wird gelernt — die Gegnerseite würde
    // fremde Politik in dieselben Regeln mischen.
    if (engine._decisionPinned != null && pi !== engine._decisionPinned) {
      zaehle(engine, 'fremd');
      return null;
    }
    if (engine._decisionLog.length >= MAX_ZEILEN) { zaehle(engine, 'voll'); return null; }

    const id = ++engine._decisionSeq;
    const zeile = {
      i: id,
      a: eintrag.art || 'generic',
      c: eintrag.karte || null,
      z: zustand(engine, pi),
    };
    const opt = kuerzeOptionen(eintrag.optionen);
    if (opt) { zeile.n = opt.n; zeile.o = opt.o; }
    // `gesamt` schlaegt die Laenge der gelieferten Liste. Noetig, weil
    // der Aufrufer bei sehr grossen Angeboten (Crestina: 1405 Karten)
    // nur einen Ausschnitt uebergibt — die WAHRE Angebotsgroesse ist
    // aber die aussagekraeftigere Zahl ("3 aus 1405" vs "3 aus 4").
    if (typeof eintrag.gesamt === 'number') zeile.n = eintrag.gesamt;
    // Ausdrücklich auch dann schreiben, wenn nichts gewählt wurde.
    zeile.w = (eintrag.gewaehlt === undefined) ? null : eintrag.gewaehlt;
    zeile.f = zeile.w != null ? 1 : 0;          // fired: ja/nein
    // ── Verzögerte Bewertung, Teil 1: Stellungswert BEIM Entscheiden ──
    // `_cpuEvaluateState` haengt das CPU-Gehirn an die Engine; ohne
    // Gehirn (Puzzle) bleibt das Feld einfach weg.
    try {
      if (typeof engine._cpuEvaluateState === 'function') {
        const ev = engine._cpuEvaluateState(pi);
        if (Number.isFinite(ev)) { zeile.ev = Math.round(ev); zeile.q = 1; }
      }
    } catch { /* Bewertung ist Beiwerk */ }
    if (eintrag.tags && eintrag.tags.length) zeile.g = eintrag.tags;
    if (eintrag.zusatz) Object.assign(zeile, eintrag.zusatz);
    engine._decisionLog.push(zeile);
    zaehle(engine, 'schrieb');
    return id;
  } catch { return null; }
}

// ── Verzögertes Ergebnis nachtragen ────────────────────────────────
// Für Entscheidungen, deren Erfolg erst später feststeht. Die Engine
// kennt den Ablaufzeitpunkt des Fensters ohnehin; sie muss beim
// Aufräumen nur die passende Zeile nachpflegen.
function nachtragen(engine, id, feld, wert) {
  if (!aktiv(engine) || !id) return;
  try {
    const zeile = engine._decisionLog.find(x => x.i === id);
    if (!zeile) return;
    (zeile.r = zeile.r || {})[feld] = wert;
  } catch { /* egal */ }
}

// ── Verzögerte Bewertung, Teil 2: das Fenster laeuft ab ────────────
//
//  WOFUER DAS DA IST (Als Rueckfrage): manche Entscheidungen zahlen
//  sich nicht sofort aus, sondern erst nach dem Gegenzug. 172 Karten
//  tragen woertlich ein solches Fenster (》until the start of your next
//  turn《 und Verwandte). Omikron ist der Musterfall — die Kopie kommt
//  mit 1 HP und fuer eine Runde negiertem Effekt; ob die Wette aufging,
//  steht erst fest, wenn der Gegner seinen Zug hatte.
//
//  Bewertete man solche Zeilen wie alle anderen, misst man den Zustand
//  UNMITTELBAR nach der Entscheidung — und der ist bei genau diesen
//  Karten strukturell schlecht (1 HP, kein Effekt). Der Lerner wuerde
//  daraus 》nie machen《 lernen, und zwar aus einem Messfehler.
//
//  ABLAUF, vollstaendig generisch, ohne Kartenwissen:
//    1. Beim Entscheiden wird der Stellungswert gestempelt (`ev`) und
//       die Zeile als OFFEN markiert (`q`).
//    2. Beginnt der Entscheider seinen naechsten Zug, traegt
//       `faellig()` die Differenz nach: `r.dEval`.
//    3. Was bis Spielende offen blieb (Entscheidung im letzten Zug),
//       schliesst `ernte()` gegen den Endstand ab, markiert mit
//       `r.end = 1`.
//
//  Damit bekommt JEDE Zeile ein verzoegertes Ergebnis, nicht nur die
//  172 Fenster-Karten — der Trainer entscheidet spaeter, wo er das
//  Sofort- und wo das Spaetsignal gewichtet. Und wieder gilt: nicht
//  nachholbar. Was jetzt nicht gestempelt wird, fehlt allen je
//  gesammelten Spielen.
function faellig(engine) {
  if (!aktiv(engine)) return 0;
  try {
    const gs = engine.gs;
    if (!gs) return 0;
    // Nur beim Entscheider selbst abrechnen: 》sein naechster Zug《.
    // Bewusst ueber `activePlayer` statt ueber Zug-Arithmetik —
    // `gs.turn` zaehlt HALBZUEGE, und uebersprungene Zuege (Guardian
    // Beast Zhu) verschieben die Rechnung sonst still.
    if (gs.activePlayer !== engine._decisionPinned) return 0;
    const jetzt = (typeof engine._cpuEvaluateState === 'function')
      ? engine._cpuEvaluateState(engine._decisionPinned) : null;
    if (!Number.isFinite(jetzt)) return 0;
    let n = 0;
    for (const zeile of engine._decisionLog) {
      if (!zeile.q) continue;
      if ((zeile.z && zeile.z.t) >= (gs.turn || 0)) continue;   // Fenster laeuft noch
      (zeile.r = zeile.r || {}).dEval = Math.round(jetzt - zeile.ev);
      delete zeile.q;
      n++;
    }
    return n;
  } catch { return 0; }
}

// ── Ernte für den Spielsatz ────────────────────────────────────────
function ernte(engine) {
  if (!aktiv(engine)) return [];
  try {
    // Restposten gegen den Endstand abrechnen (Entscheidungen aus dem
    // letzten Zug erleben ihren naechsten Zug nicht mehr).
    const schluss = (typeof engine._cpuEvaluateState === 'function')
      ? engine._cpuEvaluateState(engine._decisionPinned) : null;
    if (Number.isFinite(schluss)) {
      for (const zeile of engine._decisionLog) {
        if (!zeile.q) continue;
        (zeile.r = zeile.r || {}).dEval = Math.round(schluss - zeile.ev);
        zeile.r.end = 1;
        delete zeile.q;
      }
    }
  } catch { /* egal */ }
  try { return engine._decisionLog; } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════
//  INSTRUMENTIERUNG DER ZWEI TRICHTER
// ═══════════════════════════════════════════════════════════════════

function zaehle(engine, feld) {
  try {
    const d = engine._decisionDiag;
    if (d) d[feld] = (d[feld] || 0) + 1;
  } catch { /* egal */ }
}

/** Kompakte Beschreibung eines Ziels — Geometrie, aus Sicht des
 *  entscheidenden Spielers. Die ABSICHT steht nicht hier, sondern in
 *  den rohen Konfigurationsfeldern der Zeile; erst beides zusammen
 *  macht die Zielwahl lernbar (heute trägt `targetPicks` nur die
 *  Geometrie, weshalb Heilen und Angreifen in derselben Tonne landen). */
function zielKurz(t, pi) {
  if (!t || typeof t !== 'object') return null;
  const k = { id: t.id != null ? t.id : null };
  if (t.cardName) k.c = t.cardName;
  if (t.type) k.k = t.type;
  if (t.owner != null) k.s = (t.owner === pi) ? 'own' : 'opp';
  if (t.heroIdx != null) k.h = t.heroIdx;
  if (t.zoneSlot != null) k.zs = t.zoneSlot;
  return k;
}

/** Rohe Absichtsfelder der Zielwahl. Bewusst UNBEWERTET übernommen —
 *  siehe Kopfkommentar: ein Tag-Vokabular ist später ableitbar, ein
 *  nicht erfasstes Feld nicht. */
function absicht(config) {
  const a = {};
  try {
    if (!config) return a;
    if (typeof config.baseDamage === 'number' && config.baseDamage !== 0) a.dmg = config.baseDamage;
    if (config.damageType) a.dt = String(config.damageType);
    if (config.isHealing || config.isHeal) a.heal = 1;
    if (config.isBuff) a.buff = 1;
    if (config.appliesStatus) a.st = String(config.appliesStatus);
    if (config.cancellable === false) a.can = 0; else if (config.cancellable) a.can = 1;
    if (typeof config.maxTargets === 'number') a.mx = config.maxTargets;
    if (typeof config.minTargets === 'number') a.mn = config.minTargets;
  } catch { /* egal */ }
  return a;
}

// Abgeleitet aus der Zaehlung der tatsaechlich vorkommenden Prompt-Typen
// in cards/effects/*.js — nicht geraten. Rein mechanisch: der Typ sagt,
// welche GESTALT die Entscheidung hat, nicht was sie wert ist.
function artAusTyp(typ) {
  switch (typ) {
    case 'confirm': return 'optIn';          // 116x — das "you may"-Tor
    case 'optionPicker': return 'mode';      //  56x — welcher von N Effekten
    case 'cardGallery':                      // 112x
    case 'deckSearchReveal': return 'gallery'; //  31x — eine Karte aus einem Pool
    case 'cardGalleryMulti': return 'set';   //  28x — MENGENwahl (Zi, Lamp, Crestina)
    case 'zonePick': return 'zone';          //  26x
    case 'pickHandCard':                     //  18x
    case 'handPick': return 'hand';          //  13x
    case 'forceDiscardCancellable':          //  13x
    case 'forceDiscard': return 'discard';   //   8x
    case 'statusSelect': return 'status';    //   8x
    case 'cardNamePicker': return 'name';    //   6x
    default: return 'generic:' + (typ || 'unknown');
  }
}

/** Einen einzelnen Antwortwert auf seinen Namen eindampfen. */
function wertKurz(v) {
  if (v == null) return null;
  if (typeof v !== 'object') return String(v);
  return v.name || v.cardName || v.label || v.text || v.id || null;
}

/** Antwort eines generischen Prompts auf einen protokollierbaren Wert
 *  eindampfen. `null`/`undefined` bleibt null = ABGELEHNT.
 *
 *  ★ DIE DREI FALLEN, die hier stecken — alle drei würden die
 *  Grundrate verfälschen, also genau das, wofür der Kanal gebaut ist:
 *
 *  (a) ABBRUCH IST ABLEHNUNG. Die Mengenwahl-Karten antworten mit
 *      `{ cancelled: true }` statt mit null (Magic Lamp ~55, Zi ~230,
 *      Crestina ~146). Ohne diesen Zweig zählte jeder Abbruch als
 *      Zusage und der Lerner sähe nie ein Nein.
 *  (b) ABGELEHNTER CONFIRM kommt als `{confirmed:false}`, zugesagter
 *      als `{confirmed:true}` (CONFIRM_YES aus _cpu.js). Muss sich in
 *      `f` unterscheiden.
 *  (c) MENGENWAHL ANTWORTET ALS LISTE, `{ selectedCards: [Namen] }`.
 *      Ohne eigenen Zweig landete sie im JSON-Notausgang und wäre bei
 *      60 Zeichen abgeschnitten — bei drei Kartennamen regelmäßig
 *      mitten im dritten. */
function antwortKurz(response) {
  if (response == null) return null;
  if (typeof response !== 'object') return response;
  if (response.cancelled === true) return null;                       // (a)
  if (response.confirmed === false) return null;                      // (b)
  if (Array.isArray(response.selectedCards)) {                        // (c)
    const n = response.selectedCards.map(wertKurz).filter(Boolean);
    return n.length ? n.join('|') : null;
  }
  if (Array.isArray(response)) {
    const n = response.map(wertKurz).filter(Boolean);
    return n.length ? n.join('|') : null;
  }
  if (response.confirmed === true && !response.name && !response.label) return 'yes';
  return wertKurz(response)
    || (() => { try { return JSON.stringify(response).slice(0, 60); } catch { return 'obj'; } })();
}

/**
 * Legt die Aufzeichnung ÜBER das, was gerade an der Engine hängt.
 * Muss nach `installCpuBrain` laufen — der Recorder tut das (server.js
 * ruft erst `installCpuBrain`, dann `attachTrainingRecorder`, und
 * `armLog` ist dessen erste Zeile).
 *
 * Idempotent: mehrfaches Aufrufen legt keine zweite Hülle an, sonst
 * stünde jede Entscheidung doppelt im Protokoll.
 */
function instrumentiere(engine) {
  if (!engine || engine._decisionInstrumented) return;
  if (typeof engine.promptGeneric !== 'function' || typeof engine.promptEffectTarget !== 'function') return;
  engine._decisionInstrumented = true;
  engine._decisionDiag = { gen: 0, tgt: 0, roll: 0, fremd: 0, voll: 0, schrieb: 0 };

  // ── Trichter 1: promptGeneric ────────────────────────────────────
  const origGeneric = engine.promptGeneric.bind(engine);
  const huelleGeneric = async function (playerIdx, promptData) {
    // ACHTUNG, der entscheidende Ausschluss: `_inMctsSim` ist WAHR
    // während der Rollouts der Suche. Das sind hypothetische Züge in
    // Planungskopien, keine gespielten Entscheidungen. Würden sie
    // mitgeschrieben, ersäufte das Protokoll in Simulationen — bei
    // 24 bis 80 Pulls je Zug um Größenordnungen mehr Zeilen als echte
    // Entscheidungen, und der Lerner lernte die Suche statt das Spiel.
    //
    // Der Ausschluss ist NACHGEMESSEN korrekt: `_inMctsSim` steht im
    // Headless-Betrieb NICHT durchgängig. Es wird an allen fünf
    // Rollout-Toren (_cpu.js 11687/12159/12184/12237/13063 und
    // ska-harpyformer.js) mit Sicherung gesetzt und im `finally` auf
    // den Vorwert zurückgestellt. `_fastMode` wäre der falsche Riegel:
    // ein Selbstspiel läuft von Anfang bis Ende in Fast Mode
    // (server.js `room.engine.enterFastMode()` vor `startGame()`),
    // damit würde GAR NICHTS mitgeschrieben.
    //
    // Warum der Ausschluss nicht optional ist: `_decisionLog` steht
    // NICHT in der Allowlist von `snapshot()` — `restore()` macht
    // Zeilen aus einem Rollout also nicht rückgängig. Was hier
    // hineinläuft, bleibt drin.
    if (engine._inMctsSim) { zaehle(engine, 'roll'); return origGeneric(playerIdx, promptData); }
    zaehle(engine, 'gen');
    // Angebot VOR dem Aufruf festhalten: die Trichter filtern ihre
    // Listen unterwegs teilweise in place.
    let angebot = null, karte = null, art = 'generic', gesamt = null, fuer = null;
    try {
      const sc = promptData && promptData.showCard;
      // `menuSource` steht ausdruecklich auf den Mengenwahl-Prompts und
      // ist der verlaesslichste Kartenschluessel; danach das
      // Auto-Bild aus `_promptCardStack`, erst zuletzt der Titel (der
      // auch mal ein Effekttext ist).
      karte = (promptData && promptData.menuSource)
        || (sc && (sc.name || sc.cardName)) || (typeof sc === 'string' ? sc : null)
        || (promptData && (promptData.title || promptData.source)) || null;
      art = artAusTyp(promptData && promptData.type);
      const roh = promptData && (promptData.options || promptData.cards || promptData.zones);
      if (Array.isArray(roh)) { gesamt = roh.length; angebot = roh.slice(0, MAX_OPTIONEN); }
    } catch { /* egal */ }
    const response = await origGeneric(playerIdx, promptData);
    // ── Gerrymander: wer entscheidet, und FUER WEN? ─────────────────
    // ERST NACH dem Aufruf lesen. `_tryGerrymanderRedirect` stempelt
    // `_gerryRedirectedTo` auf das Original, aber die Umleitung
    // passiert INNERHALB des Gehirns — vorher steht die Marke noch
    // nicht da. (Genau das war mein erster Anlauf, und die Zeile fiel
    // still durch den Spieler-Filter.) Ohne die Zurechnung schriebe die
    // Huelle die Zeile dem GEFRAGTEN Spieler zu, obwohl ein anderer
    // geantwortet hat.
    try {
      const umgeleitetAn = promptData && promptData._gerryRedirectedTo;
      if (umgeleitetAn != null && umgeleitetAn !== playerIdx) {
        fuer = playerIdx; playerIdx = umgeleitetAn;
      }
    } catch { /* egal */ }
    try {
      notiere(engine, playerIdx, {
        art, karte,
        optionen: angebot,
        gesamt,
        // null = abgelehnt. Bei cancellable Confirms ist das der
        // Normalfall und genau die Information, die bisher fehlte.
        gewaehlt: antwortKurz(response),
        zusatz: {
          ...absicht(promptData),
          // Groesse der gewaehlten Menge — trennt "2 von 3" (Magic Lamp)
          // von "3 aus 1405" (Crestina), ohne dass der Trainer den
          // String zerlegen muss.
          ...(response && Array.isArray(response.selectedCards)
            ? { sel: response.selectedCards.length } : {}),
          // Zeile stammt aus einer Gerrymander-Umleitung: wir haben FUER
          // Spieler `fuer` entschieden. Der Trainer muss diese Zeilen
          // getrennt halten — die Absicht ist invertiert.
          ...(fuer != null ? { gerry: fuer } : {}),
        },
      });
    } catch { /* Aufzeichnung darf nie eine Partie stören */ }
    return response;
  };
  engine.promptGeneric = huelleGeneric;

  // ── Trichter 2: promptEffectTarget ───────────────────────────────
  // Deckt zugleich promptDamageTarget, promptMultiTarget und
  // ctx.promptTarget ab — die bauen nur Ziellisten und delegieren
  // hierher.
  const origTarget = engine.promptEffectTarget.bind(engine);
  const huelleTarget = async function (playerIdx, validTargets, config = {}) {
    if (engine._inMctsSim) { zaehle(engine, 'roll'); return origTarget(playerIdx, validTargets, config); }
    zaehle(engine, 'tgt');
    let angebot = null, karte = null;
    try {
      karte = (config && (config.previewCardName || config.source || config.title)) || null;
      angebot = Array.isArray(validTargets)
        ? validTargets.slice(0, MAX_OPTIONEN).map(t => zielKurz(t, playerIdx))
        : null;
    } catch { /* egal */ }
    const gewaehlt = await origTarget(playerIdx, validTargets, config);
    try {
      const ids = Array.isArray(gewaehlt) ? gewaehlt.filter(x => x != null) : [];
      const idSatz = new Set(ids.map(String));
      const gewaehlteZiele = Array.isArray(angebot)
        ? angebot.filter(k => k && idSatz.has(String(k.id)))
        : [];
      notiere(engine, playerIdx, {
        art: 'target',
        karte,
        // Angebot als KOMPAKTE Ziele, nicht als Namen — die Geometrie
        // ist bei der Zielwahl die halbe Information.
        optionen: null,
        gewaehlt: ids.length ? ids.join('|') : null,
        zusatz: {
          n: Array.isArray(validTargets) ? validTargets.length : 0,
          zl: angebot,                 // Angebot (Geometrie)
          wz: gewaehlteZiele,          // Gewähltes (Geometrie)
          ...absicht(config),
        },
      });
    } catch { /* egal */ }
    return gewaehlt;
  };
  engine.promptEffectTarget = huelleTarget;

  // Für die Selbstdiagnose merken, WAS wir installiert haben.
  engine._decisionHuellen = { gen: huelleGeneric, tgt: huelleTarget };
}

/**
 * Selbstdiagnose. Der Recorder legt sie neben `decisions` in den
 * Spielsatz — damit erklärt sich ein leeres Protokoll von selbst:
 *
 *   gen/tgt = 0            → die Trichter wurden nie durchlaufen
 *                            (oder unsere Hülle wurde überschrieben)
 *   gen/tgt > 0, schrieb 0 → der Filter wirft alles weg (fremd = die
 *                            Zeilen gehörten dem Gegner)
 *   wrapper != 'ok'        → jemand hat NACH uns `promptGeneric` bzw.
 *                            `promptEffectTarget` ersetzt. Genau die
 *                            Konstellation, die v589 gekostet hat.
 */
function diagnose(engine) {
  try {
    if (!engine || !engine._decisionDiag) return { wrapper: 'nie-installiert' };
    const h = engine._decisionHuellen || {};
    const ok = engine.promptGeneric === h.gen && engine.promptEffectTarget === h.tgt;
    return { ...engine._decisionDiag, wrapper: ok ? 'ok' : 'ueberschrieben' };
  } catch { return { wrapper: 'fehler' }; }
}

module.exports = {
  armLog, notiere, nachtragen, faellig, ernte, zustand, instrumentiere, diagnose,
  MAX_ZEILEN, MAX_OPTIONEN,
};
