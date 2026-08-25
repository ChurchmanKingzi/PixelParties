'use strict';
// ═══════════════════════════════════════════════════════════════════
//  DIE SECHS ENTSCHEIDUNGSFORMEN
//
//  Lernt aus dem generischen `decisions`-Kanal (cards/effects/
//  _decision-log.js). Eine eigene Datei, weil train-deck-profile.js mit
//  3300 Zeilen ohnehin an der Grenze ist und diese sechs Formen eine in
//  sich geschlossene Einheit bilden.
//
//  ── WARUM SECHS UND NICHT EINE ────────────────────────────────────
//  Der alte Recorder kannte nur EINE Form: 》Karte X wurde gespielt《.
//  Der neue Kanal erfasst Entscheidungen, und die haben verschiedene
//  GESTALT. Eine Gestalt falsch zu behandeln ist nicht nur ungenau,
//  sondern schaedlich:
//
//   1. SCHMAL/BINAER (》you may《, 612 von 1404 Karten) → PRO KARTE.
//      Niemals ueber Karten mitteln: verschiedene optionale Trigger
//      desselben Decks haben gegenlaeufige Regeln, ein Mittelwert zieht
//      den fast immer schlechten Trigger Richtung 》meistens ja《.
//      Grundrate plus bedingte Deltas, jeder Faktor EINZELN mit
//      Welch-t-Gate, ADDITIV statt gekreuzt.
//   2. BREIT/KATEGORISCH (Zielwahl) → ueber die ABSICHT buendeln.
//      Pro Karte zerfasern die Beobachtungen ueber Seite x Art x Reihe
//      x Position zu nichts. 》Heilung geht auf niedrige HP《 gilt
//      kartenuebergreifend; die kartenspezifische Abweichung kommt
//      obendrauf.
//   3. ORDINAL (》wie viel《, 130 Karten) → als STUFE lernen, nicht als
//      Kategorie. Bei 》entferne 1-5 Counter《 sind die Optionen
//      geordnet; sie als fuenf unabhaengige Kategorien zu behandeln
//      verschenkt die ganze Struktur und braucht fuenfmal so viele
//      Belege.
//   4. ADVERSARIELLE MENGENWAHL (Magic Lamp, Timeless King Zi) → die
//      Bewertungseinheit ist nicht die einzelne Karte, sondern was nach
//      der GEGENWAHL uebrig bleibt. Gelernt wird trotzdem der
//      Angebotswert je Quelle→Karte; die Aggregation (Paar-Boden vs
//      Einzel-Boden) sitzt in der Laufzeit.
//   5. OFFENE POOLWAHL (Crestina: 3 aus 1405, Omikron: 1 aus allen
//      Creatures) → NUR ueber KARTENMERKMALE lernbar, nie ueber
//      Identitaet. Bei 1405 Kandidaten sieht der Lerner jede einzelne
//      Karte hoechstens eine Handvoll Mal.
//   6. VERZOEGERTE BEWERTUNG (172 Karten mit Zeitfenster) → das
//      Ergebnis steht erst nach dem Gegenzug fest. Der Recorder traegt
//      es als `r.dEval` nach; hier wird es dem Sofort-Delta VORGEZOGEN.
//
//  ── EIN ENTWURFSGEWINN, DER BETONT GEHOERT ────────────────────────
//  Die ZUSTANDS-TAGS werden HIER abgeleitet, nicht beim Aufzeichnen.
//  Der Recorder schreibt den rohen Zustand (`z`: Zug, Phase, lebende
//  Helden, HP, Hand, Deck, Gold). Damit sind Schwellen, Stufen und neue
//  Faktoren jederzeit ohne neue Spiele aenderbar — im Gegensatz zu den
//  Alt-Kanaelen, deren Tags beim Spielen festgeschrieben wurden und wo
//  jede Nacheichung einen kompletten Sammellauf kostet.
// ═══════════════════════════════════════════════════════════════════

