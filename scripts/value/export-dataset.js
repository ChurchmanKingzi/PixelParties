#!/usr/bin/env node
// Zustandslogs (`<deck>.jsonl.states`, Stufe 1) → flache Binärarrays fürs Training (Stufe 2).
//
//   node scripts/value/export-dataset.js [--in data/training/value[,weitere Ordner]] [--out data/training/value/dataset]
//
// Jeder Zustand ergibt ZWEI Beispiele: die ehrliche Sicht von Sitz 0 und die von Sitz 1 (Netz sagt immer „gewinnt mein Sitz?").
// Die Merkmale kommen aus `cards/effects/_value-features.js` — derselbe Code wie später im Spiel.
//
// Ausgabe: `manifest.json` (Formen, Deck-Namen) + je Array eine Rohdatei (little endian), von numpy mit `np.fromfile` lesbar.
//   je Beispiel:  y(u8) ev(f32, NaN = fehlt) turn(i16) rem(i16 Züge bis zum Ende) phase(u8) trig(u8) seat(u8) game(i32) deckSelf(i16) deckOpp(i16)
//                 glob(f32 × NGLOB) lin(f32 × 15, grobe Differenzen fürs lineare Vergleichsmodell)
//   je Gruppe g:  g<g>_ex(i32, aufsteigend) g<g>_side(u8) g<g>_id(i32) g<g>_own(i32) g<g>_x(f32 × nx)
// Trainingsdaten gehören nicht ins Repository (siehe CLAUDE.md) — der Ausgabeordner liegt unter data/training/ (git-ignoriert).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const V = require(path.join(ROOT, 'cards', 'effects', '_value-encode'));
const F = require(path.join(ROOT, 'cards', 'effects', '_value-features'));

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const IN_DIRS = getArg('--in', 'data/training/value').split(',').map(d => path.resolve(ROOT, d.trim())).filter(Boolean);
const OUT_DIR = path.resolve(ROOT, getArg('--out', path.join(IN_DIRS[0], 'dataset')));
const N_LIN = 15;

/** Gepufferter Schreiber für eine Rohdatei aus Zahlen eines Typs. */
class Sink {
  constructor(name, Type) {
    this.name = name; this.Type = Type; this.file = path.join(OUT_DIR, name + '.bin'); this.fd = fs.openSync(this.file, 'w');
    this.buf = new Type(1 << 20); this.len = 0; this.count = 0;
  }
  push(v) { if (this.len === this.buf.length) this.flush(); this.buf[this.len++] = v; this.count++; }
  pushRange(arr, from, to) { for (let i = from; i < to; i++) this.push(arr[i]); }
  flush() { if (this.len) { fs.writeSync(this.fd, Buffer.from(this.buf.buffer, 0, this.len * this.Type.BYTES_PER_ELEMENT)); this.len = 0; } }
  close() { this.flush(); fs.closeSync(this.fd); }
}

