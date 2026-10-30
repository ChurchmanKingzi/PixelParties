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


class ClipError(RuntimeError):
    """Ein deckendes Pixel würde aus dem Feld geschoben (und still abgeschnitten). Leinwand vergrößern oder
    die Ebene VOR der Bewegung auf die volle Leinwand legen (platz)."""


def platz(a, h, w, dx=0, dy=0):
    """Ebene auf eine Leinwand h×w legen (Versatz dx, dy). Alle Bewegungen danach auf DIESER Leinwand ausführen."""
    return einsetzen(leer(h, w), a, dx, dy)


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
    """Deckende Pixel von `quelle` an (dx, dy) in `ziel` schreiben. Liegt ein deckendes Pixel außerhalb von `ziel`,
    gibt es ClipError (nichts wird still abgeschnitten)."""
    h, w = ziel.shape[:2]; qh, qw = quelle.shape[:2]
    for y in range(qh):
        ty = y + dy
        xs_ = np.nonzero(quelle[y, :, 3])[0]
        if not len(xs_):
            continue
        if not 0 <= ty < h or xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise ClipError(f'Zeile {y} der Ebene läge außerhalb der Leinwand (dx={dx}, dy={dy}, Leinwand {w}×{h})')
        for x in xs_:
            ziel[ty, x + dx] = quelle[y, x]
    return ziel


def zusammen(h, w, ebenen):
    f = leer(h, w)
    for e in ebenen:
        a, dx, dy = e
        einsetzen(f, a, dx, dy)
    return f


def versetze(a, dx, dy):
    return einsetzen(leer(*a.shape[:2]), a, dx, dy)


def spalten_welle(a, pivot_x, amp, phase, potenz=1.0, nur_rechts=None, bias=0.0, fuell=None, lauf=0.0):
    """Jede Spalte wandert senkrecht um round((amp · sin(phase) + bias) · (Abstand/maxAbstand)^potenz).
    Positiv = nach unten. Beide Seiten des Gelenks schlagen gleichzeitig (Flügelpaar);
    nur_rechts: True/False = nur eine Seite bewegen. bias verschiebt die Ruhelage der Flügelspitze.
    fuell: Maske des Restkörpers — hebt sich eine Spalte, wird die Lücke zum Körper darunter mit dem
    untersten Flügelpixel der Spalte gefüllt (Flügel bleibt am Rumpf „angewachsen").
    lauf: Wellenlauf — die Phase hinkt mit wachsendem Abstand hinterher (Schwimmwelle, Schlangenkörper)."""
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
            frac = abs(d) / maxd
            dy = int(round((amp * math.sin(phase - lauf * frac) + bias) * frac ** potenz))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
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
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def streck_zeile(a, zeile, n=1):
    """Zeile `zeile` n-mal zusätzlich einfügen (n<0: die |n| Zeilen bis einschließlich `zeile` entfernen).
    Alles darüber rückt hoch bzw. runter, alles darunter bleibt stehen (Atmen: der Oberkörper hebt sich, die
    Füße bleiben am Boden). Das Feld behält seine Größe; oben wird abgeschnitten bzw. leer aufgefüllt."""
    h = a.shape[0]
    if n >= 0:
        rows = list(range(zeile)) + [zeile] * (n + 1) + list(range(zeile + 1, h))
        if n and a[:n, :, 3].any():
            raise ClipError(f'streck_zeile würde {n} belegte Zeile(n) am oberen Rand abschneiden')
        return a[rows[n:]].copy()
    m = -n
    rows = list(range(zeile - m + 1)) + list(range(zeile + 1, h))
    out = np.zeros_like(a)
    out[m:] = a[rows]
    return out


def heben_unten(a, zeile, k):
    """Die k Zeilen bis einschließlich `zeile` entfernen und alles darunter um k nach OBEN rücken (Oberkante bleibt stehen):
    ein hängender Arm wird kürzer, die Hand hebt sich. Unten wird leer aufgefüllt."""
    if k <= 0:
        return a.copy()
    h = a.shape[0]
    rows = list(range(zeile - k + 1)) + list(range(zeile + 1, h))
    out = np.zeros_like(a)
    out[:len(rows)] = a[rows]
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


# ── Partikel (Pixelart: kein Alpha, nur Dithering, nur ganze Pixel, nahtlos im Loop) ──────────────────────────
PUFF_FORMEN = {
    'k': [(0, 0, 'c')],                                                       # Funke
    's': [(-1, 0, 'r'), (0, 0, 'c'), (1, 0, 'r'), (-1, 1, 'r'), (0, 1, 'r'), (1, 1, 'r')],  # kleiner flacher Klecks 3×2 (rund, nicht kreuzförmig)
    'o': [(-1, -1, 'r'), (0, -1, 'r'), (-2, 0, 'r'), (-1, 0, 'c'), (0, 0, 'c'), (1, 0, 'r'), (-1, 1, 'r'), (0, 1, 'r')],  # Oval 4×3
    'm': [(x, -1, 'r') for x in (-1, 0, 1)] + [(-2, 0, 'r'), (2, 0, 'r')] + [(x, 0, 'c') for x in (-1, 0, 1)]
         + [(x, 1, 'r') for x in (-1, 0, 1)],                                  # Wölkchen 5×3
    'l': [(x, -2, 'r') for x in (-1, 0, 1)] + [(x, -1, 'r') for x in (-2, 2)] + [(x, -1, 'c') for x in (-1, 0, 1)]
         + [(-3, 0, 'r'), (3, 0, 'r')] + [(x, 0, 'c') for x in (-2, -1, 0, 1, 2)]
         + [(x, 1, 'r') for x in (-2, 2)] + [(x, 1, 'c') for x in (-1, 0, 1)] + [(x, 2, 'r') for x in (-1, 0, 1)],  # Wolke 7×5
}


