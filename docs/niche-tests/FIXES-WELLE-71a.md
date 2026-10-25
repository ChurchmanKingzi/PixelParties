# Fix-Welle 71a – Future Tech Lamp hard once per turn · Cute Hydra X+1 · Ascension-Bonus ODER

Agent **W71a** (Zweig `wave71/W71a`). Drei Aufträge von Al (Spieldesigner), 25.10.2026.

| Auftrag | Änderung | Dateien |
|---|---|---|
| Future Tech Lamp: hard once per turn | Kartentext neu (Balancing, Zeilenumbruch weg, Satz „You can only play 1 "Future Tech Lamp" per turn." dazu). `canActivate` liest `hoptUsed["Future Tech Lamp:<Spieler>"]`, `resolve` stempelt mit `claimHOPT`. Hand-Liste, Server und CPU fragen dasselbe Gate. Ganz negierte Lamp stempelt nicht (Z7b). | `data/cards.json`, `cards/effects/future-tech-lamp.js` |
| Cute Hydra: X+1 Head Counter | `gained = abgeworfen + 1` im `onPlay` (alle Beschwörungswege); Schadens-Ziele lesen den Zähler. CPU zählt die +1 mit und kennt ihren Sitz (`controllerIdx`). Rettungs-Bestätigung robuster. | `cards/effects/cute-hydra.js` |
| Ascension-Bonus bei Abilities: ODER | `performAscensionBonus(…, alternativen)`: bei mehreren Ability-Boni wählt der Spieler EINE („Choose one", `optionPicker`), nur diese wird angelegt; nicht machbare Alternativen entfallen; CPU wählt die mit den meisten anlegbaren Kopien. Betroffen: Arthor, Taio (Champion, Fern noch ohne Skript). Tooltip/Regeltext angepasst, Wächter `check-ascension-bonus.js` Regel 3. | `cards/effects/_engine.js`, `_cpu.js`, `public/app-shared.jsx`, `public/app-screens.jsx`, `scripts/check-ascension-bonus.js`, Arthor-/Taio-Skript (nur Kommentar) |

* **Repros:** `docs/niche-tests/repro/W71/a-03-…` (Lamp), `a-04-…` (Hydra), `a-05-…` (Ascension, inkl. statischem Audit Daten ↔ Skripte); beide Sitze, auf dem Ausgangsstand rot. (Die Nummern a-01/a-02 sind in `W71/` durch Magic Arrows belegt.)
* **Audit-Tabelle** aller Ascended Heroes und die Ja/Nein-Fragen an Al: `cards/effects/CARD_API.md`, Abschnitt „Welle 71 / W71a".
* **Commit-Nachrichten:** `Bugfix-Note` für Cute Hydra, Arthor, Taio und `_engine` (Aufstiegsbonus); für die Lamp keine Note (reine Balancing-Textänderung samt Sperre).