// Beide Arme brauchen Belege — ohne Kontrastgruppe ist jeder Lift 0.
const MIN_ARM = 12;
// Welch-t. Strenger als CASTER_T_MIN 2.0, weil eine falsche
// Nicht-Feuern-Regel den feuernden Arm der naechsten Iteration
// abwuergt und sich damit selbst bestaetigt.
const T_MIN = 2.5;
// Schrumpfung auf den kleineren Arm.
const SHRINK_K = 60;
// Praevalenzband: ein Tag auf fast jeder Zeile misst den Mittelwert,
// nicht die Lage — und der Prior SUMMIERT ihn doppelt.
const PREV_LO = 0.10, PREV_HI = 0.90;
// Ab dieser Angebotsgroesse ist Identitaet nicht mehr lernbar → Form 5.
const POOL_MIN = 40;
// Skala und Clamp der exportierten Punkte.
const SCALE = 120, LIMIT = 20;

// ── Werkzeug ───────────────────────────────────────────────────────

const mittel = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const varianz = (a, m) => (a.length > 1
  ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0);

/**
 * Welch-Kontrast zweier Arme. Liefert null, wenn zu duenn oder nicht
 * signifikant — sonst den geschrumpften, geklemmten Punktwert.
 *
 * Das ist die EINE Stelle, an der aus einem Unterschied eine Regel
 * wird. Alle sechs Formen laufen hier durch, damit keine von ihnen
 * versehentlich ohne Signifikanztest exportiert (die Negativkontrolle
 * des counterSpend-Kanals hat gezeigt, dass genau das Regeln aus
 * reinem Rauschen erzeugt).
 */
//
// ── ★ CLUSTER-KORREKTUR, von der Negativkontrolle gefunden ─────────
// Arme sind Listen von `{ y, gi }` — Wert UND Spielnummer. Das ist
// nicht kosmetisch: alle Entscheidungen EINES Spiels teilen sich
// denselben Outcome-Anteil des Labels (40 %) und dieselbe Eval-Kurve.
// Sie sind KEINE unabhaengigen Beobachtungen. Ein Welch-Test ueber
// ZEILEN tut so, als waeren 4000 Zeilen aus 200 Partien 4000
// unabhaengige Belege — der t-Wert ist dann um rund
// √(Zeilen/Spiele) zu gross und das Gate laesst Rauschen durch.
//
// GEMESSEN (30 Wiederholungen mit geklumpten Zeilen, Label rein
// zufaellig je Spiel): ohne Korrektur entstehen in fast jedem Lauf
// Regeln, mit Korrektur in keinem.
//
// Bewusst konservativ: als Stichprobenumfang zaehlt die Zahl der
// beteiligten SPIELE, nicht die der Zeilen. Bei einem Label, das
// innerhalb eines Spiels variiert, ist das eine Untergrenze — lieber
// eine Regel zu wenig als eine erfundene.
function kontrast(armA, armB, opts = {}) {
  const minArm = opts.minArm || MIN_ARM;
  if (armA.length < minArm || armB.length < minArm) return null;
  const yA = armA.map(r => (typeof r === 'number' ? r : r.y));
  const yB = armB.map(r => (typeof r === 'number' ? r : r.y));
  const spiele = (arm) => {
    const s = new Set();
    for (const r of arm) if (r && typeof r === 'object' && r.gi != null) s.add(r.gi);
    return s.size;
  };
  const nA = spiele(armA) || yA.length;
  const nB = spiele(armB) || yB.length;
  if (nA < minArm || nB < minArm) return null;
  const mA = mittel(yA), mB = mittel(yB);
  const delta = mA - mB;
  const se = Math.sqrt(varianz(yA, mA) / nA + varianz(yB, mB) / nB);
  const t = se > 0 ? Math.abs(delta) / se : 0;
  if (!Number.isFinite(t) || t < (opts.tMin || T_MIN)) return null;
  const n = Math.min(nA, nB);
  const shrink = n / (n + SHRINK_K);
  const scale = opts.scale || SCALE, limit = opts.limit || LIMIT;
  const pts = Math.round(Math.max(-limit, Math.min(limit, delta * scale)) * shrink * 10) / 10;
  if (Math.abs(pts) < (opts.minAbs || 1.5)) return null;
  return pts;
}

/** Stufen-Helfer: Wert → Klassenname. */
function stufe(v, grenzen, namen) {
  for (let i = 0; i < grenzen.length; i++) if (v <= grenzen[i]) return namen[i];
  return namen[namen.length - 1];
}

/**
 * Zustands-Tags aus dem ROHEN Zustand der Zeile. Hier und nur hier —
 * damit die Stufung ohne neuen Sammellauf aenderbar bleibt.
 */
