#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ZUGNUMMERN-FRISTEN UND „NUR ECHTE ZÜGE ZÄHLEN"  (W68a; Ordnungs-/Folge-Zähler W69a)
//
//  Anlass (Al, 23.10.2026): Ein ÜBERSPRUNGENER Zug (Guardian Beast Zhu, Hand of Death) ist kein Zug — er beendet keine Frist, bringt keinen
//  Zähler vorwärts und löst keine Zugende-Auslöser aus. Technisch: der Skip lässt die Zugnummer verstreichen; Fristen, die als ZUGNUMMER abgelegt
//  sind (`expiresAtTurn`/`expiresForPlayer`, `_identityExpiresTurn`, `untilTurn` …), schiebt `fristenNachSkip` (cards/effects/_zug-fristen.js) um
//  zwei Zugnummern weiter — aber NUR, wenn die Frist weiß, welchen Zug sie zählt:
//     • Standard: Frist endet am ENDE des Zuges `expiresAtTurn − 1` („until the end of …", „for N turns", „this turn");
//     • `fristBeginn: true`: Frist endet zu BEGINN des Zuges `expiresAtTurn` („until the beginning/start of your next turn").
//
//  Dieses Skript hält zwei Dinge fest:
//   1. Jedes Kartenskript mit einer Zugnummern-Frist (`expiresAtTurn:` …) steht in der GEPRÜFTEN Liste unten (= CARD_API „Welle 68 / W68a",
//      Audit-Tabelle). Eine neue Datei meldet sich hier: sie muss gegen den Kartentext geprüft und eingetragen werden.
//   2. Lautet der Kartentext „until the beginning/start of your next turn" (oder „until your next turn"), muss das Skript `fristBeginn` setzen.
//
//  Aufruf:  node scripts/check-zugfristen.js        Rückgabe 0 = sauber, 1 = Befund.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const NACH_SLUG = new Map(KARTEN.map(k => [slug(k.name), k]));

// Geprüfte Skripte mit Zugnummern-Frist (Audit CARD_API „Welle 68 / W68a"). Neue Datei ⇒ Kartentext lesen, Frist als ENDE/BEGINN einordnen, hier eintragen.
const GEPRUEFT = new Set([
  // „this turn" / „for the rest of the turn" (gezählt wird der laufende, echte Zug — nie von einem Skip betroffen)
  'cloud-in-a-bottle', 'dark-gear', 'diplomacy', 'dirty-smuggler', 'elixir-of-cold', 'ghuanjun-the-undead-martial-artist', 'golden-wings', 'greatmaw-shark',
  'guardian-beast-niu', 'hockey-genie', 'jump-in-the-river', 'soul-shard-ka', 'the-cosmic-depths', 'the-master-s-key', 'unwanted-audience',
  // ENDE eines fremden/eigenen nächsten Zuges
  'anti-magic-zone', 'disruption-ray', 'forbidden-zone', 'medusa-s-curse', 'null-the-mage-slayer', 'null-zone', 'pink-sky', 'rool-the-troll-guard',
  'skeleton-death-knight', 'smoke-vial', 'unreasonable-anger', 'nasty-prank',
  // BEGINN des nächsten eigenen Zuges (setzen `fristBeginn: true`)
  'cloud-pillow', 'howling-in-the-night', 'infinitely-reproducing-slime', 'locke-the-unseen-saboteur', 'loyal-shepherd', 'mao-the-vengeful-guardian',
  'necromancy', 'omikron-the-faceless-illusionist', 'sparky-slime', 'string-of-fine', 'unsettling-opportunist-vullary',
  // Zusatzaktionen „this turn" (`expiresAtTurnEnd`, ohne Zugnummer) und eigene Speicher mit Handler in `fristenNachSkip`
  'calm-diatribe', 'cute-crown', 'deepsea-primordium', 'mission-of-the-light-brigade', 'weapon-unleashing', 'guardian-beast-gou',
]);

