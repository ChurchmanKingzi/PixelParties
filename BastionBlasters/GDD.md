# Bastion Blasters — Game Design Document

**Teil 1: Spieldesign** · Version 1.0 · Entwurf zur Abnahme · Perspektive: **Draufsicht** · Kerne = **Fraktionen** · Bastionen **modular**, große Karte

Teil 2 (Präsentation, Technik, Roadmap, offene Fragen): [`GDD-Praesentation-Technik.md`](GDD-Praesentation-Technik.md)
Kataloge: [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) · [`katalog/02-einheiten.md`](katalog/02-einheiten.md) · [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md)

---

## 0. Lesehilfe

| Zeichen | Bedeutung |
|---|---|
| 🟦 | **Aus deinem Konzept.** Kernvorgabe, wird nur nach Rücksprache geändert. |
| 🟨 | **Meine Ergänzung / mein Vorschlag.** Fehlt im Konzept, hält aber die Regeln zusammen oder macht sie tiefer. Jederzeit streichbar. |
| ❓ | **Offene Entscheidung**, mit Default-Empfehlung in Teil 2, §14. |
| ⚙ | **Tuning-Wert.** Startwert zum Ausprobieren, keine Wahrheit. Alle Werte stehen gesammelt in Teil 2, Anhang A. |
| P0 / P1 / P2 | Priorität: **P0** = muss in den ersten Prototyp, **P1** = Vertical Slice, **P2** = später. |

**Sprachregel (v0.5):** Das **Spiel ist englisch**: Kartennamen, Regeltexte, Schlüsselwörter und UI. Es gilt die strenge Nomenklatur in [`NOMENCLATURE.md`](NOMENCLATURE.md) (erzeugt aus `daten/keywords.json`). Diese Design-Dokumente bleiben deutsch und nennen den deutschen Designbegriff; die Zuordnung zum englischen Spielbegriff steht in der Nomenklatur (Spalte „Design term (DE)“) und im Katalog (Spalte „Name (EN)“). „Festung“ und „Bastion“ meinen dasselbe; im Spiel heißt sie **Bastion**.

---

## 1. Vision

### 1.1 Pitch 🟦

> Zwei Bastionen stehen sich gegenüber, von schräg oben betrachtet und ohne Dächer, wie Modelle auf einem Spieltisch: Man sieht jeden Raum, jeden Zivilisten, jeden Pilz im Innenhof. Du hast sie aus zufällig gezogenen Bauteilen zusammengesetzt – Türme, Krankenstationen, Werkstätten, Kasernen und ein paar Dinge, die niemand erklären kann. Im Zentrum pocht der **Kern**. Fällt er, explodiert deine Bastion.
> Dazu hast du eine Armee aus Katapulten, feuerballwerfenden Magiern, rutschenden Eisbären, Skeletten in Kochtöpfen, Troll-Türstehern und Zivilisten, die Suppe kochen, Mauern flicken und Verwundete heilen. Alle Truppen wachsen nach. Wer überlebt, wird stärker. Alle zwei Wellen hält die Zeit an, ihr zieht neue Karten, baut um und aus – und die Schlacht geht nahtlos weiter.

### 1.2 Designsäulen 🟨

1. **Lesbares Chaos.** Wild darf alles sein, nachvollziehbar muss es bleiben: Geschoss fliegt → Zelle zerbricht → Raum geht aus → Zivilisten rennen. Jede Wirkung hat eine sichtbare Ursache.
2. **Bauen ist Taktik.** Die Bastion ist Rüstung, Waffe und Wirtschaft zugleich. Wo ein Raum steht, entscheidet über Leben und Tod.
3. **Veteranen-Fantasie.** Rückzug, Heilung und Wiederkehr werden belohnt. Einheiten sammeln Ränge, Titel und Narben; man hängt an ihnen.
4. **Fließende Rhythmen.** Kampf → Zeitstopp → Ausbau → Kampf, ohne harte Schnitte. Der Zeitstopp ist Teil der Inszenierung, kein Menü.
5. **Whacky mit System.** Jede Karte hat einen Witz *und* eine klare Spielrolle. Albern aussehen darf sie; unklar funktionieren nicht.

### 1.3 Was das Spiel besonders macht 🟨

- **Zwei Siegwege erzwingen Vorbereitung auf beides.** Zerstörung (Artillerie bricht den Kern auf) gegen Eroberung (Sturmtruppen besetzen die Kernkammer). Verteidiger helfen *nur* gegen Eroberung, Mauern und Reparatur *nur* gegen Zerstörung.
- **Die Bastion ist ein lebender Grundriss.** Zerstörte Zellen werden zu Breschen und öffnen neue Wege; mit Modulen, Höfen und Mauern baut man Grundrisse mit Gängen, Vorhöfen und Sackgassen, die Eindringlinge in Fallen und Verteidiger treiben. Ausgeschaltete Räume erkennt man sofort (Spinnweben, kein Licht, Personal weg).
- **XP + Rückzug als Kernschleife.** Wer sein Heil-Netz schützt und seine Truppen rotiert, bekommt Elite-Einheiten. Wer es zerstört, zwingt den Gegner in Todesmut-Selbstmordangriffe.
- **Wellenpause als Draft-Moment.** Kein Menü-Tabu: Man sieht die eingefrorene Schlacht, während man die nächste Karte legt.

### 1.4 Rahmen (Annahmen) ❓

| Punkt | Annahme (Default) |
|---|---|
| Spieler | 2. Die Regeln sind für beide gleich; Asymmetrie entsteht über den gewählten **Fraktions-Kern** (§9.1) und die gezogenen Karten. |
| Perspektive | **Schräge Draufsicht** (3/4-Ansicht wie in 16-Bit-Rollenspielen), Dächer abgenommen; Regeln für die Darstellung in §4.1. ✔ entschieden |
| Kartengröße | **56 × 28 Zellen** (1792 × 896 px) in 1920 × 1080 internem Bild; je Spieler ein **Baugrund 16 × 16**, dazwischen **20 Zellen** Niemandsland, dazu Randwald, Teiche, Wege (Teil 2 §10.1). Längere Laufwege, mehr Reichweitenspielraum, Platz zum Anbauen. ✔ entschieden (v0.3) |
| Kunststil | **16-Bit-Pixelart**, komplett von Claude erstellt (Teil 2 §10.1). ✔ entschieden |
| Steuerung | Maus (Drag & Drop für Karten). Während der Schlacht gibt es **keine** Befehle außer der Kern-Fähigkeit 🟨. |
| Plattform | Browser/Desktop, 16:9. |
| Modi (Reihenfolge) | 1) Lokal 1v1 (geteilter Bildschirm mit Split beim Aufbau), 2) Gegen CPU, 3) Online (P2). |
| Matchlänge | Ziel **10–16 Minuten**. ⚙ |

---

## 2. Welt & Ton 🟦/🟨

**Schlamassia** 🟨: eine Welt, in der „der Himmel mal kaputtging“ und seitdem Zaubersprüche, Käsemonde und Frösche ohne erkennbare Ordnung herabregnen. Reiche gibt es nicht, nur Bauherren mit Kernen. Wer den größeren Kern hat, hat recht; wer den kleineren hat, hat eine Explosion.

**Tonregeln (für alle Karten, Texte, Animationen):**
- **Nichts ist Standard-Mittelalter.** Ritter nur, wenn sie einen Topf als Helm tragen. Lieber Skelett in Kochtopf, Eisbär auf dem Bauch, Kanone, die Goblins schießt.
- **Jede Karte bekommt einen Witz** (Look, Name oder Flavor-Zeile) **und eine unverwechselbare Silhouette.**
- **Der Ton ist trocken-albern**, nie zynisch: Die Welt ist absurd, aber niemand in ihr weiß es.
- **Gewalt ist comichaft.** Kein Blut; Zivilisten, die „getötet“ werden, zerplatzen in Konfetti und einen Hut.
- **Teamfarben sind getrennt von Fraktionen:** Die Fraktion ist der Kern (§9.1), die Teamfarbe nur die Markierung (P1 = Karminrot/Gold, P2 = Türkis/Violett). Alle Banner, Zierleisten, Umhänge und Lichter nehmen die Teamfarbe an (Palette-Swap, siehe Teil 2 §10.1).

**Schauplätze (Biome des Niemandslands)** 🟨 P2: Pilzmoor · Zuckerwatte-Wüste · Schwebende Steine · Kuchenlava-Ebene · Verkehrter Wasserfall-Canyon. Das Biom bestimmt Hintergrund, Bodenfarbe und optional die Welt-Laune (§9.2).

---

## 3. Spielablauf

### 3.1 Überblick 🟦

```
┌────────────────┐   ┌──────────────────┐   ┌─────────────────────────────────────────────┐   ┌────────────────┐
│ 0  Kern wählen │ → │ 1  Erstaufbau    │ → │ 2  KAMPFZYKLUS (wiederholt sich)            │ → │ 3  Finale      │
│    + Loadout   │   │    Bastion-Screen│   │  Welle A ─ 40 s ─ Welle B ─▶ ZEITSTOPP      │   │  Explosion     │
│    ziehen      │   │    120 s, geheim │   │  ─▶ Ausbau-Pause (25 s) ─▶ nahtlos weiter   │   │  oder Eroberung│
└────────────────┘   └──────────────────┘   └─────────────────────────────────────────────┘   └────────────────┘
```

### 3.2 Phase 0 — Kern & Loadout

1. **Kern wählen** 🟨 (P1): Jeder Spieler wählt verdeckt und gleichzeitig einen von 12 **Fraktions-Kernen** (Katalog 03); Spiegelmatch erlaubt. Der Kern bestimmt Passive, aktive Fähigkeit, Linien-Affinitäten und bringt einen kostenlosen **Kern-Anbau** mit (§9.1). Bis dahin (P0): ein Standardkern.
2. **Loadout ziehen** 🟦: Jeder Spieler zieht **10 Karten** (gemischt aus Bau- und Truppen-Karten; Tier-Gewichte §5.2, Linien-Gewichte vom Kern) und **behält 7**. ✔ entschieden
   - **Garantien** 🟨 *unter den 10 gezogenen Karten*: mindestens 3 Bau-Karten, 1 Heilquelle, 1 Plattform und 1 Truppe je Kategorie (Artillerie, Sturm, Verteidiger, Zivilist). Jede gezogene Truppen-Karte ist **spielbar**: Sie gehört zur Linie *Basis*, zu den Linien des Kerns oder zu einem Freischalt-Raum, der ebenfalls unter den 10 Karten liegt.
   - **Mulligan** 🟨: einmal alle 10 neu ziehen.
