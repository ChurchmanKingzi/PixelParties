# Katalog 03 — Kerne, Welt-Launen, Chaos-Karten, Baustile

Teil des [GDD](../GDD.md). Alles hier ist 🟨 **Ergänzung / Vorschlag** und streichbar. Der Kern des Spiels funktioniert auch mit einem einzigen Standardkern. Alle Werte sind ⚙ Startwerte.

---

## KE — Kern-Typen (P1)

Jeder Kern hat eine **Passive** und eine **aktive Fähigkeit**, die man per Klick während der Schlacht auslöst. Das ist der einzige Echtzeit-Eingriff (GDD §9.1). Zu Beginn bietet das Spiel 3 zufällige Kerne an, man wählt einen.

**Gemeinsam:** Kern-HP 5000 · 2 × 2 Zellen · Regeneration 2 HP/s · die Fähigkeit lädt sich während der Pausen **nicht** auf (die Zeit steht), nur im Kampf.

| ID | Name | Passive | Aktive Fähigkeit (Abklingzeit) | Look |
|---|---|---|---|---|
| KE-00 | **Schlichter Kern** | – | – (Standardkern für den ersten Prototyp) | Rosa Kristall, pulsiert gemächlich. |
| KE-01 | **Sonnenkuchen-Herz** | Eigener Feuerschaden +10 %. | **Sonnenstoß** (80 s): Alle Feinde in der Kernkammer und den Nachbarzellen erleiden 180 Feuer, **Brennen**, Rückstoß 3. | Glühender Rosinenkuchen, schwebt und riecht nach Zimt. |
| KE-02 | **Steinherz des Schlafenden Riesen** | Kern-HP +25 %, Mauern +10 % HP. | **Bollwerk** (90 s): 8 s lang erleiden alle Bauteile −50 % Schaden, Reparatur +15 %. | Grauer Fels mit Schnarchblasen. |
| KE-03 | **Kuckucksei** | **Glücksvogel:** Zufallseffekte (Wunschbrunnen, Chaosgeboren, Hexenküche) fallen 25 % öfter positiv aus. | **Wunder-Würfel** (70 s): Zufallseffekt: Vollheilung aller · Feindeinheiten im Feld 3 s Frosch · +100 XP für alle · feindliche Artillerie 6 s Ladehemmung · eigene Truppen +30 % Tempo (10 s). | Gesprenkeltes Ei, aus dem manchmal ein Küken guckt. |
| KE-04 | **Frostherz** | Kernkammer-Kälteaura (Feinde −20 % Tempo); Feuerschaden an eigenen Bauteilen −20 %. | **Kältewelle** (85 s): Alle Feinde in Bastion und Feld sind **Eisig**, **Eingefroren** 2 s. | Eiskristall, Schneeflocken pulsen im Takt. |
| KE-05 | **Uhrwerk-Herz** | +5 s Bauzeit in jeder Pause. | **Zeitblase** (75 s): Radius 3 um den Kern für 6 s: Feinde ×0,3 Tempo, Freunde ×1,3. | Taschenuhr, die tickt und manchmal rückwärts läuft. |
| KE-06 | **Wurzelherz** | Alle Bauteile regenerieren 1 HP/s. | **Wurzelschlag** (80 s): Alle Eindringlinge in der Bastion sind 3 s **Festgehalten** und erleiden 25 Gift. | Herz mit Wurzeln und einer kleinen Blüte. |
| KE-07 | **Spukherz** | 10 % der in der Bastion gefallenen Eindringlinge stehen für dich als Geist auf (10 s). | **Gespensterheulen** (80 s): Alle Feinde in der Bastion fliehen 4 s (**Furcht**). | Leuchtender Kürbis, aus dem Geister aufsteigen. |
| KE-08 | **Schwatzendes Herz** | **Gerüchteküche:** Alle Einheiten erhalten +10 % XP. | **Schlagzeile** (70 s): Schlachtruf: eigene Einheiten +25 % Angriffstempo (8 s) und +10 XP. | Herz mit Mund, das ununterbrochen Sprechblasen schwatzt. |

---

## WL — Welt-Launen (P2)

Optionale Match-Modifikatoren. Eine Laune wird zufällig gewählt (oder vorab von den Spielern vereinbart), sie bleibt das ganze Match über sichtbar am Himmel. **Dauerhaft** = gilt immer. **Ausbruch** = Ereignis in festen Abständen, das vorher 2 s lang angekündigt wird (Himmel verfärbt sich, Warnsymbol), damit das Chaos lesbar bleibt. Die Pause zählt die Ausbruch-Timer nicht weiter.

