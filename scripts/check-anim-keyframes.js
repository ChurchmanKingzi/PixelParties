'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — KEYFRAMES EINER ANIMATION (v1194, Als Befund 18.9.)
//
//  Eine Animationskomponente in `ANIM_REGISTRY` darf ihre Keyframes
//  aus ZWEI Quellen beziehen:
//    ① aus ihrem EIGENEN `<style>`-Block, oder
//    ② aus `public/style.css` (global, z.B. `healSparkleParticle`,
//       `waterRipple` — von vielen Karten geteilt).
//
//  Was NICHT geht: ein Keyframe aus dem `<style>` einer ANDEREN
//  Komponente. Der existiert nur, solange die andere Komponente
//  gerade gemountet ist — läuft sie nicht mit, bleibt das Element
//  bei `opacity: 0` stehen und die Animation ist schlicht unsichtbar.
//  Kein Fehler, keine Meldung.
//
//  Genau so ist „Tempeluna"s Anlege-Animation aufgelaufen: ihre
//  Dampfschwaden liefen auf `tempeluna-steam-rise`, das nur im
//  `<style>` der Aufstiegs-Animation steht. Beim Aufstieg sah man den
//  Dampf, beim Anlegen nicht — dieselbe Zeile Code.
//
//  Aufruf:  node scripts/check-anim-keyframes.js
//  Rückgabe 0 = sauber, 1 = Komponenten mit fremden Keyframes.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD = path.join(ROOT, 'public', 'app-board.jsx');
const CSS = path.join(ROOT, 'public', 'style.css');

const board = fs.readFileSync(BOARD, 'utf8');
let css = '';
try { css = fs.readFileSync(CSS, 'utf8'); } catch { /* ohne Stylesheet ebenfalls prüfbar */ }

// Global verfügbare Keyframes: alles aus style.css.
const global = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));

// Jede Registry-Komponente in der Form `  name: (() => { … })(),`
const komponenten = [...board.matchAll(/^ {2}([a-z_0-9]+): \(\(\) => \{([\s\S]*?)\n {2}\}\)\(\),/gm)];

const fehlt = [];
for (const [, name, rumpf] of komponenten) {
  // NUR Literale: `animation: bahn` ist eine JS-Variable, die den
  // fertigen Wert traegt — kein Keyframe-Name (Rolling Boulder).
  const benutzt = new Set([...rumpf.matchAll(/animation:\s*[`'"]\s*([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const lokal = new Set([...rumpf.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));
  for (const k of benutzt) {
    if (lokal.has(k) || global.has(k)) continue;
    // Interpolierte Namen (`annoyCatOrbit${i}` → annoyCatOrbit0/1/2):
    // ein globaler Keyframe, der mit dem Praefix beginnt, genuegt.
    if ([...global].some(g => g.startsWith(k)) || [...lokal].some(g => g.startsWith(k))) continue;
    fehlt.push(`  ✗ ${name} → \`${k}\` ist weder lokal noch in style.css`);
  }
}

if (fehlt.length) {
  console.error('[check-anim-keyframes] ✖ Animationen mit fremden Keyframes:\n');
  for (const z of fehlt) console.error(z);
  console.error('\n  Ein Keyframe aus dem <style> einer ANDEREN Komponente existiert nur,');
  console.error('  solange die gerade gemountet ist. Läuft sie nicht mit, bleibt das');
  console.error('  Element unsichtbar — ohne Fehler und ohne Meldung.');
  console.error('  → Keyframe in die eigene Komponente kopieren oder nach style.css.\n');
  process.exit(1);
}
console.log(`[check-anim-keyframes] ✓ ${komponenten.length} Animationen, alle Keyframes auflösbar.`);
process.exit(0);
