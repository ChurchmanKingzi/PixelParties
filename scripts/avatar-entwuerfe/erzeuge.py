# -*- coding: utf-8 -*-
"""Erzeugt die quadratischen Shop-Avatare aus den Kartenbildern.

Bildbereich der Karte (610x400) -> natives Pixelraster (Faktor 4, 152x99) -> 64x64-Ausschnitt um (cx, cy)
-> x3 (Nearest Neighbor) = 192x192 PNG. Ausgabe: data/shop/avatar-entwuerfe/<ID>.png (PP_OUT änderbar);
übernommene Avatare werden nach data/shop/avatars/ kopiert.

Aufruf:  python3 erzeuge.py [ID ...]      (ohne Argumente: alle Picks)
         python3 erzeuge.py --sheet       (Übersichtsbild 00_uebersicht.png)
"""
import os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from picks import PICKS

SP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('PP_ROOT') or os.path.abspath(os.path.join(SP, '..', '..'))
OUT = os.environ.get('PP_OUT') or os.path.join(ROOT, 'data', 'shop', 'avatar-entwuerfe')
CROP, SCALE, BLOCK, PX, PY = 64, 3, 4, 2, 2


def norm(n):
    return re.sub(r'[^a-z0-9]', '', n.lower())


_LUT = {}
for _d in (os.path.join(ROOT, 'cards', 'skins'), os.path.join(ROOT, 'cards')):
    for _f in os.listdir(_d):
        if _f.endswith('.png'):
            _LUT[norm(_f[:-4])] = os.path.join(_d, _f)


def native(name):
    """Bildbereich der Karte auf das native Pixelraster (Blockmedian) zurückrechnen."""
    a = np.array(Image.open(_LUT[norm(name)]).convert('RGB'))[168:568, 70:680][PY:, PX:]
    h, w = a.shape[0] // BLOCK, a.shape[1] // BLOCK
    a = a[:h * BLOCK, :w * BLOCK].reshape(h, BLOCK, w, BLOCK, 3)
    c = a[:, 1:3, :, 1:3, :].transpose(0, 2, 1, 3, 4).reshape(h, w, -1, 3)
    return np.median(c, axis=2).astype(np.uint8)


def avatar(name, cx, cy, size=CROP):
    n = native(name)
    h, w = n.shape[:2]
    x0 = max(0, min(w - size, cx - size // 2))
    y0 = max(0, min(h - size, cy - size // 2))
    im = Image.fromarray(n[y0:y0 + size, x0:x0 + size])
    k = SCALE if size == CROP else max(SCALE, round(CROP * SCALE / size))
    return im.resize((size * k, size * k), Image.NEAREST)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    picks = [p for p in PICKS if not args or p[0] in args]
    os.makedirs(OUT, exist_ok=True)
    for pid, name, cx, cy, *z in picks:
        avatar(name, cx, cy, *z).save(os.path.join(OUT, pid + '.png'))
    if '--sheet' in sys.argv:
        cols, t = 8, CROP * SCALE // 2
        rows = (len(picks) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (t + 6), rows * (t + 18)), (24, 24, 24))
        d = ImageDraw.Draw(sheet)
        for k, (pid, name, cx, cy, *z) in enumerate(picks):
            x, y = (k % cols) * (t + 6), (k // cols) * (t + 18)
            d.text((x + 2, y + 2), pid, fill=(255, 255, 0))
            sheet.paste(avatar(name, cx, cy, *z).resize((t, t), Image.NEAREST), (x + 2, y + 16))
        sheet.save(os.path.join(OUT, '00_uebersicht.png'))
    print(len(picks), 'Avatare ->', OUT)


if __name__ == '__main__':
    main()
