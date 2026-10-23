# Fix-Welle 63c – Besitzer-Regel für gestohlene/geschenkte Handkarten (Charme Lv 2 & Verwandte)

Umgesetzt vom Agenten **W63c** (Zweig `wave63/W63c`), Befund von Al (Spieldesigner): *„Karten, die via Charme Lv 2 gestohlen werden, landen beim Abwerfen/Deleten und vermutlich auch beim Mischen ins Deck in den Piles ihres DIEBES statt beim ursprünglichen Besitzer."* Details und Audit-Tabelle: `cards/effects/CARD_API.md`, Abschnitt „Welle 63 / W63c"; Repros `docs/niche-tests/repro/W63/c-01` … `c-07` (Exit 0 = korrekt), Hilfen `docs/niche-tests/lib/besitzer.js`.

## Ursache

Die Regel („Karten landen immer in den Stapeln ihres permanenten Besitzers", W3/Welle 5) hing an einer **Herkunftsmarke pro Handplatz** (`ps._handOriginals`), die nur taggende Wege (Charme, Infiltration, Key, Magic Lamp …) setzten, und an `inst.originalOwner` der Brettinstanz, die nur Creature/Spell/Artefakt vom Handspiel übernahmen. Alles andere fiel auf „Halter = Besitzer" zurück:

* **Griffe und Geschenke** (`actionStealFromHand`: Thieving Strike, Loot the Leftovers, Gather Intel, Live Show · `actionTransferCardToOppHand`: Cool Presents, Live Show, Hat of Madness, Santa Klaus, Chatty Town Guard, Crystal Well, Saint Nicolas) nahmen die Instanz mit, aber **keine Marke** — Abwerfen, Löschen, Spielen, Mischen, Mulligan, Handlimit gingen zum Halter.
* **Charme Lv 2** nahm „Besitzer = Geber" an; eine schon vorher gestohlene Karte (Gegenrichtung) gehörte nach dem Zurückklauen dem falschen Spieler.
* **Hand → Brett**: Ausrüstung, Ability, Surprise, Area, Anhängsel, Free-Side-Equip und alle Skript-Beschwörungen stempelten die Brettinstanz nicht (→ Zerstören/Opfern in die Ablage des Diebs; Geister-Handinstanz).
* **~15 Hand-Reaktionsfenster** + Reaktionskette und **~20 Skripte** mit direktem `ps.discardPile/deletedPile.push` legten die Karte beim Halter ab; Sofort-Guss (`_castSpellImmediately`), Coolness Stack ebenso.
* **Bounce** einer gestohlenen/übernommenen Kreatur ging in die Hand des Kontrolleurs, `reorder_hand` ohne Permutation strich alle Marken.

## Umsetzung (zentral)

| Baustein | Inhalt |
|---|---|
| `_setHandSlotOrigin`, `_handOriginAt` (Instanz-Fallback) | Marke an jedem Eintritt in eine fremde Hand; fehlt sie, zählt `inst.originalOwner` der Hand-Instanz dieses Platzes (Letter, Magic Lamp, Birthday Present …). |
| Fremd-Abgangsbuch `ps._fremdAbgang` (+ `_bucheFremdAbgang`/`_nimmFremdAbgang`/`_peekFremdAbgang`) | Jede fremde Karte, die die Hand verlässt, wird gebucht, bis sie einen Stapel/das Brett erreicht — übersteht weitere Splices (Reaktionen im Kettenfenster). |
| Brett-Netz `_trackCard` → `_stempelFremdHerkunft` | Support/Ability/Surprise/Area/Hero: Instanz trägt den Besitzer, Geister-Handinstanz weg; `originalOwner` gesperrt (Überschreiben mit dem Dieb wirkungslos), `markiereSeitenfremd` respektiert sie. |
| `handKartenBesitzerPs` (Buch-Fallback), `handZugangRueckgabe`, `_pileOwnerFlug` | Stapelwahl, „unverrichtet zurück", Flug nach `toOwner`. |
| Bounce/Heimkehr | `actionMoveCard` (`_heimkehr`) und `returnSupportCreatureToHand`: Besitzer statt Kontrolleur (Text „YOUR hand" → `opts.toPlayer`, Karte bleibt gekennzeichnet). |
| `herkunftNachNamenVerteilen` | `reorder_hand` ohne gültige Permutation verteilt die Marken nach Namen. |

Geändert: `cards/effects/_engine.js`, `server.js` (`doPlaySpell`, Equip/Artefakt-Fizzle, `reorder_hand`), `_attachment-shared`, `_deepsea-shared`, `_bottled-shared`, `_crusader-shared`, `_cybug-shared`, `charme`, Karten: Anti Magic Enchantment, Bomblebee Cluster, Cooldin, Criminal Monkee, Dive Down, Jump in the River, Learning, Love Shot, Nieht, Pollution Piranha, Suspicious Monster, Taio, Unwanted Audience. Kartentexte (`data/cards.json`) unverändert; `public/` unverändert.

## Tests

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `W63/c-01-charme-lv2-gestohlene-handkarte-stapel-des-besitzers.js` | Charme Lv 2, beide Sitze: Zwangs-/gezielter/Mehrfach-/animierter Abwurf, Handlimit (Ablage, Löschen), Zwangs-Löschen, Spell/Potion/Artefakt spielen, Zurückmischen, Mulligan; Gegenproben (eigene Karte, eigene + gestohlene Kopie) | 108 | 0 ✗ (Wächter: die Grundwege waren schon richtig, M01-16) |
| `W63/c-02-gestohlene-karte-aufs-brett-abgang-zum-besitzer.js` | Ausrüstung, Free-Side-Equip, Kreatur (zerstört, Schaden, Bounce → Besitzerhand → abgeworfen), Ability, Surprise, Area, Anhängsel; Gegenprobe | 86 | 38 ✗ |
| `W63/c-03-hin-und-zurueck-und-gegenproben-eigene-karte-bleibt-eigen.js` | Charme hin und zurück (beide Richtungen), Handzähler/Handlimit, eigene Kopie nach abgeworfener fremder (kein Fremdstempel), eigene + gestohlene Kreatur gleichzeitig auf dem Brett, `reorder_hand` ohne Permutation | 38 | 6 ✗ |
| `W63/c-04-diebstahl-und-geschenk-wege-bleiben-eigentum-des-besitzers.js` | `actionStealFromHand`/`actionTransferCardToOppHand` × 7 Austritte × beide Sitze, hin und zurück, zweimal klauen, gleichnamige Kopien, Cool Presents, Thieving Strike | 134 | 40 ✗ |
| `W63/c-05-skript-wege-hand-zu-brett-und-stapel-zentrale-herkunft.js` | `takeFromPileSync` + `safePlaceInSupport`/`summonCreatureWithHooks` (auch seitenfremd), Stapel trotz Zwischen-Splices, `handZugangRueckgabe`, Army of the Cute, Bottled Flame, Sofort-Guss (Spell, Anhängsel) | 80 | 40 ✗ |
| `W63/c-06-gestohlene-reaktionskarte-aus-der-hand-zum-besitzer.js` | Bamboo Shield, Spectral Armor aus gestohlener Hand als Reaktion | 16 | 8 ✗ |
| `W63/c-07-herkunft-nur-an-der-instanz-ohne-platzmarke.js` | Herkunft nur an `inst.originalOwner` (Letter, Magic Lamp, Birthday Present) × 7 Austritte + Brett + Gegenproben; echter Weg `addCardFromDiscardToHand` (Karte aus der Ablage des Gegners auf die Hand: Herbithorn Demon & Co.) | 76 | 34 ✗ |

* `Bugfix-Note` (in den Commit-Nachrichten): Charme, Thieving Strike, Loot the Leftovers, Cool Presents, Live Show, Hat of Madness, Santa Klaus sowie die Bausteine `_engine`, `_attachment-shared`, `_deepsea-shared` und die geänderten Skripte (siehe oben).

## Rückfragen an Al

> **W64c (23.10.2026):** alle drei beantwortet — 1. Bounce → Hand des aktuellen **Kontrolleurs** (Herkunft bleibt; W63c-Annahme zurückgenommen), 2. Coolness Stack: ja, 3. Core/Gun: Ablage des Kontrolleurs (Ist-Zustand). Siehe `FIXES-WELLE-64c.md`.

1. **Bounce einer gestohlenen/übernommenen Kreatur** (Text ohne „YOUR hand"): Hand des **Besitzers** (neu) statt des Kontrolleurs — ja/nein?
2. **Coolness Stack**: Stapel gehört dem Halter, Ablage/Löschen/Hand-Rückgabe gehören dem Besitzer der Karte — ja/nein?
3. **Core/Gun an übernommenem Helden**: weiter die Ablage des Kontrolleurs (Ruling W58/W28a) — ja/nein?
