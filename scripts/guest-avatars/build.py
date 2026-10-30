#!/usr/bin/env python3
"""Gast-Avatare: je Held ein quadratischer Ausschnitt seines Kartenbildes (Kunst aus dem Atlas public/cardgen/art.png),
ganzzahlig vergroessert (Nearest, Pixelart), nach public/avatars/gast/<Kurzname>.png.

Der Gast heisst danach „Guest <Kurzname>" (server.js, /api/auth/guest). Kurzname: siehe kurzname().
Helden ohne Kunst im Atlas werden uebersprungen; doppelte Kurznamen (z. B. Gabby) zaehlen einmal.
Aufruf: python3 scripts/guest-avatars/build.py   (Pillow noetig; das Ergebnis ist eingecheckt, der Server braucht kein Python)
"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'avatars', 'gast')
MAX_NAME = 12      # laengere Kurznamen sprengen Namensschilder

def kurzname(name):
    # „Elana, the Rocky Rebel" -> Elana; ohne Komma steht der Name am Ende („Cool Rescuer Monia" -> Monia) oder vor „the" („Tarleinn the Traveler").
    if ',' in name: return name.split(',')[0].strip()
    if ' the ' in name: return name.split(' the ')[0].strip()
    return name.split()[-1].strip()

def main():
    cards = json.load(open(os.path.join(ROOT, 'data', 'cards.json'), encoding='utf-8'))
    cards = cards if isinstance(cards, list) else list(cards.values())
    art = json.load(open(os.path.join(ROOT, 'public', 'cardgen', 'art.json'), encoding='utf-8'))
    atlas = Image.open(os.path.join(ROOT, 'public', 'cardgen', art['atlas'])).convert('RGBA')
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    gesehen, n = set(), 0
    for c in cards:
        if c.get('cardType') != 'Hero': continue
        name = c['name']
        kurz = kurzname(name)
        if not re.fullmatch(r"[A-Za-z][A-Za-z' ]*", kurz) or len(kurz) > MAX_NAME or kurz.lower() in gesehen: continue
        r = art['a'].get(name)
        if not r: continue
        x, y, w, h = r
        # Die Helden sitzen klein in ihrer Szene: enger Ausschnitt (72 % der kurzen Kante). Querformat: mittig, etwas nach oben
        # geschoben (Koepfe nicht abschneiden); Hochformat: von oben.
        kante = int(round(min(w, h) * 0.72))
        ox = x + (w - kante) // 2
        oy = y + int((h - kante) * (0.3 if w > h else 0.1))
        skala = max(1, round(208 / kante))
        crop = atlas.crop((ox, oy, ox + kante, oy + kante)).resize((kante * skala, kante * skala), Image.NEAREST)
        crop.save(os.path.join(OUT, kurz + '.png'), optimize=True)
        gesehen.add(kurz.lower()); n += 1
    print(n, 'Avatare nach', OUT)

if __name__ == '__main__':
    main()
