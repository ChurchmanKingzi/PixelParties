# -*- coding: utf-8 -*-
"""Gegner-Avatare: das Portrait jedes CPU-Gegners als festes Bild (aus den Motiven, nie aus Kartenbildern).

Im Spiel zeigt die CPU den quadratischen Mittelausschnitt des Szenenbilds ihres Helden (`HeroArtCrop`
in public/app-screens.jsx, `.game-hand-avatar-crop`). Hier entsteht derselbe Ausschnitt aus der Motiv-Szene:
quadratisch über die volle Szenenhöhe, waagerecht mittig, ganzzahlig vergrößert (~200 px).

Ablauf (Details: README.md):
  1. python3 cpu_avatare.py --helden     Helden-Karten auflisten (für locate_cards.py / refine_layers.py)
  2. python3 cpu_avatare.py              Bilder -> data/shop/avatars/<id>.png, Zuordnung -> data/shop/cpu-avatars.json
Ausgabe-Übersicht: data/shop/avatar-entwuerfe/cpu/00_uebersicht.png (nicht eingecheckt)."""
import os, sys, json
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import neue_avatare as N
from cpu_gegner import gegner, slug

ROOT = N.ROOT
SHOP = os.path.join(ROOT, 'data', 'shop')
UEB = os.path.join(SHOP, 'avatar-entwuerfe', 'cpu')


# Per Augenschein geprüfte Grenzfälle: Szene stimmt, der Fehlerwert liegt knapp über N.MAX_ERR.
AKZEPTIERT = {'Nao, the Barrier Priestess', 'Timeless King Zi', 'Andras, the Human Weapon', 'Mary Crestmas', 'Bomb Berserker Bartas'}
# Treffer, die nur Hintergrund zeigen (keine Figur): kein Avatar.
AUSGESCHLOSSEN = {'Argos, the Eye of the Cosmos'}


def helden():
    out = []
    for g in gegner():
        i = N.IDX.get(N.norm(g['hero'] or ''))
        out.append(dict(g, idx=i))
    return out


def main():
    hs = helden()
    if '--helden' in sys.argv:
        print(','.join(str(h['idx']) for h in hs if h['idx'] is not None))
        print('ohne Kartenbild:', [h['hero'] for h in hs if h['idx'] is None], file=sys.stderr)
        return
    os.makedirs(UEB, exist_ok=True)
    eintraege, benutzt, fehlt = [], set(), []
    for h in hs:
        if h['hero'] in AUSGESCHLOSSEN or h['idx'] is None:
            fehlt.append((h['deck'], h['hero'])); continue
        N.MAX_ERR = 0.04 if h['hero'] in AKZEPTIERT else 0.012
        fr = N.frame(h['idx'])
        if fr is None:
            fehlt.append((h['deck'], h['hero'])); continue
        a, err, src = fr
        side = min(a.shape[:2])
        x0 = (a.shape[1] - side) // 2
        k = max(3, round(200 / side))
        im = Image.fromarray(a[:side, x0:x0 + side].astype('uint8')).resize((side * k, side * k), Image.NEAREST)
        pid = slug(h['hero'])
        while pid in benutzt:       # zwei Gegner mit demselben Helden: zweite ID bekommt „-2“
            pid += '-2'
        benutzt.add(pid)
        im.save(os.path.join(SHOP, 'avatars', pid + '.png'))
        eintraege.append({'deckId': h['deckId'], 'id': pid, 'name': h['hero'], 'hero': h['hero']})
    json.dump({'avatars': eintraege}, open(os.path.join(SHOP, 'cpu-avatars.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    t, cols = 200, 8
    S = Image.new('RGB', (cols * (t + 6), ((len(eintraege) + cols - 1) // cols) * (t + 18)), (24, 24, 24)); d = ImageDraw.Draw(S)
    for j, e in enumerate(eintraege):
        x, y = (j % cols) * (t + 6), (j // cols) * (t + 18)
        d.text((x + 2, y + 2), e['id'][:30], fill=(255, 255, 0))
        S.paste(Image.open(os.path.join(SHOP, 'avatars', e['id'] + '.png')).resize((t, t), Image.NEAREST), (x + 2, y + 16))
    S.save(os.path.join(UEB, '00_uebersicht.png'))
    print(len(eintraege), 'Gegner-Avatare; ohne Bild:', fehlt)


if __name__ == '__main__':
    main()
