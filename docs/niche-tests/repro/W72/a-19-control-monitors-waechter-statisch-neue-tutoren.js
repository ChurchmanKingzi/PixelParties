'use strict';
// W72a · STATISCHER WAECHTER „Vertrag für neue Tutor-Karten" (Control Monitors): Wer Karten aus dem EIGENEN Deck/der EIGENEN Ablage auf die Hand legt, geht ueber die zentralen Primitive
//   (`actionAddCardFromDeckToHand`, `searchDeckForNamedCard`, `handZugang(…, { von: 'deck'|'ablage' })`, `addCardFromDiscardToHand`, `addFromPileToHand`, `takeFromPile(…, { toHand: true })`) —
//   dann meldet die Engine das Fenster von selbst. Ein Eigenbau (`handZugangSync` ohne `von`, ein selbst gefeuerter Hook `onCardAddedToHand`/`onCardAddedFromDiscardToHand`, ein rohes `hand.push`)
//   muss `engine.noteHandZugangAusStapel(pi, name, { pile, source })` rufen ODER steht hier mit Begruendung, warum die Karte NICHT aus Deck/Ablage kommt (Rueckgabe, Brett, Gegner, ausserhalb des Spiels …).
// Der dynamische Gegenstueck-Sweep ist a-18 (Zustand statt Quelltext). Aufruf: node docs/niche-tests/repro/W72/a-19-….js   (Exit 0 = korrekt)
const fs = require('fs'), path = require('path');
const H = require('../../lib/h.js');
const DIR = path.resolve(process.env.PP_ROOT || path.resolve(__dirname, '../../../..'), 'cards/effects');

