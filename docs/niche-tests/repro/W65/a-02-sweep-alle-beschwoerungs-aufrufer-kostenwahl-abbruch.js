'use strict';
// W65a-02 · Sweep über ALLE Karten, die eine Kreatur aus Ablage / Deck / Hand / Potion Deck beschwören oder platzieren: bricht der Spieler die Opfer-/Tribut-Wahl (Beschwörungskosten) ab, sehen Gegner und Zuschauer NICHTS
//
// Regel (Al): „solange der Spieler die Opfer-/Tribut-Wahl noch abbrechen kann, sieht der Gegner nichts; erst nach der letzten Abbruchstelle kommt der Auftritt" (CARD_API „Welle 65 / W65a").
// Methode: Kosten-Szene — Ablage, Deck (oben), Hand und Potion Deck des Sitzes enthalten Kreaturen MIT abbrechbaren Beschwörungskosten (500 Piranhas, Archer/Warrior/Guardian of Teocuilatl, Blue-Ice Dragon), der Sitz
//   hat reichlich Schulen. Gespielt wird jede Handkarte (Spell/Attack/Artifact/Potion), deren Skript einen der Beschwörungs-Primitive nutzt (summonFromDiscard/-Deck/-Pile, summonCreatureWithHooks, placeFromPile,
//   actionPlaceCreature) über den echten Spielweg; dazu jede Kreatur auf dem Brett, deren Aktivierung sie nutzt. Durchlauf (Antworten wählen bevorzugt eine Kosten-Kreatur), dann Abbruch an jeder abbrechbaren Stelle
//   (ab dort durchgehend). Leck = nach einem Abbruch, der die Karte/Aktivierung zurückgibt, ging etwas über sie an Gegner/Zuschauer. Beide Sitze (Stichprobe: Sitz 1 für die Karten mit echter Kostenfrage).
// Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const W = require('../../lib/wire.js');
const KOSTEN = ['500 Piranhas in a Monster Suit', 'Archer of Teocuilatl', 'Warrior of Teocuilatl', 'Guardian of Teocuilatl', 'Blue-Ice Dragon'];
const DIR = path.resolve(__dirname, '../../../../cards/effects');
const quelle = (name) => { try { return fs.readFileSync(path.join(DIR, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.js'), 'utf8'); } catch { return ''; } };
const NUTZT = /summonFromDiscard|summonFromDeck|summonFromPile|summonCreatureWithHooks|placeFromPile|actionPlaceCreature/;
const HOPT0 = (t) => Object.keys(t.gs.hoptUsed || {}).length === 0;
const wahl = (e) => {
  if (e.kind === 'generic' && e.d.type === 'cardNamePicker') return { cardName: W.REICH.CRE[1] };
  if (e.kind === 'generic' && e.d.type === 'cardGallery' && Array.isArray(e.d.cards)) { const c = e.d.cards.find(x => KOSTEN.includes(x.name) && x.selectable !== false); if (c) return { cardName: c.name, source: c.source }; }
  if (e.kind === 'generic' && e.d.type === 'cardGalleryMulti' && Array.isArray(e.d.cards)) { const c = e.d.cards.find(x => KOSTEN.includes(x.name)); if (c) return { selectedCards: [c.name] }; }
  return undefined;
};
const szene = async (seat, karten, board) => W.reicheSzene({ seat, karten, board: async (t, s) => {
  t.setAbilities(s, 0, [['Fighting', 'Fighting', 'Fighting'], ['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], ['Support Magic', 'Support Magic', 'Support Magic']]);
  const ps = t.gs.players[s];
  for (const k of KOSTEN) { ps.discardPile.push(k); ps.mainDeck.unshift(k); if (k !== 'Blue-Ice Dragon') ps.potionDeck.unshift(k); }
  ps.hand.push(KOSTEN[0], KOSTEN[2]);
  if (board) await board(t, s);
} });

(async () => {
  const R = W.runner();
  const lecks = [], fehler = [];
  let karten = 0, laeufe = 0, mitKosten = 0;
  // ── 1) Handkarten ──────────────────────────────────────────────────────────────────────────────────────────
  const hand = Object.values(W.DB).filter(c => ['Spell', 'Attack', 'Artifact', 'Potion'].includes(c.cardType) && c.name && !/^ZZ /.test(c.name) && NUTZT.test(quelle(c.name)));
  for (const c of hand) {
    for (const seat of [0, 1]) {
      let t;
      try {
        t = await szene(seat, [c.name]);
        const clean = await W.spiele(t, seat, c.name, { hero: 0, timeoutMs: 6000, answer: wahl });
        karten++;
        const nCanc = clean.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
        if (t.errors.length) fehler.push(`${c.name}: ${t.errors[0].slice(0, 120)}`);
        for (let k = 0; k < Math.min(nCanc, 5); k++) {
          const t2 = await szene(seat, [c.name]);
          const r = await W.spiele(t2, seat, c.name, { hero: 0, timeoutMs: 6000, cancelAt: k, persist: true, answer: wahl });
          laeufe++;
          if (r.undone) { mitKosten++; if (r.appearances.length > 0 || r.stateLeaks.length > 0) lecks.push(`${c.name} (Sitz ${seat}, Abbruch an Stelle ${k}: ${r.appearances.length} Sendungen, ${r.stateLeaks.length} Zustände)`); }
          if (t2.errors.length) fehler.push(`${c.name}@${k}: ${t2.errors[0].slice(0, 120)}`);
        }
      } catch (e) { fehler.push(`${c.name}: ${String(e.message).slice(0, 100)}`); }
      if (seat === 0 && !(t && t.tl && t.tl.some(e => e.k === 'answer-begin' && e.cancellable))) break;   // Sitz 1 nur für Karten mit abbrechbaren Fragen
    }
  }
  // ── 2) Aktivierungen: Kreaturen auf dem Brett ─────────────────────────────────────────────────────────────────
  const kre = Object.values(W.DB).filter(c => c.cardType === 'Creature' && c.name && !/^ZZ /.test(c.name) && !KOSTEN.includes(c.name) && /onCreatureEffect/.test(quelle(c.name)) && NUTZT.test(quelle(c.name)));
  let akt = 0;
  for (const c of kre) {
    for (const seat of [0, 1]) {
      const callFn = (t) => { t.put(seat, 0, 0, c.name).turnPlayed = 1; t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, 0, 0); };
      try {
        const mk = () => szene(seat, []);
        const d = await W.durchlauf(mk, seat, c.name, { seat, hero: 0, maxCancel: 5, undoneFn: HOPT0, callFn, timeoutMs: 6000, answer: wahl });
        akt++;
        if (d.clean.t.errors.length) fehler.push(`${c.name} (Aktivierung): ${d.clean.t.errors[0].slice(0, 120)}`);
        for (const { k, r, t } of d.cancels) {
          laeufe++;
          if (t.errors.length) fehler.push(`${c.name}@${k}: ${t.errors[0].slice(0, 120)}`);
          if (!r.undone) continue;
          mitKosten++;
          // Der Name der Kreatur steht öffentlich auf dem Brett: im Zustand zählen nur Frage-/Zielwahl-Felder
          if (r.appearances.length > 0 || r.kanalLeaks.length > 0) lecks.push(`${c.name} (Aktivierung, Sitz ${seat}, Abbruch an Stelle ${k}: ${r.appearances.length} Sendungen, ${r.kanalLeaks.length} Zustände)`);
        }
        if (seat === 0 && d.nCanc === 0) break;
      } catch (e) { fehler.push(`${c.name} (Aktivierung): ${String(e.message).slice(0, 100)}`); }
    }
  }
  process.stdout.write(`  (${hand.length} Handkarten, ${kre.length} Kreaturen mit Beschwörungs-Aufruf geprüft: ${karten} Durchläufe, ${akt} Aktivierungen, ${laeufe} Abbruch-Läufe, davon ${mitKosten} mit echtem Rückgabe-Abbruch)\n`);
  R.check(`Sweep hat gearbeitet (${karten} Karten-Durchläufe, ${akt} Aktivierungen, ${mitKosten} echte Abbrüche)`, karten > 15 && mitKosten > 10, { karten, akt, mitKosten });
  R.check('KEINE Karte/Aktivierung zeigt sich dem Gegner/Zuschauer, wenn die Kostenwahl (oder eine andere Abbruchstelle) abgebrochen wird', lecks.length === 0, lecks.slice(0, 30));
  R.check('keine Engine-Fehler in den Läufen', fehler.length === 0, fehler.slice(0, 10));
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
