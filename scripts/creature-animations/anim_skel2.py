# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „Skelette“ (Runde 3) — baut auf anim_lib / anim_untote auf, ändert nichts daran.

    noten_ebene(h, w, i, n, noten, farben)   kleine Pixel-Musiknoten (Achtel, Doppel- und Viertelnoten, mindestens 3×5 px), die langsam aufsteigen und seitlich schaukeln;
                                             Ein-/Ausblenden durch Aufbau von unten nach oben (kein Alpha, keine verstreuten Einzelpixel). Nahtlos: Lebensdauer = Schleife n.
"""
import math

import anim_lib as L

# Noten als Pixelkarten ('X' = Kopf-/Hauptfarbe 'c', 'o' = dunklerer Randton 'r'); alle ≥ 3×5, 4-verbunden, keine Kreuze/Rauten
NOTEN_FORMEN = {
    'a': ['..X..',                   # Achtelnote (5×7), Fähnchen rechts
          '..XX.',
          '..X.X',
          '..X..',
          '.XX..',
          'XXX..',
          '.oo..'],
    'a2': ['..XX.',                  # Achtelnote, Variante mit Haken (5×7)
           '..X.X',
           '..X..',
           '..X..',
           '.XX..',
           'XXX..',
           'oo...'],
    'b': ['.XXXXX',                  # Doppelnote mit Balken (6×6)
          '.XXXXX',
          '.X...X',
          '.X...X',
          'XX..XX',
          'oo..oo'],
    'c': ['..X.',                    # Viertelnote (4×6)
          '..X.',
          '..X.',
          '.XX.',
          'XXX.',
          'oo..'],
}


def _pixel(form):
    pts = []
    for dy, zeile in enumerate(NOTEN_FORMEN[form]):
        for dx, ch in enumerate(zeile):
            if ch != '.':
                pts.append((dx, dy, 'c' if ch == 'X' else 'r'))
    return pts


def noten_ebene(h, w, i, n, noten, farben, rand_ein=0.04, aufbau=0.07):
    """Ebene mit aufsteigenden Noten. noten: Liste von dict(x, y, vx, vy, off, form='a', wackeln=0, ph=0) — (x, y) = linke obere Ecke der Note am Start,
    (vx, vy) = Gesamtweg über eine Lebensdauer (= n Frames), off = Phasenversatz in Frames, wackeln = seitliche Schaukelamplitude in px (ph = Phase 0…1).
    farben = {'c': Hauptfarbe, 'r': dunklerer Randton}. In den ersten/letzten `rand_ein` der Lebensdauer fehlt die Note ganz; danach baut sie sich in zwei
    Stufen von unten nach oben auf (erst Kopf mit Stielansatz, dann fast ganz, dann voll) und am Ende genauso wieder ab (Pixelart ohne Alpha, ohne
    verstreute Einzelpixel: alle Teile bleiben zusammenhängend). ClipError, wenn eine Note aus der Leinwand ragt."""
    out = L.leer(h, w)
    for nt in noten:
        t = ((i + nt.get('off', 0)) % n) / n
        if t < rand_ein or t >= 1 - rand_ein:
            continue
        cx = nt['x'] + nt.get('vx', 0) * t + nt.get('wackeln', 0) * math.sin(2 * math.pi * (t + nt.get('ph', 0.0)))
        cy = nt['y'] + nt.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        form = nt.get('form', 'a')
        hoehe = len(NOTEN_FORMEN[form])
        # sichtbare Zeilen (von unten): Aufbau 0 → 45 % → 75 % → 100 %, Abbau umgekehrt
        u = min(t - rand_ein, 1 - rand_ein - t)                      # Abstand zum nächsten Rand der Lebensdauer
        if u < aufbau / 2:
            sicht = max(2, int(math.ceil(hoehe * 0.45)))
        elif u < aufbau:
            sicht = int(math.ceil(hoehe * 0.75))
        else:
            sicht = hoehe
        for (dx, dy, k) in _pixel(form):
            if dy < hoehe - sicht:
                continue
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Note bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            out[y, x, :3] = farben[k]
            out[y, x, 3] = 255
    return out


# ── Skelettflügel ohne Flughaut (nur Knochen) ─────────────────────────────────────────────────────────────────────────────
def knochen_fluegel(h, w, pose, farben, arm_dick=1):
    """Linker Skelettflügel NUR aus Knochen (keine Flughaut, kein Hinterrand): Armknochen vom Rückenansatz S zum Handgelenk W, vier Fingerknochen
    (mit Knick) und ein 3×3-Gelenkknubbel am Handgelenk. Geometrie wie `anim_skel.flughaut_fluegel` (gleiche Pose, `anim_skel.flughaut_geometrie`), alle Linien 4-verbunden.
    pose: dict(S, W, ang=[θ1..θ4], len=[ℓ1..ℓ4], knick). farben = dict(knochen=(r,g,b), nub=(r,g,b), kralle=(r,g,b)). arm_dick: 1 oder 2 (Armknochen 2 px dick,
    zweite Reihe unterhalb). ClipError, wenn etwas über die Leinwand ragt."""
    import anim_skel as K
    import anim_flieger_b as B
    a = L.leer(h, w)

    def setze(x, y, c):
        if not (0 <= y < h and 0 <= x < w):
            raise L.ClipError(f'Flügelpixel ({x},{y}) außerhalb der Leinwand {w}×{h}')
        a[y, x, :3] = c
        a[y, x, 3] = 255

    S, Wr, fing, _H, _rand, _poly = K.flughaut_geometrie(pose)
    for (x, y) in B.linie4(S, Wr):
        setze(x, y, farben['knochen'])
        if arm_dick >= 2:
            setze(x, y + 1, farben['knochen'])
    for knie, spitze in fing:
        for (x, y) in B.linie4(Wr, knie) + B.linie4(knie, spitze):
            setze(x, y, farben['knochen'])
        setze(int(round(spitze[0])), int(round(spitze[1])), farben['kralle'])
    wx, wy = int(round(Wr[0])), int(round(Wr[1]))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            setze(wx + dx, wy + dy, farben['nub'])
    return a
