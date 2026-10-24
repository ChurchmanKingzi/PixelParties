# MoniaBot — Einrichtung und Bedienung

MoniaBot ist der Discord-Bot für den Pixel-Parties-Server. Er läuft als zweiter Dienst (`moniabot`) auf dem
netcup-Server neben dem Spiel, rund um die Uhr, und startet nach jedem Neustart der Maschine von selbst.
Der Code liegt im Ordner `bot/`, die Schnittstelle zum Spiel in `bot-api.js`.

> **Zwei Geheimnisse, die nie in einen Chat, ein Foto oder ins Repo gehören:**
> das **Bot-Token** (das Passwort des Bots) und das **BOT_SECRET** (der Schlüssel zwischen Spiel und Bot).
> Wer das Token hat, kann den Bot übernehmen. Ist es versehentlich irgendwo gelandet:
> Developer Portal → Bot → *Reset Token*, das alte ist sofort wertlos.
>
> Den **Public Key** aus dem Developer Portal brauchst du *nicht* — er gehört zu einer anderen Betriebsart
> (HTTP-Interaktionen). MoniaBot verbindet sich wie ein normaler Bot über das Gateway.

---

## Teil A — Einrichtung (einmalig, ca. 30 Minuten)

### Schritt 1 · Developer Portal vorbereiten

1. Öffne <https://discord.com/developers/applications> und wähle die Anwendung **MoniaBot**.
2. Links **Bot**:
   * **Reset Token** → Passwort bestätigen → das Token **kopieren und sofort in einem Passwortmanager oder einer
     Textdatei auf deinem Rechner ablegen**. Discord zeigt es nur dieses eine Mal.
   * Weiter unten bei **Privileged Gateway Intents** diese **beiden** einschalten und **Save Changes** drücken:
     * ✅ **Server Members Intent** (Beitritte erkennen, Rollen abgleichen)
     * ✅ **Message Content Intent** (`!`-Befehle und Links lesen)
   * Optional: **Public Bot** ausschalten, damit niemand anderes den Bot einladen kann.
3. Den Bot einladen: Auf dem Server (siehe Schritt 3) erzeugt `node index.js --invite` die fertige Einladungs-Adresse.
   Du kannst sie auch jetzt schon benutzen:

   ```
   https://discord.com/oauth2/authorize?client_id=765902004160692245&scope=bot%20applications.commands&permissions=1099914669156
   ```

   Öffne sie im Browser, wähle den Pixel-Parties-Server, bestätige. Der Bot erscheint offline in der Mitgliederliste.
   Die Rechte darin: Nachrichten lesen/senden/löschen, Dateien anhängen, Reaktionen, Rollen verwalten, Mitglieder
   stummschalten und bannen, Server verwalten (nur für AutoMod und den Raid-Schutz). **Administrator** braucht er nicht.

### Schritt 2 · IDs sammeln

In Discord: **Benutzereinstellungen → Erweitert → Entwicklermodus** einschalten. Dann erscheint bei Rechtsklick
„… ID kopieren“. Du brauchst:

| Was | Wie | Pflicht? |
|---|---|---|
| **Server-ID** | Rechtsklick auf den Server-Namen → *Server-ID kopieren* | ja |
| IDs der Rollen **Creator** und **Deputy Monia [MOD]** | Servereinstellungen → Rollen → Rechtsklick auf die Rolle → *Rollen-ID kopieren*; in `bot/.env` als `ADMIN_ROLE_IDS=ID1,ID2` | **empfohlen** — dann zählen nur diese IDs; mit bloßem Namensvergleich könnte sich jemand mit dem Recht „Rollen verwalten“ eine Rolle „Creator“ anlegen |
| Mod-Log-Kanal | Rechtsklick auf den Kanal → *Kanal-ID kopieren* (Kanal nur für Mods sichtbar!) | empfohlen |
| Kanal für neue Karten, Patchnotes, Rangliste, Karte des Tages, Bug-Meldungen | genauso | optional |

Was leer bleibt, ist einfach aus.

### Schritt 3 · Auf dem Server einrichten

Melde dich per SSH an dem Server an (wie sonst auch) und führe nacheinander aus. Jede Zeile einzeln kopieren.

