'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GETEILT: der „of Kings"-Archetyp (Schach) — v818
//
//  EINE Auslegungsstelle fuer alles, was die 16 Karten gemeinsam
//  brauchen (Als Rulings 6.9.):
//
//  • FAMILIE: „Queen of Kings [B]" und „Queen of Kings [W]" sind DIESELBE
//    Karte mit verschiedenen Effekten. `[B]`/`[W]` ist nur ein Hinweis
//    in der Datenbank. Namensbezuege („a "Pawn of Kings"") sind
//    Teilstring-Treffer (Als Regel 8.8.) und treffen damit beide Farben
//    von selbst; die Kopienzaehlung im Deckbuilder laeuft ueber
//    `familyName` (app-shared.jsx), die Bildzuordnung ueber
//    `variantOf` (server.js: `X [B]` → `X.png`, `X [W]` → `X.1.png`).
//  • „Board of Kings is on the board": ein Board BEIDER Seiten zaehlt.
//  • ADJAZENZ (Board of Kings): alle 9 Support Zones einer Seite als
//    EINE Reihe — Zone 3 von Held 1 ist Nachbar von Zone 1 von Held 2.
//  • DECKUNG (Board of Kings): NICHT rekursiv. Ein niedrigerer Nachbar
//    deckt, wenn der Effekt ihn selbst treffen koennte — der eigene
//    Schutz des Boards wird dabei ignoriert.
//  • LEVEL auf dem Brett = gedrucktes Level + `inst.counters.level`
//    (Delta, Rocky-Slime-Konvention).
//  • Queen [B] zaehlt auf dem Brett auch als Knight/Bishop/Rook; Queen
//    [W] nur, solange ein Board of Kings liegt. Das gilt fuer die
//    Zaehlungen dieser Familie (Als Ruling 6.9., Frage 18).
// ═══════════════════════════════════════════════════════════════════
const { hasCardType } = require('./_hooks');

const OF_KINGS = 'of Kings';
const BOARD  = 'Board of Kings';
const PAWN   = 'Pawn of Kings';
const KNIGHT = 'Knight of Kings';
const BISHOP = 'Bishop of Kings';
const ROOK   = 'Rook of Kings';
const QUEEN  = 'Queen of Kings';
const KASPEROV = 'Kasperov, the King of Kings';

// v875: Die Regel „[B]/[W] sind Kosmetik" gilt fuer den GANZEN Bestand,
// nicht nur fuer diesen Archetyp — sie steht deshalb in `_hooks`. Die
// beiden Namen hier bleiben als Fassade bestehen (die Kings-Skripte
// lesen sie), zeigen aber auf denselben Code.
const { baseCardName, cardVariantTag } = require('./_hooks');
const VARIANT_RE = /\s*\[(B|W)\]$/;

/** „Queen of Kings [W]" → „Queen of Kings". */
const familyName = baseCardName;

/** 'B' | 'W' | null */
const variantOf = cardVariantTag;

function isOfKingsName(name) {
  return typeof name === 'string' && name.includes(OF_KINGS);
}

/** Karte, deren NAME oder EFFEKTTEXT „of Kings" enthaelt (Knight [W]). */
function mentionsOfKings(cd) {
  if (!cd) return false;
  return isOfKingsName(cd.name) || String(cd.effect || '').includes(OF_KINGS);
}

function isOfKingsCreatureData(cd) {
  return !!cd && hasCardType(cd, 'Creature') && isOfKingsName(cd.name);
}

function boardOfKingsOnBoard(engine) {
  const az = engine?.gs?.areaZones || [];
  return az.some(z => Array.isArray(z) && z.includes(BOARD));
}

function boardOfKingsInstances(engine) {
  return (engine.cardInstances || []).filter(i => i.name === BOARD && i.zone === 'area');
}

function _cd(engine, inst) {
  return (engine.getEffectiveCardData && engine.getEffectiveCardData(inst))
    || engine._getCardDB()[inst.name] || null;
}

/** Kreaturen (inkl. Tokens) in Support Zones, die `pi` kontrolliert. */
function controlledCreatures(engine, pi) {
  const out = [];
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = _cd(engine, inst);
    if (!cd) continue;
    if (!hasCardType(cd, 'Creature') && !hasCardType(cd, 'Token')) continue;
    out.push(inst);
  }
  return out;
}

function ofKingsCreatures(engine, pi) {
  return controlledCreatures(engine, pi).filter(i => isOfKingsName(i.name));
}

