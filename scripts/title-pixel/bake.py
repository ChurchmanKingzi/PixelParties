#!/usr/bin/env python3
# Backt das Titelbild und die Login-Kulisse als Pixelart VOR (Bayer-4x4-Mischdither im Yliluoma-Stil, Raster 3 px, 256-Farben-Palette).
#
#   python3 scripts/title-pixel/bake.py            backen (numpy + Pillow; dauert wenige Sekunden)
#   node scripts/title-pixel/pruefen.js            nur pruefen, ob die gebackenen Dateien zu Quelle + Palette + Skript passen (Exit 1 = veraltet)
#
# WARUM VORGEBACKEN: Zur Laufzeit wird nichts pixelisiert (Leistung, vor allem auf dem Handy). Das Spiel liefert die fertigen Pixelart-PNGs aus.
#
# ORIGINALE (die Quelle, NIE ueberschreiben): scripts/title-pixel/originals/  (liegt bewusst ausserhalb von public/ und data/, wird also nicht ausgeliefert)
#     originals/title.png            -> public/title.png (1920x1080, auch og:image/Boot-Splash)  und  electron/assets/title.png (640x360, Electron-Splash 1:1)
#     originals/layers2/<name>.png   -> data/animated_screen/layers2/<name>.png (12 Ebenen, je 1920x1080; Hintergrund 1998x1125, siehe unten)
# Das Skript liest NUR von dort und schreibt die gebackenen Dateien an die Auslieferungsorte; wiederholtes Backen laeuft darum nie auf schon gebackenen Bildern,
# und das Original ist jederzeit wiederherstellbar. Neue/geaenderte Grafik: Original in originals/ ersetzen, dann neu backen (und die Ebenen-Rahmen
# ANIM_SPRITE_RAHMEN in public/app-screens.jsx anpassen, falls sich der sichtbare Kasten aendert). Die Retro-Fassung (data/animated_screen/layers2-retro,
# scripts/retro/build-art.py) liest ebenfalls aus originals/.
#
# WANN NEU BACKEN: nach JEDER Aenderung an data/palette.json, an den Originalen oder an diesem Skript (die Marker-Datei scripts/title-pixel/stand.json haelt
# den Hash aus Originalen + Palette + Skript; test/title-pixel.test.js schlaegt fehl, solange er nicht passt).
#
# VERFAHREN: 3x3-Flaechenmittel (Alpha vormultipliziert) -> je Zelle die beste Mischung aus zwei Palettenfarben im 16er-Bayer-Raster (nur leichter Dither,
# keine 40-60-%-Schachbretter) -> Alpha NIE halbtransparent (Schwelle 50 %) -> ganzzahlig x3 aufgezogen -> 8-Bit-Paletten-PNG (transparent = ungenutzter Paletten-
# index per tRNS; fallen alle 256 Indizes an, RGBA mit Alpha 0/255).
# HINTERGRUND: Die Kulisse legt den Hintergrund um 4 % ueberstreckt unter die Buehne (Beben darf keine Kanten zeigen). Damit die Zellen bei 1920x1080 genau 3 px
# gross bleiben, wird er hier gleich auf 1998x1125 (666x375 Zellen) vergroessert gebacken; app-screens.jsx legt ihn 1:1 (inset -2,03125 % / -2,0833 %).
import hashlib, json, os, sys, glob
import numpy as np
from PIL import Image

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
HIER = os.path.join(REPO, 'scripts', 'title-pixel')
ORIG = os.path.join(HIER, 'originals')
MARKE = os.path.join(HIER, 'stand.json')
CELL = 3
ALPHA_T = 0.5
BG_GROESSE = (1998, 1125)       # Hintergrund, 4,06 % ueberstreckt (666 x 375 Zellen)

pal = json.load(open(os.path.join(REPO, 'data', 'palette.json'), encoding='utf-8'))['farben']
P = np.array([[int(f['hex'][i:i + 2], 16) for i in (1, 3, 5)] for f in pal], dtype=np.float64)

def srgb2lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = (c @ M.T) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

LABP = srgb2lab(P)
KC = 12            # Kandidatenfarben je Zielfarbe (naechste in Lab)
PEN = 0.12         # Strafe fuer ungleiche Mischpartner (Yliluoma), haelt das Muster ruhig
LW = np.array([0.299, 0.587, 0.114])
BAYER_INT = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])

