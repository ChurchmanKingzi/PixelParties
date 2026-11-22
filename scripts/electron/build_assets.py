# -*- coding: utf-8 -*-
"""Bild-Assets der Desktop-Startseite (electron/launcher.html) erzeugen / übernehmen.

Aufruf:  python3 scripts/electron/build_assets.py
Ausgabe (electron/assets/):
  logo.png        das Pixel-Parties-Banner aus data/logo.png in der Akzentfarbe (Banner-Fläche per logo-tint-mask eingefärbt, Palette gerastet)
  vignette.png    Dither-Rand (nur harte Alpha-Werte 0/255, Bayer 4x4) – dunkelt Ränder und Unterkante der Kulisse für die Bedienung
  scene/*.png     Ebenen der Titelkulisse (data/animated_screen/layers2) für die animierte Startseite
  fonts/PixelIntv.otf  Pixelschrift des Spiels
  music/title.ogg  Titelmusik (= public/music/bgm_login.ogg)
Alles Selbstgezeichnete rastet auf die Spiel-Palette (data/palette.json). Keine Weichzeichnung.
"""
import os, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'booster'))
import pal

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'electron', 'assets')
os.makedirs(os.path.join(OUT, 'scene'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'fonts'), exist_ok=True)

# ── Logo ──
logo = np.asarray(Image.open(os.path.join(ROOT, 'data', 'logo.png')).convert('RGBA')).copy()
tint = np.asarray(Image.open(os.path.join(ROOT, 'data', 'logo-tint-mask.png')).convert('RGBA'))[..., 3] > 0
lum = (logo[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])) / 255.0
ramp = [pal.hexrgb(h) for h in ('#12101f', '#243a8a', '#3a6ec8', '#66b6ff', '#b8e0ff', '#ffffff')]
pos = np.clip(lum, 0, 1) * (len(ramp) - 1)
lo = np.floor(pos).astype(int); hi = np.minimum(lo + 1, len(ramp) - 1); fr = pos - lo
H, W = lum.shape
bay = np.tile(np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0, (H // 4 + 1, W // 4 + 1))[:H, :W]
idx = np.where(fr > bay, hi, lo)
col = np.array(ramp)[idx]
out = logo[..., :3].astype(float)
out[tint] = col[tint]
logo[..., :3] = pal.snap(out)
Image.fromarray(logo, 'RGBA').save(os.path.join(OUT, 'logo.png'))

# ── Vignette (640x360, 1 Zelle = 1 Bildpunkt): Dither nach unten und zu den Rändern ──
w, h = 640, 360
yy, xx = np.mgrid[0:h, 0:w]
edge = np.minimum.reduce([xx, w - 1 - xx, (yy * 1.2).astype(int), h - 1 - yy]) / 56.0
bottom = np.clip((yy - h * 0.74) / (h * 0.26), 0, 1)           # nur die untere Kante (Buttons liegen dort)
strength = np.clip(np.maximum(1 - edge, bottom * 1.05), 0, 1)
b4 = np.tile(np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0, (h // 4, w // 4))
v = np.zeros((h, w, 4), np.uint8)
dark = pal.snap(pal.hexrgb('#0c0a16')[None, :])[0]
mask = strength * 0.95 > b4
v[mask, :3] = dark; v[mask, 3] = 255
Image.fromarray(v, 'RGBA').save(os.path.join(OUT, 'vignette.png'))

# ── Kulisse + Schrift ──
for f in ('background', 'angel', 'blonde', 'golem', 'horned', 'ninja', 'rabbit', 'explosion', 'hammer', 'cat_bottom', 'cat_mid', 'cat_top'):
    shutil.copy(os.path.join(ROOT, 'data', 'animated_screen', 'layers2', f + '.png'), os.path.join(OUT, 'scene', f + '.png'))
os.makedirs(os.path.join(OUT, 'music'), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'public', 'music', 'bgm_login.ogg'), os.path.join(OUT, 'music', 'title.ogg'))  # dieselbe Musik wie der Login-Bildschirm des Spiels
shutil.copy(os.path.join(ROOT, 'data', 'Pixel Intv.otf'), os.path.join(OUT, 'fonts', 'PixelIntv.otf'))
print('ok')
