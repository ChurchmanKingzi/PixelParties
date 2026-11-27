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
//   CLUBS: Clubs gehören zur Academy. Die Club Fair ist an Tag 3 auf dem Quad (Stände um den Brunnen). Rowan wird Mitglied im
//     Battle Team, das die Academy bei offiziellen Events vertritt; Leitung: Lilia Mann (4. Jahr, Spectral; Tryouts laut
//     Kalender). Weitere Clubs dürfen frei erfunden und mit NPCs besetzt werden. Ein „Freshman Cup“ um Tag 18 ist gesetzt.
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
