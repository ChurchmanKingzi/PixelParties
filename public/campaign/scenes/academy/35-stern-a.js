// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS, ALPHA } = helpers;
/* ===================================================================== JESSICA */
scene("ferry_jessica", {
  steps: [
    { when: (s)=>!!s.flags["met_jessica"], jump: "again" },
    { text: "Beside a crewman's trolley stacked with three leather caskets, a beautiful girl sits in a deck chair with one ringed hand resting on the smallest." },
    { text: "Long golden curls under a small gold coronet set with a red stone and a blue one. Blue eyes, a small beauty mark under the left. A fine gold chain at her throat with a swallow charm on it, worn as if it were nothing. Rings on three fingers, each a different stone." },
    { text: "She has a very particular way of sitting: perfectly upright, perfectly still, her ankles crossed, as though a portrait were being painted and the artist had warned her not to blink." },
    { text: "She is not looking at you. She has, however, noticed you crossing the deck. Her face has the mild patience of someone who has been approached this morning by a great many people with a great many lines." },
    { choice: [
      { text: "\"Hello. I'm Rowan. I only came over to say that.\"", hint: "Plain", steps: [
        { say: "rowan", text: "\"Hello. I'm Rowan. I only came over to say that.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"Hello.\"" },
        { text: "She looks up. A small, real smile, like a candle catching." },
        { say: "jessica", alias: "Girl with the caskets", text: "\"That is the first time this morning anyone has crossed the deck to say that and nothing else.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"Jessica Montclair. I would give you my hand, but I do not take it off these.\" A tilt of the head at the caskets." },
        AFF("jessica", 2, "Crossed the deck plainly"),
        { flag: "jessica_plain" }
      ] },
      { text: "\"Those caskets look like they hold either jewels or a very elegant corpse.\"", hint: "Line", steps: [
        { say: "rowan", text: "\"Those caskets look like they hold either jewels or a very elegant corpse.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"Jewels.\"" },
        { text: "It is a very warm, very final word." },
        { say: "jessica", alias: "Girl with the caskets", text: "\"A corpse would have required a fourth, and I was told that three was already excessive. Jessica Montclair. And you are the gentleman who opens with a corpse.\"" },
        { say: "rowan", text: "\"Rowan. It seemed better than opening with the weather.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"It was.\" The corner of her mouth moves. \"Marginally.\"" },
        AFF("jessica", 1, "Made a joke")
      ] },
      { text: "\"Forgive me, but the sea has never looked less beautiful than it does next to you.\"", hint: "Cheesy", steps: [
        { say: "rowan", text: "\"Forgive me, but the sea has never looked less beautiful than it does next to you.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"Ah.\"" },
        { text: "A gracious, faintly sorrowful lift of the brow." },
        { say: "jessica", alias: "Girl with the caskets", text: "\"I have been addressed that way four times this morning. By the same boy. You are, I think, an imitation, and I am not sure how I feel about that.\"" },
        { say: "rowan", text: "\"Rowan. And I'd like to withdraw it, if that's allowed.\"" },
        { say: "jessica", alias: "Girl with the caskets", text: "\"It is allowed. I shall pretend the wind took it.\" A very slight thaw. \"Jessica Montclair.\"" },
        AFF("jessica", -2, "Used a line"),
        { flag: "jessica_cheesy" }
      ] }
    ] },
    MET("jessica", "Jessica Montclair"),
    { text: "Her eyes go, once, over the rain jacket: the shoulders, the place where a collar would be." },
    { say: "jessica", text: "\"You have no collar, Rowan. Everyone else aboard can be placed at a glance. You, one must actually ask. Where are they putting you?\"" },
    { say: "rowan", text: "\"The Commons. Bungalow seven.\"" },
    { say: "jessica", text: "\"Spectral Tower. Second floor, I am told, with a view of the volcano.\" A small, wry shrug. \"Nobody has told me yet whether I am meant to find that pleasant.\"" },
    { choice: [
      { text: "\"Do you?\"", steps: [
        { say: "rowan", text: "\"Do you?\"" },
        { say: "jessica", text: "\"I find it very large. I find that I may like it, in time.\"" },
        { text: "She looks forward along the ship, to where the island is still mostly a promise." },
        { say: "jessica", text: "\"It is nice to be asked.\"" },
        AFF("jessica", 1, "Asked what she thought")
      ] },
      { text: "\"I'd take it. My letter says I start at the foot of the ladder. It was quite clear about that.\"", steps: [
        { say: "rowan", text: "\"I'd take it. My letter says I start at the foot of the ladder. It was quite clear about that.\"" },
        { say: "jessica", text: "\"The letter is a snob. It was rude to each of us in a different way; mine congratulated my family.\"" },
        { say: "jessica", text: "\"I should not judge a bungalow before I have seen it.\" A pause. \"Nor a tower.\"" },
        AFF("jessica", 1, "Did not envy her")
      ] },
      { text: "\"A volcano is only a pleasant view until it isn't.\"", steps: [
        { say: "rowan", text: "\"A volcano is only a pleasant view until it isn't.\"" },
        { say: "jessica", text: "\"That is true of most views. And of most people.\" She is, you think, amused. \"I shall keep a bag by the door.\"" }
      ] }
    ] },
    NOTE("jessica", "Staying in the Spectral Tower, second floor, with a view of the volcano."),
    { text: "A voice carries down the deck from the rail, pitched exactly to be overheard." },
    { say: "ashton", alias: "Boy with a rose", text: "\"And still the sea has her whole attention! The sea — which has never once sent flowers!\"" },
    { when: (s)=>!s.flags["met_ashton"], text: "A tall boy with violet hair is standing at the rail thirty feet off, holding a single rose and addressing the horizon." },
    { when: (s)=>!!s.flags["met_ashton"], text: "Ashton, thirty feet off at the rail, is addressing the horizon over a single rose." },
    { text: "Jessica does not turn her head. Her hand does not move on the casket. But something about her gets one degree cooler, like a room when a door is opened." },
    { when: (s)=>!!s.flags["jessica_cheesy"], say: "jessica", text: "\"That is the boy, incidentally. That makes five.\"" },
    { choice: [
      { text: "\"Friend of yours?\"", steps: [
        { say: "rowan", text: "\"Friend of yours?\"" },
        { say: "jessica", text: "\"That is a tactful word for it.\" She considers the word. \"I shall borrow it.\"" }
      ] },
      { text: "\"Would it help if I stood in the way?\"", steps: [
        { say: "rowan", text: "\"Would it help if I stood in the way?\"" },
        { say: "jessica", text: "\"It is a kind offer, and it would not help. He would simply address the next one to you. He has no objection to an audience.\"" },
        AFF("jessica", 1, "Offered, did not presume")
      ] },
      { text: "Say nothing, and look at the sea with her.", steps: [
        { text: "You look at the sea. It is a perfectly good sea. Neither of you remarks on the rail. After a while she speaks, and you have the feeling that the silence was a small test and that you have not failed it." },
        AFF("jessica", 2, "Let the silence sit")
      ] }
    ] },
    { when: (s)=>!s.flags["met_ashton"], say: "jessica", text: "\"That is Ashton Beaumont-Lyle. You will hear this by luncheon from somebody less accurate, so I prefer to be the source: we were one season in the city, last spring. I ended it by letter.\"" },
    { when: (s)=>!!s.flags["met_ashton"], say: "jessica", text: "\"You have met Mr Beaumont-Lyle; I saw you at the rail. You will hear this by luncheon from somebody less accurate, so I prefer to be the source: we were one season in the city, last spring. I ended it by letter.\"" },
    { say: "jessica", text: "\"It was a very good letter.\" A pause. \"He is not a bad man. He is a rehearsed one. I should like to know what he says when the script runs out, and I am no longer the person to find out.\"" },
    { flag: "jessica_ex_known" },
    REL("ashton", "jessica"),
    NOTE("jessica", "She and Ashton Beaumont-Lyle were together for one season in the city. She says she ended it by letter."),
    { choice: [
      { text: "\"And now you're both on the same boat.\"", steps: [
        { say: "rowan", text: "\"And now you're both on the same boat.\"" },
        { say: "jessica", text: "\"For four hours and ten minutes. I have been counting them down in a ladylike manner.\"" }
      ] },
      { text: "\"Does it bother you? Him, over there, doing that?\"", steps: [
        { say: "rowan", text: "\"Does it bother you? Him, over there, doing that?\"" },
        { say: "jessica", text: "\"It is not the roses. I like roses. It is that he is doing it *at* me. There is a difference between being courted and being used as a backdrop.\"" },
        AFF("jessica", 1, "Asked how she felt")
      ] }
    ] },
    { say: "jessica", text: "\"I planned this crossing rather carefully, you see. The hour, the side of the ship with the light, this chair. The one thing I neglected to plan was the rest of the passenger list.\"" },
    { flag: "jessica_said_planned" },
    { say: "jessica", text: "\"But you have let me talk, which is either manners or strategy.\" She turns to you properly. \"Did anyone see you off this morning, Rowan?\"" },
    { choice: [
      { text: "\"My aunt. She runs a laundromat. Two weeks ago I was still folding sheets in it.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"My aunt. She runs a laundromat. Two weeks ago I was still folding sheets in it.\"" },
        { say: "jessica", text: "\"Then she has lost her best pair of hands and sent you all the same. That is the expensive kind of generosity.\"" },
        { say: "jessica", text: "\"Write to her. A telephone call is over when it ends. A letter can be kept.\"" },
        AFF("jessica", 2, "Answered honestly")
      ] },
      { text: "\"Someone who wrote CALL HER WHEN YOU LAND on my luggage label.\"", hint: "From the cage", when: (s)=>!!s.flags["found_duffel"], steps: [
        { say: "rowan", text: "\"Someone who wrote CALL HER WHEN YOU LAND on my luggage label.\"" },
        { say: "jessica", text: "\"Then call her.\" Quite firmly. \"A person who labels one's luggage is not to be kept waiting.\"" },
        AFF("jessica", 1, "Told her something true")
      ] },
      { text: "\"I'd rather hear about your crossing than talk about mine.\"", steps: [
        { say: "rowan", text: "\"I'd rather hear about your crossing than talk about mine.\"" },
        { say: "jessica", text: "\"How discreet.\" It is not quite a compliment. \"Very well. I shall ask you again when you have had breakfast.\"" }
      ] }
    ] },
    { say: "jessica", text: "\"You may come back, if you like. I shall be here. The caskets do not care for walks.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Rowan, she's like a museum. A walking, talking, very expensive museum. I'm scared of her and I want her to like me.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Then be quiet.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "nathan", text: "\"I AM being quiet! This is my quiet!\"" },
    { add: { ferry_talked: 1 } },
    NOTE("jessica", "Gracious and formal. Travels with three caskets of jewellery."),
    { time: 8 },
    { flag: "chat_jessica_offered" },
    { jump: "menu" },

    { label: "again" },
    { text: "She is exactly where you left her: upright beside the trolley, one hand on the smallest casket, the swallow charm catching the light at her throat." },
    { when: (s)=>!!s.flags["chat_jessica_done"], say: "jessica", text: "\"Rowan. Again. I begin to think you cross decks habitually.\"" },
    { when: (s)=>!s.flags["chat_jessica_done"], say: "jessica", text: "\"Rowan. Do sit.\"" },
    { time: 3 },
    { label: "menu" },
    { choice: [
      { text: "\"May I keep you company for a while? I'm not much of a talker, but I'd like to hear about your crossing.\"", when: (s)=>!s.flags["jessica_sat"], steps: [
        { say: "rowan", text: "\"May I keep you company for a while? I'm not much of a talker, but I'd like to hear about your crossing.\"" },
        { text: "For a few minutes the two of you watch the wake. She asks you real questions, and waits for the answers. It is an odd and pleasant feeling, like being held in warm light." },
        { say: "jessica", text: "\"I don't chase, Rowan. It isn't pride. It's that I should like to know someone crossed the room on purpose.\"" },
        { say: "rowan", text: "\"This was on purpose.\"" },
        { say: "jessica", text: "\"Yes.\" She does not look at you when she says it. \"I had noticed.\"" },
        AFF("jessica", 2, "Stayed to talk"),
        { flag: "jessica_sat" },
        { time: 15 }
      ] },
      { text: "\"I've a message from the rail. He says hello. Or that he said nothing. He left the choice to me.\"", hint: "From Ashton", when: (s)=>!!s.flags["ashton_sent_hello"] && !s.flags["jessica_got_hello"], steps: [
        { say: "rowan", text: "\"I've a message from the rail. He says hello. Or that he said nothing. He left the choice to me.\"" },
        { say: "jessica", text: "\"And you have delivered both, which is the only honest way to do it.\"" },
        { text: "For the first time she glances, very briefly, towards the rail. Thirty feet away a rose is lowered an inch." },
        { say: "jessica", text: "\"Tell him — no. Tell him nothing. He will make a great deal more of nothing than of anything I could say.\"" },
        { choice: [
          { text: "\"That's a little cruel.\"", steps: [
            { say: "rowan", text: "\"That's a little cruel.\"" },
            { say: "jessica", text: "\"It is a little kind, as well. He enjoys a mystery far more than an answer.\" A breath. \"And I am not ready to give him an answer that he could repeat at dinner.\"" }
          ] },
          { text: "\"Nothing it is. I'm good at carrying nothing.\"", steps: [
            { say: "rowan", text: "\"Nothing it is. I'm good at carrying nothing.\"" },
            { say: "jessica", text: "\"You are good at carrying it *straight*, which is a different talent.\" The small real smile again. \"Thank you.\"" }
          ] }
        ] },
        AFF("jessica", 1, "Carried the message straight"),
        { flag: "jessica_got_hello" },
        { time: 4 }
      ] },
      { text: "\"Would you like a game, to pass the crossing?\"", when: (s)=>!s.flags["jessica_game_after_docks"], steps: [
        { say: "rowan", text: "\"Would you like a game, to pass the crossing?\"" },
        { say: "jessica", text: "\"On a boat? With my caskets in the way, and the wind taking a hand of its own?\" A gracious headshake. \"After we dock. If you remember to ask me then.\"" },
        { say: "jessica", text: "\"I notice who remembers.\"" },
        { flag: "jessica_game_after_docks" },
        { time: 2 }
      ] },
      { text: "\"May I ask you something, if you've the patience?\"", when: (s)=>!s.flags["chat_jessica_done"] || (!s.flags["chat_jessica_4"] && !!s.flags["ashton_says_ended"] && !!s.flags["jessica_ex_known"]), steps: [
        { say: "rowan", text: "\"May I ask you something, if you've the patience?\"" },
        { say: "jessica", text: "\"I have a great deal of patience and very little else to do with it. Ask.\"" },
        { scene: "chat_jessica" }
      ] },
      { text: "Excuse yourself.", steps: [
        { say: "jessica", text: "\"Of course. Go and cross some other deck.\"" }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_jessica", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_jessica_1"] && !!s.flags["chat_jessica_2"] && !!s.flags["chat_jessica_3"] && !!s.flags["chat_jessica_x"] && !s.flags["chat_jessica_done"], jump: "done" },
    { choice: [
      { text: "\"That swallow on your chain. Was it chosen for today?\"", when: (s)=>!s.flags["chat_jessica_1"], steps: [
        { say: "rowan", text: "\"That swallow on your chain. Was it chosen for today?\"" },
        { say: "jessica", text: "\"You noticed that it was chosen.\" Her fingers go to it, lightly. \"Most people notice that it is gold.\"" },
        AFF("jessica", 2, "Noticed it was chosen"),
        { say: "jessica", text: "\"It was my grandmother's. Swallows come back, you see. Every spring. I thought it suitable for a crossing.\"" },
        { choice: [
          { text: "\"Do you choose a different piece every day?\"", steps: [
            { say: "rowan", text: "\"Do you choose a different piece every day?\"" },
            { say: "jessica", text: "\"You have guessed the rule from a single example. Yes.\"" }
          ] },
          { text: "\"Come back where, though? Home, or here?\"", steps: [
            { say: "rowan", text: "\"Come back where, though? Home, or here?\"" },
            { text: "The silence goes on long enough for a gull to cross the whole width of the wake." },
            { say: "jessica", text: "\"I had not decided. That is an impertinent question, and a good one. Ask me which it was when we sail back in June.\"" },
            AFF("jessica", 1, "Asked the better question")
          ] }
        ] },
        { say: "jessica", text: "\"I wear a different piece each morning. It is a small discipline. It means that I have to decide who I am, at least once, before breakfast.\"" },
        { say: "jessica", text: "\"And you? Who did you decide to be this morning?\"" },
        { choice: [
          { text: "\"Someone who didn't miss the boat. That used up the whole budget.\"", steps: [
            { say: "rowan", text: "\"Someone who didn't miss the boat. That used up the whole budget.\"" },
            { say: "jessica", text: "\"A modest ambition, fully achieved. I envy you. Mine are so rarely measurable.\"" }
          ] },
          { text: "\"Nobody yet. I'm waiting to see what the jacket says when they give me one.\"", steps: [
            { say: "rowan", text: "\"Nobody yet. I'm waiting to see what the jacket says when they give me one.\"" },
            { say: "jessica", text: "\"Do not let a jacket decide. They are cut for the average of everybody.\"" },
            { say: "jessica", text: "\"Decide first, and put it on afterwards.\" A glance at your rain jacket that is almost fond. \"I can lend you the method, if not the jewellery.\"" }
          ] }
        ] },
        { flag: "chat_jessica_1" },
        NOTE("jessica", "The swallow charm was her grandmother's: swallows come back. She wears a different piece every day."),
        { time: 3 }
      ] },
      { text: "\"Has that hand left the casket once since the harbour?\"", when: (s)=>!s.flags["chat_jessica_2"], steps: [
        { say: "rowan", text: "\"Has that hand left the casket once since the harbour?\"" },
        { say: "jessica", text: "\"Twice. Once for tea, and once to turn a page. I resented both.\"" },
        { say: "jessica", text: "\"The crew offered me the luggage cage. With a label.\" Her eyes go to the wire pen and its stacked trunks. \"A thing that goes into a cage with a label on it belongs, for the duration, to the label.\"" },
        { choice: [
          { text: "\"What's it like, travelling with three of them?\"", steps: [
            { say: "rowan", text: "\"What's it like, travelling with three of them?\"" },
            { say: "jessica", text: "\"Ruinous. The leather is the very best, and the porters are not.\"" },
            AFF("jessica", 1, "Made her smile")
          ] },
          { text: "\"I could watch them for ten minutes, if you wanted to walk to the rail and back.\"", steps: [
            { say: "rowan", text: "\"I could watch them for ten minutes, if you wanted to walk to the rail and back.\"" },
            { text: "She looks at you for rather longer than the offer seems to need." },
            { say: "jessica", text: "\"You are the first person today who has offered to guard them rather than to carry them. Porters carry. Guarding is a different trade.\"" },
            { say: "jessica", text: "\"No. But I shall remember that it was offered, and how.\"" },
            AFF("jessica", 2, "Offered to guard, not carry")
          ] }
        ] },
        { say: "jessica", text: "\"I ought to say that I could manage with one.\" A very small, dry smile. \"But I find that I cannot decide which one.\"" },
        { say: "rowan", text: "\"Is that a joke?\"" },
        { say: "jessica", text: "\"A very small one. I am practising them. It is said to be good for a person.\"" },
        { flag: "chat_jessica_2" },
        NOTE("jessica", "Will not put the caskets in the luggage cage, and cannot decide which of the three she could manage without."),
        { time: 3 }
      ] },
      { text: "\"Why a card academy? You don't look like someone who was short of places to go.\"", when: (s)=>!s.flags["chat_jessica_3"], steps: [
        { say: "rowan", text: "\"Why a card academy? You don't look like someone who was short of places to go.\"" },
        { say: "jessica", text: "\"My family has a long tradition of attending things.\" She says it lightly, and watches the wake. \"Schools. Seasons. Other people's weddings.\"" },
        { say: "jessica", text: "\"I should like, in this case, to do something that was not on the list.\"" },
        { say: "jessica", text: "\"So: the Auxiliary track. Commentary. I am to learn to say, in public and at speed, exactly what I see.\"" },
        { choice: [
          { text: "\"You'd rather talk about the games than win them?\"", steps: [
            { say: "rowan", text: "\"You'd rather talk about the games than win them?\"" },
            { say: "jessica", text: "\"Oh, I can count cards perfectly well. I simply find it more instructive to watch who explains the rules to me.\"" },
            { say: "jessica", text: "\"Three gentlemen have done so since we sailed.\" A beat. \"One of them incorrectly.\"" }
          ] },
          { text: "\"And is it going well? The thing that wasn't on the list?\"", steps: [
            { say: "rowan", text: "\"And is it going well? The thing that wasn't on the list?\"" },
            { say: "jessica", text: "\"I have not yet decided what it is.\" A pause. \"You may ask again when I have.\"" }
          ] },
          { text: "\"Then you've got competition. There's a boy back there with a microphone doing it already.\"", hint: "From the stern", when: (s)=>!!s.flags["met_cas"] || !!s.flags["cas_heard"], steps: [
            { say: "rowan", text: "\"Then you've got competition. There's a boy back there with a microphone doing it already.\"" },
            { say: "jessica", text: "\"The gentleman in the scarf. I have been listening. He is good: he has the voice, and he is kind with it, which is rarer.\"" },
            { say: "jessica", text: "\"He is also a sentence behind the play.\" Serenely. \"He announced that there would be another rose some time after I had already turned my chair.\"" }
          ] }
        ] },
        AFF("jessica", 2, "Asked about her reasons"),
        { flag: "chat_jessica_3" },
        NOTE("jessica", "Came here to do something that was not on the family list. Auxiliary track: commentary."),
        { time: 3 }
      ] },
      { text: "\"You said you planned this crossing down to the chair. Do you plan everything like that?\"", when: (s)=>!s.flags["chat_jessica_x"] && !!s.flags["jessica_said_planned"], steps: [
        { say: "rowan", text: "\"You said you planned this crossing down to the chair. Do you plan everything like that?\"" },
        { say: "jessica", text: "\"Only the things worth doing. I plan outings.\"" },
        { say: "jessica", text: "\"A picnic. A walk along a harbour wall. A dinner for four, with the seating arranged.\"" },
        { text: "She says it with great seriousness, like a general describing a campaign." },
        { say: "jessica", text: "\"I give them the care that other people give a deck list. The right person, the right place, the right hour.\"" },
        { choice: [
          { text: "\"And do you get to go on them yourself?\"", steps: [
            { say: "rowan", text: "\"And do you get to go on them yourself?\"" },
            { say: "jessica", text: "\"I am very rarely asked. One plans for other people; they are grateful; they go.\"" },
            { say: "jessica", text: "\"It is a great waste.\" A beat. \"I am extremely good at it.\"" }
          ] },
          { text: "\"Then plan one for the island. I'll turn up.\"", hint: "Bold", steps: [
            { say: "rowan", text: "\"Then plan one for the island. I'll turn up.\"" },
            { say: "jessica", text: "\"One does not *turn up*, Rowan. One is invited: a time, a place, a plan, in writing. And then one is punctual.\"" },
            { say: "jessica", text: "\"But I shall consider the guest list open.\" It is the candle smile again, briefly. \"I am very rarely asked, you understand. It is a great waste. I am extremely good at it.\"" },
            AFF("jessica", 1, "Asked to be invited")
          ] }
        ] },
        { say: "jessica", text: "\"There is a harbour wall on the map that came with my letter. I have not seen it, and I have decided to trust it. Harbour walls are reliable.\"" },
        AFF("jessica", 2, "Asked what she loves"),
        { flag: "chat_jessica_x" },
        NOTE("jessica", "Plans outings with the care other people give deck lists, but is hardly ever invited on any."),
        { time: 3 }
      ] },
      { text: "\"Ashton tells it the other way round. He says he ended it.\"", hint: "From Ashton", when: (s)=>!s.flags["chat_jessica_4"] && !!s.flags["ashton_says_ended"] && !!s.flags["jessica_ex_known"], steps: [
        { say: "rowan", text: "\"Ashton tells it the other way round. He says he ended it.\"" },
        { say: "jessica", text: "\"Of course he does.\" It is not said unkindly. \"He may have that version. I kept the draft.\"" },
        { say: "jessica", text: "\"Do not correct him on my account. A man must be left something to stand on, particularly at a rail.\"" },
        { choice: [
          { text: "\"You're kinder about him than he'd expect.\"", steps: [
            { say: "rowan", text: "\"You're kinder about him than he'd expect.\"" },
            { say: "jessica", text: "\"I am fond of him in the way one is fond of a mistake that taught one something. Do not tell him that either. He would have it engraved.\"" }
          ] },
          { text: "\"I won't say a word. To either rail.\"", steps: [
            { say: "rowan", text: "\"I won't say a word. To either rail.\"" },
            { say: "jessica", text: "\"Then you are the only neutral party on this deck, and I shall have to be careful what I tell you. People confide dreadfully in neutral parties.\"" }
          ] }
        ] },
        AFF("jessica", 1, "Did not take sides"),
        { flag: "chat_jessica_4" },
        NOTE("jessica", "Lets Ashton keep his version of how it ended. She kept the draft of the letter."),
        { time: 2 }
      ] },
      { text: "\"Do you play, yourself? Or only watch?\"", when: (s)=>!s.flags["deck_known_jessica"], steps: [
        { scene: "deck_jessica" }
      ] },
      { text: "\"I'll let you enjoy the crossing, Jessica.\"", steps: [
        { say: "rowan", text: "\"I'll let you enjoy the crossing, Jessica.\"" },
        { say: "jessica", text: "\"Thank you, Rowan. It was a pleasure to be crossed to.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_jessica_done" },
    { say: "jessica", text: "\"I think that is the longest I have talked to anyone this morning without being asked for my hand.\" A small, real smile. \"It was a pleasant change.\"" },
    { end: true }
  ]
});

scene("deck_jessica", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_jessica"], end: true },
    { choice: [
      { text: "\"Three caskets of jewellery. Is the deck the same idea — everything you own, hung on one hero?\"", hint: "From her caskets", steps: [
        { say: "rowan", text: "\"Three caskets of jewellery. Is the deck the same idea — everything you own, hung on one hero?\"" },
        { say: "jessica", text: "\"How lovely.\" The most gracious tilt of the head. \"That was a considered guess. Dowry.\"" },
        { say: "jessica", text: "\"I out-spend people, Rowan. Willy takes five cards or a pile of gold, and all of it goes into jewellery for Boris.\"" },
        AFF("jessica", 3, "Read her deck")
      ] },
      { text: "\"What do you play, Jessica? I'd like to hear what a person with your taste builds.\"", steps: [
        { say: "rowan", text: "\"What do you play, Jessica? I'd like to hear what a person with your taste builds.\"" },
        { say: "jessica", text: "\"Dowry. It is, I am told, an acquired taste: gold, artifacts, and a great deal of patience.\"" },
        AFF("jessica", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_jessica" },
        { end: true }
      ] }
    ] },
    { text: "Your eyes settle on the nearest casket and stop seeing it. You hear your own voice from a little way off." },
    { say: "rowan", text: "\"…Wealth. Treasure Chest. Mimic. A gold pile nobody else has. Sun Sword, Warhorse, the Vampiric Sword when it comes. All on Boris. Heavy Hit stuns, Quick Attack swings again, heals off the damage.\"" },
    { say: "rowan", text: "\"Golden Apple borrows a hero of mine.\" A pause. \"Everything she paid for sits on one hero. Freeze him, stun him — the whole dowry sits.\"" },
    { text: "You come back. You have just said all of that aloud, to a lady, about her own deck." },
    { say: "jessica", text: "\"You read the hero card.\" She says it quietly. \"Most people read the jewellery.\"" },
    { choice: [
      { text: "\"Sorry. I do that. It isn't meant as a verdict.\"", steps: [
        { say: "rowan", text: "\"Sorry. I do that. It isn't meant as a verdict.\"" },
        { say: "jessica", text: "\"It was not taken as one. It was the first accurate thing anybody has said to me about it.\"" }
      ] },
      { text: "\"Doesn't it worry you? Everything on Boris?\"", steps: [
        { say: "rowan", text: "\"Doesn't it worry you? Everything on Boris?\"" },
        { say: "jessica", text: "\"Anything worth having sits somewhere it can be got at. One may spread it thin and own nothing in particular, or one may choose a place and stand beside it.\"" },
        { text: "Her hand has not moved from the smallest casket." }
      ] }
    ] },
    { say: "jessica", text: "\"I am told that I lose gracefully. I should like you to find out whether that is true. On dry land.\"" },
    DECK("jessica")
  ]
});

/* ===================================================================== ASHTON */
scene("ferry_ashton", {
  steps: [
    { when: (s)=>!!s.flags["met_ashton"], jump: "again" },
    { text: "A tall, slim boy with violet hair swept up into one smooth dome stands very nobly at the rail, holding a single rose by the stem. His other hand is turning a thorn between finger and thumb." },
    { text: "He is trying one line after another on the open air. Not one of them is working." },
    { say: "ashton", alias: "Boy with a rose", text: "\"A rose for the lady, and my condolences to every man she met before me.\"" },
    { text: "The lady in question, thirty feet away beside a trolley of leather caskets, is looking at the sea." },
    { when: (s)=>!s.flags["met_cas"], text: "By the flagstaff a boy in a long striped scarf, with a small microphone clipped to his lapel, remarks to nobody in particular, in the kind of voice that reads out the football results:" },
    { when: (s)=>!!s.flags["met_cas"], text: "From the flagstaff, Cas remarks to his lapel in the full broadcast voice:" },
    { say: "cas", alias: "Boy with a microphone", text: "\"And that one's gone wide. Same delivery as the last four, same result. You do have to admire the run-up.\"" },
    { flag: "cas_heard" },
    { say: "ashton", alias: "Boy with a rose", text: "\"Ah. An audience. Two, if one counts the wireless.\"" },
    { text: "He swings round, seeing you for the first time, with the dazzling, wounded ease of a man who has not noticed he is wounded." },
    { choice: [
      { text: "\"How many lines is that since the harbour?\"", steps: [
        { say: "rowan", text: "\"How many lines is that since the harbour?\"" },
        { say: "ashton", alias: "Boy with a rose", text: "\"One doesn't count lines. Counting is for people who expect to run out.\"" },
        AFF("ashton", 1, "Teased him, with wit")
      ] },
      { text: "\"She's looking at the sea.\"", steps: [
        { say: "rowan", text: "\"She's looking at the sea.\"" },
        { say: "ashton", alias: "Boy with a rose", text: "\"She is looking at the sea *deliberately*. It is an entirely different thing. One can tell from the shoulders.\"" }
      ] },
      { text: "\"It's a good line. It might be a better one indoors, with fewer gulls.\"", steps: [
        { say: "rowan", text: "\"It's a good line. It might be a better one indoors, with fewer gulls.\"" },
        { say: "ashton", alias: "Boy with a rose", text: "\"The gulls are a pest. They heckle. But a critic who begins with the praise! You may stay.\"" },
        AFF("ashton", 1, "Praised the line")
      ] }
    ] },
    { say: "ashton", alias: "Boy with a rose", text: "\"Ashton Beaumont-Lyle. You'll know the name. If you don't, nobody does.\"" },
    MET("ashton", "Ashton Beaumont-Lyle"),
    { when: (s)=>!!s.flags["told_wildcard"] || !!s.flags["ship_knows_wildcard"], jump: "known" },
    { say: "ashton", text: "\"And you are Vance. Don't look like that, I can add up: a rain jacket, no collar, and one name written in ink on the list at the wheelhouse door. The Wildcard.\"" },
    { choice: [
      { text: "\"That's fair. Rowan. Apparently I'm easy to work out.\"", steps: [
        { say: "rowan", text: "\"That's fair. Rowan. Apparently I'm easy to work out.\"" },
        { say: "ashton", text: "\"Not at all. You have a very quiet face. It's the jacket that gives you away.\"" },
        { flag: "told_wildcard" }
      ] },
      { text: "\"There must be other people on this boat without a collar.\"", steps: [
        { say: "rowan", text: "\"There must be other people on this boat without a collar.\"" },
        { say: "ashton", text: "\"There is exactly one, and he is being evasive at me. Quite right too. I shan't tell a soul. I shall merely *know*, visibly.\"" },
        { say: "rowan", text: "\"…Rowan.\"" },
        { say: "ashton", text: "\"Vance. Delighted.\"" }
      ] }
    ] },
    { jump: "placed" },
    { label: "known" },
    { say: "ashton", text: "\"And you are Vance. The Wildcard. Word travels on a boat this size, and the sum was never difficult: a rain jacket, no collar, one name in ink.\"" },
    { say: "rowan", text: "\"Rowan. I'm told I'm conspicuous.\"" },
    { say: "ashton", text: "\"Only the jacket. The face is very quiet.\"" },
    { label: "placed" },
    { say: "ashton", text: "\"I watched the Qualifier, you know. All of it. I have a view on game four, which I am saving until you ask me nicely.\"" },
    { flag: "ashton_said_replays" },
    { text: "He sets a thumbnail against the stem of the rose and, with three exact movements, removes a thorn you could not see." },
    { say: "ashton", text: "\"I do this for every rose. It is a courtesy. One should not give a lady a thing that could hurt her without asking.\"" },
    { choice: [
      { text: "\"That's — actually quite nice.\"", steps: [
        { say: "rowan", text: "\"That's — actually quite nice.\"" },
        { say: "ashton", text: "\"Don't say it as if it were a surprise, old thing. I am a *very* nice person. It is simply a long way down.\"" },
        AFF("ashton", 1, "Saw the courtesy")
      ] },
      { text: "\"And if the lady doesn't want the rose at all?\"", steps: [
        { say: "rowan", text: "\"And if the lady doesn't want the rose at all?\"" },
        { say: "ashton", text: "\"Then one is left holding a rose with no thorns on it, which is the safest possible way to be left.\"" },
        { text: "For half a second the smile is not quite fastened on." },
        { say: "ashton", text: "\"I speak theoretically.\"" },
        AFF("ashton", 1, "Asked the real question")
      ] }
    ] },
    { say: "ashton", text: "\"Now. You have a clear eye and no stake in the matter. Honestly: is it working?\"" },
    { choice: [
      { text: "\"No. She hasn't looked round once.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"No. She hasn't looked round once.\"" },
        { say: "ashton", text: "\"No.\" Cheerfully. \"But she hasn't asked me to stop, and I have a theory that persistence is a kind of conversation.\"" },
        AFF("ashton", 1, "Told him straight")
      ] },
      { text: "\"Well, she hasn't thrown one overboard.\"", steps: [
        { say: "rowan", text: "\"Well, she hasn't thrown one overboard.\"" },
        { say: "ashton", text: "\"Two ladies have, this morning, and with admirable aim. You're quite right. By that measure I am positively encouraged.\"" },
        AFF("ashton", 1, "Made him laugh")
      ] },
      { text: "\"She told me about the season in the city. And the letter.\"", hint: "From Jessica", when: (s)=>!!s.flags["jessica_ex_known"], steps: [
        { say: "rowan", text: "\"She told me about the season in the city. And the letter.\"" },
        { text: "The rose stops turning." },
        { say: "ashton", text: "\"Did she.\" A beat, and then the drawl is back in place. \"Then you have the abridged edition. In the full text, *I* ended it. The letter was a formality. One of us had to put it in writing, and she has the better hand.\"" },
        { text: "His free hand goes, briefly, to his inside pocket, and comes away again." },
        { flag: "ashton_says_ended" },
        REL("ashton", "jessica"),
        NOTE("ashton", "Says that he was the one who ended it with Jessica Montclair.")
      ] }
    ] },
    { say: "ashton", text: "\"Besides, I lost at the lounge table earlier this morning, so I am in excellent practice at not being answered.\"" },
    { flag: "ashton_lost_table" },
    { say: "ashton", text: "\"And I have a speech in reserve. Four paragraphs and a joke about gulls. I am only waiting for the wind to drop.\"" },
    { flag: "ashton_said_gulls" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Rowan! He's got a ROSE! A real one! And he took the thorns off himself, I SAW!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"That's a skill.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("ashton", "Wealthy. Hands out roses, takes the thorns off himself, and talks like a novel."),
    { time: 8 },
    { flag: "chat_ashton_offered" },
    { jump: "menu" },

    { label: "again" },
    { text: "He is at the rail, as before, with a rose in one hand and a look of tender intent aimed squarely at a profile thirty feet away." },
    { when: (s)=>!!s.flags["beat_ashton"], say: "ashton", text: "\"Vance! My conqueror. Rescue me anyway.\"" },
    { when: (s)=>!s.flags["beat_ashton"] && !!s.flags["ashton_advised"], say: "ashton", text: "\"Vance! I am drafting a sentence. It keeps growing roses. Rescue me.\"" },
    { when: (s)=>!s.flags["beat_ashton"] && !s.flags["ashton_advised"], say: "ashton", text: "\"Vance! Rescue me.\"" },
    { label: "menu" },
    { choice: [
      { text: "\"You said you lost at the lounge table. What happened down there?\"", when: (s)=>!!s.flags["ashton_lost_table"] && !s.flags["ashton_told_table"], steps: [
        { say: "rowan", text: "\"You said you lost at the lounge table. What happened down there?\"" },
        { say: "ashton", text: "\"Gideon Pryce.\" A shrug of the shoulders. \"White gloves, tower collar, the manner of a private bank. He was taking all comers at the big table, and I came.\"" },
        { say: "ashton", text: "\"He did nothing. For nine turns he did nothing. I attacked, he sat there, I attacked more, and when I'd finished hanging myself, he took my head off.\"" },
        { choice: [
          { text: "\"So the answer is not to attack.\"", steps: [
            { say: "rowan", text: "\"So the answer is not to attack.\"" },
            { say: "ashton", text: "\"The answer is not to attack *first*. He sets his wall and waits. If nobody comes, I rather think he has nothing to say.\"" },
            { say: "ashton", text: "\"For a man of my temperament that is like being told not to mention the weather. But yes.\"" }
          ] },
          { text: "\"And you kept attacking for nine turns?\"", steps: [
            { say: "rowan", text: "\"And you kept attacking for nine turns?\"" },
            { say: "ashton", text: "\"One doesn't like to stop in the middle of a sentence. And every turn I thought: *now* he must do something. He never needed to. He only ever answers.\"" }
          ] }
        ] },
        { say: "ashton", text: "\"Elegant, really. I have never been so thoroughly beaten by somebody doing so little.\"" },
        { flag: "saw_counter" },
        { flag: "ashton_told_table" },
        AFF("ashton", 1, "Shared the story"),
        NOTE("ashton", "Lost to Gideon at the lounge table: Gideon never attacks first.")
      ] },
      { text: "\"Have you heard how it ended at the lounge table?\"", when: (s)=>!!s.flags["table_resolved"] && !s.flags["ashton_heard_news"], steps: [
        { say: "rowan", text: "\"Have you heard how it ended at the lounge table?\"" },
        { say: "ashton", text: "\"I have heard four versions and believe none of them. Go on.\"" },
        { text: "You give him the fifth, as plainly as you can." },
        { when: (s)=>!!s.flags["ferry_table_won"], say: "ashton", text: "\"Beaten! By YOU! Do you know what that is worth?\" He is delighted. \"I trust he carried it well. Said nothing, looked ill? Bravo.\"" },
        { when: (s)=>!s.flags["ferry_table_won"] && !!s.flags["ferry_inya_won"], say: "ashton", text: "\"Beaten by a child with bunnies! I wish I could have seen his face.\"" },
        { when: (s)=>!s.flags["ferry_table_won"] && !s.flags["ferry_inya_won"] && !!s.flags["ferry_table_lost"], say: "ashton", text: "\"Oh, my dear boy. Four cases. Up that hill. I'd say bring a hat.\"" },
        { when: (s)=>!s.flags["ferry_table_won"] && !s.flags["ferry_inya_won"] && !s.flags["ferry_table_lost"] && !!s.flags["ferry_table_settled"], say: "ashton", text: "\"You — made him play for nothing. I want to hear about that for an hour.\"" },
        { when: (s)=>!s.flags["ferry_table_won"] && !s.flags["ferry_inya_won"] && !s.flags["ferry_table_lost"] && !s.flags["ferry_table_settled"] && !!s.flags["ferry_table_denied"], say: "ashton", text: "\"He wouldn't play her at all? How perfectly like him. Poor child.\"" },
        { when: (s)=>!s.flags["ferry_table_won"] && !s.flags["ferry_inya_won"] && !s.flags["ferry_table_lost"] && !s.flags["ferry_table_settled"] && !s.flags["ferry_table_denied"], say: "ashton", text: "\"The child lost. She attacked first. I could have told her.\"" },
        { flag: "ashton_heard_news" },
        AFF("ashton", 1, "Brought news")
      ] },
      { text: "\"Would you fancy a casual game, Ashton? No stake, just something to do while the lady makes up her mind.\"", when: (s)=>!s.flags["flag_ashton_game"], steps: [
        { say: "rowan", text: "\"Would you fancy a casual game, Ashton? No stake, just something to do while the lady makes up her mind.\"" },
        { say: "ashton", text: "\"For no stake. Lazily. Is she watching?\"" },
        { text: "He glances down the deck at the lady, who is not." },
        { say: "ashton", text: "\"She is. Very well.\"" },
        { duel: "ferry_ashton", opponent: "ashton", opponentName: "Ashton Beaumont-Lyle", mustWin: false,
          onWin: [
            { say: "ashton", text: "\"Poisoned the field and still lost. How instructive. Naturally.\" A beat. \"…What was the question?\"" },
            { flag: "beat_ashton" },
            AFF("ashton", 2, "Good sport")
          ],
          onLose: [
            { say: "ashton", text: "\"Do tell the lady, if she asks, that I won gracefully.\"" },
            AFF("ashton", 2, "Won gracefully")
          ] },
        { scene: "post_ashton" },
        { flag: "flag_ashton_game" },
        { time: 25 }
      ] },
      { text: "\"I've got time. Tell me something that isn't a line.\"", when: (s)=>!s.flags["chat_ashton_done"], steps: [
        { say: "rowan", text: "\"I've got time. Tell me something that isn't a line.\"" },
        { say: "ashton", text: "\"Good heavens. Unscripted? Very well, but I warn you, I am badly out of practice.\"" },
        { scene: "chat_ashton" }
      ] },
      { text: "\"I'm going to walk over that way. Any message?\"", when: (s)=>!s.flags["ashton_sent_hello"], steps: [
        { say: "rowan", text: "\"I'm going to walk over that way. Any message?\"" },
        { say: "ashton", text: "\"Do. Do. And tell her I said hello. Or that I said nothing. Or don't.\"" },
        { text: "He turns back to the rail and adjusts the rose by a quarter of an inch, in case it should be looked at." },
        { flag: "ashton_sent_hello" }
      ] },
      { text: "Leave him to the rail.", steps: [
        { say: "ashton", text: "\"Go, go. If anybody asks, I was magnificent.\"" }
      ] }
    ] },
    { time: 4 },
    { end: true }
  ]
});

scene("chat_ashton", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_ashton_1"] && !!s.flags["chat_ashton_2"] && !!s.flags["chat_ashton_3"] && !!s.flags["chat_ashton_x"] && !s.flags["chat_ashton_done"], jump: "done" },
    { choice: [
      { text: "\"Is that the only rose, or is there a supply somewhere?\"", when: (s)=>!s.flags["chat_ashton_1"], steps: [
        { say: "rowan", text: "\"Is that the only rose, or is there a supply somewhere?\"" },
        { say: "ashton", text: "\"A box of twelve, on ice, in the purser's cold locker. The purser and I have an understanding. It cost me an absurd tip and was worth every coin.\"" },
        { say: "ashton", text: "\"Eleven gone since the harbour.\" He examines the stem. \"Seven were accepted. Two were thrown overboard, with great and, I thought, admirable aim. Two are under review.\"" },
        { choice: [
          { text: "\"Under review?\"", steps: [
            { say: "rowan", text: "\"Under review?\"" },
            { say: "ashton", text: "\"One lady is using hers as a bookmark and has not looked up since. The other asked me what it was *for*. I am still drafting my reply.\"" }
          ] },
          { text: "\"Doesn't it sting? The two overboard?\"", steps: [
            { say: "rowan", text: "\"Doesn't it sting? The two overboard?\"" },
            { say: "ashton", text: "\"Not in the least. Those two told me more in one throw than most people manage over a whole dinner.\"" }
          ] }
        ] },
        { say: "ashton", text: "\"A rose is a conversation, you see. Hand one over, and you learn everything about a person from what they do next.\"" },
        { say: "rowan", text: "\"And the twelfth?\"" },
        { say: "ashton", text: "\"The twelfth is in my hand.\" He looks down the deck. \"Its intended has not yet done anything at all. It is the most promising reaction I have ever had.\"" },
        AFF("ashton", 1, "Asked about the roses"),
        { flag: "chat_ashton_1" },
        NOTE("ashton", "Has handed out eleven roses since the harbour. Seven were accepted."),
        { time: 3 }
      ] },
      { text: "\"All right. I'm asking nicely. Game four of the Qualifier.\"", when: (s)=>!s.flags["chat_ashton_2"] && !!s.flags["ashton_said_replays"], steps: [
        { say: "rowan", text: "\"All right. I'm asking nicely. Game four of the Qualifier.\"" },
        { say: "ashton", text: "\"Ah! He asks.\"" },
        { text: "The drawl goes somewhere else. What is left is quicker, and has done its homework." },
        { say: "ashton", text: "\"Turn three. You had the safe play, and everybody watching knew it. You held instead. Passed with a full hand and let the other fellow believe you had nothing. Frankly insolent. I wound it back twice.\"" },
        { choice: [
          { text: "\"You watch everybody's games like that?\"", steps: [
            { say: "rowan", text: "\"You watch everybody's games like that?\"" },
            { say: "ashton", text: "\"Everybody in the year. It is how I pass the time on boats.\"" }
          ] },
          { text: "\"It wasn't insolence. I'd miscounted, and holding was all I had left.\"", hint: "Honest", steps: [
            { say: "rowan", text: "\"It wasn't insolence. I'd miscounted, and holding was all I had left.\"" },
            { say: "ashton", text: "\"Then never tell another soul.\" He is enchanted. \"It is the best lie in the whole bracket, and you told it by accident.\"" },
            AFF("ashton", 1, "Owned the mistake")
          ] }
        ] },
        { say: "ashton", text: "\"One learns openers, hesitations, the way people hold a hand they dislike.\" He smiles. \"You hold a bad hand like a man waiting for a bus. Wholly serene. Rather unsettling.\"" },
        { choice: [
          { text: "\"A screen is all you've seen. I've never played across a real table.\"", hint: "Honest", steps: [
            { say: "rowan", text: "\"A screen is all you've seen. I've never played across a real table.\"" },
            { say: "ashton", text: "\"No. One can tell. You play like somebody nobody has ever been able to look at.\"" },
            { say: "ashton", text: "\"Then start opposite a man who talks too much. It fills the room, and you can get on with the cards behind it. I volunteer. I am told I have the gift.\"" },
            AFF("ashton", 2, "Trusted him with it")
          ] },
          { text: "\"You talk about cards better than you talk about roses. Why hide it?\"", steps: [
            { say: "rowan", text: "\"You talk about cards better than you talk about roses. Why hide it?\"" },
            { say: "ashton", text: "\"Because the roses work, Vance, and nobody ever fell in love with a man for his notes on tempo.\"" },
            { text: "He hears himself, and reaches for the drawl again, and almost finds it." },
            AFF("ashton", 1, "Noticed the real interest")
          ] }
        ] },
        { say: "ashton", text: "\"And the prize has arrived, I take it.\" A glance at your pocket: the first time he has looked anywhere but your face. \"The printed list.\"" },
        { when: (s)=>!s.flags["rowan_commons_seen"], say: "ashton", text: "\"In Commons, every card. I looked it up, the way one looks up what a rival's horse eats. In my building that would count as a scandal.\"" },
        { when: (s)=>!!s.flags["rowan_commons_seen"], say: "rowan", text: "\"Go on. Tell me they're all Commons. Everybody else has.\"" },
        { when: (s)=>!!s.flags["rowan_commons_seen"], say: "ashton", text: "\"I was going to be *delicate* about it.\" Wounded. \"In my building, you understand, that would count as a scandal.\"" },
        { choice: [
          { text: "\"They play exactly the same.\"", steps: [
            { say: "rowan", text: "\"They play exactly the same.\"" },
            { say: "ashton", text: "\"They do. That is precisely what nobody in the tower can forgive.\" He straightens a cuff. \"Some of us have paid a great deal to find out that a Spectral plays no better than a Common. We have the receipts. I keep mine rather than look at them.\"" }
          ] },
          { text: "\"You'd have had it reprinted in something shinier by now.\"", steps: [
            { say: "rowan", text: "\"You'd have had it reprinted in something shinier by now.\"" },
            { say: "ashton", text: "\"Within the hour. It would have played no better, I would have known it, and I would have done it anyway.\" A small, unperformed pause. \"That is the difference between us, Vance, and I am not certain it is in my favour.\"" },
            AFF("ashton", 1, "Called his bluff")
          ] }
        ] },
        { flag: "rowan_commons_seen" },
        { flag: "chat_ashton_2" },
        NOTE("ashton", "Watches every replay of every player in the year, and is far sharper about cards than he lets on."),
        { time: 3 }
      ] },
      { text: "\"Why her? She's barely looked at you.\"", when: (s)=>!s.flags["chat_ashton_3"], steps: [
        { say: "rowan", text: "\"Why her? She's barely looked at you.\"" },
        { say: "ashton", text: "\"No.\"" },
        { text: "He does not seem to mind, for once." },
        { when: (s)=>!s.flags["ashton_says_ended"] && !s.flags["jessica_ex_known"], say: "ashton", text: "\"I ought to say that we are not strangers. Jessica Montclair. One season in the city, last spring. I ended it. There was a letter; these things want a letter.\"" },
        { when: (s)=>!!s.flags["ashton_says_ended"], say: "ashton", text: "\"You know the history. One season, one letter, and I ended it.\"" },
        { when: (s)=>!s.flags["ashton_says_ended"] && !!s.flags["jessica_ex_known"], say: "ashton", text: "\"You know the history, I gather. I watched you cross to her, and she does like to be the source. One season in the city, one letter. And *I* ended it, whatever you may have been told.\"" },
        { flag: "ashton_says_ended" },
        REL("ashton", "jessica"),
        { say: "ashton", text: "\"Everybody else says yes by the second sentence, you see. She said yes once, and then she *thought* about it. Nobody had ever thought about it before.\"" },
        { say: "ashton", text: "\"I should like — very much — to be chosen by somebody who could easily have said no.\"" },
        { text: "The smile stays, and something behind it moves." },
        { say: "ashton", text: "\"It is a ridiculous thing to want. I am aware.\"" },
        { choice: [
          { text: "\"It doesn't sound ridiculous.\"", steps: [
            { say: "rowan", text: "\"It doesn't sound ridiculous.\"" },
            { say: "ashton", text: "\"Doesn't it? How very kind.\" A breath, and the old gloss comes back. \"Do not repeat that. I should have to challenge you.\"" },
            AFF("ashton", 2, "Took him seriously")
          ] },
          { text: "\"Then why a line? She's heard the lines. Try a sentence.\"", steps: [
            { say: "rowan", text: "\"Then why a line? She's heard the lines. Try a sentence.\"" },
            { say: "ashton", text: "\"A sentence.\" He tries the word like an unfamiliar wine. \"With no rose in it.\"" },
            { say: "rowan", text: "\"You could keep the rose.\"" },
            { say: "ashton", text: "\"…I shall take it under advisement. Don't look so pleased. It is unbecoming in an adviser.\"" },
            AFF("ashton", 2, "Gave him honest advice"),
            { flag: "ashton_advised" }
          ] }
        ] },
        { flag: "chat_ashton_3" },
        NOTE("ashton", "Wants to be chosen by someone who could easily have said no."),
        { time: 3 }
      ] },
      { text: "\"The joke about gulls. From the speech. Let's hear it.\"", when: (s)=>!s.flags["chat_ashton_x"] && !!s.flags["ashton_said_gulls"], steps: [
        { say: "rowan", text: "\"The joke about gulls. From the speech. Let's hear it.\"" },
        { say: "ashton", text: "\"Ah. You *were* listening.\"" },
        { text: "He clears his throat with enormous ceremony." },
        { say: "ashton", text: "\"Why did the gull cross the ocean?\"" },
        { say: "rowan", text: "\"I don't know. Why?\"" },
        { say: "ashton", text: "\"To get to the other tide.\"" },
        { text: "A long, appalled silence. Overhead, a gull says something short." },
        { say: "ashton", text: "\"…It does not work aloud. It works better on the page. I wrote it at four in the morning, and at four in the morning it killed.\"" },
        { choice: [
          { text: "\"It's terrible.\"", steps: [
            { say: "rowan", text: "\"It's terrible.\"" },
            { say: "ashton", text: "\"It is *exquisite*, and I will hear no more.\" He is, nevertheless, grinning." }
          ] },
          { text: "\"Who was the audience, at four in the morning?\"", steps: [
            { say: "rowan", text: "\"Who was the audience, at four in the morning?\"" },
            { text: "He looks at you as though you had asked the one question that was not in the script." },
            AFF("ashton", 1, "Asked who it was for")
          ] }
        ] },
        { say: "ashton", text: "\"It has been professionally reviewed, I'll have you know. By a critic of eleven. My sister Clemmie marks them out of ten, and that one got a nine.\"" },
        { text: "He says the name the way other people put down something breakable." },
        { say: "ashton", text: "\"I write to her every day. By hand. Don't spread it about. I have a reputation for neglect to keep up.\"" },
        { say: "ashton", text: "\"And do not tell the lady about the pun. She would never forgive me.\"" },
        AFF("ashton", 2, "Heard the gull joke"),
        { flag: "chat_ashton_x" },
        NOTE("ashton", "Writes terrible puns at four in the morning and swears by them."),
        NOTE("ashton", "Writes to his little sister Clemmie every day, by hand. She marks his jokes out of ten."),
        { time: 3 }
      ] },
      { text: "\"What's actually in the deck, Ashton?\"", when: (s)=>!s.flags["deck_known_ashton"], steps: [
        { scene: "deck_ashton" }
      ] },
      { text: "\"I'll leave you to your campaign.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to your campaign.\"" },
        { say: "ashton", text: "\"Back to the front, then. Wish me luck, Vance. I shall assume that you did.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_ashton_done" },
    { say: "ashton", text: "\"You are an excellent listener, Vance. It is a much rarer vice than talking. Do come back, and I shall give you the sequel.\"" },
    { end: true }
  ]
});

scene("deck_ashton", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_ashton"], end: true },
    { choice: [
      { text: "\"A rose, and you trim the thorns yourself. A flower with a very sharp edge. Rain of Arrows? A thousand small cuts?\"", hint: "From his rose", steps: [
        { say: "rowan", text: "\"A rose, and you trim the thorns yourself. A flower with a very sharp edge. Rain of Arrows? A thousand small cuts?\"" },
        { say: "ashton", text: "\"Good heavens, no.\" Genuinely wounded. \"The thorns are for the roses, old thing. They are not a *strategy*.\"" },
        { say: "ashton", text: "\"Spell Industrialization. Pollution. Naturally.\"" },
        AFF("ashton", 1, "Guessed wrong")
      ] },
      { text: "\"What do you play, Ashton? I assume it's flashy.\"", steps: [
        { say: "rowan", text: "\"What do you play, Ashton? I assume it's flashy.\"" },
        { say: "ashton", text: "\"Spell Industrialization. Pollution. Naturally.\"" },
        AFF("ashton", 1, "Asked about his deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_ashton" },
        { end: true }
      ] }
    ] },
    { text: "Your eyes go to the middle distance and stay there. You hear yourself start talking, without moving your head." },
    { say: "rowan", text: "\"…Pyroblast, as many targets as he likes. One Pollution Token on his own side for each. Every token shrinks the hand. Victorica lifts one a turn. Piranha is summoned by removing one.\"" },
    { say: "rowan", text: "\"Spewer fires when one leaves. Rain of Arrows across my whole side.\" A breath. \"Eraser Beam, once a game. Slow start. Zones clog. Power on credit.\"" },
    { say: "ashton", text: "\"On *credit!*\"" },
    { text: "He is, for a moment, entirely sincere." },
    { say: "ashton", text: "\"Somebody understands the economics.\"" },
    { choice: [
      { text: "\"It's a very beautiful way to lose, if you misjudge the tokens.\"", steps: [
        { say: "rowan", text: "\"It's a very beautiful way to lose, if you misjudge the tokens.\"" },
        { say: "ashton", text: "\"Most beautiful things are.\" He glances down the deck, and back. \"Don't read anything into that.\"" }
      ] },
      { text: "\"Why poison your own side of the field?\"", steps: [
        { say: "rowan", text: "\"Why poison your own side of the field?\"" },
        { say: "ashton", text: "\"My deck spoils the field for everyone, myself included. People show you who they are when everything's a little poisoned.\"" },
        { say: "ashton", text: "\"I include myself in that. One finds out a great deal with four cards in hand.\"" }
      ] }
    ] },
    DECK("ashton")
  ]
});

scene("post_ashton", {
  steps: [
    DECK("ashton"),
    { when: (s)=>s.duels["ferry_ashton"] === "won", jump: "won" },
    { text: "Ashton sweeps the last cards together with a flourish." },
    { say: "ashton", text: "\"I do hope the lady was watching.\"" },
    { say: "rowan", text: "\"You Pyroblasted everything I put down and then laundered the tokens through the Piranhas. I didn't have an answer.\"" },
    { say: "ashton", text: "\"Do tell her that.\"" },
    { text: "He glances down the deck at the lady, who is looking at the sea." },
    { say: "ashton", text: "\"…Or don't. I'll tell her myself.\"" },
    { choice: [
      { text: "\"Will you?\"", steps: [
        { say: "rowan", text: "\"Will you?\"" },
        { say: "ashton", text: "\"Eventually. In a sentence of my own choosing.\" He squares the deck with great care. \"You played it well, Vance. I mean that without decoration.\"" }
      ] },
      { text: "\"Good game. I'd like another one, on dry land.\"", steps: [
        { say: "rowan", text: "\"Good game. I'd like another one, on dry land.\"" },
        { say: "ashton", text: "\"You shall have it. Bring an answer for the Piranhas; I should hate to become predictable.\"" }
      ] }
    ] },
    { jump: "out" },
    { label: "won" },
    { text: "Ashton regards a board that is mostly smoke." },
    { say: "ashton", text: "\"I over-leaked. I always over-leak. It's a vice.\"" },
    { say: "rowan", text: "\"You Pyroblasted three targets on turn two and your hand shrank to four cards. Then I could just wait.\"" },
    { say: "ashton", text: "\"A sound plan. Waiting for me to run out of hand.\" He smiles ruefully. \"It's the one thing I can't afford, old thing. A patient opponent.\"" },
    { choice: [
      { text: "\"Then I'll be patient.\"", steps: [
        { say: "rowan", text: "\"Then I'll be patient.\"" },
        { say: "ashton", text: "\"Don't you dare.\" A beat. \"…Well. Do. It was the best game I have had since the harbour, and I have had two.\"" }
      ] },
      { text: "\"Two targets on turn two, and I think you'd have had me.\"", steps: [
        { say: "rowan", text: "\"Two targets on turn two, and I think you'd have had me.\"" },
        { say: "ashton", text: "\"Two.\" He looks at the board as if it had been rude to him. \"Restraint. What a perfectly horrid idea. I shall try it once and report back.\"" }
      ] }
    ] },
    // Nach Rowans Sieg: Ashton gibt Trinkgeld (er gibt immer zu viel).
    { text: "He draws a small, heavy purse from an inside pocket, counts Smug Coins onto the bench in a neat column without looking at them, and slides the column across to you with one finger." },
    { say: "ashton", text: "\"Twenty. For the entertainment. One always tips the band, and you were rather a good band.\"" },
    { choice: [
      { text: "\"Thank you. It's going on sleeves.\"", steps: [
        { say: "rowan", text: "\"Thank you. It's going on sleeves.\"" },
        { say: "ashton", text: "\"Sleeves. How grimly sensible. Buy the good ones, Vance; I shall be checking.\"" },
        { coins: 20, flag: "ashton_gave_coins" }
      ] },
      { text: "\"Keep it. You lost a game, not a bet.\"", steps: [
        { say: "rowan", text: "\"Keep it. You lost a game, not a bet.\"" },
        { text: "He looks at the column of coins as if it had passed a remark." },
        { say: "ashton", text: "\"…So I did. Nobody has ever handed one of those back to me.\" He sweeps them into the purse. \"I find I don't mind it. How very peculiar.\"" },
        { flag: "ashton_tip_refused" }
      ] }
    ] },
    { label: "out" },
    AFF("ashton", 1, "Talked it through")
  ]
});

/* ===================================================================== VICTORIA */
scene("ferry_victoria", {
  steps: [
    { when: (s)=>!!s.flags["met_victoria"], jump: "again" },
    { text: "Under the one dry striped awning, on the one dry bench, a girl in a ruffled dress sits with a lace parasol open over her head, although she is already under an awning. Long pale-gold ringlets tied with ribbons. Wide sky-blue eyes that rest on things rather than people." },
    { text: "A folded letter lies on the bench beside her, squared exactly to the edge of the plank. She is watching the wake." },
    { text: "She does not look round." },
    { choice: [
      { text: "\"Excuse me. I'm Rowan. Is it all right if I sit with you for a moment? I won't talk much.\"", hint: "Plain", steps: [
        { say: "rowan", text: "\"Excuse me. I'm Rowan. Is it all right if I sit with you for a moment? I won't talk much.\"" },
        { say: "victoria", alias: "Girl with a parasol", text: "\"Yes.\" She turns her head, slowly. \"I should like that. I have been here since Tuesday.\" A pause. \"That is a joke. I am told that I do not make them. I was practising.\"" },
        { say: "rowan", text: "\"It was a good one. Tuesday is a long time on a bench.\"" },
        { say: "victoria", alias: "Girl with a parasol", text: "\"Thank you. I chose Tuesday because it is the furthest day from a Monday that is still believable.\"" },
        { say: "victoria", alias: "Girl with a parasol", text: "\"Victoria Capulet. You may sit on the left. The right is where the parasol leans when I rest my arm.\"" },
        AFF("victoria", 3, "Asked her plainly"),
        { flag: "victoria_plain" },
        { flag: "victoria_knows_name" }
      ] },
      { text: "\"Is that for the sun, or in case the sea tries anything?\"", hint: "Joke", steps: [
        { say: "rowan", text: "\"Is that for the sun, or in case the sea tries anything?\"" },
        { text: "The sea goes on being the sea. A gull crosses the sky. Nothing at all happens, and goes on happening, for what feels like a full minute." },
        { think: "Either she didn't hear me, or that was the longest mistake of my life." },
        { say: "victoria", alias: "Girl with a parasol", text: "\"I did not hear you, because I was looking at the wake.\"" },
        { text: "She turns her head. The sky-blue eyes arrive on you like a slow, polite weather." },
        { say: "victoria", alias: "Girl with a parasol", text: "\"I have finished now.\"" },
        { say: "victoria", alias: "Girl with a parasol", text: "\"It is for the sun, and in case the sea tries anything. Both. I like to be prepared, and it is also pretty. Victoria Capulet.\"" },
        AFF("victoria", 1, "Waited for her answer"),
        { flag: "victoria_parasol" },
        NOTE("victoria", "The parasol is for the sun, and in case the sea tries anything.")
      ] },
      { text: "\"Hey, you, in the lace! What's the story with the parasol? Does it come with the dress, or is it an upgrade?\"", hint: "Loud", steps: [
        { say: "rowan", text: "\"Hey, you, in the lace! What's the story with the parasol? Does it come with the dress, or is it an upgrade?\"" },
        { text: "Heads turn along the rail. The silence from the bench is very polite. And then very, very long." },
        { say: "victoria", alias: "Girl with a parasol", text: "\"I did not hear you, because I was looking at the wake. I have finished now.\" She turns her head. \"You spoke rather quickly, and rather loudly, and I could not tell which part was the question.\"" },
        { say: "victoria", alias: "Girl with a parasol", text: "\"I answer one thing at a time. If you would be so good as to ask again, more slowly, I should like to answer. Victoria Capulet.\"" },
        AFF("victoria", -1, "Hurried her"),
        { flag: "victoria_hurried" },
        { choice: [
          { text: "\"I'm sorry. That was too much at once. What is the parasol for?\"", steps: [
            { say: "rowan", text: "\"I'm sorry. That was too much at once. What is the parasol for?\"" },
            { say: "victoria", alias: "Girl with a parasol", text: "\"For the sun, and in case the sea tries anything. Thank you. That was a question of a good size.\"" },
            { flag: "victoria_parasol" },
            NOTE("victoria", "The parasol is for the sun, and in case the sea tries anything.")
          ] },
          { text: "\"I'm sorry. I'm Rowan. May I sit down?\"", steps: [
            { say: "rowan", text: "\"I'm sorry. I'm Rowan. May I sit down?\"" },
            { say: "victoria", alias: "Girl with a parasol", text: "\"Yes. That is one thing, and I can answer it. Thank you.\"" },
            { flag: "victoria_knows_name" }
          ] }
        ] }
      ] }
    ] },
    MET("victoria", "Victoria Capulet"),
    { when: (s)=>!s.flags["victoria_knows_name"], say: "victoria", text: "\"You have not said who you are.\"" },
    { when: (s)=>!s.flags["victoria_knows_name"], say: "rowan", text: "\"Rowan. Rowan Vance.\"" },
    { when: (s)=>!s.flags["victoria_knows_name"], say: "victoria", text: "\"Rowan.\" She says it once, with care, as if putting it away in the correct drawer. \"You may sit.\"" },
    { flag: "victoria_knows_name" },
    { text: "You sit. The bench is dry; the rest of the deck is not. She goes back to the wake, and for a while that is the whole conversation." },
    { say: "victoria", text: "\"My letter says that the ferry ties up at twenty minutes to eleven.\" Two fingers rest on the folded paper. \"It gives a time for the pier and a time for supper. It does not say what happens in between. Do you know what happens in between?\"" },
    { choice: [
      { text: "\"No. Mine doesn't say either.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"No. Mine doesn't say either.\"" },
        { say: "victoria", text: "\"Thank you. That is not the answer I wished for, but it is one that I can use.\"" },
        AFF("victoria", 2, "Said he did not know")
      ] },
      { text: "\"I'd guess somebody meets us and tells us where to go. But that's a guess.\"", steps: [
        { say: "rowan", text: "\"I'd guess somebody meets us and tells us where to go. But that's a guess.\"" },
        { say: "victoria", text: "\"A guess, and labelled as a guess. That is considerate. I shall keep it apart from the things I know.\"" },
        AFF("victoria", 1, "Labelled his guess")
      ] },
      { text: "\"It'll all be organised. Don't worry about it.\"", steps: [
        { say: "rowan", text: "\"It'll all be organised. Don't worry about it.\"" },
        { say: "victoria", text: "\"Do you know that, or are you being kind?\"" },
        { say: "rowan", text: "\"…Being kind. I don't know.\"" },
        { say: "victoria", text: "\"Then please do not. I can do nothing with a kindness. I cannot plan by it.\"" },
        { say: "victoria", text: "\"But you corrected it when you were asked.\" She considers this. \"Many people do not.\"" },
        AFF("victoria", -1, "Called a guess a fact")
      ] }
    ] },
    { say: "victoria", text: "\"My sister will be on the pier. She is a second-year. So I know the pier. It is the part after the pier that is blank.\"" },
    { flag: "victoria_said_sister" },
    { text: "Her eyes travel, without hurry, from your face to your shoulders." },
    { say: "victoria", text: "\"You have no Academy jacket. Everybody else's tells me where they are going to sleep. Yours tells me only that it may rain.\"" },
    { say: "rowan", text: "\"The Commons. Bungalow seven. The proper jacket comes later.\"" },
    { say: "victoria", text: "\"Rare Hall. Room two hundred and three. I have not seen the room. I have seen the number.\"" },
    { choice: [
      { text: "\"Does a number help?\"", steps: [
        { say: "rowan", text: "\"Does a number help?\"" },
        { say: "victoria", text: "\"Yes. A number stays where it is put.\" A pause while she finishes the thought. \"People are kind, and then they are elsewhere. A number is on the door in the morning.\"" }
      ] },
      { text: "\"The second floor. Then you might get a view of something.\"", steps: [
        { say: "rowan", text: "\"The second floor. Then you might get a view of something.\"" },
        { say: "victoria", text: "\"I do not know that. You do not know that either.\"" },
        { text: "She thinks about it for exactly as long as it needs." },
        { say: "victoria", text: "\"I should like one. I had not thought to want it until you said so. Thank you. That is a new thing to want.\"" },
        AFF("victoria", 1, "Gave her something to want")
      ] }
    ] },
    { say: "victoria", text: "\"I am going to look at the wake again now. It is not that you are dull. It is that I had not finished.\"" },
    { say: "victoria", text: "\"You may stay, or you may come back. Both are on the list of things that are all right.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is it going to rain? Is that why the umbrella? Baylee, check the sky!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"She is already under an awning.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("victoria", "Speaks slowly and exactly, and answers one thing at a time. Rare Hall, room 203."),
    { time: 8 },
    { flag: "chat_victoria_offered" },
    { jump: "menu" },

    { label: "again" },
    { say: "victoria", text: "\"Rowan.\"" },
    { text: "She looks up from under the parasol. It is a very still, very attentive look." },
    { when: (s)=>!!s.flags["victoria_sat"], say: "victoria", text: "\"You are the one who does not fill silences. The left side of the bench is still free.\"" },
    { when: (s)=>!s.flags["victoria_sat"], say: "victoria", text: "\"The sea has been exactly the same colour since we left. I find that restful.\"" },
    { label: "menu" },
    { choice: [
      { text: "\"May I ask you something? One thing at a time.\"", when: (s)=>!s.flags["chat_victoria_done"], steps: [
        { say: "rowan", text: "\"May I ask you something? One thing at a time.\"" },
        { say: "victoria", text: "\"Yes. I shall answer them in the order in which they arrive.\"" },
        { scene: "chat_victoria" }
      ] },
      { text: "Sit beside her, watch the wake, and say nothing at all.", when: (s)=>!s.flags["victoria_sat"], steps: [
        { text: "You sit on the left. The wake unrolls behind the ship, white and then less white and then gone. The awning snaps once. A gull hangs over the flagstaff and thinks about something." },
        { text: "Nobody asks you anything. Nobody is waiting for you to be clever. It occurs to you that your hands, on your knees, are perfectly steady." },
        { say: "victoria", text: "\"That was eleven minutes. You did not fill them. Thank you.\"" },
        AFF("victoria", 2, "Sat without talking"),
        { flag: "victoria_sat" },
        { time: 11 }
      ] },
      { text: "\"Would you play a game with me at some point? I'd like to see how you play.\"", hint: "After docks", when: (s)=>!s.flags["victoria_game_after_docks"], steps: [
        { say: "rowan", text: "\"Would you play a game with me at some point? I'd like to see how you play.\"" },
        { say: "victoria", text: "\"I do not play in a crowd. After we dock. At a table.\" A faint, almost-smile. \"I should like it very much.\"" },
        { flag: "victoria_game_after_docks" }
      ] },
      { text: "Let her be.", steps: [
        { say: "victoria", text: "\"Thank you.\"" }
      ] }
    ] },
    { time: 4 },
    { end: true }
  ]
});

scene("chat_victoria", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_victoria_1"] && !!s.flags["chat_victoria_2"] && !!s.flags["chat_victoria_3"] && !!s.flags["chat_victoria_x"] && (!!s.flags["chat_victoria_4"] || !!s.flags["victoria_parasol"]) && !s.flags["chat_victoria_done"], jump: "done" },
    { choice: [
      { text: "\"What are you looking at, out there? If it's all right to ask.\"", when: (s)=>!s.flags["chat_victoria_1"], steps: [
        { say: "rowan", text: "\"What are you looking at, out there? If it's all right to ask.\"" },
        { say: "victoria", text: "\"The place where the wake becomes the sea. It is not a line. It is a decision.\" Quiet. \"It is not a very large decision. I like it.\"" },
        { choice: [
          { text: "\"Has it decided yet?\"", steps: [
            { say: "rowan", text: "\"Has it decided yet?\"" },
            { say: "victoria", text: "\"Nearly. Each time, nearly.\" The smallest almost-smile. \"That is why I keep looking.\"" }
          ] },
          { text: "\"I'm looking at it too. All I can see is foam.\"", steps: [
            { say: "rowan", text: "\"I'm looking at it too. All I can see is foam.\"" },
            { say: "victoria", text: "\"Foam is the first part. You stopped early. Most people do. It is not a fault, it is a habit.\"" },
            { say: "victoria", text: "\"Look where the white goes thin. There.\"" },
            { text: "You look. For about a second you see it: the exact place where the ship stops having happened. Then it is only water again." },
            { say: "rowan", text: "\"…Huh.\"" },
            { say: "victoria", text: "\"Yes.\"" },
            AFF("victoria", 1, "Looked where she looked")
          ] }
        ] },
        { say: "victoria", text: "\"And you? What do you look at, when you look at something for a long time?\"" },
        { choice: [
          { text: "\"A screen, mostly. Card games. Other people's hands, for hours.\"", steps: [
            { say: "rowan", text: "\"A screen, mostly. Card games. Other people's hands, for hours.\"" },
            { say: "victoria", text: "\"Then you look at pictures. Small ones, that move. I prefer a thing that stays, or that goes away slowly.\"" }
          ] },
          { text: "\"A dryer door. I worked in a laundromat.\"", steps: [
            { say: "rowan", text: "\"A dryer door. I worked in a laundromat.\"" },
            { say: "victoria", text: "\"Round, and it turns, and things fall slowly. Yes. I should have liked that.\"" },
            { say: "victoria", text: "\"Did you ever see a thing in it that ought not to have been there?\"" },
            { say: "rowan", text: "\"A shoe, once. Just the one.\"" },
            { say: "victoria", text: "\"One. That is the interesting number.\"" }
          ] }
        ] },
        { say: "victoria", text: "\"I have made four crossings by sea, counting this one. Three were only sea. Once there was something in the water that had no business there.\"" },
        { flag: "victoria_said_something" },
        AFF("victoria", 2, "Asked about her view"),
        { flag: "chat_victoria_1" },
        NOTE("victoria", "Watches the place where the wake becomes the sea: 'a decision, not a line.'"),
        { time: 3 }
      ] },
      { text: "\"You said your sister will be on the pier. What is she like?\"", when: (s)=>!s.flags["chat_victoria_2"] && !!s.flags["victoria_said_sister"], steps: [
        { say: "rowan", text: "\"You said your sister will be on the pier. What is she like?\"" },
        { say: "victoria", text: "\"My sister, Ophelia.\" She says it with great steadiness. \"She is shorter than I am, and a great deal louder, and she will be on the pier. She has written so, and she does not write things that are not so.\"" },
        { say: "victoria", text: "\"She has written also that if anybody is unkind, I am to say her name. I have not yet had to. I am hopeful that I shall not have to.\"" },
        { choice: [
          { text: "\"I hope not too.\"", steps: [
            { say: "rowan", text: "\"I hope not too.\"" },
            { say: "victoria", text: "\"Thank you.\"" }
          ] },
          { text: "\"Was it her idea, you coming here?\"", steps: [
            { say: "rowan", text: "\"Was it her idea, you coming here?\"" },
            { say: "victoria", text: "\"No. It was decided that I should not come. I decided that I should.\"" },
            { say: "victoria", text: "\"I am told that I was very difficult about it. I do not remember being difficult. I remember not having luncheon, for nine days.\"" },
            { text: "She says it in the tone of a weather report." },
            { say: "rowan", text: "\"That's a strong argument.\"" },
            { say: "victoria", text: "\"It was the only one I had, and it stood. A lady ought not to be proud of such a thing, so I am proud of it quietly.\"" },
            AFF("victoria", 1, "Asked whose idea it was")
          ] }
        ] },
        { say: "victoria", text: "\"She will say 'Meaning what?' to you. Do not be alarmed. It is her way of being fond.\"" },
        AFF("victoria", 2, "Asked about her sister"),
        { flag: "chat_victoria_2" },
        NOTE("victoria", "Her sister Ophelia is a second-year and will be waiting on the pier."),
        { time: 3 }
      ] },
      { text: "\"The ribbons. Are they chosen, or do they just match?\"", when: (s)=>!s.flags["chat_victoria_3"], steps: [
        { say: "rowan", text: "\"The ribbons. Are they chosen, or do they just match?\"" },
        { say: "victoria", text: "\"They are Monday's.\"" },
        { text: "She touches one, to make certain that it is still Monday's." },
        { say: "victoria", text: "\"There is a colour for each day of the week. Then I need not ask anybody what day it is. I need only look in the glass.\"" },
        { choice: [
          { text: "\"What happens if it's the wrong colour?\"", steps: [
            { say: "rowan", text: "\"What happens if it's the wrong colour?\"" },
            { say: "victoria", text: "\"Then it is the wrong day, all day, and nothing that I do in it sits properly.\"" },
            { say: "victoria", text: "\"It has happened twice. One was a Thursday. I do not discuss the Thursday.\"" },
            { say: "rowan", text: "\"I won't ask about the Thursday.\"" },
            { say: "victoria", text: "\"Thank you. That is the correct amount of asking.\"" }
          ] },
          { text: "\"That's a good system. I never know what day it is.\"", steps: [
            { say: "rowan", text: "\"That's a good system. I never know what day it is.\"" },
            { say: "victoria", text: "\"You may borrow it. You would need seven of something. It need not be ribbons.\"" },
            { say: "victoria", text: "\"Socks would do.\" She has plainly given it real thought. \"Nobody would know but you, which is the best kind of system.\"" },
            { say: "rowan", text: "\"Monday socks.\"" },
            { say: "victoria", text: "\"Is this a joke? I am to ask. If it is a joke, I will consider it afterwards.\"" },
            { say: "rowan", text: "\"Half a joke.\"" },
            { say: "victoria", text: "\"Then I shall consider half.\"" },
            AFF("victoria", 1, "Took her system seriously")
          ] }
        ] },
        AFF("victoria", 2, "Noticed the ribbons"),
        { flag: "chat_victoria_3" },
        NOTE("victoria", "Wears a different ribbon colour for each day of the week; the wrong one spoils the whole day."),
        { time: 3 }
      ] },
      { text: "\"The parasol. You're already under an awning.\"", when: (s)=>!s.flags["chat_victoria_4"] && !s.flags["victoria_parasol"], steps: [
        { say: "rowan", text: "\"The parasol. You're already under an awning.\"" },
        { say: "victoria", text: "\"Yes. I had noticed that as well.\"" },
        { say: "victoria", text: "\"It is for the sun, and in case the sea tries anything. I like to be prepared, and it is also pretty.\"" },
        { choice: [
          { text: "\"Has the sea tried anything?\"", steps: [
            { say: "rowan", text: "\"Has the sea tried anything?\"" },
            { say: "victoria", text: "\"Not yet.\" A very small, very pleased pause. \"That is how I know that it works.\"" }
          ] },
          { text: "\"And the awning isn't enough?\"", steps: [
            { say: "rowan", text: "\"And the awning isn't enough?\"" },
            { say: "victoria", text: "\"The awning belongs to the ship. The ship may turn, and then the sun is on the other side, and nobody will have asked me.\"" },
            { say: "victoria", text: "\"The parasol goes where I go. It is the only roof I have that does.\"" }
          ] }
        ] },
        AFF("victoria", 2, "Asked about the parasol"),
        { flag: "chat_victoria_4" },
        NOTE("victoria", "The parasol is for the sun, and in case the sea tries anything."),
        { time: 3 }
      ] },
      { text: "\"The thing in the water that had no business there. What was it?\"", when: (s)=>!s.flags["chat_victoria_x"] && !!s.flags["victoria_said_something"], steps: [
        { say: "rowan", text: "\"The thing in the water that had no business there. What was it?\"" },
        { say: "victoria", text: "\"A lemon.\"" },
        { say: "victoria", text: "\"It was floating, alone, in the middle of the water. We were a long way from any tree. I looked at it for eleven minutes. I wished to know who had lost it.\"" },
        { choice: [
          { text: "\"Did you find out?\"", steps: [
            { say: "rowan", text: "\"Did you find out?\"" },
            { say: "victoria", text: "\"No. That is why it is the best thing I have seen at sea.\"" }
          ] },
          { text: "\"Somebody on a yacht had to drink their gin without it.\"", steps: [
            { say: "rowan", text: "\"Somebody on a yacht had to drink their gin without it.\"" },
            { text: "The pause is long enough for you to regret it, and then to stop regretting it." },
            { say: "victoria", text: "\"That is a possible lemon. Mine fell from a crate. Yours has a person at the end of it, who is still waiting.\"" },
            { say: "victoria", text: "\"I shall keep both. I do not have to choose, because nobody is ever going to tell me the answer.\"" },
            AFF("victoria", 1, "Gave her a second lemon")
          ] }
        ] },
        { say: "victoria", text: "\"I like a question that stays.\" Very quietly, and quite seriously." },
        AFF("victoria", 2, "Heard about the lemon"),
        { flag: "chat_victoria_x" },
        NOTE("victoria", "The best thing she has seen at sea is a lemon floating alone, far from any tree."),
        { time: 3 }
      ] },
      { text: "\"Do you play, Victoria? Or did you come for something else?\"", when: (s)=>!s.flags["deck_known_victoria"], steps: [
        { scene: "deck_victoria" }
      ] },
      { text: "\"I'll let you look. Thank you, Victoria.\"", steps: [
        { say: "rowan", text: "\"I'll let you look. Thank you, Victoria.\"" },
        { say: "victoria", text: "\"Thank you for the questions. They were kindly asked.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_victoria_done" },
    { say: "victoria", text: "\"Thank you for asking one thing at a time. It is a great kindness. I do not believe you know how great.\"" },
    { text: "She turns back to the wake." },
    { say: "victoria", text: "\"I shall go on looking now.\"" },
    { end: true }
  ]
});

scene("deck_victoria", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_victoria"], end: true },
    { choice: [
      { text: "\"The ribbons, the lace, the parasol. Is the deck pretty things? Birds and butterflies and healers?\"", hint: "From her look", steps: [
        { say: "rowan", text: "\"The ribbons, the lace, the parasol. Is the deck pretty things? Birds and butterflies and healers?\"" },
        { say: "victoria", text: "\"Yes.\"" },
        { text: "A pause as the thought settles." },
        { say: "victoria", text: "\"How did you know that? I am told people do not usually guess it.\"" },
        { say: "victoria", text: "\"I chose each one because it is lovely. Pretty Things. The Moonlight Butterfly. The Golden Apple. The Rainbow's Arrow.\"" },
        AFF("victoria", 3, "Understood her deck")
      ] },
      { text: "\"Which cards do you play, Victoria? I'd like to hear how you choose.\"", steps: [
        { say: "rowan", text: "\"Which cards do you play, Victoria? I'd like to hear how you choose.\"" },
        { say: "victoria", text: "\"The lovely ones.\" A calm blink. \"The deck is called Pretty Things. I am told this is not a strategy. I consider it one.\"" },
        AFF("victoria", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_victoria" },
        { end: true }
      ] }
    ] },
    { text: "Your eyes lose their grip on the wake. For a few seconds the words come out of you with nobody behind them." },
    { say: "rowan", text: "\"…Moonlight Butterfly. Cute Bird, no Phoenix behind it. Rainbow's Arrow. Angelfeather Arrow, an arrow with no attack. Gems, every colour. Heal. Healing Melody. Golden Apple — borrows a hero of mine. Magic Ruby. No engine. No finisher. Wins if I beat myself.\"" },
    { text: "You blink. The deck comes back, and the bench, and the girl. You have said all of that out loud." },
    { say: "rowan", text: "\"I'm — that was out loud. I'm sorry. That was a rude thing to say about somebody's cards.\"" },
    { say: "victoria", text: "\"It was perfectly accurate.\"" },
    { text: "She does not seem offended in the least." },
    { say: "victoria", text: "\"People do beat themselves, quite often. I watch them do it. It is rather like the wake.\"" },
    { say: "victoria", text: "\"I should like it very much if you were *kind* about the Golden Apple.\"" },
    { choice: [
      { text: "\"The Golden Apple is the best card in it. Borrowing a hero is a real play.\"", steps: [
        { say: "rowan", text: "\"The Golden Apple is the best card in it. Borrowing a hero is a real play.\"" },
        { say: "victoria", text: "\"Thank you. It is also a very good gold. I chose it for the gold, but I am glad that it is useful as well.\"" },
        AFF("victoria", 1, "Was kind about the Apple")
      ] },
      { text: "\"And the Moonlight Butterfly? I'd have cut it. I suspect that's the wrong thing to say.\"", steps: [
        { say: "rowan", text: "\"And the Moonlight Butterfly? I'd have cut it. I suspect that's the wrong thing to say.\"" },
        { say: "victoria", text: "\"It is the wrong thing to say, and you suspected so, which is something.\"" },
        { say: "victoria", text: "\"One does not cut a picture.\" With great warmth. \"Each card is a small window. I cannot open it, but I may look in.\"" },
        { say: "victoria", text: "\"The Moonlight Butterfly is lovely. It does not do very much, which I find a comfort.\"" },
        AFF("victoria", 1, "Asked about the picture")
      ] }
    ] },
    DECK("victoria"),
    NOTE("victoria", "Loves card art: each card is a small window.")
  ]
});

/* ===================================================================== CAS (new arrival) */
scene("ferry_cas", {
  steps: [
    { when: (s)=>!!s.flags["met_cas"], jump: "again" },
    { text: "At the flagstaff, with his back to the wake and the whole after deck laid out in front of him like a pitch, a boy in a long striped scarf is talking to his own lapel." },
    { text: "Wavy dark hair, a black jacket with a blue collar, an easy mouth. Clipped to the lapel is a small microphone. Its lead runs down inside the scarf, comes out again at the bottom, and stops." },
    { say: "cas", alias: "Boy with a microphone", text: "\"…conditions remain good here on the stern deck, a following wind, the island somewhere off the bow, and at the rail the gentleman is selecting another rose. We have seen this approach before.\"" },
    { when: (s)=>!s.flags["met_ashton"], text: "He passes you the scene with an open hand, as though handing over to a colleague. You look. A violet-haired boy is squaring his shoulders at the rail, rose first." },
    { when: (s)=>!!s.flags["met_ashton"], text: "He passes you the scene with an open hand, as though handing over to a colleague. You look. Ashton is squaring his shoulders at the rail, rose first." },
    { when: (s)=>!s.flags["met_jessica"], text: "Thirty feet from him a girl sits beside a trolley of leather caskets and regards the sea." },
    { when: (s)=>!!s.flags["met_jessica"], text: "Thirty feet from him Jessica sits beside her trolley of caskets and regards the sea." },
    { flag: "cas_heard" },
    { say: "cas", alias: "Boy with a microphone", text: "\"And a newcomer on the deck. No jacket, no collar, walking straight up to the commentary position, which is not something we see every day. Let's see what he does.\"" },
    { choice: [
      { text: "\"Who's winning?\"", hint: "Play along", steps: [
        { say: "rowan", text: "\"Who's winning?\"" },
        { say: "cas", alias: "Boy with a microphone", text: "\"Good question, and thank you for joining us. The lady with the caskets, comfortably. She has led since the harbour without making a single move, which is the hardest way there is to lead.\"" },
        AFF("cas", 2, "Joined the broadcast")
      ] },
      { text: "\"Is that microphone plugged into anything?\"", steps: [
        { say: "rowan", text: "\"Is that microphone plugged into anything?\"" },
        { say: "cas", alias: "Boy with a microphone", text: "\"A technical question, straight off the mark. The honest answer from the commentary box is no. Our listeners are, at present, theoretical.\"" },
        { say: "cas", alias: "Boy with a microphone", text: "\"They are, however, very loyal.\"" },
        AFF("cas", 1, "Asked the obvious thing")
      ] },
      { text: "\"Do those two know you're doing this?\"", steps: [
        { say: "rowan", text: "\"Do those two know you're doing this?\"" },
        { say: "cas", alias: "Boy with a microphone", text: "\"The gentleman knows, and has raised his game by about a third. The lady knows, and has not altered hers by a hair. Make of that what you will.\"" }
      ] }
    ] },
    { say: "cas", alias: "Boy with a microphone", text: "\"Caspian Abernathy, your commentator for the crossing. Cas, off air. Auxiliary track, Rare Hall, room one-oh-three.\"" },
    MET("cas", "Caspian \"Cas\" Abernathy"),
    { say: "rowan", text: "\"Rowan.\"" },
    { when: (s)=>!!s.flags["told_wildcard"] || !!s.flags["ship_knows_wildcard"], say: "cas", text: "\"Rowan Vance: the name in ink, the last seat of the year, and the only rain jacket in a field of thirty-eight. We'll be keeping an eye on him.\"" },
    { when: (s)=>!s.flags["told_wildcard"] && !s.flags["ship_knows_wildcard"], say: "cas", text: "\"Rowan. No surname offered, no collar shown. A man keeping his cards close to his chest, and the commentary team respects that.\"" },
    { say: "cas", text: "\"Now, I'll be honest with you, as I've been honest with the listeners. I had this one wrong. For the best part of an hour I called it as a first approach: stranger, rose, hope.\"" },
    { say: "cas", text: "\"Then she said his first name. Nobody had told it to her. Unforced error from Abernathy: these two have history, and he has been calling it as a cold open.\"" },
    { flag: "cas_said_history" },
    { choice: [
      { text: "\"One season in the city, last spring. It ended by letter.\"", hint: "From the players", when: (s)=>!!s.flags["jessica_ex_known"] || !!s.flags["ashton_says_ended"], steps: [
        { say: "rowan", text: "\"One season in the city, last spring. It ended by letter.\"" },
        { text: "The open hand stops in mid-air." },
        { say: "cas", text: "\"…And the newcomer has *sources*. A full season and a letter, and the commentary box had it down as two strangers and a florist.\"" },
        { say: "cas", text: "\"I shan't put it out on air. That's theirs. But thank you; I'd rather be corrected than fluent.\"" },
        AFF("cas", 2, "Gave him the real story")
      ] },
      { text: "\"You got there in the end. Most people wouldn't have caught the name.\"", steps: [
        { say: "rowan", text: "\"You got there in the end. Most people wouldn't have caught the name.\"" },
        { say: "cas", text: "\"That's generous, and the commentary team will take it.\"" },
        { text: "For half a second the smooth voice is not there, and a quieter, slower one says:" },
        { say: "cas", text: "\"…Thanks. I mean it.\"" },
        { text: "Then the hand comes up again and the broadcast resumes, as if nothing had been dropped." },
        AFF("cas", 2, "Was kind about the error")
      ] },
      { text: "\"Maybe leave them out of it. They can hear you from here.\"", steps: [
        { say: "rowan", text: "\"Maybe leave them out of it. They can hear you from here.\"" },
        { say: "cas", text: "\"A fair challenge. In my defence I have kept to the play and off the players: no names, no scores read out. But the point is taken, and the volume comes down.\"" },
        { text: "He does, in fact, lower his voice. It makes him sound like snooker." },
        AFF("cas", 1, "Asked him to play fair")
      ] }
    ] },
    { say: "cas", text: "\"And yourself? Every passenger gets a line in the programme. What do I put for you?\"" },
    { choice: [
      { text: "\"Tired. New. Wasn't expecting coverage.\"", steps: [
        { say: "rowan", text: "\"Tired. New. Wasn't expecting coverage.\"" },
        { say: "cas", text: "\"'Tired, new, surprised by the coverage.' That is the most honest player profile I have had all morning. Everybody else gave me their ranking.\"" }
      ] },
      { text: "\"Put that I talk to the wake. It doesn't answer either.\"", steps: [
        { say: "rowan", text: "\"Put that I talk to the wake. It doesn't answer either.\"" },
        { say: "cas", text: "\"…He has a line of his own. I'm not at all sure the box is big enough for two.\"" },
        { text: "He looks extremely pleased about it." },
        AFF("cas", 1, "Good timing")
      ] }
    ] },
    { say: "cas", text: "\"Stay as long as you like. There's room in the box, and I could do with somebody to hand over to when I need to breathe.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He's doing a VOICE! Rowan! Do me! Do ME walking!\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "cas", text: "\"And a late charge from the spiky-haired gentleman. All enthusiasm, very little brake.\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Accurate.\"" },
    { add: { ferry_talked: 1 } },
    NOTE("cas", "Commentates whatever is in front of him, his own mistakes included, into a microphone that is not plugged in. Rare Hall, room 103."),
    { time: 6 },
    { jump: "menu" },

    { label: "again" },
    { text: "The striped scarf is still at the flagstaff, the open hand still passing the deck to an invisible colleague." },
    { say: "cas", text: "\"And he's back. Returning to the commentary position, the man in the rain jacket.\"" },
    { label: "menu" },
    { choice: [
      { text: "\"Have you got a minute between overs?\"", when: (s)=>!s.flags["chat_cas_done"], steps: [
        { say: "rowan", text: "\"Have you got a minute between overs?\"" },
        { say: "cas", text: "\"For a guest in the box, always. We'll go to the wake for a moment. Lovely pictures. Go on.\"" },
        { scene: "chat_cas" }
      ] },
      { text: "\"What's the state of play?\"", steps: [
        { say: "rowan", text: "\"What's the state of play?\"" },
        { when: (s)=>!!s.flags["ashton_advised"], say: "cas", text: "\"Curious passage at the rail. The gentleman has stopped delivering lines and appears to be composing something. He has got as far as her name twice and put the rose down once. We've not seen that before.\"" },
        { when: (s)=>!s.flags["ashton_advised"], say: "cas", text: "\"No change at the rail. The rose is up, the lady has turned one page, and the gulls remain unimpressed. It's a patient game, this.\"" },
        { say: "cas", text: "\"And under the awning, the lady with the parasol has held the same position since we cast off. No commentary needed. Best seat on the deck, and she knows it.\"" },
        { time: 2 }
      ] },
      { text: "Leave him to the broadcast.", steps: [
        { say: "cas", text: "\"And he's away. Thanks for joining us.\"" }
      ] }
    ] },
    { end: true }
  ]
});

scene("chat_cas", {
  steps: [
    { label: "top" },
    { when: (s)=>!!s.flags["chat_cas_1"] && !!s.flags["chat_cas_2"] && !!s.flags["chat_cas_3"] && !s.flags["chat_cas_done"], jump: "done" },
    { choice: [
      { text: "\"That microphone lead doesn't go anywhere. Why wear it?\"", when: (s)=>!s.flags["chat_cas_1"], steps: [
        { say: "rowan", text: "\"That microphone lead doesn't go anywhere. Why wear it?\"" },
        { say: "cas", text: "\"The official line is practice. Four hours of open water, no script, no producer. You'll not find a better rehearsal room.\"" },
        { say: "cas", text: "\"I want to call a world final one day. Somebody has to, and whoever it is began by talking to nobody on a boat.\"" },
        { choice: [
          { text: "\"And the unofficial line?\"", steps: [
            { say: "rowan", text: "\"And the unofficial line?\"" },
            { text: "The hand comes down. When he speaks again it is slower, and every word has been looked at first." },
            { say: "cas", text: "\"It's easier. With it on. I know what my voice is for.\"" },
            { say: "cas", text: "\"Without it I have to… decide what to say. That takes me a while. You'd be standing there.\"" },
            { say: "rowan", text: "\"I'm not in a hurry.\"" },
            { text: "He looks at you as if that were an unusual thing to be told." },
            { say: "cas", text: "\"No. You don't seem to be.\" A breath, and the baritone slides back into place. \"And we're back.\"" },
            AFF("cas", 2, "Waited for the slow answer")
          ] },
          { text: "\"It's working. You're good at it.\"", steps: [
            { say: "rowan", text: "\"It's working. You're good at it.\"" },
            { say: "cas", text: "\"He'll take that. He'll pretend he didn't need it, and he will absolutely take it.\"" },
            AFF("cas", 1, "Said he was good")
          ] }
        ] },
        { flag: "chat_cas_1" },
        NOTE("cas", "Wants to call a world final one day. Says he knows what his voice is for when the microphone is on."),
        { time: 3 }
      ] },
      { text: "\"A following wind, conditions good. Do you know boats, or was that just colour?\"", when: (s)=>!s.flags["chat_cas_2"], steps: [
        { say: "rowan", text: "\"A following wind, conditions good. Do you know boats, or was that just colour?\"" },
        { say: "cas", text: "\"That was not colour, I'll have you know. I grew up at a lock on a big river. My father keeps it. Everything that goes up or down that river goes through our front garden at walking pace.\"" },
        { say: "cas", text: "\"I started calling them when I was six. Sat on the gate. 'And here's the *Margaret Rose*, coming in a little wide—'\"" },
        { choice: [
          { text: "\"Who was listening?\"", steps: [
            { say: "rowan", text: "\"Who was listening?\"" },
            { say: "cas", text: "\"The ducks, mainly. A very fair crowd. They don't mind a pause.\"" },
            { say: "cas", text: "\"And my dad, from the far gate, pretending he couldn't hear. He'd say 'bit wide, was she?' at tea. So I knew.\"" },
            AFF("cas", 2, "Asked who listened")
          ] },
          { text: "\"So this ferry is a busman's holiday.\"", steps: [
            { say: "rowan", text: "\"So this ferry is a busman's holiday.\"" },
            { say: "cas", text: "\"This ferry is the biggest thing I have ever called. One funnel, open sea, four hours. I've been wanting to say 'she's making good way' since the harbour, and now I've said it. Thank you.\"" },
            AFF("cas", 1, "Let him say it")
          ] }
        ] },
        { say: "cas", text: "\"My deck's boats as well. A regatta. Nobody dies. Somebody wins a little cup. I think there should be more of that.\"" },
        { flag: "chat_cas_2" },
        NOTE("cas", "Grew up at a lock on a big river and has called the boats through since he was six. Plays a boat-race deck."),
        { time: 3 }
      ] },
      { text: "\"Room 103, you said. Who are you sharing with?\"", when: (s)=>!s.flags["chat_cas_3"], steps: [
        { say: "rowan", text: "\"Room 103, you said. Who are you sharing with?\"" },
        { say: "cas", text: "\"The letter says an Okonjo, R. Unseen so far. The commentary team has scanned the ship and has, I'm sorry to report, greeted the wrong man.\"" },
        { choice: [
          { text: "\"What did you say to the wrong man?\"", steps: [
            { say: "rowan", text: "\"What did you say to the wrong man?\"" },
            { say: "cas", text: "\"'Looking forward to sharing, R.' To a deckhand called Ron. Who was, in fairness to him, very gracious about it.\"" },
            { say: "cas", text: "\"And he's gone red. Abernathy, replaying it now in his head, and it does not improve on a second viewing.\"" }
          ] },
          { text: "\"I've met him. Rafa. Chef's bandana, always chewing something.\"", hint: "You know him", when: (s)=>!!s.flags["met_rafa"], steps: [
            { say: "rowan", text: "\"I've met him. Rafa. Chef's bandana, always chewing something.\"" },
            { say: "cas", text: "\"And there's the identification, from an unexpected source! Bandana. Chewing. I have been calling that man's ladling for half an hour and had him down as catering.\"" },
            { say: "cas", text: "\"I'll go over. In a bit. When there's a break in play.\"" },
            REL("rafa", "cas"),
            AFF("cas", 2, "Found his roommate")
          ] }
        ] },
        { say: "cas", text: "\"I'd like him to be someone who doesn't mind noise. That's the whole of my requirements. I do know what I'd be like to live with.\"" },
        { flag: "chat_cas_3" },
        NOTE("cas", "Shares Rare Hall 103 with an R. Okonjo, and hopes he is somebody who does not mind noise."),
        { time: 3 }
      ] },
      { text: "\"I'll let you get back on air.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back on air.\"" },
        { say: "cas", text: "\"And we return to the stern deck, where, I can tell you, nothing has happened, beautifully.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_cas_done" },
    { say: "cas", text: "\"And that's the interval. You've been a very good second voice, Rowan. Don't tell the listeners I said so. They think I work alone.\"" },
    { end: true }
  ]
});

/* ===================================================================== ISLAND, day 1 afternoon */
scene("isle_jessica", {
  steps: [
    { when: (s)=>!!s.flags["isle_jessica_done"], jump: "again" },
    { text: "The lawn by the Trial Domes is full of white-and-gold collars standing about in the heat, pretending not to listen to the loudspeaker on the nearest dome." },
    { text: "One person on it is sitting down. She has found the only folding chair on the island, and the smallest of three leather caskets is on her knee." },
    { when: (s)=>!!s.flags["met_jessica"], say: "jessica", text: "\"Rowan. You have crossed a lawn. I had begun to wonder whether it was only decks.\"" },
    { when: (s)=>!s.flags["met_jessica"], text: "Long golden curls under a small gold coronet, a swallow charm on a fine chain, rings on three fingers. She watches you cross the grass with the mild patience of somebody who has been approached a great deal." },
    { when: (s)=>!s.flags["met_jessica"], say: "jessica", alias: "Girl with the caskets", text: "\"Mr Vance. You were read out on the Quad, and one does listen. Jessica Montclair. Spectral Tower, Auxiliary track. I am watching the placements and disapproving of the loudspeaker.\"" },
    MET("jessica", "Jessica Montclair"),
    { text: "Inside the dome somebody plays a card. The loudspeaker, in the voice of a very happy second-year, shouts: \"UN-BELIEVABLE!\"" },
    { say: "jessica", text: "\"That is the fourth 'unbelievable' in ten minutes. All four were perfectly believable. I have been keeping count.\"" },
    { choice: [
      { text: "\"What would you have said instead?\"", steps: [
        { say: "rowan", text: "\"What would you have said instead?\"" },
        { say: "jessica", text: "\"'She waited.' Two words. The whole duel was a girl waiting and a boy who could not bear it.\"" },
        { say: "jessica", text: "\"One says the thing that happened. Then one is quiet, and lets people watch it happen.\"" },
        AFF("jessica", 2, "Asked for her call"),
        NOTE("jessica", "Her idea of commentary: say the thing that happened, then be quiet.")
      ] },
      { text: "\"He's enjoying himself. That counts for something.\"", steps: [
        { say: "rowan", text: "\"He's enjoying himself. That counts for something.\"" },
        { say: "jessica", text: "\"It counts for a great deal. It is the one thing he is doing correctly.\" The corner of her mouth moves. \"I shall be kind about him until I have the desk. After that I make no promises.\"" },
        AFF("jessica", 1, "Was fair to the caller")
      ] },
      { text: "\"We've docked. You told me to ask you again about a game.\"", hint: "From the ferry", when: (s)=>!!s.flags["jessica_game_after_docks"], steps: [
        { say: "rowan", text: "\"We've docked. You told me to ask you again about a game.\"" },
        { say: "jessica", text: "\"I did, and you have. I said that I notice who remembers.\"" },
        { say: "jessica", text: "\"Not today. Today I am watching, and the caskets are only two-thirds unpacked. You will have a time and a place, in writing. Be punctual.\"" },
        AFF("jessica", 2, "Remembered to ask"),
        { flag: "jessica_game_promised" }
      ] }
    ] },
    { when: (s)=>!!s.flags["jessica_plain"] || !!s.flags["jessica_cheesy"] || !!s.flags["jessica_ex_known"], say: "jessica", text: "\"They have given me the second floor and the volcano, as threatened. It is very large. So is the room. I have not yet decided about either.\"" },
    { when: (s)=>!(!!s.flags["jessica_plain"] || !!s.flags["jessica_cheesy"] || !!s.flags["jessica_ex_known"]), say: "jessica", text: "\"They have given me the second floor of the Tower, with a view of the volcano. It is very large. So is the room. I have not yet decided about either.\"" },
    { when: (s)=>!!s.flags["met_ashton"], text: "Twenty yards off, Ashton is pacing a short, elegant line on the grass with a rose in his lapel, waiting for his name. He is very carefully not looking this way." },
    { when: (s)=>!s.flags["met_ashton"], text: "Twenty yards off, a tall boy with violet hair and a rose in his lapel is pacing a short, elegant line on the grass, waiting for his name. He is very carefully not looking this way." },
    { when: (s)=>!!s.flags["jessica_ex_known"], say: "jessica", text: "\"He is nervous. He straightens his cuffs when he is nervous. Do not tell him that I know.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "jessica", text: "\"They call the Commons at half past one. Do not be late. It is the only thing they will not forgive.\"" },
    { when: (s)=>!!s.flags["placement_done"], say: "jessica", text: "\"And yours is done, and you are upright. I shall not ask the result on a lawn. Tell me when there is somewhere to sit.\"" },
    { flag: "isle_jessica_done" },
    { time: 5 },
    { end: true },
    { label: "again" },
    { say: "jessica", text: "\"Rowan. Five, now.\"" },
    { text: "The loudspeaker shouts something. She raises one finger from the casket lid, by way of a tally, and puts it down again." },
    { say: "jessica", text: "\"Go and be somewhere cooler. I am quite content. I have a chair and a grievance.\"" },
    { time: 2 }
  ]
});

scene("isle_ashton", {
  steps: [
    { when: (s)=>!!s.flags["isle_ashton_done"], jump: "again" },
    { when: (s)=>!s.flags["met_ashton"], text: "On the lawn by the Trial Domes the Spectral first-years are waiting to be called. A tall boy with violet hair swept into a smooth dome is walking a short line up and down the grass as if it were a drawing room, a rose in his lapel, squaring a deck in his hands, and squaring it again." },
    { when: (s)=>!!s.flags["met_ashton"], text: "On the lawn by the Trial Domes the Spectral first-years are waiting to be called. Ashton is walking a short line up and down the grass as if it were a drawing room, a rose in his lapel, squaring a deck in his hands, and squaring it again." },
    { when: (s)=>!!s.flags["met_ashton"], say: "ashton", text: "\"Vance! Rescue me. They are calling the Tower in alphabetical order, and Beaumont comes distressingly early.\"" },
    { when: (s)=>!s.flags["met_ashton"], say: "ashton", alias: "Boy with a rose", text: "\"Vance! The Wildcard. I was at the roll call, and I listen for the interesting names. Ashton Beaumont-Lyle. You'll know the name. If you don't, nobody does.\"" },
    { when: (s)=>!s.flags["met_ashton"], say: "ashton", alias: "Boy with a rose", text: "\"I am waiting for my placement duel. They are calling the Tower in alphabetical order, and Beaumont comes distressingly early.\"" },
    MET("ashton", "Ashton Beaumont-Lyle"),
    { when: (s)=>!s.flags["met_jessica"], text: "His eyes go, for less than a second, to a folding chair twenty yards away, where a girl with golden curls sits with a leather casket on her knee and watches the domes." },
    { when: (s)=>!!s.flags["met_jessica"], text: "His eyes go, for less than a second, to a folding chair twenty yards away, where Jessica sits with a leather casket on her knee and watches the domes." },
    { say: "ashton", text: "\"I am about to be observed by two examiners, a loudspeaker, and an expert witness. I have played hundreds of people and never minded being looked at by one of them.\"" },
    { choice: [
      { text: "\"You're nervous.\"", steps: [
        { say: "rowan", text: "\"You're nervous.\"" },
        { say: "ashton", text: "\"I am *prepared*. It presents similarly.\"" },
        { say: "ashton", text: "\"…Yes.\" He squares the deck again. \"Don't tell the lawn.\"" },
        AFF("ashton", 1, "Said it plainly")
      ] },
      { text: "\"Play it as if she weren't there.\"", steps: [
        { say: "rowan", text: "\"Play it as if she weren't there.\"" },
        { say: "ashton", text: "\"My dear Vance, I have never done anything as if she weren't there. I should have to learn a whole new way of standing.\"" }
      ] },
      { text: "\"Did you ever finish that sentence? The one with no rose in it.\"", hint: "From the ferry", when: (s)=>!!s.flags["ashton_advised"], steps: [
        { say: "rowan", text: "\"Did you ever finish that sentence? The one with no rose in it.\"" },
        { say: "ashton", text: "\"I have it. Eleven words and not a flower among them. I am saving it for after the duel, in case I need to have won first.\"" },
        { text: "He hears that, and winces." },
        { say: "ashton", text: "\"…Which is precisely the fault you diagnosed on the boat. How tiresome of you to be right at a distance.\"" },
        AFF("ashton", 2, "Remembered the sentence"),
        NOTE("ashton", "Has written Jessica a sentence of eleven words with no rose in it, and has not yet said it.")
      ] }
    ] },
    { when: (s)=>!s.flags["placement_done"], say: "ashton", text: "\"The Commons go at half past one, don't they. A word of advice from a man who talks too much: look at the cards, not the faces. The faces will keep.\"" },
    { when: (s)=>!!s.flags["placement_won"], say: "ashton", text: "\"I hear you won yours. Of course you did. I shall want it turn by turn, at supper time, with the hesitations left in.\"" },
    { when: (s)=>!!s.flags["placement_done"] && !s.flags["placement_won"], say: "ashton", text: "\"I hear yours went against you. It will have been the room, not the cards. Rooms pass, Vance. I have lost in some excellent ones.\"" },
    { say: "ashton", text: "\"Now go away, before I start performing for you instead of worrying properly. If I lose, I was unwell. If I win, do mention that you saw it.\"" },
    { flag: "isle_ashton_done" },
    { time: 5 },
    { end: true },
    { label: "again" },
    { text: "He is still walking his line on the grass. The rose in his lapel has been straightened to within an inch of its life." },
    { say: "ashton", text: "\"Still not called. I have squared this deck forty times, Vance. It is becoming round.\"" },
    { time: 2 }
  ]
});

scene("isle_victoria", {
  steps: [
    { when: (s)=>!!s.flags["isle_victoria_done"], jump: "again" },
    { when: (s)=>!!s.flags["met_victoria"], flag: "isle_victoria_knew" },
    { text: "At the edge of the Quad, where a tree puts a patch of shade over one bench, a girl in a ruffled dress is sitting very straight under a lace parasol. Pale-gold ringlets, ribbons, wide sky-blue eyes resting on the fountain. A small card lies in her lap, squared to her knee." },
    { when: (s)=>!!s.flags["met_victoria"], say: "victoria", text: "\"Rowan. I have a card now.\"" },
    { when: (s)=>!s.flags["met_victoria"], say: "victoria", alias: "Girl with a parasol", text: "\"You are Rowan Vance. Your name was read out on the Quad. I am Victoria Capulet. Mine was read out as well, so we are even.\"" },
    { when: (s)=>!s.flags["met_victoria"], say: "victoria", alias: "Girl with a parasol", text: "\"You may sit. I answer one thing at a time. I have a card.\"" },
    MET("victoria", "Victoria Capulet"),
    { text: "She turns it so that you can read it. A quick, round hand has written out the afternoon in ink: ROOM. BENCH (the one in the shade). LUNCH — I'll fetch you. BENCH again, if you like. 6:00 SUPPER. At the bottom, underlined: P. writes tomorrow's tonight." },
    { say: "victoria", text: "\"My room-mate wrote it. Miss Lund. It says where I am at each hour until supper. At present it says that I am on a bench. I am on a bench. It is a very accurate card.\"" },
    { when: (s)=>!!s.flags["victoria_said_sister"], say: "victoria", text: "\"You will remember that the part after the pier was blank. It is not blank now.\"" },
    { choice: [
      { text: "\"Did you choose the bench, or did she?\"", steps: [
        { say: "rowan", text: "\"Did you choose the bench, or did she?\"" },
        { say: "victoria", text: "\"She asked what I should like on it. People ask me what I need. Nobody had asked what I should like on a card.\"" },
        { say: "victoria", text: "\"I said a bench, in the shade. And there was one. I have been thinking about that ever since I sat down.\"" },
        AFF("victoria", 2, "Asked what she chose"),
        NOTE("victoria", "Her room-mate writes her day on a card, and asked what she would like on it. She chose a bench in the shade.")
      ] },
      { text: "\"What happens when the card runs out?\"", steps: [
        { say: "rowan", text: "\"What happens when the card runs out?\"" },
        { say: "victoria", text: "\"It does not. The last line says that there will be another. That is the best line on it.\"" },
        { say: "victoria", text: "\"I read that one first, and then I began at the top.\"" },
        AFF("victoria", 1, "Asked the right worry"),
        NOTE("victoria", "Her room-mate writes her day on a card. The best line on it is the one that promises tomorrow's.")
      ] },
      { text: "\"Is it as good as the bench on the ferry?\"", hint: "From the ferry", when: (s)=>!!s.flags["isle_victoria_knew"], steps: [
        { say: "rowan", text: "\"Is it as good as the bench on the ferry?\"" },
        { when: (s)=>!!s.flags["chat_victoria_1"], say: "victoria", text: "\"It does not move, and there is no wake. But the fountain decides things as well, if one watches the very top of it.\"" },
        { when: (s)=>!s.flags["chat_victoria_1"], say: "victoria", text: "\"It does not move, and there is no wake. But the fountain goes up, and at the very top it changes its mind. I watch that part.\"" },
        { when: (s)=>!!s.flags["victoria_plain"] || !!s.flags["victoria_sat"], say: "victoria", text: "\"I am content.\" She considers the word, and keeps it. \"The left side is free here too.\"" },
        { when: (s)=>!(!!s.flags["victoria_plain"] || !!s.flags["victoria_sat"]), say: "victoria", text: "\"I am content.\" She considers the word, and keeps it. \"There is room on it, if you wish.\"" },
        AFF("victoria", 1, "Remembered her bench")
      ] }
    ] },
    { text: "The sky-blue eyes come round to you, slowly, and stay." },
    { when: (s)=>!s.flags["placement_done"], say: "victoria", text: "\"You look as people look when they are waiting for the next thing. Do you know what it is?\"" },
    { when: (s)=>!s.flags["placement_done"], say: "rowan", text: "\"A placement duel. Half past one, in the domes.\"" },
    { when: (s)=>!s.flags["placement_done"], say: "victoria", text: "\"Then you have a time and a place. That is a card, even if nobody wrote it down. You will do better than you look.\"" },
    { when: (s)=>!!s.flags["placement_won"], say: "victoria", text: "\"You have had your duel. You look as though it has been put away in the right drawer.\"" },
    { when: (s)=>!!s.flags["placement_done"] && !s.flags["placement_won"], say: "victoria", text: "\"You have had your duel. Something in it did not sit properly. I shall not ask. You may say, if you wish, and I shall listen to all of it.\"" },
    { flag: "isle_victoria_done" },
    { time: 5 },
    { end: true },
    { label: "again" },
    { say: "victoria", text: "\"Rowan.\"" },
    { text: "She glances at the card, and then at the bench, and finds that they still agree." },
    { say: "victoria", text: "\"It is still a bench, and I am still on it. You may sit, or you may go. Neither is on the card, so both are allowed.\"" },
    { time: 2 }
  ]
});

scene("isle_cas", {
  steps: [
    { when: (s)=>!!s.flags["isle_cas_done"], jump: "again" },
    { text: "On the rim of the fountain in the middle of the Quad sits a boy in a long striped scarf, black jacket, blue collar, with a small microphone clipped to his lapel and one open hand offering the whole square to an invisible colleague." },
    { text: "First-years cross and re-cross with boxes. He has a word for each of them." },
    { when: (s)=>!!s.flags["met_cas"], say: "cas", text: "\"And crossing the Quad now, a familiar face from the stern deck. The Wildcard, making good way.\"" },
    { when: (s)=>!s.flags["met_cas"], say: "cas", alias: "Boy with a microphone", text: "\"And crossing to the fountain now, Rowan Vance, the Wildcard, the name in ink at the roll call. He's coming straight for the commentary position, which we don't often see.\"" },
    { when: (s)=>!s.flags["met_cas"], say: "cas", alias: "Boy with a microphone", text: "\"Caspian Abernathy. Cas, off air. Auxiliary track, Rare Hall. The microphone isn't plugged into anything; I'll save you asking.\"" },
    MET("cas", "Caspian \"Cas\" Abernathy"),
    { say: "cas", text: "\"It's been a lively first afternoon here on the Quad. We've had a trunk go down the Rare Hall steps unaccompanied, we've had a gentleman bow to the wrong statue, and the fountain, I'm told, is in the form of its life.\"" },
    { when: (s)=>!!s.flags["chat_cas_3"], say: "cas", text: "\"And an update for you: Okonjo, R. has been found. He was the catering. He has unpacked forty jars of spice and one shirt, and I have described every jar.\"" },
    { when: (s)=>!s.flags["chat_cas_3"], say: "cas", text: "\"My room-mate, meanwhile, has unpacked forty jars of spice and one shirt. I've been describing it from the doorway. He has started holding the jars up to the light for me.\"" },
    { choice: [
      { text: "\"And he doesn't mind? The describing?\"", steps: [
        { say: "rowan", text: "\"And he doesn't mind? The describing?\"" },
        { text: "The open hand comes down onto his knee. The next part is slower." },
        { say: "cas", text: "\"I asked him. Properly, I mean. Without the voice. It took me a minute.\"" },
        { say: "cas", text: "\"He said, 'You talk, I cook, we'll see who gets tired.'\" A breath, and the baritone is back. \"The box is cautiously delighted.\"" },
        AFF("cas", 2, "Asked how it really went"),
        NOTE("cas", "Asked his room-mate, without the broadcast voice, whether he minded the commentary. He does not.")
      ] },
      { text: "\"Do you ever have to play one instead of calling it?\"", steps: [
        { say: "rowan", text: "\"Do you ever have to play one instead of calling it?\"" },
        { say: "cas", text: "\"A probing question from the guest. Yes. Placement duel, later this afternoon. And they've asked me to take the microphone off for it.\"" },
        { text: "His fingers go to the lapel and rest on the clip." },
        { say: "cas", text: "\"I don't… play quiet, much. We'll see how he gets on.\"" },
        { say: "rowan", text: "\"Call it for me afterwards. I'll listen.\"" },
        { say: "cas", text: "\"…That's a booking. Thank you.\"" },
        AFF("cas", 2, "Booked the replay"),
        { flag: "isle_cas_booked" },
        NOTE("cas", "Has to play his placement duel without the microphone, and is not looking forward to the quiet.")
      ] },
      { text: "\"What's the line on the Wildcard?\"", steps: [
        { say: "rowan", text: "\"What's the line on the Wildcard?\"" },
        { when: (s)=>!s.flags["placement_done"], say: "cas", text: "\"The Wildcard goes at half past one with the Commons. No form to go on, on a real table. The box is quietly optimistic, and the box has been wrong today already, so take it kindly.\"" },
        { when: (s)=>!!s.flags["placement_won"], say: "cas", text: "\"Won his placement, I'm told. The box called it at the fountain an hour ago, to nobody, and intends to be insufferable about it.\"" },
        { when: (s)=>!!s.flags["placement_done"] && !s.flags["placement_won"], say: "cas", text: "\"Dropped his placement, I'm told. It happens to good players on a first table. The box has seen the type before and isn't worried, and nor should he be.\"" },
        AFF("cas", 1, "Asked for his call")
      ] }
    ] },
    { say: "cas", text: "\"And we go back to the fountain. Lovely pictures. Mind the gentleman with the trunk; he's coming round again.\"" },
    { flag: "isle_cas_done" },
    { time: 5 },
    { end: true },
    { label: "again" },
    { say: "cas", text: "\"And a second visit from the Wildcard. I can report that the fountain is unchanged. I'm told that's what it's for.\"" },
    { when: (s)=>!!s.flags["isle_cas_booked"], say: "cas", text: "\"The booking stands, by the way. I've written it on my hand.\"" },
    { time: 2 }
  ]
});