1. **Neuen Stand ausrollen** (holt den Bot-Code; das Spiel wird dabei wie gewohnt kurz neu gestartet):

   ```bash
   cd /opt/pixelparties
   sudo bash deploy/deploy.sh
   ```

   > Voraussetzung: Der Branch mit dem Bot ist in `main` gemergt (Pull Request), denn `deploy.sh` holt immer den Stand
   > des Branches, auf dem der Server steht.

2. **Bot einrichten:**

   ```bash
   sudo bash deploy/moniabot-setup.sh
   ```

   Das Skript installiert die Bausteine, erzeugt das gemeinsame `BOT_SECRET` (in `/opt/pixelparties/.env`), legt die
   Konfigurationsdatei `bot/.env` an, richtet den Dienst ein und startet das Spiel einmal neu (damit es das Secret kennt —
   dabei werden angemeldete Spieler abgemeldet, am besten also nicht zur Stoßzeit).

3. **Token und IDs eintragen:**

   ```bash
   sudo nano /opt/pixelparties/bot/.env
   ```

   Trage hinter `DISCORD_TOKEN=` das Token und hinter `GUILD_ID=` die Server-ID ein, ohne Leerzeichen und ohne
   Anführungszeichen. Dasselbe für die Kanal-IDs, die du nutzen willst. Speichern: **Strg+O**, Enter; Beenden: **Strg+X**.

4. **Starten und prüfen:**

   ```bash
   sudo systemctl start moniabot
   sudo journalctl -fu moniabot
   ```

   Nach ein paar Sekunden muss dort stehen: `[bot] angemeldet als MoniaBot …` und `[cards] Renderer bereit, … Karten`.
   Mit **Strg+C** verlässt du die Anzeige (der Bot läuft weiter). In Discord ist der Bot jetzt **online**.
   Erste Probe im Server: `!help`, dann `!show Teocuilatl`.

### Schritt 4 · Discord-Server einrichten

1. **Rollenreihenfolge** (wichtig, sonst kann der Bot keine Rollen vergeben): *Servereinstellungen → Rollen* →
   die Rolle **MoniaBot** per Drag & Drop **über** alle Rollen ziehen, die sie vergeben soll (Rang-Rollen,
   Reaction-Roles), aber unter Creator/Deputy.
2. **Rang- und Erfolgsrollen anlegen:** im Server `!setupRoles` schreiben. Der Bot legt Bronze, Silver, Gold, Platinum,
   Diamond, Master, Grandmaster (mit den Farben des Spiels) sowie Skin Collector, Veteran, Top 10 und Champion an. Danach die
   Rang-Rollen in der Rollenliste **über** die Standardrollen ziehen, damit die Namensfarbe sichtbar wird.
   > Gibt es auf dem Server schon eine Rolle mit genau so einem Namen, **übernimmt** `!setupRoles` sie — und vergibt/entzieht sie danach
   > automatisch. Hat der Server z. B. ein von Hand vergebenes „Champion“ für Turniersieger, vorher umbenennen. Der Bot verwaltet **nur**
   > die Rollen, die `!setupRoles` angelegt oder übernommen hat (er merkt sich deren IDs); alles andere fasst er nie an. Vor dem ersten
   > `!setupRoles` vergibt er gar keine Rang-Rollen.
3. **AutoMod-Grundnetz (optional):** `!setupAutomod` — blockt „@everyone/@here + Link“ wirklich *vor* dem Senden.
4. **Regeln mit Bestätigungs-Button (optional):** `NEWCOMER_ROLE_ID` und `VERIFIED_ROLE_ID` in `bot/.env` setzen,
   dann im Regelkanal `!setupRules <Regeltext>`.
5. **Kanalrechte:** Der Bot braucht in jedem Kanal, in dem er sprechen soll, *Kanal ansehen, Nachrichten senden, Links
   einbetten, Dateien anhängen*. Den Mod-Log-Kanal nur für Mods und den Bot sichtbar machen.

Nach jeder Änderung an `bot/.env`: `sudo systemctl restart moniabot`.

---

## Teil B — Befehle

Admins sind die Rollen **Creator** und **Deputy Monia [MOD]** (Server-Besitzer ohne eine dieser Rollen zählt *nicht*).
`🔒` = nur Admins; alle anderen Befehle darf jeder. `!help` zeigt immer die aktuelle Liste.

