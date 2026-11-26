// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS } = helpers;
scene("ferry_gideon", {
  steps: [
    { when: (s)=>!!s.flags["lounge_seen"], jump: "seen" },
    { scene: "lounge_first" },
    { end: true },
    { label: "seen" },
    { when: (s)=>!!s.flags["gideon_talked"], jump: "again" },
    { flag: "gideon_talked" },
    { text: "Up close, he is smaller than you expected. Pale, black hair slicked flat, a thin smile that does not reach grey eyes. His jacket is spotless, his collar starched, white and gold." },
    { text: "The white gloves lie folded beside the deck, thumbs aligned. He does not look up. He squares the cards against the felt." },
    { when: (s)=>!!s.flags["met_gideon"], jump: "known" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance.\"" },
    { think: "He had my name before I was off the stairs. Nobody has given me his." },
    { choice: [
      { text: "\"You have the advantage of me. I take it you read the list.\"", steps: [
        { say: "rowan", text: "\"You have the advantage of me. I take it you read the list.\"" },
        { say: "gideon", alias: "Boy in white gloves", text: "\"The list. The jacket.\" A small, dry pause. \"I can add.\"" }
      ] },
      { text: "\"That's me. And you are?\"", steps: [
        { say: "rowan", text: "\"That's me. And you are?\"" },
        { say: "gideon", alias: "Boy in white gloves", text: "\"Quick.\" The thinnest approval." }
      ] }
    ] },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Gideon Pryce. I would offer to shake hands, but you will understand that I never do before a game.\"" },
    MET("gideon", "Gideon Pryce"),
    { think: "Before a game. As if that had been settled as well." },
    { jump: "sit" },
    { label: "known" },
    { say: "gideon", text: "\"Vance.\"" },
    { text: "He says it to the deck." },
    { say: "gideon", text: "\"You have come to the table after all. The stool is not a commitment. Sit.\"" },
    { label: "sit" },
    { text: "You take the stool opposite. The brass rim is cold under your wrists." },
    { jump: "outcome" },

    { label: "again" },
    { say: "gideon", text: "\"Vance.\"" },
    { when: (s)=>!s.flags["table_resolved"], text: "He does not look up. He has, you are fairly sure, known you were coming since the stairs." },

    { label: "outcome" },
    { when: (s)=>!s.flags["table_resolved"] || !!s.flags["gideon_after_said"], jump: "outcome_end" },
    { flag: "gideon_after_said" },
    { when: (s)=>!!s.flags["ferry_table_won"], say: "gideon", text: "\"Your duffel will be at your door before supper. I do not intend to make a performance of it.\"" },
    { when: (s)=>!!s.flags["ferry_table_won"], say: "gideon", text: "\"I have been going over the game. I do that. You will find it tiresome, if we are to know each other.\"" },
    { when: (s)=>!!s.flags["ferry_table_lost"], say: "gideon", text: "\"You have come about the cases. They are heavier than they look. One lifts with the knees; I am told that is how it is done.\"" },
    { when: (s)=>!!s.flags["ferry_table_settled"], say: "gideon", text: "\"You are the only person on this ship who has made me play a game for nothing and not regret it. Do not read into it.\"" },
    { when: (s)=>!!s.flags["ferry_inya_won"], say: "gideon", text: "\"She stopped attacking. I wonder who told her.\"" },
    { when: (s)=>!!s.flags["ferry_inya_won"], text: "He looks at you for exactly one second." },
    { when: (s)=>!!s.flags["ferry_inya_won"], say: "gideon", text: "\"Never mind.\"" },
    { when: (s)=>!!s.flags["ferry_inya_lost"], say: "gideon", text: "\"A straightforward game. She attacked first. People do; it is the one thing I rely upon.\"" },
    { when: (s)=>!s.flags["ferry_table_won"] && !s.flags["ferry_table_lost"] && !s.flags["ferry_table_settled"] && !s.flags["ferry_inya_won"] && !s.flags["ferry_inya_lost"], say: "gideon", text: "\"The table is closed. We dock shortly. You may sit at it; you may not play at it.\"" },
    { label: "outcome_end" },
    { when: (s)=>!!s.flags["gideon_first_done"], jump: "menu" },
    { flag: "gideon_first_done" },

    { when: (s)=>!s.flags["table_resolved"], say: "gideon", text: "\"Before you ask about the young lady, and you will, a question of my own.\"" },
    { when: (s)=>!!s.flags["table_resolved"], say: "gideon", text: "\"Now that the table is no longer between us: a question I have been keeping since you came down the stairs.\"" },
    { say: "gideon", text: "\"The rain jacket. Did the Academy forget to send you the other kind, or did you forget to put it on?\"" },
    { choice: [
      { text: "\"They never sent one. The letter says it's waiting on the island.\"", steps: [
        { say: "rowan", text: "\"They never sent one. The letter says it's waiting on the island.\"" },
        { say: "gideon", text: "\"So the office found a seat, and no jacket to go with it.\" A small pause, in which something is filed. \"They decided late, then. Later than the list suggests. Thank you.\"" },
        { think: "I have just told him something. I'm not sure what." },
        AFF("gideon", 1, "Answered plainly")
      ] },
      { text: "\"Is that a casual question?\"", steps: [
        { say: "rowan", text: "\"Is that a casual question?\"" },
        { say: "gideon", text: "\"There are no casual questions, Vance. There are only questions asked casually.\"" },
        { text: "The grey eyes come up from the deck at last." },
        { say: "gideon", text: "\"Most people take a week to ask me that.\"" },
        AFF("gideon", 2, "Heard the real question")
      ] },
      { text: "\"You first. Why won't you play her?\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"You first. Why won't you play her?\"" },
        { say: "gideon", text: "\"A trade.\" He inclines his head. \"Very well. I shall keep mine for another day; it will not spoil.\"" }
      ] },
      { text: "\"Does it matter now? The morning's nearly over.\"", when: (s)=>!!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"Does it matter now? The morning's nearly over.\"" },
        { say: "gideon", text: "\"Everything matters, Vance. It is merely a question of to whom.\" He lets it go, courteously, the way one lets a door close. \"Another day, then. It will not spoil.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["table_resolved"], jump: "cove" },

    { text: "At the far end of the felt the small girl with the deck box has not gone anywhere. He does not look at her to speak of her." },
    { say: "gideon", text: "\"Miss Bell. Inya Bell: she gave the room her name before you came down, at some volume.\"" },
    { say: "gideon", text: "\"It is not a rule. It is a preference, and I hold the table. I play those who have beaten somebody worth beating. Miss Bell has not, and I have told her how she might.\"" },
    { say: "gideon", text: "\"It costs her one game. It costs you one game. And I see what the admissions office thought worth a seat in ink. Three people served by a single arrangement. I am a very reasonable man.\"" },
    { choice: [
      { text: "\"She has been standing there half the morning. That costs something too.\"", steps: [
        { say: "rowan", text: "\"She has been standing there half the morning. That costs something too.\"" },
        { say: "gideon", text: "\"It costs patience. I have been sitting here since the harbour, and nobody has yet felt sorry for me.\"" },
        { say: "gideon", text: "\"She could walk away. She does not.\" The deck is squared. \"I find that the most interesting thing about her.\"" }
      ] },
      { text: "\"So it's me you want a look at. She's the envelope.\"", when: (s)=>!s.flags["gideon_curious_aloud"], steps: [
        { say: "rowan", text: "\"So it's me you want a look at. She's the envelope.\"" },
        { say: "gideon", text: "\"I should not have put it so unkindly.\" Which is not a denial. \"But I take an interest in the one name the office wrote by hand, and one learns very little by asking.\"" },
        AFF("gideon", 1, "Saw the arrangement")
      ] },
      { text: "\"You told the room you take an interest in everybody. What have you got on me so far?\"", when: (s)=>!!s.flags["gideon_curious_aloud"], steps: [
        { say: "rowan", text: "\"You told the room you take an interest in everybody. What have you got on me so far?\"" },
        { say: "gideon", text: "\"A name in ink. A rain jacket. A habit of stopping where you can see the door.\"" },
        { say: "gideon", text: "\"And now a conversation in which you have told me rather less than you think.\" He sounds, if anything, pleased. \"It is a promising start.\"" },
        AFF("gideon", 1, "Asked what he had filed")
      ] },
      { text: "\"And if I simply don't play anybody?\"", steps: [
        { say: "rowan", text: "\"And if I simply don't play anybody?\"" },
        { say: "gideon", text: "\"Then at five past ten I close the table, we dock, and nothing has happened to anyone.\"" },
        { say: "gideon", text: "\"People seldom choose nothing, Vance.\" Very softly. \"Not when a room is watching them do it.\"" }
      ] }
    ] },

    { label: "cove" },
    { say: "gideon", text: "\"You are for the cove, I gather. The bungalows. I am sure they are charming at low tide.\"" },
    { choice: [
      { text: "\"The Commons. That's what my letter calls it.\"", steps: [
        { say: "rowan", text: "\"The Commons. That's what my letter calls it.\"" },
        { say: "gideon", text: "\"Does it.\" He holds the word a little away from himself. \"Mine calls the tower the Tower. Suite five. One sees a great deal from it, I am told.\"" }
      ] },
      { text: "\"You say 'cove' the way other people say 'drain'.\"", steps: [
        { say: "rowan", text: "\"You say 'cove' the way other people say 'drain'.\"" },
        { say: "gideon", text: "\"Do I.\" Mild. \"I shall have to listen to myself. One so rarely gets the chance.\"" },
        { say: "gideon", text: "\"Suite five, the Spectral Tower. Should you ever wish to know where the view is.\"" },
        AFF("gideon", 1, "Did not flinch")
      ] },
      { text: "\"And you're for the tower. The starch gives it away.\"", steps: [
        { say: "rowan", text: "\"And you're for the tower. The starch gives it away.\"" },
        { say: "gideon", text: "\"The collar gives it away. The starch is my own.\" He touches it, once, with one bare finger. \"Suite five.\"" },
        AFF("gideon", 1, "Noticed the collar")
      ] }
    ] },
    { flag: "gideon_said_cove" },
    NOTE("gideon", "Spectral Tower, suite five. Calls the Commons 'the cove'."),
    { text: "He squares the deck again, twice, which seems to be how he ends things." },
    { when: (s)=>!s.flags["table_resolved"], say: "gideon", text: "\"That will do for an introduction. If you mean to do something about the table, do it before five past ten.\"" },
    { when: (s)=>!!s.flags["table_resolved"], say: "gideon", text: "\"That will do for an introduction. We shall have a year of them.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"That's the glove guy! Don't look at him! He'll know!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Quiet, Nathan. He's counting.\"" },
    { add: { ferry_talked: 1 } },
    { time: 4 },

    { label: "menu" },
    { choice: [
      { text: "\"I'll play you myself, instead.\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"I'll play you myself, instead.\"" },
        { flag: "gideon_challenge_said" },
        { scene: "table_challenge_gideon" }
      ] },
      { text: "\"She should get her game. I'll vouch for her.\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"She should get her game. I'll vouch for her.\"" },
        { scene: "table_vouch" }
      ] },
      { text: "\"Then I'll play her, the way you said.\"", when: (s)=>!s.flags["table_resolved"] && !s.flags["inya_accepted_rowan"], steps: [
        { say: "rowan", text: "\"Then I'll play her, the way you said.\"" },
        { say: "gideon", text: "\"I rather thought you might.\" He turns his head a careful inch towards the end of the table. \"Miss Bell?\"" },
        { when: (s)=>!!s.flags["inya_shut_out"] && !s.flags["inya_forgave"], say: "inya", text: "\"For the table.\" She does not look at you. \"Not for him. And not for you.\"" },
        { when: (s)=>!!s.flags["met_inya"] && !(!!s.flags["inya_shut_out"] && !s.flags["inya_forgave"]), say: "inya", text: "\"…Fine.\" The deck box comes down onto the felt. \"But not because he said so.\"" },
        { when: (s)=>!s.flags["met_inya"], say: "inya", alias: "Girl with the bunny clip", text: "\"…Fine.\" She looks you up and down again. It takes no longer than the first time. \"Inya Bell. And not because he said so.\"" },
        MET("inya", "Inya Bell"),
        { flag: "inya_engaged" },
        { scene: "table_rowan_vs_inya" }
      ] },
      { text: "\"What if there were a second table?\"", when: (s)=>!!s.flags["noor_ruled"] && !s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"What if there were a second table?\"" },
        { say: "gideon", text: "\"A second table.\"" },
        { text: "He says it as if it were a foreign word." },
        { say: "gideon", text: "\"Do go on. I should like to see where you intend to put it.\"" },
        { scene: "table_settle" }
      ] },
      { text: "Turn the talk to his cards.", when: (s)=>!s.flags["deck_known_gideon"], steps: [
        { scene: "deck_gideon" }
      ] },
      { text: "Stay on the stool and talk a while.", when: (s)=>!s.flags["chat_gideon_done"], steps: [
        { scene: "chat_gideon" }
      ] },
      { text: "Leave him to his cards.", steps: [
        { say: "rowan", text: "\"I'll leave you to your cards.\"" },
        { say: "gideon", text: "\"Good morning, then.\"" }
      ] }
    ] },
    { time: 5 }
  ]
});

