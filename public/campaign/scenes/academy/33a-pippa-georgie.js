// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS, ALPHA } = helpers;
scene("ferry_pippa_georgie", {
  steps: [
    // Gemeinsame erste Begegnung mit Pippa und Georgie (stehen nebeneinander auf dem Vordeck).
    // Aufruf aus ferry_pippa (Flag pg_from_pippa gesetzt) oder ferry_georgie (Flag gelöscht). Setzt pg_met.
    { when: (s)=>!!s.flags["pg_from_pippa"], jump: "from_pippa" },

    // ---- Rowan geht auf das Mädchen auf dem Tau zu ----
    { text: "She is sitting on a coil of rope with a deck box held in both hands, in a red jacket at least one size too big, its cuffs turned back twice. A dark-purple feather is pinned in her wild black hair. A green plush dragon hangs from her backpack by one wing." },
    { text: "A girl with a heavy old film camera is orbiting her with great concentration: freckles, a yellow bow tie, strawberry-orange hair sticking up at the crown. There is a grey sock on the end of her lens, which she pulls off for each shot." },
    { say: "pippa", alias: "Girl with a camera", text: "\"Chin up. No — down. Feather to the light. Now look at the volcano like it owes you money.\"" },
    PHOTO("georgie_rope", "Georgie on the rope coil, feather to the light, looking at the volcano", { who: ["georgie"] }),
    { text: "The girl on the rope looks at the volcano. It does not owe her money. Her face says so. There is something curiously still about her: not calm, but the stillness of a small animal that has learned that moving is what gets you noticed." },
    { text: "She notices you looking, and goes the colour of a tomato." },
    { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"Sorry. Was I — is this your rope?\"" },
    { choice: [
      { text: "\"It's the ship's rope. I think that makes it anybody's. I'm Rowan.\"", steps: [
        { say: "rowan", text: "\"It's the ship's rope. I think that makes it anybody's. I'm Rowan.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"Oh. Okay.\" A pause. \"I did ask a sailor. He said it's been lying there longer than he has.\"" },
        { say: "pippa", alias: "Girl with a camera", text: "\"She asked a *sailor*. For permission. To sit on a *rope*.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"Georgie.\" She says it to you, quickly, as if to get it in before anybody else can. \"Santa. Georgie Santa.\"" }
      ] },
      { text: "\"I wasn't looking at the rope. You're holding that deck box as if it were full of eggs. I'm Rowan.\"", steps: [
        { say: "rowan", text: "\"I wasn't looking at the rope. You're holding that deck box as if it were full of eggs. I'm Rowan.\"" },
        { text: "She goes perfectly still. Stiller than before, which you would not have thought possible." },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"…How did you know?\"" },
        { say: "rowan", text: "\"Know what?\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"Nothing. It's fine.\" She loosens her grip on the box by about one finger. \"Georgie. Georgie Santa.\"" },
        { flag: "georgie_egg_slip" }
      ] },
      { text: "\"Sit wherever you like. I spent the night on a bench, I don't own anything on this ship. I'm Rowan.\"", steps: [
        { say: "rowan", text: "\"Sit wherever you like. I spent the night on a bench, I don't own anything on this ship. I'm Rowan.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"The bench under the lifeboat?\" Very small. \"I saw. I walked quietly.\"" },
        { say: "rowan", text: "\"Then thank you. It worked.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"Georgie.\" She says it to the deck box. \"Santa. Georgie Santa.\"" },
        AFF("georgie", 1, "Said thank you")
      ] }
    ] },
    MET("georgie", "Georgie Santa"),
    { say: "pippa", alias: "Girl with a camera", text: "\"The camera comes down, and its owner gives you a look of frank assessment, one eye half shut, as though weighing you for a composition. 'Pippa Lund. I'm the photographer. Nobody asked me to be; I just got here first.'\"" },
    MET("pippa", "Pippa Lund"),
    { say: "pippa", text: "\"She's fourteen, you know.\" Quite gently. \"She's allowed to sit on the rope. I've told her. She doesn't believe me.\"" },
    { jump: "both" },

    // ---- Rowan geht auf das Mädchen mit der Kamera zu ----
    { label: "from_pippa" },
    { text: "A girl with a heavy old film camera is crouched on the planks at a very odd angle, like a heron deciding about a fish." },
    { text: "Strawberry-orange hair sticks up at the crown; there is a yellow bow tie under her chin, freckles on every visible surface and a grey sock dangling from the end of her lens." },
    { text: "Her fish is a small girl on a coil of rope: a red jacket at least one size too big, cuffs turned back twice, a deck box held in both hands, a dark-purple feather in wild black hair. A green plush dragon hangs from her backpack by one wing." },
    { say: "pippa", alias: "Girl with a camera", text: "\"Feather to the light. Now look at the volcano like it owes you money. No — like it owes you *a lot* of money.\"" },
    PHOTO("georgie_rope", "Georgie on the rope coil, feather to the light, looking at the volcano", { who: ["georgie"] }),
    { text: "The girl on the rope tries. The volcano remains in credit. Then, without getting up, the photographer swings the lens round to you." },
    { say: "pippa", alias: "Girl with a camera", text: "\"Hang on — don't move —\" Click. \"Sorry. You were looking at the island with your hand flat on your pocket, like you were checking it was still there. That's the shot. I got it.\"" },
    PHOTO("rowan_pocket", "Rowan looking at the island, hand flat on his pocket", { who: ["rowan"] }),
    { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"She says that to me.\" Very small, from the rope. \"'I got it.' And then she does ten more.\"" },
    { choice: [
      { text: "\"What shot? Nobody told me I was being photographed.\"", steps: [
        { say: "rowan", text: "\"What shot? Nobody told me I was being photographed.\"" },
        { say: "pippa", alias: "Girl with a camera", text: "\"Nobody ever is told. That's when it's any good.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"She told me.\"" },
        { say: "pippa", alias: "Girl with a camera", text: "\"And look how that's going. Half an hour of you being *brave* at me.\"" }
      ] },
      { text: "\"Do I get to see it, at least?\"", steps: [
        { say: "rowan", text: "\"Do I get to see it, at least?\"" },
        { say: "pippa", alias: "Girl with a camera", text: "\"Later! It's film. I'll develop it in a week. You'll hate it. It'll be perfect.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"She said that to me as well.\" To the deck box. \"I still don't know how it can be both.\"" },
        { say: "pippa", alias: "Girl with a camera", text: "\"Because they're the same thing.\"" }
      ] },
      { text: "Hold the pose a moment longer, in case she needs another.", steps: [
        { text: "You stay as you are, hand on your pocket, feeling like a statue of a man who has lost his keys." },
        { say: "pippa", alias: "Girl with a camera", text: "\"…Oh, you're *kind*. No, it's gone, you can breathe. It never works twice. The second one always knows it's being looked at.\"" },
        { say: "georgie", alias: "Girl with the dark-purple feather", text: "\"…That's why all mine are bad.\"" },
        AFF("pippa", 1, "Held still for her")
      ] }
    ] },
    { say: "pippa", alias: "Girl with a camera", text: "She stands, lets the camera drop on its strap and looks at you without a lens in the way, one eye still half shut out of habit. \"Pippa Lund. I'm the photographer. Nobody asked me to be; I just got here first.\"" },
    MET("pippa", "Pippa Lund"),
    { say: "rowan", text: "\"Rowan.\"" },
    { say: "pippa", text: "\"And that's Georgie Santa. She's fourteen.\" Quite gently. \"She's allowed to sit on the rope. I've told her. She doesn't believe me.\"" },
    MET("georgie", "Georgie Santa"),

    // ---- gemeinsam ----
    { label: "both" },
    { flag: "pg_met" },
    { unflag: "pg_from_pippa" },
    { add: { ferry_talked: 2 } },
    NOTE("georgie", "Very small, very shy. Holds her deck box in both hands."),
    NOTE("pippa", "The photographer. Has been photographing Georgie on the rope coil."),
    REL("pippa", "georgie"),
    { say: "georgie", text: "\"…Pippa.\"" },
    { say: "pippa", text: "\"I'm only saying.\"" },
    { choice: [
      { text: "\"Fourteen, and on this ship. You must be very good.\"", steps: [
        { say: "rowan", text: "\"Fourteen, and on this ship. You must be very good.\"" },
        { say: "georgie", text: "\"I'm — it's fine.\" A breath. Then, as if reading it off a card: \"I won the under-sixteens. Twice.\" She looks at her knees. \"You did ask. People usually stop talking normally after that part.\"" },
        { flag: "georgie_said_titles" },
        { say: "pippa", text: "\"I didn't stop.\"" },
        { say: "georgie", text: "\"You never started.\"" },
        { text: "Pippa laughs out loud, delighted, as if a shy animal had just bitten her and she had been hoping it would." },
        AFF("georgie", 1, "Didn't go strange")
      ] },
      { text: "\"Does she always tell people how old you are?\"", steps: [
        { say: "rowan", text: "\"Does she always tell people how old you are?\"" },
        { say: "georgie", text: "\"I don't know. I only met her at the harbour. She asked if she could take my picture, and then she just — stayed.\"" },
        { say: "pippa", text: "\"I'm standing *right here*.\"" },
        { say: "georgie", text: "\"I know.\" A small pause. \"It's nice. I think it's nice. I don't know what you're supposed to do back.\"" },
        { say: "pippa", text: "\"For once she has nothing ready. Then: 'You hold still. That's what you do back. You're very good at it.'\"" },
        { flag: "pg_harbour" },
        AFF("georgie", 1, "Asked me, not her"),
        AFF("pippa", 1, "Let her answer")
      ] },
      { text: "Sit down on the other end of the rope.", steps: [
        { text: "You sit down on the far end of the coil. It is damp, and harder than it looks. The girl on the other end stares at you as if you had walked through a wall." },
        { say: "georgie", text: "\"…Oh. You can. It's — it's anybody's.\"" },
        { say: "pippa", text: "\"Click. She is already back behind the lens. '*That's* the one. Two people on a rope, neither of them sure they're allowed.'\"" },
        PHOTO("rope_two", "Two people on a rope, neither of them sure they're allowed: Rowan and Georgie", { who: ["rowan", "georgie"] }),
        { flag: "pg_sat" },
        AFF("georgie", 2, "Sat down too")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is that a DRAGON? On her BAG? Baylee, she's got a DRAGON on her bag!\"" },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "baylee", text: "\"It's a plush. Bring it down a bit, Nathan.\"" },
    { when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"], say: "pippa", text: "\"I've had you two already. On the stairs, ten minutes ago. One of you was pointing at a gull and one of you wasn't.\"" },
    { ...PHOTO("stairs_nathan_baylee", "Nathan and Baylee on the stairs, one pointing at a gull and one not", { who: ["nathan", "baylee"], off: true }), when: (s)=>!!s.flags["follow_nathan"]&&!!s.flags["follow_baylee"] },

    // ---- Mischen: Georgie wird scharf ----
    { say: "pippa", text: "\"Right. Hands. Georgie, shuffle for me. Just the hands; I won't put your face in.\"" },
    { text: "Georgie looks at the deck box as if it had been asked to dance. Then she opens it, sets the plush dragon on the rope at her elbow, facing the cards, and the moment the deck is in her hands the hunch goes out of her shoulders." },
    { text: "The shuffle is small, quick and exact. The cards go through each other with a sound like a bird settling." },
    { say: "pippa", text: "\"Slower! It's all blur, I can't —\"" },
    PHOTO("georgie_hands", "Georgie's hands shuffling, eight riffles, Ember at her elbow (no face)", { who: ["georgie"] }),
    { say: "georgie", text: "\"Slower clumps.\" Clipped, flat, nothing in it but fact. \"Eight riffles. Seven is for fifty-two cards; mine has more. Fewer and it isn't shuffled. It's a pattern you haven't found yet.\"" },
    { say: "georgie", text: "She squares the deck with one tap and looks up, straight at you, for the first time. \"You've got a deck in that pocket. You keep touching it. Do you do eight?\"" },
    { choice: [
      { text: "\"I've never shuffled for a real game in my life. Online, the computer does it.\"", steps: [
        { say: "rowan", text: "\"I've never shuffled for a real game in my life. Online, the computer does it.\"" },
        { say: "georgie", text: "\"…Never?\" It is not scorn. It is interest. \"Then how did you —\" She stops. \"That's a rude question.\"" },
        { say: "rowan", text: "\"Online. All of it.\"" },
        { say: "georgie", text: "\"Oh. Then you've played more games than me, probably. You just haven't done the hands part.\"" },
        { flag: "georgie_knows_online" },
        AFF("georgie", 2, "Told her something true")
      ] },
      { text: "\"I do three and hope.\"", steps: [
        { say: "rowan", text: "\"I do three and hope.\"" },
        { say: "georgie", text: "\"Three is —\"" },
        { text: "The clipped voice gets that far, and then she hears it. The colour comes up from her collar." },
        { say: "pippa", text: "\"No, go on. Tell him three's a crime.\"" },
        { say: "georgie", text: "\"…It's a bit of a crime.\" Very small. \"Sorry. It's your deck.\"" },
        AFF("georgie", 1, "Let her be right")
      ] },
      { text: "\"Did you get that?\" Ask Pippa, not her.", steps: [
        { say: "rowan", text: "\"Did you get that?\"" },
        { say: "pippa", text: "\"Every frame.\" She says it quietly, for once. \"She's two people, did you know? The one on the rope, and the one with the cards. I've been trying to get the second one for half an hour.\"" },
        PHOTO("georgie_hands", "Georgie's hands shuffling, eight riffles, Ember at her elbow (no face)", { who: ["georgie"] }),
        { say: "georgie", text: "\"I'm not two people.\"" },
        { say: "pippa", text: "\"You're two people, and one of them is terrifying.\"" },
        { say: "georgie", text: "\"…She means it nicely.\" To the dragon, not to you." },
        { flag: "pg_two_people" },
        AFF("pippa", 2, "Asked about the shot")
      ] }
    ] },

    // ---- Bildunterschrift ----
    { text: "The cards go back into the box, and the small animal is back on the rope. Somewhere in all that, the camera has clicked. Pippa takes a pencil stub from behind her ear and writes on a strip of tape along its back." },
    PHOTO("rowan_frame_eleven", "Frame thirty-four: Rowan, rope, pocket", { who: ["rowan"] }),
    { say: "pippa", text: "\"Frame thirty-four. Rowan, rope, pocket.\" She blows on the pencil, which cannot need it. \"I'm doing everybody before we dock. Thirty-eight faces, before anyone's learned which face to make here. On film, so one go at every second, and no deleting.\"" },
    { say: "georgie", text: "\"If it's bad, you just have to be sorry about it afterwards.\" She says it like a quotation." },
    { say: "pippa", text: "\"She *listens*. Nobody warned me she listens.\"" },
    { flag: "pippa_film" },
    NOTE("pippa", "Shoots on film: one go at every second, no deleting."),
    { when: (s)=>!!s.flags["found_lenscap"]&&!s.flags["lenscap_returned"], think: "The grey sock on her lens. And in your pocket, a black lens cap with LUND P. scratched inside it." },
    { when: (s)=>!!s.flags["found_lenscap"]&&!s.flags["lenscap_returned"], scene: "pippa_lenscap" },
    { when: (s)=>!!s.flags["ship_knows_wildcard"], jump: "known" },
    { say: "pippa", text: "\"Rowan what, though? For the caption.\"" },
    { choice: [
      { text: "\"Vance. Rowan Vance.\"", steps: [
        { say: "rowan", text: "\"Vance. Rowan Vance.\"" },
        { say: "pippa", text: "\"Vance.\" The pencil stops in the air. \"There's a passenger list on the wheelhouse door; I've been reading it for names. One of them is added in ink. 'Vance, R. — Wildcard.' I think I've just found him.\"" },
        { say: "rowan", text: "\"…You may have.\"" },
        { say: "pippa", text: "\"Don't look like that. I take pictures, I don't develop them out loud.\"" },
        { flag: "told_wildcard" },
        { flag: "pg_wild" },
        AFF("pippa", 1, "Offered his name")
      ] },
      { text: "\"Just Rowan will do for a caption.\"", steps: [
        { say: "rowan", text: "\"Just Rowan will do for a caption.\"" },
        { say: "pippa", text: "\"Mysterious. Fine. 'Rowan, no jacket, no surname.'\"" },
        { say: "georgie", text: "\"That's a good caption.\"" },
        { say: "pippa", text: "\"It's a *great* caption. I'm wasted on this boat.\"" }
      ] }
    ] },
    { jump: "wild" },
    { label: "known" },
    { flag: "pg_wild" },
    { say: "pippa", text: "\"And you're Vance, aren't you? The name in ink on the list by the wheelhouse door. It's gone round the whole foredeck. With gestures.\"" },
    { say: "rowan", text: "\"Is everyone going to say that?\"" },
    { say: "pippa", text: "\"Probably. Hope not. Might be sort of nice, though. Nobody on this boat is guessing about *me*.\"" },
    { label: "wild" },
    { when: (s)=>!!s.flags["pg_wild"], say: "georgie", text: "\"…The Wildcard is the last seat.\" Barely audible. \"It's the hardest one to get.\"" },
    { when: (s)=>!!s.flags["pg_wild"], say: "pippa", text: "\"That's her impressed face. It's very hard to photograph.\"" },

    // ---- Abschluss ----
    { say: "pippa", text: "\"A gull goes over low, and the camera goes after it, and so, for a step or two, does Pippa. 'Go on, you two. Talk cards. She goes all sharp; it's the best light she's got.'\"" },
    PHOTO("gull_low", "A gull going over the foredeck, low", { who: [] }),
    { choice: [
      { text: "\"Would you like a game, Georgie? Nothing riding on it, just for fun.\"", steps: [
        { say: "rowan", text: "\"Would you like a game, Georgie? Nothing riding on it, just for fun.\"" },
        { say: "georgie", text: "\"…Yes.\" It is almost inaudible. Then, braver: \"Yes. Please. Not for anything. I'm not allowed to play for anything. But yes.\"" },
        { flag: "georgie_game_asked" },
        { flag: "georgie_wants_game_now" },
        AFF("georgie", 2, "Asked for a game")
      ] },
      { text: "\"It was good to meet you both. I'll leave you to the volcano.\"", steps: [
        { say: "rowan", text: "\"It was good to meet you both. I'll leave you to the volcano.\"" },
        { say: "georgie", text: "\"Good to — yes. You too. Sorry.\"" },
        { say: "pippa", text: "\"She means 'bye'. We're working on it.\"" }
      ] }
    ] },
    { time: 10 }
  ]
});

scene("pippa_lenscap", {
  steps: [
    { when: (s)=>!s.flags["found_lenscap"]||!!s.flags["lenscap_returned"], end: true },
    { choice: [
      { text: "Give Pippa the lens cap you found.", steps: [
        { text: "You hold out the black lens cap from the stern, the one with LUND P. scratched inside it." },
        { say: "pippa", text: "\"My — oh, my CAP! It was in the — I have been using Georgie's *sock*!\"" },
        { text: "She presses it to her chest, then, quickly, onto the lens. The sock goes back to Georgie, who folds it very small and puts it in her pocket." },
        { say: "pippa", text: "\"Click. Home. Where did you — never mind, don't tell me, I'll want it to be a mystery. You get a photograph. A good one. I'll have it by the end of the week.\"" },
        { item: "Pippa's lens cap", n: -1 },
        { flag: "lenscap_returned" },
        { flag: "pippa_photo_promised" },
        { coins: 5 },
        AFF("pippa", 4, "Returned her lens cap")
      ] },
      { text: "Keep it a little longer." }
    ] }
  ]
});

scene("ferry_pippa", {
  steps: [
    { when: (s)=>!s.flags["pg_met"], flag: "pg_from_pippa", scene: "ferry_pippa_georgie", jump: "after_joint" },
    { jump: "again" },
    { label: "after_joint" },
    { when: (s)=>!!s.flags["georgie_wants_game_now"], scene: "georgie_game" },
    { end: true },
    { label: "again" },
    { text: "Pippa has wedged herself between two lifeboat chocks, a yard from Georgie's rope, and is changing a roll of film inside her jacket, by feel, with her eyes on the sky." },
    { say: "pippa", text: "\"Rowan! Four seconds. If the light gets in, I lose the whole foredeck.\"" },
    { text: "Something clicks shut inside the jacket. Her hands come out with a little grey canister, which she licks, labels and drops into her bag." },
    { say: "pippa", text: "\"There. Everybody's safe. You can come closer now.\"" },
    { when: (s)=>!s.flags["pippa_again_seen"], say: "georgie", text: "\"She says that to everybody.\" From the rope. \"Even people who are already close.\"" },
    { flag: "pippa_again_seen" },
    { time: 4 },
    { scene: "pippa_lenscap" },
    { choice: [
      { text: "\"Have you got a minute, between frames?\"", when: (s)=>!s.flags["chat_pippa_done"], steps: [
        { say: "rowan", text: "\"Have you got a minute, between frames?\"" },
        { say: "pippa", text: "\"I've got a whole roll. Go on.\"" },
        { scene: "chat_pippa" }
      ] },
      { text: "\"Is Georgie up for that game yet?\"", when: (s)=>!s.flags["flag_georgie_played"], steps: [
        { say: "rowan", text: "\"Is Georgie up for that game yet?\"" },
        { say: "pippa", text: "\"Ask her, she's right there. She's been looking at your pocket since you came up the deck.\"" },
        { say: "georgie", text: "\"I have *not*.\" A beat. \"…Yes. Please.\"" },
        { flag: "georgie_game_asked" },
        { flag: "georgie_wants_game_now" }
      ] },
      { text: "Leave her to the light.", steps: [
        { text: "She is already squinting past you at something only she can see. You leave her to it." }
      ] }
    ] },
    { when: (s)=>!!s.flags["georgie_wants_game_now"], scene: "georgie_game" }
  ]
});

scene("ferry_georgie", {
  steps: [
    { when: (s)=>!s.flags["pg_met"], unflag: "pg_from_pippa", scene: "ferry_pippa_georgie", jump: "after_joint" },
    { jump: "again" },
    { label: "after_joint" },
    { when: (s)=>!!s.flags["georgie_wants_game_now"], scene: "georgie_game" },
    { end: true },
    { label: "again" },
    { text: "Georgie is on her coil of rope with the deck box in both hands. A yard away, Pippa is photographing a bollard with great seriousness. When Georgie sees you she lifts one hand off the box, about an inch. It is a wave." },
    PHOTO("bollard", "A bollard, taken with great seriousness", { who: [] }),
    { say: "georgie", text: "\"Hi, Rowan.\"" },
    { when: (s)=>!!s.flags["georgie_game_later"]&&!s.flags["flag_georgie_played"], say: "georgie", text: "\"You said later. It's fine if it isn't later yet.\"" },
    { when: (s)=>!!s.flags["flag_georgie_played"]&&!s.flags["georgie_again_played"], text: "The plush dragon is back on her backpack. She has turned it so that it faces the patch of deck where you played." },
    { when: (s)=>!!s.flags["flag_georgie_played"], flag: "georgie_again_played" },
    { choice: [
      { text: "\"I'd like that game now, if you would. Nothing riding on it.\"", when: (s)=>!s.flags["flag_georgie_played"], steps: [
        { say: "rowan", text: "\"I'd like that game now, if you would. Nothing riding on it.\"" },
        { say: "georgie", text: "\"Yes. Please.\"" },
        { flag: "georgie_game_asked" },
        { flag: "georgie_wants_game_now" }
      ] },
      { text: "\"May I sit down? I've got a question or two, if you don't mind.\"", when: (s)=>!s.flags["chat_georgie_done"], steps: [
        { say: "rowan", text: "\"May I sit down? I've got a question or two, if you don't mind.\"" },
        { text: "She moves along the coil to make room, although there was room already. It turns out she has been half sitting on a school workbook." },
        { scene: "chat_georgie" }
      ] },
      { text: "\"I was only saying hello.\"", steps: [
        { say: "rowan", text: "\"I was only saying hello.\"" },
        { say: "georgie", text: "\"Hello.\" A beat. \"That's allowed. I think that's a whole thing people do.\"" },
        { when: (s)=>!s.flags["georgie_hello_pippa"], say: "pippa", text: "\"She's been practising that.\" Without lowering the camera." },
        { when: (s)=>!s.flags["georgie_hello_pippa"], say: "georgie", text: "\"I have not.\" To Rowan, very quietly: \"A bit.\"" },
        { flag: "georgie_hello_pippa" }
      ] }
    ] },
    { time: 4 },
    { when: (s)=>!!s.flags["georgie_wants_game_now"], scene: "georgie_game" }
  ]
});

scene("georgie_game", {
  steps: [
    // Georgies Partie auf dem Vordeck (früher Teil von ferry_georgie, unverändert).
    { unflag: "georgie_wants_game_now" },
    { when: (s)=>!!s.flags["flag_georgie_played"], end: true },
    { text: "You find a flat bit of deck out of the wind. She opens her box with enormous care, as if the cards might wake." },
    { choice: [
      { text: "Play her.", steps: [
        { text: "The moment the first card is in her hand, the hunch goes out of her shoulders. She sets the plush dragon on the planks at her elbow, facing the board." },
        { say: "georgie", text: "\"Shuffle, please. Thoroughly. Then we begin.\"" },
        { text: "You shuffle and lay out your three Heroes. The new cards stick and clump, and one tries to leave altogether. Georgie watches the deck and not your hands, which is somehow kinder." },
        { say: "georgie", text: "\"Nicolas, Tarleinn, Semi. Gold, Potions, Spells.\" Clipped, certain, reading the deck behind the Heroes. \"It's a very sharp list. There's nothing in it that's only there to be pretty.\"" },
        { when: (s)=>!!s.flags["rowan_commons_seen"], say: "rowan", text: "\"Including the frames, I keep hearing.\"" },
        { when: (s)=>!!s.flags["rowan_commons_seen"], say: "georgie", text: "\"…Oh. They're Commons.\" She had not noticed, and looks faintly surprised that anybody would. \"Frames don't count.\"" },
        { when: (s)=>!s.flags["rowan_commons_seen"], say: "georgie", text: "\"They're all Commons, too.\" Not a judgement. A fact, set down on the table like a card. \"Frames don't count.\"" },
        { flag: "rowan_commons_seen" },
        { duel: "ferry_georgie", opponent: "georgie", opponentName: "Georgie Santa", mustWin: false,
          onWin: [
            { text: "Georgie stares at the board for a long time, completely still." },
            { say: "georgie", text: "\"…You didn't attack on turn three. I thought you'd attack on turn three.\" A pause. \"I was really scared you'd notice that I had nothing.\"" },
            { say: "rowan", text: "\"I noticed on turn four.\"" },
            { say: "georgie", text: "\"That's — that's when it stopped working.\" A tiny wondering smile. \"Good game. Really good game.\"" },
            AFF("georgie", 4, "Beat her fairly"),
            { flag: "beat_georgie" }
          ],
          onLose: [
            { say: "georgie", text: "\"In response, I hatch.\" Quietly. Then, very small: \"…That's your last Hero. Good game.\"" },
            { say: "georgie", text: "\"Sorry.\"" },
            { say: "rowan", text: "\"For what?\"" },
            { say: "georgie", text: "\"For winning. I always say it. I can't stop.\"" },
            AFF("georgie", 3, "Played well")
          ] },
        { scene: "post_georgie" },
        { flag: "flag_georgie_played" },
        { time: 25 }
      ] },
      { text: "Tell her you would rather wait.", steps: [
        { say: "rowan", text: "\"Not right now, after all. I'd love a game later, though, if that's all right.\"" },
        { say: "georgie", text: "\"Okay. It's fine.\" She closes the box again, just as carefully. \"Later is fine.\"" },
        { flag: "georgie_game_later" }
      ] }
    ] }
  ]
});

scene("chat_georgie", {
  steps: [
    // Folge-Hub nach der gemeinsamen Szene: Themen wachsen aus dem, was dort gesagt/gesehen wurde.
    { label: "top" },
    { when: (s)=>!!s.flags["chat_georgie_1"]&&!!s.flags["chat_georgie_2"]&&!!s.flags["chat_georgie_3"]&&!!s.flags["chat_georgie_6"]&&!!s.flags["chat_georgie_x"], flag: "chat_georgie_done", say: "georgie", text: "\"Thank you for — for asking things. Normally people ask me about the winning.\" A tiny pause. \"You asked about the feather.\"", end: true },
    { choice: [
      { text: "\"Pippa kept turning you so the feather caught the light. Is there a story to it?\"", when: (s)=>!s.flags["chat_georgie_1"], steps: [
        { say: "rowan", text: "\"Pippa kept turning you so the feather caught the light. Is there a story to it?\"" },
        PHOTO("georgie_rope", "Georgie on the rope coil, feather to the light, looking at the volcano", { who: ["georgie"] }),
        { text: "She touches it, as if to make sure it is still there." },
        { say: "georgie", text: "\"I found it on the steps outside the hall where I played my first big final. Nobody else wanted it, and I thought somebody should.\"" },
        { choice: [
          { text: "\"Did the final go well?\"", steps: [
            { say: "rowan", text: "\"Did the final go well?\"" },
            { say: "georgie", text: "\"…It went fine.\" Barely a whisper, and then, braver: \"It went very well. Sorry. That sounded like boasting.\"" },
            { say: "rowan", text: "\"It sounded like a feather story.\"" }
          ] },
          { text: "\"So it's a lucky feather.\"", steps: [
            { say: "rowan", text: "\"So it's a lucky feather.\"" },
            { say: "georgie", text: "\"No. Luck is variance. I don't wear variance.\"" },
            { text: "It is the voice from the shuffle again, clipped and certain. Then she hears it too, and goes pink." },
            { say: "georgie", text: "\"It's — it's a nice colour. That's all it is.\"" }
          ] }
        ] },
        { say: "georgie", text: "\"I was eleven. My dad couldn't come that day. I wanted to bring him something that had been there.\"" },
        { say: "rowan", text: "\"And he let you keep it.\"" },
        { say: "georgie", text: "\"He said it suited me better. He hasn't got much hair.\"" },
        { say: "pippa", text: "\"*That's* going on the tape.\" From the bollard, without turning round." },
        AFF("georgie", 2, "Asked about the feather"),
        { flag: "chat_georgie_1" },
        NOTE("georgie", "The dark-purple feather came from the steps outside the hall of her first big final, when she was eleven."),
        { time: 3 }
      ] },
      { text: "\"Your hands went dead still the second you had the cards. Mine don't. How do you do that?\"", when: (s)=>!s.flags["chat_georgie_2"], steps: [
        { say: "rowan", text: "\"Your hands went dead still the second you had the cards. Mine don't. How do you do that?\"" },
        { when: (s)=>!s.flags["georgie_knows_online"], say: "georgie", text: "\"Yours shake?\" A flicker of surprise, and then something warmer. \"In front of people?\"" },
        { when: (s)=>!s.flags["georgie_knows_online"], say: "rowan", text: "\"I've never played in front of people. Only online.\"" },
        { when: (s)=>!!s.flags["georgie_knows_online"], say: "georgie", text: "\"The hands part.\" She nods, as if you had asked her the way to the lounge." },
        { say: "georgie", text: "\"Everybody watches the hands. Don't. Watch the cards. The cards are exactly the same as they were at home. They don't know anybody's looking.\"" },
        { choice: [
          { text: "\"That's actually very helpful.\"", steps: [
            { say: "rowan", text: "\"That's actually very helpful.\"" },
            { say: "georgie", text: "\"I've had a lot of practice being frightened.\" A very small smile. \"That wasn't a joke. It was a bit of a joke.\"" }
          ] },
          { text: "\"Do yours still shake?\"", steps: [
            { say: "rowan", text: "\"Do yours still shake?\"" },
            { say: "georgie", text: "\"Before. Not during.\"" },
            { say: "pippa", text: "\"It's true. I've got the before. All the way up the gangway.\"" },
            PHOTO("georgie_gangway", "Georgie coming up the gangway at the harbour, hands shaking before the crossing", { who: ["georgie"], off: true }),
            { say: "georgie", text: "\"You weren't supposed to be looking.\"" },
            { say: "pippa", text: "\"I'm always supposed to be looking.\"" },
            { text: "Georgie holds one hand out flat over the deck box. It is perfectly steady. She studies it as if it belonged to somebody she rather admired." },
            { say: "georgie", text: "\"During, I'm not really there. There's only the board. It's the other bits I can't do. The hello bits.\"" },
            NOTE("georgie", "Her hands shake before a game, never during."),
            { say: "rowan", text: "\"You're doing a hello bit now.\"" },
            { say: "georgie", text: "\"…Oh.\" She takes the hand back and looks at it again. \"I am.\"" }
          ] }
        ] },
        AFF("georgie", 3, "Trusted her with it"),
        { flag: "chat_georgie_2" },
        NOTE("georgie", "Told you to watch the cards, not the hands."),
        { time: 3 }
      ] },
      { text: "\"White and gold on your collar. That's the tower, isn't it?\"", when: (s)=>!s.flags["chat_georgie_6"], steps: [
        { say: "rowan", text: "\"White and gold on your collar. That's the tower, isn't it?\"" },
        { text: "She looks down at her own collar as if somebody had spilled it on her." },
        { say: "georgie", text: "\"The letter says 'suite'. I've never had a suite. I don't know what you do with the other rooms.\"" },
        { choice: [
          { text: "\"Give the dragon one of them.\"", steps: [
            { say: "rowan", text: "\"Give the dragon one of them.\"" },
            { text: "A giggle escapes. She claps a hand over her mouth, too late." },
            { say: "georgie", text: "\"She'd want the one with the window. She's called Ember. She's been to nationals twice.\"" },
            { text: "Pippa, passing, reaches for the plush to tilt it towards the light." },
            { say: "georgie", text: "\"Not by the wing.\"" },
            { text: "It comes out exactly like *slower clumps*. Pippa's hand changes course at once and takes the dragon round the middle, very respectfully." },
            { say: "pippa", text: "\"Sorry, Ember.\"" },
            { flag: "georgie_ember" },
            NOTE("georgie", "Her green dragon plush is called Ember. Do not hold it by the wing."),
            AFF("georgie", 2, "Made her laugh")
          ] },
          { text: "\"That sounds like a lot of doors for one person.\"", steps: [
            { say: "rowan", text: "\"That sounds like a lot of doors for one person.\"" },
            { say: "georgie", text: "\"…It's fine.\" She turns the deck box over once, corner to corner. \"It is quite a lot of doors.\"" },
            { say: "pippa", text: "\"Rare Hall's four minutes from the tower. I've looked at the map.\" Lightly, as though it were about the weather. \"In case anybody's counting doors.\"" },
            AFF("georgie", 1, "Said the true thing")
          ] }
        ] },
        { say: "georgie", text: "\"Which dorm are you?\" A beat. \"Pippa says I'm supposed to ask people things back.\"" },
        { say: "rowan", text: "\"The Commons. Grey collar, once they give me one.\"" },
        { say: "georgie", text: "\"Grey's nice.\" She sounds almost wistful. \"Nobody looks twice at grey.\"" },
        { flag: "chat_georgie_6" },
        NOTE("georgie", "Has a suite in the Spectral Tower to herself, and does not know what to do with all the doors."),
        { time: 3 }
      ] },
      { text: "Ask about the workbook she was half sitting on.", when: (s)=>!s.flags["chat_georgie_3"], steps: [
        { say: "rowan", text: "\"You were sitting on a book. Is it in trouble?\"" },
        { text: "She pulls it out from under her knee. It is a school workbook with a cheerful cartoon croissant on the cover. Somebody has given the croissant a dragon's tail in biro." },
        { say: "georgie", text: "\"Languages. I do ordinary school by post, in the evenings. I'm three units behind. The verbs are horrible.\"" },
        { choice: [
          { text: "\"Mine was worse. I took it for one term.\"", steps: [
            { say: "rowan", text: "\"Mine was worse. I took it for one term.\"" },
            { say: "georgie", text: "\"Then we could be bad at it together.\"" },
            { text: "The second the words leave her she goes red." },
            { say: "georgie", text: "\"If — if you wanted. It's fine if not.\"" },
            { say: "rowan", text: "\"I'd like that.\"" },
            AFF("georgie", 2, "Offered to be bad at verbs with her")
          ] },
          { text: "\"And when it isn't cards or verbs?\"", steps: [
            { say: "rowan", text: "\"And when it isn't cards or verbs?\"" },
            { say: "georgie", text: "\"Draw dragons. Eat pudding.\" She brightens, very slightly. \"Is there pudding on the island, do you know? The letter didn't say.\"" },
            { say: "rowan", text: "\"I'll find out and report back.\"" },
            { say: "georgie", text: "\"Thank you.\"" },
            { text: "She says it gravely, as if you had volunteered to scout a mountain pass." },
            NOTE("georgie", "Draws dragons. Likes pudding."),
            AFF("georgie", 2, "Took pudding seriously")
          ] }
        ] },
        { flag: "chat_georgie_3" },
        NOTE("georgie", "Does ordinary school by post, in the evenings, and is behind in languages."),
        { time: 3 }
      ] },
      { text: "\"You've done all this before. Halls, finals. What's the best part of a tournament?\"", when: (s)=>!s.flags["chat_georgie_x"]&&(!!s.flags["georgie_said_titles"]||!!s.flags["chat_georgie_1"]), steps: [
        { say: "rowan", text: "\"You've done all this before. Halls, finals. What's the best part of a tournament?\"" },
        { say: "georgie", text: "\"…The end.\"" },
        { say: "georgie", text: "\"Not the winning.\" Quickly. \"After. When the last handshake's done and everyone's tired and nobody's pretending any more, and somebody always has sandwiches.\"" },
        { say: "georgie", text: "\"People share them. Everyone. Even the people who lost. It's the only time I'm in a room where nobody's looking at the table.\" A tiny, private smile. \"I like that part very much.\"" },
        { choice: [
          { text: "\"I'll bring sandwiches.\"", steps: [
            { say: "rowan", text: "\"I'll bring sandwiches.\"" },
            { text: "She looks at you for a long second." },
            { say: "georgie", text: "\"Okay.\"" }
          ] },
          { text: "\"What kind of sandwiches?\"", steps: [
            { say: "rowan", text: "\"What kind of sandwiches?\"" },
            { say: "georgie", text: "\"Cheese. Egg goes warm. Never tuna, not in a hall.\"" },
            { text: "The clipped voice again, the one with no doubt in it. She catches herself a moment later." },
            { say: "georgie", text: "\"…I have opinions. It's fine. You can ignore them.\"" },
            { say: "rowan", text: "\"Cheese. No tuna. I've written it down.\"" },
            NOTE("georgie", "Sandwich rulings: cheese, never tuna.")
          ] }
        ] },
        AFF("georgie", 2, "Liked the sandwich part too"),
        { flag: "chat_georgie_x" },
        NOTE("georgie", "Likes the part of a tournament after the last handshake, when people share sandwiches."),
        { time: 3 }
      ] },
      { text: "\"Have you met Branden? Flame-orange hair, the lifebuoy?\"", when: (s)=>!!s.flags["met_branden"]&&!s.flags["chat_georgie_4"], steps: [
        { say: "rowan", text: "\"Have you met Branden? Flame-orange hair, the lifebuoy?\"" },
        { say: "georgie", text: "\"…Yes.\" Barely audible. \"He said I'm technically retired.\"" },
        { say: "georgie", text: "\"I used to be the youngest. Everywhere. I liked it. People were gentle about it. He's *louder*, and he's ten, and he is already better at being young than I ever was.\"" },
        { choice: [
          { text: "\"That's not a competition.\"", steps: [
            { say: "rowan", text: "\"That's not a competition.\"" },
            { say: "georgie", text: "\"It feels like one.\"" },
            { text: "A very small, very brave pause." },
            { say: "georgie", text: "\"Is it bad that I want to win?\"" },
            { say: "rowan", text: "\"I don't think so.\"" }
          ] },
          { text: "\"What were you like at ten?\"", steps: [
            { say: "rowan", text: "\"What were you like at ten?\"" },
            { say: "georgie", text: "\"Quiet. I had a deck and a kitchen timer.\"" },
            { text: "Somewhere down the deck somebody whoops. She does not need to look to know who." },
            { say: "georgie", text: "\"He has everything else.\" A very small, very brave pause. \"Is it bad that I want to win? Not at cards. At the other thing.\"" },
            { say: "rowan", text: "\"It isn't bad. I don't think the other thing is a game, though.\"" },
            { say: "georgie", text: "\"Everything's a game. Some of them just don't tell you the rules.\"" }
          ] }
        ] },
        { flag: "chat_georgie_4" },
        REL("branden", "georgie"),
        NOTE("georgie", "Used to be the youngest everywhere. Branden has taken that from her, and she minds."),
        { time: 3 }
      ] },
      { text: "\"Do you know Inya? Green hair, bunny clip, down in the lounge.\"", when: (s)=>!!s.flags["met_inya"]&&!s.flags["chat_georgie_5"], steps: [
        { say: "rowan", text: "\"Do you know Inya? Green hair, bunny clip, down in the lounge.\"" },
        { text: "Her whole face changes. For a moment she looks exactly fourteen, and pleased." },
        { say: "georgie", text: "\"Inya's — yes. I saw her go down the stairs with her deck box out. You don't talk to somebody who has their deck box out.\"" },
        { say: "georgie", text: "\"We played at a regional once. She didn't go easy on me. Everybody goes easy, and then they're cross about it. She just played. Afterwards she bought me a juice.\"" },
        { choice: [
          { text: "\"Go down and say hello. She'd want you to.\"", steps: [
            { say: "rowan", text: "\"Go down and say hello. She'd want you to.\"" },
            { say: "georgie", text: "\"There are a lot of people down there.\" She looks at the lounge door as if it were the mouth of something. \"…Maybe when there are fewer.\"" },
            AFF("georgie", 1, "Thought she'd be welcome")
          ] },
          { text: "\"I'll tell her you're up here.\"", steps: [
            { say: "rowan", text: "\"I'll tell her you're up here.\"" },
            { say: "georgie", text: "\"Would you?\" Then, fast: \"Don't say I asked. Say the rope is free.\"" },
            { say: "rowan", text: "\"The rope is free. I can remember that.\"" },
            { flag: "georgie_rope_message" },
            AFF("georgie", 2, "Carried her message")
          ] }
        ] },
        { flag: "chat_georgie_5" },
        REL("georgie", "inya"),
        NOTE("georgie", "Knows Inya from a regional. Inya did not go easy on her, and bought her a juice afterwards."),
        { time: 3 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_georgie"], steps: [
        { scene: "deck_georgie" }
      ] },
      { text: "\"I'll leave you in peace, Georgie. Thank you.\"", steps: [
        { say: "rowan", text: "\"I'll leave you in peace, Georgie. Thank you.\"" },
        { say: "georgie", text: "\"Okay. Bye. Sorry — no. Not sorry.\" A breath. \"Bye.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("chat_pippa", {
  steps: [
    // Folge-Hub nach der gemeinsamen Szene.
    { label: "top" },
    { when: (s)=>!!s.flags["chat_pippa_1"]&&!!s.flags["chat_pippa_2"]&&!!s.flags["chat_pippa_3"]&&!!s.flags["chat_pippa_x"]&&(!!s.flags["deck_known_pippa"]||!!s.flags["deck_skipped_pippa"])&&!s.flags["chat_pippa_done"], jump: "done" },
    { choice: [
      { text: "\"Thirty-eight faces. What are you hoping is on the roll?\"", when: (s)=>!s.flags["chat_pippa_1"], steps: [
        { say: "rowan", text: "\"Thirty-eight faces. What are you hoping is on the roll?\"" },
        { say: "pippa", text: "\"Mostly rubbish! Thirty-eight people being brave at a camera.\"" },
        { say: "pippa", text: "\"But somewhere in there, one where somebody looks like themselves.\" She lifts the camera and does not click. \"Not nice, not clever. Just like themselves. That's the whole job, really. Everything else is practice.\"" },
        { say: "rowan", text: "\"Have you ever got one?\"" },
        { say: "pippa", text: "\"Twice, I think. And the quickest way I know to find the people I'm going to like. You find people through a lens. It's cheating. It works.\"" },
        { choice: [
          { text: "\"Who have you found so far?\"", steps: [
            { say: "rowan", text: "\"Who have you found so far?\"" },
            { say: "pippa", text: "\"An enormous boy in a straw hat who moved a whole bench, by himself, so that somebody else's bag was in the shade. He didn't tell anyone. I've got it, though.\"" },
            PHOTO("baylee_bench", "Baylee moving a whole bench by himself, so somebody else's bag is in the shade", { who: ["baylee"], off: true }),
            { when: (s)=>!!s.flags["pg_two_people"], say: "pippa", text: "\"And the second Georgie, the one with the cards. And — well. Frame thirty-four was all right.\" She is suddenly very busy with the strap. \"Don't put that in a caption.\"" },
            { when: (s)=>!s.flags["pg_two_people"], say: "pippa", text: "\"And Georgie shuffling, obviously. And — well. Frame thirty-four was all right.\" She is suddenly very busy with the strap. \"Don't put that in a caption.\"" },
            PHOTO("rowan_frame_eleven", "Frame thirty-four: Rowan, rope, pocket", { who: ["rowan"] }),
            PHOTO("georgie_hands", "Georgie's hands shuffling, eight riffles, Ember at her elbow (no face)", { who: ["georgie"] }),
            AFF("pippa", 1, "Asked who she liked")
          ] },
          { text: "\"It's also a good way never to be on the other side of one.\"", steps: [
            { say: "rowan", text: "\"It's also a good way never to be on the other side of one.\"" },
            { say: "pippa", text: "\"Ouch. Accurate, but ouch.\"" },
            { say: "pippa", text: "\"I'm not hiding behind the camera. I'm just… better from back here.\" A grin, a little late. \"Ask me again in a month. I'll have thought of something funnier.\"" },
            { flag: "pippa_said_behind" },
            AFF("pippa", 2, "Saw how it works")
          ] },
          { text: "\"And the ones you don't like?\"", steps: [
            { say: "rowan", text: "\"And the ones you don't like?\"" },
            { say: "pippa", text: "\"They get photographed as well. Very sharply. Putting somebody perfectly in focus is the meanest thing I know how to do.\"" },
            { say: "rowan", text: "\"Was I in focus?\"" },
            { say: "pippa", text: "\"You were a bit soft round the edges. Relax, that's a compliment.\"" }
          ] }
        ] },
        AFF("pippa", 2, "Asked about her work"),
        { flag: "chat_pippa_1" },
        NOTE("pippa", "Is photographing all the first-years before the ship docks. Wants one photograph where somebody looks like themselves."),
        { time: 2 }
      ] },
      { text: "\"'She's allowed to sit on the rope. I've told her.' You talk about her like family.\"", when: (s)=>!s.flags["chat_pippa_2"], steps: [
        { say: "rowan", text: "\"'She's allowed to sit on the rope. I've told her.' You talk about her like family.\"" },
        { say: "pippa", text: "\"Do I? Good.\"" },
        { text: "Without looking, she takes a squashed bread roll out of one of her bulging pockets and puts it down on the rope beside Georgie, the way you would put down a coaster." },
        { say: "georgie", text: "\"I had tea.\"" },
        { say: "pippa", text: "\"Tea is a drink, Georgie.\" Back to you. \"Since the harbour this morning. I've decided I'm her older sister. It's not up for discussion.\"" },
        { say: "georgie", text: "\"I can hear you.\"" },
        { say: "pippa", text: "\"Good. Now you've been told.\"" },
        { choice: [
          { text: "\"Since this morning is quick, for a sister.\"", steps: [
            { say: "rowan", text: "\"Since this morning is quick, for a sister.\"" },
            { say: "pippa", text: "\"I've had practice. Three little brothers, at home. You learn to spot the one who hasn't eaten and isn't going to say.\"" }
          ] },
          { text: "\"Does she get a vote?\"", steps: [
            { say: "rowan", text: "\"Does she get a vote?\"" },
            { say: "pippa", text: "\"No! That's the entire point of an older sister. Ask my brothers. There are three of them, at home, and not one has ever had a vote.\"" }
          ] }
        ] },
        { text: "She winds the film on a notch with her thumb, which she does not need to do." },
        { say: "pippa", text: "\"The house will be so tidy without me. Nobody's had to find anybody's other shoe since I left. They'll be fine. That's the annoying part.\"" },
        { choice: [
          { text: "\"They'll have lost every shoe by Friday.\"", steps: [
            { say: "rowan", text: "\"They'll have lost every shoe by Friday.\"" },
            { say: "pippa", text: "\"…Yes. Yes, they will.\" It cheers her up enormously." }
          ] },
          { text: "\"Being needed is a hard thing to leave at home.\"", steps: [
            { say: "rowan", text: "\"Being needed is a hard thing to leave at home.\"" },
            { text: "She looks at you over the camera for a second too long, as if you had walked into a frame she had not set up." },
            { say: "pippa", text: "\"…That's very good light you're standing in. Don't do that.\"" },
            AFF("pippa", 1, "Saw past the joke")
          ] }
        ] },
        { text: "Behind her, very quietly, Georgie has started on the roll." },
        { say: "pippa", text: "\"Don't look. She'll stop.\"" },
        AFF("pippa", 2, "Cared about Georgie"),
        { flag: "chat_pippa_2" },
        { flag: "pippa_georgie_sister" },
        { flag: "pippa_said_brothers" },
        REL("pippa", "georgie"),
        NOTE("pippa", "Has appointed herself Georgie's older sister, and keeps bread rolls in her pockets for her."),
        NOTE("pippa", "Has three younger brothers at home."),
        { time: 2 }
      ] },
      { text: "\"Thirty-four frames on that roll, and not one of them is you. Is there a picture of you anywhere?\"", when: (s)=>!s.flags["chat_pippa_3"], steps: [
        { say: "rowan", text: "\"Thirty-four frames on that roll, and not one of them is you. Is there a picture of you anywhere?\"" },
        { say: "pippa", text: "\"Hm?\" The camera comes down an inch. \"Oh — no. Thirty-seven, and a photographer. Somebody has to be behind it. It's a rule. There's always one person behind it.\"" },
        { text: "A very small pause. It is quick, and she covers it with a grin, but it was there." },
        { say: "georgie", text: "\"I offered.\" From the rope. \"She said I'd hold it like a deck box.\"" },
        { say: "pippa", text: "\"You would! Both hands, like it might go off.\" Then, to you: \"You could try. You'll be terrible. It'll be perfect.\"" },
        { text: "She has the strap half over her head before she stops." },
        { say: "pippa", text: "\"…No. Wait. That's the good roll, and you'd cut my head off. On the island. When I've got one loaded that doesn't matter.\"" },
        { choice: [
          { text: "\"On the island, then. I'm holding you to it.\"", steps: [
            { say: "rowan", text: "\"On the island, then. I'm holding you to it.\"" },
            { say: "pippa", text: "\"People say that.\" Lightly. \"Fine. Hold me to it. I'm the one behind the camera, I'm easy to find.\"" },
            AFF("pippa", 2, "Meant to come back"),
            { flag: "pippa_owes_portrait" }
          ] },
          { text: "\"You stopped, just then.\"", steps: [
            { say: "rowan", text: "\"You stopped, just then.\"" },
            { say: "pippa", text: "\"Did I? Bad light.\"" },
            { say: "pippa", text: "\"…You're quite annoying to stand next to, did you know?\" She does not move away. \"You'd make a decent photographer.\"" },
            AFF("pippa", 2, "Noticed the pause")
          ] },
          { text: "\"A roll that doesn't matter. For the one picture of you.\"", steps: [
            { say: "rowan", text: "\"A roll that doesn't matter. For the one picture of you.\"" },
            { say: "pippa", text: "\"…Okay. That sounded worse out loud than it did in my head.\" She laughs, properly, at herself. \"Don't caption that.\"" },
            AFF("pippa", 1, "Caught what she said")
          ] }
        ] },
        AFF("pippa", 1, "Asked who takes hers"),
        { flag: "chat_pippa_3" },
        NOTE("pippa", "Is in none of her own photographs: 'somebody has to be behind the camera.'"),
        { time: 2 }
      ] },
      { text: "\"No deleting, you said. Is there a frame you're glad you couldn't?\"", when: (s)=>!s.flags["chat_pippa_x"], steps: [
        { say: "rowan", text: "\"No deleting, you said. Is there a frame you're glad you couldn't?\"" },
        { say: "pippa", text: "\"Oh — easy. A man asleep on a night bus. Holding a goldfish in a bag. A real one. Alive. Swimming.\"" },
        { say: "pippa", text: "\"He had his coat buttoned over it so that it'd stay warm, and he'd fallen asleep with his hand over the top, like a very small hat. I took it from the stairs.\"" },
        { say: "rowan", text: "\"Is it any good?\"" },
        { say: "pippa", text: "\"It's the best thing I've ever done. I've never printed it. It was too private. He didn't know he was being that nice.\"" },
        { choice: [
          { text: "\"Then why keep it?\"", steps: [
            { say: "rowan", text: "\"Then why keep it?\"" },
            { say: "pippa", text: "\"Because it's the one where I thought, there's somebody who's looking after something. And that's what I want to take, all the time. Somebody looking after something.\"" },
            { text: "Her eyes go, without her meaning them to, to the rope coil and the girl on it." }
          ] },
          { text: "\"You took mine without asking, too. What's the difference?\"", steps: [
            { say: "rowan", text: "\"You took mine without asking, too. What's the difference?\"" },
            PHOTO("rowan_frame_eleven", "Frame thirty-four: Rowan, rope, pocket", { who: ["rowan"] }),
            { say: "pippa", text: "\"You were looking at an island. He was looking after a fish.\"" },
            { say: "pippa", text: "\"…All right, there's less difference than I'd like. Yours I'll show you before anybody else sees it. That's the rule I made after him. He's why there's a rule.\"" },
            AFF("pippa", 1, "Asked the fair question")
          ] }
        ] },
        { text: "The engine drums under the planks. She looks at the camera in her hands as if it had spoken out of turn." },
        { say: "pippa", text: "\"That got serious. Quick, say something about the weather.\"" },
        { say: "rowan", text: "\"It's windy.\"" },
        { say: "pippa", text: "\"Thank you.\"" },
        AFF("pippa", 2, "Heard about the goldfish"),
        { flag: "chat_pippa_x" },
        NOTE("pippa", "Her best photograph is of a man asleep on a night bus with a goldfish in a bag. She has never printed it."),
        { time: 2 }
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_pippa"], steps: [
        { scene: "deck_pippa" }
      ] },
      { text: "\"I'll let you get back to it. Thanks, Pippa.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to it. Thanks, Pippa.\"" },
        { say: "pippa", text: "\"Go on, then. If you see something nobody else is looking at, come and tell me.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" },
    { label: "done" },
    { flag: "chat_pippa_done" },
    { say: "pippa", text: "\"You're good at this. Most people want to be *in* the picture. You asked about the picture.\"" },
    { end: true }
  ]
});