### Karten
| Befehl | Wirkung |
|---|---|
| `!show <Name>` | Bild der ähnlichsten Karte. Bei nicht exakten Treffern gewinnt ein **Hero** (`Teocuilatl` → *Teocuilatl, the Embodiment of Gods*, nicht *Assault for Teocuilatl*). Tippfehler und fehlende Leerzeichen werden verziehen. |
| `[[Name]]` | irgendwo in einer Nachricht: zeigt die Karte (bis zu 3) |
| `!card <Name>` | Kartentext und Werte |
| `!random`, `!cotd` | zufällige Karte; Karte des Tages |
| `!deck <Name>` | Structure-/Starter-Deck (oder eines deiner eigenen, wenn verknüpft) mit Helden-Bild und Deckliste; oder `!deck` mit angehängter Deck-`.txt` |

Die Bilder entstehen mit **demselben Renderer wie im Spiel** (`public/card-render.js`), sind also vollständig
zusammengesetzt und immer auf dem Stand des Spiels. Einen eigenen Bilderordner gibt es nicht.
Karten, die das Spiel nicht aus dem Kunst-Atlas zusammensetzt, sondern als fertige Bilddatei aus `cards/` zeigt (ältere Karten), zeigt der Bot genauso — mit
derselben Zuordnung Kartenname → Datei wie das Spiel (`card-images.js`). Nur Karten, die es weder im Atlas noch als Datei gibt, erscheinen bei `!show` als Text.
Beim Start steht im Protokoll (`journalctl -u moniabot`), wie viele Karten aus Atlas, Dateien oder gar keinem Bild stammen. Ins Mystery-Spiel kommen nur Karten mit Atlas-Kunst.

### Dein Pixel-Parties-Konto
1. Im Spiel: **Profil → Link Discord** → es erscheint `!link ABCD2345` (10 Minuten gültig).
2. Im Discord-Server den Befehl eintippen. Der Bot löscht die Nachricht sofort wieder.

| Befehl | Wirkung |
|---|---|
| `!sc [@Nutzer]` | Smug Coins — angezeigt mit dem **Discord-Namen** (nicht dem Spielnamen) |
| `!profile [@Nutzer]` | Elo, Rang, SC, Bilanz, Skins, Avatar |
| `!daily` | deine Daily Challenge: die drei Helden als **ein** Bild mit dem Text *„Your challenge for today: Win a game with 2, or 3 of these Heroes:“*. Hast du heute noch keine, **startet `!daily` sie**: Die Helden werden nach den Regeln des Spiels gewürfelt und am Konto gespeichert, die Challenge gilt also sofort auch im Spiel (Anzeige und Belohnung). Läuft schon eine, bleibt sie unverändert. |
| `!sync`, `!unlink` | Rollen sofort abgleichen; Verknüpfung lösen |
| `!top [n]` | Rangliste |
| 🔒 `!addsc <Zahl> @Nutzer`, `!removesc <Zahl> @Nutzer` | SC erhöhen/senken (nie unter 0, jede Buchung steht in `sc_log` und im Mod-Log) |
| 🔒 `!setupRoles`, `!syncAll` | Rollen anlegen; alle abgleichen |

**Rollen:** Rang nach Elo (Bronze ab 0, Silver 1200, Gold 1400, Platinum 1600, Diamond 1800, Master 2000, Grandmaster 2200 —
dieselben Stufen wie im Spiel), dazu *Skin Collector* (50+ Skins), *Veteran* (300+ Spiele), *Top 10* und *Champion* (Rangliste).
Der Abgleich läuft alle 10 Minuten, bei `!link` und `!sync`; wer sich im Spiel entkoppelt, verliert die Rollen beim nächsten Durchlauf. Schwellen und Funktionen lassen sich in `bot/.env` ändern
(`SKIN_COLLECTOR_MIN`, `VETERAN_GAMES`); wer eine Erfolgsrolle nicht möchte, löscht sie einfach.

**Was Discord nicht kann:** einen *individuellen* Namens­farbton (Namen färben nur Rollen, max. 250 pro Server — deshalb Rang-Rollen)
und den Avatar eines Mitglieds vom Bot setzen lassen. Optional kann der Bot den Server-Spitznamen auf den Spielnamen setzen
(`SYNC_NICKNAMES=1`).

