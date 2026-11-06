// ═══════════════════════════════════════════
//  PIXEL PARTIES — Merkmale fürs CPU-Wertnetz (Stufe 2)
//
//  Macht aus der ehrlichen Sicht eines Sitzes (`honestView` aus _value-encode.js) die Eingabe des Netzes: Karten-Token in neun
//  Gruppen je Seite („ich" / „Gegner") und einen Vektor globaler Zahlen. Dieselbe Funktion füllt die Trainingsdaten
//  (`scripts/value/export-dataset.js`) und füttert die Inferenz (`_value-net.js`) — so kann zwischen Training und Spiel keine
//  Abweichung in den Merkmalen entstehen.
//
//  Ein Token = Kartennummer (`id`, 0 = unbekannt/verdeckt), Kartennummer des Helden, dem die Karte gehört (`own`, 0 = keiner) und ein
//  kurzer Zahlenvektor `x`. Gruppen sind für beide Seiten gleich aufgebaut; das Netz teilt die Gewichte je Gruppe über die Seiten und
//  summiert getrennt je Seite (DeepSets), danach liest ein MLP [Summen ich | Summen Gegner | Globale Zahlen].
//
//  Änderung der Reihenfolge, der Skalen oder der Gruppen = neue `VERSION` (alte Gewichte passen dann nicht mehr).
// ═══════════════════════════════════════════
'use strict';

const VERSION = 1;
const STATUS_BITS = 32;
const LOCK_BITS = 10;

