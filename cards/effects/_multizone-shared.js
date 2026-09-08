// ═══════════════════════════════════════════
//  SHARED HELPER: KREATUREN, DIE MEHRERE SUPPORT ZONES BELEGEN
//  („Populated Island Turtle", „Land Sharks")
//
//  Die Kreatur selbst sitzt in EINEM Platz — dem, den der normale
//  Beschwoerungsweg waehlt. Die uebrigen Plaetze des Gastgeber-Helden
//  bekommen den Platzhalternamen `_ZoneBlocked`. Der:
//
//   • blockt weitere Platzierungen, weil die Frei-Pruefung in
//     `safePlaceInSupport` nur `slot.length === 0` kennt;
//   • ist fuer jede Zielsuche unsichtbar, weil `cardDB['_ZoneBlocked']`
//     undefined liefert und damit jeder `hasCardType`-Filter greift;
//   • wird beim Verlassen der Kreatur wieder abgeraeumt.
//
//  ── WARUM HIER UND NICHT IN DER KARTE (v784) ───────────────────────
//  Die Mechanik stand bis dahin vollstaendig in
//  `populated-island-turtle.js` — mit dem dortigen Vermerk vom 17.8.,
//  die Abkuerzung sei „eine offene Schuld, keine gerechtfertigte
//  Vereinfachung". Mit „Land Sharks" ist es die zweite Karte dieser
//  Bauform; doppelt gepflegte Zonenlogik waere der schlechtere Weg.
//  Beide Karten teilen sich jetzt diesen Code, die Turtle inbegriffen.
//
//  ── INSELZONEN (v787, Als Vorgabe 5.9.) ────────────────────────────
//  „Flying Island in the Sky" haengt einem Helden zusaetzliche
//  Support Zones HINTEN an das Array an (`islandZoneCount` zaehlt sie).
//  Diese Zonen nehmen ausdruecklich Kreaturen auf — eine
//  Mehrzonen-Kreatur darf sie also mitbenutzen.
//
//  Daraus folgen drei Dinge:
//   • Gezaehlt wird ueber die TATSAECHLICHE Zonenzahl des Helden, nicht
//     ueber die feste 3. Ein Held mit 5 Zonen und 3 freien taugt.
//   • Die Bedingung ist „mindestens N FREIE Zonen", nicht mehr „alle
//     Zonen frei". Sonst waere die Karte an einem Helden mit Insel
//     unbeschwoerbar, obwohl er MEHR Platz hat als noetig.
//   • Faellt eine belegte Inselzone weg, wird die Kreatur auf die
//     verbliebenen freien Zonen UMGESCHICHTET; geht das nicht, wandert
//     sie in die Ablage (`handleIslandRemoval`). Sie stirbt dabei
//     NICHT — Als Vorgabe.
//
//  ── VERBLEIBENDE KANTE (unveraendert uebernommen) ──────────────────
//  Ein Leser, der `supportZones[hi][si][0]` ROH auswertet, ohne die
//  Karte in der Datenbank nachzuschlagen, saehe die
//  Platzhalter-Zeichenkette. Nachgemessen (5.9.): einen solchen Leser
//  gibt es im Projekt nicht — der Client zeichnet `_ZoneBlocked` sogar
//  ausdruecklich als gesperrtes Feld.
// ═══════════════════════════════════════════

const ZONE_BLOCKED = '_ZoneBlocked';
const ZONES_PRO_HELD = 3;          // Grundausstattung; Inseln kommen dazu
const BELEGT_STANDARD = 3;         // wie viele Zonen die Karte einnimmt

/** Tatsaechliche Zonenzahl dieses Helden — Grundzonen PLUS Inselzonen. */
function zonenAnzahl(ps, heroIdx) {
  return (ps?.supportZones?.[heroIdx] || []).length;
}

/**
 * Indizes der FREIEN Zonen dieses Helden.
 *
 * Frei heisst: leer, ein eigener Platzhalter, oder der Platz, in dem die
 * eigene Instanz gerade sitzt. Letzteres deckt zwei Faelle ab — die
 * Beschwoerungs-Nachpruefung (die Instanz steht schon irgendwo) und das
 * Umschichten (sie darf auf ihre eigenen Zonen zurueckgreifen).
 */
function freieZonen(engine, pi, heroIdx, cardName, selfInstId, opts = {}) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return [];
  const sup = ps.supportZones?.[heroIdx] || [];
  const bis = opts.bis != null ? Math.min(opts.bis, sup.length) : sup.length;
  const frei = [];
  for (let z = 0; z < bis; z++) {
    const slot = sup[z] || [];
    if (slot.length === 0) { frei.push(z); continue; }
    if (slot.length === 1 && slot[0] === ZONE_BLOCKED && selfInstId) { frei.push(z); continue; }
    if (!selfInstId || slot[0] !== cardName) continue;
    const inst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'support'
      && c.heroIdx === heroIdx && c.zoneSlot === z
      && c.id === selfInstId);
    if (inst) frei.push(z);
  }
  return frei;
}

