# -*- coding: utf-8 -*-
"""Emotes in den Shop-Ordner übernehmen: data/shop/emotes/<id>.png (nativer Pixelraster) + emotes.json.

Aufruf:  python3 scripts/emotes/import.py <Ordner mit den Emote-PNGs>
Die Vorlagen sind ganzzahlig hochskalierte Pixelart (z. B. 20 x 20 Bildschirmpunkte je Pixel). Das Skript erkennt den Faktor und speichert die Bilder in
ihrer nativen Größe (verlustfrei); der Client zeichnet sie mit image-rendering: pixelated und ganzzahligem Faktor.
Bilder ohne Pixelraster (sc.png, die glatte Smug-Coin-Münze) werden auf 40 x 40 verkleinert und hart auf die Spiel-Palette gerastet.
Vorhandene Einträge in emotes.json (Namen, Reihenfolge) bleiben erhalten; neue kommen hinten dran. Idempotent.
"""
import json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'shop', 'emotes')
PAL = [f['hex'] for f in json.load(open(os.path.join(ROOT, 'data', 'palette.json'), encoding='utf-8'))['farben']]
PALRGB = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in PAL], float)

# Anzeigenamen (Englisch / Deutsch); unbekannte Dateien bekommen den Dateinamen
NAMES = {
    'smuggest': ('Smuggest', 'Smuggest'), 'sad': ('Sad', 'Traurig'), 'cool': ('Cool', 'Cool'),
    'smug': ('Smug', 'Smug'), 'smugger': ('Smugger', 'Smugger'), 'smuuuuug': ('Smuuuuug', 'Smuuuuug'), 'smugevil': ('Evil Smug', 'Fieser Smug'), 'smugkin': ('Smugkin', 'Smugkin'),
    'wink': ('Wink', 'Zwinkern'), 'wat': ('Wat?', 'Hä?'), 'think': ('Thinking', 'Nachdenklich'), 'shocked': ('Shocked', 'Schockiert'), 'shrug': ('Shrug', 'Schulterzucken'),
    'facepalm': ('Facepalm', 'Facepalm'), 'unimpressed': ('Unimpressed', 'Unbeeindruckt'), 'pissed': ('Pissed', 'Sauer'), 'yummy': ('Yummy', 'Lecker'),
    'lol': ('LOL', 'LOL'), 'hiiii': ('Hiiii!', 'Hiiii!'), 'tadah': ('Ta-dah!', 'Tadaa!'), 'big-play': ('Big Play', 'Großer Zug'),
    'moniapog': ('Monia POG', 'Monia POG'), 'moniaeyes': ('Monia Eyes', 'Monia-Augen'), 'rocketfist': ('Rocket Fist', 'Raketenfaust'), 'bomb': ('Bomb', 'Bombe'),
    'ghost': ('Ghost', 'Geist'), 'frozen': ('Frozen', 'Eingefroren'), 'mimic': ('Mimic', 'Mimic'), 'creep': ('Creep', 'Creep'), 'corgi': ('Corgi', 'Corgi'), 'birb': ('Birb', 'Birb'),
    'sc': ('Smug Coin', 'Smug Coin'),
}
DEFAULTS = ['smuggest', 'sad', 'cool']   # von Anfang an freigeschaltet, in dieser Reihenfolge ausgewählt


def slug(stem):
    return re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-')


def factor(a):
    h, w = a.shape[:2]
    best = 1
    for f in range(2, 40):
        if h % f or w % f:
            continue
        b = a.reshape(h // f, f, w // f, f, -1)
        if (b == b[:, :1, :, :1, :]).all():
            best = f
    return best


def to_native(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    f = factor(a)
    if f > 1:
        return Image.fromarray(a[::f, ::f].copy(), 'RGBA')
    # glatte Vorlage: verkleinern, Alpha hart, Farben auf die Palette
    sm = im.resize((40, 40), Image.LANCZOS)
    b = np.asarray(sm).astype(float)
    rgb = b[..., :3].reshape(-1, 3)
    d = ((rgb[:, None, :] - PALRGB[None, :, :]) ** 2).sum(-1)
    rgb = PALRGB[d.argmin(1)].reshape(40, 40, 3)
    al = np.where(b[..., 3] >= 128, 255, 0)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'emotes.json')
    man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {'defaults': DEFAULTS, 'emotes': []}
    have = {e['id']: e for e in man['emotes']}
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith('.png'):
            continue
        i = slug(os.path.splitext(f)[0])
        im = to_native(os.path.join(src, f))
        im.save(os.path.join(OUT, i + '.png'))
        en, de = NAMES.get(i, (os.path.splitext(f)[0], os.path.splitext(f)[0]))
        e = have.get(i)
        if e is None:
            e = {'id': i, 'en': en, 'de': de}; man['emotes'].append(e); have[i] = e
        e['w'], e['h'] = im.size
    man['defaults'] = DEFAULTS
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(man['emotes']), 'Emotes')


if __name__ == '__main__':
    main()
