// Audio-Selbsttest: node tools/audiotest.mjs [outdir]
// Bündelt tools/audiotest.entry.ts per esbuild, lädt es in Chromium (OfflineAudioContext + echter AudioContext)
// und gibt Messwert-Tabellen aus. WAV-Belege landen in outdir (Standard: Scratchpad, nicht im Repo).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(join(root, 'package.json'));
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');

const outDir = process.argv[2] ?? '/tmp/claude-0/-home-user-PixelParties/4bc61380-38ba-5dc2-a462-dd389c703adf/scratchpad/audio';
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'audiotest.bundle.js');
await esbuild.build({ entryPoints: [join(here, 'audiotest.entry.ts')], bundle: true, format: 'iife', platform: 'browser', target: 'es2022', outfile: bundle, logLevel: 'warning', loader: { '.json': 'json' } });

const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto('about:blank');
await page.addScriptTag({ path: bundle });

const fails = [];
const warns = [];
const f1 = (x, d = 1) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(d) : String(x));
const pad = (s, n) => String(s).padEnd(n);
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const warn = (ok, msg) => { if (!ok) warns.push(msg); };

const T0 = Date.now();
const lap = (s) => console.log(`  (${((Date.now() - T0) / 1000).toFixed(1)} s) ${s}`);
const evalP = (fn, ...args) => page.evaluate(fn, ...args);

// ------------------------------------------------------------------ SFX
console.log('\n== SFX einzeln (OfflineAudioContext, 44.1 kHz, Master-Kette) ==');
const sfx = await evalP(() => window.BBT.sfxTable());
lap('SFX gerendert');
console.log(pad('Name', 17) + pad('Peak@max', 9) + pad('Peak@def', 9) + pad('RMSfen', 8) + pad('Tail ms', 8) + pad('Schwerp.', 9) + pad('<250Hz', 7) + pad('>4k', 6) + pad('DC', 8) + pad('Start', 8) + pad('Ende', 8) + 'Prio');
const expect = {
  // tiefe Klänge: Schwerpunkt niedrig bzw. großer Tiefanteil
  'imp.meteor': { lowMin: 0.4 }, 'break.core': { lowMin: 0.3 }, 'imp.stone': { lowMin: 0.25 }, 'imp.fire': { lowMin: 0.25 }, 'imp.bomb': { lowMin: 0.2 },
  'break.module': { lowMin: 0.3 }, 'break.gate': { lowMin: 0.2 }, 'break.wall': { lowMin: 0.25 }, 'shot.dig': { lowMin: 0.4 }, 'ui.invalid': { centMax: 700 },
  'timestop': { lowMin: 0.1 },
  // hohe Klänge
  'heal': { centMin: 1500 }, 'imp.arcane': { centMin: 1500 }, 'imp.ice': { centMin: 2000 }, 'shot.ice': { centMin: 2500 }, 'ui.hover': { centMin: 1500 },
  'rank': { centMin: 700 }, 'imp.dome': { centMin: 700 }, 'ui.reroll': { centMin: 1200 }, 'shot.arcane': { centMin: 1000 }, 'wish': { centMin: 1000 },
};
for (const r of sfx.rows) {
  console.log(
    pad(r.name, 17) + pad(f1(r.peakMax), 9) + pad(f1(r.peakDef), 9) + pad(f1(r.rms), 8) + pad(Math.round(r.tailMs), 8) + pad(Math.round(r.centroid), 9) +
    pad(f1(r.low * 100, 0) + '%', 7) + pad(f1(r.high * 100, 0) + '%', 6) + pad(f1(r.dc, 4), 8) + pad(f1(r.start, 4), 8) + pad(f1(r.end, 4), 8) + r.prio,
  );
  check(!r.nan, `SFX ${r.name}: NaN`);
  check(r.peakMax <= 0.0001, `SFX ${r.name}: Clipping ${f1(r.peakMax)} dBFS`);
  check(r.rms > -45, `SFX ${r.name}: zu leise/stumm (${f1(r.rms)} dB)`);
  check(r.start < 0.02, `SFX ${r.name}: Knacken am Start (${f1(r.start, 4)})`);
  check(r.end < 0.002, `SFX ${r.name}: Ende nicht bei 0 (${f1(r.end, 4)})`);
  check(Math.abs(r.dc) < 0.01, `SFX ${r.name}: DC-Anteil ${f1(r.dc, 4)}`);
  warn(r.tailMs < 3000, `SFX ${r.name}: Tail ${Math.round(r.tailMs)} ms sehr lang`);
  const ex = expect[r.name];
  if (ex) {
    if (ex.lowMin !== undefined) check(r.low >= ex.lowMin, `SFX ${r.name}: Tiefanteil ${f1(r.low * 100, 0)} % < ${ex.lowMin * 100} %`);
    if (ex.centMax !== undefined) check(r.centroid <= ex.centMax, `SFX ${r.name}: Schwerpunkt ${Math.round(r.centroid)} Hz > ${ex.centMax}`);
    if (ex.centMin !== undefined) check(r.centroid >= ex.centMin, `SFX ${r.name}: Schwerpunkt ${Math.round(r.centroid)} Hz < ${ex.centMin}`);
  }
}