3. **Kostenlose Grundausstattung:** Kernhof 6 × 6 mit Kern, Kern-Anbau, Haupttor, 4 Bürger (§4.6). Mauerwerk setzt sich **automatisch** an jede Außen- und Modulkante (§4.1).

### 3.3 Phase 1 — Erstaufbau 🟦

Beide Spieler arbeiten **gleichzeitig und verdeckt** (Fog: man sieht die gegnerische Bastion erst, wenn der Kampf beginnt) in ihrem **Bastion-Screen**:
- Bau-Karten per Drag & Drop an die Bastion **anlegen** (Baugrund-Raster, §4.1), mit **R** oder Rechtsklick drehen.
- **Fundament (v0.9):** Zusätzlich zur Hand erhält jeder Spieler **12 kostenlose Bau-Karten** (⚙ 7 Räume, 2 Fallen, 2 Türme, 1 frei; Tier I–II, keine Doppelten): genug Material für ein echtes **Labyrinth** zwischen Tor und Kern. Unverbaute Fundament-Karten verfallen mit dem Kampfbeginn.
- Truppen-Karten ins **Kontingent** legen (5 Plätze, §5.6). Für jede Verteidiger-Karte eine Wachzone wählen; für jede Artillerie-Karte eine Zielpriorität (§5.7).
- Timer ⚙ **120 s**; „Bereit“ beendet vorzeitig. Wer fertig ist, sieht nur ein „✔ Bereit“ beim Gegner.
- Beim Start des Kampfes folgt die **Enthüllung**: Die Kamera zieht auf die Weitaufnahme, beide Bastionen werden mit Hammerschlag-Welle „abgestempelt“ (Teil 2 §10.3).

### 3.4 Phase 2 — Kampfzyklus 🟦

- **Welle 1** spawnt sofort beim Kampfbeginn, jede weitere nach ⚙ **40 s**. Nach der letzten Welle des Abschnitts folgt der **Zeitstopp**.
- **Die Abschnitte werden länger (v0.9):** Vor dem ersten Zeitstopp laufen ⚙ **2 Wellen**, vor dem zweiten 3, dann 4, 5, 6 … (`SEGMENT_WAVES_BASE` = 2, `_STEP` = +1 je Zeitstopp, max. 9). Die Zeit zwischen den Zeitstopps wächst also von rund 40 s auf mehrere Minuten, die Armeen wachsen mit (§5.6).
- Nach der Pause spawnt die nächste Welle **sofort** (damit neue Truppen direkt eingreifen).
- Bei 40 s Wellenabstand rechnen wir mit rund **5–7 Zeitstopps** pro Partie (Prototyp: Wahnsinn ab 11:00, Himmelsriss ab 16:00).
- **Während der Schlacht** läuft alles automatisch (Autobattler): Artillerie schießt, Sturmtruppen stürmen, Verteidiger wehren ab, Zivilisten tun Nützliches. Der einzige direkte Eingriff ist die **Kern-Fähigkeit** 🟨 (§9.1).

### 3.5 Der Zeitstopp (Pause) 🟦

Ablauf in Kurzform (Regieplan mit Timeline: Teil 2 §10.3):

| Schritt | Inhalt | ca. Dauer |
|---|---|---|
| 1 | **Einfrieren:** Alles hält mitten in der Bewegung an (Geschosse, Funken, Sprites). | 0,7 s |
| 2 | **Eintauchen:** Die Kamera gleitet in die eigene Bastion (Weltansicht bleibt als eingefrorenes Diorama im Hintergrund sichtbar). | 0,8 s |
| 3 | **Ziehen:** Eine **komplett frische Hand**: 5 Karten werden aufgedeckt, 3 davon behält man (§5.5). | 1,5 s |
| 4 | **Bauen:** Die 3 behaltenen Karten spielen (was ungespielt bleibt, verfällt), Befehle anpassen, 1 Bauteil umziehen (§4.10). Timer ⚙ **25 s**. | 25 s |
| 5 | **Bereit:** Beide bereit oder Timer abgelaufen → Karten klappen weg. | 0,5 s |
| 6 | **Auftauen:** Kamera zurück zur Weitaufnahme, der Frost löst sich von der Mitte nach außen (Dither-Ring), alle Einheiten laufen exakt dort weiter, wo sie standen. | 0,8 s |

Der Spielzustand (Positionen, Cooldowns, Geschosse, Status, XP) bleibt **vollständig erhalten**; nur die Eingaben der Spieler ändern ihn.

**Neue Bauteile** 🟨 erscheinen in der Pause als **Blaupause** (blaue Umrisse, Schraffur-Dither). Beim Auftauen werden sie „abgestempelt“ und sind danach **3 s im Bau** (halbe HP, keine Wirkung), bevor sie aktiv werden. Der Gegner sieht neue Bauteile erst beim Abstempeln.

### 3.6 Siegbedingungen 🟦

Es gewinnt, wer zuerst **eine** der beiden Bedingungen erfüllt:

| Weg | Bedingung | Finale |
|---|---|---|
| **Zerstörung** | Kern-HP des Gegners → 0 (nur durch Artillerie und Chaos-Effekte, §7.7). | Dramatische Kern-Explosion, die gesamte Bastion fliegt auseinander (Teil 2 §10.4). |
| **Eroberung** | Die Eroberungsleiste der gegnerischen Kernkammer erreicht 100 % (§7.6). | Banner wird gehisst, die Bastion wechselt per Palette-Swap die Teamfarbe, Konfetti statt Explosion. |

**Gleichzeitiger Sieg** 🟨: Fallen beide Kerne innerhalb von 1 s, ist das ein **Doppel-K.O.** (Unentschieden, doppeltes Feuerwerk, Revanche-Button).

### 3.7 Der Wahnsinn (Anti-Patt) 🟨 P1

Ab ⚙ **11:00** (v0.9, vorher 14:00) beginnt der **Wahnsinn**: Alle 30 s steigen Artillerieschaden +10 %, Eroberungstempo +10 % und Welt-Launen-Ausbrüche werden häufiger. Bei ⚙ **16:00** (vorher 20:00) zerreißt der „Himmelsriss“, beide Kerne verlieren 1 % Max-HP pro Sekunde; wer unter mehr Eroberungsdruck steht, verliert schneller (kein Remis bei gleichem Stand). Garantiert ein Ende.

### 3.8 Beispielpartie (zum Mitdenken) 🟨

- **0:00** Spieler A wählt das **Rudelherz** (Tier/Waffen), Spieler B das **Frostherz** (Frost/Tier). Beide ziehen 10 Karten und behalten 7. A behält Zinnenkranz, Krankenstation, Pfeilturm, Rumpel-Katapult, Topfhelm-Skelett, Reitgans-Goblin und Bratpfannen-Büttel. Das Katapult kommt auf den Zinnenkranz, den A hinten an den Kernhof anbaut (hinter der eigenen Mauer), die Krankenstation (3 × 2) direkt neben das Tor, der Pfeilturm flankiert als Torturm das Haupttor. Seine Menagerie (Kern-Anbau) steht schon.
- **0:10** B baut auf Frost: Rutsch-Bär, Eiszapfen-Mörser, Gloop-Turm, die Eisgrotte (Kern-Anbau) ist schon da. Mit seiner Hof-Erweiterung zieht er einen schmalen Gang mit zwei Knicks vor die Kernkammer, sodass Eindringlinge lange an seinem Gloop-Turm vorbeilaufen.
- **0:20** Welle 1: Skelette und Goblins laufen los. As Goblins stürzen sich auf Bs Bürger, Bs Gloop-Turm trifft einen Goblin, der mit 40 % HP zur eigenen Krankenstation zurückläuft und geheilt als Gefreiter wiederkommt.
- **1:00** Welle 2 ist gespawnt, **Zeitstopp:** Die Schlacht gefriert. A bekommt eine frische Hand: Löschteich, Zahnklempner, Sternwarte, Arkanum, Wunschbrunnen. Er behält Sternwarte, Zahnklempner und Wunschbrunnen und legt alle drei sofort; Löschteich und Arkanum wandern zurück in den Pool.
- **… 6:30** Bs Rutsch-Bären haben Rang 3, As Krankenstation ist zerstört. Seine verletzten Skelette kämpfen jetzt bis zum Tod. A baut in der Pause ein Feldlazarett, das ab Welle 11 wirkt.
- **9:10** Bs Mörser zielen seit Minute 7 auf die Kernkammer, Reparatur und Schildkuppel halten nicht mehr mit. A löst seine Kern-Fähigkeit aus. Es reicht nicht. **Explosion.**

---

## 4. Die Bastion

### 4.1 Baugrund, Raster & Module 🟦/🟨 (v0.3: modular erweiterbar)

Die Bastion ist **keine feste Form**, sondern ein **Grundriss auf einem Zellenraster** (**1 Zelle = 32 × 32 px**), der aus **Modulen** wächst: Hofzellen, Räumen, Türmen. Jede Bastion bekommt dadurch ihre eigene Silhouette (L, T, U, mit Vorhof, Gang oder Innenhof).

**Darstellung (verbindlich für Grafik und Regeln)** 🟨 ✔ entschieden nach der Stilprobe

- **Boden:** reine Draufsicht auf dem 32-px-Raster.
- **Hohe Dinge** (Mauern, Türme, Kern) stehen mit ihrem **Fußabdruck** auf dem Raster und werden als **Südansicht** nach oben gezeichnet (Bildhöhe = Bauhöhe). Sichtbar ist immer nur die **Südseite**: Ein Objekt verdeckt den Boden *nördlich* von sich, nie südlich.
- Folge: Die **Nordwand** eines Raums zeigt ihre Innenseite (Fenster, Banner, Kamin) und ist hoch (22 px). Die **Südwand** ist niedrig (10 px, wie ein aufgeschnittenes Modell), damit man in jeden Raum sieht. **Seitenwände** sind dünne Kanten (20 px), neben Seitentoren niedrig (10 px). Türme sind rund, 66 px hoch.
- **Wände sind dünn (8 px)** und stehen **auf den Kanten** zwischen Zellen, nicht in Zellen. Alles Innere bleibt nutzbar, und jede Zelle hat vier Kanten, die Wand, Tür oder Tor sein können.

