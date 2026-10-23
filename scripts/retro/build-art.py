#!/usr/bin/env python3
# Retro-Fassung der Titel-Kulisse (data/animated_screen/layers2 → layers2-retro):
# auf ein Viertel verkleinert, mit geordnetem Dithering (Bayer 4x4) auf die 256 Spielfarben gerastet, ohne weiche Alpha-Kanten,
# dann ganzzahlig (4x) wieder aufgezogen — jede Figur wird zu grobem Pixelart. Nur fuer den Retro-Modus (?retro=1).
import json, sys, os
import numpy as np
from PIL import Image
FAKTOR = int(sys.argv[1]) if len(sys.argv) > 1 else 4
SRC = 'data/animated_screen/layers2'; DST = 'data/animated_screen/layers2-retro'
os.makedirs(DST, exist_ok=True)
pal = np.array([[int(p['hex'][i:i+2], 16) for i in (1, 3, 5)] for p in json.load(open('data/palette.json'))['farben']], float)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16.0 - 0.5
def quant(rgb):
    h, w, _ = rgb.shape
    out = np.empty((h, w, 3), np.uint8)
    flat = rgb.reshape(-1, 3)
    # gewichtete RGB-Distanz (Augenempfindlichkeit), in Bloecken
    wgt = np.array([0.30, 0.59, 0.11])
    res = np.empty(len(flat), np.int32)
    for i in range(0, len(flat), 20000):
        d = (((flat[i:i+20000, None, :] - pal[None, :, :]) ** 2) * wgt).sum(-1)
        res[i:i+20000] = d.argmin(1)
    return pal[res].reshape(h, w, 3).astype(np.uint8)
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    W, H = im.size; w, h = W // FAKTOR, H // FAKTOR
    a = np.asarray(im, float)
    pre = a[..., :3] * (a[..., 3:4] / 255.0)                    # vormultipliziert verkleinern (keine dunklen Raender)
    small_rgb = np.asarray(Image.fromarray(pre.astype(np.uint8)).resize((w, h), Image.LANCZOS), float)
    small_a = np.asarray(Image.fromarray(a[..., 3].astype(np.uint8)).resize((w, h), Image.LANCZOS), float)
    with np.errstate(divide='ignore', invalid='ignore'):
        rgb = np.where(small_a[..., None] > 0, small_rgb / (small_a[..., None] / 255.0), 0)
    rgb = np.clip(rgb, 0, 255)
    thr = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    rgb = np.clip(rgb + thr[..., None] * 36, 0, 255)             # Dither-Streuung
    q = quant(rgb)
    alpha = np.where(small_a >= 128, 255, 0).astype(np.uint8)
    out = np.dstack([q, alpha])
    img = Image.fromarray(out, 'RGBA').resize((W, H), Image.NEAREST)
    if f == 'background.png': img = img.convert('RGB')
    img.save(os.path.join(DST, f), optimize=True)
    print(f, os.path.getsize(os.path.join(DST, f)) // 1024, 'kB')
