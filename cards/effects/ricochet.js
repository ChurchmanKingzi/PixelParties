// ═══════════════════════════════════════════
//  CARD EFFECT: „Ricochet"
//  Attack (Normal, Fighting Lv2)
//
//  "Both players take turns choosing targets their opponent controls
//   that have not been chosen with this effect yet until a player
//   cannot choose a new target. You choose first. The first target
//   takes damage equal to the attacker's Attack stat. Every subsequent
//   target takes half as much damage as the previous one (rounded up)."
//
//  ── DIE ZIELWAHL SPRINGT ZWISCHEN DEN SEITEN ──────────────────────
//  ★ „targets THEIR OPPONENT controls" gilt je WAEHLER. Der Angreifer
//  waehlt also auf der Gegenseite, der Gegner danach auf der
//  Angreiferseite, und so weiter — der Schuss prallt hin und her. Das
//  ist der Namensgeber der Karte und leicht zu uebersehen: es steht
//  NICHT „targets your opponent controls".
//
//  Ein Ziel kann nur EINMAL gewaehlt werden, ueber beide Seiten hinweg.
//  Schluss ist, sobald der naechste Waehler kein neues Ziel mehr hat.
//
//  Die Wahl ist NICHT abbrechbar — „take turns choosing … until a
//  player CANNOT choose" kennt kein Aussteigen, nur „keine Ziele mehr".
//
//  ── ERST ALLES WAEHLEN, DANN SCHIESSEN ────────────────────────────
//  Der Kartentext listet die Zielwahl vollstaendig auf, bevor er vom
//  Schaden spricht. Das passt auch zur Animation: EIN Querschlaeger,
//  der die ganze Kette entlangspringt, statt Wahl-Schuss-Wahl-Schuss.
//
//  Zwischen Wahl und Einschlag kann ein Ziel verschwinden (Reaktionen).
//  Dann faellt nur DIESER Treffer aus; die Halbierung laeuft trotzdem
//  weiter, denn der Kartentext bindet sie an die POSITION in der Kette,
//  nicht daran, ob der Vorgaenger wirklich getroffen hat.
//
//  ── FLAECHENKLAMMER ──────────────────────────────────────────────
//  ★ Gleiche Bauform wie „Chain Lightning" (CARD_API: „springt zwar von
//  Ziel zu Ziel, ist aber EINE Quelle ueber die ganze Kette"), also
//  geklammert — „Interference" schuetzt dagegen. Bei genau EINEM Ziel
//  bleibt es ein Einzeltreffer und der Schutz greift korrekt nicht.
//
//  ── ANIMATION ────────────────────────────────────────────────────
//  Al 14.9.: das Projektil von „Crusader's Flintlock", das von Ziel zu
//  Ziel springt, „mit einem Sound jedes Mal". Der Klang kommt von
//  selbst — `play_projectile_animation` spielt je Flug `sfx ||
//  'projectile'`. Der erste Flug geht vom Helden aus, jeder weitere vom
//  vorherigen EINSCHLAG.
// ═══════════════════════════════════════════

const CARD_NAME = 'Ricochet';
const FLUGZEIT = 260;

/** Eindeutiger Schluessel eines Ziels, ueber beide Seiten hinweg. */
function zielSchluessel(t) {
  return t.type === 'hero'
    ? `hero:${t.owner}:${t.heroIdx}`
    : `creature:${t.owner}:${t.heroIdx}:${t.slotIdx}`;
}

/**
 * Schaden an Position `nummer` (1-basiert): „The first target takes damage
 * equal to the attacker's Attack stat. Every subsequent target takes half as
 * much damage as the previous one (rounded up)." — dieselbe Rechnung wie
 * beim Abfeuern.
 */
function schadenAnPosition(atk, nummer) {
  let s = atk;
  for (let i = 1; i < nummer; i++) s = Math.ceil(s / 2);
  return s;
}

