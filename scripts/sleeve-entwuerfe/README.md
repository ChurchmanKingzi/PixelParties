# Sleeve-Entwürfe

Generator-Skripte für die Sleeve-Entwürfe in `data/shop/sleeve-entwuerfe/`.
Die Entwürfe liegen bewusst **nicht** in `data/shop/sleeves/`, damit sie erst nach Auswahl im Shop erscheinen.

Alle Motive werden auf einer 250×350-Pixel-Leinwand gebaut und ×3 (Nearest Neighbor) auf 750×1050 hochskaliert.
Figuren stammen aus den Kartenbildern (`cards/`), die dafür auf ihre native Pixelauflösung (~76×51) zurückgerechnet werden,
sowie aus den Area-Sprites unter `public/areas/`.

| Skript | Sleeve |
|---|---|
| `s01_deepsea.py` | 01 Tiefsee-Abgrund |
| `s02_mary.py` (+ `mary_sprite.py`) | 02 Engelsherz (Cute) |
| `s03_blueprint.py` | 03 Future-Tech-Blaupause |
| `s04_cosmic.py` | 04 Kosmische Tiefen |
| `s05_cool.py` | 05 Wowhalla-Regenbogen |
| `s06_lunatic.py` | 06 Mondzyklus |
| `s08_chess.py` | 08 König der Könige |
| `s09_bees.py` | 09 Bomblebee-Wabe |

Benötigt Python 3 mit `pillow`, `numpy` und `scipy`:

```
pip install pillow numpy scipy
cd scripts/sleeve-entwuerfe
python3 s01_deepsea.py
```