| ID | Name | Dauerhaft | Ausbruch | Himmel / Look |
|---|---|---|---|---|
| WL-00 | **Ruhiger Tag** | – | – | Blauer Himmel, eine einzige, sehr zufriedene Wolke (Turnier-/Trainingsmodus). |
| WL-01 | **Froschregen** | Brennen erlischt nach 2 s (alle). Blitz ×1,25 (Nass). | Alle 45 s: 3 zufällige Einheiten werden 4 s zu Fröschen. | Regen aus winzigen Fröschen, platsch. |
| WL-02 | **Käsemond** | Reichweite aller Artillerie +3. | Alle 60 s **Mondschmaus:** Alle Einheiten heilen 5 % Max-HP. | Tiefhängender gelber Mond mit Löchern; Mäuse klettern daran. |
| WL-03 | **Schwerkraft-Schluckauf** | – | Alle 40 s 3 s Schwerelosigkeit: Einheiten schweben (greifen nicht an), Geschosse fliegen gerade (Flugzeit ×0,7). | Staubkörner treiben aufwärts. |
| WL-04 | **Wandernde Nebelbank** | Streuung aller Artillerie ×1,5; Turmreichweite −2. | – | Rosa Nebel, im Dunst klingen Kuhglocken. |
| WL-05 | **Zuckerwatte-Wind** | Wind schiebt Geschosse eine Zelle seitlich (Richtung wechselt alle 30 s). Pudding-Bauteile erleiden ×0,8 Schaden. | – | Ziehende Zuckerwattewolken, klebrige Windfahnen. |
| WL-06 | **Rhythmusbeben** | – | Alle 8 s „Beat“: Bauteile verlieren 1 % Max-HP, Bodeneinheiten stolpern (−10 % Tempo, 1 s). Flieger unberührt. | Der Boden pulsiert im Takt der Musik. |
| WL-07 | **Zwergenstreik** | Zivilisten arbeiten −25 %, Köche und Kantinen +50 %. | Alle 60 s wird ein zufälliger Posten 10 s bestreikt. | Protestschilder auf Wolken („Mehr Suppe“). |
| WL-08 | **Vollmond-Heulen** | Gruft- und Tier-Einheiten +15 % Schaden; Segen- und Flora-Einheiten −10 %. | Alle 70 s Heulen: 20 % Furcht-Chance bei Zivilisten (3 s). | Riesiger Mond mit Wolfssilhouette. |
| WL-09 | **Glitzerstaub** | Arkan-Schaden +25 %, Kristall-Bauteile +15 % Wirkung; Metall-Bauteile −10 % HP. | – | Funkelnde Staubwolke, die in den Augen kitzelt. |
| WL-10 | **Drachenzug** | – | Alle 60 s ziehen Drachen vorbei und sengen eine zufällige Zelle jeder Bastion (80 Feuer, Brennen). | Drachensilhouetten, Feuerstreifen am Himmel. |
| WL-11 | **Riesen-Nieser** | – | Alle 70 s: Alle Einheiten im Niemandsland werden zufällig um ±3 Zellen versetzt; Geschosse in der Luft landen in einer Nachbarzelle. | Ein Wolkengesicht, das nach hinten ausholt. |
| WL-12 | **Zeitwackeln** | Die Spielgeschwindigkeit schwankt sanft zwischen ×0,8 und ×1,25 (Wechsel alle 20 s). Pausen unverändert. | – | Uhren am Himmel, die sich in beide Richtungen drehen. |

**Biom-Paarungen (Vorschlag):** Pilzmoor → Froschregen / Nebelbank · Zuckerwatte-Wüste → Zuckerwatte-Wind · Schwebende Steine → Schwerkraft-Schluckauf · Kuchenlava-Ebene → Drachenzug / Käsemond · Verkehrter Wasserfall-Canyon → Rhythmusbeben / Glitzerstaub.

---

## CK — Chaos-Karten (Ideen, P2)

Einmalige Effekt-Karten, die man in der Pause zieht und **sofort** spielt (Effekt tritt beim Auftauen ein). Erst nach dem Prototyp entscheiden, ob sie dem Spiel guttun.

| ID | Name | Effekt |
|---|---|---|
| CK-01 | **Notfall-Reparatur** | Alle Bauteile werden um 30 % ihrer Max-HP repariert. |
| CK-02 | **Zauberkeks** | Alle Einheiten heilen 40 % Max-HP und erhalten +25 XP. |
| CK-03 | **Meteor auf Bestellung** | 150 Arkan (Radius 2) auf ein gewähltes Bauteil des Gegners; Sonderkarte, die nur exponierte Zellen trifft. |
| CK-04 | **Doppelgänger** | Klont eine eigene Einheit (volle HP) für eine Welle. |
| CK-05 | **Zeitriss** | Beim Auftauen sind alle Feinde 3 s eingefroren. |
| CK-06 | **Erdbeben** | Alle Bauteile beider Bastionen verlieren 10 % HP. |
| CK-07 | **Gratis-Umzug** | Die nächsten 3 Umbauten in dieser Pause kosten nichts (Verschieben ohne Limit). |
| CK-08 | **Froschregen-Karte** | Alle gegnerischen Bürger werden 6 s zu Fröschen (Betriebsgrad bricht ein). |

---

## Baustile (nur Optik, P2)

Jeder Spieler wählt vor dem Match einen **Baustil**, der Mauerwerk, Dachziegel und Fundament neu einfärbt und leicht verformt, ohne Spielwerte zu ändern. Hilft dem Gegner, die Bastionen auf einen Blick zu unterscheiden.

| Baustil | Look |
|---|---|
| **Pilzburg** | Riesenpilze als Türme, Lamellen als Dächer, Sporenschimmer. |
| **Kuchenfestung** | Zuckerguss-Zinnen, Kirschen als Spitzen, Sahne als Schnee. |
| **Kürbis-Bastion** | Orange Rundungen, Gesichter in jeder Fensterhöhle. |
| **Eisbonbon-Zitadelle** | Durchscheinende, bunte Zuckerglas-Mauern. |
| **Zahnrad-Turm** | Genietetes Metall, rotierende Räder, Dampfausstöße. |
| **Wolkenschloss** | Weiche weiße Blöcke, Regenbogen als Zugbrücke. |
