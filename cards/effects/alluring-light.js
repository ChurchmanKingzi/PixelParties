// ═══════════════════════════════════════════
//  CARD EFFECT: „Alluring Light"
//  Spell (Normal, Decay Magic Lv1)
//
//  "Choose a Hero your opponent controls and a target you control. Your
//   chosen target takes damage equal to the chosen Hero's Attack stat.
//   This is treated as the chosen Hero attacking your chosen target."
//
//  ── DIE KARTE DREHT DIE RICHTUNG UM ──────────────────────────────
//  ★ Der SCHADEN GEHT AUF DIE EIGENE SEITE. Man waehlt einen
//  GEGNERISCHEN Helden als Angreifer und ein EIGENES Ziel als Opfer.
//  Das liest sich beim Ueberfliegen wie ein gewoehnlicher Angriff und
//  ist das Gegenteil — wer die Seiten vertauscht, baut eine voellig
//  andere Karte.
//
//  Der Sinn steckt in der letzten Zeile: „treated as the chosen Hero
//  ATTACKING" — der Angriff zaehlt dem GEGNER, samt allem, was daran
//  haengt (seine Angriffszaehler, Rueckstoss-Effekte wie „Rioting
//  Village", Gegenschlaege, alles was auf „ein Held greift an" hoert).
//  Man laesst den Gegner auf sich selbst einschlagen.
//
//  ── „THE CHOSEN HERO'S ATTACK STAT" ──────────────────────────────
//  Der AKTUELLE Wert des GEGNERISCHEN Helden (`hero.atk`), nicht
//  `baseAtk` — inklusive aller Buffs und Ausruestung. Deshalb ist die
//  Karte auch eine der 48, die den Attack stat lesen, ohne selbst ein
//  Attack zu sein (siehe Rioting Village: Statverdopplung wirkt hier
//  mit, Schadensverdopplung haette es nicht getan).
//
//  ── ANIMATION (Als Vorgabe 14.9.) ────────────────────────────────
//  ① Rhythmisches Leuchten auf dem ZIEL, das angegriffen werden soll
//     (`lure_beacon`) — das Licht, das lockt.
//  ② Dann rammt der angelockte Held hinein (`play_ram_animation`,
//     die Standard-Ramme) und verursacht dabei den Schaden.
// ═══════════════════════════════════════════

const { opponentOfGs } = require('./_opp');
const CARD_NAME = 'Alluring Light';

/**
 * ★ Antwort einer Zielwahl auf das ZIELOBJEKT zurueckfuehren.
 * `promptEffectTarget` liefert IDs; nur die angebotene Liste kennt die
 * Felder (`type`, `owner`, `heroIdx`, `slotIdx`, `cardInstance`).
 */
function zielVonAntwort(antwort, angebot) {
  const roh = Array.isArray(antwort) ? antwort[0] : antwort;
  if (!roh) return null;
  if (typeof roh === 'object' && roh.type) return roh;     // schon ein Ziel
  const id = typeof roh === 'object' ? roh.id : roh;
  return (angebot || []).find(t => t.id === id) || null;
}

/**
 * Lebende Helden, die `pi` KONTROLLIERT (Styx 28.9.) — Ziel-IDs bleiben
 * physisch, wie bei `engine.getHeroTargets`.
 */
function kontrollierteHeldenZiele(engine, pi) {
  return engine.heroesControlledBy(pi)
    .filter(({ hero }) => hero?.name && hero.hp > 0)
    .map(({ physOwner, heroIdx, hero }) => ({
      id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name,
    }));
}

/**
 * ★ W40a (Al, 22.10.2026, Punkt 5): „Alluring Light wählt ein gegnerisches UND ein eigenes Ziel. Beim eigenen Ziel greift kein Schutz vor Targeting wie Butterfly Cloud — aber beim
 * gegnerischen schon. Ein per Butterfly Cloud untargetable Hero kann NICHT als der Angreifer für Alluring Light gewählt werden!"
 * Die ANGREIFER-Wahl ist eine normale Zielwahl des Spielers gegen den Gegner: jeder Schutz vor Targeting gilt (Butterfly Cloud/`untargetable`, Invisibility/`invisible`, Stealth/Jetpack
 * & Co. über `blocksTargeting`; Chuck und das Truth-Seeing Eye des Wirkers heben es auf). Die Schutzrechnung läuft über ALLE lebenden Gegnerhelden („solange … andere Heroes, die gewählt
 * werden können"); erst danach fallen Helden heraus, die nicht angreifen können (W34a). Ist keiner wählbar, ist die Karte unspielbar. Die Wahl des EIGENEN Opfers prüft keinen Schutz
 * (der Wählende wählt sein eigenes Ziel; die Schutz-Marken richten sich nur gegen den Gegner).
 * @returns {object[]} Zielobjekte (`hero-<seite>-<idx>`) der wählbaren Angreifer
 */
