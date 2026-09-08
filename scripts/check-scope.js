#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — BEZEICHNER-PRÜFUNG
//
//  Sucht Bezeichner, die GELESEN werden, ohne irgendwo deklariert
//  zu sein. Genau die Klasse Fehler, die `node --check` NICHT
//  sieht: die Datei ist syntaktisch einwandfrei, wirft aber zur
//  Laufzeit `ReferenceError: x is not defined` — und zwar erst,
//  wenn der Pfad tatsächlich durchlaufen wird.
//
//  ANLASS (16.8.): `canAffordGold(pi, …)` / `_payCardCost(pi, …)`
//  standen in NEUN Hand-Reaktionsfenstern, in denen es gar kein
//  `pi` gibt (dort heißt es targetOwner / ownerIdx / reactorIdx /
//  playerIdx / summoningPi / victimOwner). Jede der 17 Reaktions-
//  karten stürzte beim Auslösen ab. Derselbe Durchlauf fand acht
//  weitere Stellen in fünf anderen Dateien, die mit `pi` nichts zu
//  tun hatten — u.a. eine tote Hook-Timeout-Diagnose, ein
//  komplett wirkungsloses Beer und ein Guardian of Teocuilatl,
//  der eine nie exportierte Funktion aufrief.
//
//  Warum das die eigentliche Absicherung ist und nicht eine
//  einheitliche Benennung: 66 Funktionen führen MEHRERE Spieler-
//  indizes gleichzeitig (`_actionDealDamageImpl` allein sieben).
//  Dort ist ein gemeinsamer Name unmöglich — und wo er möglich
//  wäre, würde eine Verwechslung nicht mehr laut abstürzen,
//  sondern still den falschen Spieler treffen. Die Prüfung hier
//  greift unabhängig davon, wie die Variable heißt.
//
//  AUFRUF
//    node scripts/check-scope.js            # ganzes Projekt
//    node scripts/check-scope.js server.js  # einzelne Dateien
//
//  Rückgabewert 1, sobald etwas gefunden wurde — damit taugt der
//  Aufruf als Vorbedingung für Auslieferungen.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('./vendor/babel.min.js');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const WURZEL = path.join(__dirname, '..');

// Verzeichnisse, die uns nicht gehören oder erzeugt werden.
const UEBERSPRINGEN = new Set(['node_modules', 'vendor', 'dist', '.git', 'data', 'music', 'sounds', 'avatars']);

// Laufzeit-Globals. Alles, was hier NICHT steht und nirgends
// deklariert ist, gilt als Fund.
const GLOBALS = new Set([
  // v800: fehlten, seit auch die Client-Dateien geprueft werden.
  'CSS', 'MouseEvent',
  'require', 'module', 'exports', '__dirname', '__filename', 'process', 'console',
  'Buffer', 'global', 'globalThis', 'queueMicrotask', 'structuredClone', 'arguments',
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Function', 'Symbol', 'BigInt', 'Promise', 'Proxy', 'Reflect', 'Intl',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry',
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError',
  'URIError', 'AggregateError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent', 'escape', 'unescape',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal',
  'crypto', 'performance', 'fetch', 'Headers', 'Request', 'Response', 'Blob', 'FormData',
  'Event', 'EventTarget', 'MessageChannel', 'Worker', 'gc',
  // Browser-Umgebung — `public/` läuft nicht in Node.
  'self', 'window', 'document', 'navigator', 'location', 'history', 'screen',
  'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'Image', 'Audio', 'AudioContext', 'FileReader', 'DOMParser', 'MutationObserver',
  'ResizeObserver', 'IntersectionObserver', 'CustomEvent', 'HTMLElement', 'Node',
  'React', 'ReactDOM', 'io', 'Babel',
]);

// Dateien, die NICHT als eigenständiges Skript laufen, sondern als
// Funktionskörper mit gereichten Bausteinen ausgewertet werden.
// `public/campaign/scenes/*.js` gehen durch
// `new Function('world','scene','helpers', …)` in app-campaign.jsx —
// diese drei Namen sind dort also gebunden, obwohl die Datei sie
// nirgends deklariert. Ohne diesen Eintrag meldet die Prüfung sie als
// Fund, und eine Prüfung mit Fehlalarmen liest irgendwann niemand mehr.
const GEREICHTE_NAMEN = [
  { pfad: path.join('public', 'campaign', 'scenes'), namen: ['world', 'scene', 'helpers'] },
];

function zusatzGlobals(dateipfad) {
  const rel = path.relative(WURZEL, dateipfad);
  for (const eintrag of GEREICHTE_NAMEN) {
    if (rel.startsWith(eintrag.pfad)) return new Set(eintrag.namen);
  }
  // Die Client-Dateien unter `public/` liegen in getrennten Bundles und
  // reichen sich Bausteine AUSDRUECKLICH ueber `window` weiter:
  // `window.MainMenu = MainMenu` in der einen Datei macht den Namen in
  // allen anderen benutzbar. Genau diese Zuweisungen — und NUR sie —
  // gelten hier als gebunden.
  //
  // ★ v809: vorher galt die Vereinigung ALLER obersten Namen dieser
  // Dateien. Das war zu grosszuegig und hat einen echten Fehler
  // verdeckt: eine neue Komponente, die in einer Datei definiert und in
  // einer anderen benutzt, aber nie an `window` gehaengt wurde, sah
  // gebunden aus und war zur Laufzeit undefiniert. Die Liste der
  // `window.X =`-Zuweisungen ist das, was zur Laufzeit tatsaechlich
  // zaehlt.
  if (rel.startsWith('public' + path.sep)) return client_fenster_namen();
  return null;
}

