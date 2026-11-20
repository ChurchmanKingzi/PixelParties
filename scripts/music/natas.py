# -*- coding: utf-8 -*-
"""Held-Thema „Natas, the Master of Hell“ → public/music/bgm_natas.ogg                      Titel: „Hospitality of the Pit“

Natas ist *der* bösartigste Charakter des Spiels, die Graue Eminenz hinter den allermeisten Problemen der Lore (Card Art: Herr im Anzug mit Augenklappe vor einem leuchtenden Turm,
rechts und links lavaglühende Dämonenstatuen). Das Theme drückt **unterschwellige Bösartigkeit** aus und soll **Angst einflößen**.

Version 2 (v1 war dem Nutzer zu wenig Battle und zu unmelodisch): ein richtiges, treibendes Schurken-Battle-Theme mit **einprägsamer Hauptmelodie** — der Schrecken bleibt, aber er marschiert jetzt.

  • F-Moll, 132 BPM, 4/4. **Riff**: das Dies-irae-angelehnte Motiv (F–E–F–C–D♭–C–B♭–C) als durchgehende **Achtel-Kette** in Kontrabass, Tuba und Posaune, jeden Takt auf den Akkordgrundton
    versetzt (F, G♭, D♭, E♭, C) — ein unerbittlicher, schleichender Antrieb, den man als Melodie kaum erkennt, aber im Bauch spürt. Darüber das kalte Cembalo-**Uhrwerk** in 16teln.
  • **Hauptmelodie** (Moll-Dreiklangs-Aufstieg F–As–C, Fall zurück; ♭II-Wendung): erst von der gedämpften Trompete (sly, höflich), dann groß in Orgel, Posaune, Chor, Horn und Geigen.
  • **Schlagzeug**: echter Battle-Beat (Kick 1, 1&-Sechzehntel, 3, 3&; Snare auf 2 und 4; Hi-Hat-16tel), Tom-Fills, Crashes; im Break Halbzeit.
  • **Der Pakt**: das Pedal F bleibt, alles darüber steigt halbtonweise (F-, Ges-, G-, As-Moll). Danach Schluss-Refrain mit allem.
Form (64 Takte ≈ 1:56): Intro 4 · Riff A 8 · Thema B 8 · Audienz C 8 · Thema D 8 · Signatur 8 · Der Pakt E 8 · Finale 8 · Coda 4
Ausklang auf C (Dominante) → F-Moll-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 132, 64
song = Song(BPM, BARS)
rng = random.Random(666)

song.inst('organ', 'pipeorgan', vol=78, pan=64)
song.inst('choir', 'choir', vol=76, pan=60)
song.inst('oohs', 'oohs', vol=60, pan=84)
song.inst('trombone', 'trombone', vol=86, pan=42)
song.inst('tuba', 'tuba', vol=92, pan=58)
song.inst('horn', 'horns', vol=72, pan=76)
song.inst('bass', 'contra', vol=104, pan=62)
song.inst('timp', 'timp', vol=104, pan=64)
song.inst('tremolo', 'tremolo', vol=58, pan=46)
song.inst('harpsi', 'harpsichord', vol=80, pan=32)      # Uhrwerk
song.inst('bell', 'bell', vol=72, pan=70)
song.inst('goblins', 'goblins', vol=54, pan=90)
song.inst('bowed', 'bowed', vol=58, pan=24)
song.inst('violin', 'violin', vol=62, pan=80)
song.inst('muted', 'muted', vol=84, pan=52)             # der Gastgeber

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Fm': (5, 'm'), 'Eb': (3, 'M'), 'Gb': (6, 'M'), 'Bbm': (10, 'm'), 'C': (0, 'M'), 'Db': (1, 'M'), 'C7': (0, '7')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=88, octave=0, legato=.95):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# Pitch-Bend (±12 Halbtöne)
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))
for _n in ('goblins', 'violin', 'trombone'): bend_setup(_n)

def glide(name, beat, dur, pitch, vel, lo, hi, steps=16):
    ch = song.ch[name][0]
    song.add(name, beat, dur + 0.2, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.25) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (F-Moll) ═════════════════════════════════════════════════════════════════════════════
A_CH = ['Fm', 'Fm', 'Gb', 'Fm', 'Fm', 'Gb', 'Bbm', 'C']
# Dies-irae-Motiv (angelehnt), je Note eine Zählzeitlänge n: F E F C Db C Bb C
DIES = ['F', 'E', 'F', 'C', 'Db', 'C', 'Bb', 'C']
DIES_OCT = [4, 4, 4, 4, 4, 4, 3, 4]

B_CH = ['Fm', 'Db', 'Bbm', 'C7', 'Fm', 'Db', 'Gb', 'C7']
HOST = [
    [('F5', 1.5), ('Eb5', .5), ('C5', 1), ('Db5', 1)],
    [('C5', 1), ('Db5', .5), ('F5', .5), ('Ab5', 2)],
    [('Bb4', 1.5), ('Db5', .5), ('F5', 1), ('E5', 1)],
    [('G5', 2), ('E5', 1), ('C5', 1)],
    [('F5', 1.5), ('Eb5', .5), ('C5', 1), ('Db5', 1)],
    [('Ab5', 1), ('F5', 1), ('Db5', 1), ('C5', 1)],
    [('Gb5', 1), ('Ab5', 1), ('Bb5', 1), ('B5', 1)],
    [('C6', 2), ('G5', 1), ('E5', 1)],
]

C_CH = ['Fm', 'Gb', 'Fm', 'Db', 'Bbm', 'Gb', 'C', 'C']
BREAK_CH = ['Fm', 'Fm', 'Gb', 'Gb', 'Bbm', 'Bbm', 'C', 'C']

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
F1 = 29                                                    # F1 (MIDI)
def root_midi(ch, shift=0, oct_=0):
    r = (CH[ch][0] + shift) % 12 + 12 * 2
    while r < 28: r += 12
    return r + 12 * oct_

def pedal(bar0, nbars, vel=70, fixed=True, chords=None, shift=0):
    """Pedalton: Orgel, Tuba, Kontrabass auf F (bleibt) bzw. dem Akkordgrundton."""
    for k in range(nbars):
        r = F1 if fixed else root_midi(chords[k], shift)
        if r < 28: r += 12
        t = song.bar(bar0 + k)
        song.add('organ', t, 3.95, r, vel); song.add('organ', t, 3.95, r + 12, vel - 14); song.add('organ', t, 3.95, r + 19, vel - 22)
        song.add('tuba', t, 3.95, r, vel + 6); song.add('bass', t, 3.95, r, vel + 8)

def clockwork(bar0, chords, shift=0, vel=58, roots_fixed=False):
    """Uhrwerk: Cembalo-16tel über Grundton (Quinte, Oktave, kleine Sekunde, Tritonus) — präzise, kalt."""
    P = (0, 7, 12, 7, 0, 6, 12, 6, 1, 7, 13, 7, 0, 7, 12, 7)
    for k, ch in enumerate(chords):
        r = root_midi(ch, shift, 2)
        t = song.bar(bar0 + k)
        for i, off in enumerate(P):
            song.add('harpsi', t + i * 0.25, 0.14, r + off, hv(vel + (14 if i % 4 == 0 else (4 if i % 2 == 0 else -4))))

def dies_hidden(bar0, vel=34, inst='choir', octave=-1, per_note=4.0, shift=0):
    """Das verborgene Zitat: je Note ein ganzer Takt, tief, leise."""
    for i, (n, o) in enumerate(zip(DIES, DIES_OCT)):
        song.add(inst, song.bar(bar0) + i * per_note, per_note - 0.1, pn(n + str(o)) + 12 * (octave + 1) + shift, hv(vel))

def dies_open(bar0, shift=0, vel=96):
    """Das offene Zitat: je Note 2 Schläge, vier Takte lang, zweimal — Orgel, Posaune, Chor, Horn."""
    for rep in range(2):
        for i, (n, o) in enumerate(zip(DIES, DIES_OCT)):
            t = song.bar(bar0 + 4 * rep) + i * 2.0
            p = pn(n + str(o)) + shift
            for inst, off, v in (('organ', -12, vel - 10), ('trombone', -12, vel), ('choir', 0, vel - 8), ('horn', 12, vel - 18), ('tuba', -24, vel)):
                song.add(inst, t, 1.9, p + off, hv(v))

def whispers(bar0, nbars, vel=32):
    for k in range(nbars):
        t = song.bar(bar0 + k) + rng.choice((0, 1, 2))
        base = rng.choice((pn('F3'), pn('C4'), pn('Ab3')))
        for iv in (0, 1, 6):
            song.add('choir', t, 1.6 + rng.random() * 1.2, base + iv, vel + rng.randint(-4, 4))

def tolls(bar0, nbars, every=4, vel=70, shift=0):
    for k in range(0, nbars, every):
        song.add('bell', song.bar(bar0 + k), 3.9, pn('F4') + shift, vel)
        song.add('bell', song.bar(bar0 + k), 3.9, pn('B4') + shift, vel - 14)

def heartbeat(bar0, nbars, vel=52):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.4, pn('F2') + 12, vel); song.add('timp', t + 0.5, 0.4, pn('F2') + 12, vel - 14)
        if k % 2: song.add('timp', t + 2, 0.4, pn('F2') + 12, vel - 6); song.add('timp', t + 2.5, 0.4, pn('F2') + 12, vel - 20)

def glass(bar0, nbars, vel=28, shift=0):
    for k in range(nbars):
        song.add('bowed', song.bar(bar0 + k), 3.95, pn('B5') + shift, vel)
        song.add('bowed', song.bar(bar0 + k), 3.95, pn('F5') + shift, vel - 2)

def tremolo_pad(bar0, chords, shift=0, vel=46):
    for k, ch in enumerate(chords):
        for m in tones(ch, 3, shift): song.add('tremolo', song.bar(bar0 + k), 3.95, m, vel)

def drums(bar0, nbars, level=1.0, style='half', fills=False, crash=True):
    """half: Kick 1, Snare 3 (schwer, Halbzeit), kaum hörbare Hi-Hat-Sechzehntel · heavy: mit Kick 3&, Toms, Crash."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        song.dr(t, KICK, int(104 * L), 0.25); song.dr(t + 2, SNARE, int(110 * L), 0.2)
        song.dr(t + 2, TOM_L, int(86 * L), 0.2)
        if style == 'heavy':
            song.dr(t + 1.5, KICK, int(86 * L), 0.15); song.dr(t + 3.5, KICK, int(88 * L), 0.15); song.dr(t + 3, TOM_M, int(84 * L), 0.15)
        for i in range(16): song.dr(t + i * 0.25, HAT, int((60 if i % 4 == 0 else (46 if i % 2 == 0 else 36)) * L), 0.05)
        if k == 0 and crash: song.dr(t, CRASH, int(100 * L), 2.4)
        if fills and k % 4 == 3:
            for j in range(4): song.dr(t + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_L, TOM_L)[j], int((78 + 6 * j) * L), 0.15)