// nx = Länge des Zahlenvektors je Token, cap = Obergrenze je Seite (Rest wird verworfen; die Werte liegen weit über den Maxima der Daten).
const GROUPS = [
  { name: 'hero', nx: 10 + STATUS_BITS, cap: 6 },
  { name: 'abil', nx: 7, cap: 64 },
  { name: 'sup', nx: 15, cap: 32 },
  { name: 'sur', nx: 3, cap: 16 },
  { name: 'area', nx: 1, cap: 16 },
  { name: 'perm', nx: 1, cap: 16 },
  { name: 'hand', nx: 2, cap: 128 },
  { name: 'disc', nx: 2, cap: 256 },
  { name: 'del', nx: 2, cap: 256 },
];
const G = Object.fromEntries(GROUPS.map((g, i) => [g.name, i]));
const SEAT_GLOB = 14 + LOCK_BITS;
const NGLOB = 2 * SEAT_GLOB + 9;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Features {
  constructor() {
    this.sides = [0, 1].map(() => GROUPS.map(g => ({ n: 0, cap: g.cap, nx: g.nx, ids: new Int32Array(g.cap), own: new Int32Array(g.cap), x: new Float32Array(g.cap * g.nx) })));
    this.glob = new Float32Array(NGLOB);
  }

  /** @param view Ergebnis von `honestView(S, seat)`. Gibt `this` zurück. */
  fill(view) {
    const seats = [view.self, view.opp];
    for (let s = 0; s < 2; s++) {
      const st = seats[s], tg = this.sides[s];
      for (const g of tg) g.n = 0;
      const heroId = [0, 0, 0, 0, 0, 0];
      for (const h of st.heroes) if (h[1] >= 0 && h[1] < 6) heroId[h[1]] = h[0];
      const add = (g, id, own) => {
        if (g.n >= g.cap) return -1;
        const k = g.n++;
        g.ids[k] = id; g.own[k] = own;
        g.x.fill(0, k * g.nx, (k + 1) * g.nx);
        return k * g.nx;
      };
      const oh = (x, o, i, w) => { if (i >= 0 && i < w) x[o + i] = 1; };

      for (const t of st.heroes) {      // [id, h, hp, maxHp, atk, mask, flags]
        const g = tg[G.hero], o = add(g, t[0], 0);
        if (o < 0) continue;
        const x = g.x;
        x[o] = t[2] / 500; x[o + 1] = t[3] / 500; x[o + 2] = t[3] > 0 ? clamp(t[2] / t[3], 0, 2) : 0; x[o + 3] = t[4] / 100;
        x[o + 4] = t[6] & 1 ? 1 : 0; x[o + 5] = t[6] & 2 ? 1 : 0; x[o + 6] = t[6] & 4 ? 1 : 0;
        oh(x, o + 7, t[1], 3);
        for (let b = 0; b < STATUS_BITS; b++) if ((t[5] >>> b) & 1) x[o + 10 + b] = 1;
      }
      for (const t of st.abil) {        // [h, slot, id, n]
        const g = tg[G.abil], o = add(g, t[2], heroId[t[0]] || 0);
        if (o < 0) continue;
        g.x[o] = t[3] / 3; oh(g.x, o + 1, t[1], 3); oh(g.x, o + 4, t[0], 3);
      }
      for (const t of st.sup) {         // [h, slot, id, hp, mask, flags, age, ctr, buffs]
        const g = tg[G.sup], o = add(g, t[2], heroId[t[0]] || 0);
        if (o < 0) continue;
        const x = g.x;
        x[o] = clamp(t[3] / 100, 0, 10); x[o + 1] = t[3] > 0 ? 1 : 0; x[o + 2] = clamp(t[7] / 100, -1, 8); x[o + 3] = t[8] / 3; x[o + 4] = t[6] / 20;
        x[o + 5] = t[5] & 1 ? 1 : 0; x[o + 6] = t[5] & 2 ? 1 : 0; x[o + 7] = t[5] & 4 ? 1 : 0;
        x[o + 8 + (t[1] >= 0 && t[1] < 3 ? t[1] : 3)] = 1;
        oh(x, o + 12, t[0], 3);
      }
      for (const t of st.sur) {         // [h, slot, id]
        const g = tg[G.sur], o = add(g, t[2], heroId[t[0]] || 0);
        if (o >= 0) oh(g.x, o, t[0], 3);
      }
      for (const id of st.area) { const g = tg[G.area], o = add(g, id, 0); if (o >= 0) g.x[o] = 1; }
      for (const id of st.perm) { const g = tg[G.perm], o = add(g, id, 0); if (o >= 0) g.x[o] = 1; }
      for (const [name, pile] of [['hand', st.hand], ['disc', st.disc], ['del', st.del]]) {
        const g = tg[G[name]];
        for (const [id, n] of pile) { const o = add(g, id, 0); if (o >= 0) { g.x[o] = Math.min(n, 4) / 4; g.x[o + 1] = n > 1 ? 1 : 0; } }
      }

      const sc = st.sc, q = this.glob, base = s * SEAT_GLOB;
      q[base] = Math.log1p(Math.max(0, sc.gold)) / 6; q[base + 1] = sc.hand / 10; q[base + 2] = sc.deck / 30; q[base + 3] = sc.potion / 10;
      q[base + 4] = sc.disc / 30; q[base + 5] = sc.del / 30; q[base + 6] = sc.potUsed / 2; q[base + 7] = sc.atkPlayed / 3;
      q[base + 8] = sc.splPlayed / 3; q[base + 9] = sc.bonus / 2; q[base + 10] = Math.min(sc.acted, 3) / 3;
      q[base + 11] = Math.min(Math.log1p(Math.max(0, sc.dmg)) / 14, 1.5); q[base + 12] = sc.cool / 10; q[base + 13] = sc.perm / 2;
      for (let b = 0; b < LOCK_BITS; b++) q[base + 14 + b] = (sc.locks >>> b) & 1;
    }
    const q = this.glob, c = 2 * SEAT_GLOB;
    q[c] = Math.min(view.turn / 40, 2.5);
    for (let p = 0; p < 6; p++) q[c + 1 + p] = 0;
    q[c + 1 + clamp(view.phase | 0, 0, 5)] = 1;
    q[c + 7] = view.myTurn ? 1 : 0;
    q[c + 8] = view.trig ? 1 : 0;
    return this;
  }
}

module.exports = { VERSION, STATUS_BITS, LOCK_BITS, GROUPS, G, NGLOB, SEAT_GLOB, Features };