scene("chat_gideon", {
  steps: [
    { label: "top" },
    { when: (s)=>!(!!s.flags["chat_gideon_1"] && !!s.flags["chat_gideon_2"] && !!s.flags["chat_gideon_3"] && !!s.flags["chat_gideon_4"] && !!s.flags["chat_gideon_x"] && (!!s.flags["deck_known_gideon"] || !!s.flags["deck_skipped_gideon"])), jump: "ask" },
    { flag: "chat_gideon_done" },
    { say: "gideon", text: "\"That will do, Vance. I find that I have said rather more than I intended. Do not mention it to anyone.\" A quarter-inch of a smile. \"I shall know if you do.\"" },
    { end: true },
    { label: "ask" },
    { choice: [
      { text: "\"You were at this table before I came down the stairs. How long before?\"", when: (s)=>!s.flags["chat_gideon_1"], steps: [
        { say: "rowan", text: "\"You were at this table before I came down the stairs. How long before?\"" },
        { say: "gideon", text: "\"Since the harbour. I was first up the gangway, by some forty minutes.\" He squares the deck, once. \"It is the only real table on the ship. One must be seen to be using it. A table that nobody is at is merely furniture.\"" },
        { say: "rowan", text: "\"And a table somebody is at?\"" },
        { say: "gideon", text: "\"A position.\"" },
        { choice: [
          { text: "\"Forty minutes early for a ferry. What did you do with them?\"", steps: [
            { say: "rowan", text: "\"Forty minutes early for a ferry. What did you do with them?\"" },
            { say: "gideon", text: "\"Chose the stool. Read the plate. Watched who came aboard, and in what order, and who carried whose bag.\"" },
            { say: "gideon", text: "\"I can tell you which of them arrived together and which only pretended not to know each other.\" He does not offer to. \"It is a short crossing. One ought to arrive knowing something.\"" },
            AFF("gideon", 1, "Asked about the forty minutes")
          ] },
          { text: "\"It looks like a lonely position.\"", steps: [
            { say: "rowan", text: "\"It looks like a lonely position.\"" },
            { say: "gideon", text: "\"…\"" },
            { text: "The deck is squared a second time, which it did not need." },
            { say: "gideon", text: "\"I have been perfectly well occupied. One learns more from who approaches a table than from who sits at it.\" A beat. \"You, for example, came with a question and not a deck.\"" },
            AFF("gideon", 1, "Said it without pity")
          ] },
          { text: "\"And when we dock? What happens to the position then?\"", steps: [
            { say: "rowan", text: "\"And when we dock? What happens to the position then?\"" },
            { say: "gideon", text: "\"Then one finds the next table. There is always a next table, Vance.\"" },
            { say: "gideon", text: "\"The art is to be sitting at it before the room has understood that it matters.\"" }
          ] }
        ] },
        { flag: "chat_gideon_1" },
        NOTE("gideon", "First aboard by forty minutes, and at the lounge table ever since: 'a table nobody sits at is furniture.'"),
        { time: 2 },
      ] },
      { text: "\"Why the white gloves?\"", when: (s)=>!s.flags["chat_gideon_2"], steps: [
        { say: "rowan", text: "\"Why the white gloves?\"" },
        { say: "gideon", text: "\"Manners.\"" },
        { text: "He lays one bare hand flat on the felt, the way another boy might lay down a card." },
        { say: "gideon", text: "\"One should have clean hands when one touches things that belong to other people.\"" },
        { say: "gideon", text: "\"Cards, chiefly. Occasionally other things.\"" },
        { choice: [
          { text: "\"Which other things?\"", steps: [
            { say: "rowan", text: "\"Which other things?\"" },
            { say: "gideon", text: "\"Hm.\"" },
            { text: "The grey eyes rest on you a moment." },
            { say: "gideon", text: "\"You do ask the right second question, Vance. It is a rare habit.\"" },
            AFF("gideon", 2, "Asked the second question")
          ] },
          { text: "\"But they're off. They've been lying next to the deck since I sat down.\"", steps: [
            { say: "rowan", text: "\"But they're off. They've been lying next to the deck since I sat down.\"" },
            { say: "gideon", text: "\"One cannot shuffle in cotton.\" As one explains a thing to a child, though not unkindly. \"One can do very little that matters in cotton. They come off for the part that counts, and go back on for everything else.\"" },
            { say: "rowan", text: "\"That sounds like most of the day.\"" },
            { say: "gideon", text: "\"Most of most days.\"" },
            AFF("gideon", 1, "Watched his hands")
          ] },
          { text: "\"And here I thought it was so nobody could dust the table for prints.\"", steps: [
            { say: "rowan", text: "\"And here I thought it was so nobody could dust the table for prints.\"" },
            { text: "Something happens at the corner of his mouth, and is put down again at once, like a card played too early." },
            { say: "gideon", text: "\"Cards are assets, Vance. One does not put fingerprints on assets. I confess I had not considered the table.\"" },
            AFF("gideon", 1, "Nearly made him smile")
          ] }
        ] },
        { flag: "chat_gideon_2" },
        NOTE("gideon", "Wears white gloves out of manners: clean hands for things that belong to other people. They come off only to handle cards."),
        { time: 2 },
      ] },
      { text: "\"You plainly have more questions for me. Go on and ask.\"", when: (s)=>!s.flags["chat_gideon_3"], steps: [
        { say: "rowan", text: "\"You plainly have more questions for me. Go on and ask.\"" },
        { say: "gideon", text: "\"How very direct.\"" },
        { text: "He appears, for a moment, genuinely pleased." },
        { say: "gideon", text: "\"Where did you learn to play?\"" },
        { choice: [
          { text: "\"Online, mostly. Real tables are new to me. I'd rather you didn't spread that around.\"", steps: [
            { say: "rowan", text: "\"Online, mostly. Real tables are new to me. I'd rather you didn't spread that around.\"" },
            { say: "gideon", text: "\"I shall not.\"" },
            { text: "He means it, which is the most unsettling part." },
            { say: "gideon", text: "\"That is a great deal to give a stranger, Vance. Thank you.\"" },
            AFF("gideon", 2, "Was honest with him"),
            { flag: "gideon_knows_online" }
          ] },
          { text: "\"In a laundromat, between dryer cycles. It's a good place to learn patience.\"", steps: [
            { say: "rowan", text: "\"In a laundromat, between dryer cycles. It's a good place to learn patience.\"" },
            { say: "gideon", text: "\"A laundromat.\" Slowly. \"Patience.\" He turns the two words over as if they might fit together. \"I begin to understand why you are quiet.\"" },
            AFF("gideon", 1, "Gave him a true answer")
          ] },
          { text: "\"I'd rather keep that to myself, thanks.\"", steps: [
            { say: "rowan", text: "\"I'd rather keep that to myself, thanks.\"" },
            { say: "gideon", text: "\"A reasonable answer. Almost everyone says more.\"" },
            { text: "He makes a very small, dry note in his head. You can very nearly hear the pen." },
            { say: "gideon", text: "\"That is also informative.\"" }
          ] }
        ] },
        { say: "rowan", text: "\"My turn, then. Where did you?\"" },
        { say: "gideon", text: "\"From a book.\" Without hesitation. \"And then from losing to people who had not read it.\"" },
        { say: "gideon", text: "\"The second part took rather longer.\"" },
        { flag: "chat_gideon_3" },
        NOTE("gideon", "Asks everybody questions and remembers every answer. Learned the game from a book, and then from losing."),
        { time: 2 },
      ] },
      { text: "\"You haven't smiled at a card since I came in. Do you ever actually enjoy it?\"", when: (s)=>!s.flags["chat_gideon_4"], steps: [
        { say: "rowan", text: "\"You haven't smiled at a card since I came in. Do you ever actually enjoy it?\"" },
        { say: "gideon", text: "\"Enjoy.\" He tilts his head. \"You have a very quiet face, Vance. I find that I cannot tell what it is thinking at all.\"" },
        { text: "The corner of his mouth moves." },
        { say: "gideon", text: "\"That is unusual. I wonder if it is also useful.\"" },
        { choice: [
          { text: "\"That wasn't an answer.\"", steps: [
            { say: "rowan", text: "\"That wasn't an answer.\"" },
            { say: "gideon", text: "\"No.\"" },
            { say: "gideon", text: "\"There is a moment,\" he says, to the felt, \"just before the other person understands what has already happened to them. It is brief. I enjoy that.\"" },
            { say: "gideon", text: "\"Everything before it is work. I do not mind work.\"" },
            AFF("gideon", 2, "Did not let it go")
          ] },
          { text: "\"It's useful online. Nobody can see it there, either.\"", when: (s)=>!!s.flags["gideon_knows_online"], steps: [
            { say: "rowan", text: "\"It's useful online. Nobody can see it there, either.\"" },
            { say: "gideon", text: "\"And now somebody can, and it tells them precisely as much.\" He considers you with real interest. \"You have brought the screen with you, Vance. I should not have thought that could be done.\"" },
            AFF("gideon", 1, "Kept the screen on")
          ] },
          { text: "\"It's just tired.\"", when: (s)=>!s.flags["gideon_knows_online"], steps: [
            { say: "rowan", text: "\"It's just tired.\"" },
            { say: "gideon", text: "\"Tired.\" He weighs the word as evidence. \"Then I should like to see it rested. From across a table.\"" },
            AFF("gideon", 1, "Gave him nothing")
          ] },
          { text: "\"Useful for what?\"", steps: [
            { say: "rowan", text: "\"Useful for what?\"" },
            { say: "gideon", text: "\"For sitting opposite me, to begin with. I read faces while I wait; it is most of what waiting is. Yours is a closed book with a plain cover.\"" },
            { say: "gideon", text: "\"I dislike those.\" Almost warmly. \"I always end by buying them.\"" },
            AFF("gideon", 1, "Held his gaze")
          ] }
        ] },
        { flag: "chat_gideon_4" },
        NOTE("gideon", "Reads faces while he waits. What he enjoys is the moment before an opponent understands."),
        { time: 2 },
      ] },
      { text: "\"You called the Commons 'the cove'. What do you know about it that I don't?\"", when: (s)=>!s.flags["chat_gideon_x"] && !!s.flags["gideon_said_cove"], steps: [
        { say: "rowan", text: "\"You called the Commons 'the cove'. What do you know about it that I don't?\"" },
        { say: "gideon", text: "\"The cove.\"" },
        { text: "He says it with great precision, as if holding the word at arm's length." },
        { say: "gideon", text: "\"Nothing at first hand. Nobody aboard has set foot on the island. I merely read what I am sent, which most people do not.\"" },
        { say: "gideon", text: "\"A beach, eight bungalows, a woman with a spoon. It sounds, I confess, extremely dull.\" A beat. \"It is also the only part of the Academy that cannot be seen from the Tower. The plans are quite clear on the point.\"" },
        { choice: [
          { text: "\"You don't like not being able to see.\"", steps: [
            { say: "rowan", text: "\"You don't like not being able to see.\"" },
            { say: "gideon", text: "\"I do not care for it, no.\" The thin smile. \"I make a point of finding out.\"" },
            AFF("gideon", 1, "Read him correctly")
          ] },
          { text: "\"Then come down and look. It's a beach. Nobody checks collars on a beach.\"", steps: [
            { say: "rowan", text: "\"Then come down and look. It's a beach. Nobody checks collars on a beach.\"" },
            { text: "For the first time since you sat down, he has nothing ready." },
            { say: "gideon", text: "\"An invitation. To the cove.\" He turns it over like a card he does not recognise. \"People do not, as a rule, invite me to things, Vance. They inform me of them.\"" },
            { say: "gideon", text: "\"I shall consider it. You will oblige me by not saying that I said so.\"" },
            AFF("gideon", 3, "Invited him anyway"),
            { flag: "gideon_invited" }
          ] },
          { text: "\"A woman with a spoon?\"", steps: [
            { say: "rowan", text: "\"A woman with a spoon?\"" },
            { say: "gideon", text: "\"The housemother. The prospectus has a photograph. She is holding a wooden spoon in the manner of a sceptre, and I gather that nobody eats until she says so.\"" },
            { say: "gideon", text: "\"I should not last a week.\" He says it without any pride at all, which is new. \"You may find that you do.\"" },
            AFF("gideon", 1, "Asked about the spoon")
          ] }
        ] },
        { flag: "chat_gideon_x" },
        NOTE("gideon", "Has read everything about the Commons and never seen it. Dislikes anywhere he cannot see the whole of."),
        { time: 2 },
      ] },
      { text: "Turn the talk to his cards.", when: (s)=>!s.flags["deck_known_gideon"], steps: [
        { scene: "deck_gideon" },
      ] },
      { text: "\"I'll leave you to your cards, Gideon.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to your cards, Gideon.\"" },
        { say: "gideon", text: "\"Good morning, then.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("deck_gideon", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_gideon"], end: true },
    { choice: [
      { text: "\"I watched your game with the deckhand. Guardian Beasts, one beside the other, and you never attacked. Guardians of the Treasure Cave?\"", hint: "From the game you watched", when: (s)=>!!s.flags["saw_beasts"], steps: [
        { say: "rowan", text: "\"I watched your game with the deckhand. Guardian Beasts, one beside the other, and you never attacked. Guardians of the Treasure Cave?\"" },
        { say: "gideon", text: "\"Ma, Hou, Hu.\"" },
        { text: "A very small, very satisfied pause." },
        { say: "gideon", text: "\"You were watching the discard piles. Nobody watches the discard piles.\"" },
        AFF("gideon", 2, "Read his deck")
      ] },
      { text: "\"What is it you run, exactly?\"", steps: [
        { say: "rowan", text: "\"What is it you run, exactly?\"" },
        { when: (s)=>!s.flags["ferry_table_won"], say: "gideon", text: "\"A deck.\" Mild. \"I should hate to spoil it for someone who might one day have to beat it.\"" },
        { when: (s)=>!!s.flags["ferry_table_won"], say: "gideon", text: "\"A deck.\" Mild. \"You have beaten it once. I had rather thought that counted as an introduction.\"" },
        { text: "He relents, by a quarter of an inch." },
        { say: "gideon", text: "\"Guardians of the Treasure Cave, Vance. I imagine you will meet them again.\"" }
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_gideon" },
        { end: true }
      ] }
    ] },
    { text: "Your eyes have gone to the deck under his hand, and your voice runs on under your breath." },
    { say: "rowan", text: "\"…Beasts only come down while your own pile's empty. Every one of them deletes cards when it lands. Yours. Mine. First Circle of Hell wipes an odd pile. Zhu skips a turn, eventually. Never attacks first, because every card he plays is a card he can't afford to lose.\" A breath. \"Lets Ma fill both piles. Right.\"" },
    { say: "gideon", text: "\"How resourceful.\"" },
    { say: "rowan", text: "\"It only breaks if something lands in your pile and nothing is there to delete it.\"" },
    { say: "gideon", text: "\"…\"" },
    { text: "He squares his deck against the felt. Once. Twice." },
    { say: "gideon", text: "\"You may keep that thought. I shall be keeping it as well.\"" },
    DECK("gideon"),
    { flag: "deck_known_gideon" }
  ]
});

scene("ferry_inya", {
  steps: [
    { when: (s)=>!!s.flags["lounge_seen"], jump: "seen" },
    { scene: "lounge_first" },
    { end: true },
    { label: "seen" },
    { when: (s)=>!!s.flags["met_inya"], jump: "again" },
    { when: (s)=>!!s.flags["table_resolved"], jump: "late" },
    { text: "Mint-green tails held by a bunny clip, an oversized hoodie, a bunny charm swinging from the clasp of a deck box, and amber eyes narrowing as she watches the gloved boy's hands: all of it points one way, like a compass needle." },
    { when: (s)=>!!s.flags["rowan_singled_out"], text: "She has seen you coming. She has, evidently, been waiting for you to do exactly that." },
    { when: (s)=>!!s.flags["rowan_singled_out"], say: "inya", alias: "Girl with the bunny clip", text: "\"You. The one he pointed at.\"" },
    { when: (s)=>!s.flags["rowan_singled_out"], say: "inya", alias: "Girl with the bunny clip", text: "\"If you're here to tell me not to, don't.\"" },
    { prompt: "How do you approach her?", choice: [
      { text: "\"I'm Rowan. I don't want to be anyone's hurdle. But I'd like a real game with you, if you'd rather have one of those than a test.\"", steps: [
        { say: "rowan", text: "\"I'm Rowan. I don't want to be anyone's hurdle. But I'd like a real game with you, if you'd rather have one of those than a test.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"A real game.\" Suspicious. \"As in — not because he said so.\"" },
        { say: "rowan", text: "\"Exactly. Whatever he says about collars and standing, I'd rather find out how you play.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"…Okay. Inya Bell.\" A beat. \"Bunnies. Don't say anything about the bunnies, you'd be the fifth.\"" },
        { flag: "inya_said_bunnies" },
        MET("inya", "Inya Bell"),
        AFF("inya", 3, "Wanted a real game"),
        { flag: "rowan_offered_real_game" },
        { flag: "inya_engaged" },
        { flag: "inya_accepted_rowan" },
        { scene: "table_rowan_vs_inya" }
      ] },
      { text: "\"He says you have to beat me first. Fine. Sit down, I'll play you.\"", steps: [
        { say: "rowan", text: "\"He says you have to beat me first. Fine. Sit down, I'll play you.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Just like that.\"" },
        { say: "rowan", text: "\"Just like that. You've waited long enough.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya.\"" },
        { text: "She does not offer a hand. She has not, you realise, let go of the deck box." },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Bell. And you'd better not let me win.\"" },
        MET("inya", "Inya Bell"),
        AFF("inya", 2, "Took the challenge"),
        { flag: "inya_engaged" },
        { flag: "inya_accepted_rowan" },
        { scene: "table_rowan_vs_inya" }
      ] },
      { text: "\"Let me talk to him. Maybe I can make him listen to a reasonable argument.\"", steps: [
        { say: "rowan", text: "\"Let me talk to him. Maybe I can make him listen to a reasonable argument.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"He doesn't listen to arguments. He listens to wins.\"" },
        { say: "rowan", text: "\"Then I'll tell him you've got some. I'm Rowan, by the way.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya Bell.\" Grudging. \"Fine. Try.\"" },
        MET("inya", "Inya Bell"),
        AFF("inya", 2, "Offered to speak for her"),
        { scene: "table_vouch" }
      ] },
      { text: "\"Honestly, I'd walk away. He's baiting you, and it isn't even about you.\"", steps: [
        { say: "rowan", text: "\"Honestly, I'd walk away. He's baiting you, and it isn't even about you.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Not about me.\"" },
        { say: "rowan", text: "\"I think he wants to see what I play. You're the excuse. I'm Rowan, and I'm sorry I'm the reason you're standing here.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya.\" A flat, furious beat. \"If I walk away, he's won. Even if I never sit down.\"" },
        MET("inya", "Inya Bell"),
        { flag: "inya_explained" },
        { choice: [
          { text: "\"Then let me play him instead, if you'll allow it. You've earned the right to say no.\"", steps: [
            { say: "rowan", text: "\"Then let me play him instead, if you'll allow it. You've earned the right to say no.\"" },
            { say: "inya", text: "\"…You'd ask?\"" },
            { say: "rowan", text: "\"I'm asking.\"" },
            { when: (s)=>!!s.flags["met_tomi"], say: "inya", text: "\"Then yes. Take it. But if you lose, you owe me a real game, on a real table, and you don't tell Tomi what I said.\"" },
            { when: (s)=>!s.flags["met_tomi"], say: "inya", text: "\"Then yes. Take it. But if you lose, you owe me a real game, on a real table, and you don't tell the one with the binder what I said. He'd put a price on it.\"" },
            { flag: "inya_yielded" },
            { flag: "inya_asked_first" },
            AFF("inya", 4, "Asked her first"),
            { scene: "table_challenge_gideon" }
          ] },
          { text: "\"Then at least play me, properly, and make him watch.\"", steps: [
            { say: "rowan", text: "\"Then at least play me, properly, and make him watch.\"" },
            { say: "inya", text: "\"…Yes.\"" },
            { text: "A very small, very fierce smile." },
            { say: "inya", text: "\"That I can do.\"" },
            AFF("inya", 2, "Gave her a way forward"),
            { flag: "inya_engaged" },
            { flag: "inya_accepted_rowan" },
            { scene: "table_rowan_vs_inya" }
          ] },
          { text: "\"Then stay, and I'll stand next to you for as long as it takes.\"", steps: [
            { say: "rowan", text: "\"Then stay, and I'll stand next to you for as long as it takes.\"" },
            { text: "She glances at you sideways, then back at the table. She does not say thank you. She does not move away either." },
            AFF("inya", 2, "Stood by her"),
            { flag: "inya_engaged" }
          ] }
        ] }
      ] },
      { text: "\"Would you mind if I took him on instead of you? You've waited long enough.\"", steps: [
        { say: "rowan", text: "\"Would you mind if I took him on instead of you? You've waited long enough.\"" },
        { text: "Her whole body goes sideways. She is not angry. She is not relieved. She is working out which of the two she is." },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"You'd carry four cases.\" Slowly. \"If you lost.\"" },
        { say: "rowan", text: "\"I know. I'm Rowan, by the way.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"You asked.\" A beat. \"Not 'move.' Not 'I'll handle it.' You asked.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya. And — fine. Take it. But if you lose, you owe me a real game.\"" },
        MET("inya", "Inya Bell"),
        { flag: "inya_yielded" },
        { flag: "inya_asked_first" },
            AFF("inya", 4, "Asked her first"),
        { scene: "table_challenge_gideon" }
      ] },
      { text: "\"Step aside. I'll handle him.\"", steps: [
        { say: "rowan", text: "\"Step aside. I'll handle him.\"" },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"Excuse me?\"" },
        { say: "rowan", text: "\"You're shaking. I'll take the game.\"" },
        { text: "Her eyes narrow into two amber slits." },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"I am NOT shaking. And I don't need anybody to 'handle' anybody. Inya Bell. Try that again, and ask.\"" },
        MET("inya", "Inya Bell"),
        AFF("inya", -3, "Talked down to her"),
        { flag: "stepped_past_inya" },
        { flag: "inya_shut_out" }
      ] },
      { text: "Stand beside her and say nothing at all.", steps: [
        { text: "She glances at you sideways, then back at the table. She does not say thank you. She does not move away either." },
        { text: "A minute goes by. The engine hums. The pale boy squares his deck." },
        { say: "inya", alias: "Girl with the bunny clip", text: "\"…Inya.\" Without looking at you. \"Bell.\"" },
        { say: "rowan", text: "\"Rowan.\"" },
        MET("inya", "Inya Bell"),
        AFF("inya", 2, "Stood by her"),
        { flag: "inya_engaged" }
      ] }
    ] },
    { add: { ferry_talked: 1 } },
    { jump: "end" },

    { label: "late" },
    { text: "Mint-green tails held by a bunny clip, an oversized hoodie, a deck box clamped to her chest in both hands with a bunny charm swinging from the clasp. The amber eyes find you before you have decided what to say." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"You. Rain jacket.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"We never did names. Everybody's been saying mine *at* me all morning and nobody asked for it. Inya Bell.\"" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"I know. Everybody knows. He pointed.\"" },
    MET("inya", "Inya Bell"),
    { add: { ferry_talked: 1 } },
    { jump: "outcome" },

    { label: "again" },
    { when: (s)=>!(!!s.flags["inya_shut_out"] && !s.flags["inya_forgave"]), jump: "open" },
    { say: "inya", text: "\"No.\"" },
    { text: "She does not turn round. Her shoulders are set the way a door is set." },
    { choice: [
      { text: "\"I was out of line. You didn't ask me to speak for you, and I did it anyway. I'm sorry.\"", steps: [
        { say: "rowan", text: "\"I was out of line. You didn't ask me to speak for you, and I did it anyway. I'm sorry.\"" },
        { say: "inya", text: "\"…\"" },
        { text: "A long pause, still with her back to you." },
        { say: "inya", text: "\"Okay.\"" },
        { say: "inya", text: "\"You said it plainly. That's more than most people manage.\"" },
        { text: "She turns, at last, and does not quite look at you." },
        { say: "inya", text: "\"Don't do it again.\"" },
        AFF("inya", 3, "Apologised"),
        { flag: "inya_forgave" }
      ] },
      { text: "Leave her be.", steps: [
        { end: true }
      ] }
    ] },
    { label: "open" },
    { when: (s)=>!!s.flags["table_resolved"], jump: "outcome" },
    { say: "inya", text: "\"Rowan.\"" },
    { choice: [
      { text: "\"Do you want to play, the way he said? I'm ready if you are.\"", when: (s)=>!s.flags["inya_accepted_rowan"], steps: [
        { say: "rowan", text: "\"Do you want to play, the way he said? I'm ready if you are.\"" },
        { say: "inya", text: "\"Yes. Now.\"" },
        { flag: "inya_engaged" },
        { flag: "inya_accepted_rowan" },
        { scene: "table_rowan_vs_inya" }
      ] },
      { text: "\"Let me talk to him on your behalf. I'll make my case.\"", when: (s)=>!s.flags["vouch_tried"], steps: [
        { say: "rowan", text: "\"Let me talk to him on your behalf. I'll make my case.\"" },
        { say: "inya", text: "\"On my behalf.\" She weighs it. \"…You asked first. Go on, then.\"" },
        { scene: "table_vouch" }
      ] },
      { text: "\"Would you let me take him on in your place?\"", when: (s)=>!s.flags["inya_yielded"] && !s.flags["stepped_past_inya"], steps: [
        { say: "rowan", text: "\"Would you let me take him on in your place?\"" },
        { say: "inya", text: "\"You'd ask.\" A beat. \"Yes. Take it.\"" },
        { flag: "inya_yielded" },
        { flag: "inya_asked_first" },
        AFF("inya", 3, "Asked her first"),
        { scene: "table_challenge_gideon" }
      ] },
      { text: "\"Why does it matter this much to you?\"", when: (s)=>!s.flags["inya_explained"], steps: [
        { say: "rowan", text: "\"Why does it matter this much to you?\"" },
        { say: "inya", text: "\"Because he doesn't think I'm worth a game.\" Fast, flat. \"I've been standing here since before you came down. I could have been somewhere else.\"" },
        { say: "inya", text: "\"But if I leave now he's won already. Even if I never sit down.\"" },
        AFF("inya", 2, "Asked why"),
        { flag: "inya_explained" },
        { choice: [
          { text: "\"He wouldn't have won much. An empty table.\"", steps: [
            { say: "rowan", text: "\"He wouldn't have won much. An empty table.\"" },
            { say: "inya", text: "\"An empty table is what he *likes*. Look at him. He's been squaring that deck all morning as if it were a pet.\"" },
            { text: "A breath. Something at the corner of her mouth." },
            { say: "inya", text: "\"…That was almost funny. Don't tell me it was funny.\"" }
          ] },
          { text: "\"That's a long time to hold a deck box that tight.\"", steps: [
            { say: "rowan", text: "\"That's a long time to hold a deck box that tight.\"" },
            { say: "inya", text: "\"I'm not —\"" },
            { text: "She looks down at her hands, and loosens them, one finger at a time." },
            { say: "inya", text: "\"…It's a good box. It doesn't mind.\"" },
            AFF("inya", 1, "Noticed, didn't fuss")
          ] },
          { text: "\"Then I'll keep you company while you don't leave.\"", steps: [
            { say: "rowan", text: "\"Then I'll keep you company while you don't leave.\"" },
            { text: "She glances at you sideways, then back at the table." },
            { say: "inya", text: "\"That's a strange thing to offer.\" A beat. \"…Stand on the left. I shuffle on the right.\"" },
            AFF("inya", 1, "Kept her company")
          ] }
        ] }
      ] },
      { text: "\"He never attacks first. If you ever get your game, make him come to you.\"", when: (s)=>!!s.flags["saw_counter"] && !s.flags["inya_has_tip"], steps: [
        { say: "rowan", text: "\"He never attacks first. If you ever get your game, make him come to you.\"" },
        { say: "inya", text: "\"Say that again.\"" },
        { say: "rowan", text: "\"Every game at that table has gone the same way. He sets his wall and waits for you to commit. If you don't commit, he has nothing to counter with.\"" },
        { say: "inya", text: "\"So I wait him out.\" Her face rearranges itself. \"So I make him come to me.\"" },
        { flag: "inya_has_tip" },
        AFF("inya", 3, "Gave her the key")
      ] },
      { text: "\"Tell me a bit about you, while we're both waiting.\"", when: (s)=>!s.flags["chat_inya_done"], steps: [
        { say: "rowan", text: "\"Tell me a bit about you, while we're both waiting.\"" },
        { scene: "chat_inya" }
      ] },
      { text: "\"I'll be nearby if you need me.\"", steps: [
        { say: "rowan", text: "\"I'll be nearby if you need me.\"" },
        { say: "inya", text: "\"I won't.\"" }
      ] }
    ] },
    { jump: "end" },

    { label: "outcome" },
    { when: (s)=>!s.flags["inya_after_said"], jump: "tell" },
    { say: "inya", text: "\"Rowan.\"" },
    { jump: "after" },
    { label: "tell" },
    { flag: "inya_after_said" },
    { when: (s)=>!!s.flags["ferry_inya_won"], jump: "o_won" },
    { when: (s)=>!!s.flags["ferry_table_settled"], jump: "o_settled" },
    { when: (s)=>!!s.flags["ferry_table_won"], jump: "o_rwon" },
    { when: (s)=>!!s.flags["ferry_table_lost"], jump: "o_rlost" },
    { when: (s)=>!!s.flags["ferry_table_denied"], jump: "o_denied" },
    { say: "inya", text: "\"I lost.\" Flatly. \"I attacked first and he — I'm going to carry four cases up the avenue.\"" },
    { say: "inya", text: "\"Don't say anything nice about it. I'll cry, and I don't have time.\"" },
    { jump: "after" },
    { label: "o_won" },
    { say: "inya", text: "\"I won.\"" },
    { text: "She says it as if testing whether it is true." },
    { say: "inya", text: "\"I WON. Four cases, and he's got to carry them, and — you told me. You told me how.\"" },
    { say: "rowan", text: "\"You waited. That was the hard part.\"" },
    { say: "inya", text: "\"Rude. Accurate, but rude.\" A tiny, fierce grin. \"Thank you.\"" },
    AFF("inya", 2, "Glad you helped"),
    { jump: "after" },
    { label: "o_settled" },
    { say: "inya", text: "\"A bench and a bag and a game for nothing. And I got a real game out of him.\" She is still half-disbelieving. \"Thank you. Don't tell anyone I said so.\"" },
    { jump: "after" },
    { label: "o_rwon" },
    { say: "inya", text: "\"You played him.\"" },
    { text: "She is looking at you very hard." },
    { say: "inya", text: "\"And then you beat him.\"" },
    { say: "inya", text: "\"I'd have lost. I know I'd have lost. Don't let me win next time. If you let me win I'll know.\"" },
    { jump: "after" },
    { label: "o_rlost" },
    { say: "inya", text: "\"You're going to carry the four cases.\" Quietly. \"I'll go with you to the tower door. It's the least.\"" },
    { jump: "after" },
    { label: "o_denied" },
    { say: "inya", text: "\"He never played me.\" Flat. \"I'm fine. Don't say anything nice.\"" },
    { label: "after" },
    { choice: [
      { text: "\"Can I ask you something, Inya?\"", when: (s)=>!s.flags["chat_inya_done"], steps: [
        { say: "rowan", text: "\"Can I ask you something, Inya?\"" },
        { scene: "chat_inya" }
      ] },
      { text: "\"Do you want a game? Loser buys the rolls.\"", when: (s)=>((s.coins||0)>=6) && !s.flags["flag_inya_played"], steps: [
        { say: "rowan", text: "\"Do you want a game? Loser buys the rolls.\"" },
        { say: "inya", text: "\"Six Smug Coins. Loser pays.\"" },
        { text: "The amber eyes light up with pure, undiluted competition." },
        { say: "inya", text: "\"Yes. On a bench. Right now.\"" },
        { scene: "inya_rematch" }
      ] },
      { text: "\"Another time. I'm glad I met you.\"", steps: [
        { say: "rowan", text: "\"Another time. I'm glad I met you.\"" },
        { say: "inya", text: "\"Another time. Don't forget.\"" }
      ] }
    ] },
    { label: "end" },
    { time: 8 }
  ]
});

