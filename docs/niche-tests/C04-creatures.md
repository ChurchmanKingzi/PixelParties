# C04-creatures – Nischenfall-Bericht
Stand/Autor: Agent C04-creatures, 12.10.2026. Karten: 21 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### C04-01 · Sleeping Beauty ist nie aktivierbar (liest den alten Held-HOPT-Schlüssel) · Stufe A
- **Karten:** Sleeping Beauty (`cards/effects/sleeping-beauty.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Held 0 = „Elana, the Rocky Rebel" (aktiver Heldeneffekt), Held 1 mit Summoning Magic 1; Hand: Sleeping Beauty + 3 Füllkarten. Beauty über Held 1 beschworen, Link auf Elana (Zielwahl per `targetFn`).
- **Schritte:** 1. Beauty beschwören, Elana wählen. 2. Elana benutzt ihren aktiven Effekt (`t.activateHero`, echter Weg). 3. Beauty aktivieren (`t.activateCreature`, Main Phase, keine Beschwörungsstarre).
- **Erwartet** (Kartentext „Once per turn, if that Hero has used its active effect this turn, this Creature may use that effect as if it was its own."): Beauty ist nach dem Heldeneffekt aktivierbar und führt den Elana-Effekt aus.
- **Beobachtet:** Aktivierung wird abgelehnt (`false`), kein Engine-Fehler. Der Server hat `hoptUsed['hero-effect:Elana, the Rocky Rebel:0']` gestempelt (seit v1275: Schlüssel = Kartenname + Spieler, **ohne** Heldenindex); `canActivateCreatureEffect` der Beauty prüft aber `hero-effect:<Name>:<pi>:<heroIdx>`. Gegenprobe: stempelt man zusätzlich den alten Schlüssel (`…:0:0`), läuft die Beauty durch (Elanas Effekt wird ausgeführt). Betroffen ist jeder Held mit dem Standard-Stempel; nur Helden, die ihren eigenen Schlüssel mit Index stempeln (z. B. Kohta, Cecilia, Logan), würden funktionieren.
- **Repro:** `docs/niche-tests/repro/C04-creatures/01-sleeping-beauty-hopt-schluessel.js` (`node docs/niche-tests/repro/C04-creatures/01-sleeping-beauty-hopt-schluessel.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/sleeping-beauty.js:161` baut `hero-effect:${linkedHero.name}:${linkedOwner}:${linkedIdx}`; die Engine-Funktion `heroHoptKey(cardName, pi)` (`_engine.js:29770`) liefert `hero-effect:${cardName}:${pi}` (Ruling 22.9., „Hero-Effekte, die once per turn sind, sind generell IMMER hard once per turn" – pro Spieler und Kartenname).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Plant Golem | L0 gelesen | noch nicht bearbeitet |
| Populated Island Turtle | L0 gelesen | noch nicht bearbeitet |
| Potion Juggler | L0 gelesen | noch nicht bearbeitet |
| Powder Keg | L0 gelesen | noch nicht bearbeitet |
| Psychic Scout | L0 gelesen | noch nicht bearbeitet |
| Pyraga | L0 gelesen | noch nicht bearbeitet |
| Realmniversal Emperor | L0 gelesen | noch nicht bearbeitet |
| Sarcophagus of Sealed Magic | L0 gelesen | noch nicht bearbeitet |
| Scavenging Crane | L0 gelesen | noch nicht bearbeitet |
| Sentient Bomb Golems | L0 gelesen | noch nicht bearbeitet |
| Sky Archeologist | L0 gelesen | noch nicht bearbeitet |
| Sky Shaman | L0 gelesen | noch nicht bearbeitet |
| Slave Trader | L0 gelesen | noch nicht bearbeitet |
| Sleeping Beauty | L2 gezielt | Aktivierung nach Heldeneffekt ✗ (→ C04-01) |
| Spearman | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Barbarian Sword | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Forbidden Grimoire | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Heart Bow | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Relic Hammer | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Shattered Trident | L0 gelesen | noch nicht bearbeitet |
| Spirit of the Super-Killing Knife | L0 gelesen | noch nicht bearbeitet |

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
