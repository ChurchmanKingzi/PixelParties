# -*- coding: utf-8 -*-
"""Theme „Doom Clock“ – „The Jaguar's Countdown“ → public/music/bgm_theme_doomclock.ogg

Aztekischer Krieg gegen die Zeit in d-Moll (phrygisch gefärbt: es als kleine Sekunde), 128 BPM,
64 Takte (120,0 s), nahtlos loopbar. Die Uhr tickt (Holzblock/Marimba) und wird von Abschnitt zu
Abschnitt dichter: Viertel → Achtel → Triolen → 16tel → 32stel. Darunter Kriegstrommeln (Toms,
Pauken) im 3+3+2-Raster, ein schleichender Jaguar-Bass (Fagott/Tuba, mit chromatischem
„Anschleichen“), Okarina-/Flöten-Rufe der Krieger und Tempelglocken (Röhrenglocken) zum Taktwechsel.
Am Ende rast der Countdown auf die Dominante zu – der Sprung auf Takt 0 setzt die Uhr zurück.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Ticken in Vierteln, Herzschlag-Pauke, Jaguar-Bass, Glocke, Okarina-Ruf
   8–23  Thema A        Okarina-Thema (3+3+2-Rhythmus), Tick in Achteln, Kriegstrommeln, Flöte antwortet
  24–39  Steigerung B   Tick in Triolen, dann 16teln; Tremolo-Streicher, Flöte + Okarina in Oktaven, Hörner
  40–55  Höhepunkt C    Hymne (Posaune/Horn/Okarina/Flöte), Chor-Gesang, Tick in 16teln, volle Trommeln
  56–63  Countdown D    Tick in 32steln, Snare-Wirbel, Wurzeln steigen, Dominante a → Uhr wird zurückgesetzt
Harmonie: d-Moll, Es (Neapolitaner) / C / B / g-Moll, A als offene Dominante; Loop ohne Schlusskadenz.
Aufruf:  python3 scripts/music/theme_doomclock.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 128, 64                       # 64 × 4 × 60/128 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
WOOD_H, WOOD_L = 76, 77                   # hoher/tiefer Holzblock (GM-Drums)

song.inst('contra',  'contra',   84, 62)
song.inst('bass',    'bassoon',  98, 60)  # Jaguar-Bass
song.inst('tuba',    'tuba',     80, 66)
song.inst('timp',    'timp',     98, 64)
song.inst('marimba', 'marimba',  92, 84)  # Tick / Ostinato
song.inst('strings', 'tremolo',  70, 40)
song.inst('ocarina', 'ocarina',  96, 66)  # Ruf der Krieger
song.inst('flute',   'flute',    84, 46)
song.inst('horns',   'horns',    84, 36)
song.inst('trombone','trombone', 84, 82)
song.inst('choir',   'oohs',     82, 64)
song.inst('bell',    'bell',     88, 90)  # Tempelglocke
song.inst('hit',     'hit',      96, 64)
song.inst('xylo',    'xylo',     70, 96)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {2, 3, 5, 7, 9, 10, 0}            # d-Moll natürlich + es (phrygisch)
# Akkord → (Grundton, Terz; 0 = offene Quinte ohne Terz)
CH = {'Dm': (D, 3), 'Eb': (Eb, 4), 'C': (C, 4), 'Bb': (Bb, 4), 'Gm': (G, 3), 'A': (A, 0), 'F': (F, 4)}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def rb(ch): p = 36 + CH[ch][0]; return p if p >= 38 else p + 12        # Bass Oktave 2 (38–49)
def r3(ch): p = 48 + CH[ch][0]; return p if p < 57 else p - 12           # Mittellage (48–56)

# ---- Uhr: Tick-Tack ---------------------------------------------------------------------------
def tick(b, step, vel=96, marimba=True):
    """Uhr-Ticken im Takt b mit Schrittweite `step` (Vierteln); wechselt Tick (hoch) und Tack (tief)."""
    s = song.bar(b); cnt = int(round(4 / step))
    for i in range(cnt):
        hi = (i % 2 == 0)
        v = vel + (8 if i % 4 == 0 else 0)
        song.dr(s + i * step, WOOD_H if hi else WOOD_L, min(127, v), 0.08)
        if marimba and step >= 0.25: song.add('marimba', s + i * step, min(step * 0.6, 0.15), nt('D6') if hi else nt('A5'), 62 if hi else 54)

def tick_triplet(b, vel=96):
    s = song.bar(b)
    for i in range(12):
        song.dr(s + i / 3, WOOD_H if i % 3 == 0 else WOOD_L, min(127, vel + (8 if i % 3 == 0 else 0)), 0.08)
        song.add('marimba', s + i / 3, 0.12, nt('D6') if i % 3 == 0 else nt('A5'), 62 if i % 3 == 0 else 52)

# ---- Jaguar-Bass, Pauken, Bässe ----------------------------------------------------------------
def prowl(b, ch, vel=96, inst='bass'):
    """Schleichender Jaguar: Grundton synkopiert (3+3+2), Quinte, chromatischer Vorschlag von unten."""
    s = song.bar(b); r = rb(ch)
    for off, p, d in ((0, r, 0.6), (0.75, r, 0.5), (1.5, r, 0.4), (2, r, 0.6), (2.75, r, 0.4), (3.25, r - 1, 0.2), (3.5, r + 7, 0.45)):
        song.add(inst, s + off, d, p, vel + (8 if off == 0 else 0))
def pedal(b, ch, vel=80): song.add('contra', song.bar(b), 3.95, rb(ch) - 12 if rb(ch) - 12 >= 28 else rb(ch), vel)
def tuba(b, ch, vel=80): song.add('tuba', song.bar(b), 1.9, rb(ch), vel); song.add('tuba', song.bar(b) + 2, 1.9, rb(ch) + 7, vel - 6)
def timp(b, ch, kind='heart', vel=96):
    s = song.bar(b); p = rb(ch)
    if kind == 'heart':
        for off, v in ((0, 0), (0.5, -14), (2, -4), (2.5, -16)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'war':
        for off, v in ((0, 0), (0.75, -10), (1.5, -8), (2, -2), (2.75, -10), (3.5, -6)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel * 0.55, vel))
def strings(b, ch, vel=70):
    r = r3(ch); t = CH[ch][1] or 7
    for p in (r, r + t, r + 7, r + 12): song.add('strings', song.bar(b), 3.98, p, vel)
def choir(b, ch, vel=80):
    r = r3(ch) + 12; t = CH[ch][1] or 7
    for p in (r, r + t, r + 7): song.add('choir', song.bar(b), 3.98, p, vel)
def horn_stab(b, ch, vel=88):
    r = r3(ch); t = CH[ch][1] or 7
    for off in (0, 0.75, 1.5, 2.75):
        for p in (r + 7, r + 12 + t if t != 7 else r + 12): song.add('horns', song.bar(b) + off, 0.6, p, vel + (8 if off == 0 else 0))
def gong(b, ch, vel=96): song.add('bell', song.bar(b), 3.9, n(CH[ch][0], 3), vel)
def hit(b, beat, ch, vel=110, dur=0.9):
    r = r3(ch)
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        assert nt(p) % 12 in SCALE, p
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + shift, v)

# ---- Kriegstrommeln (Tom-Muster im 3+3+2-Raster der 16tel) ----------------------------------------
def war(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'heart':
        d(0, KICK, 110); d(2, KICK, 100); d(1, TOM_L, 80); d(3, TOM_L, 84)
    else:
        for half in (0, 2):
            d(half + 0, TOM_L, 108); d(half + 0.75, TOM_M, 96); d(half + 1.5, TOM_L, 100)
        d(0, KICK, 114); d(2, KICK, 106); d(3.5, KICK, 96)
        d(1, CLAP, 90); d(3, CLAP, 94)
        if kind in ('B', 'C'): d(1.75, TOM_H, 90); d(3.75, TOM_HH, 92); d(2.75, COWBELL, 84)
        if kind == 'C': d(1, SNARE, 104); d(3, SNARE, 108); d(1.5, TOM_HH, 90); d(3.25, TOM_H, 86)
def fill(b, vmax=118):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2.0 + i * 0.25, [TOM_H, TOM_HH, TOM_M, TOM_L][min(3, i // 2)], ramp(i, 8, 84, vmax), 0.2)
    song.dr(s + 3.75, KICK, vmax)
def snare_roll(b, start, end, v0, v1, step=0.25):
    s = song.bar(b) + start; cnt = int((end - start) / step)
    for i in range(cnt): song.dr(s + i * step, SNARE, ramp(i, cnt, v0, v1), 0.12)
def crash(b, vel=110): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ------------------------------------------------------------------------------------
CH_A = ['Dm', 'Dm', 'Eb', 'Dm', 'Dm', 'Dm', 'C', 'A']
MEL_A = [
    [(0, .75, 'D5'), (.75, .75, 'F5'), (1.5, .5, 'A5'), (2, 1.5, 'G5'), (3.5, .5, 'F5')],
    [(0, .75, 'D5'), (.75, .75, 'F5'), (1.5, .5, 'A5'), (2, 2, 'C6')],
    [(0, .75, 'Eb5'), (.75, .75, 'G5'), (1.5, .5, 'Bb5'), (2, 1.5, 'A5'), (3.5, .5, 'G5')],
    [(0, 1.5, 'F5'), (1.5, .5, 'G5'), (2, 2, 'D5')],
    [(0, .75, 'D5'), (.75, .75, 'F5'), (1.5, .5, 'A5'), (2, 1.5, 'G5'), (3.5, .5, 'F5')],
    [(0, .75, 'D5'), (.75, .75, 'F5'), (1.5, .5, 'A5'), (2, 1, 'D6'), (3, 1, 'C6')],
    [(0, 1, 'C6'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 2, 'G5')],
    [(0, .75, 'A5'), (.75, .75, 'G5'), (1.5, .5, 'F5'), (2, 1, 'D5'), (3, 1, 'A4')],
]
CH_B = ['Dm', 'Eb', 'Dm', 'C', 'Bb', 'Gm', 'Eb', 'A']
MEL_B = [
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'D6'), (2, 2, 'C6')],
    [(0, .5, 'Eb5'), (.5, .5, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'Eb6'), (2, 2, 'D6')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'D6'), (2, 1, 'F6'), (3, 1, 'D6')],
    [(0, 1, 'C6'), (1, 1, 'G5'), (2, .5, 'C6'), (2.5, .5, 'A5'), (3, 1, 'G5')],
    [(0, 1, 'Bb5'), (1, 1, 'F5'), (2, 1, 'D6'), (3, 1, 'Bb5')],
    [(0, 1, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'D6'), (2, 2, 'G6')],
    [(0, 1, 'Eb6'), (1, 1, 'Bb5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
    [(0, .75, 'A5'), (.75, .75, 'G5'), (1.5, .5, 'F5'), (2, 1, 'D5'), (3, 1, 'A5')],
]
CH_C1 = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Eb', 'A']
MEL_C1 = [
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1.5, 'A5'), (3.5, .5, 'G5')],
    [(0, 1, 'F5'), (1, 1, 'Bb5'), (2, 1.5, 'D6'), (3.5, .5, 'C6')],
    [(0, 1, 'A5'), (1, 1, 'C6'), (2, 1.5, 'F6'), (3.5, .5, 'D6')],
    [(0, 1, 'C6'), (1, 1, 'G5'), (2, 2, 'C6')],
    [(0, 1.5, 'D6'), (1.5, .5, 'C6'), (2, 1, 'A5'), (3, 1, 'F5')],
    [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 1.5, 'D6'), (3.5, .5, 'Bb5')],
    [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 2, 'Eb6')],
    [(0, 1.5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'D5')],
]
CH_C2 = ['Dm', 'Eb', 'Dm', 'C', 'Bb', 'Gm', 'Eb', 'A']
MEL_C2 = [
    MEL_A[0], [(0, .75, 'Eb5'), (.75, .75, 'G5'), (1.5, .5, 'Bb5'), (2, 2, 'Eb6')], MEL_A[5],
    [(0, 1, 'C6'), (1, 1, 'G5'), (2, .5, 'C6'), (2.5, .5, 'D6'), (3, 1, 'C6')],
    [(0, 1, 'Bb5'), (1, 1, 'D6'), (2, 1.5, 'F6'), (3.5, .5, 'D6')],
    [(0, 1, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'D6'), (2, 1, 'G6'), (3, 1, 'D6')],
    [(0, 1, 'Eb6'), (1, 1, 'D6'), (2, 1, 'Bb5'), (3, 1, 'G5')],
    [(0, 3, 'A5'), (3, 1, 'D5')],
]
CH_D = ['Dm', 'Dm', 'Eb', 'Eb', 'Gm', 'Gm', 'A', 'A']

# ==== Arrangement ==================================================================================
# ---- Intro (0–7): Dm Dm Dm Dm Eb Eb A A ------------------------------------------------------------
CH_I = ['Dm', 'Dm', 'Dm', 'Dm', 'Eb', 'Eb', 'A', 'A']
hit(0, 0, 'Dm', 112, 1.4); crash(0, 100)
for b, ch in enumerate(CH_I):
    tick(b, 1.0 if b < 4 else 0.5, 90 + b * 2)
    pedal(b, ch, 66 + b * 3); timp(b, ch, 'heart', 94 + b * 3)
    war(b, 'heart' if b < 3 else 'A', 1.1 + b * 0.02)
    if b % 4 == 0: gong(b, ch, 104)
    prowl(b, ch, 90 + b * 3)
    strings(b, ch, 56 + b * 4); tuba(b, ch, 74 + b * 3)
line(6, [(0, .75, 'D5'), (.75, .75, 'F5'), (1.5, .5, 'A5'), (2, 2, 'D6')], ['ocarina'], [94])
line(7, [(0, .75, 'A5'), (.75, .75, 'G5'), (1.5, .5, 'F5'), (2, 2, 'A4')], ['ocarina'], [98])
snare_roll(6, 2, 4, 50, 92); fill(6); snare_roll(7, 0, 3.5, 70, 118, 0.25); fill(7, 122)

# ---- Thema A (8–23) --------------------------------------------------------------------------------
hit(8, 0, 'Dm', 108, 0.8); crash(8, 110)
for i in range(16):
    b, k = 8 + i, i % 8; second = i >= 8; ch = CH_A[k]
    tick(b, 0.5, 92)
    pedal(b, ch, 80); prowl(b, ch, 96 + (4 if second else 0)); timp(b, ch, 'war', 96)
    war(b, 'A', 1.0 + (0.05 if second else 0))
    if k % 4 == 0: gong(b, ch, 96)
    line(b, MEL_A[k], ['ocarina'] + (['flute'] if second else []), [96, 66] if second else [96])
    if second: line(b, MEL_A[k], ['xylo'], [50], shift=12)
    if k in (2, 3, 6, 7) or second: strings(b, ch, 52 + (10 if second else 0))
    if not second and k >= 4: tuba(b, ch, 74)
fill(15); fill(23, 122); snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 2.5, 80, 120)

# ---- Steigerung B (24–39): Tick in Triolen (24–31), dann 16teln (32–39) -------------------------------------
hit(24, 0, 'Dm', 114, 0.9); crash(24, 112); crash(32, 116); hit(32, 0, 'Dm', 116, 0.9)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8; ch = CH_B[k]
    if not second: tick_triplet(b, 92)
    else: tick(b, 0.25, 90)
    pedal(b, ch, 86); prowl(b, ch, 100 + (4 if second else 0)); timp(b, ch, 'war', 100)
    war(b, 'B', 1.0 + (0.05 if second else 0))
    tuba(b, ch, 80); strings(b, ch, 70 + (8 if second else 0))
    line(b, MEL_B[k], ['ocarina', 'flute'] , [96, 78])
    if second: line(b, MEL_B[k], ['flute'], [58], shift=-12); horn_stab(b, ch, 74)
    if k % 4 == 0 and b != 24 and b != 32: gong(b, ch, 96)
fill(31); fill(35); snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3, 90, 127, 0.125); fill(39, 126)

# ---- Höhepunkt C (40–55) -----------------------------------------------------------------------------
hit(40, 0, 'Dm', 122, 1.2); crash(40, 120); hit(48, 0, 'Dm', 118, 0.9); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; first = i < 8
    ch = (CH_C1 if first else CH_C2)[k]; mel = (MEL_C1 if first else MEL_C2)[k]
    tick(b, 0.25, 84)
    pedal(b, ch, 92); prowl(b, ch, 104); timp(b, ch, 'war', 104)
    war(b, 'C', 1.0 + (0.04 if not first else 0))
    tuba(b, ch, 84); choir(b, ch, 84); strings(b, ch, 66); horn_stab(b, ch, 84)
    line(b, mel, ['trombone', 'ocarina', 'flute'], [92, 98, 80])
    if k % 4 == 0 and b not in (40, 48): gong(b, ch, 96); crash(b, 100)
fill(43); fill(47); fill(51); snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127, 0.125); fill(55, 126)

# ---- Countdown D (56–63): Tick in 32steln, Wurzeln steigen, Dominante -----------------------------------
crash(56, 104); hit(56, 0, 'Dm', 112, 0.9)
for i, ch in enumerate(CH_D):
    b = 56 + i
    tick(b, 0.125 if i >= 4 else 0.25, 88 + i * 3, marimba=(i < 4))
    pedal(b, ch, 84 + i * 2); prowl(b, ch, 100 + i * 2); timp(b, ch, 'war' if i < 4 else 'roll', 100 + i * 2)
    tuba(b, ch, 80); strings(b, ch, 66 + i * 6); choir(b, ch, 62 + i * 5)
    if i < 4: war(b, 'B', 1.0)
    else: snare_roll(b, 0, 4, 55 + (i - 4) * 10, 85 + (i - 4) * 12, 0.125 if i >= 6 else 0.25)
    if i % 2 == 0: gong(b, ch, 96)
line(60, [(0, .5, 'G5'), (.5, .5, 'Bb5'), (1, .5, 'D6'), (1.5, .5, 'Bb5'), (2, 2, 'G5')], ['ocarina', 'flute'], [94, 70])
line(62, [(0, .5, 'A5'), (.5, .5, 'A5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'D5')], ['ocarina', 'flute'], [98, 72])
line(63, [(0, .25, 'A4'), (.25, .25, 'D5'), (.5, .25, 'F5'), (.75, .25, 'A5'), (1, 1, 'D6'), (2, 1.6, 'A5')], ['ocarina'], [104])
fill(59); fill(63, 124)

sf2, out = cli_paths('bgm_theme_doomclock.ogg')
song.render(sf2, out)