scene("chat_inya", {
  steps: [
    { label: "top" },
    { when: (s)=>!(!!s.flags["chat_inya_1"] && !!s.flags["chat_inya_2"] && !!s.flags["chat_inya_3"] && !!s.flags["chat_inya_x"] && (!!s.flags["deck_known_inya"] || !!s.flags["deck_skipped_inya"])), jump: "ask" },
    { flag: "chat_inya_done" },
    { say: "inya", text: "\"Okay. That's enough. That was — that was more than I usually say to people.\" A narrow, fierce look. \"Don't make it weird.\"" },
    { end: true },
    { label: "ask" },
    { choice: [
      { text: "\"The clip, the charm on the box. Is it only the cards, or are there real rabbits somewhere?\"", when: (s)=>!s.flags["chat_inya_1"], steps: [
        { say: "rowan", text: "\"The clip, the charm on the box. Is it only the cards, or are there real rabbits somewhere?\"" },
        { say: "inya", text: "\"…Rabbits.\"" },
        { text: "The amber eyes light up all at once, like a switch." },
        { say: "inya", text: "\"Nine, at home. Two lops, five spotted ones, a dwarf who's a menace, and Colonel.\"" },
        { say: "rowan", text: "\"Colonel?\"" },
        { say: "inya", text: "\"A Giant. Fifteen pounds. He isn't a rabbit, he's a *statement*. He sits on my feet when I study.\" A breath. \"I can list every breed by ear length. Do you want to hear it?\"" },
        { choice: [
          { text: "\"Not all of it. Maybe the top three.\"", steps: [
            { say: "rowan", text: "\"Not all of it. Maybe the top three.\"" },
            { say: "inya", text: "\"Giant, Great Lop, Common Lop.\" Very fast. \"Ears, in that order. You listened. That's — fine.\"" },
            AFF("inya", 2, "Asked about the rabbits")
          ] },
          { text: "\"All of it. I've got time.\"", steps: [
            { say: "rowan", text: "\"All of it. I've got time.\"" },
            { say: "inya", text: "\"Giant, Great Lop, Common Lop, the half-lops, which people get wrong, the —\"" },
            { text: "She stops. She looks at you the way she would look at an opponent's opening hand." },
            { say: "inya", text: "\"You're serious. Nobody's serious.\" A beat. \"It takes eleven minutes and I do it properly or not at all. Later. I'm holding you to it.\"" },
            AFF("inya", 3, "Wanted the whole list")
          ] },
          { text: "\"Who's looking after nine rabbits while you're away?\"", steps: [
            { say: "rowan", text: "\"Who's looking after nine rabbits while you're away?\"" },
            { say: "inya", text: "\"A neighbour. With a list.\" Flat, brisk. \"Laminated. Two pages. Colonel has his own page.\"" },
            { say: "inya", text: "\"He doesn't eat properly for four days when I go anywhere. Then he forgives me.\" She says it to the deck box. \"It's fine. It's four days.\"" },
            AFF("inya", 3, "Asked who feeds them")
          ] }
        ] },
        { flag: "chat_inya_1" },
        NOTE("inya", "Keeps nine rabbits at home, including a fifteen-pound one called Colonel."),
        { time: 2 },
      ] },
      { text: "\"First day, and you already look as if you're keeping score. What are you here for?\"", when: (s)=>!s.flags["chat_inya_2"], steps: [
        { say: "rowan", text: "\"First day, and you already look as if you're keeping score. What are you here for?\"" },
        { say: "inya", text: "\"A pro seat.\" No hesitation. \"Not a favour. Not somebody's. *Earned.* I'm going to win it with the cards I've got, in my own name.\"" },
        { choice: [
          { text: "\"Your own name?\"", steps: [
            { say: "rowan", text: "\"Your own name?\"" },
            { say: "inya", text: "\"It's — a figure of speech.\" Fast and flat. \"I want the seat to be mine. That's all.\"" }
          ] },
          { text: "\"Earned how? By beating people like the one in the white gloves?\"", when: (s)=>!!s.flags["lounge_seen"] && !s.flags["ferry_inya_won"], steps: [
            { say: "rowan", text: "\"Earned how? By beating people like the one in the white gloves?\"" },
            { say: "inya", text: "\"By beating everyone. In order.\" She counts it off on the edge of the deck box. \"He's only first because he was rude about it.\"" },
            { say: "inya", text: "\"You're on the list too. Don't look like that, it's a compliment.\"" }
          ] },
          { text: "\"That's a lot to want on a first day.\"", steps: [
            { say: "rowan", text: "\"That's a lot to want on a first day.\"" },
            { say: "inya", text: "\"I wanted it before the boat. I wanted it before the *letter*.\" The chin comes up. \"If you only start wanting things when you get there, somebody else already has them.\"" }
          ] }
        ] },
        AFF("inya", 2, "Asked what she wanted"),
        { flag: "chat_inya_2" },
        NOTE("inya", "Wants a pro seat she earned herself."),
        { time: 2 },
      ] },
      { text: "\"You hate losing more than anyone I've met today. What do you do when it happens?\"", when: (s)=>!s.flags["chat_inya_3"], steps: [
        { say: "rowan", text: "\"You hate losing more than anyone I've met today. What do you do when it happens?\"" },
        { say: "inya", text: "\"Write it down.\"" },
        { text: "She does not look at you." },
        { say: "inya", text: "\"Every loss. One line, what I should have done. Four notebooks. I read them on the way to bed.\"" },
        { say: "rowan", text: "\"Does it help?\"" },
        { say: "inya", text: "\"It's not supposed to *help*. It's supposed to *stay*.\"" },
        { choice: [
          { text: "\"I replay mine in my head. Yours sounds tidier.\"", steps: [
            { say: "rowan", text: "\"I replay mine in my head. Yours sounds tidier.\"" },
            { say: "inya", text: "\"…You do it too.\" She looks at you properly, for about a second. \"In your head's worse. In your head they change.\"" }
          ] },
          { text: "\"What's the newest line?\"", when: (s)=>!!s.flags["lounge_seen"] && !s.flags["rowan_beat_inya"] && !s.flags["ferry_inya_lost"] && !s.flags["ferry_table_settled"], steps: [
            { say: "rowan", text: "\"What's the newest line?\"" },
            { say: "inya", text: "\"'Don't tell a room who you've beaten until you've checked who they were.'\" Flat as a ruler. \"This morning's. It's not even a game and it's going in.\"" }
          ] },
          { text: "Say nothing. Let it stay.", steps: [
            { text: "You say nothing. After a moment her shoulders come down by about an inch." }
          ] }
        ] },
        { when: (s)=>!!s.flags["met_tomi"], say: "inya", text: "\"Don't tell Tomi. He'd put odds on it.\"" },
        { when: (s)=>!s.flags["met_tomi"], say: "inya", text: "\"Don't tell the one with the binder. He'd put odds on it.\"" },
        AFF("inya", 3, "Didn't laugh"),
        { flag: "chat_inya_3" },
        NOTE("inya", "Writes down every loss, with one line on what she should have done."),
        { time: 2 },
      ] },
      { text: "\"Does Colonel have anything to do with how you play?\"", when: (s)=>!s.flags["chat_inya_x"] && !!s.flags["chat_inya_1"], steps: [
        { say: "rowan", text: "\"Does Colonel have anything to do with how you play?\"" },
        { say: "inya", text: "\"…\"" },
        { text: "She stares at you with enormous suspicion." },
        { say: "inya", text: "\"Why.\"" },
        { say: "rowan", text: "\"Because the clip and the charm go everywhere the deck goes.\"" },
        { say: "inya", text: "\"…Colonel sits on my deck box. At home.\" Fast, flat, reluctant. \"It's a strategy. If he's sitting on it, I'm not shuffling. If I'm not shuffling, I'm thinking.\"" },
        { say: "inya", text: "\"I do my best thinking with fifteen pounds of rabbit on a box of cards.\" A beat. \"Don't put it in a book.\"" },
        { choice: [
          { text: "\"So who sits on the box this year?\"", steps: [
            { say: "rowan", text: "\"So who sits on the box this year?\"" },
            { say: "inya", text: "\"Nobody. That's —\" She stops. \"I hadn't — I brought the clip.\"" },
            { text: "She touches it, once, as if checking it is still there." },
            { say: "inya", text: "\"The clip isn't fifteen pounds. I'll think lighter. Shut up.\"" },
            AFF("inya", 1, "Saw what she left behind")
          ] },
          { text: "\"It's a better system than mine. I just don't sleep.\"", steps: [
            { say: "rowan", text: "\"It's a better system than mine. I just don't sleep.\"" },
            { say: "inya", text: "\"That isn't a system, that's a symptom.\" Instantly. Then, grudging: \"…Get a rabbit. I'm serious. A small one. Work up.\"" },
            AFF("inya", 1, "Compared notes")
          ] }
        ] },
        AFF("inya", 2, "Took the rabbits seriously"),
        { flag: "chat_inya_x" },
        NOTE("inya", "Does her best thinking with a rabbit sitting on her deck box."),
        { time: 2 },
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_inya"], steps: [
        { scene: "deck_inya" },
      ] },
      { text: "\"I'll leave you to it. Good talking to you, Inya.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to it. Good talking to you, Inya.\"" },
        { when: (s)=>!!s.flags["inya_yielded"] && !s.flags["flag_inya_played"], say: "inya", text: "\"Don't forget about the real game. I mean it.\"" },
        { when: (s)=>!(!!s.flags["inya_yielded"] && !s.flags["flag_inya_played"]), say: "inya", text: "\"Okay.\" A beat. \"You know where I am.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("deck_inya", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_inya"], end: true },
    { choice: [
      { text: "\"Bunny hairclip, a bunny charm on the deck box. I'm going to guess a pile of bunnies.\"", hint: "From her look", when: (s)=>!s.flags["inya_said_bunnies"] && !(!!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), steps: [
        { say: "rowan", text: "\"Bunny hairclip, a bunny charm on the deck box. I'm going to guess a pile of bunnies.\"" },
        { say: "inya", text: "\"It is *not* a pile.\" Instantly. \"Hop and Pop. It's a deck. There's a plan.\"" },
        AFF("inya", 2, "Spotted the bunnies")
      ] },
      { text: "\"What do you play, Inya? I won't say a word about the clip.\"", when: (s)=>!s.flags["inya_said_bunnies"] && !(!!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), steps: [
        { say: "rowan", text: "\"What do you play, Inya? I won't say a word about the clip.\"" },
        { say: "inya", text: "\"Hop and Pop. Bunnies.\" A narrow look. \"You promised.\"" },
        AFF("inya", 1, "Asked about her deck")
      ] },
      { text: "\"I've sat across from it now. Has the deck got a name?\"", when: (s)=>(!!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), steps: [
        { say: "rowan", text: "\"I've sat across from it now. Has the deck got a name?\"" },
        { say: "inya", text: "\"Hop and Pop.\" A narrow look. \"It's a deck. There's a plan. You've met the plan.\"" },
        AFF("inya", 1, "Asked about her deck")
      ] },
      { text: "\"You said bunnies. What's the plan?\"", when: (s)=>!!s.flags["inya_said_bunnies"] && !(!!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), steps: [
        { say: "rowan", text: "\"You said bunnies. What's the plan?\"" },
        { say: "inya", text: "\"Hop and Pop. It's a deck.\" A narrow look. \"There's a plan. Don't say 'pile'.\"" },
        AFF("inya", 1, "Asked about her deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_inya" },
        { end: true }
      ] }
    ] },
    { text: "Your eyes have unfocused. Your voice runs on under your breath." },
    { say: "rowan", text: "\"…Bubbles soaks the hits. Cute Bunny, Cheering Rabbit, Town Guard, wide and cheap. Haressassins shoot from the turn after they land. Bunny Bombs ticking in the back, and she picks when it goes. Deepsea Idol and Thicket for cover.\" A pause. \"Fast. Thin. Bubbles falls, everything falls.\"" },
    { say: "inya", text: "\"…\"" },
    { text: "She looks at you for a long moment." },
    { say: "inya", text: "\"Who told you about Bubbles.\"" },
    { say: "rowan", text: "\"Nobody. It's the whole deck.\"" },
    { say: "inya", text: "\"Rude.\" Quietly, delighted. \"Accurate. But rude.\"" },
    AFF("inya", 1, "Understood the plan"),
    DECK("inya"),
    { flag: "deck_known_inya" }
  ]
});

scene("post_inya", {
  steps: [
    DECK("inya"),
    { flag: "deck_known_inya" },
    { when: (s)=>!(s.duels["ferry_inya"]==="won"), jump: "lost" },
    { text: "She does not get far. On the bench by the galley the cards are still laid out under the coffee cup, and Inya stops and looks at the board for a long time. Her last bunny is still on it." },
    { say: "inya", text: "\"I should have set off the Bomb on turn five.\"" },
    { say: "rowan", text: "\"You waited because you wanted to see whether I'd kill Bubbles. I didn't, and that was the mistake.\"" },
    { say: "inya", text: "\"Don't be nice.\" Quick, sharp, almost cheerful. \"You attacked the Haressassins instead of the hero. They're my whole clock.\"" },
    { say: "rowan", text: "\"They were the only part of it I could actually reach.\"" },
    { text: "She takes a pencil stub out of the hoodie pocket and writes one line on the back of her hand, because the notebook is in her bag. She does not show it to you." },
    { jump: "done" },
    { label: "lost" },
    { text: "She does not get far. On the bench by the galley the cards are still laid out under the coffee cup, and Inya's bunnies are scattered across the board in an enormous, happy mess." },
    { say: "inya", text: "\"That was *my* turn five. You kept the Bomb ticking and you didn't set it off, and it took three of your heroes down with it.\"" },
    { say: "rowan", text: "\"I tried to wait you out. You didn't blink.\"" },
    { say: "inya", text: "\"Rabbits turn ninety degrees at full speed.\"" },
    { text: "Pointed, and very pleased with herself." },
    { say: "inya", text: "\"Name one of your storm clouds that can do that.\"" },
    { label: "done" },
    AFF("inya", 1, "Talked it through")
  ]
});

scene("ferry_tomi", {
  steps: [
    { when: (s)=>!!s.flags["met_tomi"], jump: "again" },
    { text: "He is small and quick, a yellow bandana knotted over spiky black hair, a canvas bag of binders at his hip. He has the cheerful, unhurried eyes of someone who is already counting what you have in your pockets." },
    { text: "He is sitting on the back of a bench rather than the seat, so that he can see the whole saloon at once. A pencil is tucked behind one ear. Another is in his hand. A third, you suspect, is somewhere about his person." },
    { text: "On his knee lies a binder, open to a page of tight columns of names and figures. People keep leaning in, whispering, and leaning out again, having parted with something." },
    { when: (s)=>!!s.flags["ship_knows_wildcard"], say: "tomi", alias: "Boy in a yellow bandana", text: "\"Wildcard! Wildcard Vance. Don't look at me like that, the whole ship's talking. I only wrote it down.\"" },
    { when: (s)=>!s.flags["ship_knows_wildcard"], say: "tomi", alias: "Boy in a yellow bandana", text: "\"Hey. New face. You're the jacketless one, am I right? That makes you the ink name.\"" },
    { say: "tomi", alias: "Boy in a yellow bandana", text: "\"Tomás Reyes. Tomi. I run the book.\"" },
    MET("tomi", "Tomás Reyes"),
    NOTE("tomi", "Runs the betting book on the ship. Everything has a friend price."),
    { text: "A girl in a blue collar leans in, murmurs, and leaves two coins on the open page. They are gone before she has straightened up." },
    { when: (s)=>!s.flags["table_resolved"], say: "tomi", text: "\"Two on 'sits down before ten'. Bold.\" The pencil moves. \"You're a market this morning, you know that? There's a line on whether you sit at that table, and a line on who walks off this boat carrying somebody else's luggage.\"" },
    { when: (s)=>!!s.flags["table_resolved"], say: "tomi", text: "\"Two on 'has his jacket by noon'. Bold.\" The pencil moves. \"You're a market this morning, you know that? The table's closed and the book on it is paid, and they still want a line on you.\"" },
    { choice: [
      { text: "\"You opened a book on me before I'd reached the bottom of the stairs.\"", when: (s)=>!!s.flags["rowan_singled_out"], steps: [
        { say: "rowan", text: "\"You opened a book on me before I'd reached the bottom of the stairs.\"" },
        { say: "tomi", text: "\"Everybody in this room was going to bet on you anyway.\" Easily. \"The only question was whether somebody kept it honest.\"" },
        { say: "rowan", text: "\"And that's you.\"" },
        { say: "tomi", text: "\"Written down, both sides, paid at the dock. Cheating's bad business. You only get to do it once.\"" },
        AFF("tomi", 1, "Asked who keeps it honest"),
        { flag: "tomi_honest" }
      ] },
      { text: "\"What are the odds I sit down, out of curiosity?\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"What are the odds I sit down, out of curiosity?\"" },
        { flag: "tomi_quoted_odds" },
        { say: "tomi", text: "\"Even money. And even money that you don't throw up on the felt if you do. I've got ten of my own on you, both ways up.\"" },
        { say: "rowan", text: "\"You've bet on me.\"" },
        { say: "tomi", text: "\"I've bet on *everyone*. It's the only way to make sure I'm always right about somebody.\" He grins. \"It's a very lonely system.\"" },
        AFF("tomi", 1, "Played along")
      ] },
      { text: "\"I'm not sure I'm ready to be a market.\"", steps: [
        { say: "rowan", text: "\"I'm not sure I'm ready to be a market.\"" },
        { when: (s)=>!!s.flags["rowan_singled_out"], say: "tomi", text: "\"Fair.\" The pencil stops, which seems to be rare. \"Here's the rule. I price what's public. He pointed, the room looked, that's public. What you tell me yourself is inventory, and I don't trade yours for free.\"" },
        { when: (s)=>!s.flags["rowan_singled_out"], say: "tomi", text: "\"Fair.\" The pencil stops, which seems to be rare. \"Here's the rule. I price what's public. A name in ink on a list by a door, that's public. What you tell me yourself is inventory, and I don't trade yours for free.\"" },
        { say: "rowan", text: "\"That's reassuring. I think.\"" },
        { say: "tomi", text: "\"It's not meant to be reassuring. It's meant to be *accurate*.\"" },
        AFF("tomi", 2, "Was straight about it")
      ] }
    ] },
    { text: "From the end of the bench nearest the card table, a voice like a ruler laid on a desk:" },
    { say: "anni", alias: "Girl with a red pen", text: "\"That is a betting pool. Aboard a school vessel. It is being noted.\"" },
    { say: "tomi", text: "\"Noted's fine! Noted's free!\" He waves the pencil at a very straight-backed girl in a black jacket, who does not wave back. \"She's been noting me since the harbour. I've got four to one on which paragraph I am. She won't take it.\"" },
    { flag: "tomi_anni_odds" },
    { say: "tomi", text: "\"Now. Professional question. One duffel, a rain jacket, and a starter pouch same as everybody's. What do you do with a pouch, Wildcard?\"" },
    { choice: [
      { text: "\"Keep it shut, mostly.\"", steps: [
        { say: "rowan", text: "\"Keep it shut, mostly.\"" },
        { say: "tomi", text: "\"A saver.\" He says it kindly, the way one names an illness. \"I can't make a living off savers. I respect you all enormously. I just can't eat.\"" }
      ] },
      { text: "\"Depends what you're selling.\"", steps: [
        { say: "rowan", text: "\"Depends what you're selling.\"" },
        { say: "tomi", text: "\"*Now* we're talking.\" He pats the canvas bag. \"Sleeves. Singles. Odds. And whatever I've heard since the harbour, which is plenty.\"" },
        AFF("tomi", 1, "Talked business")
      ] },
      { text: "\"You tell me. What's actually worth buying on a boat?\"", steps: [
        { say: "rowan", text: "\"You tell me. What's actually worth buying on a boat?\"" },
        { say: "tomi", text: "\"*Actually* worth?\"" },
        { text: "The patter stops. He looks at you as if you had asked for the one thing he keeps under the counter." },
        { say: "tomi", text: "\"Coffee. That's it. Everything else is cheaper on the island by Friday.\" He lowers his voice. \"Don't tell my customers.\"" },
        AFF("tomi", 2, "Asked what it's really worth")
      ] }
    ] },
    { say: "tomi", text: "\"You do need sleeves, though. Friend price. Everybody's a friend, the price is the price.\"" },
    { say: "tomi", text: "\"Smug Coins only, by the way. Mainland money is wallpaper out here.\"" },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"He's got a BINDER! Baylee! BINDER!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"He's also got a book on us.\"" },
    { add: { ferry_talked: 1 } },
    { time: 6 },
    { jump: "menu" },

    { label: "again" },
    { when: (s)=>!s.flags["table_resolved"], say: "tomi", text: "\"Wildcard! Business?\"" },
    { when: (s)=>!!s.flags["table_resolved"], say: "tomi", text: "\"Wildcard!\" He is counting coins into the lid of the binder, in stacks of five, without looking at them. \"Business?\"" },
    { label: "menu" },
    { choice: [
      { text: "\"What's the book on the table?\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"What's the book on the table?\"" },
        { flag: "tomi_quoted_odds" },
        { when: (s)=>!s.flags["bet_gideon"] && !s.flags["bet_inya"], say: "tomi", text: "\"Gideon three and oh. The girl's the longshot, and she's getting longer. Ten-coin limit, even money. You in?\"" },
        { when: (s)=>!!s.flags["bet_gideon"], say: "tomi", text: "\"Gideon three and oh, the girl's still the longshot, and you're down for ten on Gideon. One bet a head. I don't take seconds.\"" },
        { when: (s)=>!!s.flags["bet_inya"], say: "tomi", text: "\"Gideon three and oh, the girl's still the longshot, and you're down for ten against him. One bet a head. I don't take seconds.\"" },
        { choice: [
          { text: "Put ten Smug Coins on Gideon.", when: (s)=>((s.coins||0)>=10) && !s.flags["bet_gideon"] && !s.flags["bet_inya"], steps: [
            { coins: -10 },
            { flag: "bet_gideon" },
            { say: "tomi", text: "\"Smart. Boring, but smart.\"" },
            { text: "He writes it in the lid of the binder, a neat little line of numbers." }
          ] },
          { text: "Put ten Smug Coins on whoever beats Gideon.", when: (s)=>((s.coins||0)>=10) && !s.flags["bet_gideon"] && !s.flags["bet_inya"], steps: [
            { coins: -10 },
            { flag: "bet_inya" },
            { say: "tomi", text: "\"Heart over head. I respect that. I'll be sad to take it.\"" },
            { text: "He writes it in the lid of the binder, and underlines it, which he did not do for anyone else." }
          ] },
          { text: "\"Who's actually betting on her?\"", when: (s)=>!s.flags["tomi_asked_longshot"], steps: [
            { say: "rowan", text: "\"Who's actually betting on her?\"" },
            { flag: "tomi_asked_longshot" },
            { say: "tomi", text: "\"Four people. Three of them just don't like him.\" He turns the page to check. \"The fourth one's me, for two coins, off the book. Grey collar. I can't not.\"" },
            { say: "rowan", text: "\"You bet against your own odds.\"" },
            { say: "tomi", text: "\"I set the odds with my head. The two coins are from somewhere else. Don't write that down.\"" },
            AFF("tomi", 1, "Asked who backs her")
          ] },
          { text: "Leave the book alone.", when: (s)=>!s.flags["bet_gideon"] && !s.flags["bet_inya"], steps: [
            { say: "tomi", text: "\"Smart. Or poor. Same thing, on a boat.\"" }
          ] },
          { text: "\"Fair enough. Let it ride.\"", when: (s)=>!!s.flags["bet_gideon"] || !!s.flags["bet_inya"], steps: [
            { say: "rowan", text: "\"Fair enough. Let it ride.\"" },
            { say: "tomi", text: "\"It's in the lid. In pencil, but the good pencil.\"" }
          ] }
        ] },
        Object.assign(AFF("tomi", 1, "Did business"), { when: (s)=>!s.flags["tomi_book_asked"] }),
        { flag: "tomi_book_asked" }
      ] },
      { text: "\"You write down every game at that table. What have you got on him?\"", when: (s)=>!s.flags["saw_counter"] && !s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"You write down every game at that table. What have you got on him?\"" },
        { say: "tomi", text: "\"On Pryce? Plenty. I don't set a line on a man without watching his hands first.\"" },
        { say: "tomi", text: "\"Three Smug Coins and it's yours.\"" },
        { choice: [
          { text: "Pay him three Smug Coins.", when: (s)=>((s.coins||0)>=3), steps: [
            { coins: -3 },
            { say: "tomi", text: "\"Never attacks first. Sets his wall and waits. Counter-swing, every game, three for three. If you want to beat him you've got to out-wait him. Which nobody's done, because nobody can stand it.\"" },
            { flag: "saw_counter" },
            { say: "rowan", text: "\"Nobody can stand it?\"" },
            { say: "tomi", text: "\"Sit across from a guy who does nothing, politely, for six turns, with a room breathing on your neck.\" He shudders, cheerfully. \"You'd swing. *I'd* swing, and I'm the one who sold you the tip.\"" },
            AFF("tomi", 2, "Paid fair")
          ] },
          { text: "Say no thanks.", steps: [
            { say: "rowan", text: "\"No, thanks.\"" },
            { say: "tomi", text: "\"Offer stands. For as long as I'm in this room.\"" }
          ] }
        ] }
      ] },
      { text: "\"How did the book go?\"", when: (s)=>!!s.flags["table_resolved"] && !s.flags["tomi_book_closed"], steps: [
        { say: "rowan", text: "\"How did the book go?\"" },
        { flag: "tomi_book_closed" },
        { when: (s)=>!!s.flags["bet_gideon"] && (!!s.flags["ferry_table_lost"] || !!s.flags["ferry_inya_lost"]), say: "tomi", text: "\"Gideon came through, as written. You've had your twenty.\" He taps the binder lid. \"Don't hold your hand out twice, I count.\"" },
        { when: (s)=>!!s.flags["bet_inya"] && (!!s.flags["ferry_inya_won"] || !!s.flags["ferry_table_won"]), say: "tomi", text: "\"Against Gideon is against Gideon, whoever does it. Your bet came in, and you've been paid. I'm a poorer man, but a happier one.\"" },
        { when: (s)=>(!!s.flags["bet_gideon"] || !!s.flags["bet_inya"]) && (!!s.flags["ferry_table_settled"] || !!s.flags["ferry_table_denied"]), say: "tomi", text: "\"No result, no money. All bets void. I gave everyone their ten back with a hurt look. You got yours.\"" },
        { when: (s)=>(!!s.flags["bet_gideon"] && (!!s.flags["ferry_inya_won"] || !!s.flags["ferry_table_won"])) || (!!s.flags["bet_inya"] && (!!s.flags["ferry_table_lost"] || !!s.flags["ferry_inya_lost"])), say: "tomi", text: "\"Didn't go your way. I pay the winners first and feel bad second. I'm on feeling bad now.\"" },
        { when: (s)=>!s.flags["bet_gideon"] && !s.flags["bet_inya"] && (!!s.flags["ferry_table_lost"] || !!s.flags["ferry_inya_lost"]), say: "tomi", text: "\"House did fine. Gideon came in and the romantics paid. I'd feel worse if I hadn't told them the odds to their faces.\"" },
        { when: (s)=>!s.flags["bet_gideon"] && !s.flags["bet_inya"] && (!!s.flags["ferry_inya_won"] || !!s.flags["ferry_table_won"]), say: "tomi", text: "\"The longshot side came in and cleaned me out.\" He sounds delighted. \"Worst book I ever ran. Best morning I've had.\"" },
        { when: (s)=>!s.flags["bet_gideon"] && !s.flags["bet_inya"] && (!!s.flags["ferry_table_settled"] || !!s.flags["ferry_table_denied"]), say: "tomi", text: "\"Void. Every coin back where it came from. A whole morning's arithmetic, robbed by a total absence of events.\"" },
        { when: (s)=>!!s.flags["rowan_singled_out"], say: "rowan", text: "\"And the line on me sitting down?\"" },
        { when: (s)=>!!s.flags["rowan_singled_out"] && (!!s.flags["ferry_table_won"] || !!s.flags["ferry_table_lost"] || !!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), say: "tomi", text: "\"Paid. You sat.\" He salutes you with the pencil. \"I had ten on that. You're the only investment on this boat that's come good.\"" },
        { when: (s)=>!!s.flags["rowan_singled_out"] && !(!!s.flags["ferry_table_won"] || !!s.flags["ferry_table_lost"] || !!s.flags["rowan_beat_inya"] || !!s.flags["rowan_lost_to_inya"]), say: "tomi", text: "\"You never sat at it. Cost me ten.\" He shrugs, without rancour. \"I don't hold it against the horse.\"" }
      ] },
      { text: "\"Could I look through one of those binders?\"", steps: [
        { say: "rowan", text: "\"Could I look through one of those binders?\"" },
        { text: "He pulls one out of the canvas bag and turns it round on his knee. Every sleeve holds a card, every card has a price in pencil, and every price has been crossed out and rewritten at least once." },
        { say: "tomi", text: "\"Look with your eyes. The prices are in pencil for a reason.\"" },
        { choice: [
          { text: "\"Why is every price crossed out and written again?\"", steps: [
            { say: "rowan", text: "\"Why is every price crossed out and written again?\"" },
            { say: "tomi", text: "\"Because a price isn't a thing that *is*. It's a thing that happened.\" He taps a rare in a sleeve of its own. \"That was nine at the harbour. Then a tower kid asked for it by name. Now it's twelve.\"" },
            { say: "rowan", text: "\"And if I ask for it by name?\"" },
            { say: "tomi", text: "\"Then it's twelve, and you get the sleeve.\"" }
          ] },
          { text: "Point at one. \"What's that really worth?\"", steps: [
            { text: "You point at a card with a seven pencilled under it." },
            { say: "rowan", text: "\"What's that really worth?\"" },
            { say: "tomi", text: "\"Really?\" The patter drops out of his voice. \"Four. It says seven because somebody'll pay seven, and I'm not somebody's mother.\"" },
            { say: "tomi", text: "\"…Don't buy that one.\"" },
            Object.assign(AFF("tomi", 2, "Asked the real price"), { when: (s)=>!s.flags["tomi_binder_aff"] }),
            { flag: "tomi_binder_aff" }
          ] },
          { text: "\"Where would mine go in here?\" Take out your deck.", when: (s)=>!s.flags["tomi_saw_print"], steps: [
            { say: "rowan", text: "\"Where would mine go in here?\"" },
            { text: "You put the deck box on the open page. He flicks the lid up with the pencil, looks at the top card, riffles the edges once with his thumb, and listens to them like a man buying a melon." },
            { say: "tomi", text: "\"Commons. All of them. And so new they squeak.\" He closes the lid. \"That's the Qualifier print, that is. They do the winning list in Commons so nobody can flip the prize for rent.\"" },
            { when: (s)=>!!s.flags["rowan_commons_seen"], say: "rowan", text: "\"Everyone's going to tell me that, aren't they.\"" },
            { when: (s)=>!!s.flags["rowan_commons_seen"], say: "tomi", text: "\"Everyone who can count. Then they'll all go quiet the first time it hits them.\"" },
            { say: "tomi", text: "\"Where would it go? Back pages. Coin a card on a friendly day, and nobody's ever bought a Tea from me in their life.\" He slides the box back across. \"In a binder it's worth nothing. On a table it's worth a seat at this school. I don't sell those. I'd not know where to start the price.\"" },
            { choice: [
              { text: "\"Then I'll keep it out of your binder.\"", steps: [
                { say: "rowan", text: "\"Then I'll keep it out of your binder.\"" },
                { say: "tomi", text: "\"Smart. That's also why I keep saying sleeves, by the way. Brand-new cardboard and a nervous shuffle, I've seen how that ends. It's not only patter. It's *mostly* patter.\"" }
              ] },
              { text: "\"You'd have bought the seat, though. If it was for sale.\"", steps: [
                { say: "rowan", text: "\"You'd have bought the seat, though. If it was for sale.\"" },
                { say: "tomi", text: "\"Wildcard, I'd have *sold* it. Three times. To three different people.\" The grin. Then, a shade less of it: \"No. I'd have bought it. Don't write that down.\"" },
                AFF("tomi", 1, "Asked what he'd want")
              ] }
            ] },
            NOTE("tomi", "Says your all-Commons prize print is worth nothing in a binder and a seat at the Academy on a table."),
            { flag: "tomi_saw_print" },
            { flag: "rowan_commons_seen" }
          ] },
          { text: "Close it again. Only looking.", steps: [
            { say: "rowan", text: "\"Only looking.\"" },
            { say: "tomi", text: "\"Looking's free. It's the only thing on this bench that is.\"" }
          ] }
        ] }
      ] },
      { text: "Sit down on the bench and talk a while.", when: (s)=>!s.flags["chat_tomi_done"], steps: [
        { scene: "chat_tomi" }
      ] },
      { text: "Leave him to it.", steps: [
        { say: "tomi", text: "\"Come back when you've got something to trade. Or a bet.\"" }
      ] }
    ] },
    { time: 6 }
  ]
});

