#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: KEINE DIREKTEN `hero.atk`-MUTATIONEN
//
//  Anlass (v1087, Als Vorgabe 14.9.: „Bekannte Lücken oder Grenzen
//  sollen immer gefixt werden!").
//
//  `_applyHeroAtkDelta` ist als DER Trichter für jede ATK-Änderung
//  dokumentiert — und seit v1086 hängt daran mehr als nur der
//  Curse-Riegel: ATK-AUREN, die mitwachsen müssen („Rioting Village"
//  verdoppelt alle Attack stats), hören auf `afterHeroAtkChange`.
//
//  Wer den Trichter umgeht, macht zweierlei kaputt, ohne dass etwas
//  auffällt: der Fluch-Zwischenspeicher wird übersprungen UND die Aura
//  läuft aus dem Tritt. Genau das war an drei Stellen der Fall — in der
//  Engine selbst und in `curse.js`. Gefunden wurden sie nur, weil Al
//  nachgefragt hat.
//
//  Dieses Skript meldet jede neue Stelle. Es prüft NICHT auf Lesezugriff
//  (`hero.atk` zu lesen ist überall erlaubt), sondern nur auf
//  Zuweisungen.
//
//  Aufruf:  node scripts/check-atk-funnel.js
//  Rückgabe 0 = sauber, 1 = Umgehungen gefunden.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');

// ── Bekannte, BEGRÜNDETE Ausnahmen ────────────────────────────────
// Jede hier ist eine bewusste Entscheidung mit Kommentar im Code.
const AUSNAHMEN = [
  // Der Trichter selbst.
  { datei: '_engine.js', muster: /hero\.atk = Math\.max\(0, \(hero\.atk \|\| 0\) \+ delta\);/ },
  // Curse senkt VOR dem Setzen des Status ab — der Trichter würde den
  // Abzug sichtbar buchen statt in den Zwischenspeicher.
  { datei: 'curse.js', muster: /targetHero\.atk = 0;/ },
  // Dasselbe im Server-Zwilling (Curse-Abgleich beim Anlegen).
  { datei: 'server.js', muster: /^(host)?[Hh]ero\.atk = 0;$/ },
  // IDENTITÄTSWECHSEL (Aufstieg, Gestaltwechsel): kein Delta, sondern
  // ein neuer Grundwert. Der Trichter passt nicht — stattdessen meldet
  // die Stelle `_signalHeroAtkReset`, damit Auren neu abgleichen.
  { datei: '_engine.js', muster: /hero\.atk = newCardData\.atk \|\| hero\.atk;/ },
  // HELDENPLATZ LEEREN (gestorbener/entfernter Held): der ganze Held
  // wird auf null gesetzt, nicht seine ATK verändert. Eine Aura, die
  // nur lebende Helden zählt, ist davon nicht betroffen.
  { datei: 'initiation-ritual.js', muster: /deadHero\.atk = 0;/ },
  { datei: 'quetzahuitl-receiver-of-sacrifices.js', muster: /hero\.atk = 0;/ },
  // ★ v1165: der ZWEITE Trichter — `_syncHeroAtkAura` setzt den Endwert
  // einer Multiplikator-Aura (`heroAtkMultiplier`). Er darf NICHT ueber
  // `_applyHeroAtkDelta` laufen: der wuerde sich selbst wieder aufrufen.
  // Der Fluch-Riegel wird oben in der Funktion geprueft, die Meldung
  // `fighting_atk_change` schickt sie selbst.
  { datei: '_engine.js', muster: /hero\.atk = ziel;/ },
];

function stripKommentare(src) {
  const leeren = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, leeren)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + leeren(m.slice(p1.length)));
}

// Zuweisungen an ein ATK-Feld: `hero.atk =`, `targetHero.atk +=`, …
const ZUWEISUNG = /\b([A-Za-z_$][\w$]*)\.atk\s*(=(?!=)|\+=|-=)/g;

const fehler = [];
const dateien = [
  ...fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js')).map(f => ['cards/effects/' + f, path.join(EFFEKTE, f)]),
  ['server.js', path.join(WURZEL, 'server.js')],
];

for (const [anzeige, voll] of dateien) {
  let roh;
  try { roh = fs.readFileSync(voll, 'utf8'); } catch { continue; }
  const src = stripKommentare(roh);
  const kurz = path.basename(anzeige);

  ZUWEISUNG.lastIndex = 0;
  let m;
  while ((m = ZUWEISUNG.exec(src)) !== null) {
    const zeile = src.slice(0, m.index).split('\n').length;
    const text = src.slice(m.index, src.indexOf('\n', m.index) >= 0 ? src.indexOf('\n', m.index) : undefined).trim();

    // Nur Helden-artige Empfänger — `inst.atk` / `cd.atk` sind
    // Kartendaten, keine Heldenstatistik.
    const empfaenger = m[1];
    if (!/hero/i.test(empfaenger)) continue;

    const erlaubt = AUSNAHMEN.some(a => a.datei === kurz && a.muster.test(text));
    if (erlaubt) continue;
    fehler.push(`  ✗ ${anzeige}:${zeile}  ${text.slice(0, 92)}`);
  }
}

if (fehler.length === 0) {
  console.log('[check-atk-funnel] OK — jede ATK-Änderung läuft über `_applyHeroAtkDelta`.');
  process.exit(0);
}
console.log(`[check-atk-funnel] ${fehler.length} Umgehung(en) des ATK-Trichters:\n`);
console.log(fehler.join('\n'));
console.log('\n  Grund: `_applyHeroAtkDelta` führt den Fluch-Zwischenspeicher UND meldet');
console.log('  `afterHeroAtkChange` — ATK-Auren wie „Rioting Village" hängen daran.');
console.log('  Eine Zuweisung daneben überspringt beides, still.\n');
process.exit(1);