def roll(bar0, start, end, v0=40, v1=118):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=112):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def sighs(bar0, nbars, vel=44):
    """Goblin-Seufzer und Geigenglissandi (leise): etwas atmet im Dunkeln."""
    for k in range(0, nbars, 2):
        t = song.bar(bar0 + k) + rng.choice((0.0, 1.0, 2.0))
        glide('goblins', t, 3.0, pn('C5') + rng.choice((0, 1, 6)), vel, 3.0, -4.0, steps=12)
        if k % 4 == 2: glide('violin', song.bar(bar0 + k) + 1.0, 3.0, pn('F5'), vel + 6, 0.0, -1.5, steps=12)


# ═══ Version 2: Hauptmelodie, Riff, Battle-Beat ══════════════════════════════════════════════════
THEME_CH = ['Fm', 'Fm', 'Db', 'Eb', 'Fm', 'Fm', 'Gb', 'C']
THEME = [
    [('F5', 1), ('F5', .5), ('Ab5', .5), ('C6', 2)],
    [('Bb5', 1), ('Ab5', .5), ('G5', .5), ('F5', 2)],
    [('Db6', 1), ('C6', .5), ('Bb5', .5), ('Ab5', 2)],
    [('G5', 1), ('Bb5', 1), ('Eb6', 2)],
    [('F5', 1), ('F5', .5), ('Ab5', .5), ('C6', 2)],
    [('Eb6', 1), ('Db6', .5), ('C6', .5), ('Bb5', 2)],
    [('Bb5', 1), ('Db6', 1), ('Gb6', 2)],
    [('C6', 1), ('B5', 1), ('C6', 2)],
]
THEME_CLOSED = THEME[:7] + [[('C6', 1), ('A5', 1), ('F5', 2)]]
CH_OFF = {'Fm': 0, 'Gb': 1, 'Db': -4, 'Eb': -2, 'C': -5, 'Bbm': -7, 'C7': -5}
DIES_OFF = [0, -1, 0, -5, -4, -5, -7, -5]