scene("chat_tomi", {
  steps: [
    { label: "top" },
    { when: (s)=>!(!!s.flags["chat_tomi_1"] && !!s.flags["chat_tomi_2"] && !!s.flags["chat_tomi_3"] && !!s.flags["chat_tomi_x"] && (!!s.flags["deck_known_tomi"] || !!s.flags["deck_skipped_tomi"])), jump: "ask" },
    { flag: "chat_tomi_done" },
    { say: "tomi", text: "\"That's the whole sales pitch and the family history. Free, because I like you. The next one costs a Smug Coin.\" A grin. \"I'll let you guess which price that is.\"" },
    { end: true },
    { label: "ask" },
    { choice: [
      { text: "\"'The price is the price.' Who taught you that?\"", when: (s)=>!s.flags["chat_tomi_1"], steps: [
        { say: "rowan", text: "\"'The price is the price.' Who taught you that?\"" },
        { say: "tomi", text: "\"My uncle's stall at a flea market on the east docks. Age eight. First rule: never lie about the condition. Second rule: never lie about the price.\"" },
        { say: "tomi", text: "\"Third rule: lie about nothing, and look like you're lying about everything. That's the whole job.\"" },
        { choice: [
          { text: "\"Does the third rule work?\"", steps: [
            { say: "rowan", text: "\"Does the third rule work?\"" },
            { say: "tomi", text: "\"It's why they come back to check.\" Delighted. \"A customer who checks is a customer who's back. My uncle called it advertising.\"" }
          ] },
          { text: "\"Age eight. What does an eight-year-old do on a stall?\"", steps: [
            { say: "rowan", text: "\"Age eight. What does an eight-year-old do on a stall?\"" },
            { say: "tomi", text: "\"Count. I was the smallest thing on that table that wasn't for sale, so I learned what everything on it cost.\"" },
            { say: "tomi", text: "\"Nobody walks off with a thing while a kid is saying its price out loud.\" He demonstrates, in a small clear voice: \"'*That's four-fifty, mister.*' Try it sometime. It's very embarrassing for them.\"" },
            AFF("tomi", 1, "Asked about the kid")
          ] },
          { text: "\"So the odds you quoted me were true. You just looked as if they weren't.\"", when: (s)=>!!s.flags["tomi_quoted_odds"], steps: [
            { say: "rowan", text: "\"So the odds you quoted me were true. You just looked as if they weren't.\"" },
            { say: "tomi", text: "\"*Now* he's getting it.\" He points the pencil at you. \"You went away and thought about them, didn't you? That's the third rule working. I'd shake your hand, but I'd have to put the pencil down.\"" }
          ] }
        ] },
        AFF("tomi", 2, "Asked how he started"),
        { flag: "chat_tomi_1" },
        NOTE("tomi", "Learned to trade at an uncle's flea-market stall from the age of eight. Three rules, none of them lying."),
        { time: 2 },
      ] },
      { text: "\"'Friend price.' Does everybody get that one?\"", when: (s)=>!s.flags["chat_tomi_2"], steps: [
        { say: "rowan", text: "\"'Friend price.' Does everybody get that one?\"" },
        { say: "tomi", text: "\"Everyone's a friend. Some are better friends. Commons kids get the best price.\" He taps the binder. \"I never cheat a Commons kid, and a first-timer gets one bad trade back, free. That's not charity. That's investment.\"" },
        { choice: [
          { text: "\"I'm for the Commons myself.\"", when: (s)=>!s.flags["isle_tomi_done"], steps: [
            { say: "rowan", text: "\"I'm for the Commons myself.\"" },
            { say: "tomi", text: "\"I know. I can read a list.\" He flicks his own grey collar. \"So that's you sorted: best price, one bad trade back. *One.* I write it down.\"" },
            { say: "tomi", text: "\"Grey collars look after grey collars. You'll have one by tonight. Start practising.\"" }
          ] },
          { text: "\"And the tower?\"", steps: [
            { say: "rowan", text: "\"And the tower?\"" },
            { say: "tomi", text: "\"Tower pays tower prices. The gentleman in the gloves pays double, when he gets round to wanting something.\"" },
            { say: "rowan", text: "\"That sounds personal.\"" },
            { say: "tomi", text: "\"It's not personal. It's *marketing*.\" A beat, and the grin thins a little. \"He turned a grey collar away from a public table. That goes on the price. Everything goes on the price.\"" },
            NOTE("tomi", "The tower pays tower prices, and the one in the white gloves pays double.")
          ] },
          { text: "\"Investment in what?\"", steps: [
            { say: "rowan", text: "\"Investment in what?\"" },
            { say: "tomi", text: "\"In them coming back. A kid with a deck that works trades with me for years. A kid who got skinned on day one buys nothing and tells everybody why.\"" },
            { say: "tomi", text: "\"Also it's a school full of people whose bags match.\" He holds up four fingers, one for each leather case. \"Somebody's got to do the arithmetic for the ones whose don't.\"" }
          ] }
        ] },
        AFF("tomi", 2, "Asked about his rules"),
        { flag: "chat_tomi_2" },
        NOTE("tomi", "Commons kids get the best price and one bad trade back."),
        { time: 2 },
      ] },
      { text: "\"You've a line on everything. What's your line on the year?\"", when: (s)=>!s.flags["chat_tomi_3"], steps: [
        { say: "rowan", text: "\"You've a line on everything. What's your line on the year?\"" },
        { say: "tomi", text: "\"Spectral wins the first week. Rare wins the first month. Commons wins the year.\" A shrug. \"Long odds, long game. Don't tell the gloves, he'll want to put money on it.\"" },
        { say: "rowan", text: "\"Why would the Commons win?\"" },
        { say: "tomi", text: "\"Because they're the ones who know what everything's worth. Prices don't care about a collar.\"" },
        { choice: [
          { text: "\"And the line on me? Past the first table.\"", steps: [
            { say: "rowan", text: "\"And the line on me? Past the first table.\"" },
            { when: (s)=>!!s.flags["rowan_singled_out"], say: "tomi", text: "\"Top eight of the year, twelve to one.\" No pause to work it out; it has been sitting there. \"It was twenty before you came down those stairs, got pointed at, and didn't leave.\"" },
            { when: (s)=>!s.flags["rowan_singled_out"], say: "tomi", text: "\"Top eight of the year, twelve to one.\" No pause to work it out; it has been sitting there." },
            { say: "tomi", text: "\"Don't get proud. Twelve to one is still me saying no eleven times.\"" }
          ] },
          { text: "\"You'd bet against your own collar for the first week?\"", steps: [
            { say: "rowan", text: "\"You'd bet against your own collar for the first week?\"" },
            { say: "tomi", text: "\"I'd bet *accurately* for the first week.\" Unbothered. \"Then I'd go and help them win, and collect on the long one. That's not disloyal. That's a hedge with feelings.\"" }
          ] }
        ] },
        AFF("tomi", 1, "Played the odds with him"),
        { flag: "chat_tomi_3" },
        NOTE("tomi", "Thinks the Commons wins the long game."),
        { time: 2 },
      ] },
      { text: "\"From a flea-market stall to a bag of binders. What was the best trade on the way?\"", when: (s)=>!s.flags["chat_tomi_x"] && !!s.flags["chat_tomi_1"], steps: [
        { say: "rowan", text: "\"From a flea-market stall to a bag of binders. What was the best trade on the way?\"" },
        { say: "tomi", text: "\"A bike.\" Instantly. \"For a card I'd pulled out of a pack of cereal. A *promo*. Not worth two Smug Coins on any market in the world. He wanted it more than the bike.\"" },
        { say: "tomi", text: "\"That's the whole job, Wildcard. Find what somebody wants more than what they've got. Then be the person standing there.\"" },
        { say: "rowan", text: "\"What happened to the bike?\"" },
        { say: "tomi", text: "\"Traded it for a binder. Binder for a bigger binder. And here we are.\" He pats the canvas bag. \"A very long chain, from one very stupid cereal.\"" },
        { choice: [
          { text: "\"Do you miss the bike?\"", steps: [
            { say: "rowan", text: "\"Do you miss the bike?\"" },
            { say: "tomi", text: "\"Every hill.\" Instantly. \"But you can't ride a bike and carry four binders. I checked. There's a scar.\"" }
          ] },
          { text: "\"Where does the chain end?\"", steps: [
            { say: "rowan", text: "\"Where does the chain end?\"" },
            { text: "For once he does not answer at the speed of the question." },
            { say: "tomi", text: "\"Ground floor.\" A beat. \"A flat, I mean. No stairs. For somebody who's done enough of them.\"" },
            { say: "tomi", text: "\"That's a lot of binders from here.\" And the patter is back, as if it had only stepped out for air. \"So. Sleeves?\"" },
            AFF("tomi", 1, "Asked where it ends")
          ] }
        ] },
        AFF("tomi", 2, "Heard about the bike"),
        { flag: "chat_tomi_x" },
        NOTE("tomi", "Traded a promo card from a cereal box for a bike, and the bike for his first binder."),
        { time: 2 },
      ] },
      { text: "Steer the talk to cards.", when: (s)=>!s.flags["deck_known_tomi"], steps: [
        { scene: "deck_tomi" },
      ] },
      { text: "\"I'll let you get back to business.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to business.\"" },
        { say: "tomi", text: "\"Come back with something to trade. Or a bet.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("deck_tomi", {
  steps: [
    { when: (s)=>!!s.flags["deck_known_tomi"], end: true },
    { choice: [
      { text: "\"A bag of binders on your hip and prices in your head. You count what everyone's holding. Gold? Wealth, Treasure Chests, a big pile?\"", hint: "From his look", steps: [
        { say: "rowan", text: "\"A bag of binders on your hip and prices in your head. You count what everyone's holding. Gold? Wealth, Treasure Chests, a big pile?\"" },
        { say: "tomi", text: "\"Ha! Right pocket, wrong direction.\" Delighted. \"I don't *pile* it, Wildcard. I take yours.\"" },
        { say: "tomi", text: "\"Free Port. Thieving on all three heroes, Mimics, Pirates, Dirty Smugglers, and every turn your purse is a little emptier.\"" },
        AFF("tomi", 1, "Nearly had it")
      ] },
      { text: "\"Is your deck as much of a business as you are? What do you run?\"", steps: [
        { say: "rowan", text: "\"Is your deck as much of a business as you are? What do you run?\"" },
        { say: "tomi", text: "\"Free Port. Smugglers. I take your gold. Thieving on all three heroes, and then I buy with it.\"" },
        AFF("tomi", 1, "Asked about his deck")
      ] },
      { text: "Let the cards wait for now.", steps: [
        { flag: "deck_skipped_tomi" },
        { end: true }
      ] }
    ] },
    { text: "You have stopped listening to the patter. Under your breath, quick and flat:" },
    { say: "rowan", text: "\"…Thieving. Mimic. Deepsea Pirate. Dirty Smuggler. Golden Abomination redirects the income. Key buys the artifacts out from under you. Smuggler's Pier, so he spends it on the way past. Thieving Strikes, soft hits.\" A beat. \"Answers that cost gold can't be paid for. Gold Trap?\"" },
    { say: "tomi", text: "\"Three. And you're the first person who's ever asked that without wanting to rob me.\"" },
    AFF("tomi", 1, "Understood his plan"),
    DECK("tomi"),
    { flag: "deck_known_tomi" }
  ]
});

scene("ferry_anni", {
  steps: [
    { when: (s)=>!!s.flags["met_anni"], jump: "again" },
    { text: "At the end of the bench nearest the card table a girl is standing, although there is room to sit. Heels together. A black jacket so immaculate that its white-and-gold collar looks ironed onto her, a red tie, an auburn bun without one hair adrift, large square glasses." },
    { text: "She holds a small grey booklet open in her left hand and a red pen in her right, and she is looking from the card table to the booklet and back, as if one of the two had made a mistake." },
    { say: "anni", alias: "Girl with a red pen", text: "\"You are out of uniform.\"" },
    { text: "She says it to the booklet. The red pen is already uncapped." },
    { choice: [
      { text: "\"I haven't been issued one. The letter says it's waiting on the island.\"", steps: [
        { say: "rowan", text: "\"I haven't been issued one. The letter says it's waiting on the island.\"" },
        { say: "anni", alias: "Girl with a red pen", text: "\"Then it is the Academy that is out of uniform, and not you.\" She writes four words, very small. \"I have noted it against them.\"" },
        { say: "rowan", text: "\"You're writing up the Academy.\"" },
        { say: "anni", alias: "Girl with a red pen", text: "\"I am writing up the *fact*. Whom it belongs to is a matter for somebody with a desk.\"" },
        AFF("anni", 1, "Explained, did not argue")
      ] },
      { text: "\"I know the uniform guide by heart. It says nothing about rain jackets.\"", steps: [
        { say: "rowan", text: "\"I know the uniform guide by heart. It says nothing about rain jackets.\"" },
        { say: "anni", alias: "Girl with a red pen", text: "\"There is a dress section.\" Pages turn, quickly, and then more slowly. \"It says nothing about rain jackets. It says nothing about passengers in transit at all.\"" },
        { text: "A faint flush climbs out of the starched collar. She speaks rather faster." },
        { say: "anni", alias: "Girl with a red pen", text: "\"I withdraw the remark. I have struck it out. You may look, if you doubt it.\"" },
        AFF("anni", 2, "Knew where it was written")
      ] },
      { text: "\"It's been a long morning. Could I be written up tomorrow?\"", steps: [
        { say: "rowan", text: "\"It's been a long morning. Could I be written up tomorrow?\"" },
        { say: "anni", alias: "Girl with a red pen", text: "\"Infractions are not scheduled for convenience.\"" },
        { text: "Then the level grey eyes come up, and take in the rain jacket, and the one duffel, and whatever your face is doing." },
        { when: (s)=>!!s.flags["rowan_singled_out"], say: "anni", alias: "Girl with a red pen", text: "\"…You are the one who was pointed at. That is not conduct. Nobody may be written up for being pointed at.\" The pen is capped. \"I have checked.\"" },
        { when: (s)=>!s.flags["rowan_singled_out"], say: "anni", alias: "Girl with a red pen", text: "\"…You are the one the whole ship is talking about. That is not conduct. Nobody may be written up for being talked about.\" The pen is capped. \"I have checked.\"" }
      ] }
    ] },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "anni", alias: "Girl with a red pen", text: "\"Brandt. Anneliese.\" A very small, very correct nod. \"Auxiliary, judging track. Anni, if it must be short. People generally find that it must.\"" },
    MET("anni", "Anneliese Brandt"),
    { text: "The open page is ruled by hand, in red, into three columns. The left one is full." },
    { say: "anni", text: "\"Since the harbour: eleven. Feet on upholstery, four counts. A bench used as a luggage rack. One betting pool: that is Mr Reyes, in the yellow bandana, organised wagering among students, section nine, paragraph two. And the stake card at the table, which I have entered as *irregular*, because I cannot find what else it is.\"" },
    { when: (s)=>!s.flags["table_resolved"], say: "anni", text: "\"What I cannot enter is the thing itself.\" The pen points, briefly, at the pale boy and at the small girl he is not playing. \"He declines a challenger on the colour of her collar, and it is written nowhere that he may not. I have read the section twice. I find that I am annoyed with the booklet.\"" },
    { when: (s)=>!!s.flags["table_resolved"], say: "anni", text: "\"What I could not enter was the thing itself.\" The pen points, briefly, at the card table. \"He declined a challenger on the colour of her collar for most of a morning, and it is written nowhere that he may not. However it ended, that part stands. I find that I am annoyed with the booklet.\"" },
    { choice: [
      { text: "\"Can't you make him play her?\"", when: (s)=>!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"Can't you make him play her?\"" },
        { say: "anni", text: "\"No. I have no standing; I am a first-year with a booklet. And there is no paragraph.\"" },
        { say: "anni", text: "\"What I can do is see to it that when somebody with a desk asks what happened in this room, there is an account that is not his. He will give a very good one. He is courteous. That is exactly when one ought to be writing.\"" }
      ] },
      { text: "\"Could you have stopped it?\"", when: (s)=>!!s.flags["table_resolved"], steps: [
        { say: "rowan", text: "\"Could you have stopped it?\"" },
        { say: "anni", text: "\"No. I have no standing; I am a first-year with a booklet. And there is no paragraph.\"" },
        { say: "anni", text: "\"What I can do is see to it that when somebody with a desk asks what happened in this room, there is an account that is not his. He will give a very good one. He is courteous. That is exactly when one ought to be writing.\"" }
      ] },
      { text: "\"Are you going to report all eleven?\"", steps: [
        { say: "rowan", text: "\"Are you going to report all eleven?\"" },
        { say: "anni", text: "\"To whom? There is no judge aboard. I asked a deckhand, and he offered me tea.\" She does not seem to have forgiven the tea. \"It is a record. Some of it will go in on Monday. Some of it I only tell people.\"" },
        { say: "rowan", text: "\"Which was I?\"" },
        { say: "anni", text: "\"You were told. It is the better category.\"" },
        AFF("anni", 1, "Asked which category")
      ] },
      { text: "\"He's offering four to one on which paragraph he is. You've just told the whole bench.\"", when: (s)=>!!s.flags["tomi_anni_odds"], steps: [
        { say: "rowan", text: "\"He's offering four to one on which paragraph he is. You've just told the whole bench.\"" },
        { say: "anni", text: "\"He is *what*.\"" },
        { text: "The flush goes up her neck like mercury. The pen is uncapped again." },
        { say: "anni", text: "\"That is a second count. Wagering upon an entry concerning wagering.\" She writes it. She underlines it. \"I shall not say the number aloud again. I decline to settle his book for him.\"" },
        AFF("anni", 2, "Told her honestly")
      ] }
    ] },
    { when: (s)=>!s.flags["table_resolved"], jump: "ask_sit" },
    { when: (s)=>!!s.flags["rowan_singled_out"], say: "anni", text: "\"You are the one he named. Was it fair, in your opinion? I ask for the record.\"" },
    { when: (s)=>!s.flags["rowan_singled_out"], say: "anni", text: "\"Was it fair, in your opinion? I am asking everybody, for the record.\"" },
    { choice: [
      { text: "\"Fair enough. Nobody broke anything.\"", steps: [
        { say: "rowan", text: "\"Fair enough. Nobody broke anything.\"" },
        { say: "anni", text: "\"'Fair enough.'\" She writes it down, in quotation marks. \"That is the commonest verdict there is, and the least use. Thank you. It is entered as given.\"" }
      ] },
      { text: "\"No. But I couldn't tell you which rule it broke.\"", steps: [
        { say: "rowan", text: "\"No. But I couldn't tell you which rule it broke.\"" },
        { say: "anni", text: "\"Neither can I.\" It costs her something to say it. \"That is two of us. I shall find out where it ought to have been written.\"" },
        AFF("anni", 2, "Minded the blank too")
      ] },
      { text: "\"Ask her, not me.\"", steps: [
        { say: "rowan", text: "\"Ask her, not me.\"" },
        { say: "anni", text: "\"…Yes.\" The pen stops. \"That is the correct procedure. I ought to have begun there.\" A beat. \"I shall, when she looks less likely to bite.\"" },
        AFF("anni", 1, "Pointed her the right way")
      ] }
    ] },
    { jump: "hood" },
    { label: "ask_sit" },
    { say: "anni", text: "\"You are the one he named. Do you intend to sit down?\"" },
    { choice: [
      { text: "\"I haven't decided.\"", steps: [
        { say: "rowan", text: "\"I haven't decided.\"" },
        { say: "anni", text: "\"Then decide it by the rule you would want if you were standing where she is. It is the only test I know that does not need a booklet.\"" }
      ] },
      { text: "\"Would it be against anything if I did?\"", steps: [
        { say: "rowan", text: "\"Would it be against anything if I did?\"" },
        { say: "anni", text: "\"No. A game freely accepted by both players is the most regular thing on this ship. It is everything round it that I have had to write down.\"" },
        AFF("anni", 1, "Asked before acting")
      ] },
      { text: "\"What would you do?\"", steps: [
        { say: "rowan", text: "\"What would you do?\"" },
        { say: "anni", text: "\"I am not the one who was asked.\" Promptly. Then, less promptly: \"I should want it in writing first. I am aware that this is not always available.\"" },
        AFF("anni", 1, "Asked her opinion")
      ] }
    ] },
    { label: "hood" },
    { say: "anni", text: "\"Your hood is folded under on the left.\" The pen stays capped. \"I am not noting it. I am telling you.\"" },
    { text: "You put the hood right. She watches until it is, and then looks away very quickly." },
    NOTE("anni", "Judging student from the Spectral Tower. Keeps a list of every infraction aboard, in red."),
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"She wrote something DOWN! Am I in it? Baylee, I think I'm in a BOOK!\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Feet on upholstery.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { end: true },

    { label: "again" },
    { say: "anni", text: "\"Mr Vance.\"" },
    { text: "The left-hand column has grown. She turns the booklet a few degrees so that you cannot read it, and then, after a moment, a few degrees back." },
    { choice: [
      { text: "\"How is the list?\"", when: (s)=>!s.flags["anni_list_asked"], steps: [
        { say: "rowan", text: "\"How is the list?\"" },
        { flag: "anni_list_asked" },
        { say: "anni", text: "\"Fourteen.\" With a certain grim satisfaction. \"A lifebuoy went past the windows with a small boy behind it. I had no heading for that. I have made one.\"" },
        { say: "rowan", text: "\"What's the heading?\"" },
        { say: "anni", text: "\"'Buoyancy aids, misuse of.' It is provisional.\"" },
        AFF("anni", 1, "Asked after the list")
      ] },
      { text: "\"Could I ask you something?\"", when: (s)=>!s.flags["chat_anni_done"], steps: [
        { say: "rowan", text: "\"Could I ask you something?\"" },
        { say: "anni", text: "\"You may. I reserve the right to answer it accurately.\"" },
        { scene: "chat_anni" }
      ] },
      { text: "\"I'll leave you to it.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to it.\"" },
        { say: "anni", text: "\"Good morning, Mr Vance. Mind the brass rim. People keep catching their sleeves on it, and I have nowhere to enter that.\"" }
      ] }
    ] },
    { time: 4 }
  ]
});

