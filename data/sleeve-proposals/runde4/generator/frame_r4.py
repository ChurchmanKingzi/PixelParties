# -*- coding: utf-8 -*-
"""Rahmt die Runde-4-Sleeves (Zuordnung in frames_r4.json: Datei → [Name, Bauform, Palette, Stein(, Stein2)])
mit runde3/generator/frames2.py, speichert sie in ../final/<Name>.png, kopiert sie in den Shop
(data/shop/sleeves/<id>.png, id = Name als Slug) und trägt fehlende Namen in data/shop/sleeve-names.json ein.
Liegen overlays/<stem>_base.png und overlays/<stem>_top.png vor, wird die Basis gerahmt und die obere Ebene
danach über Bild und Rahmen gelegt.
Aufruf: python3 frame_r4.py [--no-shop] [NN_name.png ...]   (ohne Dateien: alle)"""
import json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'runde3', 'generator'))
import frames2 as F

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
NAMES_JSON = os.path.join(ROOT, 'data', 'shop', 'sleeve-names.json')
M = json.load(open(os.path.join(HERE, 'frames_r4.json'), encoding='utf-8'))


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace("'", '')).strip('-')


args = sys.argv[1:]
shop = '--no-shop' not in args
files = [a for a in args if a != '--no-shop'] or list(M)
os.makedirs(os.path.join(HERE, '..', 'final'), exist_ok=True)
doc = json.load(open(NAMES_JSON, encoding='utf-8'))
known = {e['id'] for e in doc['sleeves']}
for f in files:
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
    if shop:
        sid = slug(name)
        shutil.copyfile(out, os.path.join(ROOT, 'data', 'shop', 'sleeves', sid + '.png'))
        if sid not in known:
            doc['sleeves'].append({'id': sid, 'name': name}); known.add(sid)
        print(out, '->', sid)
    else:
        print(out)
if shop:
    with open(NAMES_JSON, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
