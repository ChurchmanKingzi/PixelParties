#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ersetzt die von MSE als JPEG gespeicherten Kartenmotive in einem .mse-set
durch verlustfreie PNGs.

MSE komprimiert beim Import jedes Motiv als JPEG (-> Unschärfe/Artefakte).
Lädt man ein Set, erkennt MSE das Bildformat am Inhalt, PNG-Daten unter dem
Eintragsnamen "imageNNN" funktionieren also.

Aufruf:
    python scripts/mse_set_png_images.py SET.mse-set MOTIVE_ORDNER [AUSGABE.mse-set]

MOTIVE_ORDNER enthält pro Karte eine PNG mit dem Kartennamen als Dateinamen,
z. B. "Lesson in the Arts.png" (610x400, bzw. 750x1050 bei Fullart).
Das Original-Set wird nie überschrieben (Standard-Ausgabe: SET-png.mse-set).
"""
import io
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image


def parse_cards(text):
    """Liefert {Kartenname: Bild-Eintrag} aus der Set-Datei."""
    cards = {}
    for block in text.split("\ncard:\n")[1:]:
        name = re.search(r"^\tname: (.*)$", block, re.M)
        image = re.search(r"^\timage: (\S+)$", block, re.M)
        if name and image:
            cards[name.group(1).strip()] = image.group(1)
    return cards


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    folder = Path(sys.argv[2])
    dst = Path(sys.argv[3]) if len(sys.argv) > 3 else src.with_name(src.stem + "-png.mse-set")
    if dst.resolve() == src.resolve():
        sys.exit("Ausgabe darf nicht das Original sein.")

    with zipfile.ZipFile(src) as zin:
        text = zin.read("set").decode("utf-8-sig").replace("\r\n", "\n")
        cards = parse_cards(text)
        replace = {}
        for name, entry in cards.items():
            png = folder / (name + ".png")
            if not png.is_file():
                continue
            buf = io.BytesIO()
            Image.open(png).convert("RGB").save(buf, "PNG")
            replace[entry] = buf.getvalue()
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = replace.get(item.filename, zin.read(item.filename))
                zout.writestr(item, data)
    print(f"{len(replace)} von {len(cards)} Motiven ersetzt -> {dst}")


if __name__ == "__main__":
    main()
