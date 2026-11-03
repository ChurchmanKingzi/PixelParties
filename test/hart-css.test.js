'use strict';
// Vorgebackene Stylesheets: public/style.hart.css (und style-skilltest.hart.css) müssen zu den Quellen passen — sonst: node scripts/hart/build-css.js
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/hart/build-css.js');

test('gebackene Stylesheets sind aktuell (style.css / pixel-hart.js / Palette unverändert seit dem Backen)', () => {
  assert.deepEqual(B.veraltet(), [], 'style.hart.css veraltet → node scripts/hart/build-css.js (braucht Playwright; vorher: node scripts/build.js)');
});

test('Scanner zerlegt Regeln, Keyframes und verschachtelte Container', () => {
  const t = '/* c */ a { color: red; box-shadow: 0 0 8px url("x;y") ; }\n@media (min-width: 1px) { b > c { margin: 0 !important } }\n@keyframes k { from { opacity: 0 } to { opacity: 1; } }\n@font-face { font-family: f; src: url(a.woff2); }';
  const u = B.scanner(t);
  assert.equal(u.length, 3);
  assert.equal(u[0].kind, 'rule'); assert.deepEqual(u[0].decls.map((d) => d.name), ['color', 'box-shadow']);
  assert.equal(u[0].decls[1].val, '0 0 8px url("x;y")');
  assert.equal(u[1].kind, 'rule'); assert.equal(u[1].decls[0].imp, true);
  assert.equal(u[2].kind, 'kf'); assert.equal(u[2].steps.length, 2);
});
