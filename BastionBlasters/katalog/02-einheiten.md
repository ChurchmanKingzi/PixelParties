# Katalog 02 — Einheiten (Truppen-Karten)

Teil des [GDD](../GDD.md), Stand v0.3 (**Draufsicht, Karte 56 × 28 Zellen, Artillerie-Reichweiten neu**). Alle Werte sind ⚙ **Startwerte zum Tunen**, keine Endwerte. Werte gelten für **Rang 0**; pro Rang +10 % HP und Schaden (GDD §8).

**Bestand:** **77 Einheiten** · Artillerie 18 · Sturm 23 · Verteidigung 17 · Zivilisten 19 · Tiers: I 14 · II 33 · III 21 · IV 9. Kerne, Welt-Launen, Chaos-Karten und Baustile stehen in [Katalog 03](03-kerne-und-weltlaunen.md).

## Lesehilfe

| Kürzel | Bedeutung |
|---|---|
| **ID** | `UA` Artillerie · `US` Sturm · `UV` Verteidigung · `UZ` Zivilist |
| **Name / Name (EN)** | Deutscher Designname / **englischer Spielname** (maßgeblich für Karten, Regeln: [`NOMENCLATURE.md`](../NOMENCLATURE.md)). |
| **Linie · T** | Freischalt-Linie (GDD §5.3) und Tier I–IV. **Basis** = immer verfügbar. |
| **S/N** | **Soll** (Zielstärke) / **Nachschub** pro Welle (GDD §5.6). |
| **GP** | Benötigte **Geschützplätze** (Artillerie, GDD §6.4). |
| **HP · RK** | Lebenspunkte · Rüstungsklasse: **F** Fleisch · **P** Panzer · **G** Geist · **K** Knochen · **Pu** Pudding (GDD §7.3). |
| **Schaden** | `Struktur / Person` bei Artillerie (Schaden gegen Bauteile / gegen Einheiten). Schadensarten **W** Wucht · **F** Feuer · **E** Eis · **B** Blitz · **G** Gift · **A** Arkan. |
| **Reichweite** | Artillerie: in Zellen, vom Geschützplatz zur Zielzelle (**Kurz 26 / Mittel 34 / Weit 42 / Extrem 50**; Baugrund-Abstand 20 Zellen, Kernkammern ≈ 30). Sonst: **Nah** ≤ 1 · **Kurz** 3 · **Mittel** 5 · **Weit** 8. |
| **Tempo** | kriechend 0,8 · langsam 1,0 · normal 1,5 · flink 2,2 · rasend 3,0 (Zellen/s). |
| **Doktrin** | Sturmtruppen-Zielverhalten (GDD §6.5): **Jäger · Brecher · Eroberer · Plünderer · Sprenger**. |
| **Strukturfaktor** | Sturm: Standard ×0,4 (Brecher ×1,0), Verteidiger und Zivilisten ×0 (GDD §6.2). Eine in der Tabelle genannte Zahl **ersetzt** den Standardwert (z. B. „Strukturfaktor 2,5“ = Gesamtfaktor 2,5). |
| **Talent R3** | Spezialfähigkeit ab Rang 3 „Elite“ (GDD §8). |
| **Look** | Pixel-Idee (Silhouette + Witz). |

---

## UA — Artillerie

Artillerie belegt **Geschützplätze** der eigenen Bastion und beschießt die gegnerische. Flugbahnen und Exposition: GDD §6.4 und §7.2.

