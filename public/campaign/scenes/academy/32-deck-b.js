// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS, ALPHA } = helpers;


scene("deck_pippa", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_pippa"], end: true },
    { choice: [
      { text: "\"I've been wondering what a photographer plays. What's yours?\"", steps: [
        { say: "rowan", text: "\"I've been wondering what a photographer plays. What's yours?\"" },
        { say: "pippa", text: "\"Slimes! They split when you hit them. More of them the worse it gets. Oof, I relate.\"" },
        { say: "pippa", text: "\"Alice, Stellan the cat, Barker. And a ridiculous amount of Cute Cheese.\"" },
        AFF("pippa", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_pippa" },
        { end: true }
      ] }
    ] },
    { text: "You are looking at the camera, but not through it. Your voice comes out of the side of your mouth." },
    { say: "rowan", text: "\"…Slimy Infestation. Cloudy, Fiery, Shadowy, Splashy, Sparky, Shiny. Every slime does its job the moment it lands. Burn something forever. Freeze. Switch off. Slime Rancher doubles it.\"" },
    { say: "rowan", text: "\"Shadowy brings them back. Alice hits for every creature that's sat a turn. Rain of Arrows hits the whole side.\" A pause. \"Wide board that lives a turn is the entire plan.\"" },
    { say: "pippa", text: "\"Stay — stay exactly like that —\" She clicks the shutter. \"That. That was your *face*. That was the face of somebody doing arithmetic. Does it do that every time?\"" },
    PHOTO("rowan_arithmetic", "Rowan reciting his deck: the face of somebody doing arithmetic", { who: ["rowan"] }),
    { say: "rowan", text: "\"Every time.\"" },
    { say: "pippa", text: "\"When it's developed, I'm putting it on the wall.\"" },
    { choice: [
      { text: "\"There'll be a Cute Camera in there somewhere. For the deck, or for you?\"", steps: [
        { say: "rowan", text: "\"There'll be a Cute Camera in there somewhere. For the deck, or for you?\"" },
        { say: "pippa", text: "\"Two. And it's both! It was the first card I ever pulled. I built everything else round it, and then pretended I'd had a plan.\"" },
        { say: "pippa", text: "\"Don't tell the slimes. They think they were first.\"" }
      ] },
      { text: "\"Why slimes, though?\"", steps: [
        { say: "rowan", text: "\"Why slimes, though?\"" },
        { say: "pippa", text: "\"Because nobody takes them seriously. They look at one and go 'aww', and they hit it, and then there are more.\"" },
        { say: "pippa", text: "\"It's very relaxing to be underestimated by somebody who's about to count the board again.\"" }
      ] }
    ] },
    AFF("pippa", 2, "Knew her deck"),
    DECK("pippa")
  ]
});

scene("ferry_mikoto", {
  steps: [
    { when: (s)=>!!s.flags["met_mikoto"], jump: "again" },
    { text: "A thin boy in round glasses is addressing a gull." },
    { text: "The gull has his sandwich. It sits on the rail, delicately lifting a corner of bread, while the boy holds out both hands as if to calm a small child. The sleeves of his red jacket hang down past his knuckles." },
    { say: "mikoto", alias: "Apologetic boy", text: "\"I'm sorry. I'm so sorry. It's just — that was my lunch. That was — I'm not angry. I just — sorry.\"" },
    { text: "The gull eats the sandwich." },
    { say: "mikoto", alias: "Apologetic boy", text: "\"…Sorry.\"" },
    { text: "He notices you and laughs, a high, helpless giggle that stops as quickly as it started." },
    { say: "mikoto", alias: "Apologetic boy", text: "\"Sorry! I'm Mikoto. I laugh when I'm frightened. It isn't funny. I know it isn't funny.\"" },
    { choice: [
      { text: "\"It's a little bit funny. I'm Rowan. And the gull won that one fair and square.\"", steps: [
        { say: "rowan", text: "\"It's a little bit funny. I'm Rowan. And the gull won that one fair and square.\"" },
        { say: "mikoto", alias: "Apologetic boy", text: "\"She did. She really did.\"" },
        { text: "A breathless little laugh, and then, mercifully, a genuine smile." },
        { say: "mikoto", alias: "Apologetic boy", text: "\"She took it out of my actual hand. I'd only had the one corner.\"" },
        AFF("mikoto", 1, "Laughed with him")
      ] },
      { text: "\"Don't apologise to the gull. I'm Rowan. Are you all right?\"", steps: [
        { say: "rowan", text: "\"Don't apologise to the gull. I'm Rowan. Are you all right?\"" },
        { say: "mikoto", alias: "Apologetic boy", text: "\"Oh — yes. No. A bit. I'm — thank you for asking, nobody asks.\"" },
        { say: "mikoto", alias: "Apologetic boy", text: "\"It's a very big boat. And a very big sea. And she came at me from the side, which I hadn't planned for.\"" },
        AFF("mikoto", 1, "Asked if he was all right")
      ] },
      { text: "\"I'm Rowan. What was in it?\"", steps: [
        { say: "rowan", text: "\"I'm Rowan. What was in it?\"" },
        { say: "mikoto", alias: "Apologetic boy", text: "\"Egg. Egg and a bit of cress. I made it at four this morning, in case the boat had nothing.\"" },
        { text: "The gull lifts the top slice, considers, and eats the cress as well." },
        { say: "mikoto", alias: "Apologetic boy", text: "\"I didn't think they ate cress.\"" },
        { say: "rowan", text: "\"This one does.\"" }
      ] }
    ] },
    { text: "He shakes a small notebook out of his left cuff, where it apparently lives, and a pencil on a string after it." },
    { say: "mikoto", alias: "Apologetic boy", text: "\"It was on the list, you see. Things that could go wrong today. Number fourteen: 'gull'. I thought it would be my glasses, though. I never once thought *sandwich*.\"" },
    { text: "He ticks it. The tick is very neat." },
    { say: "mikoto", alias: "Apologetic boy", text: "\"Mikoto Yamaguchi. Sorry — I only said half of it before. That's all of it.\"" },
    MET("mikoto", "Mikoto Yamaguchi"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He apologised to a GULL!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"I would have too. It was a big gull.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("mikoto", "Laughs when he is frightened. Keeps a numbered list of everything that might go wrong today."),
    { choice: [
      { text: "\"How many of them have happened so far?\"", steps: [
        { say: "rowan", text: "\"How many of them have happened so far?\"" }
      ] },
      { text: "\"Number fourteen. How long is this list?\"", steps: [
        { say: "rowan", text: "\"Number fourteen. How long is this list?\"" },
        { say: "mikoto", text: "\"Forty-one. Forty-two; I added 'it is the wrong boat' on the gangway. It's the right boat. I asked three people.\"" },
        { say: "rowan", text: "\"And how many have come true?\"" }
      ] },
      { text: "\"Am I on it?\"", steps: [
        { say: "rowan", text: "\"Am I on it?\"" },
        { say: "mikoto", text: "\"No! No. Well. Number three is 'somebody talks to me and I laugh at them'. That's sort of you. It's got one tick already. But you stayed, so I don't know whether I'm allowed another.\"" },
        { say: "rowan", text: "\"Tick it. It went wrong and nothing happened.\"" },
        { say: "mikoto", text: "\"…Is that a kind of tick?\" He draws something small and careful. \"I've invented a kind.\"" },
        { say: "rowan", text: "\"And how many ticks today, not counting mine?\"" },
        AFF("mikoto", 1, "Stayed after the laugh")
      ] }
    ] },
    { say: "mikoto", text: "\"Three, so far. The gull. I laughed at the man who took the tickets, and he hadn't even said anything. And a very tall person picked up my trunk on the quay and walked away with it.\"" },
    { say: "rowan", text: "\"Somebody stole your trunk?\"" },
    { say: "mikoto", text: "\"That's what I thought! I ran after him. He carried it all the way up the gangway, put it down with the others, pushed it with his foot until it was exactly straight, and left before I could say thank you.\"" },
    { say: "mikoto", text: "\"So it wasn't on the list at all. I had to write a new line and tick it at the same time. I've never had to do that.\"" },
    { text: "On the rail, the gull finishes, wipes her beak on the paintwork and settles down to watch him." },
    { say: "mikoto", text: "\"That's Mrs Pemberton, by the way. I decided while she was eating. She's very good at what she does.\"" },
    { text: "He glances at the anchor chain beside his shoes, and then at a yellow line painted on the planks a foot behind him." },
    { say: "mikoto", text: "\"Is it all right that we're standing here? I did check. The chain is for the anchor and the yellow line is for the crew, and we're on neither. I asked.\"" },
    { say: "rowan", text: "\"We're allowed.\"" },
    { say: "mikoto", text: "\"Good. Good. It's better when somebody else says it too.\"" },
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "mikoto", text: "\"You're — oh. You're the one in ink, aren't you? The whole deck's been saying. Wildcard. Rowan. Is it all right if I call you Row-Row? I won't. I'll ask first. May I?\"" },
    { when: (s)=>!s.flags["ship_knows_wildcard"], say: "mikoto", text: "\"Rowan. That's a nice name. It sounds like a bird. Would it be all right — would you mind if I called you Row-Row? I won't. I'll ask first. May I?\"" },
    { when: (s)=>!s.flags["ship_knows_wildcard"], think: "It is a tree. You let it be a bird." },
    { choice: [
      { text: "\"Sure. Row-Row is fine.\"", steps: [
        { say: "rowan", text: "\"Sure. Row-Row is fine.\"" },
        { say: "mikoto", text: "\"Row-Row!\"" },
        { text: "A brilliant smile breaks over his whole face, and he claps a hand to his mouth as though it might get out." },
        { say: "mikoto", text: "\"Oh, that's — thank you! I'll try not to — I'll use it sparingly! Like a good candle!\"" },
        AFF("mikoto", 3, "Allowed the nickname"),
        { flag: "mikoto_rowrow" }
      ] },
      { text: "\"What happens if I say no?\"", steps: [
        { say: "rowan", text: "\"What happens if I say no?\"" },
        { say: "mikoto", text: "\"Then I write 'Rowan' and underline it. And I think the other one very quietly, where it doesn't bother anybody.\"" },
        { say: "rowan", text: "\"Think it out loud. It's fine.\"" },
        { say: "mikoto", text: "\"Out loud?\" The hand goes to his mouth, too late to stop the smile. \"Row-Row. Oh. It's even better out loud.\"" },
        AFF("mikoto", 2, "Let him say it"),
        { flag: "mikoto_rowrow" },
        { flag: "mikoto_asked_no" }
      ] },
      { text: "\"I'd rather keep it as Rowan, for now. Try me again once we know each other.\"", steps: [
        { say: "rowan", text: "\"I'd rather keep it as Rowan, for now. Try me again once we know each other.\"" },
        { say: "mikoto", text: "\"Rowan. Of course. Rowan.\"" },
        { text: "A tiny nod. He turns to a clean page and writes something, very carefully." },
        { say: "rowan", text: "\"What did you write?\"" },
        { say: "mikoto", text: "\"'Rowan. Not Row-Row. Yet.'\" A small, hopeful look over the rim of the glasses. \"I've put the 'yet' in brackets.\"" },
        AFF("mikoto", 1, "Said it kindly")
      ] }
    ] },
    { text: "Mrs Pemberton shakes out her feathers and looks at him as though a second course might be on its way. His stomach makes a small sound. He apologises for it." },
    { choice: [
      { text: "Go below and find him another lunch. (3 Smug Coins)", when: (s)=>((s.coins||0)>=3), steps: [
        { say: "rowan", text: "\"Wait here. Somebody below must be selling food.\"" },
        { say: "mikoto", text: "\"Oh — I couldn't — oh, would you?\"" },
        { text: "He looks at you as if you had offered him a kidney. You come back up the stairs with a cheese roll in a paper bag; it has cost three Smug Coins." },
        { text: "He takes it in both hands, turns his back on the rail and tucks his elbows in." },
        { say: "mikoto", text: "\"I'll eat it facing the wall. She can't have two. Thank you. I'm writing this down on the other — I'm writing it down.\"" },
        { coins: -3 },
        AFF("mikoto", 3, "Bought him lunch"),
        { flag: "mikoto_sandwich" }
      ] },
      { text: "\"They'll feed us on the island. You'll last.\"", steps: [
        { say: "rowan", text: "\"They'll feed us on the island. You'll last.\"" },
        { say: "mikoto", text: "\"Yes. Yes, they will. It's in the letter: 'lunch at one'. I underlined it.\"" }
      ] }
    ] },
    { time: 8 },
    { flag: "chat_mikoto_offered" },
    { scene: "chat_mikoto" },
    { end: true },
    { label: "again" },
    { when: (s)=>!!s.flags["mikoto_sandwich"], text: "Mikoto has his back to the rail and his elbows in, like a goalkeeper, although the cheese roll is long gone. On the rail behind him the gull is pretending not to mind." },
    { when: (s)=>!s.flags["mikoto_sandwich"], text: "Mikoto is standing exactly where you left him, on neither the chain nor the yellow line. The gull has moved a foot closer along the rail." },
    { when: (s)=>!!s.flags["mikoto_rowrow"], say: "mikoto", text: "\"Row-Row! Hello. She's still watching me. I think she wants pudding.\"" },
    { when: (s)=>!s.flags["mikoto_rowrow"], say: "mikoto", text: "\"Rowan! Hello. She's still watching me. I think she wants pudding.\"" },
    { time: 5 },
    { when: (s)=>!s.flags["flag_mikoto_game"], say: "mikoto", text: "\"Would you — would you like a game? You don't have to. I'll understand. I'll apologise all the way through, I should say that now.\"" },
    { when: (s)=>!!s.flags["flag_mikoto_game"] && !!s.flags["chat_mikoto_done"], end: true },
    { choice: [
      { text: "\"Sure, let's play. I'd like that.\"", when: (s)=>!s.flags["flag_mikoto_game"], steps: [
        { say: "rowan", text: "\"Sure, let's play. I'd like that.\"" },
        { say: "mikoto", text: "\"Oh! Oh good. Oh no. I mean — good! I'll — sorry!\"" },
        { duel: "ferry_mikoto", opponent: "mikoto", opponentName: "Mikoto Yamaguchi", mustWin: false,
          onWin: [
            { say: "mikoto", text: "\"Sorry — sorry — you beat me — that's fine — that's what's supposed to happen — sorry — they get up again, you see. The skeletons. Nothing's ever properly finished.\"" },
            AFF("mikoto", 2, "Enjoyed the game")
          ],
          onLose: [
            { say: "mikoto", text: "\"I won? I'm sorry! I didn't — I'm — oh, I'm so sorry!\" He laughs, stops, laughs again. \"That was wonderful. Sorry.\"" },
            AFF("mikoto", 2, "Played with him")
          ] },
        { scene: "post_mikoto" },
        { flag: "flag_mikoto_game" },
        { time: 25 }
      ] },
      { text: "\"Can I stand here a while? You're easier to talk to than most of this ship.\"", when: (s)=>!s.flags["chat_mikoto_done"], steps: [
        { say: "rowan", text: "\"Can I stand here a while? You're easier to talk to than most of this ship.\"" },
        { say: "mikoto", text: "\"Am I? Oh. Yes. Please. There's room on this side of the chain.\"" },
        { scene: "chat_mikoto" }
      ] },
      { text: "\"Not just now. Maybe a game on the island, once I've got my bearings.\"", when: (s)=>!s.flags["flag_mikoto_game"], steps: [
        { say: "rowan", text: "\"Not just now. Maybe a game on the island, once I've got my bearings.\"" },
        { say: "mikoto", text: "\"Of course. Of course. On the island. I'll write it down, then it's real.\"" }
      ] },
      { text: "Leave him to his gull.", when: (s)=>!!s.flags["flag_mikoto_game"], steps: [] }
    ] }
  ]
});

