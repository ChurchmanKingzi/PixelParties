# Katalog 03 — Kerne, Welt-Launen, Chaos-Karten, Baustile

Teil des [GDD](../GDD.md), Stand v0.3. Alles hier ist 🟨 **Ergänzung / Vorschlag** und streichbar. Der Kern des Spiels funktioniert auch mit einem einzigen Standardkern (KE-00). Alle Werte sind ⚙ Startwerte.

**Bestand:** 12 Fraktions-Kerne (+ Standardkern) · 13 Welt-Launen (inkl. „Ruhiger Tag“) · 8 Chaos-Karten · 6 Baustile.

---

## KE — Fraktions-Kerne (P1)

Der Kern ist zugleich die **Fraktion** des Spielers (GDD §9.1). Er legt fest, **wie man gewinnen will**, und gibt der Bastion ein eigenes Gesicht.

**Was jeder Kern mitbringt**

| Baustein | Bedeutung |
|---|---|
| **Archetyp** | Belagerer · Stürmer · Bollwerk · Tüftler (siehe unten). |
| **Hauptlinie + Kern-Anbau** | Die Hauptlinie ist vom Start an freigeschaltet. Der passende Freischalt-Raum steht **kostenlos als Kern-Anbau in ★2-Qualität** in der Bastion (als Modul an einer Außenkante des Kernhofs, beim Erstaufbau frei verschiebbar). Karten dieser Linie werden ×2 häufiger gezogen. |
| **Nebenlinie** | Karten dieser Linie werden ×1,5 häufiger gezogen; der Freischalt-Raum muss gebaut werden. |
| **Passive** | Wirkt immer. |
| **Aktive Fähigkeit** | Ein Klick in der Schlacht, danach Abklingzeit. Der einzige Echtzeit-Eingriff. Die Abklingzeit läuft nur im Kampf, nicht in der Pause. |
| **Schwäche** | Der Preis für die Stärke. |
| **Gemeinsam** | Kern-HP 5000 (sofern nicht anders genannt) · 2 × 2 Zellen · Regeneration 2 HP/s. |

### Die vier Archetypen

| Archetyp | Siegweg | Spielgefühl | Kerne |
|---|---|---|---|
| **Belagerer** | Zerstörung | Geduldig, wirkt aus der Ferne. Viele Geschützplätze, wenig Nahkampf. | KE-01 · KE-02 · KE-03 |
| **Stürmer** | Eroberung | Schnell, riskant, lebt von Rückzug und Wiederkehr (XP-Schleifen). | KE-04 · KE-05 · KE-06 |
| **Bollwerk** | Konter und Abnutzung | Unverrückbar, heilt, lässt den Gegner an Mauern und Verteidigern scheitern. | KE-07 · KE-08 · KE-09 |
| **Tüftler** | Wildcard | Zufall, XP, Reparatur. Hohe Varianz, kreative Bauten. | KE-10 · KE-11 · KE-12 |

**Erwartetes Verhältnis (per Bot-Sim zu prüfen):** Stürmer schlagen Belagerer (sie dringen auf die Plattformen vor und töten das Personal) · Belagerer schlagen Bollwerk (sie zermürben aus der Ferne) · Bollwerk schlägt Stürmer (Verteidiger und Heilung). Tüftler verlieren selten klar, gewinnen aber auch selten klar.

### Überblick