| ID | Name | Name (EN) | Linie · T | S/N | GP | HP · RK | Flugbahn · Reichw. | Schaden (Struktur / Person) · Takt | Besonderheit | Talent R3 | Look |
|---|---|---|---|---|---|---|---|---|---|---|---|
| UA-01 | **Rumpel-Katapult** | **Rickety Catapult** | Basis · I | 2/1 | 2 | 70 · F | Bogen · 34 | 60 W / 18 W (Splash 1) · 7 s | Wacklig, aber zuverlässig. Streuung ±(0,4 + 0,04 × Entfernung) Zellen, Zielschatten 1,2 s. | **Doppelwurf:** jeder 4. Schuss wirft zwei Steine. | Holzkatapult mit Gesicht; schwitzende Mini-Goblins ziehen am Seil. |
| UA-02 | **Funken-Magier** | **Spark Mage** | Basis · I | 2/1 | 1 | 40 · F | Flach · 26 | 30 F / 12 F · 4,5 s | Setzt Holz und Organisches in **Brand**. | **Zündfunke:** Brand springt auf eine Nachbarzelle. | Magier mit schiefem Hut, der selbst raucht. |
| UA-03 | **Zwergen-Donnerbüchse** | **Dwarf Blunderbuss** | Basis · I | 2/1 | 1 | 55 · F | Flach · 30 | 45 W / 10 W · 6 s | Billig und laut. | **Kimme & Korn:** +25 % Schaden auf Zellen unter 75 % HP. | Zwerg trägt eine Kanone als Rucksack, sein Bart qualmt. |
| UA-04 | **Goblin-Kanone** | **Goblin Cannon** | Technik · II | 2/1 | 2 | 80 · P | Bogen · 34 | 25 W / 10 W · 9 s + Goblin | Schießt einen **Goblin** (25 HP, 6 W/s, lebt 12 s), der im Einschlagraum als Eindringling kämpft (zählt halb für die Besetzung). | **Doppelt Gobbo:** zwei Goblins je Schuss. | Rohr mit Goblin-Gesicht; ein Goblin guckt aus der Mündung und winkt. |
| UA-05 | **Ork-Kanone** | **Orc Cannon** | Waffen · III | 1/1 | 3 | 140 · P | Bogen · 38 | 40 W / 20 W · 14 s + Ork | Schießt einen **Ork** (70 HP, 14 W/1,0 s, Strukturfaktor 2, lebt 20 s). Der Ork brüllt eine Sprechblase. | **Panzerorks:** Orks landen mit +30 % HP. | Pyramidenkanone mit Kriegsbemalung; „WAAAGH!“ in Pixel-Sprechblase. |
| UA-06 | **Eiszapfen-Mörser** | **Icicle Mortar** | Frost · II | 2/1 | 1 | 60 · F | Senkrecht · 34 | 50 E / 14 E · 8 s | Einschlag **friert** den Raum an: Bauteil-Wirkung ×0,5 für 5 s, Personen **Eisig**. | **Frostnova:** jeder 3. Schuss mit Radius 2. | Yeti mit Trichter, aus dem Eiszapfen schießen. |
| UA-07 | **Sporenschleuder** | **Spore Slinger** | Flora · II | 2/1 | 1 | 65 · F | Bogen · 34 | 20 G / 6 G · 6 s + Wolke | **Sporenwolke** (8 s): 6 Gift/s auf Personen im Raum; Bürger husten (arbeiten −50 %). | **Sporenflug:** Wolke breitet sich in den Nachbarraum aus. | Riesige Pilzkanone; es puffen Sporen, Tierchen wohnen darin. |
| UA-08 | **Kalmar-Kanone** | **Squid Cannon** | Tier · II | 2/1 | 2 | 90 · Pu | Flach · 30 | 12 W / 4 W · 5 s + Tinte | Tinte: Türme und Fernkämpfer im Radius 1 **Geblendet** (8 s). | **Klebrige Tinte:** zusätzlich −15 % Tempo. | Kalmar quillt aus einem Fass und spritzt Tinte. |
| UA-09 | **Fledermaus-Hexe** | **Bat Witch** | Gruft · II | 2/1 | 1 | 45 · F | Streu · 34 | 6 × (8 G / 12 G) · 6 s | Sendet 6 Fledermäuse auf zufällige Zellen in einem 3×3-Zielgebiet, **bevorzugt Räume mit Personal** (tötet Bürger). | **Blutsauger:** Fledermäuse heilen die Hexe. | Hexe auf Besen, Fledermausschwarm mit Mini-Zähnen. |
| UA-10 | **Nagelbrett-Ballista** | **Nailboard Ballista** | Technik · III | 1/1 | 3 | 110 · P | Durchschlag · 42 | 90 W / 24 W · 10 s | **Durchschlägt bis zu 3 Zellen** in der Schusslinie (−20 % je Zelle). | **Durchschlag +1 Zelle.** | Riesenarmbrust mit Kettenrad; Bolzen mit Schleife. |
| UA-11 | **Blitzspulen-Hexe** | **Coil Witch** | Arkan · III | 1/1 | 2 | 70 · F | Flach · 34 | 40 B / 20 B · 5,5 s | **Kettenblitz** springt auf bis zu 3 Zellen; ×1,5 gegen Metall; 20 % Chance auf **Kurzgeschlossen** (3 s). | **Ketten +2 Sprünge.** | Tesla-Spule mit Hut, die Haare stehen zu Berge. |
| UA-12 | **Maulwurf-Mörser** | **Mole Mortar** | Technik · III | 1/1 | 1 | 100 · P | Untergrund · 38 | 80 W / 15 W · 9 s | Bohrgeschoss: beliebige Zielzelle, trifft nur Bauteile (kein Personenschaden), ignoriert Kuppel, Netz und Spiegel; Warnung nur als Rumpeln (0,8 s). | **Bohrer:** Splash 1 auf Bauteile. | Maulwurf mit Schutzbrille schiebt einen Bohrer ins Rohr. |
| UA-13 | **Frosch-Katapult** | **Frog Catapult** | Chaos · III | 1/1 | 2 | 75 · F | Bogen · 34 | 20 W / 0 · 11 s + Verwandlung | Einschlag verwandelt **Zivilisten und Einheiten bis 150 HP** im Raum für 6 s in **Frösche** (Posten verwaisen). Größere sind immun. | **Verlängerte Quakzeit:** +3 s. | Riesenfrosch, dessen Zunge der Wurfarm ist. |
| UA-14 | **Brummzeppelin** | **Humming Zeppelin** | Luft · III | 1/1 | Luft | 120 · P | Luft · 46 | 70 W / 20 W · 8 s + 2 Bomben | Schwebt **≈ 10 Zellen vor der eigenen Front über dem Feld**; dort nur von Türmen mit Reichweite ≥ 8 (Pelikan-Flaknest) und von Fliegern angreifbar. Bomben wie Bogen. | **Doppelbombe:** wirft immer zwei Bomben. | Walförmiges Luftschiff mit Bullaugen und Stummelflossen. |
| UA-15 | **Himmelsorgel** | **Sky Organ** | Segen · III | 1/1 | 2 | 85 · F | Senkrecht · 38 | 75 A / 30 A · 11 s | Strahl von oben; **Untote und Geister erleiden ×2 Personenschaden.** | **Fortissimo:** jeder 3. Strahl mit Radius 2. | Pfeifenorgel auf Wolken, ein Engelschor im Hintergrund, ein Rohr hustet. |
| UA-16 | **Sternschnuppen-Zauberer** | **Shooting-Star Wizard** | Arkan · IV | 1/1 | 1 | 60 · F | Senkrecht · 46 | 220 A / 40 A (Radius 2) · 20 s | Ruft einen **Meteor** auf eine Zielzelle (Zielschatten 2 s, Splash 2). Sehr fragil. | **Schweif:** 3 Splitter nach dem Einschlag. | Greis im Schlafanzug mit Sternenhut und Pantoffeln. |
| UA-17 | **Dicke Berta** | **Big Bertha** | Technik · IV | 1/1 | 4 | 220 · P | Durchschlag · 50 | 260 W / 60 W · 24 s | **Kernbrecher:** durchschlägt bis zu 5 Zellen; Schaden auf den Kern ×1,3. | **Schnellladung:** −20 % Nachladezeit. | Haubitze auf Raupen mit Schnurrbart am Rohr und Zylinderhut. |
| UA-18 | **Walfisch-Katapult** | **Whale Catapult** | Tier · IV | 1/1 | 4 | 260 · Pu | Bogen · 42 | 180 W / 60 W (Splash 2) · 22 s | Der Wal rollt nach dem Einschlag 3 Zellen in Flugrichtung weiter und zerschmettert alles auf dem Weg (50 % Schaden). Löscht Brände, Feinde im Raum werden **Nass**. | **Springflut:** zusätzlich Rückstoß 3 für Einheiten im Raum. | Katapult, in dessen Schale ein gelangweilter Wal mit Sonnenbrille liegt. |

