# Sleeve-Generatoren

Python-Skripte, mit denen die Shop-Sleeves `sleeve4.png` bis `sleeve13.png` in `data/shop/sleeves/` erzeugt wurden.
Die Skripte schreiben nach `data/shop/sleeve-entwuerfe/` (nicht eingecheckt, Pfad per `PP_OUT` änderbar). Übernommene Motive
werden von dort nach `data/shop/sleeves/` kopiert.

Alle Motive werden auf einer 250×350-Pixel-Leinwand gebaut und ×3 (Nearest Neighbor) auf 750×1050 hochskaliert.
Figuren stammen aus den Kartenbildern (`cards/`), die dafür auf ihre native Pixelauflösung (~76×51) zurückgerechnet werden,
sowie aus den Area-Sprites unter `public/areas/`.

| Skript | Sleeve im Shop |
|---|---|
| `s01_deepsea.py` | `sleeve4.png` – Tiefsee-Abgrund |
| `s04_cosmic.py` | `sleeve5.png` – The Eye Sees You |
| `s03_blueprint.py` | `sleeve6.png` – Future-Tech-Blaupause |
| `s05_cool.py` | `sleeve7.png` – Wowhalla |
| `s08_chess.py` | `sleeve8.png` – King of Kings |
| `s06_lunatic.py` | `sleeve9.png` – Lunatic Cycle |
| `s12_temple.py` | `sleeve10.png` – Temple of Sacrifice |
| `s13_big_gwen.py` | `sleeve11.png` – Big Gwen |
| `s15_smugglers_pier.py` | `sleeve12.png` – Smuggler's Pier |
| `s14_pangaia.py` | `sleeve13.png` – Pangaia |

Benötigt Python 3 mit `pillow`, `numpy` und `scipy`:

```
pip install pillow numpy scipy
cd scripts/sleeve-entwuerfe
python3 s01_deepsea.py
```
