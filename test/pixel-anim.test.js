'use strict';
// W86z: Pixelart-Pipeline fuer Bewegung (public/pixel-anim.js, reine Funktionen) + Wächter scripts/check-pixel-anim.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pixel-anim.js').rein;
const check = require('../scripts/check-pixel-anim');

test('Dither-Stufen: 0 = weg, 16 = voll, dazwischen 1..15; Kachel hat genau Stufe-viele gesetzte Zellen', () => {
  assert.equal(P.ditherStufe(0), 0);
  assert.equal(P.ditherStufe(1), 16);
  assert.equal(P.ditherStufe(0.5), 8);
  assert.equal(P.ditherStufe(0.01), 0);
  assert.equal(P.ditherStufe(0.99), 16);
  for (let s = 0; s <= 16; s++) {
    let n = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (P.ditherAn(s, x, y)) n++;
    assert.equal(n, s, 'Stufe ' + s);
  }
  // geschachtelt: jede hoehere Stufe enthaelt alle Punkte der niedrigeren (kein Flimmern beim Ein-/Ausblenden)
  for (let s = 1; s < 16; s++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (P.ditherAn(s, x, y)) assert.ok(P.ditherAn(s + 1, x, y));
  assert.match(P.ditherKachelSvg(8), /^<svg [^>]*width='8' height='8' shape-rendering='crispEdges'>/);
  assert.match(P.ditherMaske(8), /^url\("data:image\/svg\+xml,/);
});

test('Skalierung rastet auf ganze Kunstpixel-Breiten, Verschiebung auf Kunstpixel', () => {
  assert.equal(P.snapScale(1.3, 40, 2), 1.5);
  assert.equal(P.snapScale(1.0652, 92, 2), 1);
  assert.equal(P.snapScale(0.1, 40, 2), 0);                 // zu klein → ausgeblendet
  assert.equal(P.snapScale(0.3, 40, 2), 0.5);
  assert.equal(P.snapScale(-0.7, 40, 2), -0.5);
  assert.equal(P.snapScale(1.3, 40, 4), 1.25);              // Szenen mit eigenem Raster (--pp-raster)
  assert.equal(P.snapPx(5.9, 2), 6);
  assert.equal(P.snapPx(-3.2, 2), -4);
  assert.equal(P.snapPx(-1, 2), -2); assert.equal(P.snapPx(1, 2), 2); assert.equal(P.snapPx(0.4, 2), 0);   // symmetrisch
  assert.equal(P.snapPx(7, 5), 5);
});

test('Matrix zerlegen/zusammensetzen, Quantisierung, Viertelschritte', () => {
  const m = P.zusammensetzen({ tx: 10, ty: -6, rot: 35, sx: 1.5, sy: 2, sch: 0 });
  const z = P.zerlegen(m);
  assert.ok(Math.abs(z.rot - 35) < 1e-9 && Math.abs(z.sx - 1.5) < 1e-9 && Math.abs(z.sy - 2) < 1e-9 && Math.abs(z.tx - 10) < 1e-9);
  assert.equal(P.zerlegen([NaN, 0, 0, 1, 0, 0]), null);
  assert.deepEqual(P.matrixLesen('none'), [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(P.matrixLesen('matrix(1, 0, 0, 1, 5, 6)'), [1, 0, 0, 1, 5, 6]);
  assert.equal(P.matrixLesen('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 5,6,0,1)').join(), '1,0,0,1,5,6');
  assert.equal(P.matrixLesen('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 5,6,3,1)') && 1, 1);   // z-Anteil bleibt (nicht zerlegt)
  assert.ok(P.rechtwinklig(0) && P.rechtwinklig(90) && P.rechtwinklig(-180) && !P.rechtwinklig(35) && P.rechtwinklig(270.1));
  assert.equal(P.winkelSnap(130, 90), 90);
  assert.equal(P.winkelSnap(-50, 90), -90);
  assert.equal(P.winkelSnap(37, 15), 30);
  const q = P.transformQuantisieren(m, 40, 40, 2, 90);
  assert.equal(q.z.rot, 0);                                  // 35° → 0 (Viertelschritt)
  assert.equal(q.z.tx, 10); assert.equal(q.z.ty, -6);
  assert.equal(q.css, 'translate(10px, -6px) scale(1.5, 2)');
  assert.equal(P.transformCss({ tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 }), 'none');
});

test('Listen an oberster Ebene teilen (Klammern/Anfuehrungszeichen), px runden', () => {
  assert.deepEqual(P.listeTeilen('url("a,b"), rgba(1,2,3,.5) 10px, x'), ['url("a,b")', 'rgba(1,2,3,.5) 10px', 'x']);
  assert.equal(P.laengenRunden('12.4px 3.6px auto'), '12px 4px auto');
});

test('Drehen: 90 Grad bildet Pixel verlustfrei ab, 0 Grad ist die Identitaet, Farben bleiben Farben der Quelle', () => {
  // 3x2 Quelle: oben R G B, unten Y K W (Kunstpixel 2 px, Ursprung Mitte)
  const farben = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [10, 10, 10], [250, 250, 250]];
  const data = new Uint8ClampedArray(3 * 2 * 4);
  farben.forEach((f, i) => { data.set([f[0], f[1], f[2], 255], i * 4); });
  const src = { w: 3, h: 2, data };
  const O = [3, 2];                                            // Mitte der 6 x 4 px Box
  const id = P.drehen(src, 0, 0, [1, 0, 0, 1], O, { raster: 2 });
  assert.equal(id.w, 3); assert.equal(id.h, 2);
  assert.deepEqual([...id.data], [...data]);
  const r90 = P.drehen(src, 0, 0, [0, 1, -1, 0], O, { raster: 2 });          // 90° im Uhrzeigersinn (CSS)
  assert.equal(r90.w, 2); assert.equal(r90.h, 3);
  const px = (r, x, y) => [...r.data.slice((y * r.w + x) * 4, (y * r.w + x) * 4 + 3)].join();
  // nach 90° cw: linke Spalte von oben = Y, R ; rechte Spalte = K, G ... (Zeile y der Quelle wird zur Spalte)
  assert.equal(px(r90, 1, 0), '255,0,0');                       // R oben links der Quelle → oben rechts
  assert.equal(px(r90, 0, 0), '255,255,0');                     // Y unten links → oben links
  assert.equal(px(r90, 1, 2), '0,0,255');                       // B oben rechts → unten rechts
  assert.equal(px(r90, 0, 2), '250,250,250');                   // W unten rechts → unten links
  // jede Ergebnisfarbe stammt aus der Quelle (keine Mischfarben)
  const r30 = P.drehen(src, 0, 0, P.zusammensetzen({ rot: 30, sx: 1, sy: 1, tx: 0, ty: 0 }).slice(0, 4), O, { raster: 2 });
  const erlaubt = new Set(farben.map(f => f.join()));
  for (let i = 0; i < r30.data.length; i += 4) if (r30.data[i + 3]) assert.ok(erlaubt.has([...r30.data.slice(i, i + 3)].join()), 'Fremdfarbe');
  assert.equal(P.drehen(src, 0, 0, [0, 0, 0, 0], O), null);   // singulaer
});

test('Farbfilter werden in Pixelfarben gerechnet (brightness, grayscale, invert, hue-rotate) und nur reine Farbfilter erkannt', () => {
  assert.deepEqual(P.farbFilterLesen('brightness(0.35) hue-rotate(90deg) saturate(150%)'), [['brightness', 0.35], ['hue-rotate', 90], ['saturate', 1.5]]);
  assert.deepEqual(P.farbFilterAnwenden([['brightness', 0.5]], 200, 100, 50), [100, 50, 25]);
  assert.deepEqual(P.farbFilterAnwenden([['invert', 1]], 255, 0, 10), [0, 255, 245]);
  const g = P.farbFilterAnwenden([['grayscale', 1]], 255, 0, 0);
  assert.ok(g[0] === g[1] && g[1] === g[2]);
  assert.ok(P.FILTER_NUR_FARBE.test('brightness(0.35)') && !P.FILTER_NUR_FARBE.test('blur(2px)') && !P.FILTER_NUR_FARBE.test('brightness(1) drop-shadow(0 0 2px #fff)'));
  assert.equal(P.snapScaleGroesse(1.04, 120, 2), 124 / 120);    // Oberflaeche: kleine Vergroesserung bleibt sichtbar (ganze Kunstpixel-Groesse)
});

test('Wächter-Selbsttest: Muster werden gezaehlt, pp-ok und Vierteldrehungen nicht', () => {
  const z = check.zeileZaehlen;
  assert.deepEqual(z("boxShadow: '0 0 16px rgba(255,26,26,.9)'", false), { blur: 1 });
  assert.equal(z("boxShadow: '0 0 0 2px #fff, 2px 2px 0 #000'", false), null);          // harte Ringe/Schatten sind Pixelart
  assert.deepEqual(z("filter: 'drop-shadow(0 1px 1px #000)'", false), { blur: 1 });
  assert.deepEqual(z('transform: rotate(-35deg) scale(1)', false), { drehung: 1 });
  assert.equal(z('transform: rotate(90deg)', false), null);
  assert.equal(z('transform: rotate(35deg); /* pp-ok: drehung */', false), null);
  assert.equal(z('// boxShadow: 0 0 9px red', false), null);
  assert.deepEqual(z("mixBlendMode: 'screen'", false), { mischmodus: 1 });
  assert.deepEqual(z('ctx.fillText("x", 0, 0);', false), { systemglyphe: 1 });
  assert.equal(z('background: radial-gradient(#f00, #00f)', false), null);              // Registry: Pixelierer macht es zur Laufzeit
  assert.deepEqual(z('background: radial-gradient(#f00, #00f)', true), { verlauf: 1 });  // Keyframes / data-pp-px="aus": zaehlt
  assert.ok(check.hatUnschaerfe('0 0 8px red, 1px 1px 0 #000'));
  assert.ok(!check.hatUnschaerfe('0 0 0 3px red'));
});

test('Keine neuen Nicht-Pixelart-Muster in Animationen (scripts/pixel-anim-baseline.json)', () => {
  const r = check.pruefe();
  assert.deepEqual(r.verstoesse.map(v => `${v.id}: ${v.muster} ${v.bekannt} -> ${v.ist}`), [],
    'neue Weichzeichner/Verlaeufe/Drehungen in Animationen — Pixelart bauen oder geprueft mit `pp-ok: <muster>` markieren (node scripts/check-pixel-anim.js --unit <Einheit>)');
});