```
   Beispiel P1 (16 × 12 Zellen Ausschnitt, y von oben):      h Hof · C Kern · T Turm
                                                             K Krankenstation · S Schmiede
   . . . . . . . . . . . . . . . .                           W Wohnhaus · B Kaserne
   . . . . . . K K K S S S . . . .                           Z Zinnenplattform (Geschützplätze)
   . . . . . . K K K S S S . . . .                           Kanten zwischen verschiedenen Modulen
   . . . h h h h h h h h h . . . .                           und zum Draußen = Mauer (automatisch).
   . . . h h h h h h h h h T . . .                           Tor (13,5,Ost): offener Durchlass
   . . . W W W h h C C h h h h . .                           zwischen den Türmen (12,4) und (12,7).
   . . . W W W h h C C h h h h . .
   . . . h h h h h h h h h T . . .
   . . . h h h h h h h h h . . . .
   . . . . . . Z Z Z B B B . . . .
   . . . . . . Z Z Z B B B . . . .
```

**Baugrund und Start**
- Jeder Spieler hat einen **Baugrund von 16 × 16 Zellen** (⚙ `GRID_PLOT`), P1 links, P2 rechts (gespiegelt). Dazwischen liegen **20 Zellen Niemandsland** (⚙ `FIELD_GAP_CELLS`). Was nicht bebaut ist, bleibt Wiese; im Baumodus erscheint der Baugrund als Raster.
- **Start:** **Kernhof 6 × 6** (Hof, begehbar) mit dem **Kern (2 × 2)** in der Mitte, ein **Zufahrtsgang** (1 Zelle breit, 8 Zellen lang) vom Kernhof nach vorn bis zum **Haupttor** in der Frontkante und der **Kern-Anbau** des gewählten Fraktions-Kerns (§9.1) als erstes Raum-Modul (3 × 2) an einer Außenkante des Hofs. **32 Hofzellen** sind frei (36 − 4 Kern).
- Der Kernhof liegt **hinten** im Baugrund (vertikal mittig), nicht an der Front: Zwischen Tor und Kern liegen ≈ 8 Zellen eigener Boden, an den Seiten je ≈ 5 Zellen. Wer ins Tor läuft oder aufs Tor schießt, trifft zuerst Gang, Türme und Räume, nie den Kern. Dort entstehen Labyrinthe, Engstellen und Kampfzonen (*v0.8, Rückmeldung aus dem ersten Spieltest: der Kern an der Front war nicht zu schützen*).

**Module** 🟦/🟨
- **Raum-Module** belegen **zusammenhängende Zellen**, mindestens **2 Zellen tief** (Möbel, Personal und Tür brauchen Platz). Größen: **2 × 2**, **3 × 2**, **3 × 3**, selten 4 × 2 oder 4 × 3 (Katalog 01). Drehbar (**R**, 90°-Schritte).
- **Anlegen:** Ein Modul muss mit mindestens **einer Kante** an Hof, Kernhof oder ein **angeschlossenes** Modul grenzen („zusammenhängend“) und im eigenen Baugrund liegen. Räume dürfen also an **Räume** anbauen (Raumketten, Labyrinthe), nicht nur an den Hof. Kein Modul darf in die Mitte eines anderen ragen. Ein Raum, der nur an Türme, den Kern oder abgeschlossene Räume grenzt, hätte keine Tür und ist nicht platzierbar.
- **Tür:** Jedes Modul erhält automatisch eine **Tür** (14 px) in der Mitte der ersten Kante zum Hof (Reihenfolge Süd, Ost, West, Nord), sonst zu einem schon angeschlossenen Nachbarraum; im Editor per Klick auf eine andere Kante verlegbar 🟨. Module sind untereinander über Hof und Türen verbunden. Ein Raum, an dem andere Räume hängen, lässt sich beim Umbau erst aufnehmen, wenn diese weg sind. **Alle Einheiten passen durch jede Tür**, auch Bären und Katapulte ✔; die 14 px sind nur Optik, im Spiel zählt die Kante als offen.
- **Hof-Bauteile** 🟦/🟨 ✔ entschieden: Bauteile dürfen auch **auf Hofzellen statt in Räumen** stehen. **Welche Karte welche Bauart hat, ist je Bauteil einzeln festgelegt** (Katalog 01, Spalte „Größe“: Raum, Hof, Turm, Wand, Tor), nicht nach Größe. Ein Hof-Bauteil belegt 1 × 1 bis 3 × 2 Hofzellen, hat **keine eigenen Wände und keine Tür**. Folgen:
  - **Leichter zugänglich:** Es liegt im Laufweg; Eindringlinge laufen direkt hin, Einheiten benutzen es ohne Tür, und Splash trifft es ohne Wandschutz.
  - **Leichter zerstörbar:** Die HP der Hof-Karten sind dafür niedrig angesetzt (≈ −30 % gegenüber Räumen derselben Stufe, je Karte einzeln).
  - **Ausnahme Innenhof:** Hofzellen, die man **nur durch Türen von Modulen** erreicht (ringsum von Modulen und Mauern umschlossen), sind vom Tor und von Breschen aus nicht direkt zugänglich. Dort gelten Hof-Bauteile als **geschützt** (kein Zugänglichkeitsmalus; die niedrigen HP bleiben). Hofzellen, die man ohne Tür vom Tor oder einer Bresche erreicht, heißen **Außenhof**.
  - Typische Hof-Bauteile: Fallen (Stachelflur, Fallgrube), Zelte und Gärten (Feldlazarett, Heilpilz-Garten), Brunnen, Drillplatz, Glocken, Rutschbahn, Lafetten. Typische Räume: alles, was Personal und Schutz braucht (Krankenstation, Schmiede, Kaserne, Wohnhaus).
- **Hof-Erweiterung** 🟨: Im Erstaufbau darf jeder Spieler **kostenlos bis zu 16**, zu jedem Zeitstopp **bis zu 6 zusammenhängende Hofzellen** anlegen (⚙ `HOF_START` / `HOF_PER_PAUSE`), z. B. Gänge, Vorhöfe, Innenhöfe, Zickzackwege. Hofzellen sind begehbar, ohne Funktion; **Hof ↔ Hof hat keine Wand**.
- **Turmzellen:** **Türme** (1 × 1) stehen auf einer Zelle an der Außenkante oder in einer Ecke (oder frei im Hof). Sie sind **massive Zellen**: Einheiten laufen nicht durch, und sie werden nicht von Wänden umschlossen. Sie überragen die Mauer.
- **Geschützplätze:** Plattform-Module (Z) haben ihre Geschützplätze innerhalb der Fläche; sie stehen **tiefer** (Brüstung 10 px), damit Geschütze über den Rand feuern können.

**Mauern und Tore**
- **Mauerwerk automatisch:** An jeder Kante, die zwischen **Zelle und Draußen** oder zwischen **zwei verschiedenen Modulen** liegt, steht ein **Mauersegment** (⚙ 300 HP, 32 px lang, Material Stein, kostenlos, BS-01). Mauern folgen dem Grundriss; Ein- und Ausbuchtungen sind erlaubt.
- **Wandkarten** (BS-Linie): **verbessern bis zu 4 zusammenhängende Segmente** (z. B. Puddingwand, Panzermauer) oder legen **Zinnen/Fallgatter** darauf. Welche Segmente, bestimmt man im Editor durch Anklicken von Kanten.
- **Haupttor:** Durchlass in der Frontkante des Kernhofs (offen für Freunde, für Feinde gesperrt, ⚙ 500 HP). Weitere **Tor-Karten** setzen Tore auf beliebige Außenkanten. **Seitentore (Ost/West)** sind offene Durchlässe mit Holzschwelle (zwischen zwei Torwehren), **Nord/Süd-Tore** zeigen Flügeltüren mit Eisenbändern.
- **Hinweis zur Perspektive:** Wegen der Südansicht verdeckt eine Seitenwand ihre Öffnung, wenn die Öffnung schmaler als die Wandhöhe ist. Deshalb sind Seitentore ein *voller* Zellendurchlass (32 px) und die Wand daneben niedrig.

**Tags (Platzierung)** 🟨: **[Außen]** Modul berührt mindestens eine Außenkante · **[Innen]** Modul ist komplett von Hof/Modulen umgeben · **[Front]** hat Außenkante zur Seite des Gegners · **[Ecke]** liegt an einer vorspringenden Ecke der Silhouette. **Ecktürme** überblicken zwei Seiten (+1 Reichweite, +10 % HP).

- **Labyrinthe und Fallen** 🟨: Mit Hof-Erweiterungen lassen sich Wege verlängern und Eindringlinge an Fallen, Türmen und Verteidigern vorbeiführen. Gegenspieler: Wege sind nicht heilig (Eindringlinge brechen das schwächste Hindernis), und eigenes Personal und Heiler müssen ihre Posten erreichen.
- **Niemandsland:** Zwischen den Baugründen liegt ein **2D-Feld** mit Wegen, Teichen, Wald und Pilzen (Teil 2 §10.1). Einheiten laufen frei in 2D (weiche Abstoßung gegen Gedränge), nicht auf einer Linie; Wege sind nur **optisch** (⚙ im Prototyp ohne Tempoeffekt), Teiche sind Hindernisse. Flanken und Umwege sind möglich.
- **Spieler 2** ist gespiegelt. Der Bastion-Screen zeigt immer die **Weltansicht**, damit Orientierung in Schlacht und Aufbau gleich bleibt (Kamera zoomt auf den eigenen Baugrund).
- **Weltmaße:** 56 × 28 Zellen = 1792 × 896 px innerhalb eines 1920 × 1080-Bildes (Rest für HUD). Baugrund-Abstand 20 Zellen: P1-Front bei x = 18, P2-Front bei x = 38.

