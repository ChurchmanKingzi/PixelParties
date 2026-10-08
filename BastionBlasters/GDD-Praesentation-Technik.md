# Bastion Blasters — Game Design Document

**Teil 2: Präsentation, Technik, Balancing, Roadmap** · Version 0.8 · Entwurf zur Abnahme

Teil 1 (Regeln und Systeme): [`GDD.md`](GDD.md) · Kataloge: [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) · [`katalog/02-einheiten.md`](katalog/02-einheiten.md) · [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md)

Legende wie in Teil 1: 🟦 aus deinem Konzept · 🟨 meine Ergänzung · ❓ offene Frage · ⚙ Tuning-Wert · P0/P1/P2 Priorität.

---

## 10. Präsentation

### 10.1 Pixel-Art-Richtlinien (16-Bit) 🟦/🟨 ✔ entschieden: Claude erstellt alle Grafiken

**Perspektive und Look**
- **Schräge Draufsicht (3/4)** mit **einer einzigen, durchgehenden Regel** (v0.3, nach Feedback zur Stilprobe: „die Perspektive der Burgen ergibt nicht wirklich Sinn“):
  1. **Boden = reine Draufsicht** auf dem 32-px-Raster.
  2. **Alles Hohe** (Wände, Türme, Kern, Bäume) steht mit seinem **Fußabdruck** auf dem Boden und wird als **Südansicht** nach oben gezeichnet; Bildhöhe = Bauhöhe, Fußpunkt = Unterkante der Südseite. Es gibt **nur Südseiten** (keine Ost-/Westflächen).
  3. **Wände sind dünn (8 px)** und stehen auf den Zellkanten. Höhen: Nordwand/Innenwand **22 px**, Südwand/Plattformbrüstung **10 px** (aufgeschnittenes Modell, damit man hineinsieht), Seitenwand **20 px** (neben Seitentoren 10 px), Torbogen 24 px, Torpfeiler 34 px, Turm 66 px.
  4. **Tiefenpuffer-Rendering:** Jedes Sprite-Pixel trägt einen Tiefenschlüssel (Fußpunkt-y); Wände werden **pro Fußabdruck-Pixel** nach oben extrudiert. Dadurch verdecken sich Wand, Einheit und Möbel immer korrekt, und Einheiten laufen **hinter** der Nordwand durch.
  5. **Schatten sind Teil der Szene**, nicht der Sprites: Schachbrett-Dither nach unten rechts, an Wandfüßen und unter Bäumen.
  Dächer sind abgenommen, man blickt in jeden Raum. Räume sind mindestens 2 Zellen tief, damit zwischen Nord- und Südwand sichtbarer Boden bleibt.
- **Einheiten:** 3/4-Seitenansicht mit **zwei Blickrichtungen** (rechts gezeichnet, links gespiegelt); Bewegung nach oben und unten nutzt dieselben Frames mit leichter Neigung. Zusätzlich eine **Frontpose** (für Karten und Idle in der Pause). Das hält den Zeichenaufwand klein.
- **Look:** SNES/Mega-Drive-Stil: kräftige Farbrampen, Selbst-Outlines, bewusstes Dithering, glänzende Highlights, 4–6 Töne pro Fläche, comichafte Proportionen (große Köpfe, übertriebene Werkzeuge).
- **Gesichter bewusst einfach** (v0.3): 1–2 Pixel pro Auge, kein Mund mit Zähnen, keine Wimpern. Erkennbar wird eine Figur an **Silhouette, Hut und Werkzeug**, nicht am Gesicht. Ausnahme: Kürbis-Bomber und Katapult („Augen“ sind dort Teil des Witzes).
- **Kürbis-Bomber** schaut **schräg nach vorn** (3/4-Drehung: Rippen als Meridiane, Gesicht zur Blickseite verschoben, rechtes Auge verkürzt, Stiel zeigt nach vorn).

**Raster und Auflösung**
- **Interne Auflösung 1920 × 1080**, nur **ganzzahlig skaliert** (×1 Full-HD, ×2 = 3840 × 2160). Reste als Letterbox, nie gestreckt. Kamerazoom im Zeitstopp ×2 per Nearest-Neighbor.
- **Zelle = 32 × 32 px.** **Karte 56 × 28 Zellen = 1792 × 896 px** (ganz sichtbar, Rest des Bildes für HUD): Baugrund je Spieler **16 × 16 Zellen** (512 × 512 px), dazwischen **20 Zellen** Niemandsland (640 px). Die Karte ist damit ≈ 4× so groß wie die Stilprobe v0.2 (20 × 9 Zellen).
- **Sprite-Größenklassen:** **S** 16 × 16 (Bürger, Goblins, Frösche) · **M** 32 × 32 (Standard) · **L** 48 × 48 (Bären, Trolle, Golems) · **XL** 64 × 64 bis 96 × 96 (Riesen, Dicke Berta, Zeppelin). Bauteile füllen ihre Zellen (2 × 2 = 64 × 64) plus bis zu 16 px Überstand nach oben.

