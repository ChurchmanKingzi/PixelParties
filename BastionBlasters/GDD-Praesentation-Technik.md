# Bastion Blasters — Game Design Document

**Teil 2: Präsentation, Technik, Balancing, Roadmap** · Version 0.1 · Entwurf zur Abnahme

Teil 1 (Regeln und Systeme): [`GDD.md`](GDD.md) · Kataloge: [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) · [`katalog/02-einheiten.md`](katalog/02-einheiten.md) · [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md)

Legende wie in Teil 1: 🟦 aus deinem Konzept · 🟨 meine Ergänzung · ❓ offene Frage · ⚙ Tuning-Wert · P0/P1/P2 Priorität.

---

## 10. Präsentation

### 10.1 Pixel-Art-Richtlinien 🟦/🟨

**Raster und Auflösung**
- **Interne Auflösung 960 × 540**, nur **ganzzahlig skaliert** (×2 = 1920 × 1080, ×3 = 2880 × 1620). Reste werden als Letterbox gezeigt, nie gestreckt.
- **Zelle = 32 × 32 px.** Passt: Bastion 8 Zellen · Niemandsland ≈ 12 · Bastion 8 = 28 Zellen = 896 px.
- **Sprite-Größenklassen:** **S** 16 × 16 (Bürger, Goblins, Frösche) · **M** 32 × 32 (Standard) · **L** 48 × 48 (Bären, Trolle, Golems) · **XL** 64 × 64 bis 96 × 96 (Riesen, Dicke Berta, Zeppelin). Bauteile füllen ihre Zellen exakt (2 × 2 = 64 × 64).

**Palette**
- Maximal **64 Farben** insgesamt, aufgebaut aus **Farbrampen** zu je 5–7 Tönen mit **Hue-Shift** (Schatten kühler und violetter, Licht wärmer und gelber, nie nur dunkler).
- Rampen: Stein · Holz · Flora · Haut (2 Varianten) · Metall · Magie-Violett · Feuer · Eis · Schleim-Grün · Knochen · Himmel (Tag/Dämmerung/Nacht) · **Team P1** (Karmin/Gold) · **Team P2** (Türkis/Violett).
- **Teamfarben per Palette-Swap:** Banner, Zierleisten, Umhänge, Schulterplatten und Lichter sind in einer Index-Farbe gezeichnet und werden zur Laufzeit durch die Teamrampe ersetzt. Eine Grafik, zwei Teams.

**Dithering und Shading (Kern des Looks)**
- **Verläufe** (Himmel, Nebel, Schatten, Glühen) immer per **geordnetem Dithering (Bayer 2 × 2 / 4 × 4)**, nie als weicher Alpha-Verlauf.
- **Schachbrett-Dither (50 %)** für Transparenz (Geister, Blaupausen, Schild-Blasen). **Rauschen-Dither** für Rauch und Staub.
- Licht kommt von **oben links**. Jede Fläche hat **3–4 Töne** (Basis, Licht, Schatten, Glanz). **Selbst-Outline (Sel-Out):** Konturen sind ein dunklerer Ton des Objekts, nie reines Schwarz. **Rim-Light** in Magie- oder Teamfarbe für Silhouettenschärfe.
- **Okklusions-Dither** in den Ecken der Zellen, damit die Bastion Tiefe bekommt. Fensterlicht warm, Magie kalt.
- **Post-Processing im Pixelraster:** Ein Shader quantisiert die FX-Ebene (Glühen, Nebel, Frost) auf die Palette und wendet eine Bayer-Matrix an; so bleiben auch Effekte „echtes“ Pixelart.

**Animation und Juice**
- Frames: Idle 4 · Gehen 6 · Angriff 4–6 (mit Vorbereitung und Smear-Frame) · Treffer 2 · Tod 6–8 · Spezialfähigkeiten nach Bedarf.
- **Übertriebenes Squash & Stretch**, Idle mit Persönlichkeit (gähnen, kratzen, winken).
- **Hit-Stop** 3–5 Frames bei großen Treffern, **1-Frame-Weißblitz**, kleines Screenshake (1–2 px; Kernexplosion 6 px).
- **Partikel:** 1–3 px große Quadrate aus der Palette, kein Alpha-Blending, nur Dither-Transparenz.
- Zerstörung: Zellen brechen in 3–5 Teile (Schutt, Holz, Fahnenfetzen), nicht in Zufallspixel.

