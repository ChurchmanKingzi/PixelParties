# -*- coding: utf-8 -*-
"""Held-Thema „???, the Shapeshifter“ → public/music/bgm_shapeshifter.ogg            Titel: „A Thousand Borrowed Faces“

Eine Eldritch-Horror-Entität, die die Identität anderer annimmt und Chaos in die Welt bringt (Card Art: weißes, tentakelartiges Gespinst
um eine dunkle Gestalt in einer Holzkiste-Halle). Bedrohung als tiefes Grauen — aber ein loopendes Battle-Theme.

  • 5/4 (3+2) bei 144 BPM, Grundton H (B), Pedalton + Tritonus/Halbton-Cluster, Skalen ohne Ruhepunkt. Ein Mars-artiger 8tel-Puls
    (Kontrabass, Pizzicato, tiefe Toms/Kick auf 1 und 4, Snare auf 4) hält den Kampf in Gang; der ungerade Takt lässt nie
    „zu Hause“ ankommen.
  • Das Thema ist ein **kindliches Wiegenlied** (H–D–E–D–H), und es wird **nachgeäfft**: erst fehlerfrei in der Kalimba (Spieluhr),
    dann von der Geige falsch nachgespielt, dann vom Chor mit Gleitern (Portamento) verschmiert, schließlich von allem gleichzeitig,
    jedes Mal mit mehr falschen Intervallen (Halbton, Tritonus, große Septime) und verstimmt (Pitch-Bend-Offset). Das ist das
    Gestaltwandeln: dieselbe Melodie, jede Stimme eine andere „Identität“, immer weniger menschlich.
  • Kalter Grusel: Orgel-Cluster (H–C–Fis), Streicher-Tremolo, hoher Glas-Pad („bowed“), Gob­lins-Synth-Schreie, geflüsterte Chor-Cluster,
    Glocken-Läuten, Posaune/Tuba mit schleppenden Glissandi, Herzschlag-Pauke. Der „Abgrund“-Break zieht alles Rhythmische ab, dann bricht
    die Identität auseinander (Thema in allen Stimmen, ganze Takte steigen halbtonweise).
Form (52 Takte ≈ 1:48): Intro 4 · Nachäffen I 8 · Nachäffen II 8 · Das Gesicht rutscht 8 · Abgrund 8 · Identität verloren 8 · Reprise 8
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 52
song = Song(BPM, BARS, beats_per_bar=5)
rng = random.Random(1313)

song.inst('kalimba', 'kalimba', vol=94, pan=52)
song.inst('violin', 'violin', vol=88, pan=76)
song.inst('choir', 'choir', vol=70, pan=64)             # nur Gleiter (Portamento)
song.inst('oohs', 'oohs', vol=64, pan=40)               # statische Pads, geflüsterte Cluster
song.inst('goblins', 'goblins', vol=62, pan=88)
song.inst('bowed', 'bowed', vol=60, pan=32)
song.inst('trombone', 'trombone', vol=84, pan=60)
song.inst('tuba', 'tuba', vol=92, pan=58)
song.inst('organ', 'pipeorgan', vol=70, pan=64)
song.inst('tremolo', 'tremolo', vol=72, pan=44)
song.inst('pizz', 'pizz', vol=84, pan=84)
song.inst('bass', 'contra', vol=100, pan=60)
song.inst('bell', 'bell', vol=70, pan=68)
song.inst('timp', 'timp', vol=100, pan=64)

B1 = 35
# Grundton je Takt (Halbtöne über H1): H H C H | Fis Fis C H — Halbton und Tritonus statt Quinte
ROOTS = [0, 0, 1, 0, 6, 6, 1, 0]
CLUSTER = {'dim': (0, 3, 6), 'tri': (0, 6, 7), 'cl': (0, 1, 6)}
KINDS = ['dim', 'dim', 'cl', 'dim', 'tri', 'tri', 'cl', 'cl']

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

# ── Pitch-Bend (±12 Halbtöne per RPN) ───────────────────────────────────────────────────────────
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))

for _n in ('choir', 'oohs', 'trombone', 'tuba', 'goblins', 'kalimba', 'violin', 'bowed'):
    bend_setup(_n)

def bend(name, beat, semis):
    ch = song.ch[name][0]
    v = int(max(-8192, min(8191, semis / 12.0 * 8192)))
    song.ev.append((int(round(beat * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=v)))

def glide(name, beat, dur, pitch, vel, from_semis, to_semis=0.0, take=0.6, steps=8):
    """Eine Note, deren Tonhöhe von `from_semis` zu `to_semis` (Halbtöne) gleitet; danach Pitch-Bend zurück auf 0."""
    song.add(name, beat, dur, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        bend(name, beat + take * f, from_semis + (to_semis - from_semis) * f)
    bend(name, beat + dur + 0.03, 0.0)

# ═══ Thema (relativ zu H4 = 71) ════════════════════════════════════════════════════════════════════
BASE = [
    [(0, 1), (3, 1), (5, 1), (3, 1), (0, 1)],
    [(-2, 1), (-4, 1), (-5, 1), (-7, 1), (-6, 1)],
    [(0, 1), (3, 1), (5, 1), (3, 1), (0, 1)],
    [(-2, 1), (-4, 1), (-6, 1), (-5, 1), (-6, 1)],
    [(5, 1), (8, 1), (10, 1), (8, 1), (5, 1)],
    [(3, 1), (1, 1), (0, 1), (-1, 1), (-2, 1)],
    [(6, 2), (5, 1), (4, 1), (0, 1)],
    [(0, 5)],
]

def warp(level, seed):
    """Entstellt das Thema: je höher `level`, desto mehr Töne um Halbton/Tritonus/Septime versetzt."""
    r = random.Random(seed)
    p = (0.0, 0.25, 0.5, 0.8)[level]
    jumps = {1: (1, -1), 2: (1, -1, 6, -6), 3: (1, -1, 6, -6, 11, -11)}.get(level, (0,))
    out = []
    for bar in BASE:
        nb = []
        for k, (n, d) in enumerate(bar):
            if (bar is BASE[0] and k == 0) or r.random() >= p: nb.append((n, d))
            else: nb.append((n + r.choice(jumps), d))
        out.append(nb)
    return out

def theme(inst, bar0, level, shift=0, vel=84, octave=0, detune=0.0, seed=1, legato=.92, portamento=False, bars=range(8)):
    th = warp(level, seed)
    prev = None
    if detune: bend(inst, song.bar(bar0), detune)
    for k in bars:
        t = song.bar(bar0 + k)
        for n, d in th[k]:
            p = 71 + n + shift + 12 * octave
            if portamento and prev is not None and prev != p:
                glide(inst, t, d * legato, p, hv(vel), (prev - p) * 0.9, 0.0, take=0.45)
            else:
                song.add(inst, t, max(0.1, d * legato), p, hv(vel))
            prev = p
            t += d
    if detune: bend(inst, song.bar(bar0 + max(bars)) + 5.0, 0.0)

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root(k, shift=0, oct_=0):
    return B1 + ROOTS[k % 8] + shift + 12 * oct_

def pedal(bar0, nbars, shift=0, vel=70):
    for k in range(nbars):
        r = root(k, shift)
        song.add('organ', song.bar(bar0 + k), 4.95, r, vel)
        song.add('organ', song.bar(bar0 + k), 4.95, r + 12, vel - 12)
        song.add('tuba', song.bar(bar0 + k), 4.95, r, vel + 6)

def cluster(bar0, nbars, shift=0, vel=56, inst='organ', oct_=2):
    for k in range(nbars):
        for iv in CLUSTER[KINDS[k % 8]]:
            song.add(inst, song.bar(bar0 + k), 4.95, root(k, shift, oct_) + iv, vel)

def tremolo_pad(bar0, nbars, shift=0, vel=56):
    for k in range(nbars):
        for iv in CLUSTER[KINDS[k % 8]]:
            song.add('tremolo', song.bar(bar0 + k), 4.95, root(k, shift, 2) + iv, vel)

def ostinato(bar0, nbars, shift=0, vel=96, pizz_on=True):
    """Mars-Puls in Achteln: Kontrabass pumpt den Grundton, Betonung auf 1 und 4 (3+2), Pizzicato umkreist ihn chromatisch."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = root(k, shift, 1)
        for i in range(10):
            acc = i in (0, 6)
            song.add('bass', t + i * 0.5, 0.42, r + (1 if i in (3, 8) else 0), hv(vel + (12 if acc else (-6 if i % 2 else 0))))
            if pizz_on:
                pit = r + 24 + (0, 1, 0, 6, 0, 1, 0, 1, 6, 0)[i]
                song.add('pizz', t + i * 0.5, 0.2, pit, hv(60 + (14 if acc else 0)))