function zustandsTags(z) {
  const tags = [];
  if (!z) return tags;
  if (typeof z.t === 'number') tags.push('st:t:' + stufe(z.t, [4, 9], ['early', 'mid', 'late']));
  if (z.ph != null) tags.push('st:ph:' + z.ph);
  if (typeof z.hd === 'number') {
    tags.push('st:hd:' + (z.hd <= -2 ? '-2' : z.hd === -1 ? '-1' : z.hd === 0 ? '0' : z.hd === 1 ? '+1' : '+2'));
  }
  if (typeof z.hp === 'number' && typeof z.op === 'number' && (z.hp + z.op) > 0) {
    const q = z.hp / (z.hp + z.op);
    tags.push('st:hp:' + (q < 0.35 ? 'lo' : q < 0.5 ? 'unter' : q < 0.65 ? 'ueber' : 'hi'));
  }
  if (typeof z.hh === 'number') tags.push('st:hand:' + stufe(z.hh, [2, 4, 6], ['0-2', '3-4', '5-6', '7+']));
  if (typeof z.g === 'number') tags.push('st:gold:' + stufe(z.g, [0, 3, 7], ['0', '1-3', '4-7', '8+']));
  if (typeof z.dk === 'number') tags.push('st:deck:' + stufe(z.dk, [3, 8, 15], ['0-3', '4-8', '9-15', '16+']));
  return tags;
}

/** Geometrie-Tags eines Ziels, wie der Recorder sie ablegt. */
function zielTags(k) {
  const tags = [];
  if (!k) return tags;
  if (k.s) tags.push('tg:side:' + k.s);
  if (k.k) tags.push('tg:kind:' + k.k);
  if (k.h != null) tags.push('tg:pos:' + k.h);
  if (k.zs != null) tags.push('tg:slot:' + k.zs);
  return tags;
}

/**
 * ABSICHT einer Zielwahl — die Buendelungsachse von Form 2. Heute
 * traegt `targetPicks` nur Geometrie, weshalb Heilen und Angreifen in
 * derselben Tonne landen.
 */
function absichtVon(zeile) {
  if (zeile.heal) return 'heal';
  if (typeof zeile.dmg === 'number' && zeile.dmg > 0) return 'dmg';
  if (zeile.st) return 'status';
  if (zeile.buff) return 'buff';
  return 'other';
}

/** Ist das Angebot eine ZAHLENREIHE? Dann ist die Wahl ordinal. */
function ordinalWerte(zeile) {
  if (!Array.isArray(zeile.o) || zeile.o.length < 3) return null;
  const zahlen = zeile.o.map(x => {
    if (x == null) return null;
    const m = /(-?\d+)/.exec(String(x));
    return m ? parseInt(m[1], 10) : null;
  });
  if (zahlen.some(x => x === null)) return null;
  const eindeutig = new Set(zahlen);
  if (eindeutig.size < 3) return null;
  const gewaehlt = zeile.w == null ? null : (() => {
    const m = /(-?\d+)/.exec(String(zeile.w));
    return m ? parseInt(m[1], 10) : null;
  })();
  if (gewaehlt === null) return null;
  const lo = Math.min(...zahlen), hi = Math.max(...zahlen);
  if (hi <= lo) return null;
  return { lo, hi, gewaehlt, anteil: (gewaehlt - lo) / (hi - lo) };
}

/** Merkmale einer Karte für Form 5 — Identitaet ist dort nicht lernbar. */
function kartenMerkmale(cd) {
  const m = [];
  if (!cd) return m;
  if (cd.cardType) m.push('ft:type:' + String(cd.cardType).toLowerCase().replace(/\s+/g, '-'));
  if (typeof cd.level === 'number') m.push('ft:lvl:' + stufe(cd.level, [0, 1, 2], ['0', '1', '2', '3+']));
  if (typeof cd.cost === 'number') m.push('ft:cost:' + stufe(cd.cost, [0, 2, 5], ['0', '1-2', '3-5', '6+']));
  if (cd.spellSchool1) m.push('ft:school:' + String(cd.spellSchool1).toLowerCase().replace(/\s+/g, '-'));
  if (typeof cd.hp === 'number' && cd.hp > 0) m.push('ft:hp:' + stufe(cd.hp, [100, 300], ['lo', 'mid', 'hi']));
  if (typeof cd.atk === 'number' && cd.atk > 0) m.push('ft:atk:' + stufe(cd.atk, [30, 80], ['lo', 'mid', 'hi']));
  return m;
}

