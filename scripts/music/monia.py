# -*- coding: utf-8 -*-
"""Held-Thema „Cool Rescuer Monia“ → public/music/bgm_monia.ogg                    Titel: „Jetpack Grin“

Die Hauptfigur: ein junges Mädchen mit Jetpack und breitem Grinsen, immer auf der Suche nach Abenteuern, immer gut
drauf, sehr cool, rettet nebenbei andere, ein Tomboy. Das Stück ist Power-Pop-/Pop-Punk-Abenteuer — unbekümmert,
frech, mitreißend, mit einem Refrain zum Mitpfeifen.

  • A-Dur, 152 BPM, treibender Rock-Beat, Palm-Mute-Gitarren (rough, Tomboy), funkige Clean-Gitarren-Kratzer (cool),
    Slap-artiger Bass; TROMPETEN sind die Hauptstimmen (gedämpfte Trompete im Vers = das Grinsen, offene Trompete
    + Blechsatz im Refrain und Solo) und ein richtiger CHOR: Gang-„Hey!“ im Vers, Hook-Gesang im Refrain, Aahs in
    der Brücke, Oohs als Unterstimme.
  • Jetpack: ein steigendes Sägezahn-/Sinus-Heulen mit Pitch-Bend + Reverse-Becken zündet das Stück (Intro), kehrt im
    „Flug“-Teil und im Ausklang wieder.
  • Refrain-Hook (8 Takte, A – E – F#m – D | A – E – D – E): aufsteigende Dreiklangs-Girlande, Sprung auf das hohe
    H, bouncy Synkopen, die Linie „landet“ mit einem langen D — mitsingbar und sofort wiedererkennbar. Die Hookfigur
    kehrt im Vers als Echo im Glockenspiel („Funkeln im Grinsen“) und im Finale eine Terz höher… eine Ganztonstufe
    höher (H-Dur) wieder.
  • Brücke „Rettung“: breite, heldenhafte Streicher-Melodie (Fis-Moll – D – A – E …), sie trägt alle, die Monia
    unterwegs rettet; endet auf Fis7 → Rückung nach H-Dur.
  • Ausklang: aus H-Dur zurück: E (IV von H = V von A) → E7 → Loop auf A.
Form (78 Takte = 2:03): Intro 2 · Vers 8 · Refrain 8 · Vers 8 · Refrain 8 · Brücke 8 · Flug 16 · Finale 16 · Outro 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 152, 78
song = Song(BPM, BARS)
rng = random.Random(2024)

song.inst('mute', 'muted', vol=94, pan=60)          # gedämpfte Trompete: frech, grinsend
song.inst('trumpet', 'trumpet', vol=100, pan=66)    # offene Trompete: die Hauptstimme
song.inst('choir', 'choir', vol=84, pan=64)         # Chor-Aahs
song.inst('oohs', 'oohs', vol=76, pan=72)           # Voice Oohs (Unterstimme)
song.inst('brass', 'brass', vol=88, pan=76)
song.inst('gtrL', 'rockgtr', vol=90, pan=22)
song.inst('gtrR', 'rockgtr', vol=88, pan=106)
song.inst('clean', 'cleangtr', vol=78, pan=96)
song.inst('bass', 'bass', vol=102, pan=60)
song.inst('organ', 'rockorgan', vol=62, pan=48)
song.inst('strings', 'slowstr', vol=74, pan=40)
song.inst('violin', 'violin', vol=84, pan=70)
song.inst('glock', 'glock', vol=76, pan=90)
song.inst('sweep', 'sweep', vol=64, pan=64)
song.inst('jet', 'sine', vol=76, pan=64)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'A': (9, 'M'), 'E': (4, 'M'), 'F#m': (6, 'm'), 'D': (2, 'M'), 'F#7': (6, '7'), 'E7': (4, '7')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return v + rng.randint(-3, 3)

def spans(chords):
    out = []
    for k, c in enumerate(chords):
        if isinstance(c, tuple):
            out += [(k, 0, 2, c[0]), (k, 2, 2, c[1])]
        else:
            out.append((k, 0, 4, c))
    return out

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.93):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# ═══ Material ═════════════════════════════════════════════════════════════════════════════════════
# Refrain-Hook (A-Dur) — 8 Takte  A | E | F#m | D | A | E | D | E
HOOK = [
    [('C#5', .5), ('E5', .5), ('A5', 1), ('G#5', .5), ('A5', .5), ('B5', 1)],        # 1 A    Girlande hoch, Sprung aufs H
    [('B5', 1.5), ('G#5', .5), ('E5', 1), ('G#5', 1)],                                 # 2 E
    [('A5', 1.5), ('F#5', .5), ('C#5', 1), ('F#5', 1)],                                # 3 F#m
    [('F#5', 1), ('A5', .5), ('F#5', .5), ('D5', 2)],                                  # 4 D    „landet“ auf dem langen D
    [('C#5', .5), ('E5', .5), ('A5', 1), ('B5', .5), ('C#6', .5), ('B5', 1)],         # 5 A    zweiter Anlauf, höher
    [('B5', 1.5), ('G#5', .5), ('E5', 2)],                                             # 6 E
    [('F#5', 1.5), ('E5', .5), ('D5', 1), ('F#5', 1)],                                 # 7 D
]
HOOK_END_OPEN = [('B4', .5), ('E5', .5), ('G#5', 1), ('B5', 2)]                      # 8 E   offen
HOOK_END_CLOSED = [('C#5', .5), ('E5', .5), ('A5', 3)]                                 # 8 A   geschlossen
HOOK_CH = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
HOOK_CH_CLOSED = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'A']

# Vers-Linie (Pfeife): frech, rhythmisch, Frage und Antwort mit den Blech-Stichen
VERSE = [
    [('E5', .5), ('E5', .5), ('E5', .5), ('C#5', .5), ('E5', 1), ('A5', 1)],          # 1 A
    [('G#5', .5), ('A5', .5), ('G#5', .5), ('E5', .5), ('C#5', 2)],                    # 2 A
    [('D5', .5), ('D5', .5), ('D5', .5), ('F#5', .5), ('A5', 1), ('F#5', 1)],          # 3 D
    [('E5', 1), ('G#5', 1), ('B5', .5), ('G#5', .5), ('E5', 1)],                       # 4 E
    [('E5', .5), ('E5', .5), ('E5', .5), ('C#5', .5), ('E5', 1), ('A5', 1)],          # 5 A
    [('A5', .5), ('B5', .5), ('C#6', 1), ('B5', 1), ('A5', 1)],                        # 6 A
    [('F#5', 1), ('A5', 1), ('G#5', 1), ('B5', 1)],                                    # 7 D | E
]
VERSE_END = [('B5', 2), (None, 2)]                                                      # 8 E  (Blech-Stoß „Hey!“)
VERSE_CH = ['A', 'A', 'D', 'E', 'A', 'A', ('D', 'E'), 'E']

# Brücke „Rettung“: breit, heldenhaft
BRIDGE = [
    [('C#5', 2), ('F#5', 2)],                                  # 1 F#m
    [('A5', 2), ('F#5', 1), ('D5', 1)],                        # 2 D
    [('E5', 1.5), ('A5', .5), ('C#6', 2)],                     # 3 A
    [('B5', 3), ('G#5', 1)],                                   # 4 E
    [('A5', 2), ('C#6', 2)],                                   # 5 F#m
    [('F#5', 1), ('A5', 1), ('D6', 2)],                        # 6 D
    [('B5', 2), ('G#5', 1), ('B5', 1)],                        # 7 E
    [('A#5', 2), ('C#6', 2)],                                  # 8 F#7  Leitton A# → H-Dur
]
BRIDGE_CH = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'E', 'F#7']

# ═══ Hilfen: Jetpack-Pitchbend ═════════════════════════════════════════════════════════════════════
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):    # Bend-Bereich ±12 Halbtöne
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))

def bend(name, beat, norm):
    ch = song.ch[name][0]
    song.ev.append((int(round(beat * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, norm * 8192))))))

bend_setup('jet'); bend_setup('mute'); bend_setup('trumpet')

def whoosh(beat, dur, lo=-0.95, hi=0.95, note='A3', vel=84, steps=32):
    """Jetpack: Sinus + Sweep-Pad, Tonhöhe gleitet von lo bis hi (±12 Halbtöne)."""
    song.add('jet', beat, dur, pn(note), vel)
    song.add('sweep', beat, dur, pn(note) + 12, vel - 20)
    for i in range(steps + 1):
        bend('jet', beat + dur * i / steps, lo + (hi - lo) * (i / steps) ** 1.4)
    bend('jet', beat + dur + 0.02, 0)

def scoop(name, beat, depth=-0.17):
    """Kleiner „Anlauf“ von unten (Grinsen im Ton): kurz unter dem Ton ansetzen, hochziehen."""
    bend(name, beat, depth); bend(name, beat + 0.06, depth / 2); bend(name, beat + 0.12, 0)

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root_midi(ch, oct_, shift=0):
    return tones(ch, oct_, shift)[0]

def chug(bar0, chords, shift=0, vel=74, inst=('gtrL', 'gtrR')):
    """Palm-Mute-Achtel auf Powerchord (Grundton + Quinte)."""
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 2, shift)
        for i in range(int(dur * 2)):
            t = song.bar(bar0 + k) + off + i * 0.5
            for name in inst:
                song.add(name, t, 0.3, T[0] + 12, hv(vel + (12 if i % 2 == 0 else 0)))
                song.add(name, t, 0.3, T[0] + 19, hv(vel - 6 + (12 if i % 2 == 0 else 0)))

def strum(bar0, chords, shift=0, vel=88, hits=((0, 1.4), (1.5, .45), (2, 1.4), (3.5, .45))):
    """Offene Powerchords (Refrain)."""
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 2, shift)
        for bt, ln in hits:
            if off <= bt < off + dur:
                for name, extra in (('gtrL', 0), ('gtrR', 0)):
                    for m in (T[0] + 12, T[0] + 19, T[0] + 24):
                        song.add(name, song.bar(bar0 + k) + bt, ln, m, hv(vel))

def scratch(bar0, chords, shift=0, vel=58):
    """Funkige 16tel-Kratzer der Clean-Gitarre: der coole Teil."""
    pos = (0.5, 1.25, 1.75, 2.5, 3.25, 3.75)
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 4, shift)
        for bt in pos:
            if off <= bt < off + dur:
                for m in (T[1], T[2]):
                    song.add('clean', song.bar(bar0 + k) + bt, 0.18, m, hv(vel))

def bass8(bar0, chords, shift=0, vel=96, push=True):
    for k, off, dur, ch in spans(chords):
        r = tones(ch, 1, shift)[0] + 12                    # E2…D#3 grob
        if r > 50: r -= 12
        n8 = int(dur * 2)
        for i in range(n8):
            t = song.bar(bar0 + k) + off + i * 0.5
            m = r + 12 if i % 4 == 2 else (r + 7 if (push and i == n8 - 1 and dur == 4) else r)
            song.add('bass', t, 0.4, m, hv(vel + (8 if i % 2 == 0 else -8)))

def organ(bar0, chords, shift=0, vel=50):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in T[:3]:
            song.add('organ', song.bar(bar0 + k) + off, dur - 0.05, m, vel)

def strings(bar0, chords, shift=0, vel=56):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('strings', song.bar(bar0 + k) + off, dur - 0.05, m, vel)

def stab(bar0, k, beat, ch, shift=0, vel=88, dur=0.4):
    T = tones(ch, 3, shift)
    for m in (T[0] + 12, T[1] + 12, T[2] + 12):
        song.add('brass', song.bar(bar0 + k) + beat, dur, m, hv(vel))

def hey(bar0, k, beat, ch, shift=0, vel=104, dur=0.28):
    """Gang-„Hey!“: kurzer Chor-Akkord (Aahs + Oohs) auf einem Blech-Stich."""
    T = tones(ch, 4, shift)
    for m in (T[0], T[1], T[2]):
        song.add('choir', song.bar(bar0 + k) + beat, dur, m, hv(vel))
    song.add('oohs', song.bar(bar0 + k) + beat, dur, T[0] - 12, hv(vel - 12))

def choir_hook(bar0, bars, end, shift=0, vel=70):
    """Der Chor singt den Hook: Aahs im Unisono, Oohs eine Oktave tiefer."""
    mel('choir', bar0, bars, shift=shift, vel=vel); mel('choir', bar0 + 7, [end], shift=shift, vel=vel)
    mel('oohs', bar0, bars, shift=shift, vel=vel - 14, octave=-1); mel('oohs', bar0 + 7, [end], shift=shift, vel=vel - 14, octave=-1)

def choir_pad(bar0, chords, shift=0, vel=58):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('choir', song.bar(bar0 + k) + off, dur - 0.05, m, vel)
        song.add('oohs', song.bar(bar0 + k) + off, dur - 0.05, T[2] + 12, vel - 10)

def drums(bar0, nbars, style, crash=True, fill_every=4, fill_last=True):
    """style: 'verse' (Rock-Beat, 8tel-Hat) · 'chorus' (+Clap, offene Hat) · 'fly' (Vierviertel-Kick, Clap) · 'half'."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if style in ('verse', 'chorus'):
            song.dr(t, KICK, 104, 0.2); song.dr(t + 2, KICK, 100, 0.2); song.dr(t + 3.5, KICK, 84, 0.2)
            if style == 'chorus': song.dr(t + 1.5, KICK, 80, 0.2)
            song.dr(t + 1, SNARE, 106, 0.15); song.dr(t + 3, SNARE, 108, 0.15)
            for i in range(8):
                song.dr(t + i * 0.5, HAT, 104 + (10 if i % 2 == 0 else 0), 0.08)
            if style == 'chorus':
                song.dr(t + 1, CLAP, 78, 0.1); song.dr(t + 3, CLAP, 82, 0.1)
                for i in range(4): song.dr(t + 0.5 + i, OHAT, 92, 0.2)
        elif style == 'fly':
            for i in range(4): song.dr(t + i, KICK, 100, 0.2)
            song.dr(t + 1, CLAP, 90, 0.1); song.dr(t + 3, CLAP, 94, 0.1)
            for i in range(8): song.dr(t + i * 0.5, HAT, 100 + (10 if i % 2 == 0 else 0), 0.08)
        elif style == 'half':
            song.dr(t, KICK, 100, 0.2); song.dr(t + 2, SNARE, 106, 0.15); song.dr(t + 3.5, KICK, 80, 0.2)
            for i in range(8): song.dr(t + i * 0.5, HAT, 96, 0.08)
        if k == 0 and crash:
            song.dr(t, CRASH, 104, 1.2)
        if fill_last and (k % fill_every == fill_every - 1):
            for j, tom in enumerate((TOM_H, TOM_H, TOM_M, TOM_L)):
                song.dr(t + 2.5 + j * 0.375, tom, 94 + 6 * j, 0.12)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (2): Jetpack hebt weich ab, Puls läuft sofort, Trompeten-Fanfare, dann direkt der Vers ──────────