def riff(bar0, chords, shift=0, vel=96, voices=('bass', 'tuba', 'trombone')):
    """Dies-irae-Riff in durchgehenden Achteln, pro Takt auf den Akkordgrundton versetzt."""
    for k, ch in enumerate(chords):
        t = song.bar(bar0 + k)
        base = 41 + CH_OFF[ch] + shift                       # F2 + Versatz
        for i, off in enumerate(DIES_OFF):
            for v in voices:
                p = base + off + (12 if v == 'trombone' else 0)
                song.add(v, t + i * 0.5, 0.45, p, hv(vel + (12 if i in (0, 4) else 0) - (10 if v == 'trombone' else 0)))

def chops(bar0, chords, shift=0, vel=62):
    """Streicher-Chops: kurze Sechzehntel auf Grundton/Quinte (Violine) — Antrieb."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        t = song.bar(bar0 + k)
        for i in range(16):
            song.add('violin', t + i * 0.25, 0.12, (T[0], T[2], T[0] + 12, T[2])[i % 4], hv(vel + (12 if i % 4 == 0 else 0)))

def battle_drums(bar0, nbars, level=1.0, crash=True):
    """Kick auf 1, 1&-Sechzehntel, 3, 3&; Snare 2/4; Hi-Hat-Sechzehntel; Tom-Fill im 4. Takt; Crash zu Beginn."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        for pos, v in ((0, 110), (3, 90), (8, 106), (10, 92)): song.dr(t + pos * 0.25, KICK, int(v * L), 0.15)
        for beat in (1, 3): song.dr(t + beat, SNARE, int(110 * L), 0.15)
        for i in range(16): song.dr(t + i * 0.25, HAT, int((98 if i % 4 == 0 else (80 if i % 2 == 0 else 60)) * L), 0.05)
        if k == 0 and crash: song.dr(t, CRASH, int(108 * L), 2.0)
        if k % 4 == 3:
            for j in range(6): song.dr(t + 2.5 + j * 0.25, (TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L)[j], int((86 + 5 * j) * L), 0.12)

