# -*- coding: utf-8 -*-
"""Battle-Theme „Arena-Rock“ → public/music/bgm_battle7.ogg

Rock-Duell in e-Moll, 140 BPM, 64 Takte (≈ 109,7 s), nahtlos loopbar.
Verzerrte Rock-Gitarre mit Power-Chord-Riffs, Rock-Orgel als Themenstimme,
treibender Bass, harter Rock-Beat mit Crash/Ride und ein Gitarrensolo im
Höhepunkt – Kraft und Show wie ein Turnierfinale.

Aufbau (Takte, 0-basiert):
  Intro          0– 7  Orgelpad, Hi-Hat, Riff schleicht sich ein (Em … C – D)
  Thema A        8–23  Rock-Beat + Palm-Mute-Riff, Hauptmotiv (Orgel) über Em–C–G–D;
                       ab Takt 16 Gegenstimme (Clean-Gitarre) + breitere Gitarren
  Steigerung B  24–31  Am – C – D – H(7) mit Leitton dis, Galopp-Riff, Streicher,
                       neue Steigerungsmelodie, Snare-Wirbel
  Höhepunkt C   32–47  Gitarrensolo (Pentatonik) über Em–C–G–D ×2, dann Hauptmotiv
                       auf der Lead-Gitarre, Schlussteil Am–C–D–H mit langen Tönen
  Reprise A'    48–55  Hauptmotiv wieder auf der Orgel, Gegenstimme, ruhigerer Beat
  Rückführung   56–63  Em – C – D – H (Dominante), dann Em-Orgelpedal, Beat dünnt aus,
                       leiser Tom-Fill in Takt 63 → zurück zum Intro (Loop)
Motiv: |h e' g' fis'~ e'| (Em), |e' d' c' d' e'| (C) – Frage/Antwort über 4 Takte.

Aufruf:  python3 scripts/music/battle7.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import random

random.seed(7)
song = Song(bpm=140, bars=64)

# ---- Stimmen (Name, Instrument, Lautstärke, Pan) ------------------------------
song.inst('gtr',    'rockgtr',   100, 44)   # Rhythmusgitarre (Power-Chords) links
song.inst('gtr2',   'rockgtr',    84, 86)   # zweite Rhythmusgitarre rechts (verdickt)
song.inst('lead',   'rockgtr',    98, 66)   # Leadgitarre (Solo, Motiv im Höhepunkt)
song.inst('org',    'rockorgan',  90, 70)   # Rock-Orgel: Themenstimme
song.inst('pad',    'organ2',     58, 58)   # Orgel-Flächen
song.inst('str',    'strings',    62, 64)   # Streicher im Steigerungs-/Höhepunktsteil
song.inst('cnt',    'cleangtr',   80, 24)   # Gegenstimme (Clean-Gitarre)
song.inst('bass',   'bass',      108, 62)   # Bass
song.inst('abass',  'acbass',     96, 66)   # Akustikbass (Intro/Outro, weicher)

bar = song.bar
add = song.add
dr = song.dr

# ---- Harmonie: Akkord pro Takt ---------------------------------------------------
# Wurzel-Tonhöhenklasse, Pad-Stimmführung (MIDI), Arpeggio-Töne der Gegenstimme
CHORDS = {
    'Em': dict(r=E,  pad=[55, 59, 64], arp=[64, 67, 71, 67]),
    'C':  dict(r=C,  pad=[55, 60, 64], arp=[60, 64, 67, 64]),
    'G':  dict(r=G,  pad=[55, 59, 62], arp=[62, 67, 71, 67]),
    'D':  dict(r=D,  pad=[54, 57, 62], arp=[62, 66, 69, 66]),
    'Am': dict(r=A,  pad=[57, 60, 64], arp=[60, 64, 69, 64]),
    'B':  dict(r=B,  pad=[54, 59, 63], arp=[63, 66, 71, 66]),   # H-Dur mit Leitton dis
}
prog = ['Em'] * 6 + ['C', 'D']                       # 0–7   Intro
prog += ['Em', 'C', 'G', 'D'] * 4                    # 8–23  Thema A
prog += ['Am', 'Am', 'C', 'C', 'D', 'D', 'B', 'B']   # 24–31 Steigerung
prog += ['Em', 'C', 'G', 'D'] * 2                    # 32–39 Solo
prog += ['Em', 'C', 'G', 'D']                        # 40–43 Motiv Lead
prog += ['Am', 'C', 'D', 'B']                        # 44–47 Schlussteil
prog += ['Em', 'C', 'G', 'D'] * 2                    # 48–55 Reprise
prog += ['Em', 'C', 'D', 'B'] + ['Em'] * 4           # 56–63 Rückführung
assert len(prog) == 64

def broot(pc): return 28 + ((pc - E) % 12)           # Bass-Wurzel: E1 … D2
def grt(pc): return n(pc, 3)                          # Gitarren-Wurzel (Oktave 3)

# ---- Bausteine -------------------------------------------------------------------
def power(name, rt, vel, beat, dur):
    for p in (rt, rt + 7, rt + 12): add(name, beat, dur, p, vel)

def gtr_riff(name, b, ch, kind, vel):
    s, rt = bar(b), grt(CHORDS[ch]['r'])
    if kind == 'pm':          # Palm-Mute-Achtel, Akzente auf 1 und 3
        for i in range(8):
            v = vel + (10 if i in (0, 4) else (4 if i % 2 == 0 else -8))
            if i in (0, 4): power(name, rt, v, s + i * 0.5, 0.45)
            else: add(name, s + i * 0.5, 0.4, rt, v); add(name, s + i * 0.5, 0.4, rt + 7, v)
    elif kind == 'gallop':    # Galopp (Achtel + zwei Sechzehntel)
        for p in (0, 0.5, 0.75, 1, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5, 3.75):
            v = vel + (8 if p in (0, 2) else 0)
            add(name, s + p, 0.22, rt, v); add(name, s + p, 0.22, rt + 7, v)
    elif kind == 'stab':      # Akzentschläge mit Ausklang
        for p, d in ((0, 1.4), (1.5, 0.45), (2, 1.2), (3.5, 0.45)):
            power(name, rt, vel + (6 if p == 0 else 0), s + p, d)
    elif kind == 'sus':       # ganzer Takt Power-Chord
        power(name, rt, vel, s, 3.9)

def bass_line(name, b, ch, kind, vel, nxt=None):
    s, r = bar(b), broot(CHORDS[ch]['r'])
    if kind == 'whole': add(name, s, 3.9, r, vel)
    elif kind == 'half': add(name, s, 1.9, r, vel); add(name, s + 2, 1.9, r, vel - 6)
    elif kind in ('eighth', 'drive'):
        for i in range(8):
            p = r
            if kind == 'drive' and i in (3, 7): p = r + 12
            if i == 7 and kind == 'drive': p = r + 7          # Quinte als Zielton zum nächsten Takt
            add(name, s + i * 0.5, 0.42, p, vel + (8 if i % 4 == 0 else (-4 if i % 2 else 0)))

def pad_chord(name, b, ch, vel, beats=3.95):
    for p in CHORDS[ch]['pad']: add(name, bar(b), beats, p, vel)

def arp(b, ch, vel):
    s, a = bar(b), CHORDS[ch]['arp']
    for i in range(8): add('cnt', s + i * 0.5, 0.42, a[[0, 1, 2, 3][i % 4]], vel + (6 if i % 2 == 0 else -4))

def phrase(name, b, notes, vel, shift=0, leg=0.93):
    """Melodie: Liste (Offset in Vierteln ab Takt b, Dauer, MIDI-Note)."""
    s = bar(b)
    for off, dur, p in notes:
        add(name, s + off, dur * leg, p + shift, vel + (6 if off % 1 == 0 else -2))

# ---- Hauptmotiv (je Akkord ein Takt; 4 Takte = Frage/Antwort) -----------------------
# Alle Töne aus der e-Moll-Tonleiter, betonte Zählzeiten sind Akkordtöne.
M = {
  'Em': [(0, 1, n(B, 4)), (1, .5, n(E, 5)), (1.5, .5, n(G, 5)), (2, 1.5, n(Gb, 5)), (3.5, .5, n(E, 5))],
  'C':  [(0, 1, n(E, 5)), (1, .5, n(D, 5)), (1.5, .5, n(C, 5)), (2, 1.5, n(D, 5)), (3.5, .5, n(E, 5))],
  'G':  [(0, 1, n(B, 4)), (1, .5, n(D, 5)), (1.5, .5, n(G, 5)), (2, 1.5, n(D, 5)), (3.5, .5, n(B, 4))],
  'D':  [(0, 1, n(A, 4)), (1, .5, n(D, 5)), (1.5, .5, n(Gb, 5)), (2, 1, n(A, 5)), (3, .5, n(Gb, 5)), (3.5, .5, n(E, 5))],
  'D2': [(0, 1, n(A, 4)), (1, .5, n(D, 5)), (1.5, .5, n(Gb, 5)), (2, 1, n(A, 5)), (3, 1, n(B, 5))],  # Steigerungs-Variante
}
def motif(name, b0, vel, shift=0, var=False):
    for i, ch in enumerate(['Em', 'C', 'G', 'D2' if var else 'D']):
        phrase(name, b0 + i, M[ch], vel, shift)

# Steigerungsmelodie (je 2 Takte pro Akkord), Töne aus Am / C / D / H
BR = {
  'Am': [(0, 1.5, n(E, 5)), (1.5, .5, n(E, 5)), (2, 1, n(A, 5)), (3, 1, n(G, 5)),
         (4, 1.5, n(E, 5)), (5.5, .5, n(D, 5)), (6, 2, n(C, 5))],
  'C':  [(0, 1.5, n(G, 5)), (1.5, .5, n(G, 5)), (2, 1, n(C, 6)), (3, 1, n(B, 5)),
         (4, 1.5, n(G, 5)), (5.5, .5, n(D, 5)), (6, 2, n(E, 5))],
  'D':  [(0, 1.5, n(A, 5)), (1.5, .5, n(A, 5)), (2, 1, n(D, 6)), (3, 1, n(A, 5)),
         (4, 1.5, n(Gb, 5)), (5.5, .5, n(A, 5)), (6, 2, n(A, 5))],
  'B':  [(0, 1, n(Gb, 5)), (1, 1, n(B, 5)), (2, 1, n(A, 5)), (3, 1, n(Gb, 5)),          # Takt 30
         (4, .5, n(Eb, 5)), (4.5, .5, n(Gb, 5)), (5, .5, n(A, 5)), (5.5, .5, n(Gb, 5)),  # Takt 31: dis als Leitton
         (6, .5, n(Eb, 5)), (6.5, 1.5, n(B, 4))],
}

# Solo (Leadgitarre, e-Moll-Pentatonik + fis/c als Durchgang), Takt 32–39
SOLO = [
  [(0, .5, n(B, 4)), (.5, .5, n(E, 5)), (1, 1, n(G, 5)), (2, .5, n(E, 5)), (2.5, .5, n(D, 5)), (3, 1, n(E, 5))],
  [(0, .5, n(G, 5)), (.5, .5, n(E, 5)), (1, 1, n(C, 5)), (2, .5, n(D, 5)), (2.5, .5, n(E, 5)), (3, 1, n(G, 5))],
  [(0, 1, n(B, 5)), (1, .5, n(A, 5)), (1.5, .5, n(G, 5)), (2, 1, n(D, 5)), (3, .5, n(G, 5)), (3.5, .5, n(B, 5))],
  [(0, 1, n(A, 5)), (1, .5, n(Gb, 5)), (1.5, .5, n(D, 5)), (2, 1, n(Gb, 5)), (3, 1, n(E, 5))],
  [(0, .5, n(E, 5)), (.5, .5, n(G, 5)), (1, .5, n(B, 5)), (1.5, .5, n(G, 5)), (2, .5, n(A, 5)), (2.5, .5, n(G, 5)), (3, 1, n(E, 5))],
  [(0, .5, n(E, 5)), (.5, .5, n(G, 5)), (1, .5, n(C, 6)), (1.5, .5, n(B, 5)), (2, 1, n(G, 5)), (3, 1, n(E, 5))],
  [(0, .5, n(D, 5)), (.5, .5, n(G, 5)), (1, .5, n(B, 5)), (1.5, .5, n(D, 6)), (2, 1.5, n(D, 6)), (3.5, .5, n(B, 5))],
  [(0, 1, n(A, 5)), (1, 1, n(Gb, 5)), (2, .5, n(A, 5)), (2.5, .5, n(B, 5)), (3, 1, n(A, 5))],
]

# ---- Schlagzeug ------------------------------------------------------------------
def drums(b, style, v=1.0, fill=None):
    s = bar(b); ev = []
    alt = b % 2
    if style == 'intro1':
        ev += [(i * .5, HAT, 58 if i % 2 else 72) for i in range(8)] + [(0, KICK, 100)]
    elif style == 'intro2':
        ev += [(i * .5, HAT, 60 if i % 2 else 76) for i in range(8)] + [(0, KICK, 104), (2, KICK, 98)]
    elif style == 'rock':
        ev += [(i * .5, HAT, 68 if i % 2 else 90) for i in range(8)]
        ev += [(0, KICK, 118), (2, KICK, 112), (2.5 if not alt else 1.5, KICK, 96), (1, SNARE, 116), (3, SNARE, 120)]
    elif style == 'drive':
        ev += [(i * .5, HAT, 70 if i % 2 else 94) for i in range(7)] + [(3.5, OHAT, 96)]
        ev += [(0, KICK, 120), (.5, KICK, 92), (2, KICK, 114), (2.5, KICK, 96), (1, SNARE, 118), (3, SNARE, 122)]
    elif style == 'ride':
        ev += [(i * .5, RIDE, 72 if i % 2 else 92) for i in range(8)]
        ev += [(0, KICK, 120), (1.5, KICK, 94), (2, KICK, 114), (3.5 if alt else 2.5, KICK, 92),
               (1, SNARE, 118), (3, SNARE, 124), (3.75, SNARE, 66)]
    elif style == 'build':      # vier Schläge Snare, Kick auf jeder Viertel
        ev += [(i * .5, HAT, 74 if i % 2 else 92) for i in range(8)] + [(i, KICK, 112) for i in range(4)]
        ev += [(i, SNARE, 110 + i * 3) for i in range(4)]
    if fill:
        ev = [e for e in ev if e[0] < 2]
        if fill == 'toms':
            ns = [SNARE, SNARE, TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L]
            ev += [(2 + i * .25, ns[i], 92 + i * 4) for i in range(8)]
            ev += [(2, KICK, 110), (3.5, KICK, 118)]
        elif fill == 'roll':
            ev += [(2 + i * .25, SNARE, 60 + i * 8) for i in range(8)] + [(2, KICK, 108), (3.5, KICK, 118)]
        elif fill == 'roll16':
            ev = [e for e in ev if e[0] < 0] + [(i * .25, SNARE, 62 + i * 4) for i in range(16)] + [(0, KICK, 112), (2, KICK, 112)]
        elif fill == 'soft':    # leiser Tom-Fill vor dem Loop-Neustart
            ns = [TOM_HH, TOM_HH, TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L]
            ev += [(2 + i * .25, ns[i], 62 + i * 3) for i in range(8)]
    for p, note, vel in ev:
        dr(s + p, note, min(127, int(vel * v)))

# ---- Arrangement ------------------------------------------------------------------
for b in range(64):
    ch = prog[b]
    nxt = prog[(b + 1) % 64]

    # -- Intro 0–7
    if b < 8:
        pad_chord('pad', b, ch, 60 + b * 2)
        if b < 4: bass_line('abass', b, ch, 'half', 78 + b * 3)
        else: bass_line('bass', b, ch, 'eighth', 92 + (b - 4) * 4)
        if b >= 2: gtr_riff('gtr', b, ch, 'pm', 66 + (b - 2) * 4)
        drums(b, 'intro1' if b < 2 else ('intro2' if b < 4 else 'rock'), 0.75 + b * 0.03,
              fill='toms' if b == 7 else None)

    # -- Thema A 8–23
    elif b < 24:
        gtr_riff('gtr', b, ch, 'pm', 92)
        bass_line('bass', b, ch, 'eighth' if b % 4 else 'drive', 100)
        drums(b, 'rock', 1.0, fill='toms' if b in (15, 23) else None)
        it = (b - 8) // 4                       # Iteration 0..3
        if b % 4 == 0: motif('org', b, 92 + it * 2, var=(it % 2 == 1))
        if b >= 16:
            gtr_riff('gtr2', b, ch, 'sus', 74)
            arp(b, ch, 66)
        if b == 8 or b == 16: dr(bar(b), CRASH, 112)
        if b % 4 == 3 and b < 16: pad_chord('pad', b, ch, 52, 3.9)

    # -- Steigerung B 24–31
    elif b < 32:
        k = b - 24
        gtr_riff('gtr', b, ch, 'gallop', 96)
        gtr_riff('gtr2', b, ch, 'sus', 70 + k * 2)
        bass_line('bass', b, ch, 'drive', 104)
        pad_chord('str', b, ch, 58 + k * 3)
        if k % 2 == 0: phrase('org', b, BR[ch] if ch != 'B' else BR['B'], 96 + k)
        if b == 24: dr(bar(b), CRASH, 116)
        if b < 30: drums(b, 'drive', 1.0, fill='toms' if b in (27,) else None)
        elif b == 30: drums(b, 'build', 1.05)
        else: drums(b, 'ride', 1.0, fill='roll16')

    # -- Höhepunkt C 32–47
    elif b < 48:
        k = b - 32
        strong = ch
        gtr_riff('gtr', b, ch, 'pm' if b < 44 else 'stab', 100)
        gtr_riff('gtr2', b, ch, 'sus' if b < 44 else 'stab', 84)
        bass_line('bass', b, ch, 'drive', 108)
        pad_chord('str', b, ch, 70)
        drums(b, 'ride' if b < 44 else 'drive', 1.05, fill='toms' if b in (39, 43, 47) else None)
        if b % 4 == 0: dr(bar(b), CRASH, 124)
        if b >= 44: dr(bar(b), CRASH, 120)
        if b < 40:
            phrase('lead', b, SOLO[k], 100)
        elif b < 44:
            if b == 40: motif('lead', 40, 104)
            if b % 2 == 0: arp(b, ch, 68)
        else:
            long_note = {44: n(E, 5), 45: n(G, 5), 46: n(A, 5), 47: n(Gb, 5)}[b]
            add('lead', bar(b), 3.8, long_note, 104)
            add('org', bar(b), 3.8, long_note - 12 if b != 47 else n(Eb, 5), 78)   # dis im letzten Takt (Leitton)
        if b in (32, 40): pad_chord('pad', b, ch, 54)

    # -- Reprise A' 48–55
    elif b < 56:
        gtr_riff('gtr', b, ch, 'pm', 88)
        bass_line('bass', b, ch, 'eighth' if b % 4 else 'drive', 98)
        drums(b, 'rock', 0.95, fill='toms' if b == 55 else None)
        if b % 4 == 0:
            motif('org', b, 92, var=(b == 52))
            if b == 52: motif('lead', b, 78, var=True, shift=0)
        arp(b, ch, 62)
        if b == 48: dr(bar(b), CRASH, 112)
        pad_chord('pad', b, ch, 56)

    # -- Rückführung 56–63
    else:
        k = b - 56
        if b < 60:
            gtr_riff('gtr', b, ch, 'pm', 90 - k * 3)
            bass_line('bass', b, ch, 'drive' if k == 3 else 'eighth', 96 - k * 3)
            drums(b, 'rock', 0.95 - k * 0.05, fill='toms' if b == 59 else None)
            pad_chord('pad', b, ch, 60 + k * 2)
            if b == 56: dr(bar(b), CRASH, 110)
            if k == 0:
                phrase('org', b, [(0, 2, n(B, 4)), (2, 2, n(E, 5))], 82)
            elif k == 1:
                phrase('org', b, [(0, 2, n(G, 5)), (2, 2, n(E, 5))], 82)
            elif k == 2:
                phrase('org', b, [(0, 2, n(A, 5)), (2, 2, n(Gb, 5))], 82)
            else:
                phrase('org', b, [(0, 1.5, n(Eb, 5)), (1.5, 2.4, n(Gb, 5))], 84)   # dis → e (Leitton in den Loop)
        else:
            j = b - 60
            pad_chord('pad', b, ch, 68 - j * 2)
            bass_line('abass', b, ch, 'half', 82 - j * 4)
            gtr_riff('gtr', b, ch, 'pm', 62 - j * 6)
            drums(b, 'intro1', 0.85 - j * 0.03, fill='soft' if b == 63 else None)

sf2, out = cli_paths('bgm_battle7.ogg'); song.render(sf2, out)
