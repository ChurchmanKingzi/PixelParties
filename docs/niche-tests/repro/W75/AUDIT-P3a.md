# Equip-Audit Darions geteilte Equip-Zone — Partition P3a (Spells Normal und Area)

57 Skripte vollständig gelesen. Klassen: A Auswahl/Entfernen/Bewegen, B Zählen, C Anlegen per Effekt, D Zonen verschieben/Held/Kontrolle, E Equip-Skript selbst.
Stapel-Lage der Tests: `Club of Gobbo` / `Blade of the Frostbringer` / `Cute Crown` in einem Platz, Gegner- und Eigenseite. Zusätzlich liefen der Sweep `g-02` (nur diese 57 Karten, vorher und nachher: 0 falsche Treffer) und der Rauchlauf `h-P3a-13` (alle 57 Karten in drei Lagen = 171 Läufe: Stapel beim Gegner, Stapel bei einem eigenen Helden, der nicht wirkt, Darion als Wirker): keine Engine-Fehler, keine Auffälligkeiten ausser dem unten genannten Teleport-Stapel.

Datei | Klassen | Befund | Test
--- | --- | --- | ---
acid-rain.js | irrelevant | ok: Pollution Token nur in freie Zonen; Darions Stapel belegt nur eine Zone | –
aligning-goals.js | irrelevant | ok: nur Kreaturen des Gegners (`getCreatureTargets`); der Equip-Stapel ist keine Kreatur | –
blind-destruction.js | A, B | ok: zählt und zerstört je Instanz (alle drei Karten = 150 Schaden), „except the user" schont den ganzen Stapel des Wirkers | h-P3a-05
chain-lightning.js | irrelevant | ok: Ziele nur Helden/Kreaturen (`hasCardType Creature`) | –
cold-coffin.js | irrelevant | ok: Held/Kreatur; Kosten-Token in freie Zonen | h-P3a-13
coolness-overcharge.js | A | ok: ein Ziel je Instanz (gleiche ID), Engine fragt nach, Skript liest `_cardInstance`; Wahl einer `immovable`-Karte im Stapel wird wie bei einer Einzelkarte nach der Wahl abgebrochen (unverändert) | g-02, h-P3a-12
cute-conversion.js | irrelevant | ok: Kreaturen (`isEquipInZone` ausgeschlossen) | –
dangerous-knowledge.js | E (Nebenwirkung) | ok: gewonnener Darion-Effekt wirkt (`heroScript` führt `equipsShareZone` zusammen), Equips des Gewinners teilen eine Zone | h-P3a-10
deepsea-treasure.js | C | ok: Platzliste = nur der Stapelplatz, auch ohne freie Zone | h-P3a-03
disarm.js | A | ok (bereits W75/g-05: Mehrfachwahl über `waehleMehrere`) | g-05, g-02
divine-gift-of-biseria.js | irrelevant | ok: Held/Kreatur-Ziele | h-P3a-13
divine-gift-of-equality.js | A (Beobachtung) | offen/nicht Darion-spezifisch: `buildAnyTargetList` bietet jede belegte Support-Zone (auch Equips, bei Stapel `slot[0]`) als „Ziel" an; die Wahl bricht den Zauber ab (HP 0), bei Darion kommt vorher eine unnötige Stapel-Rückfrage. Nicht geändert (wäre ein allgemeiner Fix: nur Kreaturen) | h-P3a-13
divine-gift-of-sacrifice.js | B, D | ok: Opfer = Heldentod, Stapel bleibt liegen (a-04). CPU-Bewertung `cpuHeroValue` zählt belegte Zonen (+10 je Zone) statt Karten — Darion mit Stapel gilt als weniger wertvoll; reine CPU-Gewichtung, bewusst unverändert | –
divine-gift-of-the-deepsea.js | irrelevant | ok: Kreaturen | –
divine-gift-of-the-light.js | irrelevant | ok: Held/Kreatur | –
divine-zeal.js | irrelevant | ok: Held/Kreatur | h-P3a-13
dream-world-portal.js | irrelevant | ok: Kreatur + Heldenkarte | –
exorcism.js | A | ok: Anhängsel (Spell-Untertyp Attachment) liegen nie im Equip-Stapel (nur Equipment-Artefakte teilen), IDs je Zone eindeutig | h-P3a-13
fire-bolts.js | irrelevant | ok: Held/Kreatur | h-P3a-13
gate-to-the-armory.js | C | behoben: `_firstFreeSlot` verlangte eine freie Zone (Direkt-Ausrüsten wurde sonst nicht angeboten) und legte die Animation auf die erste freie Zone; jetzt `engine.equipPflichtPlatz` (Stapel zuerst) | h-P3a-02
goldify.js | irrelevant | ok: nur Kreaturen | h-P3a-13
graveyard-of-limited-power.js | irrelevant | ok | –
great-offensive.js | irrelevant | ok: Kreaturen | –
guard-change.js | irrelevant | ok: Kreaturen, belegte Zonen sind kein Ziel | h-P3a-13
hand-of-death.js | D | ok: Held/Kreatur-Ziel; Heldentod lässt den Stapel liegen (a-04) | h-P3a-13
heal.js | irrelevant | ok: Stapel wird nicht als Ziel angeboten | h-P3a-13
holy-selection.js | irrelevant | ok: nur Necromancy-Kreaturen | –
icebolt.js | irrelevant | ok | h-P3a-13
inheritance-ceremony.js | A, C, D | behoben: mit Darion als ZIELHELD verteilten umgehängte Equips sich auf mehrere freie Zonen (`fuehreUmhaengenAus` kennt den Pflichtplatz nicht) und ein vorhandener Stapel brauchte eine freie Zone; jetzt Stapel-Zuteilung (vorhanden: Pflichtplatz, sonst eröffnet das erste Equip einen, die weiteren folgen) und Obergrenze ohne Zonenzwang für Equips. Darion als Nutzer (Mehrfachwahl aus dem eigenen Stapel) war schon in g-06 | h-P3a-04, g-06
kidnapping.js | irrelevant | ok: Kreaturen | h-P3a-13
laser-volley.js | irrelevant | ok: Kreaturen (`hasCardType Creature`) | –
love-shot.js | D | ok: vom Wirker gesteuerter Darion trifft mit ATK inkl. Stapel, danach Stapel/ATK/Kontrollmarke unverändert | h-P3a-09
magic-hammer.js | irrelevant | ok | h-P3a-13
mana-beacon.js | irrelevant | ok: Pollution Tokens | –
mass-routing.js | irrelevant | ok: Kreaturen (`isEquipInZone` ausgeschlossen) | –
missing-people.js | irrelevant | ok: Kreaturen | h-P3a-13
overcharge.js | A, B, C | behoben: `zulaessigeZiele` sah nur `supportZones[h][s][0]` — von einem Stapel war immer nur das UNTERSTE Equip wählbar (und nur dann, wenn gerade dieses eine Aufwertung hatte). Jetzt eine Zeile je Karte, Zonenwahl zählt Plätze, danach `waehleMehrere` (Rückfrage Karte für Karte). Neue Ausrüstung geht über `safePlaceInSupport` in den Stapel | h-P3a-01
overheat.js | A | behoben: die Stapel-Rückfrage bot auch Karten an, die das Skript ausschließt (`immovable`/`_cardinalImmune`) — jetzt `gruppiereZiele` (`_erlaubteInstanzen`) | h-P3a-06, h-P3a-12, g-02
pangaia-the-dino-domain.js | irrelevant | ok: Kreaturen-HP | –
paraseed-greenhouse.js | irrelevant | ok: Paraseed-Kreaturen in freie Zonen | –
phoenix-tackle.js | irrelevant | ok | h-P3a-13
pressure-projectile.js | A | behoben (wie Overheat): Rückfrage nannte ausgeschlossene Karten; Mehrfachwahl und gewählte Karte waren schon richtig (g-06) | h-P3a-06, h-P3a-12, g-06
shared-blood-tanks.js | irrelevant | ok: Bleed bei Helden/Kreaturen | –
slippery-ice.js | irrelevant | ok: nur Kreaturen, belegte Zonen sind kein Ziel | –
sun-beam.js | A, B | behoben: (1) Mehrfachwahl aus einem Stapel (`_zusatzInstanzen`) wurde ignoriert — es fiel nur die erste gewählte Karte; jetzt zählt jede Karte einzeln für die Obergrenzen (Gesamtzahl, fremde Karten ≤ freie Zonen). (2) Rückfrage bot unzulässige Karten an (`gruppiereZiele`). Annahme: die Kappung „freie Zonen + eigene Karten" bleibt je Karte; zerstört man einen ganzen eigenen Stapel, wird nur eine Zone frei und es werden entsprechend weniger Token gelegt | h-P3a-07, h-P3a-06, h-P3a-12
tearing-mountain.js | irrelevant | ok: Held/Kreatur | –
telekinesis.js | irrelevant | ok: verdeckte Surprises (Bakhm-Zonen), keine Equips | –
teleport.js | D | ok: Held-Tausch lässt „Support Zones" stehen; der ganze Stapel bleibt in seiner Spalte und wechselt den Wirt, Namen/Instanzen konsistent, ATK-Boni folgen dem Träger, zweites Teleport stellt alles her. Offene Regelfrage: der liegengebliebene Stapel hängt danach an einem Held ohne Darions Effekt (liegt weiter gemeinsam, neue Equips dieses Helden teilen nicht) | h-P3a-08
tengu-windstorm.js | A | behoben (wie Overheat): Rückfrage nannte `immovable`-Karten | h-P3a-06, h-P3a-12, g-02
the-seventh-circle-of-hell.js | irrelevant | ok | –
the-warlord-s-bite.js | irrelevant | ok | h-P3a-13
trap-sabotage.js | irrelevant | ok: verdeckte Surprises | –
treasure-theft.js | A, C | behoben (Rückfrage nannte Karten, die `darfAn`/`istUmhaengbaresEquip` ausschließen — Wahl führte zum Fizzle); Anlegen beim Nutzer (Stapel ohne freie Zone, ohne Zonenfrage) und Stehlen unterste/mittlere/oberste war schon richtig | h-P3a-06, h-P3a-11
trial-of-coolness.js | irrelevant | ok: Held/Kreatur | –
venom-infusion.js | irrelevant | ok | h-P3a-13
victory-phoenix-cannon.js | irrelevant | ok | h-P3a-13
voodoo-curse.js | B | ok: tauscht HP/ATK von Held/Kreatur; Equip-Boni stecken in den Werten, keine Zonenzählung | –