### 4.2 Bauteil-Arten 🟦/🟨

| Art | Eigenschaft | Beispiele |
|---|---|---|
| **Raum** | Begehbar. Einheiten laufen durch und arbeiten darin. Hat meist eine Funktion. | Krankenstation, Schmiede, Kaserne, Kernkammer |
| **Mauer** | **Kantensegment** (8 px dünn, 32 px lang), nicht begehbar. Blockiert Wege und Schusslinien, absorbiert Beschuss. Mauerwerk entsteht automatisch (§4.1), Karten verbessern bis zu 4 Segmente. | Mauerwerk, Puddingwand, Panzermauer |
| **Turm** | 1 × 1, massive **Turmzelle** an Außenkante oder Ecke; überragt die Mauer optisch (Zinne, langer Schatten). Beschießt Feinde auf dem Feld und in der Nähe. | Pfeilturm, Zauberturm |
| **Plattform** | Liefert **Geschützplätze** für Artillerie. | Zinnenkranz, Sternwarte |
| **Hof-Bauteil** | Steht auf **Hofzellen ohne Wände**. Frei zugänglich, fragiler; im **Innenhof** geschützt (§4.1). Bauart je Karte festgelegt. | Fallgrube, Feldlazarett, Brunnen der ewigen Jugend |

**Größen** (Räume mindestens 2 Zellen tief): **2 × 2** (klein), **3 × 2** (Standard), **3 × 3** (groß), vereinzelt 4 × 2. **Hof-Bauteile** 1 × 1 bis 3 × 2, **Türme** 1 × 1. Die **Bauart** (Raum, Hof, Turm, Wand, Tor) legt jede Karte einzeln fest. Wandkarten wirken auf 1–4 Kantensegmente. Alle **drehbar** in 90°-Schritten (R oder Rechtsklick). Gerichtete Bauteile (Rutschbahn, Fallgatter-Tor, Fangnetz) haben eine Blickrichtung.

**Platzierungs-Tags** (stehen auf der Karte):

| Tag | Bedingung |
|---|---|
| **[Außen]** | Modul oder Turm berührt mindestens eine Außenkante der Bastion. |
| **[Innen]** | Modul ist ganz von Hof und anderen Modulen umgeben. |
| **[Front]** | Hat eine Außenkante auf der Seite des Gegners. |
| **[Hof]** / **[Innenhof]** | Hof-Bauteil im Außenhof bzw. geschützt im Innenhof (erlaubte Lage wird je Karte angegeben). |
| **[Ecke]** | Liegt an einer vorspringenden Ecke der Silhouette. **Ecktürme** überblicken zwei Seiten: +1 Reichweite, +10 % HP. |

Jedes Bauteil hat: **Tier**, **Material** (bestimmt Resistenzen, §7.3), **HP**, **Posten** ⚙ (benötigtes Personal, §4.6), **Effekt**, **Tags** (für Nachbarschaft), optional **Linie** (§5.3).

### 4.3 Der Kern & die Kernkammer 🟦

- **Kern-HP:** ⚙ 5000. Der Kern **regeneriert** langsam (⚙ 2 HP/s) und kann von Bau-Gnomen repariert werden.
- **Kernkammer:** 2 × 2 Raum, in dem der Kern pulsiert. Hier wird **erobert** (§7.6) und hier kämpfen die Verteidiger. Nur sie zählt für die Eroberung. *Prototyp (v0.7): Kernkammer = Kern plus ein Ring von einer Zelle (4 × 4), weil der Kern selbst eine massive Zelle ist.*
- **Treffbar:** Der Kern ist ein Ziel wie jede andere Zelle. Flach-Geschosse brauchen eine freie **Schusslinie** zu ihm, Bogen- und Senkrecht-Geschosse treffen ihn, sobald er in Reichweite liegt (§7.2). Seine 5000 HP, Reparatur und Schilde sind die Gegenmittel.
- **Nur Artillerie** (und Chaos-Effekte) verletzt den Kern. Sturmtruppen können ihn **erobern, nicht beschädigen**. So bleiben die Rollen sauber getrennt.
- **Kern-Fähigkeit** 🟨 (P1): Jeder Kern hat eine aktive Fähigkeit mit Abklingzeit; siehe §9.1.

### 4.4 Tor, Wege, Trümmer, Breschen 🟨 (P0)

- **Wegfindung:** 8-Richtungs-Wegfindung auf dem Raster (kein Ecken-Schneiden). Zellen sind begehbar, **Kantensegmente mit Mauer** und **Turmzellen und Kern** blockieren; **Türen** sind offen, das **Haupttor** ist für Freunde offen und für Feinde geschlossen (andere Tore wie vom Spieler eingestellt, Standard: Freunde).
- **Kosten:** Strecke + Zerstörungsaufwand für blockierende Mauern/Tor (HP/100) + Abschreckung durch bekannte Fallen. Eindringlinge nehmen den billigsten Weg; ist keiner frei, brechen sie das schwächste Hindernis.
- **Tor:** Standardeingang (1 Zelle breit, ⚙ 500 HP, Holz). **Feinde müssen es zerstören** oder einen anderen Weg finden.
- **Trümmer:** Ein zerstörtes Bauteil (Raum, Turm) bzw. ein zerstörtes Mauersegment wird zum **Trümmerfeld**: begehbar (−30 % Tempo), ohne Funktion, ohne Deckung, durchlässig für Schusslinien. Sie kann von einem Bau-Gnom **wiederaufgebaut** (§4.7) oder in der Pause überbaut werden.
- **Bresche:** Ein zerstörtes Mauersegment an der Außenkante ist ein **zusätzlicher Eingang**. Artillerie öffnet also Wege für Sturmtruppen.
- **Sonderwege:** Geister gehen durch Mauern, Wühl-Gnome tauchen im Hof hinter der Außenmauer auf, Flieger überqueren Mauern, **Rutschbahn** und **Eilgang** verändern Laufgeschwindigkeit und -richtung (Katalog 01).
- **Isolierte Räume:** Ist ein Raum vom Kern oder Tor abgeschnitten, erreicht ihn kein Personal → er bleibt verwaist. Der Editor warnt (kein Verbot).

### 4.5 Zustände eines Bauteils 🟦/🟨

| Zustand | Wirkung | Wie erkennt man’s? |
|---|---|---|
| **Aktiv** | Voll funktionsfähig (alle Posten besetzt). | Licht an, Werkzeuge klappern. |
| **Teilbesetzt** | Wirkung ∝ besetzter Posten (1 von 2 = 50 %). | Zahl der Männchen am Arbeitsplatz. |
| **Verwaist** | Kein Personal → **0 %**. | Grau, Spinnweben, Staubwolke. |
| **Beschädigt** (< 50 % HP) | Wirkung × 0,75. | Risse, Rauch. |
| **Zerstört** | Trümmer, Funktion **aus**. 🟦 | Schutt, Funken. |
| **Im Bau** | 3 s nach Pause; halbe HP, keine Wirkung. | Gerüst, Hammer-Animation. |
| **Eingefroren / Kurzgeschlossen** | Wirkung × 0,5 bzw. 0 für kurze Zeit (Statuseffekte, §7.4). | Eiskruste / Blitzfunken. |

### 4.6 Personal, Bürger, Lahmlegung 🟦/🟨 (P0)

- Räume mit ⚙ **Posten** brauchen Personal, um zu wirken. Mauern, Plattformen und die meisten Strukturen brauchen keines.
- **Bürger** sind kostenlose Standard-Zivilisten (keine Karte): HP ⚙ 25, **Bürger-Limit** ⚙ 4 + 3 je Wohnhaus, Nachwuchs ⚙ 1 Bürger / 5 s am Kern, solange unter dem Limit.
- Bürger **besetzen automatisch** freie Posten (nächster zuerst). Karten-Zivilisten (§6.7) übernehmen Posten nur, wenn keine Bürger frei sind.
- **Panik:** Bürger in der Nähe von Eindringlingen oder eines **Zielschattens** (§7.2) fliehen zu einem Panikraum oder weg vom Feind. Fliehende arbeiten nicht.
- **Lahmlegung 🟦:** Töten Sturmtruppen Bürger und Zivilisten, bleiben Posten leer → Räume verwaisen → die Bastion wird nach und nach inaktiv. Die HUD zeigt den **Betriebsgrad** (besetzte / benötigte Posten) als Balken unter dem Kern-Balken.
- **Gegenmittel:** Panikraum, Alarmglocke, Wohnhäuser (schnellerer Nachwuchs), Verteidiger an den Engstellen.

### 4.7 Reparatur & Wiederaufbau 🟦/🟨

- **Bau-Gnome** (Karte UZ-02), die **Reparaturwerkstatt** (BU-03) und **Bürger** mit Werkzeug beheben Schäden: ⚙ Bau-Gnom 12 HP/s, Werkstatt 8 HP/s an Nachbarzellen.
- **Wiederaufbau** eines zerstörten Bauteils kostet Arbeit gleich ⚙ 40 % seiner Max-HP (400 HP → 160 Arbeit, ein Bau-Gnom schafft das in ≈ 13 s). Danach steht es mit 40 % HP wieder.
- Der Kern wird wie ein Bauteil repariert.
- Reparatur und Wiederaufbau geben dem Arbeiter **XP** (§8).

### 4.8 Nachbarschaft (Tags & Synergien) 🟨

Bauteile tragen Tags (**Wehr, Heil, Werk, Wissen, Wohn, Magie, Tier, Technik, Chaos, Leicht-Entflammbar, Sprengstoff**). Einzelne Bauteile haben Boni oder Nachteile durch Nachbarn (z. B. Zahnklempner neben Krankenstation, Pulverkammer *nicht* neben Wohnhaus). Nachbarn sind die 4 Seitenzellen (Brände springen auch diagonal). Eine Synergie-Anzeige im Editor markiert Nachbarn grün/rot, ehe man loslässt.

### 4.9 Upgrades durch Duplikate (★) 🟨

Wer dieselbe Bau-Karte erneut zieht, kann sie **auf das bereits stehende Bauteil** legen: **★2** (+50 % HP, Effektwerte +40 %), **★3** (+100 % HP, Effektwerte +80 %). Eigene Sprite-Varianten (Wimpel, Zierleisten) markieren den Rang. Das gleiche gilt für Truppen-Karten im Kontingent (§5.6).

