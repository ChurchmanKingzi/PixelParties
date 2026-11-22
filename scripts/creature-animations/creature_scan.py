# -*- coding: utf-8 -*-
"""Creature-Sprites in den xcf-Arbeitsdateien finden (Abgleich Figuren <-> Kartenkunst, 1:1).

Die Kartenkunst (data/card-art/native/*.png, meist 76×51 px) ist ein Ausschnitt der Leinwand
der Motive*.xcf in Originalauflösung — ein Sprite-Pixel ist dort genau ein Bildpunkt. Die Kunst
wurde verlustbehaftet gespeichert (Farbrauschen ±2–6 je Kanal) und teils überzeichnet (Fäden,
Effekte), deshalb wird mit Toleranz abgeglichen. Gematcht werden nicht ganze Ebenen (manche sind
Sprite-Blätter), sondern zusammenhängende Figuren innerhalb der Ebenen.

    python3 creature_scan.py match <dump-ordner> <ausgabe.json> [--only <Datei>,...] [Kartenname ...]
    python3 creature_scan.py match-tint <dump-ordner> <ausgabe.json> [--only …] Kartenname ...
        -> zweiter Durchgang für umgefärbte Kunst (Tiefsee-Blau, Feuerschein …), nur für die genannten Karten
        -> <dump-ordner>/<Motive…>/ kommt aus `hero-animations/xcf_scan.py dump`
           (NNN.png je Ebene, zugeschnitten, plus meta.json).
           Ohne Kartennamen: alle Creature-Karten mit Kunst im Index.
           Ausgabe: je Karte die passenden Figuren (Datei, Ebene, Name, Figurnummer, Rahmen im
           Ebenenbild, Versatz in der Kunst, Anteil farbtoleranter Pixel, Zahl der Karten, in denen
           die Figur ebenfalls steckt, Rechteckigkeit).

Aus dem Repo-Wurzelordner aufrufen (liest data/).
"""
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image

MIN_PX = 12             # kleinste Figur (deckende Pixel)
TOL = 16                # Farbtoleranz je Kanal (Rauschen der Kunst)
GLEICH = 0.60           # Anteil toleranter Pixel am besten Versatz
VOR = 0.55              # Farb-Vorfilter (grobe Farbfächer, großzügiger als GLEICH)
MAX_W, MAX_H = 160, 140  # größer als jede Kunst → gar nicht erst betrachten
SCALES = (1, 2, 3, 4)   # manche Kunst ist mit 2-/3-/4-facher Pixelgröße gezeichnet


def slug(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def creatures(namen=None):
    cards = json.load(open('data/cards.json', encoding='utf-8'))
    idx = json.load(open('data/card-art/index.json', encoding='utf-8'))
    out = []
    for c in cards:
        if 'Creature' not in (c.get('cardType') or ''):
            continue
        if namen and c['name'] not in namen:
            continue
        e = idx.get(c['name'])
        if not e:
            continue
        p = f"data/card-art/native/{e['id']}.png"
        if os.path.exists(p):
            out.append((c['name'], p))
    return out


def pack(a):
    a = a.astype(np.int64)
    return (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]


def bins(rgb):
    """Grobe Farbfächer-Nummer (5 Bit je Kanal) zu jedem Pixel."""
    q = (rgb.astype(np.int64) >> 3)
    return (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]


def fan(art):
    """Wahrheitswerte je Farbfach, das in der Kunst (±2 Fächer je Kanal) vorkommt."""
    cube = np.zeros((32, 32, 32), bool)
    cube.reshape(-1)[np.unique(bins(art.astype(np.uint8)))] = True
    for ax in range(3):                                      # je Achse ±2 Fächer verbreitern
        p = np.pad(cube, [(2, 2) if k == ax else (0, 0) for k in range(3)])
        cube = np.logical_or.reduce([np.take(p, range(d, d + 32), axis=ax) for d in range(5)])
    return cube.reshape(-1)


def figuren(root, nur=None):
    """Zusammenhängende Figuren aller Ebenen (Lücken von 1 px zählen noch als zusammenhängend)."""
    res = []
    for f in sorted(os.listdir(root)):
        if nur and f not in nur:
            continue
        d = os.path.join(root, f)
        mp = os.path.join(d, 'meta.json')
        if not os.path.exists(mp):
            continue
        for m in json.load(open(mp, encoding='utf-8')):
            png = os.path.join(d, f"{m['i']:03d}.png")
            if not m['bbox'] or not os.path.exists(png):
                continue
            a = np.array(Image.open(png).convert('RGBA'))
            op = (a[..., 3] >= 250).astype(np.uint8)
            if op.sum() < MIN_PX:
                continue
            n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(op, np.ones((3, 3), np.uint8)), connectivity=8)
            for k in range(1, n):
                x, y, w, h, _a = st[k]
                if w > MAX_W or h > MAX_H:
                    continue
                msk = (lab[y:y + h, x:x + w] == k) & (op[y:y + h, x:x + w] > 0)
                px = int(msk.sum())
                if px < MIN_PX:
                    continue
                rgb = a[y:y + h, x:x + w, :3]
                if len(np.unique(pack(rgb[msk]))) < 2:
                    continue                                 # einfarbige Kleckse passen überall
                res.append({'file': f, 'i': m['i'], 'name': m['name'], 'k': k, 'box': [int(x), int(y), int(w), int(h)],
                            'canvas': [m['bbox'][0] + int(x), m['bbox'][1] + int(y)], 'vis': m['vis'],
                            'rgb': rgb, 'mask': msk, 'px': px, 'fill': round(px / (w * h), 3)})
    return res