def timp_beat(bar0, nbars, shift=0, vel=96):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = root(k, shift, 1)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 3, 0.8, r, hv(vel - 4))
        song.add('timp', t + 4.5, 0.4, r, hv(vel - 26))

def heartbeat(bar0, nbars, vel=70, every=1):
    """Lub-dub: zwei Pauken-Schläge im Abstand einer halben Zählzeit."""
    for k in range(0, nbars, every):
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.5, B1 + 12 + ROOTS[k % 8], vel); song.add('timp', t + 0.5, 0.5, B1 + 12 + ROOTS[k % 8], vel - 14)

def drums(bar0, nbars, level=1.0, style='tribal', crash=True):
    """5/4 als 3+2: Kick auf 1 und 4, Snare auf 4, tiefe Toms auf den übrigen Zählzeiten; heavy: Hi-Hat-Achtel + Doppel-Kick."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        song.dr(t, KICK, int(108 * L), 0.2); song.dr(t, TOM_L, int(96 * L), 0.2)
        song.dr(t + 1, TOM_L, int(76 * L), 0.15); song.dr(t + 2, TOM_L, int(82 * L), 0.15)
        song.dr(t + 3, KICK, int(106 * L), 0.2); song.dr(t + 3, SNARE, int(108 * L), 0.15)
        song.dr(t + 4, TOM_M, int(88 * L), 0.15)
        if style == 'heavy':
            for i in range(10): song.dr(t + i * 0.5, HAT, int((96 if i in (0, 6) else 74) * L), 0.06)
            song.dr(t + 2.5, KICK, int(84 * L), 0.15); song.dr(t + 4.5, SNARE, int(70 * L), 0.1)
        if k == 0 and crash: song.dr(t, CRASH, int(108 * L), 1.8)
        if k % 4 == 3:
            for j in range(5): song.dr(t + 3.0 + j * 0.4, (TOM_H, TOM_M, TOM_L, TOM_L, TOM_L)[j], int((84 + 6 * j) * L), 0.12)

def roll(bar0, start, end, v0=44, v1=122):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=40, v1=112):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def bell_toll(bar0, nbars, every=2, vel=72):
    for k in range(0, nbars, every):
        t = song.bar(bar0 + k)
        song.add('bell', t, 4.5, B1 + 24 + ROOTS[k % 8], vel)
        song.add('bell', t, 4.5, B1 + 24 + ROOTS[k % 8] + 6, vel - 18)

def whispers(bar0, nbars, vel=34):
    """Geflüsterte Chor-Cluster (zufällig, sehr leise)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(3):
            base = rng.randint(70, 86)
            for iv in (0, 1, 6):
                song.add('oohs', t + rng.choice((0, 1, 2, 3)) + rng.random() * 0.8, 1.0 + rng.random(), base + iv, vel + rng.randint(-6, 6))

