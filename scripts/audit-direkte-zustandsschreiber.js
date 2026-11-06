#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  AUDIT (nur berichtend, Exit 0): DIREKTE ZUSTANDSSCHREIBER IN KARTEN-SKRIPTEN
//
//  Anlass (W66c, Als Hintergrundfrage): „Ist es von der Architektur her sauber, wenn
//  manche Karten sich DIREKT ins Spiel bringen (Zustand im Skript schreiben) und andere
//  auf Primitive (`engine.action…`) zurückgreifen?"  Dieses Skript MISST, wie viele
//  Skripte welche Muster direkt verwenden — Entscheidungsgrundlage für
//  `docs/ARCHITEKTUR-ZUSTANDSSCHREIBER.md`.
//
//  Bewusst NICHT `check-*.js`: es färbt keinen Prüflauf rot und hat keine Baseline.
//  Wird aus einem Audit ein Ratchet (Option B im Dokument), entsteht daraus ein
//  `check-zustandsschreiber.js` mit eingefrorener Allowlist.
//
//  Was gezählt wird:  cards/effects/*.js (OHNE die Engine-Infrastruktur, s. INFRA) und server.js.
//    Gruppen:  Karten-Skripte (`name.js`)  ·  Bausteine (`_*-shared.js`)  ·  server.js
//  Kommentare werden ausgeblendet; Strings bleiben (Ereignisnamen stehen in Strings).
//  Es ist eine REGEX-Messung: Obergrenze (Fehlalarme bei gleichnamigen Feldern an
//  Hilfsobjekten möglich) und Untergrenze (Aliasse wie `const pile = ps.discardPile; pile.push()`
//  werden nicht erkannt). Die Größenordnung stimmt; zum Planen einer Migration `--list <KAT>`.
//
//  Aufruf:
//    node scripts/audit-direkte-zustandsschreiber.js                Bericht (Text)
//    node scripts/audit-direkte-zustandsschreiber.js --json         dasselbe als JSON
//    node scripts/audit-direkte-zustandsschreiber.js --list A1      alle Fundstellen einer Kategorie
//    node scripts/audit-direkte-zustandsschreiber.js --top 30       mehr als 15 Dateien je Kategorie
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');

// Ausgabe vollständig schreiben (große Pipes werden bei hartem `process.exit` abgeschnitten); Exit-Code bleibt immer 0.
function schreibeUndEnde(text) { process.stdout.write(text + '\n'); process.exitCode = 0; }

const args = process.argv.slice(2);
const ALS_JSON = args.includes('--json');
const listIdx = args.indexOf('--list');
const LISTE = listIdx >= 0 ? String(args[listIdx + 1] || '').toUpperCase() : null;
const topIdx = args.indexOf('--top');
const TOP = topIdx >= 0 ? Math.max(1, parseInt(args[topIdx + 1], 10) || 15) : 15;

// ── Was ist Engine-Infrastruktur (nicht gemessen)? ────────────────
// `_engine.js` ist die Zustandsschicht selbst; die übrigen sind Laufzeit-/Werkzeugdateien ohne Kartenlogik.
const INFRA = new Set([
  '_engine.js', '_hooks.js', '_loader.js', '_opp.js', '_cpu.js', '_card-db.js', '_decision-log.js', '_demo-recorder.js',
  '_train-recorder.js', '_gold-audit.js', '_deck-profile.js', '_hand-resolve.js', '_hand-interaction-registry.js',
  '_sc-tracking.js', '_charges.js', '_summon-eligibility.js', '_TEMPLATE.js',
]);

function gruppeVon(name) {
  if (name === 'server.js') return 'server';
  if (name.startsWith('_')) return 'baustein';
  return 'karte';
}
const GRUPPEN = ['karte', 'baustein', 'server'];
const GRUPPEN_NAME = { karte: 'Karten-Skripte', baustein: 'Bausteine (_*.js)', server: 'server.js' };

function ohneKommentare(src) {
  const leeren = (m) => m.replace(/[^\n]/g, ' ');
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, leeren)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1) => p1 + leeren(m.slice(p1.length)));
}

// ── Kategorien: Schreib-Muster (Zeilenweise, mehrere Treffer je Zeile zählen) ─────────────
const ZUW = String.raw`(?:=(?!=)|\+=|-=|\*=|\|\|=|\?\?=)`;
const STAPEL = String.raw`(?:discardPile|deletedPile|mainDeck|potionDeck|deck)`;
const MUTATOR = String.raw`(?:push|unshift|splice|shift|pop|sort|reverse|fill|copyWithin)`;
const ZONEN = String.raw`(?:supportZones|abilityZones|surpriseZones|areaZones|areaZone|permanentZones|equipmentZones)`;

// Initialisierungs-Zeilen (`if (!x.discardPile) x.discardPile = [];`, `x.discardPile = x.discardPile || [];`) sind keine Schreibzugriffe im Sinn der Messung.
const STAPEL_INIT = new RegExp(String.raw`if\s*\(\s*!\s*[\w.$?]+\.${STAPEL}\s*\)\s*[\w.$?]+\.${STAPEL}\s*=\s*\[\]\s*;?|[\w.$?]+\.${STAPEL}\s*=\s*[\w.$?]+\.${STAPEL}\s*(?:\|\||\?\?)\s*\[\]\s*;?`, 'g');

// Brett-Initialisierung (`if (!ps.supportZones[h]) ps.supportZones[h] = [[], [], []];`) ist kein Platzieren.
const ZONEN_INIT = new RegExp(String.raw`if\s*\(\s*!\s*[\w.$?]+\.(?:supportZones|abilityZones|surpriseZones|areaZones)\s*(?:\?\.)?\[[^\]\n]*\](?:\s*\[[^\]\n]*\])?\s*\)\s*[\w.$?]+\.(?:supportZones|abilityZones|surpriseZones|areaZones)\s*\[[^\]\n]*\](?:\s*\[[^\]\n]*\])?\s*=\s*\[(?:\s*\[\s*\]\s*,?)*\s*\]\s*;?`, 'g');

