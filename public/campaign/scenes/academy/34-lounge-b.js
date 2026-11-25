// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
const { AFF, MET, DECK, NOTE, REL } = helpers;
/* ───────────────────────── MAGNUS ───────────────────────── */
scene("ferry_magnus", {
  steps: [
    { when: (s)=>!!s.flags["met_magnus"], jump: "again" },
    { text: "Two benches back from the card table, a wiry boy with slicked ginger hair has a tablet balanced on his knee and a stylus in his teeth. His sneakers are white, expensive, and still creased from the box." },
    { text: "He is keeping score of the table. At the end of every round his thumb comes down and his lips move on the numbers. Nobody asked him to. Nobody at the table knows he is there." },
    { text: "He has looked at you twice since you came down the stairs. Once, and then again, the way you check a figure." },
    { think: "I don't know him. I'm sure I don't know him." },
    { choice: [
      { text: "You've looked at me twice now. Do we know each other? I'm Rowan.", steps: [
        { say: "rowan", text: "You've looked at me twice now. Do we know each other? I'm Rowan." },
        { say: "magnus", alias: "Boy with a tablet", text: "\"Six.\" He does not look up. \"You're five. Were five. The ladder froze on the day of the Qualifier.\"" },
        { say: "rowan", text: "…I'm sorry — what?" },
        { text: "He turns the tablet round. Half the screen is this morning's games in a hand-ruled grid. The other half is the online ladder, top ten. The fifth row has been marked in red. Fifth: Best_Tarleinn_NA. Sixth: Prospero_GG." },
        { think: "That's my handle. That's me, in red." }
      ] },
      { text: "Look at what is on the tablet.", steps: [
        { text: "You tilt your head. Half the screen is this morning's games in a hand-ruled grid. The other half is the online ladder, top ten, and the fifth row has been marked in red." },
        { think: "Best_Tarleinn_NA. That's — that's me." },
        { say: "rowan", text: "That's my handle. The red one." },
        { text: "His head comes up so fast that the stylus drops out of his mouth. He catches it without looking, which he has clearly done before." },
        { say: "magnus", alias: "Boy with a tablet", text: "*Finally.*" },
        { say: "magnus", alias: "Boy with a tablet", text: "\"Fifth.\" The stylus taps the red row, then the one beneath it. \"Sixth. That one is me.\"" },
        AFF("magnus", 1, "Knew his own row"),
        { flag: "handle_said" }
      ] },
      { text: "Who's winning over there? You seem to be the only one keeping score.", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "Who's winning over there? You seem to be the only one keeping score." },
        { say: "magnus", alias: "Boy with a tablet", text: "\"The gloves. Three games, three wins, eleven point three turns a game.\" The thumb stops. \"You'd know that if you kept a log. You don't keep a log. You never have.\"" },
        { say: "rowan", text: "Have we met?" },
        { say: "magnus", alias: "Boy with a tablet", text: "\"Forty-one times.\" He turns the tablet round. Beside the morning's games is the online ladder, top ten, the fifth row marked in red. Fifth: Best_Tarleinn_NA. Sixth: Prospero_GG." },
        { think: "That's my handle. That's me, in red." }
      ] },
      { text: "Leave him to his tablet.", steps: [
        { text: "His eyes follow you across the saloon, the way a cat tracks a fly." },
        { end: true }
      ] }
    ] },
    { say: "magnus", alias: "Boy with a tablet", text: "Magnus Prospero. Prospero_GG." },
    { text: "He says it as a man says the name of an enemy he has had a very long time to prepare for. The enemy, it appears, is you." },
    MET("magnus", "Magnus Prospero"),
    { say: "magnus", text: "Two years, Vance. Two years at number six, looking at your avatar in fifth. The Qualifier published your handle with your name, so I have had the face for three weeks. I have forty-one losses to you on file." },
    { say: "magnus", text: "You don't even remember the series, do you?" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "A TABLET! At a CARD GAME! Rowan, he's got you in RED!" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "It's a ladder." },
    { add: { ferry_talked: 1 } },
    NOTE("magnus", "Prospero_GG: ranked one place below you on the online ladder for two years. Has forty-one losses to you on file."),
    { choice: [
      { text: "The Nightfall Open, game three. You were on the top list, and your read on turn four came late.", steps: [
        { say: "rowan", text: "The Nightfall Open, game three. You were on the top list, and your read on turn four came late." },
        { text: "A very long pause. Somewhere behind you the urn hisses." },
        { say: "magnus", text: "…You held your sweeper for six turns and let me overextend." },
        { say: "magnus", text: "\"Late.\" He says it as if tasting it. \"Yes. I'd — yes. I wrote that down. I did not expect to hear it read back.\"" },
        AFF("magnus", 3, "Remembered the game"),
        { flag: "magnus_recalled" }
      ] },
      { text: "I don't. I'm sorry. I play with the names switched off. I only ever saw decks.", steps: [
        { say: "rowan", text: "I don't. I'm sorry. I play with the names switched off. I only ever saw decks." },
        { say: "magnus", text: "\"Names off.\" Very tight. He has gone quite still." },
        { say: "magnus", text: "So I was a list. Six hundred hours of preparation, and I was a list with a win rate." },
        { say: "rowan", text: "A good list. I'd remember a bad one even less." },
        { say: "magnus", text: "\"That is not the comfort you think it is.\" A breath through the nose. \"It is some comfort. I shall note the amount.\"" },
        AFF("magnus", -1, "Was only a decklist")
      ] },
      { text: "Forty-one. You counted.", steps: [
        { say: "rowan", text: "Forty-one. You counted." },
        { say: "magnus", text: "I did not *count*. Counting is what one does with sheep. I filed." },
        { say: "rowan", text: "What's the difference?" },
        { say: "magnus", text: "\"A file has dates.\" He turns the tablet a quarter-inch towards himself, in case you were thinking of looking. \"And you still have not said whether you remember one of them.\"" },
        { say: "rowan", text: "Not one by name. I'd know your turns if I saw them." },
        { say: "magnus", text: "…That is either an insult or the opposite. I'll decide tonight." }
      ] }
    ] },
    { say: "magnus", text: "One question. I have had it ready for some time." },
    { say: "magnus", text: "Game thirty-eight. Turn seven. You had the win on the board, and you passed. You took it two turns later instead. *Why did you pass?*" },
    { choice: [
      { text: "If I passed, I thought you were holding the answer. Were you?", steps: [
        { say: "rowan", text: "If I passed, I thought you were holding the answer. Were you?" },
        { say: "magnus", text: "\"I was.\" It comes out before he can stop it. \"You could not have known that.\"" },
        { say: "rowan", text: "People who are holding one stop looking at their hand. I'd guess you hadn't looked at yours in a while." },
        { text: "He looks down at the tablet. Then, very slowly, as if it might be watching, at his own left hand." },
        { say: "magnus", text: "Two years. And it was my *hand*." },
        AFF("magnus", 2, "Answered the real question")
      ] },
      { text: "Honestly? I've no idea. Most of it isn't thinking.", steps: [
        { say: "rowan", text: "Honestly? I've no idea. Most of it isn't thinking." },
        { say: "magnus", text: "That is the worst answer available." },
        { say: "rowan", text: "It's the true one." },
        { say: "magnus", text: "\"I know it is. That is what makes it the worst.\" The careful politeness comes down over his face like a shutter. \"Thank you. I shall file it under 'weather'.\"" }
      ] },
      { text: "Ask me again after a game on a real table. I've never played on one. You may get a different player.", steps: [
        { say: "rowan", text: "Ask me again after a game on a real table. I've never played on one. You may get a different player." },
        { say: "magnus", text: "\"Never.\" The stylus stops. \"Not once? Cardboard? A person opposite?\"" },
        { say: "rowan", text: "Not once." },
        { text: "He does something on the tablet. A new column appears. He looks at it with more warmth than he has so far shown any living thing." },
        { say: "magnus", text: "I have played six. Six to nil. At last, a table I lead." },
        AFF("magnus", 2, "Gave him a lead"),
        { flag: "magnus_knows_no_table" }
      ] }
    ] },
    { say: "magnus", text: "One game. Now, on this bench. It will not count. I will remember it anyway." },
    { time: 8 },
    { jump: "menu" },
    { label: "again" },
    { when: (s)=>!s.flags["flag_magnus_played"], text: "The tablet is back on his knee. A new grid has appeared on it, with your name at the top and nothing under it yet." },
    { when: (s)=>!s.flags["flag_magnus_played"], say: "magnus", text: "One game, Vance. It still does not count." },
    { when: (s)=>!!s.flags["flag_magnus_played"] && s.duels["ferry_magnus"] === "won", say: "magnus", text: "\"I am watching the replay. In my head. It is not pleasant.\" A thin smile. \"Congratulations.\"" },
    { when: (s)=>!!s.flags["flag_magnus_played"] && s.duels["ferry_magnus"] !== "won", say: "magnus", text: "\"Forty-one and one.\" He has the grid open. \"I have looked at it several times. It is still there.\"" },
    { time: 3 },
    { label: "menu" },
    { choice: [
      { text: "All right. Let's play.", when: (s)=>!s.flags["flag_magnus_played"], steps: [
        { say: "rowan", text: "All right. Let's play." },
        { text: "He has cleared the bench between you before you have finished the sentence. The tablet goes face up beside his deck, recording." },
        { duel: "ferry_magnus", opponent: "magnus", opponentName: "Magnus Prospero", mustWin: false,
          onWin: [
            { say: "magnus", text: "Congratulations. No, really. Enjoy it. I'll have the replay broken down by breakfast." },
            { say: "magnus", text: "It did not count." },
            AFF("magnus", -1, "Lost to you"),
            { flag: "beat_magnus" }
          ],
          onLose: [
            { say: "magnus", text: "\"A clean loss on your side. I'll put it in the file. 'Casual, ferry, unofficial.'\" Thin, relieved smile. \"Forty-one and one.\"" },
            AFF("magnus", 1, "Beat you fairly")
          ] },
        { scene: "post_magnus" },
        { flag: "flag_magnus_played" },
        { time: 25 }
      ] },
      { text: "Before that, can I ask you something? You've had two years of me. I've had five minutes of you.", when: (s)=>!s.flags["chat_magnus_done"] && !s.flags["flag_magnus_played"], steps: [
        { say: "rowan", text: "Before that, can I ask you something? You've had two years of me. I've had five minutes of you." },
        { say: "magnus", text: "\"That is fair.\" He sounds as though fairness has caught him off guard. \"Ask.\"" },
        { scene: "chat_magnus" }
      ] },
      { text: "While you're watching replays: can I ask you something?", when: (s)=>!s.flags["chat_magnus_done"] && !!s.flags["flag_magnus_played"], steps: [
        { say: "rowan", text: "While you're watching replays: can I ask you something?" },
        { say: "magnus", text: "Ask. I can do two things at once. I have had practice." },
        { scene: "chat_magnus" }
      ] },
      { text: "Not right now. I'm still finding my feet.", when: (s)=>!s.flags["flag_magnus_played"], steps: [
        { say: "rowan", text: "Not right now. I'm still finding my feet." },
        { say: "magnus", text: "I can wait. I have been waiting two years." }
      ] },
      { text: "Leave him to it.", steps: [
        { text: "You go. The thumb comes down on the tablet behind you, once, like a full stop." }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_magnus", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_magnus_1"] && !!s.flags["chat_magnus_2"] && !!s.flags["chat_magnus_3"] && !!s.flags["chat_magnus_x"] && !s.flags["chat_magnus_done"], jump: "done" },
    { choice: [
      { text: "Forty-one games on file. What do you actually put in a file like that?", when: (s)=>!s.flags["chat_magnus_1"], steps: [
        { say: "rowan", text: "Forty-one games on file. What do you actually put in a file like that?" },
        { say: "magnus", text: "\"Everything.\" He has the folder open before you reach the question mark. \"Lists. Turn order. Seconds used per turn. Yours average four point two under mine, which is insulting.\"" },
        { text: "He turns the tablet. Game nineteen. Every turn has a row. The last column is headed WHY, and every cell in it holds a single question mark." },
        { say: "magnus", text: "I can chart what you did. I have never been able to chart why. Forty-one games, and that column is empty." },
        { choice: [
          { text: "Give it here. Turn six: I kept the sweeper because you'd emptied your hand on that turn twice before.", steps: [
            { say: "rowan", text: "Give it here. Turn six: I kept the sweeper because you'd emptied your hand on that turn twice before." },
            { text: "He types it in. He types it slowly, the way people write a thing they have wanted to know for a long time and are now slightly sorry to have." },
            { say: "magnus", text: "One cell." },
            { say: "rowan", text: "There are a lot of cells." },
            { say: "magnus", text: "\"There are four hundred and twelve.\" A pause. \"It is a long term. I'll bring the folder. At reasonable hours.\"" },
            AFF("magnus", 3, "Filled in a why")
          ] },
          { text: "That's a lot of nights spent on somebody who didn't know your name.", steps: [
            { say: "rowan", text: "That's a lot of nights spent on somebody who didn't know your name." },
            { say: "magnus", text: "It was not about *you*. It was about fifth." },
            { text: "He closes the folder. He opens it again." },
            { say: "magnus", text: "It was somewhat about you." },
            AFF("magnus", 1, "Saw the hours")
          ] },
          { text: "Maybe there isn't a why. Sometimes I just got lucky.", steps: [
            { say: "rowan", text: "Maybe there isn't a why. Sometimes I just got lucky." },
            { say: "magnus", text: "Luck is a rate. I have yours. It is fifty point three, which is nothing." },
            { say: "magnus", text: "You are not lucky, Vance. You are *annoying*. There ought to be a column for it." }
          ] }
        ] },
        { flag: "chat_magnus_1" },
        NOTE("magnus", "His file on you logs every turn of forty-one games. The column headed WHY is all question marks."),
        { time: 3 }
      ] },
      { text: "Is that how you pick a deck, too? Off a grid?", when: (s)=>!s.flags["chat_magnus_2"], steps: [
        { say: "rowan", text: "Is that how you pick a deck, too? Off a grid?" },
        { say: "magnus", text: "\"Off the ladder. I take the three best lists of the week and look for what all three lose to.\" He does not look up. \"It is not creativity. It is arithmetic.\"" },
        { say: "magnus", text: "I dropped the last one yesterday. Its win rate fell under fifty-eight. I am not married to cardboard." },
        { say: "magnus", text: "\"And you?\" The pale eyes come up, quick. \"Do you pick by the numbers?\"" },
        { choice: [
          { text: "No. Same deck for two years. I've never changed it.", steps: [
            { say: "rowan", text: "No. Same deck for two years. I've never changed it." },
            { say: "magnus", text: "\"*Never.*\" The stylus stops. \"That is not a strategy. That is a superstition.\"" },
            { say: "rowan", text: "It's been fifth for two years." },
            { say: "magnus", text: "\"I am aware of where it has been.\" He makes a note of it, hard. \"Thank you. That is deeply unhelpful.\"" },
            { flag: "magnus_said_superstition" }
          ] },
          { text: "Sometimes. Mostly I play what I understand.", steps: [
            { say: "rowan", text: "Sometimes. Mostly I play what I understand." },
            { say: "magnus", text: "\"Understand.\" He writes the word on the tablet and looks at it. \"I shall have to find out what that means in practice.\"" },
            AFF("magnus", 1, "Answered honestly")
          ] },
          { text: "Forget the numbers a second. Which card do you actually like?", steps: [
            { say: "rowan", text: "Forget the numbers a second. Which card do you actually like?" },
            { say: "magnus", text: "Like." },
            { text: "For the first time since you sat down, his face is completely blank. It is not rudeness. He is searching, and the search is returning nothing." },
            { say: "magnus", text: "That isn't a field. I have never — nobody has asked for that." },
            { say: "magnus", text: "Ask me again at the end of term. I will have an answer. I will have a *ranked* answer." },
            AFF("magnus", 2, "Asked something new"),
            NOTE("magnus", "Has never had a favourite card. Looked blank when asked.")
          ] }
        ] },
        { flag: "chat_magnus_2" },
        NOTE("magnus", "Picks his deck each week from the three best lists: \"arithmetic, not creativity.\""),
        { time: 3 }
      ] },
      { text: "Those shoes have never touched a pavement, have they?", when: (s)=>!s.flags["chat_magnus_3"], steps: [
        { say: "rowan", text: "Those shoes have never touched a pavement, have they?" },
        { say: "magnus", text: "\"New this morning.\" For the first time he looks at something that is neither you nor the tablet. \"A new pair for every event. A pair with no losses in it.\"" },
        { choice: [
          { text: "You called one deck for two years a superstition.", when: (s)=>!!s.flags["magnus_said_superstition"], steps: [
            { say: "rowan", text: "You called one deck for two years a superstition." },
            { say: "magnus", text: "This is not a superstition. It is a control variable." },
            { text: "You say nothing. The engine hums. He lasts about four seconds." },
            { say: "magnus", text: "…It is a *small* superstition. It is in the file under 'other'." },
            AFF("magnus", 2, "Caught him out")
          ] },
          { text: "And when you lose in them?", steps: [
            { say: "rowan", text: "And when you lose in them?" },
            { say: "magnus", text: "They go back in the box. The box goes on the stack. I have brought eleven boxes." },
            { say: "rowan", text: "That's eleven losses you've packed for." },
            { say: "magnus", text: "\"That is eleven *events*.\" A pause. \"It is a pessimistic packing list. Yes.\"" },
            AFF("magnus", 1, "Did his sums for him")
          ] },
          { text: "They're good shoes.", steps: [
            { say: "rowan", text: "They're good shoes." },
            { say: "magnus", text: "They are *excellent* shoes. Thank you. Nobody ever says anything about the shoes. They only look at the tablet." },
            AFF("magnus", 1, "Noticed the shoes")
          ] }
        ] },
        { say: "magnus", text: "The first pair was the first thing I bought with ladder winnings. Season one. Sixty-fourth place, one pair. I chose them myself. That mattered, at the time." },
        { flag: "chat_magnus_3" },
        NOTE("magnus", "Wears a new pair of sneakers to every event: \"a pair with no losses in it.\" Brought eleven boxes."),
        { time: 3 }
      ] },
      { text: "Why me? There are four names above mine on that ladder.", when: (s)=>!s.flags["chat_magnus_x"], steps: [
        { say: "rowan", text: "Why me? There are four names above mine on that ladder." },
        { say: "magnus", text: "\"Because the other four *talk*.\" Quietly, and fast. \"First posts his lists. Second streams. Third insults me in the chat, which is at least attention.\"" },
        { say: "magnus", text: "You never typed a word. Two years. Forty-one games. Not one 'gg'." },
        { say: "magnus", text: "Do you know what sixth is? Sixth is the one underneath the one people have heard of. Nobody writes an article about the one below." },
        { choice: [
          { text: "I had the chat switched off. For everyone. It was never you.", steps: [
            { say: "rowan", text: "I had the chat switched off. For everyone. It was never you." },
            { say: "magnus", text: "\"For everyone.\" He writes it down. He underlines it." },
            { say: "magnus", text: "That is, statistically, a relief. That is forty-one fewer insults than I had on file." },
            AFF("magnus", 2, "It wasn't personal")
          ] },
          { text: "gg, Magnus. Forty-one of them, if you're keeping a file.", steps: [
            { say: "rowan", text: "gg, Magnus. Forty-one of them, if you're keeping a file." },
            { say: "magnus", text: "\"That is —\" The tight, careful politeness arrives, and for once it does not quite cover everything. \"— late. That is late, Vance.\"" },
            { say: "magnus", text: "I'll take them. Don't tell anybody I took them." },
            AFF("magnus", 3, "Said it at last")
          ] },
          { text: "I noticed somebody was always one rank behind me. I just never looked at who.", steps: [
            { say: "rowan", text: "I noticed somebody was always one rank behind me. I just never looked at who." },
            { say: "magnus", text: "\"…\" He looks up from the tablet. \"You noticed.\"" },
            { say: "magnus", text: "That is a more pleasant sentence than I had prepared for. I shall have to think about it." },
            AFF("magnus", 2, "Had noticed him")
          ] }
        ] },
        { flag: "chat_magnus_x" },
        NOTE("magnus", "What he could not forgive was the silence: two years, forty-one games, and never a 'gg'."),
        { time: 3 }
      ] },
      { text: "What are you on this week?", when: (s)=>!s.flags["deck_known_magnus"], steps: [
        { scene: "deck_magnus" }
      ] },
      { text: "I should let you get back to your log.", steps: [
        { say: "rowan", text: "I should let you get back to your log." },
        { say: "magnus", text: "It keeps itself. I only watch. Go on." },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_magnus_done" },
    { say: "magnus", text: "\"That is quite enough. I have said more to you in ten minutes than to anybody since the harbour.\" He taps the stylus against his teeth. \"Do not let it go to your head.\"" },
    { end: true }
  ]
});

scene("deck_magnus", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_magnus"], end: true },
    { say: "rowan", text: "What are you on this week?" },
    { say: "magnus", text: "\"Whatever the data says.\" A glance at the tablet. \"One-Two-Punch. Ghuanjun, Bill, Elana. Win rate fifty-nine point four.\"" },
    { text: "Your eyes go to the stylus in his hand, and stay there, and your voice comes out low and fast." },
    { say: "rowan", text: "\"…Ferocious Tiger Kick, Blow of the Venom Snake, Whirlwind Strike. Three attacks a turn, the second and third with a bonus. Stun. Discard. Poison. First turn can't kill. Stranglehold and the Sun Sword next turn. Jump in the River keeps the one attacker alive.\" A breath. \"One hero deep. Every attack announced.\"" },
    { say: "magnus", text: "You have looked at the same lists I have." },
    { say: "rowan", text: "Everyone has. It's the best list on the ladder this week." },
    { say: "magnus", text: "\"…It is.\" He does not say anything else for a moment. Then, carefully: \"It is a clean list. It is not a deck I *love*.\"" },
    { choice: [
      { text: "Does it have to be?", steps: [
        { say: "rowan", text: "Does it have to be?" },
        { say: "magnus", text: "\"No. That is rather the point of it.\" A very small pause. \"You asked as if it might.\"" }
      ] },
      { text: "Then why not play one you do?", steps: [
        { say: "rowan", text: "Then why not play one you do?" },
        { say: "magnus", text: "Because love has a win rate, Vance, and it is poor." }
      ] }
    ] },
    AFF("magnus", 1, "Spoke his language"),
    DECK("magnus"),
    { time: 2 }
  ]
});

scene("post_magnus", {
  steps: [
    DECK("magnus"),
    { when: (s)=>s.duels["ferry_magnus"] !== "won", jump: "lost" },
    { text: "Magnus is staring at the tablet. He has already started a note." },
    { say: "magnus", text: "One-Two-Punch cannot kill on the first turn. You knew that. You used the first turn to set up a Storm that kills before the second." },
    { say: "rowan", text: "It kills on the third. I wasn't racing you. I was making you commit." },
    { say: "magnus", text: "\"Commit.\" A thin, careful smile that looks almost real. \"I committed. And you did not.\"" },
    { choice: [
      { text: "The list isn't the point. The point is what you do when the list stops working.", steps: [
        { say: "rowan", text: "The list isn't the point. The point is what you do when the list stops working." },
        { say: "magnus", text: "That is not a comfortable sentence." },
        { say: "magnus", text: "I'll write it down anyway. Uncomfortable ones are usually the ones worth filing." }
      ] },
      { text: "You nearly had me on turn two. One more attack and I'd have had no turn three.", steps: [
        { say: "rowan", text: "You nearly had me on turn two. One more attack and I'd have had no turn three." },
        { say: "magnus", text: "\"Nearly is not a rank.\" But he writes it down, and he writes all of it. \"One more attack. Yes. I counted the same.\"" }
      ] }
    ] },
    AFF("magnus", 1, "Talked it through"),
    { end: true },
    { label: "lost" },
    { text: "Magnus makes a clean note on the tablet, reads it, and makes it again, neater." },
    { say: "magnus", text: "\"Casual, ferry, unofficial. It did not count.\" But there is a look on his face that is not quite a smile. \"Your Storm was well timed.\"" },
    { say: "rowan", text: "You hit me three times a turn. I had one turn to answer." },
    { say: "magnus", text: "\"And yet you did not hurry.\" He looks up. \"I would very much like to understand how you do that.\"" },
    { choice: [
      { text: "Honestly? I don't know.", steps: [
        { say: "rowan", text: "Honestly? I don't know." },
        { say: "magnus", text: "Then I shall find out before you do, and tell you. You may consider that a threat." }
      ] },
      { text: "I did hurry. Online nobody's watching my hands. Here you were.", steps: [
        { say: "rowan", text: "I did hurry. Online nobody's watching my hands. Here you were." },
        { text: "He looks at your hands. Then, with the air of a man extending an enormous courtesy, he looks away from them." },
        { say: "magnus", text: "I didn't log that. I could have. I am telling you that I didn't." }
      ] }
    ] },
    AFF("magnus", 1, "Talked it through")
  ]
});

/* ───────────────────────── NOOR ───────────────────────── */
scene("ferry_noor", {
  steps: [
    { when: (s)=>!!s.flags["met_noor"], jump: "again" },
    { text: "A calm girl in a blue hijab sits on a window bench with a heavy book open on her knee. Its margins bristle with pencil tabs. Her jacket is red; the brooch that pins the hijab is a very small silver gavel." },
    { text: "The window behind her is huge and spotless, and full of sea. She is not looking at the sea. She is reading, with the complete stillness of someone who finishes the sentence before reacting." },
    { text: "Around her the saloon is a fairground of duffel bags and raised voices. Her bench has a clear half-metre on either side, as if the whole crowd had agreed on it without being told." },
    { text: "You stand there for a moment. Then, unexpectedly, the pencil stops." },
    { say: "noor", alias: "Girl with a rulebook", text: "May I help you?" },
    { text: "It is a perfectly courteous question. It is also, you realise, a very polite way of saying that you have been standing in her light for a minute and a half." },
    { choice: [
      { text: "Sorry, I'm in your light. I'm Rowan. I wondered what could be better than that view.", steps: [
        { say: "rowan", text: "Sorry, I'm in your light. I'm Rowan. I wondered what could be better than that view." },
        { say: "noor", alias: "Girl with a rulebook", text: "\"The view has not changed since half past six. I checked.\" She lifts the book half an inch, so that you can see the cover: a heavy, official, very worn blue. \"This has.\"" },
        { say: "noor", alias: "Girl with a rulebook", text: "It is the Academy Charter. Nine articles, with the Handbook bound in." }
      ] },
      { text: "Is that the rulebook for the whole Academy? I'm Rowan. All I got was a packing list.", steps: [
        { say: "rowan", text: "Is that the rulebook for the whole Academy? I'm Rowan. All I got was a packing list." },
        { say: "noor", alias: "Girl with a rulebook", text: "It is. They hand it out on the island. One may also write to the registrar for it beforehand. I wrote in March." },
        { say: "noor", alias: "Girl with a rulebook", text: "\"They sent it with a note asking whether I was sure.\" She lifts the book half an inch: a heavy, official, very worn blue. \"Nine articles, with the Handbook bound in.\"" }
      ] },
      { text: "You're the only person in this room who isn't watching the table. I'm Rowan.", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "You're the only person in this room who isn't watching the table. I'm Rowan." },
        { say: "noor", alias: "Girl with a rulebook", text: "I listened to it. It did not improve when I looked." },
        { say: "noor", alias: "Girl with a rulebook", text: "\"So I returned to something that does.\" She lifts the book half an inch: a heavy, official, very worn blue. \"The Academy Charter. Nine articles, with the Handbook bound in.\"" }
      ] }
    ] },
    { say: "noor", alias: "Girl with a rulebook", text: "I am on article seven, for the third time. It is the one about conflicts." },
    { choice: [
      { text: "Three times. Is it that hard, or that good?", steps: [
        { say: "rowan", text: "Three times. Is it that hard, or that good?" },
        { say: "noor", alias: "Girl with a rulebook", text: "It is that short. Four sentences. Each of them can be read two ways, and I should like to know which way before somebody else decides it for me." },
        { say: "rowan", text: "And which way is it?" },
        { say: "noor", alias: "Girl with a rulebook", text: "\"I shall tell you after the fourth reading.\" A very faint, very dry smile. \"I find that it repays attention.\"" }
      ] },
      { text: "Conflicts. You could have carried that over to the table an hour ago.", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "Conflicts. You could have carried that over to the table an hour ago." },
        { say: "noor", alias: "Girl with a rulebook", text: "Nobody at that table has asked for a ruling. A judge who rules unasked is only a person with opinions and a heavy book." },
        { say: "rowan", text: "And if somebody asked?" },
        { say: "noor", alias: "Girl with a rulebook", text: "\"Then I should close it on my pencil and answer.\" She does not close it. \"Nobody has asked.\"" }
      ] },
      { text: "I haven't read a line of it. I should probably say so now.", steps: [
        { say: "rowan", text: "I haven't read a line of it. I should probably say so now." },
        { say: "noor", alias: "Girl with a rulebook", text: "That is the plainest thing anyone has said to me this morning." },
        { say: "noor", alias: "Girl with a rulebook", text: "You may borrow it between here and the dock. Not article seven. I am using article seven." },
        AFF("noor", 2, "Admitted it plainly")
      ] }
    ] },
    { say: "noor", alias: "Girl with a rulebook", text: "Noor Al-Sayed. Rare Hall." },
    MET("noor", "Noor Al-Sayed"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "Is that the REAL rulebook? The really big one? It's got little FLAGS in it!" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "She's read it." },
    { add: { ferry_talked: 1 } },
    NOTE("noor", "Reads the Academy Charter for pleasure. On article seven, the one about conflicts, for the third time."),
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "noor", text: "\"And you are the entrant in ink. I read the list twice. It was nicely typed, apart from you.\" A pause. \"I believe it is considered rude to mention it. I find that I cannot help myself.\"" },
    { when: (s)=>!(s.flags["rowan_singled_out"] && !s.flags["table_resolved"]), jump: "quiet" },
    { say: "noor", text: "May I ask you something in return? When he made you the condition of her game: were you consulted?" },
    { choice: [
      { text: "No. I found out on the stairs, along with everyone else.", steps: [
        { say: "rowan", text: "No. I found out on the stairs, along with everyone else." },
        { say: "noor", text: "Then in most systems I know of, it is void. One cannot bind a third party by pointing at him." },
        { say: "rowan", text: "Is that a ruling?" },
        { say: "noor", text: "\"It is an opinion. Rulings I give when I am asked for them.\" She turns a page. \"That was a hint. I do not give many.\"" },
        AFF("noor", 1, "Answered straight")
      ] },
      { text: "Would it matter? The whole room heard him say it.", steps: [
        { say: "rowan", text: "Would it matter? The whole room heard him say it." },
        { say: "noor", text: "A thing does not become a rule by being heard. Otherwise the gulls would be running this ship." },
        { say: "noor", text: "If you would like to know what the plate on that table actually says, ask me. I give rulings when I am asked for them." }
      ] },
      { text: "I'd rather not talk about the table at all, if that's allowed.", steps: [
        { say: "rowan", text: "I'd rather not talk about the table at all, if that's allowed." },
        { say: "noor", text: "It is allowed. It will still be there. Tables are patient." },
        { text: "She moves the Charter two centimetres along her knee. It takes you a moment to understand that this is an invitation to stay." },
        AFF("noor", 1, "Said what he wanted")
      ] }
    ] },
    { jump: "firstend" },
    { label: "quiet" },
    { say: "noor", text: "You may sit, if you like. The half-metre is not reserved. People only behave as though it were." },
    { label: "firstend" },
    { think: "She is the calmest person on this ship. I'd like to know what it costs." },
    { time: 8 },
    { jump: "menu" },
    { label: "again" },
    { text: "She marks her place with the pencil before she looks up. She has, you suspect, never once lost her place." },
    { say: "noor", text: "Rowan." },
    { time: 2 },
    { label: "menu" },
    { choice: [
      { text: "What does 'winner stays' on that plate actually mean? Does he get to choose who sits down?", when: (s)=>!s.flags["noor_ruled"] && !s.flags["table_resolved"], steps: [
        { say: "rowan", text: "What does 'winner stays' on that plate actually mean? Does he get to choose who sits down?" },
        { say: "noor", text: "\"To be precise —\" She closes the book on her pencil." },
        { say: "noor", text: "It says who keeps the seat. It says nothing about who may sit down opposite. And it says nothing at all about luggage, or collars." },
        { say: "noor", text: "A second table is not forbidden. Neither is a game played for nothing. And a winner who declines every challenger has not defended the seat. The table does not become his property." },
        { say: "rowan", text: "So his rule is —" },
        { say: "noor", text: "A private preference. Binding on whoever accepts it. Not binding on anyone else." },
        { choice: [
          { text: "Would you say that to his face?", steps: [
            { say: "rowan", text: "Would you say that to his face?" },
            { say: "noor", text: "If he asks. He will not ask. People who are comfortable seldom request a ruling." }
          ] },
          { text: "So anyone could simply set up a second table.", steps: [
            { say: "rowan", text: "So anyone could simply set up a second table." },
            { say: "noor", text: "Anyone could. Nobody has. It is curious how seldom people do a thing that is merely not forbidden." }
          ] }
        ] },
        { flag: "noor_ruled" },
        AFF("noor", 2, "Asked for a ruling"),
        NOTE("noor", "Her ruling: 'winner stays' says who keeps the seat, nothing more. A second table is not forbidden."),
        { time: 3 }
      ] },
      { text: "Help me build that second table, if you're willing.", when: (s)=>!!s.flags["noor_ruled"] && !s.flags["table_resolved"], steps: [
        { say: "rowan", text: "Help me build that second table, if you're willing." },
        { scene: "table_settle" }
      ] },
      { text: "Would you like a game? No stake.", when: (s)=>!s.flags["flag_noor_played"], steps: [
        { say: "rowan", text: "Would you like a game? No stake." },
        { say: "noor", text: "Gladly. No stake. I will announce every step; it is a habit." },
        { duel: "ferry_noor", opponent: "noor", opponentName: "Noor Al-Sayed", mustWin: false,
          onWin: [
            { say: "noor", text: "To be precise, you did not win on time. You won on the board. That is better." },
            AFF("noor", 3, "Fair loss")
          ],
          onLose: [
            { say: "noor", text: "I announced it on turn two, and you were still surprised. That is a legitimate compliment to my honesty." },
            AFF("noor", 3, "Played straight")
          ] },
        { scene: "post_noor" },
        { flag: "flag_noor_played" },
        { time: 25 }
      ] },
      { text: "May I ask you something that isn't in the book?", when: (s)=>!s.flags["chat_noor_done"], steps: [
        { say: "rowan", text: "May I ask you something that isn't in the book?" },
        { say: "noor", text: "Then it is the more interesting kind. Please." },
        { scene: "chat_noor" }
      ] },
      { text: "Leave her to the book.", steps: [
        { say: "noor", text: "Thank you. Article seven is demanding." }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_noor", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_noor_1"] && !!s.flags["chat_noor_2"] && !!s.flags["chat_noor_3"] && (!!s.flags["chat_noor_x"] || !(s.day===1 && s.minutes<645)) && !s.flags["chat_noor_done"], jump: "done" },
    { choice: [
      { text: "That brooch is a judge's gavel. On a Competitive Play jacket.", when: (s)=>!s.flags["chat_noor_1"], steps: [
        { say: "rowan", text: "That brooch is a judge's gavel. On a Competitive Play jacket." },
        { say: "noor", text: "It is, and it is. You found the contradiction faster than my mother did." },
        { say: "noor", text: "I am in Competitive Play because one cannot judge a game one has never properly lost. I intend to be a head judge. Not a champion." },
        { text: "She says it without apology, the way another girl might say she wants to be a pilot." },
        { choice: [
          { text: "I've never met anybody who wanted that.", steps: [
            { say: "rowan", text: "I've never met anybody who wanted that." },
            { say: "noor", text: "That is why there are so few good ones." }
          ] },
          { text: "What can a head judge do that the book can't?", steps: [
            { say: "rowan", text: "What can a head judge do that the book can't?" },
            { say: "noor", text: "The book says who is right. The judge has to say it so that both of them can live with it. She does not decide who wins. She decides what it meant." }
          ] },
          { text: "Doesn't everyone end up hating the judge?", steps: [
            { say: "rowan", text: "Doesn't everyone end up hating the judge?" },
            { say: "noor", text: "They are afraid of the judge, which is worse and less useful. I should like to be the one nobody is afraid to call." }
          ] }
        ] },
        { say: "noor", text: "And you? You were let in to win, I assume. Do you want to?" },
        { choice: [
          { text: "I want to find out whether I can do it with people watching.", steps: [
            { say: "rowan", text: "I want to find out whether I can do it with people watching." },
            { say: "noor", text: "That is a more exact answer than 'yes'. I shall remember that it was the first one you gave." },
            AFF("noor", 2, "Gave the exact answer")
          ] },
          { text: "Yes.", steps: [
            { say: "rowan", text: "Yes." },
            { say: "noor", text: "Good. Then you will need somebody to call your time fairly. I expect to be available from the second week." },
            AFF("noor", 1, "Said it plainly")
          ] }
        ] },
        { flag: "chat_noor_1" },
        NOTE("noor", "Wants to be a head judge, not a champion: the judge nobody is afraid to call."),
        { time: 3 }
      ] },
      { text: "There must be forty pencil tabs in that book. What earns a tab?", when: (s)=>!s.flags["chat_noor_2"], steps: [
        { say: "rowan", text: "There must be forty pencil tabs in that book. What earns a tab?" },
        { say: "noor", text: "Thirty-one. Each marks a ruling that is correct and, in my opinion, unjust." },
        { text: "She opens the book at a tab without looking for it." },
        { say: "noor", text: "Handbook, section four. A player who arrives late to a round forfeits it. There is no exception for a player who was late because nobody told her which hall." },
        { say: "noor", text: "It is the correct ruling. I should have to give it." },
        { choice: [
          { text: "Would you? Give it?", steps: [
            { say: "rowan", text: "Would you? Give it?" },
            { say: "noor", text: "Yes." },
            { say: "noor", text: "And then I should write to the committee that evening, and every evening after. That is what the tabs are. They are a list of letters I owe." },
            AFF("noor", 2, "Asked the hard half")
          ] },
          { text: "Or you let her play. Who'd ever know?", steps: [
            { say: "rowan", text: "Or you let her play. Who'd ever know?" },
            { say: "noor", text: "I should know. It is a small audience, but it attends everything." },
            { say: "noor", text: "\"I notice that you said it aloud, however, instead of merely thinking it.\" A dry pause. \"I do not dislike that as much as I am supposed to.\"" },
            AFF("noor", 1, "Honest about it")
          ] },
          { text: "Thirty-one unjust rules sounds like a bad rulebook.", steps: [
            { say: "rowan", text: "Thirty-one unjust rules sounds like a bad rulebook." },
            { say: "noor", text: "It is a very good rulebook. A bad one would have three hundred, and nobody would have counted." }
          ] }
        ] },
        { flag: "chat_noor_2" },
        NOTE("noor", "Her thirty-one pencil tabs mark rulings she thinks correct but unjust. She means to get them changed."),
        { time: 3 }
      ] },
      { text: "You read that book as if you already know it. When did you learn it?", when: (s)=>!s.flags["chat_noor_3"], steps: [
        { say: "rowan", text: "You read that book as if you already know it. When did you learn it?" },
        { say: "noor", text: "In Rotterdam, when I was eleven. We had moved from Alexandria. I had Dutch to learn, and English, and at the club on the corner they played this game." },
        { say: "noor", text: "I learned all three in the same two years. The rules were the only one of the three that had been written down in full." },
        { say: "noor", text: "My grandmother used to say that a promise is only as good as the person who can say what it meant. I decided to be that person. I was eleven; it seemed manageable." },
        { choice: [
          { text: "Which of the three was hardest?", steps: [
            { say: "rowan", text: "Which of the three was hardest?" },
            { say: "noor", text: "Dutch. It has rules and declines to follow them. I hold it against the language to this day." },
            AFF("noor", 1, "Made her joke")
          ] },
          { text: "Is that why you finish every sentence?", steps: [
            { say: "rowan", text: "Is that why you finish every sentence?" },
            { say: "noor", text: "…Do I?" },
            { say: "noor", text: "Yes. I suppose that when one has been corrected in three languages, one learns to arrive at the full stop on purpose." },
            AFF("noor", 2, "Heard how she speaks")
          ] },
          { text: "That sounds lonely, at eleven.", steps: [
            { say: "rowan", text: "That sounds lonely, at eleven." },
            { say: "noor", text: "It was orderly." },
            { say: "noor", text: "Those are sometimes the same thing. I did not expect you to know that." },
            AFF("noor", 2, "Saw past the order")
          ] }
        ] },
        { flag: "chat_noor_3" },
        NOTE("noor", "From Alexandria by way of Rotterdam. Learned Dutch, English and the rules in the same two years."),
        { time: 3 }
      ] },
      { text: "Every bench in here is three deep in bags. Why is there half a metre free on either side of you?", when: (s)=>!s.flags["chat_noor_x"] && (s.day===1 && s.minutes<645), steps: [
        { say: "rowan", text: "Every bench in here is three deep in bags. Why is there half a metre free on either side of you?" },
        { say: "noor", text: "Two boys had left their bags across the foot of the stairs. I mentioned that it was a gangway, and that the notice by the door asks for gangways to be kept clear." },
        { say: "noor", text: "I quoted the notice. Word appears to have travelled. I am now, I gather, the girl who quotes notices." },
        { say: "noor", text: "It is restful. It is also, I notice, half a metre." },
        { choice: [
          { text: "Sit down in the half-metre.", steps: [
            { text: "You sit. The bench is warm from the window. She moves the Charter two centimetres to give you room that she did not need to give." },
            { say: "noor", text: "The notice has nothing against that." },
            { say: "noor", text: "My roommate, according to my letter, is a Sunniva Aldane. I am told she is the one who has been standing on the rail upstairs. I expect I shall be quoting notices at home as well." },
            AFF("noor", 3, "Sat in the half-metre")
          ] },
          { text: "They'll get over it. You were right about the stairs.", steps: [
            { say: "rowan", text: "They'll get over it. You were right about the stairs." },
            { say: "noor", text: "I was. It is a smaller comfort than one would hope." },
            AFF("noor", 1, "Took her side")
          ] },
          { text: "You could try not quoting the notice.", steps: [
            { say: "rowan", text: "You could try not quoting the notice." },
            { say: "noor", text: "I could. Then the bags would still be there, and somebody would fall over them, and I should have been pleasant." }
          ] }
        ] },
        { flag: "chat_noor_x" },
        NOTE("noor", "Quoted the gangway notice at two boys with bags on the stairs. Has had a clear half-metre round her ever since."),
        { time: 3 }
      ] },
      { text: "Would you tell me what you play, Noor?", when: (s)=>!s.flags["deck_known_noor"], steps: [
        { scene: "deck_noor" }
      ] },
      { text: "I'll leave you to article seven.", steps: [
        { say: "rowan", text: "I'll leave you to article seven." },
        { say: "noor", text: "It will keep. It is very patient; I am trying to learn that from it." },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_noor_done" },
    { say: "noor", text: "That is a more thorough conversation than I expected to have before docking. Thank you. I shall mark it down as a pleasant irregularity." },
    { end: true }
  ]
});

scene("deck_noor", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_noor"], end: true },
    { say: "rowan", text: "Would you tell me what you play, Noor?" },
    { text: "She closes the book on her pencil. It is, you are beginning to learn, what she does before anything she means." },
    { say: "noor", text: "\"Countdown. The Doom Clock. Twenty counters end the game for whoever places the last one.\" A pause. \"It is entirely transparent. It seems only fair to give notice.\"" },
    { text: "Your mouth has started moving half a second before your voice does." },
    { say: "rowan", text: "\"…Doom Prophecy fetches the Clock with three counters on it. Only she takes them off. Eagle Warrior, Jaguar Warrior — enter by removing one. Basketskull, a fistful off, turned into damage. Warrior of Teocuilatl spends them as shields. Archers shoot when one lands.\" A breath. \"Twentieth one falls on whoever she's picked. Right. Right.\"" },
    { say: "noor", text: "…You have said that in the correct order." },
    { say: "rowan", text: "Transparent, and nearly impossible to interrupt. It's the most honest threat in the format." },
    { say: "noor", text: "\"Thank you.\" A very faint, very dry smile. \"I have been trying to say that for two years.\"" },
    { choice: [
      { text: "Why tell them at all? You'd win more if you didn't.", steps: [
        { say: "rowan", text: "Why tell them at all? You'd win more if you didn't." },
        { say: "noor", text: "Because nobody should lose to a thing they were not told about. They may lose to it afterwards as often as they like." }
      ] },
      { text: "Has anybody ever stopped it, knowing?", steps: [
        { say: "rowan", text: "Has anybody ever stopped it, knowing?" },
        { say: "noor", text: "Twice. I wrote to both of them to congratulate them. One replied." }
      ] }
    ] },
    AFF("noor", 2, "Knew her deck"),
    DECK("noor"),
    { time: 2 }
  ]
});

scene("post_noor", {
  steps: [
    DECK("noor"),
    { when: (s)=>s.duels["ferry_noor"] !== "won", jump: "lost" },
    { text: "She turns her last card face up on the bench, so that you can see what she was holding." },
    { say: "noor", text: "I had four counters on the Clock and no way to use them." },
    { say: "rowan", text: "I killed your Warriors before they could remove counters. If one had landed I'd have been two turns from losing." },
    { say: "noor", text: "\"It was a very clean read.\" Quiet, honest. \"I have not been beaten by a read in a long time.\"" },
    { choice: [
      { text: "You told me the turn. It's hard to misread a deck that announces itself.", steps: [
        { say: "rowan", text: "You told me the turn. It's hard to misread a deck that announces itself." },
        { say: "noor", text: "Most people manage. They hear the number and decide that it does not apply to them." }
      ] },
      { text: "My hands were shaking the whole way through. I don't know if you saw.", steps: [
        { say: "rowan", text: "My hands were shaking the whole way through. I don't know if you saw." },
        { say: "noor", text: "I saw. There is no rule about hands. I looked it up some time ago, for a different person." },
        { say: "noor", text: "You played every card the right way up. That is all the table requires of anyone." }
      ] }
    ] },
    AFF("noor", 1, "Talked it through"),
    { end: true },
    { label: "lost" },
    { say: "noor", text: "\"The Doom Clock reached twenty on turn nine.\" A faint, almost mischievous pause. \"I believe I mentioned that it would.\"" },
    { say: "rowan", text: "You did. I knew it was coming and I still couldn't stop it. Every counter I tried to remove, you took back." },
    { say: "noor", text: "That is the value of notice. It does not help the person who receives it." },
    { choice: [
      { text: "That's the best advertisement for a deck I've ever heard.", steps: [
        { say: "rowan", text: "That's the best advertisement for a deck I've ever heard." },
        { say: "noor", text: "I shall not put it on a poster. But thank you." }
      ] },
      { text: "Then why give it?", steps: [
        { say: "rowan", text: "Then why give it?" },
        { say: "noor", text: "Because it helps the person who gives it. I should not care to win by a thing I had kept quiet about." }
      ] }
    ] },
    AFF("noor", 1, "Talked it through")
  ]
});

/* ───────────────────────── LIVVIE ───────────────────────── */
scene("ferry_livvie", {
  steps: [
    { when: (s)=>!!s.flags["met_livvie"], jump: "again" },
    { text: "At the galley end of the saloon a very pale, thin girl with a glossy violet-black bob and two bright cyan hair clips is adding up a column on a clipboard." },
    { text: "Her gold jacket is not new. It has been mended at both elbows, in slightly different wool. The galley hatch is six feet away, selling cinnamon rolls. She has not bought one." },
    { text: "She does not look up. The pencil goes down the column in short, exact strokes. Somebody walks away from the hatch with a roll, and the pencil stops and makes one very small tick." },
    { think: "She's counting something. Or someone." },
    { say: "livvie", alias: "Girl with a clipboard", text: "Quick thing — are you using that rare?" },
    { say: "rowan", text: "What rare?" },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"Left pocket.\" Eyes down. \"You've touched it three times since the stairs. People only check a pocket that often when there's money in it or a card.\"" },
    { choice: [
      { text: "It's my deck. All of it. I keep making sure it hasn't gone anywhere. I'm Rowan.", steps: [
        { say: "rowan", text: "It's my deck. All of it. I keep making sure it hasn't gone anywhere. I'm Rowan." },
        { say: "livvie", alias: "Girl with a clipboard", text: "Oh." },
        { text: "A tiny pause. A small sideways look, to see how you take it." },
        { say: "livvie", alias: "Girl with a clipboard", text: "Then you want to stop doing that. Everybody in here knows which pocket now. I'd have charged you for telling you, only I've gone and said it." },
        AFF("livvie", 1, "Told her straight")
      ] },
      { text: "Are you pricing my pockets? I'm Rowan, by the way.", steps: [
        { say: "rowan", text: "Are you pricing my pockets? I'm Rowan, by the way." },
        { say: "livvie", alias: "Girl with a clipboard", text: "Not yours specially. Everyone's. It's professional." },
        { say: "livvie", alias: "Girl with a clipboard", text: "\"Yours is a deck box. Square corners.\" The pencil taps once. \"Sorry. I'd put a number on it, but I've not seen inside.\"" }
      ] },
      { text: "It's nothing you can sell. I'm Rowan.", steps: [
        { say: "rowan", text: "It's nothing you can sell. I'm Rowan." },
        { say: "livvie", alias: "Girl with a clipboard", text: "Everything's something you can sell. Sorry. But all right." },
        { say: "livvie", alias: "Girl with a clipboard", text: "It's a deck box, though. Square corners. I'm only saying, the whole room can see which pocket." }
      ] }
    ] },
    { say: "livvie", alias: "Girl with a clipboard", text: "Livvie Thana. I trade. I run lists. And I play, five a side." },
    MET("livvie", "Livvie Thana"),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "Rowan, is that girl counting US?" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "Everyone gets counted." },
    { add: { ferry_talked: 1 } },
    { text: "Behind you somebody carries a roll away from the hatch. Tick." },
    { choice: [
      { text: "What are the ticks for? You make one every time somebody leaves the hatch.", steps: [
        { say: "rowan", text: "What are the ticks for? You make one every time somebody leaves the hatch." },
        { say: "livvie", text: "\"Rolls.\" As if it were obvious, and a little as if she had been caught." }
      ] },
      { text: "What's on the list you're running now?", steps: [
        { say: "rowan", text: "What's on the list you're running now?" },
        { say: "livvie", text: "\"This one?\" She tilts the clipboard a careful inch towards you. \"Rolls.\"" }
      ] }
    ] },
    { say: "livvie", text: "Thirty-one since the harbour. Three coins each, that's ninety-three, and that tray never cost her more than twelve." },
    { say: "livvie", text: "It's the best business on this boat. I'm not buying one. I'm *studying* one." },
    { text: "Her stomach growls. It is a small, distinct, entirely audible sound. She does not hear it. She very clearly does not hear it." },
    { say: "livvie", text: "I've eaten. I had a big breakfast." },
    { text: "A longer pause. The cinnamon is warm and loud and unfair." },
    { say: "livvie", text: "Yesterday counts." },
    NOTE("livvie", "Trades, runs lists, plays for five a side. Counted every cinnamon roll sold on the ferry and bought none."),
    { choice: [
      { text: "I'm getting one, and I can't manage a whole one this early. Take half off my hands?", when: (s)=>(s.coins||0)>=3, steps: [
        { say: "rowan", text: "I'm getting one, and I can't manage a whole one this early. Take half off my hands?" },
        { say: "livvie", text: "\"Half.\" The pencil has stopped. \"What d'you want for the half?\"" },
        { say: "rowan", text: "Nothing. It'd only go in the bin." },
        { say: "livvie", text: "\"That's waste.\" She says it as though you had owned up to something. \"…Go on, then. I'm only stopping the waste.\"" },
        { text: "You go to the hatch. The woman in the apron slides a roll across the counter with a look that is the friendliest possible version of \"I have seen this before\". Three Smug Coins." },
        { coins: -3 },
        { text: "You tear it. It does not tear evenly. You hand her the larger part, and neither of you mentions it." },
        { text: "She eats it in tiny, exact bites with a pause between each, as if she were making it last until Thursday. She does not say anything until it is gone." },
        { say: "livvie", text: "…That's very good. I'd got her margin wrong. It's worth the three." },
        { say: "livvie", text: "I'll pay you back. In information. Which is a currency." },
        { say: "rowan", text: "It was going spare." },
        { say: "livvie", text: "I know. That's why I have to." },
        AFF("livvie", 3, "Shared, didn't give"),
        NOTE("livvie", "Will not take charity. Pays everything back, in information if need be."),
        { flag: "livvie_fed" }
      ] },
      { text: "Let me buy you one. It's three coins.", when: (s)=>(s.coins||0)>=3, steps: [
        { say: "rowan", text: "Let me buy you one. It's three coins." },
        { say: "livvie", text: "I couldn't." },
        { text: "She says it quickly, to the clipboard. The pencil has stopped." },
        { say: "rowan", text: "I'm going up there anyway." },
        { say: "livvie", text: "…What kind?" },
        { say: "rowan", text: "Cinnamon. There's only the one kind." },
        { say: "livvie", text: "Then okay. Yes. Thank you. I'll pay you back." },
        { text: "You go to the hatch. The woman in the apron slides a roll across the counter with a look that is the friendliest possible version of \"I have seen this before\". Three Smug Coins." },
        { coins: -3 },
        { text: "She takes it in both hands, carefully, the way you take something that might be taken back. She eats it in tiny, exact bites, and says nothing until it is gone." },
        { say: "livvie", text: "In information. I'll pay you back in information. Which is a currency." },
        { say: "rowan", text: "You don't owe me anything." },
        { say: "livvie", text: "\"Everyone owes something. It's only a question of what it's worth.\" A small, tired, entirely sincere smile. \"It was kind, though. I've written it down as kind.\"" },
        AFF("livvie", 2, "Bought her a roll"),
        NOTE("livvie", "Will not take charity. Pays everything back, in information if need be."),
        { flag: "livvie_fed" }
      ] },
      { text: "So that's the rolls. What else on this boat have you priced?", hint: "Leave breakfast alone", steps: [
        { say: "rowan", text: "So that's the rolls. What else on this boat have you priced?" },
        { say: "livvie", text: "\"Him with the bandana.\" The pencil points without her looking. \"Even money, on a yes-or-no where he gets to say what counts as yes.\"" },
        { say: "livvie", text: "I'd not put a coin on his line. I'd put a coin on *him*." },
        { say: "rowan", text: "And me? I'm the yes-or-no." },
        { say: "livvie", text: "You I've not priced. You keep changing. That's not a complaint. It's just awkward for the column." },
        AFF("livvie", 2, "Didn't push")
      ] },
      { text: "Then I'll leave you to your column.", steps: [
        { say: "rowan", text: "Then I'll leave you to your column." },
        { say: "livvie", text: "\"You could do with sleeves.\" It comes out as you turn. \"For the deck. I've some at cost and a bit. Come and find me when you've stopped squeezing it.\"" },
        { time: 8 },
        { end: true }
      ] }
    ] },
    { time: 8 },
    { say: "livvie", text: "So. Five a side? Or you've more questions. People usually have, once they've seen the clipboard." },
    { jump: "menu" },
    { label: "again" },
    { when: (s)=>!!s.flags["livvie_fed"] && !s.flags["flag_livvie_played"], text: "There are four crumbs on the edge of the clipboard. She has lined them up." },
    { when: (s)=>!s.flags["flag_livvie_played"], say: "livvie", text: "Rowan. Five a side?" },
    { when: (s)=>!!s.flags["flag_livvie_played"], say: "livvie", text: "\"Rowan.\" A small, wry nod at the hatch. \"Forty-four now. She's having a good morning.\"" },
    { time: 2 },
    { label: "menu" },
    { choice: [
      { text: "Five a side. Go on.", when: (s)=>(s.coins||0)>=5 && !s.flags["flag_livvie_played"], steps: [
        { say: "rowan", text: "Five a side. Go on." },
        { say: "livvie", text: "Five. Thank you." },
        { duel: "ferry_livvie", opponent: "livvie", opponentName: "Livvie Thana", mustWin: false,
          onWin: [
            { coins: 10 },
            { say: "livvie", text: "\"My deck gives people presents. They hate it.\"" },
            { text: "She pays out five from a coin purse that is nearly empty." },
            { say: "livvie", text: "\"…It's the nicest thing I own.\"" },
            AFF("livvie", 2, "Fair game")
          ],
          onLose: [
            { coins: -5 },
            { say: "livvie", text: "\"I took five off you.\" Eyes down. \"I'll give you three back if you promise not to say I did.\"" },
            { text: "She does not wait for an answer." },
            { coins: 3 },
            AFF("livvie", 2, "Generous")
          ] },
        { scene: "post_livvie" },
        { flag: "flag_livvie_played" },
        { time: 25 }
      ] },
      { text: "Questions first, if the clipboard can spare you.", when: (s)=>!s.flags["chat_livvie_done"], steps: [
        { say: "rowan", text: "Questions first, if the clipboard can spare you." },
        { say: "livvie", text: "It can spare me while nobody's buying. Go on." },
        { scene: "chat_livvie" }
      ] },
      { text: "Another time.", steps: [
        { say: "rowan", text: "Another time." },
        { say: "livvie", text: "Another time. I'm here till the dock. I'm not hard to find; I'm the one with the clipboard." }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_livvie", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_livvie_1"] && !!s.flags["chat_livvie_2"] && !!s.flags["chat_livvie_3"] && !!s.flags["chat_livvie_x"] && !s.flags["chat_livvie_done"], jump: "done" },
    { choice: [
      { text: "There's a drawing in the margin of that clipboard. That isn't a price.", when: (s)=>!s.flags["chat_livvie_2"], steps: [
        { say: "rowan", text: "There's a drawing in the margin of that clipboard. That isn't a price." },
        { text: "She holds the clipboard half an inch closer to her chest. Then, after a pause, she turns it round. A tidy column of figures, and in the margin, very small, the frame of a card with a coin in it." },
        { say: "livvie", text: "Spare Change. A common. It costs nothing and pays one Smug Coin when it dies." },
        { choice: [
          { text: "That's good. That's really good.", steps: [
            { say: "rowan", text: "That's good. That's really good." },
            { say: "livvie", text: "\"It's a *common*.\" But the corner of her mouth moves." },
            AFF("livvie", 2, "Praised her design")
          ] },
          { text: "Who'd play a card just so that it can die?", steps: [
            { say: "rowan", text: "Who'd play a card just so that it can die?" },
            { say: "livvie", text: "Anybody who's ever been one coin short." },
            { say: "rowan", text: "I've got mainland notes in my sock that are worth nothing past the arch. I'd play it." },
            { say: "livvie", text: "\"…In your sock.\" She looks at you properly for the first time. Her eyes are grey, with shadows under them, and extremely clear. \"Right. You're who it's for, then.\"" },
            AFF("livvie", 3, "Knows about short")
          ] },
          { text: "Why's it in the margin, and not in the middle of the page?", steps: [
            { say: "rowan", text: "Why's it in the margin, and not in the middle of the page?" },
            { say: "livvie", text: "Because the middle's for things that pay. That one doesn't pay yet." },
            AFF("livvie", 1, "Saw where it was")
          ] }
        ] },
        { say: "livvie", text: "I do them on the backs of receipts, mostly. It's cheaper than paper. That's what I'm here for, properly. Game Design. The trading's only how I afford the designing." },
        { flag: "chat_livvie_2" },
        { flag: "livvie_said_design" },
        NOTE("livvie", "Studies Game Design. Draws cards on the backs of receipts; her best so far is 'Spare Change'."),
        { time: 3 }
      ] },
      { text: "You said you trade. Since when?", when: (s)=>!s.flags["chat_livvie_1"], steps: [
        { say: "rowan", text: "You said you trade. Since when?" },
        { say: "livvie", text: "Since I could count. There was a card shop in our town that paid you in a shelf of cards for working the till. So I worked the till." },
        { say: "livvie", text: "\"I know what every card on this boat's worth.\" Eyes down. \"I've not seen most of them. I know what they're *worth*.\"" },
        { choice: [
          { text: "That's impressive.", steps: [
            { say: "rowan", text: "That's impressive." },
            { say: "livvie", text: "It's *arithmetic*. But — thank you." },
            AFF("livvie", 1, "Said so")
          ] },
          { text: "What's my deck worth, then?", steps: [
            { say: "rowan", text: "What's my deck worth, then?" },
            { say: "livvie", text: "Unsleeved, in a pocket you keep squeezing? Less every minute." },
            { say: "livvie", text: "I'd sleeve it for you. Two coins. That's cost and a bit, and I'll show you the bit." },
            AFF("livvie", 2, "Asked her price")
          ] },
          { text: "Did you ever keep any? Or was it all stock?", steps: [
            { say: "rowan", text: "Did you ever keep any? Or was it all stock?" },
            { say: "livvie", text: "…One box. The ones nobody'd buy." },
            { say: "livvie", text: "Turned out you can make a deck out of things nobody wants. Don't spread it about. They'll start wanting them." },
            AFF("livvie", 2, "Asked what she kept")
          ] }
        ] },
        { flag: "chat_livvie_1" },
        NOTE("livvie", "Has traded since she could count. Worked the till at a card shop that paid in cards."),
        { time: 3 }
      ] },
      { text: "I've a hundred and forty Smug Coins and no idea what a week costs. You look like someone who's worked it out.", when: (s)=>!s.flags["chat_livvie_3"], steps: [
        { say: "rowan", text: "I've a hundred and forty Smug Coins and no idea what a week costs. You look like someone who's worked it out." },
        { say: "livvie", text: "\"Ninety, if you eat the Commons breakfast. A hundred and ten if you don't. Plus sleeves.\" Fast, exact, almost relaxed. \"It's in the Handbook, page six. Nobody reads page six.\"" },
        { when: (s)=>(s.day===1 && s.minutes<645), say: "livvie", text: "I'm in the Commons myself. Bungalow three, with an Inya Bell and a Rana Marika, whoever they turn out to be." },
        { when: (s)=>!(s.day===1 && s.minutes<645), say: "livvie", text: "That's from before I knew the Commons meals were in the price, mind. Take twenty off. I'm still cross about the twenty, in a good way." },
        { when: (s)=>!!s.flags["met_inya"] && (s.day===1 && s.minutes<645), say: "rowan", text: "Inya Bell's the one at the card table. Bunny clip." },
        { when: (s)=>!!s.flags["met_inya"] && (s.day===1 && s.minutes<645), say: "livvie", text: "\"…The one who's been at the lad in gloves all morning.\" A pause, while a sum is done. \"Right. Earplugs. I'll price earplugs.\"" },
        { when: (s)=>!!s.flags["met_inya"] && (s.day===1 && s.minutes<645), flag: "rel_livvie_inya" },
        { choice: [
          { text: "Why do you know it to the coin?", steps: [
            { say: "rowan", text: "Why do you know it to the coin?" },
            { say: "livvie", text: "Because I've one year paid for, and the second's on me. Scholarship. I'd sooner know on the boat than find out in March." },
            { say: "livvie", text: "Don't do a face. It's a sum, not a sad story." },
            AFF("livvie", 2, "Asked, no pity"),
            NOTE("livvie", "Here on a one-year scholarship. Next year's fees are hers to find.")
          ] },
          { text: "That's worth something. What do I owe you for it?", when: (s)=>(s.coins||0)>=1, steps: [
            { say: "rowan", text: "That's worth something. What do I owe you for it?" },
            { say: "livvie", text: "\"…One coin.\" She sounds startled. \"Nobody asks. They just take it and say ta.\"" },
            { coins: -1 },
            { text: "You put a Smug Coin on the clipboard. She writes it into the column at once, and the column looks pleased." },
            { say: "livvie", text: "\"Transactions I can do.\" A very small, very real smile." },
            AFF("livvie", 3, "Paid for the advice")
          ] },
          { text: "Then I've thirty spare a week.", steps: [
            { say: "rowan", text: "Then I've thirty spare a week." },
            { say: "livvie", text: "You've thirty spare a week *if nothing goes wrong*. Call it ten. Things go wrong at about twenty a week. I've averaged it." },
            AFF("livvie", 1, "Did the sum with her")
          ] }
        ] },
        { flag: "chat_livvie_3" },
        NOTE("livvie", "A week costs about ninety Smug Coins with the Commons breakfast, a hundred and ten without. Lives in bungalow three."),
        { time: 3 }
      ] },
      { text: "You could trade anywhere. Why come all this way to design?", when: (s)=>!s.flags["chat_livvie_x"] && !!s.flags["livvie_said_design"], steps: [
        { say: "rowan", text: "You could trade anywhere. Why come all this way to design?" },
        { say: "livvie", text: "Because the best cards are designed by someone who's been hungry." },
        { say: "livvie", text: "You can tell. It's in the costs. A good cheap card, the kind that does exactly one thing well, was made by somebody who knew what one thing was worth." },
        { say: "rowan", text: "And a bad one?" },
        { say: "livvie", text: "\"Somebody who's never had to count.\" A small, sideways look. \"That's why I'm good. I've always had to count.\"" },
        { choice: [
          { text: "You said 'good'. Not 'might be'.", steps: [
            { say: "rowan", text: "You said 'good'. Not 'might be'." },
            { say: "livvie", text: "…I did, didn't I." },
            { say: "livvie", text: "I'd take it back, but it's said now, and I don't waste." },
            AFF("livvie", 2, "Heard her say 'good'")
          ] },
          { text: "Hungry as in — ?", steps: [
            { say: "rowan", text: "Hungry as in — ?" },
            { say: "livvie", text: "\"As in a figure of speech.\" A little too quickly. \"It's a design term. Ask anyone in a gold jacket.\"" }
          ] },
          { text: "Then I'd like to see the next one before it goes on a receipt.", steps: [
            { say: "rowan", text: "Then I'd like to see the next one before it goes on a receipt." },
            { say: "livvie", text: "\"It'll go on a receipt first. It always does.\" But she has written something small in the margin. \"I'll show you after. That's free. Don't get used to free.\"" },
            AFF("livvie", 2, "Wants to see her cards")
          ] }
        ] },
        { flag: "chat_livvie_x" },
        NOTE("livvie", "Says the best cheap cards are made by people who have had to count."),
        { time: 3 }
      ] },
      { text: "What do you play, for your five a side?", when: (s)=>!s.flags["deck_known_livvie"], steps: [
        { scene: "deck_livvie" }
      ] },
      { text: "I'll let you get back to your sums.", steps: [
        { say: "rowan", text: "I'll let you get back to your sums." },
        { say: "livvie", text: "They'll not have moved. But thank you. For asking things." },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_livvie_done" },
    { say: "livvie", text: "That's more than I usually give away for nothing. Don't go telling people. They'd all want some." },
    { end: true }
  ]
});

scene("deck_livvie", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_livvie"], end: true },
    { say: "rowan", text: "What do you play, for your five a side?" },
    { say: "livvie", text: "\"Crystal Gifts.\" Eyes down, and a small sideways look to see how it lands." },
    { say: "livvie", text: "Cooldin opens the Well on turn one. I give you a card a turn. It sits revealed in your hand, and it breaks something." },
    AFF("livvie", 1, "Asked about her deck"),
    { scene: "mutter_livvie" }
  ]
});

scene("mutter_livvie", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_livvie"], end: true },
    { text: "You have stopped looking at her. Your voice is flat and very fast." },
    { say: "rowan", text: "\"…Crystal Well. A gift a turn. Crystals break spell levels, shuffling, hero effects, until you pay to get rid of them. Letter of Misinformations takes the best two cards. Mary draws for every gift. Slow, Magic Amber, Spreading Rumor strip the rest of the hand. Laser Volley asks for what's left.\" A breath. \"No board. Heroes like glass.\"" },
    { say: "livvie", text: "\"…That's all of it.\" Her voice has gone quite small. \"Nobody has ever said all of it.\"" },
    { say: "rowan", text: "It's a gift economy. With teeth." },
    { say: "livvie", text: "\"…That's what I call it.\" A tiny, tired smile. \"Don't tell anyone I do.\"" },
    AFF("livvie", 2, "Knew her deck"),
    DECK("livvie")
  ]
});

scene("post_livvie", {
  steps: [
    DECK("livvie"),
    { when: (s)=>s.duels["ferry_livvie"] !== "won", jump: "lost" },
    { text: "Livvie counts the five Smug Coins out twice, each coin with great precision." },
    { say: "livvie", text: "Your Gathering Storm broke a Crystal I handed you. Did you notice?" },
    { say: "rowan", text: "I noticed. I played around the Well by not taking the first one. It cost me tempo." },
    { say: "livvie", text: "\"That's the intended counter.\" She looks, unexpectedly, impressed. \"Nobody works it out. They all take the gift.\"" },
    { jump: "after" },
    { label: "lost" },
    { text: "Livvie takes your five Smug Coins and then, half a second later, hands three of them back without looking at you." },
    { say: "livvie", text: "The Crystal Well gave you a Crystal on turn one, and you used it to break my own spell level." },
    { say: "rowan", text: "That was the whole plan. Turn your own present against you." },
    { say: "livvie", text: "\"Nobody does that.\" Eyes down. \"It was quite clever. Don't say I said so.\"" },
    { label: "after" },
    { choice: [
      { text: "Why build a deck that gives everything away?", steps: [
        { say: "rowan", text: "Why build a deck that gives everything away?" },
        { say: "livvie", text: "Because it's the only strategy I ever trusted. If I've handed it to you, I know exactly where it is." },
        { say: "livvie", text: "It's when people hand *me* things that I lose track." }
      ] },
      { text: "Same again some time?", steps: [
        { say: "rowan", text: "Same again some time?" },
        { say: "livvie", text: "\"Five a side.\" She has already written it down. \"You're in the column. That's a compliment; it's not a long column.\"" }
      ] }
    ] },
    AFF("livvie", 1, "Talked it through")
  ]
});

/* ───────────────────────── JUN-HO (new arrival) ───────────────────────── */
scene("ferry_junho", {
  steps: [
    { when: (s)=>!!s.flags["met_junho"], jump: "again" },
    { text: "Halfway along the window wall a boy in a gold jacket, its blue collar pressed perfectly flat, has propped a tablet against a row of five identical deck boxes. There is a stylus tucked behind his ear. He is not drawing. He is typing a line, deleting it, and typing it again." },
    { text: "Every so often he looks across at the brass plate on the card table, the way a doctor looks at a rash." },
    { say: "junho", alias: "Boy with a row of boxes", text: "Excuse me. You're the edge case." },
    { text: "He straightens the row of boxes, which was straight." },
    { say: "junho", alias: "Boy with a row of boxes", text: "I mean that precisely, not rudely. The plate on that table says WINNER STAYS. Two words. This morning they have been read four different ways, and one of the ways was you." },
    { choice: [
      { text: "I've been called worse today. What are you doing to it?", steps: [
        { say: "rowan", text: "I've been called worse today. What are you doing to it?" },
        { say: "junho", alias: "Boy with a row of boxes", text: "Rewriting it. Nobody asked me to. That is usually when a thing most needs it." }
      ] },
      { text: "Four ways? I only counted two.", steps: [
        { say: "rowan", text: "Four ways? I only counted two." },
        { say: "junho", alias: "Boy with a row of boxes", text: "One: the winner keeps the seat. Two: the winner chooses the next opponent. Three: the winner may name a stake. Four: the winner may name a condition, such as a person on the stairs." },
        { say: "junho", alias: "Boy with a row of boxes", text: "Only the first is in the text. The other three got in through the gap. So I am closing the gap." },
        AFF("junho", 1, "Counted with him")
      ] },
      { text: "It's a brass plate. It's been fine for years, hasn't it?", steps: [
        { say: "rowan", text: "It's a brass plate. It's been fine for years, hasn't it?" },
        { say: "junho", alias: "Boy with a row of boxes", text: "It has been *unchallenged* for years. That is a different measurement." },
        { say: "junho", alias: "Boy with a row of boxes", text: "This morning it was challenged, and it failed inside an hour. So I am rewriting it." }
      ] }
    ] },
    { text: "He turns the tablet round. It is a clean drawing of the plate: the same lettering, the same four screws, and more words." },
    { say: "junho", alias: "Boy with a row of boxes", text: "Version four. \"The winner keeps the seat. Whoever has waited longest plays next. Nothing is at stake unless both agree.\" Would you read it as the person it happened to?" },
    { choice: [
      { text: "'Whoever has waited longest.' Who decides that? There's no queue over there. Just people standing two deep.", steps: [
        { say: "rowan", text: "'Whoever has waited longest.' Who decides that? There's no queue over there. Just people standing two deep." },
        { text: "The stylus comes out from behind his ear so fast that it must have been waiting." },
        { say: "junho", alias: "Boy with a row of boxes", text: "Yes. *Yes.* That is a real hole." },
        { say: "junho", alias: "Boy with a row of boxes", text: "\"'…in the order they arrived, which each says aloud.'\" He types it. \"Version five. Thank you. That was specific. People are so rarely specific.\"" },
        AFF("junho", 3, "Gave a specific note"),
        { flag: "junho_v5" }
      ] },
      { text: "It's clear. I'd have known where I stood.", steps: [
        { say: "rowan", text: "It's clear. I'd have known where I stood." },
        { say: "junho", alias: "Boy with a row of boxes", text: "\"Clear.\" He looks at it for some time." },
        { say: "junho", alias: "Boy with a row of boxes", text: "It is also nine times as long, and nobody reads a long plate. So it is clear and it will fail. I don't yet know how to fix that." },
        AFF("junho", 1, "Read it properly")
      ] },
      { text: "It's good. I'd call that finished.", steps: [
        { say: "rowan", text: "It's good. I'd call that finished." },
        { say: "junho", alias: "Boy with a row of boxes", text: "\"…Finished.\" He says the word as if it were written in another alphabet." },
        { say: "junho", alias: "Boy with a row of boxes", text: "People say that. I have never found the place on a thing where it says so. But thank you. I can tell that you meant it." },
        AFF("junho", 2, "Said 'finished'")
      ] }
    ] },
    { say: "junho", alias: "Boy with a row of boxes", text: "Park Jun-ho. Game Design. Rare Hall, room one-oh-two." },
    MET("junho", "Park Jun-ho"),
    { say: "junho", text: "I should have opened with that. Patch one: name first, review second." },
    { say: "rowan", text: "Rowan Vance. No hall yet. No jacket, as you can see." },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "He's FIXING the TABLE! On a TABLET! Can you fix the STAIRS? They're too STEEP!" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "Just the sign, Nathan." },
    { add: { ferry_talked: 1 } },
    NOTE("junho", "Game Design, Rare Hall 102. Is rewriting the 'winner stays' plate on the card table, unasked."),
    { say: "junho", text: "May I give you one note in return? You may decline. I'm told I should say that part." },
    { choice: [
      { text: "Go on.", steps: [
        { say: "rowan", text: "Go on." },
        { say: "junho", text: "When he pointed at you, you put your hand on your left pocket, and you have put it back there eleven times since. Everyone can see which pocket matters. I would move the deck, or move the hand." },
        { text: "You take your hand off your pocket. You had not known it was there again." },
        { say: "junho", text: "That landed harder than I intended. I can't tell which part did it. Would you tell me?" },
        { choice: [
          { text: "It was useful. I just thought nobody had noticed.", steps: [
            { say: "rowan", text: "It was useful. I just thought nobody had noticed." },
            { say: "junho", text: "Everybody noticed. But I am one of very few who will tell you, so it will feel as though it is only me." },
            { say: "junho", text: "That is a known problem with feedback. I have not fixed it." },
            AFF("junho", 2, "Took the note")
          ] },
          { text: "The part where you counted. Eleven.", steps: [
            { say: "rowan", text: "The part where you counted. Eleven." },
            { say: "junho", text: "\"The number.\" He writes it down. \"I thought the number was the kind part. It shows I was paying attention.\"" },
            { say: "junho", text: "I see that it also shows I was paying attention. Thank you. That is the same fact from the other side; I had not walked round it." },
            AFF("junho", 2, "Told him which line")
          ] }
        ] }
      ] },
      { text: "Not today. I've had a whole room's notes already.", steps: [
        { say: "rowan", text: "Not today. I've had a whole room's notes already." },
        { say: "junho", text: "\"Understood.\" He writes something short. \"I have logged that you were asked. It will keep.\"" },
        AFF("junho", 1, "Was told plainly")
      ] }
    ] },
    { time: 7 },
    { end: true },
    { label: "again" },
    { when: (s)=>!!s.flags["junho_v5"], text: "The plate on his tablet has reached version seven. Your queue is still in it. He has put a small tick beside that line." },
    { when: (s)=>!s.flags["junho_v5"], text: "The plate on his tablet has reached version seven. The row of boxes is, if anything, straighter." },
    { say: "junho", text: "Rowan. Version seven. It is shorter than six. I think it is worse." },
    { choice: [
      { text: "Leave the plate a minute. I've a question about the boxes.", when: (s)=>!s.flags["chat_junho_done"], steps: [
        { say: "rowan", text: "Leave the plate a minute. I've a question about the boxes." },
        { say: "junho", text: "\"About the boxes.\" He looks genuinely pleased. \"Nobody has asked about the boxes. Please.\"" },
        { scene: "chat_junho" }
      ] },
      { text: "Then go back to six.", steps: [
        { say: "rowan", text: "Then go back to six." },
        { say: "junho", text: "\"Back.\" He considers this as an engineering proposal. \"I have never gone back. I'll try it and report.\"" }
      ] }
    ] },
    { time: 3 },
    { end: true }
  ]
});

