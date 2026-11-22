# -*- coding: utf-8 -*-
"""Runde 4, Gruppe „Flügel“: handgezeichnete Flügel-Schlüsselposen (Pixel für Pixel als Textzeilen im Skript) statt rechnerisch gedrehter/gescherter Flügel.

    pose(zeilen, farben, x0, y0, H, W, pad_l, pad_t)   # Textzeilen → RGBA-Ebene auf der Arbeitsleinwand; (x0, y0) = Sprite-Koordinate des linken oberen Zeichens
    spiegeln(ebene, achse2)                            # Ebene waagerecht spiegeln (achse2 = 2 × Spiegelachse in Leinwandspalten)
    takt(folge, i)                                     # Pose des Frames i aus einer Posenfolge (Liste, Länge = Schlagdauer)
    ohne_innenluecken(f, wing, koerper)                # Prüfhilfe: Hintergrundpixel, die von Figur umschlossen sind
"""
import math

import numpy as np


def pose(zeilen, farben, x0, y0, H, W, pad_l, pad_t):
    a = np.zeros((H, W, 4), np.uint8)
    for r, z in enumerate(zeilen):
        for c, ch in enumerate(z):
            if ch in '. ':
                continue
            y, x = pad_t + y0 + r, pad_l + x0 + c
            assert 0 <= y < H and 0 <= x < W, f'Pose ragt aus der Leinwand: ({x},{y})'
            a[y, x, :3] = farben[ch]
            a[y, x, 3] = 255
    return a


def spiegeln(ebene, achse2):
    """x → achse2 − x (achse2 = Summe zweier spiegelgleicher Leinwandspalten)."""
    out = np.zeros_like(ebene)
    h, w = ebene.shape[:2]
    ys, xs = np.nonzero(ebene[..., 3])
    nx = achse2 - xs
    assert (nx >= 0).all() and (nx < w).all(), 'Spiegelbild ragt aus der Leinwand'
    out[ys, nx] = ebene[ys, xs]
    return out


def takt(folge, i):
    return folge[i % len(folge)]


def text(a, farben, x0, y0, x1, y1):
    """Ausschnitt einer Ebene als Textzeilen (zum Abzeichnen/Prüfen)."""
    rück = {tuple(v): k for k, v in farben.items()}
    return [''.join(rück[tuple(int(v) for v in a[y, x, :3])] if a[y, x, 3] else '.' for x in range(x0, x1)) for y in range(y0, y1)]


# ── Flügel NEU ZEICHNEN (nicht drehen): Zeichner für lange, bandförmige Flügel ────────────────────────────────────────────────
def _projektion(px, py, pts):
    """Nächster Punkt auf dem Linienzug pts → (Abstand zum Linienzug, Bogenlänge s, vorzeichenbehafteter Querabstand d, Segmentindex).
    d > 0 liegt auf der Hinterkanten-Seite (rechts der Laufrichtung in Bildschirmkoordinaten)."""
    best = None
    s0 = 0.0
    for k in range(len(pts) - 1):
        ax, ay = pts[k]
        bx, by = pts[k + 1]
        ln = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / ln, (by - ay) / ln
        t = (px - ax) * ux + (py - ay) * uy
        tc = min(max(t, 0.0), ln)
        qx, qy = ax + ux * tc, ay + uy * tc
        dist = math.hypot(px - qx, py - qy)
        d = (px - ax) * (-uy) + (py - ay) * ux
        # über das Ende hinaus: s läuft weiter (Spitze) bzw. wird negativ (Wurzelkappe)
        s = s0 + (t if (k == 0 and t < 0) or (k == len(pts) - 2 and t > ln) else tc)
        if best is None or dist < best[0] - 1e-9:
            best = (dist, s, d, k)
        s0 += ln
    return best


def band_fluegel(H, W, pts, halb, farbe, extra=None):
    """Zeichnet einen bandförmigen Flügel entlang des Linienzugs pts (Leinwandkoordinaten, Wurzel zuerst) NEU:
    * Fläche = alle Pixel, deren Abstand zum Linienzug ≤ halb(s) ist (runde Kappe an der Wurzel, zulaufende Spitze),
      dazu optionale Anbauten extra(s, d) → True (z. B. die Flügelkralle);
    * Umriss = Randpixel der Fläche (immer genau 1 px), Farbe farbe('rand');
    * Füllung = farbe(s, d, schritt, segment) — Längsstreifen wie im Original (dunkles Vorderkantenband, Innenlinie, Haut, helle Hinterkante).
    Es wird nichts gedreht oder umgetastet: jede Pose ist eine eigene, saubere Zeichnung."""
    L_ges = sum(math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(len(pts) - 1))
    info = {}
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys)) - 9), min(H, int(max(ys)) + 10)):
        for x in range(max(0, int(min(xs)) - 9), min(W, int(max(xs)) + 10)):
            dist, s, d, k = _projektion(x, y, pts)
            drin = False
            if s < 0:
                drin = dist <= halb(0.0)
            elif s > L_ges:
                drin = False
            else:
                drin = abs(d) <= halb(s) and dist <= halb(s) + 0.01
            if not drin and extra is not None and 0 <= s <= L_ges and extra(s, d):
                drin = True
            if drin:
                info[(x, y)] = (s, d, k)
    out = np.zeros((H, W, 4), np.uint8)
    for (x, y), (s, d, k) in info.items():
        rand = any((x + dx, y + dy) not in info for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        ax, ay = pts[k]
        bx, by = pts[k + 1]
        ln = math.hypot(bx - ax, by - ay)
        schritt = max(abs(bx - ax), abs(by - ay)) / ln            # Querabstand zweier Nachbarpixel entlang der Nebenachse (1 bei 0°/90°, 0,707 bei 45°)
        out[y, x, :3] = farbe('rand') if rand else farbe(s, d, schritt, k)
        out[y, x, 3] = 255
    return out
