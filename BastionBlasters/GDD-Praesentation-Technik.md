# Bastion Blasters — Game Design Document

**Teil 2: Präsentation, Technik, Balancing, Roadmap** · Version 0.2 · Entwurf zur Abnahme

Teil 1 (Regeln und Systeme): [`GDD.md`](GDD.md) · Kataloge: [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) · [`katalog/02-einheiten.md`](katalog/02-einheiten.md) · [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md)

Legende wie in Teil 1: 🟦 aus deinem Konzept · 🟨 meine Ergänzung · ❓ offene Frage · ⚙ Tuning-Wert · P0/P1/P2 Priorität.

---

## 10. Präsentation

### 10.1 Pixel-Art-Richtlinien (16-Bit) 🟦/🟨 ✔ entschieden: Claude erstellt alle Grafiken

**Perspektive und Look**
- **Schräge Draufsicht (3/4)** wie in 16-Bit-Rollenspielen: Der Boden wird von oben gezeigt, Wände und Gebäude zeigen ihre Vorderseite (8–16 px Höhe über dem Zellenfeld). Dächer sind abgenommen, man blickt in jeden Raum. Türme ragen über ihre Zelle hinaus und werfen einen Schatten nach unten rechts.
- **Einheiten:** 3/4-Seitenansicht mit **zwei Blickrichtungen** (rechts gezeichnet, links gespiegelt); Bewegung nach oben und unten nutzt dieselben Frames mit leichter Neigung. Zusätzlich eine **Frontpose** (für Karten und Idle in der Pause). Das hält den Zeichenaufwand klein.
- **Look:** SNES/Mega-Drive-Stil: kräftige Farbrampen, Selbst-Outlines, bewusstes Dithering, glänzende Highlights, 4–6 Töne pro Fläche, comichafte Proportionen (große Köpfe, übertriebene Werkzeuge).

**Raster und Auflösung**
- **Interne Auflösung 960 × 540**, nur **ganzzahlig skaliert** (×2 = 1920 × 1080, ×3 = 2880 × 1620). Reste als Letterbox, nie gestreckt.
- **Zelle = 32 × 32 px.** Bastion bis 8 Zellen breit · Niemandsland ≈ 12 Zellen · Bastion bis 8 Zellen = ≈ 28 Zellen = 896 px.
- **Sprite-Größenklassen:** **S** 16 × 16 (Bürger, Goblins, Frösche) · **M** 32 × 32 (Standard) · **L** 48 × 48 (Bären, Trolle, Golems) · **XL** 64 × 64 bis 96 × 96 (Riesen, Dicke Berta, Zeppelin). Bauteile füllen ihre Zellen (2 × 2 = 64 × 64) plus bis zu 16 px Überstand nach oben.

**16-Bit-Disziplin (Palette)**
- Farbraum **RGB555** (32 Stufen je Kanal, wie beim SNES).
- **Master-Palette mit 122 Farben:** 20 **Farbrampen** zu je 6 Tönen (Hue-Shift: Schatten kühler und violetter, Licht wärmer und gelber, nie nur dunkler) plus Tinte und Weiß. **Jede Grafik darf nur Farben daraus verwenden.** Die Stilprobe nutzt 99 davon.
- **Pro Sprite typischerweise 20–40 Farben** (Stilprobe: 22–42). Die harte SNES-Grenze von 16 Farben pro Sprite wird **bewusst nicht erzwungen**: Mit ihr ließen sich Selbst-Outlines, Dithering und mehrere Materialien je Figur kaum mehr zeigen. Der 16-Bit-Look entsteht aus der geschlossenen Palette, dem Schachbrett-Dithering, den farbigen Outlines und den kräftigen Rampen.
- Rampen: Stein · Holz · Gras · Erde · Goblin-Grün · Haut · Knochen · Metall · Gold · Feuer · Eis · Magie-Violett · Fell · Blatt · Schleim · Kohle · Himmel · Stoff · **Team P1** (Karmin/Gold) · **Team P2** (Türkis).
- **Teamfarben per Palette-Swap:** Teamfarbige Pixel stehen in der Team-Rampe und werden zur Laufzeit 1:1 gegen die andere Team-Rampe getauscht (Index für Index). Eine Grafik, zwei Teams. Die Stilprobe tut genau das (P2 in Türkis).

**Dithering und Shading (Kern des Looks)**
- **Verläufe** (Boden, Nebel, Schatten, Glühen) immer per **geordnetem Dithering** (Schachbrett, Bayer 2 × 2 / 4 × 4), nie als weicher Alpha-Verlauf.
- **Schachbrett-Dither (50 %)** für Transparenz (Geister, Blaupausen, Schild-Blasen). **Rauschen-Dither** für Rauch und Staub.
- Licht kommt von **oben links**. Jede Fläche hat **4–6 Töne** (Basis, Licht, Schatten, Glanz, Reflexlicht). **Selbst-Outline (Sel-Out):** Konturen sind ein dunklerer Ton des Objekts, nie reines Schwarz. **Rim-Light** in Magie- oder Teamfarbe für Silhouettenschärfe.
- **Okklusions-Dither** an den Fußkanten der Wände, damit der Grundriss Tiefe bekommt. Fensterlicht warm, Magie kalt.
- **Post-Processing im Pixelraster:** Ein Shader quantisiert die FX-Ebene (Glühen, Nebel, Frost) auf die Palette und wendet eine Bayer-Matrix an; so bleiben auch Effekte „echtes“ Pixelart.

**Animation und Juice**
- Frames: Idle 4 · Gehen 6 · Angriff 4–6 (mit Vorbereitung und Smear-Frame) · Treffer 2 · Tod 6–8 · Spezialfähigkeiten nach Bedarf.
- **Übertriebenes Squash & Stretch**, Idle mit Persönlichkeit (gähnen, kratzen, winken).
- **Hit-Stop** 3–5 Frames bei großen Treffern, **1-Frame-Weißblitz**, kleines Screenshake (1–2 px; Kernexplosion 6 px).
- **Partikel:** 1–3 px große Quadrate aus der Palette, kein Alpha-Blending, nur Dither-Transparenz.
- Zerstörung: Zellen brechen in 3–5 Teile (Schutt, Holz, Fahnenfetzen), nicht in Zufallspixel. **Zielschatten** sind pulsierende Dither-Kreise am Boden.

