#!/usr/bin/env node
'use strict';
// Entfernt gelernte Werte zu bestimmten Karten aus einem Skill-Test-Profil — für den Fall, dass sich die Regeln einer Karte im
// Modus ändern (z. B. Idej Lords spawnen ihre Karten jetzt selbst) und das bisher Gelernte nicht mehr stimmt.
//
//   node scripts/skilltest-profile-purge.js <profil.json> <Muster> [--dry]
//
// <Muster> ist ein regulärer Ausdruck (ohne Schrägstriche) gegen die Schlüssel, z. B. "Idej". Betroffen: playValue, cardValue,
// dealtValue, prepValue, pairValue (Schlüssel „A|B") sowie keepModel.u / keepModel.w. Der Trainer darf nicht laufen (Statusdatei
// <profil>.status.json mit lebender PID → Abbruch). Vor dem Schreiben entsteht <profil>.bak-purge.
const fs = require('fs');
const path = require('path');

const [file, pattern] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
if (!file || !pattern) { console.error('Aufruf: node scripts/skilltest-profile-purge.js <profil.json> <Muster> [--dry]'); process.exit(2); }
const re = new RegExp(pattern);

try {
  const st = JSON.parse(fs.readFileSync(file.replace(/\.json$/, '') + '.status.json', { encoding: 'utf-8' }));
  let alive = false; try { process.kill(st.pid, 0); alive = true; } catch { /* beendet */ }
  if (alive) { console.error(`✗ Der Trainer läuft noch (PID ${st.pid}) — erst beenden (SIGTERM), sonst überschreibt er die Änderung.`); process.exit(1); }
} catch { /* keine Statusdatei: nichts läuft */ }

const profile = JSON.parse(fs.readFileSync(file, { encoding: 'utf-8' }));
const removed = {};
const prune = (obj, label) => {
  if (!obj || typeof obj !== 'object') return;
  let n = 0;
  for (const k of Object.keys(obj)) if (re.test(k)) { delete obj[k]; n++; }
  removed[label] = n;
};
for (const section of ['playValue', 'cardValue', 'dealtValue', 'prepValue', 'pairValue']) prune(profile[section], section);
if (profile.keepModel) { prune(profile.keepModel.u, 'keepModel.u'); prune(profile.keepModel.w, 'keepModel.w'); }
console.log((dry ? '[Probelauf] würde entfernen: ' : 'Entfernt: ') + JSON.stringify(removed));
if (dry) process.exit(0);
fs.copyFileSync(file, file + '.bak-purge');
const tmp = file + '.tmp-purge';
fs.writeFileSync(tmp, JSON.stringify(profile), { encoding: 'utf-8' });
fs.renameSync(tmp, file);
console.log('✓ geschrieben:', path.resolve(file), '(Sicherung:', file + '.bak-purge)');
