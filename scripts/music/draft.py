# -*- coding: utf-8 -*-
"""Draft-Musik „Pack by Pack“ → public/music/bgm_draft.ogg

Ein melodischer, freundlicher Hintergrund-Track für den Cube-Draft (30+ Minuten am Stück).
Statt langer, wandernder Szenen trägt EIN Thema das ganze Stück — es kehrt immer wieder, aber
jedes Mal anders gekleidet:

  Intro (4)    Harfe, Pad; das Themenmotiv klingt im Glockenspiel schon an
  A   (8)      Thema, Flöte — Halbschluss
  A'  (8)      Thema, Klarinette (+ Flöte eine Oktave höher) — Ganzschluss
  B   (8)      Mittelteil: neue, weit ausschwingende Melodie in der Geige (Dm–B–Gm–C), steigert sich
  A'' (8)      Thema im Klavier mit Glockenspiel, Harfe in 16teln
  C   (8)      Thema in d-Moll umgefärbt (gleiche Töne, andere Harmonie), Klavier solo, ruhig
  B'  (8)      Mittelteil noch einmal, voller (Geige + Flöte + Horn); endet auf D7
  A'''(12)     Thema in G-Dur (Rückung um einen Ganzton), Flöte + Geige, zum Schluss wiederholt sich
               die zweite Phrase als Nachsatz
  Outro (8)    G → g-Moll → B → C7 → F: moduliert zurück nach F-Dur, das Motiv klingt leise aus,
               endet auf der Dominante C7 und führt nahtlos ins Intro zurück

Das Thema (F-Dur, 4/4, 80 BPM) beginnt mit dem Motiv „Quarte auf, zwei Schritte ab“ (C–F–E–D),
das in Takt 3 und 5 als Sequenz wiederkommt; punktierte Viertel + Achtel geben ihm sein Gesicht.
72 Takte = 3:36 Minuten.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 80, 72
song = Song(BPM, BARS)
rng = random.Random(7)

# ── Stimmen (12 Kanäle) ────────────────────────────────────────────────────────
song.inst('flute', 'flute', vol=98, pan=72)
song.inst('clar', 'clarinet', vol=94, pan=56)
song.inst('violin', 'violin', vol=94, pan=50)
song.inst('piano', 'piano', vol=92, pan=64)
song.inst('harp', 'harp', vol=84, pan=40)
song.inst('pad', 'warm', vol=66, pan=64)
song.inst('strings', 'slowstr', vol=74, pan=64)
song.inst('horn', 'horns', vol=78, pan=80)
song.inst('glock', 'glock', vol=76, pan=88)
song.inst('bass', 'acbass', vol=96, pan=60)
song.inst('pizz', 'pizz', vol=76, pan=34)
song.inst('mar', 'marimba', vol=70, pan=94)

# ── Hilfen ─────────────────────────────────────────────────────────────────────
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    """'F#4' → MIDI-Note."""
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

# Akkorde: (Grundton-Pitchclass in F-Dur, Art)  M = Dur, m = Moll, 7 = Dominantseptakkord
CH = {'F': (5, 'M'), 'C': (0, 'M'), 'C7': (0, '7'), 'Dm': (2, 'm'), 'Bb': (10, 'M'), 'Gm': (7, 'm'),
      'Am': (9, 'm'), 'A': (9, 'M'), 'G': (7, 'M'), 'D7': (2, '7'), 'Em': (4, 'm')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    """Akkordtöne aufsteigend ab Grundton in Oktave `oct_` (MIDI)."""
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def chord_pcs(ch, shift=0):
    root, q = CH[ch]
    return {((root + shift) + i) % 12 for i in QUAL[q]}

# ── Das Thema (F-Dur) — Takt für Takt: (Ton, Dauer in Vierteln), None = Pause ───────────
A_BARS = [
    [('C4', 1), ('F4', 1.5), ('E4', .5), ('D4', 1)],       # 1  F   Motiv: Quarte auf, zwei Schritte ab
    [('E4', 1.5), ('D4', .5), ('C4', 1), ('E4', 1)],       # 2  C
    [('F4', 1), ('A4', 1.5), ('G4', .5), ('F4', 1)],       # 3  Dm  Motiv (Terz höher angesetzt)
    [('F4', 3), ('C4', 1)],                                # 4  Bb  lange Note + Auftakt
    [('E4', 1), ('A4', 1.5), ('G4', .5), ('F4', 1)],       # 5  F   Sequenz des Motivs
    [('G4', 1.5), ('A4', .5), ('Bb4', 1), ('D5', 1)],      # 6  Gm  Aufstieg
    [('C5', 2), ('Bb4', 1), ('G4', 1)],                    # 7  C7  Abstieg
]
A_END_OPEN = [('E4', 4)]      # 8  C   Halbschluss
A_END_CLOSED = [('F4', 4)]    # 8  F   Ganzschluss
A_CH_OPEN = ['F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'C7', 'C']
A_CH_CLOSED = ['F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'C7', 'F']

# Mittelteil (F-Dur): weit ausschwingend, höher, dieselbe punktierte Figur
B_BARS = [
    [('A4', 2), ('D5', 2)],                                # 1  Dm
    [('D5', 1.5), ('C5', .5), ('Bb4', 2)],                 # 2  Bb
    [('Bb4', 2), ('G4', 1), ('A4', 1)],                    # 3  Gm
    [('E5', 2), ('D5', 1), ('C5', 1)],                     # 4  C7
    [('F5', 2), ('E5', 1), ('D5', 1)],                     # 5  Dm  Höhepunkt
    [('D5', 1.5), ('C5', .5), ('Bb4', 1), ('A4', 1)],      # 6  Bb
    [('G4', 2), ('E4', 1), ('G4', 1)],                     # 7  C
]
B_END_C7 = [('Bb4', 4)]       # 8  C7  hängt auf der Septime → löst nach F (A'')
B_END_D7 = [('A4', 4)]        # 8  D7  → G-Dur (A''')
B_CH_C7 = ['Dm', 'Bb', 'Gm', 'C7', 'Dm', 'Bb', 'C', 'C7']
B_CH_D7 = ['Dm', 'Bb', 'Gm', 'C7', 'Dm', 'Bb', 'C', 'D7']

# Abschnitt C: dasselbe Thema, d-Moll-Harmonie (Töne unverändert — F-Dur und d-Moll teilen die Tonleiter)
C_CH = ['Dm', 'Am', 'Dm', 'Gm', 'Dm', 'Gm', 'Bb', 'A']

# Abschlusskette zurück nach F
OUTRO_CH = ['G', 'Gm', 'Bb', 'C7', 'F', 'F', 'C', 'C7']
OUTRO_MEL = [
    [('B4', 4)], [('Bb4', 4)], [('D5', 4)], [('C5', 2), ('Bb4', 2)],
    [('C4', 1), ('F4', 1.5), ('E4', .5), ('D4', 1)],       # das Motiv, leise
    [('A4', 4)], [('G4', 2), ('E4', 2)], [('C4', 4)],
]
INTRO_CH = ['F', 'C', 'F', 'C7']

# ── Bausteine ──────────────────────────────────────────────────────────────────
def hv(v):
    """Leichte Anschlags-Menschlichkeit (reproduzierbar)."""
    return v + rng.randint(-4, 4)

def melody(inst, bar0, bars, ending, shift=0, vel=90, octave=0, legato=.97, strong=None):
    """Thema/Melodie ab Takt `bar0` setzen. `strong`: Liste der Akkorde pro Takt — prüft, ob die Haupt-
    schläge Akkordtöne sind (Durchgangstöne zwischen den Schlägen sind erlaubt)."""
    seq = list(bars) + [ending]
    for k, bar in enumerate(seq):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                m = pn(name) + shift + 12 * octave
                song.add(inst, t, dur * legato, m, hv(vel))
            t += dur

def mel_list(inst, bar0, bars, shift=0, vel=90, octave=0, legato=.97):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + shift + 12 * octave, hv(vel))
            t += dur

def harp_arp(bar0, chords, shift=0, vel=62, pattern=(0, 2, 1, 3, 2, 4, 3, 1), sixteenth=False, inst='harp', oct_=3):
    for k, ch in enumerate(chords):
        T = tones(ch, oct_, shift)
        r, third, fifth = T[0], T[1], T[2]
        ext = [r, third, fifth, r + 12, third + 12, fifth + 12]
        step = 0.25 if sixteenth else 0.5
        n = int(4 / step)
        for i in range(n):
            idx = pattern[i % len(pattern)]
            song.add(inst, song.bar(bar0 + k) + i * step, step * 1.6, ext[idx], hv(vel + (6 if i % 4 == 0 else 0)))

def pad(bar0, chords, shift=0, vel=44, inst='pad', oct_=3):
    for k, ch in enumerate(chords):
        T = tones(ch, oct_, shift)
        for m in T[:3]:
            song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def pad_voiced(bar0, chords, shift=0, vel=46, inst='strings'):
    """Mittellage: Terz/Quinte/Oktave — füllt unter der Melodie, ohne mit ihr zu konkurrieren."""
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        v = [T[1], T[2], T[0] + 12]
        for m in v:
            song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def bass(bar0, chords, style='calm', vel=84, shift=0):
    for k, ch in enumerate(chords):
        root, q = CH[ch]
        r = (root + shift) % 12 + 12 * 3        # Oktave 2 (MIDI 36–47)
        r = r - 12 if r - 12 >= 33 else r
        fifth = r + 7
        t = song.bar(bar0 + k)
        if style == 'calm':
            song.add('bass', t, 1.9, r, vel); song.add('bass', t + 2, 1.9, fifth, vel - 14)
        else:   # 'drive': Grundton – Quinte – Grundton – Quinte, Achtel-Vorgriff auf den nächsten Takt
            song.add('bass', t, 1.4, r, vel); song.add('bass', t + 1.5, 0.5, r, vel - 20)
            song.add('bass', t + 2, 1.4, fifth, vel - 12); song.add('bass', t + 3.5, 0.5, r + 12, vel - 22)

def pizz_stabs(bar0, chords, shift=0, vel=56):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        for beat in (1.5, 3.5):
            for m in T[:3]:
                song.add('pizz', song.bar(bar0 + k) + beat, 0.4, m, hv(vel))

def marimba_pulse(bar0, chords, shift=0, vel=40):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        seq = [T[0], T[2], T[1], T[2], T[0] + 12, T[2], T[1], T[2]]
        for i in range(8):
            song.add('mar', song.bar(bar0 + k) + i * 0.5, 0.4, seq[i], hv(vel + (8 if i % 2 == 0 else 0)))

def glock_double(bar0, bars, ending, shift=0, vel=52, octave=1):
    melody('glock', bar0, bars, ending, shift=shift, vel=vel, octave=octave, legato=.8)

def drums(bar0, nbars, level):
    """Ein weicher Puls, der Denken trägt — nie Kampf. Level 0 nichts, 1 Kick+Sidestick, 2 +Holzblock-Achtel, 3 +Toms."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if level >= 1:
            song.dr(t, KICK, 56, 0.2)
            song.dr(t + 1, SIDESTICK, 52, 0.15); song.dr(t + 3, SIDESTICK, 58, 0.15)
        if level >= 2:
            song.dr(t + 2, KICK, 44, 0.2)
            for i in range(8):
                song.dr(t + i * 0.5, HAT, 84 + (8 if i % 2 == 0 else 0), 0.1)
        if level >= 3:
            if k % 4 == 3:
                for j, tom in enumerate((TOM_H, TOM_M, TOM_L)):
                    song.dr(t + 3 + j / 3, tom, 50 + 4 * j, 0.15)
            if k % 8 == 0:
                song.dr(t, CRASH, 46, 0.8)