**Welt**
- Bodenkacheln (Gras, Erde, Pflaster, Schlamm) mit Dither-Übergängen, Dekoration (Hüte, Knochen, Pilze, ein Schuh). Das Biom (GDD §2) bestimmt Farbstimmung und Details.
- **Kulisse statt Parallax:** Schatten ziehender Wolken wandern über den Boden, schwebende Inseln am Bildrand, der Himmelsriss als Lichtstreif.

**Lesbarkeit (Regeln für jede neue Karte)**
1. **Silhouette zuerst:** Jede Einheit ist im Schwarzbild von jeder anderen unterscheidbar.
2. **Kategorie am Körper:** Artillerie hat immer ein sichtbares „Geschütz“, Verteidiger sind breit und groß, Zivilisten tragen ihr Werkzeug groß, Sturmtruppen sind in Bewegung dargestellt.
3. **Zustände sichtbar:** Verwaist (Spinnweben), Brennen, Eingefroren, Fliehend (Schweißtropfen und Tempolinien), Todesmut (rote Augen) werden am Sprite gezeigt, nicht nur im Icon.
4. **Teamfarbe nie weglassen.**

**Pixel-Werkstatt (Asset-Pipeline, von Claude betrieben)** 🟨
- **Erzeugung per Code** (Python mit Pillow und numpy, Ordner `art/`): Farbrampen, schattierte Grundformen (Kugel, Polygon, Zylinder mit Schachbrett-Dither), automatische Selbst-Outline (hell auf der Lichtseite, dunkel auf der Schattenseite), Schatten-Dither, Palette-Prüfung (RGB555, nur Master-Palette) und Farbzählung je Sprite.
- **Teilebasierte Figuren:** Körper, Kopf, Hut, Waffe, Werkzeug als Bausteine; Animation durch Teilversatz und Frame-Tausch; handgesetzte Detail-Patches (Gesichter, Muster).
- **Ausgabe:** PNG-Spritesheets + JSON-Atlas (Tags = Animationen) + **Kontaktbögen** zur Qualitätskontrolle. Alles liegt versioniert im Repo, der Code ist deterministisch (gleicher Code = gleiche Pixel), jede Änderung ist ein Diff.
- **Qualitätsschleife:** Stilprobe → deine Freigabe → Batches nach Priorität (P0-Karten zuerst, Tier IV zuletzt), verwandte Einheiten teilen Recolor-Basen. Du gibst Feedback am Kontaktbogen („Gesichter größer“, „Rüstung zu grau“), ich passe Rampen oder Bausteine an und erzeuge alles neu.
- **Ehrliche Grenzen:** Es wird ein konsistenter, stilisierter 16-Bit-Look mit viel Persönlichkeit, kein handgemaltes Einzelstück-Niveau. Tier-IV-Karten und Schlüsselmotive (Kern, Explosion) bekommen mehr Handarbeit als Massenware.

### 10.2 Kamera & Regie in der Schlacht 🟨

- **Standard:** feste Weitaufnahme, beide Bastionen und das Feld.
- **Fokus-Blitze** (abschaltbar, P1): Bresche, Rang-Aufstieg zur Legende, Kern unter 20 %, Eroberung über 60 % → 0,4 s sanfter Zoom ×1,5 und Zeitlupe ×0,5.
- **Info-Panel:** Klick auf eine Einheit zeigt Name, Rang, XP-Balken, HP, Zustand („Rückzug“, „Todesmut“, „Festgehalten“…). Hover auf einem Bauteil zeigt Zustand, Posten, HP.
- **Ereignisfeed** (klein, rechts unten): „Gerd der Unverdauliche hat Rang 3 erreicht.“, „Krankenstation zerstört!“, „Bürger-Hut gefunden.“

### 10.3 Der Zeitstopp-Übergang (Regieplan) 🟦/🟨

Ziel: **fließend statt Schnitt.** Die Welt wird nicht „weggeblendet“, sondern eingefroren und die Kamera taucht hinein. Zeiten sind ⚙ Richtwerte.

| Zeit | Bild | Ton |
|---|---|---|
| **0,0 s** | Der letzte Spawn der Welle endet. Das Uhr-Icon in der HUD springt auf 12. | Tick. |
| **0,0–0,5 s** | **Dither-Frost:** Ein Bayer-Sweep von der Uhr aus färbt die Welt in die kühle **Zeitpalette** (8 Töne Blau-Violett). Geschosse, Funken und Sprites frieren auf ihrem aktuellen Frame ein, 1-Pixel-Funkeln rieselt herab. | Tonband-Stopp (Pitch-Drop 0,4 s), Musik mit Tiefpass. |
| **0,5–0,7 s** | Banner **„ZEITSTOPP“** fällt per Dither-Wipe ins Bild und bleibt 1 s. | Gong. |
| **0,7–1,5 s** | **Eintauchen:** Die Kamera gleitet (ease-in-out) in die eigene Bastion (Zoom ×1 → ×2). Die eingefrorene Welt bleibt als abgedunkeltes **Diorama** im Hintergrund; die HUD-Leiste „verwandelt“ sich in die Kartenleiste. | Whoosh, leises Uhrenticken. |
| **1,5–3,0 s** | **Ziehen:** 5 Karten fliegen aus der Uhr, drehen sich und decken nacheinander auf (Pixel-Blitz je Karte, Funkenfarbe = Tier; **Tier IV** lässt den ganzen Bildschirm pulsieren). | Karten-Klatschen, aufsteigende Töne. |
| **3,0 s → Timer** | **Bauen:** Drag & Drop mit Ghost-Sprite, Nachbarschaftsanzeige, Sanduhr-Timer oben. Neue Bauteile erscheinen als **Blaupause**. | Ticken wird unter 5 s schneller. |
| **Bereit** | Karten klappen weg. Beide Häkchen leuchten, 0,5 s Handschlag-Animation. | Klick. |
| **+0,5–1,3 s** | **Auftauen:** Die Kamera gleitet zurück auf die Weitaufnahme (ease-out), ein Bayer-Sweep vom **Zentrum nach außen** taut die Farben auf. Blaupausen werden **abgestempelt** (Hammerwelle, Staubwölkchen); gegnerische Neubauten sind in diesem Moment erstmals sichtbar. | Rückwärts-Tonbandstopp, Musik wieder voll, Hammerschläge. |
| **+1,3 s** | Alle Einheiten laufen exakt dort weiter, wo sie standen (1-Frame-Weißpuls). Die nächste Welle spawnt gestaffelt ab +0,5 s. | Kurze Fanfare. |