/** Alle waehlbaren Ziele auf der Seite `seite`. */
function zieleAuf(engine, seite) {
  const out = [];
  try {
    out.push(...engine.getHeroTargets(seite));
    out.push(...engine.getCreatureTargets(seite));
  } catch { /* defensiv */ }
  return out;
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (siehe CARD_API): bei einer
  // Negation spielt die Engine diese Bilder, damit der abgewehrte
  // Zauber sichtbar bleibt.
  spellVisual: {
    projectile: { emoji: '•', duration: 520 },
    stagger: 110, flightMs: 330,
    impact: { type: 'arrow_impact' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Blinded-Gate: die Karte oeffnet eine Zielwahl.

  spellPlayCondition(gs, pi, engine) {
    // Der Angreifer waehlt zuerst — ohne ein Ziel beim Gegner passiert
    // gar nichts.
    return zieleAuf(engine, pi === 0 ? 1 : 0).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero || gs.players[pi]?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const atk = hero.atk || 0;

      // ── 1) Abwechselnd waehlen ──────────────────────────────────
      // ★★ v1150 (Al 17.9.: „Ziele, die schon getroffen wurden, koennen
      // noch mal angewaehlt werden — der Auswahlprozess ist unendlich").
      //
      // URSACHE: `promptEffectTarget` liefert die IDs der gewaehlten Ziele
      // (`'hero-1-0'`), nicht die Zielobjekte. Die Schleife behandelte die
      // ID als Objekt: `zielSchluessel('hero-1-0')` ergab fuer JEDE Wahl
      // denselben Unsinn-Schluessel, also filterte `gewaehlt` nie etwas
      // heraus — und im Schadensteil hatte der String weder `type` noch
      // `owner`, kein einziger Treffer landete. Jetzt wird die ID auf das
      // Zielobjekt aus der angebotenen Liste zurueckgefuehrt.
      //
      // Jede Wahl setzt eine Zielmarke „#N" (`engine.setzeZielMarke`):
      // beide Spieler sehen die ganze Kette mit Positionsnummern, und das
      // gerade gewaehlte Ziel leuchtet rot auf.
      const gewaehlt = new Set();
      const kette = [];
      let waehler = pi;                       // „You choose first."
      try {
        // Obergrenze nur als Gurt: jede Runde verbraucht ein Ziel, die
        // Kette endet also spaetestens, wenn beide Seiten leer sind.
        for (let runde = 0; runde < 40; runde++) {
          const gegenseite = waehler === 0 ? 1 : 0;
          const frei = zieleAuf(engine, gegenseite)
            .filter(t => !gewaehlt.has(zielSchluessel(t)));
          if (frei.length === 0) break;       // „cannot choose a new target"

          const nummer = kette.length + 1;
          // ★★ v1151 (Al 17.9.): die CPU zielt bei JEDER Wahl wie bei einem
          // normalen Einzelziel-Angriff mit der AKTUELLEN Staerke dieser
          // Position. `baseDamage` + `damageType` schalten im Piloten
          // `pickEnemyTargets` scharf (Wert des Ziels, tatsaechlich
          // landender Schaden, Kill-Bonus); ohne sie bewertete er „Schaden
          // unbekannt" und zielte nur nach Wert. Bereits gewaehlte Ziele
          // sind gar nicht erst in `frei`.
          const schadenHier = schadenAnPosition(atk, nummer);
          const wahl = await engine.promptEffectTarget(waehler, frei, {
            title: CARD_NAME,
            source: CARD_NAME,
            description: `Choose target #${nummer} for ${CARD_NAME} (${schadenHier} damage). Targets already chosen are marked with their number.`,
            confirmLabel: `🎯 #${nummer}`,
            maxSelect: 1, maxTotal: 1,
            cancellable: false,
            baseDamage: schadenHier,
            damageType: 'attack',
          });
          const zielId = Array.isArray(wahl) ? wahl[0] : wahl;
          const idText = (zielId && typeof zielId === 'object') ? zielId.id : zielId;
          const ziel = frei.find(t => t.id === idText);
          if (!ziel) break;                    // keine gueltige Antwort

          gewaehlt.add(zielSchluessel(ziel));
          kette.push(ziel);
          engine.setzeZielMarke(ziel, `#${nummer}`, CARD_NAME, waehler);
          engine.log('ricochet_pick', {
            player: gs.players[waehler]?.username, nummer,
            target: ziel.cardName || null,
          });
          // Die CPU waehlt ohne Denkpause — kurz warten, damit der
          // Mensch den Blitz und die Nummer auch sieht.
          if (engine.isCpuPlayer(waehler) && !engine._inMctsSim && !engine._fastMode) {
            await engine._delay(1100);   // v1151: laenger, passend zur deutlicheren Animation
          }
          waehler = gegenseite;                // der Getroffene ist als Naechster dran
        }
      } catch (err) {
        engine.loescheZielMarken(CARD_NAME);
        throw err;
      }
      if (kette.length === 0) { engine.loescheZielMarken(CARD_NAME); gs._spellCancelled = true; return; }

      // ── 2) Die Kette abfeuern ───────────────────────────────────
      const attackSource = {
        name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true,
      };
      // Startpunkt des ersten Fluges ist der angreifende Held.
      let vonOwner = ctx.cardHeroOwner ?? pi;
      let vonHeroIdx = heroIdx;
      let vonSlot = -1;
      let schaden = atk;

      // ★★ v1185: Klammer meldet zusaetzlich die Kreaturen der Kette an
      // das Anti-AoE-Fenster (Deepsea Idol).
      await engine.beginAoeStrike(kette.length, {
        creatures: kette
          .filter(z => z.type !== 'hero')
          .map(z => z.cardInstance || engine.cardInstances.find(c =>
            c.owner === z.owner && c.zone === 'support'
            && c.heroIdx === z.heroIdx && c.zoneSlot === z.slotIdx))
          .filter(Boolean),
        source: attackSource, amount: atk, type: 'attack', sourceOwner: pi,
      });
      try {
        for (const ziel of kette) {
          const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;

          // Querschlaeger: Flintlock-Kugel vom letzten Einschlag zum
          // naechsten Ziel. Der Klang haengt am Aufruf.
          engine._broadcastEvent('play_projectile_animation', {
            sourceOwner: vonOwner, sourceHeroIdx: vonHeroIdx, sourceZoneSlot: vonSlot,
            targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
            targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
            emoji: '•',
            emojiStyle: { fontSize: 26, color: '#ffd9a0', textShadow: '0 0 8px rgba(255,190,90,.95)' },
            duration: FLUGZEIT,
          });
          await engine._delay(FLUGZEIT);
          engine._broadcastEvent('play_zone_animation', {
            type: 'arrow_impact', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: zielSlot,
          });

          if (ziel.type === 'hero') {
            const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
            if (h && h.hp > 0) {
              await engine.actionDealDamage(attackSource, h, schaden, 'attack');
            }
          } else {
            const inst = ziel.cardInstance || engine.cardInstances.find(c =>
              c.owner === ziel.owner && c.zone === 'support'
              && c.heroIdx === ziel.heroIdx && c.zoneSlot === ziel.slotIdx);
            if (inst && inst.zone === 'support') {
              await engine.actionDealCreatureDamage(
                attackSource, inst, schaden, 'attack',
                { sourceOwner: pi, canBeNegated: true },
              );
            }
          }

          // Der Einschlag ist der Ausgangspunkt des naechsten Sprungs.
          vonOwner = ziel.owner;
          vonHeroIdx = ziel.heroIdx;
          vonSlot = zielSlot;
          // „half as much as the PREVIOUS one (rounded up)" — an die
          // Position gebunden, nicht an den Erfolg des Vorgaengers.
          schaden = Math.ceil(schaden / 2);
        }
      } finally {
        await engine.endMultiHit();
        engine.loescheZielMarken(CARD_NAME);   // v1150: Kette abgefeuert
      }

      engine.log('ricochet', {
        player: gs.players[pi]?.username, atk, treffer: kette.length,
      });
      engine.sync();
    },
  },

  /**
   * CPU: die Zielwahl laeuft ueber `promptEffectTarget`, das der Pilot
   * ohnehin bewertet (Schadenshoehe kennt er ueber `baseDamage` nicht,
   * also entscheidet die normale Ziel-Rangfolge). Kein eigener
   * `cpuResponse` noetig — er wuerde die gelernten Ziel-Prioren nur
   * ueberstimmen.
   */
};