**Welt**
- Parallax-Himmel mit 3–4 Ebenen: Wolken, schwebende Inseln, Mond (je nach Welt-Laune), ein kaputter Himmelsriss, der langsam wandert.
- Niemandsland je nach Biom (GDD §2), mit liegengebliebenen Dingen (Skelette, Hüte, ein Schuh).

**Lesbarkeit (Regeln für jede neue Karte)**
1. **Silhouette zuerst:** Jede Einheit ist im Schwarzbild von jeder anderen unterscheidbar.
2. **Kategorie am Körper:** Artillerie hat immer ein sichtbares „Geschütz“, Verteidiger sind breit und groß, Zivilisten tragen ihr Werkzeug groß, Sturmtruppen sind in Bewegung dargestellt.
3. **Zustände sichtbar:** Verwaist (Spinnweben), Brennen, Eingefroren, Fliehend (Schweißtropfen und Tempolinien), Todesmut (rote Augen) werden am Sprite gezeigt, nicht nur im Icon.
4. **Teamfarbe nie weglassen.**

**Asset-Pipeline** 🟨: Aseprite (`.aseprite`) → Spritesheet + JSON (Tags = Animationen) → Atlas. Namensschema `{id}_{anim}_{frames}`, z. B. `UA-01_attack_6`. **Prototyp:** Platzhalter aus Farbblöcken mit Kurznamen, optional aus Code erzeugte Pixelmuster; echte Grafik ab Meilenstein M5.

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

**Bastion-Screen** (Wireframe):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⏳ 0:18        ZEITSTOPP — Ausbau        Pause 3                 [✔ Bereit] Gegner: ✔  │
├────────────────┬─────────────────────────────────────────────────────────────────────┤
│ KONTINGENT     │          ┌──┬──┬──┬──┬──┬──┐                                         │
│ ▢ UA-01 ★1     │          │  │  │  │  │  │  │   Raster                                │
│ ▢ US-01 ★2     │          ├──┼──┼──┼──┼──┼──┤   Hover = Vorschau + Nachbarschaft      │
│ ▢ UV-01 ★1     │          │  │  │ KERN │  │  │   Rechtsklick = Info                    │
│ ▢ UZ-01 ★1     │          ├──┤  │      ├──┼──┤                                         │
│ ▢ (frei)       │          │  │  │      │  │TO│                                         │
│ Befehle ▾      │          └──┴──┴──────┴──┴──┘                                         │
├────────────────┴─────────────────────────────────────────────────────────────────────┤
│ HAND: [Karte] [Karte] [Karte] [Karte] [Karte]    gezogen 5 · behalten 3 · Reroll 1    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Ziehen-Phase:** 5 Karten offen, 3 anklicken (Rest wird ausgegraut).
- **Platzierung:** Ghost-Sprite folgt der Maus; gültige Zellen leuchten, ungültige sind schraffiert; Synergie-Nachbarn werden grün/rot markiert; ein Tooltip nennt Posten und Effekt.
- **Warnungen** (nicht verbietend): „Raum vom Tor abgeschnitten“, „Kein Heiler vorhanden“, „Keine Geschützplätze“, „Pulverkammer neben Wohnhaus“.

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

**Empfehlung** (❓ Q7): Browser, TypeScript, Vite, Rendering über **PixiJS** oder **Phaser** (beide sind gut für pixelgenaue 2D-Darstellung). Ganzzahl-Skalierung mit `image-rendering: pixelated`; ein Post-Processing-Shader für Dither und Palette.