**Fließend-Prinzipien:** (1) kein Ladebalken, kein Schnitt, (2) Kamerafahrten nur mit Easing, (3) die Musik moduliert (Filter, Tempo) statt zu wechseln, (4) UI-Elemente verwandeln sich ineinander statt aus- und einzublenden, (5) die Welt bleibt sichtbar, (6) gleiche Weltperspektive in Schlacht und Aufbau (P2 gespiegelt).

**Zwei Spieler an einem Bildschirm (lokal):** Der Bildschirm teilt sich per diagonalem Dither-Wipe in zwei Hälften; links P1 mit eigener Hand, rechts P2. Online sieht jeder nur sich selbst.

**Technische Hinweise:** Die Simulation wird angehalten, die **Darstellung läuft weiter** (Parallax, Funkeln, Banner). Kamerazoom mit Nearest-Neighbor; während der Bewegung ist leichtes Pixel-Schimmern akzeptabel, in Ruhe ist das Bild pixelgenau. Eingaben der Spieler schreiben in eine **Befehlswarteschlange**, die beim Auftauen auf den Spielzustand angewendet wird.

### 10.4 Finale 🟦/🟨

**Kern-Explosion (Zerstörung):** ca. 6–8 s.
1. **0,0–0,1 s Hit-Stop** (alles hält an), Palette 2 Frames invertiert.
2. **0,1–1,0 s:** Der Kern bekommt Risse (Dither-Rissmuster), leuchtet von innen, die Bastion bebt (±2 px). Einheiten fliehen oder fallen. Die Musik bricht ab, ein Herzschlag.
3. **1,0 s:** Zeitlupe ×0,25, **Schockwellenring** (Dither) und 3 Frames Weißblitz.
4. **1,2–3,5 s:** Die Bastion platzt in Schichten **nach Entfernung vom Kern** auseinander: Zellen zerbrechen in Schutt, Holz, Fahnenfetzen; Einheiten werden mit Sprechblasen („WIIEEE“) herausgeschleudert. Konfetti, eine einzelne Gummiente landet unversehrt.
5. **3,5–6,0 s:** Pilzwolke in der Teampalette des Verlierers, Kamera zieht leicht auf, Zeit läuft wieder normal. Die Sieger jubeln, Banner **SIEG**.
6. **6 s+:** Ein Krater mit glimmendem Kernsplitter und einem winzigen Fähnchen. Revanche-Menü.

**Eroberung:** ca. 5 s. Das Banner des Eroberers entfaltet sich über dem Kern; ein **Palette-Swap-Wipe** (Dither-Ring) wechselt die Bastion von der Kernkammer nach außen in die Teamfarbe des Siegers. Die Zivilisten wenden sich um und winken, besiegte Verteidiger lassen die Köpfe hängen, Feuerwerk. Eine Eroberung ist demütigend, keine Zerstörung: Die Bastion steht noch, hat aber „Besitzer gewechselt“.

### 10.5 UI & UX 🟨

**Schlacht-HUD** (Wireframe):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ☀ Käsemond                    Welle 7 · Zeitstopp in 0:27 ◔                          │
│ P1 KERN ████████░░ 4100/5000   Betrieb ▮▮▮▮▯              P2 KERN ██████░░░░ 3050/5000 │
│ Eroberung ░░░░░░░░░░   0 %                                 Eroberung ██░░░░░░░░ 22 %   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─┐   (Bastion P1)        o→ o→   ⚔    ←o  ←o              (Bastion P2)   ┌─┐     │
│   │T│  ╔═══════╗           Niemandsland                       ╔═══════╗    │T│     │
│  ═╧═╧══╝       ╚══                                          ══╝       ╚════╧═╧═    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Kontingent: [UA-01 2/2 ★1 Ø R1] [US-01 4/5 ★2 Ø R2] [UV-01 …] [UZ-01 …] [   ]  ⚡ 0:42 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Kern-Balken** mit Zahl, **Betriebsgrad** (besetzte / benötigte Posten) als eigener Balken, **Eroberungsleiste** pro Seite, **Wellenzähler** und **Zeitstopp-Uhr**.
- **Kontingent-Leiste:** je Karte lebend/Soll, ★-Rang, Durchschnittsrang der lebenden Einheiten.
- **Kern-Fähigkeit** unten rechts mit Abklingzeit.

**Bastion-Screen** (Wireframe, Draufsicht):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⏳ 0:18        ZEITSTOPP — Ausbau        Pause 3                 [✔ Bereit] Gegner: ✔  │
├────────────────┬─────────────────────────────────────────────────────────────────────┤
│ KONTINGENT     │        ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓                                            │
│ ▢ UA-01 ★1     │        ▓▓  ·  ·  ·  ·  ▓▓      Grundriss der Bastion                │
│ ▢ US-01 ★2     │        ▓▓  · [KERN] ·  TOR     Hover = Vorschau + Nachbarschaft     │
│ ▢ UV-01 ★1     │        ▓▓  · [KERN] ·  TOR     R = drehen · L = Schusslinien        │
│ ▢ UZ-01 ★1     │        ▓▓  ·  ·  ·  ·  ▓▓      Rechtsklick = Info                   │
│ ▢ (frei)       │        ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓                                            │
│ Befehle ▾      │   (Die eingefrorene Schlacht bleibt als dunkles Diorama dahinter)   │
├────────────────┴─────────────────────────────────────────────────────────────────────┤
│ DEINE HAND (frisch): [Karte] [Karte] [Karte] [Karte] [Karte]   behalten 3 · Reroll 1  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Ziehen-Phase:** 5 Karten offen, 3 anklicken (Rest wird ausgegraut).
- **Platzierung:** Ghost-Sprite folgt der Maus, **R dreht** das Bauteil; gültige Zellen leuchten, ungültige sind schraffiert; Synergie-Nachbarn werden grün/rot markiert; ein Tooltip nennt Posten und Effekt.
- **Warnungen** (nicht verbietend): „Lücke in der Ringmauer“, „Raum vom Tor abgeschnitten“, „Kein Heiler vorhanden“, „Keine Geschützplätze“, „Pulverkammer neben Wohnhaus“.

**Karten-Layout** (160 × 224 px, gleiches Pixelraster):

```
┌──────────────────┐
│ T II        ★☆☆  │   Tier + Sterne
│ ┌──────────────┐ │
│ │   (Sprite)   │ │   Rahmenfarbe nach Kategorie:
│ │   64 × 64    │ │   Artillerie karmin · Sturm bernstein ·
│ └──────────────┘ │   Verteidiger blau · Zivilist grün ·
│ Rumpel-Katapult  │   Bau steingrau/violett
│ ARTILLERIE·Basis │
│ ❤ 70 ⚔ 60/18 ⏱ 7s│
│ „Er wackelt. Es  │   Flavor-Zeile
│  funktioniert.“  │
└──────────────────┘
```

