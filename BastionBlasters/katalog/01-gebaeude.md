# Katalog 01 — Gebäude (Bau-Karten)

Teil des [GDD](../GDD.md), Stand v0.3 (**Draufsicht, modulare Bastion, Karte 56 × 28 Zellen**). Alle Werte sind ⚙ **Startwerte zum Tunen**, keine Endwerte.

**Bestand:** **77 Bauteile** in 9 Kategorien · Strukturen 9 · Türme 8 · Heilung 7 · Werkstätten 11 · Freischalt-Räume 10 · Plattformen 6 · Utility 11 · Abwehr 6 · Chaos 9 · Tiers: I 22 · II 36 · III 13 · IV 6.

## Lesehilfe

| Spalte | Bedeutung |
|---|---|
| **ID** | `BS` Struktur · `BT` Turm · `BH` Heilung · `BW` Werkstatt · `BF` Freischalt-Raum · `BP` Plattform · `BU` Utility · `BA` Abwehr gegen Artillerie · `BC` Chaos |
| **Größe** | **Modul** `B×H`: Raum aus Zellen (mindestens 2 tief), 1 Zelle = 32 × 32 px · **Turm 1×1**: massive Turmzelle an Außenkante/Ecke · **Obj `B×H`**: Objekt auf Hof- oder Modulzellen ohne eigene Wände · **Kante**: Mauersegmente (8 px dünn, 32 px lang) · **Tor**: Tor-Karte auf einer Kante. Alles ist **drehbar** (90°-Schritte). Regeln: GDD §4.1. |
| **T** | Tier I–IV (Ziehgewichte: GDD §5.2). |
| **Material · HP** | Material bestimmt Resistenzen (GDD §7.3); HP gilt für das ganze Modul bzw. **je Mauersegment** (bei ★2: +50 %, ★3: +100 %). |
| **⚙** | **Posten** = benötigtes Personal (GDD §4.6). `–` bzw. `0` = läuft ohne Personal. |
| **Effekt** | Wirkung bei voller Besetzung; Teilbesetzung wirkt anteilig. Zahlen sind für Rang ★1. |
| **Regeln / Tags** | Platzierungsregeln in `[ ]`: **[Außen]** berührt eine Außenkante · **[Innen]** ganz von Hof und Modulen umgeben · **[Front]** Außenkante zum Gegner · **[Ecke]** vorspringende Ecke der Silhouette (GDD §4.1, §4.2). Danach Tags für Nachbarschaft (GDD §4.8). |
| **Look** | Pixel-Idee für die Grafik (Silhouette + Witz). |

Begriffe: **Fest** = nicht begehbar (Mauersegment, Turmzelle, Kern). **Raum** = begehbares Modul. **Nachbar** = Modul, das mit einer Kante angrenzt. **Radius** misst in Zellen vom Mittelpunkt. **Heilquelle** = zählt für die Rückzugsregel (GDD §6.5). **Beute** = lockt Plünderer. **Behandlungsplatz** = Patient in einer Heilquelle.

---

## BS — Strukturen (Mauern, Fallen, Tore)

