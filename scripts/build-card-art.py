#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Packt die Kartenkunst fuer den dynamischen Karten-Renderer (public/card-render.js).

    python scripts/build-card-art.py

Quelle:  data/card-art/index.json          Karte/Skin -> { id, kind }
         data/card-art/native/<id>.png     Kunst im NATIVEN Pixelraster (meist 76x51 Pixel)
Ziel:    public/cardgen/art.png + art.json Atlas aller nativen Kunstbilder (EINE Datei statt hunderter)
         public/cardgen/art/<id>.webp      Kunst, die kein sauberes Pixelraster hat (kind "b", Vollaufloesung,
                                           wird von Hand dort abgelegt und nur bei Bedarf geladen)

Der Renderer streckt die native Kunst per nearest neighbour auf das Bildfeld der Karte (610x400, bei Vollbild-
Helden 750x1050) — dieselbe Streckung wie im Karten-Template. Neue Karte: PNG im nativen Raster nach
data/card-art/native/<id>.png legen, in index.json eintragen ("<Kartenname>": {"id": "<id>", "kind": "a"}),
Skript laufen lassen.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'data', 'card-art')
OUT = os.path.join(ROOT, 'public', 'cardgen')
index = json.load(open(os.path.join(SRC, 'index.json'), encoding='utf-8'))

native = {}      # id -> Image
for key, e in index.items():
    if e['kind'] == 'a' and e['id'] not in native:
        p = os.path.join(SRC, 'native', e['id'] + '.png')
        if not os.path.exists(p): sys.exit('fehlt: ' + p)
        native[e['id']] = Image.open(p).convert('RGB')
    elif e['kind'] == 'b':
        p = os.path.join(OUT, 'art', e['id'] + '.webp')
        if not os.path.exists(p): sys.exit('fehlt: ' + p)

# Regalpacking, Breite 2048, hoechste zuerst
W = 2048
ids = sorted(native, key=lambda i: (-native[i].height, -native[i].width, i))
x = y = rowh = 0
rect = {}
for i in ids:
    im = native[i]
    if x + im.width > W:
        x = 0; y += rowh; rowh = 0
    rect[i] = [x, y, im.width, im.height]
    x += im.width; rowh = max(rowh, im.height)
H = y + rowh
atlas = Image.new('RGB', (W, H), (0, 0, 0))
for i, (rx, ry, rw, rh) in rect.items():
    atlas.paste(native[i], (rx, ry))
os.makedirs(OUT, exist_ok=True)
atlas.save(os.path.join(OUT, 'art.png'), optimize=True)

art = {'atlas': 'art.png', 'size': [W, H], 'a': {}, 'b': {}}
for key, e in sorted(index.items()):
    if e['kind'] == 'a': art['a'][key] = rect[e['id']]
    else: art['b'][key] = e['id'] + '.webp'
with open(os.path.join(OUT, 'art.json'), 'w', encoding='utf-8') as fh:
    json.dump(art, fh, ensure_ascii=False, separators=(',', ':'))
# Vollaufloesungs-Dateien, auf die kein Eintrag mehr zeigt, aufraeumen
used = {e['id'] + '.webp' for e in index.values() if e['kind'] == 'b'}
adir = os.path.join(OUT, 'art')
stale = [f for f in os.listdir(adir) if f.endswith('.webp') and f not in used] if os.path.isdir(adir) else []
for f in stale: os.remove(os.path.join(adir, f))
print('art.png %dx%d (%d KB), %d Kunstbilder im Atlas, %d in Vollaufloesung' % (
    W, H, os.path.getsize(os.path.join(OUT, 'art.png')) // 1024, len(art['a']), len(art['b'])))
if stale: print('%d nicht mehr benoetigte Vollaufloesungs-Dateien entfernt' % len(stale))