#   (kein lauter Einzelton, keine Pause: Takt 1 = Zündung + Puls, Takt 2 = Anlauf mit Wirbel → Vers-Downbeat)
whoosh(song.bar(b), 4.0, lo=-0.8, hi=0.35, note='A3', vel=52)
for i in range(8): song.dr(song.bar(b) + i * 0.5, HAT, 92 + (10 if i % 2 == 0 else 0), 0.08)
song.dr(song.bar(b), KICK, 92, 0.2); song.dr(song.bar(b) + 2, KICK, 88, 0.2)
song.dr(song.bar(b) + 1, SIDESTICK, 96, 0.1); song.dr(song.bar(b) + 3, SIDESTICK, 100, 0.1)
song.add('bass', song.bar(b), 1.8, pn('A1'), 86); song.add('bass', song.bar(b) + 2, 1.8, pn('A1') + 7, 82)
mel('mute', b, [[(None, 2), ('A4', .5), ('C#5', .5), ('E5', .5), ('A5', .5)]], vel=92)      # Fanfaren-Auftakt
scoop('mute', song.bar(b) + 2)
mel('trumpet', b + 1, [[('B5', 1.5), ('A5', .5), ('E5', 1), (None, 1)]], vel=92)          # Antwort
for m in (pn('A3'), pn('E4'), pn('A4')):                                                  # Chor „Oh!“ auf der 3
    song.add('choir', song.bar(b + 1) + 2.5, 0.4, m, 84)
