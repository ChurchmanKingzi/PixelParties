// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
const { AFF, MET, DECK, NOTE, REL } = helpers;
scene("ferry_nathan", {
  steps: [
    { when: (s)=>!s.flags["ship_knows_wildcard"]&&!s.flags["nathan_inked"]&&!s.flags["nathan_list_beat"], jump: "list" },
    { when: (s)=>!!s.flags["ship_knows_wildcard"]&&!s.flags["nathan_tell_beat"], jump: "told" },
    { when: (s)=>((s.vars["ferry_talked"]||0)>=3)&&!s.flags["nathan_count_beat"], jump: "count" },
    { text: "Nathan turns round so fast that the magenta clip nearly leaves his hair. He has been reading a notice screwed to the nearest bit of ship, with his lips moving, and had clearly got to the good part." },
    { say: "nathan", text: "\"Rowan! What'd I miss? I was RIGHT here, I know, but I blinked.\"" },
    { jump: "menu" },

    { label: "list" },
    { flag: "nathan_list_beat" },
    { say: "nathan", text: "\"Rowan! Okay. You know the passenger list? By the wheelhouse door? You don't. Nobody reads it. I read it, I read everything that's on a wall.\"" },
    { say: "nathan", text: "\"Thirty-seven names, typed. And then ONE at the bottom in INK, like somebody added it with a fountain pen at the last minute. 'Vance, R. — Wildcard.' Nobody knows who it is! There's a whole betting pool going on the lounge benches!\"" },
    { think: "Vance, R. He is looking straight at a Rowan, and it has not crossed his mind for a second." },
    { choice: [
      { text: "\"Nathan. What do you think the R stands for?\"", steps: [
        { say: "rowan", text: "\"Nathan. What do you think the R stands for?\"" },
        { say: "nathan", text: "\"Robert! Rachel! Reginald! Could be anything! Could be Ro—\"" },
        { text: "He stops. You watch it arrive in his face, like a train coming into a very small station." },
        { say: "nathan", text: "\"ROW—\" He claps both hands over his own mouth. Through the fingers: \"…sorry. Sorry. I'm not telling. Not a soul. That's the best secret I've ever had.\"" },
        { say: "rowan", text: "\"Hold on to it until we dock, and I'll owe you one.\"" },
        { say: "nathan", text: "\"A whole CROSSING. Okay. Okay! I can do that. Baylee, if I start, sit on me.\"" },
        { say: "baylee", text: "\"Yup.\"" },
        { flag: "told_wildcard" },
        { flag: "nathan_inked" },
        AFF("nathan", 2, "Let him work it out")
      ] },
      { text: "\"That's me, Nathan. Vance, R. Please don't announce it yet.\"", steps: [
        { say: "rowan", text: "\"That's me, Nathan. Vance, R. Please don't announce it yet.\"" },
        { say: "nathan", text: "\"THAT'S YOU. THAT'S —\"" },
        { text: "He claps both hands over his own mouth. A pause. Above the hands, his eyebrows go on shouting." },
        { say: "nathan", text: "\"…sorry. Sorry. Sorry. I'm not telling. Nobody. That's the best secret I've ever had, and I'm going to hold it for at least ten minutes.\"" },
        { say: "rowan", text: "\"Could we try for the whole crossing?\"" },
        { say: "nathan", text: "\"We could TRY! I'm not promising, I don't lie to roommates. But I'll try so hard, Rowan.\"" },
        { flag: "told_wildcard" },
        { flag: "nathan_inked" },
        AFF("nathan", 1, "Told him first")
      ] },
      { text: "\"Who's your money on?\"", hint: "Keep it to yourself", steps: [
        { say: "rowan", text: "\"Who's your money on?\"" },
        { say: "nathan", text: "\"Four coins on 'he's not on the boat'! Think about it! Nobody's SEEN him! Either he's a professor's kid in a fake jacket, or there's no Wildcard at all and the ink's there to see who asks about it.\"" },
        { say: "rowan", text: "\"That's a lot of theory for one line of ink.\"" },
        { say: "nathan", text: "\"One line's how it starts! It's always one line!\"" },
        { think: "Four Smug Coins on your not existing. On the whole, it is a relief." },
        { flag: "nathan_bet_test" }
      ] }
    ] },
    { jump: "menu" },

    { label: "told" },
    { flag: "nathan_tell_beat" },
    { when: (s)=>!s.flags["nathan_read_list"], jump: "heard" },
    { say: "nathan", text: "\"Rowan! Status report! Eleven people know you're the Wildcard. I counted. I'm asking if that's okay, and I know I'm asking after, and my mom says that's the wrong order.\"" },
    { choice: [
      { text: "\"What did the eleven say?\"", steps: [
        { say: "rowan", text: "\"What did the eleven say?\"" },
        { say: "nathan", text: "\"A girl with a parasol said 'how quaint'. I don't think it was nice, but she said it nicely. A guy with a tablet asked for your win rate. I said a hundred. Is it a hundred?\"" },
        { say: "rowan", text: "\"It is not a hundred.\"" },
        { say: "nathan", text: "\"I'll go back and say ninety. Ninety's still great!\"" },
        { think: "Somewhere on this ship a stranger is writing down a number that Nathan made up." },
        AFF("nathan", 1, "Asked him straight")
      ] },
      { text: "\"It's all right. Just let me say the next bit myself.\"", steps: [
        { say: "rowan", text: "\"It's all right. Just let me say the next bit myself.\"" },
        { say: "nathan", text: "\"Deal! You do the words! I'll only do the volume!\"" },
        { say: "baylee", text: "\"That's the part that carries.\"" },
        AFF("nathan", 2, "Fair deal")
      ] },
      { text: "\"Eleven is a lot of people, Nathan.\"", steps: [
        { say: "rowan", text: "\"Eleven is a lot of people, Nathan.\"" },
        { say: "nathan", text: "\"It's less than twelve!\"" },
        { text: "You wait. The grin holds for a second longer and then loses its footing." },
        { say: "nathan", text: "\"…Was that bad? I can't always tell. I thought it was the good kind of news. If it was me, I'd want it on a banner.\"" },
        { say: "rowan", text: "\"I know you would. I'd have liked to get used to it first, that's all.\"" },
        { say: "nathan", text: "\"Okay. Next thing that's yours, I ask FIRST.\" He takes out a pen and writes ASK on the back of his hand, in capitals. \"There. Now it's law.\"" },
        AFF("nathan", 1, "Said it plainly")
      ] }
    ] },
    { jump: "menu" },

    { label: "heard" },
    { when: (s)=>!s.flags["nathan_inked"], say: "nathan", text: "\"ROWAN! You're Vance, R.! The INK guy on the passenger list! It's all over the ship! You were standing NEXT to me the whole time, and I never — okay. Okay. I'm fine.\"" },
    { when: (s)=>!!s.flags["nathan_inked"], say: "nathan", text: "\"It got out! It wasn't me! I held it, Rowan, I never told a soul, ask Baylee! Somebody else worked it out, and now everybody's saying it.\"" },
    { when: (s)=>!!s.flags["nathan_inked"], say: "baylee", text: "\"He held it. It was hard to watch.\"" },
    { say: "nathan", text: "\"So I haven't told anybody who you ARE. But I've been telling them you're my roommate. Only that! That part's mine. Is that okay?\"" },
    { choice: [
      { text: "\"That part's yours. Use it.\"", steps: [
        { say: "rowan", text: "\"That part's yours. Use it.\"" },
        { say: "nathan", text: "\"ROOMMATE! Baylee, it's official, I've got a quote!\"" },
        { say: "baylee", text: "\"It was official already.\"" },
        { say: "nathan", text: "\"Now it's official with a QUOTE!\"" },
        AFF("nathan", 2, "Let him have that part")
      ] },
      { text: "\"How did it get out? Do you know?\"", steps: [
        { say: "rowan", text: "\"How did it get out? Do you know?\"" },
        { say: "nathan", text: "\"No idea! Somebody put the list next to the one guy with no jacket, I guess. That's just detective work. I should've done it! I had the list AND the guy!\"" },
        { think: "He is not sorry it is out. He is sorry he was not the one who solved it. It is hard to hold that against him." },
        AFF("nathan", 1, "Asked him straight")
      ] },
      { text: "\"I'd have liked a bit longer before everybody knew.\"", steps: [
        { say: "rowan", text: "\"I'd have liked a bit longer before everybody knew.\"" },
        { say: "nathan", text: "\"…Yeah. I figured, from your face. I'd want it on a banner, but you're not a banner guy.\"" },
        { say: "nathan", text: "\"Okay. Anybody says it mean, you tell me, and I'll say something back at my volume.\" He means it entirely. \"That's what the roommate part's for.\"" },
        AFF("nathan", 2, "Has his back")
      ] }
    ] },
    { jump: "menu" },

    { label: "count" },
    { flag: "nathan_count_beat" },
    { say: "nathan", text: "\"You're MEETING people! I've been keeping count! Baylee said you'd manage one before the docks, and I said three, so pay me, Baylee!\"" },
    { say: "baylee", text: "\"I did not bet.\"" },
    { say: "nathan", text: "\"You nodded!\"" },
    { say: "baylee", text: "\"I nod.\"" },

    { label: "menu" },
    { choice: [
      { text: "\"Stand still a minute, Nathan. I've got questions for a change.\"", when: (s)=>!s.flags["chat_nathan_done"], steps: [
        { say: "rowan", text: "\"Stand still a minute, Nathan. I've got questions for a change.\"" },
        { scene: "chat_nathan" }
      ] },
      { text: "\"Nothing, for the moment. Carry on, Nathan.\"", steps: [
        { say: "rowan", text: "\"Nothing, for the moment. Carry on, Nathan.\"" },
        { say: "nathan", text: "\"On it! I'm on everything!\"" }
      ] }
    ] },
    { time: 5 }
  ]
});

