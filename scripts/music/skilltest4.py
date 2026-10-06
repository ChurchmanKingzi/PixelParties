# -*- coding: utf-8 -*-
"""Skill Test, Track 4 „Last Seat Standing“ → public/music/bgm_skilltest4.ogg

Episches Battle-Royale für großes Orchester in d-Moll, 152 BPM, 80 Takte (126,3 s), nahtlos loopbar.
Acht Spieler = acht Hornrufe. Jeder Ruf hat seine eigene Tonhöhe und seinen festen Platz im Stereobild
(Verteilung per Seed gewürfelt). Die Hornrufe eröffnen das Stück, treten im Chaos-Teil als acht
Themenfragmente in acht verschiedenen Tonarten wieder auf und kehren zum Schluss gedrängt zurück.

Das Hauptthema („ta-ka-TAA“: punktierte Achtel, Sechzehntel, lange Note – dem Hornruf entwachsen) steigt über
Dm – Dm – B – F – Gm – Dm – B – A7. Begleitung: Pauken-Galopp (Achtel + zwei Sechzehntel je Schlag), Streicher-
Spiccato-Ostinato, Kontrabass, Blech, Chor, Orchester-Hits.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Die acht Hornrufe steigen nacheinander ein (je ein Takt, überlappend), Pauken-Galopp
                      von Anfang an, Spiccato ab Takt 2, Tremolo, Toms, am Ende Wirbel
   8–15  Thema A      Trompete trägt das Hauptthema, Spiccato + Pauken, Hits
  16–23  Thema A'     Trompete + Violine + Flöte, Blech eine Oktave tiefer, Chor, Harfe, Hörner-Gegenstimme
  24–31  Steigerung B Wurzeln steigen (B–C–d–F–g–B–A), Sequenzen, Chor, Blech, Wirbel
  32–47  Chaos C      Acht Spieler, acht Zweitakter: das Themenkopf-Fragment in acht Tonarten (Seed-Reihenfolge,
                      letzte immer a-Moll = Dominante), je ein anderes Instrument/Panorama, Generalpausen, Neustarts
  48–55  Hymne D      Blechchoral mit Chor, Hits, Pauken in Sechzehnteln – der Höhepunkt
  56–63  Ausdünnen E  Die Plätze scheiden nacheinander aus (Chor, Blech, Posaune, Hörner, Flöte, Tremolo,
                      Spiccato, Trompete)
  64–71  Letzter Sitz F  Solo-Violine mit dem Hauptthema über Pauken, Bass, Harfe
  72–79  Rückkehr G   Tutti-Thema (Hälfte), dann die Hornrufe gedrängt (zwei je Takt), Ende auf A7 → Loop

Harmonie: d-Moll mit Dur-Dominante (A7, Leitton cis). Der Loop endet bewusst auf der Dominante.
Alle Melodietöne werden im Skript gegen die Tonleiter (und Taktanfänge gegen den Akkord) geprüft.
Aufruf:  python3 scripts/music/skilltest4.py <soundfont.sf2> [ausgabe.ogg]
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 152, 80                       # 80 × 4 × 60/152 = 126,3 s
song = Song(bpm=BPM, bars=BARS)
rng = random.Random(8)                    # Seed: Panorama der Spieler, Reihenfolge der Tonarten, Humanize

# ---- Stimmen (15) ------------------------------------------------------------------
song.inst('contra', 'contra', 104, 62)    # Bass Oktave 1–2
song.inst('timp', 'timp', 104, 64)
song.inst('spic', 'strings', 84, 40)      # Spiccato-Ostinato, Oktave 3–4
song.inst('trem', 'tremolo', 66, 86)
song.inst('hornA', 'horns', 90, 64)       # Hornrufe (zwei Kanäle im Wechsel, Panorama je Ruf per CC)
song.inst('hornB', 'horns', 90, 64)
song.inst('trb', 'trombone', 88, 78)      # Posaune: Grund + Stabs, Oktave 3
song.inst('brass', 'brass', 80, 52)       # Blech-Verdopplung der Melodie, eine Oktave tiefer
song.inst('trumpet', 'trumpet', 90, 70)   # Hauptmelodie
song.inst('vln', 'violin', 90, 50)        # Violine (Doppelung, später Solo)
song.inst('flute', 'flute', 78, 88)
song.inst('oboe', 'oboe', 82, 30)
song.inst('choir', 'choir', 92, 64)
song.inst('harp', 'harp', 80, 96)
song.inst('hit', 'hit', 82, 58)

# ---- Hilfen -------------------------------------------------------------------------
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

SCALE = {2, 4, 5, 7, 9, 10, 0, 1}         # d-Moll natürlich + cis (harmonisch)
Dm, Bb, F_, Gm, A7, C_, Am, Eb = (2, 'm'), (10, 'M'), (5, 'M'), (7, 'm'), (9, '7'), (0, 'M'), (9, 'm'), (3, 'M')
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}
def tones(ch, octv, shift=0):
    r = n((ch[0] + shift) % 12, octv)
    return [r + i for i in QUAL[ch[1]]]
def pcs(ch, shift=0): return {(ch[0] + shift + i) % 12 for i in QUAL[ch[1]]}
def fold(pc, lo):                         # Tonklasse in die Oktave ab MIDI-Note lo legen
    return lo + (pc - lo) % 12

def hv(v): return int(max(1, min(127, v + rng.randint(-4, 4))))

CUT = [4.0]                               # Generalpause: Ereignisse ab diesem Beat im Takt entfallen
def ad(inst, bar, beat, dur, pitch, vel):
    if beat >= CUT[0]: return
    song.add(inst, song.bar(bar) + beat, dur, pitch, vel)
def dd(bar, beat, note, vel, dur=0.2):
    if beat >= CUT[0]: return
    song.dr(song.bar(bar) + beat, note, vel, dur)

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.93, chords=None):
    """Melodie aus [(Name, Dauer)]-Takten; prüft Tonleiter und (bei chords) den Akkord auf Beat 1."""
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k); tot = 0
        for j, (name, dur) in enumerate(bar):
            if name is not None:
                p = pn(name) + shift + 12 * octave
                assert p % 12 in {(s + shift) % 12 for s in SCALE}, (name, bar0 + k)
                if chords and j == 0:
                    assert p % 12 in pcs(chords[k], shift) or (chords[k] == A7 and p % 12 == 1), (name, bar0 + k)
                song.add(inst, t, dur * legato, p, hv(vel))
            t += dur; tot += dur
        assert abs(tot - 4) < 1e-9, (bar0 + k, tot)

# ---- Die acht Spieler: je ein Hornruf (Tonhöhe) mit festem Platz im Stereobild -------------
CALL_PITCHES = ['A4', 'D4', 'F4', 'D5', 'C5', 'E5', 'G4', 'Bb4']      # Einsatzreihenfolge im Intro
pans = [10, 28, 46, 62, 80, 98, 116, 20]
rng.shuffle(pans)
PLAYER_PAN = dict(zip(CALL_PITCHES, pans))
_hs = [0]
def call(pitch, bar, beat, dur_tail, vel):
    """Hornruf „ta-ka-TAA“ auf fester Tonhöhe, Kanäle wechseln (Überlappung), Panorama je Spieler."""
    inst = 'hornA' if _hs[0] % 2 == 0 else 'hornB'; _hs[0] += 1
    p = pn(pitch); t = song.bar(bar) + beat
    song.cc(inst, t, 10, PLAYER_PAN[pitch])
    song.add(inst, t, 0.72, p, hv(vel)); song.add(inst, t + .75, 0.23, p, hv(vel - 8))
    song.add(inst, t + 1, dur_tail, p, hv(vel + 4))

# ---- Begleit-Bausteine (ein Takt je Aufruf) -----------------------------------------
def bar_acc(bar, ch, L, s=0, v=1.0, tomset=0):
    root = (ch[0] + s) % 12
    T3, T4 = tones(ch, 3, s), tones(ch, 4, s)
    r_t = fold(root, 38); fifth_t = fold((root + 7) % 12, 38)
    if 'timp' in L:                        # Galopp: Achtel + 2 Sechzehntel je Schlag
        for b in range(4):
            ad('timp', bar, b, 0.42, r_t, hv((112 if b == 0 else 96) * v))
            ad('timp', bar, b + .5, 0.2, r_t, hv(84 * v)); ad('timp', bar, b + .75, 0.2, fifth_t if b == 3 else r_t, hv(92 * v))
    if 'timp1' in L:
        for b in range(4): ad('timp', bar, b, 0.9, r_t, hv((100 if b % 2 == 0 else 82) * v))
    if 'spic' in L:                        # Spiccato-Galopp auf Akkordtönen
        for b in range(4):
            ad('spic', bar, b, 0.3, T3[0], hv((78 if b == 0 else 64) * v))
            ad('spic', bar, b + .5, 0.17, T3[2], hv(56 * v)); ad('spic', bar, b + .75, 0.17, T4[1], hv(60 * v))
    if 'spic8' in L:                       # Spiccato in Achteln (ruhiger, für Solo-Takte)
        for i in range(8): ad('spic', bar, i * .5, 0.3, (T3[0], T3[2])[i % 2], hv((62 if i % 2 == 0 else 48) * v))
    if 'contra' in L:
        lo = fold(root, 28)
        for i in range(8): ad('contra', bar, i * .5, 0.42, lo if i % 4 != 3 else lo + 7, hv((104 if i % 2 == 0 else 84) * v))
    if 'trem' in L:
        for m in (T4[1], T4[2], T3[0] + 12): ad('trem', bar, 0, 3.95, m, hv(54 * v))
    if 'choir' in L:
        for m in (T4[0], T4[1], T4[2], T3[0]): ad('choir', bar, 0, 3.9, m, hv(76 * v))
    if 'hornhold' in L:
        ad('hornB', bar, 0, 3.9, T3[2] + 12, hv(70 * v)); ad('hornB', bar, 0, 3.9, T3[1] + 12, hv(64 * v))
    if 'trb' in L:
        base = fold(root, 40)
        ad('trb', bar, 0, 1.9, base, hv(88 * v)); ad('trb', bar, 2, 1.9, base + 7 if ch[1] != 'x' else base, hv(80 * v))
    if 'stab' in L:
        for bt in (0, 1.5, 2.5):
            for m in (T3[1], T3[2], T3[0] + 12): ad('trb', bar, bt, 0.4, m, hv(84 * v))
    if 'harp' in L:
        pat = [T4[0], T4[1], T4[2], T4[0] + 12, T4[1] + 12, T4[2] + 12, T4[1] + 12, T4[0] + 12]
        for i, m in enumerate(pat): ad('harp', bar, i * .5, 0.5, m, hv((74 if i % 2 == 0 else 58) * v))
    if 'hit' in L:
        for m in (T3[0], T3[2], T3[0] + 12): ad('hit', bar, 0, 1.0, m, hv(100 * v))
    if 'hit2' in L:
        for m in (T3[0], T3[2], T3[0] + 12): ad('hit', bar, 2.5, 0.8, m, hv(88 * v))
    if 'toms' in L:
        for bt, nt, vv in ((0, TOM_L, 96), (1.5, TOM_M, 84), (2, TOM_L, 92), (3, TOM_M, 86), (3.5, TOM_H, 80)):
            dd(bar, bt, nt, vv * v)
    if 'kick' in L:
        dd(bar, 0, KICK, 104 * v); dd(bar, 2, KICK, 96 * v)

def snare_roll(bar, beat0, n16, v0, v1):
    for i in range(n16):
        dd(bar, beat0 + i * .25, SNARE, v0 + (v1 - v0) * i / max(1, n16 - 1), 0.12)
def timp_roll(bar, beat0, n16, note, v0, v1):
    for i in range(n16):
        ad('timp', bar, beat0 + i * .25, 0.2, note, int(v0 + (v1 - v0) * i / max(1, n16 - 1)))
def crash(bar, vel=108): dd(bar, 0, CRASH, vel, 1.5)

def scale_run(inst, bar, beat, start, count, up=True, step=.25, vel=84, shift=0):
    """Tonleiterlauf (d-Moll natürlich) in Sechzehnteln ab MIDI-Note `start`."""
    sc = sorted(m for m in range(40, 100) if m % 12 in {(x + shift) % 12 for x in (2, 4, 5, 7, 9, 10, 0)})
    i = sc.index(start)
    for k in range(count):
        j = i + k if up else i - k
        ad(inst, bar, beat + k * step, step * 1.1, sc[j], hv(vel + (k * 2 if up else 0)))

# ═══ Material ═══════════════════════════════════════════════════════════════════════════════
A_CH_OPEN = [Dm, Dm, Bb, F_, Gm, Dm, Bb, A7]
A_CH_CLOSED = [Dm, Dm, Bb, F_, Gm, Dm, Bb, Dm]
A_BARS = [
    [('A4', .75), ('A4', .25), ('D5', 2), ('E5', .5), ('F5', .5)],       # Dm   Hauptmotiv: ta-ka-TAA
    [('A4', .75), ('A4', .25), ('F5', 2), ('E5', .5), ('D5', .5)],       # Dm
    [('D5', .75), ('D5', .25), ('F5', 2), ('G5', .5), ('F5', .5)],       # B    Sequenz aufwärts
    [('C5', .75), ('C5', .25), ('A5', 2), ('G5', .5), ('F5', .5)],       # F
    [('Bb4', .75), ('Bb4', .25), ('D5', 1), ('G5', 2)],                  # Gm
    [('F5', 1), ('E5', 1), ('D5', 1), ('A4', 1)],                        # Dm   Abstieg
    [('F5', 1), ('D5', 1), ('Bb4', 1), ('D5', 1)],                       # B
]
A_END_OPEN = [('E5', .75), ('E5', .25), ('C#5', 1), ('E5', 1), ('A5', 1)]   # A7  Halbschluss
A_END_CLOSED = [('F5', .75), ('E5', .25), ('D5', 3)]                          # Dm  Ganzschluss
B_CH = [Bb, C_, Dm, F_, Gm, Bb, A7, A7]
B_BARS = [
    [('D5', 1), ('F5', 1), ('Bb5', 2)],
    [('E5', 1), ('G5', 1), ('C6', 2)],
    [('F5', 1), ('A5', 1), ('D6', 2)],
    [('F5', .5), ('G5', .5), ('A5', 1), ('C6', 2)],
    [('G5', 1), ('Bb5', 1), ('D6', 2)],
    [('F5', 1), ('Bb5', 1), ('D6', 2)],
    [('E5', .5), ('A5', .5), ('C#6', 1), ('E6', 2)],
    [('E6', 1), ('C#6', 1), ('A5', 2)],
]
HYMN_CH = [Dm, Bb, Gm, A7, Dm, F_, Gm, A7]
HYMN_BARS = [
    [('D5', 2), ('F5', 1), ('A5', 1)],
    [('D6', 2), ('C6', 1), ('Bb5', 1)],
    [('G5', 2), ('Bb5', 1), ('G5', 1)],
    [('A5', 2), ('C#6', 1), ('E6', 1)],
    [('F6', 2), ('E6', 1), ('D6', 1)],
    [('C6', 2), ('A5', 1), ('F5', 1)],
    [('Bb5', 1), ('A5', 1), ('G5', 1), ('F5', 1)],
    [('E5', .75), ('E5', .25), ('A5', 3)],
]
HEAD = A_BARS[:2]                         # Themenkopf (zwei Takte) für das Chaos-Fragment

b = 0
# ── Intro (8): die acht Hornrufe, Pauken-Galopp von Takt 1 ───────────────────────────────
INTRO_CH = [Dm, Dm, Dm, Dm, F_, A7, Gm, Bb]
for k, pitch in enumerate(CALL_PITCHES):
    ch = INTRO_CH[k]
    assert pn(pitch) % 12 in pcs(ch), (pitch, k)                       # jeder Ruf ist Akkordton
    call(pitch, b + k, 0, 3.6, 108)
    L = {'timp', 'contra'}
    if k >= 1: L |= {'spic'}
    if k >= 2: L |= {'trem'}
    if k >= 3: L |= {'toms'}
    if k >= 4: L |= {'kick', 'trb'}
    if k >= 5: L |= {'hit2', 'choir'}
    bar_acc(b + k, ch, L, v=0.9 + 0.02 * k)
    if k >= 2:                              # Brust des vorigen Rufs bleibt als leiser Nachhall im Tremolo-Register
        ad('flute', b + k, 0, 0.7, pn(CALL_PITCHES[k - 1]) + 12, 50)
crash(b, 100)
snare_roll(b + 7, 2, 8, 60, 118); timp_roll(b + 7, 2, 8, 45, 80, 116)
b += 8

# ── Thema A (8): Trompete trägt das Hauptthema ────────────────────────────────────────────
mel('trumpet', b, A_BARS, vel=100, chords=A_CH_OPEN)
mel('trumpet', b + 7, [A_END_OPEN], vel=100)
for k, ch in enumerate(A_CH_OPEN):
    bar_acc(b + k, ch, {'timp', 'spic', 'contra', 'trem', 'toms'} | ({'hit'} if k in (0, 4) else set()), v=1.0)
crash(b, 108)
snare_roll(b + 7, 3, 4, 70, 100)
b += 8

# ── Thema A' (8): Trompete + Violine + Flöte, Blech unten, Chor, Harfe, Hörner-Gegenstimme ─────
mel('trumpet', b, A_BARS, vel=100); mel('trumpet', b + 7, [A_END_CLOSED], vel=100)
mel('vln', b, A_BARS, vel=88); mel('vln', b + 7, [A_END_CLOSED], vel=88)
mel('flute', b, A_BARS, vel=76, octave=1); mel('flute', b + 7, [A_END_CLOSED], vel=76, octave=1)
mel('brass', b, A_BARS, vel=84, octave=-1, legato=.85); mel('brass', b + 7, [A_END_CLOSED], vel=84, octave=-1, legato=.85)
for k, ch in enumerate(A_CH_CLOSED):
    bar_acc(b + k, ch, {'timp', 'spic', 'contra', 'trem', 'toms', 'choir', 'hornhold', 'harp', 'trb'} | ({'hit'} if k % 4 == 0 else set()), v=1.04)
crash(b, 112)
scale_run('flute', b + 7, 3, pn('D5'), 4, up=True, vel=84)
b += 8

# ── Steigerung B (8): Wurzeln steigen, Sequenzen ────────────────────────────────────────────
mel('trumpet', b, B_BARS, vel=102, chords=B_CH)
mel('vln', b, B_BARS, vel=90)
mel('flute', b, B_BARS, vel=74, octave=1)
mel('brass', b, B_BARS, vel=86, octave=-1, legato=.85)
for k, ch in enumerate(B_CH):
    L = {'timp', 'spic', 'contra', 'trem', 'toms', 'choir', 'harp', 'stab', 'kick'}
    if k % 2 == 0: L.add('hit')
    bar_acc(b + k, ch, L, v=1.04 + 0.01 * k)
crash(b, 112)
snare_roll(b + 7, 1, 12, 70, 120); timp_roll(b + 7, 1, 12, 45, 90, 120)
b += 8

# ── Chaos C (16): acht Spieler, acht Zweitakter – der Themenkopf in acht Tonarten ───────────
shifts = [0, 2, 3, 5, 8, 10, 1]
rng.shuffle(shifts)
shifts.append(7)                                                    # zuletzt a-Moll (Dominante von d)
players = [('trumpet', 0, 100), ('vln', 0, 96), ('hornA', 0, 100), ('trb', -1, 98),
           ('flute', 1, 92), ('brass', 0, 96), ('oboe', 0, 98), ('choir', 0, 96)]
rng.shuffle(players)
pl_pans = pans[:]; rng.shuffle(pl_pans)
STOPS = {3: 3.0, 6: 2.0}                                            # Blöcke mit Generalpause im zweiten Takt
for blk in range(8):
    s = shifts[blk]; inst, octv, vel = players[blk]; b0 = b + 2 * blk
    ch = (Dm[0], 'm')
    song.cc(inst, song.bar(b0), 10, pl_pans[blk])
    mel(inst, b0, HEAD, shift=s, vel=vel, octave=octv, chords=[Dm, Dm])
    if blk % 2 == 1:                                                # zweiter Spieler überlagert, eine Oktave höher
        mel('trumpet' if inst != 'trumpet' else 'vln', b0, HEAD, shift=s, vel=vel - 14, octave=1)
    for j in range(2):
        CUT[0] = STOPS[blk] if (blk in STOPS and j == 1) else 4.0
        L = {'timp', 'spic', 'contra', 'toms', 'stab'}
        if j == 0: L |= {'hit', 'trem'}
        if blk >= 4: L |= {'choir'}
        bar_acc(b0 + j, ch, L, s=s, v=1.1)
        CUT[0] = 4.0
    if blk in STOPS:                                                # Pause, dann Hit + Neustart
        dd(b0 + 1, STOPS[blk], KICK, 110)
    crash(b0, 110)
    if blk == 7:
        snare_roll(b0 + 1, 0, 16, 60, 125); timp_roll(b0 + 1, 0, 16, 45, 80, 124)
b += 16

# ── Hymne D (8): Blechchoral, Chor, Hits – der Höhepunkt ──────────────────────────────────────
mel('trumpet', b, HYMN_BARS, vel=108, chords=HYMN_CH)
mel('brass', b, HYMN_BARS, vel=96, octave=-1, legato=.97)
mel('vln', b, HYMN_BARS, vel=84, octave=0)
mel('flute', b, HYMN_BARS, vel=70, octave=1)
mel('hornA', b, HYMN_BARS, vel=92, octave=-1, legato=.97)
for k, ch in enumerate(HYMN_CH):
    bar_acc(b + k, ch, {'timp', 'spic', 'contra', 'trem', 'toms', 'choir', 'harp', 'trb', 'kick', 'hit', 'hit2'}, v=1.12)
    for m in tones(ch, 4): ad('oboe', b + k, 0, 3.9, m, hv(74))
    dd(b + k, 1, CLAP, 70); dd(b + k, 3, CLAP, 76)
crash(b, 118); crash(b + 4, 112)
snare_roll(b + 7, 2, 8, 70, 120)
b += 8

# ── Ausdünnen E (8): die Plätze scheiden aus ──────────────────────────────────────────────────
E_LEAVE = {'choir': 0, 'brass': 1, 'trb': 2, 'horn': 3, 'flute': 4, 'trem': 5, 'spic': 6, 'trumpet': 7}   # Spieler spielt bis einschließlich Takt n
for k, ch in enumerate(A_CH_OPEN):
    alive = {name for name, lv in E_LEAVE.items() if k <= lv}
    L = {'timp', 'contra', 'harp'}
    if 'spic' in alive: L.add('spic')
    if 'trem' in alive: L.add('trem')
    if 'choir' in alive: L.add('choir')
    if 'trb' in alive: L |= {'stab'}
    if 'horn' in alive: L.add('hornhold')
    if k < 2: L |= {'toms', 'kick'}
    bar_acc(b + k, ch, L, v=1.0 - 0.015 * k)
mel('trumpet', b, A_BARS[:6], vel=100)                               # Trompete bis Takt 5, danach übernimmt die Violine
mel('brass', b, A_BARS[:2], vel=84, octave=-1, legato=.85)
mel('flute', b, A_BARS[:5], vel=74, octave=1)
mel('vln', b + 6, [A_BARS[6]], vel=98); mel('vln', b + 7, [A_END_OPEN], vel=98)
crash(b + 0, 100)
b += 8

# ── Letzter Sitz F (8): Solo-Violine mit dem Hauptthema ───────────────────────────────────────
mel('vln', b, A_BARS, vel=108, legato=1.0); mel('vln', b + 7, [A_END_OPEN], vel=108, legato=1.0)
for k, ch in enumerate(A_CH_OPEN):
    L = {'timp', 'contra', 'harp'}
    if k >= 2: L.add('spic8')
    if k >= 4: L |= {'trem', 'timp'}
    if k >= 6: L |= {'choir'}
    bar_acc(b + k, ch, L, v=0.80 + 0.03 * k)
timp_roll(b + 7, 2, 8, 45, 60, 112)
b += 8

# ── Rückkehr G (8): Tutti, dann die Hornrufe gedrängt ─────────────────────────────────────────
mel('trumpet', b, A_BARS[:4], vel=106); mel('vln', b, A_BARS[:4], vel=94)
mel('flute', b, A_BARS[:4], vel=78, octave=1); mel('brass', b, A_BARS[:4], vel=92, octave=-1, legato=.85)
mel('hornA', b, A_BARS[:4], vel=92, octave=-1)
for k in range(4):
    bar_acc(b + k, A_CH_OPEN[k], {'timp', 'spic', 'contra', 'trem', 'toms', 'choir', 'harp', 'stab', 'kick', 'hit'}, v=1.1)
crash(b, 118)
G_CH = [Gm, Bb, F_, A7]
G_CALLS = [('G4', 'Bb4'), ('D4', 'F4'), ('A4', 'C5'), ('D5', 'E5')]
for k in range(4):
    bar = b + 4 + k; ch = G_CH[k]
    bar_acc(bar, ch, {'timp', 'spic', 'contra', 'trem', 'toms', 'choir', 'kick', 'hit'} | ({'harp'} if k < 3 else set()), v=1.12)
    for h, pitch in enumerate(G_CALLS[k]):
        assert pn(pitch) % 12 in pcs(ch) or ch == A7, (pitch, k)
        song.cc('hornA' if h == 0 else 'hornB', song.bar(bar) + 2 * h, 10, PLAYER_PAN[pitch])
        inst = 'hornA' if h == 0 else 'hornB'; t = song.bar(bar) + 2 * h; p = pn(pitch)
        song.add(inst, t, .72, p, 112); song.add(inst, t + .75, .23, p, 104); song.add(inst, t + 1, .95, p, 116)
        song.add('trumpet', t, .72, p + 12, 92); song.add('trumpet', t + .75, .23, p + 12, 86); song.add('trumpet', t + 1, .95, p + 12, 96)
snare_roll(b + 7, 2, 8, 70, 122)
b += 8
assert b == BARS, (b, BARS)

sf2, out = cli_paths('bgm_skilltest4.ogg')
song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