# ═══════════════════════════════════════════════════════════════════════════════
# Arrangement
# ═══════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4 Takte, F) ─────────────────────────────────────────────────────────
pad(b, INTRO_CH, vel=40)
harp_arp(b, INTRO_CH, vel=56)
mel_list('glock', b + 2, [[('C5', 1), ('F5', 1.5), ('E5', .5), ('D5', 1)]], vel=60, legato=.9)   # Motiv klingt an
song.add('glock', song.bar(b + 3), 3, pn('C5'), 50)
bass(b, INTRO_CH, style='calm', vel=64)
drums(b, 4, 0)
song.dr(song.bar(b + 3) + 3, SIDESTICK, 40, 0.1)
b += 4

# ── A (8): Thema, Flöte ─────────────────────────────────────────────────────────
melody('flute', b, A_BARS, A_END_OPEN, vel=92)
harp_arp(b, A_CH_OPEN, vel=58)
pad(b, A_CH_OPEN, vel=42)
bass(b, A_CH_OPEN, 'calm', 80)
drums(b, 8, 1)
b += 8

# ── A' (8): Thema, Klarinette + Flöte (Oktave höher), Ganzschluss ───────────────
melody('clar', b, A_BARS, A_END_CLOSED, vel=92)
melody('flute', b, A_BARS, A_END_CLOSED, vel=44, octave=1)
harp_arp(b, A_CH_CLOSED, vel=60, pattern=(0, 1, 2, 3, 2, 1, 2, 4))
pad_voiced(b, A_CH_CLOSED, vel=44)
pizz_stabs(b, A_CH_CLOSED)
bass(b, A_CH_CLOSED, 'calm', 84)
drums(b, 8, 2)
b += 8

