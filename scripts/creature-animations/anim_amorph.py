# -*- coding: utf-8 -*-
"""Gemeinsamer Hilfscode der Gruppe „Amorphes und Kleinkram“ (Schleime, Schädel, Seelensplitter, Geister …) — baut auf anim_lib auf.

Bausteine für weiche Körper (Schleime) — alles Pixelart, nur ganze Pixel, nur Farben des Sprites:

    zeilen_von(spr, y0, y1, h, w, pad_l, pad_t)      Körperzeilen y0..y1 als (n, W, 4)-Feld auf der vollen Leinwandbreite
    koerper_pose(zeilen, loeschen, doppeln, p, …)    Squash & Stretch: Zeilen entfernen/verdoppeln + jede Zeile um p Spalten je Seite
                                                     breiter (p>0) oder schmaler (p<0) — es werden unauffällige Innenspalten
                                                     verdoppelt/entfernt, der Umriss wandert unverändert nach außen/innen
    dx_zeilen(gewichte, amp, phase)                  Wabbel-Versatz je Körperzeile (Quellzeilen-Index → Pixel); Umrissstufen bleiben
                                                     unverändert, weil nur Zeilen mit senkrechtem Umriss gegeneinander versetzt werden
    verschiebe_zeilen(zeilen, quelle, dx_quelle)     Zeilen waagerecht versetzen (ClipError statt stillem Abschneiden);
    verschiebe_ausgabezeilen(zeilen, dxs)            dasselbe mit fertigem Versatz je Ausgabezeile
    auf_leinwand(zeilen, h, w, boden, dy)            Zeilenfeld auf die Leinwand setzen — die Unterkante bleibt am Boden
    glanzband(a, t, rampe, maske)                    Lichtreflex wandert diagonal über den Sprite (Farben eine Stufe heller)
    ausdruck_pruefen(frames, spr, …)                 4-Verbundenheit der Figur (ein Teil je Frame) und Randpixel-Farben
    offene_koerperkanten(fig, ausnahme, y0, umriss) Randpixel ohne Umrissfarbe = offene Kanten (nach Squash/Wabbeln prüfen!)
"""
import math

import numpy as np

import anim_lib as L


# ── Körper: Zeilen entfernen/verdoppeln, Spalten verdoppeln/entfernen ─────────────────────────────────────────

def zeilen_von(spr, y0, y1, h, w, pad_l, pad_t):
    """Zeilen y0..y1 (einschließlich) des Sprites, auf Leinwandbreite w gelegt: Feld (n, w, 4). Zeile k hat Quellzeile y0+k."""
    out = np.zeros((y1 - y0 + 1, w, 4), np.uint8)
    for k, y in enumerate(range(y0, y1 + 1)):
        for x in np.nonzero(spr[y, :, 3])[0]:
            if not 0 <= x + pad_l < w:
                raise L.ClipError('Sprite breiter als die Leinwand')
            out[k, x + pad_l] = spr[y, x]
    return out


def zeile_umbauen(r, p, paare):
    """Eine Bildzeile r (w×4) um je p Spalten pro Seite breiter (p>0: p Spaltenpaare verdoppeln) oder schmaler (p<0: |p|
    Spaltenpaare entfernen) machen. paare = [(links, rechts), …] in Vorzugsreihenfolge; die Zeile bleibt mittig."""
    if p == 0:
        return r.copy()
    k = abs(p)
    if len(paare) < k:
        raise ValueError(f'zu wenige Spaltenpaare ({len(paare)}) für p={p}')
    spalten = {c for pr in paare[:k] for c in pr}
    w = r.shape[0]
    folge = []
    for x in range(w):
        if p > 0:
            folge.append(x)
            if x in spalten:
                folge.append(x)
        elif x not in spalten:
            folge.append(x)
    shift = -k if p > 0 else k
    out = np.zeros_like(r)
    for j, x in enumerate(folge):
        if r[x, 3]:
            t = j + shift
            if not 0 <= t < w:
                raise L.ClipError(f'Zeile würde bei p={p} aus der Leinwand (Spalte {t}, Breite {w})')
            out[t] = r[x]
    return out