scene("chat_anni", {
  steps: [
    { label: "top" },
    { when: (s)=>!(!!s.flags["chat_anni_1"] && !!s.flags["chat_anni_2"] && !!s.flags["chat_anni_3"]), jump: "ask" },
    { flag: "chat_anni_done" },
    { say: "anni", text: "\"That is sufficient for one crossing.\" She squares the booklet against her palm. \"I have enjoyed — it has been orderly. Good morning, Mr Vance.\"" },
    { end: true },
    { label: "ask" },
    { choice: [
      { text: "\"Why write it all down? Who is going to read it?\"", when: (s)=>!s.flags["chat_anni_1"], steps: [
        { say: "rowan", text: "\"Why write it all down? Who is going to read it?\"" },
        { say: "anni", text: "\"Because otherwise the only account of a room is the one given by whoever was most at ease in it.\"" },
        { say: "anni", text: "\"My father is a customs officer. In Lübeck. I grew up at a table where the conversation was who had tried to bring what past him that day, and how pleasant they had been about it.\"" },
        { say: "anni", text: "\"The pleasant ones were always the worst. That was the entire lesson. Rules are how people who are not charming are protected from people who are.\"" },
        { choice: [
          { text: "\"What was the best thing anybody tried to get past him?\"", steps: [
            { say: "rowan", text: "\"What was the best thing anybody tried to get past him?\"" },
            { say: "anni", text: "\"Forty-one tortoises. In a cello case.\" Without a flicker. \"The man had a very good suit and a letter from an orchestra. The orchestra was real. He was not in it.\"" },
            { say: "rowan", text: "\"What gave him away?\"" },
            { say: "anni", text: "\"The cello case had air holes.\" The corner of her mouth moves, and is corrected. \"My father says the charming ones never think about the tortoises.\"" },
            AFF("anni", 2, "Asked for the story")
          ] },
          { text: "\"So who is the charming one on this ship?\"", steps: [
            { say: "rowan", text: "\"So who is the charming one on this ship?\"" },
            { say: "anni", text: "\"Not the one at the table. He is *courteous*, which is colder and lasts longer.\"" },
            { say: "anni", text: "\"The charming one is on the upper deck. A young man handing roses to people he has not been introduced to.\" The pen taps the booklet, once. \"I have not found the paragraph. I am confident that there is one.\"" },
            AFF("anni", 1, "Asked whom she meant")
          ] },
          { text: "\"And the people who aren't charming. Do they thank you for the booklet?\"", steps: [
            { say: "rowan", text: "\"And the people who aren't charming. Do they thank you for the booklet?\"" },
            { say: "anni", text: "\"Not at first.\" Quite evenly. \"At first they call one names. Later, one of them is cheated, and comes to ask where it is written.\"" },
            { text: "She straightens a page that is already straight." },
            { say: "anni", text: "\"I can wait.\"" },
            AFF("anni", 2, "Asked the hard one")
          ] }
        ] },
        { flag: "chat_anni_1" },
        NOTE("anni", "Her father is a customs officer in Lübeck. She believes rules protect plain people from charming ones."),
        { time: 2 },
      ] },
      { text: "\"What is that booklet, exactly? You've hardly looked up from it.\"", when: (s)=>!s.flags["chat_anni_2"], steps: [
        { say: "rowan", text: "\"What is that booklet, exactly? You've hardly looked up from it.\"" },
        { say: "anni", text: "\"Student Conduct, current edition. It is sent on request. I requested it.\"" },
        { say: "anni", text: "\"I have the previous edition as well. They moved the section on wagers, and changed 'shall not' to 'should not' in three places. I should like to meet whoever did that.\"" },
        { choice: [
          { text: "\"You read two editions of the rules before the ferry had left.\"", steps: [
            { say: "rowan", text: "\"You read two editions of the rules before the ferry had left.\"" },
            { say: "anni", text: "\"Before the *train*.\" As if that were the reasonable part. \"I like to know what a place expects of me before it sees me. It seems only polite.\"" },
            { say: "anni", text: "\"There are thirty-eight of us, and I know nobody.\" Rather more quietly. \"I find it simpler when I know what I am for.\"" },
            AFF("anni", 2, "Did not laugh")
          ] },
          { text: "\"What do you want to be, at the end of all that reading?\"", steps: [
            { say: "rowan", text: "\"What do you want to be, at the end of all that reading?\"" },
            { say: "anni", text: "\"A head judge. One whom nobody can charm.\"" },
            { say: "anni", text: "\"People find that funny, at nineteen. I have noticed that they find it less funny when the ruling is theirs.\"" },
            { say: "rowan", text: "\"I don't find it funny.\"" },
            { say: "anni", text: "\"…No. You do not appear to.\" The flush climbs a notch out of her collar, and she speaks faster. \"That is noted. Not in the booklet. Merely noted.\"" },
            AFF("anni", 2, "Took her seriously")
          ] },
          { text: "\"'Should not' instead of 'shall not'. Is that bad?\"", steps: [
            { say: "rowan", text: "\"'Should not' instead of 'shall not'. Is that bad?\"" },
            { say: "anni", text: "\"It is the difference between a wall and the suggestion of a wall.\"" },
            { say: "anni", text: "\"Somebody asked for that change, Mr Vance. Nobody softens a verb by accident.\"" },
            AFF("anni", 1, "Asked about the verb")
          ] }
        ] },
        { say: "anni", text: "\"What I do not have is the Charter. First-years were told that it could not be had before Monday.\" Her eyes go, for a moment, to a bench under the windows, where a girl is reading something a good deal thicker. \"She has one. I intend to ask her how. Correctly.\"" },
        { flag: "chat_anni_2" },
        NOTE("anni", "Has read two editions of the conduct booklet and means to be a head judge nobody can charm."),
        { time: 2 },
      ] },
      { text: "\"Do you play, or only judge?\"", when: (s)=>!s.flags["chat_anni_3"], steps: [
        { say: "rowan", text: "\"Do you play, or only judge?\"" },
        { say: "anni", text: "\"A judge who does not play is a critic.\" Promptly. \"I play.\"" },
        { say: "rowan", text: "\"What?\"" },
        { say: "anni", text: "\"Dogs.\"" },
        { text: "She looks at you. She is waiting to see what your face does." },
        { choice: [
          { text: "Keep your face exactly as it is.", steps: [
            { text: "Your face does nothing. It has had a great deal of practice." },
            { say: "anni", text: "\"Loyal ones. A whole pack.\" She relaxes by perhaps a millimetre. \"A dog does not care whether you are popular. That is the entire appeal of the deck.\"" },
            { say: "anni", text: "\"Thank you for not smiling. Most people manage about two seconds.\"" },
            AFF("anni", 2, "Did not smile")
          ] },
          { text: "\"What sort of dogs?\"", steps: [
            { say: "rowan", text: "\"What sort of dogs?\"" },
            { say: "anni", text: "\"Loyal ones. Terriers. A Rottweiler. One Shepherd.\" Each is set down like an exhibit. \"A dog does not care whether you are popular. That is the entire appeal of the deck, and I would thank you not to smile.\"" },
            { say: "rowan", text: "\"I wasn't going to.\"" },
            { say: "anni", text: "\"You were considering it. It is all right. You stopped.\"" },
            AFF("anni", 1, "Asked which dogs")
          ] },
          { text: "\"I didn't expect dogs.\"", steps: [
            { say: "rowan", text: "\"I didn't expect dogs.\"" },
            { say: "anni", text: "\"Nobody does. They expect a deck of small locks and fines.\" She caps the pen, uncaps it, caps it. \"A dog does not care whether you are popular. That is the entire appeal.\"" },
            { say: "anni", text: "\"I spend the whole day with rules, Mr Vance. In the evening I should like something that is simply glad I have come back.\"" },
            AFF("anni", 2, "Said so honestly")
          ] }
        ] },
        { flag: "chat_anni_3" },
        NOTE("anni", "Plays a deck of loyal dogs: 'a dog does not care whether you are popular.'"),
        { time: 2 },
      ] },
      { text: "\"I'll let you get back to the list.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the list.\"" },
        { say: "anni", text: "\"It does not need me. It only needs to be accurate. But thank you.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("table_rowan_vs_inya", {
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { flag: "inya_engaged" },
    {
      when: (s)=>!!s.flags["met_gideon"],
      text: "Gideon rises from the brass-rimmed table for the first time all morning, takes his gloves, and steps aside onto the nearest bench. He sets himself down with his hands folded, as if the room had been built around a show."
    },
    {
      when: (s)=>!s.flags["met_gideon"],
      text: "The boy in the white gloves rises from the brass-rimmed table for the first time all morning, takes his gloves, and steps aside onto the nearest bench. He sets himself down with his hands folded, as if the room had been built around a show."
    },
    { when: (s)=>!!s.flags["met_gideon"], say: "gideon", text: "\"The table is yours, Vance. For the demonstration.\"" },
    { when: (s)=>!s.flags["met_gideon"], say: "gideon", alias: "Boy in white gloves", text: "\"Gideon Pryce. The table is yours, Vance. For the demonstration.\"" },
    MET("gideon", "Gideon Pryce"),
    {
      text: "The saloon closes around you like a crowd round a street fight. Half the ship. The boy in the yellow bandana is writing in the lid of his binder at a speed that suggests he has been waiting for this all morning."
    },
    {
      text: "Inya sits across from you. The deck box in her hands has stopped shaking. Yours is a different matter. Your fingers will not do what you tell them, and they know that you know."
    },
    { say: "inya", text: "\"You're shaking.\"" },
    {
      choice: [
        { text: "\"I am. It happens when people are watching. It'll settle once the first card goes down.\"", goto: "opt_4" },
        { text: "\"Yes. But I'm going to play you as hard as I can. You've earned that.\"", goto: "opt_5" },
        { text: "Say nothing and shuffle.", goto: "opt_6" }
      ]
    },
    { jump: "choiceend_3" },
    { label: "opt_4" },
    { say: "rowan", text: "\"I am. It happens when people are watching. It'll settle once the first card goes down.\"" },
    { say: "inya", text: "\"…Okay.\"" },
    { text: "Very quietly, so that nobody else can hear it." },
    { say: "inya", text: "\"I'd rather you told me.\"" },
    { say: "inya", text: "\"Don't let me win.\"" },
    { flag: "told_inya_nerves" },
    { jump: "choiceend_3" },
    { label: "opt_5" },
    { say: "rowan", text: "\"Yes. But I'm going to play you as hard as I can. You've earned that.\"" },
    { say: "inya", text: "\"Good.\" Immediate. Fierce. \"Good.\"" },
    {
      add: { aff_inya: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Took her seriously" }); } },
    { jump: "choiceend_3" },
    { label: "opt_6" },
    { text: "She watches your hands. She says nothing either." },
    { jump: "choiceend_3" },
    { label: "choiceend_3" },
    { flag: "gideon_scouts_rowan" },
    {
      duel: "table_rowan_inya",
      opponent: "inya",
      opponentName: "Inya Bell",
      mustWin: false,
      onWin: [
        { text: "Inya stares at the board for a long, unmoving time. It is not defeat. It is something more private." },
        { say: "inya", text: "\"Rude.\" Barely above a whisper. \"Accurate, but rude.\"" },
        { say: "gideon", text: "\"A pity.\"" },
        { text: "He rises, retrieving his gloves one finger at a time, and his voice does not change at all." },
        {
          say: "gideon",
          text: "\"A win over the Wildcard would have been something. A loss to him is not a win over anybody. The table remains closed, Miss Bell.\""
        },
        { say: "inya", text: "\"…I know what you said.\" Flat, fast, very quiet. \"Beat him. And I didn't.\"" },
        { say: "gideon", text: "\"Exactly so. I am glad that we understand each other.\"" },
        { text: "The ripple round the benches is not laughter this time. It is closer to a wince." },
        { flag: "rowan_beat_inya" },
        {
          add: { aff_inya: -1 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: -1, why: "Beat her" }); } },
        {
          prompt: "What do you do?",
          choice: [
            { text: "\"Then play me, Gideon. You wanted to see the Wildcard. Here he is.\"", goto: "opt_8" },
            { text: "Turn to Inya and tell her that she played a good game and that he is wrong.", goto: "opt_9" },
            { text: "Say nothing and let the room drift apart.", goto: "opt_10" }
          ]
        },
        { jump: "choiceend_7" },
        { label: "opt_8" },
        { say: "rowan", text: "\"Then play me, Gideon. You wanted to see the Wildcard. Here he is.\"" },
        { say: "gideon", text: "\"How very agreeable.\"" },
        { flag: "gideon_challenge_said" },
        { scene: "table_challenge_gideon" },
        { jump: "choiceend_7" },
        { label: "opt_9" },
        {
          say: "rowan",
          text: "\"That was a good game. You made me think on every turn. He's wrong about you, and he knows it.\""
        },
        { say: "inya", text: "\"Don't.\"" },
        { text: "Fast. But her mouth is trembling at one corner." },
        { say: "inya", text: "\"Don't be nice. I'll cry. I don't have time.\"" },
        {
          add: { aff_inya: 4 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 4, why: "Meant it" }); } },
        { flag: "ferry_table_denied" },
        { flag: "table_resolved" },
        { scene: "table_payout" },
        { jump: "choiceend_7" },
        { label: "opt_10" },
        { flag: "ferry_table_denied" },
        { flag: "table_resolved" },
        { scene: "table_payout" },
        { jump: "choiceend_7" },
        { label: "choiceend_7" }
      ],
      onLose: [
        { text: "Inya looks at the last Hero going down. For one second her face does nothing at all." },
        { text: "Then, very slowly, she smiles." },
        { say: "inya", text: "\"I win.\" As if testing it. \"I win. I actually — I beat the Wildcard.\"" },
        { say: "gideon", text: "\"So you have.\"" },
        {
          text: "He stands, and in the same motion takes up his gloves. It is the first time all morning that he has looked entirely sure of himself."
        },
        {
          say: "gideon",
          text: "\"Well, Miss Bell. You have beaten somebody I have heard of. The table is open to you. Four cases, as discussed.\""
        },
        { say: "inya", text: "\"Four cases.\"" },
        { flag: "inya_qualified" },
        { flag: "rowan_lost_to_inya" },
        {
          add: { aff_inya: 3 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Beaten fairly" }); } },
        { scene: "table_inya_vs_gideon" }
      ]
    },
    { time: 25 }
  ]
});

scene("table_challenge_gideon", {
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["stepped_past_inya"]), jump: "next_4" },
    { text: "Inya looks at you across the felt as you pull out the chair. She says nothing. She does not need to." },
    { label: "next_4" },
    { label: "end_3" },
    { when: (s)=>!s.flags["gideon_challenge_said"] && !!s.flags["met_gideon"], say: "rowan", text: "\"Gideon. I'll play you.\"" },
    { when: (s)=>!s.flags["gideon_challenge_said"] && !s.flags["met_gideon"], say: "rowan", text: "\"You, at the table. I'll play you.\"" },
    {
      text: "The room goes quiet in the particular way rooms go quiet when somebody is about to be embarrassed on purpose."
    },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance.\"" },
    { text: "He looks you over, grey eyes taking inventory." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"I did not think you would volunteer. How very interesting.\"" },
    { when: (s)=>!s.flags["met_gideon"], say: "gideon", alias: "Boy in white gloves", text: "\"Gideon Pryce. One ought to know whose luggage one may be carrying.\"" },
    MET("gideon", "Gideon Pryce"),
    {
      say: "gideon",
      text: "\"The loser carries the winner's luggage from the dock to the winner's door. I have four cases. You have, I take it, one duffel.\""
    },
    { say: "rowan", text: "\"One.\"" },
    { say: "gideon", text: "\"Then the odds on the book are fair to you.\"" },
    { text: "The boy in the yellow bandana, three benches back, is writing furiously." },
    {
      text: "Your hands shake the moment you pick up the deck. You hide them under the table, take a long breath, and try to remember that the cards under your fingers are the same cards you have played four hundred times in a laundromat."
    },
    { when: (s)=>!!s.flags["saw_counter"], think: "Don't attack first. Don't attack first. He's waiting for you to attack first." },
    { when: (s)=>!s.flags["saw_counter"], think: "Four hundred games, and not one of them with anybody watching. Breathe. Look at the board, not the room." },
    { flag: "gideon_scouts_rowan" },
    {
      duel: "table_gideon_rowan",
      opponent: "gideon",
      opponentName: "Gideon Pryce",
      mustWin: false,
      onWin: [
        { text: "Gideon looks at the board for a long moment. A very slight line appears between his eyebrows." },
        { say: "gideon", text: "\"You did not attack.\"" },
        { say: "rowan", text: "\"Not once.\"" },
        { say: "gideon", text: "\"No.\"" },
        { text: "He says it as if it were a diagnosis." },
        { say: "gideon", text: "\"That is — most irregular.\"" },
        { text: "He puts his gloves back on, one finger at a time, and does not look at you as he speaks." },
        { say: "gideon", text: "\"Well played, Vance. Your duffel will be at your door.\"" },
        {
          text: "The saloon erupts into noise. Nathan, from somewhere behind the crowd, is bellowing \"THE WILDCARD! THE WILDCARD!\" to a room that has already turned to look at him."
        },
        { sfx: "victory" },
        { flag: "ferry_table_won" },
        { flag: "table_resolved" },
        {
          add: { aff_gideon: 2 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 2, why: "Beat him fairly" }); } },
        {
          add: { aff_inya: 2 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Played for her" }); } }
      ],
      onLose: [
        { text: "Gideon sets down his last card with a courteous little click." },
        { when: (s)=>!(!!s.flags["deck_known_gideon"]), jump: "next_6" },
        { text: "The board is full of Guardians." },
        { jump: "end_5" },
        { label: "next_6" },
        {
          text: "The board is full of tall, patient creatures, set shoulder to shoulder, not one of them having attacked."
        },
        { label: "end_5" },
        { text: "Your hand, you notice, has stopped shaking. It just hasn't done anything useful." },
        { say: "gideon", text: "\"Four cases. The Spectral Tower, Vance. I will go first. Do try to keep up.\"" },
        {
          text: "A groan goes through the saloon, rolling aft like a wave. Nathan, at the back: \"He CARRIED them? He's going to CARRY them? Baylee, he's going to carry them!\""
        },
        { say: "baylee", text: "\"I heard.\"" },
        { flag: "ferry_table_lost" },
        { flag: "table_resolved" },
        {
          add: { aff_gideon: 1 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Beaten, politely" }); } },
        {
          add: { aff_inya: 1 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Played for her" }); } }
      ]
    },
    { scene: "table_payout" },
    { time: 25 }
  ]
});

scene("table_inya_vs_gideon", {
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    {
      text: "She takes the seat. Her hands are quite still now. She sets the deck on the felt and squares it, twice, as if she had learned that from watching him."
    },
    {
      text: "You are two benches away, close enough to see her face. She looks back at you for one half-second, as if she were wondering whether you might say something."
    },
    {
      choice: [
        {
          text: "Tell her how Gideon plays.",
          goto: "opt_4",
          when: (s)=>(!!s.flags["saw_counter"]||!!s.flags["inya_has_tip"])
        },
        { text: "\"Take your time, Inya. Don't hurry him, and don't hurry yourself.\"", goto: "opt_5" },
        { text: "Wish her luck and step back.", goto: "opt_6" }
      ]
    },
    { jump: "choiceend_3" },
    { label: "opt_4" },
    {
      say: "rowan",
      text: "\"He never attacks first. He sets his board and waits for you to commit. Don't commit. Make him come to you.\""
    },
    { say: "inya", text: "\"I make him come to me.\" Hardly a whisper. \"Okay. Okay.\"" },
    { flag: "inya_has_tip" },
    {
      add: { aff_inya: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Told her how" }); } },
    { jump: "choiceend_3" },
    { label: "opt_5" },
    { say: "rowan", text: "\"Take your time, Inya. Don't hurry him, and don't hurry yourself.\"" },
    { say: "inya", text: "\"Take my time.\" A flicker of a smile. \"I'll try.\"" },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Encouraged her" }); } },
    { jump: "choiceend_3" },
    { label: "opt_6" },
    { say: "rowan", text: "\"Good luck.\"" },
    { say: "inya", text: "\"I don't need luck.\" A beat. \"…Thanks.\"" },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Wished her luck" }); } },
    { jump: "choiceend_3" },
    { label: "choiceend_3" },
    { text: "They play." },
    { when: (s)=>!(!!s.flags["inya_has_tip"]), jump: "next_8" },
    {
      text: "You watch her do it. She builds, a single sad little bunny at a time, a wall of them, a field, and she does not attack. She does not attack on turn three or on turn four or on turn five. The crowd murmurs. On the bench behind you, the bookmaker's pencil has stopped."
    },
    { text: "By turn eight, a flicker of impatience crosses Gideon's face for the first time all morning." },
    { text: "On turn nine, he attacks first." },
    {
      text: "Inya takes the counter-swing in both hands and sets off a chain of Bunny Bombs that makes the saloon lights flicker."
    },
    { when: (s)=>!(!!s.flags["deck_known_gideon"]), jump: "next_10" },
    { text: "The Guardians fall in a row." },
    { jump: "end_9" },
    { label: "next_10" },
    { text: "The tall, patient creatures fall in a row." },
    { label: "end_9" },
    { text: "Nobody speaks." },
    { say: "gideon", text: "\"…How interesting.\"" },
    { text: "He looks, not at her, but straight at you." },
    { say: "inya", text: "\"Rude. Accurate.\"" },
    { text: "She is not smiling. She is shaking all over." },
    { say: "inya", text: "\"Four cases, Pryce.\"" },
    { say: "gideon", text: "\"Four cases.\"" },
    {
      text: "And he stands, and does it without ceremony: he takes off his jacket, folds it, and starts looking for his luggage."
    },
    { text: "The saloon explodes. Nathan: \"THE LITTLE ONE! THE LITTLE ONE!\"" },
    { sfx: "victory" },
    { flag: "ferry_inya_won" },
    {
      add: { aff_inya: 5 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 5, why: "You told her how" }); } },
    { jump: "end_7" },
    { label: "next_8" },
    { text: "Inya attacks on turn one." },
    { text: "It is a good attack. It is also precisely what he has been waiting for." },
    {
      text: "The counter-swing lands on turn three, and the next one on turn five, and by the end the tall, patient creatures stand in a neat row across a table that holds only a few scattered rabbits."
    },
    { say: "gideon", text: "\"Four cases. The Spectral Tower. Do try to keep up.\"" },
    { say: "inya", text: "\"…I know what I agreed to.\"" },
    {
      text: "She does not cry. She does not look at anyone. She folds her deck very carefully, puts it in the box, and walks out onto the fore deck without a word."
    },
    { when: (s)=>!(!!s.flags["rowan_lost_to_inya"]), jump: "next_14" },
    {
      text: "You watch her go. She earned that seat from you, fair and square, and then lost it in front of the room."
    },
    { label: "next_14" },
    { label: "end_13" },
    { flag: "ferry_inya_lost" },
    { label: "end_7" },
    { flag: "table_resolved" },
    { scene: "table_payout" },
    { time: 25 }
  ]
});

scene("lounge_first", {
  once: true,
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!!s.flags["table_resolved"], flag: "lounge_seen" },
    { when: (s)=>!!s.flags["table_resolved"], text: "The saloon is long and full of sun. At the far end, by the galley hatch, stands a green card table with a brass rim, and the benches round it are emptying. Whatever happened in this room this morning has finished happening without you." },
    { when: (s)=>!!s.flags["table_resolved"], end: true },
    {
      text: "The iron steps give onto a long saloon so full of sun that you stop on the bottom stair. The windows are huge and rounded and spotless, a row of clean panes with nothing in them but sea. Padded blue benches run along the wall beneath them, and duffel bags are piled on every seat."
    },
    { text: "It smells of coffee and warm wool. The engine is a hum you feel in the soles of your feet." },
    {
      text: "At the far end a steel urn steams on the counter of a galley hatch, with a hand-lettered sign for coffee and cinnamon rolls. Beside it, under a round porthole that frames the island like a postcard, stands the only real card table on the ship: green felt, a raised brass rim to keep the cards from sliding, a brass plate screwed to the edge, a ring of blue stools. People are standing round it two deep."
    },
    {
      text: "At the table sits a pale boy with a starched white-and-gold collar, squaring his deck against the felt. He does it twice, as if it might have changed. A pair of white cotton gloves lies folded beside it. He has not looked up since you came in."
    },
    {
      text: "On the bench behind him stand four matched leather cases with brass corners, strapped shut, and a card propped against them in a very neat hand: THE STAKES AT THIS TABLE: THE LOSER CARRIES THE WINNER'S LUGGAGE UP THE HILL."
    },
    {
      text: "At the far end of the table stands a small girl with mint-green hair in two low tails, held with a bunny-shaped clip. She is holding a deck box in both hands, a tiny bunny charm dangling from its clasp, and the box is shaking slightly, the way a leaf shakes."
    },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"The plate says winner stays.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"It does.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"So I'm next. I've been standing here twenty minutes.\"" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"I did not say you were not next. I said I do not play first-comers.\""
    },
    {
      text: "He looks, for the first time, at her. Not at her face. At the plain grey collar above the oversized hoodie."
    },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"My time is not a free-for-all, Miss. A grey collar who has beaten nobody I have heard of has not yet earned a seat at this table. Come back when a player of standing has lost to you.\""
    },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"I've beaten three people this morning!\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Whom?\"" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"A deckhand. A boy with a pretzel. A — a girl who fell asleep.\""
    },
    { text: "A ripple goes round the benches. It is not quite laughter." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Quite.\"" },
    {
      text: "The pale boy's grey eyes travel round the saloon with the unhurried interest of a man choosing a book. They stop at the stairs, where a stranger in a rain jacket is standing among the jackets, and do not move on."
    },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Then let us make it simple. There is, aboard, exactly one first-year who does not wear a collar at all. The Academy could not decide what to make of him. One name in ink at the bottom of a typed list: the Wildcard.\""
    },
    { text: "Every head turns the same way. Yours is not an exception." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "\"THAT'S HIM,\"", mood: "happy" },
    { text: "says a whisper that carries to the galley." },
    { say: "nathan", text: "\"That's Rowan! I TOLD them! I told everybody!\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"He did.\"" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Beat him, in front of this table, and I will concede that you are worth my time. Then we shall play, for the usual stake: the loser carries the winner's luggage up the hill. Mine is those four cases, Vance. Yours, I gather, is one duffel. I shall try to be a gentle winner. Until then, the table is closed.\""
    },
    {
      text: "On the nearest bench a boy in a yellow bandana turns the lid of his binder towards the room and takes the pencil from behind his ear."
    },
    {
      say: "tomi",
      alias: "Boy in a yellow bandana",
      text: "\"Ladies and gentlemen, a new line! Even money, ten Smug Coins a head, on whether the Wildcard sits down! And a young lady with a bunny clip wants to know whose side she's on!\""
    },
    { text: "The small girl turns and looks you up and down. It does not take long." },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"Him?\" Dubious. Sharp. \"The one in the rain jacket?\""
    },
    {
      text: "You have been looking for a way to be unnoticed on this ship for nine hours. It has just been taken from you in front of half the passengers."
    },
    { sfx: "ping" },
    { flag: "lounge_seen" },
    { flag: "gideon_rule_stated" },
    { flag: "rowan_singled_out" },
    { flag: "told_wildcard" },
    { flag: "ship_knows_wildcard" },
    { label: "top" },
    {
      prompt: "What do you do?",
      choice: [
        {
          text: "\"Hold on. I'm not anybody's hurdle. If she wants a game with you, she's earned one by standing there for twenty minutes.\"",
          goto: "opt_6",
          when: (s)=>(!!!s.flags["defended_inya_publicly"]&&!!!s.flags["stepped_past_inya"])
        },
        {
          text: "\"Was I wrong to say it? I'd rather ask you than guess.\"",
          goto: "opt_7",
          when: (s)=>(!!s.flags["defended_inya_publicly"]&&!!!s.flags["inya_asked_back"])
        },
        {
          text: "\"At least tell me your name. I'd like to know who I stood up for.\"",
          goto: "opt_8",
          when: (s)=>(!!s.flags["defended_inya_publicly"]&&!!!s.flags["met_inya"])
        },
        {
          text: "\"All right. If she's willing, I'll play her. That's easy enough.\"",
          goto: "opt_9",
          when: (s)=>!!!s.flags["stepped_past_inya"]
        },
        {
          text: "\"Gideon. I'll play you myself. She's waited long enough.\"",
          goto: "opt_10",
          when: (s)=>(!!s.flags["defended_inya_publicly"]&&!!!s.flags["stepped_past_inya"])
        },
        {
          text: "\"What is this really about? You don't care what colour her collar is, do you?\"",
          goto: "opt_11",
          when: (s)=>!!!s.flags["gideon_curious_aloud"]
        },
        {
          text: "Say nothing and stay by the stairs, watching how it goes.",
          goto: "opt_12",
          when: (s)=>!!!s.flags["lounge_silent"]
        },
        {
          text: "\"Step aside. You're shaking. I'll handle him.\"",
          goto: "opt_13",
          when: (s)=>(!!!s.flags["defended_inya_publicly"]&&!!!s.flags["stepped_past_inya"])
        },
        { text: "Leave them to it, and go back up the stairs.", goto: "opt_14" }
      ]
    },
    { jump: "choiceend_5" },
    { label: "opt_6" },
    {
      say: "rowan",
      text: "\"Hold on. I'm not anybody's hurdle. If she wants a game with you, she's earned one by standing there for twenty minutes.\""
    },
    { say: "gideon", alias: "Boy in white gloves", text: "\"How noble. And how entirely beside the point.\"" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Gideon Pryce. Since you have chosen to join the conversation.\""
    },
    { text: "He does not offer a gloved hand." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"And you are Vance. The ink name.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["gideon"]) s.names["gideon"] = "Gideon Pryce"; if (io && io.popup && !s.flags["met_gideon"]) io.popup({ type: 'met', id: "gideon", name: "Gideon Pryce" }); }
    },
    { flag: "met_gideon" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"I didn't ask you to speak for me.\"" },
    {
      text: "Fast, flat. But the amber eyes have moved from you to him, and back again, and something in the set of her chin has changed."
    },
    {
      add: { aff_gideon: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Showed some nerve" }); } },
    { flag: "defended_inya_publicly" },
    { time: 2 },
    { jump: "top" },
    { jump: "choiceend_5" },
    { label: "opt_7" },
    { say: "rowan", text: "\"Was I wrong to say it? I'd rather ask you than guess.\"" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"…You asked.\" Grudging, and quieter. \"Don't do it again without asking. But — it was a good line.\""
    },
    { say: "gideon", alias: "Boy in white gloves", text: "\"How touching. Do carry on, the table has all morning.\"" },
    {
      add: { aff_inya: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Asked her first" }); } },
    { flag: "inya_asked_back" },
    { time: 2 },
    { jump: "top" },
    { jump: "choiceend_5" },
    { label: "opt_8" },
    { say: "rowan", text: "\"At least tell me your name. I'd like to know who I stood up for.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya. Bell.\"" },
    { text: "She says it like a password." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"And you're Vance. I heard.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    { time: 1 },
    { jump: "top" },
    { jump: "choiceend_5" },
    { label: "opt_9" },
    { say: "rowan", text: "\"All right. If she's willing, I'll play her. That's easy enough.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"How obliging.\" The thinnest possible smile. \"Miss?\"" },
    { when: (s)=>!(!!s.flags["defended_inya_publicly"]), jump: "next_16" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"…Fine.\" A beat. \"I'll play you. But only because I asked myself first.\""
    },
    { jump: "end_15" },
    { label: "next_16" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"…Fine.\" A beat. \"I'll play you. But I'm not doing it because he said so. I'm doing it because I want to see if you're any good.\""
    },
    { label: "end_15" },
    { when: (s)=>!(!!!s.flags["met_inya"]), jump: "next_19" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Inya Bell. Remember it.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    { label: "next_19" },
    { label: "end_18" },
    { when: (s)=>!(!!!s.flags["met_gideon"]), jump: "next_21" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Gideon Pryce. I shall remember hers, Vance, as well as yours.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["gideon"]) s.names["gideon"] = "Gideon Pryce"; if (io && io.popup && !s.flags["met_gideon"]) io.popup({ type: 'met', id: "gideon", name: "Gideon Pryce" }); }
    },
    { flag: "met_gideon" },
    { label: "next_21" },
    { label: "end_20" },
    {
      add: { aff_inya: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Took her up on it" }); } },
    { flag: "inya_engaged" },
    { flag: "inya_accepted_rowan" },
    { scene: "table_rowan_vs_inya" },
    { end: true },
    { jump: "choiceend_5" },
    { label: "opt_10" },
    { say: "rowan", text: "\"Gideon. I'll play you myself. She's waited long enough.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Will you.\"" },
    { flag: "gideon_challenge_said" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"Hey. That's — \" She stops. \"…Fine. Do it. But if you lose, I'm owed a real game.\""
    },
    { flag: "inya_yielded" },
    { scene: "table_challenge_gideon" },
    { end: true },
    { jump: "choiceend_5" },
    { label: "opt_11" },
    { say: "rowan", text: "\"What is this really about? You don't care what colour her collar is, do you?\"" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"I care about the Wildcard. The Academy has not let one in for six years. I should like to see what it thought worth a late seat.\""
    },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Gideon Pryce. Forgive me. I take an interest in everybody. It saves time later.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["gideon"]) s.names["gideon"] = "Gideon Pryce"; if (io && io.popup && !s.flags["met_gideon"]) io.popup({ type: 'met', id: "gideon", name: "Gideon Pryce" }); }
    },
    { flag: "met_gideon" },
    {
      add: { aff_gideon: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Asked him directly" }); }
    },
    { flag: "gideon_curious_aloud" },
    { time: 2 },
    { jump: "top" },
    { jump: "choiceend_5" },
    { label: "opt_12" },
    {
      text: "Half the ship is looking at you, and you look back at none of them. The engine thrums under the floor. A gull, outside the window, screams."
    },
    { text: "The pale boy waits with great patience. The small girl, after a moment, folds her arms." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_23" },
    { say: "nathan", text: "\"Say something,\"" },
    { text: "in a whisper that could be heard from the funnel." },
    { say: "nathan", text: "\"SAY something, Rowan.\"" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_25" },
    { say: "baylee", text: "\"Let him think.\"" },
    { label: "next_25" },
    { label: "end_24" },
    { label: "next_23" },
    { label: "end_22" },
    { flag: "lounge_silent" },
    { time: 2 },
    { jump: "top" },
    { jump: "choiceend_5" },
    { label: "opt_13" },
    { say: "rowan", text: "\"Step aside. You're shaking. I'll handle him.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Excuse me?\"" },
    { say: "rowan", text: "\"You're shaking. I'll take the game.\"" },
    { text: "Her eyes narrow into two amber slits." },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"I am NOT shaking. And I don't need anybody to 'handle' anybody. Inya Bell. Remember it, because you'll never speak for me again.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    { text: "She turns her back on you, very precisely, and does not turn round again." },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"Gideon Pryce. A lesson in manners, Vance. I do appreciate a free one.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["gideon"]) s.names["gideon"] = "Gideon Pryce"; if (io && io.popup && !s.flags["met_gideon"]) io.popup({ type: 'met', id: "gideon", name: "Gideon Pryce" }); }
    },
    { flag: "met_gideon" },
    {
      add: { aff_inya: -3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: -3, why: "Talked down to her" }); } },
    { flag: "stepped_past_inya" },
    { flag: "inya_shut_out" },
    { time: 3 },
    { end: true },
    { jump: "choiceend_5" },
    { label: "opt_14" },
    {
      text: "You have no stake in this table, whatever it thinks. The saloon door sighs shut behind you, and the voices drop to a murmur."
    },
    { time: 3 },
    { end: true },
    { jump: "choiceend_5" },
    { label: "choiceend_5" }
  ]
});