**Barrierefreiheit** 🟨: Farbenblind-Modus (Kategorien und Teams zusätzlich über Muster und Symbole), Regler für Screenshake, Zeitstopp-Blitz und Dither-Intensität, große Schrift (Pixelfont in zwei Größen), wählbare Spielgeschwindigkeit in Einzelspieler-Partien, Tastaturkürzel (Leertaste = Bereit, R = Reroll, Tab = Gegner-Info).

### 10.6 Audio 🟨

- **Musik:** Chiptune/FM mit **Live-Stems** (Bass, Schlagzeug, Lead, Chaos-Ebene). Die Chaos-Ebene schaltet sich bei vielen Einheiten und Beschuss zu. **Zeitstopp:** Tiefpass, die Percussion fällt weg, ein Uhr-Ticken legt sich darunter; beim Auftauen kommen die Stems zurück.
- **SFX:** Einschläge nach Material (Holz knackt, Stein knirscht, Pudding macht *bloing*, Metall *dong*), Rang-Aufstieg als kleines Arpeggio.
- **Stimmen:** Jede Einheit hat eine **Brabbel-Stimme** (Gibberish-Synth, Tonhöhe nach Größe), die bei Angriff, Rückzug und Tod ertönt. Kein Sprachtext nötig.
- **Kommentator** (P2): Ein überdrehter Ansager kommentiert Ereignisse („Gerd der Unverdauliche hat Rang 5!“). Zuerst nur als Text im Ereignisfeed.
- **Kern-Explosion:** Stille → Herzschlag → großer Knall mit Nachhall → verwehender Wind.

---

## 11. Technische Leitplanken 🟨

**Empfehlung** (❓ Q7): **Web-Spiel mit TypeScript, Vite und PixiJS** (oder reinem Canvas), pixelgenau über Ganzzahl-Skalierung und `image-rendering: pixelated`, plus ein Post-Processing-Shader für Dither und Palette.

| Kriterium | Web (TypeScript) | Godot 4 | Unity |
|---|---|---|---|
| Pixelgenaue 2D-Grafik | gut | **sehr gut** (Integer-Skalierung, TileMap, Shader) | möglich, aber mit Zusatzpaket |
| Von Claude in der Cloud **bau- und testbar** | **ja:** Chromium vorinstalliert, automatische Screenshots, Bot-Simulationen in Node | eingeschränkt: Binary müsste geladen werden, Rendern ohne GPU ungewiss | **nein:** an den Editor und eine Lizenzaktivierung gebunden |
| Spielen ohne Installation | **Link genügt** | Web-Export möglich, größer | WebGL-Export aufwendig |
| Native Veröffentlichung (z. B. Steam) | über Electron oder Tauri | **direkt** | direkt |
| Szenen-/Animations-Editor | keiner (Code + Daten) | **ja** | ja |
| Kosten, Lizenz | frei | frei (MIT) | Lizenzmodell hat zuletzt mehrfach gewechselt |
| Passt zu diesem Projekt | **empfohlen** | gute zweite Wahl | nicht empfohlen |

Begründung: Entscheidend ist, dass ich die Pixelgrafik selbst erzeuge und das Spiel selbst sehen, ausführen und testen muss. Das geht im Web-Stack vollständig, ohne dass du etwas installierst. Die Simulation ist ohnehin engine-unabhängig (deterministisch, headless), eine spätere Portierung auf Godot wäre also möglich, die Pixelgrafik bleibt als PNG erhalten.

**Architektur**
- **Simulation strikt von der Darstellung getrennt.** Die Sim läuft mit **festem Zeitschritt (30 Hz)**, ist **deterministisch** (seed-basiertes RNG, keine Zufallswerte aus der Darstellung) und kann **headless** in Node laufen.
- **Befehlslog + Seed = Replay.** Daraus entstehen Replays, Debugging, Fehlersuche und später Online-Synchronisation (Lockstep).
- **Datengetrieben:** Karten stehen in JSON/YAML (siehe Anhang B). Fähigkeiten sind Bausteine (**Trigger → Bedingung → Effekt**); im Code stehen nur die Verhaltens-Archetypen (Doktrinen, Zonen, Flugbahnen).
- **Systeme** (in fester Reihenfolge pro Tick): Spawn · Navigation · Targeting · Combat · Projectile (Schusslinie, Streuung) · Status · XP/Rang · Staffing (Personal) · Healing/Retreat · Conquest · Win-Check. Danach Darstellung (Kamera, FX, UI).
- **Wegfindung:** **A\* auf dem Zellenraster** (8 Richtungen, kein Ecken-Schneiden) für Bastion und Feld; Hindernisse haben Zerstörungskosten (HP/100). Gedränge im Feld über weiche Abstoßung. Sonderfälle: Flieger, Geister, Wühler (eigene Regeln). Dank Draufsicht entfällt der aufwendige Raumgraph mit Etagen; das Hauptrisiko des Querschnitts ist damit weg.
- **Zeitstopp:** Sim-Tick pausiert, die Darstellung läuft weiter. Eingaben schreiben in eine Befehlswarteschlange (Bauteile, Kontingent, Befehle), die beim Auftauen deterministisch angewendet wird.
- **Determinismus:** Fließkomma-Abweichungen vermeiden (Fixed-Point oder konsequent gleiche Rechenreihenfolge), damit Replays und Online-Lockstep funktionieren.
- **Performance-Budget:** 40 Einheiten pro Seite + Geschosse + Partikel unter 16 ms/Frame auf einem Mittelklasse-Laptop. Partikellimit ⚙ 500, Sprite-Atlas, Object Pooling.
- **Tests:** 1000 Bot-gegen-Bot-Partien pro Balance-Änderung (Siegquoten, Matchlänge, Rückzugsquote), Regressionstest für Determinismus.
- **Repository:** Dieses Spiel gehört in ein **eigenes Repository** (aktuell liegt es nur als eigenständiger Ordner `BastionBlasters/` in einem fremden Repo).

---

## 12. Balancing 🟨

### 12.1 Zielmetriken (⚙)