function waehlbareAngreifer(engine, pi, oppIdx, opts = {}) {
  const alle = kontrollierteHeldenZiele(engine, oppIdx);
  const geschuetzt = new Set();
  if (!opts.ohneSchutz) {
    for (const id of engine._untargetableHeroIds(alle, pi)) geschuetzt.add(id);
    const quelle = engine._getCardDB()[CARD_NAME];
    for (const t of alle) {
      if (geschuetzt.has(t.id)) continue;
      if (engine.heroBlocksTargeting(t.owner, t.heroIdx, {
        sourceData: quelle, cardName: CARD_NAME, chooserIdx: pi, chooserHeroIdx: opts.chooserHeroIdx ?? -1, allTargets: alle,
      })) geschuetzt.add(t.id);
    }
  }
  return alle.filter(z => !geschuetzt.has(z.id) && engine.heroKannAngreifen(z.owner, z.heroIdx, oppIdx, { name: z.cardName }));
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'lure_beacon' }, impactMs: 260,
  },

  requiresTarget: true,

  spellPlayCondition(gs, pi, engine) {
    const oppIdx = opponentOfGs(gs, pi);
    if (!engine) return false;
    // Kontrolle statt Seite (Styx 28.9.)
    // ★ W34a (Al, 22.10.2026, Punkt 1: „Ja, ist korrekt"): der gezwungene Held ist geblockt, wenn er nicht angreifen kann (Frozen, Stunned, Webbed, Bound, harte Negierung,
    // Attack-Sperren/-Zähler: `heroKannAngreifen`) — ohne einen angriffsfähigen Gegnerheld ist die Karte nicht spielbar.
    // ★ W40a (Al, 22.10.2026, Punkt 5): zusätzlich muss mindestens ein Gegnerheld als Angreifer WÄHLBAR sein (Schutz vor Targeting: Butterfly Cloud, Invisibility, Stealth …).
    // Hat einer der eigenen Helden ein Truth-Seeing Eye (der Wirker steht erst beim Spielen fest), bleibt die Prüfung großzügig (der Schutz wird erst in `onPlay` gerechnet).
    const mitAuge = engine.heroesControlledBy(pi).some(({ physOwner, heroIdx: hi }) => engine._sourceHasTruthSeeingEye({ name: CARD_NAME, owner: pi, controller: pi, heroIdx: hi, heroOwner: physOwner }));
    const hatHelden = waehlbareAngreifer(engine, pi, oppIdx, { ohneSchutz: mitAuge }).length > 0;
    if (!hatHelden) return false;
    try { return kontrollierteHeldenZiele(engine, pi).length + engine.getCreatureTargets(pi).length > 0; }
    catch { return false; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = engine.opponentOf(pi);

      // ── ① Den ANGREIFER waehlen: ein Held des GEGNERS ─────────────
      // W34a: nur Helden, die ANGREIFEN können (`heroKannAngreifen`, Kontrolleur = Gegner) sind als Angreifer wählbar.
      // W40a (Al, 22.10.2026, Punkt 5): die Wahl des gegnerischen Angreifers achtet jeden Schutz vor Targeting (`waehlbareAngreifer`); das Truth-Seeing Eye des Wirkers hebt ihn auf.
      const mitAuge = engine._sourceIgnoresTargetingRestrictions(ctx.card);
      const gegnerZiele = waehlbareAngreifer(engine, pi, oppIdx, { ohneSchutz: mitAuge, chooserHeroIdx: ctx.cardHeroIdx });   // Kontrolle statt Seite (Styx 28.9.)
      const heldWahl = await engine.promptEffectTarget(pi, gegnerZiele, {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: ctx.cardHeroIdx,
        title: CARD_NAME,
        description: "Choose an opponent's Hero — it will be lured into attacking.",
        confirmLabel: '✨ Lure!',
        maxSelect: 1, maxTotal: 1,
        cancellable: true,
      });
      // ★★ v1172 (Al 17.9.: „nach der Heldenwahl passiert gar nichts"):
      // `promptEffectTarget` liefert die IDs der gewaehlten Ziele
      // (`'hero-1-0'`), NICHT die Zielobjekte — dieselbe Falle wie bei
      // „Ricochet" (v1150). Hier las die Karte `heldWahl[0].heroIdx` an
      // einer Zeichenkette, bekam `undefined` und brach still ab, bevor
      // die zweite Zielwahl ueberhaupt aufging.
      const angreiferZiel = zielVonAntwort(heldWahl, gegnerZiele);
      if (!angreiferZiel) { gs._spellCancelled = true; return; }
      const angreifer = gs.players[angreiferZiel.owner]?.heroes?.[angreiferZiel.heroIdx];
      if (!angreifer?.name || angreifer.hp <= 0) { gs._spellCancelled = true; return; }

      // ★ W30a (Al, 21.10.2026): ab hier gilt der Treffer als Attack des gewaehlten Helden — die Quellstufe ist dessen FIGHTING-LEVEL, NICHT die gedruckte Stufe 1
      // der Karte. Der Stempel liegt (nur waehrend der Aufloesung) auch auf der Karteninstanz, damit die Fenster der Opferwahl (Surprises, Hand-Reaktionen:
      // Glass Wall, Test Flight, Escape Device …) ihn sehen; das Treffer-Quellobjekt `attackSource` traegt ihn ebenfalls. Die Wahl des Angreifers (①) bleibt
      // ein Spell der gedruckten Stufe.
      const angriffStempel = engine.heldenAngriffStempel(angreiferZiel.owner, angreiferZiel.heroIdx);
      ctx.card.treatedAsAttack = angriffStempel;
      try {
        // ★ „treated as the chosen Hero attacking" — die Quelle ist der
        // GEGNERISCHE Held, nicht der Spieler dieser Karte. Damit zaehlt
        // der Angriff ihm, samt allem, was daran haengt.
        // ★ W32a (Al, 22.10.2026): „Alluring Light selbst zählt als Lv-1-Spell. Der von Alluring Light provozierte Angriff zählt NICHT als Spell, sondern als Attack mit dem
        // Fighting-Level des von Light zum Angriff gezwungenen Heroes." Die Quelle des Treffers ist deshalb der gezwungene HELD (Name = Heldenkarte, Schadenstyp `attack`),
        // NICHT die Spell-Karte „Alluring Light": Anti Magic Shield / Magic Mirror / Anti Magic (Spell-Leser) sehen keinen Spell, Attack-Reaktionen (Escape, Magic Topaz,
        // Arrows, Bluff …) sehen den Angriff. Die Karte selbst (die Wahl) bleibt ein Spell der Stufe 1 (Instanz `ctx.card`).
        const attackSource = {
          name: angreifer.name,
          owner: angreiferZiel.owner, controller: oppIdx, heroIdx: angreiferZiel.heroIdx,
          usesHeroAtk: true,
          // W30a (Al, 21.10.2026): „treated as the chosen Hero attacking" → die Quellstufe ist das FIGHTING-LEVEL des gewählten (gegnerischen) Helden,
          // NICHT die gedruckte Stufe 1 der Karte (Stealth, Jetpack, Glass Wall, Test Flight, Escape Device …: `engine._heldenEffektStufe`).
          treatedAsAttack: angriffStempel,
        };
        // ★ W39a (Al, 22.10.2026): die Fenster der Opferwahl (Surprises, Hand-Reaktionen) sehen als Quelle den GEZWUNGENEN Helden (Quellobjekt `attackSource`), nicht die Karteninstanz
        // des Spielers: sonst war „der Angreifer" für Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Frost Rune, Spike Trap, Tharxian Horse, Crimson Web & Co. der EIGENE Held,
        // der Light spielt (er bekam Schaden/Brand/Frost; der gezwungene Held blieb verschont).
        // ── ② Das OPFER waehlen: ein Ziel auf der EIGENEN Seite ───────
        const eigene = [
          ...kontrollierteHeldenZiele(engine, pi),
          ...engine.getCreatureTargets(pi),
        ];
        if (eigene.length === 0) { gs._spellCancelled = true; return; }
        const opferWahl = await engine.promptEffectTarget(pi, eigene, {
          title: CARD_NAME,
          description: `Choose one of YOUR targets for ${angreifer.name} to attack.`,
          confirmLabel: '💥 Take the hit!',
          maxSelect: 1, maxTotal: 1,
          cancellable: true,
          sourceCard: attackSource,   // W30a: die Fenster der Opferwahl sehen den Stempel (Fighting-Level des Angreifers); W39a: Quelle = der gezwungene Held
        });
        const opfer = zielVonAntwort(opferWahl, eigene);
        if (!opfer) { gs._spellCancelled = true; return; }

        const opferSlot = opfer.type === 'hero' ? -1 : opfer.slotIdx;
        const atk = angreifer.atk || 0;

        // ★ W34a: zwischen Wahl und Treffer eingefroren/betäubt/gesperrt (Reaktion, Sperre): der gezwungene Held greift nicht an — die Karte ist verbraucht, es passiert nichts.
        if (!engine.heroKannAngreifen(angreiferZiel.owner, angreiferZiel.heroIdx, oppIdx, { name: angreifer.name })) {
          engine.log('alluring_light_blocked', { player: gs.players[pi]?.username, lured: angreifer.name });
          engine.sync();
          return;
        }

        // ── Animation ① das Anlock-Leuchten auf dem OPFER ─────────────
        // ★ v1173: laenger stehen lassen (Al 17.9.) — die Ebene raeumt die
        // Animation nach `duration` ab, der Guss wartet entsprechend.
        engine._broadcastEvent('play_zone_animation', {
          type: 'lure_beacon', owner: opfer.owner, heroIdx: opfer.heroIdx, zoneSlot: opferSlot,
          duration: 2400,
        });
        await engine._delay(1300);

        // W32a: der provozierte Angriff gehört dem GEGNER (Held des Angriffs) — Attack-Reaktionen (Magic Topaz, Arrows …) seiner Seite über die virtuelle Attack-Kette;
        // der gezwungene Held muss dafür nicht angriffsfähig sein (er wird gelockt, nicht aktiv: `casterCheck: false`).
        await engine.alsAttackKette({ name: CARD_NAME, pi: oppIdx, heroIdx: angreiferZiel.heroIdx, heroOwner: angreiferZiel.owner, casterCheck: false, ziele: [opfer], wirkName: angreifer.name, resolve: async () => {
        const finalDmg = await engine._fireAttackDeclare(attackSource, opfer, atk);

        // ── Animation ② der angelockte Held rammt hinein ──────────────
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: angreiferZiel.owner, sourceHeroIdx: angreiferZiel.heroIdx,
          targetOwner: opfer.owner, targetHeroIdx: opfer.heroIdx,
          targetZoneSlot: opferSlot,
          cardName: angreifer.name, duration: 1100,
        });
        await engine._delay(620);

        if (opfer.type === 'hero') {
          const h = gs.players[opfer.owner]?.heroes?.[opfer.heroIdx];
          if (h && h.hp > 0) {
            await engine.actionDealDamage(attackSource, h, finalDmg, 'attack');
          }
        } else {
          const inst = opfer.cardInstance || engine.cardInstances.find(c =>
            c.owner === opfer.owner && c.zone === 'support'
            && c.heroIdx === opfer.heroIdx && c.zoneSlot === opfer.slotIdx);
          if (inst && inst.zone === 'support') {
            await engine.actionDealCreatureDamage(
              attackSource, inst, finalDmg, 'attack',
              { sourceOwner: oppIdx, canBeNegated: true },
            );
          }
        }
        return true;
        } });

        engine._broadcastEvent('play_zone_animation', {
          type: 'explosion', owner: opfer.owner, heroIdx: opfer.heroIdx, zoneSlot: opferSlot,
        });

        engine.log('alluring_light', {
          player: gs.players[pi]?.username,
          lured: angreifer.name, victim: opfer.cardName, atk,
        });
        engine.sync();
      } finally { delete ctx.card.treatedAsAttack; }
    },
  },
};