**Mauerwerk (BS-01) setzt sich automatisch** an jede Außenkante und zwischen verschiedene Module (GDD §4.1); es wird nie gezogen. **BS-02 … BS-04** sind **Wandkarten**: Sie ersetzen **bis zu 4 zusammenhängende Segmente**. **BS-05, -06, -08, -09** sind **Objekte** (stehen auf Hofzellen), **BS-07** ist eine **Tor-Karte**.

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BS-01 | **Mauerwerk** | Kante | I | Stein · 300 je Segment | – | Fest. Blockiert Wege und Schusslinien, schluckt Beschuss. **Automatisch an jeder Außen- und Modulkante, kostenlos, wird nie gezogen.** | Wehr | Moosige Quader, Fugen mit Dither-Schatten, in jeder Ritze wohnt ein Käfer. |
| BS-02 | **Puddingwand** | Kante ≤4 | I | Pudding · 260 je Segment | – | Fest. **Flächenschaden (Splash) geht nicht durch sie hindurch.** Nahkämpfer, die sie angreifen, werden −20 % langsamer (kleben). | Wehr · Feuer ×1,3 | Wackelnde Götterspeise in Teamfarbe, eine Kirsche obendrauf. |
| BS-03 | **Panzermauer** | Kante ≤4 | II | Metall · 450 je Segment | – | Fest. Wucht und Gift −30 % zusätzlich. | [Außen] · Wehr | Genietete Platten, Rost-Dither, ein Gesicht im Niet. |
| BS-04 | **Bannmauer** | Kante ≤4 | II | Kristall · 260 je Segment | – | Fest. Arkan und Blitz −50 % zusätzlich. | [Außen] · Wehr, Magie | Violette Rune pulsiert, Kristallsplitter rieseln. |
| BS-05 | **Stachelflur** | Obj 1×1 | I | Metall · 250 | – | Objekt. Feinde, die hindurchlaufen: 10 Wucht/s und −20 % Tempo. Freunde unberührt. | Wehr | Nagelbett mit Zahnrad, Schild „Vorsicht, Bett“. |
| BS-06 | **Fallgrube** | Obj 1×1 | I | Stein · 200 | – | Objekt. Die ersten 2 Feinde je Welle fallen hinein: 60 Wucht und 4 s Betäubt. Flieger und Geister unberührt. | Wehr | Dunkles Loch mit Dornen, Warnschild „Bitte nicht“. |
| BS-07 | **Fallgatter-Tor** | Tor | II | Metall · 500 | – | Ersetzt das Haupttor (Tor-Karte). Alle 30 s fällt das Gatter, sobald ein Feind im Torraum steht: 100 Wucht auf alle darunter, Eingang 5 s versperrt. | [Front] · Wehr | Eiserne Zähne, quietschende Ketten, ein Hund darunter bellt mutig. |
| BS-08 | **Drehtür-Irrgarten** | Obj 2×1 | II | Holz · 300 | – | Objekt. Feinde, die darüberlaufen: Verwirrt 3 s, danach 10 s immun. | Wehr, Chaos | Drehtüren, Pfeile im Kreis, ein einsamer Hut auf dem Boden. |
| BS-09 | **Löschteich** | Obj 1×1 | I | Stein · 250 | – | Objekt. Entfernt Brennen von Einheiten und Bauteilen im Radius 3; Feuerschaden auf Bauteile im Radius 3 −50 %. | Wehr | Teich mit Ente, die einen Schwimmreifen trägt. |

---

## BT — Türme (beschießen Feinde im Feld und in der Nähe)

Alle Türme: **1 × 1**, massive **Turmzelle an der Außenkante [Außen]**, **1 Posten**, zielen **nur auf Einheiten** (nie auf Bauteile). **Ecktürme [Ecke]** haben +1 Reichweite und +10 % HP. Reichweite in Zellen.

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BT-01 | **Pfeilturm** | Turm 1×1 | I | Holz · 300 | 1 | Reichweite 7. 12 Wucht / 1,2 s. **+50 % Schaden gegen Fliehende.** | [Außen] · Wehr, Leicht-Entflammbar | Wackeliger Holzturm, Köcher als Dach, der Schütze winkt. |
| BT-02 | **Gloop-Turm** | Turm 1×1 | I | Pudding · 300 | 1 | Reichweite 5. Schleimball: 6 Gift + **Schleim** (4 s), Splash 1, alle 2 s. | [Außen] · Wehr | Grüner Schleimturm, Gießkanne als Kanone, tropft ständig. |
| BT-03 | **Frostschlot** | Turm 1×1 | II | Eis · 300 | 1 | Kegel, Reichweite 3. 14 Eis/s dauerhaft, **Eisig** 4 s. | [Außen] · Wehr | Schornstein, aus dem Schnee quillt; Eiszapfenbart. |
| BT-04 | **Zirp-Zauberturm** | Turm 1×1 | II | Kristall · 280 | 1 | Reichweite 6. 22 Arkan / 2 s, **durchschlägt bis zu 3 Ziele** in einer Linie. | [Außen] · Wehr, Magie | Schiefer Turm mit Spitzhut, Fenster blinzeln. |
| BT-05 | **Hornissenturm** | Turm 1×1 | II | Organisch · 260 | 1 | Beschwört 3 Hornissen (Flug, 12 HP, 4 Wucht / 0,8 s, Leine 6 Zellen); Ersatz alle 8 s. | [Außen] · Wehr, Tier | Papierwespennest als Turm, Hornissen mit Miniatur-Lanzen. |
| BT-06 | **Gewitterspitze** | Turm 1×1 | III | Metall · 350 | 1 | Alle 4 s Blitz auf ein zufälliges Feindziel (Reichweite 7): 55 Blitz, springt auf 2 weitere (50 %). Blitz-immun. Gegen **Nasse** ×1,5. | [Außen] · Wehr, Magie | Eisenspitze mit Wolke obendrauf, der Blitz lächelt. |
| BT-07 | **Pelikan-Flaknest** | Turm 1×1 | II | Holz · 200 | 1 | **Nur gegen Flieger:** Reichweite 8, 18 Wucht (×2 gegen Flug) / 1,5 s. | [Außen] · Wehr, Tier | Nest mit Pelikan, der Fische schleudert. |
| BT-08 | **Leuchtfeuer der Verwirrung** | Turm 1×1 | III | Kristall · 320 | 1 | Strahl überstreicht das Feld (Reichweite 8): getroffene Feinde **Verwirrt** 2 s (alle 6 s je Ziel); **deckt Unsichtbare auf.** | [Außen] · Wehr, Magie | Leuchtturm mit Regenbogenstrahl, Möwe als Wetterfahne. |

