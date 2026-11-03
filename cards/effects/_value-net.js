// ═══════════════════════════════════════════
//  PIXEL PARTIES — Wertnetz der CPU: Inferenz in reinem JavaScript (Stufe 2)
//
//  Liest die Gewichte, die `scripts/value/train.py` schreibt (`net.json` = Kopf mit Formen, `net.f32` = Float32 hintereinander), und
//  rechnet die Vorwärtsrichtung. Keine native Abhängigkeit. Eingabe sind die Merkmale aus `_value-features.js` (`Features`),
//  Ausgabe: Roh-Logit „mein Sitz gewinnt" (`logit`), derselbe Logit kalibriert (`logitCal`, = Roh-Logit ohne Eintrag `calib` im Kopf),
//  Evaluator-Wert in Bewertungspunkten (Destillationskopf `ev`) und Restzüge (`rem`).
//
//  Rechenweise (muss mit train.py übereinstimmen — `test/value-net.test.js` prüft das gegen eine Python-Rechnung):
//    je Token  h = relu(E[id] + Eo[own] + x·Wg + bg)      (Gewichte je Gruppe, gleich für beide Seiten)
//    Summe der h je (Gruppe, Seite) · poolScale → [Gruppe 0: ich | Gegner, Gruppe 1: ich | Gegner, …] ++ globale Zahlen
//    → relu(·W1 + b1) → relu(·W2 + b2) → ·W3 + b3
// ═══════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const F = require('./_value-features');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'data', 'cpu-value');

class ValueNet {
  /** @param head Inhalt von net.json · @param floats Float32Array mit allen Gewichten (Reihenfolge laut head.tensors) */
  constructor(head, floats) {
    if (head.format !== 'pp-value-net') throw new Error('Keine Wertnetz-Datei');
    if (head.featuresVersion !== F.VERSION) throw new Error(`Merkmale Version ${head.featuresVersion} != ${F.VERSION}`);
    if (head.groups.length !== F.GROUPS.length || head.groups.some((g, i) => g.nx !== F.GROUPS[i].nx) || head.nGlob !== F.NGLOB) {
      throw new Error('Gruppenaufbau der Gewichte passt nicht zu _value-features.js');
    }
    this.head = head;
    this.dim = head.dim;
    this.hidden = head.hidden;
    this.poolScale = head.poolScale;
    const T = {};
    // Als Float64 kopieren: dieselben Zahlenwerte (jede Float32 ist als Double exakt), aber ohne Umwandlung bei jedem Zugriff.
    for (const t of head.tensors) {
      const n = t.shape.reduce((a, b) => a * b, 1);
      T[t.name] = Float64Array.from(floats.subarray(t.offset, t.offset + n));
    }
    this.E = T.E; this.Eo = T.Eo;
    this.Wg = F.GROUPS.map((_, g) => T[`Wg${g}`]);
    this.bg = F.GROUPS.map((_, g) => T[`bg${g}`]);
    this.layers = [];
    for (let i = 1; i <= this.hidden.length + 1; i++) this.layers.push({ W: T[`W${i}`], b: T[`b${i}`], n: T[`b${i}`].length });
    this.nin = 2 * F.GROUPS.length * this.dim + F.NGLOB;
    this._X = new Float64Array(this.nin);
    this._acts = this.layers.map(l => new Float64Array(l.n));
    this._h = new Float64Array(this.dim);
    this.evScale = head.evScale; this.remScale = head.remScale;
    // Nachträgliche Kalibrierung (scripts/value/calibrate.py): logitCal = a·logit + b. Ohne Eintrag bleibt der Roh-Logit.
    const c = head.calib;
    this.calib = c && Number.isFinite(c.a) && Number.isFinite(c.b) ? { a: c.a, b: c.b } : null;
    // κ: Bewertungspunkte je Einheit des KALIBRIERTEN Logits (scripts/value/shadow-report.js --write-kappa), sonst null.
    this.kappa = head.kappa && Number.isFinite(head.kappa.std) ? head.kappa : null;
    this.out = { logit: 0, logitCal: 0, ev: 0, rem: 0 };
  }

  static load(dir = DEFAULT_DIR) {
    const head = JSON.parse(fs.readFileSync(path.join(dir, 'net.json'), { encoding: 'utf-8' }));
    const buf = fs.readFileSync(path.join(dir, 'net.f32'));
    const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    if (floats.length !== head.floats) throw new Error(`net.f32 hat ${floats.length} Zahlen, erwartet ${head.floats}`);
    return new ValueNet(head, floats);
  }

  /** Vorwärtsrechnung. `feat` = gefülltes `Features`. Gibt das wiederverwendete Ergebnisobjekt zurück (nicht aufbewahren). */
  predict(feat) {
    const D = this.dim, X = this._X;
    X.fill(0);
    const h = this._h;
    for (let g = 0; g < F.GROUPS.length; g++) {
      const nx = F.GROUPS[g].nx, Wg = this.Wg[g], bg = this.bg[g];
      for (let side = 0; side < 2; side++) {
        const t = feat.sides[side][g], base = (g * 2 + side) * D;
        for (let k = 0; k < t.n; k++) {
          const ie = t.ids[k] * D, io = t.own[k] * D, xo = k * nx;
          for (let j = 0; j < D; j++) h[j] = this.E[ie + j] + this.Eo[io + j] + bg[j];
          for (let i = 0; i < nx; i++) {
            const xv = t.x[xo + i];
            if (xv === 0) continue;
            const wo = i * D;
            for (let j = 0; j < D; j++) h[j] += xv * Wg[wo + j];
          }
          for (let j = 0; j < D; j++) if (h[j] > 0) X[base + j] += h[j];
        }
      }
    }
    const pooledLen = 2 * F.GROUPS.length * D;
    for (let i = 0; i < pooledLen; i++) X[i] *= this.poolScale;
    for (let i = 0; i < F.NGLOB; i++) X[pooledLen + i] = feat.glob[i];

    let a = X, nIn = this.nin;
    for (let li = 0; li < this.layers.length; li++) {
      const L = this.layers[li], out = this._acts[li], W = L.W, n = L.n;
      for (let j = 0; j < n; j++) out[j] = L.b[j];
      for (let i = 0; i < nIn; i++) {
        const av = a[i];
        if (av === 0) continue;
        const wo = i * n;
        for (let j = 0; j < n; j++) out[j] += av * W[wo + j];
      }
      if (li < this.layers.length - 1) for (let j = 0; j < n; j++) if (out[j] < 0) out[j] = 0;
      a = out; nIn = n;
    }
    const r = this.out;
    r.logit = a[0]; r.logitCal = this.calib ? this.calib.a * a[0] + this.calib.b : a[0];
    r.ev = a[1] * this.evScale; r.rem = a[2] * this.remScale;
    return r;
  }
}

module.exports = { ValueNet, DEFAULT_DIR };
