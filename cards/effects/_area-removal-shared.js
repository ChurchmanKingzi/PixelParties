'use strict';

const { opponentOfGs } = require('./_opp');
// ═══════════════════════════════════════════════════════════════════
//  AREA-ABRÄUMUNG — GEMEINSAMES VOKABULAR (Lernkanal, Als Auftrag 6.10.)
//
//  „Es gibt Situationen/Karten/ganze Decks, bei denen es sinnvoll ist,
//   EIGENE Areas zu zerstören."
//
//  Drei Gründe nannte der Auftrag, und sie sind der Grund für dieses
//  Modul:
//    (a) die Area hilft dem GEGNER auch / mehr           → `net:*` (gemessen), `fit:*`
//    (b) man will eine ANDERE Area ausspielen             → `hand:none|stuck|ready`, `swap:*`
//    (c) eigene Effekte triggern/skalieren, wenn eigene
//        (Area-)Karten abgeräumt werden                   → `board:<Name>`, `dpa:*`
//  Dazu die IDENTITÄT: Areas, die generell weg sollen (`Name@own` /
//  `Name@opp`) — das Profil gehört einem Deck, dort ist Identität
//  lernbar (anders als bei den offenen Pools).
//
//  ── WARUM EIN GEMEINSAMES MODUL ───────────────────────────────────
//  Die Tags müssen im TRAINER (aus dem rohen Kontext einer
//  aufgezeichneten Entscheidung) und zur LAUFZEIT (aus dem lebenden
//  Spiel) BIT-GLEICH entstehen. Zwei Ableitungen driften auseinander —
//  das ist die Fehlerklasse, die das Projekt an mehreren Lernkanälen
//  schon gekostet hat. Deshalb: ein Modul, zwei Aufrufer.
//
//    rohKontext(engine, pi)                 → was der Recorder mitschreibt
//    areaTags(roh, areaName, seite, cardDB) → die Tags EINER angebotenen Area
//
//  Der Recorder schreibt ROH (Aufzeichnen ist gratis, nicht
//  nachholbar); abgeleitet wird erst hier, damit Schwellen ohne neuen
//  Sammellauf änderbar bleiben.
//
//  ── GEMESSEN STATT GESCHÄTZT (Als Auftrag 6.10., 2. Runde) ─────────
//  „Die aktuellen Approximationen reichen nicht."  Zwei Größen werden
//  deshalb nicht mehr aus Karteneigenschaften erraten, sondern mit der
//  Rollout-Suche der CPU GEMESSEN (`measureAreaValues` in _cpu.js, einmal
//  je Live-Zug, außerhalb jeder Kartenauflösung):
//
//    nv  Nutzen der Area FÜR MICH = Eval(mit Area) − Eval(Area weg, Handkarten-
//        Areas gesperrt). Positiv: die Area hilft mir; negativ: dem Gegner.
//        Ein Rollout spielt die Folgezüge beider Seiten mit — Effekte, die
//        das statische Eval nicht kennt (45 Areas, nur drei tragen `cpuMeta`),
//        tauchen dadurch auf, soweit der Horizont reicht.
//    sw  TAUSCHWERT = Eval(Area weg, Handkarten-Areas frei) − Eval(Area weg,
//        gesperrt). Was die CPU durch das Nachlegen einer Area aus der Hand
//        gewinnt — nach IHRER Bewertung, einschließlich 》nicht castbar《.
//
//  Beide stehen roh im Kontext (`nv`/`sw`, Schlüssel `Name@own|opp`) und
//  werden hier gebuckelt. Zusätzlich: `hC` = die Area-Karten der Hand, die
//  JETZT ein Held spielen könnte.
//
//  Reines Datenmodul: keine Engine-Abhängigkeit außer dem übergebenen
//  Objekt, nie ein Wurf.
// ═══════════════════════════════════════════════════════════════════

const MAX_NAMEN = 30;

const lc = (s) => String(s || '').toLowerCase();
const istAreaKarte = (cd) => !!cd && lc(cd.subtype) === 'area';
const eindeutig = (arr) => [...new Set(arr.filter(Boolean))];