---

## BH — Heilung & Versorgung (Heilquellen für den Rückzug)

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BH-01 | **Krankenstation** | 3×2 | I | Holz · 300 | 1 | **3 Behandlungsplätze**, 6 HP/s je Patient. Heilquelle. | Heil, Leicht-Entflammbar | Betten mit Zipfelmützen, Kreuz in Teamfarbe, Thermometer als Fahne. |
| BH-02 | **Feldlazarett** | Obj 1×1 | I | Holz · 180 | 1 | 1 Platz, 8 HP/s. Heilquelle. | Heil, Leicht-Entflammbar | Flickenzelt mit Kreuz-Flagge, Ziehharmonika als Alarm. |
| BH-03 | **Badehaus** | 3×2 | II | Stein · 350 | 1 | 4 Plätze, 4 HP/s. Entfernt beim Betreten **Brennen, Gift, Schleim, Verflucht**; „Frisch gebadet“ +8 % Tempo (20 s). Heilquelle. | Heil | Dampfwolken, Gummienten, Troll mit Handtuchturban. |
| BH-04 | **Heilpilz-Garten** | Obj 1×1 | II | Organisch · 220 | 0 | Aura: 3 HP/s für Freunde im Radius 3. **Kapazität 2** für die Rückzugsregel. Heilquelle. Feuer ×2. | Heil, Leicht-Entflammbar | Rote Pilze mit weißen Punkten und Gesichtern, die sich ständig entschuldigen. |
| BH-05 | **Zahnklempner** | 2×2 | II | Metall · 260 | 1 | 1 Platz, 20 HP/s. Patient erhält +8 XP („Schmerz macht stark“) und verliert alle Debuffs. Heilquelle. | Heil, Technik | Stuhl, Zange, Lampe; der Patient grinst mit Goldzahn. |
| BH-06 | **Brunnen der ewigen Jugend** | 3×3 | III | Stein · 600 | 0 | 6 Plätze, 5 HP/s; zusätzlich Aura 2 HP/s für alle Freunde in 3 Zellen Umkreis. Heilquelle. | Heil, Magie | Sprudelnder Brunnen, ein Greisengesicht speit Wasser, Putten tanzen. |
| BH-07 | **Phönix-Nest** | 3×3 | IV | Organisch · 450 | 1 | 6 Plätze, 6 HP/s. Heilquelle. **Wiederkehr:** Einheiten, die in der Bastion sterben, steigen nach 5 s mit 50 % HP **und ihrem Rang** wieder auf (je Einheit einmal je Welle). Feuer ×2. | Heil, Magie, Leicht-Entflammbar | Riesiges Nest aus Glut und Federn, ein Küken quiekt Funken. |

