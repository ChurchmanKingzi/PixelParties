# Equip-Audit Darion — Partition P5 (Helden und Ascended Heroes)

Stand: Branch `worktree-agent-ae7e2b84dd904b899` (Basis `f0b4e03`). 59 Skripte aus `P5.txt`, jedes gelesen; bei den Kreaturen-/Heldenzielen (`type: 'equip'` = Karte in einer Support Zone) zusätzlich gezielt auf Nicht-Kreaturen im Platz geprüft.
Annahme durchgehend: **jede Karte im Stapel ist eine eigene Karte, nur die Zone ist geteilt.** Klassen: A Auswahl/Entfernen/Bewegen, B Zählen/Bedingungen, C Anlegen per Effekt, D Zonen verschieben/Tod/Kontrolle, E Equip-Skript/Hooks/Instanzen.
Neue Tests: `h-P5-01` … `h-P5-08` in diesem Ordner. Schon vorhandene `a-*`/`g-*` bleiben grün.

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| alice-the-puppeteer-girl | irrelevant | ok: zählt und trifft nur echte Kreaturen je Instanz (`_qualifies`, Equipment ausgeschlossen); Schadensziele sind Kreaturen/Helden | – |
| alleria-the-queen-of-spiders | irrelevant | ok: Held-/Kreaturen-Umleitung, keine Artefakt-Zugriffe | – |
| andras-the-human-weapon | irrelevant | ok: zweiter Treffer schließt das erste Ziel per Ziel-ID aus; nur Kreaturen/Helden | – |
| arthor-inheritor-of-the-barbarian-sword | irrelevant | ok: Attack-/Aufstiegsbonus, keine Zonen-/Equip-Zugriffe | – |
| arthor-the-king-of-blackport | B, E | ok: „The White Eye equipped" per `cardInstances.some` (Instanz, nicht Zone), Aufstieg über `_arthor-shared` per Instanz-Name; Duplikate im Stapel ändern nichts | – |
| bakhm-the-desert-digger | irrelevant | ok: Schadensziel Held/Kreatur; Surprise-Zonen berühren Equip-Stapel nicht (Stapelplatz ist belegt) | – |
| bill-the-angry-auctioneer | C | **behoben:** Platzliste kannte den Stapel, die letzte Prüfung vor dem Anlegen verlangte aber einen LEEREN Platz → das Start-Equip fiel bei Darion mit liegendem Stapel still aus (und hätte sonst den Stapel überschrieben). Jetzt Pflicht-Platz (`equipPflichtPlatz`) + `push`; Zielplätze ohne „welches Equip?"-Rückfrage (`_eigeneStapelWahl`) | h-P5-03 |
| bomb-berserker-bartas | irrelevant | ok: wie Andras (Zweitwurf, Ziel-ID-Ausschluss), nur Kreaturen/Helden | – |
| brackle-the-catapulting-turtle | irrelevant | ok: Opfer sind Kreaturen (`getSacrificableCreatures`), Ziele Kreaturen/Helden; Moana-Sonderfall siehe unten (offen) | – |
| broghan-the-frozen-guardian-of-the-north | irrelevant | ok: Schadensziel Held/Kreatur | – |
| cool-rescuer-monia | E | ok: Jetpack per `hasEquipped` (Instanz-Name), Schutz betrifft nur Kreaturen | – |
| cute-angel-molinda | B, C | ok: freie Zonen nur für Kreaturen (`beschwoerZonenFuer`); Bogen per Instanz | – |
| cute-meanie-melissa | irrelevant | ok: Zieh-Trigger (`equip_flash` ist nur ein Animationsname) | – |
| cute-princess-mary | B | ok: „Cute Wings" per Instanz (`heroHasCuteWings`) — ein Stapel mit Wings zählt richtig | – |
| darion-the-blood-crazy-groundskeeper | A, B, C, E | ok (vorhandene Tests): Stapel, Ausrüsten nach Besiegen, Aktivierung je Instanz, Umhängen, Tod/Wiederbelebung, Sweeps | a-01 … a-08, g-01 |
| fiona-the-empty-vessel-of-a-forgotten-sorceress | B | ok: Aufstieg über `_fiona-shared` (Instanzen) | – |
| fiona-the-princess-of-blackport | B | ok: `equippedHeroCount` zählt Heldenkarten je Instanz (nicht je Zone) | – |
| future-tech-gunslinger-riffel | B, C | ok: „kein Exemplar angelegt" per Instanz-Name (`hasEquipped`) + Namen im Platz; Platz-Bedingung kennt `hatStapelPlatz`; Riffel selbst ist nie Darion | – (manuell: Riffel mit vollen Zonen) |
| garius-the-great-reformer | irrelevant | ok: Opfer/Ersatz sind Kreaturen; nur Zonen, die das Opfer leert (`zoneFreiNachKostenzahlung`) | – |
| great-detective-doq | irrelevant | ok: Handkarten-Raten, keine Brettzugriffe | – |
| grisgar-emissary-of-the-demon-lord | irrelevant | ok: wie Andras/Bartas | – |
| hel-the-bound-specter | B, C | ok: eigenes Equip per Instanz-Marke `_helEffectEquip`, Platz = erste freie Zone **von Hel** (Hel ist nie Darion); ein umgehängtes Hel-Equip wird nicht mehr gefunden (gewollt: „by its own effect" bleibt am Helden) | – |
| heragas-the-monster-slayer | irrelevant | ok: wählt nur Kreaturen (`treatAsEquip` und Nicht-Kreaturen ausgeschlossen) | – |
| idej-lord-daiyo | irrelevant | ok: Startanhängsel auf freie Zonen des Lords (nie Darion); `equipCostReduction` betrifft nur den Zielhelden | – |
| idej-lord-nobunakin | irrelevant | wie Daiyo | – |
| idej-lord-shoguwana | irrelevant | wie Daiyo | – |
| idej-lord-todugawin | irrelevant | wie Daiyo | – |
| jenny-the-class-fairy | A, E | **behoben:** Cloak of Edge im Stapel (zählt dort als Ability): die Engine fragte „welches Equip?" unter ALLEN Karten, Jenny zählte alle Karten des Platzes als „Kopien" der Cloak und holte die OBERSTE Karte statt der Cloak zurück. Jetzt: ein Ziel je Platz mit `_erlaubteInstanzen` nur für Ability-Karten, `gewaehlteInstanzen`, gezielte Rückholung je Instanz, keine Kopien-Frage | h-P5-04 |
| kit-the-shark-researcher | irrelevant | ok: Ziele nur Helden/Kreaturen | – |
| kohta-the-silent-observer | B, E | ok: Aufstieg per Instanz; Wiederholung nur für Kreaturen-Aktiveffekte | – |
| layn-master-of-deri-s-relic | C | ok: setzt Kreaturen in freie Zonen (`beschwoerZonenFuer`); ein Stapelplatz gilt als belegt | – |
| legendary-explorer-dajan | C | **behoben:** Klick auf den Stapel-Platz als Zielplatz löste die Engine-Rückfrage „welches Equip?" aus (ein Ziel-PLATZ ist keine Kartenwahl). Zielplätze tragen jetzt `_eigeneStapelWahl`; Platzliste/Pflichtplatz waren schon richtig | h-P5-02 |
| legendary-explorer-dajan (Sonderfall: nur Stapelplatz frei, `hasLegalEquipHero`) | C | ok: Dajan rüstet in den Stapel, auch wenn alle anderen Zonen belegt sind | h-P5-02 / manuell |
| lizbeth-the-reaper-of-the-light | irrelevant | ok: Biomancy-Token braucht eine freie Zone bzw. Alice-Teilung; Equip-Stapel zählt als belegt | – |
| lolek-mender-of-the-shattered-trident | C | **behoben (über `_lolek-shared`):** Klick auf den Stapel-Platz als Ziel löste die Engine-Rückfrage „welches Equip?" aus; Platzliste (`equipDestinations`) war schon richtig | h-P5-02 |
| lolek-the-shard-knight | C | **behoben** (derselbe Baustein `_lolek-shared`); Aufstiegsbedingung per Instanz-Name (`hasEquipped`) unberührt | h-P5-02 |
| logan-the-investment-monkee | irrelevant | ok: Ziele nur Kreaturen (`isChoosableAsCreature`) | – |
| mao-the-vengeful-guardian | A (nur Anzeige) | ok: der Picker zeigt alle eigenen offenen Support-Karten, Equips sind `ineligible` (grau) und nie wirksam wählbar | – |
| molinda-the-cutest-being-in-the-sky | irrelevant | ok: Ziele Held/Kreatur | – |
| monia-bot-the-foretold-rescuer-of-coolness | irrelevant | ok: Umleiter, nur Kreaturen-/Heldenziele | – |
| natas-the-master-of-hell | irrelevant | ok: Gift nur auf Helden/Kreaturen (Hinweis Moana unten) | – |
| pes-zet-the-plague-bringer | irrelevant | ok: Ziele Helden/Kreaturen; Auslöser nur bei Kreaturen im Platz | – |
| pharaoh-the-lone-living-being | irrelevant | ok: Divinity-Zähler am Helden, Ziele Held/Kreatur | – |
| reiza-the-chief-tormentor | irrelevant | ok (nur Kreaturen; Moana-Hinweis unten) | – |
| riffel-master-of-the-ultimate-gun | irrelevant | ok: Deck-Tutor, Aufstieg über `_riffel-shared` | – |
| sabrina-the-psychic-witch | irrelevant | ok: Opfer = Kreatur | – |
| sas-za-the-snaka-adventurer | irrelevant | ok: Kreaturen-Tod-Trigger | – |
| shu-chaku-the-blood-moon-projection | A, B | **behoben:** „any number of Artifacts": ein Stapel bestand aus mehreren Zielen mit derselben ID, gelesen wurde nur `cardInstance` des ERSTEN → je Stapel kam höchstens eine Karte zurück, die zweite gewählte blieb liegen, der Rabatt war zu klein. Jetzt ein Ziel je Platz (`_erlaubteInstanzen`), Mehrfachwahl über `gewaehlteInstanzen` (Rabatt = Summe aller zurückgegebenen) | h-P5-01 |
| silent-water-mizune | irrelevant | ok: Surprises (Zonen und verdeckte Support-Surprises); Equips sind nie Surprises | – |
| taio-absorber-of-the-mountain-s-heart | irrelevant | ok: Aufstiegsform; Sun-Sword-Bedingung liegt bei Taio, the Sun Fencer | – |
| taio-the-sun-fencer | B, D, E | ok: +20 je Artefakt als Stempel an der Instanz (`_taioAtkGranted`), Abgang/Umhängen/Tod über `onCardLeaveZone`/`onEquipLost`/`onHeroRevive`; Bonus folgt der bewegten Karte aus dem Stapel | h-P5-08 |
| tarleinn-the-traveler | irrelevant | ok: Heilziele Helden/Kreaturen | – |
| tempeluna-the-convergence-fairy | irrelevant | ok: angehängte Fee braucht eine freie Zone von Tempeluna (nie Darion); `_keinEquip` hält sie aus jedem Stapel/Equip-Zähler | – |
| tempeste-moana-the-rain-singer | B, E | **behoben (in `_equip-stack-shared.equipsAt`):** ein durch Moana zusätzlich als Kreatur zählendes Equip („Artifact/Creature") fiel aus der Stapel-Aufzählung → nach dem ersten Moana-Equip kannte Darion keinen Stapel mehr, das nächste Equip wurde abgelehnt/in eine zweite Zone gelegt. **Offen** (Engine, siehe Bericht): Kreaturenziele im Stapel | h-P5-05 |
| the-shapeshifter | D, E | ok: als Darion teilt der Shapeshifter seine Equips mit der angelegten Darion-Karte; bei Ablauf geht nur die Darion-Karte in die Ablage, der Rest-Stapel bleibt konsistent liegen (Annahme: bleibt zusammen) | h-P5-06 |
| toras-master-of-all-weapons | B, D, E | ok: zählt Artefakte mit verschiedenen Namen je Instanz (Set der Basisnamen), Gleichnamige zählen einmal; Umhängen/Ablegen aus dem Stapel korrekt | h-P5-08 |
| tsu-ki-the-lunatic-princess | irrelevant | ok: `equipCostReduction` gilt nur für den Zielhelden | – |
| vacarn-the-dark-goblin-necromancer | irrelevant | ok: Umleitung von Kreaturen; Equips bleiben unberührt | – |
| vena-the-bounty-huntress | A | ok: Confiscate im Stapel trifft die gewählte Karte (Rückfrage der Engine, `treffer.cardInstance`). Hinweis (nicht Darion): `zielWert` (CPU) liest `z?.name` an Arrays und zählt immer 0 | h-P5-07 |
| wall-breaker-general-ralzish | A | ok: „any card on the board" im eigenen und gegnerischen Stapel trifft die gewählte Karte | h-P5-07 |