/** Ein Spieler: Namen auf dem eigenen Brett (Helden, Support-Zonen, Ability-Zonen). */
function brettNamen(ps) {
  const out = [];
  try {
    for (const h of (ps?.heroes || [])) {
      const n = h?.baseName || h?.name;
      if (n) out.push(n);
    }
    for (const hz of (ps?.supportZones || [])) for (const slot of (hz || [])) for (const n of (slot || [])) out.push(n);
    for (const hz of (ps?.abilityZones || [])) for (const slot of (hz || [])) for (const n of (slot || [])) out.push(n);
  } catch { /* Beiwerk */ }
  return eindeutig(out).sort().slice(0, MAX_NAMEN);
}

/**
 * Schul-Stärke eines Spielers: { Schule: [Helden mit der Schule, Summe der Stufen] }.
 * Eine Ability der Stufe N liegt als N gleichnamige Karten im selben Slot.
 */
function schulStaerke(ps) {
  const out = Object.create(null);
  try {
    const heroes = ps?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const h = heroes[hi];
      if (!h?.name || (h.hp || 0) <= 0) continue;
      const proHeld = Object.create(null);
      for (const slot of ((ps.abilityZones || [])[hi] || [])) {
        for (const n of (slot || [])) proHeld[n] = (proHeld[n] || 0) + 1;
      }
      for (const [schule, stufe] of Object.entries(proHeld)) {
        const e = (out[schule] = out[schule] || [0, 0]);
        e[0] += 1; e[1] += stufe;
      }
    }
  } catch { /* Beiwerk */ }
  return out;
}

/**
 * Roher Kontext einer Area-Entscheidung aus Sicht von `pi`.
 *   ao  eigene Areas (Stapelreihenfolge)      ap  gegnerische Areas
 *   hA  Area-Karten auf der eigenen Hand      bd  eigenes Brett (Namen)
 *   sc  Schul-Stärke { o: eigen, p: Gegner }  dA  Area-Karten in der eigenen Ablage
 */
function rohKontext(engine, pi) {
  const k = { ao: [], ap: [], hA: [], hC: [], bd: [], sc: { o: {}, p: {} }, dA: 0 };
  try {
    const gs = engine?.gs;
    const ps = gs?.players?.[pi];
    const os = gs?.players?.[opponentOfGs(gs, pi)];
    const db = engine?._getCardDB ? engine._getCardDB() : {};
    k.ao = [...(gs?.areaZones?.[pi] || [])];
    k.ap = [...(gs?.areaZones?.[opponentOfGs(gs, pi)] || [])];
    k.hA = (ps?.hand || []).filter(n => istAreaKarte(db[n]));
    k.hC = eindeutig(k.hA).filter(n => heldKannSpielen(engine, pi, db[n]));
    k.bd = brettNamen(ps);
    k.sc = { o: schulStaerke(ps), p: schulStaerke(os) };
    k.dA = (ps?.discardPile || []).filter(n => istAreaKarte(db[n])).length;
    // Gemessene Werte der letzten Messung (höchstens zwei Halbzüge alt).
    const m = engine?._areaNet;
    if (m && m.pi === pi && (gs?.turn || 0) - (m.turn || 0) <= 2) {
      k.nv = { ...(m.nv || {}) };
      k.sw = { ...(m.sw || {}) };
    }
  } catch { /* Beiwerk */ }
  return k;
}

/**
 * Kann irgendein Held diese Karte jetzt wirken? Spiegel der Heldenprüfung in
 * `listEligibleHeroesForActionCard` (_cpu.js) ohne Bounce-/Zonen-Sonderfälle.
 * Ob die eigene Area-Zone gerade belegt ist, zählt bewusst NICHT: genau das
 * würde das Abräumen ja ändern.
 */
function heldKannSpielen(engine, pi, cd) {
  try {
    if (!cd) return false;
    const heroes = engine.gs.players[pi].heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const h = heroes[hi];
      if (!h?.name || (h.hp || 0) <= 0) continue;
      if (h.statuses?.frozen || h.statuses?.stunned) continue;
      if (h.statuses?.negated && cd.cardType === 'Spell') continue;
      if (engine.heroMeetsLevelReq(pi, hi, cd)) return true;
    }
  } catch { /* Beiwerk */ }
  return false;
}

/**
 * Stufung der gemessenen Werte. Die Skala ist GEMESSEN, nicht angenommen:
 * im Ende-zu-Ende-Lauf lagen echte Unterschiede bei einigen hundert bis
 * wenigen tausend Eval-Punkten (Blood Rock eigen: +1125 / +2192), und ein
 * im Horizont entschiedenes Spiel springt um ±100000. Die Messung kappt auf
 * ±2000 (`PP_AREA_NET_KAPPE`); 》entscheidet das Spiel《 landet damit in der
 * äußeren Stufe. Erste Annahme (±15/±75 wie HP) war um eine Größenordnung
 * zu klein.
 */
