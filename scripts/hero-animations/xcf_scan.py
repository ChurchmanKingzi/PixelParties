# -*- coding: utf-8 -*-
"""Heroes in einer xcf-Arbeitsdatei finden (Abgleich Ebenen <-> Kartenbilder).

    python3 xcf_scan.py dump <datei.xcf> <arbeitsordner>
        -> jede Ebene zugeschnitten als NNN.png + meta.json (Index, Name, BBox)
    python3 xcf_scan.py match <arbeitsordner> [--heroes|--skins] [Kartenname ...]
        -> für jede Karte (Standard mit --heroes: alle noch nicht animierten
           Hero-Karten mit Bild) die Ebenen, die am besten in die Kartenkunst
           passen. Grob auf Kartenauflösung/7.8 vorsortiert, dann in voller
           Auflösung (maskiertes Template-Matching) verfeinert.
           Mit --skins: alle Skin-Karten aus cards/skins (Name mit „skins/“).
           Ergebnis: <arbeitsordner>/matches.json
    python3 xcf_scan.py sheet <arbeitsordner> <ausgabe.png> [min_score]
        -> Übersicht: Karte | beste Ebenen, für den Abgleich mit dem Auge

Kartenkunst = Ausschnitt (50,150)-(700,590) der 750x1050-Karten, Maßstab
eines Sprite-Pixels auf der Karte ≈ 750/96.
Aus dem Repo-Wurzelordner aufrufen (liest cards/ und data/).
"""
import json
import os
import re
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

S = 750 / 96
ART = (50, 150, 700, 590)


