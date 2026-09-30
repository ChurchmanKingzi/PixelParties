# -*- coding: utf-8 -*-
"""Archetyp-Theme „Harpy Jam Session“ (Harpyformers) → public/music/bgm_theme_harpyformers.ogg

Die Harpyformer sind eine Band, die im Kampf durch ihre Genres wandert. e-Moll/E-Dur, 130 BPM,
64 Takte (118,2 s), nahtlos loopbar. Alle Genres teilen EIN Motiv, das „Harpy-Motiv“:
Grundton – kleine Terz – Quarte – Quinte (E-G-A, dann B lang), diatonisch auf jeden Akkord
verschoben und in jedem Stil neu eingekleidet.

Aufbau (Takte, 0-basiert):
   0– 7  Grunge-Intro      Palm-Mute-Riff (Em-G-C-D), Bass, Rock-Beat, Motiv im Lead (Charang)
   8–15  Ballad            Klavier-Arpeggien, Streicher-Fläche, Motiv halbiert; Kick/Sidestick, Toms
  16–23  Classical         Geige führt das Motiv in 16tel-Läufen (e-harmonisch Moll), Cembalo, Pizzicato,
                           Snare-Marsch und Pauken
  24–31  Country           E-Dur (G#!), Boom-Chick-Gitarre, Mundharmonika-Motiv, Fiedel, Train-Beat
  32–39  Grunge           schwerer Halbzeit-Sludge, Power-Akkorde, Gesangs-Motiv (Solo-Voice) + Lead
  40–47  Metal            E-phrygisch (F!), Galopp-Riff, Doppelfuß-16tel, Motiv im Doppel-Lead
  48–55  Finale           alle Stile übereinander: Chor + Streicher + Lead + Harmonika, Metal-Beat
  56–63  Rückführung      Riff-Aufbau, Snare-Wirbel, Dominant (H) → zurück ins Grunge-Intro

Harmonie: e-Moll-Diatonik mit Ausflügen (E-Dur im Country, H-Dur-Dominante in Klassik/Rückführung,
F-Dur als phrygische II im Metal). Der Loop endet auf der Dominante (kein Schluss).
Aufruf:  python3 scripts/music/theme_harpyformers.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 130, 64                        # 64 × 4 × 60/130 = 118,2 s
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',    'bass2',    98, 60)   # E-Bass
song.inst('acbass',  'acbass',   92, 66)   # Kontra-/Country-Bass
song.inst('riff',    'rockgtr',  84, 46)   # verzerrte Gitarre
song.inst('lead',    'charang',  84, 80)   # Lead
song.inst('piano',   'piano',    92, 58)
song.inst('strings', 'strings',  78, 38)
song.inst('pizz',    'pizz',     80, 70)
song.inst('harpsi',  'harpsichord', 82, 88)
song.inst('violin',  'violin',   88, 74)
song.inst('guitar',  'guitar',   88, 34)   # Country-Gitarre
song.inst('harmo',   'harmonica',90, 84)
song.inst('choir',   'choir',    80, 64)
song.inst('voice',   'solovoice',86, 60)
song.inst('timp',    'timp',     90, 64)
song.inst('organ',   'rockorgan',70, 52)

# ---- Tonleitern (Motiv wird über Skalenstufen definiert → immer in der Tonart) -----------
NAT, HAR, PHR, MAJ = [0, 2, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 8, 11], [0, 1, 3, 5, 7, 8, 10], [0, 2, 4, 5, 7, 9, 11]
def scale(iv, tonic=E):
    return [n(tonic + i, o) for o in range(1, 8) for i in iv]
S_NAT, S_HAR, S_PHR, S_MAJ = scale(NAT), scale(HAR), scale(PHR), scale(MAJ)
def deg(sc, k): return sc[21 + k]           # k=0 → E4 (Stufe 1), 7 Stufen pro Oktave

# Akkorde: Name → (Grundton, Art)
CH = {'Em': (E, 'm'), 'G': (G, 'M'), 'C': (C, 'M'), 'D': (D, 'M'), 'Am': (A, 'm'), 'B': (B, 'M'),
      'E': (E, 'M'), 'A': (A, 'M'), 'F': (F, 'M'), 'B7': (B, 'M')}
def root(ch, o): return n(CH[ch][0], o)
def tri(ch, o=3):
    r = root(ch, o); return [r, r + (3 if CH[ch][1] == 'm' else 4), r + 7]
SHIFT = {'Em': 0, 'G': 2, 'C': -2, 'D': -1, 'Am': 3, 'B': 4, 'B7': 4, 'E': 0, 'A': 3, 'F': 1}   # Motiv-Verschiebung
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ---- Harpy-Motiv und Ableitungen (Beat, Dauer, Stufe) -----------------------------------
M1   = [(0, .5, 0), (.5, .5, 2), (1, .5, 3), (1.5, 2.4, 4)]                  # E-G-A-B(lang)
M1T  = [(0, .5, 0), (.5, .5, 2), (1, .5, 3), (1.5, .5, 4), (2, 1, 3), (3, 1, 2)]
ANS  = [(0, 1, 4), (1, .5, 3), (1.5, .5, 2), (2, 2, 0)]                      # Antwort: B-A-G-E
MH   = [(0, 1, 0), (1, 1, 2), (2, 1, 3), (3, 1, 4)]                          # Ballade: Viertel
MRUN = [(0, .25, 0), (.25, .25, 2), (.5, .25, 3), (.75, .25, 4), (1, .5, 3), (1.5, .5, 2), (2, 1, 0), (3, 1, 2)]  # Klassik
MGAL = [(0, .25, 0), (.25, .25, 0), (.5, .25, 2), (.75, .25, 3), (1, 1.5, 4), (2.5, .5, 3), (3, 1, 2)]
MHI  = [(0, 1, 4), (1, 1, 5), (2, 1, 7), (3, 1, 4)]                          # Finale: Höhenflug

def phrase(b, notes, inst, sc, chord, vel, dur_mul=0.94, octshift=0):
    sh = SHIFT[chord]
    for off, dur, d in notes:
        song.add(inst, song.bar(b) + off, dur * dur_mul, deg(sc, d + sh) + octshift, vel + (6 if off == 0 else 0))

# ---- Schlagzeug ----------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel, du=0.2): song.dr(s + off, note, min(127, vel * v), du)
    if kind == 'rock':
        for off, vel in ((0, 116), (1.5, 96), (2, 108), (3.5, 90)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114)
        for i in range(8): d(i * .5, HAT, 108 if i % 2 == 0 else 92)
    elif kind == 'half':                                   # Sludge-Halbzeit
        d(0, KICK, 120); d(1.5, KICK, 100); d(2.5, KICK, 104); d(2, SNARE, 120); d(2, CLAP, 90)
        d(0, CRASH, 96, .5)
        for i in range(4): d(i, HAT, 110)
        d(3.5, TOM_L, 96)
    elif kind == 'ballad':
        d(0, KICK, 100); d(2, KICK, 94); d(2.5, KICK, 80)
        d(1, SIDESTICK, 98); d(3, SIDESTICK, 100); d(1, CLAP, 60); d(3, CLAP, 64)
        for i in range(8): d(i * .5, HAT, 100 if i % 2 == 0 else 86)
        d(3.5, TOM_H, 70)
    elif kind == 'classic':                                # Marsch
        for off in (0, 2): d(off, KICK, 100)
        for off, vel in ((1, 100), (1.5, 76), (2.75, 80), (3, 104), (3.5, 82), (3.75, 90)): d(off, SNARE, vel, .12)
        for i in range(4): d(i, TOM_L if i % 2 == 0 else TOM_M, 80)
    elif kind == 'country':                                # Train-Beat
        d(0, KICK, 98); d(2, KICK, 92)
        for i in range(8): d(i * .5, SNARE, 62 if i % 2 == 0 else 84, .1)
        for i in range(4): d(i, COWBELL if i % 2 == 0 else SIDESTICK, 88 if i % 2 == 0 else 80)
        d(1, CLAP, 70); d(3, CLAP, 76)
    elif kind == 'metal':                                  # Doppelfuß-16tel + Galopp
        for i in range(16): d(i * .25, KICK, 104 if i % 4 == 0 else 90, .1)
        d(1, SNARE, 118); d(3, SNARE, 120); d(0, CRASH, 100, .5); d(2, RIDE, 110)
        d(1.5, RIDE, 100); d(3.5, RIDE, 100)
    elif kind == 'metal2':
        for i in range(16): d(i * .25, KICK, 104 if i % 4 == 0 else 92, .1)
        d(1, SNARE, 120); d(3, SNARE, 122); d(0, CRASH, 108, .5)
        d(1, CLAP, 90); d(3, CLAP, 92)
        for i in range(4): d(i, RIDE, 112)
    elif kind == 'soft':
        d(0, KICK, 96); d(2, KICK, 90); d(1, SNARE, 90); d(3, SNARE, 96)
        for i in range(8): d(i * .5, HAT, 100 if i % 2 == 0 else 84)

def fill(b, big=False):
    s = song.bar(b); T = [TOM_H, TOM_HH, TOM_M, TOM_L]
    if big:
        for i in range(8): song.dr(s + 1.5 + i * .25, SNARE, ramp(i, 8, 72, 118), .12)
    for i in range(8): song.dr(s + (2.5 if big else 2) + i * (.1875 if big else .25), T[min(3, i // 2)], ramp(i, 8, 92, 120), .2)
    song.dr(s + 3.75, KICK, 120)
def snare_roll(b, a, z, v0, v1):
    s = song.bar(b) + a; c = int((z - a) * 4)
    for i in range(c): song.dr(s + i * .25, SNARE, ramp(i, c, v0, v1), .12)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, .5)

# ---- Gitarren-/Bass-Bausteine ---------------------------------------------------------
def pm_riff(b, ch, vel=88, style='8th'):
    """Palm-Mute-Riff: Power-Akkord (Grundton+Quinte) Oktave 2–3."""
    r = root(ch, 2); s = song.bar(b)
    if style == '8th':
        for i in range(8):
            acc = 12 if i in (0, 3, 6) else 0
            for p in (r, r + 7): song.add('riff', s + i * .5, .42, p, vel + acc)
    elif style == 'sludge':
        for off, du in ((0, 1.9), (2, 1.4), (3.5, .5)):
            for p in (r, r + 7, r + 12): song.add('riff', s + off, du, p, vel + 10)
    elif style == 'gallop':
        for q in range(4):
            for off, du in ((0, .25), (.5, .25), (.75, .25)):
                for p in (r, r + 7): song.add('riff', s + q + off, du * .9, p, vel + (10 if off == 0 else 0))
            # Beat q+0.25 bleibt frei → Galopp-Gefühl (Achtel + zwei 16tel)
    elif style == 'sus':
        for p in (r, r + 7, r + 12): song.add('riff', s, 3.95, p, vel)
def bass_line(b, ch, vel=98, style='8th', inst='bass', o=1):
    r = root(ch, o); s = song.bar(b)
    if style == '8th':
        for i in range(8): song.add(inst, s + i * .5, .42, r, vel + (8 if i % 2 == 0 else 0))
    elif style == 'half':
        song.add(inst, s, 1.9, r, vel); song.add(inst, s + 2, 1.9, r + 7 if o == 1 else r, vel - 6)
    elif style == 'gallop':
        for q in range(4):
            for off in (0, .5, .75): song.add(inst, s + q + off, .24, r, vel + (8 if off == 0 else 0))
    elif style == 'walk':                                  # Country: Grundton–Quinte
        for i, p in enumerate((r, r + 7, r, r + 7)): song.add(inst, s + i, .9, p + (12 if o == 1 else 0) * 0, vel - (i % 2) * 8)
    elif style == 'root':
        song.add(inst, s, 3.95, r, vel)

# ============================== Arrangement ================================================
P_ROCK = ['Em', 'Em', 'G', 'G', 'C', 'C', 'D', 'D']        # Grunge-Progression (je 2 Takte)

# ---- 0–7 Grunge-Intro ---------------------------------------------------------------------
for i in range(8):
    b, ch = i, P_ROCK[i]
    groove(b, 'rock', 1.0 if i >= 2 else 0.95)
    bass_line(b, ch, 92 + i * 2, '8th')
    if i >= 2: pm_riff(b, ch, 78 + i * 3, '8th')
    if i >= 4:
        song.add('organ', song.bar(b), 3.95, root(ch, 3) + 12, 60 + (i - 4) * 4)
        song.add('organ', song.bar(b), 3.95, root(ch, 3) + 19, 56 + (i - 4) * 4)
for i in (4, 6): phrase(i, M1, 'lead', S_NAT, P_ROCK[i], 92)
for i in (5, 7): phrase(i, ANS, 'lead', S_NAT, P_ROCK[i], 90)
crash(0, 112); crash(4, 104); fill(3); snare_roll(7, 0, 3.5, 70, 120); fill(7, True)

# ---- 8–15 Ballad ------------------------------------------------------------------------------
P_BAL = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B']
crash(8, 100)
for i in range(8):
    b, ch = 8 + i, P_BAL[i]
    groove(b, 'ballad', 1.0)
    bass_line(b, ch, 84, 'half', 'acbass', 2)
    t = tri(ch, 3)
    for j in range(8):                                              # Arpeggio Achtel
        song.add('piano', song.bar(b) + j * .5, .55, [t[0], t[1], t[2], t[1] + 12][j % 4] if j < 4 else [t[2], t[1] + 12, t[2], t[1] + 12][j % 4] - (0 if j % 2 else 0), 78 + (8 if j == 0 else 0))
    for p in tri(ch, 3): song.add('strings', song.bar(b), 3.95, p, 62 + i * 2)
    if i % 2 == 0: phrase(b, MH, 'piano', S_NAT, ch, 96, 0.95)     # Motiv im Klavier (Viertel)
    else: phrase(b, ANS, 'piano', S_NAT if ch != 'B' else S_HAR, ch, 92)
    if i >= 4: phrase(b, MH if i % 2 == 0 else ANS, 'voice', S_NAT if ch != 'B' else S_HAR, ch, 78, 1.0, 0)
fill(15)

# ---- 16–23 Classical (e-harmonisch Moll) ------------------------------------------------------
P_CLA = ['Em', 'Am', 'B', 'Em', 'C', 'Am', 'B', 'B']
crash(16, 104)
for i in range(8):
    b, ch = 16 + i, P_CLA[i]
    groove(b, 'classic', 1.0)
    bass_line(b, ch, 88, 'half', 'pizz', 2)
    for j in range(8):                                              # Cembalo-Achtel (Akkord-Arpeggio)
        t = tri(ch, 4); song.add('harpsi', song.bar(b) + j * .5, .4, [t[0], t[2], t[1] + 12, t[2]][j % 4], 70 + (8 if j % 4 == 0 else 0))
    for off in (0.5, 1.5, 2.5, 3.5):                                 # Streicher-Offbeats staccato
        for p in tri(ch, 3): song.add('strings', song.bar(b) + off, .3, p, 72)
    if i % 2 == 0: phrase(b, MRUN, 'violin', S_HAR, ch, 92, 0.9, 0)
    else: phrase(b, ANS, 'violin', S_HAR, ch, 90)
    song.add('timp', song.bar(b), .5, root(ch, 2), 84); song.add('timp', song.bar(b) + 2, .5, root(ch, 2), 80)
fill(23, True); snare_roll(22, 2, 4, 60, 100)

# ---- 24–31 Country (E-Dur) ---------------------------------------------------------------------
P_COU = ['E', 'E', 'A', 'A', 'E', 'B7', 'A', 'B7']
crash(24, 100)
for i in range(8):
    b, ch = 24 + i, P_COU[i]
    groove(b, 'country', 1.0)
    bass_line(b, ch, 90, 'walk', 'acbass', 2)
    t = tri(ch, 3); s = song.bar(b)
    song.add('guitar', s, .8, t[0] - 12 + 12, 92)                    # Boom
    for off in (1, 3):                                                # Chick
        for p in t: song.add('guitar', s + off, .45, p + 12 if p < 52 else p, 78)
    song.add('guitar', s + 2, .8, t[2] - 12 + 12, 88)
    for off in (1.5, 3.5):
        for p in t[1:]: song.add('guitar', s + off, .3, p + 12 if p < 52 else p, 66)
    if i % 2 == 0: phrase(b, M1, 'harmo', S_MAJ, ch, 96, 1.0)
    else: phrase(b, ANS, 'harmo', S_MAJ, ch, 92, 1.0)
    # Fiedel: Terz-Doppelgriffe auf 1 und 3
    for off in (2, 3):
        song.add('violin', s + off, .9, deg(S_MAJ, SHIFT[ch] + 2), 70)
fill(31)

# ---- 32–39 Grunge (Sludge) ---------------------------------------------------------------------
for i in range(8):
    b, ch = 32 + i, P_ROCK[i]
    groove(b, 'half', 1.0 + (0.03 if i >= 4 else 0))
    pm_riff(b, ch, 92, 'sludge')
    bass_line(b, ch, 100, 'half')
    song.add('organ', song.bar(b), 3.95, root(ch, 3) + 12, 60); song.add('organ', song.bar(b), 3.95, root(ch, 3) + 19, 56)
    if i % 2 == 0: phrase(b, M1, 'voice', S_NAT, ch, 96, 1.0)
    else: phrase(b, ANS, 'voice', S_NAT, ch, 90, 1.0)
    if i >= 4: phrase(b, M1 if i % 2 == 0 else ANS, 'lead', S_NAT, ch, 84, .94, 12)
crash(32, 116); crash(36, 110); fill(35); snare_roll(38, 0, 4, 60, 100); fill(39, True)

# ---- 40–47 Metal (e-phrygisch) -----------------------------------------------------------------
P_MET = ['Em', 'F', 'Em', 'D', 'C', 'D', 'F', 'Em']
crash(40, 118)
for i in range(8):
    b, ch = 40 + i, P_MET[i]
    groove(b, 'metal', 1.0 if i < 4 else 1.04)
    pm_riff(b, ch, 96, 'gallop')
    bass_line(b, ch, 100, 'gallop')
    song.add('timp', song.bar(b), 1.5, root(ch, 2), 88); song.add('timp', song.bar(b) + 2, 1.5, root(ch, 2), 88)
    sc = S_PHR
    if i % 2 == 0: phrase(b, MGAL, 'lead', sc, ch, 100, .94, 0)
    else: phrase(b, ANS, 'lead', sc, ch, 96, .94, 0)
    if i >= 4:
        phrase(b, MGAL if i % 2 == 0 else ANS, 'riff', sc, ch, 80, .94, 12)
crash(44, 112); fill(43); snare_roll(46, 0, 4, 70, 110); fill(47, True)

# ---- 48–55 Finale: alle Stile ---------------------------------------------------------------
P_FIN = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B']
crash(48, 120)
for i in range(8):
    b, ch = 48 + i, P_FIN[i]
    sc = S_NAT if ch != 'B' else S_HAR
    groove(b, 'metal2', 1.03)
    pm_riff(b, ch, 92, '8th')
    bass_line(b, ch, 102, '8th')
    for p in tri(ch, 3): song.add('strings', song.bar(b), 3.95, p, 84)
    for p in tri(ch, 4): song.add('choir', song.bar(b), 3.95, p, 80)
    t = tri(ch, 3)
    for j in range(8): song.add('piano', song.bar(b) + j * .5, .4, [t[0], t[2], t[1] + 12, t[2]][j % 4], 66)
    hi = MHI if i % 2 == 0 else ANS
    phrase(b, hi if i % 2 == 0 else ANS, 'lead', sc, ch, 100, .94, 0)
    phrase(b, M1 if i % 2 == 0 else ANS, 'violin', sc, ch, 88, .94, 12 if i % 2 == 0 else 0)
    phrase(b, M1 if i % 2 == 0 else ANS, 'harmo', sc, ch, 80, 1.0, 12)
    song.add('timp', song.bar(b), .5, root(ch, 2), 92); song.add('timp', song.bar(b) + 2, .5, root(ch, 2), 88)
crash(52, 112); fill(51); fill(55, True)

# ---- 56–63 Rückführung: Riff-Aufbau, Dominante ------------------------------------------------
P_RET = ['Em', 'C', 'Em', 'C', 'Em', 'G', 'B', 'B']
for i in range(8):
    b, ch = 56 + i, P_RET[i]
    if i < 6: groove(b, 'rock', 1.04)
    else: snare_roll(b, 0, 4, 60 + (i - 6) * 20, 96 + (i - 6) * 20)
    pm_riff(b, ch, 88 + i * 2, '8th')
    bass_line(b, ch, 96 + i, '8th')
    for p in tri(ch, 3): song.add('strings', song.bar(b), 3.95, p, 66 + i * 4)
    if i in (0, 2, 4): phrase(b, M1, 'lead', S_NAT, ch, 96)
    if i in (1, 3, 5): phrase(b, ANS, 'lead', S_NAT, ch, 92)
    if i == 6: phrase(b, M1, 'lead', S_HAR, ch, 100)
    if i == 7: phrase(b, [(0, .25, 0), (.25, .25, 2), (.5, .25, 3), (.75, .25, 4), (1, 3, 4)], 'lead', S_HAR, ch, 104)
crash(56, 112); fill(59); fill(63, True)

sf2, out = cli_paths('bgm_theme_harpyformers.ogg')
song.render(sf2, out)
