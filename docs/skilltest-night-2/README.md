# Skill Test — Lernlauf 8.10. (nach Merge von PR #436)

Frischer Lauf mit dem Stand vom 8.10.: Stun-/Frost-Erneuerung abgeschafft, Fristen enden mit der Round, Hand-Regeln v2 (nie über 18, Partner reserviert, Zwei-Schulen-Lv-3-Spells),
bereinigter Pool, Ziehen und Mulligan von außerhalb des Spiels, Idej-Pakete, **freie Ability-Effekte der Bots**, **Mulligan-Kanal**, **Antworten auf Zauber-Auswahlabfragen**.

| | |
|---|---|
| Partien | 11 705 (295 verworfen = 2,5 %, alle Patt am Rundenlimit; 9 Zeitüberschreitungen, in einer Nachsuche mit 1 500 geseedeten Partien nicht reproduzierbar) |
| Rate | ≈ 89 Partien/min (4 Worker) |
| Pool | 879 Karten (193 als spielbar markierte Karten ohne Bild in `cards/` fehlen, darunter 25 Heroes) |
| Dateien | `report-4000.md`, `report-8000.md`, `report-11705.md` (Kartenlisten), `milestone-*.json`, `index.md`, `bench.jsonl`, `profile.json` (kompaktes Profil, `--min-n 4`; wie `data/skilltest-profile.json` zu verwenden) |
| Top-Liste | [`../skilltest-top-cards.md`](../skilltest-top-cards.md) — Spitze, Spitze je Kartentyp, schwächste Heroes, größte Auf-/Absteiger gegenüber dem alten Lauf |

## Messungen (gepaart, geseedet, Fokus-Sitz gegen Live-Personas; Standardfehler ≈ ±2 Prozentpunkte bei 500 Paaren)

| Frage | Ergebnis |
|---|---|
| Horn in a Bottle: zurückmischen (`weak`) statt liegen lassen (`skip`) | +1,4 Punkte Siegquote (McNemar-z 0,68); `more`: +1,6 (0,78); Karte gar nicht dabei: −1,0 (−0,49) |
| Leadership Lv3 (jede Round frei): `weak` / `more` statt `skip` | −1,6 / −1,6 (z −0,81); ohne Leadership: −0,6 |
| Freie Ability-Effekte der Bots an gegen aus (600 Paare) | aus: +1,0 Punkte (z 0,56) — kein messbarer Unterschied |
| Grundwert des Ziehens 0 / 50 / 100 | identische Partien (0 abweichende Paare): ohne gelerntes Profil und ohne Lookahead hat der Wert keine Wirkung; er wirkt beim Lernen (`playValue`) und im Lookahead |

**Einordnung:** Karten tauschen (Mulligan) und zusätzliches Ziehen verändern die Siegquote im Rahmen der Messgenauigkeit nicht — jedenfalls nicht mit einer einzelnen Quelle.
Der Mulligan-Kanal lernt trotzdem mit (`profile.mull` / `mullX`) und entscheidet erst bei klarem Vorsprung (30 erkundete Beobachtungen je Arm, 0,04 Platzierungsgüte).
Im Lauf: in der späten Phase (Round ≥ 6) liegt der Arm `more` (auch Grenzfälle zurück) bei 0 bis 3 schwachen Handkarten um 0,00 bis +0,20 vor `weak`/`skip` — im Mittel unter der Schwelle.

## Zaubernutzung

* Anteil der behaltenen Zauber, die im Kampf gespielt wurden: **61 %** (vorher 38 %; Zauber, die das Brett wirken kann: 62 % gegen 45 %).
* Von 4 831 Zauber-Versuchen in 180 Partien gelangen 20 %. Der Rest sind **unerfüllte Kartenbedingungen** („Delete 1 … aus deiner Ablage", „nur von einem betäubten Helden", „opfere 3 Level-0-Creatures" …:
  Tengu Windstorm 353 Versuche, Kirin Firebreath 327, Soul Transmigration Ritual 223 …) — und **fünf Zauber, deren Auswahlabfrage der Bot ablehnte** (jetzt beantwortet, `skilltest/prompts.js`):
  Spontaneous Reappearance 0/161 → 13/17, Spreading Rumor 0/126 → 10/11, Accusation 1/67 → 8/8, Gate to the Armory 0/118 → 9/69, Raise the Minions! 0/72 → 4/61.
* Bots haben **freie Ability-Effekte nie benutzt** (`doActivateFreeAbility` fehlte): Leadership, Alchemy, Charme, Occultism, Thieving, Singing, Diplomacy, Pillage, Training … Jetzt laufen sie
  (im Lauf zusammen 215 687 Einsätze; Alchemy 60 524, Charme 55 468, Leadership 43 922).

## Beobachtungen

* **Ranglisten-Verschiebung:** Die alte Spitze (Broghan, Styx, Waflav, Thorad, Güldefaber, Karian, Champion, Orthos …) fällt ab, die alten Schlusslichter (Logan, Alice, Inya, Tarleinn, Grisgar, Chuck, Beato, Mary …)
  steigen auf. Die Idej Lords stehen nicht mehr ganz unten (alt 988–993 → jetzt 773–815 von 879): mit ihren Paketen sind sie schwächer als der Durchschnitt, aber nicht mehr das Schlusslicht.
* **Patt:** 2,5 % statt 0,2 % im alten Lauf. Auffällig: Saint Nicolas (Tränke wandern zwischen den Spielern, solange welche nachkommen), Helden mit sehr hohen HP (4 000+), betäubte/immune Überlebende.
* **Tränke:** Bots trinken jetzt ≈ 10 Tränke je Partie (vorher 0,7) — Alchemy zieht jede Round einen zufälligen Trank aus dem Pool.