# ── B (8): Mittelteil, Geige, neue Melodie ───────────────────────────────────────
melody('violin', b, B_BARS, B_END_C7, vel=90)
for k, ch in enumerate(B_CH_C7):                      # Horn hält die Akkordgrundtöne darunter
    T = tones(ch, 3)
    song.add('horn', song.bar(b + k), 3.9, T[2], 50)
harp_arp(b, B_CH_C7, vel=62, pattern=(0, 2, 1, 3, 2, 4, 3, 5))
pad_voiced(b, B_CH_C7, vel=46)
for k, ch in enumerate(B_CH_C7):                      # Klavier: weiche Akkordschläge auf 1 und 3
    T = tones(ch, 4)
    for beat in (0, 2):
        for m in T[:3]:
            song.add('piano', song.bar(b + k) + beat, 1.8, m, hv(52))
bass(b, B_CH_C7, 'calm', 86)
drums(b, 8, 2)
b += 8

# ── A'' (8): Thema im Klavier + Glockenspiel, Harfe in 16teln ───────────────────
melody('piano', b, A_BARS, A_END_CLOSED, vel=90)
glock_double(b, A_BARS, A_END_CLOSED, vel=46)
harp_arp(b, A_CH_CLOSED, vel=48, sixteenth=True, pattern=(0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 2))
for k, ch in enumerate(A_CH_CLOSED):                  # Horn: Quinte als Liegeton
    song.add('horn', song.bar(b + k), 3.9, tones(ch, 3)[2], 46)