### Reaction Roles 🔒
```
!setupReaction
Wähle deine Rollen!
🔥 @Fire Fan
🎮 @Gamer
```
Erste Zeile = Befehl, dann Titel (Zeilen ohne Emoji), dann je Zeile `Emoji Rolle` (Rolle als Erwähnung, ID oder genauer Name).
Der Bot postet den Beitrag, reagiert selbst mit allen Emotes und merkt sich die Zuordnung. Wer reagiert, bekommt die Rolle; wer die
Reaktion zurücknimmt, verliert sie. Varianten: `!setupReaction buttons` (Knöpfe statt Reaktionen), `!setupReaction <Nachrichten-ID>`
(bestehenden Beitrag dieses Kanals anbinden). `!listReactions`, `!removeReaction <Nachrichten-ID>`.
Der Bot lehnt Rollen ab, die über seiner eigenen liegen, Rollen mit Verwaltungs-/Moderationsrechten (Administrator, Rollen/Nachrichten/Kanäle verwalten,
Bannen, Kicken, Timeout, @everyone erwähnen …), die Admin-Rollen des Bots und die Rang-/Erfolgsrollen — beim Einrichten und bei jeder Vergabe. Knöpfe (`buttons`) gibt es nur
für **neue** Beiträge des Bots, nicht für bestehende Nachrichten.

### Moderation
* **Der Bot pingt nie `@everyone`, `@here` oder eine Rolle** — nicht bei neuen Karten, geänderten Karten, Spielen, Daily oder sonst irgendwo. Das ist hart eingebaut
  (`bot/lib/mention-guard.js`): Jede ausgehende Nachricht läuft durch eine Sperre, die solche Pings entfernt, selbst wenn irgendwo im Code oder im Text etwas anderes steht.
  Einzelne Personen werden nur dort angesprochen, wo es die Funktion verlangt: Begrüßung neuer Mitglieder, „Nuh-uh“, Mystery-Sieger, Turnier-Paarungen und
  angenommene Duelle.
* **Neues Mitglied** (< 6 Monate auf dem Server) pingt `@everyone`, `@here` oder eine Rolle **und** die Nachricht enthält einen
  Link → Nachricht wird gelöscht, MoniaBot antwortet **„Nuh-uh, not cool, @Nutzer!“**, der Nutzer ist **eine Stunde stummgeschaltet**.
* **Phishing-/Scam-Links** (Liste in `bot/data/blocked-domains.txt` + typische Lookalikes) werden unabhängig von Mitgliedsdauer und Ping genauso behandelt.
* Jede dieser Taten ist ein **Strike**. Der **dritte gültige Strike = Bann**. Strikes **verfallen nach 90 Tagen**.
* 🔒 `!strikes @Nutzer`, `!clearstrikes @Nutzer`.
* Ausgenommen sind Creator, Deputy Monia [MOD] sowie Mitglieder mit Administrator- oder „Nachrichten verwalten“-Recht.
* **Mod-Log:** alle Maßnahmen, Reaction-Role-Fehler und SC-Buchungen landen im `MODLOG_CHANNEL_ID`-Kanal. Phishing-Links werden dort entschärft dargestellt.
* **Raid-Schutz:** 8 Beitritte in 60 s → Alarm im Mod-Log und für 15 Minuten Verifizierungsstufe „Sehr hoch“.
* 🔒 `!setupAutomod`: zusätzliche Discord-AutoMod-Regel.

> **Grenze von Discord:** Ein Bot kann eine Nachricht nicht *vor* dem Senden stoppen, nur Sekundenbruchteile danach löschen.
> Die AutoMod-Regel aus `!setupAutomod` tut das wirklich vorher, gilt dafür aber für alle Nicht-Admins.

### Mystery-Spiel
Nur im Minigames-Kanal (fest eingestellt auf `1561796630762623036`; andere Kanäle bekommen einen Hinweis). Dasselbe gilt für Pixle (nächster Abschnitt).

| Befehl | Wirkung |
|---|---|
| `!mystery` | zeigt das aktuelle Rätsel: ein winziger Ausschnitt aus der Kunst einer Karte. Er **beginnt bei 8×8 Bildpunkten** (stark vergrößert) und wird mit **jedem falschen Tipp von irgendjemandem um einen Bildpunkt größer** (gleicher Mittelpunkt, höchstens 31×31). Nach einem falschen Tipp zeigt der Bot gleich das neue Bild. Gibt es noch kein Rätsel, entsteht eins. |
| `!guess <Kartenname>` | Tipp. Richtig → die Karte wird komplett gezeigt und ein **neues Rätsel** startet. Ist das Rätsel SC wert (siehe unten), bekommt der Gewinner **20 SC, minus 2 für jeden falschen Tipp, den er für diese Karte schon abgegeben hat** (nie unter 0). |
| 🔒 `!mystery skip` | Rätsel überspringen (Lösung zeigen, nächstes starten; das neue Rätsel folgt denselben Stunden-Regeln) |