---

## BW — Werkstätten & Verstärker

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BW-01 | **Schmiede** | 3×2 | I | Metall · 350 | 1 | Neu gespawnte Sturmtruppen und Verteidiger sind **Gehärtet** (+12 % Max-HP, +10 % Wucht). | Werk, Technik | Amboss, Esse mit Grinsen, Funken regnen. |
| BW-02 | **Rüstkammer** | 3×2 | II | Metall · 350 | 1 | Neu gespawnte Sturmtruppen und Verteidiger erleiden −15 % Schaden. | Werk | Rüstungsständer, die kichern; ein Helm mit Eimer. |
| BW-03 | **Pulverkammer** | 2×2 | I | Holz · 200 | 1 | Artillerie: −12 % Nachladezeit. **Explodiert** bei Zerstörung (80 Feuer, Radius 1). | Werk, Sprengstoff, Leicht-Entflammbar | Fässer mit Totenkopf und Fliege; Schild „Nie rauchen“, ein Gnom raucht. |
| BW-04 | **Feuerwerkerei** | 2×2 | II | Holz · 200 | 1 | Artillerietreffer setzen zusätzlich **Brennen** (3 s). **Explodiert** bei Zerstörung (120 Feuer, Radius 1). | Werk, Sprengstoff | Raketen, Fontänen, Funken in fünf Farben. |
| BW-05 | **Kanonengießerei** | 3×2 | II | Metall · 400 | 1 | Artillerie: +15 % Strukturschaden. | Werk, Technik | Riesiger Schmelztiegel, Rohre trocknen auf einer Wäscheleine. |
| BW-06 | **Runenpresse** | 2×2 | III | Kristall · 300 | 1 | Neu gespawnte Verteidiger und Zivilisten erhalten **Runenhaut**: immun gegen die erste Betäubung/Furcht/Verwirrung, +20 % Arkan-Resistenz. | Werk, Magie | Presse stempelt leuchtende Runen auf Zettel. |
| BW-07 | **Drillplatz** | 3×2 | I | Stein · 300 | 0 | Neu gespawnte Einheiten starten mit +25 XP. Einheiten, die sich hier aufhalten (z. B. Verteidiger-Zone), erhalten +0,6 XP/s. | Werk | Strohpuppen, Hindernisbahn, ein Feldwebel mit Quietsche-Ente. |
| BW-08 | **Akademie der verbotenen Bücher** | 3×2 | II | Holz · 300 | 1 | Alle eigenen Einheiten: **+25 % XP** aus allen Quellen. | Wissen, Leicht-Entflammbar | Bücher fliegen und flüstern, eine Eule als Bibliothekarin. |
| BW-09 | **Trophäenhalle** | 3×2 | II | Stein · 350 | 1 | **Kill-Bonus-XP ×2.** Der Killer erhält „Triumph“ (+10 % Tempo, 5 s). Zählt als **Beute**. | Wissen | Ausgestopfte Gegner, Pokale, Gartenzwerg mit Medaille. |
| BW-10 | **Hexenküche** | 3×2 | II | Metall · 300 | 1 | Neu gespawnte Einheiten bekommen einen zufälligen Trank: Stärke (+25 % Schaden), Eile (+25 % Tempo), Dickhaut (+25 % HP) oder Tarnung (unsichtbar bis zum ersten Treffer, max. 4 s). | Werk, Magie | Brodelnder Kessel, Dampf in Totenkopfform, ein Löffel rührt von allein. |
| BW-11 | **Der Große Hammer** | 3×3 | IV | Metall · 600 | 2 | Neu gespawnte Sturmtruppen und Verteidiger starten auf **Rang 2** (140 XP) und sind **Gehärtet**. | Werk, Technik | Ein Hammer, größer als der Raum, wird von drei Gnomen an Seilen gehoben. |

---

## BF — Freischalt-Räume (schalten Linien frei, GDD §5.3)

Aktiv + besetzt = Linie nutzbar und Spawn-Ort. Fällt der Raum aus, stoppt der Nachschub der Linie (Bestehende bleiben).

