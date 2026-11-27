// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const STORY = helpers.story, DATA = helpers.data;
// Wer wo steht. Diese Datei läuft als letzte Szenen-Datei: Figuren werden nur gesetzt, wenn es ihre Szene gibt.
//   Fähre: die sechzehn First-Years, die bisher erst auf der Insel auftauchten (alle 38 sind an Bord).
//   Insel, Tag 1 (Mittag bis zum Abendessen): alle First-Years an ihrem Platz; Szene isle_<id>, für die Bungalows 2, 4 und 6 die Gruppen-Szenen row_b2/4/6.
(function(){
const W = STORY.world, L = W.locations, has = (id) => !!STORY.scenes[id];
// Der Spielername ist frei wählbar: Die Szenen schreiben „Rowan“/„Vance“ als Platzhalter, angezeigt wird der gewählte Name
// (Variablen pn/pl; im Spiel ersetzt cmpPlayerName in app-campaign.jsx, im Playtest sub()).
W.player = { first: "Rowan", last: "Vance", firstVar: "pn", lastVar: "pl" };
// Personen, die das People-Fenster noch nicht kannte
Object.assign(DATA.people, {"eberhart":{"name":"Eberhart von Düsterwald","first":"Eberhart","romance":false,"deck":{"name":"Iron Parade","heroes":["Toras, Master of all Weapons","Boris, the Guardian of Blackport","Alex, Trainer of Heroes"],"key":[]},"bonds":[{"w":"mikoto","label":"roommates","pub":true,"from":1},{"w":"victoria","label":"friends","pub":true,"from":7},{"w":"priya","label":"friends","pub":true,"from":6},{"w":"rox","label":"protégé","pub":true,"from":3},{"w":"noor","label":"friends","pub":true,"from":9},{"w":"baylee","label":"friends","pub":true,"from":12},{"w":"willas","label":"friends","pub":true,"from":1},{"w":"isolde","label":"rivals","pub":true,"from":68},{"w":"teobalt","label":"friends","pub":true,"from":4}]},"eloise":{"name":"Eloise Lafayette","first":"Eloise","romance":true,"deck":{"name":"Vernissage","heroes":["Tushu, the Knowledge Keeper","Atta, Speaker of Desires","Silent Water Mizune"],"key":[]},"bonds":[{"w":"marit","label":"roommates","pub":true,"from":1},{"w":"victoria","label":"friends","pub":true,"from":10},{"w":"felix","label":"crush","pub":true,"from":6},{"w":"wren","label":"protégé","pub":true,"from":9},{"w":"chuck","label":"protégé","pub":false,"from":5},{"w":"livvie","label":"teammates","pub":true,"from":5},{"w":"camille","label":"owes","pub":false,"from":20},{"w":"junho","label":"friends","pub":true,"from":6},{"w":"tariq","label":"friends","pub":true,"from":9}]},"rafa":{"name":"Rafael \"Rafa\" Okonjo","first":"Rafa","romance":false,"deck":{"name":"Secret Recipe","heroes":["Zamorin, the Spice Rajah","Nicolas, the Hidden Alchemist","Kerthwack, the Reality Breaker"],"key":[]},"bonds":[{"w":"cas","label":"roommates","pub":true,"from":1},{"w":"hedda","label":"crush","pub":true,"from":6},{"w":"odalys","label":"protégé","pub":true,"from":4},{"w":"livvie","label":"friends","pub":true,"from":7},{"w":"baylee","label":"friends","pub":true,"from":5},{"w":"camille","label":"friends","pub":true,"from":24},{"w":"willas","label":"rivals","pub":true,"from":12},{"w":"nathan","label":"friends","pub":true,"from":5},{"w":"wren","label":"friends","pub":true,"from":20}]},"cas":{"name":"Caspian \"Cas\" Abernathy","first":"Cas","romance":false,"deck":{"name":"Regatta","heroes":["Madaga, the Forsaken Seafarer","Codumbus, the Clueless Voyager","Champion, the Stormbringer"],"key":[]},"bonds":[{"w":"rafa","label":"roommates","pub":true,"from":1},{"w":"victoria","label":"teammates","pub":true,"from":4},{"w":"marit","label":"crush","pub":true,"from":5},{"w":"bex","label":"mentor","pub":true,"from":14},{"w":"vivienne","label":"protégé","pub":true,"from":4},{"w":"jessica","label":"rivals","pub":true,"from":6},{"w":"abel","label":"friends","pub":true,"from":6},{"w":"pippa","label":"friends","pub":true,"from":5},{"w":"lucas","label":"friends","pub":true,"from":8}]},"junho":{"name":"Park Jun-ho","first":"Jun-ho","romance":false,"deck":{"name":"Parts of the Soul","heroes":["Cute Nerd Magenta","Thep, the Court Scribe","Alice, the Puppeteer Girl"],"key":[]},"bonds":[{"w":"teobalt","label":"roommates","pub":true,"from":1},{"w":"maisie","label":"friends","pub":true,"from":8},{"w":"eloise","label":"crush","pub":true,"from":6},{"w":"wren","label":"protégé","pub":true,"from":6},{"w":"octavia","label":"protégé","pub":true,"from":15},{"w":"livvie","label":"rivals","pub":true,"from":5},{"w":"chuck","label":"protégé","pub":true,"from":4},{"w":"ashdown","label":"friends","pub":true,"from":10},{"w":"felix","label":"friends","pub":true,"from":8},{"w":"tariq","label":"protégé","pub":true,"from":6}]},"anni":{"name":"Anneliese \"Anni\" Brandt","first":"Anni","romance":true,"deck":{"name":"Man's Best Friends","heroes":["Ingo, Investor of Evil","Orthos, the Loyal Guard Dog","Alice, the Puppeteer Girl"],"key":[]},"bonds":[{"w":"teobalt","label":"friends","pub":true,"from":10},{"w":"noor","label":"rivals","pub":true,"from":4},{"w":"hana","label":"protégé","pub":true,"from":4},{"w":"mika","label":"teammates","pub":true,"from":13},{"w":"gideon","label":"distrusts","pub":true,"from":5},{"w":"saoirse","label":"enemies","pub":true,"from":9},{"w":"georgie","label":"friends","pub":true,"from":2},{"w":"ashton","label":"distrusts","pub":true,"from":3},{"w":"lucas","label":"protégé","pub":true,"from":4},{"w":"sebastian","label":"distrusts","pub":true,"from":10},{"w":"tavita","label":"protégé","pub":true,"from":14},{"w":"thandi","label":"protégé","pub":true,"from":4}]},"keoni":{"name":"Keoni Kahale","first":"Keoni","romance":false,"deck":{"name":"Lost and Found","heroes":["Darion, the Blood-Crazy Groundskeeper","Cecilia, the Harrowing Crusader","Fern, the Ship Slave"],"key":[]},"bonds":[{"w":"odalys","label":"protégé","pub":true,"from":0},{"w":"tavita","label":"friends","pub":true,"from":0},{"w":"silas","label":"protégé","pub":true,"from":0},{"w":"chuck","label":"protégé","pub":true,"from":0},{"w":"imara","label":"friends","pub":true,"from":0},{"w":"wren","label":"friends","pub":true,"from":0},{"w":"baylee","label":"friends","pub":true,"from":2},{"w":"nathan","label":"friends","pub":true,"from":1},{"w":"maisie","label":"mentor","pub":true,"from":5},{"w":"rana","label":"friends","pub":true,"from":6},{"w":"hedda","label":"friends","pub":true,"from":5},{"w":"teobalt","label":"friends","pub":true,"from":6},{"w":"sebastian","label":"distrusts","pub":true,"from":0},{"w":"cati","label":"crush","pub":true,"from":0},{"w":"shirin","label":"friends","pub":true,"from":0}]},"tavita":{"name":"Tavita \"Tavi\" Leota","first":"Tavita","romance":false,"deck":{"name":"Night Watch","heroes":["Diamond, the Keeper of Peace","Broghan, the Frozen Guardian of the North","Xal, the Animated Armor"],"key":[]},"bonds":[{"w":"sebastian","label":"enemies","pub":true,"from":0},{"w":"imara","label":"friends","pub":true,"from":0},{"w":"pilar","label":"friends","pub":true,"from":0},{"w":"octavia","label":"colleagues","pub":true,"from":0},{"w":"noor","label":"friends","pub":true,"from":14},{"w":"teobalt","label":"mentor","pub":true,"from":13},{"w":"camille","label":"crush","pub":true,"from":0},{"w":"odalys","label":"friends","pub":true,"from":0},{"w":"willas","label":"friends","pub":true,"from":0},{"w":"rox","label":"protégé","pub":true,"from":0},{"w":"anni","label":"mentor","pub":true,"from":14},{"w":"dmitri","label":"friends","pub":true,"from":20},{"w":"silas","label":"friends","pub":true,"from":0},{"w":"keoni","label":"friends","pub":true,"from":0}]}});
// Bezeichnung, solange Rowan den Namen nicht kennt
Object.assign(DATA.alias, {
  viktor: "Man with a compass", eberhart: "Boy with a scar", sammy: "Boy in a long black coat", tobias: "Boy with a broken nose", dmitri: "Boy under a blanket",
  anni: "Girl with a red pen", junho: "Boy with a row of boxes", eloise: "Girl in a red beret", leona: "Girl with a satchel", maisie: "Girl in welding goggles", fiona: "Girl in black lace",
  cas: "Boy with a microphone", rafa: "Boy in a chef's bandana", hedda: "Girl with a petition", freya: "Girl under a book", trixie: "Girl in striped socks",
  odalys: "Woman with a wooden spoon", keoni: "Boy with a ring of keys"
});
const ferryOpen = (s) => s.day === 1 && s.minutes < 640;
const isleOpen = (s) => s.day === 1 && s.minutes < 1080 && !!s.flags["unpacked_started"];
function add(lid, id, scene, extra, open) {
  if (!L[lid] || !has(scene)) return;
  const name = (W.cast[id] && W.cast[id].name) || id, alias = DATA.alias[id] || "Somebody", objs = (L[lid].objects = L[lid].objects || []);
  const base = Object.assign({ sprite: id, scene }, extra || {});
  objs.push(Object.assign({}, base, { id: id + "@" + lid, label: alias, when: (s) => open(s) && !s.flags["met_" + id] && (!extra || !extra.cond || extra.cond(s)) }));
  objs.push(Object.assign({}, base, { id: id + "@" + lid + "_m", label: name, when: (s) => open(s) && !!s.flags["met_" + id] && (!extra || !extra.cond || extra.cond(s)) }));
}
// ── Fähre ── (free: das Gespräch findet statt, wo Rowan gerade ist; kein Ortswechsel)
const FERRY = [
  // Bug: Viktor in der Spitze hinter der Ankerwinde, Eberhart bei den Koffern, die drei vom Bankende
  ["ferry_deck", "viktor", { spot: ["ferry", 16, 37] }], ["ferry_deck", "eberhart", { spot: ["ferry", 21, 31] }],
  ["ferry_deck", "sammy", { spot: ["ferry", 22, 33] }], ["ferry_deck", "tobias", { spot: ["ferry", 17, 34] }], ["ferry_deck", "dmitri", { spot: ["ferry", 13, 35] }],
  // Backbord-Gang: Leona am Bug-Ende vor dem Musteraushang, Maisie in der Mitte auf dem Eimer an der Lampe, Fiona am Heck-Ende im Schatten des Rettungsboots
  ["ferry_deck", "leona", { spot: ["ferry", 9, 24], free: true }], ["ferry_deck", "maisie", { spot: ["ferry", 9, 18], free: true }], ["ferry_deck", "fiona", { spot: ["ferry", 10, 13], free: true }],
  // Steuerbord-Gang: Freya auf der Bank an der Deckhauswand, Hedda mit ihrem Brett in der Mitte, Trixie an der Reling
  ["ferry_stern", "freya", { spot: ["ferry", 22, 14], free: true }], ["ferry_stern", "hedda", { spot: ["ferry", 23, 18], free: true }], ["ferry_stern", "trixie", { spot: ["ferry", 23, 22], free: true }],
  ["ferry_lounge", "anni", {}], ["ferry_lounge", "junho", {}], ["ferry_lounge", "eloise", {}],
  // Heck: Cas am Flaggenstock, Rafa an der Kombüsentür neben dem Gepäckkäfig
  ["ferry_stern", "cas", { spot: ["ferry", 17, 6] }], ["ferry_stern", "rafa", { spot: ["ferry", 9, 10] }],
];
for (const [lid, id, extra] of FERRY) add(lid, id, "ferry_" + id, extra, ferryOpen);
// Inya verlässt die Lounge, wenn ihr der Tisch verwehrt blieb oder sie gegen Gideon verlor (der Text lässt sie aufs Vordeck gehen).
const inyaOut = (s) => !!s.flags["ferry_inya_lost"] || !!(s.eventsDone && s.eventsDone["table_default"]);
for (const o of L.ferry_lounge.objects || []) if (o.sprite === "inya") { const w = o.when; o.when = (s) => (w ? w(s) : true) && !inyaOut(s); }
for (const o of (L.ferry_lounge.objects || []).filter(o => o.sprite === "inya").map(o => Object.assign({}, o))) {
  const w = o.when; L.ferry_deck.objects.push(Object.assign(o, { id: o.id + "_deck", spot: ["ferry", 13, 30], free: true, alert: undefined, when: (s) => { const lounge = Object.assign({}, s, { eventsDone: {}, flags: Object.assign({}, s.flags, { ferry_inya_lost: false }) }); return w(lounge) && inyaOut(s); } }));
}
// Die schon gesetzten Figuren der Decks bekommen feste Plätze (bisher drängten sie sich alle um die Tür zur Lounge).
// Brücke: Abel am Rad im Steuerhaus (Raum ferry__1 hinter der Tür auf dem Deckshaus), Rana oben an der Metalltreppe auf der Nock,
//   Teobalt vor der Front des Steuerhauses neben der Tür (Blick über die Reling hinunter auf das Vordeck). Beide Plätze sind „fest“.
if (L.ferry_bridge) L.ferry_bridge.name = "The Wheelhouse";
const STAND = { abel: ["ferry__1", 6, 6], rana: ["ferry", 12, 23, "fest"], teobalt: ["ferry", 15, 23, "fest"],
  ed: ["ferry", 19, 36], georgie: ["ferry", 18, 35], pippa: ["ferry", 20, 35], branden: ["ferry", 14, 33], mikoto: ["ferry", 10, 31],
  freddie: ["ferry", 14, 5], sunny: ["ferry", 19, 5], marit: ["ferry", 11, 5], jessica: ["ferry", 14, 8], ashton: ["ferry", 23, 8], victoria: ["ferry", 21, 10] };
// Lounge (Raum ferry__0, Tür unten, Fensterwand oben): Spieltisch in der Mitte auf dem grünen Teppich, Galley-Theke oben links.
//   Gideon und Inya einander gegenüber am Tisch, Tomi auf der Banklehne daneben, Anni am Bankende neben dem Tisch,
//   Magnus zwei Bänke dahinter, Jun-ho mitten an der Fensterwand, Eloise unter dem linken Fenster, Noor allein unter dem rechten, Livvie am Galley-Ende.
Object.assign(STAND, { gideon: ["ferry__0", 10, 7], inya: ["ferry__0", 11, 9], tomi: ["ferry__0", 12, 7], anni: ["ferry__0", 8, 9],
  magnus: ["ferry__0", 12, 11], junho: ["ferry__0", 10, 4], eloise: ["ferry__0", 6, 4], noor: ["ferry__0", 18, 4], livvie: ["ferry__0", 2, 4] });
for (const lid of ["ferry_deck", "ferry_stern", "ferry_bridge", "ferry_lounge"]) for (const o of L[lid].objects || []) if (STAND[o.sprite] && !o.spot && (lid === "ferry_lounge") === (STAND[o.sprite][0] === "ferry__0")) o.spot = STAND[o.sprite];

// ── Insel, Tag 1 ──
const ROW = "commons_beach";
const ISLE = [
  // Bungalow 2, 4, 6: die Veranden (Gruppen-Szenen)
  [ROW, "hedda", "row_b2", { spot: ["commons", 14, 25] }], [ROW, "freya", "row_b2", { spot: ["commons", 16, 25] }], [ROW, "trixie", "row_b2", { spot: ["commons", 17, 24] }],
  [ROW, "maisie", "row_b4", { spot: ["commons", 28, 25] }], [ROW, "fiona", "row_b4", { spot: ["commons", 30, 25] }], [ROW, "leona", "row_b4", { spot: ["commons", 31, 24] }],
  [ROW, "sammy", "row_b6", { spot: ["commons", 40, 24] }], [ROW, "tobias", "row_b6", { spot: ["commons", 42, 24] }], [ROW, "dmitri", "row_b6", { spot: ["commons", 43, 23] }],
  // Bungalow 3 und 5, der Strand
  [ROW, "inya", "isle_inya", { room: "commons__2" }], [ROW, "livvie", "isle_livvie", { spot: ["commons", 22, 22] }], [ROW, "rana", "isle_rana", { spot: ["commons", 6, 43] }],
  [ROW, "tomi", "isle_tomi", { spot: ["commons", 35, 22] }], [ROW, "ed", "isle_ed", { spot: ["commons", 37, 30] }], [ROW, "viktor", "isle_viktor", { spot: ["commons", 11, 43] }],
  [ROW, "freddie", "isle_freddie", { spot: ["commons", 31, 42] }], [ROW, "sunny", "isle_sunny", { spot: ["commons", 34, 41] }],
  // die Küche
  ["commons_kitchen", "odalys", "isle_odalys", { room: "commons__0" }], ["commons_kitchen", "rafa", "isle_rafa", { room: "commons__0" }],
  // der Quad
  ["quad", "pippa", "isle_pippa", { spot: ["campus_core", 36, 30] }], ["quad", "teobalt", "isle_teobalt", { spot: ["campus_core", 33, 22] }], ["quad", "noor", "isle_noor", { spot: ["campus_core", 35, 13] }],
  ["quad", "junho", "isle_junho", { spot: ["campus_core", 32, 28] }], ["quad", "eloise", "isle_eloise", { spot: ["campus_core", 28, 25] }], ["quad", "cas", "isle_cas", { spot: ["campus_core", 38, 28] }],
  ["quad", "victoria", "isle_victoria", { spot: ["campus_core", 41, 33] }],
  // vor Rare Hall, am Tor
  ["main_gate", "eberhart", "isle_eberhart", { spot: ["gate", 20, 19] }], ["main_gate", "mikoto", "isle_mikoto", { spot: ["gate", 19, 17] }], ["main_gate", "marit", "isle_marit", { spot: ["gate", 24, 18] }],
  // bei den Trial Domes: Spectral wartet auf seine Einstufung
  ["trial_dome", "gideon", "isle_gideon", { spot: ["campus_west", 16, 50] }], ["trial_dome", "magnus", "isle_magnus", { spot: ["campus_west", 13, 47] }], ["trial_dome", "ashton", "isle_ashton", { spot: ["campus_west", 20, 44] }],
  ["trial_dome", "jessica", "isle_jessica", { spot: ["campus_west", 26, 46] }], ["trial_dome", "georgie", "isle_georgie", { spot: ["campus_west", 18, 46] }], ["trial_dome", "anni", "isle_anni", { spot: ["campus_west", 7, 48] }],
  ["trial_dome", "branden", "isle_branden", { spot: ["campus_west", 23, 48] }],
];
for (const [lid, id, scene, extra] of ISLE) add(lid, id, scene, extra, isleOpen);
// Was die Figuren auf den Veranden ersetzen: die Knöpfe „Knock on bungalow 2“ usw.
if (L.commons_beach && L.commons_beach.actions) L.commons_beach.actions = L.commons_beach.actions.filter(a => !(/^b[246]$/.test(a.id) && (L.commons_beach.objects || []).some(o => o.scene === a.scene)));
if (L.commons_kitchen && L.commons_kitchen.actions && has("isle_odalys")) L.commons_kitchen.actions = L.commons_kitchen.actions.filter(a => a.id !== "lunch" && a.id !== "mama");
})();
