# Instagram-Posts für Heroes

Erzeugt aus einem Hero einen 4:5-Post (1080×1350) oder ein Reel (1080×1920): Karte im Pixel-Rahmen mit Schnörkeln, der animierte
Sprite ragt aus dem Kartenbild, Themen-Partikel (z. B. Giftwolken) und Musik des Heroes.

```bash
python3 scripts/social-posts/build-post.py nao-the-barrier-priestess
```

```bash
python3 scripts/social-posts/build-post.py nao-the-barrier-priestess --format reel
```

`<slug>` ist der Dateiname des Sheets in `data/hero-animations/` (ohne Endung). Ausgabe: `out/<slug>/post.png`
und `post.mp4` (mindestens 30 s, der Loop wird wiederholt). Mit `--format reel`: `reel.mp4` (mindestens 15 s, mit Einblenden am Anfang und Link-Schild) und `reel-cover.png`. Das Reel hält Name, Link und Karte im sicheren Bereich (oben ca. 180 px, unten ca. 340 px bleiben frei für die Oberfläche von Instagram).

| Option | Wirkung |
|---|---|
| `--format post\|reel` | Feed (Standard) oder Reel |
| `--intro on\|off` | Einblenden am Anfang (Standard: Reel an, Post aus) |
| `--punch` | Kraftvoller Start: erste halbe Sekunde mit Druckwelle, Blitz und Wackeln, Musik ohne Einblenden und auf einen Schlag geschnitten. Meist zusammen mit `--intro off` |
| `--duration S` | Mindestlänge des Videos in Sekunden (Post 30, Reel 15) |
| `--music DATEI` / `--music-start S` | Musik aus `public/music/` und Startzeit; Standard `bgm_<erstes Wort>.ogg` |
| `--themes poison,fire,…` | Partikel-Themen erzwingen (`poison`, `fire`, `explosion`, `heal`, `holy`, `arcane`, `fight`, `ice`, `stars`); sonst aus `hero-themes.json`, danach automatisch aus Effekttext und Start-Fähigkeiten |
| `--accent #rrggbb` | Akzentfarbe statt der aus dem Sprite abgeleiteten |
| `--feet PX` | Standlinie des Sprites, px ab Kartenoberkante |
| `--no-video` | nur Einzelbilder und Standbild |

Abhängigkeiten: Python 3 mit `pillow` und `numpy`, `ffmpeg`, Node mit `playwright` (Karte wird mit dem
Spiel-Renderer `public/card-render.js` in Chromium gezeichnet).

Die Einstellungen je Hero stehen in `hero-themes.json` (Kartenname → `themes`, optional `name` und `title` für Namenszeile und Beiname, `music` für die Datei in `public/music`).

Texte für die Beschreibungen: `captions.py` erzeugt `captions.md` (alle Texte) und je Reel `out/reels/<slug>.txt` (Caption zum Einfügen und Alt-Text). Geändert werden die Texte direkt in `captions.py`, danach neu ausführen.

Stapellauf für alle Heroes mit eigenem Musikstück: `build-batch.py` (Ergebnis in `out/reels/`).

Logo und Profilbilder mit Monia: `make-logo.py` (Ergebnis in `out/branding/`).

Bausteine: `build-post.py` (Layout, Hintergrund, Sprite, Video), `ornaments.py` (Rahmen-Schnörkel),
`fx.py` (Partikel-Themen), `render-card.js` (Karte), `pxcommon.py` (Raster und Farben).