def scream(beat, shift=0, vel=96, dur=1.2):
    """Chor-/Goblin-Aufschrei: Halbton-Cluster, hoch, gleitet von unten an."""
    for iv in (0, 1, 6, 7):
        glide('choir', beat, dur, 84 + iv + shift, vel, -3.0, 0.0, take=0.3)
    glide('goblins', beat, dur, 96 + shift, vel - 12, -6.0, 0.0, take=0.35)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Pedal, Glas-Pad, Geflüster, Herzschlag, aufsteigender Goblin-Schrei, Wirbel ───────────────
pedal(b, 4, vel=56)
for iv in (0, 1, 6): song.add('bowed', song.bar(b), 19.8, 83 + iv, 40)
whispers(b, 4, vel=30)
heartbeat(b, 4, vel=64)
for k in (1, 3): bell_toll(b + k, 1, vel=60)
glide('goblins', song.bar(b + 2), 9.0, 91, 54, -12.0, 0.0, take=8.5, steps=24)
glide('trombone', song.bar(b + 1), 9.5, B1 + 25, 56, -6.0, 6.0, take=9.0, steps=24)
roll(b + 3, 1, 5, 40, 120)
timp_roll(song.bar(b + 3) + 2, 3.0, B1 + 12, 40, 108)
b += 4

# ── Nachäffen I (8): Kalimba spielt das Wiegenlied fehlerfrei; Puls und tribale Trommeln darunter ───────────
theme('kalimba', b, 0, vel=84, legato=.95)
ostinato(b, 8)
tremolo_pad(b, 8, vel=46)
pedal(b, 8, vel=48)
bell_toll(b, 8)
timp_beat(b, 8)
drums(b, 8, level=0.95)
b += 8

# ── Nachäffen II (8): die Geige äfft nach — mit einem falschen Ton; die Kalimba spielt weiter, fehlerfrei ───
theme('kalimba', b, 0, vel=70, legato=.95)
theme('violin', b, 1, vel=88, seed=3, legato=.97)
ostinato(b, 8)
tremolo_pad(b, 8, vel=52)
pedal(b, 8, vel=54)
cluster(b, 8, vel=46, inst='oohs', oct_=3)
for k in (0, 2, 4, 6):
    glide('trombone', song.bar(b + k), 9.8, root(k) + 12, 74, 5.0 if k % 4 == 0 else -5.0, 0.0, take=4.0)
bell_toll(b, 8)
timp_beat(b, 8, vel=100)
drums(b, 8, level=1.0, style='heavy')
roll(b + 7, 2, 5, 60, 120)
b += 8