| ID | Name | Größe | T | Material · HP | ⚙ | Schaltet frei | Zusatzeffekt | Look |
|---|---|---|---|---|---|---|---|---|
| BF-01 | **Kaserne** | 3×2 | I | Stein · 400 | 0 | **Waffen** | +1 Kontingent-Platz. | Schlafsäle, Tuba bläst Reveille mit Rülpsen. |
| BF-02 | **Arkanum** | 3×3 | II | Kristall · 550 | 1 | **Arkan** | Zaubernde Artillerie: +10 % Reichweite. | Schwebende Bücher, Kristallkugel-Dach, Sternschnuppe im Fenster. |
| BF-03 | **Menagerie** | 3×3 | II | Holz · 500 | 1 | **Tier** | Tier-Truppen +10 % HP; Personal in Nachbarräumen −10 % (Gestank). | Käfige, Heuhaufen, ein Gnom schaufelt Dinge. |
| BF-04 | **Belagerungswerkstatt** | 3×3 | II | Metall · 600 | 1 | **Technik** | +1 Geschützplatz (Werkstattdach). | Zahnräder, Dampfkessel, Riesenhammer-Wippe. |
| BF-05 | **Gruft** | 3×2 | II | Stein · 400 | 1 | **Gruft** | [Innen]. 15 % der in der Bastion gefallenen eigenen Sturm-/Verteidiger-Einheiten stehen als Skelett (12 s, 50 % HP) wieder auf. | Särge mit Kissen, Kerzen, Skelette lesen Zeitung. |
| BF-06 | **Eisgrotte** | 3×2 | II | Eis · 350 | 1 | **Frost** | [Innen]. Feuerschaden an Nachbarzellen −25 %; Frost-Truppen +10 % Schaden. | Kristalleis, Pinguin an der Rezeption. |
| BF-07 | **Gewächshaus** | 3×3 | II | Organisch · 450 | 1 | **Flora** | Bauteile im Radius 2 regenerieren 1 HP/s. | Glaskuppel, Riesenblumen, Gießkannen-Roboter. |
| BF-08 | **Luftdock** | 3×2 | III | Holz · 350 | 1 | **Luft** | [Außen]. +1 Luftplatz (nur für Luft-Artillerie). | Anlegemast, Zeppelin-Ankerseil, Fahne „Luft frei“. |
| BF-09 | **Tempel der Heiterkeit** | 3×3 | II | Stein · 500 | 1 | **Segen** | Jede Welle erhalten 2 zufällige Freunde **Gesegnet** (40). | Lächelnde Statuen, Lichtstrahl, Kollekte-Sparschwein. |
| BF-10 | **Chaoskabinett** | 3×2 | III | Pudding · 300 | 1 | **Chaos** | 10 % der neu gespawnten Einheiten sind **Chaosgeboren** (zufällig: ×1,3 Schaden / ×1,3 HP / +30 % Tempo / 2 HP/s Regeneration). | Schrank, aus dem Dinge herauslugen; die Tür öffnet sich in drei Richtungen. |

---

## BP — Plattformen (Geschützplätze für Artillerie, GDD §6.4)

| ID | Name | Größe | T | Material · HP | ⚙ | Geschützplätze | Besonderheit | Look |
|---|---|---|---|---|---|---|---|---|
| BP-01 | **Zinnenkranz** | 3×2 | I | Stein · 350 | 0 | **2** | [Außen]. Artillerie darauf erleidet −25 % Splash. | Zinnen mit Gesichtern, eine Fahnenreihe. |
| BP-02 | **Geschützdeck** | 3×2 | I | Holz · 300 | 0 | **3** | [Außen]. Leicht entflammbar. | Offene Holzplanken, Seile, Schiffs-Look. |
| BP-03 | **Sternwarte** | Turm 1×1 | II | Kristall · 300 | 1 | **1** | [Außen]. Artillerie der Bastion: **+4 Reichweite**, Streuung −30 %. | Kuppelturm mit Teleskop, Sternkarte, der Mond guckt zurück. |
| BP-04 | **Wolkenanker** | Turm 1×1 | III | Organisch · 150 | 1 | **2** | [Außen]. Plätze auf einer schwebenden Wolke: Flach-Geschosse treffen nicht; nur Bogen/Senkrecht/Luft. | Kleine Gewitterwolke an Ankerkette; Regentropfen als Kanonenkugel. |
| BP-05 | **Bunkerlafette** | Obj 1×1 | II | Stein · 350 | 0 | **1** | [Innen]. Verdeckt: Artillerie darauf ist für Flach-Geschosse nicht treffbar (nur Bogen, Senkrecht, Untergrund). | Betonbunker mit Schießscharte, aus der ein Rohr guckt; auf dem Dach steht ein Gartenzwerg. |
| BP-06 | **Schwebende Festung** | 3×3 | IV | Kristall · 400 | 2 | **4** | [Außen]. Schwebt über der Bastion: Flach-Geschosse treffen nicht, nur Bogen/Senkrecht/Luft. Artillerie darauf: **+8 Reichweite**. | Felsinsel mit Zinnen, ein Wasserfall fließt nach oben. |

