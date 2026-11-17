# -*- coding: utf-8 -*-
"""Runde-4-Bausteine der Gruppe Zirkus/Ritter: Knight of Kings [B]/[W] trippeln seitlich wie Krabben, statt zu blinzeln (Ritterhelm: nichts blinzelt).

    KrabbenRitter(spr, …, start_richtung=±1)   wie anim_schach.Ritter (Atmen, Schwertwippen, Lichtband, Sparkles unverändert), aber
        * KEIN Blinzeln, KEIN Fußtippen;
        * die GANZE Figur trippelt seitlich: 3 px in eine Richtung, 6 px zurück, 3 px wieder zur Mitte (also ±3 px um die Ruhelage), 1 px je Schritt, 4 Frames je Schritt:
          Frame 1: der vorausgehende Stiefel hebt sich 1 px und setzt 1 px seitwärts; Frame 2: er steht, der Körper (mit Schwert) rückt nach;
          Frame 3: der andere Stiefel hebt sich und zieht nach; Frame 4: beide stehen. Alles starr in ganzen Pixeln, die Stiefel liegen hinter dem Saum.
"""
import math

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

WEG = 3          # Leinwand je Seite um so viele Pixel breiter (Trippelweg)


class KrabbenRitter(Sc.Ritter):
    def __init__(self, spr, start_richtung=1, **kw):
        kw.setdefault('blink', ())
        super().__init__(spr, **kw)
        self.W += 2 * WEG
        self.OFF = (self.OFF[0] + WEG, self.OFF[1])
        assert self.N % 48 == 0
        self.richtungen = [start_richtung] * 3 + [-start_richtung] * 6 + [start_richtung] * 3          # 12 Schritte à 4 Frames

    def gang(self, i):
        """(Körper-dx, (dx, dy) vorderer Stiefel, (dx, dy) hinterer Stiefel, Richtung) im Frame i."""
        j = (i - 1) % 48                                   # Frame 0 = Ruhelage (beide Stiefel stehen, Figur in der Mitte)
        schritt, t = j // 4, j % 4
        x = sum(self.richtungen[:schritt])
        r = self.richtungen[schritt]
        if t == 0:
            return x, (x + r, -1), (x, 0), r
        if t == 1:
            return x + r, (x + r, 0), (x, 0), r
        if t == 2:
            return x + r, (x + r, 0), (x + r, -1), r
        return x + r, (x + r, 0), (x + r, 0), r

    def frame(self, i):
        N, p, OFF = self.N, self.p, self.OFF
        spr = self.spr
        rest = ~(self.m_plus | self.m_d1 | self.m_d2 | self.m_schwert | self.m_fuss_l | self.m_fuss_r) & L.deckend(spr)
        koerper = self._ebene(rest)
        brust = Hm.stufe(i, p['brust_per'], 2)
        koerper = Hm.atmen(koerper, OFF[1] + 16, OFF[1] + 8, brust, 0)
        sw = self._ebene(self.m_schwert)
        if self.rampe:
            Hm.lichtband(sw, self.m_klinge, OFF, i, N, p['band'], 14, self.rampe, stufen=2, breite=3.2, achse=(1.0, 0.0), kern=3)
        dy_spitze = Sc.rund(2.0 * math.sin(L.sinus(i, N / p['kipp_zyklen']) + 0.0)) * p['kipp_vz']
        sw = Sc.kippen(sw, OFF, 19, dy_spitze, 3)
        dy_hand = -brust
        sw = L.versetze(sw, 0, dy_hand)
        # Krabbengang: Körper + Schwert starr um kx, Stiefel einzeln
        kx, vorn, hinten, r = self.gang(i)
        (lx, ly), (rx, ry) = (hinten, vorn) if r > 0 else (vorn, hinten)          # nach rechts geht der rechte Stiefel voraus
        fl, fr = self._ebene(self.m_fuss_l), self._ebene(self.m_fuss_r)
        dyx = Sc.spalten_dy(11, 19, dy_spitze, 3) + dy_hand
        fig = L.zusammen(self.H, self.W, [(fl, lx, ly), (fr, rx, ry), (koerper, kx, 0), (sw, kx, 0)])
        fig = Hm.kontur_schliessen(fig, self.umriss, self.schwarz)
        for (sx, sy, starts, folge) in ((2, 11 + dy_spitze + dy_hand, p['g_plus'], [0, 1, 2, 1, 0]), (11, 10 + dyx, p['g_ring1'], [0, 1, 0]), (11, 17 + dyx, p['g_ring2'], [0, 1, 1, 0])):
            for st in (starts if isinstance(starts, (tuple, list)) else (starts,)):
                stufe = Hm.folge(i, st, folge, N)
                if stufe is not None:
                    Hm.stern4(fig, sx + kx, sy, stufe, self.glitzer_farbe, self.glitzer_farbe, self.glitzer_farbe, OFF)
        return fig