// Unterscheidbarkeit: Spektralabstand (RMS der Bandpegel in dB) und Abklingdauer innerhalb der Familien
function dist(a, b) {
  let s = 0;
  for (let i = 0; i < 16; i++) s += (a.bands[i] - b.bands[i]) ** 2;
  return Math.sqrt(s / 16);
}
function familyReport(prefix, label) {
  const list = sfx.prints.filter((p) => p.name.startsWith(prefix));
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const d = dist(list[i], list[j]);
    const dt = Math.abs(Math.log2((list[i].tail + 50) / (list[j].tail + 50)));
    pairs.push({ a: list[i].name, b: list[j].name, d, dt });
  }
  pairs.sort((x, y) => x.d - y.d);
  console.log(`\n${label}: engste Paare (Spektralabstand dB / Tail-Verhältnis log2)`);
  for (const p of pairs.slice(0, 5)) console.log(`  ${pad(p.a, 14)} ~ ${pad(p.b, 14)} ${f1(p.d)} dB  ${f1(p.dt, 2)}`);
  for (const p of pairs) warn(p.d > 3.0 || p.dt > 0.45, `${label}: ${p.a} und ${p.b} klingen ähnlich (Abstand ${f1(p.d)} dB, Tail ${f1(p.dt, 2)})`);
}
familyReport('shot.', 'Abschüsse');
familyReport('imp.', 'Einschläge');
familyReport('death.', 'Tode');
familyReport('break.', 'Zerstörung');