* **Rätsel entstehen unbegrenzt — aber nur das erste neu erzeugte Rätsel jeder vollen Stunde ist SC wert** (Uhrzeit-Stunden: 12:00–12:59, 13:00–13:59 …). Alle weiteren in derselben Stunde sind Übungsrätsel: gleiches Spiel, keine SC. Ob ein Rätsel SC zahlt, steht in seiner Nachricht („💰 Worth 20 SC“ bzw. „No SC for this one …“). Es wird bei der **Erzeugung** festgelegt: ein offenes SC-Rätsel bleibt SC wert, auch wenn es erst Stunden später gelöst wird. Wird in einer Stunde nichts gespielt, ist das nächste erzeugte Rätsel wieder SC wert.
* **SC** gibt es nur mit verknüpftem Konto (`!link`). Alle anderen dürfen mitraten und gewinnen, bekommen aber keine SC (der Bot sagt es ihnen). Die Buchung steht in `sc_log` mit dem Grund `bot:mystery`.
* Tipps werden großzügig erkannt (Groß-/Kleinschreibung, Tippfehler, fehlende Leerzeichen, bei Heroes reicht der Teil vor dem Komma, sofern eindeutig). Tipps, die **keiner Karte ähneln**, bereits **getippte** Karten und **mehrdeutige** Tipps („Alice“ passt auf mehrere Heroes) zählen nicht.
* **Es wird nie etwas gezeigt, das auf der fertigen Karte verdeckt ist.** Bei Vollbild-Karten (Ascended Heroes und Helden mit Fullart-Rahmen) liegen Namensleiste, Fähigkeiten-, Text- und Wertefelder über dem Bild; ebenso ragen bei Zaubern und Kreaturen das Schul- und das Stufen-Symbol in die Bildecken. Der Bot nutzt dieselbe Rahmenmaske wie das Spiel und zeigt nur Stellen, die auf der Karte voll sichtbar sind — beim Start und bei jedem Vergrößern. Stößt der Ausschnitt an ein Feld, wächst er dort nicht weiter (der Bot sagt es dann). Der Start-Ausschnitt wird bei Vollbild-Karten so gewählt, dass er vorher noch genug Platz zum Wachsen hat.
* Doppelte, unbekannte und mehrdeutige Tipps lassen das Bild unverändert. Die Startgröße und der Schritt (16 % bzw. 2 % der kürzeren Bildseite) stehen in `bot/lib/mystery.js` (`CROP_START`, `CROP_STEP`, `CROP_MAX`).
* Die Ausschnitte werden aus mehreren zufälligen Kandidaten nach Kontrast gewählt, damit es nie nur Himmel oder eine Einheitsfläche ist; die zuletzt gespielten 60 Karten kommen nicht wieder dran.
* Einstellbar in `bot/.env` (alles optional, **nichts davon ist nötig**): `MINIGAMES_CHANNEL_ID` (gemeinsamer Kanal aller Minispiele; die ältere Variable `MYSTERY_CHANNEL_ID` gilt weiter als Rückfall), `MYSTERY_REWARD=20`, `MYSTERY_PENALTY=2`.

### Pixle (tägliches Karten-Ratespiel)
**Jede Person hat ihr eigenes Pixle:** eine eigene geheime Karte, die der Bot zufällig wählt und speichert (Tageswechsel um Mitternacht Berliner Zeit). Das erste Spiel des Tages ist die **tägliche Karte** der Person. Weil die Karten individuell sind, kann niemand bei anderen mitlesen oder deren Lösung „snipen“ — fremde Tipps und Bretter helfen nichts. Man rät Kartennamen und sieht nach jedem Tipp, wie dessen Eigenschaften zur geheimen Karte stehen — so grenzt man sie ein und lernt nebenbei Typen, Werte, Schulen und Sets kennen. Nur im Minigames-Kanal.

| Befehl | Wirkung |
|---|---|
| `!pixle` | Regeln bzw. dein laufendes Spiel mit Brett (am neuen Tag: dazu deine vorherige tägliche Karte) |
| `!pixle <Kartenname>` | ein Tipp; danach kommt dein Brett als Bild: eine Zeile je Tipp |

