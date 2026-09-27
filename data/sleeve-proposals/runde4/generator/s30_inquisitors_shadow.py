# -*- coding: utf-8 -*-
"""30 The Inquisitor's Shadow – Schattenbild: der gütige alte Großinquisitor Karian steht (als Halbfigur, wie
auf seiner Karte) vorn im Licht einer Fackel, die von unten vorn gegen die Kirchenmauer strahlt. Sein riesiger
Schatten auf der Wand verrät seine wahre Gestalt: den Dämon mit rotem Heiligenschein und Fledermausflügeln.

Quellen (MotiveHawaii.xcf):
  Ebene 240 „Karian“ – der Großinquisitor (Karte „Grand Inquisitor Karian“), gegen „Sichtbar #47“/„#46“
      geprüft; die Figur ist schon im Original eine Halbfigur (endet an der Robe) → vom unteren Bildrand
      angeschnitten wie der Vampir in „Count of the Deep“.
  Ebene 233 „Curse“ – Karians Dämonengestalt mit Flügeln und Heiligenschein (Karte „Curse“), als Schattenriss;
      nur der rote Heiligenschein bleibt farbig.
  Ebene 250 „Ebene #5“ – Kirchenmauer (violette Ziegel, Kachel 16×8), nach Licht umgefärbt.
Selbst gezeichnet: Licht-/Schattenverlauf, Verbindung des Schattens nach unten (gestreckter Schatten des Körpers).

Skalierung:
  Hintergrund (Mauer + Schatten): 3× (84×117-Raster)
  Vordergrund (Karian): 6× (42×59-Raster)
"""
from s26_30_fkit import *  # noqa

HW = 'MotiveHawaii'

# ================================ Mauer + Schatten 3× ===========================================================
G = Ebene(3)                                    # 84 × 117
gw, gh = G.w, G.h
tile = layer(HW, 250)[312:320, 352:368, :3].astype(float)     # 8 × 16 Ziegel
LX, LY = 42, 150                               # Lichtquelle: unten vorn, außerhalb des Bildes

def lightv(x, y):
    d = math.hypot((x + .5 - LX) * 0.8, y + .5 - LY)
    return max(0.0, min(1.0, 1.2 - d / 190))

# Schattenriss: Curse-Sprite 1 Pixel = 1 Rasterzelle, Figur mittig
curse = sprite('f30_curse', HW, [233])          # 54 × 176, Figurmitte x≈87.5
cm = curse[..., 3] > 0
halo = (curse[..., 0] > 200) & (curse[..., 1] < 60) & cm
SX, SY = int(round(42 - 87.5)), 4              # Lage im Raster
shadow = np.zeros((gh, gw), bool); halo_m = np.zeros((gh, gw), bool)
for j in range(curse.shape[0]):
    for i in range(curse.shape[1]):
        X, Y = SX + i, SY + j
        if 0 <= X < gw and 0 <= Y < gh:
            if halo[j, i]: halo_m[Y, X] = True
            elif cm[j, i]: shadow[Y, X] = True
# gestreckter Schatten des Unterkörpers: von der Figur bis hinter Karian nach unten (verjüngt, Robe)
bot = SY + curse.shape[0]
for Y in range(bot - 2, gh):
    t = (Y - bot) / max(1, gh - bot)
    hw = 5 + 3 * t
    for X in range(int(42 - hw), int(42 + hw) + 1):
        if 0 <= X < gw: shadow[Y, X] = True

for y in range(gh):
    for x in range(gw):
        c = tile[y % 8, x % 16]
        l = lightv(x, y)
        q = min(1.0, math.floor(l * 5 + B4[y % 4, x % 4]) / 5)
        if shadow[y, x]:
            col = c * 0.14 + np.array([8, 2, 14])
        else:
            col = c * (0.55 + 0.75 * q) + np.array([46, 22, 0]) * q     # warmes Fackellicht
        G.a[y, x, :3] = np.clip(col, 0, 255).astype(np.uint8); G.a[y, x, 3] = 255
for y in range(gh):
    for x in range(gw):
        if halo_m[y, x]: G.a[y, x, :3] = (236, 30, 36)
# schwacher roter Schein um den Heiligenschein
hy, hx = np.where(halo_m)
if len(hy):
    cy, cx = hy.mean(), hx.mean()
    for y in range(int(cy) - 4, int(cy) + 5):
        for x in range(int(cx) - 6, int(cx) + 7):
            if 0 <= x < gw and 0 <= y < gh and not halo_m[y, x]:
                d = math.hypot((x - cx) / 6, (y - cy) / 3.5)
                if d < 1 and (1 - d) * 0.9 > B4[y % 4, x % 4]:
                    G.a[y, x, :3] = mix(G.a[y, x, :3], (150, 20, 40), 0.6)

cv = Canvas(W, H)
onto(cv, G)

# ================================ Karian 6× (Halbfigur, vom unteren Rand angeschnitten) =======================
F = Ebene(6)                                    # 42 × 59
kar = sprite('f30_karian', HW, [240])          # 31 × 17; Robe endet in Zeile 23, darunter nur der Stab
F.put(kar, 21 - kar.shape[1] // 2, 59 - 23)
onto(cv, F)

print(save(cv, '30_inquisitors_shadow.png'))
