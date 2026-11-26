// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS } = helpers;
scene("ferry_abel", {
  steps: [
    { when: (s)=>!!s.flags["met_abel"], jump: "again" },
    { text: "The man at the wheel is barrel-chested, with a full white beard and a blue bowler hat gone soft with age. His face is the colour and texture of a good saddle." },
    { text: "Through the open door the wheelhouse is warm and bright with brass. He has both hands on the wheel, with his feet planted apart, as if the whole ship were a very large, very slow horse that needed to be reminded who was riding it." },
    { text: "Just inside the door, under a tarpaulin, sits a small crate that smells of ice and harbour." },
    { say: "abel", alias: "The captain", text: "\"Thirty-seven and — hold on. Thirty-eight! There you are. I counted thirty-seven.\"" },
    { text: "He does not turn round." },
    { choice: [
      { text: "\"Good morning, Captain.\"", steps: [
        { say: "rowan", text: "\"Good morning, Captain.\"" },
        { say: "abel", alias: "The captain", text: "\"Good MORNING, he says! Do you hear that, ship? All morning I've had them aboard, and one of them has said good morning.\"" },
        { say: "abel", alias: "The captain", text: "\"And since you mention it: fair, then lumpy, then fair. Same as everyone's morning.\" A big, rolling laugh, entirely at his own joke. \"That's one of six.\"" },
        { flag: "abel_said_six" },
        AFF("abel", 2, "Said good morning")
      ] },
      { text: "\"How did you count me? You haven't looked.\"", steps: [
        { say: "rowan", text: "\"How did you count me? You haven't looked.\"" },
        { say: "abel", alias: "The captain", text: "\"The stair. It's iron, it rings, and every one of you rings different. You've a tired foot. The left.\"" },
        { text: "He nods at the brass housing of the compass in front of him. In its curve there is a very small, very bent wheelhouse door, and a very small, very bent you standing in it." },
        { say: "abel", alias: "The captain", text: "\"And I polish that myself.\"" },
        AFF("abel", 1, "Asked how he counts")
      ] },
      { text: "\"Sorry. I think I'm the one who throws the number off.\"", steps: [
        { say: "rowan", text: "\"Sorry. I think I'm the one who throws the number off.\"" },
        { say: "abel", alias: "The captain", text: "\"Throws it off? You finish it, lad. Thirty-seven's an itch. Thirty-eight I can steer by.\"" },
        { say: "abel", alias: "The captain", text: "\"And don't say sorry on a bridge. It makes the helmsman think he's hit something.\"" }
      ] }
    ] },
    { say: "abel", alias: "The captain", text: "\"Captain Abel Stroud. Welcome to the Second Chance. And you'll be?\"" },
    MET("abel", "Captain Abel Stroud"),
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "abel", text: "\"Vance. The one in ink.\" He tips his head, without turning it, at the wall outside where the clipboard hangs. \"Your name came down after the list was typed, so I wrote you in at the bottom myself. I apologise for the slant. She was rolling.\"" },
    { choice: [
      { text: "\"You wrote more than the name.\"", when: (s)=>!!s.flags["read_passenger_list"], hint: "You read the list", steps: [
        { say: "rowan", text: "\"You wrote more than the name.\"" },
        { say: "abel", text: "\"I wrote what I was sent. It's a word, lad. I've had worse written after mine.\"" },
        { say: "abel", text: "\"Half of them haven't read past their own line. And for the other half, well. It says Second Chance on my door. I didn't name her, but I've never once argued with it.\"" },
        AFF("abel", 1, "Said it straight")
      ] },
      { text: "\"The slant suits me. I was a late addition everywhere this week.\"", steps: [
        { say: "rowan", text: "\"The slant suits me. I was a late addition everywhere this week.\"" },
        { say: "abel", text: "\"Ha!\" The laugh goes round the wheelhouse and comes back. \"Aye. Well, late's aboard. Aboard is all I ask of a passenger.\"" }
      ] },
      { text: "\"Thank you for making room.\"", steps: [
        { say: "rowan", text: "\"Thank you for making room.\"" },
        { say: "abel", text: "\"Room! She carries two hundred. There's room for you, your duffel and every one of your regrets, and I'd still not be down to my marks.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Captain.\"" },
    { when: (s)=>!!s.flags["follow_baylee"], text: "He touches the brim of his own straw hat, and Captain Stroud, without turning round, touches the brim of his bowler. Something has been settled." },
    { when: (s)=>!!s.flags["follow_baylee"] && !!s.flags["follow_nathan"], say: "nathan", text: "\"They did a HAT THING! Rowan! They did a hat thing!\"" },
    { add: { ferry_talked: 1 } },
    NOTE("abel", "The ferry captain. Counts every student on and off."),
    { say: "abel", text: "\"You're swaying.\" Still without turning. \"If you are going to be sick, do it leeward. That's the side that isn't me.\"" },
    { say: "rowan", text: "\"I'm not sick. I'm just — looking.\"" },
    { say: "abel", text: "\"That's the best thing to do on a bridge. Most of them come up here to complain.\"" },
    { say: "abel", text: "\"So what do you see? Go on. I've looked out of that window for twenty-two years. I like a fresh report.\"" },
    { choice: [
      { text: "\"A volcano with smoke coming out of it. Is that normal?\"", steps: [
        { say: "rowan", text: "\"A volcano with smoke coming out of it. Is that normal?\"" },
        { say: "abel", text: "\"She's smoked like a kettle every morning I've known her. I set my pipe by it, when I had a pipe.\"" },
        { say: "abel", text: "\"She's a view, not a weather report. Next.\"" },
        AFF("abel", 1, "Gave a fresh report")
      ] },
      { text: "\"A pier I've got to walk down in front of thirty-seven people.\"", steps: [
        { say: "rowan", text: "\"A pier I've got to walk down in front of thirty-seven people.\"" },
        { say: "abel", text: "\"Ah.\" For the first time the big voice comes down to the size of the room. \"That.\"" },
        { say: "abel", text: "\"I'll tell you what I see from up here, every September. Thirty-odd backs at the rail, all very straight, and every one of them certain that the others know something they don't. The loud ones most of all.\"" },
        { say: "abel", text: "\"Nobody watches anybody on a gangway. They're all far too busy not falling off it.\"" },
        AFF("abel", 2, "Told him the truth")
      ] },
      { text: "\"Mostly the back of a very old hat.\"", steps: [
        { say: "rowan", text: "\"Mostly the back of a very old hat.\"" },
        { say: "abel", text: "\"Ha! He's got eyes.\" One hand leaves the wheel to pat the bowler, fondly, like a dog. \"Same age as the run, this hat. It's been overboard twice and come back both times, which is more than I can say for some people's luggage.\"" },
        AFF("abel", 1, "Noticed the hat")
      ] }
    ] },
    { say: "abel", text: "\"I've carried champions, and I've carried trunks home without their owners. I know which I'd rather.\"" },
    { say: "abel", text: "\"Hundred and forty-four out in September. I like a hundred and forty-four back in June. Don't spoil my sums.\"" },
    { choice: [
      { text: "\"Trunks without their owners?\"", steps: [
        { say: "rowan", text: "\"Trunks without their owners?\"" },
        { say: "abel", text: "\"Some go home early. It's October finds them out, mostly. They cross on a Tuesday with one small bag, and the trunk follows on the Friday, and I carry it down the plank myself. It's the least.\"" },
        { say: "abel", text: "\"You'll not be one. I can generally tell.\"" },
        { say: "rowan", text: "\"How?\"" },
        { say: "abel", text: "\"You said you were looking. The ones who go home early never look at anything.\"" },
        AFF("abel", 2, "Asked about the trunks")
      ] },
      { text: "\"I'll do my best to be in the June number.\"", steps: [
        { say: "rowan", text: "\"I'll do my best to be in the June number.\"" },
        { say: "abel", text: "\"See that you are. I've counted twice for you already this morning. I'll not have done it for nothing.\"" },
        AFF("abel", 1, "Promised to come back")
      ] }
    ] },
    { time: 8 },
    { jump: "menu" },
    { label: "again" },
    { when: (s)=>!!s.flags["has_snapper"], say: "abel", text: "\"Thirty-eight. Still thirty-eight. And one crate fewer under my tarp, which I have also counted.\"" },
    { when: (s)=>!s.flags["has_snapper"], say: "abel", text: "\"Thirty-eight. Still thirty-eight.\"" },
    { text: "He has not turned round. You are beginning to think the hat does the looking." },
    { time: 2 },
    { label: "menu" },
    { when: (s)=>!!s.flags["abel_t_dock"] && !!s.flags["abel_t_jokes"] && !!s.flags["abel_game_may"] && !!s.flags["has_snapper"] && !!s.flags["abel_t_count"], jump: "empty" },
    { choice: [
      { text: "\"Captain, when do we dock? I'd like to know how long I've got to find my nerve.\"", when: (s)=>!s.flags["abel_t_dock"], steps: [
        { say: "rowan", text: "\"Captain, when do we dock? I'd like to know how long I've got to find my nerve.\"" },
        { say: "abel", text: "\"Ten-forty! On the nose! Not a minute before, not a minute after, or I will eat my hat. Which is soft. I've considered it.\"" },
        { choice: [
          { text: "\"Have you ever had to?\"", steps: [
            { say: "rowan", text: "\"Have you ever had to?\"" },
            { say: "abel", text: "\"Once. My ninth year. Fog like a wet blanket, and I brought her in at ten-fifty-one.\"" },
            { say: "abel", text: "\"There was a girl on the pier with a stopwatch. I'll go to my grave not knowing why she had a stopwatch.\"" },
            { say: "abel", text: "\"So I took a bite out of the brim, to keep my word.\" He tilts his head. At the back of the bowler there is, indeed, a small crescent missing. \"Felt. Not recommended.\"" },
            AFF("abel", 2, "Asked about the hat")
          ] },
          { text: "\"And the nerve? Is there a time on the chart for that?\"", steps: [
            { say: "rowan", text: "\"And the nerve? Is there a time on the chart for that?\"" },
            { say: "abel", text: "\"Ten-thirty-nine. It always turns up at ten-thirty-nine, when it's too late to do anything else.\"" },
            { say: "abel", text: "\"Till then you've no use for it. You're on a boat. Nobody is asking you for anything. That's what a crossing is for. I go slow on purpose.\"" },
            { say: "rowan", text: "\"You go slow on purpose.\"" },
            { say: "abel", text: "\"Don't tell the Academy. They think it's the engine.\"" },
            AFF("abel", 2, "Asked about nerve")
          ] }
        ] },
        { when: (s)=>!!s.flags["met_teobalt"], say: "rowan", text: "\"There's a boy outside your door who'd like the unloading order in writing, by the way.\"" },
        { when: (s)=>!!s.flags["met_teobalt"], say: "abel", text: "\"The clipboard! He's asked me three times. The third time he brought a diagram. It comes off in the order it comes off; it always has.\"" },
        { when: (s)=>!!s.flags["met_teobalt"], say: "abel", text: "\"Good lad, mind. He'll be running something by Christmas. Probably me.\"" },
        { flag: "abel_t_dock" },
        NOTE("abel", "Ties up at 10:40 on the nose, and says he sails slowly on purpose."),
        { time: 4 }
      ] },
      { text: "\"What is the weather going to do today, Captain?\"", when: (s)=>!s.flags["abel_t_jokes"] && !s.flags["abel_said_six"], steps: [
        { say: "rowan", text: "\"What is the weather going to do today, Captain?\"" },
        { say: "abel", text: "\"Fair, then lumpy, then fair. Same as everyone's morning.\" He laughs at his own joke, a big, rolling laugh. \"That's one of six.\"" },
        { say: "rowan", text: "\"Six what?\"" },
        { flag: "abel_said_six" },
        { scene: "abel_jokes" }
      ] },
      { text: "\"'One of six', you said, about the weather. Six what?\"", when: (s)=>!s.flags["abel_t_jokes"] && !!s.flags["abel_said_six"], steps: [
        { say: "rowan", text: "\"'One of six', you said, about the weather. Six what?\"" },
        { scene: "abel_jokes" }
      ] },
      { text: "\"Do you play cards yourself, Captain, or do you only carry the people who do?\"", when: (s)=>!s.flags["abel_game_may"], steps: [
        { say: "rowan", text: "\"Do you play cards yourself, Captain, or do you only carry the people who do?\"" },
        { say: "abel", text: "\"Not at sea. One game a year, on land, with Race Boats, which is a novelty deck and loses.\" A wink in his voice. \"Ask me in May.\"" },
        { flag: "abel_game_may" },
        AFF("abel", 1, "Asked about cards"),
        { choice: [
          { text: "\"Why play a deck that loses?\"", steps: [
            { say: "rowan", text: "\"Why play a deck that loses?\"" },
            { say: "abel", text: "\"Because it's got boats in it. I'd look a proper fool with dragons.\"" },
            { say: "abel", text: "\"And if a man only sits down once a year, he may as well lose with something he's fond of.\"" }
          ] },
          { text: "\"May. I'll hold you to it.\"", steps: [
            { say: "rowan", text: "\"May. I'll hold you to it.\"" },
            { when: (s)=>!!s.flags["abel_t_jokes"], say: "abel", text: "\"Do. Bring an umbrella. Number three is about an umbrella, and I'll not spoil it by explaining.\"" },
            { when: (s)=>!s.flags["abel_t_jokes"], say: "abel", text: "\"Do. Bring an umbrella. I've a joke about an umbrella, and I'll not spoil it by explaining.\"" }
          ] }
        ] },
        { say: "abel", text: "\"And you? You'll be good at it, or you'd not be on my list at all. Are you good at it?\"" },
        { choice: [
          { text: "\"On a screen, yes. I've never played across a real table. My hands shake.\"", hint: "Honest", steps: [
            { say: "rowan", text: "\"On a screen, yes. I've never played across a real table. My hands shake.\"" },
            { say: "abel", text: "\"Do they.\"" },
            { text: "He lifts one hand off the wheel and holds it out flat, level with the island. It is a broad brown hand, and it is not perfectly still." },
            { say: "abel", text: "\"Mine too. Every time I bring her alongside. All these years, and nobody has ever noticed, because the ship doesn't shake.\"" },
            { say: "abel", text: "\"Put your hands on something heavier than they are, lad. A table will do.\"" },
            AFF("abel", 3, "Trusted him with it"),
            { flag: "abel_knows_hands" }
          ] },
          { text: "\"Good enough for the line in ink. We'll see about the rest.\"", steps: [
            { say: "rowan", text: "\"Good enough for the line in ink. We'll see about the rest.\"" },
            { say: "abel", text: "\"The bottom line's still a line. Mine's the only seat on this ship without a cushion, and I'd not swap it for any of theirs.\"" }
          ] },
          { text: "\"I'd rather not say until I've done it in front of somebody.\"", steps: [
            { say: "rowan", text: "\"I'd rather not say until I've done it in front of somebody.\"" },
            { say: "abel", text: "\"Sensible. I never call a docking till the line's on the bollard.\"" },
            AFF("abel", 1, "Didn't boast")
          ] }
        ] },
        NOTE("abel", "Plays one game a year, on land, with a novelty deck called Race Boats. Ask him in May."),
        { time: 4 }
      ] },
      { text: "\"That crate under the tarpaulin, Captain. Is it going ashore?\"", when: (s)=>!s.flags["has_snapper"] && !s.flags["abel_told_snapper"], steps: [
        { say: "rowan", text: "\"That crate under the tarpaulin, Captain. Is it going ashore?\"" },
        { say: "abel", text: "\"Hm.\"" },
        { text: "A very long pause, and a very small cough into his beard." },
        { say: "abel", text: "\"Snapper. This morning's. It's for Mrs Fuentes — runs the kitchen at the Commons. You can't miss her. She will be the one with the spoon.\"" },
        { flag: "abel_told_snapper" },
        { choice: [
          { text: "\"I'm bound for the Commons. I could carry it up for you.\"", steps: [
            { say: "rowan", text: "\"I'm bound for the Commons. I could carry it up for you.\"" },
            { say: "abel", text: "\"Would you.\" He has gone, all at once, rather formal. \"That would be — that would be a kindness, Mr Vance.\"" },
            { say: "abel", text: "\"No message. Just — it's good snapper.\"" },
            { flag: "has_snapper" },
            AFF("abel", 3, "Offered to carry the snapper"),
            NOTE("abel", "Sends a crate of snapper to Mrs Fuentes at the Commons kitchen. No message.")
          ] },
          { text: "\"Is there a message to go with it?\"", steps: [
            { say: "rowan", text: "\"Is there a message to go with it?\"" },
            { say: "abel", text: "\"No message.\" Rather too quickly. Above the navy collar the back of his neck has gone the colour of the fire axe outside. \"Just — it's good snapper. She'll know that. She knows fish.\"" },
            { choice: [
              { text: "\"Then I'll carry it up, and say exactly that.\"", steps: [
                { say: "rowan", text: "\"Then I'll carry it up, and say exactly that.\"" },
                { say: "abel", text: "\"Aye.\" A breath let out through the beard. \"Exactly that, and not a word over. Thank you, Mr Vance.\"" },
                { flag: "has_snapper" },
                AFF("abel", 3, "Offered to carry the snapper"),
                NOTE("abel", "Sends a crate of snapper to Mrs Fuentes at the Commons kitchen. No message.")
              ] },
              { text: "\"I'll leave it where it is, then.\"", steps: [
                { say: "rowan", text: "\"I'll leave it where it is, then.\"" },
                { say: "abel", text: "\"Aye. One of the lads will take it up. One of them generally does.\"" }
              ] }
            ] }
          ] },
          { text: "\"Mrs Fuentes. Is that a blush under the beard, Captain?\"", hint: "Teasing", steps: [
            { say: "rowan", text: "\"Mrs Fuentes. Is that a blush under the beard, Captain?\"" },
            { say: "abel", text: "\"It is windburn. I have had it for twenty-two — that is not — a man may send a fish — \"" },
            { when: (s)=>!!s.flags["abel_t_jokes"], say: "abel", text: "\"Number two. Do you want number two? It's about a gull. Never mind, you're not ready for it.\"" },
            { when: (s)=>!s.flags["abel_t_jokes"], say: "abel", text: "\"A joke. Do you want a joke? I've one about a gull. Never mind, you're not ready for it.\"" },
            AFF("abel", -1, "Teased about Mrs Fuentes")
          ] }
        ] },
        { time: 4 }
      ] },
      { text: "\"About that snapper, Captain. I'll carry it up to the Commons, if you like.\"", when: (s)=>!s.flags["has_snapper"] && !!s.flags["abel_told_snapper"], steps: [
        { say: "rowan", text: "\"About that snapper, Captain. I'll carry it up to the Commons, if you like.\"" },
        { say: "abel", text: "\"Would you.\" Formal, all at once, and a little gruff with it. \"That would be a kindness, Mr Vance. Mind the ice, it drips.\"" },
        { say: "abel", text: "\"No message. Just — it's good snapper.\"" },
        { flag: "has_snapper" },
        AFF("abel", 3, "Offered to carry the snapper"),
        NOTE("abel", "Sends a crate of snapper to Mrs Fuentes at the Commons kitchen. No message."),
        { time: 3 }
      ] },
      { text: "\"Why do you count us, Captain? There's a typed list right outside your door.\"", when: (s)=>!s.flags["abel_t_count"], steps: [
        { say: "rowan", text: "\"Why do you count us, Captain? There's a typed list right outside your door.\"" },
        { say: "abel", text: "\"Lists are paper. Paper tells me who ought to be aboard. I count who is.\"" },
        { say: "abel", text: "\"I count you on, I count you off. In June I count again, and then I sleep till July.\"" },
        { choice: [
          { text: "\"Has the count ever come out wrong?\"", steps: [
            { say: "rowan", text: "\"Has the count ever come out wrong?\"" },
            { say: "abel", text: "\"I had one over, once. One head more than the paper.\"" },
            { say: "rowan", text: "\"A stowaway?\"" },
            { say: "abel", text: "\"A cellist. Wrong ferry. Very apologetic. We were a mile out before he asked where the concert hall was.\"" },
            { say: "abel", text: "\"Over, I can laugh about. Under is the one I mind. I have never been under at sea, and I don't intend to start with your lot.\"" },
            AFF("abel", 2, "Asked about the count")
          ] },
          { text: "\"Thirty-eight people you've never met. Why take it so personally?\"", steps: [
            { say: "rowan", text: "\"Thirty-eight people you've never met. Why take it so personally?\"" },
            { say: "abel", text: "\"Because for four hours you're mine, lad.\"" },
            { say: "abel", text: "\"After the gangway you belong to the Academy, and heaven help the pair of you. But between the harbour wall and that pier there is nobody to count you but me. So I count.\"" },
            { text: "It is the only thing he has said all morning that did not end in a laugh." },
            AFF("abel", 2, "Asked why he counts")
          ] }
        ] },
        { flag: "abel_t_count" },
        NOTE("abel", "Between harbour and pier, he says, the passengers are his. He takes the head count personally."),
        { time: 4 }
      ] },
      { text: "Thank him and go.", steps: [
        { say: "abel", text: "\"Mind the step!\"" },
        { end: true }
      ] }
    ] },
    { jump: "menu" },
    { label: "empty" },
    { say: "abel", text: "\"That's my whole cargo, lad: six jokes, one hat and a timetable. Go and look at something with fewer years on it.\"" },
    { say: "abel", text: "\"And mind the step!\"" },
    { time: 2 },
    { end: true }
  ]
});

scene("abel_jokes", {
  steps: [
    { say: "abel", text: "\"Jokes! I've six. I number them, so the crew can ask by number and save me the telling. The weather's number one; you've had it. Go on. Pick another.\"" },
    { choice: [
      { text: "\"Number four.\"", steps: [
        { say: "rowan", text: "\"Number four.\"" },
        { say: "abel", text: "\"FOUR. He asks for four.\" Both hands leave the wheel, briefly, to be rubbed together." },
        { say: "abel", text: "\"A passenger comes up to my bridge, white as a sheet, and he says to me: Captain, do ships like this sink often?\"" },
        { text: "The pause of a man who has been waiting all morning for it." },
        { say: "abel", text: "\"And I say — only the ONCE!\"" },
        { text: "The laugh rolls round the brass and out of the door. You laugh too. You had not planned to. It is the timing." },
        { when: (s)=>!!s.flags["rana_knew_joke"] && !s.flags["met_rana"], think: "The girl on the stair had that ending out before he did. Word for word." },
        { when: (s)=>!!s.flags["rana_knew_joke"] && !!s.flags["met_rana"], think: "Rana had that ending out before he did. Word for word." },
        { say: "abel", text: "\"Four's the good one. Everybody finds four in the end.\"" },
        AFF("abel", 2, "Asked for number four")
      ] },
      { text: "\"Which one is the worst?\"", steps: [
        { say: "rowan", text: "\"Which one is the worst?\"" },
        { say: "abel", text: "\"Six. Six is about a compass. Nobody has ever laughed at six. Not once.\"" },
        { say: "rowan", text: "\"Then why keep it?\"" },
        { say: "abel", text: "\"Because then there'd only be five, and I've said six to too many people.\"" },
        { say: "abel", text: "\"Also I think it's funny.\" With dignity. \"I am waiting for the world to catch up.\"" },
        AFF("abel", 1, "Asked about number six")
      ] }
    ] },
    { flag: "abel_t_jokes" },
    NOTE("abel", "Has six jokes, numbered, and likes to be asked for one by number."),
    { time: 4 }
  ]
});

scene("ferry_rana", {
  steps: [
    { when: (s)=>!!s.flags["met_rana"], jump: "again" },
    { text: "On the top step of the iron stair a girl is sitting with her arms round her knees and her back turned to the rail, as far from anybody as it is possible to be on a ship." },
    { text: "Blonde hair in two long braids that hang down in front of her shoulders, each one tied off with a large red bow. Black nail polish, chipped from biting. A plain grey collar set with tiny silver studs, in a row too even to have come out of a shop." },
    { text: "She is watching the planks." },
    { text: "She knows you are there. You can tell from the set of her shoulders, which have gone very slightly straighter, in the manner of an animal that has heard a twig." },
    { say: "rana", alias: "Scowling girl", text: "\"No.\"" },
    { say: "rowan", text: "\"I haven't — \"" },
    { say: "rana", alias: "Scowling girl", text: "\"No. Whatever it is. No.\"" },
    { choice: [
      { text: "Sit down on the stair, two steps below her, and say nothing.", hint: "Quiet", steps: [
        { text: "She makes a very small noise in her throat. It is not a welcome, but it is not a wall, either." },
        { text: "You sit. The stair is cold iron, with salt on it. Below you the whole ship is in motion, a hundred small conversations, and up here in this narrow corner it is oddly peaceful." },
        { text: "A minute goes by, and another. A gull lands on the rope rail, looks the two of you over, and concludes that there is nothing to be had." },
        { say: "rana", alias: "Scowling girl", text: "\"…You're not going to ask.\"" },
        { say: "rowan", text: "\"Ask what?\"" },
        { say: "rana", alias: "Scowling girl", text: "\"Anything. Name. Jacket. Where from. Everybody on this boat has been asking everybody else the same three questions since the harbour.\"" },
        { choice: [
          { text: "\"I'm too tired to think of three.\"", steps: [
            { say: "rowan", text: "\"I'm too tired to think of three.\"" },
            { text: "The sound she makes is not a laugh. It is the place where a laugh would go." },
            { say: "rana", alias: "Scowling girl", text: "\"Then don't.\"" },
            AFF("rana", 2, "Didn't push")
          ] },
          { text: "\"One, then. Is this step as cold as it feels?\"", steps: [
            { say: "rowan", text: "\"One, then. Is this step as cold as it feels?\"" },
            { say: "rana", alias: "Scowling girl", text: "\"It's iron. What do you think.\"" },
            { text: "It is, you notice, an answer. She appears to notice too, a shade too late." },
            { say: "rana", alias: "Scowling girl", text: "\"…That was your one.\"" },
            AFF("rana", 1, "Asked something small")
          ] },
          { text: "Go on saying nothing. It is working so far.", hint: "Quiet", steps: [
            { text: "You say nothing. She waits for the question. It does not come. Her shoulders come down by about a quarter of an inch." },
            { say: "rana", alias: "Scowling girl", text: "\"…Fine.\"" },
            AFF("rana", 3, "Said nothing at all")
          ] }
        ] }
      ] },
      { text: "\"I'm Rowan. I don't mean to bother you. What's your name?\"", steps: [
        { say: "rowan", text: "\"I'm Rowan. I don't mean to bother you. What's your name?\"" },
        { say: "rana", alias: "Scowling girl", text: "\"Rana. That's all you get.\"" },
        MET("rana", "Rana"),
        { say: "rana", text: "\"Why.\"" },
        { say: "rowan", text: "\"I wanted to know who I'd be sharing the stair with.\"" },
        { say: "rana", text: "\"You're not sharing it. I was here first.\"" },
        { choice: [
          { text: "\"Then I'll take a lower step. Different step entirely.\"", hint: "Dry", steps: [
            { say: "rowan", text: "\"Then I'll take a lower step. Different step entirely.\"" },
            { text: "You sit two steps down, facing the same planks." },
            { say: "rana", text: "\"That's not how stairs work.\"" },
            { text: "She does not, you notice, tell you to go." },
            AFF("rana", 1, "Stayed anyway")
          ] },
          { text: "\"Fair enough. Is there anywhere else on this ship a person gets left alone?\"", steps: [
            { say: "rowan", text: "\"Fair enough. Is there anywhere else on this ship a person gets left alone?\"" },
            { say: "rana", text: "\"Behind the funnel, port side. I tried it first. Wind's wrong, you sit in the smoke.\"" },
            { text: "A beat, in which she appears to hear herself being helpful." },
            { say: "rana", text: "\"…So no.\"" },
            { text: "You sit down two steps below her instead. She lets you." },
            AFF("rana", 1, "Asked where to be alone")
          ] },
          { text: "\"All right. I'll go.\"", steps: [
            { say: "rowan", text: "\"All right. I'll go.\"" },
            { text: "You turn. You have one foot in the air when she speaks, to the planks." },
            { say: "rana", text: "\"Third one down is loose. Don't break your neck on my account.\"" },
            { text: "It is loose. You find that out by standing on it carefully. When you look back up, she is watching the planks again, very hard." },
            { flag: "rana_left_first" },
            AFF("rana", 1, "Went when told")
          ] }
        ] }
      ] },
      { text: "\"Why are you sitting all the way out here by yourself?\"", steps: [
        { say: "rowan", text: "\"Why are you sitting all the way out here by yourself?\"" },
        { text: "Her whole body goes rigid. The scowl, which looked permanent, finds another notch." },
        { say: "rana", alias: "Scowling girl", text: "\"Why do you care.\"" },
        { choice: [
          { text: "\"Because it's the quietest place on the ship, and you found it before I did.\"", steps: [
            { say: "rowan", text: "\"Because it's the quietest place on the ship, and you found it before I did.\"" },
            { text: "The rigidity lets go, by one notch exactly." },
            { say: "rana", alias: "Scowling girl", text: "\"It's not the quietest. It's the furthest. There's a difference.\"" },
            { say: "rowan", text: "\"I'm Rowan.\"" },
            { say: "rana", alias: "Scowling girl", text: "\"Rana. Don't sit close.\"" },
            MET("rana", "Rana"),
            { text: "You sit two steps down. That appears to be the agreed distance." }
          ] },
          { text: "\"Because everybody else is down there making friends.\"", steps: [
            { say: "rowan", text: "\"Because everybody else is down there making friends.\"" },
            { say: "rana", alias: "Scowling girl", text: "\"Good for everybody else.\"" },
            { say: "rana", alias: "Scowling girl", text: "\"…Rana. Now go away.\"" },
            MET("rana", "Rana"),
            AFF("rana", -2, "Pushed"),
            { flag: "rana_pressed" }
          ] },
          { text: "\"You're right. It's none of my business. Sorry.\"", steps: [
            { say: "rowan", text: "\"You're right. It's none of my business. Sorry.\"" },
            { say: "rana", alias: "Scowling girl", text: "\"No. It isn't.\"" },
            { text: "A long pause. You have half turned to go." },
            { say: "rana", alias: "Scowling girl", text: "\"…Rana.\"" },
            MET("rana", "Rana"),
            { say: "rowan", text: "\"Rowan.\"" },
            { say: "rana", text: "\"I didn't ask.\"" },
            { text: "But she takes her foot off the lower step. You sit there." },
            AFF("rana", 1, "Backed off")
          ] }
        ] }
      ] }
    ] },
    { when: (s)=>!!s.flags["rana_pressed"] || !!s.flags["rana_left_first"], jump: "tail" },
    { text: "Through the open wheelhouse door behind her comes a big salt voice, pitched for a room twice the size, in the middle of telling somebody a story." },
    { say: "abel", alias: "The captain", text: "\"…white as a sheet, and he says to me: Captain, do ships like this sink often?\"" },
    { say: "rana", alias: "Scowling girl", text: "\"Only the once.\" Under her breath, to her knees." },
    { say: "abel", alias: "The captain", text: "\"And I say — only the ONCE!\"" },
    { text: "A huge rolling laugh. She closes her eyes for a second, like someone listening to a neighbour's alarm clock." },
    { flag: "rana_knew_joke" },
    { choice: [
      { text: "\"You got there before he did.\"", steps: [
        { say: "rowan", text: "\"You got there before he did.\"" },
        { say: "rana", alias: "Scowling girl", text: "\"It's a hundred years old. Everybody's grandfather tells it.\"" },
        { say: "rowan", text: "\"With that pause, in exactly that place?\"" },
        { say: "rana", alias: "Scowling girl", text: "\"…Coincidence.\"" }
      ] },
      { text: "\"Is he always like that?\"", steps: [
        { say: "rowan", text: "\"Is he always like that?\"" },
        { say: "rana", alias: "Scowling girl", text: "\"How would I know.\"" },
        { text: "She bites the corner of a thumbnail, looks at it as if it had let her down, and puts the hand under her knee." },
        { say: "rana", alias: "Scowling girl", text: "\"…He does one every half-hour. You could set a watch by it.\"" }
      ] },
      { text: "Say nothing. Let her see that you heard.", hint: "Quiet", steps: [
        { text: "You look at the planks, and let the silence say that you noticed." },
        { say: "rana", alias: "Scowling girl", text: "\"Stop it.\"" },
        { say: "rowan", text: "\"Stop what?\"" },
        { say: "rana", alias: "Scowling girl", text: "\"Whatever your face is doing.\"" },
        AFF("rana", 1, "Noticed, and let it lie")
      ] }
    ] },
    { when: (s)=>!s.flags["met_rana"], text: "After a while, grudgingly, to the planks:" },
    { when: (s)=>!s.flags["met_rana"], say: "rana", alias: "Scowling girl", text: "\"…Rana. Since you're not going away.\"" },
    { when: (s)=>!s.flags["met_rana"], say: "rowan", text: "\"Rowan.\"" },
    MET("rana", "Rana"),
    { say: "rana", text: "\"Rowan.\" Flat. \"Vance, R. Bottom of the list, in ink. No jacket. It isn't hard.\"" },
    { text: "A very quick, very sharp glance: at your face, at the place where a collar would be, and away again." },
    { say: "rana", text: "\"I'm not going to say the word. I've been a word on a list. It's — \"" },
    { text: "She stops, as if somebody had shut a door on the sentence from the inside." },
    { say: "rana", text: "\"Don't.\"" },
    { choice: [
      { text: "\"Don't what?\"", steps: [
        { say: "rowan", text: "\"Don't what?\"" },
        { say: "rana", text: "\"Whatever you were going to ask.\"" },
        { text: "You don't ask. It costs you something. She seems to know what." }
      ] },
      { text: "\"Thanks for not saying it.\"", steps: [
        { say: "rowan", text: "\"Thanks for not saying it.\"" },
        { say: "rana", text: "\"I didn't do it for you.\"" },
        { text: "She turns one of the silver studs on her collar a quarter of the way round with her thumbnail, and back." },
        { say: "rana", text: "\"…It's a stupid word anyway.\"" },
        AFF("rana", 2, "Thanked her plainly")
      ] },
      { text: "Nod, once, and leave it shut.", hint: "Quiet", steps: [
        { text: "You nod at the planks. After a moment the planks get a nod from her, too." },
        AFF("rana", 2, "Left it shut")
      ] }
    ] },
    { flag: "rana_list_word" },
    NOTE("rana", "Sits apart on the bridge stair. Says she has been a word on a list, and stops there."),
    { label: "tail" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Hi! I'm Nathan! I like your hair! The bows! They're very RED!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Nathan. Leave her be.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], text: "Rana looks at Nathan the way you look at weather through a window." },
    { when: (s)=>!s.flags["rana_list_word"], run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["rana"] = s.notes["rana"] || []); if (a.indexOf("Scowls. Keeps everyone at a distance.") < 0) a.push("Scowls. Keeps everyone at a distance."); } },
    { add: { ferry_talked: 1 } },
    { time: 6 },
    { end: true },
    { label: "again" },
    { when: (s)=>!s.flags["rana_pressed"], jump: "again_ok" },
    { text: "She is exactly where you left her. Her shoulders register you, and close." },
    { say: "rana", text: "\"What.\"" },
    { choice: [
      { text: "\"I asked something that wasn't mine to ask. I'm sorry.\"", steps: [
        { say: "rowan", text: "\"I asked something that wasn't mine to ask. I'm sorry.\"" },
        { text: "A long look at the planks." },
        { say: "rana", text: "\"…Fine.\"" },
        { say: "rana", text: "\"You said it straight. Most people make a speech.\"" },
        { unflag: "rana_pressed" },
        { flag: "rana_apologised" },
        AFF("rana", 1, "Apologised without a speech")
      ] },
      { text: "Leave her.", steps: [
        { text: "She does not watch you go. You can feel her not doing it all the way down the stair." }
      ] }
    ] },
    { time: 3 },
    { end: true },
    { label: "again_ok" },
    { when: (s)=>!!s.flags["rana_left_first"] && !s.flags["rana_came_back"], say: "rana", text: "\"…You found the loose one, then.\"" },
    { when: (s)=>!(!!s.flags["rana_left_first"] && !s.flags["rana_came_back"]) && !!s.flags["chat_rana_done"], say: "rana", text: "\"…You again.\"" },
    { when: (s)=>!(!!s.flags["rana_left_first"] && !s.flags["rana_came_back"]) && !s.flags["chat_rana_done"], say: "rana", text: "\"…Yeah?\"" },
    { flag: "rana_came_back" },
    { choice: [
      { text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"", when: (s)=>!s.flags["deck_known_rana"], hint: "Tentative", steps: [
        { say: "rowan", text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"" },
        { scene: "answer_rana" }
      ] },
      { text: "\"Would it be all right if I sat here a while? I won't talk much.\"", when: (s)=>!s.flags["chat_rana_done"], steps: [
        { say: "rowan", text: "\"Would it be all right if I sat here a while? I won't talk much.\"" },
        { say: "rana", text: "\"It's a stair. I don't own it.\"" },
        { text: "You take the step two below hers." },
        { scene: "chat_rana" }
      ] },
      { text: "\"Just seeing whether the stair's still taken.\"", steps: [
        { say: "rowan", text: "\"Just seeing whether the stair's still taken.\"" },
        { say: "rana", text: "\"It's taken.\"" },
        { text: "Something at the corner of her mouth considers moving, and thinks better of it." }
      ] },
      { text: "Leave her.", steps: [
        { text: "She says nothing, which from her is very nearly a wave." }
      ] }
    ] },
    { time: 4 }
  ]
});

