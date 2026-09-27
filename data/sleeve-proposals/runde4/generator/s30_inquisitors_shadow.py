# -*- coding: utf-8 -*-
"""30 The Inquisitor's Shadow – Schattenbild: der gütige alte Großinquisitor Karian steht (als Halbfigur, wie
auf seiner Karte) vorn im Schein einer Fackel, die vom unteren Bildrand her gegen die Kirchenmauer leuchtet;
sein Gesicht ist von unten angestrahlt. Hinter ihm wächst sein vergrößerter Schatten die Wand hinauf: unten
seine eigenen Schultern, Arme und sein Stab – oben verwandelt sich der Schatten in seine Dämonengestalt mit
Hörnern, rotem Heiligenschein, glühenden Augen und riesigen Fledermausflügeln, die aus den Schultern wachsen.

Quellen (MotiveHawaii.xcf):
  Ebene 240 „Karian“ – der Großinquisitor (Karte „Grand Inquisitor Karian“), gegen „Sichtbar #47“/„#46“
      geprüft; die Figur ist schon im Original eine Halbfigur (endet an der Robe) → vom unteren Bildrand
      angeschnitten wie der Vampir in „Count of the Deep“. Außerdem Umriss für den Schattenkörper.
  Ebene 238 „Karian #6“ – Karians Dämonengestalt (gleiche Karte): Kopf mit Hörnern, Heiligenschein und
      türkisen Augen als Schattenkopf (Heiligenschein + Augen in Originalfarbe, glühend).
  Ebene 233 „Curse“ – die Fledermausflügel der Dämonengestalt (Karte „Curse“), nur die Flügel, als Schattenriss.
  Ebene 250 „Ebene #5“ – Kirchenmauer (violette Ziegel, Kachel 16×8), nach Fackellicht umgefärbt.
Selbst gezeichnet: Fackelschein, Licht/Schatten. Der vergrößerte Schatten ist ein gezeichneter Effekt: die Umrisse
von Ebene 240/238 werden weich auf das 3×-Raster der Mauer übertragen (Faktor 2,6), damit der Schatten dieselbe
Pixelgröße wie die Mauer hat.

Skalierung:
  Hintergrund (Mauer, Fackelschein, Schatten, Flügel): 3× (84×117-Raster)
  Vordergrund (Karian): 6× (42×59-Raster)
"""
import cv2
from s26_30_fkit import *  # noqa

HW = 'MotiveHawaii'
G = Ebene(3)                                    # 84 × 117
gw, gh = G.w, G.h
CX = 42                                         # Mittelachse

# ---------------------------------------------------------------- Schattenmaske (3×-Raster)
priest = sprite('f30_karian', HW, [240])        # 31 × 17
demon = sprite('f30_demon', HW, [238])          # 29 × 20
curse = sprite('f30_curse', HW, [233])          # 54 × 176
SF = 2.6                                        # Vergrößerung des Schattens (Rasterzellen je Original-Pixel)

def smooth_mask(m, f):
    """Umriss weich um f vergrößern und auf dem Zielraster schwellen (gezeichneter Schatten, keine Blockpixel)."""
    h, w = m.shape
    big = cv2.resize(m.astype(np.float32), (int(round(w * f)), int(round(h * f))), interpolation=cv2.INTER_LINEAR)
    return big > 0.5

shadow = np.zeros((gh, gw), bool)
glow = np.zeros((gh, gw, 3), np.uint8); glow_m = np.zeros((gh, gw), bool)

def stamp(mask, x0, y0, colors=None):
    h, w = mask.shape
    for j in range(h):
        for i in range(w):
            X, Y = x0 + i, y0 + j
            if 0 <= X < gw and 0 <= Y < gh and mask[j, i]:
                if colors is not None and colors[j, i, 3] > 0:
                    glow[Y, X] = colors[j, i, :3]; glow_m[Y, X] = True
                else:
                    shadow[Y, X] = True

# (a) Körper = Karians eigener Umriss ab dem Hals (Zeile 10: Schultern, Arme, Robe, Stab)
NECK_P = 10
body = priest[NECK_P:, :, 3] > 0
bm = smooth_mask(body, SF)
BY = gh - bm.shape[0] + 3                       # läuft unten hinter Karian aus dem Bild
BX = CX - int(round(8.5 * SF))
stamp(bm, BX, BY)
neck_y = BY

# (b) Kopf = Dämonenkopf (Zeilen 0–12: Heiligenschein, Hörner, Gesicht), auf den Hals gesetzt
NECK_D = 13
head = demon[:NECK_D, :, 3] > 0
hm = smooth_mask(head, SF)
col = demon[:NECK_D].copy()
red = (col[..., 0] > 150) & (col[..., 1] < 60)                     # Heiligenschein
cyan = (col[..., 2] > 200) & (col[..., 0] < 180)                   # Augen
keep = np.zeros_like(col); keep[red] = col[red]; keep[cyan] = col[cyan]
keep[red, :3] = (236, 30, 36); keep[cyan, :3] = (120, 255, 255)
kbig = cv2.resize(keep, (hm.shape[1], hm.shape[0]), interpolation=cv2.INTER_NEAREST)
HX = CX - int(round(10 * SF))
HY = neck_y - hm.shape[0] + 2
stamp(hm | (kbig[..., 3] > 0), HX, HY, kbig)

