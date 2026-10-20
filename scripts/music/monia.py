# -*- coding: utf-8 -*-
"""Held-Thema „Cool Rescuer Monia“ → public/music/bgm_monia.ogg                    Titel: „Jetpack Grin“

Die Hauptfigur: ein junges Mädchen mit Jetpack und breitem Grinsen, immer auf der Suche nach Abenteuern, immer gut
drauf, sehr cool, rettet nebenbei andere, ein Tomboy. Das Stück ist Power-Pop-/Pop-Punk-Abenteuer — unbekümmert,
frech, mitreißend, mit einem Refrain zum Mitpfeifen.

  • A-Dur, 152 BPM, treibender Rock-Beat, Palm-Mute-Gitarren (rough, Tomboy), funkige Clean-Gitarren-Kratzer (cool),
    Slap-artiger Bass, Blech-Stiche („Hey!“), Pfeifen-Lead im Vers (das Grinsen), Charang-Lead + Blech im Refrain.
  • Jetpack: ein steigendes Sägezahn-/Sinus-Heulen mit Pitch-Bend + Reverse-Becken zündet das Stück (Intro), kehrt im
    „Flug“-Teil und im Ausklang wieder.
  • Refrain-Hook (8 Takte, A – E – F#m – D | A – E – D – E): aufsteigende Dreiklangs-Girlande, Sprung auf das hohe
    H, bouncy Synkopen, die Linie „landet“ mit einem langen D — mitsingbar und sofort wiedererkennbar. Die Hookfigur
    kehrt im Vers als Echo im Glockenspiel („Funkeln im Grinsen“) und im Finale eine Terz höher… eine Ganztonstufe
    höher (H-Dur) wieder.
  • Brücke „Rettung“: breite, heldenhafte Streicher-Melodie (Fis-Moll – D – A – E …), sie trägt alle, die Monia
    unterwegs rettet; endet auf Fis7 → Rückung nach H-Dur.
  • Ausklang: aus H-Dur zurück: E (IV von H = V von A) → E7 → Loop auf A.
Form (80 Takte = 2:06): Intro 4 · Vers 8 · Refrain 8 · Vers 8 · Refrain 8 · Brücke 8 · Flug 16 · Finale 16 · Outro 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 152, 80
song = Song(BPM, BARS)
rng = random.Random(2024)

song.inst('whistle', 'whistle', vol=96, pan=62)
song.inst('lead', 'charang', vol=92, pan=66)
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

bend_setup('jet'); bend_setup('whistle'); bend_setup('lead')

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
# ── Intro (4): Jetpack-Zündung, Countdown-Snares, Blechstoß, Anlauf in den Vers ───────────────────────
whoosh(song.bar(b), 4.0, lo=-0.9, hi=0.55, note='A3', vel=88)
song.dr(song.bar(b), CRASH, 70, 3.0)
for i in range(16):                                         # Reverse-Becken-Effekt: Snare-Crescendo
    song.dr(song.bar(b) + i * 0.25, SNARE, 40 + i * 3, 0.1)
for i in range(4):                                          # Countdown 4-3-2-1
    song.dr(song.bar(b + 1) + i, SIDESTICK, 104, 0.1)
    song.add('glock', song.bar(b + 1) + i, 0.3, pn('A5'), 78)
for m in (pn('A2'), pn('A3'), pn('E4'), pn('A4')):         # Powerchord-Stoß + Blech: LOS!
    song.add('gtrL', song.bar(b + 2), 1.6, m, 104); song.add('gtrR', song.bar(b + 2), 1.6, m, 104)
stab(b, 2, 0, 'A', vel=100, dur=1.2); song.dr(song.bar(b + 2), CRASH, 108, 1.5); song.dr(song.bar(b + 2), KICK, 110, 0.3)
song.add('bass', song.bar(b + 2), 1.6, pn('A1'), 108)
mel('whistle', b + 3, [[(None, 2), ('A4', .25), ('B4', .25), ('C#5', .25), ('D5', .25), ('E5', .25), ('F#5', .25), ('G#5', .25), ('A5', .25)]], vel=96)
for i in range(4): song.dr(song.bar(b + 3) + 2 + i * 0.5, TOM_L if i < 2 else TOM_H, 96 + i * 6, 0.12)
b += 4

# ── Vers 1 (8): Pfeife frech, Gitarren chuggen, Clean-Kratzer, Glockenspiel-Funkeln ─────────────────────
mel('whistle', b, VERSE, vel=94); mel('whistle', b + 7, [VERSE_END], vel=94)
for k in (3, 7): scoop('whistle', song.bar(b + k))
chug(b, VERSE_CH, vel=72)
scratch(b, VERSE_CH, vel=56)
bass8(b, VERSE_CH, vel=94)
stab(b, 7, 2.5, 'E', vel=98)                                # „Hey!“ auf die Pause
mel('glock', b + 3, [[('E6', .5), ('C#6', .5), ('A5', 2)]], vel=64, legato=.7)   # kleines Echo der Hookfigur
drums(b, 8, 'verse')
b += 8

# ── Refrain 1 (8): Hook im Lead + Pfeife, offene Powerchords, Orgel ─────────────────────────────────────
mel('lead', b, HOOK, vel=94); mel('lead', b + 7, [HOOK_END_OPEN], vel=94)
mel('whistle', b, HOOK, vel=66); mel('whistle', b + 7, [HOOK_END_OPEN], vel=66)
strum(b, HOOK_CH, vel=88)
bass8(b, HOOK_CH, vel=98)
organ(b, HOOK_CH, vel=50)
for k in (0, 4): stab(b, k, 0, HOOK_CH[k], vel=86, dur=0.5)
mel('glock', b, HOOK, vel=52, octave=1, legato=.6)
drums(b, 8, 'chorus')
b += 8

# ── Vers 2 (8): wie Vers 1, dazu Blech-Antworten und zweite Stimme ─────────────────────────────────────
mel('whistle', b, VERSE, vel=96); mel('whistle', b + 7, [VERSE_END], vel=96)
mel('lead', b, VERSE, vel=52, octave=-1); mel('lead', b + 7, [VERSE_END], vel=52, octave=-1)
for k in (3, 7): scoop('whistle', song.bar(b + k))
chug(b, VERSE_CH, vel=76)
scratch(b, VERSE_CH, vel=60)
bass8(b, VERSE_CH, vel=96)
for k in (1, 3, 5): stab(b, k, 3.5, VERSE_CH[k] if not isinstance(VERSE_CH[k], tuple) else VERSE_CH[k][0], vel=86)
stab(b, 7, 2.5, 'E', vel=100)
mel('glock', b + 3, [[('E6', .5), ('C#6', .5), ('A5', 2)]], vel=64, legato=.7)
drums(b, 8, 'verse')
b += 8

# ── Refrain 2 (8): größer — Blechsatz doppelt den Lead, Violine singt mit ────────────────────────────────
mel('lead', b, HOOK, vel=98); mel('lead', b + 7, [HOOK_END_CLOSED], vel=98)
mel('brass', b, HOOK, vel=64, octave=-1); mel('brass', b + 7, [HOOK_END_CLOSED], vel=64, octave=-1)
mel('whistle', b, HOOK, vel=72); mel('whistle', b + 7, [HOOK_END_CLOSED], vel=72)
strum(b, HOOK_CH_CLOSED, vel=92)
bass8(b, HOOK_CH_CLOSED, vel=100)
organ(b, HOOK_CH_CLOSED, vel=54)
strings(b, HOOK_CH_CLOSED, vel=50)
mel('glock', b, HOOK, vel=56, octave=1, legato=.6)
drums(b, 8, 'chorus')
b += 8

# ── Brücke „Rettung“ (8): Streicher + Violine tragen, Gitarren halten sich zurück ────────────────────
mel('violin', b, BRIDGE, vel=92)
mel('lead', b, BRIDGE, vel=54)
strings(b, BRIDGE_CH, vel=64)
organ(b, BRIDGE_CH, vel=52)
bass8(b, BRIDGE_CH, vel=88, push=False)
for k in range(8):                                          # Gitarren: breite Halbe, kein Chug
    T = tones(BRIDGE_CH[k], 2)
    for name in ('gtrL', 'gtrR'):
        for m in (T[0] + 12, T[0] + 19):
            song.add(name, song.bar(b + k), 1.9, m, 66); song.add(name, song.bar(b + k) + 2, 1.9, m, 62)
drums(b, 8, 'half', fill_last=False)
for i in range(16):                                         # Snare-Wirbel in den Flug
    song.dr(song.bar(b + 7) + 2 + i * 0.125, SNARE, 60 + i * 4, 0.08)
whoosh(song.bar(b + 7) + 2, 2.0, lo=-0.9, hi=0.9, note='F#3', vel=80)
b += 8

# ── Flug (16): oben! Arpeggien, Jetpack-Rufe, dann Gitarrensolo ──────────────────────────────────────────
FLY_CH = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
arp = (0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2)
for rep in range(2):
    base = b + 8 * rep
    for k, ch in enumerate(FLY_CH):                         # schnelle Glocken-/Lead-Arpeggien
        T = tones(ch, 5 if rep == 0 else 4)
        for i in range(16):
            inst = 'glock' if rep == 0 else 'lead'
            song.add(inst, song.bar(base + k) + i * 0.25, 0.2, T[arp[i]] + (12 if i % 8 >= 4 else 0), hv(60 if rep == 0 else 56))
    organ(base, FLY_CH, vel=50)
    bass8(base, FLY_CH, vel=96)
    drums(base, 8, 'fly', crash=True)
whoosh(song.bar(b) + 0, 3.5, lo=-0.5, hi=0.9, note='E3', vel=76)
whoosh(song.bar(b + 4), 3.5, lo=-0.9, hi=0.9, note='A3', vel=76)
# Zweiter Teil: Gitarrensolo (Lead) über dem Refrain-Gerüst — Hook-Fragmente, Bends
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
mel('lead', b + 8, SOLO, vel=100)
mel('whistle', b + 8, SOLO, vel=56)
for k in (1, 3, 5): scoop('lead', song.bar(b + 8 + k), depth=-0.25)
strum(b + 8, FLY_CH, vel=88)
b += 16

# ── Finale (16): H-Dur (+2) — der Refrain, jetzt mit allem, Hook zweimal ────────────────────────────────
S = 2
for rep in range(2):
    base = b + 8 * rep
    end = HOOK_END_CLOSED if rep == 1 else HOOK_END_OPEN
    chs = HOOK_CH_CLOSED if rep == 1 else HOOK_CH
    mel('lead', base, HOOK, shift=S, vel=100); mel('lead', base + 7, [end], shift=S, vel=100)
    mel('whistle', base, HOOK, shift=S, vel=78); mel('whistle', base + 7, [end], shift=S, vel=78)
    mel('brass', base, HOOK, shift=S, vel=72, octave=-1); mel('brass', base + 7, [end], shift=S, vel=72, octave=-1)
    mel('violin', base, HOOK, shift=S, vel=66); mel('violin', base + 7, [end], shift=S, vel=66)
    mel('glock', base, HOOK, shift=S, vel=60, octave=1, legato=.6)
    strum(base, chs, shift=S, vel=96)
    bass8(base, chs, shift=S, vel=102)
    organ(base, chs, shift=S, vel=56)
    strings(base, chs, shift=S, vel=54)
    drums(base, 8, 'chorus', crash=True)
for k in (0, 4, 8, 12): stab(b, k, 0, HOOK_CH[k % 8], shift=S, vel=96, dur=0.6)
b += 16

# ── Outro (4): E-Dur-Pivot (IV von H = V von A) → E7 → Loop auf A; Jetpack zieht davon ──────────────────
# Takt 1–2: Refrain-Schluss in H-Dur klingt als E aus; Takt 3–4: E7 mit Wirbel
mel('lead', b, [[('G#5', 1.5), ('B5', .5), ('E6', 2)], [('B5', 1.5), ('G#5', .5), ('E5', 2)], [('D5', 1), ('G#5', 1), ('B5', 2)], [('G#5', 4)]], vel=92)
mel('whistle', b + 2, [[('E6', .5), ('D6', .5), ('B5', 1), ('G#5', 2)], [('E5', 1.5), ('G#5', .5), ('B5', 2)]], vel=84)
for k, ch in enumerate(['E', 'E', 'E7', 'E7']):
    T = tones(ch, 2)
    for name in ('gtrL', 'gtrR'):
        for m in (T[0] + 12, T[0] + 19, T[0] + 24):
            song.add(name, song.bar(b + k), 3.8, m, 90)
    song.add('bass', song.bar(b + k), 3.8, T[0] + 12 - 12 if T[0] + 12 > 50 else T[0] + 12, 100)
organ(b, ['E', 'E', 'E7', 'E7'], vel=56)
strings(b, ['E', 'E', 'E7', 'E7'], vel=58)
drums(b, 2, 'half', crash=True, fill_last=False)
for k in (2, 3):
    t = song.bar(b + k)
    for i in range(16): song.dr(t + i * 0.25, SNARE if k == 3 else TOM_M, 50 + 3 * i + (30 if k == 3 else 0), 0.1)
whoosh(song.bar(b + 2), 8.0, lo=-0.9, hi=0.95, note='E3', vel=78)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('MONIA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_monia.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