scene("inya_finds_rowan", {
  steps: [
    {
      when: (s)=>s.location==="ferry_lounge",
      text: "A small figure with two mint-green tails and a bunny-shaped clip leaves the end of the card table, marches the length of the saloon and plants herself directly in front of you. Her deck box, a bunny charm swinging from its clasp, is clamped to her chest in both hands. She has the look of a person who has run out of better ideas."
    },
    {
      when: (s)=>s.location!=="ferry_lounge",
      text: "A small figure with two mint-green tails and a bunny-shaped clip marches the length of the deck and plants herself directly in front of you. Her deck box, a bunny charm swinging from its clasp, is clamped to her chest in both hands. She has the look of a person who has run out of better ideas."
    },
    { when: (s)=>!(!!!s.flags["met_inya"]), jump: "next_2" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"You. The one without the jacket. Inya Bell.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    { jump: "end_1" },
    { label: "next_2" },
    { say: "inya", text: "\"Rowan.\"" },
    { label: "end_1" },
    { when: (s)=>!!s.flags["lounge_seen"], say: "inya", text: "\"He says I have to beat you before he'll play me. So: you. I've asked everyone else and they all said after docking, and after docking is too late. Sit.\"" },
    { when: (s)=>!s.flags["lounge_seen"], say: "inya", text: "\"There's one real card table on this ship, down in the lounge, and a boy in white gloves who won't let me sit at it. Gideon Pryce. Winner stays, loser carries the winner's luggage up the hill, and he says he'll only play me once I've beaten somebody he's heard of.\"" },
    { when: (s)=>!s.flags["lounge_seen"], say: "inya", text: "\"He picked the name in ink at the bottom of the list. No jacket: that's you. So: you. I've asked everyone else and they all said after docking, and after docking is too late. Sit.\"" },
    {
      add: { ferry_talked: 1 }
    },
    { flag: "inya_engaged" },
    {
      choice: [
        { text: "\"All right. Where would you like to play?\"", goto: "opt_5" },
        { text: "\"I will, but only if you want a real game, not just a test. Do you?\"", goto: "opt_6" },
        {
          text: "\"I'm sorry, but I don't want to be used as a stepping stone. Can I try talking to him first?\"",
          goto: "opt_7"
        },
        {
          text: "\"I can't. I haven't played anyone on a real table yet, and I'm not ready to start with an audience.\"",
          goto: "opt_8"
        }
      ]
    },
    { jump: "choiceend_4" },
    { label: "opt_5" },
    { say: "rowan", text: "\"All right. Where would you like to play?\"" },
    { say: "inya", text: "\"Anywhere. The lounge. In front of him.\"" },
    { text: "Fast and fierce, but there is a thread of relief in it." },
    { say: "inya", text: "\"Thank you.\"" },
    { flag: "inya_accepted_rowan" },
    { goto: "ferry_lounge", travel: 2 },
    { scene: "table_rowan_vs_inya" },
    { jump: "choiceend_4" },
    { label: "opt_6" },
    { say: "rowan", text: "\"I will, but only if you want a real game, not just a test. Do you?\"" },
    { say: "inya", text: "\"…A real game.\"" },
    { text: "She looks at the deck box." },
    { say: "inya", text: "\"Yes. Obviously yes.\"" },
    {
      add: { aff_inya: 4 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 4, why: "Wanted it to be a real game" }); }
    },
    { flag: "rowan_offered_real_game" },
    { flag: "inya_accepted_rowan" },
    { goto: "ferry_lounge", travel: 2 },
    { scene: "table_rowan_vs_inya" },
    { jump: "choiceend_4" },
    { label: "opt_7" },
    {
      say: "rowan",
      text: "\"I'm sorry, but I don't want to be used as a stepping stone. Can I try talking to him first?\""
    },
    { say: "inya", text: "\"He won't listen.\" A beat. \"But — okay. Try.\"" },
    {
      add: { aff_inya: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Was straight with her" }); }
    },
    { goto: "ferry_lounge", travel: 2 },
    { scene: "table_vouch" },
    { jump: "choiceend_4" },
    { label: "opt_8" },
    {
      say: "rowan",
      text: "\"I can't. I haven't played anyone on a real table yet, and I'm not ready to start with an audience.\""
    },
    { say: "inya", text: "\"Oh.\"" },
    { text: "The fierce expression slips for a second into something much younger." },
    { say: "inya", text: "\"You're — oh. That's — honest.\"" },
    { say: "inya", text: "\"Then I'll wait. I'll just wait. For something.\"" },
    {
      add: { aff_inya: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Was honest about his nerves" }); }
    },
    { flag: "told_inya_nerves" },
    { jump: "choiceend_4" },
    { label: "choiceend_4" },
    { time: 5 }
  ]
});

scene("table_default", {
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(s.location==="ferry_lounge"), jump: "next_4" },
    { bg: "ferry_lounge" },
    { text: "The pale boy at the card table looks at the clock, then at the girl at the end of his table, who has not moved." },
    { say: "gideon", text: "\"We dock in half an hour. The table is closed.\"" },
    { text: "He gathers his gloves, one by one." },
    { say: "gideon", text: "\"Do give my regards to the Commons.\"" },
    {
      text: "He rises. The girl does not follow him with her eyes. She stays exactly where she is, deck box in both hands, until the crowd has drifted off and the benches have emptied."
    },
    {
      text: "After a long moment she puts the deck box into her pocket and walks out onto the fore deck without a word."
    },
    { jump: "end_3" },
    { label: "next_4" },
    {
      text: "You hear about it second-hand, at the rail, from somebody who was in the lounge: the boy in the white gloves shut the card table at five past ten, the little girl with the green hair never got her game, and the bookmaker paid out nobody."
    },
    { label: "end_3" },
    { flag: "ferry_table_denied" },
    { flag: "table_resolved" },
    { scene: "table_payout" }
  ]
});