### 4.10 Umbau in der Pause 🟨

Pro Pause darf jeder Spieler **1 Bauteil verschieben** (kostenlos). Wer weiter umbaut, **reißt ab**: das Bauteil ist verloren (Karte weg). Hofzellen darf man jederzeit frei anlegen (im Rahmen der Hof-Erweiterung, §4.1) und bis zur Hälfte der vorhandenen Fläche abtragen, solange kein Modul abgeschnitten wird. Zerstörte Bauteile (Trümmer) dürfen kostenlos überbaut werden. **Verschieben** bedeutet: Modul aufnehmen und an einer gültigen Kante neu anlegen.

---

## 5. Karten & Ziehsystem

### 5.1 Kartentypen 🟦

| Typ | Funktion | Wohin? |
|---|---|---|
| **Bau-Karte** | Ein Gebäude, siehe Katalog 01. | Auf das Raster, einmalig. |
| **Truppen-Karte** | Eine Einheitenart, siehe Katalog 02. Vier Kategorien: Artillerie, Sturm, Verteidiger, Zivilist. | Ins Kontingent (Slots). |
| **Chaos-Karte** 🟨 P2 | Einmaliger Effekt (Meteor, Zeitriss, Froschregen…). | Wird sofort gespielt. |

### 5.2 Tier & Epochen 🟨

Karten gibt es in **vier Tiers**: **I** (Grundausstattung), **II** (Spezialisten), **III** (Meisterstücke), **IV** (Wahnsinnskarten). Die Tier-Gewichte beim Ziehen wachsen mit dem Spielverlauf, damit die Partie eskaliert:

| Ziehung | Tier I | Tier II | Tier III | Tier IV |
|---|---|---|---|---|
| Loadout | 70 % | 30 % | – | – |
| Pause 1–2 | 40 % | 50 % | 10 % | – |
| Pause 3–4 | 15 % | 50 % | 30 % | 5 % |
| Pause 5–6 | 5 % | 35 % | 50 % | 10 % |
| Pause 7+ | – | 20 % | 55 % | 25 % |

⚙ Alle Werte sind Startwerte.

### 5.3 Linien & Freischalt-Räume 🟦/🟨

Viele Truppen gehören zu einer **Linie**. Höherwertige Truppen sind erst einsetzbar, wenn ein passender **Freischalt-Raum** existiert und aktiv ist (Räume, die „bessere Einheiten freischalten“ 🟦):

| Linie | Freischalt-Raum | Typische Truppen |
|---|---|---|
| **Basis** | – (immer) | Skelette, Goblins, Frösche, Bau-Gnome, Köche |
| **Waffen** | Kaserne (BF-01) | Orks, Zwerge, Trolle, Riesen |
| **Arkan** | Arkanum (BF-02) | Magier-Lehrlinge, Golems, Salamander |
| **Tier** | Menagerie (BF-03) | Gänse, Krebse, Waschbären, Kalmare, Pudel |
| **Technik** | Belagerungswerkstatt (BF-04) | Kanonen, Dampf, Uhrwerk |
| **Gruft** | Gruft (BF-05) | Geister, Fledermäuse, Untote |
| **Frost** | Eisgrotte (BF-06) | Eisbären, Schneemänner, Yeti |
| **Flora** | Gewächshaus (BF-07) | Pilze, Ents, Bienen |
| **Luft** | Luftdock (BF-08) | Zeppelin, Drachenreiter, Tauben |
| **Segen** | Tempel der Heiterkeit (BF-09) | Paladine, Priester |
| **Chaos** | Chaoskabinett (BF-10) | Mimics, Frösche, Clowns |

Regeln:
- **Ziehpool:** Karten einer Linie werden mit ×2 Gewicht gezogen, wenn man den passenden Raum besitzt; ohne Raum nur mit ×0,5 (nie 0).
- **Nachspawn:** Truppen einer Linie spawnen nur, solange der Freischalt-Raum **aktiv** (nicht zerstört/verwaist) ist. Bereits gespawnte Einheiten bleiben.
- **Spawn-Ort:** Einheiten einer Linie treten aus ihrem Freischalt-Raum aus (sichtbare Prozession aus dem Raum), Basis-Einheiten aus dem Tor. Fällt der Raum aus, ist der Nachschub gestoppt.

### 5.4 Karten-Anatomie (Layout)

Tier-Zahl · Sterne (★) · Sprite · Name · Kategorie/Linie · Kernwerte (HP, Schaden, Takt) · Tag-Icons · Flavor-Zeile. Rahmenfarbe nach Kategorie: Artillerie = Karminrot, Sturm = Bernstein, Verteidiger = Blau, Zivilist = Grün, Bau = Steingrau/Violett. Layout siehe Teil 2 §10.5.

### 5.5 Ziehen: Loadout und frische Hand 🟦 ✔ entschieden

- **Spielbeginn:** **10 ziehen, 7 behalten** (§3.2).
- **Jeder Zeitstopp:** eine **komplett frische Hand**: **5 ziehen, 3 behalten**. Es gibt **keine** Hand, die man aufspart: Alle drei behaltenen Karten müssen **in dieser Pause gespielt werden, ungespielte verfallen**. Zurück in den Pool wandern auch die zwei nicht behaltenen Karten.
- **Trostpflaster** 🟨: Jede behaltene, aber nicht gespielte Karte repariert die Bastion um ⚙ 4 % (Bauschutt wird verwertet). Damit lohnt sich auch eine Karte, für die gerade kein Platz ist.
- **Hof überbauen (v0.9):** Räume und Türme dürfen schlichte Hofzellen (auch im Zufahrtsgang) überbauen, solange ein Weg aus Hofzellen vom Tor zur Kernkammer offen bleibt und kein Raum seine Tür verliert. So lassen sich Riegel quer über den Gang setzen und per Hof-Erweiterung Umwege anlegen: ein Labyrinth. Beim Aufnehmen wird die Zelle wieder Hof.
- **Mauern brechen kostet Weg (v0.9):** Angreifer rechnen das Durchbrechen einer 300-HP-Mauer wie einen Umweg von rund 30 Zellen (6 + HP/12), sie folgen also lieber dem Labyrinth.
- **Überbauen 🟨:** Wer keinen Platz hat, darf ein Bauteil **überbauen** (das alte geht verloren, Trümmer sind kostenlos überbaubar) oder eine Truppen-Karte gegen ein Kontingent-Element tauschen.
- **Garantie:** In den 5 Karten sind mindestens 1 Bau-Karte und 1 Truppen-Karte.
- **„Bekannte Gesichter“** 🟨: 20 % der gezogenen Karten sind Kopien von Karten, die man bereits besitzt (auf dem Raster oder im Kontingent). Das macht ★-Upgrades und größere Kontingente erreichbar.
- **1 Reroll** pro Pause (alle 5 Karten neu ziehen).
- **Kein echtes Deck:** Ziehen mit Zurücklegen aus dem gewichteten Gesamtpool. Der Pool ist nach Tiers gegatet (§5.2) und nach Linien gewichtet (§5.3, §9.1).
- Der **Chronoschrein** (BU-11) erhöht auf **5 ziehen, 4 behalten**.

### 5.6 Kontingent, Soll & Nachschub 🟦/🟨

- Das **Kontingent** ist die Armee-Leiste. **Plätze (v0.9):** ⚙ **5** zum Start, **+1 mit jedem Zeitstopp** (die Armeen werden immer größer und vielseitiger), dazu **½ Platz je gebautem Einheiten-Raum** (Freischalt-Räume: Kaserne, Arkanum, Menagerie, …; zwei Räume = +1 Platz). Höchstens ⚙ 16. Kein einzelnes Gebäude ist mehr nötig, um das Kontingent zu erweitern.
- **Zivilisten haben einen eigenen Pool (v1.0):** ⚙ **2 Zivilisten-Plätze** zum Start, **+1 mit jedem Zeitstopp** (höchstens 8). Sie konkurrieren nicht mehr mit Artillerie, Sturm und Verteidigern um die Kampfplätze; Ersetzen geht nur innerhalb desselben Pools. Vorher kamen Zivilisten praktisch nie ins Kontingent, weil jede Kampftruppe wertvoller wirkte.
- Jede Truppen-Karte im Kontingent hat zwei Zahlen: **Soll (S)** = Zielstärke (wie viele gleichzeitig leben sollen) und **Nachschub (N)** = wie viele pro Welle nachgeliefert werden.
- **Kontinuierliches Nachspawnen 🟦:** Zu jeder Welle fordert jede Karte `min(N, S − lebend)` Einheiten an (nie Verlust des Kontingents, nie „ausgehende“ Truppen). Sie spawnen gestaffelt (⚙ 0,4 s Abstand).
- **Duplikat-Upgrade ★:** Zweite Kopie → **★2** (S × 1,5, N + 1), dritte → **★3** (S × 2, N + 1). Zwei Karten derselben Art belegen keinen zweiten Platz.
- **Voll?** Eine neue Truppen-Karte ersetzt eine vorhandene (diese geht auf den Ablagestapel).
- **Grenzen:** Artillerie spawnt nur bei **freiem Geschützplatz** (§6.4). Linien-Truppen brauchen aktiven Freischalt-Raum (§5.3). Globales Einheitenlimit ⚙ **40 pro Seite**.

### 5.7 Befehle in der Pause 🟨

Keine Echtzeit-Befehle, aber eine kleine Planungsebene pro Karte:
- **Artillerie → Zielpriorität** (§6.4): *Chirurg* (Standard), *Brecher*, *Kernjagd*, *Waffenjäger*, *Streuer*.
- **Verteidiger → Wachzone** (§6.6): *Tor*, *Mitte*, *Kernkammer*.
- **Sturmtruppen → Doktrin** ist festgelegt durch die Einheit (§6.5); keine Einstellung.

---

## 6. Truppen

### 6.1 Die vier Kategorien 🟦

