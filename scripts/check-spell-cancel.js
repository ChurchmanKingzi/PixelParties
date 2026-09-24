// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ABGEBROCHENE ZAUBER LANDEN IN DER ABLAGE
//
//  Ein Zauber, der seine eigene Auswahl öffnet und abgebrochen wird,
//  muss `gs._spellCancelled = true` setzen. NUR dieses Flag lässt den
//  Spielweg die Karte auf die Hand zurücklegen; ohne es gilt der
//  Zauber als aufgelöst und wandert in die Ablage — der Spieler hat
//  „abgebrochen" und die Karte trotzdem verloren.
//
//  Die ctx-Helfer setzen das Flag SELBST:
//    • `ctx.promptDamageTarget`   (_engine.js, `noSpellCancel` opt-out)
//    • `ctx.promptMultiTarget`
//  Wer dagegen den ROHEN Wähler benutzt — `engine.promptEffectTarget`,
//  `engine.promptGeneric`, `ctx.promptCardGallery` … — muss es von Hand
//  tun. Genau das fiel bei „Dangerous Knowledge" durch (Als Befund
//  12.9., dieselbe Klasse wie beim Difficulty Lever, wo `resolve` statt
//  `{ cancelled: true }` ein blosses `false` lieferte).
//
//  GEPRÜFT WIRD deshalb: Skripte von Karten des Typs Spell/Attack, die
//  in ihrem Code einen rohen, ABBRECHBAREN Prompt öffnen, aber
//  `_spellCancelled` nirgends erwähnen.
//
//  Aufruf:  node scripts/check-spell-cancel.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Verdachtsfall.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');

/** Kartenname → Dateiname, identisch zu `nameToFile` im Loader. */
function nameZuDatei(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Kommentare raus — geprüft wird nur CODE. */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

// ── MANUELL GEPRUEFT UND IN ORDNUNG (12.9.) ─────────────────────────
// Die Heuristik sieht nur „irgendwo im Skript steht ein roher,
// abbrechbarer Prompt" — nicht, OB er auf dem Spielweg der Karte liegt.
// Diese sieben wurden einzeln nachgelesen; bei keiner haengt die Karte
// selbst am Abbruch:
const GEPRUEFT = {
  'Alliance':                 'Prompt im Brett-Hook der bereits angelegten Karte',
  'Anti Magic Enchantment':   'Prompt im Brett-Hook des Anhaengsels',
  'Bifab, Bridge to Coolness': 'laeuft ueber die Coolness-Stack-Aufloesung, nicht ueber den Handweg',
  'Call of the Deepsea':      'Prompt im Todes-Hook des Anhaengsels (v1358); der Handweg bricht ueber `attachToHero` ab, das das Flag selbst setzt',
  'Idej Projection':          'kein onPlay — der Prompt gehoert dem angelegten Anhaengsel',
  'Intrude':                  'Prompt im Reaktions-Hook des Anhaengsels',
  'Laser Volley':             'fragt den GEGNER, Folgeentscheidung nach der Aufloesung',
  'Spider Dance':             'Deck-Suche mit `minSelect: 0` — Abbruch heisst „nichts suchen", nicht „Zauber zurueck"',
};

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const verdacht = [];

for (const cd of karten) {
  if (cd.cardType !== 'Spell' && cd.cardType !== 'Attack') continue;
  const datei = path.join(EFFEKTE, nameZuDatei(cd.name) + '.js');
  if (!fs.existsSync(datei)) continue;
  const code = ohneKommentare(fs.readFileSync(datei, 'utf8'));

  // ── Eingrenzung: nur der Fall, in dem die ERSTE Entscheidung der
  // Karte ein roher Waehler ist. Alles andere ist kein Fehler:
  //   • REACTION-Zauber laufen ueber das Kettenfenster, nicht ueber den
  //     Handweg — dort gibt es kein `_spellCancelled`.
  //   • AREA-Zauber legen sich in ihrem `onPlay` selbst aufs Brett;
  //     ein danach abgebrochener Folgeprompt darf die Karte NICHT
  //     zuruecknehmen.
  //   • Karten, die ausserdem einen ctx-Helfer benutzen
  //     (`promptDamageTarget` / `promptMultiTarget`), haben ihre
  //     Hauptwahl dort — der rohe Prompt ist eine Folgefrage, und der
  //     Helfer hat den Abbruch laengst gemeldet.
  if ((cd.subtype || '') === 'Reaction') continue;
  if ((cd.subtype || '') === 'Area') continue;
  //   • SURPRISE-Karten liegen verdeckt auf dem Brett und loesen von
  //     dort aus — sie kehren nie auf die Hand zurueck.
  if ((cd.subtype || '') === 'Surprise') continue;
  if (/\bpromptDamageTarget\s*\(|\bpromptMultiTarget\s*\(/.test(code)) continue;

  // Roher Waehler im Skript?
  const roh = /\b(?:engine|ctx\._engine)\.prompt(?:EffectTarget|Generic)\s*\(/.test(code)
    || /\bctx\.promptCardGallery\s*\(/.test(code)
    || /\bctx\.promptZonePick\s*\(/.test(code);
  if (!roh) continue;

  // Abbrechbar? (`cancellable: false` ueberall → nichts abzubrechen)
  const abbrechbar = /cancellable\s*:\s*true/.test(code)
    || /promptCardGallery\s*\(\s*[^)]*cancellable/.test(code);
  if (!abbrechbar) continue;

  // Wird der Abbruch gemeldet?
  if (/_spellCancelled/.test(code)) continue;

  if (GEPRUEFT[cd.name]) continue;
  verdacht.push({ name: cd.name, datei: path.relative(WURZEL, datei) });
}

if (verdacht.length === 0) {
  console.log(`[check-spell-cancel] OK — kein Zauber mit rohem, abbrechbarem Wähler ohne \`_spellCancelled\` `
    + `(${Object.keys(GEPRUEFT).length} manuell geprüfte Ausnahmen).`);
  process.exit(0);
}

console.log(`[check-spell-cancel] ${verdacht.length} Verdachtsfall/-fälle:\n`);
for (const v of verdacht) {
  console.log(`  ✗ ${v.name}`);
  console.log(`      · öffnet einen rohen, abbrechbaren Wähler, setzt aber nie \`gs._spellCancelled\``);
  console.log(`      · ${v.datei}`);
}
console.log('\n  Ein abgebrochener Zauber MUSS `gs._spellCancelled = true` setzen,');
console.log('  sonst wandert die Karte trotz Abbruch in die Ablage.');
process.exit(1);