**16-Bit-Disziplin (Palette)**
- Farbraum **RGB555** (32 Stufen je Kanal, wie beim SNES).
- **Master-Palette mit 122 Farben:** 20 **Farbrampen** zu je 6 Tönen (Hue-Shift: Schatten kühler und violetter, Licht wärmer und gelber, nie nur dunkler) plus Tinte und Weiß. **Jede Grafik darf nur Farben daraus verwenden** (die Pipeline prüft das bei Szenen und Karten: `palette_violations`). Schatten und Vignetten dunkeln per **Rampenstufe** ab (`darken_palette`), nie durch Multiplizieren. Die Einheiten der Stilprobe nutzen 95 Farben, die ganze Szene 118.
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
- **Organischer Boden** statt Kachelmuster (v0.3): Wiese aus mehreren Grünrampen (Rauschfelder, quantisiert, Schachbrett-Dither an den Übergängen), Trampelpfade (Erde, Kieseln), Teiche mit Sandufer und Wellen-Dither, dazu Bodendekor (Blümchen, Halme, Kiesel).
- **Kulissen-Objekte** (Tiefenpuffer-sortiert, Schatten darunter): Rundbäume, Kirschbäume, Kiefern, Büsche mit Beeren, Felsen, **Riesenpilze**, Zäune, Wegweiser, Seerosen, Gummienten. Dichter **Randwald** rahmt die Karte; die Mitte bleibt offen und lesbar. Das Biom (GDD §2) bestimmt Farbstimmung und Objektmix.
- **Lesbarkeits-Regel:** Kulissen stehen **nie auf Bauland** und nur selten auf den Hauptwegen; die Wege zwischen den Bastionen bleiben als helle Bänder erkennbar.
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

- **Standard:** feste Weitaufnahme, ganze Karte (1792 × 896 px) mit beiden Baugründen und dem Feld.
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

**Bastion-Screen** (Wireframe, Draufsicht, modular):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⏳ 0:18        ZEITSTOPP — Ausbau        Pause 3                 [✔ Bereit] Gegner: ✔  │
├────────────────┬─────────────────────────────────────────────────────────────────────┤
│ KONTINGENT     │   ┌ Baugrund 16×16 (Raster nur im Baumodus sichtbar) ─────────┐      │
│ ▢ UA-01 ★1     │   │ ·  ·  ┌─K─K─K─┬─S─S─S─┐ ·  ·                               │      │
│ ▢ US-01 ★2     │   │ ·  ·  └───────┴───┬───┘ ·  ·    Module liegen an Hof/Kern    │      │
│ ▢ UV-01 ★1     │   │ ·  ┌ Kernhof 6×6 ──┴──┐ ·  ·    Hover = Vorschau + Nachbarn │      │
│ ▢ UZ-01 ★1     │   │ ·  │ h  h  [KERN] h  h  ▶ Tor    R = drehen · L = Schusslinien │      │
│ ▢ (frei)       │   │ ·  └──────────────────┘ ·  ·    Hof-Erweiterung: 4 von 6    │      │
│ Befehle ▾      │   └───────────────────────────────────────────────────────────┘      │
│                │   (Die eingefrorene Schlacht bleibt als dunkles Diorama dahinter)   │
├────────────────┴─────────────────────────────────────────────────────────────────────┤
│ DEINE HAND (frisch): [Karte] [Karte] [Karte] [Karte] [Karte]   behalten 3 · Reroll 1  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Ziehen-Phase:** 5 Karten offen, 3 anklicken (Rest wird ausgegraut).
- **Platzierung:** Ghost-Sprite folgt der Maus, **R dreht** das Modul; es rastet an **gültigen Kanten** (Hof, Kernhof, Module) ein, ungültige Stellen sind schraffiert; die **Mauersegmente** erscheinen sofort in der Vorschau; Synergie-Nachbarn werden grün/rot markiert; ein Tooltip nennt Posten und Effekt. **Hofzellen** malt man mit gedrückter Maustaste (Zähler „Hof-Erweiterung 4 von 6“).
- **Wandkarten:** Nach dem Ausspielen leuchten die wählbaren Kanten auf; **bis zu 4 zusammenhängende Segmente** anklicken.
- **Warnungen** (nicht verbietend): „Offene Kante (keine Mauer)“ bei zerstörten Segmenten, „Modul vom Tor abgeschnitten“, „Kein Heiler vorhanden“, „Keine Geschützplätze“, „Pulverkammer neben Wohnhaus“.
- **Planungsansicht** 🟨: Taste **P** blendet **Reichweitenringe** (Kurz/Mittel/Weit/Extrem) und die **Baugrund-Raster** ein, wie `art/out/szene_baugrund.png` (Beispiel in der Stilprobe).

**Karten-Layout** (v0.6, umgesetzt in `art/cards.py`; 160 × 224 px, nativ im Pixelraster, ohne Hochskalieren). Alle Kartentexte sind **englisch** und folgen der strengen Nomenklatur ([`NOMENCLATURE.md`](NOMENCLATURE.md)).

```
┌──────────────────────────────┐
│ [II] US-06    ◉3 ↑+2   ★☆☆  │  Kopfzeile: Tier-Plakette, ID, Squad (Person), Reinforce (Pfeil),
│ ┌──────────────────────────┐ │  bei Artillery zusätzlich Gun Slots; Gebäude: Crew; Sterne = ★-Rang
│ │  Bildfenster 144 × 86    │ │  Diorama in Spielgrafik (1x), keine Vergrößerung
│ └──────────────────────────┘ │
│ ══════ Sliding Bear ═════════│  Namensband in der Kategoriefarbe
│ ASSAULT · Frost · Hunter     │  Typzeile, aus den Daten abgeleitet
│ ♥110 FLS ⚔12 ◷1.1  ↳1.5/3   │  Werteleiste: HP + Armor, Schaden (Klingenfarbe = Schadensart), Takt, Tempo
│ Slide Attack (3-cell         │  Effektbox, höchstens 6 Zeilen (5 = Norm): nur mechanischer Text,
│ run-up): Knockback 2 cells,  │  Glossarbegriffe automatisch fett, Fähigkeitsnamen fett
│ Stunned 1s.                  │
│ [RANK 3] Ice Trail: …        │  Rank-3-Talent hinter goldenem Abzeichen
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ Belly first is also a plan.  │  Flavor (1–2 Zeilen; 1 Zeile bei 6 Effektzeilen), nie in der Effektbox
└──────────────────────────────┘
```

