'use strict';
// ═══════════════════════════════════════════
//  GETEILT: CPU-Wahl für „choose a card from your deck and send it to your discard pile" (gezielter Selbst-Mill)
//
//  Cute Nerd Magenta (Heldeneffekt) und Sky Shaman (Kreatureneffekt) fragen den Spieler per `cardGallery` nach EINER Karte aus dem Deck, die
//  in die Ablage wandert (`actionMillCards` mit `targetCardName`). Die Standardwahl der CPU für Galerien bewertet jede Karte als „läge sie
//  auf der Hand" — das GEGENTEIL dessen, was ein Mill will. Hier steht die richtige Wahl EINMAL (vorher stand sie in `cute-nerd-magenta.js`):
//  `evaluateState`-Delta — Karte aus dem Deck nehmen, auf die Ablage legen, bewerten, zurücklegen; die Karte mit dem größten Delta gewinnt.
//
//    cpuBesteMillKarte(engine, promptData, { source, ausschliessen })  → `{ cardName, source }` | undefined
//      `ausschliessen`: ein Kartenname, der nicht gewählt werden soll (Magenta: der gerade abgeworfene — sonst legt der Mill dieselbe Karte
//      ein zweites Mal ab und der Effekt bringt nur einen einzigen Namen in die Ablage).
//
//  Nie gewählt werden Karten mit `selfDeleteOnExternalDiscard` (Rebelliokai): sie gehen beim Mill direkt in den Gelöscht-Stapel — der
//  Auswerter bildet diese Umleitung nicht nach und würde sie überbewerten. Während MCTS-Rollouts (`_inMctsSim`) gilt die Standardwahl
//  (je Kandidat eine eigene Bewertung innerhalb eines Rollouts wäre O(N) zusätzliche Auswertungen). Karten dürfen ihren Mill-Nutzen
//  deklarieren: `cpuMeta.onMillBenefit` (Zahl oder `(engine, pi) => Zahl`, z. B. Mystery Box: „wenn gemillt, zieh 2").
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

function cpuBesteMillKarte(engine, promptData, { source, ausschliessen = null } = {}) {
  if (engine._inMctsSim) return undefined;
  const pi = engine._cpuPlayerIdx;
  const ps = engine.gs.players?.[pi];
  if (!ps) return undefined;
  const cards = promptData?.cards || [];
  if (!cards.length) return undefined;
  const evalState = engine._cpuEvaluateState;
  if (typeof evalState !== 'function') return undefined;
  const eligibleCards = cards.filter(c => {
    if (ausschliessen && c.name === ausschliessen) return false;
    const cs = loadCardEffect(c.name);
    if (cs?.selfDeleteOnExternalDiscard) return false;
    return true;
  });
  // Notfall: würde der Filter alles streichen (Deck nur aus der ausgeschlossenen Karte / Selbstlöschern), gilt der ganze Pool —
  // die CPU darf an einer unlösbaren Wahl nicht hängen bleiben.
  const pool = eligibleCards.length > 0 ? eligibleCards : cards;
  let best = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    const name = c.name;
    const _taken_idx = engine.takeFromPileSync(ps, 'deck', name, { source });   // v820: Stapel-Schicht
    if (!_taken_idx) continue;
    const idx = _taken_idx.idx;
    // Probeweise: die Ablage durch eine Kopie mit der Karte ersetzen und danach die ORIGINAL-Liste wieder einsetzen (kein push/pop am Stapel).
    const ablageVorher = ps.discardPile;
    ps.discardPile = [...ablageVorher, name];
    let score = -Infinity;
    try { score = evalState(pi); } catch {}
    ps.discardPile = ablageVorher;
    engine.returnToPile(ps, 'deck', name, idx);   // v820: Stapel-Schicht

    // Deklarierter Mill-Nutzen: das Delta oben sieht nur „Karte wanderte vom Deck in die Ablage", nicht das `onMill`-Ereignis.
    const cs = loadCardEffect(name);
    const benefit = cs?.cpuMeta?.onMillBenefit;
    let benefitValue = 0;
    if (typeof benefit === 'number') benefitValue = benefit;
    else if (typeof benefit === 'function') {
      try { benefitValue = benefit(engine, pi) || 0; } catch { benefitValue = 0; }
    }
    score += benefitValue;

    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) return undefined;
  return { cardName: best.name, source: best.source };
}

module.exports = { cpuBesteMillKarte };