scene("chat_rana", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_rana_1"] && !!s.flags["chat_rana_2"] && !!s.flags["chat_rana_3"], jump: "done" },
    { choice: [
      { text: "Sit quietly, and find out what she is really looking at.", when: (s)=>!s.flags["chat_rana_1"], hint: "Quiet", steps: [
        { text: "Neither of you says anything for a while. The stair is cold. The gulls complain about the wake." },
        { text: "She is not, you slowly work out, watching the planks at all. Past her knees, under the rope rail, there is a clear line down to a bench on the fore deck, where two boys in red jackets have a game laid out between them." },
        { text: "Rana bites a nail, looks at it, and puts the hand down. A moment later it is back at her mouth." },
        { choice: [
          { text: "\"Who's winning?\"", steps: [
            { say: "rowan", text: "\"Who's winning?\"" },
            { say: "rana", text: "\"Left one. He doesn't know it yet.\"" },
            { say: "rana", text: "\"He's had the answer in his hand for two turns and he keeps playing round it, because he thinks it's for later. There isn't a later. It's now, it's *this* turn, he only has to —\"" },
            { text: "Far below, the boy on the left puts down something else. Rana's hand comes away from her mouth." },
            { say: "rana", text: "\"…Forget it. You can't see anything from up here.\"" },
            { think: "She called it from thirty feet up, off the backs of the cards and the way a stranger holds his elbows." },
            AFF("rana", 2, "Asked what she saw")
          ] },
          { text: "Keep quiet and watch the same game.", hint: "Quiet", steps: [
            { text: "You watch. You cannot read a card from here, but you can read the two boys, a little. The one on the left hesitates." },
            { say: "rana", text: "\"Now.\" Not to you. To a boy thirty feet down who cannot hear her. \"Now, you idiot. It's right there.\"" },
            { text: "He plays something else. She breathes out through her nose and puts the bitten hand under her knee." },
            { say: "rana", text: "\"…Free ship. Sit where you like.\"" },
            AFF("rana", 2, "Stayed, and said nothing")
          ] }
        ] },
        { flag: "chat_rana_1" },
        NOTE("rana", "Will let you sit near her if you say nothing."),
        NOTE("rana", "Follows other people's games from a distance, and bites her nails over them."),
        { time: 4 }
      ] },
      { text: "\"Everybody else on this ship is looking at the island. You've got your back to it.\"", when: (s)=>!s.flags["chat_rana_2"], steps: [
        { say: "rowan", text: "\"Everybody else on this ship is looking at the island. You've got your back to it.\"" },
        { say: "rana", text: "\"So?\"" },
        { say: "rowan", text: "\"So I wondered what the planks have got that a volcano hasn't.\"" },
        { say: "rana", text: "\"Planks don't do anything.\"" },
        { say: "rana", text: "\"It's an island. It'll still be there at ten-forty. Staring doesn't get you in any faster.\"" },
        { choice: [
          { text: "\"What do you want from it, then?\"", steps: [
            { say: "rowan", text: "\"What do you want from it, then?\"" },
            { say: "rana", text: "\"It's far away.\"" },
            { say: "rowan", text: "\"From what?\"" },
            { say: "rana", text: "\"Everything.\" A pause. \"That's what an island's for. You'd think.\"" },
            { text: "The last two words come out smaller than the rest. She looks annoyed with them." }
          ] },
          { text: "\"I keep looking because I don't quite believe in it yet.\"", steps: [
            { say: "rowan", text: "\"I keep looking because I don't quite believe in it yet.\"" },
            { say: "rana", text: "\"You will.\"" },
            { say: "rana", text: "\"It'll get real when the gangway goes down. After that it's just a place with a timetable. Everywhere is.\"" },
            { say: "rowan", text: "\"You sound sure.\"" },
            { say: "rana", text: "\"It's a school. I've been to school.\"" }
          ] }
        ] },
        { text: "The engine fills the silence for a while. Then, to her knees:" },
        { say: "rana", text: "\"…Grey, or what.\"" },
        { say: "rowan", text: "\"Sorry?\"" },
        { say: "rana", text: "\"Collar. When they find you a jacket.\" She flicks one of her own silver studs. \"Tower, Hall, or the bungalows.\"" },
        { say: "rowan", text: "\"Bungalows. Number seven.\"" },
        { say: "rana", text: "\"Three.\" It is a moment before you understand that this is information, freely given. \"Seven's four doors off. Good. You won't hear me and I won't hear you.\"" },
        AFF("rana", 2, "Gave her something to say"),
        { flag: "chat_rana_2" },
        NOTE("rana", "Likes the island because it is far away from everything."),
        NOTE("rana", "Grey collar: the Commons, bungalow 3."),
        { time: 3 }
      ] },
      { text: "\"Those studs on your collar. Did you set them yourself?\"", when: (s)=>!s.flags["chat_rana_3"], steps: [
        { say: "rowan", text: "\"Those studs on your collar. Did you set them yourself?\"" },
        { say: "rana", text: "\"Why.\"" },
        { choice: [
          { text: "\"Because they're dead level. Whoever did it measured.\"", hint: "Specific", steps: [
            { say: "rowan", text: "\"Because they're dead level. Whoever did it measured.\"" },
            { say: "rana", text: "\"Four millimetres apart. An awl, and the back of a spoon to turn the prongs.\" Fast, exact, very nearly warm. \"You set the middle one first and work outwards, or the row walks.\"" },
            { say: "rana", text: "\"They said the collar had to be grey. Nobody said it had to be *plain*.\"" },
            { text: "She hears herself. The scowl comes down again like a shutter." },
            { say: "rana", text: "\"It's a collar.\"" },
            AFF("rana", 3, "Praised the work, exactly")
          ] },
          { text: "\"Because I'd like to know whether it's allowed.\"", steps: [
            { say: "rowan", text: "\"Because I'd like to know whether it's allowed.\"" },
            { say: "rana", text: "\"Are you allowed to not have a jacket?\"" },
            { say: "rowan", text: "\"Apparently not. They're finding me one.\"" },
            { say: "rana", text: "\"Then when they do, somebody will tell you what goes on it and what doesn't, and it'll be a long list.\" A stud gets a quarter turn. \"Mine's still grey. Grey's the rule. Read the rule.\"" },
            { text: "It is a long speech, for her. She looks faintly disgusted about that." },
            AFF("rana", 1, "Didn't flinch")
          ] }
        ] },
        { flag: "chat_rana_3" },
        NOTE("rana", "Studded her grey collar herself, four millimetres apart, and will defend it by the rulebook."),
        { time: 3 }
      ] },
      { text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"", when: (s)=>!s.flags["deck_known_rana"], hint: "Tentative", steps: [
        { say: "rowan", text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"" },
        { scene: "answer_rana" }
      ] },
      { text: "\"I'll leave you to it.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to it.\"" },
        { say: "rana", text: "\"Mm.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_rana_done" },
    { say: "rana", text: "\"…That's enough.\" Without heat. \"Don't push it.\"" },
    { end: true }
  ]
});