# (c) Flügel = Flügel der Curse-Gestalt (ohne ihren Körper), 1 Original-Pixel = 1 Zelle, Wurzeln an den Schultern
cm = curse[..., 3] > 0
cm[:, 72:104] = False                           # Körper der Curse-Figur weglassen, Flügel bleiben
# Flügelwurzeln liegen in der Curse-Figur bei y≈40; auf Schulterhöhe des Schattens setzen (+ leicht darüber)
WY = neck_y + int(1.5 * SF) - 40
WX = CX - 88
stamp(cm, WX, WY)
# Verbindung Flügelwurzel → Schulter (die Flügelarme laufen in die Schultern hinein)
for Y in range(neck_y - 2, neck_y + int(5 * SF)):
    for X in range(CX - 34, CX + 35):
        if abs(X - CX) > 12 and abs(X - CX) < 30 and Y > neck_y + (30 - abs(X - CX)) * 0.25 - 2:
            if 0 <= X < gw and 0 <= Y < gh: shadow[Y, X] = True

# ---------------------------------------------------------------- Mauer mit Fackellicht von unten
tile = layer(HW, 250)[312:320, 352:368, :3].astype(float)     # 8 × 16 Ziegel
def lightv(x, y):                               # Fackel unter dem unteren Bildrand, Mitte
    d = math.hypot((x + .5 - CX) * 0.75, y + .5 - (gh + 12))
    return max(0.0, min(1.0, 1.25 - d / 150))
for y in range(gh):
    for x in range(gw):
        c = tile[y % 8, x % 16]
        l = lightv(x, y)
        q = min(1.0, math.floor(l * 6 + B4[y % 4, x % 4]) / 6)
        if shadow[y, x]:
            v = c * 0.13 + np.array([8, 2, 14])
        else:
            v = c * (0.35 + 0.95 * q) + np.array([70, 34, 0]) * q ** 2   # warmer Fackelschein
        G.a[y, x, :3] = np.clip(v, 0, 255).astype(np.uint8); G.a[y, x, 3] = 255
# Fackelschein am unteren Rand: orange Glut, nach oben geordnet ausgedithert
for y in range(gh - 14, gh):
    for x in range(gw):
        t = (y - (gh - 14)) / 14                # 0 oben … 1 unten
        a = t * t * (1 - abs(x + .5 - CX) / 60)
        if a > B4[y % 4, x % 4] * 0.9 and not shadow[y, x]:
            G.a[y, x, :3] = mix(G.a[y, x, :3], (255, 170, 80), 0.45)
# glühender Heiligenschein + Augen, schwacher roter Hof um den Heiligenschein
for y in range(gh):
    for x in range(gw):
        if glow_m[y, x]: G.a[y, x, :3] = glow[y, x]
hy, hx = np.where(glow_m & (glow[..., 0] > 200))
if len(hy):
    cy, cx = hy.mean(), hx.mean()
    for y in range(int(cy) - 6, int(cy) + 7):
        for x in range(int(cx) - 11, int(cx) + 12):
            if 0 <= x < gw and 0 <= y < gh and not glow_m[y, x]:
                d = math.hypot((x - cx) / 11, (y - cy) / 6)
                if d < 1 and (1 - d) * 0.9 > B4[y % 4, x % 4]:
                    G.a[y, x, :3] = mix(G.a[y, x, :3], (150, 20, 40), 0.55)

cv = Canvas(W, H)
onto(cv, G)

# ---------------------------------------------------------------- Karian 6×, von unten angestrahlt
F = Ebene(6)                                    # 42 × 59
k = priest.copy().astype(float)
h = k.shape[0]
for j in range(h):
    # Robe/Gesicht unten warm aufgehellt, Schädeldecke im Dunkel (Unterlicht)
    t = j / 23.0                                # 0 Scheitel … 1 Robenende
    f = 0.62 + 0.5 * min(1.0, t)
    for i in range(k.shape[1]):
        if k[j, i, 3] == 0: continue
        ff = f if (f * 4 + B4[j % 4, i % 4]) % 1 > 0.25 else f - 0.06
        k[j, i, :3] = np.clip(k[j, i, :3] * ff + np.array([40, 18, 0]) * max(0, t - 0.3), 0, 255)
k = k.astype(np.uint8)
F.put(k, 21 - k.shape[1] // 2, 59 - 23)
onto(cv, F)

print(save(cv, '30_inquisitors_shadow.png'))