- **Rank 3** bedeutet: Die Einheit hat **Rang 3 („Elite“, 300 XP)** erreicht und schaltet ihr **Talent** frei (GDD §8). Das Abzeichen heißt auf der Karte deshalb ausgeschrieben `RANK 3`.
- **Nomenklatur (streng):** Ein Konzept, ein Begriff. Regeltext ist mechanisch (Auslöser → Bedingung → Wirkung → Limit), ohne Ausschmückung; Humor gehört in Namen, Flavor und Grafik. Standardverhalten (Flugbahn, Doktrin, Wachzone, Linie) steht nur im Glossar, nie auf der Karte. Erinnerungstexte erscheinen im Tooltip, nicht auf der Karte. Der Linter `tools/lint_card_text.py` prüft Zahlenformate (`4s`, `30%`, `−20%`, `1.2`), verbotene Wörter, Großschreibung (nur Glossarbegriffe), Fettdruck, Fähigkeitsnamen, die Namensbreite (höchstens 136 px) und die Breite der Typzeile (die Trennpunkte rücken bei Bedarf automatisch enger zusammen).
- **Rahmenfarben:** Artillery **Feuer-Rot/Orange** · Assault **Bernstein** · Defender **Blau** · Civilian **Grün** · Building **Violett** (nicht die Teamfarbe Karmin, damit Karten teamneutral bleiben). **Tier-Plakette:** I Stein, II Grün, III Blau, IV Gold.
- **Schrift:** eigener **Pixelfont „Schlamassia 5 × 7“** (`art/pixfont.py`: Umlaute, ß, Minus, Anführungszeichen), Versalhöhe 7 px, Zeilenabstand 9 px, ca. 25 Zeichen je Zeile; Fettdruck als „kluger“ Doppelanschlag, der 1-px-Lücken (m, w) erhält.
- **Symbole** (7 px, `art/cardicons.py`): heart = HP, sword = Schaden (Klinge Stahl = Impact, orange = Fire, blau = Ice, gelb = Lightning, grün = Poison, violett = Arcane), clock = Takt in Sekunden, target = Reichweite/Radius, boot = Tempo in Zellen/s, person = Squad bzw. Crew, grüner Pfeil = Reinforce, cannon = Gun Slots, plus = Heilung, wall = Reparatur.
- **Textquellen:** Name (EN), Tier, Typzeile und Kopfzeile werden aus `daten/cards.json` abgeleitet (Export aus den Katalogen), Werteleiste, Regeltext, Talent und Flavor stehen in `daten/card_text.json`, die Begriffe in `daten/keywords.json`.
- **Kartenrücken:** violettes Rautengitter mit Strahlenkranz, großes goldenes Logo „BASTION BLASTERS“ (3-fach vergrößerter Pixelfont, Verlauf, Kontur, Schatten), Zinnenband, Zierleisten, Schnörkel, Ecken mit Edelsteinen und der Kernkristall im Medaillon; kein Text außer dem Logo.

**Barrierefreiheit** 🟨: Farbenblind-Modus (Kategorien und Teams zusätzlich über Muster und Symbole), Regler für Screenshake, Zeitstopp-Blitz und Dither-Intensität, große Schrift (Pixelfont in zwei Größen), wählbare Spielgeschwindigkeit in Einzelspieler-Partien, Tastaturkürzel (Leertaste = Bereit, R = Reroll, Tab = Gegner-Info).

### 10.6 Audio 🟨

*Stand v0.8 (Prototyp): Web Audio, alles prozedural ohne Dateien. SFX je Ereignis (Abschuss nach Flugbahn und Geschossart, Einschlag nach Art und Radius, Tod, Bruch, Rang, Heilung, Wellenhorn), UI-Klänge, sechs generative Stücke (Menü G-lydisch 100 BPM, Aufbau A-mixolydisch 106, Kampf D-dorisch 138 mit steigender Spannung, Zeitstopp D-lydisch 66 mit Tiefpass, Sieg- und Niederlagen-Stinger), Raumklang aus der Kartenposition, Polyphonie- und Ratenbegrenzung. Noch offen: Live-Stems mit Chaos-Ebene, Brabbel-Stimmen, Kommentator, Kern-Explosion.*

