# Avatar-Generator

**Regel: Avatare werden ausschließlich aus den Motiven (Repo PixelPartiesSprites, `*.xcf` via Git LFS) gebaut – nie aus
den Kartenbildern (`cards/`), die sind vom Kartenprogramm interpoliert und damit verschwommen.**

- `picks.py` – Liste der neuen Avatare: (ID, Kartenname, cx, cy[, Kantenlänge]). Die Karte dient nur dazu, die Szene in den
  Motiven zu finden; cx/cy (Mittelpunkt) und Kantenlänge sind in Kartenraster-Einheiten (152×99), Standard 64 = 32 Motiv-Pixel.
- `motive/` – Werkzeuge: Ebenen exportieren (`export_xcf.py`), Szenen der Karten finden (`locate_cards.py`), beste Ebene je Karte
  (`refine_layers.py`), Avatare bauen (`neue_avatare.py`), bestehende Avatare in den Motiven wiederfinden
  (`find_avatars.py`, `scenes_for.py`, `frames_for.py`, `build_replacements.py`). Siehe `motive/README.md`.
- Ausgabe: `data/shop/avatar-entwuerfe/motiv/` (nicht eingecheckt), übernommene Avatare liegen in `data/shop/avatars/`.
  Der Shop liest das Verzeichnis automatisch ein.