* **Spalten:** Type, Subtype, Level, HP, ATK, Cost, School, Set (der Archetyp ist bewusst kein Hinweis). Farben: 🟩 gleich · 🟨 nah dran bzw. teilweise gleich (Zahl ±1 bei Level/Kosten, ±15 % bei HP/ATK; eine gemeinsame Schule; Hero ↔ Ascended Hero) · 🟥 anders. Bei Zahlen zeigt ein **▲/▼**, ob die **geheime** Karte mehr oder weniger hat. „–“ heißt: die Karte hat den Wert nicht (haben beide keinen, ist das ebenfalls grün).
* **10 Tipps pro Person und Spiel** (jede Person hat ihre eigenen Spiele und Bretter). Sind alle Tipps verbraucht, nennt der Bot die Lösung — nur als **Spoiler**.
* **Nach jedem Spiel startet sofort ein neues** (gelöst oder nicht): ein **Übungsspiel** mit einer frischen, eigenen Karte (nie die tägliche, nie eine der zuletzt geübten), unbegrenzt oft. Die Spiele laufen pro Person nacheinander; `!pixle <Name>` gilt immer für das laufende. Am neuen Tag beginnt alles wieder mit der neuen täglichen Karte.
* **SC gibt es nur für das erste Spiel des Tages — die tägliche Karte, also höchstens einmal pro Tag UND Person:** 30 SC, minus 3 für jeden falschen Tipp davor, mindestens 3 — nur mit verknüpftem Konto (Buchung mit dem Grund `bot:pixle`). Übungsspiele zahlen nie SC, auch nicht, wenn man die tägliche Karte verfehlt hat.
* **Spoilerschutz:** Beim Lösen steht die Karte nur in Spoiler-Tags (Text und Bild), und das Brett zeigt die richtige Zeile als „SOLVED!“. Der Sieg im Übungsspiel pingt niemanden.
* Tipps werden großzügig erkannt (Tippfehler, Groß-/Kleinschreibung, Leerzeichen); unbekannte, doppelte und mehrdeutige Tipps („Alice“) zählen nicht. Farbvarianten (`[B]`/`[W]`) gelten als dieselbe Karte.
* Die geheime Karte jeder Person wird beim ersten Aufruf des Tages **zufällig** gewählt und gespeichert (nicht aus dem Datum berechenbar — der Code ist öffentlich); die Karten der letzten 120 Tage dieser Person kommen nicht wieder dran. Es erscheinen nur Karten, die der Bot als Bild zeigen kann, keine Token.
* Einstellbar in `bot/.env` (alles optional): `PIXLE_MAX_GUESSES=10` (je Spiel), `PIXLE_REWARD=30`, `PIXLE_PENALTY=3`.

### Feeds und Gemeinschaft
* **Neue Karten:** Ändert sich `data/cards.json` (z. B. durch ein Deploy), postet der Bot jede neue Karte (mit Kartenbild) als eigene Nachricht — nur das Bild
  mit der Tagline `**New card beep-boop:**` — in den Kanal für neue Karten (**fest** `774670375303905291`; eine Variable `NEW_CARDS_CHANNEL_ID` in der `.env` wird ignoriert und beim Start gemeldet).
  Der allererste Lauf merkt sich nur den Bestand. Eine neue Karte erscheint erst, wenn ihr Kartenbild vorhanden ist (`data/card-art/index.json`).
  **Nichts geht still verloren:** Karten gelten erst als „bekannt“, wenn die Nachricht wirklich gesendet wurde. Ist der Kanal nicht erreichbar (falsche ID, dem Bot fehlen
  *View Channel* / *Send Messages* / *Attach Files*) oder scheitert das Senden, bleiben die Karten offen, der Bot versucht es bei jedem Lauf erneut und meldet das Problem **einmal je Fehler**
  im Moderationsprotokoll und im Journal (`journalctl -u moniabot | grep feeds`). Forum-Kanäle werden unterstützt (je Karte ein Beitrag). Patchnotes und Bugfixes verhalten sich genauso.
  Verpasste Karten stellt `!announce <Karte>; <Karte>; …` (nur Staff, Namen mit `;` trennen) von Hand in den Kanal.