**Architektur**
- **Simulation strikt von der Darstellung getrennt.** Die Sim läuft mit **festem Zeitschritt (30 Hz)**, ist **deterministisch** (seed-basiertes RNG, keine Zufallswerte aus der Darstellung) und kann **headless** in Node laufen.
- **Befehlslog + Seed = Replay.** Daraus entstehen Replays, Debugging, Fehlersuche und später Online-Synchronisation (Lockstep).
- **Datengetrieben:** Karten stehen in JSON/YAML (siehe Anhang B). Fähigkeiten sind Bausteine (**Trigger → Bedingung → Effekt**); im Code stehen nur die Verhaltens-Archetypen (Doktrinen, Zonen, Flugbahnen).
- **Systeme** (in fester Reihenfolge pro Tick): Spawn · Navigation · Targeting · Combat · Projectile (Exposition) · Status · XP/Rang · Staffing (Personal) · Healing/Retreat · Conquest · Win-Check. Danach Darstellung (Kamera, FX, UI).
- **Wegfindung:** Zwei Ebenen. Im Feld eine Dimension (x-Achse). In der Bastion ein **Raumgraph** mit Kantentypen (Tür, Leiter, Aufzug, Rutsche, Portal) und Kosten (Zeit + Zerstörungsaufwand). Früh prototypen, denn hier steckt das meiste Risiko.
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
| Kern erstmals exponiert | meist Min. 6–9 |
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
- **Zu starke Defensive ⇒ Patt.** Gegenmittel: Exposition, Wahnsinn, Kern-Reichweite (frühe Artillerie erreicht den Kern nicht, später ja).
- **Zu starke Artillerie ⇒ Sturm überflüssig.** Gegenmittel: Reparatur, Schilde, kurze Reichweiten früh, Sturmtruppen als einziger Weg, Personal abzuschalten.

---

## 13. Scope, Roadmap, Risiken

### 13.1 MVP (P0) — ein spielbarer Kern

- Ein Kern (KE-00), Raster 6 × 4 (ohne Erweiterungen), Tor, Bürger.
- **18 Bauteile** (Katalog 01, Liste „P0“) und **19 Truppen** (Katalog 02, Liste „P0“).
- Phase 1 + Kampfzyklus + Zeitstopp mit einfacher Kamerafahrt (noch ohne Dither-Effekte).
- Simulation: Spawn/Nachschub, Navigation (Raumgraph), Artillerie (Flach + Bogen, Exposition), Sturmtruppen (Jäger, Brecher, Eroberer, Plünderer, Sprenger), Rückzug und Heilung, Verteidiger-Zonen, Personal/Bürger, Eroberung, Kern-HP, XP und Ränge (ohne Talente), beide Siegbedingungen.
- Platzhalter-Grafik, Debug-Overlay (Zellen, Pfade, Exposition, XP), einfacher Bot-Gegner.

**P1:** Erweiterungen des Rasters, Kern-Typen, restliche Linien und Karten, Kern-Fähigkeiten, Talente, Statuseffekte komplett, Materialien/Rüstungsmatrix, Zeitstopp-Regie in Pixelart, Explosion, UI-Skin, Audio.
**P2:** Welt-Launen, Chaos-Karten, Baustile, Biom-Wechsel, Kommentator, Statik-Kollaps, Online-Modus.

### 13.2 Meilensteine

| # | Meilenstein | Ergebnis („Definition of Done“) |
|---|---|---|
| **M0** | Entscheidungen & Daten | Offene Fragen Q1–Q8 beantwortet; Kataloge als JSON/YAML exportiert; Tuning-Tabelle als Datei. |
| **M1** | Kampf-Greybox | 1D-Feld und Bastion-Raster mit Platzhalterquadraten; Einheiten spawnen, laufen, kämpfen; eine **komplette Bot-gegen-Bot-Partie** läuft bis zum Sieg und ist als Replay abspielbar. |
| **M2** | Bastion-Builder | Drag & Drop auf dem Raster mit Tags, Nachbarschaft, Validierung und Hand. Ein Mensch kann eine Bastion bauen. |
| **M3** | Karten-Loop & Zeitstopp | Loadout, Ziehen 5/3, Kontingent, Pausenablauf mit einfacher Kamerafahrt. Eine **komplette Partie ist spielbar** (Mensch vs. Bot). |
| **M4** | Rollen vertiefen | Rückzug/Heilung, Personal, Eroberung, XP/Ränge laufen vollständig; erster Balance-Pass mit Bot-Sims. |
| **M5** | Vertical Slice (Art) | 1 Baustil, 10 voll animierte Einheiten, Dither-Zeitstopp, Kern-Explosion, UI-Skin; ein 3-minütiges Video, das schon „nach dem Spiel“ aussieht. |
| **M6** | Content-Welle 1 | Alle P0- und P1-Karten, Kerne, Rasterweiterungen; Balance-Pass 2. |
| **M7** | Content-Welle 2 & Polish | Restliche Karten, Welt-Launen, Audio, Menüs, Barrierefreiheit. |
| **M8** | Mehrspieler | Lokal (Split) und, falls gewünscht, Online. |