def nearest(colors, k):
    """Die k naechsten Palettenfarben (Lab-Abstand, aufsteigend) je Zielfarbe (N,3) -> (N,k)."""
    lab = srgb2lab(colors.astype(np.float64))
    out = np.empty((len(colors), k), np.int64)
    for s in range(0, len(colors), 2000):
        d = ((lab[s:s + 2000, None, :] - LABP[None, :, :]) ** 2).sum(-1)
        part = np.argpartition(d, k - 1, axis=1)[:, :k]
        dp = np.take_along_axis(d, part, 1)
        out[s:s + 2000] = np.take_along_axis(part, np.argsort(dp, axis=1, kind='stable'), 1)
    return out

def mix_plan(colors):
    """Fuer jede Zielfarbe (N,3 uint8) die beste Mischung aus 2 Palettenfarben im 16er-Raster: (c1, c2, n) mit n/16 Anteil c2."""
    cand = nearest(colors, KC)                                                  # (N,KC)
    ii, jj = np.triu_indices(KC, 1)
    N = len(colors); c1 = np.zeros(N, np.int64); c2 = np.zeros(N, np.int64); nn = np.zeros(N, np.int64)
    ns = np.arange(0, 17)
    for s in range(0, N, 4000):
        t = colors[s:s + 4000].astype(np.float64); cd = cand[s:s + 4000]          # (B,3) (B,KC)
        A = P[cd[:, ii]]; Bc = P[cd[:, jj]]                                       # (B,pairs,3)
        mix = A[:, :, None, :] + (Bc - A)[:, :, None, :] * (ns / 16.0)[None, None, :, None]       # (B,pairs,17,3)
        d = ((mix - t[:, None, None, :]) ** 2 * LW).sum(-1)
        d = d + PEN * ((((A - Bc) ** 2) * LW).sum(-1) / 255.0 * 4)[:, :, None]
        d[:, :, 6:11] = 1e18      # 'leichter' Dither: keine 40-60-%-Schachbretter, nur Mischanteile bis ~35 % (bzw. ab ~65 %)
        flat = d.reshape(d.shape[0], -1); k = flat.argmin(1)
        pi, ni = np.divmod(k, 17)
        r = np.arange(len(k))
        c1[s:s + 4000] = cd[r, ii[pi]]; c2[s:s + 4000] = cd[r, jj[pi]]; nn[s:s + 4000] = ni
        # Solo-Kandidat (naechste Palettenfarbe) gewinnt, wenn die Mischung nicht deutlich naeher liegt
        solo = cd[:, 0]; ds = ((P[solo] - t) ** 2 * LW).sum(-1); best = flat[r, k]
        use_solo = ds <= best + 1e-9
        c1[s:s + 4000] = np.where(use_solo, solo, c1[s:s + 4000]); nn[s:s + 4000] = np.where(use_solo, 0, nn[s:s + 4000])
    return c1, c2, nn

