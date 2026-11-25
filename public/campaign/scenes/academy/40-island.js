// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
const STORY = helpers.story, DATA = helpers.data;
// Die Insel an Tag 1: Orte (Bungalow-Nummern, Küche in Nr. 1, Waschküche in Nr. 8) und wer wo steht.
const L = STORY.world.locations;
Object.assign(L.commons_kitchen, { name: "Bungalow 1 — Mama's Kitchen" });
L.commons_laundry = {
  name: "Bungalow 8 — The Laundry", background: "@map", music: "dorm", travel: 1, travelFrom: { commons_beach: 1, commons_room: 1, commons_kitchen: 2 },
  onArrive: [ { scene: "laundry_first", once: true } ],
  actions: [ { id: "fold", label: "Fold somebody's washing", scene: "laundry_fold", time: 10, when: (s)=>(s.day===1&&!s.flags["laundry_folded"]) } ]
};

scene("laundry_first", {
  steps: [
    { text: "Bungalow 8 has no beds in it. It has four washing machines, three dryers, a folding table worn pale down the middle, and the warm, clean, slightly scorched smell that you have known all your life." },
    { text: "A rota is chalked on a slate by the door. BUNGALOW 2: MON. BUNGALOW 3: TUE. Somebody has added, in a different hand, BUNGALOW 5: WHENEVER TOMI SAYS, and somebody else has crossed that out twice." },
    { think: "Detergent, hot lint, a dryer thumping like a slow heart. Two weeks and an ocean away from Aunt Dee's, and here it is again." },
    { think: "…I know how every machine in this room works. That is more than I can say for the rest of the island." },
    { run: (s)=>{ if (s.known.indexOf("commons_laundry") < 0) s.known.push("commons_laundry"); } }
  ]
});

scene("laundry_fold", {
  steps: [
    { text: "A basket of somebody's dry washing has been left on the folding table with a note pinned to it: BACK IN FIVE. The ink is old enough to have faded." },
    { text: "Your hands are folding before you have decided anything. Shirts in thirds. Towels in halves and halves again. A fitted sheet, which defeats most people and has never once defeated you." },
    { think: "Nobody is watching my hands. They don't shake at all." },
    { text: "You leave the stack squared on the table, the note on top, and feel, for the first time since the harbour, entirely competent." },
    { flag: "laundry_folded" }
  ]
});

scene("isle_odalys", {
  steps: [
    { when: (s)=>!s.flags["had_lunch"] && s.minutes < 840, jump: "lunch" },
    { when: (s)=>!!s.flags["isle_odalys_asked"], jump: "busy" },
    { scene: "row_mama" },
    { flag: "isle_odalys_asked" },
    { end: true },
    { label: "lunch" },
    { scene: "row_lunch" },
    { end: true },
    { label: "busy" },
    { text: "Mama Odalys is tasting something off the end of the wooden spoon with her eyes shut. She points the spoon at you without opening them." },
    { say: "odalys", text: "\"Six o'clock, mijo. Not before. If you are hungry now there is bread under the cloth, and if you are only lonely, sit down and peel.\"" },
    { choice: [
      { text: "Sit down and peel.", steps: [
        { text: "You peel. She hums along with the radio, a half-beat behind it, and once, without comment, moves the bowl two inches nearer your hand." },
        { when: (s)=>!s.flags["isle_odalys_peeled"], add: { aff_odalys: 1 }, run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 1, why: "Peeled without being asked twice" }); } },
        { flag: "isle_odalys_peeled" },
        { time: 15 }
      ] },
      { text: "\"Six o'clock. I'll be there.\"", steps: [
        { say: "rowan", text: "\"Six o'clock. I'll be there.\"" },
        { say: "odalys", text: "\"I know you will. I have counted you.\"" },
        { time: 2 }
      ] }
    ] }
  ]
});
