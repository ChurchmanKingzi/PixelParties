# -*- coding: utf-8 -*-
"""Hilfsprogramm: Sprites einer Creature-Karte finden, ansehen und nach src/ extrahieren.

    python3 creature_show.py list "<Kartenname>"                 Kandidaten (aus dem xcf-Abgleich) mit Nummer
    python3 creature_show.py peek "<Kartenname>" 0,2,3 [Zoom]    Kandidaten stark vergrößert → $CREATURE_WORK/prev/peek.png
    python3 creature_show.py extract "<Kartenname>" 0,2 [slug]   gewählte Kandidaten zusammensetzen → src/<slug>.png,
                                                                 Pixelkarte im Terminal, Großbild mit Koordinaten →
                                                                 $CREATURE_WORK/prev/<slug>_src.png
$CREATURE_WORK (Standard: Scratchpad der Sitzung) enthält merged.json (Treffer) und dump/ (Ebenen der xcf-Dateien).
MINSAME=0.45 python3 … list   zeigt auch schwächere Treffer (umgefärbte Kunst).
Die Auswahl (Datei, Ebenenindex, Figurnummer) wird ausgegeben — in den Kopf des Animationsskripts schreiben.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from creature_extract import assemble, komponente  # noqa: E402

WORK = os.environ.get('CREATURE_WORK', '/tmp/claude-0/-home-user-PixelParties/d19754f3-9c1f-54fd-aa59-083e17d35f07/scratchpad')
os.makedirs(WORK + '/prev', exist_ok=True)


def slug(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def kandidaten(name):
    res = json.load(open(WORK + '/merged.json', encoding='utf-8'))
    return [h for h in res[name] if h['same'] >= float(os.environ.get('MINSAME', 0.75))][:16]


def gitter(a, s, x0=0, y0=0):
    h, w = a.shape[:2]
    bg = Image.new('RGBA', (w, h), (45, 35, 75, 255)); bg.alpha_composite(Image.fromarray(a))
    big = bg.resize((w * s, h * s), Image.NEAREST).convert('RGB'); d = ImageDraw.Draw(big)
    for x in range(0, w, 2):
        d.text((x * s + 2, 1), str(x + x0), fill=(255, 255, 0))
    for y in range(0, h, 2):
        d.text((1, y * s + 4), str(y + y0), fill=(255, 255, 0))
    return big


def trim(can):
    ys, xs = np.nonzero(can[..., 3])
    return can[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


if __name__ == '__main__':
    cmd, name = sys.argv[1], sys.argv[2]
    hs = kandidaten(name)
    if cmd == 'list':
        for k, h in enumerate(hs):
            print(k, h['file'], 'Ebene', h['i'], 'Figur', h['k'], repr(h['name']), f"{h['box'][2]}x{h['box'][3]}", 'same', h['same'],
                  'px', h['px'], 'in', h['cards'], 'Karten', 'Maßstab', h['scale'], 'fill', h['fill'], 'getönt' if h.get('tint') else '')
    elif cmd == 'peek':
        nums = [int(x) for x in sys.argv[3].split(',')]
        s = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        tiles = []
        for k in nums:
            im = trim(komponente(WORK + '/dump', hs[k]))
            t = gitter(im, s)
            d = ImageDraw.Draw(t); d.text((2, t.height - 12), f"#{k} {hs[k]['file']} L{hs[k]['i']}", fill='white')
            tiles.append(t)
        W = sum(t.width + 8 for t in tiles); sh = Image.new('RGB', (W, max(t.height for t in tiles)), (0, 0, 0)); x = 0
        for t in tiles:
            sh.paste(t, (x, 0)); x += t.width + 8
        sh.save(WORK + '/prev/peek.png'); print(WORK + '/prev/peek.png', sh.size)
    elif cmd == 'extract':
        nums = [int(x) for x in sys.argv[3].split(',')]
        sl = sys.argv[4] if len(sys.argv) > 4 else slug(name)
        teile = [hs[k] for k in nums]
        can, sc = assemble(WORK + '/dump', teile)
        can = trim(can)
        Image.fromarray(can).save(os.path.join(HERE, 'src', sl + '.png'))
        print('PICK:', json.dumps([[t['file'], t['i'], t['k']] for t in teile]), '| Maßstab in der Kunst:', sc)
        cols = {}
        for y in range(can.shape[0]):
            for x in range(can.shape[1]):
                if can[y, x, 3]:
                    c = tuple(int(v) for v in can[y, x, :3]); cols[c] = cols.get(c, 0) + 1
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        sym = {c: chars[k] for k, (c, n) in enumerate(sorted(cols.items(), key=lambda e: -e[1])) if k < len(chars)}
        print(sl, can.shape[1], 'x', can.shape[0], 'px,', len(cols), 'Farben')
        for c, sy in list(sym.items())[:20]:
            print(' ', sy, c, cols[c])
        print('    ' + ''.join(str(x // 10) for x in range(can.shape[1]))); print('    ' + ''.join(str(x % 10) for x in range(can.shape[1])))
        for y in range(can.shape[0]):
            print('%3d ' % y + ''.join(sym.get(tuple(int(v) for v in can[y, x, :3]), '?') if can[y, x, 3] else '.' for x in range(can.shape[1])))
        s = max(6, min(22, 520 // max(can.shape[:2])))
        gitter(can, s).save(WORK + f'/prev/{sl}_src.png'); print('Großbild:', WORK + f'/prev/{sl}_src.png')
