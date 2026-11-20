# -*- coding: utf-8 -*-
"""Held-Thema „Natas, the Master of Hell“ → public/music/bgm_natas.ogg                      Titel: „Hospitality of the Pit“

Natas ist *der* bösartigste Charakter des Spiels, die Graue Eminenz hinter den allermeisten Problemen der Lore (Card Art: Herr im Anzug mit Augenklappe vor einem leuchtenden Turm,
rechts und links lavaglühende Dämonenstatuen). Das Theme drückt **unterschwellige Bösartigkeit** aus und soll **Angst einflößen** — durch Zurückhaltung, nicht durch Lärm.

  • F-Moll, 100 BPM (Halbzeit-Schwere) über einem **Uhrwerk**: Cembalo-16tel (kalt, präzise — „er führt Buch“) mit ♭II (Ges) und Tritonus (H) im Grundton-Muster, dazu ein
    Orgel-/Tuba-/Kontrabass-**Pedalton F**, der sich nie bewegt. Das Schlagzeug ist langsam und schwer (Kick 1, Snare 3, kaum hörbare Hi-Hat) — der Schrecken kommt vom Gewicht, nicht vom Tempo.
  • **Verborgenes Zitat**: das Motiv ist an die Totensequenz *Dies irae* angelehnt (F–E–F–C–D♭–C–B♭–C), erst unhörbar tief im Chor (je Note ein ganzer Takt), später offen in Orgel, Posaune und Chor —
    wie eine Drohung, die man erst erkennt, wenn man sie kennt.
  • **Der Gastgeber**: im „Audienz“-Teil spielt eine gedämpfte Trompete eine glatte, höfliche, chromatische Melodie — charmant, einladend und völlig falsch. Die Höflichkeit eines Mannes, der nie
    laut werden muss.
  • **Der Pakt**: das Pedal F bleibt, doch alles darüber steigt halbtonweise (F-Moll, Ges-Moll, G-Moll, As-Moll) — der Boden bewegt sich nicht, die Welt darüber gleitet in seinen Besitz.
  • Dazu: Glockenschlag im Tritonus, Glas-Streicher, flüsternde Chor-Cluster, Goblin-Seufzer, Geigenglissandi, Herzschlag-Pauke.
Form (48 Takte ≈ 1:55): Intro 4 · Das Hauptbuch A 8 · Audienz B 8 · Hofstaat C 8 · Signatur (Break) 8 · Der Pakt E 8 · Coda 4
Ausklang auf C (Dominante) → F-Moll-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 100, 48
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

CH = {'Fm': (5, 'm'), 'Gb': (6, 'M'), 'Bbm': (10, 'm'), 'C': (0, 'M'), 'Db': (1, 'M'), 'C7': (0, '7')}
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

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Pedal, Herzschlag, ein einzelner Glockenschlag (Tritonus), erste Uhrwerk-Ticks ───────────────
pedal(b, 4, vel=50)
heartbeat(b, 4, vel=48)
glass(b, 4, vel=24)
whispers(b, 4, vel=26)
tolls(b, 1, vel=62)
clockwork(b + 2, ['Fm', 'Fm'], vel=40)
timp_roll(song.bar(b + 3) + 2, 2.0, pn('F2') + 12, 36, 92)
b += 4

# ── Das Hauptbuch A (8): Uhrwerk, schweres Halbzeit-Schlagwerk, das verborgene Dies-irae-Zitat tief im Chor ─────
pedal(b, 8, vel=68)
clockwork(b, A_CH, vel=68)
dies_hidden(b, vel=34)
tremolo_pad(b, A_CH, vel=34)
glass(b, 8, vel=26)
heartbeat(b, 8, vel=46)
drums(b, 8, level=1.08)
tolls(b, 8, every=4, vel=66)
whispers(b, 8, vel=30)
sighs(b, 8, vel=34)
b += 8

# ── Audienz B (8): der Gastgeber — gedämpfte Trompete, höflich und falsch; Orgelakkorde, Uhrwerk weiter ────────
mel('muted', b, HOST, vel=82, legato=.9)
pedal(b, 8, vel=60)
clockwork(b, B_CH, vel=54)
for k, ch in enumerate(B_CH):
    for m in tones(ch, 3): song.add('organ', song.bar(b + k), 3.95, m, 44)
    song.add('oohs', song.bar(b + k), 3.95, tones(ch, 4)[2], 40)
tremolo_pad(b, B_CH, vel=38)
glass(b, 8, vel=30)
heartbeat(b, 8, vel=50)
drums(b, 8, level=1.0)
whispers(b, 8, vel=32)
tolls(b, 8, every=4, vel=64)
for k in (3, 7):
    glide('goblins', song.bar(b + k) + 2.0, 2.0, pn('C5'), 46, 2.0, -3.0)
roll(b + 7, 2, 4, 40, 96)
b += 8

# ── Hofstaat C (8): das Zitat tritt hervor — Orgel, Posaune, Chor, Horn, Tuba; schwere Trommeln, Glocken ──────
dies_open(b, vel=98)
pedal(b, 8, vel=70, fixed=False, chords=C_CH)
clockwork(b, C_CH, vel=60)
tremolo_pad(b, C_CH, vel=48)
glass(b, 8, vel=34)
for k in range(8):
    r = root_midi(C_CH[k], oct_=1)
    if r > 55: r -= 12
    song.add('timp', song.bar(b + k), 1.2, r, 100)
    song.add('timp', song.bar(b + k) + 2, 1.2, r, 92)
drums(b, 8, level=1.1, style='heavy', fills=True)
tolls(b, 8, every=2, vel=72)
whispers(b, 8, vel=34)
for k in (1, 3, 5, 7):
    glide('violin', song.bar(b + k), 3.8, pn('F5') + 6 * (k % 2), 62, -1.0, 2.0)
sighs(b, 8, vel=40)
b += 8

# ── Signatur (8): kein Schlagzeug — nur Uhrwerk, Pedal, geflüsterter Chor; der Meister „spricht“ (tiefe Chor-Silben), Cluster wächst ────
pedal(b, 8, vel=62)
clockwork(b, BREAK_CH, vel=52)
for k, ch in enumerate(BREAK_CH):
    t = song.bar(b + k)
    r = root_midi(ch, oct_=1)
    for pos in (0.0, 1.5, 2.0, 3.25):                         # gesprochene Silben: gehackter Rhythmus, tiefer Männerchor
        song.add('choir', t + pos, 0.25, r + 12, hv(60 + 3 * k))
    for iv in (0, 1, 6): song.add('tremolo', t, 3.95, r + 24 + iv, 36 + 5 * k)
glass(b, 8, vel=36)
heartbeat(b, 8, vel=56)
tolls(b, 8, every=2, vel=66)
whispers(b, 8, vel=38)
glide('goblins', song.bar(b + 4), 15.0, pn('C5'), 52, -6.0, 6.0, steps=32)
timp_roll(song.bar(b + 6), 8.0, pn('F2') + 12, 36, 116)
roll(b + 7, 0, 4, 36, 124)
b += 8

# ── Der Pakt E (8): das Pedal F bleibt, alles darüber steigt halbtonweise (F-, Ges-, G-, As-Moll) — der Boden bewegt sich nicht ─────
pedal(b, 8, vel=76)
drums(b, 8, level=1.15, style='heavy', fills=True)
for blk in range(4):
    sh = blk
    bb = b + 2 * blk
    seg = [A_CH[2 * blk], A_CH[2 * blk + 1]]
    clockwork(bb, ['Fm', 'Fm'], vel=62)                         # das Uhrwerk bleibt auf F (der Boden)
    for k, ch in enumerate(seg):
        T = tones(ch, 3, sh)
        t = song.bar(bb + k)
        for m in T: song.add('organ', t, 3.95, m, 62); song.add('trombone', t, 3.95, m, 88); song.add('horn', t, 3.95, m + 12, 70)
        for m in tones(ch, 4, sh): song.add('choir', t, 3.95, m, 80)
        for iv in (0, 1, 6): song.add('tremolo', t, 3.95, root_midi(ch, sh, 2) + iv, 50)
    mel('muted', bb, HOST[2 * blk:2 * blk + 2], shift=sh, vel=86, legato=.9)
    mel('violin', bb, HOST[2 * blk:2 * blk + 2], shift=sh, vel=60, octave=1)
dies_hidden(b, vel=60, per_note=4.0, octave=0, inst='oohs')
glass(b, 8, vel=40)
tolls(b, 8, every=2, vel=76)
whispers(b, 8, vel=38)
sighs(b, 8, vel=46)
for k in (1, 3, 5, 7):
    song.add('timp', song.bar(b + k), 1.2, pn('F2') + 12, 100)
    if k in (3, 7): song.dr(song.bar(b + k), CRASH, 88, 1.6)
roll(b + 7, 2, 4, 56, 126)
b += 8

# ── Coda (4): C (Dominante zur F-Moll-Intro) — das Zitat noch einmal offen, dann nur Pedal und ein letzter Tritonus-Schlag ─────────────
for k in range(3):
    for m in (pn('C2'), pn('C3'), pn('G3')): song.add('organ', song.bar(b + k), 3.95, m, 70 - 6 * k)
    song.add('tuba', song.bar(b + k), 3.95, pn('C2'), 74)
    song.add('bass', song.bar(b + k), 3.95, pn('C2'), 74)
for i, (n, o) in enumerate(zip(DIES[:6], DIES_OCT[:6])):
    t = song.bar(b) + i * 2.0
    for inst, off, v in (('choir', 0, 74), ('oohs', 12, 56), ('trombone', -12, 70)):
        song.add(inst, t, 1.9, pn(n + str(o)) + off, hv(v))
clockwork(b, ['C', 'C'], vel=44)
heartbeat(b, 3, vel=64)
song.dr(song.bar(b), KICK, 92, 0.2); song.dr(song.bar(b) + 2, SNARE, 96, 0.2)
tolls(b + 2, 1, vel=76)
timp_roll(song.bar(b + 3), 4.0, pn('C2') + 12, 40, 100)
glass(b, 3, vel=30)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('NATAS_NORENDER') != '1':
    sf2, out = cli_paths('bgm_natas.ogg')
    song.render(sf2, out, target_rms=0.26, saturate=False, compress=True, air_cut=0.1)