/** Reichen die freien Zonen dieses Helden fuer die Karte? */
function genugZonenFrei(engine, pi, heroIdx, cardName, selfInstId, benoetigt) {
  return freieZonen(engine, pi, heroIdx, cardName, selfInstId).length >= benoetigt;
}

/**
 * `canSummon` fuer eine Mehrzonen-Kreatur — beide Fragen, die die
 * Engine stellt:
 *
 *  • Pro Held (`cardHeroIdx >= 0`): sind DESSEN drei Plaetze frei?
 *  • Kartenweit (`cardHeroIdx === -1`, aus `getSummonBlocked`): gibt es
 *    ueberhaupt einen tauglichen Helden? Steuert die Ausgrauung auf
 *    der Hand.
 */
function canSummonMultiZone(ctx, cardName, benoetigt = BELEGT_STANDARD) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;

  if (typeof heroIdx === 'number' && heroIdx >= 0) {
    return genugZonenFrei(engine, pi, heroIdx, cardName, ctx.card?.id, benoetigt);
  }

  const cardData = engine._getCardDB()[ctx.cardName];
  if (!cardData) return true;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
    if (genugZonenFrei(engine, pi, hi, cardName, null, benoetigt)) return true;
  }
  return false;
}

/**
 * Nach der Beschwoerung: die uebrigen Plaetze des Gastgebers mit dem
 * Platzhalter belegen. Nur fuer die eigene Beschwoerung aufrufen —
 * der Aufrufer prueft `ctx.playedCard?.id === ctx.card.id`.
 */
function claimZones(ctx, logTyp, benoetigt = BELEGT_STANDARD) {
  const engine = ctx._engine;
  const ps = engine.gs.players[ctx.cardOwner];
  if (!ps) return false;
  const heroIdx = ctx.cardHeroIdx;
  const eigenerPlatz = ctx.card.zoneSlot;
  const sup = ps.supportZones?.[heroIdx];
  if (!sup) return false;
  // Ueber die TATSAECHLICHE Zonenzahl laufen (Inselzonen haengen hinten
  // dran) und nur so viele belegen, wie die Karte braucht — an einem
  // Helden mit 5 Zonen bleiben zwei frei.
  let gesetzt = 0;
  let belegt = 1;                                  // der eigene Platz zaehlt mit
  for (let z = 0; z < sup.length && belegt < benoetigt; z++) {
    if (z === eigenerPlatz) continue;
    if ((sup[z] || []).length === 0) { sup[z] = [ZONE_BLOCKED]; gesetzt++; belegt++; }
  }
  // Nichts zu tun (schon belegt, oder ein Nachzuegler-Durchlauf) — dann
  // auch keine Logzeile und kein Versand. Sonst schriebe der
  // Nachhol-Durchlauf beim Spielstart jedes Mal eine zweite Zeile.
  if (gesetzt === 0) return false;
  if (logTyp) {
    engine.log(logTyp, { player: ps.username, heroIdx, anchorSlot: eigenerPlatz });
  }
  engine.sync();
  return true;
}

/**
 * Beim Verlassen: Platzhalter abraeumen, damit die Plaetze wieder frei
 * werden. Laeuft ueber `onCardLeaveZone` und deckt damit jeden Weg vom
 * Brett ab — Tod, Bounce, Umzug, Ablage durch den Gegner.
 *
 * `fromHeroIdx` ist das saubere Signal; einige Wege tragen es nicht mit.
 * Dann wird ueber alle eigenen Helden nach VERWAISTEN Platzhaltern
 * gesucht: Plaetze, in denen ein Platzhalter steht, obwohl nirgends
 * mehr die Ankerkarte liegt.
 */
function releaseZones(ctx, cardName) {
  const engine = ctx._engine;
  const ps = engine.gs.players[ctx.cardOwner];
  if (!ps) return false;

  const raeumen = (heroIdx) => {
    const sup = ps.supportZones?.[heroIdx];
    if (!sup) return;
    for (let z = 0; z < sup.length; z++) {
      const slot = sup[z] || [];
      if (slot.length === 1 && slot[0] === ZONE_BLOCKED) sup[z] = [];
    }
  };

  const heroIdx = ctx.fromHeroIdx;
  if (typeof heroIdx === 'number' && heroIdx >= 0) {
    raeumen(heroIdx);
  } else {
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const sup = ps.supportZones?.[hi] || [];
      let ankerDa = false;
      for (let z = 0; z < sup.length; z++) {
        if ((sup[z] || [])[0] === cardName) { ankerDa = true; break; }
      }
      if (!ankerDa) raeumen(hi);
    }
  }
  engine.sync();
  return true;
}