scene("chat_nathan", {
  steps: [
    { when: (s)=>!s.flags["chat_nathan_intro"], text: "Nathan gives you his whole attention, which is a physical thing, like standing in a searchlight. A fat notebook with a rubber band round it is jammed into his jacket pocket. Somebody has written EVIDENCE on the cover in marker and underlined it three times." },
    { flag: "chat_nathan_intro" },
    { label: "top" },
    { when: (s)=>!!s.flags["chat_nathan_1"]&&!!s.flags["chat_nathan_2"]&&!!s.flags["chat_nathan_3"]&&!!s.flags["chat_nathan_x"]&&!!s.flags["shop_nathan_done"], flag: "chat_nathan_done", say: "nathan", text: "\"Okay, that's — we've covered, like, a THIRD of my life story! Come back for the rest! There's a lot of it and it's all great!\"", end: true },
    { choice: [
      { text: "\"Baylee says you've been like this since the harbour. What were you like before the harbour?\"", when: (s)=>!s.flags["chat_nathan_1"], steps: [
        { say: "rowan", text: "\"Baylee says you've been like this since the harbour. What were you like before the harbour?\"" },
        { say: "nathan", text: "\"The same! But in Brinehaven! Harbour town, you can smell it from the bus. Four of us, four boys, one bathroom, and a dinner table the size of a postage stamp.\"" },
        { say: "nathan", text: "\"There's Dom, who I can't beat up. Nicky, who I can beat up if he's just eaten. Me. And Paulie, who's eleven, so I can but I'm not allowed. You had to be louder than the food to get heard.\"" },
        { choice: [
          { text: "\"That explains the volume.\"", steps: [
            { say: "rowan", text: "\"That explains the volume.\"" },
            { say: "nathan", text: "\"It explains EVERYTHING! It's not a personality, it's a survival adaptation!\"" },
            { say: "nathan", text: "\"What about you? You got brothers? You're quiet like an only.\"" },
            { say: "rowan", text: "\"No brothers. Just me and an aunt.\"" },
            { say: "nathan", text: "\"An AUNT house! That's why you're polite! You've never had to fight for a potato. No offence.\"" },
            { say: "rowan", text: "\"None taken. I think.\"" }
          ] },
          { text: "\"Third of four. Where does that put you at the table?\"", steps: [
            { say: "rowan", text: "\"Third of four. Where does that put you at the table?\"" },
            { say: "nathan", text: "\"Worst seat! The first one's the big one. The second one's the smart one. The last one's the baby. Third is just — there's a chair, and I'm in it.\"" },
            { say: "rowan", text: "\"So you made the chair loud.\"" },
            { say: "nathan", text: "\"I made the chair LOUD!\" He points at you with both hands. \"Baylee, he gets it! It took him one go!\"" },
            AFF("nathan", 1, "Got the chair")
          ] }
        ] },
        AFF("nathan", 1, "Asked about home"),
        { flag: "chat_nathan_1" },
        NOTE("nathan", "From Brinehaven, a harbour town. Third of four brothers; grew up shouting to be heard at dinner."),
        { time: 3 }
      ] },
      { text: "\"And what did four boys and one bathroom say when you got in here?\"", when: (s)=>!!s.flags["chat_nathan_1"]&&!s.flags["chat_nathan_2"], steps: [
        { say: "rowan", text: "\"And what did four boys and one bathroom say when you got in here?\"" },
        { say: "nathan", text: "\"Dom said 'for CARDS?' Nicky said they must've been short of people. My mom cried, but she cries at ads for soup.\"" },
        { text: "He laughs first, as he does at all his own jokes. This time the laugh stops a little early." },
        { say: "nathan", text: "\"See, at home there's the strong one, and the smart one, and Paulie's 'the baby', which is still a word. And then there's me. I'm 'Nathan, SHUT UP.' That's three words, and none of them's good.\"" },
        { say: "nathan", text: "\"I'd like to be a different word.\"" },
        { choice: [
          { text: "\"Which word?\"", steps: [
            { say: "rowan", text: "\"Which word?\"" },
            { say: "nathan", text: "\"I don't know yet! That's why I came! I figured the island would have one lying around!\"" },
            { say: "rowan", text: "\"And if it hasn't?\"" },
            { say: "nathan", text: "\"Then I'll keep winning stuff till somebody has to make one up.\"" },
            AFF("nathan", 2, "Asked him seriously")
          ] },
          { text: "\"You'd said hello to me before I was properly awake. There's a word for that.\"", steps: [
            { say: "rowan", text: "\"You'd said hello to me before I was properly awake. There's a word for that.\"" },
            { say: "nathan", text: "\"Is it 'annoying'? It's 'annoying', right? Baylee?\"" },
            { say: "baylee", text: "\"Friendly.\"" },
            { say: "nathan", text: "\"…Huh.\"" },
            { text: "He is quiet for almost two full seconds. You suspect it is a record, and that nobody is timing it." },
            { say: "nathan", text: "\"Friendly. That's a real word. People put that on stuff.\"" },
            AFF("nathan", 3, "Gave him a better word")
          ] }
        ] },
        { flag: "chat_nathan_2" },
        NOTE("nathan", "At home he is 'Nathan, shut up'. He came to the island to be a different word."),
        { time: 3 }
      ] },
      { text: "\"Does it ever go wrong? Saying everything out loud, at that volume?\"", when: (s)=>!s.flags["chat_nathan_x"], steps: [
        { say: "rowan", text: "\"Does it ever go wrong? Saying everything out loud, at that volume?\"" },
        { say: "nathan", text: "\"Go WRONG? Oh, EASY. Okay. You ready? I was twelve. School bus. There's this girl at the back, Marcy, who has — had — the BEST laugh. I wanted to say hi.\"" },
        { say: "nathan", text: "\"So I stood up at the front and I shouted 'HI, MARCY'. And the bus was quiet. I did not know the bus would be quiet! The bus is NEVER quiet!\"" },
        { say: "rowan", text: "\"What happened?\"" },
        { say: "nathan", text: "\"Everyone said 'hi, Marcy' back. In unison. For the whole ride. For a MONTH.\"" },
        { choice: [
          { text: "\"What did Marcy do?\"", steps: [
            { say: "rowan", text: "\"What did Marcy do?\"" },
            { say: "nathan", text: "\"She waved! Every single morning! Like the queen! She thought it was the funniest thing that ever happened to her.\"" },
            { say: "nathan", text: "\"…She married nobody. I checked. I'm just saying there's still time.\"" }
          ] },
          { text: "\"And you still do it.\"", steps: [
            { say: "rowan", text: "\"And you still do it.\"" },
            { say: "nathan", text: "\"I still do it! What's the other way? NOT say hi? Then nobody says hi! I've been on that bus, Rowan. It's a worse bus.\"" },
            { think: "He wanted to die for a month, and what he took away from it was that you should say hello more. You are not sure you have ever been that brave." },
            AFF("nathan", 1, "Saw the point of it")
          ] }
        ] },
        { say: "nathan", text: "\"Your turn! Worst one! Go!\"" },
        { say: "rowan", text: "\"Mine all happen quietly. Nobody says them back.\"" },
        { say: "nathan", text: "\"That's the SADDEST thing I ever heard! We're fixing that! Baylee, we're fixing that!\"" },
        { say: "baylee", text: "\"Let him keep a few.\"" },
        AFF("nathan", 1, "Heard the Marcy story"),
        { flag: "chat_nathan_x" },
        NOTE("nathan", "Once shouted 'HI, MARCY' across a quiet school bus. The whole bus said it back for a month. He still says hello first."),
        { time: 3 }
      ] },
      { text: "\"That notebook. Evidence of what?\"", when: (s)=>!s.flags["chat_nathan_3"], steps: [
        { say: "rowan", text: "\"That notebook. Evidence of what?\"" },
        { say: "nathan", text: "\"You SAW that?\" He puts a hand flat over the pocket. \"You can't just see the notebook. You've got to earn the notebook.\"" },
        { text: "He holds out for nearly four seconds." },
        { say: "nathan", text: "\"Fine, ONE page. Three majors, right? Red, gold, black. And thirty-eight of us came over on the boat. The captain said it, he counted twice. Thirty-eight doesn't go into three! So where do the other two go?\"" },
        { choice: [
          { text: "\"The majors don't have to be the same size, Nathan.\"", steps: [
            { say: "rowan", text: "\"The majors don't have to be the same size, Nathan.\"" },
            { say: "nathan", text: "\"That's what Baylee said! That's what they WANT you to say!\"" },
            { say: "baylee", text: "\"It's just sums.\"" },
            { say: "nathan", text: "\"It's sums with a SECRET in them!\"" },
            { say: "rowan", text: "\"I'm not saying you're wrong. I'm saying you've got one page.\"" },
            { say: "nathan", text: "\"One page so far! See, you argue with it. That's good. Nobody ever argues with it, they just leave.\"" },
            AFF("nathan", 2, "Argued with the evidence")
          ] },
          { text: "\"Go on, then. What's the fourth major?\"", steps: [
            { say: "rowan", text: "\"Go on, then. What's the fourth major?\"" },
            { say: "nathan", text: "\"I don't KNOW! That's what makes it secret! But there's a fourth colour of jacket somewhere on the island, and I'm going to be the guy who finds the laundry tag.\"" },
            { say: "rowan", text: "\"What colour?\"" },
            { say: "nathan", text: "\"…Green.\" He writes it down at once. \"I just decided. It feels green.\"" },
            AFF("nathan", 2, "Listened to the evidence")
          ] }
        ] },
        { say: "nathan", text: "\"The guy in the cowboy hat believes me. I showed him the sum and he said 'huh', like he MEANT it. There's a page on bigfoot as well, but that's not island-related. Yet.\"" },
        { flag: "chat_nathan_3" },
        NOTE("nathan", "Keeps a notebook marked EVIDENCE. Page one: a secret fourth major, because thirty-eight does not divide by three."),
        { time: 3 }
      ] },
      { text: "\"War Counselors. You said best deck in the format. Talk me through it.\"", when: (s)=>!s.flags["shop_nathan_done"], steps: [
        { say: "rowan", text: "\"War Counselors. You said best deck in the format. Talk me through it.\"" },
        { scene: "shop_nathan" }
      ] },
      { text: "\"I'd like to look around some more, Nathan. Thanks.\"", steps: [
        { say: "rowan", text: "\"I'd like to look around some more, Nathan. Thanks.\"" },
        { say: "nathan", text: "\"Go! Go go go! Meet people! Then tell me everything! I'll know already, but still!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("shop_nathan", {
  steps: [
    { say: "nathan", text: "\"SIX different dudes! Censpartan, Cykyran, Gorinthian, Harpthenean, Minocrete, Thebinxan, I can say them ALL, I practised in the shower! You play one a turn and every dude is better for every OTHER dude on the table. It's basically Thanksgiving!\"" },
    { text: "Rowan's eyes have drifted out of focus. His lips are moving a half-second ahead of his voice." },
    { say: "rowan", text: "\"…One of each at a time. Each one stronger per Counselor out. War Chest pays for the Gathering Place, so the new one acts the turn it lands. Three or four out and the board does everything. Stuns. Doubled shots. Gold cannon.\" A breath. \"Over-commits every game. One sweep and the whole table goes at once. Right. *Right.*\"" },
    { say: "nathan", text: "\"…Did you just say *sweep*?\"" },
    { say: "baylee", text: "\"He's right.\"" },
    { say: "nathan", text: "\"He's — okay, he's right! But nobody sweeps! It's rude!\"" },
    { say: "rowan", text: "\"Somebody always sweeps. I'd keep a Counselor in hand until I knew they couldn't.\"" },
    { say: "nathan", text: "\"A Counselor in HAND. Baylee! He said keep one in HAND! Nobody's ever told me that, they just tell me I'm loud!\"" },
    { say: "nathan", text: "\"Hang on. How do you know my deck? You said it like a shopping list. You weren't even looking at me.\"" },
    { choice: [
      { text: "\"I've played against it. Online, a lot.\"", steps: [
        { say: "rowan", text: "\"I've played against it. Online, a lot.\"" },
        { say: "nathan", text: "\"Online! So you've beaten it?\"" },
        { say: "rowan", text: "\"Mostly when they put all six down at once.\"" },
        { say: "nathan", text: "\"I ALWAYS put all six down! It looks so good! It looks like a class photo!\"" },
        { say: "rowan", text: "\"It does. That's when I sweep.\"" },
        { say: "nathan", text: "\"…Okay, that hurt, and I'm writing it down.\" He is. He is delighted." }
      ] },
      { text: "\"I read decklists the way other people count sheep.\"", steps: [
        { say: "rowan", text: "\"I read decklists the way other people count sheep.\"" },
        { say: "nathan", text: "\"That's the saddest thing I ever heard, and I respect it so much.\"" },
        { say: "baylee", text: "\"Does it work?\"" },
        { say: "rowan", text: "\"No. I just end up awake, with opinions.\"" },
        { say: "nathan", text: "\"That's ME! That's me every night! Rowan, we're the SAME!\"" }
      ] }
    ] },
    AFF("nathan", 2, "Took his deck seriously"),
    { flag: "shop_nathan_done" },
    { time: 3 }
  ]
});

scene("ferry_baylee", {
  steps: [
    { when: (s)=>!!s.flags["flag_baylee_chat"], jump: "again" },
    { when: (s)=>s.location==="ferry_lounge", jump: "indoors" },
    { text: "Baylee has stopped at the rail with one hand on it, as if holding the ship in place while the rest of it moves." },
    { text: "In the full sun, with the straw hat pushed back and his jacket slung over one shoulder, he looks like a scarecrow that has been promoted. Several students walk round him, very carefully, as round a monument." },
    { text: "Somewhere behind you Nathan is telling somebody, with great volume, about a plate." },
    { say: "baylee", text: "\"Morning.\"" },
    { say: "rowan", text: "\"Morning.\"" },
    { text: "There is a pause. It is a comfortable pause, deep and slow, with a gull in it." },
    { choice: [
      { text: "\"He's found a new audience. Is he always like this?\"", steps: [
        { say: "rowan", text: "\"He's found a new audience. Is he always like this?\"" },
        { say: "baylee", text: "\"Yup.\"" },
        { text: "A pause long enough to watch the gull cross the sky." },
        { say: "baylee", text: "\"Met him at the harbour. Sat next to me on the bus. Told me about his whole family before the first stop.\"" },
        { say: "baylee", text: "\"Ten minutes in, I figured he was either going to be a problem or the best thing that happened to me this year.\"" },
        { say: "rowan", text: "\"Which was it?\"" },
        { say: "baylee", text: "\"Still working that out.\"" },
        { text: "He says it without a smile. But something in the sunburnt face loosens a little, the way a knot loosens when somebody has stopped pulling at it." },
        { choice: [
          { text: "\"He did say hello first. That has to count for something.\"", steps: [
            { say: "rowan", text: "\"He did say hello first. That has to count for something.\"" },
            { say: "baylee", text: "\"…It does.\" He says it to the sea. \"Most folks wait and see if I'm friendly. He didn't wait.\"" }
          ] },
          { text: "\"I've known him one morning, and I already know there's a plate.\"", steps: [
            { say: "rowan", text: "\"I've known him one morning, and I already know there's a plate.\"" },
            { say: "baylee", text: "\"Plate's a good one.\" The corner of his mouth moves about a quarter of an inch. \"Wait for the dog.\"" }
          ] }
        ] },
        AFF("baylee", 1, "Asked about Nathan")
      ] },
      { text: "\"You're holding that rail as if it might leave without you.\"", steps: [
        { say: "rowan", text: "\"You're holding that rail as if it might leave without you.\"" },
        { say: "baylee", text: "\"…Yup.\"" },
        { text: "He looks at his own hand on the iron, as if he had not known it was there." },
        { say: "baylee", text: "\"First time on the sea. Proper sea. There's a lot of it.\"" },
        { say: "baylee", text: "\"Can't swim. Never needed to. Stock pond at home's waist deep.\"" },
        { choice: [
          { text: "\"Then I'd keep the hand exactly where it is.\"", steps: [
            { say: "rowan", text: "\"Then I'd keep the hand exactly where it is.\"" },
            { say: "baylee", text: "\"Planning to.\"" }
          ] },
          { text: "\"The rail's sound. I slept against it half the night.\"", steps: [
            { say: "rowan", text: "\"The rail's sound. I slept against it half the night.\"" },
            { say: "baylee", text: "\"Good to know.\" A slow look, top to bottom. \"You look like you did.\"" }
          ] }
        ] },
        { flag: "baylee_cant_swim" },
        NOTE("baylee", "Cannot swim. Had never seen the sea before this crossing."),
        AFF("baylee", 2, "Noticed the rail")
      ] }
    ] },
    { text: "You lean on the rail beside him. The iron is warm. Below, the sea slides past in long green folds, and for a minute neither of you says anything, and it does not feel like a gap." },
    { say: "baylee", text: "\"Where're you from?\"" },
    { say: "rowan", text: "\"The mainland. A town with one bus. You?\"" },
    { say: "baylee", text: "\"North of everything. Farm. Dairy, mostly. Some corn.\"" },
    { text: "Another pause." },
    { say: "baylee", text: "\"Cows are easier to talk to. They tell you when they're upset.\"" },
    { think: "He said that completely seriously, and somehow it is the most reassuring thing anyone has said to me all week." },
    NOTE("baylee", "From a dairy farm. Says cows are easier to talk to."),
    { flag: "baylee_from_farm" },
    { choice: [
      { text: "\"How does a cow tell you she's upset?\"", steps: [
        { say: "rowan", text: "\"How does a cow tell you she's upset?\"" },
        { say: "baylee", text: "\"Ears go back. Tail goes. She'll stand off from the rest, with her face to the fence.\"" },
        { text: "He has not hurried once this morning, and he does not hurry now. But this he knows, and it comes out whole." },
        { say: "baylee", text: "\"Folks do the same. They're only quieter about it.\"" },
        { think: "You have been standing a little apart from thirty-seven people since dawn, with your face to the water. He does not look at you while he says it. He does not need to." },
        AFF("baylee", 2, "Asked about the cows")
      ] },
      { text: "\"People are harder. I'm a bit nervous about today, to be honest. First real table, first real people.\"", steps: [
        { say: "rowan", text: "\"People are harder. I'm a bit nervous about today, to be honest. First real table, first real people.\"" },
        { say: "baylee", text: "\"Yup.\"" },
        { text: "A very long pause. The kind that has a cow in it, and a gate, and weather." },
        { say: "baylee", text: "\"Me too.\"" },
        { say: "rowan", text: "\"You don't look nervous.\"" },
        { say: "baylee", text: "\"Big fella, small ship. Everybody looks. You learn to look calm so they stop.\"" },
        { say: "baylee", text: "\"Tables are just tables, though. They hold things up.\"" },
        { text: "You think about that for a while. It is, you decide, entirely true." },
        NOTE("baylee", "Gets nervous too. Looks calm so people stop staring."),
        AFF("baylee", 3, "Shared a worry"),
        { flag: "told_baylee_nerves" }
      ] },
      { text: "\"And Nathan? Where does he come, next to a cow?\"", steps: [
        { say: "rowan", text: "\"And Nathan? Where does he come, next to a cow?\"" },
        { say: "baylee", text: "\"Had a heifer like Nathan once. Loud. Walked into the same fence every morning.\"" },
        { text: "Behind you the plate story reaches some kind of climax. Somebody shrieks. Baylee does not turn round." },
        { say: "baylee", text: "\"Good animal, though.\"" },
        AFF("baylee", 1, "Let him say it his way")
      ] }
    ] },
    { say: "baylee", text: "\"You play, I guess. Everybody on here does.\"" },
    { say: "rowan", text: "\"I play. What do you run?\"" },
    { say: "baylee", text: "\"Big Stomp. Dinosaurs.\"" },
    { text: "He holds up a hand the size of a dinner plate. The deck box is lost in it." },
    { say: "baylee", text: "\"Not good. Fun, though.\"" },
    { flag: "baylee_said_deck" },
    { scene: "mutter_baylee" },
    { say: "baylee", text: "\"You can have a game later. If you want. If you're not busy.\"" },
    { flag: "baylee_game_offered" },
    { flag: "flag_baylee_chat" },
    { time: 8 },
    { end: true },

    { label: "indoors" },
    { text: "Baylee is standing very carefully, hat in hand, with the top of his head a few inches under the lounge ceiling. He looks like a man who has been put in a cupboard and is being polite about it." },
    { say: "baylee", text: "\"Outside. When you're up there. More sky.\"" },
    { time: 1 },
    { end: true },

    { label: "again" },
    { when: (s)=>s.location!=="ferry_lounge", text: "Baylee has found a piece of rail again. He seems to find one wherever you stop." },
    { when: (s)=>s.location==="ferry_lounge", text: "Baylee has found the stair rail and put one hand on it. He seems to find one wherever you stop." },
    { say: "baylee", text: "\"Yup?\"" },
    { choice: [
      { text: "\"How is the crossing treating you?\"", steps: [
        { say: "rowan", text: "\"How is the crossing treating you?\"" },
        { when: (s)=>!!s.flags["baylee_cant_swim"], say: "baylee", text: "\"Still on top of it. That's the main thing.\"" },
        { when: (s)=>!s.flags["baylee_cant_swim"], say: "baylee", text: "\"Long. Good long. Haven't been on a boat since the county fair ferry, and that was two minutes.\"" }
      ] },
      { text: "\"Mind if I stand here a while? There are things I never asked you.\"", when: (s)=>!s.flags["chat_baylee_done"], steps: [
        { say: "rowan", text: "\"Mind if I stand here a while? There are things I never asked you.\"" },
        { say: "baylee", text: "\"Rail's free.\"" },
        { scene: "chat_baylee" }
      ] },
      { text: "\"Do you fancy that game now?\"", when: (s)=>!!s.flags["baylee_game_offered"]&&!s.flags["flag_baylee_game"], steps: [
        { say: "rowan", text: "\"Do you fancy that game now?\"" },
        { say: "baylee", text: "\"…Could do. Quick one. Casual.\"" },
        { duel: "ferry_baylee", opponent: "baylee", opponentName: "Baylee Halvorsen", mustWin: false,
          onWin: [
            { say: "baylee", text: "\"Good game. You've got — a way with the sky, with that deck. Looks like rain's coming in all at once.\"" },
            AFF("baylee", 2, "Good game")
          ],
          onLose: [
            { say: "baylee", text: "\"Huh.\"" },
            { text: "He looks at his big dinosaurs for a long moment." },
            { say: "baylee", text: "\"Lucky. Sorry.\"" },
            AFF("baylee", 2, "Won kindly")
          ] },
        { scene: "post_baylee" },
        { flag: "flag_baylee_game" },
        { time: 25 }
      ] },
      { text: "\"Nothing. Just seeing how you were.\"", steps: [
        { say: "rowan", text: "\"Nothing. Just seeing how you were.\"" },
        { say: "baylee", text: "\"Thanks.\"" }
      ] }
    ] },
    { time: 5 }
  ]
});

scene("chat_baylee", {
  steps: [
    { when: (s)=>!!s.flags["baylee_from_farm"], jump: "top" },
    { say: "rowan", text: "\"Where's home, Baylee? I never asked.\"" },
    { say: "baylee", text: "\"North of everything. Farm. Dairy, mostly. Some corn.\"" },
    { flag: "baylee_from_farm" },
    NOTE("baylee", "From a dairy farm, north of everything."),
    { label: "top" },
    { when: (s)=>!!s.flags["chat_baylee_1"]&&!!s.flags["chat_baylee_2"]&&!!s.flags["chat_baylee_3"]&&!!s.flags["chat_baylee_x"], flag: "chat_baylee_done", say: "baylee", text: "\"…That's about all I've got.\" A very small pause. \"Thanks for asking. Folks mostly don't.\"", end: true },
    { choice: [
      { text: "\"How long have you been playing, Baylee?\"", when: (s)=>!s.flags["chat_baylee_1"], steps: [
        { say: "rowan", text: "\"How long have you been playing, Baylee?\"" },
        { say: "baylee", text: "\"A year. Starter deck. Somebody left it on the counter at the feed store.\"" },
        { text: "He turns his hand over, like a man checking for rain." },
        { say: "baylee", text: "\"Asked after it for a week. Nobody came. So I read the cards. Finger under the line. I'm slow at reading. Not dim. Slow.\"" },
        { choice: [
          { text: "\"I don't think anyone who reads every line is slow.\"", steps: [
            { say: "rowan", text: "\"I don't think anyone who reads every line is slow.\"" },
            { say: "baylee", text: "\"…Yup.\"" },
            { text: "The sunburnt face does something complicated." },
            { say: "baylee", text: "\"Nobody's said that.\"" },
            AFF("baylee", 2, "Respected how he reads")
          ] },
          { text: "\"I skim. I've lost games to a word I skipped.\"", steps: [
            { say: "rowan", text: "\"I skim. I've lost games to a word I skipped.\"" },
            { say: "baylee", text: "\"Which word?\"" },
            { say: "rowan", text: "\"'May.'\"" },
            { text: "He gives this the same slow consideration he would give a gate that has been left open." },
            { say: "baylee", text: "\"That's a big one.\"" },
            AFF("baylee", 1, "Owned up to skimming")
          ] }
        ] },
        { say: "rowan", text: "\"And the dinosaurs?\"" },
        { say: "baylee", text: "\"They were in the box. Then I got the books out of the county library. All of them. Both shelves.\"" },
        { say: "baylee", text: "\"Cards get some of it wrong. I don't mind. Ask me which, some time. It takes a while.\"" },
        { text: "It is the longest speech you have heard from him, and he looks faintly surprised to find himself at the end of it." },
        { flag: "chat_baylee_1" },
        NOTE("baylee", "Learned the game a year ago from a starter deck left on a feed-store counter. Reads every card line by line, and has read every dinosaur book in his county library."),
        { time: 3 }
      ] },
      { text: "\"It's a long way from a dairy farm to a card academy. What brought you?\"", when: (s)=>!s.flags["chat_baylee_2"], steps: [
        { say: "rowan", text: "\"It's a long way from a dairy farm to a card academy. What brought you?\"" },
        { say: "baylee", text: "\"Farm money. Dad put it by. Said it ought to go on something that mattered.\"" },
        { say: "baylee", text: "\"Seemed wrong to waste it on staying home.\"" },
        { choice: [
          { text: "\"I hope it does matter.\"", steps: [
            { say: "rowan", text: "\"I hope it does matter.\"" },
            { say: "baylee", text: "\"Me too.\" Plainly. \"Working on it.\"" },
            AFF("baylee", 1, "Wished him well")
          ] },
          { text: "\"That's a lot to carry onto a boat.\"", steps: [
            { say: "rowan", text: "\"That's a lot to carry onto a boat.\"" },
            { say: "baylee", text: "\"Yup.\" A pause. \"Heavier than the bag.\"" },
            { say: "baylee", text: "\"You? Somebody put something by for you?\"" },
            { say: "rowan", text: "\"An aunt. She's expecting postcards.\"" },
            { say: "baylee", text: "\"Send them.\"" },
            { text: "He says it the way other people say a thing is the law." },
            AFF("baylee", 2, "Understood the weight")
          ] }
        ] },
        { flag: "chat_baylee_2" },
        NOTE("baylee", "His father put the farm money by for something that mattered. Baylee is trying to make it matter."),
        { time: 3 }
      ] },
      { text: "\"You stand with your shoulders pulled in. I noticed it first thing this morning.\"", when: (s)=>!s.flags["chat_baylee_3"], steps: [
        { say: "rowan", text: "\"You stand with your shoulders pulled in. I noticed it first thing this morning.\"" },
        { say: "baylee", text: "\"…Most don't.\"" },
        { text: "A pause. He takes his time with it." },
        { say: "baylee", text: "\"Doorways. Ceilings. People. You learn to stand so folks can get past. Then you forget you're doing it.\"" },
        { choice: [
          { text: "\"Does it work? Do they get past?\"", steps: [
            { say: "rowan", text: "\"Does it work? Do they get past?\"" },
            { say: "baylee", text: "\"They say 'sorry' and walk round.\"" },
            { text: "A long, slow shrug, like a hill changing its mind." },
            { say: "baylee", text: "\"It's fine. I take up room.\"" },
            { say: "rowan", text: "\"I think you take up exactly the right amount.\"" },
            { say: "baylee", text: "\"…\"" },
            { text: "His ears go the colour of a brick." },
            { say: "baylee", text: "\"Thanks.\"" }
          ] },
          { text: "\"You don't have to do it round me.\"", steps: [
            { say: "rowan", text: "\"You don't have to do it round me.\"" },
            { say: "baylee", text: "\"Habit.\"" },
            { text: "He thinks about it. Then, with visible effort, like a man putting down two buckets, he lets the shoulders go. He is suddenly a good deal wider. The space round him seems to notice." },
            { say: "baylee", text: "\"There.\" Within four breaths the shoulders have started to creep back in. He catches them at it. \"…I'll work up to it.\"" }
          ] }
        ] },
        AFF("baylee", 2, "Noticed how he stands"),
        { flag: "chat_baylee_3" },
        NOTE("baylee", "Stands with his shoulders pulled in so that people can get past, and has forgotten he does it."),
        { time: 3 }
      ] },
      { text: "\"What's a morning like, on the farm?\"", when: (s)=>!s.flags["chat_baylee_x"], steps: [
        { say: "rowan", text: "\"What's a morning like, on the farm?\"" },
        { say: "baylee", text: "\"Half four. Never learned how not to.\"" },
        { say: "baylee", text: "\"Milk. Feed. Fix whatever broke in the night. Then breakfast, which is the good bit.\"" },
        { say: "rowan", text: "\"What's good about it?\"" },
        { say: "baylee", text: "\"Quiet. Cows don't talk. Wind does. You hear it coming across the corn about a minute before it hits.\" A pause. \"Then it hits.\"" },
        { choice: [
          { text: "\"Do you miss it?\"", steps: [
            { say: "rowan", text: "\"Do you miss it?\"" },
            { say: "baylee", text: "\"…A bit.\" Simply. \"Not so much as I thought. There's a lot of weather here, too.\"" },
            AFF("baylee", 1, "Asked about the mornings")
          ] },
          { text: "\"Half four. So you were up before the ship was.\"", steps: [
            { say: "rowan", text: "\"Half four. So you were up before the ship was.\"" },
            { say: "baylee", text: "\"Walked the deck. You were asleep on the bench under the lifeboat.\"" },
            { say: "baylee", text: "\"Your bag had slid. Put it back under your arm. Didn't seem right to wake you for it.\"" },
            { think: "He was looking after you an hour before he knew your name. He reports it the way he would report closing a gate." },
            { say: "rowan", text: "\"Thank you.\"" },
            { say: "baylee", text: "\"It was sliding.\"" },
            AFF("baylee", 2, "Said thank you")
          ] }
        ] },
        { flag: "chat_baylee_x" },
        NOTE("baylee", "Wakes at half past four every day. The good bit of a farm morning is breakfast, for the quiet."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_baylee"], steps: [
        { scene: "deck_baylee" }
      ] },
      { text: "\"I'll leave you in peace, Baylee.\"", steps: [
        { say: "rowan", text: "\"I'll leave you in peace, Baylee.\"" },
        { say: "baylee", text: "\"Mind the step.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("deck_baylee", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_baylee"], end: true },
    { choice: [
      { text: "\"What do you run, Baylee? Only if you feel like saying.\"", when: (s)=>!s.flags["baylee_said_deck"], steps: [
        { say: "rowan", text: "\"What do you run, Baylee? Only if you feel like saying.\"" },
        { say: "baylee", text: "\"Big Stomp. Dinosaurs.\"" },
        { text: "He looks at his own hand for a moment." },
        { say: "baylee", text: "\"Not good. Fun, though.\"" },
        { flag: "baylee_said_deck" },
        AFF("baylee", 1, "Asked about his deck"),
        { scene: "mutter_baylee" }
      ] },
      { text: "\"Big Stomp. You said it's not good. I don't think that's true.\"", when: (s)=>!!s.flags["baylee_said_deck"], steps: [
        { say: "rowan", text: "\"Big Stomp. You said it's not good. I don't think that's true.\"" },
        { say: "baylee", text: "\"Haven't seen it yet.\"" },
        { text: "He does not say it to argue. He says it as a point of order." },
        AFF("baylee", 1, "Stood up for his deck"),
        { scene: "mutter_baylee" }
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_baylee" },
        { end: true }
      ] }
    ] }
  ]
});

scene("mutter_baylee", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_baylee"], end: true },
    { text: "Rowan's eyes have gone somewhere a long way off. He talks to it, low and quick." },
    { say: "rowan", text: "\"…Güldefaber, Kit, Alex. Training. Performance. Stack the Summoning Magic until one hero can call a Gigantisaur. Four Chimeras to close. Stomp each turn for every hero beside a giant. Pier keeps the hand full.\" A beat. \"Slow. Honest. Heroes sit there for turns.\"" },
    { say: "baylee", text: "\"…Yup.\" A very long pause. \"You've seen it.\"" },
    { say: "rowan", text: "\"Online. A few times. Never next to the man who plays it.\"" },
    { say: "baylee", text: "\"Folks think I'm asleep, those first turns. I'm not asleep.\"" },
    { say: "baylee", text: "\"The big ones take a long time to come down. Gives a fella time to think.\"" },
    AFF("baylee", 1, "Knew the deck"),
    DECK("baylee")
  ]
});

scene("post_baylee", {
  steps: [
    DECK("baylee"),
    { when: (s)=>s.duels["ferry_baylee"]!=="won", jump: "lost" },
    { text: "Baylee turns his hand over, one big dinosaur at a time, and studies the board." },
    { say: "baylee", text: "\"You didn't attack at all.\"" },
    { say: "rowan", text: "\"I waited until you'd stacked your Summoning Magic and then I killed the hero that would have called the Chimera. You never got to call it.\"" },
    { say: "baylee", text: "\"Huh.\" Slowly. \"Good animal, that one. Big. Never got out of the barn.\"" },
    { say: "rowan", text: "\"If I'd let the Chimera land I'd have lost. It's the best card in your deck.\"" },
    { say: "baylee", text: "\"Don't tell Nathan I said that. He'd put it on a T-shirt.\"" },
    { jump: "after" },
    { label: "lost" },
    { text: "Baylee sets down his last giant. It is, you notice, almost apologetic." },
    { say: "baylee", text: "\"Chimera came down on turn six. After that it was mostly weight.\"" },
    { say: "rowan", text: "\"I should have killed Alex when he was still doing nothing. Everything else was built around him.\"" },
    { say: "baylee", text: "\"That's right.\"" },
    { text: "Pleased, and visibly embarrassed about being pleased." },
    { say: "baylee", text: "\"You'd have to get him early. Most folks don't.\"" },
    { say: "baylee", text: "\"Your storm's something, though. Hit three of my big ones at once. I'd not seen that.\"" },
    { label: "after" },
    { text: "He squares his cards into the box, slowly, each one the right way up." },
    { say: "baylee", text: "\"Your hands shook. First few turns. Then they quit.\"" },
    { choice: [
      { text: "\"You noticed.\"", steps: [
        { say: "rowan", text: "\"You noticed.\"" },
        { say: "baylee", text: "\"Calves do it. First time on a halter. Then they forget to.\"" },
        { say: "rowan", text: "\"Did I forget to?\"" },
        { say: "baylee", text: "\"About when you started counting my heroes.\"" }
      ] },
      { text: "\"I was hoping the cards would cover it.\"", steps: [
        { say: "rowan", text: "\"I was hoping the cards would cover it.\"" },
        { say: "baylee", text: "\"They did. Nobody was looking at yours. Folks look at mine.\"" },
        { text: "He holds one up. It is true that it is hard to look at anything else." }
      ] }
    ] },
    AFF("baylee", 1, "Talked it through")
  ]
});

scene("ferry_ed", {
  steps: [
    { when: (s)=>!!s.flags["met_ed"], jump: "again" },
    { text: "Somebody is hanging off the bow rail by one hand." },
    { text: "He is hanging the way other people stand, entirely at ease, the other hand holding a battered cowboy hat in place against the wind. The sea slides past thirty feet below his dangling boots." },
    { text: "Nobody else on the deck seems to find this remarkable." },
    { text: "You stop. You look. You look again. He is whistling." },
    { say: "ed", alias: "Boy in a battered hat", text: "\"Hey! Hey, you! Can you see it? The volcano? It's got a CRATER. I read about it. There's a hole in the middle you can walk down into!\"" },
    { choice: [
      { text: "\"I can see it. Would you mind coming back over the rail first? I'd rather not watch you go in.\"", steps: [
        { say: "rowan", text: "\"I can see it. Would you mind coming back over the rail first? I'd rather not watch you go in.\"" },
        { say: "ed", alias: "Boy in a battered hat", text: "\"Is it — is it dangerous, coming back over? That's what I'd want to know.\"" },
        { say: "rowan", text: "\"It's a lot less dangerous than staying out there.\"" },
        { say: "ed", alias: "Boy in a battered hat", text: "\"…Huh.\"" },
        { text: "He considers this for a moment, dangling." },
        { say: "ed", alias: "Boy in a battered hat", text: "\"That's a good point.\"" },
        AFF("ed", 1, "Worried about him")
      ] },
      { text: "\"That's a very long drop. Does that hand ever get tired?\"", steps: [
        { say: "rowan", text: "\"That's a very long drop. Does that hand ever get tired?\"" },
        { say: "ed", alias: "Boy in a battered hat", text: "\"Nope! It's the other hand that gets tired. I switch.\"" },
        { text: "He demonstrates, with a flourish. For half a second he is holding on to nothing at all, and the hat goes briefly airborne and is caught. Your stomach does the falling for him." },
        { say: "ed", alias: "Boy in a battered hat", text: "\"See? Fresh hand!\"" },
        AFF("ed", 1, "Asked a practical question")
      ] },
      { text: "\"A hole you can walk down into. Are they going to let you?\"", steps: [
        { say: "rowan", text: "\"A hole you can walk down into. Are they going to let you?\"" },
        { say: "ed", alias: "Boy in a battered hat", text: "\"There's a fence! I read that too! So somebody's been down there, or what would they need a fence for?\"" },
        { say: "rowan", text: "\"That is not what a fence means.\"" },
        { say: "ed", alias: "Boy in a battered hat", text: "\"It's what it means on a ranch. A fence means there's something on the other side worth having.\"" },
        AFF("ed", 1, "Argued about fences")
      ] }
    ] },
    { text: "He swings a leg up, hooks it over the rail with the grace of a boy who has done this on fences, and lands in a crouch on the planks, grinning as if the sun had just come up for him personally. There is a fresh bandage round his left hand, and both knees of his trousers have been through something." },
    { say: "ed", alias: "Boy in a battered hat", text: "\"Ed Venture. Lazy V Ranch, up on the high plains. Bungalow five, supposedly. They put the Commons on a beach. A BEACH. Who're you?\"" },
    MET("ed", "Ed Venture"),
    { choice: [
      { text: "\"Rowan Vance. Commons too, bungalow seven. Two doors down from you, if they number them in order.\"", steps: [
        { say: "rowan", text: "\"Rowan Vance. Commons too, bungalow seven. Two doors down from you, if they number them in order.\"" },
        { say: "ed", text: "\"Two doors! Rowan. That's a good name, it goes up and down, like a horse on a hill.\"" },
        { say: "rowan", text: "\"I've never been compared to a horse before.\"" },
        { say: "ed", text: "\"It's the highest compliment I've got!\"" }
      ] },
      { text: "\"Rowan. And I'd rather you didn't fall in the sea. I've only just met you.\"", steps: [
        { say: "rowan", text: "\"Rowan. And I'd rather you didn't fall in the sea. I've only just met you.\"" },
        { say: "ed", text: "\"Aw, I won't.\" He pats the rail as if it were a horse. \"I always have a plan. It's a small plan, usually, but it's got steps.\"" },
        { say: "rowan", text: "\"What are the steps?\"" },
        { say: "ed", text: "\"One: don't fall in. Two: if I fall in, swim.\" A beat. \"I haven't worked out three.\"" },
        AFF("ed", 1, "Wanted him dry")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He was hanging by ONE HAND! Rowan, that's a ranch thing, right? Is that a ranch thing?\"" },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "baylee", text: "\"It's a fence thing.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("ed", "Grew up on a ranch. Hangs off things. Wants to walk down into the volcano's crater."),
    { say: "ed", text: "\"You know how long it's been since I saw water I couldn't walk across? Never! It's never! The biggest water at home is the stock tank.\"" },
    { say: "ed", text: "\"This is the best thing that ever happened to me. Don't tell my mum, she'll think I've gone soft.\"" },
    { text: "While he talks he has climbed onto the lowest bar of the rail again, backwards, without appearing to notice. He rocks on his heels over the sea like a man waiting for a bus." },
    { choice: [
      { text: "\"Your secret's safe. What is a ranch hand doing at a card academy?\"", steps: [
        { say: "rowan", text: "\"Your secret's safe. What is a ranch hand doing at a card academy?\"" },
        { say: "ed", text: "\"Winter! You get snowed in for four months up there. Dad taught me knots and Mum taught me cards, and I ran out of knots.\"" },
        { say: "ed", text: "\"Then this letter comes, and it says 'Caldera Key', and I looked it up, and caldera means there's a VOLCANO. I'd have come for the word.\"" },
        { say: "rowan", text: "\"It's a card school, Ed.\"" },
        { say: "ed", text: "\"Sure! I'll do that as well!\"" },
        NOTE("ed", "Learned cards from his mum in the snowed-in winters. Says he came for the volcano."),
        AFF("ed", 1, "Asked why he came")
      ] },
      { text: "\"Ed. You're on the rail again.\"", steps: [
        { say: "rowan", text: "\"Ed. You're on the rail again.\"" },
        { text: "He looks down at his boots with real surprise." },
        { say: "ed", text: "\"Huh! So I am.\" He does not get off. \"It's just better up here. Down there you can only see where you are. Up here you can see where you're going.\"" },
        { say: "rowan", text: "\"And where's that?\"" },
        { say: "ed", text: "\"There!\" He points at the island with his whole body, and for one second only the heels of his boots are on the ship. \"All of it!\"" },
        AFF("ed", 1, "Didn't pull him down")
      ] },
      { text: "\"So what happens first, when we land?\"", hint: "Bold", steps: [
        { say: "rowan", text: "\"So what happens first, when we land?\"" },
        { text: "Ed's whole face lights up like a pinball machine." },
        { say: "ed", text: "\"Okay. Okay okay okay. I've got a MAP. Hang on. Not on me. It's in my bag.\"" },
        { say: "ed", text: "\"It's got all the forbidden places on it. Volcano rim, ruins field, the north shore. I'm going to all of them. All of them! You in?\"" },
        { choice: [
          { text: "\"I'll think about it.\"", steps: [
            { say: "rowan", text: "\"I'll think about it.\"" },
            { say: "ed", text: "\"That's a yes in ranch!\"" }
          ] },
          { text: "\"Somebody ought to come along and carry the bandages.\"", steps: [
            { say: "rowan", text: "\"Somebody ought to come along and carry the bandages.\"" },
            { say: "ed", text: "\"YES. See, that's planning!\" He holds up the bandaged hand as proof. \"I never plan the bandages!\"" }
          ] }
        ] },
        NOTE("ed", "Has a map of every forbidden place on the island, and plans to visit them all."),
        AFF("ed", 3, "Shared his enthusiasm"),
        { flag: "ed_map_offered" }
      ] }
    ] },
    { say: "ed", text: "\"Hey, where's your jacket? Did you lose it? I lost mine twice before the harbour.\"" },
    { say: "rowan", text: "\"I haven't got one yet. They're issuing it when we arrive.\"" },
    { say: "ed", text: "\"So you're the only one on the whole boat who can't lose his! That's lucky!\"" },
    { think: "It is the first time today that anybody has looked at the rain jacket and seen an advantage." },
    { time: 10 },
    { end: true },

    { label: "again" },
    { when: (s)=>!!s.flags["flag_ed_game"], jump: "played" },
    { text: "Ed is sitting on top of a ventilator cowl that he had no business being able to reach, hat on, sleeves rolled, swinging his boots." },
    { say: "ed", text: "\"Rowan! You want to play? I asked if we could do it up here, and a crewman said no before I'd even finished asking. He must get that a lot.\"" },
    { jump: "menu" },
    { label: "played" },
    { text: "Ed has found the hole the anchor chain goes down through, and is lying on his stomach looking into it with real longing." },
    { say: "ed", text: "\"Rowan! Hey! Did you see the lighthouse? It's real! They keep it lit in the daytime! I asked the captain why, and he said 'so nobody asks me that', and I HAD just asked him, so I don't think it works.\"" },
    { label: "menu" },
    { choice: [
      { text: "\"Sure, let's play. On a bench, with both feet on the deck.\"", when: (s)=>!s.flags["flag_ed_game"], steps: [
        { say: "rowan", text: "\"Sure, let's play. On a bench, with both feet on the deck.\"" },
        { say: "ed", text: "\"Fine, fine! Both feet! Mostly!\"" },
        { duel: "ferry_ed", opponent: "ed", opponentName: "Ed Venture", mustWin: false,
          onWin: [
            { say: "ed", text: "\"Ha! Whoa! You did a thing with the lightning! I didn't see that thing coming. Do it again! Not now. Now I'm dead. But some time!\"" },
            AFF("ed", 2, "Loved the loss")
          ],
          onLose: [
            { say: "ed", text: "\"WHOOP! Grab the shiny thing and figure it out on the way down! Good game, Rowan! GOOD game!\"" },
            AFF("ed", 2, "Won happily")
          ] },
        { scene: "post_ed" },
        { flag: "flag_ed_game" },
        { time: 25 }
      ] },
      { text: "\"Come down from there a minute, Ed. I want to hear about you.\"", when: (s)=>!s.flags["chat_ed_done"]&&!s.flags["flag_ed_game"], steps: [
        { say: "rowan", text: "\"Come down from there a minute, Ed. I want to hear about you.\"" },
        { say: "ed", text: "\"About ME? Sure! I'll come halfway!\"" },
        { scene: "chat_ed" }
      ] },
      { text: "\"Leave the anchor chain a minute, Ed. I want to hear about you.\"", when: (s)=>!s.flags["chat_ed_done"]&&!!s.flags["flag_ed_game"], steps: [
        { say: "rowan", text: "\"Leave the anchor chain a minute, Ed. I want to hear about you.\"" },
        { say: "ed", text: "\"About ME? Sure! It's not going anywhere. I checked, it's bolted.\"" },
        { scene: "chat_ed" }
      ] },
      { text: "\"I'll catch you later, Ed. I want to see the rest of the ship.\"", steps: [
        { say: "rowan", text: "\"I'll catch you later, Ed. I want to see the rest of the ship.\"" },
        { say: "ed", text: "\"Later! Great! Later's my second favourite time!\"" }
      ] }
    ] },
    { time: 5 }
  ]
});

scene("chat_ed", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_ed_1"]&&!!s.flags["chat_ed_2"]&&!!s.flags["chat_ed_3"]&&!!s.flags["chat_ed_x"], flag: "chat_ed_done", say: "ed", text: "\"That's all of me! Well — that's the top layer. Under that it's mostly scabs!\"", end: true },
    { choice: [
      { text: "\"Lazy V Ranch. What's it like up there?\"", when: (s)=>!s.flags["chat_ed_1"], steps: [
        { say: "rowan", text: "\"Lazy V Ranch. What's it like up there?\"" },
        { say: "ed", text: "\"Three thousand acres and one road, and the road's mostly a rumour! You can see weather coming for two hours. You can see the POSTMAN coming for two hours.\"" },
        { say: "ed", text: "\"I've been bucked off four horses, a bull, a barn roof and one very surprised goat. Not Pickles, though. Pickles is my horse. Pickles never once.\"" },
        { choice: [
          { text: "\"Start with the goat.\"", steps: [
            { say: "rowan", text: "\"Start with the goat.\"" },
            { say: "ed", text: "\"He was asleep! I thought he was a rock! In fairness, he thought I was a hawk.\"" },
            { say: "ed", text: "\"We're friends now. We call him Rock.\"" }
          ] },
          { text: "\"A barn roof can't buck.\"", steps: [
            { say: "rowan", text: "\"A barn roof can't buck.\"" },
            { say: "ed", text: "\"This one did! It was the wind. Dad says I was just standing in the wrong place, but the wrong place was the ROOF, so I say that's on the roof.\"" }
          ] }
        ] },
        { say: "ed", text: "\"Mum says I'm half rope. She's right, I was walking on a fence before I was walking on the ground.\"" },
        { say: "rowan", text: "\"And the other half?\"" },
        { say: "ed", text: "\"Hat!\"" },
        { text: "He looks down the deck, at the benches and the rail and thirty-odd strangers in stiff new jackets, and for once he is not looking for something to climb." },
        { say: "ed", text: "\"It's quiet up there, though. Real quiet. You can go a week and the only new thing is the sky. I've never seen this many people my own age in one place. I keep counting them.\"" },
        { say: "ed", text: "\"I want to know every one of them. Is that weird?\"" },
        { say: "rowan", text: "\"It's ambitious.\"" },
        { say: "ed", text: "\"I'll start with you! Done! That's one!\"" },
        AFF("ed", 1, "Asked about the ranch"),
        { flag: "chat_ed_1" },
        NOTE("ed", "Grew up on the Lazy V Ranch, where the only new thing in a week is the sky. His horse is called Pickles. Wants to know everyone on the ship."),
        { time: 3 }
      ] },
      { text: "\"You were the first one on this deck to spot the crater. Is that where you're headed first?\"", when: (s)=>!s.flags["chat_ed_2"], steps: [
        { say: "rowan", text: "\"You were the first one on this deck to spot the crater. Is that where you're headed first?\"" },
        { say: "ed", text: "\"The crater! Then the ruins field! Then the north shore. A guy in the lounge told me there's a sign up there that says DO NOT, in capitals, and then the paint's worn off. Do not WHAT? Somebody's got to go and find out what.\"" },
        { choice: [
          { text: "\"And if somebody gets hurt?\"", steps: [
            { say: "rowan", text: "\"And if somebody gets hurt?\"" },
            { say: "ed", text: "\"Then it's an adventure with a bandage!\"" },
            { say: "rowan", text: "\"Are you ever scared, Ed? Honestly.\"" },
            { text: "He takes the question seriously. He actually stops moving to think about it, which you have not seen him do before." },
            { say: "ed", text: "\"…Nope. I've checked. I get the feeling, the one in your stomach. It just feels like Christmas.\"" },
            { think: "He means it. That is the part that worries you." },
            NOTE("ed", "Says being scared feels like Christmas."),
            AFF("ed", 2, "Didn't tell him off")
          ] },
          { text: "\"There'll be a rule about every one of those places.\"", steps: [
            { say: "rowan", text: "\"There'll be a rule about every one of those places.\"" },
            { say: "ed", text: "\"Sure! That's how I know where to go! A rule's just a map that somebody else drew.\"" },
            { say: "rowan", text: "\"That's a terrible sentence, Ed.\"" },
            { say: "ed", text: "\"Thanks!\"" },
            AFF("ed", 1, "Called it terrible, kindly")
          ] }
        ] },
        { say: "ed", text: "\"There's a guy right up in the point of the bow with a rope on his belt. Real rope, not ship rope. I asked him if it was for climbing, and he looked at the island for about a minute and went 'Mm.' I think that was a yes.\"" },
        { when: (s)=>!s.flags["ed_map_offered"], say: "ed", text: "\"I've got a map in my bag with all the forbidden places on it, and I'm taking names for the crater. So far it's me. You in?\"" },
        { when: (s)=>!s.flags["ed_map_offered"], say: "rowan", text: "\"Put me down as a maybe.\"" },
        { when: (s)=>!s.flags["ed_map_offered"], say: "ed", text: "\"MAYBE'S ON THE LIST!\"" },
        { flag: "ed_map_offered" },
        { flag: "ed_said_rope_man" },
        { flag: "chat_ed_2" },
        NOTE("ed", "First on his list: the crater, the ruins field, the north shore."),
        { time: 3 }
      ] },
      { text: "\"Does the hat ever come off?\"", when: (s)=>!s.flags["chat_ed_3"], steps: [
        { say: "rowan", text: "\"Does the hat ever come off?\"" },
        { say: "ed", text: "\"**NO.**\"" },
        { text: "Very fast, and very serious. Then, cheerfully, a half-second later:" },
        { say: "ed", text: "\"It was my grandad's. Rule one. Nobody touches the hat.\"" },
        { choice: [
          { text: "\"I wasn't going to.\"", steps: [
            { say: "rowan", text: "\"I wasn't going to.\"" },
            { say: "ed", text: "\"I know! You're a good guy! You can *look* at it, though.\"" },
            { text: "He tilts the brim a quarter-inch towards you, with the air of a man unveiling a statue." }
          ] },
          { text: "\"And if the wind takes it, out here?\"", steps: [
            { say: "rowan", text: "\"And if the wind takes it, out here?\"" },
            { say: "ed", text: "\"Then I go after it.\"" },
            { say: "rowan", text: "\"Into the sea.\"" },
            { say: "ed", text: "\"Into wherever.\"" },
            { text: "He says it with no grin at all. You had not known his face could do that. Then the grin comes back, as if somebody had opened a shutter." },
            { say: "ed", text: "\"It won't, though! It knows where it lives.\"" }
          ] }
        ] },
        AFF("ed", 2, "Respected the hat"),
        { flag: "chat_ed_3" },
        NOTE("ed", "The hat was his grandfather's. Nobody touches it. He would go after it anywhere."),
        { time: 3 }
      ] },
      { text: "Ask about the bandage on his left hand.", when: (s)=>!s.flags["chat_ed_x"], steps: [
        { say: "rowan", text: "\"What happened to the hand?\"" },
        { say: "ed", text: "\"This? The harbour! There was a gull. It's fine, I started it.\"" },
        { say: "ed", text: "\"That's nothing, you should hear the real ones! Collarbone! Twice! Left wrist! Right ankle! A rib — I think it was a rib — and three toes! Not at once! In order!\"" },
        { say: "ed", text: "\"Mum kept the casts. She's got them on a shelf, there's a whole row. We call it the wall of fame.\"" },
        { choice: [
          { text: "\"That is more than I expected.\"", steps: [
            { say: "rowan", text: "\"That is more than I expected.\"" },
            { say: "ed", text: "\"It's a very *good* wall.\" He is glowing." }
          ] },
          { text: "\"Doesn't it hurt?\"", steps: [
            { say: "rowan", text: "\"Doesn't it hurt?\"" },
            { say: "ed", text: "\"Oh, loads! But only at the time.\"" }
          ] }
        ] },
        { say: "ed", text: "\"The nurse at the clinic back home knows me by my first name. She always does me a lollipop. Do you think they've got lollipops at the infirmary here? Do you think you have to earn them?\"" },
        { say: "ed", text: "\"You ever break anything?\"" },
        { say: "rowan", text: "\"A phone screen.\"" },
        { say: "ed", text: "\"Did you keep it?\"" },
        { say: "rowan", text: "\"…Yes, actually. It's still on the phone.\"" },
        { say: "ed", text: "\"See! Wall of fame!\"" },
        AFF("ed", 1, "Admired the wall of fame"),
        { flag: "chat_ed_x" },
        NOTE("ed", "Has broken a collarbone twice, a wrist, an ankle, a rib and three toes. His mum keeps the casts on a shelf."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_ed"], steps: [
        { scene: "deck_ed" }
      ] },
      { text: "\"I should go and look at the rest of the ship. See you, Ed.\"", steps: [
        { say: "rowan", text: "\"I should go and look at the rest of the ship. See you, Ed.\"" },
        { say: "ed", text: "\"See you on the sand! Bring rope!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("deck_ed", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_ed"], end: true },
    { choice: [
      { text: "\"Cowboy hat, ranch, boots over the rail. Horses, I'd say. Warhorse, Sun Sword, everything piled on one hero?\"", hint: "From his look", steps: [
        { say: "rowan", text: "\"Cowboy hat, ranch, boots over the rail. Horses, I'd say. Warhorse, Sun Sword, everything piled on one hero?\"" },
        { say: "ed", text: "\"Ha! Nope! Horses are lovely, I'd never say a word against a horse, but no.\"" },
        { say: "ed", text: "\"**MONKEES!** Two e's! Monkee Rodeo! The hat's for the *Rodeo!* Not the horse!\"" },
        { say: "rowan", text: "\"…Monkees. Right. That's — that's a better one than mine.\"" },
        AFF("ed", 1, "Guessed wrong, cheerfully")
      ] },
      { text: "\"What do you play, Ed?\"", steps: [
        { say: "rowan", text: "\"What do you play, Ed?\"" },
        { say: "ed", text: "\"Monkee Rodeo! Two e's! Every time I gain gold a Monkee wakes up and does something! Cheeky ones hit people, Nimble ones come out free, Non-Fungible ones pay twice!\"" },
        { say: "ed", text: "\"I don't actually understand the Non-Fungible ones. Dad says it's financial.\"" },
        AFF("ed", 1, "Asked about his deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_ed" },
        { end: true }
      ] }
    ] },
    { text: "Rowan has stopped listening to the joke. His eyes are on the sea and his voice drops to a rapid undertone." },
    { say: "rowan", text: "\"…Gold in, Monkee out. Cheeky hits, Nimble free, Resilient free. Non-Fungible pays when it comes and when it goes. Wealth. Treasure Chest. Golden Bananas. Real money goes onto Logan as Invest Counters, rolls over, deletes a hero at end of turn. Smug Coin. Bamboo Shield.\" He frowns. \"Logan's the smallest hero on the table. Freeze him and the bank stops. Right.\"" },
    { say: "ed", text: "\"Did he just say freeze my banker?\" He waves a hand in front of your face, with interest. \"Rowan? Can people DO that? He's not blinking.\"" },
    { say: "rowan", text: "\"Only if someone's watching the gold.\"" },
    { say: "ed", text: "\"Nobody watches the gold! They watch the Monkees! …You're going to watch the gold, aren't you.\"" },
    DECK("ed")
  ]
});

scene("post_ed", {
  steps: [
    DECK("ed"),
    { when: (s)=>s.duels["ferry_ed"]!=="won", jump: "lost" },
    { text: "Ed is flat on his back on the planks with his hat on his chest, grinning at the sky." },
    { say: "ed", text: "\"Whoa. I didn't see the Storm come back around. It just — kept zapping! Every turn! Is that allowed?\"" },
    { say: "rowan", text: "\"That's the whole deck. Gathering Storm attaches to a hero and keeps hitting three of your targets at the start of every turn.\"" },
    { say: "ed", text: "\"Three! Every turn! My bananas didn't stand a chance.\" He sits up. \"I gained a lot of gold, though. Did you see how much gold I gained?\"" },
    { say: "rowan", text: "\"I saw. If I hadn't destroyed Logan, that bank would have woken every Monkee at once.\"" },
    { say: "ed", text: "\"So you were scared of it! A bit! That's the nicest thing anybody's said about my deck.\"" },
    { jump: "after" },
    { label: "lost" },
    { text: "Ed leaps up and does a lap of the rail, hat held on with one hand." },
    { say: "ed", text: "\"I WON! Did you see Logan? Did you see how much gold? It was like a bank robbery but the other way!\"" },
    { say: "rowan", text: "\"You gained gold on three different turns and a Monkee woke up every time. I couldn't keep up.\"" },
    { say: "ed", text: "\"That's the whole deck!\" He grins. \"It's a good deck, right? It wasn't just the hat.\"" },
    { say: "rowan", text: "\"It wasn't the hat. Although the hat helps.\"" },
    { label: "after" },
    { say: "ed", text: "\"Again some time? On the island? Somewhere with a view?\"" },
    { say: "rowan", text: "\"Somewhere with a floor.\"" },
    { say: "ed", text: "\"A floor AND a view! You drive a hard bargain!\"" },
    AFF("ed", 1, "Talked it through")
  ]
});



scene("deck_georgie", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_georgie"], end: true },
    { choice: [
      { text: "\"That dragon on your bag. Is the deck dragons?\"", hint: "Ember is a clue", when: (s)=>!!s.flags["georgie_ember"], steps: [
        { say: "rowan", text: "\"That dragon on your bag. Is the deck dragons?\"" },
        { say: "georgie", text: "\"…Yes.\"" },
        { text: "Barely a whisper. Then, quicker, as if she must say it before she loses the nerve:" },
        { say: "georgie", text: "\"Hatchery. Dragons, and eggs. The eggs come first.\"" },
        AFF("georgie", 3, "Noticed Ember")
      ] },
      { text: "\"You went very quiet when I said 'eggs'. Was I close?\"", hint: "Something she let slip", when: (s)=>!!s.flags["georgie_egg_slip"], steps: [
        { say: "rowan", text: "\"You went very quiet when I said 'eggs'. Was I close?\"" },
        { say: "georgie", text: "\"I thought you'd seen my list.\" She breathes out. \"Hatchery. Dragons, and eggs. The eggs come first.\"" },
        { say: "rowan", text: "\"I was only talking about how you held the box.\"" },
        { say: "georgie", text: "\"That's worse. That means it shows.\"" },
        AFF("georgie", 2, "Guessed by accident")
      ] },
      { text: "\"Would it be all right if I asked what you play? You can say no.\"", steps: [
        { say: "rowan", text: "\"Would it be all right if I asked what you play? You can say no.\"" },
        { say: "georgie", text: "\"It's — Hatchery. Dragons and eggs. Rubin and Kit and Luna Pele, she's — it's fine. It's a good deck.\"" },
        { say: "georgie", text: "\"I said that too quietly, didn't I.\"" },
        AFF("georgie", 2, "Asked gently")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_georgie" },
        { end: true }
      ] }
    ] },
    { text: "Rowan has gone very still. When he speaks it is to the middle distance, soft and fast." },
    { say: "rowan", text: "\"…Icy, Flaming, Shimmering eggs. Free, one health. Worthless unless they break on your own turn. Sacrifice them into Green Dragoneer. Every sacrifice-summon, Rubin fires a Destruction spell on top. Black-Thorn Dragon, and neither can be touched by spells. Luna turns burns into cards.\" A breath. \"Tight. Never wastes a trigger.\"" },
    { say: "georgie", text: "\"You — you know the *order*.\"" },
    { text: "She has gone pink to the ears." },
    { say: "georgie", text: "\"Nobody knows the order.\"" },
    { say: "rowan", text: "\"I saw it online. I've never seen it from this side.\"" },
    { say: "georgie", text: "\"…It's the best part. Nobody asks about the best part.\"" },
    AFF("georgie", 1, "Knew the order of her deck"),
    DECK("georgie")
  ]
});

scene("post_georgie", {
  steps: [
    DECK("georgie"),
    { when: (s)=>s.duels["ferry_georgie"]!=="won", jump: "lost" },
    { text: "Georgie is looking at her last egg, which is still unbroken. She has gone very quiet." },
    { say: "georgie", text: "\"I couldn't break it. They only pay when they break on my turn, and you never let me have a turn where it mattered.\"" },
    { say: "rowan", text: "\"I killed Rubin before he could sacrifice. If he'd survived one more turn the eggs would have broken in your favour.\"" },
    { say: "georgie", text: "\"You noticed Rubin.\" A very small voice. \"Usually they notice the dragons.\"" },
    { say: "rowan", text: "\"The dragons are just what he throws.\"" },
    { text: "A tiny, astonished smile." },
    { say: "georgie", text: "\"That's — yes. That's what my dad says.\"" },
    { text: "She picks the plush dragon up off the planks and holds it, and looks at the board a little longer, and then at you. You brace for it. It does not come: she is not upset. She is, if anything, relieved." },
    { say: "georgie", text: "\"You're still talking to me.\"" },
    { say: "rowan", text: "\"Why wouldn't I be?\"" },
    { say: "georgie", text: "\"I don't know. I've not lost very often. I didn't know what happens next.\" A breath. \"This is all right.\"" },
    { jump: "after" },
    { label: "lost" },
    { text: "Georgie has already stacked her cards into a tidy pile and is holding the green plush dragon on her knee." },
    { say: "georgie", text: "\"You attacked on turn four. I thought you'd attack on turn three.\"" },
    { say: "rowan", text: "\"I wanted to see whether you'd break an egg early. You didn't, and then it was too late for me.\"" },
    { say: "georgie", text: "\"Everyone breaks an egg early.\" She looks at her hands. \"You're the first person who waited.\"" },
    { say: "georgie", text: "\"Would you — again? Some time. You don't have to.\"" },
    { say: "rowan", text: "\"Yes. I'd like to find out what turn five looks like.\"" },
    { say: "georgie", text: "\"Turn five is the good one.\"" },
    { label: "after" },
    AFF("georgie", 1, "Talked it through")
  ]
});

scene("ferry_viktor", {
  steps: [
    { when: (s)=>!!s.flags["met_viktor"], jump: "again" },
    { text: "Right in the point of the bow, past the anchor winch, where the deck narrows to nothing and the spray comes over, a man is sitting on a coil of mooring line with his back against the winch housing. He has picked the one spot on the fore deck that nobody walks past by accident." },
    { text: "He is lean and tanned, and older than the rest of the deck by a couple of years. A wide-brimmed grey-brown hat with a pale-blue feather in the band. A red jacket with a grey collar, worn like something borrowed. A coil of rope at his belt, and boots that are somehow already wet." },
    { text: "He is holding a brass compass flat on his palm. He looks from it to the island and back, and writes a small number on a creased map with a stub of pencil. He does not look up." },
    { choice: [
      { text: "\"What does the compass say?\"", steps: [
        { say: "rowan", text: "\"What does the compass say?\"" },
        { text: "He finishes the number first." },
        { say: "viktor", alias: "Man with a compass", text: "\"South-south-west. A little more west than it should be.\"" },
        { say: "viktor", alias: "Man with a compass", text: "\"The ship, not the compass. The captain is going round something.\"" },
        { say: "rowan", text: "\"A reef. He said so on the loudspeaker.\"" },
        { say: "viktor", alias: "Man with a compass", text: "\"Mm.\"" },
        { text: "The pencil makes a small cross in the printed sea." },
        { say: "viktor", alias: "Man with a compass", text: "\"Then the reef is bigger than the map thinks.\"" },
        AFF("viktor", 2, "Asked about the bearing")
      ] },
      { text: "Stand at the rail near him and say nothing for a while.", steps: [
        { text: "You watch the island. He takes two more bearings. The engine thrums, the bow lifts and comes down, and a gull hangs level with your face for a moment, looking you over." },
        { say: "viktor", alias: "Man with a compass", text: "\"You're in my line. Half a step left.\"" },
        { text: "You take half a step left." },
        { say: "viktor", alias: "Man with a compass", text: "\"Thank you. Most people ask what I'm doing first.\"" },
        { say: "rowan", text: "\"What are you doing?\"" },
        { say: "viktor", alias: "Man with a compass", text: "\"Second is also fine.\"" },
        AFF("viktor", 2, "Kept quiet first")
      ] },
      { text: "\"Is this the quiet end of the ship? I've been looking for one.\"", steps: [
        { say: "rowan", text: "\"Is this the quiet end of the ship? I've been looking for one.\"" },
        { say: "viktor", alias: "Man with a compass", text: "\"It was.\"" },
        { text: "The pencil stops. You are about to apologise when the brim of the hat tips a fraction towards the other end of the coil." },
        { say: "viktor", alias: "Man with a compass", text: "\"Sit. It still is, if you don't count the gulls.\"" },
        AFF("viktor", 1, "Wanted quiet too")
      ] }
    ] },
    { say: "rowan", text: "\"I'm Rowan.\"" },
    { say: "viktor", alias: "Man with a compass", text: "\"Viktor Hale. Commons. Bungalow five.\"" },
    MET("viktor", "Viktor Hale"),
    { text: "He turns the map so that you can see it. It is a printed map of the island, creased into eighths. Pencil lines fan out from a dot in the sea: one to the cone, one to the left shoulder of the land, one to a notch below the smoke that you had not noticed until the line pointed at it." },
    { say: "viktor", text: "\"Three bearings, and you know where you are. Six, and you know whether the map does.\"" },
    { choice: [
      { text: "\"And does it?\"", steps: [
        { say: "rowan", text: "\"And does it?\"" },
        { say: "viktor", text: "\"The coast, yes. Somebody walked the coast. The middle was drawn from a boat, by a person who never went in.\"" },
        { say: "viktor", text: "\"Look.\" The pencil taps the green part. \"The contours are too tidy. Real ground is not so polite.\"" },
        AFF("viktor", 1, "Asked the next question")
      ] },
      { text: "\"You know it's a card academy we're going to?\"", steps: [
        { say: "rowan", text: "\"You know it's a card academy we're going to?\"" },
        { say: "viktor", text: "\"Class. Yes. I was going to go to that.\"" },
        { text: "Nothing in his face moves. You are fairly sure it was a joke. You are less sure it was only a joke." },
        { say: "viktor", text: "\"I have a deck. It's in the bag. Under the rope.\"" },
        { say: "rowan", text: "\"That's a long way down the bag, for a first-year.\"" },
        { say: "viktor", text: "\"The rope gets used more.\"" },
        { flag: "viktor_said_deck" },
        AFF("viktor", 1, "Took the joke")
      ] },
      { text: "Look where the third line points. \"What is that notch?\"", when: (s)=>s.minutes<585, steps: [
        { text: "You follow the pencil line off the paper and out over the water. Below the thread of smoke, a little to the left, there is a dark nick in the island's outline." },
        { say: "rowan", text: "\"What is that? Under the smoke.\"" },
        { say: "viktor", text: "\"A valley. Or a shadow. Ask me at ten.\"" },
        { say: "rowan", text: "\"Why ten?\"" },
        { say: "viktor", text: "\"The sun will have moved. Shadows move. Valleys don't.\"" },
        { flag: "viktor_notch" },
        AFF("viktor", 2, "Looked where he pointed")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He's got a COMPASS! And a ROPE! Are you a pirate? You can tell us, we're the Commons too!\"" },
    { when: (s)=>!!s.flags["follow_nathan"], text: "Viktor Hale looks at Nathan for about as long as he looked at the last bearing, and writes nothing down." },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "baylee", text: "\"Good knot, that. On the belt.\"" },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "viktor", text: "\"Bowline on a bight.\" To Baylee, with something that is nearly approval. \"You tie?\"" },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "baylee", text: "\"Hay bales.\"" },
    { text: "For the first time he looks at you instead of at the horizon. It is brief, and it takes in the rain jacket." },
    { say: "viktor", text: "\"No jacket. So you were late, or you were added.\"" },
    { choice: [
      { text: "\"They're issuing it when we land. The letter says I'll be conspicuous until then.\"", steps: [
        { say: "rowan", text: "\"They're issuing it when we land. The letter says I'll be conspicuous until then.\"" },
        { say: "viktor", text: "\"You are. From the bridge you would be the one thing on this deck that is not a uniform. Useful, if somebody needs to find you. Bad, if you would prefer they didn't.\"" },
        { say: "rowan", text: "\"Which do you expect?\"" },
        { say: "viktor", text: "\"I don't know you yet.\"" }
      ] },
      { text: "\"Late. You don't look as if you came straight from school either.\"", steps: [
        { say: "rowan", text: "\"Late. You don't look as if you came straight from school either.\"" },
        { say: "viktor", text: "\"Twenty-one. Also late, in a different way.\"" },
        { text: "He does not say which way. He goes back to the compass, and the subject closes like a hatch." }
      ] }
    ] },
    { when: (s)=>!!s.flags["met_ed"], say: "viktor", text: "\"The one in the cowboy hat has been here twice. He asked whether the rope was for climbing. Then he asked what there was to climb. I said very little. He seemed to take that as a list.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("viktor", "Older than the other first-years. Takes compass bearings on the island and checks the printed map against them."),
    { time: 8 },
    { end: true },

    { label: "again" },
    { when: (s)=>!!s.flags["viktor_notch"]&&!s.flags["viktor_notch_done"]&&s.minutes>=600, jump: "notch" },
    { text: "Viktor has not moved from the bow, but the map has: there are more pencil lines on it, and the island at the end of them is larger." },
    { say: "viktor", text: "\"Rowan.\"" },
    { text: "That is the whole greeting. He moves one boot off the coil of mooring line, which you decide to take as an invitation." },
    { jump: "menu" },
    { label: "notch" },
    { flag: "viktor_notch_done" },
    { text: "Viktor does not look round when you come up. He holds out the map instead. There is a new line on it, heavier than the others." },
    { say: "viktor", text: "\"It's past ten. The shadow moved. The notch didn't.\"" },
    { say: "rowan", text: "\"So it's a valley.\"" },
    { say: "viktor", text: "\"So it's something. It isn't on this map, which is more interesting than if it were.\"" },
    AFF("viktor", 1, "Came back at ten"),
    NOTE("viktor", "Found a notch in the island's outline that the printed map does not show."),
    { label: "menu" },
    { choice: [
      { text: "\"Mind if I sit a while?\"", when: (s)=>!s.flags["chat_viktor_done"], steps: [
        { say: "rowan", text: "\"Mind if I sit a while?\"" },
        { scene: "chat_viktor" }
      ] },
      { text: "\"I'll leave you the horizon.\"", steps: [
        { say: "rowan", text: "\"I'll leave you the horizon.\"" },
        { say: "viktor", text: "\"It'll keep.\"" }
      ] }
    ] },
    { time: 4 }
  ]
});

scene("chat_viktor", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_viktor_1"]&&!!s.flags["chat_viktor_2"]&&!!s.flags["chat_viktor_3"]&&(!!s.flags["chat_viktor_4"]||!s.flags["met_ed"]), flag: "chat_viktor_done", say: "viktor", text: "\"That's more than I usually say before land.\" He lifts the compass again, and that is that.", end: true },
    { choice: [
      { text: "\"The rope, the compass, the boots. You didn't learn any of that at a card table.\"", when: (s)=>!s.flags["chat_viktor_1"], steps: [
        { say: "rowan", text: "\"The rope, the compass, the boots. You didn't learn any of that at a card table.\"" },
        { say: "viktor", text: "\"Greenland. Then Jordan. Survey crews.\"" },
        { say: "viktor", text: "\"You carry poles for people with degrees. You learn where not to put your feet.\"" },
        { choice: [
          { text: "\"Ice, and then desert. That's an odd pair.\"", steps: [
            { say: "rowan", text: "\"Ice, and then desert. That's an odd pair.\"" },
            { say: "viktor", text: "\"Same work. You find the edge of something nobody has measured. In one of them you are cold.\"" },
            { text: "A long pause. You think he has finished." },
            { say: "viktor", text: "\"In the other one also. At night. Nobody tells you that.\"" },
            AFF("viktor", 1, "Let him finish")
          ] },
          { text: "\"And after that, a volcano with a school on it. Why here?\"", steps: [
            { say: "rowan", text: "\"And after that, a volcano with a school on it. Why here?\"" },
            { text: "He checks the compass. It has not changed, and he does not seem to have expected it to." },
            { say: "viktor", text: "\"Volcanic ground is young. Some of what is under that smoke will be younger than I am. I have never walked on anything so new.\"" },
            { think: "That was not an answer. It was a very interesting way of not giving one, and you find you do not mind." },
            AFF("viktor", 1, "Didn't push")
          ] }
        ] },
        { flag: "chat_viktor_1" },
        NOTE("viktor", "Worked on survey crews in Greenland and Jordan before he came to the Academy."),
        { time: 3 }
      ] },
      { text: "\"And the cards? You must have a deck somewhere.\"", when: (s)=>!s.flags["chat_viktor_2"], steps: [
        { when: (s)=>!s.flags["viktor_said_deck"], say: "rowan", text: "\"And the cards? You must have a deck somewhere.\"" },
        { when: (s)=>!!s.flags["viktor_said_deck"], say: "rowan", text: "\"That deck under the rope. What's in it?\"" },
        { say: "viktor", text: "\"Sand.\"" },
        { text: "He lets the word sit there for a while, as if it covered everything." },
        { say: "viktor", text: "\"Mummies. Traps. A camel. Things that were buried, mostly. I didn't build it. I collected it. I can tell you where I got every card.\"" },
        { choice: [
          { text: "\"Where did you get the camel?\"", steps: [
            { say: "rowan", text: "\"Where did you get the camel?\"" },
            { say: "viktor", text: "\"Aqaba. A man in the market was using it as a bookmark. I gave him a better bookmark.\"" },
            { say: "rowan", text: "\"What was the book?\"" },
            { text: "The hat brim comes round. For a second he is plainly pleased to have been asked that and not the other thing." },
            { say: "viktor", text: "\"Tide tables. Three years out of date. He said he liked the pictures.\"" },
            AFF("viktor", 2, "Asked where, not what")
          ] },
          { text: "\"That's not how anybody builds a deck.\"", steps: [
            { say: "rowan", text: "\"That's not how anybody builds a deck.\"" },
            { say: "viktor", text: "\"No. It loses to the ones who do.\"" },
            { text: "He does not sound troubled by it." },
            { say: "viktor", text: "\"But I know where each of mine has been. They only know what theirs do.\"" },
            { say: "rowan", text: "\"At a card academy, that second thing is most of the marks.\"" },
            { say: "viktor", text: "\"So I'm told.\"" },
            AFF("viktor", 1, "Said it straight")
          ] }
        ] },
        { flag: "chat_viktor_2" },
        NOTE("viktor", "Plays a pile of desert cards he has collected one at a time. Remembers where each one came from."),
        { time: 3 }
      ] },
      { text: "\"The feather in your hatband. Is that from somewhere too?\"", when: (s)=>!s.flags["chat_viktor_3"], steps: [
        { say: "rowan", text: "\"The feather in your hatband. Is that from somewhere too?\"" },
        { say: "viktor", text: "\"The quay, last night. Heron, I think. It was lying by a bollard and everyone was stepping over it.\"" },
        { say: "viktor", text: "\"It seemed a waste of a feather.\"" },
        { when: (s)=>!!s.flags["chat_georgie_1"], say: "rowan", text: "\"You're the second person today who's told me that. There's a girl on a coil of rope back there with a dark-purple one. Same reason.\"" },
        { when: (s)=>!!s.flags["chat_georgie_1"], say: "viktor", text: "\"Then she has good eyes.\" He glances down the deck, once, to see for himself. \"Most people only pick up what they came for.\"" },
        { when: (s)=>!s.flags["chat_georgie_1"], say: "rowan", text: "\"So you pick things up.\"" },
        { when: (s)=>!s.flags["chat_georgie_1"], say: "viktor", text: "\"Things that are where they shouldn't be. It's usually worth asking how they got there.\"" },
        { say: "rowan", text: "\"And if it had only been a feather?\"" },
        { say: "viktor", text: "\"Then I have a feather.\"" },
        AFF("viktor", 1, "Noticed the feather"),
        { flag: "chat_viktor_3" },
        NOTE("viktor", "Picks up things that are where they should not be. The feather in his hat came off the quay."),
        { time: 2 }
      ] },
      { text: "\"Bungalow five. You're sharing with Ed, then. The hat, the rail, no fear at all.\"", when: (s)=>!!s.flags["met_ed"]&&!s.flags["chat_viktor_4"], steps: [
        { say: "rowan", text: "\"Bungalow five. You're sharing with Ed, then. The hat, the rail, no fear at all.\"" },
        { say: "viktor", text: "\"I know.\"" },
        { text: "A long pause, with the engine in it." },
        { say: "viktor", text: "\"He asked me the name of every knot on this belt. Then he tied two of them. Badly. But from memory, after seeing them once.\"" },
        { say: "viktor", text: "\"He'll follow me. That kind does.\"" },
        { choice: [
          { text: "\"Is that a problem?\"", steps: [
            { say: "rowan", text: "\"Is that a problem?\"" },
            { say: "viktor", text: "\"It's a second water bottle.\"" }
          ] },
          { text: "\"He wants to walk down into the crater. He told me before he'd told me his name.\"", steps: [
            { say: "rowan", text: "\"He wants to walk down into the crater. He told me before he'd told me his name.\"" },
            { say: "viktor", text: "\"Then somebody should go first and see whether it holds.\"" },
            { say: "rowan", text: "\"You?\"" },
            { say: "viktor", text: "\"I didn't say that.\" He turns the compass over in his fingers. \"Probably me.\"" },
            AFF("viktor", 1, "Worried about the same boy")
          ] }
        ] },
        { flag: "chat_viktor_4" },
        REL("ed", "viktor"),
        NOTE("viktor", "Shares bungalow 5 with Ed, and expects to be followed."),
        { time: 2 }
      ] },
      { text: "\"I'll let you get back to your bearings.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to your bearings.\"" },
        { say: "viktor", text: "\"Mind the wet patch. The bow takes one in ten.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("isle_ed", {
  steps: [
    { when: (s)=>!!s.flags["isle_ed_done"], jump: "later" },
    { text: "Behind the bungalow row the sand runs down to the cove in one long white slope. A pair of boots is standing at the foot of a palm tree, side by side, as if waiting for a bus. Their owner is three-quarters of the way up the trunk, gripping it with knees and elbows, in a battered cowboy hat." },
    { when: (s)=>!!s.flags["met_ed"], say: "ed", text: "\"Rowan! Don't look up, there's sand coming down! No, do look up! You can see EVERYTHING from here!\"" },
    { when: (s)=>!s.flags["met_ed"], say: "ed", alias: "Boy in a battered hat", text: "\"Hey! You're Rowan! The Wildcard, they read you out! Don't look up, there's sand coming down! No, do look up!\"" },
    { when: (s)=>!s.flags["met_ed"], say: "ed", alias: "Boy in a battered hat", text: "\"Ed Venture! Lazy V Ranch! Bungalow five! I'd shake, but I need both hands for another minute.\"" },
    MET("ed", "Ed Venture"),
    { say: "ed", text: "\"The whole cove! All eight roofs! Somebody's washing! And there's a path that goes up into the trees behind the last bungalow, and I can't see where it comes out. I've been looking for ten minutes. It goes in and it doesn't come out.\"" },
    { choice: [
      { text: "\"How exactly are you planning to get down?\"", steps: [
        { say: "rowan", text: "\"How exactly are you planning to get down?\"" },
        { say: "ed", text: "\"…Huh.\"" },
        { text: "He looks down the trunk, past his own bare feet, as if seeing it for the first time." },
        { say: "ed", text: "\"Same way, I guess. Backwards. Back home a tree has branches, it's basically a ladder. This one's a pole. I respect it.\"" },
        AFF("ed", 1, "Thought about the way down")
      ] },
      { text: "\"A path that doesn't come out. And you've asked somebody about it already.\"", steps: [
        { say: "rowan", text: "\"A path that doesn't come out. And you've asked somebody about it already.\"" },
        { say: "ed", text: "\"Mama Odalys! She said 'no' before I'd got to the question mark. Then she gave me a biscuit. I think the biscuit was so I'd stop.\"" },
        { say: "rowan", text: "\"Did you stop?\"" },
        { say: "ed", text: "\"I ate the biscuit!\"" },
        AFF("ed", 1, "Guessed he'd asked")
      ] },
      { text: "\"Is the palm tree on your map of forbidden places?\"", when: (s)=>!!s.flags["ed_map_offered"], steps: [
        { say: "rowan", text: "\"Is the palm tree on your map of forbidden places?\"" },
        { say: "ed", text: "\"No! The map's all the big stuff. This is practice. You've got to do a small high thing before a big deep thing.\"" },
        { say: "ed", text: "\"You still coming to the crater? You never said no. I checked.\"" },
        { say: "rowan", text: "\"I never said no.\"" },
        { say: "ed", text: "\"That's what I've got written down!\"" },
        AFF("ed", 2, "Remembered the map")
      ] }
    ] },
    { when: (s)=>!!s.flags["placement_won"], say: "ed", text: "\"Hey, I watched your duel! From the back of the top bench! You WON it, in front of everybody! I forgot to ask who won mine. There was a bird in the dome.\"" },
    { when: (s)=>!!s.flags["placement_done"]&&!s.flags["placement_won"], say: "ed", text: "\"Hey, I watched your duel! From the back of the top bench! Didn't go your way, huh. I forgot to ask who won mine. There was a bird in the dome.\"" },
    { text: "He shifts his grip, and a small landslide of bark comes down past you. For a moment he is quiet, looking out over the roofs at the water." },
    { say: "ed", text: "\"It's hot, though. Real hot. My horse would hate it. And tonight's the first night of my life I won't be able to hear a cow. Do you think that's going to be loud or quiet?\"" },
    { choice: [
      { text: "\"Loud. The sea doesn't stop.\"", steps: [
        { say: "rowan", text: "\"Loud. The sea doesn't stop.\"" },
        { say: "ed", text: "\"Good.\" He means it. \"I don't think I'd know what to do with quiet that wasn't ours.\"" }
      ] },
      { text: "\"Ask me tomorrow. I'll tell you how I slept.\"", steps: [
        { say: "rowan", text: "\"Ask me tomorrow. I'll tell you how I slept.\"" },
        { say: "ed", text: "\"I will! I'll come and knock! Seven's two doors down, I counted from up here!\"" },
        AFF("ed", 1, "Invited him to knock")
      ] }
    ] },
    { say: "ed", text: "\"Mama says supper's at six, and anybody who's up a tree at six doesn't get any. So that's my deadline. I've never had a deadline before!\"" },
    NOTE("ed", "Was up a palm tree behind the bungalow row on his first afternoon. Has never spent a night out of earshot of a cow."),
    { flag: "isle_ed_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Ed is still up the palm. He has got one leg hooked over the place where the fronds begin, and looks as comfortable as a man in an armchair." },
    { say: "ed", text: "\"Still up! I'm resting. There's a sort of knee in the tree. The coconuts aren't ripe, I knocked on one.\"" },
    { say: "rowan", text: "\"Six o'clock, Ed.\"" },
    { say: "ed", text: "\"I know! I can see the kitchen chimney from here. When it smokes, I slide.\"" },
    { time: 3 }
  ]
});

scene("isle_viktor", {
  steps: [
    { when: (s)=>!!s.flags["isle_viktor_done"], jump: "later" },
    { text: "At the west end of the cove, where the bungalows give out and the sand turns to black rock, a man in a wide-brimmed hat stands exactly on the tide line with a map in one hand and a brass compass in the other. Each wave runs over his boots. He has his back to the sea. He is looking inland, up over the roofs and the trees, at the volcano." },
    { when: (s)=>!!s.flags["met_viktor"], say: "viktor", text: "\"Rowan.\"" },
    { when: (s)=>!!s.flags["met_viktor"]&&!!s.flags["viktor_notch_done"], say: "viktor", text: "\"You can see the notch from here.\" The pencil points, once. \"The green goes into it. So, a valley.\"" },
    { when: (s)=>!!s.flags["met_viktor"]&&!!s.flags["viktor_notch"]&&!s.flags["viktor_notch_done"], say: "viktor", text: "\"You didn't ask me at ten.\" The pencil points up at the mountain, once. \"It was a valley. The green goes into it.\"" },
    { when: (s)=>!s.flags["met_viktor"], say: "viktor", alias: "Man with a compass", text: "\"You're Vance. From the roll call.\"" },
    { when: (s)=>!s.flags["met_viktor"], text: "He says it without turning round. You wonder how he knew, and then see your shadow lying across his map." },
    { when: (s)=>!s.flags["met_viktor"], say: "viktor", alias: "Man with a compass", text: "\"Viktor Hale. Bungalow five.\"" },
    MET("viktor", "Viktor Hale"),
    { say: "viktor", text: "\"The printed map has this cove too wide. By a good deal. I paced it.\"" },
    { choice: [
      { text: "\"Everybody else on this beach is looking at the sea.\"", steps: [
        { say: "rowan", text: "\"Everybody else on this beach is looking at the sea.\"" },
        { say: "viktor", text: "\"The sea is the same from every beach. That is not.\"" },
        { say: "viktor", text: "\"Watch the smoke. Straight up, as far as the shoulder. Then it leans east. So there is wind up there that we don't have down here. Good to know before one walks.\"" },
        { say: "rowan", text: "\"Before one walks where?\"" },
        { say: "viktor", text: "\"Up.\"" },
        AFF("viktor", 2, "Looked the same way")
      ] },
      { text: "\"Have you been inside your bungalow at all?\"", steps: [
        { say: "rowan", text: "\"Have you been inside your bungalow at all?\"" },
        { say: "viktor", text: "\"I put the bag on the bed. I put the rope on the bag.\"" },
        { when: (s)=>!!s.flags["met_ed"], say: "viktor", text: "\"Ed asked which bunk I wanted. I said the one by the door. He said he'd have picked that one too, for getting out fast. I said yes.\"" },
        { when: (s)=>!s.flags["met_ed"], say: "viktor", text: "\"The boy in the cowboy hat asked which bunk I wanted. I said the one by the door. He said he'd have picked that one too, for getting out fast. I said yes.\"" },
        { text: "A wave comes in over his boots and goes out again." },
        { say: "viktor", text: "\"Different reasons.\"" },
        AFF("viktor", 1, "Asked a plain question")
      ] },
      { text: "\"Mama Odalys says nobody eats alone. Supper's at six.\"", steps: [
        { say: "rowan", text: "\"Mama Odalys says nobody eats alone. Supper's at six.\"" },
        { say: "viktor", text: "\"I heard. She said it to me in particular. Twice.\"" },
        { text: "He looks at the mountain, and then at the angle of the sun, like a man doing a sum he already knows the answer to." },
        { say: "viktor", text: "\"I'll try.\"" },
        { think: "You would not put Smug Coins on it." }
      ] }
    ] },
    { when: (s)=>!!s.flags["placement_done"], say: "viktor", text: "\"They called me to the domes at half past one, with the rest of the row. I went. It seemed polite. The light is better down here.\"" },
    { text: "He folds the map along a crease that is not one of the printer's, and looks at you as if you were a piece of equipment that might do." },
    { say: "viktor", text: "\"You could be useful. Stand by that rock. The one with the weed on it. Face me.\"" },
    { choice: [
      { text: "Go and stand by the rock.", steps: [
        { text: "You walk to the rock. The sand is hot through your shoes. He raises the compass, sights along it at you, turns a quarter, sights at the volcano, and writes down two numbers." },
        { say: "viktor", text: "\"Thank you. A hundred and twelve paces. Now I have a baseline.\"" },
        { say: "rowan", text: "\"Glad to be a unit of measurement.\"" },
        { say: "viktor", text: "\"You held still. It's more than most people manage on a first day.\"" },
        { flag: "viktor_baseline" },
        AFF("viktor", 2, "Stood where he asked")
      ] },
      { text: "\"What am I, if I stand there?\"", steps: [
        { say: "rowan", text: "\"What am I, if I stand there?\"" },
        { say: "viktor", text: "\"A fixed point. I'm short of them.\"" },
        { text: "You go and stand by the rock. He sights along the compass at you, then at the volcano, and writes down two numbers." },
        { say: "viktor", text: "\"A hundred and twelve paces. You can move now. Or not. It's a good rock.\"" },
        { flag: "viktor_baseline" },
        AFF("viktor", 1, "Asked, then did it")
      ] }
    ] },
    NOTE("viktor", "Spent the first afternoon pacing out the Commons cove and correcting the printed map. Looks at the volcano, not the sea."),
    { flag: "isle_viktor_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Viktor has moved twenty yards along the tide line. The map has a new triangle on it, drawn very fine, with the rock at one corner." },
    { say: "viktor", text: "\"A hundred and twelve. I paced it back to be sure. You're in the triangle now, as a dot.\"" },
    { say: "rowan", text: "\"Is it a good likeness?\"" },
    { say: "viktor", text: "\"It's where you were. That's all a map can promise.\"" },
    { time: 3 }
  ]
});

scene("isle_georgie", {
  steps: [
    { when: (s)=>!!s.flags["isle_georgie_done"], jump: "later" },
    { text: "The lawn by the Trial Domes is dotted with white-and-gold collars, standing about in twos and threes and pretending not to watch the doors. At the very edge of the grass, where the shade of a dome begins, a small girl in a jacket one size too big is sitting cross-legged with a deck box in both hands. A dark-purple feather is pinned in her hair, and a green plush dragon sits in her lap, facing the domes." },
    { when: (s)=>!!s.flags["met_georgie"], say: "georgie", text: "\"Hi, Rowan.\"" },
    { when: (s)=>!!s.flags["met_georgie"]&&!!s.flags["flag_georgie_played"], say: "georgie", text: "\"The tables in there light up. It isn't like our bit of deck. I looked through the door.\"" },
    { when: (s)=>!!s.flags["met_georgie"]&&!!s.flags["georgie_game_later"]&&!s.flags["flag_georgie_played"], say: "georgie", text: "\"It still isn't later. It's fine. There's a whole year.\"" },
    { when: (s)=>!s.flags["met_georgie"], say: "georgie", alias: "Girl with the dark-purple feather", text: "\"You're Rowan Vance. They read it out on the Quad.\" She goes pink. \"Is it all right that I know that already? I'm Georgie. Santa. Georgie Santa.\"" },
    MET("georgie", "Georgie Santa"),
    { say: "georgie", text: "\"They gave me a suite in the tower. It has five doors. One of them is a cupboard, but I counted it.\"" },
    { say: "georgie", text: "\"We get called one at a time, by the alphabet. I'm an S.\" Her fingers are white on the box. \"I don't mind the duel. I mind the walking in.\"" },
    { choice: [
      { text: "\"I've done mine. The walking in is the worst of it. After that it's only cards.\"", when: (s)=>!!s.flags["placement_done"], steps: [
        { say: "rowan", text: "\"I've done mine. The walking in is the worst of it. After that it's only cards.\"" },
        { say: "georgie", text: "\"Did your hands —\" She stops. \"That's the question I hate. You don't have to.\"" },
        { say: "rowan", text: "\"They shook. Then they stopped.\"" },
        { say: "georgie", text: "\"They do stop.\"" },
        { text: "She nods, relieved, as if you had confirmed a ruling." },
        AFF("georgie", 2, "Told her how it went")
      ] },
      { text: "\"Mine's still to come. I'm trying not to think about the walking in either.\"", when: (s)=>!s.flags["placement_done"], steps: [
        { say: "rowan", text: "\"Mine's still to come. I'm trying not to think about the walking in either.\"" },
        { say: "georgie", text: "\"Count the steps. It's usually about fourteen. Then there's a table, and you know what to do at a table.\"" },
        { say: "rowan", text: "\"Fourteen.\"" },
        { say: "georgie", text: "\"About.\" Very seriously. \"Don't stop at fourteen if you're not there yet.\"" },
        AFF("georgie", 2, "Admitted it too")
      ] },
      { text: "\"Would it help to have a friendly face on the benches?\"", steps: [
        { say: "rowan", text: "\"Would it help to have a friendly face on the benches?\"" },
        { say: "georgie", text: "\"Are you allowed? You're the Commons.\"" },
        { say: "rowan", text: "\"I don't think anybody checks collars on a bench.\"" },
        { say: "georgie", text: "\"Then — yes. Please.\" Quickly: \"At the side. Not the front. If you're at the front I'll look.\"" },
        { flag: "georgie_bench_promise" },
        AFF("georgie", 2, "Offered to sit in")
      ] },
      { text: "\"Where does the dragon sit, while you play?\"", steps: [
        { say: "rowan", text: "\"Where does the dragon sit, while you play?\"" },
        { say: "georgie", text: "\"On the table edge. Left side. I asked the judge whether that's permitted. The one with the red glasses.\"" },
        { say: "rowan", text: "\"What did she say?\"" },
        { say: "georgie", text: "\"She said, 'Is it a card?' And I said no. And she said then she had no opinion on it.\" A tiny, astonished smile. \"I think that was a yes.\"" },
        AFF("georgie", 1, "Asked after the dragon")
      ] }
    ] },
    { text: "Across the lawn a very small boy with flame-orange hair comes round the nearest dome at a sprint, sleeves flapping past his hands, and vanishes round it again." },
    { when: (s)=>!!s.flags["met_branden"], say: "georgie", text: "\"That's eleven times. Branden says he's warming up.\"" },
    { when: (s)=>!s.flags["met_branden"], say: "georgie", text: "\"That's eleven times. He says he's warming up. He's ten.\"" },
    { choice: [
      { text: "\"Do you warm up?\"", steps: [
        { say: "rowan", text: "\"Do you warm up?\"" },
        { say: "georgie", text: "\"No. I sit still and get cold, and then it starts, and then I'm not cold.\"" },
        { text: "The flame-orange hair comes round again. She watches it go, and for a second she looks as if she would rather like to know what running round a dome is for." },
        { say: "georgie", text: "\"Twelve.\"" }
      ] },
      { text: "\"You could go round once. Nobody's stopping you.\"", steps: [
        { say: "rowan", text: "\"You could go round once. Nobody's stopping you.\"" },
        { say: "georgie", text: "\"I'd have to put the box down.\"" },
        { text: "She says it as if you had suggested putting down an arm. Then she looks at the dome, and at the grass, measuring it." },
        { say: "georgie", text: "\"…Maybe after. If I win.\" A breath. \"I'm going to win. That wasn't boasting. It's just what happens.\"" },
        AFF("georgie", 1, "Thought she might run")
      ] }
    ] },
    { text: "A door opens in the second dome, and a voice calls a name. It is not hers. She breathes out." },
    { say: "georgie", text: "\"Not yet.\"" },
    NOTE("georgie", "Before a duel she minds the walking in, not the game."),
    { flag: "isle_georgie_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "Georgie has not moved from the edge of the shade. The dragon has been turned a few degrees, to keep the dome door in view." },
    { when: (s)=>!!s.flags["georgie_bench_promise"], say: "georgie", text: "\"Still not yet.\" She looks up. \"At the side. You said.\"" },
    { when: (s)=>!!s.flags["georgie_bench_promise"], say: "rowan", text: "\"At the side.\"" },
    { when: (s)=>!s.flags["georgie_bench_promise"], say: "georgie", text: "\"Still not yet. It's fine. Waiting is most of it.\"" },
    { when: (s)=>!s.flags["georgie_bench_promise"], say: "rowan", text: "\"The walking in is the short part.\"" },
    { when: (s)=>!s.flags["georgie_bench_promise"], say: "georgie", text: "\"I know. I measured it.\"" },
    { time: 3 }
  ]
});
