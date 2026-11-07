# -*- coding: utf-8 -*-
"""Held-Thema „Broghan, the Frozen Guardian of the North“ → public/music/bgm_broghan.ogg           Titel: „Older Than the Ice“

Broghan ist ein großer, uralter, eisiger Golem (Card Art: Eiswand mit Fadenkreuz, darin die verschwommene Silhouette). Das Theme soll Kälte ausstrahlen,
bedrohlich, aber auch majestätisch und uralt klingen — und ein loopendes Battle-Theme bleiben.

  • Es-Moll (äolisch/dorisch), 116 BPM, 4/4 — **schwer und langsam wie ein Golem**: jeder Takt ein Stampfen (große Trommel + Pauke auf 1 und 3, Snare als
    „Steinbruch“ auf 3, tiefe Toms), Kontrabass in zähen Achteln. Dadurch bleibt Druck im Stück, ohne zu hetzen.
  • **Uralt**: das Thema ist ein gregorianisch anmutender Gesang in **Organum** — Männerchor in parallelen Quinten (Chor + Oohs eine Quinte tiefer),
    dazu tiefe Posaune; darunter Orgelpedal und Tuba, offene Quinten statt Terzen im Pedal. Modale Akkordfolge Ebm – C♭ – G♭ – D♭ | Ebm – C♭ – A♭m – B♭.
  • **Kälte**: glasklare Höhen — Kristall-Pad, Glockenspiel-„Eiszapfen“ (zufällige hohe Einzeltöne, große Septimen/Tritonus), Glasharfen-Streicher („bowed“),
    Harfenkaskaden abwärts, Wind (Pitch-Bend-Glissandi), Glockenschläge; bricht das Eis, splittert ein Glockenspiel-/Becken-Cluster.
  • **Majestät**: Blechchoral (Posaune, Horn, Tuba) und Orgel im vollen Teil, Rückung um eine kleine Terz (Ges-Moll) im Finale.
Form (56 Takte ≈ 1:56): Intro 4 · Erwachen A 8 · A' 8 (voll) · Marsch B 8 (3+3+2) · Gletscher 8 (kein Schlagzeug) · Eisbruch C 8 · Finale +3 8 · Coda 4
Ausklang auf B♭ (Dominante) → Wind der Es-Moll-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 116, 56
song = Song(BPM, BARS)
rng = random.Random(1066)

song.inst('choir', 'choir', vol=84, pan=56)             # Organum, obere Stimme
song.inst('oohs', 'oohs', vol=76, pan=72)               # Organum, Quinte tiefer
song.inst('trombone', 'trombone', vol=88, pan=44)
song.inst('horn', 'horns', vol=76, pan=82)
song.inst('tuba', 'tuba', vol=96, pan=60)
song.inst('organ', 'pipeorgan', vol=68, pan=64)
song.inst('bass', 'contra', vol=100, pan=62)
song.inst('timp', 'timp', vol=106, pan=64)
song.inst('crystal', 'crystal', vol=58, pan=88)         # Kristall-Pad
song.inst('glock', 'glock', vol=66, pan=34)             # Eiszapfen
song.inst('harp', 'harp', vol=76, pan=94)
song.inst('bowed', 'bowed', vol=64, pan=26)             # Glasharfen-Streicher
song.inst('tremolo', 'tremolo', vol=62, pan=48)
song.inst('bell', 'bell', vol=72, pan=68)
song.inst('wind', 'sweep', vol=56, pan=64)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Ebm': (3, 'm'), 'Cb': (11, 'M'), 'Gb': (6, 'M'), 'Db': (1, 'M'), 'Abm': (8, 'm'), 'Bb': (10, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=88, octave=0, legato=.97, interval=0):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave + interval, hv(vel))
            t += dur

# Pitch-Bend für den Wind (±12 Halbtöne)
for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
    song.ev.append((0, -2, mido.Message('control_change', channel=song.ch['wind'][0], control=cc, value=v)))

def gust(beat, dur=8.0, pitch=84, vel=50, lo=-4.0, hi=4.0, steps=24):
    ch = song.ch['wind'][0]
    song.add('wind', beat, dur + 0.3, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.35) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (Es-Moll) ════════════════════════════════════════════════════════════════════════════
A_CH = ['Ebm', 'Cb', 'Gb', 'Db', 'Ebm', 'Cb', 'Abm', 'Bb']
A_CH2 = ['Ebm', 'Cb', 'Gb', 'Db', 'Ebm', 'Cb', 'Abm', 'Ebm']
THEME = [
    [('Bb4', 3), ('Ab4', 1)],
    [('Gb4', 2), ('Eb4', 2)],
    [('Bb4', 2), ('Db5', 2)],
    [('Ab4', 3), ('F4', 1)],
    [('Bb4', 2), ('Eb5', 2)],
    [('Db5', 2), ('Cb5', 2)],
    [('Ab4', 2), ('Cb5', 1), ('Bb4', 1)],
]
END_OPEN = [('Bb4', 3), (None, 1)]
END_CLOSED = [('Eb4', 4)]

# Marsch B: 3+3+2-Stampfen (Achtel-Gruppen), mechanisch
B_CH = ['Ebm', 'Ebm', 'Cb', 'Db', 'Ebm', 'Ebm', 'Cb', 'Bb']
B_MEL = [
    [('Eb4', 1.5), ('Eb4', 1.5), ('Gb4', 1)],
    [('Bb4', 1.5), ('Ab4', 1.5), ('Gb4', 1)],
    [('Gb4', 1.5), ('Gb4', 1.5), ('Eb4', 1)],
    [('Ab4', 1.5), ('F4', 1.5), ('Db4', 1)],
    [('Eb4', 1.5), ('Eb4', 1.5), ('Gb4', 1)],
    [('Eb5', 1.5), ('Db5', 1.5), ('Bb4', 1)],
    [('Cb5', 1.5), ('Bb4', 1.5), ('Gb4', 1)],
    [('Bb4', 2), ('D5', 2)],
]

GL_CH = ['Ebm', 'Ebm', 'Cb', 'Cb', 'Abm', 'Abm', 'Bb', 'Bb']
GL = [
    [('Bb4', 4)], [('Ab4', 2), ('Gb4', 2)], [('Gb4', 4)], [('Eb4', 2), ('Gb4', 2)],
    [('Ab4', 4)], [('Cb5', 2), ('Bb4', 2)], [('Bb4', 3), (None, 1)], [(None, 4)],
]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def organum(bar0, bars, shift=0, vel=84, octave=0):
    """Männerchor in parallelen Quinten: obere Stimme (Chor) + Quinte tiefer (Oohs)."""
    mel('choir', bar0, bars, shift=shift, vel=vel, octave=octave)
    mel('oohs', bar0, bars, shift=shift, vel=vel - 8, octave=octave, interval=-7)

def root_pitch(ch, shift=0, oct_=1):
    r = tones(ch, oct_, shift)[0]
    while r < 28: r += 12
    while r > 48: r -= 12
    return r

def pedal(bar0, chords, shift=0, vel=72):
    """Orgel-/Tuba-Pedal: Grundton + offene Quinte (keine Terz)."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift)
        t = song.bar(bar0 + k)
        song.add('organ', t, 3.95, r, vel); song.add('organ', t, 3.95, r + 7, vel - 10); song.add('organ', t, 3.95, r + 12, vel - 16)
        song.add('tuba', t, 3.95, r, vel + 8)