# ── Das Gesicht rutscht (8): Chor äfft mit Gleitern nach; Goblins höher und noch falscher; Orgel-Cluster ─────
theme('choir', b, 2, vel=84, seed=5, octave=-1, portamento=True, legato=.97)
theme('oohs', b, 2, vel=58, seed=5, octave=0, detune=-0.45, legato=.97)
theme('goblins', b, 3, vel=62, seed=7, octave=1, legato=.9)
theme('violin', b, 1, vel=70, seed=3, legato=.97)
ostinato(b, 8, vel=100)
cluster(b, 8, vel=60)
tremolo_pad(b, 8, vel=56)
pedal(b, 8, vel=58)
bell_toll(b, 8, every=1, vel=66)
timp_beat(b, 8, vel=104)
drums(b, 8, level=1.1, style='heavy')
scream(song.bar(b + 7) + 3.5, vel=100, dur=1.2)
b += 8

# ── Abgrund (8): kein Schlagzeug — Pedal, Gleiter der Posaune/Tuba, Herzschlag, Geflüster, Glocke; Aufbau ─────
pedal(b, 8, vel=64)
cluster(b, 8, vel=48, inst='oohs', oct_=3)
for iv in (0, 1, 6): song.add('bowed', song.bar(b), 39.8, 83 + iv, 36)
whispers(b, 8, vel=34)
heartbeat(b, 8, vel=72)
bell_toll(b, 8, every=1, vel=70)
for k in (0, 2, 4):
    glide('trombone', song.bar(b + k), 9.8, root(k) + 24, 80, 0.0, 6.0 if k < 4 else -6.0, take=9.0, steps=24)
    glide('tuba', song.bar(b + k), 9.8, root(k) + 12, 80, -6.0, 0.0, take=9.0, steps=24)
theme('kalimba', b, 0, vel=44, bars=range(0, 4), shift=0)
theme('kalimba', b + 4, 3, vel=50, bars=range(0, 4), seed=11, detune=-0.6)
glide('goblins', song.bar(b + 6), 10.0, 84, 66, -12.0, 12.0, take=9.5, steps=32)
timp_roll(song.bar(b + 6), 10.0, B1 + 12, 36, 118)
roll(b + 6, 0, 10, 36, 124)
b += 8

# ── Identität verloren (8): alle „Gesichter“ gleichzeitig, immer mehr falsche Töne; ganze Takte steigen halbtonweise ──
for blk in range(4):
    bars = range(blk * 2, blk * 2 + 2)
    sh = blk
    def part(inst, level, seed, octave=0, vel=80, portamento=False, detune=0.0):
        th = warp(level, seed)
        prev = None
        for k in bars:
            t = song.bar(b + k)
            for n, d in th[k]:
                p = 71 + n + sh + 12 * octave
                if portamento and prev is not None and prev != p:
                    glide(inst, t, d * .95, p, hv(vel), (prev - p) * 0.9, detune, take=0.45)
                else:
                    song.add(inst, t, max(0.1, d * .95), p, hv(vel))
                prev = p; t += d
    part('kalimba', 2, 21, vel=78)
    part('violin', 3, 22, vel=92)
    part('choir', 3, 23, octave=-1, vel=84, portamento=True)
    part('trombone', 2, 24, octave=-2, vel=84)
    part('goblins', 3, 25, octave=1, vel=64)
    scream(song.bar(b + blk * 2), shift=sh, vel=96, dur=1.4)
ostinato(b, 8, vel=104)
cluster(b, 8, vel=64)
tremolo_pad(b, 8, vel=60)
pedal(b, 8, vel=62)
bell_toll(b, 8, every=1, vel=70)
timp_beat(b, 8, vel=108)
drums(b, 8, level=1.15, style='heavy')
b += 8

# ── Reprise (8): das Wiegenlied wieder unschuldig — und darunter der Puls; Ausklang auf Grundton ─────────────
theme('kalimba', b, 0, vel=86, legato=.95)
theme('violin', b, 1, vel=62, seed=3, legato=.97)
ostinato(b, 8, vel=98)
tremolo_pad(b, 8, vel=50)
pedal(b, 8, vel=56)
bell_toll(b, 8)
timp_beat(b, 8, vel=100)
drums(b, 7, level=1.0, style='heavy')
cluster(b + 7, 1, vel=62)
song.add('timp', song.bar(b + 7), 1.5, B1 + 12, 108)
song.dr(song.bar(b + 7), CRASH, 100, 1.5); song.dr(song.bar(b + 7), KICK, 108, 0.3)
b += 8
assert b == BARS, (b, BARS)

if os.environ.get('SHAPE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_shapeshifter.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.15)