def half_drums(bar0, nbars, level=1.0):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.dr(t, KICK, int(106 * level), 0.2); song.dr(t + 2, SNARE, int(112 * level), 0.2); song.dr(t + 3.5, KICK, int(90 * level), 0.15)
        for i in range(8): song.dr(t + i * 0.5, HAT, int((84 if i % 2 == 0 else 62) * level), 0.06)
        if k % 2 == 0: song.dr(t, CRASH, int(96 * level), 1.6)

def timp8(bar0, chords, shift=0, vel=100):
    """Pauken-Achtel auf dem Grundton (Betonung 1 und 3)."""
    for k, ch in enumerate(chords):
        r = 41 + CH_OFF[ch] + shift + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        for i in range(8): song.add('timp', t + i * 0.5, 0.4, r, hv(vel - (0 if i in (0, 4) else 24)))

def big_theme(bar0, chords, melody, shift=0, vel=100, trumpet=False, strings=True):
    for inst, o, v in (('organ', 0, vel - 18), ('trombone', 0, vel - 6), ('choir', 0, vel - 10), ('horn', 0, vel - 20)):
        mel(inst, bar0, melody, shift=shift, vel=v, octave=o)
    if strings: mel('violin', bar0, melody, shift=shift, vel=vel - 24, octave=0)
    if trumpet: mel('muted', bar0, melody, shift=shift, vel=vel - 14, octave=0)
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        for m in T: song.add('organ', song.bar(bar0 + k), 3.95, m, 56)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Pedal, Herzschlag, Uhrwerk-Ticks, Pauken-Wirbel; im letzten Takt der erste Schlag und das Riff beginnt ───
pedal(b, 4, vel=56)
heartbeat(b, 4, vel=52)
glass(b, 4, vel=26)
whispers(b, 4, vel=26)
tolls(b, 1, vel=64)
clockwork(b + 1, ['Fm'] * 3, vel=50)
timp_roll(song.bar(b + 2), 8.0, pn('F2') + 12, 36, 112)
roll(b + 3, 0, 4, 40, 118)
song.dr(song.bar(b + 3) + 3.5, CRASH, 84, 0.6)
b += 4