def slug(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def card_file(name):
    if name.startswith('skins/'):                       # Skin-Karten: cards/skins/<Name>.png
        return 'cards/' + name + '.png'
    return 'cards/' + re.sub(r'[\\/:*?"<>|,]', '', name).strip() + '.png'


def dump(xcf, out):
    from gimpformats.gimpXcfDocument import GimpDocument
    os.makedirs(out, exist_ok=True)
    doc = GimpDocument(xcf)
    meta = []
    for i, l in enumerate(doc.raw_layers):
        im = l.image
        bb = None
        if im is not None:
            c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
            c.paste(im.convert('RGBA'), (l.xOffset, l.yOffset))
            bb = c.getbbox()
            if bb:
                c.crop(bb).save(f'{out}/{i:03d}.png')
        meta.append({'i': i, 'name': l.name, 'bbox': list(bb) if bb else None,
                     'op': l.opacity, 'vis': bool(l.visible)})
    json.dump(meta, open(f'{out}/meta.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(meta), 'Ebenen ->', out)


def candidates(meta, out):
    res = []
    for m in meta:
        b = m['bbox']
        if not b:
            continue
        w, h = b[2] - b[0], b[3] - b[1]
        if w * h > 160 * 160 or w < 4 or h < 4 or w > 130 or h > 150:
            continue                                    # Hintergründe / Zimmer
        a = np.array(Image.open(f"{out}/{m['i']:03d}.png").convert('RGBA'))
        op = a[:, :, 3] == 255
        if op.sum() < 60 or a[op][:, :3].astype(float).std() < 20:
            continue
        res.append((m, a))
    return res


def contrast(a):
    """Streuung der deckenden Farben – der Fehler wird relativ dazu bewertet,
    sonst passen eintönige Ebenen (Säulen, Schatten) überall."""
    op = a[:, :, 3] == 255
    return float(np.sqrt(((a[op][:, :3].astype(float) - a[op][:, :3].mean(0)) ** 2).sum(1).mean())) + 1e-6


def match(out, names):
    meta = json.load(open(f'{out}/meta.json', encoding='utf-8'))
    layers = candidates(meta, out)
    print(len(layers), 'Kandidaten-Ebenen,', len(names), 'Karten')
    result = {}
    for name in names:
        card = np.array(Image.open(card_file(name)).convert('RGB')).astype(np.float32)
        art = card[ART[1]:ART[3], ART[0]:ART[2]]
        small = cv2.resize(art, (round(art.shape[1] / S), round(art.shape[0] / S)), interpolation=cv2.INTER_AREA)
        coarse = []
        for m, a in layers:
            t = a.astype(np.float32)
            if t.shape[0] > small.shape[0] or t.shape[1] > small.shape[1]:
                continue
            mask = (t[:, :, 3:4] == 255).astype(np.float32).repeat(3, 2)
            r = cv2.matchTemplate(small, t[:, :, :3], cv2.TM_SQDIFF, mask=mask)
            coarse.append((np.sqrt(cv2.minMaxLoc(r)[0] / mask.sum()) / contrast(a), m, a))
        coarse.sort(key=lambda e: e[0])
        fine = []
        for _, m, a in coarse[:8]:                      # nur die besten verfeinern
            im = Image.fromarray(a)
            t = np.array(im.resize((max(1, round(a.shape[1] * S)), max(1, round(a.shape[0] * S))),
                                   Image.NEAREST)).astype(np.float32)
            if t.shape[0] > art.shape[0] or t.shape[1] > art.shape[1]:
                continue
            mask = (t[:, :, 3:4] == 255).astype(np.float32).repeat(3, 2)
            r = cv2.matchTemplate(art, t[:, :, :3], cv2.TM_SQDIFF, mask=mask)
            mn, _, loc, _ = cv2.minMaxLoc(r)
            fine.append((float(np.sqrt(mn / mask.sum()) / contrast(a)), m['i'], m['name'], list(loc)))
        fine.sort()
        result[name] = fine
        if fine:
            print(f'{fine[0][0]:6.2f}  {name[:45]:45}  -> ' +
                  ', '.join(f"{i}:{n!r}({e:.2f})" for e, i, n, _ in fine[:3]))
    json.dump(result, open(f'{out}/matches.json', 'w', encoding='utf-8'), ensure_ascii=False)


def sheet(out, dest, max_err):
    res = json.load(open(f'{out}/matches.json', encoding='utf-8'))
    rows = []
    for name, fine in sorted(res.items(), key=lambda kv: kv[1][0][0] if kv[1] else 1e9):
        if not fine or fine[0][0] > max_err:
            continue
        card = Image.open(card_file(name)).convert('RGBA').crop(ART).resize((260, 176))
        tiles = [(f'{name[:34]}', card)]
        for e, i, n, _ in fine[:3]:
            im = Image.open(f'{out}/{i:03d}.png')
            s = max(1, min(5, 170 // max(im.size)))
            bg = Image.new('RGBA', im.size, (45, 35, 75, 255)); bg.alpha_composite(im)
            tiles.append((f'{i} {n[:14]} ({e:.2f})', bg.resize((im.width * s, im.height * s), Image.NEAREST)))
        w = sum(t.width for _, t in tiles) + 8 * len(tiles); h = max(t.height for _, t in tiles) + 14
        row = Image.new('RGBA', (w, h), (10, 8, 18, 255)); d = ImageDraw.Draw(row); x = 0
        for lab, t in tiles:
            row.paste(t, (x, 14)); d.text((x + 2, 1), lab, fill='white'); x += t.width + 8
        rows.append(row)
    W = max(r.width for r in rows); H = sum(r.height + 6 for r in rows)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 255)); y = 0
    for r in rows:
        sh.paste(r, (0, y)); y += r.height + 6
    sh.save(dest); print(len(rows), 'Zeilen ->', dest)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'dump':
        dump(sys.argv[2], sys.argv[3])
    elif cmd == 'match':
        out, rest = sys.argv[2], sys.argv[3:]
        if '--skins' in rest:
            done = {f[:-5] for f in os.listdir('data/hero-animations') if f.endswith('.json')}
            rest = ['skins/' + f[:-4] for f in sorted(os.listdir('cards/skins'))
                    if f.endswith('.png') and slug(f[:-4]) not in done]
        elif '--heroes' in rest:
            cards = json.load(open('data/cards.json', encoding='utf-8'))
            done = {f[:-5] for f in os.listdir('data/hero-animations') if f.endswith('.json')}
            rest = [c['name'] for c in cards if 'Hero' in (c.get('cardType') or '')
                    and slug(c['name']) not in done and os.path.exists(card_file(c['name']))]
        match(out, rest)
    elif cmd == 'sheet':
        sheet(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 1e9)
