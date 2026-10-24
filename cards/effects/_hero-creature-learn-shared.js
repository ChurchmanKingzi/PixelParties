'use strict';

const { opponentOfGs } = require('./_opp');
// ═══════════════════════════════════════════════════════════════════
//  HELD ALS KREATUR — GEMEINSAMES VOKABULAR DES LERNKANALS (Form 9, 24.10.2026)
//
//  „Die CPU soll Hulijing benutzen — mit einem eigenen Lernkanal."
//
//  Hulijing, the Foxdemon legt eine Kreatur aus Hand ODER Deck auf sich: die Karte ist bis
//  Zugende eine Kreatur (Einsatz-Effekt, sofort nutzbarer aktiver Effekt, Todes-Effekt) und
//  wird am Ende GELÖSCHT. Ob und WELCHE Kreatur sich lohnt, hängt an der Lage — und es gibt
//  keine feste Rangfolge: ein freier Einsatz-Effekt aus dem Deck ist fast geschenkt, dieselbe
//  Karte von der Hand kostet einen Zug. Deshalb wird es gelernt, nicht verdrahtet.
//
//  ── WARUM EIN GEMEINSAMES MODUL ───────────────────────────────────
//  Die Tags müssen im TRAINER (aus dem rohen Kontext einer aufgezeichneten Entscheidung) und
//  zur LAUFZEIT (aus dem lebenden Spiel) BIT-GLEICH entstehen. Zwei Ableitungen driften
//  auseinander — die Fehlerklasse, die das Projekt an mehreren Lernkanälen schon gekostet hat
//  (Vorbild: `_area-removal-shared.js`, Form 7). Deshalb: ein Modul, zwei Aufrufer.
//
//    rohKontext(engine, pi, heroIdx, pool)  → was der Recorder mitschreibt (roh, unbewertet)
//    kandidatenTags(roh, k)                 → die Tags EINER angebotenen Kreatur
//    lageTags(roh)                          → Tags der Entscheidung selbst
//    heuristik(roh)                         → Startwert OHNE Training (Kreatur oder null)
//
//  Der Recorder schreibt ROH (Aufzeichnen ist gratis, nicht nachholbar); abgeleitet wird erst
//  hier, damit Schwellen ohne neuen Sammellauf änderbar bleiben.
//
//  ── DER ROHE KONTEXT (`hc`, eine Zeile je Held, Phase und Zug) ──────
//    hp, mx   aktuelle / maximale HP des Helden JETZT (vor der Verwandlung)
//    ma       Magic-Arts-Stufe des Helden (die Obergrenze der Kreaturenstufe)
//    bd, bo   Kreaturen auf dem eigenen / gegnerischen Brett
//    pl       der Pool: je Kreatur { n: Name, p: 'h' Hand | 'd' Deck, lv: Stufe, hp: Karten-HP,
//             ob: hat Einsatz-Effekt, ac: freier aktiver Effekt (Haste: sofort nutzbar),
//             ax: aktiver Effekt kostet eine Aktion, dt: Todes-Effekt }
//
//  ── WAS DIE TAGS ABBILDEN ───────────────────────────────────────────
//    Herkunft  `src:hand|deck`   — aus der Hand kostet die Karte einen Spielzug, aus dem Deck fast nichts
//    Wirkung   `fx:summon|active|action|death|none`   — was die Kreatur in dieser Runde TUT
//    Stufe     `lv:0|1|2|3+`
//    HP        `mx:over|fit` — liegen die aktuellen HP des Helden über den HP der Kreatur? Dann steht er
//              mit Overheal da (Heilung bringt nichts, Schaden zehrt ab); `hpr:*` die Größenordnung
//    Brett     `bd:*` / `bo:*`  — Kreaturen eigen / gegnerisch (Todes-Effekte, Flächenschläge)
//    Lage      `ma:*`, `pool:*`, `mix:*` (Pool nur Hand / nur Deck / beides)
//  Dazu kommen die Zustands-Tags des Trainers (`st:*`: Zug, Phase, Stand, Hand, Deck …).
//
//  Reines Datenmodul: keine Engine-Abhängigkeit außer dem übergebenen Objekt, nie ein Wurf.
// ═══════════════════════════════════════════════════════════════════

const MAX_POOL = 24;

/** Zähler-Stufe als Text. */
function stufe(v, grenzen, namen) {
  for (let i = 0; i < grenzen.length; i++) if (v <= grenzen[i]) return namen[i];
  return namen[namen.length - 1];
}

/** Kreaturen auf dem Brett eines Spielers (Support Zones, Karten mit Kreaturen-Typ). */
function kreaturenAuf(ps, db) {
  let n = 0;
  try {
    for (const hz of (ps?.supportZones || [])) {
      for (const slot of (hz || [])) {
        for (const name of (slot || [])) {
          const t = String(db?.[name]?.cardType || '');
          if (/creature/i.test(t)) n++;
        }
      }
    }
  } catch { /* Beiwerk */ }
  return n;
}

/** Was die Kreatur in dieser Runde tut — aus dem Skript, nicht aus dem Kartentext. */
function wirkungsFlags(name, loadFx) {
  const f = { ob: 0, ac: 0, ax: 0, dt: 0 };
  try {
    const s = typeof loadFx === 'function' ? loadFx(name) : null;
    if (!s) return f;
    if (s.hooks && typeof s.hooks.onPlay === 'function') f.ob = 1;
    if (s.creatureEffect && typeof s.onCreatureEffect === 'function') {
      if (s.creatureActionCost) f.ax = 1; else f.ac = 1;
    }
    if (s.hooks && typeof s.hooks.onCreatureDeath === 'function') f.dt = 1;
  } catch { /* Beiwerk */ }
  return f;
}