const NV_GRENZEN = [-600, -120, 120, 600];
function stufeNv(v, prefix) {
  const namen = ['opp++', 'opp', '0', 'own', 'own++'];
  let i = 0; while (i < NV_GRENZEN.length && v >= NV_GRENZEN[i]) i++;
  return prefix + namen[i];
}
function stufeSw(v) {
  return 'swap:' + (v < -120 ? '-' : v < 120 ? '0' : v < 600 ? '+' : '++');   // '-': Nachlegen wäre schlechter
}

/**
 * Zustand für die Eval-Messung: solange `blockLearned > 0`, liefert der gelernte
 * Area-Stehwert (`areaStandingValue`) 0 — sonst flösse das Gelernte in die
 * Messgröße zurück, aus der es gelernt wird (und Training und Spiel sähen
 * verschiedene Verteilungen).
 */
const messZustand = { blockLearned: 0 };

/** Offene Tag-Räume — brauchen im Trainer die strengere Schwelle (viele Vergleiche). */
const OFFEN = ['board:'];
const istOffen = (tag) => OFFEN.some(p => tag.startsWith(p));

/**
 * Tags EINER angebotenen Area. `seite` = 'own' | 'opp' (relativ zum Wähler).
 * `roh` = Ergebnis von rohKontext (live oder aus der Aufzeichnung).
 */
function areaTags(roh, areaName, seite, cardDB) {
  const tags = [];
  try {
    const r = roh || {};
    const cd = (cardDB || {})[areaName];

    // (a) Wem nützt sie mehr? Passung = Summe der Stufen der Schulen, die die Area nennt.
    const schulen = [cd?.spellSchool1, cd?.spellSchool2].filter(Boolean);
    if (schulen.length) {
      let eigen = 0, fremd = 0;
      for (const s of schulen) {
        eigen += (r.sc?.o?.[s]?.[1]) || 0;
        fremd += (r.sc?.p?.[s]?.[1]) || 0;
      }
      tags.push('fit:' + (fremd > eigen ? 'opp>own' : fremd < eigen ? 'own>opp' : 'eq'));
    }

    // (b) Will ich eine ANDERE Area ausspielen — und KANN ich es, und was ist es WERT?
    // EINE Familie, die einander ausschließt (sonst zählte der Prior dieselbe Erkenntnis doppelt):
    //   hand:none    keine andere Area auf der Hand
    //   hand:stuck   eine da, aber kein Held kann sie jetzt spielen
    //   swap:-|0|+|++ spielbar UND gemessener Tauschwert `sw` (die Bewertung der CPU selbst:
    //                0 heißt 》sie würde sie gar nicht nachlegen《)
    //   hand:ready   spielbar, aber nicht gemessen (kein Messlauf in diesem Zug)
    // Bewusst KEIN Name der Handkarte (`plans:<Name>`): kollinear zu `ready`.
    const andere = eindeutig((r.hA || []).filter(n => n !== areaName));
    const key = `${areaName}@${seite}`;
    if (!andere.length) tags.push('hand:none');
    else if (!andere.some(n => (r.hC || []).includes(n))) tags.push('hand:stuck');
    else if (r.sw && typeof r.sw[key] === 'number') tags.push(stufeSw(r.sw[key]));
    else tags.push('hand:ready');

    // (a') GEMESSENER Nutzen der Area für mich (nur wenn eine Messung vorliegt).
    if (r.nv && typeof r.nv[key] === 'number') tags.push(stufeNv(r.nv[key], 'net:'));
    tags.push('areas:own:' + Math.min((r.ao || []).length, 3));
    tags.push('areas:opp:' + Math.min((r.ap || []).length, 3));

    // (c) Trigger / Skalierung durch Abräumen eigener Karten.
    const dA = r.dA || 0;
    tags.push('dpa:' + (dA === 0 ? '0' : dA <= 2 ? '1-2' : '3+'));
    for (const n of (r.bd || [])) tags.push('board:' + n);
  } catch { /* Beiwerk */ }
  return tags;
}

module.exports = { rohKontext, areaTags, istOffen, istAreaKarte, heldKannSpielen, stufeNv, stufeSw, messZustand, OFFEN };