| ID | Kern | Archetyp | Hauptlinie (Kern-Anbau) | Nebenlinie | Spielidee |
|---|---|---|---|---|---|
| KE-00 | **Schlichter Kern** | – | – | – | Standardkern für den ersten Prototyp. |
| KE-01 | **Sonnenkuchen-Herz** | Belagerer | Technik (BF-04 Belagerungswerkstatt) | Arkan | Feuer, Brandmunition, ein Hagel aus Kanonen. Alles brennt, auch das eigene Holz. |
| KE-02 | **Uhrwerk-Herz** | Belagerer | Luft (BF-08 Luftdock) | Technik | Präzision und Zeit: kaum Streuung, Schläge, die Schilde ignorieren; Luftschiffe als Plattformen der Wahl. |
| KE-03 | **Sternenstaub-Herz** | Belagerer | Arkan (BF-02 Arkanum) | Luft | Magie vom Himmel: Meteore und Senkrechtschüsse, aber brüchige Mauern. |
| KE-04 | **Frostherz** | Stürmer | Frost (BF-06 Eisgrotte) | Tier | Schnelle Eis-Stürmer; die Kältewelle ist der Startschuss für den Sturm. |
| KE-05 | **Spukherz** | Stürmer | Gruft (BF-05 Gruft) | Chaos | Untote stehen wieder auf; Furcht in der Bastion macht die Kernkammer sturmreif. |
| KE-06 | **Rudelherz** | Stürmer | Tier (BF-03 Menagerie) | Waffen | Tiere schlagen im Rudel härter zu; der Jagdruf kennt keinen Rückzug. |
| KE-07 | **Steinherz des Schlafenden Riesen** | Bollwerk | Waffen (BF-01 Kaserne) | Technik | Mauern, Verteidiger, Zeit: Wer die Kernkammer will, braucht Geduld. |
| KE-08 | **Wurzelherz** | Bollwerk | Flora (BF-07 Gewächshaus) | Segen | Die Bastion wächst und heilt sich selbst; Wurzeln halten Eindringlinge fest. |
| KE-09 | **Lichtherz** | Bollwerk | Segen (BF-09 Tempel der Heiterkeit) | Arkan | Gesegnete Verteidiger, Heilwellen, kaum zu erobern, wenig Feuerkraft. |
| KE-10 | **Kuckucksei** | Tüftler | Chaos (BF-10 Chaoskabinett) | Luft | Zufall als Strategie: Wunder, Frösche, Tier-IV-Karten früher. |
| KE-11 | **Schwatzendes Herz** | Tüftler | Waffen (BF-01 Kaserne) | Arkan | XP-Fraktion: Truppen werden schneller zur Elite, Rangaufstiege heilen. |
| KE-12 | **Schrottherz** | Tüftler | Technik (BF-04 Belagerungswerkstatt) | Chaos | Reparatur-Maschine: Bauteile kommen zurück, bevor der Gegner jubelt. |

### Fähigkeiten im Detail