def koerper_pose(zeilen, loeschen=(), doppeln=(), p=0, paare=((8, 9), (7, 10), (6, 11)), paare_je_zeile=None, x0=0, p_je_zeile=None):
    """Squash & Stretch eines Körpers. zeilen: (n, w, 4) wie von zeilen_von; loeschen: Menge von Zeilenindizes (0 = oberste Körperzeile); doppeln: Menge (je 1 Kopie) oder dict {Zeile: Kopien};
    p: Spalten je Seite (siehe zeile_umbauen); paare: Standard-Spaltenpaare; paare_je_zeile: {Zeilenindex: [Paare]} für Zeilen, in denen die
    Standardspalten etwas Wichtiges (Glanz, Auge) träfen. Gibt (n', w, 4) und die Liste der Quellzeilen-Indizes je Ausgabezeile zurück —
    damit Wabbeln/Schräglage dieselbe Quellzeile immer gleich versetzen. Spaltenpaare gelten in Sprite-Koordinaten, x0 = pad_l. p_je_zeile: {Zeilenindex: p} überschreibt p einzeln
    (z. B. Zeilen, die ein starres Teil verdeckt, nicht verbreitern).
    Regel gegen offene Kanten: p für ALLE Körperzeilen gleich wählen (sonst wird eine Umrissstufe größer als 1 px und die
    Füllfarbe liegt frei); Zeilen, die frei über einem schmaleren Teil (z. B. Kopfoberkante unter einer Krone) liegen, brauchen
    nach dem Umbau einen ergänzten Umriss (siehe shiny_slime.py)."""
    paare_je_zeile = paare_je_zeile or {}
    p_je_zeile = p_je_zeile or {}
    def lv(liste):
        return [(a + x0, b + x0) for a, b in liste]
    out, quelle = [], []
    for k in range(zeilen.shape[0]):
        if k in loeschen:
            continue
        r = zeile_umbauen(zeilen[k], p_je_zeile.get(k, p), lv(paare_je_zeile.get(k, paare)))
        out.append(r); quelle.append(k)
        extra = doppeln.get(k, 0) if isinstance(doppeln, dict) else (1 if k in doppeln else 0)
        for _ in range(extra):
            out.append(r.copy()); quelle.append(k)
    return np.stack(out), quelle


# ── Wabbeln: waagerechter Zeilenversatz ──────────────────────────────────────────────────────────────────────

def dx_zeilen(gewichte, amp, phase, kappa=0.0):
    """Versatz je Quellzeile: round(amp · gewicht · sin(phase − kappa · k)); gewichte[k] ∈ [0,1] (oben groß, am Boden 0).
    Benachbarte Quellzeilen sollen sich um höchstens 1 Pixel unterscheiden, und Zeilen mit schrägem Umriss (Schultern, Fuß)
    teilen sich den Versatz mit ihrer Nachbarzeile (gleiches Gewicht), sonst bliebe eine Umrisslücke."""
    return [int(round(amp * g * math.sin(phase - kappa * k))) for k, g in enumerate(gewichte)]