---

## US — Sturmtruppen

Sturmtruppen laufen zur gegnerischen Bastion, töten Zivilisten, besetzen die Kernkammer und ziehen sich bei < 50 % HP zurück, **falls** eine Heilquelle existiert (GDD §6.5).

| ID | Name | Name (EN) | Linie · T | S/N | HP · RK | Angriff · Reichweite | Tempo | Doktrin | Besonderheit | Talent R3 | Look |
|---|---|---|---|---|---|---|---|---|---|---|---|
| US-01 | **Topfhelm-Skelett** | **Pot-Helm Skeleton** | Basis · I | 5/3 | 45 · K | 8 W / 1,0 s · Nah | normal | Jäger | Zerfällt beim Tod in Knochen. Billiger Massenstürmer. | **Klapperkopf:** steht einmal nach 4 s mit 30 % HP wieder auf. | Skelett mit Kochtopf als Helm, Holzlöffel als Schwert. |
| US-02 | **Beute-Goblin** | **Loot Goblin** | Basis · I | 5/3 | 30 · F | 6 W / 0,7 s · Nah | flink | Plünderer | Nach dem Kill eines Zivilisten +15 XP und 10 HP Heilung. | **Taschendieb:** stiehlt beim Töten einen Buff (+15 % Tempo, 8 s). | Goblin mit riesigem leerem Sack. |
| US-03 | **Kürbis-Bomber** | **Pumpkin Bomber** | Basis · I | 4/2 | 25 · F | Explosion: 60 F (Radius 1, Strukturfaktor 2) | flink | Sprenger | Läuft zum teuersten Bauteil und zündet sich dort. | **Kürbiskerne:** Splitter treffen die Nachbarzelle (30 F). | Gnom mit Kürbis als Kopf, die Lunte brennt. |
| US-04 | **Armbrustfrosch** | **Crossbow Frog** | Basis · I | 3/2 | 35 · F | 7 W / 1,1 s · Mittel | normal | Jäger | **Hüpfer:** weicht einmal je 5 s Nahkämpfern aus. | **Zwei Pfeile:** trifft zwei Ziele in Linie. | Frosch mit Ritterhelm und Mini-Armbrust. |
| US-05 | **Rammbock-Ork** | **Battering-Ram Orc** | Waffen · II | 3/2 | 95 · F | 14 W / 1,2 s · Nah | langsam | Brecher | Strukturfaktor 2,5: öffnet Tor und Mauern schnell. | **Anlauf:** erster Schlag ×2. | Ork mit riesigem Fisch (Stör) als Rammbock. |
| US-06 | **Rutsch-Bär** | **Sliding Bear** | Frost · II | 3/2 | 110 · F | 12 E / 1,1 s · Nah | rasend beim Rutschen, sonst normal | Jäger | **Rutschangriff** auf das erste Ziel: Rückstoß 2 Zellen und 1 s Betäubt. Braucht 3 freie Zellen Anlauf in gerader Linie; in engen Räumen normales Tempo. | **Eisspur:** hinterlässt Eis, Feinde −20 % Tempo. | Eisbär, der bäuchlings über den Boden rutscht, mit Schwimmbrille. |
| US-07 | **Reitgans-Goblin** | **Goose-Rider Goblin** | Tier · II | 3/2 | 60 · F | 9 W / 0,8 s · Nah | rasend | Jäger | **Überspringt** Fallgruben, Stachelfluren und 1-Zellen-Mauern. | **Eierbombe:** legt beim Treffer ein Ei (nach 2 s: 20 F). | Goblin auf wütender Gans mit Lanze. |
| US-08 | **Wühl-Gnom** | **Burrowing Gnome** | Technik · II | 3/2 | 55 · P | 10 W / 1,0 s · Nah | normal (unter Tage flink) | Eroberer | **Gräbt** unter dem Feld durch und taucht im **Hof, 2 Zellen hinter der Außenmauer** auf; währenddessen nicht beschießbar. | **Stehender Tunnel:** Freunde können nachfolgen (20 s). | Gnom mit Bohrer-Helm und Maulwurfshaufen. |
| US-09 | **Rumpelgeist** | **Poltergeist** | Gruft · II | 3/2 | 50 · G | 7 A / 0,9 s · Nah | normal | Jäger | **Geht durch Mauern**, ignoriert Fallen; 20 % Chance auf **Furcht** bei Zivilisten. | **Poltergeist:** wirft Gegenstände (Kurz). | Geist im Bettlaken mit Rassel. |
| US-10 | **Zangen-Panzerkrebs** | **Pincer Armor-Crab** | Tier · II | 2/1 | 140 · P | 16 W / 1,5 s · Nah | langsam | Brecher | **Packt** ein Ziel (Festgehalten 1,5 s). | **Panzerschlag:** +20 % Rüstung. | Krebs in Ritterrüstung, die Zange wie ein Schlüsselring. |
| US-11 | **Schneemann-Krieger** | **Snowman Warrior** | Frost · II | 3/2 | 80 · Pu | 10 E / 1,0 s · Nah | normal | Jäger | Schlägt **Eisig**. Beim Tod Schneematsch (3 s, −20 % Tempo). | **Karottenwurf:** Fernwurf (Kurz). | Schneemann mit Kohle-Augen, Eimerhelm, Karottenlanze. |
| US-12 | **Gummi-Golem** | **Rubber Golem** | Arkan · II | 2/1 | 130 · Pu | 11 W / 1,2 s · Nah | normal | Jäger | Immun gegen Rückstoß und Betäubung; reflektiert 25 % des Flach-Fernschadens. | **Hüpfer:** springt zum nächsten Feind. | Rosa Gummigolem mit Glibber-Auge. |
| US-13 | **Sporenläufer** | **Spore Runner** | Flora · II | 4/2 | 50 · F | 7 G / 0,8 s · Nah | normal | Jäger | Beim Tod **Sporenwolke** (4 Gift/s, 5 s). | **Sporenpfad:** hinterlässt beim Laufen kleine Wolken. | Pilzmännchen mit Schirmkappe. |
| US-14 | **Tick-Tack-Trooper** | **Tick-Tock Trooper** | Technik · II | 3/2 | 100 · P | 9 W / 1,0 s · Nah | normal | Brecher | **Aufgezogen:** Angriffstempo +5 % je Sekunde im Kampf (max. +50 %), Reset ohne Kampf. | **Überspannung:** einmal sofort volles Tempo. | Uhrwerksoldat, ein Uhrzeiger als Schwert. |
| US-15 | **Wanderkiste** | **Walking Crate** | Chaos · II | 3/2 | 90 · F | 8 W / 0,9 s · Nah | normal | Plünderer | **Tarnung als Beute:** wird erst im Nahbereich erkannt, **erster Biss ×3**. | **Goldzähne:** verschlingt Kleingegner (≤ 30 HP). | Truhe auf Beinchen, die Zunge hängt heraus. |
| US-16 | **Wirrwarr-Lehrling** | **Muddle Apprentice** | Arkan · II | 3/2 | 40 · F | 11 (zufällige Art) / 1,2 s · Mittel | normal | Jäger | **Chaosbolzen:** zufällige Schadensart (F/E/B/G/A); 10 % **Fehlzauber** (Frosch 3 s, 50 % auf sich selbst). | **Meister:** kein Fehlzauber, wählt die beste Art. | Lehrling mit zu großem Hut und zu langer Robe, der Zauberstab raucht. |
| US-17 | **Spaghetti-Würger** | **Spaghetti Strangler** | Chaos · III | 2/1 | 120 · F | 6 W / 0,5 s · Kurz | langsam | Jäger | **Nudelnetz:** greift bis zu 3 Ziele gleichzeitig (Festgehalten); frisst festgehaltene Zivilisten. | **Parmesan-Panzer:** +25 % Rüstung. | Nudelknäuel mit Gabel als Zahn. |
| US-18 | **Blutsauger-Schwarm** | **Bloodsucker Swarm** | Gruft · III | 2/1 | 70 · F (Flug) | 5 G / 0,5 s · Nah | rasend | Jäger | **Lebensraub 50 %**; fliegt. | **Nachtsicht:** ignoriert Nebel und Blendung. | Fledermausschwarm mit Monokeln. |
| US-19 | **Drachenreiter-Zwerg** | **Dragon-Rider Dwarf** | Luft · III | 2/1 | 100 · P (Flug) | Feueratem 15 F / 0,8 s · Kegel 2 | flink | Brecher | Fliegt über Feld und Mauern und **landet im Innenhof** nahe dem Ziel; Strukturfaktor 1. | **Sturzflug:** erster Angriff aus der Luft ×2. | Zwerg auf einem Mini-Drachen mit Zügeln. |
| US-20 | **Waschbär-Assassine** | **Raccoon Assassin** | Tier · III | 2/1 | 55 · F | 14 W / 0,6 s · Nah | rasend | Jäger | **Unsichtbar** bis zum ersten Angriff (Leuchtfeuer deckt auf); erster Angriff ×3 gegen Zivilisten. | **Rauchbombe:** nach dem ersten Angriff 2 s erneut unsichtbar. | Waschbär mit Ninja-Maske und Mülleimerdeckel als Schild. |
| US-21 | **Hügelriese** | **Hill Giant** | Waffen · IV | 1/1 | 420 · F | 30 W / 1,8 s · Nah (Fläche 2) | langsam (0,8) | Brecher | Stampfen: Rückstoß; wirft Goblins (Weit, 20 W). Strukturfaktor 1,2. | **Kopfnuss:** Betäubt 1 s. | Riese aus einer Wiese; auf dem Rücken ein Häuschen, die Bewohner winken. |
| US-22 | **Kuchenfeuer, der Geburtstagsdrache** | **Cakefire, the Birthday Dragon** | Luft · IV | 1/1 | 360 · F (Flug) | Feueratem 22 F / 1,0 s · Kegel 3 | flink | Brecher | Fliegt über Mauern und landet im Innenhof, Strukturfaktor 1,3; Gebrüll: **Furcht** bei Zivilisten im Radius 3 (alle 8 s). | **Flammenmeer:** Brand springt auf den Nachbarraum. | Drache, auf dessen Kopf Geburtstagskerzen brennen, mit Papierkrone. |
| US-23 | **Spiegel-Zwilling** | **Mirror Twin** | Chaos · IV | 1/1 | 200 · F | 12 W / 1,0 s · Nah | normal | Eroberer | **Mimikry:** übernimmt beim ersten Kontakt HP und Angriff der stärksten Feindeinheit in 3 Zellen (×1,2). | **Perfekte Kopie:** übernimmt auch deren Talent. | Schimmernde Gestalt mit Spiegelhaut, in der man sich selbst sieht. |