---

## BU — Utility, Wohnen, Infrastruktur

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BU-01 | **Wohnhaus** | 3×2 | I | Holz · 300 | 0 | +3 Bürger-Limit; Bürger-Nachwuchs alle 4 s statt 5 s. | Wohn, Leicht-Entflammbar | Stapelbetten, Wäscheleine, ein Hund schnarcht. |
| BU-02 | **Kantine „Zum Taumelnden Troll“** | 3×2 | I | Holz · 300 | 1 | Einheiten im Raum und den Nachbarräumen: **Satt** (+15 % Max-HP, 40 s). Personal in Reichweite arbeitet +20 % schneller. | Wohn, Leicht-Entflammbar | Suppenfässer, ein Troll schunkelt, Würstchen an Fäden. |
| BU-03 | **Reparaturwerkstatt** | 2×2 | I | Holz · 250 | 1 | Repariert alle Bauteile, die mit einer Kante angrenzen (Module, Türme, Mauersegmente), mit 8 HP/s. Bau-Gnome im Radius 5 arbeiten +25 % schneller. | Werk | Hammer, Zange, Schubkarre, ein Mörtelkübel mit Gesicht. |
| BU-04 | **Alarmglocke** | Obj 1×1 | I | Metall · 200 | 1 | Bei Eindringlingen: Verteidiger-Leine ×2, Bürger fliehen sofort zum Panikraum, Eindringlinge werden markiert. | Wehr | Bronzeglocke, ein Gnom schwingt am Seil. |
| BU-05 | **Panikraum** | 3×2 | II | Stein · 700 | 0 | 4 Zivilistenplätze. Insassen sind **unangreifbar**, solange die Tür (350 HP) steht. Dort arbeiten Bürger nicht. | [Innen] · Wehr, Wohn | Bunkertür mit Sehschlitz, Teddybär im Regal, Notvorrat Kekse. |
| BU-06 | **Gnomen-Eilgang** | Obj 3×1 | II | Metall · 300 | 1 | Rollband für Freunde: Sie bewegen sich darin ×3 schneller; Feinde meiden es (Pfad ignoriert es). | Technik | Rollband mit Gnomen auf Rollschuhen, an jedem Ende eine Klingel. |
| BU-07 | **Rutschbahn** | Obj 2×1 | I | Holz · 200 | 0 | Förderfeld in Pfeilrichtung: Alle Einheiten darin (auch Feinde) werden mit Tempo ×2 mitgezogen. Kombinierbar mit Fallgrube und Stachelflur. | Wehr | Wellblech-Rutschbahn mit Wasserspritzern und Jauchzen. |
| BU-08 | **Werbebüro** | 2×2 | II | Holz · 200 | 1 | **+1 Nachschub pro Welle** für alle Sturm-Karten. | Werk | Schreibtisch, Plakat „Sei dabei!“, ein Papagei ruft. |
| BU-09 | **Rückholportal** | Obj 1×1 | III | Kristall · 250 | 1 | Fliehende eigene Einheiten (Rückzug) werden sofort zur nächsten freien Heilquelle teleportiert. | Magie | Kreisförmiges Portal, Zahnräder, Schild „Rückreisende bitte rechts“. |
| BU-10 | **Kuriositätenlager** | 2×2 | I | Stein · 250 | 0 | **+1 Soll** für alle Verteidiger- und Zivilisten-Karten. | [Innen] · Werk | Regale voller Dinge, Krake im Glas, Totenkopf mit Hut. |
| BU-11 | **Chronoschrein** | 3×2 | III | Kristall · 350 | 0 | Beim Zeitstopp **+1 behaltene Karte** (5 ziehen, 4 behalten) und **+10 s** Bauzeit. Mehrere wirken nicht kumulativ. | Magie, Wissen | Sanduhren schweben in der Luft, Uhr mit Gesicht, das Zifferblatt tropft. |