| Kategorie | Wo? | Aufgabe | Siegbeitrag | Schwäche |
|---|---|---|---|---|
| **Artillerie** | Auf Geschützplätzen der **eigenen** Bastion | Schießt auf die **gegnerische Bastion**, zerstört Räume (schaltet sie ab), später den Kern. | **Zerstörung** | Fragil; Splash und Eindringlinge treffen sie auf ihren Plätzen. |
| **Sturm** | Niemandsland → gegnerische Bastion | Dringt ein, **tötet Zivilisten**, legt die Bastion lahm, besetzt die Kernkammer. Zieht sich bei < 50 % HP zurück, **falls** Heilung vorhanden. | **Eroberung** | Türme, Verteidiger, Fallen; ohne Heilung verlieren sie. |
| **Verteidigung** | Nur in der **eigenen** Bastion | Deutlich stärker als Sturm; bleibt in der Bastion; verhindert Eroberung. | **Verhindert Eroberung** | Zahlenmäßige Übermacht, Statuseffekte, Splash. |
| **Zivilisten** | Nur in der **eigenen** Bastion | Verstärken, heilen, reparieren, Hilfsfunktionen. | Betrieb | Extrem fragil. |

**Das Spannungsdreieck** 🟨: Artillerie öffnet Wege (Breschen) und schaltet Räume ab → macht Sturm effektiver. Sturm tötet Zivilisten → macht die Bastion lahm → macht Artillerie sicherer. Verteidiger schützen Zivilisten und die Kernkammer. Der Gegner muss *beides* abwehren: Beschuss (Mauern, Schilde, Reparatur) und Eroberung (Verteidiger, Fallen, Türme).

### 6.2 Gemeinsame Werte 🟨

| Wert | Bedeutung |
|---|---|
| **HP** | Lebenspunkte bei Rang 0. |
| **Rüstungsklasse** | **Fleisch**, **Panzer**, **Geist**, **Knochen**, **Pudding** (Resistenzmatrix §7.3). |
| **Angriff** | Schaden pro Treffer / Takt in Sekunden / Reichweite. |
| **Reichweite** | **Nah** ≤ 1 Zelle · **Kurz** 3 · **Mittel** 5 · **Weit** 8 · bei Artillerie in Zellen (26–50, §6.4). |
| **Tempo** | **kriechend** 0,8 · **langsam** 1,0 · **normal** 1,5 · **flink** 2,2 · **rasend** 3,0 (Zellen/s). |
| **Strukturfaktor** | Multiplikator auf Schaden gegen Bauteile. Sturm Standard **×0,4**, *Brecher* ×1,0, Verteidiger/Zivilisten ×0. |
| **Soll / Nachschub** | Siehe §5.6. |
| **Rang-Talent** | Spezialfähigkeit, die ab **Rang 3** freigeschaltet wird (§8). |

### 6.3 Spawn & Nachschub

- Welle → jede Kontingent-Karte fordert Einheiten an → gestaffelter Spawn am zugehörigen Ort (§5.3).
- **Artillerie** spawnt am Geschützplatz selbst (Auftauchen per Stampf-Animation). **Verteidiger** am Kern, Zivilisten am Wohnhaus/Kern. **Sturm** am Freischalt-Raum bzw. Tor.
- Gefallene Einheiten werden **nie** zu Karten-Verlusten. Aber Ränge gehen verloren, neue Einheiten starten bei Rang 0 (außer Boni wie Drillplatz).

### 6.4 Artillerie 🟦/🟨 (P0)

**Geschützplätze (GP):** Artillerie braucht freie GP auf Plattformen (Zinnenkranz, Geschützdeck, Sternwarte, Wolkenanker, Schwebende Festung, Bunkerlafette; dazu die Belagerungswerkstatt und das Luftdock). Jede Einheit benötigt 1–4 GP (steht auf der Karte). Ohne freien GP wird sie **nicht gespawnt** und wartet im Kontingent. Zerstört man die Plattform, sind die GP weg und die Artillerie darauf stirbt.

**Flugbahnen** (bestimmen, was getroffen wird, siehe §7.2):

| Flugbahn | Ziel & Wirkung | Splash | Typische Waffen |
|---|---|---|---|
| **Flach** | Ziel: eine Zelle mit freier **Schusslinie**. Trifft die erste feste Zelle auf der Linie. | klein | Donnerbüchse, Funken-Magier |
| **Bogen** | Ziel: **beliebige Zelle** in Reichweite, keine Schusslinie nötig. Streuung; **Zielschatten** 1,2 s vor dem Einschlag. | mittel | Katapult, Goblin-Kanone |
| **Senkrecht** | Wie Bogen, aber Zielschatten 2,0 s, kleine Streuung; vom Fangnetz nicht abfangbar. | groß | Meteor, Eiszapfen |
| **Durchschlag** | Flach, setzt sich durch 2–5 feste Zellen fort (−20 % je Zelle). | – | Ballista, Dicke Berta |
| **Untergrund** | Beliebige Zelle; trifft nur Bauteile (kein Personenschaden); ignoriert Kuppel, Netz und Spiegel; Warnung nur als Rumpeln (0,8 s). | mittel | Maulwurf-Mörser |
| **Streu** | N kleine Treffer auf zufällige Zellen in einem 3 × 3-Zielgebiet. | – | Fledermäuse, Splitter |
| **Luft** | Wie Bogen, aus der Luft; der Schütze ist angreifbar. | mittel | Brummzeppelin |

**Reichweiten** (gemessen vom Geschützplatz zur Zielzelle, v0.3 für die große Karte): **Kurz 26 · Mittel 34 · Weit 42 · Extrem 50 Zellen.** Die Baugründe liegen 20 Zellen auseinander (Front zu Front), die **Kernkammern ≈ 30 Zellen**, die gegnerische Bastion reicht bis ≈ 40 Zellen. Aus der Frontreihe erreicht **Kurz (26)** die gegnerische Front und die ersten Räume dahinter, die **Kernkammer liegt auf ≈ 28–32**, die ganze Bastion auf ≈ 36–40. Frühe Artillerie (Kurz) kann den Kern also nicht erreichen; dafür braucht es **Mittel-/Weit-Geschütze** oder die **Sternwarte** (+4). **Extrem (50)** deckt die gesamte Karte ab. Die Planungsansicht `art/out/szene_baugrund.png` zeigt die Ringe ab einem Katapult-Platz.

**Zielwahl:** Aus den **erreichbaren** Zellen (Flach/Durchschlag: mit freier Schusslinie; Bogen/Senkrecht/Untergrund/Luft: alle in Reichweite) wählt die Einheit nach ihrer **Zielpriorität**:

| Priorität | Wählt |
|---|---|
| **Chirurg** (Standard) | Zelle mit dem höchsten **Funktionswert** (Räume mit Personal, Heilquellen, Plattformen vor Mauern). |
| **Brecher** | Flach: die Zelle, die die Schusslinie zu wichtigen Zielen und zum Kern am schnellsten öffnet (Mauern davor). Bogen: wie Chirurg. |
| **Kernjagd** | Den Kern, sobald erreichbar; sonst die Zelle, die ihn am schnellsten freilegt. |
| **Waffenjäger** | Plattformen, Türme und Schilde (also gegnerische Artillerie und Abwehr). |
| **Streuer** | Zufällige Zelle im Bereich (gut gegen Bürger/Zivilisten, schlecht gegen Panzerung). |

**Geschosse sind sichtbar** (Flugzeit 1,0–2,2 s ⚙). Bei Bogen und Senkrecht erscheint am Boden ein **Zielschatten**: Einheiten im Radius fliehen vor ihm, Bürger verlassen den Raum kurz und die Arbeit pausiert. Abfangen können nur ausgewählte Abwehr-Bauteile (Katalog 01, BA).

### 6.5 Sturmtruppen 🟦/🟨 (P0)

Sturmtruppen laufen zur gegnerischen Bastion, brechen das Tor oder nutzen Breschen, töten Zivilisten, besetzen die Kernkammer. Jede Einheit hat eine **Doktrin**, die ihr Zielverhalten festlegt:

| Doktrin | Verhalten |
|---|---|
| **Jäger** | Greift bevorzugt **Zivilisten**, dann Verteidiger, dann alles Weitere. Standard für die meisten Einheiten. |
| **Brecher** | Bricht gezielt **Tore, Mauern und Räume** (Strukturfaktor 1,0): öffnet Wege für andere. |
| **Eroberer** | Läuft auf kürzestem Weg zur **Kernkammer** und besetzt sie, kämpft nur wenn blockiert. |
| **Plünderer** | Lässt sich von **Beute** (Schatztruhe, Wunschbrunnen, Trophäenhalle) ablenken; sonst Jäger. |
| **Sprenger** | Läuft zum **teuersten** Bauteil und zündet sich dort. |

**Rückzugsregel 🟦 (präzise):**
1. **Auslöser:** HP sinkt unter ⚙ **50 %**, *und* es existiert eine **Heilquelle**: ein aktives (teil- oder voll besetztes) Heilgebäude **oder** ein lebender, erreichbarer Heiler. Prüfung bei Unterschreiten und danach jede Sekunde.
2. **Rückzug:** Die Einheit bricht den Angriff ab, geht in den Zustand **Fliehend** (+30 % Tempo, greift nicht an) und rennt zur **nächsten Heilquelle** der eigenen Bastion.
3. **Heilung:** Sie belegt einen **Behandlungsplatz** (Warteschlange, wenn belegt). Geheilt wird bis ⚙ **90 % HP**.
4. **Rückkehr:** Danach läuft sie wieder an die Front. XP und Rang bleiben vollständig erhalten. 🟦
5. **Keine Heilquelle?** Dann **Todesmut**: kämpft bis zum Tod und bekommt ⚙ +15 % Schaden. Fällt die Heilquelle *während* des Rückzugs aus, dreht die Einheit um und kämpft.
6. **Warteschlange > 6 s?** Wer nicht drankommt, kehrt mit Todesmut um.
7. **Rückzug ist angreifbar:** Fliehende werden von Türmen und gegnerischen Sturmtruppen bevorzugt gejagt (Pfeilturm: +50 % Schaden gegen Fliehende).

Das macht **Lage und Schutz der Heilquellen** zur wichtigsten Bauentscheidung der Sturmtruppen: nah am Tor (kurzer Weg), tief in der Bastion (sicher), mehrfach (Redundanz).

