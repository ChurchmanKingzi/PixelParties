# Bastion Blasters — Game Design Document

**Teil 1: Spieldesign** · Version 0.1 · Entwurf zur Abnahme · Schritt 1 (Konzept → GDD)

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

**Sprachregel:** Alle Spielbegriffe sind deutsch und fest (siehe Glossar, Teil 2 §15). „Festung“ und „Bastion“ meinen dasselbe; im Spiel heißt sie **Bastion**.

---

## 1. Vision

### 1.1 Pitch 🟦

> Zwei Bastionen stehen sich gegenüber, aufgeschnitten wie Puppenhäuser: Man sieht jeden Raum, jeden Zivilisten, jeden Pilz im Keller. Du hast sie aus zufällig gezogenen Bauteilen zusammengesetzt – Türme, Krankenstationen, Werkstätten, Kasernen und ein paar Dinge, die niemand erklären kann. Im Zentrum pocht der **Kern**. Fällt er, explodiert deine Bastion.
> Dazu hast du eine Armee aus Katapulten, feuerballwerfenden Magiern, rutschenden Eisbären, Skeletten in Kochtöpfen, Troll-Türstehern und Zivilisten, die Suppe kochen, Mauern flicken und Verwundete heilen. Alle Truppen wachsen nach. Wer überlebt, wird stärker. Alle zwei Wellen hält die Zeit an, ihr zieht neue Karten, baut um und aus – und die Schlacht geht nahtlos weiter.

### 1.2 Designsäulen 🟨

1. **Lesbares Chaos.** Wild darf alles sein, nachvollziehbar muss es bleiben: Geschoss fliegt → Zelle zerbricht → Raum geht aus → Zivilisten rennen. Jede Wirkung hat eine sichtbare Ursache.
2. **Bauen ist Taktik.** Die Bastion ist Rüstung, Waffe und Wirtschaft zugleich. Wo ein Raum steht, entscheidet über Leben und Tod.
3. **Veteranen-Fantasie.** Rückzug, Heilung und Wiederkehr werden belohnt. Einheiten sammeln Ränge, Titel und Narben; man hängt an ihnen.
4. **Fließende Rhythmen.** Kampf → Zeitstopp → Ausbau → Kampf, ohne harte Schnitte. Der Zeitstopp ist Teil der Inszenierung, kein Menü.
5. **Whacky mit System.** Jede Karte hat einen Witz *und* eine klare Spielrolle. Albern aussehen darf sie; unklar funktionieren nicht.

### 1.3 Was das Spiel besonders macht 🟨

- **Zwei Siegwege erzwingen Vorbereitung auf beides.** Zerstörung (Artillerie bricht den Kern auf) gegen Eroberung (Sturmtruppen besetzen die Kernkammer). Verteidiger helfen *nur* gegen Eroberung, Mauern und Reparatur *nur* gegen Zerstörung.
- **Die Bastion ist ein lebender Querschnitt.** Zerstörte Zellen werden zu Breschen und öffnen neue Wege. Ausgeschaltete Räume erkennt man sofort (Spinnweben, kein Licht, Personal weg).
- **XP + Rückzug als Kernschleife.** Wer sein Heil-Netz schützt und seine Truppen rotiert, bekommt Elite-Einheiten. Wer es zerstört, zwingt den Gegner in Todesmut-Selbstmordangriffe.
- **Wellenpause als Draft-Moment.** Kein Menü-Tabu: Man sieht die eingefrorene Schlacht, während man die nächste Karte legt.

### 1.4 Rahmen (Annahmen) ❓

| Punkt | Annahme (Default) |
|---|---|
| Spieler | 2, im Kern **symmetrisch** (kein Asymmetrie-Fraktionssystem). Asymmetrie entsteht über Karten und Kern-Typ. |
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
- **Teamfarben statt Fraktionen:** P1 = Karminrot/Gold, P2 = Türkis/Violett. Alle Banner, Zierleisten, Umhänge und Lichter nehmen die Teamfarbe an (Palette-Swap, siehe Teil 2 §10.1).

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