/**
 * Roher Kontext einer Hulijing-Entscheidung aus Sicht von `pi`.
 * `pool` = [{ name, pile: 'hand'|'deck', handIdx?, level }] (die Kandidaten des Helden).
 */
function rohKontext(engine, pi, heroIdx, pool) {
  const k = { hp: 0, mx: 0, ma: 0, bd: 0, bo: 0, pl: [] };
  try {
    const gs = engine?.gs;
    const ps = gs?.players?.[pi];
    const os = gs?.players?.[opponentOfGs(gs, pi)];
    const db = engine?._getCardDB ? engine._getCardDB() : {};
    const { loadCardEffect } = require('./_loader');
    const hero = ps?.heroes?.[heroIdx];
    k.hp = Math.max(0, Math.round(hero?.hp || 0));
    k.mx = Math.max(0, Math.round(hero?.maxHp || hero?.hp || 0));
    try { k.ma = Math.max(0, Number(engine.heroSchoolLevel('Magic Arts', pi, heroIdx)) || 0); } catch { k.ma = 0; }
    k.bd = kreaturenAuf(ps, db);
    k.bo = kreaturenAuf(os, db);
    for (const c of (pool || []).slice(0, MAX_POOL)) {
      const cd = db[c.name] || {};
      k.pl.push({
        n: c.name, p: c.pile === 'deck' ? 'd' : 'h', lv: Number.isFinite(Number(c.level)) ? Number(c.level) : (Number(cd.level) || 0),
        hp: Math.max(0, Math.round(Number(cd.hp) || 0)), ...wirkungsFlags(c.name, loadCardEffect),
      });
    }
  } catch { /* Beiwerk */ }
  return k;
}

/** Tags EINER angebotenen Kreatur `k` (Eintrag aus `roh.pl`). */
function kandidatenTags(roh, k) {
  const tags = [];
  try {
    if (!k) return tags;
    tags.push('src:' + (k.p === 'd' ? 'deck' : 'hand'));
    tags.push('lv:' + stufe(k.lv, [0, 1, 2], ['0', '1', '2', '3+']));
    if (k.ob) tags.push('fx:summon');
    if (k.ac) tags.push('fx:active');
    if (k.ax) tags.push('fx:action');
    if (k.dt) tags.push('fx:death');
    if (!k.ob && !k.ac && !k.ax && !k.dt) tags.push('fx:none');
    const r = roh || {};
    if (k.hp > 0 && r.hp > 0) {
      tags.push('mx:' + (r.hp > k.hp ? 'over' : 'fit'));
      const q = k.hp / r.hp;
      tags.push('hpr:' + (q < 0.1 ? 'tiny' : q < 0.3 ? 'small' : q < 0.7 ? 'half' : 'full'));
    }
    tags.push('bd:' + stufe(r.bd || 0, [0, 2], ['0', '1-2', '3+']));
    tags.push('bo:' + stufe(r.bo || 0, [0, 2], ['0', '1-2', '3+']));
  } catch { /* Beiwerk */ }
  return tags;
}

/** Tags der Entscheidung selbst (für jede angebotene Kreatur dieselben). */
function lageTags(roh) {
  const tags = [];
  try {
    const r = roh || {};
    tags.push('ma:' + stufe(r.ma || 0, [1, 2], ['1', '2', '3+']));
    const n = (r.pl || []).length;
    tags.push('pool:' + stufe(n, [1, 3], ['1', '2-3', '4+']));
    const hand = (r.pl || []).some(k => k.p === 'h'), deck = (r.pl || []).some(k => k.p === 'd');
    tags.push('mix:' + (hand && deck ? 'both' : hand ? 'hand' : 'deck'));
  } catch { /* Beiwerk */ }
  return tags;
}

/** Alle Tags eines Paares (Entscheidung × angebotene Kreatur). */
function alleTags(roh, k) {
  return lageTags(roh).concat(kandidatenTags(roh, k));
}

/**
 * Startwert OHNE Training: nur DECK-Karten (kosten fast nichts) mit sofortigem Nutzen — Einsatz-Effekt oder freier
 * aktiver Effekt. Die Hand bleibt unangetastet (eine Handkarte kostet einen Zug, und ohne Daten gibt es keinen Grund,
 * das zu wagen). Unter den Kandidaten gewinnt der mit der größeren Wirkung (aktiver Effekt vor Einsatz-Effekt, dann
 * die höhere Stufe, dann der Name — deterministisch). Liefert den Eintrag aus `roh.pl` oder null.
 * Das Gate der CPU (`mctsGatedActivation`) prüft den Vorschlag trotzdem noch gegen das Auslassen.
 */
function heuristik(roh) {
  try {
    const kand = ((roh && roh.pl) || []).filter(k => k.p === 'd' && (k.ob || k.ac));
    if (!kand.length) return null;
    const wert = (k) => (k.ac ? 2 : 0) + (k.ob ? 1 : 0) + k.lv * 0.1;
    kand.sort((a, b) => (wert(b) - wert(a)) || String(a.n).localeCompare(String(b.n)));
    return kand[0];
  } catch { return null; }
}

module.exports = { rohKontext, kandidatenTags, lageTags, alleTags, heuristik, MAX_POOL };
