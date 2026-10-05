# -*- coding: utf-8 -*-
"""Aufbau eines Laufsheets aus dem Original-Sprite.

Regel: die Mitte vorn (Runter/Stand) ist das Kampagnen-Sprite 1:1 (Pixel für Pixel, nichts wird skaliert oder
nachgezeichnet). Alle übrigen Frames werden daran ausgerichtet: gleiche Höhe, gleiche Fußlinie, gleiche
Körperachse, gleiche Palette, Bänder/Streifen auf denselben Zeilen.

  * Schritt-Frames vorn/hinten: aus dem Raster abgeleitet — Körper 1 px tiefer (Kontaktpose wie in den
    Referenzsheets), ein Fuß belastet (1 px tiefer), der andere bleibt auf Standhöhe.
  * Rückansicht: das Original mit handgezeichneten Flicken (Hinterkopf statt Gesicht, Rückseite statt
    Revers/Krawatte).
  * Seitenansicht (rechts): handgezeichnet in derselben Palette; Links = Spiegelung (außer bewusst anders).
    Beim Gehen schieben sich die Beine scherenartig auseinander, der nahe Arm schwingt.

Koordinaten der Flicken/Raster sind Pixel des Original-Sprites (linke obere Ecke = 0,0).
"""
import numpy as np
import rig
from rig import Canvas, DIRS, FRAMES, CELL, flip, shift_row
import native

BASE_Y = 30                  # unterste Zeile des Stand-Frames (wie in den Referenzsheets)


def make(name, pal, x0, legs_top, split_x, back=(), side=None, cell=CELL, left=None, sway=0, notes=''):
    """Figur anlegen.

    x0        Zell-x der Sprite-Spalte 0 (Körperachse auf die Zellmitte)
    legs_top  Sprite-Zeile, ab der die Beine/Füße beginnen (für die Schritt-Frames)
    split_x   Sprite-Spalte, ab der das rechte Bein beginnt (Beine vorn/hinten)
    back      Flicken (Raster, x, y) über dem Original = Rückansicht
    side      dict(body=Raster (Rechtsansicht ohne nahen Arm, volle Sprite-Größe), arm=(Raster, x, y),
                   legs_top=Zeile, stride=Pixel, far_shade={Buchstabe: dunklerer Buchstabe})
    left      optional eigene Seitenansicht für Links (z. B. Georgie ohne Schleife), gleiche Form wie side
    """
    nat = native.load(name)
    front = native.to_rows(nat, pal)
    H, W = len(front), len(front[0])
    return dict(name=name, pal=pal, cell=cell, front=front, W=W, H=H, x0=x0, y0=BASE_Y - H + 1,
                legs_top=legs_top, split_x=split_x, back=list(back), side=side, left=left, sway=sway, notes=notes)


def front_rows(name, pal):
    """Das Original-Sprite als Buchstabenraster (Mitte vorn)."""
    return native.to_rows(native.load(name), pal)


def sub(rows, x0, x1, y0, y1):
    """Rechteck ausschneiden (x1/y1 exklusiv)."""
    return [r[x0:x1] for r in rows[y0:y1]]


def build(w, h, layers):
    """Raster der Größe w x h aus Ebenen (Raster, x, y) zusammensetzen."""
    cv = Canvas(w, h)
    for rows, x, y in layers:
        cv.stamp(rows, x, y)
    return [''.join(r) for r in cv.g]


# ── Raster-Bausteine ───────────────────────────────────────────────────────────
def patched(rows, patches):
    """Flicken (Raster, x, y) über ein Raster legen; '.' im Flicken lässt das Original stehen, '_' löscht."""
    g = [list(r) for r in rows]
    for prow, px, py in patches:
        for j, r in enumerate(prow):
            for i, c in enumerate(r):
                if c == '.':
                    continue
                y, x = py + j, px + i
                if 0 <= y < len(g) and 0 <= x < len(g[0]):
                    g[y][x] = '.' if c == '_' else c
    return [''.join(r) for r in g]


def halves(rows, split_x):
    left = [r[:split_x] + '.' * (len(r) - split_x) for r in rows]
    right = ['.' * split_x + r[split_x:] for r in rows]
    return left, right


def walk_layers(rows, legs_top, split_x, planted, sway=0):
    """Schritt-Frame vorn/hinten: Oberkörper 1 px tiefer; belastetes Bein (planted 'l'/'r') ebenfalls,
    das andere bleibt auf Standhöhe (es wirkt dadurch 1 Zeile kürzer)."""
    upper, lower = rows[:legs_top], rows[legs_top:]
    left, right = halves(lower, split_x)
    lifted, planted_leg = (right, left) if planted == 'l' else (left, right)
    # Der angehobene Fuß wird über den (1 px tieferen) Körper gelegt: er bleibt vollständig erhalten und die
    # Hose darüber wirkt kürzer; der belastete Fuß schließt unten an.
    # sway: Watschelgang – der Oberkörper neigt sich zur Seite des belasteten Beins
    dx = (-sway if planted == 'l' else sway)
    return [(planted_leg, 0, legs_top + 1), (upper, dx, 1), (lifted, 0, legs_top)]


