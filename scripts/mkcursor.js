// ════════════════════════════════════════════════════════════════
//  IN-GAME PIXEL CURSOR GENERATOR
//  Renders the whole pixel-cursor set as real PNGs into public/ and prints
//  each one's CSS hotspot. A black outline is derived automatically (any
//  transparent cell 8-adjacent to a fill cell).
//
//  Why PNG (not SVG): Blink (Chrome/Edge) does NOT support SVG data-URI
//  cursors — it silently ignores them and falls back to the keyword. PNGs
//  work everywhere. Output is kept <=32x32 because Firefox ignores larger
//  custom cursors. Run: `node scripts/mkcursor.js`
//
//  The default arrow (white) doubles as the source the front-end recolours
//  at runtime into the player's colour for the hover/clickable cursor
//  (see applyPixelHoverCursor in app-main.jsx). The cyan copy is only the
//  pre-JS fallback. The other cursors (grab/grabbing/text/no) are static.
// ════════════════════════════════════════════════════════════════
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');

const SCALE = 2; // 2px "pixels"; keeps every sprite <=32px (Firefox cap).

// ── Sprite bitmaps (X = opaque fill). Outline is auto-derived. ──
const ARROW = [ // classic arrow: vertical left edge, diagonal right, down-angled tail
  'X.........', 'XX........', 'XXX.......', 'XXXX......', 'XXXXX.....',
  'XXXXXX....', 'XXXXXXX...', 'XXXXXXXX..', 'XXXXX.....', 'X.XXX.....',
  'X..XXX....', '...XXX....', '....XX....',
];
const GRAB = [ // open hand: four finger nubs over a palm
  'X.X.X.X.', 'X.X.X.X.', 'XXXXXXX.', 'XXXXXXX.', 'XXXXXXXX', '.XXXXXXX', '.XXXXXX.', '..XXXXX.',
];
const GRABBING = [ // fist
  '.XX.XX..', 'XXXXXXX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXX.', '.XXXXX..',
];
const IBEAM = [ // text I-beam
  'XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX',
];
const NO = [ // not-allowed: ring + slash
  '..XXX..', '.X...X.', 'X..X..X', 'X.X.X.X', 'X..X..X', '.X...X.', '..XXX..',
];

function buildGrid(rows) { // fill (1) + auto outline (2), 1-cell transparent pad
  const FW = Math.max(...rows.map(r => r.length)), FH = rows.length;
  const GW = FW + 2, GH = FH + 2;
  const g = Array.from({ length: GH }, () => new Array(GW).fill(0));
  for (let y = 0; y < FH; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === 'X') g[y + 1][x + 1] = 1;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (g[y][x]) continue;
    let a = false;
    for (let dy = -1; dy <= 1 && !a; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < GH && nx >= 0 && nx < GW && g[ny][nx] === 1) { a = true; break; }
    }
    if (a) g[y][x] = 2;
  }
  return g;
}

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tt = Buffer.from(t, 'ascii'); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([tt, d])), 0); return Buffer.concat([l, tt, d, cc]); }
function png(grid, rgb) {
  const GH = grid.length, GW = grid[0].length, W = GW * SCALE, H = GH * SCALE;
  const raw = Buffer.alloc((W * 4 + 1) * H); let p = 0;
  for (let y = 0; y < H; y++) { raw[p++] = 0; for (let x = 0; x < W; x++) { const c = grid[(y / SCALE) | 0][(x / SCALE) | 0]; let r = 0, g = 0, b = 0, a = 0; if (c === 1) { [r, g, b] = rgb; a = 255; } else if (c === 2) { a = 255; } raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return { buf: Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]), W, H };
}
function write(file, grid, rgb) {
  const { buf, W, H } = png(grid, rgb);
  fs.writeFileSync(path.join(pub, file), buf);
  return { W, H };
}

const WHITE = [255, 255, 255], CYAN = [0, 240, 255], RED = [255, 90, 90];
const gArrow = buildGrid(ARROW), gGrab = buildGrid(GRAB), gGrabbing = buildGrid(GRABBING), gIbeam = buildGrid(IBEAM), gNo = buildGrid(NO);
// hotspot helper: centre of the sprite (for hand/beam/no); arrow uses its tip.
const ctr = (g) => [Math.round(g[0].length * SCALE / 2), Math.round(g.length * SCALE / 2)];

const a = write('cursor-arrow.png', gArrow, WHITE);           // default (also recolour source)
write('cursor-arrow-cyan.png', gArrow, CYAN);                  // pre-JS hover fallback
const gr = write('cursor-grab.png', gGrab, WHITE);
const gb = write('cursor-grabbing.png', gGrabbing, WHITE);
const tx = write('cursor-text.png', gIbeam, WHITE);
const no = write('cursor-no.png', gNo, RED);

console.log('wrote public/cursor-*.png:');
console.log(`  arrow      ${a.W}x${a.H}  hotspot "2 2"`);
console.log(`  grab       ${gr.W}x${gr.H}  hotspot "${ctr(gGrab).join(' ')}"`);
console.log(`  grabbing   ${gb.W}x${gb.H}  hotspot "${ctr(gGrabbing).join(' ')}"`);
console.log(`  text       ${tx.W}x${tx.H}  hotspot "${ctr(gIbeam).join(' ')}"`);
console.log(`  not-allowed ${no.W}x${no.H}  hotspot "${ctr(gNo).join(' ')}"`);