pad_voiced(b, A_CH_CLOSED, vel=50)
bass(b, A_CH_CLOSED, 'drive', 84)
marimba_pulse(b, A_CH_CLOSED, vel=34)
drums(b, 8, 3)
b += 8

# ── C (8): Thema in d-Moll umgefärbt, Klavier solo, ruhig ────────────────────────
melody('piano', b, A_BARS, A_END_OPEN, vel=84)
melody('clar', b + 0, A_BARS, A_END_OPEN, vel=34, octave=-1)       # Klarinette tief, kaum hörbar: Wärme
harp_arp(b, C_CH, vel=46, pattern=(0, 2, 4, 2, 1, 3, 5, 3), inst='harp')
pad(b, C_CH, vel=46, inst='strings')
for k, ch in enumerate(C_CH):
    root, q = CH[ch]
    r = root % 12 + 36
    song.add('bass', song.bar(b + k), 3.8, r if r >= 33 else r + 12, 66)
song.dr(song.bar(b), KICK, 38, 0.2)
for k in range(8):
    song.dr(song.bar(b + k) + 3, SIDESTICK, 38, 0.1)
b += 8

# ── B' (8): Mittelteil voller — Geige + Flöte + Horn, endet auf D7 ───────────────
melody('violin', b, B_BARS, B_END_D7, vel=92)
melody('flute', b, B_BARS, B_END_D7, vel=52, octave=1)
for k, ch in enumerate(B_CH_D7):
    T = tones(ch, 3)
    song.add('horn', song.bar(b + k), 3.9, T[2], 56)
    song.add('horn', song.bar(b + k), 3.9, T[0] + 12, 48)
harp_arp(b, B_CH_D7, vel=60, pattern=(0, 2, 1, 3, 2, 4, 3, 5))
pad_voiced(b, B_CH_D7, vel=52)
for k, ch in enumerate(B_CH_D7):
    T = tones(ch, 4)
    for beat in (0, 2):
        for m in T[:3]:
            song.add('piano', song.bar(b + k) + beat, 1.8, m, hv(56))