- **Musik:** Chiptune/FM mit **Live-Stems** (Bass, Schlagzeug, Lead, Chaos-Ebene). Die Chaos-Ebene schaltet sich bei vielen Einheiten und Beschuss zu. **Zeitstopp:** Tiefpass, die Percussion fällt weg, ein Uhr-Ticken legt sich darunter; beim Auftauen kommen die Stems zurück.
- **SFX:** Einschläge nach Material (Holz knackt, Stein knirscht, Pudding macht *bloing*, Metall *dong*), Rang-Aufstieg als kleines Arpeggio.
- **Stimmen:** Jede Einheit hat eine **Brabbel-Stimme** (Gibberish-Synth, Tonhöhe nach Größe), die bei Angriff, Rückzug und Tod ertönt. Kein Sprachtext nötig.
- **Kommentator** (P2): Ein überdrehter Ansager kommentiert Ereignisse („Gerd der Unverdauliche hat Rang 5!“). Zuerst nur als Text im Ereignisfeed.
- **Kern-Explosion:** Stille → Herzschlag → großer Knall mit Nachhall → verwehender Wind.

---

## 11. Technische Leitplanken 🟨

**Entscheidung** (✔ Q7, bestätigt): **Web-Spiel mit TypeScript, Vite und PixiJS** (oder reinem Canvas), pixelgenau über Ganzzahl-Skalierung und `image-rendering: pixelated`, plus ein Post-Processing-Shader für Dither und Palette.

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
- **Wegfindung:** **A\* auf dem Zellenraster** (8 Richtungen, kein Ecken-Schneiden) für Bastion und Feld; **Mauern liegen auf Zellkanten** (Kante gesperrt, Tür/Tor offen), Turmzellen und Kern sind gesperrte Zellen; Hindernisse haben Zerstörungskosten (HP/100). Gedränge im Feld über weiche Abstoßung. Sonderfälle: Flieger, Geister, Wühler (eigene Regeln). Dank Draufsicht entfällt der aufwendige Raumgraph mit Etagen; das Hauptrisiko des Querschnitts ist damit weg.
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

- Ein Kern (KE-00), **Kernhof 6 × 6 auf Baugrund 16 × 16**, automatische Mauersegmente, Haupttor, Module (2 × 2, 3 × 2, 3 × 3) mit Türen, Hof-Erweiterung, Bürger. Karte 56 × 28 Zellen.
- **18 Bauteile** (Katalog 01, Liste „P0“) und **19 Truppen** (Katalog 02, Liste „P0“).
- Phase 1 + Kampfzyklus + Zeitstopp mit einfacher Kamerafahrt (noch ohne Dither-Effekte).
- Simulation: Spawn/Nachschub, Navigation (A* auf dem Raster), Artillerie (Flach + Bogen, Schusslinie, Zielschatten), Sturmtruppen (Jäger, Brecher, Eroberer, Plünderer, Sprenger), Rückzug und Heilung, Verteidiger-Zonen, Personal/Bürger, Eroberung, Kern-HP, XP und Ränge (ohne Talente), beide Siegbedingungen.
- Platzhalter-Grafik (später die Pixelart aus der Pixel-Werkstatt), Debug-Overlay (Zellen, Pfade, Exposition, XP), einfacher Bot-Gegner.

**P1:** Wandkarten und Tor-Karten, Hof-Erweiterung je Pause (im MVP fester Satz), Fraktions-Kerne, restliche Linien und Karten, Kern-Fähigkeiten, Talente, Statuseffekte komplett, Materialien/Rüstungsmatrix, Zeitstopp-Regie in Pixelart, Explosion, UI-Skin, Audio.
**P2:** Welt-Launen, Chaos-Karten, Baustile, Biom-Wechsel, Kommentator, Signaturkarten, Online-Modus.

### 13.2 Meilensteine