scene("deck_rana", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_rana"], end: true },
    { when: (s)=>!!s.flags["rana_pressed"], end: true },
    { choice: [
      { text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"", steps: [
        { say: "rowan", text: "\"Do you play? I'm not asking for a game. I just don't know what anybody's running.\"" },
        { scene: "answer_rana" }
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_rana" },
        { end: true }
      ] }
    ] }
  ]
});

scene("answer_rana", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_rana"], end: true },
    { say: "rana", text: "\"…\"" },
    { text: "A very long pause. The scowl does not change. Something in her shoulders does." },
    { say: "rana", text: "\"Debug Mode.\"" },
    { say: "rana", text: "\"Face-down cards. They each wait for one thing you do.\"" },
    { text: "A shrug that tries very hard to be indifferent." },
    { say: "rana", text: "\"It's not interesting.\"" },
    AFF("rana", 1, "Asked, and didn't push"),
    { choice: [
      { text: "Say what you know about the deck, quietly.", hint: "You know these cards", steps: [
        { text: "You say nothing for a moment. Then, so low that she may not be meant to hear:" },
        { say: "rowan", text: "\"…Cybug LOCUST copies whatever you attach to my hero. LADYBUG cancels an Ability. ANTS punishes damage that doesn't kill. Bee, Centipede, Rhinoceros, Scarab. Each one waits for exactly one thing.\"" },
        { say: "rowan", text: "\"Bakhm hits for every Surprise that fires. Paid for by deleting the matching artifact.\" A breath. \"Troop Annihilation refills them. Nobody plays it like that.\"" },
        { say: "rana", text: "\"…You read the names.\" Under her breath. \"Nobody reads the names.\"" },
        AFF("rana", 2, "Read the names")
      ] },
      { text: "\"It sounds interesting to me. Which one do people walk into most?\"", steps: [
        { say: "rowan", text: "\"It sounds interesting to me. Which one do people walk into most?\"" },
        { say: "rana", text: "\"ANTS.\" No pause at all. \"It punishes damage that doesn't kill, and nobody can stand not attacking. Then LADYBUG, because it cancels an Ability and everybody thinks theirs is special.\"" },
        { say: "rowan", text: "\"And Cybug LOCUST copies whatever you attach to my hero. Bakhm hits for every Surprise that fires. Troop Annihilation refills them.\" A breath. \"Nobody plays it like that.\"" },
        { say: "rana", text: "\"…You read the names.\" Under her breath. \"Nobody reads the names.\"" },
        AFF("rana", 1, "Asked the right question")
      ] }
    ] },
    { text: "For three or four seconds she is somebody else: quick, exact, sitting forward. Then she notices, and sits back." },
    { say: "rana", text: "\"What do you run.\"" },
    { choice: [
      { text: "\"Storm. Online, mostly.\"", steps: [
        { say: "rowan", text: "\"Storm. Online, mostly.\"" },
        { say: "rana", text: "\"Storm's a ladder deck.\"" },
        { say: "rowan", text: "\"I know.\"" },
        { say: "rana", text: "\"…Huh.\"" }
      ] },
      { text: "\"Ask me again on the island.\"", steps: [
        { say: "rowan", text: "\"Ask me again on the island.\"" },
        { say: "rana", text: "\"I wasn't asking.\"" }
      ] }
    ] },
    { say: "rana", text: "\"Whatever.\"" },
    { flag: "rana_deck_talk" },
    DECK("rana")
  ]
});