// ------------------------------------------------------------------ Musik
console.log('\n== Musik (Offline; 8-s-Ausschnitt und Volllänge) ==');
const mus = await evalP(() => window.BBT.musicTable());
lap('Musik gerendert');
console.log(pad('Stück', 15) + pad('BPM', 5) + pad('Takte', 7) + pad('Sek', 7) + pad('RMS@def', 9) + pad('Peak@def', 10) + pad('RMS@max', 9) + pad('Peak@max', 10) + pad('VollPk', 8) + pad('minFens', 8) + pad('Schwp', 7) + pad('<250', 6) + pad('Start', 8) + pad('Sprung', 8) + 'Naht');
for (const r of mus.rows) {
  console.log(
    pad(r.id, 15) + pad(r.bpm, 5) + pad(r.bars, 7) + pad(f1(r.totalSec, 0), 7) + pad(f1(r.rmsDef), 9) + pad(f1(r.peakDef), 10) + pad(f1(r.rmsMax), 9) + pad(f1(r.peakMax), 10) +
    pad(f1(r.fullPeak), 8) + pad(f1(r.fullRmsMin, 0), 8) + pad(Math.round(r.centroid), 7) + pad(f1(r.low * 100, 0) + '%', 6) + pad(f1(r.start, 4), 8) + pad(f1(r.jump, 3), 8) + f1(r.seam, 3),
  );
  console.log(`    Abschnitte (RMS dB/Schwerpunkt Hz je 8 Takte): ${r.sections}`);
  check(!r.nan, `Musik ${r.id}: NaN`);
  check(r.fullPeak <= 0.0001 && r.peakMax <= 0.0001, `Musik ${r.id}: Clipping`);
  check(r.start < 0.02, `Musik ${r.id}: Start-Knacken ${f1(r.start, 4)}`);
  check(r.rmsDef > -45, `Musik ${r.id}: zu leise ${f1(r.rmsDef)} dB`);
  check(r.fullRmsMin > -60, `Musik ${r.id}: Stille im Verlauf (${f1(r.fullRmsMin)} dB)`);
  check(Math.abs(r.dc) < 0.01, `Musik ${r.id}: DC`);
  warn(r.seam < 0.4, `Musik ${r.id}: Schleifennaht Sprung ${f1(r.seam, 3)}`);
  if (['menu', 'build', 'battle', 'pause'].includes(r.id)) check(r.loopBars >= 32, `Musik ${r.id}: nur ${r.loopBars} Takte Schleife`);
  if (r.id.startsWith('afterglow')) check(r.bars >= 32, `Musik ${r.id}: nur ${r.bars} Takte`);
  if (r.id === 'victory' || r.id === 'defeat') check(r.totalSec >= 3 && r.totalSec <= 5, `Stinger ${r.id}: Länge ${f1(r.totalSec)} s außerhalb 3-5 s`);
}

console.log('\n== Übergänge (Überblendung / Stinger / Pause) ==');
const tr = await evalP(() => window.BBT.transitionTests());
lap('Übergänge gerendert');
for (const r of tr) {
  if (r.id === 'speed0-muffle') {
    console.log(`  ${pad(r.id, 16)} Schwerpunkt offen ${Math.round(r.centroidOpen)} Hz -> gedämpft ${Math.round(r.centroidMuffled)} Hz | Höhen >1,5 kHz ${f1(r.hfOpen)} -> ${f1(r.hfMuffled)} dB | RMS ${f1(r.rmsOpen)} -> ${f1(r.rmsMuffled)} dB | Sprung ${f1(r.jumpAround, 3)}`);
    check(r.hfMuffled < r.hfOpen - 12, `Pause (Tempo 0) dämpft Höhen zu wenig (${f1(r.hfOpen)} -> ${f1(r.hfMuffled)} dB)`);
    check(r.rmsMuffled > -60, 'Pause: Musik verschwindet statt gedämpft zu werden');
    check(!r.nan, 'Pause-Dämpfung: NaN');
  } else {
    console.log(`  ${pad(r.id, 16)} Sprung um Wechsel ${f1(r.jumpAround, 3)} (sonst ${f1(r.jumpBase, 3)}) | Peak ${f1(r.peak)} dB | RMS vorher ${f1(r.rmsBefore)} -> nachher ${f1(r.rmsAfter)} dB`);
    check(!r.nan, `Übergang ${r.id}: NaN`);
    check(r.jumpAround <= Math.max(0.35, r.jumpBase * 1.6), `Übergang ${r.id}: Knacken (Sprung ${f1(r.jumpAround, 3)} vs ${f1(r.jumpBase, 3)})`);
    if (r.id.endsWith('off')) check(r.rmsAfter < -65, `Übergang ${r.id}: Musik nicht ausgeblendet`);
  }
}

