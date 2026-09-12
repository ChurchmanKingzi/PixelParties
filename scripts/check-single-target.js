// ════════════════════════════════════════════════════════════════
//  WÄCHTER: EINFACHAUSWAHL BRAUCHT `maxTotal`
//
//  `promptEffectTarget` ohne `maxTotal` (bzw. `selectCount`) fällt im
//  Client still auf „unbegrenzt" zurück. Folge: der Spieler klickt
//  mehrere Ziele an, ALLE bleiben markiert, und der Effekt nimmt am
//  Ende nur das ZUERST geklickte. Al hat das an Scrap Plow, Cheeky
//  Monkee und zuletzt an Vena gesehen — es ist keine Karteneigenheit,
//  sondern eine Lücke, die jede neue Einfachauswahl wieder aufreißt.
//
//  Mit gesetztem `maxTotal: 1` greift die längst vorhandene
//  Client-Regel „ein Klick TAUSCHT die Auswahl aus" (togglePotionTarget).
//
//  Erkennung: ein Aufruf gilt als EINFACHAUSWAHL, wenn das Ergebnis
//  ausschließlich über Index 0 gelesen wird (`ids[0]`, `ids?.[0]`) und
//  nirgends durchlaufen, weitergereicht oder anders indiziert wird.
//  Alles andere gilt als Mehrfachauswahl und wird nicht gemeldet — im
//  Zweifel schweigt der Wächter lieber, als Fehlalarme zu produzieren.
//
//  Aufruf:  node scripts/check-single-target.js
//  Rückgabe 0 = sauber, 1 = mindestens eine Einfachauswahl ohne Grenze.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

/** Kommentare entfernen, ZEILENERHALTEND (sonst verrutschen die Nummern). */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

/** Argumente oberster Ebene ab der öffnenden Klammer. */
function argumenteLesen(code, von) {
  const args = [];
  let tiefe = 0, start = von + 1, quote = null;
  for (let i = von; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { tiefe++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      tiefe--;
      if (tiefe === 0 && c === ')') { args.push(code.slice(start, i)); return { args, ende: i }; }
      continue;
    }
    if (c === ',' && tiefe === 1) { args.push(code.slice(start, i)); start = i + 1; }
  }
  return { args: null, ende: -1 };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AUFRUF = /\bpromptEffectTarget\s*\(/g;
const BEGRENZT = /\b(maxTotal|selectCount)\s*:/;

const funde = [];
let geprueft = 0;

for (const name of fs.readdirSync(EFFEKTE).sort()) {
  if (!name.endsWith('.js') || name === '_engine.js') continue;
  const code = ohneKommentare(fs.readFileSync(path.join(EFFEKTE, name), 'utf8'));
  const zeilen = code.split('\n');
  AUFRUF.lastIndex = 0;
  let m;
  while ((m = AUFRUF.exec(code)) !== null) {
    geprueft++;
    const klammer = m.index + m[0].length - 1;   // Position der '('
    const { args, ende } = argumenteLesen(code, klammer);
    if (!args || args.length < 3) continue;
    if (BEGRENZT.test(args[2])) continue;        // schon begrenzt

    // Variablennamen links vom Aufruf lesen: `const picked = await engine.`
    const vorher = code.slice(Math.max(0, m.index - 200), m.index);
    const vm = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?[A-Za-z_$][\w$.]*\.\s*$/.exec(vorher)
      || /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?\s*$/.exec(vorher);
    if (!vm) continue;                            // Ergebnis nicht gebunden — nicht beurteilbar
    const v = esc(vm[1]);
    const folge = code.slice(ende, ende + 1400);

    const nurErstes = new RegExp(v + '\\s*\\??\\.?\\s*\\[\\s*0\\s*\\]').test(folge);
    const mehrfach =
      new RegExp('\\bfor\\s*\\([^)]*\\bof\\s+' + v + '\\b').test(folge)
      || new RegExp(v + '\\s*\\.\\s*(forEach|map|filter|reduce|some|every|includes|indexOf|join|sort|slice)\\b').test(folge)
      || new RegExp(v + '\\s*\\[\\s*(?!0\\s*\\])[A-Za-z_$0-9]').test(folge)
      || new RegExp('\\.\\.\\.' + v + '\\b').test(folge)
      || new RegExp('\\([^()]*\\b' + v + '\\b\\s*[,)]').test(folge)
      || new RegExp(v + '\\s*\\.\\s*length\\s*[<>=!]=?\\s*([2-9]|\\d\\d)').test(folge);

    if (mehrfach || !nurErstes) continue;
    const zeile = code.slice(0, m.index).split('\n').length;
    funde.push({ datei: name, zeile, variable: vm[1], text: (zeilen[zeile - 1] || '').trim().slice(0, 96) });
  }
}

if (funde.length === 0) {
  console.log(`[check-single-target] OK — ${geprueft} Zielwahl(en) geprüft, jede Einfachauswahl begrenzt.`);
  process.exit(0);
}

console.error(`[check-single-target] ${funde.length} Einfachauswahl(en) OHNE maxTotal:\n`);
for (const f of funde) {
  console.error(`  ✗ ${f.datei}:${f.zeile}  (liest nur ${f.variable}[0])`);
  console.error(`      ${f.text}`);
}
console.error('\n  Abhilfe: `maxTotal: 1` in die config des Aufrufs.');
console.error('  Echte Mehrfachauswahl? Dann wird sie hier gar nicht gemeldet.\n');
process.exit(1);
