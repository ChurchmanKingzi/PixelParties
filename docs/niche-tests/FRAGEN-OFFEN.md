# Offene Fragen an Al – bereinigt (Stand 14.10.2026)

> **Stand 16.10.2026:** Alle Einzelfragen 1–179 sind beantwortet und umgesetzt (Wellen 9–14, siehe [FIXES-WELLE-9.md](FIXES-WELLE-9.md) bis [FIXES-WELLE-14.md](FIXES-WELLE-14.md)). **Stand 19.10.2026:** Die Rückfragen der Wellen 14–18 sind beantwortet und umgesetzt ([FIXES-WELLE-15.md](FIXES-WELLE-15.md), [FIXES-WELLE-16.md](FIXES-WELLE-16.md), [FIXES-WELLE-17.md](FIXES-WELLE-17.md), [FIXES-WELLE-19.md](FIXES-WELLE-19.md), [FIXES-WELLE-20.md](FIXES-WELLE-20.md), [FIXES-WELLE-21.md](FIXES-WELLE-21.md), [FIXES-WELLE-22.md](FIXES-WELLE-22.md)); alle Repros sind grün, es sind keine Rückfragen offen. **Stand 22.10.2026:** Auch die Stufe-C-Fragen der Tiefentests (Wellen 23–24) und alle Folgefragen sind beantwortet und umgesetzt ([FIXES-WELLE-24.md](FIXES-WELLE-24.md), [FIXES-WELLE-25-33.md](FIXES-WELLE-25-33.md)); offen sind nur die drei neuen Ja/Nein-Rückfragen am Ende von [FIXES-WELLE-36.md](FIXES-WELLE-36.md) (Welle 36, 22.10.2026).

Aus den ursprünglichen **179 Fragen** ([FRAGEN-AN-AL.md](FRAGEN-AN-AL.md), unverändert als Archiv) bleiben nach den Entscheidungen der Wellen 3–5: **33 beantwortet**, **10 mit Vorschlag aus deinen Entscheidungen** (nur bestätigen), **14 in einer Grundsatzfrage zusammengefasst**, **4 in einer technischen Frage zusammengefasst**, **118 einzeln offen**. Jede Frage nennt die Befund-ID; Details im verlinkten Bericht.

## 1. Grundsatzfrage: stillgelegte Passive (gefroren / betäubt / negiert) – ENTSCHIEDEN am 14.10.2026

> Al: „Freeze, Stun und Negated unterbrechen *alle* laufende passive Effekte!" Umgesetzt in Welle 7 (siehe [FIXES-WELLE-7.md](FIXES-WELLE-7.md)); neue Folgefragen dort.

Betrifft: A07-20, A08-23, B-01, B-02, B-03, B-09, C03-12, C05-11, H02-heroes-23, H03-heroes-19, H04-06, M02-05, M02-12, R02-23.

Beispiele: The Thing in the Ship, Plant Golem, Elven Forager, King Trex, Ghazma, Water Golem, Ifrit, Stealth, Terror, Junshi, Mizune, Paraseed, Damsel Cecilia, Prophecy of Tempeste. Die Karten halten ihre fortlaufende Wirkung heute, auch wenn Träger/Kreatur gefroren, betäubt oder negiert ist.

**Frage:** Verlieren fortlaufende (passive) Effekte von Karten ihre Wirkung, solange die Karte gefroren, betäubt oder (Effekt-)negiert ist – Konvention "stillgelegt = stumm" – oder gilt "liegt auf dem Brett" wörtlich? Bei Abilities-Negation (Stowaway usw.) gilt nach Welle 4 bereits: Skalierung 0, Ability-Passive stumm. Bitte je Zustand antworten: gefroren / betäubt / Effekt negiert.

## 2. Technische Frage: Server prüft Client-Antworten nach – ENTSCHIEDEN (ja), umgesetzt in Welle 7

Betrifft: B-07, M02-25, S01-13, S01-22 (Chain Lightning Kettenwahl, Zielwahl maxTotal, Wisdom-Kosten in validateActionPlay, CPU-Abbruch bei sacrifice).

**Frage:** Soll der Server Antworten des Clients generell nachprüfen und erzwingen (maxTotal/minRequired, Kettenwahl, Wisdom-Kosten), statt dem Client zu vertrauen? Empfehlung: ja (nur Absicherung, keine Regeländerung).

## 3. Vorschläge aus deinen Entscheidungen – BESTÄTIGT (Sickly Cheese präzisiert), umgesetzt in Welle 7

- **39. [A06-rebelliokai-10](A06-rebelliokai.md)** Camouflaged Kappa opfert sich unter der Knight-[B]-Sperre für nichts → Vorschlag: gesperrt (wie Cool Presents: der einzige Effekt würde scheitern → nicht aktivierbar)
- **48. [A07-13](A07-guardianbeasts.md)** Hu: 5 Karten und Zugsperre gehen verloren, wenn keine Zusatzaktion möglich ist oder abgebrochen wird → Vorschlag: Hu nur aktivierbar, wenn eine Handkarte spielbar ist (wie Shanty/Cool Presents)
- **50. [A07-18](A07-guardianbeasts.md)** Mao zahlt 5 Karten und negiert die Bestie, auch wenn deren Effekt gar nicht feuern kann → Vorschlag: Mao macht nur Bestien wählbar, deren Effekt aktivierbar ist (selbes Prinzip)
- **103. [F03-12](F03-artifacts.md)** Sickly Cheese: bei giftimmunem Helden wird die Kost „inflict Poison" nicht gezahlt, die Suche läuft trotzdem → Vorschlag: Sickly Cheese: gesperrt bei giftimmunem Helden (Kosten nicht zahlbar)
- **106. [F03-17](F03-artifacts.md)** Spice Mortar unter der Such-Sperre (Cats of the Pharaoh): Karte aus dem Gegnerdeck landet trotzdem auf der Hand → Vorschlag: Spice Mortar unter Such-Sperre gesperrt (Prinzip: Effekt kann nicht feuern → nicht aktivierbar)
- **112. [H01-heroes-22](H01-heroes.md)** Shapeshifter / Throne Robber: Held aus Deck oder Ablage trotz Such-/Handsperre → Vorschlag: Shapeshifter/Throne Robber nicht von der Such-Sperre erfasst (wie Alex/Ska/Greenhouse)
- **123. [H03-heroes-14](H03-heroes.md)** Saint Nicolas / Santa Klaus: ist der Gegner hand-gesperrt, wird die Pflicht-Abgabe nie fällig – die Aktion ist gratis → Vorschlag: Saint Nicolas: Aktion gesperrt, solange der Gegner die Pflicht-Karten nicht annehmen kann (wie Cool Presents)
- **146. [M02-17](M02-attacks-abilities-potions.md)** Magnetic Potion ist unter der Such-Sperre auf dem Server spielbar und verbraucht sich ohne Wirkung (gleiche Ursache: Elixir of Mana) → Vorschlag: Magnetic Potion/Elixir of Mana unter Such-Sperre auch serverseitig gesperrt
- **148. [M02-23](M02-attacks-abilities-potions.md)** Such-Sperre: Navigation zahlt die Abwurf-Kosten und bekommt nichts; Trapping, Premonition, Training (Deck-Option) laufen trotz Sperre ganz durch → Vorschlag: Navigation/Trapping/Premonition/Training (reine Deck-Zugriffe) unter Such-Sperre ausgegraut (wie Magnetic Potion)
- **178. [S03-26](S03-spells.md)** Shooting Star unter Stab-Sperre oder Hand-Sperre: spielbar, Karte verbraucht, nichts geholt → Vorschlag: Shooting Star unter Hand-/Stab-Sperre ausgegraut (Prinzip: Effekt kann nicht feuern)

## 4. Einzeln offene Fragen


### A01-pollution

2. **[A01-pollution-10](A01-pollution.md)** (Stufe C) – Guardian of Teocuilatl schützt nur die EIGENEN Areas
   - Soll Guardian of Teocuilatl auch **gegnerische** Areas schützen können – ja oder nur eigene?
