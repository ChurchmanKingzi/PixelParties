'use strict';
// ═══════════════════════════════════════════════════════════════════
//  ENTSCHEIDUNGS-PROTOKOLL (v589)
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
//  Alle Entscheidungen des Spiels laufen durch wenige Trichter in
//  _engine.js (promptGeneric mit 476 Aufrufstellen, dazu
//  promptEffectTarget, promptDamageTarget, promptMultiTarget).
//  Instrumentiert werden die Trichter, nicht die 912 Kartenskripte —
//  jede künftige Karte ist damit automatisch erfasst.
//
//  Eine Zeile hält fest: Karte, Art der Entscheidung, angebotene
//  Optionen, Gewähltes (null = abgelehnt) und den Spielzustand.
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
//  `engine._decisionLog` nicht und die Hooks kehren sofort zurück.
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
    if (gs.currentPhase) z.ph = String(gs.currentPhase);

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
      if (Array.isArray(ps.discardPile)) z.dp = ps.discardPile.length;
      if (typeof ps.gold === 'number') z.g = ps.gold;
    }
    if (os) {
      if (Array.isArray(os.hand)) z.oh = os.hand.length;
      if (Array.isArray(os.deck)) z.od = os.deck.length;
      if (typeof os.gold === 'number') z.og = os.gold;
    }
  } catch { /* Zustand ist Beiwerk — eine Partie stirbt daran nicht */ }
  return z;
}

// ── Puffer anlegen ─────────────────────────────────────────────────
// Ruft der Recorder. Ohne diesen Aufruf bleibt alles Weitere ein
// No-op, das Modul kostet im Live-Betrieb also nichts.
function armLog(engine, pinnedIdx) {
  try {
    engine._decisionLog = [];
    engine._decisionPinned = pinnedIdx;
    engine._decisionSeq = 0;
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
//  eintrag: { art, karte, optionen, gewaehlt, tags }
//    art      — Bedeutungs-Tag des Trichters ('optIn', 'effectTarget',
//               'damageTarget', 'zone', 'gallery', 'multiTarget', 'generic')
//    karte    — auslösende Karte; bei promptGeneric injiziert die Engine
//               sie über _promptCardStack als promptData.showCard
//    gewaehlt — null bedeutet ABGELEHNT. Das ist der Kern des Ganzen:
//               ohne die Nullen gibt es keine Grundrate, der Lerner
//               sähe nur Einsen.
//  Rückgabe: laufende Nummer für spätere Nachträge, oder null.
function notiere(engine, pi, eintrag) {
  if (!aktiv(engine)) return null;
  try {
    // Nur der gepinnte Spieler wird gelernt — die Gegnerseite würde
    // fremde Politik in dieselben Regeln mischen.
    if (engine._decisionPinned != null && pi !== engine._decisionPinned) return null;
    if (engine._decisionLog.length >= MAX_ZEILEN) return null;

    const id = ++engine._decisionSeq;
    const zeile = {
      i: id,
      a: eintrag.art || 'generic',
      c: eintrag.karte || null,
      z: zustand(engine, pi),
    };
    const opt = kuerzeOptionen(eintrag.optionen);
    if (opt) { zeile.n = opt.n; zeile.o = opt.o; }
    // Ausdrücklich auch dann schreiben, wenn nichts gewählt wurde.
    zeile.w = (eintrag.gewaehlt === undefined) ? null : eintrag.gewaehlt;
    zeile.f = zeile.w != null ? 1 : 0;          // fired: ja/nein
    if (eintrag.tags && eintrag.tags.length) zeile.g = eintrag.tags;
    engine._decisionLog.push(zeile);
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

// ── Ernte für den Spielsatz ────────────────────────────────────────
function ernte(engine) {
  if (!aktiv(engine)) return [];
  try { return engine._decisionLog; } catch { return []; }
}

module.exports = { armLog, notiere, nachtragen, ernte, zustand, MAX_ZEILEN };