def shade(rows, mapping):
    if not mapping:
        return rows
    return [''.join(mapping.get(c, c) for c in r) for r in rows]


def side_layers(sp, frame):
    """Seitenansicht: Stand = Körper + naher Arm. Gehen (wie in den Referenzen): der vordere Fuß steht flach
    auf der Fußlinie, der hintere ist 1 px angehoben und folgt gestaffelt; Oberkörper 1 px tiefer, naher Arm
    schwingt gegen den vorderen Fuß. Die Beine entstehen aus den Hosen-/Schuhzeilen des Standbilds, deren
    Zeilen zur Hüfte hin weniger weit auseinandergeschoben werden (Λ-Form)."""
    body, legs_top = sp['body'], sp['legs_top']
    arm, ax, ay = sp['arm']
    if frame == 'stand':
        return [(body, 0, 0), (arm, ax, ay)]
    upper, lower = body[:legs_top], body[legs_top:]
    sf = sp.get('shifts_front', [1, 2, 2, 2])
    sb = sp.get('shifts_back', [-1, -2, -2, -2])
    front = [shift_row(r, sf[min(i, len(sf) - 1)]) for i, r in enumerate(lower)]
    back = [shift_row(r, sb[min(i, len(sb) - 1)]) for i, r in enumerate(lower)]
    far_shade = sp.get('far_shade')
    if frame == 'a':      # naher Fuß vorn (flach), ferner hinten (angehoben); naher Arm zurück
        legs = [(shade(back, far_shade), 0, legs_top - 1), (front, 0, legs_top)]
        dx = -sp.get('arm_swing', 2)
    else:                 # naher Fuß hinten (angehoben), ferner vorn (flach); naher Arm vor
        legs = [(shade(front, far_shade), 0, legs_top), (back, 0, legs_top - 1)]
        dx = sp.get('arm_swing', 2)
    return [*legs, (upper, 0, 1), (arm, ax + dx, ay + 1)]


# ── Zellen ─────────────────────────────────────────────────────────────────────
def layers_for(fig, view, frame):
    """Ebenen (Raster, x, y) in Sprite-Koordinaten für eine Zelle; view 'left' wird gespiegelt gerendert."""
    if view == 'down':
        rows = fig['front']
    elif view == 'up':
        # Rückansicht = Original mit Flicken (Hinterkopf statt Gesicht …), horizontal gespiegelt: die linke Hand
        # (z. B. mit Tasse) liegt von hinten auf der anderen Bildseite, ebenso eine Schleife auf einer Kopfseite
        rows = flip(patched(fig['front'], fig['back']))
    else:
        sp = fig['left'] if (view == 'left' and fig['left']) else fig['side']
        if sp is None:
            raise ValueError(f"{fig['name']}: keine Seitenansicht definiert")
        return side_layers(sp, frame)
    if frame == 'stand':
        return [(rows, 0, 0)]
    return walk_layers(rows, fig['legs_top'], fig['split_x'], 'l' if frame == 'a' else 'r', fig.get('sway', 0))


def render(fig, view, frame):
    """Eine Zelle als Canvas aus Buchstaben."""
    cw, chh = fig['cell']
    cv = Canvas(cw, chh)
    mirror = view == 'left'
    for rows, x, y in layers_for(fig, 'left' if (mirror and fig['left']) else ('right' if mirror else view), frame):
        cv.stamp(rows, fig['x0'] + x, fig['y0'] + y)
    return cv.mirrored() if mirror else cv


def char_block(fig):
    """RGBA-Block einer Figur: 3 Spalten x 4 Zeilen Zellen."""
    cw, chh = fig['cell']
    blk = np.zeros((chh * 4, cw * 3, 4), np.uint8)
    for di, d in enumerate(DIRS):
        for fi, f in enumerate(FRAMES):
            blk[di * chh:(di + 1) * chh, fi * cw:(fi + 1) * cw] = render(fig, d, f).rgba(fig['pal'])
    return blk


def sheet_rgba(figs):
    """288x256-RGBA aus bis zu 8 Figuren (4 pro Zeile) – nur für 24x32-Zellen."""
    sh = np.zeros((256, 288, 4), np.uint8)
    for i, fig in enumerate(figs[:8]):
        assert fig['cell'] == CELL, f"{fig['name']}: Zelle {fig['cell']} passt nicht in ein RM2003-Sheet"
        r, c = divmod(i, 4)
        sh[r * 128:(r + 1) * 128, c * 72:(c + 1) * 72] = char_block(fig)
    return sh


def center_matches_original(fig):
    """Prüfung der Grundregel: Mitte vorn == Original-Sprite pixelgenau."""
    nat = native.load(fig['name'])
    cell = render(fig, 'down', 'stand').rgba(fig['pal'])
    x0, y0 = fig['x0'], fig['y0']
    sub = cell[y0:y0 + fig['H'], x0:x0 + fig['W']]
    same = np.array_equal(sub, nat) or np.array_equal(
        np.where(nat[..., 3:4] == 0, 0, nat), np.where(sub[..., 3:4] == 0, 0, sub))
    outside = cell.copy()
    outside[y0:y0 + fig['H'], x0:x0 + fig['W']] = 0
    return bool(same) and not (outside[..., 3] > 0).any()
