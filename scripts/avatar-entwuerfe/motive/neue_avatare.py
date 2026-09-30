# -*- coding: utf-8 -*-
"""Neue Shop-Avatare direkt aus den Motiv-Szenen (nie aus Kartenbildern!).

locate_cards.json (aus locate_cards.py) sagt, in welcher Motiv-Ebene und wo das Szenenbild einer Karte liegt.
Das Kartenbild dient nur zum Auffinden; die Pixel stammen aus der exportierten Motiv-Ebene.
Aufruf:  python3 neue_avatare.py [ID ...]   -> schreibt nach data/shop/avatar-entwuerfe/motiv/
"""
import os, sys, re, json
import numpy as np, cv2
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from picks import PICKS

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
E = '/home/user/sprites_export'
SP = '/tmp/claude-0/-home-user-PixelParties/ba24cb66-9bb9-5fd5-a116-fde55cc1f4a5/scratchpad'
OUT = os.path.join(ROOT, 'data', 'shop', 'avatar-entwuerfe', 'motiv')
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
items = json.load(open(SP + '/items.json'))
IDX = {norm(it['name']): it['i'] for it in items}
LOC = json.load(open('/home/user/locate_cards.json'))
_cache = {}


def card_native(i, m):
    p = os.path.join(ROOT, 'cards', items[i]['file'])
    a = np.array(Image.open(p).convert('RGB'))[168:568, 70:680]
    return cv2.resize(a, (round(610 / m), round(400 / m)), interpolation=cv2.INTER_AREA).astype(np.float32)


REF = json.load(open('/home/user/refine_layers.json'))
MAX_ERR = 0.012


def frame(i):
    """(RGB-Array der Szene in nativen Motiv-Pixeln, Fehler, Quelle) oder None, wenn keine gute Ebene gefunden wurde."""
    if str(i) not in REF:
        return None
    e, f, idx, m, x, y = REF[str(i)]
    if e > MAX_ERR:
        return None
    key = (f, idx)
    if key not in _cache:
        _cache[key] = np.array(Image.open(f'{E}/{f}/crops/{idx:04d}.png').convert('RGBA'))
    meta = [l for l in json.load(open(f'{E}/{f}/layers.json'))['layers'] if l['index'] == idx][0]
    t = card_native(i, m)
    th, tw = t.shape[:2]
    X, Y = x - meta['bx'], y - meta['by']
    return _cache[key][Y:Y + th, X:X + tw, :3], e, f'{f[6:] or "Motive"}#{idx}@{x},{y} m{m}'


def avatar(card, cx, cy, size=64):
    i = IDX[norm(card)]
    fr = frame(i)
    if fr is None:
        return None
    a, sc, src = fr
    h, w = a.shape[:2]
    s = min(size // 2, h, w)          # Karten-Raster (152x99) -> Motivraster (76x50)
    x0 = int(max(0, min(w - s, round(cx / 2 - s / 2)))); y0 = int(max(0, min(h - s, round(cy / 2 - s / 2))))
    k = max(3, round(200 / s))
    return Image.fromarray(a[y0:y0 + s, x0:x0 + s].astype(np.uint8)).resize((s * k, s * k), Image.NEAREST), src


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    os.makedirs(OUT, exist_ok=True)
    made, missing = [], []
    for pid, card, cx, cy, *z in PICKS:
        if ids and pid not in ids:
            continue
        r = avatar(card, cx, cy, *z)
        if r is None:
            missing.append(pid); continue
        r[0].save(os.path.join(OUT, pid + '.png')); made.append((pid, r[1]))
    t = 200; cols = 6
    S = Image.new('RGB', (cols * (t + 6), ((len(made) + cols - 1) // cols) * (t + 18)), (24, 24, 24)); d = ImageDraw.Draw(S)
    for j, (pid, src) in enumerate(made):
        x, y = (j % cols) * (t + 6), (j // cols) * (t + 18); d.text((x + 2, y + 2), pid, fill=(255, 255, 0))
        S.paste(Image.open(os.path.join(OUT, pid + '.png')).resize((t, t), Image.NEAREST), (x + 2, y + 16))
    S.save(os.path.join(OUT, '00_uebersicht.png'))
    print(len(made), 'gebaut; nicht gefunden:', missing)


if __name__ == '__main__':
    main()