def snap(rgb):
    h, w, _ = rgb.shape
    x = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    flat = x.reshape(-1, 3)
    key = (flat[:, 0].astype(np.int64) << 16) | (flat[:, 1].astype(np.int64) << 8) | flat[:, 2]
    uk, first, inv = np.unique(key, return_index=True, return_inverse=True)
    c1, c2, nn = mix_plan(flat[first])
    c1, c2, nn = c1[inv], c2[inv], nn[inv]
    m = np.tile(BAYER_INT, (h // 4 + 1, w // 4 + 1))[:h, :w].reshape(-1)
    idx = np.where(m < nn, c2, c1)
    return P[idx].reshape(h, w, 3).astype(np.uint8)

def downscale(im):
    a = np.asarray(im.convert('RGBA'), dtype=np.float64)
    H, W = a.shape[:2]
    h, w = H // CELL, W // CELL
    a = a[:h * CELL, :w * CELL].reshape(h, CELL, w, CELL, 4)
    al = a[..., 3] / 255.0
    prem = a[..., :3] * al[..., None]
    asum = al.mean(axis=(1, 3))
    csum = prem.mean(axis=(1, 3))
    rgb = np.where(asum[..., None] > 0, csum / np.maximum(asum[..., None], 1e-9), 0)
    return rgb, asum

def bake(src, has_alpha, stretch=None):
    im = Image.open(src)
    if stretch: im = im.convert('RGB').resize(stretch, Image.LANCZOS)
    rgb, a = downscale(im)
    q = snap(rgb)
    if has_alpha:
        mask = a >= ALPHA_T
        out = np.zeros(q.shape[:2] + (4,), np.uint8)
        out[..., :3] = np.where(mask[..., None], q, 0)
        out[..., 3] = np.where(mask, 255, 0)
        return Image.fromarray(out, 'RGBA')
    return Image.fromarray(q, 'RGB')

PALFLAT = [int(v) for c in P.astype(np.uint8) for v in c]
PK = {(int(c[0]) << 16) | (int(c[1]) << 8) | int(c[2]): i for i, c in enumerate(P.astype(np.uint8))}

def save_idx(im, dst, scale=1):
    """8-Bit-Palette-PNG; transparent = ungenutzter Palettenindex (tRNS). Faellt auf RGBA zurueck, wenn alle 256 Indizes belegt sind."""
    if scale > 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    a = np.asarray(im)
    has_a = a.shape[2] == 4
    rgb = a[..., :3].astype(np.int64)
    key = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    opaque = a[..., 3] > 0 if has_a else np.ones(key.shape, bool)
    uk, inv = np.unique(key, return_inverse=True)
    idx = np.array([PK[int(k)] for k in uk], np.uint8)[inv].reshape(key.shape)
    used = set(np.unique(idx[opaque]).tolist())
    tr = None
    if has_a:
        free = [i for i in range(256) if i not in used]
        if not free:
            im.save(dst, optimize=True); return 'rgba'
        tr = free[0]; idx = np.where(opaque, idx, tr).astype(np.uint8)
    out = Image.fromarray(idx, 'P'); out.putpalette(PALFLAT)
    if tr is None: out.save(dst, optimize=True)
    else:
        t = bytearray([255] * (tr + 1)); t[tr] = 0
        out.save(dst, optimize=True, transparency=bytes(t))
    return 'idx'

def eingabe_hash():
    """Hash aus Originalen + Palette + diesem Skript (muss zu scripts/title-pixel/pruefen.js passen: gleiche Reihenfolge, relativer Pfad + NUL + Bytes)."""
    rels = sorted(['data/palette.json', 'scripts/title-pixel/bake.py', 'scripts/title-pixel/originals/title.png']
                  + ['scripts/title-pixel/originals/layers2/' + os.path.basename(f) for f in glob.glob(ORIG + '/layers2/*.png')])
    h = hashlib.sha256()
    for r in rels:
        b = open(os.path.join(REPO, r), 'rb').read()
        if not r.endswith('.png'): b = b.replace(b'\r\n', b'\n')      # Textdateien: Zeilenenden egal (Windows-Checkout)
        h.update(r.encode() + b'\0'); h.update(b)
    return h.hexdigest()[:16]

def main():
    ziele = {}   # relativer Pfad -> sha256 der gebackenen Datei
    def ablegen(im, rel, scale):
        dst = os.path.join(REPO, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        modus = save_idx(im, dst, scale)
        ziele[rel] = hashlib.sha256(open(dst, 'rb').read()).hexdigest()
        print('%-48s %4dx%-4d %-4s %7d Bytes' % (rel, im.width * scale, im.height * scale, modus, os.path.getsize(dst)))
    t = bake(ORIG + '/title.png', False)
    ablegen(t, 'public/title.png', CELL)
    ablegen(t, 'electron/assets/title.png', 1)          # Electron-Splash: 640x360-Fenster, Zelle = Bildpunkt (image-rendering: pixelated)
    for f in sorted(glob.glob(ORIG + '/layers2/*.png')):
        n = os.path.basename(f)
        bg = n == 'background.png'
        ablegen(bake(f, not bg, BG_GROESSE if bg else None), 'data/animated_screen/layers2/' + n, CELL)
    with open(MARKE, 'w', encoding='utf-8') as fh:
        json.dump({'hash': eingabe_hash(), 'dateien': ziele}, fh, indent=1, sort_keys=True)
        fh.write('\n')
    print('Marker:', os.path.relpath(MARKE, REPO))

if __name__ == '__main__':
    main()