// Eigene Zugnummern-Speicher (nicht `expiresAtTurn`): Datei → Stichwort im Skript → Handler-Stichwort in `fristenNachSkip`.
const SPEICHER = [
  { datei: 'moe-shield.js', stichwort: 'drawLockedUntilTurn', handler: 'drawLockedUntilTurn' },
  { datei: 'stealthy-pursuit.js', stichwort: 'untilTurn', handler: '_targetBlockers' },
  { datei: 'resilient-monkee.js', stichwort: '_monkeeShieldUntilTurn', handler: '_monkeeShieldUntilTurn' },
  { datei: 'barrier-of-undying.js', stichwort: 'markiereBrettLoeschung', handler: '_zugendeLoeschungen' },
  { datei: 'perilous-journey.js', stichwort: '_handAscensionGrants', handler: '_handAscensionGrants' },
  { datei: 'hardy-slime.js', stichwort: 'forcesTargeting_untilTurn', handler: 'forcesTargeting_untilTurn' },
  { datei: 'deepsea-horror-clown.js', stichwort: 'forcesTargeting_untilTurn', handler: 'forcesTargeting_untilTurn' },
  { datei: 'the-throne-robber.js', stichwort: '_identityExpiresTurn', handler: '_identityExpiresTurn' },
  { datei: 'open-invitation.js', stichwort: '_identityExpiresTurn', handler: '_identityExpiresTurn' },
  { datei: 'the-shapeshifter.js', stichwort: '_identityExpiresTurn', handler: '_identityExpiresTurn' },
  { datei: 'perfect-disguise.js', stichwort: 'gegnerZug', handler: 'gegnerZug' },
];
// Beginn-Fristen mit eigenem Speicher (Stempel + `activePlayer`-Prüfung), die ohne `fristBeginn` auskommen.
const EIGENER_BEGINN = new Set(['guardian-beast-gou']);
// Begründete Zugnummern-Rechnungen ohne eigenen Fristnamen.
const AUSNAHMEN = [{ datei: 'the-shapeshifter.js', muster: /return gs\.turn \+ 1;/ }];

let fehler = 0;
const melde = (m) => { fehler++; console.log('✗ ' + m); };

// 1) Dateien mit `expiresAtTurn` (außer Engine-Hilfsdateien)
for (const f of fs.readdirSync(EFFEKTE)) {
  if (!f.endsWith('.js') || f.startsWith('_')) continue;
  const quelle = fs.readFileSync(path.join(EFFEKTE, f), 'utf8');
  const code = quelle.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
  if (!/expiresAtTurn\s*[:=]|expiresAtTurn,/.test(code)) continue;
  const name = f.replace(/\.js$/, '');
  if (!GEPRUEFT.has(name)) melde(`${f}: Zugnummern-Frist (expiresAtTurn) in einem nicht geprüften Skript — Kartentext lesen, ENDE oder BEGINN einordnen (fristBeginn), in scripts/check-zugfristen.js eintragen und in CARD_API „Welle 68 / W68a" aufnehmen`);
  const karte = NACH_SLUG.get(name);
  if (karte && /until the (beginning|start) of your next turn|until your next turn|start of your next turn/i.test(karte.effect || '') && !/fristBeginn/.test(code) && !EIGENER_BEGINN.has(name)) {
    melde(`${f}: Kartentext „${(karte.effect.match(/until[^.]*next turn/i) || [''])[0]}" — das Skript muss \`fristBeginn: true\` setzen (Frist endet zu BEGINN des nächsten eigenen Zuges)`);
  }
}

// 2) Eigene Speicher haben einen Handler
const fristen = fs.readFileSync(path.join(EFFEKTE, '_zug-fristen.js'), 'utf8');
for (const { datei, stichwort, handler } of SPEICHER) {
  const p = path.join(EFFEKTE, datei);
  if (!fs.existsSync(p)) { melde(`${datei}: Datei fehlt (Speicher-Liste veraltet)`); continue; }
  if (!fs.readFileSync(p, 'utf8').includes(stichwort)) melde(`${datei}: Stichwort ${stichwort} nicht mehr gefunden (Speicher-Liste veraltet)`);
  if (!fristen.includes(handler)) melde(`${datei}: Speicher ${stichwort} hat keinen Handler in cards/effects/_zug-fristen.js (fristenNachSkip)`);
}

