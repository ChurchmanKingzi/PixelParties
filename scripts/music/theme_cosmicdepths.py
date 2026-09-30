# -*- coding: utf-8 -*-
"""Battle-Track „Whispers Beyond the Void“ (Cosmic Depths) → public/music/bgm_theme_cosmicdepths.ogg

Kosmischer Horror / Science-Fiction, 96 BPM (Half-Time-Wucht), 48 Takte (120,0 s), nahtlos loopbar.
Tonalität: Ganztonleiter auf D (D E F# G# A# C) mit Bass-Grundtönen D–B♭–F#–C. Die Ganztonleiter hat
keinen Leitton und keine Quinte: alles schwebt, nichts löst sich auf – fremdartig. In der Brücke kippt
alles in die ZWEITE Ganztonleiter (einen Halbton höher, Eb-Ganzton): „die Leere öffnet sich“.
Treibende Sub-Bass-Pulsachtel (Sub-Bass + Sinus) trägt den Kampf, Kick/Snare im Half-Time (Snare auf 3).
Hauptmotiv „Flüstern“: fallende Ganztonschritte (A#–G#–F#–E), Antwort steigt in Ganztönen, Echo-Kopie (Kristall).
Klang: Echoes/Atmos/Scifi-Drones, Sub-Bass, Kristall/Glocke, Chor-Oohs, Orchester-Hit, Pauke.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Sub-Puls, Half-Time-Kick, Echoes-Drone, Motivfragmente in Glocke/Kristall
   8–23  Thema A      Hauptmotiv (Scifi + Kristall-Echo), Atmos-Gegenstimme, Toms, Ganztonakkorde
  24–31  Brücke       zweite Ganztonleiter (+1 Halbton), Tremolo-Puls, Sweep, Snare-Wirbel
  32–43  Höhepunkt    Chor, Hits, Pauken, Motiv in Parallel (Ganzton höher) + Oktave
  44–47  Rückführung  Ausdünnen, Riser, Motivruf → zurück zu Takt 0
Aufruf:  python3 scripts/music/theme_cosmicdepths.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 96, 48                        # 48 × 4 × 60/96 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('sub',    'sbass',   100, 64)
song.inst('sine',   'sine',     84, 64)
song.inst('contra', 'contra',   80, 64)
song.inst('echoes', 'echoes',   78, 40)
song.inst('atmos',  'atmos',    70, 88)
song.inst('sweep',  'sweep',    66, 64)
song.inst('scifi',  'scifi',    82, 60)
song.inst('crystal','crystal',  74, 84)
song.inst('bell',   'bell',     76, 34)
song.inst('glock',  'glock',    70, 96)
song.inst('choir',  'oohs',     84, 64)
song.inst('hit',    'hit',      96, 64)
song.inst('timp',   'timp',     96, 64)
song.inst('tremolo','tremolo',  66, 50)

NAMES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7,
         'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
WT = {0, 2, 4, 6, 8, 10}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def mel(inst, b, notes, shift=0, vel=88, semis=0, echo=None):
    """Melodietakt [(beat, dauer, 'A#5')…]; prüft Zugehörigkeit zur (verschobenen) Ganztonleiter."""
    for off, dur, p in notes:
        pitch = nt(p) + shift
        assert (pitch - shift) % 12 in WT, (b, p)
        song.add(inst, song.bar(b) + off, dur * 0.94, pitch + semis, vel)
        if echo: song.add(echo[0], song.bar(b) + off + 0.75, dur * 0.7, pitch + semis + 12 * echo[2], echo[1])

# Bassgrundtöne je 2 Takte (8-Takt-Progression): D D Bb Bb F# F# C Bb (alle in der Ganztonleiter)
ROOTS = [2, 2, 10, 10, 6, 6, 0, 10]
def root(k, shift=0): return ROOTS[k % 8] + shift
def bassp(pc, octv):
    return n(pc % 12, octv)

def pulse(b, k, shift=0, vel=1.0, style=1):
    """Sub-Puls: Achtel auf dem Grundton, Akzent auf 1 und 3, Oktavsprung als Unruhe."""
    r = root(k, shift); s = song.bar(b)
    for i in range(8):
        acc = (0, 4)
        v = (104 if i in acc else 80 if i % 2 == 0 else 66) * vel
        p = bassp(r, 2) + (12 if (style == 2 and i == 7) else 0)
        song.add('sub', s + i * 0.5, 0.42, p, v)
    for off in (0, 2): song.add('sine', s + off, 1.9, bassp(r, 2), 84 * vel)
    song.add('contra', s, 3.95, bassp(r, 1) if bassp(r, 1) >= 28 else bassp(r, 2), 78 * vel)

def aug(k, shift=0):
    """Übermäßiger Dreiklang (Ganztonleiter) zum Grundton, Oktave 3–4."""
    r = root(k, shift); base = 48 + r if r >= 5 else 60 + r
    return [base - 12 + (0 if r >= 5 else 0), base, base + 4, base + 8]

def pad(b, k, shift=0, vel=70, inst='echoes', dur=7.9):
    r = root(k, shift); base = 48 + (r % 12)
    for p in (base, base + 4, base + 8, base + 12): song.add(inst, song.bar(b), dur, p, vel)

def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, vel * v)
    if kind == 'intro':
        d(0, KICK, 108); d(2, KICK, 96); d(2, SNARE, 100)
        for i in range(4): d(0.5 + i, SIDESTICK, 74)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 84)
    elif kind == 'A':
        for off, vel in ((0, 114), (1.5, 96), (2.75, 90)): d(off, KICK, vel)
        d(2, SNARE, 112); d(2, CLAP, 74); d(3.5, TOM_L, 92)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 86)
    elif kind == 'B':
        for off in (0, 1, 2, 3): d(off, KICK, 100 if off else 110)
        d(2, SNARE, 108); d(1.5, TOM_H, 84); d(3.5, TOM_M, 92)
        for i in range(8): d(i * 0.5, COWBELL, 66 if i % 2 == 0 else 52)
        for i in range(8): d(i * 0.5, HAT, 100)
    elif kind == 'C':
        for off, vel in ((0, 120), (1, 96), (1.5, 100), (2.75, 100)): d(off, KICK, vel)
        d(2, SNARE, 118); d(2, CLAP, 88); d(0, CRASH, 70)
        d(3.25, TOM_M, 96); d(3.5, TOM_L, 100); d(3.75, TOM_L, 104)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)

def fill(b, big=False):
    s = song.bar(b)
    toms = [TOM_HH, TOM_H, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)], ramp(i, 8, 84, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + i * 0.25, SNARE, ramp(i, 8, 70, 110), 0.15)
    song.dr(s + 3.75, KICK, 116)

def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)

def crash(b, vel=104): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Motive ("Flüstern"): fallende Ganztöne, Antwort steigt ------------------------------
WHISPER = [(0, 1.5, 'A#5'), (1.5, 0.5, 'G#5'), (2, 1, 'F#5'), (3, 1, 'E5')]
WHISPER_LOW = [(0, 1.5, 'A#4'), (1.5, 0.5, 'G#4'), (2, 1, 'F#4'), (3, 1, 'E4')]
ANSWER = [(0, 1, 'C5'), (1, 1, 'D5'), (2, 1, 'E5'), (3, 1, 'G#5')]
SIGH = [(0, 2, 'F#5'), (2, 1, 'E5'), (3, 1, 'D5')]
HELD = [(0, 3, 'D5'), (3, 1, 'C5')]
ALIEN = [(0, 0.5, 'D6'), (0.5, 0.5, 'C6'), (1, 0.5, 'A#5'), (1.5, 0.5, 'G#5'), (2, 2, 'F#5')]
# Thema (8 Takte), Grundton-Takte laut ROOTS: D D Bb Bb F# F# C Bb
THEME = [WHISPER, SIGH, WHISPER, ANSWER, WHISPER_LOW, SIGH, ANSWER, HELD]
# Höhepunkt: Motiv mit Aufwärts-Wendung
PEAK = [WHISPER, ALIEN, WHISPER, ANSWER, ALIEN, SIGH, [(0, 1, 'E5'), (1, 1, 'G#5'), (2, 1, 'A#5'), (3, 1, 'C6')], HELD]

# ==== Arrangement ======================================================================
# ---- Intro (0–7) --------------------------------------------------------------------
for b in range(8):
    k = b // 1
    pulse(b, b, 0, 0.8 + b * 0.02)
    drums(b, 'intro', 0.95 + b * 0.02)
    if b % 2 == 0: pad(b, b // 2, 0, 66 + b * 2, 'echoes', 7.9)
    if b >= 2:
        song.add('atmos', song.bar(b), 3.95, nt('D3') + (12 if b % 2 else 0), 56 + b * 3)
    if b >= 4: mel('bell', b, [(0, 1.5, 'A#5'), (1.5, 0.5, 'G#5')], 0, 84)
    if b >= 6: mel('crystal', b, [(2, 1, 'F#5'), (3, 1, 'E5')], 0, 80)
song.add('hit', 0, 1.5, nt('D2'), 96); crash(0, 100)
song.add('timp', song.bar(6), 2, nt('D2'), 100); song.add('timp', song.bar(7) + 2, 2, nt('D2'), 108)
snare_roll(7, 2, 4, 60, 104); fill(7)

# ---- Thema A (8–23) ----------------------------------------------------------------
crash(8, 108); song.add('hit', song.bar(8), 1.2, nt('D3'), 100)
for i in range(16):
    b, k = 8 + i, i % 8
    second = i >= 8
    pulse(b, k // 1 if False else k, 0, 1.0 if not second else 1.06, 2 if second and k % 2 else 1)
    drums(b, 'A', 1.0 + (0.04 if second else 0))
    if k % 2 == 0: pad(b, k // 2, 0, 70 + (6 if second else 0), 'echoes', 7.9)
    song.add('atmos', song.bar(b), 3.95, nt('D3') + (12 if k % 2 else 0), 62)
    mel('scifi', b, THEME[k], 0, 90 if not second else 96, 0, ('crystal', 62, 0))
    if second: mel('glock', b, THEME[k], 0, 62, 12)
    if k in (3, 7): song.add('timp', song.bar(b) + 3, 0.8, nt('D2'), 96)
fill(15); fill(19); snare_roll(22, 0, 4, 60, 100); fill(23, True)

# ---- Brücke (24–31): zweite Ganztonleiter (+1 Halbton) -------------------------------
crash(24, 108); song.add('hit', song.bar(24), 1.5, nt('Eb3'), 104)
BR = [WHISPER, WHISPER, ANSWER, SIGH, WHISPER, ALIEN, ANSWER, [(0, 3, 'D5'), (3, 1, 'C5')]]
for i in range(8):
    b, k = 24 + i, i
    pulse(b, k, 1, 1.02, 2)
    drums(b, 'B', 1.0 + i * 0.01)
    if k % 2 == 0: pad(b, k // 2, 1, 74, 'atmos', 7.9)
    song.add('sweep', song.bar(b), 3.95, nt('D3') + 1 + (7 if k % 2 else 0), 60 + i * 3)
    # Tremolo-Puls auf dem Grundton der zweiten Leiter
    for j in range(8): song.add('tremolo', song.bar(b) + j * 0.5, 0.45, bassp(root(k, 1), 3) + (12 if j % 4 == 3 else 0), 58 + i * 2)
    mel('crystal', b, BR[k], 1, 88, 0, ('glock', 60, 0))
    mel('scifi', b, [(o, d, p) for o, d, p in BR[k]], 1, 70, -12)
fill(27); snare_roll(30, 0, 4, 60, 108); snare_roll(31, 0, 3.5, 90, 127); fill(31, True)

# ---- Höhepunkt (32–43) ---------------------------------------------------------------
PEAK_BARS = 12
crash(32, 116); song.add('hit', song.bar(32), 1.5, nt('D3'), 116); song.add('hit', song.bar(32), 1.5, nt('D4'), 104)
for i in range(PEAK_BARS):
    b, k = 32 + i, i % 8
    pulse(b, k, 0, 1.08, 2)
    drums(b, 'C', 1.0 + 0.02 * (i // 4))
    if k % 2 == 0:
        pad(b, k // 2, 0, 76, 'echoes', 7.9)
        base = 48 + ROOTS[(k // 2 * 2) % 8]
        for p in (base + 12, base + 16, base + 20): song.add('choir', song.bar(b), 7.9, p, 86)
    song.add('atmos', song.bar(b), 3.95, nt('D3') + (12 if k % 2 else 0), 68)
    m = PEAK[k]
    mel('scifi', b, m, 0, 100, 0, ('crystal', 70, 0))
    mel('crystal', b, m, 0, 82, 12)
    mel('bell', b, m, 0, 80, 0) if k in (0, 2, 4) else None
    if k in (0, 4): song.add('timp', song.bar(b), 0.7, nt('D2'), 108); song.add('timp', song.bar(b) + 2, 0.7, nt('D2'), 100)
    if k % 4 == 0 and b != 32: crash(b, 100)
fill(35); fill(39); fill(43, True)

# ---- Rückführung (44–47) -------------------------------------------------------------
for i in range(4):
    b = 44 + i
    pulse(b, 7 if i < 2 else 0, 0, 1.0 - i * 0.03, 1)
    drums(b, 'A' if i < 2 else 'intro', 0.96)
    pad(b, 3, 0, 68 + i * 3, 'sweep', 3.95)
    song.add('atmos', song.bar(b), 3.95, nt('D3'), 68 + i * 4)
    for j in range(8): song.add('tremolo', song.bar(b) + j * 0.5, 0.45, nt('D3') + 12 * (j % 2), 54 + i * 8 + j)
mel('bell', 45, WHISPER, 0, 90); mel('crystal', 46, WHISPER, 0, 92, 0, ('glock', 66, 0))
mel('scifi', 47, [(0, 1.5, 'A#5'), (1.5, 0.5, 'G#5'), (2, 1, 'F#5')], 0, 96)
snare_roll(46, 2, 4, 60, 100); snare_roll(47, 0, 3.5, 84, 124); fill(47)

sf2, out = cli_paths('bgm_theme_cosmicdepths.ogg')
song.render(sf2, out)