SCHRUMPF = {'l': ['m', 's', 'k'], 'm': ['s', 'k'], 'o': ['s', 'k'], 's': ['k'], 'k': []}   # Stufen beim Wachsen/Schrumpfen


def _stufe(form, t):
    """Form eines Wölkchens im Lebenslauf t∈[0,1): Funke → kleiner → volle Form (0,3…0,7) → kleiner → Funke."""
    kette = [form] + SCHRUMPF[form]
    n = len(kette) - 1
    if n == 0 or 0.3 <= t < 0.7:
        return form
    if t < 0.3:
        return kette[n - min(n - 1, int(t / 0.3 * n))]
    return kette[min(n, int((t - 0.7) / 0.3 * n) + 1)]


def puff_ebene(h, w, i, n, puffs, farben, verlauf='groesse'):
    """Ebene mit Wölkchen/Funken. puffs: Liste von dict(x, y, vx, vy, off, form='m', wackeln=0).
    (x, y) = Startpunkt auf der Leinwand, (vx, vy) = Gesamtweg über eine Lebensdauer (= n Frames, daher nahtlos),
    off = Phasenversatz in Frames. farben = {'c': (r,g,b) Kern, 'r': (r,g,b) Rand}.
    verlauf='groesse' (Standard): Lebenslauf über die Größe — Funke → kleiner Klecks → volle Wolke → wieder kleiner → Funke (rund,
    keine Rauten/Kreuze). verlauf='dither': entsteht/zerfällt schachbrettartig (nur für größere Wolken sinnvoll). Beides ohne Alpha."""
    ebene = leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        form = pf.get('form', 'm')
        if verlauf == 'groesse':
            form = _stufe(form, t)
        for (dx, dy, k) in PUFF_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if verlauf == 'groesse':
                keep = True
            elif t < 0.2:
                keep = (dx + dy) % 2 == 0
            elif t < 0.65:
                keep = True
            elif t < 0.82:
                keep = (dx + dy) % 2 != 0
            else:
                keep = dx % 2 == 0 and dy % 2 == 0
            if not keep:
                continue
            if not (0 <= y < h and 0 <= x < w):
                raise ClipError(f'Partikel bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = farben[k]
            ebene[y, x, 3] = 255
    return ebene


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


def pruefe(frames, quelle=None, erlaubt=(), min_rand=2):
    """Pflichtprüfung vor dem Zeigen. Gibt eine Zusammenfassung aus und wirft AssertionError bei:
    * Randabstand < min_rand (Sprite/Partikel zu nah am Leinwandrand → Gefahr des Abschneidens),
    * Farben, die weder in `quelle` (Sprite-RGBA) noch in `erlaubt` (Liste von RGB) vorkommen (neue Farben nur bewusst),
    * halbtransparente Pixel (Alpha nur 0/255).
    Die Pixelzahl je Frame wird gemeldet: schwankt sie ohne Absicht (Zeilen einfügen/entfernen, Partikel ausgenommen), wurde
    etwas abgeschnitten oder doppelt gezeichnet."""
    H, W = frames[0].shape[:2]
    rand = min(min(int(np.nonzero(f[..., 3].any(axis=1))[0].min()), H - 1 - int(np.nonzero(f[..., 3].any(axis=1))[0].max()),
                   int(np.nonzero(f[..., 3].any(axis=0))[0].min()), W - 1 - int(np.nonzero(f[..., 3].any(axis=0))[0].max())) for f in frames)
    n = [int((f[..., 3] > 0).sum()) for f in frames]
    halb = sum(int(((f[..., 3] > 0) & (f[..., 3] < 255)).sum()) for f in frames)
    fremd = set()
    if quelle is not None:
        ok = {tuple(int(v) for v in p[:3]) for p in quelle.reshape(-1, 4) if p[3]} | {tuple(c) for c in erlaubt}
        for f in frames:
            for p in f.reshape(-1, 4):
                if p[3] and tuple(int(v) for v in p[:3]) not in ok:
                    fremd.add(tuple(int(v) for v in p[:3]))
    print(f'prüfe: Leinwand {W}×{H}, {len(frames)} Frames, kleinster Randabstand {rand}, Pixel je Frame {min(n)}…{max(n)}, '
          f'fremde Farben {sorted(fremd) if fremd else "keine"}, halbtransparent {halb}')
    assert rand >= min_rand, f'Randabstand {rand} < {min_rand}: Leinwand vergrößern'
    assert not fremd, f'Farben nicht aus der Quelle: {sorted(fremd)}'
    assert halb == 0, 'Alpha darf nur 0 oder 255 sein (Pixelart, keine Überblendung)'
    return n


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
