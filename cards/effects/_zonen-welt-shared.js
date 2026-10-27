'use strict';
// ═══════════════════════════════════════════
//  GETEILT: ZONEN-WELT — „Gigalopolis, the Mega-City" (+1 Support Zone) und „Barrel Home" (−1 Support Zone)         (Welle 6b)
//
//  Beide Areas ändern die Support Zonen ALLER Helden beider Seiten. Der Zustand wird deshalb nicht von den Karten, sondern HIER aus dem Brett abgeleitet und
//  idempotent abgeglichen (`abgleichen`): G = Zahl der Gigalopolis, B = Zahl der Barrel Homes in irgendeiner Area Zone.
//
//    • Gigalopolis: je Held EINE zusätzliche Support Zone, die nur Kreaturen aufnimmt — eine Inselzone (`islandZoneCount`), wie die von Flying Island in the Sky. Sie ist
//      die ERSTE Inselzone (Index 3): Flying-Island-Zonen kommen dahinter, `removeIslandZones` (rechtes Ende) trifft sie also nie. Bei ungerader Inselzahl liegt die Extra-Zone
//      LINKS (Client: `left = ceil(ic / 2)`; mit einer Zone: 1 | 2 | 3 | 4, die Ability Zones 1-3 über den Support Zonen 2-4).
//    • Barrel Home: „1 fewer Support Zone". Die ERSTE Fass-Wirkung hebt die Gigalopolis-Zone auf (wird entfernt, solange ein Fass liegt — „der Gigalopolis-Zone wird immer zuerst
//      entzogen"); jedes weitere Fass versiegelt eine GRUNDZONE (Platzhalter `_ZoneBarrel`: zählt für jede Frei-Prüfung als belegt, nimmt nichts auf, der Client zeichnet ein Fass).
//      Flying-Island-Zonen werden nie bevorzugt entzogen (es gibt keinen Weg, sie zu versiegeln). Gezählt wird also: Inseln = max(0, G − B); Siegel = min(3, max(0, B − G)).
//
//  ── WAS GESCHIEHT MIT KARTEN IN EINER ZU SCHLIESSENDEN ZONE? ──────────────
//  Eine Kreatur zieht in eine freie Zone um (Inselzonen zuerst, damit Grundzonen für Ausrüstung frei bleiben). Gibt es keine, MUSS der Kontrolleur des Helden eine Karte aus seinen
//  Support Zonen in die Ablage schicken (Pflichtwahl, `promptEffectTarget`), danach zieht der Rest um. Die Karte geht OHNE Niederlage in die Ablage (`opts.ohneNiederlage` von
//  `actionMoveCard`: keine Todes-Hooks, aber `onCardLeaveZone` & Co.). Nichts davon ist „defeated".
//
//  ── Zustand ────────────────────────────────────────────────────────────
//  `ps._weltZonen[heldIdx] = { giga: <Zahl der von Gigalopolis angelegten Inselzonen>, siegel: [<Grundzonen-Indizes mit Fass-Platzhalter>] }`.
//  Abgleich: beim Ein-/Austritt einer der beiden Areas, am Zugbeginn (neue Helden) und beim Spielstart (vorab gelegte Areas im Puzzle/Skilltest). Reentrant-sicher
//  (`engine._weltZonenLaeuft`): ein Hook, der mitten im Abgleich einen neuen Abgleich auslöst, merkt ihn nur vor.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { ZONES, hasCardType } = require('./_hooks');

const GIGA = 'Gigalopolis, the Mega-City';
const FASS = 'Barrel Home';
const SIEGEL = '_ZoneBarrel';
const BASIS = 3;
const KAPUTT_MAX = 6;

function zaehle(engine, name, ausser) {
  return engine.cardInstances.filter(c => c.zone === 'area' && c.name === name && c !== ausser).length;
}

function zustand(ps, hi) {
  if (!Array.isArray(ps._weltZonen)) ps._weltZonen = [];
  if (!ps._weltZonen[hi]) ps._weltZonen[hi] = { giga: 0, siegel: [] };
  return ps._weltZonen[hi];
}