/**
 * Zaehlt diese Instanz als `baseName` (z.B. 'Knight of Kings')?
 * Queen [B]: immer, solange ihre Effekte nicht stummgeschaltet sind.
 * Queen [W]: nur mit Board of Kings auf dem Brett.
 */
function instCountsAsName(engine, inst, baseName) {
  if (!inst?.name) return false;
  if (inst.name.includes(baseName)) return true;
  if (!inst.name.startsWith(QUEEN)) return false;
  if (![KNIGHT, BISHOP, ROOK].includes(baseName)) return false;
  if (inst.zone !== 'support') return false;
  if (typeof engine.isCreatureEffectSuppressed === 'function'
      && engine.isCreatureEffectSuppressed(inst)) return false;
  const v = variantOf(inst.name);
  if (v === 'B') return true;
  if (v === 'W') return boardOfKingsOnBoard(engine);
  return false;
}

function controlsNamed(engine, pi, baseName) {
  return controlledCreatures(engine, pi).some(i => instCountsAsName(engine, i, baseName));
}

/** Level einer Brettkarte: gedruckt + Delta. */
function boardLevel(engine, inst) {
  const cd = _cd(engine, inst);
  const printed = Number(cd?.level) || 0;
  return Math.max(0, printed + (Number(inst?.counters?.level) || 0));
}

function rowIndex(heroIdx, slot) { return heroIdx * 3 + slot; }

/** Nachbarzonen in der 9er-Reihe. */
function adjacentSlots(heroIdx, slot) {
  const r = rowIndex(heroIdx, slot);
  const out = [];
  for (const q of [r - 1, r + 1]) {
    if (q < 0 || q > 8) continue;
    out.push({ heroIdx: Math.floor(q / 3), slot: q % 3 });
  }
  return out;
}

/** Oberste sichtbare Support-Instanz dieses Platzes (keine verdeckte Nest-Schicht). */
function instAtSlot(engine, pi, heroIdx, slot) {
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.heroIdx !== heroIdx || inst.zoneSlot !== slot) continue;
    return inst;
  }
  return null;
}

function sourceOwnerOf(source) {
  if (!source || typeof source !== 'object') return null;
  const o = source.owner ?? source.controller;
  return (o === 0 || o === 1) ? o : null;
}

/**
 * Koennte `source` diese Kreatur ueberhaupt treffen — OHNE Board of
 * Kings? (Deckungsregel, nicht rekursiv.) Nur die statischen
 * Immunitaeten zaehlen: Omni-Immunitaet, `_oppEffectImmune`-Zaehler,
 * „untargetable by opponent" gegen diesen Quellbesitzer, laufende
 * Effekt-Immunitaet.
 */
function protectorAffectable(engine, inst, source) {
  if (engine.isOmniImmune?.(inst)) return false;
  const so = sourceOwnerOf(source);
  if (inst.counters?._oppEffectImmune && so != null && so !== (inst.controller ?? inst.owner)) return false;
  if (inst.counters?.untargetable_by_opponent && so != null
      && inst.counters.untargetable_by_opponent_pi === so) return false;
  if (engine.creatureHasEffectImmunity?.(inst)) return false;
  return true;
}

/**
 * BOARD OF KINGS — ist diese Kreatur gerade gedeckt?
 * „Creatures you control can't be chosen and are unaffected by your
 *  opponent's cards and effects while there is at least 1 Creature with
 *  a lower level in an adjacent Support Zone to them that can be chosen
 *  or affected by that card or effect."
 *
 * `sourceOwner` statt Quellobjekt, weil die Zielsammler nur den
 * Wirkenden kennen; `source` (optional) verfeinert die Deckungsfrage.
 */
function coveredByBoardOfKings(engine, inst, sourceOwner, source) {
  if (!inst || inst.zone !== 'support') return false;
  const controller = inst.controller ?? inst.owner;
  if (sourceOwner == null || sourceOwner === controller) return false;
  if (!boardOfKingsOnBoard(engine)) return false;
  const myLevel = boardLevel(engine, inst);
  for (const adj of adjacentSlots(inst.heroIdx, inst.zoneSlot)) {
    const n = instAtSlot(engine, controller, adj.heroIdx, adj.slot);
    if (!n) continue;
    const cd = _cd(engine, n);
    if (!cd || (!hasCardType(cd, 'Creature') && !hasCardType(cd, 'Token'))) continue;
    if (boardLevel(engine, n) >= myLevel) continue;
    if (!protectorAffectable(engine, n, source || { owner: sourceOwner })) continue;
    return true;
  }
  return false;
}