1. **Kern-Typ wählen** 🟨 (P1): Jeder Spieler bekommt 3 zufällige Kern-Typen angeboten und wählt einen (Katalog 03). Bis dahin (P0): ein Standardkern.
2. **Loadout ziehen** 🟦: Jeder Spieler erhält zufällig **14 Karten**: 8 Bau-Karten + 6 Truppen-Karten (Tier-Gewichte siehe §5.2).
   - **Garantien** 🟨: mindestens 1 Heilquelle, 1 Geschützplatz-Bauteil (Plattform), 1 Truppe je Kategorie (Artillerie, Sturm, Verteidiger, Zivilist). Jede Truppen-Karte im Loadout ist **sofort spielbar**: Sie gehört zur Linie *Basis* oder zur Linie eines Freischalt-Raums, der im selben Loadout liegt (max. 1 Freischalt-Raum).
   - **Mulligan** 🟨: einmal komplett neu ziehen.
3. **Kostenlose Grundausstattung:** Kern, Tor, 4 Bürger (§4.6), unbegrenzt Mauerwerk (BS-01).

### 3.3 Phase 1 — Erstaufbau 🟦

Beide Spieler arbeiten **gleichzeitig und verdeckt** (Fog: man sieht die gegnerische Bastion erst, wenn der Kampf beginnt) in ihrem **Bastion-Screen**:
- Bau-Karten per Drag & Drop in das Raster legen (§4).
- Truppen-Karten ins **Kontingent** legen (5 Plätze, §5.6). Für jede Verteidiger-Karte eine Wachzone wählen; für jede Artillerie-Karte eine Zielpriorität (§5.7).
- Timer ⚙ **120 s**; „Bereit“ beendet vorzeitig. Wer fertig ist, sieht nur ein „✔ Bereit“ beim Gegner.
- Beim Start des Kampfes folgt die **Enthüllung**: Die Kamera zieht auf die Weitaufnahme, beide Bastionen werden mit Hammerschlag-Welle „abgestempelt“ (Teil 2 §10.3).

### 3.4 Phase 2 — Kampfzyklus 🟦

- **Welle 1** spawnt sofort beim Kampfbeginn. **Welle 2** folgt nach ⚙ **40 s**. Danach: **Zeitstopp**.
- Nach der Pause spawnt die nächste Welle **sofort** (damit neue Truppen direkt eingreifen), die darauffolgende wieder nach 40 s, dann Zeitstopp usw.
- Ein **Zyklus** = 2 Wellen + 1 Pause. Bei 40 s Wellenabstand und 25 s Pause rechnen wir mit rund **9–11 Zyklen** pro Partie.
- **Während der Schlacht** läuft alles automatisch (Autobattler): Artillerie schießt, Sturmtruppen stürmen, Verteidiger wehren ab, Zivilisten tun Nützliches. Der einzige direkte Eingriff ist die **Kern-Fähigkeit** 🟨 (§9.1).

### 3.5 Der Zeitstopp (Pause) 🟦

Ablauf in Kurzform (Regieplan mit Timeline: Teil 2 §10.3):

| Schritt | Inhalt | ca. Dauer |
|---|---|---|
| 1 | **Einfrieren:** Alles hält mitten in der Bewegung an (Geschosse, Funken, Sprites). | 0,7 s |
| 2 | **Eintauchen:** Die Kamera gleitet in die eigene Bastion (Weltansicht bleibt als eingefrorenes Diorama im Hintergrund sichtbar). | 0,8 s |
| 3 | **Ziehen:** 5 Karten werden aufgedeckt, 3 davon behält man (§5.5). | 1,5 s |
| 4 | **Bauen:** Neue Bauteile legen, Truppen ins Kontingent, Befehle anpassen, 1 Bauteil umziehen (§4.10). Timer ⚙ **25 s**. | 25 s |
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

Ab ⚙ **14:00** beginnt der **Wahnsinn**: Alle 30 s steigen Artillerieschaden +10 %, Eroberungstempo +10 % und Welt-Launen-Ausbrüche werden häufiger. Bei ⚙ **20:00** zerreißt der „Himmelsriss“, beide Kerne verlieren 1 % Max-HP pro Sekunde. Garantiert ein Ende.