### 13.3 Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| **Zu viele Systeme gleichzeitig** (Personal, Linien, Exposition, Rückzug, XP, Eroberung) | MVP-Scope, jedes System per Feature-Flag zuschaltbar, im Bot-Sim einzeln testbar. |
| **Autobattler wirkt passiv** | Kern-Fähigkeit, Zielprioritäten, Wachzonen, Kamera-Fokus, Pause als Spielhöhepunkt. |
| **XP-Snowball** | Zeit-XP-Deckel (nur bis Rang 2), Rangdifferenz-Bonus, Todesmut ohne Heilung, Wahnsinn. |
| **Unlesbares Chaos** | Silhouettenregeln, Statusicons, Einheitenlimit 40, Fokus-Highlight, Ereignisfeed. |
| **Wegfindung in der Bastion** | Graph statt Navmesh, früh prototypen, Debug-Overlay. |
| **Pixel-Art-Aufwand (150+ Karten)** | Platzhalter zuerst, Vertical Slice, Recolor-Basen für verwandte Einheiten, Tier IV zuletzt. |
| **Zeitstopp-Übergang ruckelt** | Sim und Darstellung trennen, Nearest-Neighbor, pixelgenau in Ruhe. |
| **Unfairer Zufall** | Garantien, 5/3-Auswahl, Tier-Gating, „Bekannte Gesichter“, symmetrische Basis. |
| **Online-Determinismus** | Deterministische Sim von Anfang an, Replays als Dauertest. |
| **Katalog-Wildwuchs** | Karten in Wellen, jede braucht Rolle, Witz und Silhouette (Designsäule 5). |

---

## 14. Offene Fragen ❓

Jede Frage hat meinen **Default**, mit dem ich weiterarbeite, falls du nichts anderes sagst.

| # | Frage | Default |
|---|---|---|
| **Q1** | Plattform und Modus: Browser, lokal 1v1 + Bot zuerst, Online später? | **Ja.** |
| **Q2** | Perspektive: Querschnitt-Seitenansicht (aufgeschnittenes Puppenhaus) statt Draufsicht? | **Querschnitt.** |
| **Q3** | Echtzeit-Eingriffe in der Schlacht: nur die Kern-Fähigkeit? Oder komplett passiv? | **Nur Kern-Fähigkeit** (P1). |
| **Q4** | Ziehregel: 5 ziehen / 3 behalten (Draft-Gefühl) oder rein zufällig? | **5/3.** |
| **Q5** | Eroberungs-Ende anders als Explosion (Palette-Swap statt Knall)? | **Ja.** |
| **Q6** | Matchlänge 10–16 min? | **Ja.** |
| **Q7** | Tech-Stack: TypeScript + PixiJS/Phaser, oder lieber Godot/Unity? | **TS + PixiJS.** |
| **Q8** | Woher kommt die Pixelgrafik: eigene Hand, Asset-Pack, KI-Hilfe? Prototyp mit Platzhaltern? | **Platzhalter zuerst**, Art-Pipeline ab M5. |
| **Q9** | Sprache: Deutsch zuerst, aber i18n-fähig? | **Ja.** |
| **Q10** | Fraktionen (feste Asymmetrie) oder Kerne als Asymmetrie? | **Kerne.** |
| **Q11** | Welt-Launen und Chaos-Karten: später dazu oder streichen? | **Später (P2).** |
| **Q12** | Statik-Kollaps als optionale Zerstörungsmechanik? | **Später entscheiden (P2).** |
| **Q13** | Eigenes Repository für das Spiel? | **Ja.** |
| **Q14** | Name „Bastion Blasters“: Marken-/Namensprüfung? | **Offen** (ich habe nichts geprüft). |