---

## BA — Abwehr gegen Artillerie

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BA-01 | **Schildkuppel-Generator** | Obj 1×1 | III | Kristall · 250 | 1 | Kuppel (Radius 3 Zellen) absorbiert **400 Schaden**; nach dem Bruch 20 s Ladezeit. | Magie | Glitzernde Blase wie eine Seifenblase, der Generator summt. |
| BA-02 | **Dunstkamin** | Obj 1×1 | II | Stein · 250 | 1 | Nebel: Beschuss auf Zellen im Radius 4 hat ×2 Streuung und 30 % Fehlschuss (landet eine Zelle daneben). | Wehr | Schornstein, aus dem rosa Dampf quillt. |
| BA-03 | **Fangnetz-Schleuder** | Obj 1×1 | II | Holz · 220 | 1 | Fängt alle 8 s ein Flach- oder Bogengeschoss ab, das eine Zelle im Radius 4 treffen würde, und wirft es mit 40 % Schaden zum Schützen zurück. | [Außen] · Wehr, Leicht-Entflammbar | Riesiges Fliegennetz, ein Frosch wirft Bälle. |
| BA-04 | **Blitzableiter** | Obj 1×1 | II | Metall · 250 | 0 | Zieht Blitz- und Arkan-Geschosse im Radius 4 auf sich (nimmt 50 % Schaden, der Rest verpufft). | [Außen] · Wehr, Technik | Kupferspitze mit Gesicht, Funken sprühen. |
| BA-05 | **Trampolin-Dach** | Obj 1×1 | II | Pudding · 250 | 0 | Bogen-/Senkrecht-Schaden auf Zellen im Radius 2 −50 %. Flieger können hier nicht landen (werden abgeworfen). | Wehr | Hüpfendes Dach, Federn, ein Gnom springt zum Spaß. |
| BA-06 | **Vergeltungsspiegel** | Obj 1×1 | IV | Kristall · 300 | 1 | Alle 25 s werden 6 s lang alle Flach- und Bogengeschosse im Radius 5 mit 60 % Schaden **zum Schützen reflektiert**. | [Außen] · Magie | Riesiger Standspiegel mit Goldrahmen, das Spiegelbild streckt die Zunge raus. |

---

## BC — Chaos & Verrücktes