scene("inya_rolls", {
  background: "ferry_lounge",
  steps: [
    { text: "At the galley hatch, the woman in the apron looks from one of you to the other and asks no questions." },
    { when: (s)=>!(!!s.flags["inya_paid_rolls"]), jump: "next_2" },
    {
      text: "Inya counts six Smug Coins onto the counter one at a time, as though each of them had personally disappointed her. \"Two,\" she says, in the voice of somebody ordering a sentence."
    },
    { jump: "end_1" },
    { label: "next_2" },
    { coins: -6 },
    {
      text: "You count six Smug Coins out of the pouch. Inya reads every coin as it goes down, as though she were checking your arithmetic."
    },
    { label: "end_1" },
    {
      text: "Two cinnamon rolls slide across the counter, still warm and slightly flattened where something heavy has sat on them."
    },
    {
      text: "The only free bit of bench is under a window, with the island framed in it like a postcard. You sit. She sits at the other end, cross-legged on the cushion, her deck box between you like a chaperone."
    },
    { say: "inya", text: "\"Rule. Nobody says the word 'rabbit' while there is icing.\"" },
    {
      text: "She eats hers in a very particular order: the outside spiral first, then the middle, then the last bite slowly, with her eyes shut."
    },
    { when: (s)=>!(!!s.flags["inya_paid_rolls"]), jump: "next_5" },
    {
      say: "inya",
      text: "\"I lost, and I'm sitting here, and I'm happy. That's not a thing that usually goes together.\""
    },
    { text: "She says it to the window." },
    { say: "inya", text: "\"Don't make it weird.\"" },
    { jump: "end_4" },
    { label: "next_5" },
    {
      say: "inya",
      text: "\"I won, and the winner's allowed to be smug about the rolls. That's a Smug Coin joke. I'm allowed to make those.\""
    },
    { label: "end_4" },
    {
      choice: [
        { text: "\"How do you tell one breed from another, anyway? Is it the ears?\"", goto: "opt_8" },
        { text: "\"What did you really think of him? The one in the gloves.\"", when: (s)=>!!s.flags["lounge_seen"], goto: "opt_9" },
        { text: "Eat, and say nothing, and watch the island get bigger.", goto: "opt_10" }
      ]
    },
    { jump: "choiceend_7" },
    { label: "opt_8" },
    { say: "rowan", text: "\"How do you tell one breed from another, anyway? Is it the ears?\"" },
    { say: "inya", text: "\"It's not *only* the ears.\"" },
    { text: "Flat, brisk, the tone other people keep for tax law." },
    {
      say: "inya",
      text: "\"Holland Lop: ears hang, face is a brick. Mini Rex: ears stand, coat's like velvet. Flemish Giant: it isn't the ears at all, it's that you can't lift it. I've had rabbits since I was five.\""
    },
    { say: "rowan", text: "\"I thought you said no rabbits during icing.\"" },
    { say: "inya", text: "\"That was a rule for *you*.\"" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["inya"] = s.notes["inya"] || []); if (a.indexOf("Has kept rabbits since she was five and knows every breed by the length of its ears.") < 0) a.push("Has kept rabbits since she was five and knows every breed by the length of its ears."); }
    },
    {
      add: { aff_inya: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Asked about the rabbits" }); }
    },
    { jump: "choiceend_7" },
    { label: "opt_9" },
    { say: "rowan", text: "\"What did you really think of him? The one in the gloves.\"" },
    {
      say: "inya",
      text: "\"That he's scared.\" A mouthful of roll. \"People who need a wall that tall are scared of something. I just don't know what yet.\""
    },
    { when: (s)=>!!s.flags["rowan_singled_out"] && !s.flags["ferry_table_won"] && !s.flags["ferry_table_lost"], say: "rowan", text: "\"He said I'd carry his cases if I lost.\"" },
    {
      when: (s)=>!!s.flags["rowan_singled_out"] && !s.flags["ferry_table_won"] && !s.flags["ferry_table_lost"],
      say: "inya",
      text: "\"He'd have carried yours if you'd won. People don't say that about him. It's the only fair thing about him.\""
    },
    { jump: "choiceend_7" },
    { label: "opt_10" },
    {
      text: "You eat. The island, in its window, slides a little closer. For nearly a minute neither of you says anything, and it does not feel like a silence you have to fix."
    },
    { jump: "choiceend_7" },
    { label: "choiceend_7" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_12" },
    {
      say: "nathan",
      text: "\"Are those CINNAMON ROLLS? Is there a THIRD ROLL? Baylee, they've got rolls and they didn't TELL us!\"",
      mood: "happy"
    },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_14" },
    { say: "baylee", text: "\"You had one at six.\"" },
    { say: "nathan", text: "\"That was in a different TIME.\"" },
    { label: "next_14" },
    { label: "end_13" },
    { label: "next_12" },
    { label: "end_11" },
    { text: "She licks the icing off her thumb, stands, and tucks the deck box under her arm." },
    { say: "inya", text: "\"Rematch. When I'm ready. You'll know. It'll be loud.\"" },
    { time: 8 }
  ]
});