### 6.6 Verteidiger 🟦/🟨 (P0)

- Bleiben **immer in der eigenen Bastion**. Deutlich stärker als Sturm (≈ 3–4× HP, ≈ 1,3–2× Schaden pro Treffer).
- **Wachzone** (pro Karte in der Pause gewählt): *Tor*, *Mitte* (Streifzug im Innenhof), *Kernkammer*. Standard je nach Einheit.
- **Leine:** Sie verlassen die Zone nur bis zu ⚙ 4 Zellen; bei **Alarm** (Alarmglocke, BU-04) verdoppelt sich die Leine und sie rücken auf den nächsten Eindringling vor.
- **Eroberungsblockade 🟦:** Steht ein Verteidiger **lebend in der Kernkammer**, wird der Eroberungsfortschritt dort gestoppt (§7.6). Verteidiger haben **keinen** Strukturschaden und keine Fernwirkung auf das Feld.
- Sie können Splash-Schaden und Artillerie nicht abwehren (daher: Mauern, Schilde, Reparatur).

### 6.7 Zivilisten 🟦/🟨 (P0)

Zwei Arten:
1. **Bürger** (Standard, keine Karte, §4.6): halten die Räume in Betrieb.
2. **Karten-Zivilisten** (Katalog 02, UZ): Spezialisten, die Dinge tun wie **heilen, Einheiten verstärken, Räume reparieren, löschen, Fallen stellen, XP lehren**. Sie handeln automatisch (nächstbestes Ziel), kämpfen nicht (Ausnahmen: Imkerin, Fallensteller), fliehen bei Gefahr zum Panikraum.
- Karten-Zivilisten zählen als **Heilquelle** (Heiler) bzw. **Reparateure** und gewinnen XP durch ihre Wirkung (§8).

### 6.8 Heilung 🟦

Heilquellen sind: Heilgebäude (BH) mit Behandlungsplätzen, Heiler-Zivilisten (UZ-01 u. a.), Aura-Heilung (Heilpilz, Brunnen), das Feldlazarett. Alle zählen für die Rückzugsregel (§6.5). Heilung verbraucht keine Ressource; sie wird durch Personal, Platz und Stand der Gebäude begrenzt.

---

## 7. Kampfsystem

### 7.1 Takt & Grundmechanik 🟨

Fixed-Timestep-Simulation (⚙ 30 Ticks/s). Einheiten wählen Ziele nach Doktrin/Zone, laufen in Reichweite, greifen in ihrem Takt an. Es gibt **keine Ausweichwürfel**: Treffer sind sicher (Ausnahmen: Nebel, Orakel, Ausweichen als bewusste Fähigkeit). Schaden = `Basis × Rang-Faktor × Resistenz(Schadensart, Klasse/Material) × Status-Faktor`.

### 7.2 Beschuss-Geometrie: Schusslinie, Streuung, Zielschatten 🟨 (P0)

Das ist das **Herzstück** der Zerstörung. Zellen sind **fest** (Raum-Modul, Kern, Turmzelle), **offen** (Hof, leer) oder **Trümmer** (offen, aber langsam begehbar). Zusätzlich blockieren **Mauersegmente** auf den Zellkanten die Schusslinie.

- **Schusslinie:** Eine Zelle ist für Flach-Geschosse **sichtbar**, wenn die gerade Linie vom Schützen zur Zielzelle keine *andere feste Zelle und kein Mauersegment des Gegners* berührt. Das Geschoss trifft das erste feste Hindernis auf der Linie (Mauersegment oder Zelle). **Eigene Zellen blockieren nicht**: Schützen stehen auf Plattformen und feuern über die eigene Mauer.
- **Bogen/Senkrecht/Luft:** Brauchen keine Schusslinie. Das Geschoss kommt von oben und landet auf der Zielzelle plus **Streuung** ⚙ `0,4 + 0,04 × Entfernung` Zellen (bei 15 Zellen Abstand ≈ 1 Zelle). Der **Zielschatten** zeigt Zielort und Radius schon ⚙ 1,2 s (Bogen) bzw. 2,0 s (Senkrecht) vor dem Einschlag, für beide Spieler.
- **Durchschlag** zählt feste Zellen und Mauersegmente entlang der Linie und verliert 20 % Schaden pro durchquertem Hindernis.
- **Untergrund:** Ziel beliebig, trifft nur Bauteile; Kuppel, Netz und Spiegel greifen nicht.
- **Schaden an einer Zelle** wirkt auf das Bauteil, das sie belegt. Mehrzellige Bauteile haben **einen** HP-Pool; jede ihrer Zellen leitet Treffer dorthin.
- **Splash (Radius r):** Nachbarzellen in Radius r erhalten 50 % Strukturschaden. **Personenschaden** trifft alle Einheiten im Einschlagraum voll und in Nachbarräumen zu 60 %.
- **Arbeitsteilung 🟦:** Flach und Durchschlag **tragen Mauern ab**: Sie öffnen Breschen und Schusslinien zum Kern. Bogen und Senkrecht treffen **gezielt Räume und den Kern** (auch hinter Mauern), sind aber ungenauer, langsamer und schlagen schwächer gegen Struktur zu. Gegenmittel: Reparatur, Schilde, Nebel, Fangnetz, Orakel.
- **Beschädigte Zellen** in Reichweite haben Vorrang bei *Chirurg/Brecher* (damit Treffer nicht verpuffen).
- **Lesbarkeit 🟨:** Im Editor zeigt ein Overlay (Taste **L**) für jede eigene Artillerie, welche gegnerischen Zellen sie per Schusslinie sieht; Zielschatten und Flugbahnen sind in der Schlacht sichtbar.

### 7.3 Schadensarten, Materialien, Rüstungsklassen 🟨 (P1 – im MVP nur Wucht & Feuer)

Schadensarten: **Wucht (W), Feuer (F), Eis (E), Blitz (B), Gift (G), Arkan (A)**. Chaos-Effekte würfeln eine davon.

**Bauteil-Materialien** (Multiplikatoren auf den Schaden):

| Schaden \ Material | Holz | Stein | Metall | Kristall | Organisch | Pudding | Eis |
|---|---|---|---|---|---|---|---|
| Wucht | 1,0 | 0,9 | 0,8 | 1,2 | 1,0 | 0,5 | 1,1 |
| Feuer | 1,5 | 0,7 | 0,9 | 0,8 | 1,5 | 1,3 | 1,8 |
| Eis | 0,9 | 1,1 | 1,2 | 0,9 | 1,0 | 0,8 | 0,3 |
| Blitz | 1,0 | 0,8 | 1,5 | 1,0 | 0,7 | 0,6 | 0,9 |
| Gift | 0,6 | 0,9 | 1,4 | 0,7 | 1,6 | 1,0 | 0,7 |
| Arkan | 1,0 | 1,0 | 0,9 | 0,6 | 1,0 | 1,0 | 1,0 |

**Rüstungsklassen der Einheiten:**

| Schaden \ Klasse | Fleisch | Panzer | Geist | Knochen | Pudding |
|---|---|---|---|---|---|
| Wucht | 1,0 | 0,7 | 0,4 | 1,2 | 0,6 |
| Feuer | 1,0 | 0,9 | 0,8 | 0,9 | 1,4 |
| Eis | 1,0 | 1,0 | 0,8 | 0,8 | 1,2 |
| Blitz | 1,0 | 1,3 | 0,8 | 0,7 | 1,0 |
| Gift | 1,2 | 0,5 | 0,0 | 0,0 | 0,8 |
| Arkan | 1,0 | 1,0 | 1,4 | 1,2 | 1,0 |

### 7.4 Statuseffekte 🟨

| Status | Wirkung | Typische Dauer |
|---|---|---|
| **Brennen** | 3 Feuer/s; springt auf entflammbare Nachbarn (Holz, Organisch); Bauteile verlieren 10 HP/s. | 5 s |
| **Eisig** | −30 % Tempo und Angriffstempo. | 4 s |
| **Eingefroren** | Einheit: betäubt. Bauteil: Wirkung × 0,5. | 2–5 s |
| **Schleim** | −25 % Tempo, klebt. | 4 s |
| **Vergiftet** | 4 Gift/s, ignoriert Rüstungsklasse, Heilung −50 %. | 6 s |
| **Betäubt** | Keine Aktionen. | 1–4 s |
| **Verwirrt** | Zufällige Bewegung/Zielwahl. | 3 s |
| **Furcht** | Flieht vom Verursacher. | 2–4 s |
| **Wurzel / Festgehalten** | Kann sich nicht bewegen, darf angreifen. | 2 s |
| **Frosch** | Verwandlung: HP/Angriff stark reduziert, kann keine Fähigkeiten nutzen; Bürger-Posten verwaist. | 3–6 s |
| **Tanzend** | Kann nicht angreifen. | 2 s |
| **Geblendet** | −50 % Trefferchance/Genauigkeit (Streuung × 2). | 8 s |
| **Kurzgeschlossen** | Bauteil: 0 % Wirkung. | 3 s |
| **Nass** | −10 % Tempo, Blitz × 1,5, Brennen unmöglich. | solange Regen |
| **Gesegnet** | Absorbiert den nächsten Schaden (bis 40). | 15 s |
| **Gehärtet / Satt / Angespornt** | Gehärtet (Hardened): +12 % Max-HP, +10 % Wucht · Satt (Fed): +15 % Max-HP · Angespornt (Spurred): +15 % Angriffstempo. Maßgeblich ist [`NOMENCLATURE.md`](NOMENCLATURE.md). | permanent / 40 s / in Aura |

### 7.5 Türme 🟦/🟨

Türme (Katalog 01, BT) stehen als Turmzellen an der Außenkante, schießen **auf Feinde im Feld und in Reichweite** (also auch Eindringlinge in der Nähe), nicht auf Bauteile. Sie benötigen **Personal** (1 Posten) und verhindern so, dass Sturmtruppen ungehindert über das Feld rennen. Ihre Reichweite ist bewusst kurz (5–8 Zellen), sie decken nur den vorderen Teil des Niemandslands.

### 7.6 Besetzung & Eroberung 🟦/🟨 (P0)

