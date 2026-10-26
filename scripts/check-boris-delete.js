#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: BORIS WIRKT NUR BEI ABWURF, NIE BEIM LÖSCHEN (W74a, Al)
//
//  Boris, the Guardian of Blackport: „You may once per turn ignore any
//  effect that would force you to DISCARD cards from your hand (including
//  as a cost)." Karten von der Hand LÖSCHEN (Wheels „delete 2", Potion
//  Juggler, Acid Rain, Dante, Item Lock, Debt-o-Tron-Kosten …) ist kein
//  Discard: keine Frage, kein Verzicht, der Einmal-pro-Zug-Verzicht
//  (HOPT `boris-discard`) bleibt unverbraucht.
//
//  Geprüft wird:
//   1. Die zentralen Tore (Engine + Boris-Skript): `actionPromptForceDiscard`
//      fragt Boris nur ohne `deleteMode`; `borisVerzicht` und
//      `offerDiscardSkip` geben bei `deleteMode`/`delete`/`loeschen` sofort
//      `false` zurück.
//   2. Jedes KARTENSKRIPT, das `borisVerzicht(` / `offerDiscardSkip(` aufruft:
//      meint der Kartentext dort „delete … from your hand/cards in your hand"
//      (oder „delete … from your hand or discard pile"), schlägt der Wächter
//      an — außer das Skript steht in der ALLOWLIST unten (mit Begründung:
//      Boris wird dort nur für einen echten ABWURF gefragt).
//   3. Kein `borisVerzicht(`-/`offerDiscardSkip(`-Aufruf steht in der Nähe
//      (±10 Zeilen) von `deleteMode`, `deleteFromPile` oder
//      `actionDeleteHandCard`, ohne dass das Skript in der ALLOWLIST steht.
//   4. Bausteine (`_extra-summon-shared.js` / `makeDiscardCostSummon`): Karten,
//      die den Baustein benutzen, dürfen im Kartentext keine Hand-LÖSCHKOSTEN
//      haben (der Baustein fragt Boris für jeden Kostenabwurf).
//
//  Neue Karte mit Löschkosten? Dann KEIN `borisVerzicht`. Neue Karte mit
//  Abwurfkosten UND einem Löschen an anderer Stelle? In die ALLOWLIST
//  eintragen und begründen.
//
//  Aufruf: node scripts/check-boris-delete.js   (0 = sauber, 1 = Fund)
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const karten = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));
const nameZuDatei = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ohneKommentare = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
const lesen = (p) => fs.readFileSync(p, 'utf8');

/** Skripte, in denen ein Löschen UND ein Boris-Aufruf vorkommen dürfen — mit Begründung. */
const ALLOWLIST = {
  'control-monitors.js': 'Boris wird nur für den ABWURF-Preis (N Handkarten abwerfen, `reactionKostenZahlen`) gefragt; das Löschen der hinzugefügten/anderen Karten (`deleteFromPile`) trifft die Hand des GEGNERS und fragt Boris nie.',
  'cute-hydra.js': 'Boris wird nur für den ABWURF der Beschwörung (Batch, `borisVerzicht` nach dem Confirm) gefragt; „deleted from anywhere“ im Kartentext ist die Rettungsklausel, kein Löschen von der Hand.',
};

// Kartentext meint ein Löschen von der HAND (auch „from your hand or discard pile", „cards in your hand").
const LOESCHEN_HAND = /\bdelet\w*\b[^.]{0,120}?\b(from|in) (your|their) (hand|cards in)/i;
const LOESCHEN_HAND_2 = /\bdelet\w*\b[^.]{0,80}?\bfrom (your|their) hand/i;

const funde = [];
const melde = (txt) => funde.push(txt);

// ── 1. Zentrale Tore ──────────────────────────────────────────────
const engine = ohneKommentare(lesen(path.join(EFFEKTE, '_engine.js')));
const boris = ohneKommentare(lesen(path.join(EFFEKTE, 'boris-the-guardian-of-blackport.js')));