* **Patchnotes:** Karten, deren Eintrag in `data/cards.json` sich seit dem letzten Stand **verändert** hat (Text, HP, ATK, Kosten, Level …), werden als **Bilder**
  in `PATCHNOTES_CHANNEL_ID` gepostet, mit dem Hinweis, was sich geändert hat („changed: effect text, HP“). Commit-Texte erscheinen nicht. Ganz neue Karten
  kommen nicht hierher, sondern in den Feed für neue Karten; rein interne Felder (`skilltestLegal`, `setID`) lösen nichts aus.
* **Bugfixes:** Nach jedem Deploy (Bot erkennt einen neuen Git-Stand) postet der Bot die Karten, deren **Effekt-Skript** (`cards/effects/<karte>.js`) **geändert** wurde, als Bilder
  in den Bugfix-Kanal (Standard `1562197315437989889`, überschreibbar mit `BUGFIXES_CHANNEL_ID` — in `bot/.env` musst du nichts eintragen).
  Zählt nur, wenn sich echter Code geändert hat (Kommentare/Leerraum ignoriert); neu hinzugekommene oder gelöschte Skripte gelten nicht als Bugfix.
  Wird ein gemeinsamer Baustein (`cards/effects/_*.js`) geändert, erscheinen die Karten, die ihn nutzen . Betrifft er mehr als
  `BUGFIX_MAX_SHARED` Karten (Standard 12), gibt es nur eine Textzeile mit Baustein und Kartenanzahl, keine Bilder. Commit-Texte erscheinen nie; niemand wird gepingt.
  Der allererste Lauf merkt sich nur den Stand.
  **Balancing ist kein Bugfix:** Hat sich der Eintrag einer Karte in `data/cards.json` geändert (Effekttext, HP, Kosten …), erscheint sie nur in den Patchnotes — auch wenn das Skript mitgeändert wurde.
  **Fehlerbeschreibung:** Wer einen Bug behebt, schreibt in die Commit-Nachricht pro Karte/Baustein eine Zeile `Bugfix-Note: <Kartenname oder _baustein> | <was schiefgelaufen ist, Englisch>`
  (steht auch in `CLAUDE.md`, damit Agenten es tun). Der Bot zeigt den Text unter der Karte; bei breiten Bausteinen hinter dem Namen. Eine Karte mit `Bugfix-Note` erscheint auch dann,
  wenn die Erkennung sie nicht fand oder sie wegen einer gleichzeitigen Textänderung als Balancing galt. Ohne Note erscheint die Karte ohne Erklärung.
* **Rangliste:** `LEADERBOARD_CHANNEL_ID` → eine Nachricht, die alle 10 Minuten aktualisiert wird.
* **Karte des Tages:** `CARD_OF_DAY_CHANNEL_ID` → täglich ab 12:00 Berliner Zeit, mit dem Hinweis „Win a game using **X** today to earn **30 SC**!“.
  Die Karte wählt das **Spiel** (`card-of-day.js`, abhängig vom Berliner Datum; im Pool ist jede Karte außer Tokens und Karten ohne Effekt-Skript oder ohne Bild — gebannte Karten und Ascended Heroes gehören dazu). Die Wahl des Tages wird in der Spiel-Datenbank (`card_of_day`) festgehalten, damit ein Deploy mittags sie nicht ändert — der Bot fragt sie über die Bot-Schnittstelle ab
  (`GET /api/bot/cotd`), deshalb ist sie im Discord und für den Bonus immer dieselbe. Der **Bonus „Card of the Day!“ (30 SC)** wird im Spiel gezahlt, für einen **Sieg** in einem Spiel,
  in dem man die Karte **benutzt** hat — von der Hand, per Effekt aus Deck/Ablage, als Startheld oder Startfähigkeit, als Aszendierung (auch eine negierte Karte gilt als gespielt; nur gezogen/abgeworfen/gemillt
  zählt nicht). **Einmal je Berliner Tag und Spieler**; es gelten dieselben Anti-Farm-Regeln wie bei den anderen SC-Boni (Mindestdauer, Mindestzüge, Siege durch Verbindungsabbruch zählen nicht).
  Der Betrag steht in `data/sc-rewards.json` (`card_of_the_day`). Das Spiel zeigt „Card of the Day! — Daily!“ im Ergebnisbildschirm.
