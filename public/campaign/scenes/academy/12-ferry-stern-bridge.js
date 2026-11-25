// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
scene("stern_first", {
  once: true,
  background: "ferry_stern",
  steps: [
    {
      text: "You follow the side deck aft past the funnel, which breathes warmth over your shoulder like a large, sleeping animal. And then the noise falls away."
    },
    {
      text: "The open after deck: a long white wake running back to an empty horizon, gulls riding the air above the flagstaff, a wire luggage cage stacked to the top with trunks. One bench stands dry under a blue-and-white striped awning, a lifebuoy hung on the rail beside it. The rest of the planking shines with spray."
    },
    { text: "It is quieter here than forward. The mainland is gone." },
    {
      text: "Half a dozen people are scattered across the deck, each in their own small piece of calm, and none of them is quarrelling with anybody. A girl is reciting to the gulls. A boy is standing very nobly at the rail holding a rose. Beside the cage, a very still girl in a ruffled dress sits alone under a parasol."
    },
    { think: "So this is where people go who want to meet each other." },
    { time: 3 }
  ]
});

scene("stern_wake", {
  steps: [
    {
      text: "The wake is a long white seam, stitched behind the ship and closing as it goes. Gulls ride the air above it with their wings fixed, barely moving. They watch the water like accountants."
    },
    {
      text: "You stand at the rail with the wind behind you and say nothing to anyone. It is, you realise, the longest you have been quiet since you got on the boat."
    },
    { think: "Nobody is looking at me. Nobody is waiting for me to do anything." },
    { text: "It feels, for a moment, like a gift." },
    { when: (s)=>!(!!!s.flags["found_lenscap"]), jump: "next_2" },
    {
      text: "Something small and round has rolled into the corner by the scuppers and is rattling there with every swell. A black lens cap, with a name scratched inside it in careful capitals: LUND P."
    },
    { think: "Somebody on this ship is going to be very unhappy about this." },
    { item: "Pippa's lens cap" },
    { flag: "found_lenscap" },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_4" },
    {
      say: "nathan",
      text: "Look at the GULLS. That one is staring at me. Baylee, it's staring at me!",
      mood: "happy"
    },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_6" },
    { say: "baylee", text: "It wants your sandwich." },
    { say: "nathan", text: "I haven't GOT a sandwich!", mood: "grin" },
    { say: "baylee", text: "It doesn't know that." },
    { label: "next_6" },
    { label: "end_5" },
    { label: "next_4" },
    { label: "end_3" },
    { time: 8 }
  ]
});

scene("stern_cage", {
  steps: [
    {
      text: "The luggage cage is a wire pen stacked to the top with trunks, duffels, and one inexplicable tuba. Every item has a paper label tied to it, handwritten."
    },
    {
      text: "You read some. HALVORSEN B. — FRAGILE (a very large hard case that you suspect holds nothing breakable at all). WHISPER N. — OPEN ME AND DIE (a battered duffel, with a smaller, tidier label beneath that says in another hand: *please don't*). CAPULET V. — HANDLE WITH GRACE. LUND P. — CAMERA, DON'T. THANA O. — one small bag, tied twice."
    },
    {
      text: "At the bottom of the pile, sagging, you find your own duffel. The label says, in Aunt Dee's handwriting: ROWAN — CALL HER WHEN YOU LAND."
    },
    { think: "I will. I will call her the minute I know what to say." },
    { flag: "found_duffel" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "Which one is ours? Is it that one? Baylee, is that our one?", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "No." },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});






scene("bridge_first", {
  once: true,
  background: "ferry_bridge",
  steps: [
    {
      text: "You take the iron stair two steps at a time. At the top is a narrow wing of dark deck outside the wheelhouse, with a rope rail, a brass bell on the wall, a lifebuoy, and a fire axe in a red frame beside a clipboard."
    },
    {
      text: "Through the open door you see a bright room of brass and polished wood: a big spoked wheel, a bank of dials, a red rug, a chart table, and through the front windows the island, dead ahead and larger now, its grey cone trailing a thread of smoke. A man in a navy suit and a blue bowler hat stands at the wheel with his feet apart, talking without turning round."
    },
    { text: "If you lean over the rail, the whole ship lies below you." },
    { time: 3 }
  ]
});

scene("bridge_overlook", {
  steps: [
    {
      text: "From the wing you can see who is where. A knot of people at the lounge stair. A girl on the stern rail with her feet over the wake. A small crowd round a bollard where somebody is waving an arm at the gulls. Nathan, a spiky dot, in motion on the fore deck, talking at a very tall dot."
    },
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    {
      text: "The lounge door lets out a ripple of noise, and then another. Whatever was going to happen at the table has happened."
    },
    { jump: "end_1" },
    { label: "next_2" },
    {
      text: "A small dot with a deck box stands at the end of a table. The deck has gone quiet, in the way decks do before something happens."
    },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_5" },
    { say: "nathan", text: "I can see the WHOLE SHIP from here! I'm the king of the ship!", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_7" },
    { say: "baylee", text: "You are on a stair." },
    { label: "next_7" },
    { label: "end_6" },
    { label: "next_5" },
    { label: "end_4" },
    { time: 4 }
  ]
});

scene("bridge_plate", {
  steps: [
    {
      text: "A small brass plate is screwed to the wheelhouse door, bright where the sleeves of generations have rubbed it:"
    },
    { text: "M/V SECOND CHANCE — EVERYBODY GETS ONE." },
    { think: "That's either the most reassuring or the most alarming thing I've read all week." },
    { time: 2 }
  ]
});

scene("bridge_chart", {
  steps: [
    {
      text: "The chart is pinned flat by a chipped mug that says WORLD'S OKAYEST CAPTAIN. It shows the island as a rough, blunt oval with a volcano at the centre, the pier on the south coast, a bay with the town on its western curve, and a dotted line round the north shore labelled, in a very old hand, DO NOT."
    },
    { text: "Somebody has drawn a small boat on the south side, dead on the pier, and written: *tie up 10.40*." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "That's US! That little dot is US!", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "That is a pin." },
    { say: "nathan", text: "It's a very GOOD pin!", mood: "grin" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 3 }
  ]
});

scene("bridge_binoculars", {
  steps: [
    { text: "The binoculars hang from a hook inside the door. Nobody stops you from borrowing them." },
    {
      text: "Through the lenses the island becomes sharp and brilliant: the black rim of the crater, the green flanks, a white tower on the south cliff that must be the lighthouse. And, clear as a sketch, a long curve of pale beach with a row of tiny roofs along it. Seven of them. You count."
    },
    { think: "Bungalow row. Seven roofs. Mine's the last one, probably. Late admission, last bungalow." },
    { flag: "saw_commons_roofs" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "Me next! Me next!", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "Let him have his go, Nathan." },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});

scene("bridge_list", {
  steps: [
    { text: "The passenger list hangs on a clipboard beside the wheelhouse door, typed. You read down it." },
    {
      text: "Thirty-seven names in a tidy column, and then, at the bottom, a thirty-eighth, in ink, squeezed in at a slight angle as if added in a hurry:"
    },
    { text: "*Vance, R. — Wildcard.*" },
    { think: "Everyone who reads this list knows who the Wildcard is." },
    { flag: "read_passenger_list" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "That's the list! The one with the ink name! That's YOU!", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "We know." },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 3 }
  ]
});