for i in range(8):                                                                         # Wirbel im Anlauf (rutscht in den Vers)
    song.dr(song.bar(b + 1) + 2 + i * 0.25, SNARE, 52 + i * 8, 0.1)
chug(b + 1, ['A'], vel=62)
song.add('bass', song.bar(b + 1), 1.8, pn('A1'), 90)
for i in range(4): song.add('bass', song.bar(b + 1) + 2 + i * 0.5, 0.4, pn('A1') + (12 if i == 3 else 0), 92)
b += 2

# ── Vers 1 (8): gedämpfte Trompete frech, Gitarren chuggen, Clean-Kratzer, Chor-„Hey!“ ───────────────────
mel('mute', b, VERSE, vel=94); mel('mute', b + 7, [VERSE_END], vel=94)
for k in (3, 7): scoop('mute', song.bar(b + k))
chug(b, VERSE_CH, vel=72)
scratch(b, VERSE_CH, vel=56)
bass8(b, VERSE_CH, vel=94)
stab(b, 7, 2.5, 'E', vel=98); hey(b, 7, 2.5, 'E')
for k in (1, 3, 5):
    stab(b, k, 3.5, VERSE_CH[k], vel=80); hey(b, k, 3.5, VERSE_CH[k], vel=92)
mel('glock', b + 3, [[('E6', .5), ('C#6', .5), ('A5', 2)]], vel=64, legato=.7)
drums(b, 8, 'verse')
b += 8