scene("chat_junho", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_junho_1"] && !!s.flags["chat_junho_2"] && !!s.flags["chat_junho_3"] && !s.flags["chat_junho_done"], jump: "done" },
    { choice: [
      { text: "Five identical boxes. How do you tell them apart?", when: (s)=>!s.flags["chat_junho_1"], steps: [
        { say: "rowan", text: "Five identical boxes. How do you tell them apart?" },
        { say: "junho", text: "By the sleeves." },
        { text: "He opens them one after another, left to right. Red sleeves. Blue. Green. Yellow. The fifth box is full of clear ones." },
        { say: "junho", text: "Colour is function. Red removes things. Blue draws. Green makes resources. Yellow is whatever actually wins." },
        { choice: [
          { text: "And the clear ones?", steps: [
            { say: "rowan", text: "And the clear ones?" },
            { say: "junho", text: "Cards I have not classified." },
            { say: "junho", text: "It is the fullest box. I'm aware of what that suggests about the system." },
            AFF("junho", 1, "Asked about the fifth box")
          ] },
          { text: "What happens when a card does two things?", steps: [
            { say: "rowan", text: "What happens when a card does two things?" },
            { text: "A long pause. He closes the fifth box, carefully." },
            { say: "junho", text: "It goes in the clear box. Most good cards do two things. That is the fault in the system." },
            { say: "junho", text: "You found it in one question. It took me four versions. I would like to be annoyed and I find I'm mostly interested." },
            AFF("junho", 3, "Found the fault")
          ] },
          { text: "That's the tidiest thing I've seen all day.", steps: [
            { say: "rowan", text: "That's the tidiest thing I've seen all day." },
            { say: "junho", text: "Thank you. The first version had seven colours. It tested as a rainbow." },
            AFF("junho", 1, "Liked the system")
          ] }
        ] },
        { flag: "chat_junho_1" },
        NOTE("junho", "Sleeves his cards by what they do: red removes, blue draws, green makes resources, yellow wins. The clear box, for cards he can't classify, is the fullest."),
        { time: 3 }
      ] },
      { text: "Do you hand a note to everyone you've just met?", when: (s)=>!s.flags["chat_junho_2"], steps: [
        { say: "rowan", text: "Do you hand a note to everyone you've just met?" },
        { say: "junho", text: "Yes." },
        { say: "junho", text: "It is the kindest thing I know how to do. It means somebody has looked at you closely enough to find the one thing that is off. Nobody does that for a stranger. So I do." },
        { say: "junho", text: "My mother runs a cram school in Seoul. Report cards were read aloud at dinner. All of them, the good lines as well. People leave that part out when they retell it." },
        { choice: [
          { text: "And did it feel kind? At dinner?", steps: [
            { say: "rowan", text: "And did it feel kind? At dinner?" },
            { text: "He becomes, quite suddenly, shorter and stiffer, like a sentence with the adjectives taken out." },
            { say: "junho", text: "It felt attended to." },
            { say: "junho", text: "I would need to think about 'kind'. I will think about it." },
            AFF("junho", 2, "Asked the real question")
          ] },
          { text: "Then here's one back: say the good line first.", steps: [
            { say: "rowan", text: "Then here's one back: say the good line first." },
            { say: "junho", text: "\"Good line first.\" The stylus is already moving. \"That is implementable.\"" },
            { say: "junho", text: "You came down those stairs into a room that was staring at you, and you didn't leave. I should have led with that." },
            AFF("junho", 3, "Gave him a note")
          ] },
          { text: "Most people will only hear the criticism.", steps: [
            { say: "rowan", text: "Most people will only hear the criticism." },
            { say: "junho", text: "Yes. I have noticed the faces. I can't always tell which sentence did it." },
            { say: "junho", text: "If I do it to you again, would you say? Plainly. I do better with plainly." },
            { say: "rowan", text: "I'll say." },
            AFF("junho", 1, "Promised to say")
          ] }
        ] },
        { flag: "chat_junho_2" },
        NOTE("junho", "Believes a specific note is the kindest thing one person can give another. His mother runs a cram school in Seoul."),
        { time: 3 }
      ] },
      { text: "Room one-oh-two. Do you know who you're sharing with?", when: (s)=>!s.flags["chat_junho_3"], steps: [
        { say: "rowan", text: "Room one-oh-two. Do you know who you're sharing with?" },
        { say: "junho", text: "A Teobalt. The letter gave a name and nothing else, which makes it an under-specified letter." },
        { say: "junho", text: "I have drafted a shared document for the room. Headings only. It would be presumptuous to fill them in before he has seen them." },
        { choice: [
          { text: "What are the headings?", steps: [
            { say: "rowan", text: "What are the headings?" },
            { say: "junho", text: "Light. Noise. Shelves. Feedback." },
            { say: "junho", text: "Feedback is the long one. I would like him to like it. The document." },
            { text: "He straightens the boxes." },
            { say: "junho", text: "Him also." },
            AFF("junho", 2, "Asked for the headings")
          ] },
          { text: "I've met a Teobalt on this ship. He carries a clipboard.", when: (s)=>!!s.flags["met_teobalt"], steps: [
            { say: "rowan", text: "I've met a Teobalt on this ship. He carries a clipboard." },
            { say: "junho", text: "A clipboard." },
            { text: "Something in the line of his shoulders eases by about two millimetres." },
            { say: "junho", text: "Paper. That is compatible. I can work with paper." },
            { flag: "rel_junho_teobalt" },
            AFF("junho", 2, "Brought good news")
          ] },
          { text: "What if he just wants to unpack and go to sleep?", steps: [
            { say: "rowan", text: "What if he just wants to unpack and go to sleep?" },
            { say: "junho", text: "Then that goes under Noise." },
            { say: "junho", text: "…I see. You mean he may not want a document at all. I had not considered a version zero." },
            AFF("junho", 1, "Thought of version zero")
          ] }
        ] },
        { flag: "chat_junho_3" },
        NOTE("junho", "Has drafted a shared document for his room before meeting his roommate, a Teobalt. Headings only."),
        { time: 3 }
      ] },
      { text: "A painter down the bench says a boy put the lids back on all her jars.", when: (s)=>!!s.flags["eloise_said_lids"] && !s.flags["chat_junho_4"], steps: [
        { say: "rowan", text: "A painter down the bench says a boy put the lids back on all her jars." },
        { say: "junho", text: "They were open. On a ship. The floor is not level and has not been since the harbour." },
        { say: "junho", text: "I looked at the painting first. For some time. I had no notes." },
        { say: "junho", text: "That has not happened before. So I did the lids." },
        { flag: "chat_junho_4" },
        NOTE("junho", "Looked at Eloise's painting for some time and had no notes. Put the lids back on her jars instead."),
        { time: 2 }
      ] },
      { text: "I'll let you get back to the plate.", steps: [
        { say: "rowan", text: "I'll let you get back to the plate." },
        { say: "junho", text: "Thank you. If you think of a shorter word for 'longest', I am on this bench until the dock." },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_junho_done" },
    { say: "junho", text: "That was a good review. I mean, a good conversation. I am still learning to tell the two apart." },
    { end: true }
  ]
});

/* ───────────────────────── ELOISE (new arrival) ───────────────────────── */
scene("ferry_eloise", {
  steps: [
    { when: (s)=>!!s.flags["met_eloise"], jump: "again" },
    { text: "One of the big windows has been propped open on its latch, and the cold comes in carrying a smell that is not the sea. Turpentine." },
    { text: "Under it a girl in a wine-red beret is kneeling on the bench, because the sketchbook open in front of her is too big to share a bench with anyone sitting down. There is dried paint in her long honey-brown hair. She has a brush in one hand and, forgotten in the other, the lid of a jar." },
    { text: "She has her back to the island. She is painting the saloon: the green of the table, and round it the people, two deep, as stripes of red and gold and black." },
    { say: "eloise", alias: "Girl in a red beret", text: "Don't — no. Stay. Right there, where the window does that to your ear." },
    { choice: [
      { text: "Stand still.", steps: [
        { text: "You stand still. It is the first thing anyone has asked of you this morning that you know how to do." },
        { text: "The brush moves. The engine hums. A gull goes past the open window, complaining. You have no idea how long it is." },
        { say: "eloise", alias: "Girl in a red beret", text: "There. You can have your ear back." },
        AFF("eloise", 2, "Stood still for her")
      ] },
      { text: "My ear?", steps: [
        { say: "rowan", text: "My ear?" },
        { say: "eloise", alias: "Girl in a red beret", text: "It's gone pink at the top and sort of gold through the middle. The light's coming *through* it. — And now you've turned, and it's just an ear." },
        { say: "eloise", alias: "Girl in a red beret", text: "\"That's all right.\" She is not cross. She is already painting. \"I got most of it.\"" }
      ] },
      { text: "How long do you need? I'm not good at being looked at.", steps: [
        { say: "rowan", text: "How long do you need? I'm not good at being looked at." },
        { say: "eloise", alias: "Girl in a red beret", text: "Oh, nobody's looking at *you*, honey. I'm looking at what the light's doing. You're only where it's happening." },
        { text: "It is, somehow, the most restful thing anybody has said to you since the harbour. You stay where the light is happening until the brush lifts." },
        AFF("eloise", 1, "Stayed anyway")
      ] }
    ] },
    { text: "She turns the huge book a little towards you. In the corner, by a few slanting lines that must be the stairs, there is a smear of grey-green among all the jacket colours, with one pink-gold dot for an ear." },
    { say: "eloise", alias: "Girl in a red beret", text: "That's you. You were the only thing in here that wasn't red or gold or black. I had to mix you specially." },
    { choice: [
      { text: "That's how the stairs felt. Everyone a colour, and me the wrong one.", steps: [
        { say: "rowan", text: "That's how the stairs felt. Everyone a colour, and me the wrong one." },
        { text: "She looks at you, properly, for the first time: faraway brown eyes that have, briefly, arrived." },
        { say: "eloise", alias: "Girl in a red beret", text: "Not wrong. *Unmixed.* They all came out of tubes. You I had to make." },
        { say: "eloise", alias: "Girl in a red beret", text: "That's what I was going to tell you, I think. That, or something about your shoes." },
        AFF("eloise", 3, "Said what it felt like")
      ] },
      { text: "You've made the boy in gloves the same white as the wall.", steps: [
        { say: "rowan", text: "You've made the boy in gloves the same white as the wall." },
        { say: "eloise", alias: "Girl in a red beret", text: "He *is* the wall. Look, everybody's bouncing off him." },
        { say: "eloise", alias: "Girl in a red beret", text: "Oh, I like that you saw that. People mostly hunt for themselves and stop." },
        AFF("eloise", 2, "Looked properly")
      ] },
      { text: "What's it supposed to be?", steps: [
        { say: "rowan", text: "What's it supposed to be?" },
        { text: "The brush stops. When she speaks again the drift has gone out of her voice entirely." },
        { say: "eloise", alias: "Girl in a red beret", text: "It isn't supposed to *be*. It's what the room is doing. Look again and tell me what it's doing. I'll wait." },
        { say: "rowan", text: "…It's leaning. All of it. Everything's leaning in at the table." },
        { say: "eloise", alias: "Girl in a red beret", text: "\"There.\" The drift comes back, like weather. \"You can see fine when you bother.\"" }
      ] }
    ] },
    { say: "eloise", alias: "Girl in a red beret", text: "I'm Eloise. Lafayette. Rare Hall, I believe. It's written on my hand." },
    { text: "She turns her hand over. It is written on her hand, in blue paint: R 201." },
    MET("eloise", "Eloise Lafayette"),
    { say: "eloise", text: "And you're — ?" },
    { say: "rowan", text: "Rowan." },
    { say: "eloise", text: "Rowan. That's a brown-red, like the berry. I'll keep that. I'm better at keeping colours." },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "She painted you GREEN, Rowan! Am I in it? Which one's ME?" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "By the stairs. It's good." },
    { add: { ferry_talked: 1 } },
    NOTE("eloise", "Game Design, Rare Hall 201. Paints the saloon as colours; painted you grey-green, mixed specially."),
    { say: "eloise", text: "A boy came by before and put all my lids back on. Every one. Neat boy, pen behind his ear. He never said a word, he only looked so relieved." },
    { text: "She looks at the lid in her left hand as if somebody had just handed it to her." },
    { say: "eloise", text: "He missed this one." },
    { flag: "eloise_said_lids" },
    { time: 7 },
    { end: true },
    { label: "again" },
    { text: "The painting has more people in it now. You are still grey-green. The ear has been allowed to stay." },
    { say: "eloise", text: "Oh — the berry. Rowan. See, I kept it." },
    { choice: [
      { text: "Have you got a minute? I'll stand wherever you like.", when: (s)=>!s.flags["chat_eloise_done"], steps: [
        { say: "rowan", text: "Have you got a minute? I'll stand wherever you like." },
        { say: "eloise", text: "Stand there, then. No. Half a step left. There. Now you can talk." },
        { scene: "chat_eloise" }
      ] },
      { text: "Just passing. Mind your jars.", steps: [
        { say: "rowan", text: "Just passing. Mind your jars." },
        { say: "eloise", text: "\"Mm?\" She looks at the jars as if they had been mentioned in a letter. \"Oh. Yes. Them.\"" }
      ] }
    ] },
    { time: 3 },
    { end: true }
  ]
});

scene("chat_eloise", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_eloise_1"] && !!s.flags["chat_eloise_2"] && !!s.flags["chat_eloise_3"] && !s.flags["chat_eloise_done"], jump: "done" },
    { choice: [
      { text: "Everyone else at a window is looking at the island. You've got your back to it.", when: (s)=>!s.flags["chat_eloise_1"], steps: [
        { say: "rowan", text: "Everyone else at a window is looking at the island. You've got your back to it." },
        { say: "eloise", text: "I did the island already." },
        { text: "She turns back one enormous page. The island fills it edge to edge, dark and steep, far too big for the paper. Out of the real window it is still a small blue shape on the line of the sea." },
        { say: "eloise", text: "\"That's how big it is. Not out there. Out there it's a thumbnail. *In here.*\" She taps her chest with the brush and leaves a mark on her jacket that she does not notice." },
        { say: "eloise", text: "I paint what a thing's doing, not what it looks like. That one's pulling. Everybody on this boat is leaning at it and pretending they aren't." },
        { choice: [
          { text: "It makes my stomach drop a little.", steps: [
            { say: "rowan", text: "It makes my stomach drop a little." },
            { say: "eloise", text: "*Yes.* Good. That's it working. Don't ever tell me what one's of. Tell me that." },
            AFF("eloise", 2, "Said what it did to him")
          ] },
          { text: "And what's it doing to you?", steps: [
            { say: "rowan", text: "And what's it doing to you?" },
            { say: "eloise", text: "…Oh. Nobody turns it round." },
            { say: "eloise", text: "It's the first place I've ever gone that my mama didn't paint first. So it's very loud, and it's that —" },
            { text: "She has stopped. She is staring past your shoulder at the water." },
            { say: "eloise", text: "Viridian. Just there, under the foam. — No. It's gone. It was viridian." },
            AFF("eloise", 3, "Turned the question round")
          ] },
          { text: "It doesn't look like that, though.", steps: [
            { say: "rowan", text: "It doesn't look like that, though." },
            { say: "eloise", text: "No. Looking-like is a camera's job, and a camera's welcome to it." },
            { say: "eloise", text: "You'll see. When we get close it'll be exactly this big, and you'll think of me, and be cross." }
          ] }
        ] },
        { flag: "chat_eloise_1" },
        NOTE("eloise", "Paints what a thing is doing, not what it looks like. Her island fills the whole page: \"it's pulling.\""),
        { time: 3 }
      ] },
      { text: "That sketchbook doesn't fit the bench. Don't they make smaller ones?", when: (s)=>!s.flags["chat_eloise_2"], steps: [
        { say: "rowan", text: "That sketchbook doesn't fit the bench. Don't they make smaller ones?" },
        { say: "eloise", text: "They do. I can't see anything in them." },
        { say: "eloise", text: "My grandmother painted shop signs, and my mama paints carnival floats. New Orleans. I learned on things you're meant to read from across the street with a crowd in the way." },
        { say: "eloise", text: "Small is hard. Small is what I came for." },
        { choice: [
          { text: "You came here for small?", steps: [
            { say: "rowan", text: "You came here for small?" },
            { say: "eloise", text: "Cards. A card is a very small door. I paint mine big first, so I can see what's on the other side, and then somebody has to get all of it down to *that*." },
            { text: "She holds up finger and thumb, a card's width apart, and looks at the gap with real mistrust." },
            { say: "eloise", text: "That somebody's meant to be me. It's the part I can't do yet." },
            AFF("eloise", 2, "Asked what she came for")
          ] },
          { text: "A float's a long way from a ferry bench.", steps: [
            { say: "rowan", text: "A float's a long way from a ferry bench." },
            { say: "eloise", text: "A float's only a painting that goes past you, instead of you going past it." },
            { say: "eloise", text: "\"This is the first time I've been the one going past.\" She sounds quietly delighted by it. \"I keep waving at things.\"" },
            AFF("eloise", 1, "Got her talking of home")
          ] },
          { text: "Do you miss it?", steps: [
            { say: "rowan", text: "Do you miss it?" },
            { say: "eloise", text: "I keep meaning to. I get as far as the colour of the house, and then I'm painting the colour of the house." },
            AFF("eloise", 1, "Asked after home")
          ] }
        ] },
        { flag: "chat_eloise_2" },
        NOTE("eloise", "From New Orleans: her mother paints carnival floats, her grandmother painted shop signs. Came to learn to paint small."),
        { time: 3 }
      ] },
      { text: "Your room's written on your hand. Is that so it can't get lost?", when: (s)=>!s.flags["chat_eloise_3"], steps: [
        { say: "rowan", text: "Your room's written on your hand. Is that so it can't get lost?" },
        { say: "eloise", text: "I lose the ends of things. Sentences. Mornings. I had the letter, and then I didn't, so before it went I copied the room on." },
        { say: "eloise", text: "It said who I'm sharing with, too. Marit. I didn't write that down, I just kept it. It's an orange sort of word." },
        { choice: [
          { text: "Shall I come and tell you when we're nearly in? I've nothing but time on this boat.", steps: [
            { say: "rowan", text: "Shall I come and tell you when we're nearly in? I've nothing but time on this boat." },
            { say: "eloise", text: "Would you? Don't say it like a bell. People say it like a bell." },
            { say: "eloise", text: "Just come and stand where you were standing. I'll know." },
            AFF("eloise", 3, "Offered to keep the time"),
            { flag: "eloise_time_promise" }
          ] },
          { text: "I've met a Marit on this boat. She's loud.", when: (s)=>!!s.flags["met_marit"], steps: [
            { say: "rowan", text: "I've met a Marit on this boat. She's loud." },
            { say: "eloise", text: "Loud's good. Loud is nearly always a warm colour." },
            { say: "eloise", text: "I'll paint her before I meet her and see if I was right. I'm usually right about orange." },
            { flag: "rel_eloise_marit" },
            AFF("eloise", 2, "Brought her a colour")
          ] },
          { text: "What colour's 'Eloise'?", steps: [
            { say: "rowan", text: "What colour's 'Eloise'?" },
            { say: "eloise", text: "Oh, I can't see my own. It's like trying to look at your own eye." },
            { say: "eloise", text: "It felt grey this morning, coming up the gangway. Grey-green. That might be why I noticed you." },
            AFF("eloise", 2, "Asked for her colour")
          ] }
        ] },
        { flag: "chat_eloise_3" },
        NOTE("eloise", "Loses the ends of sentences and mornings; writes what matters on her hand. Her roommate is a Marit, \"an orange sort of word\"."),
        { time: 3 }
      ] },
      { text: "I'll let you get back to the room.", steps: [
        { say: "rowan", text: "I'll let you get back to the room." },
        { say: "eloise", text: "Mm. — Mind the jar. Not that one. The one I haven't put down yet." },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_eloise_done" },
    { say: "eloise", text: "I was going to say something else. It's gone. It was mostly blue." },
    { say: "eloise", text: "Come back anyway. You hold still nicely." },
    { end: true }
  ]
});

/* ───────────────────────── ISLAND, day 1 afternoon ───────────────────────── */
scene("isle_magnus", {
  steps: [
    { when: (s)=>!!s.flags["isle_magnus_done"], jump: "again" },
    { text: "Four small white domes stand in a row at the end of the lawn. The white-and-gold collars are waiting for their names in the one strip of shade, in a clump. One of them is not in the shade. He is standing in full sun, where he can see all four doors at once, with a tablet in the crook of his arm." },
    { text: "A door opens. Somebody comes out. His thumb comes down. His sneakers are very white, and the grass has not got to them yet." },
    { when: (s)=>!!s.flags["met_magnus"], jump: "known" },
    { say: "magnus", alias: "Boy with a tablet", text: "\"Vance.\" He does not look up. \"Fifth. I'm sixth. Prospero_GG.\"" },
    { say: "rowan", text: "…The ladder. You're off the online ladder." },
    { say: "magnus", alias: "Boy with a tablet", text: "Magnus Prospero. Two years one row beneath you. Forty-one losses to you, on file. You never typed a word, so I don't expect the name to mean anything." },
    MET("magnus", "Magnus Prospero"),
    NOTE("magnus", "Prospero_GG: ranked one place below you on the online ladder for two years. Has forty-one losses to you on file."),
    { say: "magnus", text: "I had a speech prepared for the ferry. You did not come past. I have decided not to give it on a lawn." },
    { jump: "beat" },
    { label: "known" },
    { say: "magnus", text: "\"Vance.\" The thumb comes down on something. \"Dome three averages fourteen minutes. Dome one, nine. I am drawn for three.\"" },
    { when: (s)=>!!s.flags["magnus_knows_no_table"] && !s.flags["placement_done"], say: "magnus", text: "Your first real table is in one of those. I should like it on record that I was told before anyone." },
    { when: (s)=>!!s.flags["beat_magnus"], say: "magnus", text: "The ferry did not count. This counts. I mention it for completeness." },
    { label: "beat" },
    { say: "magnus", text: "Have you stood under the board on the Quad? A hundred and forty-four names, on flaps. When a rank changes, it *clatters*. Online it only blinks." },
    { say: "magnus", text: "I stood under it for twenty minutes. I should like to be the reason it makes that noise." },
    { choice: [
      { text: "You will be. Probably before supper.", steps: [
        { say: "rowan", text: "You will be. Probably before supper." },
        { say: "magnus", text: "\"Probably is not a —\" He stops himself, which looks like an effort. \"Thank you. I'll note that you said it before the result.\"" },
        AFF("magnus", 1, "Said it beforehand")
      ] },
      { text: "You're nervous.", steps: [
        { say: "rowan", text: "You're nervous." },
        { say: "magnus", text: "I am *calibrating*." },
        { text: "A door opens. He forgets to log it." },
        { say: "magnus", text: "My hands are cold. It is thirty degrees in the shade. Yes. I have entered that as nervous." },
        AFF("magnus", 2, "Saw it and stayed"),
        NOTE("magnus", "Was nervous before his placement duel, and logged it.")
      ] },
      { text: "I've had mine already.", when: (s)=>!!s.flags["placement_done"], steps: [
        { say: "rowan", text: "I've had mine already." },
        { when: (s)=>!!s.flags["placement_won"], say: "magnus", text: "I know. I logged the door. You came out and did not look pleased. Nobody who wins looks like that. You will explain it to me some time." },
        { when: (s)=>!s.flags["placement_won"], say: "magnus", text: "I know. I logged the door. I did not log the result. I looked at it. I did not log it." },
        AFF("magnus", 1, "Told him himself")
      ] }
    ] },
    { flag: "isle_magnus_done" },
    { time: 5 },
    { when: (s)=>!!s.flags["chat_magnus_done"], end: true },
    { choice: [
      { text: "While you're waiting: can I ask you something?", steps: [
        { say: "rowan", text: "While you're waiting: can I ask you something?" },
        { say: "magnus", text: "Ask. It will keep my hands busy. Do not tell anyone I said that either." },
        { scene: "chat_magnus" }
      ] },
      { text: "Leave him to the doors.", steps: [
        { text: "You leave him in the sun. Behind you a door opens, and the thumb comes down." }
      ] }
    ] },
    { end: true },
    { label: "again" },
    { say: "magnus", text: "Dome three is now averaging thirteen. That is everything I have." },
    { when: (s)=>!s.flags["chat_magnus_done"], choice: [
      { text: "Then spare me a question while the doors are shut.", steps: [
        { say: "rowan", text: "Then spare me a question while the doors are shut." },
        { scene: "chat_magnus" }
      ] },
      { text: "Good luck in there.", steps: [
        { say: "rowan", text: "Good luck in there." },
        { say: "magnus", text: "Luck is a rate. But thank you. I'll take the rate." }
      ] }
    ] },
    { time: 2 }
  ]
});

scene("isle_noor", {
  steps: [
    { when: (s)=>!!s.flags["isle_noor_done"], jump: "again" },
    { text: "The library closes the north end of the Quad like the last word of an argument: white steps, a deep arcade, and shade. Halfway up the steps, exactly in the middle, a girl in a blue hijab and a red jacket is reading a heavy blue book bristling with pencil tabs." },
    { text: "The lawn below her is all noise and blankets. Nobody has sat within two steps of her." },
    { when: (s)=>!!s.flags["met_noor"], jump: "known" },
    { say: "noor", alias: "Girl with a rulebook", text: "Mr Vance. The entrant in ink." },
    { say: "noor", alias: "Girl with a rulebook", text: "You are standing in my light. I mention it only so that you will know my expression is not hostility. It is shade." },
    { say: "rowan", text: "Sorry. Rowan. You heard the roll call, then." },
    { say: "noor", alias: "Girl with a rulebook", text: "I read the list on the ferry, twice. Noor Al-Sayed. Rare Hall. This is the Academy Charter; I wrote to the registrar for it in March." },
    MET("noor", "Noor Al-Sayed"),
    NOTE("noor", "Reads the Academy Charter for pleasure. Wrote to the registrar for her copy months before term."),
    { jump: "beat" },
    { label: "known" },
    { text: "She marks her place with the pencil before she looks up." },
    { say: "noor", text: "Rowan. There is rather more than half a metre here, if you want it. Stone is cooler than it looks." },
    { when: (s)=>!!s.flags["ferry_table_settled"], say: "noor", text: "I have told my roommate about your table twice. A duffel bag and a rolled jacket. She asked whether it was regulation. I said that it was better than regulation; it was not forbidden." },
    { label: "beat" },
    { say: "noor", text: "Did you notice what the Chancellor said? Every conflict on this island may be settled at a table. \"There are no exceptions.\"" },
    { say: "noor", text: "Article seven has two. I have checked the text against her sentence three times since the Quad." },
    { choice: [
      { text: "So the Chancellor got her own Charter wrong?", steps: [
        { say: "rowan", text: "So the Chancellor got her own Charter wrong?" },
        { say: "noor", text: "I do not think that she gets things wrong. I think she said it to see who would go and look." },
        { say: "noor", text: "\"I went and looked.\" A very faint, very dry smile. \"I am aware of what that makes me.\"" },
        AFF("noor", 1, "Followed the argument")
      ] },
      { text: "What are the two exceptions?", steps: [
        { say: "rowan", text: "What are the two exceptions?" },
        { say: "noor", text: "You will be given your own copy tomorrow. Read article seven, and then come and tell me. I would rather be checked than believed." },
        { say: "rowan", text: "And if I only find one?" },
        { say: "noor", text: "Then you will have read it more carefully than most of the staff, and I shall show you the other." },
        AFF("noor", 2, "Agreed to check her"),
        { flag: "noor_article_seven_homework" }
      ] },
      { text: "Will you tell her?", steps: [
        { say: "rowan", text: "Will you tell her?" },
        { say: "noor", text: "If she asks. I have a feeling that she is a person who asks." }
      ] }
    ] },
    { say: "noor", text: "Rare Hall, since you have not asked, has eleven house rules framed in the entrance. Two of them contradict each other. I have been on this island for three hours and I am already owed a letter." },
    { say: "noor", text: "My roommate unpacks by throwing. We get on absurdly well. I cannot account for it, and I have stopped trying." },
    { flag: "isle_noor_done" },
    NOTE("noor", "Noticed that the Chancellor's \"no exceptions\" is contradicted by article seven, which has two."),
    { time: 5 },
    { when: (s)=>!!s.flags["chat_noor_1"] && !!s.flags["chat_noor_2"] && !!s.flags["chat_noor_3"], end: true },
    { choice: [
      { text: "May I ask you something that isn't in the book?", steps: [
        { say: "rowan", text: "May I ask you something that isn't in the book?" },
        { say: "noor", text: "Then it is the more interesting kind. Please." },
        { scene: "chat_noor" }
      ] },
      { text: "Leave her to the shade.", steps: [
        { say: "noor", text: "Thank you. Mind the third step. It is loose. I have reported it." }
      ] }
    ] },
    { end: true },
    { label: "again" },
    { text: "She has moved one step higher, following the shade. The pencil has moved four tabs on." },
    { say: "noor", text: "Rowan. The step is still free. I find that people on this island walk round a person who is reading; I had expected to have to ask." },
    { when: (s)=>!(s.flags["chat_noor_1"] && s.flags["chat_noor_2"] && s.flags["chat_noor_3"]), choice: [
      { text: "Sit down and ask her something.", steps: [
        { scene: "chat_noor" }
      ] },
      { text: "Leave her to it.", steps: [
        { text: "You go back down into the noise. Behind you a page turns, exactly once." }
      ] }
    ] },
    { time: 2 }
  ]
});

scene("isle_livvie", {
  steps: [
    { when: (s)=>!!s.flags["isle_livvie_done"], jump: "again" },
    { text: "Bungalow three has a number painted on its doorpost, a step, and on the step a very pale girl with a violet-black bob and two cyan hair clips, doing sums on a clipboard. Her gold jacket is folded beside her with the mended elbows turned inwards. Through the open window behind her a radio is playing to nobody." },
    { when: (s)=>!!s.flags["met_livvie"], jump: "known" },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"You're Vance. Bungalow seven.\" Eyes down. \"Don't be alarmed. I've got everyone down. It's not personal, it's a column.\"" },
    { say: "rowan", text: "Rowan. What's the column for?" },
    { say: "livvie", alias: "Girl with a clipboard", text: "Who's where, and what they've got that they'll swap. Livvie Thana. I trade. I run lists. I play, five a side. Sorry — I ought to have said that first, it sounds better in that order." },
    MET("livvie", "Livvie Thana"),
    { jump: "beat" },
    { label: "known" },
    { say: "livvie", text: "\"Rowan.\" She moves the folded jacket an inch, which makes room on the step. \"I've had to redo the whole week.\"" },
    { when: (s)=>!!s.flags["livvie_fed"], say: "livvie", text: "We're square for the roll, by the way. I checked the column. You're allowed to sit down without it costing anything." },
    { label: "beat" },
    { say: "livvie", text: "The breakfast in bungalow one's *free*. And the supper. I asked the lady what the catch was, and she gave me a second plate and told me to sit." },
    { say: "livvie", text: "I'd worked a week out at ninety coins. It's seventy. I've been twenty a week wrong since March. I've never been so pleased to be wrong, and I don't like it; I keep adding it up again in case it stops." },
    { choice: [
      { text: "What'll you do with the twenty?", steps: [
        { say: "rowan", text: "What'll you do with the twenty?" },
        { say: "livvie", text: "Not spend it. That's the whole use of it." },
        { say: "livvie", text: "I've one year here paid for, and the next one's on me. Twenty a week's the first number all day that's gone the right way." },
        AFF("livvie", 1, "Asked about the sum"),
        NOTE("livvie", "Here on a one-year scholarship. Next year's fees are hers to find.")
      ] },
      { text: "And the second plate? Did you eat it?", steps: [
        { say: "rowan", text: "And the second plate? Did you eat it?" },
        { say: "livvie", text: "…I had some." },
        { say: "livvie", text: "\"I had most of some. She *watched*.\" A small sideways look. \"It's very hard to not eat at that woman. I'll have to budget for it.\"" }
      ] },
      { text: "Is the bungalow all right?", steps: [
        { say: "rowan", text: "Is the bungalow all right?" },
        { say: "livvie", text: "It's dry. It's got a door that shuts and a window that opens, and they both do what they say. I've had worse. I've *priced* worse." },
        { say: "livvie", text: "Inya's got a radio and Rana's got a face on. I've the bunk by the window. I didn't ask for it; they'd left it, so I think that was them being nice. I've written it down as nice." },
        AFF("livvie", 1, "Asked after her, not her prices"),
        { flag: "rel_livvie_inya" }
      ] }
    ] },
    { when: (s)=>!s.flags["placement_done"], say: "livvie", text: "They call the Commons at half one, for the domes. I've no idea what I'm worth in there. It's the first thing all day I can't put a number on." },
    { when: (s)=>!!s.flags["placement_done"], say: "livvie", text: "I've done my dome. I'm not saying how. I've put it in the column in pencil." },
    { flag: "isle_livvie_done" },
    NOTE("livvie", "Found out the Commons meals are free: a week now costs her seventy Smug Coins, not ninety."),
    { time: 5 },
    { when: (s)=>!!s.flags["chat_livvie_done"], end: true },
    { choice: [
      { text: "Can the clipboard spare you for a question?", steps: [
        { say: "rowan", text: "Can the clipboard spare you for a question?" },
        { say: "livvie", text: "It can. It's only saying seventy over and over. Go on." },
        { scene: "chat_livvie" }
      ] },
      { text: "Leave her to the seventy.", steps: [
        { text: "You leave her on the step. The pencil goes down the column again, from the top." }
      ] }
    ] },
    { end: true },
    { label: "again" },
    { say: "livvie", text: "\"Still seventy.\" She does not look up. \"I keep checking. It keeps being seventy.\"" },
    { when: (s)=>!s.flags["chat_livvie_done"], choice: [
      { text: "Then you've time for a question.", steps: [
        { say: "rowan", text: "Then you've time for a question." },
        { scene: "chat_livvie" }
      ] },
      { text: "I'll leave you to check it again.", steps: [
        { say: "rowan", text: "I'll leave you to check it again." },
        { say: "livvie", text: "Ta. I will." }
      ] }
    ] },
    { time: 2 }
  ]
});

scene("isle_junho", {
  steps: [
    { when: (s)=>!!s.flags["isle_junho_done"], jump: "again" },
    { text: "The fountain on the Quad is a bronze figure flinging a spray of bronze cards, with the water jumping from card to card. On its rim sits a boy in a gold jacket with the blue collar pressed flat, a stylus behind his ear, a tablet on his knee, and beside him, in a perfectly straight row, five identical deck boxes." },
    { text: "He is not looking at the fountain. He is looking the length of the lawn at the ladder board under the clock tower, and frowning at it the way you frown at a sum." },
    { when: (s)=>!!s.flags["met_junho"], jump: "known" },
    { say: "junho", alias: "Boy with a row of boxes", text: "Excuse me. Vance, from the roll call. If your name were on that board, how long would it take you to find it?" },
    { say: "rowan", text: "I don't know. Is that a thing people time?" },
    { say: "junho", alias: "Boy with a row of boxes", text: "I have timed six. Park Jun-ho. Game Design, Rare Hall. I should have opened with that. Patch one: name first, question second." },
    MET("junho", "Park Jun-ho"),
    { jump: "beat" },
    { label: "known" },
    { say: "junho", text: "Rowan. The plate reached version nine on the gangway. I left it with the captain. He said \"right\", and put it in his pocket." },
    { when: (s)=>!!s.flags["junho_v5"], say: "junho", text: "Your queue line was still in it. It was the only sentence that survived from five to nine." },
    { say: "junho", text: "I have found something else." },
    { label: "beat" },
    { say: "junho", text: "The board. A hundred and forty-four names, in rank order and no other. To find yourself on it you must already know how good you are." },
    { say: "junho", text: "That is a strange thing to require of a new student. I am drafting an index by surname. It would hang underneath." },
    { choice: [
      { text: "Maybe making you look is the point.", steps: [
        { say: "rowan", text: "Maybe making you look is the point." },
        { say: "junho", text: "Yes. I considered that it might be deliberate." },
        { say: "junho", text: "A thing can be deliberate and still unkind. I shall finish the index anyway. I shan't submit it. I'll just have it." },
        AFF("junho", 2, "Argued with the design")
      ] },
      { text: "I'll be easy to find. Start at the bottom.", steps: [
        { say: "rowan", text: "I'll be easy to find. Start at the bottom." },
        { say: "junho", text: "That is efficient. I think it was also a joke with something under it. I can't tell what. You needn't say." },
        { say: "junho", text: "For reference: the bottom is the only position on a list from which every change is an improvement. I find that restful to think about. I have never been allowed to try it." },
        AFF("junho", 2, "Let him see under the joke"),
        NOTE("junho", "Has never been at the bottom of a list, and thinks it sounds restful.")
      ] },
      { text: "Your boxes are six inches from a fountain.", steps: [
        { say: "rowan", text: "Your boxes are six inches from a fountain." },
        { text: "He looks at the boxes. He looks at the water. He moves the whole row a hand's width inland, in one piece, without disturbing the line." },
        { say: "junho", text: "Thank you. That was specific, and it was in time. Those are the two things a note needs." },
        AFF("junho", 1, "Saved the boxes")
      ] }
    ] },
    { say: "junho", text: "I have met my roommate. I gave him the document for the room. He returned it within the hour, with eleven numbered comments." },
    { text: "He straightens the boxes, which were straight." },
    { say: "junho", text: "I have never been so content. I did not know that it would feel like this. I've made a note to find out why." },
    { flag: "isle_junho_done" },
    { flag: "rel_junho_teobalt" },
    NOTE("junho", "Is drafting a surname index for the ladder board. His roommate Teobalt answered his room document with eleven numbered comments, and he has never been so content."),
    { time: 5 },
    { end: true },
    { label: "again" },
    { say: "junho", text: "The index is at version three. It now has a column for how each name is pronounced. I don't know why I added it. I expect to find out." },
    { say: "rowan", text: "How's 'Vance' pronounced?" },
    { say: "junho", text: "\"Like a full stop, the way they read it at roll call.\" He writes something. \"I've put a second version in the column. Yours.\"" },
    { time: 2 }
  ]
});

scene("isle_eloise", {
  steps: [
    { when: (s)=>!!s.flags["isle_eloise_done"], jump: "again" },
    { text: "In the middle of the Quad, where everybody has to walk round her, a girl in a wine-red beret is kneeling on the grass over a sketchbook the size of a door. There is paint in her hair and a brush in her hand. The air near her smells of turpentine, even out here." },
    { text: "She is painting the clock tower. On the page its blue roof is enormous, and the people beneath it are small tilted dabs, every one of them leaning back." },
    { when: (s)=>!!s.flags["met_eloise"], jump: "known" },
    { say: "eloise", alias: "Girl in a red beret", text: "You, with no jacket. Stand in front of the tower. No — left. I need one thing out here it isn't looking at." },
    { text: "You stand in front of the tower. It seems simpler than asking." },
    { say: "eloise", alias: "Girl in a red beret", text: "There. I'm Eloise. Lafayette. It's on my hand, with the room. And you're the one they read out last. I kept that it was last. I lost the name." },
    { say: "rowan", text: "Rowan." },
    { say: "eloise", alias: "Girl in a red beret", text: "Rowan. That's a brown-red, like the berry. I'll keep that; I'm better at keeping colours." },
    MET("eloise", "Eloise Lafayette"),
    { jump: "beat" },
    { label: "known" },
    { say: "eloise", text: "Oh — the berry. Rowan. Stand in front of the tower a minute. Left. You're still the only one out here who didn't come out of a tube." },
    { when: (s)=>!!s.flags["eloise_time_promise"], say: "eloise", text: "You said you'd tell me when the boat was nearly in. I don't know if you did. I got off it, so somebody must have." },
    { label: "beat" },
    { say: "eloise", text: "It's counting. That's what it's doing. See how everybody under it has tipped back? They all look up to find out how late they are." },
    { say: "eloise", text: "I'm to be somewhere at three myself. It's on the other hand." },
    { text: "She shows you the other hand. In green paint, a little smeared: DOME 4 — 3." },
    { choice: [
      { text: "Shall I come and find you when it's time?", when: (s)=>s.minutes < 890, steps: [
        { say: "rowan", text: "Shall I come and find you when it's time?" },
        { say: "eloise", text: "Would you? Just come and stand in front of the tower again. I'll understand." },
        { say: "eloise", text: "People tell me the time as if I'd dropped it. You say it like it's only weather." },
        AFF("eloise", 2, "Kept the time kindly")
      ] },
      { text: "Eloise. It's gone three.", when: (s)=>s.minutes >= 890, steps: [
        { say: "rowan", text: "Eloise. It's gone three." },
        { say: "eloise", text: "Has it?" },
        { text: "She looks up at the clock, then down at the clock on the page, as if one of them ought to settle it." },
        { say: "eloise", text: "Then they'll have started without me, and now they'll have to stop. Thank you. You said it like weather. Most people say it like I'd dropped it." },
        AFF("eloise", 2, "Kept the time kindly")
      ] },
      { text: "What's the tower doing to you?", steps: [
        { say: "rowan", text: "What's the tower doing to you?" },
        { say: "eloise", text: "Hurrying me. I don't hurry. So we're having a disagreement." },
        { say: "eloise", text: "I'm winning. It's in my book, and I'm not in its." },
        AFF("eloise", 2, "Turned it round")
      ] },
      { text: "You've left the clock face empty.", steps: [
        { say: "rowan", text: "You've left the clock face empty." },
        { say: "eloise", text: "It's got too many times on it. I'll put one in when I know which one today was." },
        AFF("eloise", 1, "Looked properly")
      ] }
    ] },
    { say: "eloise", text: "My roommate's orange, by the way. I thought she would be, from the name. She opened the window before I'd asked, and then she shouted at a gull." },
    { flag: "isle_eloise_done" },
    { flag: "rel_eloise_marit" },
    NOTE("eloise", "Painted the clock tower with everyone beneath it tipped back: \"it's counting.\" Keeps her appointments written on her hands."),
    { time: 5 },
    { end: true },
    { label: "again" },
    { text: "The clock face on the page is still empty. Three more small tilted people have arrived under it." },
    { say: "eloise", text: "Don't tell me what it says up there. I'm still deciding what it says down here." },
    { time: 2 }
  ]
});
