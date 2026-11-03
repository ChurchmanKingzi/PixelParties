# -*- coding: utf-8 -*-
"""Hüpfende Schleime (Runde 3): Hocke → Absprung (Streckung) → Flug (Figur komplett in der Luft) → Landung (Stauchung) → Nachfedern → Ruhe.

Nutzerfeedback: Shadowy/Splashy/Icy/Slimy Slime „sollen hüpfen statt breiter zu werden“ — Maßstab sind Hardy, Rocky und Infinitely Reproducing Slime.
Dieses Modul gehört den fünf Schleimen (anim_slime.py/anim_amorph.py bleiben unverändert). Alles ganze Pixel, nur Farben des Sprites.

    ablauf(n, gross, klein, …)            Folge (Posenname, Höhe in px) je Frame: großer Sprung, kleiner Sprung, Ruhe dazwischen; Frame 0 = Ruhepose
    hupf_figur(spr, pose, dy, …)          Figur dieser Pose auf der Leinwand (Zeilen entfernen/verdoppeln, Spalten höchstens ±1 je Seite, Unterkante am Boden + dy)
    flug_frames(ab)                       Frames, in denen die Figur komplett in der Luft ist (dy ≥ 2)
    landungen(ab)                         Frames des Aufpralls (Pose D3/D2 nach einem Flug)

Posennamen: R Ruhe · D1–D3 Hocke/Stauchung (1–3) · T1–T3 Streckung (1–3).
"""
import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_slime as SL


def _bahn(F, hmax):
    """Flughöhen (ganze Pixel) über F Frames: Parabel, Frame-Mitte; der Scheitel bleibt 2–3 Frames oben."""
    out = []
    for k in range(F):
        t = (k + 0.5) / F
        out.append(max(1, int(round(hmax * 4 * t * (1 - t)))))
    return out


def ablauf(n=48, gross=6, klein=3, start=3, flug_gross=10, flug_klein=6, pause=4, atmen_ende=True):
    """Posenfolge: start Frames Ruhe, großer Sprung, Pause, kleiner Sprung, Ruhe bis n. Gibt [(Pose, dy)] mit n Einträgen."""
    seq = [('R', 0)] * start
    # großer Sprung: Hocke, Absprung (stark gestreckt), steigen, Scheitel, fallen (wieder gestreckt), Aufprall, Nachfedern
    seq += [('D1', 0), ('D2', 0), ('D3', 0), ('D3', 0)]
    steigen = ['T3', 'T3', 'T2', 'T2', 'T1']
    fallen = ['R', 'T1', 'T2', 'T2', 'T1']
    if flug_gross != 10:
        raise ValueError('flug_gross: nur 10 Frames vorgesehen')
    for pose, h in zip(steigen + fallen, _bahn(flug_gross, gross)):
        seq.append((pose, h))
    seq += [('D3', 0), ('D2', 0), ('D1', 0), ('T1', 0), ('R', 0), ('D1', 0), ('R', 0)]
    seq += [('R', 0)] + [('T1', 0)] * max(0, pause - 2) + [('R', 0)]          # Pause: einmal kurz einatmen (Zeile hebt sich), nie ganz starr
    # kleiner Sprung
    seq += [('D1', 0), ('D2', 0)]
    if flug_klein != 6:
        raise ValueError('flug_klein: nur 6 Frames vorgesehen')
    for pose, h in zip(['T2', 'T2', 'T1', 'R', 'T1', 'T2'], _bahn(flug_klein, klein)):
        seq.append((pose, h))
    seq += [('D2', 0), ('D1', 0), ('T1', 0), ('R', 0)]
    if len(seq) > n:
        raise ValueError(f'Ablauf zu lang ({len(seq)} > {n})')
    seq += [('R', 0)] * (n - len(seq))
    if atmen_ende:                                                              # lange Ruhe vor dem Loopende: einmal kurz einatmen
        for k in range(n - 6, n - 3):
            if seq[k] == ('R', 0):
                seq[k] = ('T1', 0)
    return seq


def flug_frames(ab, mind=2):
    return [i for i, (_, d) in enumerate(ab) if d >= mind]


def landungen(ab):
    out = []
    for i in range(1, len(ab)):
        if ab[i][1] == 0 and ab[i - 1][1] > 0:
            out.append(i)
    return out


def hupf_figur(spr, pose, dy, posen, paare_je_zeile, sperre, h, w, pad_l, pad_t, boden, paare=((8, 9),)):
    """Figur der Pose auf der Leinwand h×w. posen: {Name: (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite)}; die Unterkante liegt auf
    `boden − dy`. Gibt (Ebene, y der obersten Zeile, [(x, y) der Quelle nach Zeilen], Quellzeilen je Ausgabezeile) zurück."""
    loeschen, doppeln, p = posen[pose]
    sh = spr.shape[0]
    koerper = A.zeilen_von(spr, 0, sh - 1, h, w, pad_l, pad_t)
    z, quelle = SL.koerper_pose(koerper, loeschen=loeschen, doppeln=doppeln, p=p, paare=paare,
                                paare_je_zeile=paare_je_zeile, x0=pad_l, sperre=sperre)
    fig, top = A.auf_leinwand(z, h, boden, dy)
    return fig, top, quelle