# ── Riff A (8): Dies-irae-Achtel-Riff, Uhrwerk, harter Beat; die Melodie kündigt sich sly in der gedämpften Trompete an ─
riff(b, THEME_CH)
clockwork(b, THEME_CH, vel=62)
mel('muted', b, THEME, vel=80, legato=.9)
pedal(b, 8, vel=62, fixed=False, chords=THEME_CH)
tremolo_pad(b, THEME_CH, vel=34)
glass(b, 8, vel=28)
timp8(b, THEME_CH, vel=86)
battle_drums(b, 8, level=1.0)
tolls(b, 8, every=4, vel=62)
whispers(b, 8, vel=28)
b += 8

# ── Thema B (8): die Hauptmelodie groß — Orgel, Posaune, Chor, Horn, Geigen; Riff und Beat darunter ───────────────────
big_theme(b, THEME_CH, THEME, vel=100)
riff(b, THEME_CH, vel=98)
clockwork(b, THEME_CH, vel=60)
chops(b, THEME_CH, vel=56)
pedal(b, 8, vel=70, fixed=False, chords=THEME_CH)
timp8(b, THEME_CH, vel=100)
battle_drums(b, 8, level=1.1)
glass(b, 8, vel=34)
tolls(b, 8, every=2, vel=70)
b += 8

# ── Audienz C (8): der Gastgeber — gedämpfte Trompete (neue, höfliche Linie) über Riff und Uhrwerk, Beat bleibt ─────
mel('muted', b, HOST, vel=84, legato=.9)
for k, ch in enumerate(B_CH):
    for m in tones(ch, 3): song.add('organ', song.bar(b + k), 3.95, m, 46)
    song.add('oohs', song.bar(b + k), 3.95, tones(ch, 4)[2], 44)
riff(b, [c if c != 'C7' else 'C' for c in B_CH], vel=88)
clockwork(b, B_CH, vel=58)
pedal(b, 8, vel=60)
chops(b, [c if c != 'C7' else 'C' for c in B_CH], vel=46)
tremolo_pad(b, B_CH, vel=38)
glass(b, 8, vel=30)
timp8(b, [c if c != 'C7' else 'C' for c in B_CH], vel=84)
battle_drums(b, 8, level=0.95)
whispers(b, 8, vel=30)
for k in (3, 7):
    glide('goblins', song.bar(b + k) + 2.0, 2.0, pn('C5'), 46, 2.0, -3.0)
roll(b + 7, 2, 4, 44, 108)
b += 8

# ── Thema D (8): Hauptmelodie noch größer — Trompete obendrauf; das Dies-irae-Zitat offen in Horn und Orgel (Gegenstimme) ─
big_theme(b, THEME_CH, THEME, vel=104, trumpet=True)
riff(b, THEME_CH, vel=102)
clockwork(b, THEME_CH, vel=62)
chops(b, THEME_CH, vel=60)
pedal(b, 8, vel=72, fixed=False, chords=THEME_CH)
timp8(b, THEME_CH, vel=104)
battle_drums(b, 8, level=1.15)
tolls(b, 8, every=2, vel=74)
glass(b, 8, vel=36)
for k in (1, 5): glide('goblins', song.bar(b + k), 3.0, pn('C5'), 46, 3.0, -4.0)
b += 8

