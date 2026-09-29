# Hero-Idle-Animationen

Generator-Skripte für die animierten Hero-Sprites in `data/hero-animations/`.
Jedes Skript liest das Original-Sprite aus `src/` und erzeugt daraus ein
Spritesheet (alle Frames horizontal nebeneinander) sowie ein vergrößertes
Vorschau-GIF.

## Benutzung

Aus diesem Ordner heraus aufrufen (die Skripte nutzen relative Pfade):

```bash
cd scripts/hero-animations
python3 styx.py final        # -> styx_idle_sheet_final.png + styx_idle_final.gif
```

Abhängigkeiten: Python 3, `pillow`, `numpy`.

Das erzeugte Sheet wird unter dem Hero-Slug nach `data/hero-animations/`
kopiert, daneben liegt eine JSON-Datei mit den Metadaten. Die erzeugten
`*.gif`/`*sheet*.png` in diesem Ordner sind Arbeitsdateien (siehe `.gitignore`).

| Skript | Aufruf | Ausgabe-Sheet | Ziel in `data/hero-animations/` |
|---|---|---|---|
| `elana.py` | `gitarre` | `elana_idle_sheet_gitarre.png` | `elana-the-rocky-rebel` |
| `styx.py` | `final` | `styx_idle_sheet_final.png` | `styx-the-gate-to-the-spirit-world` |
| `rubin.py` | `final` | `rubin_idle_sheet_final.png` | `rubin-the-dragoneer-champion` |
| `ghuanjun.py` | `final` | `ghuanjun_idle_sheet_final.png` | `ghuanjun-the-undead-martial-artist` |
| `semi.py` | `final` | `semi_idle_sheet_final.png` | `treasure-huntress-semi` |
| `waflav.py` | `final` | `waflav_idle_sheet_final.png` | `swampborne-waflav` |
| `medea.py` (+ `medea_layers.py`) | `final` | `medea_idle_sheet_final.png` | `medea-the-swamp-witch` |
| `reiza.py` | `final` | `reiza_idle_sheet_final.png` | `reiza-the-chief-tormentor` |
| `sparrow.py` | `final` | `sparrow_idle_sheet_final.png` | `sparrow-the-buffoon-of-the-treasure-cave` |
| `guelde.py` | `final` | `guelde_idle_final_sheet.png` | `g-ldefaber-the-king-of-dwarfs` |
| `chaos.py` | `final` | `chaos_idle_final_sheet.png` | `chaos-diamond-the-cracked-keeper` |
| `kazena.py` | `final` | `kazena_idle_final_sheet.png` | `kazena-the-storming-rebel` |
| `damus.py` | `final` | `damus_idle_final_sheet.png` | `damus-the-prophet-of-apocalypse` |
| `rick.py` | `final` | `rick_idle_final_sheet.png` | `rick-the-trigger-happy-undertaker` |
| `sett.py` | `final` | `sett_idle_final_sheet.png` | `sett-the-adept-of-necromancy` |
| `archibald.py` | `final` | `archibald_idle_final_sheet.png` | `archibald-the-archmage` |
| `nao.py` | `final` | `nao_idle_final_sheet.png` | `nao-the-barrier-priestess` |
| `rafflesia.py` | `final` | `rafflesia_idle_final_sheet.png` | `rafflesia-the-poison-princess` |
| `dante.py` | `final` | `dante_idle_final_sheet.png` | `dante-the-wanderer-of-hell` |
| `zsos.py` | `final` | `zsos_idle_final_sheet.png` | `zsos-ssar-the-serpent-warlord` |
| `baaliel.py` | `final` | `baaliel_idle_final_sheet.png` | `baaliel-the-demon-general` |
| `inya.py` | `final` | `inya_idle_final_sheet.png` | `card-game-player-inya` |
| `zwei.py` | `final` | `zwei_idle_final_sheet.png` | `zwei-the-lucky-thief` |
| `night.py` | `final` | `night_idle_final_sheet.png` | `night-the-herald-of-chess` |
| `kasparov.py` | `final 90 b` | `kasparov_b_idle_final_sheet.png` | `kasperov-the-king-of-kings-b` |
| `kasparov.py` | `final 90 w` | `kasparov_w_idle_final_sheet.png` | `kasperov-the-king-of-kings-w` |
| `darion.py` | `final 80` | `darion_idle_final_sheet.png` | `darion-the-blood-crazy-groundskeeper` |
| `ghazma.py` | `final` | `ghazma_idle_final_sheet.png` | `ghazma-the-worm-feeder` |
| `sid.py` | `final` | `sid_idle_final_sheet.png` | `sid-the-king-of-thieves` |
| `beato.py` | `final` | `beato_idle_final_sheet.png` | `beato-the-butterfly-witch` |
| `fiedel.py` | `final` | `fiedel_idle_final_sheet.png` | `fiedel-the-mercenary-mage` |
| `boris.py` | `final` | `boris_idle_final_sheet.png` | `boris-the-guardian-of-blackport` |
| `arthor_king.py` | `final` | `arthor_king_idle_final_sheet.png` | `arthor-the-king-of-blackport` |
| `lilly.py` | `final` | `lilly_idle_final_sheet.png` | `lilly-the-charming-infiltrator` |
| `arthor_sword.py` | `final` | `arthor_sword_idle_final_sheet.png` | `arthor-inheritor-of-the-barbarian-sword` |
| `locke.py` | `final 80` | `locke_idle_final_sheet.png` | `locke-the-unseen-saboteur` |
| `mary.py` | `final 70` | `mary_idle_final_sheet.png` | `cute-princess-mary` |
| `mini.py` | `final` | `mini_idle_final_sheet.png` | `cute-annoyance-mini` |
| `tarleinn.py` | `final` | `tarleinn_idle_final_sheet.png` | `tarleinn-the-traveler` |
| `crestina_fq.py` | `final` | `crestina_fq_idle_final_sheet.png` | `fairy-queen-crestina-the-creation-fairy` |
| `mirjam.py` | `final` | `mirjam_idle_final_sheet.png` | `mirjam-the-fallen-cute-angel` |
| `crestina_true.py` (+ `crestina_wings.py`) | `final` | `crestina_true_idle_final_sheet.png` | `true-fairy-crestina-the-primordial-goddess` |
| `megu.py` | `final` | `megu_idle_final_sheet.png` | `cute-starlet-megu` |
| `vena.py` | `final` | `vena_idle_final_sheet.png` | `vena-the-bounty-huntress` |
| `monia.py` | `final` | `monia_idle_final_sheet.png` | `cool-rescuer-monia` |
| `monami.py` | `final` | `monami_idle_final_sheet.png` | `cute-ditz-monami` |
| `magenta.py` | `final` | `magenta_idle_final_sheet.png` | `cute-nerd-magenta` |
| `jenny.py` | `final` | `jenny_idle_final_sheet.png` | `jenny-the-class-fairy` |
| `molinda.py` (+ `molinda_wings.py`) | `final` | `molinda_idle_final_sheet.png` | `molinda-the-cutest-being-in-the-sky` |
| `alice.py` | `final` | `alice_idle_final_sheet.png` | `alice-the-transfer-student` |
| `mithuru.py` | `final` | `mithuru_idle_final_sheet.png` | `lord-mithuru-the-rotten-mastermind` |
| `thalia.py` | `final` | `thalia_idle_final_sheet.png` | `thalia-the-fun-fairy` |
| `null.py` | `final` | `null_idle_final_sheet.png` | `null-the-mage-slayer` |
| `maho.py` | `final` | `maho_idle_final_sheet.png` | `maho-the-cute-magical-girl` |
| `atta.py` | `final` | `atta_idle_final_sheet.png` | `atta-speaker-of-desires` |
| `nomu.py` | `final` | `nomu_idle_final_sheet.png` | `nomu-wanderer-of-worlds` |
| `argos.py` | `final` | `argos_idle_final_sheet.png` | `argos-the-eye-of-the-cosmos` |
| `eye_of_argos.py` | `final` | `eye_of_argos_idle_final_sheet.png` | `the-eye-of-argos` (Skin) |
| `kerthwack.py` | `final 80 hero` | `kerthwack_hero_idle_final_sheet.png` | `kerthwack-the-reality-breaker` |
| `kerthwack.py` | `final 80 wd` | `kerthwack_wd_idle_final_sheet.png` | `w-d-kerthwack` (Skin) |
| `lizbeth.py` | `final` | `lizbeth_idle_final_sheet.png` | `lizbeth-the-hunter-of-souls` (Skin) |
| `cuberto.py` | `final 90 hero` | `cuberto_hero_idle_final_sheet.png` | `cuberto-supreme-lord-of-edges` |
| `cuberto.py` | `final 90 edgy` | `cuberto_edgy_idle_final_sheet.png` | `extra-edgy-cuberto` (Skin) |
| `monia.py` | `final 70 delusional` | `delusional_monia_idle_final_sheet.png` | `delusional-monia` (Skin) |
| `monia.py` | `final 70 lightning` | `lightning_monia_idle_final_sheet.png` | `lightning-fast-monia` (Skin) |
| `monia.py` | `final 70 birthday` | `birthday_monia_idle_final_sheet.png` | `cool-birthday-girl-monia` |
| `winged.py` | `final 80 tempeste` | `tempeste_skin_idle_final_sheet.png` | `absolute-moron-tempeste` (Skin) |
| `winged.py` | `final 80 mary` | `sickly_mary_idle_final_sheet.png` | `sickly-mary` (Skin) |
| `winged.py` | `final 80 crestina` | `sos_crestina_idle_final_sheet.png` | `sos-crestina` (Skin) |
| `space_vena.py` | `final` | `space_vena_idle_final_sheet.png` | `space-huntress-vena` (Skin) |
| `tapu_jenny.py` | `final` | `tapu_jenny_idle_final_sheet.png` | `tapu-jenny` (Skin) |
| `winged.py` | `final 80 melissa` | `cute_meanie_melissa_idle_final_sheet.png` | `cute-meanie-melissa` |
| `winged.py` | `final 80 molinda` | `cute_angel_molinda_idle_final_sheet.png` | `cute-angel-molinda` |
| `dark_maho.py` | `final` | `dark_maho_idle_final_sheet.png` | `dark-maho` (Skin) |
| `thep.py` | `final` | `thep_idle_final_sheet.png` | `thep-the-court-scribe` |
| `lethe.py` | `final 90 hero` | `lethe_idle_final_sheet.png` | `lethe-the-forgetful-fixer` |
| `lethe.py` | `final 90 reaping` | `reaping_lethe_idle_final_sheet.png` | `reaping-lethe` (Skin) |
| `pharaoh.py` | `final 90 hero` | `pharaoh_idle_final_sheet.png` | `pharaoh-the-lone-living-being` |
| `pharaoh.py` | `final 90 gamer` | `gamer_pharaoh_idle_final_sheet.png` | `gamer-champion-pharaoh` (Skin) |
| `bakhm.py` | `final 90 hero` | `bakhm_idle_final_sheet.png` | `bakhm-the-desert-digger` |
| `bakhm.py` | `final 90 worm` | `world_eater_bakhm_idle_final_sheet.png` | `world-eater-bakhm` (Skin) |
| `serket.py` | `final 90 hero` | `serket_idle_final_sheet.png` | `serket-dread-of-the-desert` |
| `serket.py` | `final 90 et` | `extraterrestrial_serket_idle_final_sheet.png` | `extraterrestrial-serket` (Skin) |
| `teocuilatl.py` | `final 90 hero` | `teocuilatl_idle_final_sheet.png` | `teocuilatl-the-embodiment-of-gods` |
| `teocuilatl.py` | `final 90 platinum` | `platinum_star_idle_final_sheet.png` | `teocuilatl-the-platinum-star` (Skin) |
| `idej.py` | `final` | `idej_idle_final_sheet.png` | `idej-lord-daiyo` |
| `heragas.py` | `final` | `heragas_idle_final_sheet.png` | `heragas-the-monster-slayer` |
| `pseudonia.py` | `final 90 hero` | `pseudonia_idle_final_sheet.png` | `pseudonia-the-skill-devourer` |
| `pseudonia.py` | `final 90 imperfect` | `imperfect_pseudonia_idle_final_sheet.png` | `imperfect-pseudonia` (Skin) |
| `bloom.py` | `final` | `bloom_idle_final_sheet.png` | `bloom-the-maniacal-botanist` |
| `maya.py` | `final` | `maya_idle_final_sheet.png` | `maya-the-nature-fairy` |
| `diamond.py` | `final` | `diamond_idle_final_sheet.png` | `diamond-the-keeper-of-peace` |
| `carris.py` | `final 90 hero` | `carris_idle_final_sheet.png` | `carris-the-time-keeper` |
| `carris.py` | `final 90 little` | `little_carris_idle_final_sheet.png` | `little-carris` (Skin) |
| `britain_royals.py` | `final 90 willy` | `willy_idle_final_sheet.png` | `willy-the-valiant-leprechaun` |
| `britain_royals.py` | `final 90 george` | `george_idle_final_sheet.png` | `george-the-mad-tyrant-king` |
| `britain_royals.py` | `final 90 hatmaker` | `hatmaker_idle_final_sheet.png` | `hatmaker-george` (Skin) |
| `britain_royals.py` | `final 90 victorica` | `victorica_idle_final_sheet.png` | `victorica-the-eternal-empress` |
| `britain_royals.py` | `final 90 empress` | `empress_idle_final_sheet.png` | `empress-of-hearts-victorica` (Skin) |
| `alice_puppeteer.py` | `final` | `alice_puppeteer_idle_final_sheet.png` | `alice-the-puppeteer-girl` |
| `jack.py` | `final` | `jack_idle_final_sheet.png` | `jack-the-crooked-killer` |
| `junshi.py` | `final` | `junshi_idle_final_sheet.png` | `junshi-the-tactical-genius` |
| `xiong.py` | `final` | `xiong_idle_final_sheet.png` | `xiong-the-bamboo-guardian` |
| `zhigao.py` | `final` | `zhigao_idle_final_sheet.png` | `zhigao-the-heavenly-emperor` |
| `coolhalla.py` | `final 90 freshya` | `freshya_idle_final_sheet.png` | `freshya-beauty-of-coolness` |
| `coolhalla.py` | `final 90 thorad` | `thorad_idle_final_sheet.png` | `thorad-strength-of-coolness` |
| `coolhalla.py` | `final 90 cooldin` | `cooldin_idle_final_sheet.png` | `cooldin-king-of-coolness` |
| `coolhalla.py` | `final 90 lolki` | `lolki_idle_final_sheet.png` | `lolki-trickstar-of-coolness` |
| `coolhalla.py` | `final 90 peter` | `peter_idle_final_sheet.png` | `peter-r-ll-the-protagonist` |
| `coolhalla.py` | `final 90 prodigy` | `prodigy_idle_final_sheet.png` | `shrunken-prodigy-peter-r-ll` (Skin) |
| `deepsea.py` | `final 90 arnold` | `arnold_idle_final_sheet.png` | `bravo-arnold` (Skin) |
| `deepsea.py` | `final 90 kit` | `kit_idle_final_sheet.png` | `kit-the-shark-researcher` |
| `deepsea.py` | `final 90 lolek` | `lolek_idle_final_sheet.png` | `lolek-the-shard-knight` |
| `deepsea.py` | `final 90 captain` | `captain_idle_final_sheet.png` | `division-captain-lolek` (Skin) |
| `deepsea.py` | `final 90 mender` | `mender_idle_final_sheet.png` | `lolek-mender-of-the-shattered-trident` |
| `deepsea.py` | `final 90 rakah` | `rakah_idle_final_sheet.png` | `rakah-the-loan-shark` |
| `deepsea.py` | `final 90 rhabi` | `rhabi_idle_final_sheet.png` | `rha-bi-the-living-skeleton` |
| `deepsea.py` | `final 90 saya` | `saya_idle_final_sheet.png` | `saya-the-plant-princess` |
| `deepsea.py` | `final 90 grass` | `grass_idle_final_sheet.png` | `saya-the-grass-princess` (Skin) |
| `deepsea.py` | `final 90 siphem` | `siphem_idle_final_sheet.png` | `siphem-the-deepsea-demon` |
| `deepsea.py` | `final 90 asgore` | `asgore_idle_final_sheet.png` | `monster-king-siphem` (Skin) |
| `deepsea.py` | `final 90 sorin` | `sorin_idle_final_sheet.png` | `sorin-the-warden-of-blood-rock` |
| `deepsea.py` | `final 90 tryse` | `tryse_idle_final_sheet.png` | `tryse-the-shadow-slayer` |
| `toras.py` | `final` | `toras_idle_final_sheet.png` | `toras-master-of-all-weapons` |
| `deri.py` | `final 90 shapeshifter` | `shapeshifter_idle_final_sheet.png` | `the-shapeshifter` |
| `deri.py` | `final 90 robber` | `robber_idle_final_sheet.png` | `the-throne-robber` |
| `deri.py` | `final 90 darge` | `darge_idle_final_sheet.png` | `bow-sniper-darge` |
| `deri.py` | `final 90 jean` | `jean_idle_final_sheet.png` | `jean-the-pillaging-knight` |
| `deri.py` | `final 90 layn` | `layn_idle_final_sheet.png` | `layn-defender-of-deri` |
| `deri.py` | `final 90 summoner` | `summoner_idle_final_sheet.png` | `layn-summonr-of-weapons` (Skin) |
| `deri.py` | `final 90 ascended` | `ascended_idle_final_sheet.png` | `layn-master-of-deri-s-relic` |
| `deri.py` | `final 90 tharx` | `tharx_idle_final_sheet.png` | `tharx-the-never-losing-general` |
| `gn.py` | `final 90 andras` | `andras_idle_final_sheet.png` | `andras-the-human-weapon` |
| `gn.py` | `final 90 friedhelm` | `friedhelm_idle_final_sheet.png` | `friedhelm-the-misled-avenger` |
| `gn.py` | `final 90 titan` | `titan_idle_final_sheet.png` | `titan-slayer-friedhelm` (Skin) |
| `gn.py` | `final 90 ftriffel` | `ftriffel_idle_final_sheet.png` | `future-tech-gunslinger-riffel` |
| `gn.py` | `final 90 ascriffel` | `ascriffel_idle_final_sheet.png` | `riffel-master-of-the-ultimate-gun` |
| `gn.py` | `final 90 mgriffel` | `mgriffel_idle_final_sheet.png` | `magical-girl-riffel` (Skin) |
| `gn.py` | `final 90 kassaran` | `kassaran_idle_final_sheet.png` | `kassaran-seer-of-everything` |
| `gn.py` | `final 90 kent` | `kent_idle_final_sheet.png` | `kent-the-indebted-apprentice` |
| `gn.py` | `final 90 koperniko` | `koperniko_idle_final_sheet.png` | `koperniko-the-stargazer` |
| `gn.py` | `final 90 waflav` | `waflav_idle_final_sheet.png` | `thunderstruck-waflav` |
| `gn.py` | `final 90 heinz` | `heinz_idle_final_sheet.png` | `visionary-genius-heinz` |
| `gn.py` | `final 90 madheinz` | `madheinz_idle_final_sheet.png` | `mad-scientist-heinz` (Skin) |
| `gn.py` | `final 90 ralzish` | `ralzish_idle_final_sheet.png` | `wall-breaker-general-ralzish` |
| `gn.py` | `final 90 blueralzish` | `blueralzish_idle_final_sheet.png` | `blue-ralzish` (Skin) |
| `gn.py` | `final 90 pixmarck` | `pixmarck_idle_final_sheet.png` | `von-pixmarck-the-iron-chancellor` |
| `gn.py` | `final 90 dad` | `dad_idle_final_sheet.png` | `dad-of-the-year-von-pixmarck` (Skin) |
| `gn.py` | `final 90 nero` | `nero_idle_final_sheet.png` | `nero-zira-the-mastermind` |
| `gn.py` | `final 90 normalnero` | `normalnero_idle_final_sheet.png` | `normal-nero-zira` (Skin) |
| `gn.py` | `final 90 orthos` | `orthos_idle_final_sheet.png` | `orthos-the-loyal-guard-dog` |
| `gn.py` | `final 90 luna` | `luna_idle_final_sheet.png` | `luna-the-flame-fairy` |
| `gn.py` | `final 90 tsuki` | `tsuki_idle_final_sheet.png` | `tsu-ki-the-lunatic-princess` |
| `bubbles.py` | `final gross` | `bubbles_idle_final_gross_sheet.png` | `bubbles-the-bouncy-bunny` |
| `grailwar.py` | `final 90 asriel` | `asriel_idle_final_sheet.png` | `asriel-the-sapling-sacrificer` |
| `grailwar.py` | `final 90 barker` | `barker_idle_final_sheet.png` | `barker-the-monster-tamer` |
| `grailwar.py` | `final 90 blackstache` | `blackstache_idle_final_sheet.png` | `blackstache-scourge-of-the-pixel-seas` |
| `grailwar.py` | `final 90 chuck` | `chuck_idle_final_sheet.png` | `chuck-the-crazy-veteran` |
| `grailwar.py` | `final 90 codumbus` | `codumbus_idle_final_sheet.png` | `codumbus-the-clueless-voyager` |
| `grailwar.py` | `final 90 devlin` | `devlin_idle_final_sheet.png` | `devlin-the-masked-butcher` |
| `grailwar.py` | `final 90 mmdevlin` | `mmdevlin_idle_final_sheet.png` | `mass-murderer-devlin` (Skin) |
| `grailwar.py` | `final 90 enigma` | `enigma_idle_final_sheet.png` | `enigma-the-seller-of-secrets` |
| `grailwar.py` | `final 90 krates` | `krates_idle_final_sheet.png` | `krates-the-smartass` |
| `grailwar.py` | `final 90 key` | `key_idle_final_sheet.png` | `key-the-cursed-thief` |
| `grailwar.py` | `final 90 alleria` | `alleria_idle_final_sheet.png` | `alleria-the-queen-of-spiders` |
| `grailwar.py` | `final 90 brackle` | `brackle_idle_final_sheet.png` | `brackle-the-catapulting-turtle` |
| `grailwar.py` | `final 90 leonardo` | `leonardo_idle_final_sheet.png` | `mutated-teenager-brackle` (Skin) |
| `grailwar.py` | `final 90 broghan` | `broghan_idle_final_sheet.png` | `broghan-the-frozen-guardian-of-the-north` |
| `grailwar.py` | `final 90 golem` | `golem_idle_final_sheet.png` | `broghan-the-ancient-golem` (Skin) |
| `grailwar.py` | `final 90 clown` | `clown_idle_final_sheet.png` | `cecilia-the-clown` (Skin) |
| `grailwar.py` | `final 90 bbg` | `bbg_idle_final_sheet.png` | `bad-birthday-girl-cecilia` |
| `grailwar.py` | `final 90 fern` | `fern_idle_final_sheet.png` | `fern-the-ship-slave` |
| `grailwar.py` | `final 90 fernelf` | `fernelf_idle_final_sheet.png` | `fern-the-elf-slave` (Skin) |
| `grailwar.py` | `final 90 fairy` | `fairy_idle_final_sheet.png` | `fern-the-liberated-fairy` |
| `grailwar.py` | `final 90 fiona` | `fiona_idle_final_sheet.png` | `fiona-the-princess-of-blackport` |
| `grailwar.py` | `final 90 boarding` | `boarding_idle_final_sheet.png` | `gabby-the-boarding-broad` |
| `grailwar.py` | `final 90 chosen` | `chosen_idle_final_sheet.png` | `gabby-the-chosen-girl` (Skin) |
| `grailwar.py` | `final 90 zombie` | `zombie_idle_final_sheet.png` | `gabby-the-pirate-zombie` |
| `grailwar.py` | `final 90 moon` | `moon_idle_final_sheet.png` | `gabby-the-moonlight-warrior` (Skin) |
| `grailwar.py` | `final 90 garius` | `garius_idle_final_sheet.png` | `garius-the-great-reformer` |
| `grailwar.py` | `final 90 vader` | `vader_idle_final_sheet.png` | `dark-garius` (Skin) |
| `grailwar.py` | `final 90 gobbo` | `gobbo_idle_final_sheet.png` | `gobbo-chief-of-goblin` |
| `grailwar.py` | `final 90 hatusbal` | `hatusbal_idle_final_sheet.png` | `hatusbal-the-leader-of-tusca` |
| `grailwar.py` | `final 90 jack` | `jack_idle_final_sheet.png` | `ancient-hatusbal` (Skin) |
| `grailwar.py` | `final 90 hulijing` | `hulijing_idle_final_sheet.png` | `hulijing-the-foxdemon` |
| `grailwar.py` | `final 90 ingo` | `ingo_idle_final_sheet.png` | `ingo-investor-of-evil` |
| `grailwar.py` | `final 90 eingo` | `eingo_idle_final_sheet.png` | `elegant-ingo` (Skin) |
| `grailwar.py` | `final 90 madame` | `madame_idle_final_sheet.png` | `madame-guillotine-the-great-equalizer` |
| `grailwar.py` | `final 90 marianne` | `marianne_idle_final_sheet.png` | `marianne-the-cocky-caretaker` |
| `grailwar.py` | `final 90 santa` | `santa_idle_final_sheet.png` | `santa-klaus` |
| `grailwar.py` | `final 90 nicolas` | `nicolas_idle_final_sheet.png` | `nicolas-the-hidden-alchemist` |
| `grailwar.py` | `final 90 edward` | `edward_idle_final_sheet.png` | `fullmetal-nicolas` (Skin) |
| `grailwar.py` | `final 90 saintnic` | `saintnic_idle_final_sheet.png` | `saint-nicolas` |
| `grailwar.py` | `final 90 stellan` | `stellan_idle_final_sheet.png` | `stellan-the-calm-cat` |
| `grailwar.py` | `final 90 bunny` | `bunny_idle_final_sheet.png` | `stellan-the-calm-easter-bunny` (Skin) |
| `grailwar.py` | `final 90 tazune` | `tazune_idle_final_sheet.png` | `tazune-the-angry-hot-blood` |
| `grailwar.py` | `final 90 bakugo` | `bakugo_idle_final_sheet.png` | `explosive-tazune` (Skin) |
| `grailwar.py` | `final 90 kyli` | `kyli_idle_final_sheet.png` | `kyli-the-deceptive-sapling` |
| `grailwar.py` | `final 90 zi` | `zi_idle_final_sheet.png` | `timeless-king-zi` |
| `grailwar.py` | `final 90 waflav` | `waflav_idle_final_sheet.png` | `waflav-the-metamorphing-monstrosity` |
| `grailwar.py` | `final 90 wahflav` | `wahflav_idle_final_sheet.png` | `wahflav-the-uninvited-fighter` (Skin) |
| `grailwar.py` | `final 90 ash` | `ash_idle_final_sheet.png` | `barker-the-monster-trainer` (Skin) |
| `grailwar.py` | `final 90 zetsu` | `zetsu_idle_final_sheet.png` | `kyli-the-true-mastermind` (Skin) |
| `grailwar.py` | `final 90 xal` | `xal_idle_final_sheet.png` | `xal-the-animated-armor` |
| `grailwar.py` | `final 90 axal` | `axal_idle_final_sheet.png` | `alchemic-xal` (Skin) |
| `grailwar.py` | `final 90 octo` | `octo_idle_final_sheet.png` | `alleria-the-octo-princess` (Skin) |
| `grailwar.py` | `final 90 dreemurr` | `dreemurr_idle_final_sheet.png` | `monster-prince-asriel` (Skin) |
| `guardianbeasts.py` | `final 90 mao` | `mao_idle_final_sheet.png` | `mao-the-vengeful-guardian` |
| `guardianbeasts.py` | `final 90 hunter` | `hunter_idle_final_sheet.png` | `vengeful-hunter-mao` (Skin) |
| `guardianbeasts.py` | `final 90 dajan` | `dajan_idle_final_sheet.png` | `dajan-conqueror-of-the-treasure-cave` |
| `hawaii.py` | `final 90 taio` | `taio_idle_final_sheet.png` | `taio-the-sun-fencer` |
| `hawaii.py` | `final 90 taioasc` | `taioasc_idle_final_sheet.png` | `taio-absorber-of-the-mountain-s-heart` |
| `hawaii.py` | `final 90 waflav` | `waflav_idle_final_sheet.png` | `flamebathed-waflav` |
| `hawaii.py` | `final 90 pele` | `pele_idle_final_sheet.png` | `luna-pele-the-flame-dancer` |
| `hawaii.py` | `final 90 tempeste` | `tempeste_idle_final_sheet.png` | `tempeste-the-weather-fairy` |
| `hawaii.py` | `final 90 tempeluna` | `tempeluna_idle_final_sheet.png` | `tempeluna-the-convergence-fairy` |
| `hawaii.py` | `final 90 moana` | `moana_idle_final_sheet.png` | `tempeste-moana-the-rain-singer` |
| `hawaii.py` | `final 90 lizbeth` | `lizbeth_idle_final_sheet.png` | `lizbeth-the-reaper-of-the-light` |
| `hawaii.py` | `final 90 johanna` | `johanna_idle_final_sheet.png` | `johanna-crusader-of-light` |
| `hawaii.py` | `final 90 calamitusk` | `calamitusk_idle_final_sheet.png` | `calamitusk-the-chaorc-war-chief` |
| `hawaii.py` | `final 90 karian` | `karian_idle_final_sheet.png` | `grand-inquisitor-karian` |
| `india.py` | `final 90 madaga` | `madaga_idle_final_sheet.png` | `madaga-the-forsaken-seafarer` |
| `india.py` | `final 90 logan` | `logan_idle_final_sheet.png` | `logan-the-investment-monkee` |
| `india.py` | `final 90 trifecta` | `trifecta_idle_final_sheet.png` | `tri-fecta-the-puppet-master` |
| `india.py` | `final 90 triad` | `triad_idle_final_sheet.png` | `tri-ad-the-puppet-mistress` |
| `india.py` | `final 90 zamorin` | `zamorin_idle_final_sheet.png` | `zamorin-the-spice-rajah` |