def grind(bar0, chords, shift=0, vel=88):
    """Zäher Kontrabass: Achtel, Betonung auf 1 und 3, Oktave auf 4&."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift)
        t = song.bar(bar0 + k)
        for i in range(8):
            song.add('bass', t + i * 0.5, 0.42, r + (12 if i == 7 else 0), hv(vel + (12 if i in (0, 4) else (-8 if i % 2 else 0))))

def stomp(bar0, chords, shift=0, vel=104):
    """Pauken auf 1 und 3 (3 mit Halbschlag davor)."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift) + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 1.0, r, hv(vel)); song.add('timp', t + 1.5, 0.4, r, hv(vel - 32))
        song.add('timp', t + 2, 1.0, r, hv(vel - 4)); song.add('timp', t + 3.5, 0.4, r, hv(vel - 28))

def drums(bar0, nbars, level=1.0, style='stomp', crash=True, fills=True):
    """stomp: Kick + Tom auf 1/3, Snare als Steinbruch auf 3 · march: 3+3+2-Gruppen (Kick auf 1, 2.5, 4)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'march':
            for beat, v in ((0, 110), (1.5, 100), (3, 104)): song.dr(t + beat, KICK, int(v * L), 0.2); song.dr(t + beat, TOM_L, int(92 * L), 0.2)
            song.dr(t + 1.5, SNARE, int(100 * L), 0.15)
            for i in range(8): song.dr(t + i * 0.5, HAT, int((86 if i in (0, 3, 6) else 62) * L), 0.06)
        else:
            song.dr(t, KICK, int(112 * L), 0.25); song.dr(t, TOM_L, int(100 * L), 0.25)
            song.dr(t + 2, KICK, int(106 * L), 0.25); song.dr(t + 2, SNARE, int(110 * L), 0.2); song.dr(t + 2, TOM_L, int(96 * L), 0.25)
            song.dr(t + 1, TOM_L, int(70 * L), 0.15); song.dr(t + 3, TOM_M, int(78 * L), 0.15)
        if k == 0 and crash: song.dr(t, CRASH, int(106 * L), 2.2)
        if fills and k % 4 == 3 and style == 'stomp':
            for j in range(4): song.dr(t + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_L, TOM_L)[j], int((82 + 6 * j) * L), 0.15)

def roll(bar0, start, end, v0=44, v1=120):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=112):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def pad_cold(bar0, chords, shift=0, vel=46):
    """Eiskalte Höhen: Kristall + Glasstreicher auf Grundton, Quinte und großer Septime (leer, schimmernd)."""
    for k, ch in enumerate(chords):
        T = tones(ch, 5, shift)
        for m in (T[0], T[2], T[0] + 11):
            song.add('crystal', song.bar(bar0 + k), 3.95, m, vel)
        for m in (T[0] + 12, T[2]):
            song.add('bowed', song.bar(bar0 + k), 3.95, m, vel - 6)

def icicles(bar0, nbars, shift=0, vel=70, density=3):
    """Zufällige hohe Einzeltöne im Glockenspiel (Septimen/Tritonus über dem Akkord) — fallende Eiszapfen."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(density):
            base = rng.choice((pn('Eb6'), pn('Gb6'), pn('Bb6'), pn('Db7'), pn('A6'))) + shift
            song.add('glock', t + rng.choice((0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5)), 0.5, base, hv(vel))

