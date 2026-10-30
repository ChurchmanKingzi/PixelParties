# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Creature-Idle-Animationen (Pixelart, nur ganze Pixel).

Alle Funktionen arbeiten auf RGBA-Feldern (H×W×4, uint8, Alpha nur 0/255) und übernehmen nur
Farben, die schon im Sprite stehen (Nächster-Nachbar-Abtastung, keine Mischfarben).

    teil, rest = trenne(spr, maske)             # Sprite in zwei Ebenen zerlegen
    f = zusammen(h, w, [(rest, 0, 0), (teil, dx, dy)])    # Ebenen übereinanderlegen (zuerst = unten)
    spalten_welle(teil, pivot_x, amp, phase)    # Flügelschlag: Spaltenversatz wächst mit dem Abstand zum Gelenk
    zeilen_welle(teil, pivot_y, amp, phase)     # Schwanz/Haar/Fell weht: Zeilenversatz wächst mit dem Abstand
    dehnen(teil, sy, sx, anker)                 # Squash & Stretch um einen Ankerpunkt
    tausche(spr, {alt: neu}, maske=None)        # Farben ersetzen (Blinzeln, Glühen)
    speichern(name, karte, frames, ms, ...)     # Sheet + JSON nach data/creature-animations, GIF-Vorschau
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'data', 'creature-animations'))
SRC = os.path.join(HERE, 'src')


def lade(slug):
    return np.array(Image.open(os.path.join(SRC, slug + '.png')).convert('RGBA'))


def deckend(a):
    return a[..., 3] > 0


def farbmaske(a, farben):
    """Pixel, deren RGB in `farben` (Liste von (r,g,b)) vorkommt."""
    m = np.zeros(a.shape[:2], bool)
    for c in farben:
        m |= (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2]) & (a[..., 3] > 0)
    return m


def rechteck(a, x0, y0, x1, y1):
    """Maske des Rechtecks [x0,x1) × [y0,y1)."""
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


def trenne(a, maske):
    teil = np.zeros_like(a); teil[maske] = a[maske]
    rest = a.copy(); rest[maske] = 0
    return teil, rest


def leer(h, w):
    return np.zeros((h, w, 4), np.uint8)


def einsetzen(ziel, quelle, dx=0, dy=0):
    """Deckende Pixel von `quelle` an (dx, dy) in `ziel` schreiben (außerhalb abgeschnitten)."""
    h, w = ziel.shape[:2]; qh, qw = quelle.shape[:2]
    for y in range(qh):
        ty = y + dy
        if not 0 <= ty < h:
            continue
        for x in np.nonzero(quelle[y, :, 3])[0]:
            tx = x + dx
            if 0 <= tx < w:
                ziel[ty, tx] = quelle[y, x]
    return ziel


def zusammen(h, w, ebenen):
    f = leer(h, w)
    for e in ebenen:
        a, dx, dy = e
        einsetzen(f, a, dx, dy)
    return f


def versetze(a, dx, dy):
    return einsetzen(leer(*a.shape[:2]), a, dx, dy)


def spalten_welle(a, pivot_x, amp, phase, potenz=1.0, nur_rechts=None, bias=0.0, fuell=None):
    """Jede Spalte wandert senkrecht um round((amp · sin(phase) + bias) · (Abstand/maxAbstand)^potenz).
    Positiv = nach unten. Beide Seiten des Gelenks schlagen gleichzeitig (Flügelpaar);
    nur_rechts: True/False = nur eine Seite bewegen. bias verschiebt die Ruhelage der Flügelspitze.
    fuell: Maske des Restkörpers — hebt sich eine Spalte, wird die Lücke zum Körper darunter mit dem
    untersten Flügelpixel der Spalte gefüllt (Flügel bleibt am Rumpf „angewachsen")."""
    out = leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max(abs(x - pivot_x) for x in range(w) if a[:, x, 3].any()) if a[..., 3].any() else 1)
    for x in range(w):
        if not a[:, x, 3].any():
            continue
        d = x - pivot_x
        if nur_rechts is True and d < 0 or nur_rechts is False and d > 0:
            dy = 0
        else:
            dy = int(round((amp * math.sin(phase) + bias) * (abs(d) / maxd) ** potenz))
        ys = np.nonzero(a[:, x, 3])[0]
        for y in ys:
            if 0 <= y + dy < h:
                out[y + dy, x] = a[y, x]
        if fuell is not None and dy < 0:
            yb = int(ys.max())
            if yb + 1 < h and fuell[yb + 1, x]:
                for y in range(yb + dy + 1, yb + 1):
                    if 0 <= y < h and not out[y, x, 3]:
                        out[y, x] = a[yb, x]
    return out


def zeilen_welle(a, pivot_y, amp, phase, potenz=1.0, richtung=1, signiert=False):
    """Jede Zeile wandert waagerecht um round(amp · (Abstand/maxAbstand)^potenz · sin(phase)).
    Hängt etwas unterhalb des Pivots (Schwanz, Haare), richtung=-1 für nach oben.
    signiert=True: oberhalb des Pivots wandert es entgegengesetzt zu unterhalb (Pendel um den Pivot, z. B. eine
    Keule, die an der Hand hängt)."""
    out = leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max((abs(y - pivot_y) for y in range(h) if a[y, :, 3].any()), default=1))
    for y in range(h):
        if not a[y, :, 3].any():
            continue
        f = ((y - pivot_y) / maxd) if signiert else (abs(y - pivot_y) / maxd)
        f = math.copysign(abs(f) ** potenz, f)
        dx = int(round(amp * f * math.sin(phase)))
        for x in np.nonzero(a[y, :, 3])[0]:
            if 0 <= x + dx < w:
                out[y, x + dx] = a[y, x]
    return out


