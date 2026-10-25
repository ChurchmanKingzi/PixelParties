# Audit P3b — Attacks aller Art, Spells mit Untertyp Attachment/Reaction/Surprise (Darions geteilte Equip-Zone)

Geprüft: 58 Skripte (alle vollständig gelesen). Klassen: A Auswahl/Entfernen, B Zählen/Bedingungen, C Anlegen per Effekt, D ganze Zonen verschieben, E Equip-Skript/Hooks. Befund: ok / behoben / offen.
Tests: `docs/niche-tests/repro/W75/h-P3b-*.js` (Aufruf im Kopf jeder Datei).

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| cards/effects/alliance.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt; Zielzählung zählt Helden/Kreaturen | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/anti-magic-enchantment.js | C, E | ok — Equip-Fenster je neu angelegtem Equip (`ctx.equipCard` = die neue Instanz); Verzauberung hängt an genau dieser Instanz, Blade bleibt unverzaubert; das Token braucht eine freie Zone (ein weiteres Equip im Stapel verbraucht keine, ohne freie Zone kein Angebot); jedes verzauberte Equip hat seine eigene Ladung (Engine sucht `charges > 0` über alle Instanzen) | h-P3b-05 |
| cards/effects/aquatic-arrows.js | irrelevant | Surprise; trifft nur Kreaturen (Eintritt einer Kreatur, Rider „defeat any Creature") | — |
| cards/effects/aquatic-spear.js | irrelevant | Surprise; Ziele Helden/Kreaturen, Schaden-Folgetreffer auf dasselbe Ziel | — |
| cards/effects/attack.js | irrelevant | liest nur `hero.atk` (Equip-Boni zentral; a-07/a-08 prüfen ATK bei Abgang eines Stapel-Equips) | W75/a-07, a-08 |
| cards/effects/blood-rock.js | B | ok — Diver-Helmet-Schutz sucht die Instanz mit dem Namen am Helden (nicht `slot[0]`): Helm mitten im Stapel schützt | h-P3b-08 |
| cards/effects/blow-of-the-venom-snake.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/breaking-strike.js | A, B | ok — Abwurfschleife `sendCardsLoop` wirft die gewählte Karte ab (`ziel.cardInstance`), zählt jede abgeworfene Karte; ATK wird nach dem Abwurf gelesen; spielbar, sobald ein Equip im Stapel liegt | W75/g-03, h-P3b-08 |
| cards/effects/breakthrough.js | irrelevant | Ziele sind Surprises (inkl. offene Surprise-Kreaturen); kein Artefakt | — |
| cards/effects/capture.js | B | ok — Truth-Seeing-Eye-Prüfung (Zusatzaktion) ist instanzbasiert, das Auge mitten im Stapel zählt; freie Zone der Kreatur unberührt vom Stapel | h-P3b-08 |
| cards/effects/castling.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/cosmic-manipulation.js | irrelevant | Reaktion auf Deck-Beschwörung; Ziele Analyzer/Gatherer/Argos (Kreaturen/Held) | — |
| cards/effects/crimson-web.js | D, E | behoben — `onCardLeaveZone` prüfte nicht, WER die Zone verlässt: jede Karte, die irgendeine Support Zone verlässt (auch ein Equip aus dem Stapel), hob den Status `webbed` auf, obwohl das Netz noch lag. Jetzt nur noch der Abgang des Netzes selbst. (Allgemeiner Fehler, nicht Darion-spezifisch; eigener Commit.) Anlegen in freie Zone, Entwirren und Stapel daneben: ok | h-P3b-07 |
| cards/effects/critical-strike.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/cure.js | irrelevant | Reaktion; Ziele Helden- und Kreaturenstatus | — |
| cards/effects/curse.js | B | ok — „Held trägt schon einen Spell" liest die oberste Karte je Zone (`slot[last]`): ein Stapel aus Artefakten gilt nicht als Spell; „freie Zone" zählt Zonen, nicht Equips | h-P3b-06 |
| cards/effects/deepsea-encounter.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen (Artefakt-Kreaturen ausdrücklich ausgeschlossen) | — |
| cards/effects/dichotomy-of-luna-and-tempeste.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/dive-down.js | irrelevant | Schutz für Helden/Kreaturen | — |
| cards/effects/divine-gift-of-time.js | irrelevant | Reaktion auf „Karte in die Ablage"; meldet die Namen, hängt an keinem Platz | — |
| cards/effects/dream-world-switcheroo.js | irrelevant | Umlenkung auf Kreaturen mit angelegtem Helden | — |
| cards/effects/energy-aura.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt (`canEquipToHero` prüft nur „schon eine Aura") | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/ferocious-tiger-kick.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/flesh-eating-swarm-trap.js | irrelevant | Reaktion auf Heldenwahl | — |
| cards/effects/gathering-storm.js | B | ok — „host also equipped with The White Eye" ist instanzbasiert: das Auge mitten im Stapel verdoppelt (140 statt 70) | h-P3b-08, h-P3b-06 |
| cards/effects/gold-trap.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/golden-wings.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen; das Pollution-Token braucht eine freie Zone, kein Equip | — |
| cards/effects/golem-smash.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/gravedigger-slap.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/guardian-angel.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt (`onHeroKO` sucht die Karte nach Namen in ihrer eigenen Zone) | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/hammer-throw.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen (die Item-Sperre ist Engine-Sache) | — |
| cards/effects/heavy-hit.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/idej-projection.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt (nur an Idej-Lords; Idej Blades legen ebenfalls nur dort an) | — |
| cards/effects/knife-throw.js | A | behoben — die Kosten („send 1 equipped Artifact") wurden über die NAMENS-Galerie gewählt (`find(i => i.name === …)`): gleichnamige Karten im Stapel (eigene Counter) ließen sich nicht unterscheiden, immer ging die unterste. Jetzt `instancePick` (Bild + Counter) sobald ein Stapel mit mehreren Equips vorliegt; ohne Stapel unverändert die Galerie | h-P3b-02, W75/g-02 |
| cards/effects/looting.js | C | behoben — `freieBasisZonen(…)` ohne Kartennamen: (a) mit freien Nachbarzonen kam eine überflüssige Zonenwahl (die den Stapelplatz gar nicht anbot), (b) ohne freie Nachbarzone tat Looting gar nichts. Jetzt mit Kartennamen → nur der Stapelplatz, keine Zonenwahl, keine freie Zone nötig | h-P3b-03 |
| cards/effects/massacre.js | B | ok — zählt Kreaturen (ohne `treatAsEquip`), keine Artefakte | — |
| cards/effects/midnight-assault.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/mine-mine-mine.js | A, C | A ok — Ziele je Instanz, die Engine fragt per `instancePick` (a-06); C behoben — der Charme-Zusatz („equip it to the user") nutzte `freieBasisZonen` ohne Kartennamen: ohne freie Nachbarzone kein Anlegen, sonst überflüssige Zonenwahl. Jetzt Pflichtplatz = Stapel | W75/a-06, h-P3b-04 |
| cards/effects/muscle-training.js | B | ok — „Held hat ein Equip" sucht über die Zonen (`slot[0]` + Namens-/Subtype-Prüfung), ein Stapel zählt als „hat Equip"; kein Zählen von Zonen | h-P3b-08 |
| cards/effects/overheal-shock.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/point-blank-annihilation.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen (`!isEquipInZone` schließt Equips aus) | — |
| cards/effects/polymorph.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/prayer.js | E | ok — Anhängsel mit Klick-Wirkung (`equipEffect`): erscheint genau einmal in der Aktivierungsliste, Aktivierung per Platz/instId neben dem Stapel unverändert | h-P3b-07, h-P3b-06 |
| cards/effects/pusher.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/quick-attack.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/redirecting-aura.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt (Umlenkung auf Helden/Kreaturen/„Träger"-Artefakte anderer Helden; wählt kein einzelnes Stapel-Equip) | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/royal-treasury.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/sculpture-guards.js | irrelevant | Reaktion; nur gefrorene Kreaturen/Helden | — |
| cards/effects/sculpture-theft.js | irrelevant | Reaktion; nur gefrorene Kreaturen (Gefroren gilt nicht für Artefakte) | — |
| cards/effects/stranglehold.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/strong-ox-headbutt.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen (Ability-Entfernung bei 3. Attack) | — |
| cards/effects/surprising-opportunity.js | A | ok — Mehrfachwahl im Stapel (up to 2) läuft über `engine.gewaehlteInstanzen`; CPU-Weg zieht die zwei wertvollsten Instanzen | W75/g-06 |
| cards/effects/the-master-s-orders.js | irrelevant | irrelevant — Anhängsel ist kein Artefakt und liegt in einer eigenen freien Zone; Stapel bleibt unberührt (Übernahme eines Darion-Helden lässt den Stapel liegen: Pflichtplatz liest die Brettseite) | h-P3b-06 (Anhängsel an Darion mit Stapel, danach weiteres Equip → Stapel) |
| cards/effects/the-master-s-plan.js | irrelevant | Reaktion: negiert eine Karte aus der Hand | — |
| cards/effects/thieving-strike.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/transdimensional-stab.js | irrelevant | irrelevant — Ziele/Wirkung nur Helden und Kreaturen (`type: 'equip'` meint hier die Kreatur im Platz); kein Artefakt betroffen | — |
| cards/effects/weapon-absorption.js | A, B | behoben — (A) die Abwurfschleife schickte `ziel._wa.inst` (die beim Aufzählen gemerkte OBERSTE Karte) statt der im Stapel gewählten: immer ging die oberste; jetzt `ziel.cardInstance`. (B) `plan().equips` zählte Plätze statt Karten (ein Stapel aus 3 Equips = 1) → CPU-Heuristik unterschätzte die mögliche Heilung; jetzt Karten (`_erlaubteInstanzen`) | h-P3b-01, W75/g-03 |
| cards/effects/weapon-storm.js | A, B | ok — gleiche Schleife wie Breaking Strike (gewählte Karte, jede Karte zählt, Satz × Karten) | W75/g-03, h-P3b-08 |
