// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
world({
  followers: { nathan: "ferry_nathan", baylee: "ferry_baylee" },
  musicFiles: {
    ship: "music/bgm_score_schiffsdeck.ogg",
    plaza: "music/bgm_score_plaza.ogg",
    beach: "music/bgm_score_strand.ogg",
    kitchen: "music/bgm_score_cafeteria.ogg",
    dorm: "music/bgm_score_dorm.ogg",
    friends: "music/bgm_score_gespraeche_unter_freunden.ogg",
    emotional: "music/bgm_score_emotional.ogg",
    fun: "music/bgm_score_lustig.ogg",
    duel: "music/bgm_battle2.ogg"
  },
  title: "Pixel Academy",
  assets: { spriteUnit: 10, avatarUnit: 10 },
  start: { location: "ferry_deck", day: 1, time: "06:30", coins: 140, deck: "rowan" },
  music: "menu",
  defaultTravel: 8,
  dayEnd: { at: "23:30", wake: "07:00", scene: "sleep", location: "commons_room" },
  cast: {
    rowan: { name: "Rowan", portrait: "rowan", sprite: "rowan", color: "#f2a65a" },
    abel: { name: "Captain Stroud", portrait: "abel", sprite: "abel", color: "#c98b5a" },
    anni: { name: "Anni", portrait: "anni", sprite: "anni", color: "#a9b4ff" },
    ashdown: { name: "Prof. Ashdown", portrait: "ashdown", sprite: "ashdown", color: "#7ee081" },
    ashton: { name: "Ashton", portrait: "ashton", sprite: "ashton", color: "#f2a65a" },
    baraka: { name: "Baraka", portrait: "baraka", sprite: "baraka", color: "#6cc0ff" },
    baylee: { name: "Baylee", portrait: "baylee", sprite: "baylee", color: "#c98b5a" },
    bex: { name: "Bex", portrait: "bex", sprite: "bex", color: "#ff8fa3" },
    blum: { name: "Dr. Blum", portrait: "blum", sprite: "blum", color: "#a9b4ff" },
    branden: { name: "Branden", portrait: "branden", sprite: "branden", color: "#8fe3d6" },
    brant: { name: "Brant", portrait: "brant", sprite: "brant", color: "#b08b3a" },
    camille: { name: "Nurse Camille", portrait: "camille", sprite: "camille", color: "#c58bff" },
    cas: { name: "Cas", portrait: "cas", sprite: "cas", color: "#f2a65a" },
    cati: { name: "Cati", portrait: "cati", sprite: "cati", color: "#c58bff" },
    chuck: { name: "Chuck", portrait: "chuck", sprite: "chuck", color: "#7ee081" },
    dex: { name: "Dex", portrait: "dex", sprite: "dex", color: "#f2a65a" },
    dmitri: { name: "Dmitri", portrait: "dmitri", sprite: "dmitri", color: "#c58bff" },
    dom: { name: "Dom", portrait: "dom", sprite: "dom", color: "#8fe3d6" },
    eberhart: { name: "Eberhart", portrait: "eberhart", sprite: "eberhart", color: "#ffe14d" },
    ed: { name: "Ed", portrait: "ed", sprite: "ed", color: "#f2a65a" },
    eloise: { name: "Eloise", portrait: "eloise", sprite: "eloise", color: "#ff8fa3" },
    felix: { name: "Felix", portrait: "felix", sprite: "felix", color: "#7ee081" },
    fiona: { name: "Fiona", portrait: "fiona", sprite: "fiona", color: "#b08b3a" },
    freddie: { name: "Freddie", portrait: "freddie", sprite: "freddie", color: "#c58bff" },
    freya: { name: "Freya", portrait: "freya", sprite: "freya", color: "#b08b3a" },
    gani: { name: "Gani", portrait: "gani", sprite: "gani", color: "#b08b3a" },
    georgie: { name: "Georgie", portrait: "georgie", sprite: "georgie", color: "#a9b4ff" },
    gideon: { name: "Gideon", portrait: "gideon", sprite: "gideon", color: "#6cc0ff" },
    hana: { name: "Ms. Kirishima", portrait: "hana", sprite: "hana", color: "#6cc0ff" },
    hedda: { name: "Hedda", portrait: "hedda", sprite: "hedda", color: "#a9b4ff" },
    helical: { name: "Prof. Helical", portrait: "helical", sprite: "helical", color: "#8fe3d6" },
    imara: { name: "Imara", portrait: "imara", sprite: "imara", color: "#a9b4ff" },
    inya: { name: "Inya Bell", portrait: "inya", sprite: "inya", color: "#ffe14d" },
    isolde: { name: "Isolde", portrait: "isolde", sprite: "isolde", color: "#6cc0ff" },
    jessica: { name: "Jessica", portrait: "jessica", sprite: "jessica", color: "#7ee081" },
    josie: { name: "Josie", portrait: "josie", sprite: "josie", color: "#6cc0ff" },
    junho: { name: "Jun-ho", portrait: "junho", sprite: "junho", color: "#6cc0ff" },
    kenji: { name: "Kenji", portrait: "kenji", sprite: "kenji", color: "#ff8fa3" },
    keoni: { name: "Keoni", portrait: "keoni", sprite: "keoni", color: "#c98b5a" },
    leona: { name: "Leona", portrait: "leona", sprite: "leona", color: "#c58bff" },
    lilia: { name: "Lilia", portrait: "lilia", sprite: "lilia", color: "#ffe14d" },
    livvie: { name: "Livvie", portrait: "livvie", sprite: "livvie", color: "#ffe14d" },
    lucas: { name: "Lucas", portrait: "lucas", sprite: "lucas", color: "#7ee081" },
    magnus: { name: "Magnus", portrait: "magnus", sprite: "magnus", color: "#ff8fa3" },
    maisie: { name: "Maisie", portrait: "maisie", sprite: "maisie", color: "#8fe3d6" },
    marit: { name: "Marit", portrait: "marit", sprite: "marit", color: "#f2a65a" },
    marrow: { name: "Mr. Marrow", portrait: "marrow", sprite: "marrow", color: "#a9b4ff" },
    mika: { name: "Mika", portrait: "mika", sprite: "mika", color: "#6cc0ff" },
    mikoto: { name: "Mikoto", portrait: "mikoto", sprite: "mikoto", color: "#c58bff" },
    nathan: { name: "Nathan", portrait: "nathan", sprite: "nathan", color: "#a9b4ff" },
    noor: { name: "Noor", portrait: "noor", sprite: "noor", color: "#7ee081" },
    octavia: { name: "Octavia", portrait: "octavia", sprite: "octavia", color: "#b08b3a" },
    odalys: { name: "Mama Odalys", portrait: "odalys", sprite: "odalys", color: "#8fe3d6" },
    okonkwo: { name: "Chancellor Vicar", portrait: "okonkwo", sprite: "okonkwo", color: "#6cc0ff" },
    ophelia: { name: "Ophelia", portrait: "ophelia", sprite: "ophelia", color: "#8fe3d6" },
    oru: { name: "Madame Oru", portrait: "oru", sprite: "oru", color: "#a9b4ff" },
    pilar: { name: "Pilar", portrait: "pilar", sprite: "pilar", color: "#7ee081" },
    pippa: { name: "Pippa", portrait: "pippa", sprite: "pippa", color: "#6cc0ff" },
    priya: { name: "Priya", portrait: "priya", sprite: "priya", color: "#ff8fa3" },
    rafa: { name: "Rafa", portrait: "rafa", sprite: "rafa", color: "#8fe3d6" },
    rana: { name: "Rana", portrait: "rana", sprite: "rana", color: "#6cc0ff" },
    rex: { name: "Rex", portrait: "rex", sprite: "rex", color: "#b08b3a" },
    rox: { name: "Coach Rox", portrait: "rox", sprite: "rox", color: "#b08b3a" },
    sammy: { name: "Sammy", portrait: "sammy", sprite: "sammy", color: "#f2a65a" },
    santangel: { name: "Prof. Santángel", portrait: "santangel", sprite: "santangel", color: "#ff8fa3" },
    saoirse: { name: "Saoirse", portrait: "saoirse", sprite: "saoirse", color: "#c98b5a" },
    sebastian: { name: "Sebastian", portrait: "sebastian", sprite: "sebastian", color: "#6cc0ff" },
    selene: { name: "Selene", portrait: "selene", sprite: "selene", color: "#c98b5a" },
    shirin: { name: "Shirin", portrait: "shirin", sprite: "shirin", color: "#f2a65a" },
    silas: { name: "Silas", portrait: "silas", sprite: "silas", color: "#8fe3d6" },
    sunny: { name: "Sunny", portrait: "sunny", sprite: "sunny", color: "#ffe14d" },
    tariq: { name: "Tariq", portrait: "tariq", sprite: "tariq", color: "#b08b3a" },
    tavita: { name: "Tavita", portrait: "tavita", sprite: "tavita", color: "#c58bff" },
    teobalt: { name: "Teobalt", portrait: "teobalt", sprite: "teobalt", color: "#ffe14d" },
    thandi: { name: "Thandi", portrait: "thandi", sprite: "thandi", color: "#8fe3d6" },
    tobias: { name: "Tobias", portrait: "tobias", sprite: "tobias", color: "#8fe3d6" },
    tomi: { name: "Tomi", portrait: "tomi", sprite: "tomi", color: "#f2a65a" },
    trixie: { name: "Trixie", portrait: "trixie", sprite: "trixie", color: "#ff8fa3" },
    victoria: { name: "Victoria", portrait: "victoria", sprite: "victoria", color: "#c58bff" },
    viktor: { name: "Viktor", portrait: "viktor", sprite: "viktor", color: "#ff8fa3" },
    vivienne: { name: "Ms. Laurent", portrait: "vivienne", sprite: "vivienne", color: "#8fe3d6" },
    willas: { name: "Willas", portrait: "willas", sprite: "willas", color: "#8fe3d6" },
    wren: { name: "Wren", portrait: "wren", sprite: "wren", color: "#c98b5a" },
    zeynep: { name: "Zeynep", portrait: "zeynep", sprite: "zeynep", color: "#b08b3a" }
  },
  locations: {
    arcade: { name: "Coin-Op Cove", background: "arcade" },
    bar: { name: "The Mulligan", background: "bar" },
    beach_cove: { name: "Driftwood Cove", background: "beach_cove" },
    boathouse: { name: "The Boathouse", background: "boathouse" },
    bonfire_pit: { name: "The Bonfire Pit", background: "bonfire_pit" },
    boutique: { name: "Maison Topdeck", background: "boutique" },
    broadcast_studio: { name: "Broadcast Studio", background: "broadcast_studio" },
    cafe: { name: "Café Cantrip", background: "cafe" },
    cafeteria: { name: "The Mess (Central Cafeteria)", background: "cafeteria" },
    campsite: { name: "Windbreak Campsite", background: "campsite" },
    campus_store: { name: "The Campus Store", background: "campus_store" },
    card_archive: { name: "The Card Archive", background: "card_archive" },
    card_shop: { name: "The Sleeve & Binder", background: "card_shop" },
    chancellor_office: { name: "The Chancellor's Office", background: "chancellor_office" },
    chuck_workshop: { name: "Chuck's Workshop", background: "chuck_workshop" },
    classroom: { name: "Seminar Room 2B", background: "classroom" },
    cliff_path: { name: "The Cliff Path", background: "cliff_path" },
    clock_tower: { name: "The Clock Tower", background: "clock_tower" },
    commons_beach: {
      name: "The Commons — Bungalow Row",
      background: "commons_beach",
      music: "beach",
      travel: 3,
      travelFrom: { commons_kitchen: 1, commons_room: 1 },
      actions: [
        { id: "boardwalk", label: "Walk the boardwalk", scene: "row_boardwalk", when: (s)=>(s.day===1) },
        {
          id: "hammock",
          label: "Lie in a hammock",
          scene: "row_hammock",
          when: (s)=>((s.day===1)&&!!!s.flags["rowan_hammock"])
        },
        {
          id: "b2",
          label: "Knock on bungalow 2",
          scene: "row_b2",
          when: (s)=>((s.day===1)&&!!!s.flags["chat_row_b2_done"])
        },
        {
          id: "b4",
          label: "Visit bungalow 4",
          scene: "row_b4",
          when: (s)=>((s.day===1)&&!!!s.flags["chat_row_b4_done"])
        },
        {
          id: "b6",
          label: "Stop at bungalow 6",
          scene: "row_b6",
          when: (s)=>((s.day===1)&&!!!s.flags["chat_row_b6_done"])
        }
      ]
    },
    commons_kitchen: {
      name: "Mama's Kitchen",
      background: "commons_kitchen",
      music: "kitchen",
      travel: 1,
      travelFrom: { commons_beach: 1, commons_room: 2 },
      actions: [
        {
          id: "lunch",
          label: "Ask whether there is lunch",
          scene: "row_lunch",
          when: (s)=>(((s.day===1)&&!!!s.flags["had_lunch"])&&(s.minutes<840))
        },
        {
          id: "mama",
          label: "Talk to Mama Odalys",
          scene: "row_mama",
          when: (s)=>(((s.day===1)&&!!s.flags["had_lunch"])&&(s.minutes<1080))
        }
      ]
    },
    commons_room: {
      name: "Bungalow 7 — Your Room",
      background: "commons_room",
      music: "dorm",
      travel: 1,
      travelFrom: { commons_beach: 1, commons_kitchen: 2 },
      objects: [
        {
          id: "nathan",
          sprite: "nathan",
          x: 22,
          y: 96,
          h: 64,
          label: "Nathan",
          scene: "bungalow_nathan",
          when: (s)=>(((s.day===1)&&(s.minutes<1080))&&!!s.flags["flag_prologue_done"])
        },
        {
          id: "baylee",
          sprite: "baylee",
          x: 52,
          y: 96,
          h: 78,
          label: "Baylee",
          scene: "bungalow_baylee",
          when: (s)=>(((s.day===1)&&(s.minutes<1080))&&!!s.flags["flag_prologue_done"])
        }
      ],
      actions: [
        {
          id: "unpack",
          label: "Unpack your duffel",
          scene: "room_unpack",
          when: (s)=>((s.day===1)&&!!!s.flags["unpacked_done"])
        },
        { id: "goldfish", label: "Goldfish an opening hand on the bed", scene: "room_goldfish", when: (s)=>(s.day===1) },
        {
          id: "letter",
          label: "Open Aunt Dee's letter",
          scene: "room_letter",
          when: (s)=>(((s.day===1)&&!!s.flags["unpacked_done"])&&!!!s.flags["read_letter"])
        }
      ]
    },
    commons_shore: { name: "The Commons — The Beach Behind the Row", background: "commons_shore" },
    council_room: { name: "Student Council Chamber", background: "council_room" },
    crater: { name: "The Glass Crater", background: "crater" },
    design_lab: { name: "The Design Lab", background: "design_lab" },
    duel_terraces: { name: "The Duel Terraces", background: "duel_terraces" },
    faculty_wing: { name: "The Faculty Wing", background: "faculty_wing" },
    ferry_bridge: {
      name: "Wheelhouse Door",
      background: "ferry_bridge",
      music: "ship",
      travel: 0,
      travelFrom: { ferry_deck: 2, ferry_lounge: 2, ferry_stern: 3 },
      onArrive: [
        { scene: "bridge_first", once: true }
      ],
      objects: [
        {
          id: "abel",
          sprite: "abel",
          x: 62,
          y: 96,
          h: 74,
          label: "The captain",
          scene: "ferry_abel",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_abel"])
        },
        {
          id: "abel_m",
          sprite: "abel",
          x: 62,
          y: 96,
          h: 74,
          label: "Captain Stroud",
          scene: "ferry_abel",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_abel"])
        },
        {
          id: "rana",
          sprite: "rana",
          x: 24,
          y: 100,
          h: 48,
          label: "Scowling girl",
          scene: "ferry_rana",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_rana"])
        },
        {
          id: "rana_m",
          sprite: "rana",
          x: 24,
          y: 100,
          h: 48,
          label: "Rana",
          scene: "ferry_rana",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_rana"])
        },
        {
          id: "teobalt",
          sprite: "teobalt",
          x: 84,
          y: 94,
          h: 62,
          label: "Boy with a clipboard",
          scene: "ferry_teobalt",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_teobalt"])
        },
        {
          id: "teobalt_m",
          sprite: "teobalt",
          x: 84,
          y: 94,
          h: 62,
          label: "Teobalt",
          scene: "ferry_teobalt",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_teobalt"])
        }
      ],
      actions: [
        { id: "list", label: "Read the passenger list", scene: "bridge_list", when: (s)=>((s.day===1)&&(s.minutes<640)) },
        {
          id: "plate",
          label: "Read the brass plate by the door",
          scene: "bridge_plate",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        { id: "chart", label: "Look at the chart", scene: "bridge_chart", when: (s)=>((s.day===1)&&(s.minutes<640)) },
        {
          id: "binoculars",
          label: "Borrow the binoculars",
          scene: "bridge_binoculars",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "overlook",
          label: "Look down on the ship",
          scene: "bridge_overlook",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        }
      ]
    },
    ferry_deck: {
      name: "Fore Deck of the Second Chance",
      background: "ferry_deck",
      music: "ship",
      known: true,
      travel: 0,
      onArrive: [
        { scene: "ferry_prologue", once: true }
      ],
      objects: [
        {
          id: "nathan",
          sprite: "nathan",
          x: 27,
          y: 98,
          h: 64,
          label: "Nathan",
          scene: "ferry_nathan",
          when: (s)=>((((s.day===1)&&(s.minutes<640))&&!!s.flags["flag_prologue_done"])&&!!!s.flags["follow_nathan"])
        },
        {
          id: "baylee",
          sprite: "baylee",
          x: 14,
          y: 99,
          h: 78,
          label: "Baylee",
          scene: "ferry_baylee",
          when: (s)=>((((s.day===1)&&(s.minutes<640))&&!!s.flags["flag_prologue_done"])&&!!!s.flags["follow_baylee"])
        },
        {
          id: "ed",
          sprite: "ed",
          x: 56,
          y: 84,
          h: 56,
          label: "Boy in a hat",
          scene: "ferry_ed",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_ed"])
        },
        {
          id: "ed_m",
          sprite: "ed",
          x: 56,
          y: 84,
          h: 56,
          label: "Ed",
          scene: "ferry_ed",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_ed"])
        },
        {
          id: "georgie",
          sprite: "georgie",
          x: 76,
          y: 100,
          h: 46,
          label: "Girl with the dark-purple feather",
          scene: "ferry_georgie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_georgie"])
        },
        {
          id: "georgie_m",
          sprite: "georgie",
          x: 76,
          y: 100,
          h: 46,
          label: "Georgie",
          scene: "ferry_georgie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_georgie"])
        },
        {
          id: "branden",
          sprite: "branden",
          x: 100,
          y: 100,
          h: 40,
          label: "Flame-haired kid",
          scene: "ferry_branden",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_branden"])
        },
        {
          id: "branden_m",
          sprite: "branden",
          x: 100,
          y: 100,
          h: 40,
          label: "Branden",
          scene: "ferry_branden",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_branden"])
        },
        {
          id: "pippa",
          sprite: "pippa",
          x: 88,
          y: 96,
          h: 58,
          label: "Girl with a camera",
          scene: "ferry_pippa",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_pippa"])
        },
        {
          id: "pippa_m",
          sprite: "pippa",
          x: 88,
          y: 96,
          h: 58,
          label: "Pippa",
          scene: "ferry_pippa",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_pippa"])
        },
        {
          id: "mikoto",
          sprite: "mikoto",
          x: 42,
          y: 101,
          h: 56,
          label: "Boy with a gull",
          scene: "ferry_mikoto",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_mikoto"])
        },
        {
          id: "mikoto_m",
          sprite: "mikoto",
          x: 42,
          y: 101,
          h: 56,
          label: "Mikoto",
          scene: "ferry_mikoto",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_mikoto"])
        }
      ],
      actions: [
        { id: "rail", label: "Lean on the bow rail", scene: "deck_rail", when: (s)=>((s.day===1)&&(s.minutes<640)) },
        {
          id: "collars",
          label: "Count jackets and collars",
          scene: "deck_collars",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "lighthouse",
          label: "Look for the lighthouse",
          scene: "deck_lighthouse",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&(s.minutes>=570))
        },
        { id: "seasick", label: "Be seasick", scene: "deck_seasick", when: (s)=>((s.day===1)&&(s.minutes<640)) }
      ]
    },
    ferry_dock: { name: "Academy Ferry Dock", background: "ferry_dock", music: "plaza" },
    ferry_lounge: {
      name: "Passenger Lounge",
      background: "ferry_lounge",
      music: "ship",
      travel: 0,
      travelFrom: { ferry_deck: 2, ferry_stern: 2, ferry_bridge: 2 },
      onArrive: [
        { scene: "lounge_first", once: true }
      ],
      objects: [
        {
          id: "gideon",
          sprite: "gideon",
          x: 50,
          y: 92,
          h: 62,
          label: "Boy in white gloves",
          scene: "ferry_gideon",
          alert: (s)=>!!!s.flags["table_resolved"],
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_gideon"])
        },
        {
          id: "gideon_m",
          sprite: "gideon",
          x: 50,
          y: 92,
          h: 62,
          label: "Gideon",
          scene: "ferry_gideon",
          alert: (s)=>!!!s.flags["table_resolved"],
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_gideon"])
        },
        {
          id: "inya",
          sprite: "inya",
          x: 64,
          y: 96,
          h: 40,
          label: "Girl with the bunny clip",
          scene: "ferry_inya",
          alert: (s)=>!!!s.flags["table_resolved"],
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_inya"])
        },
        {
          id: "inya_m",
          sprite: "inya",
          x: 64,
          y: 96,
          h: 40,
          label: "Inya",
          scene: "ferry_inya",
          alert: (s)=>!!!s.flags["table_resolved"],
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_inya"])
        },
        {
          id: "tomi",
          sprite: "tomi",
          x: 22,
          y: 98,
          h: 50,
          label: "Boy in a yellow bandana",
          scene: "ferry_tomi",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_tomi"])
        },
        {
          id: "tomi_m",
          sprite: "tomi",
          x: 22,
          y: 98,
          h: 50,
          label: "Tomi",
          scene: "ferry_tomi",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_tomi"])
        },
        {
          id: "magnus",
          sprite: "magnus",
          x: 10,
          y: 90,
          h: 60,
          label: "Boy with a tablet",
          scene: "ferry_magnus",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_magnus"])
        },
        {
          id: "magnus_m",
          sprite: "magnus",
          x: 10,
          y: 90,
          h: 60,
          label: "Magnus",
          scene: "ferry_magnus",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_magnus"])
        },
        {
          id: "noor",
          sprite: "noor",
          x: 84,
          y: 90,
          h: 58,
          label: "Girl with a rulebook",
          scene: "ferry_noor",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_noor"])
        },
        {
          id: "noor_m",
          sprite: "noor",
          x: 84,
          y: 90,
          h: 58,
          label: "Noor",
          scene: "ferry_noor",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_noor"])
        },
        {
          id: "livvie",
          sprite: "livvie",
          x: 38,
          y: 96,
          h: 56,
          label: "Girl with a clipboard",
          scene: "ferry_livvie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_livvie"])
        },
        {
          id: "livvie_m",
          sprite: "livvie",
          x: 38,
          y: 96,
          h: 56,
          label: "Livvie",
          scene: "ferry_livvie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_livvie"])
        }
      ],
      actions: [
        {
          id: "plate",
          label: "Read the brass plate on the table",
          scene: "lounge_plate",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "watch",
          label: "Watch a game at the table",
          scene: "lounge_watch",
          when: (s)=>((((s.day===1)&&(s.minutes<640))&&!!!s.flags["saw_counter"])&&!!!s.flags["table_resolved"])
        },
        {
          id: "galley",
          label: "Go to the galley hatch",
          scene: "lounge_galley",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "binder",
          label: "Look through a trade binder",
          scene: "lounge_binder",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "benches",
          label: "Look under the benches",
          scene: "lounge_benches",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["found_stapler"])
        }
      ]
    },
    ferry_stern: {
      name: "Stern Deck",
      background: "ferry_stern",
      music: "ship",
      travel: 0,
      travelFrom: { ferry_deck: 3, ferry_lounge: 2, ferry_bridge: 3 },
      onArrive: [
        { scene: "stern_first", once: true }
      ],
      objects: [
        {
          id: "jessica",
          sprite: "jessica",
          x: 20,
          y: 96,
          h: 66,
          label: "Girl with the caskets",
          scene: "ferry_jessica",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_jessica"])
        },
        {
          id: "jessica_m",
          sprite: "jessica",
          x: 20,
          y: 96,
          h: 66,
          label: "Jessica",
          scene: "ferry_jessica",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_jessica"])
        },
        {
          id: "ashton",
          sprite: "ashton",
          x: 36,
          y: 94,
          h: 70,
          label: "Boy with a rose",
          scene: "ferry_ashton",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_ashton"])
        },
        {
          id: "ashton_m",
          sprite: "ashton",
          x: 36,
          y: 94,
          h: 70,
          label: "Ashton",
          scene: "ferry_ashton",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_ashton"])
        },
        {
          id: "victoria",
          sprite: "victoria",
          x: 56,
          y: 88,
          h: 60,
          label: "Girl with a parasol",
          scene: "ferry_victoria",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_victoria"])
        },
        {
          id: "victoria_m",
          sprite: "victoria",
          x: 56,
          y: 88,
          h: 60,
          label: "Victoria",
          scene: "ferry_victoria",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_victoria"])
        },
        {
          id: "sunny",
          sprite: "sunny",
          x: 80,
          y: 100,
          h: 68,
          label: "Girl on the rail",
          scene: "ferry_sunny",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_sunny"])
        },
        {
          id: "sunny_m",
          sprite: "sunny",
          x: 80,
          y: 100,
          h: 68,
          label: "Sunny",
          scene: "ferry_sunny",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_sunny"])
        },
        {
          id: "freddie",
          sprite: "freddie",
          x: 104,
          y: 98,
          h: 56,
          label: "Girl with goggles on her head",
          scene: "ferry_freddie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_freddie"])
        },
        {
          id: "freddie_m",
          sprite: "freddie",
          x: 104,
          y: 98,
          h: 56,
          label: "Freddie",
          scene: "ferry_freddie",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_freddie"])
        },
        {
          id: "marit",
          sprite: "marit",
          x: 92,
          y: 94,
          h: 64,
          label: "Girl on a bollard",
          scene: "ferry_marit",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!!s.flags["met_marit"])
        },
        {
          id: "marit_m",
          sprite: "marit",
          x: 92,
          y: 94,
          h: 64,
          label: "Marit",
          scene: "ferry_marit",
          when: (s)=>(((s.day===1)&&(s.minutes<640))&&!!s.flags["met_marit"])
        }
      ],
      actions: [
        {
          id: "wake",
          label: "Watch the wake and the gulls",
          scene: "stern_wake",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        },
        {
          id: "cage",
          label: "Look through the luggage cage",
          scene: "stern_cage",
          when: (s)=>((s.day===1)&&(s.minutes<640))
        }
      ]
    },
    festival_grounds: { name: "The Festival Grounds", background: "festival_grounds" },
    fish_market: { name: "The Fish Market", background: "fish_market" },
    gala_ballroom: { name: "The Winter Gala Ballroom", background: "gala_ballroom" },
    great_arena: { name: "The Great Arena", background: "great_arena" },
    greenhouse: { name: "The Greenhouse", background: "greenhouse" },
    gym: { name: "The Gymnasium", background: "gym" },
    harbor: { name: "Port Mulligan Harbour", background: "harbor" },
    hollow_field: { name: "The Cold Table", background: "hollow_field" },
    hot_springs: { name: "The Wild Hot Springs", background: "hot_springs" },
    infirmary: { name: "The Infirmary", background: "infirmary" },
    infirmary_ward: { name: "Ward B", background: "infirmary_ward" },
    inn: { name: "The Drowned Anchor Inn", background: "inn" },
    islet: { name: "Gull Rock", background: "islet" },
    job_board: { name: "The Job Board", background: "job_board" },
    jungle_trail: { name: "The Jungle Trail", background: "jungle_trail" },
    lava_tubes: { name: "The Lava Tubes", background: "lava_tubes" },
    lecture_hall: { name: "Kowalczyk Lecture Hall", background: "lecture_hall" },
    library: { name: "The Library", background: "library" },
    lighthouse: { name: "Mulligan Point Light", background: "lighthouse" },
    main_gate: { name: "Main Gate", background: "main_gate", music: "plaza" },
    main_street: { name: "Main Street", background: "main_street" },
    maintenance_tunnels: { name: "The Maintenance Tunnels", background: "maintenance_tunnels" },
    mosaic_vault: { name: "The Mosaic Vault", background: "mosaic_vault" },
    night_market: { name: "The Night Market", background: "night_market" },
    north_shore: { name: "The North Shore", background: "north_shore" },
    old_observatory: { name: "The Old Observatory", background: "old_observatory" },
    old_print_works: { name: "The Old Print Works", background: "old_print_works" },
    orchard: { name: "The Old Orchard", background: "orchard" },
    pawn_shop: { name: "Second Draw Pawn & Loan", background: "pawn_shop" },
    pool: { name: "The Pool", background: "pool" },
    quad: { name: "The Quad", background: "quad", music: "plaza" },
    radio_tower: { name: "The Radio Tower", background: "radio_tower" },
    rare_common_room: { name: "Rare Hall — Common Room", background: "rare_common_room" },
    rare_lobby: { name: "Rare Hall — Lobby", background: "rare_lobby" },
    rare_room: { name: "A Room in Rare Hall", background: "rare_room" },
    rooftop_garden: { name: "The Rooftop Garden", background: "rooftop_garden" },
    rope_bridge: { name: "The Rope Bridge", background: "rope_bridge" },
    ruin_gate: { name: "The Ruin Gate", background: "ruin_gate" },
    ruins_field: { name: "The Ruins Field", background: "ruins_field" },
    sea_cave: { name: "The Singing Cave", background: "sea_cave" },
    spa: { name: "The Campus Spa", background: "spa" },
    spectral_lobby: { name: "Spectral Tower — Atrium", background: "spectral_lobby" },
    spectral_suite: { name: "A Suite in Spectral Tower", background: "spectral_suite" },
    spectral_terrace: { name: "Spectral Terrace Pool", background: "spectral_terrace" },
    student_lounge: { name: "The Student Lounge", background: "student_lounge" },
    summit_shrine: { name: "The Summit Shrine", background: "summit_shrine" },
    theatre: { name: "The Little Theatre", background: "theatre" },
    tide_pools: { name: "The Tide Pools", background: "tide_pools" },
    trial_dome: { name: "The Trial Domes", background: "trial_dome", music: "duel" },
    umbra_house: { name: "Umbra House", background: "umbra_house" },
    umbra_room9: { name: "Umbra House — Room 9", background: "umbra_room9" },
    vault_antechamber: { name: "The Antechamber", background: "vault_antechamber" },
    volcano_rim: { name: "The Caldera Rim", background: "volcano_rim" },
    waterfall: { name: "Tarleinn's Falls", background: "waterfall" }
  },
  events: [
    {
      id: "ship_figures_it_out",
      scene: "ship_figures_it_out",
      day: 1,
      from: "09:45",
      once: true,
      when: (s)=>(!!!s.flags["ship_knows_wildcard"]&&(((s.location==="ferry_deck"||s.location==="ferry_lounge")||s.location==="ferry_stern")||s.location==="ferry_bridge"))
    },
    {
      id: "inya_finds_rowan",
      scene: "inya_finds_rowan",
      day: 1,
      from: "09:30",
      once: true,
      when: (s)=>(((!!!s.flags["table_resolved"]&&!!!s.flags["inya_engaged"])&&!!!s.flags["inya_shut_out"])&&(((s.location==="ferry_deck"||s.location==="ferry_lounge")||s.location==="ferry_stern")||s.location==="ferry_bridge"))
    },
    {
      id: "table_default",
      scene: "table_default",
      day: 1,
      from: "10:05",
      once: true,
      when: (s)=>(!!!s.flags["table_resolved"]&&(((s.location==="ferry_deck"||s.location==="ferry_lounge")||s.location==="ferry_stern")||s.location==="ferry_bridge"))
    },
    { id: "placement_call", scene: "placement_call", day: 1, from: "13:30", once: true },
    { id: "supper_call", scene: "supper_call", day: 1, from: "18:00", once: true },
    {
      id: "ferry_arrival",
      scene: "ferry_arrival",
      day: 1,
      from: "10:25",
      once: true,
      when: (s)=>(((s.location==="ferry_deck"||s.location==="ferry_lounge")||s.location==="ferry_stern")||s.location==="ferry_bridge")
    }
  ]
});