| # | Meilenstein | Ergebnis („Definition of Done“) |
|---|---|---|
| **M0** | Entscheidungen & Daten | Offene Fragen aus §14 beantwortet; Kataloge als JSON/YAML exportiert; Tuning-Tabelle als Datei. |
| **M1** | Pixel-Werkstatt & Stilprobe | Code-Pipeline für 16-Bit-Pixelart (Rampen, Shading, Dither, Outline, Palette-Prüfung); Stilprobe mit Kontaktbogen, ersten Bauteilen, Einheiten und einer Szenen-Montage; **deine Freigabe des Stils.** *Stand: Stilprobe **v0.3** (große Karte, modulare Burgen, vereinfachte Gesichter, Kürbis in 3/4-Ansicht, reichere Landschaft) und die **ersten 17 Karten** (Layout, Pixelfont, Dioramen, Kartenrücken) liegen in `art/out/` vor und warten auf deine Freigabe.* |
| **M2** | Kampf-Greybox | 2D-Feld und Bastion-Raster mit Platzhalterquadraten; Einheiten spawnen, laufen, kämpfen; eine **komplette Bot-gegen-Bot-Partie** läuft bis zum Sieg und ist als Replay abspielbar. *Stand: **erledigt als Prototyp** (`game/`): Bot gegen Bot läuft bis zum Sieg (Terminal und Browser), deterministisch getestet; dazu sind Teile von M3 und M4 spielbar (Mensch gegen Bot, Bauen per Klick, Loadout, Zeitstopp mit 5/3-Hand).* |
| **M3** | Bastion-Builder | Module an Kanten anlegen, Drehen, Auto-Mauern und Türen, Hof-Erweiterung, Tags, Nachbarschaft, Validierung. Ein Mensch kann eine Bastion bauen. |
| **M4** | Karten-Loop & Zeitstopp | Kern-Wahl, Loadout 10/7, frische 5/3-Hand, Kontingent, Pausenablauf mit einfacher Kamerafahrt. Eine **komplette Partie ist spielbar** (Mensch vs. Bot). |
| **M5** | Rollen vertiefen | Rückzug/Heilung, Personal, Eroberung, XP/Ränge laufen vollständig; erster Balance-Pass mit Bot-Sims. |
| **M6** | Vertical Slice (Art) | 1 Baustil, 10 voll animierte Einheiten, Dither-Zeitstopp, Kern-Explosion, UI-Skin; ein 3-minütiges Video, das schon „nach dem Spiel“ aussieht. |
| **M7** | Content-Welle 1 | Alle P0- und P1-Karten, die ersten Fraktions-Kerne, Wand- und Tor-Karten; Balance-Pass 2. |
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
| **Labyrinth-Verstopfung** (Hof-Erweiterung und Mauerwerk sind kostenlos) | Wegkosten berücksichtigen Zerstörungsaufwand, Mauern haben HP, Türme und Verteidiger sind der Gegenpol; notfalls Limit der Hofzellen pro Pause. |
| **Perspektiv-Fehler in Grafik und Regeln** (v0.3: Seitentor wird von der Seitenwand verdeckt) | Eine Regel (§10.1), Tiefenpuffer-Renderer, Seitentore als volle Zellendurchlässe, Kontaktbogen als Pflichtprüfung für jede neue Bauart. |
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
| **Q7** | Tech-Stack | ✔ **Web (TypeScript + Vite + PixiJS)**, siehe §11. Godot 4 und Unity entfallen. |
| **Q8** | Woher kommt die Pixelgrafik? | ✔ **Komplett von Claude, 16-Bit-Stil** (§10.1). |
| **Q9** | Sprache: Deutsch zuerst, aber i18n-fähig? | ❓ Default: **ja.** |
| **Q10** | Fraktionen oder Kerne als Asymmetrie? | ✔ **Kerne sind Fraktionen** (GDD §9.1, Katalog 03). |
| **Q11** | Welt-Launen und Chaos-Karten: später oder streichen? | ❓ Default: **später (P2).** |
| **Q12** | Statik-Kollaps | ✘ **Entfällt** (nur im Querschnitt sinnvoll). |
| **Q13** | Eigenes Repository für das Spiel? | ❓ Default: **ja.** |
| **Q14** | Name „Bastion Blasters“: Marken-/Namensprüfung? | ❓ **Offen** (ich habe nichts geprüft). |
| **Q15** | Kern-Wahl frei und verdeckt aus allen 12, oder 3 zufällig angeboten? | ❓ Default: **frei**, Zufallsmodus optional. |
| **Q16** | Ungespielte, behaltene Karten verfallen. Mit Trostpflaster (4 % Reparatur je Karte)? | ❓ Default: **ja.** |
| **Q17** | Mauerwerk setzt sich automatisch und kostenlos an alle Außen- und Modulkanten; dazu Hof-Erweiterung (Labyrinthe)? | ❓ Default: **ja**, mit Beobachtung (Risiko in §13.3). |
| **Q18** | Einheiten mit zwei Blickrichtungen (rechts/links gespiegelt) statt vier? | ❓ Default: **ja** (spart Zeichenaufwand). |
| **Q19** | Karte 56 × 28 Zellen, Baugrund 16 × 16, Niemandsland 20 Zellen, Reichweiten 26 / 34 / 42 / 50? | ✔ **größere Karte entschieden** (Feedback). ❓ Exakte Maße Default: **wie vorgeschlagen.** |
| **Q20** | Hof-Erweiterung: 12 Zellen im Erstaufbau, danach 6 je Zeitstopp, kostenlos? | ❓ Default: **ja** (⚙ `HOF_START` / `HOF_PER_PAUSE`). |
| **Q21** | Große Einheiten (L/XL) und Türen | ✔ **Alle Einheiten dürfen durch jede Tür**; die 14 px sind nur Optik. |
| **Q22** | Bauteile auf Hofzellen statt in Räumen | ✔ **Ja, je Bauteil einzeln entschieden** (nicht nach Größe). Hof-Bauteile sind leichter zugänglich (außer im Innenhof) und leichter zerstörbar (GDD §4.1, Katalog 01). |
| **Q23** | Design-Dokumente (`GDD*.md`, Kataloge) ebenfalls ins Englische übersetzen? | ✔ **Nein, das GDD bleibt deutsch** (Entscheidung des Auftraggebers); die Spielsprache bleibt Englisch. |

---

## 15. Glossar

> Die englischen Spielbegriffe und ihre strenge Verwendung stehen in [`NOMENCLATURE.md`](NOMENCLATURE.md). Dieses Glossar erklärt die deutschen Designbegriffe.