| ID | Name | Größe | T | Material · HP | ⚙ | Effekt | Regeln / Tags | Look |
|---|---|---|---|---|---|---|---|---|
| BC-01 | **Wunschbrunnen** | Obj 1×1 | II | Stein · 250 | 0 | Je Welle ein Zufallseffekt: 35 % alle eigenen Einheiten +30 % Heilung · 25 % +40 XP für 3 Einheiten · 20 % +3 Bürger · 20 % nichts (ein Frosch erscheint). Zählt als **Beute**. | Chaos, Magie | Brunnen voller Münzen, ein Frosch auf dem Rand. |
| BC-02 | **Kuckucksuhr** | 2×2 | III | Holz · 300 | 1 | Alle 30 s: der **dem Kern nächste Eindringling** wird zum Tor zurückteleportiert und 2 s betäubt. | Chaos, Technik | Alte Uhr, der Kuckuck trägt Boxhandschuhe. |
| BC-03 | **Drachenei-Brutkasten** | 3×3 | IV | Organisch · 500 | 1 | Nach 2 Zeitstopps schlüpft ein **Drachenjunges** (Sturm; wächst alle 40 s einen Rang bis R3). Fällt es, brütet das Ei erneut (2 Zeitstopps). | Chaos, Tier | Warmes Nest, das Ei trägt eine Tapferkeitsmedaille, es schnarcht. |
| BC-04 | **Schunkelsaal** | 3×2 | II | Holz · 300 | 1 | Feinde im Raum und im Nachbarraum sind alle 8 s für 2 s **Tanzend** (greifen nicht an). | Chaos, Wohn | Karaoke-Bühne, Discokugel, ein Troll am Mikrofon. |
| BC-05 | **Schwerkraft-Umkehrer** | 3×3 | III | Metall · 550 | 1 | Feinde im Raum und den Nachbarräumen schweben 3 s zur Decke (50 % Tempo, kein Angriff) und stürzen dann: 40 Wucht. Abklingzeit 15 s. | Chaos, Technik | Möbel an der Decke, der Teppich hängt herab. |
| BC-06 | **Lebende Schatztruhe** | Obj 1×1 | II | Holz · 200 | 0 | **Köder** für Plünderer. Der erste Feind, der sie öffnet, erleidet 120 Wucht und ist 5 s verschluckt. Zählt als **Beute**. | Chaos | Goldtruhe, Zähne glitzern, die Zunge hängt heraus. |
| BC-07 | **Hüpfhalle** | 3×2 | I | Pudding · 300 | 0 | Feinde im Raum werden alle 4 s 2 Zellen zurückgeschleudert; Freunde unberührt. Besonders gut neben der Kernkammer. | Chaos, Wehr | Gummiboden, Bälle, Kindergelächter. |
| BC-08 | **Teesalon der Zeitlupe** | 3×2 | III | Holz · 300 | 1 | Feinde im Raum: Tempo und Angriffstempo −35 % („Teezeit“). Freunde: +10 %. | Chaos, Wohn | Gedeckter Tisch, Tassen schweben, die Uhr bleibt stehen. |
| BC-09 | **Der Rote Knopf** | Obj 1×1 | IV | Metall · 200 | 0 | **Einmal pro Match** per Klick: Alle Eindringlinge werden zum Tor teleportiert und 3 s betäubt; die eigenen Bauteile verlieren dafür 15 % HP. | Chaos | Roter Knopf unter Glas, Schild „Nicht drücken“, davor schwitzt ein Gnom. |

---

## Anhang

**Beute-Gebäude:** BC-01 Wunschbrunnen · BC-06 Lebende Schatztruhe · BW-09 Trophäenhalle (locken Plünderer, GDD §6.5).
**Sprengstoff-Gebäude:** BW-03 Pulverkammer · BW-04 Feuerwerkerei (explodieren bei Zerstörung, Nachbarschaftsrisiko).
**Heilquellen-Gebäude:** BH-01 … BH-06 (Rückzugsziele). Hinzu kommen Heiler-Zivilisten (Katalog 02).
**Freischalt-Räume:** BF-01 … BF-10 (je ein Raum je Linie, GDD §5.3).
**Kern-Anbau:** Jeder Fraktions-Kern bringt den Freischalt-Raum seiner Hauptlinie kostenlos als Modul mit (★2, Katalog 03), an einer Außenkante des Kernhofs. Zieht man dieselbe Karte, wertet sie ihn auf.
**Bilanz nach Bauart (v0.3):** Module 2×2: 8 · Module 3×2: 23 · Module 3×3: 11 · Turmzellen: 10 · Objekte: 20 · Wandkarten: 3 · Tor-Karte: 1 · Mauerwerk (automatisch): 1 = 77.

**Auswahl für den ersten Prototyp (P0)**, genug für spannende Bastionen mit wenig Aufwand:
BS-01 Mauerwerk · BS-02 Puddingwand · BS-05 Stachelflur · BS-06 Fallgrube · BT-01 Pfeilturm · BT-02 Gloop-Turm · BH-01 Krankenstation · BH-02 Feldlazarett · BW-01 Schmiede · BW-03 Pulverkammer · BW-07 Drillplatz · BF-01 Kaserne · BP-01 Zinnenkranz · BP-02 Geschützdeck · BU-01 Wohnhaus · BU-03 Reparaturwerkstatt · BU-04 Alarmglocke · BC-07 Hüpfhalle.