* `!duel` — offene Herausforderung; wer „Accept“ klickt, bekommt den Gegner genannt (verabredet wird im Spiel unter *Who’s Online*).
* **Turniere (K.-o.)** 🔒: `!tournament create <Name>` → Spieler klicken **Join** → `!tournament start` (Auslosung, Freilose) →
  `!tournament win @Sieger` pro Spiel → Bracket und nächste Paarungen werden automatisch gepostet. Außerdem `dq @Nutzer`, `bracket`, `cancel`.
  Die Ergebnisse trägt ein Admin ein; das Spiel meldet sie nicht von selbst.
* **`/bug`** — Slash-Befehl mit Titel, Beschreibung, optional Screenshot → `BUG_CHANNEL_ID` (und, mit `GITHUB_TOKEN`, als GitHub-Issue).
* **Willkommen:** neue Mitglieder werden im Willkommenskanal (`WELCOME_CHANNEL_ID` oder Systemkanal) mit dem festgelegten Text begrüßt.

---

## Teil C — Betrieb

| Aufgabe | Befehl |
|---|---|
| Läuft der Bot? | `sudo systemctl status moniabot` |
| Protokoll live | `sudo journalctl -fu moniabot` (Strg+C beendet die Anzeige) |
| Neustart | `sudo systemctl restart moniabot` |
| Stoppen / wieder starten | `sudo systemctl stop moniabot` / `sudo systemctl start moniabot` |
| Update | `cd /opt/pixelparties && sudo bash deploy/deploy.sh` (aktualisiert und startet auch den Bot neu) |
| Einladungs-Adresse neu erzeugen | `cd /opt/pixelparties/bot && node index.js --invite` |

Die Daten des Bots (Strikes, Reaction-Role-Zuordnungen, Turniere) liegen in `bot/data/moniabot.db` — **diese Datei ins Backup aufnehmen**.

### Wenn etwas nicht geht
| Symptom | Ursache / Abhilfe |
|---|---|
| Bot bleibt offline, Protokoll: `Used disallowed intents` | Schritt 1: Beide Intents im Developer Portal einschalten, speichern, Bot neu starten. |
| `Konfiguration unvollständig: DISCORD_TOKEN fehlt …` | `bot/.env` ausfüllen (Schritt 3). |
| `An invalid token was provided` | Token falsch kopiert oder zurückgesetzt → neues Token in `bot/.env`. |
| Bot online, antwortet auf `!`-Befehle nicht | Message Content Intent fehlt; oder der Bot darf im Kanal nicht schreiben. |
| `!setupReaction`: „at or above my own role“ | MoniaBot-Rolle in der Rollenliste nach oben ziehen (Schritt 4.1). |
| `!link` → „The game server isn’t reachable“ | `sudo systemctl status pixelparties`; läuft das Spiel, `BOT_SECRET` in `/opt/pixelparties/.env` prüfen und beide Dienste neu starten. |
| Im Profil fehlt der Block „Discord“ | `BOT_SECRET` fehlt in `/opt/pixelparties/.env`, oder das Spiel wurde danach nicht neu gestartet. Gäste sehen den Block nie. |
| Rangrollen werden nicht vergeben | Rollen fehlen (`!setupRoles`) oder liegen über der Bot-Rolle. |
| Bot meldet keine neuen Karten | Kanal-ID leer/falsch, oder der Bot darf dort nicht schreiben (Protokoll prüfen). |

## Teil D — So hängt es zusammen (für Entwickler)

```
Discord ⇄ MoniaBot (bot/, discord.js, Gateway)
              │  HTTP, nur 127.0.0.1, Header x-bot-secret
              ▼
        Spielserver (server.js → bot-api.js)  ── users.discord_id, sc, elo, Daily …
```
* `bot-api.js`: Spieler-Routen `/api/discord/*` (Einmalcode, 10 min) und Bot-Routen `/api/bot/*`. Ohne `BOT_SECRET` aus; über den Proxy
  (Header `X-Forwarded-For`) und in der `Caddyfile` ebenfalls gesperrt.
* `bot/lib/card-renderer.js` führt `public/card-render.js` unverändert in Node aus (`@napi-rs/canvas`) — Kartenbilder sind pixelgleich zum Spiel.
* `bot/lib/card-search.js` (Kartensuche), `scam.js`, `roles-logic.js`, `bracket.js`, `deck.js`: reine Logik mit Tests.
* Tests: `cd bot && npm test` (ohne Discord-Anmeldung, mit Attrappen).