scene("ferry_teobalt", {
  steps: [
    { when: (s)=>!!s.flags["met_teobalt"], jump: "again" },
    { text: "A boy with dark-blue hair standing up in neat spikes, in a long red coat buttoned to the collar, is standing very straight at the wheelhouse door with a clipboard. He is looking slightly over the heads of the crowd below, as if counting them. There is a spare pen behind his ear." },
    { text: "He is not so much waiting as supervising the idea of waiting. Every few seconds the pen leaves his ear, makes a very small mark on a page ruled in four colours of ink, and returns to its place with a tiny click." },
    { say: "teobalt", alias: "Boy with a clipboard", text: "\"Excuse me. Do you know in what order the luggage comes off? It is a question of logistics.\"" },
    { choice: [
      { text: "\"No, I'm sorry. I came aboard late, and I don't know anything about the unloading. I'm Rowan.\"", steps: [
        { say: "rowan", text: "\"No, I'm sorry. I came aboard late, and I don't know anything about the unloading. I'm Rowan.\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"No. Nobody does. You are the fourteenth person I have asked and the first to apologise for it. I have made a note.\"" },
        { text: "He has. The pen clicks home." },
        AFF("teobalt", 1, "Apologised for not knowing")
      ] },
      { text: "\"Does it come off in an order?\"", hint: "Dry", steps: [
        { say: "rowan", text: "\"Does it come off in an order?\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"That is precisely the difficulty.\" With real warmth, as to a colleague. \"You have put your finger on it at once.\"" },
        { say: "rowan", text: "\"I'm Rowan. I was mostly joking.\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"Were you? It was nevertheless correct.\"" },
        AFF("teobalt", 1, "Saw the difficulty")
      ] },
      { text: "\"Why does it matter which bag comes off first?\"", steps: [
        { say: "rowan", text: "\"Why does it matter which bag comes off first?\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"Because there are thirty-eight of us, one gangway, and one wire cage.\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"If the trunks come off before the duffels, everybody with a duffel waits behind everybody with a trunk. I estimate eleven minutes of avoidable standing per person.\" The pen comes down. \"That is very nearly seven hours of human life. On a pier.\"" },
        { say: "rowan", text: "\"…I'm Rowan. I'd never thought of it in hours.\"" },
        { say: "teobalt", alias: "Boy with a clipboard", text: "\"Very few people do. It is why piers are as they are.\"" },
        AFF("teobalt", 1, "Asked why it matters")
      ] }
    ] },
    { say: "teobalt", alias: "Boy with a clipboard", text: "\"I have asked the captain. He says it comes off in the order it comes off.\"" },
    { say: "teobalt", alias: "Boy with a clipboard", text: "\"That is, I'm afraid, not an order.\"" },
    { say: "teobalt", alias: "Boy with a clipboard", text: "\"Teobalt Fullington. May I ask what you are travelling with? It is for the estimate.\"" },
    MET("teobalt", "Teobalt Fullington"),
    { choice: [
      { text: "\"One duffel.\"", steps: [
        { say: "rowan", text: "\"One duffel.\"" },
        { say: "teobalt", text: "\"A duffel.\" A mark. \"Excellent. You are early and you are quick. I wish there were more of you.\"" }
      ] },
      { text: "\"One duffel, and whatever nerves weigh.\"", steps: [
        { say: "rowan", text: "\"One duffel, and whatever nerves weigh.\"" },
        { say: "teobalt", text: "\"Nerves travel as hand luggage. I have a column for them.\" He turns the clipboard a few degrees, so that you can see that he does. \"It is quite a full column this morning. You are in good company.\"" },
        AFF("teobalt", 1, "Asked to be listed in full")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is that a CLIPBOARD? Baylee, he's got a clipboard! I've always wanted to meet a person with a clipboard!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"I've met several.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "teobalt", text: "\"Two further duffels and a straw hat. Thank you. That is very helpful.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("teobalt", "Keeps lists and a clipboard. Worried about the unloading order."),
    { say: "teobalt", text: "\"You have no jacket. For a moment I had you down as crew, and then as an error.\"" },
    { choice: [
      { text: "\"An error sounds about right.\"", steps: [
        { say: "rowan", text: "\"An error sounds about right.\"" },
        { say: "teobalt", text: "\"No. An error is a thing in the wrong column. You are merely not yet in a column. That can be mended.\"" },
        { text: "He writes something small at the foot of the page, in pencil, and angles the clipboard away before you can read it." }
      ] },
      { text: "\"They're finding me one, apparently.\"", steps: [
        { say: "rowan", text: "\"They're finding me one, apparently.\"" },
        { say: "teobalt", text: "\"Then somebody has a list with your name on it. That is reassuring. I should like to meet them.\"" }
      ] }
    ] },
    { say: "teobalt", text: "\"I have drawn up a list of my own. It is provisional. Most things are, before ten-forty.\"" },
    { flag: "chat_teobalt_offered" },
    { choice: [
      { text: "\"May I see the list? I'd like to know what's on it.\"", steps: [
        { say: "rowan", text: "\"May I see the list? I'd like to know what's on it.\"" },
        { scene: "teobalt_list" },
        { time: 6 },
        { scene: "chat_teobalt" }
      ] },
      { text: "Hold out the stapler you found in the lounge.", when: (s)=>!!s.flags["found_stapler"] && !s.flags["stapler_returned"], steps: [
        { scene: "teobalt_stapler" },
        { time: 6 },
        { scene: "chat_teobalt" }
      ] },
      { text: "\"I'll let you count. Sorry for the interruption.\"", steps: [
        { say: "rowan", text: "\"I'll let you count. Sorry for the interruption.\"" },
        { say: "teobalt", text: "\"It is no bother. It is, at worst, an interruption. And I like those, in moderation.\"" },
        { time: 6 }
      ] }
    ] },
    { end: true },
    { label: "again" },
    { when: (s)=>!!s.flags["has_unloading_list"] && !s.flags["teobalt_teal_noticed"], jump: "teal" },
    { when: (s)=>!!s.flags["stapler_returned"], say: "teobalt", text: "\"Rowan.\" The stapler is on top of the clipboard now, squared to its edge. \"I am between items. Please.\"" },
    { when: (s)=>!s.flags["stapler_returned"], say: "teobalt", text: "\"Rowan. I am at the trunks, and the trunks can wait. Please.\"" },
    { jump: "menu" },
    { label: "teal" },
    { say: "teobalt", text: "\"Rowan. Is the list working?\"" },
    { say: "rowan", text: "\"It's wonderful. It's teal.\"" },
    { say: "teobalt", text: "\"Teal. Yes.\" The pen stops halfway to his ear. \"Nobody ever notices the teal.\"" },
    { flag: "teobalt_teal_noticed" },
    AFF("teobalt", 2, "Noticed the teal"),
    { label: "menu" },
    { time: 3 },
    { choice: [
      { text: "Hold out the stapler you found in the lounge.", when: (s)=>!!s.flags["found_stapler"] && !s.flags["stapler_returned"], steps: [
        { scene: "teobalt_stapler" }
      ] },
      { text: "\"Could I see that list of yours after all?\"", when: (s)=>!s.flags["has_unloading_list"], steps: [
        { say: "rowan", text: "\"Could I see that list of yours after all?\"" },
        { scene: "teobalt_list" }
      ] },
      { text: "\"Have you got a moment between items?\"", when: (s)=>!s.flags["chat_teobalt_done"], steps: [
        { say: "rowan", text: "\"Have you got a moment between items?\"" },
        { say: "teobalt", text: "\"I have four. I allowed for it.\"" },
        { scene: "chat_teobalt" }
      ] },
      { text: "\"I'll let you get back to it.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to it.\"" },
        { say: "teobalt", text: "\"Thank you. Mind the third stair; I have reported it.\"" }
      ] }
    ] }
  ]
});

scene("teobalt_list", {
  steps: [
    { say: "teobalt", text: "\"Three things.\"" },
    { text: "A rustle, a page, a pen." },
    { when: (s)=>!s.flags["stapler_returned"] && !s.flags["chat_teobalt_1"], say: "teobalt", text: "\"One: the unloading order, which I have taken the liberty of estimating. Two: who has my stapler, which is not relevant yet. Three is confidential until I have solved one and two.\"" },
    { when: (s)=>!s.flags["stapler_returned"] && !!s.flags["chat_teobalt_1"], say: "teobalt", text: "\"One: the unloading order, which I have taken the liberty of estimating. Two: who has my stapler, which is not relevant yet. Three was confidential, until I told you about it by accident.\"" },
    { when: (s)=>!!s.flags["stapler_returned"], say: "teobalt", text: "\"One: the unloading order, which I have taken the liberty of estimating. Two: who had my stapler, which you have since settled; it is now in violet. Three you know already, and I am trusting you with it.\"" },
    { flag: "teobalt_list_told" },
    { text: "He tears out a clean copy and hands it over. It is colour-coded." },
    { say: "teobalt", text: "\"I used teal for the items I am worried about.\"" },
    { choice: [
      { text: "\"There's a lot of teal.\"", steps: [
        { say: "rowan", text: "\"There's a lot of teal.\"" },
        { say: "teobalt", text: "\"I am a worrying person.\" A very small, very pleased pause. \"It is a gift.\"" },
        { flag: "teobalt_teal_noticed" }
      ] },
      { text: "\"About item two.\" Hold out the stapler you found in the lounge.", when: (s)=>!!s.flags["found_stapler"] && !s.flags["stapler_returned"], hint: "You have it", steps: [
        { scene: "teobalt_stapler" }
      ] },
      { text: "\"Who would take a stapler?\"", when: (s)=>!s.flags["stapler_returned"] && !s.flags["found_stapler"], steps: [
        { say: "rowan", text: "\"Who would take a stapler?\"" },
        { say: "teobalt", text: "\"That is the question I have underlined.\" He shows you. It is underlined twice. \"It is stencilled with my name. It cannot be mistaken for anybody else's. I am therefore obliged to consider *intent*.\"" },
        { say: "rowan", text: "\"Or it fell out of a bag.\"" },
        { say: "teobalt", text: "\"…I had not listed 'fell'.\" A very small mark. \"Thank you. That is a kinder version than mine.\"" }
      ] }
    ] },
    { item: "Teobalt's unloading list" },
    { flag: "has_unloading_list" },
    { when: (s)=>!s.flags["stapler_returned"] && !s.flags["chat_teobalt_1"] && !s.flags["teobalt_tuba_quest"], ...NOTE("teobalt", "Has lost his stapler. Item three on his list is confidential.") },
    { when: (s)=>!s.flags["stapler_returned"] && (!!s.flags["chat_teobalt_1"] || !!s.flags["teobalt_tuba_quest"]), ...NOTE("teobalt", "Has lost a stapler with his name stencilled on it.") },
    AFF("teobalt", 3, "Wanted the list")
  ]
});

scene("teobalt_stapler", {
  steps: [
    { text: "You hold out the heavy teal stapler from behind the duffels." },
    { say: "teobalt", text: "\"That is — \"" },
    { text: "He stops. He takes it in both hands, turns it over, finds his own stencil, and for a moment says nothing at all." },
    { when: (s)=>!!s.flags["teobalt_list_told"], say: "teobalt", text: "\"Item two. Solved.\"" },
    { when: (s)=>!s.flags["teobalt_list_told"], say: "teobalt", text: "\"My stapler. It has been missing since the harbour. I had not yet told anybody; I did not wish to cause alarm.\"" },
    { say: "teobalt", text: "\"I had it down as stolen. I had made a list of suspects.\"" },
    { text: "A very small, very bright pause." },
    { say: "teobalt", text: "\"You are not on it. You have never been on it.\"" },
    { choice: [
      { text: "\"It was behind a duffel in the lounge. With a sock.\"", steps: [
        { say: "rowan", text: "\"It was behind a duffel in the lounge. With a sock.\"" },
        { say: "teobalt", text: "\"A sock.\" He writes it down. \"Then it fell, and nobody took it.\"" },
        { say: "teobalt", text: "\"I find that I am relieved about the wrong part. The stapler I could have replaced. I should not have liked it to be a ship on which somebody took it.\"" }
      ] },
      { text: "\"It says to staple nothing. I stapled nothing.\"", steps: [
        { say: "rowan", text: "\"It says to staple nothing. I stapled nothing.\"" },
        { say: "teobalt", text: "\"You read the base.\" The faintest flush. \"People generally try it on something first. The instruction is there because of a history.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["chat_teobalt_1"], say: "teobalt", text: "\"Item three you already have, through my own indiscretion. If you should meet anybody who looks as if they had mislaid a tuba, I would be obliged.\"" },
    { when: (s)=>!s.flags["chat_teobalt_1"] && !!s.flags["teobalt_list_told"], say: "teobalt", text: "\"Item three, since you have earned it, is the tuba. Somebody boarded with a tuba, and nobody has claimed it. A thing nobody owns is a thing nobody will collect.\"" },
    { when: (s)=>!s.flags["chat_teobalt_1"] && !s.flags["teobalt_list_told"], say: "teobalt", text: "\"You have solved the second item on my list without having seen the list. In fairness you should have the third, which is confidential: somebody boarded with a tuba, and nobody has claimed it. A thing nobody owns is a thing nobody will collect.\"" },
    { text: "From an inside pocket he produces a small envelope marked FINDER'S FEES, which is not a new envelope, and counts ten Smug Coins into your hand." },
    { item: "Teobalt's stapler", n: -1 },
    { flag: "stapler_returned" },
    { flag: "teobalt_tuba_quest" },
    { coins: 10 },
    NOTE("teobalt", "Somebody boarded with a tuba that nobody has claimed. He would like its owner found."),
    AFF("teobalt", 4, "Returned his stapler")
  ]
});

scene("chat_teobalt", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_teobalt_1"] && !!s.flags["chat_teobalt_2"] && !!s.flags["chat_teobalt_3"] && !!s.flags["chat_teobalt_x"], jump: "done" },
    { choice: [
      { text: "\"Have you settled it yet? The unloading order?\"", when: (s)=>!s.flags["chat_teobalt_1"], steps: [
        { say: "rowan", text: "\"Have you settled it yet? The unloading order?\"" },
        { say: "teobalt", text: "\"Provisionally. Duffels, then trunks, then the tuba.\"" },
        { text: "A very small, very pained pause." },
        { when: (s)=>!!s.flags["teobalt_tuba_quest"], say: "teobalt", text: "\"I remain less certain about the tuba.\"" },
        { when: (s)=>!s.flags["teobalt_tuba_quest"], say: "teobalt", text: "\"I should not have said 'tuba'. That is the third item on my list, and the third item was confidential.\"" },
        { when: (s)=>!s.flags["teobalt_tuba_quest"], say: "rowan", text: "\"There's a tuba?\"" },
        { when: (s)=>!s.flags["teobalt_tuba_quest"], say: "teobalt", text: "\"There is a tuba. In the luggage cage. Its label says TUBA, in capitals, and nothing else. I have turned the label over on four separate occasions.\"" },
        { choice: [
          { text: "\"Whose is it?\"", steps: [
            { say: "rowan", text: "\"Whose is it?\"" },
            { say: "teobalt", text: "\"I do not know. That is what concerns me. Nobody has asked after it, and a tuba is not a thing one overlooks.\"" },
            { say: "rowan", text: "\"And if nobody does?\"" },
            { say: "teobalt", text: "\"Then it stands on the pier in the weather, and it is nobody's fault. That is the worst kind of fault. One cannot write to it.\"" },
            { say: "teobalt", text: "\"…I expect I shall carry it up myself. I have left a line for that.\"" }
          ] },
          { text: "\"Perhaps it belongs to the Academy.\"", steps: [
            { say: "rowan", text: "\"Perhaps it belongs to the Academy.\"" },
            { say: "teobalt", text: "\"Then the label would say so. Every label in that cage has a name on it, handwritten, on string; I have read them all. This one says TUBA, which I could have established unaided.\"" },
            { say: "teobalt", text: "\"No. Somebody on this ship owns a tuba and is not saying so. I do not judge. I should simply like to know where to put them in the queue.\"" }
          ] }
        ] },
        AFF("teobalt", 2, "Took the list seriously"),
        { flag: "chat_teobalt_1" },
        NOTE("teobalt", "Does not know whose the tuba is. It worries him."),
        { time: 3 }
      ] },
      { text: "\"Why lists? Most people just worry.\"", when: (s)=>!s.flags["chat_teobalt_2"], steps: [
        { say: "rowan", text: "\"Why lists? Most people just worry.\"" },
        { say: "teobalt", text: "\"Because things go wrong in an *order*.\" He straightens his collar by a quarter of an inch. \"If you know the order, you can stand in front of it.\"" },
        { say: "rowan", text: "\"And if you don't know it?\"" },
        { say: "teobalt", text: "\"Then you make a list of what you don't know. It is surprisingly effective.\"" },
        { choice: [
          { text: "\"How old were you when you worked that out?\"", steps: [
            { say: "rowan", text: "\"How old were you when you worked that out?\"" },
            { say: "teobalt", text: "\"Ten.\" There is no hesitation whatever. \"There were six of us and one bathroom, and I am the eldest. I drew up a rota in wax crayon and fixed it to the door.\"" },
            { say: "rowan", text: "\"Did it hold?\"" },
            { say: "teobalt", text: "\"It held for four years. Then I drew up another. The second was laminated.\"" }
          ] },
          { text: "\"That sounds like a lot to stand in front of.\"", steps: [
            { say: "rowan", text: "\"That sounds like a lot to stand in front of.\"" },
            { say: "teobalt", text: "\"It is only a lot if it arrives all at once. That is the entire purpose of a list.\"" },
            { say: "teobalt", text: "\"I am aware that it does not look restful. I assure you it is the most restful thing I know. I have done it since I was ten. There were six of us, I am the eldest, and there was one bathroom.\"" },
            { say: "rowan", text: "\"A rota?\"" },
            { say: "teobalt", text: "\"In wax crayon.\" With quiet pride. \"It held.\"" }
          ] }
        ] },
        AFF("teobalt", 2, "Asked why"),
        { flag: "chat_teobalt_2" },
        NOTE("teobalt", "Makes lists because things go wrong in an order."),
        NOTE("teobalt", "Eldest of six. Drew up his first rota at ten, in wax crayon."),
        { time: 3 }
      ] },
      { text: "\"You've planned the gangway. Have you planned the year as well?\"", when: (s)=>!s.flags["chat_teobalt_3"], steps: [
        { say: "rowan", text: "\"You've planned the gangway. Have you planned the year as well?\"" },
        { say: "teobalt", text: "\"In outline. I have left room for the unforeseen. It has its own page.\"" },
        { say: "rowan", text: "\"And what's at the top? Of the year, not the unforeseen.\"" },
        { say: "teobalt", text: "\"For things to work.\" A pause. \"I know it sounds small. It is not small. Ask anyone who has ever lost a stapler.\"" },
        { choice: [
          { text: "\"I think that's a very good thing to want.\"", steps: [
            { say: "rowan", text: "\"I think that's a very good thing to want.\"" },
            { say: "teobalt", text: "\"Do you? Most people say it is a very dull one.\" The faintest, most pleased flush. \"Thank you.\"" },
            AFF("teobalt", 2, "Took his aim seriously")
          ] },
          { text: "\"Dull things that work hold up most of a day. I fold sheets in a laundromat; I'd know.\"", steps: [
            { say: "rowan", text: "\"Dull things that work hold up most of a day. I fold sheets in a laundromat; I'd know.\"" },
            { say: "teobalt", text: "\"A laundromat.\" With respect. \"Then you understand cycles. Very few people understand cycles.\"" },
            { say: "teobalt", text: "\"I am told there is a correct way to fold a fitted sheet. I have never believed it.\"" },
            { say: "rowan", text: "\"There is.\"" },
            { say: "teobalt", text: "\"…Then that goes on the list.\"" },
            AFF("teobalt", 3, "Understood cycles")
          ] }
        ] },
        { say: "teobalt", text: "\"And you? What is at the top of yours?\"" },
        { choice: [
          { text: "\"To get through one real game without dropping the cards.\"", steps: [
            { say: "rowan", text: "\"To get through one real game without dropping the cards.\"" },
            { say: "teobalt", text: "\"That is a sound first item. Specific, and achievable. Most people begin with 'become champion' and are surprised when Tuesday arrives first.\"" }
          ] },
          { text: "\"I haven't written it yet.\"", steps: [
            { say: "rowan", text: "\"I haven't written it yet.\"" },
            { say: "teobalt", text: "\"Then the first item is 'write the list'.\" Entirely serious. \"It is permitted. I checked, once.\"" }
          ] }
        ] },
        { flag: "chat_teobalt_3" },
        NOTE("teobalt", "Wants things to work."),
        { time: 3 }
      ] },
      { text: "\"Your pages are ruled in four colours. Is that a system, or do you just own four pens?\"", when: (s)=>!s.flags["chat_teobalt_x"], steps: [
        { say: "rowan", text: "\"Your pages are ruled in four colours. Is that a system, or do you just own four pens?\"" },
        { say: "teobalt", text: "\"Ah.\"" },
        { text: "A slight brightening, as of a lamp being turned up one notch." },
        { when: (s)=>!s.flags["has_unloading_list"], say: "teobalt", text: "\"Teal is for things I am worried about. Orange is for things that are ordinary. Violet is for things I have solved. Grey is for things I have not decided how to feel about.\"" },
        { when: (s)=>!!s.flags["has_unloading_list"], say: "teobalt", text: "\"Teal you have met already: worries. Orange is for things that are ordinary. Violet is for things I have solved. Grey is for things I have not decided how to feel about.\"" },
        { say: "rowan", text: "\"Is there a lot of grey?\"" },
        { say: "teobalt", text: "\"There is currently a *great* deal of grey. It is the whole of the island.\" He glances, with great gravity, at the horizon. \"I do not know how to list it.\"" },
        { choice: [
          { text: "\"Start with the pier. You've done the pier already.\"", steps: [
            { say: "rowan", text: "\"Start with the pier. You've done the pier already.\"" },
            { say: "teobalt", text: "\"…The pier is teal.\"" },
            { say: "rowan", text: "\"Teal's a colour. It isn't grey any more.\"" },
            { say: "teobalt", text: "\"That is — \" The pen stops in mid-air. \"That is a method. One converts the grey a berth at a time.\"" },
            { text: "He writes PIER at the head of a clean page and looks at it with something close to affection." },
            AFF("teobalt", 3, "Gave him a method")
          ] },
          { text: "\"What colour am I?\"", steps: [
            { say: "rowan", text: "\"What colour am I?\"" },
            { say: "teobalt", text: "\"You were grey when you came up the stair.\" He does not need to consult anything. \"At present you are orange.\"" },
            { say: "rowan", text: "\"Ordinary.\"" },
            { say: "teobalt", text: "\"It is a compliment. I am extremely fond of ordinary. Ordinary is what is left over when everything has gone right.\"" },
            AFF("teobalt", 2, "Asked his own colour")
          ] }
        ] },
        { flag: "chat_teobalt_x" },
        NOTE("teobalt", "Colour-codes his lists: teal for worries, orange for ordinary, violet for solved, grey for undecided."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_teobalt"], steps: [
        { scene: "deck_teobalt" }
      ] },
      { text: "\"Would you play me a game, some time?\"", when: (s)=>!s.flags["teobalt_thursday"], steps: [
        { say: "rowan", text: "\"Would you play me a game, some time?\"" },
        { say: "teobalt", text: "\"Thursday. I am making a list.\" A faint, regretful smile. \"It is an excellent offer. I accept it for Thursday.\"" },
        { choice: [
          { text: "\"Thursday of which week?\"", steps: [
            { say: "rowan", text: "\"Thursday of which week?\"" },
            { say: "teobalt", text: "\"This one. I cannot yet give you an hour, because nobody has told us the timetable, which worries me. I shall find you. I am good at finding people; they tend to be where they were told to be, plus four minutes.\"" }
          ] },
          { text: "\"Thursday. I'll try to be easy to find.\"", steps: [
            { say: "rowan", text: "\"Thursday. I'll try to be easy to find.\"" },
            { say: "teobalt", text: "\"You will be the one without the jacket. And if they have found you a jacket by then, I shall have a note of which.\"" }
          ] }
        ] },
        { flag: "teobalt_thursday" },
        AFF("teobalt", 1, "Asked for a game"),
        { time: 2 }
      ] },
      { text: "\"I'll let you get back to the trunks.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the trunks.\"" },
        { say: "teobalt", text: "\"Thank you. They will not sort themselves.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_teobalt_done" },
    { say: "teobalt", text: "\"I find that I have exceeded my conversational allowance. I shall carry the surplus forward.\" He makes a note of it. \"Thank you.\"" },
    { end: true }
  ]
});

scene("deck_teobalt", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_teobalt"], end: true },
    { choice: [
      { text: "\"A clipboard, four colours of ink, a list for everything. You'd play something that makes rules. Control? A lock?\"", hint: "From his clipboard", steps: [
        { say: "rowan", text: "\"A clipboard, four colours of ink, a list for everything. You'd play something that makes rules. Control? A lock?\"" },
        { say: "teobalt", text: "\"One: yes.\" Brightly. \"Two: *yes*. Three: I can't believe you guessed it.\"" },
        { say: "teobalt", text: "\"Order of Tusca. Hatusbal forbids shuffling, and every Tuscan adds another clause.\"" },
        AFF("teobalt", 2, "Read his deck")
      ] },
      { text: "\"What do you play, Teobalt? I'd guess it involves procedure.\"", steps: [
        { say: "rowan", text: "\"What do you play, Teobalt? I'd guess it involves procedure.\"" },
        { say: "teobalt", text: "\"Order of Tusca. Control. Hatusbal makes it impossible to shuffle, and each creature adds a clause.\" He hears it, and nods. \"Yes, that is how it sounds.\"" },
        AFF("teobalt", 1, "Asked about his deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_teobalt" },
        { end: true }
      ] }
    ] },
    { text: "You have taken a half-step back without meaning to. Your voice comes out low and exact, as if you were reading from a sheet." },
    { say: "rowan", text: "\"…Aristocrat, Artist, Mystic, Prisoner. Each one a clause. No Potions. No multi-card draws. No extra gold. Natas makes a Master's Plan every turn and cancels the one card that mattered.\"" },
    { say: "rowan", text: "\"Slow. Icy Grave. Forbidden Zone. Mr. Jiggles and a Haressassin grind for the damage.\" A breath. \"Plain mid-sized bodies. One Master's Plan a turn, no more.\"" },
    { say: "teobalt", text: "\"…You are describing my deck.\" A very quiet, very serious voice. \"That is the most accurate description I have ever heard of my deck, including my own.\"" },
    { say: "teobalt", text: "\"May I ask where you learned it? It is not a list one meets by accident.\"" },
    { choice: [
      { text: "\"I've sat across from it. On a screen, a good many times.\"", steps: [
        { say: "rowan", text: "\"I've sat across from it. On a screen, a good many times.\"" },
        { say: "teobalt", text: "\"And you took notes.\" It is not a question. It is the highest thing he knows how to say. \"Then a game between us will be instructive for one of us. I have not decided which.\"" }
      ] },
      { text: "\"I read deck lists the way you write unloading orders.\"", steps: [
        { say: "rowan", text: "\"I read deck lists the way you write unloading orders.\"" },
        { say: "teobalt", text: "\"All of them. Twice.\" He nods, slowly, as at a fellow member of a small and unfashionable club. \"Then we shall get on.\"" }
      ] }
    ] },
    AFF("teobalt", 1, "Knew his deck"),
    DECK("teobalt")
  ]
});

scene("ferry_hedda", {
  steps: [
    { when: (s)=>!!s.flags["met_hedda"], jump: "again" },
    { text: "The starboard side deck is the narrow way between bow and stern, and somebody has turned it into a checkpoint." },
    { text: "She is tiny: a wild mane of moss-green hair under a crown of fresh wildflowers, a gold jacket with a plain grey collar hanging open over a gardening apron, and a megaphone slung across her back on a strap of bicycle inner tube." },
    { text: "In the crook of one arm she is sheltering a small pot of lavender from the wind. In the other hand is a board with a pen on a string, and she is holding it across the deck like a barrier." },
    { say: "hedda", alias: "Girl with a petition", text: "\"You! Jacketless! You haven't signed. I'd remember; I've got every face on this boat against a line.\"" },
    { choice: [
      { text: "\"What would I be signing?\"", steps: [
        { say: "rowan", text: "\"What would I be signing?\"" },
        { say: "hedda", alias: "Girl with a petition", text: "\"A reader.\" Narrow, pleased suspicion. \"Good. Readers are slower, but they don't cross themselves out afterwards. Here.\"" },
        AFF("hedda", 1, "Asked to read it first")
      ] },
      { text: "\"Is it for something, or against something?\"", steps: [
        { say: "rowan", text: "\"Is it for something, or against something?\"" },
        { say: "hedda", alias: "Girl with a petition", text: "\"It's FOR knowing. Nobody is ever against knowing. They just don't want to be the one who asked.\"" },
        { say: "hedda", alias: "Girl with a petition", text: "\"So I'm asking. For all of you. Here. Read.\"" }
      ] },
      { text: "\"I'll sign anything that gets me past.\"", hint: "Careless", steps: [
        { say: "rowan", text: "\"I'll sign anything that gets me past.\"" },
        { say: "hedda", alias: "Girl with a petition", text: "\"Then I don't want it.\" The board is withdrawn by an inch. \"A signature you didn't mean is litter, and I pick up enough litter.\"" },
        { say: "hedda", alias: "Girl with a petition", text: "\"Read it. Then decide. That's what the pen is for.\"" },
        AFF("hedda", -1, "Offered an empty signature")
      ] }
    ] },
    { text: "The sheet on the board is ruled by hand. Across the top, in block capitals: ASK WHAT'S IN THE POT. Underneath, smaller: *We, the undersigned, ask that every kitchen on Caldera Key post, daily and legibly, the contents of every dish it serves.*" },
    { text: "Line one, in the same hand, is HEDDA NJORD. Below it run some two dozen names, most of them in the careful writing of people who were being watched." },
    MET("hedda", "Hedda Njord"),
    { say: "rowan", text: "\"Hedda Njord. Line one.\"" },
    { say: "hedda", text: "\"Somebody has to be. And you are?\"" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "hedda", text: "\"Vance. Right. Listen. The letter said 'full board'. Full of WHAT? Nobody on this boat can tell me. I asked the steward, and he said 'supper'. That is not an ingredient.\"" },
    { choice: [
      { text: "Take the pen and sign it.", steps: [
        { text: "You write ROWAN VANCE on the next free line. Your hand is not entirely steady. She watches every letter go down." },
        { say: "hedda", text: "\"Line twenty-seven.\" She tilts the board to the light. \"You pressed hard. People who press hard mean it.\"" },
        { flag: "hedda_signed" },
        AFF("hedda", 3, "Signed and meant it")
      ] },
      { text: "\"'Legibly.' Who decides what counts as legible?\"", hint: "Honest doubt", steps: [
        { say: "rowan", text: "\"'Legibly.' Who decides what counts as legible?\"" },
        { say: "hedda", text: "\"That's — \" She draws breath for a speech, and lets it go again. \"No. That's a fair hole. A cook could post it in a doctor's scrawl and call it done.\"" },
        { text: "She takes the pen on its string, strikes out *legibly*, and writes above it, very small: *in capitals*." },
        { say: "hedda", text: "\"Better. You've improved a petition. Now you more or less have to sign it.\"" },
        { choice: [
          { text: "\"Then I'd better.\"", steps: [
            { say: "rowan", text: "\"Then I'd better.\"" },
            { text: "You write ROWAN VANCE on the next free line. Your hand is not entirely steady. She watches every letter go down." },
            { say: "hedda", text: "\"Line twenty-seven. And an amendment. That's more than the whole of the upper deck managed.\"" },
            { flag: "hedda_signed" },
            AFF("hedda", 3, "Argued, then signed")
          ] },
          { text: "\"Let me see what's in the pot first. Then I'll know what I'm asking for.\"", steps: [
            { say: "rowan", text: "\"Let me see what's in the pot first. Then I'll know what I'm asking for.\"" },
            { say: "hedda", text: "\"That's backwards.\" A scowl of real thought. \"…It's backwards in an *interesting* way. Fine. The line stays open.\"" },
            AFF("hedda", 2, "Disagreed honestly")
          ] }
        ] }
      ] },
      { text: "\"I don't sign things on my first morning anywhere. Ask me when I've eaten there.\"", steps: [
        { say: "rowan", text: "\"I don't sign things on my first morning anywhere. Ask me when I've eaten there.\"" },
        { say: "hedda", text: "\"That's annoyingly principled.\"" },
        { say: "hedda", text: "\"Fine. I'll find you after supper. I'm very easy to hear.\"" },
        AFF("hedda", 1, "Said no straight")
      ] }
    ] },
    { say: "hedda", text: "\"And what do *you* eat, Vance? Honestly. I can smell a lie, and I can smell bacon, and I've had to smell both this morning.\"" },
    { choice: [
      { text: "\"Toast, mostly. Whatever's cheap and still there at midnight.\"", steps: [
        { say: "rowan", text: "\"Toast, mostly. Whatever's cheap and still there at midnight.\"" },
        { say: "hedda", text: "\"Toast is innocent.\" It has the sound of a ruling. \"Butter isn't, but we'll get to butter. One campaign at a time.\"" },
        AFF("hedda", 1, "Gave a straight answer")
      ] },
      { text: "\"Meat, sometimes. I'd rather you heard it from me.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"Meat, sometimes. I'd rather you heard it from me.\"" },
        { text: "Her chin goes up. You brace for the megaphone. It does not come." },
        { say: "hedda", text: "\"…Right.\"" },
        { say: "hedda", text: "\"You said it to my face, and you didn't say 'only a little'. Everybody says 'only a little'.\"" },
        { say: "hedda", text: "\"You're on the list of people I'm going to change. It's a much better list than the other one.\"" },
        AFF("hedda", 2, "Told her to her face")
      ] },
      { text: "\"Is that part of the petition?\"", steps: [
        { say: "rowan", text: "\"Is that part of the petition?\"" },
        { say: "hedda", text: "\"No. That's part of me. The petition is the polite bit.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"I signed TWICE! She crossed one of me out!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Once is plenty, Nathan.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("hedda", "Collecting signatures on the ferry: every kitchen on the island should post what is in the pot."),
    { time: 8 },
    { scene: "chat_hedda_ferry" },
    { end: true },
    { label: "again" },
    { when: (s)=>!!s.flags["hedda_signed"], say: "hedda", text: "\"Line twenty-seven! Come to admire your work? It's still there. I checked.\"" },
    { when: (s)=>!s.flags["hedda_signed"], say: "hedda", text: "\"Vance. The line's still open, and so is the pen.\"" },
    { choice: [
      { text: "\"Give me the pen. I've thought about it.\"", when: (s)=>!s.flags["hedda_signed"], steps: [
        { say: "rowan", text: "\"Give me the pen. I've thought about it.\"" },
        { text: "You write ROWAN VANCE on the next free line. She watches every letter go down." },
        { say: "hedda", text: "\"Went away, thought, came back.\" She blows on the ink, though it is a ballpoint. \"That's worth two of the ones who signed to get rid of me.\"" },
        { flag: "hedda_signed" },
        AFF("hedda", 2, "Came back to sign")
      ] },
      { text: "\"Have you got a minute that isn't for the petition?\"", when: (s)=>!s.flags["chat_hedda_ferry_done"], steps: [
        { say: "rowan", text: "\"Have you got a minute that isn't for the petition?\"" },
        { say: "hedda", text: "\"One. I'm timing it.\"" },
        { scene: "chat_hedda_ferry" }
      ] },
      { text: "\"Good luck with the rest of the ship.\"", steps: [
        { say: "rowan", text: "\"Good luck with the rest of the ship.\"" },
        { say: "hedda", text: "\"Luck's for people without a clipboard.\"" }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_hedda_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_hedda_ferry_1"] && !!s.flags["chat_hedda_ferry_2"] && !!s.flags["chat_hedda_ferry_3"], jump: "done" },
    { choice: [
      { text: "Her eyes keep going up, past your shoulder. Ask what's up there.", when: (s)=>!s.flags["chat_hedda_ferry_1"], steps: [
        { say: "rowan", text: "\"You keep looking up over my shoulder. What's up there?\"" },
        { text: "You turn. Behind the ship the gulls are strung out along the wake like washing. Her lips are moving." },
        { say: "hedda", text: "\"Eleven. There were fourteen at the harbour wall.\" All the rally has gone out of her voice; what is left is quieter, and a good deal younger. \"Three turned back at the first buoy. Just turned, all together, and went home. I'd love to know how they agreed which three.\"" },
        { choice: [
          { text: "\"You counted them? From the harbour?\"", steps: [
            { say: "rowan", text: "\"You counted them? From the harbour?\"" },
            { say: "hedda", text: "\"From the harbour wall. I count them every morning, wherever I am. I've a notebook.\"" },
            { say: "hedda", text: "\"This is the first morning I've had a ship to count them from. I didn't know they'd follow it. Nobody tells you that.\"" },
            { say: "hedda", text: "\"Nobody counts gulls. Everybody counts *on* them: they'll be there, shouting, on the roof. And then one year there are fewer, and nobody can say how many fewer, because nobody wrote it down.\"" },
            { say: "rowan", text: "\"So you write it down.\"" },
            { say: "hedda", text: "\"Somebody has to be able to say.\"" }
          ] },
          { text: "\"Which one's your favourite?\"", steps: [
            { say: "rowan", text: "\"Which one's your favourite?\"" },
            { say: "hedda", text: "\"You don't have *favourites*, they're not — \"" },
            { say: "hedda", text: "\"…The one with the bad foot. Third from the left. He's kept up the whole way on a foot and a half, and nobody on this boat has given him so much as a crust.\"" },
            { text: "She says it furiously. Her eyes are very bright. You decide not to have noticed either." }
          ] }
        ] },
        { say: "hedda", text: "\"Don't tell anyone I do birds.\" The volume is coming back, like a tide. \"I do *causes*.\"" },
        AFF("hedda", 2, "Asked about the gulls"),
        { flag: "chat_hedda_ferry_1" },
        NOTE("hedda", "Counts the gulls every morning and writes the number down. There were eleven behind the ferry."),
        { time: 3 }
      ] },
      { text: "\"That's a lot of shelter for one pot of lavender.\"", when: (s)=>!s.flags["chat_hedda_ferry_2"], steps: [
        { say: "rowan", text: "\"That's a lot of shelter for one pot of lavender.\"" },
        { say: "hedda", text: "\"It's the salt. Salt burns them. People think plants like the sea. Plants don't like the sea; plants *put up with* the sea.\"" },
        { say: "rowan", text: "\"Where's it come from?\"" },
        { say: "hedda", text: "\"A windowsill.\" A pause. \"Three windowsills. It's been moved more than is good for it. The next one's the fourth, and I've promised it that's the last.\"" },
        { choice: [
          { text: "\"It looks as if it believes you.\"", steps: [
            { say: "rowan", text: "\"It looks as if it believes you.\"" },
            { say: "hedda", text: "\"It's a plant. It doesn't believe anything.\"" },
            { say: "hedda", text: "\"…It's put out two new shoots since Tuesday. You can read that how you like.\"" },
            AFF("hedda", 2, "Kind about the lavender")
          ] },
          { text: "\"A Commons bungalow. Is that a good fourth windowsill?\"", steps: [
            { say: "rowan", text: "\"A Commons bungalow. Is that a good fourth windowsill?\"" },
            { say: "hedda", text: "\"Grey collar, well spotted.\" She does not sound displeased. \"The letter says there's a porch. If the letter is lying about the porch, I'll be starting a second petition.\"" },
            AFF("hedda", 1, "Thought about the plant")
          ] }
        ] },
        { say: "hedda", text: "\"Have you ever kept anything alive? On purpose?\"" },
        { choice: [
          { text: "\"A spider plant, at the laundromat where I work. It was there before me. I just didn't stop.\"", steps: [
            { say: "rowan", text: "\"A spider plant, at the laundromat where I work. It was there before me. I just didn't stop.\"" },
            { say: "hedda", text: "\"Not stopping is most of it. Honestly. Most of what dies, dies of somebody stopping.\"" }
          ] },
          { text: "\"No. I've never had anywhere to put it.\"", steps: [
            { say: "rowan", text: "\"No. I've never had anywhere to put it.\"" },
            { say: "hedda", text: "\"…No.\"" },
            { say: "hedda", text: "\"Well. That's the windowsill problem, isn't it.\" She shifts the pot an inch further out of the wind, as if you had just reminded her." }
          ] }
        ] },
        { flag: "chat_hedda_ferry_2" },
        NOTE("hedda", "Has carried one pot of lavender across three windowsills. She has promised it the island is the last move."),
        { time: 3 }
      ] },
      { text: "\"Who's been the hardest to get onto that list?\"", when: (s)=>!s.flags["chat_hedda_ferry_3"], steps: [
        { say: "rowan", text: "\"Who's been the hardest to get onto that list?\"" },
        { say: "hedda", text: "\"The white-and-gold collars. One of them asked whether it was *binding*. Another wanted to see my mandate. I said: the mandate is that you've got a mouth.\"" },
        { say: "hedda", text: "\"There's a boy at the top of the bridge stair with a clipboard of his own. He read it twice, told me my margins were uneven, ruled me new ones — and THEN signed. I still don't know whether I was helped or inspected.\"" },
        { say: "hedda", text: "\"And that one — \" The board jabs along the deck, at a bench where a long girl is lying with a paperback open over her face. \"— signed without taking the book off. Didn't even sit up. I'm counting it. A hand's a hand.\"" },
        { choice: [
          { text: "\"And the ones who said no?\"", steps: [
            { say: "rowan", text: "\"And the ones who said no?\"" },
            { say: "hedda", text: "\"I write those down too. Different page.\"" },
            { say: "rowan", text: "\"To shout at them?\"" },
            { say: "hedda", text: "\"To go back. A no on the first morning is only somebody who hasn't been hungry yet.\" A beat. \"…And to shout at them, a bit.\"" },
            AFF("hedda", 1, "Asked about the noes")
          ] },
          { text: "\"You've spoken to more people this morning than I have all year.\"", steps: [
            { say: "rowan", text: "\"You've spoken to more people this morning than I have all year.\"" },
            { say: "hedda", text: "\"I haven't *spoken* to any of them. I've collected them. It's not the same.\"" },
            { text: "She stops, as if the sentence had surprised her on its way out." },
            { say: "hedda", text: "\"You're the first one who's asked me a thing that wasn't 'where do I sign'. Don't make it weird.\"" },
            AFF("hedda", 2, "Asked about her, not the cause")
          ] }
        ] },
        { flag: "chat_hedda_ferry_3" },
        NOTE("hedda", "Keeps a second page for everybody who said no, so that she can go back."),
        { time: 3 }
      ] },
      { text: "\"I'll let you get on. There's a ship to collect.\"", steps: [
        { say: "rowan", text: "\"I'll let you get on. There's a ship to collect.\"" },
        { text: "She unslings the megaphone, although the next person along the deck is all of four paces away." },
        { say: "hedda", text: "\"NEXT!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_hedda_ferry_done" },
    { say: "hedda", text: "\"That's all the minutes I've got. They were long ones. I let them run.\"" },
    { say: "hedda", text: "\"Go on. And if anybody asks, you were persuaded by the *arguments*.\"" },
    { end: true }
  ]
});

scene("ferry_freya", {
  steps: [
    { when: (s)=>!!s.flags["met_freya"], jump: "again" },
    { text: "A bench is bolted to the deckhouse wall on the starboard side, in the only strip of shade, and one girl has taken all of it." },
    { text: "She is long enough to need it: boots crossed over one armrest, an ice-blonde braid hanging off the other end nearly to the planks, a red jacket with a grey collar buttoned over a shirt and a narrow black tie." },
    { text: "A paperback lies open, face down, across her face. A steel flask stands on the deck within reach of her hand." },
    { text: "You slow down, to step round the braid." },
    { say: "freya", alias: "Girl under a book", text: "\"You have stopped.\" The book does not move. \"People who stop want the bench, or they want to know if I am dead. Which?\"" },
    { choice: [
      { text: "\"Checking you're alive, mostly.\"", steps: [
        { say: "rowan", text: "\"Checking you're alive, mostly.\"" },
        { say: "freya", alias: "Girl under a book", text: "\"Alive. Thank you. You are the first to check. The others stepped over.\"" },
        AFF("freya", 1, "Checked she was alive")
      ] },
      { text: "\"The bench. I've been on my feet since the harbour.\"", steps: [
        { say: "rowan", text: "\"The bench. I've been on my feet since the harbour.\"" },
        { text: "The boots withdraw from the armrest by exactly half a bench." },
        { say: "freya", alias: "Girl under a book", text: "\"Half. I am generous before noon. Don't spread it about.\"" },
        { text: "You sit. It is a very good half." },
        AFF("freya", 1, "Asked for what he wanted")
      ] },
      { text: "\"Neither. I was wondering what the book is.\"", steps: [
        { say: "rowan", text: "\"Neither. I was wondering what the book is.\"" },
        { say: "freya", alias: "Girl under a book", text: "\"A murder, in the language I grew up with. I know who did it. I knew on page nine.\"" },
        { say: "freya", alias: "Girl under a book", text: "\"It is not for reading. It is a roof.\"" },
        { flag: "freya_book_told" }
      ] }
    ] },
    { text: "The book lifts a quarter of an inch. One pale blue eye considers you, without hurry, from your shoes to your hair." },
    { say: "freya", alias: "Girl under a book", text: "\"No jacket. A face, though. Good. I like it.\"" },
    { say: "freya", alias: "Girl under a book", text: "\"I am telling you at this hour, with coffee in me and nothing else, so that you know I mean it. Freya Nordlicht.\"" },
    MET("freya", "Freya Nordlicht"),
    { choice: [
      { text: "\"Rowan Vance. Do you say that to everybody?\"", steps: [
        { say: "rowan", text: "\"Rowan Vance. Do you say that to everybody?\"" },
        { say: "freya", text: "\"Only when it is true. It saves a great deal of time.\"" },
        { say: "freya", text: "\"Most people spend weeks arranging to be told a thing like that. I would rather be on the other side of it by breakfast.\"" }
      ] },
      { text: "\"Rowan. …Thank you. I have no idea what to do with that.\"", steps: [
        { say: "rowan", text: "\"Rowan. …Thank you. I have no idea what to do with that.\"" },
        { say: "freya", text: "\"Nothing. It is information. It is not a bill.\"" },
        { text: "The eye is, very faintly, amused." },
        AFF("freya", 2, "Honest about being thrown")
      ] },
      { text: "\"Rowan. It's a tired face. You've caught it on a bad day.\"", steps: [
        { say: "rowan", text: "\"Rowan. It's a tired face. You've caught it on a bad day.\"" },
        { say: "freya", text: "\"Then I look forward to the good one, Rowan.\"" }
      ] }
    ] },
    { say: "freya", text: "\"Your hands, Rowan. They are having a small earthquake. Is that the boat, or is it people?\"" },
    { choice: [
      { text: "\"People. It passes when I stop being looked at.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"People. It passes when I stop being looked at.\"" },
        { say: "freya", text: "\"Hm.\"" },
        { text: "The book comes down again over the eye." },
        { say: "freya", text: "\"There. You are not being looked at.\"" },
        { text: "It is, absurdly, easier." },
        { say: "freya", text: "\"I am the other kind.\" From under the roof, quite level. \"I go wrong when nobody is looking. So between us, somebody is always steady. That is convenient.\"" },
        AFF("freya", 3, "Told her the truth")
      ] },
      { text: "\"The boat.\"", steps: [
        { say: "rowan", text: "\"The boat.\"" },
        { say: "freya", text: "\"It is not the boat. I have been horizontal on this boat since the harbour. I know precisely what the boat does.\"" },
        { say: "freya", text: "\"But keep the boat, if you like it. I do not take things away from people before lunch.\"" }
      ] }
    ] },
    { say: "freya", text: "\"Find me tonight. I am no use to anybody before ten. After that — \" The one visible corner of her mouth moves. \"I'm wicked by ten.\"" },
    { flag: "freya_said_wicked" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"She's got a BOOK on her FACE! Is that allowed? I'm going to try that!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Bench is taken, Nathan.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("freya", "Lies under a book until evening, and says what she likes about a person straight out."),
    { time: 7 },
    { scene: "chat_freya_ferry" },
    { end: true },
    { label: "again" },
    { text: "The book has not moved. Neither, as far as you can tell, has she." },
    { say: "freya", text: "\"The careful feet again. Sit, or stand in my light. Either is company.\"" },
    { choice: [
      { text: "\"Mind if I interrupt the book for a minute?\"", when: (s)=>!s.flags["chat_freya_ferry_done"], steps: [
        { say: "rowan", text: "\"Mind if I interrupt the book for a minute?\"" },
        { say: "freya", text: "\"It is a patient book.\"" },
        { scene: "chat_freya_ferry" }
      ] },
      { text: "\"Sleep well.\"", steps: [
        { say: "rowan", text: "\"Sleep well.\"" },
        { say: "freya", text: "\"I am not asleep. I am saving it.\"" }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_freya_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_freya_ferry_1"] && !!s.flags["chat_freya_ferry_2"] && !!s.flags["chat_freya_ferry_3"], jump: "done" },
    { choice: [
      { text: "\"You've found the only strip of shade on this side. On purpose?\"", when: (s)=>!s.flags["chat_freya_ferry_1"], steps: [
        { say: "rowan", text: "\"You've found the only strip of shade on this side. On purpose?\"" },
        { say: "freya", text: "\"It is nineteen degrees, and the morning is not half done. Somebody should be told.\"" },
        { say: "rowan", text: "\"Nineteen's mild.\"" },
        { say: "freya", text: "\"Where I am from, nineteen is a headline.\"" },
        { say: "freya", text: "\"An island further north than you are thinking. There is a rifle by every door, for the bears. Here I am told that the most dangerous animal is a gull.\"" },
        { choice: [
          { text: "\"Then why come somewhere this warm?\"", steps: [
            { say: "rowan", text: "\"Then why come somewhere this warm?\"" },
            { say: "freya", text: "\"Because it is full.\"" },
            { say: "rowan", text: "\"Full?\"" },
            { say: "freya", text: "\"Of people. A whole island of them, all awake, all wanting to win at something. For that I can put up with heat.\"" },
            { say: "freya", text: "\"Cold I can do. I am very good at cold. It is *empty* I am no good at.\" She says it the way somebody else might mention an allergy." }
          ] },
          { text: "\"Have you ever actually needed the rifle?\"", steps: [
            { say: "rowan", text: "\"Have you ever actually needed the rifle?\"" },
            { say: "freya", text: "\"Twice it came off the hook. Once for a bear, who left. Once for my cousin, who was pretending to be a bear, and who also left.\"" },
            { say: "freya", text: "\"You learn to look at what a thing is before you are afraid of it. Most things are the cousin.\"" }
          ] }
        ] },
        AFF("freya", 2, "Asked about the north"),
        { flag: "chat_freya_ferry_1" },
        NOTE("freya", "From an island in the far north: a rifle by every door, for the bears. Finds nineteen degrees far too warm."),
        { time: 3 }
      ] },
      { text: "\"You've been under that book a good while. Missed anything?\"", when: (s)=>!s.flags["chat_freya_ferry_2"], steps: [
        { say: "rowan", text: "\"You've been under that book a good while. Missed anything?\"" },
        { say: "freya", text: "\"Nothing. A book on the face is not a wall. It is a hide.\"" },
        { say: "freya", text: "\"A tiny one with a petition has gone past me eleven times. On the third I signed, to see whether that would stop her. It did not. I like her.\"" },
        { say: "freya", text: "\"Further along there is a girl who introduced me to a bee. By name. I said good morning to it. It seemed the least I could do.\"" },
        { say: "freya", text: "\"And a small boy has rolled the ship's lifebuoy past me twice. I have decided not to know about that.\"" },
        { choice: [
          { text: "\"You signed a petition from under a book?\"", steps: [
            { say: "rowan", text: "\"You signed a petition from under a book?\"" },
            { say: "freya", text: "\"I read it first. One eye, under the edge. It asks what is in the pot. A fair question; where I am from you always ask, because sometimes it is seal.\"" },
            { say: "freya", text: "\"Also, she is going to win. I prefer to be early on the winning side. It is the only kind of bet I make.\"" }
          ] },
          { text: "\"And what did you make of me, from under there?\"", steps: [
            { say: "rowan", text: "\"And what did you make of me, from under there?\"" },
            { say: "freya", text: "\"You walk like somebody carrying a full tray. Careful. Nothing spilled.\"" },
            { say: "freya", text: "\"I like careful. On this boat it is a good deal rarer than loud.\"" }
          ] }
        ] },
        AFF("freya", 2, "Asked what she'd heard"),
        { flag: "chat_freya_ferry_2" },
        NOTE("freya", "Hears the whole deck from under her book. She signed the petition, and likes the girl who carries it."),
        { time: 3 }
      ] },
      { text: "\"What's in the flask?\"", when: (s)=>!s.flags["chat_freya_ferry_3"], steps: [
        { say: "rowan", text: "\"What's in the flask?\"" },
        { say: "freya", text: "\"Coffee. Black. It is morning; I am not an animal.\"" },
        { text: "A long arm comes down. She unscrews the cap, fills it without looking, and holds it out in your general direction." },
        { choice: [
          { text: "Take it.", steps: [
            { text: "It is scalding, and strong enough to stand a spoon in." },
            { say: "freya", text: "\"Wait. We do this properly. A toast.\"" },
            { say: "rowan", text: "\"With coffee?\"" },
            { say: "freya", text: "\"With whatever is in the hand. To whoever bolted this bench to the deck. Nobody has ever thanked him.\"" },
            { text: "You drink to the man who bolted the bench down. It seems only fair." },
            AFF("freya", 2, "Drank to the bench")
          ] },
          { text: "\"I'm shaky enough without it. But thank you.\"", steps: [
            { say: "rowan", text: "\"I'm shaky enough without it. But thank you.\"" },
            { say: "freya", text: "\"A man who says when it is enough. Noted, and liked.\"" },
            { say: "freya", text: "\"Then I drink for both.\" The cap goes up towards the sky, and the book stays exactly where it is. \"To whoever bolted this bench to the deck. Nobody has ever thanked him.\"" },
            AFF("freya", 2, "Said when it was enough")
          ] }
        ] },
        { flag: "chat_freya_ferry_3" },
        NOTE("freya", "Proposes toasts to absurd things. This morning: the man who bolted her bench to the deck."),
        { time: 3 }
      ] },
      { text: "\"I'll leave you to your book.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to your book.\"" },
        { say: "freya", text: "\"Tonight, Rowan.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_freya_ferry_done" },
    { say: "freya", text: "\"That is all the talking I own before noon. The rest I am keeping for tonight.\"" },
    { text: "The book settles. The conversation, you gather, has been put away carefully for later." },
    { end: true }
  ]
});

scene("ferry_trixie", {
  steps: [
    { when: (s)=>!!s.flags["met_trixie"], jump: "again" },
    { text: "Halfway along the starboard deck a girl is standing at the rail on tiptoe, and then not on tiptoe, and then on tiptoe again. Honey-blonde hair in two bunches that bounce half a beat behind the rest of her." },
    { text: "A red jacket, a grey collar with an enamel bee pinned to it, and yellow-striped socks pulled up to the knee. She is talking, earnestly and without a break, to the top of the rail." },
    { text: "You are about to put a hand on that rail, to get past her." },
    { say: "trixie", alias: "Girl in striped socks", text: "\"Stop! Sorry! Stop. Right by your hand. Don't swat.\"" },
    { choice: [
      { text: "Freeze, with your hand in the air.", hint: "Quiet", steps: [
        { text: "You stop, with your hand an inch above the rail. On the varnish, directly under your palm, a honeybee is walking in small, tired circles." },
        { say: "trixie", alias: "Girl in striped socks", text: "\"Oh, well done. That's just right. Most people flap.\"" },
        AFF("trixie", 3, "Stood still for a bee")
      ] },
      { text: "\"Who's by my hand?\"", steps: [
        { say: "rowan", text: "\"Who's by my hand?\"" },
        { say: "trixie", alias: "Girl in striped socks", text: "\"Her! There! Under your thumb, nearly.\"" },
        { text: "On the varnish, an inch from where your hand was going, a honeybee is walking in small, tired circles." },
        { say: "trixie", alias: "Girl in striped socks", text: "\"You said 'who'. People mostly say 'what'.\"" },
        AFF("trixie", 2, "Asked who, not what")
      ] },
      { text: "Step back, fast.", steps: [
        { text: "You jump back. The girl winces: not at you, at the speed." },
        { say: "trixie", alias: "Girl in striped socks", text: "\"Slowly! Everything slowly. It's all right, you didn't know. Nobody's cross.\"" },
        { text: "On the rail where your hand was going, a honeybee is walking in small, tired circles." }
      ] }
    ] },
    { text: "She lays one finger flat on the rail and waits. Everything else about her is in motion: heels, bunches, stripes. The finger might be carved. After a moment the bee walks up onto it." },
    { say: "trixie", alias: "Girl in striped socks", text: "\"There you are, my lovely. This is Belinda. I'm Trixie. Trixie Hollis. Belinda, this is — \"" },
    MET("trixie", "Trixie Hollis"),
    { flag: "trixie_ferry_belinda" },
    { say: "rowan", text: "\"Rowan.\"" },
    { say: "trixie", text: "\"— Rowan, who's got no jacket and lovely manners.\"" },
    { say: "trixie", text: "\"She's not from here. She came aboard at the harbour on a girl's hair. Tiny girl, green hair, flowers all in it. I don't think the girl knows she was a ferry.\"" },
    { say: "trixie", text: "\"And now it's all water, you see. A bee'll go three miles for a good clover, but not over this. She can't get home.\"" },
    { choice: [
      { text: "\"What happens to a bee who can't get home?\"", steps: [
        { say: "rowan", text: "\"What happens to a bee who can't get home?\"" },
        { text: "The heels stop. It is like a clock stopping." },
        { say: "trixie", text: "\"She gets tired.\" Quiet, and very practical. \"They wear out, on their own. They're not made for on their own.\"" },
        { say: "trixie", text: "\"So she's not going to be. She's going to sit on me till there's land, and then we'll find her some people. That's all. We'll just go slowly.\"" },
        { text: "The heels start again." },
        AFF("trixie", 2, "Asked the real question")
      ] },
      { text: "\"Then she's like everybody else on this boat. Nobody here knows anybody.\"", steps: [
        { say: "rowan", text: "\"Then she's like everybody else on this boat. Nobody here knows anybody.\"" },
        { say: "trixie", text: "\"That's JUST what I told her!\"" },
        { say: "trixie", text: "\"I said, Belinda, look at them all, standing about not knowing where to put their hands. You're doing ever so well, considering.\"" },
        { say: "trixie", text: "\"She'll sit on me till there's land, and then we'll find her some people. Same as the rest of us, really.\"" },
        AFF("trixie", 2, "Counted the bee in")
      ] },
      { text: "\"Are there bees on the island?\"", steps: [
        { say: "rowan", text: "\"Are there bees on the island?\"" },
        { say: "trixie", text: "\"There's flowers. You can smell them already, can't you? Sort of warm and green, under the engine.\"" },
        { say: "trixie", text: "\"Where there's flowers there's somebody working them. So she'll sit on me till there's land, and then we'll find her some people.\"" },
        AFF("trixie", 1, "Thought about the bee")
      ] }
    ] },
    { text: "She looks up from the bee to you, with exactly the same close, friendly attention." },
    { say: "trixie", text: "\"Are you sad, or just thinking? Your face does the same thing for both.\"" },
    { choice: [
      { text: "\"Tired. That's the third thing it does.\"", steps: [
        { say: "rowan", text: "\"Tired. That's the third thing it does.\"" },
        { say: "trixie", text: "\"Oh, tired! I never think of tired. I don't really get it till I fall over.\"" },
        { say: "trixie", text: "\"You want to sit down next to something busy. That's what I do. It's lovely and restful, watching somebody else work.\"" }
      ] },
      { text: "\"A bit of both, honestly.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"A bit of both, honestly.\"" },
        { text: "She does not say anything cheerful. She waits, on tiptoe, with the bee, for the rest of the sentence." },
        { say: "rowan", text: "\"I'm good at this game when nobody can see me. In a couple of hours a lot of people are going to be able to see me.\"" },
        { say: "trixie", text: "\"Oh.\" She gives it real thought. \"That's like a new hive, though, isn't it. Everybody has a good look at you on the way in. And then they've seen you, and they get on with things.\"" },
        AFF("trixie", 3, "Answered her honestly")
      ] },
      { text: "\"Just thinking.\"", steps: [
        { say: "rowan", text: "\"Just thinking.\"" },
        { say: "trixie", text: "\"Through your teeth a bit, though.\" It is not unkind. \"All right. You can tell me the other one later. I'll still want to know.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"A BEE! Can I hold her? I'll be SO quiet!\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "trixie", text: "\"You could have a go at quiet first, and then we'll see.\"" },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Morning, Belinda.\"" },
    { when: (s)=>!!s.flags["follow_baylee"], text: "Trixie looks up, and then a good deal further up, and for one whole second her heels are still." },
    { add: { ferry_talked: 1 } },
    NOTE("trixie", "Looking after a stowaway honeybee called Belinda until there is land."),
    { time: 7 },
    { scene: "chat_trixie_ferry" },
    { end: true },
    { label: "again" },
    { say: "trixie", text: "\"Rowan! Belinda, it's Rowan! Slowly, mind. She's having a wash.\"" },
    { choice: [
      { text: "\"How are the two of you getting on?\"", when: (s)=>!s.flags["chat_trixie_ferry_done"], steps: [
        { say: "rowan", text: "\"How are the two of you getting on?\"" },
        { say: "trixie", text: "\"Ever so well! She's told me all about the harbour. Well. I've told her. She agreed.\"" },
        { scene: "chat_trixie_ferry" }
      ] },
      { text: "\"I'll come back when she's presentable.\"", steps: [
        { say: "rowan", text: "\"I'll come back when she's presentable.\"" },
        { say: "trixie", text: "\"She says she's ALWAYS presentable, thank you!\"" }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_trixie_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_trixie_ferry_1"] && !!s.flags["chat_trixie_ferry_2"] && !!s.flags["chat_trixie_ferry_3"], jump: "done" },
    { choice: [
      { text: "\"Your feet haven't stopped since I got here. That finger hasn't moved once.\"", when: (s)=>!s.flags["chat_trixie_ferry_1"], steps: [
        { say: "rowan", text: "\"Your feet haven't stopped since I got here. That finger hasn't moved once.\"" },
        { say: "trixie", text: "\"That's the trick! That's the whole trick!\"" },
        { say: "trixie", text: "\"School said I couldn't keep still. Every teacher I ever had. And Dad said, put a bee on her. And I could! An hour, if it's a whole hive. It's only everything *else* that goes.\"" },
        { say: "trixie", text: "\"People say I'm a lot. Am I a lot? You can say. I'd rather know.\"" },
        { choice: [
          { text: "\"You're a lot. I didn't say stop.\"", steps: [
            { say: "rowan", text: "\"You're a lot. I didn't say stop.\"" },
            { text: "The bunches stop bouncing." },
            { say: "trixie", text: "\"Oh.\"" },
            { say: "trixie", text: "\"Nobody ever puts the second bit on.\"" },
            { text: "The grin comes back wider than before, gap and all." },
            AFF("trixie", 3, "Didn't say stop")
          ] },
          { text: "\"I've known you five minutes. Ask me again in a week.\"", steps: [
            { say: "rowan", text: "\"I've known you five minutes. Ask me again in a week.\"" },
            { say: "trixie", text: "\"Five minutes is usually when they decide.\"" },
            { say: "trixie", text: "\"A week's nice, though. Nobody's ever offered a week. All right. A week. Belinda's a witness.\"" },
            AFF("trixie", 2, "Offered her a week")
          ] }
        ] },
        { flag: "chat_trixie_ferry_1" },
        NOTE("trixie", "Cannot keep still, except for a bee. People have told her she is \"a lot\"."),
        { time: 3 }
      ] },
      { text: "\"A real bee on your finger and an enamel one on your collar. Is the deck bees as well?\"", when: (s)=>!s.flags["chat_trixie_ferry_2"], steps: [
        { say: "rowan", text: "\"A real bee on your finger and an enamel one on your collar. Is the deck bees as well?\"" },
        { say: "trixie", text: "\"Bees! Well. Sort of bees. Mine all blow up. Buzz, buzz, bang. Dad says it's not very respectful to bees, but they win ever so much.\"" },
        { choice: [
          { text: "\"Exploding bees. What does Belinda make of that?\"", steps: [
            { say: "rowan", text: "\"Exploding bees. What does Belinda make of that?\"" },
            { say: "trixie", text: "\"I've explained. I said they're only card ones, and nobody real gets hurt, and it's very tactical.\"" },
            { say: "trixie", text: "\"She took it very well. She's had a wash since, which is a good sign. They don't wash if they're upset.\"" }
          ] },
          { text: "\"Do you feel bad when they go off?\"", steps: [
            { say: "rowan", text: "\"Do you feel bad when they go off?\"" },
            { say: "trixie", text: "\"Every time. I say sorry to each one. Out loud if nobody minds, and in my head if they do.\"" },
            { say: "trixie", text: "\"And then I do it again, because it wins. Is that awful? I think it might be a bit awful.\"" },
            { say: "rowan", text: "\"I think it's the politest way anybody has ever planned to blow me up.\"" },
            { say: "trixie", text: "\"POLITE! Belinda, did you hear?\"" }
          ] }
        ] },
        { say: "trixie", text: "\"What are yours? Go on.\"" },
        { say: "rowan", text: "\"Weather. Mostly bad.\"" },
        { say: "trixie", text: "\"Oh, bees *hate* weather. We're going to be ever such good enemies.\"" },
        AFF("trixie", 2, "Asked about her bees"),
        { flag: "chat_trixie_ferry_2" },
        NOTE("trixie", "Plays bees that blow up — \"buzz, buzz, bang\" — and says sorry to each one."),
        { time: 3 }
      ] },
      { text: "\"Would she walk onto a stranger?\"", when: (s)=>!s.flags["chat_trixie_ferry_3"], steps: [
        { say: "rowan", text: "\"Would she walk onto a stranger?\"" },
        { say: "trixie", text: "\"Hold your finger out. Flat. Like a twig, not like a question.\"" },
        { text: "You hold it out. It shakes. It always shakes when somebody is watching, and at the moment two of them are." },
        { say: "rowan", text: "\"Sorry. It does that.\"" },
        { say: "trixie", text: "\"She doesn't mind. That's only a flower in a wind, to her. They land on those all day.\"" },
        { text: "The bee considers the gap, and steps across. She weighs nothing whatever. You can feel each of her feet." },
        { choice: [
          { text: "Hold perfectly still, and say nothing.", hint: "Quiet", steps: [
            { text: "You hold still. The engine thuds. A gull says something rude. After a while you notice that the finger has stopped shaking, and you could not say when." },
            { say: "trixie", text: "\"There.\" A whisper. \"She's stopped you.\"" }
          ] },
          { text: "Ask Belinda, quietly, where she'd like to live.", steps: [
            { say: "rowan", text: "\"Where would you like to live, Belinda?\"" },
            { text: "Trixie bends her head to the bee, listens, and reports in a whisper." },
            { say: "trixie", text: "\"She says somewhere with a south wall and no wasps. And she says you've stopped shaking. You have, look.\"" },
            { text: "You have." }
          ] }
        ] },
        { flag: "trixie_held_belinda" },
        AFF("trixie", 3, "Held Belinda gently"),
        { flag: "chat_trixie_ferry_3" },
        NOTE("trixie", "Let you hold Belinda. Your hand stopped shaking."),
        { time: 4 }
      ] },
      { text: "\"I'll let the two of you get on.\"", steps: [
        { say: "rowan", text: "\"I'll let the two of you get on.\"" },
        { say: "trixie", text: "\"Bye, Rowan! Slowly on the stairs!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_trixie_ferry_done" },
    { say: "trixie", text: "\"And another thing about bees is — oh! Hello! No, not you, Rowan. There's a moth on the lifebelt. Hello, sir. You're a long way out, aren't you?\"" },
    { say: "trixie", text: "\"Sorry. I've got to see to him. Come and find us on the island! We'll be the ones with the bee!\"" },
    { end: true }
  ]
});

scene("row_b2", {
  steps: [
    { when: (s)=>!s.flags["row_b2_seen"], jump: "first" },
    { text: "The porch of bungalow 2 is still a small war zone, and nobody minds you coming back." },
    { scene: "chat_row_b2" },
    { time: 10 },
    { end: true },
    { label: "first" },
    { flag: "row_b2_seen" },
    { when: (s)=>!!s.flags["met_hedda"], flag: "b2_knew_hedda" },
    { when: (s)=>!!s.flags["met_freya"], flag: "b2_knew_freya" },
    { when: (s)=>!!s.flags["met_trixie"], flag: "b2_knew_trixie" },
    { text: "The porch of bungalow 2 is a small war zone. Banners. A megaphone on the rail. A pot of lavender. A ceramic bowl of water for gulls." },
    { when: (s)=>!s.flags["b2_knew_freya"], text: "A tall girl with an ice-blonde braid is lying flat on her back across two chairs with a book on her face." },
    { when: (s)=>!!s.flags["b2_knew_freya"], text: "Freya is lying flat on her back across two chairs, with the same paperback over her face. She has changed furniture, and nothing else." },
    { when: (s)=>!s.flags["b2_knew_hedda"], text: "A tiny green-haired girl with flowers in her hair is painting a banner in great red letters." },
    { when: (s)=>!!s.flags["b2_knew_hedda"], text: "Hedda has swapped the petition board for a paintbrush, and is painting a banner in great red letters." },
    { when: (s)=>!s.flags["b2_knew_trixie"], text: "And a honey-blonde girl in yellow-striped socks is talking to a bee on the end of her finger." },
    { when: (s)=>!!s.flags["b2_knew_trixie"], text: "And Trixie, striped socks going like pistons, is still deep in conversation with the bee on her finger." },
    { when: (s)=>!!s.flags["b2_knew_hedda"] && !!s.flags["b2_knew_freya"] && !!s.flags["b2_knew_trixie"], think: "The petition, the book and the bee. A whole side deck, moved onto one porch." },
    { when: (s)=>!s.flags["b2_knew_hedda"], say: "hedda", alias: "Girl with a paintbrush", text: "\"You! Are you for the sausage or against the sausage?\"" },
    { when: (s)=>!!s.flags["b2_knew_hedda"] && !!s.flags["hedda_signed"], say: "hedda", text: "\"Vance! Line twenty-seven! Good, you're already on record as somebody who asks. So: are you for the sausage or against the sausage?\"" },
    { when: (s)=>!!s.flags["b2_knew_hedda"] && !s.flags["hedda_signed"], say: "hedda", text: "\"Vance! The one who wouldn't sign on a boat! Here's an easier one: are you for the sausage or against the sausage?\"" },
    { say: "rowan", text: "\"I — what sausage?\"" },
    { when: (s)=>!s.flags["supper_done"], say: "hedda", alias: "Girl with a paintbrush", text: "\"THE sausage. The one in the stew they're going to serve tonight. Do you know what is in a sausage? Do you? I've brought a leaflet.\"" },
    { when: (s)=>!!s.flags["supper_done"], say: "hedda", text: "\"THE sausage. The one in the stew you've just eaten. I said 'mostly', and mostly is not an answer. Do you know what is in a sausage? Do you? I've brought a leaflet.\"" },
    { text: "She has indeed brought a leaflet. It is four pages long." },
    { when: (s)=>!s.flags["b2_knew_freya"], say: "freya", alias: "Girl under a book", text: "\"Hedda.\" The book does not move. \"Let the boy sit down first.\"" },
    { when: (s)=>!!s.flags["b2_knew_freya"], say: "freya", text: "\"Hedda.\" The book does not move. \"That is Rowan. He was civil to my bench. Let him sit down first.\"" },
    MET("hedda", "Hedda"),
    { when: (s)=>!s.flags["b2_knew_freya"] && !s.flags["supper_done"], say: "freya", alias: "Girl under a book", text: "\"Freya Nordlicht,\" the book adds, as if that settled the order of business." },
    { when: (s)=>!s.flags["b2_knew_freya"] && !s.flags["supper_done"], ...MET("freya", "Freya Nordlicht") },
    { text: "The book lifts a quarter of an inch. A pale blue eye regards you." },
    { when: (s)=>!s.flags["b2_knew_freya"] && !s.flags["supper_done"], say: "freya", text: "\"Good. A face. I like it. We'll talk tonight — I'm wicked by ten.\"" },
    { when: (s)=>!s.flags["b2_knew_freya"] && !!s.flags["supper_done"], say: "freya", text: "\"Seven, from the end of the bench. Good. A face. I like it. Stay up — I'm wicked by ten.\"" },
    { when: (s)=>!!s.flags["b2_knew_freya"] && !s.flags["supper_done"], say: "freya", text: "\"So they have put you on the row as well. Good. It is not my hour yet, Rowan. Tonight.\"" },
    { when: (s)=>!!s.flags["b2_knew_freya"] && !!s.flags["supper_done"], say: "freya", text: "\"You survived the stew. Good. It is getting towards my hour, Rowan.\"" },
    MET("freya", "Freya Nordlicht"),
    { flag: "freya_said_wicked" },
    { when: (s)=>!s.flags["b2_knew_trixie"] && !!s.flags["supper_done"], say: "trixie", text: "\"Hello! It's Seven! Bungalow seven! This is Belinda. She's on my finger. Don't swat.\" A gap-toothed grin. \"Hold still, there's a lady on your collar. There! Off she goes.\"" },
    { when: (s)=>!s.flags["b2_knew_trixie"] && !s.flags["supper_done"], say: "trixie", alias: "Girl in striped socks", text: "\"Hello! Sorry, I'm Trixie. This is Belinda. She's on my finger. Don't swat.\" A gap-toothed grin. \"Hold still, there's a lady on your collar. There! Off she goes.\"" },
    { when: (s)=>!!s.flags["b2_knew_trixie"], say: "trixie", text: "\"Rowan! Belinda, LOOK, it's Rowan off the boat!\" A gap-toothed grin. \"Hold still, there's a lady on your collar. There! Off she goes.\"" },
    { when: (s)=>!!s.flags["trixie_held_belinda"], say: "trixie", text: "\"Belinda remembers your finger, by the way. She says it was a very good twig.\"" },
    MET("trixie", "Trixie"),
    { when: (s)=>!!s.flags["trixie_ferry_belinda"], say: "trixie", text: "\"And you'll never guess. The girl with the hair, the one Belinda rode aboard on? It's HER. She's my roommate! I told her she'd been a ferry, and she cried a bit.\"" },
    { when: (s)=>!!s.flags["trixie_ferry_belinda"], say: "hedda", text: "\"I did NOT. It was the paint.\"" },
    { when: (s)=>!!s.flags["trixie_ferry_belinda"], say: "freya", text: "\"It was not the paint.\"" },
    { text: "Hedda holds the leaflet out at arm's length, which brings it roughly level with your belt." },
    { choice: [
      { text: "Take the leaflet and read it.", hint: "Fair hearing", steps: [
        { text: "You read all four pages. You disagree with one point, honestly, and agree with another." },
        { say: "hedda", text: "\"You read it.\" Almost suspicious. \"All of it?\"" },
        { say: "rowan", text: "\"Page two I'm not sure about. The figure for the ratio.\"" },
        { say: "hedda", text: "\"That's — okay, that's a fair point. I'll check the source.\"" },
        { text: "A beat, as if she did not expect to say it." },
        { say: "hedda", text: "\"…Thanks.\"" },
        AFF("hedda", 4, "Read the leaflet"),
        { flag: "hedda_leaflet_read" }
      ] },
      { text: "\"Maybe after dinner. I'd like to read it properly, and I don't want to rush it.\"", when: (s)=>!s.flags["supper_done"], steps: [
        { say: "rowan", text: "\"Maybe after dinner. I'd like to read it properly, and I don't want to rush it.\"" },
        { say: "hedda", text: "\"After dinner. Fine. I'll hold my fire.\"" }
      ] },
      { text: "\"Tomorrow, in daylight. I'd like to read it properly, and I don't want to rush it.\"", when: (s)=>!!s.flags["supper_done"], steps: [
        { say: "rowan", text: "\"Tomorrow, in daylight. I'd like to read it properly, and I don't want to rush it.\"" },
        { say: "hedda", text: "\"Tomorrow. Fine. I'll hold my fire till breakfast.\"" }
      ] },
      { text: "\"Is the sausage a witness, or a defendant?\"", hint: "Risky", steps: [
        { say: "rowan", text: "\"Is the sausage a witness, or a defendant?\"" },
        { text: "The megaphone comes up. You are very glad it is not switched on." },
        { say: "hedda", text: "\"Jokes about veganism! The OLDEST evasion in the book!\"" },
        { say: "freya", text: "\"Hedda. He is new. Give him a day.\"" },
        AFF("hedda", -2, "Joked about veganism")
      ] }
    ] },
    { scene: "chat_row_b2" },
    { add: { ferry_talked: 1 } },
    { time: 15 }
  ]
});

scene("chat_row_b2", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_hedda_done"] && !!s.flags["chat_freya_done"] && !!s.flags["chat_trixie_done"], jump: "done" },
    { choice: [
      { text: "Stay with Hedda and her banner.", when: (s)=>!s.flags["chat_hedda_done"], steps: [
        { choice: [
          { text: "\"What's the banner for, Hedda?\"", when: (s)=>!s.flags["chat_hedda_1"], steps: [
            { say: "rowan", text: "\"What's the banner for, Hedda?\"" },
            { when: (s)=>!s.flags["supper_done"], say: "hedda", text: "\"Tonight's stew! It's a protest and a service announcement! 'Ask what's in the pot!'\" She jabs the brush at the red letters." },
            { when: (s)=>!!s.flags["supper_done"], say: "hedda", text: "\"Tomorrow's breakfast! Tonight's stew got past me. It's a protest and a service announcement! 'Ask what's in the pot!'\" She jabs the brush at the red letters." },
            { say: "hedda", text: "\"People think a petition is a shout. A petition is a *list*. A list is what wins.\"" },
            { say: "rowan", text: "\"How many names have you got?\"" },
            { say: "hedda", text: "\"Eighty-one, since the harbour. I'd have ninety, but half of Rare Hall wouldn't sign without a lawyer.\" Fierce and quick, entirely delighted. \"I counted them twice. I always count twice.\"" },
            { when: (s)=>!!s.flags["hedda_signed"], say: "hedda", text: "\"You're on page one. Page one is the brave page; page three only signed because page one had.\"" },
            { when: (s)=>!s.flags["hedda_signed"], choice: [
              { text: "\"Make it eighty-two. Where's the pen?\"", steps: [
                { say: "rowan", text: "\"Make it eighty-two. Where's the pen?\"" },
                { text: "The board is in your hands before you have finished the sentence. You write ROWAN VANCE. She watches every letter go down." },
                { say: "hedda", text: "\"Eighty-two.\" With deep satisfaction. \"And I didn't even have to use the megaphone.\"" },
                { flag: "hedda_signed" },
                AFF("hedda", 2, "Signed on the porch")
              ] },
              { text: "\"Eighty-one's a real number. They'll have to read that.\"", steps: [
                { say: "rowan", text: "\"Eighty-one's a real number. They'll have to read that.\"" },
                { say: "hedda", text: "\"They'll have to *answer* it. Reading is what they do instead.\"" }
              ] }
            ] },
            AFF("hedda", 2, "Asked about her cause"),
            { flag: "chat_hedda_1" }
          ] },
          { text: "\"Why the megaphone? You don't seem short of volume.\"", when: (s)=>!s.flags["chat_hedda_2"], steps: [
            { say: "rowan", text: "\"Why the megaphone? You don't seem short of volume.\"" },
            { say: "hedda", text: "\"I'm *tiny*.\" Without a shred of embarrassment. \"In a crowd, nobody sees me. With a megaphone, nobody can miss me. It's not about being loud, it's about being the right size.\"" },
            { say: "hedda", text: "\"And it makes the pigeons flinch. That's a bonus.\"" },
            { choice: [
              { text: "\"What size is the right size?\"", steps: [
                { say: "rowan", text: "\"What size is the right size?\"" },
                { say: "hedda", text: "\"Big enough that they can't talk over the top of my head.\" She measures it against you with the brush, and leaves a red dot in the air a foot above her flowers. \"About there. I've done the sums.\"" }
              ] },
              { text: "\"I heard you fine without it.\"", steps: [
                { say: "rowan", text: "\"I heard you fine without it.\"" },
                { say: "hedda", text: "\"You were *listening*.\" As if this were a slightly suspect habit. \"The megaphone's for everybody else.\"" }
              ] }
            ] },
            AFF("hedda", 1, "Took the megaphone seriously"),
            { flag: "chat_hedda_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_hedda_1"] && !!s.flags["chat_hedda_2"], flag: "chat_hedda_done" }
      ] },
      { text: "Sit by Freya's chairs.", when: (s)=>!s.flags["chat_freya_done"], steps: [
        { choice: [
          { text: "\"Do you always lie on two chairs with a book on your face?\"", when: (s)=>!s.flags["chat_freya_1"] && !s.flags["b2_knew_freya"], steps: [
            { say: "rowan", text: "\"Do you always lie on two chairs with a book on your face?\"" },
            { say: "freya", text: "\"Only before ten.\" The book lifts. \"It is how I save my face for the evening. The rest of the day it is a rumour.\"" },
            { say: "rowan", text: "\"What are you reading?\"" },
            { say: "freya", text: "\"Nothing. I have been looking at the same sentence since lunch. It is a very good sentence.\"" },
            AFF("freya", 2, "Played along"),
            { flag: "chat_freya_1" }
          ] },
          { text: "\"A bench this morning, two chairs now. Has the book moved at all?\"", when: (s)=>!s.flags["chat_freya_1"] && !!s.flags["b2_knew_freya"], steps: [
            { say: "rowan", text: "\"A bench this morning, two chairs now. Has the book moved at all?\"" },
            { say: "freya", text: "\"One page.\" The book lifts. \"It is how I save my face for the evening. Until ten it is a rumour.\"" },
            { when: (s)=>!!s.flags["freya_book_told"], say: "rowan", text: "\"And the murder?\"" },
            { when: (s)=>!!s.flags["freya_book_told"], say: "freya", text: "\"Still the one I said. I have been looking at the same sentence since lunch. It is a very good sentence; he lies in it.\"" },
            { when: (s)=>!s.flags["freya_book_told"], say: "rowan", text: "\"What is it, anyway?\"" },
            { when: (s)=>!s.flags["freya_book_told"], say: "freya", text: "\"A murder, in the language I grew up with. I have been looking at the same sentence since lunch. It is a very good sentence; somebody lies in it.\"" },
            AFF("freya", 2, "Played along"),
            { flag: "chat_freya_1" }
          ] },
          { text: "\"You said 'wicked by ten'. What does that mean, exactly?\"", when: (s)=>!s.flags["chat_freya_2"], steps: [
            { say: "rowan", text: "\"You said 'wicked by ten'. What does that mean, exactly?\"" },
            { say: "freya", text: "\"It means that by ten I will tell you what I think of you, and then I will tell you what I should like to do about it.\" A cool, level pause. \"Both parts are, as a rule, flattering.\"" },
            { choice: [
              { text: "\"And before ten?\"", steps: [
                { say: "rowan", text: "\"And before ten?\"" },
                { say: "freya", text: "\"Before ten I think it, and keep the book on.\"" }
              ] },
              { text: "\"I'll need a run-up for that.\"", steps: [
                { say: "rowan", text: "\"I'll need a run-up for that.\"" },
                { say: "freya", text: "\"You have until ten. It is a long run-up. I am not unreasonable.\"" }
              ] }
            ] },
            { say: "freya", text: "\"You will want a glass of water by then. Everybody does, eventually.\"" },
            AFF("freya", 1, "Asked straight"),
            { flag: "chat_freya_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_freya_1"] && !!s.flags["chat_freya_2"], flag: "chat_freya_done" }
      ] },
      { text: "Hold still for Trixie and Belinda.", when: (s)=>!s.flags["chat_trixie_done"], steps: [
        { choice: [
          { text: "\"What sort of bee is Belinda?\"", when: (s)=>!s.flags["chat_trixie_1"] && !s.flags["trixie_ferry_belinda"], steps: [
            { say: "rowan", text: "\"What sort of bee is Belinda?\"" },
            { say: "trixie", text: "\"Honeybee! Very decent. Very busy. She's been on my finger since breakfast, and I have *not* been asked for a single piece of paperwork.\" A bright, gap-toothed grin. \"She's a good listener. Ask her anything. She'll wait till the end.\"" },
            { say: "rowan", text: "\"Hello, Belinda.\"" },
            { say: "trixie", text: "\"She says hello back!\" Wholly serious. \"She also says you've got a flower on your collar, which is nice, because that was me. I put it there when you weren't looking.\"" },
            AFF("trixie", 2, "Greeted the bee"),
            { flag: "chat_trixie_1" }
          ] },
          { text: "\"How is Belinda taking to dry land?\"", when: (s)=>!s.flags["chat_trixie_1"] && !!s.flags["trixie_ferry_belinda"], steps: [
            { say: "rowan", text: "\"How is Belinda taking to dry land?\"" },
            { say: "trixie", text: "\"Ever so well! She's been on my finger since breakfast, and she walked right down the gangway on it, and I have *not* been asked for a single piece of paperwork.\" A bright, gap-toothed grin. \"She's had a go at the lavender already. She says it'll do.\"" },
            { say: "rowan", text: "\"Hello, Belinda.\"" },
            { say: "trixie", text: "\"She says hello back!\" Wholly serious. \"She also says you've got a flower on your collar, which is nice, because that was me. I put it there when you weren't looking.\"" },
            AFF("trixie", 2, "Asked after the bee"),
            { flag: "chat_trixie_1" }
          ] },
          { text: "\"Do you keep bees at home?\"", when: (s)=>!s.flags["chat_trixie_2"], steps: [
            { say: "rowan", text: "\"Do you keep bees at home?\"" },
            { say: "trixie", text: "\"My dad does! Edge of the moor! Forty hives on a hillside, and a bee hotel under the eaves, which is for the ones with no home.\" She rattles it off without drawing breath." },
            { say: "trixie", text: "\"I say good morning to the bees and they say it back. Mostly. In their own way.\"" },
            { say: "trixie", text: "\"It's too quiet here without a hive. I'm going to put a hotel under the bungalow roof. If you've got a spare plank, I'll love you forever.\"" },
            { choice: [
              { text: "\"I'll keep an eye out for a plank.\"", steps: [
                { say: "rowan", text: "\"I'll keep an eye out for a plank.\"" },
                { say: "trixie", text: "\"Not a painted one! They don't like paint. Belinda, he's getting us a plank!\"" }
              ] },
              { text: "\"A hotel for the ones with no home. Does it fill up?\"", steps: [
                { say: "rowan", text: "\"A hotel for the ones with no home. Does it fill up?\"" },
                { say: "trixie", text: "\"Every spring. Every single hole.\" For a moment she is almost still. \"There's always more of them on their own than you'd think.\"" }
              ] }
            ] },
            AFF("trixie", 2, "Asked about home"),
            { flag: "chat_trixie_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_trixie_1"] && !!s.flags["chat_trixie_2"], flag: "chat_trixie_done" }
      ] },
      { text: "\"I should get on. Thanks, all of you.\"", steps: [
        { say: "rowan", text: "\"I should get on. Thanks, all of you.\"" },
        { say: "hedda", text: "\"Come back! With a signature!\"", when: (s)=>!s.flags["hedda_signed"] },
        { say: "hedda", text: "\"Come back! With a paintbrush!\"", when: (s)=>!!s.flags["hedda_signed"] },
        { say: "trixie", text: "\"Bye! Belinda says bye!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_row_b2_done" },
    { say: "freya", text: "\"That is the whole porch. You have done the rounds.\" The book comes down for a moment, and the pale blue eye is almost warm." },
    { say: "freya", text: "\"Come by tonight. We start at ten. The sausage will still be wrong.\"" },
    { end: true }
  ]
});

scene("isle_rana", {
  steps: [
    { when: (s)=>!!s.flags["isle_rana_done"], jump: "later" },
    { text: "At the far west end of the cove the sand gives out in a tumble of black rock. On the last flat one, as far from the bungalows as it is possible to sit without getting wet, a girl has her back to the whole row: two blonde braids with red bows, boots beside her, arms round her knees." },
    { when: (s)=>!s.flags["met_rana"] && !s.flags["placement_done"], say: "rana", alias: "Scowling girl", text: "\"No.\"" },
    { when: (s)=>!s.flags["met_rana"] && !s.flags["placement_done"], say: "rowan", text: "\"I haven't said anything.\"" },
    { when: (s)=>!s.flags["met_rana"] && !s.flags["placement_done"], say: "rana", alias: "Scowling girl", text: "\"You're Vance. They read you out last. I'm Rana. That's all you get.\"" },
    MET("rana", "Rana"),
    { when: (s)=>!!s.flags["placement_done"], jump: "after" },
    { when: (s)=>!!s.flags["rana_list_word"], say: "rana", text: "\"They said it. On the Quad, out loud, with a microphone.\"" },
    { when: (s)=>!!s.flags["rana_list_word"], say: "rana", text: "\"…I didn't.\"" },
    { when: (s)=>!s.flags["rana_list_word"], say: "rana", text: "\"It's a whole cove. There's other rocks.\"" },
    { when: (s)=>!!s.flags["rana_list_word"], say: "rowan", text: "\"I noticed. …The row's back that way. Everybody else is unpacking.\"" },
    { when: (s)=>!s.flags["rana_list_word"], say: "rowan", text: "\"The row's back that way. Everybody else is unpacking.\"" },
    { say: "rana", text: "\"Bungalow three's got two others in it. One of them talks. Through a wall, through a door, through anything. The other one hasn't unpacked. She's written a timetable instead.\"" },
    { say: "rana", text: "\"I've hung a sheet.\"" },
    { choice: [
      { text: "\"Does the sheet work?\"", steps: [
        { say: "rowan", text: "\"Does the sheet work?\"" },
        { say: "rana", text: "\"It's a sheet. It stops looking. It doesn't stop the small one. She talked at it for ten minutes, about rabbits.\"" },
        { text: "A pause. A wave comes in, thinks about the rock, and goes out again." },
        { say: "rana", text: "\"…I didn't answer.\"" },
        { think: "She counted the minutes, though." },
        AFF("rana", 1, "Asked about the sheet")
      ] },
      { text: "\"You found the one place on the row where nobody can come up behind you.\"", steps: [
        { say: "rowan", text: "\"You found the one place on the row where nobody can come up behind you.\"" },
        { say: "rana", text: "\"Tide covers the low ones by six. This one stays dry.\"" },
        { say: "rowan", text: "\"You've been on this island a couple of hours.\"" },
        { say: "rana", text: "\"There's a line on the rock where the weed stops. Use your eyes.\"" },
        { text: "There is a line, now that you look: dark weed below it, dry black rock above. It is also, you notice, the furthest rock from the row there is. You suspect that was the real requirement." }
      ] },
      { text: "Sit down on the next rock along, and say nothing.", hint: "Quiet", steps: [
        { text: "You pick the next flat rock and sit. It is warm from the sun and smells of weed. The row is a long way behind you both, and very small." },
        { say: "rana", text: "\"…That one's fine. Not this one.\"" },
        AFF("rana", 2, "Took the next rock")
      ] }
    ] },
    { say: "rana", text: "\"Domes are at half one. Don't be early. If you're early you have to sit and watch the one before, and then you play that game instead of yours.\"" },
    { jump: "end" },
    { label: "after" },
    { say: "rana", text: "\"Don't.\"" },
    { say: "rowan", text: "\"I wasn't going to.\"" },
    { say: "rana", text: "\"'Repeating year.' She read it out like a seat number.\"" },
    { text: "A wave comes in, thinks about the rock, and goes out again. She watches it do that." },
    { when: (s)=>!!s.flags["placement_won"], say: "rana", text: "\"You held the Locust three turns. Who told you to hold it?\"" },
    { when: (s)=>!s.flags["placement_won"], say: "rana", text: "\"And don't tell me it was close. I was there.\"" },
    { choice: [
      { text: "\"Nobody. It was waiting for one thing. I didn't give it the thing.\"", when: (s)=>!!s.flags["placement_won"], steps: [
        { say: "rowan", text: "\"Nobody. It was waiting for one thing. I didn't give it the thing.\"" },
        { say: "rana", text: "\"Right. That's — yes. That's the read.\" Fast, forward, nearly pleased. \"Nobody does that. They get bored and feed it.\"" },
        { text: "She hears herself, and looks at the sea as if it had interrupted." },
        AFF("rana", 2, "Talked about the line")
      ] },
      { text: "\"It wasn't close. Your list did what it was built to do.\"", when: (s)=>!s.flags["placement_won"], steps: [
        { say: "rowan", text: "\"It wasn't close. Your list did what it was built to do.\"" },
        { say: "rana", text: "\"…Yeah. It did.\" She says it to the water, carefully, as if it might be taken back off her. \"Your hands were going the whole time. You still didn't misplay till the end.\"" },
        AFF("rana", 2, "Praised the list, not her")
      ] },
      { text: "\"I'm not going to say anything about any of it.\"", steps: [
        { say: "rowan", text: "\"I'm not going to say anything about any of it.\"" },
        { say: "rana", text: "\"Good.\"" },
        { text: "It is a full minute before she adds, without turning round:" },
        { say: "rana", text: "\"Next rock's free.\"" },
        AFF("rana", 1, "Said nothing about it")
      ] }
    ] },
    { say: "rana", text: "\"Bungalow three's got one who talks through walls and one who's written a timetable instead of unpacking. I've hung a sheet. So I'm here till supper.\"" },
    { label: "end" },
    { flag: "isle_rana_done" },
    NOTE("rana", "Has hung a sheet round her bed in bungalow 3, and sits on the last rock of the cove."),
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "She is still on the last rock. The tide has come up one rock nearer; she has not moved for it." },
    { say: "rana", text: "\"Still dry.\"" },
    { text: "It is not clear whether she means the rock. You leave her the sea." },
    { time: 2 }
  ]
});

scene("isle_teobalt", {
  steps: [
    { when: (s)=>!!s.flags["isle_teobalt_done"], jump: "later" },
    { text: "A boy in a long red coat is crossing the Quad in a dead straight line, counting under his breath, with a clipboard held level in front of him like a tray. Where the paths meet he stops, writes a number, and clicks the pen back behind his ear." },
    { when: (s)=>!s.flags["met_teobalt"], say: "teobalt", alias: "Boy with a clipboard", text: "\"Mr Vance. You were read out last at the roll call; I ticked you myself. Teobalt Fullington, Rare Hall.\"" },
    { when: (s)=>!!s.flags["met_teobalt"] && !!s.flags["has_unloading_list"], say: "teobalt", text: "\"Rowan. The unloading held: duffels, trunks, tuba. I have marked the pier as solved. It is the first thing on this island that I have.\"" },
    { when: (s)=>!!s.flags["met_teobalt"] && !s.flags["has_unloading_list"], say: "teobalt", text: "\"Rowan. Good. You may walk with me, if you keep to the left; I am pacing.\"" },
    MET("teobalt", "Teobalt Fullington"),
    { say: "teobalt", text: "\"Rare Hall to this spot is two hundred and twelve paces. I am drawing up the year, and a year begins with how long it takes to get to it.\"" },
    { say: "teobalt", text: "\"I should tell somebody this. I wrote a document for my room. One page: who has the desk by the window, when the lamp goes off, where shoes live.\"" },
    { say: "teobalt", text: "\"My roommate, Park Jun-ho, returned it within the hour. With eleven numbered comments.\"" },
    { flag: "rel_junho_teobalt" },
    { choice: [
      { text: "\"Eleven. Is that a declaration of war?\"", steps: [
        { say: "rowan", text: "\"Eleven. Is that a declaration of war?\"" },
        { say: "teobalt", text: "\"I thought so, for the length of comment one. Then I read the rest. Comment four is correct. Comment seven is *better than my original*.\"" },
        { say: "teobalt", text: "\"I have never been corrected in my own format before. I do not yet know what the feeling is called. I have left a line for it.\"" },
        AFF("teobalt", 1, "Asked about the comments")
      ] },
      { text: "\"How many of the eleven were right?\"", steps: [
        { say: "rowan", text: "\"How many of the eleven were right?\"" },
        { say: "teobalt", text: "\"Nine.\" It costs him nothing to say; he seems rather proud of the figure. \"Two are matters of taste. I said so, in a reply, which he has since annotated.\"" },
        { say: "teobalt", text: "\"We are on version three. It is not yet supper.\"" },
        AFF("teobalt", 2, "Asked for the number")
      ] },
      { text: "\"It sounds as if they've given you a roommate exactly like you.\"", steps: [
        { say: "rowan", text: "\"It sounds as if they've given you a roommate exactly like you.\"" },
        { say: "teobalt", text: "\"That is the hypothesis. If it is true, I shall either be very happy this year, or only one of us will survive it.\"" },
        { say: "teobalt", text: "\"I am inclined to the first.\" A very small, very pleased pause. \"He numbered them.\"" },
        AFF("teobalt", 2, "Saw the resemblance")
      ] }
    ] },
    { when: (s)=>!!s.flags["placement_won"], say: "teobalt", text: "\"Your placement duel, I am told, went well. Dome 2. I have moved you up in my estimate. No, you may not see the estimate.\"" },
    { when: (s)=>!!s.flags["placement_done"] && !s.flags["placement_won"], say: "teobalt", text: "\"Your placement duel, I am told, did not go your way. It is one point. I have asked several people today not to draw a line through one point.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "teobalt", text: "\"The Commons are called to the domes at half past one. From this spot it is four minutes at a reasonable pace. I have walked it, so that you need not guess.\"" },
    { say: "teobalt", text: "\"One question, for the year. Which bungalow are you?\"" },
    { say: "rowan", text: "\"Seven.\"" },
    { say: "teobalt", text: "\"Does the roof leak?\"" },
    { choice: [
      { text: "\"I've hardly been inside it. Ask me after it rains.\"", steps: [
        { say: "rowan", text: "\"I've hardly been inside it. Ask me after it rains.\"" },
        { say: "teobalt", text: "\"I shall. Nobody has listed the bungalows. I looked. There is a list for the Tower's chandeliers and none for your roofs.\"" }
      ] },
      { text: "\"Why would Rare Hall want to know about a Commons roof?\"", steps: [
        { say: "rowan", text: "\"Why would Rare Hall want to know about a Commons roof?\"" },
        { say: "teobalt", text: "\"Rare Hall does not. I do. Nobody has listed the bungalows; I looked. A thing nobody has listed is a thing nobody will mend.\"" },
        AFF("teobalt", 1, "Asked why he cares")
      ] }
    ] },
    { when: (s)=>!!s.flags["teobalt_thursday"], say: "teobalt", text: "\"Thursday stands, by the way. It has its own line now.\"" },
    { flag: "isle_teobalt_done" },
    NOTE("teobalt", "Shares a room in Rare Hall with Park Jun-ho, who sent his room rules back with eleven numbered comments."),
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "He is on another diagonal of the Quad now, counting. He holds up one finger without breaking step, reaches the far corner, and writes." },
    { say: "teobalt", text: "\"A hundred and ninety. Thank you for waiting. Version four of the room document has gone back; I shall report.\"" },
    { time: 2 }
  ]
});
