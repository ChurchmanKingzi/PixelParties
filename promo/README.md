# Pixel Parties — Promo-Motiv

Großes Pixelart-Promo (Full-HD-GIF): sechs Heroes steigen aus ihren Karten und
kämpfen gegeneinander. Aufbau Schritt für Schritt, Hero für Hero.

## Maßstab

| Ebene            | Nativ        | Export (×3)    |
|------------------|--------------|----------------|
| Gesamtszene      | 640 × 360 px | 1920 × 1080 px |
| Hero-Frame       | 128 × 128 px | 384 × 384 px   |

Alles wird nativ gepixelt und nur ganzzahlig (Nearest Neighbor) hochskaliert,
damit jedes Pixel scharf bleibt.

## Aufbau

- `pixelkit.py`: Werkzeuge (Formen, Farbrampen, automatische Schattierung,
  Kontaktschatten, selektive Kontur, Randlicht, GIF-Export). Braucht nur
  `numpy` + `Pillow`.
- `heroes/<name>.py`: je ein Hero, prozedural + handgepixelte Details.
  `build(t)` liefert einen Frame für die Animationsphase `t ∈ [0, 1)`.
- `out/<name>/`: Ergebnisse (GIF, Spritesheets, Einzelbild).

```bash
pip install numpy pillow
python promo/heroes/elana.py
```

## Fortschritt

- [x] **Elana, the Rocky Rebel**: Idle-Loop (8 Frames, 90 ms): Headbang,
      schwingender Iro, Anschlag auf dem Flying V
- [ ] Hero 2
- [ ] Hero 3
- [ ] Hero 4
- [ ] Hero 5
- [ ] Hero 6
- [ ] Angriffs-Animationen
- [ ] „Aus der Karte steigen“-Effekt
- [ ] Szene 1920 × 1080 + Kampf-Choreografie
