// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const STORY = helpers.story, DATA = helpers.data;
// Kurzformen für Schritte, die in fast jeder Szene vorkommen. Jede liefert EINEN Schritt (ein Objekt für die steps-Liste).
// AFF(id, n, why)     Zuneigung ändern + Popup          MET(id, fullName)  kennengelernt: Name merken, Popup, Flag met_<id>
// DECK(id)            Deck gelernt: Popup + Flag        NOTE(id, text)     Notiz im People-Fenster ("What you know")
// REL(a, b)           Rowan weiß von der Beziehung a–b (People-Fenster)
// PHOTO(id, subject, o)  Pippa hat ein Foto gemacht (Liste s.photos, im People-Fenster bei Pippa). id: eindeutig, damit ein
//                      erneut gespieltes Stück nichts doppelt einträgt; subject: kurz, englisch, was auf dem Bild ist;
//                      o.who: Figuren-Ids im Bild ('rowan' für den Spieler); o.off: true, wenn der Spieler das Foto nicht
//                      entstehen sah (sie erzählt davon oder macht es nebenbei). Jedes Foto, das Pippa macht, wird vermerkt.
//                      ZUKUNFT (Plan des Autors, noch nicht umgesetzt): Pippa wird einer der ersten Romance-Charaktere;
//                      ideal dafür ist eine Szene, in der Rowan und sie gemeinsam ihre Filme entwickeln — aus dieser Liste.
//                      Sie fotografiert analog: niemand sieht ein Bild, bevor es entwickelt ist (laut ihr „in a week“).
//
// VORGEMERKTE SZENEN (Pläne des Autors, noch nicht ausgeschrieben; vor dem Schreiben mit dem Autor abstimmen):
//   Freya — abends besuchbar (Bungalow 2, nach dem Abendessen). Sie ist dann ausgesprochen flirty: neckend, selbstsicher,
//     spielt mit Rowans Verlegenheit; das Flirten steht im Vordergrund, kein Ero-Spiel. Nach zwei, drei Besuchen kann es zu
//     Sex kommen: einvernehmlich, beiläufig, nicht explizit (Andeutung, Abblende, der Morgen danach). Casual, ohne Folgen für
//     eine Romanze; vorerst nicht romanceable (data: romance false). Freya und Rowan sind erwachsen (siehe ALTER unten).
//     Danach sind weitere Nächte möglich, nichts Festes: Sie sagt ihm sinngemäß, dass ihr Bett für ihn immer offen ist. Je
//     länger es geht, desto offener und forscher flirtet sie mit ihm (auch vor anderen), nicht weil sie mit ihm zusammen sein
//     will, sondern weil es ihr Spaß macht und er so gut darauf reagiert. Entwurf im Playtest (41-freya-evenings.js), noch nicht im Repo.
//     Nathan hält es geheim (darf aber anspielen), bis es auf Pfaden mit vielen Nächten durch Freyas offenes Flirten und Rowans
//     immer positivere Reaktionen ein offenes Geheimnis wird (freya_open_secret). Das birgt großes Konfliktpotenzial, falls Rowan
//     eine Romanze mit einer romanceable Figur (Pippa, Fiona …) eingeht: deren Stränge sollen freya_nights/freya_open_secret lesen.
//   Fiona — organisiert „to uncover the darkest secrets of everyone on the island“ eine große Runde Truth or Dare. Teilnahme
//     ganz freiwillig; Rowan kann jede teilnehmende Figur fragen (Truth) oder herausfordern (Dare), und wird selbst gefragt.
//     Verschiedene Verläufe geben Zuneigung oder kosten sie (zu weit gebohrt, Geheimnis verraten, Mut bewiesen …).
//     Fiona plant (oder erwartet zumindest), dass es explizit wird: Georgie und Branden (minderjährig) dürfen in-universe
//     ausdrücklich NICHT mitmachen; Fiona schließt sie selbst aus, und jemand (Baylee) passt den Abend über aktiv auf Branden
//     auf, damit er sich nicht hineinschleicht.
//   Sammy — läuft Fiona hinterher wie ein Fan und will von ihr lernen (Auftreten, Düsternis, Mantel). Über die Kampagne
//     werden die beiden nach und nach sehr gute Freunde (Daten: sammy → fiona „admirer“, fiona → sammy „protégé“, ab sf_stage 3
//     beide „friends“). Entwurf im Playtest (43-sammy-fiona.js), noch nicht im Repo. Fiona soll langfristig romanceable sein (für Rowan).
//   Teobalt — verliebt sich im Lauf der Kampagne SICHTLICH in Freddie (er führt eine Liste, die er niemandem zeigt; er
//     plant Zufälle; er ist in ihrer Nähe noch genauer als sonst). Optionale Szenen und Entscheidungen, in denen Rowan die
//     beiden zusammenbringen kann (oder es lässt). Daten: teobalt → freddie „crush“ (ersetzt den früheren stillen Schwarm für
//     Noor, der gestrichen ist). Entwurf im Playtest (44-teobalt-freddie.js), noch nicht im Repo.
//   FIONA trägt als einzige Figur den Namen eines Heroes: „Fiona, the Princess of Blackport“ und die aufgestiegene, besessene
//     „Fiona, the Empty Vessel of a Forgotten Sorceress“. Das ist ein Thema: auf der Fähre (Hub,
//     Flag fiona_blackport), in Truth or Dare, und es berührt ihre Angst, nur noch die Rolle zu sein (das leere Gefäß).
//   KARTENSTATUS: Ob eine Karte „forbidden“/gebannt ist, spielt in der Kampagne keine Rolle (das gilt erst für ein viel später
//     erfundenes Custom-Format). Niemand bezieht sich darauf, weder im Text noch in Notizen.
//   LADDER & STANDING: EINE Ladder für die ganze Schule (alle Fächer, alle Jahrgänge, jeder darf jeden fordern, ±20 Plätze);
//     sie entscheidet Events, Ruf, Battle Team. Den KRAGEN (Wohnheim) entscheidet nur die Bestenliste („Standing“) des eigenen
//     Fachs je Jahrgang: CP = feste Standing Matches gegen CP-Leute (alle zwei Wochen, Practicum) + Promotion Duels;
//     GD = Set Reviews (Jury) + Design Trials; Aux = benotete Praktika je Track + Crew Assessment (sie führen die Promotion-Woche).
//     Aufstieg ist immer ein Tausch innerhalb des Fachs. Ein roter Kragen, der nach dem ersten Term unten in der Ladder hängt,
//     gilt als Versager (Rana letztes Jahr); Elitäre (Gideon, Ashton, Jessica) und Ehrgeizige (Inya) urteilen, die meisten nicht.
//     Details: curriculum.STANDING in der Bibel.
//   ANNI: extrem dünn, isst fast nichts (Grund vorerst offen; nicht Eitelkeit, keine Diät). Höfliche Ausreden („I ate earlier“).
//     Nie als Witz, nie als attraktiv, keine Zahlen; niemand „heilt“ es mit einer Rede. Wer es bemerkt und bleibt, ohne den Teller
//     zu kommentieren, gewinnt ihr Vertrauen. Ernste Krise → Krankenstation/Erwachsene, nicht Rowans Privatheldentum.
//   WOHNEN (First-Years, je Bungalow genau drei): B1 Mama Odalys' Küche · B2 Freya, Hedda, Trixie · B3 Inya, Livvie, Rana ·
//     B4 Maisie, Fiona, Leona · B5 Viktor, Tomi, Ed · B6 Sammy, Tobias, Dmitri · B7 Rowan, Nathan, Baylee · B8 Wäscherei.
//     Rare Hall (Zweibettzimmer): 101 Eberhart+Mikoto · 102 Teobalt+Jun-ho · 103 Cas+Rafa · 201 Marit+Eloise · 202 Noor+Sunny ·
//     203 Pippa+Victoria. Spectral Tower (Einzelsuiten): Georgie, Jessica, Anni, Ashton, Gideon, Magnus, Freddie, Branden.
//     Freddie hat als einzige der Fähre eine Suite für sich (ihr erstes eigenes Zimmer), schwimmt aber hinter der Commons-Reihe.
//     Kragen-Zählung auf der Fähre: 8 weiß, 12 blau, 17 grau, plus Rowan ohne Jacke.
//   STUDIENGÄNGE (Jacke = Studiengang, Kragen = Wohnheim), grob gleich groß, Competitive Play etwas größer. First-Years:
//     rot (Competitive Play): Rowan, Nathan, Baylee, Ed, Inya, Rana, Freya, Fiona, Tobias, Eberhart, Sunny, Georgie, Gideon,
//       Magnus, Ashton, Branden · gold (Game Design): Livvie, Hedda, Freddie, Jun-ho, Eloise, Teobalt (eigener langer roter
//       Mantel über der goldenen Jacke), Leona, Dmitri, Trixie, Mikoto, Viktor · schwarz (Auxiliary): Maisie, Pippa, Victoria,
//       Cas, Marit, Anni, Jessica, Noor (Schiedsrichter), Tomi, Sammy, Rafa (alle drei Event-Team).
//     Trixie will viele neue Insekten-Archetypes erfinden. Viktor zeichnet (Karten, Illustration) und wird eng mit Eloise
//     befreundet (Daten: viktor ↔ eloise „friends“). Sammy will epische, düstere Events gestalten.
//   SAMMYS TURNIER (Woche 2 oder später, längerer Nebenstrang): Sammy plant ein großes Turnier mit Sonderregeln und besonderen
//     Preisen. Rowan kann ihm auf verschiedene Weise helfen und Leute für ihn gewinnen: Teobalt für die Regeln, Tomi für die
//     Preise, Rafa fürs Catering usw., dazu interessierte Spieler. Wen Rowan gewinnt und wie, prägt das Turnier.
//   ROMANZEN: Die ersten romanceable Figuren sind Pippa, Fiona und Marit. Marit (Rare Hall, Kommentatorin, spricht für die letzte
//     Reihe, die echte leise Stimme rutscht nur selten durch; Angst: Stille) ist auf ihre bombastische Art gern dabei und soll in
//     Szenen mit vielen Leuten oft als Randfigur auftauchen.
//   CLUBS: Clubs gehören zur Academy. Die Club Fair ist an Tag 3 auf dem Quad (Stände um den Brunnen). Rowan wird Mitglied im
//     Battle Team, das die Academy bei offiziellen Events vertritt; Kapitänin: Lilia Mann. Weitere Clubs dürfen frei erfunden
//     und mit NPCs besetzt werden. Ein „Freshman Cup“ um Tag 18 ist gesetzt.
//   LILIA MANN (4. Jahr, Spectral, CP): seit zwei vollen Jahren Nr. 1 der Ladder, Kapitänin des Battle Teams, eine RICHTIG große
//     Nummer. Spielt an Wochenenden und in den Ferien schon in der echten Pro-Liga und macht das Studium nur noch pro forma
//     fertig. Sie wird OFT erwähnt (Gesprächsstoff, Anzeigetafel, Stream, Gerüchte, Poster), tritt aber LANGE NICHT auf: keine
//     Zufallsbegegnung, keine Nebenrolle, kein Gesicht in der Menge. Ihr erster Auftritt ist ein Ereignis — sie kommt selbst,
//     um Rowan fürs Battle Team zu holen, sobald er sich einen Namen gemacht hat. Bis dahin höchstens von Weitem (eine Gestalt
//     auf der Klippe, ein leerer Platz in der ersten Reihe, ihr Name auf der Tafel).
//     Rekrutierung = „Captain's Pick“ (vom Autor abgesegnet): Teamplatz ohne Tryouts, den nur die Kapitänin vergibt; sie kommt
//     dafür an einem Abend Mo–Do selbst zur Commons-Reihe (Details: Bibel, lilia_e1). Wochenenden: Kaboom Pro League, vom Campus weg.
//   GIDEON darf frei eingesetzt werden, solange er konsistent bleibt: sein verborgener Schwarm für Fiona zeigt sich nur darin,
//     dass er sie nie ansieht und über ihre Bewunderer (Sammy) spottet.
//   STRÄNGE werden konsequent fortgeführt: was eine Szene anstößt (z. B. Pippas „golden hour“ aus Truth or Dare, Pippa soll
//     romanceable werden), bekommt später eine Fortsetzung.
//   ALTER: Pixel Academy ist höhere Bildung; alle Studierenden sind volljährig (18+), außer Georgie und Branden (Branden etwa
//     zehn). Flirt, Romanze und Sex nur zwischen Erwachsenen; Georgie und Branden bleiben davon ganz ausgenommen.
// DECKCOUNT(s)         Rowans AKTUELLES Deck gezählt (er kann es umbauen): { heroes, abilities, main, potions, total, allCommon }.
//                      Für Texte, die Karten zählen: { text: (s) => "…" + WORDS(DECKCOUNT(s).main) + "…" } (Texte dürfen Funktionen sein).
// WORDS(n)             Zahl als englisches Wort ("sixty"), ab 100 als Ziffern.
// ALPHA(s)             Rowans Platz in der alphabetischen Liste der 38 First-Years nach Nachnamen. Der Nachname ist frei
//                      wählbar (s.vars.pl, Standard Vance): { pos, of, letter, where: 'first'|'front'|'middle'|'end'|'last' }.
//                      Für Teobalts Abfahrtsliste, die Reihenfolge der Placement-Duelle usw. — nie fest „near the end“ schreiben.
// Belohnungen: { card: "Kartenname", rarity: "rare" } (eine Kopie in dieser Seltenheit, Standard common),
//              { item: "Booster Pack" } (im Cards-Fenster zu öffnen), { coins: 10 } (Smug Coins).
helpers.AFF = (id, n, why) => ({ add: { ['aff_' + id]: n }, run: (s, io) => { if (io && io.popup) io.popup({ type: 'aff', id, n, why }); }, _h: ['aff', id, n, why] });
helpers.MET = (id, full) => ({ run: (s, io) => { s.names = s.names || {}; if (full && !s.names[id]) s.names[id] = full; if (io && io.popup && !s.flags['met_' + id]) io.popup({ type: 'met', id, name: full }); s.flags['met_' + id] = true; }, _h: ['met', id, full] });
helpers.DECK = (id) => ({ run: (s, io) => { if (io && io.popup && !s.flags['deck_known_' + id]) io.popup({ type: 'deck', id }); s.flags['deck_known_' + id] = true; }, _h: ['deck', id] });
helpers.NOTE = (id, text) => ({ run: (s) => { s.notes = s.notes || {}; const a = (s.notes[id] = s.notes[id] || []); if (a.indexOf(text) < 0) a.push(text); }, _h: ['note', id, text] });
helpers.REL = (a, b) => ({ flag: 'rel_' + a + '_' + b, _h: ['rel', a, b] });
helpers.DECKCOUNT = (s) => {
  const d = s.deck || {}, R = (typeof DATA !== 'undefined' && DATA.rowan) || {}, sum = (o) => Object.values(o || {}).reduce((a, n) => a + n, 0);
  const heroes = d.heroes ? d.heroes.length : (R.heroes || []).length;
  const abilities = d.heroes ? d.heroes.length * 2 : (R.heroes || []).reduce((a, h) => a + (h.abilities || []).length, 0);
  const main = d.main ? sum(d.main) : (R.main || []).reduce((a, c) => a + c.n, 0), potions = d.potions ? sum(d.potions) : (R.potions || []).reduce((a, c) => a + c.n, 0);
  const own = s.owned || {}; let allCommon = true;
  for (const n of Object.keys(Object.assign({}, d.main, d.potions))) { const r = own[n] || {}; if (Object.keys(r).some(k => k !== 'common' && r[k] > 0) && !(r.common >= ((d.main || {})[n] || 0) + ((d.potions || {})[n] || 0))) allCommon = false; }
  return { heroes, abilities, main, potions, total: heroes + abilities + main + potions, allCommon, name: d.name || R.name || '' };
};
helpers.ALPHA = (s) => {
  // Nachnamen der übrigen 37 (Sortierschlüssel; „von Düsterwald“ unter D, „Park Jun-ho“ unter P)
  const others = ['Whisper', 'Halvorsen', 'Venture', 'Santa', 'Hale', 'Lund', 'Yamaguchi', 'Sunflower', 'Düsterwald', 'Pryce', 'Bell', 'Reyes', 'Brandt',
    'Prospero', 'Al-Sayed', 'Thana', 'Park', 'Lafayette', 'Montclair', 'Beaumont-Lyle', 'Capulet', 'Abernathy', 'Aldane', 'Solberg', 'Camara', 'Okonjo',
    'Marika', 'Fullington', 'Njord', 'Nordlicht', 'Hollis', 'Voltage', 'Blackwood', 'Helical', 'Counts', 'Crowe', 'Volkov'];
  const me = String((s && s.vars && s.vars.pl) || 'Vance').trim() || 'Vance';
  const pos = 1 + others.filter(n => n.localeCompare(me, 'en', { sensitivity: 'base' }) < 0).length, of = others.length + 1;
  const where = pos === 1 ? 'first' : pos === of ? 'last' : pos <= 10 ? 'front' : pos <= 28 ? 'middle' : 'end';
  return { pos, of, letter: me.charAt(0).toUpperCase(), where };
};
helpers.WORDS = (n) => { const a = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'], t = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']; if (n < 20) return a[n]; if (n < 100) return t[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : ''); return String(n); };
helpers.PHOTO = (id, subject, o) => ({ run: (s) => { o = o || {}; s.photos = s.photos || []; if (s.photos.some(p => p.id === id)) return; s.photos.push({ id, subject, who: o.who || [], off: !!o.off, day: s.day, minutes: s.minutes, place: s.location, developed: false }); }, _h: ['photo', id, subject, (o && o.off) ? 'off' : 'seen'] });
