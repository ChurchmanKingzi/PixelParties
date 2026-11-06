#!/usr/bin/env node
'use strict';
// Erzeugt die Retro-Fassung der Stylesheets:  public/style.css → public/style.retro.css  (und style-skilltest).
// Regeln der Umwandlung: public/retro-core.js.  Handgeschriebene Zusatzregeln: scripts/retro/retro-extra.css (wird angehaengt).
//   node scripts/retro/build-css.js
const fs = require('fs');
const path = require('path');
const core = require('../../public/retro-core.js');
const ROOT = path.join(__dirname, '..', '..');
const DATEIEN = ['style.css', 'style-skilltest.css'];
const extraPfad = path.join(__dirname, 'retro-extra.css');
const extra = fs.existsSync(extraPfad) ? fs.readFileSync(extraPfad, 'utf8') : '';
for (const f of DATEIEN) {
  const src = fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
  const t0 = Date.now();
  const quelle = f === 'style.css' ? src + '\n\n/* ── RETRO-ZUSATZ (scripts/retro/retro-extra.css) ── */\n' + extra : src;
  const out = core.css(quelle);
  const ziel = path.join(ROOT, 'public', f.replace(/\.css$/, '.retro.css'));
  fs.writeFileSync(ziel, '/* ERZEUGT von scripts/retro/build-css.js aus ' + f + ' — nicht von Hand aendern. */\n' + out, 'utf8');
  console.log(f, '→', path.relative(ROOT, ziel), (src.length / 1024).toFixed(0) + ' kB →', (out.length / 1024).toFixed(0) + ' kB', (Date.now() - t0) + ' ms');
}