def cascade(beat, shift=0, vel=66):
    """Harfenkaskade abwärts über Es-Moll-Töne."""
    notes = [pn(n) + shift for n in ('Eb7', 'Db7', 'Bb6', 'Gb6', 'Eb6', 'Db6', 'Bb5', 'Gb5')]
    for i, m in enumerate(notes):
        song.add('harp', beat + i * 0.25, 1.2, m, hv(vel - i * 2))

def crack(beat, vel=100):
    """Eisbruch: fallender Glockenspiel-Splitter + Becken + Glocke."""
    for i, n in enumerate(('Eb7', 'D7', 'Bb6', 'A6', 'Gb6', 'F6', 'Db6', 'C6')):
        song.add('glock', beat + i * 0.125, 0.3, pn(n), hv(vel - i * 3))
    song.dr(beat, CRASH, vel, 2.0)
    song.add('bell', beat, 3.0, pn('Eb4'), vel - 10); song.add('bell', beat, 3.0, pn('A4'), vel - 24)

def tolls(bar0, nbars, every=2, vel=70, shift=0):
    for k in range(0, nbars, every):
        song.add('bell', song.bar(bar0 + k), 3.9, pn('Eb4') + shift, vel)
        song.add('bell', song.bar(bar0 + k), 3.9, pn('Bb4') + shift, vel - 16)

def brass_chorale(bar0, chords, shift=0, vel=96):
    """Blechchoral: Posaune, Horn, Tuba auf jedem Takt (Quinte und Terz, Grundton tief)."""
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        t = song.bar(bar0 + k)
        for m in (T[0], T[2]): song.add('trombone', t, 3.9, m, hv(vel))
        for m in (T[1] + 12, T[2] + 12): song.add('horn', t, 3.9, m, hv(vel - 10))

