'use strict';
// Klänge des Aufbaus (public/skilltest-rules.js prepSounds): jeder angenommene Zustandswechsel macht ein Geräusch, nichts wird doppelt/ohne Anlass gespielt.
//   node scripts/skilltest-e2e/prep-sounds.test.js
const fs = require('fs');
const path = require('path');
const R = require('../../public/skilltest-rules.js');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };
const names = (arr) => arr.map(x => x[0]);
const files = new Set(fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'sounds')).map(f => f.replace(/\.[a-z0-9]+$/, '')));
const base = () => { const p = R.emptyPlayer(); p.hand = ['A', 'B']; return p; };

console.log('Platzieren und Zurücknehmen');
let a = base(), b = base();
b.heroes[0] = 'Hero One'; b.hand = ['B'];
check('Held aufgestellt → summon', names(R.prepSounds(a, b)).includes('summon'), R.prepSounds(a, b));
a = b; b = JSON.parse(JSON.stringify(a)); b.supportZones[0][1] = ['Creature X']; b.hand = [];
check('Karte in eine Support Zone → placement', names(R.prepSounds(a, b)).join() === 'placement', R.prepSounds(a, b));
a = b; b = JSON.parse(JSON.stringify(a)); b.supportZones[0][1] = []; b.hand = ['Creature X'];
check('Karte zurück auf die Hand → draw', names(R.prepSounds(a, b)).join() === 'draw', R.prepSounds(a, b));
a = b; b = JSON.parse(JSON.stringify(a)); b.surpriseZones[0] = 'Trap'; b.hand = [];
check('Surprise gelegt → placement (tiefer)', names(R.prepSounds(a, b)).join() === 'placement' && R.prepSounds(a, b)[0][1].rate < 1, R.prepSounds(a, b));
a = b; b = JSON.parse(JSON.stringify(a)); b.areaZone = ['Some Area'];
check('Area gelegt → heavy_impact', names(R.prepSounds(a, b)).join() === 'heavy_impact', R.prepSounds(a, b));
a = b; b = JSON.parse(JSON.stringify(a)); b.abilityZones[0][0] = { n: 'Toughness', s: 0, c: true };
check('Ability gelegt → ability_activate', names(R.prepSounds(a, b)).join() === 'ability_activate', R.prepSounds(a, b));

console.log('Heldentausch');
a = base(); a.heroes = ['H1', 'H2', null]; b = JSON.parse(JSON.stringify(a)); b.heroes = ['H2', 'H1', null];
check('Zwei Helden getauscht → shuffle', names(R.prepSounds(a, b)).join() === 'shuffle', R.prepSounds(a, b));

console.log('Erschienene Karten (Idej Lords)');
a = base(); b = JSON.parse(JSON.stringify(a));
b.heroes[0] = 'Idej Lord Daiyo'; b.supportZones[0][0] = ['Idej Projection']; b.spawned[0][0] = true;
const sp = R.prepSounds(a, b);
check('Lord + erschienene Karte → summon, dann reveal (verzögert)', names(sp).join() === 'summon,reveal' && sp[1][1].delay > 0, sp);
a = b; b = JSON.parse(JSON.stringify(a)); b.supportZones[0][0] = []; b.spawned[0][0] = false;
check('Erschienene Karte gelöscht → creature_destroyed (nicht draw)', names(R.prepSounds(a, b)).join() === 'creature_destroyed', R.prepSounds(a, b));
a = JSON.parse(JSON.stringify(a)); b = JSON.parse(JSON.stringify(a)); b.heroes[0] = null; b.supportZones[0][0] = []; b.spawned[0][0] = false; b.hand = [...a.hand, 'Idej Lord Daiyo'];
check('Lord zurück auf die Hand: ein Klang (draw), die verschwindenden Karten schweigen', names(R.prepSounds(a, b)).join() === 'draw', R.prepSounds(a, b));

console.log('Bereit, Recycler, Stille');
a = base(); b = JSON.parse(JSON.stringify(a)); b.ready = true;
check('Bereit → buff', names(R.prepSounds(a, b)).join() === 'buff', R.prepSounds(a, b));
check('Bereit zurückgenommen → status_remove', names(R.prepSounds(b, a)).join() === 'status_remove', R.prepSounds(b, a));
a = base(); b = JSON.parse(JSON.stringify(a)); b.recycled = 1; b.hand = ['B'];
check('Recycler-Zug → still (der Recycler vertont ihn selbst)', R.prepSounds(a, b).length === 0, R.prepSounds(a, b));
check('Gleicher Zustand → still', R.prepSounds(a, JSON.parse(JSON.stringify(a))).length === 0);
check('Erster Zustand (kein Vorher) → still', R.prepSounds(null, a).length === 0);

console.log('Alle Klangdateien existieren');
const used = new Set(['draw', 'summon', 'placement', 'heavy_impact', 'ability_activate', 'shuffle', 'reveal', 'creature_destroyed', 'buff', 'status_remove', 'discard', 'gold_gain', 'ping']);
const missing = [...used].filter(n => !files.has(n));
check('Jede benutzte Datei liegt in public/sounds', missing.length === 0, missing);

console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Klang-Tests grün');
process.exit(fails ? 1 : 0);