### 3.8 Beispielpartie (zum Mitdenken) 🟨

- **0:00** Spieler A zieht Zinnenkranz, Krankenstation, Schmiede, Pfeilturm, Kaserne, Wohnhaus, 2× Mauer-Varianten, dazu Rumpel-Katapult, Topfhelm-Skelett, Bratpfannen-Büttel, Kräuterhexe, Beute-Goblin und Funken-Magier. Er stellt das Katapult und den Magier auf die Zinnen und die Krankenstation direkt hinter das Tor. Das Schmiede-Team kommt ins Erdgeschoss, der Kern bekommt Mauern drumherum.
- **0:10** Spieler B hat eine Eisgrotte, Rutsch-Bär und Frostmörser gezogen und setzt auf Frost.
- **0:20** Welle 1: Skelette und Goblins laufen los. Die Goblins stürzen sich auf Bs Bürger, Bs Pfeilturm schießt zurück, ein Goblin flieht mit 40 % HP in die Krankenstation und kommt geheilt als Gefreiter wieder.
- **1:00** Welle 2 ist gespawnt, **Zeitstopp:** Die Schlacht gefriert. A zieht 5 Karten: Löschteich, Zahnklempner, Sternwarte, Arkanum, Wunschbrunnen. Er behält Sternwarte, Zahnklempner, Arkanum und legt sie. B baut eine Gruft und beginnt, Skelett-Karten zu sammeln.
- **… 6:30** Bs Rutsch-Bären haben Rang 3, As Krankenstation ist zerstört. Seine verletzten Skelette kämpfen jetzt bis zum Tod. A baut in der Pause einen Feldlazarett-Ersatz, der in Welle 11 aktiv wird.
- **9:10** Bs Ballista hat sich durch drei Mauerschichten gefressen, der Kern liegt frei. A löst seine Kern-Fähigkeit aus. Es reicht nicht. **Explosion.**

---

## 4. Die Bastion

### 4.1 Raster 🟦/🟨

Die Bastion ist ein **Querschnitt** (Seitenansicht) auf einem Zellenraster. **1 Zelle = 32 × 32 px.** Das maximale Raster ist **8 Spalten × 6 Reihen**; zu Beginn sind **6 × 4** freigeschaltet.