| Metrik | Ziel |
|---|---|
| Matchlänge | 10–16 min (Median ≈ 13) |
| Erster zerstörter Raum | 75–120 s nach dem ersten Beschuss |
| Erster Rang-3-Elite | ca. 5–7 min |
| Kern erstmals in Reichweite feindlicher Artillerie | meist Min. 5–8 |
| Pausenanteil an der Matchzeit | ≤ 35 % |
| Siegquote Zerstörung / Eroberung | ≈ 50 / 50 (±15) |
| Siegquote Startspieler vs. Zweiter | 50 % ±3 (symmetrisch!) |
| Rückzugsquote (Sturmtruppen mit Heilquelle) | 40–70 % der Rückzugsauslöser enden mit erfolgreicher Heilung |
| Comeback-Chance (Unterlegener nach 60 % der Zeit) | ≥ 25 % |
| Pro-Zeitstopp-Entscheidungsdauer | 15–25 s Median |

### 12.2 Methodik

- **Kampfwert-Faustformel** (nur Plausibilitätscheck): `KW = Soll × HP × DPS`, dabei DPS = Schaden / Takt. Ausreißer sind erlaubt, wenn eine Fähigkeit es ausgleicht (Heilung, Spawn-Effekt, Utility). Artillerie wird nach Strukturschaden pro Sekunde und Reichweite verglichen, Verteidiger nach EHP (HP durch Rüstungsfaktoren).
- **Bot-Sim:** Jede Änderung an Werten wird von Bots (Zufalls-Aufbau + einfache Heuristik) tausendfach gespielt; ausgewertet werden die Metriken oben.
- **Telemetrie** (ab Playtests): Karten-Winrate, Auswahlrate (zieht man sie und spielt man sie?), Zeitstopp-Dauer, Todesursachen.
- **Hebel:** Heilquellen-Kapazität, Rückzugsschwelle, Zeit-XP-Deckel, Wellenabstand, Kern-HP, Reichweiten, Mauer-HP, Reparaturraten, Ziehgewichte der Tiers.

### 12.3 Bekannte Spannungsfelder

- **Zu starke Heilung ⇒ Unsterbliche Sturmtruppen.** Gegenmittel: begrenzte Behandlungsplätze, Personal, Warteschlange, Jagd auf Fliehende (Pfeilturm +50 %).
- **Zu starke Defensive ⇒ Patt.** Gegenmittel: Schusslinie, Wahnsinn, Kern-Reichweite (frühe Artillerie erreicht den Kern nicht, später ja).
- **Zu starke Artillerie ⇒ Sturm überflüssig.** Gegenmittel: Reparatur, Schilde, kurze Reichweiten früh, Sturmtruppen als einziger Weg, Personal abzuschalten.

---

## 13. Scope, Roadmap, Risiken

### 13.1 MVP (P0) — ein spielbarer Kern

- Ein Kern (KE-00), Raster 6 × 6 (ohne Erweiterungen), Ringmauer, Tor, Bürger.
- **18 Bauteile** (Katalog 01, Liste „P0“) und **19 Truppen** (Katalog 02, Liste „P0“).
- Phase 1 + Kampfzyklus + Zeitstopp mit einfacher Kamerafahrt (noch ohne Dither-Effekte).
- Simulation: Spawn/Nachschub, Navigation (A* auf dem Raster), Artillerie (Flach + Bogen, Schusslinie, Zielschatten), Sturmtruppen (Jäger, Brecher, Eroberer, Plünderer, Sprenger), Rückzug und Heilung, Verteidiger-Zonen, Personal/Bürger, Eroberung, Kern-HP, XP und Ränge (ohne Talente), beide Siegbedingungen.
- Platzhalter-Grafik (später die Pixelart aus der Pixel-Werkstatt), Debug-Overlay (Zellen, Pfade, Exposition, XP), einfacher Bot-Gegner.

**P1:** Erweiterungen des Rasters, Fraktions-Kerne, restliche Linien und Karten, Kern-Fähigkeiten, Talente, Statuseffekte komplett, Materialien/Rüstungsmatrix, Zeitstopp-Regie in Pixelart, Explosion, UI-Skin, Audio.
**P2:** Welt-Launen, Chaos-Karten, Baustile, Biom-Wechsel, Kommentator, Signaturkarten, Online-Modus.

### 13.2 Meilensteine

| # | Meilenstein | Ergebnis („Definition of Done“) |
|---|---|---|
| **M0** | Entscheidungen & Daten | Offene Fragen aus §14 beantwortet; Kataloge als JSON/YAML exportiert; Tuning-Tabelle als Datei. |
| **M1** | Pixel-Werkstatt & Stilprobe | Code-Pipeline für 16-Bit-Pixelart (Rampen, Shading, Dither, Outline, Palette-Prüfung); Stilprobe mit Kontaktbogen, ersten Bauteilen, Einheiten und einer Szenen-Montage; **deine Freigabe des Stils.** *Stand: Stilprobe liegt in `art/out/` vor und wartet auf deine Freigabe.* |
| **M2** | Kampf-Greybox | 2D-Feld und Bastion-Raster mit Platzhalterquadraten; Einheiten spawnen, laufen, kämpfen; eine **komplette Bot-gegen-Bot-Partie** läuft bis zum Sieg und ist als Replay abspielbar. |
| **M3** | Bastion-Builder | Drag & Drop auf dem Raster mit Drehen, Tags, Nachbarschaft, Validierung. Ein Mensch kann eine Bastion bauen. |
| **M4** | Karten-Loop & Zeitstopp | Kern-Wahl, Loadout 10/7, frische 5/3-Hand, Kontingent, Pausenablauf mit einfacher Kamerafahrt. Eine **komplette Partie ist spielbar** (Mensch vs. Bot). |
| **M5** | Rollen vertiefen | Rückzug/Heilung, Personal, Eroberung, XP/Ränge laufen vollständig; erster Balance-Pass mit Bot-Sims. |
| **M6** | Vertical Slice (Art) | 1 Baustil, 10 voll animierte Einheiten, Dither-Zeitstopp, Kern-Explosion, UI-Skin; ein 3-minütiges Video, das schon „nach dem Spiel“ aussieht. |
| **M7** | Content-Welle 1 | Alle P0- und P1-Karten, die ersten Fraktions-Kerne, Rasterweiterungen; Balance-Pass 2. |
| **M8** | Content-Welle 2 & Polish | Restliche Karten und Kerne, Welt-Launen, Audio, Menüs, Barrierefreiheit. |
| **M9** | Mehrspieler | Lokal (Split) und, falls gewünscht, Online. |