/** Karten (Instanzen) in einer Support Zone dieses Helden auf dieser Brettseite. */
function instanzenIn(engine, pi, hi, z) {
  return engine.cardInstances.filter(c => (c.zone === ZONES.SUPPORT || c.zone === ZONES.NESTED) && c.heroIdx === hi && c.zoneSlot === z && engine.physicalSide(c) === pi);
}

/** Alle echten Karten (Instanzen) in den Support Zonen dieses Helden. */
function alleKarten(engine, pi, hi) {
  return engine.cardInstances.filter(c => c.zone === ZONES.SUPPORT && c.heroIdx === hi && c.zoneSlot >= 0 && engine.physicalSide(c) === pi);
}

function istKreatur(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

/** Darf der Inhalt von Zone `z` umziehen? Nur ganz gewöhnliche Kreaturen (keine Mehrzonen-Kreatur, kein Platzhalter, keine Ausrüstung). */
function umziehbar(engine, pi, hi, z) {
  const slot = (engine.gs.players[pi].supportZones[hi] || [])[z] || [];
  if (slot.length === 0) return false;
  if (slot.some(n => n === SIEGEL || n === '_ZoneBlocked')) return false;
  const insts = instanzenIn(engine, pi, hi, z);
  if (insts.length !== slot.length) return false;
  return insts.every(c => istKreatur(engine, c) && !(Number(loadCardEffect(c.name)?.multiZone) >= 2) && c.zone === ZONES.SUPPORT);
}

function zoneVerschieben(engine, pi, hi, von, nach) {
  const sup = engine.gs.players[pi].supportZones[hi];
  const insts = instanzenIn(engine, pi, hi, von);
  sup[nach] = sup[von];
  sup[von] = [];
  for (const c of insts) c.zoneSlot = nach;
  engine.log('zonen_welt_umzug', { hero: engine.gs.players[pi].heroes?.[hi]?.name, von, nach });
}

/** Freie Zone ≠ `ausser`, die den Inhalt aufnehmen darf (Inselzonen nur Kreaturen — hier immer Kreaturen). Inselzonen zuerst. */
function freieZielZone(engine, pi, hi, ausser) {
  const sup = engine.gs.players[pi].supportZones[hi];
  for (let z = BASIS; z < sup.length; z++) if (z !== ausser && (sup[z] || []).length === 0) return z;
  for (let z = 0; z < Math.min(BASIS, sup.length); z++) if (z !== ausser && (sup[z] || []).length === 0) return z;
  return null;
}

/** Index-Verschiebung der Instanzen, wenn eine Zone eingefügt (+1) / entfernt (−1) wird. */
function indizesVerschieben(engine, pi, hi, ab, delta) {
  for (const c of engine.cardInstances) {
    if ((c.zone === ZONES.SUPPORT || c.zone === ZONES.NESTED) && c.heroIdx === hi && c.zoneSlot >= ab && engine.physicalSide(c) === pi) c.zoneSlot += delta;
  }
}

function gigaZoneAnlegen(engine, pi, hi) {
  const ps = engine.gs.players[pi];
  if (!ps.islandZoneCount) ps.islandZoneCount = [0, 0, 0];
  const sup = ps.supportZones[hi];
  sup.splice(BASIS, 0, []);
  ps.islandZoneCount[hi] = (ps.islandZoneCount[hi] || 0) + 1;
  indizesVerschieben(engine, pi, hi, BASIS, +1);   // die bisherige Zone 3 und alles dahinter rückt um eins nach rechts
  engine.log('zonen_welt_giga_zone', { hero: ps.heroes?.[hi]?.name, zonen: sup.length });
}

/** Wert einer Karte für die automatische Wahl (niedrig = zuerst weg): Ausrüstung vor Kreaturen, schwache Kreaturen vor starken. */
function kartenWert(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name] || {};
  if (!istKreatur(engine, inst)) return (cd.cost || 0);
  return 100 + (cd.level || 0) * 10 + (cd.hp || 0) / 50 + (cd.atk || 0) / 50;
}

/**
 * „Its controller must send a card from its Support Zones to the discard pile." — der Kontrolleur des Helden wählt (Pflicht), die Karte geht OHNE Niederlage in die Ablage.
 * @param {Set<number>} [nurZonen] nur Karten aus diesen Zonen wählbar
 * @returns {Promise<boolean>} false, wenn nichts gesendet werden konnte
 */