def match(root, namen=None, nur=None):
    cards = creatures(namen)
    arts = {n: np.array(Image.open(p).convert('RGB')).astype(np.float32) for n, p in cards}
    figs = figuren(root, nur)
    print(len(cards), 'Karten,', len(figs), 'Figuren', flush=True)
    hits = {n: [] for n in arts}
    namen_liste = list(arts)
    faecher = np.stack([fan(arts[n]) for n in namen_liste]).astype(np.float32)          # Karten × 32768
    for fi, F in enumerate(figs):
        h, w = F['mask'].shape
        b, cnt = np.unique(bins(F['rgb'])[F['mask']], return_counts=True)
        vor = faecher[:, b] @ cnt.astype(np.float32) / cnt.sum()                       # Farbanteil je Karte
        for k in np.nonzero(vor >= VOR)[0]:
            n = namen_liste[k]
            art = arts[n]
            best = None
            for sc in SCALES:
                if h * sc > art.shape[0] or w * sc > art.shape[1]:
                    break
                msk = np.repeat(np.repeat(F['mask'], sc, 0), sc, 1)
                tmpl = np.repeat(np.repeat(F['rgb'], sc, 0), sc, 1).astype(np.float32)
                r = cv2.matchTemplate(art, tmpl, cv2.TM_SQDIFF, mask=msk.astype(np.float32)[..., None].repeat(3, 2))
                x, y = cv2.minMaxLoc(r)[2]
                win = art[y:y + h * sc, x:x + w * sc]
                gl = float((np.abs(win - tmpl).max(axis=2) <= TOL)[msk].mean())
                if gl >= GLEICH and (best is None or gl > best[0] + 0.02):
                    best = (gl, sc, x, y)
            if best:
                gl, sc, x, y = best
                hits[n].append({'file': F['file'], 'i': F['i'], 'name': F['name'], 'k': F['k'], 'box': F['box'],
                                'canvas': F['canvas'], 'at': [int(x), int(y)], 'scale': sc, 'same': round(gl, 3),
                                'px': F['px'], 'fill': F['fill'], 'vis': F['vis']})
        if fi % 500 == 0:
            print(' ', fi, '/', len(figs), flush=True)
    zaehl = {}
    for hs in hits.values():
        for hh in hs:
            key = (hh['file'], hh['i'], hh['k'])
            zaehl[key] = zaehl.get(key, 0) + 1
    for hs in hits.values():
        for hh in hs:
            hh['cards'] = zaehl[(hh['file'], hh['i'], hh['k'])]
        hs.sort(key=lambda e: (-e['same'], e['cards']))
    return hits


def kontrast(F):
    """Streuung der Helligkeit und Zahl der Farben — flache Figuren passen per Korrelation überall."""
    px = F['rgb'][F['mask']].astype(np.float32)
    luma = px @ np.array([0.299, 0.587, 0.114], np.float32)
    return float(luma.std()), len(np.unique(pack(F['rgb'][F['mask']])))


