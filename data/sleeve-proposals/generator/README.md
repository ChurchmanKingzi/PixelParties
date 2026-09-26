# Sleeve-Entwürfe – Generator

Die Sleeves werden per Python (Pillow, NumPy, OpenCV) als Pixel-Art erzeugt.
Aus diesem Ordner ausführen, z. B. `python3 s04_slimejar.py` – das Ergebnis landet
als PNG (750×1050) in `data/sleeve-proposals/`.

- `pp.py` – Hilfsfunktionen (Kartenart auf natives Pixelraster zurückrechnen, Freistellen, Canvas, Text)
- `font35.py` – 3×5-Pixelschrift
- `art_*.py`, `slimes.py`, `snowmen.py` – handgepixelte bzw. prozedurale Figuren
- `sprites/` – aus den Kartenbildern freigestellte Figuren
- `s01_…` bis `s10_…` – je ein Sleeve