| ID | Passive | Aktive Fähigkeit (Abklingzeit) | Schwäche | Look |
|---|---|---|---|---|
| KE-01 | **Backofen:** Feuerschaden +15 %; Artillerietreffer setzen **Brennen** (3 s). | **Feuerregen** (90 s): 8 s lang −50 % Nachladezeit für die gesamte eigene Artillerie. | **Hitzestau:** Eigene Holz- und Organisch-Bauteile haben −15 % HP. | Glühender Rosinenkuchen mit Zuckerguss, schwebt und duftet nach Zimt. |
| KE-02 | **Präzision:** Streuung aller Artillerie −40 %; +5 s Bauzeit je Pause. | **Zeitriss-Salve** (80 s): Der nächste Schuss jeder Artillerie schlägt sofort ein (ohne Flugzeit) und ignoriert Schilde und Kuppeln. | **Taktgeber:** Spawn-Staffelung +0,3 s, Bürger-Nachwuchs alle 7 s. | Taschenuhr, die tickt und manchmal rückwärts läuft. |
| KE-03 | **Kosmisches Gespür:** Arkan- und Senkrecht-Schaden +20 %; eigener Zielschatten 0,5 s kürzer. | **Meteorschauer** (90 s): 5 Meteore (je 100 Arkan, Radius 1) auf zufällige gegnerische Zellen innerhalb von 6 s. | **Sternenstaub im Mörtel:** Eigenes Mauerwerk −15 % HP. | Funkelnder Kristall, um den kleine Sterne kreisen. |
| KE-04 | **Frostpfad:** Eigene Sturmtruppen +10 % Tempo auf dem Feld; Feinde in ihrer Nähe −10 % Tempo. | **Kältewelle** (85 s): Alle Feinde im Feld **Eisig** und 2 s **Eingefroren**; eigene Sturmtruppen +25 % Tempo (6 s). | **Kalte Hände:** Heilquellen −20 % Heilrate. | Eiskristall, Schneeflocken pulsieren im Takt. |
| KE-05 | **Wiedergänger:** Gefallene eigene Sturmtruppen stehen mit 15 % Chance als Skelett (10 s, 50 % HP) neben der Leiche auf, auch auf dem Feld. | **Gespensterheulen** (80 s): Alle Feinde in der Bastion fliehen 4 s (**Furcht**). | **Lichtscheu:** Heilgebäude −25 % Wirkung. | Leuchtender Kürbis, aus dem Geister aufsteigen. |
| KE-06 | **Rudelgeist:** Tier-Truppen +15 % HP; Sturmtruppen mit mindestens 3 Verbündeten im Umkreis 3 schlagen +10 % härter zu. | **Jagdruf** (70 s): 8 s lang alle Sturmtruppen +30 % Tempo und +20 % Schaden; sie **ignorieren den Rückzug**. | **Laut:** Artillerie-Reichweite −4. | Schlagendes Herz mit Fell und Zähnen. |
| KE-07 | **Unverrückbar:** Kern-HP +25 %, Mauern +15 % HP, Verteidiger +10 % HP. | **Bollwerk** (90 s): 8 s lang −50 % Schaden an Bauteilen und Verteidigern; Reparatur +15 %. | **Schwere Stiefel:** Eigene Sturmtruppen −10 % Tempo. | Grauer Fels mit Schnarchblasen. |
| KE-08 | **Wachsende Festung:** Alle Bauteile regenerieren 1 HP/s; Heilquellen +15 % Heilrate. | **Wurzelschlag** (80 s): Alle Eindringlinge in der Bastion sind 3 s **Festgehalten** und erleiden 25 Gift. | **Holz brennt:** Feuerschaden gegen eigene Bauteile +25 %. | Herz mit Wurzeln und einer kleinen Blüte. |
| KE-09 | **Heiterkeit:** Verteidiger und Zivilisten beginnen jede Welle **Gesegnet** (40); Eroberungsfortschritt in der eigenen Kernkammer −25 %. | **Heiliger Schein** (85 s): Alle Freunde in der Bastion heilen 30 % und verlieren alle Debuffs. | **Gnade statt Wucht:** Artillerie −10 % Schaden. | Weich leuchtendes Herz mit Heiligenschein. |
| KE-10 | **Glücksvogel:** Zufallseffekte fallen 25 % öfter positiv aus; ab Pause 5 Tier-IV-Gewicht +50 %. | **Wunder-Würfel** (70 s): Zufallseffekt: Vollheilung aller · Feindeinheiten im Feld 3 s Frosch · +100 XP für alle · feindliche Artillerie 6 s Ladehemmung · eigene Truppen +30 % Tempo (10 s). | **Unzuverlässig:** 10 % der Aktivierungen schlagen fehl (Frosch statt Wunder). | Gesprenkeltes Ei, aus dem manchmal ein Küken guckt. |
| KE-11 | **Gerüchteküche:** +20 % XP für alle; Rang-Aufstieg heilt 40 % statt 25 %. | **Schlagzeile** (70 s): Schlachtruf: eigene Einheiten +25 % Angriffstempo (8 s) und +15 XP. | **Dünnhäutig:** Kern-HP −15 %. | Herz mit Mund, das ununterbrochen Sprechblasen schwatzt. |
| KE-12 | **Recycling:** Wiederaufbau kostet 20 % statt 40 % Arbeit; Bau-Gnome +25 % Tempo. | **Großreinemachen** (75 s): Alle Bauteile werden um 25 % repariert, alle Trümmer sofort wiederaufgebaut (40 % HP). | **Pfusch am Bau:** Neu gebaute Bauteile starten nach der Pause mit 75 % HP. | Herz aus Schrott, Kabel und einem Eimer. |

**Ausbau (P2):** Je Kern 2 exklusive **Signaturkarten** (ein Bauteil, eine Einheit) und ein eigener **Baustil**.

---

## WL — Welt-Launen (P2)

Optionale Match-Modifikatoren. Eine Laune wird zufällig gewählt (oder vorab von den Spielern vereinbart), sie bleibt das ganze Match über sichtbar am Himmel. **Dauerhaft** = gilt immer. **Ausbruch** = Ereignis in festen Abständen, das vorher 2 s lang angekündigt wird (Himmel verfärbt sich, Warnsymbol), damit das Chaos lesbar bleibt. Die Pause zählt die Ausbruch-Timer nicht weiter.

| ID | Name | Dauerhaft | Ausbruch | Himmel / Look |
|---|---|---|---|---|
| WL-00 | **Ruhiger Tag** | – | – | Blauer Himmel, eine einzige, sehr zufriedene Wolke (Turnier-/Trainingsmodus). |
| WL-01 | **Froschregen** | Brennen erlischt nach 2 s (alle). Blitz ×1,25 (Nass). | Alle 45 s: 3 zufällige Einheiten werden 4 s zu Fröschen. | Regen aus winzigen Fröschen, platsch. |
| WL-02 | **Käsemond** | Reichweite aller Artillerie +6. | Alle 60 s **Mondschmaus:** Alle Einheiten heilen 5 % Max-HP. | Tiefhängender gelber Mond mit Löchern; Mäuse klettern daran. |
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
| CK-03 | **Meteor auf Bestellung** | 150 Arkan (Radius 2) auf eine gewählte Zelle des Gegners (Zielschatten 2 s). |
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