### 13.3 Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| **Zu viele Systeme gleichzeitig** (Personal, Linien, Exposition, Rückzug, XP, Eroberung) | MVP-Scope, jedes System per Feature-Flag zuschaltbar, im Bot-Sim einzeln testbar. |
| **Autobattler wirkt passiv** | Kern-Fähigkeit, Zielprioritäten, Wachzonen, Kamera-Fokus, Pause als Spielhöhepunkt. |
| **XP-Snowball** | Zeit-XP-Deckel (nur bis Rang 2), Rangdifferenz-Bonus, Todesmut ohne Heilung, Wahnsinn. |
| **Unlesbares Chaos** | Silhouettenregeln, Statusicons, Einheitenlimit 40, Fokus-Highlight, Ereignisfeed. |
| **Wegfindung und Gedränge** | A* auf dem Zellenraster, Hindernisse mit Kosten, weiche Abstoßung im Feld, Debug-Overlay. |
| **Labyrinth-Verstopfung** (Mauerwerk ist kostenlos) | Wegkosten berücksichtigen Zerstörungsaufwand, Mauern haben HP, Türme und Verteidiger sind der Gegenpol; notfalls Mauerwerk-Limit pro Pause. |
| **Pixelart-Qualität und -Umfang** (alles von Claude) | Stilprobe vor Massenproduktion, Bausteine und Recolor-Basen, Review am Kontaktbogen, Schlüsselmotive mit Handarbeit. |
| **Pixel-Art-Aufwand (150+ Karten)** | Platzhalter zuerst, Vertical Slice, Recolor-Basen für verwandte Einheiten, 2 Blickrichtungen statt 4, Tier IV zuletzt. |
| **Zeitstopp-Übergang ruckelt** | Sim und Darstellung trennen, Nearest-Neighbor, pixelgenau in Ruhe. |
| **Unfairer Zufall** | Garantien, 5/3-Auswahl, Tier-Gating, „Bekannte Gesichter“, symmetrische Basis. |
| **Online-Determinismus** | Deterministische Sim von Anfang an, Replays als Dauertest. |
| **Katalog-Wildwuchs** | Karten in Wellen, jede braucht Rolle, Witz und Silhouette (Designsäule 5). |

---

## 14. Fragen & Entscheidungen

✔ = entschieden, ❓ = offen (mit Default, mit dem ich weiterarbeite).

| # | Frage | Status |
|---|---|---|
| **Q1** | Plattform und Modus: Browser, lokal 1v1 + Bot zuerst, Online später? | ❓ Default: **ja.** |
| **Q2** | Perspektive | ✔ **Schräge Draufsicht.** Der Querschnitt wird nicht parallel gepflegt (Anhang D). |
| **Q3** | Echtzeit-Eingriffe in der Schlacht | ✔ **Nur die Kern-Fähigkeit** (GDD §9.1). ❓ Abklingzeiten testen. |
| **Q4** | Ziehregel | ✔ **Start 10/7, danach jede Pause eine komplett frische 5/3-Hand** (GDD §5.5). |
| **Q5** | Eroberungs-Ende anders als Explosion (Palette-Swap statt Knall)? | ❓ Default: **ja.** |
| **Q6** | Matchlänge 10–16 min? | ❓ Default: **ja.** |
| **Q7** | Tech-Stack | ❓ Empfehlung: **Web (TypeScript + PixiJS)**, siehe §11. Godot 4 als zweite Wahl, Unity nicht. |
| **Q8** | Woher kommt die Pixelgrafik? | ✔ **Komplett von Claude, 16-Bit-Stil** (§10.1). |
| **Q9** | Sprache: Deutsch zuerst, aber i18n-fähig? | ❓ Default: **ja.** |
| **Q10** | Fraktionen oder Kerne als Asymmetrie? | ✔ **Kerne sind Fraktionen** (GDD §9.1, Katalog 03). |
| **Q11** | Welt-Launen und Chaos-Karten: später oder streichen? | ❓ Default: **später (P2).** |
| **Q12** | Statik-Kollaps | ✘ **Entfällt** (nur im Querschnitt sinnvoll). |
| **Q13** | Eigenes Repository für das Spiel? | ❓ Default: **ja.** |
| **Q14** | Name „Bastion Blasters“: Marken-/Namensprüfung? | ❓ **Offen** (ich habe nichts geprüft). |
| **Q15** | Kern-Wahl frei und verdeckt aus allen 12, oder 3 zufällig angeboten? | ❓ Default: **frei**, Zufallsmodus optional. |
| **Q16** | Ungespielte, behaltene Karten verfallen. Mit Trostpflaster (4 % Reparatur je Karte)? | ❓ Default: **ja.** |
| **Q17** | Mauerwerk bleibt kostenlos und unbegrenzt (Labyrinthe)? | ❓ Default: **ja**, mit Beobachtung (Risiko in §13.3). |
| **Q18** | Einheiten mit zwei Blickrichtungen (rechts/links gespiegelt) statt vier? | ❓ Default: **ja** (spart Zeichenaufwand). |

---

## 15. Glossar

