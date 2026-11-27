// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS, ALPHA } = helpers;
/* ───────────────────────── SUNNY ───────────────────────── */
scene("ferry_sunny", {
  steps: [
    { when: (s)=>!!s.flags["met_sunny"], jump: "again" },
    { text: "A tall girl is sitting on the lower bar of the rail with her bare feet dangling over the wake." },
    { text: "A red jacket with a blue collar hangs open over a swimsuit, a towel is slung round her neck like a scarf, and there are pale rings round her eyes where goggles usually live. Her ponytail is wet, although it has not rained." },
    { text: "She is, at the exact moment you notice her, doing something with a deck of cards that involves flipping half of it into the air and catching it behind her back." },
    { text: "She catches it. Every card. She does not look at them." },
    { text: "She sees you looking and grins with her whole face." },
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "sunny", alias: "Girl on the rail", text: "\"You're the Wildcard! Nice shoulders for a bloke who took the last seat. That's a compliment, don't make it weird.\"" },
    { when: (s)=>!s.flags["ship_knows_wildcard"], say: "sunny", alias: "Girl on the rail", text: "\"You're the one without the jacket! Nice shoulders. That's a compliment, don't make it weird.\"" },
    { choice: [
      { text: "\"Thank you, I think. Nobody has ever complimented me before breakfast.\"", steps: [
        { say: "rowan", text: "\"Thank you, I think. Nobody has ever complimented me before breakfast.\"" },
        { say: "sunny", alias: "Girl on the rail", text: "\"Then you've been having the wrong breakfasts. See how easy that was? I say a thing, you say thanks, nobody dies.\"" },
        AFF("sunny", 2, "Took the compliment")
      ] },
      { text: "\"How did you catch all of those without looking?\"", steps: [
        { say: "rowan", text: "\"How did you catch all of those without looking?\"" },
        { say: "sunny", alias: "Girl on the rail", text: "\"Dropped them about nine hundred times first.\" She fans the deck one-handed and snaps it shut. \"That's the secret to everything, by the way. Nobody likes hearing it.\"" },
        { say: "rowan", text: "\"Nine hundred.\"" },
        { say: "sunny", alias: "Girl on the rail", text: "\"Give or take. I stopped counting when it stopped being embarrassing.\"" },
        AFF("sunny", 1, "Watched the trick")
      ] },
      { text: "\"Your hair is wet. It hasn't rained.\"", steps: [
        { say: "rowan", text: "\"Your hair is wet. It hasn't rained.\"" },
        { say: "sunny", alias: "Girl on the rail", text: "\"Bucket!\" She points with her toes at a deckhand's bucket lashed by the scuppers. \"I got a deckhand to tip the sea over my head first thing. Two days out of the water. I was going spare.\"" },
        { say: "rowan", text: "\"And he just did it?\"" },
        { say: "sunny", alias: "Girl on the rail", text: "\"Second time I asked. People do most things the second time you ask.\"" },
        AFF("sunny", 1, "Noticed the hair")
      ] }
    ] },
    { say: "rowan", text: "\"I'm Rowan, by the way. Rowan Vance.\"" },
    { say: "sunny", alias: "Girl on the rail", text: "\"Sunny Aldane. Sports scholarship. I'm the lifeguard, as of — what — Monday. Everything on the island's going to fall in the water, and I'm the one who fishes it out. It's literally the job.\"" },
    MET("sunny", "Sunny Aldane"),
    NOTE("sunny", "Lifeguard on a sports scholarship. Says what she thinks the moment she thinks it."),
    { say: "rowan", text: "\"Everything is going to fall in the water?\"" },
    { say: "sunny", text: "\"Thirty-eight card players on an island, and half of you have never been outdoors. I've done the maths. It isn't good.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is she a lifeguard? Could she save me? I'm not drowning, I'd just like to know!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !s.flags["follow_baylee"], say: "sunny", text: "\"You? One arm. I wouldn't even put the cards down.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Nathan.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "sunny", text: "\"Him, one arm.\" She looks up at Baylee, and then some way further up. \"You I'd need a plan for. And a rope.\"" },
    { say: "sunny", text: "\"Two kilometres before breakfast, every day, that's me. And today there's no pool, so I'm climbing the walls. Well — the rail.\" She drums her heels on it. \"Can you swim, Rowan?\"" },
    { flag: "sunny_said_two_k" },
    { choice: [
      { text: "\"Well enough that you won't have to fish me out.\"", steps: [
        { say: "rowan", text: "\"Well enough that you won't have to fish me out.\"" },
        { say: "sunny", text: "\"That's exactly what the ones I fish out say. Word for word. I'm putting you on the list.\"" },
        { say: "rowan", text: "\"There's a list?\"" },
        { say: "sunny", text: "\"There is now. You're top.\"" },
        AFF("sunny", 1, "Made her list")
      ] },
      { text: "\"Badly. Mostly sideways.\"", steps: [
        { say: "rowan", text: "\"Badly. Mostly sideways.\"" },
        { flag: "sunny_rowan_sideways" },
        { say: "sunny", text: "\"Brilliant! No, really. 'Badly' I can fix. It's 'fine, thanks' that drowns.\"" },
        { say: "sunny", text: "\"Sideways is just forwards with the wrong arm. Give me a week.\"" },
        AFF("sunny", 2, "Admitted he's bad at it")
      ] },
      { text: "\"Is that the lifeguard asking, or you?\"", steps: [
        { say: "rowan", text: "\"Is that the lifeguard asking, or you?\"" },
        { say: "sunny", text: "\"Both. There's only the one of me. I checked.\"" },
        AFF("sunny", 1, "Asked which Sunny")
      ] }
    ] },
    { say: "sunny", text: "\"I like you. There, said it.\"" },
    { flag: "sunny_said_likes" },
    { text: "She says it so simply, with so little fuss, that you have no idea where to put your hands." },
    { say: "sunny", text: "\"Your turn. Or we can race for it.\"" },
    { choice: [
      { text: "\"You've known me for about three minutes.\"", steps: [
        { say: "rowan", text: "\"You've known me for about three minutes.\"" },
        { say: "sunny", text: "\"Takes me thirty seconds. Three minutes is practically a marathon.\"" },
        { say: "rowan", text: "\"And if you stop liking me?\"" },
        { say: "sunny", text: "\"Then I'll tell you. Same speed.\" She shrugs, entirely unbothered. \"It saves a lot of time.\"" },
        AFF("sunny", 2, "Asked straight back")
      ] },
      { text: "\"I think I like you too. I'm just slower at it.\"", steps: [
        { say: "rowan", text: "\"I think I like you too. I'm just slower at it.\"" },
        { say: "sunny", text: "\"Slow's fine. Slow still touches the wall.\" She looks thoroughly pleased. \"See? That wasn't hard, and now we both know.\"" },
        AFF("sunny", 3, "Said it back")
      ] },
      { text: "\"Race you where, exactly?\"", steps: [
        { say: "rowan", text: "\"Race you where, exactly?\"" },
        { say: "sunny", text: "\"Off the stern, once round the ship and back up the anchor chain!\"" },
        { text: "She laughs, a big, easy sound, at whatever your face has just done." },
        { say: "sunny", text: "\"Kidding. I'd get us both thrown off, and I haven't even been given my whistle yet.\"" },
        AFF("sunny", 2, "Played along")
      ] },
      { text: "Go red and say nothing.", steps: [
        { say: "sunny", text: "\"Ha! There it is.\"" },
        { text: "She looks at you with open, delighted interest." },
        { say: "sunny", text: "\"That's a good colour on you.\"" },
        AFF("sunny", 1, "Blushed")
      ] }
    ] },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { say: "sunny", text: "\"Right.\" She squares the deck on her knee. \"Cards, then. Loser does ten push-ups. On the planks.\"" },
    { choice: [
      { text: "\"You're on. Ten push-ups for the loser.\"", steps: [
        { say: "rowan", text: "\"You're on. Ten push-ups for the loser.\"" },
        { flag: "sunny_go_game" }
      ] },
      { text: "\"Hang on. I'd like to know who I'm losing to first.\"", steps: [
        { say: "rowan", text: "\"Hang on. I'd like to know who I'm losing to first.\"" },
        { say: "sunny", text: "\"Ask away. I've got nothing to hide and nowhere to put it.\"" },
        { scene: "chat_sunny" }
      ] },
      { text: "\"Not on a wet deck, I'll slip. Find me on land and I'll take your challenge.\"", steps: [
        { say: "rowan", text: "\"Not on a wet deck, I'll slip. Find me on land and I'll take your challenge.\"" },
        { say: "sunny", text: "\"Chicken.\" Affectionately. \"Dry land, then. I'll remember.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["sunny_go_game"], jump: "game" },
    { end: true },

    { label: "again" },
    { when: (s)=>!!(s.flags["ship_knows_wildcard"] || s.flags["told_wildcard"]), say: "sunny", text: "\"Hey, Wildcard! Still alive?\"" },
    { when: (s)=>!(s.flags["ship_knows_wildcard"] || s.flags["told_wildcard"]), say: "sunny", text: "\"Hey, Rowan! Still dry?\"" },
    { when: (s)=>!s.flags["flag_sunny_game"], text: "She has not moved from the rail. The deck of cards is going from one hand to the other behind her back, as if her hands had been left running." },
    { when: (s)=>!s.flags["flag_sunny_game"], say: "sunny", text: "\"The ten push-ups are still on the table. Well. On the planks.\"" },
    { when: (s)=>!!s.flags["flag_sunny_game"] && s.duels["ferry_sunny"] === "won", say: "sunny", text: "\"I can still feel those ten. Good. Means they counted.\"" },
    { when: (s)=>!!s.flags["flag_sunny_game"] && s.duels["ferry_sunny"] !== "won", say: "sunny", text: "\"How are the arms? Be honest. I can see them from here.\"" },
    { time: 4 },
    { choice: [
      { text: "\"Go on, then. Ten push-ups for the loser.\"", when: (s)=>!s.flags["flag_sunny_game"], steps: [
        { say: "rowan", text: "\"Go on, then. Ten push-ups for the loser.\"" },
        { flag: "sunny_go_game" }
      ] },
      { text: "\"Have you got a minute? I'm not done being curious.\"", when: (s)=>!s.flags["chat_sunny_done"], steps: [
        { say: "rowan", text: "\"Have you got a minute? I'm not done being curious.\"" },
        { say: "sunny", text: "\"I've got till the pier. Go.\"" },
        { scene: "chat_sunny" }
      ] },
      { text: "Wave and move on.", steps: [
        { text: "She waves back with the whole deck fanned out in her hand, like somebody signalling a plane." }
      ] }
    ] },
    { when: (s)=>!!s.flags["sunny_go_game"], jump: "game" },
    { end: true },

    { label: "game" },
    { unflag: "sunny_go_game" },
    { text: "She swings off the rail and sits down cross-legged on the dry planks under the awning, and deals with the towel still round her neck. Nobody is watching but a gull. Your hands are very nearly steady." },
    { duel: "ferry_sunny", opponent: "sunny", opponentName: "Sunny Aldane", mustWin: false,
      onWin: [
        { say: "sunny", text: "\"No dramas!\"" },
        { text: "She is already face-down on the planks, counting aloud, loudly, with great goodwill." },
        { say: "sunny", text: "\"Seven! Eight! Nine — I'm lying, that was six. TEN!\"" },
        AFF("sunny", 3, "Took the loss well")
      ],
      onLose: [
        { say: "sunny", text: "\"Ha!\" Triumphant. \"Ten! Go on! Face down!\"" },
        { text: "You do ten. By the seventh your arms are shaking. By the tenth you are lying on the planks next to a seagull with the sun on your back, and Sunny is lying next to you, laughing, and you realise you are laughing too." },
        AFF("sunny", 4, "Did the push-ups")
      ] },
    { scene: "post_sunny" },
    { flag: "flag_sunny_game" },
    { time: 25 },
    { end: true }
  ]
});

scene("chat_sunny", {
  steps: [
    { label: "top" },
    { when: (s)=>!!(s.flags["chat_sunny_1"] && s.flags["chat_sunny_2"] && s.flags["chat_sunny_3"] && s.flags["chat_sunny_x"]) && !s.flags["chat_sunny_done"], jump: "done" },
    { choice: [
      { text: "\"Sports scholarship. How does a swimmer end up at a card school?\"", when: (s)=>!s.flags["chat_sunny_1"], steps: [
        { say: "rowan", text: "\"Sports scholarship. How does a swimmer end up at a card school?\"" },
        { say: "sunny", text: "\"Broke my leg when I was nine. Fell off a trampoline, do not ask.\"" },
        { choice: [
          { text: "\"I'm asking.\"", steps: [
            { say: "rowan", text: "\"I'm asking.\"" },
            { say: "sunny", text: "\"There was a garage roof. There was a dare. There was a cousin who is still not allowed at my birthday.\"" }
          ] },
          { text: "\"I won't ask.\"", steps: [
            { say: "rowan", text: "\"I won't ask.\"" },
            { say: "sunny", text: "\"Good man. It's a rubbish story and I come out of it badly.\"" }
          ] }
        ] },
        { say: "sunny", text: "\"Anyway. Leg in bits, and the pool was the only place it didn't hurt.\"" },
        { text: "A grin, with a very small shadow behind it." },
        { say: "sunny", text: "\"And then I got fast. And then I got *faster*.\"" },
        { say: "rowan", text: "\"And the cards?\"" },
        { say: "sunny", text: "\"Physio waiting rooms! Hours of them. They had a deck on the table and nothing else to do. It was either cards or the fish tank.\"" },
        { say: "sunny", text: "\"Turns out I can't sit in a room unless there's something in it to win. The fish got very bored of me.\"" },
        AFF("sunny", 2, "Asked about her story"),
        { flag: "chat_sunny_1" },
        NOTE("sunny", "Started swimming after breaking a leg at nine. Learned cards in physio waiting rooms."),
        { time: 3 }
      ] },
      { text: "\"You said you got fast. How fast is fast?\"", when: (s)=>!!s.flags["chat_sunny_1"] && !s.flags["chat_sunny_2"], steps: [
        { say: "rowan", text: "\"You said you got fast. How fast is fast?\"" },
        { say: "sunny", text: "\"Four hundred metres, free. I came second at nationals.\"" },
        { text: "Her face does something between a grin and a wince." },
        { say: "sunny", text: "\"By a hand's breadth. I still think about the hand.\"" },
        { choice: [
          { text: "\"Does it get better?\"", steps: [
            { say: "rowan", text: "\"Does it get better?\"" },
            { say: "sunny", text: "\"It gets *quicker*. Same thing, I reckon.\" She kicks her feet over the wake. \"There's always a next race.\"" }
          ] },
          { text: "\"Second in the country sounds all right to me.\"", steps: [
            { say: "rowan", text: "\"Second in the country sounds all right to me.\"" },
            { say: "sunny", text: "\"It *is* all right. It's brilliant. Everybody says so.\" A beat. \"That's sort of the trouble. Nobody lets you be cross about brilliant.\"" }
          ] }
        ] },
        { say: "sunny", text: "\"And now my letter says 'lifeguard', and people hear 'lifeguard' and think whistle, suncream, nice girl. Fine. They can think it right up until they're doing the push-ups.\"" },
        { say: "rowan", text: "\"I'll try to think it for as short a time as possible.\"" },
        { say: "sunny", text: "\"Ha!\" She points at you with the whole deck. \"That. That's the right answer.\"" },
        AFF("sunny", 2, "Took her seriously"),
        { flag: "chat_sunny_2" },
        NOTE("sunny", "Came second at nationals by a hand's breadth. Does not care to be 'just the lifeguard'."),
        { time: 3 }
      ] },
      { text: "\"'I like you. There, said it.' Do you say that to everyone?\"", when: (s)=>!!s.flags["sunny_said_likes"] && !s.flags["chat_sunny_3"], steps: [
        { say: "rowan", text: "\"'I like you. There, said it.' Do you say that to everyone?\"" },
        { say: "sunny", text: "\"Only when it's true! I tell people the second I decide. And I tell them the second I stop.\" Totally unembarrassed. \"You get used to it.\"" },
        { choice: [
          { text: "\"That's — efficient.\"", steps: [
            { say: "rowan", text: "\"That's — efficient.\"" },
            { say: "sunny", text: "\"It's *honest*. Efficient's a bonus.\"" }
          ] },
          { text: "\"Doesn't that get you into trouble?\"", steps: [
            { say: "rowan", text: "\"Doesn't that get you into trouble?\"" },
            { say: "sunny", text: "\"Constantly! I told a coach his stroke plan was rubbish with his boss stood right behind me. It *was* rubbish. I still had to swim it.\"" }
          ] }
        ] },
        { when: (s)=>!s.flags["met_ashton"], say: "sunny", text: "\"Look — see the bloke along the rail with the rose?\"" },
        { when: (s)=>!!s.flags["met_ashton"], say: "sunny", text: "\"Look — see Ashton along the rail, with the rose?\"" },
        { text: "You look. He has not put the rose down. He appears to be showing the sea his better side." },
        { say: "sunny", text: "\"Great jaw. Knows it. I'll have told him by lunch, and then we'll all know where we stand.\"" },
        { say: "rowan", text: "\"And if where you stand is nowhere?\"" },
        { say: "sunny", text: "\"Then it took one morning instead of a term.\" Quieter, for a moment, and looking at the water: \"It's the waiting I'm rubbish at. You hang on to a thing you should have said, and then the moment's gone and you've still got it in your mouth.\"" },
        { say: "sunny", text: "\"You blush really nicely, by the way. Just saying.\"" },
        AFF("sunny", 1, "Took it in stride"),
        { flag: "chat_sunny_3" },
        NOTE("sunny", "Tells people she likes them the second she decides, and the second she stops. Waiting is the one thing she is bad at."),
        { time: 3 }
      ] },
      { text: "\"Two kilometres before breakfast. Why?\"", when: (s)=>!!s.flags["sunny_said_two_k"] && !s.flags["chat_sunny_x"], steps: [
        { say: "rowan", text: "\"Two kilometres before breakfast. Why?\"" },
        { say: "sunny", text: "\"Because the water's quiet at six.\"" },
        { say: "sunny", text: "\"You can hear your own heartbeat. Nobody's trying to be your friend, or your coach, or your doctor. It's just you and the line at the bottom of the pool going on and on and on.\"" },
        { choice: [
          { text: "\"Doesn't it get dull?\"", steps: [
            { say: "rowan", text: "\"Doesn't it get dull?\"" },
            { say: "sunny", text: "\"Dull's the good bit.\" A bright, quick grin. \"Nothing down there to look at but what you've actually got. I like that. I'm not great at pretending.\"" }
          ] },
          { text: "\"That sounds like the only quiet you get all day.\"", steps: [
            { say: "rowan", text: "\"That sounds like the only quiet you get all day.\"" },
            { say: "sunny", text: "\"…Yeah. I'm a lot, the rest of the day. I know I am.\" She does not seem sorry about it; she seems to have measured it. \"So I get the quiet in early, where it can't bother anyone.\"" }
          ] }
        ] },
        { when: (s)=>!!s.flags["sunny_rowan_sideways"], say: "sunny", text: "\"You should come. Six o'clock, any morning, wherever they keep the water. Bring whatever it is you swim sideways in.\"" },
        { when: (s)=>!s.flags["sunny_rowan_sideways"], say: "sunny", text: "\"You should come. Six o'clock, any morning, wherever they keep the water. Bring a towel and no opinions.\"" },
        { say: "rowan", text: "\"Six in the morning.\"" },
        { say: "sunny", text: "\"It only hurts the first eleven times.\"" },
        AFF("sunny", 2, "Asked about the early swim"),
        { flag: "chat_sunny_x" },
        { flag: "sunny_invited_swim" },
        NOTE("sunny", "Swims two kilometres at six every morning because the water is quiet and honest. You are invited."),
        { time: 3 }
      ] },
      { text: "\"Have you met Freddie? Red hair, goggles, a certain amount of seaweed?\"", when: (s)=>!!s.flags["met_freddie"] && !s.flags["chat_sunny_4"], steps: [
        { say: "rowan", text: "\"Have you met Freddie? Red hair, goggles, a certain amount of seaweed?\"" },
        { say: "sunny", text: "\"Freddie! We met over a bucket. She wanted the sea in it, I wanted the sea on me.\" A gleam. \"We're racing at dawn tomorrow. She thinks I haven't seen her breaststroke. I've seen it. I'm going to let her win. The first time.\"" },
        { choice: [
          { text: "\"You'd throw a race?\"", steps: [
            { say: "rowan", text: "\"You'd throw a race?\"" },
            { say: "sunny", text: "\"*Lend*. I'm lending her one. She'll get cocky, and cocky is slow. Then I'll take every single one after.\"" }
          ] },
          { text: "\"She told me she's letting *you* think you'll win.\"", when: (s)=>!!s.flags["chat_freddie_4"], steps: [
            { say: "rowan", text: "\"She told me she's letting *you* think you'll win.\"" },
            { say: "sunny", text: "\"Did she! Ha!\" Delighted. \"Oh, she's good. Right. No lending, then. She gets the real thing from the first length.\"" }
          ] },
          { text: "\"Racing where? Nobody's seen the island yet.\"", steps: [
            { say: "rowan", text: "\"Racing where? Nobody's seen the island yet.\"" },
            { say: "sunny", text: "\"It's an *island*, Rowan. Worst case we go round it. And then I'll take every single one after.\"" }
          ] }
        ] },
        { text: "She looks down the deck at the red head hanging over the stern rail, and for a moment the breeziness goes out of her face and something short and practical looks out instead." },
        { say: "sunny", text: "\"Tell you what, though. She's been measuring the drop off this stern all morning. With her eyes. I know that look; I've *had* that look. I'm not on shift till Monday and I can already tell who's going in after her.\"" },
        AFF("sunny", 1, "Mentioned Freddie"),
        { flag: "chat_sunny_4" },
        REL("sunny", "freddie"),
        NOTE("sunny", "Is racing Freddie at dawn tomorrow, and keeping a lifeguard's eye on her today."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_sunny"], steps: [
        { scene: "deck_sunny" }
      ] },
      { text: "\"I'd better see the rest of the ship.\"", steps: [
        { say: "rowan", text: "\"I'd better see the rest of the ship.\"" },
        { say: "sunny", text: "\"Go! See you on land! Don't fall in. I'm not on shift till Monday, so if you must, make it Monday.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_sunny_done" },
    { say: "sunny", text: "\"Right! That's about everything interesting I've got. Which isn't much, but I'm very good at saying it fast!\"" },
    { end: true }
  ]
});

scene("deck_sunny", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_sunny"], end: true },
    { choice: [
      { text: "\"Towel, goggle marks, wet ponytail. Water, then? Deepsea Idols, sharks, something from the deep end?\"", hint: "From her look", steps: [
        { say: "rowan", text: "\"Towel, goggle marks, wet ponytail. Water, then? Deepsea Idols, sharks, something from the deep end?\"" },
        { say: "sunny", text: "\"Ha! Right pool, wrong temperature! It's the cold end. **Ice!**\"" },
        { say: "sunny", text: "\"Slip 'n Slide. Everything slides, nothing stays where you put it. Drives the control kids mental.\"" },
        AFF("sunny", 2, "Close enough")
      ] },
      { text: "\"What do you play? I'm guessing it's something with a lot of splash.\"", steps: [
        { say: "rowan", text: "\"What do you play? I'm guessing it's something with a lot of splash.\"" },
        { say: "sunny", text: "\"Frozen splash! Slip 'n Slide. Everything slides, nothing stays where you put it.\"" },
        AFF("sunny", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_sunny" },
        { end: true }
      ] }
    ] },
    { text: "Rowan's mouth moves before his voice does, low and quick." },
    { say: "rowan", text: "\"…Pengu, Polar, Snobbit, Snowman. Skates for an extra slide. Spikeblock. Whoolmoth once every hero has a creature.\"" },
    { say: "rowan", text: "\"Every Slippery slides into the neighbouring hero each turn, and every slide does something. Ingo gets paid per slide.\" A beat. \"Middle hero falls, outer ones aren't neighbours. Right.\"" },
    { say: "sunny", text: "\"…Oh, he's *good*.\"" },
    { text: "She says it to the gulls." },
    { say: "sunny", text: "\"That's the whole weakness and he said it in one go. Rude.\"" },
    { choice: [
      { text: "\"It's only a weakness if the other side finds the middle hero.\"", steps: [
        { say: "rowan", text: "\"It's only a weakness if the other side finds the middle hero.\"" },
        { say: "sunny", text: "\"That's what I said. Rude *and* clever.\"" }
      ] },
      { text: "\"Sorry. I read a lot of decklists. It just comes out.\"", steps: [
        { say: "rowan", text: "\"Sorry. I read a lot of decklists. It just comes out.\"" },
        { say: "sunny", text: "\"Don't be sorry! Go round this whole boat doing it and come back and tell me everyone's.\" A beat. \"Kidding. Mostly.\"" }
      ] }
    ] },
    DECK("sunny")
  ]
});

scene("post_sunny", {
  steps: [
    DECK("sunny"),
    { when: (s)=>s.duels["ferry_sunny"] !== "won", jump: "lost" },
    { text: "Sunny rolls over onto her back with the towel across her face and goes on talking through it." },
    { say: "sunny", text: "\"Nobody told me you'd go for the Whoolmoth first.\"" },
    { say: "rowan", text: "\"It was the only card that could slide into three of my heroes. If it landed, I'd have lost.\"" },
    { say: "sunny", text: "\"It never landed. Clever.\" She sits up, and the towel falls into her lap. \"I like your storm. It doesn't slide. It just waits.\"" },
    { choice: [
      { text: "\"You're not annoyed?\"", steps: [
        { say: "rowan", text: "\"You're not annoyed?\"" },
        { say: "sunny", text: "\"About losing? I've lost to better and I've lost to worse, and I shook hands both times. I get annoyed at *slow*. You weren't slow.\"" }
      ] },
      { text: "\"Rematch on dry land?\"", steps: [
        { say: "rowan", text: "\"Rematch on dry land?\"" },
        { say: "sunny", text: "\"Obviously. Twenty push-ups. I've seen what you do now.\"" }
      ] }
    ] },
    // Geschenk nach Rowans Sieg: eine Trophäe, die rutscht.
    { text: "She riffles her deck one-handed, without looking, the way she caught it on the rail, and stops on one card: a small, round, extremely pleased-looking penguin." },
    { say: "sunny", text: "\"Here. Your storm doesn't slide, so have something that does. Slippery Pengu. My favourite. Put him anywhere and he's moved by your next turn.\"" },
    { say: "sunny", text: "\"Not a consolation prize. A trophy. You won, you get a trophy. That's sport.\"" },
    { choice: [
      { text: "\"Thanks. He's going to hate my deck.\"", steps: [
        { say: "rowan", text: "\"Thanks. He's going to hate my deck.\"" },
        { say: "sunny", text: "\"He'll slide straight out of it. Keep him in your pocket, then. That's where trophies go.\"" },
        { card: "Slippery Pengu", rarity: "uncommon", flag: "sunny_gave_pengu" }
      ] },
      { text: "\"Keep him. He's your favourite.\"", steps: [
        { say: "rowan", text: "\"Keep him. He's your favourite.\"" },
        { say: "sunny", text: "\"Fair. I'd miss him.\" No fuss at all; the penguin goes back into the deck. \"It was a real offer, though. I don't do the other kind.\"" },
        { flag: "sunny_gift_refused" }
      ] }
    ] },
    { jump: "out" },
    { label: "lost" },
    { text: "You are lying on your back next to a seagull, arms burning. Sunny rolls onto her side and props her head on one hand." },
    { say: "sunny", text: "\"That was a proper game! Everything slides, and you kept the Spikeblock off your Hero for four turns. That's hard.\"" },
    { say: "rowan", text: "\"I couldn't stop the Snowman, though. That froze me in position for a turn and I couldn't use the spell.\"" },
    { say: "sunny", text: "\"That's the trick.\" Cheerfully. \"You can't stop everything. You can only choose what hurts less.\"" },
    { choice: [
      { text: "\"Is that cards, or swimming?\"", steps: [
        { say: "rowan", text: "\"Is that cards, or swimming?\"" },
        { say: "sunny", text: "\"Both! Everything's swimming. Don't tell the tutors I said so, they'll make me put it in an essay.\"" }
      ] },
      { text: "\"My arms have chosen. Everything hurts.\"", steps: [
        { say: "rowan", text: "\"My arms have chosen. Everything hurts.\"" },
        { say: "sunny", text: "\"Good! That's ten honest ones. Half the blokes I know would have done six and argued about the count.\"" }
      ] }
    ] },
    { label: "out" },
    AFF("sunny", 1, "Talked it through")
  ]
});

/* ───────────────────────── MARIT ───────────────────────── */
scene("ferry_marit", {
  steps: [
    { when: (s)=>!!s.flags["met_marit"], jump: "again" },
    { text: "A girl is standing on a mooring bollard, reciting to the gulls." },
    { text: "Her flame-orange hair flares up into two tall tufts, one on each side of her head, each tied with an orange bow; a scarf the colour of embers is wound twice round her throat, and the blue collar of her black jacket is turned up as far as it will go." },
    { text: "\"…and in that hour, when the sea went grey as a forgotten promise —\" She is holding an invisible sword aloft. The gulls are paying attention in the way gulls do, which is to say, as a business matter." },
    { text: "She sees you. The recital stops. The sword, you notice, stays up." },
    { say: "marit", alias: "Girl on a bollard", text: "\"A **HUMAN!** An *AUDIENCE!* The gods are *generous* this morning!\"" },
    { say: "marit", alias: "Girl on a bollard", text: "\"You! You heard the last line. 'Grey as a forgotten promise.'\" The sword arm wavers. \"Honestly, now. Too much?\"" },
    { choice: [
      { text: "\"Too much for whom? The gulls were following it.\"", steps: [
        { say: "rowan", text: "\"Too much for whom? The gulls were following it.\"" },
        { say: "marit", alias: "Girl on a bollard", text: "\"The gulls are a **dreadful** house! They talk through the quiet parts and they leave before the end!\"" },
        { say: "marit", alias: "Girl on a bollard", text: "\"But *you* stopped. Somebody *stopped*. I shall be unbearable about it until lunch.\"" },
        AFF("marit", 2, "Stopped to listen")
      ] },
      { text: "\"A bit. Promises aren't grey.\"", steps: [
        { say: "rowan", text: "\"A bit. Promises aren't grey.\"" },
        { say: "marit", alias: "Girl on a bollard", text: "\"A **CRITIC!** On the *open sea!*\"" },
        { text: "She clutches the scarf. Then, quick and perfectly ordinary, out of the side of her mouth:" },
        { say: "marit", alias: "Girl on a bollard", text: "\"No, you're right. It was 'grey as dishwater' first, and that was worse. I'll fix it.\"" },
        AFF("marit", 2, "Gave an honest note")
      ] },
      { text: "\"What happens in that hour? You stopped before the good part.\"", steps: [
        { say: "rowan", text: "\"What happens in that hour? You stopped before the good part.\"" },
        { say: "marit", alias: "Girl on a bollard", text: "\"I have no **idea!** I make it up as I go! So far there is a sword, a grey sea and a woman who has been *wronged* — I am fairly sure she has been wronged —\"" },
        { say: "rowan", text: "\"By whom?\"" },
        { say: "marit", alias: "Girl on a bollard", text: "\"By *whoever walks up next*, as a rule. Congratulations.\"" },
        AFF("marit", 2, "Asked what happens next")
      ] }
    ] },
    { text: "She hops down off the bollard, lands with a turn that shows a flash of red lining, and sheathes the sword that is not there." },
    { say: "marit", alias: "Girl on a bollard", text: "\"Marit Solberg! Commentary track! Theatre kid **EXTRAORDINAIRE!** Flame-adjacent in every conceivable respect! And *you* — you are the **BROODING STRANGER** without a jacket!\"" },
    MET("marit", "Marit Solberg"),
    NOTE("marit", "Treats everything as a stage. Narrates, loudly."),
    { say: "rowan", text: "\"I'm Rowan Vance, and I'm not brooding. I'm just underdressed.\"" },
    { text: "She writes the word on the air with one finger, tastes it, and likes it." },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"THAT. Is the BEST person I have EVER heard!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"She's loud.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "nathan", text: "\"She's *magnificent*.\"" },
    { say: "marit", text: "\"**UNDERDRESSED!** Rowan Vance — brooding, underdressed and *brand new!* I founded a drama society at sunrise, it has no lead, and I have decided, here and now, beside this very bollard, that we are having an **ARC!**\"" },
    { flag: "marit_said_society" },
    { choice: [
      { text: "\"What kind of arc? I'd like to know what I'm signing up for.\"", steps: [
        { say: "rowan", text: "\"What kind of arc? I'd like to know what I'm signing up for.\"" },
        { say: "marit", text: "\"Oh, the **GOOD** kind! The kind where you start out terrified of something and end up with a *very* good coat!\"" },
        { say: "marit", text: "\"Which reminds me. What *are* you terrified of? Quickly, I need it for the second act.\"" },
        { choice: [
          { text: "\"Playing in front of people. My hands shake.\"", steps: [
            { say: "rowan", text: "\"Playing in front of people. My hands shake.\"" },
            { text: "The grin does not go, but something behind it sits down." },
            { say: "marit", text: "\"Oh. That's a real one.\" The ordinary voice, quick and low. \"Then stand next to me when you have to. Nobody looks at the person next to me. It's the safest place on any island.\"" },
            { flag: "marit_knows_stagefright" },
            AFF("marit", 3, "Told her a true thing")
          ] },
          { text: "\"Gulls.\"", steps: [
            { say: "rowan", text: "\"Gulls.\"" },
            { say: "marit", text: "\"**LIAR!** Delightful! A man with a *secret!* I shall have it out of you by the interval.\"" },
            AFF("marit", 1, "Lied entertainingly")
          ] },
          { text: "\"Ask me in act three.\"", steps: [
            { say: "rowan", text: "\"Ask me in act three.\"" },
            { say: "marit", text: "\"He understands **STRUCTURE!** Oh, you are *wasted* on cards.\"" },
            AFF("marit", 2, "Knows how a play works")
          ] }
        ] }
      ] },
      { text: "\"Is all this a hobby, or a calling? You're very good at it.\"", steps: [
        { say: "rowan", text: "\"Is all this a hobby, or a calling? You're very good at it.\"" },
        { say: "marit", text: "\"A **CALLING!**\"" },
        { text: "Then — quieter, an aside, almost ordinary:" },
        { say: "marit", text: "\"Also a hobby. I'm not 'too much'. I'm the correct amount for a larger room.\"" },
        { choice: [
          { text: "\"Who said 'too much'?\"", steps: [
            { say: "rowan", text: "\"Who said 'too much'?\"" },
            { say: "marit", text: "\"Everybody, eventually. The record is four minutes: a man in the ticket queue, last night. He said it kindly. Kindly is the worst way.\"" },
            { say: "marit", text: "\"And *you* have lasted **five!** A new record! Somebody ring a bell!\"" },
            AFF("marit", 3, "Saw behind the act")
          ] },
          { text: "\"This is a fairly small ship.\"", steps: [
            { say: "rowan", text: "\"This is a fairly small ship.\"" },
            { say: "marit", text: "\"It is a **TINY** ship! I have been *rationing* myself since the harbour! This is me at **half!**\"" },
            AFF("marit", 2, "Let her be loud")
          ] }
        ] }
      ] },
      { text: "\"Do I get a say in it?\"", steps: [
        { say: "rowan", text: "\"Do I get a say in it?\"" },
        { say: "marit", text: "\"**No!** If you got a say it would be a *plan!* Arcs happen *to* people! That is what makes them good!\"" },
        { say: "rowan", text: "\"And if I'd rather have the plan?\"" },
        { say: "marit", text: "\"Then you may have a plan as well.\" Graciously. \"Privately. I shan't look.\"" },
        AFF("marit", 1, "Asked a fair question")
      ] }
    ] },
    { say: "marit", text: "\"But tell me this, stranger. What brings you to the *back* of a ship? The front has the view. I checked. I came here for the acoustics.\"" },
    { choice: [
      { text: "\"It's quieter back here.\"", steps: [
        { say: "rowan", text: "\"It's quieter back here.\"" },
        { say: "marit", text: "\"…It *was*.\" A flicker of real apology, spent at once. \"I regret **nothing!**\"" }
      ] },
      { text: "\"I heard somebody shouting at seagulls.\"", steps: [
        { say: "rowan", text: "\"I heard somebody shouting at seagulls.\"" },
        { say: "marit", text: "\"*Reciting!* At seagulls! …But yes. It carries. It is meant to carry.\"" }
      ] },
      { text: "\"I'm trying to look at everybody once. You're hard to miss.\"", steps: [
        { say: "rowan", text: "\"I'm trying to look at everybody once. You're hard to miss.\"" },
        { say: "marit", text: "\"Hard to miss! Carve it on my **tomb!**\"" },
        AFF("marit", 1, "Called her hard to miss")
      ] }
    ] },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { text: "Behind her the wake runs back to nothing; ahead, somewhere past the funnel, an island is getting slowly larger. She has her back to both, and her whole attention on you." },
    { say: "marit", text: "\"Now! A game! I shall narrate every move — yours included — because I physically cannot *help* it!\"" },
    { choice: [
      { text: "\"All right, Marit. Let's play. And I'd like to hear the narration.\"", steps: [
        { say: "rowan", text: "\"All right, Marit. Let's play. And I'd like to hear the narration.\"" },
        { flag: "marit_go_game" }
      ] },
      { text: "\"Let me ask you something first, and then we play.\"", steps: [
        { say: "rowan", text: "\"Let me ask you something first, and then we play.\"" },
        { say: "marit", text: "\"An **INTERVIEW!** Before the main event! Very well. I am an open book. A *large* one, with pictures.\"" },
        { scene: "chat_marit" }
      ] },
      { text: "\"Maybe later. I'd like to see the rest of the ship first.\"", steps: [
        { say: "rowan", text: "\"Maybe later. I'd like to see the rest of the ship first.\"" },
        { say: "marit", text: "\"Later! The **SEQUEL!** The sequel is *always* better!\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["marit_go_game"], jump: "game" },
    { end: true },

    { label: "again" },
    { when: (s)=>!s.flags["flag_marit_game"], say: "marit", text: "\"Rowan! **PROTAGONIST!** Have you seen the island? It has a **MOUNTAIN!** I have already written a monologue!\"" },
    { when: (s)=>!s.flags["flag_marit_game"], text: "She is back on the bollard. The gulls have closed in again, with the look of creditors." },
    { when: (s)=>!!s.flags["flag_marit_game"], say: "marit", text: "\"The **STORM-BRINGER** returns! I have been describing our game to the gulls. You come out of it *very* well. Taller.\"" },
    { time: 4 },
    { choice: [
      { text: "\"Is that game still on offer? With narration?\"", when: (s)=>!s.flags["flag_marit_game"], steps: [
        { say: "rowan", text: "\"Is that game still on offer? With narration?\"" },
        { say: "marit", text: "\"With narration! With *voices!* Clear the deck!\"" },
        { flag: "marit_go_game" }
      ] },
      { text: "\"Do you have a minute between monologues? I've got questions.\"", when: (s)=>!s.flags["chat_marit_done"], steps: [
        { say: "rowan", text: "\"Do you have a minute between monologues? I've got questions.\"" },
        { say: "marit", text: "\"For a man with *questions* I have an entire interval.\"" },
        { scene: "chat_marit" }
      ] },
      { text: "Applaud politely and move on.", steps: [
        { text: "She bows from the bollard, deeply, to an audience of one man and eleven gulls." }
      ] }
    ] },
    { when: (s)=>!!s.flags["marit_go_game"], jump: "game" },
    { end: true },

    { label: "game" },
    { unflag: "marit_go_game" },
    { text: "A small crowd gathers around the bollard in the time it takes to shuffle. Six people, then eight. The deckhand with the tea, two girls from the lounge, a boy with a clipboard. Your hands begin to shake the moment you pick up the deck." },
    { think: "Everyone's watching. Not me, exactly. The game. But close enough." },
    { when: (s)=>!!s.flags["marit_knows_stagefright"], text: "Marit glances at your hands, and then, without a word, shifts round so that she is between you and most of the crowd, and makes herself a good deal larger." },
    { say: "marit", text: "\"From the ashes of my frankly terrible opening hand — she **RETURNS!** *(I had no idea that would work.)*\"" },
    { duel: "ferry_marit", opponent: "marit", opponentName: "Marit Solberg", mustWin: false,
      onWin: [
        { say: "marit", text: "\"**ALAS!** *DEFEAT!* And what a defeat, what a — no. No, it's a good one.\"" },
        { text: "She drops, for exactly one sentence, into an ordinary voice." },
        { say: "marit", text: "\"Rowan Vance, you have a very quiet kind of thunder.\"" },
        AFF("marit", 3, "Good game")
      ],
      onLose: [
        { say: "marit", text: "\"The **PHOENIX**, ladies and gentlemen! **ALWAYS** the Phoenix!\"" },
        { text: "She takes a bow so deep that her scarf trails on the planks. The small crowd cheers." },
        AFF("marit", 3, "Played with her")
      ] },
    { scene: "post_marit" },
    { flag: "flag_marit_game" },
    { time: 25 },
    { end: true }
  ]
});

scene("chat_marit", {
  steps: [
    { label: "top" },
    { when: (s)=>!!(s.flags["chat_marit_1"] && s.flags["chat_marit_2"] && s.flags["chat_marit_3"] && s.flags["chat_marit_x"]) && !s.flags["chat_marit_done"], jump: "done" },
    { choice: [
      { text: "\"Where did you learn to project like that? They can hear you at the funnel.\"", when: (s)=>!s.flags["chat_marit_1"], steps: [
        { say: "rowan", text: "\"Where did you learn to project like that? They can hear you at the funnel.\"" },
        { say: "marit", text: "\"**LEARN?** Darling. I have been **every part** in **every school play** in a town of four hundred souls! I was the **Wicked Stepmother!** The **Fairy Godmother!** Both **Ugly Sisters!** And the *Pumpkin!*\"" },
        { choice: [
          { text: "\"All in one production?\"", steps: [
            { say: "rowan", text: "\"All in one production?\"" },
            { say: "marit", text: "\"In *separate* productions, thank you, I have *standards!*\"" }
          ] },
          { text: "\"If you were every part, who was left to watch?\"", steps: [
            { say: "rowan", text: "\"If you were every part, who was left to watch?\"" },
            { say: "marit", text: "\"Three hundred and ninety-nine people! Fewer when the boats were out. I once played a full first act to a caretaker and a dog. The dog *wept*.\"" }
          ] }
        ] },
        { text: "Then, quieter, ordinary, a plain aside:" },
        { say: "marit", text: "\"Four hundred people, right at the top of the map. It gets very dark there. You learn to make your own light.\"" },
        { say: "rowan", text: "\"And your own noise.\"" },
        { say: "marit", text: "\"That *is* the light.\" The grin comes back up like a curtain. \"You have to imagine it with a spotlight.\"" },
        AFF("marit", 2, "Asked about her past"),
        { flag: "chat_marit_1" },
        NOTE("marit", "Was every part in every school play in a town of four hundred people at the top of the map."),
        { time: 3 }
      ] },
      { text: "\"Do you narrate everything? Even when it's only gulls?\"", when: (s)=>!s.flags["chat_marit_2"], steps: [
        { say: "rowan", text: "\"Do you narrate everything? Even when it's only gulls?\"" },
        { say: "marit", text: "\"**EVERYTHING!** If I stop, it is just a girl standing on a bollard! With narration it is an **EVENT!** A **HAPPENING!** A **MOMENT IN HISTORY!**\"" },
        { choice: [
          { text: "\"And when you're alone?\"", steps: [
            { say: "rowan", text: "\"And when you're alone?\"" },
            { say: "marit", text: "\"…\"" },
            { text: "A long pause, much quieter than anything she has done all morning." },
            { say: "marit", text: "\"Then I narrate for the walls. The quiet is the part I can't stand. I'd rather fill it with *anything*.\"" },
            AFF("marit", 3, "Asked what she's like alone")
          ] },
          { text: "\"What's wrong with a girl standing on a bollard?\"", steps: [
            { say: "rowan", text: "\"What's wrong with a girl standing on a bollard?\"" },
            { say: "marit", text: "\"Nothing. Nobody looks at her twice, that's all.\"" },
            { text: "It comes out in the ordinary voice, quick, before she can dress it." },
            { say: "marit", text: "\"And then it goes quiet. The quiet is the part I can't stand. I'd rather fill it with *anything*.\"" },
            { say: "rowan", text: "\"I'd have looked twice. The hair alone.\"" },
            { say: "marit", text: "\"…That's going in my notebook. I keep the good lines. With your name on it: I *credit*.\"" },
            AFF("marit", 3, "Would have looked twice")
          ] }
        ] },
        { say: "marit", text: "\"**ANYWAY!** Next question! Make it a *loud* one!\"" },
        { flag: "chat_marit_2" },
        NOTE("marit", "Narrates to fill the quiet: she cannot stand silence."),
        { time: 3 }
      ] },
      { text: "\"This drama society you founded this morning. Who's in it?\"", when: (s)=>!!s.flags["marit_said_society"] && !s.flags["chat_marit_3"], steps: [
        { say: "rowan", text: "\"This drama society you founded this morning. Who's in it?\"" },
        { say: "marit", text: "\"**THE DRAMA SOCIETY!** Membership is **FREE**, auditions are **OPTIONAL**, and parts are assigned **WITHOUT CONSENT!**\"" },
        { say: "marit", text: "\"Current membership: me.\" The aside voice. \"And one gull, on probation.\"" },
        { text: "She sweeps an arm across the after deck like somebody showing a house." },
        { say: "marit", text: "\"But *look* at them! The girl under the parasol has not moved in half an hour: that is **discipline**, I want her for a *tower*. And you —\"" },
        { choice: [
          { text: "\"I've been cast already, haven't I?\"", steps: [
            { say: "rowan", text: "\"I've been cast already, haven't I?\"" },
            { say: "marit", text: "\"As the **BROODING STRANGER**, naturally! It is a *lead!* You are *welcome!*\"" },
            AFF("marit", 2, "Accepted the part")
          ] },
          { text: "\"I don't act. I can barely hold cards when people are looking.\"", steps: [
            { say: "rowan", text: "\"I don't act. I can barely hold cards when people are looking.\"" },
            { say: "marit", text: "\"Then you shall play a man who can barely hold his cards! That is not a problem, that is **CASTING!** The **BROODING STRANGER!** It is a *lead!*\"" },
            { say: "marit", text: "\"Everybody I have ever cast told me first that they don't act.\" Ordinary voice, and kind. \"Then I give them one line and a hat. It's mostly the hat.\"" },
            { flag: "marit_knows_stagefright" },
            AFF("marit", 2, "Said no and got a hat")
          ] }
        ] },
        { say: "rowan", text: "\"Does the stranger have any lines?\"" },
        { say: "marit", text: "\"He has a *look*. Lines are for people who haven't got a look.\"" },
        { flag: "chat_marit_3" },
        { flag: "marit_cast_rowan" },
        NOTE("marit", "Founded a drama society this morning and cast you as the brooding stranger."),
        { time: 3 }
      ] },
      { text: "\"Every part in every play. Is there one you'd still do tomorrow?\"", when: (s)=>!!s.flags["chat_marit_1"] && !s.flags["chat_marit_x"], steps: [
        { say: "rowan", text: "\"Every part in every play. Is there one you'd still do tomorrow?\"" },
        { say: "marit", text: "\"Do I have a **FAVOURITE!** Sit! *Sit!* No — stand — no — **KNEEL** —\"" },
        { say: "marit", text: "\"It is a monologue. It is called **'The Sandwich of Destiny.'** I wrote it when I was eleven. It runs for nine minutes. It is about a boy who is given a sandwich, and *refuses it*, and spends the rest of his life regretting the *mayonnaise!*\"" },
        { choice: [
          { text: "\"…That's quite a lot about a sandwich.\"", steps: [
            { say: "rowan", text: "\"…That's quite a lot about a sandwich.\"" },
            { say: "marit", text: "\"It is the *human condition*, Rowan!\"" }
          ] },
          { text: "\"Go on, then. I've got nine minutes.\"", steps: [
            { say: "rowan", text: "\"Go on, then. I've got nine minutes.\"" },
            { say: "marit", text: "\"'It lay before him on the plate — as all things lie before us — *cut diagonally* —'\"" },
            { text: "A gull lands on the bollard, looks at her and waits. She stops with her hand in the air." },
            { say: "marit", text: "\"No. Not for *him*. He hasn't paid.\" To you, behind her hand: \"You get the rest on land. With a real sandwich. It needs the prop.\"" }
          ] }
        ] },
        { text: "Then, in the quick ordinary voice, very quietly:" },
        { say: "marit", text: "\"It's the only one I wrote with my brother. He did the boy. I did the sandwich.\"" },
        AFF("marit", 3, "Heard about the Sandwich"),
        { flag: "chat_marit_x" },
        NOTE("marit", "Her favourite monologue is 'The Sandwich of Destiny', written with her brother."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_marit"], steps: [
        { scene: "deck_marit" }
      ] },
      { text: "\"I'll let you get back to the gulls.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the gulls.\"" },
        { say: "marit", text: "\"**EXIT** the **PROTAGONIST**, stage left, pursued by a *gull!*\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_marit_done" },
    { say: "marit", text: "\"**THAT** — ladies and gentlemen — was the *finest* interval of the morning!\"" },
    { end: true }
  ]
});

scene("deck_marit", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_marit"], end: true },
    { choice: [
      { text: "\"Hair like two flames, two orange bows in it, a scarf the colour of coals, and you stepped onto a bollard like it was a stage. Let me guess: Phoenix.\"", hint: "From her look", steps: [
        { say: "rowan", text: "\"Hair like two flames, two orange bows in it, a scarf the colour of coals, and you stepped onto a bollard like it was a stage. Let me guess: Phoenix.\"" },
        { say: "marit", text: "\"**OH!** *Oh!* He is **GOOD!** The stranger has **SEEN** me!\"" },
        { say: "marit", text: "\"**PHOENIX ENCORE!** The *rise!* The *fall!* The **RISE AGAIN!**\"" },
        AFF("marit", 3, "Read her from her look")
      ] },
      { text: "\"What do you play, Marit?\"", steps: [
        { say: "rowan", text: "\"What do you play, Marit?\"" },
        { say: "marit", text: "\"**Phoenix Encore!** A *grand* revival, a discard pile in a *petting zoo!* Cute Cat, Cute Dog, Cute **PHOENIX!**\"" },
        AFF("marit", 2, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_marit" },
        { end: true }
      ] }
    ] },
    { text: "Rowan has put one hand over his mouth. Behind it his voice is a steady, level murmur." },
    { say: "rowan", text: "\"…Cute Bird in front. It dies, she discards two, a Phoenix comes off the deck. Cats mill three. Dog comes back out of the pile. Skull Necklace pays on the way down. Glass of Marbles. Gravedigger Slap for every differently named creature in the pile.\" A breath. \"Right. *Right.*\"" },
    { say: "marit", text: "\"Is he — is he doing a *monologue?* He's doing a **monologue!** About *my deck!*\"" },
    { choice: [
      { text: "\"Sorry. Sorry. The discard pile's the engine, not the bin. That's all.\"", steps: [
        { say: "rowan", text: "\"Sorry. Sorry. The discard pile's the engine, not the bin. That's all.\"" },
        { say: "marit", text: "\"It is the **SECOND ACT!** *Thank* you!\"" }
      ] },
      { text: "\"It takes the whole game to arrive. Don't you ever want something faster?\"", steps: [
        { say: "rowan", text: "\"It takes the whole game to arrive. Don't you ever want something faster?\"" },
        { say: "marit", text: "\"No.\"" },
        { text: "The ordinary voice, and no hesitation in it at all." },
        { say: "marit", text: "\"Everybody asks. A phoenix that turns up on turn two is a chicken with ideas. She has to be *missed* first.\"" }
      ] }
    ] },
    DECK("marit")
  ]
});

scene("post_marit", {
  steps: [
    DECK("marit"),
    { when: (s)=>s.duels["ferry_marit"] !== "won", jump: "lost" },
    { text: "The crowd, which has grown to a dozen, applauds the loser. Marit takes a very small, very private bow, and then sits down on the bollard like anybody else." },
    { say: "marit", text: "\"That was the Storm. It never stopped hitting. I couldn't get a Phoenix to stay on the board for more than a turn.\"" },
    { say: "rowan", text: "\"The Cute Bird died while you only had one card in hand. You couldn't discard two, so nothing came off the deck. After that I just kept the Phoenix off the table.\"" },
    { say: "marit", text: "\"You *starved* the Bird. Oh, that's cold.\" A bright, delighted laugh. \"I love it. Nobody's ever had the nerve.\"" },
    { say: "rowan", text: "\"Your deck is gorgeous. I mean it. The discard pile as an engine. I'd never have built it.\"" },
    { say: "marit", text: "\"*Thank* you. I stay up at night thinking nobody understands it.\"" },
    { text: "She looks, for a second, entirely sincere." },
    { say: "marit", text: "\"You do.\"" },
    // Nach Rowans Sieg: Marit lässt für den Sieger sammeln.
    { text: "Then, as if she has remembered that there is a house, she is up on the bollard again. She unwinds the ember scarf from her throat, holds it out like a collection bag, and goes along the line of watchers with it." },
    { say: "marit", text: "\"The **HAT** goes **ROUND!** There *is* no hat! The *SCARF* goes round! Pay the victor, you savages, he has been *magnificent!*\"" },
    { text: "The dozen laugh, and pay. She comes back and tips the scarf out on the bollard beside you: fourteen Smug Coins and one button, which she pockets." },
    { choice: [
      { text: "\"Thank you. I've never been paid by an audience before.\"", steps: [
        { say: "rowan", text: "\"Thank you. I've never been paid by an audience before.\"" },
        { say: "marit", text: "\"Then *remember* the feeling.\" Ordinary voice, very quick: \"They wanted to have paid for something good. You let them. That's half the job.\"" },
        { coins: 14, flag: "marit_gave_coins" }
      ] },
      { text: "\"Give it back to them. Nobody bought a ticket.\"", steps: [
        { say: "rowan", text: "\"Give it back to them. Nobody bought a ticket.\"" },
        { say: "marit", text: "\"A *PRINCIPLED* artist!\" She goes back down the line, returning each coin with a small bow. It takes twice as long as the collection and gets a bigger laugh." },
        { flag: "marit_collection_returned" }
      ] }
    ] },
    { jump: "out" },
    { label: "lost" },
    { text: "The cheering thins out. Marit comes up from her bow and drops, mid-flourish, into her ordinary voice, the quick, wry one." },
    { say: "marit", text: "\"That was lovely. Thank you for letting me. Your Storm was very hard to play around.\"" },
    { say: "rowan", text: "\"I held Chain Lightning for three turns and you discarded two Cute Cats. I thought I had you, and then the Cute Bird died and the Phoenix came back.\"" },
    { say: "marit", text: "\"I really didn't know that would work. I say it as a joke. It is not a joke.\"" },
    { say: "rowan", text: "\"It works because you're willing to throw cards away. Most people can't.\"" },
    { say: "marit", text: "\"It's the **ONLY** thing I'm good at!\"" },
    { label: "out" },
    { choice: [
      { text: "\"Was I shaking? With all of them watching?\"", steps: [
        { say: "rowan", text: "\"Was I shaking? With all of them watching?\"" },
        { say: "marit", text: "\"A little. At the start.\" Plainly. \"Then you forgot about them, somewhere around your third turn. I watched it happen. It was the best part of the show.\"" }
      ] },
      { text: "\"The narration helped, actually. I didn't expect that.\"", steps: [
        { say: "rowan", text: "\"The narration helped, actually. I didn't expect that.\"" },
        { say: "marit", text: "\"It *does* help! Nobody believes me!\" She has gone pink to the bows. \"If somebody is saying what happens, it's a story. You can't be frightened of a story you're in the middle of. There isn't time.\"" }
      ] }
    ] },
    { say: "marit", text: "\"Come and find me at the commentary desk, Rowan Vance — wherever they have hidden it. I'll tell you *everything*.\"" },
    AFF("marit", 1, "Talked it through")
  ]
});

/* ───────────────────────── FREDDIE ───────────────────────── */
scene("ferry_freddie", {
  steps: [
    { when: (s)=>!!s.flags["met_freddie"], jump: "again" },
    { text: "At the stern rail a girl with a mop of wet red hair is hanging over the wake by her waist, bare feet hooked round the lowest bar, peering at the water. Diving goggles are pushed up on her forehead." },
    { text: "A gold jacket with a plain grey collar hangs open over a swimsuit; below it she is wearing the bottom half of a wetsuit, with its empty arms knotted round her middle. A towel is tied to the rail beside her so that the wind cannot have it." },
    { text: "A frond of green algae is plastered in her hair. She is, with great concentration, talking to the sea." },
    { say: "freddie", alias: "Girl with goggles on her head", text: "\"Come on — come ON — I saw you, you big brown — that's a ray. That's a *ray*. Hey! Jacketless! Is that a ray?\"" },
    { choice: [
      { text: "\"I can't see anything. I think that's the shadow of a cloud.\"", steps: [
        { say: "rowan", text: "\"I can't see anything. I think that's the shadow of a cloud.\"" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"A cloud.\"" },
        { text: "She hauls herself upright with one arm, completely unbothered, and looks at you as if you had said something endearing." },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"Shadows don't flap. Come here. Look. *There.*\"" },
        AFF("freddie", 2, "Looked where she pointed")
      ] },
      { text: "\"Should you be hanging off the stern like that?\"", steps: [
        { say: "rowan", text: "\"Should you be hanging off the stern like that?\"" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"Five brothers.\" Cheerfully, hanging there. \"If I'd waited for permission I'd still be stuck in the hallway at home.\"" },
        { flag: "freddie_said_brothers" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"And you've got the face of somebody about to say something about *safety*, so don't. I can swim the last mile of this whole ship's wake, I've timed myself.\"" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"Never mind me, anyway. Come here. Look. *There.*\"" },
        AFF("freddie", 1, "Asked straight")
      ] },
      { text: "\"I'm Rowan. I can hold your jacket, if you want to lean out a bit further.\"", steps: [
        { say: "rowan", text: "\"I'm Rowan. I can hold your jacket, if you want to lean out a bit further.\"" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"Oh, *yes*. Good man. Hold this.\"" },
        { text: "She swings upright, shrugs the gold jacket off and tosses it over. Then, entirely without ceremony, she unknots the wetsuit arms from round her waist and begins to wriggle into the top half of it, right there at the rail, one shoulder at a time, hopping." },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"Turn round if you like. I don't mind either way.\" A pause, one arm in. \"You've gone red. That's sweet. Five brothers, Rowan. There is nothing you could be embarrassed about in front of me that I haven't seen on a sleeping bag.\"" },
        { flag: "freddie_said_brothers" },
        { flag: "freddie_held_jacket" },
        { say: "freddie", alias: "Girl with goggles on her head", text: "\"There. Ready, in case it's friendly.\" She folds herself back over the rail and points straight down. \"Now look. *There.*\"" },
        AFF("freddie", 3, "Helped without making it weird")
      ] }
    ] },
    { text: "You look. Something broad and brown does indeed flap, once, slowly, deep down in the white seam of the wake. Then the wake closes over it." },
    { say: "freddie", alias: "Girl with goggles on her head", text: "\"Ray. *Knew* it.\" A hundred-watt grin. \"Winifred Camara. Freddie. I answer to anything but Winifred.\"" },
    { when: (s)=>!s.flags["freddie_held_jacket"], say: "rowan", text: "\"Rowan Vance. That was a ray.\"" },
    { when: (s)=>!!s.flags["freddie_held_jacket"], say: "rowan", text: "\"Freddie, then. That was a ray.\"" },
    MET("freddie", "Freddie Camara"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"She's got SEAWEED in her HAIR! Is that ALLOWED?\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Suits her.\"" },
    { when: (s)=>!s.flags["freddie_held_jacket"], text: "She pulls a fat pencil out of her wet hair and a small notebook with a rubber cover out of her jacket pocket, and draws the ray in about six lines. It is brown. It is flat. It looks faintly pleased with itself." },
    { when: (s)=>!!s.flags["freddie_held_jacket"], text: "She pulls a fat pencil out of her wet hair and, without asking, a small notebook with a rubber cover out of the pocket of the jacket you are holding, and draws the ray in about six lines. It is brown. It is flat. It looks faintly pleased with itself." },
    { say: "freddie", text: "\"Game Design, first year. That's what the gold's for.\" She does not look up from the page. \"I'm going to draw every single thing that lives in the sea and put it on a card. All of them. That's one.\"" },
    { flag: "freddie_said_design" },
    NOTE("freddie", "Game Design student. Means to draw every creature in the sea as a card."),
    { choice: [
      { text: "\"Every single thing? There must be thousands.\"", steps: [
        { say: "rowan", text: "\"Every single thing? There must be thousands.\"" },
        { say: "freddie", text: "\"Hundreds of thousands! And those are only the ones somebody's met. I'm nineteen. I've got time.\"" },
        AFF("freddie", 1, "Did the sums")
      ] },
      { text: "\"What does the ray do, as a card?\"", steps: [
        { say: "rowan", text: "\"What does the ray do, as a card?\"" },
        { say: "freddie", text: "\"Ooh.\" The pencil stops. Nobody, it is clear, has asked this before breakfast. \"She lies flat on the bottom and does absolutely nothing. Until somebody treads on her.\"" },
        { say: "rowan", text: "\"And then?\"" },
        { say: "freddie", text: "\"Then they wish they hadn't. I'll do the numbers later. Somebody here must be good at numbers.\"" },
        AFF("freddie", 3, "Asked what the ray does")
      ] },
      { text: "\"Why cards? You could just study the sea.\"", steps: [
        { say: "rowan", text: "\"Why cards? You could just study the sea.\"" },
        { say: "freddie", text: "\"Because if you study an octopus you have to write down what it *did*. I want to decide what it does. That's a much better job.\"" },
        AFF("freddie", 2, "Asked why cards")
      ] }
    ] },
    { say: "freddie", text: "\"I'd have come for the sea alone, mind. They built a card school on an *island* and then wrote and asked whether I'd like to go. I'm going to swim round the whole thing before the end of the week, and then round the other way. You in? I mean it.\"" },
    { text: "She nods at the towel knotted to the rail." },
    { say: "freddie", text: "\"If not, you can hold the towel. It's a proper job.\"" },
    { choice: [
      { text: "\"I'm in. Slowly.\"", steps: [
        { say: "rowan", text: "\"I'm in. Slowly.\"" },
        { say: "freddie", text: "\"Slowly's allowed! I'll tow you on the hard bits.\"" },
        { flag: "freddie_swim_in" },
        AFF("freddie", 2, "Said yes to the swim")
      ] },
      { text: "\"I'll hold the towel.\"", steps: [
        { say: "rowan", text: "\"I'll hold the towel.\"" },
        { say: "freddie", text: "\"Towel man! Every expedition needs one. You'd be amazed how few people volunteer.\"" },
        AFF("freddie", 1, "Took the towel job")
      ] },
      { text: "\"Has anybody told you that you're allowed to?\"", steps: [
        { say: "rowan", text: "\"Has anybody told you that you're allowed to?\"" },
        { say: "freddie", text: "\"Nobody's told me I'm *not*.\" Serenely. \"I find it's best not to ask until afterwards. Then it's just a story.\"" }
      ] }
    ] },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { choice: [
      { text: "\"Do you play as well, or only draw? I'd take a game.\"", steps: [
        { say: "rowan", text: "\"Do you play as well, or only draw? I'd take a game.\"" },
        { flag: "freddie_go_game" }
      ] },
      { text: "Stay at the rail a while. The wake is worth looking at.", steps: [
        { text: "You lean on the rail beside her. She makes room without looking, the way people do who grew up short of room." },
        { scene: "chat_freddie" }
      ] },
      { text: "\"I'll leave you to the ray.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to the ray.\"" },
        { say: "freddie", text: "\"She's gone. There'll be another. There's always another, that's the nice thing about the sea.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["freddie_go_game"], jump: "game" },
    { end: true },

    { label: "again" },
    { when: (s)=>!!s.flags["freddie_held_jacket"], say: "freddie", text: "\"Jacket man! Come and look at this, there's a — oh, it's gone.\"" },
    { when: (s)=>!s.flags["freddie_held_jacket"], say: "freddie", text: "\"Jacketless! Come and look at this, there's a — oh, it's gone.\"" },
    { text: "She leans out again, unashamed and upside down." },
    { say: "freddie", text: "\"It was a *shark*. Probably.\"" },
    { time: 4 },
    { choice: [
      { text: "\"Fancy a game, Freddie?\"", when: (s)=>!s.flags["flag_freddie_game"], steps: [
        { say: "rowan", text: "\"Fancy a game, Freddie?\"" },
        { flag: "freddie_go_game" }
      ] },
      { text: "Lean on the rail next to her for a bit.", when: (s)=>!s.flags["chat_freddie_done"], steps: [
        { text: "You lean on the rail. She comes back up the right way round, pink in the face, and shoves the goggles higher." },
        { scene: "chat_freddie" }
      ] },
      { text: "Wave and let her look for the shark.", steps: [
        { text: "She waves back with one foot." }
      ] }
    ] },
    { when: (s)=>!!s.flags["freddie_go_game"], jump: "game" },
    { end: true },

    { label: "game" },
    { unflag: "freddie_go_game" },
    { say: "freddie", text: "\"A game! Brilliant. I get to show off Mizune.\"" },
    { text: "She sits down on the wet planks as if they were dry and deals out of a deck box that has, at some point, been in the sea." },
    { duel: "ferry_freddie", opponent: "freddie", opponentName: "Freddie Camara", mustWin: false,
      onWin: [
        { say: "freddie", text: "\"Oh, you beat me! Good. That's fair, I never got to the Aquatics. Does that count as a loss?\"" },
        { text: "She does not seem to mind in the least." },
        { say: "freddie", text: "\"It was lovely to look at, anyway.\"" },
        AFF("freddie", 2, "Good game")
      ],
      onLose: [
        { say: "freddie", text: "\"I WON! With the *sea*! Did you see the Golem? Did you see the whole *aquarium*?\" She hugs the nearest rail. \"Nobody expects the aquarium.\"" },
        AFF("freddie", 2, "Played a proper game")
      ] },
    { scene: "post_freddie" },
    { flag: "flag_freddie_game" },
    { time: 25 },
    { end: true }
  ]
});

scene("chat_freddie", {
  steps: [
    { label: "top" },
    { when: (s)=>!!(s.flags["chat_freddie_1"] && s.flags["chat_freddie_2"] && s.flags["chat_freddie_3"]) && !s.flags["chat_freddie_done"], jump: "done" },
    { choice: [
      { text: "\"Every creature in the sea. Which one do you draw first?\"", when: (s)=>!!s.flags["freddie_said_design"] && !s.flags["chat_freddie_2"], steps: [
        { say: "rowan", text: "\"Every creature in the sea. Which one do you draw first?\"" },
        { say: "freddie", text: "\"Octopuses.\" No hesitation. \"They have three hearts, they can open jars, and every single time somebody tells them to stay in the tank, they leave. I think we'd get on.\"" },
        { choice: [
          { text: "\"Can I see the notebook?\"", steps: [
            { say: "rowan", text: "\"Can I see the notebook?\"" },
            { text: "She hands it over at once, wet thumbprint and all. Page after page of fat, quick pencil: an octopus halfway out of a jar, a crab in a hat, this morning's ray. Every drawing has a label. RAY (DEFINITE). SHARK (PROBABLY). SOMETHING (BIG)." },
            { say: "rowan", text: "\"The crab has a hat.\"" },
            { say: "freddie", text: "\"A teacher told me that one wasn't *accurate*.\" She takes the notebook back and smooths the page. \"Crabs would wear hats if they could get them. That's not inaccurate. That's just early.\"" },
            AFF("freddie", 3, "Looked through the notebook")
          ] },
          { text: "\"Leave the tank for where?\"", steps: [
            { say: "rowan", text: "\"Leave the tank for where?\"" },
            { say: "freddie", text: "\"Anywhere! Down a drain, mostly. They find one of them in the wrong tank in the morning, eating the neighbours.\" With deep approval. \"Nobody asks an octopus where it thinks it's going. It just goes.\"" },
            { say: "rowan", text: "\"And that's the plan for the island.\"" },
            { say: "freddie", text: "\"That's the plan for *everything*.\"" },
            AFF("freddie", 2, "Asked about the octopus")
          ] }
        ] },
        { say: "freddie", text: "\"The notebook's waterproof, by the way. It has to be. So's the pencil. I've lost three to the sea and one to a brother. There are five of those, so that's not bad going.\"" },
        { flag: "freddie_said_brothers" },
        { flag: "chat_freddie_2" },
        NOTE("freddie", "Loves octopuses: three hearts, open jars, never stay in the tank. Keeps a waterproof notebook."),
        { time: 3 }
      ] },
      { text: "\"Show me one of the cards. A finished one.\"", when: (s)=>!!s.flags["freddie_said_design"] && !s.flags["chat_freddie_3"], steps: [
        { say: "rowan", text: "\"Show me one of the cards. A finished one.\"" },
        { say: "freddie", text: "\"Finished! Hello! Yes!\"" },
        { text: "The notebook flips open at a page gone soft with handling. A long, low, dark-green creature looks out of a hole in a rock with an expression of settled disapproval." },
        { say: "freddie", text: "\"Look. This is Moray, the Eel With Opinions. She can't be Burned, because she's wet, and she can't be Frozen, because she's an eel.\"" },
        { choice: [
          { text: "\"That would break the game.\"", steps: [
            { say: "rowan", text: "\"That would break the game.\"" },
            { say: "freddie", text: "\"Then they'll have to put a *rule* about it.\" She grins. \"Isn't that the best thing about cards? You get to make the rules.\"" },
            AFF("freddie", 2, "Took the eel seriously")
          ] },
          { text: "\"What are her opinions?\"", steps: [
            { say: "rowan", text: "\"What are her opinions?\"" },
            { say: "freddie", text: "\"Strong! She thinks sharks are overrated, she thinks the tide is late, and she thinks you're standing in her doorway. She's right about two of them.\"" },
            { say: "rowan", text: "\"It's a good face. You can tell she's right before she says anything.\"" },
            { say: "freddie", text: "\"…You *get* her.\" For once she is briefly short of words. \"Nobody gets her on the first go.\"" },
            AFF("freddie", 3, "Admired her card")
          ] }
        ] },
        { say: "freddie", text: "\"At home, if you leave a drawing on the table, one of five brothers puts a moustache on it. Here somebody has to *mark* it. Out of ten! With a pen! I can't wait.\"" },
        { flag: "freddie_said_brothers" },
        { say: "freddie", text: "\"I can't balance anything, mind. I know that.\" Perfectly cheerful about it. \"I'll find somebody in gold who's good at sums and feed them fish until they help.\"" },
        { flag: "chat_freddie_3" },
        NOTE("freddie", "Her first card is Moray, the Eel With Opinions. She draws; somebody else will have to do the sums."),
        { time: 3 }
      ] },
      { text: "\"Five brothers. Where do you come in?\"", when: (s)=>!!s.flags["freddie_said_brothers"] && !s.flags["chat_freddie_1"], steps: [
        { say: "rowan", text: "\"Five brothers. Where do you come in?\"" },
        { say: "freddie", text: "\"Smack in the middle! Three older, two younger. Sandwich filling. You learn very quickly who's going to shout, who's going to steal your sandwich, and who needs you to hold the little one's hand.\"" },
        { say: "freddie", text: "\"One bathroom. Seven people. If you have shame, you have it for about a week, and then you have a towel.\"" },
        { choice: [
          { text: "\"That explains the towel.\"", steps: [
            { say: "rowan", text: "\"That explains the towel.\"" },
            { say: "freddie", text: "\"It explains *everything*.\"" },
            AFF("freddie", 2, "Asked about her family")
          ] },
          { text: "\"And who held your hand?\"", steps: [
            { say: "rowan", text: "\"And who held your hand?\"" },
            { text: "She thinks about it honestly, folded over the rail again, with her hair hanging down towards the wake." },
            { say: "freddie", text: "\"Nobody had to. I was the one who could swim.\" Then, quickly, the right way up again: \"That's not a sad thing! They had each other and I had the whole sea. I got the better half.\"" },
            AFF("freddie", 3, "Asked who looked after her")
          ] }
        ] },
        { say: "freddie", text: "\"It's the one place nobody was ever ahead of me in the queue, the water. You get in, and it's all yours, right to the edges.\"" },
        { say: "freddie", text: "\"Bungalow four, my letter says. Four beds.\" She counts them off on her fingers and beams. \"*Four*. I'm going to have a shelf.\"" },
        { flag: "chat_freddie_1" },
        NOTE("freddie", "Middle of five brothers, three older and two younger. One bathroom, no shame. The sea was the one place that was all hers."),
        { time: 3 }
      ] },
      { text: "\"The other swimmer, on the rail with the towel. Have you two met?\"", when: (s)=>!!s.flags["met_sunny"] && !s.flags["chat_freddie_4"], steps: [
        { say: "rowan", text: "\"The other swimmer, on the rail with the towel. Have you two met?\"" },
        { say: "freddie", text: "\"Oh, *Sunny*.\" Warmly, and a little threatening. \"We were both after the same bucket. We're racing at dawn tomorrow. Two kilometres. She thinks she's going to win. She has no idea about my breaststroke.\"" },
        { choice: [
          { text: "\"She says she's seen your breaststroke.\"", when: (s)=>!!s.flags["chat_sunny_4"], steps: [
            { say: "rowan", text: "\"She says she's seen your breaststroke.\"" },
            { say: "freddie", text: "\"She has *not*. She's seen the one I do when people are looking.\"" }
          ] },
          { text: "\"Racing where? Nobody's seen the island yet.\"", steps: [
            { say: "rowan", text: "\"Racing where? Nobody's seen the island yet.\"" },
            { say: "freddie", text: "\"There'll be water. It's an island. That's what the word *means*.\"" }
          ] },
          { text: "\"She looks fast.\"", steps: [
            { say: "rowan", text: "\"She looks fast.\"" },
            { say: "freddie", text: "\"She looks *very* fast. Shoulders like a wardrobe. I'm not fast. I just don't stop, and people find that upsetting round about the second kilometre.\"" }
          ] }
        ] },
        { say: "freddie", text: "\"I'm going to let her think she's winning for a *bit*.\"" },
        { say: "freddie", text: "\"She keeps looking over here, have you noticed? Like I'm about to do something.\" Innocently, with her eyes on the drop below the rail. \"I can't think what.\"" },
        AFF("freddie", 1, "Mentioned Sunny"),
        { flag: "chat_freddie_4" },
        REL("sunny", "freddie"),
        NOTE("freddie", "Is racing Sunny at dawn tomorrow."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_freddie"], steps: [
        { scene: "deck_freddie" }
      ] },
      { text: "\"I'll let you get back to the sea.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the sea.\"" },
        { say: "freddie", text: "\"It'll still be here. That's the other nice thing about it. Go on, off with you!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_freddie_done" },
    { say: "freddie", text: "\"Right! That's me! Biography, anatomy and a free eel! You've been wonderful. Hold the towel next time.\"" },
    { end: true }
  ]
});

scene("deck_freddie", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_freddie"], end: true },
    { choice: [
      { text: "\"Diving goggles on your forehead, algae in your hair, wet from head to foot. I'm guessing the deck is the sea. Aquatic?\"", hint: "From her gear", steps: [
        { say: "rowan", text: "\"Diving goggles on your forehead, algae in your hair, wet from head to foot. I'm guessing the deck is the sea. Aquatic?\"" },
        { say: "freddie", text: "\"AQUATIC!\"" },
        { text: "She slaps the rail so hard that a gull relocates." },
        { say: "freddie", text: "\"He's *seen* me! Aquatic! Silent Water Mizune! She's the best-looking hero in the whole game, and everything else follows!\"" },
        AFF("freddie", 3, "Read her from her gear")
      ] },
      { text: "\"What do you play, Freddie?\"", steps: [
        { say: "rowan", text: "\"What do you play, Freddie?\"" },
        { say: "freddie", text: "\"Aquatic! Mizune! It's the sea! It's gorgeous! You'll love it!\"" },
        AFF("freddie", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_freddie" },
        { end: true }
      ] }
    ] },
    { text: "Rowan has stopped listening to her and started on the sea." },
    { say: "rowan", text: "\"…Mizune sends a Surprise to the discard, draws a card. Water Golem for the Surprise. Frolake draws two. Land Sharks, Narwhal, Diver Helmet. Aquatic Shield.\"" },
    { say: "rowan", text: "\"Aquatic Arrows. Aquatic Spear.\" He stops. \"Aquatic Arrows is Destruction Magic. Mizune hasn't got Destruction Magic. None of your heroes have.\"" },
    { say: "freddie", text: "\"…\"" },
    { text: "A very long, very serene pause." },
    { say: "freddie", text: "\"They're *aquatic*. Casting them is not the *point*.\"" },
    { say: "rowan", text: "\"Then what's the point?\"" },
    { say: "freddie", text: "\"Look at them! They've got *waves* on! They've got a little *fish*!\"" },
    { text: "She holds up a card she apparently carries about in her hand." },
    { say: "freddie", text: "\"They look gorgeous *in my hand*!\"" },
    { choice: [
      { text: "\"…That's — fair. They do.\"", steps: [
        { say: "rowan", text: "\"…That's — fair. They do.\"" },
        { say: "freddie", text: "\"Thank you! Somebody drew that fish on purpose. The least I can do is hold it.\"" }
      ] },
      { text: "\"You're going to lose a lot of games that way.\"", steps: [
        { say: "rowan", text: "\"You're going to lose a lot of games that way.\"" },
        { say: "freddie", text: "\"Probably!\" Sunnily. \"But I'll be looking at a little fish the whole time, and what will *they* be looking at? Sums.\"" }
      ] }
    ] },
    DECK("freddie")
  ]
});

scene("post_freddie", {
  steps: [
    DECK("freddie"),
    { when: (s)=>s.duels["ferry_freddie"] !== "won", jump: "lost" },
    { text: "Freddie is studying the board with the cheerful attention of a naturalist who has found a very interesting dead fish." },
    { say: "freddie", text: "\"I couldn't cast a single Aquatic. Not *one*. Not even Aquatic Shield, and Mizune can cast that.\" She considers. \"That's a design flaw. Do you want to hear my solution?\"" },
    { choice: [
      { text: "\"Is it 'add a Destruction Magic hero'?\"", steps: [
        { say: "rowan", text: "\"Is it 'add a Destruction Magic hero'?\"" },
        { say: "freddie", text: "\"…Ah. No. It's 'bigger crabs'.\"" }
      ] },
      { text: "\"Go on. I want to hear it.\"", steps: [
        { say: "rowan", text: "\"Go on. I want to hear it.\"" },
        { say: "freddie", text: "\"Bigger crabs.\"" },
        { say: "rowan", text: "\"That's the whole solution.\"" },
        { say: "freddie", text: "\"It's a first draft. They're all bigger crabs, at the first draft.\"" }
      ] }
    ] },
    { jump: "out" },
    { label: "lost" },
    { text: "Freddie is on her back on the planks with her arms spread, looking up at the sky." },
    { say: "freddie", text: "\"I *won*. With a Water Golem and a shark. The Aquatics didn't do anything at all, and I won anyway.\" She is thrilled. \"Is that allowed? Is it *always* going to be this easy?\"" },
    { choice: [
      { text: "\"It isn't. You had a lot of draw and I had nowhere to hide.\"", steps: [
        { say: "rowan", text: "\"It isn't. You had a lot of draw and I had nowhere to hide.\"" },
        { say: "freddie", text: "\"Mizune did that! I'll tell her.\" She pats the deck box. \"Good girl.\"" }
      ] },
      { text: "\"Don't tell anyone how you did it. They'll want an aquarium too.\"", steps: [
        { say: "rowan", text: "\"Don't tell anyone how you did it. They'll want an aquarium too.\"" },
        { say: "freddie", text: "\"They can't have mine.\" She pats the deck box. \"Good girl, Mizune. He's a nice loser. We like him.\"" }
      ] }
    ] },
    { label: "out" },
    { text: "She rolls onto her front, drags one of your Gathering Storms across the planks by its corner, and holds it up against the sky to look at it properly." },
    { when: (s)=>s.duels["ferry_freddie"] === "won", say: "freddie", text: "\"It's *plain*.\" Delighted, and a little scandalised. \"No waves. Not even a little fish. It's a *Common*. You beat me with a Common!\"" },
    { when: (s)=>s.duels["ferry_freddie"] !== "won", say: "freddie", text: "\"It's *plain*.\" Delighted, and a little scandalised. \"No waves. Not even a little fish. It's a *Common*. You nearly beat me with a Common!\"" },
    { when: (s)=>!!s.flags["rowan_commons_seen"], say: "rowan", text: "\"They're all Commons. Half the ship's told me so already.\"" },
    { when: (s)=>!!s.flags["rowan_commons_seen"], say: "freddie", text: "\"Well, I'm telling you *louder*.\"" },
    { when: (s)=>!s.flags["rowan_commons_seen"], say: "rowan", text: "\"They're all Commons. It was a prize: they printed the list I won with, card for card.\"" },
    { say: "freddie", text: "\"Mine are the other way round. Gorgeous, and they don't do anything.\" She says it with enormous affection, and hands the Storm back." },
    { choice: [
      { text: "\"Yours are better to look at.\"", steps: [
        { say: "rowan", text: "\"Yours are better to look at.\"" },
        { say: "freddie", text: "\"Everybody's are better to look at than *yours*. That's not a criticism. It's a public service.\"" }
      ] },
      { text: "\"Mine are built to win. Yours are built to be looked at. Both work.\"", steps: [
        { say: "rowan", text: "\"Mine are built to win. Yours are built to be looked at. Both work.\"" },
        { say: "freddie", text: "\"One of them works.\" Sunnily. \"But I know which one I'd take swimming.\"" }
      ] }
    ] },
    // Geschenk nach Rowans Sieg: eine Karte zum Ansehen, mit Fisch.
    { when: (s)=>s.duels["ferry_freddie"] === "won", text: "She fishes a card out of the front of her deck box and lays it face up on the Storm in your hand. It has waves on it. In one corner, very small, there is a fish." },
    { when: (s)=>s.duels["ferry_freddie"] === "won", say: "freddie", text: "\"Aquatic Arrows. I can't cast it anyway, so it isn't a sacrifice, it's a *rescue*. You won. Now you've got one card worth looking at.\"" },
    { when: (s)=>s.duels["ferry_freddie"] === "won", choice: [
      { text: "\"You know my heroes can cast that one.\"", steps: [
        { say: "rowan", text: "\"You know my heroes can cast that one.\"" },
        { say: "freddie", text: "\"…Oh *no*.\" A long look at the card, and then at you. \"Then don't. Promise me you'll mostly just look at it.\"" },
        { card: "Aquatic Arrows", rarity: "rare", flag: "freddie_gave_arrows" }
      ] },
      { text: "\"Keep your fish. Your deck needs all the looking at it can get.\"", steps: [
        { say: "rowan", text: "\"Keep your fish. Your deck needs all the looking at it can get.\"" },
        { say: "freddie", text: "\"It *does*, doesn't it?\" She takes it back and kisses it once, absent-mindedly, the way people kiss a pebble for luck." },
        { flag: "freddie_gift_refused" }
      ] }
    ] },
    { flag: "rowan_commons_seen" },
    AFF("freddie", 1, "Talked it through")
  ]
});

/* ───────────────────────── RAFA (new arrival) ───────────────────────── */
scene("ferry_rafa", {
  steps: [
    { when: (s)=>!!s.flags["met_rafa"], jump: "again" },
    { text: "You smell him before you see him. On a deck that has smelled of salt and diesel since last night, something is suddenly giving off ginger, lemon, and a sharp edge of pepper." },
    { text: "Beside the luggage cage a steel door marked GALLEY — CREW ONLY is wedged open with a crate of onions, and steam is coming up the steps behind it." },
    { text: "In front of it a round-faced, broad-shouldered boy has set the ship's biggest kettle on a second crate and is ladling from it into a row of tin mugs." },
    { text: "His black jacket, blue collar, has its sleeves shoved up past the elbow; a chef's bandana is knotted over short, neat twists; a stalk of something green is going steadily from one corner of his mouth to the other." },
    { text: "He is not giving the mugs to everybody. A boy strolls past whistling and gets a nod. Then the cook's eyes land on you, and he looks at you for a moment the way a cook looks into a pot." },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"You eaten?\"" },
    { choice: [
      { text: "\"A cocoa. Some time before midnight.\"", steps: [
        { say: "rowan", text: "\"A cocoa. Some time before midnight.\"" },
        { say: "rafa", alias: "Boy in a chef's bandana", text: "\"That's not eating. That's a rumour about eating. Here.\"" },
        AFF("rafa", 2, "Said what was wrong")
      ] },
      { text: "\"I'm fine, thanks.\"", steps: [
        { say: "rowan", text: "\"I'm fine, thanks.\"" },
        { say: "rafa", alias: "Boy in a chef's bandana", text: "\"Mm.\" He is already filling a mug. \"That's what the face says, too. 'Fine.' In very small letters. Hold this, it's hot.\"" }
      ] },
      { text: "\"Is this official? You don't look like crew.\"", steps: [
        { say: "rowan", text: "\"Is this official? You don't look like crew.\"" },
        { say: "rafa", alias: "Boy in a chef's bandana", text: "\"I am deeply unofficial. Take a mug before somebody notices.\"" },
        AFF("rafa", 1, "Asked, then took the mug")
      ] }
    ] },
    { text: "The tin is almost too hot to hold. You hold it anyway, in both hands. The first mouthful is ginger and lemon and honey; the pepper arrives a second later, at the back, like somebody knocking." },
    { text: "It is the first warm thing you have had since the cocoa, and it goes down a long way." },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"Ginger for the stomach, lemon for the head, honey because the ship had honey. The pepper is so you remember it. Rafael Okonjo. Rafa.\"" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    MET("rafa", "Rafa Okonjo"),
    NOTE("rafa", "Talked his way into the ship's galley and hands out hot ginger to anyone who looks unhappy."),
    { flag: "rafa_fed_rowan" },
    { choice: [
      { text: "\"How did you get into the galley?\"", steps: [
        { say: "rowan", text: "\"How did you get into the galley?\"" },
        { say: "rafa", text: "\"I asked the lady who runs the hatch downstairs whether her ginger was fresh. It was not. We had a conversation about it.\"" },
        { say: "rafa", text: "\"Now I have a kettle and she has a recipe.\" He shrugs, unhurried. \"That's most of how you get into anywhere.\"" },
        AFF("rafa", 1, "Asked how he did it")
      ] },
      { text: "\"What do I owe you?\"", steps: [
        { say: "rowan", text: "\"What do I owe you?\"" },
        { say: "rafa", text: "\"A clean mug. And the truth: more lemon, or no?\"" },
        { choice: [
          { text: "\"A little more. Just a little.\"", steps: [
            { say: "rowan", text: "\"A little more. Just a little.\"" },
            { say: "rafa", text: "\"A little more.\" He says it like a man being handed money. \"Thank you. Everybody says 'lovely'. 'Lovely' teaches me nothing.\"" },
            AFF("rafa", 3, "Gave an honest review")
          ] },
          { text: "\"No. Don't touch it.\"", steps: [
            { say: "rowan", text: "\"No. Don't touch it.\"" },
            { say: "rafa", text: "\"Don't touch it.\" He nods slowly, and the green stalk changes sides. \"Okay. That I can also work with.\"" },
            AFF("rafa", 2, "Meant the compliment")
          ] }
        ] }
      ] },
      { text: "Drink the rest and say nothing.", steps: [
        { text: "You drink it to the bottom. He watches the mug, not you, and when it comes down empty he takes it out of your hands with visible satisfaction." },
        { say: "rafa", text: "\"That's the right review.\"" },
        AFF("rafa", 2, "Emptied the mug")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is there MORE? Is it FREE? It needs more HONEY! It's BRILLIANT!\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "rafa", text: "\"…More honey.\" He looks at Nathan with the beginning of real respect. \"Noted. Thank you.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Smells good.\"" },
    { say: "rafa", text: "\"So.\" He refills your mug without asking and puts it back into your hands. \"Up all night, that I can see. What I can't see is which it is. The sea, or the island?\"" },
    { choice: [
      { text: "\"Only the night. I had a bench under a lifeboat.\"", steps: [
        { say: "rowan", text: "\"Only the night. I had a bench under a lifeboat.\"" },
        { say: "rafa", text: "\"Okay. No sleep I can't fix. What I can fix is eleven o'clock, when no sleep finds out it is also hungry. Find me on land.\"" }
      ] },
      { text: "\"The island. Everybody on this ship has played on a real table. I haven't.\"", steps: [
        { say: "rowan", text: "\"The island. Everybody on this ship has played on a real table. I haven't.\"" },
        { say: "rafa", text: "\"Hm.\" He chews on it, literally. \"I had never cooked in a kitchen with a walk-in cold room. I was frightened of it a whole summer. You know what it is? A cupboard. A cold cupboard, with a light.\"" },
        { say: "rafa", text: "\"Your table is a cupboard, Rowan. Drink.\"" },
        { flag: "rafa_knows_table" },
        AFF("rafa", 3, "Said what was really wrong")
      ] },
      { text: "\"Does everyone get questioned with their ginger?\"", steps: [
        { say: "rowan", text: "\"Does everyone get questioned with their ginger?\"" },
        { say: "rafa", text: "\"Only the ones who finish the mug.\" A slow, easy smile. \"The others I just watch.\"" },
        AFF("rafa", 1, "Teased him back")
      ] }
    ] },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { choice: [
      { text: "Stay by the kettle while the mug lasts.", steps: [
        { scene: "chat_rafa" }
      ] },
      { text: "\"Thank you, Rafa. I'll bring the mug back.\"", steps: [
        { say: "rowan", text: "\"Thank you, Rafa. I'll bring the mug back.\"" },
        { say: "rafa", text: "\"Bring it back empty. That's the only rule I've got.\"" }
      ] }
    ] },
    { end: true },

    { label: "again" },
    { text: "The kettle is lower than it was, and the row of tin mugs shorter. Rafa has a different green stalk in his mouth and the same unhurried eye." },
    { when: (s)=>!!s.flags["rafa_knows_table"], say: "rafa", text: "\"Cupboard man.\" He is already pouring. \"You look one mug better than before. Let us make it two.\"" },
    { when: (s)=>!s.flags["rafa_knows_table"], say: "rafa", text: "\"Rowan.\" He is already pouring. \"You look one mug better than before. Let us make it two.\"" },
    { time: 3 },
    { choice: [
      { text: "Take the mug and stay a while.", when: (s)=>!s.flags["chat_rafa_done"], steps: [
        { scene: "chat_rafa" }
      ] },
      { text: "Take the mug, thank him and go.", steps: [
        { say: "rowan", text: "\"Thank you. Again.\"" },
        { say: "rafa", text: "\"Empty, remember.\"" }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_rafa", {
  steps: [
    { label: "top" },
    { when: (s)=>!!(s.flags["chat_rafa_1"] && s.flags["chat_rafa_2"] && s.flags["chat_rafa_3"]) && !s.flags["chat_rafa_done"], jump: "done" },
    { choice: [
      { text: "\"You let that whistling boy walk straight past. Why did I get a mug?\"", when: (s)=>!s.flags["chat_rafa_1"], steps: [
        { say: "rowan", text: "\"You let that whistling boy walk straight past. Why did I get a mug?\"" },
        { say: "rafa", text: "\"He had eaten. You can see it in the shoulders. People think hungry looks like hungry. Mostly it looks like 'fine'.\"" },
        { say: "rafa", text: "\"I am not handing these out, see. I am putting them where they are needed. It's a different job.\"" },
        { choice: [
          { text: "\"And what do I look like?\"", steps: [
            { say: "rowan", text: "\"And what do I look like?\"" },
            { say: "rafa", text: "\"Like a man who spent the last of his money some time yesterday and has been making one supper last ever since.\"" },
            { say: "rowan", text: "\"…How do you know about the money?\"" },
            { say: "rafa", text: "\"I don't. I know about the mug.\" He nods at your hands. \"Two hands round it, and you have not put it down once. Someone who had dinner holds it with one.\"" },
            AFF("rafa", 2, "Let himself be read")
          ] },
          { text: "\"And who feeds you?\"", steps: [
            { say: "rowan", text: "\"And who feeds you?\"" },
            { text: "The green stalk stops moving. It is, you realise, the first time it has stopped." },
            { say: "rafa", text: "\"…Huh. Nobody on this boat has asked me that.\"" },
            { say: "rafa", text: "\"Right now? Fried plantain. Very ripe, nearly black, a little salt. Somebody else's pan, so I don't have to wash it.\" He laughs, low. \"Now I'm hungry. Look what you did.\"" },
            { flag: "rafa_wants_plantain" },
            AFF("rafa", 3, "Asked what he would eat")
          ] }
        ] },
        { flag: "chat_rafa_1" },
        NOTE("rafa", "Says hungry people mostly look 'fine', and can tell who has eaten by how they hold a mug."),
        { time: 3 }
      ] },
      { text: "\"What is that you're chewing?\"", when: (s)=>!s.flags["chat_rafa_2"], steps: [
        { say: "rowan", text: "\"What is that you're chewing?\"" },
        { say: "rafa", text: "\"Lemongrass.\" He takes it out, considers the end, puts it back. \"The galley had a bunch going soft. Before that, a clove. Clove is for the teeth. Lemongrass is for the stomach. After a heavy meal you want fennel.\"" },
        { choice: [
          { text: "\"Does any of that work?\"", steps: [
            { say: "rowan", text: "\"Does any of that work?\"" },
            { say: "rafa", text: "\"My aunt says so, and she has run a restaurant for twenty years without one bad tooth in the kitchen. I do not argue with numbers like that.\"" }
          ] },
          { text: "\"Is there anything you haven't got a plant for?\"", steps: [
            { say: "rowan", text: "\"Is there anything you haven't got a plant for?\"" },
            { say: "rafa", text: "\"Missing home. Nothing grows for that.\" Easily, as a fact about gardening. \"For that you cook what your aunt cooked, and you eat it standing up.\"" }
          ] }
        ] },
        { say: "rafa", text: "\"Aunty's place is in a port city a long way from here. I grew up over it — born somewhere else again, raised on the smell coming up through the floor. You learn what time it is by what's frying.\"" },
        { say: "rowan", text: "\"What time is it now?\"" },
        { say: "rafa", text: "\"On this boat?\" He sniffs. \"Diesel and yesterday's cinnamon rolls. That is no time at all. That's why I had to do something.\"" },
        AFF("rafa", 2, "Asked what he was chewing"),
        { flag: "chat_rafa_2" },
        NOTE("rafa", "Born far from here, raised over his aunt's restaurant in a big port city. Always chewing something, and knows what it is good for."),
        { time: 3 }
      ] },
      { text: "\"Black jacket. Auxiliary. And you spent the crossing in a galley.\"", when: (s)=>!s.flags["chat_rafa_3"], steps: [
        { say: "rowan", text: "\"Black jacket. Auxiliary. And you spent the crossing in a galley.\"" },
        { say: "rafa", text: "\"Event staff. Catering, mostly. Somebody has to feed a tournament.\" He turns his hands over: big, quick, freckled with small old burns. \"I play too. I'm all right. My deck is all spices.\"" },
        { say: "rafa", text: "\"A good game and a good stew go wrong the same ways. Too much pepper and you can't taste the pot.\"" },
        { choice: [
          { text: "\"What are the other ways?\"", steps: [
            { say: "rowan", text: "\"What are the other ways?\"" },
            { say: "rafa", text: "\"You rush it. You crowd the pan. Or you cook for the person you wish had come, and not the one sitting at the table.\"" },
            { say: "rowan", text: "\"That last one isn't about cards.\"" },
            { say: "rafa", text: "\"It is a little about cards.\"" },
            AFF("rafa", 2, "Asked for the recipe")
          ] },
          { text: "\"Which did you look for first on the campus map? The arena or the kitchens?\"", steps: [
            { say: "rowan", text: "\"Which did you look for first on the campus map? The arena or the kitchens?\"" },
            { say: "rafa", text: "\"…There are three kitchens.\" He does not even pretend to think. \"I could not tell you where the arena is.\"" },
            { say: "rafa", text: "\"Don't put that in a letter to anybody.\"" },
            AFF("rafa", 2, "Guessed where his head is")
          ] }
        ] },
        { say: "rafa", text: "\"My roommate is already on this deck, by the way. Boy with a microphone clipped to his lapel. He said his own name into it, and it's the name in my letter: Rare Hall, one-oh-three.\"" },
        { say: "rafa", text: "\"He described my ladling. To nobody. 'And he goes in low with the spoon.'\" A pause. \"I have started pouring a little nicer. I am not proud of it.\"" },
        { when: (s)=>!!s.flags["met_cas"], flag: "rel_rafa_cas" },
        { flag: "chat_rafa_3" },
        NOTE("rafa", "Black jacket, Auxiliary event staff: he means to cater tournaments. Plays a deck built on spices and found the three campus kitchens on the map before the arena."),
        { time: 3 }
      ] },
      { text: "\"I'll let you get back to the kettle.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the kettle.\"" },
        { say: "rafa", text: "\"Go on. And Rowan — eat something at eleven. I will know.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_rafa_done" },
    { text: "He takes the empty mug out of your hands, looks into it, and is satisfied." },
    { say: "rafa", text: "\"That's all my secrets, and two mugs. Find me on land. There will be an actual kitchen, and then you'll see something.\"" },
    { end: true }
  ]
});

/* ───────────────────────── ISLAND, DAY 1 AFTERNOON ───────────────────────── */
scene("isle_sunny", {
  steps: [
    { when: (s)=>!!s.flags["isle_sunny_done"], jump: "later" },
    { when: (s)=>!s.flags["met_sunny"], jump: "first" },
    { text: "Sunny is standing at the water's edge of the cove with her red jacket in a heap on the sand behind her and the sea up to her ankles. She is looking at the water the way other people look at a menu." },
    { say: "sunny", text: "\"Rowan! Look at it. *Look* at it. You can see your own feet. I've had baths you couldn't say that about.\"" },
    { jump: "common" },
    { label: "first" },
    { text: "A tall girl in a swimsuit is standing at the water's edge of the cove, a towel round her neck like a scarf and a red jacket with a blue collar in a heap on the sand behind her. She is looking at the sea the way other people look at a menu." },
    { say: "sunny", alias: "Girl with a towel", text: "\"You're the Wildcard! Vance, from the roll call. Nice shoulders, by the way. That's a compliment, don't make it weird.\"" },
    { say: "rowan", text: "\"Rowan. Thank you. I think.\"" },
    { say: "sunny", alias: "Girl with a towel", text: "\"Sunny Aldane. Sports scholarship, lifeguard from Monday. If it falls in the water, I'm the one who fishes it out.\"" },
    MET("sunny", "Sunny Aldane"),
    NOTE("sunny", "Lifeguard on a sports scholarship. Says what she thinks the moment she thinks it."),
    { label: "common" },
    { say: "sunny", text: "\"Rare Hall's got a pool. A real one, fifty metres, lane ropes, I've been and patted it. And then I walked all the way down here anyway. Don't tell the pool.\"" },
    { choice: [
      { text: "\"Why here, if you've got fifty metres of your own?\"", steps: [
        { say: "rowan", text: "\"Why here, if you've got fifty metres of your own?\"" },
        { say: "sunny", text: "\"A pool's got a line on the bottom and that's all it's got. This has got weather. I paced the beach: two hundred metres point to point, near enough. Five times across and back and that's breakfast earned.\"" }
      ] },
      { text: "\"Are you allowed down here? This is the Commons.\"", steps: [
        { say: "rowan", text: "\"Are you allowed down here? This is the Commons.\"" },
        { say: "sunny", text: "\"The lady with the spoon looked at me, looked at the towel, and said, 'Wet feet stay off my step.' I'm taking that as a yes.\"" },
        { say: "sunny", text: "\"Blue collar, grey collar. The sea's not checking.\"" }
      ] },
      { text: "\"Is this where six o'clock happens?\"", when: (s)=>!!s.flags["sunny_invited_swim"], steps: [
        { say: "rowan", text: "\"Is this where six o'clock happens?\"" },
        { say: "sunny", text: "\"He *remembered!*\" She is unreasonably pleased. \"This is exactly where six o'clock happens. You live thirty steps away, you've got no excuse left.\"" },
        AFF("sunny", 2, "Remembered six o'clock")
      ] }
    ] },
    { when: (s)=>!s.flags["met_freddie"], text: "A few metres out, in water that barely covers her, a red-haired girl in diving goggles is floating face down, perfectly still. Sunny has not once looked fully away from her." },
    { when: (s)=>!!s.flags["met_freddie"], text: "A few metres out, in water that barely covers her, Freddie is floating face down in her diving goggles, perfectly still. Sunny has not once looked fully away from her." },
    { when: (s)=>!!s.flags["freddie_jumped"], say: "sunny", text: "\"Three hundred and ten seconds. I'm not on shift, I'm just counting. After this morning I'll be counting her in my sleep — you bad influence.\"" },
    { when: (s)=>!s.flags["freddie_jumped"], say: "sunny", text: "\"Three hundred and ten seconds. I'm not on shift, I'm just counting. She comes up every six minutes or so, looking like she's found money.\"" },
    { when: (s)=>!!s.flags["placement_won"], say: "sunny", text: "\"Heard you won in the Domes, by the way. Good. Now do it again tomorrow, that's the bit nobody likes.\"" },
    { when: (s)=>!!s.flags["placement_lost"], say: "sunny", text: "\"Heard about the Domes, by the way. Right. You lost one, you're still standing, your feet are in the sea. That's a decent day. Next.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "sunny", text: "\"You've still got the Domes to come, yeah? Shake your arms out before you go in. Properly, like an idiot. It's for nerves. Works for hands, too.\"" },
    { choice: [
      { text: "Stand in the water for a minute.", steps: [
        { text: "You take your shoes off and stand in it. It is warmer than any sea you have ever met. Sunny says nothing at all for nearly a whole minute, which you suspect is a present." },
        AFF("sunny", 1, "Got his feet wet")
      ] },
      { text: "\"I'll leave you to the counting.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to the counting.\"" },
        { say: "sunny", text: "\"Three hundred and forty. Go on. See you in the water.\"" }
      ] }
    ] },
    { flag: "isle_sunny_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Sunny is in up to her knees now, arms folded, still facing the shallows." },
    { say: "sunny", text: "\"Don't talk to me, I'm at four hundred and I've lost my place twice. …No, talk to me. I can do both. Barely.\"" },
    { time: 3 },
    { end: true }
  ]
});

scene("isle_freddie", {
  steps: [
    { when: (s)=>!!s.flags["isle_freddie_done"], jump: "later" },
    { text: "In the shallows behind the bungalow row somebody is floating face down in a swimsuit and diving goggles, a mop of red hair spread out on the water like weed." },
    { text: "A gold jacket with a grey collar hangs from a bungalow stilt, well above the tide line. As you reach the edge she comes up all at once, streaming, with both hands cupped round something." },
    { when: (s)=>!s.flags["met_freddie"], jump: "first" },
    { when: (s)=>!!s.flags["freddie_held_jacket"], say: "freddie", text: "\"Jacket man! Perfect. Hold out your hand.\"" },
    { when: (s)=>!s.flags["freddie_held_jacket"], say: "freddie", text: "\"Rowan! Perfect. Hold out your hand.\"" },
    { jump: "common" },
    { label: "first" },
    { say: "freddie", alias: "Girl with goggles on", text: "\"You! Wildcard! Vance! Perfect. I'm Freddie — Winifred Camara, but I answer to anything but Winifred — bungalow four, Game Design, and I need a hand. Literally. Hold yours out.\"" },
    MET("freddie", "Freddie Camara"),
    NOTE("freddie", "Game Design student. Means to draw every creature in the sea as a card."),
    { label: "common" },
    { choice: [
      { text: "Hold out your hand.", steps: [
        { text: "She tips something small, wet and offended into your palm. It is a shell. After a moment the shell puts out legs and walks firmly towards your wrist." },
        { say: "freddie", text: "\"Hermit crab. Keep still, he's deciding about you.\"" },
        AFF("freddie", 2, "Held the crab")
      ] },
      { text: "\"What is it first?\"", steps: [
        { say: "rowan", text: "\"What is it first?\"" },
        { say: "freddie", text: "\"That spoils it.\" But she opens her hands. A shell sits in them; then the shell puts out legs. \"Hermit crab. See? You'd have liked the surprise.\"" }
      ] },
      { text: "\"Is it alive?\"", steps: [
        { say: "rowan", text: "\"Is it alive?\"" },
        { say: "freddie", text: "\"I should hope so, he's just bitten me.\" She opens her hands a crack. A shell, and then legs. \"Hermit crab. Bad-tempered. Lovely.\"" }
      ] }
    ] },
    { say: "freddie", text: "\"He lives under bungalow four. Under *my* bungalow. I've been here three hours and there's a crab at my address.\"" },
    { text: "She has the rubber notebook out of nowhere and is drawing with the crab balanced on the back of her other hand. He comes out, in six lines, wearing his shell at an angle." },
    { say: "freddie", text: "\"Four beds in there. One takes things to bits, one says prayers over hers in a very low voice, and one's so nice I've forgotten her name twice. And nobody has drawn on anything of mine yet. It's eerie.\"" },
    { when: (s)=>!!s.flags["chat_freddie_1"], say: "freddie", text: "\"And I've got the *shelf*, Rowan. I put one shell on it and stood and looked at it.\"" },
    { when: (s)=>!!s.flags["freddie_jumped"], say: "freddie", text: "\"The captain had his word with me, by the way. Regulation four-oh-one. I've read it now. It really is very short.\"" },
    { when: (s)=>!!s.flags["freddie_swim_in"], say: "freddie", text: "\"About swimming round the island. I've had a look from the end of the row. It's bigger than it was from the boat. So: two days, and we take sandwiches.\"" },
    { choice: [
      { text: "\"What does the crab do, as a card?\"", steps: [
        { say: "rowan", text: "\"What does the crab do, as a card?\"" },
        { say: "freddie", text: "\"He moves into whatever's empty.\" At once; she has clearly been waiting. \"Something of yours leaves, he's in there by morning with his feet up. I don't know what that is in numbers. It's *true*, though.\"" },
        AFF("freddie", 1, "Asked what the crab does")
      ] },
      { text: "\"Is the lifeguard on the beach bothering you?\"", when: (s)=>!!s.flags["met_sunny"], steps: [
        { say: "rowan", text: "\"Is the lifeguard on the beach bothering you?\"" },
        { say: "freddie", text: "\"She's counting. I can feel it on the back of my neck. I stay down a bit longer each time, to keep her interested.\"" }
      ] },
      { text: "\"There's a girl on the beach with a towel who hasn't taken her eyes off you.\"", when: (s)=>!s.flags["met_sunny"], steps: [
        { say: "rowan", text: "\"There's a girl on the beach with a towel who hasn't taken her eyes off you.\"" },
        { say: "freddie", text: "\"She's counting. I can feel it on the back of my neck. I stay down a bit longer each time, to keep her interested.\"" }
      ] }
    ] },
    { say: "freddie", text: "\"Right. He goes home now. Back under in a minute — there's something else down there and it's *bigger*.\"" },
    { flag: "isle_freddie_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "She surfaces, pushes the goggles up, sees it is you, and holds up a finger: wait." },
    { say: "freddie", text: "\"It was a sea cucumber. I'm not going to make you hold that one. I'm a good friend.\"" },
    { time: 3 },
    { end: true }
  ]
});

scene("isle_marit", {
  steps: [
    { when: (s)=>!!s.flags["isle_marit_done"], jump: "later" },
    { text: "In the forecourt of Rare Hall, a trunk has been stood on its end in the middle of the path. A girl with two flame-shaped tufts of orange hair, an orange bow on each, is standing on it with her arms spread, addressing the façade." },
    { text: "\"…and LO, the doors of the hall stood open —\" The façade gives her back every word, half a second late. She listens to it with her head on one side, like a cook tasting." },
    { when: (s)=>!s.flags["met_marit"], jump: "first" },
    { when: (s)=>!!s.flags["marit_cast_rowan"], say: "marit", text: "\"The **BROODING STRANGER!** On time for a rehearsal nobody told him about! *That* is instinct!\"" },
    { when: (s)=>!s.flags["marit_cast_rowan"], say: "marit", text: "\"Rowan Vance! **PROTAGONIST!** You have walked into my sound check! Stay, it needs a body in the stalls!\"" },
    { jump: "common" },
    { label: "first" },
    { say: "marit", alias: "Girl with orange bows", text: "\"**VANCE!** The Wildcard! The last name on the roll, read out to a *gasp!* I was there! I *led* the gasp!\"" },
    { say: "marit", alias: "Girl with orange bows", text: "\"Marit Solberg! Commentary track! Theatre kid **EXTRAORDINAIRE!** And you have walked into my sound check.\"" },
    MET("marit", "Marit Solberg"),
    NOTE("marit", "Treats everything as a stage. Narrates, loudly."),
    { label: "common" },
    { say: "marit", text: "\"Listen to this courtyard. Stone on three sides. It *answers*.\" She claps once, and the hall claps back. \"I have been moving in for two hours and I have carried one bag. The acoustics keep interrupting.\"" },
    { choice: [
      { text: "\"Is that your trunk you're standing on?\"", steps: [
        { say: "rowan", text: "\"Is that your trunk you're standing on?\"" },
        { say: "marit", text: "\"It is my *stage*, which travels as a trunk. Scarves, mostly. A sword. Some clothes, I suppose, somewhere at the bottom.\"" }
      ] },
      { text: "\"What's the room like?\"", steps: [
        { say: "rowan", text: "\"What's the room like?\"" },
        { say: "marit", text: "\"Two-oh-one! A *corner!* A window that opens on the sea! It is, in fact, open on the sea, as wide as it goes, and it is not I who opened it.\"" }
      ] },
      { text: "Clap once from the gate, to hear what she hears.", steps: [
        { text: "You clap. The hall hands it back, a little grander than you sent it." },
        { say: "marit", text: "\"*There.* You heard it. You stood up straighter, I *saw* you.\" The ordinary voice, delighted: \"Everybody does. That's the whole trick of a big room.\"" },
        AFF("marit", 2, "Tried the echo")
      ] }
    ] },
    { say: "marit", text: "\"My roommate is one Eloise Lafayette. She had paint on the wall before she had sheets on the bed, and she has not, to my knowledge, eaten. I have cast her as the Tragic Artist and I am going to find her some soup.\"" },
    { text: "She steps down off the trunk." },
    { when: (s)=>!!s.flags["marit_knows_stagefright"] && !s.flags["placement_done"], say: "marit", text: "\"The Domes. I asked if I could come in and stand next to you. They said no, in three languages.\" She takes your sleeve. \"So narrate it. In your head. 'And he draws.' You can't shake and tell a story at the same time; there aren't enough hands.\"" },
    { when: (s)=>!!s.flags["marit_knows_stagefright"] && !!s.flags["placement_won"], say: "marit", text: "\"And you **WON** in the Domes! With those hands! I want it told to me in full, at supper speed, with pauses.\"" },
    { when: (s)=>!!s.flags["marit_knows_stagefright"] && !!s.flags["placement_lost"], say: "marit", text: "\"I heard about the Domes.\" No capitals at all. \"You sat down and played it, with people looking. That was the frightening part, and it's done. The rest is only cards.\"" },
    { text: "She looks up at the sky over the gate, which is a hard, even blue from edge to edge." },
    { say: "marit", text: "\"I asked a porter when it gets dark here. He said about seven, all year, like a shop.\" Quick and ordinary. \"All year. I don't know what I'm going to do with that much evening.\"" },
    { choice: [
      { text: "\"Fill it with a show. Seven o'clock, every night.\"", steps: [
        { say: "rowan", text: "\"Fill it with a show. Seven o'clock, every night.\"" },
        { say: "marit", text: "\"…Every night.\" She has gone quite still. Then the grin, slowly, like house lights. \"Rowan Vance, that is a **SEASON!** That line is going in my notebook, with your name on it!\"" },
        AFF("marit", 2, "Gave her a season")
      ] },
      { text: "Carry the other end of the trunk up the steps.", steps: [
        { text: "It weighs what a small piano weighs. She narrates the ascent, step by step, in the voice of a mountaineering film, and credits you by name at the top." },
        AFF("marit", 2, "Carried the stage")
      ] },
      { text: "\"I'll let you get back to the sound check.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the sound check.\"" },
        { say: "marit", text: "\"Go! But walk out *through* the gate, not round it. It's an exit. Use it.\"" }
      ] }
    ] },
    { flag: "isle_marit_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "The trunk has reached the top step. Marit is sitting on it with a bowl in her lap, blowing on a spoon." },
    { say: "marit", text: "\"Soup. For the Tragic Artist. I am testing it for poison.\" A pause, and the ordinary voice. \"It's very good. She's getting half.\"" },
    { time: 3 },
    { end: true }
  ]
});

scene("isle_rafa", {
  steps: [
    { when: (s)=>!!s.flags["isle_rafa_done"], jump: "later" },
    { text: "Bungalow one is hot, loud with a radio, and smells of something that has been frying since before you were born. At the range a broad woman in a flowered apron has her back to the room." },
    { text: "At the near end of the long table, behind a hill of onions that is slowly becoming a hill of chopped onions, sits a boy in a chef's bandana and a borrowed apron, his black jacket, blue collar, on a hook behind him." },
    { when: (s)=>!s.flags["met_rafa"], jump: "first" },
    { say: "rafa", text: "\"Rowan.\" The knife does not stop. \"Sit. I didn't ask if you were hungry, I asked you to sit.\"" },
    { when: (s)=>!!s.flags["rafa_knows_table"] && !!s.flags["placement_won"], say: "rafa", text: "\"And? The table. …That face is a clean plate. Good. Told you it was a cupboard.\"" },
    { when: (s)=>!!s.flags["rafa_knows_table"] && !!s.flags["placement_lost"], say: "rafa", text: "\"And? The table. …Mm. Okay. First time I used the cold room I locked myself in. It is still only a cupboard. Onion?\"" },
    { when: (s)=>!!s.flags["rafa_knows_table"] && !s.flags["placement_done"], say: "rafa", text: "\"You have not been to your cupboard yet. I can see it. You go in fed, at least; I'll see to that.\"" },
    { jump: "common" },
    { label: "first" },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"You eaten?\"" },
    { say: "rowan", text: "\"Not since the boat.\"" },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"Vance, from the roll call. The Wildcard. I thought so: you looked hungry from across a whole lawn.\" He pushes a stool out with his foot. \"Rafael Okonjo. Rafa. Sit.\"" },
    MET("rafa", "Rafa Okonjo"),
    NOTE("rafa", "Rare Hall, black jacket, and working an unasked shift in the Commons kitchen on his first afternoon."),
    { label: "common" },
    { text: "You sit. A heel of bread and a saucer of something red and oily arrive in front of you without his seeming to have moved." },
    { choice: [
      { text: "\"You live in Rare Hall. What are you doing in our kitchen?\"", steps: [
        { say: "rowan", text: "\"You live in Rare Hall. What are you doing in our kitchen?\"" },
        { say: "rafa", text: "\"Rare Hall has a dining room. The food comes through a door, already finished, and nobody will tell you who made it. Here there is a range that has been angry for twelve years. You can learn from an angry range.\"" }
      ] },
      { text: "\"Does she know you're not one of hers?\"", steps: [
        { say: "rowan", text: "\"Does she know you're not one of hers?\"" },
        { say: "rafa", text: "\"She has not asked. I have not said.\" Low, with half an eye on the flowered back. \"I walked in and said I can chop. She pointed the spoon at the onions. That was two hours ago. It's the best interview I ever had.\"" }
      ] },
      { text: "\"Give me a knife. I'll take half the hill.\"", steps: [
        { say: "rowan", text: "\"Give me a knife. I'll take half the hill.\"" },
        { text: "He looks at you, then finds a second knife and a second board. Your first onion comes out in honest, uneven chunks. He turns your wrist a quarter, without a word, and the second one comes out better." },
        { say: "rafa", text: "\"There. Now you're hired too. Same pay.\"" },
        { flag: "rafa_chopped_together" },
        AFF("rafa", 3, "Helped with the prep")
      ] }
    ] },
    { say: "odalys", alias: "Mama Odalys", text: "\"Thinner! You, with the onions! I want to read the newspaper through them!\"" },
    { text: "She has not turned round. Rafa's knife changes gear at once, and the slices start coming off like pages." },
    { say: "rafa", text: "\"Yes, ma'am.\" And to you, under the radio, glowing: \"You hear that? She has *opinions* about my onions.\"" },
    { when: (s)=>!!s.flags["rafa_wants_plantain"], say: "rafa", text: "\"There is plantain in that basket by the door. Black ones. Perfect. I have not touched them. I am being very, very polite in somebody else's kitchen.\"" },
    { choice: [
      { text: "Eat the bread. All of it.", steps: [
        { text: "The red stuff is pepper and tomato and something smoked, and the bread is gone before you have decided to finish it. He takes the saucer away, looks at it, and is satisfied." },
        AFF("rafa", 1, "Left a clean plate")
      ] },
      { text: "\"You look happier than anyone I've seen today.\"", steps: [
        { say: "rowan", text: "\"You look happier than anyone I've seen today.\"" },
        { say: "rafa", text: "\"Do I?\" He considers the onion in his hand as if it had said it. \"…It is a kitchen. Don't tell anyone it feels like a holiday.\"" },
        AFF("rafa", 1, "Saw that he was happy")
      ] }
    ] },
    { flag: "isle_rafa_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "The onions are finished. He has been promoted, apparently, to peppers." },
    { say: "rafa", text: "\"Supper is at six. I have seen the pot.\" He kisses his fingertips, briefly, so that the range will not see. \"Come hungry. That is an instruction.\"" },
    { time: 3 },
    { end: true }
  ]
});


/* arrival_stern: unchanged from 19-19-ferry-arrival.js except Freddie's jacket (gold, grey collar) */
