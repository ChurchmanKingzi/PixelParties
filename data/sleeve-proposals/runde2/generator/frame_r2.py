# -*- coding: utf-8 -*-
"""Rahmt die Runde-2-Sleeves (Zuordnung in frames_r2.json) mit runde3/generator/frames2.py, speichert sie in
../final/<Name>.png und kopiert sie in den Shop (data/shop/sleeves/<id>.png, id laut sleeve-names.json).
Liegen zu einem Sleeve overlays/<stem>_base.png und overlays/<stem>_top.png vor (z. B. die Lupe im Detective
Board), wird die Basis gerahmt und die obere Ebene danach über Bild und Rahmen gelegt.
Aufruf: python3 frame_r2.py [01_guardian_zodiac.png ...]   (ohne Argumente: alle)"""
import json, os, shutil, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'runde3', 'generator'))
import frames2 as F

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
M = json.load(open(os.path.join(HERE, 'frames_r2.json'), encoding='utf-8'))
NAMES = {e['name']: e['id'] for e in
         json.load(open(os.path.join(ROOT, 'data', 'shop', 'sleeve-names.json'), encoding='utf-8'))['sleeves']}

for f in sys.argv[1:] or list(M):
    name, *fr = M[f]
    stem = f[:-4]
    out = os.path.join(HERE, '..', 'final', name.replace("'", '') + '.png')
    base, top = (os.path.join(HERE, 'overlays', f'{stem}_{k}.png') for k in ('base', 'top'))
    if os.path.exists(base) and os.path.exists(top):
        F.apply(base, out, *fr)
        im = Image.open(out).convert('RGBA')
        im.alpha_composite(Image.open(top).convert('RGBA'))
        im.convert('RGB').save(out, optimize=True)
    else:
        F.apply(os.path.join(HERE, '..', f), out, *fr)
    shop = os.path.join(ROOT, 'data', 'shop', 'sleeves', NAMES[name] + '.png')
    shutil.copyfile(out, shop)
    print(out, '->', os.path.relpath(shop, ROOT))