# ── Refrain 1 (8): offene Trompete + Chor singen den Hook ───────────────────────────────────────────────
mel('trumpet', b, HOOK, vel=98); mel('trumpet', b + 7, [HOOK_END_OPEN], vel=98)
choir_hook(b, HOOK, HOOK_END_OPEN, vel=70)
strum(b, HOOK_CH, vel=86)
bass8(b, HOOK_CH, vel=98)
organ(b, HOOK_CH, vel=46)
for k in (0, 4): stab(b, k, 0, HOOK_CH[k], vel=84, dur=0.5)
mel('glock', b, HOOK, vel=52, octave=1, legato=.6)
drums(b, 8, 'chorus')
b += 8

# ── Vers 2 (8): zweite Trompete im Kanon-Echo, mehr „Hey!“ ───────────────────────────────────────────────
mel('mute', b, VERSE, vel=96); mel('mute', b + 7, [VERSE_END], vel=96)
mel('trumpet', b, VERSE, vel=50, octave=-1); mel('trumpet', b + 7, [VERSE_END], vel=50, octave=-1)
for k in (3, 7): scoop('mute', song.bar(b + k))
chug(b, VERSE_CH, vel=76)
scratch(b, VERSE_CH, vel=60)
bass8(b, VERSE_CH, vel=96)
for k in (1, 3, 5):
    c0 = VERSE_CH[k] if not isinstance(VERSE_CH[k], tuple) else VERSE_CH[k][0]
    stab(b, k, 3.5, c0, vel=86); hey(b, k, 3.5, c0, vel=96)
    hey(b, k, 1.5, c0, vel=84)                                     # Frage-Antwort: zwei „Hey!“ je Takt
