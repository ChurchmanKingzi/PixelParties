# -*- coding: utf-8 -*-
"""Theme-Track „Big Top Bedlam“ (Fun-Fun Circus) → public/music/bgm_theme_funfuncircus.ogg

Zirkus außer Kontrolle: halsbrecherischer Galopp in B-Dur, 176 BPM, 88 Takte (120,0 s),
nahtlos loopbar. Calliope-Orgel und Flöte (Piccolo-Lage) tragen das Galopp-Thema, die Tuba
macht Oompah (Grundton/Quinte auf jedem Schlag), Posaune und Akkordeon hacken auf den
Zwischenschlägen. Xylophon-Läufe, Zirkusdirektor-Fanfare (Trompete) und Clown-Slapstick-
Stopps (Schlusshieb, Pfeif-Rutsche, Kuhglocke, Stille) sorgen für das Chaos. Das Trio
wechselt nach Es-Dur (Klarinette singt, Akkordeon/Tuba schunkeln), der Finale-Abschnitt
zitiert das Can-Can-Prinzip: Tonwiederholungen + Sprung durch B-G7-c-F7-B-D7-g-C7.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Direktor-Fanfare (Trompete + Blech-Hits, Snare-Wirbel), ab Takt 4 Galopp
   8–23  Thema A        Calliope: Galopp-Thema (B-B-F-F7 / B-Es-F-F7), Klarinette-Gegenstimme
  24–39  Trio B         Es-Dur, Klarinette + Flöte singen, Tuba/Akkordeon schunkeln, Xylophon-Fills
  40–55  Clown-Break C  Chromatisches Gehusche im Xylophon, Stopps in Takt 44 und 48 (Hieb, Rutsche)
  56–71  Thema A'       volles Blech + Calliope + Flöte + Xylophon, Wiederkehr in voller Wucht
  72–79  Finale D       Can-Can-Tonwiederholungen, alles spielt, Kuhglocken-Hagel
  80–87  Rückführung E  Dominant (C7/F7), Arpeggien aufwärts, Wirbel → Sprung zurück zu Takt 0

Harmonie: B-Dur mit Zwischendominanten (G7, D7, C7, F7); Trio in Es-Dur (mit As, B7). Loop
endet bewusst auf der Dominante F7 (kein Schluss).
Aufruf:  python3 scripts/music/theme_funfuncircus.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 176, 88                       # 88 × 4 × 60/176 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('tuba',    'tuba',      100, 60)
song.inst('trom',    'trombone',   80, 40)   # Oompah-Zwischenschläge
song.inst('accord',  'accordion',  74, 84)
song.inst('calli',   'calliope',   88, 64)   # Hauptmelodie
song.inst('flute',   'flute',      84, 76)   # Piccolo-Lage
song.inst('xylo',    'xylo',       92, 50)
song.inst('clar',    'clarinet',   84, 34)
song.inst('trumpet', 'trumpet',    90, 70)   # Zirkusdirektor
song.inst('brass',   'brass',      84, 54)
song.inst('whistle', 'whistle',    84, 64)   # Rutsche
song.inst('hit',     'hit',        96, 64)

# ---- Töne -------------------------------------------------------------------------------
NAMES = {'C': C, 'D': D, 'E': E, 'F': F, 'G': G, 'A': A, 'B': B}
SCALE = {Bb, C, D, Eb, F, G, A, Ab, Gb, E, B}       # B-Dur + Es-Dur (As) + Zwischendominanten (Fis, E, H)
def nt(s):
    pc = NAMES[s[0]]; i = 1
    if s[i] == '#': pc += 1; i += 1
    elif s[i] == 'b': pc -= 1; i += 1
    p = n(pc % 12, int(s[i:]))
    assert p % 12 in SCALE, f'Ton außerhalb der Tonart: {s}'
    return p

CH = {'Bb': (Bb, (0, 4, 7)), 'Eb': (Eb, (0, 4, 7)), 'F': (F, (0, 4, 7)), 'F7': (F, (0, 4, 7, 10)),
      'Gm': (G, (0, 3, 7)), 'Cm': (C, (0, 3, 7)), 'Ab': (Ab, (0, 4, 7)), 'Bb7': (Bb, (0, 4, 7, 10)),
      'G7': (G, (0, 4, 7, 10)), 'D7': (D, (0, 4, 7, 10)), 'C7': (C, (0, 4, 7, 10))}
def chord(ch, o): r = n(CH[ch][0], o); return [r + x for x in CH[ch][1][:3]]
def root(ch, o=2):
    p = n(CH[ch][0], o); return p if p >= 34 else p + 12      # Tuba-Lage ca. 34–46
def fifth(ch, o=2): return root(ch, o) + 7 if root(ch, o) + 7 <= 47 else root(ch, o) - 5
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def seq(b, s, insts, vels, shift=0, unit=0.5, gate=0.88):
    """Melodietakt aus Text: 'F5 D5:2 -:2' (Zahl = Länge in Achteln, '-' = Pause)."""
    t = song.bar(b)
    for tok in s.split():
        name, _, ln = tok.partition(':'); ln = int(ln) if ln else 1
        if name != '-':
            for inst, v in zip(insts, vels): song.add(inst, t, ln * unit * gate, nt(name) + shift, v)
        t += ln * unit

# ---- Begleitung -------------------------------------------------------------------------
def oompah(b, ch, vel=98, chops=True, cv=70):
    s = song.bar(b)
    for i in range(4):
        song.add('tuba', s + i, 0.62, root(ch) if i % 2 == 0 else fifth(ch), vel + (8 if i == 0 else 0))
    if chops:
        for i in range(4):
            for p in chord(ch, 4):
                song.add('trom', s + i + 0.5, 0.36, p - 12 + 12, cv)
                song.add('accord', s + i + 0.5, 0.36, p, cv - 2)
def counter(b, ch, vel=70):
    """Klarinette: Dreiklang-Brechung auf den Schlägen (Gegenstimme)."""
    r = n(CH[ch][0], 4); r = r if r < 66 else r - 12
    for i, x in enumerate(CH[ch][1][:3] + (CH[ch][1][1],)): song.add('clar', song.bar(b) + i, 0.5, r + x + 12, vel)
def hit(b, beat, ch, vel=110, dur=0.9):
    r = n(CH[ch][0], 3)
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)
def xrun(b, beat, start, steps=8, vel=94, inst='xylo', up=True):
    """Diatonischer Lauf in 16teln (B-Dur-Leiter ab Ton `start`)."""
    major = [0, 2, 4, 5, 7, 9, 11]; base = start
    for i in range(steps):
        deg = i if up else -i
        p = base + 12 * (deg // 7) + major[deg % 7]
        song.add(inst, song.bar(b) + beat + i * 0.25, 0.22, p, vel)

# ---- Schlagzeug -------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    d(0, KICK, 112); d(2, KICK, 106); d(1, SNARE, 106); d(3, SNARE, 110)
    d(0.5, SIDESTICK, 84); d(2.5, SIDESTICK, 84)
    for i in range(4): d(i + 0.5, COWBELL, 58)
    if kind in ('B', 'C'):
        d(1.5, SIDESTICK, 80); d(3.5, SNARE, 96); d(1, CLAP, 84); d(3, CLAP, 90)
        for i in range(8): d(i * 0.5, HAT, 96 if i % 2 else 78)
    if kind == 'C':
        d(1, KICK, 96); d(3, KICK, 100); d(2.75, TOM_M, 92); d(3.75, TOM_L, 96)
def fill(b, big=False):
    s = song.bar(b); TT = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, TT[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1 + i * 0.125, SNARE, ramp(i, 8, 70, 108), 0.1)
    song.dr(s + 3.75, KICK, 118)
def roll(b, start, end, v0, v1, note=SNARE):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, note, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ---------------------------------------------------------------------------
CH_A = ['Bb', 'Bb', 'F', 'F7', 'Bb', 'Eb', 'F', 'F7']
A1 = ["F5 D5 Bb4 D5 F5:2 D5:2", "Bb5:2 Bb5 A5 Bb5 D6:2", "C6 A5 F5 A5 C6 A5 F5 A5", "Eb6 D6 C6 Bb5 A5 G5 A5 C5"]
A2 = ["D6 Bb5 F5 Bb5 D6 Bb5 F5 Bb5", "Eb6 G5 Bb5 G5 Eb6:2 G5:2", "F6 E6 F6 A5 C6 A5 F5 A5", "F5 G5 A5 Bb5 C6 D6 E6 F6"]
A3 = ["D6 Bb5 F5 Bb5 D6 Bb5 F5 Bb5", "Eb6 G5 Bb5 G5 Eb6:2 G5:2", "F6 E6 F6 C6 A5:2 F5:2", "Bb5:2 A5:2 G5:2 F5:2"]
MEL_A = A1 + A2                       # 8 Takte über CH_A
MEL_A_END = A1 + A3

CH_B = ['Eb', 'Eb', 'Bb', 'Bb', 'Cm', 'Ab', 'Bb7', 'Bb7', 'Eb', 'Cm', 'Ab', 'Bb7', 'Eb', 'Ab', 'Bb7', 'F7']
MEL_B = ["G5:2 Bb5:2 Eb6:4", "D6:2 C6:2 Bb5:4", "Bb5:2 D6:2 F6:4", "Eb6:2 D6:2 C6:2 Bb5:2",
         "C6:2 Eb6:2 G6:4", "Ab6:2 G6:2 Eb6:2 C6:2", "D6:2 F6:2 Ab6:2 F6:2", "Bb5:6 F5:2",
         "Bb5:2 Eb6:2 G6:4", "G6:2 F6:2 Eb6:2 C6:2", "Ab5:2 C6:2 Eb6:4", "D6:2 F6:2 Ab6:2 F6:2",
         "G6:2 Eb6:2 Bb5:2 G5:2", "Ab5:2 C6:2 Eb6:2 Ab6:2", "Bb6:2 Ab6:2 F6:2 D6:2", "C6 D6 E6 F6 G6 A6 Bb6 C7"]

CH_C = ['Bb', 'Bb', 'F', 'F', 'Bb', 'Eb', 'F', 'F7']

CH_D = ['Bb', 'G7', 'Cm', 'F7', 'Bb', 'D7', 'Gm', 'C7']
MEL_D = ["D6:1 D6:1 D6:1 D6:1 F6:2 D6:2", "B5:1 B5:1 B5:1 B5:1 D6:2 G6:2", "C6:1 C6:1 C6:1 C6:1 Eb6:2 G6:2",
         "A5:1 A5:1 A5:1 A5:1 C6:2 F6:2", "D6:1 D6:1 D6:1 D6:1 F6:2 Bb6:2", "A5:2 F#5:2 D5:2 F#5:2",
         "G5:2 Bb5:2 D6:2 G6:2", "E6:2 C6:2 Bb5:2 G5:2"]
CH_E = ['Gm', 'C7', 'F', 'F7', 'Cm', 'D7', 'F7', 'F7']

# ==== Arrangement ==========================================================================
# ---- Intro (0–7): Zirkusdirektor-Fanfare, ab Takt 4 Galopp ------------------------------
FAN = ["Bb4:1 Bb4:1 D5:1 D5:1 F5:4", "Eb5:1 Eb5:1 G5:1 G5:1 Bb5:4", "F5:1 A5:1 C6:1 A5:1 F6:4",
       "Eb6:1 D6:1 C6:1 Bb5:1 A5:1 G5:1 F5:2"]
CH_I = ['Bb', 'Eb', 'F', 'F7', 'Bb', 'Bb', 'F', 'F7']
hit(0, 0, 'Bb', 118, 1.2); crash(0, 108)
for i, ch in enumerate(CH_I):
    b = i
    if i < 4:
        seq(b, FAN[i], ['trumpet', 'brass'], [96, 78])
        for j in range(4): song.add('tuba', song.bar(b) + j, 0.6, root(ch) if j % 2 == 0 else fifth(ch), 90)
        hit(b, 0, ch, 100 + i * 3, 0.7)
        s = song.bar(b)
        for j in range(4): song.dr(s + j, KICK if j % 2 == 0 else SNARE, 106)
        for j in range(8): song.dr(s + 2 + j * 0.25, SNARE, ramp(j, 8, 70 + i * 6, 100 + i * 6), 0.12)
        if i == 3: fill(b, True)
        for j in range(4): song.dr(s + j + 0.5, COWBELL, 60)
    else:
        groove(b, 'A', 0.95 + (i - 4) * 0.03)
        oompah(b, ch, 92, True, 62)
        seq(b, (A1)[i - 4], ['calli', 'flute'], [80, 60])
        if i == 7: xrun(b, 2, nt('F5'), 8, 92)
crash(4, 100)
song.add('whistle', song.bar(3) + 3.5, 0.5, n(F, 6), 80)

# ---- Thema A (8–23) ---------------------------------------------------------------------
hit(8, 0, 'Bb', 110, 0.8); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    groove(b, 'B' if second else 'A', 1.0 + (0.04 if second else 0))
    oompah(b, ch, 98, True, 72)
    mel = (MEL_A_END if second else MEL_A)[k]
    seq(b, mel, ['calli'] + (['flute'] if second else []), [92, 66])
    counter(b, ch, 60 + (8 if second else 0))
    if k == 7: xrun(b, 2, nt('F4') + 12, 8, 96, up=True)
    if k == 3 and second: xrun(b, 3, nt('F5'), 4, 90)
fill(15); crash(16, 104); roll(22, 2, 4, 70, 106); fill(23, True)

# ---- Trio B (24–39), Es-Dur -------------------------------------------------------------
hit(24, 0, 'Eb', 108, 1.0); crash(24, 108)
for i in range(16):
    b, k = 24 + i, i; ch = CH_B[k]; second = i >= 8
    groove(b, 'A' if not second else 'B', 0.92 + (0.06 if second else 0))
    oompah(b, ch, 96, True, 66)
    seq(b, MEL_B[k], ['clar'] + (['flute'] if second else ['calli']), [94, 74] if second else [92, 50], gate=0.95)
    for p in chord(ch, 5): song.add('calli', song.bar(b) + 3.5, 0.45, p, 56)      # Schluchzer auf dem letzten Achtel
    if k in (3, 11): xrun(b, 3, nt('Bb4'), 4, 88)
fill(31); fill(35); roll(38, 0, 4, 60, 104); roll(39, 0, 3, 90, 125); fill(39, True)

# ---- Clown-Break C (40–55) --------------------------------------------------------------
def stop(b, hi=True):
    """Slapstick-Stopp: Hieb auf 1, Pfeif-Rutsche, Kuhglocken-Pop, Stille auf dem Ende."""
    s = song.bar(b)
    hit(b, 0, 'Bb', 120, 0.6); song.dr(s, CRASH, 100, 0.4); song.dr(s, KICK, 118)
    for j in range(8):
        song.add('whistle', s + 1 + j * 0.25, 0.24, (n(Bb, 6) - j * 2) if hi else (n(Bb, 5) + j * 2), 96)
    song.dr(s + 3, COWBELL, 110); song.dr(s + 3.5, SIDESTICK, 108); song.dr(s + 3.75, TOM_L, 110)
    song.add('xylo', s + 3.5, 0.3, nt('F5'), 100); song.add('xylo', s + 3.75, 0.3, nt('F6'), 100)
for i in range(16):
    b = 40 + i; ch = CH_C[i % 8]
    if b in (44, 48): stop(b, hi=(b == 44)); continue
    groove(b, 'B' if b >= 49 else 'A', 1.0)
    oompah(b, ch, 96, True, 74)
    if b < 48:
        base = {'Bb': n(Bb, 4), 'F': n(F, 4), 'Eb': n(Eb, 4)}.get(ch, n(F, 4)) + (12 if b % 2 else 0)
        s = song.bar(b)
        for j in range(8): song.add('xylo', s + j * 0.5, 0.42, base + j, 94)
        for j in range(0, 8, 2): song.add('clar', s + j * 0.5, 0.9, base + 12 + j // 2 * 2, 76)
    else:
        seq(b, MEL_A[i - 8], ['trumpet', 'calli'], [94, 80])
        counter(b, ch, 66)
    if b in (43, 47): roll(b, 2, 4, 60, 100)
    if b == 47: song.dr(song.bar(47) + 3.75, KICK, 116)
roll(54, 0, 4, 70, 108); roll(55, 0, 3, 100, 127); fill(55, True)

# ---- Thema A' (56–71) -------------------------------------------------------------------
hit(56, 0, 'Bb', 120, 1.0); crash(56, 116)
for i in range(16):
    b, k = 56 + i, i % 8; ch = CH_A[k]; second = i >= 8
    groove(b, 'C' if second else 'B', 1.05)
    oompah(b, ch, 104, True, 78)
    mel = (MEL_A_END if second else MEL_A)[k]
    seq(b, mel, ['calli', 'flute', 'trumpet'] , [94, 74, 84])
    if second: seq(b, mel, ['xylo'], [80], shift=12)
    counter(b, ch, 68)
    if k == 7: xrun(b, 2, nt('F4') + 12, 8, 100, up=True)
    if k in (0, 4) and second: crash(b, 100)
fill(63); fill(67); roll(70, 2, 4, 70, 108); fill(71, True)

# ---- Finale D (72–79): Can-Can-Tonwiederholungen ---------------------------------------
hit(72, 0, 'Bb', 124, 1.2); crash(72, 120)
for i in range(8):
    b = 72 + i; ch = CH_D[i]
    groove(b, 'C', 1.08)
    oompah(b, ch, 106, True, 82)
    seq(b, MEL_D[i], ['calli', 'trumpet', 'flute'], [98, 88, 78])
    seq(b, MEL_D[i], ['xylo'], [82], shift=12)
    for p in chord(ch, 4): song.add('brass', song.bar(b) + 3.5, 0.45, p, 84)
    for j in range(4): song.dr(song.bar(b) + j + 0.5, COWBELL, 78)
fill(75); fill(79, True)

# ---- Rückführung E (80–87) --------------------------------------------------------------
crash(80, 108)
for i in range(8):
    b = 80 + i; ch = CH_E[i]
    groove(b, 'B' if i < 4 else 'A', 1.0 + i * 0.01)
    oompah(b, ch, 100, True, 74)
    r = n(CH[ch][0], 4); r = r if r <= 70 else r - 12
    arp = [x for x in CH[ch][1]]
    for j in range(8): song.add('calli', song.bar(b) + j * 0.5, 0.42, r + arp[j % len(arp)] + 12 * (j // len(arp)), 84 + i * 2)
    if i >= 4: counter(b, ch, 70)
    if i >= 6: roll(b, 0 if i == 7 else 2, 4, 60 + (i - 6) * 20, 100 + (i - 6) * 20)
xrun(87, 0, nt('F5'), 8, 100); song.add('whistle', song.bar(87) + 2.5, 1.2, n(F, 6), 84)
song.dr(song.bar(87) + 3.75, KICK, 118)
fill(83)

sf2, out = cli_paths('bgm_theme_funfuncircus.ogg')
song.render(sf2, out)