scene("chat_mikoto", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_mikoto_1"] && !!s.flags["chat_mikoto_2"] && !!s.flags["chat_mikoto_3"] && !!s.flags["chat_mikoto_x"] && !!s.flags["chat_mikoto_r"] && (!!s.flags["deck_known_mikoto"] || !!s.flags["deck_skipped_mikoto"]) && !s.flags["chat_mikoto_done"], jump: "done" },
    { choice: [
      { text: "\"The tall one who walked off with your trunk. Did you ever get to thank him?\"", when: (s)=>!s.flags["chat_mikoto_r"], steps: [
        { say: "rowan", text: "\"The tall one who walked off with your trunk. Did you ever get to thank him?\"" },
        { say: "mikoto", text: "\"It's worse than that. I read my letter again, to calm down. Rare Hall, room 101, sharing with Eberhart von Düsterwald.\"" },
        { say: "mikoto", text: "\"And then I looked at the trunk he'd put next to mine. His own one. It's got 'E. v. Düsterwald' painted on the lid, in white.\"" },
        { text: "The giggle gets out before he can catch it." },
        { say: "mikoto", text: "\"The roommate I've been worrying about since the letter came is the person I thought was robbing me.\"" },
        { say: "rowan", text: "\"So did you thank him?\"" },
        { say: "mikoto", text: "\"I went straight over. I'd practised it. And it came out as 'thank you, Ebi'. At home that means prawn. I didn't decide it! It just arrived!\"" },
        { say: "mikoto", text: "\"He looked at me for four seconds. I counted. Then he said 'No.' Then he did a very small bow and went back to the luggage.\"" },
        { choice: [
          { text: "\"I've met him. I don't think that was anger. I think that's how he's built.\"", when: (s)=>!!s.flags["met_eberhart"], hint: "You met Eberhart", steps: [
            { say: "rowan", text: "\"I've met him. I don't think that was anger. I think that's how he's built.\"" },
            { say: "mikoto", text: "\"Do you think so? Really?\"" },
            { say: "mikoto", text: "\"…He did put my trunk straight. You wouldn't put a trunk straight for somebody you were cross with. You'd leave it crooked. I would.\"" },
            AFF("mikoto", 2, "Said Ebi wasn't angry")
          ] },
          { text: "\"'No' to the thank-you, or 'no' to the name?\"", steps: [
            { say: "rowan", text: "\"'No' to the thank-you, or 'no' to the name?\"" },
            { say: "mikoto", text: "\"That's what I don't *know*. I've written down both.\"" },
            { say: "rowan", text: "\"He bowed. You don't bow to somebody you've finished with.\"" },
            { say: "mikoto", text: "\"…Oh. That's good. I'm putting that underneath.\"" },
            AFF("mikoto", 1, "Worked it out with him")
          ] },
          { text: "\"Why 'Ebi'?\"", steps: [
            { say: "rowan", text: "\"Why 'Ebi'?\"" },
            { say: "mikoto", text: "\"Eberhart is very long, and I was frightened. It was the first short thing in my head.\"" },
            { say: "mikoto", text: "\"He is the least prawn-like person I have ever seen. I can't take it back now. It's stuck to him.\"" }
          ] }
        ] },
        { text: "He pushes the glasses up with the back of a sleeve." },
        { say: "mikoto", text: "\"I just don't want to be the reason somebody asks for a different room. On the first day. Before lunch.\"" },
        { say: "rowan", text: "\"Nobody changes rooms over a prawn.\"" },
        { text: "He laughs. It is the same laugh as before, high and helpless, and for once it has landed in the right place." },
        { say: "mikoto", text: "\"That was the right time, wasn't it? I think that was one of the right times.\"" },
        AFF("mikoto", 2, "Heard about the roommate"),
        { flag: "chat_mikoto_r" },
        { flag: "mikoto_said_ebi" },
        REL("mikoto", "eberhart"),
        NOTE("mikoto", "Shares Rare Hall 101 with Eberhart von Düsterwald, the tall boy who carried his trunk. Has already called him 'Ebi' by accident."),
        { time: 2 }
      ] },
      { text: "\"You checked where we're allowed to stand. Do you check everything?\"", when: (s)=>!s.flags["chat_mikoto_1"], steps: [
        { say: "rowan", text: "\"You checked where we're allowed to stand. Do you check everything?\"" },
        { say: "mikoto", text: "\"Everything. Sorry. It's — if I know where the edge is, I can stand quite near it. If I don't, I stand in the middle and get in everybody's way.\"" },
        { say: "mikoto", text: "\"That's why here, really. My mother looked the Academy up. She said: he's very good at lists, a place with a lot of rules will suit him.\" A quick, high laugh, stopped at once. \"The handbook came with the letter. It's eleven pages. I'd hoped for more.\"" },
        { choice: [
          { text: "\"Eleven pages leaves a lot of room.\"", steps: [
            { say: "rowan", text: "\"Eleven pages leaves a lot of room.\"" },
            { say: "mikoto", text: "\"That's exactly what's wrong with it! Room for what? It doesn't say!\"" }
          ] },
          { text: "\"You like them that much? Rules.\"", steps: [
            { say: "rowan", text: "\"You like them that much? Rules.\"" },
            { say: "mikoto", text: "\"Yes. Rules are very kind. They tell you where the edge is before you get there. People mostly tell you afterwards.\"" },
            AFF("mikoto", 1, "Took it seriously")
          ] },
          { text: "\"What would you add, if they let you?\"", steps: [
            { say: "rowan", text: "\"What would you add, if they let you?\"" },
            { say: "mikoto", text: "\"One line. 'Tell Mikoto when the plan changes.' I'd put it on page one. I wouldn't mind what the plan was.\"" },
            AFF("mikoto", 1, "Asked what he'd want")
          ] }
        ] },
        { text: "He studies you for a moment through the big lenses, blinking." },
        { say: "mikoto", text: "\"You're not a rules person, are you? You look like somebody who read them once and never needed to again.\"" },
        { say: "rowan", text: "\"Something like that.\"" },
        { say: "mikoto", text: "\"I thought so. That's the frightening kind.\" But he is smiling when he says it." },
        AFF("mikoto", 2, "Asked how he manages"),
        { flag: "chat_mikoto_1" },
        NOTE("mikoto", "His mother thought a place full of rules would suit him. The handbook turned out to be eleven pages."),
        { time: 2 }
      ] },
      { text: "\"Does everybody get a nickname, or only me and the gull?\"", when: (s)=>!s.flags["chat_mikoto_2"], steps: [
        { say: "rowan", text: "\"Does everybody get a nickname, or only me and the gull?\"" },
        { say: "mikoto", text: "\"Everybody! Sorry. I can't help it. The captain's Bowler; he's got a blue one, a real one. I haven't decided about the volcano yet. I'm waiting for it to do something.\"" },
        { choice: [
          { text: "\"Where do they come from?\"", steps: [
            { say: "rowan", text: "\"Where do they come from?\"" },
            { say: "mikoto", text: "\"They just arrive. Before I've decided anything. It's like sneezing, except that it lasts for ever.\"" }
          ] },
          { text: "\"And when somebody says no?\"", steps: [
            { say: "rowan", text: "\"And when somebody says no?\"" },
            { when: (s)=>!s.flags["mikoto_asked_no"], say: "mikoto", text: "\"Then I say the real one out loud. And the other one inside. I can't not. I've tried.\"" },
            { when: (s)=>!!s.flags["mikoto_asked_no"], say: "mikoto", text: "\"You know that one. The real one out loud and the other one inside — unless somebody tells me to think it out loud. Then I'm hopeless.\"" }
          ] }
        ] },
        { say: "mikoto", text: "\"A real name is something you can get wrong, you see. You can say it wrong, or forget it, or say it to the wrong person. One I made myself, I can't get wrong. It stays where I put it.\"" },
        { text: "He looks at his shoes." },
        { say: "mikoto", text: "\"Nobody's ever given me one back. That's all right. I'm not — I wasn't hinting.\"" },
        { choice: [
          { text: "\"I'll think of one. A good one takes me a while.\"", steps: [
            { say: "rowan", text: "\"I'll think of one. A good one takes me a while.\"" },
            { say: "mikoto", text: "\"Does it? Mine take no time at all. That's probably what's wrong with them.\"" },
            { say: "mikoto", text: "\"I'll wait. I'm good at waiting.\" He opens the notebook. \"I've got a page for it.\"" },
            AFF("mikoto", 2, "Promised him a nickname"),
            { flag: "mikoto_owed_nickname" }
          ] },
          { text: "\"Mikoto suits you as it is.\"", steps: [
            { say: "rowan", text: "\"Mikoto suits you as it is.\"" },
            { say: "mikoto", text: "\"Oh. Does it?\"" },
            { say: "mikoto", text: "\"…Nobody's said that either.\"" },
            AFF("mikoto", 1, "Liked his real name")
          ] }
        ] },
        AFF("mikoto", 1, "Played along"),
        { flag: "chat_mikoto_2" },
        NOTE("mikoto", "Nicknames everybody: the captain is Bowler, the gull is Mrs Pemberton. A name he made himself is one he cannot get wrong."),
        { time: 2 }
      ] },
      { text: "\"The gull's ticked off. What's at the top of the list now?\"", when: (s)=>!s.flags["chat_mikoto_3"], steps: [
        { say: "rowan", text: "\"The gull's ticked off. What's at the top of the list now?\"" },
        { say: "mikoto", text: "\"Oh — it isn't in order of the day. It's in order of likelihood.\"" },
        { say: "mikoto", text: "\"One: my first duel on a real table, with people round it. Two: the person I'm sharing a room with. Three: that I laugh at the wrong moment and somebody thinks it's about them.\"" },
        { choice: [
          { text: "\"Number one's on mine as well. I've never played on a real table.\"", steps: [
            { say: "rowan", text: "\"Number one's on mine as well. I've never played on a real table.\"" },
            { say: "mikoto", text: "\"Is it?\" A quick, startled look, magnified by the glasses. \"You?\"" },
            { say: "rowan", text: "\"My hands shake when people watch.\"" },
            { say: "mikoto", text: "\"Oh. Oh, that's — thank you. It's much better with two. I'll write you next to it. In pencil, so that you can come off again.\"" },
            AFF("mikoto", 3, "Admitted he was nervous too")
          ] },
          { text: "\"Has number three happened before?\"", steps: [
            { say: "rowan", text: "\"Has number three happened before?\"" },
            { say: "mikoto", text: "\"Every time. Somebody falls over, or cries, or tells me something sad, and out it comes. And then they go and sit somewhere else. It's a very reliable list.\"" },
            { say: "rowan", text: "\"I'm still standing here.\"" },
            { say: "mikoto", text: "\"You are. I'd noticed. I didn't like to say, in case it stopped.\"" },
            AFF("mikoto", 2, "Still standing there")
          ] },
          { text: "\"And what's at the very bottom?\"", steps: [
            { say: "rowan", text: "\"And what's at the very bottom?\"" },
            { say: "mikoto", text: "\"'Volcano.' The letter says it's asleep. So I've put it last.\"" },
            { say: "mikoto", text: "\"In pen, though.\"" }
          ] }
        ] },
        AFF("mikoto", 1, "Asked about the list"),
        { flag: "chat_mikoto_3" },
        NOTE("mikoto", "The list is in order of likelihood. His first duel on a real table is at the top."),
        { time: 2 }
      ] },
      { text: "\"All those lines are for what goes wrong. Do you keep a list of anything else?\"", when: (s)=>!!s.flags["chat_mikoto_3"] && !s.flags["chat_mikoto_x"], steps: [
        { say: "rowan", text: "\"All those lines are for what goes wrong. Do you keep a list of anything else?\"" },
        { say: "mikoto", text: "\"Oh — no. No, I — sorry. That's a very good question.\"" },
        { text: "He looks briefly stricken, as if he had been caught with a second notebook. Then he turns the first one over and opens it from the back." },
        { say: "mikoto", text: "\"I keep two. The other one is nice things. It's much shorter.\"" },
        { say: "mikoto", text: "\"It's got 'hot milk tea', and 'the sound the sea makes when an engine stops', and 'when someone says 'sure' and means it'.\"" },
        { choice: [
          { text: "\"What was the last thing you put on it?\"", steps: [
            { say: "rowan", text: "\"What was the last thing you put on it?\"" },
            { say: "mikoto", text: "\"'The trunk was straight.' I don't know why that's a nice thing. It just was. Somebody bothered.\"" },
            { when: (s)=>!!s.flags["mikoto_sandwich"], say: "mikoto", text: "\"And then 'cheese roll'. That's under it. You're on the nice list twice, if you count the paper bag.\"" }
          ] },
          { text: "\"That's a good list.\"", steps: [
            { say: "rowan", text: "\"That's a good list.\"" },
            { say: "mikoto", text: "\"It's only three pages. The other one's got nineteen.\"" },
            { say: "rowan", text: "\"Three pages you'd want to read twice.\"" }
          ] }
        ] },
        { when: (s)=>!!s.flags["mikoto_rowrow"], say: "mikoto", text: "\"…Row-Row.\"" },
        { when: (s)=>!s.flags["mikoto_rowrow"], say: "mikoto", text: "\"…Rowan.\"" },
        { text: "A very small, very surprised voice." },
        { say: "mikoto", text: "\"Nobody's ever asked about the second one.\"" },
        AFF("mikoto", 3, "Asked about the second list"),
        { flag: "chat_mikoto_x" },
        NOTE("mikoto", "Keeps two lists: what could go wrong, and nice things. Nobody had asked about the second one."),
        { time: 2 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_mikoto"], steps: [
        { scene: "deck_mikoto" }
      ] },
      { text: "\"I'll go and see more of the ship. Good talking to you, Mikoto.\"", steps: [
        { say: "rowan", text: "\"I'll go and see more of the ship. Good talking to you, Mikoto.\"" },
        { say: "mikoto", text: "\"Oh — you too! Sorry! Not sorry. Good. You too.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_mikoto_done" },
    { say: "mikoto", text: "\"That's — that was nice. Sorry. I mean thank you, not sorry. I'm — I'm working on it.\"" },
    { end: true }
  ]
});

scene("deck_mikoto", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_mikoto"], end: true },
    { choice: [
      { text: "\"Would you mind telling me what you play, Mikoto? I'll understand if you'd rather not.\"", steps: [
        { say: "rowan", text: "\"Would you mind telling me what you play, Mikoto? I'll understand if you'd rather not.\"" },
        { say: "mikoto", text: "\"Skeletons. Healers and mages, mostly. Sorry. They heal each other, and when one dies, The Bonegrinder turns it into a card. Is that all right? That's all right.\"" },
        AFF("mikoto", 2, "Asked gently")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_mikoto" },
        { end: true }
      ] }
    ] },
    { text: "Your lips are moving. You are not looking at Mikoto any longer. You are looking at a board nobody else can see." },
    { say: "rowan", text: "\"…Tiny Bone Friends. Healer, Priest, Mage, Wizard. Necromancer brings one back. Treasure Skeleton draws. Bonegrinder turns every dead one into a card.\"" },
    { say: "rowan", text: "\"Raise the Minions after a sweep, three at once. Vacarn is the weak point, he's always the weak point.\" A breath. \"Grinds. Doesn't rush. Patient.\"" },
    { say: "mikoto", text: "\"You — you know all of them? Sorry. Sorry, I — nobody — they only ever know the Death Knight.\"" },
    { say: "rowan", text: "\"The Death Knight's the dull one. The Healers are the deck.\"" },
    { say: "mikoto", text: "\"Oh.\" A small, wet laugh, stopped at once. \"Oh, that's — thank you. Sorry. That's lovely.\"" },
    { choice: [
      { text: "\"Why skeletons? You don't seem the type.\"", steps: [
        { say: "rowan", text: "\"Why skeletons? You don't seem the type.\"" },
        { say: "mikoto", text: "\"Everybody thinks they're the frightening ones. But look at what they do. They're the only people on the table who look after each other.\"" },
        { say: "mikoto", text: "\"And I'm frightened of nearly everything else. It seemed fair to have one thing the other way round.\"" }
      ] },
      { text: "\"You said 'all right' twice. Who told you it wasn't?\"", steps: [
        { say: "rowan", text: "\"You said 'all right' twice. Who told you it wasn't?\"" },
        { say: "mikoto", text: "\"Nobody *told* me. People look at the box and then at me and then they laugh, and that's meant to be my job.\"" },
        { say: "mikoto", text: "\"You didn't. You counted the Healers. I noticed that.\"" }
      ] }
    ] },
    AFF("mikoto", 3, "Knew his deck"),
    DECK("mikoto")
  ]
});

scene("post_mikoto", {
  steps: [
    DECK("mikoto"),
    { when: (s)=>s.duels["ferry_mikoto"] === "won", jump: "won" },
    { text: "Mikoto stares at his board, and then at you, and then bursts into a breathless laugh that is half relief." },
    { say: "mikoto", text: "\"It worked. The Bonegrinder came down on turn five and it turned every skeleton you killed into a card. It *worked*.\"" },
    { say: "rowan", text: "\"I should have left them alone. Every time I killed one I was drawing for you.\"" },
    { say: "mikoto", text: "\"Nothing's ever properly finished.\" Quietly, for him. \"That's — I've been trying to say that for years.\"" },
    { choice: [
      { text: "\"You didn't laugh once while you were playing. Did you notice?\"", steps: [
        { say: "rowan", text: "\"You didn't laugh once while you were playing. Did you notice?\"" },
        { say: "mikoto", text: "\"Didn't I? No. I didn't.\"" },
        { say: "mikoto", text: "\"I know where all the edges are, on a table. It's the only place I do.\"" }
      ] },
      { text: "\"Say it again, and leave the 'sorry' out this time.\"", steps: [
        { say: "rowan", text: "\"Say it again, and leave the 'sorry' out this time.\"" },
        { say: "mikoto", text: "\"I won.\" He tries it like a hot drink. \"I won. Oh, that's — it's much shorter that way.\"" }
      ] }
    ] },
    { jump: "after" },
    { label: "won" },
    { text: "Mikoto is looking at the board with wide, unfocused eyes. A skeleton at the bottom of his discard pile has not quite finished falling over." },
    { say: "mikoto", text: "\"Oh. You killed all my healers before they could heal anything. I didn't — that's — that's good. That's what you should do.\"" },
    { say: "rowan", text: "\"I went after the Necromancer first. If he'd survived, Raise the Minions would have brought three back.\"" },
    { say: "mikoto", text: "\"It would have! It would have, wouldn't it? I had it in my hand!\" A giggle, then quick embarrassment. \"Sorry. It was a very good plan.\"" },
    { choice: [
      { text: "\"It was. You were one turn away from it.\"", steps: [
        { say: "rowan", text: "\"It was. You were one turn away from it.\"" },
        { say: "mikoto", text: "\"One turn. I'll write that down. Not on the bad list.\"" }
      ] },
      { text: "\"You don't have to be sorry about a good plan.\"", steps: [
        { say: "rowan", text: "\"You don't have to be sorry about a good plan.\"" },
        { say: "mikoto", text: "\"No. No, I suppose I — it was good, wasn't it? I'm keeping it. I'll do it to somebody else.\"" }
      ] }
    ] },
    // Geschenk nach Rowans Sieg: der Knochenhund, der die anderen zurückholt.
    { text: "He gathers up his discard pile and stops halfway, with one card still face up in his fingers: a small skeleton dog, all ribs and tail." },
    { say: "mikoto", text: "\"Loyal Bone Dog. Would you — he's for you. If you'd like. Sorry. When one of the others goes down, he gives himself up and brings it straight back.\" A small, crooked smile. \"I thought you ought to have something from my side that gets up again.\"" },
    { choice: [
      { text: "\"I'd like him. Thank you, Mikoto.\"", steps: [
        { say: "rowan", text: "\"I'd like him. Thank you, Mikoto.\"" },
        { say: "mikoto", text: "\"Oh! Good. Good. He's very loyal. It's in the name, so that's — yes.\" He laughs, and for once does not apologise for it." },
        { card: "Loyal Bone Dog", rarity: "uncommon", flag: "mikoto_gave_dog" }
      ] },
      { text: "\"Keep him. Your skeletons need him more than my storm does.\"", steps: [
        { say: "rowan", text: "\"Keep him. Your skeletons need him more than my storm does.\"" },
        { say: "mikoto", text: "\"They do, don't they? They'd fall to bits.\" He slides the dog back into the deck very gently, as if it might mind. \"Thank you for — sorry. Thank you.\"" },
        { flag: "mikoto_gift_refused" }
      ] }
    ] },
    { label: "after" },
    AFF("mikoto", 1, "Talked it through")
  ]
});

scene("ferry_branden", {
  steps: [
    { when: (s)=>!!s.flags["met_branden"], jump: "again" },
    { text: "Somebody has taken the lifebuoy off the rail and is rolling it down the deck like a hoop. The somebody is perhaps ten years old. The first thing you notice is the hair, a flame-orange mop that stands up in spikes as if it is in the middle of a shout." },
    { text: "The second is the jacket, three sizes too big, its sleeves flapping past his hands like flags. The third is the grin, which has already decided to regret nothing." },
    { say: "branden", alias: "Flame-haired kid", text: "\"You! Jacketless! Be my timekeeper! If I get this thing to the funnel before a crewman catches me, you owe me one Smug Coin. If I get caught, you don't, but I'll still say it was a *very* good attempt.\"" },
    { choice: [
      { text: "\"That's the ship's lifebuoy. Somebody might need it. I'm Rowan, by the way.\"", steps: [
        { say: "rowan", text: "\"That's the ship's lifebuoy. Somebody might need it. I'm Rowan, by the way.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"Nobody's drowning. Technically. I checked the whole deck.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"Branden Sunflower. National champion. Under tens. Two years running. And you're the boring one who's about to tell on me.\"" },
        { say: "rowan", text: "\"I haven't told anyone.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"*Yet!*\"" },
        { flag: "branden_scolded" },
        { flag: "branden_said_champion" }
      ] },
      { text: "\"All right. Rowan, timekeeper. I'll time you. Go.\"", steps: [
        { say: "rowan", text: "\"All right. Rowan, timekeeper. I'll time you. Go.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"A SPORT! Okay! On three! One! Two — \"" },
        { text: "He is off along the deck with the buoy bowling ahead of him. Half a dozen heads turn. From somewhere above the lounge stairs a voice that can only belong to a captain shouts \"WHO HAS MY LIFEBUOY?\" and the sprinter takes a corner so fast that he skids." },
        { say: "branden", alias: "Flame-haired kid", text: "\"Eleven seconds! Pay up!\" Breathless, magnificent, unashamed. \"Branden Sunflower! Remember it! You timed the best!\"" },
        { text: "You fish a Smug Coin out of the pouch and put it in his hand. He bites it, looks wounded when it does not give, and pockets it with great dignity." },
        { coins: -1 },
        AFF("branden", 3, "Timed his run"),
        { flag: "branden_prank_buddy" }
      ] },
      { text: "\"How old are you, exactly? I'm Rowan, and I'm trying to work out who's in charge here.\"", steps: [
        { say: "rowan", text: "\"How old are you, exactly? I'm Rowan, and I'm trying to work out who's in charge here.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"TEN. Ten and three quarters. Technically eleven in spirit.\"" },
        { say: "branden", alias: "Flame-haired kid", text: "\"Branden Sunflower. National champion. Under tens. Two years running. You can write it down, but I won't wait.\"" },
        AFF("branden", 1, "Asked his age"),
        { flag: "branden_said_champion" }
      ] }
    ] },
    MET("branden", "Branden Sunflower"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He's a KID! He has a LIFEBUOY! I want to be him when I'm ten, and I'm already past ten, so I'd like to be him NOW.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"No.\"" },
    { add: { ferry_talked: 1 } },
    { say: "branden", text: "\"Everyone else on this boat is *old*. You're old. You're, what, nineteen? That's *ancient*. I'm the youngest here, so I've got the best seat in the house, and I'm not giving it up.\"" },
    { choice: [
      { text: "\"Nineteen.\"", steps: [
        { say: "rowan", text: "\"Nineteen.\"" },
        { say: "branden", text: "\"NINETEEN! That's nearly twenty! That's nearly *finished*!\"" },
        { say: "branden", text: "\"It's fine. You're holding up *very* well.\" He pats your elbow, which is as high as he can comfortably reach. \"I've seen worse. There's one with a parasol.\"" },
        AFF("branden", 1, "Owned up to nineteen")
      ] },
      { text: "\"The best seat for what?\"", steps: [
        { say: "rowan", text: "\"The best seat for what?\"" },
        { say: "branden", text: "\"For *everything*! Nobody's watching the small one! By the time they look down, it's already happened!\"" },
        { say: "rowan", text: "\"I looked down.\"" },
        { say: "branden", text: "\"You're *jacketless*. You've got nothing else to look at. That doesn't count.\"" }
      ] },
      { text: "\"How does somebody your age get onto this boat at all?\"", steps: [
        { say: "rowan", text: "\"How does somebody your age get onto this boat at all?\"" },
        { say: "branden", text: "\"They had a *meeting* about me. A whole meeting. With a table.\"" },
        { say: "branden", text: "\"I wasn't allowed in. I listened at the door. That's attending.\"" }
      ] }
    ] },
    { time: 6 },
    { flag: "chat_branden_offered" },
    { scene: "chat_branden" },
    { end: true },
    { label: "again" },
    { say: "branden", text: "\"Jacketless!\"" },
    { text: "He has found a fresh bit of deck and is arranging a bucket on the lifeboat cover with enormous care." },
    { say: "branden", text: "\"Don't look at the bucket. There's no bucket.\"" },
    { flag: "branden_bucket_seen" },
    { choice: [
      { text: "\"Do you want a game, Branden?\"", when: (s)=>!s.flags["flag_branden_game"] && !s.flags["branden_scolded"], steps: [
        { say: "rowan", text: "\"Do you want a game, Branden?\"" },
        { say: "branden", text: "\"A GAME! Finally somebody brave!\"" },
        { text: "He abandons the bucket without a backward glance." },
        { duel: "ferry_branden", opponent: "branden", opponentName: "Branden Sunflower", mustWin: false,
          onWin: [
            { say: "branden", text: "\"That doesn't count. That was a trial run. I'm the *national champion*, you got lucky, that's — hang on — what do you mean, *good game*?\"" },
            AFF("branden", 2, "Beat him fairly"),
            { flag: "beat_branden" }
          ],
          onLose: [
            { say: "branden", text: "\"National champion! Two years running! Write it DOWN!\"" },
            { text: "He is jigging on the spot." },
            { say: "branden", text: "\"You were a *very* good opponent. For somebody ancient.\"" },
            AFF("branden", 2, "Played a proper game"),
            { flag: "branden_said_champion" }
          ] },
        { scene: "post_branden" },
        { flag: "flag_branden_game" },
        { time: 25 }
      ] },
      { text: "\"Never mind the bucket. Have you got a minute?\"", when: (s)=>!s.flags["chat_branden_done"], steps: [
        { say: "rowan", text: "\"Never mind the bucket. Have you got a minute?\"" },
        { say: "branden", text: "\"I've got *several*. I'm ten. I've got more minutes than anyone on this boat.\"" },
        { scene: "chat_branden" }
      ] },
      { text: "\"Is that a bucket, Branden?\"", steps: [
        { say: "rowan", text: "\"Is that a bucket, Branden?\"" },
        { say: "branden", text: "\"NO.\"" },
        { say: "rowan", text: "\"It's a bucket on a lifeboat cover. Above the door to the lounge.\"" },
        { say: "branden", text: "\"…It's art.\" A pause. \"It's performance art. You haven't seen it. Walk through the door.\"" },
        Object.assign(AFF("branden", 1, "Spotted the bucket"), { when: (s)=>!s.flags["branden_bucket_asked"] }),
        { flag: "branden_bucket_asked" }
      ] },
      { text: "Leave him to his art.", steps: [] }
    ] },
    { time: 4 }
  ]
});

scene("chat_branden", {
  steps: [
    { label: "top" },
    { when: (s)=>(!!s.flags["chat_branden_1"] || !s.flags["branden_said_champion"]) && !!s.flags["chat_branden_2"] && !!s.flags["chat_branden_3"] && (!!s.flags["chat_branden_4"] || !s.flags["met_georgie"]) && (!!s.flags["deck_known_branden"] || !!s.flags["deck_skipped_branden"]) && !s.flags["chat_branden_done"], jump: "done" },
    { choice: [
      { text: "\"National champion, you said. Tell me about that.\"", when: (s)=>!s.flags["chat_branden_1"] && !!s.flags["branden_said_champion"], steps: [
        { say: "rowan", text: "\"National champion, you said. Tell me about that.\"" },
        { say: "branden", text: "\"Two years running. Under tens. The final was in a *school gym*, the other kid cried, I did a lap of honour, they let me keep the trophy for a week.\"" },
        { say: "branden", text: "\"I do not *give* the trophy back. They keep sending letters. I have a drawer for the letters.\"" },
        { say: "rowan", text: "\"Do you read them?\"" },
        { say: "branden", text: "\"I *file* them.\" Dignified. \"Technically that's a different thing.\"" },
        { choice: [
          { text: "\"What happens when the drawer's full?\"", steps: [
            { say: "rowan", text: "\"What happens when the drawer's full?\"" },
            { say: "branden", text: "\"Then I win it again and it's *mine* anyway and they have to send a letter saying sorry. I've planned the whole thing.\"" },
            { say: "branden", text: "\"…Except I'm not under ten any more. So somebody else has got to win it now. I hope they're *rubbish*.\"" }
          ] },
          { text: "\"Did the other kid really cry?\"", steps: [
            { say: "rowan", text: "\"Did the other kid really cry?\"" },
            { say: "branden", text: "\"LOADS. Buckets. …A bit.\"" },
            { say: "branden", text: "\"I gave him my juice.\" Very fast. \"Don't write that down. That's not part of the story.\"" },
            AFF("branden", 1, "Heard about the juice")
          ] }
        ] },
        AFF("branden", 2, "Let him boast"),
        { flag: "chat_branden_1" },
        NOTE("branden", "National champion, under tens, two years running. Files the trophy letters in a drawer."),
        { time: 2 }
      ] },
      { text: "\"Is the lifebuoy the best you've got, or have there been better ones?\"", when: (s)=>!s.flags["chat_branden_2"], steps: [
        { say: "rowan", text: "\"Is the lifebuoy the best you've got, or have there been better ones?\"" },
        { say: "branden", text: "\"Oh, *wow*, do you have an hour? There was the bucket. And the other bucket. And the time I put every single shoe in the school gym on the roof.\"" },
        { say: "rowan", text: "\"How did you get them up there?\"" },
        { say: "branden", text: "\"A *ladder*, Rowan.\" Very patient. \"I'm not a *magician*. Technically I'm *better*.\"" },
        { choice: [
          { text: "\"Why shoes?\"", steps: [
            { say: "rowan", text: "\"Why shoes?\"" },
            { say: "branden", text: "\"Because then *everybody* had to go home in socks! The whole school! Together! The big ones as well!\"" },
            { say: "branden", text: "\"It was the best day. Everyone was talking to everyone. Nobody said I was annoying for a whole afternoon.\"" }
          ] },
          { text: "\"Did they ever find out it was you?\"", steps: [
            { say: "rowan", text: "\"Did they ever find out it was you?\"" },
            { say: "branden", text: "\"They found out *straight away*. I was the only one with shoes on.\"" },
            { say: "branden", text: "\"That's the flaw. I've fixed the flaw. I'm not telling you how.\"" }
          ] }
        ] },
        { say: "branden", text: "\"Don't tell my mum I said 'roof'. She thinks it was a window.\"" },
        AFF("branden", 2, "Asked about the pranks"),
        { flag: "chat_branden_2" },
        NOTE("branden", "Pranks: the bucket, the other bucket, and every shoe in the school gym on the roof."),
        { time: 2 }
      ] },
      { text: "\"A whole island of ancient people. What's in it for you?\"", when: (s)=>!s.flags["chat_branden_3"], steps: [
        { say: "rowan", text: "\"A whole island of ancient people. What's in it for you?\"" },
        { say: "branden", text: "\"A volcano. They have a *volcano*. I'm going to find out if you can toast a marshmallow on it, and then I'm going to find out if you can toast a *person* on it, and then I'm going to be told no.\"" },
        { say: "rowan", text: "\"Probably in that order.\"" },
        { say: "branden", text: "\"In that order! You're good at this!\"" },
        { text: "A very small, very brief flash of something different." },
        { say: "branden", text: "\"…At home nobody wanted to find things out with me. They said I was too much. This is the first place that's got a *volcano*.\"" },
        { choice: [
          { text: "\"I'd like to know about the marshmallow myself.\"", steps: [
            { say: "rowan", text: "\"I'd like to know about the marshmallow myself.\"" },
            { say: "branden", text: "\"You'd come?\" He looks at you sideways, checking for the trick. \"You'd have to carry the marshmallows. I'm carrying the stick. The stick's the important job.\"" },
            { say: "rowan", text: "\"I'll carry the marshmallows.\"" },
            { say: "branden", text: "\"DEAL. No take-backs. Ancient people can't do take-backs, it's a rule.\"" },
            AFF("branden", 2, "Wants to find out too"),
            { flag: "branden_marshmallow_pact" }
          ] },
          { text: "\"Too much for whom?\"", steps: [
            { say: "rowan", text: "\"Too much for whom?\"" },
            { say: "branden", text: "\"For — I don't know. For indoors.\" He kicks the rail, not hard. \"A volcano's *outdoors*. You can't be too much for a volcano. It's bigger.\"" },
            AFF("branden", 1, "Took his side")
          ] },
          { text: "Say nothing. Look at the island with him.", steps: [
            { text: "You both look at it. The mountain sits on the horizon with a little cloud on top, like a hat it has not noticed." },
            { say: "branden", text: "\"…It's got a hat on. I'm going to tell it.\"" }
          ] }
        ] },
        AFF("branden", 1, "Asked what he wants"),
        { flag: "chat_branden_3" },
        NOTE("branden", "Wants to find out whether you can toast a marshmallow on the volcano. At home nobody wanted to explore with him."),
        { time: 2 }
      ] },
      { text: "\"Have you met Georgie? The girl with the green plush dragon?\"", when: (s)=>!!s.flags["met_georgie"] && !s.flags["chat_branden_4"], steps: [
        { say: "rowan", text: "\"Have you met Georgie? The girl with the green plush dragon?\"" },
        { say: "branden", text: "\"The *old* one?\" A snort. \"She's fourteen. She won the under-sixteens. Technically that's the *old people's* league.\"" },
        { say: "rowan", text: "\"She seemed a bit nervous.\"" },
        { say: "branden", text: "\"That's because she's seen the competition.\"" },
        { text: "A beat, and then, a little less loudly:" },
        { say: "branden", text: "\"…She asked if she could sit on the rope. Nobody asks that. I was going to say yes if she'd asked me. I was going to charge her a Smug Coin.\"" },
        { say: "branden", text: "\"…It's *annoying*. She used to be the youngest. Now it's me. And everyone's still looking at her *first*.\"" },
        { choice: [
          { text: "\"You were going to say yes, though.\"", steps: [
            { say: "rowan", text: "\"You were going to say yes, though.\"" },
            { say: "branden", text: "\"For a *coin*!\" Outraged. \"…Half a coin. She looked like she'd only got half.\"" }
          ] },
          { text: "\"They looked at you first when you had the lifebuoy.\"", steps: [
            { say: "rowan", text: "\"They looked at you first when you had the lifebuoy.\"" },
            { say: "branden", text: "\"…They did, didn't they.\" He thinks about this with his whole face. \"So I just need a lifebuoy *all the time*. That's fine. I can do that.\"" }
          ] }
        ] },
        { flag: "chat_branden_4" },
        NOTE("branden", "Is jealous that Georgie used to be the youngest."),
        REL("branden", "georgie"),
        { time: 2 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_branden"], steps: [
        { scene: "deck_branden" }
      ] },
      { text: "\"I'll leave you to your bucket.\"", when: (s)=>!!s.flags["branden_bucket_seen"], steps: [
        { say: "rowan", text: "\"I'll leave you to your bucket.\"" },
        { say: "branden", text: "\"There's no bucket!\"" },
        { end: true }
      ] },
      { text: "\"I'll leave you to your lifebuoy.\"", when: (s)=>!s.flags["branden_bucket_seen"], steps: [
        { say: "rowan", text: "\"I'll leave you to your lifebuoy.\"" },
        { say: "branden", text: "\"It's not MINE. I'm *minding* it.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_branden_done" },
    { say: "branden", text: "\"That's enough questions. You're welcome. Go and be ancient somewhere else.\"" },
    { end: true }
  ]
});

scene("deck_branden", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_branden"], end: true },
    { choice: [
      { text: "\"What do you play, Branden?\"", steps: [
        { say: "rowan", text: "\"What do you play, Branden?\"" },
        { say: "branden", text: "\"BURN! Luna Pele! The Flame Dancer! She turns every burning thing into a card! Fireball! Fireball! Heat Wave! You're welcome!\"" },
        { say: "branden", text: "\"National champion! Under tens! Technically *burning* is the best way to win a championship. Nobody else has a plan for the other side of the table.\"" },
        { flag: "branden_said_champion" },
        AFF("branden", 1, "Asked about his deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_branden" },
        { end: true }
      ] }
    ] },
    { text: "You have put your head on one side. Your voice comes out low and quick." },
    { say: "rowan", text: "\"…Luna Pele. Poison burns for the rest of the game. Every burn, a card, up to four a turn. Tazune to shrug off the first two hits of his own fire every turn. Fire Bolts. Fireball on two.\"" },
    { say: "rowan", text: "\"Heat Wave lights the whole board, then Heart of the Mountain draws one per burning target. Flame Avalanche to finish.\" A pause. \"All spells. No board. When the burn runs out there's nothing.\"" },
    { say: "branden", text: "\"There's *always* something!\"" },
    { text: "Offended, but a little too quick." },
    { say: "branden", text: "\"There's — Fiery Slime! There's an egg!\"" },
    { say: "rowan", text: "\"There's an egg.\"" },
    { say: "branden", text: "\"…It's a *very* good egg.\"" },
    { choice: [
      { text: "\"I believe you about the egg.\"", steps: [
        { say: "rowan", text: "\"I believe you about the egg.\"" },
        { say: "branden", text: "\"…You do?\" Deeply suspicious. \"Good. You should. Don't ask to see it. It's shy.\"" }
      ] },
      { text: "\"And when the fire really does run out?\"", steps: [
        { say: "rowan", text: "\"And when the fire really does run out?\"" },
        { say: "branden", text: "\"Then I lose *really fast*. That's also a record.\"" },
        { say: "branden", text: "\"It doesn't run out, though. Not if you do it properly. Nobody ever stays long enough to check.\"" }
      ] }
    ] },
    DECK("branden")
  ]
});

scene("post_branden", {
  steps: [
    DECK("branden"),
    { when: (s)=>s.duels["ferry_branden"] === "won", jump: "won" },
    { text: "Branden has climbed onto the bench and is standing on it, arms up, in the posture of a small and tremendous emperor." },
    { say: "branden", text: "\"FIREBALL! Did you SEE the Fireball? Two heroes! In ONE TURN!\"" },
    { say: "rowan", text: "\"I saw it. I didn't have an answer.\"" },
    { say: "branden", text: "\"Nobody does! That's the *point!* National champion!\"" },
    { text: "He climbs down, suddenly almost shy." },
    { say: "branden", text: "\"…You were the first person today who didn't say it was luck.\"" },
    { choice: [
      { text: "\"It wasn't luck. Luck doesn't hit two heroes.\"", steps: [
        { say: "rowan", text: "\"It wasn't luck. Luck doesn't hit two heroes.\"" },
        { say: "branden", text: "\"That's what I SAID! To the last three!\" He is back on the bench. \"Say it louder! Say it to the one with the parasol!\"" }
      ] },
      { text: "\"Who said it was luck?\"", steps: [
        { say: "rowan", text: "\"Who said it was luck?\"" },
        { say: "branden", text: "\"Everybody. They lose to a ten-year-old and it's always *luck*. Nobody ever lost to a ten-year-old because he was *good*.\"" },
        { say: "branden", text: "\"You did, though. So that's one.\"" }
      ] }
    ] },
    { jump: "after" },
    { label: "won" },
    { text: "Branden is sitting very upright with his arms folded and his chin out, in the posture of a boy who is not going to cry because he is the national champion." },
    { say: "branden", text: "\"You Heat-Waved. I mean, *I* Heat-Waved. You — you put out the Heart of the Mountain. Nobody does that.\"" },
    { say: "rowan", text: "\"You'd burned the whole board. It was the only card that could draw you anything.\"" },
    { say: "branden", text: "\"…\"" },
    { text: "He looks at you for a long, searching moment." },
    { say: "branden", text: "\"That's *rude*. And clever. Do it again tomorrow. When I'm ready.\"" },
    { choice: [
      { text: "\"Tomorrow. Bring everything you've got.\"", steps: [
        { say: "rowan", text: "\"Tomorrow. Bring everything you've got.\"" },
        { say: "branden", text: "\"I'm bringing MORE than I've got. I'm bringing things I haven't even *thought* of yet.\"" }
      ] },
      { text: "\"You nearly had me on the turn before.\"", steps: [
        { say: "rowan", text: "\"You nearly had me on the turn before.\"" },
        { say: "branden", text: "\"I KNOW I did.\" The chin comes down a little. \"…Did I really?\"" },
        { say: "rowan", text: "\"Really.\"" },
        { say: "branden", text: "\"Then technically it was a draw. I'm writing it down as a draw.\"" }
      ] }
    ] },
    // Geschenk nach Rowans Sieg: ein Booster aus dem Ärmel (Turnierpreis der Unter-Zehn).
    { text: "Then he plunges one arm up the enormous sleeve of his jacket, nearly to the shoulder, and comes out with a booster pack. It is sealed, slightly warm, and has clearly been up there a while." },
    { say: "branden", text: "\"Here. Under-tens prize. They give you a whole box when you win, and I always win, so I've got *loads*.\" He shoves it at you. \"The champion gives the other person something. That's a rule. It's *my* rule.\"" },
    { choice: [
      { text: "\"Thanks, Branden. I'll open it on the island.\"", steps: [
        { say: "rowan", text: "\"Thanks, Branden. I'll open it on the island.\"" },
        { say: "branden", text: "\"Tell me if there's a fire one in it.\" A pause. \"If there's a fire one I want it back.\"" },
        { item: "Booster Pack", flag: "branden_gave_booster" }
      ] },
      { text: "\"Keep it, champion. You won it.\"", steps: [
        { say: "rowan", text: "\"Keep it, champion. You won it.\"" },
        { say: "branden", text: "\"I *did* win it.\" He jams it back up the sleeve with enormous dignity, and looks, for one second, secretly relieved." },
        { flag: "branden_gift_refused" }
      ] }
    ] },
    { label: "after" },
    { flag: "branden_said_champion" },
    AFF("branden", 1, "Talked it through")
  ]
});

scene("ferry_eberhart", {
  steps: [
    { when: (s)=>!!s.flags["met_eberhart"], jump: "again" },
    { text: "The first-years' trunks are lashed in a stack against the forward bulkhead, under a tarpaulin that has come loose at one corner. Somebody is putting this right." },
    { text: "He is tall and heavy in the shoulder, with cropped ash-blond hair and his red jacket buttoned to the throat, the blue collar squared. An old, straight scar runs across his left cheek." },
    { text: "He has a steamer trunk in both arms, a trunk with somebody else's initials on it, and he is waiting for the ship to finish rolling before he sets it down." },
    { text: "The ship finishes. The trunk goes down without a sound. He moves it a finger's width with the side of his shoe, until its edge agrees with the one beneath." },
    { text: "At the top of the stack, a small leather case begins, slowly, to slide." },
    { choice: [
      { text: "Catch the case before it goes.", steps: [
        { text: "You get a hand under it. It is far heavier than a case that size has any right to be. He takes the other end without a word." },
        { say: "eberhart", alias: "Boy with a scar", text: "\"Thumbs outside the handle. If it slips, you keep them.\"" },
        { text: "You move your thumbs." },
        { say: "eberhart", alias: "Boy with a scar", text: "\"Good. Down.\"" },
        AFF("eberhart", 2, "Caught the case")
      ] },
      { text: "\"That one at the top is about to go.\"", steps: [
        { say: "rowan", text: "\"That one at the top is about to go.\"" },
        { text: "He looks, takes one step and stops it with the flat of his hand." },
        { say: "eberhart", alias: "Boy with a scar", text: "\"Yes. Thank you.\"" },
        AFF("eberhart", 1, "Gave a useful warning")
      ] },
      { text: "\"Are you crew? You don't look like crew.\"", steps: [
        { say: "rowan", text: "\"Are you crew? You don't look like crew.\"" },
        { text: "He stops the case with one hand, without looking at it." },
        { say: "eberhart", alias: "Boy with a scar", text: "\"No.\"" },
        { text: "A pause, in which you understand that the question has been answered in full." },
        { say: "rowan", text: "\"Then why are you stacking the luggage?\"" },
        { say: "eberhart", alias: "Boy with a scar", text: "\"It was not square.\"" }
      ] }
    ] },
    { text: "He seats the case, ties down the loose corner of the tarpaulin with a knot that takes him two seconds, and straightens. Hands behind his back. He regards you. It is not unfriendly. It is the look of somebody working out where your weight is." },
    { say: "rowan", text: "\"Rowan.\"" },
    { text: "A short, exact bow of the head." },
    { say: "eberhart", alias: "Boy with a scar", text: "\"Düsterwald. Eberhart.\"" },
    { text: "The plain grey trunk at the end of the row, squared to the bulkhead, says the rest in white stencil: E. v. DÜSTERWALD — RARE 101." },
    MET("eberhart", "Eberhart von Düsterwald"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Did you SEE that? He picked up a whole trunk like it was a SANDWICH!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Good knot.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], text: "Eberhart looks at Baylee, and then at Baylee's hands, and gives him one nod." },
    { add: { ferry_talked: 1 } },
    NOTE("eberhart", "Stacks other people's luggage square without being asked."),
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "eberhart", text: "\"You are the name in ink. In the lounge they are betting on you. I do not bet.\"" },
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "eberhart", text: "\"Also you have no jacket.\"" },
    { when: (s)=>!s.flags["ship_knows_wildcard"], say: "eberhart", text: "\"You have no jacket.\"" },
    { choice: [
      { text: "\"It comes later, they tell me. I've been cold since three this morning.\"", steps: [
        { say: "rowan", text: "\"It comes later, they tell me. I've been cold since three this morning.\"" },
        { say: "eberhart", text: "\"And you did not go inside.\"" },
        { say: "rowan", text: "\"The lounge is full of people.\"" },
        { say: "eberhart", text: "\"Yes.\" It is the first thing he has said that sounds like agreement." },
        AFF("eberhart", 1, "Also avoids the lounge")
      ] },
      { text: "\"People keep telling me that.\"", steps: [
        { say: "rowan", text: "\"People keep telling me that.\"" },
        { say: "eberhart", text: "\"Then I will not say it again.\"" },
        { say: "eberhart", text: "\"It is a fact about today only. Tomorrow you will have one, and they must find something else.\"" }
      ] },
      { text: "\"What's the 'v' for, on your trunk?\"", steps: [
        { say: "rowan", text: "\"What's the 'v' for, on your trunk?\"" },
        { say: "eberhart", text: "\"For forms.\"" },
        { text: "The subject closes like a lid. Nothing in his face has moved; it is simply no longer open." },
        { say: "rowan", text: "\"Understood.\"" },
        { say: "eberhart", text: "\"Thank you.\"" },
        AFF("eberhart", -1, "Asked about the 'von'"),
        { flag: "eberhart_von_asked" }
      ] }
    ] },
    { say: "eberhart", text: "\"Do you train?\"" },
    { say: "rowan", text: "\"At what?\"" },
    { say: "eberhart", text: "\"At anything.\"" },
    { choice: [
      { text: "\"Cards. Every night, for years. On a screen; never once on a table.\"", steps: [
        { say: "rowan", text: "\"Cards. Every night, for years. On a screen; never once on a table.\"" },
        { say: "eberhart", text: "\"How many hours?\"" },
        { say: "rowan", text: "\"Four. Five, when I couldn't sleep.\"" },
        { say: "eberhart", text: "\"That is training. The table is only a different floor.\"" },
        AFF("eberhart", 2, "Trains every night"),
        { flag: "eberhart_knows_screen" }
      ] },
      { text: "\"Does staying awake count?\"", steps: [
        { say: "rowan", text: "\"Does staying awake count?\"" },
        { say: "eberhart", text: "\"No.\"" },
        { say: "eberhart", text: "\"It is the opposite of training.\" He looks at you a moment longer. \"You should sleep. This is advice, not a criticism.\"" }
      ] },
      { text: "\"Not the way you do, by the look of you.\"", steps: [
        { say: "rowan", text: "\"Not the way you do, by the look of you.\"" },
        { say: "eberhart", text: "\"There is only one way. Every day. What one does it at matters less than people think.\"" }
      ] }
    ] },
    { say: "eberhart", text: "\"I train at five. This deck is forty-one paces round. I measured it at six, before the others came up.\"" },
    { text: "He glances at the trunks, which are now beyond criticism, and settles beside them at something like parade rest. The wind does nothing at all to his hair." },
    { say: "eberhart", text: "\"If you have a question, ask it. I do not make conversation. This is not unfriendliness.\"" },
    { time: 8 },
    { flag: "eberhart_ferry_met" },
    { scene: "chat_eberhart" },
    { end: true },
    { label: "again" },
    { text: "Eberhart is where you left him, beside the trunks, hands behind his back. Not one of them has moved. They would not dare." },
    { say: "eberhart", text: "\"Rowan.\"" },
    { time: 3 },
    { when: (s)=>!!s.flags["chat_eberhart_1"] && !!s.flags["chat_eberhart_2"] && (!s.flags["chat_mikoto_offered"] || !!s.flags["chat_eberhart_3"]), jump: "nothing_left" },
    { choice: [
      { text: "\"I have a question. You said to ask.\"", steps: [
        { say: "rowan", text: "\"I have a question. You said to ask.\"" },
        { say: "eberhart", text: "\"I did.\"" },
        { scene: "chat_eberhart" }
      ] },
      { text: "Nod, and leave him to his post.", steps: [
        { text: "You nod. He nods. It appears to be a complete conversation." }
      ] }
    ] },
    { end: true },
    { label: "nothing_left" },
    { text: "You nod. He nods. It appears to be a complete conversation, and not a bad one." }
  ]
});

scene("chat_eberhart", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_eberhart_1"] && !!s.flags["chat_eberhart_2"] && (!s.flags["chat_mikoto_offered"] || !!s.flags["chat_eberhart_3"]), jump: "done" },
    { choice: [
      { text: "\"The scar. Is it rude to ask?\"", when: (s)=>!s.flags["chat_eberhart_1"], steps: [
        { say: "rowan", text: "\"The scar. Is it rude to ask?\"" },
        { say: "eberhart", text: "\"No. It is rude to look for a long time and then not ask. You asked.\"" },
        { say: "eberhart", text: "\"Academic fencing. One stands at a measured distance. One does not step back, and one does not move the head. The other man has a sharp blade, and so have you.\"" },
        { choice: [
          { text: "\"Did it hurt?\"", steps: [
            { say: "rowan", text: "\"Did it hurt?\"" },
            { say: "eberhart", text: "\"Yes.\"" },
            { say: "eberhart", text: "\"That is not the important part of it.\"" }
          ] },
          { text: "\"Did you win?\"", steps: [
            { say: "rowan", text: "\"Did you win?\"" },
            { say: "eberhart", text: "\"Nobody wins. One stands, or one does not stand. I stood.\"" }
          ] },
          { text: "\"That sounds insane.\"", steps: [
            { say: "rowan", text: "\"That sounds insane.\"" },
            { say: "eberhart", text: "\"Yes. Many say so.\" He is entirely untroubled. \"Mostly they have not tried to stand still at anything.\"" }
          ] }
        ] },
        { say: "eberhart", text: "\"It is the mark of having stood still. I do not mind it. If I had flinched, it would be on a different place, and that I would mind.\"" },
        { text: "He considers you, level, for a slow count of three." },
        { say: "eberhart", text: "\"Is there something you do not step back from?\"" },
        { say: "rowan", text: "\"Cards. That's about the whole list.\"" },
        { say: "eberhart", text: "\"One thing is a list.\"" },
        AFF("eberhart", 2, "Asked directly"),
        { flag: "chat_eberhart_1" },
        NOTE("eberhart", "The scar is from academic fencing. He calls it the mark of having stood still."),
        { time: 2 }
      ] },
      { text: "\"Forty-one paces at five in the morning. What does that look like?\"", when: (s)=>!s.flags["chat_eberhart_2"], steps: [
        { say: "rowan", text: "\"Forty-one paces at five in the morning. What does that look like?\"" },
        { say: "eberhart", text: "\"Running. Then strength. Then forty minutes with the deck: shuffle, cut, deal, and again. The hands must do it without me.\"" },
        { say: "rowan", text: "\"Forty minutes of shuffling.\"" },
        { say: "eberhart", text: "\"A sloppy shuffle is bad footwork. One sees at once who has not done the work.\"" },
        { say: "eberhart", text: "\"It is not a game to me. This is not an insult to those for whom it is.\"" },
        { text: "His eyes go to the square shape of the deck box in your pocket, and stay there." },
        { say: "eberhart", text: "\"Show me. Shuffle.\"" },
        { choice: [
          { text: "Take out your deck and shuffle.", steps: [
            { text: "You take the deck out. You have done this ten thousand times, at a desk, at three in the morning. Here, with somebody watching, your fingers go stupid on the second riffle and a card turns its face up to the sky." },
            { say: "eberhart", text: "\"Stop.\"" },
            { text: "He says it quietly. He picks the card up, squares it into your deck and hands the deck back." },
            { say: "eberhart", text: "\"The hands know it. They are only not used to eyes. That is not a fault of character. It is a thing to train: ten minutes each day with somebody watching. Anybody. A gull.\"" },
            { say: "rowan", text: "\"A gull.\"" },
            { say: "eberhart", text: "\"It has eyes.\"" },
            AFF("eberhart", 2, "Shuffled when asked"),
            { flag: "eberhart_saw_shuffle" },
            NOTE("eberhart", "Saw your hands shake on the shuffle and called it a thing to train, not a fault.")
          ] },
          { text: "\"Not with somebody watching.\"", steps: [
            { say: "rowan", text: "\"Not with somebody watching.\"" },
            { say: "eberhart", text: "\"Then the first time somebody watches will be the time it counts. That is also a choice.\"" },
            { say: "eberhart", text: "\"I do not press.\"" }
          ] },
          { text: "\"You first.\"", steps: [
            { say: "rowan", text: "\"You first.\"" },
            { text: "He takes a deck from his inside pocket. The shuffle is like a drill movement: square, exact, entirely joyless and without a single fault. It lasts eight seconds." },
            { say: "eberhart", text: "\"So. Now you.\"" },
            { say: "rowan", text: "\"…Later.\"" },
            { say: "eberhart", text: "\"Later is not a time. Name one.\"" },
            { when: (s)=>!s.flags["isle_eberhart_done"], say: "rowan", text: "\"On the island. This week.\"" },
            { when: (s)=>!!s.flags["isle_eberhart_done"], say: "rowan", text: "\"Tomorrow. After supper.\"" },
            { say: "eberhart", text: "\"Good. I will ask.\"" },
            AFF("eberhart", 1, "Named a time"),
            { flag: "eberhart_shuffle_owed" }
          ] }
        ] },
        AFF("eberhart", 1, "Asked about the training"),
        { flag: "chat_eberhart_2" },
        NOTE("eberhart", "Trains at five every morning: running, strength, then forty minutes of shuffling. To him it is not a game."),
        { time: 2 }
      ] },
      { text: "\"Mikoto, the boy with the gull. He says you carried his trunk up the gangway.\"", when: (s)=>!!s.flags["chat_mikoto_offered"] && !s.flags["chat_eberhart_3"], steps: [
        { say: "rowan", text: "\"Mikoto, the boy with the gull. He says you carried his trunk up the gangway.\"" },
        { say: "eberhart", text: "\"It stood in the way. He was speaking with the ticket man and laughing. Somebody would have fallen.\"" },
        { say: "eberhart", text: "\"Afterwards I read the label. Yamaguchi, Rare 101. So it is my roommate's trunk. This was not planned.\"" },
        { say: "rowan", text: "\"He wanted to thank you. You'd gone.\"" },
        { say: "eberhart", text: "\"He has thanked me since. He used a name.\"" },
        { when: (s)=>!!s.flags["mikoto_said_ebi"], say: "rowan", text: "\"Ebi.\"" },
        { when: (s)=>!!s.flags["mikoto_said_ebi"], say: "eberhart", text: "\"…You have heard it.\"" },
        { when: (s)=>!s.flags["mikoto_said_ebi"], say: "rowan", text: "\"What name?\"" },
        { when: (s)=>!s.flags["mikoto_said_ebi"], say: "eberhart", text: "\"I will not repeat it.\"" },
        { text: "The scar shifts very slightly. It is possible that the cheek under it has clenched." },
        { say: "eberhart", text: "\"I have asked him not to. I expect that he will continue.\"" },
        { choice: [
          { text: "\"He doesn't mean anything by it. Or by the laughing.\"", steps: [
            { say: "rowan", text: "\"He doesn't mean anything by it. Or by the laughing.\"" },
            { say: "eberhart", text: "\"I know. He laughed at a gull also, and at a stair. It is not at anybody. It is like a cough.\"" },
            AFF("eberhart", 2, "Spoke up for Yamaguchi")
          ] },
          { text: "\"Will you ask for a different room?\"", steps: [
            { say: "rowan", text: "\"Will you ask for a different room?\"" },
            { say: "eberhart", text: "\"No. The letter says 101 and it says Yamaguchi. One does not change the draw because the opponent talks.\"" },
            { say: "eberhart", text: "\"He is not an opponent. It was a comparison.\"" }
          ] },
          { text: "\"It rather suits you.\"", when: (s)=>!!s.flags["mikoto_said_ebi"], steps: [
            { say: "rowan", text: "\"It rather suits you.\"" },
            { say: "eberhart", text: "\"No.\"" },
            { text: "He looks at you. You find that you are counting. Four seconds; Mikoto had it exactly right." },
            { say: "eberhart", text: "\"It does not.\"" },
            AFF("eberhart", -1, "Liked the nickname")
          ] }
        ] },
        { say: "eberhart", text: "\"He apologises to everybody. Somebody has taught him that. If a person mocks him for the laughing, you may tell me which person.\"" },
        { text: "He says it at exactly the level of everything else, which is what makes you believe it." },
        { flag: "chat_eberhart_3" },
        REL("mikoto", "eberhart"),
        NOTE("eberhart", "Shares Rare Hall 101 with Mikoto, who has a nickname for him that he has asked not to hear. Would not let anyone mock Mikoto."),
        { time: 2 }
      ] },
      { text: "\"That's all. Thank you.\"", steps: [
        { say: "rowan", text: "\"That's all. Thank you.\"" },
        { say: "eberhart", text: "\"Good.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_eberhart_done" },
    { say: "eberhart", text: "\"That is all I have. The questions were correctly asked.\"" },
    { text: "From him, you gather, this is a warm goodbye." },
    { end: true }
  ]
});

scene("isle_pippa", {
  steps: [
    { when: (s)=>!!s.flags["isle_pippa_done"], jump: "later" },
    { text: "Somebody is lying flat on her stomach along the rim of the fountain, with a heavy old film camera held an inch above the water. Strawberry-orange hair, a yellow bow tie, a black jacket with a blue collar and pockets that bulge." },
    { when: (s)=>!s.flags["met_pippa"], say: "pippa", alias: "Girl with a camera", text: "\"Don't walk round. You're in the reflection, and you're the best thing in it. …There. Got you. You're Vance. They read you out after Rare had been marched off, and I hear half the Quad turned round to look. I missed it. I'm still cross.\"" },
    { ...PHOTO("fountain_reflection", "Rowan in the fountain's reflection (roll three)", { who: ["rowan"] }), when: (s)=>!s.flags["met_pippa"] },
        { when: (s)=>!s.flags["met_pippa"], say: "pippa", alias: "Girl with a camera", text: "\"Pippa Lund. I'm the photographer. Nobody asked me to be. It's film, so you'll see it in a week, and you'll hate it.\"" },
    { when: (s)=>!s.flags["met_pippa"], say: "rowan", text: "\"Rowan. Though apparently you knew.\"" },
    { when: (s)=>!!s.flags["met_pippa"], say: "pippa", text: "\"Rowan! Don't walk round. You're in the reflection, and it's better with you in it. …There. That's roll three, and we've not been here a day.\"" },
    { ...PHOTO("fountain_reflection", "Rowan in the fountain's reflection (roll three)", { who: ["rowan"] }), when: (s)=>!!s.flags["met_pippa"] },
    { when: (s)=>!!s.flags["pippa_photographed"], say: "pippa", text: "\"Roll two's got me on it, somewhere near the end. Your one.\" She says it to the water. \"I've been very good and not thought about it for nearly an hour.\"" },
    { ...PHOTO("pippa_by_rowan", "Pippa in front of the island, trying not to pose (taken by Rowan, with her camera)", { who: ["pippa"] }), when: (s)=>!!s.flags["pippa_photographed"] },
    { when: (s)=>!s.flags["pippa_photographed"] && !!s.flags["pippa_owes_portrait"], say: "pippa", text: "\"And before you say it: yes, on the island, I know what I said. This is still a roll that matters. I'm working up to a bad one.\"" },
    MET("pippa", "Pippa Lund"),
    { text: "She rolls over and sits up on the rim, wringing out one cuff that has gone into the fountain without her noticing." },
    { say: "pippa", text: "\"They've given me a north window. North! Nobody's ever done anything that kind for me on purpose. And a roommate with a parasol, who has asked me, very politely, to stop telling her what the light is doing to her.\"" },
    { say: "pippa", text: "\"But the thing I wanted was this morning. Everybody looked at the Chancellor. I looked at everybody looking. That's the roll.\"" },
    PHOTO("quad_year_looking", "The whole year looking at the Chancellor (a roll of everybody looking)", { who: [], off: true }),
    { choice: [
      { text: "\"What did we look like?\"", steps: [
        { say: "rowan", text: "\"What did we look like?\"" },
        { say: "pippa", text: "\"Like thirty-eight people being told they're exceptional, and each one wondering who the exception is.\"" },
        { say: "pippa", text: "\"You looked at your shoes, by the way. I've got it. It's a good honest pair of shoes.\"" },
        PHOTO("quad_rowan_shoes", "Rowan at the Chancellor's address, looking at his shoes", { who: ["rowan"], off: true }),
        AFF("pippa", 1, "Asked what she saw")
      ] },
      { text: "\"And who was looking at you?\"", steps: [
        { say: "rowan", text: "\"And who was looking at you?\"" },
        { say: "pippa", text: "\"The fountain. It's very attentive.\" She flicks water at it. \"…Don't do that. That's the question after the one I've got an answer for.\"" },
        AFF("pippa", 2, "Asked about her")
      ] },
      { text: "\"Not one day here and you're already soaked.\"", steps: [
        { say: "rowan", text: "\"Not one day here and you're already soaked.\"" },
        { say: "pippa", text: "\"One sleeve! One sleeve is a working sleeve. Wait till I find the tide pools. I'll come back to supper in a bucket.\"" }
      ] }
    ] },
    { say: "pippa", text: "\"How's the row? I haven't been down. I hear there's a woman with a ladle and that nobody argues with her.\"" },
    { say: "rowan", text: "\"Nobody's tried yet.\"" },
    { say: "pippa", text: "\"Good. I'll come down and photograph the first one who does. Tell them to wait for me.\"" },
    NOTE("pippa", "Has a north-facing room in Rare Hall and a roommate with a parasol. Photographed the whole year listening to the Chancellor."),
    { flag: "isle_pippa_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Pippa is on her knees on the gravel now, photographing the fountain's shadow instead of the fountain." },
    PHOTO("fountain_shadow", "The fountain's shadow on the gravel, a hand's width further on", { who: [] }),
    { say: "pippa", text: "\"It moves, you know. A whole hand's width since you were last here. I'm the only person on this island who's been keeping an eye on it.\"" },
    { say: "pippa", text: "\"Go on, you've got places to be. You walk like it. I'll get you from behind.\"" },
    PHOTO("rowan_from_behind", "Rowan walking off across the Quad, from behind", { who: ["rowan"], off: true }),
    { time: 3 }
  ]
});

scene("isle_mikoto", {
  steps: [
    { when: (s)=>!!s.flags["isle_mikoto_done"], jump: "later" },
    { text: "On the steps of Rare Hall a thin boy in round glasses is standing beside the space where, evidently, a trunk used to be." },
    { text: "He has a notebook open and a pencil on a string, and he is looking at the gap. A few steps off, a tall boy with a scar on his cheek is going in through the door with a trunk on his shoulder." },
    { when: (s)=>!s.flags["met_mikoto"], say: "mikoto", alias: "Apologetic boy", text: "\"Sorry — was that yours? No. No, it was mine. He's taken mine. Sorry. You're Rowan Vance, they read it out, I wrote it down.\"" },
    { when: (s)=>!s.flags["met_mikoto"], text: "He laughs, high and helpless, and stops as though somebody had put a hand over it." },
    { when: (s)=>!s.flags["met_mikoto"], say: "mikoto", alias: "Apologetic boy", text: "\"Mikoto Yamaguchi. I laugh when I'm frightened. It isn't funny. I've got a list of what could go wrong today, and 'tall person carries my trunk away' is on it. It's got two ticks now.\"" },
    { when: (s)=>!!s.flags["met_mikoto"] && !!s.flags["mikoto_rowrow"], say: "mikoto", text: "\"Row-Row! He's done it again. The trunk. I was going to ask him this time, I had it written down, and he just — it went.\"" },
    { when: (s)=>!!s.flags["met_mikoto"] && !s.flags["mikoto_rowrow"] && !!s.flags["chat_mikoto_offered"], say: "mikoto", text: "\"Rowan! He's done it again. The trunk. I was going to ask him this time, I had it written down, and he just — it went.\"" },
    { when: (s)=>!!s.flags["met_mikoto"] && !s.flags["mikoto_rowrow"] && !s.flags["chat_mikoto_offered"], say: "mikoto", text: "\"Rowan! Sorry. He's taken my trunk. The tall one. I was going to ask him, I had it written down, and he just — it went.\"" },
    MET("mikoto", "Mikoto Yamaguchi"),
    { when: (s)=>!!s.flags["mikoto_sandwich"] && (s.minutes || 0) >= 810, say: "mikoto", text: "\"They gave us lunch, by the way. At one, like the letter said. It wasn't as good as the cheese roll. I've noted that.\"" },
    { say: "mikoto", text: "\"That's my roommate. Eberhart. Room 101. I've been up once. His half is already finished: bed made, a sheet of paper pinned to the wall with times on it, absolutely square. My half has got me in it.\"" },
    { say: "mikoto", text: "\"He said one thing. 'I rise at five. You need not.' So I've decided there's a line down the middle of the room. He doesn't know about it. It's for his sake.\"" },
    { choice: [
      { text: "\"A line he doesn't know about isn't much of a rule.\"", steps: [
        { say: "rowan", text: "\"A line he doesn't know about isn't much of a rule.\"" },
        { say: "mikoto", text: "\"It's the best kind! Nobody can tell me I've got it wrong.\"" },
        { say: "mikoto", text: "\"…I could tell him. I could write it out and leave it on his side. No. On the line. Exactly on it.\"" },
        AFF("mikoto", 1, "Thought it through with him")
      ] },
      { text: "\"He carried your trunk before you could ask. I'd say the room's going to be all right.\"", steps: [
        { say: "rowan", text: "\"He carried your trunk before you could ask. I'd say the room's going to be all right.\"" },
        { say: "mikoto", text: "\"He did, didn't he? And up the gangway this morning as well. That's twice. Once could have been a mistake.\"" },
        { say: "mikoto", text: "\"I'm putting it on the other list.\" He turns the notebook over and opens it from the back. \"That's the nice one. It's short. It's getting longer.\"" },
        AFF("mikoto", 2, "Made the room sound safe")
      ] },
      { text: "\"What did you say back to him?\"", when: (s)=>!!s.flags["mikoto_said_ebi"], steps: [
        { say: "rowan", text: "\"What did you say back to him?\"" },
        { say: "mikoto", text: "\"'Thank you, Ebi.' It got out again. He looked at me for the four seconds.\"" },
        { say: "mikoto", text: "\"But he didn't say 'no' this time. He only breathed. I think that's progress. I've written 'breathed'.\"" }
      ] }
    ] },
    { text: "The tall boy comes out again, empty-handed, passes within a yard of you both, and picks up somebody else's trunk without breaking step." },
    { say: "mikoto", text: "\"And there are placement duels this afternoon. On a real table, in a dome, with people. That's number one on my list of things that could go wrong. I asked when Rare is called and they said 'you'll hear', which isn't a time.\"" },
    { when: (s)=>!!s.flags["placement_done"], say: "mikoto", text: "\"You've had yours. You're still walking about. That helps, actually. I'm going to look at you and think: he's still walking about.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "rowan", text: "\"I haven't had mine either. We can both not know.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "mikoto", text: "\"Oh. Oh, good. It's much better with two.\"" },
    NOTE("mikoto", "Has drawn a private line down the middle of Rare Hall 101, because his roommate rises at five."),
    REL("mikoto", "eberhart"),
    { flag: "isle_mikoto_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Mikoto is sitting on the bottom step of Rare Hall with the notebook on his knees, opened from the back." },
    { say: "mikoto", text: "\"I'm allowed to sit here. I asked the porter. He said 'it's a step, son', so I think that's a yes.\"" },
    { say: "mikoto", text: "\"Go on. I'm all right. I've got eleven things on the nice side today and it isn't even supper.\"" },
    { time: 3 }
  ]
});

scene("isle_eberhart", {
  steps: [
    { when: (s)=>!!s.flags["isle_eberhart_done"], jump: "later" },
    { text: "The trunks of Rare Hall stand in a row on the gravel before the door, and the row is getting shorter." },
    { text: "A tall boy with cropped ash-blond hair, a scar across his left cheek and his red jacket buttoned to the throat comes down the steps empty-handed, takes the next one by both handles and lifts it as though it had asked him to." },
    { text: "A grey cat is asleep on the third step. He goes round it, each time, by exactly the same margin." },
    { when: (s)=>!s.flags["met_eberhart"], say: "eberhart", alias: "Boy with a scar", text: "\"Vance. You were read out on the Quad. The Wildcard.\"" },
    { when: (s)=>!s.flags["met_eberhart"], text: "He sets the trunk down, straightens, and gives a short, exact bow of the head." },
    { when: (s)=>!s.flags["met_eberhart"], say: "eberhart", alias: "Boy with a scar", text: "\"Düsterwald. Eberhart. Rare Hall. These are not my trunks. They were in the way of the door.\"" },
    { when: (s)=>!!s.flags["met_eberhart"], say: "eberhart", text: "\"Rowan. You have a jacket now. Good. That subject is closed.\"" },
    { when: (s)=>!!s.flags["eberhart_shuffle_owed"], say: "eberhart", text: "\"You named a time. 'On the island, this week.' We are on the island. I mention it only so that you know I have kept count.\"" },
    { when: (s)=>!!s.flags["eberhart_saw_shuffle"], say: "eberhart", text: "\"Ten minutes each day, with somebody watching. Today is a day. I do not ask whether you have begun; I say only that it is not yet evening.\"" },
    MET("eberhart", "Eberhart von Düsterwald"),
    { say: "eberhart", text: "\"There are eleven left. The porter has a bad knee and says that he has not. So.\"" },
    { choice: [
      { text: "Take the other handle of the next one.", steps: [
        { text: "You take the other handle. It is the heaviest thing you have lifted since the mainland, and he has been doing it alone. He glances at your hands once." },
        { say: "eberhart", text: "\"Thumbs outside. Good. On the step, the left foot first; the cat does not move.\"" },
        { text: "The cat does not move. You carry the trunk over it like a bridge and set it down inside, square to the wall. He adjusts it by a finger's width anyway." },
        { say: "eberhart", text: "\"That was correctly carried. Ten left.\"" },
        AFF("eberhart", 2, "Took the other handle")
      ] },
      { text: "\"Whose cat is that?\"", steps: [
        { say: "rowan", text: "\"Whose cat is that?\"" },
        { say: "eberhart", text: "\"It belongs to the Hall. Not to me.\"" },
        { say: "rowan", text: "\"You've walked round it six times.\"" },
        { say: "eberhart", text: "\"It was there first. That is a different thing from its being mine.\"" },
        AFF("eberhart", 1, "Noticed the cat")
      ] },
      { text: "\"Nobody asked you to do this, did they?\"", steps: [
        { say: "rowan", text: "\"Nobody asked you to do this, did they?\"" },
        { say: "eberhart", text: "\"No.\"" },
        { say: "eberhart", text: "\"If one waits to be asked, the trunk is still on the gravel and one has also waited. I do not see the gain.\"" }
      ] }
    ] },
    { say: "eberhart", text: "\"The placement duels are this afternoon. I have walked to the domes and back. Six hundred and ten paces from this door. The tables are good. The chairs are too low.\"" },
    { when: (s)=>!!s.flags["placement_won"], say: "eberhart", text: "\"I am told that you won yours. Then the hands held when it counted. Remember which part of you did that.\"" },
    { when: (s)=>!!s.flags["placement_lost"], say: "eberhart", text: "\"I am told that you lost yours. One bout. You stood at the table to the end; that is the part one can train from.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "eberhart", text: "\"When you are called: sit forward, both feet on the floor, and shuffle before you look at him. This is advice. You did not ask for it.\"" },
    NOTE("eberhart", "Carried the Rare Hall trunks in by himself. Walks round the Hall's cat and says it is not his."),
    { flag: "isle_eberhart_done" },
    { time: 5 },
    { when: (s)=>!s.flags["eberhart_ferry_met"] || (!!s.flags["chat_eberhart_1"] && !!s.flags["chat_eberhart_2"] && (!s.flags["chat_mikoto_offered"] || !!s.flags["chat_eberhart_3"])), end: true },
    { choice: [
      { text: "\"On the ship you said to ask, if I had a question. I still have one.\"", steps: [
        { say: "rowan", text: "\"On the ship you said to ask, if I had a question. I still have one.\"" },
        { say: "eberhart", text: "\"Then ask it.\" He puts the trunk down. This, you understand, is a courtesy." },
        { scene: "chat_eberhart" }
      ] },
      { text: "Leave him to the trunks.", steps: [] }
    ] },
    { end: true },
    { label: "later" },
    { text: "The gravel before Rare Hall is empty. Eberhart stands beside the door at parade rest. The grey cat has moved from the third step to a spot four inches from his left shoe, and is washing." },
    { say: "eberhart", text: "\"It is not mine.\"" },
    { text: "You had not said anything." },
    { time: 3 }
  ]
});

scene("isle_branden", {
  steps: [
    { when: (s)=>!!s.flags["isle_branden_done"], jump: "later" },
    { text: "On the lawn before the Trial Domes the first-years with the white-and-gold collars are waiting to be called, and are doing it quietly, a careful distance apart. All but one." },
    { text: "A boy of perhaps ten, with flame-orange hair standing up in spikes and a jacket three sizes too big, is walking along the stone kerb of the path with his arms out, counting." },
    { when: (s)=>!s.flags["met_branden"], say: "branden", alias: "Flame-haired kid", text: "\"Forty-one, forty-two — YOU! You're the Wildcard! They read you out! Your jacket *fits*! Mine's *enormous*, do you want to swap? No. Technically I need it.\"" },
    { when: (s)=>!s.flags["met_branden"], say: "branden", alias: "Flame-haired kid", text: "\"Branden Sunflower. National champion. Under tens. Two years running. I'm ten and three quarters and I'm the youngest one here, so everybody else is ancient. You're ancient.\"" },
    { when: (s)=>!s.flags["met_branden"], say: "rowan", text: "\"Rowan. Nineteen.\"" },
    { when: (s)=>!s.flags["met_branden"], say: "branden", alias: "Flame-haired kid", text: "\"*Nineteen.* You're holding up very well.\"" },
    { when: (s)=>!!s.flags["met_branden"] && !!s.flags["branden_prank_buddy"], say: "branden", text: "\"Forty-one, forty-two — TIMEKEEPER! You've got a *jacket*! Time me! No, don't, there's nothing to time, that's the whole *problem*.\"" },
    { when: (s)=>!!s.flags["met_branden"] && !s.flags["branden_prank_buddy"], say: "branden", text: "\"Forty-one, forty-two — Jacketless! You're not jacketless! They *fixed* you. That's the only interesting thing that's happened for an *hour*.\"" },
    MET("branden", "Branden Sunflower"),
    { text: "He hops off the kerb and lands with both feet together, to nobody's applause." },
    { say: "branden", text: "\"They're calling us in *alphabet order*. I'm an S. S is practically last. I've been here since for ever and I'm not allowed a lifebuoy and nobody will play me first for practice because they're all *concentrating*.\"" },
    { when: (s)=>!!s.flags["met_georgie"], say: "branden", text: "\"Georgie's an S *as well*, and she's still before me. Sa, Su. She gets *everything* first. She's over there holding her box in both hands like it's going to fly off.\"" },
    { when: (s)=>!!s.flags["branden_marshmallow_pact"], say: "branden", text: "\"And LOOK.\" He points over the domes at the mountain. \"It's *right there*. You can see the top. Have you got the marshmallows? You said. No take-backs.\"" },
    { when: (s)=>!!s.flags["beat_branden"], say: "branden", text: "\"I'm ready, by the way. For tomorrow. I said tomorrow and I meant it. I've thought of two new things already.\"" },
    { text: "He picks a daisy out of the lawn, looks at it, and puts it in his top pocket, where it vanishes entirely." },
    { say: "branden", text: "\"…There isn't an under-tens here. Did you know? I asked. There's just *everybody*. All in one go.\"" },
    { choice: [
      { text: "\"Then you're not the under-tens champion today. You're just the one with the fire.\"", when: (s)=>!!s.flags["deck_known_branden"], steps: [
        { say: "rowan", text: "\"Then you're not the under-tens champion today. You're just the one with the fire.\"" },
        { say: "branden", text: "\"…Just the one with the fire.\" He tries it out, chin up. \"That's *better*. That's actually better. I'm having that. You can't have it back.\"" },
        AFF("branden", 2, "Gave him a better title")
      ] },
      { text: "\"Are you nervous?\"", steps: [
        { say: "rowan", text: "\"Are you nervous?\"" },
        { say: "branden", text: "\"NO. Champions don't get nervous.\"" },
        { say: "branden", text: "\"…My tummy's a bit nervous. That's separate. It's not *me*.\" He looks at you sideways. \"Don't tell the ancient ones.\"" },
        AFF("branden", 2, "Asked, and kept it quiet")
      ] },
      { text: "\"Everybody in one go. So if you win, you've beaten everybody.\"", steps: [
        { say: "rowan", text: "\"Everybody in one go. So if you win, you've beaten everybody.\"" },
        { say: "branden", text: "\"I KNOW. That's what I said to the one with the white gloves. He didn't even look round. He's going to be *so* embarrassed.\"" },
        AFF("branden", 1, "Saw it his way")
      ] }
    ] },
    { when: (s)=>!!s.flags["placement_won"], say: "branden", text: "\"You won yours, I heard. Don't make a face about it. I'm going to win mine *louder*.\"" },
    { when: (s)=>!!s.flags["placement_lost"], say: "branden", text: "\"You lost yours, I heard. That's fine. You're old, you were probably tired. I'll win one for both of us.\"" },
    { say: "branden", text: "\"Forty-two steps along the kerb. I'm going to do it backwards now. Watch. No — don't watch, it's better if you just *happen* to see.\"" },
    NOTE("branden", "Waiting for his placement duel by the Trial Domes. Has found out there is no under-tens league here, only everybody."),
    { flag: "isle_branden_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Branden is walking along the kerb backwards, very slowly, with his tongue between his teeth." },
    { say: "branden", text: "\"Don't TALK to me, I'm on thirty-something. …Have they said S yet? They haven't said S. I'd have *heard* S.\"" },
    { say: "branden", text: "\"Go away. Nicely. Come back when I've won.\"" },
    { time: 3 }
  ]
});
