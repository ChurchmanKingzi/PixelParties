# -*- coding: utf-8 -*-
"""Treffer von creature_scan.py zusammenführen und als Prüfbilder darstellen.

    python3 creature_review.py merge <match-ordner> <ausgabe.json>
        -> alle <match-ordner>/*.json zu einer Datei (Karte -> Treffer), Duplikate (gleiche Pixel an
           gleicher Stelle, z. B. dieselbe Figur in „Sichtbar #N"-Kopien) entfernt.
    python3 creature_review.py sheet <merged.json> <dump-ordner> <ausgabe-ordner> [Kartenname ...]
        -> je Karte ein Bild: links die Kunst (4-fach) mit nummerierten Rahmen um die Treffer,
           rechts die Kandidatenfiguren (nummeriert, mit Datei/Ebene/Übereinstimmung).

Aus dem Repo-Wurzelordner aufrufen (liest data/).
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

SC = 4
FARBEN = [(255, 80, 80), (80, 220, 80), (90, 140, 255), (255, 210, 60), (255, 100, 255), (60, 230, 230),
          (255, 150, 40), (180, 120, 255), (160, 255, 120), (255, 120, 170), (120, 200, 255), (220, 220, 220)]


def art_path(name):
    idx = json.load(open('data/card-art/index.json', encoding='utf-8'))
    return f"data/card-art/native/{idx[name]['id']}.png"


def merge(ordner, ziel):
    res = {}
    for f in sorted(os.listdir(ordner)):
        if not f.endswith('.json'):
            continue
        for n, hs in json.load(open(os.path.join(ordner, f), encoding='utf-8')).items():
            res.setdefault(n, []).extend(hs)
    zaehl = {}
    for n, hs in res.items():
        for h in hs:
            zaehl[(h['file'], h['i'], h['k'])] = zaehl.get((h['file'], h['i'], h['k']), 0) + 1
    for n, hs in res.items():
        seen, out = set(), []
        for h in sorted(hs, key=lambda e: (-e['same'], not e['vis'], e['i'])):
            key = (tuple(h['at']), tuple(h['box'][2:]), h['px'], h.get('scale', 1))
            if key in seen:
                continue
            seen.add(key)
            h['cards'] = zaehl[(h['file'], h['i'], h['k'])]
            out.append(h)
        res[n] = out
    json.dump(res, open(ziel, 'w', encoding='utf-8'), ensure_ascii=False)
    print(sum(1 for v in res.values() if v), 'von', len(res), 'Karten mit Treffern ->', ziel)


def figur_bild(dump, h):
    """Figur als RGBA (aus dem Ebenenbild, deckende Pixel plus Halbdeckendes im Rahmen)."""
    a = np.array(Image.open(os.path.join(dump, h['file'], f"{h['i']:03d}.png")).convert('RGBA'))
    x, y, w, hh = h['box']
    return Image.fromarray(a[y:y + hh, x:x + w])


def sheet(merged, dump, ziel, namen):
    res = json.load(open(merged, encoding='utf-8'))
    os.makedirs(ziel, exist_ok=True)
    for n in (namen or res):
        hs = [h for h in res.get(n, []) if h['same'] >= float(os.environ.get('MINSAME', 0.75))][:12]
        art = Image.open(art_path(n)).convert('RGB').resize((76 * SC, 51 * SC), Image.NEAREST)
        d = ImageDraw.Draw(art)
        tiles = []
        for k, h in enumerate(hs):
            c = FARBEN[k % len(FARBEN)]
            x, y = h['at']; sc = h.get('scale', 1); w, hh = h['box'][2] * sc, h['box'][3] * sc
            d.rectangle([x * SC, y * SC, (x + w) * SC - 1, (y + hh) * SC - 1], outline=c)
            d.text((x * SC + 2, y * SC + 1), str(k), fill=c)
            im = figur_bild(dump, h)
            s = max(1, min(4, 120 // max(im.size)))
            bg = Image.new('RGBA', im.size, (45, 35, 75, 255)); bg.alpha_composite(im)
            tiles.append((f"{k}: {h['file'][6:]} {h['i']} {h['name'][:14]!r} {h['same']:.2f} x{h['cards']} s{h.get('scale', 1)}", c,
                          bg.resize((im.width * s, im.height * s), Image.NEAREST)))
        cols = 6
        rows = (len(tiles) + cols - 1) // cols
        cw = max([t.width for _, _, t in tiles] + [90]) + 6
        chh = max([t.height for _, _, t in tiles] + [30]) + 16
        W = art.width + 12 + cols * cw
        H = max(art.height, rows * chh) + 18
        sh = Image.new('RGB', (W, H), (12, 10, 20)); dd = ImageDraw.Draw(sh)
        dd.text((2, 2), n, fill='white'); sh.paste(art, (0, 16))
        for k, (lab, c, t) in enumerate(tiles):
            x = art.width + 12 + (k % cols) * cw; y = 16 + (k // cols) * chh
            dd.text((x, y), lab[:cw // 6], fill=c); sh.paste(t.convert('RGB'), (x, y + 12))
        sh.save(os.path.join(ziel, re.sub(r'[^A-Za-z0-9]+', '_', n) + '.png'))
    print('fertig ->', ziel)


if __name__ == '__main__':
    if sys.argv[1] == 'merge':
        merge(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'sheet':
        sheet(sys.argv[2], sys.argv[3], sys.argv[4], set(sys.argv[5:]) or None)
