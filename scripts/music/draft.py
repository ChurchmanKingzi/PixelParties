# -*- coding: utf-8 -*-
"""Draft-Musik „Pack by Pack“ → public/music/bgm_draft.ogg

Langes Hintergrundstück für den Draft-Modus (30+ Minuten Spielzeit): 88 BPM, 220 Takte
(600,0 s = 10:00 Minuten) in 16 „Szenen“, nahtlos loopbar. Keine Kampfmusik: neugierig, warm,
nachdenklich, leicht geheimnisvoll, dazwischen funkelnde „Fund“-Momente (Pack öffnet sich).
Eine sanfte Grundbewegung (Woodblock, Sidestick, weiche Toms, sehr leiser Kick, Pizzicato)
trägt das konzentrierte Denken wie ein ruhiger Herzschlag.

Große Form (Takte, 0-basiert) und Tonartenweg (Quinten- und Terzverwandtschaft):
   0  Auftakt        C-Dur        Klavier, Marimba, Flöte – Draft-Motiv wird vorgestellt
  12  Staunen        G-Dur        Harfe in Triolen, Flöte (Wonder-Motiv)
  26  Grübeln        e-Moll       Klarinette, Swing-Pizzicato, Fagott-Gegenstimme
  40  Funkel         A-Lydisch    Kalimba, Harfe, Glockenspiel – Packs öffnen sich
  52  Rätsel         fis-Dorisch  Polymetrik 3:4, E-Piano, Oboe, Chor
  66  Planen         D-Dur        synkopierter Tanz: Klarinette, Marimba, Horn
  82  Hornchoral     B-Dur        Choral, weiche Streicher, Chor
  96  Klaviersolo    g-Moll       Klavier allein (plus leises Pad)
 108  Harfensolo     Es-Dur       Harfe und Flöte, Duett, Glitzer
 120  Marimba-Swing  As-Dur       Marimba/Vibraphon, Swing, laufender Bass
 136  Hemiole        f-Moll       Fagott, Klavier in 3+3+2, Streicher
 150  Schimmer       Des-Lydisch  Glockenspiel, Harfe, Chor – ganz weich
 162  Schatzfund     F-Dur        großes Arrangement: Violine, Streicher, Horn, Marimba
 178  Tanzschritt    d-Dorisch    Cembalo, Blockflöte, Charleston-Rhythmus
 192  Duett          a-Moll       Flöte und Klarinette im Kanon
 204  Rückkehr       C-Dur        wie Szene 1, dann ausdünnend; Klavier allein auf der Dominante G

Motivfamilien (alle diatonisch, als Stufenfolgen definiert und per Umkehrung, Dehnung, Stauchung,
Triolisierung, Sequenz, Gegenstimme verwandelt):
  D  Draft-Motiv (roter Faden): Grundton – Quarte – Terz – Quinte (1 4 3 5), samt Antwort DA und Synkopenform DS
  W  Wonder: dotierter Aufstieg 1 2 3 5, abwärts 4 3 2 7
  T  Thinking: seufzende Abwärtslinie mit Dehnungen
  F  Fund: Dreiklangsaufstieg mit Oktavsprung (Funkeln), FF in 16teln
  G  Dance: synkopierter, hüpfender Plan-Rhythmus
  H  Hymn: Choral in langen Noten (H) und fallend (HB)
Dazu generative Elemente (seed-gesetzt): Arpeggio-Muster und Auslassungen, Akkordumkehrungen
(stimmführungsoptimiert), Walking-Bass-Annäherungstöne, Gegenstimmen aus Akkord-/Skalentönen,
Glitzer-Läufe, Ghost-Notes in der Perkussion.

Der letzte Abschnitt dünnt aus und endet auf G7 (Dominante); jede Szene endet mit einem
Dominantsept-Akkord der nächsten Tonart – so führt auch Szene 16 nahtlos in Szene 1 (C-Dur).
Aufruf:  python3 scripts/music/draft.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 88, 220                       # 220 × 4 × 60/88 = 600,0 s
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen (Name, Start-Instrument, Lautstärke, Panorama) -----------------------------
VOICES = [
    ('bass',  'acbass',  92, 60),   # Bass, Oktave 1–2
    ('pad',   'warm',    66, 64),   # Flächen
    ('pad2',  'slowstr', 60, 50),   # zweite Fläche / Streicher
    ('comp',  'piano',   80, 52),   # Begleitung (Arpeggien, Akkorde)
    ('harp',  'harp',    78, 78),   # Harfe / zweite Begleitung
    ('lead',  'flute',   88, 68),   # Melodie
    ('cnt',   'clarinet',80, 44),   # Gegenstimme
    ('spark', 'glock',   70, 88),   # Glitzer (Glockenspiel)
    ('mal',   'marimba', 78, 36),   # Marimba / Vibraphon / Kalimba
    ('horn',  'horns',   76, 56),   # Horn / Fagott (Linien)
    ('sol',   'piano',   86, 66),   # Solo-Klavier
    ('str',   'pizz',    74, 92),   # Pizzicato / Streicher-Akzente
    ('cho',   'oohs',    50, 64),   # Chor
]
for _n, _i, _v, _p in VOICES: song.inst(_n, _i, _v, _p)

SCALES = {'maj': [0, 2, 4, 5, 7, 9, 11], 'lyd': [0, 2, 4, 6, 7, 9, 11],
          'aeo': [0, 2, 3, 5, 7, 8, 10], 'dor': [0, 2, 3, 5, 7, 9, 10]}
SCENES = []
STATS = {}                                # Tonumfang je Stimme (Prüfung)

def clamp(x, lo, hi): return max(lo, min(hi, x))

# ---- Motive: (Beat, Dauer, Stufe relativ zum Ankerton) --------------------------------------
MOTIFS = {
    'D0': [(0, 1, 0), (1, .5, 3), (1.5, .5, 2), (2, 2, 4)],                       # Draft: 1 4 3 5 (Frage)
    'DA': [(0, 1, 4), (1, .5, 3), (1.5, .5, 2), (2, 2, 0)],                       # Antwort: 5 4 3 1
    'DS': [(0, .75, 0), (.75, .75, 3), (1.5, .5, 2), (2.5, 1.5, 4)],              # Synkopenform
    'Q':  [(0, 1, 0), (1, 1, 1), (2, 1, 2), (3, 1, 4)],                           # aufsteigende Frage
    'W':  [(0, 1.5, 0), (1.5, .5, 1), (2, 1, 2), (3, 1, 4),
           (4, 1.5, 3), (5.5, .5, 2), (6, 1, 1), (7, 1, -1)],                      # Wonder (2 Takte)
    'T':  [(0, 2, 4), (2, 1, 3), (3, 1, 2), (4, 1.5, 1), (5.5, .5, 2), (6, 2, 0)],  # Thinking (2 Takte)
    'F':  [(0, .5, 0), (.5, .5, 2), (1, .5, 4), (1.5, .5, 7), (2, 2, 9)],          # Fund
    'FF': [(0, .25, 0), (.25, .25, 2), (.5, .25, 4), (.75, .25, 7), (1, .25, 9),
           (1.25, .25, 7), (1.5, .5, 11), (2.5, 1.5, 9)],                          # Fund, 16tel
    'G':  [(0, .75, 0), (.75, .75, 2), (1.5, .5, 4), (2, .5, 2), (2.5, 1.5, 1),
           (4, .75, 0), (4.75, .75, 3), (5.5, .5, 5), (6, .5, 4), (6.5, 1.5, 2)],  # Dance (2 Takte)
    'H':  [(0, 2, 0), (2, 2, 2), (4, 3, 4), (7, 1, 3)],                            # Hymn
    'HB': [(0, 2, 4), (2, 2, 3), (4, 2, 2), (6, 2, 0)],                            # Hymn fallend
    'CAD': [(0, 1, 2), (1, 1, 1), (2, 2, 0)],                                      # Kadenz
}
def _warp3(b):                            # Achtel → Triolenachtel
    i = math.floor(b); f = b - i
    return i + (f * 4 / 3 if f < .5 else 2 / 3 + (f - .5) * 2 / 3)
TF = {
    'inv': lambda m: [(b, d, -s) for b, d, s in m],                                # Umkehrung
    'aug': lambda m: [(b * 2, d * 2, s) for b, d, s in m],                         # Dehnung
    'dim': lambda m: [(b / 2, d / 2, s) for b, d, s in m],                         # Stauchung
    'rev': lambda m: [(b, d, s2) for (b, d, _), s2 in zip(m, [x[2] for x in m][::-1])],   # Krebs der Tonhöhen
    'tri': lambda m: [(_warp3(b), d, s) for b, d, s in m],                         # Triolenfeel
    'up2': lambda m: [(b, d, s + 2) for b, d, s in m],                             # Sequenz um eine Terz
}

# ---- Zeitraster (Beats im Takt; Tupel = (Spannweite in Takten, Liste)) ----------------------
TP = {
    'e8': (1, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]), 'q': (1, [0, 1, 2, 3]),
    'tri': (1, [i / 3 for i in range(12)]), 's16': (1, [i * .25 for i in range(16)]),
    'syn': (1, [0, .75, 1.5, 2, 2.75, 3.5]), 'off': (1, [.5, 1.5, 2.5, 3.5]),
    'h': (1, [0, 2]), 'one': (1, [0]),
    'hemfull': (2, [0, 1.5, 3, 4.5, 6, 7]), 'hem': (2, [0, 3, 6]),
    'cha': (2, [0, 1.5, 3, 4.5, 5, 6.5]), 'wk': (1, [0, 1.5, 2.5, 3.5]),
}

class Chord:
    def __init__(self, root, pcs, ok=(), name=''):
        self.root = root % 12; self.pcs = [p % 12 for p in pcs]
        self.ok = set(self.pcs) | set(p % 12 for p in ok); self.name = name
    def key(self): return (self.root, tuple(self.pcs))

def stack(ch, lo, inv=0, n=3):
    """Akkord als Schichtung ab `lo`; inv = Umkehrung (rotierte Reihenfolge der Töne)."""
    pcs = ch.pcs; k = inv % len(pcs); order = (pcs[k:] + pcs[:k])[:n]
    out = []; m = lo
    for pc in order:
        mm = m
        while mm % 12 != pc: mm += 1
        out.append(mm); m = mm + 1
    return out

class Sc:
    """Eine Szene: Tonart, Akkordfolge, Hilfsfunktionen für Schichten."""
    def __init__(self, name, b0, L, pc, mode, prog, seed, nxt, lvl=1.0, swing=False, pre='4', arc=None, info=''):
        self.name, self.b0, self.L, self.pc, self.mode, self.info = name, b0, L, pc, mode, info
        self.base = 48 + pc; self.scale = SCALES[mode]
        self.spcs = {(pc + s) % 12 for s in self.scale}
        self.rng = random.Random(seed); self.lvl = lvl; self.sw = swing
        self.arc = arc or [(0, .8), (L / 2, 1.0), (L, .8)]
        assert len(prog) == L - 1, (name, len(prog), L)
        self.chords = [self.mk(t) for t in prog]
        dom = Chord(nxt + 7, [nxt + 7, nxt + 11, nxt + 2, nxt + 5], name='V7')
        self.chords.append((self.mk(pre), dom))               # letzter Takt: Vorbereitung + Dominantsept der nächsten Tonart
        # Tonika-Index (Stufenzählung ab base = Oktave 3), Melodielage nahe MIDI 66
        cand = [(abs(self.P(i) - 66) - (0.1 if i > 7 else 0), i) for i in (0, 7, 14)]
        self.T = min(cand)[1]
        self.k = {}; self.prevv = {}
        self.keyname = '%s-%s' % (['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc], mode)
        SCENES.append(self)

    # --- Harmonie ---
    def mk(self, tok):
        if isinstance(tok, tuple): return tuple(self.mk(t) for t in tok)
        d = int(tok[0]) - 1; suf = tok[1:]
        deg = lambda k: (self.pc + self.scale[(d + k) % 7]) % 12
        third = deg(3) if 's' in suf else deg(2)
        pcs = [deg(0), third, deg(4)]; ok = [deg(6), deg(1)]
        if '7' in suf: pcs.append(deg(6))
        if 'a' in suf: pcs.append(deg(1))
        if (third - deg(0)) % 12 == 4: ok.append(deg(5))
        return Chord(deg(0), pcs, ok, tok)
    def chord_at(self, t):
        bar = clamp(int(t // 4), 0, self.L - 1); c = self.chords[bar]
        if isinstance(c, tuple): return c[0] if (t - 4 * bar) < 2 else c[1]
        return c
    def P(self, idx): return self.base + 12 * (idx // 7) + self.scale[idx % 7]
    def arcv(self, t):
        x = t / 4; a = self.arc
        for (x0, y0), (x1, y1) in zip(a, a[1:]):
            if x <= x1: return y0 + (y1 - y0) * (x - x0) / max(1e-9, x1 - x0)
        return a[-1][1]

    # --- Ausgabe ---
    def warp(self, t):
        if not self.sw: return t
        i = math.floor(t); f = t - i
        return i + (f * 4 / 3 if f < .5 else 2 / 3 + (f - .5) * 2 / 3)
    def note(self, v, t, d, m, vel):
        vel = vel * self.arcv(t) * self.lvl + self.rng.uniform(-3, 3)
        song.add(v, self.b0 * 4 + self.warp(t), max(.08, d), m, clamp(vel, 8, 118))
        s = STATS.setdefault(v, [999, 0]); s[0] = min(s[0], m); s[1] = max(s[1], m)
    def drum(self, t, nt, vel):
        song.dr(self.b0 * 4 + self.warp(t), nt, clamp(vel * (self.arcv(t) ** .5) * (self.lvl ** .5), 20, 112), .15)
    def setv(self, **kw):
        """Instrumente (und optional (Instrument, Lautstärke, Pan)) der Stimmen am Szenenbeginn setzen."""
        t = self.b0 * 4
        for v, spec in kw.items():
            if isinstance(spec, tuple):
                ins, vol, pan = spec; song.cc(v, t, 7, vol); song.cc(v, t, 10, pan)
            else: ins = spec
            song.program(v, t, ins)
        for v, _, _, _ in VOICES: song.cc(v, t, 11, 127)
    def swell(self, v, b0, b1, v0, v1):
        t0, t1 = b0 * 4, b1 * 4; n = int((t1 - t0) * 2)
        for i in range(n + 1): song.cc(v, self.b0 * 4 + t0 + (t1 - t0) * i / n, 11, int(v0 + (v1 - v0) * i / n))

    # --- Zeitraster ---
    def pat(self, b0, b1, kind):
        span, lst = TP[kind]; out = []
        for b in range(b0, b1, span):
            for o in lst:
                t = b * 4 + o
                if t < b1 * 4: out.append(t)
        return out
    def steps(self, b0, b1, step, off=0):
        out = []; t = b0 * 4 + off
        while t < b1 * 4: out.append(t); t += step
        return out

    # --- Melodie ---
    def snap(self, m, t, d):
        c = self.chord_at(t)
        if m % 12 in c.ok or not (t % 2 == 0 or d >= 1.0): return m
        for k in (-1, 1, -2, 2, -3, 3, -4, 4):
            if (m + k) % 12 in c.pcs: return m + k
        return m
    def place(self, voice, bar, mot, rel=0, vel=70, tf=(), lift=0):
        notes = MOTIFS[mot]
        for f in tf: notes = TF[f](notes)
        top = max(self.P(self.T + rel + lift + s) for _, _, s in notes)
        drop = 12 if top > 86 else 0                      # zu hohe Phrasen eine Oktave tiefer
        for b, d, s in notes:
            t = bar * 4 + b
            lim = (self.L - 1) * 4 + 2                    # Melodie endet vor der Dominantsept des Übergangstakts
            if t >= lim: continue
            d = min(d, lim - t)
            m = self.snap(self.P(self.T + rel + lift + s) - drop, t, d)
            self.note(voice, t, d * .94, m, vel + (5 if b == 0 else 0) + (3 if d >= 1.5 else 0))
    def melody(self, voice, plan, vel=70, lift=0):
        """plan: [(Takt, Motiv, Anker, (Transformationen), Lift?) …]"""
        for e in plan:
            bar, mot, rel = e[0], e[1], e[2]
            tf = e[3] if len(e) > 3 else (); lf = e[4] if len(e) > 4 else lift
            self.place(voice, bar, mot, rel, vel, tf, lf)

    # --- Akkordtöne und Stimmführung ---
    def tones(self, ch, lo, hi, ext=False):
        pcs = set(ch.pcs) | (ch.ok if ext else set())
        return [m for m in range(lo, hi + 1) if m % 12 in pcs]
    def vlead(self, voice, ch, lo, hi, n=3):
        prev = self.prevv.get(voice); best = None
        for inv in range(len(ch.pcs)):
            for sh in (-12, 0, 12):
                v = stack(ch, lo + sh, inv, n)
                if v[0] < lo or v[-1] > hi: continue
                cost = (sum(abs(a - b) for a, b in zip(v, prev)) if prev and len(prev) == len(v) else abs(sum(v) / len(v) - (lo + hi) / 2))
                cost += self.rng.random() * 1.5
                if best is None or cost < best[0]: best = (cost, v)
        v = best[1] if best else stack(ch, lo, 0, n)
        self.prevv[voice] = v; return v
    def segs(self, b0, b1):
        out = []
        for b in range(b0, b1):
            c = self.chords[b]
            parts = [(b * 4, b * 4 + 2, c[0]), (b * 4 + 2, b * 4 + 4, c[1])] if isinstance(c, tuple) else [(b * 4, b * 4 + 4, c)]
            for t0, t1, ch in parts:
                if out and out[-1][2].key() == ch.key() and out[-1][1] == t0: out[-1] = (out[-1][0], t1, ch)
                else: out.append((t0, t1, ch))
        return out
    def pad(self, voice, b0, b1, vel=40, lo=52, hi=74, n=3):
        for t0, t1, ch in self.segs(b0, b1):
            for m in self.vlead(voice, ch, lo, hi, n): self.note(voice, t0, t1 - t0 - .05, m, vel)
    def stabs(self, voice, times, lo, hi, n=3, vel=50, dur=.5, strum=0.0):
        for t in times:
            ch = self.chord_at(t)
            for i, m in enumerate(self.vlead(voice, ch, lo, hi, n)): self.note(voice, t + i * strum, dur, m, vel + self.rng.uniform(-3, 3))

    # --- Arpeggien ---
    def arp(self, voice, times, lo, hi, order='up', vel=55, drop=0.0, hold=1.6, maxdur=2.5, ext=False, accent=8):
        pos = self.k.get(voice, 0); dirn = 1; base = 0
        for i, t in enumerate(times):
            if i > 0 and self.rng.random() < drop and t % 4 != 0: continue
            ch = self.chord_at(t)
            tn = self.tones(ch, lo, hi, ext); n = len(tn)
            if n < 3: continue
            if t % 4 == 0: base = self.rng.choice([0, 0, 1, 2])
            if order == 'up': pos += 1; idx = pos % n
            elif order == 'updown':
                pos += dirn
                if pos >= n - 1: pos, dirn = n - 1, -1
                if pos <= 0: pos, dirn = 0, 1
                idx = pos
            elif order == 'alb': idx = clamp([0, 2, 1, 2][i % 4] + base, 0, n - 1)
            elif order == 'rl': idx = clamp([0, 1, 2, 1][i % 4] + base, 0, n - 1)
            elif order == 'rnd':
                pos = clamp(pos + self.rng.choice([-2, -1, 1, 1, 2]), 0, n - 1); idx = pos
            else: idx = 0
            nxt = times[i + 1] if i + 1 < len(times) else t + 2
            d = min(maxdur, (nxt - t) * hold)
            on = (t % 1 == 0)
            self.note(voice, t, d, tn[idx], vel + (accent if t % 4 == 0 else (3 if on else 0)) + self.rng.uniform(-2, 2))
        self.k[voice] = pos

    # --- Bass ---
    def bp(self, pc): return 33 + (pc - 33) % 12
    def bass(self, b0, b1, kind, vel=70, voice='bass'):
        if kind == 'poly3':
            for i, t in enumerate(self.steps(b0, b1, 3)):
                ch = self.chord_at(t); r = self.bp(ch.root)
                self.note(voice, t, 2.4, r if i % 2 == 0 else r + 7, vel + (6 if i % 2 == 0 else 0))
            return
        for b in range(b0, b1):
            t = b * 4; c0 = self.chord_at(t); c1 = self.chord_at(t + 2)
            r0, r1 = self.bp(c0.root), self.bp(c1.root)
            fifth = lambda r: r + 7 if r + 7 <= 52 else r - 5
            nr = self.bp(self.chord_at(t + 4).root) if b + 1 < self.L else r1
            if kind == 'whole':
                self.note(voice, t, 3.9 if c0 is c1 else 1.95, r0, vel + 6)
                if c0 is not c1: self.note(voice, t + 2, 1.95, r1, vel)
            elif kind == 'root5':
                self.note(voice, t, 1.9, r0, vel + 6); self.note(voice, t + 2, 1.9, fifth(r1) if c0 is c1 else r1, vel - 4)
            elif kind == 'walk':
                third = min((m for m in range(r0, r0 + 8) if m % 12 in c0.pcs and m != r0), key=lambda m: m)
                a = [m for m in (nr - 2, nr - 1, nr + 1, nr + 2) if m % 12 in self.spcs]
                appr = self.rng.choice(a) if a else nr - 1
                seq = [r0, third, fifth(r0) if self.rng.random() < .6 else r0 + 12 if r0 + 12 <= 50 else r0, appr]
                if c0 is not c1: seq[2] = r1
                for i, m in enumerate(seq): self.note(voice, t + i, .9, m, vel + (6 if i == 0 else 0) - (4 if i == 3 else 0))
            elif kind == 'pulse':
                for o, m, v in ((0, r0, 8), (.5, r0 + 12 if r0 + 12 <= 50 else r0, -8), (1.5, r0, -4), (2, r1, 4), (3, fifth(r1), -6)):
                    self.note(voice, t + o, .45, m, vel + v)
            elif kind == 'syn':
                for o, m, v in ((0, r0, 8), (.75, r0, -6), (1.5, fifth(r0), -2), (2.5, r1, 2), (3.25, fifth(r1), -6)):
                    self.note(voice, t + o, .6, m, vel + v)
            elif kind == 'tri':
                for o, m, v in ((0, r0, 8), (1.333, fifth(r0), -4), (2.667, r1 + (12 if r1 + 12 <= 50 else 0), 0)):
                    self.note(voice, t + o, 1.2, m, vel + v)
            elif kind == 'hem':
                if b % 2 == 0:
                    for o, k in ((0, 0), (3, 1), (6, 0)):
                        ch = self.chord_at(t + o); r = self.bp(ch.root)
                        self.note(voice, t + o, 2.5 if o < 6 else 1.9, r if k == 0 else fifth(r), vel + (6 if o == 0 else -2))
            elif kind == 'cha':
                if b % 2 == 0:
                    for o, k, v in ((0, 0, 8), (1.5, 1, -4), (4.5, 0, 0), (5, 1, -2), (6.5, 0, -4)):
                        r = self.bp(self.chord_at(t + o).root)
                        self.note(voice, t + o, .8, r if k == 0 else fifth(r), vel + v)

    # --- Gegenstimme aus Akkord-/Skalentönen ---
    def line(self, voice, b0, b1, lo, hi, kind='half', vel=55, rest=0.0, start=None):
        prev = start or (lo + hi) // 2
        sc = [m for m in range(lo, hi + 1) if m % 12 in self.spcs]
        def move(m, k):
            i = min(range(len(sc)), key=lambda j: abs(sc[j] - m)); return sc[clamp(i + k, 0, len(sc) - 1)]
        for b in range(b0, b1):
            t = b * 4
            if self.rng.random() < rest: continue
            tn = self.tones(self.chord_at(t), lo, hi)
            tgt = min(tn, key=lambda m: abs(m - prev) + self.rng.random() * 3)
            nt = self.tones(self.chord_at(t + 4), lo, hi)
            goal = min(nt, key=lambda m: abs(m - tgt)) if nt else tgt
            if kind == 'long':
                self.note(voice, t, 3.9, tgt, vel); prev = tgt
            elif kind == 'half':
                k = 0 if goal == tgt else (1 if goal > tgt else -1)
                sec = move(tgt, k * self.rng.choice([1, 2]))
                self.note(voice, t, 1.95, tgt, vel); self.note(voice, t + 2, 1.95, sec, vel - 6); prev = sec
            elif kind == 'step':
                m = tgt; dirn = 1 if goal >= tgt else -1; seq = [m]
                for _ in range(3): m = move(m, dirn); seq.append(m)
                for i, mm in enumerate(seq): self.note(voice, t + i, .95, mm, vel + (4 if i == 0 else 0))
                prev = seq[-1]

    # --- Glitzer („Fund“-Moment) ---
    def glitter(self, voice, t, n=8, step=.125, lo=72, vel0=40, vel1=70, up=True, tail=2.2):
        c = self.chord_at(t); pcs = set(c.pcs) | c.ok
        tn = [m for m in range(lo, lo + 20) if m % 12 in pcs]
        seq = tn[:n] if up else tn[-n:][::-1]
        for i, m in enumerate(seq):
            self.note(voice, t + i * step, tail if i == len(seq) - 1 else .7, m, vel0 + (vel1 - vel0) * i / max(1, len(seq) - 1))

    # --- Perkussion (leise Grundbewegung) ---
    PERC = {
        'heart': (1, [(0, 36, 8), (.75, 36, -10), (2, 37, -12)], [(2.5, 63), (3.5, 62)]),
        'wood':  (1, [(0, 77, 0), (1, 76, -6), (2, 77, -3), (3, 76, -6)], [(.5, 37), (2.5, 37)]),
        'rim':   (1, [(0, 36, 6), (1, 37, 0), (2, 36, -8), (3, 37, 2)], [(1.5, 63), (3.5, 62)]),
        'tri':   (1, [(0, 36, 8), (1, 77, -8), (1.667, 76, -6), (2, 36, -6), (3, 77, -8), (3.667, 76, -6)], [(2.667, 63)]),
        'syn':   (1, [(0, 36, 6), (.75, 62, -6), (1.5, 63, -2), (2, 37, 0), (2.75, 62, -8), (3.5, 64, -4)], [(1, 60), (3.25, 61)]),
        'bongo': (1, [(0, 60, 0), (.5, 61, -10), (1.5, 60, -6), (2, 61, -4), (2.75, 60, -10), (3.5, 61, -8)], [(1, 76), (3, 77)]),
        'cha':   (2, [(0, 36, 6), (1.5, 37, -4), (3, 63, -8), (4.5, 76, -6), (5, 36, 0), (6.5, 37, -4), (7.5, 62, -10)], [(2, 77), (6, 77)]),
        'hem':   (2, [(0, 47, 0), (3, 47, -4), (6, 47, -6), (1.5, 76, -10), (4.5, 76, -10), (7, 76, -10), (0, 36, -6)], [(5, 62)]),
        'toms':  (1, [(0, 45, 0), (2, 47, -6)], [(3.5, 41)]),
        'soft':  (1, [(0, 36, 0)], []),
    }
    def perc(self, kind, b0, b1, vel=55, ghost=.3):
        if kind == 'poly3':
            for i, t in enumerate(self.steps(b0, b1, 3)):
                self.drum(t, 45 if i % 2 == 0 else 47, vel + (4 if i % 2 == 0 else -4))
            for b in range(b0, b1, 2): self.drum(b * 4 + 2.25, 76, vel - 14)
            return
        span, pat, gh = self.PERC[kind]
        for b in range(b0, b1):
            if (b - b0) % span: continue
            t = b * 4
            for o, nt, dv in pat: self.drum(t + o, nt, vel + dv)
            for o, nt in gh:
                if self.rng.random() < ghost: self.drum(t + o, nt, vel - 22)
    def tomfill(self, bar, vel=48):
        for i, nt in enumerate((50, 48, 47, 45)): self.drum(bar * 4 + 3 + i * .25, nt, vel + i * 4)

# =============================================================================================
# Szenen
# =============================================================================================
def scene01():
    """Auftakt, C-Dur, 12 Takte: Klavier-Arpeggio, das Draft-Motiv stellt sich vor (Klavier → Flöte)."""
    S = Sc('Auftakt', 0, 12, C, 'maj', ['1', '5', '6', '4', '1', '3', '4', '5', '6', '2', '1a'], 11, G, lvl=.82,
           arc=[(0, .85), (4, .9), (8, 1.0), (12, .8)], info='Klavier, Marimba, Flöte, Pizzicato, Glockenspiel – Draft-Motiv vorgestellt')
    S.setv(comp='piano', sol='piano', lead='flute', mal='marimba', bass='pizz', pad='warm', spark='glock', harp='harp')
    S.arp('comp', S.pat(0, 12, 'e8'), 48, 69, 'updown', 52, drop=.08)
    S.place('sol', 1, 'D0', 0, 60); S.place('sol', 3, 'DA', 0, 58)
    S.arp('mal', S.pat(4, 12, 'q'), 55, 76, 'alb', 46, hold=1.2)
    S.bass(4, 12, 'root5', 66); S.perc('heart', 4, 12, 50); S.perc('wood', 8, 12, 46)
    S.melody('lead', [(4, 'D0', 0), (6, 'D0', 1), (8, 'D0', 4, ('inv',)), (9, 'CAD', 0)], 64)
    S.pad('pad', 8, 12, 34)
    S.glitter('spark', 8 * 4, 7, .125, 72, 36, 56); S.glitter('spark', 11 * 4 + 2, 8, .125, 72, 38, 60)
    S.glitter('harp', 11 * 4 + 2.25, 7, .25, 62, 34, 52)

def scene02():
    """Staunen, G-Dur, 14 Takte: Harfe in Triolen (12/8-Gefühl), Flöte singt das Wonder-Motiv."""
    S = Sc('Staunen', 12, 14, G, 'maj', ['1', '4', '1', '5', '6', '4', '1', '5', '2', '5', '3', '6', '4'], 22, E, lvl=.86,
           arc=[(0, .7), (6, 1.0), (10, .95), (14, .8)], info='Harfe (Triolen), Flöte, Klarinette, Streicher – Wonder-Motiv')
    S.setv(harp='harp', lead='flute', cnt='clarinet', pad2='slowstr', bass='acbass', spark='glock', mal='marimba', comp='piano')
    S.arp('harp', S.pat(0, 13, 'tri'), 52, 76, 'rl', 50, hold=2.2, maxdur=2.5)
    S.melody('lead', [(2, 'W', 0), (4, 'W', 2), (6, 'W', 0, ('inv',), 7), (8, 'F', 2, ('tri',)), (10, 'D0', 0, ('tri',), 7), (11, 'DA', 0, ('tri',), 7)], 62)
    S.pad('pad2', 4, 14, 34, 50, 72)
    S.bass(2, 14, 'tri', 62); S.perc('tri', 4, 14, 50)
    S.line('cnt', 8, 13, 52, 70, 'half', 46, rest=.15)
    S.glitter('spark', 8 * 4, 8, 1 / 6, 72, 36, 62)
    S.arp('comp', S.pat(6, 12, 'off'), 55, 70, 'up', 36, hold=1.0)

def scene03():
    """Grübeln, e-Moll, 14 Takte: Klarinette seufzt (Thinking-Motiv), Swing, Walking-Pizzicato, Fagott-Gegenstimme."""
    S = Sc('Grübeln', 26, 14, E, 'aeo', ['1', '6', '3', '7', '1', '4', '6', '5', '1', '7', '6', '4', '1'], 33, A, lvl=.86, swing=True,
           arc=[(0, .8), (7, 1.0), (14, .75)], info='Klarinette, Fagott, Klavier, Walking-Pizzicato, Swing')
    S.setv(lead='clarinet', horn='bassoon', comp='piano', bass='acbass', pad2='slowstr', harp='harp', spark='glock', mal='marimba', pad='warm')
    S.bass(0, 14, 'walk', 66); S.perc('rim', 0, 14, 48)
    S.melody('lead', [(0, 'T', 0), (3, 'T', 2), (6, 'T', 4, ('inv',)), (9, 'D0', 1, ('inv',)), (10, 'DA', 2), (11, 'CAD', 2)], 62)
    S.stabs('comp', S.pat(2, 13, 'off')[::2] + S.pat(2, 13, 'h')[1::2], 50, 70, 3, 46)
    S.line('horn', 6, 13, 43, 62, 'half', 54, rest=.1)
    S.pad('pad2', 8, 14, 32, 52, 72)
    S.glitter('harp', 10 * 4, 6, .25, 64, 34, 52); S.glitter('spark', 12 * 4, 6, .1667, 72, 32, 52)

def scene04():
    """Funkel, A-Lydisch, 12 Takte: Packs öffnen sich – Kalimba, Harfe, Glockenspiel funkeln."""
    S = Sc('Funkel', 40, 12, A, 'lyd', ['1', '2', '1', '5', '6', '2', '3', '5', '1', '2', '1'], 44, Gb, lvl=.9,
           arc=[(0, .8), (6, 1.0), (12, .8)], info='Kalimba, Harfe, Glockenspiel, Vibraphon, Pad – 16tel-Funkeln')
    S.setv(lead='kalimba', harp='harp', spark='glock', mal='vibes', pad='warm', bass='pizz', comp='epiano')
    S.arp('harp', S.pat(0, 12, 's16'), 60, 88, 'rnd', 42, drop=.4, hold=2.0, maxdur=2.0)
    S.melody('lead', [(0, 'F', 0), (1, 'F', 2), (2, 'FF', 0), (3, 'CAD', 2),
                      (4, 'FF', 2), (5, 'FF', 4, ('inv',)), (6, 'F', 0, ('aug',)), (8, 'FF', 0), (9, 'F', 3), (10, 'D0', 0, ('aug',))], 60)
    S.pad('pad', 0, 12, 34, 52, 74)
    for t in (0, 4 * 4, 8 * 4): S.glitter('spark', t, 9, .125, 72, 40, 68)
    S.glitter('spark', 6 * 4 + 2, 7, .125, 72, 36, 60, up=False)
    S.stabs('mal', S.pat(2, 12, 'syn')[1::2], 55, 76, 3, 44, .5)
    S.bass(4, 12, 'pulse', 56); S.perc('bongo', 4, 12, 46); S.perc('soft', 0, 4, 44)

def scene05():
    """Rätsel, fis-Dorisch, 14 Takte: E-Piano-Arpeggio in Punktierten (3:4-Polymetrik), Oboe, Chor."""
    S = Sc('Rätsel', 52, 14, Gb, 'dor', ['1', '1', '4', '4', '1', '7', '1', '2', '4', '4', '7', '7', '1'], 55, D, lvl=.82,
           arc=[(0, .7), (7, 1.0), (14, .75)], info='E-Piano, Oboe, Vibraphon, Chor, 3:4-Polymetrik, weiche Toms')
    S.setv(comp='epiano', lead='oboe', mal='vibes', cho='oohs', bass='contra', pad='warm', spark='glock', harp='harp')
    S.arp('comp', S.steps(0, 13, .75), 54, 78, 'updown', 46, hold=2.4, maxdur=3.0, accent=4)
    S.bass(0, 13, 'poly3', 64); S.perc('poly3', 4, 14, 46)
    S.melody('lead', [(2, 'T', 0, ('aug',)), (6, 'DS', 1), (7, 'DA', 0), (8, 'D0', 0, ('aug',)), (10, 'T', 3, ('inv',)), (12, 'CAD', 2)], 60)
    S.pad('cho', 6, 14, 30, 52, 70); S.pad('pad', 0, 14, 24, 55, 74)
    S.arp('mal', S.steps(8, 13, 1.5, .75), 60, 80, 'rnd', 38, drop=.2, hold=2.0)
    S.glitter('spark', 7 * 4, 6, .1875, 72, 30, 50)

def scene06():
    """Planen, D-Dur, 16 Takte: synkopierter Tanz – Klarinette, Marimba-Stabs, Horn, Conga/Bongo."""
    S = Sc('Planen', 66, 16, D, 'maj', ['1', '4', '5', '1', '6', '4', '5', '5', '1', '4', '2', '5', '3', '6', '4'], 66, Bb, lvl=.72,
           arc=[(0, .8), (8, 1.0), (13, .95), (16, .8)], info='Klarinette, Marimba, Horn, Pizzicato, Congas – synkopiert')
    S.setv(lead='clarinet', mal='marimba', horn='horns', bass='pizz', harp='harp', spark='glock', comp='guitar', pad2='slowstr')
    S.stabs('mal', S.pat(0, 16, 'syn'), 55, 76, 3, 52, .45)
    S.bass(0, 16, 'syn', 64); S.perc('syn', 0, 16, 56)
    S.melody('lead', [(0, 'G', 0, (), 0), (2, 'G', 1), (4, 'G', -1, ('inv',)), (6, 'DS', 2), (7, 'DA', 1),
                      (8, 'G', 2), (10, 'G', 0, ('up2',)), (12, 'DS', 0), (13, 'CAD', 2)], 64)
    S.line('horn', 4, 15, 45, 66, 'half', 52, rest=.1)
    S.arp('comp', S.pat(4, 16, 'off'), 55, 72, 'up', 40, hold=1.0)
    S.pad('pad2', 8, 16, 30, 52, 72)
    S.glitter('harp', 8 * 4, 8, .125, 64, 36, 58); S.tomfill(7, 44); S.tomfill(11, 44)

def scene07():
    """Hornchoral, B-Dur, 14 Takte: warmer Choral – Horn, weiche Streicher, Chor, ruhige Klavierakkorde."""
    S = Sc('Hornchoral', 82, 14, Bb, 'maj', ['1', '5', '6', '3', '4', '1', '2', '5', '6', '4', '1', '2', '5'], 77, G, lvl=.86,
           arc=[(0, .75), (7, 1.0), (14, .7)], info='Horn, Streicher, Chor, Klavier – Choral in langen Noten')
    S.setv(horn='horns', pad2='slowstr', cho='oohs', comp='piano', bass='contra', pad='warm', spark='glock', lead='flute')
    S.melody('horn', [(0, 'H', 0), (2, 'HB', 4), (4, 'H', 2), (6, 'HB', 5), (8, 'H', 4), (10, 'HB', 4), (12, 'CAD', 2)], 70, lift=-7)
    S.pad('pad2', 0, 14, 40, 48, 70, 4)
    S.pad('cho', 4, 14, 32, 55, 72)
    S.arp('comp', S.pat(0, 14, 'q'), 46, 70, 'up', 40, hold=2.2)
    S.bass(0, 14, 'root5', 62); S.perc('heart', 4, 14, 44)
    S.melody('lead', [(8, 'D0', 0, (), 7), (10, 'DA', 0, (), 7)], 44)
    S.glitter('spark', 6 * 4, 7, .25, 72, 32, 50)

def scene08():
    """Klaviersolo, g-Moll, 12 Takte: nur Klavier (linke Hand Arpeggien, rechte Hand Motive) und leises Pad."""
    S = Sc('Klaviersolo', 96, 12, G, 'aeo', ['1', '6', '3', '7', '4', '1', '6', '7', '4', '7', '5'], 88, Eb, lvl=.95,
           arc=[(0, .8), (6, 1.0), (12, .75)], info='Klavier solo (+ leises Pad, Herzschlag am Ende)')
    S.setv(comp='piano', sol='piano', pad='warm', bass='acbass')
    S.arp('comp', S.pat(0, 12, 'e8'), 38, 60, 'alb', 50, hold=2.5, maxdur=3.0, drop=.05)
    S.melody('sol', [(0, 'W', 0), (2, 'D0', 2), (3, 'DA', 1), (4, 'T', 0), (6, 'W', 2, ('inv',)), (8, 'D0', 0, ('aug',)), (10, 'CAD', 1)], 62)
    S.pad('pad', 0, 12, 26, 52, 72)
    S.bass(4, 12, 'whole', 46); S.perc('heart', 8, 12, 38, ghost=0)
    S.glitter('spark', 6 * 4 + 3, 5, .25, 72, 30, 46, tail=1.5)

def scene09():
    """Harfensolo, Es-Dur, 12 Takte: Harfe trägt allein, die Flöte antwortet – Duett mit Glitzer."""
    S = Sc('Harfensolo', 108, 12, Eb, 'maj', ['1', '5', '6', '3', '4', '1', '4', '5', '6', '4', '5'], 99, Ab, lvl=.95,
           arc=[(0, .8), (6, 1.0), (12, .75)], info='Harfe, Flöte, Glockenspiel, leise Toms')
    S.setv(harp='harp', lead='flute', spark='glock', pad='warm', bass='contra', comp='guitar', cnt='clarinet')
    S.arp('harp', S.pat(0, 12, 'e8'), 50, 86, 'updown', 52, hold=2.4, maxdur=3.0, drop=.1)
    S.melody('lead', [(2, 'D0', 0, (), 7), (3, 'DA', 0, (), 7), (6, 'D0', 2, ('dim',)), (7, 'CAD', 2),
                      (8, 'W', 2, (), 7)], 58)
    S.pad('pad', 4, 12, 28, 52, 72)
    for t in (4, 5 * 4 + 2, 9 * 4 + 1): S.glitter('spark', t, 8, .125, 72, 34, 60)
    S.bass(8, 12, 'whole', 52); S.perc('toms', 6, 12, 40, ghost=.15)
    S.line('cnt', 4, 10, 52, 70, 'long', 38, rest=.3)

def scene10():
    """Marimba-Swing, As-Dur, 16 Takte: Marimba und Vibraphon swingen, laufender Bass, Klarinettenlinie."""
    S = Sc('Marimba-Swing', 120, 16, Ab, 'maj', ['1', '6', '2', '5', '1', '3', '4', '5', '6', '2', '5', '1', '4', '2', '5'], 101, F, lvl=.84, swing=True,
           arc=[(0, .8), (8, 1.0), (16, .8)], info='Marimba, Vibraphon, Klarinette, Walking-Bass, Swing')
    S.setv(lead='marimba', comp='vibes', cnt='clarinet', bass='acbass', mal='kalimba', harp='harp', pad2='slowstr', spark='glock')
    S.bass(0, 16, 'walk', 68); S.perc('rim', 0, 16, 50)
    S.melody('lead', [(0, 'G', 0), (2, 'G', 2), (4, 'W', 0), (6, 'DS', 3), (7, 'DA', 2), (8, 'G', 4, ('inv',)),
                      (10, 'T', 2), (12, 'G', 1), (14, 'CAD', 2)], 66)
    S.stabs('comp', S.pat(0, 16, 'off')[1::2] + S.pat(0, 16, 'h')[1::2], 52, 72, 3, 44)
    S.line('cnt', 6, 15, 52, 72, 'step', 46, rest=.35)
    S.pad('pad2', 8, 16, 28, 52, 72); S.perc('bongo', 8, 16, 38, ghost=.5)
    S.glitter('harp', 8 * 4, 7, .1667, 64, 34, 54); S.arp('mal', S.pat(4, 8, 'off'), 60, 78, 'rnd', 36, hold=1.0)

def scene11():
    """Hemiole, f-Moll, 14 Takte: Fagott singt, Klavier phrasiert 3+3+2 über zwei Takte."""
    S = Sc('Hemiole', 136, 14, F, 'aeo', ['1', '1', '4', '4', '6', '6', '7', '7', '4', '6', '7', '5', '1'], 111, Db, lvl=.88,
           arc=[(0, .75), (7, 1.0), (14, .75)], info='Fagott, Klavier, Streicher, 3+3+2-Hemiole')
    S.setv(lead='bassoon', comp='piano', pad2='strings', bass='contra', cnt='oboe', pad='warm', spark='glock', harp='harp')
    S.arp('comp', S.pat(0, 14, 'hemfull'), 48, 72, 'updown', 50, hold=1.9, maxdur=3.0)
    S.bass(0, 14, 'hem', 62); S.perc('hem', 0, 14, 50)
    S.melody('lead', [(2, 'T', 0), (4, 'T', 2), (6, 'W', 0, ('inv',)), (8, 'D0', 0, ('aug',)), (10, 'T', 3), (12, 'CAD', 2)], 66, lift=0)
    S.pad('pad2', 4, 14, 34, 48, 70, 4)
    S.line('cnt', 8, 13, 56, 74, 'long', 44, rest=.2)
    S.glitter('harp', 6 * 4, 7, .1875, 62, 34, 52)

def scene12():
    """Schimmer, Des-Lydisch, 12 Takte: Glockenspiel und Harfe, Chor – sehr weich, fast schwebend."""
    S = Sc('Schimmer', 150, 12, Db, 'lyd', ['1', '2', '1', '2', '5', '6', '1', '2', '3', '5', '1'], 122, F, lvl=1.0,
           arc=[(0, .8), (6, 1.0), (12, .75)], info='Glockenspiel, Harfe, Chor, Pad – ruhig, weit')
    S.setv(spark='glock', harp='harp', pad='warm', cho='oohs', bass='contra', lead='newage', mal='vibes')
    S.melody('spark', [(0, 'H', 0, ('aug',)), (4, 'HB', 4), (6, 'H', 2), (8, 'F', 2, ('aug',)), (10, 'D0', 0, ('aug',))], 56, lift=0)
    S.arp('harp', S.pat(0, 12, 'q'), 49, 85, 'up', 40, hold=3.0, maxdur=4.0)
    S.pad('pad', 0, 12, 36, 50, 74, 4); S.pad('cho', 4, 12, 26, 55, 72)
    S.bass(0, 12, 'whole', 50)
    S.perc('soft', 4, 12, 36, ghost=0); S.perc('wood', 8, 12, 30, ghost=0)
    S.melody('mal', [(2, 'DS', 3, (), -7), (9, 'CAD', 4, (), -7)], 40)

def scene13():
    """Schatzfund, F-Dur, 16 Takte: das größte Arrangement – Violine, Streicher, Horn, Marimba, Klavier."""
    S = Sc('Schatzfund', 162, 16, F, 'maj', ['1', '5', '6', '3', '4', '1', '2', '5', '6', '4', '1', '5', '2', '5', '4'], 133, D, lvl=.72,
           arc=[(0, .8), (5, 1.0), (11, 1.0), (16, .75)], info='Violine, Streicher, Horn, Klavier, Marimba, Harfe – Funde')
    S.setv(lead='violin', pad2='strings', horn='horns', comp='piano', mal='marimba', harp='harp', bass='acbass', spark='glock', pad='warm', cnt='flute')
    S.pad('pad2', 0, 16, 40, 48, 72, 4)
    S.arp('comp', S.pat(0, 16, 'e8'), 46, 68, 'rnd', 46, hold=1.6, drop=.12)
    S.melody('lead', [(0, 'F', 0, (), 7), (1, 'F', 2, (), 7), (2, 'FF', 1, (), 7), (3, 'CAD', 4, (), 7),
                      (4, 'W', 0, (), 7), (6, 'D0', 2, (), 7), (7, 'DA', 1, (), 7),
                      (8, 'H', 2, (), 7), (10, 'FF', 0, ('inv',), 7), (11, 'F', 4, (), 7), (12, 'D0', 0, ('aug',), 7), (14, 'CAD', 3, (), 7)], 70)
    S.line('horn', 4, 15, 45, 64, 'half', 54, rest=.1)
    S.stabs('mal', S.pat(4, 16, 'syn')[1::2], 55, 76, 3, 44, .4)
    S.arp('harp', S.pat(8, 16, 's16'), 64, 86, 'rnd', 34, drop=.6, hold=2.0)
    S.bass(2, 16, 'walk', 66); S.perc('rim', 2, 16, 52); S.perc('bongo', 8, 16, 38, ghost=.4)
    S.glitter('spark', 0, 9, .125, 72, 40, 66); S.glitter('spark', 8 * 4, 9, .125, 72, 40, 66)
    S.tomfill(7, 46); S.tomfill(11, 46)

def scene14():
    """Tanzschritt, d-Dorisch, 14 Takte: Cembalo und Blockflöte über Charleston-Rhythmus (Zwei-Takt-Muster)."""
    S = Sc('Tanzschritt', 178, 14, D, 'dor', ['1', '1', '4', '1', '7', '4', '1', '5', '4', '7', '4', '5', '1'], 144, A, lvl=.82,
           arc=[(0, .8), (7, 1.0), (14, .75)], info='Cembalo, Blockflöte, Pizzicato, Glockenspiel – Charleston-Rhythmus')
    S.setv(comp='harpsichord', lead='recorder', bass='pizz', cnt='guitar', spark='glock', mal='marimba', pad2='slowstr', harp='harp')
    S.stabs('comp', S.pat(0, 14, 'cha'), 50, 72, 3, 52, .5, strum=.03)
    S.bass(0, 14, 'cha', 66); S.perc('cha', 0, 14, 54)
    S.melody('lead', [(2, 'DS', 0, (), 0), (3, 'DA', 0), (4, 'G', 0, ('inv',)), (6, 'G', 3), (8, 'W', 0, ('dim',)), (9, 'Q', 2), (10, 'T', 1, ('dim',)), (11, 'CAD', 2)], 62, lift=7)
    S.arp('cnt', S.pat(6, 13, 'off'), 55, 72, 'alb', 38, hold=1.0)
    S.pad('pad2', 8, 14, 28, 50, 70)
    S.glitter('spark', 6 * 4 + 2, 7, .125, 72, 34, 56); S.glitter('harp', 11 * 4, 6, .25, 62, 32, 50)

def scene15():
    """Duett, a-Moll, 12 Takte: Flöte und Klarinette im Kanon im Abstand eines Taktes, Klavier-Akkorde."""
    S = Sc('Duett', 192, 12, A, 'aeo', ['1', '6', '4', '5', '1', '3', '6', '4', '7', '4', '5'], 155, C, lvl=.86,
           arc=[(0, .8), (6, 1.0), (12, .8)], info='Flöte + Klarinette (Kanon), Klavier, Streicher')
    S.setv(lead='flute', cnt='clarinet', comp='piano', pad2='slowstr', bass='acbass', pad='warm', spark='glock', harp='harp')
    S.melody('lead', [(0, 'W', 0, (), 0), (4, 'T', 2, (), 7), (8, 'D0', 0, ('aug',), 7)], 62)
    S.melody('cnt', [(1, 'W', -2, (), 0), (5, 'T', 0, (), 0), (9, 'D0', -2, ('aug',), 0), (11, 'CAD', 0, (), 0)], 56)
    S.stabs('comp', S.pat(0, 12, 'q')[::2] + S.pat(0, 12, 'off')[1::4], 48, 68, 3, 40)
    S.pad('pad2', 2, 12, 30, 48, 70)
    S.bass(2, 12, 'root5', 62); S.perc('wood', 2, 12, 44, ghost=.2)
    S.glitter('harp', 4 * 4 + 1, 8, .125, 62, 32, 52); S.glitter('spark', 9 * 4, 7, .1667, 72, 32, 52)

def scene16():
    """Rückkehr, C-Dur, 16 Takte: wie Szene 1, dann ausdünnend; Klavier allein auf der Dominante G → Szene 1."""
    S = Sc('Rückkehr', 204, 16, C, 'maj', ['1', '4', '6', '5', '1', '3', '4', '2', '6', '4', '1', '5', '5', '5', '5'], 166, C, lvl=.88, pre='5',
           arc=[(0, .85), (8, 1.0), (12, .8), (16, .68)], info='Klavier, Marimba, Flöte, Horn, dann Klavier allein auf G7')
    S.setv(comp='piano', sol='piano', lead='flute', mal='marimba', bass='pizz', pad='warm', spark='glock', harp='harp', horn='horns')
    S.arp('comp', S.pat(0, 15, 'e8'), 48, 69, 'alb', 52, drop=.1)
    S.arp('mal', S.pat(0, 8, 'q'), 55, 76, 'alb', 44, hold=1.2)
    S.bass(0, 8, 'root5', 62); S.perc('heart', 0, 8, 46); S.perc('wood', 4, 8, 42)
    S.melody('lead', [(0, 'D0', 0, ('aug',)), (2, 'DA', 0, (), 0), (4, 'D0', 2), (5, 'DS', 1), (6, 'D0', 4, ('inv',)), (7, 'CAD', 2)], 62)
    S.melody('horn', [(8, 'H', 0, (), -7), (10, 'HB', 3, (), -7)], 54)
    S.pad('pad', 8, 16, 34, 52, 72)
    S.bass(8, 12, 'whole', 52); S.perc('heart', 8, 10, 36)
    S.melody('sol', [(12, 'Q', 0, ('aug',)), (14, 'Q', 4, (), 0)], 52)
    S.glitter('spark', 0, 7, .125, 72, 34, 54)
    S.glitter('harp', 15 * 4 + 2, 6, .25, 62, 34, 50)
    S.bass(12, 16, 'whole', 54)

for _f in (scene01, scene02, scene03, scene04, scene05, scene06, scene07, scene08,
           scene09, scene10, scene11, scene12, scene13, scene14, scene15, scene16): _f()

assert sum(s.L for s in SCENES) == BARS and all(a.b0 + a.L == b.b0 for a, b in zip(SCENES, SCENES[1:]))

# ---- Prüfungen der Komposition (vor dem Rendern) ------------------------------------------------
def check_composition():
    print('Szenen: Takte, Tonart, Dauer, Besetzung')
    for s in SCENES:
        print('  %3d +%2d  %-14s %-8s %5.1fs  %s' % (s.b0, s.L, s.name, s.keyname, s.L * 4 * 60 / BPM, s.info))
    print('Tonumfang je Stimme (MIDI):', {k: tuple(v) for k, v in STATS.items()})
    # Taktsignaturen der Tonhöhen-Stimmen: (Voice, Position im Takt in 16teln, Tonhöhe)
    per_bar = [set() for _ in range(BARS)]; hist = [[0.0] * 12 for _ in range(BARS)]
    names = {ch: nm for nm, (ch, _) in song.ch.items()}
    for t, order, m in song.ev:
        if order != 1 or m.type != 'note_on' or m.channel == 9: continue
        beat = t / TPB; b = int(beat // 4)
        if b >= BARS: continue
        per_bar[b].add((names[m.channel], int(round((beat - 4 * b) * 4)), m.note)); hist[b][m.note % 12] += 1
    worst = (0, 0, 0); runs = []
    sim = lambda a, b: len(a & b) / max(1, len(a | b))
    for i in range(BARS):
        for j in range(i + 1, BARS):
            if sim(per_bar[i], per_bar[j]) >= .8:
                k = 1                                           # Länge der Folge ähnlicher Takte
                while i + k < BARS and j + k < BARS and j + k != i and sim(per_bar[i + k], per_bar[j + k]) >= .8: k += 1
                if k > worst[0]: worst = (k, i, j)
                runs.append((k, i, j))
    near = sum(1 for k, i, j in runs)
    # zweite, gröbere Signatur: Tonhöhenklassen-Histogramm (Dauer-gewichtet) + Rhythmus (Einsätze auf 16tel-Raster)
    import numpy as np
    pc = np.zeros((BARS, 12)); rh = np.zeros((BARS, 16))
    for t, order, m in song.ev:
        if order != 1 or m.type != 'note_on' or m.channel == 9: continue
        beat = t / TPB; b = int(beat // 4)
        if b < BARS: pc[b, m.note % 12] += 1; rh[b, int(round((beat - 4 * b) * 4)) % 16] += 1
    nrm = lambda a: a / np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-9)
    Cp, Cr = nrm(pc) @ nrm(pc).T, nrm(rh) @ nrm(rh).T
    sim2 = (Cp >= .97) & (Cr >= .97)
    best2 = (0, 0, 0)
    for i in range(BARS):
        for j in range(i + 1, BARS):
            if not sim2[i, j]: continue
            k = 1
            while i + k < BARS and j + k < BARS and sim2[i + k, j + k]: k += 1
            if k > best2[0]: best2 = (k, i, j)
    print('Grobe Signatur (Tonhöhenklassen cos ≥ 0,97 und Rhythmus cos ≥ 0,97): ähnliche Taktpaare %d von %d, längste Folge %d Takte %s'
          % (int(sim2.sum() - BARS) // 2, BARS * (BARS - 1) // 2, best2[0], best2[1:]))
    # Skalenprüfung: Töne außerhalb der Szenentonart (außer Dominantsept im Übergangstakt)
    bad = 0
    for t, order, m in song.ev:
        if order != 1 or m.type != 'note_on' or m.channel == 9: continue
        b = int(t / TPB // 4)
        s = next(x for x in SCENES if x.b0 <= b < x.b0 + x.L)
        if b == s.b0 + s.L - 1 and (t / TPB - 4 * b) >= 2: continue
        if m.note % 12 not in s.spcs: bad += 1
    print('Töne außerhalb der Tonleiter der Szene (ohne Übergangs-Dominante):', bad)
    print('Ähnlichkeit (Jaccard ≥ 0,8 über Stimme/Position/Tonhöhe): ähnliche Taktpaare %d, längste ähnliche Folge %d Takte %s' % (near, worst[0], worst[1:] if worst[0] else ''))
    # Anzahl verschiedener Ankerakkorde je Szene
    for s in SCENES:
        ks = {(c[0] if isinstance(c, tuple) else c).key() for c in s.chords}
        print('  %-14s Akkorde %d' % (s.name, len(ks)), end=';')
    print()

check_composition()
if os.environ.get('DRAFT_NORENDER'): raise SystemExit(0)
sf2, out = cli_paths('bgm_draft.ogg')
song.render(sf2, out, target_rms=0.22)