// ------------------------------------------------------------------ Engine
console.log('\n== Engine: Dauerfeuer von Ereignissen (Musik + SFX, Master-Kette) ==');
const eng = await evalP(() => window.BBT.engineVariants());
lap('Engine-Stress gerendert');
for (const r of eng) {
  console.log(`  Tempo ${r.speed}x, ${pad(r.perSec, 5)} Ereignisse/s: gespielt ${pad(r.played, 5)} verworfen ${pad(r.dropped, 6)} geklaut ${pad(r.stolen, 4)} max. Stimmen ${pad(r.maxActive, 3)} | Peak ${f1(r.peakDb)} dB RMS ${f1(r.rmsDb)} dB | Fehler ${r.errors}`);
  check(!r.nan, 'Engine: NaN');
  check(r.peakDb <= 0.0001, `Engine ${r.speed}x/${r.perSec}: Clipping ${f1(r.peakDb)} dB`);
  check(r.maxActive <= 24, `Engine ${r.speed}x/${r.perSec}: ${r.maxActive} Stimmen > 24`);
  check(r.errors === 0, `Engine ${r.speed}x/${r.perSec}: ${r.errors} Fehler`);
  warn(r.rmsDb < -8, `Engine ${r.speed}x/${r.perSec}: RMS ${f1(r.rmsDb)} dB sehr laut`);
}
const sl = await evalP(() => window.BBT.speedLoudness());
console.log('  Lautheit bei gleicher Ereignisfolge (nur SFX): ' + sl.map((r) => `${r.speed}x ${f1(r.rmsDb)} dB (gespielt ${r.played}/verworfen ${r.dropped})`).join(' | '));
check(sl[3].rmsDb < sl[0].rmsDb - 2, 'Lautheit sinkt bei 8x nicht ausreichend');
const sp = await evalP(() => window.BBT.spatialTest());
console.log('  Raumklang (Einschlag bei x, Hörer Mitte): ' + sp.map((r) => `x=${r.x}: pan(R-L) ${f1(r.panDb)} dB, Peak ${f1(r.peakDb)} dB, Schwp ${Math.round(r.centroid)} Hz`).join(' | '));
check(sp[0].panDb < -3 && sp[4].panDb > 3, 'Stereo-Pan: links/rechts nicht deutlich');
check(Math.abs(sp[2].panDb) < 1.5, 'Stereo-Pan: Mitte nicht zentriert');
check(sp[2].peakDb > sp[0].peakDb && sp[2].peakDb > sp[4].peakDb, 'Entfernungsdämpfung fehlt');

// ------------------------------------------------------------------ Live
console.log('\n== Live: echter AudioContext in Chromium ==');
const live = await evalP(() => window.BBT.liveTest());
lap('Live-Test beendet');
console.log('  ' + JSON.stringify(live));
check(live.errors.length === 0, 'Live: ' + live.errors.join(' | '));
check(live.state === 'running', `Live: AudioContext-Status ${live.state}`);
check(live.beforeUnlockStats === 0, 'Live: Klänge vor unlock()');
check(live.maxActive <= 24, `Live: ${live.maxActive} Stimmen`);
check(live.activeAfterQuiet === 0, `Live: ${live.activeAfterQuiet} Stimmen hängen nach Ruhe`);
check(live.layersAfterSwitches <= 1, `Live: ${live.layersAfterSwitches} Musikebenen nach den Wechseln (Aufräumen)`);
check(live.mutedPlayed === 0, 'Live: Klang trotz Stumm');
check(live.peakDb <= 0.0001, `Live: Peak ${f1(live.peakDb)} dB`);
check(live.musicMenuRmsDb > -70, `Live: Menümusik stumm (${f1(live.musicMenuRmsDb)} dB)`);
const smoke = await evalP(() => window.BBT.singletonSmoke());
check(smoke.ok, 'Singleton-Smoke-Test');