| Begriff | Bedeutung |
|---|---|
| **Abstempeln** | Neue Bauteile werden nach der Pause aus der Blaupause in echte Gebäude verwandelt. |
| **Alarm** | Zustand, wenn Eindringlinge in der Bastion sind; verdoppelt die Leine der Verteidiger. |
| **Artillerie** | Truppen auf Geschützplätzen, die die gegnerische Bastion beschießen. |
| **Bastion** | Die Festung eines Spielers (Grundriss-Raster mit Ringmauer und Kern). |
| **Behandlungsplatz** | Platz in einer Heilquelle, den ein verwundeter Sturmtrupp belegt. |
| **Beute** | Gebäude, die Plünderer ablenken (Schatztruhe, Wunschbrunnen, Trophäenhalle). |
| **Blaupause** | Darstellung eines neu gelegten Bauteils während der Pause. |
| **Bresche** | Zerstörte Außenzelle, die als zusätzlicher Eingang dient. |
| **Bürger** | Standard-Zivilisten ohne Karte, die Posten besetzen. |
| **Doktrin** | Zielverhalten einer Sturmtruppe (Jäger, Brecher, Eroberer, Plünderer, Sprenger). |
| **Eindringling** | Feindliche Sturmtruppe innerhalb der Bastion. |
| **Eroberung** | Sieg durch Besetzen der Kernkammer (Leiste 100 %). |
| **Geschützplatz (GP)** | Platz auf einer Plattform, den Artillerie benötigt. |
| **Fraktion / Kern** | Der Kern, den man wählt, bestimmt Passive, aktive Fähigkeit, Linien-Affinitäten und Schwäche (Archetyp: Belagerer, Stürmer, Bollwerk, Tüftler). |
| **Heilquelle** | Alles, was für die Rückzugsregel zählt (Heilgebäude, Heiler, Aura-Heilung). |
| **Innenhof** | Leere, begehbare Zelle im Inneren der Bastion. |
| **Kern** | Zentrum der Bastion; fällt er, wird der Besitzer besiegt. |
| **Kern-Anbau** | Kostenloser Freischalt-Raum der Hauptlinie des Kerns (★2). |
| **Kernkammer** | 2 × 2 Raum um den Kern; Ort der Eroberung. |
| **Kontingent** | Armee-Leiste aus Truppen-Karten (5–8 Plätze). |
| **Linie** | Truppen-Gruppe, die ein Freischalt-Raum freigibt (Waffen, Arkan, Tier, …). |
| **Nachschub (N)** | Wie viele Einheiten einer Karte pro Welle nachgeliefert werden. |
| **Niemandsland** | Streifen zwischen den Bastionen. |
| **Panikraum** | Raum, in dem Zivilisten unangreifbar sind. |
| **Posten** | Arbeitsplatz in einem Raum, der Personal braucht. |
| **Rang** | Erfahrungsstufe R0–R5 einer Einheit. |
| **Ringmauer** | Äußerste Zellenreihe der Bastion, kostenlos mit Mauerwerk gefüllt. |
| **Rückzug** | Verhalten einer Sturmtruppe unter 50 % HP, wenn eine Heilquelle existiert. |
| **Schusslinie** | Gerade Linie vom Schützen zur Zielzelle, ohne andere feste Zelle des Gegners; Voraussetzung für Flach-Geschosse. |
| **Soll (S)** | Zielstärke einer Truppen-Karte. |
| **Strukturfaktor** | Multiplikator auf Schaden gegen Bauteile. |
| **Tier** | Seltenheit/Stärke einer Karte (I–IV). |
| **Todesmut** | Kampf bis zum Tod ohne Rückzug (+15 % Schaden), wenn keine Heilquelle existiert. |
| **Trümmer** | Zerstörte Zelle: begehbar, ohne Funktion. |
| **Verwaist** | Raum ohne Personal (0 % Wirkung). |
| **Welle** | Spawn-Ereignis aller Kontingent-Karten. |
| **Welt-Laune** | Optionales globales Match-Wetter mit Regeländerung. |
| **Wahnsinn** | Eskalation ab Minute 14 gegen Patts. |
| **Zeitstopp** | Pause nach jeder 2. Welle, in der gezogen und gebaut wird. |
| **Zelle** | Feld des Rasters, 32 × 32 px. |
| **Zielschatten** | Markierung am Boden, die einen Bogen-/Senkrecht-Einschlag 1,2–2,0 s vorher ankündigt. |
| **Zyklus** | 2 Wellen + 1 Zeitstopp. |

---

## Anhang A — Tuning-Tabelle ⚙

Alle Startwerte zum Ausprobieren; diese Tabelle soll später als Datei (z. B. `tuning.json`) im Spiel liegen.

| Schlüssel | Bedeutung | Start | Spanne |
|---|---|---|---|
| `SIM_HZ` | Simulationsschritte pro Sekunde | 30 | fest |
| `WAVE_INTERVAL_S` | Abstand zwischen Welle 1 und 2 eines Zyklus | 40 | 30–50 |
| `WAVES_PER_CYCLE` | Wellen bis zum Zeitstopp | 2 | fest |
| `FIRST_BUILD_S` | Dauer des Erstaufbaus | 120 | 90–180 |
| `PAUSE_BUILD_S` | Bauzeit je Zeitstopp | 25 | 20–40 |
| `LOADOUT_DRAW` / `LOADOUT_KEEP` | Ziehen / Behalten zu Spielbeginn | 10 / 7 | 8–12 / 6–8 |
| `PAUSE_DRAW` / `PAUSE_KEEP` | Frische Hand je Zeitstopp | 5 / 3 | 4–6 / 2–4 |
| `LEFTOVER_REPAIR_PCT` | Reparatur je behaltene, aber nicht gespielte Karte | 4 % | 0–8 % |
| `REROLLS` | Rerolls je Pause | 1 | 0–2 |
| `KNOWN_FACES_PCT` | Anteil Kopien bekannter Karten beim Ziehen | 20 % | 10–30 % |
| `KONTINGENT_START` / `_MAX` | Truppenplätze | 5 / 8 | – |
| `GRID_START` | Baugrund zu Beginn (inkl. Ringmauer) | 6×6 | – |
| `GRID_EXPANSIONS` | Erweiterungen (Pausen 2, 4, 6), max. je Seite | 3, je Seite max. 2 | – |
| `GATE_SIZE` | Tor | 1×2 | – |
| `CORNER_TOWER_BONUS` | Eckturm: Reichweite / HP | +1 / +10 % | – |
| `SHELL_SPREAD_BASE` / `_PER_CELL` | Streuung von Bogen/Senkrecht (Zellen) | 0,4 / 0,04 | – |
| `TELEGRAPH_BOGEN_S` / `_SENKRECHT_S` | Zielschatten vor dem Einschlag | 1,2 / 2,0 | – |
| `FIELD_GAP_CELLS` | Niemandsland | 12 | 10–14 |
| `CORE_HP` / `CORE_REGEN` | Kern | 5000 / 2 HP/s | 3500–7000 |
| `GATE_HP` / `WALL_HP` | Tor / Mauerwerk | 500 / 400 | – |
| `BUERGER_HP` | Bürger | 25 | – |
| `BUERGER_BASE_CAP` / `_PER_HOUSE` | Bürger-Limit | 4 / +3 | – |
| `BUERGER_RESPAWN_S` | Nachwuchs | 5 | 3–8 |
| `SPAWN_STAGGER_S` | Spawn-Abstand | 0,4 | – |
| `UNIT_CAP` | Einheitenlimit je Seite | 40 | 30–60 |
| `STRUCT_FACTOR_ASSAULT` | Sturm gegen Bauteile | 0,4 | 0,3–0,6 |
| `RETREAT_THRESHOLD` | Rückzug unter … HP | 50 % | 40–60 % |
| `RETREAT_HEAL_TO` | Rückkehr ab … HP | 90 % | 80–100 % |
| `RETREAT_QUEUE_MAX_S` | Maximale Wartezeit auf Behandlung | 6 | 4–10 |
| `FLEE_SPEED_BONUS` | Tempo-Bonus beim Rückzug | +30 % | – |
| `DEATHWISH_DMG` | Todesmut-Schaden | +15 % | 0–25 % |
| `LEASH_CELLS` | Leine der Verteidiger (Alarm ×2) | 4 | 3–6 |
| `CONQUEST_BASE` / `_PER_EXTRA` / `_MAX_UNITS` | Eroberungsrate | 4 %/s / +2 %/s / 5 | – |
| `CONQUEST_DECAY` | Abbau ohne Eindringlinge | 6 %/s | – |
| `XP_TIME` / `XP_TIME_CAP_RANK` | Zeit-XP / Deckel | 0,4 XP/s / Rang 2 | – |
| `XP_DMG_UNIT` / `XP_DMG_STRUCT` | XP je Schaden | 0,25 / 0,08 | – |
| `XP_HEAL` / `XP_REPAIR` / `XP_SUPPORT` | XP je Heilung/Reparatur/Unterstützung | 0,2 / 0,08 / 0,5 (max. 2/s) | – |
| `XP_KILL` / `XP_RANKDIFF` | Kill-Bonus / Rang-Differenz | 10 + 5×Rang / +10 % je Rang | – |
| `RANK_THRESHOLDS` | XP für R1…R5 | 50 / 140 / 300 / 540 / 900 | – |
| `RANK_BONUS` | Bonus je Rang (HP & Schaden) | +10 % | 6–12 % |
| `RANK5_AURA` | Ruhmesaura R5 | +8 % Schaden, Radius 3 | – |
| `BUILD_TIME_AFTER_PAUSE_S` | Bauzeit neuer Bauteile | 3 | – |
| `REBUILD_WORK_RATIO` | Wiederaufbau-Arbeit | 40 % der Max-HP | 30–60 % |
| `RANGE_ARTILLERY` | Kurz / Mittel / Weit / Extrem | 14 / 18 / 22 / 26 | – |
| `PROJECTILE_FLIGHT_S` | Flugzeit | 1,0–2,2 | – |
| `MADNESS_START` / `_STEP` | Wahnsinn | 14:00 / alle 30 s +10 % | – |
| `SKY_RIP_START` | Himmelsriss (1 % Kern-HP/s) | 20:00 | – |