async function karteSenden(engine, pi, hi, nurZonen) {
  const hero = engine.gs.players[pi].heroes?.[hi];
  let karten = alleKarten(engine, pi, hi);
  if (nurZonen) karten = karten.filter(c => nurZonen.has(c.zoneSlot));
  if (karten.length === 0) return false;
  let gewaehlt = null;
  if (karten.length === 1 || engine._inMctsSim || engine._fastMode) {
    gewaehlt = karten.slice().sort((a, b) => kartenWert(engine, a) - kartenWert(engine, b))[0];
  } else {
    const ktrl = engine.heroSideOf(pi, hero);
    const ziele = karten.map(c => engine.kreaturZiel(c));
    const ids = await engine.promptEffectTarget(ktrl, ziele, {
      title: FASS, source: FASS,
      description: `${hero?.name || 'A Hero'} has more cards in its Support Zones than Support Zones. Choose a card to send to the discard pile.`,
      confirmLabel: 'Send to discard', confirmClass: 'btn-danger',
      cancellable: false, allowNonCreatureEquips: true, maxSelect: 1, maxTotal: 1,   // pflichtwahl: der Text zwingt zur Wahl („must send a card")
    });
    const id = Array.isArray(ids) ? ids[0] : ids;
    const z = ziele.find(t => t.id === id);
    gewaehlt = z ? z.cardInstance : karten.slice().sort((a, b) => kartenWert(engine, a) - kartenWert(engine, b))[0];
  }
  if (!gewaehlt) return false;
  engine.log('barrel_home_discard', { hero: hero?.name, card: gewaehlt.name });
  await engine.actionMoveCard(gewaehlt, ZONES.DISCARD, -1, -1, { source: FASS, sourceName: FASS, ohneNiederlage: true });
  engine.sync();
  return gewaehlt.zone !== ZONES.SUPPORT;
}

/** Schließt die Gigalopolis-Zone (Index 3): Inhalt umziehen oder (Pflicht) eine Karte senden, dann Zone entfernen. */
async function gigaZoneSchliessen(engine, pi, hi) {
  const ps = engine.gs.players[pi];
  const z = BASIS;
  for (let versuch = 0; versuch < KAPUTT_MAX; versuch++) {
    const sup = ps.supportZones[hi];
    if (sup.length <= z || (sup[z] || []).length === 0) break;
    const ziel = umziehbar(engine, pi, hi, z) ? freieZielZone(engine, pi, hi, z) : null;
    if (ziel != null) { zoneVerschieben(engine, pi, hi, z, ziel); engine.sync(); break; }
    if (!(await karteSenden(engine, pi, hi, null))) return false;
  }
  const sup = ps.supportZones[hi];
  if (sup.length > z && (sup[z] || []).length > 0) return false;
  if (sup.length > z) {
    sup.splice(z, 1);
    indizesVerschieben(engine, pi, hi, z + 1, -1);
    ps.islandZoneCount[hi] = Math.max(0, (ps.islandZoneCount[hi] || 0) - 1);
  }
  engine.log('zonen_welt_giga_zu', { hero: ps.heroes?.[hi]?.name, zonen: ps.supportZones[hi].length });
  return true;
}

/** Versiegelt EINE Grundzone (Fass-Platzhalter). Liefert den Index oder null. */
async function siegelSetzen(engine, pi, hi) {
  const ps = engine.gs.players[pi];
  for (let versuch = 0; versuch < KAPUTT_MAX; versuch++) {
    const sup = ps.supportZones[hi];
    const kand = [2, 1, 0].filter(z => z < sup.length && (sup[z] || [])[0] !== SIEGEL);
    if (kand.length === 0) return null;
    const leer = kand.find(z => (sup[z] || []).length === 0);
    if (leer != null) {
      sup[leer] = [SIEGEL];
      engine.log('zonen_welt_siegel', { hero: ps.heroes?.[hi]?.name, zone: leer });
      return leer;
    }
    // Alle Kandidaten belegt: eine Kreatur in eine freie Inselzone umsetzen …
    let frei = null;
    for (let z = BASIS; z < sup.length; z++) if ((sup[z] || []).length === 0) { frei = z; break; }
    if (frei != null) {
      const quelle = kand.find(z => umziehbar(engine, pi, hi, z));
      if (quelle != null) {
        zoneVerschieben(engine, pi, hi, quelle, frei);
        sup[quelle] = [SIEGEL];
        engine.log('zonen_welt_siegel', { hero: ps.heroes?.[hi]?.name, zone: quelle });
        engine.sync();
        return quelle;
      }
    }
    // … sonst MUSS eine Karte gehen. Ohne umziehbare Kreatur hilft nur eine Karte aus den Kandidatenzonen selbst.
    const hilft = frei != null && kand.some(z => umziehbar(engine, pi, hi, z));
    const gesendet = await karteSenden(engine, pi, hi, hilft ? null : new Set(kand));
    if (!gesendet) return null;
  }
  return null;
}