| Begriff | Bedeutung |
|---|---|
| **Abstempeln** | Neue Bauteile werden nach der Pause aus der Blaupause in echte Gebäude verwandelt. |
| **Alarm** | Zustand, wenn Eindringlinge in der Bastion sind; verdoppelt die Leine der Verteidiger. |
| **Artillerie** | Truppen auf Geschützplätzen, die die gegnerische Bastion beschießen. |
| **Bastion** | Die Festung eines Spielers: modularer Grundriss aus Kernhof, Hof, Modulen, Türmen und Mauern. |
| **Baugrund** | Fläche von 16 × 16 Zellen, auf der ein Spieler bauen darf. |
| **Behandlungsplatz** | Platz in einer Heilquelle, den ein verwundeter Sturmtrupp belegt. |
| **Beute** | Gebäude, die Plünderer ablenken (Schatztruhe, Wunschbrunnen, Trophäenhalle). |
| **Blaupause** | Darstellung eines neu gelegten Bauteils während der Pause. |
| **Bresche** | Zerstörtes Mauersegment an der Außenkante, das als zusätzlicher Eingang dient. |
| **Bürger** | Standard-Zivilisten ohne Karte, die Posten besetzen. |
| **Doktrin** | Zielverhalten einer Sturmtruppe (Jäger, Brecher, Eroberer, Plünderer, Sprenger). |
| **Eindringling** | Feindliche Sturmtruppe innerhalb der Bastion. |
| **Eroberung** | Sieg durch Besetzen der Kernkammer (Leiste 100 %). |
| **Geschützplatz (GP)** | Platz auf einer Plattform, den Artillerie benötigt. |
| **Fraktion / Kern** | Der Kern, den man wählt, bestimmt Passive, aktive Fähigkeit, Linien-Affinitäten und Schwäche (Archetyp: Belagerer, Stürmer, Bollwerk, Tüftler). |
| **Heilquelle** | Alles, was für die Rückzugsregel zählt (Heilgebäude, Heiler, Aura-Heilung). |
| **Hof-Erweiterung** | Kostenlose Hofzellen, die der Spieler im Erstaufbau (12) und je Zeitstopp (6) anlegt. |
| **Hof / Innenhof** | Leere, begehbare Zelle der Bastion. Zwischen Hofzellen steht keine Wand. |
| **Kern** | Zentrum der Bastion; fällt er, wird der Besitzer besiegt. |
| **Kern-Anbau** | Kostenloser Freischalt-Raum der Hauptlinie des Kerns (★2). |
| **Kernhof** | Start-Hof 6 × 6 um den Kern. |
| **Kernkammer** | 2 × 2 Raum um den Kern; Ort der Eroberung. |
| **Kontingent** | Armee-Leiste aus Truppen-Karten (5–8 Plätze). |
| **Linie** | Truppen-Gruppe, die ein Freischalt-Raum freigibt (Waffen, Arkan, Tier, …). |
| **Nachschub (N)** | Wie viele Einheiten einer Karte pro Welle nachgeliefert werden. |
| **Mauersegment** | 32 px langes, 8 px dünnes Wandstück auf einer Zellkante; entsteht automatisch (⚙ 300 HP). |
| **Modul** | Raum aus ≥ 2 × 2 zusammenhängenden Zellen, der an Hof/Kern/Modul angrenzt. |
| **Niemandsland** | Feld zwischen den Baugründen (20 Zellen). |
| **Hof-Bauteil** | Bauteil auf Hofzellen ohne eigene Wände (Fallen, Zelte, Brunnen, Lafetten); frei zugänglich, fragiler, im Innenhof geschützt. |
| **Außenhof / Innenhof** | Außenhof: Hof, der ohne Tür vom Tor oder einer Bresche erreichbar ist. Innenhof: Hof, den man nur durch Türen von Modulen erreicht. |
| **Panikraum** | Raum, in dem Zivilisten unangreifbar sind. |
| **Posten** | Arbeitsplatz in einem Raum, der Personal braucht. |
| **Rang** | Erfahrungsstufe R0–R5 einer Einheit. |
| **Turmzelle** | Massive 1 × 1-Zelle eines Turms an der Außenkante; wird nicht von Wänden umschlossen. |
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
| `WORLD_CELLS` | Karte (1792 × 896 px) | 56 × 28 | – |
| `GRID_PLOT` | Baugrund je Spieler | 16 × 16 | 14–18 |
| `KERNHOF` | Start-Hof um den Kern | 6 × 6 | – |
| `HOF_START` / `HOF_PER_PAUSE` | Kostenlose Hofzellen im Erstaufbau / je Zeitstopp | 12 / 6 | 8–16 / 3–10 |
| `MODULE_MIN_DEPTH` | Mindesttiefe von Raum-Modulen | 2 Zellen | fest |
| `WALL_T` / `DOOR_W` | Wanddicke / Türbreite (px) | 8 / 14 | – |
| `GATE_SIZE` | Haupttor | 1 Zelle | – |
| `CORNER_TOWER_BONUS` | Eckturm: Reichweite / HP | +1 / +10 % | – |
| `SHELL_SPREAD_BASE` / `_PER_CELL` | Streuung von Bogen/Senkrecht (Zellen) | 0,4 / 0,04 | – |
| `TELEGRAPH_BOGEN_S` / `_SENKRECHT_S` | Zielschatten vor dem Einschlag | 1,2 / 2,0 | – |
| `FIELD_GAP_CELLS` | Niemandsland (Front zu Front) | 20 | 16–24 |
| `CORE_HP` / `CORE_REGEN` | Kern | 5000 / 2 HP/s | 3500–7000 |
| `GATE_HP` / `WALL_SEG_HP` | Tor / Mauerwerk je Segment | 500 / 300 | 200–450 |
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
| `RANGE_ARTILLERY` | Kurz / Mittel / Weit / Extrem (Zellen) | 26 / 34 / 42 / 50 | – |
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
| **0.3** | Rückmeldung zur Stilprobe eingearbeitet: **konsistente Perspektive** (Südansicht, dünne Kantenwände, Tiefenpuffer), **modulare Bastion** (Baugrund 16 × 16, Kernhof, Module ≥ 2 tief, Auto-Mauern, Hof-Erweiterung, Wandkarten, Seitentore) statt 6 × 6 + Ringmauer + Erweiterungen, **größere Karte** (56 × 28 Zellen, 1920 × 1080), Reichweiten 26 / 34 / 42 / 50, Katalog 01 neu vermessen (Module / Objekte / Türme / Kanten), **vereinfachte Gesichter**, **Kürbis in 3/4-Ansicht**, reichere Landschaft, Planungsansicht mit Reichweitenringen. |
| **0.4** | Zweite Rückmeldung: Gesichter von Goblin, Eisbär, Hexe und Gnom weiter vereinfacht; **Tech-Stack bestätigt**; **Hof-Bauteile** (Bauart je Bauteil einzeln, zugänglicher und fragiler, Innenhof geschützt); **alle Einheiten passen durch jede Tür**; erste Karten (Kartenlayout, Pixelfont, Datenexport). |
| **0.5** | Dritte Rückmeldung: **Spielsprache Englisch**, **strenge Nomenklatur** (`NOMENCLATURE.md`, `daten/keywords.json`, Linter, englische Namen für alle 154 Karten), Regeltext nur mechanisch mit automatisch fetten Schlüsselwörtern, Flavor getrennt von der Effektbox, **Rank-3-Abzeichen** ausgeschrieben, Kartenrücken neu (großes Logo), Effektbox auf 5 Zeilen (Bildfenster 144 × 86). |
| **0.6** | **Alle 154 Karten angelegt** (77 Bauteile, 77 Einheiten): englische Texte in `daten/card_text.json`, Illustrationen als Code in zwölf Packs (`art/pack_*.py`, Anleitung `art/ART_GUIDE.md`, Prüfung mit `art/packtool.py`), Renderer mit Platzhalterbild, 6 Effektzeilen, automatisch verdichteter Typzeile und Kontaktbögen je Gruppe (`art/sheets.py`). Glossar auf **140 Begriffe** erweitert (u. a. Knockback, Taunt, Lifesteal, Alarm, Leash, Aura, Burrowed, Chaos-born); Flugbahn **Underground → Burrowing**; Linter prüft Fähigkeitsnamen, Namens- und Typzeilenbreite. Beim Texten vereinheitlicht: **Fed** gibt überall +15 % (statt +20 % beim Eintopf-Koch), **Hardened** ist definiert, BS-01 Masonry ist eine reine Referenzkarte (wird nie gezogen). |
| **0.7** | **Kampf-Prototyp** (`game/`, TypeScript, Vite, PixiJS): deterministische Simulation mit allen vier Truppenkategorien, sieben Flugbahnen, Auto-Mauern auf Kanten, A*, Personal, Heilung und Rückzug, Eroberung, XP und Ränge, Wellen, Zeitstopp, Ziehen 10/7 und 5/3, Bot; Browser-Oberfläche mit Loadout, Bauphase, Kontingent und Inspektor; als Einzeldatei-Artifact veröffentlicht. Vom Auftraggeber bestätigt: GDD bleibt deutsch (Q23), interne Annahmen der Kartentexte (Fed +15 %, Hardened, Knockback, Doppelbombe, Masonry als Referenzkarte) gelten. |
| **0.8** | **Rückmeldung aus dem ersten Spieltest** (Prototyp): **Kernhof nach hinten** mit 8 Zellen langem **Zufahrtsgang** zum Haupttor (§4.1, Hof-Erweiterung 16 statt 12); **Räume dürfen an Räume anbauen** (Türen zu Nachbarräumen, Raumketten und Labyrinthe); **Glossar-Tooltips** (Begriffe im Text, Statusnamen und Kartenbilder erklären sich beim Überfahren; die Kartenrenderer exportieren dafür Begriffsfelder `art/out/cards_hotspots.json`); **große Kartenvorschau**, Handkarten wachsen beim Überfahren, Mausrad dreht Gebäude in der Hand; **Einheiten in Teamfarbe umrandet** mit Fußring; **Kapazitätsanzeige** (Bürger-Limit, Kontingent-Plätze und wie man sie erweitert); **Ton**: prozedurale SFX und Musik (§10.6, Web Audio, keine Dateien). |