const ERLAUBT = new Map([
  ['_deepsea-shared.js', 'Brett → Hand (Bounce/Tausch, `vonInst`)'],
  ['_free-artifact-shared.js', 'die gerade gespielte Artefakt-Karte kehrt zurück (negiert → Hand des Diebs / keepInHand): Rückgabe, kein Zugang aus dem Stapel'],
  ['_sparkfly-shared.js', 'Brett → Hand (Sparkfly-Diebstahl vom Brett)'],
  ['alchemic-journal.js', 'Potion Deck (kein „deck"; Rückfrage an Al)'],
  ['barkeeper.js', 'erzeugter Nachschub (kein Stapel)'],
  ['charme.js', 'Hand des Gegners → eigene Hand (Diebstahl, kein Stapel)'],
  ['criminal-monkee.js', 'Rückgabe der eigenen Karte bei Fehlschlag'],
  ['divine-gift-of-edge.js', 'Side Deck (kein Hauptdeck; Rückfrage an Al)'],
  ['elven-rider.js', 'Rückgabe der eigenen Karte bei Fehlschlag'],
  ['fairy-queen-crestina-the-creation-fairy.js', 'Karte von außerhalb des Spiels / Geschenk an den Gegner'],
  ['gate-to-the-armory.js', 'Eigenbau mit `takeFromPile(…, toHand: true)` — die Engine merkt die Entnahme vor (`_merkeHandZugangUnterwegs`)'],
  ['guardian-s-appearance.js', 'Rückgabe der eigenen Karte bei Fehlschlag'],
  ['idej-sword-onima.js', 'Ability vom Brett des Gegners → dessen Hand (Brett → Hand)'],
  ['letter-of-misinformations.js', 'Karte aus der Hand des Gegners'],
  ['magic-topaz.js', 'Rückgabe der eigenen Karte'],
  ['natas-the-master-of-hell.js', 'Karte von außerhalb des Spiels'],
  ['orthos-the-loyal-guard-dog.js', 'Rückgabe der eigenen Karte bei Fehlschlag'],
  ['philosopher-s-stone.js', 'Potion Deck (kein „deck"; Rückfrage an Al)'],
  ['saint-nicolas.js', 'Trank-Geschenk an den Gegner'],
  ['sculpture-theft.js', 'Brett → Hand'],
  ['sid-the-king-of-thieves.js', 'Karten aus dem Deck des GEGNERS (nicht „their deck")'],
  ['smuggler-s-pier.js', 'Ziehen (draw ist kein „add")'],
  ['soul-shard-ren.js', 'Was-wäre-wenn-Rechnung, sofort zurückgesetzt'],
  ['sparkfly-queen.js', 'Karten aus dem Deck des GEGNERS'],
  ['the-third-circle-of-hell.js', 'Zwischenschritt Deck → sofort spielen (kein „add to hand")'],
  ['the-throne-robber.js', 'Karte von außerhalb des Spiels'],
  ['tri-ad-the-puppet-mistress.js', 'Brett → Hand (Held)'],
]);

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
const OK_VON = /von\s*:\s*['"](rueckgabe|brett|transit|fremdesDeck|surprise|geloescht)['"]/;
const SKIP = new Set(['_engine.js', '_hooks.js', '_loader.js', '_cpu.js']);

(async () => {
  const R = H.runner();
  /** Befund-Gründe für einen Quelltext (leer = unauffällig oder gemeldet). */
  const befund = (text) => {
    const s = strip(text);
    const grund = [];
    for (const m of s.matchAll(/handZugangSync\(([^;]*?)\)\s*;/gs)) if (!OK_VON.test(m[1])) grund.push('handZugangSync ohne von:rueckgabe/brett/transit/fremdesDeck');
    if (/runHooks\(\s*(HOOKS\.ON_CARD_ADDED_TO_HAND|['"]onCardAddedToHand['"]|['"]onCardAddedFromDiscardToHand['"])/.test(s)) grund.push('selbst gefeuerter Hook onCardAddedToHand/onCardAddedFromDiscardToHand');
    if (/\b\w+\.hand\.push\(/.test(s)) grund.push('rohes hand.push');
    const gemeldet = /noteHandZugangAusStapel/.test(s) || /takeFromPile[^;]*toHand\s*:\s*true/s.test(s);
    return { grund: [...new Set(grund)], gemeldet };
  };
  R.section('Selbsttest des Quelltext-Wächters');
  R.check('ein neuer Eigenbau-Tutor (takeFromPile ohne toHand + handZugangSync) wird gemeldet', befund("const x = await engine.takeFromPile(ps, 'deck', n, { source: C });\nengine.handZugangSync(ps, n, { source: C });\n").grund.length === 1 && !befund("engine.handZugangSync(ps, n, {});").gemeldet);
  R.check('mit noteHandZugangAusStapel bzw. takeFromPile(toHand) gilt er als gemeldet; Rückgabe/Brett (von:rueckgabe) ist unauffällig', befund("engine.handZugangSync(ps, n, {});\nengine.noteHandZugangAusStapel(pi, n, { pile: 'deck' });").gemeldet && befund("await engine.takeFromPile(ps, 'deck', n, { toHand: true });\nengine.handZugangSync(ps, n, {});").gemeldet && befund("engine.handZugangSync(ps, n, { von: 'rueckgabe' });").grund.length === 0);
  R.section('Quelltext-Wächter: Eigenbau-Zugänge auf die Hand ohne Meldung');
  const funde = [], alt = [], gepruefte = [];
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.js') && !SKIP.has(x))) {
    const text = fs.readFileSync(path.join(DIR, f), 'utf8');
    if (/meldeHandZugangDurchAbwurf|onHandAddByDiscard/.test(strip(text))) alt.push(f);
    const b = befund(text);
    if (!b.grund.length) continue;
    gepruefte.push(f);
    if (!b.gemeldet && !ERLAUBT.has(f)) funde.push(`${f}: ${b.grund.join('; ')}`);
  }
  R.check(`${gepruefte.length} Skripte mit Eigenbau-Zugang geprüft: jedes meldet (noteHandZugangAusStapel / takeFromPile toHand) oder ist mit Begründung ausgenommen`, funde.length === 0, funde);
  R.check('keine Skripte rufen die entfernte Schnittstelle meldeHandZugangDurchAbwurf / den Hook onHandAddByDiscard', alt.length === 0, alt);
  const veraltet = [...ERLAUBT.keys()].filter(f => !gepruefte.includes(f) && fs.existsSync(path.join(DIR, f)));
  R.note('Ausnahmen, die nichts mehr betrifft', veraltet.join(', ') || '—');
  for (const [k, v] of ERLAUBT) R.note('Ausnahme', `${k}: ${v}`);
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