/**
 * `reduceCardLevel`-Fabrik: „This card's level in your hand is reduced
 * by the number of "of Kings" Creatures you control." Bauform Chaorc
 * Ruin Mourner — nur die Kopie mit der kleinsten ID traegt bei, sonst
 * multipliziert die Engine die Reduktion je Handkopie.
 */
function reduceLevelByOfKingsFactory(cardName) {
  return function reduceCardLevel(cardData, engine, ownerIdx, inst, _heroIdx, evalOpts) {
    if (!cardData || cardData.name !== cardName) return 0;
    if (evalOpts?.pileSide) return 0;
    const owned = (engine.cardInstances || []).filter(c =>
      c.name === cardName && c.zone === 'hand'
      && (c.controller ?? c.owner) === ownerIdx && !c.faceDown);
    if (owned.length === 0) return 0;
    const lowestId = owned.map(c => c.id).sort()[0];
    if (inst?.id !== lowestId) return 0;
    return ofKingsCreatures(engine, ownerIdx).length;
  };
}

function summonedThisTurn(engine, inst) {
  return inst?.turnPlayed === (engine.gs.turn || 0);
}

function freeZonesOfHero(engine, pi, heroIdx) {
  const zones = engine.gs.players[pi]?.supportZones?.[heroIdx] || [[], [], []];
  const out = [];
  for (let z = 0; z < 3; z++) if ((zones[z] || []).length === 0) out.push(z);
  return out;
}

/** Freie Zonen ALLER Spalten (auch tote/leere Helden — Platzieren). */
function freeZonesAll(engine, pi) {
  const out = [];
  for (let hi = 0; hi < 3; hi++) for (const z of freeZonesOfHero(engine, pi, hi)) out.push({ heroIdx: hi, slotIdx: z });
  return out;
}