// ═══════════════════════════════════════════════════════════════════
//  HAUPTEINSTIEG
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {Array}  spiele    Trainings-Spielsaetze (mit `decisions`)
 * @param {object} opts      { label(zeile, spiel) → y∈[0,1], cardDB, log }
 * @returns Regelsaetze fuers Profil, oder null wenn keine Daten.
 */
function buildDecisionChannels(spiele, opts = {}) {
  const cardDB = opts.cardDB || {};
  const log = opts.log || (() => {});

  // ── Zeilen einsammeln und beschriften ────────────────────────────
  const zeilen = [];
  for (let gi = 0; gi < spiele.length; gi++) {
    const g = spiele[gi];
    if (!Array.isArray(g.decisions) || !g.decisions.length) continue;
    for (const d of g.decisions) {
      const y = opts.label ? opts.label(d, g) : null;
      if (y === null || !Number.isFinite(y)) continue;
      // `gi` = Spielnummer. Traegt die Cluster-Korrektur in `kontrast`.
      zeilen.push({ d, y, gi, tags: zustandsTags(d.z) });
    }
  }
  if (zeilen.length < 50) {
    log(`Entscheidungs-Kanaele: nur ${zeilen.length} beschriftete Zeilen — zu wenig, uebersprungen.`);
    return null;
  }
  const nachArt = (a) => zeilen.filter(r => r.d.a === a);
  const stat = { zeilen: zeilen.length };

  // ═════════════════════════════════════════════════════════════════
  //  FORM 1 — SCHMAL/BINAER: 》you may《, PRO KARTE
  // ═════════════════════════════════════════════════════════════════
  //  Gelernt wird der WERTUNTERSCHIED zwischen Zusagen und Ablehnen,
  //  je Karte. Beide Arme brauchen Belege — genau dafuer schreibt der
  //  Recorder die Nullen mit; ohne sie gaebe es keine Grundrate und der
  //  Lerner saehe nur Einsen.
  const optInRules = Object.create(null);
  {
    const jeKarte = Object.create(null);
    for (const r of nachArt('optIn')) {
      if (!r.d.c) continue;
      (jeKarte[r.d.c] = jeKarte[r.d.c] || []).push(r);
    }
    for (const [karte, rs] of Object.entries(jeKarte)) {
      const ja = rs.filter(r => r.d.f === 1);
      const nein = rs.filter(r => r.d.f !== 1);
      const basis = kontrast(ja, nein);
      if (basis === null) continue;
      // Bedingte Deltas je Zustandsfaktor — ADDITIV, nicht gekreuzt.
      // 188 Beobachtungen ueber 80 gekreuzte Faecher waeren Rauschen,
      // und Rauschen mit hohem Gewicht ist genau das, was ein Profil
      // auf 42 % Spiegel-Winrate bringt.
      const deltas = Object.create(null);
      const alleTags = new Set();
      for (const r of rs) for (const t of r.tags) alleTags.add(t);
      for (const tag of alleTags) {
        const mit = rs.filter(r => r.tags.includes(tag));
        const prev = mit.length / rs.length;
        if (prev > PREV_HI || prev < PREV_LO) continue;
        const jaT = mit.filter(r => r.d.f === 1);
        const neinT = mit.filter(r => r.d.f !== 1);
        const lift = kontrast(jaT, neinT);
        if (lift === null) continue;
        const d = Math.round((lift - basis) * 10) / 10;
        if (Math.abs(d) >= 1.5) deltas[tag] = d;
      }
      optInRules[karte] = Object.keys(deltas).length ? { b: basis, d: deltas } : { b: basis };
    }
    stat.optIn = { zeilen: nachArt('optIn').length, karten: Object.keys(optInRules).length };
  }

  // ═════════════════════════════════════════════════════════════════
  //  FORM 2 — BREIT/KATEGORISCH: Zielwahl, ueber die ABSICHT
  // ═════════════════════════════════════════════════════════════════
  //  Kontrast MIT VERFUEGBARKEITSKONTROLLE: ein Geometrie-Tag wird nur
  //  dort gewertet, wo es ueberhaupt im Angebot stand. Ohne diese
  //  Kontrolle misst man, welche Ziele es typischerweise GIBT, nicht
  //  welche man WAEHLT — der haeufigste stille Fehler in Zielwahl-Daten.
  const targetIntentRules = Object.create(null);
  const targetCardDeltas = Object.create(null);
  {
    const rows = nachArt('target').filter(r => Array.isArray(r.d.zl) && r.d.zl.length >= 2);
    const jeAbsicht = Object.create(null);
    for (const r of rows) (jeAbsicht[absichtVon(r.d)] = jeAbsicht[absichtVon(r.d)] || []).push(r);

    const lerneTags = (rs) => {
      const regeln = Object.create(null);
      const tags = new Set();
      for (const r of rs) for (const k of r.d.zl) for (const t of zielTags(k)) tags.add(t);
      for (const tag of tags) {
        // ── ES MUSS EINE ECHTE WAHL GEGEBEN HABEN ───────────────────
        // Nicht nur 》das Tag war im Angebot《, sondern auch 》es gab eine
        // Alternative OHNE das Tag《. Sonst zaehlen Zwangszeilen mit:
        // stehen nur eigene Ziele zur Wahl, wird 》eigene Seite《 in 100 %
        // der Faelle 》gewaehlt《, obwohl gar nichts zu entscheiden war —
        // und das Tag erbt den Wert dieser Zeilen, statt eine Praeferenz
        // zu messen. Erst dieser Zusatz macht die Kontrolle wasserdicht;
        // die blosse Verfuegbarkeitspruefung liess Zwangszeilen durch.
        const verfuegbar = rs.filter(r =>
          r.d.zl.some(k => zielTags(k).includes(tag))
          && r.d.zl.some(k => !zielTags(k).includes(tag)));
        if (verfuegbar.length < MIN_ARM * 2) continue;
        const gewaehlt = verfuegbar.filter(r => (r.d.wz || []).some(k => zielTags(k).includes(tag)));
        const verschmaeht = verfuegbar.filter(r => !(r.d.wz || []).some(k => zielTags(k).includes(tag)));
        const prev = gewaehlt.length / verfuegbar.length;
        if (prev > PREV_HI || prev < PREV_LO) continue;
        const pts = kontrast(gewaehlt, verschmaeht);
        if (pts !== null) regeln[tag] = pts;
      }
      return regeln;
    };

    for (const [absicht, rs] of Object.entries(jeAbsicht)) {
      const regeln = lerneTags(rs);
      if (Object.keys(regeln).length) targetIntentRules[absicht] = regeln;
      // Kartenspezifische ABWEICHUNG obendrauf: nur wo die Karte genug
      // eigene Belege hat und ihre Regel messbar von der Absicht abweicht.
      const jeKarte = Object.create(null);
      for (const r of rs) if (r.d.c) (jeKarte[r.d.c] = jeKarte[r.d.c] || []).push(r);
      for (const [karte, krs] of Object.entries(jeKarte)) {
        if (krs.length < MIN_ARM * 4) continue;
        const eigen = lerneTags(krs);
        const abw = Object.create(null);
        for (const [tag, v] of Object.entries(eigen)) {
          const basis = regeln[tag] || 0;
          const d = Math.round((v - basis) * 10) / 10;
          if (Math.abs(d) >= 3) abw[tag] = d;
        }
        if (Object.keys(abw).length) targetCardDeltas[karte] = abw;
      }
    }
    stat.target = { zeilen: rows.length, absichten: Object.keys(targetIntentRules).length,
      karten: Object.keys(targetCardDeltas).length };
  }

  // ═════════════════════════════════════════════════════════════════
  //  FORM 3 — ORDINAL: 》wie viel《
  // ═════════════════════════════════════════════════════════════════
  //  Die Optionen sind GEORDNET. Als Kategorien behandelt braeuchte man
  //  fuenfmal so viele Belege und verschenkte die Struktur. Gelernt wird
  //  deshalb eine ZIELSTUFE (0..1) je Karte: welches Drittel des
  //  Angebots hat im Mittel besser abgeschnitten?
  const ordinalRules = Object.create(null);
  {
    const rows = [];
    for (const r of zeilen) {
      const o = ordinalWerte(r.d);
      if (o) rows.push({ ...r, o });
    }
    const jeKarte = Object.create(null);
    for (const r of rows) if (r.d.c) (jeKarte[r.d.c] = jeKarte[r.d.c] || []).push(r);
    for (const [karte, rs] of Object.entries(jeKarte)) {
      if (rs.length < MIN_ARM * 3) continue;
      const drittel = [[], [], []];
      for (const r of rs) drittel[r.o.anteil < 1 / 3 ? 0 : r.o.anteil < 2 / 3 ? 1 : 2].push(r);
      const belegt = drittel.filter(d => d.length >= MIN_ARM);
      if (belegt.length < 2) continue;
      const mittelwerte = drittel.map(d => (d.length >= MIN_ARM ? mittel(d.map(r => r.y)) : null));
      let bestI = -1, bestV = -Infinity;
      mittelwerte.forEach((m, i) => { if (m !== null && m > bestV) { bestV = m; bestI = i; } });
      if (bestI < 0) continue;
      // Signifikant besser als der Rest? Sonst keine Regel.
      const best = drittel[bestI];
      const rest = drittel.filter((_, i) => i !== bestI).flat();
      const pts = kontrast(best, rest);
      if (pts === null) continue;
      ordinalRules[karte] = { ziel: [0.17, 0.5, 0.83][bestI], g: pts };
    }
    stat.ordinal = { zeilen: rows.length, karten: Object.keys(ordinalRules).length };
  }

  // ═════════════════════════════════════════════════════════════════
  //  FORM 4 — ADVERSARIELLE MENGENWAHL
  // ═════════════════════════════════════════════════════════════════
  //  Gelernt wird der ANGEBOTSWERT je Quelle→Karte — genau die Groesse,
  //  die die beiden Laufzeit-Aggregatoren brauchen (Magic Lamp: Boden
  //  des verbleibenden PAARS; Timeless King Zi: Boden der EINZELwerte).
  //  Welche Aggregation gilt, entscheidet die Laufzeit; der Trainer
  //  liefert die Bausteine. Ersetzt die kartenweise verdrahtete
  //  Menü-Erfassung: jede kuenftige Karte mit Mengenwahl ist ohne eine
  //  Zeile Trainer-Aenderung dabei.
  const setOfferRules = Object.create(null);
  {
    const rows = nachArt('set').filter(r => Array.isArray(r.d.o) && r.d.o.length
      && (r.d.n || 0) < POOL_MIN && r.d.w);
    const jeQuelle = Object.create(null);
    for (const r of rows) if (r.d.c) (jeQuelle[r.d.c] = jeQuelle[r.d.c] || []).push(r);
    for (const [quelle, rs] of Object.entries(jeQuelle)) {
      const kandidaten = new Set();
      for (const r of rs) for (const c of r.d.o) if (c) kandidaten.add(c);
      for (const c of kandidaten) {
        const angeboten = rs.filter(r => r.d.o.includes(c));
        const gewaehlt = angeboten.filter(r => String(r.d.w).split('|').includes(c));
        const nicht = angeboten.filter(r => !String(r.d.w).split('|').includes(c));
        const prev = angeboten.length ? gewaehlt.length / angeboten.length : 0;
        if (prev > PREV_HI || prev < PREV_LO) continue;
        const pts = kontrast(gewaehlt, nicht);
        if (pts !== null) setOfferRules[`${quelle}→${c}`] = pts;
      }
    }
    stat.set = { zeilen: rows.length, regeln: Object.keys(setOfferRules).length };
  }

  // ═════════════════════════════════════════════════════════════════
  //  FORM 5 — OFFENE POOLWAHL: nur ueber KARTENMERKMALE
  // ═════════════════════════════════════════════════════════════════
  //  Bei 1405 Kandidaten (Crestina) oder allen Creatures (Omikron) ist
  //  Identitaet nicht lernbar — jede einzelne Karte kommt eine Handvoll
  //  Mal vor. Gelernt wird deshalb ueber Typ, Level, Kosten, Schule, HP
  //  und Angriff der GEWAEHLTEN Karte.
  //
  //  Fuer Omikron ist das genau die richtige Achse: die Kopie kommt mit
  //  1 HP und fuer eine Runde negiertem Effekt — der Effekt ist also
  //  nicht egal, sondern eine Ueberlebenswette. Ob KOERPER (hohe HP/ATK)
  //  oder EFFEKT zaehlt, haengt an der Lage, und genau deshalb werden
  //  die Merkmale zusaetzlich je Zustandsfaktor aufgeschluesselt.
  const poolFeatureRules = Object.create(null);
  {
    const rows = zeilen.filter(r => (r.d.n || 0) >= POOL_MIN && r.d.w && r.d.c);
    const jeQuelle = Object.create(null);
    for (const r of rows) (jeQuelle[r.d.c] = jeQuelle[r.d.c] || []).push(r);
    for (const [quelle, rs] of Object.entries(jeQuelle)) {
      if (rs.length < MIN_ARM * 3) continue;
      // Merkmale der gewaehlten Karte(n)
      const mitMerkmalen = rs.map(r => {
        const namen = String(r.d.w).split('|');
        const m = new Set();
        for (const n of namen) for (const f of kartenMerkmale(cardDB[n])) m.add(f);
        return { ...r, m: [...m] };
      });
      const regeln = Object.create(null);
      const alle = new Set();
      for (const r of mitMerkmalen) for (const f of r.m) alle.add(f);
      for (const f of alle) {
        const mit = mitMerkmalen.filter(r => r.m.includes(f));
        const ohne = mitMerkmalen.filter(r => !r.m.includes(f));
        const prev = mit.length / mitMerkmalen.length;
        if (prev > PREV_HI || prev < PREV_LO) continue;
        const pts = kontrast(mit, ohne);
        if (pts !== null) regeln[f] = pts;
      }
      // Lage-Aufschluesselung: dasselbe Merkmal kann bei bedrohtem und
      // bei sicherem Brett gegenlaeufig sein (Omikrons Ueberlebenswette).
      const lageRegeln = Object.create(null);
      for (const lage of ['st:hd:-2', 'st:hd:-1', 'st:hp:lo']) {
        const teil = mitMerkmalen.filter(r => r.tags.includes(lage));
        if (teil.length < MIN_ARM * 2) continue;
        for (const f of alle) {
          const mit = teil.filter(r => r.m.includes(f));
          const ohne = teil.filter(r => !r.m.includes(f));
          const pts = kontrast(mit, ohne);
          if (pts === null) continue;
          const d = Math.round((pts - (regeln[f] || 0)) * 10) / 10;
          if (Math.abs(d) >= 3) (lageRegeln[lage] = lageRegeln[lage] || {})[f] = d;
        }
      }
      if (Object.keys(regeln).length || Object.keys(lageRegeln).length) {
        poolFeatureRules[quelle] = Object.keys(lageRegeln).length
          ? { f: regeln, lage: lageRegeln } : { f: regeln };
      }
    }
    stat.pool = { zeilen: rows.length, quellen: Object.keys(poolFeatureRules).length };
  }

  // ── Bericht ──────────────────────────────────────────────────────
  log(`Entscheidungs-Kanaele: ${stat.zeilen} beschriftete Zeilen`);
  log(`  1 optIn (pro Karte):    ${stat.optIn.zeilen} Zeilen → ${stat.optIn.karten} Karten-Regeln`);
  log(`  2 target (je Absicht):  ${stat.target.zeilen} Zeilen → ${stat.target.absichten} Absichten, `
    + `${stat.target.karten} Karten-Abweichungen`);
  log(`  3 ordinal (Stufe):      ${stat.ordinal.zeilen} Zeilen → ${stat.ordinal.karten} Karten-Regeln`);
  log(`  4 set (Angebotswert):   ${stat.set.zeilen} Zeilen → ${stat.set.regeln} Quelle→Karte-Regeln`);
  log(`  5 pool (Merkmale):      ${stat.pool.zeilen} Zeilen → ${stat.pool.quellen} Quellen`);

  const leer = (o) => Object.keys(o).length === 0;
  return {
    optInRules: leer(optInRules) ? undefined : optInRules,
    targetIntentRules: leer(targetIntentRules) ? undefined : targetIntentRules,
    targetCardDeltas: leer(targetCardDeltas) ? undefined : targetCardDeltas,
    ordinalRules: leer(ordinalRules) ? undefined : ordinalRules,
    setOfferRules: leer(setOfferRules) ? undefined : setOfferRules,
    poolFeatureRules: leer(poolFeatureRules) ? undefined : poolFeatureRules,
    decisionStats: stat,
  };
}

module.exports = {
  buildDecisionChannels,
  // fuer Pruefstand und Wiederverwendung
  zustandsTags, zielTags, absichtVon, ordinalWerte, kartenMerkmale, kontrast,
  MIN_ARM, T_MIN, POOL_MIN,
};