```
 x:         0     1     2     3     4     5     6     7        ← P1 blickt nach rechts (Front = x 7)
          ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
 y0  Dach │ Hi  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ Vo  │   ▒▒ = Erweiterung „Dach“
          ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 y1       │ Hi  │     │     │     │     │     │     │ Vo  │
          ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 y2       │ Hi  │     │     │ KERN│ KERN│     │     │ Vo  │   Hi = Erweiterung „Hinterbau“
          ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤   Vo = Erweiterung „Vorbau“
 y3       │ Hi  │     │     │ KERN│ KERN│     │     │ Vo  │   (freie Zellen = Startfläche 6×4)
          ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 y4  EG   │ Hi  │     │     │     │     │     │ TOR │ Vo  │   EG = Erdgeschoss, Tor in der Frontspalte
 ═════════╪═════╪═════╪═════╪═════╪═════╪═════╪═════╪═════╪═══ Erdreich
 y5 Keller│ Hi  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ ▒▒  │ Vo  │   ▒▒ = Erweiterung „Keller“
          └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

- **Der Kern** (2 × 2) sitzt fest in der Mitte (Spalten 3–4, Reihen 2–3). Er ist ein begehbarer Raum: die **Kernkammer**.
- **Freie Startzellen:** 6 × 4 = 24 − 4 (Kern) − 1 (Tor) = **19**. Das reicht für ca. 8–10 Bauteile plus Mauerwerk.
- **Erweiterungen** 🟨: Zu den Zeitstopps **2, 4 und 6** wählt jeder Spieler **eine von vier Erweiterungen**: **Dach** (Reihe y0), **Keller** (Reihe y5), **Vorbau** (Spalte x7, das Tor wandert nach vorn) oder **Hinterbau** (Spalte x0). Max. 3 von 4 → jede Bastion bekommt eine andere Form.
- Der **Keller** liegt im Erdreich: Seitliche Direktschüsse und Bogenschüsse treffen ihn nicht, solange darüber Zellen stehen. Nur Tunnel-Geschosse und Treffer von oben erreichen ihn.
- Spieler 2 ist gespiegelt: Der Bastion-Screen zeigt immer die **Weltansicht** (P2 blickt nach links), damit Orientierung in Schlacht und Aufbau identisch bleibt.
- Weltmaße (Orientierung, ⚙): Bastion-Breite 8, **Niemandsland ≈ 12 Zellen**, Gesamtbreite ≈ 28 Zellen = 896 px bei 32 px Zellen; passt auf ein 960 × 540-Bild.

### 4.2 Bauteil-Arten 🟦/🟨

| Art | Eigenschaft | Beispiele |
|---|---|---|
| **Raum** | Begehbar. Einheiten laufen durch und arbeiten darin. Hat meist eine Funktion. | Krankenstation, Schmiede, Kaserne, Kernkammer |
| **Mauer** | **Fest**, nicht begehbar. Blockiert Wege, absorbiert Beschuss. | Mauerwerk, Puddingwand, Panzermauer |
| **Turm** | Hoch (1 × 2 oder 1 × 3), braucht **offene Oberseite**. Beschießt Feinde auf dem Feld und in der Nähe. | Pfeilturm, Zauberturm |
| **Plattform** | Liefert **Geschützplätze** für Artillerie. | Zinnenkranz, Sternwarte |

**Größen:** 1 × 1, 2 × 1 (breit), 1 × 2 / 1 × 3 (hoch), 2 × 2. Keine Rotation (Querschnitt-Logik).

**Platzierungs-Tags** (stehen auf der Karte):

| Tag | Bedingung |
|---|---|
| **[Dach]** | Direkt über dem Bauteil steht nichts (offene Oberseite). |
| **[Außen]** | Äußerste Spalte oder Reihe der freigeschalteten Fläche. |
| **[Front]** | Frontspalte (zum Gegner gewandt). |
| **[Boden]** | Erdgeschoss (y4). |
| **[Keller]** | Kellerreihe (y5, nur nach Erweiterung). |

Jedes Bauteil hat: **Tier**, **Material** (bestimmt Resistenzen, §7.3), **HP**, **Posten** ⚙ (benötigtes Personal, §4.6), **Effekt**, **Tags** (für Nachbarschaft), optional **Linie** (§5.3).

### 4.3 Der Kern & die Kernkammer 🟦

- **Kern-HP:** ⚙ 5000. Der Kern **regeneriert** langsam (⚙ 2 HP/s) und kann von Bau-Gnomen repariert werden.
- **Kernkammer:** 2 × 2 Raum, in dem der Kern pulsiert. Hier wird **erobert** (§7.6) und hier kämpfen die Verteidiger. Nur sie zählt für die Eroberung.
- Der Kern ist **ein Ziel wie jede andere Zelle**: Er ist treffbar, sobald er *exponiert* ist (§7.2), also sobald Schuss-Linien zu ihm frei sind.
- **Nur Artillerie** (und Chaos-Effekte) verletzt den Kern. Sturmtruppen können ihn **erobern, nicht beschädigen**. So bleiben die Rollen sauber getrennt.
- **Kern-Fähigkeit** 🟨 (P1): Jeder Kern-Typ hat eine aktive Fähigkeit mit Abklingzeit; siehe §9.1.

### 4.4 Tor, Wege, Trümmer, Breschen 🟨 (P0)

- **Wege:** Benachbarte **Räume** sind automatisch verbunden (Türen horizontal, Leitern/Treppen vertikal). **Mauer-Zellen** blockieren. Das Wegenetz ist ein Graph aus Räumen.
- **Tor:** Der Standardeingang (Frontspalte, Erdgeschoss), ⚙ 500 HP, Holz. Für Freunde immer offen; **Feinde müssen es zerstören** oder einen anderen Weg finden.
- **Trümmer:** Eine zerstörte Zelle (egal welche) wird zum **Trümmerfeld**: begehbar (−30 % Tempo), ohne Funktion, ohne Deckung. Sie kann von einem Bau-Gnom **wiederaufgebaut** (§4.7) oder in der Pause überbaut werden.
- **Bresche:** Ein Trümmerfeld an der Außenseite ist ein **zusätzlicher Eingang**. Feindliche Wegfindung berücksichtigt Breschen. Artillerie öffnet also Wege für Sturmtruppen.
- **Wegfindung der Eindringlinge:** Kosten = Strecke + Zerstörungsaufwand für blockierende Mauern/Tor (HP/100). Sie nehmen den billigsten Weg; ist keiner frei, brechen sie das schwächste Hindernis.
- **Sonderwege:** Geister gehen durch Mauern, Wühl-Gnome tauchen im Erdgeschoss/Keller auf, Flieger landen über offene Dächer (Dachluke), Rutschen und Aufzüge verändern Wege (Katalog 01).
- **Isolierte Räume:** Ist ein Raum vom Tor/Kern abgeschnitten, erreicht ihn kein Personal → er bleibt verwaist. Der Editor warnt (kein Verbot).

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
- **Panik:** Bürger in der Nähe von Eindringlingen fliehen zu einem Panikraum oder weg vom Feind. Fliehende arbeiten nicht.
- **Lahmlegung 🟦:** Töten Sturmtruppen Bürger und Zivilisten, bleiben Posten leer → Räume verwaisen → die Bastion wird nach und nach inaktiv. Die HUD zeigt den **Betriebsgrad** (besetzte / benötigte Posten) als Balken unter dem Kern-Balken.
- **Gegenmittel:** Panikraum, Alarmglocke, Wohnhäuser (schnellerer Nachwuchs), Verteidiger an den Engstellen.

### 4.7 Reparatur & Wiederaufbau 🟦/🟨

- **Bau-Gnome** (Karte UZ-02), die **Reparaturwerkstatt** (BU-03) und **Bürger** mit Werkzeug beheben Schäden: ⚙ Bau-Gnom 12 HP/s, Werkstatt 8 HP/s an Nachbarzellen.
- **Wiederaufbau** eines zerstörten Bauteils kostet Arbeit gleich ⚙ 40 % seiner Max-HP (400 HP → 160 Arbeit, ein Bau-Gnom schafft das in ≈ 13 s). Danach steht es mit 40 % HP wieder.
- Der Kern wird wie ein Bauteil repariert.
- Reparatur und Wiederaufbau geben dem Arbeiter **XP** (§8).

### 4.8 Nachbarschaft (Tags & Synergien) 🟨

Bauteile tragen Tags (**Wehr, Heil, Werk, Wissen, Wohn, Magie, Tier, Technik, Chaos, Leicht-Entflammbar, Sprengstoff**). Einzelne Bauteile haben Boni oder Nachteile durch Nachbarn (z. B. Zahnklempner neben Krankenstation, Pulverkammer *nicht* neben Wohnhaus). Eine Synergie-Anzeige im Editor markiert Nachbarn grün/rot, ehe man loslässt.

### 4.9 Upgrades durch Duplikate (★) 🟨

Wer dieselbe Bau-Karte erneut zieht, kann sie **auf das bereits stehende Bauteil** legen: **★2** (+50 % HP, Effektwerte +40 %), **★3** (+100 % HP, Effektwerte +80 %). Eigene Sprite-Varianten (Wimpel, Zierleisten) markieren den Rang. Das gleiche gilt für Truppen-Karten im Kontingent (§5.6).

### 4.10 Umbau in der Pause 🟨

Pro Pause darf jeder Spieler **1 Bauteil verschieben** (kostenlos). Wer weiter umbaut, **reißt ab**: das Bauteil ist verloren (Karte weg). Zerstörte Bauteile (Trümmer) dürfen kostenlos überbaut werden.

### 4.11 Optional: Statik-Kollaps 🟨 P2

Eine Zelle ohne tragendes Fundament (nichts darunter, nicht an Seitenwand) stürzt ein, wenn ihr Träger zerstört wird, und verursacht Fallschaden. Spektakulär, aber technisch aufwendig; erst nach dem Prototyp entscheiden.

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

### 5.5 Nachziehen in der Pause 🟦/🟨

- **Ziehen 5, behalten 3** ⚙: Fünf Karten liegen offen, man wählt drei. Die anderen gehen zurück in den Pool (kein Verlust).
- **Garantie:** In den 5 Karten sind mindestens 1 Bau-Karte und 1 Truppen-Karte.
- **„Bekannte Gesichter“** 🟨: 20 % der gezogenen Karten sind Kopien von Karten, die man bereits besitzt (auf dem Raster oder im Kontingent). Das macht ★-Upgrades und größere Kontingente erreichbar.
- **Handlimit** ⚙ 10; Überschuss muss abgeworfen werden. **1 Reroll** pro Pause (die 5 Karten neu ziehen).
- Karten dürfen in der Hand bleiben (z. B. wenn gerade kein Platz ist) und später gespielt werden.
- **Kein echtes Deck:** Ziehen mit Zurücklegen aus dem gewichteten Gesamtpool. Der Pool ist nach Tiers gegatet (§5.2) und nach Linien gewichtet (§5.3).

### 5.6 Kontingent, Soll & Nachschub 🟦/🟨

- Das **Kontingent** ist die Armee-Leiste. Start: ⚙ **5 Plätze**, +1 durch Kaserne (BF-01), +1 zum Zeitstopp 3 und 6, **max 8**.
- Jede Truppen-Karte im Kontingent hat zwei Zahlen: **Soll (S)** = Zielstärke (wie viele gleichzeitig leben sollen) und **Nachschub (N)** = wie viele pro Welle nachgeliefert werden.
- **Kontinuierliches Nachspawnen 🟦:** Zu jeder Welle fordert jede Karte `min(N, S − lebend)` Einheiten an (nie Verlust des Kontingents, nie „ausgehende“ Truppen). Sie spawnen gestaffelt (⚙ 0,4 s Abstand).
- **Duplikat-Upgrade ★:** Zweite Kopie → **★2** (S × 1,5, N + 1), dritte → **★3** (S × 2, N + 1). Zwei Karten derselben Art belegen keinen zweiten Platz.
- **Voll?** Eine neue Truppen-Karte ersetzt eine vorhandene (diese geht auf den Ablagestapel).
- **Grenzen:** Artillerie spawnt nur bei **freiem Geschützplatz** (§6.4). Linien-Truppen brauchen aktiven Freischalt-Raum (§5.3). Globales Einheitenlimit ⚙ **40 pro Seite**.

### 5.7 Befehle in der Pause 🟨

Keine Echtzeit-Befehle, aber eine kleine Planungsebene pro Karte:
- **Artillerie → Zielpriorität** (§6.4): *Chirurg* (Standard), *Brecher*, *Kernjagd*, *Dachjäger*, *Streuer*.
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
| **Reichweite** | **Nah** ≤ 1 Zelle · **Kurz** 3 · **Mittel** 5 · **Weit** 8 · bei Artillerie in Zellen (14–26). |
| **Tempo** | **kriechend** 0,8 · **langsam** 1,0 · **normal** 1,5 · **flink** 2,2 · **rasend** 3,0 (Zellen/s). |
| **Strukturfaktor** | Multiplikator auf Schaden gegen Bauteile. Sturm Standard **×0,4**, *Brecher* ×1,0, Verteidiger/Zivilisten ×0. |
| **Soll / Nachschub** | Siehe §5.6. |
| **Rang-Talent** | Spezialfähigkeit, die ab **Rang 3** freigeschaltet wird (§8). |

### 6.3 Spawn & Nachschub

- Welle → jede Kontingent-Karte fordert Einheiten an → gestaffelter Spawn am zugehörigen Ort (§5.3).
- **Artillerie** spawnt am Geschützplatz selbst (Auftauchen per Stampf-Animation). **Verteidiger** am Kern, Zivilisten am Wohnhaus/Kern. **Sturm** am Freischalt-Raum bzw. Tor.
- Gefallene Einheiten werden **nie** zu Karten-Verlusten. Aber Ränge gehen verloren, neue Einheiten starten bei Rang 0 (außer Boni wie Drillplatz).

### 6.4 Artillerie 🟦/🟨 (P0)

**Geschützplätze (GP):** Artillerie braucht freie GP auf Plattformen (Zinnenkranz, Geschützdeck, Sternwarte, Wolkenanker, Schwebende Festung, Kellerlafette; dazu die Belagerungswerkstatt und das Luftdock). Jede Einheit benötigt 1–4 GP (steht auf der Karte). Ohne freien GP wird sie **nicht gespawnt** und wartet im Kontingent. Zerstört man die Plattform, sind die GP weg und die Artillerie darauf stirbt oder fällt herab.

**Flugbahnen** (bestimmen, was getroffen wird, siehe §7.2):

| Flugbahn | Trifft … | Splash | Typische Waffen |
|---|---|---|---|
| **Flach** | Die **erste feste Zelle** in einer Zeile (von der Angreiferseite). | klein | Donnerbüchse, Funken-Magier |
| **Bogen** | Die **oberste feste Zelle** einer Spalte. | mittel | Katapult, Goblin-Kanone |
| **Senkrecht** | Wie Bogen, aber von oben (nicht abfangbar durch Fangnetz). | groß | Meteor, Eiszapfen |
| **Durchschlag** | Flach, setzt sich durch 2–5 Zellen fort (−20 % je Zelle). | – | Ballista, Dicke Berta |
| **Tunnel** | Erste feste Zelle der Keller-/Erdgeschoss-Zeile **unter Tage**. | mittel | Maulwurf-Mörser |
| **Streu** | N kleine Treffer auf zufällige exponierte Zellen. | – | Fledermäuse, Splitter |
| **Luft** | Wie Bogen, aus der Luft; Schütze ist angreifbar. | mittel | Brummzeppelin |

**Reichweiten:** Kurz 14 · Mittel 18 · Weit 22 · Extrem 26 Zellen. Beispiel: Aus der Frontspalte erreicht Reichweite 14 nur die ersten beiden gegnerischen Spalten, der **Kern liegt auf Reichweite ≈ 16–17**. Frühe Artillerie kann den Kern also nicht erreichen; dafür braucht es Mittel-/Weit-Geschütze oder die **Sternwarte** (+2).

**Zielwahl:** Aus den für die Flugbahn **exponierten** Zellen (§7.2) wählt die Einheit nach ihrer **Zielpriorität**:

| Priorität | Wählt |
|---|---|
| **Chirurg** (Standard) | Exponierte Zelle mit dem höchsten **Funktionswert** (Räume mit Personal, Heilquellen, Plattformen vor Mauern). |
| **Brecher** | Die nächste exponierte Zelle, die den Weg zum Kern am schnellsten öffnet. |
| **Kernjagd** | Den Kern, sobald er exponiert ist; sonst die Zelle, die ihn am schnellsten freilegt. |
| **Dachjäger** | Plattformen, Türme, Schilde (also gegnerische Artillerie und Abwehr). |
| **Streuer** | Zufällige exponierte Zelle (gut gegen Bürger/Zivilisten, schlecht gegen Panzerung). |

**Geschosse sind sichtbar** (Flugzeit 1,0–2,2 s ⚙), man sieht sie kommen. Abfangen können nur ausgewählte Abwehr-Bauteile (Katalog 01, BA).

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
- **Wachzone** (pro Karte in der Pause gewählt): *Tor*, *Mitte* (freier Streifzug im Erdgeschoss), *Kernkammer*. Standard je nach Einheit.
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

### 7.2 Beschuss-Geometrie: Exposition 🟨 (P0)

Das ist das **Herzstück** der Zerstörung. Jede Zelle ist **fest** (Mauer oder Raum), **leer** (nicht bebaut: Luft) oder **Trümmer** (Luft für Geschosse).

- **Flach** wählt eine Zeile y; das Geschoss trifft die **erste feste Zelle** von der Angreiferseite. Die Zelle ist „flach-exponiert“.
- **Bogen/Senkrecht/Luft** wählen eine Spalte x; das Geschoss trifft die **oberste feste Zelle**. Die Zelle ist „bogen-exponiert“.
- **Tunnel** trifft die erste feste Zelle der **Keller-** (sonst Erdgeschoss-) Zeile, vom Erdreich aus.
- **Durchschlag** zählt durch die Zeile und verliert 20 % Schaden pro durchquerter Zelle.
- **Erdreich** schützt den Keller vor seitlichen Treffern; von oben (offene Spalte) ist er treffbar.
- **Schaden an einer Zelle** wirkt auf das Bauteil, das sie belegt. Mehrzellige Bauteile haben **einen** HP-Pool; jede ihrer Zellen leitet Treffer dorthin.
- **Splash (Radius r):** Nachbarzellen in Radius r erhalten 50 % Strukturschaden. **Personenschaden** trifft alle Einheiten im Einschlagraum voll und in Nachbarräumen zu 60 %.
- **Folge 🟦:** Zerstörte Zellen werden Trümmer → dahinter liegende Zellen werden exponiert → Artillerie „gräbt sich“ zum Kern. Mauern vorne und Schilde/Reparatur sind also echte Verteidigung.
- **Beschädigte Zellen** in Reichweite haben Vorrang bei *Chirurg/Brecher* (damit Treffer nicht verpuffen).

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
| **Gehärtet / Satt / Angespornt** | +Rüstung / +Max-HP / +Angriffstempo. | variabel |

### 7.5 Türme 🟦/🟨

Türme (Katalog 01, BT) schießen **auf Feinde im Feld und in Reichweite** (also auch Eindringlinge in der Nähe), nicht auf Bauteile. Sie benötigen **Personal** (1 Posten) und verhindern so, dass Sturmtruppen ungehindert über das Feld rennen. Ihre Reichweite ist bewusst kurz (5–8 Zellen), sie decken nur den vorderen Teil des Niemandslands.

### 7.6 Besetzung & Eroberung 🟦/🟨 (P0)

- **Besetzung** zählt Feinde (Sturmtruppen) *lebend in der Kernkammer*; Goblin-Kanonenfutter zählt halb.
- **Fortschritt** der Eroberungsleiste: `Rate = (4 + 2 × (n − 1)) %/s`, ⚙ max 5 Eindringlinge. Beispiel: 3 Eindringlinge → 8 %/s → 100 % in ca. 12,5 s.
- **Gesperrt**, solange ein lebender Verteidiger (oder Kern-Hüter) der Bastion in der Kernkammer steht. Der Fortschritt wird dann nicht abgebaut.
- **Abbau:** Ohne Eindringlinge sinkt die Leiste um ⚙ 6 %/s.
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
- **Anti-Snowball** 🟨: Zeit-XP ist gedeckelt, Rang-Differenz-Bonus hilft Unterlegenen, Todesmut ohne Heilquelle erzeugt Gegen-Dynamik, Wahnsinn (§3.7) beendet Patts.

---

## 9. Kerne, Welt-Launen, Chaos 🟨

### 9.1 Kern-Typen (P1)

Jeder Kern hat eine **Passive** und eine **aktive Fähigkeit** (Abklingzeit 70–90 s), die der Spieler per Klick während der Schlacht auslöst. Das ist der einzige Echtzeit-Eingriff und gibt Zuschauern einen Moment der Kontrolle. 8 Typen in Katalog 03 (z. B. *Sonnenkuchen-Herz, Kuckucksei, Uhrwerk-Herz, Schwatzendes Herz*).

### 9.2 Welt-Launen (P2)

Optional wählt das Spiel (oder die Spieler) vor dem Match eine **Welt-Laune**, eine kleine globale Regeländerung mit sichtbarem Wetter und Ausbrüchen (*Froschregen, Käsemond, Schwerkraft-Schluckauf …*). 12 Stück in Katalog 03. Sie sorgen für Wiederspielwert und das Gefühl einer verrückten Welt, ohne die Grundregeln zu brechen.

### 9.3 Chaos-Karten (P2)

Einmalige Effekt-Karten (*Meteor, Zeitriss, Froschregen, Notfall-Reparatur*). Erst nach Prototyp entscheiden, ob sie das Spiel bereichern oder verwässern.

---

→ Weiter mit [`GDD-Praesentation-Technik.md`](GDD-Praesentation-Technik.md): Pixel-Art-Richtlinien, Zeitstopp-Regie, UI, Technik, Roadmap, offene Fragen.
