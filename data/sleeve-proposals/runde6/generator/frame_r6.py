# -*- coding: utf-8 -*-
"""Rahmt die Gegner-Sleeves aus Runde 6 (Zuordnung in frames_r6.json:
Datei → [Name, Bauform, Palette, Stein, Stein2 oder null, Deck-ID]) mit runde3/generator/frames2.py,
speichert sie in ../final/<Name>.png, kopiert sie nach data/shop/sleeves/<id>.png (id = Name als Slug)
und trägt Deck → Sleeve in data/shop/cpu-sleeves.json ein. Gegner-Sleeves stehen bewusst NICHT in
sleeve-names.json: Sie sind nicht käuflich, sondern werden durch fünf Siege gegen ihre CPU freigeschaltet
(cpu-sleeves.js).
Liegen overlays/<stem>_base.png und overlays/<stem>_top.png vor, wird die Basis gerahmt und die obere Ebene
danach über Bild und Rahmen gelegt.
Aufruf: python3 frame_r6.py [--no-shop] [NN_name.png ...]   (ohne Dateien: alle)"""
import json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'runde3', 'generator'))
import frames2 as F

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
MAP_JSON = os.path.join(ROOT, 'data', 'shop', 'cpu-sleeves.json')
M = json.load(open(os.path.join(HERE, 'frames_r6.json'), encoding='utf-8'))


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace("'", '')).strip('-')


args = sys.argv[1:]
shop = '--no-shop' not in args
files = [a for a in args if a != '--no-shop'] or list(M)
os.makedirs(os.path.join(HERE, '..', 'final'), exist_ok=True)
try:
    doc = json.load(open(MAP_JSON, encoding='utf-8'))
except FileNotFoundError:
    doc = {'sleeves': []}
for f in files:
    name, form, pal, gem, gem2, deck = M[f]
    fr = [form, pal, gem] + ([gem2] if gem2 else [])
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
        # Ein Eintrag je Deck: ein umbenanntes Sleeve ersetzt den alten Eintrag (altes Bild wird entfernt).
        old = next((e for e in doc['sleeves'] if e['deckId'] == deck), None)
        if old and old['id'] != sid:
            p = os.path.join(ROOT, 'data', 'shop', 'sleeves', old['id'] + '.png')
            if os.path.exists(p):
                os.remove(p)
        doc['sleeves'] = [e for e in doc['sleeves'] if e['deckId'] != deck] + [{'deckId': deck, 'id': sid, 'name': name}]
        print(out, '->', sid)
    else:
        print(out)
if shop:
    order = {v[5]: i for i, v in enumerate(M.values())}
    doc['sleeves'].sort(key=lambda e: order.get(e['deckId'], 999))
    with open(MAP_JSON, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