stab(b, 7, 2.5, 'E', vel=100); hey(b, 7, 2.5, 'E', vel=108)
mel('glock', b + 3, [[('E6', .5), ('C#6', .5), ('A5', 2)]], vel=64, legato=.7)
drums(b, 8, 'verse')
b += 8

# ── Refrain 2 (8): Trompeten im Satz (Blech eine Oktave tiefer), Chor volle Kraft ─────────────────────────
mel('trumpet', b, HOOK, vel=102); mel('trumpet', b + 7, [HOOK_END_CLOSED], vel=102)
mel('brass', b, HOOK, vel=64, octave=-1); mel('brass', b + 7, [HOOK_END_CLOSED], vel=64, octave=-1)
mel('mute', b, HOOK, vel=60); mel('mute', b + 7, [HOOK_END_CLOSED], vel=60)
choir_hook(b, HOOK, HOOK_END_CLOSED, vel=78)
strum(b, HOOK_CH_CLOSED, vel=90)
bass8(b, HOOK_CH_CLOSED, vel=100)
organ(b, HOOK_CH_CLOSED, vel=50)
strings(b, HOOK_CH_CLOSED, vel=48)
mel('glock', b, HOOK, vel=56, octave=1, legato=.6)
drums(b, 8, 'chorus')
b += 8

