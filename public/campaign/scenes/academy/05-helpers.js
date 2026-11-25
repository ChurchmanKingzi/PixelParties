// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Kurzformen für Schritte, die in fast jeder Szene vorkommen. Jede liefert EINEN Schritt (ein Objekt für die steps-Liste).
// AFF(id, n, why)     Zuneigung ändern + Popup          MET(id, fullName)  kennengelernt: Name merken, Popup, Flag met_<id>
// DECK(id)            Deck gelernt: Popup + Flag        NOTE(id, text)     Notiz im People-Fenster ("What you know")
// REL(a, b)           Rowan weiß von der Beziehung a–b (People-Fenster)
helpers.AFF = (id, n, why) => ({ add: { ['aff_' + id]: n }, run: (s, io) => { if (io && io.popup) io.popup({ type: 'aff', id, n, why }); }, _h: ['aff', id, n, why] });
helpers.MET = (id, full) => ({ run: (s, io) => { s.names = s.names || {}; if (full && !s.names[id]) s.names[id] = full; if (io && io.popup && !s.flags['met_' + id]) io.popup({ type: 'met', id, name: full }); s.flags['met_' + id] = true; }, _h: ['met', id, full] });
helpers.DECK = (id) => ({ run: (s, io) => { if (io && io.popup && !s.flags['deck_known_' + id]) io.popup({ type: 'deck', id }); s.flags['deck_known_' + id] = true; }, _h: ['deck', id] });
helpers.NOTE = (id, text) => ({ run: (s) => { s.notes = s.notes || {}; const a = (s.notes[id] = s.notes[id] || []); if (a.indexOf(text) < 0) a.push(text); }, _h: ['note', id, text] });
helpers.REL = (a, b) => ({ flag: 'rel_' + a + '_' + b, _h: ['rel', a, b] });