- **Besetzung** zählt Feinde (Sturmtruppen) *lebend in der Kernkammer*; Goblin-Kanonenfutter zählt halb.
- **Fortschritt** der Eroberungsleiste: `Rate = 1,5 %/s × n` (v0.9, vorher 4 + 2 × (n − 1)), ⚙ max 6 Eindringlinge. Beispiel: 3 Eindringlinge → 4,5 %/s → 100 % in rund 22 s; ein einzelner Eindringling braucht über eine Minute.
- **Gesperrt**, solange ein lebender Verteidiger (oder Kern-Hüter) der Bastion in der Kernkammer steht. Der Fortschritt wird dann nicht abgebaut.
- **Abbau:** Ohne Eindringlinge sinkt die Leiste um ⚙ 3 %/s.
- **Kernkristall zertrümmern (v0.9):** Eindringlinge in der Kernkammer, die kein Ziel mehr haben, schlagen auf den Kern ein (volle Wucht, mindestens Strukturfaktor 1). So gibt es auch dann Fortschritt, wenn Verteidiger die Eroberung sperren (zum Beispiel Nahkämpfer gegen Flieger). Die Anzeige im Spiel zeigt Fortschritt, Rate und wer sperrt.
- **Bei 100 % gewinnt der Eroberer sofort.**
- Segensauren und Kern-Fähigkeiten verlangsamen/sperren (Katalog).

### 7.7 Kern-Zerstörung 🟦

Kern-HP ⚙ 5000. Er wird nur durch Artillerie, Chaos-Effekte und Welt-Ereignisse verletzt und regeneriert 2 HP/s sowie durch Reparatur. Bei 0 HP: Spielende, Explosion (Teil 2 §10.4). Alle Gebäude, Einheiten und Geschosse reagieren in der Explosionsanimation physikalisch-comichaft.

### 7.8 Wer kann wen verletzen? 🟨

| Quelle \ Ziel | Bauteile | Einheiten im Feld | Einheiten in der Bastion | Kern |
|---|---|---|---|---|
| **Artillerie** | ✔ (Struktur) | ✘ | ✔ (Splash, Personenschaden) | ✔ |
| **Sturm** | ✔ (Faktor 0,4 / Brecher 1,0) | ✔ | ✔ | ✘ (nur erobern) |
| **Verteidiger** | ✘ | – | ✔ | ✘ |
| **Türme** | ✘ | ✔ | ✔ (in Reichweite) | ✘ |
| **Zivilisten** | ✘ | ✘ | wenige (Imkerin, Fallen) | ✘ |

---

## 8. Erfahrung & Ränge 🟦/🟨 (P0)

**Alle** Einheiten (Artillerie, Sturm, Verteidiger, Zivilisten) sammeln XP 🟦:

| Quelle | XP ⚙ |
|---|---|
| **Zeit** (am Leben) | 0,4 XP/s, **nur bis Rang 2** (idle bringt dich nicht zur Elite) |
| **Schaden an Einheiten** | 0,25 XP pro Schadenspunkt |
| **Schaden an Bauteilen** | 0,08 XP pro Schadenspunkt |
| **Heilung** | 0,2 XP pro geheiltem HP |
| **Reparatur** | 0,08 XP pro repariertem HP |
| **Unterstützung** (Auren, Buffs) | 0,5 XP pro beeinflusster Einheit und Sekunde (max 2 XP/s) |
| **Kill-Bonus** | +10 XP (+5 je Rang des Opfers) |
| **Rang-Differenz** | +10 % XP je Rang, den der Gegner höher ist |

| Rang | Name | Kumulative XP ⚙ | Bonus |
|---|---|---|---|
| R0 | Rekrut | 0 | – |
| R1 | Gefreiter | 50 | +10 % HP, +10 % Schaden |
| R2 | Veteran | 140 | +20 % |
| R3 | Elite | 300 | +30 % und **Rang-Talent** (steht je Einheit im Katalog) |
| R4 | Held | 540 | +40 % |
| R5 | Legende | 900 | +50 % und **Ruhmesaura**: Freunde im Umkreis 3 → +8 % Schaden |

- **Sichtbarkeit 🟨:** Rangabzeichen über der Einheit, ab R2 Details am Sprite (Narben, Wimpel, Federbusch), ab R4 Glühen, R5 eigener Name/Titel („Gerd der Unverdauliche“) über zufälligen Namensbausteinen.
- **Rang-Aufstieg** heilt 25 % der Max-HP (Konfetti-Pixel, Mini-Hitstop).
- **Rückzug lohnt sich 🟦:** Wer überlebt, verliert nichts. Der Verlust bei Tod ist der Rang, nicht das Kontingent.
- **Anti-Snowball** 🟨: Zeit-XP ist gedeckelt, Rang-Differenz-Bonus hilft Unterlegenen, Todesmut ohne Heilquelle erzeugt Gegen-Dynamik, Wahnsinn (§3.7) beendet Patts. *Diese Regeln wirken je Einheit oder gar nicht auf den Rückstand eines Spielers. Einen echten Aufholmechanismus gab es bis v0.9 nicht; er steht jetzt in §8.1.*

### 8.1 Aufholmechanismen 🟦 (v1.0)

**Warum:** Ein Rückstand verstärkt sich selbst. Zerstörte Plattformen nehmen die Geschützplätze (die Artillerie darauf stirbt), zerstörte Heilquellen nehmen den Rückzug, und beide Spieler ziehen immer gleich viele Karten, egal wie der Stand ist. Wer zurückliegt, hatte keinen Weg zurück.

**Messung:** Beim Beginn jedes Zeitstopps wird der **Zustand der Bastion** jedes Spielers berechnet: `Zustand = 0,45 × Kern-HP + 0,45 × Bauwerk (HP aller stehenden Bauteile ÷ Max-HP aller je gebauten) + 0,10 × (1 − Eroberungsdruck)`. **Rückstand** = Zustand des Gegners − eigener Zustand (mindestens 0). Gemessen wird nur der Bestand, nicht die Spielleistung; wer vorn liegt, wird nicht bestraft.

**Hilfe** bis zum nächsten Zeitstopp (⚙ Stufen `AID`, Anzeige im Spiel unter „Comeback aid“):

| Stufe | Rückstand ab | Behalten | Neuwurf | Ziehgewichte | Freier Wiederaufbau | XP aller Einheiten |
|---|---|---|---|---|---|---|
| 0 | – | 3 | 1 | normal | 0 | – |
| 1 | 0,12 | +1 | +0 | normal | 1 | +15 % |
| 2 | 0,25 | +1 | +1 | wie 1 Zeitstopp später | 2 | +30 % |
| 3 | 0,40 | +2 | +1 | wie 2 Zeitstopps später | 3 | +50 % |

- **Freier Wiederaufbau:** Im Zeitstopp darf der Spieler zerstörte Bauteile (Ruinen, grün umrandet) ohne Karte wiederherstellen: **50 % HP, 3 s Bauzeit**, Rang und Platz bleiben. Ruinen lassen sich nicht mehr aufnehmen (das gab vorher heimlich die Karte zurück).
- Das Ziel ist eine **Comeback-Chance ≥ 25 %** (§12.1). Die Bot-Sim misst sie (`comeback:` am Ende von `npm run sim`) und vergleicht mit `BB_NOAID=1` ohne Hilfe.

**Weitere Stützen:** Eigener **Zivilisten-Pool** (§5.6), Kontingent wächst mit jedem Zeitstopp, Fundament-Karten zum Start, Trostpflaster, Todesmut, Rang-Differenz-XP.

---

## 9. Kerne (Fraktionen), Welt-Launen, Chaos 🟨

### 9.1 Fraktions-Kerne (P1) ✔ entschieden

Der Kern ist zugleich die **Fraktion** des Spielers. Jeder der 12 Kerne (Katalog 03) bringt:

- eine **Passive** und eine **aktive Fähigkeit** (Abklingzeit 70–90 s), die der Spieler per Klick während der Schlacht auslöst. Das ist der einzige Echtzeit-Eingriff und gibt Zuschauern einen Moment der Kontrolle;
- zwei **Linien-Affinitäten**: Die **Hauptlinie** ist vom Start an freigeschaltet (der Kern bringt den passenden Freischalt-Raum als kostenlosen **Kern-Anbau** in ★2-Qualität mit) und ihre Karten werden ×2 häufiger gezogen. Die **Nebenlinie** wird ×1,5 häufiger gezogen;
- eine **Schwäche**, die Balance und Identität zugleich schafft;
- einen **Archetyp**: *Belagerer* (Sieg durch Zerstörung), *Stürmer* (Sieg durch Eroberung), *Bollwerk* (Verteidigung, Heilung, Konter), *Tüftler* (Utility, XP, Wildcard).

**Erwartetes Verhältnis (per Bot-Sim zu prüfen):** Stürmer schlagen Belagerer (sie dringen auf die Plattformen vor), Belagerer schlagen Bollwerk (sie zermürben), Bollwerk schlägt Stürmer (Verteidiger und Heilung). Tüftler sind Allrounder mit hoher Varianz.

**Kern-Wahl:** verdeckt und gleichzeitig aus allen 12, Spiegelmatch erlaubt. Optionaler Zufallsmodus: 3 Kerne werden angeboten. **P2:** je Kern 2 exklusive **Signaturkarten** und ein eigener Baustil.

### 9.2 Welt-Launen (P2)

Optional wählt das Spiel (oder die Spieler) vor dem Match eine **Welt-Laune**, eine kleine globale Regeländerung mit sichtbarem Wetter und Ausbrüchen (*Froschregen, Käsemond, Schwerkraft-Schluckauf …*). 12 Stück in Katalog 03. Sie sorgen für Wiederspielwert und das Gefühl einer verrückten Welt, ohne die Grundregeln zu brechen.

### 9.3 Chaos-Karten (P2)

Einmalige Effekt-Karten (*Meteor, Zeitriss, Froschregen, Notfall-Reparatur*). Erst nach Prototyp entscheiden, ob sie das Spiel bereichern oder verwässern.

---

→ Weiter mit [`GDD-Praesentation-Technik.md`](GDD-Praesentation-Technik.md): Pixel-Art-Richtlinien, Zeitstopp-Regie, UI, Technik, Roadmap, offene Fragen.