// ------------------------------------------------------------------ Bedienelement (DOM)
console.log('\n== controls.ts: Mute-Knopf und Regler ==');
for (const dark of [false, true]) {
  await evalP((d) => window.BBT.controlsSetup(d), dark);
  const btn = page.locator('.bbau-btn');
  const s0 = await evalP(() => window.BBT.controlsState());
  check(s0.exists && s0.title === 'Sound (M)', 'Controls: Knopf/Titel fehlt');
  check(s0.popDisplay === 'none', 'Controls: Popover standardmäßig sichtbar');
  check(s0.sliders.join() === '80,35,70', `Controls: Regler-Startwerte ${s0.sliders.join()}`);
  await btn.hover();
  const s1 = await evalP(() => window.BBT.controlsState());
  check(s1.popDisplay === 'block', 'Controls: Popover erscheint nicht beim Hover');
  await page.locator('#bbau-music').fill('60');
  const s2 = await evalP(() => window.BBT.controlsState());
  check(Math.abs(s2.volume.music - 0.6) < 0.001, `Controls: Music-Regler wirkt nicht (${s2.volume.music})`);
  await page.screenshot({ path: join(outDir, `controls_${dark ? 'dark' : 'light'}_popover.png`), clip: { x: 0, y: 0, width: 600, height: 170 } });
  await btn.click();
  const s3 = await evalP(() => window.BBT.controlsState());
  check(s3.volume.muted === true && s3.pressed === 'true', 'Controls: Klick schaltet nicht stumm');
  await page.screenshot({ path: join(outDir, `controls_${dark ? 'dark' : 'light'}_muted.png`), clip: { x: 0, y: 0, width: 600, height: 170 } });
  await btn.click();
  const s4 = await evalP(() => window.BBT.controlsState());
  check(s4.volume.muted === false, 'Controls: zweiter Klick hebt Stumm nicht auf');
  await page.mouse.move(300, 400);
  await btn.click({ button: 'right' });
  const s5 = await evalP(() => window.BBT.controlsState());
  check(s5.open && s5.popDisplay === 'block', 'Controls: Rechtsklick öffnet das Popover nicht');
  await page.screenshot({ path: join(outDir, `controls_${dark ? 'dark' : 'light'}_pinned.png`), clip: { x: 0, y: 0, width: 600, height: 170 } });
  await btn.click({ button: 'right' });
  const s6 = await evalP(() => window.BBT.controlsState());
  check(!s6.open, 'Controls: zweiter Rechtsklick schließt das Popover nicht');
  console.log(`  ${dark ? 'dunkel' : 'hell  '}: Titel "${s0.title}", Hover-Popover ${s1.popDisplay}, Music 60 % -> ${s2.volume.music}, Mute ${s3.volume.muted}->${s4.volume.muted}, Rechtsklick offen ${s5.open}`);
}

// ------------------------------------------------------------------ WAV-Belege
console.log('\n== WAV-Belege ==');
const names = await evalP(() => window.BBT.sfxNames);
const set1 = names.filter((n) => n.startsWith('shot.') || n.startsWith('imp.') || n === 'hit');
const set2 = names.filter((n) => !set1.includes(n));
const w1 = await evalP((n) => window.BBT.sfxSetWav(n, 1.25), set1);
const w2 = await evalP((n) => window.BBT.sfxSetWav(n, 1.15), set2);
writeFileSync(join(outDir, 'sfx_shots_impacts.wav'), Buffer.from(w1, 'base64'));
writeFileSync(join(outDir, 'sfx_rest.wav'), Buffer.from(w2, 'base64'));
for (const [k, v] of Object.entries(mus.wav)) writeFileSync(join(outDir, `music_${k}.wav`), Buffer.from(v, 'base64'));
console.log(`  geschrieben nach ${outDir}: sfx_shots_impacts.wav, sfx_rest.wav, ${Object.keys(mus.wav).map((k) => `music_${k}.wav`).join(', ')}`);

const bad = logs.filter((l) => /error|pageerror/i.test(l));
if (bad.length) { console.log('\nKonsole:'); for (const l of bad.slice(0, 20)) console.log('  ' + l); }
check(bad.length === 0, 'Konsolenfehler: ' + bad.slice(0, 3).join(' | '));

console.log(`\n== Ergebnis: ${fails.length ? 'FEHLER' : 'OK'} (${fails.length} Fehler, ${warns.length} Hinweise) ==`);
for (const w of warns) console.log('  Hinweis: ' + w);
for (const f of fails) console.log('  FEHLER: ' + f);
await browser.close();
process.exit(fails.length ? 1 : 0);