function linFeatures(view, out) {
  const a = view.self, b = view.opp;
  const hpSum = (s) => s.heroes.reduce((t, h) => t + (h[6] & 1 ? h[2] : 0), 0);
  const alive = (s) => s.heroes.reduce((t, h) => t + (h[6] & 1 ? 1 : 0), 0);
  const atk = (s) => s.heroes.reduce((t, h) => t + (h[6] & 1 ? h[4] : 0), 0);
  const abil = (s) => s.abil.reduce((t, x) => t + x[3], 0);
  const supHp = (s) => s.sup.reduce((t, x) => t + x[3], 0);
  const f = [
    hpSum(a) - hpSum(b), alive(a) - alive(b), a.sc.hand - b.sc.hand, a.sc.deck - b.sc.deck, a.sc.gold - b.sc.gold,
    abil(a) - abil(b), a.sup.length - b.sup.length, supHp(a) - supHp(b), a.sur.length - b.sur.length, a.sc.disc - b.sc.disc,
    a.sc.del - b.sc.del, atk(a) - atk(b), a.sc.potion - b.sc.potion, Math.min(a.sc.dmg, 5000) - Math.min(b.sc.dmg, 5000), view.myTurn ? 1 : 0,
  ];
  for (let i = 0; i < N_LIN; i++) out.push(f[i]);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = IN_DIRS.flatMap(dir => fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.states')).sort().map(f => path.join(dir, f)));
  if (!files.length) throw new Error(`Keine .states-Dateien in ${IN_DIRS.join(', ')}`);

  const per = {
    y: new Sink('y', Uint8Array), ev: new Sink('ev', Float32Array), turn: new Sink('turn', Int16Array), rem: new Sink('rem', Int16Array),
    phase: new Sink('phase', Uint8Array), trig: new Sink('trig', Uint8Array), seat: new Sink('seat', Uint8Array), game: new Sink('game', Int32Array),
    deckSelf: new Sink('deckSelf', Int16Array), deckOpp: new Sink('deckOpp', Int16Array),
    glob: new Sink('glob', Float32Array), lin: new Sink('lin', Float32Array),
  };
  const grp = F.GROUPS.map((g, i) => ({
    ex: new Sink(`g${i}_ex`, Int32Array), side: new Sink(`g${i}_side`, Uint8Array), id: new Sink(`g${i}_id`, Int32Array),
    own: new Sink(`g${i}_own`, Int32Array), x: new Sink(`g${i}_x`, Float32Array),
  }));
  const deckIdx = new Map(), deckNames = [];
  const deckId = (name) => { if (!deckIdx.has(name)) { deckIdx.set(name, deckNames.length); deckNames.push(name); } return deckIdx.get(name); };

  const feat = new F.Features();
  let nEx = 0, nGames = 0, nStates = 0;
  const lin = { push(v) { per.lin.push(v); } };
  files.forEach((file, fi) => {
    const statesFile = file;
    const jsonl = statesFile.replace(/\.states$/, '');
    const rec = new Map();
    for (const line of fs.readFileSync(jsonl, { encoding: 'utf-8' }).split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      rec.set(r.gameIdx, { deck: r.deck, opponent: r.opponent, pinned: r.pinnedIdx });
    }
    const { blocks } = V.scanFile(statesFile);
    for (const blk of blocks) {
      const r = rec.get(blk.gameIdx);
      if (!r || blk.winner < 0) continue;     // ohne Zeile oder ohne Sieger: nicht verwendbar
      const bl = V.readBlock(V.readBlockBytes(statesFile, blk));
      const pinned = blk.pinned === 1 ? 1 : 0;       // gepinnter Sitz (Kopf: u8; 0/1 = Sitz)
      const deckOfSeat = [0, 0]; deckOfSeat[pinned] = deckId(r.deck); deckOfSeat[1 - pinned] = deckId(r.opponent);
      const lastTurn = bl.states.reduce((m, S) => Math.max(m, S.turn), 0);
      const gameId = fi * 10000 + blk.gameIdx;
      nGames++;
      for (const S of bl.states) {
        nStates++;
        for (let seat = 0; seat < 2; seat++) {
          const view = V.honestView(S, seat);
          feat.fill(view);
          per.y.push(blk.winner === seat ? 1 : 0);
          per.ev.push(S.ev[seat] == null ? NaN : S.ev[seat]);
          per.turn.push(S.turn); per.rem.push(lastTurn - S.turn); per.phase.push(S.phase); per.trig.push(S.trig); per.seat.push(seat);
          per.game.push(gameId); per.deckSelf.push(deckOfSeat[seat]); per.deckOpp.push(deckOfSeat[1 - seat]);
          per.glob.pushRange(feat.glob, 0, F.NGLOB);
          linFeatures(view, lin);
          for (let side = 0; side < 2; side++) {
            F.GROUPS.forEach((g, gi) => {
              const t = feat.sides[side][gi], o = grp[gi];
              for (let k = 0; k < t.n; k++) { o.ex.push(nEx); o.side.push(side); o.id.push(t.ids[k]); o.own.push(t.own[k]); }
              o.x.pushRange(t.x, 0, t.n * t.nx);
            });
          }
          nEx++;
        }
      }
    }
    process.stderr.write(`\r${fi + 1}/${files.length} Decks · ${nGames} Spiele · ${nEx} Beispiele`);
  });
  process.stderr.write('\n');

  const arrays = {};
  const reg = (s, shape) => { s.close(); arrays[s.name] = { file: path.basename(s.file), dtype: s.Type.name.replace('Array', '').toLowerCase(), shape }; };
  const dtype = { uint8: 'u8', float32: 'f32', int16: 'i16', int32: 'i32' };
  for (const [k, s] of Object.entries(per)) reg(s, k === 'glob' ? [nEx, F.NGLOB] : k === 'lin' ? [nEx, N_LIN] : [nEx]);
  grp.forEach((o, gi) => {
    const n = o.ex.count, nx = F.GROUPS[gi].nx;
    reg(o.ex, [n]); reg(o.side, [n]); reg(o.id, [n]); reg(o.own, [n]); reg(o.x, [n, nx]);
  });
  for (const a of Object.values(arrays)) a.dtype = dtype[a.dtype] || a.dtype;
  const vocab = V.loadVocab();
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({
    featuresVersion: F.VERSION, formatVersion: V.FORMAT_VERSION, nExamples: nEx, nGames, nStates, nGlob: F.NGLOB, nLin: N_LIN,
    vocabSize: vocab.names.length, groups: F.GROUPS.map(g => ({ name: g.name, nx: g.nx })), decks: deckNames, arrays,
  }, null, 1), { encoding: 'utf-8' });
  console.log(`fertig: ${nGames} Spiele, ${nStates} Zustände, ${nEx} Beispiele → ${OUT_DIR}`);
  const unk = [...V.unknownNames()];
  if (unk.length) console.warn(`⚠ unbekannte Karten: ${unk.slice(0, 10).join(', ')}`);
}

main();