def tremolo_pad(bar0, chords, shift=0, vel=50):
    for k, ch in enumerate(chords):
        for m in tones(ch, 3, shift):
            song.add('tremolo', song.bar(bar0 + k), 3.95, m, vel)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Wind, Eiszapfen, Orgel-Quinte im Dunkeln, zwei Stampfer, erster Eisbruch ─────────────────────
gust(song.bar(b), 14.0, pitch=pn('Bb5'), vel=48, lo=-6.0, hi=5.0)
for k in range(4):
    song.add('organ', song.bar(b + k), 3.95, pn('Eb2'), 50 + 6 * k); song.add('organ', song.bar(b + k), 3.95, pn('Bb2'), 44 + 6 * k)
song.add('tuba', song.bar(b + 2), 7.9, pn('Eb2'), 74)
icicles(b, 4, vel=56, density=2)
pad_cold(b + 1, ['Ebm'] * 3, vel=40)
for k in (2, 3):
    song.add('timp', song.bar(b + k), 1.4, pn('Eb2') + 12, 90 + 10 * (k - 2)); song.dr(song.bar(b + k), KICK, 100 + 8 * (k - 2), 0.3); song.dr(song.bar(b + k), TOM_L, 96, 0.3)
timp_roll(song.bar(b + 3) + 2, 2.0, pn('Eb3'), 40, 100)
crack(song.bar(b + 3) + 3.0, vel=96)
b += 4

# ── Erwachen A (8): Organum-Gesang über zähem Stampfen — der Golem erhebt sich ──────────────────────────────
organum(b, THEME, vel=84); organum(b + 7, [END_OPEN], vel=84)
mel('trombone', b, THEME, vel=70, octave=-1); mel('trombone', b + 7, [END_OPEN], vel=70, octave=-1)
pedal(b, A_CH)
grind(b, A_CH, vel=88)
stomp(b, A_CH)
drums(b, 8)
pad_cold(b, A_CH)
icicles(b, 8, density=3)
tolls(b, 8)
cascade(song.bar(b + 7) + 2.0)
b += 8

# ── A' (8): voll — Blechchoral, Orgel, Tremolo; Gesang schließt auf Es-Moll ───────────────────────────────
organum(b, THEME, vel=92); organum(b + 7, [END_CLOSED], vel=92)
mel('trombone', b, THEME, vel=84, octave=-1); mel('trombone', b + 7, [END_CLOSED], vel=84, octave=-1)
brass_chorale(b, A_CH2, vel=88)
pedal(b, A_CH2, vel=78)
grind(b, A_CH2, vel=94)
stomp(b, A_CH2, vel=108)
drums(b, 8, level=1.1)
pad_cold(b, A_CH2)
tremolo_pad(b, A_CH2)
icicles(b, 8, density=4)
tolls(b, 8)
b += 8

# ── Marsch B (8): 3+3+2-Stampfen, mechanisch; Posaune/Horn im Gleichschritt, Orgel hält die Quinte ─────────
mel('trombone', b, B_MEL, vel=96, octave=-1, legato=.85)
mel('horn', b, B_MEL, vel=84, octave=0, legato=.85)
mel('oohs', b, B_MEL, vel=62, octave=0, legato=.85, interval=-7)
pedal(b, B_CH, vel=76)
for k, ch in enumerate(B_CH):
    r = root_pitch(ch)
    t = song.bar(b + k)
    for beat, dur in ((0, 1.4), (1.5, 1.4), (3, 0.9)):
        song.add('bass', t + beat, dur, r, hv(104))
        song.add('timp', t + beat, dur, (r + 12) if r + 12 <= 55 else r, hv(100 if beat == 0 else 92))
drums(b, 8, level=1.05, style='march')
pad_cold(b, B_CH, vel=42)
icicles(b, 8, density=2, vel=60)
roll(b + 7, 2, 4, 50, 118)
b += 8

