# -*- coding: utf-8 -*-
"""Theme „The Hive Awakens“ (Sparkfly) → public/music/bgm_theme_sparkfly.ogg

Lebendiges Insektennest in A-Mixolydisch, 124 BPM, 64 Takte (123,9 s), nahtlos loopbar.
Warmes, organisches Summen: Akkordeon und Mundharmonika als Schwarm (Summ-Motiv aus schnellen
16tel-Wechselnoten), gestrichene Flächen und Tremolo-Streicher, Marimba als Bauarbeiter-Ostinato
im 3+3+2-Hämmerrhythmus, funkelnde Funken (Kristall/Glockenspiel), Königin-Fanfare mit
Trompete/Horn/Blech und Pauken, Schwarm-Crescendi per Expression-Controller.

Hauptmotiv „Bzz“: sechs 16tel wechseln zwischen zwei Nachbartönen (Summen), ein Stachel-Ton,
dann eine fallende Akkordton-Antwort (Fünfte–Terz–Grundton).

Aufbau (Takte, 0-basiert):
   0– 7  Erwachen        Bogen-Drone, Tremolo-Swell, Marimba-Bauarbeiter, erste Funken, Mundharmonika-Ruf
   8–23  Thema A         Bauarbeiter: Akkordeon-Summ-Motiv + Harmonica-Antwort, Bass, Pizzicato-Offbeats
  24–39  Schwarm B       aufsteigende Achtel-Schwärme in Terzen, zweite Hälfte als Kanon, Crescendo
  40–47  Königin C       Fanfare (Trompete/Blech/Hörner), Pauken, Hits, Krone
  48–55  Höhepunkt D     Thema A trifft Fanfare, dichter Funkenregen, volles Nest
  56–63  Rückführung E   Bau-Ostinato + Drone, Wirbel, Aufbau auf die Dominante → Sprung auf Takt 0

Harmonie: A-Mixolydisch (Töne A H Cis D E Fis G): A | G | D | A | Fis-Moll | G | D | E5 und
B-Teil D A Hm G. Der Loop endet auf E5 (Dominante), keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_sparkfly.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 124, 64                       # 64 × 4 × 60/124 = 123,9 s
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen -------------------------------------------------------------------------------
song.inst('bass',    'sbass',     98, 62)
song.inst('bowed',   'bowed',     72, 64)
song.inst('tremolo', 'tremolo',   66, 90)
song.inst('accord',  'accordion', 84, 46)
song.inst('harmo',   'harmonica', 82, 82)
song.inst('marimba', 'marimba',   88, 40)
song.inst('pizz',    'pizz',      80, 74)
song.inst('crystal', 'crystal',   70, 96)
song.inst('glock',   'glock',     72, 30)
song.inst('timp',    'timp',      96, 64)
song.inst('horns',   'horns',     84, 36)
song.inst('trumpet', 'trumpet',   90, 70)
song.inst('brass',   'brass',     80, 56)
song.inst('hit',     'hit',       96, 64)

# ---- Harmonie ------------------------------------------------------------------------------
SCALE = {A, B, 1, D, E, 6, G}                      # A-Mixolydisch (Cis = 1, Fis = 6)
Cs, Fs = 1, 6
CHD = {'A': [A, Cs, E], 'G': [G, B, D], 'D': [D, Fs, A], 'F': [Fs, A, Cs], 'Bm': [B, D, Fs],
       'Em': [E, G, B], 'E5': [E, B]}
SP = [p for p in range(36, 104) if p % 12 in SCALE]           # Tonleitertöne (MIDI)
def up(p): return next(x for x in SP if x > p)
def tones(ch):
    """Grundton, Terz, Quinte aufsteigend ab Oktave 5 (E5: Grundton, Quinte, Oktave)."""
    pcs = CHD[ch]; r = 72 + ((pcs[0] - 72) % 12); t = [r] + [r + ((pc - pcs[0]) % 12) for pc in pcs[1:]]
    if len(t) == 2: t.append(r + 12)
    return t
def bassp(ch): return 36 + ((CHD[ch][0] - 36) % 12)           # Bass Oktave 2 (36–47)
def pads(ch, base):                                             # Akkordtöne ab Oktave `base`
    return [base + ((pc - base) % 12) for pc in CHD[ch]]

def note(inst, b, off, dur, p, vel):
    assert p % 12 in SCALE, (inst, b, off, p)
    song.add(inst, song.bar(b) + off, dur, p, vel)

def swell(inst, b0, b1, v0, v1):
    """Expression-Verlauf (CC 11) von Takt b0 bis b1 (Schwarm-Crescendo)."""
    steps = int((b1 - b0) * 8)
    for i in range(steps + 1): song.cc(inst, song.bar(b0) + i * 0.5, 11, v0 + (v1 - v0) * i / max(1, steps))

# ---- Melodiebausteine ------------------------------------------------------------------------
def hook(ch, lift=0):
    """Summ-Motiv: 6×16tel Wechselnote, Stachel, fallende Akkordton-Antwort. → [(off, dur, pitch)]"""
    t = [x + lift for x in tones(ch)]; p = t[1]; q = up(p)
    out = [(i * 0.25, 0.22, p if i % 2 == 0 else q) for i in range(6)]
    out += [(1.5, 0.5, t[2]), (2, 0.5, t[2]), (2.5, 0.5, t[1]), (3, 1.0, t[0])]
    return out
def answer(ch, lift=0):
    t = [x + lift for x in tones(ch)]
    return [(2, 0.5, t[2]), (2.5, 0.5, t[1]), (3, 1.0, t[0])]
def run(ch, lift=0):
    """Aufsteigender Achtel-Schwarm über 8 Tonleiterstufen ab dem Grundton (Oktave 4)."""
    r = 60 + ((CHD[ch][0] - 60) % 12) + lift; i = SP.index(r)
    return [(k * 0.5, 0.48, SP[i + k]) for k in range(8)]
def fanfare(ch, var):
    t = tones(ch)
    if var == 0: return [(0, 0.5, t[0]), (0.5, 0.5, t[1]), (1, 1, t[2]), (2, 0.5, t[1]), (2.5, 0.5, t[2]), (3, 1, t[0] + 12)]
    return [(0, 1.5, t[2]), (1.5, 0.5, t[1]), (2, 1, t[0] + 12), (3, 1, t[2])]
def put(inst, b, notes, vel, tr=0, mul=0.95):
    for off, dur, p in notes: note(inst, b, off, dur * mul if dur > 0.3 else dur, p + tr, vel)

# ---- Begleitbausteine --------------------------------------------------------------------------
HAMMER = [0, 3, 6, 8, 11, 14]                    # 3+3+2 | 3+3+2 (16tel-Positionen)
def workers(b, ch, vel, inst='marimba'):
    r = 60 + ((CHD[ch][0] - 60) % 12); f = r + 7
    cyc = [r, f, r + 12, f, r, f]
    for i, s in enumerate(HAMMER): note(inst, b, s * 0.25, 0.22, cyc[i], vel + (14 if i in (0, 3) else 0))
def bass_bee(b, ch, vel=100):
    p = bassp(ch)
    for off, dur, up_, v in ((0, 0.5, 0, 1.0), (0.75, 0.25, 0, 0.8), (1.5, 0.5, 12, 0.9), (2, 0.5, 0, 0.95), (2.75, 0.25, 0, 0.8), (3.5, 0.5, 12, 0.9)):
        note('bass', b, off, dur, p + up_, vel * v)
def drone(b, ch, vel):
    for p in (pads(ch, 45)[0], pads(ch, 45)[0] + 7): note('bowed', b, 0, 3.98, p, vel)
    for p in pads(ch, 57)[1:]: note('bowed', b, 0, 3.98, p, vel - 6)
def trem(b, ch, vel):
    for p in pads(ch, 60): note('tremolo', b, 0, 3.98, p, vel)
def pizz_off(b, ch, vel):
    t = [x - 12 for x in tones(ch)]
    for j, off in enumerate((0.5, 1.5, 2.5, 3.5)): note('pizz', b, off, 0.3, t[[1, 2, 1, 0][j] if len(t) > 2 else 0], vel + (6 if j % 2 == 0 else 0))
def timp(b, ch, kind='q', vel=96):
    p = bassp(ch); s = song.bar(b)
    if kind == 'q':
        for off in (0, 1, 2, 3): song.add('timp', s + off, 0.4, p, vel + (8 if off == 0 else 0))
    elif kind == 'gallop':
        for off, dv in ((0, 0), (1, -6), (1.5, -12), (2, -2), (3, -6), (3.5, -12)): song.add('timp', s + off, 0.4, p, vel + dv)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, vel + i * 1.5)
def sparks(b, ch, dens, rng, vel=82):
    """Funken: zufällige (feste Saat) hohe Akkordtöne auf dem 16tel-Raster."""
    pool = pads(ch, 84) + [x + 12 for x in pads(ch, 84) if x + 12 < 97]
    for s in range(16):
        if rng.random() < dens:
            inst = 'crystal' if rng.random() < 0.6 else 'glock'
            note(inst, b, s * 0.25, 0.2, rng.choice(pool), vel + rng.randint(-8, 10))
def hit(b, ch, vel=108):
    for p in [bassp(ch)] + pads(ch, 48) + pads(ch, 60): song.add('hit', song.bar(b), 0.8, p, vel)

# ---- Schlagzeug ---------------------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, nt, vel): song.dr(s + off, nt, min(127, vel * v))
    if kind == 'work':                                           # Bauarbeiter-Puls
        for off, vel in ((0, 110), (2, 100), (2.75, 84)): d(off, KICK, vel)
        d(1, SNARE, 98); d(3, SNARE, 102); d(1, SIDESTICK, 90); d(3, SIDESTICK, 90)
        for i in range(8): d(i * 0.5, COWBELL, 66 if i % 2 else 78)
        for i in range(16): d(i * 0.25, HAT, 104 if i % 4 == 0 else 78 if i % 2 == 0 else 62)
    elif kind == 'swarm':                                        # Vierteltreiber
        for off in (0, 1, 2, 3): d(off, KICK, 108 if off % 2 == 0 else 96)
        d(1, SNARE, 106); d(3, SNARE, 108); d(3, CLAP, 86); d(2.5, TOM_M, 88)
        for i in range(16): d(i * 0.25, HAT, 106 if i % 4 == 0 else 80 if i % 2 == 0 else 64)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 70)
    elif kind == 'queen':                                        # majestätisch, breit
        for off, vel in ((0, 116), (1.5, 92), (2, 108), (3.5, 96)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 86); d(3, CLAP, 90)
        for i in range(8): d(i * 0.5, RIDE, 108 if i % 2 == 0 else 84)
        d(2.5, TOM_H, 88); d(3.75, TOM_L, 92)
    elif kind == 'peak':
        for off in (0, 1, 2, 3): d(off, KICK, 118 if off % 2 == 0 else 104)
        d(0.75, KICK, 80); d(2.75, KICK, 84)
        d(1, SNARE, 114); d(3, SNARE, 116); d(1, CLAP, 90); d(3, CLAP, 94); d(1.75, SNARE, 74); d(3.75, SNARE, 78)
        for i in range(16): d(i * 0.25, HAT, 108 if i % 4 == 0 else 84 if i % 2 == 0 else 66)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 74)
    elif kind == 'soft':                                         # Rückführung: nur Puls
        d(0, KICK, 100); d(2, KICK, 92); d(1, SIDESTICK, 96); d(3, SIDESTICK, 96)
        for i in range(8): d(i * 0.5, COWBELL, 62 if i % 2 else 74)
        for i in range(16): d(i * 0.25, HAT, 100 if i % 4 == 0 else 70)

def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, 70 + i * 6, 0.12)
    for i in range(8): song.dr(s + (2.5 if big else 2.0) + i * (0.1875 if big else 0.25), TOMS[min(3, i // 2)], 90 + i * 3, 0.2)
    song.dr(s + 3.75, KICK, 118)
def snare_roll(b, start, end, v0, v1):
    cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(song.bar(b) + start + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

rng = random.Random(124)
for nm in ('bowed', 'tremolo'): song.cc(nm, 0, 11, 96)

# ==== Arrangement ==============================================================================
PA = ['A', 'G', 'D', 'A', 'F', 'G', 'D', 'E5']           # Thema A / Fanfare (8 Takte)
PB = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'E5']          # Schwarm B (8 Takte)
PI = ['A', 'A', 'G', 'G', 'A', 'A', 'D', 'E5']           # Intro

# ---- Erwachen (0–7) -----------------------------------------------------------------------------
swell('bowed', 0, 8, 100, 118); swell('tremolo', 0, 8, 96, 116)
hit(0, 'A', 104); crash(0, 100)
for i, ch in enumerate(PI):
    b = i
    drone(b, ch, 76 + i * 3); trem(b, ch, 70 + i * 4)
    workers(b, ch, 82 + i * 2)
    groove(b, 'work', 1.04 + i * 0.01)
    if i >= 2: sparks(b, ch, 0.10 + i * 0.02, rng, 74)
    if i >= 2: bass_bee(b, ch, 92 + i * 2)
    if i >= 2: timp(b, ch, 'q', 84 + i * 2)
    if i >= 6: put('harmo', b, answer(ch), 84 + (i - 6) * 6)
put('harmo', 4, [(2, 0.5, 81), (2.5, 0.5, 76), (3, 1, 73)], 82)
fill(7); snare_roll(7, 0, 2, 60, 90)

# ---- Thema A (8–23): Bauarbeiter ---------------------------------------------------------------
crash(8, 110); hit(8, 'A', 104)
swell('bowed', 8, 24, 100, 104); swell('tremolo', 8, 24, 100, 104)
for i in range(16):
    b = 8 + i; k = i % 8; ch = PA[k]; second = i >= 8
    workers(b, ch, 74 + (6 if second else 0))
    bass_bee(b, ch, 98 + (4 if second else 0))
    pizz_off(b, ch, 74)
    drone(b, ch, 66); trem(b, ch, 58 + (8 if second else 0))
    groove(b, 'work', 1.0 + (0.06 if second else 0))
    put('accord', b, hook(ch, 12 if (k == 3 or (second and k == 7)) else 0), 92 + (4 if second else 0))
    put('harmo', b, answer(ch), 82, 0)
    if second: put('accord', b, [(2, 0.5, tones(ch)[2] - 12), (3, 1, tones(ch)[0] - 12)], 66)
    sparks(b, ch, 0.14 if not second else 0.22, rng, 78)
    if second: timp(b, ch, 'q', 84)
fill(15); fill(23, True); snare_roll(22, 2, 4, 60, 100)

# ---- Schwarm B (24–39): aufsteigende Achtel-Schwärme, Kanon, Crescendo ------------------------------
crash(24, 114); hit(24, 'D', 106)
swell('tremolo', 24, 40, 96, 127); swell('bowed', 24, 40, 96, 120)
for i in range(16):
    b = 24 + i; k = i % 8; ch = PB[k]; second = i >= 8
    workers(b, ch, 76 + (6 if second else 0), 'marimba')
    bass_bee(b, ch, 100 + (4 if second else 0))
    pizz_off(b, ch, 78)
    drone(b, ch, 68); trem(b, ch, 66 + (10 if second else 0))
    groove(b, 'swarm', 1.0 + (0.05 if second else 0))
    if k % 2 == 0:
        put('accord', b, run(ch), 90); put('harmo', b, run(ch, 12), 76)
    else:
        put('accord', b, hook(ch, 12), 92); put('harmo', b, hook(ch, 0), 78)
    if second:                                                   # Kanon: Harmonica einen Takt später, Trompete zwei
        pk = (k - 1) % 8; pch = PB[pk]
        if pk % 2 == 0: put('harmo', b, run(pch, 12), 84)
        else: put('harmo', b, hook(pch, 0), 84)
        put('trumpet', b, [(0, 2, tones(ch)[1]), (2, 2, tones(ch)[2])], 78)
        timp(b, ch, 'gallop', 92)
    sparks(b, ch, 0.22 + (0.10 if second else 0), rng, 80)
fill(31); fill(35); fill(39, True); snare_roll(38, 0, 4, 60, 105); snare_roll(39, 0, 3, 90, 124)

# ---- Königin C (40–47): Fanfare ------------------------------------------------------------------
crash(40, 122); hit(40, 'A', 118); crash(44, 112)
swell('bowed', 40, 48, 110, 118); swell('tremolo', 40, 48, 110, 120)
for i in range(8):
    b = 40 + i; ch = PA[i]; var = i % 2
    put('trumpet', b, fanfare(ch, var), 102)
    put('brass', b, fanfare(ch, var), 88, -12)
    put('horns', b, fanfare(ch, var), 84, -24)
    bass_bee(b, ch, 104)
    workers(b, ch, 70, 'marimba')
    drone(b, ch, 74); trem(b, ch, 78)
    groove(b, 'queen', 1.0)
    timp(b, ch, 'q', 100)
    sparks(b, ch, 0.18, rng, 84)
    if i % 2 == 1: put('accord', b, hook(ch, 12), 80)
fill(43); fill(47, True); snare_roll(46, 2, 4, 70, 108)

# ---- Höhepunkt D (48–55): volles Nest -------------------------------------------------------------
crash(48, 124); hit(48, 'A', 122); crash(52, 116)
swell('bowed', 48, 56, 118, 127); swell('tremolo', 48, 56, 118, 127)
for i in range(8):
    b = 48 + i; ch = PA[i]
    put('accord', b, hook(ch, 12 if i in (3, 7) else 0), 100)
    put('harmo', b, hook(ch, 12), 88)
    put('trumpet', b, fanfare(ch, i % 2), 100, 0)
    put('brass', b, fanfare(ch, i % 2), 86, -12)
    put('horns', b, fanfare(ch, i % 2), 82, -24)
    bass_bee(b, ch, 106)
    workers(b, ch, 82, 'marimba'); pizz_off(b, ch, 80)
    drone(b, ch, 78); trem(b, ch, 84)
    groove(b, 'peak', 1.0 + (0.04 if i >= 4 else 0))
    timp(b, ch, 'gallop', 102)
    sparks(b, ch, 0.34, rng, 86)
fill(51); fill(55, True); snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127)

# ---- Rückführung E (56–63) ---------------------------------------------------------------------------
PE = ['A', 'G', 'D', 'A', 'G', 'D', 'E5', 'E5']
crash(56, 100)
swell('bowed', 56, 64, 110, 96); swell('tremolo', 56, 64, 88, 122)
for i, ch in enumerate(PE):
    b = 56 + i
    workers(b, ch, 78 + i * 2, 'marimba')
    bass_bee(b, ch, 96 + i * 2)
    drone(b, ch, 72); trem(b, ch, 66 + i * 4)
    if i < 4:
        groove(b, 'soft', 1.0); sparks(b, ch, 0.12, rng, 76)
        if i % 2 == 0: put('harmo', b, answer(ch), 80)
        timp(b, ch, 'q', 84)
    else:
        groove(b, 'swarm', 0.92 + (i - 4) * 0.02) if i < 6 else snare_roll(b, 0, 4 if i == 6 else 3.5, 60 + (i - 6) * 30, 96 + (i - 6) * 28)
        put('accord', b, run(ch, 12) if i == 4 else hook(ch, 0) if i == 5 else [(k * 0.25, 0.22, [76, 78][k % 2] + 12) for k in range(16)], 88 + (i - 4) * 4)
        timp(b, ch, 'gallop' if i < 6 else 'roll', 92 + (i - 4) * 4)
        sparks(b, ch, 0.24 + (i - 4) * 0.08, rng, 84)
put('trumpet', 63, [(0, 0.25, 71), (0.25, 0.25, 73), (0.5, 0.25, 76), (0.75, 0.25, 78), (1, 1, 83), (2, 1.6, 76)], 100)
fill(59); fill(63, True)

# ---- Rendern ----------------------------------------------------------------------------------------
sf2, out = cli_paths('bgm_theme_sparkfly.ogg')
song.render(sf2, out)