3. **[A01-pollution-16](A01-pollution.md)** (Stufe C) – Magic Mirror: Kopie zahlt manche Kosten nicht, verbraucht fremdes „1 pro Spiel“-Limit
   - (1) Muss die Magic-Mirror-Kopie die „… to use this Spell“-Kosten des Zaubers bezahlen – ja oder nein? (2) Soll die Kopie eines „1 pro Spiel“-Zaubers das Limit des Spiegel-Besitzers verbrauchen – ja oder nein?
4. **[A01-pollution-26](A01-pollution.md)** (Stufe C) – Goldify: Gold und Zusatzaktion fließen auch, wenn die Kreatur durch Schutz überlebt
   - Soll Goldify Gold (und die Zusatzaktion) auch dann liefern, wenn die gewählte Kreatur **nicht besiegt** wurde (Schutz) – ja oder nein?
7. **[A01-pollution-38](A01-pollution.md)** (Stufe C) – 20. Doom Counter und tödlicher Archer-Schuss im selben Ereignis: der Schuss entscheidet, der Counter-Leger gewinnt
   - Löst der Archer-Schuss auf den 20. Counter noch aus (dann gewinnt der Counter-Leger, wenn der Schuss den letzten Helden tötet) oder verliert er sofort – „Uhr verliert zuerst“ / „Schuss darf noch“?

### A02-deepsea

8. **[A02-deepsea-03](A02-deepsea.md)** (Stufe B) – Arrival: die auf die Gegenseite gelegte Kreatur gehört dem Gegner (Ablage, Hand, Zähleffekte)
   - **Zusatzfrage an Al (steckt dahinter):** Soll die von Arrival platzierte Kreatur dem Wirker (Kontrolle bei mir, nur der Platz beim Gegner, Ablage bei mir) oder dem Gegner (Platz + Kontrolle beim Gegner, nur die Ablage bei mir) gehören? Die jetzige Mischung (alles beim Gegner) lässt den Analyzer/Gatherer für den Gegner arbeiten und schenkt ihm die Karte.
9. **[A02-deepsea-10](A02-deepsea.md)** (Stufe C) – Cosmic Manipulation reagiert schon auf das Platzieren (1. Hälfte von Arrival) und kann Arrivals 2. Hälfte zerstören
   - Soll Cosmic Manipulation auf das PLATZIEREN (1. Hälfte von Arrival) reagieren, oder nur auf die echte Beschwörung der 2. Hälfte? (Ja = Fensterverhalten bleibt, Nein = 1. Hälfte zählt nicht.)
10. **[A02-deepsea-12](A02-deepsea.md)** (Stufe C) – „Cards you control with Change Counters": Zählung nach Brettseite statt nach Kontrolle (geliehene Karten)
   - Zählt eine per Succubus geliehene Karte zum Zugende noch als „von mir kontrolliert" (Ja = Strafe entfällt, Counter zählen mit; Nein = wie jetzt)?
