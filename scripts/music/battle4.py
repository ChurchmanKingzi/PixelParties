# -*- coding: utf-8 -*-
"""Battle-Theme "Heroischer Ansturm" → public/music/bgm_battle4.ogg

Klassischer JRPG-Kampf in F-Dur, 150 BPM: strahlende Trompeten-Fanfaren, Horn-
Gegenstimme, galoppierende Streicher-Achtel (Achtel + zwei Sechzehntel), Pauken,
Glockenspiel-Funken. Mut und Triumph statt Bedrohung.

Aufbau (72 Takte = 115,2 s, nahtloser Loop, keine Schlusskadenz):
  Intro          T  0– 7  Fanfarenruf (Trompete/Horn), Streicher galoppieren an
  A  Thema       T  8–23  Hauptmotiv "C C F–A" 2x in Trompete, dann mit Horn-Gegenstimme
  B  Steigerung  T 24–39  Moll-Wendung (Dm–Bb–Gm–C, A-Dur als Leitton-Dominante), Flöte/Geige,
                          Harfe, dann Trompeten-Sequenz und Trommelwirbel
  C  Höhepunkt   T 40–55  Thema voll (Trompete + Blech + Glocke), Sequenz, Schlusspush mit Es-Dur (♭VII)
  D  Rückführung T 56–71  Abbau (Flöte/Glocke), Liegeton-Steigerung auf der Dominante C, Wirbel
                          → springt mit Crash zurück auf das F-Dur der Fanfare

Tonleiter: F-Dur (F G A B♭ C D E); Leittöne: E→F, C#→D (Takt 31), Es als ♭VII nur im Schlusspush.
Aufruf:  python3 scripts/music/battle4.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BARS = 72
song = Song(bpm=150, bars=BARS)

# ---- Stimmen (Name, Instrument, Lautstärke, Panorama) --------------------
song.inst('bass',    'bass',    100, 64)   # tiefe Basslinie, Oktave 1–2
song.inst('trombone', 'trombone', 84, 50)  # Wurzel-Liegetöne (Höhepunkt)
song.inst('timp',    'timp',    100, 64)
song.inst('strings', 'strings',  82, 40)   # Galopp-Achtel, Mitten
song.inst('trem',    'tremolo',  70, 88)   # Tremolo-Polster / Steigerung
song.inst('trumpet', 'trumpet',  96, 72)   # Hauptmelodie, Oktave 5
song.inst('horns',   'horns',    84, 56)   # Gegenstimme / Fanfare, Oktave 4
song.inst('brass',   'brass',    78, 78)   # Blechsatz-Verdopplung im Höhepunkt
song.inst('flute',   'flute',    88, 68)   # Bridge-Melodie / Rückführung
song.inst('violin',  'violin',   78, 58)
song.inst('glock',   'glock',    80, 96)   # Akzente und Verdopplung Oktave 6
song.inst('harp',    'harp',     78, 30)

# ---- Hilfen ----------------------------------------------------------------
def nm(s):
    """Notenname → MIDI, z. B. 'Bb5', 'C#5'."""
    pc = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[s[0]]; i = 1
    if s[i] == '#': pc += 1; i += 1
    elif s[i] == 'b': pc -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + pc

FSCALE = {F, G, A, Bb, C, D, E}
CHORDS = {'F': (F, [0, 4, 7]), 'Am': (A, [0, 3, 7]), 'Bb': (Bb, [0, 4, 7]), 'C': (C, [0, 4, 7]),
          'Dm': (D, [0, 3, 7]), 'Gm': (G, [0, 3, 7]), 'Eb': (Eb, [0, 4, 7]), 'A': (A, [0, 4, 7, 10])}

def dyn(b):
    """Gesamtdynamik über die Takte (Faktor auf alle Velocities)."""
    return float(np.interp(b, [0, 4, 8, 16, 24, 32, 39, 40, 55, 56, 60, 64, 71],
                           [.86, .80, .86, .92, .86, .94, 1.0, 1.04, 1.06, .80, .72, .78, .96]))

def vc(chord, low):
    """Enger Akkordsatz: jeder Ton als tiefste Lage ab `low` (MIDI)."""
    r, iv = CHORDS[chord]
    return sorted(low + ((r + i - low) % 12) for i in iv)

def rmid(pc, lo):
    """Wurzelton im Bereich lo..lo+11."""
    return lo + ((pc - lo) % 12)

# Harmonie je Takt
H = ['F', 'F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C']                                      # Intro 0–7
H += ['F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'] * 2                                # A 8–23
H += ['Dm', 'Bb', 'Gm', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'C', 'Dm', 'F',
      'Bb', 'C', 'Bb', 'C']                                                           # B 24–39 (Teil 1)
H += ['F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'Bb', 'C', 'Dm', 'F', 'F', 'Eb', 'Bb', 'C']   # C 40–55
H += ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Dm', 'Bb', 'Gm', 'C', 'Bb', 'C', 'C', 'C']   # D 56–71
assert len(H) == BARS, len(H)

MEL = []   # für die Prüfung: (Takt, Offset, Dauer, MIDI)
def play(inst, b0, bars, vel, tr=0, durf=0.93, mel=True):
    """Spielt eine Melodie: je Takt eine Liste (Offset, Dauer, Notenname)."""
    for k, notes in enumerate(bars):
        b = b0 + k
        for off, dur, p in notes:
            v = vel * (1.06 if off % 1 == 0 else 0.94) * dyn(b)
            song.add(inst, song.bar(b) + off, dur * durf, nm(p) + tr, v)
            if mel and tr == 0: MEL.append((b, off, dur, nm(p)))

# ---- Motive -------------------------------------------------------------------
# Hauptmotiv: "C C F–A", Auftakt-Punktierung, Quinte→Grundton→Terz aufwärts, Antwort fällt/leitet zur Dominante.
P1 = [  # F | Am | Bb | C
    [(0, .75, 'C5'), (.75, .25, 'C5'), (1, 1.5, 'F5'), (2.5, 1.5, 'A5')],
    [(0, .75, 'E5'), (.75, .25, 'E5'), (1, 1, 'A5'), (2, .5, 'G5'), (2.5, 1.5, 'F5')],
    [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, .5, 'G5'), (3, 1, 'E5')],
    [(0, .75, 'E5'), (.75, .25, 'E5'), (1, 1, 'G5'), (2, .5, 'A5'), (2.5, .5, 'G5'), (3, .5, 'E5')],
]
P2 = [  # F | Dm | Bb | C
    [(0, .75, 'C5'), (.75, .25, 'C5'), (1, 1.5, 'F5'), (2.5, 1.5, 'A5')],
    [(0, .75, 'F5'), (.75, .25, 'F5'), (1, 1, 'A5'), (2, .5, 'G5'), (2.5, 1.5, 'D5')],
    [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, .5, 'G5'), (3, 1, 'E5')],
    [(0, .75, 'E5'), (.75, .25, 'E5'), (1, 1, 'G5'), (2, 1, 'C6'), (3, 1, 'G5')],
]
# Gegenstimme (Horn): Halbe-Noten-Linie in Oktave 4
CP1 = [[(0, 2, 'A4'), (2, 2, 'F4')], [(0, 2, 'E4'), (2, 2, 'A4')], [(0, 2, 'F4'), (2, 2, 'D5')], [(0, 2, 'E4'), (2, 2, 'G4')]]
CP2 = [[(0, 2, 'A4'), (2, 2, 'F4')], [(0, 2, 'F4'), (2, 2, 'A4')], [(0, 2, 'D5'), (2, 2, 'Bb4')], [(0, 2, 'G4'), (2, 2, 'E4')]]

# Intro-Fanfare (aufsteigende Dreiklangs-Rufe) F | F | Bb | C
FAN = [
    [(0, .5, 'C5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'F5'), (2, 2, 'C6')],
    [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'F5'), (1.5, .5, 'C5'), (2, 2, 'A5')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1, 'Bb5'), (2, 2, 'F5')],
    [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'C6'), (1.5, .5, 'G5'), (2, 1, 'G5'), (3, .5, 'E5')],
]
# Bridge B (Flöte): Dm | Bb | Gm | C   und   Dm | Bb | Gm | A(→D)
BM1 = [
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1.5, 'A5'), (2.5, .5, 'G5'), (3, 1, 'F5')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1.5, 'Bb5'), (2.5, .5, 'A5'), (3, 1, 'G5')],
    [(0, 1, 'G5'), (1, .5, 'F5'), (1.5, .5, 'D5'), (2, 1, 'D5'), (3, 1, 'E5')],
    [(0, 1, 'G5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 1, 'A5'), (3, 1, 'G5')],
]
BM2 = BM1[:3] + [
    [(0, 1, 'E5'), (1, 1, 'A5'), (2, .5, 'G5'), (2.5, .5, 'E5'), (3, 1, 'C#5')],
]
# Trompeten-Sequenz aufwärts: Bb | C | Dm | F
BS = [
    [(0, 1.5, 'F5'), (1.5, .5, 'F5'), (2, 1, 'D5'), (3, 1, 'F5')],
    [(0, 1.5, 'G5'), (1.5, .5, 'G5'), (2, 1, 'E5'), (3, 1, 'G5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'A5'), (2, 1, 'F5'), (3, 1, 'A5')],
    [(0, 1, 'A5'), (1, 1, 'G5'), (2, 2, 'F5')],
]
# Steigerung: Bb | C | Bb | C  (Motivrhythmus, Sequenz)
BE = [
    [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, .5, 'D5'), (3, 1, 'F5')],
    [(0, .75, 'E5'), (.75, .25, 'E5'), (1, 1.5, 'G5'), (2.5, .5, 'E5'), (3, 1, 'G5')],
    [(0, .75, 'F5'), (.75, .25, 'F5'), (1, 1.5, 'Bb5'), (2.5, .5, 'A5'), (3, 1, 'F5')],
    [(0, .5, 'G5'), (.5, .5, 'G5'), (1, .5, 'G5'), (1.5, .5, 'A5'), (2, 1, 'G5'), (3, 1, 'E5')],
]
# Schlusspush Höhepunkt: F | Eb | Bb | C
FP = [
    [(0, .75, 'C5'), (.75, .25, 'C5'), (1, 1.5, 'F5'), (2.5, 1.5, 'A5')],
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, 1.5, 'Bb5'), (2.5, .5, 'A5'), (3, 1, 'G5')],
    [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, .5, 'D5'), (3, 1, 'F5')],
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, 1.5, 'C6'), (2.5, .5, 'Bb5'), (3, 1, 'G5')],
]

# ---- Begleit-Bausteine --------------------------------------------------------
def gallop(b, vel, inst='strings', low=53, light=False):
    """Galopp: pro Schlag Achtel + zwei Sechzehntel; light = nur Achtel."""
    s = song.bar(b); notes = vc(H[b], low)
    for bt in range(4):
        pat = [(0, .4, 1.0), (.5, .35, .8)] if light else [(0, .42, 1.0), (.5, .2, .8), (.75, .2, .85)]
        for off, d, acc in pat:
            for p in notes:
                song.add(inst, s + bt + off, d, p, vel * acc * (1.1 if (bt in (0, 2) and off == 0) else 1) * dyn(b))

def pad(b, inst, vel, low=55, beats=4, extra=0):
    for p in vc(H[b], low): song.add(inst, song.bar(b), beats, p + extra, vel * dyn(b))

def bass_note(b): return rmid(CHORDS[H[b]][0], 29)          # F1…E2

def approach(cur, nxt):
    """Diatonischer Anlauf-Ton zur nächsten Wurzel (Leitton von der Seite der aktuellen)."""
    cand = [nxt + d for d in (-2, -1, 1, 2) if (nxt + d) % 12 in FSCALE and (nxt + d) % 12 != nxt % 12]
    return min(cand, key=lambda x: (abs(x - nxt), abs(x - cur)))

def bass_line(b, vel, style='eighth'):
    s = song.bar(b); r = bass_note(b); nxt = bass_note((b + 1) % BARS)
    if style == 'eighth':
        for i in range(7):
            song.add('bass', s + i * .5, .42, r if i % 4 != 3 else r + 12 if r + 12 < 48 else r, vel * (1.08 if i % 4 == 0 else 1) * dyn(b))
        song.add('bass', s + 3.5, .42, approach(r, nxt) if nxt != r else r, vel * .95 * dyn(b))
    elif style == 'gallop':
        for bt in range(4):
            for off, d in ((0, .42), (.5, .2), (.75, .2)):
                pitch = r if not (bt == 3 and off == .75) else approach(r, nxt) if nxt != r else r
                song.add('bass', s + bt + off, d, pitch, vel * (1.1 if (bt in (0, 2) and off == 0) else .92) * dyn(b))
    elif style == 'half':
        song.add('bass', s, 1.9, r, vel * dyn(b)); song.add('bass', s + 2, 1.9, r + 7 if r + 7 < 44 else r, vel * .9 * dyn(b))

def timp(b, pat, vel=100):
    s = song.bar(b); r = rmid(CHORDS[H[b]][0], 36); f = r + 7 if r + 7 < 48 else r - 5
    d = dyn(b)
    if pat == 'pulse':
        song.add('timp', s, .5, r, vel * d); song.add('timp', s + 2, .5, r, vel * .92 * d); song.add('timp', s + 3.5, .3, f, vel * .75 * d)
    elif pat == 'gallop':
        for p, x in ((0, r), (.75, r), (1, f), (2, r), (2.75, r), (3, f)): song.add('timp', s + p, .3, x, vel * d * (1 if p % 2 == 0 else .82))
    elif pat == 'sparse':
        song.add('timp', s, .8, r, vel * d)
    elif pat == 'roll':
        for i in range(16): song.add('timp', s + i * .25, .25, r, (50 + i * 4) * d)

def sparkle(b, vel=76, oct_low=84, pattern=(0, 1.5, 2.5, 3.5)):
    notes = vc(H[b], oct_low); s = song.bar(b)
    for i, p in enumerate(pattern): song.add('glock', s + p, .35, notes[(i * 2) % len(notes)] if i % 2 == 0 else notes[-1], vel * dyn(b))

def harp_arp(b, vel=72, low=48):
    notes = vc(H[b], low); notes = notes + [x + 12 for x in notes]        # 3 → 6 Töne
    seq = [0, 1, 2, 3, 4, 5, 4, 3]
    for i, k in enumerate(seq): song.add('harp', song.bar(b) + i * .5, .6, notes[k % len(notes)], vel * (1.1 if i == 0 else 1) * dyn(b))

def trom_root(b, vel=84): song.add('trombone', song.bar(b), 3.8, rmid(CHORDS[H[b]][0], 41), vel * dyn(b))

# ---- Schlagzeug -----------------------------------------------------------------
def groove(b, lvl):
    s = song.bar(b); d = dyn(b)
    def x(t, note, v): song.dr(s + t, note, v * d)
    if lvl == 0:      # Intro/Rückführung: locker
        x(0, KICK, 100); x(2, KICK, 92); x(1, SIDESTICK, 80); x(3, SIDESTICK, 84)
        for i in range(4): x(i, HAT, 66)
    elif lvl == 1:    # Thema
        for t, v in ((0, 108), (2, 100), (2.5, 88)): x(t, KICK, v)
        x(1, SNARE, 108); x(3, SNARE, 112)
        for i in range(8): x(i * .5, HAT, 84 if i % 2 == 0 else 62)
    elif lvl == 2:    # Steigerung: Viertel-Kick, offene Hi-Hat
        for i in range(4): x(i, KICK, 106 if i % 2 == 0 else 84)
        x(1, SNARE, 110); x(3, SNARE, 114); x(1, CLAP, 60); x(3, CLAP, 64)
        for i in range(8): x(i * .5, HAT, 84 if i % 2 == 0 else 64)
        x(3.5, OHAT, 74)
    elif lvl == 3:    # Höhepunkt: Galopp-Kick, Ride
        for t, v in ((0, 114), (1.5, 96), (2, 108), (2.75, 90), (3.5, 100)): x(t, KICK, v)
        x(1, SNARE, 116); x(3, SNARE, 120); x(3.75, SNARE, 84)
        for i in range(8): x(i * .5, RIDE, 92 if i % 2 == 0 else 70)
        x(0, HAT, 60)

def fill(b, big=True):
    s = song.bar(b); d = dyn(b)
    seq = [SNARE, SNARE, TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L] if big else [SNARE, SNARE, SNARE, TOM_H]
    step = .25 if big else .5
    t0 = 2 if big else 2
    for i, note in enumerate(seq): song.dr(s + t0 + i * step, note, (84 + i * 5) * d, .2)
    if not big: song.dr(s + 3.5, TOM_M, 100 * d); song.dr(s + 3.75, TOM_L, 106 * d)

def roll(b, v0, v1, start=0, end=4):
    s = song.bar(b) + start; steps = int((end - start) * 4)
    for i in range(steps): song.dr(s + i * .25, SNARE, (v0 + (v1 - v0) * i / max(1, steps - 1)) * dyn(b), .15)

def crash(b, v=112): song.dr(song.bar(b), CRASH, v * dyn(b), .8)

# ============================== ARRANGEMENT ==============================
# --- Intro 0–7 -------------------------------------------------------------
play('trumpet', 0, FAN, 100)
play('horns', 1, FAN[1:2], 78, tr=-12, mel=False)
for b in range(0, 4):
    pad(b, 'horns', 62, low=50) if b in (0, 2) else None
    pad(b, 'trem', 58, low=53)
    timp(b, 'sparse' if b < 3 else 'pulse', 96)
song.add('glock', 0, 1.5, nm('F6'), 84); song.add('glock', 2, 1.5, nm('C6'), 76)
song.dr(0, CRASH, 110, 1.0)
for b in range(4, 8):
    gallop(b, 62 + (b - 4) * 4, light=True)
    bass_line(b, 84 + (b - 4) * 3, 'eighth' if b > 4 else 'half')
    timp(b, 'pulse', 92); groove(b, 0)
    if b < 7: sparkle(b, 66, pattern=(0, 2))
    pad(b, 'horns', 60, low=50)
    if b in (4, 6): harp_arp(b, 60)
play('flute', 4, [[(0, .75, 'C5'), (.75, .25, 'C5'), (1, 3, 'F5')], [(0, 2, 'A5'), (2, 2, 'F5')]], 64)
fill(7, True)

# --- A: Thema 8–23 -------------------------------------------------------
for b in range(8, 24):
    ph = (b - 8) // 4
    second = b >= 16
    gallop(b, 78 if not second else 86)
    bass_line(b, 96, 'eighth')
    timp(b, 'pulse', 100); groove(b, 1)
    sparkle(b, 70 if not second else 78, pattern=(0, 2.5) if not second else (0, 1.5, 2.5, 3.5))
    if second: pad(b, 'trem', 52, low=55)
    trom_root(b, 60) if second else None
    if b % 8 == 7: fill(b, b == 23)
lines = [P1, P2, P1, P2]
for k, ph in enumerate(lines):
    play('trumpet', 8 + 4 * k, ph, 98 if k < 2 else 104)
    if k >= 2:
        play('horns', 8 + 4 * k, CP1 if ph is P1 else CP2, 78, mel=False)
        play('glock', 8 + 4 * k, ph, 66, tr=12, durf=.5, mel=False)
    else:
        play('horns', 8 + 4 * k, CP1 if ph is P1 else CP2, 56, mel=False)
crash(8); crash(16, 100)
crash(24, 116)

# --- B: Steigerung 24–39 -------------------------------------------------
for b in range(24, 40):
    late = b >= 32
    gallop(b, 66 + (b - 24) * 1.5, light=(b < 32), low=53)
    bass_line(b, 92, 'gallop' if late else 'eighth')
    timp(b, 'gallop' if b >= 36 else 'pulse', 98); groove(b, 2)
    if b < 32 or b >= 36: harp_arp(b, 70) if b < 36 else None
    if b >= 36: pad(b, 'trem', 58 + (b - 36) * 5, low=55)
    trom_root(b, 70) if b >= 32 else None
    if b % 8 == 7: fill(b, True)
play('flute', 24, BM1, 92)
play('violin', 24, BM1, 70, tr=-12, mel=False)
play('flute', 28, BM2, 92)
play('violin', 28, BM2, 70, tr=-12, mel=False)
for b in range(24, 32): pad(b, 'horns', 56, low=48) if b % 2 == 0 else None
play('trumpet', 32, BS, 100)
play('horns', 32, BS, 76, tr=-12, mel=False)
play('trumpet', 36, BE, 104)
play('brass', 36, BE, 80, tr=-12, mel=False)
play('glock', 36, BE, 66, tr=12, durf=.5, mel=False)
for b in range(32, 36): sparkle(b, 66, pattern=(0, 1.5, 2.5, 3.5))
roll(39, 60, 124, 2, 4)
crash(32, 108)
# Takt 39: Sechzehntel-Wirbel im Wirbel, danach Höhepunkt (crash in T 40)

# --- C: Höhepunkt 40–55 ---------------------------------------------------
for b in range(40, 56):
    gallop(b, 92, low=53)
    pad(b, 'trem', 62, low=60)
    bass_line(b, 104, 'gallop')
    trom_root(b, 84)
    timp(b, 'gallop', 106); groove(b, 3)
    sparkle(b, 74, pattern=(0, 1, 2, 3.5))
    if b in (47, 51, 55): fill(b, True)
lines = [(40, P1), (44, P2), (52, FP)]
for b0, ph in lines:
    play('trumpet', b0, ph, 108)
    play('brass', b0, ph, 88, tr=-12, mel=False)
    play('glock', b0, ph, 74, tr=12, durf=.5, mel=False)
    if ph is not FP:
        play('horns', b0, CP1 if ph is P1 else CP2, 82, mel=False)
    else:
        play('horns', b0, [[(0, 2, 'A4'), (2, 2, 'F4')], [(0, 2, 'G4'), (2, 2, 'Bb4')], [(0, 2, 'F4'), (2, 2, 'D5')], [(0, 2, 'E4'), (2, 2, 'G4')]], 82, mel=False)
play('trumpet', 48, BS, 108); play('brass', 48, BS, 86, tr=-12, mel=False); play('horns', 48, BS, 80, tr=-12, mel=False)
play('glock', 48, BS, 72, tr=12, durf=.5, mel=False)
crash(40, 120); crash(44, 100); crash(48, 108); crash(52, 110)
crash(56, 112)

# --- D: Rückführung 56–71 --------------------------------------------------
for b in range(56, 72):
    calm = b < 64
    gallop(b, 66 if calm else 60 + (b - 64) * 3, light=True, low=53)
    if b < 68: bass_line(b, 82 if calm else 88, 'eighth' if calm else 'half')
    else: bass_line(b, 90, 'eighth')
    if calm:
        timp(b, 'sparse' if b % 2 == 0 else 'pulse', 90); groove(b, 0)
        if b % 2 == 0: sparkle(b, 62, pattern=(0, 2))
        pad(b, 'horns', 58, low=50)
    else:
        harp_arp(b, 66 + (b - 64) * 2, low=48)
        pad(b, 'trem', 54 + (b - 64) * 6, low=55)
        if b < 70: timp(b, 'pulse', 96)
        groove(b, 1 if b >= 66 else 0)
        pad(b, 'horns', 60 + (b - 64) * 3, low=50)
play('flute', 56, P1, 72)
play('glock', 60, P1, 60, tr=12, durf=.5, mel=False)
play('flute', 60, P2, 74)
play('violin', 60, P2, 60, tr=-12, mel=False)
play('trumpet', 64, [[(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, 1.5, 'A5')],
                     [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'F5'), (2.5, 1.5, 'Bb5')],
                     [(0, .75, 'D5'), (.75, .25, 'D5'), (1, 1.5, 'G5'), (2.5, 1.5, 'Bb5')],
                     [(0, 1, 'G5'), (1, 1, 'E5'), (2, 2, 'G5')]], 84)
timp(70, 'roll', 96); timp(71, 'roll', 110)
fill(67, False); fill(63, True)
roll(70, 54, 100); roll(71, 96, 127)
song.dr(song.bar(71) + 3.75, CRASH, 100 * dyn(71), 0.3)

sf2, out = cli_paths('bgm_battle4.ogg'); song.render(sf2, out)

# ---- Selbstprüfung (nur bei CHECK=1): Melodietöne gegen Harmonie -----------------
if os.environ.get('CHECK'):
    bad = 0
    for b, off, dur, p in MEL:
        pcs = {(CHORDS[H[b]][0] + i) % 12 for i in CHORDS[H[b]][1]}
        strong = (off in (0, 2)) and dur >= 1
        if p % 12 not in FSCALE and p % 12 not in pcs and not (p % 12 == 1):
            print('AUSSERHALB', b, off, p); bad += 1
        elif strong and p % 12 not in pcs:
            print('Wechselton auf starkem Schlag', b, H[b], off, p)
    print('geprüft:', len(MEL), 'Noten, außerhalb:', bad)