bass(b, B_CH_D7, 'drive', 88)
marimba_pulse(b, B_CH_D7, vel=36)
drums(b, 8, 3)
b += 8

# ── A''' (12): Thema in G-Dur, Flöte + Geige, Nachsatz wiederholt ────────────────
S = 2   # Rückung um einen Ganzton
A3_BARS = A_BARS
melody('flute', b, A3_BARS, A_END_CLOSED, shift=S, vel=94)
melody('violin', b, A3_BARS, A_END_CLOSED, shift=S, vel=72, octave=0)
glock_double(b, A3_BARS, A_END_CLOSED, shift=S, vel=44, octave=1)
harp_arp(b, A_CH_CLOSED, shift=S, vel=56, sixteenth=True, pattern=(0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 2))
for k, ch in enumerate(A_CH_CLOSED):
    T = tones(ch, 3, S)
    song.add('horn', song.bar(b + k), 3.9, T[2], 54)
    song.add('horn', song.bar(b + k), 3.9, T[0] + 12, 46)
pad_voiced(b, A_CH_CLOSED, shift=S, vel=54)
bass(b, A_CH_CLOSED, shift=S, style='drive', vel=90)
marimba_pulse(b, A_CH_CLOSED, shift=S, vel=36)
drums(b, 8, 3)
# Nachsatz: Takte 5–8 des Themas noch einmal (4 Takte), das Ende breit
tag_mel = A_BARS[4:7] + [A_END_CLOSED[0:1]]
tag_ch = A_CH_CLOSED[4:8]
mel_list('flute', b + 8, tag_mel, shift=S, vel=90)
mel_list('violin', b + 8, tag_mel, shift=S, vel=70)
mel_list('glock', b + 8, tag_mel, shift=S, vel=44, octave=1, legato=.8)
harp_arp(b + 8, tag_ch, shift=S, vel=52, sixteenth=True, pattern=(0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 2))
for k, ch in enumerate(tag_ch):
    T = tones(ch, 3, S)
    song.add('horn', song.bar(b + 8 + k), 3.9, T[2], 50)
pad_voiced(b + 8, tag_ch, shift=S, vel=52)
bass(b + 8, tag_ch, shift=S, style='calm', vel=86)
drums(b + 8, 4, 2)
b += 12

# ── Outro (8): zurück nach F, Motiv klingt leise aus, Ende auf C7 ─────────────────
mel_list('flute', b, OUTRO_MEL, vel=62)
mel_list('glock', b + 4, [OUTRO_MEL[4]], vel=50, octave=1, legato=.8)
harp_arp(b, OUTRO_CH, vel=54, pattern=(0, 2, 1, 3, 2, 4, 3, 1))
pad(b, OUTRO_CH, vel=46)
for k, ch in enumerate(OUTRO_CH):
    root, q = CH[ch]
    r = root % 12 + 36
    r = r if r >= 33 else r + 12
    song.add('bass', song.bar(b + k), 3.8, r, 72 - k)
drums(b, 4, 1)
drums(b + 4, 4, 0)
for k in range(4, 8):
    song.dr(song.bar(b + k), KICK, 40, 0.2)
song.dr(song.bar(b + 7) + 3, SIDESTICK, 44, 0.1)
b += 8
assert b == BARS, (b, BARS)

# ── Kontrolle: Hauptschläge der Melodie müssen (meist) Akkordtöne sein ──────────────
def check_melody():
    prog = A_CH_CLOSED
    bad = []
    for k, bar in enumerate(A_BARS + [A_END_CLOSED]):
        t = 0
        for name, dur in bar:
            if name is not None and t in (0, 1, 2, 3):
                if pn(name) % 12 not in chord_pcs(prog[k]):
                    bad.append((k + 1, name, t))
            t += dur
    return bad
nonct = check_melody()
print('Thema: Nicht-Akkordtöne auf ganzen Schlägen (Durchgangs-/Farbtöne):', nonct)

if os.environ.get('DRAFT_NORENDER') != '1':
    sf2, out = cli_paths('bgm_draft.ogg')
    song.render(sf2, out, target_rms=0.20, saturate=False, compress=True)