11. **[A02-deepsea-15](A02-deepsea.md)** (Stufe B) – Dark Deepsea God: „once per game" fehlt, der Flächenschaden löst jeden Zug erneut aus
   - Soll der 150-Schaden pro Spieler in der ganzen Partie nur ein einziges Mal auflösen („once per game" aus dem Kartentext) oder jedes Mal, wenn DDG gespielt wird (nur 1× je Zug)?
12. **[A02-deepsea-17](A02-deepsea.md)** (Stufe C) – Deepsea Spores: im eigenen Zug spielbar, Text nennt nur den Beginn des Gegnerzugs
   - Soll Deepsea Spores auch im eigenen Zug aktivierbar sein (Ja = so lassen, Nein = nur Reaktion zu Beginn des Gegnerzugs)?
13. **[A02-deepsea-21](A02-deepsea.md)** (Stufe C) – Analyzer / Gatherer zählen „adds cards to their hand via an effect" nicht für Karten vom Brett (Deepsea-Bounce, Shapeshift, Castle)
   - Soll Rückgabe vom Brett (Deepsea-Bounce, Shapeshift, Castle) beim Gegner Analyzer/Gatherer einen Counter geben (Ja = Wortlaut „adds cards to their hand", Nein = nur Suchen/Ziehen)?
14. **[A02-deepsea-26](A02-deepsea.md)** (Stufe C) – Deepsea Monstrosity kopiert Jack O' Lantern: die Kartenzahl hängt vom Einzugsweg der Monstrosity ab
   - Welche Stufe zählt bei Monstrosity→Jack: die von der Monstrosity zurückgenommene Jack (Lv1, in beiden Fällen 1 Karte), die beim Platzieren zurückgenommene Kreatur (wie jetzt, aber nur bei Bounce-Place) oder gar keine?
15. **[A02-deepsea-36](A02-deepsea.md)** (Stufe C) – Deepsea Primordium: die Zusatzaktion beendet die Action Phase, obwohl die Hauptaktion unverbraucht ist
   - Soll die Primordium-Zusatzaktion in der Action Phase gratis sein wie bei der Cute Crown (Ja = `freeInActionPhase`, Hauptaktion bleibt), oder bleibt es dabei, dass sie die Phase beendet (Nein)?

### A03-futuretech

16. **[A03-futuretech-10](A03-futuretech.md)** (Stufe C) – Escape Device greift nicht, wenn ein Spell ein Puppet-Token wählt, obwohl der Held den Schaden trägt
   - Soll Escape Device (und andere Hand-Reaktionen auf „Held wird gewählt“) auch auslösen, wenn der Spell/Attack ein Token von Tri Fecta/Tri Ad wählt – ja oder nein?
17. **[A03-futuretech-11](A03-futuretech.md)** (Stufe C) – Iterative Testing: „up to 2“ sendet immer die Höchstzahl, keine Wahl
   - Soll Iterative Testing den Spieler wählen lassen, ob 1 oder 2 Kopien gesendet werden – oder immer die Höchstzahl (ja = Wahl / nein = immer max)?
18. **[A03-futuretech-14](A03-futuretech.md)** (Stufe C) – Jetpack vs. Escape Device: „Stufe ≤ Anzahl“ bei 0 Kopien in der Ablage unterschiedlich ausgelegt
   - Soll Jetpack bei 0 Kopien in der Ablage Stufe-0-Attacken abwehren (wie Escape Device Stufe-0-Zauber) – ja oder nein?
19. **[A03-futuretech-15](A03-futuretech.md)** (Stufe C) – Copy Device als Control Device: Unterhalt am Zugende löscht eine echte Control Device, obwohl die Kopie gleichzeitig abfällt
   - Soll eine als Control Device kopierte Copy Device am Zugende noch Unterhalt zahlen (Karte aus der Ablage löschen) – „zahlen“ oder „abfallen“?
20. **[A03-futuretech-22](A03-futuretech.md)** (Stufe B) – The Core's Awakening: die Staffel „1/2/3" folgt dem ersten tauglichen Helden, nicht dem gewählten Wirker
   - **Beobachtet:** (a) nur 1 Kopie, (b) 3 Kopien – die Stufe von Held 0 zählt, egal wen der Spieler wählt (Kettenglied trägt `casterHeroIdx: 1`, wird ignoriert). Bei zwei Helden mit verschiedener Stufe hängt das Ergebnis damit von der Aufstellung ab, nicht von der Wahl des Spielers. Nebenbei: es gibt keine Mengenwahl („up to"): es werden immer `min(Stufe, Kopien im Deck)` gesendet (gleiche Lage wie -11, dort als Frage an Al).
23. **[A03-futuretech-29](A03-futuretech.md)** (Stufe C) – Cybug RHINOCEROS übersieht die Control Device, die der Gegner in die EIGENE Support Zone legt (Anleger = Gastgeberseite)
   - Soll „your opponent places a card into a Support Zone“ auch das Anlegen einer Cross-Side-Ausrüstung (Control Device, Powder Keg) in die eigene Zone treffen – ja oder nein?

### A04-cute

24. **[A04-cute-11](A04-cute.md)** (Stufe C) – Was zählt als „Cute" Creature? Name (Crown, Mary, Monami) gegen Archetyp (Army, Pink Sky, Conversion, Mini)
   - Soll „Cute" Creature immer der **Name** (Wort „Cute") sein – ja (dann zählt Cute Spider überall) oder der **Archetyp** (dann zählt Cute Spider nirgends)?
25. **[A04-cute-15](A04-cute.md)** (Stufe C) – Wildur (Lv1) lässt sich vom Coolness Stack ohne Summoning Magic beschwören
   - Soll die Beschwörung vom Coolness Stack die Stufe des Helden verlangen (Wildur: Summoning Magic 1) – ja oder nein?
26. **[A04-cute-22](A04-cute.md)** (Stufe C) – Lunatic Hawk (Stufe 3) verdoppelt die eigenen HP bei der eigenen Beschwörung nicht
   - Soll Hawk bei der eigenen Beschwörung (Stufe 3 liegt schon) selbst verdoppelt werden – ja oder nein?

### A05-skeletons

28. **[A05-06](A05-skeletons.md)** (Stufe C) – Bomblebee Cluster: zweite Bomblebee mit gleichem Namen wie die auslösende?
   - Darf Bomblebee Cluster eine zweite „Bomblebee" mit demselben Namen wie die gerade beschworene auslösende Karte holen (ja/nein)?
29. **[A05-07](A05-skeletons.md)** (Stufe C) – Burning Fuse: im eigenen Zug spielbar; Time Bomblebee ausgeschlossen
   - (a) Soll Burning Fuse im eigenen Zug spielbar bleiben (ja = wie jetzt) und (b) soll Time Bomblebee von Burning Fuse erfasst werden (ja/nein)?
30. **[A05-10](A05-skeletons.md)** (Stufe C) – Sandy Blob feuert, obwohl der On-Summon-Effekt (z. B. Cloudy Slime ohne Ziel) nichts tut
   - Soll Sandy Blob auch dann feuern, wenn der On-Summon-Effekt der Kreatur mangels Ziel/Kandidat nichts bewirkt (ja = wie jetzt / nein)?
31. **[A05-14](A05-skeletons.md)** (Stufe C) – Raise the Minions! + Skeleton King Skullmael: Bonus hängt von der Wahlreihenfolge ab
   - Sollen bei Raise the Minions! alle im selben Wurf gelegten Skelette den Skullmael-Bonus bekommen, egal in welcher Reihenfolge (ja = gleichzeitig / nein = wie jetzt)?
32. **[A05-15](A05-skeletons.md)** (Stufe C) – Vacarn + The Bonegrinder: Vacarns Löschen verdrängt das Bonegrinder-Ziehen
   - Soll The Bonegrinder auch dann ziehen dürfen, wenn Vacarn das Skelett ohnehin löscht (ja/nein)?
33. **[A05-18](A05-skeletons.md)** (Stufe C) – Raise the Minions! beendet den Zug, der Kartentext nennt das nicht
   - Soll Raise the Minions! den Zug beenden (ja = wie jetzt, Kartentext in cards.json wäre zu ergänzen / nein = Zeile entfernen)?
34. **[A05-22](A05-skeletons.md)** (Stufe C) – Skeleton Necromancer: Abwerfen als Kosten vor der Wahl? (Wortlaut „discard a card to choose …")
   - Soll das als Kosten abgeworfene Skelett vom Skeleton Necromancer sofort wieder wählbar sein (ja/nein)?
35. **[A05-23](A05-skeletons.md)** (Stufe C) – „Deepsea Skeleton" zählt für keine Skeleton-Karte als „Skeleton" Creature
   - Soll „Deepsea Skeleton" als „Skeleton" Creature zählen (ja/nein)?
36. **[A05-27](A05-skeletons.md)** (Stufe C) – Spinnen-Kosten „send N Surprises": offen liegende Spider Silk Bridge zählt nicht mit
   - Darf eine offen liegende Spider Silk Bridge als Kosten für Box/Brain/Crimson Skull/Diamond Spider gesendet werden (ja/nein)?

### A06-rebelliokai

37. **[A06-rebelliokai-02](A06-rebelliokai.md)** (Stufe C) – Loyal Bone Dog wird bei Zerstören/Opfer nicht angeboten
   - Soll Loyal Bone Dog auch gegen Zerstören-Effekte und Opfer (nicht nur tödlichen Schaden) angeboten werden – Ja oder Nein?
38. **[A06-rebelliokai-03](A06-rebelliokai.md)** (Stufe C) – Bone Dog + Loyal Shepherd: Bone Dog wird bezahlt, die Wiederbelebung fizzelt
   - Soll die Bone-Dog-Wiederbelebung VOR den Todes-Triggern anderer Karten (Shepherd, Terrier …) aufgelöst werden („immediately") – Ja oder Nein?
40. **[A06-rebelliokai-17](A06-rebelliokai.md)** (Stufe C) – Tanuki Escape schließt zurückgemischte Namen von der Suche aus
   - Darf Tanuki Escape eine Karte suchen, deren Name der einer eben zurückgemischten Karte ist – Ja oder Nein?
41. **[A06-rebelliokai-20](A06-rebelliokai.md)** (Stufe C) – Chilly Wizard: gespiegelter Status bleibt auf dem Wirt, wenn der Wizard ihn verliert oder stirbt
   - Soll der gespiegelte Status enden, sobald der Wizard ihn nicht mehr trägt oder das Feld verlässt („gebunden"), oder läuft er allein ab – „gebunden" oder „läuft ab"?
44. **[A06-rebelliokai-27](A06-rebelliokai.md)** (Stufe B) – Mischief Invasion beschwört trotz Beschwörungssperre und Host-Aktionssperre
   - **Nebenbefund (Frage, Stufe C):** Der Skriptkopf nimmt Lv-0-Kreaturen von der Statusprüfung aus („not Frozen / Stunned / Negated / Bound for Lv > 0 Creatures"): ein gefrorener oder betäubter Held bekommt über Invasion z. B. Heli Troopers (Lv0) beschworen (gemessen, ✗ gegen die Regel). In `validateActionPlay` (`_engine.js` ≈ 20712) gilt das Frost-/Betäubungs-Tor dagegen für alle Stufen.  Darf ein gefrorener/betäubter Held eine Lv-0-Kreatur über Mischief Invasion beherbergen – Ja oder Nein?
46. **[A06-rebelliokai-35](A06-rebelliokai.md)** (Stufe C) – War Council Gathering Place: die 8 Gold sind weg, wenn die Zielwahl des Ratgebers danach abgebrochen wird
   - Soll das Gold zurückerstattet werden, wenn der ausgelöste Ratgeber-Effekt mangels Zielwahl abgebrochen wird – „zurück" oder „verloren"?

### A07-guardianbeasts

47. **[A07-07](A07-guardianbeasts.md)** (Stufe C) – „Erste Kreatur, die du beschwörst": Platzierungseffekte zählen uneinheitlich (Xuanwu zählt, Vullary/Stellin nicht)
   - „Zählt eine Platzierung durch Xuanwu NICHT, eine Beschwörung durch Vullary/Stellin dagegen SCHON als ‚erste Kreatur, die du beschwörst' (Harpyformer-Gratisaktion) – ja oder nein?"
49. **[A07-17](A07-guardianbeasts.md)** (Stufe C) – Zwei Clausss im selben Zug: das zweite Opfer bringt nichts und ist trotzdem erlaubt
   - „Soll die zweite Clausss gesperrt sein, solange die zweite Aktion schon vergeben ist – ja oder nein (alternativ: dritte Aktion)?"

### A08-pacman

54. **[A08-10](A08-pacman.md)** (Stufe C) – Distracting Crystal und Einsatz-/Auslöser-Effekte, die ins Deck mischen (Black Marketeer, Deepsea Stein, The Stormblade, Lunatic Cycle - Crescent Moon)
   - Soll Distracting Crystal auch den Einsatz-Effekt (Marketeer/Stein beim Beschwören) und die Auslöser von Stormblade/Crescent Moon unterdrücken – ja oder nein?
55. **[A08-19](A08-pacman.md)** (Stufe C) – Waflav-Formen: „any target on the board" schließt Ausrüstung/Tokens ein (Status wirkungslos, Counter trotzdem); Wiederholung zählt bei Helden, bei Kreaturen nicht
   - (1) Sollen Ausrüstung und Tokens (kein Creature) bei „any target on the board" wählbar sein – ja oder nein? (2) Zählt „Whenever a target is Burned/Poisoned" auch, wenn das Ziel schon brennt/vergiftet ist – ja oder nein (Helden jetzt ja, Kreaturen nein)?
56. **[A08-22](A08-pacman.md)** (Stufe B) – "Bloom", the Continent Corruptor + Bloom, the Maniacal Botanist: Gift-Heilung hängt von der Heldenreihenfolge ab
   - Soll die Heilung den Grundschaden **plus alle Paraseed-Auren** enthalten (Maniacal +50 je Paraseed, Continent +100) – ja (Aura zählt als Teil des Poison-Schadens) oder nein (nur der Grundschaden)? Entscheidend ist, dass beide Reihenfolgen gleich rechnen.
58. **[A08-27](A08-pacman.md)** (Stufe C) – Rusting Crystal: die zweite Kopie auf der Hand verdoppelt die Kosten der ersten nicht
   - Soll bei zwei Rusting Crystal auf der Hand jede Kopie als „anderes Artefakt" der anderen gelten (Kosten 30) – ja oder nein (Kosten bleiben 15)?
59. **[A08-32](A08-pacman.md)** (Stufe C) – Afflicted Pests reagiert nicht, wenn der Gegner eine Ability anlegt (Text „equips or attaches a card to a Hero")
   - Soll Afflicted Pests auch auslösen, wenn der Gegner eine Ability an einen Helden anlegt – ja oder nein?

### A09-idej

61. **[A09-18](A09-idej.md)** (Stufe C) – Bonded Companion Thuly: das Opfer eines HELDEN löst „when you sacrifice a target" nicht aus
   - Soll Thulys „sacrifice a target" auch Helden-Opfer (Teocuilatl, Rick, Divine Gift of Sacrifice) erfassen, oder nur Kreaturen?
62. **[A09-19](A09-idej.md)** (Stufe C) – Priest of Luna / Tempeste: Gift-/Brand-Ticks lösen bei Helden den Priester aus, bei Kreaturen nie
   - Zählen Gift-/Brand-Ticks als „takes damage" für die Priester – bei Helden UND Kreaturen (dann den Filter in den Kreaturen-Zweigen entfernen) oder nirgends (dann im Helden-Zweig `damageType`/Status herausfiltern)?

### B-querschnitt

66. **[B-05](B-querschnitt.md)** (Stufe B (zwei C-Randfälle)) – Erste-Runden-Immunität: Karten wirken auf den geschützten Spieler
   - Gilt die Immunität auch gegen *vorteilhafte* oder *zustandsändernde Nicht-Schadens*-Effekte (Karte schenken, Gold zurücksetzen, Karte hinlegen)? Die Engine schützt Schaden/Status/Discard/Mill/Ziele, nicht Platzierung, Deck-Zug, Gold, Geschenke.

### C01-creatures

69. **[C01-07](C01-creatures.md)** (Stufe C) – 500 Piranhas: Schaden folgt dem Kontrolleur der Kreatur statt dem Kontrolleur des Wirtshelden
   - Bezieht sich „its controller's turns" auf den Wirtsheld (dann wechselt der Schaden nach Heldendiebstahl auf meine Züge) oder auf die Piranhas (jetzt: bleibt beim Gegner)?
70. **[C01-08](C01-creatures.md)** (Stufe C) – Candlestick Squire: bei Brand auf dem Brett gibt es keine normale Beschwörung mehr (Heilung ist Pflicht)
   - Soll Squire bei vorhandenem Brand weiterhin normal (1 Aktion, ohne Heilung) beschwörbar sein, oder ist „Brand heilen" bei vorhandenem Brand bewusst Pflicht?
71. **[C01-11](C01-creatures.md)** (Stufe C) – Assault Eagle: die Antwort-Salve des Gegners erhält ebenfalls den Angler-Bonus
   - Gilt die Antwort-Salve des Eagle (anderer Wähler, nach der ersten Salve) als zweite Schadensinstanz (kein Bonus) oder noch als Teil derselben (dann +50)?
72. **[C01-13](C01-creatures.md)** (Stufe C) – 500 Piranhas: das Opfer ersetzt sich in derselben Zone (Cute Bird → Cute Phoenix) – Opfer verloren, Piranhas bleibt auf der Hand
   - Wenn die Zone des Opfers sofort wieder belegt wird (Cute Bird → Phoenix): soll die Piranhas (a) auf der Hand bleiben (jetzt; Opfer ist gefallen, Karte nicht gespielt, nochmals spielbar), (b) in eine andere freie Zone des Gegners gelegt werden oder (c) abgelegt werden?
73. **[C01-14](C01-creatures.md)** (Stufe C) – Spirit of the Forbidden Grimoire leiht den Effekt eines im selben Zug schon benutzten Cannon Tower (Giant mit 3/3 wird dagegen ausgeschlossen)
   - Darf das Grimoire (und Kohta) den Effekt einer Kreatur wiederholen, die ihn in diesem Zug schon benutzt hat (jetzt: ja, nur bei Karten ohne eigenen Zähler), oder bindet „once per turn" auch die geliehene Verwendung?

### C02-creatures

74. **[C02-05](C02-creatures.md)** (Stufe C) – Drill Sergeant, gestohlen: „corresponding Hero" wird auf den gleich nummerierten Helden des Diebes abgebildet
   - Soll ein gestohlener Drill Sergeant bei (a) dem Helden unter dem er liegt (Gegnerseite, Karte gehört dem Dieb), (b) einem beliebigen eigenen Helden des Diebes legen, oder (c) nur beim Besitzer funktionieren?

### C03-creatures

75. **[C03-02](C03-creatures.md)** (Stufe B) – Inconspicuous Lawn Gnome (gestohlen): die Stufenwahl geht an den Besitzer, nicht an den Aktivierenden
   - Darf der Dieb/Borger eines Gnoms dessen Stufe ändern (ja = Prompt an den Dieb) oder nicht, weil der Gnom nicht „auf seiner Seite des Bretts" liegt (nein = Aktivierung sperren)?
76. **[C03-09](C03-creatures.md)** (Stufe B) – Golden Vermin fängt das automatische Rundeneinkommen (4 Gold) ab, obwohl der Text „through an effect" sagt
   - Soll Golden Vermin das automatische Rundeneinkommen ersetzen dürfen (ja = jetziges Verhalten) oder nur Effekt-Gold wie die Monkees (nein)?
77. **[C03-10](C03-creatures.md)** (Stufe C) – Mr. Jiggles (gestohlen): die geliehene Kreatur selbst wird als „Ziel, das dein Gegner kontrolliert" angeboten
   - Darf eine geliehene Kreatur ihren eigenen Wirtsplatz als Gegnerziel wählen (ja = Brettseite zählt) oder soll sie herausgefiltert werden (nein = Kontrolle zählt)?
79. **[C03-13](C03-creatures.md)** (Stufe C) – Inconspicuous Lawn Gnome: „once per turn" gilt getrennt für Hand und Brett – im selben Zug zweimal umstellbar
   - Eine Stufenänderung je Zug und Karte insgesamt (Lesart A) oder je Ort, also einmal in der Hand und einmal auf dem Brett (Lesart B = jetzt)?
80. **[C03-15](C03-creatures.md)** (Stufe C) – Mausoleum Worm: „You can only play 1 Mausoleum Worm per turn" begrenzt nur die Platzierung aus der Ablage, nicht das Spielen aus der Hand
   - Gilt „play 1 per turn" für jeden Weg aufs Brett (Hand und Ablage zusammen = A) oder nur für den Ablage-Weg (B = jetzt)?
81. **[C03-16](C03-creatures.md)** (Stufe B) – Mr. Jiggles und Land Sharks mit Angler Angel: bei mehreren Zielen wird nur das erste um +50 erhöht (Bestätigung von C01-10)
   - **Vermutete Ursache:** wie C01-10 (Rundensperre `angler-boost:<id>` wird vom ersten Treffer gebucht); Jiggles/Sharks bauen für jeden Treffer eine neue Quelle `{ name, owner, heroIdx }` bzw. rufen `ctx.dealDamage` einzeln, ohne gemeinsame Schlag-Kennung. Nicht erneut gefragt: Frage an Al steht bei C01-10.
82. **[C03-17](C03-creatures.md)** (Stufe C) – Horned Demon (von Lovely Teddy geliehen): der Leiher legt am Ende SEINES Zuges einen Demon Counter auf die Gegner-Kreatur
   - Soll ein von Lovely Teddy/Aligning Goals geliehener Demon am Zugende des Leihers einen Counter bekommen (jetzt) oder nur am Ende der Züge seines Besitzers (nein)?

### C05-creatures

85. **[C05-08](C05-creatures.md)** (Stufe C) – The Spawn Mother („alles"-Modus) und Gleichstand: bei gleichzeitigem Aus beider Seiten gewinnt immer Sitz 1
   - Wenn ein Effekt ohne Klausel beide Seiten gleichzeitig auslöscht: soll der **Wirker/aktive Spieler verlieren**, der **Wirker gewinnen** – oder bleibt es beim Sitz-Standard (Sitz 0 verliert)? (Gleiches gilt für jede Flächenkarte ohne eigene Klausel.)
86. **[C05-09](C05-creatures.md)** (Stufe C) – Wire Hatchling: Abbruch der Einsatz-Zielwahl lässt die Kreatur auf dem Brett (Aktion verbraucht)
   - Soll der Abbruch der Zielwahl im Einsatz-Effekt einer Kreatur die Beschwörung zurücknehmen (Karte zurück auf die Hand, Aktion erstattet) – oder bleibt die Kreatur ohne Effekt auf dem Brett?

### F01-artifacts

88. **[F01-08](F01-artifacts.md)** (Stufe C) – Anti-Magnet spielbar ohne weitere eigene Ziele (Umleitung auf den Angreifer)
   - Soll Anti-Magnet nur spielbar sein, wenn der Besitzer **selbst** ein weiteres mögliches Ziel kontrolliert (wörtlich), oder genügt ein beliebiges anderes Ziel des Effekts (heutiges Verhalten)?
89. **[F01-09](F01-artifacts.md)** (Stufe C) – Blood-Soaked Coin: dauerhaft übernommene Ziele sind keine „target you permanently control"
   - Soll ein per Dark Gear bzw. dauerhaft übernommenes Ziel für Blood-Soaked Coin wählbar sein (Wortlaut „permanently control") – ja oder nein (heute: nein, nur ursprünglich eigene Karten)?
91. **[F01-14](F01-artifacts.md)** (Stufe C) – Gigantisaur Skull: im eigenen Zug proaktiv spielbar
   - Soll der Gigantisaur Skull NUR als Reaktion im Gegnerzug spielbar sein (wörtlich), oder auch proaktiv im eigenen Zug auf eine beliebige Kreatur (heute)?
92. **[F01-24](F01-artifacts.md)** (Stufe C) – Item Lock: die Lösch-Kosten bleiben bei einem Abbruch der Boomerang-Galerie verloren
   - Soll ein abgebrochenes Artefakt-Spielen die Item-Lock-Löschung zurücknehmen bzw. gar nicht erst verlangen (wie bei zielenden Artefakten) – ja oder nein (heute: die Karte ist verloren)?
93. **[F01-25](F01-artifacts.md)** (Stufe C) – Glass of Marbles zieht 2, wenn es als Handlimit-Abwurf am Zugende abgelegt wird
   - Soll das Handlimit am Zugende Glass of Marbles auslösen (heute: ja, 2 Karten ziehen), oder zählt nur ein Karteneffekt als „by an effect" – eins von beiden?

### F02-artifacts

94. **[F02-06](F02-artifacts.md)** (Stufe C) – Heart-Shaped Bow: Love-Shot-Angebot nur einmal pro Zug und Bogen – im Text steht das nicht
   - Soll das Love-Shot-Angebot des Bogens einmal pro Zug und Bogen begrenzt sein (jetzt ja) oder bei jedem Angriff erscheinen?
95. **[F02-07](F02-artifacts.md)** (Stufe C) – Rain Viola am Gegner-Helden: die Suche geht an den Gegner (CARD_API sagt „wirkungslos")
   - Meint „wirkungslos" im Ruling „für den Ausrüster" (dann ist es so gewollt: der Gegner profitiert) oder „für beide"?
97. **[F02-13](F02-artifacts.md)** (Stufe B) – Shard of Chaos löscht Handkarten, bevor die Ablage-Ausgangssperre greift – Eye-of-Ren-Ablehnung lässt die Karten verloren und den Shard in der Hand
   - **Frage an Al (nur Teil b):** Soll Shard of Chaos unter der harten Ablage-Sperre (Stäbe) spielbar bleiben und trotzdem die Handkarten löschen, oder bei gesperrter Ablage gar nicht spielbar sein?
98. **[F02-18](F02-artifacts.md)** (Stufe C) – Sacrificial Dagger löst nur bei geopferten Kreaturen aus, nicht bei geopferten Helden
   - Soll ein geopferter Held (Divine Gift of Sacrifice, Teocuilatl) den Dagger auslösen („target" wörtlich) oder gilt er nur für Kreaturenopfer (heute)?
99. **[F02-19](F02-artifacts.md)** (Stufe C) – Heart of Ice: ein tödlicher Treffer auf den Träger friert den Angreifer nicht ein
   - Soll der Angreifer auch einfrieren, wenn sein Treffer den Träger tötet (Heart-of-Ice-Vergeltung „im Sterben") – ja oder nein?
100. **[F02-21](F02-artifacts.md)** (Stufe C) – Shard of Chaos: Kreaturen zählen als „Attack/Spell" – der Text nennt nur Ability, Attack/Spell, Artifact, Potion, Hero
   - Soll Shard of Chaos Kreaturen als eigenen Typ führen (Kreatur nur gegen Kreatur) oder wie bisher mit Attack/Spell in einen Topf werfen?

### F03-artifacts

101. **[F03-05](F03-artifacts.md)** (Stufe C) – Super-Killing Knife: ein Knife-Kill zählt weder für Wanted Poster noch für Skullmael's Greatsword als „Held besiegt ein Ziel"
   - Soll ein Knife-Kill als „der Held besiegt das Ziel (mit einem Angriff)" gelten (Poster zieht 2, Skullmael löst aus) – ja oder nein?
102. **[F03-09](F03-artifacts.md)** (Stufe B) – Slippery Fridge verschiebt genau eine Ausrüstung, der Kartentext sagt „any number"
   - Soll die Fridge wirklich mehrere Ausrüstungen (alle von einem Helden) gleichzeitig verschieben, wie der Kartentext sagt – ja oder bleibt es bei einer?
105. **[F03-15](F03-artifacts.md)** (Stufe C) – Teal Fishing Rod: „not sent there this turn" nur am Namen geprüft – ein in diesem Zug erneut abgelegtes Exemplar ist angelbar
   - Ist die Namens-Näherung gewollt (seltener Fall) oder soll die Rod zählen, wie oft der Name seit Zugbeginn dazukam (zweites Exemplar nicht wählbar) – Näherung behalten oder zählen?

### H01-heroes

108. **[H01-heroes-06](H01-heroes.md)** (Stufe C) – Alice, the Puppeteer Girl: „treated as … a Destruction Magic Spell“ – Anti Magic greift nicht
   - Soll Alice' Effekt von Anti Magic (Spell-Immunität nach Stufe) geblockt werden – ja (Stufe 0 des Pseudo-Spells) oder nein (nur Destruction-Synergien wie Bartas/Beato)?
109. **[H01-heroes-07](H01-heroes.md)** (Stufe C) – Shapeshifter als Chaos-Diamond: Potion-Zieh-Sperre bleibt dauerhaft
   - Soll die Potion-Zieh-Sperre nach dem Abfallen der Chaos-Diamond-Gestalt bestehen bleiben – ja oder nein?
111. **[H01-heroes-19](H01-heroes.md)** (Stufe C) – Dajan: scharfgestellter Gratis-Artefaktkauf bleibt gültig, wenn Dajan danach negiert/gefroren/besiegt wird
   - Soll das Scharfstellen verfallen, wenn Dajan vor dem Spielen negiert/gefroren/besiegt wird – ja oder nein (einmal verpflichtet = bleibt)?

### H02-heroes

113. **[H02-heroes-07](H02-heroes.md)** (Stufe C) – Ida: Durchschlag ignoriert „unaffected" nicht bei Cardinal Beasts
   - Soll Idas Zauberschaden Cardinal Beasts (absolute Immunität) trotzdem treffen – ja oder nein?
114. **[H02-heroes-11](H02-heroes.md)** (Stufe C) – Karian: gefroren/betäubt im Gegnerzug – Reaktions-Spell nicht spielbar
   - Soll eine gefrorene/betäubte Karian auch im Gegnerzug (und in Start-/Resource-/End-Phase) Reaktionen und Fähigkeiten nutzen können („otherwise not affected") – ja oder nein?
115. **[H02-heroes-12](H02-heroes.md)** (Stufe C) – Karian: „Soul Transmitted" (negativer Status) wirkt trotz „Other negative status effects don't affect this Hero"
   - Soll Karians Immunität auch den Lösch-Ersatz von Soul Transmitted aufheben (sie bleibt dann beim zweiten Tod unversehrt) – ja oder nein?
118. **[H02-heroes-28](H02-heroes.md)** (Stufe C) – Doq: der Spieler wählt die Handkarte selbst, der Text sagt „random card"
   - Soll Doq die Gegnerkarte zufällig bestimmen (Kartentext) oder weiter vom Spieler anklicken lassen (jetziges Verhalten) – zufällig / anklicken?
119. **[H02-heroes-34](H02-heroes.md)** (Stufe C) – Layn Defender: übernommene oder umgesetzte Kreaturen bekommen +100 HP, obwohl sie nicht „beschworen" werden
   - Soll Layns Bonus auch Kreaturen treffen, die per Capture/Diplomacy/Dark Gear übernommen oder zwischen Zonen verschoben werden (jetziges Verhalten), oder nur beschworene/platzierte – ja / nur beschworene?
120. **[H02-heroes-35](H02-heroes.md)** (Stufe C) – Lethe: ein Held, der Lethes Effekt erst nach dem Tod gewinnt (Shapeshifter), ist nicht gesperrt
   - Soll ein Held, der Lethes Effekt (Shapeshifter, Pseudonia, Throne Robber) erst nach dem Tod gewinnt, für den Rest des Zeitfensters gesperrt sein – ja / nein (nur wer beim Tod Lethe ist)?

### H03-heroes

121. **[H03-heroes-02](H03-heroes.md)** (Stufe B (Damsel-Teil: C)) – Von Pseudonia gewonnene Effekte laufen nicht, wenn das Skript den eigenen Kartennamen prüft
   - (nur Damsel-Teil): Soll Pseudonia mit Damsels Effekt das Extra-Leben bekommen („this Ascended Hero" → Pseudonia ist keiner) – ja oder nein?
122. **[H03-heroes-05](H03-heroes.md)** (Stufe C) – Omikrons Illusion löst keine „Creature placed"-Trigger aus (Nero Zira, Maya, Pes'zet, Madame Guillotine …)
   - Sollen fremde „Creature placed"-Trigger (Nero, Maya, Pes'zet) bei Omikrons Illusion feuern wie bei Create Illusion/Staff of Illusions – ja oder nein?
124. **[H03-heroes-16](H03-heroes.md)** (Stufe B (Randfall „tot" = C)) – Nicolas, the Hidden Alchemist: die Trank-Sperre nach dem 2. Trank gilt auch bei gefrorenem/betäubtem Nicolas
   - (nur Fall „tot"): „(even if this Hero gets defeated before then)" – soll die Sperre auch entstehen, wenn Nicolas zwischen dem 1. und 2. Trank fällt (jetzt: nein, weil `hp <= 0` übersprungen wird) – ja oder nein?
125. **[H03-heroes-18](H03-heroes.md)** (Stufe C) – Lolek, the Shard Knight: „half its Cost" rechnet vom gedruckten Grundpreis, nicht vom wirksamen Preis (Future Tech Laser Cannon)
   - Meint „half its Cost" den aktuell wirksamen Preis der Karte (Laser Cannon: 0–20 ⇒ 0–10 Gold) oder den gedruckten (60 ⇒ 30 Gold)?

### H04-heroes

129. **[H04-11](H04-heroes.md)** (Stufe C) – Taio, Absorber of the Mountain's Heart: Abbruch der Zielwahl im Nachguss verbraucht die Karte (Hand oder Deck) und die Einmal-Sperre
   - Soll ein Abbruch der Zielwahl im Taio-Nachguss die Karte zurückgeben (Hand/Deck) und den Einmal-pro-Zug-Anspruch frei lassen (wie bei Yukana), oder ist die Galerie-Wahl bewusst der Zusagepunkt? Ein Wort: „zurück" oder „verbraucht".
132. **[H04-17](H04-heroes.md)** (Stufe B (Einmal-Limit) / C (Spielbedingung)) – Timeless King Zi: der Sofort-Guss ignoriert „once per game" (Divine Gift) und die Spielbedingung (Call for Help)
   - **Frage an Al (Teil Spielbedingung):** Soll Zi einen Zauber, dessen Spielbedingung nicht erfüllt ist (Call for Help, Reunion, Guard Duty …), nicht ausführen („if possible") oder ist „regardless of its level" die einzige Ausnahme? Ein Wort: „entfällt" oder „wirkt trotzdem". (Das Einmal-Limit halte ich wegen der Engine-Konvention für B.)

### M01-attacks-abilities-potions

133. **[M01-01](M01-attacks-abilities-potions.md)** (Stufe B) – Flashbang: Tränke und Normal-Artefakte des Betroffenen beenden seinen Zug sofort
   - Zählt das Spielen eines Tranks / Normal-Artefakts in der Main Phase als „Action" für Flashbang (ja = wie jetzt, nein = nur Spell/Attack/Creature/Ability-mit-Aktion/Heldeneffekt)?
134. **[M01-04](M01-attacks-abilities-potions.md)** (Stufe B) – Cloud in a Bottle schützt nur Helden, nicht Kreaturen
   - Soll Cloud in a Bottle auch Kreaturen schützen („target you control", ja) oder bleibt es bei Helden?
136. **[M01-06](M01-attacks-abilities-potions.md)** (Stufe C) – Friendship Lv1: Zusatzaktion gesperrt, wenn vorher schon ein Support-Magic-Spell gewirkt wurde
   - Darf ein Friendship-Lv1-Held die Zusatzaktion nutzen, nachdem in diesem Zug schon ein anderer Support-Magic-Spell gewirkt wurde (ja = Wortlaut / nein = wie jetzt)?
137. **[M01-11](M01-attacks-abilities-potions.md)** (Stufe B) – Adventurousness (Action-Ability) ist trotz gefrorenem/betäubtem/verstricktem Wirtsheld aktivierbar
   - Darf ein gefrorener/betäubter Held seine Action-Ability (Adventurousness) nutzen (ja = wie jetzt / nein = wie bei Spells und freien Abilities)?
138. **[M01-12](M01-attacks-abilities-potions.md)** (Stufe B) – Elixir of Strength feuert auch bei Attacks mit mehreren Zielen und wird dabei verbraucht
   - Soll der Elixir nur bei Attacks mit genau einem Ziel feuern (Text, Buff bleibt sonst) oder am ersten Treffer jeder Attack (wie jetzt)?
139. **[M01-17](M01-attacks-abilities-potions.md)** (Stufe C) – Hammer Throw: der Item Lock greift auch, wenn Escape die Attack (samt Schaden) negiert
   - Soll ein von Escape (oder einem Schild) verhinderter Hammer Throw den Item Lock trotzdem setzen (ja = wie jetzt / nein = Lock entfällt)?
140. **[M01-19](M01-attacks-abilities-potions.md)** (Stufe B) – Ferocious Tiger Kick (2. Attack): die Heilung zählt den Überhang (Overkill) mit
   - Soll Tiger Kick den tatsächlichen HP-Verlust heilen (10, wie Golden Arrow & Co.) oder den vollen Angriffswert (40, wie jetzt)?

### M02-attacks-abilities-potions

143. **[M02-06](M02-attacks-abilities-potions.md)** (Stufe C) – Weapon Storm lässt sich vor der ersten gesendeten Karte nicht abbrechen (Schwesterkarte Breaking Strike schon); Abbruch-Knopf = 40 Wiederholungen, Karte verbraucht
   - Soll Weapon Storm wie Breaking Strike vor der ersten abgelegten Karte abbrechbar sein (Karte bleibt auf der Hand) – ja oder nein?
144. **[M02-11](M02-attacks-abilities-potions.md)** (Stufe B) – Resistance schützt nicht vor Life Serum (+150 Max-HP) und Teleportation Powder (Entfernen aus dem Spiel)
   - Soll Resistance auch „nicht-Schaden"-Wirkungen ohne Status (Max-HP-Buffs eigener Karten, Entfernen aus dem Spiel, Ability-Abwurf) abfangen – oder ist der Schutz bewusst auf Status/Heilung beschränkt?
147. **[M02-20](M02-attacks-abilities-potions.md)** (Stufe C) – Overflowing Chalice und Pressed Skill: „a Hero you control" nutzt die physische Heldenreihe statt der Kontrolle (gecharmte Helden)
   - Soll Overflowing Chalice die Helden nach Kontrolle (`heroesControlledBy`) anbieten – ja oder nein (Charme-Helden sind ein Randfall)?

### R01-reaction-area-attach-surprise

150. **[R01-06](R01-reaction-area-attach-surprise.md)** (Stufe C) – Divine Gift of Time reagiert nur auf Mill, Abwurf und Kreaturentod – nicht auf zerstörte Attachments oder ausgelöste Surprises
   - Soll Divine Gift of Time auch dann zurückholen, wenn ein Attachment/eine Ausrüstung zerstört oder eine Surprise ausgelöst wird und in die Ablage geht (ja = „from anywhere" wörtlich / nein = nur Mill, Abwurf, Kreaturentod wie jetzt)?
151. **[R01-07](R01-reaction-area-attach-surprise.md)** (Stufe B) – Divine Gift of the Guardian macht ALLE eigenen Kreaturen immun, nicht nur „those Creatures"
   - Alle Kreaturen schützen (wie jetzt) oder nur die, die den Schaden erleiden würden?

### R02-reaction-area-attach-surprise

152. **[R02-06](R02-reaction-area-attach-surprise.md)** (Stufe B) – Unwanted Audience negiert Bomb Mite (rein passive Kreatur) und verzögert damit die Detonation
   - (Teil „passive Effekte"): Soll Unwanted Audience bei Kreaturen mit aktivem und passivem Effekt NUR den aktiven sperren (Kartentext wörtlich) oder wie bisher die ganze Kreatur negieren?
153. **[R02-08](R02-reaction-area-attach-surprise.md)** (Stufe C) – Looting rüstet „Future Tech Control Device" am eigenen Helden aus, obwohl der Kartentext einen Gegnerhelden verlangt
   - Soll Looting (und die übrigen Stapel-Ausrüster) die Control Device nur zulassen, wenn der Nutzer ein Held des Gegners des Kartenbesitzers ist – also NICHT aus der eigenen Ablage anbieten? (Ja = nur Gegner-Ablage / Nein = wie bisher)
156. **[R02-18](R02-reaction-area-attach-surprise.md)** (Stufe C) – Toxic Trap („is hit by …") öffnet bei einem reinen Flächen-Statuszauber (Poisoned Well) nicht
   - Zählt „hit by a Spell" auch einen Spell, der nur einen Status verteilt (Poisoned Well) – Ja (Toxic Trap/Booby Trap sollen dann auslösen) oder nein (nur Schaden)?

### S01-spells

159. **[S01-08](S01-spells.md)** (Stufe C) – Aurora Borealis: Abbruch der Zielwahl des ausgeführten Zaubers – die zwei anderen Zauber sind schon gelöscht
   - Soll das Löschen der zwei Zauber ausbleiben, wenn der Spieler die Ausführung des dritten Zaubers (Zielwahl) abbricht (ja = Löschen erst nach erfolgreicher Zielwahl / nein = wie jetzt, Kosten bezahlt)?
161. **[S01-14](S01-spells.md)** (Stufe B (Zusatzaktion-Teil: C)) – Chaos Magic, die zu einem „Divine Gift" wird: kein Einmal-pro-Spiel-Stempel; die Zusatzaktion des Gifts entfällt
   - **Frage an Al (Teil b):** Soll bei Chaos Magic, die zu einem Zauber mit „This counts as an additional Action" wird, auch die Zusatzaktion gelten (ja / nein, nur die Wirkung)?
162. **[S01-16](S01-spells.md)** (Stufe C) – Create Illusion: „your opponent may draw …" wird als Pflicht ausgeführt (Deck-Out-Niederlage)
   - Soll der Gegner das Ziehen ablehnen dürfen (ja = Ja/Nein-Frage, wie „may" im Text / nein = Ziehen ist immer Vorteil und läuft automatisch)?
163. **[S01-18](S01-spells.md)** (Stufe C) – Detection zählt eine per Create Secret Room gelegte Nicht-Surprise-Karte als „Surprise"
   - Soll eine per Create Secret Room verdeckt in die Surprise Zone gelegte Nicht-Surprise-Karte für Detection als „Surprise" gelten (ja = entfernen + 2 Karten ziehen / nein = nur echte Surprises)?
165. **[S01-24](S01-spells.md)** (Stufe C) – Divine Gift of Magic: die Stufensenkung gilt für alle Kopien des Namens, nicht nur für den offenbarten Zauber
   - Soll die Senkung nur die eine offenbarte Kopie betreffen (ja = Kopie-genau / nein = alle Kopien des Namens in der Hand wie bisher)?

### S02-spells

168. **[S02-04](S02-spells.md)** (Stufe C) – Divine Gift of The Light: „the first time every turn" – je Held oder einmal je Zug?
   - Soll das Heilfenster einmal je Zug (egal welcher Held) oder einmal je Held und Zug aufgehen? (je Zug / je Held)
169. **[S02-06](S02-spells.md)** (Stufe C) – Last Resort: gilt „any other damage" auch für eigene Ziele und für Vorab-Schaden?
   - Soll Last Resort wie Flame Avalanche nur Schaden an Gegnerzielen sperren (wie jetzt) oder wörtlich ALLEN weiteren Schaden, auch an eigenen Zielen? (nur Gegner / alles)
170. **[S02-08](S02-spells.md)** (Stufe C) – Heat Wave nach Flame Avalanche: Schadenssperre gilt auch für EIGENE vorverbrannte Ziele
   - Soll Heat Wave unter der Flame-Avalanche-Sperre nur den Schaden an Gegnerzielen weglassen oder (wie jetzt) jeden Schaden? (nur Gegnerziele / alles)
171. **[S02-11](S02-spells.md)** (Stufe C) – Hand of Death: der verzögerte Effekt verfällt, wenn die Karte vor Zugende aus der Ablage geholt wird
   - Soll der Todeshand-Effekt auch kommen, wenn die Karte zwischenzeitlich aus der Ablage genommen wurde (Magic Sapphire/Meditation), oder verfällt er (wie jetzt)? (kommt trotzdem / verfällt)

### S03-spells

173. **[S03-09](S03-spells.md)** (Stufe C) – Poison Pollen: gilt „all Stunned targets" vor oder nach dem Betäuben der Vergifteten?
   - Soll ein von Poison Pollen frisch betäubtes (vergiftetes) Ziel im selben Zauber noch 1 weiteren Gift-Stack bekommen (der Reihe nach) oder nicht (Momentaufnahme)? (der Reihe nach / Momentaufnahme)
174. **[S03-10](S03-spells.md)** (Stufe B) – Outbreak ist trotz „in spite of any negative status effects" bei Negated und Blinded nicht spielbar
   - Soll Outbreak auch mit einem **negierten** bzw. **geblendeten** Nutzer spielbar sein (Text „any negative status effects" wörtlich)? (ja / nein)
176. **[S03-19](S03-spells.md)** (Stufe B) – Teleportal mischt das Deck nach der Suche nicht
   - Soll Teleportal nach der Suche mischen wie alle anderen Suchkarten? (ja / nein)
179. **[S03-27](S03-spells.md)** (Stufe C) – Rewrite History stellt die Kreatur in die Zone eines inzwischen besiegten Helden zurück (normales Beschwören dorthin ist verboten)
   - Darf Rewrite History eine Kreatur in die Zone eines besiegten Helden zurückstellen? (ja / nein)

## 5. Bereits beantwortet (Referenz)

- 1. A01-pollution-08 – Doom Prophecy: Uhr aus MEINEM Deck landet in der Gegner-Zone beim Entfernen in der GEGNER-Ablage → Besitzer-Regel (Welle 5): Karten gehen immer zum permanenten Besitzer → Ablage des Kartenbesitzers (Legers)
- 5. A01-pollution-28 – Reincarnation: „once per game“ gilt je Held, nicht je Spieler – Regelfrage → Welle 5: Reincarnation gilt je Held
- 6. A01-pollution-36 – Deck-Suchen mit Ergebnis aufs Brett (Doom Prophecy, Living Illusion, Soul Shard Ka) laufen unter der Such-Sperre – Regelfrage → Welle 5/Welle 2 (Q14): Such-Sperre gilt nur für Suchen in die Hand, nicht für Suchen auf das Brett
- 21. A03-futuretech-24 – Future Tech Drone / Debt-O-Tron Model Money Printer unter Zieh-Sperre: Karte weg bzw. Ladung verbraucht, gezogen wird nichts → Welle 3 (Zieh-Sperre, D1): Drone/Money Printer wie die anderen reinen Zieher
- 22. A03-futuretech-28 – Steam Dwarf Miner: der den ganzen Zug gefrorene/betäubte Miner zieht am Zugende trotzdem (Klasse H04-14) → Welle 3: Zugende-Trigger nach Abklingen gewollt
- 27. A04-cute-27 – Cute Dog: ein abgelehntes Beschwörungsangebot verbraucht das „1 pro Zug" → Welle 5: abgelehnte Angebote verbrauchen nie once per turn
- 42. A06-rebelliokai-21 – Pawn Sacrifice unter Handsperre (Ice Sculpture Garden): Pawn wird geopfert, das Ziehen entfällt → Welle 5: Pawn Sacrifice bleibt unter Handsperre spielbar
- 43. A06-rebelliokai-24 – Thebinxan War Counselor unter Handsperre: Ansage erzwungen, Karte kommt nicht, Nutzung verbraucht → Welle 5: Thebinxan unter Handsperre gesperrt
- 45. A06-rebelliokai-29 – Negierter Pawn Sacrifice / negierte Mischief Invasion zählen nicht gegen „You can only play 1 … per turn" → Welle 3 (Z7b): Ganz-Negierung verbraucht nichts
- 52. A07-21 – Zieh-Kreaturen ignorieren die Zieh-Sperren uneinheitlich: Kosten verbrannt, nichts gezogen → Welle 3 (D1): nur Mischeffekte aktivierbar, reine Zieher gesperrt
- 53. A07-23 – Such-Kreaturen (Shu, Shanty, Ska) zahlen ihre Kosten unter Such-/Hand-Sperre und bekommen nichts → Welle 5: Shanty braucht die zweite Handkarte; Such-Kreaturen unter Such-/Handsperre nach Welle-5-Regeln
- 60. A09-11 – Golden Arrow: „cannot spend Gold" sperrt die Gold-Kosten von Karten nicht → Welle 3 (G1): Goldsperre sperrt Gold-Kosten
- 83. C03-18 – Horned Demon (gefroren/betäubt): bekommt am Ende des eigenen Zuges trotzdem den Counter (Eis fällt vor den Zugende-Hooks) → Welle 3: Zugende-Trigger nach Abklingen gewollt
- 84. C03-20 – Moonlight Butterfly (dauerhaft gestohlen): Falter fliegt auf die Hand des Besitzers, der 150-Schaden trifft dessen Wirtsheld → Welle 5: Falter auf die Hand des Kontrolleurs, Schaden gegenüber dem Kontrolleur
- 90. F01-12 – Cool Tech Jetpack: nach abgelehntem Angebot wird im selben Zug erneut angeboten → Welle 5: das "erste Mal" wird auch durch Ablehnen verbraucht
- 96. F02-11 – „You can only play 1 X per turn"-Artefakte: ein negierter Spielzug verbraucht die Grenze nicht → Welle 3 (Z7b): Ganz-Negierung verbraucht nichts
- 104. F03-13 – Staff of Illusions: unter 10 Gold unspielbar, auch wenn nur Level-0-Kreaturen (Kosten 0) wählbar wären → Welle 4: Stufe 0 bei Kosten 0 erlaubt
- 107. F03-18 – Staff of the Teleporter / Staff of Uncontrollable Destruction sperren mit `handLocked` auch Suchen und Hinzufügen, der Text sagt nur „draw" → Welle 3 (D1): Stäbe sperren nur das Ziehen, bleiben aktivierbar
- 110. H01-heroes-18 – Elana / Champion unter Zieh- oder Handsperre: Hand verschwindet ohne Nachziehen → Welle 3 (D1): Elana/Champion nach der Zieh-Sperren-Regel
- 116. H02-heroes-22 – Kazena: unter Ziehsperre oder bei leerem Deck wird der Effekt angeboten und der Einsatz ohne Wirkung verbraucht → Welle 5: Kazena/"draw until" nach der Zieh-Sperren-Regel
- 127. H04-05 – Saya: Zweitguss ignoriert „once per game"-Klauseln (Divine Gift, Guard Duty) → Welle 5: Saya-Zweitguss beachtet once per turn/game
- 130. H04-14 – „Am Ende deines Zuges"-Heldeneffekte laufen erst, NACHDEM Frost/Betäubung/Negation des eigenen Zuges abgelaufen sind (Sett, Willy) → Welle 3: Zugende-Trigger nach Abklingen gewollt
- 131. H04-16 – Visionary Genius Heinz (und Tharx): unter Zieh-Sperre wird bezahlt, aber nichts gezogen → Welle 3 (D1): Heinz bleibt aktivierbar
- 135. M01-05 – Hunting Lv1 nimmt einen besiegten gegnerischen Token als Karte auf die Hand → Welle 5: Tokens verschwinden komplett (Hunting nimmt keinen Token als Karte)
- 141. M01-23 – Zieh-Sperre: Alchemy, Leadership, Inventing und Horn in a Bottle sind nutzbar, zahlen aber (Gold/Karten) und ziehen nichts → Welle 3 (D1): Alchemy/Leadership/Inventing nach der Zieh-Sperren-Regel (Alchemy gesperrt)
- 154. R02-11 – Prayer unter Ziehsperre: Abilities werden abgeworfen, gezogen wird nichts → Welle 3 (D1): Prayer nach der Zieh-Sperren-Regel
- 155. R02-15 – Shamanic Curse + Wisdom: der laufende Zauber zählt als bezahlbare Handkarte, der zusätzliche Wisdom-Abwurf wird nie gezahlt → Welle 5: erhöhter Level kostet den Wisdom-Abwurf
- 158. S01-02 – Negiertes Big Oopsie / Butterfly Cloud zählt nicht gegen „1 pro Zug" bzw. „nicht 2 Züge hintereinander" → Welle 3 (Z7b): Ganz-Negierung verbraucht nichts
- 166. S01-26 – Divine Gift of Sacrifice: wird der Zauber negiert, entfällt das Opfer → Welle 3 (Z7b/Z7c): Opfer bleibt bei Ganz-Negierung bezahlt
- 167. S01-27 – Such-Sperre („cannot search …") greift nicht bei Deck-Suchen, die auf das Brett führen → Welle 5/Welle 2 (Q14): Such-Sperre gilt nur für Suchen in die Hand
- 172. S02-20 – Draw: die gerade gespielte Draw-Karte zählt als „abgeworfene Handkarte" (Cute Bunny, Archibald-Nachwurf) – bei Boris dagegen nicht → Welle 5: gespielte Karte ist nie abgeworfen
- 175. S03-12 – „You can only play 1 X per turn": ein NEGIERTES Exemplar zählt nicht gegen die Sperre (Pillar of Light, Rain of Arrows, Refreshing Night) → Welle 3 (Z7b): Ganz-Negierung verbraucht nichts (Konvention bestätigt)
- 177. S03-24 – Supply Chain (und Voice in your Head): reine Zieh-Karte ist unter Hand-/Zieh-Sperre und gegen Tuscan Artist spielbar und verpufft → Welle 5: Voice in your Head/Supply Chain/Kazena nach Zieh-Sperren- und Tuscan-Artist-Regel
