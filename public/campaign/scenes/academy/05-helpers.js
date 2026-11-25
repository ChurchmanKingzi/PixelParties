// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
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
helpers.AFF = (id, n, why) => ({ add: { ['aff_' + id]: n }, run: (s, io) => { if (io && io.popup) io.popup({ type: 'aff', id, n, why }); }, _h: ['aff', id, n, why] });
helpers.MET = (id, full) => ({ run: (s, io) => { s.names = s.names || {}; if (full && !s.names[id]) s.names[id] = full; if (io && io.popup && !s.flags['met_' + id]) io.popup({ type: 'met', id, name: full }); s.flags['met_' + id] = true; }, _h: ['met', id, full] });
helpers.DECK = (id) => ({ run: (s, io) => { if (io && io.popup && !s.flags['deck_known_' + id]) io.popup({ type: 'deck', id }); s.flags['deck_known_' + id] = true; }, _h: ['deck', id] });
helpers.NOTE = (id, text) => ({ run: (s) => { s.notes = s.notes || {}; const a = (s.notes[id] = s.notes[id] || []); if (a.indexOf(text) < 0) a.push(text); }, _h: ['note', id, text] });
helpers.REL = (a, b) => ({ flag: 'rel_' + a + '_' + b, _h: ['rel', a, b] });
helpers.PHOTO = (id, subject, o) => ({ run: (s) => { o = o || {}; s.photos = s.photos || []; if (s.photos.some(p => p.id === id)) return; s.photos.push({ id, subject, who: o.who || [], off: !!o.off, day: s.day, minutes: s.minutes, place: s.location, developed: false }); }, _h: ['photo', id, subject, (o && o.off) ? 'off' : 'seen'] });