// Allgemeine Initialisierung eines Feldes (`if (!gs.hoptUsed) gs.hoptUsed = {};`, `if (!x.f) x.f = [];`) — kein Schreiben im Sinn der Messung.
const FELD_INIT = /if\s*\(\s*!\s*[\w.$?]+\.(\w+)\s*\)\s*[\w.$?]+\.\1\s*=\s*(?:\{\s*\}|\[\s*\]|new\s+\w+\([^)]*\)|0|false|null)\s*;?|([\w.$?]+)\.(\w+)\s*=\s*\2\.\3\s*(?:\|\||\?\?)\s*(?:\{\s*\}|\[\s*\]|0|false|null)\s*;?/g;

const KATEGORIEN = [
  // (a) Stapel
  { id: 'A1', gruppe: 'A', titel: 'Stapel-Schreiber: Ablage / Löschstapel', risiko: 'hoch', initRe: STAPEL_INIT, sicherRe: /handKartenBesitzerPs\s*\(|kartenBesitzerVon\s*\(/,
    res: [new RegExp(String.raw`\.(?:discardPile|deletedPile)\s*\.\s*${MUTATOR}\s*\(`, 'g'),
          new RegExp(String.raw`\.(?:discardPile|deletedPile)\s*${ZUW}`, 'g'),
          new RegExp(String.raw`\.(?:discardPile|deletedPile)\.length\s*=(?!=)`, 'g')] },
  { id: 'A2', gruppe: 'A', titel: 'Stapel-Schreiber: Deck / Potion Deck', risiko: 'hoch', initRe: STAPEL_INIT, sicherRe: /handKartenBesitzerPs\s*\(|kartenBesitzerVon\s*\(/,
    res: [new RegExp(String.raw`\.(?:mainDeck|potionDeck|deck)\s*\.\s*${MUTATOR}\s*\(`, 'g'),
          new RegExp(String.raw`\.(?:mainDeck|potionDeck|deck)\s*${ZUW}`, 'g'),
          new RegExp(String.raw`\.(?:mainDeck|potionDeck|deck)\.length\s*=(?!=)`, 'g')] },
  { id: 'A3', gruppe: 'A', titel: 'Stapel-Schreiber: Hand', risiko: 'hoch',
    res: [new RegExp(String.raw`\.hand\s*\.\s*${MUTATOR}\s*\(`, 'g'),
          new RegExp(String.raw`\.hand\s*${ZUW}`, 'g')] },
  // (b) Stats
  { id: 'B1', gruppe: 'B', titel: 'Stat-Schreiber: ATK (`.atk =/+=/-=`)', risiko: 'hoch',
    res: [new RegExp(String.raw`\.atk\s*${ZUW}`, 'g'), /\.atk\s*(?:\+\+|--)/g] },
  { id: 'B2', gruppe: 'B', titel: 'Stat-Schreiber: HP / Max-HP (Held und Kreatur)', risiko: 'hoch',
    res: [new RegExp(String.raw`\.(?:hp|maxHp|currentHp)\s*${ZUW}`, 'g'), /\.(?:hp|maxHp|currentHp)\s*(?:\+\+|--)/g] },
  { id: 'B3', gruppe: 'B', titel: 'Stat-Schreiber: Besiegt-/Schutz-/Negiert-Flaggen am Objekt', risiko: 'mittel',
    res: [new RegExp(String.raw`\.(?:defeated|dead|isDead|negated|alive|protected|immune|invulnerable)\s*${ZUW}`, 'g')] },
  // (c) Zonen / Brett
  { id: 'C1', gruppe: 'C', titel: 'Zonen-Schreiber: Zonenplatz zuweisen (`supportZones[h][z] = …`, ohne Initialisierungszeilen)', risiko: 'hoch', initRe: ZONEN_INIT,
    res: [new RegExp(String.raw`${ZONEN}\s*\[[^\]\n]*\]\s*\[[^\]\n]*\]\s*${ZUW}`, 'g'),
          new RegExp(String.raw`${ZONEN}\s*\[[^\]\n]*\]\s*${ZUW}`, 'g'),
          new RegExp(String.raw`\.${ZONEN}\s*=(?!=)`, 'g')] },
  { id: 'C2', gruppe: 'C', titel: 'Zonen-Schreiber: Zonenarray verändern (`.push/.splice/.pop` auf Zone)', risiko: 'hoch',
    res: [new RegExp(String.raw`${ZONEN}\s*\[[^\]\n]*\]\s*\[[^\]\n]*\]\s*\.\s*${MUTATOR}\s*\(`, 'g'),
          new RegExp(String.raw`${ZONEN}\s*\[[^\]\n]*\]\s*\.\s*${MUTATOR}\s*\(`, 'g')] },
  { id: 'C3', gruppe: 'C', titel: 'Brett-Schreiber: Heldenplatz (`heroes[i].name/.hp/.atk = …`, `heroes[i] = …`)', risiko: 'hoch',
    res: [new RegExp(String.raw`\bheroes\s*\[[^\]\n]*\]\s*\.\s*(?:name|id|cardName|ascended|baseAtk|baseHp)\s*${ZUW}`, 'g'),
          new RegExp(String.raw`\bheroes\s*\[[^\]\n]*\]\s*${ZUW}`, 'g')] },
  { id: 'C4', gruppe: 'C', titel: 'Brett-Buchführung von Hand: `engine._trackCard(…)` / `_untrackCard(…)` (Geister-Instanzen entstehen, wenn eine Seite fehlt)', risiko: 'mittel',
    res: [/\b(?:engine|eng)\s*\.\s*_(?:trackCard|untrackCard)\s*\(/g] },
  // (d) Limits / Stempel
  { id: 'D1', gruppe: 'D', titel: 'Limit-Schreiber: `hoptUsed[…] =` / `delete hoptUsed[…]`', risiko: 'hoch',
    res: [new RegExp(String.raw`hoptUsed\s*\[[^\]\n]*\]\s*${ZUW}`, 'g'), /delete\s+[\w.?]*hoptUsed\s*\[/g] },
  { id: 'D2', gruppe: 'D', titel: 'Limit-Schreiber: Once-per-Game / Zauber-Sperre / Zähler (`_oncePerGameUsed`, `_spellLockTurn`, `spellsPlayedThisTurn`, `oncePerTurn…`, `_usedThisTurn`)', risiko: 'hoch',
    res: [new RegExp(String.raw`\b(?:_spellLockTurn|spellsPlayedThisTurn|_usedThisTurn|usedThisTurn|oncePerTurn\w*|actionsRemaining|_extraActions\w*)\s*${ZUW}`, 'g'),
          /_oncePerGameUsed\s*\.\s*(?:add|delete|clear)\s*\(/g, /_oncePerGameUsed\s*=(?!=)/g,
          /\b(?:spellsPlayedThisTurn|_spellLockTurn)\s*(?:\+\+|--)/g] },
  // (e) Kosten
  { id: 'E1', gruppe: 'E', titel: 'Kosten-Schreiber: Gold (`ps.gold -=/+=/=`)', risiko: 'hoch',
    res: [new RegExp(String.raw`\.gold\s*${ZUW}`, 'g'), /\.gold\s*(?:\+\+|--)/g] },
  // (f) Sichtbarkeit / Streaming
  { id: 'F1', gruppe: 'F', titel: 'Sichtbarkeit: eigenes `card_reveal` (Bild einer Karte selbst senden; läuft über `_broadcastEvent` = durch den Puffer, kann die EIGENE Karte aber doppelt zeigen)', risiko: 'mittel',
    res: [/['"`]card_reveal['"`]/g] },
  { id: 'F2', gruppe: 'F', titel: 'Sichtbarkeit: eigener Pile-Flug (`play_pile_transfer`)', risiko: 'mittel',
    res: [/['"`]play_pile_transfer['"`]/g] },
  { id: 'F3', gruppe: 'F', titel: 'Sichtbarkeit: Leitung am Auftritts-Puffer vorbei (`io.to(…).emit`, `emitToOpponents` ohne Gs, `sendToSpectators`)', risiko: 'hoch',
    res: [/\bio\s*\.\s*to\s*\(/g, /\.io\s*\.\s*(?:to|emit)\s*\(/g, /\bemitToOpponents\s*\(/g, /\bsocket\s*\.\s*emit\s*\(/g] },
  // (g) Eigene Zonenschleifen
  { id: 'G1', gruppe: 'G', titel: 'Eigenbau „freie Zone": selbst definierte Funktion (`findFreeSlot`, `getFreeZones`, `hasFreeZone` …)', risiko: 'hoch',
    res: [/\b(?:function|const|let)\s+\w*(?:[Ff]ree|[Ee]mpty)\w*(?:Zone|Slot|Support)\w*\b/g,
          /\b(?:function|const|let)\s+\w*(?:Zone|Slot)\w*(?:Free|Empty)\w*\b/g],
    nurDefinition: true },
  { id: 'G2', gruppe: 'G', titel: 'Eigenbau „freie Zone": Schleife über `supportZones` mit `.length === 0` im selben 6-Zeilen-Fenster (Obergrenze: auch Lesezugriffe zu anderen Zwecken)', risiko: 'mittel',
    fenster: true },
  // (h) Engine-Interna — H1/H2 werden NACH dem Einlesen aus den Namenshäufigkeiten abgeleitet (s. unten)
  { id: 'H1', gruppe: 'H', titel: 'Engine-Interna, de facto öffentlich: `engine._name` mit Name in ≥10 Dateien (`_broadcastEvent`, `_delay`, `_getCardDB` …)', risiko: 'niedrig', abgeleitet: true },
  { id: 'H2', gruppe: 'H', titel: 'Engine-Interna, Langschwanz: `engine._name` mit Name in <10 Dateien (Spezialzugriffe, Kandidaten für öffentliche Primitive)', risiko: 'mittel', abgeleitet: true },
  // (i) Gemeinsamer Spielzustand direkt
  { id: 'I1', gruppe: 'I', titel: 'gs-Felder (öffentlich, ohne `_`) direkt beschreiben (`gs.phase =`, `gs.turn +=` …; ohne Initialisierungszeilen)', risiko: 'mittel', initRe: FELD_INIT,
    res: [new RegExp(String.raw`\b(?:gs|gameState)\s*\.\s*[A-Za-z]\w*\s*${ZUW}`, 'g')] },
  { id: 'I2', gruppe: 'I', titel: 'gs-Kramzustand (`gs._foo =`, `ps._foo =`, `inst._foo =`) – etablierte Kartenform (ohne Initialisierungszeilen)', risiko: 'niedrig', initRe: FELD_INIT,
    res: [new RegExp(String.raw`\b(?:gs|gameState|ps|oppPs|opp|hero|inst|card|counters)\s*\.\s*_[A-Za-z]\w*\s*${ZUW}`, 'g')] },
];

const GRUPPEN_TITEL = {
  A: '(a) Stapel-Schreiber', B: '(b) Stat-Schreiber', C: '(c) Zonen-/Brett-Schreiber', D: '(d) Limit-/Stempel-Schreiber',
  E: '(e) Kosten', F: '(f) Sichtbarkeit/Streaming', G: '(g) Eigene Zonenschleifen', H: '(h) Zugriff auf Engine-Interna',
  I: '(i) Direkter Spielzustand (Zusatzmessung)',
};

// ── Zentrale Primitive je Gruppe (werden gezählt: wie viele Skripte nutzen sie?) ──
const PRIMITIVE = {
  A: ['actionDiscardCards', 'actionDiscardHandCard', 'actionDiscardCardsAnimated', 'actionMillCards', 'actionRecycleCards', 'actionShuffleBackToDeck',
      'actionDeleteFromDeckAnimated', 'actionMoveCard', 'actionDestroyCard', 'sendBoardCardToDiscard', 'takeFromPile', 'takeFromPileSync', 'deleteFromPile',
      'summonFromPile', 'placeFromPile', 'addFromPileToHand', 'returnToPile', 'takeTop', 'reorderDeck', 'shuffleDeck', 'handKartenBesitzerPs', 'handZugang',
      'handZugangSync', 'handZugangRueckgabe', 'kartenBesitzerVon', 'addCardFromDiscardToHand', 'actionAddCardToHand', 'actionAddCardFromDeckToHand',
      'actionDrawCards', 'actionDrawCardsAnimated', 'actionDrawFromPotionDeck', 'actionStealFromHand', 'actionTransferCardToOppHand', 'tokenAbgang'],
  B: ['actionPermAtk', 'actionSetAtkGrant', 'actionGrantAtk', 'actionRevokeAtk', 'grantTempHeroAtk', 'increaseMaxHp', 'actionHealHero', 'actionHealCreature',
      'actionDealDamage', 'actionDealCreatureDamage', 'actionDealTrueDamage', 'dealDamageToTargets', 'actionAoeHit', 'actionDefeat', 'actionDefeatHero',
      'actionDestroyCard', 'actionReviveHero', 'actionAddBuff', 'actionAddCreatureBuff', 'actionAddStatus', 'addHeroStatus', 'applyCreatureStatus',
      'ctx.dealDamage', 'ctx.grantAtk', 'ctx.aoeHit', 'ctx.revokeAtk'],
  C: ['actionPlaceCreature', 'safePlaceInSupport', 'summonCreatureWithHooks', 'summonFromDiscard', 'beschwoerZonenFuer', 'hatBeschwoerZone',
      'ersteBeschwoerZone', 'getFreeSupportZones', 'eligibleSummonZones', 'zoneEintragen', 'actionTransferCreature', 'actionStealCreature', 'actionMoveCard',
      'placeArea', 'actionAttachHeroToCreature', 'returnSupportCreatureToHand', 'actionTakeHeroPermanently', 'actionStealHero', 'actionTransferAttachment'],
  D: ['heroHoptKey', 'heldenSperreKey', 'heldenSperreFreigeben', 'claimHOPT', 'oncePerGameEffectUsed', 'markOncePerGameEffect', '_hoptAbzug', '_hoptWiederherstellen'],
  E: ['actionSpendGold', 'actionGainGold', 'actionSetGold', 'actionStealGold', 'canAffordGold', 'goldBudget'],   // (`payActivationCost`/`paySummonCost`/`payArtifactCost` sind Skript-Hooks, keine Engine-Primitive)
  F: ['commitAppearance', 'emitToOpponentsGs', 'sendToSpectators', 'revealToOpponent', 'revealSearchedCards', 'revealTop', 'revealHandCopy', '_broadcastEvent'],
  G: ['beschwoerZonenFuer', 'hatBeschwoerZone', 'ersteBeschwoerZone', 'getFreeSupportZones', 'eligibleSummonZones', 'zoneEintragen', 'mitGeteilten', 'geteiltZuerst',
      'firstFreeSupportSlot', 'freeSlotOnHero', 'teilbarZiel', 'canShareInto'],
  H: [],
  I: [],
};
// Gruppen, in denen `_broadcastEvent` nur INFORMATION ist (offizieller Engpass, läuft durch den Auftritts-Puffer).

// ── Einlesen ──────────────────────────────────────────────────────
const dateien = [];
for (const f of fs.readdirSync(EFFEKTE).sort()) {
  if (!f.endsWith('.js') || INFRA.has(f)) continue;
  dateien.push({ name: f, pfad: path.join(EFFEKTE, f), anzeige: 'cards/effects/' + f, gruppe: gruppeVon(f) });
}
dateien.push({ name: 'server.js', pfad: path.join(WURZEL, 'server.js'), anzeige: 'server.js', gruppe: 'server' });

function fensterTreffer(zeilen) {
  // Schleife/Suche über supportZones und im selben 6-Zeilen-Fenster eine „leer"-Prüfung.
  const treffer = [];
  for (let i = 0; i < zeilen.length; i++) {
    if (!/\bsupportZones\b/.test(zeilen[i])) continue;
    if (!/\b(?:for|while)\b|\.(?:find|findIndex|some|every|filter|forEach|map)\s*\(/.test(zeilen[i] + (zeilen[i + 1] || ''))) continue;
    const fenster = zeilen.slice(i, i + 6).join('\n');
    if (/\.length\s*===?\s*0\b|!\s*\(?\s*\w+(?:\[[^\]]*\])*\.length\b|\.length\s*<\s*1\b/.test(fenster)) treffer.push(i);
  }
  return treffer;
}

const ergebnis = {};      // kat -> { dateien: Map(datei -> n), stellen: [{datei, zeile, text}] }
for (const k of KATEGORIEN) ergebnis[k.id] = { dateien: new Map(), stellen: [], sicher: new Map() };
const primitivNutzung = {};   // gruppe -> name -> Set(Dateien)
for (const g of Object.keys(PRIMITIVE)) { primitivNutzung[g] = {}; for (const p of PRIMITIVE[g]) primitivNutzung[g][p] = new Set(); }
const privatJeDatei = new Map();   // datei -> Map(name -> n)
const privatNamen = new Map();   // engine._name -> { n, dateien:Set }
const dateiHat = new Map();      // datei -> Set(kategorien)
const dateiGruppe = new Map();
const zahlKartenMitEngine = { karte: 0, baustein: 0, server: 0 };
const zahlDateien = { karte: 0, baustein: 0, server: 0 };
const zeilenSumme = { karte: 0, baustein: 0, server: 0 };

for (const d of dateien) {
  let roh;
  try { roh = fs.readFileSync(d.pfad, 'utf8'); } catch { continue; }
  const code = ohneKommentare(roh);
  const zeilen = code.split('\n');
  zahlDateien[d.gruppe]++;
  zeilenSumme[d.gruppe] += zeilen.length;
  dateiGruppe.set(d.anzeige, d.gruppe);
  if (/\b(?:engine|_engine)\b/.test(code)) zahlKartenMitEngine[d.gruppe]++;

  for (const k of KATEGORIEN) {
    if (k.abgeleitet) continue;
    if (k.fenster) {
      for (const i of fensterTreffer(zeilen)) {
        ergebnis[k.id].dateien.set(d.anzeige, (ergebnis[k.id].dateien.get(d.anzeige) || 0) + 1);
        ergebnis[k.id].stellen.push({ datei: d.anzeige, zeile: i + 1, text: zeilen[i].trim().slice(0, 140) });
        if (!dateiHat.has(d.anzeige)) dateiHat.set(d.anzeige, new Set());
        dateiHat.get(d.anzeige).add(k.id);
      }
      continue;
    }
    let n = 0;
    for (let i = 0; i < zeilen.length; i++) {
      let z = zeilen[i];
      if (!z) continue;
      if (k.initRe) { z = z.replace(k.initRe, ' '); }
      let hier = 0;
      for (const re of k.res) { re.lastIndex = 0; const m = z.match(re); if (m) hier += m.length; }
      if (!hier) continue;
      // Doppelzählung innerhalb einer Zeile vermeiden (zwei Muster treffen denselben Ausdruck, z. B. C1 mit 2 und 1 Index): je Zeile höchstens max(Treffer eines Musters)
      let maxEin = 0;
      for (const re of k.res) { re.lastIndex = 0; const m = z.match(re); if (m && m.length > maxEin) maxEin = m.length; }
      hier = maxEin || hier;
      n += hier;
      const sicher = !!(k.sicherRe && k.sicherRe.test(z));
      if (sicher) ergebnis[k.id].sicher.set(d.anzeige, (ergebnis[k.id].sicher.get(d.anzeige) || 0) + hier);
      ergebnis[k.id].stellen.push({ datei: d.anzeige, zeile: i + 1, text: (sicher ? '[Besitzer-Helfer] ' : '') + z.trim().slice(0, 140) });
    }
    if (n) {
      ergebnis[k.id].dateien.set(d.anzeige, n);
      if (!dateiHat.has(d.anzeige)) dateiHat.set(d.anzeige, new Set());
      dateiHat.get(d.anzeige).add(k.id);
    }
  }

  // Engine-Interna: Namen zählen
  for (const m of code.matchAll(/(?:\bctx\s*\.\s*_engine|\bengine|\beng|\b_engine)\s*\.\s*(_[A-Za-z]\w*)/g)) {
    if (!privatNamen.has(m[1])) privatNamen.set(m[1], { n: 0, dateien: new Set() });
    const e = privatNamen.get(m[1]); e.n++; e.dateien.add(d.anzeige);
    if (!privatJeDatei.has(d.anzeige)) privatJeDatei.set(d.anzeige, new Map());
    const pm = privatJeDatei.get(d.anzeige); pm.set(m[1], (pm.get(m[1]) || 0) + 1);
  }

  // Primitive: Aufrufe zählen
  for (const g of Object.keys(PRIMITIVE)) {
    for (const p of PRIMITIVE[g]) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(String.raw`(?:^|[^\w$])${esc}\s*\(`);
      if (re.test(code)) primitivNutzung[g][p].add(d.anzeige);
    }
  }
}

// ── H1/H2 ableiten: de-facto-öffentliche Interna (Name in ≥10 Dateien) vs. Langschwanz ──
const SCHWELLE_API = 10;
for (const id of ['H1', 'H2']) ergebnis[id] = { dateien: new Map(), stellen: [] };
for (const [datei, namen] of privatJeDatei) {
  for (const [name, n] of namen) {
    const id = privatNamen.get(name).dateien.size >= SCHWELLE_API ? 'H1' : 'H2';
    ergebnis[id].dateien.set(datei, (ergebnis[id].dateien.get(datei) || 0) + n);
    ergebnis[id].stellen.push({ datei, zeile: 0, text: `engine.${name} ×${n}` });
    if (!dateiHat.has(datei)) dateiHat.set(datei, new Set());
    dateiHat.get(datei).add(id);
  }
}

// ── Existieren die genannten Primitive wirklich auf der Engine? (Selbstprüfung der Messliste) ──
let engineMethoden = null;
try {
  const { GameEngine } = require(path.join(EFFEKTE, '_engine.js'));
  engineMethoden = new Set(Object.getOwnPropertyNames(GameEngine.prototype).filter(n => typeof GameEngine.prototype[n] === 'function' && n !== 'constructor'));
} catch (e) { engineMethoden = null; }
const MIT_PREFIX = (p) => p.startsWith('ctx.');
// Wo ist ein Primitiv zu Hause? 'Engine' (Methode auf GameEngine) oder die Datei, die es definiert (Baustein/server.js); null = nirgends gefunden.
const quellen = new Map();
function quelle(f) { if (!quellen.has(f)) { try { quellen.set(f, ohneKommentare(fs.readFileSync(f, 'utf8'))); } catch { quellen.set(f, ''); } } return quellen.get(f); }
const alleDateien = [...fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js')).map(f => path.join(EFFEKTE, f)), path.join(WURZEL, 'server.js')];
const ortCache = new Map();
function ortVon(name) {
  if (ortCache.has(name)) return ortCache.get(name);
  let ort = null;
  if (MIT_PREFIX(name)) ort = 'ctx';
  else if (engineMethoden && engineMethoden.has(name)) ort = 'Engine';
  else {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(String.raw`function\s+${esc}\b|\b${esc}\s*[:=]\s*(?:async\s*)?(?:function|\()|^\s*(?:async\s+)?${esc}\s*\([^)\n]*\)\s*\{`, 'm');
    for (const f of alleDateien) { if (re.test(quelle(f))) { const b = path.basename(f); ort = (b.startsWith('_') || b === 'server.js') ? b : 'lokal im Skript'; break; } }
  }
  ortCache.set(name, ort);
  return ort;
}

// ── Auswertung ────────────────────────────────────────────────────
function nachGruppe(map) {
  const r = { karte: { dateien: 0, stellen: 0 }, baustein: { dateien: 0, stellen: 0 }, server: { dateien: 0, stellen: 0 } };
  for (const [datei, n] of map) { const g = dateiGruppe.get(datei); r[g].dateien++; r[g].stellen += n; }
  return r;
}
function topDateien(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([datei, anz]) => ({ datei, gruppe: dateiGruppe.get(datei), stellen: anz }));
}

const bericht = {
  erzeugt: new Date().toISOString().slice(0, 10),
  umfang: {
    karten_skripte: zahlDateien.karte, bausteine: zahlDateien.baustein, server_js: zahlDateien.server,
    zeilen: zeilenSumme, infra_ausgenommen: [...INFRA].filter(f => fs.existsSync(path.join(EFFEKTE, f))),
    engine_methoden: engineMethoden ? { gesamt: engineMethoden.size, oeffentlich: [...engineMethoden].filter(n => !n.startsWith('_')).length,
      privat: [...engineMethoden].filter(n => n.startsWith('_')).length, action_primitive: [...engineMethoden].filter(n => /^action[A-Z]/.test(n)).length } : null,
    skripte_die_die_engine_ansprechen: zahlKartenMitEngine,
  },
  kategorien: {},
  gruppen: {},
  gesamt: {},
};

for (const k of KATEGORIEN) {
  const e = ergebnis[k.id];
  const g = nachGruppe(e.dateien);
  bericht.kategorien[k.id] = {
    gruppe: k.gruppe, titel: k.titel, risiko: k.risiko,
    dateien: e.dateien.size, stellen: [...e.dateien.values()].reduce((a, b) => a + b, 0),
    nach_gruppe: g, top: topDateien(e.dateien, TOP),
    ...(k.sicherRe ? { davon_ueber_besitzer_helfer_in_zeile: { stellen: [...e.sicher.values()].reduce((a, b) => a + b, 0), dateien: e.sicher.size } } : {}),
  };
}

for (const g of Object.keys(GRUPPEN_TITEL)) {
  const ids = KATEGORIEN.filter(k => k.gruppe === g).map(k => k.id);
  const dsatz = new Set();
  let stellen = 0;
  for (const id of ids) { for (const [datei, n] of ergebnis[id].dateien) { dsatz.add(datei); stellen += n; } }
  const nutz = Object.entries(primitivNutzung[g] || {}).map(([name, set]) => {
    return { primitiv: name, ort: ortVon(name), skripte: set.size, karten: [...set].filter(x => dateiGruppe.get(x) === 'karte').length };
  }).sort((a, b) => b.skripte - a.skripte);
  const primDateien = new Set();
  for (const p of Object.keys(primitivNutzung[g] || {})) { if (p === '_broadcastEvent') continue; for (const x of primitivNutzung[g][p]) primDateien.add(x); }
  bericht.gruppen[g] = {
    titel: GRUPPEN_TITEL[g], kategorien: ids, dateien_mit_direktem_schreiber: dsatz.size, stellen,
    dateien_nach_gruppe: (() => { const r = { karte: 0, baustein: 0, server: 0 }; for (const x of dsatz) r[dateiGruppe.get(x)]++; return r; })(),
    primitive: nutz, skripte_mit_primitiv_aus_der_liste: primDateien.size,
    mischung: (() => { let beides = 0; for (const x of dsatz) if (primDateien.has(x)) beides++; return { nur_schreiber: dsatz.size - beides, gemischt: beides, nur_primitiv: primDateien.size - beides }; })(),
  };
}

// Gesamtbild.  „Schreiber im engeren Sinn" = Skript schreibt Spielzustand direkt (Stapel, Stats, Zonen, Limits, Gold).
// „Weit" = dazu Sichtbarkeit am Puffer vorbei (F3), Eigenbau freie Zone (G1/G2), Brett-Buchführung von Hand (C4), Flaggen (B3), eigener Pile-Flug/Reveal (F1/F2).
const ENG = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2', 'E1'];
const WEIT = [...ENG, 'B3', 'C4', 'F1', 'F2', 'F3', 'G1', 'G2'];
const vereinigung = (ids) => { const s = new Set(); for (const id of ids) for (const d of ergebnis[id].dateien.keys()) s.add(d); return s; };
const engDateien = vereinigung(ENG);
const weitDateien = vereinigung(WEIT);
const zaehle = (set, g) => [...set].filter(d => dateiGruppe.get(d) === g).length;
const proDatei = (ids, set) => { const v = {}; for (const d of set) { const n = [...dateiHat.get(d)].filter(id => ids.includes(id)).length; v[n] = (v[n] || 0) + 1; } return v; };
const h1 = vereinigung(['H1', 'H2']);
const h2 = ergebnis.H2.dateien;
const prozent = (n) => +(100 * n / Math.max(1, zahlDateien.karte)).toFixed(1);
bericht.gesamt = {
  schreiber_eng_kategorien: ENG,
  schreiber_weit_kategorien: WEIT,
  eng: { karten: zaehle(engDateien, 'karte'), bausteine: zaehle(engDateien, 'baustein'), server: zaehle(engDateien, 'server'), anteil_karten_prozent: prozent(zaehle(engDateien, 'karte')) },
  weit: { karten: zaehle(weitDateien, 'karte'), bausteine: zaehle(weitDateien, 'baustein'), server: zaehle(weitDateien, 'server'), anteil_karten_prozent: prozent(zaehle(weitDateien, 'karte')) },
  verteilung_kategorien_je_datei_eng: proDatei(ENG, engDateien),
  karten_ohne_schreiber_eng: zahlDateien.karte - zaehle(engDateien, 'karte'),
  karten_ohne_schreiber_weit: zahlDateien.karte - zaehle(weitDateien, 'karte'),
  engine_interna: { dateien_karten: zaehle(h1, 'karte'), dateien_bausteine: zaehle(h1, 'baustein'), namen: privatNamen.size,
    namen_de_facto_api: [...privatNamen.values()].filter(e => e.dateien.size >= SCHWELLE_API).length,
    namen_langschwanz: [...privatNamen.values()].filter(e => e.dateien.size < SCHWELLE_API).length,
    karten_mit_langschwanz: zaehle(new Set(h2.keys()), 'karte') },
  engine_interna_top: [...privatNamen.entries()].sort((a, b) => b[1].dateien.size - a[1].dateien.size).slice(0, TOP)
    .map(([name, e]) => ({ name, aufrufe: e.n, dateien: e.dateien.size, ort: ortVon(name) || 'Eigenschaft/Feld' })),
  engine_interna_langschwanz_top: [...privatNamen.entries()].filter(([, e]) => e.dateien.size < SCHWELLE_API).sort((a, b) => b[1].dateien.size - a[1].dateien.size || a[0].localeCompare(b[0])).slice(0, TOP)
    .map(([name, e]) => ({ name, aufrufe: e.n, dateien: e.dateien.size, ort: ortVon(name) || 'Eigenschaft/Feld' })),
  // Ratchet-Größe: Zahl der (Datei, Kategorie)-Paare, die eine Allowlist festschreiben müsste
  allowlist_paare_eng: ENG.reduce((a, id) => a + ergebnis[id].dateien.size, 0),
  allowlist_paare_weit: WEIT.reduce((a, id) => a + ergebnis[id].dateien.size, 0),
};

if (LISTE) {
  const k = ergebnis[LISTE];
  if (!k) { console.error('Unbekannte Kategorie: ' + LISTE + ' (bekannt: ' + KATEGORIEN.map(x => x.id).join(', ') + ')'); return; }
  schreibeUndEnde(k.stellen.map(s => `${s.datei}:${s.zeile}: ${s.text}`).join('\n') + `\n\n${LISTE}: ${k.stellen.length} Stelle(n) in ${k.dateien.size} Datei(en).`);
  return;
}

if (ALS_JSON) { schreibeUndEnde(JSON.stringify(bericht, null, 2)); return; }

// ── Textbericht ───────────────────────────────────────────────────
const L = [];
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
L.push('AUDIT: direkte Zustandsschreiber in Karten-Skripten (nur berichtend)  —  ' + bericht.erzeugt);
L.push('═'.repeat(100));
L.push(`Umfang: ${zahlDateien.karte} Karten-Skripte (${zeilenSumme.karte} Zeilen), ${zahlDateien.baustein} Bausteine _*.js (${zeilenSumme.baustein} Z.), server.js (${zeilenSumme.server} Z.).`);
L.push(`Nicht gemessen (Engine-Infrastruktur): ${bericht.umfang.infra_ausgenommen.join(', ')}`);
if (bericht.umfang.engine_methoden) {
  const m = bericht.umfang.engine_methoden;
  L.push(`Engine: ${m.gesamt} Methoden (${m.oeffentlich} öffentlich, ${m.privat} mit Unterstrich; ${m.action_primitive} \`action…\`-Primitive).`);
}
L.push(`Skripte, die \`engine\` überhaupt ansprechen: Karten ${zahlKartenMitEngine.karte}/${zahlDateien.karte}, Bausteine ${zahlKartenMitEngine.baustein}/${zahlDateien.baustein}.`);
L.push('');
L.push('GESAMTBILD');
{
  const G = bericht.gesamt;
  L.push(`  Schreiber im ENGEREN Sinn (${G.schreiber_eng_kategorien.join(', ')}: Stapel, Stats, Zonen, Limits, Gold):`);
  L.push(`      Karten-Skripte mit ≥1 direktem Schreiber:  ${G.eng.karten} von ${zahlDateien.karte}  (${G.eng.anteil_karten_prozent} %);  Bausteine ${G.eng.bausteine} von ${zahlDateien.baustein};  server.js ${G.eng.server ? 'ja' : 'nein'}`);
  L.push(`      Karten-Skripte ganz ohne:                  ${G.karten_ohne_schreiber_eng}`);
  L.push(`      Kategorien je Datei (Anzahl → Dateien):    ${Object.entries(G.verteilung_kategorien_je_datei_eng).sort((a, b) => a[0] - b[0]).map(([n, c]) => n + '→' + c).join('  ')}`);
  L.push(`  Im WEITEREN Sinn (+ ${G.schreiber_weit_kategorien.filter(x => !G.schreiber_eng_kategorien.includes(x)).join(', ')}: Flaggen, Brett-Buchführung, eigener Reveal/Flug, Leitung, Eigenbau „freie Zone"):`);
  L.push(`      Karten-Skripte:                            ${G.weit.karten} von ${zahlDateien.karte}  (${G.weit.anteil_karten_prozent} %);  Bausteine ${G.weit.bausteine};  ganz ohne: ${G.karten_ohne_schreiber_weit}`);
  L.push(`  Engine-Interna (\`engine._…\`): ${G.engine_interna.dateien_karten} Karten-Skripte, ${G.engine_interna.dateien_bausteine} Bausteine; ${G.engine_interna.namen} verschiedene private Namen — ${G.engine_interna.namen_de_facto_api} in ≥${SCHWELLE_API} Dateien (de facto API), ${G.engine_interna.namen_langschwanz} im Langschwanz (${G.engine_interna.karten_mit_langschwanz} Karten-Skripte berühren ihn)`);
  L.push(`  Ratchet-Größe (Datei×Kategorie-Paare):         eng ${G.allowlist_paare_eng}  ·  weit ${G.allowlist_paare_weit}`);
}
L.push('');

for (const g of Object.keys(GRUPPEN_TITEL)) {
  const G = bericht.gruppen[g];
  L.push('━'.repeat(100));
  L.push(`${G.titel}   —   ${G.dateien_mit_direktem_schreiber} Datei(en), ${G.stellen} Fundstelle(n)   [Karten ${G.dateien_nach_gruppe.karte} · Bausteine ${G.dateien_nach_gruppe.baustein} · server.js ${G.dateien_nach_gruppe.server}]`);
  for (const id of G.kategorien) {
    const K = bericht.kategorien[id];
    L.push('');
    L.push(`  ${id}  ${K.titel}   [Risiko ${K.risiko}]`);
    L.push(`      Dateien ${rpad(K.dateien, 4)}  (Karten ${K.nach_gruppe.karte.dateien}, Bausteine ${K.nach_gruppe.baustein.dateien}, server.js ${K.nach_gruppe.server.dateien})   Fundstellen ${rpad(K.stellen, 5)}  (Karten ${K.nach_gruppe.karte.stellen}, Bausteine ${K.nach_gruppe.baustein.stellen}, server.js ${K.nach_gruppe.server.stellen})`);
    if (K.davon_ueber_besitzer_helfer_in_zeile) L.push(`      davon in derselben Zeile über Besitzer-Helfer (\`handKartenBesitzerPs\`/\`kartenBesitzerVon\`): ${K.davon_ueber_besitzer_helfer_in_zeile.stellen} Stellen in ${K.davon_ueber_besitzer_helfer_in_zeile.dateien} Dateien  →  ohne Helfer in der Zeile: ${K.stellen - K.davon_ueber_besitzer_helfer_in_zeile.stellen} (Obergrenze der „nackten" Stellen)`);
    if (K.top.length) {
      L.push(`      Häufigste Dateien:`);
      for (const t of K.top) L.push(`        ${rpad(t.stellen, 4)}  ${t.datei}${t.gruppe === 'karte' ? '' : '   [' + GRUPPEN_NAME[t.gruppe] + ']'}`);
    }
  }
  if (g === 'H') {
    L.push('');
    L.push(`  Häufigste private Engine-Namen (de facto die öffentliche API — der Unterstrich ist keine Grenze):`);
    for (const t of bericht.gesamt.engine_interna_top) L.push(`        ${rpad(t.dateien, 4)} Dateien / ${rpad(t.aufrufe, 4)} Stellen  engine.${t.name}${t.ort === 'Eigenschaft/Feld' ? '   (Feld, keine Methode)' : ''}`);
    L.push('');
    L.push(`  Langschwanz: ${bericht.gesamt.engine_interna_langschwanz_namen} Namen in <${SCHWELLE_API} Dateien (die häufigsten ${TOP}; jeder ist ein Kandidat für ein öffentliches Primitiv bzw. ein Zeichen für eine Lücke im Primitiv-Satz):`);
    for (const t of bericht.gesamt.engine_interna_langschwanz_top) L.push(`        ${rpad(t.dateien, 4)} Dateien / ${rpad(t.aufrufe, 4)} Stellen  engine.${t.name}${t.ort === 'Eigenschaft/Feld' ? '   (Feld)' : ''}`);
  }
  if (G.primitive.length) {
    L.push('');
    L.push(`  Zentrale Primitive dieser Gruppe — Nutzung (Skripte; davon Karten):  [${G.skripte_mit_primitiv_aus_der_liste} Skripte nutzen ≥1 Primitiv der Liste (ohne _broadcastEvent)]`);
    L.push(`      Mischung: ${G.mischung.nur_primitiv} Skripte nur Primitive · ${G.mischung.gemischt} Primitive UND direkter Schreiber · ${G.mischung.nur_schreiber} nur direkter Schreiber`);
    for (const p of G.primitive.filter(x => x.skripte > 0 || x.ort === null)) {
      L.push(`        ${rpad(p.skripte, 4)} (${rpad(p.karten, 4)})  ${p.primitiv}${p.ort === null ? '   (NIRGENDS definiert – Messliste anpassen)' : (p.ort === 'Engine' || p.ort === 'ctx' ? '' : '   [' + p.ort + ']')}`);
    }
    const ungenutzt = G.primitive.filter(x => x.skripte === 0 && x.ort !== null).map(x => x.primitiv);
    if (ungenutzt.length) L.push(`        ungenutzt in Skripten: ${ungenutzt.join(', ')}`);
  }
  L.push('');
}
L.push('Hinweis: Regex-Messung (Ober-/Untergrenze, s. Kopfkommentar). Fundstellen einer Kategorie: --list <A1|A2|…>; JSON: --json.');
schreibeUndEnde(L.join('\n'));
