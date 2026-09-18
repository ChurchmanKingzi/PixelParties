'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — AoE-FENSTER-WÄCHTER (v1185, Als Auftrag 18.9.)
//
//  Regel (CARD_API ★★ „ANTI-AoE MUSS REAGIEREN KÖNNEN"):
//  Eine Karte, die 2+ Ziele in EINEM Schlag treffen kann, muss ihren
//  Schaden so austeilen, dass die Anti-AoE-Karten darauf reagieren
//  können — „Interference" (Heldenseite) und „Deepsea Idol"
//  (Kreaturenseite). Zwei erlaubte Bauformen:
//
//    (a) ALLE Kreaturen in EINEN `processCreatureDamageBatch`-Aufruf
//        (dort öffnet die Engine das Fenster selbst) plus
//        `beginMultiHit(` für Interference; oder
//    (b) `await engine.beginAoeStrike(zielzahl, { creatures, … })`,
//        wenn die Karte ihre Treffer nacheinander austeilen will
//        (Chain Lightning, Dance of the Flame Pillars).
//
//  VERBOTEN ist die dritte Form, mit der der Bug von v1184 gefunden
//  wurde: `actionDealCreatureDamage` in einer SCHLEIFE ohne
//  `beginAoeStrike`. Jeder Aufruf verpackt seinen Treffer in einen
//  eigenen Batch mit genau einem Eintrag — das Idol-Fenster verlangt
//  zwei und ging deshalb nie auf (Armageddon, 15 weitere Karten).
//
//  AUSNAHMEN stehen in `aoe-window-baseline.json`: Karten, die per
//  Als Ruling (12.9.) mehrere EINZELinstanzen nacheinander austeilen
//  („Repeat as many times as …", „Trigger this effect … times") und
//  deshalb ausdrücklich KEIN Flächenschlag sind. Die Baseline ist
//  eine Allowlist mit Begründung, keine Zählung — wer eine Karte
//  einträgt, schreibt dazu, warum sie kein Flächenschlag ist.
//
//  Aufruf:
//    node scripts/check-aoe-window.js          prüfen (Exit 1 bei Verstoß)
//    node scripts/check-aoe-window.js --all    alle Fundstellen listen
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'cards', 'effects');
const BASELINE = path.join(__dirname, 'aoe-window-baseline.json');
// Die Engine IST der Schadensweg; der Loader liest nur Quelltext.
const ALLOW = new Set(['_engine.js', '_loader.js', '_cpu.js']);

const args = process.argv.slice(2);
const showAll = args.includes('--all');

/** Kommentare und Zeichenketten raus — sonst zählt jede Erklärung mit. */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

const LOOP_RE = /\bfor\s*\(|\bwhile\s*\(|\.forEach\s*\(|\.map\s*\(/;
const DMG_RE = /\bactionDealCreatureDamage\s*\(/;

/**
 * Fundstellen: `actionDealCreatureDamage` innerhalb einer Schleife.
 * Grob über Klammertiefe — reicht für erstpartei-Code und meldet im
 * Zweifel lieber einmal zu viel (die Baseline fängt das ab).
 */
function schleifenTreffer(src) {
  const lines = strip(src).split('\n');
  const treffer = [];
  let tiefe = 0;
  const schleifen = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (LOOP_RE.test(l)) schleifen.push(tiefe);
    if (schleifen.length && DMG_RE.test(l)) treffer.push(i + 1);
    const auf = (l.match(/\{/g) || []).length;
    const zu = (l.match(/\}/g) || []).length;
    tiefe += auf - zu;
    while (schleifen.length && zu > 0 && tiefe <= schleifen[schleifen.length - 1]) schleifen.pop();
  }
  return treffer;
}

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { /* keine Baseline */ }

const verstoesse = [];
const geduldet = [];
const unbalanciert = [];

for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.js') && !ALLOW.has(n))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const nackt = strip(src);

  // ── Prüfung 1: ungeklammerter Mehrfachschlag ──
  const stellen = schleifenTreffer(src);
  if (stellen.length > 0 && !nackt.includes('beginAoeStrike(')) {
    (baseline[f] ? geduldet : verstoesse).push({ f, stellen, grund: baseline[f] });
  }

  // ── Prüfung 2: leckende Klammer ──
  // Jede geöffnete Klammer muss im `finally` wieder zugehen, sonst
  // gelten ALLE folgenden Einzeltreffer fälschlich als Flächenschlag.
  const auf = (nackt.match(/\bbegin(MultiHit|AoeStrike)\s*\(/g) || []).length;
  const zu = (nackt.match(/\bendMultiHit\s*\(/g) || []).length;
  if (auf > 0 && zu === 0) unbalanciert.push(f);
}

if (showAll) {
  console.log('── geduldet (Baseline) ──');
  for (const g of geduldet) console.log(`  ${g.f}: Z. ${g.stellen.join(', ')} — ${g.grund}`);
  console.log('── offen ──');
  for (const v of verstoesse) console.log(`  ${v.f}: Z. ${v.stellen.join(', ')}`);
}

let fehler = 0;
if (verstoesse.length) {
  fehler = 1;
  console.error('[check-aoe-window] ✖ Kreaturenschaden in einer Schleife OHNE Flächenklammer:');
  for (const v of verstoesse) {
    console.error(`   ${v.f} (Zeile ${v.stellen.join(', ')})`);
  }
  console.error('   → entweder alle Kreaturen in EINEN processCreatureDamageBatch,');
  console.error('     oder await engine.beginAoeStrike(zielzahl, { creatures, source, … }).');
  console.error('   → Teilt die Karte bewusst mehrere EINZELinstanzen aus (Als Ruling 12.9.),');
  console.error(`     gehört sie mit Begründung in ${path.basename(BASELINE)}.`);
}
if (unbalanciert.length) {
  fehler = 1;
  console.error('[check-aoe-window] ✖ Flächenklammer ohne endMultiHit:');
  for (const f of unbalanciert) console.error(`   ${f}`);
}

if (!fehler) {
  console.log(`[check-aoe-window] ✓ ${geduldet.length} geduldete Ausnahme(n), keine offenen Verstöße.`);
}
process.exit(fehler);
