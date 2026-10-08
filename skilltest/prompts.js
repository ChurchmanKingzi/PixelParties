'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — ANTWORTEN DER BOTS AUF AUSWAHL-ABFRAGEN VON ZAUBERN
//
//  Die Engine lehnt für CPU-Sitze jede abbrechbare Abfrage ab. Ein Zauber, dessen Wirkung eine Auswahl verlangt (Karten aus der Ablage
//  zurückholen, einen Kartennamen ansagen, ein Artifact suchen), fällt dadurch nach dem Ausspielen in sich zusammen („Spell cancelled“).
//  In einer Messung über 180 Partien scheiterten so Spontaneous Reappearance (161 Versuche, kein Erfolg), Spreading Rumor (126), Gate to the
//  Armory (118), Accusation (67) und Raise the Minions! (72). Hier stehen die Antworten für genau diese Abfragen (ausdrückliche Liste: eine
//  unbekannte Abfrage zu „beantworten“ könnte Karten kosten).
//
//  Die Standard-CPU der Engine (_cpu.js) hat dafür eigene Logik, ist aber auf zwei Spieler gebaut — hier das Nötige für N Spieler.
// ═══════════════════════════════════════════════════════════════════
const { getCardDB } = require('../cards/effects/_card-db');

const TITLES = new Set(['Spontaneous Reappearance', 'Raise the Minions!', 'Gate to the Armory', 'Spreading Rumor', 'Accusation']);
const TYPES = new Set(['cardNamePicker', 'cardGallery', 'cardGalleryMulti']);
const REAPPEAR_MAX = 3;                 // Spontaneous Reappearance legt je 2 Karten einen Pollution Token ab — mehr als 3 holt der Bot nicht zurück

/** Beantwortet der Bot diese Abfrage selbst? */
function handles(pd) { return !!pd && pd.cancellable === true && TITLES.has(pd.title) && TYPES.has(pd.type); }

const cardValue = (name) => {
  const c = getCardDB()[name];
  if (!c) return 0;
  return (c.hp || 0) + 2 * (c.atk || 0) + 40 * (c.level || 0);
};

/** Karte aus der Auswahl mit dem höchsten Wert (gelernter Kartenwert, sonst Kartendaten). */
function bestOf(names, prof) {
  const L = require('./learn/profile');
  return names.slice().sort((a, b) => ((prof ? L.meanOf(prof.cardValue[b]) : 0) - (prof ? L.meanOf(prof.cardValue[a]) : 0)) || (cardValue(b) - cardValue(a)))[0];
}

/** Namen der Handkarten der lebenden Gegner (der Bot darf — wie die Standard-CPU der Engine — schauen), häufigster zuerst. */
function opponentHandNames(engine, seat, allowed) {
  const gs = engine.gs, st = gs.skillTest, count = {};
  gs.players.forEach((p, i) => {
    if (i === seat || (st && st.eliminated && st.eliminated.includes(i))) return;
    for (const n of (p.hand || [])) if (allowed.has(n)) count[n] = (count[n] || 0) + 1;
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

/** Antwort oder `undefined` (nicht zuständig → Standardverhalten). */
function answer(engine, seat, pd) {
  if (!handles(pd)) return undefined;
  const st = engine.gs.skillTest;
  const prof = (() => { try { return st && st.noProfile && st.noProfile.includes(seat) ? null : require('./learn/profile').get(); } catch { return null; } })();

  if (pd.type === 'cardNamePicker') {
    const allowed = new Set(pd.cardNames || []);
    if (!allowed.size) return null;
    const seen = opponentHandNames(engine, seat, allowed);
    if (seen.length) return { cardName: seen[0] };
    const all = [...allowed];
    return { cardName: all[Math.floor(Math.random() * all.length)] };
  }

  const cards = pd.cards || [];
  if (!cards.length) return null;

  if (pd.type === 'cardGallery') {
    const best = bestOf(cards.map(c => c.name), prof);
    const entry = cards.find(c => c.name === best) || cards[0];
    return { cardName: entry.name, source: entry.source };
  }

  // cardGalleryMulti
  const cap = Math.max(0, pd.selectCount != null ? pd.selectCount : cards.length);
  if (pd.title === 'Raise the Minions!') {
    // Stärkste Skeletons zuerst; Kopien (`count`) einzeln, höchstens `cap`
    const picks = [];
    for (const c of cards.slice().sort((a, b) => cardValue(b.name) - cardValue(a.name))) {
      for (let k = 0; k < (c.count || 1) && picks.length < cap; k++) picks.push(c.name);
    }
    return picks.length ? { selectedCards: picks } : null;
  }
  // Spontaneous Reappearance: die wertvollsten Karten der Ablage (bis REAPPEAR_MAX); nie mehr als erlaubt
  const order = cards.map(c => c.name);
  const uniq = [];
  const left = order.slice();
  while (uniq.length < Math.min(cap, REAPPEAR_MAX) && left.length) {
    const b = bestOf(left, prof);
    left.splice(left.indexOf(b), 1);
    uniq.push(b);
  }
  return uniq.length ? { selectedCards: uniq } : null;
}

module.exports = { handles, answer, TITLES };