def match_tint(root, namen, nur=None, ncc=0.80, resid=26.0):
    """Zweiter Durchgang für umgefärbte/aufgehellte Kunst (Tiefsee-Blau, Feuerschein, Nacht …):
    normierte Korrelation der Helligkeit (farb- und helligkeitsunabhängig) am besten Versatz, danach
    Kanal für Kanal lineare Farbanpassung Kunst ≈ g·Figur + o; 'same' ist der Anteil der Pixel,
    die danach höchstens `resid` abweichen."""
    cards = creatures(namen)
    arts = {n: np.array(Image.open(p).convert('RGB')).astype(np.float32) for n, p in cards}
    grau = {n: a @ np.array([0.299, 0.587, 0.114], np.float32) for n, a in arts.items()}
    figs = [F for F in figuren(root, nur) if F['px'] >= 40 and kontrast(F)[0] >= 18 and kontrast(F)[1] >= 4]
    print(len(cards), 'Karten,', len(figs), 'kontrastreiche Figuren (Tönungs-Abgleich)', flush=True)
    hits = {n: [] for n in arts}
    for fi, F in enumerate(figs):
        h, w = F['mask'].shape
        for n, art in arts.items():
            best = None
            for sc in SCALES:
                if h * sc > art.shape[0] or w * sc > art.shape[1]:
                    break
                msk = np.repeat(np.repeat(F['mask'], sc, 0), sc, 1)
                tm = np.repeat(np.repeat(F['rgb'], sc, 0), sc, 1).astype(np.float32)
                tg = tm @ np.array([0.299, 0.587, 0.114], np.float32)
                r = cv2.matchTemplate(grau[n], tg, cv2.TM_CCOEFF_NORMED, mask=msk.astype(np.float32))
                mx, loc = cv2.minMaxLoc(r)[1], cv2.minMaxLoc(r)[3]
                if not np.isfinite(mx) or mx < ncc:
                    continue
                x, y = loc
                win = art[y:y + h * sc, x:x + w * sc]
                ok = np.ones(msk.sum(), bool)
                for c in range(3):                                     # Kanal für Kanal Kunst ≈ g·Figur + o
                    t, a = tm[..., c][msk], win[..., c][msk]
                    g, o = np.polyfit(t, a, 1) if t.std() > 1e-3 else (1.0, float(a.mean() - t.mean()))
                    ok &= np.abs(a - (g * t + o)) <= resid
                gl = float(ok.mean())
                if gl >= GLEICH and (best is None or gl > best[0] + 0.02):
                    best = (gl, sc, x, y, float(mx))
            if best:
                gl, sc, x, y, mx = best
                hits[n].append({'file': F['file'], 'i': F['i'], 'name': F['name'], 'k': F['k'], 'box': F['box'],
                                'canvas': F['canvas'], 'at': [int(x), int(y)], 'scale': sc, 'same': round(gl, 3),
                                'px': F['px'], 'fill': F['fill'], 'vis': F['vis'], 'ncc': round(mx, 3), 'tint': True})
        if fi % 500 == 0:
            print(' ', fi, '/', len(figs), flush=True)
    zaehl = {}
    for hs in hits.values():
        for hh in hs:
            key = (hh['file'], hh['i'], hh['k'])
            zaehl[key] = zaehl.get(key, 0) + 1
    for hs in hits.values():
        for hh in hs:
            hh['cards'] = zaehl[(hh['file'], hh['i'], hh['k'])]
        hs.sort(key=lambda e: (-e['same'], e['cards']))
    return hits


if __name__ == '__main__':
    if sys.argv[1] in ('match', 'match-tint'):
        args = sys.argv[4:]
        nur = None
        if '--names-file' in args:                              # JSON-Liste der Kartennamen
            k = args.index('--names-file')
            args = args[:k] + json.load(open(args[k + 1], encoding='utf-8')) + args[k + 2:]
        if '--only' in args:
            k = args.index('--only')
            nur = set(args[k + 1].split(','))
            del args[k:k + 2]
        if sys.argv[1] == 'match-tint':
            res = match_tint(sys.argv[2], set(args) or None, nur)
        else:
            res = match(sys.argv[2], set(args) or None, nur)
        json.dump(res, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)
        mit = sum(1 for v in res.values() if v)
        print(mit, 'von', len(res), 'Karten haben Treffer ->', sys.argv[3])