# ── Brücke „Rettung“ (8): Trompetensolo über Streichern und Chor-Aahs ────────────────────────────────────
mel('trumpet', b, BRIDGE, vel=92, octave=0)
mel('violin', b, BRIDGE, vel=60)
choir_pad(b, BRIDGE_CH, vel=62)
strings(b, BRIDGE_CH, vel=60)
organ(b, BRIDGE_CH, vel=46)
bass8(b, BRIDGE_CH, vel=88, push=False)
for k in range(8):
    T = tones(BRIDGE_CH[k], 2)
    for name in ('gtrL', 'gtrR'):
        for m in (T[0] + 12, T[0] + 19):
            song.add(name, song.bar(b + k), 1.9, m, 62); song.add(name, song.bar(b + k) + 2, 1.9, m, 58)
drums(b, 8, 'half', fill_last=False)
for i in range(16):
    song.dr(song.bar(b + 7) + 2 + i * 0.125, SNARE, 60 + i * 4, 0.08)
whoosh(song.bar(b + 7) + 2, 2.0, lo=-0.9, hi=0.9, note='F#3', vel=64)
b += 8

# ── Flug (16): Arpeggien, Jetpack-Rufe; dann Trompeten-Solo (Hook-Fragmente, Scoops) mit Chor-Riffs ─────────────
FLY_CH = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
arp = (0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2)
for rep in range(2):
    base = b + 8 * rep
    for k, ch in enumerate(FLY_CH):
        T = tones(ch, 5 if rep == 0 else 4)
        for i in range(16):
            inst = 'glock' if rep == 0 else 'mute'
            song.add(inst, song.bar(base + k) + i * 0.25, 0.2, T[arp[i]] + (12 if i % 8 >= 4 else 0), hv(60 if rep == 0 else 54))
    organ(base, FLY_CH, vel=48)
    bass8(base, FLY_CH, vel=96)
    drums(base, 8, 'fly', crash=True)
whoosh(song.bar(b) + 0, 3.5, lo=-0.5, hi=0.9, note='E3', vel=60)
whoosh(song.bar(b + 4), 3.5, lo=-0.9, hi=0.9, note='A3', vel=60)
for k in (0, 4):                                              # Chor: „Oh-oh!“ über dem Flug
    for j, off in enumerate((0, 1.5, 3)):
        T = tones(FLY_CH[k], 4)
        for m in (T[0], T[1], T[2]):
            song.add('choir', song.bar(b + k) + off, 0.4, m, 76)