let _clientNamen = null;
function client_fenster_namen() {
  if (_clientNamen) return _clientNamen;
  _clientNamen = new Set();
  const dir = path.join(WURZEL, 'public');
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.jsx')) continue;
    let ast;
    try {
      ast = parser.parse(fs.readFileSync(path.join(dir, name), 'utf8'), {
        sourceType: 'script', allowReturnOutsideFunction: true, plugins: ['jsx'],
      });
    } catch { continue; }
    // Nur `window.X = …` zaehlt — das ist der Weg, ueber den die Bundles
    // sich gegenseitig sichtbar machen.
    for (const knoten of ast.program.body) {
      if (knoten.type !== 'ExpressionStatement') continue;
      const a = knoten.expression;
      if (!a || a.type !== 'AssignmentExpression' || a.operator !== '=') continue;
      const ziel = a.left;
      if (ziel.type !== 'MemberExpression' || ziel.computed) continue;
      if (ziel.object.type !== 'Identifier' || ziel.object.name !== 'window') continue;
      if (ziel.property.type === 'Identifier') _clientNamen.add(ziel.property.name);
    }
  }
  return _clientNamen;
}

function jsDateien(verzeichnis, treffer = []) {
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name.startsWith('.')) continue;
    const p = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (UEBERSPRINGEN.has(eintrag.name)) continue;
      jsDateien(p, treffer);
    } else if (eintrag.name.endsWith('.js') || eintrag.name.endsWith('.jsx')) {
      // ★ .jsx seit v800 dabei (Al-Absturz „azc is not defined", 5.9.).
      // Die Client-Dateien lagen ausserhalb der Pruefung, und `dist/`
      // wird uebersprungen — ein Bezeichner, der beim Umbauen einer
      // Funktion ohne seine Bindung zurueckblieb, kam damit ungebremst
      // bis ins laufende Spiel. Genau dieser Fall ist hier der Regelfall,
      // nicht die Ausnahme: `public/app-board.jsx` hat ueber 38.000
      // Zeilen.
      treffer.push(p);
    }
  }
  return treffer;
}

/** @returns {{name:string, zeilen:number[]}[]} — leer heißt sauber. */
function pruefeDatei(dateipfad) {
  const quelltext = fs.readFileSync(dateipfad, 'utf8');
  let ast;
  try {
    ast = parser.parse(quelltext, {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      // JSX nur fuer .jsx einschalten — in reinen .js-Dateien soll ein
      // versehentliches `<` weiterhin ein Syntaxfehler sein.
      plugins: dateipfad.endsWith('.jsx') ? ['jsx'] : [],
    });
  } catch (err) {
    return [{ name: `(nicht lesbar: ${err.message})`, zeilen: [] }];
  }

  const zusatz = zusatzGlobals(dateipfad);
  const funde = new Map();
  traverse(ast, {
    ReferencedIdentifier(pfad) {
      const name = pfad.node.name;
      if (GLOBALS.has(name)) return;
      if (zusatz && zusatz.has(name)) return;
      // `true` = auch Bindungen aus umschließenden Bereichen gelten.
      if (pfad.scope.hasBinding(name, true)) return;
      if (!funde.has(name)) funde.set(name, []);
      funde.get(name).push(pfad.node.loc.start.line);
    },
  });
  return [...funde.entries()].map(([name, zeilen]) => ({ name, zeilen }));
}

function main() {
  const argumente = process.argv.slice(2);
  const dateien = argumente.length
    ? argumente.map(a => path.resolve(WURZEL, a))
    : jsDateien(WURZEL);

  let betroffen = 0;
  let stellen = 0;

  for (const datei of dateien) {
    const funde = pruefeDatei(datei);
    if (!funde.length) continue;
    betroffen++;
    console.log(path.relative(WURZEL, datei));
    for (const { name, zeilen } of funde) {
      stellen += zeilen.length;
      const liste = zeilen.length > 12
        ? zeilen.slice(0, 12).join(', ') + `, … (+${zeilen.length - 12})`
        : zeilen.join(', ');
      console.log(`    ${name}  —  Zeile ${liste}`);
    }
  }

  if (betroffen === 0) {
    console.log(`[check-scope] ${dateien.length} Dateien geprüft — keine ungebundenen Bezeichner.`);
    return 0;
  }
  console.log(`\n[check-scope] ${stellen} Stelle(n) in ${betroffen} von ${dateien.length} Dateien.`);
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { pruefeDatei, jsDateien };