def verschiebe_zeilen(zeilen, quelle, dx_quelle):
    """Jede Ausgabezeile um dx_quelle[quellzeile] Pixel waagerecht versetzen (ClipError, falls etwas herausragt)."""
    out = np.zeros_like(zeilen)
    w = zeilen.shape[1]
    for j in range(zeilen.shape[0]):
        dx = dx_quelle[quelle[j]]
        xs = np.nonzero(zeilen[j, :, 3])[0]
        if len(xs) and (xs.min() + dx < 0 or xs.max() + dx >= w):
            raise L.ClipError(f'Zeile {j} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[j, x + dx] = zeilen[j, x]
    return out


def verschiebe_ausgabezeilen(zeilen, dxs):
    """Wie verschiebe_zeilen, aber mit einem fertigen Versatz je AUSGABEZEILE (nach Löschen/Verdoppeln berechnet — so bleibt der
    Versatzverlauf von Zeile zu Zeile höchstens 1 px, auch wenn Übergangszeilen entfallen sind)."""
    out = np.zeros_like(zeilen)
    w = zeilen.shape[1]
    for j in range(zeilen.shape[0]):
        xs = np.nonzero(zeilen[j, :, 3])[0]
        if len(xs) and (xs.min() + dxs[j] < 0 or xs.max() + dxs[j] >= w):
            raise L.ClipError(f'Zeile {j} würde um {dxs[j]} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[j, x + dxs[j]] = zeilen[j, x]
    return out


def auf_leinwand(zeilen, h, boden, dy=0):
    """Zeilenfeld (n, w, 4) auf eine Leinwand h×w legen; die letzte Zeile liegt auf Leinwandzeile `boden − dy` (dy>0 = angehoben).
    Die Oberkante wandert also mit der Zeilenzahl (Streckung nach oben, Stauchung nach unten). Rückgabe: (Ebene, y der obersten Zeile)."""
    n, w = zeilen.shape[:2]
    top = boden - dy - n + 1
    if top < 0 or boden - dy >= h:
        raise L.ClipError(f'Körper (n={n}, dy={dy}) liegt außerhalb der Leinwand {w}×{h}')
    ebene = L.leer(h, w)
    ebene[top:top + n] = zeilen
    return ebene, top


# ── Lichtreflex ─────────────────────────────────────────────────────────────────────────────────────────────

def glanzband(a, t, rampe, maske=None, breite=2):
    """Diagonaler Lichtreflex: Pixel mit x + y in [t, t+breite) werden um eine Stufe der `rampe` aufgehellt
    (rampe = {(r,g,b): (r,g,b) heller}); nur Farben, die schon im Sprite stehen. maske: nur dort wirken."""
    out = a.copy()
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] and t <= x + y < t + breite and (maske is None or maske[y, x]):
                c = tuple(int(v) for v in a[y, x, :3])
                if c in rampe:
                    out[y, x, :3] = rampe[c]
    return out


# ── Kontrollen ──────────────────────────────────────────────────────────────────────────────────────────────

def komponenten4(maske):
    """Anzahl 4-zusammenhängender Teile einer Bool-Maske."""
    h, w = maske.shape
    seen = np.zeros_like(maske, bool)
    n = 0
    for y in range(h):
        for x in range(w):
            if maske[y, x] and not seen[y, x]:
                n += 1
                st = [(x, y)]
                seen[y, x] = True
                while st:
                    cx, cy = st.pop()
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and maske[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((nx, ny))
    return n


def randpixel(a):
    """Maske der deckenden Pixel mit mindestens einem leeren 4-Nachbarn (Silhouettenrand)."""
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    nb = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return m & ~nb


def umrissfarben(a):
    """Farben der Silhouettenrand-Pixel eines Sprites (= was als „Umriss“ gilt)."""
    r = randpixel(a)
    return {tuple(int(v) for v in a[y, x, :3]) for y, x in zip(*np.nonzero(r))}


def ausdruck_pruefen(frames, spr, name='', erlaubt=()):
    """Prüft je Frame (ohne Partikel: `frames` = nur die Figur): ein einziges 4-verbundenes Teil, und alle Randpixel haben eine Farbe,
    die auch am Rand des Original-Sprites vorkommt (sonst: offene Kante / fehlender Umriss). Gibt Verstöße aus, wirft nicht."""
    ok = umrissfarben(spr) | {tuple(c) for c in erlaubt}
    schlecht = []
    for k, f in enumerate(frames):
        n = komponenten4(f[..., 3] > 0)
        r = randpixel(f)
        offen = [(int(x), int(y), tuple(int(v) for v in f[y, x, :3])) for y, x in zip(*np.nonzero(r))
                 if tuple(int(v) for v in f[y, x, :3]) not in ok]
        if n != 1 or offen:
            schlecht.append((k, n, offen))
    print(f'{name} Randprüfung: {len(frames) - len(schlecht)}/{len(frames)} Frames ohne Befund' +
          ('' if not schlecht else '; Befunde (Frame, Teile, offene Randpixel): ' + str(schlecht[:8])))
    return schlecht


def offene_koerperkanten(fig, ausnahme, y0, umriss):
    """Silhouettenrand-Pixel ab Zeile y0, die nicht die Umrissfarbe haben und nicht in `ausnahme` (Bool-Maske, z. B. die Krone) liegen:
    jede solche Stelle ist eine offene Kante (Füllfarbe ohne Umriss nach außen). Liste (x, y, Farbe)."""
    r = randpixel(fig)
    out = []
    for y, x in zip(*np.nonzero(r)):
        if y >= y0 and not ausnahme[y, x] and tuple(int(v) for v in fig[y, x, :3]) != tuple(umriss):
            out.append((int(x), int(y), tuple(int(v) for v in fig[y, x, :3])))
    return out