async function heldAbgleichen(engine, pi, hi, G, B) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || !Array.isArray(ps.supportZones?.[hi])) return;
  const st = zustand(ps, hi);
  // ★ W82 (Shipwrecked, Diver Helmet): ein Held, der „unaffected by Areas" ist, hat weder die Extra-Zone von Gigalopolis noch das Fass von Barrel Home.
  const ausgenommen = engine.heldIstVonAreasAusgenommen(pi, hi);
  const wunschGiga = ausgenommen ? 0 : Math.max(0, G - B);
  const wunschSiegel = ausgenommen ? 0 : Math.min(BASIS, Math.max(0, B - G));

  // Siegel prüfen (eine Zone, die nicht mehr den Platzhalter trägt, ist keins mehr)
  st.siegel = st.siegel.filter(z => (ps.supportZones[hi][z] || [])[0] === SIEGEL);

  // 1. Siegel lösen, die nicht mehr gebraucht werden
  while (st.siegel.length > wunschSiegel) {
    const z = st.siegel.pop();
    ps.supportZones[hi][z] = [];
    engine.log('zonen_welt_siegel_auf', { hero: hero.name, zone: z });
  }
  // 2. Gigalopolis-Zonen
  while (st.giga < wunschGiga) { gigaZoneAnlegen(engine, pi, hi); st.giga++; }
  while (st.giga > wunschGiga) {
    if (!(await gigaZoneSchliessen(engine, pi, hi))) break;
    st.giga--;
  }
  // 3. Siegel setzen
  while (st.siegel.length < wunschSiegel) {
    const z = await siegelSetzen(engine, pi, hi);
    if (z == null) break;
    st.siegel.push(z);
  }
}

/**
 * Gleicht die Support Zonen aller Helden mit den liegenden Areas ab. Idempotent.
 * @param {object} [opts] `ausser`: die Area-Instanz, die gerade das Brett verlässt (sie zählt nicht mehr mit); `ausserSchiff`: die Shipwrecked-Instanz, die gerade geht (W82)
 */
async function abgleichen(engine, opts = {}) {
  if (!engine?.gs?.players) return;
  if (opts.ausser) engine._weltZonenAusser = opts.ausser;
  if (opts.ausserSchiff) engine._shipwreckedAusser = opts.ausserSchiff;   // W82: eine Shipwrecked, die gerade geht, zaehlt fuer die Ausnahme nicht mehr
  if (engine._weltZonenLaeuft) { engine._weltZonenNochmal = true; return; }
  engine._weltZonenLaeuft = true;
  try {
    for (let runde = 0; runde < 4; runde++) {
      engine._weltZonenNochmal = false;
      const G = zaehle(engine, GIGA, engine._weltZonenAusser);
      const B = zaehle(engine, FASS, engine._weltZonenAusser);
      for (let pi = 0; pi < engine.gs.players.length; pi++) {
        const ps = engine.gs.players[pi];
        for (let hi = 0; hi < (ps?.heroes || []).length; hi++) await heldAbgleichen(engine, pi, hi, G, B);
      }
      if (!engine._weltZonenNochmal) break;
    }
  } finally {
    engine._weltZonenLaeuft = false;
    engine._weltZonenAusser = null;
    engine._shipwreckedAusser = null;
  }
  engine.sync();
}

module.exports = { GIGA, FASS, SIEGEL, abgleichen, zaehle };