const torEngine = /if\s*\(\s*!opts\.deleteMode[^)]*\)\s*\{\s*const boris = loadCardEffect\('Boris, the Guardian of Blackport'\);\s*if \(boris\?\.offerDiscardSkip/;
if (!torEngine.test(engine)) melde('_engine.js: `actionPromptForceDiscard` fragt Boris nicht mehr hinter `!opts.deleteMode` (Boris darf Löschen nicht ignorieren).');

const verzicht = engine.match(/async borisVerzicht\(pi, count, opts = \{\}\) \{([\s\S]{0,400}?)const boris = /);
if (!verzicht || !/opts\.deleteMode/.test(verzicht[1]) || !/return false/.test(verzicht[1])) melde('_engine.js: `borisVerzicht` gibt bei `opts.deleteMode`/`delete`/`loeschen` nicht sofort `false` zurück.');

const angebot = boris.match(/async offerDiscardSkip\(engine, pi, count, opts = \{\}\) \{([\s\S]{0,800}?)if \(!borisActive/);
if (!angebot || !/opts\.deleteMode/.test(angebot[1]) || !/return false/.test(angebot[1])) melde('boris-the-guardian-of-blackport.js: `offerDiscardSkip` gibt bei `opts.deleteMode`/`delete`/`loeschen` nicht sofort `false` zurück.');

// ── 2.–4. Kartenskripte ───────────────────────────────────────────
const slugZuKarte = {};
for (const c of karten) slugZuKarte[nameZuDatei(c.name)] = c;
const BORIS_AUFRUF = /\b(borisVerzicht|offerDiscardSkip)\s*\(/;
const LOESCH_NAEHE = /deleteMode|deleteFromPile|actionDeleteHandCard|actionDeleteCard/;

let geprueft = 0;
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js'))) {
  if (datei === '_engine.js' || datei === 'boris-the-guardian-of-blackport.js') continue;
  const roh = lesen(path.join(EFFEKTE, datei));
  const quelle = ohneKommentare(roh);
  const zeilen = quelle.split('\n');
  const karte = slugZuKarte[datei.replace(/\.js$/, '')];
  const text = karte ? String(karte.effect || '') : '';
  const erlaubt = Object.prototype.hasOwnProperty.call(ALLOWLIST, datei);

  // 2. + 3. direkte Aufrufe
  const treffer = [];
  zeilen.forEach((z, i) => { if (BORIS_AUFRUF.test(z)) treffer.push(i); });
  if (treffer.length) {
    geprueft++;
    if (!erlaubt) {
      if (karte && (LOESCHEN_HAND.test(text) || LOESCHEN_HAND_2.test(text))) {
        melde(`${datei}: ruft Boris auf (Zeile ${treffer[0] + 1}), aber der Kartentext von „${karte.name}" meint ein LÖSCHEN von der Hand ("${text.match(LOESCHEN_HAND)?.[0] || text.match(LOESCHEN_HAND_2)?.[0]}"). Boris wirkt nur bei Abwurf — Aufruf entfernen oder (nur wenn dort ein echter Abwurf gefragt wird) in die ALLOWLIST mit Begründung.`);
      }
      for (const i of treffer) {
        const fenster = zeilen.slice(Math.max(0, i - 10), i + 11).join('\n');
        if (LOESCH_NAEHE.test(fenster)) melde(`${datei}: Boris-Aufruf (Zeile ${i + 1}) steht in der Nähe eines Löschens (deleteMode/deleteFromPile). Löschen darf Boris nicht fragen.`);
      }
    }
    // `borisVerzicht(…, { deleteMode… })` im selben Aufruf: nie.
    for (const i of treffer) {
      if (/borisVerzicht\([^)]*\{[^}]*\b(deleteMode|delete|loeschen)\s*:\s*true/.test(zeilen[i])) melde(`${datei}: Boris-Aufruf (Zeile ${i + 1}) übergibt ein Lösch-Flag — Löschen darf Boris nicht fragen.`);
    }
  }

  // 4. Baustein für Abwurfkosten-Beschwörungen
  if (/\bmakeDiscardCostSummon\s*\(/.test(quelle) && karte && !erlaubt) {
    geprueft++;
    if (LOESCHEN_HAND.test(text) || LOESCHEN_HAND_2.test(text)) {
      melde(`${datei}: nutzt makeDiscardCostSummon (fragt Boris für jeden Kostenabwurf), aber der Kartentext von „${karte.name}" nennt ein Löschen von der Hand — Löschkosten brauchen einen eigenen Weg ohne Boris (siehe Potion Juggler).`);
    }
  }
}

if (funde.length === 0) {
  console.log(`[check-boris-delete] OK — Tore intakt, ${geprueft} Boris-Aufrufer/Bausteinnutzer geprüft, keiner betrifft ein Löschen von der Hand.`);
  process.exit(0);
}
console.log(`[check-boris-delete] ${funde.length} Fund(e):\n`);
for (const f of funde) console.log('  ✗ ' + f);
console.log(`
  Regel (W74a, Al): Boris ignoriert nur ABWURF („discard"), nie das LÖSCHEN
  von der Hand („delete"). Löschen läuft über
  \`actionPromptForceDiscard(…, { deleteMode: true })\` (die Engine fragt dort
  Boris nicht) oder \`deleteFromPile\` — niemals über \`borisVerzicht\`.
`);
process.exit(1);