# ── Gletscher (8): kein Schlagzeug — Organum, Glasharfen, Glocken, Herzschlag-Pauke, Wind; am Ende wieder Stampfen ──
organum(b, GL, vel=74, octave=-1)
pedal(b, GL_CH, vel=66)
pad_cold(b, GL_CH, vel=54)
tolls(b, 8, every=1, vel=66)
gust(song.bar(b), 30.0, pitch=pn('Eb6'), vel=52, lo=-5.0, hi=6.0, steps=48)
icicles(b, 8, density=4, vel=62)
for k in range(8):
    song.add('timp', song.bar(b + k), 1.8, root_pitch(GL_CH[k]) + 12 if root_pitch(GL_CH[k]) + 12 <= 55 else root_pitch(GL_CH[k]), 56 + 4 * k)
for k in (1, 3, 5):
    cascade(song.bar(b + k) + 0.0, vel=58)
timp_roll(song.bar(b + 6), 8.0, pn('Bb2'), 36, 112)
roll(b + 7, 0, 4, 40, 122)
crack(song.bar(b + 7) + 3.5, vel=104)
b += 8

# ── Eisbruch C (8): das Eis birst — Gesang, Blechchoral und Orgel, alles voll; Glockenspiel-Splitter jeden 2. Takt ──
organum(b, THEME, vel=98); organum(b + 7, [END_OPEN], vel=98)
mel('trombone', b, THEME, vel=90, octave=-1); mel('trombone', b + 7, [END_OPEN], vel=90, octave=-1)
mel('horn', b, THEME, vel=84, octave=0); mel('horn', b + 7, [END_OPEN], vel=84, octave=0)
brass_chorale(b, A_CH, vel=96)
pedal(b, A_CH, vel=84)
grind(b, A_CH, vel=100)
stomp(b, A_CH, vel=112)
drums(b, 8, level=1.15)
pad_cold(b, A_CH)
tremolo_pad(b, A_CH, vel=56)
icicles(b, 8, density=4, vel=74)
tolls(b, 8, every=1)
for k in (1, 3, 5):
    crack(song.bar(b + k) + 0.0, vel=92)
b += 8

# ── Finale +3 (8): Ges-Moll — die kleine Terz höher; Ganzschluss ───────────────────────────────────────────
S = 3
organum(b, THEME, shift=S, vel=104); organum(b + 7, [END_CLOSED], shift=S, vel=104)
mel('trombone', b, THEME, shift=S, vel=96, octave=-1); mel('trombone', b + 7, [END_CLOSED], shift=S, vel=96, octave=-1)
mel('horn', b, THEME, shift=S, vel=90, octave=0); mel('horn', b + 7, [END_CLOSED], shift=S, vel=90, octave=0)
brass_chorale(b, A_CH2, shift=S, vel=100)
pedal(b, A_CH2, shift=S, vel=88)
grind(b, A_CH2, shift=S, vel=104)
stomp(b, A_CH2, shift=S, vel=114)
drums(b, 8, level=1.2)
pad_cold(b, A_CH2, shift=S)
tremolo_pad(b, A_CH2, shift=S, vel=58)
icicles(b, 8, shift=S, density=4, vel=76)
tolls(b, 8, every=1, shift=S)
for k in (3, 7):
    crack(song.bar(b + k) + 0.0, vel=96)
b += 8

# ── Coda (4): B♭ (Dominante), langer Stampfer, Wind verebbt in die Es-Moll-Intro ────────────────────────────
CODA = ['Bb', 'Bb', 'Bb', 'Bb']
pedal(b, CODA, vel=84)
grind(b, CODA[:2], vel=100)
stomp(b, CODA[:2], vel=108)
drums(b, 2, level=1.1, fills=False)
brass_chorale(b, CODA[:3], vel=96)
for m in tones('Bb', 3): song.add('trombone', song.bar(b + 2), 3.9, m, 100)
crack(song.bar(b + 2), vel=100)
timp_roll(song.bar(b + 3), 4.0, pn('Bb2'), 60, 100)
gust(song.bar(b + 3), 4.0, pitch=pn('Bb5'), vel=56, lo=5.0, hi=-8.0, steps=16)
song.dr(song.bar(b + 3) + 3.5, CRASH, 80, 0.5)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('BROGHAN_NORENDER') != '1':
    sf2, out = cli_paths('bgm_broghan.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.0)