def streck_zeile(a, zeile, n=1):
    """Zeile `zeile` n-mal zusätzlich einfügen (n<0: die |n| Zeilen bis einschließlich `zeile` entfernen).
    Alles darüber rückt hoch bzw. runter, alles darunter bleibt stehen (Atmen: der Oberkörper hebt sich, die
    Füße bleiben am Boden). Das Feld behält seine Größe; oben wird abgeschnitten bzw. leer aufgefüllt."""
    h = a.shape[0]
    if n >= 0:
        rows = list(range(zeile)) + [zeile] * (n + 1) + list(range(zeile + 1, h))
        return a[rows[n:]].copy()
    m = -n
    rows = list(range(zeile - m + 1)) + list(range(zeile + 1, h))
    out = np.zeros_like(a)
    out[m:] = a[rows]
    return out


def dehnen(a, sy=1.0, sx=1.0, anker=None):
    """Nächster-Nachbar-Skalierung um den Ankerpunkt (x, y); Standard: Mitte der Unterkante.
    Zeilen/Spalten werden verdoppelt oder ausgelassen, keine Mischfarben."""
    h, w = a.shape[:2]
    ax, ay = anker if anker is not None else (w / 2.0, h - 0.5)
    out = leer(h, w)
    for y in range(h):
        sy_src = (y + 0.5 - ay) / sy + ay - 0.5
        yy = int(math.floor(sy_src + 0.5))
        if not 0 <= yy < h:
            continue
        for x in range(w):
            sx_src = (x + 0.5 - ax) / sx + ax - 0.5
            xx = int(math.floor(sx_src + 0.5))
            if 0 <= xx < w:
                out[y, x] = a[yy, xx]
    return out


def tausche(a, abbild, maske=None):
    """Farben ersetzen: abbild = {(r,g,b): (r,g,b)}; optional nur innerhalb von `maske`."""
    out = a.copy()
    for alt, neu in abbild.items():
        m = farbmaske(a, [alt])
        if maske is not None:
            m &= maske
        out[m, :3] = neu
    return out


def sinus(i, n, versatz=0.0):
    """Phase, die nach n Frames genau eine Runde dreht (nahtlose Schleife)."""
    return 2 * math.pi * (i / n) + versatz


def rand_pruefen(frames, name):
    for k, f in enumerate(frames):
        a = f[..., 3] > 0
        assert not (a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()), f'{name}: Frame {k} berührt den Rand'


def speichern(slug, karte, frames, ms, vorschau=None, face_x=None, hintergrund=(40, 30, 70)):
    """Streifen-PNG + JSON (Format wie data/hero-animations / mr-jiggles) schreiben, optional GIF-Vorschau."""
    rand_pruefen(frames, slug)
    H, W = frames[0].shape[:2]
    sheet = np.concatenate(frames, axis=1).astype(np.uint8)
    alpha = np.stack([f[..., 3] > 0 for f in frames])
    top = int(min(np.nonzero(a.any(axis=1))[0].min() for a in alpha))
    bottom = int(min(H - 1 - np.nonzero(a.any(axis=1))[0].max() for a in alpha))
    left = int(min(np.nonzero(a.any(axis=0))[0].min() for a in alpha))
    right = int(min(W - 1 - np.nonzero(a.any(axis=0))[0].max() for a in alpha))
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(sheet).save(os.path.join(OUT, slug + '.png'))
    meta = {'creature': karte, 'sheet': slug + '.png', 'frameWidth': W, 'frameHeight': H, 'frames': len(frames),
            'frameMs': ms, 'loop': True, 'layout': 'horizontal', 'padTop': top, 'padLeft': left, 'padRight': right,
            'padBottom': bottom, 'faceX': W / 2 if face_x is None else face_x}
    with open(os.path.join(OUT, slug + '.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print('geschrieben:', os.path.join(OUT, slug + '.png'), sheet.shape, len(frames), 'Frames à', ms, 'ms')
    if vorschau:
        os.makedirs(vorschau, exist_ok=True)
        gif(os.path.join(vorschau, slug + '-idle.gif'), frames, ms, hintergrund)


def gif(pfad, frames, ms, hintergrund=(40, 30, 70), scale=None):
    H, W = frames[0].shape[:2]
    s = scale or max(2, min(12, 360 // max(W, H)))
    imgs = []
    for f in frames:
        im = Image.fromarray(f.astype(np.uint8)).resize((W * s, H * s), Image.NEAREST)
        b = Image.new('RGBA', im.size, hintergrund + (255,)); b.alpha_composite(im); imgs.append(b.convert('RGB'))
    imgs[0].save(pfad, save_all=True, append_images=imgs[1:], duration=ms, loop=0, disposal=2)
    return pfad


def streifen(pfad, frames, spalten=12, hintergrund=(40, 30, 70), scale=None):
    """Alle Frames als Kontaktbogen (zum Prüfen einzelner Posen)."""
    H, W = frames[0].shape[:2]
    s = scale or max(2, min(8, 160 // max(W, H)))
    n = len(frames); zeilen = (n + spalten - 1) // spalten
    sh = Image.new('RGB', (spalten * (W * s + 2), zeilen * (H * s + 2)), (12, 10, 20))
    for k, f in enumerate(frames):
        im = Image.fromarray(f.astype(np.uint8)).resize((W * s, H * s), Image.NEAREST)
        b = Image.new('RGBA', im.size, hintergrund + (255,)); b.alpha_composite(im)
        sh.paste(b.convert('RGB'), ((k % spalten) * (W * s + 2), (k // spalten) * (H * s + 2)))
    sh.save(pfad)
    return pfad
