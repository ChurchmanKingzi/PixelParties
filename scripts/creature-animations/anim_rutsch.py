# -*- coding: utf-8 -*-
"""Rutschen (Runde 3): ein Slippery-Wesen gleitet als GANZES ganzzahlig über das Eis (waagerecht oder senkrecht), beim Richtungswechsel wird der Sprite
auf Wunsch horizontal gespiegelt. Kein Gehen, kein Verformen: nur Verschieben (Nutzerfeedback zu Slippery Pengu/Snobbit/Spikeblock/Polar).

    pfad(n, segmente)              Position (px) und Spiegelung je Frame. segmente: ('fahrt', ziel, frames) = sanfte Fahrt (Kosinus-Ease, Start/Ende stehen),
                                   ('halt', frames), ('flip',) = ab hier gespiegelt/ungespiegelt. Die Summe der Frames muss n ergeben, Start = Ende = 0
    verschieben(frame, p, spiegeln, achse)   Frame (voller Leinwand, in Ruhe MITTIG, also links/rechts gleich viel Rand) um p px verschieben;
                                   gespiegelt: erst um −p verschieben, dann die ganze Leinwand horizontal spiegeln → die Figur steht bei +p, Blick/Partikel gespiegelt
"""
import math

import numpy as np

import anim_lib as L


def _fahrt(a, b, k):
    return [int(math.floor(a + (b - a) * (0.5 - 0.5 * math.cos(math.pi * j / k)) + 0.5)) for j in range(k)]


def pfad(n, segmente, start=0):
    pos, fl = start, False
    P, F = [], []
    for s in segmente:
        if s[0] == 'fahrt':
            _, ziel, k = s
            P += _fahrt(pos, ziel, k)
            F += [fl] * k
            pos = ziel
        elif s[0] == 'halt':
            k = s[1]
            P += [pos] * k
            F += [fl] * k
        elif s[0] == 'flip':
            fl = not fl
        else:
            raise ValueError(s)
    if len(P) != n:
        raise ValueError(f'Pfad hat {len(P)} Frames, erwartet {n}')
    if pos != start or fl:
        raise ValueError('Pfad endet nicht am Start/ungespiegelt: kein nahtloser Loop')
    return P, F


def verschieben(frame, p, spiegeln=False, achse='x'):
    """Frame ganzzahlig verschieben (ClipError, falls etwas herausragt) und ggf. horizontal spiegeln."""
    if achse == 'x':
        f = L.versetze(frame, -p if spiegeln else p, 0)
    else:
        f = L.versetze(frame, 0, p)
    if spiegeln:
        f = np.ascontiguousarray(f[:, ::-1])
    return f