// 3) Neue Speicher mit `gs.turn + N` in einem unbekannten Namen
const BEKANNT = /expiresAtTurn|UntilTurn|untilTurn|_identityExpiresTurn|markiereBrettLoeschung|_handAscensionGrants|grantOnTurn|teleportalUntil|_teleportalUntil|deleteTurn|expiresTurn|expiryTurn|negatedUntilTurn|armedTurn|_hammerLockTurn|thicketTurn|_frostbringerTurn|_slimeSpawnedTurn|_willyFirstTurn|bisZug|amZug|faelligIn|meineNaechste|meinNaechster|expiresAtTurnEnd/;
for (const f of fs.readdirSync(EFFEKTE)) {
  if (!f.endsWith('.js') || f.startsWith('_')) continue;
  const zeilen = fs.readFileSync(path.join(EFFEKTE, f), 'utf8').split('\n');
  zeilen.forEach((z, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(z)) return;
    if (!/(gs|engine\.gs|state)\.turn\s*\+\s*[1-9]|\bturn\s*\+\s*[2-9]/.test(z)) return;
    if (BEKANNT.test(z)) return;
    if (/log\(|console\./.test(z)) return;
    if (AUSNAHMEN.some(a => a.datei === f && a.muster.test(z))) return;
    melde(`${f}:${i + 1}: Zugnummern-Rechnung \`${z.trim().slice(0, 110)}\` ohne bekannten Fristnamen — eine neue Zugnummern-Frist braucht einen Handler in _zug-fristen.js (und einen Eintrag hier)`);
  });
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//  W69a — ORDNUNGS- UND FOLGE-ZÄHLER („your Nth turn", „2 consecutive turns", „every other turn") rechnen nie selbst mit Zugnummern
//  Al, 23.10.2026: übersprungene Züge zählen dort nicht mit. Die Hilfen stehen in `_zug-fristen.js` (`echteEigeneZuegeBis`, `echterEigenerZugIndex`,
//  `echterEigenerZugNr`, `vorigerEchterEigenerZug`, `istFolgezug`; Engine-Wrapper gleichen Namens).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// 4) Die Hilfen existieren, und jede Karte mit Ordnungs-/Folge-Zähler ruft sie (statt `turn − N`, `turn % 2` …).
for (const h of ['echteEigeneZuegeBis', 'echterEigenerZugIndex', 'echterEigenerZugNr', 'vorigerEchterEigenerZug', 'istFolgezug']) {
  if (!new RegExp('module\\.exports[\\s\\S]*' + h).test(fristen)) melde(`_zug-fristen.js: Hilfe ${h} fehlt im Export`);
  if (!new RegExp('\\b' + h + '\\s*\\(').test(fs.readFileSync(path.join(EFFEKTE, '_engine.js'), 'utf8'))) melde(`_engine.js: Wrapper ${h}(…) fehlt`);
}
const FOLGE_KARTEN = [
  { datei: 'thicket.js', hilfe: 'istFolgezug', text: '2 consecutive turns' },
  { datei: 'jump-in-the-river.js', hilfe: 'istFolgezug', text: '2 consecutive turns' },
  { datei: 'blade-of-the-frostbringer.js', hilfe: 'echteEigeneZuegeBis', text: '2 consecutive turns' },
  { datei: 'hammer-throw.js', hilfe: 'echteEigeneZuegeBis', text: 'every other turn' },
  { datei: 'cheat-chair.js', hilfe: 'echterEigenerZugNr', text: 'third turn' },
  { datei: 'willy-the-valiant-leprechaun.js', hilfe: 'echterEigenerZugIndex', text: 'first turn' },
  { datei: 'petrifying-potion.js', hilfe: 'echteEigeneZuegeBis', text: 'Restdauer aus Zugnummern' },
];
for (const { datei, hilfe, text } of FOLGE_KARTEN) {
  const p = path.join(EFFEKTE, datei);
  if (!fs.existsSync(p)) { melde(`${datei}: Datei fehlt (Folge-Karten-Liste veraltet)`); continue; }
  const code = fs.readFileSync(p, 'utf8').split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
  if (!new RegExp('\\b' + hilfe + '\\b').test(code)) melde(`${datei}: „${text}" muss ${hilfe} aufrufen (nur echte Züge zählen) — keine eigene Zugnummern-Rechnung`);
}
// Der Kartentext hat eine Ordnungs-/Folge-Klausel? Dann steht die Karte oben in FOLGE_KARTEN (neue Karte ⇒ prüfen, Hilfe einbauen, eintragen).
const FOLGE_TEXT = /\b(first|second|third|fourth|fifth) turn\b|\bconsecutive turns?\b|\bevery other turn\b|\bturns? in a row\b/i;
const FOLGE_BEKANNT = new Set([...FOLGE_KARTEN.map(k => k.datei.replace(/\.js$/, '')), 'butterfly-cloud', 'barker-the-monster-tamer', 'first-contact', 'night-the-herald-of-chess']);
for (const k of KARTEN) {
  const m = (k.effect || '').match(FOLGE_TEXT);
  if (!m) continue;
  if (/\bboth players\b|\bat the end of your first turn\b/.test('')) continue;
  const name = slug(k.name);
  if (!FOLGE_BEKANNT.has(name)) melde(`Karte „${k.name}": Kartentext „${m[0]}" — Ordnungs-/Folge-Klausel; mit den Hilfen aus _zug-fristen.js umsetzen und in FOLGE_KARTEN/FOLGE_BEKANNT eintragen`);
}

// 5) Keine eigene Folge-Arithmetik mit `gs.turn` in Kartenskripten (Differenz, Parität, Halbieren). Begründete Altstellen stehen in FOLGE_AUSNAHMEN.
const FOLGE_AUSNAHMEN = [
  { datei: 'petrifying-potion.js', muster: /echteEigeneZuegeBis\(/ },                 // `gs.turn - 1` = Obergrenze für die Hilfe, keine Differenz
  { datei: 'magic-lamp.js', muster: /gs\.turn \|\| 1\) <= 1/ },                         // Spielregel: nicht im allerersten Zug des Spiels
  { datei: 'hammer-throw.js', muster: /gs\.turn \|\| 1\) > 1/ },                       // Spielregel: nicht im allerersten Zug des Spiels
  { datei: 'thicket.js', muster: /gs\.turn \|\| 0\) < 3/ },                            // CPU-Anstoß (Zug ≥ 3), keine Spielregel
  { datei: 'perfect-disguise.js', muster: /gs\.turn \|\| 0\) < 5/ },                   // CPU-Anstoß
  { datei: 'moe-shield.js', muster: /./ }, { datei: 'barrier-of-undying.js', muster: /./ },   // Zugnummern-Fristen (Abschnitt 3, Handler in fristenNachSkip)
];
const FOLGE_ARITH = /(gs|engine\.gs|state|ctx\.gameState)\.turn\s*(\|\|\s*\d+\)?\s*)?[-%]\s*[\w(.]|\bturn\s*%\s*2|[Tt]urn\s*\)?\s*\/\s*2\b|Math\.(floor|ceil)\([^)]*[Tt]urn[^)]*\/\s*2|zugIndexVon\(/;
for (const f of fs.readdirSync(EFFEKTE)) {
  if (!f.endsWith('.js') || f.startsWith('_') && !/-shared\.js$/.test(f)) continue;
  if (/^_(cpu|train|decision|deck-profile|ability-worth|area-removal)/.test(f)) continue;   // CPU-/Lern-Heuristiken rechnen mit Zugnummern, ohne Spielregel
  const zeilen = fs.readFileSync(path.join(EFFEKTE, f), 'utf8').split('\n');
  zeilen.forEach((z, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(z) || /log\(|console\./.test(z)) return;
    const code = z.replace(/\/\/.*$/, '');
    if (!FOLGE_ARITH.test(code)) return;
    if (FOLGE_AUSNAHMEN.some(a => a.datei === f && a.muster.test(code))) return;
    melde(`${f}:${i + 1}: Folge-/Ordnungs-Arithmetik mit Zugnummern \`${code.trim().slice(0, 110)}\` — nur echte Züge zählen: engine.echteEigeneZuegeBis / echterEigenerZugIndex / echterEigenerZugNr / vorigerEchterEigenerZug / istFolgezug verwenden (oder begründete Ausnahme in scripts/check-zugfristen.js)`);
  });
}

if (fehler) { console.log(`\n${fehler} Befund(e).`); process.exit(1); }
console.log('check-zugfristen: sauber');