`bubbles.py` ohne `gross` erzeugt eine auf Hero-Größe verkleinerte Variante
(Sprite aus `bubbles_downscale.py`), die aktuell nicht verwendet wird.

Alle Skripte sind deterministisch und reproduzieren die eingecheckten Sheets
pixelgenau.

## Sprites aus den xcf-Arbeitsdateien

Die GIMP-Arbeitsdateien liegen im Repo `PixelPartiesSprites` (Git LFS).
`xcf_extract.py` listet Ebenen, zeigt sie einzeln an und setzt ausgewählte
Ebenen (in Stapelreihenfolge, mit Deckkraft) zu einem zugeschnittenen Sprite
zusammen:

```bash
python3 xcf_extract.py MotiveMoe.xcf list mary                 # Ebenen suchen
python3 xcf_extract.py MotiveMoe.xcf preview vorschau.png 485 489
python3 xcf_extract.py MotiveMoe.xcf assemble src/cute-princess-mary.png "Mary-Kopie" "Mary #1"
```

| Sprite in `src/` | Datei | Ebenen |
|---|---|---|
| `cute-princess-mary.png` | `MotiveMoe.xcf` | `Mary-Kopie` (goldene Mary mit Krone) + `Mary #1` (Flügel) |
| alle übrigen MotiveMoe-Heroes | `MotiveMoe.xcf` | reproduzierbar per `python3 assemble_moe.py <MotiveMoe.xcf>` (Zuordnung im Skriptkopf) |
| MotiveMoe-Skins und weitere Heroes (2. Durchgang) | `MotiveMoe.xcf` | reproduzierbar per `python3 assemble_moe_skins.py <MotiveMoe.xcf>` (Zuordnung im Skriptkopf) |
| MotiveArcanum-Heroes und Skin Dark Maho | `MotiveArcanum.xcf` | reproduzierbar per `python3 assemble_arcanum.py <MotiveArcanum.xcf>` (Zuordnung im Skriptkopf) |
| MotiveBoons-Heroes und -Skins | `MotiveBoons.xcf` | reproduzierbar per `python3 assemble_boons.py <MotiveBoons.xcf>` (Zuordnung im Skriptkopf) |
| MotiveEgypt-Heroes und -Skins | `MotiveEgypt.xcf` | reproduzierbar per `python3 assemble_egypt.py <MotiveEgypt.xcf>` (Zuordnung im Skriptkopf) |
| MotiveSteamDwarfs-Heroes und -Skins | `MotiveSteamDwarfs.xcf` | reproduzierbar per `python3 assemble_steamdwarfs.py <MotiveSteamDwarfs.xcf>` (Zuordnung im Skriptkopf; die Datei braucht `xcf_scan.patch_gimpformats`) |
| MotiveBritain-Heroes und -Skins | `MotiveBritain.xcf` | reproduzierbar per `python3 assemble_britain.py <MotiveBritain.xcf>` (Zuordnung im Skriptkopf) |
| MotiveChina-Heroes | `MotiveChina.xcf` | reproduzierbar per `python3 assemble_china.py <MotiveChina.xcf>` (Zuordnung im Skriptkopf) |
| MotiveCoolhalla-Heroes und Skin | `MotiveCoolhalla.xcf` | reproduzierbar per `python3 assemble_coolhalla.py <MotiveCoolhalla.xcf>` (Zuordnung im Skriptkopf; Cooldin wird aus zwei Szenen-Ebenen ausgeschnitten) |
| MotiveDeepsea-Heroes und -Skins | `MotiveDeepsea.xcf` | reproduzierbar per `python3 assemble_deepsea.py <MotiveDeepsea.xcf>` (Zuordnung im Skriptkopf; Scherben-Vorlagen für die Lolek-Partikel als `-shards.png`) |
| MotiveDeri-Heroes und -Skin | `MotiveDeri.xcf` | reproduzierbar per `python3 assemble_deri.py <MotiveDeri.xcf>` (Zuordnung im Skriptkopf; Thron, Arm, Bogen, Hände und Zinnen als bewegliche Teile `-<teil>.png`) |
| MotiveGN-Heroes und -Skins | `MotiveGN.xcf` | reproduzierbar per `python3 assemble_gn.py <MotiveGN.xcf>` (Zuordnung im Skriptkopf; Ascended-Riffels Pistole vor ihr stammt aus dem Szenenbild „Sichtbar #146“; Nero Ziras Schläuche und Kabelenden werden ergänzt) |
| MotiveGrailWar-Heroes und -Skins | `MotiveGrailWar.xcf` | reproduzierbar per `python3 assemble_grailwar.py <MotiveGrailWar.xcf>` (Zuordnung im Skriptkopf; bewegliche Teile als `-<teil>.png`, Brackles Totenschädel als `brackle-skull.png`; die Unterkörper der Alchemisten, Mariannes Haare und Asriel Dreemurrs Hose in Uniformfarben werden ergänzt, Ingos Kapuzen-Frames liegen in `src/user/`) |
| MotiveGuardianBeasts-Heroes und Skin | `MotiveGuardianBeasts.xcf` | reproduzierbar per `python3 assemble_guardianbeasts.py <MotiveGuardianBeasts.xcf>` (Zuordnung im Skriptkopf; die übrigen Ebenen sind die zwölf Wächter-Kreaturen; Maos Schlitzspur als `-slash`, der Körper darunter wird ergänzt; Dajans Dolch und Blut als `-dagger`/`-blood`) |
| MotiveHawaii-Heroes | `MotiveHawaii.xcf` | reproduzierbar per `python3 assemble_hawaii.py <MotiveHawaii.xcf>` (Zuordnung im Skriptkopf; Base-Taios Beine aus „Taio-Kopie“, seine Hand am Griff als `-hand`; Ascended Taio mit Base-Taios um 180° gedrehtem Flammenschwert; Waflavs Feuerflügel als `-wings`; Calamitusks Banner als `-banner`) |
| MotiveIndia-Heroes | `MotiveIndia.xcf` | reproduzierbar per `python3 assemble_india.py <MotiveIndia.xcf>` (Zuordnung im Skriptkopf; die übrigen Ebenen sind Kreaturen, Puppen und Rennboote; Zamorins Glasschale und Sack als `-bowl`/`-sack`) |

Neue Datei durchsuchen: `xcf_scan.py dump` legt alle Ebenen einzeln ab,
`xcf_scan.py match <ordner> --heroes` gleicht sie mit allen noch nicht
animierten Hero-Karten ab (Fehler relativ zum Kontrast der Ebene – Werte
um 0,2–0,4 sind echte Treffer, ab ~0,45 Rauschen) und `xcf_scan.py sheet`
zeigt Karte und beste Ebenen nebeneinander. Aus dem Repo-Wurzelordner:

```bash
python3 scripts/hero-animations/xcf_scan.py dump MotiveArcanum.xcf /tmp/arc
python3 scripts/hero-animations/xcf_scan.py match /tmp/arc --heroes
python3 scripts/hero-animations/xcf_scan.py sheet /tmp/arc /tmp/arc_treffer.png 0.45
```

`assemble_moe.py` speichert bewegliche Teile zusätzlich deckungsgleich als
`src/<slug>-<teil>.png` (z. B. `-body`, `-wings`, `-arm`, `-flames`, `-fist`),
damit Flügel, Arme oder Feuer getrennt animiert werden können.
Achtung: nicht jede Ebene mit Namen des Heroes ist die richtige – Ascended
Molinda liegt z. B. in `Ascended Molinda-Kopie`, nicht in `Ascended Molinda`.

Abgleich immer mit der Karte in `cards/<Kartenname>.png`: dieselbe Figur liegt
oft in mehreren Farb-/Kostümvarianten in der Datei (z. B. `Mary` = rote
Variante ohne Krone/Flügel), Hintergründe/Auren der Karte gehören nicht zum Sprite.

## Konventionen

* **Dateiname** = Kartenname wie bei den Effekt-Skripten:
  `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` ohne Rand-Bindestriche
  (Umlaute und Apostrophe werden also zu `-`, z. B. `g-ldefaber-…`).
* **Spritesheet**: horizontal, alle Frames gleich groß, Loop nahtlos.
* **JSON**: `frameWidth`, `frameHeight`, `frames`, `frameMs`, `loop`,
  `layout` und – falls die Leinwand gegenüber dem Original vergrößert wurde –
  `padTop`/`padLeft`/`padRight`/`padBottom`. Um diesen Rand muss die Animation
  verschoben werden, damit sie deckungsgleich mit dem statischen Sprite liegt.
* **Skins** (Karten in `cards/skins`, Zuordnung in `data/skins.json`): Datei
  unter dem Slug des Skin-Namens, im JSON `hero` = Skin-Name und `skinOf` =
  Name der Hero-Karte. (Das Brett lädt Animationen bisher nur über den
  Hero-Namen – Skin-Sheets werden dort erst angezeigt, wenn es den Skin
  berücksichtigt.)
* **`faceX`** (Pflicht für neue Sheets): waagrechte Mitte des **Gesichts** in
  Frame-Pixeln, gemessen von der linken Frame-Kante (Kommazahlen erlaubt,
  z. B. `12.5`). Auf dem Brett steht das Gesicht genau über der Kartenmitte –
  Haare, Waffen oder Umhänge verschieben den Helden dadurch nicht mehr.
  Fehlt `faceX`, nimmt das Brett den Schwerpunkt des obersten Figurendrittels.
* **`anchorX`** (optional): ausdrücklich abweichender Bildmittelpunkt in
  denselben Einheiten; hat Vorrang vor `faceX` („sofern nicht anders
  angegeben, ist das Gesicht die Mitte").
* **`footY`** (optional): Standlinie in Frame-Pixeln von oben – hier steht
  der Held auf der Kartenmitte. Ohne Angabe gilt das unterste deckende
  Pixel. Nötig, wenn unter den Füßen noch etwas liegt (Medeas Schlangen);
  dieser Teil wird nicht abgeschnitten, sondern liegt vor dem Helden.
* **`boardScale`** (optional): Größenfaktor auf dem Brett für Ausreißer
  (Bubbles: `0.5`). Sonst stehen alle Helden im selben Maßstab.
* **`alphaScale`** (optional): Faktor auf die Deckkraft aller
  halbtransparenten Pixel (Gas, Rauch, Auren) auf dem Brett; voll deckende
  Pixel bleiben, wie sie sind. `< 1` = durchsichtiger (Medea: `0.55`).
* Partikel, die die Figur nie berühren (Regen, Glut), in `particles.py`.
* Gemeinsame Helfer (Glitzersterne, Lichtschimmer, Speichern, 1-px-Ring) in
  `anim_common.py`, Flügelschlag (Drehung ums Schultergelenk bzw. spaltentreue
  Scherung für sehr kleine Flügel, Lochfüller) in `flap_common.py`.

## Stil-Lektionen aus dem Feedback

* Freiheiten beim Ergänzen/Ändern von Pixeln sind ausdrücklich erwünscht
  (neue Glanz-/Rauch-/Funkenfarben, fehlende Bildteile vervollständigen).
* Stehende Figuren: **Füße bleiben immer am Boden** (Wippen aus den Knien);
  nur schwebende Figuren bewegen sich als Ganzes.
* **Bildinhalte** (bemaltes Schild, Landkarte) **nicht animieren** – nur mitbewegen.
* Gesichter: vorhandene Details (Augenweiß, Mund, Bäckchen) nicht übermalen;
  einen vorhandenen Mund editieren statt einen zweiten zu malen. Vorsicht bei
  Handgesten (keine Mittelfinger-Optik).
* **Keine Lücken**: zusammenhängende Flächen per Rückwärts-Mapping bzw. stetigem
  Verschiebungsfeld bewegen (Hals, Kopf/Körper); Arme bleiben mit der Schulter
  verbunden (Hubhöhe über den Arm verteilen, Schulterplatten mitkippen).
* Verformte Outlines neu als 1-px-Kontur zeichnen, statt sie mitzudehnen.
* Gas soll fließen/wehen (aufsteigende Schlieren, Randwellen, Wind) statt zu
  „wabbeln“, aus seiner Quelle entstehen und Augen/Gesichter nicht überdecken.
* Bewegungen lieber etwas lebendiger/übertriebener; Idle-Haltung aber nicht
  „tänzerisch“. Wippen mit dem ganzen Körper wirkt besser als Einzelbewegungen
  im Gesicht (Gesichter nicht „drehen“).
* Keine Silhouetten-Verbreiterung oder -Dellen durch Wind/Schlackern
  (Wind in eine Richtung, nur lose Strähnen bewegen).
* Outline-Pixel von Armen/Händen nie für Gesten übermalen.
* Laufende Muster (Kettensäge): Periode deutlich größer als 2x Tempo und
  Bewegungsspuren, sonst wirkt es wie Hin-und-her oder läuft rückwärts.
  Unvollständige/verwischte Objekte dürfen komplett neu gezeichnet werden.
* Wird ein Objekt bewegt/weggeworfen, alles ergänzen, was es in Ruhe verdeckt
  (Arm, Handecke, Handgelenk) – sonst schweben Hände oder entstehen Kerben.
* Bewegte Teile (Schwert, Knauf) vollständig maskieren und per Pixelvergleich
  über alle Frames prüfen; Freigelegtes nie mit Teilen des Objekts selbst füllen.
* **Nichts darf je abgeschnitten sein**: Partikel (Glitzer, Noten, Blitze,
  Herzchen, Pfeile) liegen komplett im Bild oder werden weggelassen bzw.
  blenden vorher aus; `save_outputs(..., check_edges=True)` bricht ab, sobald
  ein Frame den Bildrand berührt. Partikel auch nie halb hinter der Figur
  anschneiden – ganz oder gar nicht zeichnen.
* Auren, die im Original genau die Silhouette umgeben (Jenny), bei bewegten
  Flügeln jedes Frame neu als Ring um die aktuelle Silhouette berechnen.
* Vorhandene Mimik genau ansehen: ein roter Fleck unten im Gesicht ist oft
  schon ein offener Mund (Vena) – Brüllen dann nur dezent verstärken. Ein
  Strich-Auge kann schon ein Zwinkern sein (Monia).
* **Nie „verwaschen“: keine Neu-Rasterung kleiner Bewegungen.** Fließendes
  Skalieren (Squash um ein paar Prozent) oder Drehen um kleine Winkel mit
  Neuabtastung lässt jedes Frame an wandernden Stellen Zeilen doppeln bzw.
  wegfallen und schräge 1-px-Linien neu rastern – die Figur flimmert, die
  Pixel „laufen ineinander“ (Alleria v5). Stattdessen nur **ganzzahlige
  Verschiebungen ganzer Blöcke**: Squash-and-Stretch als 1-px-Hub an einer
  festen Naht (wie das Federn in den Knien, Nahtzeile dehnen), kleine
  Neigungen als spaltenweise Scherung (jede Spalte rückt als Ganzes um
  `round(k * Abstand)`), dünne Glieder (Spinnenbeine) biegen, indem jedes
  Pixel ganzzahlig um `round(Hub * Anteil entlang des Glieds)` rückt.
  Drehung mit Neuabtastung nur für große Winkel (echter Flügelschlag).
* **Loop-Längen**: jede Teilbewegung muss N glatt teilen (Federn alle 12
  Frames -> N = 36, nicht 32), sonst bricht am Loop-Ende eine Bewegung ab
  und es entstehen z. B. zwei schnelle Bounces hintereinander. Zufalls-
  Partikel mit Generationen: Generation modulo (N / Periode) nehmen.
