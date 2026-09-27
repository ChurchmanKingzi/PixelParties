# Sleeve-Entwürfe – Generator

Die Sleeves werden per Python (Pillow, NumPy, OpenCV) als Pixel-Art erzeugt – auf einem
250×350-Raster (3 px pro Pixel, wie die bestehenden Deepsea-/Wowhalla-Sleeves).
Aus diesem Ordner ausführen, z. B. `python3 v2_04_slimejar.py` – das Ergebnis landet
als PNG (750×1050) in `data/sleeve-proposals/`.

- `pp.py` – Basis: Kartenart auf natives Pixelraster zurückrechnen, Freistellen, Canvas, Text
- `px2.py` – v2-Werkzeuge: Scale2x/Scale3x, Form-Schattierung mit Dithering, Relief-Shader
  (Höhenkarte → Licht), Flächen-Renderer für Figuren
- `font35.py` – 3×5-Pixelschrift
- `slimes2.py` – Slimes im Ingame-Stil (5 Original-Sprites in `sprites/slimes/` + abgeleitete)
- `snowmen2.py` – Mischief-Militia-Schneemänner im Ingame-Stil
- `art_*.py`, `skelking2.py`, `smugcoin.py` – handgepixelte Figuren/Icons
- `sprites/` – aus den Kartenbildern freigestellte Figuren
- `v2_01_…` bis `v2_05_…`, `v4_09_doomclock.py` – aktive Sleeves (Doom Clock: Uhr nach Kartenvorlage)
- `v2_06_…`, `v2_07_…`, `v2_08_…`, `v2_10_…` – verworfene Entwürfe (Bilder in `../verworfen/`)
- `art_barker_front.py` – Barker-Front-Sprite im Handheld-Stil; `detail_skull_king.py` – Krone, Schwert, Schädel in voller Auflösung