---

## Anhang B — Datenformat-Beispiele

Vorschlag für das Austauschformat der Kataloge (YAML; JSON funktioniert genauso). Ein Eintrag je Karte, Effekte als Bausteine.

```yaml
# Einheit
- id: UA-01
  name: Rumpel-Katapult
  kind: artillery            # artillery | assault | defender | civilian
  line: basis
  tier: 1
  soll: 2
  nachschub: 1
  gp: 2                      # Geschützplätze
  hp: 70
  armor_class: fleisch       # fleisch | panzer | geist | knochen | pudding
  trajectory: bogen          # flach | bogen | senkrecht | durchschlag | untergrund | streu | luft
  range: 18
  cooldown_s: 7.0
  damage: { struct: 60, unit: 18, type: wucht }
  splash: 1
  talent_r3: { id: doppelwurf, every_nth_shot: 4, extra_projectiles: 1 }
  look: "Holzkatapult mit Gesicht; schwitzende Mini-Goblins ziehen am Seil."
```

```yaml
# Gebäude
- id: BH-01
  name: Krankenstation
  size: [2, 1]
  tier: 1
  material: holz
  hp: 300
  posten: 1
  placement: []              # z. B. [aussen], [innen], [front], [ecke]
  tags: [heil, leicht_entflammbar]
  effects:
    - type: heal_station     # zählt als Heilquelle (Rückzugsregel)
      slots: 3
      hp_per_s: 6
  look: "Betten mit Zipfelmützen, Kreuz in Teamfarbe, Thermometer als Fahne."
```

Neue Effekt-Bausteine entstehen nur, wenn mehrere Karten sie brauchen. Alles andere sind Parameter bestehender Bausteine (`heal_station`, `aura`, `spawn_buff`, `projectile`, `status_on_hit`, `trap`, `teleport`, `xp_bonus`, `gp_provider`, `unlock_line`, `staff_modifier`, …).

---

## Anhang C — Änderungsprotokoll

| Version | Änderung |
|---|---|
| **0.1** | Erster Entwurf aus dem Grobkonzept: Regeln, Systeme, Kataloge (Bauteile, Einheiten, Kerne, Welt-Launen), Präsentation, Technik, Roadmap, offene Fragen. |
| **0.2** | Antworten auf die offenen Fragen eingearbeitet: **Draufsicht** statt Querschnitt (Raster, Ringmauer, Schusslinie, Zielschatten, Tags, Wegfindung neu), **Ziehregel** 10/7 + frische 5/3, **16-Bit-Pixelart von Claude** (Pixel-Werkstatt, RGB555), **12 Fraktions-Kerne** in 4 Archetypen, Technik-Vergleich, neue Meilensteine. |

---

## Anhang D — Entscheidungsprotokoll

| Datum | Entscheidung | Folgen |
|---|---|---|
| 2026-10-08 | **Draufsicht statt Querschnitt, nicht beides.** Beide Ansichten zugleich zu pflegen würde Regeln (Schusslinie, Wege, Platzierung) und die gesamte Grafik doppelt kosten. Die systemischen Teile (Karten, XP, Rückzug, Personal, Eroberung, Wellen, Zeitstopp) sind ansichtsunabhängig und bleiben. | Neues Raster mit Ringmauer, Schusslinie und Zielschatten statt Exposition, Tags ohne Etagen, Wegfindung per A*, Statik-Kollaps gestrichen. Sieben Bauteile und neun Einheiten angepasst. |
| 2026-10-08 | **Ziehregel:** Start 10 ziehen / 7 behalten, danach jede Pause eine komplett frische 5/3-Hand. | Handlimit entfällt; ungespielte Karten verfallen (Trostpflaster 4 %); Chronoschrein auf 5/4. |
| 2026-10-08 | **Pixelart komplett von Claude, 16-Bit-Stil.** | Pixel-Werkstatt (Code-Pipeline), RGB555, Master-Palette mit 122 Farben (statt harter 16-Farben-Grenze je Sprite), Stilprobe vor Massenproduktion. |
| 2026-10-08 | **Kerne sind Fraktionen.** | 12 Kerne in 4 Archetypen mit Passive, Aktive, Linien-Affinität, Kern-Anbau, Schwäche (Katalog 03). |
| 2026-10-08 | **Tech-Stack:** Empfehlung Web (TypeScript), Godot als zweite Wahl, Unity nicht. | Bestätigung ausstehend (Q7). |
