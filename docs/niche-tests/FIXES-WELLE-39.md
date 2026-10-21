# Fix-Welle 39 – Reagieren alle Attack-Leser auf „zählt als Attack"? (Broghan & Co.)

Frage von Al (22.10.2026): Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird (Magic Topaz, Arrows, Explosivo's Sword …) – reagieren **alle** schon auf Broghan und Co.? Ein Agent (**W39a**) hat alle Leser inventarisiert, gegen 17 Treffer-Quellen getestet und die Lücken geschlossen; Zweig `wave39/W39a` ist zusammengeführt. Details, Verträge und die vollständigen Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 39 / W39a"; Repros `docs/niche-tests/repro/W39/a-01 … a-15` (+ Hilfen `_helfer.js`, `_matrix.js`, `_leser.js`, `_pruefe.js`).

## Antwort

**Vorher: nein.** Von **96 Attack-Lesern** reagierten alle auf eine echte Attack, aber viele nicht auf als-Attack-zählende Effekte (Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel). Matrix: 96 Leser × 17 Quellen × beide Sitze × Held-/Kreaturenziel = 3936 Zellen; auf der Basis lösten **828 Zellen** nicht aus, jetzt **60** – und alle 60 sind bewusst (siehe Fragen). Die Referenz „echte Attack" ist in jeder Zelle grün; Gegenprobe Siphem (normaler Heldeneffekt) löst keinen Attack-Leser aus.

## Zentrale Lösung

* `engine.alsAttackKette({…, ziele})` legt die getroffenen Ziele ins Schadensprotokoll; danach meldet die Engine einmal `meldeAttackAufgeloest` (virtuelles `afterSpellResolved` mit Attack-Karte, Stufe = Fighting-Level, ohne Spell-Stempel). Damit sehen alle `afterSpellResolved`-Leser und alle Ein-Ziel-Leser (Warhorse, Master's Sword, Vinepire, Zsos'Ssar) den Treffer.
* Ausrüstungseffekte (Crusader's, Bamboo Staff) haben jetzt den Träger als Quelle (`attackerSourceOverride`).
* Kohta und Heart of Ice nutzen `actionDefeatHero` mit `type` und `meldeTreffer` (`meldeAttackTrefferOhneSchaden`).
* Hero-Status-Schutz (untargetable/invisible) gilt jetzt auch bei Trank-/Artefakt-Zielwahl (`heroStatusSchutzFilter` in `normalizeValidTargets`).
* Truth-Seeing Eye und die Pike-Prüfung erkennen gestempelte Quellen; Güldefaber und The Brewer's Blade zählen über `onEffectCountedAsArt`; Sacred Hammer und Zsos'Ssar lesen Kreaturenschaden.

## Was geändert wurde (Auswahl nach Leser-Art)

| Leser | Karten |
|---|---|
| Waffen/Ausrüstung („defeats/hits with an Attack") | Idej Sword – Kunagi, Idej Sword – Onima, Earth-Shattering Hammer, Legendary Sword of a Barbarian King, Heart-Shaped Bow, Blade of the Frostbringer, Warhorse / The Master's Sword, Vinepire, Zsos'Ssar, Sacred Hammer of the Volcano, Heart of Ice, The Brewer's Blade / Güldefaber, Wavilion, Hands of Big Gwen, Skullmael's Greatsword, Explosivo's Sword, Future Tech Bazooka (Blade of the Swamp Witch, The Sun Sword, Vampiric Sword bewusst nicht bei Kohta: Ziel wird besiegt, nichts mehr zu heilen/auszulösen) |
| Helden/Kreaturen | Nieht / Reiza, Santa Klaus, Taio, Absorber of the Mountain's Heart |
| Zielschutz/Umleitung | Truth-Seeing Eye, Butterfly Cloud (untargetable), Invisibility (invisible), Empty Armor, Anti-Magnet, Challenge, Martyry, Chaorc Interception, Phalanx Pike, Invisibility Cloak, Future Tech Escape Device, Test Flight |
| Surprises | Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Crimson Web, Flooding, Glass Wall, Spike Trap, Tharxian Horse, Frost Rune, Jumpscare |

Schon vorher korrekt (alle Quellen): Club of Gobbo, Bow of the Hunt Goddess, Future Tech Doomsday Bomb, Glass Sword, Shattered Trident, Super-Killing Knife, Elixir of Strength/Cold, Guardian Beast Niu, Gigantisaur Stegon, Ghoul Guard, Rioting Village, Dark Ocean, Future Tech Jetpack, Stealth, alle Pfeile (Angelfeather, Magic Topaz, Bomb, Flame, Poisoned, Rainbow's, Golden, Hydra Blood, Racket Arrow, Arrow Slit), Stealthy Pursuit, Fireshield, Spiky Armor, Escape, Zombified Assault, Corpse Explosion, Bluff, Jumper Spider, Spider Avalanche, Xiong, Devlin, Null, Don Quisto, Bow Sniper Darge, Cute Angel Molinda, Great Detective Doq, Thorad, Taio the Sun Fencer, Ghuanjun, Sorin; Alliance und Dive Down (W29a).

**Spell-Leser** (43 Leser, die auch Spells lesen; gemessen mit Alice als Effekt, der als Spell zählt): geändert Vinepire (Alice legte ihr Ziel nicht ins Schadensprotokoll) und Zsos'Ssar (echter Spell auf Kreaturenziele); alle anderen schon korrekt. Reine Spell-Karten-Leser (Archibald, Beato, Card Game Player Inya, Ethan, The White Eye, Learning, Rafflesia …) lösen bei einem Effekt ohne Karte bewusst nicht aus.

**Nebenfunde, mit behoben:** Der Zielschutz untargetable/invisible fehlte bei Trank-/Artefakt-Zielwahl überall; Jumpscare lief nach einer Trank-Zielwahl nicht (`doConfirmPotion` führte aufgeschobene Surprises nicht aus); Vinepire verbrauchte seinen Heilpuffer am Duel-Ereignis des Gegners.

## Nicht geprüft / bewusst nicht

* Deepsea Encounter, Idej Projector, Deepsea Horror Clown (hängen am Ketten-Link-Typ bzw. `damageType`) – nicht in der Matrix.
* Andras (Effekt-Stufe = Fighting-Level, Bedingung „niedriger" greift nie), Pharaoh (stufen- und kartengebunden), Swellpnir (Aktionsökonomie, W35a), Alleria (nutzt dieselbe Klassifikation wie Empty Armor/Challenge, nicht einzeln geprüft).
* Mehrfachziel-Quellen als Ein-Ziel-Leser, Charme-/Styx-Kontrollwechsel, MCTS-Simulation.

## Ergebnis in Zahlen

* Repros: **alle 1194 Repros grün** (vorher 1175; 15 neue: a-01 … a-13 und a-15 Exit 1 auf der Basis, a-14 teilweise), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand (rot nur battle, lobby, prep, seats, target – fehlendes `socket.io-client`); mit `NODE_PATH` grün: spectate-player, cards, draw-cards, sacrifice, prompts.
* Dauerfeuer: 27 betroffene Karten × 2 Seiten, Zustands-Fingerabdrücke identisch zur Basis, 0 Fehler.

## Offene Rückfragen an Al (Ja/Nein)

1. **Duel:** Sollen die „is chosen"-Reaktionen und -Schutzeffekte (Butterfly Cloud, Invisibility, Taunt, Umleitungen, Gewählt-Surprises, Escape Device, Test Flight, Crimson Web, Flooding, Glass Wall, Spike Trap, Tharxian Horse, Frost Rune, Mountain Tear River, Jumpscare) bei Duel bewusst nicht greifen, weil Duel keine Ziele wählt?
2. **Duel:** Soll Duel den B-Zähler (Gegen-Attack) und den Pfeil-Bonus je Schlag zählen? (so jetzt umgesetzt)
3. **Idej Sword – Kunagi („repeat that Attack"):** Soll bei Effekten ohne Karte nicht wiederholt werden? (jetzt so)
4. **Eraser Beam:** Sollen gespielte Attack-Karten den Eraser-Beam-Stempel setzen, Attack-Effekte ohne Karte aber nicht?
5. **Alluring Light:** Soll der Schutz gegen das Wählen durch den Gegner (Butterfly Cloud, Invisibility, Taunt) nicht greifen, weil der Besitzer sein eigenes Ziel wählt? (so jetzt umgesetzt; Alluring Light und Duel bei Taio, Blade of the Frostbringer usw. siehe Abschnitt in `CARD_API.md`)