---

## UV — Verteidiger

Bleiben **immer in der eigenen Bastion**, in der gewählten **Wachzone** (GDD §6.6). Steht ein Verteidiger lebend in der Kernkammer, ist die Eroberung dort gesperrt.

| ID | Name | Name (EN) | Linie · T | S/N | HP · RK | Angriff · Reichweite | Standardzone | Besonderheit | Talent R3 | Look |
|---|---|---|---|---|---|---|---|---|---|---|
| UV-01 | **Bratpfannen-Büttel** | **Frying-Pan Bailiff** | Basis · I | 2/1 | 190 · P | 10 W / 1,0 s · Nah | Kernkammer | **Block:** Frontschaden −30 %. | **Pfannenwirbel:** alle 6 s Rundumschlag (Radius 1). | Wächter mit Riesenbratpfanne als Schild, Spiegelei-Wappen. |
| UV-02 | **Kauz-Gargoyle** | **Owl Gargoyle** | Basis · I | 2/1 | 220 · P (Stein) | 12 W / 1,2 s · Nah | Tor | **Erstarrt:** ruht als Statue (Wucht −50 %, Gift-immun), erwacht bei einem Feind in 3 Zellen. | **Sturzflug:** fliegt bei Alarm direkt zur Kernkammer. | Gargoyle-Eule mit Brille und Moosmütze. |
| UV-03 | **Schleimschnecke** | **Slime Snail** | Basis · I | 2/1 | 200 · Pu | 8 G / 1,0 s · Nah | Mitte | **Schleimspur:** Feinde −35 % Tempo in ihrer Zelle. | **Dicke Haut:** +20 % Rüstung. | Fette Schnecke, ein Schild als Haus. |
| UV-04 | **Schildkröten-Zwerge** | **Turtle Dwarves** | Waffen · II | 2/1 | 260 · P | 11 W / 1,1 s · Nah | Kernkammer | **Schildwand:** +25 % Rüstung je angrenzendem Verteidiger (max. +50 %). | **Panzerkuppel:** Splash −50 % in der Gruppe. | Zwerge unter Schildkrötenpanzern. |
| UV-05 | **Türsteher-Troll** | **Bouncer Troll** | Waffen · II | 1/1 | 360 · F (Regeneration 4 HP/s) | 18 W / 1,5 s · Nah | Tor | **Kontrollzone:** Feinde im selben Raum kommen nicht an ihm vorbei; sie müssen ihn töten oder umgehen. | **Rausschmiss:** Rückstoß 3 Zellen. | Troll im Smoking mit Klemmbrett. |
| UV-06 | **Ton-Golem** | **Clay Golem** | Arkan · II | 1/1 | 300 · P | 13 W / 1,4 s · Nah | Mitte | **Zerfall:** bei 0 HP Geröll (blockiert 5 s), formt sich mit 40 % HP neu (einmal je Welle). | **Brennofen:** +20 % Max-HP. | Töpfer-Golem mit Rissen und Henkeln. |
| UV-07 | **Wurzel-Ent** | **Root Ent** | Flora · II | 1/1 | 280 · F | 14 W / 1,4 s · Nah | Mitte | **Wurzelgriff:** alle 6 s hält er ein Ziel 2 s fest. Feuer ×1,5. | **Borke:** Feuer-Resistenz. | Alter Baum mit Moosbart und Vogelnest. |
| UV-08 | **Leere Rüstung** | **Empty Armor** | Gruft · II | 2/1 | 240 · G | 12 W / 1,0 s · Nah | Kernkammer | Immun gegen Furcht, Gift, Betäubung; bei Tod ein Haufen (blockiert 4 s). | **Klirren:** Furcht-Schrei (Radius 2). | Rüstung ohne Inhalt, ein Licht im Visier. |
| UV-09 | **Dreiköpfiger Pudel** | **Three-Headed Poodle** | Tier · II | 2/1 | 210 · F | 3 × 6 W / 0,8 s · Nah | Mitte (Leine ×1,5) | **Bellen:** 15 % **Furcht**-Chance; flink. | **Vierter Kopf.** | Pudel mit drei Köpfen und Schleifchen. |
| UV-10 | **Gletscher-Greis** | **Glacier Elder** | Frost · III | 1/1 | 400 · Pu | 15 E / 1,6 s · Nah | Kernkammer | **Kälteaura:** Feinde im Umkreis 3: −30 % Tempo und Angriffstempo. | **Eisige Rente:** Aura Radius 4. | Eisriese mit Hausschuhen und Strickmütze. |
| UV-11 | **Salamander-Wächter** | **Salamander Warden** | Arkan · III | 1/1 | 330 · F | Feueratem 20 F / 1,0 s · Kegel 3 | Kernkammer | **Brennen**; feuerimmun. | **Heiße Phase:** +30 % Schaden unter 50 % HP. | Salamander mit Lavahaut und Wächtermütze. |
| UV-12 | **Zahnrad-Zenturio** | **Cogwheel Centurion** | Technik · III | 1/1 | 350 · P | Gatling 5 W / 0,2 s · Mittel | Tor | **Aufgebaut:** stationär; überhitzt nach 8 s Dauerfeuer (2 s Pause). | **Kühlrippen:** keine Überhitzung. | Walzenroboter, der Zeitung liest. |
| UV-13 | **Paladin-Pinguin** | **Paladin Penguin** | Segen · III | 1/1 | 380 · F | 16 W / 1,3 s · Nah | Kernkammer | **Segensaura:** Eroberungsfortschritt im Raum −50 %; Freunde im Raum +15 % Schaden. | **Heiliges Rutschen:** Sturmangriff zu Freunden. | Pinguin in Plattenrüstung auf einer Mini-Eisscholle. |
| UV-14 | **Riesen-Butler** | **Giant Butler** | Waffen · III | 1/1 | 450 · F | 20 W / 1,8 s · Nah | Kernkammer | **Dienstpflicht (Spott):** Feinde im Umkreis 3 bevorzugen ihn; Zivilisten im Raum erleiden −30 % Schaden. | **„Sehr wohl“:** Spott wirkt auch auf Fernkämpfer. | Riese im Frack mit Silbertablett als Schild. |
| UV-15 | **Zahntür** | **Tooth Door** | Chaos · II | 1/1 | 250 · F (Holz) | Schlucken: 60 W | Tor | **Getarnt als Tür:** Feinde laufen hinein; sie schluckt einen Feind (≤ 150 HP) für 8 s. | **Gier:** schluckt zwei. | Holztür mit Zahnreihe, die Nase ist der Türklopfer. |
| UV-16 | **Sir Reginald, der Letzte Ritter** | **Sir Reginald, the Last Knight** | Waffen · IV | 1/1 | 750 · P | 28 W / 1,6 s · Nah | Kernkammer (fest) | **Letztes Aufgebot:** einmalige Auferstehung bei Tod (50 % HP); solange er lebt, ist die Eroberung vollständig gesperrt. | **Schwur:** +20 % Schaden gegen Eroberer. | Rüstung mit Pudelmütze und leuchtendem Schnurrbart im Visier. |
| UV-17 | **Hausmeister-Koloss** | **Janitor Colossus** | Technik · IV | 1/1 | 600 · P | 22 W / 1,8 s · Nah | Mitte | **Instandhaltung:** repariert Bauteile im Raum mit 10 HP/s; Feinde im Raum bevorzugen ihn (Spott). | **Schlüsselbund:** +50 % Reparatur. | Riesenroboter mit Besen und Schlüsselbund. |