/**
 * ★ EINE INSELZONE FAELLT WEG (v787, Als Vorgabe 5.9.).
 *
 * Aufzurufen aus `removeIslandZones`, NACHDEM der Abschnitt feststeht
 * und BEVOR die Kreaturen darin besiegt werden. Fuer jede
 * Mehrzonen-Kreatur, deren belegte Zonen in den wegfallenden Abschnitt
 * ragen:
 *
 *   • Reichen die verbleibenden Zonen (ab 0 bis `abIdx`) noch fuer sie,
 *     wird sie dorthin UMGESCHICHTET — Anker und Platzhalter neu
 *     gesetzt, Instanz behaelt HP, Counter und ID.
 *   • Sonst geht sie in die ABLAGE ihres Besitzers. Sie stirbt NICHT:
 *     kein Todespfad, keine on-kill-Effekte. Das ist die ausdrueckliche
 *     Vorgabe und weicht bewusst vom Inseltext ab („any Creatures in
 *     those Support Zones are defeated"), der die gewoehnliche
 *     Ein-Zonen-Kreatur meint.
 *
 * Erkannt werden Mehrzonen-Kreaturen an `multiZone` in ihrem Skript —
 * der Zahl der Zonen, die sie einnehmen.
 */
async function handleIslandRemoval(engine, pi, heroIdx, abIdx) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return;
  const sup = ps.supportZones?.[heroIdx];
  if (!sup) return;

  let loader = null;
  try { loader = require('./_loader'); } catch { return; }

  const anker = engine.cardInstances.filter(c =>
    c.zone === 'support' && c.heroIdx === heroIdx
    && (c.controller ?? c.owner) === pi
    && c.zoneSlot >= 0);

  for (const inst of anker) {
    let script = null;
    try { script = loader.loadCardEffect(inst.name); } catch { script = null; }
    const benoetigt = Number(script?.multiZone) || 0;
    if (benoetigt < 2) continue;

    // Welche Zonen gehoeren dieser Kreatur gerade?
    const eigene = [];
    for (let z = 0; z < sup.length; z++) {
      const slot = sup[z] || [];
      if (slot.length !== 1) continue;
      if (z === inst.zoneSlot && slot[0] === inst.name) { eigene.push(z); continue; }
      if (slot[0] === ZONE_BLOCKED) eigene.push(z);
    }
    // Nicht betroffen, wenn nichts davon im wegfallenden Abschnitt liegt.
    if (!eigene.some(z => z >= abIdx)) continue;

    // Eigene Zonen freigeben, damit sie bei der Suche als frei gelten.
    for (const z of eigene) sup[z] = [];

    const frei = [];
    for (let z = 0; z < Math.min(abIdx, sup.length); z++) {
      if ((sup[z] || []).length === 0) frei.push(z);
    }

    if (frei.length >= benoetigt) {
      const ziel = frei.slice(0, benoetigt);
      sup[ziel[0]] = [inst.name];
      inst.zoneSlot = ziel[0];
      for (let i = 1; i < ziel.length; i++) sup[ziel[i]] = [ZONE_BLOCKED];
      engine.log('multizone_reseated', {
        player: ps.username, card: inst.name, hero: ps.heroes?.[heroIdx]?.name,
        slot: ziel[0],
      });
    } else {
      engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
      const zielPs = engine.gs.players[inst.originalOwner ?? inst.owner];
      if (zielPs) {
        if (!zielPs.discardPile) zielPs.discardPile = [];
        zielPs.discardPile.push(inst.name);
      }
      engine.log('multizone_no_room', {
        player: ps.username, card: inst.name, hero: ps.heroes?.[heroIdx]?.name,
      });
    }
  }
  engine.sync();
}

/**
 * Fertige Hook-Paare fuer eine Mehrzonen-Kreatur. Die Karte streut sie
 * in ihre eigenen `hooks` und behaelt daneben ihre eigenen Effekte.
 */
function multiZoneHooks(cardName, opts = {}) {
  return {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      claimZones(ctx, opts.claimLog);
    },
    /**
     * ★ VORAB PLATZIERT (v786, Als Befund 5.9.).
     *
     * Der Puzzle-Lader legt Karten direkt in die Support Zones und
     * ueberspringt `onPlay` vollstaendig — eine so gesetzte
     * Mehrzonen-Kreatur belegte deshalb nur ihren eigenen Platz.
     * `onGameStart` laeuft im Puzzle-Startpfad NACH dem Aufbau des
     * Bretts und traegt die Platzhalter nach.
     *
     * Dieselbe Bauform wie bei vorab ausgeruesteten Artefakten
     * (Sacred Hammer, Club of Gobbo) — und generisch statt als weiterer
     * By-Name-Sonderfall in der langen Nachhol-Kette des Laders.
     *
     * Unbedenklich im normalen Spiel: dort steht bei Spielbeginn keine
     * Kreatur auf dem Brett, der Durchlauf findet nichts vor.
     * Idempotent ohnehin — `claimZones` schreibt nur in LEERE Plaetze,
     * ein von Hand daneben gesetztes Kaertchen bleibt also stehen.
     */
    onGameStart: async (ctx) => {
      if (ctx.card?.zone !== 'support') return;
      if (!(ctx.card.zoneSlot >= 0)) return;
      claimZones(ctx, opts.claimLog);
    },
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      releaseZones(ctx, cardName);
    },
  };
}

module.exports = {
  ZONE_BLOCKED,
  ZONES_PRO_HELD,
  BELEGT_STANDARD,
  zonenAnzahl,
  freieZonen,
  genugZonenFrei,
  canSummonMultiZone,
  claimZones,
  releaseZones,
  handleIslandRemoval,
  multiZoneHooks,
};