# ── Signatur (8): Halbzeit — Uhrwerk, Pedal, gesprochene Chor-Silben (der Meister spricht), Cluster wächst; am Ende Wirbel ──
pedal(b, 8, vel=64)
clockwork(b, BREAK_CH, vel=56)
for k, ch in enumerate(BREAK_CH):
    t = song.bar(b + k)
    r = root_midi(ch, oct_=1)
    for pos in (0.0, 1.5, 2.0, 3.25): song.add('choir', t + pos, 0.25, r + 12, hv(62 + 3 * k))
    for iv in (0, 1, 6): song.add('tremolo', t, 3.95, r + 24 + iv, 36 + 5 * k)
    song.add('timp', t, 1.2, r + 12 if r + 12 <= 55 else r, 90)
half_drums(b, 8, level=1.0)
glass(b, 8, vel=38)
tolls(b, 8, every=2, vel=68)
whispers(b, 8, vel=36)
glide('goblins', song.bar(b + 4), 7.5, pn('C5'), 52, -6.0, 6.0, steps=32)
timp_roll(song.bar(b + 6), 8.0, pn('F2') + 12, 36, 118)
roll(b + 7, 0, 4, 40, 126)
b += 8

# ── Der Pakt E (8): Pedal F bleibt, die Melodie und alles darüber steigt halbtonweise (F-, Ges-, G-, As-Moll) ───────────
pedal(b, 8, vel=78)
battle_drums(b, 8, level=1.15)
for blk in range(4):
    sh = blk
    bb = b + 2 * blk
    seg_ch = THEME_CH[2 * blk:2 * blk + 2]
    seg_mel = THEME[2 * blk:2 * blk + 2]
    big_theme(bb, seg_ch, seg_mel, shift=sh, vel=106, trumpet=True)
    riff(bb, ['Fm', 'Fm'], vel=104)                              # das Riff bleibt auf F (der Boden)
    clockwork(bb, ['Fm', 'Fm'], vel=62)
    chops(bb, ['Fm', 'Fm'], vel=60)
    timp8(bb, ['Fm', 'Fm'], vel=106)
glass(b, 8, vel=42)
tolls(b, 8, every=2, vel=78)
whispers(b, 8, vel=38)
for k in (3, 7): song.dr(song.bar(b + k), CRASH, 90, 1.6)
roll(b + 7, 2, 4, 56, 126)
b += 8

# ── Finale (8): alles, zurück in F-Moll — die Melodie geschlossen (endet auf F), Beat voll ───────────────────────────
big_theme(b, THEME_CH, THEME_CLOSED, vel=108, trumpet=True)
riff(b, THEME_CH, vel=106)
clockwork(b, THEME_CH, vel=64)
chops(b, THEME_CH, vel=62)
pedal(b, 8, vel=76, fixed=False, chords=THEME_CH)
timp8(b, THEME_CH, vel=108)
battle_drums(b, 8, level=1.18)
tolls(b, 8, every=2, vel=76)
glass(b, 8, vel=40)
b += 8

# ── Coda (4): C (Dominante zur F-Moll-Intro) — das Riff ein letztes Mal auf C, dann nur Pedal und ein Tritonus-Schlag ────
riff(b, ['C', 'C'], vel=100)
for k in range(3):
    for m in (pn('C2'), pn('C3'), pn('G3')): song.add('organ', song.bar(b + k), 3.95, m, 72 - 6 * k)
battle_drums(b, 2, level=1.0, crash=True)
clockwork(b, ['C', 'C'], vel=50)
heartbeat(b + 2, 1, vel=70)
tolls(b + 2, 1, vel=78)
timp_roll(song.bar(b + 3), 4.0, pn('C2') + 12, 40, 104)
glass(b, 3, vel=32)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('NATAS_NORENDER') != '1':
    sf2, out = cli_paths('bgm_natas.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.1)