---

## UZ — Zivilisten

Bleiben in der Bastion, handeln automatisch (nächstbestes Ziel), fliehen bei Gefahr zum Panikraum. **Bürger** (Standard-Zivilisten, keine Karte) siehe GDD §4.6.

| ID | Name | Name (EN) | Linie · T | S/N | HP | Funktion | Talent R3 | Look |
|---|---|---|---|---|---|---|---|---|
| UZ-01 | **Kräuterhexe** | **Herb Witch** | Basis · I | 2/1 | 35 | Heilt den am stärksten verwundeten Freund in 4 Zellen mit 8 HP/s. **Heilquelle** (zählt für den Rückzug). | **Doppelkessel:** heilt zwei Ziele. | Hexe mit Kessel auf Rädern und Suppenkelle. |
| UZ-02 | **Bau-Gnom** | **Builder Gnome** | Basis · I | 2/1 | 40 | Repariert Bauteile mit 12 HP/s; baut Ruinen in ≈ 13 s wieder auf. | **Schnellmörtel:** +50 %. | Gnom mit Maurerkelle und Zipfelmütze, Schubkarre voll Mörtel. |
| UZ-03 | **Rüstungs-Zwerg** | **Armorer Dwarf** | Basis · I | 2/1 | 50 | Aura (Raum + Nachbarn): Freunde +15 % Rüstung und +10 % Schaden. | **Meisterstück:** Aura-Radius +1. | Zwerg mit Amboss auf dem Rücken. |
| UZ-04 | **Eintopf-Koch** | **Stew Cook** | Basis · I | 2/1 | 40 | Teilt alle 10 s Eintopf an Freunde im Raum aus: **Satt** (+20 % Max-HP, 40 s). | **Geheimzutat:** zusätzlich +10 % Schaden. | Dicker Koch, die Kochmütze im Dampf. |
| UZ-05 | **Löschmeister-Kobold** | **Fire-Marshal Kobold** | Basis · II | 2/1 | 35 | Löscht Brände in Raum und Nachbarn; Feuerschaden an Bauteilen im Radius 2 −40 %. | **Wasserwerfer:** Reichweite +2. | Kobold mit Feuerwehrhelm und Gießkanne. |
| UZ-06 | **Fanfaren-Barde** | **Fanfare Bard** | Waffen · II | 1/1 | 35 | Aura 3 Zellen: Freunde +15 % Angriffstempo, immun gegen Furcht. | **Zugabe:** Aura Radius 5. | Barde mit Dudelsack aus einer Schweinsblase. |
| UZ-07 | **Professor Schnurrbart** | **Professor Moustache** | Arkan · II | 1/1 | 30 | Unterricht: bis zu 2 Schüler im selben Raum (z. B. Patienten in Heilräumen) erhalten +1,2 XP/s. | **Habilitation:** 4 Schüler. | Professor mit riesigem Schnurrbart, Eulenbrille und Tafel. |
| UZ-08 | **Segens-Nonne** | **Blessing Nun** | Segen · II | 1/1 | 40 | Gibt Freunden **Gesegnet** (absorbiert 40 Schaden), je Ziel alle 15 s. | **Doppelsegen:** zwei Ziele. | Nonne mit Heiligenschein-Frisbee. |
| UZ-09 | **Tränkebrauer** | **Potion Brewer** | Arkan · II | 1/1 | 35 | Wirft alle 12 s einen Trank (Reichweite 4) auf einen Freund: zufällig +25 % Schaden (10 s), +25 % Tempo, 40 Heilung oder 30 Schild. | **Gezielter Trank:** wählt den passenden. | Alchemist mit Reagenzglas-Brille. |
| UZ-10 | **Fallensteller-Koboldin** | **Trapper Kobold** | Tier · II | 1/1 | 35 | Stellt bis zu 3 Fallen in Korridoren (50 Wucht, **Festgehalten** 2 s) und baut nach. | **Giftpfeilfallen:** zusätzlich Gift 4 s. | Koboldin mit Mausefallen-Hut. |
| UZ-11 | **Imkerin** | **Beekeeper** | Flora · II | 1/1 | 35 | Bienenstock: 4 Bienen stechen Eindringlinge im Raum (3 W/s je). Honig heilt Freunde im Raum mit 3 HP/s. | **Bienenkönigin:** 8 Bienen. | Imkerin im Schutzanzug mit Bienenaura. |
| UZ-12 | **Jongleur-Clown** | **Juggler Clown** | Chaos · II | 2/1 | 45 | **Köder:** Feinde im Umkreis 3 priorisieren ihn zu 30 %; er weicht 50 % aus. | **Torte im Gesicht:** Geblendet 1,5 s. | Clown mit Keulen und Riesenschuhen. |
| UZ-13 | **Brieftauben-Bote** | **Carrier-Pigeon Courier** | Luft · II | 1/1 | 25 | **Rückzugsfunk:** fliehende Freunde +20 % Tempo; Alarm 2 s früher; Verteidiger-Leine +1. | **Eilkurier:** Tempo +30 %. | Taube mit Mini-Mütze und Brief im Schnabel. |
| UZ-14 | **Gruft-Gärtnerin** | **Crypt Gardener** | Gruft · III | 1/1 | 35 | In der Bastion gefallene Sturm-/Verteidiger-Einheiten stehen mit 20 % Chance als Skelett auf (15 s, 50 % HP). | **Rose der Ruhe:** 30 %. | Gärtnerin mit Schädel-Gießkanne. |
| UZ-15 | **Orakel-Kröte** | **Oracle Toad** | Chaos · III | 1/1 | 30 | **Voraussicht:** Beschuss auf Zellen im Radius 2 hat 35 % Fehlschuss (landet daneben). | **Zweites Gesicht:** 50 %. | Kröte mit Kristallkugel und Turban. |
| UZ-16 | **Regenmacher-Schamane** | **Rainmaker Shaman** | Flora · III | 1/1 | 40 | Regen über der Bastion (Radius 5, 60 s): Brennen unmöglich; Eindringlinge **Nass** (−10 % Tempo, Blitz ×1,5). | **Gewitter:** Regen mit Blitzen (20 B alle 5 s auf ein Ziel). | Schamane mit Wolkenhut, tanzt. |
| UZ-17 | **Matrone Grosselfe** | **Granny Elf** | Waffen · III | 1/1 | 55 | **Brutmutter:** +1 Nachschub für zwei zufällige Truppenkarten je Welle; Spawn um 25 % schneller gestaffelt. | **Mutterstolz:** +2 Nachschub. | Elfenoma mit Strickzeug und Wollknäuel. |
| UZ-18 | **Schrott-Rudi** | **Scrap Rudy** | Technik · III | 1/1 | 50 | Panzert Bauteile: in 3 Zellen +20 % Max-HP; repariert Nachbarn mit 8 HP/s. | **Schrottgolem:** aus Trümmern entsteht ein Schutzgolem (150 HP, 8 W/s, 20 s). | Roboter-Opa aus Mülltonnen. |
| UZ-19 | **Opa Philosophenstein** | **Grandpa Philosopher** | Arkan · IV | 1/1 | 40 | Einmal je Welle **Transmutation:** Der am schwersten verwundete Freund wird vollständig geheilt und erhält +60 XP; alle Bauteile im Radius 3 werden um 15 % repariert. **Heilquelle.** | **Gold aus Blei:** zusätzlich +1 Bürger je Transmutation. | Greis mit gläserner Kugel, die Haare sind aus Dampf. |

