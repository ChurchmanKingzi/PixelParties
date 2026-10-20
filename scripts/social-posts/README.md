# Instagram-Posts für Heroes

Erzeugt aus einem Hero einen 4:5-Post (1080×1350): Karte im Pixel-Rahmen mit Schnörkeln, der animierte
Sprite ragt aus dem Kartenbild, Themen-Partikel (z. B. Giftwolken) und Musik des Heroes.

```bash
python3 scripts/social-posts/build-post.py nao-the-barrier-priestess
```

`<slug>` ist der Dateiname des Sheets in `data/hero-animations/` (ohne Endung). Ausgabe: `out/<slug>/post.png`
und `post.mp4` (mindestens 30 s, der Loop wird wiederholt).

| Option | Wirkung |
|---|---|
| `--duration S` | Mindestlänge des Videos in Sekunden (Standard 30) |
| `--music DATEI` / `--music-start S` | Musik aus `public/music/` und Startzeit; Standard `bgm_<erstes Wort>.ogg` |
| `--themes poison,fire,…` | Partikel-Themen erzwingen (`poison`, `fire`, `heal`, `holy`, `arcane`, `fight`, `ice`, `stars`); sonst aus `hero-themes.json`, danach automatisch aus Effekttext und Start-Fähigkeiten |
| `--accent #rrggbb` | Akzentfarbe statt der aus dem Sprite abgeleiteten |
| `--feet PX` | Standlinie des Sprites, px ab Kartenoberkante |
| `--no-video` | nur Einzelbilder und Standbild |

Abhängigkeiten: Python 3 mit `pillow` und `numpy`, `ffmpeg`, Node mit `playwright` (Karte wird mit dem
Spiel-Renderer `public/card-render.js` in Chromium gezeichnet).

Das Thema je Hero steht in `hero-themes.json` (Kartenname → Liste).

Bausteine: `build-post.py` (Layout, Hintergrund, Sprite, Video), `ornaments.py` (Rahmen-Schnörkel),
`fx.py` (Partikel-Themen), `render-card.js` (Karte), `pxcommon.py` (Raster und Farben).