scene("isle_gideon", {
  steps: [
    { when: (s)=>!!s.flags["isle_gideon_done"], jump: "later" },
    { text: "Four small white domes stand in a row on the lawn, and the Spectral first-years stand in front of them in a loose knot of white-and-gold collars, pretending not to watch the doors. One of them stands a little apart, at the edge, where he can see everybody's hands. The white gloves are on." },
    { when: (s)=>!s.flags["met_gideon"], say: "gideon", alias: "Boy in white gloves", text: "\"Vance. They read you out last on the Quad, and in a different voice. I noticed. I expect you did.\"" },
    { when: (s)=>!s.flags["met_gideon"], say: "gideon", alias: "Boy in white gloves", text: "\"Gideon Pryce. Spectral Tower. I should offer to shake hands, but I am waiting for a game, and I never do before one.\"" },
    { when: (s)=>!!s.flags["met_gideon"], say: "gideon", text: "\"Vance.\"" },
    MET("gideon", "Gideon Pryce"),
    { when: (s)=>!!s.flags["ferry_table_won"], say: "gideon", text: "\"Your duffel is at your door. I carried it down myself; one pays one's own stakes.\" A pause. \"So I have now seen the cove. From the path. I did not go in.\"" },
    { when: (s)=>!!s.flags["ferry_table_lost"], say: "gideon", text: "\"The cases arrived unscuffed. I checked the corners.\" He says it as a compliment, and it very nearly is one. \"You did not complain on the hill. I had allowed for complaining.\"" },
    { when: (s)=>!!s.flags["ferry_inya_won"], say: "gideon", text: "\"I have carried a duffel with a rabbit on the zip the full length of the cove, past eight porches.\" Not a muscle moves. \"People came out to look. I am told it will have been good for me.\"" },
    { when: (s)=>!!s.flags["ferry_inya_lost"], say: "gideon", text: "\"Miss Bell carried all four cases to the Tower door, and would not let the porter take one.\" He considers the dome in front of him. \"I had not allowed for that. I have made a note.\"" },
    { when: (s)=>!!s.flags["ferry_table_settled"], say: "gideon", text: "\"Nobody carried anything up the hill but his own.\" The thin smile. \"It was a strange sensation. I find I do not altogether object to it.\"" },
    { text: "A dome door opens. Somebody comes out very red in the face, and somebody else goes in. His eyes follow both, and return." },
    { say: "gideon", text: "\"They call us by tower, and then by letter. I am P. I have stood here an hour, and I can tell you what nine people play from the way they came out of that door.\"" },
    { when: (s)=>!!s.flags["placement_won"], say: "gideon", text: "\"You won yours. Dome two, against a repeating year. The board by the path is public; I read it before I read my own.\"" },
    { when: (s)=>!!s.flags["placement_lost"], say: "gideon", text: "\"You lost yours. Dome two, to a repeating year. The board by the path is public; I read it before I read my own. I should not let it weigh; it is one number, and they have a whole year in which to change it.\"" },
    { when: (s)=>!s.flags["placement_done"] && !s.flags["placement_won"] && !s.flags["placement_lost"], say: "gideon", text: "\"You have not been in yet. They call the cove at half past one. I shall be reading the board; your line before my own.\"" },
    { choice: [
      { text: "\"You looked for my name before your own?\"", steps: [
        { say: "rowan", text: "\"You looked for my name before your own?\"" },
        { say: "gideon", text: "\"I look for every name.\" He straightens one cuff of one glove. \"Yours is merely the one I look for first. Do not read into it. Everyone else here will be reading into it for you.\"" },
        AFF("gideon", 1, "Asked him straight")
      ] },
      { text: "\"Are you nervous?\"", steps: [
        { say: "rowan", text: "\"Are you nervous?\"" },
        { say: "gideon", text: "\"…No.\"" },
        { text: "The gloves are adjusted, finger by finger, which they did not need." },
        { say: "gideon", text: "\"One is not nervous of a measurement, Vance. One is nervous of whoever is holding the ruler.\" He glances, once, at the tall figure in the doorway of the furthest dome. \"I should like to know who that is, today.\"" },
        AFF("gideon", 2, "Asked, without mocking")
      ] },
      { text: "\"And the view from suite five?\"", when: (s)=>!!s.flags["gideon_said_cove"], steps: [
        { say: "rowan", text: "\"And the view from suite five?\"" },
        { say: "gideon", text: "\"Exactly as described. The Quad, the gate, the harbour, these domes. Everything but the cove, which is behind a hill, as the plans said it would be.\"" },
        { when: (s)=>!!s.flags["gideon_invited"], say: "gideon", text: "\"Your invitation stands, I take it.\" He does not look at you to say it. \"I have not decided. I merely ask whether it stands.\"" },
        { when: (s)=>!s.flags["gideon_invited"], say: "gideon", text: "\"It is a very fine view.\" He says it the way one reads out an inventory. \"There is nobody in it whom I know.\"" }
      ] }
    ] },
    { say: "gideon", text: "\"They are at K. You will forgive me if I watch the door.\"" },
    NOTE("gideon", "Waited an hour at the Trial Domes reading other people's decks off their faces. Reads the public board for your name first."),
    { flag: "isle_gideon_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "He has not moved from the edge of the group. A small black notebook goes back into his inside pocket as you come up, without hurry." },
    { say: "gideon", text: "\"Vance. They are at M. Two more, and then I shall be obliged to stop watching and be watched.\"" },
    { say: "gideon", text: "\"Go and see your cove. Somebody ought to.\"" },
    { time: 3 }
  ]
});

scene("isle_anni", {
  steps: [
    { when: (s)=>!!s.flags["isle_anni_done"], jump: "later" },
    { text: "The door of the first dome has been propped open for the heat. Exactly in line with it, on the lawn, heels together, stands a girl in an immaculate black jacket and a red tie, with a small grey booklet open in one hand and a red pen in the other. The pen is not moving." },
    { when: (s)=>!s.flags["met_anni"], say: "anni", alias: "Girl with a red pen", text: "\"You are standing in the sightline. One step to the left, please. Thank you.\"" },
    { when: (s)=>!s.flags["met_anni"], say: "anni", alias: "Girl with a red pen", text: "\"Mr Vance. I heard the roll.\" A very small, very correct nod. \"Brandt, Anneliese. Auxiliary, judging track, Spectral Tower. Anni, if it must be short.\"" },
    { when: (s)=>!!s.flags["met_anni"], say: "anni", text: "\"Mr Vance. One step to the left, please. You are in the sightline. Thank you.\"" },
    { when: (s)=>!!s.flags["met_anni"], say: "anni", text: "\"The ferry came to nineteen. I handed the list in at the porter's lodge.\" Her mouth goes thin. \"He said 'thank you, miss,' and put it under a mug.\"" },
    MET("anni", "Anneliese Brandt"),
    { text: "Through the open door you can see a round table under a ring of lights, and beside it a young woman with a sleek black bob and red-framed glasses, standing by a high-backed chair." },
    { say: "anni", text: "\"That is Ms Kirishima. Rules and Judging. I have been watching her for forty minutes, and I have not written anything down for ten.\"" },
    { say: "anni", text: "\"She told a boy not to narrate his emotions. He was crying at the time. He stopped. I should very much like to know how that is done.\"" },
    { choice: [
      { text: "\"Ten minutes without writing. Is that a good sign?\"", steps: [
        { say: "rowan", text: "\"Ten minutes without writing. Is that a good sign?\"" },
        { say: "anni", text: "\"It is the best ten minutes of my day.\" Quite seriously. \"Nothing is happening in there that needs me. I had not known that a room could do that.\"" },
        AFF("anni", 1, "Asked what it meant")
      ] },
      { text: "\"You could ask her how it's done.\"", steps: [
        { say: "rowan", text: "\"You could ask her how it's done.\"" },
        { say: "anni", text: "\"One does not interrupt a judge at a table.\"" },
        { text: "The flush starts at the collar. She speaks faster." },
        { say: "anni", text: "\"Afterwards. Possibly. If she is not busy. She will be busy. I shall have a question prepared in case she is not.\"" },
        AFF("anni", 2, "Told her to ask")
      ] },
      { text: "\"She said 'noted' when I told her my hands shake.\"", when: (s)=>!!s.flags["nerve_admitted"], steps: [
        { say: "rowan", text: "\"She said 'noted' when I told her my hands shake.\"" },
        { say: "anni", text: "\"You stated it? Aloud, at the table?\" The pen comes up, and stops. \"That is the correct procedure. Most people hide them, and hands out of sight are an actual infraction.\"" },
        { say: "anni", text: "\"I am not writing that down. I am remembering it. It is a different shelf.\"" },
        AFF("anni", 2, "Was honest at the table")
      ] }
    ] },
    { say: "anni", text: "\"The Tower has given me suite three. There is no lights-out posted anywhere on the corridor.\" She turns a page to show you a paragraph in red, very neat, with a time in it. \"I have drafted one. Somebody has to stand at the end of a corridor and mean it.\"" },
    { say: "rowan", text: "\"And that's you.\"" },
    { say: "anni", text: "\"There were no other candidates.\" A beat, and then, more quietly: \"I did look.\"" },
    NOTE("anni", "Spent the afternoon watching Ms Kirishima judge. Has drafted a lights-out for her corridor in the Spectral Tower."),
    { flag: "isle_anni_done" },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "She has moved exactly as far as the shade has, and no further. The booklet is closed on one finger." },
    { say: "anni", text: "\"Mr Vance. Dome one has had a single appeal. It was denied, correctly, in two sentences.\"" },
    { say: "anni", text: "\"I counted the sentences. Good afternoon.\"" },
    { time: 3 }
  ]
});

scene("isle_inya", {
  steps: [
    { when: (s)=>!!s.flags["isle_inya_done"], jump: "later" },
    { text: "Bungalow 3 has bunny bunting over the door and three beds inside it. One is hidden behind a sheet hung from the rafters like a wall. One is made with hospital corners under a wardrobe door that has a spreadsheet pinned inside it. On the third, by the door, a small girl with mint-green tails is sitting cross-legged in the middle of everything she owns." },
    { when: (s)=>!s.flags["met_inya"], say: "inya", alias: "Girl with the bunny clip", text: "\"You're letting the flies in. In or out. …You're the Wildcard. They read you out last.\"" },
    { when: (s)=>!s.flags["met_inya"], say: "inya", alias: "Girl with the bunny clip", text: "\"Inya Bell. Bed by the door. Don't sit on the hoodies, they're in an order.\"" },
    { when: (s)=>!s.flags["met_inya"], say: "rowan", text: "\"Rowan.\"" },
    { when: (s)=>!!s.flags["met_inya"], say: "inya", text: "\"Rowan. In or out, you're letting the flies in. Don't sit on the hoodies, they're in an order.\"" },
    MET("inya", "Inya Bell"),
    { when: (s)=>!!s.flags["ferry_inya_won"], say: "inya", text: "\"He carried it. All the way to this door.\" She points at the step, as at a monument. \"He didn't come in. He looked at the bunting for about four seconds and said 'Miss Bell' and left. I'm keeping the four seconds.\"" },
    { when: (s)=>!!s.flags["ferry_table_lost"] && !s.flags["inya_asked_first"], say: "inya", text: "\"Four cases, up that hill. Show me your hands.\" She looks, briskly, the way one checks a rabbit's feet. \"…You'll live. Don't do that for me again without asking.\"" },
    { when: (s)=>!!s.flags["ferry_table_lost"] && !!s.flags["inya_asked_first"], say: "inya", text: "\"Four cases, up that hill. Show me your hands.\" She looks, briskly, the way one checks a rabbit's feet. \"…You'll live.\"" },
    { when: (s)=>!!s.flags["ferry_table_won"], say: "inya", text: "\"I saw him go past with your duffel. On his shoulder. In the gloves.\" A tiny, fierce grin. \"The whole row came out. Nobody said a word. It was the best thing I've seen all day.\"" },
    { when: (s)=>!!s.flags["ferry_inya_lost"], say: "inya", text: "\"Four cases. Tower door. I didn't let the porter touch one.\" She flexes her fingers. \"It's written down. One line. Don't ask what it says.\"" },
    { text: "She goes on unpacking while she talks: four notebooks squared on the shelf, a tiny radio, a paper bag of carrots, the deck box last and nearest the pillow." },
    { say: "inya", text: "\"Three beds, one wardrobe, a spreadsheet I've been told not to touch, and a wall made out of a sheet. It's the best room I've ever had. Don't tell the tower.\"" },
    { choice: [
      { text: "\"The best? It's a third of a bungalow.\"", steps: [
        { say: "rowan", text: "\"The best? It's a third of a bungalow.\"" },
        { say: "inya", text: "\"It's a third of a bungalow with *people* in it.\" She turns the little radio over in her hands. \"You can hear the whole row from this bed. Somebody's got a megaphone. It's loud. I like loud.\"" },
        AFF("inya", 1, "Asked why it's the best")
      ] },
      { text: "\"Is the bunting yours?\"", steps: [
        { say: "rowan", text: "\"Is the bunting yours?\"" },
        { say: "inya", text: "\"Obviously.\" Flat as tax law. \"It went up before the bag went down. A door should say who's behind it. Then nobody can say they weren't warned.\"" },
        AFF("inya", 1, "Noticed the bunting")
      ] },
      { text: "\"The tower has suites.\"", steps: [
        { say: "rowan", text: "\"The tower has suites.\"" },
        { say: "inya", text: "\"The tower has one person per room and a view of people who aren't them.\" She bites a carrot in half. \"I've got a porch and a woman with a ladle. I win. Want one? They're crunchy. That's the whole pitch.\"" },
        AFF("inya", 2, "Got offered a carrot")
      ] }
    ] },
    { when: (s)=>!!s.flags["placement_won"], say: "inya", text: "\"You won your placement. It's all over the row.\" A narrow look. \"Good. Then you're still worth beating.\"" },
    { when: (s)=>!!s.flags["placement_lost"], say: "inya", text: "\"You lost your placement. It's all over the row.\" She holds out a pencil stub, not a notebook. \"One line. What you should have done. Your own paper.\"" },
    { when: (s)=>!s.flags["placement_won"] && !s.flags["placement_lost"], say: "inya", text: "\"They call us at half one. I'm B, so I'm early, and you're V, so you get to watch everyone else first. I can't decide which is worse.\"" },
    NOTE("inya", "Has the bed by the door in bungalow 3 and calls it the best room she has ever had."),
    { flag: "isle_inya_done" },
    { choice: [
      { text: "Sit down on the step and talk a while.", when: (s)=>!s.flags["chat_inya_done"], steps: [
        { scene: "chat_inya" }
      ] },
      { text: "Leave her to the unpacking.", steps: [
        { say: "rowan", text: "\"I'll leave you to it.\"" },
        { say: "inya", text: "\"Supper's at six. Mind the bunting on your way out, it's level.\"" }
      ] }
    ] },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "The hoodies are in a drawer now. She is sitting on the bed with the deck box in her lap and her eyes shut, not shuffling." },
    { when: (s)=>!s.flags["chat_inya_x"], say: "inya", text: "\"I'm thinking.\" One amber eye opens. \"You can stay if you're quiet, or you can talk and I'll pretend I was finished.\"" },
    { when: (s)=>!!s.flags["chat_inya_x"], say: "inya", text: "\"I'm thinking. It's harder without the weight.\" One amber eye opens. \"You can stay if you're quiet, or you can talk and I'll pretend I was finished.\"" },
    { choice: [
      { text: "Talk.", when: (s)=>!s.flags["chat_inya_done"], steps: [
        { scene: "chat_inya" }
      ] },
      { text: "Go quietly.", steps: [
        { text: "You go quietly. The bunting does not so much as swing." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("isle_tomi", {
  steps: [
    { when: (s)=>!!s.flags["isle_tomi_done"], jump: "later" },
    { text: "Bungalow 5 has a hand-painted sign propped on its step: TRADES — ASK TOMI. Behind the sign, on the step itself, sits a small quick boy in a yellow bandana with a binder open on each knee and a pencil behind each ear. A map of the island is taped to the railing above him, every forbidden place circled in red." },
    { when: (s)=>!s.flags["met_tomi"], say: "tomi", alias: "Boy in a yellow bandana", text: "\"Wildcard! Last name on the roll and the only one anybody clapped for. I had a line on that. Don't ask which way.\"" },
    { when: (s)=>!s.flags["met_tomi"], say: "tomi", alias: "Boy in a yellow bandana", text: "\"Tomás Reyes. Tomi. The sign's me. Binders, odds, and whatever I've heard since breakfast. Friend price. Everybody's a friend, the price is the price.\"" },
    { when: (s)=>!!s.flags["met_tomi"], say: "tomi", text: "\"Wildcard! Welcome to head office. Mind the step, the step is the counter.\"" },
    MET("tomi", "Tomás Reyes"),
    { when: (s)=>!!s.flags["placement_won"] || !!s.flags["placement_lost"], say: "tomi", text: "\"And you didn't throw up! In front of the whole dome!\" He shows you a line in the binder with a tick beside it. \"Ten coins. I'd buy you something, but I'm thinking it very warmly instead.\"" },
    { when: (s)=>!s.flags["placement_won"] && !s.flags["placement_lost"], say: "tomi", text: "\"They call the Commons at half one. I'm doing the running; nobody asked me to, I just know where everybody is. And I've got ten on you not throwing up, so eat light.\"" },
    { when: (s)=>!!s.flags["tomi_honest"], say: "tomi", text: "\"Ferry book's closed, by the way. Both sides, paid at the dock, like I said. It's in the lid if you want to check. Nobody ever checks. I leave it open anyway.\"" },
    { say: "tomi", text: "\"I told people everything's cheaper on the island by Friday.\" He turns one binder round. Every pencilled price has a fresh line through it. \"It's cheaper by *lunch*. There's a shop. I'm ruined, in a very small way.\"" },
    { say: "tomi", text: "\"And the roommates. One's circled every forbidden place on that map and numbered them. The other one made his bed, put a coil of rope on it, and left. I've opened a book. I feel bad about the odds.\"" },
    { choice: [
      { text: "\"What's the book on?\"", steps: [
        { say: "rowan", text: "\"What's the book on?\"" },
        { say: "tomi", text: "\"Which limb, and what day.\" He has the decency to wince. \"Left arm's the favourite. I told him, because that's only fair. He asked for a cut.\"" },
        { say: "rowan", text: "\"Did you give him one?\"" },
        { say: "tomi", text: "\"Ten per cent, if he's still got both arms on Sunday. That's not a bet. That's an incentive.\"" },
        AFF("tomi", 1, "Asked about the book")
      ] },
      { text: "\"Has the sign brought anybody in?\"", steps: [
        { say: "rowan", text: "\"Has the sign brought anybody in?\"" },
        { say: "tomi", text: "\"Three customers. One of them was Mama Odalys, with the ladle, wanting to know if I was licensed.\"" },
        { say: "tomi", text: "\"I said I was *supervised*. She said, by whom. I said, by you, as of now.\" He spreads his hands. \"She laughed. So I'm legal. That's how law works on a row.\"" },
        AFF("tomi", 1, "Asked after business")
      ] },
      { text: "\"Ruined by lunch. What do you do now?\"", steps: [
        { say: "rowan", text: "\"Ruined by lunch. What do you do now?\"" },
        { say: "tomi", text: "\"Same as always. Find out what the shop *doesn't* know.\" The pencil comes down from behind one ear. \"A shop knows what a card costs. It doesn't know who on this row needs it by Thursday, and who's got the other half.\"" },
        { say: "tomi", text: "\"That's not in a price. That's on a step, with your ears open. I'm keeping the sign.\"" },
        AFF("tomi", 2, "Asked what he'd do")
      ] }
    ] },
    NOTE("tomi", "Trades from the step of bungalow 5, and has opened a book on which limb his roommate breaks first."),
    { flag: "isle_tomi_done" },
    { choice: [
      { text: "Sit down on the step and talk a while.", when: (s)=>!s.flags["chat_tomi_done"], steps: [
        { scene: "chat_tomi" }
      ] },
      { text: "Leave him to the counter.", steps: [
        { say: "rowan", text: "\"I'll leave you to the counter.\"" },
        { say: "tomi", text: "\"Supper's at six. I've got two to one on fish. Don't tell the ladle.\"" }
      ] }
    ] },
    { time: 5 },
    { end: true },
    { label: "later" },
    { text: "The step has acquired a second sign, smaller, in pencil: NO CREDIT (ASK ANYWAY)." },
    { say: "tomi", text: "\"Wildcard! Still open. Still cheap. Getting cheaper while you stand there, honestly, it's a terrible location.\"" },
    { choice: [
      { text: "Sit down and talk a while.", when: (s)=>!s.flags["chat_tomi_done"], steps: [
        { scene: "chat_tomi" }
      ] },
      { text: "Wave and walk on.", steps: [
        { say: "tomi", text: "\"Come back with something to trade! Or a rumour! Rumours are free to bring in!\"" }
      ] }
    ] },
    { time: 3 }
  ]
});