---

## 15. Glossar

| Begriff | Bedeutung |
|---|---|
| **Abstempeln** | Neue Bauteile werden nach der Pause aus der Blaupause in echte Gebäude verwandelt. |
| **Alarm** | Zustand, wenn Eindringlinge in der Bastion sind; verdoppelt die Leine der Verteidiger. |
| **Artillerie** | Truppen auf Geschützplätzen, die die gegnerische Bastion beschießen. |
| **Bastion** | Die Festung eines Spielers (Querschnitt-Raster mit Kern). |
| **Behandlungsplatz** | Platz in einer Heilquelle, den ein verwundeter Sturmtrupp belegt. |
| **Beute** | Gebäude, die Plünderer ablenken (Schatztruhe, Wunschbrunnen, Trophäenhalle). |
| **Blaupause** | Darstellung eines neu gelegten Bauteils während der Pause. |
| **Bresche** | Zerstörte Außenzelle, die als zusätzlicher Eingang dient. |
| **Bürger** | Standard-Zivilisten ohne Karte, die Posten besetzen. |
| **Doktrin** | Zielverhalten einer Sturmtruppe (Jäger, Brecher, Eroberer, Plünderer, Sprenger). |
| **Eindringling** | Feindliche Sturmtruppe innerhalb der Bastion. |
| **Eroberung** | Sieg durch Besetzen der Kernkammer (Leiste 100 %). |
| **Exposition** | Eigenschaft einer Zelle, von einer Flugbahn getroffen werden zu können. |
| **Geschützplatz (GP)** | Platz auf einer Plattform, den Artillerie benötigt. |
| **Heilquelle** | Alles, was für die Rückzugsregel zählt (Heilgebäude, Heiler, Aura-Heilung). |
| **Kern** | Zentrum der Bastion; fällt er, wird der Besitzer besiegt. |
| **Kernkammer** | 2 × 2 Raum um den Kern; Ort der Eroberung. |
| **Kontingent** | Armee-Leiste aus Truppen-Karten (5–8 Plätze). |
| **Linie** | Truppen-Gruppe, die ein Freischalt-Raum freigibt (Waffen, Arkan, Tier, …). |
| **Nachschub (N)** | Wie viele Einheiten einer Karte pro Welle nachgeliefert werden. |
| **Niemandsland** | Streifen zwischen den Bastionen. |
| **Panikraum** | Raum, in dem Zivilisten unangreifbar sind. |
| **Posten** | Arbeitsplatz in einem Raum, der Personal braucht. |
| **Rang** | Erfahrungsstufe R0–R5 einer Einheit. |
| **Rückzug** | Verhalten einer Sturmtruppe unter 50 % HP, wenn eine Heilquelle existiert. |
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
| `DRAW_COUNT` / `KEEP_COUNT` | Ziehen / Behalten | 5 / 3 | 4–6 / 2–4 |
| `HAND_LIMIT` | Handkarten | 10 | 8–12 |
| `REROLLS` | Rerolls je Pause | 1 | 0–2 |
| `LOADOUT_BAU` / `LOADOUT_TRUPPE` | Startkarten | 8 / 6 | – |
| `KNOWN_FACES_PCT` | Anteil Kopien bekannter Karten beim Ziehen | 20 % | 10–30 % |
| `KONTINGENT_START` / `_MAX` | Truppenplätze | 5 / 8 | – |
| `GRID_START` / `GRID_MAX` | Raster | 6×4 / 8×6 | – |
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
  trajectory: bogen          # flach | bogen | senkrecht | durchschlag | tunnel | streu | luft
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
  placement: []              # z. B. [dach], [aussen], [boden], [keller], [front]
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
