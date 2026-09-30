# Avatar-Generator

`erzeuge.py` schneidet aus den Kartenbildern (`cards/`) quadratische Shop-Avatare aus: Bildbereich → natives Pixelraster
(Faktor 4, 152×99) → 64×64-Ausschnitt um den Mittelpunkt aus `picks.py` → ×3 (Nearest Neighbor) = 192×192 PNG.
Nur eigene Sprites, keine Nachbearbeitung, keine Skalierung mit Glättung.

```
pip install pillow numpy
cd scripts/avatar-entwuerfe
python3 erzeuge.py --sheet      # schreibt nach data/shop/avatar-entwuerfe/ (nicht eingecheckt, Pfad per PP_OUT)
```

Übernommene Avatare liegen in `data/shop/avatars/` (Dateiname = ID = `picks.py`). Der Shop liest das Verzeichnis
automatisch ein, weitere Avatare brauchen keinen Code.