SOLO = [
    [('A5', .5), ('C#6', .5), ('E6', 1), ('C#6', .5), ('A5', .5), ('E5', 1)],
    [('G#5', 1), ('B5', 1), ('E6', 2)],
    [('F#5', .5), ('A5', .5), ('C#6', 1), ('A5', 1), ('F#5', 1)],
    [('D6', 1.5), ('C#6', .5), ('A5', 2)],
    [('A5', .5), ('C#6', .5), ('E6', 1), ('F#6', 1), ('E6', 1)],
    [('G#6', 2), ('E6', 1), ('B5', 1)],
    [('A5', 1), ('D6', 1), ('F#6', 1), ('D6', 1)],
    [('E6', 3), (None, 1)],
]
mel('trumpet', b + 8, SOLO, vel=100, octave=-1)                    # Trompeten-Tessitur: eine Oktave tiefer notiert
mel('mute', b + 8, SOLO, vel=48, octave=-1)
for k in (1, 3, 5): scoop('trumpet', song.bar(b + 8 + k), depth=-0.2)
strum(b + 8, FLY_CH, vel=84)
for k in (3, 7):
    hey(b, 8 + k, 3.5, FLY_CH[k], vel=100)
b += 16

# ── Finale (16): H-Dur (+2) — Trompeten, Chor, alles; Hook zweimal ────────────────────────────────────────
S = 2
for rep in range(2):
    base = b + 8 * rep
    end = HOOK_END_CLOSED if rep == 1 else HOOK_END_OPEN
    chs = HOOK_CH_CLOSED if rep == 1 else HOOK_CH
    mel('trumpet', base, HOOK, shift=S, vel=104); mel('trumpet', base + 7, [end], shift=S, vel=104)
    mel('mute', base, HOOK, shift=S, vel=66); mel('mute', base + 7, [end], shift=S, vel=66)
    mel('brass', base, HOOK, shift=S, vel=74, octave=-1); mel('brass', base + 7, [end], shift=S, vel=74, octave=-1)
    mel('violin', base, HOOK, shift=S, vel=60); mel('violin', base + 7, [end], shift=S, vel=60)
    choir_hook(base, HOOK, end, shift=S, vel=84)
    mel('glock', base, HOOK, shift=S, vel=60, octave=1, legato=.6)
    strum(base, chs, shift=S, vel=96)
    bass8(base, chs, shift=S, vel=102)
    organ(base, chs, shift=S, vel=52)
    strings(base, chs, shift=S, vel=54)
    drums(base, 8, 'chorus', crash=True)
for k in (0, 4, 8, 12): stab(b, k, 0, HOOK_CH[k % 8], shift=S, vel=96, dur=0.6)
b += 16

# ── Outro (4): E → E7 → Loop auf A; Chor hält, Trompeten rufen, Jetpack zieht davon ──────────────────────
mel('trumpet', b, [[('G#5', 1.5), ('B5', .5), ('E6', 2)], [('B5', 1.5), ('G#5', .5), ('E5', 2)], [('D5', 1), ('G#5', 1), ('B5', 2)], [('G#5', 4)]], vel=94, octave=0)
mel('mute', b + 2, [[('E6', .5), ('D6', .5), ('B5', 1), ('G#5', 2)], [('E5', 1.5), ('G#5', .5), ('B5', 2)]], vel=80)
choir_pad(b, ['E', 'E', 'E7', 'E7'], vel=70)
for k, ch in enumerate(['E', 'E', 'E7', 'E7']):
    T = tones(ch, 2)
    for name in ('gtrL', 'gtrR'):
        for m in (T[0] + 12, T[0] + 19, T[0] + 24):
            song.add(name, song.bar(b + k), 3.8, m, 88)
    song.add('bass', song.bar(b + k), 3.8, T[0] + 12 if T[0] + 12 <= 50 else T[0], 100)
organ(b, ['E', 'E', 'E7', 'E7'], vel=52)
strings(b, ['E', 'E', 'E7', 'E7'], vel=56)
drums(b, 2, 'half', crash=True, fill_last=False)
for k in (2, 3):
    t = song.bar(b + k)
    for i in range(16): song.dr(t + i * 0.25, SNARE if k == 3 else TOM_M, 50 + 3 * i + (30 if k == 3 else 0), 0.1)
whoosh(song.bar(b + 2), 8.0, lo=-0.9, hi=0.95, note='E3', vel=60)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('MONIA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_monia.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