---

## Anhang

### Verteilung nach Linie
| Linie | Freischalt-Raum | Einheiten |
|---|---|---|
| Basis | – | 15 |
| Waffen | Kaserne (BF-01) | 9 |
| Arkan | Arkanum (BF-02) | 9 |
| Tier | Menagerie (BF-03) | 7 |
| Technik | Belagerungswerkstatt (BF-04) | 9 |
| Gruft | Gruft (BF-05) | 5 |
| Frost | Eisgrotte (BF-06) | 4 |
| Flora | Gewächshaus (BF-07) | 5 |
| Luft | Luftdock (BF-08) | 4 |
| Segen | Tempel der Heiterkeit (BF-09) | 3 |
| Chaos | Chaoskabinett (BF-10) | 7 |

Die Linien **Segen** (3) und **Luft** (4) sind noch dünn besetzt und bieten Platz für Erweiterungen.

### Auswahl für den ersten Prototyp (P0)

Genug für alle vier Kategorien und die Linie **Waffen** (passt zu Kaserne BF-01 im Gebäudekatalog):

- **Artillerie:** UA-01 Rumpel-Katapult · UA-02 Funken-Magier · UA-03 Zwergen-Donnerbüchse
- **Sturm:** US-01 Topfhelm-Skelett · US-02 Beute-Goblin · US-03 Kürbis-Bomber · US-04 Armbrustfrosch · US-05 Rammbock-Ork
- **Verteidigung:** UV-01 Bratpfannen-Büttel · UV-02 Kauz-Gargoyle · UV-03 Schleimschnecke · UV-04 Schildkröten-Zwerge · UV-05 Türsteher-Troll
- **Zivilisten:** UZ-01 Kräuterhexe · UZ-02 Bau-Gnom · UZ-03 Rüstungs-Zwerg · UZ-04 Eintopf-Koch · UZ-05 Löschmeister-Kobold · UZ-06 Fanfaren-Barde

### Namensbausteine für Legenden (Rang 5) 🟨

Ab Rang 5 bekommt eine Einheit einen Namen aus **Vorname + Titel**. Beispiele, einfach erweiterbar:

- **Vornamen:** Gerd · Brunhilde · Klaus-Dieter · Mümmel · Olga · Bert · Sigrun · Fridolin · Trude · Horst · Gisela · Waldemar
- **Titel:** *der Unverdauliche* · *Schrecken der Kantine* · *die Gnadenlose (mittwochs)* · *mit dem guten Knie* · *Zerstörer von Stühlen* · *der Zweitbeste* · *Flüsterer der Hühner* · *die Beharrliche* · *Kenner von Pilzen*

Die Namen erscheinen im Ranggewinn-Banner, im Ereignisfeed und bei der Todesnachricht („Gerd der Unverdauliche ist nicht mehr unverdaulich.“).