---

## Anhang D — Entscheidungsprotokoll

| Datum | Entscheidung | Folgen |
|---|---|---|
| 2026-10-08 | **Draufsicht statt Querschnitt, nicht beides.** Beide Ansichten zugleich zu pflegen würde Regeln (Schusslinie, Wege, Platzierung) und die gesamte Grafik doppelt kosten. Die systemischen Teile (Karten, XP, Rückzug, Personal, Eroberung, Wellen, Zeitstopp) sind ansichtsunabhängig und bleiben. | Neues Raster mit Ringmauer, Schusslinie und Zielschatten statt Exposition, Tags ohne Etagen, Wegfindung per A*, Statik-Kollaps gestrichen. Sieben Bauteile und neun Einheiten angepasst. |
| 2026-10-08 | **Ziehregel:** Start 10 ziehen / 7 behalten, danach jede Pause eine komplett frische 5/3-Hand. | Handlimit entfällt; ungespielte Karten verfallen (Trostpflaster 4 %); Chronoschrein auf 5/4. |
| 2026-10-08 | **Pixelart komplett von Claude, 16-Bit-Stil.** | Pixel-Werkstatt (Code-Pipeline), RGB555, Master-Palette mit 122 Farben (statt harter 16-Farben-Grenze je Sprite), Stilprobe vor Massenproduktion. |
| 2026-10-08 | **Kerne sind Fraktionen.** | 12 Kerne in 4 Archetypen mit Passive, Aktive, Linien-Affinität, Kern-Anbau, Schwäche (Katalog 03). |
| 2026-10-08 | **Tech-Stack:** Empfehlung Web (TypeScript), Godot als zweite Wahl, Unity nicht. | Bestätigung ausstehend (Q7). |
| 2026-10-08 | **Perspektive als eine durchgehende Regel:** Boden Draufsicht, Hohes als Südansicht, dünne Wände auf Zellkanten, Tiefenpuffer. | Räume ≥ 2 Zellen tief; Seitentore als volle Zellendurchlässe (sonst verdeckt die Seitenwand die Öffnung); Pflichtprüfung am Kontaktbogen. |
| 2026-10-08 | **Bastionen sind modular statt Quadrate.** Baugrund 16 × 16, Kernhof 6 × 6, Module ≥ 2 tief, Mauern automatisch auf Kanten, Hof-Erweiterung 12 + 6 je Pause. | GDD §4 neu, Katalog 01 neu vermessen (23 Module 3×2, 11 Module 3×3, 8 Module 2×2, 10 Türme, 20 Objekte, 3 Wandkarten, 1 Tor-Karte), Tags auf Kanten umgestellt, Wegfindung mit Kantenkosten. |
| 2026-10-08 | **Größere Karte:** 56 × 28 Zellen, Niemandsland 20 Zellen, Reichweiten 26 / 34 / 42 / 50. | Längere Laufwege (Welle braucht ≈ 13 s bis zur Front), Kern erst mit Mittel-Geschützen erreichbar, Platz für Kulisse und Wege. |
| 2026-10-08 | **Gesichter vereinfacht, Kürbis schaut schräg nach vorn.** | Regel „Silhouette vor Gesicht“ in §10.1; Kontaktbogen zeigt Gesichter in Nahaufnahme. |
| 2026-10-08 | **Tech-Stack bestätigt:** Web (TypeScript, Vite, PixiJS). | Sim headless in Node, Karten als JSON (`daten/cards.json`, aus den Katalogen exportiert), Pixel-Werkstatt bleibt Python und liefert PNG + Atlas. |
| 2026-10-08 | **Hof-Bauteile, Bauart je Bauteil einzeln** (nicht nach Größe); zugänglicher und fragiler, außer im Innenhof. **Alle Einheiten passen durch jede Tür.** | Katalog 01: 39 Räume, 20 Hof-Bauteile, 13 Turmzellen, 4 Wand, 1 Tor (neu zugeordnet); HP einiger Hof-Karten gesenkt; Pfadfindung kennt Außen-/Innenhof (für Zielwahl und Fallen). |
| 2026-10-08 | **Spielsprache Englisch, strenge Nomenklatur.** Ein Konzept, ein Begriff; Regeltext mechanisch; Glossarbegriffe automatisch fett; Standardverhalten nur im Glossar. | `NOMENCLATURE.md` (erzeugt aus `daten/keywords.json`), `tools/lint_card_text.py`, Katalogspalte „Name (EN)“ für alle 154 Karten, Kartentexte in `daten/card_text.json`; Design-Dokumente bleiben deutsch. |
| 2026-10-08 | **Flavor gehört nie in die Effektbox.** Rein beschreibende Sätze („Billiger Massenstürmer“) entfallen oder wandern in die Flavor-Zeile. | Vanilla-Einheiten haben eine leere Effektbox bis auf das Rank-3-Talent. |
| 2026-10-08 | **Alle 154 Karten sind angelegt.** Illustrationen entstehen als Code in Packs (je eine Kartengruppe), geprüft auf Größe 144 × 96, Master-Palette und Determinismus. | Neue Einheiten haben vorerst nur ein Ruhebild (`idle`); Animationen (Gehen, Angriff, Tod) folgen mit dem Kampf-Greybox. Kerne (Katalog 03) und Chaos-/Weltlaunen-Karten haben noch keine Karten. |
| 2026-10-08 | **Typzeile darf nie überlaufen:** Trennpunkte rücken automatisch enger zusammen; reicht das nicht, warnen Renderer und Linter. Flugbahn **Underground** heißt **Burrowing** (passt zum Status Burrowed). | Kein Karteninhalt wurde gekürzt; die Namen der Spielbegriffe bleiben die einzige Quelle (`daten/keywords.json`). |
| 2026-10-08 | **Der Prototyp zuerst als Kampf-Greybox mit echter Grafik.** Ein Spielstand, der im Browser läuft, ersetzt weitere Papierarbeit: Regeln werden am Spiel getestet, nicht diskutiert. | `game/` mit Simulation, Darstellung und Bot; Artifact-Link zum Testen; Bot-Statistik als Balance-Grundlage. |
| 2026-10-08 | **Prototyp-Annahmen (vom Karten-Designer bestätigt):** Kernkammer = Kern plus ein Ring von einer Zelle (4 × 4); ein Standardkern ohne Fraktions-Fähigkeiten; Wandkarten wirken auf bis zu 4 zusammenhängende Segmente; Fernangriffe von Einheiten und Türmen treffen sofort; Zeitgeber 180 s Aufbau und 60 s Zeitstopp (im Menü einstellbar). | Siehe `game/README.md`, Abschnitt Annahmen. Erste Bot-Zahlen: Eroberung gewinnt zu oft gegen Zerstörung (18 : 6), Stellschrauben dokumentiert. |