/** Galerie-Eintraege aus Hand UND Deck (eindeutig je Name+Quelle). */
function collectHandAndDeck(engine, pi, filter, opts = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  const take = (name, source) => {
    const cd = cardDB[name];
    if (!cd || !filter(cd)) return;
    const key = `${source}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, source });
  };
  if (opts.hand !== false) for (const n of (ps.hand || [])) take(n, 'hand');
  if (opts.deck !== false && (typeof engine.pileOutAllowed !== 'function' || engine.pileOutAllowed(pi, 'deck'))) {
    for (const n of (ps.mainDeck || [])) take(n, 'deck');
  }
  return out;
}

/**
 * Entnahme/Rueckgabe laufen seit v820 ueber die Stapel-Schicht der
 * Engine (`takeFromPile` / `returnToPile`) — hier nur duenne Zuegel,
 * damit die 16 Karten eine Aufrufform behalten. Kein Splice hier.
 */
async function takeFromPile(engine, pi, source, name) {
  const taken = await engine.takeFromPile(pi, source, name, { sourceOwner: pi, shuffle: source === 'deck' });
  return taken ? taken.idx : -1;
}
function returnToPile(engine, pi, source, name) {
  engine.returnToPile(pi, source, name);
}

/**
 * Hand-oder-Deck-Wahl mit Galerie. Gibt `{ name, source }` oder null.
 * Eine einzige Option wird automatisch genommen, wenn `opts.auto`.
 */
async function pickFromHandOrDeck(engine, pi, entries, promptOpts = {}) {
  if (!entries.length) return null;
  if (entries.length === 1 && promptOpts.auto) return entries[0];
  const res = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: entries.map(e => ({ name: e.name, source: e.source })),
    title: promptOpts.title,
    description: promptOpts.description,
    confirmLabel: promptOpts.confirmLabel || '♟ Choose',
    cancellable: promptOpts.cancellable !== false,
    showCard: promptOpts.showCard,
  });
  if (!res || res.cancelled || !res.cardName) return null;
  return entries.find(e => e.name === res.cardName && (!res.source || e.source === res.source))
    || entries.find(e => e.name === res.cardName) || null;
}

/**
 * Kreatur aus Hand oder Deck PLATZIEREN (regardless of level, keine
 * Aktion, auch zu toten/Frozen/Stunned/Negated Helden) — Stapel-Schicht
 * `engine.placeFromPile` (v820): Sperren, Flug vom Deck, Rueckgabe bei
 * Fehlschlag liegen dort.
 */
async function placeFromHandOrDeck(engine, pi, entry, heroIdx, slotIdx, sourceName) {
  return engine.placeFromPile(pi, entry.source, entry.name, heroIdx, slotIdx, { source: sourceName, sourceOwner: pi });
}

/**
 * Kreatur aus Hand oder Deck BESCHWOEREN (echte Beschwoerung; Held +
 * Zone hat der Aufrufer geprueft) — Stapel-Schicht `engine.summonFromPile`.
 */
async function summonFromHandOrDeck(engine, pi, entry, heroIdx, slotIdx, sourceName, hookExtras = {}) {
  return engine.summonFromPile(pi, entry.source, entry.name, heroIdx, slotIdx, {
    source: sourceName, sourceOwner: pi, hookExtras: { _ofKingsSummon: true, ...hookExtras },
  });
}

/** Helden, mit denen `cd` regulaer beschworen werden koennte, samt freier Zonen. */
function summonZonesFor(engine, pi, cd) {
  const { canHeroSummon } = require('./_summon-eligibility');
  const out = [];
  const heroes = engine.gs.players[pi]?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    if (!canHeroSummon(engine, pi, hi, cd)) continue;
    for (const z of freeZonesOfHero(engine, pi, hi)) out.push({ heroIdx: hi, slotIdx: z });
  }
  return out;
}

async function pickZone(engine, pi, zones, title, description) {
  if (!zones.length) return null;
  if (zones.length === 1) return zones[0];
  const heroes = engine.gs.players[pi]?.heroes || [];
  const pick = await engine.promptGeneric(pi, {
    type: 'zonePick', title, description,
    zones: zones.map(z => ({
      heroIdx: z.heroIdx, slotIdx: z.slotIdx,
      label: `${heroes[z.heroIdx]?.name || `Column ${z.heroIdx + 1}`} — Slot ${z.slotIdx + 1}`,
    })),
    cancellable: true,
  });
  if (!pick || pick.cancelled || pick.heroIdx == null || pick.slotIdx == null) return null;
  return { heroIdx: pick.heroIdx, slotIdx: pick.slotIdx };
}

/**
 * CPU-Standardantwort fuer die Prompts dieser Familie (v828). Die Engine
 * bricht ABBRECHBARE Prompts fuer die CPU grundsaetzlich ab (plan-lose
 * Fenster, Barker-Bugklasse) — Galerie, Zonenwahl und Ja/Nein muessen
 * deshalb je Karte beantwortet werden. Jedes of-Kings-Skript ruft diese
 * Funktion am Ende seiner `cpuResponse`.
 */
function ofKingsCpuAnswer(engine, kind, payload) {
  if (kind !== 'generic' || !payload) return undefined;
  if (payload.type === 'confirm') return true;
  if (payload.type === 'cardGallery') {
    const cards = payload.cards || [];
    if (cards.length === 0) return null;
    // Hand vor Deck (Deck-Karten bleiben Nachschub), sonst erste.
    const pick = cards.find(c => c.source === 'hand') || cards[0];
    return { cardName: pick.name, source: pick.source };
  }
  if (payload.type === 'zonePick') {
    const zones = payload.zones || [];
    if (zones.length === 0) return null;
    return { heroIdx: zones[0].heroIdx, slotIdx: zones[0].slotIdx };
  }
  if (payload.type === 'optionPicker') {
    const opt = (payload.options || []).find(o => o.id !== 'cancel');
    return opt ? { optionId: opt.id } : null;
  }
  return undefined;
}

/** Hauptaktions-Slot dieses Helden frei (Action Phase, noch keine Aktion)? */
function mainActionSlotFree(engine, pi, heroIdx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || gs.currentPhase !== 3) return false;
  const acted = (ps.heroesActedThisTurn || []).length > 0;
  if (!acted) return true;
  if (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0) return true;
  if ((ps._bonusMainActions || 0) > 0 && (ps._actionsPlayedThisPhase || 0) === 1) return true;
  return false;
}

module.exports = {
  OF_KINGS, BOARD, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KASPEROV,
  familyName, variantOf, isOfKingsName, mentionsOfKings, isOfKingsCreatureData,
  boardOfKingsOnBoard, boardOfKingsInstances,
  controlledCreatures, ofKingsCreatures, instCountsAsName, controlsNamed,
  boardLevel, rowIndex, adjacentSlots, instAtSlot, sourceOwnerOf,
  protectorAffectable, coveredByBoardOfKings,
  reduceLevelByOfKingsFactory, summonedThisTurn,
  freeZonesOfHero, freeZonesAll, collectHandAndDeck, takeFromPile, returnToPile,
  pickFromHandOrDeck, placeFromHandOrDeck, summonFromHandOrDeck, summonZonesFor, pickZone,
  mainActionSlotFree, ofKingsCpuAnswer,
};
